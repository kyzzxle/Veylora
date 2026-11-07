/**
 * Calculus lab, in four views on one interactive coordinate plane:
 *   limits     – approach a target from the left and the right; the lab classifies
 *                continuity, removable and jump discontinuities, infinite limits and
 *                oscillation from the numbers it computes.
 *   derivative – a point on the curve with its tangent and a secant; the secant
 *                slope approaches the derivative as h → 0. Optional f′ graph,
 *                increasing/decreasing bands and classified stationary points.
 *   integral   – left, right and midpoint Riemann sums between draggable bounds,
 *                compared with the exact integral (when an antiderivative is known)
 *                or an accurate numerical one.
 *   ftc        – the accumulation function A(x) = ∫ₐˣ f(t) dt, whose slope equals f(x).
 * Functions come from presets or from a safely parsed expression (no eval).
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { PRESETS, type Preset, type View4 } from './data';
import { ExprError, parseExpr } from './expr';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'limits' | 'derivative' | 'integral' | 'ftc';
type Box = { x: number; y: number; w: number; h: number };
type Rule = 'left' | 'mid' | 'right';
const C_F = '#1c7ed6';
const C_D = '#e8590c';
const C_TAN = '#2f9e44';
const C_SEC = '#ae3ec9';
const C_POS = '#4dabf7';
const C_NEG = '#ff922b';

/** Number formatting: up to `sig` significant figures, with “undefined” and ±∞. */
function fmt(v: number, sig = 5): string {
  if (Number.isNaN(v)) return 'undefined';
  if (v === Infinity) return '+∞';
  if (v === -Infinity) return '−∞';
  if (Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) {
    const [m, e] = v.toExponential(sig - 1).split('e');
    return `${(+m).toString().replace('-', '−')} × 10^${+e}`.replace('^-', '^−');
  }
  return (+v.toPrecision(sig)).toString().replace('-', '−');
}

export function initCalculus(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const errEl = root.querySelector<HTMLElement>('[data-expr-err]')!;
  const exprIn = root.querySelector<HTMLInputElement>('[data-expr]')!;
  const fnSel = root.querySelector<HTMLSelectElement>('[data-fn]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    view: 'derivative' as View,
    fid: 'cubic',
    a: 3,
    b: 0,
    grid: true,
    notes: true,
    // limits
    target: 1,
    h: 0.5,
    // derivative
    x0: 1.5,
    dh: 1,
    showTan: true,
    showSec: true,
    showDf: false,
    showIncr: false,
    // integral
    ia: 0,
    ib: 2,
    n: 8,
    rule: 'left' as Rule,
    showExact: false,
    // ftc
    fa: 0,
    fx: 1.5,
  };
  let custom: Preset | null = null;
  let lastMsg = '';
  let v: View4 = [...PRESETS.cubic.view] as View4;
  let anim: null | { kind: View; t: number } = null;
  let t = 0;

  const P = () => (st.fid === 'custom' && custom ? custom : PRESETS[st.fid]);
  const f = (x: number) => {
    const y = P().f(x, st.a, st.b);
    return Number.isFinite(y) ? y : NaN;
  };
  /* ---------- numerical tools ---------- */
  const H = (x: number) => 1e-5 * Math.max(1, Math.abs(x));
  /** Central-difference derivative (error ∝ h²). */
  const numD = (g: (x: number) => number, x: number) => (g(x + H(x)) - g(x - H(x))) / (2 * H(x));
  /** One-sided difference quotients, used to detect corners, cusps and jumps. */
  function diffInfo(x: number) {
    const y = f(x);
    if (!Number.isFinite(y)) return { ok: false, why: 'f is undefined here', d: NaN };
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const dp = (f(x + h) - y) / h;
    const dm = (y - f(x - h)) / h;
    if (!Number.isFinite(dp) || !Number.isFinite(dm)) return { ok: false, why: 'f is undefined on one side', d: NaN };
    if (Math.abs(dp) > 1e5 || Math.abs(dm) > 1e5) return { ok: false, why: 'the tangent is vertical or f jumps', d: NaN };
    if (Math.abs(dp - dm) > 1e-3 * (1 + Math.abs(dp) + Math.abs(dm))) return { ok: false, why: `the left slope (${fmt(dm, 3)}) and right slope (${fmt(dp, 3)}) differ`, d: NaN };
    const pd = P().df;
    return { ok: true, why: '', d: pd ? pd(x, st.a, st.b) : numD(f, x) };
  }
  /** Composite two-point Gauss–Legendre quadrature (never samples the panel edges, so isolated holes do not matter). */
  function gauss(g: (x: number) => number, a: number, b: number, panels = 1000) {
    const w = (b - a) / panels;
    const o = w / (2 * Math.sqrt(3));
    let s = 0;
    let big = 0;
    for (let k = 0; k < panels; k++) {
      const m = a + (k + 0.5) * w;
      const y1 = g(m - o);
      const y2 = g(m + o);
      if (!Number.isFinite(y1) || !Number.isFinite(y2)) return { val: NaN, bad: true };
      big = Math.max(big, Math.abs(y1), Math.abs(y2));
      s += y1 + y2;
    }
    return { val: (s * w) / 2, bad: big > 1e6 };
  }
  /** Is f unbounded somewhere in [a, b]? */
  function unboundedIn(a: number, b: number) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if ((P().sing ?? []).some((s) => s >= lo && s <= hi)) return true;
    return gauss(f, lo, hi, 400).bad;
  }
  /** Definite integral: exact from an antiderivative when one is known, otherwise numerical. */
  function integral(a: number, b: number): { val: number; exact: boolean; ok: boolean } {
    if (a === b) return { val: 0, exact: true, ok: true };
    if (unboundedIn(a, b)) return { val: NaN, exact: false, ok: false };
    const p = P();
    if (p.F) return { val: p.F(b, st.a, st.b) - p.F(a, st.a, st.b), exact: true, ok: true };
    const r = gauss(f, a, b);
    return { val: r.val, exact: false, ok: Number.isFinite(r.val) };
  }
  function riemann(a: number, b: number, n: number, rule: Rule) {
    const dx = (b - a) / n;
    let s = 0;
    for (let k = 0; k < n; k++) {
      const x = a + (k + (rule === 'left' ? 0 : rule === 'mid' ? 0.5 : 1)) * dx;
      const y = f(x);
      if (!Number.isFinite(y)) return NaN;
      s += y * dx;
    }
    return s;
  }
  /** Numerical one-sided limit: f at x = a ∓ 10⁻ᵏ. */
  function sideLimit(a: number, dir: -1 | 1) {
    const vals = [1, 2, 3, 4, 5, 6, 7].map((k) => f(a + dir * 10 ** -k * Math.max(1, Math.abs(a))));
    const last = vals.slice(-3);
    if (last.some((q) => !Number.isFinite(q))) return { kind: 'undef' as const, L: NaN };
    if (Math.abs(last[2]) > 1e5 && Math.abs(last[2]) > Math.abs(last[1]) && Math.abs(last[1]) > Math.abs(last[0])) return { kind: 'inf' as const, L: Math.sign(last[2]) * Infinity };
    const tol = (q: number) => 1e-3 * (1 + Math.abs(q));
    if (Math.abs(last[2] - last[1]) < tol(last[2]) && Math.abs(last[1] - last[0]) < 10 * tol(last[2])) {
      // Richardson extrapolation: the error is usually proportional to h, and h shrinks 10× per step
      const L = (10 * last[2] - last[1]) / 9;
      return { kind: 'num' as const, L: Math.abs(L) < 1e-9 ? 0 : L };
    }
    return { kind: 'osc' as const, L: NaN };
  }
  function limitReport(a: number) {
    const Lm = sideLimit(a, -1);
    const Lp = sideLimit(a, 1);
    const fa = f(a);
    const near = (p: number, q: number) => Math.abs(p - q) < 2e-3 * (1 + Math.abs(p));
    let verdict = '';
    let tone: 'ok' | 'warn' | 'bad' = 'ok';
    let L = NaN;
    if (Lm.kind === 'num' && Lp.kind === 'num' && near(Lm.L, Lp.L)) {
      L = (Lm.L + Lp.L) / 2;
      if (Number.isFinite(fa) && near(fa, L)) verdict = `The limit is ≈ ${fmt(L)} and equals f(${fmt(a)}): f is continuous here.`;
      else if (Number.isFinite(fa)) {
        verdict = `The limit is ≈ ${fmt(L)}, but f(${fmt(a)}) = ${fmt(fa)}. The limit exists, yet it is not the function’s value: a removable discontinuity.`;
        tone = 'warn';
      } else {
        verdict = `The limit is ≈ ${fmt(L)}, even though f(${fmt(a)}) is undefined: a removable discontinuity (a hole).`;
        tone = 'warn';
      }
    } else if (Lm.kind === 'num' && Lp.kind === 'num') {
      verdict = `The left-hand limit (≈ ${fmt(Lm.L)}) and right-hand limit (≈ ${fmt(Lp.L)}) are different, so the two-sided limit does not exist: a jump discontinuity.`;
      tone = 'bad';
    } else if (Lm.kind === 'inf' && Lp.kind === 'inf') {
      verdict =
        Lm.L === Lp.L
          ? `f grows without bound (${Lm.L > 0 ? '+∞' : '−∞'}) from both sides: a vertical asymptote. We write lim = ${Lm.L > 0 ? '+∞' : '−∞'}, but there is no finite limit.`
          : `f goes to ${fmt(Lm.L)} from the left and ${fmt(Lp.L)} from the right: a vertical asymptote, and no limit exists.`;
      tone = 'bad';
    } else if (Lm.kind === 'osc' || Lp.kind === 'osc') {
      verdict = 'The values keep jumping around instead of settling as x gets closer, so the limit does not exist (oscillation).';
      tone = 'bad';
    } else if (Lm.kind === 'undef' || Lp.kind === 'undef') {
      verdict = `f is undefined on ${Lm.kind === 'undef' && Lp.kind === 'undef' ? 'both sides' : Lm.kind === 'undef' ? 'the left' : 'the right'} of x = ${fmt(a)}, so ${Lm.kind === 'undef' && Lp.kind === 'undef' ? 'no limit can be found' : 'only a one-sided limit can exist'}.`;
      tone = 'bad';
    } else {
      verdict = 'One side settles and the other does not, so the two-sided limit does not exist.';
      tone = 'bad';
    }
    return { Lm, Lp, fa, L, verdict, tone };
  }
  /** Stationary points and corners in view, found from sign changes of f′. */
  function criticalPoints() {
    const out: { x: number; kind: string }[] = [];
    const p = P();
    const d = (x: number) => (p.df ? p.df(x, st.a, st.b) : numD(f, x));
    const N = 600;
    let px = v[0];
    let pd = d(px);
    for (let i = 1; i <= N; i++) {
      const x = v[0] + ((v[1] - v[0]) * i) / N;
      const dd = d(x);
      if (Number.isFinite(pd) && Number.isFinite(dd) && pd !== 0 && Math.sign(pd) !== Math.sign(dd)) {
        // bisect for the change of sign
        let lo = px;
        let hi = x;
        for (let k = 0; k < 50; k++) {
          const m = (lo + hi) / 2;
          if (Math.sign(d(m)) === Math.sign(pd)) lo = m;
          else hi = m;
        }
        const xs = (lo + hi) / 2;
        const ys = f(xs);
        const ext = pd > 0 ? 'local maximum' : 'local minimum';
        const corner = !diffInfo(xs).ok;
        if (Number.isFinite(ys) && Number.isFinite(f(xs - 1e-3)) && Number.isFinite(f(xs + 1e-3)) && Math.abs(f(xs - 1e-3) - ys) < 0.1 && Math.abs(f(xs + 1e-3) - ys) < 0.1)
          out.push({ x: Math.abs(xs) < 1e-9 ? 0 : xs, kind: corner ? `${ext} at a corner (f′ does not exist)` : `stationary point: ${ext}` });
      } else if (Number.isFinite(dd) && Math.abs(dd) < 1e-9 && i < N) {
        // f′ = 0 exactly at a sample: check whether it changes sign
        const l = d(x - 1e-3);
        const r = d(x + 1e-3);
        if (Math.sign(l) === Math.sign(r) && l !== 0) out.push({ x, kind: 'stationary point, but neither a maximum nor a minimum (f′ keeps its sign)' });
      }
      px = x;
      pd = dd;
    }
    return out.filter((c, i) => i === 0 || Math.abs(c.x - out[i - 1].x) > 1e-6);
  }

  /* ======================= 2D helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const toBox = (x: number, y: number): [number, number] => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  let cur = 1;
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(s: string, x: number, y: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600, maxY = Infinity) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    let line = '';
    for (const w of s.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        if (y + lh > maxY) {
          ctx.fillText(`${line}…`, x, y);
          return y + lh;
        }
        ctx.fillText(line, x, y);
        line = w;
        y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lh;
  }
  function panel(B: Box, fill = pal['bg-elev']) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(B.x, B.y, B.w, B.h, 10);
    ctx.fill();
    ctx.stroke();
  }
  function pill(s: string, x: number, y: number, align: CanvasTextAlign = 'left', px = 11, color = pal['sim-text']) {
    ctx.font = fs(px, 700);
    const w = ctx.measureText(s).width;
    const pad = 5 / cur;
    const hh = (px + 7) / cur;
    const x0 = align === 'left' ? x - pad : align === 'right' ? x - w - pad : x - w / 2 - pad;
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.92);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x0, y - 4 / cur - hh / 2, w + 2 * pad, hh, hh / 2);
    ctx.fill();
    ctx.stroke();
    text(s, x, y, px, color, align, 700);
  }
  function dot(x: number, y: number, r: number, fill: string | null, stroke: string | null = null, lw = 2) {
    ctx.beginPath();
    ctx.arc(x, y, r / cur, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw / cur;
      ctx.stroke();
    }
  }

  /* ======================= Plot frame ======================= */
  const layout = () =>
    portrait() ? { plot: { x: 14, y: 104, w: 652, h: 486 }, side: { x: 14, y: 602, w: 652, h: 386 } } : { plot: { x: 14, y: 14, w: 640, h: 572 }, side: { x: 666, y: 70, w: 320, h: 516 } };
  let PL: Box = { x: 0, y: 0, w: 1, h: 1 };
  let vy: [number, number] = [v[2], v[3]]; // y-range of the current sub-plot
  const PX = (x: number) => PL.x + ((x - v[0]) / (v[1] - v[0])) * PL.w;
  const PY = (y: number) => PL.y + PL.h - ((y - vy[0]) / (vy[1] - vy[0])) * PL.h;
  const XP = (px: number) => v[0] + ((px - PL.x) / PL.w) * (v[1] - v[0]);
  const YP = (py: number) => vy[0] + ((PL.y + PL.h - py) / PL.h) * (vy[1] - vy[0]);
  /** A “nice” tick step for a range. */
  const niceStep = (span: number, target: number) => {
    const raw = span / target;
    const p = 10 ** Math.floor(Math.log10(raw));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };
  function axes(xLabel = 'x', yLabel = 'y') {
    ctx.fillStyle = pal['surface-2'];
    ctx.fillRect(PL.x, PL.y, PL.w, PL.h);
    const sx = niceStep(v[1] - v[0], PL.w / 70);
    const sy = niceStep(vy[1] - vy[0], PL.h / 55);
    const tickLab = (q: number, step: number) => fmt(Math.round(q / step) * step, 4);
    if (st.grid) {
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.22);
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      for (let x = Math.ceil(v[0] / sx) * sx; x <= v[1]; x += sx) {
        ctx.moveTo(PX(x), PL.y);
        ctx.lineTo(PX(x), PL.y + PL.h);
      }
      for (let y = Math.ceil(vy[0] / sy) * sy; y <= vy[1]; y += sy) {
        ctx.moveTo(PL.x, PY(y));
        ctx.lineTo(PL.x + PL.w, PY(y));
      }
      ctx.stroke();
    }
    // axes through the origin (or along the edge when the origin is off-screen)
    const ax = clamp(PY(0), PL.y, PL.y + PL.h);
    const ay = clamp(PX(0), PL.x, PL.x + PL.w);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5 / cur;
    ctx.beginPath();
    ctx.moveTo(PL.x, ax);
    ctx.lineTo(PL.x + PL.w, ax);
    ctx.moveTo(ay, PL.y);
    ctx.lineTo(ay, PL.y + PL.h);
    ctx.stroke();
    const below = ax + 14 / cur > PL.y + PL.h - 2 / cur;
    for (let x = Math.ceil(v[0] / sx) * sx; x <= v[1] + 1e-9; x += sx) {
      if (Math.abs(x) < sx / 2) continue;
      text(tickLab(x, sx), PX(x), below ? ax - 5 / cur : ax + 13 / cur, 9.5, pal['text-faint'], 'center', 600);
    }
    const left = ay - 30 / cur < PL.x;
    for (let y = Math.ceil(vy[0] / sy) * sy; y <= vy[1] + 1e-9; y += sy) {
      if (Math.abs(y) < sy / 2) continue;
      text(tickLab(y, sy), left ? ay + 4 / cur : ay - 4 / cur, PY(y) + 3 / cur, 9.5, pal['text-faint'], left ? 'left' : 'right', 600);
    }
    text(xLabel, PL.x + PL.w - 6 / cur, ax - 6 / cur, 11, pal['text-muted'], 'right', 750);
    text(yLabel, ay + 6 / cur, PL.y + 14 / cur, 11, pal['text-muted'], 'left', 750);
  }
  /** Draw y = g(x) across the view, breaking at gaps, asymptotes and jumps. */
  function curve(g: (x: number) => number, color: string, lw = 2.5, dash: number[] = []) {
    const N = Math.max(300, Math.round(PL.w * cur * 1.2));
    const span = vy[1] - vy[0];
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw / cur;
    ctx.setLineDash(dash.map((d) => d / cur));
    ctx.beginPath();
    let pen = false;
    let px = NaN;
    let py = NaN;
    for (let i = 0; i <= N; i++) {
      const x = v[0] + ((v[1] - v[0]) * i) / N;
      const y = g(x);
      if (!Number.isFinite(y) || Math.abs(y) > 1e6) {
        pen = false;
        px = NaN;
        continue;
      }
      if (pen && Number.isFinite(py)) {
        const ym = g((x + px) / 2);
        const jump = Math.abs(y - py) > 0.04 * span && (!Number.isFinite(ym) || Math.abs(ym - (y + py) / 2) > 0.4 * Math.abs(y - py));
        if (jump || Math.abs(y - py) > 3 * span) pen = false;
      }
      const sy = clamp(PY(y), PL.y - 4 * PL.h, PL.y + 5 * PL.h);
      if (pen) ctx.lineTo(PX(x), sy);
      else ctx.moveTo(PX(x), sy);
      pen = true;
      px = x;
      py = y;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  function markers() {
    const p = P();
    for (const [x, y] of p.holes?.(st.a, st.b) ?? []) if (x >= v[0] && x <= v[1]) dot(PX(x), PY(y), 5, pal['surface-2'], C_F, 2.5);
    for (const [x, y] of p.dots?.(st.a, st.b) ?? []) if (x >= v[0] && x <= v[1]) dot(PX(x), PY(y), 5, C_F);
    for (const s of p.sing ?? []) {
      if (s < v[0] || s > v[1]) continue;
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.7);
      ctx.setLineDash([5 / cur, 5 / cur]);
      ctx.lineWidth = 1.2 / cur;
      ctx.beginPath();
      ctx.moveTo(PX(s), PL.y);
      ctx.lineTo(PX(s), PL.y + PL.h);
      ctx.stroke();
      ctx.setLineDash([]);
      if (st.notes) text(`x = ${fmt(s)}`, PX(s) + 4 / cur, PL.y + 28 / cur, 9.5, pal['text-faint'], 'left', 650);
    }
  }
  const inView = (x: number, y: number) => x >= v[0] && x <= v[1] && y >= vy[0] && y <= vy[1];
  function line(x1: number, y1: number, x2: number, y2: number, color: string, lw = 2, dash: number[] = []) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw / cur;
    ctx.setLineDash(dash.map((d) => d / cur));
    ctx.beginPath();
    ctx.moveTo(PX(x1), PY(y1));
    ctx.lineTo(PX(x2), PY(y2));
    ctx.stroke();
    ctx.restore();
  }
  /** A handle on the x-axis (bounds and targets). */
  function axisHandle(x: number, label: string, color: string) {
    const ay = clamp(PY(0), PL.y + 10 / cur, PL.y + PL.h - 10 / cur);
    const px = PX(x);
    if (px < PL.x - 1 || px > PL.x + PL.w + 1) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px, ay);
    ctx.lineTo(px - 8 / cur, ay + 14 / cur);
    ctx.lineTo(px + 8 / cur, ay + 14 / cur);
    ctx.closePath();
    ctx.fill();
    text(label, px, ay + 27 / cur, 11, color, 'center', 800);
  }
  const handles: { id: string; x: number; y: number }[] = [];

  /* ======================= Views ======================= */
  function drawLimits() {
    axes();
    const a = st.target;
    const h = st.h;
    const R = limitReport(a);
    // target line
    line(a, vy[0], a, vy[1], withAlpha(pal['text-muted'], 0.6), 1.2, [6, 5]);
    if (Number.isFinite(R.L) && st.notes) line(v[0], R.L, v[1], R.L, withAlpha(C_TAN, 0.7), 1.2, [6, 5]);
    curve(f, C_F);
    markers();
    const yl = f(a - h);
    const yr = f(a + h);
    for (const [x, y, c, id] of [
      [a - h, yl, C_SEC, 'L'],
      [a + h, yr, C_D, 'R'],
    ] as [number, number, string, string][]) {
      if (!Number.isFinite(y)) continue;
      const cy = clamp(PY(y), PL.y, PL.y + PL.h);
      line(x, y, x, 0, withAlpha(c, 0.5), 1, [3, 3]);
      dot(PX(x), cy, 7, c, '#ffffff', 2);
      handles.push({ id, x: PX(x), y: cy });
      if (st.notes) pill(`f(${fmt(x, 4)}) = ${fmt(y, 4)}`, PX(x) + (id === 'L' ? -10 / cur : 10 / cur), cy - 14 / cur, id === 'L' ? 'right' : 'left', 10.5, c);
    }
    axisHandle(a, `a = ${fmt(a, 3)}`, pal.accent);
    handles.push({ id: 'target', x: PX(a), y: clamp(PY(0), PL.y + 10 / cur, PL.y + PL.h - 10 / cur) + 8 / cur });
    if (Number.isFinite(R.L) && st.notes && inView(a, R.L)) pill(`L ≈ ${fmt(R.L, 4)}`, PX(a) + 10 / cur, PY(R.L) + 18 / cur, 'left', 10.5, C_TAN);
  }
  function drawDerivative() {
    axes();
    const p = P();
    const x0 = st.x0;
    const y0 = f(x0);
    if (st.showIncr) {
      // increasing / decreasing bands along the bottom
      const N = 300;
      const d = (x: number) => (p.df ? p.df(x, st.a, st.b) : numD(f, x));
      for (let i = 0; i < N; i++) {
        const x = v[0] + ((v[1] - v[0]) * (i + 0.5)) / N;
        const dd = d(x);
        ctx.fillStyle = !Number.isFinite(dd) || !Number.isFinite(f(x)) ? withAlpha(pal['text-faint'], 0.25) : Math.abs(dd) < 1e-9 ? pal['text-faint'] : dd > 0 ? withAlpha(C_TAN, 0.65) : withAlpha('#e03131', 0.65);
        ctx.fillRect(PL.x + (PL.w * i) / N, PL.y + PL.h - 10 / cur, PL.w / N + 0.5, 10 / cur);
      }
    }
    if (st.showDf) curve((x) => (p.df ? p.df(x, st.a, st.b) : numD(f, x)), C_D, 2, [7, 5]);
    curve(f, C_F);
    markers();
    if (st.showIncr)
      for (const c of criticalPoints()) {
        const yc = f(c.x);
        if (!inView(c.x, yc)) continue;
        dot(PX(c.x), PY(yc), 5, pal['text-muted'], '#ffffff', 1.5);
        if (st.notes) text(c.kind.startsWith('stationary point: local max') ? 'max' : c.kind.startsWith('stationary point: local min') ? 'min' : c.kind.includes('corner') ? 'corner' : 'f′ = 0', PX(c.x), PY(yc) + (c.kind.includes('max') ? -12 : 20) / cur, 10, pal['text-muted'], 'center', 750);
      }
    if (!Number.isFinite(y0)) return;
    const info = diffInfo(x0);
    if (st.showTan && info.ok) {
      const span = (v[1] - v[0]) * 0.35;
      line(x0 - span, y0 - info.d * span, x0 + span, y0 + info.d * span, C_TAN, 2.5);
    }
    const dh = st.dh;
    const y1 = f(x0 + dh);
    if (st.showSec && Number.isFinite(y1)) {
      const m = (y1 - y0) / dh;
      const span = (v[1] - v[0]) * 0.6;
      line(x0 - span, y0 - m * span, x0 + span, y0 + m * span, withAlpha(C_SEC, 0.8), 1.8, [7, 5]);
      if (st.notes && inView(x0 + dh, y1)) {
        line(x0, y0, x0 + dh, y0, withAlpha(C_SEC, 0.8), 1.2, [3, 3]);
        line(x0 + dh, y0, x0 + dh, y1, withAlpha(C_SEC, 0.8), 1.2, [3, 3]);
        text(`h = ${fmt(dh, 3)}`, PX(x0 + dh / 2), PY(y0) + (y1 > y0 ? 14 : -6) / cur, 10, C_SEC, 'center', 750);
      }
      const qy = clamp(PY(y1), PL.y, PL.y + PL.h);
      dot(PX(x0 + dh), qy, 6.5, C_SEC, '#ffffff', 2);
      handles.push({ id: 'Q', x: PX(x0 + dh), y: qy });
    }
    const py = clamp(PY(y0), PL.y, PL.y + PL.h);
    dot(PX(x0), py, 8, C_F, '#ffffff', 2.5);
    handles.push({ id: 'P', x: PX(x0), y: py });
    if (st.notes) pill(info.ok ? `slope ${fmt(info.d, 4)}` : 'no tangent slope here', PX(x0) + 12 / cur, py - 16 / cur, 'left', 10.5, info.ok ? C_TAN : pal.danger);
  }
  function drawIntegral() {
    axes();
    const a = Math.min(st.ia, st.ib);
    const b = Math.max(st.ia, st.ib);
    const n = st.n;
    const dx = (b - a) / n;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    if (st.showExact && !unboundedIn(a, b)) {
      // exact signed region under the curve
      const N = 300;
      for (let i = 0; i < N; i++) {
        const x = a + ((b - a) * (i + 0.5)) / N;
        const y = f(x);
        if (!Number.isFinite(y)) continue;
        ctx.fillStyle = withAlpha(y >= 0 ? C_POS : C_NEG, 0.28);
        const x1 = PX(a + ((b - a) * i) / N);
        const x2 = PX(a + ((b - a) * (i + 1)) / N);
        ctx.fillRect(x1, Math.min(PY(y), PY(0)), x2 - x1 + 0.3, Math.abs(PY(y) - PY(0)));
      }
    }
    for (let k = 0; k < n; k++) {
      const xs = a + (k + (st.rule === 'left' ? 0 : st.rule === 'mid' ? 0.5 : 1)) * dx;
      const y = f(xs);
      if (!Number.isFinite(y)) continue;
      const x1 = PX(a + k * dx);
      const x2 = PX(a + (k + 1) * dx);
      const top = Math.min(PY(y), PY(0));
      const hgt = Math.abs(PY(y) - PY(0));
      ctx.fillStyle = withAlpha(y >= 0 ? C_POS : C_NEG, st.showExact ? 0.3 : 0.5);
      ctx.fillRect(x1, top, x2 - x1, hgt);
      if (n <= 60) {
        ctx.strokeStyle = withAlpha(y >= 0 ? '#1864ab' : '#d9480f', 0.9);
        ctx.lineWidth = 1 / cur;
        ctx.strokeRect(x1, top, x2 - x1, hgt);
        if (n <= 30) dot(PX(xs), PY(y), 3, y >= 0 ? '#1864ab' : '#d9480f');
      }
    }
    ctx.restore();
    curve(f, C_F);
    markers();
    axisHandle(st.ia, st.ia <= st.ib ? `a = ${fmt(st.ia, 3)}` : `b = ${fmt(st.ia, 3)}`, '#2b8a3e');
    axisHandle(st.ib, st.ib >= st.ia ? `b = ${fmt(st.ib, 3)}` : `a = ${fmt(st.ib, 3)}`, '#c2255c');
    const hy = clamp(PY(0), PL.y + 10 / cur, PL.y + PL.h - 10 / cur) + 8 / cur;
    handles.push({ id: 'ia', x: PX(st.ia), y: hy }, { id: 'ib', x: PX(st.ib), y: hy });
  }
  /** A(x) = ∫ₐˣ f(t) dt on a grid across the view (exact when F is known). */
  function accumulation() {
    const N = 400;
    const a = st.fa;
    const p = P();
    const xs = Array.from({ length: N + 1 }, (_, i) => v[0] + ((v[1] - v[0]) * i) / N);
    const between = (x: number) => (p.sing ?? []).some((s) => s >= Math.min(a, x) && s <= Math.max(a, x));
    if (p.F && st.fid !== 'custom') {
      const Fa = p.F(a, st.a, st.b);
      return { xs, As: xs.map((x) => (between(x) ? NaN : p.F!(x, st.a, st.b) - Fa)) };
    }
    // numerically: integrate each grid segment, then add them up outwards from a
    const seg: number[] = [];
    const bad: boolean[] = [];
    for (let i = 0; i < N; i++) {
      const r = gauss(f, xs[i], xs[i + 1], 4);
      seg.push(r.val);
      bad.push(r.bad || !Number.isFinite(r.val));
    }
    const As = new Array<number>(N + 1).fill(NaN);
    const ia = clamp(Math.floor(((a - v[0]) / (v[1] - v[0])) * N), 0, N);
    const start = integral(a, xs[ia]);
    if (!start.ok) return { xs, As };
    As[ia] = start.val;
    for (let i = ia + 1; i <= N; i++) As[i] = bad[i - 1] || !Number.isFinite(As[i - 1]) ? NaN : As[i - 1] + seg[i - 1];
    for (let i = ia - 1; i >= 0; i--) As[i] = bad[i] || !Number.isFinite(As[i + 1]) ? NaN : As[i + 1] - seg[i];
    return { xs, As };
  }
  const Aof = (x: number) => {
    const r = integral(st.fa, x);
    return r.ok ? r.val : NaN;
  };
  function drawFTC(B: Box) {
    const gap = 26;
    const top: Box = { x: B.x, y: B.y, w: B.w, h: (B.h - gap) * 0.52 };
    const bot: Box = { x: B.x, y: B.y + top.h + gap, w: B.w, h: B.h - top.h - gap };
    // top: f with the accumulated region
    PL = top;
    vy = [v[2], v[3]];
    axes('t', 'f(t)');
    const a = st.fa;
    const x = st.fx;
    const ok = !unboundedIn(a, x);
    if (ok) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(PL.x, PL.y, PL.w, PL.h);
      ctx.clip();
      const N = 300;
      const lo = Math.min(a, x);
      const hi = Math.max(a, x);
      for (let i = 0; i < N; i++) {
        const tt = lo + ((hi - lo) * (i + 0.5)) / N;
        const y = f(tt);
        if (!Number.isFinite(y)) continue;
        // area counts negatively when x < a (the integral runs backwards)
        const pos = (y >= 0) === x >= a;
        ctx.fillStyle = withAlpha(pos ? C_POS : C_NEG, 0.45);
        const x1 = PX(lo + ((hi - lo) * i) / N);
        const x2 = PX(lo + ((hi - lo) * (i + 1)) / N);
        ctx.fillRect(x1, Math.min(PY(y), PY(0)), x2 - x1 + 0.3, Math.abs(PY(y) - PY(0)));
      }
      ctx.restore();
    }
    curve(f, C_F);
    markers();
    axisHandle(a, `a = ${fmt(a, 3)}`, '#2b8a3e');
    const hy = clamp(PY(0), PL.y + 10 / cur, PL.y + PL.h - 10 / cur) + 8 / cur;
    handles.push({ id: 'fa', x: PX(a), y: hy });
    const fxv = f(x);
    line(x, vy[0], x, vy[1], withAlpha(C_D, 0.6), 1.2, [5, 4]);
    if (Number.isFinite(fxv)) dot(PX(x), clamp(PY(fxv), PL.y, PL.y + PL.h), 7, C_D, '#ffffff', 2);
    handles.push({ id: 'fx', x: PX(x), y: clamp(PY(Number.isFinite(fxv) ? fxv : 0), PL.y, PL.y + PL.h) });
    text('f(t), with the area from a to x shaded', PL.x + 8 / cur, PL.y + 16 / cur, 10.5, pal['text-muted'], 'left', 750);
    // bottom: A(x)
    PL = bot;
    const { xs, As } = accumulation();
    const fin = As.filter((q) => Number.isFinite(q));
    let lo = Math.min(0, ...fin);
    let hi = Math.max(0, ...fin);
    if (hi - lo < 1e-6) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.12;
    vy = [lo - pad, hi + pad];
    axes('x', 'A(x)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    ctx.strokeStyle = '#7048e8';
    ctx.lineWidth = 2.5 / cur;
    ctx.beginPath();
    let pen = false;
    xs.forEach((xx, i) => {
      const A = As[i];
      if (!Number.isFinite(A)) {
        pen = false;
        return;
      }
      if (pen) ctx.lineTo(PX(xx), PY(A));
      else ctx.moveTo(PX(xx), PY(A));
      pen = true;
    });
    ctx.stroke();
    ctx.restore();
    const Ax = Aof(x);
    if (Number.isFinite(Ax) && Number.isFinite(fxv)) {
      const span = (v[1] - v[0]) * 0.18;
      line(x - span, Ax - fxv * span, x + span, Ax + fxv * span, C_TAN, 2.5);
      dot(PX(x), PY(Ax), 7, '#7048e8', '#ffffff', 2);
      if (st.notes) pill(`slope of A = f(x) ≈ ${fmt(fxv, 4)}`, PX(x) + 12 / cur, PY(Ax) - 14 / cur, PX(x) > PL.x + PL.w * 0.6 ? 'right' : 'left', 10.5, C_TAN);
    }
    text('A(x) = ∫ₐˣ f(t) dt', PL.x + 8 / cur, PL.y + 16 / cur, 10.5, '#7048e8', 'left', 800);
  }

  /* ======================= Side panel ======================= */
  function drawSide(B: Box) {
    panel(B);
    const two = portrait();
    const x0 = B.x + 12;
    const cw = B.w - 24;
    const k2 = two ? 2 : 1; // spread table columns across the wide portrait panel
    let y = B.y + 22;
    const ln = (s: string, col = pal['text-muted'], px = 11, wt = 650, xx = x0, w = cw) => {
      y = wrap(s, xx, y, w, px, col, wt, B.y + B.h - 6);
    };
    const p = P();
    ln(p.tex(st.a, st.b), C_F, 12, 800, x0, B.w - 24);
    y += 2 / cur;
    const tbl = (rows: string[][], cols: number[], xx = x0) => {
      for (const [r, row] of rows.entries()) {
        row.forEach((cell, c) => text(cell, xx + cols[c], y, 10.5, r === 0 ? pal['sim-text'] : pal['text-muted'], 'left', r === 0 ? 800 : 650));
        y += 16 / cur;
      }
    };
    if (st.view === 'limits') {
      const a = st.target;
      ln(`lim as x → ${fmt(a, 3)} of f(x)`, pal['sim-text'], 11.5, 800);
      const hs = [1, 0.1, 0.01, 0.001, 0.0001];
      const cs = [0, 62, 150, 212].map((c) => c * k2);
      tbl([['x (left)', 'f(x)', 'x (right)', 'f(x)'], ...hs.map((h) => [fmt(a - h, 6), fmt(f(a - h), 5), fmt(a + h, 6), fmt(f(a + h), 5)])], cs);
      y += 4 / cur;
      const R = limitReport(a);
      ln(R.verdict, R.tone === 'ok' ? pal.success : R.tone === 'warn' ? pal.warning : pal.danger, 11, 700);
      ln('Numbers are computed at x = a ± 10⁻ᵏ; a computer can only estimate a limit, not prove it.', pal['text-faint'], 9.5);
    } else if (st.view === 'derivative') {
      ln('f′(x) = lim h→0 [f(x + h) − f(x)] / h', pal['sim-text'], 11.5, 800);
      const x0v = st.x0;
      const rows = [['h', 'secant slope']];
      for (const h of [1, 0.5, 0.1, 0.01, 0.001]) {
        const m = (f(x0v + h) - f(x0v)) / h;
        rows.push([fmt(h), fmt(m, 6)]);
      }
      tbl(rows, [0, 70 * k2]);
      const info = diffInfo(x0v);
      ln(info.ok ? `Tangent slope at x = ${fmt(x0v, 4)}: ${fmt(info.d, 6)} ${p.df ? '(exact formula)' : '(numerical, central difference)'}` : `No derivative at x = ${fmt(x0v, 4)}: ${info.why}.`, info.ok ? C_TAN : pal.danger, 11, 750);
      if (p.dtex) ln(p.dtex(st.a, st.b), C_D, 10.5, 700);
      if (st.showIncr) {
        const cps = criticalPoints();
        ln(cps.length ? cps.slice(0, 3).map((c) => `x ≈ ${fmt(c.x, 4)}: ${c.kind}`).join('. ') : 'No stationary points or corners in view.', pal['text-muted'], 10);
      }
    } else if (st.view === 'integral') {
      const a = Math.min(st.ia, st.ib);
      const b = Math.max(st.ia, st.ib);
      ln(`∫[${fmt(a, 3)}, ${fmt(b, 3)}] f(x) dx`, pal['sim-text'], 11.5, 800);
      ln(`Δx = (b − a)/n = ${fmt((b - a) / st.n, 4)}; sum = Σ f(xᵢ*)·Δx`, pal['text-muted'], 10.5);
      const rows = [['n', 'left', 'midpoint', 'right']];
      for (const n of [4, 10, 50, 100, 1000]) rows.push([`${n}`, fmt(riemann(a, b, n, 'left'), 4), fmt(riemann(a, b, n, 'mid'), 4), fmt(riemann(a, b, n, 'right'), 4)]);
      tbl(rows, [0, 40, 126, 212].map((c) => c * k2));
      const I = integral(a, b);
      ln(I.ok ? `${I.exact ? 'Exact' : 'Numerical'} value: ${fmt(I.val, 7)}${I.exact ? ' (from F(b) − F(a))' : ' (Gauss–Legendre, 1000 panels)'}` : 'f is unbounded on this interval, so the ordinary definite integral does not exist (it is improper).', I.ok ? C_TAN : pal.danger, 11, 750);
      if (p.Ftex) ln(`Indefinite integral: ${p.Ftex(st.a, st.b)}`, pal['text-muted'], 10.5, 650);
    } else {
      ln('d/dx [ ∫ₐˣ f(t) dt ] = f(x)', pal['sim-text'], 12, 800);
      const x = st.fx;
      const A = Aof(x);
      const h = 1e-4;
      const dA = (Aof(x + h) - Aof(x - h)) / (2 * h);
      ln(`A(${fmt(x, 3)}) = ${fmt(A, 6)}`, '#7048e8', 11, 750);
      ln(`Slope of A at x (numerical): ${fmt(dA, 6)}`, C_TAN, 11, 750);
      ln(`f(${fmt(x, 3)}) = ${fmt(f(x), 6)}`, C_F, 11, 750);
      y += 4 / cur;
      ln('This holds when f is continuous on an interval containing a and x. Where f jumps, A has a corner; where f is unbounded, A is not defined.', pal['text-faint'], 10);
    }
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    const { k, ox, oy } = tf();
    cur = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const L = layout();
    handles.length = 0;
    PL = L.plot;
    vy = [v[2], v[3]];
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PL.x, PL.y, PL.w, PL.h, 10);
    ctx.clip();
    if (st.view === 'limits') drawLimits();
    else if (st.view === 'derivative') drawDerivative();
    else if (st.view === 'integral') drawIntegral();
    else drawFTC(L.plot);
    ctx.restore();
    drawSide(L.side);
    ctx.restore();
    updateUi();
  }

  /* ======================= Readouts ======================= */
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    const p = P();
    let note = lastMsg;
    if (st.view === 'limits') {
      const a = st.target;
      const R = limitReport(a);
      const side = (q: ReturnType<typeof sideLimit>) => (q.kind === 'num' ? `≈ ${fmt(q.L)}` : q.kind === 'inf' ? fmt(q.L) : q.kind === 'osc' ? 'does not settle' : 'undefined');
      r('r1', 'Target', `x → ${fmt(a)}`);
      r('r2', `From the left, f(${fmt(a - st.h, 5)})`, fmt(f(a - st.h)));
      r('r3', `From the right, f(${fmt(a + st.h, 5)})`, fmt(f(a + st.h)));
      r('r4', 'Left · right limit (numerical)', `${side(R.Lm)} · ${side(R.Lp)}`);
      r('r5', `Actual value f(${fmt(a)})`, fmt(R.fa), Number.isFinite(R.fa) ? null : 'warn');
      r('r6', 'Two-sided limit', Number.isFinite(R.L) ? `≈ ${fmt(R.L)}` : 'Does not exist', Number.isFinite(R.L) ? 'ok' : 'bad');
      note ||= R.verdict;
      sim.setBadge('Limits');
    } else if (st.view === 'derivative') {
      const x0 = st.x0;
      const y0 = f(x0);
      const info = diffInfo(x0);
      const m = (f(x0 + st.dh) - y0) / st.dh;
      const beh = !info.ok ? 'Not differentiable here' : Math.abs(info.d) < 1e-6 ? 'Locally horizontal (f′ = 0)' : info.d > 0 ? 'Increasing (f′ > 0)' : 'Decreasing (f′ < 0)';
      r('r1', 'Point P', Number.isFinite(y0) ? `(${fmt(x0, 4)}, ${fmt(y0, 4)})` : `f(${fmt(x0, 4)}) undefined`);
      r('r2', `Secant slope (h = ${fmt(st.dh, 3)})`, fmt(m, 6));
      r('r3', 'Tangent slope f′(x)', info.ok ? fmt(info.d, 6) : 'Does not exist', info.ok ? 'ok' : 'bad');
      r('r4', 'Secant − tangent', info.ok ? fmt(m - info.d, 4) : '—');
      r('r5', 'Behaviour at P', beh, info.ok ? null : 'warn');
      r('r6', 'f′ method', p.df ? 'Exact formula' : 'Numerical (central difference)');
      if (!note) {
        if (!info.ok) note = `There is no tangent slope at x = ${fmt(x0, 4)} because ${info.why}. A function must be smooth (no corner, cusp, jump or gap) to have a derivative.`;
        else note = `As h shrinks, the secant slope ${fmt(m, 4)} gets closer to the tangent slope ${fmt(info.d, 4)}. Drag P along the curve and Q towards P.`;
      }
      sim.setBadge('Derivatives');
    } else if (st.view === 'integral') {
      const a = Math.min(st.ia, st.ib);
      const b = Math.max(st.ia, st.ib);
      const S = riemann(a, b, st.n, st.rule);
      const I = integral(a, b);
      const geo = I.ok ? gauss((x) => Math.abs(f(x)), a, b).val : NaN;
      const ruleName = { left: 'left', mid: 'midpoint', right: 'right' }[st.rule];
      r('r1', 'Interval [a, b]', `[${fmt(a, 4)}, ${fmt(b, 4)}]`);
      r('r2', `Riemann sum (${ruleName}, n = ${st.n})`, !I.ok ? 'Not meaningful: f is unbounded here' : Number.isFinite(S) ? fmt(S, 6) : 'Cannot compute (f undefined at a sample)', I.ok ? null : 'warn');
      r('r3', I.exact ? 'Exact integral' : 'Integral (numerical)', I.ok ? fmt(I.val, 6) : 'Does not exist (f unbounded)', I.ok ? null : 'bad');
      r('r4', 'Error of the sum', I.ok && Number.isFinite(S) ? fmt(S - I.val, 3) : '—');
      r('r5', 'Geometric area ∫|f| (numerical)', I.ok ? fmt(geo, 6) : '—');
      r('r6', 'Antiderivative', p.Ftex ? p.Ftex(st.a, st.b) : 'No formula: numerical only');
      if (!note) {
        if (!I.ok) note = 'f is unbounded on this interval (there is a vertical asymptote), so the definite integral does not exist as an ordinary integral. Move a or b so the interval avoids the asymptote.';
        else if (Math.abs(geo - Math.abs(I.val)) > 1e-6) note = `The integral counts area below the x-axis as negative (orange), so the signed integral ${fmt(I.val, 4)} is not the total geometric area ${fmt(geo, 4)}.`;
        else note = `With n = ${st.n} rectangles the ${ruleName} sum is ${fmt(S, 5)}. Press Start to increase n and watch the sum approach the integral.`;
      }
      sim.setBadge(`n = ${st.n}`);
    } else {
      const x = st.fx;
      const A = Aof(x);
      const h = 1e-4;
      const dA = (Aof(x + h) - Aof(x - h)) / (2 * h);
      r('r1', `A(x) = ∫ from ${fmt(st.fa, 3)} to ${fmt(x, 3)}`, Number.isFinite(A) ? fmt(A, 6) : 'Undefined (f unbounded)');
      r('r2', `f(${fmt(x, 3)})`, fmt(f(x), 6));
      r('r3', 'Slope of A at x (numerical)', Number.isFinite(dA) ? fmt(dA, 6) : '—');
      r('r4', 'Slope of A − f(x)', Number.isFinite(dA) ? fmt(dA - f(x), 3) : '—');
      r('r5', 'A is', !Number.isFinite(dA) ? '—' : dA > 1e-9 ? 'Increasing (f > 0)' : dA < -1e-9 ? 'Decreasing (f < 0)' : 'Level (f = 0)');
      r('r6', 'A(x) method', p.F && !unboundedIn(st.fa, x) ? 'Exact (F(x) − F(a))' : 'Numerical (Gauss–Legendre)');
      note ||= 'The accumulated area A(x) grows where f is positive and shrinks where f is negative; its slope at every x equals f(x). Drag x (orange) or a (green), or press Start to sweep x.';
      sim.setBadge('Fundamental theorem');
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', `${P().tex(st.a, st.b)}. ${noteEl.textContent}`);
  }

  /* ======================= Step (animations) ======================= */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (!anim) anim = { kind: st.view, t: 0 };
    anim.t += dt;
    const u = Math.min(1, anim.t / 6);
    if (st.view === 'limits') {
      st.h = 10 ** (0 - 4 * u); // 1 → 0.0001
      hCtl.set(Math.log10(st.h), false);
    } else if (st.view === 'derivative') {
      const s = Math.sign(st.dh) || 1;
      st.dh = s * 10 ** (Math.log10(2) - (Math.log10(2) + 3) * u); // 2 → 0.001
      dhCtl.set(st.dh, false);
    } else if (st.view === 'integral') {
      st.n = Math.max(1, Math.round(10 ** (2.3 * u))); // 1 → 200
      nCtl.set(st.n, false);
    } else {
      st.fx = v[0] + (v[1] - v[0]) * (0.02 + 0.96 * u);
      fxCtl.set(+st.fx.toFixed(2), false);
    }
    if (u >= 1) {
      anim = null;
      sim.pause();
    }
  }

  /* ======================= Interaction: drag, pan, zoom ======================= */
  const toWorld = (bx: number, by: number) => {
    const L = layout();
    if (st.view === 'ftc') {
      // only the top plot shares the y-range with the view
      PL = { ...L.plot, h: (L.plot.h - 26) * 0.52 };
    } else PL = L.plot;
    vy = [v[2], v[3]];
    return [XP(bx), YP(by)] as [number, number];
  };
  const inPlot = (bx: number, by: number) => {
    const L = layout().plot;
    return bx >= L.x && bx <= L.x + L.w && by >= L.y && by <= L.y + L.h;
  };
  function hitHandle(bx: number, by: number) {
    let best: string | null = null;
    let bd = 26 / cur;
    for (const h of handles) {
      const d = Math.hypot(h.x - bx, h.y - by);
      if (d < bd) {
        bd = d;
        best = h.id;
      }
    }
    return best;
  }
  const snap = (x: number) => Math.round(x * 100) / 100;
  function dragTo(id: string, bx: number, by: number) {
    const [x] = toWorld(bx, by);
    lastMsg = '';
    if (id === 'target') targetCtl.set(clamp(snap(x), -50, 50));
    else if (id === 'L') hCtl.set(Math.log10(clamp(st.target - x, 1e-4, 10)));
    else if (id === 'R') hCtl.set(Math.log10(clamp(x - st.target, 1e-4, 10)));
    else if (id === 'P') x0Ctl.set(clamp(snap(x), -50, 50));
    else if (id === 'Q') {
      let d = x - st.x0;
      if (Math.abs(d) < 0.001) d = d < 0 ? -0.001 : 0.001;
      dhCtl.set(clamp(+d.toFixed(3), -10, 10));
    } else if (id === 'ia') iaCtl.set(clamp(snap(x), -50, 50));
    else if (id === 'ib') ibCtl.set(clamp(snap(x), -50, 50));
    else if (id === 'fa') faCtl.set(clamp(snap(x), -50, 50));
    else if (id === 'fx') fxCtl.set(clamp(snap(x), -50, 50));
    sim.requestRender();
  }
  function zoomAt(factor: number, cx?: number, cy?: number) {
    const mx = cx ?? (v[0] + v[1]) / 2;
    const my = cy ?? (v[2] + v[3]) / 2;
    v = [mx + (v[0] - mx) * factor, mx + (v[1] - mx) * factor, my + (v[2] - my) * factor, my + (v[3] - my) * factor];
    sim.requestRender();
  }
  let drag: null | { id: string } | { pan: true; bx: number; by: number; v: View4 } = null;
  let downAt = { x: 0, y: 0 };
  let moved = false;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return toBox(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && touches > 1) return;
    const [bx, by] = local(e);
    downAt = { x: bx, y: by };
    moved = false;
    const id = hitHandle(bx, by);
    if (id) drag = { id };
    else if (e.pointerType !== 'touch' && inPlot(bx, by)) drag = { pan: true, bx, by, v: [...v] as View4 };
    else return;
    canvas.setPointerCapture(e.pointerId);
    if (sim.running) sim.pause();
  });
  canvas.addEventListener('pointermove', (e) => {
    const [bx, by] = local(e);
    if (!drag) {
      if (e.pointerType === 'mouse') canvas.style.cursor = hitHandle(bx, by) ? 'grab' : inPlot(bx, by) ? 'move' : '';
      return;
    }
    if (Math.hypot(bx - downAt.x, by - downAt.y) > 3) moved = true;
    if ('id' in drag) dragTo(drag.id, bx, by);
    else {
      const L = layout().plot;
      const dx = ((bx - drag.bx) / L.w) * (drag.v[1] - drag.v[0]);
      const h = st.view === 'ftc' ? (L.h - 26) * 0.52 : L.h;
      const dy = ((by - drag.by) / h) * (drag.v[3] - drag.v[2]);
      v = [drag.v[0] - dx, drag.v[1] - dx, drag.v[2] + dy, drag.v[3] + dy];
      sim.requestRender();
    }
  });
  const end = (e: PointerEvent) => {
    const [bx, by] = local(e);
    const wasDrag = drag;
    drag = null;
    canvas.style.cursor = '';
    if (!moved && e.type === 'pointerup' && inPlot(bx, by) && !(wasDrag && 'id' in wasDrag)) {
      const [x, y] = toWorld(bx, by);
      const r = canvas.getBoundingClientRect();
      const fy = f(x);
      sim.showTooltip(e.clientX - r.left, e.clientY - r.top, `(${fmt(x, 4)}, ${fmt(y, 4)})`, Number.isFinite(fy) ? `On the curve at x = ${fmt(x, 4)}: f(x) = ${fmt(fy, 5)}.` : `f is undefined at x = ${fmt(x, 4)}.`);
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  // Ctrl/⌘ + wheel or a trackpad pinch zooms; a plain wheel scrolls the page as usual.
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [bx, by] = local(e);
      const [x, y] = toWorld(bx, by);
      zoomAt(Math.exp(clamp(e.deltaY, -50, 50) * 0.01), x, y);
    },
    { passive: false },
  );
  // Touch: one finger on a handle drags it, two fingers pinch-zoom and pan; one finger elsewhere scrolls the page.
  let touches = 0;
  let pinch: null | { d: number; mx: number; my: number; v: View4 } = null;
  const tpts = (e: TouchEvent) => [...e.touches].slice(0, 2).map((tt) => local(tt));
  canvas.addEventListener(
    'touchstart',
    (e) => {
      touches = e.touches.length;
      if (e.touches.length === 2) {
        e.preventDefault();
        drag = null;
        const [p1, p2] = tpts(e);
        pinch = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), mx: (p1[0] + p2[0]) / 2, my: (p1[1] + p2[1]) / 2, v: [...v] as View4 };
      } else if (e.touches.length === 1) {
        const [p1] = tpts(e);
        if (hitHandle(p1[0], p1[1])) e.preventDefault();
      }
    },
    { passive: false },
  );
  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [p1, p2] = tpts(e);
      const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      const k = clamp(pinch.d / Math.max(10, d), 0.05, 20);
      const L = layout().plot;
      v = [...pinch.v] as View4;
      const [cx, cy] = toWorld(pinch.mx, pinch.my);
      zoomAt(k, cx, cy);
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      const dx = ((mx - pinch.mx) / L.w) * (v[1] - v[0]);
      const dy = ((my - pinch.my) / L.h) * (v[3] - v[2]);
      v = [v[0] - dx, v[1] - dx, v[2] + dy, v[3] + dy];
      sim.requestRender();
    },
    { passive: false },
  );
  canvas.addEventListener('touchend', (e) => {
    touches = e.touches.length;
    if (e.touches.length < 2) pinch = null;
  });

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.querySelectorAll<HTMLElement>('[data-views]').forEach((el) => (el.hidden = !el.dataset.views!.split(' ').includes(st.view)));
    const uses = P().uses;
    root.querySelectorAll<HTMLElement>('[data-param]').forEach((el) => (el.hidden = !uses.includes(el.dataset.param as 'a' | 'b')));
  }
  const viewCtl = ui.choice<View>('cv-view', (val) => {
    st.view = val;
    anim = null;
    lastMsg = '';
    sim.pause();
    sim.hideTooltip();
    showView();
    sim.requestRender();
  });
  const aCtl = ui.range('cv-a', (q) => q.toFixed(1), (q) => ((st.a = q), (lastMsg = ''), sim.requestRender()));
  const bCtl = ui.range('cv-b', (q) => q.toFixed(1), (q) => ((st.b = q), (lastMsg = ''), sim.requestRender()));
  const gridCtl = ui.toggle('cv-grid', (q) => ((st.grid = q), sim.requestRender()));
  const notesCtl = ui.toggle('cv-notes', (q) => ((st.notes = q), sim.requestRender()));
  const targetCtl = ui.range('cv-target', (q) => fmt(q, 4), (q) => ((st.target = q), (lastMsg = ''), sim.requestRender()));
  const hCtl = ui.range('cv-h', (q) => fmt(10 ** q, 3), (q) => ((st.h = 10 ** q), sim.requestRender()));
  const x0Ctl = ui.range('cv-x0', (q) => fmt(q, 4), (q) => ((st.x0 = q), (lastMsg = ''), sim.requestRender()));
  const dhCtl = ui.range('cv-dh', (q) => fmt(q, 3), (q) => ((st.dh = Math.abs(q) < 0.001 ? (q < 0 ? -0.001 : 0.001) : q), sim.requestRender()));
  const tanCtl = ui.toggle('cv-tan', (q) => ((st.showTan = q), sim.requestRender()));
  const secCtl = ui.toggle('cv-sec', (q) => ((st.showSec = q), sim.requestRender()));
  const dfCtl = ui.toggle('cv-df', (q) => ((st.showDf = q), sim.requestRender()));
  const incrCtl = ui.toggle('cv-incr', (q) => ((st.showIncr = q), sim.requestRender()));
  const iaCtl = ui.range('cv-ia', (q) => fmt(q, 4), (q) => ((st.ia = q), (lastMsg = ''), sim.requestRender()));
  const ibCtl = ui.range('cv-ib', (q) => fmt(q, 4), (q) => ((st.ib = q), (lastMsg = ''), sim.requestRender()));
  const nCtl = ui.range('cv-n', (q) => `${q}`, (q) => ((st.n = q), (lastMsg = ''), sim.requestRender()));
  const ruleCtl = ui.choice<Rule>('cv-rule', (q) => ((st.rule = q), (lastMsg = ''), sim.requestRender()));
  const exactCtl = ui.toggle('cv-exact', (q) => ((st.showExact = q), sim.requestRender()));
  const faCtl = ui.range('cv-fa', (q) => fmt(q, 4), (q) => ((st.fa = q), sim.requestRender()));
  const fxCtl = ui.range('cv-fx', (q) => fmt(q, 4), (q) => ((st.fx = q), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const z = btn.dataset.zoom;
      if (z === 'in') zoomAt(0.8);
      else if (z === 'out') zoomAt(1.25);
      else {
        v = [...P().view] as View4;
        sim.requestRender();
      }
    }),
  );
  function selectPreset(id: string, keepView = false) {
    st.fid = id;
    fnSel.value = id;
    const p = P();
    if (id !== 'custom') {
      st.a = p.def.a;
      st.b = p.def.b;
      aCtl.set(st.a, false);
      bCtl.set(st.b, false);
    }
    if (!keepView) v = [...p.view] as View4;
    if (p.target !== undefined) targetCtl.set(p.target, false), (st.target = p.target);
    errEl.textContent = '';
    exprIn.removeAttribute('aria-invalid');
    lastMsg = '';
    showView();
    sim.requestRender();
  }
  fnSel.addEventListener('change', () => {
    if (fnSel.value === 'custom') {
      if (custom) selectPreset('custom', true);
      else exprIn.focus();
      return;
    }
    selectPreset(fnSel.value);
  });
  function plotExpr() {
    try {
      const parsed = parseExpr(exprIn.value, ['x', 'a', 'b']);
      const g = parsed.fn;
      const src = exprIn.value.trim();
      // reject expressions that are undefined everywhere we can see
      let finite = 0;
      for (let i = 0; i <= 50; i++) if (Number.isFinite(g({ x: v[0] + ((v[1] - v[0]) * i) / 50, a: st.a, b: st.b }))) finite++;
      if (finite === 0) throw new ExprError('That expression is undefined everywhere in view (for example sqrt of a negative number).', 0);
      custom = {
        name: `Custom: ${src}`,
        kind: 'custom',
        tex: () => `f(x) = ${src}`,
        f: (x, a, b) => g({ x, a, b }),
        uses: [...parsed.uses].filter((u): u is 'a' | 'b' => u === 'a' || u === 'b'),
        def: { a: st.a, b: st.b },
        view: [...v] as View4,
      };
      const opt = fnSel.querySelector<HTMLOptionElement>('option[value="custom"]')!;
      opt.textContent = `Custom: ${src}`;
      selectPreset('custom', true);
      lastMsg = `Plotted f(x) = ${src}. Derivatives and integrals of your own functions are computed numerically.`;
      sim.requestRender();
    } catch (err) {
      errEl.textContent = err instanceof ExprError ? err.message : 'That expression could not be read.';
      exprIn.setAttribute('aria-invalid', 'true');
    }
  }
  root.querySelector('[data-plot]')?.addEventListener('click', plotExpr);
  exprIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      plotExpr();
    }
  });
  exprIn.addEventListener('input', () => {
    errEl.textContent = '';
    exprIn.removeAttribute('aria-invalid');
  });

  /* ---------- challenges ---------- */
  const CH = [
    {
      q: 'Estimate the limit of (x² − 1)/(x − 1) as x → 1 from both sides.',
      opts: ['0', '1', '2', 'It does not exist, because f(1) is undefined'],
      ok: 2,
      why: 'From the left and the right the values approach 2. The function is undefined at x = 1, but the limit only depends on values near 1.',
      setup: () => {
        viewCtl.set('limits');
        selectPreset('hole');
        hCtl.set(-2);
      },
    },
    {
      q: 'What is the slope of the tangent to y = x² at x = 3?',
      opts: ['3', '9', '6', '2'],
      ok: 2,
      why: 'f′(x) = 2x, so f′(3) = 6. The secant slopes 7, 6.5, 6.1, 6.01… approach 6 as h shrinks.',
      setup: () => {
        viewCtl.set('derivative');
        selectPreset('quad');
        x0Ctl.set(3);
        dhCtl.set(1);
      },
    },
    {
      q: 'Where is f(x) = x³ − 3x decreasing?',
      opts: ['x < −1', 'For −1 < x < 1', 'x > 1', 'Everywhere'],
      ok: 1,
      why: 'f′(x) = 3x² − 3 is negative between −1 and 1 (red band), so f decreases there. There is a local maximum at x = −1 and a local minimum at x = 1.',
      setup: () => {
        viewCtl.set('derivative');
        selectPreset('cubic');
        x0Ctl.set(0);
        incrCtl.set(true);
        dfCtl.set(true);
      },
    },
    {
      q: 'For y = x², the secant slope from x = 1 to x = 1 + h is 2 + h. What happens as h → 0?',
      opts: ['It approaches 2, the tangent slope', 'It approaches 0', 'It approaches 1', 'It grows without limit'],
      ok: 0,
      why: 'The secant slope [(1 + h)² − 1]/h = 2 + h tends to 2: the derivative f′(1). Press Start to shrink h.',
      setup: () => {
        viewCtl.set('derivative');
        selectPreset('quad');
        x0Ctl.set(1);
        dhCtl.set(1);
      },
    },
    {
      q: 'Using 4 left rectangles, estimate ∫ from 0 to 2 of x² dx.',
      opts: ['2.67', '3.75', '4', '1.75'],
      ok: 3,
      why: 'Δx = 0.5, so the sum is 0.5 × (0 + 0.25 + 1 + 2.25) = 1.75. The exact value is 8/3 ≈ 2.67: left rectangles underestimate an increasing function.',
      setup: () => {
        viewCtl.set('integral');
        selectPreset('quad');
        iaCtl.set(0);
        ibCtl.set(2);
        nCtl.set(4);
        ruleCtl.set('left');
      },
    },
    {
      q: 'What happens to the left Riemann sum for x² on [0, 2] as the number of rectangles increases?',
      opts: ['It moves away from the exact value', 'It increases towards the exact value 8/3', 'It stays the same', 'It becomes negative'],
      ok: 1,
      why: 'More, thinner rectangles fit the curve better, so the error shrinks (roughly in proportion to 1/n for left sums). Press Start to watch n grow.',
      setup: () => {
        viewCtl.set('integral');
        selectPreset('quad');
        iaCtl.set(0);
        ibCtl.set(2);
        nCtl.set(1);
        ruleCtl.set('left');
      },
    },
  ];
  const chQ = root.querySelector<HTMLElement>('[data-ch-q]')!;
  const chOpts = root.querySelector<HTMLElement>('[data-ch-opts]')!;
  const chFb = root.querySelector<HTMLElement>('[data-ch-fb]')!;
  let chIdx = 0;
  function showChallenge(i: number) {
    chIdx = i;
    const c = CH[i];
    chQ.textContent = `${i + 1}. ${c.q}`;
    chFb.textContent = '';
    chOpts.innerHTML = '';
    c.opts.forEach((o, k) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm';
      btn.textContent = o;
      btn.addEventListener('click', () => {
        chFb.textContent = `${k === c.ok ? 'Correct!' : 'Not quite.'} ${c.why} The graph is now set up to show it.`;
        chFb.dataset.tone = k === c.ok ? 'ok' : 'bad';
        c.setup();
      });
      chOpts.appendChild(btn);
    });
  }
  root.querySelector('[data-ch-next]')?.addEventListener('click', () => showChallenge((chIdx + 1) % CH.length));
  showChallenge(0);

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(on: boolean) {
      if (on && !anim) anim = { kind: st.view, t: 0 };
    },
    reset() {
      anim = null;
      Object.assign(st, { grid: true, notes: true, target: 1, h: 0.5, x0: 1.5, dh: 1, showTan: true, showSec: true, showDf: false, showIncr: false, ia: 0, ib: 2, n: 8, rule: 'left', showExact: false, fa: 0, fx: 1.5 });
      gridCtl.set(true, false);
      notesCtl.set(true, false);
      targetCtl.set(1, false);
      hCtl.set(Math.log10(0.5), false);
      x0Ctl.set(1.5, false);
      dhCtl.set(1, false);
      tanCtl.set(true, false);
      secCtl.set(true, false);
      dfCtl.set(false, false);
      incrCtl.set(false, false);
      iaCtl.set(0, false);
      ibCtl.set(2, false);
      nCtl.set(8, false);
      ruleCtl.set('left', false);
      exactCtl.set(false, false);
      faCtl.set(0, false);
      fxCtl.set(1.5, false);
      const def = { limits: 'hole', derivative: 'cubic', integral: 'quad', ftc: 'sin' }[st.view];
      selectPreset(def);
      if (st.view === 'limits') targetCtl.set(1, false), (st.target = 1);
      showChallenge(0);
    },
  });

  selectPreset('cubic');
  showView();
  sim.requestRender();
}
