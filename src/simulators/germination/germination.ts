/**
 * Seed germination experiment.
 * Germination needs water (imbibition), oxygen (aerobic respiration) and a
 * suitable temperature. Germination speed follows a thermal-time model:
 * development rate rises linearly from a base temperature to an optimum and
 * falls to zero at a maximum. Lettuce (cv. Grand Rapids, a classic test seed)
 * needs light and becomes dormant in warm conditions; beans germinate in light or dark.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'sim-water', 'sim-wall', 'danger', 'accent'] as const;
type SeedType = 'bean' | 'lettuce';
const SEED = {
  bean: { base: 8, opt: 28, max: 40, days: 2.5, needsLight: false, colour: '#c9a46a', size: 1.25 },
  lettuce: { base: 3, opt: 22, max: 30, days: 1.5, needsLight: true, colour: '#9a8a5a', size: 0.75 },
};
const N = 20;
const DAYS = 14;
const DEF = { seed: 'bean' as SeedType, water: 'moist', T: 22, oxygen: 'air', light: 'light' };

interface Seed {
  x: number;
  y: number;
  a: number;
  viable: boolean;
  tGerm: number; // day of germination (Infinity if it will not)
}

export function initGermination(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  let day = 0;
  let seeds: Seed[] = [];
  let pts: Point[] = [{ x: 0, y: 0 }];

  /** Relative development rate (0–1) at temperature T. */
  function rate(T: number) {
    const s = SEED[p.seed];
    if (T <= s.base || T >= s.max) return 0;
    if (T <= s.opt) return (T - s.base) / (s.opt - s.base);
    return (s.max - T) / (s.max - s.opt);
  }
  function verdict(): { ok: boolean; text: string } {
    if (p.water === 'dry') return { ok: false, text: 'No water — seeds cannot take up water and stay dormant' };
    if (p.water === 'flooded') return { ok: false, text: 'Flooded — the water cuts off oxygen' };
    if (p.oxygen === 'none') return { ok: false, text: 'No oxygen — seeds cannot respire' };
    const r = rate(p.T);
    if (r === 0) return { ok: false, text: p.T >= SEED[p.seed].max ? 'Too hot' : 'Too cold' };
    if (SEED[p.seed].needsLight && p.light === 'dark') return { ok: true, text: 'Lettuce seeds mostly need light — few will germinate in the dark' };
    return { ok: true, text: r > 0.7 ? 'Good conditions' : 'Possible, but slow at this temperature' };
  }

  function sow() {
    const s = SEED[p.seed];
    const r = rate(p.T);
    const v = verdict();
    seeds = Array.from({ length: N }, (_, i) => {
      const ring = i < 8 ? 0.35 : 0.72;
      const k = i < 8 ? i / 8 : (i - 8) / 12;
      const ang = k * Math.PI * 2 + (i < 8 ? 0.4 : 0);
      const viable = Math.random() < 0.92;
      let tGerm = Infinity;
      if (viable && v.ok && r > 0) {
        const lightOk = !s.needsLight || p.light === 'light' || Math.random() < 0.1;
        if (lightOk) tGerm = (s.days / r) * Math.exp((Math.random() + Math.random() - 1) * 0.35);
      }
      return { x: Math.cos(ang) * ring, y: Math.sin(ang) * ring, a: Math.random() * Math.PI, viable, tGerm };
    });
    day = 0;
    pts = [{ x: 0, y: 0 }];
    sim?.requestRender();
  }

  const germinated = () => seeds.filter((s) => s.tGerm <= day).length;

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="gm-graph"]')!, {
    x: { min: 0, span: DAYS, max: DAYS, format: (v) => `day ${v}` },
    y: { min: 0, max: 100, step: 25, format: (v) => `${v}%` },
  });
  const label = () => `${p.seed}, ${p.water}, ${p.T} °C, ${p.oxygen === 'air' ? 'air' : 'no O₂'}, ${p.light}`;
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="gm-graph"]')!, graph, { currentId: 'cur', label, onSave: sow });

  /* ---------- Drawing ---------- */
  function drawSeed(sd: Seed, cx: number, cy: number, R: number) {
    const sType = SEED[p.seed];
    const x = cx + sd.x * R;
    const y = cy + sd.y * R;
    const wet = p.water !== 'dry';
    const swell = wet ? Math.min(1, day / 0.6) : 0; // imbibition: seeds swell as they absorb water
    const sz = (6 + swell * 2.5) * sType.size;
    const since = day - sd.tGerm;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sd.a);
    // Root and shoot after germination
    if (since > 0) {
      const g = rate(p.T);
      const rootLen = Math.min(R * 0.45, since * 9 * (0.4 + g) * sType.size);
      ctx.strokeStyle = '#efe6d2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sz * 0.6, 0);
      ctx.quadraticCurveTo(sz + rootLen * 0.5, rootLen * 0.2, sz + rootLen, rootLen * 0.35);
      ctx.stroke();
      if (since > 1.5) {
        const shoot = Math.min(R * 0.3, (since - 1.5) * 7 * (0.4 + g) * sType.size);
        ctx.strokeStyle = pal['sim-wall'];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.4, 0);
        ctx.lineTo(-sz * 0.4 - shoot, -shoot * 0.3);
        ctx.stroke();
        ctx.fillStyle = pal['sim-wall'];
        ctx.beginPath();
        ctx.ellipse(-sz * 0.4 - shoot - 3, -shoot * 0.3 - 3, 4, 2.5, 0.6, 0, Math.PI * 2);
        ctx.ellipse(-sz * 0.4 - shoot - 3, -shoot * 0.3 + 3, 4, 2.5, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const rotting = (p.water === 'flooded' || p.oxygen === 'none') && day > 6;
    ctx.fillStyle = rotting ? '#5d5a4a' : sType.colour;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, sz, sz * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.52;
    const R = Math.min(w, h) * 0.4;
    // Dish
    ctx.fillStyle = p.water === 'flooded' ? 'rgba(90,150,230,0.35)' : p.water === 'moist' ? 'rgba(235,235,225,0.9)' : 'rgba(245,240,225,0.6)';
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (p.water === 'moist') {
      ctx.fillStyle = 'rgba(90,150,230,0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const sd of seeds) drawSeed(sd, cx, cy, R * 0.92);
    // Darkness overlay
    if (p.light === 'dark') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, w, h);
    }
    const lbl = { bg: pal['bg-elev'], fg: pal['sim-text'] };
    pill(ctx, `${p.T} °C · ${p.water} · ${p.oxygen === 'air' ? 'air' : 'no oxygen'} · ${p.light}`, cx, 18, lbl, size);
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(11, 600);
    ctx.fillText(`Day ${day.toFixed(1)}`, 14, h - 14);

    const g = germinated();
    const times = seeds.filter((s) => s.tGerm <= day).map((s) => s.tGerm);
    const v = verdict();
    ui.readout('pct', `${Math.round((g / N) * 100)}% (${g} of ${N})`);
    ui.readout('day', day.toFixed(1));
    ui.readout('mean', times.length ? `${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} days` : '—');
    ui.readout('verdict', v.text, v.ok ? (v.text.startsWith('Good') ? 'ok' : 'warn') : 'bad');
    sim.setTime(day, 'days');
    sim.setBadge(`Day ${Math.floor(day)} · ${g} germinated`);
    canvas.setAttribute('aria-label', `Petri dish of ${p.seed} seeds on day ${day.toFixed(0)}: ${g} of ${N} have germinated. Conditions: ${v.text}.`);

    graph.set('cur', { label: 'Current conditions', color: 'accent', points: pts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="gm-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const ch = <K extends keyof typeof p>(k: K) => (v: (typeof p)[K]) => {
    p[k] = v;
    sow();
  };
  const seedCtl = ui.choice<SeedType>('gm-seed', ch('seed'));
  const waterCtl = ui.choice<string>('gm-water', ch('water'));
  const tCtl = ui.range('gm-temp', (v) => `${v} °C`, ch('T'));
  const oxCtl = ui.choice<string>('gm-oxygen', ch('oxygen'));
  const lightCtl = ui.choice<string>('gm-light', ch('light'));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const R = Math.min(size.w, size.h) * 0.4 * 0.92;
    const sd = seeds.find((q) => Math.hypot(size.w * 0.5 + q.x * R - x, size.h * 0.52 + q.y * R - y) < 14);
    if (!sd) return;
    const since = day - sd.tGerm;
    const stage = !sd.viable
      ? 'This seed is not viable — the embryo inside has died, so it will never germinate.'
      : since > 1.5
        ? 'Seedling: the root anchors it and the shoot is growing toward the light.'
        : since > 0
          ? 'Germinated: the radicle (embryonic root) has broken through the seed coat.'
          : p.water === 'dry'
            ? 'Dormant: without water the seed cannot become active.'
            : 'Imbibing: the seed is absorbing water and swelling, activating its enzymes.';
    sim.showTooltip(x, y, 'Seed', stage);
  });

  const sim = createSimController(root, {
    step: (dt) => {
      day = Math.min(DAYS, day + dt / 1.2);
      const last = pts[pts.length - 1];
      if (day - last.x >= 0.1) pts.push({ x: day, y: (germinated() / N) * 100 });
      if (day >= DAYS) sim.pause();
    },
    render,
    autoplay: false,
    onPlayChange: (on) => {
      if (on && day >= DAYS) sow();
    },
    reset() {
      seedCtl.set('bean', false);
      waterCtl.set('moist', false);
      tCtl.set(22, false);
      oxCtl.set('air', false);
      lightCtl.set('light', false);
      Object.assign(p, DEF);
      sow();
    },
  });
  sow();
  comparer.refresh();
}
