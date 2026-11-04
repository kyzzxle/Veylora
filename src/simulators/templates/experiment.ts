import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { createDataTable } from '../shared/datatable';
import { LineGraph } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'sim-solute', 'text-faint', 'border-strong'] as const;
const PLACES: Record<string, string> = { '9.81': 'Earth', '3.71': 'Mars', '1.62': 'Moon' };
const SERIES_COLOR: Record<string, string> = { Earth: 'accent', Mars: 'sim-solute', Moon: 'accent-2' };

type Row = { place: string; h: number; t: number; pred: number };

export function initExperimentTemplate(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const state = { h: 2, g: 9.81, t: 0, y: 0, v: 0, landed: false, measured: null as number | null };
  const predicted = () => Math.sqrt((2 * state.h) / state.g);
  // A hand-held stopwatch is never perfect: add up to ±0.04 s reaction-time error.
  const stopwatch = (t: number) => t + (Math.random() + Math.random() - 1) * 0.04;

  const ui = controls(root);
  const restart = () => {
    state.t = 0;
    state.y = 0;
    state.v = 0;
    state.landed = false;
    state.measured = null;
    sim.requestRender();
  };
  const hCtl = ui.range('exp-h', (v) => `${v.toFixed(1)} m`, (v) => ((state.h = v), restart()));
  const gCtl = ui.choice<string>('exp-g', (v) => ((state.g = Number(v)), restart()));

  /* Graph: measured points per location + predicted curves */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="exp-graph"]')!, {
    x: { min: 0, span: 5, max: 5, format: (v) => `${v} m` },
    y: { min: 0, max: 2.6, step: 0.5, format: (v) => `${v}s` },
  });
  function updateGraph(rows: Row[]) {
    graph.clear();
    for (const [gv, place] of Object.entries(PLACES)) {
      const g = Number(gv);
      const pts = rows.filter((r) => r.place === place).map((r) => ({ x: r.h, y: r.t }));
      if (!pts.length && place !== PLACES[String(state.g)]) continue;
      graph.set(`theory-${place}`, {
        label: `${place}: predicted`,
        color: SERIES_COLOR[place],
        points: LineGraph.sample((h) => Math.sqrt((2 * h) / g), 0, 5, 80),
        width: 1.5,
        dash: [6, 5],
      });
      if (pts.length) graph.set(`data-${place}`, { label: `${place}: measured`, color: SERIES_COLOR[place], points: pts, type: 'points' });
    }
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="exp-graph"]'));
  }

  const table = createDataTable<Row>(
    root,
    'exp-table',
    [
      { key: 'place', label: 'Location' },
      { key: 'h', label: 'Height (m)', format: (v) => Number(v).toFixed(1) },
      { key: 't', label: 'Measured time (s)', format: (v) => Number(v).toFixed(3) },
      { key: 'pred', label: 'Predicted (s)', format: (v) => Number(v).toFixed(3) },
    ],
    {
      filename: 'drop-times.csv',
      onRecord: () => {
        if (state.measured === null) {
          sim.announce('Drop the ball first, then record the time.');
          return null;
        }
        const row = { place: PLACES[String(state.g)], h: state.h, t: state.measured, pred: predicted() };
        sim.announce(`Recorded ${row.t.toFixed(3)} seconds from ${row.h} metres.`);
        return row;
      },
      onChange: updateGraph,
    },
  );

  function step(dt: number) {
    if (state.landed) return;
    state.t += dt;
    state.v += state.g * dt;
    state.y += state.v * dt;
    if (state.y >= state.h) {
      state.y = state.h;
      state.landed = true;
      state.measured = stopwatch(predicted());
      sim.pause();
      sim.announce(`The ball landed. Measured time ${state.measured.toFixed(3)} seconds.`);
    }
  }

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Height scale: the tallest drop (5 m) fills the stage.
    const top = 30;
    const floor = h - 40;
    const pxPerM = (floor - top) / 5;
    ctx.strokeStyle = pal['sim-grid'];
    ctx.fillStyle = pal['text-faint'];
    ctx.font = '11px "JetBrains Mono Variable", monospace';
    for (let m = 0; m <= 5; m++) {
      const y = floor - m * pxPerM;
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
      ctx.fillText(`${m} m`, 10, y + 4);
    }
    ctx.fillStyle = pal['border-strong'];
    ctx.fillRect(40, floor, w - 60, 6);

    // Ball
    const startY = floor - state.h * pxPerM;
    const ballY = startY + state.y * pxPerM - 14;
    ctx.fillStyle = pal['sim-solute'];
    ctx.beginPath();
    ctx.arc(w / 2, Math.min(ballY, floor - 14), 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 40, startY);
    ctx.lineTo(w / 2 + 40, startY);
    ctx.stroke();
    ctx.setLineDash([]);

    sim.setTime(state.t);
    ui.readout('status', state.landed ? 'Landed — press Record' : state.t > 0 ? 'Falling…' : 'Ready — press Start', state.landed ? 'ok' : null);
    ui.readout('measured', state.measured === null ? '—' : `${state.measured.toFixed(3)} s`);
    ui.readout('predicted', `${predicted().toFixed(3)} s`);
  }

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange: (on) => {
      if (on && state.landed) restart(); // Start again after landing drops a fresh ball
    },
    reset() {
      hCtl.set(2, false);
      gCtl.set('9.81', false);
      state.h = 2;
      state.g = 9.81;
      table.clear();
      restart();
    },
  });
  updateGraph(table.rows);
  sim.requestRender();
}
