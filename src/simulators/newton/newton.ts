/**
 * Newton's laws with a cart on a level track.
 *   Weight W = m·g, normal force N = W (level ground)
 *   Static friction holds the cart still while |F| ≤ μs·N
 *   Kinetic friction f = μk·N opposes motion
 *   Second law: a = F_net / m
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, pill } from '../shared/draw';
import { LineGraph, runComparer, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'danger', 'text-faint', 'bg-elev', 'border-strong', 'sim-wall', 'sim-water'] as const;
const G = 9.81;
const SURF = {
  ice: { muK: 0.02, muS: 0.05, name: 'ice', colour: '#bfe3f2' },
  wood: { muK: 0.2, muS: 0.3, name: 'wood', colour: '#c9a26b' },
  carpet: { muK: 0.45, muS: 0.6, name: 'carpet', colour: '#9a6fa8' },
};
type Surface = keyof typeof SURF;
const DEF = { F: 40, m: 10, surface: 'wood' as Surface };

export function initNewton(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF, fbd: true, pair: false };
  const s = { x: 0, v: 0, t: 0, a: 0, fric: 0, stuck: true };
  let pts: Point[] = [{ x: 0, y: 0 }];

  function forces() {
    const sf = SURF[p.surface];
    const N = p.m * G;
    let fric: number;
    let stuck = false;
    if (Math.abs(s.v) < 1e-6) {
      if (Math.abs(p.F) <= sf.muS * N) {
        fric = -p.F; // static friction balances the push exactly
        stuck = true;
      } else fric = -Math.sign(p.F) * sf.muK * N;
    } else fric = -Math.sign(s.v) * sf.muK * N;
    const net = p.F + fric;
    return { N, W: N, fric, net, stuck, a: stuck ? 0 : net / p.m };
  }

  function step(dt: number) {
    const sub = 10;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const f = forces();
      const v0 = s.v;
      s.v += f.a * h;
      // Kinetic friction cannot reverse the motion: stop at zero
      if (v0 !== 0 && Math.sign(s.v) !== Math.sign(v0) && Math.abs(p.F) <= SURF[p.surface].muS * f.N) s.v = 0;
      s.x += s.v * h;
      s.t += h;
      s.a = f.a;
      s.fric = f.fric;
      s.stuck = f.stuck;
    }
    const last = pts[pts.length - 1];
    if (s.t - last.x >= 0.05) pts.push({ x: s.t, y: s.v });
    if (pts.length > 3000) pts.shift();
  }

  function restart() {
    Object.assign(s, { x: 0, v: 0, t: 0, a: 0, fric: 0, stuck: true });
    pts = [{ x: 0, y: 0 }];
    sim?.requestRender();
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="nw-graph"]')!, {
    x: { min: 0, span: 10, step: 5, format: (v) => `${v}s` },
    y: { min: -20, max: 20, step: 10, format: (v) => `${v}` },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="nw-graph"]')!, graph, {
    currentId: 'v',
    label: () => `${p.F} N on ${p.m} kg (${SURF[p.surface].name})`,
    onSave: restart,
  });

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    const f = forces();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Camera follows the cart; 1 m = 60 px
    const ppm = 60;
    const groundY = h * 0.68;
    const cx = w / 2;
    const camX = s.x;
    // Surface
    ctx.fillStyle = SURF[p.surface].colour;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    // Distance markers every metre
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(10, 500, 'mono');
    const first = Math.floor(camX - w / 2 / ppm) - 1;
    for (let m = first; m < camX + w / 2 / ppm + 1; m++) {
      const x = cx + (m - camX) * ppm;
      ctx.fillRect(x, groundY, 1, m % 5 === 0 ? 12 : 6);
      if (m % 5 === 0) ctx.fillText(`${m} m`, x + 3, groundY + 22);
    }

    // Cart (size grows gently with mass)
    const cw = 70 + Math.sqrt(p.m) * 8;
    const ch = 34 + Math.sqrt(p.m) * 4;
    const left = cx - cw / 2;
    const top = groundY - ch - 12;
    ctx.fillStyle = pal['sim-water'];
    ctx.beginPath();
    ctx.roundRect(left, top, cw, ch, 8);
    ctx.fill();
    ctx.fillStyle = pal['sim-text'];
    for (const wx of [left + 16, left + cw - 16]) {
      ctx.beginPath();
      ctx.arc(wx, groundY - 7, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = font(13, 700);
    ctx.textAlign = 'center';
    ctx.fillText(`${p.m} kg`, cx, top + ch / 2 + 5);
    ctx.textAlign = 'left';

    // Force arrows (scale: 1 N = 1.1 px, capped)
    const k = (F: number) => Math.max(-170, Math.min(170, F * 1.1));
    const midY = top + ch / 2;
    if (p.F !== 0) arrow(ctx, p.F > 0 ? left - 6 - Math.abs(k(p.F)) : left + cw + 6 + Math.abs(k(p.F)), midY, p.F > 0 ? left - 6 : left + cw + 6, midY, pal.accent, 4, 12);
    const fr = f.fric;
    if (p.fbd && Math.abs(fr) > 0.01) arrow(ctx, cx, groundY - 3, cx + k(fr), groundY - 3, pal.danger, 3.5, 11);
    if (p.fbd) {
      arrow(ctx, cx, top + ch, cx, top + ch + Math.min(110, f.W * 0.6), pal['text-faint'], 2.5, 9);
      arrow(ctx, cx + 8, top + ch, cx + 8, top - Math.min(110, f.N * 0.6), pal['text-faint'], 2.5, 9);
      pill(ctx, `Weight ${f.W.toFixed(0)} N`, cx - 70, Math.min(h - 18, top + ch + 54), { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
      pill(ctx, `Normal ${f.N.toFixed(0)} N`, cx + 76, top - 30, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
      if (Math.abs(f.net) > 0.01 && !f.stuck) arrow(ctx, cx, top - 34, cx + k(f.net), top - 34, pal['accent-2'], 4, 12);
      pill(ctx, `Net ${f.stuck ? 0 : f.net.toFixed(1)} N`, cx, top - 56, { bg: pal['bg-elev'], fg: pal['accent-2'] }, size);
    }
    // Third law: the cart pushes back on whoever pushes it
    if (p.pair && p.F !== 0) {
      const hx = p.F > 0 ? left - 6 - Math.abs(k(p.F)) - 26 : left + cw + 6 + Math.abs(k(p.F)) + 26;
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, top - 18, 8, 0, Math.PI * 2);
      ctx.moveTo(hx, top - 10);
      ctx.lineTo(hx, groundY - 30);
      ctx.lineTo(hx - 8, groundY);
      ctx.moveTo(hx, groundY - 30);
      ctx.lineTo(hx + 8, groundY);
      ctx.moveTo(hx, top + 6);
      ctx.lineTo(hx + Math.sign(p.F) * 22, midY);
      ctx.stroke();
      arrow(ctx, hx, midY + 22, hx - k(p.F) * 0.6, midY + 22, pal.danger, 3, 10);
      pill(ctx, `Cart pushes back ${Math.abs(p.F)} N`, hx - k(p.F) * 0.3, midY + 44, { bg: pal['bg-elev'], fg: pal.danger }, size);
    }

    // Readouts
    const law =
      Math.abs(s.v) < 1e-6 && f.stuck
        ? p.F === 0
          ? '1st — at rest, stays at rest'
          : '1st — forces balanced (friction holds)'
        : Math.abs(f.net) < 0.5
          ? '1st — balanced forces, constant velocity'
          : '2nd — net force causes acceleration';
    ui.readout('net', `${(f.stuck ? 0 : f.net).toFixed(1)} N`);
    ui.readout('acc', `${(f.stuck ? 0 : f.a).toFixed(2)} m/s²`);
    ui.readout('vel', `${s.v.toFixed(2)} m/s`);
    ui.readout('fric', `${Math.abs(f.fric).toFixed(1)} N ${f.stuck && p.F !== 0 ? '(static)' : Math.abs(s.v) > 0 ? '(kinetic)' : ''}`);
    ui.readout('pos', `${s.x.toFixed(1)} m`);
    ui.readout('law', law);
    sim.setTime(s.t);
    sim.setBadge(f.stuck ? (p.F === 0 ? 'At rest' : 'Friction holds the cart') : Math.abs(f.a) < 0.05 ? 'Constant velocity' : f.a * (s.v || 1) > 0 ? 'Speeding up' : 'Slowing down');
    canvas.setAttribute('aria-label', `A ${p.m} kilogram cart on ${SURF[p.surface].name}, pushed with ${p.F} newtons. Net force ${(f.stuck ? 0 : f.net).toFixed(1)} newtons, acceleration ${(f.stuck ? 0 : f.a).toFixed(2)} metres per second squared, velocity ${s.v.toFixed(2)} metres per second.`);

    const vmax = Math.max(5, ...pts.map((q) => Math.abs(q.y)));
    const ym = Math.ceil(vmax / 5) * 5;
    graph.opts.y = { min: -ym, max: ym, step: ym / 2, format: (v) => `${v}` };
    graph.set('v', { label: 'Current run (m/s)', color: 'accent', points: pts });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="nw-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const fCtl = ui.range('nw-force', (v) => `${v} N`, (v) => ((p.F = v), sim.requestRender()));
  ui.presets('nw-force', fCtl);
  const mCtl = ui.range('nw-mass', (v) => `${v} kg`, (v) => ((p.m = v), sim.requestRender()));
  const sCtl = ui.choice<Surface>('nw-surface', (v) => ((p.surface = v), sim.requestRender()));
  ui.toggle('nw-fbd', (v) => ((p.fbd = v), sim.requestRender()));
  ui.toggle('nw-pair', (v) => ((p.pair = v), sim.requestRender()));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const groundY = size.h * 0.68;
    if (y > groundY - 8) sim.showTooltip(x, y, 'Friction', `On ${SURF[p.surface].name}, friction is up to ${SURF[p.surface].muS} × the normal force before the cart moves, then ${SURF[p.surface].muK} × the normal force while it slides.`);
    else if (Math.abs(x - size.w / 2) < 60) sim.showTooltip(x, y, 'Weight and normal force', 'Gravity pulls the cart down (weight = m·g). The track pushes up with an equal normal force, so they cancel vertically.');
    else sim.showTooltip(x, y, 'Applied force', 'Your push. If it is bigger than friction, there is a net force and the cart accelerates: a = F_net ÷ m.');
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      fCtl.set(DEF.F, false);
      mCtl.set(DEF.m, false);
      sCtl.set(DEF.surface, false);
      Object.assign(p, DEF);
      restart();
    },
  });
  restart();
  comparer.refresh();
}
