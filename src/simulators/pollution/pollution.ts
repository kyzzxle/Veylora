/**
 * Pollution in a lake (1 second of animation = 5 days).
 *
 * Nutrients and eutrophication (daily rates):
 *   nutrients N (mg/L)     dN = input − 0.05 N   (inflow and flushing)
 *   algae A (µg/L)         dA = A (0.8 · N/(N + 0.3) − 0.1 − 0.01 A)
 *   dead algae / sewage D  dD = 0.1 A + sewage − 0.15 D
 *   dissolved oxygen O     dO = 0.5 (9 − O) + 0.02 A − 0.15 D − fish breathing
 * More nutrients → algal bloom → more dead matter → bacteria decomposing it use
 * up oxygen → fish suffocate below about 2 mg/L.
 *
 * Mercury and bioaccumulation: mercury in the water W (ng/L) is taken up by
 * plankton and concentrated about 5 times at each step up the food chain
 * (plankton → small fish → large fish), and 3 times more in fish-eating birds.
 * Each level approaches its level slowly (larger, longer-lived animals take
 * longer), so concentrations keep rising for a while even after the source stops.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent', 'warning', 'danger', 'success'] as const;
const DAYS_PER_SECOND = 5;
const LIMIT = 0.3; // ppm, a common guideline for mercury in fish people eat

export function initPollution(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;

  const st = { fert: 0, sewage: false, mercury: 0 };
  let day = 0;
  let L = { N: 0.07, A: 5, D: 3.3, O: 8.2, F: 100, W: 1, hg: [0.004, 0.02, 0.1, 0.3] };
  let history: { O: Point[]; A: Point[]; F: Point[] } = { O: [], A: [], F: [] };
  let anim = 0;
  const fish = Array.from({ length: 14 }, (_, i) => ({ x: 220 + ((i * 83) % 300), y: 290 + ((i * 47) % 150), v: 20 + (i % 5) * 6, dir: i % 2 ? 1 : -1 }));

  function restart() {
    day = 0;
    L = { N: 0.07, A: 5, D: 3.3, O: 8.2, F: 100, W: 1, hg: [0.004, 0.02, 0.1, 0.3] };
    history = { O: [{ x: 0, y: L.O }], A: [{ x: 0, y: L.A / 10 }], F: [{ x: 0, y: L.F / 10 }] };
  }

  function step(dt: number) {
    anim += dt;
    const days = dt * DAYS_PER_SECOND;
    const n = Math.ceil(days / 0.1);
    const h = days / n;
    for (let i = 0; i < n; i++) {
      const input = 0.0035 + st.fert * 0.003 + (st.sewage ? 0.006 : 0);
      L.N += (input - 0.05 * L.N) * h;
      L.A = Math.max(0.5, L.A + L.A * ((0.8 * L.N) / (L.N + 0.3) - 0.1 - 0.01 * L.A) * h);
      L.D += (0.1 * L.A + (st.sewage ? 0.4 : 0) - 0.15 * L.D) * h;
      L.O = clamp(L.O + (0.5 * (9 - L.O) + 0.02 * L.A - 0.15 * L.D - 0.004 * L.F) * h, 0, 12);
      // fish: healthy above 5 mg/L, stressed 3–5, dying below 3 (fast below 2)
      const g = L.O > 5 ? 0.02 * (1 - L.F / 100) : L.O > 4 ? -0.002 : L.O > 3 ? -0.01 : L.O > 2 ? -0.06 : -0.3;
      L.F = clamp(L.F + L.F * g * h + (L.O > 5 && L.F < 2 ? 0.02 * h : 0), 0, 100);
      // mercury
      L.W += (0.02 + st.mercury * 0.05 - 0.02 * L.W) * h;
      const target = [0.004 * L.W, 0.02 * L.W, 0.1 * L.W, 0.3 * L.W];
      const tau = [5, 60, 300, 400];
      L.hg = L.hg.map((c, j) => c + ((target[j] - c) * h) / tau[j]);
      day += h;
    }
    const last = history.O[history.O.length - 1];
    if (day - last.x >= 2) {
      history.O.push({ x: day, y: L.O });
      history.A.push({ x: day, y: L.A / 10 });
      history.F.push({ x: day, y: L.F / 10 });
      for (const k of ['O', 'A', 'F'] as const) if (history[k].length > 400) history[k].shift();
    }
    for (const f of fish) {
      f.x += f.v * f.dir * dt * (L.O > 3 ? 1 : 0.3);
      if (f.x < 210 || f.x > 530) f.dir *= -1;
    }
  }

  /* ---------- Drawing (design box 1000 × 560) ---------- */
  const tf = () => {
    const k = Math.min(size.w / 1000, size.h / 560);
    return { k, ox: (size.w - 1000 * k) / 2, oy: (size.h - 560 * k) / 2 };
  };

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.roundRect(0, 0, 720, 560, 14);
    ctx.save();
    ctx.clip();
    const fs = (px: number, wt = 650) => font(px / k, wt);

    // Sky and land
    ctx.fillStyle = '#9fd0f0';
    ctx.fillRect(0, 0, 720, 230);
    ctx.fillStyle = '#6a9a48';
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.lineTo(120, 200);
    ctx.lineTo(160, 230);
    ctx.lineTo(0, 230);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(720, 170);
    ctx.lineTo(620, 210);
    ctx.lineTo(580, 230);
    ctx.lineTo(720, 230);
    ctx.fill();
    // Farm field with crop rows
    ctx.strokeStyle = '#c9b45a';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(10 + i * 18, 160 + i * 6);
      ctx.lineTo(20 + i * 18, 150 + i * 6);
      ctx.stroke();
    }
    ctx.font = fs(11, 700);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('Farmland', 10, 140);
    // Factory
    ctx.fillStyle = '#7d828a';
    ctx.fillRect(630, 120, 70, 55);
    ctx.fillRect(650, 85, 12, 35);
    ctx.fillText('Factory', 640, 110);
    // Lake water: greener and murkier as algae grow
    const g = clamp(L.A / 60, 0, 1);
    const water = ctx.createLinearGradient(0, 230, 0, 560);
    water.addColorStop(0, `rgb(${40 + g * 60}, ${120 + g * 60}, ${190 - g * 120})`);
    water.addColorStop(1, `rgb(${15 + g * 20}, ${50 + g * 30}, ${100 - g * 60})`);
    ctx.fillStyle = water;
    ctx.beginPath();
    // a lake basin: wide at the surface, sloping to a muddy bottom
    ctx.moveTo(150, 230);
    ctx.lineTo(590, 230);
    ctx.bezierCurveTo(570, 380, 530, 480, 430, 492);
    ctx.lineTo(310, 492);
    ctx.bezierCurveTo(210, 480, 170, 380, 150, 230);
    ctx.fill();
    ctx.fillStyle = '#6a5a44';
    ctx.beginPath();
    ctx.moveTo(150, 230);
    ctx.bezierCurveTo(170, 380, 210, 480, 310, 492);
    ctx.lineTo(430, 492);
    ctx.bezierCurveTo(530, 480, 570, 380, 590, 230);
    ctx.lineTo(720, 230);
    ctx.lineTo(720, 560);
    ctx.lineTo(0, 560);
    ctx.lineTo(0, 230);
    ctx.closePath();
    ctx.fill();
    // Algae scum near the surface
    const scum = Math.round(clamp(L.A, 0, 80));
    for (let i = 0; i < scum; i++) {
      ctx.fillStyle = `rgba(90, 170, 60, ${0.35 + g * 0.4})`;
      ctx.beginPath();
      ctx.arc(170 + ((i * 97) % 400), 236 + ((i * 31) % 34), 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    // Inflow from the farm and the factory pipe
    if (st.fert > 0 || st.sewage) {
      ctx.strokeStyle = st.sewage ? 'rgba(140, 110, 70, 0.9)' : 'rgba(120, 180, 90, 0.9)';
      ctx.lineWidth = 3 + st.fert;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -anim * 30;
      ctx.beginPath();
      ctx.moveTo(60, 175);
      ctx.quadraticCurveTo(120, 215, 175, 240);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#5c6066';
    ctx.fillRect(560, 205, 80, 10);
    if (st.mercury > 0) {
      ctx.fillStyle = 'rgba(160, 160, 180, 0.8)';
      for (let i = 0; i < 4; i++) {
        const t = (anim * 0.8 + i / 4) % 1;
        ctx.beginPath();
        ctx.arc(560 - t * 40, 212 + t * 30, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Fish: number follows the population; belly-up at the surface when oxygen is very low
    const alive = Math.round((fish.length * L.F) / 100);
    ctx.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    fish.forEach((f, i) => {
      if (i < alive) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(-f.dir, 1);
        ctx.fillText('🐟', 0, 0);
        ctx.restore();
      } else if (i < alive + 4 && L.O < 3) {
        ctx.save();
        ctx.translate(230 + (i % 10) * 30, 248);
        ctx.rotate(Math.PI);
        ctx.globalAlpha = 0.7;
        ctx.fillText('🐟', 0, 0);
        ctx.restore();
      }
    });
    // Heron on the shore
    ctx.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText('🦩', 120, 200);
    ctx.restore();

    // Oxygen gauge
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    const gx = 20;
    ctx.fillText('Oxygen', gx, 270);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(gx, 280, 18, 200);
    const of = clamp(L.O / 12, 0, 1);
    ctx.fillStyle = L.O > 5 ? pal.success : L.O > 3 ? pal.warning : pal.danger;
    ctx.fillRect(gx, 480 - 200 * of, 18, 200 * of);

    /* Bioaccumulation chart (x 740–990) */
    const bx = 750;
    const bw = 230;
    ctx.fillStyle = pal['sim-text'];
    ctx.font = fs(12, 750);
    ctx.fillText('Mercury in living things', bx, 92);
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('parts per million (log scale)', bx, 110);
    const levels = ['Plankton', 'Small fish', 'Large fish', 'Fish-eating bird'];
    const icons = ['🦠', '🐟', '🐠', '🦩'];
    const logX = (ppm: number) => bx + ((Math.log10(clamp(ppm, 0.001, 30)) + 3) / 4.5) * bw;
    // advisory line
    ctx.strokeStyle = pal.danger;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(logX(LIMIT), 122);
    ctx.lineTo(logX(LIMIT), 470);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pal.danger;
    ctx.fillText('Safe-to-eat limit for fish', bx, 490);
    L.hg.forEach((ppm, i) => {
      const y = 130 + i * 82;
      ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(icons[i], bx, y + 16);
      ctx.font = fs(11, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(levels[i], bx + 28, y + 6);
      ctx.fillStyle = 'rgba(128,128,128,0.25)';
      ctx.fillRect(bx, y + 24, bw, 16);
      // colour shows how far above a clean lake's natural background level each one is
      const rise = ppm / [0.004, 0.02, 0.1, 0.3][i];
      ctx.fillStyle = rise < 1.6 ? pal.success : rise < 5 ? pal.warning : pal.danger;
      ctx.fillRect(bx, y + 24, Math.max(2, logX(ppm) - bx), 16);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(ppm < 0.01 ? ppm.toFixed(4) : ppm.toFixed(2), bx + bw - 40, y + 6);
    });
    ctx.restore();
    updateReadouts();
    drawGraph();
  }

  function updateReadouts() {
    ui.readout('oxygen', `${L.O.toFixed(1)} mg/L`, L.O > 5 ? 'ok' : L.O > 3 ? 'warn' : 'bad');
    ui.readout('algae', `${L.A.toFixed(0)} µg/L${L.A > 30 ? ' (algal bloom)' : ''}`, L.A > 30 ? 'warn' : null);
    ui.readout('clarity', `${(5 / (1 + L.A / 10)).toFixed(1)} m`);
    ui.readout('fish', `${Math.round(L.F)} % of a healthy lake`, L.F > 70 ? 'ok' : L.F > 30 ? 'warn' : 'bad');
    ui.readout('hg', `${L.hg[2].toFixed(2)} ppm${L.hg[2] > LIMIT ? ' (unsafe to eat often)' : ''}`, L.hg[2] > LIMIT ? 'bad' : null);
    const years = day / 365;
    ui.readout('time', years < 1 ? `${Math.round(day)} days` : `${years.toFixed(1)} years`);
    const msg =
      L.O < 2 ? 'Fish kill: decomposing algae have used up the oxygen.' : L.O < 5 ? 'Oxygen is falling: fish are stressed.' : L.A > 30 ? 'Algal bloom: the water is turning green.' : L.hg[2] > LIMIT ? 'Mercury in large fish is above the safe-to-eat guideline.' : 'The lake is healthy.';
    statusEl.textContent = msg;
    sim.setBadge(L.O < 2 ? 'Fish kill' : L.A > 30 ? 'Algal bloom' : L.hg[2] > LIMIT ? 'Mercury warning' : 'Healthy');
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="pl-graph"]')!, {
    x: { min: 0, span: 365, format: (x) => `${Math.round(x)} d` },
    y: { min: 0, max: 12, step: 2 },
    refs: [
      { value: 5, label: 'Fish need about 5 mg/L', color: 'warning' },
      { value: 2, label: 'Fish die', color: 'danger' },
    ],
  });
  function drawGraph() {
    const x0 = history.O[0]?.x ?? 0;
    graph.opts.x = { min: x0, span: 365, max: Math.max(x0 + 365, day), format: (x) => (x < 365 * 2 ? `${Math.round(x)} d` : `${(x / 365).toFixed(1)} y`) };
    graph.set('O', { label: 'Dissolved oxygen (mg/L)', color: 'accent', points: history.O, width: 2.5 });
    graph.set('A', { label: 'Algae (×10 µg/L)', color: '#5fbf4a', points: history.A });
    graph.set('F', { label: 'Fish (×10 %)', color: '#f2a541', points: history.F });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="pl-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const fert = ui.range('pl-fert', (v) => (v === 0 ? 'None' : `${v} (of 10)`), (v) => ((st.fert = v), sim.requestRender()));
  const sew = ui.toggle('pl-sewage', (v) => ((st.sewage = v), sim.requestRender()));
  const hg = ui.range('pl-hg', (v) => (v === 0 ? 'None' : `${v} (of 10)`), (v) => ((st.mercury = v), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((b) =>
    b.addEventListener('click', () => {
      const [f, s, m] = b.dataset.scenario!.split(',').map(Number);
      fert.set(f);
      sew.set(!!s);
      hg.set(m);
      sim.play();
    }),
  );

  restart();
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { fert: 0, sewage: false, mercury: 0 });
      fert.set(0, false);
      sew.set(false, false);
      hg.set(0, false);
      restart();
    },
  });
}
