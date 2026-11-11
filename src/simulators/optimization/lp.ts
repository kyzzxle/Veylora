/**
 * Two-variable linear programming, solved exactly by the corner-point method.
 *
 * Every problem has the non-negativity constraints x ≥ 0 and y ≥ 0, so a
 * non-empty feasible region never contains a whole line and always has at least
 * one corner. Then:
 *   - no corners                       → infeasible
 *   - a direction d with A·d ≤ 0 along which the objective improves → unbounded
 *   - otherwise the best value is attained at a corner; ties between corners
 *     (or a direction of zero improvement) mean infinitely many optimal points.
 * Extreme directions of the recession cone {d : A·d ≤ 0} lie along the
 * constraint lines, so checking those directions is enough in two dimensions.
 */
export type Pt = [number, number];
export type Sense = '<=' | '>=';
export interface Con {
  a: number;
  b: number;
  c: number;
  sense: Sense;
  on: boolean;
}
export interface LP {
  cx: number;
  cy: number;
  goal: 'max' | 'min';
  cons: Con[];
}
/** A row a·x + b·y ≤ c; id ≥ 0 is the constraint index, −1 is x ≥ 0 and −2 is y ≥ 0. */
export interface Row {
  a: number;
  b: number;
  c: number;
  id: number;
}
export interface Vertex {
  p: Pt;
  z: number;
  tight: number[];
}
export type Status = 'optimal' | 'multiple' | 'unbounded' | 'infeasible';
export interface Solution {
  status: Status;
  rows: Row[];
  verts: Vertex[];
  /** One optimal corner (when status is optimal or multiple). */
  opt: Vertex | null;
  /** Optimal corners that tie with opt. */
  tied: Vertex[];
  /** A direction of improvement (unbounded) or of no change (multiple along a ray). */
  ray: Pt | null;
  /** True when the feasible region itself is unbounded. */
  openRegion: boolean;
  /** Slack per constraint at opt: c − (a·x + b·y) for ≤, (a·x + b·y) − c for ≥ (NaN when off). */
  slack: number[];
  /** A constraint row that can never hold, e.g. 0x + 0y ≥ 3. */
  impossible: number | null;
}

const EPS = 1e-9;
const tol = (v: number) => 1e-7 * Math.max(1, Math.abs(v));

export const objective = (lp: LP, p: Pt) => lp.cx * p[0] + lp.cy * p[1];

/** All constraints as rows a·x + b·y ≤ c, including x ≥ 0 and y ≥ 0. */
export function rowsOf(lp: LP): { rows: Row[]; impossible: number | null } {
  const rows: Row[] = [
    { a: -1, b: 0, c: 0, id: -1 },
    { a: 0, b: -1, c: 0, id: -2 },
  ];
  let impossible: number | null = null;
  lp.cons.forEach((k, id) => {
    if (!k.on) return;
    const s = k.sense === '<=' ? 1 : -1;
    const r = { a: s * k.a, b: s * k.b, c: s * k.c, id };
    if (Math.abs(r.a) < EPS && Math.abs(r.b) < EPS) {
      if (r.c < -EPS && impossible === null) impossible = id;
      return; // 0 ≤ c always holds; nothing to draw
    }
    rows.push(r);
  });
  return { rows, impossible };
}

export const satisfies = (r: Row, p: Pt) => r.a * p[0] + r.b * p[1] <= r.c + tol(r.c) + 1e-7 * (Math.abs(r.a * p[0]) + Math.abs(r.b * p[1]));
export const feasible = (rows: Row[], p: Pt) => rows.every((r) => satisfies(r, p));

/** Corners: feasible intersections of pairs of constraint lines. */
export function vertices(rows: Row[], lp: LP): Vertex[] {
  const out: Vertex[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const A = rows[i];
      const B = rows[j];
      const det = A.a * B.b - A.b * B.a;
      if (Math.abs(det) < EPS) continue;
      const x = (A.c * B.b - A.b * B.c) / det;
      const y = (A.a * B.c - A.c * B.a) / det;
      const p: Pt = [Math.abs(x) < 1e-12 ? 0 : x, Math.abs(y) < 1e-12 ? 0 : y];
      if (!feasible(rows, p)) continue;
      if (out.some((v) => Math.abs(v.p[0] - p[0]) < 1e-7 && Math.abs(v.p[1] - p[1]) < 1e-7)) continue;
      const tight = rows.filter((r) => Math.abs(r.a * p[0] + r.b * p[1] - r.c) <= 1e-7 * Math.max(1, Math.abs(r.c))).map((r) => r.id);
      out.push({ p, z: objective(lp, p), tight });
    }
  }
  // order the corners around their centre so they can be drawn as a polygon
  if (out.length > 2) {
    const cx = out.reduce((s, v) => s + v.p[0], 0) / out.length;
    const cy = out.reduce((s, v) => s + v.p[1], 0) / out.length;
    out.sort((u, v) => Math.atan2(u.p[1] - cy, u.p[0] - cx) - Math.atan2(v.p[1] - cy, v.p[0] - cx));
  }
  return out;
}

/** Directions d ≠ 0 (unit length) with A·d ≤ 0: the feasible region continues forever along them. */
export function recessionRays(rows: Row[]): Pt[] {
  const cand: Pt[] = [];
  for (const r of rows) {
    const L = Math.hypot(r.a, r.b);
    cand.push([-r.b / L, r.a / L], [r.b / L, -r.a / L]);
  }
  const ok = cand.filter((d) => rows.every((r) => r.a * d[0] + r.b * d[1] <= 1e-9));
  const out: Pt[] = [];
  for (const d of ok) if (!out.some((e) => Math.abs(e[0] - d[0]) < 1e-9 && Math.abs(e[1] - d[1]) < 1e-9)) out.push(d);
  return out;
}

export function solve(lp: LP): Solution {
  const { rows, impossible } = rowsOf(lp);
  const blank = { rows, verts: [] as Vertex[], opt: null, tied: [] as Vertex[], ray: null, openRegion: false, slack: lp.cons.map(() => NaN), impossible };
  if (impossible !== null) return { status: 'infeasible', ...blank };
  const verts = vertices(rows, lp);
  if (!verts.length) return { status: 'infeasible', ...blank };
  const s = lp.goal === 'max' ? 1 : -1;
  const rays = recessionRays(rows);
  const openRegion = rays.length > 0;
  const better = rays.filter((d) => s * (lp.cx * d[0] + lp.cy * d[1]) > 1e-9);
  if (better.length) {
    const ray = better.reduce((m, d) => (s * (lp.cx * d[0] + lp.cy * d[1]) > s * (lp.cx * m[0] + lp.cy * m[1]) ? d : m));
    return { status: 'unbounded', ...blank, verts, ray, openRegion };
  }
  const best = verts.reduce((m, v) => (s * v.z > s * m.z ? v : m));
  const tied = verts.filter((v) => Math.abs(v.z - best.z) <= tol(best.z));
  const flat = rays.find((d) => Math.abs(lp.cx * d[0] + lp.cy * d[1]) <= 1e-9) ?? null;
  // a ray of no change only matters if it leaves an optimal corner along the region's edge
  const rayOpt = flat && tied.some((v) => feasible(rows, [v.p[0] + flat[0], v.p[1] + flat[1]])) ? flat : null;
  const slack = lp.cons.map((k) => (k.on ? (k.sense === '<=' ? k.c - (k.a * best.p[0] + k.b * best.p[1]) : k.a * best.p[0] + k.b * best.p[1] - k.c) : NaN));
  const multiple = tied.length > 1 || rayOpt !== null;
  return { status: multiple ? 'multiple' : 'optimal', rows, verts, opt: best, tied, ray: rayOpt, openRegion, slack, impossible };
}

/** Clip a convex polygon by the half-plane a·x + b·y ≤ c (Sutherland–Hodgman). */
export function clip(poly: Pt[], r: { a: number; b: number; c: number }): Pt[] {
  const out: Pt[] = [];
  const f = (p: Pt) => r.a * p[0] + r.b * p[1] - r.c;
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % poly.length];
    const fp = f(P);
    const fq = f(Q);
    if (fp <= 0) out.push(P);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
    }
  }
  return out;
}

/** The feasible region cut down to a window, for drawing. */
export function regionPolygon(rows: Row[], x0: number, x1: number, y0: number, y1: number): Pt[] {
  let poly: Pt[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  for (const r of rows) {
    poly = clip(poly, r);
    if (poly.length < 3) return [];
  }
  return poly;
}

/** Best value when constraint i's limit is changed to c (NaN if infeasible, ±Infinity if unbounded). */
export function valueWithLimit(lp: LP, i: number, c: number): number {
  const cons = lp.cons.map((k, j) => (j === i ? { ...k, c } : k));
  const S = solve({ ...lp, cons });
  if (S.status === 'infeasible') return NaN;
  if (S.status === 'unbounded') return lp.goal === 'max' ? Infinity : -Infinity;
  return S.opt!.z;
}

/**
 * Change in the best value per unit increase of constraint i's limit (the
 * shadow price), measured with a small one-sided step. The best value is
 * piecewise linear in the limit, so this is exact except right at a kink.
 */
export function shadowPrice(lp: LP, i: number, h = 1e-4): number {
  const z0 = valueWithLimit(lp, i, lp.cons[i].c);
  const z1 = valueWithLimit(lp, i, lp.cons[i].c + h);
  if (!Number.isFinite(z0) || !Number.isFinite(z1)) return NaN;
  const v = (z1 - z0) / h;
  return Math.abs(v) < 1e-6 ? 0 : Math.round(v * 1e5) / 1e5;
}

/** Best whole-number point by checking every grid point in the box [0, X] × [0, Y]. */
export function integerBest(lp: LP, X: number, Y: number): { p: Pt; z: number } | null {
  const { rows } = rowsOf(lp);
  const s = lp.goal === 'max' ? 1 : -1;
  let best: { p: Pt; z: number } | null = null;
  for (let x = 0; x <= X; x++) {
    for (let y = 0; y <= Y; y++) {
      if (!feasible(rows, [x, y])) continue;
      const z = objective(lp, [x, y]);
      if (!best || s * z > s * best.z + 1e-9) best = { p: [x, y], z };
    }
  }
  return best;
}

/* ======================= Geometric optimisation ======================= */
/** Rectangle with perimeter P: area A(x) = x(P/2 − x), best x = P/4 (a square). */
export const rectArea = (P: number, x: number) => x * (P / 2 - x);
export const rectBest = (P: number) => P / 4;
/** Open box from an L × W sheet with squares of side x cut from each corner. */
export const boxVolume = (L: number, W: number, x: number) => x * (L - 2 * x) * (W - 2 * x);
/** Root of V′(x) = 12x² − 4(L + W)x + LW = 0 that lies inside 0 < x < min(L, W)/2. */
export const boxBest = (L: number, W: number) => (L + W - Math.sqrt(L * L - L * W + W * W)) / 6;
/** Closed cylinder of volume V: surface S(r) = 2πr² + 2V/r, best r = ∛(V/2π), where h = 2r. */
export const canHeight = (V: number, r: number) => V / (Math.PI * r * r);
export const canSurface = (V: number, r: number) => 2 * Math.PI * r * r + (2 * V) / r;
export const canBest = (V: number) => Math.cbrt(V / (2 * Math.PI));
