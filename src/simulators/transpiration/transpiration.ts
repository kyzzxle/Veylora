/**
 * Transpiration measured with a bubble potometer.
 * Model (simplified, but with physically meaningful parts):
 *   Saturation vapour pressure (Tetens):  e_s(T) = 0.6108 · exp(17.27·T / (T + 237.3))  kPa
 *   Vapour pressure deficit:              VPD = e_s(T) · (1 − RH)
 *   Stomatal conductance:  g_s = light/(light + 15) × temperature factor × VPD-closure factor × coating factor
 *   Boundary-layer conductance (wind):    g_b = 0.6 + 1.2·√wind
 *   Combined conductance:  g = g_s·g_b / (g_s + g_b)   (two resistances in series)
 *   Transpiration rate     E ∝ g · VPD
 * The rate is scaled to millimetres of bubble movement per minute in a typical potometer.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { createDataTable } from '../shared/datatable';
import { arrow, font, pill } from '../shared/draw';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'sim-water', 'sim-wall', 'sim-membrane', 'warning', 'accent'] as const;
type Coat = 'none' | 'upper' | 'lower' | 'both';
const COAT_FACTOR: Record<Coat, number> = { none: 1, upper: 0.85, lower: 0.18, both: 0.04 };
const COAT_NAME: Record<Coat, string> = { none: 'None', upper: 'Upper', lower: 'Lower', both: 'Both' };
const DEF = { light: 60, temp: 22, hum: 50, wind: 1, coat: 'none' as Coat };
const SCALE = 1.9; // converts model units to mm/min
const MIN_PER_SECOND = 1;

type Row = { light: number; temp: number; hum: number; wind: number; coat: string; rate: number };

export function initTranspiration(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const coatSel = root.querySelector<HTMLSelectElement>('[data-coat]')!;

  const p = { ...DEF };
  const s = { dist: 0, t: 0, anim: 0 };
  let pts: Point[] = [{ x: 0, y: 0 }];
  let vapour: { x: number; y: number; life: number }[] = [];

  /* ---------- Model ---------- */
  const es = (T: number) => 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
  const vpd = () => es(p.temp) * (1 - p.hum / 100);
  function model() {
    const lightF = p.light / (p.light + 15); // stomata open in light, close in the dark
    const tempF = p.temp < 5 ? 0.2 : p.temp > 35 ? Math.max(0.3, 1 - (p.temp - 35) * 0.1) : 1;
    const closeF = 1 / (1 + (vpd() / 3.2) ** 3); // stomata partly close in very dry air
    const gs = lightF * tempF * closeF * COAT_FACTOR[p.coat] + 0.02 * (p.coat === 'both' ? 0.3 : 1); // + cuticle
    const gb = 0.6 + 1.2 * Math.sqrt(p.wind);
    const g = (gs * gb) / (gs + gb);
    const rate = g * vpd() * SCALE;
    const factors = [
      { name: 'Light (stomata closing)', v: lightF },
      { name: 'Humid air', v: Math.min(1, vpd() / 1.6) },
      { name: 'Still air around the leaf (try more wind)', v: gb / (gb + gs) },
      { name: 'Leaf coating', v: COAT_FACTOR[p.coat] },
      { name: 'Stomata closing in dry air', v: closeF },
    ];
    const limit = factors.reduce((a, b) => (b.v < a.v ? b : a));
    return { rate, open: lightF * tempF * closeF, limit: limit.v > 0.8 ? 'None — conditions favour fast transpiration' : limit.name };
  }

  /* ---------- Graph & table ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="tr-graph"]')!, {
    x: { min: 0, span: 30, step: 10, format: (v) => `${v} min` },
    y: { min: 0, max: 100, step: 25, format: (v) => `${v}` },
  });
  const resetBubble = () => {
    s.dist = 0;
    s.t = 0;
    pts = [{ x: 0, y: 0 }];
    sim?.requestRender();
  };
  const label = () => `Light ${p.light}%, ${p.temp} °C, RH ${p.hum}%, wind ${p.wind} m/s, coat ${COAT_NAME[p.coat]}`;
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="tr-graph"]')!, graph, { currentId: 'cur', label, onSave: resetBubble });
  const table = createDataTable<Row>(
    root,
    'tr-table',
    [
      { key: 'light', label: 'Light (%)' },
      { key: 'temp', label: 'Temp (°C)' },
      { key: 'hum', label: 'Humidity (%)' },
      { key: 'wind', label: 'Wind (m/s)' },
      { key: 'coat', label: 'Coating' },
      { key: 'rate', label: 'Rate (mm/min)', format: (v) => Number(v).toFixed(2) },
    ],
    {
      filename: 'transpiration-results.csv',
      onRecord: () => {
        // A real reading has a little measurement error
        const r = model().rate * (1 + (Math.random() - 0.5) * 0.06);
        sim.announce(`Recorded ${r.toFixed(2)} millimetres per minute.`);
        return { light: p.light, temp: p.temp, hum: p.hum, wind: p.wind, coat: COAT_NAME[p.coat], rate: r };
      },
    },
  );

  /* ---------- Drawing ---------- */
  let geo = { plantX: 0, leafCX: 0, leafCY: 0, leafR: 0, tubeY: 0, tubeX0: 0, tubeX1: 0 };
  function render() {
    const { w, h } = size;
    const m = model();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Sun / light
    const sunA = p.light / 100;
    ctx.fillStyle = pal.warning;
    ctx.globalAlpha = 0.15 + sunA * 0.85;
    ctx.beginPath();
    ctx.arc(34, 34, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (p.light === 0) pill(ctx, 'Dark', 34, 64, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Potometer: capillary tube with scale and bubble
    const tubeY = h * 0.86;
    const tubeX0 = 40;
    const tubeX1 = w * 0.55;
    geo = { ...geo, tubeY, tubeX0, tubeX1 };
    ctx.fillStyle = 'rgba(120,170,255,0.25)';
    ctx.fillRect(tubeX0, tubeY - 6, tubeX1 - tubeX0, 12);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tubeX0, tubeY - 6, tubeX1 - tubeX0, 12);
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(9, 500, 'mono');
    for (let mm = 0; mm <= 100; mm += 10) {
      const x = tubeX0 + ((tubeX1 - tubeX0 - 10) * mm) / 100;
      ctx.fillRect(x, tubeY + 7, 1, mm % 50 === 0 ? 8 : 4);
      if (mm % 20 === 0) ctx.fillText(`${mm}`, x - 6, tubeY + 24);
    }
    ctx.fillText('mm', tubeX0 - 26, tubeY + 4);
    const bx = tubeX0 + ((tubeX1 - tubeX0 - 10) * Math.min(100, s.dist)) / 100;
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['sim-water'];
    ctx.beginPath();
    ctx.roundRect(bx - 1, tubeY - 5, 10, 10, 5);
    ctx.fill();
    ctx.stroke();
    // Tube up to the shoot
    const plantX = tubeX1 + 18;
    geo.plantX = plantX;
    ctx.fillStyle = 'rgba(120,170,255,0.25)';
    ctx.fillRect(tubeX1, tubeY - 6, 26, 12);
    ctx.fillRect(plantX - 4, h * 0.6, 12, tubeY - h * 0.6 + 6);
    ctx.strokeRect(plantX - 4, h * 0.6, 12, tubeY - h * 0.6 + 6);

    // Shoot with leaves
    const stemTop = h * 0.16;
    ctx.strokeStyle = pal['sim-wall'];
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(plantX + 2, h * 0.62);
    ctx.quadraticCurveTo(plantX - 6, h * 0.4, plantX + 4, stemTop);
    ctx.stroke();
    const coated = p.coat !== 'none';
    for (let i = 0; i < 5; i++) {
      const ly = stemTop + 14 + i * ((h * 0.4) / 5);
      const side = i % 2 ? 1 : -1;
      ctx.save();
      ctx.translate(plantX + 2, ly);
      ctx.rotate(side * -0.5);
      ctx.fillStyle = pal['sim-wall'];
      ctx.beginPath();
      ctx.ellipse(side * 30, 0, 30, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      if (coated) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
      ctx.restore();
    }
    // Wind arrows
    if (p.wind > 0) {
      for (let i = 0; i < 3; i++) {
        const y = stemTop + 30 + i * 40;
        const off = (s.anim * 60 * p.wind) % 40;
        arrow(ctx, plantX - 110 + off, y, plantX - 70 + off, y, pal['text-faint'], 2, 8);
      }
    }
    // Water vapour leaving the shoot
    for (const v of vapour) {
      ctx.fillStyle = pal['sim-water'];
      ctx.globalAlpha = Math.max(0, v.life) * 0.7;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Leaf close-up with a stoma
    const cx = w * 0.83;
    const cy = h * 0.42;
    const r = Math.min(w * 0.15, h * 0.33);
    geo = { ...geo, leafCX: cx, leafCY: cy, leafR: r };
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(120, 180, 90, 0.25)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const open = m.open * COAT_FACTOR[p.coat];
    const gap = 3 + open * r * 0.22;
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = pal['sim-membrane'];
      ctx.beginPath();
      ctx.ellipse(cx + sgn * (gap / 2 + r * 0.16), cy, r * 0.17, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(20, 30, 20, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, gap / 2), r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    pill(ctx, 'Stoma (pore) between guard cells', cx, cy + r + 18, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
    pill(ctx, `${Math.round(open * 100)}% open`, cx, cy - r - 14, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Readouts
    ui.readout('rate', `${m.rate.toFixed(2)} mm/min`);
    ui.readout('stomata', `${Math.round(open * 100)}%`);
    ui.readout('vpd', `${vpd().toFixed(2)} kPa`);
    ui.readout('dist', `${s.dist.toFixed(1)} mm`);
    ui.readout('limit', m.limit);
    sim.setTime(s.t, 'min');
    sim.setBadge(`${m.rate.toFixed(2)} mm/min`);
    canvas.setAttribute('aria-label', `Potometer with a leafy shoot. Water uptake ${m.rate.toFixed(2)} millimetres per minute. Stomata ${Math.round(open * 100)} percent open. Bubble has moved ${s.dist.toFixed(1)} millimetres.`);

    const ymax = Math.max(20, Math.ceil(Math.max(...pts.map((q) => q.y)) / 20) * 20);
    graph.opts.y = { min: 0, max: ymax, step: ymax / 4, format: (v) => `${Math.round(v)}` };
    graph.set('cur', { label: 'Current conditions', color: 'accent', points: pts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="tr-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const upd = () => sim.requestRender();
  const ctl = {
    light: ui.range('tr-light', (v) => `${v}%`, (v) => ((p.light = v), upd())),
    temp: ui.range('tr-temp', (v) => `${v} °C`, (v) => ((p.temp = v), upd())),
    hum: ui.range('tr-hum', (v) => `${v}%`, (v) => ((p.hum = v), upd())),
    wind: ui.range('tr-wind', (v) => `${v} m/s`, (v) => ((p.wind = v), upd())),
  };
  coatSel.addEventListener('change', () => {
    p.coat = coatSel.value as Coat;
    upd();
  });
  root.querySelector('[data-bubble]')!.addEventListener('click', resetBubble);

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (Math.hypot(x - geo.leafCX, y - geo.leafCY) < geo.leafR) {
      sim.showTooltip(x, y, 'Stoma', 'Two guard cells swell to open the pore in light and shrink to close it in darkness or drought. Most stomata are on the underside of leaves.');
    } else if (y > geo.tubeY - 20) {
      sim.showTooltip(x, y, 'Potometer bubble', 'As the shoot takes up water, the air bubble is pulled along the tube. The distance per minute measures water uptake, which is close to the transpiration rate.');
    } else {
      sim.showTooltip(x, y, 'Leafy shoot', 'Water evaporates from cells inside the leaves and diffuses out through stomata. This pulls a continuous column of water up the xylem from the stem.');
    }
  });

  const sim = createSimController(root, {
    step: (dt) => {
      const m = model();
      const mins = dt * MIN_PER_SECOND;
      s.t += mins;
      s.dist += m.rate * mins;
      s.anim += dt;
      if (s.dist >= 100) {
        sim.pause();
        sim.showOverlay('The bubble reached the end of the scale', 'Press “Reset bubble” to push it back to zero and keep measuring.', { label: 'Reset bubble', onClick: () => (resetBubble(), sim.hideOverlay()) });
      }
      const last = pts[pts.length - 1];
      if (s.t - last.x >= 0.25) pts.push({ x: s.t, y: s.dist });
      // Vapour particles in proportion to the rate
      if (Math.random() < m.rate * dt * 4) vapour.push({ x: geo.plantX + (Math.random() - 0.5) * 70, y: size.h * (0.18 + Math.random() * 0.38), life: 1 });
      for (const v of vapour) {
        v.x += (12 + p.wind * 20) * dt;
        v.y -= 10 * dt;
        v.life -= dt * 0.6;
      }
      vapour = vapour.filter((v) => v.life > 0);
    },
    render,
    autoplay: false,
    reset() {
      (Object.keys(ctl) as (keyof typeof ctl)[]).forEach((k) => ctl[k].set(DEF[k], false));
      Object.assign(p, DEF);
      coatSel.value = 'none';
      table.clear();
      vapour = [];
      resetBubble();
    },
  });
  resetBubble();
  comparer.refresh();
}
