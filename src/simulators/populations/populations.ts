/**
 * Predator–prey dynamics (Lotka–Volterra, with optional logistic prey growth).
 *   dH/dt = r·H·(1 − H/K) − a·H·P        (rabbits)
 *   dP/dt = b·a·H·P − m·P                (foxes)
 * b = 0.2 (fraction of eaten prey converted into new predators).
 * Populations below one animal are treated as extinct.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'sim-water', 'text-faint', 'bg-elev', 'sim-wall'] as const;
const B = 0.2;
const DEF = { h0: 400, p0: 50, r: 1, a: 0.01, m: 0.5, useK: false, K: 1500 };
const YEARS_PER_SECOND = 2;

interface Critter {
  x: number;
  y: number;
  a: number;
  kind: 'H' | 'P';
}

export function initPopulations(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  const s = { H: DEF.h0, P: DEF.p0, t: 0 };
  let hPts: Point[] = [];
  let pPts: Point[] = [];
  let phase: Point[] = [];
  let critters: Critter[] = [];

  /* ---------- Model ---------- */
  const deriv = (H: number, P: number) => {
    const growth = p.useK ? p.r * H * (1 - H / p.K) : p.r * H;
    return { dH: growth - p.a * H * P, dP: B * p.a * H * P - p.m * P };
  };
  function rk4(h: number) {
    const k1 = deriv(s.H, s.P);
    const k2 = deriv(s.H + (h / 2) * k1.dH, s.P + (h / 2) * k1.dP);
    const k3 = deriv(s.H + (h / 2) * k2.dH, s.P + (h / 2) * k2.dP);
    const k4 = deriv(s.H + h * k3.dH, s.P + h * k3.dP);
    s.H = Math.max(0, s.H + (h / 6) * (k1.dH + 2 * k2.dH + 2 * k3.dH + k4.dH));
    s.P = Math.max(0, s.P + (h / 6) * (k1.dP + 2 * k2.dP + 2 * k3.dP + k4.dP));
    if (s.H < 1) s.H = 0;
    if (s.P < 1) s.P = 0;
  }
  let sample = 0;
  function step(dt: number) {
    const years = dt * YEARS_PER_SECOND;
    const n = 20;
    for (let i = 0; i < n; i++) rk4(years / n);
    s.t += years;
    sample += years;
    if (sample >= 0.05) {
      sample = 0;
      hPts.push({ x: s.t, y: s.H });
      pPts.push({ x: s.t, y: s.P });
      phase.push({ x: s.H, y: s.P });
      if (phase.length > 1500) phase.shift();
    }
    moveCritters(dt);
    if (s.t > 200) sim.pause();
  }

  function restart() {
    s.H = p.h0;
    s.P = p.p0;
    s.t = 0;
    hPts = [{ x: 0, y: s.H }];
    pPts = [{ x: 0, y: s.P }];
    phase = [{ x: s.H, y: s.P }];
    syncCritters(true);
    sim?.requestRender();
  }

  /* ---------- Meadow animation ---------- */
  const perIcon = () => Math.max(1, Math.ceil(Math.max(s.H, s.P * 5) / 160));
  function syncCritters(rebuild = false) {
    if (rebuild) critters = [];
    const k = perIcon();
    const want = { H: Math.round(s.H / k), P: Math.round(s.P / k) };
    for (const kind of ['H', 'P'] as const) {
      let have = critters.filter((c) => c.kind === kind).length;
      while (have < want[kind]) {
        critters.push({ x: Math.random() * size.w, y: Math.random() * size.h, a: Math.random() * 6.28, kind });
        have++;
      }
      while (have > want[kind]) {
        const i = critters.findIndex((c) => c.kind === kind);
        critters.splice(i, 1);
        have--;
      }
    }
  }
  function moveCritters(dt: number) {
    syncCritters();
    for (const c of critters) {
      c.a += (Math.random() - 0.5) * 1.5;
      const sp = c.kind === 'P' ? 45 : 30;
      c.x += Math.cos(c.a) * sp * dt;
      c.y += Math.sin(c.a) * sp * dt;
      if (c.x < 8 || c.x > size.w - 8) (c.a = Math.PI - c.a), (c.x = Math.min(size.w - 8, Math.max(8, c.x)));
      if (c.y < 8 || c.y > size.h - 8) (c.a = -c.a), (c.y = Math.min(size.h - 8, Math.max(8, c.y)));
    }
  }

  /* ---------- Graphs ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="pop-graph"]')!, {
    x: { min: 0, span: 30, step: 10, format: (v) => `${v} yr` },
    y: { min: 0, max: 1000, step: 250 },
  });
  const phaseGraph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="pop-phase"]')!, {
    x: { min: 0, span: 1000, max: 1000, format: (v) => `${v}` },
    y: { min: 0, max: 200, step: 50 },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="pop-graph"]')!, graph, {
    currentId: 'H',
    label: () => `Rabbits: r ${p.r}, hunting ${p.a}, fox death ${p.m}${p.useK ? `, K ${p.K}` : ''}`,
    onSave: restart,
  });
  const niceMax = (v: number) => {
    const m = 10 ** Math.floor(Math.log10(Math.max(v, 10)));
    return Math.ceil(v / m) * m;
  };

  /* ---------- Drawing ---------- */
  function status(): { label: string; tone: 'ok' | 'warn' | 'bad' } {
    if (s.H === 0 && s.P === 0) return { label: 'Both species extinct', tone: 'bad' };
    if (s.P === 0) return { label: p.useK ? 'Foxes extinct — rabbits level off' : 'Foxes extinct — rabbits boom', tone: 'bad' };
    if (s.H === 0) return { label: 'Rabbits extinct — foxes starving', tone: 'bad' };
    const recent = hPts.slice(-60);
    if (recent.length > 40) {
      const ys = recent.map((q) => q.y);
      const spread = (Math.max(...ys) - Math.min(...ys)) / (Math.max(...ys) || 1);
      if (spread < 0.03) return { label: 'Stable balance', tone: 'ok' };
    }
    return { label: 'Populations cycling', tone: 'warn' };
  }

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    // Meadow texture
    ctx.fillStyle = pal['sim-wall'];
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = pal['sim-wall'];
    for (let i = 0; i < 60; i++) {
      const gx = (i * 97) % w;
      const gy = (i * 53) % h;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 3, gy - 8);
      ctx.moveTo(gx + 4, gy);
      ctx.lineTo(gx + 6, gy - 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const c of critters) {
      if (c.kind === 'H') {
        ctx.fillStyle = pal['sim-water'];
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x - 2, c.y - 6, 1.4, 3.5, -0.2, 0, Math.PI * 2);
        ctx.ellipse(c.x + 2, c.y - 6, 1.4, 3.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = pal['sim-solute'];
        ctx.beginPath();
        ctx.moveTo(c.x - 8, c.y + 5);
        ctx.lineTo(c.x + 8, c.y + 5);
        ctx.lineTo(c.x + 4, c.y - 4);
        ctx.lineTo(c.x + 6, c.y - 9);
        ctx.lineTo(c.x + 1, c.y - 5);
        ctx.lineTo(c.x - 3, c.y - 9);
        ctx.lineTo(c.x - 4, c.y - 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(11, 600);
    ctx.fillText(`Each icon = ${perIcon()} animal${perIcon() > 1 ? 's' : ''}`, 12, 20);

    // Readouts
    const st = status();
    const Hstar = p.m / (B * p.a);
    const Pstar = (p.r / p.a) * (p.useK ? 1 - Hstar / p.K : 1);
    ui.readout('status', st.label, st.tone);
    ui.readout('h', Math.round(s.H).toLocaleString());
    ui.readout('p', Math.round(s.P).toLocaleString());
    ui.readout('eq', Pstar > 0 ? `${Math.round(Hstar)} rabbits, ${Math.round(Pstar)} foxes` : 'Foxes cannot survive');
    sim.setTime(s.t, 'years');
    sim.setBadge(`Year ${Math.floor(s.t)} · ${st.label}`);
    canvas.setAttribute('aria-label', `Year ${s.t.toFixed(0)}: ${Math.round(s.H)} rabbits and ${Math.round(s.P)} foxes. ${st.label}.`);

    // Graphs
    const ymax = niceMax(Math.max(200, ...hPts.map((q) => q.y), ...pPts.map((q) => q.y)) * 1.05);
    graph.opts.y = { min: 0, max: ymax, step: ymax / 4, format: (v) => `${Math.round(v)}` };
    graph.set('H', { label: 'Rabbits', color: 'sim-water', points: hPts });
    graph.set('P', { label: 'Foxes', color: 'sim-solute', points: pPts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="pop-graph"]'));
    const hx = niceMax(Math.max(200, ...phase.map((q) => q.x)) * 1.05);
    const py = niceMax(Math.max(50, ...phase.map((q) => q.y)) * 1.05);
    phaseGraph.opts.x = { min: 0, span: hx, max: hx, format: (v) => `${Math.round(v)}` };
    phaseGraph.opts.y = { min: 0, max: py, step: py / 4, format: (v) => `${Math.round(v)}` };
    phaseGraph.opts.refs = Pstar > 0 ? [{ value: Hstar, label: 'balance', color: 'text-faint', axis: 'x' }] : [];
    phaseGraph.set('ph', { label: 'Path', color: 'accent', points: phase, legend: false });
    phaseGraph.set('now', { label: 'Now', color: 'sim-solute', points: [{ x: s.H, y: s.P }], type: 'points', legend: false });
    phaseGraph.draw();
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const ctl = {
    h0: ui.range('pop-h0', (v) => String(v), (v) => ((p.h0 = v), restart())),
    p0: ui.range('pop-p0', (v) => String(v), (v) => ((p.p0 = v), restart())),
    r: ui.range('pop-r', (v) => `${v.toFixed(1)} /yr`, (v) => ((p.r = v), sim.requestRender())),
    a: ui.range('pop-a', (v) => v.toFixed(3), (v) => ((p.a = v), sim.requestRender())),
    m: ui.range('pop-m', (v) => `${v.toFixed(1)} /yr`, (v) => ((p.m = v), sim.requestRender())),
    K: ui.range('pop-kval', (v) => String(v), (v) => ((p.K = v), sim.requestRender())),
  };
  const kCtl = ui.toggle('pop-k', (v) => ((p.useK = v), sim.requestRender()));

  root.querySelectorAll<HTMLButtonElement>('[data-event]').forEach((b) =>
    b.addEventListener('click', () => {
      const e = b.dataset.event;
      if (e === 'disease') s.H = Math.floor(s.H * 0.5);
      if (e === 'hunt') s.P = Math.floor(s.P * 0.5);
      if (e === 'foxes') s.P += 20;
      sim.announce(e === 'disease' ? 'Disease halved the rabbit population.' : e === 'hunt' ? 'Hunting halved the fox population.' : '20 foxes were introduced.');
      syncCritters();
      sim.requestRender();
    }),
  );

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const c = critters.find((q) => Math.hypot(q.x - x, q.y - y) < 12);
    if (c?.kind === 'P') sim.showTooltip(x, y, 'Fox (predator)', 'Foxes need to eat rabbits to survive and breed. When rabbits are scarce, foxes starve and their numbers fall.');
    else if (c) sim.showTooltip(x, y, 'Rabbit (prey)', 'Rabbits breed quickly when there are few foxes. More foxes means more rabbits get eaten.');
    else sim.showTooltip(x, y, 'Meadow', 'Each icon stands for several animals. The graphs below show the exact numbers.');
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      (Object.keys(ctl) as (keyof typeof ctl)[]).forEach((k) => ctl[k].set(DEF[k] as number, false));
      kCtl.set(false, false);
      Object.assign(p, DEF);
      restart();
    },
  });
  restart();
  comparer.refresh();
}
