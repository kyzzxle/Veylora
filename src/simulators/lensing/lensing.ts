/**
 * Gravitational lensing by a black hole (point-mass lens).
 *
 * For every pixel θ on screen (measured from the black hole) the light came
 * from the source-plane position given by the lens equation
 *   β = θ − θE² θ / |θ|²
 * where θE is the Einstein radius, proportional to √mass. The background
 * picture is sampled at β, which produces two images of each star, arcs,
 * and a full Einstein ring when a source sits directly behind the lens.
 *
 * Brightening of a point source at separation u = β/θE:
 *   A = (u² + 2) / (u √(u² + 4))
 * which gives the classic microlensing light curve as the lens drifts past.
 *
 * Real values (lens 1 kpc away, source 8 kpc away):
 *   Schwarzschild radius r_s = 2GM/c² ≈ 2.95 km × (M / M☉)
 *   Einstein radius θE ≈ 2.67 milliarcseconds × √(M / M☉)
 * The view is hugely magnified, and the black hole's dark "shadow" is drawn
 * far larger than it would really appear next to the Einstein ring.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-text', 'text-faint', 'bg-elev', 'accent', 'warning'] as const;
const NICE = [1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100];

export function initLensing(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => {
    makeBackground();
    sim.requestRender();
  });
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const st = { M: 10, bg: 'galaxy' as 'galaxy' | 'stars', ring: true, lensOn: true };
  // Positions are fractions of the view so they survive resizing
  const lens = { x: 0.25, y: 0.56 };
  const source = { x: 0.5, y: 0.5 };
  let t = 0;
  let curve: Point[] = [];

  /* ---------- Background sky ---------- */
  const bgCanvas = document.createElement('canvas');
  const outCanvas = document.createElement('canvas');
  let bgPixels: Uint32Array | null = null;
  let bw = 0;
  let bh = 0;

  function makeBackground() {
    bw = Math.max(1, size.w);
    bh = Math.max(1, size.h);
    bgCanvas.width = outCanvas.width = bw;
    bgCanvas.height = outCanvas.height = bh;
    const g = bgCanvas.getContext('2d')!;
    g.fillStyle = '#05070f';
    g.fillRect(0, 0, bw, bh);
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    // faint nebula patches
    for (let i = 0; i < 6; i++) {
      const x = rnd() * bw;
      const y = rnd() * bh;
      const r = 60 + rnd() * 120;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, ['rgba(80,60,160,0.18)', 'rgba(40,110,160,0.16)', 'rgba(150,60,110,0.14)'][i % 3]);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // stars
    const n = Math.round((bw * bh) / 900);
    for (let i = 0; i < n; i++) {
      const x = rnd() * bw;
      const y = rnd() * bh;
      const b = rnd();
      g.fillStyle = ['#ffffff', '#cfe0ff', '#ffe6c4', '#ffd0a8'][Math.floor(rnd() * 4)];
      g.globalAlpha = 0.4 + b * 0.6;
      g.fillRect(x, y, b > 0.93 ? 2 : 1, b > 0.93 ? 2 : 1);
    }
    g.globalAlpha = 1;
    const sx = source.x * bw;
    const sy = source.y * bh;
    if (st.bg === 'galaxy') {
      // a distant spiral galaxy behind the lens
      g.save();
      g.translate(sx, sy);
      g.rotate(-0.4);
      g.scale(1, 0.55);
      const core = g.createRadialGradient(0, 0, 0, 0, 0, 70);
      core.addColorStop(0, 'rgba(255,240,210,1)');
      core.addColorStop(0.25, 'rgba(240,200,150,0.7)');
      core.addColorStop(1, 'rgba(120,120,200,0)');
      g.fillStyle = core;
      g.beginPath();
      g.arc(0, 0, 70, 0, Math.PI * 2);
      g.fill();
      for (let arm = 0; arm < 2; arm++) {
        for (let k = 0; k < 220; k++) {
          const a = arm * Math.PI + k * 0.03;
          const r = 8 + k * 0.32;
          g.fillStyle = `rgba(${170 + rnd() * 80}, ${190 + rnd() * 60}, 255, ${0.5 - k / 600})`;
          g.beginPath();
          g.arc(Math.cos(a) * r + (rnd() - 0.5) * 6, Math.sin(a) * r + (rnd() - 0.5) * 6, 1.2 + rnd() * 1.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
    } else {
      // one bright marked source star
      const grad = g.createRadialGradient(sx, sy, 0, sx, sy, 7);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#ffe9b8');
      grad.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(sx, sy, 7, 0, Math.PI * 2);
      g.fill();
    }
    bgPixels = new Uint32Array(g.getImageData(0, 0, bw, bh).data.buffer.slice(0));
  }

  /* ---------- Physics helpers ---------- */
  const thetaE = () => 0.11 * Math.min(size.w, size.h) * Math.sqrt(st.M / 10);
  const separation = () => Math.hypot((source.x - lens.x) * size.w, (source.y - lens.y) * size.h) / thetaE();
  const magnification = (u: number) => (u < 1e-4 ? 1e4 : (u * u + 2) / (u * Math.sqrt(u * u + 4)));

  /* ---------- Render ---------- */
  function render() {
    const { w, h } = size;
    if (!bgPixels || bw !== w || bh !== h) makeBackground();
    const out = outCanvas.getContext('2d')!;
    const img = out.createImageData(bw, bh);
    const dst = new Uint32Array(img.data.buffer);
    const src = bgPixels!;
    const lx = lens.x * bw;
    const ly = lens.y * bh;
    const E2 = thetaE() ** 2;
    const shadow = thetaE() * 0.2;
    const s2 = shadow * shadow;
    if (st.lensOn) {
      for (let y = 0; y < bh; y++) {
        const dy = y - ly;
        for (let x = 0; x < bw; x++) {
          const dx = x - lx;
          const r2 = dx * dx + dy * dy;
          const i = y * bw + x;
          if (r2 < s2) {
            dst[i] = 0xff000000;
            continue;
          }
          const k = 1 - E2 / r2;
          // wrap around the edges so the sky has no seams
          let sx = Math.round(lx + dx * k) % bw;
          let sy = Math.round(ly + dy * k) % bh;
          if (sx < 0) sx += bw;
          if (sy < 0) sy += bh;
          dst[i] = src[sy * bw + sx];
        }
      }
    } else dst.set(src);
    out.putImageData(img, 0, 0);
    ctx.drawImage(outCanvas, 0, 0, w, h);

    // Black hole overlays
    if (st.lensOn) {
      ctx.strokeStyle = 'rgba(255, 170, 80, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, ly, shadow * 1.05, 0, Math.PI * 2);
      ctx.stroke();
      if (st.ring) {
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = 'rgba(120, 200, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lx, ly, thetaE(), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(120, 200, 255, 0.8)';
        ctx.font = font(11, 650);
        ctx.fillText('Einstein radius', lx + thetaE() * 0.72 + 4, ly - thetaE() * 0.72);
      }
    } else {
      ctx.strokeStyle = 'rgba(255, 170, 80, 0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(lx, ly, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Mark the source
    const sx = source.x * w;
    const sy = source.y * h;
    ctx.strokeStyle = 'rgba(255, 220, 120, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 16, sy);
    ctx.lineTo(sx - 9, sy);
    ctx.moveTo(sx + 9, sy);
    ctx.lineTo(sx + 16, sy);
    ctx.moveTo(sx, sy - 16);
    ctx.lineTo(sx, sy - 9);
    ctx.moveTo(sx, sy + 9);
    ctx.lineTo(sx, sy + 16);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 220, 120, 0.9)';
    ctx.font = font(11, 650);
    ctx.fillText(st.bg === 'galaxy' ? 'True position of the galaxy' : 'True position of the star', sx + 18, sy + 30);

    updateReadouts();
    sim.setTime(t);
    drawGraph();
  }

  function updateReadouts() {
    ui.readout('mass', `${st.M} × the Sun`);
    ui.readout('rs', `${(2.95 * st.M).toFixed(1)} km (event horizon radius)`);
    ui.readout('thetaE', `${(2.67 * Math.sqrt(st.M)).toFixed(1)} milliarcseconds`);
    const u = separation();
    const A = st.lensOn ? magnification(u) : 1;
    ui.readout('mag', A > 100 ? 'over 100 ×' : `${A.toFixed(2)} ×`, A > 1.34 ? 'ok' : null);
    ui.readout('images', !st.lensOn ? 'Lensing off' : u < 0.08 ? 'An Einstein ring' : u < 1 ? 'Two bright images (strong lensing)' : 'Two images, one faint and close to the black hole');
    sim.setBadge(u < 0.08 && st.lensOn ? 'Einstein ring!' : 'Black hole');
  }

  /* ---------- Graph: brightness of the source over time ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ln-graph"]')!, {
    x: { min: 0, span: 12, format: (x) => `${x.toFixed(0)}s` },
    y: { min: 0, max: 10, step: 2, format: (v) => `${v}×` },
    refs: [{ value: 1, label: 'Normal brightness', color: 'text-faint' }],
  });
  function drawGraph() {
    const peak = Math.max(4, ...curve.map((p) => p.y));
    graph.opts.y = { min: 0, max: Math.ceil(peak / 2) * 2, step: Math.ceil(peak / 2) * 2 > 10 ? 5 : 2, format: (v) => `${v}×` };
    graph.opts.x = { min: 0, span: 12, max: Math.max(12, t), format: (x) => `${x.toFixed(0)}s` };
    graph.set('a', { label: 'Brightening of the source', color: 'accent', points: curve });
    graph.draw();
  }

  /* ---------- Animation: the black hole drifts across ---------- */
  function step(dt: number) {
    t += dt;
    lens.x += dt * 0.045;
    curve.push({ x: t, y: Math.min(st.lensOn ? magnification(separation()) : 1, 50) });
    if (lens.x > 0.95) {
      sim.pause();
      sim.announce('The black hole has drifted past. The graph shows the microlensing light curve.');
    }
  }

  /* ---------- Interaction ---------- */
  enableDrag<'lens'>(canvas, {
    hit: (x, y) => (Math.hypot(x - lens.x * size.w, y - lens.y * size.h) < Math.max(26, thetaE() * 0.35) ? 'lens' : null),
    move: (_id, x, y) => {
      lens.x = clamp(x / size.w, 0.02, 0.98);
      lens.y = clamp(y / size.h, 0.02, 0.98);
      sim.requestRender();
    },
    click: (x, y) => {
      if (Math.hypot(x - source.x * size.w, y - source.y * size.h) < 30)
        sim.showTooltip(x, y, 'The background source', 'Its light really comes from here. With the black hole in front, you see it in different places, stretched and brightened.');
      else sim.hideTooltip();
    },
  });
  canvas.addEventListener('keydown', (e) => {
    const d = 0.01;
    const k: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    if (!k[e.key]) return;
    e.preventDefault();
    lens.x = clamp(lens.x + k[e.key][0], 0.02, 0.98);
    lens.y = clamp(lens.y + k[e.key][1], 0.02, 0.98);
    sim.requestRender();
  });
  canvas.tabIndex = 0;

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const massFromSlider = (v: number) => NICE[clamp(Math.round(v), 0, NICE.length - 1)];
  const mass = ui.range('ln-mass', (v) => `${massFromSlider(v)} × the Sun`, (v) => ((st.M = massFromSlider(v)), sim.requestRender()));
  const bgCtl = ui.choice<'galaxy' | 'stars'>('ln-bg', (v) => {
    st.bg = v;
    makeBackground();
    sim.requestRender();
  });
  const ringCtl = ui.toggle('ln-ring', (v) => ((st.ring = v), sim.requestRender()));
  const lensCtl = ui.toggle('ln-on', (v) => ((st.lensOn = v), sim.requestRender()));
  root.querySelector('[data-align]')!.addEventListener('click', () => {
    lens.x = source.x;
    lens.y = source.y;
    sim.requestRender();
  });

  function restart() {
    t = 0;
    curve = [];
    lens.x = 0.08;
    lens.y = clamp(lens.y, 0.02, 0.98);
  }

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    // Each run sends the black hole across from the left at the current height
    onPlayChange: (playing) => {
      if (playing && (lens.x > 0.9 || t === 0)) restart();
    },
    reset() {
      Object.assign(st, { M: 10, bg: 'galaxy', ring: true, lensOn: true });
      mass.set(NICE.indexOf(10), false);
      bgCtl.set('galaxy', false);
      ringCtl.set(true, false);
      lensCtl.set(true, false);
      lens.y = 0.56;
      restart();
      lens.x = 0.25;
      makeBackground();
    },
  });
}
