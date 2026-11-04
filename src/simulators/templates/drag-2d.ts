import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint'] as const;
const RANGE = 5; // grid runs from −5 to 5 units

export function initDragTemplate(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const state = { bx: 3, by: 2, snap: true };

  // Unit ↔ pixel conversion (square grid centred in the canvas)
  const scale = () => (Math.min(size.w, size.h) * 0.45) / RANGE;
  const toPx = (x: number, y: number) => ({ x: size.w / 2 + x * scale(), y: size.h / 2 - y * scale() });
  const toUnits = (px: number, py: number) => ({ x: (px - size.w / 2) / scale(), y: (size.h / 2 - py) / scale() });

  const ui = controls(root);
  const bx = ui.range('drag-bx', (v) => v.toFixed(1), (v) => ((state.bx = v), sim.requestRender()));
  const by = ui.range('drag-by', (v) => v.toFixed(1), (v) => ((state.by = v), sim.requestRender()));
  ui.toggle('drag-snap', (v) => (state.snap = v));

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Grid and axes
    ctx.strokeStyle = pal['sim-grid'];
    ctx.lineWidth = 1;
    for (let i = -RANGE; i <= RANGE; i++) {
      const a = toPx(i, -RANGE);
      const b = toPx(i, RANGE);
      const c = toPx(-RANGE, i);
      const d = toPx(RANGE, i);
      ctx.globalAlpha = i === 0 ? 1 : 0.6;
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Vector A → B with arrowhead
    const A = toPx(0, 0);
    const B = toPx(state.bx, state.by);
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    ctx.strokeStyle = pal['accent-2'];
    ctx.fillStyle = pal['accent-2'];
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x - Math.cos(ang) * 12, B.y - Math.sin(ang) * 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(B.x - Math.cos(ang - 0.4) * 18, B.y - Math.sin(ang - 0.4) * 18);
    ctx.lineTo(B.x - Math.cos(ang + 0.4) * 18, B.y - Math.sin(ang + 0.4) * 18);
    ctx.closePath();
    ctx.fill();

    // Points
    for (const [p, color, name] of [
      [A, pal.accent, 'A'],
      [B, pal['sim-solute'], 'B'],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, name === 'B' ? 11 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal['sim-text'];
      ctx.font = '600 13px "IBM Plex Sans Variable", system-ui, sans-serif';
      ctx.fillText(name, p.x + 14, p.y - 12);
    }

    // Readouts
    const mag = Math.hypot(state.bx, state.by);
    const deg = (Math.atan2(state.by, state.bx) * 180) / Math.PI;
    ui.readout('mag', `${mag.toFixed(2)} units`);
    ui.readout('angle', `${deg.toFixed(1)}°`);
    ui.readout('comp', `(${state.bx.toFixed(1)}, ${state.by.toFixed(1)})`);
    canvas.setAttribute('aria-label', `Vector from A at the origin to B at (${state.bx.toFixed(1)}, ${state.by.toFixed(1)}). Length ${mag.toFixed(2)}, angle ${deg.toFixed(0)} degrees.`);
  }

  enableDrag<'B'>(canvas, {
    hit: (x, y) => {
      const B = toPx(state.bx, state.by);
      return Math.hypot(x - B.x, y - B.y) < 22 ? 'B' : null;
    },
    move: (_id, x, y) => {
      const u = toUnits(x, y);
      const snap = (v: number) => (state.snap ? Math.round(v * 2) / 2 : v);
      state.bx = clamp(snap(u.x), -RANGE, RANGE);
      state.by = clamp(snap(u.y), -RANGE, RANGE);
      bx.set(state.bx, false); // keep the sliders in sync without re-triggering
      by.set(state.by, false);
      sim.requestRender();
    },
    click: (x, y) => {
      const u = toUnits(x, y);
      sim.showTooltip(x, y, 'Grid point', `About (${u.x.toFixed(1)}, ${u.y.toFixed(1)}). Each square is 1 unit.`);
    },
  });

  const sim = createSimController(root, {
    render,
    reset() {
      state.bx = 3;
      state.by = 2;
      bx.set(3, false);
      by.set(2, false);
    },
  });
  sim.requestRender();
}
