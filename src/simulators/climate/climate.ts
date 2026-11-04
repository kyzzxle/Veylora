/**
 * Simplified climate model: a two-layer energy-balance model
 * (upper ocean + atmosphere, and deep ocean).
 *   C  dT/dt  = F − λT − γ(T − T_D)
 *   C_D dT_D/dt = γ(T − T_D)
 * CO₂ radiative forcing (Myhre et al., 1998): F = 5.35 · ln(CO₂ / CO₂₁₈₅₀)  W/m²
 * λ = F₂ₓ / ECS with F₂ₓ = 5.35·ln 2 ≈ 3.71 W/m².
 * C = 8, C_D = 100 W·yr·m⁻²·K⁻¹ and γ = 0.7 W·m⁻²·K⁻¹ are typical values used in the literature.
 * Only CO₂ is included; other gases and aerosols roughly offset each other historically.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, pill } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'bg-elev', 'border-strong', 'warning', 'danger', 'sim-water', 'sim-wall'] as const;
const C0 = 285;
const F2X = 5.35 * Math.log(2);
const C_UP = 8;
const C_DEEP = 100;
const GAMMA = 0.7;
const Y0 = 1850;
const Y1 = 2200;

// Approximate annual mean CO₂ (ppm), from ice cores and Mauna Loa / NOAA records
const HISTORY: [number, number][] = [
  [1850, 285], [1870, 289], [1890, 294], [1910, 300], [1930, 307], [1950, 311], [1960, 317],
  [1970, 326], [1980, 339], [1990, 354], [2000, 369], [2010, 389], [2020, 414], [2024, 424],
];
type Scenario = 'current' | 'high' | 'hold' | 'netzero' | 'custom';

function co2At(year: number, sc: Scenario, target: number) {
  if (year <= 2024) {
    for (let i = 0; i < HISTORY.length - 1; i++) {
      const [y0, c0] = HISTORY[i];
      const [y1, c1] = HISTORY[i + 1];
      if (year <= y1) return c0 + ((c1 - c0) * (year - y0)) / (y1 - y0);
    }
  }
  const y = Math.min(year, 2100) - 2024;
  switch (sc) {
    case 'current':
      return 424 + 2.5 * y;
    case 'high':
      return 424 + 3.32 * y + 0.0733 * y * y; // ≈ 560 ppm in 2050, ≈ 1,100 ppm in 2100
    case 'hold':
      return 424;
    case 'netzero': {
      if (y <= 16) return 424 + 21 * (1 - (1 - y / 16) ** 2); // peaks near 445 ppm around 2040
      return 445 - 45 * ((y - 16) / 60); // slowly falls to ~400 ppm by 2100 as sinks absorb CO₂
    }
    case 'custom':
      return 424 + ((target - 424) * y) / 76;
  }
}

export function initClimate(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const scenarioSel = root.querySelector<HTMLSelectElement>('[data-scenario]')!;

  const p = { sc: 'current' as Scenario, target: 600, ecs: 3, year: 1850 };
  let series: { year: number; co2: number; F: number; T: number; Teq: number }[] = [];

  /* ---------- Model run (whole period, recomputed when settings change) ---------- */
  function run() {
    const lambda = F2X / p.ecs;
    let T = 0;
    let TD = 0;
    const dt = 0.1;
    series = [];
    for (let year = Y0; year <= Y1 + 1e-9; year += dt) {
      const co2 = co2At(year, p.sc, p.target);
      const F = 5.35 * Math.log(co2 / C0);
      if (Math.abs(year - Math.round(year)) < dt / 2) series.push({ year: Math.round(year), co2, F, T, Teq: F / lambda });
      const dT = (F - lambda * T - GAMMA * (T - TD)) / C_UP;
      const dTD = (GAMMA * (T - TD)) / C_DEEP;
      T += dT * dt;
      TD += dTD * dt;
    }
  }
  const at = (year: number) => series[Math.max(0, Math.min(series.length - 1, Math.round(year) - Y0))];

  /* ---------- Graphs ---------- */
  const co2Graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="cl-co2"]')!, {
    x: { min: Y0, span: Y1 - Y0, max: Y1, format: (v) => `${v}` },
    y: { min: 200, max: 1200, step: 200 },
    refs: [{ value: 2024, label: 'today', color: 'text-faint', axis: 'x' }],
  });
  const tGraph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="cl-temp"]')!, {
    x: { min: Y0, span: Y1 - Y0, max: Y1, format: (v) => `${v}` },
    y: { min: 0, max: 6, step: 1, format: (v) => `${v}°` },
    refs: [
      { value: 1.5, label: '1.5 °C', color: 'warning' },
      { value: 2, label: '2 °C', color: 'danger' },
      { value: 2024, label: 'today', color: 'text-faint', axis: 'x' },
    ],
  });

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    const now = at(p.year);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Space, atmosphere and Earth
    const groundY = h * 0.78;
    const atmTop = h * 0.3;
    ctx.fillStyle = pal['sim-water'];
    ctx.globalAlpha = 0.08 + Math.min(0.25, (now.co2 - 280) / 3000);
    ctx.fillRect(0, atmTop, w, groundY - atmTop);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-wall'];
    ctx.beginPath();
    ctx.moveTo(0, groundY + 20);
    ctx.quadraticCurveTo(w / 2, groundY - 25, w, groundY + 20);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // CO₂ molecules in proportion to concentration
    const n = Math.round(now.co2 / 12);
    for (let i = 0; i < n; i++) {
      const x = ((i * 53) % Math.max(1, w - 140)) + 20; // spread deterministically
      const y = atmTop + 14 + ((i * 97) % Math.max(1, groundY - atmTop - 44));
      ctx.fillStyle = pal['text-faint'];
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.danger;
      ctx.beginPath();
      ctx.arc(x - 5, y, 2.2, 0, Math.PI * 2);
      ctx.arc(x + 5, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sunlight in, heat out, heat trapped (scaled to the extra forcing)
    for (let i = 0; i < 4; i++) {
      const x = w * 0.12 + i * 40;
      arrow(ctx, x, 20, x + 30, groundY - 18, pal.warning, 3);
    }
    const back = Math.min(6, Math.round(now.F * 1.2));
    for (let i = 0; i < 5; i++) {
      const x = w * 0.45 + i * 34;
      const escapes = i >= back - 1;
      arrow(ctx, x, groundY - 14, x + 8, escapes ? 18 : atmTop + 18, pal.danger, 2.5);
      if (!escapes) arrow(ctx, x + 8, atmTop + 22, x + 16, groundY - 20, pal.danger, 1.5, 7);
    }
    const lbl = { bg: pal['bg-elev'], fg: pal['sim-text'] };
    pill(ctx, 'Sunlight (visible)', w * 0.18, 18, lbl, size);
    pill(ctx, 'Heat (infrared) radiated by Earth', w * 0.56, atmTop - 12, lbl, size);
    pill(ctx, `Atmosphere: ${Math.round(now.co2)} ppm CO₂`, w * 0.3, groundY - 40, lbl, size);

    // Thermometer
    const tx = w - 56;
    const ty0 = 70; // below the corner badge
    const ty1 = groundY - 30;
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tx - 10, ty0, 20, ty1 - ty0, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty1 + 12, 16, 0, Math.PI * 2);
    ctx.fillStyle = pal.danger;
    ctx.fill();
    const frac = Math.min(1, now.T / 6);
    ctx.fillRect(tx - 5, ty1 - (ty1 - ty0 - 8) * frac, 10, (ty1 - ty0 - 8) * frac + 6);
    ctx.font = font(10, 600, 'mono');
    ctx.fillStyle = pal['text-faint'];
    for (let d = 0; d <= 6; d += 1) ctx.fillText(`${d}°`, tx - 38, ty1 - ((ty1 - ty0 - 8) * d) / 6 + 4);
    pill(ctx, `+${now.T.toFixed(2)} °C`, tx - 10, ty0 - 16, lbl, size);

    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(28, 700);
    ctx.fillText(String(now.year), 18, h - 22);

    // Readouts
    const eq = now.Teq;
    ui.readout('co2', `${Math.round(now.co2)} ppm`);
    ui.readout('warming', `+${now.T.toFixed(2)} °C`, now.T >= 2 ? 'bad' : now.T >= 1.5 ? 'warn' : null);
    ui.readout('forcing', `${now.F.toFixed(2)} W/m²`);
    ui.readout('eq', `+${eq.toFixed(1)} °C`);
    ui.readout('paris', now.T >= 2 ? 'Above 2 °C' : now.T >= 1.5 ? 'Above 1.5 °C' : 'Below 1.5 °C', now.T >= 2 ? 'bad' : now.T >= 1.5 ? 'warn' : 'ok');
    ui.readout('lag', eq - now.T > 0.05 ? `+${(eq - now.T).toFixed(1)} °C (ocean lag)` : '—');
    sim.setBadge(`${now.year} · ${Math.round(now.co2)} ppm`);
    canvas.setAttribute('aria-label', `Year ${now.year}. Carbon dioxide ${Math.round(now.co2)} parts per million. Modelled warming ${now.T.toFixed(1)} degrees Celsius since 1850.`);

    // Graphs: full projection faint, travelled part solid
    const upto = series.filter((q) => q.year <= p.year);
    const full = (k: 'co2' | 'T'): Point[] => series.map((q) => ({ x: q.year, y: q[k] }));
    const part = (k: 'co2' | 'T'): Point[] => upto.map((q) => ({ x: q.year, y: q[k] }));
    const maxC = Math.max(...series.map((q) => q.co2));
    co2Graph.opts.y = { min: 200, max: Math.max(600, Math.ceil(maxC / 200) * 200), step: 200 };
    co2Graph.set('full', { label: 'Scenario', color: 'text-faint', points: full('co2'), dash: [5, 5], width: 1.5, legend: false });
    co2Graph.set('now', { label: 'CO₂', color: 'accent', points: part('co2'), legend: false });
    co2Graph.draw();
    const maxT = Math.max(...series.map((q) => q.T));
    tGraph.opts.y = { min: 0, max: Math.max(3, Math.ceil(maxT + 0.5)), step: 1, format: (v) => `${v}°` };
    tGraph.set('full', { label: 'Projection', color: 'text-faint', points: full('T'), dash: [5, 5], width: 1.5, legend: false });
    tGraph.set('now', { label: 'Warming', color: 'danger', points: part('T'), legend: false });
    tGraph.draw();
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const recompute = () => {
    run();
    sim.requestRender();
  };
  const yearCtl = ui.range('cl-year', (v) => String(v), (v) => ((p.year = v), sim.requestRender()));
  const ecsCtl = ui.range('cl-ecs', (v) => `${v.toFixed(1)} °C`, (v) => ((p.ecs = v), recompute()));
  const targetCtl = ui.range('cl-target', (v) => `${v} ppm`, (v) => ((p.target = v), recompute()));
  scenarioSel.addEventListener('change', () => {
    p.sc = scenarioSel.value as Scenario;
    root.querySelector<HTMLElement>('[data-custom]')!.hidden = p.sc !== 'custom';
    recompute();
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const h = size.h;
    if (x > size.w - 90) sim.showTooltip(x, y, 'Global temperature', 'Average warming of Earth’s surface since 1850 in this model. Observed warming had reached about 1.3 °C by the early 2020s.');
    else if (y < h * 0.3) sim.showTooltip(x, y, 'Sunlight', 'Most sunlight passes straight through the atmosphere and warms the surface. Adding CO₂ barely changes incoming sunlight.');
    else if (y < h * 0.78) sim.showTooltip(x, y, 'Greenhouse gases', 'CO₂ molecules absorb infrared heat from the surface and re-emit some of it back down. More CO₂ means less heat escapes to space until Earth warms enough to restore the balance.');
    else sim.showTooltip(x, y, 'Earth’s surface and oceans', 'Oceans absorb most of the extra heat. Their huge heat capacity makes warming lag decades behind rising CO₂.');
  });

  const sim = createSimController(root, {
    step: (dt) => {
      p.year = Math.min(Y1, p.year + dt * 25);
      yearCtl.set(Math.round(p.year), false);
      if (p.year >= Y1) sim.pause();
    },
    render,
    autoplay: false,
    onPlayChange: (on) => {
      if (on && p.year >= Y1) p.year = Y0;
    },
    reset() {
      scenarioSel.value = 'current';
      root.querySelector<HTMLElement>('[data-custom]')!.hidden = true;
      Object.assign(p, { sc: 'current', target: 600, ecs: 3, year: 1850 });
      yearCtl.set(1850, false);
      ecsCtl.set(3, false);
      targetCtl.set(600, false);
      run();
    },
  });
  run();
  sim.requestRender();
}
