/**
 * Photosynthesis in pondweed, measured by counting oxygen bubbles.
 * Light intensity follows the inverse-square law: I ∝ 1/d² (relative to 10 cm).
 * Rate is limited by whichever factor is in shortest supply (Blackman's law
 * of limiting factors), combined smoothly:
 *   rate = Pmax · f(T) · softmin(light term, CO₂ term, 1)
 * f(T) rises with temperature (enzyme activity) and falls sharply above ~35 °C
 * as enzymes denature. Green light is absorbed least by chlorophyll.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { createDataTable } from '../shared/datatable';
import { enableDrag } from '../shared/drag';
import { font, pill } from '../shared/draw';
import { LineGraph } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'sim-water', 'warning', 'sim-wall', 'accent'] as const;
type Colour = 'white' | 'red' | 'blue' | 'green';
const ABSORB: Record<Colour, number> = { white: 0.85, red: 1, blue: 0.92, green: 0.3 };
const LAMP: Record<Colour, string> = { white: '#fff7d6', red: '#ff5a4f', blue: '#5a8dff', green: '#4fd36a' };
const PMAX = 40; // bubbles per minute at full light, CO₂ and optimum temperature
const DEF = { d: 15, co2: 40, T: 25, colour: 'white' as Colour };

type Row = { dist: number; light: number; co2: number; temp: number; colour: string; rate: number };

const softmin = (...xs: number[]) => Math.pow(xs.reduce((a, x) => a + Math.pow(Math.max(x, 1e-6), -4), 0), -1 / 4);

export function tempFactor(T: number) {
  if (T <= 0) return 0.02;
  if (T >= 45) return 0;
  const rise = Math.pow(2, (Math.min(T, 30) - 30) / 10); // roughly doubles every 10 °C up to 30 °C
  const fall = T > 32 ? Math.max(0, 1 - ((T - 32) / 13) ** 2) : 1; // enzymes denature
  return rise * fall;
}

export function initPhotosynthesis(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  const s = { t: 0, count: 0, acc: 0 };
  let bubbles: { x: number; y: number; r: number }[] = [];

  const light = (d = p.d) => (10 / d) ** 2; // 1.0 at 10 cm
  function model(d = p.d) {
    const L = light(d) * ABSORB[p.colour];
    const lightTerm = L / 1.2; // saturates around 1.2× the 10 cm intensity
    const co2Term = p.co2 / 60;
    const fT = tempFactor(p.T);
    const rate = PMAX * fT * softmin(lightTerm, co2Term, 1);
    const terms = [
      { name: p.colour === 'green' ? 'Light (green is poorly absorbed)' : 'Light intensity', v: lightTerm },
      { name: 'Carbon dioxide', v: co2Term },
    ];
    let limit = terms.reduce((a, b) => (b.v < a.v ? b : a)).name;
    if (Math.min(lightTerm, co2Term) >= 1) limit = fT < 0.95 ? 'Temperature' : 'None — the plant is working at full capacity';
    if (fT < 0.5) limit = p.T > 32 ? 'Temperature (enzymes denaturing)' : 'Temperature (too cold)';
    return { rate, limit };
  }

  /* ---------- Geometry ---------- */
  const geo = () => {
    const { w, h } = size;
    const bx = w * 0.62;
    const bw = Math.min(w * 0.3, 220);
    const pxPerCm = (bx - bw / 2 - 70) / 50;
    return { bx, bw, by: h * 0.18, bh: h * 0.72, lampX: bx - bw / 2 - 20 - p.d * pxPerCm, pxPerCm };
  };

  /* ---------- Graph & table ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ph-graph"]')!, {
    x: { min: 0, span: 4, max: 4, format: (v) => v.toFixed(1) },
    y: { min: 0, max: 45, step: 15, format: (v) => `${v}` },
  });
  function updateGraph(rows: Row[]) {
    const curve = Array.from({ length: 80 }, (_, i) => {
      const L = 0.04 + (i / 79) * 3.96;
      const d = 10 / Math.sqrt(L);
      return { x: L, y: model(d).rate };
    });
    graph.set('model', { label: 'Model at current CO₂, temperature and colour', color: 'text-faint', points: curve, dash: [5, 5], width: 1.5 });
    graph.set('data', { label: 'Your measurements', color: 'accent', points: rows.map((r) => ({ x: r.light, y: r.rate })), type: 'points' });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="ph-graph"]'));
  }
  const table = createDataTable<Row>(
    root,
    'ph-table',
    [
      { key: 'dist', label: 'Distance (cm)' },
      { key: 'light', label: 'Light (relative)', format: (v) => Number(v).toFixed(2) },
      { key: 'co2', label: 'CO₂ (%)' },
      { key: 'temp', label: 'Temp (°C)' },
      { key: 'colour', label: 'Colour' },
      { key: 'rate', label: 'Bubbles/min', format: (v) => Number(v).toFixed(1) },
    ],
    {
      filename: 'photosynthesis-results.csv',
      onRecord: () => {
        const r = model().rate * (1 + (Math.random() - 0.5) * 0.08);
        return { dist: p.d, light: light(), co2: p.co2, temp: p.T, colour: p.colour, rate: Math.max(0, r) };
      },
      onChange: updateGraph,
    },
  );

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    const g = geo();
    const m = model();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Light beam
    const beam = ctx.createLinearGradient(g.lampX, 0, g.bx, 0);
    const lc = LAMP[p.colour];
    beam.addColorStop(0, lc);
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.18 + Math.min(0.5, light() * 0.25);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(g.lampX + 20, h * 0.42);
    ctx.lineTo(g.bx, g.by + 10);
    ctx.lineTo(g.bx, g.by + g.bh - 10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Lamp
    ctx.fillStyle = pal['sim-text'];
    ctx.fillRect(g.lampX - 30, h * 0.42 - 4, 20, 8);
    ctx.fillRect(g.lampX - 24, h * 0.42, 6, h * 0.42);
    ctx.fillStyle = lc;
    ctx.beginPath();
    ctx.arc(g.lampX, h * 0.42, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ruler
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(10, 500, 'mono');
    const rulerY = h * 0.92;
    for (let cm = 0; cm <= 50; cm += 10) {
      const x = g.bx - g.bw / 2 - 20 - cm * g.pxPerCm;
      ctx.fillRect(x, rulerY - 6, 1, 6);
      ctx.fillText(`${cm}`, x - 6, rulerY + 10);
    }
    ctx.fillText('cm from beaker', g.bx - g.bw / 2 - 20 - 50 * g.pxPerCm, rulerY - 12);

    // Beaker and water
    ctx.fillStyle = pal['sim-water'];
    ctx.globalAlpha = 0.18;
    ctx.fillRect(g.bx - g.bw / 2, g.by + 20, g.bw, g.bh - 20);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(g.bx - g.bw / 2, g.by);
    ctx.lineTo(g.bx - g.bw / 2, g.by + g.bh);
    ctx.lineTo(g.bx + g.bw / 2, g.by + g.bh);
    ctx.lineTo(g.bx + g.bw / 2, g.by);
    ctx.stroke();
    // Pondweed
    const baseY = g.by + g.bh - 8;
    ctx.strokeStyle = pal['sim-wall'];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(g.bx, baseY);
    ctx.quadraticCurveTo(g.bx - 10, baseY - g.bh * 0.35, g.bx + 2, g.by + g.bh * 0.32);
    ctx.stroke();
    ctx.fillStyle = pal['sim-wall'];
    for (let i = 0; i < 14; i++) {
      const y = baseY - 14 - i * ((g.bh * 0.6) / 14);
      const side = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(g.bx + side * 12, y, 12, 4, side * -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bubbles
    ctx.strokeStyle = pal['sim-water'];
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    pill(ctx, `${m.rate.toFixed(1)} bubbles/min`, g.bx, g.by - 12, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
    pill(ctx, `Thermometer ${p.T} °C`, g.bx + g.bw / 2 - 40, g.by + g.bh + 14, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    ui.readout('rate', m.rate.toFixed(1));
    ui.readout('light', light().toFixed(2));
    ui.readout('limit', m.limit);
    ui.readout('count', String(s.count));
    sim.setTime(s.t, 'min');
    sim.setBadge(`${m.rate.toFixed(1)} bubbles/min`);
    canvas.setAttribute('aria-label', `Pondweed with a ${p.colour} lamp ${p.d} centimetres away, carbon dioxide level ${p.co2} percent, water at ${p.T} degrees. It produces ${m.rate.toFixed(1)} oxygen bubbles per minute. Limiting factor: ${m.limit}.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const refresh = () => {
    updateGraph(table.rows);
    sim.requestRender();
  };
  const dCtl = ui.range('ph-dist', (v) => `${v} cm`, (v) => ((p.d = v), sim.requestRender()));
  const cCtl = ui.range('ph-co2', (v) => `${v}%`, (v) => ((p.co2 = v), refresh()));
  const tCtl = ui.range('ph-temp', (v) => `${v} °C`, (v) => ((p.T = v), refresh()));
  const colCtl = ui.choice<Colour>('ph-colour', (v) => ((p.colour = v), refresh()));

  enableDrag<'lamp'>(canvas, {
    hit: (x, y) => (Math.hypot(x - geo().lampX, y - size.h * 0.42) < 30 ? 'lamp' : null),
    move: (_id, x) => {
      const g = geo();
      const d = Math.round((g.bx - g.bw / 2 - 20 - x) / g.pxPerCm);
      dCtl.set(Math.max(5, Math.min(50, d)));
    },
    click: (x, y) => {
      const g = geo();
      if (Math.abs(x - g.bx) < g.bw / 2) sim.showTooltip(x, y, 'Pondweed (Elodea)', 'Its leaves photosynthesise underwater. The oxygen produced forms bubbles that rise from the cut stem — counting them measures the rate.');
      else sim.showTooltip(x, y, 'Lamp', `Light intensity at the plant is proportional to 1/d². Moving from 20 cm to 10 cm makes it 4 times brighter.`);
    },
  });

  const sim = createSimController(root, {
    step: (dt) => {
      const mins = dt; // 1 second = 1 minute
      s.t += mins;
      const g = geo();
      s.acc += model().rate * mins;
      while (s.acc >= 1) {
        s.acc -= 1;
        s.count++;
        bubbles.push({ x: g.bx + 2 + (Math.random() - 0.5) * 6, y: g.by + g.bh * 0.32, r: 3 + Math.random() * 2 });
      }
      for (const b of bubbles) b.y -= dt * 90;
      bubbles = bubbles.filter((b) => b.y > g.by + 22);
    },
    render,
    autoplay: false,
    reset() {
      dCtl.set(DEF.d, false);
      cCtl.set(DEF.co2, false);
      tCtl.set(DEF.T, false);
      colCtl.set('white', false);
      Object.assign(p, DEF);
      Object.assign(s, { t: 0, count: 0, acc: 0 });
      bubbles = [];
      table.clear();
    },
  });
  updateGraph(table.rows);
  sim.requestRender();
}
