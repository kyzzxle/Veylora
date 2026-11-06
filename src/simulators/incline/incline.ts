/**
 * A block on an inclined plane with static and kinetic friction.
 *
 * Coordinates: s is the block's position along the slope (m), measured from
 * the bottom, positive UP the slope. Readouts and the graph use "down the
 * slope" as positive, because that is the usual direction of motion.
 *
 *   Weight              W  = m g
 *   Parallel component  W∥ = m g sin θ   (down the slope)
 *   Normal force        N  = m g cos θ   (= W⊥, no other perpendicular forces)
 *   Static friction     fs ≤ μs N        (only as large as needed to hold the block)
 *   Kinetic friction    fk = μk N        (opposes the direction of sliding)
 *
 * A block at rest stays at rest if W∥ ≤ μs N, i.e. tan θ ≤ μs. Otherwise it
 * slides with a = g (sin θ − μk cos θ) down the slope. A block sliding UP the
 * slope decelerates at g (sin θ + μk cos θ); when it stops, the static
 * condition is checked again. Motion is integrated with exact constant-
 * acceleration steps, stopping exactly when the velocity reaches zero.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
const G = 9.81;
const L = 5; // slope length (m)
const PPM = 100; // design pixels per metre
const DX = 0.5; // oblique projection: screen offset per metre of depth
const DY = 0.32;
const WD = 1.45; // depth of the wedge (m)
const MAIN_Z = 0.12; // lanes (front and back of the wedge)
const GHOST_Z = 0.82;
const BD = 0.5; // block depth (m)
const DEF = { theta: 20, m: 5, muS: 0.5, muK: 0.35, s0: 3.6, ghost: true, slow: false, vec: true, comp: true, meas: true, fbd: true };
type Pt = [number, number];
interface Body {
  s: number;
  v: number;
  bottom: boolean;
}
interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}

const fmt = (v: number, d = 1) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`;
};

export function initIncline(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const p = { ...DEF };

  /* ---------- Model ---------- */
  const th = () => (p.theta * Math.PI) / 180;
  const side = () => 0.3 + 0.1 * Math.cbrt(p.m); // bigger mass, bigger block (same material)
  const hs = () => side() / 2;
  const sMin = () => hs();
  const sMax = () => L - hs() - 0.05;
  let main: Body = { s: DEF.s0, v: 0, bottom: false };
  let ghost: Body = { s: DEF.s0, v: 0, bottom: false };
  let t = 0;
  let restTime = 0;
  let pts: Point[] = [];
  let gpts: Point[] = [];
  let lastPt = -1;
  let dragging = false;

  function advance(b: Body, dt: number, muS: number, muK: number) {
    const c = Math.cos(th());
    const sn = Math.sin(th());
    if (b.v === 0) {
      if (b.bottom || b.s <= sMin() + 1e-9) {
        b.s = sMin();
        b.bottom = true;
        return;
      }
      if (sn <= muS * c + 1e-12) return; // static friction can hold the block
    }
    const dir = b.v !== 0 ? Math.sign(b.v) : -1; // from rest it can only start down the slope
    const a = -G * sn - dir * muK * G * c;
    const v1 = b.v + a * dt;
    if (b.v !== 0 && Math.sign(v1) !== dir) {
      const ts = -b.v / a;
      b.s += b.v * ts + 0.5 * a * ts * ts;
      b.v = 0; // stopped: next step re-checks static friction
    } else {
      b.s += b.v * dt + 0.5 * a * dt * dt;
      b.v = v1;
    }
    if (b.s <= sMin()) {
      b.s = sMin();
      b.v = 0;
      b.bottom = true;
    }
    if (b.s >= sMax()) {
      b.s = sMax();
      if (b.v > 0) b.v = 0;
    }
  }

  interface Forces {
    W: number;
    Wpar: number;
    Wperp: number;
    N: number;
    fsMax: number;
    f: number; // friction along +s (up the slope)
    kind: 'static' | 'kinetic' | 'none';
    stop: number; // push from the stop at the bottom, along +s
    net: number; // along +s
    a: number; // along +s
    holds: boolean;
  }
  function forces(b: Body, muS = p.muS, muK = p.muK): Forces {
    const c = Math.cos(th());
    const sn = Math.sin(th());
    const W = p.m * G;
    const Wpar = W * sn;
    const N = W * c;
    const fsMax = muS * N;
    let f = 0;
    let stop = 0;
    let kind: Forces['kind'] = 'static';
    const holds = Wpar <= fsMax + 1e-9;
    if (b.v !== 0) {
      f = -Math.sign(b.v) * muK * N;
      kind = 'kinetic';
    } else if (b.bottom) {
      f = Math.min(Wpar, fsMax);
      stop = Wpar - f;
    } else if (holds) f = Wpar;
    else {
      f = muK * N; // starting to slide down: kinetic friction acts up the slope
      kind = 'kinetic';
    }
    if (Math.abs(f) < 1e-9) kind = Wpar < 1e-9 && b.v === 0 ? 'none' : kind;
    const net = -Wpar + f + stop;
    return { W, Wpar, Wperp: N, N, fsMax, f, kind, stop, net: Math.abs(net) < 1e-9 ? 0 : net, a: Math.abs(net) < 1e-9 ? 0 : net / p.m, holds };
  }
  const moving = (b: Body, muS = p.muS) => b.v !== 0 || (!b.bottom && Math.sin(th()) > muS * Math.cos(th()) + 1e-12);

  function step(dt: number) {
    dt = Math.min(dt, 0.05) * (p.slow ? 0.25 : 1);
    if (dragging) return;
    const n = Math.max(1, Math.ceil(dt / 0.002));
    for (let i = 0; i < n; i++) {
      advance(main, dt / n, p.muS, p.muK);
      if (p.ghost) advance(ghost, dt / n, 0, 0);
    }
    t += dt;
    if (t - lastPt >= 0.02) {
      lastPt = t;
      pts.push({ x: t, y: -main.v });
      if (p.ghost) gpts.push({ x: t, y: -ghost.v });
      graphDirty = true;
    }
    const still = !moving(main) && (!p.ghost || !moving(ghost, 0));
    restTime = still ? restTime + dt : 0;
    if (restTime > 0.8 && t > 0.3) {
      sim.pause();
      sim.announce(main.bottom ? 'The block has reached the bottom.' : 'The block is at rest.');
    }
    sim.setTime(t);
  }
  function restart(s = main.s) {
    main = { s: clamp(s, sMin(), sMax()), v: 0, bottom: false };
    ghost = { s: main.s, v: 0, bottom: false };
    t = 0;
    restTime = 0;
    lastPt = -1;
    pts = [];
    gpts = [];
    graphDirty = true;
    sim.setTime(0);
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const A = (): Pt => (portrait() ? [48, 530] : [60, 530]);
  let K = 1;
  const fs = (px: number, w = 650) => font(px / K, w);
  /** Slope frame (u along the slope from the bottom, v along the outward normal, z depth) → design px. */
  function P(u: number, v: number, z: number): Pt {
    const c = Math.cos(th());
    const s = Math.sin(th());
    const [ax, ay] = A();
    return [ax + (u * c - v * s) * PPM + z * DX * PPM, ay + (-u * s - v * c) * PPM - z * DY * PPM];
  }
  /** World frame (x right, y up, z depth) → design px. */
  function Wp(x: number, y: number, z: number): Pt {
    const [ax, ay] = A();
    return [ax + x * PPM + z * DX * PPM, ay - y * PPM - z * DY * PPM];
  }
  const tDir = (): Pt => [Math.cos(th()), -Math.sin(th())]; // up the slope, screen
  const nDir = (): Pt => [-Math.sin(th()), -Math.cos(th())]; // outward normal, screen

  let areas: Area[] = [];
  const rectArea = (x: number, y: number, w: number, h: number, title: string, text: () => string) =>
    areas.push({ test: (px, py) => px >= x && px <= x + w && py >= y && py <= y + h, title, text });
  const circArea = (x: number, y: number, r: number, title: string, text: () => string) => areas.push({ test: (px, py) => Math.hypot(px - x, py - y) <= r, title, text });
  function polyArea(pts: Pt[], title: string, text: () => string) {
    areas.push({
      test: (x, y) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      },
      title,
      text,
    });
  }

  /* ---------- Drawing helpers ---------- */
  function fillPoly(pts: Pt[], fill: string, stroke?: string, lw = 1.5) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  function text(t: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
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
  function vec(x: number, y: number, dx: number, dy: number, color: string, label: string, dashed = false, w = 3.2) {
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    if (dashed) ctx.setLineDash([6, 5]);
    arrow(ctx, x, y, x + dx, y + dy, color, w, 11);
    ctx.setLineDash([]);
    if (label) {
      const ux = dx / len;
      const uy = dy / len;
      ctx.font = fs(12, 750);
      const tw = ctx.measureText(label).width;
      const lx = x + dx + ux * (10 + tw / 2);
      const ly = y + dy + uy * 12 + 4;
      ctx.fillStyle = withAlpha(pal['bg-elev'], 0.85);
      ctx.fillRect(lx - tw / 2 - 3, ly - 12, tw + 6, 16);
      text(label, lx, ly, 12, color, 'center', 750);
    }
  }
  const COL = () => ({ W: pal['accent-2'], N: pal.accent, f: pal.danger, comp: pal.warning, stop: pal['text-muted'] });

  /** Surface colour by roughness: icy blue → wood → rubber. */
  function surfaceColor() {
    const mu = p.muS;
    if (mu <= 0.12) return '#b9e3f5';
    if (mu <= 0.7) return '#c9a26b';
    return '#6b6b6b';
  }

  function drawBlock(b: Body, z0: number, alpha: number, selected: boolean) {
    const h = side() * 0.8;
    const u0 = b.s - hs();
    const u1 = b.s + hs();
    const z1 = z0 + BD;
    const front: Pt[] = [P(u0, 0, z0), P(u1, 0, z0), P(u1, h, z0), P(u0, h, z0)];
    const top: Pt[] = [P(u0, h, z0), P(u1, h, z0), P(u1, h, z1), P(u0, h, z1)];
    const right: Pt[] = [P(u1, 0, z0), P(u1, 0, z1), P(u1, h, z1), P(u1, h, z0)];
    ctx.globalAlpha = alpha;
    const base = alpha < 1 ? '#8fa6c8' : '#e8793a';
    fillPoly(right, shade(base, -0.25), withAlpha('#000000', 0.25), 1);
    fillPoly(top, shade(base, 0.18), withAlpha('#000000', 0.25), 1);
    fillPoly(front, base, selected ? pal.accent : withAlpha('#000000', 0.35), selected ? 3 : 1.2);
    ctx.globalAlpha = 1;
    return front;
  }
  function shade(hex: string, k: number) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v: number) => clamp(Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  /* ---------- Scene ---------- */
  let hoverBlock = false;
  function drawScene() {
    const c = Math.cos(th());
    const s = Math.sin(th());
    const [ax, ay] = A();
    // floor
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.12);
    const f0 = Wp(-0.6, 0, 0);
    const f1 = Wp(5.6, 0, 0);
    const f2 = Wp(5.6, 0, WD + 0.3);
    const f3 = Wp(-0.6, 0, WD + 0.3);
    fillPoly([f0, f1, f2, f3], withAlpha(pal['text-faint'], 0.1));
    // wedge
    const A0 = Wp(0, 0, 0);
    const B0 = Wp(L * c, 0, 0);
    const C0 = Wp(L * c, L * s, 0);
    const A1 = Wp(0, 0, WD);
    const B1 = Wp(L * c, 0, WD);
    const C1 = Wp(L * c, L * s, WD);
    fillPoly([B0, B1, C1, C0], shade('#7d8ca3', -0.25), withAlpha('#000', 0.3), 1);
    fillPoly([A0, C0, C1, A1], surfaceColor(), withAlpha('#000', 0.35), 1.2);
    // surface texture lines along the slope (ridges for rough surfaces)
    ctx.strokeStyle = withAlpha('#000000', p.muS > 0.12 ? 0.12 : 0.05);
    ctx.lineWidth = 1;
    for (let u = 0.25; u < L; u += 0.25) {
      const a = P(u, 0, 0);
      const b = P(u, 0, WD);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    // lane divider
    const ld0 = P(0, 0, (MAIN_Z + BD + GHOST_Z) / 2);
    const ld1 = P(L, 0, (MAIN_Z + BD + GHOST_Z) / 2);
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = withAlpha('#000000', 0.25);
    ctx.beginPath();
    ctx.moveTo(ld0[0], ld0[1]);
    ctx.lineTo(ld1[0], ld1[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    // stop at the bottom
    fillPoly([P(-0.08, 0, 0), P(0, 0, 0), P(0, 0.16, 0), P(-0.08, 0.16, 0)], pal['border-strong']);
    fillPoly([P(-0.08, 0.16, 0), P(0, 0.16, 0), P(0, 0.16, WD), P(-0.08, 0.16, WD)], shade('#7d8ca3', 0.2));
    // front face of the wedge
    fillPoly([A0, B0, C0], shade('#7d8ca3', 0.25), withAlpha('#000', 0.35), 1.2);
    // measurements
    if (p.meas) {
      const thc = Math.atan(p.muS);
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ax, ay, 70, -th(), 0);
      ctx.stroke();
      text(`θ = ${p.theta}°`, ax + 78 * Math.cos(th() / 2) + 26, ay - 78 * Math.sin(th() / 2) + 4, 13, pal['sim-text'], 'center', 750);
      if (thc < (75 * Math.PI) / 180) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = pal.danger;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(thc) * 200, ay - Math.sin(thc) * 200);
        ctx.stroke();
        ctx.setLineDash([]);
        text(`θc = ${((thc * 180) / Math.PI).toFixed(1)}°`, ax + Math.cos(thc) * 200 + 6, ay - Math.sin(thc) * 200 + 4, 11, pal.danger, 'left', 700);
      }
      // distance ticks along the slope
      for (let u = 1; u < L; u++) {
        const a = P(u, 0, 0);
        const b = P(u, -0.12, 0);
        ctx.strokeStyle = pal['text-muted'];
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        const q = P(u, -0.3, 0);
        text(`${u} m`, q[0], q[1] + 4, 10.5, pal['text-faint']);
      }
    }
    // blocks
    if (p.ghost) {
      drawBlock(ghost, GHOST_Z, 0.55, false);
      const gl = P(ghost.s, side() * 0.8 + 0.25, GHOST_Z + BD / 2);
      if (!portrait()) text('Frictionless', gl[0], gl[1], 11, pal['text-muted'], 'center', 700);
    }
    const front = drawBlock(main, MAIN_Z, 1, dragging || hoverBlock);
    const lbl = P(main.s, side() * 0.4, MAIN_Z);
    text(`${p.m} kg`, lbl[0], lbl[1] + 4, 12, '#ffffff', 'center', 800);
    // tilt handle at the top corner
    const H = handlePos();
    ctx.fillStyle = withAlpha(pal.accent, 0.25);
    ctx.beginPath();
    ctx.arc(H[0], H[1], 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(H[0], H[1], 8, 0, Math.PI * 2);
    ctx.fill();
    text('Drag to tilt', H[0] + 18, H[1] - 14, 11, pal.accent, 'left', 700);
    // forces on the block
    const f = forces(main);
    if (p.vec) {
      const ctr = P(main.s, side() * 0.4, MAIN_Z);
      const sc = 110 / f.W;
      const col = COL();
      const T = tDir();
      const Nn = nDir();
      vec(ctr[0], ctr[1], 0, f.W * sc, col.W, 'W');
      vec(ctr[0], ctr[1], Nn[0] * f.N * sc, Nn[1] * f.N * sc, col.N, 'N');
      if (Math.abs(f.f) > 1e-6) vec(ctr[0], ctr[1], T[0] * f.f * sc, T[1] * f.f * sc, col.f, f.kind === 'kinetic' ? 'fk' : 'fs');
      if (f.stop > 1e-6) vec(ctr[0], ctr[1], T[0] * f.stop * sc, T[1] * f.stop * sc, col.stop, 'Stop');
      if (p.comp && f.Wpar > 1e-6) {
        vec(ctr[0], ctr[1], -T[0] * f.Wpar * sc, -T[1] * f.Wpar * sc, col.comp, 'W∥', true, 2.4);
        vec(ctr[0], ctr[1], -Nn[0] * f.Wperp * sc, -Nn[1] * f.Wperp * sc, col.comp, 'W⊥', true, 2.4);
      }
      ctx.fillStyle = pal['sim-text'];
      ctx.beginPath();
      ctx.arc(ctr[0], ctr[1], 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!dragging && t === 0 && !sim.running) text(portrait() ? 'Drag the block, then let go' : 'Drag the block, then let go · tap anything to inspect it', 20, portrait() ? 574 : 30, 13, pal['text-muted'], 'left', 700);

    // inspect areas (generic first, specific last)
    polyArea([A0, C0, C1, A1], 'Slope surface', () => `Coefficient of static friction μs = ${p.muS.toFixed(2)}; kinetic μk = ${p.muK.toFixed(2)}. Friction acts along the surface, parallel to it. The rougher the surfaces in contact, the larger μ.`);
    polyArea([A0, B0, C0], 'Inclined plane', () => `A slope ${L} m long, tilted at ${p.theta}° to the horizontal. Its top is ${(L * s).toFixed(2)} m above the floor. Drag the blue handle at the top corner to tilt it.`);
    if (p.meas) circArea(ax + 40, ay - 20, 40, 'Angle and critical angle', () => `The block starts to slip when tan θ > μs, so the critical angle is θc = tan⁻¹(μs) = ${((Math.atan(p.muS) * 180) / Math.PI).toFixed(1)}°. It does not depend on the mass.`);
    if (p.ghost) polyArea(drawFront(ghost, GHOST_Z), 'Frictionless block', () => 'An identical block on a perfectly frictionless surface (μ = 0), released at the same moment. With no friction it can never stay still on a slope, and its acceleration is g sin θ.');
    polyArea(front, 'Block', () => `Mass ${p.m} kg, weight ${fmt(f.W)} N. The block is treated as a single point: it slides but does not tip or roll. Drag it to a new starting point.`);
  }
  function drawFront(b: Body, z0: number): Pt[] {
    const h = side() * 0.8;
    return [P(b.s - hs(), 0, z0), P(b.s + hs(), 0, z0), P(b.s + hs(), h, z0), P(b.s - hs(), h, z0)];
  }
  function handlePos(): Pt {
    return P(L, 0, 0);
  }

  /* ---------- Free-body diagram and equations ---------- */
  function drawFBD(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Free-body diagram', x + 14, y + 22, 13, pal['sim-text'], 'left', 750);
    if (!p.fbd) {
      text('Hidden (turn on in Display options)', x + w / 2, y + h / 2, 12, pal['text-faint']);
      return;
    }
    const f = forces(main);
    const cx = x + w / 2;
    const cy = y + h / 2 + 22;
    const sc = (Math.min(w, h) * 0.3) / f.W;
    const T = tDir();
    const Nn = nDir();
    // slope line and box
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.6);
    ctx.lineWidth = 1.5;
    const sx = (T[0] * w) / 2.4;
    const sy = (T[1] * w) / 2.4;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - sx - Nn[0] * 20, cy - sy - Nn[1] * 20);
    ctx.lineTo(cx + sx - Nn[0] * 20, cy + sy - Nn[1] * 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-th());
    ctx.fillStyle = withAlpha('#e8793a', 0.85);
    ctx.fillRect(-20, -20, 40, 40);
    ctx.restore();
    const col = COL();
    vec(cx, cy, 0, f.W * sc, col.W, `W ${fmt(f.W)} N`);
    vec(cx, cy, Nn[0] * f.N * sc, Nn[1] * f.N * sc, col.N, `N ${fmt(f.N)} N`);
    if (Math.abs(f.f) > 1e-6) vec(cx, cy, T[0] * f.f * sc, T[1] * f.f * sc, col.f, `${f.kind === 'kinetic' ? 'fk' : 'fs'} ${fmt(Math.abs(f.f))} N`);
    if (f.stop > 1e-6) vec(cx, cy, T[0] * f.stop * sc, T[1] * f.stop * sc, col.stop, `Stop ${fmt(f.stop)} N`);
    if (p.comp && f.Wpar > 1e-6) {
      vec(cx, cy, -T[0] * f.Wpar * sc, -T[1] * f.Wpar * sc, col.comp, `W∥ ${fmt(f.Wpar)}`, true, 2.2);
      vec(cx, cy, -Nn[0] * f.Wperp * sc, -Nn[1] * f.Wperp * sc, col.comp, `W⊥ ${fmt(f.Wperp)}`, true, 2.2);
    }
    text('Drawn to scale', x + 14, y + 22 + 15 / K, 10.5, pal['text-faint'], 'left', 600);
    rectArea(x, y, w, h, 'Free-body diagram', () => 'Every force on the block, drawn from one point and to scale. The weight W acts straight down. It can be split into W∥ (along the slope) and W⊥ (into the slope). The normal force N balances W⊥, so the motion is decided by W∥ and friction alone.');
  }

  function drawEquations(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    const f = forces(main);
    const sliding = main.v !== 0 || (!f.holds && !main.bottom);
    text('The calculation', x + 14, y + 22, 13, pal['sim-text'], 'left', 750);
    const lh = 15 / K;
    let yy = y + 22 + lh * 1.15;
    const line = (s: string, c = pal['sim-text'], wt = 600) => {
      text(s, x + 14, yy, 11.5, c, 'left', wt);
      yy += lh;
    };
    line(`W∥ = mg sin θ = ${fmt(f.Wpar)} N`);
    line(`N = mg cos θ = ${fmt(f.N)} N`);
    line(`fs,max = μs N = ${fmt(f.fsMax)} N`);
    if (main.v > 0) {
      line('Moving up the slope:', pal.danger, 700);
      line(`fk = μk N = ${fmt(p.muK * f.N)} N (down)`, pal.danger, 700);
      line('a = −g (sin θ + μk cos θ)', pal['sim-text'], 700);
      line(`a = ${fmt(-f.a, 2)} m/s² (down)`, pal['sim-text'], 700);
    } else if (sliding) {
      line('W∥ > fs,max, so it slides:', pal.danger, 700);
      line(`fk = μk N = ${fmt(p.muK * f.N)} N (up)`, pal.danger, 700);
      line('a = g (sin θ − μk cos θ)', pal['sim-text'], 700);
      line(`a = ${fmt(-f.a, 2)} m/s² (down)`, pal['sim-text'], 700);
    } else if (main.bottom && !f.holds) {
      line('W∥ > fs,max, but the', pal['text-muted'], 700);
      line('stop at the bottom holds it', pal['text-muted'], 700);
    } else {
      line('W∥ ≤ fs,max, so static', pal.success, 700);
      line('friction holds the block:', pal.success, 700);
      line(`fs = W∥ = ${fmt(f.Wpar)} N, a = 0`, pal['sim-text'], 700);
    }
    // friction meter
    const my = y + h - 46;
    const mx = x + 14;
    const mw = w - 28;
    const max = Math.max(f.Wpar, f.fsMax, 1e-6) * 1.15;
    text('Static friction needed vs available', mx, my - 10, 11, pal['text-muted'], 'left', 650);
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.18);
    ctx.fillRect(mx, my, mw, 14);
    ctx.fillStyle = f.holds ? pal.success : pal.danger;
    ctx.fillRect(mx, my, (mw * f.Wpar) / max, 14);
    const lx = mx + (mw * f.fsMax) / max;
    ctx.fillStyle = pal['sim-text'];
    ctx.fillRect(lx - 1.5, my - 5, 3, 24);
    text('needed W∥', mx, my + 30, 10.5, f.holds ? pal.success : pal.danger, 'left', 700);
    text('max μs N', clamp(lx, mx + 100 / K, mx + mw - 30), my + 30, 10.5, pal['sim-text'], 'center', 700);
    rectArea(x, y, w, h, 'The calculation', () => 'Static friction adjusts itself to match W∥, up to a maximum of μs N. If W∥ is larger than that, the block slips, and kinetic friction μk N then acts against the motion. The bar compares what is needed with what static friction can provide.');
  }

  /* ---------- Render ---------- */
  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    K = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    drawScene();
    if (portrait()) {
      drawFBD(10, 586, 320, 404);
      drawEquations(340, 586, 330, 404);
    } else {
      drawFBD(650, 68, 340, 224);
      drawEquations(650, 298, 340, 292);
    }
    ctx.restore();
    updateUi();
    if (graphDirty) drawGraph();
  }

  /* ---------- Graph ---------- */
  let graphDirty = true;
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ic-graph"]')!, {
    x: { min: 0, span: 3, step: 1, format: (v) => `${v}s` },
    y: { min: -4, max: 8, step: 2, format: (v) => `${v}` },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="ic-graph"]')!, graph, {
    currentId: 'v',
    label: () => `${p.theta}°, μs ${p.muS.toFixed(2)}, μk ${p.muK.toFixed(2)}`,
    onSave: () => restart(p.s0),
  });
  function drawGraph() {
    graphDirty = false;
    const all = [...pts, ...gpts].map((q) => q.y);
    const hi = Math.max(4, ...all);
    const lo = Math.min(0, ...all);
    const step = hi - lo > 12 ? 4 : 2;
    graph.opts.y = { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step, format: (v) => `${v}` };
    graph.set('v', { label: 'This run (m/s, down the slope +)', color: 'danger', points: pts });
    if (p.ghost) graph.set('g', { label: 'Frictionless', color: 'text-faint', points: gpts, dash: [6, 5] });
    else graph.remove('g');
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="ic-graph"]'));
  }

  /* ---------- Readouts ---------- */
  function stateText() {
    const f = forces(main);
    if (dragging) return 'Being placed';
    if (main.v === 0) {
      if (main.bottom) return 'At rest at the bottom';
      if (f.holds) return f.Wpar < 1e-9 ? 'At rest (level surface)' : 'At rest: static friction holds';
      return 'Starting to slide';
    }
    if (main.v > 0) return 'Sliding up, slowing down';
    return Math.abs(f.a) < 0.02 ? 'Sliding at constant velocity' : 'Sliding down, speeding up';
  }
  function updateUi() {
    const f = forces(main);
    ui.readout('acc', `${fmt(-f.a, 2)} m/s²`, Math.abs(f.a) > 0.005 ? 'warn' : null);
    ui.readout('normal', `${fmt(f.N)} N`);
    ui.readout('fric', f.kind === 'none' || Math.abs(f.f) < 1e-9 ? '0 N' : `${fmt(Math.abs(f.f))} N ${f.kind} (${f.f > 0 ? 'up' : 'down'} the slope)`);
    ui.readout('net', `${fmt(-f.net)} N`);
    ui.readout('vel', `${fmt(-main.v, 2)} m/s`);
    ui.readout('state', stateText(), main.v === 0 ? (main.bottom ? null : 'ok') : 'warn');
    sim.setBadge(stateText());
    canvas.setAttribute('aria-label', `Block of ${p.m} kg on a ${p.theta}° slope. ${stateText()}. Acceleration ${fmt(-f.a, 2)} metres per second squared down the slope.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const changed = () => {
    graphDirty = true;
    // tilting past the critical angle (or lowering μs) starts the slide straight away
    if (!sim.running && !dragging && moving(main)) {
      restTime = 0;
      sim.play();
    }
    sim.requestRender();
  };
  const angleCtl = ui.range('ic-angle', (v) => `${v}°`, (v) => {
    p.theta = v;
    main.s = clamp(main.s, sMin(), sMax());
    ghost.s = clamp(ghost.s, sMin(), sMax());
    if (!sim.running && t > 0) restTime = 0;
    changed();
  });
  ui.presets('ic-angle', angleCtl);
  const massCtl = ui.range('ic-mass', (v) => `${v} kg`, (v) => {
    p.m = v;
    main.s = clamp(main.s, sMin(), sMax());
    ghost.s = clamp(ghost.s, sMin(), sMax());
    changed();
  });
  let syncing = false;
  const muSCtl = ui.range('ic-mus', (v) => v.toFixed(2), (v) => {
    p.muS = v;
    if (!syncing && p.muK > v) {
      syncing = true;
      muKCtl.set(v);
      syncing = false;
    }
    changed();
  });
  const muKCtl = ui.range('ic-muk', (v) => v.toFixed(2), (v) => {
    p.muK = v;
    if (!syncing && p.muS < v) {
      syncing = true;
      muSCtl.set(v);
      syncing = false;
    }
    changed();
  });
  const SURF: Record<string, [number, number]> = { ice: [0.1, 0.03], wood: [0.5, 0.3], rubber: [1.0, 0.8], none: [0, 0] };
  root.querySelectorAll<HTMLButtonElement>('[data-surface]').forEach((b) =>
    b.addEventListener('click', () => {
      const [s, k] = SURF[b.dataset.surface!];
      syncing = true;
      muKCtl.set(0);
      muSCtl.set(s);
      muKCtl.set(k);
      syncing = false;
    }),
  );
  root.querySelector('[data-critical]')?.addEventListener('click', () => {
    const deg = Math.min(60, Math.ceil((Math.atan(p.muS) * 180) / Math.PI));
    angleCtl.set(deg);
  });
  const ghostCtl = ui.toggle('ic-ghost', (v) => {
    p.ghost = v;
    ghost = { ...main };
    gpts = [];
    changed();
  });
  const slowCtl = ui.toggle('ic-slow', (v) => (p.slow = v));
  const vecCtl = ui.toggle('ic-vec', (v) => ((p.vec = v), changed()));
  const compCtl = ui.toggle('ic-comp', (v) => ((p.comp = v), changed()));
  const measCtl = ui.toggle('ic-meas', (v) => ((p.meas = v), changed()));
  const fbdCtl = ui.toggle('ic-fbd', (v) => ((p.fbd = v), changed()));
  root.querySelector('[data-push]')?.addEventListener('click', () => {
    restart(main.s);
    if (main.s >= sMax() - 0.05) restart(sMin() + 0.5);
    main.v = 3;
    main.bottom = false;
    if (p.ghost) ghost.v = 3;
    sim.play();
  });
  root.querySelector('[data-release]')?.addEventListener('click', () => {
    restart(p.s0);
    sim.play();
  });
  root.querySelector('[data-step]')?.addEventListener('click', () => {
    sim.pause();
    step(0.05 / (p.slow ? 0.25 : 1));
    if (restTime > 0.8) restTime = 0;
    sim.requestRender();
  });

  /* ---------- Dragging ---------- */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  function nearestU(x: number, y: number) {
    // project the pointer onto the slope line of the front lane
    const a = P(0, side() * 0.4, MAIN_Z);
    const T = tDir();
    return ((x - a[0]) * T[0] + (y - a[1]) * T[1]) / PPM;
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
  let grabOffset = 0;
  enableDrag<'block' | 'tilt'>(canvas, {
    hit(x, y) {
      const [bx, by] = toBox(x, y);
      const H = handlePos();
      if (Math.hypot(bx - H[0], by - H[1]) < 26) return 'tilt';
      const fr = drawFront(main, MAIN_Z);
      const ctr = P(main.s, side() * 0.4, MAIN_Z);
      if (inPoly(fr, bx, by) || Math.hypot(bx - ctr[0], by - ctr[1]) < 34) return 'block';
      return null;
    },
    start(id, x, y) {
      sim.hideTooltip();
      if (id === 'block') {
        dragging = true;
        sim.pause();
        const [bx, by] = toBox(x, y);
        grabOffset = main.s - nearestU(bx, by);
      }
    },
    move(id, x, y) {
      const [bx, by] = toBox(x, y);
      if (id === 'tilt') {
        const [ax, ay] = A();
        const ang = (Math.atan2(ay - by, bx - ax) * 180) / Math.PI;
        angleCtl.set(Math.round(clamp(ang, 0, 60)));
      } else {
        const s = clamp(nearestU(bx, by) + grabOffset, sMin(), sMax());
        main = { s, v: 0, bottom: false };
        ghost = { s, v: 0, bottom: false };
        p.s0 = s;
        t = 0;
        pts = [];
        gpts = [];
        sim.setTime(0);
        changed();
      }
    },
    end(id) {
      if (id === 'block') {
        dragging = false;
        restart(main.s);
        sim.play();
      }
      changed();
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
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || dragging) return;
    const r = canvas.getBoundingClientRect();
    const [bx, by] = toBox(e.clientX - r.left, e.clientY - r.top);
    const over = inPoly(drawFront(main, MAIN_Z), bx, by);
    if (over !== hoverBlock) {
      hoverBlock = over;
      sim.requestRender();
    }
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(p, DEF);
      syncing = true;
      angleCtl.set(DEF.theta, false);
      massCtl.set(DEF.m, false);
      muSCtl.set(DEF.muS, false);
      muKCtl.set(DEF.muK, false);
      syncing = false;
      ghostCtl.set(DEF.ghost, false);
      slowCtl.set(DEF.slow, false);
      vecCtl.set(DEF.vec, false);
      compCtl.set(DEF.comp, false);
      measCtl.set(DEF.meas, false);
      fbdCtl.set(DEF.fbd, false);
      restart(DEF.s0);
      comparer.refresh();
    },
  });
  restart(DEF.s0);
  updateUi();
}
