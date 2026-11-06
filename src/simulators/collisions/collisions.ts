/**
 * Momentum and collisions on a frictionless air table (top view).
 *
 * Two pucks (discs) move at constant velocity until they touch. The exact
 * moment of contact is found by solving |Δx + Δv t| = r₁ + r₂. The collision
 * is an impulse J along the line of centres n (from A to B):
 *
 *   u  = (v_A − v_B) · n            closing speed along n
 *   J  = (1 + e) u / (1/m_A + 1/m_B)
 *   v_A′ = v_A − (J/m_A) n,   v_B′ = v_B + (J/m_B) n
 *
 * e = 1 is elastic (kinetic energy conserved), 0 < e < 1 inelastic. In a
 * perfectly inelastic ("sticky") collision both pucks leave with the
 * centre-of-mass velocity v′ = (m_A v_A + m_B v_B)/(m_A + m_B).
 * Equal and opposite impulses mean total momentum is always conserved. The
 * table has no walls: the pucks are an isolated system until they leave it.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type Kind = 'elastic' | 'inelastic' | 'sticky';
type Pt = [number, number];
const TW = 4; // table width (m)
const TH = 2.4;
const VMAX = 4;
const VS = 42; // px per m/s for velocity arrows
const PS = 26; // px per kg·m/s for momentum arrows
const COL_A = '#3b82f6';
const COL_B = '#f08c00';

interface Puck {
  m: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Init {
  m: number;
  x: number;
  y: number;
  speed: number;
  dir: number; // degrees, 0 = +x, counterclockwise
}
const SCN: Record<string, { kind: Kind; e?: number; A: Init; B: Init }> = {
  stationary: { kind: 'elastic', A: { m: 1, x: 0.9, y: 1.2, speed: 2, dir: 0 }, B: { m: 1, x: 2.4, y: 1.2, speed: 0, dir: 0 } },
  headon: { kind: 'elastic', A: { m: 1, x: 0.8, y: 1.2, speed: 1.5, dir: 0 }, B: { m: 1, x: 3.2, y: 1.2, speed: 1.5, dir: 180 } },
  heavy: { kind: 'elastic', A: { m: 4, x: 0.9, y: 1.2, speed: 1.5, dir: 0 }, B: { m: 0.5, x: 2.2, y: 1.2, speed: 0, dir: 0 } },
  glancing: { kind: 'elastic', A: { m: 1, x: 0.7, y: 1.05, speed: 2, dir: 0 }, B: { m: 1, x: 2.2, y: 1.3, speed: 0, dir: 0 } },
  sticky: { kind: 'sticky', A: { m: 2, x: 0.8, y: 1.2, speed: 2, dir: 0 }, B: { m: 1, x: 2.8, y: 1.2, speed: 1, dir: 180 } },
};
const DEF = { kind: 'elastic' as Kind, e: 0.5, sel: 'A' as 'A' | 'B', vel: true, mom: true, cm: true, slow: false };

interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}
const fmt = (v: number, d = 2) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`;
};
const radius = (m: number) => 0.11 + 0.05 * Math.sqrt(m);

export function initCollisions(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const p = { ...DEF };
  const init: { A: Init; B: Init } = { A: { ...SCN.stationary.A }, B: { ...SCN.stationary.B } };

  /* ---------- Model ---------- */
  let A: Puck;
  let B: Puck;
  let t = 0;
  let collided = false;
  let stuck = false;
  let tHit = -1;
  let finished = '';
  let before = { px: 0, py: 0, ke: 0, keA: 0, keB: 0, pA: [0, 0] as Pt, pB: [0, 0] as Pt };
  let after: typeof before | null = null;
  let impulse: Pt = [0, 0];
  let cmTrail: Pt[] = [];
  let pts: Point[] = [];
  let kpts: Point[] = [];
  let lastPt = -1;
  let graphDirty = true;

  const fromInit = (i: Init): Puck => ({ m: i.m, x: i.x, y: i.y, vx: i.speed * Math.cos((i.dir * Math.PI) / 180), vy: i.speed * Math.sin((i.dir * Math.PI) / 180) });
  const ke = (q: Puck) => 0.5 * q.m * (q.vx * q.vx + q.vy * q.vy);
  const snap = () => ({ px: A.m * A.vx + B.m * B.vx, py: A.m * A.vy + B.m * B.vy, ke: ke(A) + ke(B), keA: ke(A), keB: ke(B), pA: [A.m * A.vx, A.m * A.vy] as Pt, pB: [B.m * B.vx, B.m * B.vy] as Pt });
  function restart() {
    A = fromInit(init.A);
    B = fromInit(init.B);
    t = 0;
    collided = false;
    stuck = false;
    tHit = -1;
    finished = '';
    after = null;
    impulse = [0, 0];
    before = snap();
    cmTrail = [];
    pts = [];
    kpts = [];
    lastPt = -1;
    graphDirty = true;
    sim.setTime(0);
  }
  /** Time until the pucks touch, or Infinity. */
  function timeToHit() {
    if (collided) return Infinity;
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const wx = B.vx - A.vx;
    const wy = B.vy - A.vy;
    const R = radius(A.m) + radius(B.m);
    const a = wx * wx + wy * wy;
    const b = 2 * (dx * wx + dy * wy);
    const c = dx * dx + dy * dy - R * R;
    if (c <= 0) return b < 0 ? 0 : Infinity; // touching and approaching
    if (a < 1e-12 || b >= 0) return Infinity;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return Infinity;
    return (-b - Math.sqrt(disc)) / (2 * a);
  }
  function move(dt: number) {
    A.x += A.vx * dt;
    A.y += A.vy * dt;
    B.x += B.vx * dt;
    B.y += B.vy * dt;
  }
  function collide() {
    const vB0: Pt = [B.vx, B.vy];
    if (p.kind === 'sticky') {
      const M = A.m + B.m;
      const vx = (A.m * A.vx + B.m * B.vx) / M;
      const vy = (A.m * A.vy + B.m * B.vy) / M;
      A.vx = B.vx = vx;
      A.vy = B.vy = vy;
      stuck = true;
    } else {
      const e = p.kind === 'elastic' ? 1 : p.e;
      const d = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      const nx = (B.x - A.x) / d;
      const ny = (B.y - A.y) / d;
      const u = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
      if (u <= 0) return;
      const J = ((1 + e) * u) / (1 / A.m + 1 / B.m);
      A.vx -= (J / A.m) * nx;
      A.vy -= (J / A.m) * ny;
      B.vx += (J / B.m) * nx;
      B.vy += (J / B.m) * ny;
    }
    impulse = [B.m * (B.vx - vB0[0]), B.m * (B.vy - vB0[1])];
    collided = true;
    tHit = t;
    after = snap();
    sim.announce('Collision!');
  }
  const offTable = (q: Puck) => q.x < -0.4 || q.x > TW + 0.4 || q.y < -0.4 || q.y > TH + 0.4;

  function step(dt: number) {
    dt = Math.min(dt, 0.05) * (p.slow ? 0.25 : 1);
    if (dragging) return;
    let left = dt;
    const tc = timeToHit();
    if (tc <= left) {
      move(tc);
      t += tc;
      left -= tc;
      collide();
    }
    move(left);
    t += left;
    const M = A.m + B.m;
    cmTrail.push([(A.m * A.x + B.m * B.x) / M, (A.m * A.y + B.m * B.y) / M]);
    if (cmTrail.length > 400) cmTrail.shift();
    if (t - lastPt >= 0.03) {
      lastPt = t;
      const s = snap();
      pts.push({ x: t, y: Math.hypot(s.px, s.py) });
      kpts.push({ x: t, y: s.ke });
      graphDirty = true;
    }
    if ((offTable(A) && offTable(B)) || t > 15) {
      finished = collided ? 'Both pucks have left the table. Press Replay to watch again.' : 'The pucks missed each other. Change their positions or directions.';
      sim.pause();
      sim.announce(finished);
    } else if (!collided && timeToHit() === Infinity && t > 0.2 && (offTable(A) || offTable(B))) {
      finished = 'The pucks will not collide. Change their positions or directions.';
    }
    sim.setTime(t);
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1150] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let K = 1;
  const fs = (px: number, wt = 650) => font(px / K, wt);
  const table = () => (portrait() ? { x: 10, y: 64, ppm: 165 } : { x: 10, y: 54, ppm: 150 });
  const S = (x: number, y: number): Pt => {
    const T = table();
    return [T.x + x * T.ppm, T.y + (TH - y) * T.ppm];
  };
  let areas: Area[] = [];
  const rectArea = (x: number, y: number, w: number, h: number, title: string, text: () => string) => areas.push({ test: (px, py) => px >= x && px <= x + w && py >= y && py <= y + h, title, text });
  const circArea = (x: number, y: number, r: number, title: string, text: () => string) => areas.push({ test: (px, py) => Math.hypot(px - x, py - y) <= r, title, text });

  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function panel(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / K;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  /* ---------- Table and pucks ---------- */
  const handles = { A: [0, 0] as Pt, B: [0, 0] as Pt, tipA: null as Pt | null, tipB: null as Pt | null };
  function drawPuck(q: Puck, col: string, label: string, selected: boolean) {
    const T = table();
    const [x, y] = S(q.x, q.y);
    const r = radius(q.m) * T.ppm;
    ctx.fillStyle = withAlpha('#000000', 0.25);
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 6, r, r, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, col);
    g.addColorStop(1, withAlpha(col, 0.85));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = selected ? pal['sim-text'] : withAlpha('#000000', 0.35);
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#ffffff', 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    text(label, x, y - 2, 13, '#ffffff', 'center', 800);
    text(`${fmt(q.m, 1)} kg`, x, y + 13, 10.5, '#ffffff', 'center', 700);
    return [x, y] as Pt;
  }
  function drawTable(Tw: number, Th: number) {
    const T = table();
    // table surface
    ctx.fillStyle = withAlpha('#4dabf7', 0.1);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(T.x, T.y, Tw, Th, 12);
    ctx.fill();
    ctx.stroke();
    // air holes
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.35);
    for (let gx = 0.2; gx < TW; gx += 0.2)
      for (let gy = 0.2; gy < TH; gy += 0.2) {
        const [hx, hy] = S(gx, gy);
        ctx.fillRect(hx - 1, hy - 1, 2, 2);
      }
    // metre marks
    for (let m = 1; m < TW; m++) {
      const [mx, my] = S(m, 0);
      text(`${m} m`, mx, my - 6, 10, pal['text-faint']);
    }
  }
  function drawScene() {
    const T = table();
    const Tw = TW * T.ppm;
    const Th = TH * T.ppm;
    drawTable(Tw, Th);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(T.x, T.y, Tw, Th, 12);
    ctx.clip();
    // centre of mass trail
    if (p.cm && cmTrail.length > 1) {
      ctx.strokeStyle = withAlpha(pal.success, 0.6);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      cmTrail.forEach(([x, y], i) => {
        const [sx, sy] = S(x, y);
        if (i) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // contact line at the moment of impact
    if (stuck) {
      const [ax, ay] = S(A.x, A.y);
      const [bx, by] = S(B.x, B.y);
      ctx.strokeStyle = withAlpha(pal['sim-text'], 0.6);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    if (collided && t - tHit < 0.35) {
      const cx = (A.x * radius(B.m) + B.x * radius(A.m)) / (radius(A.m) + radius(B.m));
      const cy = (A.y * radius(B.m) + B.y * radius(A.m)) / (radius(A.m) + radius(B.m));
      const [sx, sy] = S(cx, cy);
      ctx.fillStyle = withAlpha(pal.warning, 0.6 * (1 - (t - tHit) / 0.35));
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    handles.A = drawPuck(A, COL_A, 'A', p.sel === 'A' && t === 0);
    handles.B = drawPuck(B, COL_B, 'B', p.sel === 'B' && t === 0);
    // vectors
    const vec = (q: Puck, h: Pt, key: 'tipA' | 'tipB') => {
      const sp = Math.hypot(q.vx, q.vy);
      handles[key] = null;
      if (p.mom && sp > 0.01) {
        arrow(ctx, h[0], h[1], h[0] + q.m * q.vx * PS, h[1] - q.m * q.vy * PS, withAlpha(pal['accent-2'], 0.85), 7, 14);
      }
      if (p.vel && sp > 0.01) {
        const tip: Pt = [h[0] + q.vx * VS, h[1] - q.vy * VS];
        arrow(ctx, h[0], h[1], tip[0], tip[1], pal['sim-text'], 2.6, 11);
        if (t === 0 && !sim.running) {
          ctx.strokeStyle = pal['sim-text'];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tip[0], tip[1], 9, 0, Math.PI * 2);
          ctx.stroke();
        }
        handles[key] = tip;
        text(`${fmt(sp, 2)} m/s`, tip[0], tip[1] - 14, 11, pal['sim-text'], 'center', 700);
      }
    };
    vec(A, handles.A, 'tipA');
    vec(B, handles.B, 'tipB');
    // centre of mass marker
    if (p.cm) {
      const M = A.m + B.m;
      const [cx, cy] = S((A.m * A.x + B.m * B.x) / M, (A.m * A.y + B.m * B.y) / M);
      ctx.strokeStyle = pal.success;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 8);
      ctx.lineTo(cx + 8, cy + 8);
      ctx.moveTo(cx + 8, cy - 8);
      ctx.lineTo(cx - 8, cy + 8);
      ctx.stroke();
      text('CM', cx + 12, cy + 18, 10.5, pal.success, 'left', 800);
    }
    ctx.restore();
    if (t === 0 && !sim.running) text('Drag a puck to place it · drag an arrow tip to aim it', T.x + Tw / 2, T.y + Th + 18, 12, pal['text-muted'], 'center', 700);
    else if (finished) text(finished, T.x + Tw / 2, T.y + Th + 18, 12, pal.warning, 'center', 700);

    rectArea(T.x, T.y, Tw, Th, 'Air table', () => 'Air blown up through tiny holes lifts the pucks, so friction is almost zero. With no walls in the way, the two pucks form an isolated system: no outside force acts on them, so their total momentum cannot change.');
    if (p.cm) {
      const M = A.m + B.m;
      const [cx, cy] = S((A.m * A.x + B.m * B.x) / M, (A.m * A.y + B.m * B.y) / M);
      circArea(cx, cy, 14, 'Centre of mass', () => `The mass-weighted average position of the two pucks. It moves at a constant velocity p/M = (${fmt(before.px / M)}, ${fmt(before.py / M)}) m/s, even through the collision, because the total momentum does not change.`);
    }
    const T2 = table();
    circArea(handles.A[0], handles.A[1], radius(A.m) * T2.ppm, 'Puck A', () => `Mass ${fmt(A.m, 1)} kg, velocity (${fmt(A.vx)}, ${fmt(A.vy)}) m/s, momentum p = mv = (${fmt(A.m * A.vx)}, ${fmt(A.m * A.vy)}) kg·m/s.`);
    circArea(handles.B[0], handles.B[1], radius(B.m) * T2.ppm, 'Puck B', () => `Mass ${fmt(B.m, 1)} kg, velocity (${fmt(B.vx)}, ${fmt(B.vy)}) m/s, momentum p = mv = (${fmt(B.m * B.vx)}, ${fmt(B.m * B.vy)}) kg·m/s.`);
  }

  /* ---------- Momentum diagram ---------- */
  function drawMomentum(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Total momentum: before and after', x + 14, y + 22, 12.5, pal['sim-text'], 'left', 750);
    const aft = after ?? snap();
    const sets: [string, typeof before, boolean][] = [
      ['Before', before, true],
      ['After', aft, !!after],
    ];
    const maxP = Math.max(0.5, Math.hypot(before.pA[0], before.pA[1]) + Math.hypot(before.pB[0], before.pB[1]), Math.hypot(aft.pA[0], aft.pA[1]) + Math.hypot(aft.pB[0], aft.pB[1]));
    const sc = Math.min((w / 2 - 30) / maxP, (h - 80) / (2 * maxP));
    sets.forEach(([lab, s, ok], i) => {
      const cx = x + (w / 2) * (i + 0.5);
      const cy = y + h / 2 + 10;
      text(lab, cx, y + 44, 12, pal['sim-text'], 'center', 750);
      if (!ok) {
        text('after the collision', cx, cy, 11, pal['text-faint']);
        return;
      }
      // tip-to-tail: pA then pB, then the total
      const ox = cx - (s.px * sc) / 2;
      const oy = cy + (s.py * sc) / 2;
      const a1: Pt = [ox + s.pA[0] * sc, oy - s.pA[1] * sc];
      const a2: Pt = [a1[0] + s.pB[0] * sc, a1[1] - s.pB[1] * sc];
      if (Math.hypot(s.pA[0], s.pA[1]) > 0.01) arrow(ctx, ox, oy, a1[0], a1[1], COL_A, 3.5, 10);
      if (Math.hypot(s.pB[0], s.pB[1]) > 0.01) arrow(ctx, a1[0], a1[1], a2[0], a2[1], COL_B, 3.5, 10);
      if (Math.hypot(s.px, s.py) > 0.01) arrow(ctx, ox, oy, a2[0], a2[1], pal.success, 2.5, 10);
      text(`p = ${fmt(Math.hypot(s.px, s.py))} kg·m/s`, cx, y + h - 14, 11.5, pal.success, 'center', 750);
    });
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / K;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 36);
    ctx.lineTo(x + w / 2, y + h - 30);
    ctx.stroke();
    rectArea(x, y, w, h, 'Momentum vectors', () => 'Blue is puck A’s momentum and orange is puck B’s, added tip to tail. The green arrow is the total. It is identical before and after, in every type of collision: momentum is conserved.');
  }

  /* ---------- Kinetic energy bars ---------- */
  function drawEnergy(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Kinetic energy: before and after', x + 14, y + 22, 12.5, pal['sim-text'], 'left', 750);
    const aft = after;
    const maxKE = Math.max(0.5, before.ke);
    const bx0 = x + 22 + 52 / K;
    const bw = x + w - 16 - bx0;
    const rows: [string, number, number, number][] = [['Before', before.keA, before.keB, 0]];
    if (aft) rows.push(['After', aft.keA, aft.keB, before.ke - aft.ke]);
    rows.forEach(([lab, a, b, lost], i) => {
      const yy = y + 22 + 10 / K + i * (22 + 34 / K);
      text(lab, x + 14, yy + 18, 12, pal['sim-text'], 'left', 700);
      const bx = bx0;
      let cx = bx;
      const seg = (v: number, c: string, hatch = false) => {
        const wv = (bw * v) / maxKE;
        if (wv < 0.5) return;
        ctx.fillStyle = c;
        ctx.fillRect(cx, yy + 4, wv, 22);
        if (hatch) {
          ctx.strokeStyle = withAlpha('#000000', 0.25);
          ctx.lineWidth = 1;
          for (let hx = cx - 22; hx < cx + wv; hx += 7) {
            ctx.beginPath();
            ctx.moveTo(Math.max(cx, hx), yy + 4 + Math.max(0, cx - hx));
            ctx.lineTo(Math.min(cx + wv, hx + 22), yy + 26 - Math.max(0, hx + 22 - (cx + wv)));
            ctx.stroke();
          }
        }
        cx += wv;
      };
      seg(a, COL_A);
      seg(b, COL_B);
      seg(lost, withAlpha(pal.danger, 0.35), true);
      text(`${fmt(a + b)} J${lost > 1e-3 ? ` (${fmt(lost)} J lost)` : ''}`, bx, yy + 26 + 16 / K, 11.5, lost > 1e-3 ? pal.danger : pal['text-muted'], 'left', 700);
    });
    if (!aft) text('Launch to see the energy after the collision', x + w / 2, y + h - 18, 11, pal['text-faint']);
    rectArea(x, y, w, h, 'Kinetic energy', () => 'Kinetic energy KE = ½mv². It is conserved only in an elastic collision. In inelastic collisions some of it becomes heat, sound and permanent deformation (shown hatched). The sticky collision loses the most energy that momentum conservation allows.');
  }

  /* ---------- Equations ---------- */
  function drawEquations(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    const lh = 14.5 / K;
    let yy = y + 6 + lh;
    const line = (s: string, c = pal['sim-text'], wt = 650) => {
      text(s, x + 14, yy, 11, c, 'left', wt);
      yy += lh;
    };
    const law = p.kind === 'elastic' ? 'Elastic (e = 1): p and KE both conserved' : p.kind === 'inelastic' ? `Inelastic (e = ${fmt(p.e)}): p conserved, KE not` : 'Sticky: v′ = (mAvA + mBvB) ÷ (mA + mB)';
    line(law, pal['sim-text'], 750);
    line('p = mAvA + mBvB (a vector sum)', pal['text-muted'], 600);
    line(`Before: p = (${fmt(before.px)}, ${fmt(before.py)}) kg·m/s`);
    if (after) {
      line(`After:  p = (${fmt(after.px)}, ${fmt(after.py)}) kg·m/s`, pal.success, 700);
      line(`Impulse on B: J = ΔpB = (${fmt(impulse[0])}, ${fmt(impulse[1])}) N·s`);
      const lost = before.ke - after.ke;
      line(`KE: ${fmt(before.ke)} J → ${fmt(after.ke)} J (${before.ke > 0 ? fmt((100 * lost) / before.ke, 0) : '0'}% lost)`, lost > 1e-3 ? pal.danger : pal['sim-text'], 700);
    } else line('After: launch the pucks to find out', pal['text-faint']);
    rectArea(x, y, w, h, 'Conservation laws', () => 'During the collision the pucks push on each other with equal and opposite forces for the same time, so they receive equal and opposite impulses (Newton’s third law). That is why the total momentum cannot change. Kinetic energy, however, can be lost.');
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
    if (portrait()) {
      drawMomentum(10, 492, 660, 210);
      drawEnergy(10, 710, 660, 192);
      drawEquations(10, 910, 660, 230);
    } else {
      drawMomentum(624, 54, 366, 250);
      drawEnergy(624, 312, 366, 180);
      drawEquations(10, 442, 604, 150);
    }
    drawScene();
    ctx.restore();
    updateUi();
    if (graphDirty) drawGraph();
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="cl-graph"]')!, {
    x: { min: 0, span: 3, step: 1, format: (v) => `${v}s` },
    y: { min: 0, max: 10, step: 2, format: (v) => `${v}` },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="cl-graph"]')!, graph, {
    currentId: 'ke',
    label: () => `KE, ${p.kind === 'inelastic' ? `e = ${fmt(p.e)}` : p.kind}`,
    onSave: () => {
      restart();
      sim.play();
    },
  });
  function drawGraph() {
    graphDirty = false;
    const hi = Math.max(2, ...pts.map((q) => q.y), ...kpts.map((q) => q.y));
    const st = hi > 20 ? 5 : hi > 8 ? 2 : 1;
    graph.opts.y = { min: 0, max: Math.ceil((hi * 1.1) / st) * st, step: st, format: (v) => `${v}` };
    graph.set('ke', { label: 'Total KE (J)', color: 'danger', points: kpts });
    graph.set('p', { label: 'Total momentum |p| (kg·m/s)', color: 'success', points: pts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="cl-graph"]'));
  }

  /* ---------- Readouts ---------- */
  function updateUi() {
    const s = snap();
    ui.readout('pb', `${fmt(Math.hypot(before.px, before.py))} kg·m/s`);
    ui.readout('pa', after ? `${fmt(Math.hypot(after.px, after.py))} kg·m/s` : '—', after ? 'ok' : null);
    ui.readout('kb', `${fmt(before.ke)} J`);
    ui.readout('ka', after ? `${fmt(after.ke)} J` : '—');
    const lost = after ? before.ke - after.ke : 0;
    ui.readout('lost', after ? `${fmt(lost)} J (${before.ke > 0 ? fmt((100 * lost) / before.ke, 0) : '0'}%)` : '—', after && lost > 1e-3 ? 'warn' : null);
    ui.readout('va', `A: ${fmt(Math.hypot(A.vx, A.vy))} m/s · B: ${fmt(Math.hypot(B.vx, B.vy))} m/s`);
    sim.setBadge(!collided ? (t === 0 ? 'Ready to launch' : 'Before the collision') : stuck ? 'Stuck together' : 'After the collision');
    const note = !collided
      ? p.kind === 'elastic'
        ? 'Elastic collision: the pucks bounce apart perfectly, keeping all their kinetic energy. Press Start (or Launch) to release them.'
        : p.kind === 'inelastic'
          ? `Inelastic collision with coefficient of restitution e = ${fmt(p.e)}: the pucks separate at ${fmt(p.e * 100, 0)}% of the speed at which they approached.`
          : 'Perfectly inelastic collision: the pucks will stick together and move off as one.'
      : `Total momentum before: ${fmt(Math.hypot(before.px, before.py))} kg·m/s; after: ${fmt(Math.hypot(s.px, s.py))} kg·m/s. Unchanged. Kinetic energy ${before.ke - (after?.ke ?? 0) > 1e-3 ? `fell from ${fmt(before.ke)} J to ${fmt(after!.ke)} J: the rest became heat, sound and deformation.` : 'was also conserved: an elastic collision.'}`;
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', `Two pucks on an air table. Puck A ${fmt(A.m, 1)} kilograms, puck B ${fmt(B.m, 1)} kilograms. ${collided ? 'After the collision.' : 'Before the collision.'} Total momentum ${fmt(Math.hypot(s.px, s.py))} kilogram metres per second.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  let syncing = false;
  const showFor = () => ui.showWhen('[data-only="inelastic"]', p.kind === 'inelastic');
  const editInit = () => {
    if (syncing) return;
    sim.pause();
    restart();
    sim.requestRender();
  };
  const kindCtl = ui.choice<Kind>('cl-kind', (v) => {
    p.kind = v;
    showFor();
    editInit();
  });
  const eCtl = ui.range('cl-e', (v) => v.toFixed(2), (v) => {
    p.e = v;
    editInit();
  });
  const selCtl = ui.choice<'A' | 'B'>('cl-sel', (v) => {
    p.sel = v;
    syncSliders();
    sim.requestRender();
  });
  const massCtl = ui.range('cl-mass', (v) => `${v} kg`, (v) => {
    const i = init[p.sel];
    i.m = v;
    fixOverlap();
    editInit();
  });
  const speedCtl = ui.range('cl-speed', (v) => `${v.toFixed(1)} m/s`, (v) => {
    init[p.sel].speed = v;
    editInit();
  });
  const dirCtl = ui.range('cl-dir', (v) => `${v}°`, (v) => {
    init[p.sel].dir = v;
    editInit();
  });
  function syncSliders() {
    syncing = true;
    const i = init[p.sel];
    massCtl.set(i.m);
    speedCtl.set(Math.round(i.speed * 10) / 10);
    dirCtl.set(Math.round(i.dir));
    syncing = false;
  }
  function fixOverlap() {
    // keep the two starting positions apart
    const R = radius(init.A.m) + radius(init.B.m) + 0.02;
    const dx = init.B.x - init.A.x;
    const dy = init.B.y - init.A.y;
    const d = Math.hypot(dx, dy);
    if (d < R) {
      const k = d > 1e-6 ? R / d : 1;
      const o = p.sel === 'A' ? init.B : init.A;
      const s = p.sel === 'A' ? init.A : init.B;
      o.x = clamp(s.x + (d > 1e-6 ? dx * k * (p.sel === 'A' ? 1 : -1) : R), radius(o.m), TW - radius(o.m));
      o.y = clamp(s.y + (d > 1e-6 ? dy * k * (p.sel === 'A' ? 1 : -1) : 0), radius(o.m), TH - radius(o.m));
    }
  }
  const velCtl = ui.toggle('cl-vel', (v) => ((p.vel = v), sim.requestRender()));
  const momCtl = ui.toggle('cl-mom', (v) => ((p.mom = v), sim.requestRender()));
  const cmCtl = ui.toggle('cl-cm', (v) => ((p.cm = v), sim.requestRender()));
  const slowCtl = ui.toggle('cl-slow', (v) => (p.slow = v));
  function loadScenario(id: string) {
    const s = SCN[id];
    init.A = { ...s.A };
    init.B = { ...s.B };
    p.kind = s.kind;
    syncing = true;
    kindCtl.set(s.kind, false);
    syncing = false;
    showFor();
    syncSliders();
    sim.pause();
    restart();
    sim.requestRender();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-scn]').forEach((b) => b.addEventListener('click', () => loadScenario(b.dataset.scn!)));
  root.querySelector('[data-replay]')?.addEventListener('click', () => {
    restart();
    sim.play();
  });

  /* ---------- Dragging ---------- */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  const toWorld = (bx: number, by: number): Pt => {
    const T = table();
    return [(bx - T.x) / T.ppm, TH - (by - T.y) / T.ppm];
  };
  let dragging: null | 'A' | 'B' | 'tipA' | 'tipB' = null;
  let grab: Pt = [0, 0];
  enableDrag<'A' | 'B' | 'tipA' | 'tipB'>(canvas, {
    hit(x, y) {
      const [bx, by] = toBox(x, y);
      for (const key of ['tipA', 'tipB'] as const) {
        const h = handles[key];
        if (h && Math.hypot(bx - h[0], by - h[1]) < 18) return key;
      }
      const T = table();
      for (const key of ['A', 'B'] as const) {
        const q = key === 'A' ? A : B;
        const h = handles[key];
        if (Math.hypot(bx - h[0], by - h[1]) < radius(q.m) * T.ppm + 6) return key;
      }
      return null;
    },
    start(id, x, y) {
      sim.hideTooltip();
      sim.pause();
      restart();
      dragging = id;
      const key = id.endsWith('A') ? 'A' : 'B';
      if (p.sel !== key) selCtl.set(key);
      const [wx, wy] = toWorld(...toBox(x, y));
      grab = [init[key].x - wx, init[key].y - wy];
    },
    move(id, x, y) {
      const [wx, wy] = toWorld(...toBox(x, y));
      if (id === 'A' || id === 'B') {
        const i = init[id];
        const r = radius(i.m);
        i.x = clamp(wx + grab[0], r, TW - r);
        i.y = clamp(wy + grab[1], r, TH - r);
        const o = id === 'A' ? init.B : init.A;
        const d = Math.hypot(i.x - o.x, i.y - o.y);
        const R = r + radius(o.m) + 0.02;
        if (d < R && d > 1e-6) {
          i.x = o.x + ((i.x - o.x) * R) / d;
          i.y = o.y + ((i.y - o.y) * R) / d;
        }
      } else {
        const key = id === 'tipA' ? 'A' : 'B';
        const i = init[key];
        const vx = (wx - i.x) * ((table().ppm) / VS);
        const vy = (wy - i.y) * ((table().ppm) / VS);
        i.speed = Math.round(clamp(Math.hypot(vx, vy), 0, VMAX) * 10) / 10;
        i.dir = Math.round((Math.atan2(vy, vx) * 180) / Math.PI / 5) * 5;
        if (i.dir <= -180) i.dir += 360;
        syncSliders();
      }
      restart();
      sim.requestRender();
    },
    end() {
      dragging = null;
      restart();
      sim.requestRender();
    },
    click(x, y) {
      const [bx, by] = toBox(x, y);
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
    autoplay: false,
    onPlayChange(on) {
      // pressing Start after a finished run replays it
      if (on && finished) restart();
    },
    reset() {
      Object.assign(p, DEF);
      init.A = { ...SCN.stationary.A };
      init.B = { ...SCN.stationary.B };
      syncing = true;
      kindCtl.set(DEF.kind, false);
      eCtl.set(DEF.e, false);
      selCtl.set(DEF.sel, false);
      velCtl.set(DEF.vel, false);
      momCtl.set(DEF.mom, false);
      cmCtl.set(DEF.cm, false);
      slowCtl.set(DEF.slow, false);
      syncing = false;
      syncSliders();
      showFor();
      restart();
      comparer.refresh();
    },
  });
  restart();
  syncSliders();
  showFor();
  updateUi();
}
