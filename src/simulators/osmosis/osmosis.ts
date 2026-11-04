/**
 * Osmosis and Cell Tonicity simulator.
 *
 * MODEL (simplified, see the page text for details)
 * - Cell volume V is relative to the starting volume (V = 1).
 * - A fraction b of the cell is "osmotically inactive" (proteins, organelles),
 *   so solute concentration inside is  Cin = n / (V − b),  n = Cin0 · (1 − b).
 * - Water flows in proportion to the concentration difference, minus any
 *   wall (turgor) pressure P for plant cells:
 *       dV/dt = k · permeability · (Cin − Cout − P) / 300
 * - Animal cells burst (lyse) when V reaches LYSIS_V.
 * - Plant cells: once the protoplast presses on the wall (V > 1), the wall
 *   pushes back with P = E · (V − 1), which stops further swelling.
 *
 * VISUALS
 * Water molecules are individual particles that can cross the membrane in both
 * directions. The crossing probabilities are biased so that the particle count
 * inside tracks the model volume: when the cell is gaining water, more
 * molecules cross inward than outward; at equilibrium both directions are
 * equal. Solute particles can never cross the membrane.
 */

import {
  bindRange,
  clamp,
  createAnnouncer,
  createLoop,
  fitCanvas,
  onThemeChange,
  readPalette,
  type CanvasSize,
} from '../shared';

type CellType = 'animal' | 'plant';

const PALETTE = [
  'sim-bg',
  'sim-water',
  'sim-solute',
  'sim-membrane',
  'sim-cytoplasm',
  'sim-wall',
  'sim-grid',
  'sim-text',
  'accent',
  'accent-2',
  'warning',
  'danger',
  'text-faint',
  'bg-elev',
  'border-strong',
] as const;
type Palette = Record<(typeof PALETTE)[number], string>;

const MODEL = {
  animal: { b: 0.4, k: 0.12 },
  plant: { b: 0.3, k: 0.12, E: 2500 },
};
const LYSIS_V = 1.55;
const KPA_PER_MOSM = 2.48; // RT at 25 °C, kPa per mOsm/L
const DEFAULTS = { cout: 300, cin: 300, perm: 1 };
const SOLUTE_PER_CELL = 22; // solute particles drawn per "cell area" at 300 mOsm/L
const WATER_PER_CELL = 70; // water particles drawn per "cell area"

interface Water {
  x: number;
  y: number;
  a: number; // heading
  inside: boolean;
  glow: number;
}
interface Solute {
  x: number;
  y: number;
  a: number;
}
interface InnerSolute {
  u: number; // normalised position inside the cell (−1…1)
  v: number;
  a: number;
}
interface Fragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a0: number;
  a1: number;
  r: number;
}
interface Run {
  label: string;
  color: string;
  points: { t: number; v: number }[];
  lysedAt?: number;
}

export function initOsmosis(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  const canvas = $<HTMLCanvasElement>('[data-canvas]');
  const graphCanvas = $<HTMLCanvasElement>('[data-graph]');
  const stage = canvas.parentElement!;
  const tooltip = $('[data-tooltip]');
  const hint = $('[data-hint]');
  const badge = $('[data-badge]');
  const overlay = $('[data-overlay]');
  const announce = createAnnouncer($('[data-status]'));

  /* ---------------- State ---------------- */
  const state = {
    cell: 'animal' as CellType,
    cin0: DEFAULTS.cin,
    cout: DEFAULTS.cout,
    perm: DEFAULTS.perm,
    labels: true,
    V: 1,
    flux: 0,
    t: 0,
    lysed: false,
    lysisClock: 0,
  };

  let pal: Palette = readPalette(PALETTE);
  let size: CanvasSize = { w: 1, h: 1, dpr: 1 };
  let waters: Water[] = [];
  let solutesOut: Solute[] = [];
  let solutesIn: InnerSolute[] = [];
  let released: (Solute & { life: number })[] = [];
  let fragments: Fragment[] = [];
  let current: Run = newRun();
  const saved: Run[] = [];
  let lastSample = -1;
  let crossIn = 0;
  let crossOut = 0;
  let rateIn = 0;
  let rateOut = 0;
  let rateClock = 0;
  let readoutClock = 0;

  /* ---------------- Physics ---------------- */
  const b = () => MODEL[state.cell].b;
  const soluteAmount = () => state.cin0 * (1 - b());
  const cinNow = () => soluteAmount() / (state.V - b());
  const turgor = () => (state.cell === 'plant' && state.V > 1 ? MODEL.plant.E * (state.V - 1) : 0);

  function stepPhysics(dt: number) {
    if (state.lysed) return;
    const k = MODEL[state.cell].k * state.perm;
    const sub = 5;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const flux = (k * (cinNow() - state.cout - turgor())) / 300;
      state.flux = flux;
      state.V = Math.max(b() + 0.06, state.V + flux * h);
    }
    state.t += dt;
    if (state.cell === 'animal' && state.V >= LYSIS_V) lyse();
  }

  /* ---------------- Geometry ---------------- */
  // Animal: circle. Plant: rounded square (wall) holding a rounded protoplast.
  const geom = { cx: 0, cy: 0, R0: 0, r: 0, wallH: 0, protoH: 0, protoR: 0 };

  function updateGeom() {
    const { w, h } = size;
    geom.cx = w / 2;
    geom.cy = h / 2;
    geom.R0 = Math.min(w, h) * 0.2;
    if (state.cell === 'animal') {
      geom.r = geom.R0 * Math.sqrt(state.V);
    } else {
      const base = geom.R0 * 1.15 * 0.886; // half-side of a square with the same area
      geom.wallH = base * Math.sqrt(Math.max(state.V, 1));
      geom.protoH = state.V >= 1 ? geom.wallH - 2 : base * Math.sqrt(state.V);
      const shrink = clamp((1 - state.V) / 0.35, 0, 1);
      geom.protoR = Math.min(geom.protoH, geom.protoH * (0.22 + 0.78 * shrink));
    }
  }

  function sdRoundBox(px: number, py: number, half: number, r: number) {
    const qx = Math.abs(px) - half + r;
    const qy = Math.abs(py) - half + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }

  /** Signed distance to the membrane: negative inside the cell. */
  function membraneSD(x: number, y: number) {
    const dx = x - geom.cx;
    const dy = y - geom.cy;
    return state.cell === 'animal' ? Math.hypot(dx, dy) - geom.r : sdRoundBox(dx, dy, geom.protoH, geom.protoR);
  }
  function wallSD(x: number, y: number) {
    return sdRoundBox(x - geom.cx, y - geom.cy, geom.wallH, geom.wallH * 0.22);
  }

  /** Move a point to the requested side of the membrane. */
  function pushToSide(p: { x: number; y: number }, inside: boolean) {
    const d = membraneSD(p.x, p.y);
    const e = 0.5;
    const gx = membraneSD(p.x + e, p.y) - membraneSD(p.x - e, p.y);
    const gy = membraneSD(p.x, p.y + e) - membraneSD(p.x, p.y - e);
    const g = Math.hypot(gx, gy) || 1;
    const target = inside ? -3 : 3;
    p.x -= ((d - target) * gx) / g;
    p.y -= ((d - target) * gy) / g;
  }

  const cellArea = () => Math.PI * geom.R0 * geom.R0;

  /* ---------------- Particles ---------------- */
  const rnd = Math.random;

  function randomOutsidePoint(): { x: number; y: number } {
    for (let i = 0; i < 40; i++) {
      const x = 4 + rnd() * (size.w - 8);
      const y = 4 + rnd() * (size.h - 8);
      if (membraneSD(x, y) > 4) return { x, y };
    }
    return { x: 6, y: 6 };
  }
  function randomInsidePoint(): { x: number; y: number } {
    for (let i = 0; i < 40; i++) {
      const x = geom.cx + (rnd() * 2 - 1) * geom.R0 * 1.3;
      const y = geom.cy + (rnd() * 2 - 1) * geom.R0 * 1.3;
      if (membraneSD(x, y) < -4) return { x, y };
    }
    return { x: geom.cx, y: geom.cy };
  }

  function outsideArea() {
    return Math.max(1, size.w * size.h - cellArea() * state.V);
  }

  function rebuildParticles() {
    updateGeom();
    const density = WATER_PER_CELL / cellArea();
    const nOut = Math.min(1100, Math.round(density * outsideArea()));
    const nIn = Math.round(WATER_PER_CELL * state.V);
    waters = [];
    for (let i = 0; i < nOut; i++) waters.push({ ...randomOutsidePoint(), a: rnd() * 6.28, inside: false, glow: 0 });
    if (!state.lysed) for (let i = 0; i < nIn; i++) waters.push({ ...randomInsidePoint(), a: rnd() * 6.28, inside: true, glow: 0 });
    solutesOut = [];
    syncOutsideSolutes();
    solutesIn = [];
    if (!state.lysed) {
      const n = Math.round((SOLUTE_PER_CELL * state.cin0) / 300);
      for (let i = 0; i < n; i++) {
        let u = 0;
        let v = 0;
        do {
          u = rnd() * 2 - 1;
          v = rnd() * 2 - 1;
        } while (u * u + v * v > 0.75);
        solutesIn.push({ u, v, a: rnd() * 6.28 });
      }
    }
  }

  function syncOutsideSolutes() {
    const target = Math.min(900, Math.round(((SOLUTE_PER_CELL * state.cout) / 300) * (outsideArea() / cellArea())));
    while (solutesOut.length < target) solutesOut.push({ ...randomOutsidePoint(), a: rnd() * 6.28 });
    if (solutesOut.length > target) solutesOut.length = target;
  }

  function moveParticles(dt: number) {
    updateGeom();
    const { w, h } = size;
    const lysed = state.lysed;
    const targetIn = WATER_PER_CELL * state.V;
    let inCount = 0;
    for (const p of waters) if (p.inside) inCount++;
    const diff = targetIn - inCount;
    const base = 0.22 * state.perm;
    const pIn = clamp(base * (1 + diff * 0.3), 0.01, 1);
    const pOut = clamp(base * (1 - diff * 0.3), 0.01, 1);

    const speed = 34;
    for (const p of waters) {
      p.a += (rnd() - 0.5) * 1.6;
      const nx = p.x + Math.cos(p.a) * speed * dt;
      const ny = p.y + Math.sin(p.a) * speed * dt;
      p.glow = Math.max(0, p.glow - dt * 1.4);
      if (!lysed) {
        const nowInside = membraneSD(nx, ny) < 0;
        if (nowInside !== p.inside) {
          const allowed = rnd() < (p.inside ? pOut : pIn);
          if (allowed) {
            p.inside = nowInside;
            p.glow = 1;
            if (nowInside) crossIn++;
            else crossOut++;
          } else {
            p.a += Math.PI; // bounce off the membrane
            continue;
          }
        }
      }
      p.x = nx;
      p.y = ny;
      if (p.x < 2 || p.x > w - 2) (p.a = Math.PI - p.a), (p.x = clamp(p.x, 2, w - 2));
      if (p.y < 2 || p.y > h - 2) (p.a = -p.a), (p.y = clamp(p.y, 2, h - 2));
      // The membrane moved (cell grew or shrank): keep the particle on its side.
      if (!lysed && (membraneSD(p.x, p.y) < 0) !== p.inside) pushToSide(p, p.inside);
    }

    for (const s of solutesOut) {
      s.a += (rnd() - 0.5) * 1.2;
      s.x += Math.cos(s.a) * 14 * dt;
      s.y += Math.sin(s.a) * 14 * dt;
      if (s.x < 3 || s.x > w - 3) (s.a = Math.PI - s.a), (s.x = clamp(s.x, 3, w - 3));
      if (s.y < 3 || s.y > h - 3) (s.a = -s.a), (s.y = clamp(s.y, 3, h - 3));
      if (!lysed && membraneSD(s.x, s.y) < 5) pushToSide(s, false), (s.a += Math.PI);
    }

    for (const s of solutesIn) {
      s.a += (rnd() - 0.5) * 1.2;
      s.u += Math.cos(s.a) * 0.06 * dt;
      s.v += Math.sin(s.a) * 0.06 * dt;
      const lim = state.cell === 'animal' ? s.u * s.u + s.v * s.v > 0.72 : Math.max(Math.abs(s.u), Math.abs(s.v)) > 0.8;
      if (lim) {
        s.a += Math.PI;
        s.u *= 0.97;
        s.v *= 0.97;
      }
    }

    for (const s of released) {
      s.x += Math.cos(s.a) * 40 * dt;
      s.y += Math.sin(s.a) * 40 * dt;
      s.life -= dt * 0.25;
    }
    released = released.filter((s) => s.life > 0);
    for (const f of fragments) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 0.97;
      f.vy *= 0.97;
    }
  }

  function innerSoluteXY(s: InnerSolute) {
    const half = state.cell === 'animal' ? geom.r : geom.protoH;
    return { x: geom.cx + s.u * half * 0.95, y: geom.cy + s.v * half * 0.95 };
  }

  /* ---------------- Lysis ---------------- */
  function lyse() {
    state.lysed = true;
    state.lysisClock = 0;
    state.flux = 0;
    current.lysedAt = state.t;
    for (const s of solutesIn) {
      const p = innerSoluteXY(s);
      released.push({ ...p, a: Math.atan2(p.y - geom.cy, p.x - geom.cx) + (rnd() - 0.5), life: 1 });
    }
    solutesIn = [];
    for (const w of waters) w.inside = false;
    fragments = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.08;
      const a1 = ((i + 1) / n) * Math.PI * 2 - 0.08;
      const mid = (a0 + a1) / 2;
      fragments.push({ x: geom.cx, y: geom.cy, vx: Math.cos(mid) * 60, vy: Math.sin(mid) * 60, a0, a1, r: geom.r });
    }
    announce('The cell burst. This is called hemolysis. Press Reset to try again.');
  }

  /* ---------------- Classification ---------------- */
  function tonicity(): { label: string; tone: string } {
    const ratio = state.cout / state.cin0;
    if (ratio < 0.97) return { label: 'Hypotonic', tone: 'tone-warn' };
    if (ratio > 1.03) return { label: 'Hypertonic', tone: 'tone-warn' };
    return { label: 'Isotonic', tone: 'tone-ok' };
  }

  function cellState(): { label: string; tone: string } {
    const { V, flux } = state;
    const moving = Math.abs(flux) > 0.002;
    if (state.cell === 'animal') {
      if (state.lysed) return { label: 'Burst (hemolysis)', tone: 'tone-bad' };
      if (V > 1.03) return { label: moving && flux > 0 ? 'Swelling' : 'Swollen', tone: V > 1.4 ? 'tone-bad' : 'tone-warn' };
      if (V < 0.97) return { label: moving && flux < 0 ? 'Shrinking' : V < 0.9 ? 'Crenated (shrunken)' : 'Shrunken', tone: 'tone-warn' };
      return { label: 'Normal', tone: 'tone-ok' };
    }
    if (V > 1.01) return { label: 'Turgid (firm)', tone: 'tone-ok' };
    if (V < 0.97) return { label: moving && flux < 0 ? 'Plasmolyzing' : 'Plasmolyzed', tone: 'tone-bad' };
    return { label: 'Flaccid (limp)', tone: 'tone-warn' };
  }

  function flowText() {
    if (state.lysed) return 'None (cell burst)';
    if (Math.abs(state.flux) < 0.002) return 'None (equilibrium)';
    return state.flux > 0 ? 'Into the cell' : 'Out of the cell';
  }

  /* ---------------- Drawing ---------------- */
  const main = fitCanvas(canvas, () => {
    rebuildParticles();
    draw();
  });
  const ctx = main.ctx;
  size = main.size;

  function roundBoxPath(half: number, r: number) {
    const x = geom.cx - half;
    const y = geom.cy - half;
    ctx.beginPath();
    ctx.roundRect(x, y, half * 2, half * 2, r);
  }

  function animalPath() {
    ctx.beginPath();
    const { cx, cy, r } = geom;
    const crenate = clamp((0.97 - state.V) * 0.32, 0, 0.075);
    if (crenate <= 0) {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      return;
    }
    const steps = 140;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const rr = r * (1 + crenate * Math.sin(a * 14));
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawArrow(x: number, y: number, ang: number, len: number) {
    const hx = x + Math.cos(ang) * len;
    const hy = y + Math.sin(ang) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - Math.cos(ang - 0.5) * 8, hy - Math.sin(ang - 0.5) * 8);
    ctx.lineTo(hx - Math.cos(ang + 0.5) * 8, hy - Math.sin(ang + 0.5) * 8);
    ctx.closePath();
    ctx.fill();
  }

  function label(text: string, x: number, y: number, lx: number, ly: number) {
    ctx.save();
    ctx.strokeStyle = pal['sim-text'];
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = '600 12px "IBM Plex Sans Variable", system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const bx = clamp(lx - tw / 2 - 8, 4, size.w - tw - 20);
    const by = clamp(ly - 11, 4, size.h - 26);
    ctx.fillStyle = pal['bg-elev'];
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + 16, 22, 11);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(text, bx + 8, by + 15);
    ctx.restore();
  }

  function draw() {
    updateGeom();
    const { w, h } = size;
    const { cx, cy } = geom;
    ctx.clearRect(0, 0, w, h);

    // Background, grid and a tint that deepens with outside solute concentration
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = pal['sim-grid'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 32) ctx.moveTo(x + 0.5, 0), ctx.lineTo(x + 0.5, h);
    for (let y = 0; y < h; y += 32) ctx.moveTo(0, y + 0.5), ctx.lineTo(w, y + 0.5);
    ctx.stroke();
    ctx.globalAlpha = (state.cout / 1200) * 0.13;
    ctx.fillStyle = pal['sim-solute'];
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // Outside water and solutes
    ctx.fillStyle = pal['sim-water'];
    ctx.globalAlpha = 0.55;
    for (const p of waters) if (!p.inside) ctx.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-solute'];
    for (const s of solutesOut) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of released) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (state.cell === 'plant') {
      // Cell wall (fully permeable to water and solutes)
      roundBoxPath(geom.wallH + 4, geom.wallH * 0.22 + 4);
      ctx.lineWidth = 7;
      ctx.strokeStyle = pal['sim-wall'];
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Cell body
    if (!state.lysed) {
      if (state.cell === 'animal') animalPath();
      else roundBoxPath(geom.protoH, geom.protoR);
      ctx.fillStyle = pal['sim-cytoplasm'];
      ctx.fill();

      if (state.cell === 'animal') {
        // Pale centre of a biconcave red blood cell fades as it swells into a sphere
        const dimple = clamp(1 - (state.V - 1) / 0.35, 0, 1) * (state.V > 0.9 ? 1 : 0.4);
        if (dimple > 0) {
          ctx.globalAlpha = 0.35 * dimple;
          ctx.fillStyle = pal['sim-bg'];
          ctx.beginPath();
          ctx.arc(cx, cy, geom.r * 0.42, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        // Central vacuole and chloroplasts
        roundBoxPath(geom.protoH * 0.62, geom.protoR * 0.62);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = pal['sim-water'];
        ctx.fill();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = pal['sim-water'];
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#3f9e4a';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          const reach = geom.protoH * 0.8 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
          const rr = Math.min(reach, geom.protoH * 0.95);
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * rr * 0.92, cy + Math.sin(a) * rr * 0.92, 8, 4.5, a + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Inside solutes and water
      ctx.fillStyle = pal['sim-solute'];
      for (const s of solutesIn) {
        const p = innerSoluteXY(s);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = pal['sim-water'];
      ctx.globalAlpha = 0.7;
      for (const p of waters) if (p.inside) ctx.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5);
      ctx.globalAlpha = 1;

      // Membrane
      if (state.cell === 'animal') animalPath();
      else roundBoxPath(geom.protoH, geom.protoR);
      ctx.lineWidth = 3;
      ctx.strokeStyle = pal['sim-membrane'];
      ctx.stroke();
    } else {
      // Burst membrane fragments drifting apart ("ghost" cell)
      ctx.strokeStyle = pal['sim-membrane'];
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      for (const f of fragments) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, f.a0, f.a1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Water molecules that just crossed the membrane glow briefly
    ctx.fillStyle = pal['sim-water'];
    for (const p of waters) {
      if (p.glow <= 0) continue;
      ctx.globalAlpha = p.glow * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + p.glow * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (state.labels && !state.lysed) {
      // Net flow arrows
      const f = state.flux;
      if (Math.abs(f) > 0.002) {
        const len = clamp(Math.abs(f) * 260, 10, 34);
        const ring = (state.cell === 'animal' ? geom.r : geom.wallH * 1.2) + 22;
        ctx.strokeStyle = pal['accent'];
        ctx.fillStyle = pal['accent'];
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const ox = cx + Math.cos(a) * (ring + (f > 0 ? len : 0));
          const oy = cy + Math.sin(a) * (ring + (f > 0 ? len : 0));
          drawArrow(ox, oy, f > 0 ? a + Math.PI : a, len);
        }
      }
      // Part labels
      const edge = state.cell === 'animal' ? geom.r : geom.protoH;
      label('Cell membrane', cx + edge * 0.72, cy - edge * 0.72, cx + edge * 1.25 + 30, cy - edge * 1.25 - 6);
      if (state.cell === 'plant') {
        label('Cell wall', cx - geom.wallH - 4, cy + geom.wallH * 0.6, cx - geom.wallH - 60, cy + geom.wallH + 22);
        label('Vacuole', cx, cy, cx, cy);
      } else {
        label('Cytoplasm', cx, cy + edge * 0.3, cx, cy + edge * 0.3);
      }
      label('Outside solution', 70, 26, 70, 26);
    }
  }

  /* ---------------- Graph ---------------- */
  const graph = fitCanvas(graphCanvas, () => drawGraph());
  const RUN_COLORS = ['accent-2', 'warning', 'text-faint'] as const;

  function newRun(): Run {
    return { label: '', color: 'accent', points: [{ t: 0, v: 1 }] };
  }
  function runLabel() {
    const cell = state.cell === 'animal' ? 'Animal' : 'Plant';
    return `${cell} · out ${state.cout} / in ${state.cin0} mOsm/L · ${state.perm}× permeability`;
  }

  function sample() {
    if (state.lysed && current.lysedAt !== undefined && lastSample >= current.lysedAt) return;
    if (state.t - lastSample >= 0.2) {
      lastSample = state.t;
      if (current.points.length < 1500) current.points.push({ t: state.t, v: state.V });
    }
  }

  function drawGraph() {
    const g = graph.ctx;
    const { w, h } = graph.size;
    g.clearRect(0, 0, w, h);
    const pad = { l: 46, r: 14, t: 10, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const all = [current, ...saved];
    const tMax = Math.max(30, Math.ceil(Math.max(...all.map((r) => r.points[r.points.length - 1]?.t ?? 0)) / 10) * 10);
    const vMin = 40;
    const vMax = 170;
    const X = (t: number) => pad.l + (t / tMax) * pw;
    const Y = (v: number) => pad.t + (1 - (v * 100 - vMin) / (vMax - vMin)) * ph;

    g.font = '11px "JetBrains Mono Variable", monospace';
    g.fillStyle = pal['text-faint'];
    g.strokeStyle = pal['sim-grid'];
    g.lineWidth = 1;
    for (let v = 40; v <= 160; v += 20) {
      const y = Y(v / 100);
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(w - pad.r, y);
      g.stroke();
      g.fillText(`${v}%`, 4, y + 4);
    }
    const tStep = tMax <= 30 ? 5 : tMax <= 80 ? 10 : 30;
    for (let t = 0; t <= tMax; t += tStep) g.fillText(`${t}s`, X(t) - 8, h - 10);

    // Reference lines
    const ref = (v: number, color: string, text: string) => {
      g.save();
      g.setLineDash([5, 5]);
      g.strokeStyle = color;
      g.beginPath();
      g.moveTo(pad.l, Y(v));
      g.lineTo(w - pad.r, Y(v));
      g.stroke();
      g.restore();
      g.fillStyle = color;
      g.fillText(text, pad.l + 6, Y(v) - 4);
    };
    ref(1, pal['border-strong'], 'starting size');
    if (state.cell === 'animal') ref(LYSIS_V, pal['danger'], 'bursts here');

    for (const run of [...saved, current]) {
      if (run.points.length < 2) continue;
      g.strokeStyle = pal[run.color as keyof Palette];
      g.lineWidth = run === current ? 2.5 : 2;
      g.beginPath();
      run.points.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(p.v)) : g.moveTo(X(p.t), Y(p.v))));
      g.stroke();
      if (run.lysedAt !== undefined) {
        const last = run.points[run.points.length - 1];
        g.fillStyle = pal['danger'];
        g.font = 'bold 14px sans-serif';
        g.fillText('✕', X(last.t) - 5, Y(last.v) + 5);
        g.font = '11px "JetBrains Mono Variable", monospace';
      }
    }
  }

  function renderLegend() {
    const legend = $('[data-legend]');
    const items = [{ label: 'Current run', color: 'accent' }, ...saved];
    legend.innerHTML = items
      .map((r) => `<li><span class="swatch" style="background:var(--${r.color})"></span>${r.label}</li>`)
      .join('');
    $<HTMLButtonElement>('[data-clear]').disabled = saved.length === 0;
  }

  /* ---------------- Readouts ---------------- */
  const r = {
    state: $('[data-r-state]'),
    tonicity: $('[data-r-tonicity]'),
    flow: $('[data-r-flow]'),
    vol: $('[data-r-vol]'),
    cin: $('[data-r-cin]'),
    cout: $('[data-r-cout]'),
    turgor: $('[data-r-turgor]'),
    psi: $('[data-r-psi]'),
    cross: $('[data-r-cross]'),
    time: $('[data-time]'),
  };

  function updateReadouts() {
    const cs = cellState();
    const ton = tonicity();
    r.state.textContent = cs.label;
    r.state.className = cs.tone;
    r.tonicity.textContent = ton.label;
    r.tonicity.className = ton.tone;
    r.flow.textContent = flowText();
    r.vol.textContent = state.lysed ? '—' : `${Math.round(state.V * 100)}%`;
    r.cin.textContent = state.lysed ? '—' : `${Math.round(cinNow())} mOsm/L`;
    r.cout.textContent = `${state.cout} mOsm/L`;
    r.time.textContent = `t = ${state.t.toFixed(1)} s`;
    if (r.cross) r.cross.textContent = state.lysed ? '—' : `${rateIn} in · ${rateOut} out`;
    if (state.cell === 'plant') {
      const P = turgor();
      r.turgor.textContent = `${Math.round(P * KPA_PER_MOSM)} kPa`;
      const psiIn = ((-cinNow() + P) * KPA_PER_MOSM) / 1000;
      const psiOut = (-state.cout * KPA_PER_MOSM) / 1000;
      r.psi.textContent = `${psiIn.toFixed(2)} / ${psiOut.toFixed(2)} MPa`;
    }
    badge.textContent = `${ton.label} · ${cs.label}`;
    canvas.setAttribute(
      'aria-label',
      `${state.cell === 'animal' ? 'Red blood cell' : 'Plant cell'} in a ${ton.label.toLowerCase()} solution ` +
        `(${state.cout} mOsm/L outside, ${state.lysed ? 'cell burst' : `${Math.round(cinNow())} inside`}). ` +
        `Cell state: ${cs.label}. Volume ${state.lysed ? 'not applicable' : `${Math.round(state.V * 100)}% of original`}. ` +
        `Net water flow: ${flowText()}.`,
    );
    $('[data-graph-desc]').textContent =
      `Graph of cell volume over time. Current run: ${state.lysed ? `cell burst at ${current.lysedAt?.toFixed(1)} seconds` : `${Math.round(state.V * 100)}% at ${state.t.toFixed(1)} seconds`}. ` +
      (saved.length ? `${saved.length} saved run${saved.length > 1 ? 's' : ''} for comparison.` : '');
    if (!state.lysed) announce(`Cell state: ${cs.label}. Net water flow: ${flowText()}.`);
  }

  /* ---------------- Loop ---------------- */
  const loop = createLoop((dt) => {
    stepPhysics(dt);
    moveParticles(dt);
    sample();
    if (state.lysed) {
      state.lysisClock += dt;
      if (state.lysisClock > 1.2 && overlay.hidden) showOverlay();
    }
    rateClock += dt;
    if (rateClock >= 1) {
      rateIn = Math.round(crossIn / rateClock);
      rateOut = Math.round(crossOut / rateClock);
      crossIn = crossOut = 0;
      rateClock = 0;
    }
    draw();
    drawGraph();
    readoutClock += dt;
    if (readoutClock > 0.15) {
      readoutClock = 0;
      updateReadouts();
    }
  }, stage);

  function showOverlay() {
    $('[data-overlay-title]').textContent = 'The cell burst (hemolysis)';
    $('[data-overlay-text]').textContent =
      'So much water entered that the membrane ruptured. Red blood cells have no cell wall to resist swelling. Try a higher outside concentration.';
    overlay.hidden = false;
  }

  /* ---------------- Controls ---------------- */
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const playLabel = $('[data-play-label]');
  function setPlaying(on: boolean) {
    if (on) loop.start();
    else loop.pause();
    playBtn.setAttribute('aria-pressed', String(on));
    playLabel.textContent = on ? 'Pause' : 'Start';
  }
  playBtn.addEventListener('click', () => setPlaying(!loop.running));

  function redrawStatic() {
    if (!loop.running) {
      draw();
      drawGraph();
      updateReadouts();
    }
  }

  function resetCell() {
    state.V = 1;
    state.t = 0;
    state.flux = 0;
    state.lysed = false;
    state.lysisClock = 0;
    released = [];
    fragments = [];
    current = newRun();
    lastSample = 0;
    overlay.hidden = true;
    rebuildParticles();
    updateReadouts();
    redrawStatic();
  }

  const outCtl = bindRange($<HTMLInputElement>('[data-out]'), $('[data-out-val]'), (v) => `${v} mOsm/L`, (v) => {
    state.cout = v;
    syncOutsideSolutes();
    markPreset();
    redrawStatic();
  });
  const inCtl = bindRange($<HTMLInputElement>('[data-in]'), $('[data-in-val]'), (v) => `${v} mOsm/L`, (v) => {
    state.cin0 = v;
    resetCell();
  });
  const permCtl = bindRange($<HTMLInputElement>('[data-perm]'), $('[data-perm-val]'), (v) => `${v.toFixed(2).replace(/0$/, '')}×`, (v) => {
    state.perm = v;
    redrawStatic();
  });

  const presets = $$<HTMLButtonElement>('[data-preset]');
  function markPreset() {
    presets.forEach((p) => p.setAttribute('aria-pressed', String(Number(p.dataset.preset) === state.cout)));
  }
  presets.forEach((p) => p.addEventListener('click', () => outCtl.set(Number(p.dataset.preset))));
  markPreset();

  $$<HTMLInputElement>('[data-celltype]').forEach((input) =>
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.cell = input.value as CellType;
      $$('.plant-only').forEach((el) => (el.hidden = state.cell !== 'plant'));
      hideTooltip();
      resetCell();
    }),
  );

  $<HTMLInputElement>('[data-labels]').addEventListener('change', (e) => {
    state.labels = (e.target as HTMLInputElement).checked;
    redrawStatic();
  });

  $('[data-reset]').addEventListener('click', () => {
    outCtl.set(DEFAULTS.cout, false);
    state.cout = DEFAULTS.cout;
    inCtl.set(DEFAULTS.cin, false);
    state.cin0 = DEFAULTS.cin;
    permCtl.set(DEFAULTS.perm, false);
    state.perm = DEFAULTS.perm;
    markPreset();
    hideTooltip();
    resetCell();
  });
  $('[data-overlay-reset]').addEventListener('click', resetCell);

  $('[data-save]').addEventListener('click', () => {
    if (current.points.length < 2) return;
    const run: Run = {
      ...current,
      points: [...current.points],
      label: runLabel(),
      color: RUN_COLORS[saved.length % RUN_COLORS.length],
    };
    if (saved.length >= 3) saved.shift();
    saved.push(run);
    saved.forEach((s, i) => (s.color = RUN_COLORS[i]));
    renderLegend();
    resetCell(); // start a fresh cell so the next run is comparable from t = 0
    drawGraph();
    announce(`Run saved for comparison: ${run.label}. A fresh cell has started.`);
  });
  $('[data-clear]').addEventListener('click', () => {
    saved.length = 0;
    renderLegend();
    drawGraph();
  });

  /* ---------------- Click / tap to inspect ---------------- */
  let tipTimer = 0;
  function hideTooltip() {
    tooltip.hidden = true;
  }
  function describe(x: number, y: number): { title: string; text: string } {
    for (const s of solutesIn) {
      const p = innerSoluteXY(s);
      if (Math.hypot(p.x - x, p.y - y) < 8)
        return {
          title: 'Solute particle (inside)',
          text: `Dissolved particles such as ions, sugars and proteins. They are too large or charged to cross the membrane, so the cell keeps the same amount of solute — only its water changes. Inside now: ${Math.round(cinNow())} mOsm/L.`,
        };
    }
    for (const s of solutesOut) {
      if (Math.hypot(s.x - x, s.y - y) < 7)
        return {
          title: 'Solute particle (outside)',
          text: `This solute cannot pass through the membrane. More solute outside means a higher outside concentration (${state.cout} mOsm/L), which draws water out of the cell.`,
        };
    }
    if (!state.lysed) {
      const d = membraneSD(x, y);
      if (Math.abs(d) < 7)
        return {
          title: 'Cell membrane',
          text: 'A selectively permeable lipid bilayer. Water crosses it (directly and through aquaporin channels), but solute particles cannot.',
        };
      if (state.cell === 'plant') {
        const dw = wallSD(x, y);
        if (Math.abs(dw) < 9)
          return {
            title: 'Cell wall',
            text: 'A rigid layer of cellulose. It lets water and solutes pass freely but resists stretching, which creates turgor pressure and stops the cell from bursting.',
          };
        if (d > 0 && dw < 0)
          return {
            title: 'Gap between wall and membrane',
            text: 'The protoplast has pulled away from the wall (plasmolysis). Because the wall is fully permeable, this space fills with the outside solution.',
          };
        if (d < 0)
          return {
            title: 'Protoplast and central vacuole',
            text: `The living contents of the plant cell. The large central vacuole stores water; it shrinks when water leaves. Turgor pressure: ${Math.round(turgor() * KPA_PER_MOSM)} kPa.`,
          };
      } else if (d < 0) {
        return {
          title: 'Cytoplasm',
          text: `The cell’s interior. Its solute concentration is ${Math.round(cinNow())} mOsm/L and the cell is at ${Math.round(state.V * 100)}% of its starting volume.`,
        };
      }
    }
    const ton = tonicity().label.toLowerCase();
    return {
      title: 'Outside solution',
      text: `${state.cout} mOsm/L of solute. Compared with the cell’s starting contents (${state.cin0} mOsm/L), this solution is ${ton}. Water molecules (small blue dots) move in all directions.`,
    };
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const info = describe(x, y);
    tooltip.innerHTML = `<strong>${info.title}</strong>${info.text}`;
    tooltip.hidden = false;
    hint.hidden = true;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    tooltip.style.left = `${clamp(x + 14, 8, rect.width - tw - 8)}px`;
    tooltip.style.top = `${clamp(y + 14, 8, rect.height - th - 8)}px`;
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(hideTooltip, 6000);
    redrawStatic();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hideTooltip());

  /* ---------------- Theme ---------------- */
  onThemeChange(() => {
    pal = readPalette(PALETTE);
    draw();
    drawGraph();
  });

  /* ---------------- Start ---------------- */
  renderLegend();
  rebuildParticles();
  updateReadouts();
  draw();
  drawGraph();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setPlaying(!reduce);
}
