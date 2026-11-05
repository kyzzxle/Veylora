/**
 * Cellular respiration: three views.
 *   cell    – an animal cell: glucose enters, glycolysis splits it in the
 *             cytoplasm, pyruvate enters mitochondria (with oxygen) or becomes
 *             lactate (without), and ATP is released. Oxygen, glucose and the
 *             cell's energy demand can be changed.
 *   steps   – glycolysis, link reaction, Krebs cycle and electron transport
 *             chain, one stage at a time, with a running tally per glucose
 *   compare – aerobic respiration vs anaerobic pathways (lactate or ethanol)
 *
 * Teaching model (relative units, not measured rates):
 *   ATP per glucose: 2 from glycolysis, about 30 more when pyruvate is fully
 *   oxidised in mitochondria (real estimates are about 30–32 in total).
 *   Glycolysis capacity  Cg = 2.6·s/(s + 0.3)        s = glucose availability 0–1
 *   Mitochondria capacity Cm = 1.25·o/(o + 0.25)     o = oxygen availability 0–1
 *   The cell makes the ATP it needs (demand D) aerobically as far as Cm allows;
 *   any shortfall speeds up glycolysis and the extra pyruvate becomes lactate
 *   (the Pasteur effect), until glycolysis reaches Cg.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'cell' | 'steps' | 'compare';
type Fs = (px: number, w?: number) => string;

const GLUCOSE = '#f2c94c';
const PYRUVATE = '#e07a5f';
const LACTATE = '#9b5de5';
const OXYGEN = '#4cc3e0';
const CO2 = '#9aa5b1';
const ATP_GLY = '#ff9f1c';
const ATP_MITO = '#2ec27e';
const MITO = '#d9694a';
const NADH = '#5b8fd6';
const FADH = '#c77dff';
const MEMBRANE = '#6aa7d8';

/** One glucose molecule fully respired aerobically gives this much ATP in the model. */
const AEROBIC_ATP = 32;

interface Rates {
  Jg: number; // glucose through glycolysis per s
  Ja: number; // glucose fully oxidised per s
  Jan: number; // glucose fermented per s
  atp: number; // ATP per s
  D: number; // ATP needed per s
  Cm: number;
}

export function rates(glucose: number, oxygen: number, demand: number): Rates {
  const s = glucose / 100;
  const o = oxygen / 100;
  const Cg = (2.6 * s) / (s + 0.3);
  const Cm = (1.25 * o) / (o + 0.25);
  const D = demand * AEROBIC_ATP;
  const Ja = Math.min(D / AEROBIC_ATP, Cm, Cg);
  const Jan = Math.max(0, Math.min((D - AEROBIC_ATP * Ja) / 2, Cg - Ja));
  return { Jg: Ja + Jan, Ja, Jan, atp: AEROBIC_ATP * Ja + 2 * Jan, D, Cm };
}

const STEPS = [
  {
    title: 'Overview',
    where: 'Cytoplasm and mitochondria',
    inputs: 'Glucose + oxygen',
    outputs: 'Carbon dioxide + water + ATP',
    text: 'Respiration releases the energy stored in glucose in small, controlled steps and stores it in ATP. Glycolysis happens in the cytoplasm; the link reaction, Krebs cycle and electron transport chain happen in the mitochondria.',
  },
  {
    title: '1 · Glycolysis',
    where: 'Cytoplasm',
    inputs: 'Glucose (6 C), 2 ATP, 2 NAD⁺',
    outputs: '2 pyruvate (3 C), 4 ATP (2 net), 2 NADH',
    text: 'Two ATP are spent to activate glucose, which then splits into two 3-carbon molecules. These are oxidised to pyruvate, making 4 ATP and 2 NADH. No oxygen is needed.',
  },
  {
    title: '2 · Link reaction',
    where: 'Mitochondrial matrix',
    inputs: '2 pyruvate, 2 NAD⁺, coenzyme A',
    outputs: '2 acetyl-CoA (2 C), 2 CO₂, 2 NADH',
    text: 'Each pyruvate enters a mitochondrion. One carbon is removed as carbon dioxide, NAD⁺ picks up hydrogen to become NADH, and the 2-carbon acetyl group joins coenzyme A.',
  },
  {
    title: '3 · Krebs cycle',
    where: 'Mitochondrial matrix',
    inputs: 'Acetyl-CoA (twice per glucose)',
    outputs: 'Per glucose: 4 CO₂, 6 NADH, 2 FADH₂, 2 ATP',
    text: 'The acetyl group joins a 4-carbon molecule to make citrate (6 C). Around the cycle two carbons leave as CO₂ and hydrogen is passed to NAD⁺ and FAD. The cycle turns twice for each glucose.',
  },
  {
    title: '4 · Electron transport chain',
    where: 'Inner mitochondrial membrane',
    inputs: 'NADH, FADH₂, oxygen',
    outputs: 'About 26–28 ATP, water',
    text: 'NADH and FADH₂ hand electrons to proteins in the inner membrane. Their energy pumps H⁺ ions out of the matrix; the ions flow back through ATP synthase, which makes most of the ATP. Oxygen accepts the electrons at the end, forming water.',
  },
];
const TALLY: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [2, 2, 0, 0],
  [2, 4, 0, 2],
  [4, 10, 2, 6],
  [32, 0, 0, 6],
];

const INFO: Record<string, [string, string]> = {
  membrane: ['Cell membrane', 'Lets glucose and oxygen into the cell and carbon dioxide and lactate out.'],
  cytoplasm: ['Cytoplasm', 'Glycolysis happens here. It splits glucose into two pyruvate and makes 2 ATP without needing oxygen. Without oxygen, pyruvate is turned into lactate here.'],
  nucleus: ['Nucleus', 'Contains DNA, including the genes for the enzymes of respiration. It is not part of respiration itself.'],
  mito: ['Mitochondrion', 'The site of the link reaction, Krebs cycle and electron transport chain. With oxygen, it makes about 15 times more ATP per glucose than glycolysis alone.'],
  outer: ['Outer membrane', 'Surrounds the mitochondrion. Pyruvate crosses it on its way to the matrix.'],
  inner: ['Inner membrane and cristae', 'Folded to give a large surface for the electron transport chain and ATP synthase, where most ATP is made.'],
  matrix: ['Matrix', 'The fluid inside the inner membrane, where the link reaction and the Krebs cycle take place.'],
  space: ['Intermembrane space', 'H⁺ ions pumped here by the electron transport chain build up a gradient that drives ATP synthase.'],
};

/* Cell geometry (cell region, design units) */
const CELL = { cx: 330, cy: 285, rx: 300, ry: 245 };
const NUC = { x: 315, y: 280, rx: 72, ry: 60 };
const MITOS: [number, number, number][] = [
  [165, 165, 0.45],
  [495, 160, -0.35],
  [130, 375, -0.5],
  [520, 390, 0.3],
  [340, 455, 0.05],
  [470, 275, 1.3],
];

interface Particle {
  kind: 'glucose' | 'pyruvate' | 'lactate' | 'o2' | 'co2' | 'spark';
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  aerobic?: boolean;
  mito?: boolean;
}

export function initRespiration(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const graphPanel = root.querySelector<HTMLElement>('[data-graph-panel]')!;
  const stepLabel = root.querySelector<HTMLElement>('[data-step-label]')!;
  const stepText = root.querySelector<HTMLElement>('[data-step-text]')!;

  const DEF = { view: 'cell' as View, oxygen: 100, glucose: 100, demand: 'rest' as 'rest' | 'active', step: 0, ferm: 'animal' as 'animal' | 'yeast' };
  const st = { ...DEF };
  let anim = 0;
  let stepT = 0;
  let simT = 0;
  let reserve = 1;
  let lactate = 0;
  let parts: Particle[] = [];
  let accG = 0;
  let accO = 0;
  let hist: { a: Point[]; l: Point[] } = { a: [], l: [] };
  const demandOf = () => (st.demand === 'active' ? 0.8 : 0.35);
  const R = () => rates(st.glucose, st.oxygen, demandOf());

  /* ---------- Cell view simulation ---------- */
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  function insideCell(margin = 0.82): [number, number] {
    for (;;) {
      const x = rand(-1, 1);
      const y = rand(-1, 1);
      if (x * x + y * y > margin * margin) continue;
      const px = CELL.cx + x * CELL.rx;
      const py = CELL.cy + y * CELL.ry;
      if (Math.hypot((px - NUC.x) / (NUC.rx + 25), (py - NUC.y) / (NUC.ry + 25)) < 1) continue;
      return [px, py];
    }
  }
  const edge = (a: number, f = 1): [number, number] => [CELL.cx + Math.cos(a) * CELL.rx * f, CELL.cy + Math.sin(a) * CELL.ry * f];
  function nearestMito(x: number, y: number) {
    return MITOS.reduce((b, m) => (Math.hypot(m[0] - x, m[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? m : b));
  }
  function spark(x: number, y: number, mito: boolean) {
    parts.push({ kind: 'spark', x, y, tx: x + rand(-12, 12), ty: y - 38, t: 0, dur: 0.9, mito });
  }

  function stepCell(dt: number) {
    const r = R();
    simT += dt;
    reserve = clamp(reserve + 0.12 * (r.atp / r.D - 1) * dt, 0, 1);
    lactate = clamp(lactate + (0.9 * r.Jan - 0.06 * lactate * (r.Cm / 1.25)) * dt, 0, 100);
    const last = hist.a[hist.a.length - 1];
    if (!last || simT - last.x >= 0.5) {
      hist.a.push({ x: simT, y: Math.min(150, (r.atp / r.D) * 100) });
      hist.l.push({ x: simT, y: lactate });
      while (hist.a.length && hist.a[0].x < simT - 60) (hist.a.shift(), hist.l.shift());
    }
    // spawn molecules in proportion to the rates
    if (parts.length < 160) {
      accG += r.Jg * 3.2 * dt;
      accO += r.Ja * 3.2 * dt;
    }
    while (accG >= 1) {
      accG -= 1;
      const a = rand(0, Math.PI * 2);
      const [x, y] = edge(a, 1.08);
      const [tx, ty] = insideCell(0.7);
      parts.push({ kind: 'glucose', x, y, tx, ty, t: 0, dur: 1.4 });
    }
    while (accO >= 1) {
      accO -= 1;
      const a = rand(0, Math.PI * 2);
      const [x, y] = edge(a, 1.1);
      const m = MITOS[Math.floor(rand(0, MITOS.length))];
      parts.push({ kind: 'o2', x, y, tx: m[0], ty: m[1], t: 0, dur: 1.8 });
    }
    const pAer = r.Jg > 0 ? r.Ja / r.Jg : 1;
    const born: Particle[] = [];
    for (const p of parts) {
      p.t += dt / p.dur;
      if (p.t < 1) continue;
      if (p.kind === 'glucose') {
        spark(p.tx, p.ty, false);
        spark(p.tx + 8, p.ty, false);
        for (const s of [-1, 1]) {
          const aer = Math.random() < pAer;
          const m = nearestMito(p.tx + s * 20, p.ty);
          born.push({ kind: 'pyruvate', x: p.tx + s * 6, y: p.ty, tx: aer ? m[0] : p.tx + s * 30, ty: aer ? m[1] : p.ty + rand(-20, 20), t: 0, dur: aer ? 1.6 : 0.7, aerobic: aer });
        }
      } else if (p.kind === 'pyruvate') {
        if (p.aerobic) {
          for (let i = 0; i < 3; i++) spark(p.tx + (i - 1) * 12, p.ty - 6, true);
          const [ex, ey] = edge(Math.atan2(p.ty - CELL.cy, p.tx - CELL.cx), 1.15);
          born.push({ kind: 'co2', x: p.tx, y: p.ty, tx: ex, ty: ey, t: 0, dur: 2 });
        } else {
          const [ex, ey] = edge(Math.atan2(p.ty - CELL.cy, p.tx - CELL.cx) + rand(-0.3, 0.3), 1.12);
          born.push({ kind: 'lactate', x: p.tx, y: p.ty, tx: ex, ty: ey, t: 0, dur: 3.5 });
        }
      }
    }
    parts = parts.filter((p) => p.t < 1).concat(born);
  }

  function step(dt: number) {
    anim += dt;
    if (st.view === 'cell') stepCell(dt);
    else stepT += dt;
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => {
    const tall = portrait();
    if (st.view === 'cell') return tall ? [0, 20, 660, 980] : [0, 20, 1000, 600];
    if (st.view === 'steps') return tall ? [0, 0, 700, 930] : [0, 0, 1000, 600];
    return tall ? [0, 0, 520, 750] : [0, 0, 1000, 625];
  };
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  /** Where the side panel of the cell view sits. */
  const panelAt = () => (portrait() ? { x: 20, y: 580, w: 620 } : { x: 670, y: 110, w: 320 });

  function tag(text: string, x: number, y: number, fs: Fs, k: number) {
    ctx.font = fs(11, 700);
    const tw = ctx.measureText(text).width;
    const ph = 20 / k;
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
    ctx.textBaseline = 'alphabetic';
  }
  function wrap(text: string, x: number, y: number, maxW: number, lh: number) {
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        y += lh;
        line = word;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lh;
  }
  function pill(text: string, x: number, y: number, colour: string, fs: Fs, k: number, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.font = fs(9, 800);
    const tw = ctx.measureText(text).width + 8 / k;
    const h = 14 / k;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, y - h / 2, tw, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }
  function hexagon(x: number, y: number, r: number, colour: string) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.lineTo(x + Math.cos((i * Math.PI) / 3) * r, y + Math.sin((i * Math.PI) / 3) * r);
    ctx.closePath();
    ctx.fill();
  }
  function mitochondrion(x: number, y: number, rx: number, ry: number, rot: number, activity: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = activity > 0.05 ? MITO : '#8c6d63';
    ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, activity + 0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f6c7a6';
    ctx.lineWidth = Math.max(1.5, ry * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.86, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    // cristae
    ctx.beginPath();
    const n = Math.max(3, Math.round(rx / 14));
    for (let i = 0; i < n; i++) {
      const cx = -rx * 0.7 + (i / (n - 1)) * rx * 1.4;
      const up = i % 2 ? 1 : -1;
      ctx.moveTo(cx, up * ry * 0.7);
      ctx.lineTo(cx, up * ry * 0.7 - up * ry * 0.95);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- Cell view ---------- */
  function drawCell(fs: Fs, k: number) {
    const r = R();
    const activity = r.Ja / Math.max(r.Cm, 0.01);
    // cytoplasm and membrane
    ctx.fillStyle = 'rgba(120, 170, 220, 0.13)';
    ctx.strokeStyle = MEMBRANE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(CELL.cx, CELL.cy, CELL.rx, CELL.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // lactate haze
    const nL = Math.round(lactate * 0.7);
    ctx.fillStyle = LACTATE;
    for (let i = 0; i < nL; i++) {
      const x = CELL.cx + (((0.5 + i * 0.7548777) % 1) - 0.5) * CELL.rx * 1.5;
      const y = CELL.cy + (((0.5 + i * 0.5698403) % 1) - 0.5) * CELL.ry * 1.5;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(x + Math.sin(anim + i) * 2, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // nucleus
    ctx.fillStyle = 'rgba(123, 108, 217, 0.35)';
    ctx.strokeStyle = '#7b6cd9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(NUC.x, NUC.y, NUC.rx, NUC.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const [x, y, rot] of MITOS) mitochondrion(x, y, 50, 24, rot, st.oxygen > 0 ? activity : 0);
    // molecules
    for (const p of parts) {
      const t = clamp(p.t, 0, 1);
      const e = p.kind === 'spark' ? t : t * t * (3 - 2 * t);
      const x = p.x + (p.tx - p.x) * e;
      const y = p.y + (p.ty - p.y) * e;
      if (p.kind === 'glucose') hexagon(x, y, 8, GLUCOSE);
      else if (p.kind === 'pyruvate') {
        ctx.fillStyle = PYRUVATE;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 6, y + 5);
        ctx.lineTo(x - 6, y + 5);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'lactate') {
        ctx.fillStyle = LACTATE;
        ctx.globalAlpha = 1 - t * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'o2') {
        ctx.fillStyle = OXYGEN;
        for (const dx of [-3.5, 3.5]) {
          ctx.beginPath();
          ctx.arc(x + dx, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.kind === 'co2') {
        ctx.globalAlpha = 1 - t * 0.5;
        ctx.fillStyle = CO2;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.arc(x - 7, y, 3, 0, Math.PI * 2);
        ctx.arc(x + 7, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else pill('ATP', x, y, p.mito ? ATP_MITO : ATP_GLY, fs, k, 1 - t);
    }
    tag('Cytoplasm (glycolysis)', 175, 268, fs, k);
    tag('Nucleus', NUC.x, NUC.y, fs, k);
    tag('Mitochondria', 520, 440, fs, k);
    tag('Cell membrane', CELL.cx, CELL.cy - CELL.ry - 4, fs, k);
    if (st.oxygen === 0) tag('No oxygen: mitochondria idle', 495, 215, fs, k);

    // side panel
    const P = panelAt();
    ctx.save();
    ctx.translate(P.x, P.y);
    const tall = portrait();
    mitochondrion(150, 95, 135, 70, 0, st.oxygen > 0 ? activity : 0);
    tag('Outer membrane', 150, 12, fs, k);
    tag('Inner membrane (cristae)', 150, 182, fs, k);
    tag('Matrix', 150, 95, fs, k);
    const bx = tall ? 330 : 15;
    let by = tall ? 20 : 230;
    const bw = tall ? 270 : 290;
    ctx.textAlign = 'left';
    const bar = (label: string, parts2: [number, string][], marker?: number) => {
      ctx.font = fs(11, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(label, bx, by);
      by += 8 / k;
      const h = 14 / k;
      ctx.fillStyle = pal.border;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, h, h / 2);
      ctx.fill();
      let x = bx;
      for (const [f, c] of parts2) {
        const w = bw * clamp(f, 0, 1 - (x - bx) / bw);
        ctx.fillStyle = c;
        ctx.fillRect(x, by, w, h);
        x += w;
      }
      if (marker !== undefined) {
        ctx.strokeStyle = pal['sim-text'];
        ctx.lineWidth = 2 / k;
        ctx.beginPath();
        ctx.moveTo(bx + bw * marker, by - 4 / k);
        ctx.lineTo(bx + bw * marker, by + h + 4 / k);
        ctx.stroke();
      }
      by += h + 26 / k;
    };
    const scale = 1.5 * r.D;
    bar(tall ? 'ATP made vs needed' : 'ATP made (line = what the cell needs)', [[(2 * r.Jg) / scale, ATP_GLY], [(30 * r.Ja) / scale, ATP_MITO]], r.D / scale);
    bar('ATP reserve', [[reserve, reserve > 0.3 ? pal.success : pal.danger]]);
    bar('Lactate build-up', [[lactate / 100, LACTATE]]);
    ctx.font = fs(10, 700);
    ctx.fillStyle = ATP_GLY;
    ctx.fillText(tall ? '■ ATP from glycolysis' : '■ ATP from glycolysis (cytoplasm)', bx, by - 8 / k);
    ctx.fillStyle = ATP_MITO;
    ctx.fillText('■ ATP from mitochondria', bx, by + 8 / k);
    ctx.restore();
  }

  /* ---------- Steps view ---------- */
  function carbonChain(x: number, y: number, n: number, colour = '#8d99ae', r = 9) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x + (i - (n - 1) / 2) * r * 2.2, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - ((n - 1) / 2) * r * 2.2, y);
    ctx.lineTo(x + ((n - 1) / 2) * r * 2.2, y);
    ctx.stroke();
  }
  const stalled = () => st.oxygen === 0 && st.step >= 2;

  function drawStepDiagram(fs: Fs, k: number) {
    const s = st.step;
    const o = st.oxygen / 100;
    const speed = s === 4 ? (1.25 * o) / (o + 0.25) : stalled() ? 0 : 1;
    const ph = ((stepT * speed) / 4) % 1;
    ctx.textAlign = 'center';
    if (s === 0) {
      ctx.fillStyle = 'rgba(120, 170, 220, 0.13)';
      ctx.strokeStyle = MEMBRANE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(20, 60, 660, 500, 30);
      ctx.fill();
      ctx.stroke();
      mitochondrion(470, 330, 190, 120, 0, 1);
      const stages: [string, number, number][] = [
        ['1 Glycolysis', 140, 330],
        ['2 Link reaction', 380, 300],
        ['3 Krebs cycle', 520, 280],
        ['4 Electron transport', 470, 430],
      ];
      const hi = Math.floor((stepT / 1.5) % 4);
      stages.forEach(([t, x, y], i) => {
        if (sim.running && i === hi) {
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 3 / k;
          ctx.beginPath();
          ctx.arc(x, y, 30, 0, Math.PI * 2);
          ctx.stroke();
        }
        tag(t, x, y, fs, k);
      });
      hexagon(140, 150, 16, GLUCOSE);
      tag('Glucose in', 140, 112, fs, k);
      arrow(ctx, 140, 172, 140, 305, pal['text-faint'], 2.5 / k, 10 / k);
      arrow(ctx, 165, 340, 300, 310, pal['text-faint'], 2.5 / k, 10 / k);
      tag('2 pyruvate', 230, 360, fs, k);
      arrow(ctx, 430, 300, 470, 290, pal['text-faint'], 2.5 / k, 10 / k);
      arrow(ctx, 520, 305, 490, 405, pal['text-faint'], 2.5 / k, 10 / k);
      tag('NADH, FADH₂', 560, 360, fs, k);
      tag('O₂ in', 660, 470, fs, k);
      tag('CO₂ out', 600, 180, fs, k);
      tag('H₂O + lots of ATP', 400, 500, fs, k);
      pill('ATP', 200, 300, ATP_GLY, fs, k);
      tag('Cytoplasm', 140, 520, fs, k);
      tag('Mitochondrion', 470, 190, fs, k);
    } else if (s === 1) {
      // glycolysis: 6C → two 3C → 2 pyruvate, with ATP spent and made
      const split = clamp((ph - 0.25) / 0.25, 0, 1);
      const out = clamp((ph - 0.5) / 0.35, 0, 1);
      ctx.fillStyle = 'rgba(120, 170, 220, 0.1)';
      ctx.beginPath();
      ctx.roundRect(20, 40, 660, 540, 24);
      ctx.fill();
      tag('Cytoplasm', 90, 70, fs, k);
      if (split === 0) {
        carbonChain(350, 200, 6);
        tag('Glucose (6 carbons)', 350, 160, fs, k);
      } else {
        carbonChain(350 - 70 - 60 * split, 200 + 60 * split, 3);
        carbonChain(350 + 70 + 60 * split, 200 + 60 * split, 3);
      }
      // investment: 2 ATP in
      const inv = clamp(ph / 0.25, 0, 1);
      for (const s2 of [-1, 1]) {
        if (inv < 1) pill('ATP', 350 + s2 * 200 - s2 * 120 * inv, 110 + 70 * inv, ATP_GLY, fs, k, 1 - inv * 0.3);
        else pill('ADP', 350 + s2 * 80, 180, '#c9c2b5', fs, k, Math.max(0, 1 - split));
      }
      tag('Invest 2 ATP', 350, 100, fs, k);
      if (split > 0.99) {
        // payoff
        for (const s2 of [-1, 1]) {
          const cx = 350 + s2 * 190;
          for (let i = 0; i < 2; i++) pill('ATP', cx - 30 + i * 60, 300 + 90 * out, ATP_GLY, fs, k, out);
          pill('NADH', cx, 300 + 150 * out, NADH, fs, k, out);
          if (out > 0.9) {
            ctx.fillStyle = PYRUVATE;
            ctx.beginPath();
            ctx.moveTo(cx, 485);
            ctx.lineTo(cx + 20, 520);
            ctx.lineTo(cx - 20, 520);
            ctx.closePath();
            ctx.fill();
            tag('Pyruvate (3 C)', cx, 550, fs, k);
          }
        }
        tag('Make 4 ATP + 2 NADH', 350, 300, fs, k);
      }
    } else if (s === 2) {
      // link reaction across the mitochondrial membranes
      ctx.fillStyle = 'rgba(120, 170, 220, 0.1)';
      ctx.fillRect(20, 40, 250, 540);
      ctx.fillStyle = 'rgba(217, 105, 74, 0.18)';
      ctx.fillRect(290, 40, 390, 540);
      ctx.strokeStyle = MITO;
      ctx.lineWidth = 6;
      for (const x of [272, 290]) {
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, 580);
        ctx.stroke();
      }
      tag('Cytoplasm', 140, 70, fs, k);
      tag('Mitochondrial matrix', 480, 70, fs, k);
      const x = 120 + 330 * clamp(ph / 0.45, 0, 1);
      const lost = clamp((ph - 0.45) / 0.3, 0, 1);
      carbonChain(x, 280, lost > 0 ? 2 : 3);
      if (lost > 0) {
        ctx.fillStyle = CO2;
        ctx.beginPath();
        ctx.arc(x + 40 + 80 * lost, 280 - 150 * lost, 10, 0, Math.PI * 2);
        ctx.fill();
        tag('CO₂', x + 40 + 80 * lost, 250 - 150 * lost, fs, k);
        pill('NAD⁺ → NADH', x + 10, 360 + 60 * lost, NADH, fs, k, lost);
      }
      if (ph > 0.75) {
        ctx.fillStyle = '#4c8dd6';
        ctx.beginPath();
        ctx.roundRect(x + 30, 266, 46, 28, 8);
        ctx.fill();
        tag('Acetyl-CoA (2 C)', x + 10, 220, fs, k);
        tag('CoA', x + 53, 280, fs, k);
      } else tag(lost > 0 ? 'Acetyl group' : 'Pyruvate (3 C)', x, 240, fs, k);
      tag('Happens twice per glucose', 350, 540, fs, k);
    } else if (s === 3) {
      // Krebs cycle
      const cx = 350;
      const cy = 320;
      const rr = 170;
      ctx.fillStyle = 'rgba(217, 105, 74, 0.15)';
      ctx.beginPath();
      ctx.roundRect(20, 40, 660, 540, 24);
      ctx.fill();
      tag('Mitochondrial matrix', 120, 70, fs, k);
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 3 / k;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
      const nodes: [string, number][] = [
        ['Oxaloacetate (4 C)', -150],
        ['Citrate (6 C)', -30],
        ['5 C', 40],
        ['4 C', 140],
      ];
      const P = (deg: number, rad = rr) => [cx + Math.cos((deg * Math.PI) / 180) * rad, cy + Math.sin((deg * Math.PI) / 180) * rad];
      for (const [label, d] of nodes) {
        const [x, y] = P(d);
        ctx.fillStyle = pal['bg-elev'];
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        const [lx, ly] = P(d, rr + 48);
        tag(label, lx, ly, fs, k);
      }
      // acetyl-CoA joins at the top
      const [tx, ty] = P(-90);
      arrow(ctx, tx, ty - 110, tx, ty - 14, '#4c8dd6', 3 / k, 10 / k);
      tag('Acetyl-CoA (2 C) in', tx, ty - 125, fs, k);
      // products released between nodes
      const events: [number, string, string][] = [
        [5, 'CO₂', CO2],
        [15, 'NADH', NADH],
        [75, 'CO₂', CO2],
        [90, 'NADH', NADH],
        [105, 'ATP', ATP_MITO],
        [170, 'FADH₂', FADH],
        [190, 'NADH', NADH],
      ];
      const a = -150 + 360 * ph;
      for (const [d, label, c] of events) {
        const passed = (a - d + 720) % 360;
        if (a >= d && passed < 140) {
          const f = passed / 140;
          const [x, y] = P(d, rr + 30 + 120 * f);
          pill(label, x, y, c, fs, k, 1 - f * 0.7);
        }
      }
      const [mx, my] = P(a);
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = fs(11, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'center';
      ctx.fillText('Each turn: 2 CO₂, 3 NADH, 1 FADH₂, 1 ATP', cx, cy - 6);
      ctx.fillText('Turns twice per glucose', cx, cy + 14 / k);
    } else {
      // electron transport chain
      const memTop = 280;
      const memBot = 330;
      ctx.fillStyle = 'rgba(217, 105, 74, 0.1)';
      ctx.fillRect(20, 40, 660, memTop - 40);
      ctx.fillStyle = 'rgba(217, 105, 74, 0.2)';
      ctx.fillRect(20, memBot, 660, 250);
      ctx.fillStyle = '#e9c46a';
      ctx.fillRect(20, memTop, 660, memBot - memTop);
      tag('Intermembrane space (high H⁺)', 200, 65, fs, k);
      tag('Matrix', 120, 560, fs, k);
      tag('Inner membrane', 365, memTop - 18, fs, k);
      const complexes = [130, 290, 440];
      const flow = (1.25 * o) / (o + 0.25);
      complexes.forEach((x, i) => {
        ctx.fillStyle = '#7b6cd9';
        ctx.beginPath();
        ctx.roundRect(x - 34, memTop - 30, 68, memBot - memTop + 60, 14);
        ctx.fill();
        tag(['I', 'III', 'IV'][i], x, memBot + 46, fs, k);
      });
      // ATP synthase
      const sx = 590;
      ctx.fillStyle = '#2a9d8f';
      ctx.fillRect(sx - 14, memTop - 30, 28, memBot - memTop + 50);
      ctx.save();
      ctx.translate(sx, memBot + 70);
      ctx.rotate(anim * 4 * flow);
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d8f3ee';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(30, 0);
        ctx.stroke();
      }
      ctx.restore();
      tag('ATP synthase', sx, memBot + 128, fs, k);
      // H⁺ gradient (more ions above when the chain runs)
      const nH = Math.round(8 + 22 * flow);
      ctx.font = fs(10, 800);
      ctx.fillStyle = '#e63946';
      for (let i = 0; i < nH; i++) {
        const x = 40 + ((0.5 + i * 0.7548777) % 1) * 620;
        const y = 90 + ((0.5 + i * 0.5698403) % 1) * 160;
        ctx.fillText('H⁺', x + Math.sin(anim + i) * 3, y);
      }
      // electrons along the chain, H⁺ pumped up, H⁺ through the synthase
      if (flow > 0.01) {
        for (let j = 0; j < 4; j++) {
          const f = (stepT * 0.5 * flow + j / 4) % 1;
          const x = 80 + f * 380;
          ctx.fillStyle = '#ffd60a';
          ctx.beginPath();
          ctx.arc(x, (memTop + memBot) / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        complexes.forEach((x, i) => {
          const f = (stepT * 0.8 * flow + i / 3) % 1;
          ctx.fillStyle = '#e63946';
          ctx.fillText('H⁺', x, memBot + 20 - f * 120);
        });
        const f = (stepT * 1.2 * flow) % 1;
        ctx.fillText('H⁺', sx, memTop - 40 + f * 110);
        pill('ATP', sx + 70, memBot + 70 - 30 * ((stepT * flow) % 1), ATP_MITO, fs, k);
      }
      pill('NADH', 90, memBot + 90, NADH, fs, k);
      pill('FADH₂', 260, memBot + 90, FADH, fs, k);
      // oxygen as final acceptor
      tag(o > 0 ? 'O₂ + e⁻ + H⁺ → H₂O' : 'No O₂: electrons cannot leave', 440, memBot + 110, fs, k);
      arrow(ctx, 440, memBot + 36, 440, memBot + 90, o > 0 ? OXYGEN : pal.danger, 2.5 / k, 9 / k);
    }
    if (stalled() && s < 4) tag('No oxygen: NADH cannot be recycled, so this stage stops', 350, 25, fs, k);
  }

  function drawSteps(fs: Fs, k: number) {
    const tall = portrait();
    drawStepDiagram(fs, k);
    const s = STEPS[st.step];
    const px = tall ? 20 : 720;
    let py = tall ? 640 : 100;
    const pw = tall ? 660 : 260;
    ctx.textAlign = 'left';
    ctx.font = fs(14, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(s.title, px, py);
    py += 22 / k;
    py += 6 / k;
    // tally per glucose (the stage explanation is in the HTML panel below)
    ctx.font = fs(11, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(st.step === 0 ? 'Overall (per glucose):' : 'Running total per glucose:', px, py);
    py += 20 / k;
    if (st.step === 0) {
      ctx.font = fs(11, 700);
      py = wrap('C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + about 30–32 ATP', px, py, pw, 16 / k);
    } else {
      const [atp, nadh, fadh, co2] = TALLY[st.step];
      const rows: [string, string, string][] = [
        ['ATP', st.step === 4 ? 'about 30–32' : `${atp}`, ATP_MITO],
        ['NADH', st.step === 4 ? 'all used (→ NAD⁺)' : `${nadh}`, NADH],
        ['FADH₂', st.step === 4 ? 'all used (→ FAD)' : `${fadh}`, FADH],
        ['CO₂', `${co2}`, CO2],
      ];
      for (const [label, v, c] of rows) {
        pill(label, px + 26 / k, py - 4 / k, c, fs, k);
        ctx.font = fs(11, 700);
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'left';
        ctx.fillText(v, px + 60 / k, py);
        py += 20 / k;
      }
    }
  }

  /* ---------- Compare view ---------- */
  function drawCompare(fs: Fs, k: number) {
    const tall = portrait();
    const yeast = st.ferm === 'yeast';
    const cols = [
      {
        title: tall ? 'Aerobic (with O₂)' : 'Aerobic respiration (oxygen present)',
        flow: ['Glucose', 'Glycolysis (cytoplasm): 2 ATP', '2 pyruvate', 'Link reaction, Krebs cycle, electron transport chain (mitochondria)', '6 CO₂ + 6 H₂O'],
        short: ['Glucose', 'Glycolysis: 2 ATP', '2 pyruvate', 'Mitochondria', '6 CO₂ + 6 H₂O'],
        atp: 32,
        atpText: tall ? 'About 30–32 ATP' : 'About 30–32 ATP per glucose',
        eq: 'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O',
      },
      {
        title: tall ? 'Anaerobic (no O₂)' : yeast ? 'Anaerobic: alcoholic fermentation' : 'Anaerobic: lactic acid fermentation',
        flow: yeast
          ? ['Glucose', 'Glycolysis (cytoplasm): 2 ATP', '2 pyruvate', 'NADH gives its hydrogen back: NAD⁺ is regenerated', '2 ethanol + 2 CO₂']
          : ['Glucose', 'Glycolysis (cytoplasm): 2 ATP', '2 pyruvate', 'NADH gives its hydrogen back: NAD⁺ is regenerated', '2 lactate'],
        short: ['Glucose', 'Glycolysis: 2 ATP', '2 pyruvate', 'Fermentation', yeast ? '2 ethanol + 2 CO₂' : '2 lactate'],
        atp: 2,
        atpText: tall ? 'Only 2 ATP' : 'Only 2 ATP per glucose',
        eq: yeast ? 'C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂' : 'C₆H₁₂O₆ → 2 C₃H₆O₃ (lactate)',
      },
    ];
    const prog = sim.running ? (anim % 5) / 5 : 1;
    cols.forEach((c, j) => {
      const x0 = tall ? 10 + j * 255 : 30 + j * 490;
      const y0 = tall ? 80 : 82;
      const w = tall ? 245 : 450;
      const flow = tall ? c.short : c.flow;
      ctx.fillStyle = j === 0 ? 'rgba(46, 194, 126, 0.08)' : 'rgba(155, 93, 229, 0.08)';
      ctx.beginPath();
      ctx.roundRect(x0, y0, w, tall ? 660 : 530, 18);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = fs(13, 800);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(c.title, x0 + 16, y0 + 18 / k);
      let y = y0 + 44 / k;
      ctx.font = fs(11, 650);
      flow.forEach((f, i) => {
        const on = prog >= i / flow.length;
        ctx.fillStyle = on ? pal['sim-text'] : pal['text-faint'];
        y = wrap(f, x0 + 16, y, w - 32, 15 / k);
        if (i < flow.length - 1) {
          arrow(ctx, x0 + 26, y - 10 / k, x0 + 26, y + 4 / k, on ? pal.accent : pal.border, 2 / k, 7 / k);
          y += 12 / k;
        }
      });
      y += 10 / k;
      // ATP tokens (same scale in both columns)
      const shown = Math.min(c.atp, Math.floor(prog * 34));
      const per = tall ? 4 : 8;
      const gap = Math.min(52, (w - 32) / per);
      for (let i = 0; i < 32; i++) {
        const tx = x0 + 16 + (i % per) * gap + gap / 2;
        const ty = y + Math.floor(i / per) * (18 / k);
        if (i < c.atp) pill('ATP', tx, ty, j === 0 ? ATP_MITO : ATP_GLY, fs, k, i < shown ? 1 : 0.15);
        else {
          ctx.strokeStyle = pal.border;
          ctx.lineWidth = 1 / k;
          ctx.strokeRect(tx - 12 / k, ty - 6 / k, 24 / k, 12 / k);
        }
      }
      y += (32 / per) * (18 / k) + 6 / k;
      ctx.textAlign = 'left';
      ctx.font = fs(12, 800);
      ctx.fillStyle = j === 0 ? pal.success : pal.warning;
      ctx.fillText(c.atpText, x0 + 16, y);
      if (tall) return; // the equations and examples are in the readouts and article on phones
      y += 18 / k;
      ctx.font = fs(11, 700);
      ctx.fillStyle = pal['sim-text'];
      wrap(c.eq, x0 + 16, y, w - 32, 15 / k);
    });
  }

  /* ---------- Render ---------- */
  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    if (st.view === 'cell') drawCell(fs, k);
    else if (st.view === 'steps') drawSteps(fs, k);
    else drawCompare(fs, k);
    ctx.restore();
    updateReadouts();
    drawGraph();
  }

  function updateReadouts() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    if (st.view === 'cell') {
      const m = R();
      const met = m.atp / m.D;
      const per = m.Jg > 0 ? m.atp / m.Jg : 0;
      const share = m.Jg > 0 ? m.Jan / m.Jg : 0;
      r('r1', 'Energy needs met', `${Math.round(Math.min(met, 1) * 100)}%`, met >= 0.99 ? 'ok' : met > 0.6 ? 'warn' : 'bad');
      r('r2', 'ATP per glucose (average)', m.Jg > 0 ? `about ${per.toFixed(per < 10 ? 1 : 0)}` : 'No glucose');
      r('r3', 'Pathway', m.Jg === 0 ? 'None: no glucose' : share < 0.02 ? 'Aerobic' : share > 0.98 ? 'Anaerobic only (lactate)' : `Aerobic + anaerobic (${Math.round(share * 100)}% of glucose)`);
      r('r4', 'Glucose used', `${(m.Jg / 0.35).toFixed(1)}× a resting cell with oxygen`);
      r('r5', 'Lactate', lactate < 5 ? 'Very little' : lactate < 40 ? 'Building up' : 'High', lactate > 40 ? 'warn' : null);
      sim.setBadge(st.demand === 'active' ? 'Active cell' : 'Resting cell');
      noteEl.textContent =
        m.Jg === 0
          ? 'Without glucose the cell cannot make ATP by respiration, and its reserve runs down.'
          : share > 0.98
            ? 'With no oxygen, mitochondria stop. Glycolysis speeds up and pyruvate becomes lactate, but each glucose gives only 2 ATP, so the cell cannot meet its energy needs.'
            : share > 0.02
              ? 'Oxygen is limiting. Mitochondria work at full capacity, and extra glucose goes through glycolysis alone, making lactate. The cell uses glucose much faster for the same ATP.'
              : 'Plenty of oxygen: pyruvate enters the mitochondria, which make most of the ATP (green). Glycolysis in the cytoplasm adds a little (orange). Carbon dioxide leaves the cell.';
    } else if (st.view === 'steps') {
      const s = STEPS[st.step];
      r('r1', 'Stage', `${st.step} of 4: ${s.title.replace(/^\d · /, '')}`);
      r('r2', 'Where', s.where);
      r('r3', 'Inputs', s.inputs);
      r('r4', 'Outputs', s.outputs);
      r('r5', 'Needs oxygen?', st.step === 1 ? 'No' : st.step === 0 ? 'Overall, yes' : st.step === 4 ? 'Yes, as the final electron acceptor' : 'Indirectly: stops if NADH is not recycled', st.oxygen === 0 && st.step >= 2 ? 'bad' : null);
      sim.setBadge(`Stage ${st.step} of 4`);
      noteEl.textContent = st.oxygen === 0 && st.step >= 2 ? 'Oxygen is set to 0%. The electron transport chain stops, NADH cannot be turned back into NAD⁺, and the link reaction and Krebs cycle stop too. Only glycolysis can continue.' : 'Use Previous and Next to move through the stages. Press Start to animate each stage, and change the oxygen slider to see what depends on it.';
      stepLabel.textContent = `Stage ${st.step} of 4: ${s.title.replace(/^\d · /, '')}`;
      stepText.textContent = s.text;
    } else {
      const yeast = st.ferm === 'yeast';
      const anaerobicWhere = yeast ? 'Yeast in bread and brewing; plant roots in waterlogged soil' : 'Muscle cells in hard exercise, red blood cells, some bacteria (yoghurt)';
      r('r1', 'Aerobic', 'About 30–32 ATP per glucose, in most cells');
      r('r2', yeast ? 'Alcoholic fermentation' : 'Lactic acid fermentation', '2 ATP per glucose');
      r('r3', 'Difference', 'Aerobic gives about 15× more ATP');
      r('r4', `Where ${yeast ? 'alcoholic' : 'lactic acid'} fermentation happens`, anaerobicWhere);
      r('r5', 'NAD⁺ is regenerated by', `Oxygen (aerobic) or making ${yeast ? 'ethanol' : 'lactate'}`);
      sim.setBadge('Aerobic vs anaerobic');
      noteEl.textContent = `Without oxygen, the electron transport chain stops, so NADH builds up and NAD⁺ runs out. Fermentation passes the hydrogen from NADH to pyruvate (making ${yeast ? 'ethanol and CO₂' : 'lactate'}), regenerating NAD⁺ so that glycolysis can keep making its 2 ATP.`;
    }
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="cr-graph"]')!, { x: { min: 0, span: 60 }, y: { min: 0, max: 150, step: 25 } });
  function drawGraph() {
    graphPanel.hidden = st.view !== 'cell';
    if (st.view !== 'cell') return;
    graph.opts.x = { min: Math.max(0, simT - 60), span: 60, max: Math.max(60, simT), step: 10, format: (x) => `${Math.round(x)} s` };
    graph.opts.y = { min: 0, max: 150, step: 25, format: (v) => `${v}` };
    graph.opts.refs = [{ value: 100, label: 'Needs met', color: 'text-faint' }];
    graph.set('a', { label: 'ATP made (% of need)', color: ATP_MITO, points: hist.a, width: 3 });
    graph.set('l', { label: 'Lactate (relative)', color: LACTATE, points: hist.l, width: 2, dash: [5, 4] });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="cr-graph"]'));
  }

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    if (st.view !== 'cell') return;
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    let id: string | null = null;
    const P = panelAt();
    const ix = (x - P.x - 150) / 135;
    const iy = (y - P.y - 95) / 70;
    const ir = Math.hypot(ix, iy);
    if (ir <= 1.05) id = ir > 0.93 ? 'outer' : ir > 0.86 ? 'space' : Math.abs(Math.abs(iy) - 0.7) < 0.12 || ir > 0.78 ? 'inner' : 'matrix';
    else if (MITOS.some(([mx, my, rot]) => {
      const dx = x - mx;
      const dy = y - my;
      const u = dx * Math.cos(-rot) - dy * Math.sin(-rot);
      const v = dx * Math.sin(-rot) + dy * Math.cos(-rot);
      return Math.hypot(u / 54, v / 28) < 1;
    })) id = 'mito';
    else if (Math.hypot((x - NUC.x) / NUC.rx, (y - NUC.y) / NUC.ry) < 1) id = 'nucleus';
    else {
      const c = Math.hypot((x - CELL.cx) / CELL.rx, (y - CELL.cy) / CELL.ry);
      if (Math.abs(c - 1) < 0.04) id = 'membrane';
      else if (c < 1) id = 'cytoplasm';
    }
    if (!id) return sim.hideTooltip();
    sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, INFO[id][0], INFO[id][1]);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const showFor = (v: View) => {
    ui.showWhen('[data-only="cell"]', v === 'cell');
    ui.showWhen('[data-only="steps"]', v === 'steps');
    ui.showWhen('[data-only="compare"]', v === 'compare');
    ui.showWhen('[data-only="o2"]', v !== 'compare');
  };
  const viewCtl = ui.choice<View>('cr-view', (v) => {
    st.view = v;
    showFor(v);
    sim.hideTooltip();
    // Update the HTML parts now, even if the stage is scrolled out of view
    graphPanel.hidden = v !== 'cell';
    updateReadouts();
    sim.requestRender();
  });
  const o2Ctl = ui.range('cr-o2', (v) => `${v}%`, (v) => ((st.oxygen = v), sim.requestRender()));
  const gluCtl = ui.range('cr-glucose', (v) => `${v}%`, (v) => ((st.glucose = v), sim.requestRender()));
  const demandCtl = ui.choice<'rest' | 'active'>('cr-demand', (v) => ((st.demand = v), sim.requestRender()));
  const fermCtl = ui.choice<'animal' | 'yeast'>('cr-ferm', (v) => ((st.ferm = v), sim.requestRender()));
  const setStep = (n: number) => {
    st.step = clamp(n, 0, 4);
    stepT = 0;
    updateReadouts();
    sim.requestRender();
  };
  root.querySelector('[data-prev]')!.addEventListener('click', () => setStep(st.step - 1));
  root.querySelector('[data-next]')!.addEventListener('click', () => setStep(st.step + 1));
  const presets: Record<string, [number, number, 'rest' | 'active']> = {
    rest: [100, 100, 'rest'],
    sprint: [100, 15, 'active'],
    none: [100, 0, 'rest'],
    fasting: [6, 100, 'active'],
  };
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const [g, o, d] = presets[b.dataset.preset!];
      st.glucose = g;
      st.oxygen = o;
      st.demand = d;
      gluCtl.set(g, false);
      o2Ctl.set(o, false);
      demandCtl.set(d, false);
      if (!sim.running) sim.play();
      sim.requestRender();
    }),
  );
  showFor('cell');

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set('cell', false);
      o2Ctl.set(DEF.oxygen, false);
      gluCtl.set(DEF.glucose, false);
      demandCtl.set(DEF.demand, false);
      fermCtl.set(DEF.ferm, false);
      showFor('cell');
      anim = stepT = simT = 0;
      reserve = 1;
      lactate = 0;
      parts = [];
      accG = accO = 0;
      hist = { a: [], l: [] };
    },
  });
}
