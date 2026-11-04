/**
 * Natural selection in peppered moths (Biston betularia).
 * One gene, two alleles: D (dark, carbonaria — dominant) and l (light, typica).
 *   Genotypes (Hardy–Weinberg before selection): DD = q², Dl = 2q(1 − q), ll = (1 − q)²
 *   Survival depends on camouflage: s = 1 − predation × |moth tone − bark tone|
 *   q' = (DD·s_dark + ½·Dl·s_dark) / (s_dark·(DD + Dl) + s_light·ll)
 * then symmetric mutation and random drift (binomial sampling of 2N gene copies).
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'danger', 'accent'] as const;
const TONE_DARK = 0.15;
const TONE_LIGHT = 0.88;
const DEF = { bark: 85, pred: 30, start: 2, pop: 500, mut: 0.5, speed: 4 };
const SHOWN = 70;

function binomial(n: number, p: number) {
  if (n * p * (1 - p) > 25) {
    // Normal approximation for large samples
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.min(n, Math.round(n * p + z * Math.sqrt(n * p * (1 - p)))));
  }
  let k = 0;
  for (let i = 0; i < n; i++) if (Math.random() < p) k++;
  return k;
}

export function initSelection(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  const s = { q: DEF.start / 100, gen: 0, acc: 0 };
  let pts: Point[] = [];
  let moths: { x: number; y: number; a: number; dark: boolean; eaten: number }[] = [];

  const barkTone = () => p.bark / 100;
  const survival = (tone: number) => Math.max(0.02, 1 - (p.pred / 100) * Math.abs(tone - barkTone()) * 1.25);
  const darkPheno = (q: number) => q * q + 2 * q * (1 - q);

  function restart() {
    s.q = p.start / 100;
    s.gen = 0;
    s.acc = 0;
    pts = [{ x: 0, y: darkPheno(s.q) * 100 }];
    placeMoths();
    sim?.requestRender();
  }

  function placeMoths() {
    const fracDark = darkPheno(s.q);
    moths = Array.from({ length: SHOWN }, (_, i) => ({
      x: 0.06 + Math.random() * 0.88,
      y: 0.08 + Math.random() * 0.84,
      a: (Math.random() - 0.5) * 0.8,
      dark: i < Math.round(fracDark * SHOWN),
      eaten: 0,
    }));
    // Show a few being caught, more often the conspicuous ones
    for (const m of moths) {
      const risk = 1 - survival(m.dark ? TONE_DARK : TONE_LIGHT);
      if (Math.random() < risk * 0.35) m.eaten = 1;
    }
  }

  function generation() {
    const q = s.q;
    const DD = q * q;
    const Dl = 2 * q * (1 - q);
    const ll = (1 - q) * (1 - q);
    const sd = survival(TONE_DARK);
    const sl = survival(TONE_LIGHT);
    const mean = sd * (DD + Dl) + sl * ll;
    let q2 = (DD * sd + 0.5 * Dl * sd) / mean;
    const mu = p.mut / 1000;
    q2 = q2 * (1 - mu) + (1 - q2) * mu;
    s.q = binomial(2 * p.pop, q2) / (2 * p.pop);
    s.gen++;
    pts.push({ x: s.gen, y: darkPheno(s.q) * 100 });
    if (pts.length > 2000) pts.shift();
    placeMoths();
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ns-graph"]')!, {
    x: { min: 0, span: 50, step: 25, format: (v) => `${v}` },
    y: { min: 0, max: 100, step: 25, format: (v) => `${v}%` },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="ns-graph"]')!, graph, {
    currentId: 'dark',
    label: () => `Bark ${p.bark}% light, predation ${p.pred}%, N = ${p.pop}`,
    onSave: restart,
  });

  /* ---------- Drawing ---------- */
  function drawMoth(x: number, y: number, a: number, dark: boolean, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(scale, scale);
    ctx.fillStyle = dark ? '#2b2b2b' : '#e8e2d0';
    ctx.strokeStyle = dark ? '#111' : '#a69f8a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.bezierCurveTo(-14, -12, -18, 6, -2, 6);
    ctx.lineTo(2, 6);
    ctx.bezierCurveTo(18, 6, 14, -12, 0, -3);
    ctx.fill();
    ctx.stroke();
    if (!dark) {
      ctx.fillStyle = '#6b6555';
      for (const [dx, dy] of [[-7, -1], [6, 0], [-4, 3], [9, -3], [-10, 2]]) ctx.fillRect(dx, dy, 1.6, 1.6);
    }
    ctx.fillStyle = dark ? '#000' : '#7a725e';
    ctx.fillRect(-1, -4, 2, 11);
    ctx.restore();
  }

  function render() {
    const { w, h } = size;
    // Bark: colour from soot-black to lichen-pale, with texture
    const L = barkTone();
    const base = Math.round(35 + L * 190);
    ctx.fillStyle = `rgb(${base}, ${base - 4}, ${base - 14})`;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = (i * 71) % w;
      const y = (i * 37) % h;
      ctx.strokeStyle = `rgba(${L > 0.5 ? '60,55,45' : '0,0,0'}, 0.25)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 6, y + 30, x - 6, y + 60, x + 2, y + 90);
      ctx.stroke();
      if (L > 0.45 && i % 3 === 0) {
        ctx.fillStyle = `rgba(190, 200, 170, ${(L - 0.45) * 0.9})`;
        ctx.beginPath();
        ctx.ellipse((i * 113) % w, (i * 59) % h, 14, 8, i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Moths (a sample representing the population)
    const sc = Math.max(0.8, Math.min(1.4, w / 600));
    for (const m of moths) {
      const x = m.x * w;
      const y = m.y * h;
      ctx.globalAlpha = m.eaten ? 0.35 : 1;
      drawMoth(x, y, m.a, m.dark, sc);
      ctx.globalAlpha = 1;
      if (m.eaten) {
        ctx.strokeStyle = pal.danger;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 9, y - 9);
        ctx.lineTo(x + 9, y + 9);
        ctx.moveTo(x + 9, y - 9);
        ctx.lineTo(x - 9, y + 9);
        ctx.stroke();
      }
    }
    pill(ctx, `Showing ${SHOWN} of ${p.pop} moths · ✕ = caught by a bird`, 12, 20, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size, 'left');
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(11, 600);

    // Readouts
    const dark = darkPheno(s.q);
    const sd = survival(TONE_DARK);
    const sl = survival(TONE_LIGHT);
    ui.readout('dark', `${(dark * 100).toFixed(1)}%`);
    ui.readout('allele', s.q.toFixed(3));
    ui.readout('sd', `${(sd * 100).toFixed(0)}%`, sd > sl ? 'ok' : sd < sl ? 'bad' : null);
    ui.readout('sl', `${(sl * 100).toFixed(0)}%`, sl > sd ? 'ok' : sl < sd ? 'bad' : null);
    ui.readout('gen', String(s.gen));
    ui.readout('trend', Math.abs(sd - sl) < 0.01 ? 'Neither (no selection)' : sd > sl ? 'Dark moths' : 'Light moths');
    sim.setTime(s.gen, 'gen');
    sim.setBadge(`Generation ${s.gen} · ${(dark * 100).toFixed(0)}% dark`);
    canvas.setAttribute('aria-label', `Moths on ${L > 0.6 ? 'light' : L < 0.4 ? 'dark' : 'medium'} bark. Generation ${s.gen}: ${(dark * 100).toFixed(0)} percent of moths are dark.`);

    graph.set('dark', { label: 'Current run', color: 'accent', points: pts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="ns-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const ctl = {
    bark: ui.range('ns-bark', (v) => `${v}% light`, (v) => ((p.bark = v), sim.requestRender())),
    pred: ui.range('ns-pred', (v) => `${v}%`, (v) => ((p.pred = v), sim.requestRender())),
    start: ui.range('ns-start', (v) => `${v}%`, (v) => ((p.start = v), restart())),
    pop: ui.range('ns-pop', (v) => String(v), (v) => ((p.pop = v), restart())),
    mut: ui.range('ns-mut', (v) => v.toFixed(1), (v) => (p.mut = v)),
    speed: ui.range('ns-speed', (v) => `${v}/s`, (v) => (p.speed = v)),
  };
  ui.presets('ns-bark', ctl.bark);

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const m = moths.find((q) => Math.hypot(q.x * size.w - x, q.y * size.h - y) < 16);
    if (m) {
      const sv = survival(m.dark ? TONE_DARK : TONE_LIGHT);
      sim.showTooltip(
        x,
        y,
        m.dark ? 'Dark (carbonaria) moth' : 'Light (typica) moth',
        `On this bark it has about a ${(sv * 100).toFixed(0)}% chance of surviving to breed. ${m.dark ? 'Its dark colour comes from a dominant allele.' : 'It must inherit two copies of the light allele.'}${m.eaten ? ' This one was caught by a bird.' : ''}`,
      );
    } else {
      sim.showTooltip(x, y, 'Tree bark', 'Birds hunt by sight. Moths that match the bark are harder to spot and more likely to survive and pass on their genes.');
    }
  });

  const sim = createSimController(root, {
    step: (dt) => {
      s.acc += dt * p.speed;
      while (s.acc >= 1) {
        s.acc -= 1;
        generation();
      }
      if (s.gen >= 2000) sim.pause();
    },
    render,
    autoplay: false,
    reset() {
      (Object.keys(ctl) as (keyof typeof ctl)[]).forEach((k) => ctl[k].set(DEF[k], false));
      Object.assign(p, DEF);
      restart();
    },
  });
  restart();
  comparer.refresh();
}
