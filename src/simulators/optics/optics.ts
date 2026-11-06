/**
 * Geometric optics, in three views:
 *
 *   lab   – a laser, plane mirrors and a glass block or prism that can be
 *           dragged and rotated. The beam is traced exactly:
 *             mirrors:  r = d − 2 (d·n) n      (angle of incidence = angle of reflection)
 *             glass:    Snell's law n₁ sin θ₁ = n₂ sin θ₂, with Fresnel partial
 *                       reflection, and total internal reflection when
 *                       (n₁/n₂) sin θ₁ > 1
 *   snell – one flat boundary between two media, with live angles, the critical
 *           angle and the reflected and transmitted fractions (Fresnel
 *           equations for unpolarised light)
 *   lens  – a thin lens in the paraxial model. Each ray leaving the object
 *           tip with slope u reaches the lens at height y and leaves with
 *           slope u′ = u − y/f. The image follows 1/f = 1/d_o + 1/d_i
 *           (real-is-positive) and m = −d_i/d_o.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'lab' | 'snell' | 'lens';
type Pt = [number, number];
type LabId = 'laser' | 'm1' | 'm2' | 'glass';
const LASER = '#ff2d2d';
const DEG = Math.PI / 180;
const S = 6; // lens view: px per cm
const AXIS = 340;
const DEF = {
  view: 'lab' as View,
  // lab
  laser: { x: 90, y: 470, a: -15 },
  m1: { x: 470, y: 368, a: 122 },
  m2: { x: 420, y: 110, a: 148 },
  glass: { x: 780, y: 380, a: 0 },
  shape: 'block' as 'none' | 'block' | 'prism',
  nGlass: 1.5,
  two: true,
  normals: true,
  partial: true,
  labSel: 'm1' as LabId,
  // snell
  th1: 40,
  n1: 1.0,
  n2: 1.5,
  // lens
  kind: 'convex' as 'convex' | 'concave',
  f: 15,
  dO: 35,
  hO: 8,
  lensX: 560,
  beam: false,
};

interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}
const fmt = (v: number, d = 1) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`;
};
const deg = (r: number) => r / DEG;
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const norm = (a: Pt): Pt => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};

/** Fresnel reflectance for unpolarised light. */
function fresnel(n1: number, n2: number, cosI: number, cosT: number) {
  const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT);
  const rp = (n2 * cosI - n1 * cosT) / (n2 * cosI + n1 * cosT);
  return (rs * rs + rp * rp) / 2;
}

export function initOptics(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const p = structuredClone(DEF);
  let t = 0;

  function step(dt: number) {
    t += Math.min(dt, 0.05);
  }

  /* ---------- Layout: a 1000 × 600 world, scaled into the box ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 700] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const world = () => (portrait() ? { x: 0, y: 44, s: 0.68 } : { x: 0, y: 0, s: 1 });
  let K = 1;
  let cur = 1;
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  let areas: Area[] = [];
  let frame = { x: 0, y: 0, s: 1 };
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({ test: (px, py) => {
      const lx = (px - f.x) / f.s;
      const ly = (py - f.y) / f.s;
      return lx >= x && lx <= x + w && ly >= y && ly <= y + h;
    }, title, text });
  }
  function circ(x: number, y: number, r: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({ test: (px, py) => Math.hypot((px - f.x) / f.s - x, (py - f.y) / f.s - y) <= r, title, text });
  }
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function labelBox(s: string, x: number, y: number, color: string, px = 12) {
    ctx.font = fs(px, 750);
    const w = ctx.measureText(s).width;
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.88);
    ctx.fillRect(x - w / 2 - 4, y - px / cur + 1, w + 8, (px + 6) / cur);
    text(s, x, y + 2 / cur, px, color, 'center', 750);
  }
  function panel(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.92);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }
  /** Animated beam: a solid glow plus moving dashes. */
  function beam(a: Pt, b: Pt, I: number, dashed = false) {
    if (I < 0.01) return;
    ctx.lineCap = 'round';
    ctx.strokeStyle = withAlpha(LASER, 0.18 * I);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(LASER, Math.min(1, 0.25 + 0.75 * I));
    ctx.lineWidth = 2.6;
    ctx.setLineDash(dashed ? [6, 6] : [18, 8]);
    ctx.lineDashOffset = dashed ? 0 : -t * 60;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
  function normalLine(at: Pt, n: Pt, len = 50) {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = withAlpha(pal['sim-text'], 0.7);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(at[0] - n[0] * len, at[1] - n[1] * len);
    ctx.lineTo(at[0] + n[0] * len, at[1] + n[1] * len);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  /** Arc between two directions (unit vectors in screen space) at a point. */
  function angleArc(at: Pt, u: Pt, v: Pt, r: number, color: string, label: string) {
    const a1 = Math.atan2(u[1], u[0]);
    let a2 = Math.atan2(v[1], v[0]);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    a2 = a1 + da;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(at[0], at[1], r, a1, a2, da < 0);
    ctx.stroke();
    const am = a1 + da / 2;
    labelBox(label, at[0] + Math.cos(am) * (r + 22), at[1] + Math.sin(am) * (r + 22) + 4, color, 11.5);
  }

  /* ======================= Ray lab ======================= */
  const M_LEN = 170;
  const rot = (a: number): Pt => [Math.cos(a * DEG), Math.sin(a * DEG)];
  function mirrorSeg(m: { x: number; y: number; a: number }): [Pt, Pt] {
    const d = rot(m.a);
    return [
      [m.x - (d[0] * M_LEN) / 2, m.y - (d[1] * M_LEN) / 2],
      [m.x + (d[0] * M_LEN) / 2, m.y + (d[1] * M_LEN) / 2],
    ];
  }
  function glassPoly(): Pt[] {
    const g = p.glass;
    let local: Pt[] = [];
    if (p.shape === 'block') local = [[-100, -60], [100, -60], [100, 60], [-100, 60]];
    else if (p.shape === 'prism') {
      const s = 190;
      const h = (s * Math.sqrt(3)) / 2;
      local = [[0, (-2 * h) / 3], [s / 2, h / 3], [-s / 2, h / 3]];
    }
    const c = Math.cos(g.a * DEG);
    const s = Math.sin(g.a * DEG);
    return local.map(([x, y]) => [g.x + x * c - y * s, g.y + x * s + y * c] as Pt);
  }
  const inPoly = (pts: Pt[], x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  function hitSeg(o: Pt, d: Pt, a: Pt, b: Pt) {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) return null;
    const tt = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
    const s = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (tt < 1e-6 || s < 0 || s > 1) return null;
    return { t: tt, n: norm([-ey, ex]) as Pt };
  }
  interface Hit {
    at: Pt;
    n: Pt; // normal facing the incoming ray
    kind: 'mirror' | 'glass';
    cosI: number;
  }
  interface LabResult {
    segs: { a: Pt; b: Pt; I: number }[];
    hits: { at: Pt; n: Pt; I: number }[];
    first: null | { kind: 'mirror' | 'glass'; thI: number; thO: number; tir: boolean; at: Pt; n: Pt; din: Pt; dout: Pt; n1: number; n2: number };
    mirrorHits: number;
    tirCount: number;
  }
  function traceLab(): LabResult {
    const res: LabResult = { segs: [], hits: [], first: null, mirrorHits: 0, tirCount: 0 };
    const mirrors = [mirrorSeg(p.m1), ...(p.two ? [mirrorSeg(p.m2)] : [])];
    const poly = glassPoly();
    const L = p.laser;
    const ld = rot(L.a);
    const start: Pt = [L.x + ld[0] * 32, L.y + ld[1] * 32];
    const queue: { o: Pt; d: Pt; I: number; inside: boolean; depth: number; main: boolean }[] = [
      { o: start, d: ld, I: 1, inside: poly.length > 0 && inPoly(poly, start[0], start[1]), depth: 0, main: true },
    ];
    let count = 0;
    while (queue.length && count < 80) {
      count++;
      const r = queue.shift()!;
      let best: (Hit & { t: number }) | null = null;
      for (const [a, b] of mirrors) {
        const h = hitSeg(r.o, r.d, a, b);
        if (h && (!best || h.t < best.t)) {
          const n: Pt = dot(h.n, r.d) > 0 ? [-h.n[0], -h.n[1]] : h.n;
          best = { t: h.t, at: [r.o[0] + r.d[0] * h.t, r.o[1] + r.d[1] * h.t], n, kind: 'mirror', cosI: -dot(n, r.d) };
        }
      }
      for (let i = 0; i < poly.length; i++) {
        const h = hitSeg(r.o, r.d, poly[i], poly[(i + 1) % poly.length]);
        if (h && (!best || h.t < best.t)) {
          const n: Pt = dot(h.n, r.d) > 0 ? [-h.n[0], -h.n[1]] : h.n;
          best = { t: h.t, at: [r.o[0] + r.d[0] * h.t, r.o[1] + r.d[1] * h.t], n, kind: 'glass', cosI: -dot(n, r.d) };
        }
      }
      if (!best) {
        res.segs.push({ a: r.o, b: [r.o[0] + r.d[0] * 2500, r.o[1] + r.d[1] * 2500], I: r.I });
        continue;
      }
      res.segs.push({ a: r.o, b: best.at, I: r.I });
      if (r.I > 0.2) res.hits.push({ at: best.at, n: best.n, I: r.I });
      if (r.depth >= 14) continue;
      const refl: Pt = [r.d[0] + 2 * best.cosI * best.n[0], r.d[1] + 2 * best.cosI * best.n[1]];
      const thI = Math.acos(clamp(best.cosI, -1, 1));
      if (best.kind === 'mirror') {
        if (r.main) res.mirrorHits++;
        if (r.main && !res.first) res.first = { kind: 'mirror', thI: deg(thI), thO: deg(thI), tir: false, at: best.at, n: best.n, din: r.d, dout: refl, n1: 1, n2: 1 };
        queue.push({ o: best.at, d: refl, I: r.I, inside: r.inside, depth: r.depth + 1, main: r.main });
      } else {
        const na = r.inside ? p.nGlass : 1;
        const nb = r.inside ? 1 : p.nGlass;
        const eta = na / nb;
        const k = 1 - eta * eta * (1 - best.cosI * best.cosI);
        if (k < 0) {
          if (r.main) res.tirCount++;
          if (r.main && !res.first) res.first = { kind: 'glass', thI: deg(thI), thO: deg(thI), tir: true, at: best.at, n: best.n, din: r.d, dout: refl, n1: na, n2: nb };
          queue.push({ o: best.at, d: refl, I: r.I, inside: r.inside, depth: r.depth + 1, main: r.main });
        } else {
          const cosT = Math.sqrt(k);
          const tr: Pt = norm([eta * r.d[0] + (eta * best.cosI - cosT) * best.n[0], eta * r.d[1] + (eta * best.cosI - cosT) * best.n[1]]);
          const R = fresnel(na, nb, best.cosI, cosT);
          if (r.main && !res.first) res.first = { kind: 'glass', thI: deg(thI), thO: deg(Math.acos(cosT)), tir: false, at: best.at, n: best.n, din: r.d, dout: tr, n1: na, n2: nb };
          queue.push({ o: best.at, d: tr, I: r.I * (1 - R), inside: !r.inside, depth: r.depth + 1, main: r.main });
          if (p.partial && r.I * R > 0.015) queue.push({ o: best.at, d: refl, I: r.I * R, inside: r.inside, depth: r.depth + 1, main: false });
        }
      }
    }
    return res;
  }
  let lastLab: LabResult | null = null;
  function handleOf(id: LabId): Pt {
    if (id === 'laser') {
      const d = rot(p.laser.a);
      return [p.laser.x - d[0] * 56, p.laser.y - d[1] * 56];
    }
    if (id === 'glass') {
      const poly = glassPoly();
      const v = poly[1] ?? [p.glass.x, p.glass.y];
      const dx = v[0] - p.glass.x;
      const dy = v[1] - p.glass.y;
      const l = Math.hypot(dx, dy) || 1;
      return [v[0] + (dx / l) * 22, v[1] + (dy / l) * 22];
    }
    const m = id === 'm1' ? p.m1 : p.m2;
    const [, b] = mirrorSeg(m);
    const d = rot(m.a);
    return [b[0] + d[0] * 18, b[1] + d[1] * 18];
  }
  function drawLab() {
    // grid
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.1);
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1000; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y <= 600; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1000, y);
      ctx.stroke();
    }
    // glass
    const poly = glassPoly();
    if (poly.length) {
      ctx.fillStyle = withAlpha('#7fd3e6', 0.12 + 0.18 * (p.nGlass - 1));
      ctx.strokeStyle = withAlpha('#7fd3e6', 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      text(`n = ${p.nGlass.toFixed(2)}`, p.glass.x, p.glass.y + 5, 12, pal['sim-text'], 'center', 750);
    }
    // mirrors
    const mirrors: [LabId, { x: number; y: number; a: number }][] = [['m1', p.m1], ...(p.two ? [['m2', p.m2] as [LabId, { x: number; y: number; a: number }]] : [])];
    for (const [id, m] of mirrors) {
      const [a, b] = mirrorSeg(m);
      ctx.strokeStyle = '#c9d6e3';
      ctx.lineWidth = 7;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.strokeStyle = id === p.labSel ? pal.accent : '#5c6f88';
      ctx.lineWidth = id === p.labSel ? 2.5 : 1.5;
      ctx.stroke();
    }
    // rays
    const res = traceLab();
    lastLab = res;
    for (const s of res.segs) beam(s.a, s.b, s.I);
    if (p.normals) for (const h of res.hits) normalLine(h.at, h.n, 46);
    if (res.first && p.normals) {
      const f = res.first;
      const back: Pt = [-f.din[0], -f.din[1]];
      angleArc(f.at, f.n, back, 36, pal.warning, `θi ${fmt(f.thI)}°`);
      const ref = f.kind === 'mirror' || f.tir ? f.n : ([-f.n[0], -f.n[1]] as Pt);
      angleArc(f.at, ref, f.dout, 52, f.kind === 'mirror' || f.tir ? pal.accent : pal.success, `${f.kind === 'mirror' || f.tir ? 'θr' : 'θt'} ${fmt(f.thO)}°`);
    }
    // laser
    const L = p.laser;
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate(L.a * DEG);
    ctx.fillStyle = '#3a4250';
    ctx.beginPath();
    ctx.roundRect(-34, -12, 66, 24, 5);
    ctx.fill();
    ctx.fillStyle = LASER;
    ctx.fillRect(28, -5, 6, 10);
    ctx.strokeStyle = p.labSel === 'laser' ? pal.accent : 'transparent';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-36, -14, 70, 28);
    ctx.restore();
    // rotation handles
    for (const id of ['laser', 'm1', ...(p.two ? ['m2'] : []), ...(poly.length ? ['glass'] : [])] as LabId[]) {
      const h = handleOf(id);
      ctx.fillStyle = withAlpha(pal.accent, id === p.labSel ? 0.9 : 0.45);
      ctx.beginPath();
      ctx.arc(h[0], h[1], 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal['sim-bg'];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h[0], h[1], 4.5, -0.4, Math.PI * 1.4);
      ctx.stroke();
    }
    // inspect areas
    if (poly.length) {
      const g = p.glass;
      circ(g.x, g.y, 60, p.shape === 'prism' ? 'Glass prism' : 'Glass block', () => `Refractive index n = ${p.nGlass.toFixed(2)}: light travels ${p.nGlass.toFixed(2)} times slower inside than in air, so it bends at each surface (Snell’s law). Inside, if the angle is steep enough, it can be totally internally reflected. Drag to move, use the blue handle to rotate.`);
    }
    for (const [, m] of mirrors) circ(m.x, m.y, 40, 'Plane mirror', () => `Angle of incidence = angle of reflection, both measured from the normal (dashed). Turning the mirror by an angle δ turns the reflected beam by 2δ. Drag to move it; drag its blue handle to tilt it. Mirror angle: ${fmt(m.a, 0)}°.`);
    circ(L.x, L.y, 34, 'Laser', () => 'A narrow beam of light, drawn as a single ray. Drag it to move it and use the blue handle at its back to aim it.');
    if (res.first) {
      const f = res.first;
      circ(f.at[0], f.at[1], 26, f.kind === 'mirror' ? 'Law of reflection' : f.tir ? 'Total internal reflection' : 'Refraction', () =>
        f.kind === 'mirror'
          ? `θi = ${fmt(f.thI)}° and θr = ${fmt(f.thO)}°: equal, as the law of reflection requires. The incident ray, reflected ray and normal all lie in the same plane.`
          : f.tir
            ? `Going from n = ${f.n1.toFixed(2)} to n = ${f.n2.toFixed(2)} at ${fmt(f.thI)}°, which is more than the critical angle ${fmt(deg(Math.asin(f.n2 / f.n1)))}°: no light can pass through, so all of it is reflected.`
            : `n₁ sin θ₁ = ${f.n1.toFixed(2)} × sin ${fmt(f.thI)}° = ${(f.n1 * Math.sin(f.thI * DEG)).toFixed(3)} = n₂ sin θ₂ = ${f.n2.toFixed(2)} × sin ${fmt(f.thO)}°.`);
    }
  }

  /* ======================= Snell's law ======================= */
  const O: Pt = [500, 300];
  const RL = 250;
  function snell() {
    const th1 = p.th1 * DEG;
    const s2 = (p.n1 / p.n2) * Math.sin(th1);
    const tir = s2 > 1;
    const th2 = tir ? NaN : Math.asin(s2);
    const cosT = tir ? 0 : Math.cos(th2);
    const R = tir ? 1 : fresnel(p.n1, p.n2, Math.cos(th1), cosT);
    const crit = p.n1 > p.n2 ? deg(Math.asin(p.n2 / p.n1)) : NaN;
    return { th1, th2, tir, R, T: 1 - R, crit };
  }
  const mediumColor = (n: number) => withAlpha('#5aa9e6', clamp((n - 1) * 0.35, 0, 0.6));
  const mediumName = (n: number) => (Math.abs(n - 1) < 0.005 ? 'Air' : Math.abs(n - 1.33) < 0.005 ? 'Water' : Math.abs(n - 1.5) < 0.005 ? 'Glass' : Math.abs(n - 2.42) < 0.005 ? 'Diamond' : 'Medium');
  function drawSnell() {
    const s = snell();
    // media
    ctx.fillStyle = mediumColor(p.n1);
    ctx.fillRect(0, 0, 1000, O[1]);
    ctx.fillStyle = mediumColor(p.n2);
    ctx.fillRect(0, O[1], 1000, 600 - O[1]);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, O[1]);
    ctx.lineTo(1000, O[1]);
    ctx.stroke();
    text(`${mediumName(p.n1)}: n₁ = ${p.n1.toFixed(2)}`, 985, O[1] - 14, 14, pal['sim-text'], 'right', 750);
    text(`${mediumName(p.n2)}: n₂ = ${p.n2.toFixed(2)}`, 985, O[1] + 30, 14, pal['sim-text'], 'right', 750);
    // protractor
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(O[0], O[1], RL - 20, 0, Math.PI * 2);
    ctx.stroke();
    for (let a = 0; a < 360; a += 10) {
      const r1 = RL - 20;
      const r2 = a % 30 === 0 ? RL - 34 : RL - 27;
      const ang = a * DEG;
      ctx.beginPath();
      ctx.moveTo(O[0] + Math.cos(ang) * r1, O[1] + Math.sin(ang) * r1);
      ctx.lineTo(O[0] + Math.cos(ang) * r2, O[1] + Math.sin(ang) * r2);
      ctx.stroke();
    }
    // normal
    normalLine(O, [0, 1], RL);
    text('Normal', O[0] + 6, O[1] - RL + 12, 11, pal['text-muted'], 'left', 650);
    // rays
    const src: Pt = [O[0] - Math.sin(s.th1) * RL, O[1] - Math.cos(s.th1) * RL];
    beam(src, O, 1);
    const reflEnd: Pt = [O[0] + Math.sin(s.th1) * RL, O[1] - Math.cos(s.th1) * RL];
    beam(O, reflEnd, s.R);
    if (!s.tir) {
      const trEnd: Pt = [O[0] + Math.sin(s.th2) * RL, O[1] + Math.cos(s.th2) * RL];
      beam(O, trEnd, s.T);
      angleArc(O, [0, 1], norm([trEnd[0] - O[0], trEnd[1] - O[1]]), 70, pal.success, `θ₂ ${fmt(deg(s.th2))}°`);
    }
    angleArc(O, [0, -1], norm([src[0] - O[0], src[1] - O[1]]), 70, pal.warning, `θ₁ ${fmt(p.th1)}°`);
    angleArc(O, [0, -1], norm([reflEnd[0] - O[0], reflEnd[1] - O[1]]), 100, pal.accent, `θ₁′ ${fmt(p.th1)}°`);
    // critical angle marker
    if (!Number.isNaN(s.crit)) {
      const ca = s.crit * DEG;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(O[0], O[1]);
      ctx.lineTo(O[0] - Math.sin(ca) * (RL - 20), O[1] - Math.cos(ca) * (RL - 20));
      ctx.stroke();
      ctx.setLineDash([]);
      text(`θc ${fmt(s.crit)}°`, O[0] - Math.sin(ca) * (RL - 6) - 4, O[1] - Math.cos(ca) * (RL - 6), 11, pal.danger, 'right', 700);
    }
    if (s.tir) labelBox('Total internal reflection', O[0], O[1] + 60, pal.danger, 14);
    // laser body at the source
    ctx.save();
    ctx.translate(src[0], src[1]);
    ctx.rotate(Math.atan2(O[1] - src[1], O[0] - src[0]));
    ctx.fillStyle = '#3a4250';
    ctx.beginPath();
    ctx.roundRect(-40, -11, 46, 22, 5);
    ctx.fill();
    ctx.fillStyle = LASER;
    ctx.fillRect(2, -4, 5, 8);
    ctx.restore();
    snellSrc = src;
    circ(src[0], src[1], 30, 'Laser', () => 'Drag the laser around the circle to change the angle of incidence θ₁, measured from the normal.');
    circ(O[0], O[1], 30, 'Point of incidence', () => `Snell’s law: n₁ sin θ₁ = n₂ sin θ₂. Here ${p.n1.toFixed(2)} × sin ${fmt(p.th1)}° = ${(p.n1 * Math.sin(s.th1)).toFixed(3)}${s.tir ? ', which would need sin θ₂ > 1: impossible, so the light is totally internally reflected.' : ` = ${p.n2.toFixed(2)} × sin ${fmt(deg(s.th2))}°.`}`);
    rect(0, 0, 1000, O[1] - 40, `Medium 1 (n₁ = ${p.n1.toFixed(2)})`, () => `Light travels at c/n = ${(3 / p.n1).toFixed(2)} × 10⁸ m/s here. The refractive index n = c/v compares the speed of light in a vacuum with its speed in the material.`);
    rect(0, O[1] + 40, 1000, 260, `Medium 2 (n₂ = ${p.n2.toFixed(2)})`, () => `Light travels at c/n = ${(3 / p.n2).toFixed(2)} × 10⁸ m/s here. ${p.n2 > p.n1 ? 'It slows down entering this medium, so it bends towards the normal.' : p.n2 < p.n1 ? 'It speeds up entering this medium, so it bends away from the normal.' : 'Same index: no bending.'}`);
  }
  let snellSrc: Pt = [0, 0];

  /* ======================= Lenses ======================= */
  const fSigned = () => (p.kind === 'convex' ? p.f : -p.f);
  function lensImage() {
    const f = fSigned();
    const inv = 1 / f - 1 / p.dO;
    if (Math.abs(inv) < 1e-6) return null;
    const di = 1 / inv;
    const m = -di / p.dO;
    return { di, m, hi: m * p.hO };
  }
  const LX = () => p.lensX;
  const X = (cm: number) => LX() + cm * S;
  const Y = (h: number) => AXIS - h * S;
  function drawLensShape(x: number) {
    const H = 190;
    const bulge = clamp(260 / p.f, 6, 26);
    ctx.fillStyle = withAlpha('#7fd3e6', 0.25);
    ctx.strokeStyle = withAlpha('#7fd3e6', 0.95);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (p.kind === 'convex') {
      ctx.moveTo(x, AXIS - H);
      ctx.quadraticCurveTo(x + bulge * 2, AXIS, x, AXIS + H);
      ctx.quadraticCurveTo(x - bulge * 2, AXIS, x, AXIS - H);
    } else {
      const e = 4 + bulge;
      ctx.moveTo(x - e, AXIS - H);
      ctx.lineTo(x + e, AXIS - H);
      ctx.quadraticCurveTo(x + 2, AXIS, x + e, AXIS + H);
      ctx.lineTo(x - e, AXIS + H);
      ctx.quadraticCurveTo(x - 2, AXIS, x - e, AXIS - H);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  function objectArrow(x: number, h: number, color: string, dashed: boolean, label: string) {
    if (dashed) ctx.setLineDash([6, 5]);
    arrow(ctx, x, AXIS, x, Y(h), color, 4, 13);
    ctx.setLineDash([]);
    text(label, x, h >= 0 ? Y(h) - 12 : Y(h) + 22, 12, color, 'center', 750);
  }
  /** Draw a paraxial ray leaving the object tip with slope u. */
  function lensRay(u: number, color: string, img: ReturnType<typeof lensImage>) {
    const f = fSigned();
    const x0 = -p.dO;
    const y0 = p.hO;
    const yL = y0 + u * p.dO;
    const u2 = u - yL / f;
    const start: Pt = [X(x0), Y(y0)];
    const atLens: Pt = [X(0), Y(yL)];
    const xEnd = (1000 - LX()) / S;
    const end: Pt = [X(xEnd), Y(yL + u2 * xEnd)];
    beam(start, atLens, 1);
    beam(atLens, end, 1);
    // virtual image: trace the outgoing ray backwards
    if (img && img.di < 0) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = withAlpha(color, 0.75);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(atLens[0], atLens[1]);
      ctx.lineTo(X(img.di), Y(yL + u2 * img.di));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  function drawLens() {
    const f = fSigned();
    // optical axis
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, AXIS);
    ctx.lineTo(1000, AXIS);
    ctx.stroke();
    // cm scale
    for (let cm = -90; cm <= 90; cm += 10) {
      const x = X(cm);
      if (x < 0 || x > 1000) continue;
      ctx.beginPath();
      ctx.moveTo(x, AXIS - 4);
      ctx.lineTo(x, AXIS + 4);
      ctx.stroke();
      if (cm % 20 === 0 && cm !== 0) text(`${cm}`, x, AXIS + 18, 10, pal['text-faint']);
    }
    drawLensShape(LX());
    // focal points
    for (const [cm, lab] of [[-p.f, 'F'], [p.f, 'F′'], [-2 * p.f, '2F'], [2 * p.f, '2F′']] as [number, string][]) {
      const x = X(cm);
      if (x < 0 || x > 1000) continue;
      ctx.fillStyle = lab.startsWith('F') ? pal.warning : pal['text-muted'];
      ctx.beginPath();
      ctx.arc(x, AXIS, lab.startsWith('F') ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      text(lab, x, AXIS - 12, 12, ctx.fillStyle as string, 'center', 750);
    }
    const img = lensImage();
    if (p.beam) {
      for (let h = -150; h <= 150; h += 50) {
        const y = h / S;
        const start: Pt = [0, Y(y)];
        const at: Pt = [X(0), Y(y)];
        const u2 = -y / f;
        const xEnd = (1000 - LX()) / S;
        beam(start, at, 1);
        beam(at, [X(xEnd), Y(y + u2 * xEnd)], 1);
        if (f < 0) {
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = withAlpha(LASER, 0.7);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(at[0], at[1]);
          ctx.lineTo(X(f), AXIS);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      labelBox(f > 0 ? 'Parallel rays converge at the focal point F′' : 'Parallel rays spread out as if from the focal point F', 500, 60, pal['sim-text'], 13);
    } else {
      // three principal rays
      lensRay(0, LASER, img);
      lensRay(-p.hO / p.dO, LASER, img);
      if (Math.abs(p.dO - f) > 0.3) lensRay(-p.hO / (p.dO - f), LASER, img);
      objectArrow(X(-p.dO), p.hO, pal.accent, false, 'Object');
      if (img) {
        const xi = X(img.di);
        if (xi > -40 && xi < 1040 && Math.abs(img.hi) < 90) objectArrow(xi, img.hi, img.di > 0 ? pal.success : pal['accent-2'], img.di < 0, img.di > 0 ? 'Real image' : 'Virtual image');
        else labelBox(`Image ${img.di > 0 ? 'beyond the right edge' : 'far to the left'}: dᵢ = ${fmt(img.di)} cm`, 500, 60, pal['text-muted'], 12);
      } else labelBox('Object at the focal point: the rays leave parallel, so no image forms', 500, 60, pal.warning, 12);
    }
    // handles
    ctx.fillStyle = withAlpha(pal.warning, 0.35);
    ctx.beginPath();
    ctx.arc(X(p.f), AXIS, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(pal.accent, 0.3);
    ctx.beginPath();
    ctx.arc(LX(), AXIS - 200, 12, 0, Math.PI * 2);
    ctx.fill();
    text('⇔', LX(), AXIS - 196, 13, pal.accent, 'center', 800);
    // inspect areas
    circ(X(p.f), AXIS, 16, 'Focal point', () => `${p.kind === 'convex' ? 'Rays parallel to the axis converge here after the lens' : 'Rays parallel to the axis leave the lens spreading out as if they came from the focal point on the other side'}. Focal length ${fmt(f)} cm (${p.kind === 'convex' ? 'positive: converging' : 'negative: diverging'}). Drag to change it.`);
    rect(LX() - 20, AXIS - 190, 40, 380, p.kind === 'convex' ? 'Converging (convex) lens' : 'Diverging (concave) lens', () => `A thin lens is thicker in the middle (converging) or at the edges (diverging). In the thin-lens model each ray bends once, at the centre line, and a ray through the centre goes straight on. Drag the ⇔ handle to move the lens.`);
    if (!p.beam) {
      rect(X(-p.dO) - 14, Math.min(AXIS, Y(p.hO)) - 14, 28, Math.abs(p.hO * S) + 28, 'Object', () => `An upright arrow ${fmt(p.hO)} cm tall, ${fmt(p.dO)} cm from the lens. Drag it to move it or change its height.`);
      if (img) rect(X(img.di) - 16, Math.min(AXIS, Y(img.hi)) - 16, 32, Math.abs(img.hi * S) + 32, img.di > 0 ? 'Real image' : 'Virtual image', () => (img.di > 0 ? 'Light really meets here, so the image could be caught on a screen. A real image formed by one lens is always inverted.' : 'The rays only appear to come from here (dashed lines): the image cannot be caught on a screen, but you see it by looking through the lens. It is upright.'));
    }
  }

  /* ---------- Info panel ---------- */
  function info(): string[] {
    if (p.view === 'lab') {
      const f = lastLab?.first;
      if (!f) return ['Aim the laser at a mirror or the glass.', 'Drag objects to move them;', 'drag the blue handles to rotate them.'];
      if (f.kind === 'mirror') return ['Law of reflection: θi = θr', `θi = ${fmt(f.thI)}°,  θr = ${fmt(f.thO)}°`, 'Tilt the mirror by δ: the beam turns by 2δ'];
      if (f.tir) return ['Total internal reflection', `θi = ${fmt(f.thI)}° > θc = ${fmt(deg(Math.asin(f.n2 / f.n1)))}°`, `(n₁ = ${f.n1.toFixed(2)} → n₂ = ${f.n2.toFixed(2)})`];
      return ['Snell’s law: n₁ sin θ₁ = n₂ sin θ₂', `${f.n1.toFixed(2)} × sin ${fmt(f.thI)}° = ${f.n2.toFixed(2)} × sin ${fmt(f.thO)}°`, `= ${(f.n1 * Math.sin(f.thI * DEG)).toFixed(3)} on both sides`];
    }
    if (p.view === 'snell') {
      const s = snell();
      return [
        'n₁ sin θ₁ = n₂ sin θ₂',
        s.tir
          ? `${p.n1.toFixed(2)} × sin ${fmt(p.th1)}° = ${(p.n1 * Math.sin(s.th1)).toFixed(3)} > n₂ = ${p.n2.toFixed(2)}: no θ₂`
          : `${p.n1.toFixed(2)} × sin ${fmt(p.th1)}° = ${p.n2.toFixed(2)} × sin ${fmt(deg(s.th2))}°`,
        Number.isNaN(s.crit) ? 'n₁ ≤ n₂: total internal reflection is impossible' : `Critical angle θc = sin⁻¹(n₂/n₁) = ${fmt(s.crit)}°`,
        `Reflected ${fmt(s.R * 100, 1)}%, transmitted ${fmt(s.T * 100, 1)}%`,
      ];
    }
    const img = lensImage();
    const f = fSigned();
    if (p.beam) return [`f = ${fmt(f)} cm (${f > 0 ? 'converging' : 'diverging'})`, 'Power P = 1/f', `= ${fmt(100 / f, 2)} dioptres (f in m)`];
    if (!img) return ['1/f = 1/dₒ + 1/dᵢ', `1/${fmt(f)} = 1/${fmt(p.dO)} + 1/dᵢ → 1/dᵢ = 0`, 'No image: the rays leave parallel'];
    return [
      '1/f = 1/dₒ + 1/dᵢ',
      `1/${fmt(f)} = 1/${fmt(p.dO)} + 1/dᵢ → dᵢ = ${fmt(img.di)} cm`,
      `m = −dᵢ/dₒ = ${fmt(img.m, 2)}, hᵢ = ${fmt(img.hi)} cm`,
      `${img.di > 0 ? 'Real' : 'Virtual'}, ${img.m < 0 ? 'inverted' : 'upright'}, ${Math.abs(img.m) > 1.005 ? 'magnified' : Math.abs(img.m) < 0.995 ? 'diminished' : 'same size'}`,
    ];
  }
  function drawInfo(x: number, y: number, w: number, lines: string[]) {
    const lh = 17 / cur;
    const h = 14 + lines.length * lh;
    panel(x, y, w, h);
    lines.forEach((l, i) => text(l, x + 12, y + 8 + (i + 0.8) * lh, 12, i === 0 ? pal['sim-text'] : pal['text-muted'], 'left', i === 0 ? 750 : 650));
  }

  /* ---------- Render ---------- */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    const { k, ox, oy } = tf();
    K = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    const W = world();
    ctx.save();
    ctx.beginPath();
    ctx.rect(W.x, W.y, 1000 * W.s, 600 * W.s);
    ctx.clip();
    ctx.translate(W.x, W.y);
    ctx.scale(W.s, W.s);
    frame = { x: W.x, y: W.y, s: W.s };
    cur = K * W.s;
    if (p.view === 'lab') drawLab();
    else if (p.view === 'snell') drawSnell();
    else drawLens();
    ctx.restore();
    frame = { x: 0, y: 0, s: 1 };
    cur = K;
    if (portrait()) {
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1 / K;
      ctx.strokeRect(W.x, W.y, 1000 * W.s, 600 * W.s);
      drawInfo(10, W.y + 600 * W.s + 14, 660, info());
    } else drawInfo(14, 14, p.view === 'snell' ? 360 : 330, info());
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts ---------- */
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = '';
    if (p.view === 'lab') {
      const f = lastLab?.first;
      r('r1', 'First surface hit', f ? (f.kind === 'mirror' ? 'Mirror' : f.n1 < f.n2 ? 'Air → glass' : 'Glass → air') : 'Nothing');
      r('r2', 'Angle of incidence', f ? `${fmt(f.thI)}°` : '—');
      r('r3', f && f.kind === 'glass' && !f.tir ? 'Angle of refraction' : 'Angle of reflection', f ? `${fmt(f.thO)}°` : '—');
      r('r4', 'Mirror reflections', String(lastLab?.mirrorHits ?? 0));
      r('r5', 'Total internal reflections', String(lastLab?.tirCount ?? 0), (lastLab?.tirCount ?? 0) > 0 ? 'warn' : null);
      r('r6', 'Glass refractive index', p.shape === 'none' ? 'No glass' : p.nGlass.toFixed(2));
      sim.setBadge(f ? (f.kind === 'mirror' ? 'Reflection' : f.tir ? 'Total internal reflection' : 'Refraction') : 'Ray lab');
      note = !f
        ? 'The beam misses everything. Drag the laser, mirrors or glass, or rotate them with their blue handles.'
        : f.kind === 'mirror'
          ? `The beam hits the mirror at ${fmt(f.thI)}° to the normal and leaves at ${fmt(f.thO)}°: the law of reflection. Tilt the mirror and watch the reflected beam swing through twice the angle.`
          : f.tir
            ? 'Inside the glass the beam meets the surface beyond the critical angle, so none of it escapes: total internal reflection, the principle behind optical fibres.'
            : `Entering the glass, the beam slows down and bends towards the normal (${fmt(f.thI)}° → ${fmt(f.thO)}°). A faint part of it is reflected at every surface.${p.shape === 'block' ? ' A parallel-sided block shifts the beam sideways but leaves it travelling in its original direction.' : ''}`;
    } else if (p.view === 'snell') {
      const s = snell();
      r('r1', 'Angle of incidence θ₁', `${fmt(p.th1)}°`);
      r('r2', 'Angle of refraction θ₂', s.tir ? 'none (total internal reflection)' : `${fmt(deg(s.th2))}°`, s.tir ? 'warn' : null);
      r('r3', 'Critical angle θc', Number.isNaN(s.crit) ? 'none (n₁ ≤ n₂)' : `${fmt(s.crit)}°`);
      r('r4', 'Reflected', `${fmt(s.R * 100, 1)}%`);
      r('r5', 'Transmitted', `${fmt(s.T * 100, 1)}%`);
      r('r6', 'Speed in medium 2 (c/n₂)', `${(3 / p.n2).toFixed(2)} × 10⁸ m/s`);
      sim.setBadge(s.tir ? 'Total internal reflection' : p.n2 > p.n1 ? 'Bends towards the normal' : p.n2 < p.n1 ? 'Bends away from the normal' : 'No bending');
      note = s.tir
        ? `θ₁ = ${fmt(p.th1)}° is larger than the critical angle (${fmt(s.crit)}°), so Snell’s law has no solution: all the light is reflected back into medium 1.`
        : p.n2 > p.n1
          ? `Light slows down entering the denser medium and bends towards the normal: θ₂ = ${fmt(deg(s.th2))}° < θ₁. About ${fmt(s.R * 100, 1)}% is reflected.`
          : p.n2 < p.n1
            ? `Light speeds up leaving the denser medium and bends away from the normal: θ₂ = ${fmt(deg(s.th2))}°. Increase θ₁ past ${fmt(s.crit)}° for total internal reflection.`
            : 'Both media have the same refractive index, so the light passes straight through without bending.';
    } else {
      const img = lensImage();
      const f = fSigned();
      r('r1', 'Object distance dₒ', `${fmt(p.dO)} cm`);
      r('r2', 'Image distance dᵢ', img ? `${fmt(img.di)} cm` : '∞ (no image)');
      r('r3', 'Focal length f', `${fmt(f)} cm`);
      r('r4', 'Magnification m', img ? fmt(img.m, 2) : '—');
      r('r5', 'Image height', img ? `${fmt(img.hi)} cm` : '—');
      r('r6', 'Image', img ? `${img.di > 0 ? 'Real' : 'Virtual'}, ${img.m < 0 ? 'inverted' : 'upright'}` : '—', img ? (img.di > 0 ? 'ok' : null) : 'warn');
      sim.setBadge(p.beam ? (f > 0 ? 'Converging lens' : 'Diverging lens') : img ? `${img.di > 0 ? 'Real' : 'Virtual'} image, m = ${fmt(img.m, 2)}` : 'No image');
      note = p.beam
        ? f > 0
          ? `A converging lens brings parallel rays together at its focal point, ${fmt(f)} cm behind it.`
          : `A diverging lens spreads parallel rays out, as if they came from a focal point ${fmt(-f)} cm in front of it.`
        : !img
          ? 'With the object exactly at the focal point, the rays leave the lens parallel and never meet: no image.'
          : f < 0
            ? 'A diverging lens always forms a virtual, upright, diminished image on the same side as the object.'
            : p.dO > 2 * f
              ? 'Object beyond 2F: the image is real, inverted and smaller, between F′ and 2F′, as in a camera or your eye.'
              : Math.abs(p.dO - 2 * f) < 0.3
                ? 'Object at 2F: the image is real, inverted and the same size, at 2F′.'
                : p.dO > f
                  ? 'Object between F and 2F: the image is real, inverted and magnified, beyond 2F′, as in a projector.'
                  : 'Object inside F: the rays still spread after the lens, so the image is virtual, upright and magnified: a magnifying glass.';
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', note);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  let syncing = false;
  const changed = () => sim.requestRender();
  const showFor = () => {
    ui.showWhen('[data-only="lab"]', p.view === 'lab');
    ui.showWhen('[data-only="snell"]', p.view === 'snell');
    ui.showWhen('[data-only="lens"]', p.view === 'lens');
    ui.showWhen('[data-only="glass"]', p.view === 'lab' && p.shape !== 'none');
  };
  const viewCtl = ui.choice<View>('op-view', (v) => {
    p.view = v;
    showFor();
    sim.hideTooltip();
    changed();
  });
  // lab
  const labSel = root.querySelector<HTMLSelectElement>('[data-labsel]')!;
  const labObj = (id: LabId) => (id === 'laser' ? p.laser : id === 'm1' ? p.m1 : id === 'm2' ? p.m2 : p.glass);
  const rotCtl = ui.range('op-rot', (v) => `${v}°`, (v) => {
    if (syncing) return;
    labObj(p.labSel).a = v;
    changed();
  });
  function selectLab(id: LabId) {
    p.labSel = id;
    labSel.value = id;
    syncing = true;
    let a = Math.round(labObj(id).a);
    while (a > 180) a -= 360;
    while (a <= -180) a += 360;
    rotCtl.set(a);
    syncing = false;
    changed();
  }
  labSel.addEventListener('change', () => selectLab(labSel.value as LabId));
  const shapeCtl = ui.choice<'none' | 'block' | 'prism'>('op-shape', (v) => {
    p.shape = v;
    if (v === 'none' && p.labSel === 'glass') selectLab('m1');
    showFor();
    changed();
  });
  const nGCtl = ui.range('op-ng', (v) => v.toFixed(2), (v) => ((p.nGlass = v), changed()));
  const twoCtl = ui.toggle('op-two', (v) => {
    p.two = v;
    if (!v && p.labSel === 'm2') selectLab('m1');
    changed();
  });
  const normCtl = ui.toggle('op-normals', (v) => ((p.normals = v), changed()));
  const partCtl = ui.toggle('op-partial', (v) => ((p.partial = v), changed()));
  // snell
  const thCtl = ui.range('op-th', (v) => `${v}°`, (v) => ((p.th1 = v), changed()));
  const n1Ctl = ui.range('op-n1', (v) => v.toFixed(2), (v) => ((p.n1 = v), changed()));
  const n2Ctl = ui.range('op-n2', (v) => v.toFixed(2), (v) => ((p.n2 = v), changed()));
  root.querySelectorAll<HTMLButtonElement>('[data-n1]').forEach((b) => b.addEventListener('click', () => n1Ctl.set(Number(b.dataset.n1))));
  root.querySelectorAll<HTMLButtonElement>('[data-n2]').forEach((b) => b.addEventListener('click', () => n2Ctl.set(Number(b.dataset.n2))));
  root.querySelector('[data-swap]')?.addEventListener('click', () => {
    const a = p.n1;
    n1Ctl.set(p.n2);
    n2Ctl.set(a);
  });
  // lens
  const kindCtl = ui.choice<'convex' | 'concave'>('op-kind', (v) => ((p.kind = v), changed()));
  const fCtl = ui.range('op-f', (v) => `${v} cm`, (v) => ((p.f = v), changed()));
  const doCtl = ui.range('op-do', (v) => `${v} cm`, (v) => ((p.dO = v), changed()));
  ui.presets('op-do', doCtl);
  const hoCtl = ui.range('op-ho', (v) => `${v} cm`, (v) => ((p.hO = v), changed()));
  const beamCtl = ui.toggle('op-beam', (v) => ((p.beam = v), changed()));

  /* ---------- Dragging ---------- */
  const toWorld = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    const W = world();
    return [((x - ox) / k - W.x) / W.s, ((y - oy) / k - W.y) / W.s];
  };
  type DragId = `rot-${LabId}` | `move-${LabId}` | 'snell' | 'obj' | 'lens' | 'focus';
  let grab: Pt = [0, 0];
  const distSeg = (pt: Pt, a: Pt, b: Pt) => {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const tt = clamp(((pt[0] - a[0]) * ex + (pt[1] - a[1]) * ey) / (ex * ex + ey * ey), 0, 1);
    return Math.hypot(pt[0] - a[0] - ex * tt, pt[1] - a[1] - ey * tt);
  };
  enableDrag<DragId>(canvas, {
    hit(x, y) {
      const [wx, wy] = toWorld(x, y);
      const R = 20 / world().s;
      if (p.view === 'lab') {
        const ids: LabId[] = ['laser', 'm1', ...(p.two ? (['m2'] as LabId[]) : []), ...(p.shape !== 'none' ? (['glass'] as LabId[]) : [])];
        for (const id of ids) {
          const h = handleOf(id);
          if (Math.hypot(wx - h[0], wy - h[1]) < R) return `rot-${id}`;
        }
        if (Math.hypot(wx - p.laser.x, wy - p.laser.y) < 36) return 'move-laser';
        if (distSeg([wx, wy], ...mirrorSeg(p.m1)) < 14) return 'move-m1';
        if (p.two && distSeg([wx, wy], ...mirrorSeg(p.m2)) < 14) return 'move-m2';
        if (p.shape !== 'none' && inPoly(glassPoly(), wx, wy)) return 'move-glass';
        return null;
      }
      if (p.view === 'snell') return Math.hypot(wx - snellSrc[0], wy - snellSrc[1]) < 40 ? 'snell' : null;
      if (Math.hypot(wx - X(p.f), wy - AXIS) < 22) return 'focus';
      if (Math.hypot(wx - LX(), wy - (AXIS - 200)) < 24) return 'lens';
      if (!p.beam && Math.abs(wx - X(-p.dO)) < 22 && wy >= Y(p.hO) - 22 && wy <= AXIS + 10) return 'obj';
      if (Math.abs(wx - LX()) < 18 && Math.abs(wy - AXIS) < 190) return 'lens';
      return null;
    },
    start(id, x, y) {
      sim.hideTooltip();
      const [wx, wy] = toWorld(x, y);
      if (id.startsWith('move-') || id.startsWith('rot-')) {
        const lid = id.split('-')[1] as LabId;
        if (p.labSel !== lid) selectLab(lid);
        const o = labObj(lid);
        grab = [o.x - wx, o.y - wy];
      }
    },
    move(id, x, y) {
      const [wx, wy] = toWorld(x, y);
      if (id.startsWith('move-')) {
        const o = labObj(id.slice(5) as LabId);
        o.x = clamp(wx + grab[0], 20, 980);
        o.y = clamp(wy + grab[1], 20, 580);
      } else if (id.startsWith('rot-')) {
        const lid = id.slice(4) as LabId;
        const o = labObj(lid);
        let a: number;
        if (lid === 'laser') a = Math.atan2(o.y - wy, o.x - wx) / DEG; // handle is behind the laser
        else if (lid === 'glass') {
          const base = Math.atan2(handleOf('glass')[1] - o.y, handleOf('glass')[0] - o.x) / DEG - o.a;
          a = Math.atan2(wy - o.y, wx - o.x) / DEG - base;
        } else a = Math.atan2(wy - o.y, wx - o.x) / DEG;
        a = Math.round(a);
        while (a > 180) a -= 360;
        while (a <= -180) a += 360;
        o.a = a;
        syncing = true;
        rotCtl.set(a);
        syncing = false;
      } else if (id === 'snell') {
        const dx = wx - O[0];
        const dy = O[1] - wy;
        const a = Math.atan2(-dx, Math.max(dy, 0.001)) / DEG;
        thCtl.set(Math.round(clamp(a, 0, 89)));
      } else if (id === 'focus') {
        fCtl.set(Math.round(clamp(Math.abs(wx - LX()) / S, 5, 30)));
      } else if (id === 'lens') {
        const nx = clamp(wx, Math.max(330, 30 + p.dO * S), 760);
        p.lensX = nx;
      } else if (id === 'obj') {
        doCtl.set(Math.round(clamp((LX() - wx) / S, 3, 75)));
        hoCtl.set(Math.round(clamp((AXIS - wy) / S, 2, 15)));
      }
      changed();
    },
    click(x, y) {
      const { k, ox, oy } = tf();
      const bx = (x - ox) / k;
      const by = (y - oy) / k;
      for (let i = areas.length - 1; i >= 0; i--)
        if (areas[i].test(bx, by)) {
          sim.showTooltip(x, y, areas[i].title, areas[i].text());
          return;
        }
      sim.hideTooltip();
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: true,
    reset() {
      Object.assign(p, structuredClone(DEF));
      viewCtl.set(DEF.view, false);
      shapeCtl.set(DEF.shape, false);
      nGCtl.set(DEF.nGlass, false);
      twoCtl.set(DEF.two, false);
      normCtl.set(DEF.normals, false);
      partCtl.set(DEF.partial, false);
      thCtl.set(DEF.th1, false);
      n1Ctl.set(DEF.n1, false);
      n2Ctl.set(DEF.n2, false);
      kindCtl.set(DEF.kind, false);
      fCtl.set(DEF.f, false);
      doCtl.set(DEF.dO, false);
      hoCtl.set(DEF.hO, false);
      beamCtl.set(DEF.beam, false);
      selectLab(DEF.labSel);
      showFor();
    },
  });
  selectLab(DEF.labSel);
  showFor();
  updateUi();
}
