/** Small, exact-where-possible linear-algebra helpers for the matrix lab. */

export type Mat = number[][];

export const dims = (A: Mat) => [A.length, A[0]?.length ?? 0] as const;
export const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => Array(c).fill(0));
export const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const add = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v + B[i][j]));
export const sub = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v - B[i][j]));
export const scale = (k: number, A: Mat): Mat => A.map((r) => r.map((v) => k * v));
export const transpose = (A: Mat): Mat => A[0].map((_, j) => A.map((r) => r[j]));
export function mul(A: Mat, B: Mat): Mat {
  const [m, n] = dims(A);
  const [, p] = dims(B);
  const C = zeros(m, p);
  for (let i = 0; i < m; i++) for (let j = 0; j < p; j++) for (let k = 0; k < n; k++) C[i][j] += A[i][k] * B[k][j];
  return C;
}
/** The matrix with row i and column j removed. */
export const minor = (A: Mat, i: number, j: number): Mat => A.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
export function det(A: Mat): number {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
  let s = 0;
  for (let j = 0; j < n; j++) s += (j % 2 ? -1 : 1) * A[0][j] * det(minor(A, 0, j));
  return s;
}
/** Adjugate: the transpose of the cofactor matrix. */
export function adjugate(A: Mat): Mat {
  const n = A.length;
  if (n === 1) return [[1]];
  const C = zeros(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) C[i][j] = ((i + j) % 2 ? -1 : 1) * det(minor(A, i, j));
  return transpose(C);
}
export function inverse(A: Mat): Mat | null {
  const d = det(A);
  if (Math.abs(d) < 1e-12) return null;
  return scale(1 / d, adjugate(A));
}

/** Show a number as an integer or a simple fraction when it is one, else a short decimal. */
export function frac(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const s = (x: string) => x.replace('-', '−');
  if (Math.abs(v) < 1e-10) return '0';
  if (Math.abs(v - Math.round(v)) < 1e-9) return s(String(Math.round(v)));
  for (let q = 2; q <= 60; q++) {
    const p = Math.round(v * q);
    if (Math.abs(v * q - p) < 1e-8) return s(`${p}/${q}`);
  }
  return s((+v.toPrecision(4)).toString());
}
/** A short decimal (used where fractions would be misleading, e.g. rotation matrices). */
export const dec = (v: number, sig = 3) => (Math.abs(v) < 1e-10 ? '0' : (+v.toPrecision(sig)).toString().replace('-', '−'));

/** Real eigen-analysis of a 2 × 2 matrix [[a, b], [c, d]]. */
export type Eigen2 =
  | { kind: 'distinct'; l: [number, number]; v: [[number, number], [number, number]] }
  | { kind: 'scalar'; l: number } // A = λI: every vector is an eigenvector
  | { kind: 'defective'; l: number; v: [number, number] } // repeated λ, only one eigen-direction
  | { kind: 'complex'; re: number; im: number };
export function eigen2(a: number, b: number, c: number, d: number): Eigen2 {
  const tr = a + d;
  const dt = a * d - b * c;
  const disc = tr * tr - 4 * dt;
  const eps = 1e-9 * (1 + tr * tr);
  /** A non-zero solution of (A − λI)v = 0, taken from whichever row of A − λI is non-zero. */
  const vec = (l: number): [number, number] => {
    let v: [number, number] = Math.hypot(a - l, b) > 1e-9 ? [b, l - a] : Math.hypot(c, d - l) > 1e-9 ? [l - d, c] : [1, 0];
    const n = Math.hypot(v[0], v[1]);
    if (n < 1e-12) v = [1, 0];
    return [v[0] / (n || 1), v[1] / (n || 1)];
  };
  if (disc < -eps) return { kind: 'complex', re: tr / 2, im: Math.sqrt(-disc) / 2 };
  if (Math.abs(disc) <= eps) {
    const l = tr / 2;
    if (Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12 && Math.abs(a - d) < 1e-12) return { kind: 'scalar', l };
    return { kind: 'defective', l, v: vec(l) };
  }
  const r = Math.sqrt(disc);
  const l1 = (tr + r) / 2;
  const l2 = (tr - r) / 2;
  return { kind: 'distinct', l: [l1, l2], v: [vec(l1), vec(l2)] };
}
