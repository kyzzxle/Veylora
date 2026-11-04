/**
 * Vector addition and subtraction on a grid. R = A + B (or A − B),
 * computed by adding components: Rx = Ax + Bx, Ry = Ay + By.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { arrow, font, pill } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'bg-elev', 'border-strong'] as const;
const R = 10;
type Mode = 'tip' | 'para' | 'sub';
const DEF = { am: 5, aa: 30, bm: 4, ba: 120 };

export function initVectors(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { mode: 'tip' as Mode, comp: false, snap: true };
  const A = { x: 0, y: 0 };
  const B = { x: 0, y: 0 };
  const fromPolar = (v: { x: number; y: number }, m: number, deg: number) => {
    v.x = m * Math.cos((deg * Math.PI) / 180);
    v.y = m * Math.sin((deg * Math.PI) / 180);
  };
  fromPolar(A, DEF.am, DEF.aa);
  fromPolar(B, DEF.bm, DEF.ba);

  const mag = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
  const f2 = (v: number) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2); // avoids “-0.00”
  const dir = (v: { x: number; y: number }) => ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360;
  const res = () => (p.mode === 'sub' ? { x: A.x - B.x, y: A.y - B.y } : { x: A.x + B.x, y: A.y + B.y });

  const scale = () => (Math.min(size.w, size.h) * 0.47) / R;
  const P = (x: number, y: number) => ({ x: size.w / 2 + x * scale(), y: size.h / 2 - y * scale() });
  const U = (px: number, py: number) => ({ x: (px - size.w / 2) / scale(), y: (size.h / 2 - py) / scale() });

  /** Where B starts: at A's tip (tip-to-tail / subtraction) or at the origin (parallelogram). */
  const bStart = () => (p.mode === 'para' ? { x: 0, y: 0 } : { x: A.x, y: A.y });
  const bVec = () => (p.mode === 'sub' ? { x: -B.x, y: -B.y } : B);

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Grid
    for (let i = -R; i <= R; i++) {
      const a = P(i, -R);
      const b = P(i, R);
      const c = P(-R, i);
      const d = P(R, i);
      ctx.strokeStyle = i === 0 ? pal['border-strong'] : pal['sim-grid'];
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(10, 500, 'mono');
    for (let i = -R; i <= R; i += 2) if (i) ctx.fillText(String(i), P(i, 0).x - 4, P(i, 0).y + 14);

    const O = P(0, 0);
    const Ae = P(A.x, A.y);
    const bs = bStart();
    const bv = bVec();
    const Bs = P(bs.x, bs.y);
    const Be = P(bs.x + bv.x, bs.y + bv.y);
    const r = res();
    const Re = P(r.x, r.y);

    if (p.mode === 'para') {
      // Dashed copies complete the parallelogram
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1.5;
      const Bend = P(B.x, B.y);
      ctx.beginPath();
      ctx.moveTo(Ae.x, Ae.y);
      ctx.lineTo(Re.x, Re.y);
      ctx.moveTo(Bend.x, Bend.y);
      ctx.lineTo(Re.x, Re.y);
      ctx.stroke();
      ctx.restore();
    }
    if (p.mode === 'sub') {
      // Show the original B faintly from the origin
      ctx.globalAlpha = 0.35;
      arrow(ctx, O.x, O.y, P(B.x, B.y).x, P(B.x, B.y).y, pal['accent-2'], 2, 10);
      ctx.globalAlpha = 1;
    }

    if (p.comp) {
      for (const [v, s, c] of [
        [A, { x: 0, y: 0 }, pal.accent],
        [bv, bs, pal['accent-2']],
      ] as const) {
        const s0 = P(s.x, s.y);
        const sx = P(s.x + v.x, s.y);
        const se = P(s.x + v.x, s.y + v.y);
        ctx.save();
        ctx.setLineDash([3, 4]);
        arrow(ctx, s0.x, s0.y, sx.x, sx.y, c, 1.5, 7);
        arrow(ctx, sx.x, sx.y, se.x, se.y, c, 1.5, 7);
        ctx.restore();
      }
    }

    arrow(ctx, O.x, O.y, Re.x, Re.y, pal['sim-solute'], 4, 14);
    arrow(ctx, O.x, O.y, Ae.x, Ae.y, pal.accent, 3.5, 13);
    arrow(ctx, Bs.x, Bs.y, Be.x, Be.y, pal['accent-2'], 3.5, 13);

    // Drag handles
    for (const [pt, c] of [
      [Ae, pal.accent],
      [p.mode === 'sub' ? P(B.x, B.y) : Be, pal['accent-2']],
    ] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.fillStyle = pal['bg-elev'];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const lbl = { bg: pal['bg-elev'], fg: pal['sim-text'] };
    pill(ctx, 'A', (O.x + Ae.x) / 2 - 14, (O.y + Ae.y) / 2 - 10, lbl, size);
    pill(ctx, p.mode === 'sub' ? '−B' : 'B', (Bs.x + Be.x) / 2 + 14, (Bs.y + Be.y) / 2 - 10, lbl, size);
    pill(ctx, p.mode === 'sub' ? 'R = A − B' : 'R = A + B', (O.x + Re.x) / 2 + 20, (O.y + Re.y) / 2 + 14, lbl, size);

    // Readouts
    const between = Math.abs(((dir(A) - dir(B) + 540) % 360) - 180);
    ui.readout('r', `${mag(r).toFixed(2)}`);
    ui.readout('rdir', mag(r) < 1e-6 ? '—' : `${dir(r).toFixed(1)}°`);
    ui.readout('rcomp', `(${f2(r.x)}, ${f2(r.y)})`);
    ui.readout('a', `(${f2(A.x)}, ${f2(A.y)})`);
    ui.readout('b', `(${f2(B.x)}, ${f2(B.y)})`);
    ui.readout('between', mag(A) && mag(B) ? `${between.toFixed(1)}°` : '—');
    canvas.setAttribute(
      'aria-label',
      `Vector A has magnitude ${mag(A).toFixed(1)} at ${dir(A).toFixed(0)} degrees. Vector B has magnitude ${mag(B).toFixed(1)} at ${dir(B).toFixed(0)} degrees. ` +
        `The resultant ${p.mode === 'sub' ? 'A minus B' : 'A plus B'} has magnitude ${mag(r).toFixed(1)} at ${dir(r).toFixed(0)} degrees.`,
    );
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const syncSliders = () => {
    am.set(+mag(A).toFixed(1), false);
    aa.set(Math.round(dir(A)), false);
    bm.set(+mag(B).toFixed(1), false);
    ba.set(Math.round(dir(B)), false);
  };
  const fromSliders = () => {
    fromPolar(A, am.value, aa.value);
    fromPolar(B, bm.value, ba.value);
    sim.requestRender();
  };
  const am = ui.range('vec-am', (v) => v.toFixed(1), fromSliders);
  const aa = ui.range('vec-aa', (v) => `${v}°`, fromSliders);
  const bm = ui.range('vec-bm', (v) => v.toFixed(1), fromSliders);
  const ba = ui.range('vec-ba', (v) => `${v}°`, fromSliders);
  const modeCtl = ui.choice<Mode>('vec-mode', (v) => ((p.mode = v), sim.requestRender()));
  ui.toggle('vec-comp', (v) => ((p.comp = v), sim.requestRender()));
  ui.toggle('vec-snap', (v) => (p.snap = v));

  root.querySelectorAll<HTMLButtonElement>('[data-arr]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const a = dir(A);
      const k = btn.dataset.arr;
      ba.set(Math.round((k === 'same' ? a : k === 'opp' ? a + 180 : a + 90) % 360), false);
      fromSliders();
    }),
  );

  enableDrag<'A' | 'B'>(canvas, {
    hit: (x, y) => {
      const Ae = P(A.x, A.y);
      const bs = bStart();
      const bv = bVec();
      const Bh = p.mode === 'sub' ? P(B.x, B.y) : P(bs.x + bv.x, bs.y + bv.y);
      if (Math.hypot(x - Bh.x, y - Bh.y) < 20) return 'B';
      if (Math.hypot(x - Ae.x, y - Ae.y) < 20) return 'A';
      return null;
    },
    move: (id, x, y) => {
      const u = U(x, y);
      const snap = (v: number) => clamp(p.snap ? Math.round(v * 2) / 2 : v, -R, R);
      if (id === 'A') {
        A.x = snap(u.x);
        A.y = snap(u.y);
      } else {
        const origin = p.mode === 'sub' || p.mode === 'para' ? { x: 0, y: 0 } : { x: A.x, y: A.y };
        B.x = snap(u.x - origin.x);
        B.y = snap(u.y - origin.y);
      }
      // Keep magnitudes within the slider range (0–8)
      for (const v of [A, B]) {
        const m = mag(v);
        if (m > 8) {
          v.x = (v.x / m) * 8;
          v.y = (v.y / m) * 8;
        }
      }
      syncSliders();
      sim.requestRender();
    },
    click: (x, y) => {
      const u = U(x, y);
      sim.showTooltip(x, y, `Point (${u.x.toFixed(1)}, ${u.y.toFixed(1)})`, 'Drag the circle at the tip of A or B to change that vector. Components add separately: Rx = Ax + Bx and Ry = Ay + By.');
    },
  });

  const sim = createSimController(root, {
    render,
    reset() {
      am.set(DEF.am, false);
      aa.set(DEF.aa, false);
      bm.set(DEF.bm, false);
      ba.set(DEF.ba, false);
      modeCtl.set('tip', false);
      p.mode = 'tip';
      fromPolar(A, DEF.am, DEF.aa);
      fromPolar(B, DEF.bm, DEF.ba);
    },
  });
  sim.requestRender();
}
