/**
 * Matrix lab, in five views:
 *   algebra – edit matrices A and B and apply +, −, kA, AB, Aᵀ, det and A⁻¹, with
 *             dimension checks and the working for any entry of the result.
 *   t2d     – transform a 2D shape with scaling, rotation, reflection, shear,
 *             translation or a custom matrix, using 3 × 3 homogeneous matrices and
 *             column vectors (p′ = M p). Two transforms can be combined in either order.
 *   det     – the unit square under a 2 × 2 matrix: area scales by |det|, a negative
 *             determinant flips orientation, and det = 0 collapses the plane.
 *   eigen   – test vectors under a 2 × 2 matrix; real eigenvectors keep their line.
 *   t3d     – a 3D object under scaling, rotation and reflection matrices.
 */
import type * as T from 'three';
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { add, adjugate, dec, det, dims, eigen2, frac, identity, inverse, minor, mul, scale, sub, transpose, type Mat } from './linalg';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'algebra' | 't2d' | 'det' | 'eigen' | 't3d';
type Op = 'add' | 'sub' | 'scale' | 'mul' | 'transpose' | 'det' | 'inv';
type TType = 'none' | 'scale' | 'rotate' | 'reflect' | 'shear' | 'translate' | 'custom';
type Box = { x: number; y: number; w: number; h: number };
type V2 = [number, number];
const C_I = '#e03131';
const C_J = '#2f9e44';
const C_A = '#1c7ed6';
const C_B = '#e8590c';
const C_R = '#7048e8';
const SUB = ['₀', '₁', '₂', '₃'];
const OPS: Record<Op, string> = { add: 'A + B', sub: 'A − B', scale: 'k · A', mul: 'A · B', transpose: 'Aᵀ', det: 'det A', inv: 'A⁻¹' };

const SHAPES: Record<string, V2[]> = {
  square: [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ],
  triangle: [
    [0, 0],
    [3, 0],
    [1, 2],
  ],
  rect: [
    [0, 0],
    [3, 0],
    [3, 1.5],
    [0, 1.5],
  ],
  custom: [
    [0, 0],
    [2.5, 0],
    [2.5, 0.8],
    [1, 0.8],
    [1, 2.5],
    [0, 2.5],
  ],
};
/** Labels and slider set-up for each kind of transformation. */
const TDEF: Record<Exclude<TType, 'none'>, { p?: [string, number, number, number, number]; q?: [string, number, number, number, number]; name: string }> = {
  scale: { name: 'Scaling', p: ['Scale factor sₓ', -3, 3, 0.1, 1.5], q: ['Scale factor s_y', -3, 3, 0.1, 1] },
  rotate: { name: 'Rotation', p: ['Angle θ (degrees, anticlockwise)', -180, 180, 5, 45] },
  reflect: { name: 'Reflection', p: ['Mirror line angle φ (degrees)', 0, 175, 5, 0] },
  shear: { name: 'Shear', p: ['Horizontal shear k', -3, 3, 0.1, 1], q: ['Vertical shear m', -3, 3, 0.1, 0] },
  translate: { name: 'Translation', p: ['Shift tₓ', -6, 6, 0.5, 2], q: ['Shift t_y', -6, 6, 0.5, 1] },
  custom: { name: 'Custom matrix (use a, b, c, d below)' },
};

/** 3 × 3 homogeneous matrix of a transformation, a fraction u of the way from the identity. */
function homog(type: TType, p: number, q: number, M2: number[], u = 1): Mat {
  const I = identity(3);
  if (type === 'none') return I;
  if (type === 'scale') return [[1 + (p - 1) * u, 0, 0], [0, 1 + (q - 1) * u, 0], [0, 0, 1]];
  if (type === 'rotate') {
    const th = (p * u * Math.PI) / 180;
    return [[Math.cos(th), -Math.sin(th), 0], [Math.sin(th), Math.cos(th), 0], [0, 0, 1]];
  }
  if (type === 'shear') return [[1, p * u, 0], [q * u, 1, 0], [0, 0, 1]];
  if (type === 'translate') return [[1, 0, p * u], [0, 1, q * u], [0, 0, 1]];
  const target =
    type === 'reflect'
      ? (() => {
          const f = (2 * p * Math.PI) / 180;
          return [[Math.cos(f), Math.sin(f), 0], [Math.sin(f), -Math.cos(f), 0], [0, 0, 1]];
        })()
      : [[M2[0], M2[1], 0], [M2[2], M2[3], 0], [0, 0, 1]];
  // reflections and custom matrices are blended linearly from the identity
  return I.map((r, i) => r.map((vv, j) => vv + (target[i][j] - vv) * u));
}
const apply3 = (M: Mat, [x, y]: V2): V2 => [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2]];
const area = (pts: V2[]) => Math.abs(pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0)) / 2;
const signedArea = (pts: V2[]) => pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0) / 2;
function inPoly([x, y]: V2, pts: V2[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function initMatrices(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const errEl = root.querySelector<HTMLElement>('[data-grid-err]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    view: 'algebra' as View,
    A: [
      [1, 2],
      [3, 4],
    ] as Mat,
    B: [
      [5, 6],
      [7, 8],
    ] as Mat,
    op: 'mul' as Op,
    k: 2,
    sel: [0, 1] as [number, number],
    invalid: '' as string,
    // 2D
    shape: 'square',
    off: [1, 1] as V2,
    customPts: SHAPES.custom.map((p) => [...p] as V2),
    t1: { type: 'rotate' as TType, p: 45, q: 0 },
    t2: { type: 'none' as TType, p: 1, q: 1 },
    t1First: true,
    tgrid: false,
    M2: [2, 1, 0, 1.5],
    zoom: 1,
    // eigen
    v: [1.5, 0.5] as V2,
    // 3D
    obj: 'block',
    sx: 1,
    sy: 1,
    sz: 1,
    axis: 'y' as 'x' | 'y' | 'z',
    ang: 30,
    refl: 'none' as 'none' | 'xy' | 'yz' | 'xz',
    ghost: true,
  };
  let prog = 1; // animation progress (1 = fully applied)
  let lastMsg = '';
  let t = 0;
  let selTimer = 0;

  /* ======================= Algebra ======================= */
  function result(): { R: Mat | number | null; err: string } {
    if (st.invalid) return { R: null, err: st.invalid };
    const A = st.A;
    const B = st.B;
    const [m, n] = dims(A);
    const [p, q] = dims(B);
    const sz = (M: Mat) => `${dims(M)[0]}×${dims(M)[1]}`;
    switch (st.op) {
      case 'add':
      case 'sub':
        if (m !== p || n !== q) return { R: null, err: `${OPS[st.op]} needs A and B to be the same size, but A is ${sz(A)} and B is ${sz(B)}.` };
        return { R: st.op === 'add' ? add(A, B) : sub(A, B), err: '' };
      case 'scale':
        return { R: scale(st.k, A), err: '' };
      case 'mul':
        if (n !== p) return { R: null, err: `A · B is only defined when A has as many columns as B has rows. A is ${sz(A)} (${n} column${n > 1 ? 's' : ''}) and B is ${sz(B)} (${p} row${p > 1 ? 's' : ''}).` };
        return { R: mul(A, B), err: '' };
      case 'transpose':
        return { R: transpose(A), err: '' };
      case 'det':
        if (m !== n) return { R: null, err: `Only square matrices have a determinant; A is ${sz(A)}.` };
        return { R: det(A), err: '' };
      case 'inv': {
        if (m !== n) return { R: null, err: `Only square matrices can have an inverse; A is ${sz(A)}.` };
        const I = inverse(A);
        if (!I) return { R: null, err: `det A = 0, so A is singular and has no inverse: it squashes space into fewer dimensions, and that cannot be undone.` };
        return { R: I, err: '' };
      }
    }
  }
  /** The working for the selected entry of the result. */
  function steps(): string[] {
    const { R, err } = result();
    const A = st.A;
    const B = st.B;
    const s = (i: number, j: number) => `${SUB[i + 1]}${SUB[j + 1]}`;
    const [i, j] = st.sel;
    const n = (v: number) => (v < 0 ? `(${frac(v)})` : frac(v));
    if (err) return [err];
    const out: string[] = [];
    const sizes: Record<Op, string> = {
      add: `A and B are both ${dims(A)[0]}×${dims(A)[1]}, so the sum is too. Add matching entries.`,
      sub: `A and B are both ${dims(A)[0]}×${dims(A)[1]}, so the difference is too. Subtract matching entries.`,
      scale: 'Multiply every entry of A by the scalar k.',
      mul: `A is ${dims(A)[0]}×${dims(A)[1]} and B is ${dims(B)[0]}×${dims(B)[1]}: the inner sizes match (${dims(A)[1]} = ${dims(B)[0]}), so AB is ${dims(A)[0]}×${dims(B)[1]}. Each entry is a row of A times a column of B.`,
      transpose: `Rows become columns: a ${dims(A)[0]}×${dims(A)[1]} matrix becomes ${dims(A)[1]}×${dims(A)[0]}.`,
      det: 'The determinant of a square matrix is a single number.',
      inv: 'A⁻¹ = (1 / det A) · adj(A), where adj(A) is the transpose of the matrix of cofactors.',
    };
    out.push(sizes[st.op]);
    if (st.op === 'add' || st.op === 'sub') out.push(`c${s(i, j)} = a${s(i, j)} ${st.op === 'add' ? '+' : '−'} b${s(i, j)} = ${frac(A[i][j])} ${st.op === 'add' ? '+' : '−'} ${n(B[i][j])} = ${frac((R as Mat)[i][j])}`);
    if (st.op === 'scale') out.push(`c${s(i, j)} = k · a${s(i, j)} = ${frac(st.k)} · ${n(A[i][j])} = ${frac((R as Mat)[i][j])}`);
    if (st.op === 'transpose') out.push(`(Aᵀ)${s(i, j)} = a${s(j, i)} = ${frac(A[j][i])}`);
    if (st.op === 'mul') {
      const K = dims(A)[1];
      const sym = Array.from({ length: K }, (_, k) => `a${s(i, k)}b${s(k, j)}`).join(' + ');
      const num = Array.from({ length: K }, (_, k) => `${n(A[i][k])}·${n(B[k][j])}`).join(' + ');
      out.push(`c${s(i, j)} = (row ${i + 1} of A) · (column ${j + 1} of B) = ${sym}`);
      out.push(`= ${num} = ${frac((R as Mat)[i][j])}`);
    }
    if (st.op === 'det' || st.op === 'inv') {
      const N = A.length;
      if (N === 1) out.push(`det A = a₁₁ = ${frac(A[0][0])}`);
      else if (N === 2) out.push(`det A = a₁₁a₂₂ − a₁₂a₂₁ = ${n(A[0][0])}·${n(A[1][1])} − ${n(A[0][1])}·${n(A[1][0])} = ${frac(det(A))}`);
      else {
        const terms = [0, 1, 2].map((k) => `${k ? (k % 2 ? ' − ' : ' + ') : ''}${n(A[0][k])}·${n(det(minor(A, 0, k)))}`).join('');
        out.push('Expand along row 1: det A = a₁₁·det M₁₁ − a₁₂·det M₁₂ + a₁₃·det M₁₃, where M₁ⱼ removes row 1 and column j.');
        out.push(`det A = ${terms} = ${frac(det(A))}`);
      }
    }
    if (st.op === 'inv' && R) {
      const d = det(A);
      const adj = adjugate(A);
      if (A.length === 2) out.push(`For a 2×2 matrix: A⁻¹ = 1/(ad − bc) · [d −b; −c a] = 1/${n(d)} · [${frac(A[1][1])} ${frac(-A[0][1])}; ${frac(-A[1][0])} ${frac(A[0][0])}]`);
      else out.push(`(A⁻¹)${s(i, j)} = (cofactor C${s(j, i)}) / det A = ${n(adj[i][j])} / ${n(d)} = ${frac((R as Mat)[i][j])}`);
      const chk = mul(A, R as Mat);
      const ok = chk.every((r, a) => r.every((v, b) => Math.abs(v - (a === b ? 1 : 0)) < 1e-9));
      out.push(ok ? 'Check: A · A⁻¹ = I (the identity matrix) ✓' : 'Check failed: rounding error.');
    }
    return out;
  }

  /* ======================= Drawing helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): V2 => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const toBox = (x: number, y: number): V2 => {
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
  function arrowTo(x0: number, y0: number, x1: number, y1: number, col: string, lw = 2.5) {
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw / cur;
    const a = Math.atan2(y1 - y0, x1 - x0);
    const L = Math.hypot(x1 - x0, y1 - y0);
    const hs = Math.min(12 / cur, L * 0.4);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - Math.cos(a) * hs * 0.7, y1 - Math.sin(a) * hs * 0.7);
    ctx.stroke();
    if (L < 1e-6) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hs * Math.cos(a - 0.4), y1 - hs * Math.sin(a - 0.4));
    ctx.lineTo(x1 - hs * Math.cos(a + 0.4), y1 - hs * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fill();
  }
  function dot(x: number, y: number, r: number, fill: string, stroke: string | null = '#ffffff') {
    ctx.beginPath();
    ctx.arc(x, y, r / cur, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 / cur;
      ctx.stroke();
    }
  }
  /** Draw a matrix with square brackets; returns its width. Cells can be highlighted. */
  function drawMatrix(M: Mat, x: number, y: number, o: { cw?: number; ch?: number; px?: number; color?: string; hiRow?: number; hiCol?: number; hiCell?: [number, number]; hiColor?: string; fmt?: (v: number) => string; cells?: { i: number; j: number; x: number; y: number; w: number; h: number }[] } = {}) {
    const [m, n] = dims(M);
    const fmtv = o.fmt ?? frac;
    ctx.font = fs(o.px ?? 15, 700);
    const widest = Math.max(...M.flat().map((v) => ctx.measureText(fmtv(v)).width));
    const cw = Math.max(o.cw ?? 46, widest + 16 / cur);
    const ch = o.ch ?? 34;
    const W = n * cw + 16;
    const H = m * ch;
    const hc = o.hiColor ?? withAlpha(pal.accent, 0.22);
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) {
        const cx = x + 8 + j * cw;
        const cy = y + i * ch;
        const hi = o.hiRow === i || o.hiCol === j || (o.hiCell && o.hiCell[0] === i && o.hiCell[1] === j);
        if (hi) {
          ctx.fillStyle = hc;
          ctx.beginPath();
          ctx.roundRect(cx + 2, cy + 2, cw - 4, ch - 4, 6);
          ctx.fill();
        }
        text(fmtv(M[i][j]), cx + cw / 2, cy + ch / 2 + 5 / cur, o.px ?? 15, o.color ?? pal['sim-text'], 'center', 700);
        o.cells?.push({ i, j, x: cx, y: cy, w: cw, h: ch });
      }
    ctx.strokeStyle = o.color ?? pal['sim-text'];
    ctx.lineWidth = 2 / cur;
    ctx.beginPath();
    ctx.moveTo(x + 7, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + H);
    ctx.lineTo(x + 7, y + H);
    ctx.moveTo(x + W - 7, y);
    ctx.lineTo(x + W, y);
    ctx.lineTo(x + W, y + H);
    ctx.lineTo(x + W - 7, y + H);
    ctx.stroke();
    return { w: W, h: H };
  }
  const matW = (M: Mat, px = 15, cwMin = 46, fmtv = frac) => {
    ctx.font = fs(px, 700);
    const widest = Math.max(...M.flat().map((v) => ctx.measureText(fmtv(v)).width));
    return dims(M)[1] * Math.max(cwMin, widest + 16 / cur) + 16;
  };

  /* ======================= Algebra view ======================= */
  let resultCells: { i: number; j: number; x: number; y: number; w: number; h: number }[] = [];
  function drawAlgebra() {
    const [bw] = box();
    const P: Box = { x: 14, y: portrait() ? 104 : 14, w: bw - 28, h: portrait() ? 560 : 330 };
    panel(P, pal['surface-2']);
    const { R, err } = result();
    const unary = st.op === 'scale' || st.op === 'transpose' || st.op === 'det' || st.op === 'inv';
    const [i, j] = st.sel;
    const isMat = Array.isArray(R);
    const hiA = (): Partial<Parameters<typeof drawMatrix>[3]> => {
      if (!isMat) return {};
      if (st.op === 'mul') return { hiRow: i, hiColor: withAlpha(C_A, 0.22) };
      if (st.op === 'transpose') return { hiCell: [j, i], hiColor: withAlpha(C_A, 0.22) };
      if (st.op === 'inv') return {};
      return { hiCell: [i, j], hiColor: withAlpha(C_A, 0.22) };
    };
    const hiB = (): Partial<Parameters<typeof drawMatrix>[3]> => (isMat && st.op === 'mul' ? { hiCol: j, hiColor: withAlpha(C_B, 0.22) } : isMat && !unary ? { hiCell: [i, j], hiColor: withAlpha(C_B, 0.22) } : {});
    // items to lay out: label + matrix pairs and operators
    type Item = { kind: 'mat'; M: Mat; label: string; color: string; o: Partial<Parameters<typeof drawMatrix>[3]> } | { kind: 'sym'; s: string } | { kind: 'num'; s: string; color: string };
    const items: Item[] = [];
    if (st.op === 'scale') items.push({ kind: 'num', s: frac(st.k), color: pal.accent }, { kind: 'sym', s: '·' });
    if (st.op === 'det') items.push({ kind: 'sym', s: 'det' });
    items.push({ kind: 'mat', M: st.A, label: `A (${dims(st.A)[0]}×${dims(st.A)[1]})`, color: C_A, o: hiA() });
    if (st.op === 'transpose') items.push({ kind: 'sym', s: 'ᵀ' });
    if (st.op === 'inv') items.push({ kind: 'sym', s: '⁻¹' });
    if (!unary) items.push({ kind: 'sym', s: st.op === 'add' ? '+' : st.op === 'sub' ? '−' : '·' }, { kind: 'mat', M: st.B, label: `B (${dims(st.B)[0]}×${dims(st.B)[1]})`, color: C_B, o: hiB() });
    items.push({ kind: 'sym', s: '=' });
    const AP = 20; // entry font size
    const ACW = 62;
    const ACH = 48;
    const width = (it: Item) => (it.kind === 'mat' ? matW(it.M, AP, ACW) : it.kind === 'sym' ? (it.s.length > 1 ? 60 : 40) : 48);
    const resW = isMat ? matW(R as Mat, AP, ACW) : 140;
    const total = items.reduce((s, it) => s + width(it), 0) + resW;
    const twoRows = total > P.w - 30;
    const rowH = Math.max(...[st.A, st.B, isMat ? (R as Mat) : [[0]]].map((M) => dims(M)[0] * ACH)) + 36;
    let x = P.x + Math.max(16, (P.w - (twoRows ? total - resW : total)) / 2);
    let y = P.y + (twoRows ? 40 : (P.h - rowH) / 2 + 20);
    const cy = (M: Mat) => y + (rowH - 36 - dims(M)[0] * ACH) / 2 + 10;
    for (const it of items) {
      if (it.kind === 'mat') {
        text(it.label, x + matW(it.M, AP, ACW) / 2, cy(it.M) - 10 / cur, 12, it.color, 'center', 800);
        drawMatrix(it.M, x, cy(it.M), { ...it.o, color: pal['sim-text'], px: AP, cw: ACW, ch: ACH });
      } else if (it.kind === 'sym') text(it.s, x + width(it) / 2, y + (rowH - 36) / 2 + 18 / cur, it.s.length > 1 ? 18 : 26, pal['sim-text'], 'center', 800);
      else text(it.s, x + width(it) / 2, y + (rowH - 36) / 2 + 18 / cur, 22, it.color, 'center', 800);
      x += width(it);
    }
    if (twoRows) {
      x = P.x + Math.max(16, (P.w - resW) / 2);
      y += rowH + 10;
    }
    resultCells = [];
    if (err) {
      ctx.font = fs(12, 700);
      const bwid = Math.min(P.w - 40, 360);
      const bx = twoRows ? P.x + (P.w - bwid) / 2 : Math.min(x, P.x + P.w - bwid - 16);
      ctx.fillStyle = withAlpha(pal.danger, 0.12);
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      ctx.roundRect(bx, y + 4, bwid, rowH - 20, 8);
      ctx.fill();
      ctx.stroke();
      text('Not defined', bx + bwid / 2, y + 26, 13, pal.danger, 'center', 800);
      wrap(err, bx + 12, y + 46, bwid - 24, 10.5, pal.danger, 650, y + rowH - 20);
    } else if (isMat) {
      const M = R as Mat;
      text(`Result (${dims(M)[0]}×${dims(M)[1]})`, x + matW(M, AP, ACW) / 2, cy(M) - 10 / cur, 12, C_R, 'center', 800);
      drawMatrix(M, x, cy(M), { hiCell: [i, j], hiColor: withAlpha(C_R, 0.3), cells: resultCells, color: pal['sim-text'], px: AP, cw: ACW, ch: ACH });
    } else text(frac(R as number), x + 10, y + (rowH - 36) / 2 + 20 / cur, 28, C_R, 'left', 800);
    // working
    const S: Box = portrait() ? { x: 14, y: 676, w: 652, h: 312 } : { x: 14, y: 356, w: 972, h: 230 };
    panel(S);
    let ty = S.y + 24;
    text(isMat && !err ? 'Working · tap any entry of the result' : 'Working', S.x + 14, ty, 12.5, pal['sim-text'], 'left', 800);
    ty += 22 / cur;
    for (const [k, line] of steps().entries()) ty = wrap(line, S.x + 14, ty, S.w - 28, k === 0 ? 12 : 13.5, k === 0 ? pal['text-muted'] : err ? pal.danger : pal['sim-text'], k === 0 ? 650 : 750, S.y + S.h - 8) + 4 / cur;
  }

  /* ======================= Plane views ======================= */
  const planeLayout = () => (portrait() ? { plot: { x: 14, y: 104, w: 652, h: 486 }, side: { x: 14, y: 602, w: 652, h: 386 } } : { plot: { x: 14, y: 14, w: 600, h: 572 }, side: { x: 626, y: 70, w: 360, h: 516 } });
  let PL: Box = { x: 0, y: 0, w: 1, h: 1 };
  let S = 40; // px per unit
  const X = (x: number) => PL.x + PL.w / 2 + x * S;
  const Y = (y: number) => PL.y + PL.h / 2 - y * S;
  const WX = (px: number) => (px - PL.x - PL.w / 2) / S;
  const WY = (py: number) => (PL.y + PL.h / 2 - py) / S;
  function setPlane(range: number) {
    PL = planeLayout().plot;
    S = Math.min(PL.w, PL.h) / (2 * range * st.zoom);
  }
  function plane() {
    ctx.fillStyle = pal['surface-2'];
    ctx.fillRect(PL.x, PL.y, PL.w, PL.h);
    const nx = Math.ceil(PL.w / 2 / S);
    const ny = Math.ceil(PL.h / 2 / S);
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.22);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let k = -nx; k <= nx; k++) {
      ctx.moveTo(X(k), PL.y);
      ctx.lineTo(X(k), PL.y + PL.h);
    }
    for (let k = -ny; k <= ny; k++) {
      ctx.moveTo(PL.x, Y(k));
      ctx.lineTo(PL.x + PL.w, Y(k));
    }
    ctx.stroke();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5 / cur;
    ctx.beginPath();
    ctx.moveTo(PL.x, Y(0));
    ctx.lineTo(PL.x + PL.w, Y(0));
    ctx.moveTo(X(0), PL.y);
    ctx.lineTo(X(0), PL.y + PL.h);
    ctx.stroke();
    const step = S < 22 ? 2 : 1;
    for (let k = -nx; k <= nx; k += step) if (k) text(`${k}`.replace('-', '−'), X(k), Y(0) + 13 / cur, 9.5, pal['text-faint'], 'center', 600);
    for (let k = -ny; k <= ny; k += step) if (k) text(`${k}`.replace('-', '−'), X(0) - 5 / cur, Y(k) + 3 / cur, 9.5, pal['text-faint'], 'right', 600);
  }
  /** The image of the integer grid under a 2 × 2 matrix. */
  function imageGrid(a: number, b: number, c: number, d: number, col = withAlpha(C_R, 0.28)) {
    const N = 12;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let k = -N; k <= N; k++) {
      ctx.moveTo(X(a * k + b * -N), Y(c * k + d * -N));
      ctx.lineTo(X(a * k + b * N), Y(c * k + d * N));
      ctx.moveTo(X(a * -N + b * k), Y(c * -N + d * k));
      ctx.lineTo(X(a * N + b * k), Y(c * N + d * k));
    }
    ctx.stroke();
    ctx.restore();
  }
  function poly(pts: V2[], fill: string | null, stroke: string, lw = 2, dash: number[] = []) {
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.setLineDash(dash.map((q) => q / cur));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw / cur;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const handles: { id: string; x: number; y: number }[] = [];

  /* ---------- 2D transformations ---------- */
  const basePts = (): V2[] => (st.shape === 'custom' ? st.customPts : SHAPES[st.shape]).map(([x, y]) => [x + st.off[0], y + st.off[1]]);
  /** Combined matrix, with an animation fraction for each step. */
  function combined(u = prog): { M: Mat; M1: Mat; M2: Mat; first: Mat; second: Mat } {
    const u1 = clamp(u * 2, 0, 1);
    const u2 = clamp(u * 2 - 1, 0, 1);
    const T1 = homog(st.t1.type, st.t1.p, st.t1.q, st.M2, 1);
    const T2 = homog(st.t2.type, st.t2.p, st.t2.q, st.M2, 1);
    const firstT = st.t1First ? st.t1 : st.t2;
    const secondT = st.t1First ? st.t2 : st.t1;
    const hasSecond = secondT.type !== 'none';
    const f = homog(firstT.type, firstT.p, firstT.q, st.M2, hasSecond ? u1 : u);
    const s = homog(secondT.type, secondT.p, secondT.q, st.M2, hasSecond ? u2 : 1);
    return { M: mul(s, f), M1: T1, M2: T2, first: f, second: s };
  }
  function drawT2D() {
    setPlane(6);
    plane();
    const { M } = combined();
    if (st.tgrid) imageGrid(M[0][0], M[0][1], M[1][0], M[1][1]);
    const pts = basePts();
    const out = pts.map((p) => apply3(M, p));
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    poly(pts, withAlpha(pal['text-faint'], 0.12), pal['text-muted'], 1.5, [6, 5]);
    poly(out, withAlpha(C_R, 0.3), C_R, 2.5);
    const L = 'ABCDEF';
    pts.forEach((p, k) => {
      dot(X(p[0]), Y(p[1]), st.shape === 'custom' ? 5.5 : 3.5, st.shape === 'custom' ? pal['text-muted'] : pal['text-faint'], st.shape === 'custom' ? '#ffffff' : null);
      text(L[k], X(p[0]) - 9 / cur, Y(p[1]) - 6 / cur, 10.5, pal['text-muted'], 'center', 750);
      if (st.shape === 'custom') handles.push({ id: `v${k}`, x: X(p[0]), y: Y(p[1]) });
    });
    out.forEach((p, k) => {
      dot(X(p[0]), Y(p[1]), 4, C_R);
      text(`${L[k]}′`, X(p[0]) + 10 / cur, Y(p[1]) - 6 / cur, 11, C_R, 'center', 800);
    });
    ctx.restore();
    text(portrait() ? 'Dashed: original · purple: transformed' : 'Original (dashed) · transformed (purple). Drag the original to move it.', PL.x + 10 / cur, PL.y + 18 / cur, 10.5, pal['text-muted'], 'left', 700);
  }
  function drawT2DSide(B: Box) {
    panel(B);
    const { M, M1, M2 } = combined(1);
    const two = false; // one column reads best in both orientations
    let y = B.y + 22;
    const x0 = B.x + 12;
    const firstName = st.t1First ? 'T₁' : 'T₂';
    const secondName = st.t1First ? 'T₂' : 'T₁';
    const hasT2 = st.t2.type !== 'none';
    text(hasT2 ? `M = ${secondName} · ${firstName}  (${firstName} is applied first)` : 'M = T₁', x0, y, 12, pal['sim-text'], 'left', 800);
    y += 14 / cur;
    const o = { cw: 26 / cur, ch: 17 / cur, px: 11, fmt: (v: number) => dec(v, 3) };
    // row 1: M; row 2: the factors (second · first)
    y += 8 / cur;
    text('M =', x0, y + 30 / cur, 13, C_R, 'left', 800);
    drawMatrix(M, x0 + 34 / cur, y, o);
    y += 3 * o.ch + 26 / cur;
    const o2 = { cw: 22 / cur, ch: 15 / cur, px: 10, fmt: (v: number) => dec(v, 2) };
    if (hasT2) {
      let x = x0;
      text('=', x, y + 30 / cur, 14, pal['sim-text'], 'left', 800);
      x += 14 / cur;
      for (const [lab, Mt] of [
        [secondName, st.t1First ? M2 : M1],
        [firstName, st.t1First ? M1 : M2],
      ] as [string, Mat][]) {
        const w = drawMatrix(Mt, x, y + 8 / cur, o2).w;
        text(lab, x + w / 2, y + 2 / cur, 10.5, pal['text-muted'], 'center', 800);
        x += w + 6 / cur;
        if (lab === secondName) {
          text('·', x + 2 / cur, y + 34 / cur, 16, pal['sim-text'], 'center', 800);
          x += 12 / cur;
        }
      }
      y += 3 * o2.ch + 30 / cur;
    }
    const det2 = M[0][0] * M[1][1] - M[0][1] * M[1][0];
    y = wrap(`Column vectors: p′ = M·[x, y, 1]ᵀ. The extra 1 lets translation be a matrix product. det of the 2×2 part = ${dec(det2, 3)}${det2 < 0 ? ' (orientation flips: the labels run the other way)' : ''}.`, x0, y, two ? B.w / 2 - 20 : B.w - 24, 10.5, pal['text-muted'], 650);
    // coordinates
    const pts = basePts();
    const out = pts.map((p) => apply3(M, p));
    const tx = two ? B.x + B.w / 2 + 6 : x0;
    let ty = two ? B.y + 22 : y + 4 / cur;
    text('Vertex', tx, ty, 10.5, pal['sim-text'], 'left', 800);
    text('(x, y)', tx + 60, ty, 10.5, pal['sim-text'], 'left', 800);
    text('→ (x′, y′)', tx + 160, ty, 10.5, C_R, 'left', 800);
    ty += 16 / cur;
    const L = 'ABCDEF';
    pts.forEach((p, k) => {
      if (ty > B.y + B.h - 26 / cur) return;
      text(L[k], tx, ty, 10.5, pal['text-muted'], 'left', 700);
      text(`(${dec(p[0], 3)}, ${dec(p[1], 3)})`, tx + 60, ty, 10.5, pal['text-muted'], 'left', 650);
      text(`(${dec(out[k][0], 3)}, ${dec(out[k][1], 3)})`, tx + 160, ty, 10.5, C_R, 'left', 700);
      ty += 15 / cur;
    });
    text(`Area ${dec(area(pts), 3)} → ${dec(area(out), 3)}`, tx, ty + 4 / cur, 10.5, pal['sim-text'], 'left', 750);
  }

  /* ---------- determinant ---------- */
  const m2 = () => {
    const [a, b, c, d] = st.M2;
    // animate from the identity
    return [1 + (a - 1) * prog, b * prog, c * prog, 1 + (d - 1) * prog];
  };
  function drawDet() {
    setPlane(4);
    plane();
    const [a, b, c, d] = m2();
    imageGrid(a, b, c, d);
    const dt = a * d - b * c;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    const sq: V2[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    poly(sq, withAlpha(pal['text-faint'], 0.15), pal['text-muted'], 1.5, [5, 4]);
    const img = sq.map(([x, y]) => [a * x + b * y, c * x + d * y] as V2);
    const col = Math.abs(dt) < 1e-9 ? pal['text-faint'] : dt > 0 ? C_A : C_B;
    poly(img, withAlpha(col, 0.3), col, 2.5);
    // an “F” shows orientation
    const F: V2[][] = [
      [
        [0.3, 0.15],
        [0.3, 0.85],
      ],
      [
        [0.3, 0.85],
        [0.72, 0.85],
      ],
      [
        [0.3, 0.52],
        [0.6, 0.52],
      ],
    ];
    for (const [M, colF, lw] of [
      [[1, 0, 0, 1], withAlpha(pal['text-muted'], 0.6), 2],
      [[a, b, c, d], col, 3],
    ] as [number[], string, number][]) {
      ctx.strokeStyle = colF;
      ctx.lineWidth = lw / cur;
      ctx.beginPath();
      for (const [[x1, y1], [x2, y2]] of F) {
        ctx.moveTo(X(M[0] * x1 + M[1] * y1), Y(M[2] * x1 + M[3] * y1));
        ctx.lineTo(X(M[0] * x2 + M[1] * y2), Y(M[2] * x2 + M[3] * y2));
      }
      ctx.stroke();
    }
    ctx.restore();
    arrowTo(X(0), Y(0), X(a), Y(c), C_I, 3);
    arrowTo(X(0), Y(0), X(b), Y(d), C_J, 3);
    dot(X(a), Y(c), 7, C_I);
    dot(X(b), Y(d), 7, C_J);
    text(`column 1 = (${dec(a, 3)}, ${dec(c, 3)})`, X(a) + 10 / cur, Y(c) + 18 / cur, 11, C_I, 'left', 800);
    text(`column 2 = (${dec(b, 3)}, ${dec(d, 3)})`, X(b) + 10 / cur, Y(d) - 10 / cur, 11, C_J, 'left', 800);
    handles.push({ id: 'i', x: X(a), y: Y(c) }, { id: 'j', x: X(b), y: Y(d) });
    text(portrait() ? 'Drag the arrow tips (the columns)' : 'Drag the red and green arrow tips: they are the columns of the matrix.', PL.x + 10 / cur, PL.y + 18 / cur, 10.5, pal['text-muted'], 'left', 700);
  }
  function drawDetSide(B: Box) {
    panel(B);
    const [a, b, c, d] = st.M2;
    const dt = a * d - b * c;
    let y = B.y + 22;
    const x0 = B.x + 12;
    text('A =', x0, y + 22 / cur, 14, pal['sim-text'], 'left', 800);
    drawMatrix(
      [
        [a, b],
        [c, d],
      ],
      x0 + 34 / cur,
      y,
      { cw: 38 / cur, ch: 20 / cur, px: 13, fmt: (v) => dec(v, 3) },
    );
    y += 64 / cur;
    const ln = (s: string, col = pal['text-muted'], px = 11.5, wt = 650) => {
      y = wrap(s, x0, y, B.w - 24, px, col, wt, B.y + B.h - 6);
    };
    ln(`det A = ad − bc = (${dec(a, 3)})(${dec(d, 3)}) − (${dec(b, 3)})(${dec(c, 3)}) = ${dec(dt, 4)}`, pal['sim-text'], 12, 800);
    ln(`The unit square (area 1) becomes a parallelogram of area |det A| = ${dec(Math.abs(dt), 4)}.`);
    if (Math.abs(dt) < 1e-9) ln('det A = 0: the whole plane is squashed onto a line (or a point). Area is lost, so the transformation cannot be undone: A has no inverse.', pal.danger, 11.5, 700);
    else if (dt < 0) ln('det A < 0: orientation is reversed. The F is mirrored, and turning from column 1 to column 2 is now clockwise.', C_B, 11.5, 700);
    else ln('det A > 0: orientation is preserved. The F reads the right way round.', C_A, 11.5, 700);
    ln('Column 1 of A is where (1, 0) lands and column 2 is where (0, 1) lands, so every point (x, y) maps to x·(column 1) + y·(column 2).', pal['text-faint'], 10.5);
  }

  /* ---------- eigenvectors ---------- */
  function drawEigen() {
    setPlane(4);
    plane();
    const [a, b, c, d] = m2();
    imageGrid(a, b, c, d, withAlpha(C_R, 0.18));
    const E = eigen2(...(st.M2 as [number, number, number, number]));
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL.x, PL.y, PL.w, PL.h);
    ctx.clip();
    // eigen-lines (for the full matrix)
    const lines: [V2, number][] = E.kind === 'distinct' ? [[E.v[0], E.l[0]], [E.v[1], E.l[1]]] : E.kind === 'defective' ? [[E.v, E.l]] : [];
    for (const [[vx, vy], l] of lines) {
      ctx.strokeStyle = withAlpha(C_J, 0.75);
      ctx.setLineDash([8 / cur, 6 / cur]);
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.moveTo(X(-20 * vx), Y(-20 * vy));
      ctx.lineTo(X(20 * vx), Y(20 * vy));
      ctx.stroke();
      ctx.setLineDash([]);
      const lx = 3.2 * vx;
      const ly = 3.2 * vy;
      text(`λ = ${dec(l, 3)}`, X(lx) + 8 / cur, Y(ly) - 8 / cur, 11.5, C_J, 'left', 800);
    }
    // ring of test vectors and their images
    const N = 24;
    const r = 1.5;
    for (let k = 0; k < N; k++) {
      const th = (k / N) * Math.PI * 2;
      const v: V2 = [r * Math.cos(th), r * Math.sin(th)];
      const Av: V2 = [a * v[0] + b * v[1], c * v[0] + d * v[1]];
      const cross = v[0] * Av[1] - v[1] * Av[0];
      const keeps = Math.hypot(...Av) < 1e-6 || Math.abs(cross) < 0.035 * Math.hypot(...v) * Math.hypot(...Av);
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.45);
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(v[0]), Y(v[1]));
      ctx.stroke();
      arrowTo(X(0), Y(0), X(Av[0]), Y(Av[1]), keeps && prog >= 1 ? C_J : withAlpha(C_R, 0.55), keeps && prog >= 1 ? 2.5 : 1.3);
    }
    ctx.restore();
    // the draggable test vector
    const v = st.v;
    const Av: V2 = [a * v[0] + b * v[1], c * v[0] + d * v[1]];
    arrowTo(X(0), Y(0), X(v[0]), Y(v[1]), C_A, 3);
    arrowTo(X(0), Y(0), X(Av[0]), Y(Av[1]), C_B, 3);
    dot(X(v[0]), Y(v[1]), 7, C_A);
    text('v', X(v[0]) + 10 / cur, Y(v[1]) - 8 / cur, 12, C_A, 'left', 800);
    text('Av', X(Av[0]) + 10 / cur, Y(Av[1]) - 8 / cur, 12, C_B, 'left', 800);
    handles.push({ id: 'v', x: X(v[0]), y: Y(v[1]) });
    text(portrait() ? 'Green: vectors that kept their line' : 'Thin arrows: where A sends each test vector. Green: it stayed on its own line.', PL.x + 10 / cur, PL.y + 18 / cur, 10.5, pal['text-muted'], 'left', 700);
  }
  function eigenText(): string[] {
    const [a, b, c, d] = st.M2;
    const E = eigen2(a, b, c, d);
    const tr = a + d;
    const dt = a * d - b * c;
    const out = [`Characteristic equation: λ² − (trace)λ + det = λ² − ${dec(tr, 3)}λ + ${dec(dt, 3)} = 0`.replace('+ −', '− ').replace('− −', '+ ')];
    if (E.kind === 'distinct') {
      out.push(`Two real eigenvalues: λ₁ = ${dec(E.l[0], 4)}, λ₂ = ${dec(E.l[1], 4)}.`);
      E.l.forEach((l, k) => {
        const v = E.v[k];
        out.push(`v${SUB[k + 1]} ∝ (${dec(v[0], 3)}, ${dec(v[1], 3)}): A v${SUB[k + 1]} = ${dec(l, 3)} v${SUB[k + 1]} — ${Math.abs(l) < 1e-9 ? 'squashed to zero' : l < 0 ? (Math.abs(l) > 1 ? 'reversed and stretched' : Math.abs(l) < 1 ? 'reversed and shrunk' : 'reversed') : l > 1 ? 'stretched' : l < 1 ? 'shrunk' : 'unchanged'}.`);
      });
    } else if (E.kind === 'scalar') out.push(`A = ${dec(E.l, 3)}·I: every vector is an eigenvector with λ = ${dec(E.l, 3)}. Every direction is kept.`);
    else if (E.kind === 'defective') out.push(`One repeated eigenvalue λ = ${dec(E.l, 3)}, but only one eigen-direction (${dec(E.v[0], 3)}, ${dec(E.v[1], 3)}). A shear like this does not have a full set of eigenvectors.`);
    else out.push(`The eigenvalues are complex: λ = ${dec(E.re, 3)} ± ${dec(E.im, 3)}i. No real vector keeps its direction: A rotates every vector. There are no real eigenvectors to draw.`);
    return out;
  }
  function drawEigenSide(B: Box) {
    panel(B);
    const [a, b, c, d] = st.M2;
    let y = B.y + 22;
    const x0 = B.x + 12;
    text('A v = λ v', x0, y, 14, pal['sim-text'], 'left', 800);
    drawMatrix(
      [
        [a, b],
        [c, d],
      ],
      x0 + 90 / cur,
      y - 14 / cur,
      { cw: 36 / cur, ch: 18 / cur, px: 12, fmt: (q) => dec(q, 3) },
    );
    y += 40 / cur;
    for (const [k, s] of eigenText().entries()) y = wrap(s, x0, y, B.w - 24, 11, k === 0 ? pal['text-muted'] : pal['sim-text'], k === 0 ? 650 : 700, B.y + B.h - 6) + 3 / cur;
    const v = st.v;
    const Av: V2 = [a * v[0] + b * v[1], c * v[0] + d * v[1]];
    const ang = (Math.atan2(v[0] * Av[1] - v[1] * Av[0], v[0] * Av[0] + v[1] * Av[1]) * 180) / Math.PI;
    y = wrap(`Your vector v = (${dec(v[0], 3)}, ${dec(v[1], 3)}) → Av = (${dec(Av[0], 3)}, ${dec(Av[1], 3)}), turned ${dec(Math.abs(ang), 3)}°${Math.abs(ang) < 1 || Math.abs(Math.abs(ang) - 180) < 1 ? ' — on the same line, so v is (close to) an eigenvector.' : '.'}`, x0, y + 2 / cur, B.w - 24, 10.5, C_A, 700, B.y + B.h - 6);
  }

  /* ======================= 3D view ======================= */
  let three: ThreeScene | null = null;
  let threeFailed = false;
  let loading3D = false;
  let update3D = () => {};
  let place3DLabels = () => {};
  function m3(u = prog): Mat {
    const S3: Mat = [
      [1 + (st.sx - 1) * u, 0, 0],
      [0, 1 + (st.sy - 1) * u, 0],
      [0, 0, 1 + (st.sz - 1) * u],
    ];
    const th = (st.ang * u * Math.PI) / 180;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const R3: Mat = st.axis === 'x' ? [[1, 0, 0], [0, cs, -sn], [0, sn, cs]] : st.axis === 'y' ? [[cs, 0, sn], [0, 1, 0], [-sn, 0, cs]] : [[cs, -sn, 0], [sn, cs, 0], [0, 0, 1]];
    const diag = st.refl === 'xy' ? [1, 1, -1] : st.refl === 'yz' ? [-1, 1, 1] : st.refl === 'xz' ? [1, -1, 1] : [1, 1, 1];
    const F3: Mat = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 + (diag[i] - 1) * u : 0)));
    return mul(F3, mul(R3, S3));
  }
  async function ensure3D() {
    if (three || threeFailed || loading3D) return;
    loading3D = true;
    sim.setLoading('Loading 3D…');
    try {
      const asp = container.clientWidth / Math.max(1, container.clientHeight);
      const back = clamp(Math.pow(asp, -1.2), 1, 1.9);
      three = await createThreeScene(container, {
        label: 'A 3D object transformed by a 3 by 3 matrix, with the original shown as a wireframe. Drag to orbit the camera.',
        camera: { position: [4.2 * back, 3.2 * back, 5 * back], target: [0.3, 0.4, 0.3] },
        minDistance: 2,
        maxDistance: 30,
        onFrame: () => {
          update3D();
          place3DLabels();
        },
      });
      build3D(three);
    } catch (err) {
      console.error(err);
      threeFailed = true;
      container.innerHTML = '<p class="mx-no3d">3D graphics are not available in this browser. The other views still work.</p>';
    } finally {
      loading3D = false;
      sim.setLoading(null);
      three?.setAnimating(st.view === 't3d');
      sim.requestRender();
    }
  }
  function build3D(view: ThreeScene) {
    const { THREE, scene, camera } = view;
    const std = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
    // axes
    const axes: [string, [number, number, number], string][] = [
      ['x', [1, 0, 0], C_I],
      ['y', [0, 1, 0], C_J],
      ['z', [0, 0, 1], C_A],
    ];
    for (const [, d, col] of axes) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...d).multiplyScalar(-2.5), new THREE.Vector3(...d).multiplyScalar(2.5)]);
      scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6 })));
    }
    const grid = new THREE.GridHelper(6, 12, 0x888888, 0x888888);
    (grid.material as T.Material).transparent = true;
    (grid.material as T.Material).opacity = 0.25;
    scene.add(grid);
    // objects: a unit cube spanned by î, ĵ, k̂, and an asymmetric “F” block
    const cubeParts = (): T.Object3D[] => {
      const faces = ['#4dabf7', '#ff922b', '#69db7c', '#f783ac', '#ffd43b', '#9775fa'];
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), faces.map((c) => std(c)));
      m.position.set(0.5, 0.5, 0.5);
      const corner = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), std('#212529'));
      corner.position.set(1, 0, 0);
      return [m, corner];
    };
    const blockParts = (): T.Object3D[] => {
      const mk = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(c));
        m.position.set(x, y, z);
        return m;
      };
      return [mk(0.35, 1.6, 0.35, 0.175, 0.8, 0.175, '#4dabf7'), mk(1.0, 0.35, 0.35, 0.5, 1.425, 0.175, '#ff922b'), mk(0.7, 0.3, 0.35, 0.35, 0.85, 0.175, '#69db7c')];
    };
    const obj = new THREE.Group();
    obj.matrixAutoUpdate = false;
    const ghost = new THREE.Group();
    scene.add(obj, ghost);
    let built = '';
    const rebuild = () => {
      built = st.obj;
      obj.clear();
      ghost.clear();
      const parts = st.obj === 'cube' ? cubeParts() : blockParts();
      for (const p of parts) {
        obj.add(p);
        if (p instanceof THREE.Mesh) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry), new THREE.LineBasicMaterial({ color: 0x868e96, transparent: true, opacity: 0.8 }));
          e.position.copy(p.position);
          ghost.add(e);
        }
      }
    };
    rebuild();
    // images of the basis vectors (the columns of M)
    const arrows = axes.map(([, , col]) => {
      const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, new THREE.Color(col).getHex(), 0.18, 0.1);
      scene.add(a);
      return a;
    });
    const labelLayer = document.createElement('div');
    labelLayer.className = 'earth-labels';
    labelLayer.setAttribute('aria-hidden', 'true');
    container.appendChild(labelLayer);
    const labels = ['î′', 'ĵ′', 'k̂′', 'x', 'y', 'z'].map((s) => {
      const el = document.createElement('span');
      el.textContent = s;
      labelLayer.appendChild(el);
      return el;
    });
    const tmp = new THREE.Vector3();
    update3D = () => {
      if (built !== st.obj) rebuild();
      const M = m3();
      obj.matrix.set(M[0][0], M[0][1], M[0][2], 0, M[1][0], M[1][1], M[1][2], 0, M[2][0], M[2][1], M[2][2], 0, 0, 0, 0, 1);
      obj.matrixWorldNeedsUpdate = true;
      ghost.visible = st.ghost;
      arrows.forEach((a, k) => {
        const col = new THREE.Vector3(M[0][k], M[1][k], M[2][k]);
        const L = col.length();
        a.visible = L > 1e-6;
        if (L > 1e-6) {
          a.setDirection(col.clone().normalize());
          a.setLength(L, Math.min(0.18, L * 0.4), Math.min(0.1, L * 0.25));
        }
      });
      view.requestRender();
    };
    place3DLabels = () => {
      const M = m3();
      const pts = [0, 1, 2].map((k) => new THREE.Vector3(M[0][k], M[1][k], M[2][k]).multiplyScalar(1.12));
      pts.push(new THREE.Vector3(2.6, 0, 0), new THREE.Vector3(0, 2.6, 0), new THREE.Vector3(0, 0, 2.6));
      pts.forEach((p, k) => {
        tmp.copy(p).project(camera);
        labels[k].style.display = tmp.z < 1 ? '' : 'none';
        labels[k].style.transform = `translate(${((tmp.x + 1) / 2) * container.clientWidth}px, ${((1 - tmp.y) / 2) * container.clientHeight}px) translate(-50%, -50%)`;
      });
    };
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    handles.length = 0;
    if (st.view !== 't3d') {
      const { k, ox, oy } = tf();
      cur = k;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      if (st.view === 'algebra') drawAlgebra();
      else {
        const L = planeLayout();
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(L.plot.x, L.plot.y, L.plot.w, L.plot.h, 10);
        ctx.clip();
        if (st.view === 't2d') drawT2D();
        else if (st.view === 'det') drawDet();
        else drawEigen();
        ctx.restore();
        if (st.view === 't2d') drawT2DSide(L.side);
        else if (st.view === 'det') drawDetSide(L.side);
        else drawEigenSide(L.side);
      }
      ctx.restore();
    }
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
    if (st.view === 'algebra') {
      const { R, err } = result();
      const [m, n] = dims(st.A);
      r('r1', 'Operation', OPS[st.op]);
      r('r2', 'Size of A · B', `${m}×${n} · ${dims(st.B)[0]}×${dims(st.B)[1]}`);
      r('r3', 'Result', err ? 'Not defined' : Array.isArray(R) ? `${dims(R)[0]}×${dims(R)[1]} matrix` : `the number ${frac(R as number)}`, err ? 'bad' : 'ok');
      r('r4', 'Selected entry', Array.isArray(R) && !err ? `row ${st.sel[0] + 1}, column ${st.sel[1] + 1}` : '—');
      r('r5', 'det A', m === n && !st.invalid ? frac(det(st.A)) : 'A is not square');
      r('r6', 'A invertible?', m !== n || st.invalid ? 'No (not square)' : Math.abs(det(st.A)) < 1e-12 ? 'No (det A = 0)' : 'Yes', m === n && Math.abs(det(st.A)) >= 1e-12 ? 'ok' : 'warn');
      note ||= err ? err : 'Edit the entries of A and B (and their sizes), choose an operation, and tap any entry of the result to see how it is worked out. Press Start to step through every entry.';
      sim.setBadge(OPS[st.op]);
    } else if (st.view === 't2d') {
      const { M } = combined(1);
      const d2 = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      const pts = basePts();
      const out = pts.map((p) => apply3(M, p));
      const nm = (tt: typeof st.t1) => (tt.type === 'none' ? 'None' : TDEF[tt.type].name.split(' (')[0]);
      r('r1', 'T₁', nm(st.t1));
      r('r2', 'T₂', nm(st.t2));
      r('r3', 'Order', st.t2.type === 'none' ? 'Single transformation' : st.t1First ? 'T₁ first, then T₂: M = T₂T₁' : 'T₂ first, then T₁: M = T₁T₂');
      r('r4', 'det (area factor)', dec(d2, 4));
      r('r5', 'Area before → after', `${dec(area(pts), 3)} → ${dec(area(out), 3)}`);
      r('r6', 'Orientation', Math.abs(d2) < 1e-9 ? 'Collapsed (det = 0)' : Math.sign(signedArea(out)) === Math.sign(signedArea(pts)) ? 'Preserved' : 'Reversed (mirror image)', d2 < 0 ? 'warn' : null);
      if (!note) {
        if (st.t2.type !== 'none') {
          const other = st.t1First ? mul(homog(st.t1.type, st.t1.p, st.t1.q, st.M2), homog(st.t2.type, st.t2.p, st.t2.q, st.M2)) : mul(homog(st.t2.type, st.t2.p, st.t2.q, st.M2), homog(st.t1.type, st.t1.p, st.t1.q, st.M2));
          const same = other.every((row, i) => row.every((q, j) => Math.abs(q - M[i][j]) < 1e-9));
          note = same ? 'These two transformations happen to commute: swapping the order gives the same matrix here. Try a rotation with a non-uniform scale.' : 'Swapping the order gives a different matrix and a different picture: matrix multiplication is not commutative. Use the order switch to compare.';
        } else note = 'The transformation matrix multiplies each corner as a column vector [x, y, 1]. Rotations, reflections and scalings keep the origin fixed; only translation moves it.';
      }
      sim.setBadge(st.t2.type === 'none' ? TDEF[st.t1.type === 'none' ? 'scale' : st.t1.type].name.split(' (')[0] : 'Combined');
    } else if (st.view === 'det') {
      const [a, b, c, d] = st.M2;
      const dt = a * d - b * c;
      const rank = Math.abs(dt) > 1e-9 ? 2 : [a, b, c, d].some((q) => Math.abs(q) > 1e-9) ? 1 : 0;
      r('r1', 'Matrix', `[${dec(a, 3)} ${dec(b, 3)}; ${dec(c, 3)} ${dec(d, 3)}]`);
      r('r2', 'det = ad − bc', dec(dt, 4));
      r('r3', 'Area 1 →', dec(Math.abs(dt), 4));
      r('r4', 'Orientation', Math.abs(dt) < 1e-9 ? 'Collapsed' : dt > 0 ? 'Preserved' : 'Reversed', Math.abs(dt) < 1e-9 ? 'bad' : dt < 0 ? 'warn' : 'ok');
      r('r5', 'Image of the plane', rank === 2 ? 'The whole plane (rank 2)' : rank === 1 ? 'A line (rank 1)' : 'A point (rank 0)');
      r('r6', 'Invertible?', Math.abs(dt) > 1e-9 ? 'Yes' : 'No', Math.abs(dt) > 1e-9 ? 'ok' : 'bad');
      note ||= 'Drag the arrow tips or use the sliders. The determinant is the factor by which the transformation scales area; its sign tells you whether it flips the plane over.';
      sim.setBadge(`det = ${dec(dt, 3)}`);
    } else if (st.view === 'eigen') {
      const [a, b, c, d] = st.M2;
      const E = eigen2(a, b, c, d);
      const v = st.v;
      const Av: V2 = [a * v[0] + b * v[1], c * v[0] + d * v[1]];
      const cross = v[0] * Av[1] - v[1] * Av[0];
      const par = Math.hypot(...Av) < 1e-9 || Math.abs(cross) < 0.02 * Math.hypot(...v) * Math.hypot(...Av);
      r('r1', 'Trace (a + d)', dec(a + d, 4));
      r('r2', 'Determinant', dec(a * d - b * c, 4));
      r('r3', 'Eigenvalues', E.kind === 'distinct' ? `${dec(E.l[0], 4)}, ${dec(E.l[1], 4)}` : E.kind === 'complex' ? `${dec(E.re, 3)} ± ${dec(E.im, 3)}i (complex)` : `${dec(E.l, 4)} (repeated)`, E.kind === 'complex' ? 'warn' : null);
      r('r4', 'Real eigen-directions', E.kind === 'distinct' ? '2' : E.kind === 'defective' ? '1 (defective)' : E.kind === 'scalar' ? 'Every direction' : 'None');
      r('r5', 'Test vector v', `(${dec(v[0], 3)}, ${dec(v[1], 3)})`);
      r('r6', 'Is Av = λv?', par ? `Yes: λ ≈ ${dec(Math.hypot(...v) > 0 ? (Av[0] * v[0] + Av[1] * v[1]) / (v[0] ** 2 + v[1] ** 2) : 0, 3)}` : 'No: v changed direction', par ? 'ok' : null);
      note ||= eigenText().slice(1).join(' ');
      sim.setBadge(E.kind === 'complex' ? 'No real eigenvectors' : 'Eigenvectors');
    } else {
      const M = m3(1);
      const dt = det(M);
      r('r1', 'Scale (sₓ, s_y, s_z)', `(${dec(st.sx, 3)}, ${dec(st.sy, 3)}, ${dec(st.sz, 3)})`);
      r('r2', 'Rotation', `${st.ang}° about the ${st.axis}-axis`);
      r('r3', 'Reflection', st.refl === 'none' ? 'None' : `In the ${st.refl}-plane`);
      r('r4', 'det M (volume factor)', dec(dt, 4));
      r('r5', 'Orientation', Math.abs(dt) < 1e-9 ? 'Collapsed (det = 0)' : dt > 0 ? 'Preserved' : 'Reversed (mirror image)', dt < 0 ? 'warn' : Math.abs(dt) < 1e-9 ? 'bad' : null);
      r('r6', 'Matrix M = F·R·S', M.map((row) => row.map((q) => dec(q, 2)).join(' ')).join(' | '));
      note ||= threeFailed ? '3D graphics are not available here.' : 'M = F·R·S: scale first, then rotate, then reflect. Dragging the view only moves the camera; the sliders change the matrix that moves the object. The coloured arrows are the columns of M: where î, ĵ and k̂ end up.';
      sim.setBadge(`det = ${dec(dt, 3)}`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= Step ======================= */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === 'algebra') {
      selTimer += dt;
      if (selTimer > 1.4) {
        selTimer = 0;
        const { R } = result();
        if (Array.isArray(R)) {
          const [m, n] = dims(R);
          let [i, j] = st.sel;
          j++;
          if (j >= n) {
            j = 0;
            i = (i + 1) % m;
          }
          st.sel = [i, j];
        } else sim.pause();
      }
      return;
    }
    prog = Math.min(1, prog + dt / (st.view === 't2d' && st.t2.type !== 'none' ? 4 : 2.5));
    if (prog >= 1) sim.pause();
  }

  /* ======================= Interaction ======================= */
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return toBox(e.clientX - r.left, e.clientY - r.top);
  };
  let drag: null | { id: string; dx: number; dy: number } = null;
  function hit(bx: number, by: number): string | null {
    let best: string | null = null;
    let bd = 24 / cur;
    for (const h of handles) {
      const d = Math.hypot(h.x - bx, h.y - by);
      if (d < bd) {
        bd = d;
        best = h.id;
      }
    }
    if (best) return best;
    if (st.view === 't2d') {
      const L = planeLayout().plot;
      if (bx >= L.x && bx <= L.x + L.w && by >= L.y && by <= L.y + L.h && inPoly([WX(bx), WY(by)], basePts())) return 'shape';
    }
    return null;
  }
  const snap = (q: number, s = 0.1) => Math.round(q / s) * s;
  canvas.addEventListener('pointerdown', (e) => {
    const [bx, by] = local(e);
    if (st.view === 'algebra') {
      const c = resultCells.find((q) => bx >= q.x && bx <= q.x + q.w && by >= q.y && by <= q.y + q.h);
      if (c) {
        st.sel = [c.i, c.j];
        lastMsg = '';
        sim.requestRender();
      }
      return;
    }
    const id = hit(bx, by);
    if (!id) return;
    prog = 1;
    if (sim.running) sim.pause();
    drag = { id, dx: WX(bx) - st.off[0], dy: WY(by) - st.off[1] };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const [bx, by] = local(e);
    if (!drag) {
      if (e.pointerType === 'mouse') canvas.style.cursor = st.view === 'algebra' ? (resultCells.some((q) => bx >= q.x && bx <= q.x + q.w && by >= q.y && by <= q.y + q.h) ? 'pointer' : '') : hit(bx, by) ? 'grab' : '';
      return;
    }
    const x = WX(bx);
    const y = WY(by);
    lastMsg = '';
    if (drag.id === 'shape') st.off = [clamp(snap(x - drag.dx, 0.5), -6, 6), clamp(snap(y - drag.dy, 0.5), -6, 6)];
    else if (drag.id.startsWith('v') && drag.id.length === 2 && st.view === 't2d') {
      const k = +drag.id[1];
      st.customPts[k] = [clamp(snap(x - st.off[0], 0.25), -6, 6), clamp(snap(y - st.off[1], 0.25), -6, 6)];
    } else if (drag.id === 'i') setM2([snap(x), st.M2[1], snap(y), st.M2[3]]);
    else if (drag.id === 'j') setM2([st.M2[0], snap(x), st.M2[2], snap(y)]);
    else if (drag.id === 'v') st.v = [clamp(snap(x), -3.5, 3.5), clamp(snap(y), -3.5, 3.5)];
    sim.requestRender();
  });
  const end = () => {
    drag = null;
    canvas.style.cursor = '';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const [bx, by] = local(e.touches[0]);
    if (st.view !== 'algebra' && st.view !== 't3d' && hit(bx, by)) e.preventDefault();
  }, { passive: false });

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.dataset.mxView = st.view === 't3d' ? '3d' : '2d';
    root.querySelectorAll<HTMLElement>('[data-views]').forEach((el) => (el.hidden = !el.dataset.views!.split(' ').includes(st.view)));
    const needM2 = st.view === 'det' || st.view === 'eigen' || (st.view === 't2d' && (st.t1.type === 'custom' || st.t2.type === 'custom'));
    root.querySelectorAll<HTMLElement>('[data-m2]').forEach((el) => (el.hidden = !needM2));
    root.querySelectorAll<HTMLElement>('[data-m2-presets]').forEach((el) => (el.hidden = !(el.dataset.m2Presets === st.view)));
    if (st.view === 't3d') {
      void ensure3D();
      three?.setAnimating(true);
    } else three?.setAnimating(false);
  }
  const viewCtl = ui.choice<View>('mx-view', (q) => {
    st.view = q;
    prog = 1;
    lastMsg = '';
    sim.pause();
    sim.hideTooltip();
    showView();
    sim.requestRender();
  });
  void viewCtl;

  // ---- matrix editors ----
  const gridEl = { A: root.querySelector<HTMLElement>('[data-grid="A"]')!, B: root.querySelector<HTMLElement>('[data-grid="B"]')! };
  const rowsSel = { A: root.querySelector<HTMLSelectElement>('[data-rows="A"]')!, B: root.querySelector<HTMLSelectElement>('[data-rows="B"]')! };
  const colsSel = { A: root.querySelector<HTMLSelectElement>('[data-cols="A"]')!, B: root.querySelector<HTMLSelectElement>('[data-cols="B"]')! };
  function buildGrid(which: 'A' | 'B') {
    const M = st[which];
    const el = gridEl[which];
    el.innerHTML = '';
    el.style.gridTemplateColumns = `repeat(${dims(M)[1]}, minmax(0, 1fr))`;
    M.forEach((row, i) =>
      row.forEach((v, j) => {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.inputMode = 'decimal';
        inp.className = 'input mono';
        inp.value = String(v);
        inp.setAttribute('aria-label', `${which} row ${i + 1} column ${j + 1}`);
        inp.addEventListener('input', () => {
          const txt = inp.value.trim().replace('−', '-');
          const num = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(txt) ? parseFloat(txt) : NaN;
          if (Number.isFinite(num) && Math.abs(num) <= 1e6) {
            inp.removeAttribute('aria-invalid');
            st[which][i][j] = num;
          } else inp.setAttribute('aria-invalid', 'true');
          validate();
          sim.requestRender();
        });
        el.appendChild(inp);
      }),
    );
  }
  function validate() {
    const bad = root.querySelector<HTMLInputElement>('[data-grid] input[aria-invalid="true"]');
    st.invalid = bad ? `${bad.getAttribute('aria-label')} is not a number. Enter a value such as 3, −1.5 or 0.25.` : '';
    errEl.textContent = st.invalid;
  }
  function resize(which: 'A' | 'B') {
    const r = +rowsSel[which].value;
    const c = +colsSel[which].value;
    const old = st[which];
    st[which] = Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => old[i]?.[j] ?? (i === j ? 1 : 0)));
    buildGrid(which);
    validate();
    st.sel = [0, 0];
    lastMsg = '';
    sim.requestRender();
  }
  for (const w of ['A', 'B'] as const) {
    rowsSel[w].addEventListener('change', () => resize(w));
    colsSel[w].addEventListener('change', () => resize(w));
  }
  const opSel = root.querySelector<HTMLSelectElement>('[data-op]')!;
  opSel.addEventListener('change', () => {
    st.op = opSel.value as Op;
    st.sel = [0, 0];
    lastMsg = '';
    showView();
    sim.requestRender();
  });
  const kCtl = ui.range('mx-k', (q) => frac(q), (q) => ((st.k = q), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-rand]').forEach((b) =>
    b.addEventListener('click', () => {
      const w = b.dataset.rand as 'A' | 'B';
      st[w] = st[w].map((row) => row.map(() => Math.floor(Math.random() * 11) - 5));
      buildGrid(w);
      validate();
      lastMsg = '';
      sim.requestRender();
    }),
  );
  root.querySelector('[data-swap]')?.addEventListener('click', () => {
    [st.A, st.B] = [st.B, st.A];
    for (const w of ['A', 'B'] as const) {
      rowsSel[w].value = String(dims(st[w])[0]);
      colsSel[w].value = String(dims(st[w])[1]);
      buildGrid(w);
    }
    validate();
    st.sel = [0, 0];
    lastMsg = st.op === 'mul' ? 'A and B swapped. Compare AB with BA: they are usually different, and one may not even be defined.' : '';
    sim.requestRender();
  });

  // ---- 2D transformation controls ----
  const shapeSel = root.querySelector<HTMLSelectElement>('[data-shape]')!;
  shapeSel.addEventListener('change', () => {
    st.shape = shapeSel.value;
    lastMsg = st.shape === 'custom' ? 'Drag the corners of your polygon to reshape it, or drag inside it to move it.' : '';
    sim.requestRender();
  });
  const tSel = { 1: root.querySelector<HTMLSelectElement>('[data-t="1"]')!, 2: root.querySelector<HTMLSelectElement>('[data-t="2"]')! };
  const pCtl = { 1: ui.range('mx-p1', (q) => dec(q, 3), (q) => ((st.t1.p = q), (prog = 1), sim.requestRender())), 2: ui.range('mx-p2', (q) => dec(q, 3), (q) => ((st.t2.p = q), (prog = 1), sim.requestRender())) };
  const qCtl = { 1: ui.range('mx-q1', (q) => dec(q, 3), (q) => ((st.t1.q = q), (prog = 1), sim.requestRender())), 2: ui.range('mx-q2', (q) => dec(q, 3), (q) => ((st.t2.q = q), (prog = 1), sim.requestRender())) };
  /** Set up the two parameter sliders of a transformation for its type. */
  function configure(n: 1 | 2, reset = true) {
    const tt = n === 1 ? st.t1 : st.t2;
    const def = tt.type === 'none' ? {} : TDEF[tt.type];
    for (const [key, ctl, spec] of [
      ['p', pCtl[n], (def as { p?: [string, number, number, number, number] }).p],
      ['q', qCtl[n], (def as { q?: [string, number, number, number, number] }).q],
    ] as const) {
      const wrapEl = root.querySelector<HTMLElement>(`[data-tparam="${key}${n}"]`)!;
      wrapEl.hidden = !spec;
      if (!spec) continue;
      const input = wrapEl.querySelector<HTMLInputElement>('input[type="range"]')!;
      const label = wrapEl.querySelector('label')!;
      label.textContent = spec[0];
      input.min = String(spec[1]);
      input.max = String(spec[2]);
      input.step = String(spec[3]);
      if (reset) {
        tt[key] = spec[4];
        ctl.set(spec[4], false);
      } else ctl.set(tt[key], false);
    }
    showView();
  }
  for (const n of [1, 2] as const)
    tSel[n].addEventListener('change', () => {
      (n === 1 ? st.t1 : st.t2).type = tSel[n].value as TType;
      configure(n);
      prog = 1;
      lastMsg = '';
      sim.requestRender();
    });
  const orderCtl = ui.choice<'t1' | 't2'>('mx-order', (q) => ((st.t1First = q === 't1'), (prog = 1), (lastMsg = ''), sim.requestRender()));
  const tgridCtl = ui.toggle('mx-tgrid', (q) => ((st.tgrid = q), sim.requestRender()));
  root.querySelector('[data-order-demo]')?.addEventListener('click', () => {
    tSel[1].value = 'rotate';
    st.t1.type = 'rotate';
    configure(1);
    pCtl[1].set(90);
    tSel[2].value = 'scale';
    st.t2.type = 'scale';
    configure(2);
    pCtl[2].set(2);
    qCtl[2].set(1);
    shapeSel.value = 'rect';
    st.shape = 'rect';
    lastMsg = 'Rotate 90° then stretch sideways, versus stretch then rotate: switch the order and watch the result change shape.';
    prog = 0;
    sim.play();
  });

  // ---- shared 2 × 2 matrix ----
  const mCtl = (['a', 'b', 'c', 'd'] as const).map((n, k) => ui.range(`mx-${n}`, (q) => dec(q, 3), (q) => ((st.M2[k] = q), (prog = 1), (lastMsg = ''), sim.requestRender())));
  function setM2(v: number[]) {
    st.M2 = v.map((q) => clamp(+q.toFixed(4), -3, 3));
    st.M2.forEach((q, k) => mCtl[k].set(q, false));
    lastMsg = '';
  }
  const PRESET2: Record<string, number[]> = {
    rotate: [Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2],
    shear: [1, 1, 0, 1],
    reflect: [-1, 0, 0, 1],
    collapse: [1, 2, 0.5, 1],
    scale: [2, 0, 0, 1.5],
    stretch: [2, 0, 0, 0.5],
    symmetric: [2, 1, 1, 2],
    rotation: [0, -1, 1, 0],
    swap: [0, 1, 1, 0],
    uniform: [2, 0, 0, 2],
    zero: [1, 1.5, 2, 3],
  };
  root.querySelectorAll<HTMLButtonElement>('[data-m2preset]').forEach((b) =>
    b.addEventListener('click', () => {
      setM2(PRESET2[b.dataset.m2preset!]);
      prog = 0;
      sim.play();
    }),
  );

  // ---- 3D controls ----
  const objSel = root.querySelector<HTMLSelectElement>('[data-obj]')!;
  objSel.addEventListener('change', () => ((st.obj = objSel.value), sim.requestRender()));
  const sxCtl = ui.range('mx-sx', (q) => dec(q, 3), (q) => ((st.sx = q), (prog = 1), sim.requestRender()));
  const syCtl = ui.range('mx-sy', (q) => dec(q, 3), (q) => ((st.sy = q), (prog = 1), sim.requestRender()));
  const szCtl = ui.range('mx-sz', (q) => dec(q, 3), (q) => ((st.sz = q), (prog = 1), sim.requestRender()));
  const axisCtl = ui.choice<'x' | 'y' | 'z'>('mx-axis', (q) => ((st.axis = q), (prog = 1), sim.requestRender()));
  const angCtl = ui.range('mx-ang', (q) => `${q}°`, (q) => ((st.ang = q), (prog = 1), sim.requestRender()));
  const reflSel = root.querySelector<HTMLSelectElement>('[data-refl]')!;
  reflSel.addEventListener('change', () => ((st.refl = reflSel.value as typeof st.refl), (prog = 1), sim.requestRender()));
  const ghostCtl = ui.toggle('mx-ghost', (q) => ((st.ghost = q), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      st.zoom = b.dataset.zoom === 'in' ? Math.max(0.4, st.zoom / 1.25) : b.dataset.zoom === 'out' ? Math.min(3, st.zoom * 1.25) : 1;
      sim.requestRender();
    }),
  );

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(on: boolean) {
      if (on && st.view !== 'algebra' && prog >= 1) prog = 0;
    },
    reset() {
      prog = 1;
      st.A = [
        [1, 2],
        [3, 4],
      ];
      st.B = [
        [5, 6],
        [7, 8],
      ];
      for (const w of ['A', 'B'] as const) {
        rowsSel[w].value = '2';
        colsSel[w].value = '2';
        buildGrid(w);
      }
      validate();
      st.op = 'mul';
      opSel.value = 'mul';
      st.k = 2;
      kCtl.set(2, false);
      st.sel = [0, 1];
      st.shape = 'square';
      shapeSel.value = 'square';
      st.off = [1, 1];
      st.customPts = SHAPES.custom.map((p) => [...p] as V2);
      st.t1 = { type: 'rotate', p: 45, q: 0 };
      st.t2 = { type: 'none', p: 1, q: 1 };
      tSel[1].value = 'rotate';
      tSel[2].value = 'none';
      configure(1);
      configure(2);
      st.t1First = true;
      orderCtl.set('t1', false);
      st.tgrid = false;
      tgridCtl.set(false, false);
      setM2([2, 1, 0, 1.5]);
      st.zoom = 1;
      st.v = [1.5, 0.5];
      Object.assign(st, { obj: 'block', sx: 1, sy: 1, sz: 1, axis: 'y', ang: 30, refl: 'none', ghost: true });
      objSel.value = 'block';
      sxCtl.set(1, false);
      syCtl.set(1, false);
      szCtl.set(1, false);
      axisCtl.set('y', false);
      angCtl.set(30, false);
      reflSel.value = 'none';
      ghostCtl.set(true, false);
      lastMsg = '';
      showView();
    },
  });

  buildGrid('A');
  buildGrid('B');
  configure(1);
  configure(2);
  showView();
  sim.requestRender();
}
