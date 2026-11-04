/**
 * Planetary orbits under Newtonian gravity.
 * Units: AU, years, solar masses, so GM = 4π²·M.
 * Integrated with velocity Verlet (energy-conserving) using small sub-steps.
 * Orbit shape from conserved quantities:
 *   energy  ε = v²/2 − GM/r,   a = −GM/(2ε)
 *   ang. momentum h = |r × v|,  e = √(1 + 2εh²/(GM)²)
 *   period (bound)  T = √(a³ / M)  years   (Kepler's third law)
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, pill } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'bg-elev', 'border-strong', 'warning', 'sim-water'] as const;
const KMS_PER_AU_YR = 4.74;
const DEF = { speed: 100, dir: 0, dist: 1, mass: 1 };

export function initOrbits(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF, areas: false, vectors: true, predict: true };
  const s = { x: 1, y: 0, vx: 0, vy: 0, t: 0, launched: false, done: '' as '' | 'escaped' | 'crashed' };
  let trail: { x: number; y: number }[] = [];
  let wedges: { x: number; y: number }[][] = [];
  let wedgeStart = 0;
  let wedgePts: { x: number; y: number }[] = [];
  const speedPts: Point[] = [];

  const GM = () => 4 * Math.PI * Math.PI * p.mass;

  function initialState() {
    const vc = Math.sqrt(GM() / p.dist);
    const v = (vc * p.speed) / 100;
    const d = (p.dir * Math.PI) / 180;
    // Start on the +x axis; "sideways" is +y. Positive direction tilts outward (+x).
    return { x: p.dist, y: 0, vx: v * Math.sin(d), vy: v * Math.cos(d) };
  }

  function elements(st: { x: number; y: number; vx: number; vy: number }) {
    const r = Math.hypot(st.x, st.y);
    const v2 = st.vx ** 2 + st.vy ** 2;
    const eps = v2 / 2 - GM() / r;
    const hmom = st.x * st.vy - st.y * st.vx;
    const e = Math.sqrt(Math.max(0, 1 + (2 * eps * hmom * hmom) / GM() ** 2));
    const bound = eps < 0;
    const a = bound ? -GM() / (2 * eps) : Infinity;
    const T = bound ? Math.sqrt(a ** 3 / p.mass) : Infinity;
    const rp = (hmom * hmom) / GM() / (1 + e);
    const ra = bound && e < 1 ? a * (1 + e) : Infinity;
    return { r, e, a, T, rp, ra, bound, hmom };
  }

  function reset() {
    Object.assign(s, initialState(), { t: 0, launched: false, done: '' });
    trail = [{ x: s.x, y: s.y }];
    wedges = [];
    wedgePts = [{ x: s.x, y: s.y }];
    wedgeStart = 0;
    speedPts.length = 0;
    sim?.hideOverlay();
  }

  /* ---------- View scale ---------- */
  function viewRadius() {
    const el = elements(initialState());
    const far = el.bound && el.ra < 8 ? el.ra : Math.max(p.dist * 3, 3);
    return Math.max(far, p.dist) * 1.15;
  }
  let viewR = 1.2;
  const scale = () => Math.min(size.w, size.h) / 2 / viewR;
  const X = (x: number) => size.w / 2 + x * scale();
  const Y = (y: number) => size.h / 2 - y * scale();

  /* ---------- Physics ---------- */
  function accel(x: number, y: number) {
    const r = Math.hypot(x, y);
    const f = -GM() / (r * r * r);
    return { ax: f * x, ay: f * y };
  }

  function step(dt: number) {
    if (s.done) return;
    s.launched = true;
    // Simulation runs at 0.4 years per second; sub-step size adapts to distance.
    let remaining = dt * 0.4;
    while (remaining > 0) {
      const r = Math.hypot(s.x, s.y);
      const h = Math.min(remaining, 0.0008 * r ** 1.5);
      const a1 = accel(s.x, s.y);
      s.x += s.vx * h + 0.5 * a1.ax * h * h;
      s.y += s.vy * h + 0.5 * a1.ay * h * h;
      const a2 = accel(s.x, s.y);
      s.vx += 0.5 * (a1.ax + a2.ax) * h;
      s.vy += 0.5 * (a1.ay + a2.ay) * h;
      s.t += h;
      remaining -= h;
      const nr = Math.hypot(s.x, s.y);
      if (nr < 0.03) {
        s.done = 'crashed';
        break;
      }
      if (nr > viewR * 2.5) {
        s.done = 'escaped';
        break;
      }
    }
    trail.push({ x: s.x, y: s.y });
    if (trail.length > 3000) trail.shift();
    speedPts.push({ x: s.t, y: Math.hypot(s.vx, s.vy) * KMS_PER_AU_YR });
    if (speedPts.length > 2000) speedPts.shift();

    // Equal-area wedges: one wedge per 1/12 of the period
    const el = elements(s);
    if (el.bound && el.T < 50) {
      wedgePts.push({ x: s.x, y: s.y });
      if (s.t - wedgeStart >= el.T / 12) {
        wedges.push(wedgePts);
        if (wedges.length > 12) wedges.shift();
        wedgePts = [{ x: s.x, y: s.y }];
        wedgeStart = s.t;
      }
    }
    if (s.done) {
      sim.pause();
      sim.showOverlay(
        s.done === 'escaped' ? 'The planet escaped' : 'The planet fell into the star',
        s.done === 'escaped'
          ? 'It was moving faster than escape speed (√2 ≈ 141% of circular speed), so gravity could not pull it back.'
          : 'It was moving too slowly — or aimed too far inward — to stay in orbit.',
        { label: 'Try again', onClick: () => (reset(), sim.requestRender()) },
      );
    }
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="or-graph"]')!, {
    x: { min: 0, span: 2, step: 1, format: (v) => `${v} yr` },
    y: { min: 0, max: 80, step: 20, format: (v) => `${v}` },
  });

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Distance rings (1 AU apart)
    ctx.strokeStyle = pal['sim-grid'];
    ctx.lineWidth = 1;
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(10, 500, 'mono');
    for (let r = 1; r <= viewR * 1.5; r++) {
      ctx.beginPath();
      ctx.arc(X(0), Y(0), r * scale(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${r} AU`, X(0) + r * scale() + 4, Y(0) - 4);
    }

    // Equal-area wedges
    if (p.areas) {
      wedges.forEach((wd, i) => {
        ctx.fillStyle = i % 2 ? pal.accent : pal['accent-2'];
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.moveTo(X(0), Y(0));
        wd.forEach((q) => ctx.lineTo(X(q.x), Y(q.y)));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    // Predicted orbit (from the current state, or launch state before starting)
    const el = elements(s);
    if (p.predict && el.bound) {
      // Sample by integrating a copy for one period
      const c = { ...s };
      const n = 360;
      const hstep = el.T / n;
      ctx.strokeStyle = pal['accent-2'];
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(c.x), Y(c.y));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 8; j++) {
          const hh = hstep / 8;
          const a1 = accel(c.x, c.y);
          c.x += c.vx * hh + 0.5 * a1.ax * hh * hh;
          c.y += c.vy * hh + 0.5 * a1.ay * hh * hh;
          const a2 = accel(c.x, c.y);
          c.vx += 0.5 * (a1.ax + a2.ax) * hh;
          c.vy += 0.5 * (a1.ay + a2.ay) * hh;
        }
        ctx.lineTo(X(c.x), Y(c.y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Trail
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    trail.forEach((q, i) => (i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y))));
    ctx.stroke();

    // Star (size grows gently with mass)
    const sr = 10 + p.mass * 6;
    const g = ctx.createRadialGradient(X(0), Y(0), 2, X(0), Y(0), sr * 2.2);
    g.addColorStop(0, '#fff6d0');
    g.addColorStop(0.45, pal.warning);
    g.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), sr * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Planet and vectors
    const px = X(s.x);
    const py = Y(s.y);
    if (p.vectors && !s.done) {
      const vs = 14 / Math.sqrt(GM() / p.dist); // ~70 px at circular speed
      arrow(ctx, px, py, px + s.vx * vs * 5, py - s.vy * vs * 5, pal.accent, 2.5);
      const r = Math.hypot(s.x, s.y);
      const fl = Math.min(80, 40 / (r * r / (p.dist * p.dist)));
      arrow(ctx, px, py, px - (s.x / r) * fl, py + (s.y / r) * fl, pal['sim-solute'], 2.5);
    }
    ctx.fillStyle = pal['sim-water'];
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    if (!s.launched) pill(ctx, 'Planet', px, py - 22, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Readouts
    const type = !el.bound ? 'Escape (hyperbolic)' : el.e < 0.02 ? 'Circular' : el.rp < 0.03 ? 'Falls into star' : 'Elliptical';
    ui.readout('type', s.done === 'crashed' ? 'Crashed' : type, !el.bound ? 'bad' : el.rp < 0.03 ? 'bad' : 'ok');
    ui.readout('period', el.bound ? `${el.T.toFixed(2)} years` : 'None — not bound');
    ui.readout('ecc', el.e.toFixed(3));
    ui.readout('range', el.bound ? `${el.rp.toFixed(2)} / ${el.ra.toFixed(2)} AU` : `${el.rp.toFixed(2)} AU / ∞`);
    ui.readout('dist', `${el.r.toFixed(2)} AU`);
    ui.readout('speed', `${(Math.hypot(s.vx, s.vy) * KMS_PER_AU_YR).toFixed(1)} km/s`);
    sim.setTime(s.t, 'years');
    sim.setBadge(s.launched ? type : 'Press Start to launch');
    canvas.setAttribute(
      'aria-label',
      `A planet orbiting a star of ${p.mass} solar masses. Orbit type: ${type}. Eccentricity ${el.e.toFixed(2)}. ${el.bound ? `Period ${el.T.toFixed(2)} years.` : 'The planet is not bound to the star.'} Current distance ${el.r.toFixed(2)} AU.`,
    );

    const vmax = Math.max(40, ...speedPts.map((q) => q.y));
    graph.opts.y = { min: 0, max: Math.ceil(vmax / 20) * 20, step: Math.ceil(vmax / 20) * 5, format: (v) => `${v} km/s` };
    graph.set('v', { label: 'Speed (km/s)', color: 'accent', points: speedPts, legend: false });
    graph.draw();
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const relaunch = () => {
    viewR = viewRadius();
    reset();
    sim.requestRender();
  };
  const speedCtl = ui.range('or-speed', (v) => `${v}%`, (v) => ((p.speed = v), relaunch()));
  ui.presets('or-speed', speedCtl);
  const dirCtl = ui.range('or-dir', (v) => `${v}°`, (v) => ((p.dir = v), relaunch()));
  const distCtl = ui.range('or-dist', (v) => `${v.toFixed(1)} AU`, (v) => ((p.dist = v), relaunch()));
  const massCtl = ui.range('or-mass', (v) => `${v.toFixed(1)} M☉`, (v) => {
    p.mass = v;
    if (!s.launched) relaunch();
    else sim.requestRender();
  });
  const areasCtl = ui.toggle('or-areas', (v) => ((p.areas = v), sim.requestRender()));
  ui.toggle('or-vectors', (v) => ((p.vectors = v), sim.requestRender()));
  ui.toggle('or-predict', (v) => ((p.predict = v), sim.requestRender()));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const dx = (x - size.w / 2) / scale();
    const dy = (size.h / 2 - y) / scale();
    const d = Math.hypot(dx, dy);
    if (d < 0.08) {
      sim.showTooltip(x, y, 'Star', `Mass ${p.mass} × the Sun. Its gravity pulls the planet toward its centre with a force proportional to 1/r².`);
    } else {
      const vc = Math.sqrt(GM() / d) * KMS_PER_AU_YR;
      const T = Math.sqrt(d ** 3 / p.mass);
      sim.showTooltip(x, y, `${d.toFixed(2)} AU from the star`, `A circular orbit here would need ${vc.toFixed(1)} km/s and take ${T.toFixed(2)} years (Kepler’s third law).`);
    }
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      speedCtl.set(DEF.speed, false);
      dirCtl.set(DEF.dir, false);
      distCtl.set(DEF.dist, false);
      massCtl.set(DEF.mass, false);
      areasCtl.set(false, false);
      Object.assign(p, DEF, { areas: false });
      viewR = viewRadius();
      reset();
    },
  });
  viewR = viewRadius();
  reset();
  sim.requestRender();
}
