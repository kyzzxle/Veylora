/**
 * Action potential with the Hodgkin–Huxley (1952) model of the squid giant axon,
 * using the modern convention of a −65 mV resting potential.
 *   C dV/dt = I_stim − g_Na m³h (V − E_Na) − g_K n⁴ (V − E_K) − g_L (V − E_L)
 *   dx/dt = α_x(V)(1 − x) − β_x(V) x   for gates x = m, h, n
 * Time is slowed: 5 ms of neuron time pass per real second.
 * Propagation along the axon is drawn by delaying the voltage trace by
 * distance / conduction velocity (and jumping node to node when myelinated).
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'bg-elev', 'border-strong', 'warning', 'sim-membrane', 'sim-cytoplasm'] as const;
const P = { gNa: 120, gK: 36, gL: 0.3, ENa: 50, EK: -77, EL: -54.387, C: 1 };
const MS_PER_SECOND = 5;
const DT = 0.01; // ms
const WINDOW = 40; // ms shown on the graph

const vtrap = (x: number, y: number) => (Math.abs(x / y) < 1e-6 ? y * (1 - x / y / 2) : x / (Math.exp(x / y) - 1));
const am = (V: number) => 0.1 * vtrap(-(V + 40), 10);
const bm = (V: number) => 4 * Math.exp(-(V + 65) / 18);
const ah = (V: number) => 0.07 * Math.exp(-(V + 65) / 20);
const bh = (V: number) => 1 / (1 + Math.exp(-(V + 35) / 10));
const an = (V: number) => 0.01 * vtrap(-(V + 55), 10);
const bn = (V: number) => 0.125 * Math.exp(-(V + 65) / 80);
const steady = (a: number, b: number) => a / (a + b);

export function initNeuron(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { mode: 'pulse' as 'pulse' | 'steady', amp: 10, dur: 1, ttx: false, tea: false, myelin: false };
  const s = { V: -65, m: 0, h: 0, n: 0, t: 0, stimUntil: -1, spikes: 0, lastSpike: -1e9, rising: false, peak: -65 };
  let history: { t: number; V: number; m: number; h: number; n: number }[] = [];
  let ionsAnim = 0;

  function rest() {
    s.V = -65;
    s.m = steady(am(-65), bm(-65));
    s.h = steady(ah(-65), bh(-65));
    s.n = steady(an(-65), bn(-65));
    s.t = 0;
    s.stimUntil = -1;
    s.spikes = 0;
    s.lastSpike = -1e9;
    s.rising = false;
    history = [];
  }

  /* ---------- Model ---------- */
  function stimCurrent(t: number) {
    if (p.mode === 'steady') return p.amp;
    return t < s.stimUntil ? p.amp : 0;
  }
  function stepHH(dt: number) {
    const { V, m, h, n } = s;
    const gNa = p.ttx ? 0 : P.gNa;
    const gK = p.tea ? 0 : P.gK;
    const INa = gNa * m ** 3 * h * (V - P.ENa);
    const IK = gK * n ** 4 * (V - P.EK);
    const IL = P.gL * (V - P.EL);
    s.V += ((stimCurrent(s.t) - INa - IK - IL) / P.C) * dt;
    s.m += (am(V) * (1 - m) - bm(V) * m) * dt;
    s.h += (ah(V) * (1 - h) - bh(V) * h) * dt;
    s.n += (an(V) * (1 - n) - bn(V) * n) * dt;
    s.t += dt;
    // Spike detection: crossing 0 mV upward
    if (!s.rising && s.V > 0) {
      s.rising = true;
      s.spikes++;
      s.lastSpike = s.t;
      sim.announce('An action potential fired.');
    }
    if (s.rising && s.V < -40) s.rising = false;
  }

  let sampleAcc = 0;
  function step(dt: number) {
    const ms = dt * MS_PER_SECOND;
    const n = Math.round(ms / DT);
    for (let i = 0; i < n; i++) {
      stepHH(DT);
      sampleAcc += DT;
      if (sampleAcc >= 0.05) {
        sampleAcc = 0;
        history.push({ t: s.t, V: s.V, m: s.m, h: s.h, n: s.n });
      }
    }
    while (history.length && history[0].t < s.t - WINDOW - 20) history.shift();
    ionsAnim += dt;
  }

  /** Voltage at time t (ms) from the recorded history (for drawing propagation). */
  function vAt(t: number) {
    if (!history.length || t < history[0].t) return -65;
    let lo = 0;
    let hi = history.length - 1;
    if (t >= history[hi].t) return history[hi].V;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (history[mid].t <= t) lo = mid;
      else hi = mid;
    }
    return history[lo].V;
  }

  /* ---------- State labels ---------- */
  function state(): { label: string; tone: 'ok' | 'warn' | 'bad' | null } {
    const since = s.t - s.lastSpike;
    const dV = history.length > 2 ? history[history.length - 1].V - history[history.length - 3].V : 0;
    if (p.ttx && s.V < -50) return { label: p.mode === 'steady' || s.t < s.stimUntil ? 'Na⁺ blocked — cannot fire' : 'Resting (Na⁺ channels blocked)', tone: 'bad' };
    if (s.V > -50 && dV > 0) return { label: 'Depolarizing (Na⁺ rushing in)', tone: 'warn' };
    if (s.V > -50 && dV <= 0) return { label: 'Repolarizing (K⁺ flowing out)', tone: 'warn' };
    if (since < 2) return { label: 'Absolute refractory period', tone: 'bad' };
    if (s.V < -68) return { label: 'Hyperpolarized (undershoot)', tone: null };
    if (since < 8) return { label: 'Relative refractory period', tone: 'warn' };
    if (s.V > -62) return { label: 'Small depolarization', tone: null };
    return { label: 'Resting', tone: 'ok' };
  }

  /* ---------- Graphs ---------- */
  const vGraph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="nr-vm"]')!, {
    x: { min: 0, span: WINDOW, max: WINDOW, format: (v) => `${v.toFixed(0)}` },
    y: { min: -90, max: 60, step: 30, format: (v) => `${v}` },
    refs: [
      { value: -65, label: 'resting −65 mV', color: 'text-faint' },
      { value: -55, label: 'approx. threshold', color: 'accent-2' },
    ],
  });
  const gGraph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="nr-gates"]')!, {
    x: { min: 0, span: WINDOW, max: WINDOW, format: (v) => `${v.toFixed(0)}` },
    y: { min: 0, max: 1, step: 0.25, format: (v) => v.toFixed(2) },
  });

  /* ---------- Drawing ---------- */
  const speed = () => (p.myelin ? 60 : 2); // m/s, typical orders of magnitude
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Neuron: soma, dendrites, axon, terminals
    const ay = h * 0.3;
    const sx = 70;
    const ax0 = sx + 30;
    const ax1 = w - 70;
    ctx.strokeStyle = pal['sim-membrane'];
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + (i / 5) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(sx, ay);
      ctx.quadraticCurveTo(sx + Math.cos(a) * 30, ay + Math.sin(a) * 30, sx + Math.cos(a) * 52, ay + Math.sin(a) * 46);
      ctx.stroke();
    }
    // Axon coloured by local voltage (delayed by conduction time)
    const segs = 90;
    const lenMM = 30; // drawn axon represents 30 mm
    const nodes = 9;
    for (let i = 0; i < segs; i++) {
      const u = i / segs;
      let distMM = u * lenMM;
      if (p.myelin) distMM = Math.floor(u * nodes) * (lenMM / nodes); // jumps node to node
      const delay = distMM / speed(); // mm ÷ (m/s) = ms
      const v = vAt(s.t - delay);
      const heat = Math.max(0, Math.min(1, (v + 65) / 100));
      const x0 = ax0 + u * (ax1 - ax0);
      const x1 = ax0 + ((i + 1) / segs) * (ax1 - ax0);
      ctx.strokeStyle = heat > 0.05 ? pal['sim-solute'] : pal['sim-membrane'];
      ctx.globalAlpha = 0.35 + heat * 0.65;
      ctx.lineWidth = 6 + heat * 6;
      ctx.beginPath();
      ctx.moveTo(x0, ay);
      ctx.lineTo(x1 + 0.5, ay);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (p.myelin) {
      ctx.fillStyle = pal['bg-elev'];
      ctx.strokeStyle = pal['border-strong'];
      for (let k = 0; k < nodes; k++) {
        const x0 = ax0 + (k / nodes) * (ax1 - ax0) + 6;
        const x1 = ax0 + ((k + 1) / nodes) * (ax1 - ax0) - 6;
        ctx.beginPath();
        ctx.roundRect(x0, ay - 11, x1 - x0, 22, 10);
        ctx.globalAlpha = 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      }
    }
    // Soma (coloured by its own voltage)
    const heatS = Math.max(0, Math.min(1, (s.V + 65) / 100));
    ctx.fillStyle = pal['sim-cytoplasm'];
    ctx.strokeStyle = heatS > 0.05 ? pal['sim-solute'] : pal['sim-membrane'];
    ctx.lineWidth = 3 + heatS * 3;
    ctx.beginPath();
    ctx.arc(sx, ay, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Axon terminals
    ctx.strokeStyle = pal['sim-membrane'];
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(ax1, ay);
      ctx.lineTo(ax1 + 28, ay + i * 18);
      ctx.stroke();
      ctx.fillStyle = pal['sim-membrane'];
      ctx.beginPath();
      ctx.arc(ax1 + 31, ay + i * 18, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const lbl = { bg: pal['bg-elev'], fg: pal['sim-text'] };
    pill(ctx, 'Cell body', sx, ay - 44, lbl, size);
    pill(ctx, p.myelin ? 'Myelinated axon (signal jumps between gaps)' : 'Axon', (ax0 + ax1) / 2, ay - 30, lbl, size);
    pill(ctx, 'Terminals', ax1 + 10, ay + 46, lbl, size);

    // Membrane close-up with channels
    const my = h * 0.68;
    const mh = 36;
    ctx.fillStyle = pal.warning;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(16, my - mh / 2 - 46, w - 32, 46);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(11, 600);
    ctx.fillText('OUTSIDE the cell: high Na⁺', 24, my - mh / 2 - 30);
    ctx.fillText('INSIDE the cell: high K⁺', 24, Math.min(size.h - 8, my + mh / 2 + 40));
    ctx.fillStyle = pal['sim-membrane'];
    ctx.globalAlpha = 0.25;
    ctx.fillRect(16, my - mh / 2, w - 32, mh);
    ctx.globalAlpha = 1;
    const naOpen = (p.ttx ? 0 : 1) * s.m ** 3 * s.h;
    const kOpen = (p.tea ? 0 : 1) * s.n ** 4;
    const channels = 6;
    for (let i = 0; i < channels; i++) {
      const isNa = i % 2 === 0;
      const cx = 60 + (i / (channels - 1)) * (w - 120);
      const open = isNa ? Math.min(1, naOpen * 4) : Math.min(1, kOpen * 2.2);
      const gap = 4 + open * 10;
      ctx.fillStyle = isNa ? pal.warning : pal['accent-2'];
      ctx.fillRect(cx - gap - 9, my - mh / 2 - 6, 9, mh + 12);
      ctx.fillRect(cx + gap, my - mh / 2 - 6, 9, mh + 12);
      ctx.fillStyle = pal['sim-text'];
      ctx.font = font(10, 700);
      ctx.textAlign = 'center';
      ctx.fillText(isNa ? 'Na⁺' : 'K⁺', cx, my + mh / 2 + 22);
      // Ions moving through open channels
      if (open > 0.15) {
        for (let k = 0; k < 3; k++) {
          const ph = ((ionsAnim * 1.5 + k / 3) % 1) * (isNa ? 1 : -1);
          const span = mh + 40;
          const iy = isNa ? my - span / 2 + Math.abs(ph) * span : my + span / 2 - Math.abs(ph) * span;
          ctx.fillStyle = isNa ? pal.warning : pal['accent-2'];
          ctx.beginPath();
          ctx.arc(cx, iy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (isNa && p.ttx) {
        ctx.fillStyle = pal['sim-text'];
        ctx.fillText('blocked', cx, my - mh / 2 - 12);
      }
      if (!isNa && p.tea) {
        ctx.fillStyle = pal['sim-text'];
        ctx.fillText('blocked', cx, my - mh / 2 - 12);
      }
    }
    ctx.textAlign = 'left';
    pill(ctx, `${s.V.toFixed(0)} mV`, w - 60, my, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Readouts
    const st = state();
    ui.readout('state', st.label, st.tone);
    ui.readout('vm', `${s.V.toFixed(1)} mV`);
    ui.readout('na', `${(naOpen * 100).toFixed(1)}%`);
    ui.readout('k', `${(kOpen * 100).toFixed(1)}%`);
    ui.readout('spikes', String(s.spikes));
    ui.readout('speed', `≈ ${speed()} m/s (${p.myelin ? 'myelinated' : 'unmyelinated'})`);
    sim.setTime(s.t, 'ms');
    sim.setBadge(st.label);
    canvas.setAttribute('aria-label', `Neuron membrane potential ${s.V.toFixed(0)} millivolts. ${st.label}. ${s.spikes} action potentials so far.`);

    // Graphs (last 40 ms)
    const t0 = Math.max(0, s.t - WINDOW);
    const recent = history.filter((q) => q.t >= t0);
    const xAxis = { min: t0, span: WINDOW, max: t0 + WINDOW, format: (v: number) => `${v.toFixed(0)}` };
    vGraph.opts.x = xAxis;
    gGraph.opts.x = xAxis;
    vGraph.set('v', { label: 'Membrane potential', color: 'sim-solute', points: recent.map((q) => ({ x: q.t, y: q.V })), legend: false });
    vGraph.draw();
    const pts = (k: 'm' | 'h' | 'n'): Point[] => recent.map((q) => ({ x: q.t, y: q[k] }));
    gGraph.set('m', { label: 'm — Na⁺ activation (opens fast)', color: 'warning', points: pts('m') });
    gGraph.set('h', { label: 'h — Na⁺ inactivation (closes slowly)', color: 'accent', points: pts('h') });
    gGraph.set('n', { label: 'n — K⁺ activation (opens slowly)', color: 'accent-2', points: pts('n') });
    gGraph.draw();
    gGraph.renderLegend(root.querySelector('[data-legend="nr-gates"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const modeCtl = ui.choice<'pulse' | 'steady'>('nr-mode', (v) => {
    p.mode = v;
    if (!sim.running) sim.play();
  });
  const ampCtl = ui.range('nr-amp', (v) => `${v} µA/cm²`, (v) => (p.amp = v));
  const durCtl = ui.range('nr-dur', (v) => `${v.toFixed(1)} ms`, (v) => (p.dur = v));
  const ttxCtl = ui.toggle('nr-ttx', (v) => ((p.ttx = v), sim.requestRender()));
  const teaCtl = ui.toggle('nr-tea', (v) => ((p.tea = v), sim.requestRender()));
  const myelinCtl = ui.toggle('nr-myelin', (v) => ((p.myelin = v), sim.requestRender()));

  root.querySelector('[data-stim]')!.addEventListener('click', () => {
    if (p.mode === 'steady') modeCtl.set('pulse');
    s.stimUntil = s.t + p.dur;
    if (!sim.running) sim.play();
    sim.announce(`Stimulus of ${p.amp} microamps per square centimetre for ${p.dur} milliseconds.`);
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const h = size.h;
    if (y > h * 0.5) {
      sim.showTooltip(x, y, 'Cell membrane and ion channels', 'Voltage-gated Na⁺ channels (orange) open first and let sodium rush in; K⁺ channels (purple) open later and let potassium flow out, restoring the negative charge.');
    } else if (x < 110) {
      sim.showTooltip(x, y, 'Cell body and dendrites', 'Dendrites receive signals from other neurons. If the combined input pushes the membrane past threshold, an action potential starts.');
    } else {
      sim.showTooltip(x, y, p.myelin ? 'Myelin sheath' : 'Axon', p.myelin ? 'Fatty insulation that lets the signal jump between gaps (nodes of Ranvier), making conduction up to about 100 m/s.' : 'The signal regenerates itself all along the axon. Thin unmyelinated axons conduct at around 0.5–2 m/s.');
    }
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      modeCtl.set('pulse', false);
      ampCtl.set(10, false);
      durCtl.set(1, false);
      ttxCtl.set(false, false);
      teaCtl.set(false, false);
      myelinCtl.set(false, false);
      Object.assign(p, { mode: 'pulse', amp: 10, dur: 1, ttx: false, tea: false, myelin: false });
      rest();
    },
  });
  rest();
  sim.requestRender();
}
