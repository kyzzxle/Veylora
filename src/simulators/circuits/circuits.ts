/**
 * DC circuits with Ohm's law (V = I·R) and power (P = V·I).
 * Series:      R = R1 + R2 + R3, same current everywhere.
 * Parallel:    1/R = Σ 1/Ri over closed branches, same voltage on every branch.
 * Combination: bulb 1 in series with (bulb 2 ∥ bulb 3).
 * Bulbs are treated as fixed resistors (real filaments change resistance as they heat up).
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'danger', 'text-faint', 'bg-elev', 'border-strong', 'warning', 'sim-water'] as const;
type Kind = 'series' | 'parallel' | 'combo';
const DEF = { V: 12, r: [10, 10, 10], s: [true, true, true] };

interface Seg {
  pts: [number, number][];
  I: number; // current (A) through this wire, in path direction (conventional)
}

export function solve(kind: Kind, V: number, r: number[], s: boolean[]) {
  const I = [0, 0, 0];
  let Itot = 0;
  let Rtot = Infinity;
  if (kind === 'series') {
    if (s.every(Boolean)) {
      Rtot = r[0] + r[1] + r[2];
      Itot = V / Rtot;
      I.fill(Itot);
    }
  } else if (kind === 'parallel') {
    for (let i = 0; i < 3; i++) if (s[i]) I[i] = V / r[i];
    Itot = I[0] + I[1] + I[2];
    Rtot = Itot > 0 ? V / Itot : Infinity;
  } else {
    const g = (s[1] ? 1 / r[1] : 0) + (s[2] ? 1 / r[2] : 0);
    if (s[0] && g > 0) {
      const Rp = 1 / g;
      Rtot = r[0] + Rp;
      Itot = V / Rtot;
      const Vp = Itot * Rp;
      I[0] = Itot;
      I[1] = s[1] ? Vp / r[1] : 0;
      I[2] = s[2] ? Vp / r[2] : 0;
    }
  }
  const Vb = I.map((x, i) => x * r[i]);
  const P = Vb.map((v, i) => v * I[i]);
  return { I, Itot, Rtot, Vb, P, Ptot: V * Itot };
}

export function initCircuits(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { kind: 'series' as Kind, V: DEF.V, r: [...DEF.r], s: [...DEF.s] };
  let t = 0;
  let switches: { i: number; x: number; y: number }[] = [];
  let bulbs: { i: number; x: number; y: number }[] = [];

  /* ---------- Drawing helpers ---------- */
  function wire(seg: Seg) {
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    seg.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    if (seg.I > 1e-6) {
      // Electrons: dots moving opposite to conventional current, speed ∝ current
      ctx.save();
      ctx.strokeStyle = pal['sim-water'];
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.setLineDash([0.1, 18]);
      ctx.lineDashOffset = t * Math.min(220, seg.I * 60);
      ctx.beginPath();
      seg.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
  }
  function bulb(i: number, x: number, y: number, power: number, V: number, I: number) {
    const glow = Math.min(1, power / 15);
    if (glow > 0.01) {
      const g = ctx.createRadialGradient(x, y, 2, x, y, 30 + glow * 30);
      g.addColorStop(0, `rgba(255, 220, 90, ${0.35 + glow * 0.6})`);
      g.addColorStop(1, 'rgba(255, 220, 90, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 30 + glow * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = glow > 0.01 ? `rgb(255, ${Math.round(235 - glow * 40)}, ${Math.round(140 - glow * 90)})` : pal['bg-elev'];
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 4);
    ctx.lineTo(x - 3, y - 5);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x + 3, y - 5);
    ctx.lineTo(x + 7, y + 4);
    ctx.stroke();
    pill(ctx, `B${i + 1}: ${V.toFixed(1)} V · ${I.toFixed(2)} A`, x, y + 32, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
    bulbs.push({ i, x, y });
  }
  function sw(i: number, x: number, y: number, vertical: boolean) {
    const closed = p.s[i];
    ctx.strokeStyle = closed ? pal['sim-text'] : pal.danger;
    ctx.lineWidth = 3;
    ctx.fillStyle = pal['sim-text'];
    const [ax, ay] = vertical ? [x, y - 14] : [x - 14, y];
    const [bx, by] = vertical ? [x, y + 14] : [x + 14, y];
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    if (closed) ctx.lineTo(bx, by);
    else ctx.lineTo(vertical ? x + 16 : x + 10, vertical ? y + 8 : y - 16);
    ctx.stroke();
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(10, 600);
    ctx.fillText(`S${i + 1}`, x + (vertical ? 10 : -6), y + (vertical ? -14 : -12));
    switches.push({ i, x, y });
  }
  function battery(x: number, y1: number, y2: number) {
    const my = (y1 + y2) / 2;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(x - 24, my - 18, 48, 36);
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 20, my - 8);
    ctx.lineTo(x + 20, my - 8);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 10, my + 6);
    ctx.lineTo(x + 10, my + 6);
    ctx.stroke();
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(13, 700);
    ctx.fillText('+', x + 24, my - 4);
    ctx.fillText('−', x + 16, my + 14);
    pill(ctx, `${p.V} V`, x - 46, my, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
  }

  /* ---------- Render ---------- */
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    switches = [];
    bulbs = [];
    const res = solve(p.kind, p.V, p.r, p.s);
    const L = Math.max(70, w * 0.12);
    const R = w - 40;
    const T = h * 0.16;
    const B = h * 0.8;
    const my = (T + B) / 2;
    const segs: Seg[] = [];

    if (p.kind === 'series') {
      const I = res.Itot;
      // Conventional current: out of + (top of battery), round the loop clockwise
      segs.push({ pts: [[L, my - 20], [L, T], [R, T], [R, B], [L, B], [L, my + 20]], I });
      segs.forEach(wire);
      battery(L, T, B);
      bulb(0, (L + R) / 2, T, res.P[0], res.Vb[0], res.I[0]);
      bulb(1, R, my, res.P[1], res.Vb[1], res.I[1]);
      bulb(2, (L + R) / 2, B, res.P[2], res.Vb[2], res.I[2]);
      sw(0, L + (R - L) * 0.25, T, false);
      sw(1, R, T + (my - T) * 0.45, true);
      sw(2, L + (R - L) * 0.75, B, false);
    } else if (p.kind === 'parallel') {
      const xs = [L + (R - L) * 0.38, L + (R - L) * 0.66, R];
      const I = res.I;
      segs.push({ pts: [[L, my - 20], [L, T], [xs[0], T]], I: I[0] + I[1] + I[2] });
      segs.push({ pts: [[xs[0], T], [xs[1], T]], I: I[1] + I[2] });
      segs.push({ pts: [[xs[1], T], [xs[2], T]], I: I[2] });
      xs.forEach((x, i) => segs.push({ pts: [[x, T], [x, B]], I: I[i] }));
      segs.push({ pts: [[xs[2], B], [xs[1], B]], I: I[2] });
      segs.push({ pts: [[xs[1], B], [xs[0], B]], I: I[1] + I[2] });
      segs.push({ pts: [[xs[0], B], [L, B], [L, my + 20]], I: I[0] + I[1] + I[2] });
      segs.forEach(wire);
      battery(L, T, B);
      xs.forEach((x, i) => {
        sw(i, x, T + (my - T) * 0.45, true);
        bulb(i, x, my + (B - my) * 0.25, res.P[i], res.Vb[i], res.I[i]);
      });
    } else {
      const xm = L + (R - L) * 0.45;
      const xs = [xm + (R - xm) * 0.35, R];
      const I = res.I;
      segs.push({ pts: [[L, my - 20], [L, T], [xm, T]], I: I[0] });
      segs.push({ pts: [[xm, T], [xs[0], T]], I: I[1] + I[2] });
      segs.push({ pts: [[xs[0], T], [xs[1], T]], I: I[2] });
      segs.push({ pts: [[xs[0], T], [xs[0], B]], I: I[1] });
      segs.push({ pts: [[xs[1], T], [xs[1], B]], I: I[2] });
      segs.push({ pts: [[xs[1], B], [xs[0], B]], I: I[2] });
      segs.push({ pts: [[xs[0], B], [L, B], [L, my + 20]], I: I[0] });
      segs.forEach(wire);
      battery(L, T, B);
      sw(0, L + (xm - L) * 0.3, T, false);
      bulb(0, L + (xm - L) * 0.72, T, res.P[0], res.Vb[0], res.I[0]);
      sw(1, xs[0], T + (my - T) * 0.45, true);
      bulb(1, xs[0], my + (B - my) * 0.25, res.P[1], res.Vb[1], res.I[1]);
      sw(2, xs[1], T + (my - T) * 0.45, true);
      bulb(2, xs[1], my + (B - my) * 0.25, res.P[2], res.Vb[2], res.I[2]);
    }

    // Ammeter on the battery wire
    pill(ctx, `A: ${res.Itot.toFixed(2)} A`, L + 52, T - 22, { bg: pal['bg-elev'], fg: pal.accent }, size);

    const open = res.Itot === 0 && p.V > 0;
    ui.readout('i', `${res.Itot.toFixed(3)} A`, open ? 'bad' : null);
    ui.readout('r', Number.isFinite(res.Rtot) ? `${res.Rtot.toFixed(2)} Ω` : '∞ (open circuit)');
    ui.readout('p', `${res.Ptot.toFixed(2)} W`);
    for (let i = 0; i < 3; i++) ui.readout(`b${i + 1}`, res.I[i] > 0 ? `${res.P[i].toFixed(2)} W (${res.Vb[i].toFixed(1)} V)` : 'Off');
    sim.setBadge(open ? 'Open circuit — no current' : `${p.kind === 'series' ? 'Series' : p.kind === 'parallel' ? 'Parallel' : 'Combination'} · ${res.Itot.toFixed(2)} A`);
    canvas.setAttribute(
      'aria-label',
      `${p.kind} circuit with a ${p.V} volt battery. Total current ${res.Itot.toFixed(2)} amps. Bulb powers: ${res.P.map((x) => x.toFixed(1)).join(', ')} watts.`,
    );
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const upd = () => sim.requestRender();
  const kindCtl = ui.choice<Kind>('ci-type', (v) => ((p.kind = v), upd()));
  const vCtl = ui.range('ci-v', (v) => `${v} V`, (v) => ((p.V = v), upd()));
  const rCtl = [0, 1, 2].map((i) => ui.range(`ci-r${i + 1}`, (v) => `${v} Ω`, (v) => ((p.r[i] = v), upd())));
  const sCtl = [0, 1, 2].map((i) => ui.toggle(`ci-s${i + 1}`, (v) => ((p.s[i] = v), upd())));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const s = switches.find((q) => Math.hypot(q.x - x, q.y - y) < 22);
    if (s) {
      sCtl[s.i].set(!p.s[s.i]);
      sim.announce(`Switch ${s.i + 1} ${p.s[s.i] ? 'closed' : 'opened'}.`);
      return;
    }
    const b = bulbs.find((q) => Math.hypot(q.x - x, q.y - y) < 22);
    if (b) {
      const res = solve(p.kind, p.V, p.r, p.s);
      sim.showTooltip(x, y, `Bulb ${b.i + 1} (${p.r[b.i]} Ω)`, `Voltage ${res.Vb[b.i].toFixed(2)} V, current ${res.I[b.i].toFixed(3)} A, power ${res.P[b.i].toFixed(2)} W. Brightness depends on power: P = V × I = I² × R.`);
    } else if (x < size.w * 0.2) {
      sim.showTooltip(x, y, 'Battery', 'Provides the voltage (energy per unit charge) that pushes charge around the circuit. The long line is the positive terminal.');
    } else {
      sim.showTooltip(x, y, 'Wire', 'Blue dots show electrons drifting from the negative terminal round to the positive one. Conventional current is defined in the opposite direction.');
    }
  });

  const sim = createSimController(root, {
    step: (dt) => (t += dt),
    render,
    reset() {
      kindCtl.set('series', false);
      vCtl.set(DEF.V, false);
      rCtl.forEach((c, i) => c.set(DEF.r[i], false));
      sCtl.forEach((c) => c.set(true, false));
      Object.assign(p, { kind: 'series', V: DEF.V, r: [...DEF.r], s: [...DEF.s] });
    },
  });
  sim.requestRender();
}
