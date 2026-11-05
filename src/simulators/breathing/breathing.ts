/**
 * Breathing and gas exchange.
 *
 * Mechanics: the breathing muscles set a target lung volume
 *   V_target = FRC + effort × tidal volume
 * and the lungs follow it through the airways, which resist flow:
 *   dV/dt = (V_target − V) / τ,   τ = R × C
 * with compliance C = 0.1 L/cmH2O and airway resistance R (about
 * 2 cmH2O·s/L normally, much higher in an asthma attack, and higher still
 * when breathing out because narrowed airways close further). Alveolar
 * pressure is −R × flow: slightly below atmospheric when breathing in.
 *
 * Gas exchange (textbook alveolar gas equations):
 *   alveolar ventilation  V_A = (tidal volume − 150 mL dead space) × rate
 *   P_ACO2 = 40 mmHg × metabolism × (4.2 L/min ÷ V_A)
 *   P_IO2  = 0.21 × (air pressure − 47 mmHg water vapour)
 *   P_AO2  = P_IO2 − P_ACO2 / 0.8
 * Arterial oxygen is P_AO2 minus a small alveolar–arterial gap (larger in
 * asthma, where some lung regions get little air). Saturation comes from the oxygen–haemoglobin dissociation
 * curve (Hill equation, n = 2.7, P50 = 26.8 mmHg).
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'accent', 'warning', 'danger'] as const;
const FRC = 2400; // mL left in the lungs after a normal breath out
const C = 0.1; // L per cmH2O

type Scene = 'rest' | 'exercise' | 'altitude' | 'asthma';
// aa = alveolar–arterial oxygen gap (mmHg): small in healthy lungs, larger when airways are blocked unevenly
const SCENES: Record<Scene, { rate: number; tv: number; R: number; patm: number; metab: number; aa: number; note: string }> = {
  rest: { rate: 12, tv: 500, R: 2, patm: 760, metab: 1, aa: 5, note: 'Quiet breathing at sea level.' },
  exercise: { rate: 30, tv: 1400, R: 2, patm: 760, metab: 8, aa: 8, note: 'Muscles use far more oxygen and make more CO₂, so breathing gets faster and deeper.' },
  altitude: { rate: 16, tv: 600, R: 2, patm: 462, metab: 1, aa: 5, note: 'At 4,000 m the air pressure is only about 60 % of sea level, so each breath holds less oxygen.' },
  asthma: { rate: 22, tv: 700, R: 5, patm: 760, metab: 1.3, aa: 25, note: 'Narrowed airways slow the air. The person tries to breathe harder, but less air moves; breathing out is hardest, so air gets trapped in the lungs.' },
};

const INFO: Record<string, [string, string]> = {
  trachea: ['Trachea (windpipe)', 'Carries air to and from the lungs. Rings of cartilage keep it open.'],
  bronchi: ['Bronchi', 'The trachea divides into two bronchi, one to each lung, which branch into smaller bronchioles.'],
  lungs: ['Lungs', 'Spongy organs made of about 480 million tiny air sacs (alveoli). They have no muscle of their own; they expand because the chest does.'],
  diaphragm: ['Diaphragm', 'A dome-shaped sheet of muscle under the lungs. When it contracts it flattens and moves down, making the chest bigger so air flows in.'],
  ribs: ['Ribs and intercostal muscles', 'The external intercostal muscles pull the ribs up and out when you breathe in, also enlarging the chest.'],
  heart: ['Heart', 'Pumps blood through the lungs to collect oxygen, then around the body.'],
  alveolus: ['Alveolus', 'A tiny air sac with walls one cell thick. Oxygen diffuses from here into the blood; carbon dioxide diffuses the other way.'],
  capillary: ['Capillary', 'A blood vessel one cell thick wrapped around the alveoli. Red blood cells pick up oxygen here.'],
};

/** Oxygen saturation (%) of haemoglobin at a given oxygen partial pressure (mmHg). */
const saturation = (po2: number) => {
  const a = Math.pow(Math.max(po2, 0), 2.7);
  return (100 * a) / (a + Math.pow(26.8, 2.7));
};

export function initBreathing(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-scene-note]')!;

  const p = { scene: 'rest' as Scene, rate: 12, tv: 500, manual: false, effort: 0 };
  let t = 0;
  let phase = 0; // 0–1 within the breath
  let V = FRC;
  let flow = 0; // mL/s
  let breathMin = FRC;
  let breathMax = FRC;
  let lastTidal = 500;
  let gas = { pao2: 100, paco2: 40, sat: 97.5 };
  let history: Point[] = [];
  let molecules: { kind: 'o2' | 'co2'; x: number; y: number; vy: number; life: number }[] = [];
  let rbcPhase = 0;

  const scene = () => SCENES[p.scene];

  function restart() {
    t = 0;
    phase = 0;
    V = FRC;
    flow = 0;
    breathMin = breathMax = FRC;
    lastTidal = p.tv;
    history = [];
    molecules = [];
    updateGas();
  }

  function updateGas() {
    const s = scene();
    const va = Math.max(0.3, ((lastTidal - 150) * p.rate) / 1000); // L/min
    const paco2 = clamp((40 * s.metab * 4.2) / va, 12, 95);
    const pio2 = 0.21 * (s.patm - 47);
    const pao2 = clamp(pio2 - paco2 / 0.8, 15, 140);
    // Ease towards the new values so the readouts do not jump
    gas.pao2 += (pao2 - gas.pao2) * 0.3;
    gas.paco2 += (paco2 - gas.paco2) * 0.3;
    gas.sat = saturation(gas.pao2 - s.aa);
  }

  /** Muscle effort 0–1 through one breath: in for 40 % of the time, out for 60 %. */
  const effortAt = (f: number) => (f < 0.4 ? (1 - Math.cos((Math.PI * f) / 0.4)) / 2 : (1 + Math.cos((Math.PI * (f - 0.4)) / 0.6)) / 2);

  /* ---------- Model ---------- */
  function step(dt: number) {
    t += dt;
    const s = scene();
    const prevPhase = phase;
    if (!p.manual) {
      phase += dt / (60 / p.rate);
      if (phase >= 1) phase -= 1;
      p.effort = effortAt(phase);
    }
    const target = FRC + p.effort * p.tv;
    const breathingOut = target < V;
    const R = s.R * (breathingOut && s.R > 4 ? 1.6 : 1);
    const tau = R * C;
    // Small sub-steps keep the fast normal response stable
    const n = Math.ceil(dt / 0.01);
    for (let i = 0; i < n; i++) {
      flow = (target - V) / tau;
      V += (flow * dt) / n;
    }
    breathMin = Math.min(breathMin, V);
    breathMax = Math.max(breathMax, V);
    // A new breath starts: record the volume actually moved
    if (!p.manual && phase < prevPhase) {
      lastTidal = breathMax - breathMin;
      breathMin = breathMax = V;
    }
    if (p.manual && t % 4 < dt) {
      lastTidal = Math.max(100, breathMax - breathMin);
      breathMin = breathMax = V;
    }
    if (Math.floor((t - dt) * 2) !== Math.floor(t * 2)) updateGas();

    history.push({ x: t, y: V });
    while (history.length && history[0].x < t - 20) history.shift();

    // Gas molecules in the alveolus view: more O2 crosses when alveolar O2 is high
    const o2Rate = Math.max(0, gas.pao2 - 40) / 12;
    const co2Rate = 4; // venous blood always carries extra CO2 to unload
    if (Math.random() < o2Rate * dt) molecules.push({ kind: 'o2', x: 120 + Math.random() * 160, y: 260, vy: 55, life: 0 });
    if (Math.random() < co2Rate * dt) molecules.push({ kind: 'co2', x: 120 + Math.random() * 160, y: 410, vy: -55, life: 0 });
    for (const m of molecules) {
      m.y += m.vy * dt;
      m.x += Math.sin(m.life * 6 + m.x) * 10 * dt;
      m.life += dt;
    }
    molecules = molecules.filter((m) => m.life < 2.6);
    rbcPhase += dt * 40;
  }

  /* ---------- Layout ---------- */
  const isStacked = () => size.h > size.w * 1.05;
  // Stacked boxes leave room for the badge (top) and hint chip (bottom)
  const box = () => (isStacked() ? { bw: 560, bh: 1200, top: 40 } : { bw: 1000, bh: 600, top: 0 });
  const tf = () => {
    const { bw, bh, top } = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 + top * k };
  };
  /** Where the alveolus panel sits in the design box. */
  const panelAt = () => (isStacked() ? { x: 80, y: 600 } : { x: 590, y: 0 });

  // Volume → shape: 0 at FRC, 1 at about a deep breath (FRC + 2,000 mL)
  const fill = () => clamp((V - FRC) / 2000, -0.2, 1.4);
  const diaphragmPeak = (f: number) => 395 + f * 85; // dome top moves down as you breathe in
  const diaphragmY = (x: number, f: number) => {
    const base = 470 + f * 40;
    const peak = diaphragmPeak(f);
    const u = (x - 280) / 210;
    return base - (base - peak) * Math.max(0, 1 - u * u);
  };

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const f = fill();
    const fs = (px: number) => font(px / k, 650);

    /* Chest */
    ctx.fillStyle = 'rgba(230, 180, 150, 0.16)';
    ctx.strokeStyle = 'rgba(200, 140, 110, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(200, 30);
    ctx.lineTo(360, 30);
    ctx.quadraticCurveTo(500 + f * 12, 80, 505 + f * 14, 300);
    ctx.lineTo(500, 590);
    ctx.lineTo(60, 590);
    ctx.lineTo(55 - f * 14, 300);
    ctx.quadraticCurveTo(60 - f * 12, 80, 200, 30);
    ctx.fill();
    ctx.stroke();

    // Lungs: the bottom edge follows the diaphragm
    const lung = (cx: number, side: -1 | 1) => {
      const half = 92 + f * 14;
      const top = 120 - f * 6;
      const path = new Path2D();
      const inner = cx - side * half * 0.55;
      const outer = cx + side * half;
      path.moveTo(inner, top + 40);
      path.quadraticCurveTo(cx, top - 30, outer, top + 70);
      path.quadraticCurveTo(outer + side * 14, 300, outer, diaphragmY(outer, f) - 6);
      for (let x = outer; side > 0 ? x >= inner : x <= inner; x -= side * 10) path.lineTo(x, diaphragmY(x, f) - 6);
      path.quadraticCurveTo(inner - side * 6, 260, inner, top + 40);
      return path;
    };
    const lungL = lung(180, -1);
    const lungR = lung(380, 1);
    for (const lp of [lungL, lungR]) {
      ctx.fillStyle = 'rgba(240, 140, 160, 0.55)';
      ctx.fill(lp);
      ctx.strokeStyle = 'rgba(200, 80, 110, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke(lp);
    }
    // Heart between the lungs
    ctx.fillStyle = 'rgba(190, 50, 60, 0.75)';
    ctx.beginPath();
    ctx.ellipse(300, 372 + f * 20, 40, 50, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Airways
    ctx.strokeStyle = 'rgba(235, 225, 215, 0.95)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(280, 0);
    ctx.lineTo(280, 175);
    ctx.stroke();
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(280, 170);
    ctx.lineTo(215, 230);
    ctx.lineTo(190, 290);
    ctx.moveTo(280, 170);
    ctx.lineTo(345, 230);
    ctx.lineTo(370, 290);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (const [x, y, dx] of [[215, 230, -50], [190, 290, -40], [345, 230, 50], [370, 290, 40]] as const) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + 30);
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 0.3, y + 50);
    }
    ctx.stroke();
    // Cartilage rings
    ctx.strokeStyle = 'rgba(160, 150, 140, 0.8)';
    ctx.lineWidth = 2;
    for (let y = 20; y < 165; y += 18) {
      ctx.beginPath();
      ctx.moveTo(270, y);
      ctx.lineTo(290, y);
      ctx.stroke();
    }

    // Ribs: tilt upwards as the chest expands
    ctx.strokeStyle = 'rgba(240, 235, 225, 0.7)';
    ctx.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      const y = 110 + i * 58;
      const lift = f * 10 * (1 - i * 0.08);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(280 + side * 22, y - lift * 0.4);
        ctx.quadraticCurveTo(280 + side * (200 + f * 10), y - 25 - lift, 280 + side * (215 + f * 13), y + 40 - lift);
        ctx.stroke();
      }
    }

    // Diaphragm
    ctx.strokeStyle = '#c2453c';
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let x = 60; x <= 500; x += 8) (x === 60 ? ctx.moveTo : ctx.lineTo).call(ctx, x, diaphragmY(x, f));
    ctx.stroke();
    if (p.manual) {
      const hy = diaphragmPeak(clamp((p.effort * p.tv) / 2000, -0.2, 1.4));
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(280, hy, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal['sim-bg'];
      ctx.font = font(16, 800);
      ctx.textAlign = 'center';
      ctx.fillText('↕', 280, hy + 6);
      ctx.textAlign = 'left';
    }

    // Airflow arrow at the mouth end of the trachea
    if (Math.abs(flow) > 30) {
      const len = clamp(Math.abs(flow) / 8, 20, 90);
      const inward = flow > 0;
      arrow(ctx, 330, inward ? 20 : 20 + len, 330, inward ? 20 + len : 20, inward ? '#3fa7d6' : '#9aa3ad', 5, 14);
      ctx.fillStyle = pal['sim-text'];
      ctx.font = fs(12);
      ctx.fillText(inward ? 'Air in' : 'Air out', 345, 50);
    }

    // Labels (chest)
    if (labelsOn) {
      const tag = (text: string, x: number, y: number) => {
        ctx.font = fs(12);
        const tw = ctx.measureText(text).width;
        const ph = 22 / k;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pal['bg-elev'];
        ctx.beginPath();
        ctx.roundRect(x - tw / 2 - 6 / k, y - ph / 2, tw + 12 / k, ph, ph / 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      };
      tag('Trachea', 200, 70);
      tag('Lung', 150, 330);
      tag('Lung', 410, 330);
      tag('Diaphragm', 120, diaphragmY(120, f) + 30);
      tag('Rib', 470, 120);
      tag('Bronchus', 370, 200);
    }

    /* Alveolus close-up */
    const pa = panelAt();
    ctx.save();
    ctx.translate(pa.x, pa.y);
    ctx.fillStyle = pal['text-faint'];
    ctx.font = fs(12);
    ctx.fillText('Inside one alveolus (greatly magnified)', 20, isStacked() ? 30 : 80);
    const ar = 115 + f * 10;
    ctx.fillStyle = 'rgba(160, 210, 240, 0.25)';
    ctx.strokeStyle = 'rgba(240, 140, 160, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(200, 225, ar, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // bronchiole feeding the alveolus
    ctx.strokeStyle = 'rgba(235, 225, 215, 0.9)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(200, 225 - ar);
    ctx.lineTo(200, isStacked() ? 45 : 92);
    ctx.stroke();
    // capillary underneath
    const cy = 385;
    ctx.fillStyle = 'rgba(200, 60, 70, 0.22)';
    ctx.beginPath();
    ctx.roundRect(10, cy, 380, 54, 27);
    ctx.fill();
    // red blood cells: blue on the left, coloured by saturation on the right
    for (let i = 0; i < 9; i++) {
      const x = 20 + ((i * 46 + rbcPhase) % 380);
      const u = x / 390;
      const sat = 75 + (gas.sat - 75) * clamp(u * 1.6, 0, 1);
      const red = clamp((sat - 70) / 30, 0, 1);
      ctx.fillStyle = `rgb(${Math.round(80 + 140 * red)}, ${Math.round(80 - 20 * red)}, ${Math.round(200 - 140 * red)})`;
      ctx.beginPath();
      ctx.ellipse(x, cy + 27, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // gas molecules
    for (const m of molecules) {
      ctx.globalAlpha = clamp(2.6 - m.life, 0, 1);
      ctx.fillStyle = m.kind === 'o2' ? '#e8504a' : '#9aa3ad';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.kind === 'o2' ? 5 : 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = fs(12);
    ctx.fillStyle = '#e8504a';
    ctx.fillText('● O₂ into the blood', 20, 480);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillText('● CO₂ out of the blood', 210, 480);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Blood flow →', 20, cy - 10);
    ctx.restore();

    ctx.restore();
    updateReadouts();
    sim.setTime(t);
    drawGraph();
  }

  /* ---------- Readouts and graph ---------- */
  function updateReadouts() {
    const breathingIn = flow > 30;
    const breathingOut = flow < -30;
    ui.readout('phase', breathingIn ? 'Breathing in' : breathingOut ? 'Breathing out' : 'Pause');
    sim.setBadge(breathingIn ? 'Breathing in' : breathingOut ? 'Breathing out' : scene().patm < 700 ? 'High altitude' : 'Breathing');
    ui.readout('volume', `${Math.round(V)} mL`);
    const palv = (-flow / 1000) * scene().R * (flow < 0 && scene().R > 4 ? 1.6 : 1);
    ui.readout('pressure', `${palv >= 0 ? '+' : '−'}${Math.abs(palv).toFixed(1)} cmH₂O`);
    ui.readout('tidal', `${Math.round(lastTidal)} mL per breath`, lastTidal < p.tv * 0.75 ? 'warn' : null);
    ui.readout('minute', `${((lastTidal * p.rate) / 1000).toFixed(1)} L per minute`);
    ui.readout('sat', `${gas.sat.toFixed(0)} %`, gas.sat >= 95 ? 'ok' : gas.sat >= 90 ? 'warn' : 'bad');
    ui.readout('co2', `${gas.paco2.toFixed(0)} mmHg`, gas.paco2 > 45 ? 'bad' : gas.paco2 < 32 ? 'warn' : null);
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="br-graph"]')!, {
    x: { min: 0, span: 20, format: (x) => `${x.toFixed(0)}s` },
    y: { min: 1500, max: 5500, step: 1000, format: (v) => `${(v / 1000).toFixed(1)} L` },
    refs: [{ value: FRC, label: 'Resting level', color: 'text-faint' }],
  });
  function drawGraph() {
    graph.opts.x = { min: Math.max(0, t - 20), span: 20, max: Math.max(20, t), format: (x) => `${x.toFixed(0)}s` };
    graph.set('v', { label: 'Lung volume', color: 'accent', points: history });
    graph.draw();
  }

  /* ---------- Interaction ---------- */
  const toDesign = (cx: number, cy: number) => {
    const { k, ox, oy } = tf();
    return { x: (cx - ox) / k, y: (cy - oy) / k };
  };
  function inspect(cx: number, cy: number) {
    const { x, y } = toDesign(cx, cy);
    const pa = panelAt();
    const f = fill();
    let id: string | null = null;
    const lx = x - pa.x;
    const ly = y - pa.y;
    if (lx > 0 && lx < 400 && ly > 0 && ly < 500) {
      if (ly >= 385 && ly <= 440) id = 'capillary';
      else if (Math.hypot(lx - 200, ly - 225) < 130) id = 'alveolus';
    } else if (Math.abs(y - diaphragmY(x, f)) < 18 && x > 60 && x < 500) id = 'diaphragm';
    else if (Math.abs(x - 280) < 16 && y < 175) id = 'trachea';
    else if (y > 165 && y < 300 && Math.abs(x - 280) < 110 && Math.abs(x - 280) > 10 && Math.abs(y - 170 - Math.abs(x - 280) * 0.95) < 30) id = 'bronchi';
    else if (Math.hypot((x - 300) / 44, (y - 372 - f * 20) / 52) < 1) id = 'heart';
    else if ((x > 80 && x < 260) || (x > 300 && x < 480)) id = y > 100 && y < diaphragmY(x, f) ? 'lungs' : null;
    if (!id && x > 50 && x < 510 && y > 60 && y < 470) id = 'ribs';
    if (!id) return sim.hideTooltip();
    sim.showTooltip(cx, cy, INFO[id][0], INFO[id][1]);
  }
  enableDrag<'diaphragm'>(canvas, {
    hit: (cx, cy) => {
      if (!p.manual) return null;
      const { x, y } = toDesign(cx, cy);
      const hy = diaphragmPeak(clamp((p.effort * p.tv) / 2000, -0.2, 1.4));
      return Math.hypot(x - 280, y - hy) < 40 ? 'diaphragm' : null;
    },
    move: (_id, cx, cy) => {
      const { y } = toDesign(cx, cy);
      // Peak position → effort (inverse of diaphragmPeak)
      const e = clamp((((y - 395) / 85) * 2000) / p.tv, 0, 1);
      effortCtl.set(Math.round(e * 100));
    },
    click: inspect,
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  let labelsOn = true;
  const sceneCtl = ui.choice<Scene>('br-scene', (v) => applyScene(v));
  const rate = ui.range('br-rate', (v) => `${v} per min`, (v) => (p.rate = v));
  const depth = ui.range('br-depth', (v) => `${v} mL`, (v) => (p.tv = v));
  const manual = ui.toggle('br-manual', (v) => {
    p.manual = v;
    ui.showWhen('[data-manual-only]', v);
    if (v) effortCtl.set(Math.round(p.effort * 100));
    sim.requestRender();
  });
  const effortCtl = ui.range('br-effort', (v) => `${v} %`, (v) => {
    if (p.manual) p.effort = v / 100;
    sim.requestRender();
  });
  const labelsCtl = ui.toggle('br-labels', (v) => ((labelsOn = v), sim.requestRender()));

  function applyScene(v: Scene) {
    p.scene = v;
    rate.set(SCENES[v].rate);
    depth.set(SCENES[v].tv);
    noteEl.textContent = SCENES[v].note;
    lastTidal = SCENES[v].tv;
    sim.requestRender();
  }

  restart();
  noteEl.textContent = SCENES.rest.note;
  ui.showWhen('[data-manual-only]', false);
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      sceneCtl.set('rest', false);
      manual.set(false);
      labelsCtl.set(true);
      applyScene('rest');
      gas = { pao2: 100, paco2: 40, sat: 97.5 };
      restart();
    },
  });
}
