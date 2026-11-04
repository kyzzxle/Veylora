/**
 * Projectile motion.
 * Without air resistance: x = v·cosθ·t,  y = h + v·sinθ·t − ½gt².
 * With air resistance (quadratic drag): a = −g·ŷ − k·|v|·v, integrated numerically.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { arrow, font, gridLines, pill } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'border-strong', 'bg-elev', 'sim-wall', 'sim-membrane'] as const;
const PLANET: Record<string, string> = { '9.81': 'Earth', '1.62': 'Moon', '3.71': 'Mars', '24.79': 'Jupiter' };
const DRAG_K = 0.012; // per metre — roughly a tennis ball

interface Shot {
  path: { x: number; y: number; t: number }[];
  label: string;
}

export function initProjectile(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => (fitView(), sim.requestRender()));
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { angle: 45, speed: 20, h0: 0, g: 9.81, drag: false, vectors: true, predict: true, slow: false };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, t: 0, flying: false, landed: false, apex: 0 };
  let path: { x: number; y: number; t: number }[] = [];
  const shots: Shot[] = [];
  const vxPts: Point[] = [];
  const vyPts: Point[] = [];

  /* ---------- Analytic predictions (no air) ---------- */
  const rad = () => (p.angle * Math.PI) / 180;
  const pred = () => {
    const vy0 = p.speed * Math.sin(rad());
    const vx0 = p.speed * Math.cos(rad());
    const T = (vy0 + Math.sqrt(vy0 * vy0 + 2 * p.g * p.h0)) / p.g;
    return { T, R: vx0 * T, H: p.h0 + (vy0 * vy0) / (2 * p.g) };
  };

  /* ---------- View: equal x/y scale so the path keeps its true shape ---------- */
  const view = { scale: 10, ox: 50, oy: 0 };
  function fitView() {
    const { R, H } = pred();
    const worldW = Math.max(12, R * 1.12, ...shots.map((s) => s.path[s.path.length - 1]?.x ?? 0).map((x) => x * 1.05));
    const worldH = Math.max(8, H * 1.2, p.h0 + 3);
    const padL = 56;
    const padB = 34;
    view.scale = Math.min((size.w - padL - 20) / worldW, (size.h - padB - 24) / worldH);
    view.ox = padL;
    view.oy = size.h - padB;
  }
  const X = (x: number) => view.ox + x * view.scale;
  const Y = (y: number) => view.oy - y * view.scale;

  /* ---------- Physics ---------- */
  function launch() {
    ball.x = 0;
    ball.y = p.h0;
    ball.vx = p.speed * Math.cos(rad());
    ball.vy = p.speed * Math.sin(rad());
    ball.t = 0;
    ball.apex = p.h0;
    ball.flying = true;
    ball.landed = false;
    path = [{ x: 0, y: p.h0, t: 0 }];
    vxPts.length = 0;
    vyPts.length = 0;
    vxPts.push({ x: 0, y: ball.vx });
    vyPts.push({ x: 0, y: ball.vy });
    fitView();
    graph.opts.y = velocityAxis();
  }

  function step(dt: number) {
    if (!ball.flying) return;
    const sub = 8;
    const h = (dt * (p.slow ? 0.25 : 1)) / sub;
    for (let i = 0; i < sub && ball.flying; i++) {
      const v = Math.hypot(ball.vx, ball.vy);
      const k = p.drag ? DRAG_K : 0;
      const ax = -k * v * ball.vx;
      const ay = -p.g - k * v * ball.vy;
      const px = ball.x;
      const py = ball.y;
      ball.vx += ax * h;
      ball.vy += ay * h;
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      ball.t += h;
      ball.apex = Math.max(ball.apex, ball.y);
      if (ball.y <= 0 && ball.vy < 0) {
        // Interpolate the exact landing point
        const f = py / (py - ball.y || 1);
        ball.x = px + (ball.x - px) * f;
        ball.y = 0;
        ball.flying = false;
        ball.landed = true;
      }
    }
    if (path.length < 4000) path.push({ x: ball.x, y: ball.y, t: ball.t });
    vxPts.push({ x: ball.t, y: ball.vx });
    vyPts.push({ x: ball.t, y: ball.vy });
    if (ball.landed) {
      shots.push({ path: [...path], label: `${p.angle}° · ${p.speed} m/s · ${PLANET[String(p.g)]}${p.drag ? ' · air' : ''}` });
      if (shots.length > 5) shots.shift();
      sim.pause();
      sim.announce(`Landed after ${ball.t.toFixed(2)} seconds, ${ball.x.toFixed(1)} metres away.`);
    }
  }

  /* ---------- Graph ---------- */
  const velocityAxis = () => {
    const m = Math.ceil((p.speed * 1.1) / 10) * 10;
    return { min: -m, max: m, step: m / 2, format: (v: number) => `${v}` };
  };
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="pm-graph"]')!, {
    x: { min: 0, span: 4, step: 1, format: (v) => `${v}s` },
    y: velocityAxis(),
  });
  graph.set('vx', { label: 'Horizontal velocity vₓ (m/s)', color: 'accent', points: vxPts });
  graph.set('vy', { label: 'Vertical velocity v_y (m/s)', color: 'sim-solute', points: vyPts });

  /* ---------- Drawing ---------- */
  function drawPath(pts: { x: number; y: number }[], color: string, width: number, dash: number[] = []) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y))));
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    gridLines(ctx, w, h, 32, pal['sim-grid']);

    // Axes with metre ticks
    const worldW = (w - view.ox - 10) / view.scale;
    const worldH = (view.oy - 10) / view.scale;
    const raw = worldW / 6;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const tick = [1, 2, 5, 10].map((m) => m * mag).find((t) => t >= raw) ?? raw;
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(11, 500, 'mono');
    ctx.textAlign = 'center';
    for (let x = 0; x <= worldW; x += tick) ctx.fillText(`${+x.toFixed(1)} m`, X(x), view.oy + 18);
    ctx.textAlign = 'right';
    for (let y = tick; y <= worldH; y += tick) ctx.fillText(`${+y.toFixed(1)}`, view.ox - 8, Y(y) + 4);
    ctx.textAlign = 'left';

    // Ground
    ctx.fillStyle = pal['sim-wall'];
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, view.oy, w, h - view.oy);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal['sim-wall'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, view.oy);
    ctx.lineTo(w, view.oy);
    ctx.stroke();

    // Earlier shots, predicted path, current path
    shots.forEach((s, i) => {
      ctx.globalAlpha = 0.25 + (0.5 * (i + 1)) / shots.length;
      drawPath(s.path, pal['text-faint'], 2);
      ctx.globalAlpha = 1;
    });
    if (p.predict) {
      const vx0 = p.speed * Math.cos(rad());
      const vy0 = p.speed * Math.sin(rad());
      const { T, R } = pred();
      const pts = Array.from({ length: 81 }, (_, i) => {
        const t = (T * i) / 80;
        return { x: vx0 * t, y: p.h0 + vy0 * t - 0.5 * p.g * t * t };
      });
      drawPath(pts, pal['accent-2'], 1.5, [6, 6]);
      ctx.fillStyle = pal['accent-2'];
      ctx.beginPath();
      ctx.moveTo(X(R), view.oy - 2);
      ctx.lineTo(X(R) - 6, view.oy - 12);
      ctx.lineTo(X(R) + 6, view.oy - 12);
      ctx.closePath();
      ctx.fill();
    }
    drawPath(path, pal.accent, 3);

    // Platform and cannon
    const cx = X(0);
    const cy = Y(p.h0);
    if (p.h0 > 0) {
      ctx.fillStyle = pal['border-strong'];
      ctx.fillRect(cx - 18, cy, 36, view.oy - cy);
    }
    const len = 34;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rad());
    ctx.fillStyle = pal['sim-text'];
    ctx.beginPath();
    ctx.roundRect(-4, -7, len, 14, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = pal['sim-text'];
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    // Angle arc
    ctx.strokeStyle = pal['accent-2'];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, -rad(), 0);
    ctx.stroke();
    pill(ctx, `${p.angle}°`, cx + 70, cy - 16, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Ball
    const showBall = ball.flying || ball.landed;
    if (showBall) {
      const bx = X(ball.x);
      const by = Y(ball.y);
      if (p.vectors && ball.flying) {
        const s = 2.2;
        arrow(ctx, bx, by, bx + ball.vx * s, by, pal.accent, 3);
        arrow(ctx, bx, by, bx, by - ball.vy * s, pal['sim-solute'], 3);
        arrow(ctx, bx, by, bx + ball.vx * s, by - ball.vy * s, pal['sim-text'], 1.5, 8);
      }
      ctx.fillStyle = pal['sim-solute'];
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      if (ball.landed) pill(ctx, `${ball.x.toFixed(1)} m`, bx, by - 22, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
    }

    // Readouts
    const pr = pred();
    const cur = ball.flying || ball.landed;
    ui.readout('range', ball.landed ? `${ball.x.toFixed(2)} m` : ball.flying ? `${ball.x.toFixed(1)} m…` : '—');
    ui.readout('tof', cur ? `${ball.t.toFixed(2)} s` : '—');
    ui.readout('apex', cur ? `${ball.apex.toFixed(2)} m` : '—');
    ui.readout('vx', cur ? `${ball.vx.toFixed(1)} m/s` : `${(p.speed * Math.cos(rad())).toFixed(1)} m/s`);
    ui.readout('vy', cur ? `${ball.vy.toFixed(1)} m/s` : `${(p.speed * Math.sin(rad())).toFixed(1)} m/s`);
    ui.readout('pred', `${pr.R.toFixed(2)} m · ${pr.T.toFixed(2)} s`);
    sim.setTime(ball.t);
    sim.setBadge(ball.flying ? 'In flight' : ball.landed ? 'Landed — press Start to fire again' : 'Ready — press Start to fire');
    canvas.setAttribute(
      'aria-label',
      `Projectile launched at ${p.angle} degrees and ${p.speed} metres per second on ${PLANET[String(p.g)]}${p.drag ? ' with air resistance' : ''}. ` +
        (ball.landed ? `It landed ${ball.x.toFixed(1)} metres away after ${ball.t.toFixed(2)} seconds.` : `Predicted range ${pr.R.toFixed(1)} metres.`),
    );

    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="pm-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const idle = () => {
    if (!ball.flying) {
      ball.landed = false;
      path = [];
      fitView();
    }
    sim.requestRender();
  };
  const angleCtl = ui.range('pm-angle', (v) => `${v}°`, (v) => ((p.angle = v), idle()));
  const speedCtl = ui.range('pm-speed', (v) => `${v} m/s`, (v) => ((p.speed = v), idle()));
  const heightCtl = ui.range('pm-height', (v) => `${v} m`, (v) => ((p.h0 = v), idle()));
  const gCtl = ui.choice<string>('pm-g', (v) => ((p.g = Number(v)), idle()));
  const dragCtl = ui.toggle('pm-drag', (v) => ((p.drag = v), idle()));
  ui.toggle('pm-vectors', (v) => ((p.vectors = v), sim.requestRender()));
  ui.toggle('pm-predict', (v) => ((p.predict = v), sim.requestRender()));
  ui.toggle('pm-slow', (v) => (p.slow = v));

  // Drag the barrel to aim
  enableDrag<'barrel'>(canvas, {
    hit: (x, y) => {
      const cx = X(0);
      const cy = Y(p.h0);
      return !ball.flying && Math.hypot(x - cx, y - cy) < 60 && x >= cx - 10 ? 'barrel' : null;
    },
    move: (_id, x, y) => {
      const a = Math.round((Math.atan2(Y(p.h0) - y, x - X(0)) * 180) / Math.PI);
      angleCtl.set(clamp(a, 0, 90));
    },
    click: (x, y) => {
      let best: { x: number; y: number; t: number } | null = null;
      let bestD = 14;
      for (const q of path) {
        const d = Math.hypot(X(q.x) - x, Y(q.y) - y);
        if (d < bestD) (bestD = d), (best = q);
      }
      if (best) {
        sim.showTooltip(x, y, `t = ${best.t.toFixed(2)} s`, `Position: ${best.x.toFixed(1)} m across, ${best.y.toFixed(1)} m high.`);
      } else if (y > view.oy) {
        sim.showTooltip(x, y, 'Ground', 'The projectile lands when its height returns to zero.');
      } else {
        sim.showTooltip(x, y, 'Gravity', `Pulls everything down at ${p.g} m/s² on ${PLANET[String(p.g)]}. It changes only the vertical velocity.`);
      }
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange: (on) => {
      if (on && !ball.flying) launch();
    },
    reset() {
      angleCtl.set(45, false);
      speedCtl.set(20, false);
      heightCtl.set(0, false);
      gCtl.set('9.81', false);
      dragCtl.set(false, false);
      Object.assign(p, { angle: 45, speed: 20, h0: 0, g: 9.81, drag: false });
      Object.assign(ball, { x: 0, y: 0, t: 0, flying: false, landed: false });
      path = [];
      shots.length = 0;
      vxPts.length = 0;
      vyPts.length = 0;
      fitView();
    },
  });
  fitView();
  sim.requestRender();
}
