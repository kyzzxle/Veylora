/**
 * Phototropism and gravitropism.
 * The shoot and root grow by adding small segments at their tips. Each new
 * segment turns gradually toward a target direction:
 *   shoot: weighted mix of "toward the light" and "away from gravity"
 *   root:  "toward gravity" (positive gravitropism)
 * Only the growing tip bends; older parts are fixed, as in real plants.
 * The plant is stored in the pot's own frame so tilting the pot tilts the
 * existing plant, and new growth then curves back. A clinostat rotates the
 * pot continuously so gravity has no consistent direction.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { pill } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'sim-wall', 'warning'] as const;
const SEG = 4; // px per growth segment
const MAX_SHOOT = 70;
const MAX_ROOT = 45;
const DEF = { light: 60, lamp: true, tilt: 0, clino: false, auxin: true };

type Vec = { x: number; y: number };
const rot = (v: Vec, a: number): Vec => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const norm = (v: Vec): Vec => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

export function initTropisms(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  // Plant points in the pot frame (origin at the seed, +y downward, pot upright)
  let shoot: Vec[] = [];
  let rootPts: Vec[] = [];
  let day = 0;
  let clinoAngle = 0;
  let acc = 0;

  const potAngle = () => (p.tilt * Math.PI) / 180 + (p.clino ? clinoAngle : 0);
  const centre = () => ({ x: size.w / 2, y: size.h * 0.55 });
  const toWorld = (v: Vec): Vec => {
    const c = centre();
    const r = rot(v, potAngle());
    return { x: c.x + r.x, y: c.y + r.y };
  };
  const lampPos = (): Vec => {
    const c = centre();
    const a = (p.light * Math.PI) / 180;
    const R = Math.min(size.w, size.h) * 0.44;
    return { x: c.x + Math.sin(a) * R, y: c.y - Math.cos(a) * R - 20 };
  };

  function restart() {
    shoot = [{ x: 0, y: 0 }, { x: 0, y: -SEG }];
    rootPts = [{ x: 0, y: 0 }, { x: 0, y: SEG }];
    day = 0;
    clinoAngle = 0;
    sim?.requestRender();
  }

  /** Grow one segment on a shoot or root, turning toward its target (computed in the world frame). */
  function grow(pts: Vec[], isShoot: boolean) {
    const a = potAngle();
    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dirPot = norm({ x: tip.x - prev.x, y: tip.y - prev.y });
    const dirW = rot(dirPot, a);
    const tipW = toWorld(tip);
    let target: Vec;
    if (isShoot) {
      // On a clinostat the pot keeps rotating, so neither gravity nor a fixed lamp has a consistent direction
      const up: Vec = p.clino ? dirW : { x: 0, y: -1 };
      if (p.lamp && !p.clino) {
        const L = lampPos();
        const toLight = norm({ x: L.x - tipW.x, y: L.y - tipW.y });
        target = norm({ x: up.x * 0.35 + toLight.x * 1, y: up.y * 0.35 + toLight.y * 1 });
      } else target = up;
    } else {
      target = p.clino ? dirW : { x: 0, y: 1 };
    }
    // Turn at most ~6° per segment toward the target
    const cross = dirW.x * target.y - dirW.y * target.x;
    const dot = dirW.x * target.x + dirW.y * target.y;
    const turn = Math.max(-0.1, Math.min(0.1, Math.atan2(cross, dot) * 0.25));
    const newW = rot(dirW, turn);
    const newPot = rot(newW, -a);
    pts.push({ x: tip.x + newPot.x * SEG, y: tip.y + newPot.y * SEG });
  }

  function step(dt: number) {
    day += dt * 0.8;
    if (p.clino) clinoAngle += dt * 1.2;
    acc += dt * 6;
    while (acc >= 1) {
      acc -= 1;
      if (shoot.length < MAX_SHOOT) grow(shoot, true);
      if (rootPts.length < MAX_ROOT && Math.random() < 0.75) grow(rootPts, false);
    }
    if (shoot.length >= MAX_SHOOT && rootPts.length >= MAX_ROOT) sim.pause();
  }

  const tipAngle = (pts: Vec[], up: boolean) => {
    const a = toWorld(pts[pts.length - 1]);
    const b = toWorld(pts[pts.length - 2]);
    const ang = (Math.atan2(a.x - b.x, up ? b.y - a.y : a.y - b.y) * 180) / Math.PI;
    return Math.round(ang);
  };

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const c = centre();
    const a = potAngle();

    // Light rays
    if (p.lamp) {
      const L = lampPos();
      const g = ctx.createRadialGradient(L.x, L.y, 4, L.x, L.y, Math.max(w, h));
      g.addColorStop(0, 'rgba(255, 230, 120, 0.45)');
      g.addColorStop(0.5, 'rgba(255, 230, 120, 0.08)');
      g.addColorStop(1, 'rgba(255, 230, 120, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Pot + soil (in pot frame)
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(a);
    // Pot filled with soil (same tapered shape)
    ctx.fillStyle = '#7a5235';
    ctx.beginPath();
    ctx.moveTo(-78, -6);
    ctx.lineTo(78, -6);
    ctx.lineTo(62, 140);
    ctx.lineTo(-62, 140);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-80, -10);
    ctx.lineTo(80, -10);
    ctx.lineTo(62, 140);
    ctx.lineTo(-62, 140);
    ctx.closePath();
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Seed
    ctx.fillStyle = '#c9a46a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Root
    const rw = rootPts.map(toWorld);
    ctx.strokeStyle = '#d9c8a5';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    rw.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    // Shoot
    const sw = shoot.map(toWorld);
    ctx.strokeStyle = pal['sim-wall'];
    ctx.lineWidth = 5;
    ctx.beginPath();
    sw.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    // Leaves at the tip
    const tip = sw[sw.length - 1];
    const prev = sw[Math.max(0, sw.length - 3)];
    const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    ctx.fillStyle = pal['sim-wall'];
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(tip.x + Math.cos(ang + s * 1.1) * 10, tip.y + Math.sin(ang + s * 1.1) * 10, 10, 5, ang + s * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Auxin: concentrates on the shaded side of the shoot tip
    if (p.auxin && p.lamp && sw.length > 6) {
      const L = lampPos();
      const n = Math.min(10, sw.length - 1);
      for (let i = sw.length - n; i < sw.length; i++) {
        const q = sw[i];
        const toL = norm({ x: L.x - q.x, y: L.y - q.y });
        ctx.fillStyle = pal.warning;
        ctx.globalAlpha = 0.25 + (0.5 * (i - (sw.length - n))) / n;
        ctx.beginPath();
        ctx.arc(q.x - toL.x * 6, q.y - toL.y * 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Lamp
    if (p.lamp) {
      const L = lampPos();
      ctx.fillStyle = '#ffe27a';
      ctx.strokeStyle = pal['border-strong'];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(L.x, L.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Gravity arrow
    ctx.fillStyle = pal['text-faint'];
    pill(ctx, p.clino ? 'Clinostat rotating' : 'Gravity ↓', w - 70, h - 18, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Readouts
    const sA = tipAngle(shoot, true);
    const rA = tipAngle(rootPts, false);
    const response = p.clino
      ? 'Grows straight — rotation cancels the direction of gravity and light'
      : p.lamp && Math.abs(p.light) > 10
        ? 'Positive phototropism (shoot toward light)'
        : 'Negative gravitropism (shoot up), positive gravitropism (root down)';
    ui.readout('response', response);
    ui.readout('shoot', `${sA > 0 ? sA + '° right' : sA < 0 ? -sA + '° left' : '0° (vertical)'} of vertical`);
    ui.readout('root', `${rA > 0 ? rA + '° right' : rA < 0 ? -rA + '° left' : '0° (straight down)'}`);
    ui.readout('len', `${((shoot.length - 1) * 0.15).toFixed(1)} / ${((rootPts.length - 1) * 0.15).toFixed(1)} cm`);
    sim.setTime(day, 'days');
    sim.setBadge(`Day ${Math.floor(day)}`);
    canvas.setAttribute('aria-label', `A seedling on day ${day.toFixed(0)}. Lamp ${p.lamp ? `on at ${p.light} degrees` : 'off'}, pot tilted ${p.tilt} degrees${p.clino ? ' and rotating on a clinostat' : ''}. Shoot tip ${sA} degrees from vertical, root tip ${rA} degrees from straight down.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const upd = () => sim.requestRender();
  const lightCtl = ui.range('tp-light', (v) => `${v}°`, (v) => ((p.light = v), upd()));
  ui.presets('tp-light', lightCtl);
  const lampCtl = ui.toggle('tp-lamp', (v) => ((p.lamp = v), upd()));
  const tiltCtl = ui.range('tp-tilt', (v) => `${v}°`, (v) => ((p.tilt = v), upd()));
  const clinoCtl = ui.toggle('tp-clino', (v) => ((p.clino = v), upd()));
  const auxCtl = ui.toggle('tp-auxin', (v) => ((p.auxin = v), upd()));

  enableDrag<'lamp'>(canvas, {
    hit: (x, y) => {
      const L = lampPos();
      return p.lamp && Math.hypot(x - L.x, y - L.y) < 28 ? 'lamp' : null;
    },
    move: (_id, x, y) => {
      const c = centre();
      const ang = Math.round(((Math.atan2(x - c.x, c.y - 20 - y) * 180) / Math.PI) / 5) * 5;
      lightCtl.set(Math.max(-90, Math.min(90, ang)));
    },
    click: (x, y) => {
      const c = centre();
      if (y > c.y + 4) sim.showTooltip(x, y, 'Root', 'Roots grow toward gravity. Cells in the root cap contain dense starch grains (statoliths) that settle downward and tell the root which way is down.');
      else sim.showTooltip(x, y, 'Shoot', 'Light from one side moves the hormone auxin to the shaded side. Cells there elongate more, so the shoot bends toward the light.');
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      lightCtl.set(DEF.light, false);
      lampCtl.set(DEF.lamp, false);
      tiltCtl.set(DEF.tilt, false);
      clinoCtl.set(false, false);
      auxCtl.set(true, false);
      Object.assign(p, DEF);
      restart();
    },
  });
  restart();
}
