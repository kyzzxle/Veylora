/**
 * Reaction rates with collision theory.
 * Acid particles move with random speeds whose spread grows with √T (a 2D
 * Maxwell–Boltzmann-like distribution). A collision with an exposed solid atom
 * succeeds only if the particle's kinetic energy exceeds the activation energy Eₐ.
 * The fraction of energetic particles ≈ exp(−Eₐ / kT), so a modest temperature
 * rise gives a large rate increase; a catalyst lowers Eₐ.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'sim-water', 'success', 'warning'] as const;
const SIGMA0 = 95; // px/s speed spread at 300 K
const EA = 4.6; // activation energy in units of σ₀² (≈10% of particles energetic at 300 K)
const EA_CAT = 2.3;
const SOLID_ATOMS = 64;
const DEF = { T: 300, n: 70, pieces: 1, cat: false };

interface A {
  x: number;
  y: number;
  vx: number;
  vy: number;
  done: boolean;
  flash: number;
}
interface BAtom {
  x: number;
  y: number;
  piece: number;
  i: number;
  j: number;
  side: number;
  size: number;
  gone: boolean;
  exposed: boolean;
}

const gauss = () => {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
};

export function initRates(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  let acids: A[] = [];
  let solid: BAtom[] = [];
  let products = 0;
  let t = 0;
  let pts: Point[] = [{ x: 0, y: 0 }];
  let collWin: number[] = [];
  let succWin: number[] = [];

  const sigma = () => SIGMA0 * Math.sqrt(p.T / 300);
  const box = () => ({ x0: 20, y0: 20, x1: size.w - 20, y1: size.h - 20 });

  function newVelocity() {
    const s = sigma();
    return { vx: gauss() * s, vy: gauss() * s };
  }

  function buildSolid() {
    solid = [];
    const { x0, y0, x1, y1 } = box();
    const g = Math.round(Math.sqrt(p.pieces)); // pieces arranged in a g × g grid
    const side = 8 / g; // atoms along each edge of a piece
    const gap = Math.max(9, Math.min(14, (Math.min(x1 - x0, y1 - y0) - 60) / 12));
    const spacing = gap * 2.2;
    const total = g * side * gap + (g - 1) * spacing;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2 + 14;
    let k = 0;
    for (let gx = 0; gx < g; gx++)
      for (let gy = 0; gy < g; gy++, k++) {
        const px = cx - total / 2 + gx * (side * gap + spacing);
        const py = cy - total / 2 + gy * (side * gap + spacing);
        for (let i = 0; i < side; i++)
          for (let j = 0; j < side; j++)
            solid.push({ x: px + (i + 0.5) * gap, y: py + (j + 0.5) * gap, piece: k, i, j, side, gone: false, exposed: false, size: gap - 2 });
      }
    updateExposed();
  }
  /** An atom is on the surface if any of its four neighbours within its piece is missing. */
  function updateExposed() {
    const alive = new Set(solid.filter((b) => !b.gone).map((b) => `${b.piece},${b.i},${b.j}`));
    const here = (b: BAtom, di: number, dj: number) => {
      const i = b.i + di;
      const j = b.j + dj;
      if (i < 0 || j < 0 || i >= b.side || j >= b.side) return false;
      return alive.has(`${b.piece},${i},${j}`);
    };
    for (const b of solid) b.exposed = !b.gone && !(here(b, 1, 0) && here(b, -1, 0) && here(b, 0, 1) && here(b, 0, -1));
  }

  function restart() {
    const { x0, y0, x1, y1 } = box();
    acids = Array.from({ length: p.n }, () => ({ x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0) * 0.22, ...newVelocity(), done: false, flash: 0 }));
    buildSolid();
    products = 0;
    t = 0;
    pts = [{ x: 0, y: 0 }];
    collWin = [];
    succWin = [];
    sim?.requestRender();
  }

  /* ---------- Simulation ---------- */
  function step(dt: number) {
    const { x0, y0, x1, y1 } = box();
    const ea = (p.cat ? EA_CAT : EA) * SIGMA0 * SIGMA0;
    let changed = false;
    t += dt;
    for (const a of acids) {
      a.flash = Math.max(0, a.flash - dt * 2);
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < x0 || a.x > x1) (a.vx *= -1), (a.x = Math.max(x0, Math.min(x1, a.x)));
      if (a.y < y0 || a.y > y1) (a.vy *= -1), (a.y = Math.max(y0, Math.min(y1, a.y)));
      if (a.done) continue;
      // Occasionally re-randomize speed (collisions with water keep the distribution thermal)
      if (Math.random() < dt * 0.8) Object.assign(a, newVelocity());
      for (const b of solid) {
        if (b.gone || !b.exposed) continue;
        const reach = b.size / 2 + 4;
        if (Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach) {
          collWin.push(t);
          const ke = (a.vx * a.vx + a.vy * a.vy) / 2;
          if (ke > ea / 2) {
            b.gone = true;
            a.done = true;
            a.flash = 1;
            products++;
            succWin.push(t);
            changed = true;
          } else {
            // Bounce away from the atom's centre
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            if (Math.abs(dx) > Math.abs(dy)) a.vx = Math.sign(dx || 1) * Math.abs(a.vx);
            else a.vy = Math.sign(dy || 1) * Math.abs(a.vy);
          }
          break;
        }
      }
    }
    if (changed) updateExposed();
    collWin = collWin.filter((x) => x > t - 2);
    succWin = succWin.filter((x) => x > t - 2);
    const last = pts[pts.length - 1];
    if (t - last.x >= 0.25) pts.push({ x: t, y: products });
    if (products >= SOLID_ATOMS || acids.every((a) => a.done)) {
      pts.push({ x: t, y: products });
      sim.pause();
      sim.announce('The reaction has finished.');
    }
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="rr-graph"]')!, {
    x: { min: 0, span: 30, step: 10, format: (v) => `${v}s` },
    y: { min: 0, max: SOLID_ATOMS, step: 16, format: (v) => `${v}` },
  });
  const label = () => `${p.T} K, ${p.n} acid, ${p.pieces === 1 ? 'lump' : p.pieces === 4 ? 'chunks' : 'powder'}${p.cat ? ', catalyst' : ''}`;
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="rr-graph"]')!, graph, { currentId: 'cur', label, onSave: restart });

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { x0, y0, x1, y1 } = box();
    // Beaker
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0 - 6, y0 - 6);
    ctx.lineTo(x0 - 6, y1 + 6);
    ctx.lineTo(x1 + 6, y1 + 6);
    ctx.lineTo(x1 + 6, y0 - 6);
    ctx.stroke();
    // Solid
    for (const b of solid) {
      if (b.gone) continue;
      ctx.fillStyle = b.exposed ? pal['border-strong'] : pal['text-faint'];
      ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }
    // Particles
    for (const a of acids) {
      if (a.flash > 0) {
        ctx.fillStyle = pal.warning;
        ctx.globalAlpha = a.flash * 0.6;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 6 + a.flash * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = a.done ? pal.success : pal['sim-water'];
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.done ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Energy hint: fraction of particles above Ea
    const frac = Math.exp(-((p.cat ? EA_CAT : EA) / 2) * (300 / p.T)); // P(KE > Eₐ) for this speed distribution
    pill(ctx, `${p.T} K · ${(frac * 100).toFixed(0)}% of particles have enough energy`, x0 + 6, y0 + 12, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size, 'left');

    const rate = succWin.length / 2;
    const coll = collWin.length / 2;
    const exposed = solid.filter((b) => !b.gone && b.exposed).length;
    ui.readout('rate', `${rate.toFixed(1)} per second`);
    ui.readout('prod', `${products} of ${SOLID_ATOMS}`);
    ui.readout('coll', coll.toFixed(1));
    ui.readout('succ', coll > 0 ? `${Math.round((rate / coll) * 100)}%` : '—');
    ui.readout('exposed', String(exposed));
    sim.setTime(t);
    sim.setBadge(products >= SOLID_ATOMS ? 'Reaction complete' : `${products} reacted`);
    canvas.setAttribute('aria-label', `Reaction at ${p.T} kelvin with ${p.n} acid particles and the solid as ${p.pieces === 1 ? 'one lump' : p.pieces === 4 ? 'chunks' : 'powder'}${p.cat ? ' with a catalyst' : ''}. ${products} of ${SOLID_ATOMS} solid atoms have reacted.`);

    graph.set('cur', { label: 'Current run', color: 'success', points: pts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="rr-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const tCtl = ui.range('rr-temp', (v) => `${v} K`, (v) => {
    p.T = v;
    for (const a of acids) Object.assign(a, newVelocity());
    sim.requestRender();
  });
  const nCtl = ui.range('rr-conc', (v) => `${v} particles`, (v) => ((p.n = v), restart()));
  const sizeCtl = ui.choice<string>('rr-size', (v) => ((p.pieces = Number(v)), restart()));
  const catCtl = ui.toggle('rr-cat', (v) => ((p.cat = v), sim.requestRender()));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const a = acids.find((q) => Math.hypot(q.x - x, q.y - y) < 9);
    if (a) {
      const ke = (a.vx * a.vx + a.vy * a.vy) / 2;
      const ea = ((p.cat ? EA_CAT : EA) * SIGMA0 * SIGMA0) / 2;
      sim.showTooltip(x, y, a.done ? 'Product particle' : 'Acid particle', a.done ? 'This particle has reacted with an atom of the solid.' : `Its energy is ${Math.round((ke / ea) * 100)}% of the activation energy — ${ke > ea ? 'enough' : 'not enough'} to react if it hits the solid’s surface.`);
    } else if (solid.some((b) => !b.gone && Math.abs(b.x - x) < b.size && Math.abs(b.y - y) < b.size)) {
      sim.showTooltip(x, y, 'Solid reactant', 'Only atoms on the surface can be reached by acid particles. Breaking the solid into smaller pieces exposes more surface.');
    }
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      tCtl.set(DEF.T, false);
      nCtl.set(DEF.n, false);
      sizeCtl.set('1', false);
      catCtl.set(false, false);
      Object.assign(p, DEF);
      restart();
    },
  });
  restart();
  comparer.refresh();
}
