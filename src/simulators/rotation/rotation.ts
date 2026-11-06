/**
 * Rotational motion, torque and angular momentum, in two views:
 *
 *   torque   – a wheel (solid disk, ring, or rod with two sliding masses) on a
 *              frictionless axle. A force F acts at distance r from the axis,
 *              at angle φ to the radius. The force is attached to the object
 *              (like a small thruster), so it turns with it and the torque
 *              stays constant:
 *                τ = r F sin φ   (counterclockwise positive)
 *                α = τ / I,  ω += α dt,  θ += ω dt
 *              Moments of inertia about the centre:
 *                solid disk  I = ½ M R²
 *                thin ring   I = M R²
 *                rod + masses I = (1/12) m_rod L² + 2 (M/2) d²
 *              Moving the rod's masses while it spins conserves L = I ω.
 *
 *   momentum – a person on a frictionless spinning stool. No external
 *              torque acts, so L = I ω stays constant: pulling the arms in
 *              lowers I and raises ω. The arms are modelled as uniform rods
 *              from the axis (I = ⅓ m r² each), dumbbells as point masses.
 *              Kinetic energy ½ I ω² = L² / 2I rises when the arms pull in,
 *              because the muscles do work.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'torque' | 'momentum';
type Obj = 'disk' | 'ring' | 'rod';
type Pt = [number, number];
const R = 0.5; // wheel radius and rod half-length (m)
const ROD_L = 1;
const ROD_M = 1;
const PPM = 380;
const FSCALE = 7; // px per newton
const R_NEAR = 0.1;
const R_FAR = 0.5;
const W_MAX = 50;
// spinning stool
const I_CORE = 1.2; // body + stool (kg m²)
const ARM_M = 3; // each arm (kg)
const DB_M = 2; // each dumbbell (kg)
const STOOL = { sc: 230, l: { base: 560 }, p: { base: 590 } };
const DEF = { view: 'torque' as View, obj: 'disk' as Obj, M: 10, d: 0.35, F: 10, phi: 90, r: 0.4, pb: 0, forceOn: true, extras: true, arm: 0.75, dumb: true };

interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}
const fmt = (v: number, d = 2) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`;
};
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function initRotation(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const p = { ...DEF };

  /* ---------- Torque model ---------- */
  let th = 0;
  let w = 0;
  let wN = 0;
  let thN = 0;
  let wF = 0;
  let thF = 0;
  let t = 0;
  const I = () => (p.obj === 'disk' ? 0.5 * p.M * R * R : p.obj === 'ring' ? p.M * R * R : (ROD_M * ROD_L * ROD_L) / 12 + 2 * (p.M / 2) * p.d * p.d);
  const phiRad = () => (p.phi * Math.PI) / 180;
  const torqueAt = (r: number) => (p.forceOn ? r * p.F * Math.sin(phiRad()) : 0);
  const tau = () => torqueAt(p.r);
  const alpha = () => tau() / I();

  /* ---------- Spinning stool model ---------- */
  let arm = DEF.arm;
  let armTarget = DEF.arm;
  let L = 0;
  let thS = 0;
  let ke0 = 0;
  const IS = (r = arm) => I_CORE + 2 * ((ARM_M * r * r) / 3 + (p.dumb ? DB_M * r * r : 0));
  const wS = () => L / IS();

  /* ---------- Graph data ---------- */
  let pts: Point[] = [];
  let lpts: Point[] = [];
  let ipts: Point[] = [];
  let lastPt = -1;
  let graphDirty = true;

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (p.view === 'torque') {
      const a = alpha();
      w += a * dt;
      th += w * dt;
      wN += (torqueAt(R_NEAR) / I()) * dt;
      thN += wN * dt;
      wF += (torqueAt(R_FAR) / I()) * dt;
      thF += wF * dt;
      if (Math.abs(w) > W_MAX || Math.abs(wF) > W_MAX * 2) {
        sim.pause();
        sim.announce('The wheel is spinning very fast. Press “Stop the wheel” or Reset.');
        tooFast = true;
      }
    } else {
      const sp = 1.0 * dt;
      arm += clamp(armTarget - arm, -sp, sp);
      thS += wS() * dt;
    }
    if (t - lastPt >= 0.05) {
      lastPt = t;
      if (p.view === 'torque') pts.push({ x: t, y: w });
      else {
        pts.push({ x: t, y: wS() });
        lpts.push({ x: t, y: L });
        ipts.push({ x: t, y: IS() });
      }
      graphDirty = true;
    }
    sim.setTime(t);
  }
  let tooFast = false;
  function restartTorque() {
    th = w = wN = thN = wF = thF = 0;
    t = 0;
    lastPt = -1;
    pts = [];
    tooFast = false;
    graphDirty = true;
    sim.setTime(0);
  }
  function restartStool(spin = 2.5) {
    thS = 0;
    t = 0;
    lastPt = -1;
    pts = [];
    lpts = [];
    ipts = [];
    L = IS() * spin;
    ke0 = (L * L) / (2 * IS());
    graphDirty = true;
    sim.setTime(0);
  }
  /** Change I while spinning freely: L = I ω is conserved. */
  function keepL(Iold: number) {
    if (w !== 0) w = (w * Iold) / I();
    if (wN !== 0) wN = (wN * Iold) / I();
    if (wF !== 0) wF = (wF * Iold) / I();
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1100] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let K = 1;
  const fs = (px: number, wt = 650) => font(px / K, wt);
  const C = (): Pt => (portrait() ? [340, 400] : [290, 320]);
  let areas: Area[] = [];
  const rectArea = (x: number, y: number, w: number, h: number, title: string, text: () => string) => areas.push({ test: (px, py) => px >= x && px <= x + w && py >= y && py <= y + h, title, text });
  const circArea = (x: number, y: number, r: number, title: string, text: () => string) => areas.push({ test: (px, py) => Math.hypot(px - x, py - y) <= r, title, text });

  /* ---------- Drawing helpers ---------- */
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
  /** Curved arrow around (cx, cy); a0 and span in maths radians (CCW positive). */
  function arcArrow(cx: number, cy: number, r: number, a0: number, span: number, color: string, lw = 4) {
    if (Math.abs(span) < 0.05) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -a0, -(a0 + span), span > 0);
    ctx.stroke();
    const ae = a0 + span;
    const ex = cx + r * Math.cos(ae);
    const ey = cy - r * Math.sin(ae);
    const sg = Math.sign(span);
    const tx = -Math.sin(ae) * sg;
    const ty = -Math.cos(ae) * sg;
    const nx = Math.cos(ae);
    const ny = -Math.sin(ae);
    const hl = 7 + lw * 1.6;
    ctx.beginPath();
    ctx.moveTo(ex + tx * hl, ey + ty * hl);
    ctx.lineTo(ex + nx * hl * 0.6, ey + ny * hl * 0.6);
    ctx.lineTo(ex - nx * hl * 0.6, ey - ny * hl * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  /** ⊙ (out of the screen) or ⊗ (into the screen). */
  function axisSymbol(x: number, y: number, out: boolean, color: string, r = 11) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (out) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const q = r * 0.6;
      ctx.beginPath();
      ctx.moveTo(x - q, y - q);
      ctx.lineTo(x + q, y + q);
      ctx.moveTo(x + q, y - q);
      ctx.lineTo(x - q, y + q);
      ctx.stroke();
    }
  }
  const COL = () => ({ F: pal.danger, tau: pal['accent-2'], w: pal.accent, a: pal.warning, L: pal.success });

  /* ======================= Torque view ======================= */
  function drawObject(cx: number, cy: number, rp: number, ang: number, obj: Obj, mini = false) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ang);
    const steel = '#7f93ad';
    if (obj === 'disk') {
      const g = ctx.createRadialGradient(-rp * 0.3, -rp * 0.3, rp * 0.1, 0, 0, rp);
      g.addColorStop(0, '#c4d0df');
      g.addColorStop(1, steel);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rp, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha('#2b3a4f', 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#2b3a4f', 0.35);
      ctx.lineWidth = mini ? 1.5 : 2.5;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rp * 0.12, Math.sin(a) * rp * 0.12);
        ctx.lineTo(Math.cos(a) * rp * 0.92, Math.sin(a) * rp * 0.92);
        ctx.stroke();
      }
    } else if (obj === 'ring') {
      ctx.strokeStyle = withAlpha('#5c6f88', 0.6);
      ctx.lineWidth = mini ? 1 : 1.5;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * rp, Math.sin(a) * rp);
        ctx.stroke();
      }
      ctx.strokeStyle = steel;
      ctx.lineWidth = mini ? 7 : 18;
      ctx.beginPath();
      ctx.arc(0, 0, rp - (mini ? 3.5 : 9), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#2b3a4f', 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, rp, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = steel;
      ctx.strokeStyle = withAlpha('#2b3a4f', 0.7);
      ctx.lineWidth = 2;
      const hw = mini ? 4 : 9;
      ctx.beginPath();
      ctx.roundRect(-rp, -hw, rp * 2, hw * 2, hw);
      ctx.fill();
      ctx.stroke();
      const mr = (mini ? 6 : 14) * Math.cbrt(Math.max(0.2, p.M / 2) / 2.5);
      for (const sgn of [-1, 1]) {
        const mx = (sgn * p.d * rp) / R;
        const g = ctx.createRadialGradient(mx - mr * 0.3, -mr * 0.3, mr * 0.1, mx, 0, mr);
        g.addColorStop(0, '#f7b267');
        g.addColorStop(1, '#c2410c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, 0, mr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // marker so the rotation is visible
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    ctx.arc(rp * (obj === 'rod' ? 0.95 : 0.8), 0, mini ? 3 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // axle
    ctx.fillStyle = '#2b3a4f';
    ctx.beginPath();
    ctx.arc(cx, cy, mini ? 4 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c4d0df';
    ctx.beginPath();
    ctx.arc(cx, cy, mini ? 1.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  /** Application point and force direction in screen coordinates. */
  function forceGeom(cx: number, cy: number, rp: number, r: number, ang: number) {
    const a = ang + p.pb;
    const P: Pt = [cx + ((r * rp) / R) * Math.cos(a), cy - ((r * rp) / R) * Math.sin(a)];
    const fa = a + phiRad();
    const dF: Pt = [Math.cos(fa), -Math.sin(fa)];
    return { P, dF, a };
  }
  let geo = { P: [0, 0] as Pt, tip: [0, 0] as Pt };

  function drawTorqueView() {
    const [cx, cy] = C();
    const rp = R * PPM;
    const col = COL();
    drawObject(cx, cy, rp, th, p.obj);
    const { P, dF } = forceGeom(cx, cy, rp, p.r, th);
    const fl = p.F * FSCALE;
    const tip: Pt = [P[0] + dF[0] * fl, P[1] + dF[1] * fl];
    geo = { P, tip };
    const ta = tau();
    // radius to the application point and the lever arm
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = withAlpha(pal['sim-text'], 0.6);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(P[0], P[1]);
    ctx.stroke();
    if (p.extras && p.F > 0 && p.r > 0) {
      // line of action and perpendicular from the axis
      ctx.strokeStyle = withAlpha(col.F, 0.45);
      ctx.beginPath();
      ctx.moveTo(P[0] - dF[0] * 260, P[1] - dF[1] * 260);
      ctx.lineTo(P[0] + dF[0] * 300, P[1] + dF[1] * 300);
      ctx.stroke();
      const d = (cx - P[0]) * dF[0] + (cy - P[1]) * dF[1];
      const foot: Pt = [P[0] + dF[0] * d, P[1] + dF[1] * d];
      const rperp = Math.hypot(foot[0] - cx, foot[1] - cy);
      if (rperp > 3) {
        ctx.setLineDash([]);
        ctx.strokeStyle = col.tau;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(foot[0], foot[1]);
        ctx.stroke();
        text(`r⊥ = ${fmt(p.r * Math.abs(Math.sin(phiRad())))} m`, (cx + foot[0]) / 2 + 8, (cy + foot[1]) / 2 - 8, 11.5, col.tau, 'left', 750);
      }
    }
    ctx.setLineDash([]);
    text(`r = ${fmt(p.r)} m`, (cx + P[0]) / 2 - 6, (cy + P[1]) / 2 + 18, 11.5, pal['sim-text'], 'right', 700);
    // ω and α arcs around the rim
    if (p.extras) {
      const wa = clamp(Math.abs(w) / 20, 0, 1) * 5 * Math.sign(w);
      arcArrow(cx, cy, rp + 24, Math.PI / 2, wa, col.w, 4);
      if (Math.abs(w) > 0.05) text(`ω`, cx + (rp + 24) * Math.cos(Math.PI / 2 + wa) + 14, cy - (rp + 24) * Math.sin(Math.PI / 2 + wa), 13, col.w, 'center', 800);
      const aa = alpha();
      const aspan = clamp(Math.abs(aa) / 10, 0, 1) * 2.5 * Math.sign(aa);
      arcArrow(cx, cy, rp + 44, -Math.PI / 2, aspan, col.a, 3);
      if (Math.abs(aa) > 0.01) text('α', cx + (rp + 44) * Math.cos(-Math.PI / 2 + aspan) + 12, cy - (rp + 44) * Math.sin(-Math.PI / 2 + aspan) + 4, 13, col.a, 'center', 800);
    }
    // torque arc and direction at the axle
    if (Math.abs(ta) > 1e-6) {
      const span = clamp(Math.abs(ta) / 10, 0.15, 1) * 4.5 * Math.sign(ta);
      arcArrow(cx, cy, 46, Math.PI * 0.75, span, col.tau, 5);
      axisSymbol(cx - 40, cy + 78, ta > 0, col.tau, 10);
      text(ta > 0 ? 'τ out of the screen (↺)' : 'τ into the screen (↻)', cx - 24, cy + 82, 11, col.tau, 'left', 700);
    }
    // force arrow and handles
    if (p.F > 0) arrow(ctx, P[0], P[1], tip[0], tip[1], p.forceOn ? col.F : withAlpha(col.F, 0.35), 4.5, 15);
    ctx.fillStyle = withAlpha(col.F, 0.25);
    ctx.beginPath();
    ctx.arc(P[0], P[1], 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col.F;
    ctx.beginPath();
    ctx.arc(P[0], P[1], 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.F;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 11, 0, Math.PI * 2);
    ctx.stroke();
    text(`F = ${fmt(p.F, 1)} N`, tip[0] + dF[0] * 22, tip[1] + dF[1] * 22 + 4, 12, col.F, 'center', 800);
    // equations
    const P1 = portrait();
    const x0 = P1 ? 14 : 16;
    const y0 = P1 ? 118 : 26;
    text(`τ = r F sin φ = ${fmt(p.r)} × ${fmt(p.F, 1)} × sin ${p.phi}° = ${fmt(ta)} N·m`, x0, y0, P1 ? 11 : 12, pal['sim-text'], 'left', 700);
    text(`α = τ ÷ I = ${fmt(ta)} ÷ ${fmt(I(), 3)} = ${fmt(alpha())} rad/s²`, x0, y0 + (P1 ? 28 : 22), P1 ? 11 : 12, pal['sim-text'], 'left', 700);
    if (!p.forceOn) text('Force switched off: no torque, so ω stays constant', x0, y0 + (P1 ? 56 : 44), 11.5, pal.warning, 'left', 700);
    if (tooFast) text('Very fast! Stop the wheel or press Reset', cx, cy + rp + 70, 13, pal.danger, 'center', 800);

    circArea(cx, cy, 16, 'Axis of rotation', () => 'The wheel turns about this fixed axle, which points straight out of the screen. The axle is frictionless in this model, so with no force the wheel keeps turning at a constant ω.');
    circArea(cx, cy, rp, p.obj === 'disk' ? 'Solid disk' : p.obj === 'ring' ? 'Ring (hoop)' : 'Rod with sliding masses', () =>
      p.obj === 'disk'
        ? `Mass spread evenly from the centre to the rim: I = ½MR² = ${fmt(I(), 3)} kg·m².`
        : p.obj === 'ring'
          ? `All the mass at the rim (the spokes are treated as massless): I = MR² = ${fmt(I(), 3)} kg·m², twice the disk’s. It is harder to spin up.`
          : `A 1 kg rod plus two masses of ${fmt(p.M / 2, 1)} kg at ${fmt(p.d)} m from the axis: I = (1/12)mL² + 2md² = ${fmt(I(), 3)} kg·m². Drag a mass to move both.`);
    circArea(P[0], P[1], 20, 'Point where the force acts', () => `At r = ${fmt(p.r)} m from the axis. Drag it to move it. The force is attached to the object, so it turns with it and keeps the same angle φ = ${p.phi}° to the radius.`);
    circArea(tip[0], tip[1], 20, 'Force', () => `F = ${fmt(p.F, 1)} N at φ = ${p.phi}° to the radius. Drag the tip of the arrow to change its size and direction. Only the part perpendicular to the radius, F sin φ, turns the wheel.`);
  }

  function drawNearFar(x: number, y: number, w0: number, h: number) {
    panel(x, y, w0, h);
    const vertical = h > w0;
    text('Same force: near vs far', x + 14, y + 22, 12.5, pal['sim-text'], 'left', 750);
    const items: [number, number, number, string][] = [
      [R_NEAR, thN, wN, 'Near the axis'],
      [R_FAR, thF, wF, 'At the rim'],
    ];
    const rp = vertical ? Math.min(w0 * 0.2, (h - 40) * 0.18) : Math.min((h - 40) * 0.3, w0 * 0.14);
    items.forEach(([r, ang, om, lab], i) => {
      const cx = vertical ? x + 18 + rp : x + w0 * (i === 0 ? 0.25 : 0.75);
      const cyy = vertical ? y + 40 + ((h - 40) * (i + 0.5)) / 2 : y + 40 + rp + 8;
      drawObject(cx, cyy, rp, ang, p.obj, true);
      const { P, dF } = forceGeom(cx, cyy, rp, r, ang);
      if (p.F > 0) arrow(ctx, P[0], P[1], P[0] + dF[0] * p.F * 2.2, P[1] + dF[1] * p.F * 2.2, p.forceOn ? pal.danger : withAlpha(pal.danger, 0.35), 2.5, 8);
      const lines = [lab, `r = ${fmt(r, 1)} m`, `τ = ${fmt(torqueAt(r))} N·m`, `ω = ${fmt(om, 1)} rad/s`];
      const lx = vertical ? cx + rp + 22 : cx;
      let ly = vertical ? cyy - 24 / K : cyy + rp + 24;
      lines.forEach((ln, j) => {
        text(ln, lx, ly, j === 0 ? 12.5 : 11.5, j === 0 ? pal['sim-text'] : j === 3 ? pal.accent : pal['text-muted'], vertical ? 'left' : 'center', j === 0 ? 750 : 650);
        ly += 16 / K;
      });
    });
    rectArea(x, y, w0, h, 'Near vs far', () => `The same ${fmt(p.F, 1)} N force at 0.1 m and at 0.5 m from the axis. Five times the distance gives five times the torque, so the rim wheel speeds up five times faster. This is why door handles are far from the hinges.`);
  }

  /* ======================= Spinning stool view ======================= */
  function drawStool(cx: number, base: number, sc: number) {
    const ang = thS;
    const col = COL();
    const depth = 0.38;
    // platform
    ctx.fillStyle = withAlpha('#7f93ad', 0.35);
    ctx.beginPath();
    ctx.ellipse(cx, base, 0.75 * sc, 0.75 * sc * depth, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#2b3a4f', 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
    // rotating marks on the platform
    for (let k = 0; k < 6; k++) {
      const a = ang + (k * Math.PI) / 3;
      const mx = cx + Math.cos(a) * 0.62 * sc;
      const my = base + Math.sin(a) * 0.62 * sc * depth;
      ctx.fillStyle = k === 0 ? pal.danger : withAlpha('#2b3a4f', 0.5);
      ctx.beginPath();
      ctx.ellipse(mx, my, 6, 6 * depth + 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // stool post and seat
    ctx.fillStyle = '#5c6f88';
    ctx.fillRect(cx - 7, base - 0.55 * sc, 14, 0.55 * sc);
    ctx.fillStyle = '#7f93ad';
    ctx.beginPath();
    ctx.ellipse(cx, base - 0.55 * sc, 0.22 * sc, 0.22 * sc * depth, 0, 0, Math.PI * 2);
    ctx.fill();
    // person (seated, facing the viewer when ang = 0)
    const shoulderY = base - 1.25 * sc;
    const hipY = base - 0.62 * sc;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const shoulderW = 0.2;
    const hands: { x: number; y: number; z: number }[] = [];
    const sh: { x: number; y: number; z: number }[] = [];
    for (const sg of [-1, 1]) {
      const dx = ca * sg;
      const dz = sa * sg;
      sh.push({ x: cx + dx * shoulderW * sc, y: shoulderY + dz * shoulderW * sc * depth, z: dz });
      hands.push({ x: cx + dx * arm * sc, y: shoulderY + 0.06 * sc + dz * arm * sc * depth, z: dz });
    }
    const limb = (a: { x: number; y: number }, b: { x: number; y: number }, wdt: number, c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = wdt;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const skin = '#e0ac82';
    const shirt = '#3b82c4';
    const drawArm = (i: number) => {
      limb(sh[i], hands[i], 0.09 * sc, shirt);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(hands[i].x, hands[i].y, 0.05 * sc, 0, Math.PI * 2);
      ctx.fill();
      if (p.dumb) {
        ctx.fillStyle = '#2b2b2b';
        const s = 0.075 * sc * (1 + hands[i].z * 0.12);
        ctx.beginPath();
        ctx.arc(hands[i].x, hands[i].y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const back = sh[0].z < sh[1].z ? 0 : 1;
    drawArm(back);
    // legs
    limb({ x: cx - 0.08 * sc, y: hipY }, { x: cx - 0.1 * sc + sa * 0.12 * sc, y: base - 0.2 * sc }, 0.1 * sc, '#384a63');
    limb({ x: cx + 0.08 * sc, y: hipY }, { x: cx + 0.1 * sc + sa * 0.12 * sc, y: base - 0.2 * sc }, 0.1 * sc, '#384a63');
    // torso
    const tw = (0.2 + 0.1 * Math.abs(ca)) * sc;
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, shoulderY - 0.04 * sc, tw, hipY - shoulderY + 0.08 * sc, 0.08 * sc);
    ctx.fill();
    // head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(cx, shoulderY - 0.17 * sc, 0.12 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3426';
    ctx.beginPath();
    ctx.arc(cx, shoulderY - 0.2 * sc, 0.12 * sc, Math.PI, 0);
    ctx.fill();
    if (Math.sin(ang) < 0.3) {
      // face visible: eyes
      ctx.fillStyle = '#222';
      for (const e of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + (e * 0.04 + ca * 0) * sc + -sa * 0.05 * sc, shoulderY - 0.16 * sc, 0.012 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawArm(1 - back);
    // axis and angular momentum vector (up)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = withAlpha(pal['sim-text'], 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, base + 30);
    ctx.lineTo(cx, shoulderY - 0.4 * sc);
    ctx.stroke();
    ctx.setLineDash([]);
    const Lp = clamp(L / 15, 0, 1) * (portrait() ? 0.42 : 0.6) * sc;
    if (Lp > 4) {
      arrow(ctx, cx, shoulderY - 0.32 * sc, cx, shoulderY - 0.32 * sc - Lp, col.L, 5, 13);
      text(`L = ${fmt(L)} kg·m²/s`, cx + 14, shoulderY - 0.32 * sc - Lp + 6, 12, col.L, 'left', 800);
    }
    // ω arc around the axis
    const om = wS();
    if (Math.abs(om) > 0.05) {
      const span = clamp(Math.abs(om) / 10, 0.1, 1) * 4.5;
      ctx.save();
      ctx.translate(cx, base);
      ctx.scale(1, depth);
      arcArrow(0, 0, 0.9 * sc, Math.PI * 1.1, -span, col.w, 4 / depth);
      ctx.restore();
    }
    hand = hands[1];
    circArea(cx, shoulderY + 0.3 * sc, 0.25 * sc, 'Person on a spinning stool', () => 'The stool turns on a frictionless bearing, so no outside torque acts on the person and stool. Their angular momentum L = Iω must stay the same, whatever they do with their arms.');
    circArea(hands[0].x, hands[0].y, 26, p.dumb ? 'Dumbbell' : 'Hand', () => `Each hand is ${fmt(arm)} m from the axis${p.dumb ? `, holding a ${DB_M} kg dumbbell` : ''}. Drag a hand to move the arms in or out. Mass far from the axis adds a lot to I, because I grows with r².`);
    circArea(hands[1].x, hands[1].y, 26, p.dumb ? 'Dumbbell' : 'Hand', () => `Each hand is ${fmt(arm)} m from the axis${p.dumb ? `, holding a ${DB_M} kg dumbbell` : ''}. Drag a hand to move the arms in or out.`);
  }
  let hand = { x: 0, y: 0, z: 0 };

  function drawBars(x: number, y: number, w0: number, h: number) {
    panel(x, y, w0, h);
    text('What changes, and what stays the same', x + 14, y + 22, 12.5, pal['sim-text'], 'left', 750);
    const om = wS();
    const ke = (L * L) / (2 * IS());
    const bars: [string, number, number, string, string][] = [
      ['Moment of inertia I', IS(), 6, `${fmt(IS(), 2)} kg·m²`, pal['accent-2']],
      ['Angular velocity ω', om, 12, `${fmt(om, 2)} rad/s (${fmt((om * 60) / (2 * Math.PI), 0)} rpm)`, pal.accent],
      ['Angular momentum L = Iω', L, 16, `${fmt(L, 2)} kg·m²/s (constant)`, pal.success],
      ['Kinetic energy ½Iω²', ke, 60, `${fmt(ke, 1)} J`, pal.warning],
    ];
    const showMsg = !portrait();
    const bh = (h - 44 - (showMsg ? 80 : 0)) / bars.length;
    bars.forEach(([lab, v, max, vt, c], i) => {
      const yy = y + 36 + i * bh;
      text(lab, x + 14, yy + 14 / K, 12, pal['sim-text'], 'left', 700);
      const bw = w0 - 28;
      const by = yy + 20 / K;
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.16);
      ctx.fillRect(x + 14, by, bw, 8 / K);
      ctx.fillStyle = c;
      ctx.fillRect(x + 14, by, bw * clamp(Math.abs(v) / max, 0, 1), 8 / K);
      text(vt, x + 14, by + 8 / K + 15 / K, 11.5, pal['text-muted'], 'left', 650);
    });
    if (!showMsg) {
      rectArea(x, y, w0, h, 'Conservation of angular momentum', () => 'With no outside torque, L = Iω is constant. If I falls to a third, ω triples. Kinetic energy ½Iω² is not conserved: it increases when the arms pull in, because the muscles do work, and decreases when they move out.');
      return;
    }
    ctx.font = fs(11.5, 600);
    ctx.fillStyle = pal['text-muted'];
    const msg = `L = I ω = ${fmt(IS(), 2)} × ${fmt(om, 2)} = ${fmt(L, 2)}. Pulling the arms in lowers I, so ω must rise. KE has changed by ${fmt(ke - ke0, 1)} J: the arms did work pulling the masses in.`;
    let yy = y + h - 64;
    let line = '';
    for (const wd of msg.split(' ')) {
      const test = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(test).width > w0 - 28 && line) {
        ctx.fillText(line, x + 14, yy);
        line = wd;
        yy += 15 / K;
      } else line = test;
    }
    if (line) ctx.fillText(line, x + 14, yy);
    rectArea(x, y, w0, h, 'Conservation of angular momentum', () => 'With no outside torque, L = Iω is constant. If I falls to a third, ω triples. Kinetic energy ½Iω² is not conserved: it increases when the arms pull in, because the muscles do work, and decreases when they move out.');
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
    const P1 = portrait();
    if (p.view === 'torque') {
      if (P1) drawNearFar(10, 664, 660, 426);
      else drawNearFar(600, 60, 390, 530);
      drawTorqueView();
    } else {
      if (P1) {
        drawStool(340, STOOL.p.base, STOOL.sc);
        drawBars(10, 610, 660, 480);
      } else {
        drawStool(300, STOOL.l.base, STOOL.sc);
        drawBars(580, 60, 410, 532);
      }
      const P2 = P1 ? 14 : 16;
      text(`L = I ω = ${fmt(IS(), 2)} × ${fmt(wS(), 2)} = ${fmt(L, 2)} kg·m²/s`, P2, P1 ? 116 : 26, P1 ? 11 : 12, pal['sim-text'], 'left', 700);
      if (!P1) text(`I = I_body + 2(⅓ m_arm r² ${p.dumb ? '+ m_db r²' : ''}), r = ${fmt(arm)} m`, P2, 48, 12, pal['text-muted'], 'left', 650);
    }
    ctx.restore();
    updateUi();
    if (graphDirty) drawGraph();
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="rt-graph"]')!, {
    x: { min: 0, span: 10, step: 2, format: (v) => `${v}s` },
    y: { min: 0, max: 20, step: 5, format: (v) => `${v}` },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="rt-graph"]')!, graph, {
    currentId: 'w',
    label: () => (p.view === 'torque' ? `${p.obj}, r ${fmt(p.r)} m, F ${fmt(p.F, 0)} N, φ ${p.phi}°` : `arms ${fmt(arm)} m${p.dumb ? ', dumbbells' : ''}`),
    onSave: () => (p.view === 'torque' ? restartTorque() : restartStool(wS())),
  });
  function drawGraph() {
    graphDirty = false;
    const vals = [...pts, ...lpts, ...ipts].map((q) => q.y);
    const hi = Math.max(5, ...vals);
    const lo = Math.min(0, ...vals);
    const st = hi - lo > 40 ? 10 : 5;
    graph.opts.y = { min: Math.floor(lo / st) * st, max: Math.ceil(hi / st) * st, step: st, format: (v) => `${v}` };
    graph.set('w', { label: 'ω (rad/s)', color: 'accent', points: pts });
    if (p.view === 'momentum') {
      graph.set('L', { label: 'L (kg·m²/s)', color: 'success', points: lpts });
      graph.set('I', { label: 'I (kg·m²)', color: 'accent-2', points: ipts, dash: [6, 5] });
    } else {
      graph.remove('L');
      graph.remove('I');
    }
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="rt-graph"]'));
  }

  /* ---------- Readouts ---------- */
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note: string;
    if (p.view === 'torque') {
      const ta = tau();
      r('r1', 'Torque τ', `${fmt(ta)} N·m ${Math.abs(ta) < 1e-6 ? '' : ta > 0 ? '(counterclockwise)' : '(clockwise)'}`);
      r('r2', 'Lever arm r⊥ = r sin φ', `${fmt(p.r * Math.abs(Math.sin(phiRad())))} m`);
      r('r3', 'Moment of inertia I', `${fmt(I(), 3)} kg·m²`);
      r('r4', 'Angular acceleration α', `${fmt(alpha())} rad/s²`, Math.abs(alpha()) > 1e-6 ? 'warn' : null);
      r('r5', 'Angular velocity ω', `${fmt(w)} rad/s (${fmt((w * 60) / (2 * Math.PI), 0)} rpm)`);
      r('r6', 'Angular momentum L = Iω', `${fmt(I() * w)} kg·m²/s`);
      const cells: Record<string, string> = {
        th: `${fmt(th, 1)} rad`,
        w: `${fmt(w)} rad/s`,
        a: `${fmt(alpha())} rad/s²`,
        I: `${fmt(I(), 3)} kg·m²`,
        tau: `${fmt(ta)} N·m`,
        L: `${fmt(I() * w)} kg·m²/s`,
        ke: `${fmt(0.5 * I() * w * w, 1)} J`,
      };
      for (const [k, v] of Object.entries(cells)) {
        const el = tableCells.get(k);
        if (el && el.textContent !== v) el.textContent = v;
      }
      sim.setBadge(Math.abs(ta) < 1e-6 ? (p.forceOn && p.F > 0 && p.r > 0 ? 'No torque: force points through the axis' : 'No torque') : `τ = ${fmt(ta)} N·m ${ta > 0 ? '↺' : '↻'}`);
      note =
        !p.forceOn
          ? 'The force is off. With no torque and a frictionless axle, the wheel keeps turning at a constant angular velocity: Newton’s first law for rotation.'
          : p.r === 0 || p.F === 0
            ? 'There is no torque: the force is zero or acts at the axis itself.'
            : Math.abs(Math.sin(phiRad())) < 0.02
              ? 'The force points along the radius, straight through the axis. Its lever arm is zero, so it produces no torque, however large it is.'
              : `The torque τ = r F sin φ = ${fmt(ta)} N·m gives an angular acceleration α = τ/I = ${fmt(alpha())} rad/s², so ω ${ta * (w || 1) >= 0 ? 'increases' : 'decreases'} steadily. ${p.obj === 'ring' ? 'The ring has all its mass at the rim, so its I is twice the disk’s.' : p.obj === 'rod' ? 'Slide the masses outwards to raise I and lower α.' : 'Try the ring with the same mass: its larger I gives a smaller α.'}`;
      canvas.setAttribute('aria-label', `A ${p.obj} with a ${fmt(p.F, 1)} newton force at ${fmt(p.r)} metres and ${p.phi} degrees to the radius. Torque ${fmt(ta)} newton metres, angular velocity ${fmt(w)} radians per second.`);
    } else {
      const om = wS();
      const ke = (L * L) / (2 * IS());
      r('r1', 'Hands from the axis r', `${fmt(arm)} m`);
      r('r2', 'Moment of inertia I', `${fmt(IS(), 2)} kg·m²`);
      r('r3', 'Angular velocity ω', `${fmt(om)} rad/s (${fmt((om * 60) / (2 * Math.PI), 0)} rpm)`, 'warn');
      r('r4', 'Angular momentum L', `${fmt(L)} kg·m²/s`, 'ok');
      r('r5', 'Kinetic energy', `${fmt(ke, 1)} J`);
      r('r6', 'Change in KE since the spin', `${ke - ke0 >= 0 ? '+' : ''}${fmt(ke - ke0, 1)} J`);
      sim.setBadge(`ω = ${fmt(om)} rad/s`);
      note =
        L === 0
          ? 'Press “Give a spin” to set the stool turning.'
          : arm < 0.35
            ? `Arms in: I is small (${fmt(IS(), 2)} kg·m²), so the person spins fast. L has not changed: no outside torque acted.`
            : arm > 0.65
              ? `Arms out: the mass is far from the axis, so I is large (${fmt(IS(), 2)} kg·m²) and the spin is slow. Now pull the arms in.`
              : 'Moving the arms changes I. Because L = Iω stays constant, ω changes in the opposite way.';
      canvas.setAttribute('aria-label', `Person on a spinning stool, hands ${fmt(arm)} metres from the axis, spinning at ${fmt(om)} radians per second. Angular momentum ${fmt(L)}.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ---------- Controls ---------- */
  const tableCells = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-tv]').forEach((el) => tableCells.set(el.dataset.tv!, el));
  const ui = controls(root);
  const changed = () => {
    graphDirty = true;
    sim.requestRender();
  };
  const showFor = () => {
    ui.showWhen('[data-only="torque"]', p.view === 'torque');
    ui.showWhen('[data-only="momentum"]', p.view === 'momentum');
    ui.showWhen('[data-only="rod"]', p.view === 'torque' && p.obj === 'rod');
  };
  const viewCtl = ui.choice<View>('rt-view', (v) => {
    p.view = v;
    sim.pause();
    sim.hideTooltip();
    showFor();
    if (v === 'torque') restartTorque();
    else restartStool();
    comparer.refresh();
    changed();
  });
  const objCtl = ui.choice<Obj>('rt-obj', (v) => {
    p.obj = v;
    if (v === 'rod') p.pb = Math.abs(wrapPi(p.pb)) < Math.PI / 2 ? 0 : Math.PI;
    restartTorque();
    showFor();
    changed();
  });
  const massCtl = ui.range('rt-mass', (v) => `${v} kg`, (v) => {
    const old = I();
    p.M = v;
    keepL(old);
    changed();
  });
  const dCtl = ui.range('rt-d', (v) => `${v.toFixed(2)} m`, (v) => {
    const old = I();
    p.d = v;
    keepL(old);
    changed();
  });
  const fCtl = ui.range('rt-force', (v) => `${v} N`, (v) => ((p.F = v), changed()));
  const phiCtl = ui.range('rt-phi', (v) => `${v}°`, (v) => ((p.phi = v), changed()));
  ui.presets('rt-phi', phiCtl);
  const rCtl = ui.range('rt-r', (v) => `${v.toFixed(2)} m`, (v) => ((p.r = v), changed()));
  ui.presets('rt-r', rCtl);
  const onCtl = ui.toggle('rt-on', (v) => ((p.forceOn = v), changed()));
  const exCtl = ui.toggle('rt-extras', (v) => ((p.extras = v), changed()));
  root.querySelector('[data-stopwheel]')?.addEventListener('click', () => {
    restartTorque();
    changed();
  });
  const armCtl = ui.range('rt-arm', (v) => `${v.toFixed(2)} m`, (v) => {
    armTarget = v;
    if (!sim.running) {
      arm = v; // paused: move at once (L still conserved)
      if (L !== 0) graphDirty = true;
    }
    changed();
  });
  ui.presets('rt-arm', armCtl);
  const dumbCtl = ui.toggle('rt-dumb', (v) => {
    const om = wS();
    p.dumb = v;
    L = IS() * om; // letting go (or picking up) at the same spin rate
    ke0 = (L * L) / (2 * IS());
    changed();
  });
  root.querySelector('[data-spin]')?.addEventListener('click', () => {
    restartStool(2.5);
    sim.play();
    changed();
  });
  root.querySelector('[data-stopstool]')?.addEventListener('click', () => {
    restartStool(0);
    changed();
  });

  /* ---------- Dragging ---------- */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  type DragId = 'point' | 'tip' | 'mass' | 'hand';
  enableDrag<DragId>(canvas, {
    hit(x, y) {
      const [bx, by] = toBox(x, y);
      if (p.view === 'momentum') return Math.hypot(bx - hand.x, by - hand.y) < 34 || areas.some((a) => a.title.match(/Dumbbell|Hand/) && a.test(bx, by)) ? 'hand' : null;
      if (Math.hypot(bx - geo.tip[0], by - geo.tip[1]) < 24) return 'tip';
      if (Math.hypot(bx - geo.P[0], by - geo.P[1]) < 24) return 'point';
      if (p.obj === 'rod') {
        const [cx, cy] = C();
        for (const sg of [-1, 1]) {
          const mx = cx + sg * ((p.d * PPM) / 1) * Math.cos(th);
          const my = cy - sg * p.d * PPM * Math.sin(th);
          if (Math.hypot(bx - mx, by - my) < 26) return 'mass';
        }
      }
      return null;
    },
    start() {
      sim.hideTooltip();
    },
    move(id, x, y) {
      const [bx, by] = toBox(x, y);
      if (id === 'hand') {
        const cx = portrait() ? 340 : 300;
        const base = portrait() ? STOOL.p.base : STOOL.l.base;
        const hy = base - 1.19 * STOOL.sc;
        const r = clamp(Math.hypot(bx - cx, (by - hy) / 0.38) / STOOL.sc, 0.2, 0.8);
        armCtl.set(Math.round(r * 20) / 20);
        return;
      }
      const [cx, cy] = C();
      const dx = (bx - cx) / PPM;
      const dy = -(by - cy) / PPM;
      if (id === 'point') {
        if (p.obj === 'rod') {
          const s = dx * Math.cos(th) + dy * Math.sin(th);
          p.pb = s >= 0 ? 0 : Math.PI;
          rCtl.set(Math.round(clamp(Math.abs(s), 0, R) * 100) / 100);
        } else {
          p.pb = wrapPi(Math.atan2(dy, dx) - th);
          rCtl.set(Math.round(clamp(Math.hypot(dx, dy), 0, R) * 100) / 100);
        }
      } else if (id === 'tip') {
        const vx = bx - geo.P[0];
        const vy = -(by - geo.P[1]);
        fCtl.set(Math.round(clamp(Math.hypot(vx, vy) / FSCALE, 0, 20)));
        const a = th + p.pb;
        let ph = (wrapPi(Math.atan2(vy, vx) - a) * 180) / Math.PI;
        ph = Math.round(ph / 5) * 5;
        if (ph <= -180) ph += 360;
        phiCtl.set(ph);
      } else if (id === 'mass') {
        const s = Math.abs(dx * Math.cos(th) + dy * Math.sin(th));
        dCtl.set(Math.round(clamp(s, 0.05, 0.45) * 100) / 100);
      }
    },
    end() {
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

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(p, DEF);
      viewCtl.set(DEF.view, false);
      objCtl.set(DEF.obj, false);
      massCtl.set(DEF.M, false);
      dCtl.set(DEF.d, false);
      fCtl.set(DEF.F, false);
      phiCtl.set(DEF.phi, false);
      rCtl.set(DEF.r, false);
      onCtl.set(DEF.forceOn, false);
      exCtl.set(DEF.extras, false);
      armCtl.set(DEF.arm, false);
      dumbCtl.set(DEF.dumb, false);
      arm = armTarget = DEF.arm;
      showFor();
      restartTorque();
      restartStool();
      comparer.refresh();
    },
  });
  restartTorque();
  restartStool();
  showFor();
  updateUi();
}
