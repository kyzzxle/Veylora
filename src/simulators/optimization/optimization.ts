/**
 * Optimization lab.
 *   lp     Two-variable linear programming: drag constraint lines, sweep the
 *          objective level line, check the corners one by one.
 *   sens   The same problem seen through sensitivity: slack, binding constraints,
 *          the best value as a limit changes (shadow price) and the range of
 *          objective coefficients that keeps the same corner optimal.
 *   geom   Calculus optimization: fenced field, open box, can, with a gradient
 *          (hill-climbing) search animation.
 *   alloc  Resource-allocation challenges with whole-number plans.
 * All linear programs are solved exactly by the corner-point method in lp.ts.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import * as L from './lp';
import type { Con, LP, Pt, Row, Solution } from './lp';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'lp' | 'sens' | 'geom' | 'alloc';
type Shape = 'rect' | 'box' | 'can';
type Level = '1' | '2' | '3';
type Box = { x: number; y: number; w: number; h: number };
const C_CON = ['#1c7ed6', '#e8590c', '#ae3ec9', '#0c8599'];
const C_OPT = '#2f9e44';
const C_OBJ = '#f08c00';

const fmt = (v: number, sig = 4) => {
  if (!Number.isFinite(v)) return v === Infinity ? '∞' : v === -Infinity ? '−∞' : '—';
  if (Math.abs(v) < 1e-9) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) {
    const [m, e] = v.toExponential(sig - 1).split('e');
    return `${(+m).toString().replace('-', '−')} × 10^${+e}`.replace('^-', '^−');
  }
  return (+v.toPrecision(sig)).toString().replace('-', '−');
};
const fp = (p: Pt) => `(${fmt(p[0], 3)}, ${fmt(p[1], 3)})`;
/** "3x − y", "y", "0" */
function fmtLin(a: number, b: number, xv = 'x', yv = 'y') {
  const term = (k: number, v: string, first: boolean) => {
    if (Math.abs(k) < 1e-12) return '';
    const sign = k < 0 ? (first ? '−' : ' − ') : first ? '' : ' + ';
    const m = Math.abs(k);
    return `${sign}${m === 1 ? '' : fmt(m)}${v}`;
  };
  const s1 = term(a, xv, true);
  const s2 = term(b, yv, !s1);
  return s1 + s2 || '0';
}
const conText = (k: Con) => `${fmtLin(k.a, k.b)} ${k.sense === '<=' ? '≤' : '≥'} ${fmt(k.c)}`;

/* ======================= Example problems ======================= */
const on = (a: number, b: number, c: number, sense: Con['sense'] = '<='): Con => ({ a, b, c, sense, on: true });
const off = (a: number, b: number, c: number, sense: Con['sense'] = '<='): Con => ({ a, b, c, sense, on: false });
const PRESETS: Record<string, { lp: LP; span: number; note: string }> = {
  textbook: {
    lp: { cx: 3, cy: 2, goal: 'max', cons: [on(1, 1, 4), on(1, 0, 2), on(0, 1, 3), off(1, 2, 7)] },
    span: 5,
    note: 'Maximize Z = 3x + 2y subject to x + y ≤ 4, x ≤ 2, y ≤ 3, x ≥ 0, y ≥ 0. The shaded region holds every point that satisfies all the constraints. Press Start to sweep the level line, or Check next corner.',
  },
  multiple: {
    lp: { cx: 2, cy: 2, goal: 'max', cons: [on(1, 1, 4), on(1, 0, 2), on(0, 1, 3), off(1, 2, 7)] },
    span: 5,
    note: 'Z = 2x + 2y has level lines parallel to the edge x + y = 4, so the best level line touches a whole edge: every point on it is optimal.',
  },
  unbounded: {
    lp: { cx: 1, cy: 1, goal: 'max', cons: [on(1, 1, 2, '>='), on(1, -1, 1), off(0, 1, 3), off(1, 2, 7)] },
    span: 6,
    note: 'The region is open towards the top right, and Z = x + y keeps increasing in that direction, so there is no maximum. Switch the goal to Minimize to see that a minimum still exists.',
  },
  infeasible: {
    lp: { cx: 3, cy: 2, goal: 'max', cons: [on(1, 1, 6, '>='), on(1, 0, 2), on(0, 1, 3), off(1, 2, 7)] },
    span: 7,
    note: 'x + y ≥ 6 cannot hold when x ≤ 2 and y ≤ 3 (their sum is at most 5), so no point satisfies all the constraints. Lower C1’s limit to 5 or less to fix it.',
  },
  minimize: {
    lp: { cx: 2, cy: 3, goal: 'min', cons: [on(1, 1, 4, '>='), on(1, 3, 6, '>='), on(1, 0, 5), off(0, 1, 5)] },
    span: 6,
    note: 'Minimize the cost Z = 2x + 3y. “At least” (≥) constraints push the region away from the origin; the cheapest corner is the last one the level line touches as it moves down.',
  },
};

/* ======================= Allocation challenges ======================= */
interface Res {
  name: string;
  unit: string;
  a: number;
  b: number;
  c: number;
  sense: Con['sense'];
}
interface Challenge {
  title: string;
  story: string;
  xName: string;
  yName: string;
  xShort: string;
  yShort: string;
  goal: 'max' | 'min';
  cx: number;
  cy: number;
  res: Res[];
  max: [number, number];
  span: number;
}
const LEVELS: Record<Level, Challenge> = {
  '1': {
    title: 'Bakery',
    story: 'A bakery makes batches of bread (x) and cakes (y). A batch of bread earns £3 profit and a batch of cakes £5. Flour, oven time and staff time are limited. Plan the day’s batches for the most profit.',
    xName: 'Batches of bread x',
    yName: 'Batches of cakes y',
    xShort: 'bread',
    yShort: 'cakes',
    goal: 'max',
    cx: 3,
    cy: 5,
    res: [
      { name: 'Flour', unit: 'kg', a: 2, b: 3, c: 60, sense: '<=' },
      { name: 'Oven time', unit: 'h', a: 1, b: 2, c: 36, sense: '<=' },
      { name: 'Staff time', unit: 'h', a: 2, b: 1, c: 40, sense: '<=' },
    ],
    max: [25, 25],
    span: 22,
  },
  '2': {
    title: 'Electronics factory',
    story: 'A factory makes crates of phones (x) and tablets (y), earning £50 and £80 profit a crate. Assembly and testing hours are limited, and only 11 crates of large screens (needed for tablets) are in stock. Crates must be whole numbers.',
    xName: 'Crates of phones x',
    yName: 'Crates of tablets y',
    xShort: 'phones',
    yShort: 'tablets',
    goal: 'max',
    cx: 50,
    cy: 80,
    res: [
      { name: 'Assembly', unit: 'h', a: 3, b: 5, c: 75, sense: '<=' },
      { name: 'Testing', unit: 'h', a: 2, b: 2, c: 35, sense: '<=' },
      { name: 'Large screens', unit: 'crates', a: 0, b: 1, c: 11, sense: '<=' },
    ],
    max: [20, 15],
    span: 19,
  },
  '3': {
    title: 'Feed mix',
    story: 'A farm mixes bags of feed A (x, £4 a bag) and feed B (y, £3 a bag). The mix must give at least 12 units of protein, 10 of fibre and 14 of energy. Find the cheapest whole-bag mix.',
    xName: 'Bags of feed A x',
    yName: 'Bags of feed B y',
    xShort: 'feed A',
    yShort: 'feed B',
    goal: 'min',
    cx: 4,
    cy: 3,
    res: [
      { name: 'Protein', unit: 'units', a: 3, b: 1, c: 12, sense: '>=' },
      { name: 'Fibre', unit: 'units', a: 1, b: 2, c: 10, sense: '>=' },
      { name: 'Energy', unit: 'units', a: 2, b: 2, c: 14, sense: '>=' },
    ],
    max: [15, 15],
    span: 14,
  },
};
const allocLP = (lv: Level): LP => {
  const C = LEVELS[lv];
  return { cx: C.cx, cy: C.cy, goal: C.goal, cons: C.res.map((r) => on(r.a, r.b, r.c, r.sense)) };
};

/** Segment of the line cx·x + cy·y = k that lies inside all rows (null if none). */
function lineSeg(rows: Row[], cx: number, cy: number, k: number): [Pt, Pt] | null {
  const n2 = cx * cx + cy * cy;
  if (n2 < 1e-12) return null;
  const n = Math.sqrt(n2);
  const p0: Pt = [(cx * k) / n2, (cy * k) / n2];
  const d: Pt = [-cy / n, cx / n];
  let t0 = -1e7;
  let t1 = 1e7;
  for (const r of rows) {
    const den = r.a * d[0] + r.b * d[1];
    const num = r.c - (r.a * p0[0] + r.b * p0[1]);
    if (Math.abs(den) < 1e-12) {
      if (num < -1e-9) return null;
      continue;
    }
    const t = num / den;
    if (den > 0) t1 = Math.min(t1, t);
    else t0 = Math.max(t0, t);
  }
  if (t0 > t1 + 1e-9) return null;
  return [
    [p0[0] + t0 * d[0], p0[1] + t0 * d[1]],
    [p0[0] + t1 * d[0], p0[1] + t1 * d[1]],
  ];
}

export function initOptimization(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const viewSel = root.querySelector<HTMLSelectElement>('[data-view]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const clone = (lp: LP): LP => ({ ...lp, cons: lp.cons.map((k) => ({ ...k })) });
  const st = {
    view: 'lp' as View,
    lp: clone(PRESETS.textbook.lp),
    span: PRESETS.textbook.span,
    preset: 'textbook',
    sel: 0,
    contours: true,
    speed: 1,
    shape: 'rect' as Shape,
    P: 40,
    L: 30,
    W: 20,
    V: 500,
    gx: { rect: 6, box: 1.5, can: 2 } as Record<Shape, number>,
    level: '1' as Level,
    qx: 0,
    qy: 0,
  };
  let probe: Pt | null = null;
  let tour = -1;
  let sweep: { k0: number; k1: number; p: number } | null = null;
  let gd: { pts: number[]; acc: number } | null = null;
  let checked = false;
  let revealed = false;
  let lastMsg = '';

  const cache = new Map<string, Solution>();
  const solve = (lp: LP) => {
    const key = JSON.stringify(lp);
    let s = cache.get(key);
    if (!s) {
      s = L.solve(lp);
      if (cache.size > 40) cache.clear();
      cache.set(key, s);
    }
    return s;
  };
  const curLP = () => (st.view === 'alloc' ? allocLP(st.level) : st.lp);
  const curSpan = () => (st.view === 'alloc' ? LEVELS[st.level].span : st.span);
  const sgn = (lp: LP) => (lp.goal === 'max' ? 1 : -1);

  /* ======================= Geometric problems ======================= */
  const GEO = {
    rect: {
      lo: () => 0.5,
      hi: () => st.P / 2 - 0.5,
      f: (x: number) => L.rectArea(st.P, x),
      df: (x: number) => st.P / 2 - 2 * x,
      d2: () => -2,
      best: () => L.rectBest(st.P),
      goal: 1,
      xl: 'Width x',
      unit: 'm',
      fl: 'Area A',
      fu: 'm²',
    },
    box: {
      lo: () => 0.1,
      hi: () => Math.min(st.L, st.W) / 2 - 0.1,
      f: (x: number) => L.boxVolume(st.L, st.W, x),
      df: (x: number) => 12 * x * x - 4 * (st.L + st.W) * x + st.L * st.W,
      d2: () => 24 * L.boxBest(st.L, st.W) - 4 * (st.L + st.W),
      best: () => L.boxBest(st.L, st.W),
      goal: 1,
      xl: 'Cut size x',
      unit: 'cm',
      fl: 'Volume V',
      fu: 'cm³',
    },
    can: {
      lo: () => 1,
      hi: () => 12,
      f: (r: number) => L.canSurface(st.V, r),
      df: (r: number) => 4 * Math.PI * r - (2 * st.V) / (r * r),
      d2: () => 4 * Math.PI + (4 * st.V) / L.canBest(st.V) ** 3,
      best: () => L.canBest(st.V),
      goal: -1,
      xl: 'Radius r',
      unit: 'cm',
      fl: 'Surface area S',
      fu: 'cm²',
    },
  };
  const geo = () => GEO[st.shape];

  /* ======================= Animation ======================= */
  function windowRows(): Row[] {
    const W = plotWindow();
    return [
      { a: 1, b: 0, c: W.x1, id: -9 },
      { a: -1, b: 0, c: -W.x0, id: -9 },
      { a: 0, b: 1, c: W.y1, id: -9 },
      { a: 0, b: -1, c: -W.y0, id: -9 },
    ];
  }
  function startSweep() {
    const lp = curLP();
    const S = solve(lp);
    if (Math.hypot(lp.cx, lp.cy) < 1e-12) {
      lastMsg = 'The objective is 0x + 0y, so every point gives the same value. Give x or y a non-zero coefficient.';
      return false;
    }
    if (S.status === 'infeasible') {
      lastMsg = 'There is no shaded region for the level line to touch: the problem is infeasible.';
      return false;
    }
    const W = plotWindow();
    const corners: Pt[] = [
      [W.x0, W.y0],
      [W.x1, W.y0],
      [W.x0, W.y1],
      [W.x1, W.y1],
    ];
    const zs = corners.map((p) => L.objective(lp, p));
    const s = sgn(lp);
    const worst = s > 0 ? Math.min(...zs) : Math.max(...zs);
    const end = S.status === 'unbounded' ? (s > 0 ? Math.max(...zs) : Math.min(...zs)) : S.opt!.z;
    sweep = { k0: worst, k1: end, p: 0 };
    tour = -1;
    return true;
  }
  function finishSweep() {
    const lp = curLP();
    const S = solve(lp);
    const word = lp.goal === 'max' ? 'increases' : 'decreases';
    if (S.status === 'unbounded') lastMsg = `The level line moved the way Z ${word} and reached the edge of the graph while still touching the region. It could go on forever, so Z has no ${lp.goal === 'max' ? 'maximum' : 'minimum'}: the problem is unbounded.`;
    else if (S.status === 'multiple') lastMsg = `The last level line that still touches the region is Z = ${fmt(S.opt!.z)}. It lies along a whole edge, so every point of that edge is optimal (multiple optima).`;
    else lastMsg = `The level line moved the way Z ${word}. The last position that still touches the shaded region is Z = ${fmt(S.opt!.z)}, at the corner ${fp(S.opt!.p)}: that corner is the optimum.`;
    if (st.view === 'alloc') lastMsg += ' Fractions are allowed there; the best whole-number plan may be a little worse.';
  }
  function startGradient() {
    const g = geo();
    gd = { pts: [st.gx[st.shape]], acc: 0 };
    lastMsg = '';
    return g;
  }
  function gradientStep() {
    if (!gd) return true;
    const g = geo();
    const lo = g.lo();
    const hi = g.hi();
    const x = gd.pts[gd.pts.length - 1];
    const eta = 0.5 / Math.abs(g.d2());
    const dx = clamp(g.goal * eta * g.df(x), -0.25 * (hi - lo), 0.25 * (hi - lo));
    const nx = clamp(x + dx, lo, hi);
    gd.pts.push(nx);
    st.gx[st.shape] = nx;
    xCtl.set(+nx.toFixed(2), false);
    const done = Math.abs(nx - x) < 1e-4 * (hi - lo) || gd.pts.length > 40;
    if (done) lastMsg = `Hill climbing: each step moved ${{ rect: 'the width', box: 'the cut size', can: 'the radius' }[st.shape]} by a multiple of the slope ${g.goal > 0 ? 'uphill' : 'downhill'}. After ${gd.pts.length - 1} steps the slope is almost 0, at ${g.xl.split(' ').pop()} ≈ ${fmt(nx)} ${g.unit}, matching the calculus answer ${fmt(g.best())} ${g.unit}.`;
    return done;
  }
  function step(dt: number) {
    dt = Math.min(dt, 0.05) * st.speed;
    if (st.view === 'geom') {
      if (!gd) startGradient();
      gd!.acc += dt;
      if (gd!.acc >= 0.35) {
        gd!.acc = 0;
        if (gradientStep()) sim.pause();
      }
      return;
    }
    if (!sweep && !startSweep()) {
      sim.pause();
      return;
    }
    sweep!.p = Math.min(1, sweep!.p + dt / 4);
    if (sweep!.p >= 1) {
      finishSweep();
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
  /** Text on a translucent background, so it stays readable over lines. */
  function tag(s: string, x: number, yy: number, color: string, px = 10.5, align: CanvasTextAlign = 'left', wt = 750) {
    ctx.font = fs(px, wt);
    const w = ctx.measureText(s).width;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    ctx.fillStyle = withAlpha(pal['sim-bg'], 0.82);
    ctx.beginPath();
    ctx.roundRect(x0 - 4 / cur, yy - (px + 2) / cur, w + 8 / cur, (px + 7) / cur, 4 / cur);
    ctx.fill();
    text(s, x, yy, px, color, align, wt);
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
    const Ln = Math.hypot(x1 - x0, y1 - y0);
    if (Ln < 0.5) return;
    const a = Math.atan2(y1 - y0, x1 - x0);
    const hs = Math.min(11 / cur, Ln * 0.45);
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

  /* ======================= Layouts ======================= */
  const lpLayout = () => (portrait() ? { plot: { x: 14, y: 104, w: 652, h: 440 }, side: { x: 14, y: 556, w: 652, h: 432 } } : { plot: { x: 14, y: 14, w: 572, h: 572 }, side: { x: 598, y: 66, w: 388, h: 520 } });
  const sensLayout = () =>
    portrait()
      ? { plot: { x: 14, y: 104, w: 652, h: 360 }, graph: { x: 14, y: 476, w: 652, h: 200 }, side: { x: 14, y: 688, w: 652, h: 300 } }
      : { plot: { x: 14, y: 14, w: 470, h: 572 }, graph: { x: 496, y: 66, w: 490, h: 240 }, side: { x: 496, y: 318, w: 490, h: 268 } };
  const geomLayout = () =>
    portrait()
      ? { vis: { x: 14, y: 104, w: 652, h: 330 }, graph: { x: 14, y: 446, w: 652, h: 300 }, info: { x: 14, y: 758, w: 652, h: 230 } }
      : { vis: { x: 14, y: 14, w: 460, h: 572 }, graph: { x: 486, y: 66, w: 500, h: 320 }, info: { x: 486, y: 398, w: 500, h: 188 } };
  const allocLayout = () => (portrait() ? { plot: { x: 14, y: 104, w: 652, h: 470 }, side: { x: 14, y: 586, w: 652, h: 402 } } : { plot: { x: 14, y: 14, w: 520, h: 572 }, side: { x: 546, y: 66, w: 440, h: 520 } });
  const plotBox = (): Box => (st.view === 'sens' ? sensLayout().plot : st.view === 'alloc' ? allocLayout().plot : lpLayout().plot);

  /* ---------- the x–y plane for linear programs ---------- */
  interface Plane {
    P: Box;
    u: number;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    X: (v: number) => number;
    Y: (v: number) => number;
    Xi: (v: number) => number;
    Yi: (v: number) => number;
  }
  function plane(B: Box, span: number): Plane {
    const P = { x: B.x + 36, y: B.y + 12, w: B.w - 48, h: B.h - 40 };
    const lo = -0.08 * span;
    const u = Math.min(P.w, P.h) / (span - lo);
    return {
      P,
      u,
      x0: lo,
      x1: lo + P.w / u,
      y0: lo,
      y1: lo + P.h / u,
      X: (v) => P.x + (v - lo) * u,
      Y: (v) => P.y + P.h - (v - lo) * u,
      Xi: (px) => lo + (px - P.x) / u,
      Yi: (py) => lo + (P.y + P.h - py) / u,
    };
  }
  const plotWindow = () => plane(plotBox(), curSpan());

  interface PlotOpts {
    names?: string[];
    xName?: string;
    yName?: string;
    contours?: boolean;
    showOpt?: boolean;
    user?: Pt | null;
    intBest?: Pt | null;
    lattice?: boolean;
    zLine?: number | null;
  }
  function drawPlane(B: Box, lp: LP, S: Solution, span: number, o: PlotOpts) {
    panel(B, pal['surface-2']);
    const G = plane(B, span);
    const { P, X, Y } = G;
    const wr = windowRows();
    const s = sgn(lp);
    ctx.save();
    ctx.beginPath();
    ctx.rect(P.x, P.y, P.w, P.h);
    ctx.clip();
    // grid
    const gs = niceStep(span, 6);
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.2);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let v = Math.ceil(G.x0 / gs) * gs; v <= G.x1; v += gs) {
      ctx.moveTo(X(v), P.y);
      ctx.lineTo(X(v), P.y + P.h);
    }
    for (let v = Math.ceil(G.y0 / gs) * gs; v <= G.y1; v += gs) {
      ctx.moveTo(P.x, Y(v));
      ctx.lineTo(P.x + P.w, Y(v));
    }
    ctx.stroke();
    // feasible region
    const feasibleNow = S.status !== 'infeasible';
    const poly = feasibleNow ? L.regionPolygon(S.rows, G.x0, G.x1, G.y0, G.y1) : [];
    if (poly.length >= 3) {
      ctx.fillStyle = withAlpha(pal.accent, 0.2);
      ctx.strokeStyle = withAlpha(pal.accent, 0.7);
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
      ctx.closePath();
      ctx.fill();
    }
    // whole-number points inside the region
    if (o.lattice && feasibleNow) {
      ctx.fillStyle = withAlpha(pal['sim-text'], 0.45);
      for (let x = 0; x <= G.x1; x++)
        for (let y = 0; y <= G.y1; y++)
          if (L.feasible(S.rows, [x, y])) {
            ctx.beginPath();
            ctx.arc(X(x), Y(y), 1.8 / cur, 0, Math.PI * 2);
            ctx.fill();
          }
    }
    // axes
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.6 / cur;
    ctx.beginPath();
    ctx.moveTo(X(0), P.y);
    ctx.lineTo(X(0), P.y + P.h);
    ctx.moveTo(P.x, Y(0));
    ctx.lineTo(P.x + P.w, Y(0));
    ctx.stroke();
    // objective level lines
    const hasObj = Math.hypot(lp.cx, lp.cy) > 1e-12;
    if (o.contours && hasObj) {
      const zs = [
        [G.x0, G.y0],
        [G.x1, G.y0],
        [G.x0, G.y1],
        [G.x1, G.y1],
      ].map((p) => L.objective(lp, p as Pt));
      const lo = Math.min(...zs);
      const hi = Math.max(...zs);
      const ks = niceStep(hi - lo, 9);
      ctx.strokeStyle = withAlpha(C_OBJ, 0.38);
      ctx.lineWidth = 1.2 / cur;
      ctx.setLineDash([5 / cur, 5 / cur]);
      ctx.beginPath();
      for (let k = Math.ceil(lo / ks) * ks; k <= hi; k += ks) {
        const seg = lineSeg(wr, lp.cx, lp.cy, k);
        if (!seg) continue;
        ctx.moveTo(X(seg[0][0]), Y(seg[0][1]));
        ctx.lineTo(X(seg[1][0]), Y(seg[1][1]));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // constraint lines with hatching on the forbidden side
    // the y-axis name sits at the top of the y-axis; keep labels off it
    const placed: Box[] = [{ x: X(0), y: P.y, w: 40 / cur, h: 22 / cur }];
    lp.cons.forEach((k, i) => {
      if (!k.on || Math.hypot(k.a, k.b) < 1e-12) return;
      const seg = lineSeg(wr, k.a, k.b, k.c);
      if (!seg) return;
      const col = C_CON[i % C_CON.length];
      const selected = st.view !== 'alloc' && i === st.sel;
      // draw from the end nearer the origin towards the far end, where the label goes
      const [p, q] = seg[0][0] + seg[0][1] <= seg[1][0] + seg[1][1] ? seg : [seg[1], seg[0]];
      ctx.strokeStyle = col;
      ctx.lineWidth = (selected ? 3.5 : 2.2) / cur;
      ctx.beginPath();
      ctx.moveTo(X(p[0]), Y(p[1]));
      ctx.lineTo(X(q[0]), Y(q[1]));
      ctx.stroke();
      const sx = X(q[0]) - X(p[0]);
      const sy = Y(q[1]) - Y(p[1]);
      const len = Math.hypot(sx, sy);
      const dir = k.sense === '<=' ? 1 : -1;
      let nx = dir * k.a;
      let ny = -dir * k.b;
      const nl = Math.hypot(nx, ny);
      nx /= nl;
      ny /= nl;
      const gap = 18 / cur;
      ctx.strokeStyle = withAlpha(col, 0.55);
      ctx.lineWidth = 1.3 / cur;
      ctx.beginPath();
      for (let d = gap / 2; d < len; d += gap) {
        const x = X(p[0]) + (sx * d) / len;
        const y = Y(p[1]) + (sy * d) / len;
        ctx.moveTo(x, y);
        ctx.lineTo(x + nx * 7 / cur + (sx / len) * 4 / cur, y + ny * 7 / cur + (sy / len) * 4 / cur);
      }
      ctx.stroke();
      // label on the forbidden side, near the far end of the visible segment,
      // moved back along the line if it would overlap a label already drawn
      const name = o.names ? o.names[i] : `C${i + 1}`;
      ctx.font = fs(10.5, 800);
      const lw = ctx.measureText(name).width + 10 / cur;
      const lh = 17 / cur;
      let spot: [number, number] = [0, 0];
      for (const f of [0.9, 0.76, 0.62, 0.48, 0.34, 0.9]) {
        const lx = clamp(X(p[0]) + sx * f + nx * 16 / cur, P.x + lw / 2 + 2 / cur, P.x + P.w - lw / 2 - 2 / cur);
        const ly = clamp(Y(p[1]) + sy * f + ny * 16 / cur + 4 / cur, P.y + 16 / cur, P.y + P.h - 8 / cur);
        spot = [lx, ly];
        const r = { x: lx - lw / 2, y: ly - lh + 4 / cur, w: lw, h: lh };
        if (!placed.some((q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h)) {
          placed.push(r);
          break;
        }
      }
      tag(name, spot[0], spot[1], col, 10.5, 'center', 800);
    });
    // optimal set
    const showOpt = o.showOpt !== false;
    if (showOpt && S.opt && hasObj) {
      const seg = lineSeg(wr, lp.cx, lp.cy, S.opt.z);
      if (seg && !sweep) {
        ctx.strokeStyle = C_OBJ;
        ctx.lineWidth = 2.4 / cur;
        ctx.beginPath();
        ctx.moveTo(X(seg[0][0]), Y(seg[0][1]));
        ctx.lineTo(X(seg[1][0]), Y(seg[1][1]));
        ctx.stroke();
      }
      ctx.strokeStyle = C_OPT;
      ctx.lineWidth = 6 / cur;
      ctx.lineCap = 'round';
      if (S.tied.length > 1) {
        const d: Pt = [-lp.cy, lp.cx];
        const pr = S.tied.map((v) => ({ v, t: v.p[0] * d[0] + v.p[1] * d[1] })).sort((a, b) => a.t - b.t);
        const A = pr[0].v.p;
        const Bp = pr[pr.length - 1].v.p;
        ctx.beginPath();
        ctx.moveTo(X(A[0]), Y(A[1]));
        ctx.lineTo(X(Bp[0]), Y(Bp[1]));
        ctx.stroke();
      }
      if (S.ray) {
        ctx.beginPath();
        ctx.moveTo(X(S.opt.p[0]), Y(S.opt.p[1]));
        ctx.lineTo(X(S.opt.p[0] + S.ray[0] * span * 3), Y(S.opt.p[1] + S.ray[1] * span * 3));
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    // sweep line
    if (sweep && hasObj) {
      const k = sweep.k0 + (sweep.k1 - sweep.k0) * sweep.p;
      const seg = lineSeg(wr, lp.cx, lp.cy, k);
      if (seg) {
        ctx.strokeStyle = C_OBJ;
        ctx.lineWidth = 2.6 / cur;
        ctx.beginPath();
        ctx.moveTo(X(seg[0][0]), Y(seg[0][1]));
        ctx.lineTo(X(seg[1][0]), Y(seg[1][1]));
        ctx.stroke();
      }
      const inside = feasibleNow ? lineSeg([...S.rows, ...wr], lp.cx, lp.cy, k) : null;
      if (inside) {
        ctx.strokeStyle = C_OPT;
        ctx.lineWidth = 5 / cur;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(X(inside[0][0]), Y(inside[0][1]));
        ctx.lineTo(X(inside[1][0]), Y(inside[1][1]));
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }
    // corners
    S.verts.forEach((v, i) => {
      const isOpt = showOpt && S.opt && S.status !== 'unbounded' && S.tied.includes(v);
      ctx.fillStyle = isOpt ? C_OPT : pal['sim-text'];
      ctx.beginPath();
      ctx.arc(X(v.p[0]), Y(v.p[1]), (isOpt ? 6.5 : 4) / cur, 0, Math.PI * 2);
      ctx.fill();
      if (i === tour && st.view !== 'alloc') {
        ctx.strokeStyle = C_OBJ;
        ctx.lineWidth = 3 / cur;
        ctx.beginPath();
        ctx.arc(X(v.p[0]), Y(v.p[1]), 11 / cur, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    // unbounded direction
    if (S.status === 'unbounded' && S.ray && showOpt) {
      const from = S.verts.reduce((m, v) => (s * v.z > s * m.z ? v : m)).p;
      const L0: Pt = [X(from[0]), Y(from[1])];
      const ux = S.ray[0];
      const uy = -S.ray[1];
      arrow(L0[0], L0[1], L0[0] + ux * 110 / cur, L0[1] + uy * 110 / cur, pal.danger, 3);
      tag(`Z ${lp.goal === 'max' ? 'grows' : 'falls'} without limit`, clamp(L0[0] + ux * 60 / cur, P.x + 70 / cur, P.x + P.w - 70 / cur), clamp(L0[1] + uy * 60 / cur - 14 / cur, P.y + 16 / cur, P.y + P.h - 8 / cur), pal.danger, 10.5, 'center');
    }
    // level line through the user's plan
    if (o.zLine != null && hasObj) {
      const seg = lineSeg(wr, lp.cx, lp.cy, o.zLine);
      if (seg) {
        ctx.strokeStyle = withAlpha(C_OBJ, 0.9);
        ctx.setLineDash([7 / cur, 5 / cur]);
        ctx.lineWidth = 2 / cur;
        ctx.beginPath();
        ctx.moveTo(X(seg[0][0]), Y(seg[0][1]));
        ctx.lineTo(X(seg[1][0]), Y(seg[1][1]));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // the improving direction
    if (hasObj && o.contours !== false) {
      const base = S.opt && S.status !== 'unbounded' ? S.opt.p : null;
      if (base) {
        const n = Math.hypot(lp.cx, lp.cy);
        const ux = (s * lp.cx) / n;
        const uy = (-s * lp.cy) / n;
        const bx = X(base[0]);
        const by = Y(base[1]);
        arrow(bx, by, bx + ux * 48 / cur, by + uy * 48 / cur, C_OBJ, 2.5);
      }
    }
    // revealed best whole-number plan
    if (o.intBest) {
      const [x, y] = o.intBest;
      ctx.strokeStyle = C_OPT;
      ctx.lineWidth = 3 / cur;
      ctx.beginPath();
      ctx.rect(X(x) - 8 / cur, Y(y) - 8 / cur, 16 / cur, 16 / cur);
      ctx.stroke();
    }
    // user's plan
    if (o.user) {
      const ok = L.feasible(S.rows, o.user);
      const x = X(o.user[0]);
      const y = Y(o.user[1]);
      ctx.fillStyle = ok ? C_OPT : pal.danger;
      ctx.strokeStyle = pal['sim-bg'];
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.moveTo(x, y - 10 / cur);
      ctx.lineTo(x + 10 / cur, y);
      ctx.lineTo(x, y + 10 / cur);
      ctx.lineTo(x - 10 / cur, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // probe
    if (probe && st.view !== 'alloc') {
      const x = X(probe[0]);
      const y = Y(probe[1]);
      const ok = feasibleNow && L.feasible(S.rows, probe);
      ctx.strokeStyle = ok ? C_OPT : pal.danger;
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.moveTo(x - 9 / cur, y);
      ctx.lineTo(x + 9 / cur, y);
      ctx.moveTo(x, y - 9 / cur);
      ctx.lineTo(x, y + 9 / cur);
      ctx.stroke();
      const z = L.objective(lp, probe);
      const right = x < P.x + P.w * 0.6;
      tag(`${fp(probe)}: Z = ${fmt(z)}${ok ? '' : ' · not allowed'}`, x + (right ? 14 : -14) / cur, y - 10 / cur, ok ? C_OPT : pal.danger, 10.5, right ? 'left' : 'right');
    }
    // corner labels (after everything else so they stay on top)
    if (st.view !== 'alloc' || revealed)
      S.verts.forEach((v) => {
        if (S.verts.length > 7 && !(S.opt && S.tied.includes(v))) return;
        const x = X(v.p[0]);
        const y = Y(v.p[1]);
        const best = S.opt && S.tied.includes(v) && S.status !== 'unbounded' && hasObj;
        if (best) {
          // keep the label clear of the arrow, which points the way Z improves
          const n = Math.hypot(lp.cx, lp.cy);
          const ux = (-s * lp.cx) / n;
          const uy = (s * lp.cy) / n;
          tag(fp(v.p), x + ux * 14 / cur, y + uy * 14 / cur + 4 / cur, C_OPT, 10, ux < -0.2 ? 'right' : ux > 0.2 ? 'left' : 'center', 750);
          return;
        }
        const left = x > P.x + P.w * 0.75;
        tag(fp(v.p), x + (left ? -9 : 9) / cur, y - 8 / cur, S.opt && S.tied.includes(v) && S.status !== 'unbounded' ? C_OPT : pal['sim-text'], 10, left ? 'right' : 'left', 750);
      });
    ctx.restore();
    // ticks and axis names
    for (let v = Math.ceil(G.x0 / gs) * gs; v <= G.x1 + 1e-9; v += gs) if (Math.abs(v) > 1e-9) text(fmt(+v.toFixed(6)), X(v), P.y + P.h + 14 / cur, 9.5, pal['text-faint'], 'center', 600);
    for (let v = Math.ceil(G.y0 / gs) * gs; v <= G.y1 + 1e-9; v += gs) if (Math.abs(v) > 1e-9) text(fmt(+v.toFixed(6)), P.x - 5 / cur, Y(v) + 3 / cur, 9.5, pal['text-faint'], 'right', 600);
    text('0', P.x - 5 / cur, Y(0) + 12 / cur, 9.5, pal['text-faint'], 'right', 600);
    text(o.xName ?? 'x', P.x + P.w, P.y + P.h + 28 / cur, 10.5, pal['text-muted'], 'right', 750);
    tag(o.yName ?? 'y', X(0) + 8 / cur, P.y + 16 / cur, pal['text-muted'], 10.5, 'left', 750);
    return G;
  }

  /* ---------- LP lab side panel ---------- */
  function statusLine(lp: LP, S: Solution): { s: string; col: string } {
    const what = lp.goal === 'max' ? 'maximum' : 'minimum';
    if (S.status === 'infeasible') return { s: S.impossible !== null ? `Infeasible: C${S.impossible + 1} can never be true, so no point satisfies every constraint.` : 'Infeasible: no point satisfies every constraint at once, so there is nothing to optimize.', col: pal.danger };
    if (Math.hypot(lp.cx, lp.cy) < 1e-12) return { s: 'Every point gives Z = 0: all feasible points are equally good.', col: pal.warning };
    if (S.status === 'unbounded') return { s: `Unbounded: Z can be made as ${lp.goal === 'max' ? 'large' : 'small'} as you like, so there is no ${what}.`, col: pal.danger };
    if (S.status === 'multiple') {
      if (S.tied.length > 1) {
        const d: Pt = [-lp.cy, lp.cx];
        const pr = [...S.tied].sort((a, b) => a.p[0] * d[0] + a.p[1] * d[1] - (b.p[0] * d[0] + b.p[1] * d[1]));
        return { s: `Multiple optima: the ${what} Z = ${fmt(S.opt!.z)} is reached at every point of the edge from ${fp(pr[0].p)} to ${fp(pr[pr.length - 1].p)}.`, col: C_OPT };
      }
      return { s: `Multiple optima: the ${what} Z = ${fmt(S.opt!.z)} is reached at ${fp(S.opt!.p)} and along a whole edge running off the graph.`, col: C_OPT };
    }
    return { s: `Optimal: the ${what} is Z = ${fmt(S.opt!.z)} at the corner ${fp(S.opt!.p)}.`, col: C_OPT };
  }
  function drawProblemText(B: Box, lp: LP, S: Solution, x0: number, yy: number, maxW: number, compact = false) {
    yy = wrap(`${lp.goal === 'max' ? 'Maximize' : 'Minimize'}  Z = ${fmtLin(lp.cx, lp.cy)}`, x0, yy, maxW, 13, C_OBJ, 800);
    if (!compact && !portrait()) yy = wrap('subject to', x0, yy, maxW, 10.5, pal['text-faint'], 650);
    lp.cons.forEach((k, i) => {
      const col = k.on ? C_CON[i] : withAlpha(pal['text-faint'], 0.8);
      const bindNow = k.on && S.opt && S.status !== 'unbounded' && Math.abs(S.slack[i]) < 1e-7;
      const tail = !k.on ? '  (switched off)' : Math.hypot(k.a, k.b) < 1e-12 ? (S.impossible === i ? '  (never true)' : '  (always true)') : bindNow ? '  binding' : '';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x0 + 5 / cur, yy - 4 / cur, 4.5 / cur, 0, Math.PI * 2);
      ctx.fill();
      text(`${i === st.sel ? '▸ ' : ''}C${i + 1}:  ${conText(k)}`, x0 + 15 / cur, yy, 12, k.on ? pal['sim-text'] : pal['text-faint'], 'left', i === st.sel ? 800 : 650);
      ctx.font = fs(12, i === st.sel ? 800 : 650);
      const w = ctx.measureText(`${i === st.sel ? '▸ ' : ''}C${i + 1}:  ${conText(k)}`).width;
      if (tail) text(tail, x0 + 15 / cur + w, yy, 10, bindNow ? C_OPT : pal['text-faint'], 'left', 700);
      yy += 17 / cur;
    });
    text('x ≥ 0,  y ≥ 0', x0 + 15 / cur, yy, 12, pal['sim-text'], 'left', 650);
    yy += 20 / cur;
    const L0 = statusLine(lp, S);
    yy = wrap(L0.s, x0, yy, maxW, 11.5, L0.col, 800, B.y + B.h - 8);
    return yy;
  }
  function drawLpSide(B: Box, lp: LP, S: Solution) {
    panel(B);
    const x0 = B.x + 14;
    const maxW = B.w - 28;
    let yy = drawProblemText(B, lp, S, x0, B.y + 24, maxW);
    yy += 6 / cur;
    if (!S.verts.length) {
      wrap('No corners: the shaded region is empty.', x0, yy, maxW, 11, pal['text-muted'], 650, B.y + B.h - 6);
      return;
    }
    if (portrait()) {
      const list = S.verts.map((v, i) => `${i === tour ? '▸' : ''}${fp(v.p)}: Z = ${fmt(v.z)}`.replace(/ /g, String.fromCharCode(160))).join(' · ');
      wrap(`Corners  ${list}`, x0, yy, maxW, 11, pal['text-muted'], 650, B.y + B.h - 6);
      return;
    }
    const cols = [0, 150, 270];
    const sc = Math.min((B.w - 28) / 360, Math.max(1 / cur, 1));
    const cx = cols.map((c) => x0 + c * sc);
    text('Corner (x, y)', cx[0], yy, 10.5, pal['sim-text'], 'left', 800);
    text('Z', cx[1], yy, 10.5, pal['sim-text'], 'left', 800);
    yy += 16 / cur;
    const s = sgn(lp);
    let bestSoFar: number | null = null;
    S.verts.forEach((v, i) => {
      if (yy > B.y + B.h - 8) return;
      const isOpt = S.status !== 'unbounded' && S.tied.includes(v);
      const visited = tour >= 0 && i <= tour;
      if (visited && (bestSoFar === null || s * S.verts[i].z > s * S.verts[bestSoFar].z)) bestSoFar = i;
      const col = i === tour ? C_OBJ : isOpt ? C_OPT : pal['text-muted'];
      text(`${i === tour ? '▸ ' : ''}${fp(v.p)}`, cx[0], yy, 11, col, 'left', isOpt || i === tour ? 800 : 650);
      text(fmt(v.z), cx[1], yy, 11, col, 'left', isOpt || i === tour ? 800 : 650);
      const flag = tour >= 0 ? (i <= tour ? (i === bestSoFar ? 'best so far' : 'checked') : '') : isOpt ? (S.status === 'multiple' ? 'tied best' : 'best') : '';
      if (flag) text(flag, cx[2], yy, 10, col, 'left', 700);
      yy += 15 / cur;
    });
  }

  /* ---------- sensitivity ---------- */
  let rangeKey = '';
  let rangeVal: [number, number] | null = null;
  /** Interval of x-coefficients (y-coefficient fixed) over which the optimal corner stays the same. */
  function optimalityRange(lp: LP): [number, number] | null {
    const key = JSON.stringify(lp);
    if (key === rangeKey) return rangeVal;
    rangeKey = key;
    const S = L.solve(lp);
    rangeVal = null;
    if (S.status !== 'optimal') return null;
    const p = S.opt!.p;
    const same = (cx: number) => {
      const T = L.solve({ ...lp, cx });
      return T.status === 'optimal' && Math.abs(T.opt!.p[0] - p[0]) < 1e-7 && Math.abs(T.opt!.p[1] - p[1]) < 1e-7;
    };
    const edge = (dir: number) => {
      // walk out in steps of 0.5 until the corner changes, then bisect
      let a = lp.cx;
      let b = lp.cx;
      for (let i = 0; i < 80; i++) {
        b = a + dir * 0.5;
        if (!same(b)) break;
        a = b;
        if (i === 79) return dir * Infinity;
      }
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2;
        if (same(m)) a = m;
        else b = m;
      }
      return Math.round(((a + b) / 2) * 1e4) / 1e4;
    };
    rangeVal = [edge(-1), edge(1)];
    return rangeVal;
  }
  function drawLimitGraph(B: Box, lp: LP) {
    panel(B, pal['surface-2']);
    const i = st.sel;
    const k = lp.cons[i];
    const P = { x: B.x + 52, y: B.y + 30, w: B.w - 66, h: B.h - 62 };
    text(`Best Z as the limit of C${i + 1} changes`, B.x + 12, B.y + 18, 11.5, pal['sim-text'], 'left', 800);
    if (!k.on || Math.hypot(k.a, k.b) < 1e-12) {
      wrap(k.on ? 'This constraint has no x or y term, so moving its limit only switches it between always true and never true.' : 'C' + (i + 1) + ' is switched off. Switch it on to see how its limit affects the best value.', P.x, P.y + 30, P.w, 11, pal['text-muted'], 650);
      return;
    }
    const c0 = k.c - st.span * 1.2;
    const c1 = k.c + st.span * 1.2;
    const N = 160;
    const pts: [number, number][] = [];
    for (let j = 0; j <= N; j++) {
      const c = c0 + ((c1 - c0) * j) / N;
      pts.push([c, L.valueWithLimit(lp, i, c)]);
    }
    const fin = pts.filter((q) => Number.isFinite(q[1])).map((q) => q[1]);
    if (!fin.length) {
      wrap('For every limit in this range the problem is infeasible or unbounded, so there is no best value to plot.', P.x, P.y + 30, P.w, 11, pal['text-muted'], 650);
      return;
    }
    let lo = Math.min(...fin);
    let hi = Math.max(...fin);
    if (hi - lo < 1e-9) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.1;
    lo -= pad;
    hi += pad;
    const X = (c: number) => P.x + ((c - c0) / (c1 - c0)) * P.w;
    const Y = (z: number) => P.y + P.h - ((z - lo) / (hi - lo)) * P.h;
    const sx = niceStep(c1 - c0, 6);
    const sy = niceStep(hi - lo, 4);
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.2);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let v = Math.ceil(c0 / sx) * sx; v <= c1; v += sx) {
      ctx.moveTo(X(v), P.y);
      ctx.lineTo(X(v), P.y + P.h);
    }
    for (let v = Math.ceil(lo / sy) * sy; v <= hi; v += sy) {
      ctx.moveTo(P.x, Y(v));
      ctx.lineTo(P.x + P.w, Y(v));
    }
    ctx.stroke();
    for (let v = Math.ceil(c0 / sx) * sx; v <= c1 + 1e-9; v += sx) text(fmt(+v.toFixed(6)), X(v), P.y + P.h + 13 / cur, 9.5, pal['text-faint'], 'center', 600);
    for (let v = Math.ceil(lo / sy) * sy; v <= hi + 1e-9; v += sy) text(fmt(+v.toFixed(6)), P.x - 5 / cur, Y(v) + 3 / cur, 9.5, pal['text-faint'], 'right', 600);
    text(`limit of C${i + 1}`, P.x + P.w, P.y + P.h + 26 / cur, 10, pal['text-muted'], 'right', 700);
    // infeasible / unbounded bands
    ctx.fillStyle = withAlpha(pal.danger, 0.1);
    pts.forEach((q, j) => {
      if (Number.isFinite(q[1]) || j === N) return;
      ctx.fillRect(X(q[0]), P.y, X(pts[j + 1][0]) - X(q[0]), P.h);
    });
    ctx.strokeStyle = C_CON[i];
    ctx.lineWidth = 2.6 / cur;
    ctx.beginPath();
    let pen = false;
    for (const q of pts) {
      if (!Number.isFinite(q[1])) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(X(q[0]), Y(q[1]));
      else ctx.moveTo(X(q[0]), Y(q[1]));
      pen = true;
    }
    ctx.stroke();
    const z = L.valueWithLimit(lp, i, k.c);
    if (Number.isFinite(z)) {
      ctx.fillStyle = C_OPT;
      ctx.beginPath();
      ctx.arc(X(k.c), Y(z), 6 / cur, 0, Math.PI * 2);
      ctx.fill();
      const sp = L.shadowPrice(lp, i);
      if (Number.isFinite(sp)) {
        const dc = (c1 - c0) * 0.12;
        ctx.strokeStyle = C_OBJ;
        ctx.setLineDash([5 / cur, 4 / cur]);
        ctx.lineWidth = 1.8 / cur;
        ctx.beginPath();
        ctx.moveTo(X(k.c - dc), Y(z - sp * dc));
        ctx.lineTo(X(k.c + dc), Y(z + sp * dc));
        ctx.stroke();
        ctx.setLineDash([]);
        const right = X(k.c) < P.x + P.w * 0.6;
        tag(`slope = ${fmt(sp)} per unit`, X(k.c) + (right ? 12 : -12) / cur, Y(z) + 20 / cur, C_OBJ, 10.5, right ? 'left' : 'right');
      }
    }
  }
  function drawSensSide(B: Box, lp: LP, S: Solution) {
    panel(B);
    const x0 = B.x + 14;
    const maxW = B.w - 28;
    let yy = B.y + 22;
    const L0 = statusLine(lp, S);
    yy = wrap(L0.s, x0, yy, maxW, 11.5, L0.col, 800);
    yy += 4 / cur;
    const sc = Math.min((B.w - 28) / 440, Math.max(1 / cur, 1)) * (portrait() ? 1.4 : 1);
    const cols = [0, 150, 230, 320].map((c) => x0 + Math.min(c * sc, (c / 440) * (B.w - 28)));
    ['Constraint', 'Slack', 'Status', '+1 to limit'].forEach((h, j) => text(h, cols[j], yy, 10.5, pal['sim-text'], 'left', 800));
    yy += 16 / cur;
    lp.cons.forEach((k, i) => {
      if (!k.on) return;
      const sl = S.slack[i];
      const ok = S.opt && S.status !== 'unbounded';
      const binding = ok && Math.abs(sl) < 1e-7;
      const sp = ok ? L.shadowPrice(lp, i) : NaN;
      const col = C_CON[i];
      text(`C${i + 1}: ${conText(k)}`, cols[0], yy, 10.5, i === st.sel ? pal['sim-text'] : pal['text-muted'], 'left', i === st.sel ? 800 : 650);
      text(ok ? fmt(sl) : '—', cols[1], yy, 10.5, col, 'left', 700);
      text(ok ? (binding ? 'binding' : 'not binding') : '—', cols[2], yy, 10.5, binding ? C_OPT : pal['text-faint'], 'left', 700);
      text(Number.isFinite(sp) ? `Z ${sp >= 0 ? '+' : '−'} ${fmt(Math.abs(sp))}` : '—', cols[3], yy, 10.5, pal['text-muted'], 'left', 700);
      yy += 15 / cur;
    });
    yy += 6 / cur;
    const R = optimalityRange(lp);
    if (R && S.opt) {
      const a = Number.isFinite(R[0]) ? fmt(R[0], 3) : '−∞';
      const b = Number.isFinite(R[1]) ? fmt(R[1], 3) : '∞';
      yy = wrap(`Trade-off: the corner ${fp(S.opt.p)} stays optimal while the coefficient of x is between ${a} and ${b} (with y’s coefficient fixed at ${fmt(lp.cy)}). Outside that range the best plan jumps to a neighbouring corner.`, x0, yy, maxW, 11, pal['text-muted'], 650, B.y + B.h - 6);
    }
    if (!portrait()) wrap('Slack is unused capacity. A binding constraint has zero slack; only binding limits change the best value when relaxed, by the shadow price per unit.', x0, yy + 2 / cur, maxW, 10.5, pal['text-faint'], 600, B.y + B.h - 6);
  }

  /* ---------- geometric optimization ---------- */
  function drawGeomVisual(B: Box) {
    panel(B);
    const g = geo();
    const x = st.gx[st.shape];
    const cx = B.x + B.w / 2;
    const top = B.y + (portrait() ? 30 : 40);
    if (st.shape === 'rect') {
      const w = x;
      const h = st.P / 2 - x;
      const sc = Math.min(B.w - 90, B.h - 130) / (st.P / 2);
      const W = w * sc;
      const H = h * sc;
      const x0 = cx - W / 2;
      const y0 = B.y + B.h / 2 - H / 2 + 10;
      ctx.fillStyle = withAlpha('#2f9e44', 0.25);
      ctx.fillRect(x0, y0, W, H);
      // ghost of the best rectangle (a square)
      const bs = L.rectBest(st.P) * sc;
      ctx.strokeStyle = withAlpha(C_OPT, 0.7);
      ctx.setLineDash([6 / cur, 5 / cur]);
      ctx.lineWidth = 1.5 / cur;
      ctx.strokeRect(cx - bs / 2, B.y + B.h / 2 - bs / 2 + 10, bs, bs);
      ctx.setLineDash([]);
      ctx.strokeStyle = '#8d5524';
      ctx.lineWidth = 4 / cur;
      ctx.strokeRect(x0, y0, W, H);
      ctx.fillStyle = '#8d5524';
      const posts = (len: number) => Math.max(2, Math.round(len / (40 / cur)));
      const nW = posts(W);
      const nH = posts(H);
      for (let i = 0; i <= nW; i++)
        for (const yy of [y0, y0 + H]) {
          ctx.fillRect(x0 + (W * i) / nW - 3 / cur, yy - 3 / cur, 6 / cur, 6 / cur);
        }
      for (let i = 1; i < nH; i++)
        for (const xx of [x0, x0 + W]) {
          ctx.fillRect(xx - 3 / cur, y0 + (H * i) / nH - 3 / cur, 6 / cur, 6 / cur);
        }
      tag(`x = ${fmt(w)} m`, cx, y0 + H + 22 / cur, pal['sim-text'], 11.5, 'center');
      tag(`y = ${fmt(h)} m`, x0 + W + 10 / cur, y0 + H / 2 + 4 / cur, pal['sim-text'], 11.5, 'left');
      tag(`A = ${fmt(L.rectArea(st.P, x))} m²`, cx, y0 + H / 2 + 5 / cur, C_OPT, 13, 'center', 800);
      text(`A fence of length ${st.P} m: 2x + 2y = ${st.P}`, cx, top, 12, pal['sim-text'], 'center', 800);
      text('Dashed: the best shape (a square)', cx, top + 18 / cur, 10.5, pal['text-muted'], 'center', 650);
    } else if (st.shape === 'box') {
      const Ls = st.L;
      const Ws = st.W;
      const xc = x;
      // the flat sheet with corners cut
      const half = portrait() ? { x: B.x + 14, y: B.y + 50, w: B.w / 2 - 20, h: B.h - 64 } : { x: B.x + 20, y: B.y + 60, w: B.w - 40, h: B.h * 0.42 };
      const s1 = Math.min(half.w / Ls, half.h / Ws) * 0.9;
      const sx0 = half.x + (half.w - Ls * s1) / 2;
      const sy0 = half.y + (half.h - Ws * s1) / 2;
      ctx.fillStyle = withAlpha('#adb5bd', 0.35);
      ctx.strokeStyle = pal['border-strong'];
      ctx.lineWidth = 1.5 / cur;
      ctx.fillRect(sx0, sy0, Ls * s1, Ws * s1);
      ctx.strokeRect(sx0, sy0, Ls * s1, Ws * s1);
      ctx.fillStyle = pal['bg-elev'];
      ctx.strokeStyle = pal.danger;
      for (const [ax, ay] of [
        [0, 0],
        [Ls - xc, 0],
        [0, Ws - xc],
        [Ls - xc, Ws - xc],
      ]) {
        ctx.fillRect(sx0 + ax * s1, sy0 + ay * s1, xc * s1, xc * s1);
        ctx.strokeRect(sx0 + ax * s1, sy0 + ay * s1, xc * s1, xc * s1);
      }
      ctx.setLineDash([4 / cur, 4 / cur]);
      ctx.strokeStyle = pal['text-muted'];
      ctx.strokeRect(sx0 + xc * s1, sy0 + xc * s1, (Ls - 2 * xc) * s1, (Ws - 2 * xc) * s1);
      ctx.setLineDash([]);
      text(`${Ls} × ${Ws} cm sheet: cut x = ${fmt(xc)} cm squares, fold up`, cx, top, 11.5, pal['sim-text'], 'center', 800);
      // the folded box (oblique projection)
      const area = portrait() ? { x: B.x + B.w / 2 + 6, y: B.y + 50, w: B.w / 2 - 20, h: B.h - 64 } : { x: B.x + 20, y: B.y + 60 + B.h * 0.44, w: B.w - 40, h: B.h * 0.5 - 70 };
      const bl = Ls - 2 * xc;
      const bw = Ws - 2 * xc;
      const k = 0.5;
      const s2 = Math.min(area.w / (Ls + Ws * k * 0.7), area.h / (Ls * 0.25 + Ws * k * 0.7)) * 0.95;
      const ox = area.x + (area.w - (bl + bw * k * 0.7) * s2) / 2;
      const oy = area.y + area.h - 10 / cur;
      const P3 = (u: number, v: number, w: number): Pt => [ox + (u + v * k * 0.7) * s2, oy - (w + v * k * 0.7) * s2];
      const face = (pts: Pt[], fill: string) => {
        ctx.fillStyle = fill;
        ctx.strokeStyle = pal['border-strong'];
        ctx.lineWidth = 1.3 / cur;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };
      face([P3(0, bw, 0), P3(bl, bw, 0), P3(bl, bw, xc), P3(0, bw, xc)], withAlpha('#adb5bd', 0.55));
      face([P3(0, 0, 0), P3(0, bw, 0), P3(0, bw, xc), P3(0, 0, xc)], withAlpha('#adb5bd', 0.45));
      face([P3(0, 0, 0), P3(bl, 0, 0), P3(bl, bw, 0), P3(0, bw, 0)], withAlpha('#868e96', 0.35));
      face([P3(bl, 0, 0), P3(bl, bw, 0), P3(bl, bw, xc), P3(bl, 0, xc)], withAlpha('#ced4da', 0.7));
      face([P3(0, 0, 0), P3(bl, 0, 0), P3(bl, 0, xc), P3(0, 0, xc)], withAlpha('#dee2e6', 0.75));
      const lbl = P3(bl / 2, 0, 0);
      tag(`V = ${fmt(L.boxVolume(Ls, Ws, xc))} cm³`, lbl[0], Math.min(lbl[1] + 22 / cur, B.y + B.h - 10), C_OPT, 12.5, 'center', 800);
    } else {
      const r = x;
      const h = L.canHeight(st.V, r);
      const maxH = B.h - 150;
      // scale so the best can fills a fair part of the panel; other shapes are drawn to the same scale
      const rb = L.canBest(st.V);
      const sc = Math.min((B.w - 120) / (4.4 * rb), maxH / (3.2 * rb));
      const R = Math.min(r * sc, (B.w - 60) / 2);
      const ey = R * 0.32;
      // room between the two title lines and the surface-area label underneath
      const by = B.y + B.h - ey - 34 / cur;
      const roomTop = top + 18 / cur + 34 / cur + ey;
      const H = Math.min(h * sc, by - roomTop);
      const ty = by - H;
      const grad = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
      grad.addColorStop(0, '#868e96');
      grad.addColorStop(0.45, '#e9ecef');
      grad.addColorStop(1, '#868e96');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - R, ty);
      ctx.lineTo(cx - R, by);
      ctx.ellipse(cx, by, R, ey, 0, Math.PI, 0, true);
      ctx.lineTo(cx + R, ty);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal['border-strong'];
      ctx.lineWidth = 1.4 / cur;
      ctx.stroke();
      ctx.fillStyle = '#ced4da';
      ctx.beginPath();
      ctx.ellipse(cx, ty, R, ey, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // labels
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.moveTo(cx, ty);
      ctx.lineTo(cx + R, ty);
      ctx.stroke();
      tag(`r = ${fmt(r)} cm`, cx + R / 2, ty - ey - 8 / cur, pal.danger, 11, 'center');
      tag(`h = ${fmt(h)} cm${h * sc > by - roomTop + 0.5 ? ' (shortened)' : ''}`, cx + R + 10 / cur, (ty + by) / 2, pal['sim-text'], 11, 'left');
      tag(`S = ${fmt(L.canSurface(st.V, r))} cm²`, cx, by + ey + 22 / cur, C_OPT, 12.5, 'center', 800);
      text(`A can holding V = ${st.V} cm³ (${st.V} ml)`, cx, top, 12, pal['sim-text'], 'center', 800);
      text(`h ÷ 2r = ${fmt(h / (2 * r), 3)}  (best: 1, as tall as it is wide)`, cx, top + 18 / cur, 10.5, pal['text-muted'], 'center', 650);
    }
    void g;
  }
  function drawGeomGraph(B: Box) {
    panel(B, pal['surface-2']);
    const g = geo();
    const lo = g.lo();
    const hi = g.hi();
    const xs: number[] = [];
    for (let i = 0; i <= 200; i++) xs.push(lo + ((hi - lo) * i) / 200);
    const fv = xs.map(g.f);
    const best = g.best();
    const fb = g.f(best);
    let y0 = 0;
    let y1 = g.goal > 0 ? fb * 1.15 : Math.min(Math.max(...fv), fb * 3);
    if (!(y1 > y0)) y1 = 1;
    if (g.goal < 0) y0 = 0;
    const P = { x: B.x + 56, y: B.y + 30, w: B.w - 70, h: B.h - 62 };
    const X = (v: number) => P.x + ((v - lo) / (hi - lo)) * P.w;
    const Y = (v: number) => P.y + P.h - ((v - y0) / (y1 - y0)) * P.h;
    const sx = niceStep(hi - lo, 7);
    const sy = niceStep(y1 - y0, 5);
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.2);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let v = Math.ceil(lo / sx) * sx; v <= hi; v += sx) {
      ctx.moveTo(X(v), P.y);
      ctx.lineTo(X(v), P.y + P.h);
    }
    for (let v = Math.ceil(y0 / sy) * sy; v <= y1; v += sy) {
      ctx.moveTo(P.x, Y(v));
      ctx.lineTo(P.x + P.w, Y(v));
    }
    ctx.stroke();
    for (let v = Math.ceil(lo / sx) * sx; v <= hi + 1e-9; v += sx) text(fmt(+v.toFixed(6)), X(v), P.y + P.h + 13 / cur, 9.5, pal['text-faint'], 'center', 600);
    for (let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy) text(fmt(+v.toFixed(6)), P.x - 5 / cur, Y(v) + 3 / cur, 9.5, pal['text-faint'], 'right', 600);
    text(`${g.xl} (${g.unit})`, P.x + P.w, P.y + P.h + 26 / cur, 10, pal['text-muted'], 'right', 700);
    text(`${g.fl} (${g.fu})`, B.x + 12, B.y + 18, 11.5, pal['sim-text'], 'left', 800);
    ctx.save();
    ctx.beginPath();
    ctx.rect(P.x, P.y, P.w, P.h);
    ctx.clip();
    ctx.strokeStyle = C_CON[0];
    ctx.lineWidth = 2.6 / cur;
    ctx.beginPath();
    xs.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(fv[i])) : ctx.moveTo(X(v), Y(fv[i]))));
    ctx.stroke();
    // best
    ctx.strokeStyle = withAlpha(C_OPT, 0.8);
    ctx.setLineDash([5 / cur, 4 / cur]);
    ctx.lineWidth = 1.5 / cur;
    ctx.beginPath();
    ctx.moveTo(X(best), P.y);
    ctx.lineTo(X(best), P.y + P.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C_OPT;
    ctx.beginPath();
    ctx.arc(X(best), Y(fb), 6 / cur, 0, Math.PI * 2);
    ctx.fill();
    // gradient trail
    if (gd && gd.pts.length > 1) {
      ctx.strokeStyle = withAlpha(C_OBJ, 0.8);
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      gd.pts.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(g.f(v))) : ctx.moveTo(X(v), Y(g.f(v)))));
      ctx.stroke();
      ctx.fillStyle = C_OBJ;
      gd.pts.forEach((v) => {
        ctx.beginPath();
        ctx.arc(X(v), Y(g.f(v)), 3.5 / cur, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // current point and tangent
    const x = st.gx[st.shape];
    const fx = g.f(x);
    const d = g.df(x);
    const dx = (hi - lo) * 0.14;
    ctx.strokeStyle = pal.danger;
    ctx.lineWidth = 2 / cur;
    ctx.beginPath();
    ctx.moveTo(X(x - dx), Y(fx - d * dx));
    ctx.lineTo(X(x + dx), Y(fx + d * dx));
    ctx.stroke();
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    ctx.arc(X(x), Y(fx), 6 / cur, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const right = X(x) < P.x + P.w * 0.6;
    tag(`slope ${fmt(d, 3)}`, clamp(X(x) + (right ? 12 : -12) / cur, P.x + 4 / cur, P.x + P.w - 4 / cur), clamp(Y(fx) - 12 / cur, P.y + 14 / cur, P.y + P.h - 6 / cur), pal.danger, 10.5, right ? 'left' : 'right');
    tag(g.goal > 0 ? 'maximum' : 'minimum', X(best), clamp(Y(fb) + 24 / cur, P.y + 14 / cur, P.y + P.h - 4 / cur), C_OPT, 10.5, 'center');
    geomGraph = { P, lo, hi };
  }
  let geomGraph: { P: Box; lo: number; hi: number } | null = null;
  function drawGeomInfo(B: Box) {
    panel(B);
    const x0 = B.x + 14;
    const maxW = B.w - 28;
    let yy = B.y + 22;
    const ln = (s: string, col = pal['text-muted'], px = 11.5, wt = 650) => (yy = wrap(s, x0, yy, maxW, px, col, wt, B.y + B.h - 6));
    if (st.shape === 'rect') {
      ln('Constraint: 2x + 2y = P, so y = P/2 − x, with 0 < x < P/2.', pal['sim-text'], 11.5, 750);
      ln('Objective: A(x) = x(P/2 − x) = (P/2)x − x²', C_CON[0], 11.5, 750);
      ln(`A′(x) = P/2 − 2x = 0 when x = P/4 = ${fmt(L.rectBest(st.P))} m, so y = x too: the best rectangle is a square, with area P²/16 = ${fmt(st.P ** 2 / 16)} m². A″ = −2 < 0 confirms a maximum.`);
    } else if (st.shape === 'box') {
      ln(`Constraint: the cut must satisfy 0 < x < ${fmt(Math.min(st.L, st.W) / 2)} cm (half the shorter side).`, pal['sim-text'], 11.5, 750);
      ln('Objective: V(x) = x(L − 2x)(W − 2x)', C_CON[0], 11.5, 750);
      ln(`V′(x) = 12x² − 4(L + W)x + LW = 0. The root inside the allowed range is x = [(L + W) − √(L² − LW + W²)] / 6 = ${fmt(L.boxBest(st.L, st.W))} cm, giving V = ${fmt(L.boxVolume(st.L, st.W, L.boxBest(st.L, st.W)))} cm³. A small cut gives a shallow tray; a big cut leaves almost no base.`);
    } else {
      ln('Constraint: the volume is fixed, πr²h = V, so h = V / (πr²).', pal['sim-text'], 11.5, 750);
      ln('Objective: S(r) = 2πr² + 2V/r  (two lids plus the side)', C_CON[0], 11.5, 750);
      ln(`S′(r) = 4πr − 2V/r² = 0 when r = ∛(V/2π) = ${fmt(L.canBest(st.V))} cm, and then h = 2r. Real cans are usually taller: lids are thicker and seams cost extra, which changes the objective.`);
    }
  }

  /* ---------- allocation ---------- */
  function drawAllocSide(B: Box, lp: LP, S: Solution) {
    panel(B);
    const C = LEVELS[st.level];
    const x0 = B.x + 14;
    const maxW = B.w - 28;
    let yy = B.y + 22;
    yy = wrap(`Challenge ${st.level}: ${C.title}`, x0, yy, maxW, 13, pal['sim-text'], 800);
    yy = wrap(C.story, x0, yy, maxW, 11, pal['text-muted'], 600);
    yy += 4 / cur;
    const plan: Pt = [st.qx, st.qy];
    const z = L.objective(lp, plan);
    const money = C.goal === 'max' ? 'Profit' : 'Cost';
    yy = wrap(`Your plan: ${st.qx} ${C.xShort}, ${st.qy} ${C.yShort}.  ${money} = £${fmt(z)}`, x0, yy, maxW, 12, C_OBJ, 800);
    yy += 2 / cur;
    // resource bars
    const barX = x0 + Math.min(maxW * 0.36, 130 / cur);
    const barW = B.x + B.w - 14 - barX - Math.min(maxW * 0.3, 104 / cur);
    C.res.forEach((r, i) => {
      if (yy > B.y + B.h - 20) return;
      const used = r.a * st.qx + r.b * st.qy;
      const ok = r.sense === '<=' ? used <= r.c + 1e-9 : used >= r.c - 1e-9;
      text(r.name, x0, yy + 2 / cur, 11, C_CON[i], 'left', 800);
      const full = Math.max(r.c, used) * (r.sense === '<=' ? 1.15 : 1.4) || 1;
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.18);
      ctx.fillRect(barX, yy - 8 / cur, barW, 12 / cur);
      ctx.fillStyle = ok ? withAlpha(C_OPT, 0.75) : withAlpha(pal.danger, 0.8);
      ctx.fillRect(barX, yy - 8 / cur, (barW * Math.min(used, full)) / full, 12 / cur);
      const lx = barX + (barW * r.c) / full;
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.moveTo(lx, yy - 11 / cur);
      ctx.lineTo(lx, yy + 7 / cur);
      ctx.stroke();
      text(`${fmt(used)} ${r.sense === '<=' ? 'of' : 'of at least'} ${r.c} ${r.unit}`, barX + barW + 8 / cur, yy + 2 / cur, 10.5, ok ? pal['text-muted'] : pal.danger, 'left', 700);
      yy += 20 / cur;
    });
    yy += 2 / cur;
    const ib = L.integerBest(lp, C.max[0], C.max[1]);
    if (revealed && ib && S.opt) {
      yy = wrap(`Best whole-number plan: ${ib.p[0]} ${C.xShort}, ${ib.p[1]} ${C.yShort}, ${money.toLowerCase()} £${fmt(ib.z)} (green square).`, x0, yy, maxW, 11.5, C_OPT, 800, B.y + B.h - 6);
      const frac = Math.abs(S.opt.p[0] - Math.round(S.opt.p[0])) > 1e-9 || Math.abs(S.opt.p[1] - Math.round(S.opt.p[1])) > 1e-9;
      yy = wrap(frac ? `If fractions were allowed, the corner ${fp(S.opt.p)} would give £${fmt(S.opt.z)}. Rounding it does not always work, so the whole-number points (dots) near it are checked instead.` : `Here the best corner ${fp(S.opt.p)} is already a whole-number point.`, x0, yy, maxW, 10.5, pal['text-muted'], 600, B.y + B.h - 6);
    } else if (!checked) {
      wrap('Drag the sliders or tap the graph to choose a plan. The diamond is your plan; the dashed line joins all plans with the same ' + money.toLowerCase() + '. Then press Check my plan.', x0, yy, maxW, 10.5, pal['text-faint'], 600, B.y + B.h - 6);
    }
  }
  function checkPlan(): string {
    const C = LEVELS[st.level];
    const lp = allocLP(st.level);
    const plan: Pt = [st.qx, st.qy];
    const bad = C.res.map((r) => ({ r, used: r.a * st.qx + r.b * st.qy })).filter(({ r, used }) => (r.sense === '<=' ? used > r.c + 1e-9 : used < r.c - 1e-9));
    if (bad.length) {
      const { r, used } = bad[0];
      return r.sense === '<=' ? `Not possible: this plan needs ${fmt(used)} ${r.unit} of ${r.name.toLowerCase()}, but only ${r.c} ${r.unit} are available.` : `Not good enough: the mix gives only ${fmt(used)} ${r.unit} of ${r.name.toLowerCase()}, but at least ${r.c} are needed.`;
    }
    const ib = L.integerBest(lp, C.max[0], C.max[1])!;
    const z = L.objective(lp, plan);
    const pct = C.goal === 'max' ? (ib.z ? (100 * z) / ib.z : 100) : z ? (100 * ib.z) / z : 100;
    if (Math.abs(z - ib.z) < 1e-9) return `Perfect: £${fmt(z)} is the best any whole-number plan can do. Notice that it sits on (or right next to) a corner of the region.`;
    const hint = C.goal === 'max' ? 'Move the dashed profit line outwards (the arrow) as far as it can go while still touching an allowed whole-number point.' : 'Move the dashed cost line towards the origin as far as it can go while still touching an allowed whole-number point.';
    return `Your plan works and ${C.goal === 'max' ? 'earns' : 'costs'} £${fmt(z)}: a score of ${fmt(pct, 3)}% of the best whole-number plan. ${hint}`;
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
    if (st.view === 'lp') {
      const Lo = lpLayout();
      const S = solve(st.lp);
      drawPlane(Lo.plot, st.lp, S, st.span, { contours: st.contours });
      drawLpSide(Lo.side, st.lp, S);
    } else if (st.view === 'sens') {
      const Lo = sensLayout();
      const S = solve(st.lp);
      drawPlane(Lo.plot, st.lp, S, st.span, { contours: false });
      drawLimitGraph(Lo.graph, st.lp);
      drawSensSide(Lo.side, st.lp, S);
    } else if (st.view === 'geom') {
      const Lo = geomLayout();
      drawGeomVisual(Lo.vis);
      drawGeomGraph(Lo.graph);
      drawGeomInfo(Lo.info);
    } else {
      const Lo = allocLayout();
      const lp = allocLP(st.level);
      const S = solve(lp);
      const C = LEVELS[st.level];
      const ib = revealed ? L.integerBest(lp, C.max[0], C.max[1]) : null;
      drawPlane(Lo.plot, lp, S, C.span, {
        names: C.res.map((r) => r.name),
        xName: `x (${C.xShort})`,
        yName: `y (${C.yShort})`,
        contours: false,
        showOpt: revealed,
        user: [st.qx, st.qy],
        intBest: ib ? ib.p : null,
        lattice: true,
        zLine: L.objective(lp, [st.qx, st.qy]),
      });
      drawAllocSide(Lo.side, lp, S);
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
    if (st.view === 'lp' || st.view === 'sens') {
      const lp = st.lp;
      const S = solve(lp);
      const name = { optimal: 'Optimal', multiple: 'Multiple optima', unbounded: 'Unbounded', infeasible: 'Infeasible' }[S.status];
      const good = S.status === 'optimal' || S.status === 'multiple';
      const binding = good ? lp.cons.map((k, i) => (k.on && Math.abs(S.slack[i]) < 1e-7 ? `C${i + 1}` : '')).filter(Boolean) : [];
      r('r1', 'Status', name, good ? 'ok' : 'bad');
      r('r2', lp.goal === 'max' ? 'Maximum Z' : 'Minimum Z', good ? fmt(S.opt!.z) : S.status === 'unbounded' ? (lp.goal === 'max' ? 'no maximum (∞)' : 'no minimum (−∞)') : '—');
      r('r3', 'Best point (x, y)', good ? (S.status === 'multiple' ? `${fp(S.opt!.p)} and others` : fp(S.opt!.p)) : '—');
      r('r4', 'Binding constraints', good ? binding.join(', ') || 'only x ≥ 0, y ≥ 0' : '—');
      if (st.view === 'lp') {
        r('r5', 'Corners', `${S.verts.length}`);
        if (sweep) r('r6', 'Level line', `Z = ${fmt(sweep.k0 + (sweep.k1 - sweep.k0) * sweep.p, 3)}`);
        else if (probe) r('r6', `Z at ${fp(probe)}`, `${fmt(L.objective(lp, probe))}${S.status !== 'infeasible' && L.feasible(S.rows, probe) ? '' : ' (not allowed)'}`);
        else r('r6', 'Selected', `C${st.sel + 1}: ${conText(lp.cons[st.sel])}${lp.cons[st.sel].on ? '' : ' (off)'}`);
        note ||= PRESETS[st.preset]?.note ?? 'Drag a constraint line to move it, or tap the graph to test a point. Press Start to sweep the level line, or Check next corner.';
      } else {
        const k = lp.cons[st.sel];
        const sp = good && k.on ? L.shadowPrice(lp, st.sel) : NaN;
        r('r5', `Slack of C${st.sel + 1}`, good && k.on ? fmt(S.slack[st.sel]) : '—');
        r('r6', `Shadow price of C${st.sel + 1}`, Number.isFinite(sp) ? `${fmt(sp)} per unit` : '—');
        note ||= 'Pick a constraint and move its limit (slider or drag). The graph shows the best value for every limit: its slope is the shadow price. Binding constraints have zero slack.';
      }
      sim.setBadge(name);
    } else if (st.view === 'geom') {
      const g = geo();
      const x = st.gx[st.shape];
      const b = g.best();
      const fb = g.f(b);
      const fx = g.f(x);
      r('r1', g.xl, `${fmt(x)} ${g.unit}`);
      r('r2', g.fl, `${fmt(fx)} ${g.fu}`);
      r('r3', st.shape === 'rect' ? 'Length y' : st.shape === 'box' ? 'Base' : 'Height h', st.shape === 'rect' ? `${fmt(st.P / 2 - x)} m` : st.shape === 'box' ? `${fmt(st.L - 2 * x)} × ${fmt(st.W - 2 * x)} cm` : `${fmt(L.canHeight(st.V, x))} cm`);
      r('r4', 'Slope (derivative)', fmt(g.df(x), 3), Math.abs(g.df(x)) < 1e-2 * Math.max(1, Math.abs(fb)) ? 'ok' : null);
      r('r5', `Best ${g.xl.split(' ').pop()}`, `${fmt(b)} ${g.unit}`);
      r('r6', g.goal > 0 ? 'Percent of the maximum' : 'Extra material vs the minimum', g.goal > 0 ? (fb - fx < 1e-4 * fb ? '≈ 100%' : `${fmt((100 * fx) / fb, 3)}%`) : fx - fb < 1e-4 * fb ? '< 0.01%' : `${fmt((100 * (fx - fb)) / fb, 3)}%`, Math.abs(fx - fb) < 1e-3 * fb ? 'ok' : null);
      note ||= {
        rect: 'Change the width x (slider or drag on the graph) and watch the area. Press Start to let a hill-climbing search find the best width step by step.',
        box: 'Cut squares of side x from the corners of the sheet and fold up the sides. Find the cut that holds the most. Press Start for a hill-climbing search.',
        can: 'The can must hold the volume V. Change the radius r: the height adjusts automatically. Find the shape that needs the least metal. Press Start to search downhill.',
      }[st.shape];
      sim.setBadge(g.goal > 0 ? `Maximize ${g.fl.split(' ').pop()}` : `Minimize ${g.fl.split(' ').slice(-2).join(' ')}`);
    } else {
      const C = LEVELS[st.level];
      const lp = allocLP(st.level);
      const S = solve(lp);
      const plan: Pt = [st.qx, st.qy];
      const okPlan = L.feasible(S.rows, plan);
      const z = L.objective(lp, plan);
      const ib = L.integerBest(lp, C.max[0], C.max[1]);
      r('r1', 'Your plan (x, y)', fp(plan));
      r('r2', C.goal === 'max' ? 'Profit' : 'Cost', `£${fmt(z)}`);
      r('r3', 'Plan allowed?', okPlan ? 'Yes' : 'No: breaks a limit', okPlan ? 'ok' : 'bad');
      r('r4', 'Best whole-number plan', revealed && ib ? `${fp(ib.p)}: £${fmt(ib.z)}` : 'hidden');
      r('r5', 'Best with fractions', revealed && S.opt ? `${fp(S.opt.p)}: £${fmt(S.opt.z)}` : 'hidden');
      const score = okPlan && ib ? (C.goal === 'max' ? (100 * z) / ib.z : (100 * ib.z) / z) : NaN;
      r('r6', 'Score', checked ? (okPlan ? `${fmt(score, 3)}%` : '0% (not allowed)') : '—', checked ? (okPlan && Math.abs(score - 100) < 1e-6 ? 'ok' : okPlan ? 'warn' : 'bad') : null);
      note ||= `${C.goal === 'max' ? 'Maximize profit' : 'Minimize cost'} using whole numbers. Every dot in the shaded region is an allowed plan.`;
      sim.setBadge(`Challenge ${st.level}: ${C.title}`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', `${viewSel.selectedOptions[0]?.textContent ?? ''}. ${noteEl.textContent}`);
  }

  /* ======================= Interaction ======================= */
  const local = (e: { clientX: number; clientY: number }) => {
    const rc = canvas.getBoundingClientRect();
    return toBox(e.clientX - rc.left, e.clientY - rc.top);
  };
  const inBox = (B: Box, x: number, y: number) => x >= B.x && x <= B.x + B.w && y >= B.y && y <= B.y + B.h;
  /** Index of the constraint line under the pointer, if any. */
  function hitConstraint(bx: number, by: number): number | null {
    if (st.view !== 'lp' && st.view !== 'sens') return null;
    const G = plotWindow();
    if (!inBox(G.P, bx, by)) return null;
    const wx = G.Xi(bx);
    const wy = G.Yi(by);
    let best: number | null = null;
    let bd = 16 / cur;
    st.lp.cons.forEach((k, i) => {
      const n = Math.hypot(k.a, k.b);
      if (!k.on || n < 1e-12) return;
      const d = (Math.abs(k.a * wx + k.b * wy - k.c) / n) * G.u;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  let drag: { kind: 'con'; i: number } | { kind: 'probe' } | { kind: 'plan' } | { kind: 'gx' } | null = null;
  function pointerAt(bx: number, by: number) {
    if (!drag) return;
    if (drag.kind === 'con') {
      const G = plotWindow();
      const k = st.lp.cons[drag.i];
      const c = clamp(Math.round((k.a * G.Xi(bx) + k.b * G.Yi(by)) * 4) / 4, -10, 30);
      if (c !== k.c) {
        k.c = c;
        cCtl.set(c, false);
        lpChanged(false);
      }
    } else if (drag.kind === 'probe') {
      const G = plotWindow();
      probe = [Math.round(G.Xi(bx) * 10) / 10, Math.round(G.Yi(by) * 10) / 10];
      lastMsg = '';
    } else if (drag.kind === 'plan') {
      const G = plotWindow();
      const C = LEVELS[st.level];
      st.qx = clamp(Math.round(G.Xi(bx)), 0, C.max[0]);
      st.qy = clamp(Math.round(G.Yi(by)), 0, C.max[1]);
      qxCtl.set(st.qx, false);
      qyCtl.set(st.qy, false);
      checked = false;
      lastMsg = '';
    } else if (drag.kind === 'gx' && geomGraph) {
      const { P, lo, hi } = geomGraph;
      const v = clamp(lo + ((bx - P.x) / P.w) * (hi - lo), lo, hi);
      st.gx[st.shape] = +v.toFixed(2);
      xCtl.set(st.gx[st.shape], false);
      gd = null;
      lastMsg = '';
    }
    sim.requestRender();
  }
  canvas.addEventListener('pointerdown', (e) => {
    const [bx, by] = local(e);
    if (st.view === 'lp' || st.view === 'sens') {
      const hit = hitConstraint(bx, by);
      if (hit !== null) {
        drag = { kind: 'con', i: hit };
        if (st.sel !== hit) {
          st.sel = hit;
          selCtl.set(String(hit), false);
          syncConCtrls();
        }
      } else if (inBox(plotWindow().P, bx, by)) drag = { kind: 'probe' };
    } else if (st.view === 'alloc') {
      if (inBox(plotWindow().P, bx, by)) drag = { kind: 'plan' };
    } else if (st.view === 'geom' && geomGraph && inBox(geomGraph.P, bx, by)) {
      sim.pause();
      drag = { kind: 'gx' };
    }
    if (drag) {
      canvas.setPointerCapture(e.pointerId);
      sweep = null;
      pointerAt(bx, by);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const [bx, by] = local(e);
    if (drag) {
      pointerAt(bx, by);
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const hit = hitConstraint(bx, by);
    canvas.style.cursor = hit !== null ? 'grab' : (st.view === 'lp' || st.view === 'sens' || st.view === 'alloc') && inBox(plotWindow().P, bx, by) ? 'crosshair' : st.view === 'geom' && geomGraph && inBox(geomGraph.P, bx, by) ? 'ew-resize' : '';
  });
  const endDrag = () => {
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const [bx, by] = local(e.touches[0]);
      const grab = hitConstraint(bx, by) !== null || (st.view === 'alloc' && inBox(plotWindow().P, bx, by)) || (st.view === 'geom' && geomGraph && inBox(geomGraph.P, bx, by));
      if (grab) e.preventDefault();
    },
    { passive: false },
  );

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.querySelectorAll<HTMLElement>('[data-views]').forEach((el) => (el.hidden = !el.dataset.views!.split(' ').includes(st.view)));
    root.querySelectorAll<HTMLElement>('[data-shapes]').forEach((el) => (el.hidden = el.dataset.shapes !== st.shape));
  }
  /** Anything about the linear program changed. */
  function lpChanged(clearProbe = true) {
    sweep = null;
    tour = -1;
    if (clearProbe) probe = null;
    lastMsg = '';
    st.preset = '';
    sim.pause();
    sim.requestRender();
  }
  viewSel.addEventListener('change', () => {
    st.view = viewSel.value as View;
    sweep = null;
    tour = -1;
    gd = null;
    probe = null;
    lastMsg = '';
    sim.pause();
    showView();
    sim.requestRender();
  });
  const speedCtl = ui.range('op-speed', (q) => `${q}×`, (q) => (st.speed = q));
  const goalCtl = ui.choice<'max' | 'min'>('op-goal', (q) => ((st.lp.goal = q), lpChanged()));
  const cxCtl = ui.range('op-cx', (q) => fmt(q), (q) => ((st.lp.cx = q), lpChanged()));
  const cyCtl = ui.range('op-cy', (q) => fmt(q), (q) => ((st.lp.cy = q), lpChanged()));
  const selCtl = ui.choice<string>('op-sel', (q) => {
    st.sel = +q;
    syncConCtrls();
    sweep = null;
    lastMsg = '';
    sim.requestRender();
  });
  const conOf = () => st.lp.cons[st.sel];
  const onCtl = ui.toggle('op-on', (q) => ((conOf().on = q), lpChanged()));
  const senseCtl = ui.choice<Con['sense']>('op-sense', (q) => ((conOf().sense = q), lpChanged()));
  const aCtl = ui.range('op-a', (q) => fmt(q), (q) => ((conOf().a = q), lpChanged()));
  const bCtl = ui.range('op-b', (q) => fmt(q), (q) => ((conOf().b = q), lpChanged()));
  const cCtl = ui.range('op-c', (q) => fmt(q), (q) => ((conOf().c = q), lpChanged(false)));
  const contCtl = ui.toggle('op-contours', (q) => ((st.contours = q), sim.requestRender()));
  function syncConCtrls() {
    const k = conOf();
    onCtl.set(k.on, false);
    senseCtl.set(k.sense, false);
    aCtl.set(k.a, false);
    bCtl.set(k.b, false);
    cCtl.set(k.c, false);
  }
  function applyPreset(name: string) {
    const P = PRESETS[name];
    st.lp = clone(P.lp);
    st.span = P.span;
    st.sel = 0;
    goalCtl.set(st.lp.goal, false);
    cxCtl.set(st.lp.cx, false);
    cyCtl.set(st.lp.cy, false);
    selCtl.set('0', false);
    syncConCtrls();
    lpChanged();
    st.preset = name;
  }
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset!)));
  root.querySelector('[data-tour]')?.addEventListener('click', () => {
    const lp = st.lp;
    const S = solve(lp);
    sim.pause();
    sweep = null;
    if (!S.verts.length) {
      lastMsg = 'There are no corners to check: no point satisfies all the constraints, so the problem is infeasible.';
      sim.requestRender();
      return;
    }
    tour = (tour + 1) % S.verts.length;
    const v = S.verts[tour];
    const s = sgn(lp);
    let bi = 0;
    for (let i = 1; i <= tour; i++) if (s * S.verts[i].z > s * S.verts[bi].z) bi = i;
    const last = tour === S.verts.length - 1;
    lastMsg = `Corner ${tour + 1} of ${S.verts.length}: ${fp(v.p)} gives Z = ${fmtLin(lp.cx, lp.cy)} = ${fmt(v.z)}. Best so far: Z = ${fmt(S.verts[bi].z)} at ${fp(S.verts[bi].p)}.`;
    if (last) {
      if (S.status === 'unbounded') lastMsg += ' All corners checked, but the region is open and Z keeps improving along an edge, so no corner is best: the problem is unbounded.';
      else if (S.status === 'multiple') lastMsg += ' All corners checked. The best value is shared, so a whole edge is optimal.';
      else lastMsg += ` All corners checked: the ${lp.goal === 'max' ? 'maximum' : 'minimum'} is at ${fp(S.opt!.p)}. If a linear program has a best value, it is always found at a corner.`;
    }
    sim.requestRender();
  });

  // geometry
  const xInput = root.querySelector<HTMLInputElement>('[data-ctrl="op-x"]')!;
  const xLabel = root.querySelector<HTMLLabelElement>('label[for="ctl-op-x"]')!;
  const xCtl = ui.range('op-x', (q) => `${fmt(q)} ${geo().unit}`, (q) => ((st.gx[st.shape] = q), (gd = null), (lastMsg = ''), sim.pause(), sim.requestRender()));
  function syncX() {
    const g = geo();
    xInput.min = String(+g.lo().toFixed(2));
    xInput.max = String(+g.hi().toFixed(2));
    xInput.step = '0.01';
    st.gx[st.shape] = clamp(st.gx[st.shape], g.lo(), g.hi());
    xLabel.textContent = g.xl;
    xCtl.set(+st.gx[st.shape].toFixed(2), false);
  }
  const geomChanged = () => {
    gd = null;
    lastMsg = '';
    sim.pause();
    syncX();
    sim.requestRender();
  };
  const shapeCtl = ui.choice<Shape>('op-shape', (q) => {
    st.shape = q;
    showView();
    geomChanged();
  });
  const pCtl = ui.range('op-p', (q) => `${q} m`, (q) => ((st.P = q), geomChanged()));
  const slCtl = ui.range('op-sl', (q) => `${q} cm`, (q) => ((st.L = q), geomChanged()));
  const swCtl = ui.range('op-sw', (q) => `${q} cm`, (q) => ((st.W = q), geomChanged()));
  const vCtl = ui.range('op-v', (q) => `${q} cm³`, (q) => ((st.V = q), geomChanged()));
  root.querySelector('[data-best]')?.addEventListener('click', () => {
    const g = geo();
    st.gx[st.shape] = g.best();
    xCtl.set(+g.best().toFixed(2), false);
    gd = null;
    sim.pause();
    lastMsg = `The best ${g.xl.split(' ').pop()} is ${fmt(g.best())} ${g.unit}, where the slope of the graph is 0 and ${g.fl.toLowerCase()} is ${fmt(g.f(g.best()))} ${g.fu}.`;
    sim.requestRender();
  });

  // allocation
  const qxInput = root.querySelector<HTMLInputElement>('[data-ctrl="op-qx"]')!;
  const qyInput = root.querySelector<HTMLInputElement>('[data-ctrl="op-qy"]')!;
  const planChanged = () => {
    checked = false;
    lastMsg = '';
    sim.requestRender();
  };
  const qxCtl = ui.range('op-qx', (q) => `${q}`, (q) => ((st.qx = q), planChanged()));
  const qyCtl = ui.range('op-qy', (q) => `${q}`, (q) => ((st.qy = q), planChanged()));
  function syncLevel() {
    const C = LEVELS[st.level];
    qxInput.max = String(C.max[0]);
    qyInput.max = String(C.max[1]);
    root.querySelector('label[for="ctl-op-qx"]')!.textContent = C.xName;
    root.querySelector('label[for="ctl-op-qy"]')!.textContent = C.yName;
    st.qx = 0;
    st.qy = 0;
    qxCtl.set(0, false);
    qyCtl.set(0, false);
    checked = false;
    revealed = false;
    sweep = null;
    lastMsg = '';
  }
  const levelCtl = ui.choice<Level>('op-level', (q) => {
    st.level = q;
    syncLevel();
    sim.pause();
    sim.requestRender();
  });
  root.querySelector('[data-check]')?.addEventListener('click', () => {
    checked = true;
    lastMsg = checkPlan();
    sim.requestRender();
  });
  root.querySelector('[data-reveal]')?.addEventListener('click', () => {
    revealed = !revealed;
    root.querySelector('[data-reveal]')!.textContent = revealed ? 'Hide the best plan' : 'Show the best plan';
    lastMsg = revealed ? 'The green square is the best whole-number plan; the green dot is the best corner if fractions were allowed.' : '';
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(isOn: boolean) {
      if (!isOn) return;
      lastMsg = '';
      probe = null;
      if (st.view === 'geom') {
        startGradient();
        return;
      }
      if (!sweep || sweep.p >= 1) sweep = null;
    },
    reset() {
      st.speed = 1;
      speedCtl.set(1, false);
      st.contours = true;
      contCtl.set(true, false);
      applyPreset('textbook');
      Object.assign(st, { shape: 'rect', P: 40, L: 30, W: 20, V: 500 });
      st.gx = { rect: 6, box: 1.5, can: 2 };
      shapeCtl.set('rect', false);
      pCtl.set(40, false);
      slCtl.set(30, false);
      swCtl.set(20, false);
      vCtl.set(500, false);
      gd = null;
      syncX();
      st.level = '1';
      levelCtl.set('1', false);
      syncLevel();
      root.querySelector('[data-reveal]')!.textContent = 'Show the best plan';
      showView();
      lastMsg = '';
    },
  });

  syncConCtrls();
  syncX();
  syncLevel();
  showView();
  sim.requestRender();
}
