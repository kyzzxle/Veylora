/**
 * Fluid pressure and buoyancy in a tank (side view), using a simplified
 * hydrostatic model of a fluid at rest:
 *
 *   gauge pressure     p_g = ρ_f g h        (h = depth below the surface)
 *   absolute pressure  p   = p_atm + ρ_f g h,  p_atm = 101.3 kPa
 *   buoyant force      B   = ρ_f g V_sub    (Archimedes' principle)
 *   weight             W   = m g = ρ_o V g
 *
 * Each object moves only up and down. Its submerged volume is computed
 * exactly for its shape (prism: base area × submerged height; sphere:
 * spherical cap πd²(3r − d)/3). While settling it feels a simple velocity
 * drag, which only affects how it gets to equilibrium, not where. The fluid
 * level rises by the total submerged volume ÷ the tank's cross-section.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { LineGraph, runComparer } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type Pt = [number, number];
type Shape = 'cube' | 'sphere' | 'cylinder';
type Id = 'A' | 'B' | 'C';
const G = 9.81;
const P_ATM = 101.3; // kPa
const TW = 0.6; // tank width (m)
const TD = 0.3; // tank depth, front to back (m)
const TH = 0.54; // tank height (m)
const PPM = 600;
const PSCALE = 7; // px per kPa for pressure arrows

interface Obj {
  id: Id;
  shape: Shape;
  V: number; // m³
  rho: number; // kg/m³
  where: 'tank' | 'shelf';
  x: number; // tank coords (m), centre
  y: number; // bottom above the floor (m)
  vy: number;
  held: boolean;
}
const MATERIALS: Record<string, number> = { cork: 240, wood: 500, ice: 917, plastic: 1380, aluminium: 2700 };
const FLUIDS: Record<string, number> = { petrol: 740, oil: 920, water: 1000, sea: 1025, glycerine: 1260, honey: 1420 };
const DEF = { rhoF: 1000, level: 0.34, sel: 'A' as Id, gauge: true, wall: true, faces: true, shade: true };
const START: Omit<Obj, 'vy' | 'held'>[] = [
  { id: 'A', shape: 'cube', V: 0.001, rho: 500, where: 'tank', x: 0.12, y: 0.3 },
  { id: 'B', shape: 'sphere', V: 0.001, rho: 2700, where: 'tank', x: 0.3, y: 0 },
  { id: 'C', shape: 'cylinder', V: 0.001, rho: 1000, where: 'tank', x: 0.48, y: 0.12 },
];
const COL: Record<Id, string> = { A: '#c08a4e', B: '#9aa5b1', C: '#7b61c9' };

interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}
const fmt = (v: number, d = 2) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`;
};

/* ---------- Shape geometry ---------- */
function dims(o: { shape: Shape; V: number }) {
  if (o.shape === 'cube') {
    const a = Math.cbrt(o.V);
    return { w: a, h: a, base: a * a, r: a / 2 };
  }
  if (o.shape === 'sphere') {
    const r = Math.cbrt((3 * o.V) / (4 * Math.PI));
    return { w: 2 * r, h: 2 * r, base: 0, r };
  }
  const R = Math.cbrt(o.V / (2 * Math.PI)); // upright cylinder with height = diameter
  return { w: 2 * R, h: 2 * R, base: Math.PI * R * R, r: R };
}
/** Volume below a horizontal plane a distance d above the object's bottom. */
function vSub(o: { shape: Shape; V: number }, d: number) {
  const D = dims(o);
  const dd = clamp(d, 0, D.h);
  if (o.shape === 'sphere') return (Math.PI * dd * dd * (3 * D.r - dd)) / 3;
  return D.base * dd;
}

export function initFluids(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const p = { ...DEF };
  let objs: Obj[] = START.map((o) => ({ ...o, vy: 0, held: false }));
  let probe: Pt = [0.39, 0.15];
  let simT = 0;
  let surface = DEF.level;

  const get = (id: Id) => objs.find((o) => o.id === id)!;
  const sel = () => get(p.sel);
  const mass = (o: Obj) => o.rho * o.V;

  /* ---------- Model ---------- */
  function subOf(o: Obj, surf = surface) {
    if (o.where !== 'tank') return 0;
    return vSub(o, surf - o.y);
  }
  function computeSurface() {
    // the level rises by the displaced volume; iterate because V_sub depends on the level
    let s = p.level;
    for (let k = 0; k < 6; k++) {
      let vol = 0;
      for (const o of objs) vol += subOf(o, s);
      s = p.level + vol / (TW * TD);
    }
    surface = Math.min(s, TH);
  }
  function forces(o: Obj) {
    const W = mass(o) * G;
    const Vs = subOf(o);
    const B = p.rhoF * G * Vs;
    let N = 0;
    let H = 0; // holding force (up positive)
    if (o.where === 'tank') {
      if (o.held) H = W - B;
      else if (o.y <= 1e-6 && W > B) N = W - B;
    }
    return { W, B, Vs, N, H, net: B + N + H - W };
  }
  function state(o: Obj) {
    if (o.where !== 'tank') return 'On the shelf';
    const r = o.rho / p.rhoF;
    if (o.held) return 'Held in place';
    if (Math.abs(r - 1) < 0.005) return 'Neutrally buoyant';
    if (r < 1) return 'Floats';
    return 'Sinks';
  }
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    simT += dt;
    const n = 4;
    for (let k = 0; k < n; k++) {
      const h = dt / n;
      computeSurface();
      for (const o of objs) {
        if (o.where !== 'tank' || o.held || dragId === o.id) continue;
        const m = mass(o);
        const Vs = subOf(o);
        const B = p.rhoF * G * Vs;
        const frac = Vs / o.V;
        const c = 0.6 + 5 * frac; // drag: little in air, more in fluid
        const a = (B - m * G) / m - c * o.vy;
        o.vy += a * h;
        o.y += o.vy * h;
        const D = dims(o);
        if (o.y < 0) {
          o.y = 0;
          if (o.vy < 0) o.vy = 0;
        }
        if (o.y + D.h > TH + 0.25) o.y = TH + 0.25 - D.h;
      }
    }
    computeSurface();
    if (graphDirty) drawGraph();
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
  const T = () => ({ x: 30, floor: portrait() ? 560 : 540 });
  const S = (x: number, y: number): Pt => [T().x + x * PPM, T().floor - y * PPM];
  const W2T = (bx: number, by: number): Pt => [(bx - T().x) / PPM, (T().floor - by) / PPM];
  const shelfX = (id: Id) => {
    const base = T().x + TW * PPM + 52;
    return base + { A: 0, B: 74, C: 148 }[id];
  };
  let areas: Area[] = [];
  const rectArea = (x: number, y: number, w: number, h: number, title: string, text: () => string) => areas.push({ test: (px, py) => px >= x && px <= x + w && py >= y && py <= y + h, title, text });

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
  function fluidColor(a = 1) {
    const r = p.rhoF;
    // light oils are golden, water blue, dense syrups amber
    if (r < 960) return withAlpha('#e2b93b', 0.42 * a);
    if (r <= 1100) return withAlpha('#3d8bfd', 0.32 * a);
    return withAlpha('#c97a1e', 0.45 * a);
  }
  const fluidName = () => {
    const hit = Object.entries(FLUIDS).find(([, v]) => v === p.rhoF);
    return hit ? { petrol: 'Petrol', oil: 'Vegetable oil', water: 'Fresh water', sea: 'Sea water', glycerine: 'Glycerine', honey: 'Honey' }[hit[0]]! : 'Custom fluid';
  };
  const pressureKPa = (depth: number) => (depth > 0 ? (p.rhoF * G * depth) / 1000 : 0);

  /* ---------- Objects ---------- */
  function objScreen(o: Obj): { cx: number; bottom: number; D: ReturnType<typeof dims>; px: number } {
    const D = dims(o);
    if (o.where === 'tank' || dragId === o.id) {
      const [cx, bottom] = S(o.x, o.y);
      return { cx, bottom, D, px: PPM };
    }
    return { cx: shelfX(o.id), bottom: T().floor, D, px: PPM };
  }
  function drawObj(o: Obj) {
    const { cx, bottom, D } = objScreen(o);
    const w = D.w * PPM;
    const h = D.h * PPM;
    const c = COL[o.id];
    const selected = o.id === p.sel;
    ctx.save();
    if (o.shape === 'sphere') {
      const r = w / 2;
      const g = ctx.createRadialGradient(cx - r * 0.35, bottom - h / 2 - r * 0.35, r * 0.1, cx, bottom - h / 2, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, c);
      g.addColorStop(1, shade(c, -0.35));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, bottom - h / 2, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.shape === 'cube') {
      // front face + top and side faces for depth
      const dx = w * 0.22;
      const dy = w * 0.16;
      ctx.fillStyle = shade(c, 0.2);
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, bottom - h);
      ctx.lineTo(cx - w / 2 + dx, bottom - h - dy);
      ctx.lineTo(cx + w / 2 + dx, bottom - h - dy);
      ctx.lineTo(cx + w / 2, bottom - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(c, -0.25);
      ctx.beginPath();
      ctx.moveTo(cx + w / 2, bottom - h);
      ctx.lineTo(cx + w / 2 + dx, bottom - h - dy);
      ctx.lineTo(cx + w / 2 + dx, bottom - dy);
      ctx.lineTo(cx + w / 2, bottom);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c;
      ctx.fillRect(cx - w / 2, bottom - h, w, h);
      if (o.rho < 800) {
        // wood grain
        ctx.strokeStyle = withAlpha('#5a3a1a', 0.35);
        ctx.lineWidth = 1.2;
        for (let k = 1; k < 5; k++) {
          ctx.beginPath();
          ctx.moveTo(cx - w / 2, bottom - (h * k) / 5);
          ctx.bezierCurveTo(cx - w / 6, bottom - (h * k) / 5 - 4, cx + w / 6, bottom - (h * k) / 5 + 4, cx + w / 2, bottom - (h * k) / 5);
          ctx.stroke();
        }
      }
    } else {
      // cylinder: body + elliptical top
      const ey = w * 0.14;
      const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      g.addColorStop(0, shade(c, -0.2));
      g.addColorStop(0.4, shade(c, 0.25));
      g.addColorStop(1, shade(c, -0.35));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, bottom - h);
      ctx.lineTo(cx - w / 2, bottom);
      ctx.ellipse(cx, bottom, w / 2, ey, 0, Math.PI, 0, true);
      ctx.lineTo(cx + w / 2, bottom - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(c, 0.35);
      ctx.beginPath();
      ctx.ellipse(cx, bottom - h, w / 2, ey, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // outline when selected
    if (selected) {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(cx - w / 2 - 6, bottom - h - 8, w + 12, h + 12);
      ctx.setLineDash([]);
    }
    text(o.id, cx, bottom - h / 2 + 5, 15, '#ffffff', 'center', 800);
  }
  function shade(hex: string, k: number) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v: number) => clamp(Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  /** Pressure arrows pressing on the submerged surface of an object. */
  function drawFaceArrows(o: Obj) {
    if (o.where !== 'tank') return;
    const { cx, bottom, D } = objScreen(o);
    const w = D.w * PPM;
    const h = D.h * PPM;
    const surfY = S(0, surface)[1];
    const col = withAlpha(pal.accent, 0.9);
    const pulse = 1 + 0.06 * Math.sin(simT * 4);
    const press = (sy: number) => (sy > surfY ? pressureKPa((sy - surfY) / PPM) * PSCALE * pulse : 0);
    const arr = (x: number, y: number, dx: number, dy: number) => {
      const L = press(y);
      if (L < 2) return;
      arrow(ctx, x - dx * (L + 3), y - dy * (L + 3), x - dx * 3, y - dy * 3, col, 2, 6);
    };
    if (o.shape === 'sphere') {
      const r = w / 2;
      const cy = bottom - h / 2;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        arr(cx + nx * r, cy + ny * r, -nx, -ny);
      }
    } else {
      for (let k = 1; k < 4; k++) {
        const fx = cx - w / 2 + (w * k) / 4;
        arr(fx, bottom, 0, -1); // bottom face, pushing up
        arr(fx, bottom - h, 0, 1); // top face, pushing down
      }
      for (let k = 1; k < 4; k++) {
        const fy = bottom - (h * k) / 4;
        arr(cx - w / 2, fy, 1, 0);
        arr(cx + w / 2, fy, -1, 0);
      }
    }
  }

  /* ---------- Scene ---------- */
  function drawScene() {
    const { x: tx, floor } = T();
    const Wpx = TW * PPM;
    const Hpx = TH * PPM;
    const top = floor - Hpx;
    const surfY = S(0, surface)[1];
    // bench
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.25);
    ctx.fillRect(tx - 20, floor, Wpx + 300, 10);
    // fluid
    if (p.shade) {
      const g = ctx.createLinearGradient(0, surfY, 0, floor);
      g.addColorStop(0, fluidColor(0.6));
      g.addColorStop(1, fluidColor(1.5));
      ctx.fillStyle = g;
    } else ctx.fillStyle = fluidColor();
    ctx.fillRect(tx, surfY, Wpx, floor - surfY);
    // surface ripple line
    ctx.strokeStyle = fluidColor(2.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= Wpx; x += 6) {
      const yy = surfY + Math.sin(x / 18 + simT * 2) * 1.2;
      if (x === 0) ctx.moveTo(tx + x, yy);
      else ctx.lineTo(tx + x, yy);
    }
    ctx.stroke();
    // original level marker
    const baseY = S(0, p.level)[1];
    if (Math.abs(baseY - surfY) > 2) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = pal['text-muted'];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx + Wpx - 60, baseY);
      ctx.lineTo(tx + Wpx, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      text(`level rose ${fmt((surface - p.level) * 100, 1)} cm`, tx + Wpx - 64, baseY + 4, 10.5, pal['text-muted'], 'right', 650);
    }
    // wall pressure arrows (gauge pressure, pushing outwards)
    if (p.wall) {
      const pulse = 1 + 0.06 * Math.sin(simT * 4);
      for (let d = 0.05; d < surface; d += 0.05) {
        const y = surfY + d * PPM;
        const L = pressureKPa(d) * PSCALE * pulse;
        if (L < 2) continue;
        arrow(ctx, tx + 4, y, tx - L, y, withAlpha(pal.accent, 0.75), 2, 6);
        arrow(ctx, tx + Wpx - 4, y, tx + Wpx + L, y, withAlpha(pal.accent, 0.75), 2, 6);
      }
    }
    // depth scale
    for (let d = 0; d <= surface + 1e-9; d += 0.1) {
      const y = surfY + d * PPM;
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx + 2, y);
      ctx.lineTo(tx + 10, y);
      ctx.stroke();
      text(`${fmt(d * 100, 0)} cm`, tx + 14, y + 4, 10, pal['text-faint'], 'left', 600);
    }
    // objects (in the tank and on the shelf)
    for (const o of objs) drawObj(o);
    if (p.faces) for (const o of objs) drawFaceArrows(o);
    // object labels: state and forces
    for (const o of objs) {
      const { cx, bottom, D } = objScreen(o);
      const f = forces(o);
      const st = state(o);
      const ly = bottom - D.h * PPM - 14;
      if (o.where === 'tank') {
        const lab = st === 'Floats' ? `Floats (${fmt((100 * f.Vs) / o.V, 0)}% under)` : st;
        ctx.font = fs(11, 750);
        const half = ctx.measureText(lab).width / 2 + 4;
        const lx = clamp(cx, T().x + half, T().x + TW * PPM - half);
        text(lab, lx, ly, 11, st === 'Sinks' ? pal.danger : st === 'Floats' ? pal.success : pal['accent-2'], 'center', 750);
        if (!portrait()) text(`B = ${fmt(f.B)} N`, lx, ly - 15 / K, 10.5, pal.accent, 'center', 700);
        if (o.held && Math.abs(f.H) > 0.01) {
          const hx = cx;
          const hy = bottom - D.h * PPM;
          arrow(ctx, hx, hy - 6, hx, hy - 6 - clamp(f.H, -30, 30) * 3, pal.warning, 3, 9);
        }
      } else text(`${o.id}`, cx, bottom + 24, 11, pal['text-muted'], 'center', 700);
    }
    // glass tank
    ctx.strokeStyle = withAlpha(pal['sim-text'], 0.55);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, top);
    ctx.lineTo(tx, floor);
    ctx.lineTo(tx + Wpx, floor);
    ctx.lineTo(tx + Wpx, top);
    ctx.stroke();
    ctx.fillStyle = withAlpha('#ffffff', 0.05);
    ctx.fillRect(tx + 6, top, 10, Hpx);
    text('Air: p₀ = 101.3 kPa', tx + Wpx / 2, top - 10, 11, pal['text-faint'], 'center', 650);
    text(`${fluidName()} (ρ = ${p.rhoF} kg/m³)`, tx + Wpx - 8, floor - 10, 11, pal['sim-text'], 'right', 700);
    text('Shelf', shelfX('B'), floor + 26, 11, pal['text-faint'], 'center', 650);
    // probe
    const [px, py] = S(probe[0], probe[1]);
    const depth = Math.max(0, surface - probe[1]);
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, py - 14);
    ctx.lineTo(px, top - 30);
    ctx.stroke();
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal.warning;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const pk = pressureKPa(depth);
    const needle = -Math.PI * 0.75 + clamp(pk / 8, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = pal.danger;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(needle - Math.PI / 2) * 10, py + Math.sin(needle - Math.PI / 2) * 10);
    ctx.stroke();
    const lbl = p.gauge ? `${fmt(pk)} kPa (gauge)` : `${fmt(P_ATM + pk, 1)} kPa (absolute)`;
    ctx.font = fs(11.5, 750);
    const tw = ctx.measureText(lbl).width;
    const lx = clamp(px + 18, tx + 4, tx + Wpx - tw - 8);
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.9);
    ctx.fillRect(lx - 4, py - 30, tw + 8, 18 / K + 2);
    text(lbl, lx, py - 30 + 14 / K, 11.5, pal.warning, 'left', 750);

    // inspect areas
    rectArea(tx, surfY, Wpx, floor - surfY, 'Fluid', () => `${fluidName()}, density ${p.rhoF} kg/m³. The fluid is at rest, so its pressure depends only on depth: p = p₀ + ρgh. The arrows on the walls show the gauge pressure pushing outwards, growing steadily with depth.`);
    rectArea(tx, top, Wpx, surfY - top, 'Air above the fluid', () => 'The atmosphere presses on the fluid surface with about 101.3 kPa. This adds the same amount at every depth, so it is included in absolute pressure but left out of gauge pressure.');
    for (const o of objs) {
      const { cx, bottom, D } = objScreen(o);
      rectArea(cx - (D.w * PPM) / 2 - 4, bottom - D.h * PPM - 4, D.w * PPM + 8, D.h * PPM + 8, `Object ${o.id}: ${o.shape}`, () => {
        const f = forces(o);
        return `Volume ${fmt(o.V * 1000)} L, density ${fmt(o.rho, 0)} kg/m³, mass ${fmt(mass(o))} kg, weight ${fmt(f.W)} N. ${o.where === 'tank' ? `Submerged volume ${fmt(f.Vs * 1000)} L, so B = ρgV = ${fmt(f.B)} N. ${state(o)}.` : 'Drag it into the tank.'}`;
      });
    }
    rectArea(px - 16, py - 16, 32, 32, 'Pressure probe', () => `At ${fmt(depth * 100, 1)} cm below the surface: gauge pressure ρgh = ${fmt(pk)} kPa; absolute pressure p₀ + ρgh = ${fmt(P_ATM + pk, 1)} kPa. Drag the probe to measure elsewhere: pressure depends only on depth, not on the shape of the container.`);
    // equations
    text('p = p₀ + ρ g h      B = ρ_fluid g V_displaced', tx, 24, 12, pal['sim-text'], 'left', 700);
  }

  /* ---------- Archimedes panel ---------- */
  function drawArch(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    const o = sel();
    const f = forces(o);
    text(`Archimedes: object ${o.id}`, x + 14, y + 22, 12.5, pal['sim-text'], 'left', 750);
    // measuring cylinder with the displaced fluid
    const jx = x + 22;
    const jy = y + 40;
    const jw = 40;
    const jh = h - 70;
    const maxV = 3e-3;
    ctx.strokeStyle = withAlpha(pal['sim-text'], 0.6);
    ctx.lineWidth = 2;
    ctx.strokeRect(jx, jy, jw, jh);
    const fh = (jh * clamp(f.Vs / maxV, 0, 1));
    ctx.fillStyle = fluidColor(1.4);
    ctx.fillRect(jx + 2, jy + jh - fh, jw - 4, fh);
    for (let l = 0; l <= 3; l++) {
      const ly = jy + jh - (jh * l) / 3;
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(jx + jw - 10, ly);
      ctx.lineTo(jx + jw, ly);
      ctx.stroke();
      text(`${l} L`, jx + jw + 4, ly + 4, 10, pal['text-faint'], 'left', 600);
    }
    const lx = jx + jw + 10 + 26 / K;
    const lh = 16 / K;
    let ly = jy + 12;
    const line = (str: string, c = pal['sim-text'], wt = 650) => {
      text(str, lx, ly, 11.5, c, 'left', wt);
      ly += lh;
    };
    line('Displaced fluid:', pal['text-muted'], 650);
    line(`V = ${fmt(f.Vs * 1000)} L`, pal['sim-text'], 750);
    line('weighs ρ g V');
    line(`= ${fmt(f.B)} N`, pal.accent, 750);
    ly += lh * 0.4;
    line(`B = ${fmt(f.B)} N`, pal.accent, 800);
    line(`W = ${fmt(f.W)} N`, pal.danger, 750);
    rectArea(x, y, w, h, 'Archimedes’ principle', () => 'The buoyant force on an object equals the weight of the fluid it pushes aside (displaces). The cylinder shows that displaced fluid for the selected object: its weight, ρgV, is exactly the buoyant force.');
  }

  /* ---------- Forces panel ---------- */
  function drawForces(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    const o = sel();
    const f = forces(o);
    text(`Forces on object ${o.id}`, x + 14, y + 22, 12.5, pal['sim-text'], 'left', 750);
    const cx = x + w * 0.24;
    const cy = y + h / 2 + 8;
    const big = Math.max(f.W, f.B, 1e-6);
    const sc = (h * 0.32) / big;
    ctx.fillStyle = COL[o.id];
    if (o.shape === 'sphere') {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(cx - 18, cy - 18, 36, 36);
    const vec = (dx: number, dy: number, c: string, label: string, off = 0) => {
      if (Math.hypot(dx, dy) < 2) return;
      arrow(ctx, cx + off, cy, cx + off + dx, cy + dy, c, 3.2, 10);
      text(label, cx + off + dx + (off >= 0 ? 8 : -8), cy + dy + (dy > 0 ? 12 : -2), 11, c, off >= 0 ? 'left' : 'right', 750);
    };
    vec(0, f.W * sc, pal.danger, 'W');
    vec(0, -f.B * sc, pal.accent, 'B', -6);
    if (f.N > 1e-6) vec(0, -f.N * sc, pal['text-muted'], 'N', 8);
    if (Math.abs(f.H) > 1e-6) vec(0, -f.H * sc, pal.warning, 'Hand', 8);
    const lx = x + w * 0.52;
    let ly = y + 50;
    const lh = 16 / K;
    const line = (str: string, c = pal['sim-text'], wt = 650) => {
      text(str, lx, ly, 11.5, c, 'left', wt);
      ly += lh;
    };
    line(state(o), state(o) === 'Sinks' ? pal.danger : state(o) === 'Floats' ? pal.success : pal['accent-2'], 800);
    line(`W = ${fmt(f.W)} N`, pal.danger, 700);
    line(`B = ${fmt(f.B)} N`, pal.accent, 700);
    line(`ρ object: ${fmt(o.rho, 0)}`);
    line(`ρ fluid: ${p.rhoF}`);
    if (o.where === 'tank' && state(o) === 'Floats') line(`Under: ${fmt((100 * f.Vs) / o.V, 0)}%`, pal.success, 700);
    if (f.N > 1e-6) line(`Floor: ${fmt(f.N)} N`, pal['text-muted'], 650);
    if (o.held) line(Math.abs(f.H) < 0.01 ? 'Hand: 0 N' : `Hand: ${fmt(Math.abs(f.H))} N ${f.H > 0 ? 'up' : 'down'}`, pal.warning, 700);
    rectArea(x, y, w, h, 'Forces', () => 'Weight W pulls down; the buoyant force B pushes up. A floating object settles where B = W, with the fraction ρ_object/ρ_fluid below the surface. A sinking object rests on the floor, which supplies the rest (N = W − B, its apparent weight in the fluid).');
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
    computeSurface();
    if (portrait()) {
      drawArch(10, 620, 660, 250);
      drawForces(10, 880, 660, 260);
    } else {
      drawArch(628, 60, 362, 262);
      drawForces(628, 330, 362, 262);
    }
    drawScene();
    ctx.restore();
    updateUi();
  }

  /* ---------- Graph: pressure vs depth ---------- */
  let graphDirty = true;
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="fl-graph"]')!, {
    x: { min: 0, span: 0.5, max: 0.5, step: 0.1, format: (v) => `${fmt(v * 100, 0)} cm` },
    y: { min: 0, max: 8, step: 2, format: (v) => `${v}` },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="fl-graph"]')!, graph, {
    currentId: 'p',
    label: () => `${fluidName()} (${p.rhoF} kg/m³)`,
  });
  function drawGraph() {
    graphDirty = false;
    const off = p.gauge ? 0 : P_ATM;
    const pts = [0, 0.5].map((d) => ({ x: d, y: off + pressureKPa(d) }));
    graph.opts.y = p.gauge ? { min: 0, max: 8, step: 2, format: (v) => `${v}` } : { min: 100, max: 109, step: 2, format: (v) => `${v}` };
    graph.set('p', { label: `${fluidName()}: ${p.gauge ? 'gauge' : 'absolute'} pressure (kPa)`, color: 'accent', points: pts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="fl-graph"]'));
  }

  /* ---------- Readouts ---------- */
  function updateUi() {
    const depth = Math.max(0, surface - probe[1]);
    const pk = pressureKPa(depth);
    ui.readout('pg', `${fmt(pk)} kPa at ${fmt(depth * 100, 1)} cm`, null);
    ui.readout('pa', `${fmt(P_ATM + pk, 1)} kPa`);
    const o = sel();
    const f = forces(o);
    ui.readout('vd', `${fmt(f.Vs * 1000)} L of ${fmt(o.V * 1000)} L`);
    ui.readout('bf', `${fmt(f.B)} N`, 'ok');
    ui.readout('wt', `${fmt(f.W)} N (${fmt(mass(o))} kg)`);
    ui.readout('st', `${o.id}: ${state(o)}`, state(o) === 'Sinks' ? 'bad' : state(o) === 'Floats' ? 'ok' : null);
    sim.setBadge(`${fluidName()} · ${fmt(surface * 100, 1)} cm deep`);
    const r = o.rho / p.rhoF;
    const note =
      o.where !== 'tank'
        ? `Object ${o.id} is on the shelf. Drag it into the tank and let go.`
        : o.held
          ? `You are holding object ${o.id}. Its weight is ${fmt(f.W)} N and the fluid pushes up with ${fmt(f.B)} N, so ${Math.abs(f.H) < 0.01 ? 'no hand force is needed: B = W' : f.H > 0 ? `your hand must hold it up with ${fmt(f.H)} N` : `your hand must push it down with ${fmt(-f.H)} N`}. Drag it deeper or shallower and watch B change.`
          : Math.abs(r - 1) < 0.005
            ? `Object ${o.id} has the same average density as the fluid, so B = W wherever it is fully submerged: it is neutrally buoyant and stays where it is put.`
            : r < 1
              ? `Object ${o.id} is less dense than the fluid (${fmt(o.rho, 0)} < ${p.rhoF} kg/m³). It floats with ${fmt(r * 100, 0)}% of its volume below the surface, where the displaced fluid weighs exactly as much as the object.`
              : `Object ${o.id} is denser than the fluid (${fmt(o.rho, 0)} > ${p.rhoF} kg/m³). Even fully submerged, B (${fmt(f.B)} N) is less than W (${fmt(f.W)} N), so it sinks and rests on the bottom.`;
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', `Tank of ${fluidName()}, ${fmt(surface * 100, 1)} centimetres deep. Object A ${state(get('A'))}, object B ${state(get('B'))}, object C ${state(get('C'))}.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  let syncing = false;
  const changed = () => {
    graphDirty = true;
    if (!sim.running) sim.play();
    sim.requestRender();
  };
  const rhoFCtl = ui.range('fl-rhof', (v) => `${v} kg/m³`, (v) => {
    p.rhoF = v;
    changed();
  });
  const levelCtl = ui.range('fl-level', (v) => `${fmt(v * 100, 0)} cm`, (v) => {
    p.level = v;
    changed();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-fluid]').forEach((b) => b.addEventListener('click', () => rhoFCtl.set(FLUIDS[b.dataset.fluid!])));
  const selCtl = ui.choice<Id>('fl-sel', (v) => {
    p.sel = v;
    syncObj();
    sim.requestRender();
  });
  const shapeCtl = ui.choice<Shape>('fl-shape', (v) => {
    if (syncing) return;
    sel().shape = v;
    fitInTank(sel());
    changed();
  });
  const volCtl = ui.range('fl-vol', (v) => `${fmt(v, 1)} L`, (v) => {
    if (syncing) return;
    sel().V = v / 1000;
    fitInTank(sel());
    syncObj();
    changed();
  });
  const rhoCtl = ui.range('fl-rho', (v) => `${v} kg/m³`, (v) => {
    if (syncing) return;
    sel().rho = v;
    syncObj();
    changed();
  });
  const massCtl = ui.range('fl-mass', (v) => `${fmt(v, 2)} kg`, (v) => {
    if (syncing) return;
    sel().rho = clamp(Math.round(v / sel().V), 100, 3000);
    syncObj();
    changed();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-mat]').forEach((b) =>
    b.addEventListener('click', () => {
      const m = b.dataset.mat!;
      sel().rho = m === 'neutral' ? p.rhoF : MATERIALS[m];
      syncObj();
      changed();
    }),
  );
  function syncObj() {
    syncing = true;
    const o = sel();
    shapeCtl.set(o.shape, false);
    volCtl.set(Math.round(o.V * 10000) / 10);
    rhoCtl.set(Math.round(o.rho));
    massCtl.set(Math.round(mass(o) * 100) / 100);
    holdCtl.set(o.held, false);
    heightCtl.set(Math.round(o.y * 100) / 100);
    ui.showWhen('[data-only="hold"]', o.held);
    syncing = false;
  }
  const gaugeCtl = ui.choice<'gauge' | 'absolute'>('fl-pmode', (v) => {
    p.gauge = v === 'gauge';
    graphDirty = true;
    drawGraph();
    sim.requestRender();
  });
  const wallCtl = ui.toggle('fl-wall', (v) => ((p.wall = v), sim.requestRender()));
  const facesCtl = ui.toggle('fl-faces', (v) => ((p.faces = v), sim.requestRender()));
  const shadeCtl = ui.toggle('fl-shade', (v) => ((p.shade = v), sim.requestRender()));
  const holdCtl = ui.toggle('fl-hold', (v) => {
    if (syncing) return;
    const o = sel();
    o.held = v && o.where === 'tank';
    o.vy = 0;
    ui.showWhen('[data-only="hold"]', o.held);
    syncObj();
    if (!v) changed();
    sim.requestRender();
  });
  const heightCtl = ui.range('fl-height', (v) => `${fmt(v * 100, 0)} cm`, (v) => {
    if (syncing) return;
    const o = sel();
    if (!o.held) return;
    o.y = clamp(v, 0, TH + 0.2 - dims(o).h);
    sim.requestRender();
  });
  root.querySelector('[data-shelf]')?.addEventListener('click', () => {
    const o = sel();
    o.where = 'shelf';
    o.held = false;
    syncObj();
    changed();
  });
  function fitInTank(o: Obj) {
    const D = dims(o);
    o.x = clamp(o.x, D.w / 2 + 0.01, TW - D.w / 2 - 0.01);
  }
  /** Nudge a dropped object sideways so it does not overlap others in the tank. */
  function separate(o: Obj) {
    const D = dims(o);
    for (let pass = 0; pass < 3; pass++)
      for (const q of objs) {
        if (q === o || q.where !== 'tank') continue;
        const Dq = dims(q);
        const minGap = (D.w + Dq.w) / 2 + 0.01;
        if (Math.abs(o.x - q.x) < minGap) {
          const right = q.x + minGap;
          const left = q.x - minGap;
          o.x = o.x >= q.x && right <= TW - D.w / 2 ? right : left >= D.w / 2 ? left : right;
        }
      }
    fitInTank(o);
  }

  /* ---------- Dragging ---------- */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  let dragId: Id | 'probe' | null = null;
  let grab: Pt = [0, 0];
  enableDrag<Id | 'probe'>(canvas, {
    hit(x, y) {
      const [bx, by] = toBox(x, y);
      const [px, py] = S(probe[0], probe[1]);
      if (Math.hypot(bx - px, by - py) < 20) return 'probe';
      for (const o of [...objs].reverse()) {
        const { cx, bottom, D } = objScreen(o);
        const w = D.w * PPM;
        const h = D.h * PPM;
        if (bx >= cx - w / 2 - 6 && bx <= cx + w / 2 + 6 && by >= bottom - h - 8 && by <= bottom + 6) return o.id;
      }
      return null;
    },
    start(id, x, y) {
      sim.hideTooltip();
      const [bx, by] = toBox(x, y);
      if (id === 'probe') {
        dragId = 'probe';
        return;
      }
      const o = get(id);
      if (p.sel !== id) selCtl.set(id);
      const { cx, bottom } = objScreen(o);
      grab = [cx - bx, bottom - by];
      const [wx, wy] = W2T(cx, bottom);
      o.x = wx;
      o.y = wy;
      o.vy = 0;
      dragId = id;
    },
    move(id, x, y) {
      const [bx, by] = toBox(x, y);
      if (id === 'probe') {
        const [wx, wy] = W2T(bx, by);
        probe = [clamp(wx, 0.02, TW - 0.02), clamp(wy, 0.01, TH)];
        sim.requestRender();
        return;
      }
      const o = get(id);
      const [wx, wy] = W2T(bx + grab[0], by + grab[1]);
      const D = dims(o);
      o.x = wx;
      o.y = clamp(wy, 0, TH + 0.3 - D.h);
      o.vy = 0;
      o.where = 'tank';
      sim.requestRender();
    },
    end(id) {
      dragId = null;
      if (id === 'probe') return;
      const o = get(id);
      const D = dims(o);
      if (o.x < 0 || o.x > TW) {
        o.where = 'shelf';
        o.held = false;
      } else {
        o.where = 'tank';
        separate(o);
        if (o.y < 0) o.y = 0;
        o.held = holdCtl.value;
        if (o.y + D.h > TH + 0.2) o.y = TH + 0.2 - D.h;
      }
      syncObj();
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
    autoplay: true,
    reset() {
      Object.assign(p, DEF);
      objs = START.map((o) => ({ ...o, vy: 0, held: false }));
      probe = [0.39, 0.15];
      rhoFCtl.set(DEF.rhoF, false);
      levelCtl.set(DEF.level, false);
      selCtl.set(DEF.sel, false);
      gaugeCtl.set('gauge', false);
      wallCtl.set(DEF.wall, false);
      facesCtl.set(DEF.faces, false);
      shadeCtl.set(DEF.shade, false);
      syncObj();
      graphDirty = true;
      drawGraph();
      comparer.refresh();
    },
  });
  syncObj();
  drawGraph();
  updateUi();
}
