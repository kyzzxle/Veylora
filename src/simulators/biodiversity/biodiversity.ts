/**
 * Biodiversity and stability: three grassland plots side by side.
 *   Plot A: 1 species (a ryegrass monoculture)
 *   Plot B: 4 species
 *   Plot C: 2–20 species (slider)
 * Every plot includes the ryegrass, so all three face the same disturbances.
 *
 * Each species i has its own growth rate and tolerance of drought and heat,
 * and shares the plot's space (logistic competition):
 *   dBᵢ/dt = rᵢ Bᵢ (1 − ΣB/K) − stressᵢ Bᵢ
 * During a disturbance, stressᵢ = 2.5 (1 − drought tolerance) for a drought,
 * 2.0 (1 − heat tolerance) for a heatwave, or 3 for the ryegrass only in a
 * disease outbreak. Seeds in the soil let every species regrow afterwards.
 * Mixed plots also use space and nutrients more fully, so K rises with the
 * number of species (80 % of the maximum for one species, up to 100 %), as
 * long-term grassland experiments have found.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point, type RefLine } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent', 'danger', 'warning'] as const;
type Event = 'drought' | 'heat' | 'disease';
const EVENT_NAME: Record<Event, string> = { drought: 'Drought', heat: 'Heatwave', disease: 'Ryegrass disease' };
const NAMES = ['Ryegrass', 'White clover', 'Yarrow', 'Ribwort plantain', 'Red fescue', 'Knapweed', 'Bird’s-foot trefoil', 'Oxeye daisy', 'Sorrel', 'Meadow buttercup', 'Tufted vetch', 'Timothy grass', 'Cocksfoot', 'Self-heal', 'Wild carrot', 'Lady’s bedstraw', 'Red clover', 'Yellow rattle', 'Cowslip', 'Field scabious'];
const SEED = 0.3; // biomass kept as seeds in the soil
const EVENT_YEARS = 1.5;

export function initBiodiversity(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  // Fixed species traits, so every run is comparable
  let seed = 3;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const traits = NAMES.map((name, i) => ({
    name,
    colour: `hsl(${(i * 47 + 95) % 360}, ${i === 0 ? 70 : 55}%, ${i === 0 ? 42 : 50}%)`,
    r: i === 0 ? 1.2 : 0.6 + rnd() * 0.6,
    drought: i === 0 ? 0.15 : i === 1 ? 0.85 : rnd(),
    heat: i === 0 ? 0.25 : i === 2 ? 0.85 : rnd(),
  }));

  const st = { nC: 16 };
  let plots: { n: number; B: number[]; low: number; history: Point[] }[] = [];
  let t = 0;
  let event: { kind: Event; start: number } | null = null;
  let marks: RefLine[] = [];

  function restart() {
    t = 0;
    event = null;
    marks = [];
    plots = [1, 4, st.nC].map((n) => ({ n, B: Array(n).fill(90 / n), low: NaN, history: [{ x: 0, y: 90 }] }));
  }
  const total = (p: (typeof plots)[number]) => p.B.reduce((a, b) => a + b, 0);
  const capacity = (p: (typeof plots)[number]) => {
    const alive = p.B.filter((b) => b > 1).length;
    return 80 + 20 * (1 - 1 / Math.max(1, alive));
  };

  function step(dt: number) {
    const years = dt * 1.2;
    const n = Math.ceil(years / 0.02);
    const h = years / n;
    for (let k = 0; k < n; k++) {
      const on = event && t - event.start < EVENT_YEARS ? event.kind : null;
      for (const p of plots) {
        const K = capacity(p);
        const tot = total(p);
        p.B = p.B.map((b, i) => {
          const tr = traits[i];
          const stress = on === 'drought' ? 2.5 * (1 - tr.drought) : on === 'heat' ? 2.0 * (1 - tr.heat) : on === 'disease' && i === 0 ? 3 : 0;
          return Math.max(SEED, b + (tr.r * b * (1 - tot / K) - stress * b) * h);
        });
        if (event) p.low = Number.isNaN(p.low) ? total(p) : Math.min(p.low, total(p));
      }
      t += h;
    }
    if (Math.floor(t * 4) / 4 > plots[0].history[plots[0].history.length - 1].x) for (const p of plots) p.history.push({ x: Math.floor(t * 4) / 4, y: total(p) });
  }

  function disturb(kind: Event) {
    event = { kind, start: t };
    for (const p of plots) p.low = total(p);
    marks.push({ value: Math.round(t * 10) / 10, label: EVENT_NAME[kind], color: kind === 'drought' ? 'warning' : kind === 'heat' ? 'danger' : 'accent', axis: 'x' });
    sim.announce(`${EVENT_NAME[kind]} begins.`);
    sim.play();
  }

  /* ---------- Drawing (design box 1000 × 400, or 340 × 1040 stacked on phones) ---------- */
  const isStacked = () => size.h > size.w;
  const tf = () => {
    const [bw, bh] = isStacked() ? [340, 1150] : [1000, 430];
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    const on = event && t - event.start < EVENT_YEARS ? event.kind : null;
    const stacked = isStacked();

    plots.forEach((p, idx) => {
      const px = stacked ? 20 : 20 + idx * 330;
      const py = stacked ? 40 + idx * 375 : 70;
      const S = 300;
      const label = ['Plot A', 'Plot B', 'Plot C'][idx];
      ctx.font = fs(13, 800);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'left';
      ctx.fillText(`${label}: ${p.n} species`, px, py - 10);
      // soil
      ctx.fillStyle = on === 'drought' ? '#a07a4c' : '#6e5038';
      ctx.fillRect(px, py, S, S);
      // 12 × 12 grid of plants; each species fills cells in proportion to its share of the maximum
      const cells = 144;
      const shares = p.B.map((b) => b / 100);
      let c = 0;
      const order: number[] = [];
      shares.forEach((s, i) => {
        const m = Math.round(s * cells);
        for (let j = 0; j < m && c < cells; j++, c++) order.push(i);
      });
      // spread species around the plot rather than in blocks
      const cellOrder = Array.from({ length: cells }, (_, i) => (i * 89) % cells);
      const cs = S / 12;
      order.forEach((sp, j) => {
        const cell = cellOrder[j];
        const cx = px + (cell % 12) * cs + cs / 2;
        const cy = py + Math.floor(cell / 12) * cs + cs / 2;
        ctx.fillStyle = traits[sp].colour;
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.46, 0, Math.PI * 2);
        ctx.fill();
        if (on === 'disease' && sp === 0) {
          ctx.fillStyle = '#5b2a6b';
          ctx.beginPath();
          ctx.arc(cx + 2, cy - 2, cs * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      if (on) {
        ctx.fillStyle = on === 'drought' ? 'rgba(210, 160, 70, 0.22)' : on === 'heat' ? 'rgba(255, 90, 40, 0.18)' : 'rgba(120, 60, 150, 0.12)';
        ctx.fillRect(px, py, S, S);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, S, S);
      // biomass bar
      const tot = total(p);
      ctx.fillStyle = 'rgba(128,128,128,0.25)';
      ctx.fillRect(px, py + S + 10, S, 12);
      ctx.fillStyle = tot > 70 ? '#4caf50' : tot > 40 ? pal.warning : pal.danger;
      ctx.fillRect(px, py + S + 10, (S * clamp(tot, 0, 100)) / 100, 12);
      ctx.font = fs(11.5, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(`Plant growth ${Math.round(tot)} %`, px, py + S + 26 + 10 / k);
    });
    if (on) {
      ctx.font = fs(16, 800);
      ctx.fillStyle = pal.danger;
      ctx.textAlign = 'center';
      ctx.fillText(`${EVENT_NAME[on].toUpperCase()}!`, stacked ? 170 : 500, stacked ? 22 : 32);
    }
    ctx.restore();
    updateReadouts();
    sim.setTime(t, ' years');
    drawGraph();
  }

  function updateReadouts() {
    plots.forEach((p, i) => {
      const alive = p.B.filter((b) => b > 1).length;
      const low = Number.isNaN(p.low) ? '' : ` · lowest after disturbance ${Math.round(p.low)} %`;
      ui.readout(`p${i}`, `${Math.round(total(p))} % growth · ${alive} of ${p.n} species thriving${low}`, !Number.isNaN(p.low) && p.low < 30 ? 'bad' : null);
    });
    const on = event && t - event.start < EVENT_YEARS;
    ui.readout('event', on ? `${EVENT_NAME[event!.kind]} in progress` : event ? `After the ${EVENT_NAME[event.kind].toLowerCase()}: recovering` : 'Calm conditions', on ? 'warn' : null);
    sim.setBadge(on ? EVENT_NAME[event!.kind] : 'Calm');
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="bd-graph"]')!, {
    x: { min: 0, span: 20, format: (x) => `${x.toFixed(0)} y` },
    y: { min: 0, max: 100, step: 25, format: (v) => `${v}%` },
  });
  function drawGraph() {
    graph.opts.x = { min: Math.max(0, t - 20), span: 20, max: Math.max(20, t), format: (x) => `${x.toFixed(0)} y` };
    graph.opts.refs = marks.filter((m) => m.value >= t - 20);
    const colours = ['danger', 'warning', 'accent'];
    plots.forEach((p, i) => graph.set(`p${i}`, { label: `Plot ${'ABC'[i]} (${p.n} species)`, color: colours[i], points: p.history, width: 2.5 }));
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="bd-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  root.querySelectorAll<HTMLButtonElement>('[data-event]').forEach((b) => b.addEventListener('click', () => disturb(b.dataset.event as Event)));
  const nC = ui.range('bd-n', (v) => `${v} species`, (v) => {
    st.nC = v;
    restart();
    sim.requestRender();
  });

  restart();
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      st.nC = 16;
      nC.set(16, false);
      restart();
    },
  });
}
