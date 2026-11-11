/**
 * Differential-equations lab. Every model is integrated with the classical
 * fourth-order Runge–Kutta method (RK4) using small fixed steps, and the exact
 * solution is overlaid wherever one exists:
 *   exp      dN/dt = kN                      N = N₀e^{kt}
 *   cooling  dT/dt = −k(T − Tₐ)              T = Tₐ + (T₀ − Tₐ)e^{−kt}
 *   spring   m x″ + b x′ + k x = 0          closed forms for the three damping cases
 *   logistic dN/dt = rN(1 − N/K)             N = K / (1 + ((K − N₀)/N₀)e^{−rt})
 *   linear   x′ = ax + by, y′ = cx + dy      phase plane, eigen-directions
 *   euler    yₙ₊₁ = yₙ + h·f(tₙ, yₙ)         compared with the exact solution
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { eigen2 } from '../matrices/linalg';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type ModelId = 'exp' | 'cooling' | 'spring' | 'logistic' | 'linear' | 'euler';
type Box = { x: number; y: number; w: number; h: number };
type Vec = number[];
const C_NUM = '#1c7ed6';
const C_EX = '#e8590c';
const C_KEEP = ['#ae3ec9', '#2f9e44', '#868e96'];

/** One classical RK4 step. */
function rk4(f: (t: number, y: Vec) => Vec, t: number, y: Vec, h: number): Vec {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k1[i]));
  const k3 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k2[i]));
  const k4 = f(t + h, y.map((v, i) => v + h * k3[i]));
  return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
const fmt = (v: number, sig = 4) => {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) {
    const [m, e] = v.toExponential(sig - 1).split('e');
    return `${(+m).toString().replace('-', '−')} × 10^${+e}`.replace('^-', '^−');
  }
  return (+v.toPrecision(sig)).toString().replace('-', '−');
};
/** Short form for narrow table cells: 1.51e−4 instead of 1.51 × 10^−4. */
const cell = (v: number, sig = 4) => {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e-12 && (a >= 1e6 || a < 1e-3)) return v.toExponential(Math.min(sig, 3) - 1).replace('e+', 'e').replace(/-/g, '−');
  return fmt(v, sig);
};

export function initOdes(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const modelSel = root.querySelector<HTMLSelectElement>('[data-model]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    model: 'exp' as ModelId,
    speed: 1,
    field: true,
    // exp
    N0: 10,
    k: 0.3,
    // cooling
    T0: 90,
    Ta: 20,
    kc: 0.08,
    // spring
    m: 1,
    ks: 10,
    b: 0.8,
    x0: 0.4,
    // logistic
    L0: 5,
    r: 0.8,
    K: 100,
    // linear
    a: -1,
    bb: 2,
    c: -2,
    d: -1,
    // euler
    prob: 'decay' as 'decay' | 'growth' | 'cooling',
    h: 0.5,
  };
  let t = 0;
  let y: Vec = [];
  let hist: { t: number; y: Vec }[] = [];
  let kept: { label: string; pts: [number, number][] }[] = [];
  let lastMsg = '';
  let eulerShown = 0;
  let eulerT = 0;

  /* ======================= Models ======================= */
  interface Model {
    f: (tt: number, yy: Vec) => Vec;
    y0: () => Vec;
    exact?: (tt: number) => number;
    tMax: number;
    hMax: number;
    tUnit: string;
    yLabel: string;
    yUnit: string;
  }
  const springExact = (tt: number) => {
    const w0 = Math.sqrt(st.ks / st.m);
    const g = st.b / (2 * st.m);
    const x0 = st.x0;
    if (Math.abs(g - w0) < 1e-9 * w0) return x0 * (1 + g * tt) * Math.exp(-g * tt);
    if (g < w0) {
      const wd = Math.sqrt(w0 * w0 - g * g);
      return Math.exp(-g * tt) * (x0 * Math.cos(wd * tt) + ((g * x0) / wd) * Math.sin(wd * tt));
    }
    const s = Math.sqrt(g * g - w0 * w0);
    const r1 = -g + s;
    const r2 = -g - s;
    const A = (-r2 * x0) / (r1 - r2);
    const B = (r1 * x0) / (r1 - r2);
    return A * Math.exp(r1 * tt) + B * Math.exp(r2 * tt);
  };
  const MODELS: Record<Exclude<ModelId, 'euler'>, () => Model> = {
    exp: () => ({ f: (_t, [N]) => [st.k * N], y0: () => [st.N0], exact: (tt) => st.N0 * Math.exp(st.k * tt), tMax: 10, hMax: 0.01, tUnit: '', yLabel: 'N', yUnit: '' }),
    cooling: () => ({ f: (_t, [T]) => [-st.kc * (T - st.Ta)], y0: () => [st.T0], exact: (tt) => st.Ta + (st.T0 - st.Ta) * Math.exp(-st.kc * tt), tMax: 60, hMax: 0.05, tUnit: 'min', yLabel: 'T', yUnit: '°C' }),
    spring: () => ({ f: (_t, [x, v]) => [v, (-st.b * v - st.ks * x) / st.m], y0: () => [st.x0, 0], exact: springExact, tMax: 15, hMax: 0.002, tUnit: 's', yLabel: 'x', yUnit: 'm' }),
    logistic: () => ({ f: (_t, [N]) => [st.r * N * (1 - N / st.K)], y0: () => [st.L0], exact: (tt) => st.K / (1 + ((st.K - st.L0) / st.L0) * Math.exp(-st.r * tt)), tMax: 20, hMax: 0.01, tUnit: '', yLabel: 'N', yUnit: '' }),
    linear: () => ({ f: (_t, [x, yy]) => [st.a * x + st.bb * yy, st.c * x + st.d * yy], y0: () => [3, 0], tMax: 25, hMax: 0.01, tUnit: '', yLabel: 'x, y', yUnit: '' }),
  };
  const M = () => (st.model === 'euler' ? null : MODELS[st.model]());

  /* ---------- linear system: trajectories ---------- */
  let trajs: { start: [number, number]; pts: [number, number][] }[] = [];
  function traj(x0: number, y0: number) {
    const f = (_t: number, [x, yy]: Vec) => [st.a * x + st.bb * yy, st.c * x + st.d * yy];
    const pts: [number, number][] = [[x0, y0]];
    let s: Vec = [x0, y0];
    for (let i = 0; i < 2500; i++) {
      s = rk4(f, 0, s, 0.01);
      pts.push([s[0], s[1]]);
      if (Math.abs(s[0]) > 40 || Math.abs(s[1]) > 40) break;
    }
    return { start: [x0, y0] as [number, number], pts };
  }
  function defaultTrajs() {
    trajs = [0, 1, 2, 3, 4, 5].map((k) => traj(3 * Math.cos((k * Math.PI) / 3 + 0.3), 3 * Math.sin((k * Math.PI) / 3 + 0.3)));
  }
  function classify() {
    const tr = st.a + st.d;
    const det = st.a * st.d - st.bb * st.c;
    const disc = tr * tr - 4 * det;
    const e = 1e-9;
    if (Math.abs(det) < e) return { name: 'Degenerate: a whole line of equilibria', stable: 'neither', tone: 'warn' as const };
    if (det < 0) return { name: 'Saddle point', stable: 'unstable', tone: 'bad' as const };
    if (Math.abs(tr) < e) return { name: disc < 0 ? 'Centre: closed orbits' : 'Degenerate', stable: 'neutrally stable (orbits neither grow nor shrink)', tone: 'ok' as const };
    const kind = disc > e ? 'node' : disc < -e ? 'spiral' : 'star / degenerate node';
    const stab = tr < 0 ? 'stable' : 'unstable';
    return { name: `${stab === 'stable' ? 'Stable' : 'Unstable'} ${kind}`, stable: stab, tone: tr < 0 ? ('ok' as const) : ('bad' as const) };
  }

  /* ---------- Euler ---------- */
  const EP = {
    decay: { k: -1, y0: 1, Ta: 0, tMax: 10, f: (_t: number, yy: number) => -yy, exact: (tt: number) => Math.exp(-tt), eq: "dy/dt = −y,  y(0) = 1", ex: 'y = e^(−t)' },
    growth: { k: 0.5, y0: 1, Ta: 0, tMax: 6, f: (_t: number, yy: number) => 0.5 * yy, exact: (tt: number) => Math.exp(0.5 * tt), eq: 'dy/dt = 0.5y,  y(0) = 1', ex: 'y = e^(0.5t)' },
    cooling: { k: -0.3, y0: 90, Ta: 20, tMax: 20, f: (_t: number, yy: number) => -0.3 * (yy - 20), exact: (tt: number) => 20 + 70 * Math.exp(-0.3 * tt), eq: 'dT/dt = −0.3(T − 20),  T(0) = 90', ex: 'T = 20 + 70e^(−0.3t)' },
  };
  function eulerSteps() {
    const P = EP[st.prob];
    const out: { t: number; y: number; slope: number }[] = [];
    let tt = 0;
    let yy = P.y0;
    const N = Math.ceil(P.tMax / st.h - 1e-9);
    for (let n = 0; n <= N; n++) {
      const slope = P.f(tt, yy);
      out.push({ t: tt, y: yy, slope });
      if (!Number.isFinite(yy) || Math.abs(yy) > 1e9) break;
      yy = yy + st.h * slope;
      tt = +(tt + st.h).toFixed(10);
    }
    return out;
  }
  /** For y′ = k(y − Tₐ) Euler multiplies the gap by (1 + hk) each step: stable only if |1 + hk| < 1. */
  const eulerFactor = () => 1 + st.h * EP[st.prob].k;

  /* ======================= Simulation ======================= */
  function restart() {
    t = 0;
    const m = M();
    y = m ? m.y0() : [];
    hist = m ? [{ t: 0, y: [...y] }] : [];
    eulerShown = st.model === 'euler' ? 0 : eulerShown;
    eulerT = 0;
    if (st.model === 'linear') defaultTrajs();
  }
  function advance(dtModel: number) {
    const m = M();
    if (!m) return;
    const n = Math.max(1, Math.ceil(dtModel / m.hMax));
    const h = dtModel / n;
    for (let i = 0; i < n; i++) {
      y = rk4(m.f, t, y, h);
      t += h;
    }
    hist.push({ t, y: [...y] });
    if (hist.length > 4000) hist = hist.filter((_, i) => i % 2 === 0);
  }
  const timeScale = (): number => ({ exp: 1, cooling: 6, spring: 1, logistic: 2, linear: 1.2, euler: 1 })[st.model];
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    if (st.model === 'euler') {
      eulerT += dt * st.speed;
      if (eulerT > 0.45) {
        eulerT = 0;
        const all = eulerSteps().length - 1;
        if (eulerShown < all) eulerShown++;
        else sim.pause();
      }
      return;
    }
    const m = M()!;
    advance(dt * st.speed * timeScale());
    if (t >= m.tMax) {
      lastMsg = `Run finished at t = ${fmt(m.tMax)}${m.tUnit ? ` ${m.tUnit}` : ''}. Press Reset to start again or change a value and press Start.`;
      sim.pause();
    }
  }

  /* ======================= Drawing helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const toBox = (x: number, yy: number): [number, number] => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (yy - oy) / k];
  };
  let cur = 1;
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  function text(s: string, x: number, yy: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, yy);
    ctx.textAlign = 'left';
  }
  function wrap(s: string, x: number, yy: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600, maxY = Infinity) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    let line = '';
    for (const w of s.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        if (yy + lh > maxY) {
          ctx.fillText(`${line}…`, x, yy);
          return yy + lh;
        }
        ctx.fillText(line, x, yy);
        line = w;
        yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
    return yy + lh;
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
  function arrow(x0: number, y0: number, x1: number, y1: number, col: string, lw = 2.5) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 0.5) return;
    const a = Math.atan2(y1 - y0, x1 - x0);
    const hs = Math.min(10 / cur, L * 0.45);
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw / cur;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - Math.cos(a) * hs * 0.7, y1 - Math.sin(a) * hs * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hs * Math.cos(a - 0.45), y1 - hs * Math.sin(a - 0.45));
    ctx.lineTo(x1 - hs * Math.cos(a + 0.45), y1 - hs * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  }
  const niceStep = (span: number, target: number) => {
    const raw = span / target;
    const p = 10 ** Math.floor(Math.log10(raw));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };

  /* ---------- a time-series graph ---------- */
  type Graph = { B: Box; x0: number; x1: number; y0: number; y1: number; X: (v: number) => number; Y: (v: number) => number; yw: number };
  function graph(B: Box, x0: number, x1: number, y0: number, y1: number, xl: string, yl: string): Graph {
    panel(B, pal['surface-2']);
    const P = { x: B.x + 46, y: B.y + 12, w: B.w - 58, h: B.h - 42 };
    const X = (v: number) => P.x + ((v - x0) / (x1 - x0)) * P.w;
    const Y = (v: number) => P.y + P.h - ((v - y0) / (y1 - y0)) * P.h;
    const sx = niceStep(x1 - x0, P.w / 70);
    const sy = niceStep(y1 - y0, P.h / 40);
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.22);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let v = Math.ceil(x0 / sx) * sx; v <= x1 + 1e-9; v += sx) {
      ctx.moveTo(X(v), P.y);
      ctx.lineTo(X(v), P.y + P.h);
    }
    for (let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy) {
      ctx.moveTo(P.x, Y(v));
      ctx.lineTo(P.x + P.w, Y(v));
    }
    ctx.stroke();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5 / cur;
    ctx.beginPath();
    ctx.moveTo(P.x, clamp(Y(0), P.y, P.y + P.h));
    ctx.lineTo(P.x + P.w, clamp(Y(0), P.y, P.y + P.h));
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x, P.y + P.h);
    ctx.stroke();
    for (let v = Math.ceil(x0 / sx) * sx; v <= x1 + 1e-9; v += sx) text(fmt(+v.toFixed(8), 3), X(v), P.y + P.h + 13 / cur, 9.5, pal['text-faint'], 'center', 600);
    for (let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy) text(fmt(+v.toFixed(8), 3), P.x - 5 / cur, Y(v) + 3 / cur, 9.5, pal['text-faint'], 'right', 600);
    text(xl, P.x + P.w, P.y + P.h + 26 / cur, 10, pal['text-muted'], 'right', 700);
    text(yl, P.x + 4 / cur, P.y + 12 / cur, 10.5, pal['text-muted'], 'left', 750);
    ctx.font = fs(10.5, 750);
    // width taken by the y-axis label, so legends can start after it
    const yw = yl ? ctx.measureText(yl).width + 14 / cur : 0;
    return { B: P, x0, x1, y0, y1, X, Y, yw };
  }
  function plotLine(G: Graph, pts: [number, number][], col: string, lw = 2.5, dash: number[] = []) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(G.B.x, G.B.y, G.B.w, G.B.h);
    ctx.clip();
    ctx.strokeStyle = col;
    ctx.lineWidth = lw / cur;
    ctx.setLineDash(dash.map((q) => q / cur));
    ctx.beginPath();
    pts.forEach(([a, b], i) => (i ? ctx.lineTo(G.X(a), G.Y(b)) : ctx.moveTo(G.X(a), G.Y(b))));
    ctx.stroke();
    ctx.restore();
  }
  /** Slope (direction) field for an autonomous equation y′ = g(y). */
  function slopeField(G: Graph, g: (v: number) => number) {
    const nx = 16;
    const ny = 11;
    ctx.save();
    ctx.beginPath();
    ctx.rect(G.B.x, G.B.y, G.B.w, G.B.h);
    ctx.clip();
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.55);
    ctx.lineWidth = 1.2 / cur;
    ctx.beginPath();
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const tt = G.x0 + ((i + 0.5) / nx) * (G.x1 - G.x0);
        const v = G.y0 + ((j + 0.5) / ny) * (G.y1 - G.y0);
        const s = g(v);
        // direction in screen space
        const dx = 1;
        const dy = -s * ((G.B.h / (G.y1 - G.y0)) / (G.B.w / (G.x1 - G.x0)));
        const L = Math.hypot(dx, dy);
        const len = Math.min(G.B.w / nx, G.B.h / ny) * 0.36;
        const cx = G.X(tt);
        const cy = G.Y(v);
        ctx.moveTo(cx - (dx / L) * len, cy - (dy / L) * len);
        ctx.lineTo(cx + (dx / L) * len, cy + (dy / L) * len);
      }
    ctx.stroke();
    ctx.restore();
  }
  const sample = (f: (tt: number) => number, t0: number, t1: number, n = 300): [number, number][] => Array.from({ length: n + 1 }, (_, i) => [t0 + ((t1 - t0) * i) / n, f(t0 + ((t1 - t0) * i) / n)]);

  /* ======================= Layouts ======================= */
  const layout = () =>
    portrait()
      ? { vis: { x: 14, y: 104, w: 652, h: 300 }, graph: { x: 14, y: 416, w: 652, h: 330 }, info: { x: 14, y: 758, w: 652, h: 230 } }
      : { vis: { x: 14, y: 14, w: 330, h: 572 }, graph: { x: 356, y: 66, w: 630, h: 368 }, info: { x: 356, y: 446, w: 630, h: 140 } };
  const phaseLayout = () =>
    portrait()
      ? { phase: { x: 14, y: 104, w: 652, h: 520 }, ts: { x: 14, y: 636, w: 652, h: 180 }, info: { x: 14, y: 828, w: 652, h: 160 } }
      : { phase: { x: 14, y: 14, w: 572, h: 572 }, ts: { x: 598, y: 70, w: 388, h: 230 }, info: { x: 598, y: 312, w: 388, h: 274 } };
  const eulerLayout = () => (portrait() ? { graph: { x: 14, y: 104, w: 652, h: 470 }, side: { x: 14, y: 586, w: 652, h: 402 } } : { graph: { x: 14, y: 14, w: 640, h: 572 }, side: { x: 666, y: 70, w: 320, h: 516 } });

  /* ======================= Visuals ======================= */
  let massBox: Box | null = null;
  let springGeom = { x0: 0, scale: 1, y: 0 };
  function drawVisual(B: Box) {
    panel(B, pal['surface-2']);
    const cx = B.x + B.w / 2;
    const m = M()!;
    if (st.model === 'exp') {
      const N = y[0];
      const top = Math.max(st.N0, st.N0 * Math.exp(st.k * m.tMax));
      const tank = { x: cx - 60, y: B.y + 70, w: 120, h: B.h - 150 };
      ctx.strokeStyle = pal['border-strong'];
      ctx.lineWidth = 2 / cur;
      ctx.strokeRect(tank.x, tank.y, tank.w, tank.h);
      const f = clamp(N / top, 0, 1);
      ctx.fillStyle = withAlpha(st.k >= 0 ? '#2f9e44' : '#e8590c', 0.55);
      ctx.fillRect(tank.x + 2, tank.y + tank.h * (1 - f), tank.w - 4, tank.h * f);
      const rate = st.k * N;
      const ay = tank.y + tank.h * (1 - f);
      const L = Math.min(clamp((Math.abs(rate) / Math.max(1e-9, Math.abs(st.k) * top)) * 120, 6, 120), rate > 0 ? ay - tank.y + 4 : tank.y + tank.h - ay);
      if (Math.abs(rate) > 1e-9) arrow(tank.x + tank.w + 26, ay, tank.x + tank.w + 26, ay + (rate > 0 ? -L : L), rate > 0 ? '#2f9e44' : '#e03131', 3);
      text(`N = ${fmt(N)}`, cx, B.y + 40, 16, pal['sim-text'], 'center', 800);
      text(`dN/dt = kN = ${fmt(rate)}`, cx, B.y + B.h - 50, 12, rate >= 0 ? '#2f9e44' : '#e03131', 'center', 750);
      text(st.k > 0 ? 'Growth: the bigger N, the faster it grows' : st.k < 0 ? 'Decay: the bigger N, the faster it shrinks' : 'k = 0: N stays constant', cx, B.y + B.h - 28, 10.5, pal['text-muted'], 'center', 650);
    } else if (st.model === 'cooling') {
      const T = y[0];
      const hotness = clamp((T - st.Ta) / 80, -0.5, 1);
      // mug
      const mug = { x: cx - 70, y: B.y + 150, w: 120, h: 150 };
      ctx.fillStyle = '#dee2e6';
      ctx.beginPath();
      ctx.roundRect(mug.x, mug.y, mug.w, mug.h, 14);
      ctx.fill();
      ctx.strokeStyle = '#dee2e6';
      ctx.lineWidth = 12 / cur;
      ctx.beginPath();
      ctx.arc(mug.x + mug.w + 6, mug.y + 60, 28, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      const r = Math.round(120 + 120 * Math.max(0, hotness));
      const bl = Math.round(60 + 160 * Math.max(0, -hotness) + 40 * (1 - Math.max(0, hotness)));
      ctx.fillStyle = `rgb(${r}, 70, ${bl})`;
      ctx.fillRect(mug.x + 10, mug.y + 14, mug.w - 20, 24);
      // steam
      const steam = clamp((T - st.Ta) / 60, 0, 1);
      ctx.strokeStyle = withAlpha(pal['text-muted'], 0.6 * steam);
      ctx.lineWidth = 3 / cur;
      for (let k = 0; k < 3; k++) {
        const sx = mug.x + 30 + k * 30;
        ctx.beginPath();
        for (let s = 0; s <= 60; s += 6) ctx.lineTo(sx + 8 * Math.sin(s / 10 + performance.now() / 400 + k), mug.y - 10 - s * steam);
        ctx.stroke();
      }
      // thermometer
      const th = { x: B.x + B.w - 56, y: B.y + 60, h: B.h - 160 };
      const TY = (v: number) => th.y + th.h - ((v + 10) / 120) * th.h;
      ctx.fillStyle = pal['bg-elev'];
      ctx.fillRect(th.x, th.y, 16, th.h);
      ctx.fillStyle = '#e03131';
      ctx.fillRect(th.x + 4, TY(T), 8, th.y + th.h - TY(T));
      ctx.strokeStyle = '#1c7ed6';
      ctx.setLineDash([4 / cur, 3 / cur]);
      ctx.beginPath();
      ctx.moveTo(th.x - 10, TY(st.Ta));
      ctx.lineTo(th.x + 26, TY(st.Ta));
      ctx.stroke();
      ctx.setLineDash([]);
      text(`${fmt(T, 3)} °C`, th.x + 8, th.y - 10, 12, '#e03131', 'center', 800);
      text(`room ${fmt(st.Ta, 3)} °C`, th.x + 8, TY(st.Ta) + 16 / cur, 9.5, '#1c7ed6', 'center', 700);
      const rate = -st.kc * (T - st.Ta);
      text(`dT/dt = −k(T − Tₐ) = ${fmt(rate, 3)} °C/min`, cx, B.y + 40, 12, pal['sim-text'], 'center', 800);
      text(`Gap T − Tₐ = ${fmt(T - st.Ta, 3)} °C: the bigger the gap, the faster it cools`, cx, B.y + B.h - 40, 10.5, pal['text-muted'], 'center', 650);
      // heat-flow arrows sized by the gap
      const L = clamp(Math.abs(T - st.Ta) * 0.8, 0, 50);
      if (L > 2) for (const dy of [0, 40]) arrow(mug.x - 12, mug.y + 60 + dy, mug.x - 12 - L, mug.y + 60 + dy, T > st.Ta ? '#e8590c' : '#1c7ed6', 2.5);
    } else if (st.model === 'spring') {
      const x = y[0];
      const v = y[1];
      const wallX = B.x + 24;
      const eqX = cx + 10;
      const scale = (B.w - 120) / 2 / 0.6; // 0.6 m to each side
      springGeom = { x0: eqX, scale, y: B.y + B.h / 2 };
      const my = B.y + B.h / 2;
      ctx.fillStyle = pal['border-strong'];
      ctx.fillRect(wallX - 10, my - 80, 10, 160);
      // equilibrium line
      ctx.strokeStyle = withAlpha(pal['text-muted'], 0.7);
      ctx.setLineDash([5 / cur, 5 / cur]);
      ctx.beginPath();
      ctx.moveTo(eqX, my - 90);
      ctx.lineTo(eqX, my + 100);
      ctx.stroke();
      ctx.setLineDash([]);
      text('x = 0 (equilibrium)', eqX, my + 116, 10, pal['text-muted'], 'center', 700);
      const bx = eqX + x * scale;
      const bw = 56;
      // spring (zig-zag)
      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 2.5 / cur;
      ctx.beginPath();
      const sx0 = wallX;
      const sx1 = bx - bw / 2;
      const coils = 12;
      ctx.moveTo(sx0, my - 20);
      for (let i = 1; i <= coils; i++) ctx.lineTo(sx0 + ((sx1 - sx0) * i) / coils, my - 20 + (i % 2 ? -14 : 14) * (i === coils ? 0 : 1));
      ctx.lineTo(sx1, my - 20);
      ctx.stroke();
      // damper
      if (st.b > 0) {
        ctx.strokeStyle = '#868e96';
        ctx.lineWidth = 3 / cur;
        const dm = (sx0 + sx1) / 2;
        ctx.beginPath();
        ctx.moveTo(sx0, my + 22);
        ctx.lineTo(dm - 4, my + 22);
        ctx.moveTo(dm - 4, my + 12);
        ctx.lineTo(dm - 4, my + 32);
        ctx.moveTo(dm - 16, my + 10);
        ctx.lineTo(dm + 14, my + 10);
        ctx.moveTo(dm - 16, my + 34);
        ctx.lineTo(dm + 14, my + 34);
        ctx.moveTo(dm + 14, my + 10);
        ctx.lineTo(dm + 14, my + 34);
        ctx.moveTo(dm + 14, my + 22);
        ctx.lineTo(sx1, my + 22);
        ctx.stroke();
      }
      // mass
      massBox = { x: bx - bw / 2, y: my - 40, w: bw, h: 80 };
      ctx.fillStyle = '#1c7ed6';
      ctx.beginPath();
      ctx.roundRect(massBox.x, massBox.y, massBox.w, massBox.h, 8);
      ctx.fill();
      text(`${fmt(st.m, 2)} kg`, bx, my + 5, 12, '#ffffff', 'center', 800);
      ctx.fillStyle = pal['border-strong'];
      ctx.fillRect(B.x + 14, my + 42, B.w - 28, 3);
      if (Math.abs(v) > 0.01) arrow(bx, my - 56, bx + clamp(v * 60, -80, 80), my - 56, '#e8590c', 2.5);
      text(`x = ${fmt(x, 3)} m · v = ${fmt(v, 3)} m/s`, cx, B.y + 34, 12, pal['sim-text'], 'center', 800);
      text('Drag the mass, then let go', cx, portrait() ? B.y + 34 + 20 / cur : B.y + B.h - 28, 10.5, pal['text-muted'], 'center', 650);
    } else if (st.model === 'logistic') {
      const N = y[0];
      const cols = 20;
      const rows = 20;
      const s = Math.min((B.w - 40) / cols, (B.h - 240) / rows);
      const gx = cx - (cols * s) / 2;
      const gy = B.y + 56;
      const filled = Math.round(clamp(N / st.K, 0, 1) * cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        ctx.fillStyle = i < filled ? '#2f9e44' : withAlpha(pal['text-faint'], 0.18);
        ctx.fillRect(gx + (i % cols) * s + 1, gy + Math.floor(i / cols) * s + 1, s - 2, s - 2);
      }
      text(`N = ${fmt(N)} of K = ${fmt(st.K)}`, cx, B.y + 36, 13, pal['sim-text'], 'center', 800);
      // dN/dt against N (a parabola with its peak at K/2)
      const P = { x: B.x + 40, y: gy + rows * s + 24, w: B.w - 60, h: B.y + B.h - (gy + rows * s + 24) - 34 };
      const rmax = (st.r * st.K) / 4;
      const PX = (n: number) => P.x + (n / st.K) * P.w;
      const PY = (g: number) => P.y + P.h - (g / Math.max(1e-9, rmax)) * P.h * 0.9;
      ctx.strokeStyle = pal['border-strong'];
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      ctx.moveTo(P.x, P.y + P.h);
      ctx.lineTo(P.x + P.w, P.y + P.h);
      ctx.stroke();
      ctx.strokeStyle = '#2f9e44';
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const n = (st.K * i) / 60;
        const g = st.r * n * (1 - n / st.K);
        if (i) ctx.lineTo(PX(n), PY(g));
        else ctx.moveTo(PX(n), PY(g));
      }
      ctx.stroke();
      const g = st.r * N * (1 - N / st.K);
      ctx.fillStyle = '#e8590c';
      ctx.beginPath();
      ctx.arc(PX(clamp(N, 0, st.K)), PY(g), 5 / cur, 0, Math.PI * 2);
      ctx.fill();
      text('growth rate dN/dt against N', P.x, P.y - 4 / cur, 9.5, pal['text-muted'], 'left', 700);
      text('K/2', PX(st.K / 2), P.y + P.h + 12 / cur, 9.5, pal['text-faint'], 'center', 650);
      text('K', PX(st.K), P.y + P.h + 12 / cur, 9.5, pal['text-faint'], 'center', 650);
    }
  }

  /* ======================= Graph and info for 1D models ======================= */
  function drawModelGraph(B: Box) {
    const m = M()!;
    const tMax = m.tMax;
    const ex = m.exact;
    // y-range from the exact solution (or the history) and kept runs
    let lo = Infinity;
    let hi = -Infinity;
    const consider = (v: number) => {
      if (Number.isFinite(v)) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    };
    if (ex) for (let i = 0; i <= 100; i++) consider(ex((tMax * i) / 100));
    for (const hh of hist) consider(hh.y[0]);
    for (const kp of kept) for (const p of kp.pts) consider(p[1]);
    if (st.model === 'cooling') consider(st.Ta);
    if (st.model === 'logistic') consider(st.K);
    if (st.model !== 'spring') consider(0);
    if (hi - lo < 1e-9) {
      hi += 1;
      lo -= 1;
    }
    const pad = (hi - lo) * 0.08;
    const G = graph(B, 0, tMax, lo - (st.model === 'spring' ? pad : 0), hi + pad, m.tUnit ? `t (${m.tUnit})` : 't', `${m.yLabel}${m.yUnit ? ` (${m.yUnit})` : ''}`);
    if (st.field && st.model !== 'spring') {
      const g = st.model === 'exp' ? (v: number) => st.k * v : st.model === 'cooling' ? (v: number) => -st.kc * (v - st.Ta) : (v: number) => st.r * v * (1 - v / st.K);
      slopeField(G, g);
    }
    if (st.model === 'cooling') plotLine(G, [[0, st.Ta], [tMax, st.Ta]], withAlpha('#1c7ed6', 0.7), 1.5, [6, 5]);
    if (st.model === 'logistic') {
      plotLine(G, [[0, st.K], [tMax, st.K]], withAlpha('#2f9e44', 0.8), 1.5, [6, 5]);
      text('K (carrying capacity)', G.X(tMax) - 4 / cur, G.Y(st.K) - 5 / cur, 10, '#2f9e44', 'right', 750);
    }
    kept.forEach((kp, i) => plotLine(G, kp.pts, withAlpha(C_KEEP[i], 0.8), 2));
    if (ex) plotLine(G, sample(ex, 0, tMax), withAlpha(C_EX, 0.9), 2, [7, 5]);
    plotLine(
      G,
      hist.map((hh) => [hh.t, hh.y[0]]),
      C_NUM,
      3,
    );
    const yv = y[0];
    if (Number.isFinite(yv)) {
      ctx.fillStyle = C_NUM;
      ctx.beginPath();
      ctx.arc(G.X(Math.min(t, tMax)), clamp(G.Y(yv), G.B.y, G.B.y + G.B.h), 5 / cur, 0, Math.PI * 2);
      ctx.fill();
    }
    // legend
    let lx = G.B.x + 10 / cur + G.yw;
    const ly = G.B.y + 16 / cur;
    const leg = (label: string, col: string, dash = false) => {
      ctx.font = fs(10, 700);
      ctx.fillStyle = withAlpha(pal['surface-2'], 0.85);
      ctx.fillRect(lx - 4 / cur, ly - 13 / cur, ctx.measureText(label).width + 30 / cur, 18 / cur);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5 / cur;
      ctx.setLineDash(dash ? [6 / cur, 4 / cur] : []);
      ctx.beginPath();
      ctx.moveTo(lx, ly - 4 / cur);
      ctx.lineTo(lx + 18 / cur, ly - 4 / cur);
      ctx.stroke();
      ctx.setLineDash([]);
      text(label, lx + 22 / cur, ly, 10, pal['text-muted'], 'left', 700);
      ctx.font = fs(10, 700);
      lx += ctx.measureText(label).width + 36 / cur;
    };
    leg('RK4 simulation', C_NUM);
    if (ex) leg('exact solution', C_EX, true);
    kept.forEach((kp, i) => leg(kp.label, C_KEEP[i]));
  }
  function drawInfo(B: Box) {
    panel(B);
    let yy = B.y + 22;
    const x0 = B.x + 12;
    const ln = (s: string, col = pal['text-muted'], px = 11, wt = 650) => {
      yy = wrap(s, x0, yy, B.w - 24, px, col, wt, B.y + B.h - 6);
    };
    if (st.model === 'exp') {
      ln('dN/dt = kN   →   N(t) = N₀·e^(kt)', pal['sim-text'], 13, 800);
      ln(`k = ${fmt(st.k)}: ${st.k > 0 ? `growth; N doubles every ln 2 / k = ${fmt(Math.LN2 / st.k)} time units` : st.k < 0 ? `decay; N halves every ln 2 / |k| = ${fmt(Math.LN2 / -st.k)} time units (the half-life)` : 'no change'}.`, pal['text-muted'], 11);
      ln('The rate of change is proportional to the amount present, so the curve gets steeper (growth) or flatter (decay) in proportion to N.', pal['text-faint'], 10.5);
    } else if (st.model === 'cooling') {
      ln('dT/dt = −k(T − Tₐ)   →   T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt)', pal['sim-text'], 12.5, 800);
      ln(`The gap to room temperature halves every ln 2 / k = ${fmt(Math.LN2 / st.kc)} min. The object approaches Tₐ but, in this model, never quite reaches it.`, pal['text-muted'], 11);
      ln('Assumes a constant room temperature and a constant cooling coefficient k, and that the object has one uniform temperature.', pal['text-faint'], 10.5);
    } else if (st.model === 'spring') {
      const w0 = Math.sqrt(st.ks / st.m);
      const crit = 2 * Math.sqrt(st.m * st.ks);
      const zeta = st.b / crit;
      ln('m x″ + b x′ + k x = 0', pal['sim-text'], 13, 800);
      ln(`Natural frequency ω₀ = √(k/m) = ${fmt(w0)} rad/s (period ${fmt((2 * Math.PI) / w0)} s without damping). Critical damping b = 2√(mk) = ${fmt(crit)} N·s/m; here b/b_crit = ${fmt(zeta, 3)}.`, pal['text-muted'], 11);
      ln(zeta < 1 - 2e-3 ? 'Underdamped (b² < 4mk): it oscillates with a decaying amplitude.' : zeta > 1 + 2e-3 ? 'Overdamped (b² > 4mk): it creeps back to equilibrium without oscillating.' : 'Critically damped (b² = 4mk): the fastest return to equilibrium without overshooting.', pal.accent, 11, 750);
    } else if (st.model === 'logistic') {
      ln('dN/dt = rN(1 − N/K)', pal['sim-text'], 13, 800);
      ln(`Growth is fastest at N = K/2 = ${fmt(st.K / 2)}, where dN/dt = rK/4 = ${fmt((st.r * st.K) / 4)}. As N approaches K the factor (1 − N/K) shrinks and growth slows to zero; above K, N decreases.`, pal['text-muted'], 11);
      ln('Equilibria: N = 0 (unstable) and N = K (stable). A mathematical model, not a description of every real population.', pal['text-faint'], 10.5);
    }
  }

  /* ======================= Linear system (phase plane) ======================= */
  const PR = 4.5; // phase-plane half-width
  let PH: Box = { x: 0, y: 0, w: 1, h: 1 };
  const PXf = (v: number) => PH.x + PH.w / 2 + (v / PR) * (Math.min(PH.w, PH.h) / 2);
  const PYf = (v: number) => PH.y + PH.h / 2 - (v / PR) * (Math.min(PH.w, PH.h) / 2);
  const PXi = (px: number) => ((px - PH.x - PH.w / 2) / (Math.min(PH.w, PH.h) / 2)) * PR;
  const PYi = (py: number) => -((py - PH.y - PH.h / 2) / (Math.min(PH.w, PH.h) / 2)) * PR;
  function drawPhase(B: Box) {
    PH = B;
    panel(B, pal['surface-2']);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(B.x, B.y, B.w, B.h, 10);
    ctx.clip();
    // grid and axes
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.2);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let k = -10; k <= 10; k++) {
      ctx.moveTo(PXf(k), B.y);
      ctx.lineTo(PXf(k), B.y + B.h);
      ctx.moveTo(B.x, PYf(k));
      ctx.lineTo(B.x + B.w, PYf(k));
    }
    ctx.stroke();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5 / cur;
    ctx.beginPath();
    ctx.moveTo(B.x, PYf(0));
    ctx.lineTo(B.x + B.w, PYf(0));
    ctx.moveTo(PXf(0), B.y);
    ctx.lineTo(PXf(0), B.y + B.h);
    ctx.stroke();
    // direction field
    const n = 17;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = -PR + ((i + 0.5) / n) * 2 * PR;
        const yy = -PR + ((j + 0.5) / n) * 2 * PR;
        const dx = st.a * x + st.bb * yy;
        const dy = st.c * x + st.d * yy;
        const L = Math.hypot(dx, dy);
        if (L < 1e-9) continue;
        const len = ((2 * PR) / n) * 0.38;
        const ux = (dx / L) * len;
        const uy = (dy / L) * len;
        arrow(PXf(x - ux / 2), PYf(yy - uy / 2), PXf(x + ux / 2), PYf(yy + uy / 2), withAlpha(pal['text-faint'], 0.6), 1.1);
      }
    // eigen-directions
    const E = eigen2(st.a, st.bb, st.c, st.d);
    const lines: [number[], number][] = E.kind === 'distinct' ? [[E.v[0], E.l[0]], [E.v[1], E.l[1]]] : E.kind === 'defective' ? [[E.v, E.l]] : [];
    for (const [[vx, vy], l] of lines) {
      ctx.strokeStyle = withAlpha('#2f9e44', 0.8);
      ctx.setLineDash([8 / cur, 6 / cur]);
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.moveTo(PXf(-20 * vx), PYf(-20 * vy));
      ctx.lineTo(PXf(20 * vx), PYf(20 * vy));
      ctx.stroke();
      ctx.setLineDash([]);
      text(`λ = ${fmt(l, 3)}`, PXf(3.6 * vx) + 6 / cur, PYf(3.6 * vy) - 6 / cur, 11, '#2f9e44', 'left', 800);
    }
    // trajectories with a moving dot at time t
    trajs.forEach((tr, k) => {
      const col = ['#1c7ed6', '#e8590c', '#ae3ec9', '#0ca678', '#f08c00', '#e64980', '#4263eb', '#495057'][k % 8];
      ctx.strokeStyle = withAlpha(col, 0.85);
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      tr.pts.forEach(([x, yy], i) => (i ? ctx.lineTo(PXf(x), PYf(yy)) : ctx.moveTo(PXf(x), PYf(yy))));
      ctx.stroke();
      const idx = Math.min(tr.pts.length - 1, Math.round(t / 0.01));
      const [px, py] = tr.pts[idx];
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(PXf(px), PYf(py), 5 / cur, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      ctx.arc(PXf(tr.start[0]), PYf(tr.start[1]), 4 / cur, 0, Math.PI * 2);
      ctx.stroke();
    });
    // equilibrium
    ctx.fillStyle = pal['sim-text'];
    ctx.beginPath();
    ctx.arc(PXf(0), PYf(0), 4.5 / cur, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text('Tap to start a trajectory from that point', B.x + 10 / cur, B.y + 18 / cur, 10.5, pal['text-muted'], 'left', 700);
    text('x', B.x + B.w - 10 / cur, PYf(0) - 6 / cur, 11, pal['text-muted'], 'right', 750);
    text('y', PXf(0) + 6 / cur, B.y + 34 / cur, 11, pal['text-muted'], 'left', 750);
  }
  function drawLinearSide(TS: Box, IB: Box) {
    const tr = trajs[trajs.length - 1];
    const tMax = 10;
    const pts = tr ? tr.pts.slice(0, Math.round(tMax / 0.01) + 1) : [];
    let lo = -1;
    let hi = 1;
    for (const [x, yy] of pts) {
      lo = Math.min(lo, x, yy);
      hi = Math.max(hi, x, yy);
    }
    lo = Math.max(lo, -12);
    hi = Math.min(hi, 12);
    const G = graph(TS, 0, tMax, lo, hi, 't', '');
    plotLine(G, pts.map(([x], i) => [i * 0.01, x]), '#1c7ed6', 2);
    plotLine(G, pts.map(([, yy], i) => [i * 0.01, yy]), '#e8590c', 2, [6, 4]);
    text('x (solid) · y (dashed), last trajectory', G.B.x + 8 / cur, G.B.y + 14 / cur, 9.5, pal['text-muted'], 'left', 700);
    panel(IB);
    let yy = IB.y + 22;
    const x0 = IB.x + 12;
    const ln = (s: string, col = pal['text-muted'], px = 11, wt = 650) => {
      yy = wrap(s, x0, yy, IB.w - 24, px, col, wt, IB.y + IB.h - 6);
    };
    const C = classify();
    const tr2 = st.a + st.d;
    const det = st.a * st.d - st.bb * st.c;
    ln(`x′ = ${fmt(st.a, 3)}x + ${fmt(st.bb, 3)}y,   y′ = ${fmt(st.c, 3)}x + ${fmt(st.d, 3)}y`.replace(/\+ −/g, '− '), pal['sim-text'], 12, 800);
    ln(`trace = ${fmt(tr2, 3)}, det = ${fmt(det, 3)}, trace² − 4det = ${fmt(tr2 * tr2 - 4 * det, 3)}`, pal['text-muted'], 10.5);
    ln(`Equilibrium at (0, 0): ${C.name} — ${C.stable}.`, C.tone === 'ok' ? pal.success : C.tone === 'bad' ? pal.danger : pal.warning, 11.5, 800);
    const E = eigen2(st.a, st.bb, st.c, st.d);
    ln(
      E.kind === 'complex'
        ? `Eigenvalues ${fmt(E.re, 3)} ± ${fmt(E.im, 3)}i: complex, so trajectories turn around the origin; the real part ${E.re < 0 ? 'shrinks' : E.re > 0 ? 'grows' : 'keeps'} them.`
        : E.kind === 'distinct'
          ? `Eigenvalues ${fmt(E.l[0], 3)} and ${fmt(E.l[1], 3)}: along each green line the solution is a pure exponential e^(λt)·v.`
          : `Repeated eigenvalue ${fmt(E.l, 3)}.`,
      pal['text-muted'],
      10.5,
    );
  }

  /* ======================= Euler view ======================= */
  function drawEuler(GB: Box, SB: Box) {
    const P = EP[st.prob];
    const steps = eulerSteps();
    const shown = steps.slice(0, eulerShown + 1);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = P.exact((P.tMax * i) / 100);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    for (const s of shown) if (Number.isFinite(s.y) && Math.abs(s.y) < 1e6) ((lo = Math.min(lo, s.y)), (hi = Math.max(hi, s.y)));
    lo = Math.min(lo, 0);
    const pad = (hi - lo) * 0.08;
    const G = graph(GB, 0, P.tMax, lo - pad, hi + pad, 't', 'y');
    plotLine(G, sample(P.exact, 0, P.tMax), C_EX, 2.5, [7, 5]);
    plotLine(G, shown.map((s) => [s.t, s.y]), C_NUM, 2.5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(G.B.x, G.B.y, G.B.w, G.B.h);
    ctx.clip();
    shown.forEach((s, i) => {
      ctx.fillStyle = C_NUM;
      ctx.beginPath();
      ctx.arc(G.X(s.t), G.Y(s.y), 4 / cur, 0, Math.PI * 2);
      ctx.fill();
      if (i === shown.length - 1 && i < steps.length - 1) {
        // the tangent used for the next step
        const t1 = s.t + st.h;
        const y1 = s.y + st.h * s.slope;
        ctx.strokeStyle = '#2f9e44';
        ctx.lineWidth = 2.5 / cur;
        ctx.setLineDash([5 / cur, 4 / cur]);
        ctx.beginPath();
        ctx.moveTo(G.X(s.t), G.Y(s.y));
        ctx.lineTo(G.X(t1), G.Y(y1));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#2f9e44';
        ctx.beginPath();
        ctx.arc(G.X(t1), G.Y(y1), 5 / cur, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.restore();
    text(portrait() ? 'Blue: Euler · orange: exact · green: next tangent' : 'Blue: Euler steps · orange dashed: exact · green: tangent for the next step', G.B.x + 8 / cur + G.yw, G.B.y + 14 / cur, 10, pal['text-muted'], 'left', 700);
    // side: the update and a table
    panel(SB);
    let yy = SB.y + 22;
    const x0 = SB.x + 12;
    const ln = (s: string, col = pal['text-muted'], px = 11, wt = 650) => {
      yy = wrap(s, x0, yy, SB.w - 24, px, col, wt, SB.y + SB.h - 6);
    };
    ln(P.eq, pal['sim-text'], 12, 800);
    ln(`Exact: ${P.ex}`, C_EX, 11, 750);
    ln('yₙ₊₁ = yₙ + h · f(tₙ, yₙ): new value = current value + step × current rate', pal['text-muted'], 10.5);
    const s = shown[shown.length - 1];
    if (s && eulerShown < steps.length - 1) ln(`Next: y${eulerShown + 1} = ${fmt(s.y)} + ${fmt(st.h)} × (${fmt(s.slope)}) = ${fmt(s.y + st.h * s.slope)}`, '#2f9e44', 10.5, 750);
    yy += 4 / cur;
    const spread = Math.min((SB.w - 24) / 300, Math.max(1 / cur, portrait() ? 1.9 : 1));
    const cols = [0, 34, 92, 170, 248].map((c) => c * spread);
    const head = ['n', 'tₙ', 'yₙ (Euler)', 'exact', 'error'];
    head.forEach((h, i) => text(h, x0 + cols[i], yy, 10, pal['sim-text'], 'left', 800));
    yy += 15 / cur;
    const rows = shown.length <= 9 ? shown.map((r, i) => [i, r] as const) : [...shown.slice(0, 4).map((r, i) => [i, r] as const), ...shown.slice(-4).map((r, i) => [shown.length - 4 + i, r] as const)];
    rows.forEach(([n, r], k) => {
      if (yy > SB.y + SB.h - 30 / cur) return;
      if (shown.length > 9 && k === 4) {
        text('⋮', x0 + cols[1], yy, 10, pal['text-faint'], 'left', 700);
        yy += 13 / cur;
      }
      const exv = P.exact(r.t);
      [String(n), cell(r.t, 3), cell(r.y, 4), cell(exv, 4), cell(r.y - exv, 2)].forEach((c, i) => text(c, x0 + cols[i], yy, 10, i === 4 ? (Math.abs(r.y - exv) > 0.1 * Math.max(1, Math.abs(exv)) ? pal.danger : pal['text-muted']) : pal['text-muted'], 'left', 650));
      yy += 14 / cur;
    });
    const f = eulerFactor();
    if (P.k < 0 && Math.abs(f) >= 1) ln(`Unstable: each step multiplies the gap by 1 + hk = ${fmt(f, 3)}, and |1 + hk| ≥ 1, so the errors grow instead of dying away. Use h < ${fmt(2 / -P.k, 3)}.`, pal.danger, 10.5, 750);
    else if (P.k < 0 && f < 0) ln(`Each step multiplies the gap by 1 + hk = ${fmt(f, 3)} < 0, so the Euler values overshoot and zig-zag around the exact curve.`, pal.warning, 10.5, 750);
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
    massBox = null;
    if (st.model === 'linear') {
      const L = phaseLayout();
      drawPhase(L.phase);
      drawLinearSide(L.ts, L.info);
    } else if (st.model === 'euler') {
      const L = eulerLayout();
      drawEuler(L.graph, L.side);
    } else {
      const L = layout();
      drawVisual(L.vis);
      drawModelGraph(L.graph);
      drawInfo(L.info);
    }
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
    let note = lastMsg;
    const m = M();
    if (st.model === 'euler') {
      const P = EP[st.prob];
      const steps = eulerSteps();
      const s = steps[Math.min(eulerShown, steps.length - 1)];
      const last = steps[steps.length - 1];
      r('r1', 'Step size h', fmt(st.h));
      r('r2', 'Steps shown', `${eulerShown} of ${steps.length - 1}`);
      r('r3', `Euler y at t = ${fmt(s.t, 3)}`, fmt(s.y, 6));
      r('r4', 'Exact y there', fmt(P.exact(s.t), 6));
      r('r5', `Error at the end (t = ${fmt(last.t, 3)})`, fmt(last.y - P.exact(last.t), 3), Math.abs(last.y - P.exact(last.t)) > 0.1 * Math.max(1, Math.abs(P.exact(last.t))) ? 'bad' : null);
      r('r6', 'Stability factor 1 + hk', fmt(eulerFactor(), 3), P.k < 0 && Math.abs(eulerFactor()) >= 1 ? 'bad' : null);
      note ||= P.k < 0 && Math.abs(eulerFactor()) >= 1
        ? `With h = ${fmt(st.h)} Euler’s method is unstable for this equation: each step multiplies the gap by ${fmt(eulerFactor(), 3)}, so the numbers zig-zag and grow while the true solution decays. Make h smaller than ${fmt(2 / -P.k, 3)}.`
        : 'Euler’s method follows the tangent line for one step of length h, then repeats from the new point. Smaller steps follow the curve more closely: halving h roughly halves the error. Press Step or Start.';
      sim.setBadge(`Euler, h = ${fmt(st.h)}`);
    } else if (st.model === 'linear') {
      const C = classify();
      const E = eigen2(st.a, st.bb, st.c, st.d);
      r('r1', 'Equilibrium (0, 0)', C.name, C.tone);
      r('r2', 'Stability', C.stable);
      r('r3', 'Trace · det', `${fmt(st.a + st.d, 3)} · ${fmt(st.a * st.d - st.bb * st.c, 3)}`);
      r('r4', 'Eigenvalues', E.kind === 'distinct' ? `${fmt(E.l[0], 3)}, ${fmt(E.l[1], 3)}` : E.kind === 'complex' ? `${fmt(E.re, 3)} ± ${fmt(E.im, 3)}i` : `${fmt(E.l, 3)} (repeated)`);
      r('r5', 'Trajectories', `${trajs.length}`);
      r('r6', 'Time', fmt(t, 3));
      note ||= 'Each arrow shows the direction (x′, y′) the system moves at that point. Tap the plane to launch a trajectory; press Start to move along all of them at once.';
      sim.setBadge(C.name);
    } else if (m) {
      const tm = Math.min(t, m.tMax);
      const ex = m.exact ? m.exact(tm) : NaN;
      r('r1', 'Time t', `${fmt(tm, 4)}${m.tUnit ? ` ${m.tUnit}` : ''}`);
      r('r2', `${m.yLabel} (RK4)`, `${fmt(y[0], 6)}${m.yUnit ? ` ${m.yUnit}` : ''}`);
      r('r3', `${m.yLabel} (exact)`, `${fmt(ex, 6)}${m.yUnit ? ` ${m.yUnit}` : ''}`);
      r('r4', 'Difference', fmt(y[0] - ex, 2));
      if (st.model === 'exp') {
        r('r5', 'Rate dN/dt', fmt(st.k * y[0]));
        r('r6', st.k >= 0 ? 'Doubling time' : 'Half-life', st.k === 0 ? '—' : fmt(Math.LN2 / Math.abs(st.k)));
      } else if (st.model === 'cooling') {
        r('r5', 'Rate dT/dt', `${fmt(-st.kc * (y[0] - st.Ta), 3)} °C/min`);
        r('r6', 'Gap halves every', `${fmt(Math.LN2 / st.kc, 3)} min`);
      } else if (st.model === 'spring') {
        const z = st.b / (2 * Math.sqrt(st.m * st.ks));
        r('r5', 'Damping', z < 1 - 2e-3 ? `Underdamped (ζ = ${fmt(z, 2)})` : z > 1 + 2e-3 ? `Overdamped (ζ = ${fmt(z, 2)})` : 'Critically damped (ζ = 1)');
        r('r6', 'Energy ½mv² + ½kx²', `${fmt(0.5 * st.m * y[1] ** 2 + 0.5 * st.ks * y[0] ** 2, 3)} J`);
      } else {
        r('r5', 'Rate dN/dt', fmt(st.r * y[0] * (1 - y[0] / st.K)));
        r('r6', 'N / K', fmt(y[0] / st.K, 3));
      }
      note ||= {
        exp: 'Change N₀ and k, then press Start. With k > 0 the quantity grows faster and faster; with k < 0 it decays. The faint segments are the slope field: the slope dN/dt at every point.',
        cooling: 'Set the starting and room temperatures and the cooling constant, then press Start. Cooling is fastest at first, when the temperature gap is largest.',
        spring: 'Drag the mass and let go, or press Start. Change the damping b to compare underdamped, critically damped and overdamped motion; the graph and the animation show the same x(t).',
        logistic: 'Press Start. Growth starts almost exponentially, is fastest at K/2, and levels off at the carrying capacity K. Try N₀ above K.',
      }[st.model as 'exp' | 'cooling' | 'spring' | 'logistic'];
      sim.setBadge(modelSel.selectedOptions[0]?.textContent?.split(':')[0] ?? '');
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', `${modelSel.selectedOptions[0]?.textContent ?? ''}. ${noteEl.textContent}`);
  }

  /* ======================= Interaction ======================= */
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return toBox(e.clientX - r.left, e.clientY - r.top);
  };
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    const [bx, by] = local(e);
    if (st.model === 'spring' && massBox && bx >= massBox.x - 10 && bx <= massBox.x + massBox.w + 10 && by >= massBox.y - 10 && by <= massBox.y + massBox.h + 10) {
      dragging = true;
      sim.pause();
      canvas.setPointerCapture(e.pointerId);
    } else if (st.model === 'linear') {
      const L = phaseLayout().phase;
      if (bx >= L.x && bx <= L.x + L.w && by >= L.y && by <= L.y + L.h) {
        PH = L;
        trajs.push(traj(PXi(bx), PYi(by)));
        if (trajs.length > 8) trajs.shift();
        t = 0;
        lastMsg = '';
        sim.requestRender();
      }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const [bx, by] = local(e);
    if (!dragging) {
      if (e.pointerType === 'mouse') canvas.style.cursor = st.model === 'spring' && massBox && bx >= massBox.x && bx <= massBox.x + massBox.w && by >= massBox.y && by <= massBox.y + massBox.h ? 'grab' : st.model === 'linear' ? 'crosshair' : '';
      return;
    }
    const x = clamp(+((bx - springGeom.x0) / springGeom.scale).toFixed(2), -0.5, 0.5);
    x0Ctl.set(x, false);
    st.x0 = x;
    restart();
    lastMsg = '';
    sim.requestRender();
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = '';
    restart();
    sim.play();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const [bx, by] = local(e.touches[0]);
      if (st.model === 'spring' && massBox && bx >= massBox.x - 10 && bx <= massBox.x + massBox.w + 10 && by >= massBox.y - 10 && by <= massBox.y + massBox.h + 10) e.preventDefault();
    },
    { passive: false },
  );

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.querySelectorAll<HTMLElement>('[data-views]').forEach((el) => (el.hidden = !el.dataset.views!.split(' ').includes(st.model)));
  }
  const paramChanged = () => {
    lastMsg = '';
    sim.pause();
    restart();
    sim.requestRender();
  };
  modelSel.addEventListener('change', () => {
    st.model = modelSel.value as ModelId;
    kept = [];
    eulerShown = 0;
    showView();
    paramChanged();
  });
  const speedCtl = ui.range('de-speed', (q) => `${q}×`, (q) => ((st.speed = q), sim.requestRender()));
  const fieldCtl = ui.toggle('de-field', (q) => ((st.field = q), sim.requestRender()));
  const mk = (name: string, key: keyof typeof st, fmtf: (q: number) => string) => ui.range(name, fmtf, (q) => (((st as Record<string, unknown>)[key] = q), paramChanged()));
  const ctl = {
    N0: mk('de-n0', 'N0', (q) => fmt(q)),
    k: mk('de-k', 'k', (q) => fmt(q)),
    T0: mk('de-t0', 'T0', (q) => `${q} °C`),
    Ta: mk('de-ta', 'Ta', (q) => `${q} °C`),
    kc: mk('de-kc', 'kc', (q) => `${fmt(q)} per min`),
    m: mk('de-m', 'm', (q) => `${fmt(q)} kg`),
    ks: mk('de-ks', 'ks', (q) => `${fmt(q)} N/m`),
    b: mk('de-b', 'b', (q) => `${fmt(q)} N·s/m`),
    L0: mk('de-l0', 'L0', (q) => fmt(q)),
    r: mk('de-r', 'r', (q) => fmt(q)),
    K: mk('de-kk', 'K', (q) => fmt(q)),
    a: ui.range('de-a', (q) => fmt(q), (q) => ((st.a = q), defaultTrajs(), (t = 0), (lastMsg = ''), sim.requestRender())),
    bb: ui.range('de-bb', (q) => fmt(q), (q) => ((st.bb = q), defaultTrajs(), (t = 0), (lastMsg = ''), sim.requestRender())),
    c: ui.range('de-c', (q) => fmt(q), (q) => ((st.c = q), defaultTrajs(), (t = 0), (lastMsg = ''), sim.requestRender())),
    d: ui.range('de-d', (q) => fmt(q), (q) => ((st.d = q), defaultTrajs(), (t = 0), (lastMsg = ''), sim.requestRender())),
    h: ui.range('de-h', (q) => fmt(q), (q) => ((st.h = q), (eulerShown = 0), (lastMsg = ''), sim.pause(), sim.requestRender())),
  };
  const x0Ctl = mk('de-x0', 'x0', (q) => `${fmt(q)} m`);
  const probCtl = ui.choice<'decay' | 'growth' | 'cooling'>('de-prob', (q) => ((st.prob = q), (eulerShown = 0), (lastMsg = ''), sim.pause(), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-damp]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const crit = 2 * Math.sqrt(st.m * st.ks);
      const v = { under: crit * 0.15, critical: crit, over: crit * 2.5 }[btn.dataset.damp as 'under' | 'critical' | 'over'];
      const el = root.querySelector<HTMLInputElement>('[data-ctrl="de-b"]')!;
      el.max = String(Math.max(+el.max, Math.ceil(v)));
      ctl.b.set(+v.toFixed(3), false);
      st.b = +v.toFixed(3);
      paramChanged();
      sim.play();
    }),
  );
  const LIN: Record<string, number[]> = {
    saddle: [1, 1, 4, -2],
    snode: [-2, 0.5, 0.5, -1],
    unode: [2, 0.5, 0.5, 1],
    sspiral: [-0.5, 2, -2, -0.5],
    centre: [0, 2, -1.5, 0],
    uspiral: [0.3, 2, -2, 0.3],
  };
  root.querySelectorAll<HTMLButtonElement>('[data-lin]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const [a, b, c, d] = LIN[btn.dataset.lin!];
      Object.assign(st, { a, bb: b, c, d });
      ctl.a.set(a, false);
      ctl.bb.set(b, false);
      ctl.c.set(c, false);
      ctl.d.set(d, false);
      defaultTrajs();
      t = 0;
      lastMsg = '';
      sim.play();
    }),
  );
  root.querySelector('[data-clear-traj]')?.addEventListener('click', () => {
    trajs = [];
    sim.requestRender();
  });
  root.querySelector('[data-keep]')?.addEventListener('click', () => {
    const m = M();
    if (!m || hist.length < 2) {
      lastMsg = 'Run the model first (press Start), then keep the curve.';
      sim.requestRender();
      return;
    }
    const label = { exp: `k = ${fmt(st.k)}`, cooling: `k = ${fmt(st.kc)}, Tₐ = ${st.Ta}`, spring: `b = ${fmt(st.b)}`, logistic: `r = ${fmt(st.r)}, K = ${st.K}` }[st.model as 'exp' | 'cooling' | 'spring' | 'logistic'];
    kept.push({ label, pts: hist.map((hh) => [hh.t, hh.y[0]]) });
    if (kept.length > 3) kept.shift();
    lastMsg = 'Curve kept. Change a value and press Start to compare.';
    sim.requestRender();
  });
  root.querySelector('[data-unkeep]')?.addEventListener('click', () => {
    kept = [];
    sim.requestRender();
  });
  root.querySelector('[data-step]')?.addEventListener('click', () => {
    sim.pause();
    if (st.model === 'euler') {
      if (eulerShown < eulerSteps().length - 1) eulerShown++;
    } else {
      const m = M()!;
      if (t < m.tMax) advance({ exp: 0.25, cooling: 2, spring: 0.05, logistic: 0.5, linear: 0.1 }[st.model as Exclude<ModelId, 'euler'>]);
    }
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(on: boolean) {
      if (!on) return;
      const m = M();
      if (m && t >= m.tMax - 1e-9) restart();
      if (st.model === 'euler' && eulerShown >= eulerSteps().length - 1) eulerShown = 0;
      lastMsg = '';
    },
    reset() {
      Object.assign(st, { speed: 1, field: true, N0: 10, k: 0.3, T0: 90, Ta: 20, kc: 0.08, m: 1, ks: 10, b: 0.8, x0: 0.4, L0: 5, r: 0.8, K: 100, a: -1, bb: 2, c: -2, d: -1, prob: 'decay', h: 0.5 });
      speedCtl.set(1, false);
      fieldCtl.set(true, false);
      for (const [k2, c2] of Object.entries(ctl)) c2.set((st as unknown as Record<string, number>)[k2], false);
      x0Ctl.set(0.4, false);
      probCtl.set('decay', false);
      kept = [];
      eulerShown = 0;
      lastMsg = '';
      restart();
    },
  });

  restart();
  showView();
  sim.requestRender();
}
