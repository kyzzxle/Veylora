/**
 * Simple pendulum, solved with the full non-linear equation
 *   θ'' = −(g/L)·sin θ − b·θ'
 * using a fourth-order Runge–Kutta step. The period is measured from
 * successive upward zero-crossings of θ.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { createDataTable } from '../shared/datatable';
import { enableDrag } from '../shared/drag';
import { font, gridLines, pill } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'border-strong', 'bg-elev', 'sim-water'] as const;
const PLACE: Record<string, string> = { '9.81': 'Earth', '1.62': 'Moon', '3.71': 'Mars' };
const DEF = { L: 1, m: 1, a: 20, g: 9.81, b: 0 };

type Row = { L: number; m: number; a: number; place: string; T: number; T0: number };

export function initPendulum(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  const s = { th: (DEF.a * Math.PI) / 180, w: 0, t: 0 };
  let crossings: number[] = [];
  let measured: number | null = null;
  let pts: Point[] = [];

  const T0 = () => 2 * Math.PI * Math.sqrt(p.L / p.g);

  function restart() {
    s.th = (p.a * Math.PI) / 180;
    s.w = 0;
    s.t = 0;
    crossings = [];
    measured = null;
    pts = [{ x: 0, y: p.a }];
    sim?.requestRender();
  }

  /* ---------- Physics (RK4) ---------- */
  const acc = (th: number, w: number) => -(p.g / p.L) * Math.sin(th) - p.b * w;
  function rk4(h: number) {
    const k1t = s.w;
    const k1w = acc(s.th, s.w);
    const k2t = s.w + (h / 2) * k1w;
    const k2w = acc(s.th + (h / 2) * k1t, s.w + (h / 2) * k1w);
    const k3t = s.w + (h / 2) * k2w;
    const k3w = acc(s.th + (h / 2) * k2t, s.w + (h / 2) * k2w);
    const k4t = s.w + h * k3w;
    const k4w = acc(s.th + h * k3t, s.w + h * k3w);
    s.th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    s.w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
  }

  let sampleClock = 0;
  function step(dt: number) {
    const sub = 10;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const prev = s.th;
      rk4(h);
      s.t += h;
      // Upward zero crossing (moving from negative to positive angle)
      if (prev < 0 && s.th >= 0) {
        const tc = s.t - h * (s.th / (s.th - prev));
        crossings.push(tc);
        if (crossings.length >= 2) measured = crossings[crossings.length - 1] - crossings[crossings.length - 2];
        if (crossings.length > 20) crossings.shift();
      }
    }
    sampleClock += dt;
    if (sampleClock > 0.03) {
      sampleClock = 0;
      pts.push({ x: s.t, y: (s.th * 180) / Math.PI });
      while (pts.length && pts[0].x < s.t - 15) pts.shift();
    }
  }

  /* ---------- Geometry ---------- */
  const pivot = () => ({ x: size.w / 2, y: 40 });
  const pxPerM = () => (size.h - 90) / 3.1;
  const bobXY = () => {
    const pv = pivot();
    const r = p.L * pxPerM();
    return { x: pv.x + Math.sin(s.th) * r, y: pv.y + Math.cos(s.th) * r };
  };
  const bobR = () => 9 + Math.cbrt(p.m) * 7;

  /* ---------- Graph & table ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="pd-graph"]')!, {
    x: { min: 0, span: 15, max: 15, format: (v) => `${v.toFixed(0)}s` },
    y: { min: -90, max: 90, step: 30, format: (v) => `${v}°` },
  });

  const table = createDataTable<Row>(
    root,
    'pd-table',
    [
      { key: 'L', label: 'Length (m)', format: (v) => Number(v).toFixed(1) },
      { key: 'm', label: 'Mass (kg)', format: (v) => Number(v).toFixed(1) },
      { key: 'a', label: 'Start angle', format: (v) => `${v}°` },
      { key: 'place', label: 'Gravity' },
      { key: 'T', label: 'Measured T (s)', format: (v) => Number(v).toFixed(3) },
      { key: 'T0', label: 'Formula T (s)', format: (v) => Number(v).toFixed(3) },
    ],
    {
      filename: 'pendulum-periods.csv',
      onRecord: () => {
        if (measured === null) {
          sim.announce('Let the pendulum complete at least one full swing first.');
          return null;
        }
        return { L: p.L, m: p.m, a: p.a, place: PLACE[String(p.g)], T: measured, T0: T0() };
      },
    },
  );

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    gridLines(ctx, w, h, 32, pal['sim-grid']);

    const pv = pivot();
    const bob = bobXY();
    const r = p.L * pxPerM();

    // Support beam
    ctx.fillStyle = pal['border-strong'];
    ctx.fillRect(pv.x - 80, pv.y - 12, 160, 8);

    // Start-angle guide and swing arc
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pv.x, pv.y);
    ctx.lineTo(pv.x, pv.y + r + 20);
    ctx.stroke();
    const a0 = (p.a * Math.PI) / 180;
    ctx.strokeStyle = pal['accent-2'];
    ctx.beginPath();
    ctx.arc(pv.x, pv.y, r, Math.PI / 2 - a0, Math.PI / 2 + a0);
    ctx.stroke();
    ctx.restore();

    // String and bob
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pv.x, pv.y);
    ctx.lineTo(bob.x, bob.y);
    ctx.stroke();
    ctx.fillStyle = pal['sim-text'];
    ctx.beginPath();
    ctx.arc(pv.x, pv.y, 4, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(bob.x - 4, bob.y - 4, 2, bob.x, bob.y, bobR());
    grad.addColorStop(0, pal['bg-elev']);
    grad.addColorStop(1, pal['sim-solute']);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, bobR(), 0, Math.PI * 2);
    ctx.fill();
    pill(ctx, `${p.m.toFixed(1)} kg`, bob.x, bob.y + bobR() + 18, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Energy bars (kinetic vs potential, as % of total)
    const v = Math.abs(s.w) * p.L;
    const KE = 0.5 * p.m * v * v;
    const PE = p.m * p.g * p.L * (1 - Math.cos(s.th));
    const total = KE + PE || 1;
    const bx = w - 236; // bottom-right, clear of the hint label
    const by = h - 70;
    ctx.font = font(11, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('Energy', bx, by - 8);
    const bar = (y: number, frac: number, color: string, label: string) => {
      ctx.fillStyle = pal['border-strong'];
      ctx.globalAlpha = 0.3;
      ctx.fillRect(bx, y, 120, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(bx, y, 120 * frac, 12);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(label, bx + 128, y + 10);
    };
    bar(by, KE / total, pal.accent, `Kinetic ${Math.round((KE / total) * 100)}%`);
    bar(by + 20, PE / total, pal['accent-2'], `Potential ${Math.round((PE / total) * 100)}%`);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText(`Total ${(KE + PE).toFixed(2)} J`, bx, by + 50);

    pill(ctx, `L = ${p.L.toFixed(1)} m`, pv.x + 110, pv.y + 8, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Readouts
    const deg = (s.th * 180) / Math.PI;
    ui.readout('measured', measured === null ? 'Measuring…' : `${measured.toFixed(3)} s`);
    ui.readout('simple', `${T0().toFixed(3)} s`);
    ui.readout('angle', `${deg.toFixed(1)}°`);
    ui.readout('speed', `${v.toFixed(2)} m/s`);
    ui.readout('freq', measured ? `${(1 / measured).toFixed(3)} Hz` : `${(1 / T0()).toFixed(3)} Hz`);
    sim.setTime(s.t);
    canvas.setAttribute(
      'aria-label',
      `Pendulum of length ${p.L.toFixed(1)} metres and mass ${p.m.toFixed(1)} kilograms on ${PLACE[String(p.g)]}, released from ${p.a} degrees. Current angle ${deg.toFixed(0)} degrees.` +
        (measured ? ` Measured period ${measured.toFixed(2)} seconds.` : ''),
    );

    graph.opts.x = { min: Math.max(0, s.t - 15), span: 15, max: Math.max(15, s.t), format: (x) => `${x.toFixed(0)}s` };
    graph.set('angle', { label: 'Angle (degrees)', color: 'accent', points: pts });
    graph.draw();
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const lenCtl = ui.range('pd-length', (v) => `${v.toFixed(1)} m`, (v) => ((p.L = v), restart()));
  const massCtl = ui.range('pd-mass', (v) => `${v.toFixed(1)} kg`, (v) => ((p.m = v), restart()));
  const angCtl = ui.range('pd-angle', (v) => `${v}°`, (v) => ((p.a = v), restart()));
  const gCtl = ui.choice<string>('pd-g', (v) => ((p.g = Number(v)), restart()));
  const dampCtl = ui.range('pd-damp', (v) => (v === 0 ? 'None' : v.toFixed(2)), (v) => ((p.b = v), sim.requestRender()));

  enableDrag<'bob'>(canvas, {
    hit: (x, y) => {
      const b = bobXY();
      return !sim.running && Math.hypot(x - b.x, y - b.y) < bobR() + 10 ? 'bob' : null;
    },
    move: (_id, x, y) => {
      const pv = pivot();
      const a = Math.round((Math.atan2(x - pv.x, y - pv.y) * 180) / Math.PI);
      angCtl.set(clamp(Math.abs(a), 5, 80)); // resets the swing at this angle
      s.th = (Math.sign(a || 1) * clamp(Math.abs(a), 5, 80) * Math.PI) / 180; // keep the side it was dragged to
      sim.requestRender();
    },
    click: (x, y) => {
      const b = bobXY();
      if (Math.hypot(x - b.x, y - b.y) < bobR() + 10) {
        sim.showTooltip(x, y, 'Bob', `Mass ${p.m.toFixed(1)} kg. Gravity pulls it down; the string's tension keeps it on a circular arc. ${sim.running ? 'Pause to drag it.' : 'Drag to set the starting angle.'}`);
      } else {
        sim.showTooltip(x, y, 'Restoring force', 'The part of gravity along the arc, m·g·sin θ, always pulls the bob back toward the lowest point.');
      }
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      lenCtl.set(DEF.L, false);
      massCtl.set(DEF.m, false);
      angCtl.set(DEF.a, false);
      gCtl.set('9.81', false);
      dampCtl.set(0, false);
      Object.assign(p, DEF);
      table.clear();
      restart();
    },
  });
  restart();
}
