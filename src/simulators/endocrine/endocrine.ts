/**
 * Endocrine system: three views.
 *
 * glands  – major glands on a body outline. Choosing a gland releases its
 *           hormone into the blood, which travels to its target organs; the
 *           hormone level slider shows simplified effects.
 * thyroid – the hypothalamic–pituitary–thyroid axis with negative feedback.
 *           Levels are relative (1 = normal), time in days:
 *             TRH' = 4·f − 2·TRH,  TSH' = 2·TRH·f·pituitary − TSH,
 *             T4'  = 0.15·(TSH·capacity + autonomous + tablets − T4),
 *             f = 1 / (1 + T4²)  (thyroid hormone switches off TRH and TSH)
 * glucose – blood glucose (mmol/L) with insulin and glucagon, time in minutes:
 *             glucose' = meal + liver output − uptake
 *             liver output falls with insulin, rises with glucagon
 *             uptake rises with insulin (× sensitivity) and exercise
 *             insulin follows glucose above 4 mmol/L; glucagon rises below ~5
 *           Type 1 diabetes: almost no insulin. Type 2: insulin resistance.
 * All are simplified teaching models, not clinical tools.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'glands' | 'thyroid' | 'glucose';
type P = [number, number];

interface Gland {
  name: string;
  pos: P[];
  colour: string;
  hormones: string;
  about: string;
  targets: string[];
  hormone: string;
}
const GLANDS: Record<string, Gland> = {
  hypothalamus: { name: 'Hypothalamus', pos: [[500, 72]], colour: '#e0605a', hormone: 'releasing hormones', hormones: 'Releasing hormones (TRH, CRH, GnRH) that control the pituitary; makes ADH and oxytocin', about: 'Part of the brain that links the nervous and endocrine systems. It monitors the body and tells the pituitary what to do.', targets: ['pituitary'] },
  pituitary: { name: 'Pituitary gland', pos: [[500, 96]], colour: '#8e6bd8', hormone: 'growth hormone', hormones: 'Growth hormone, TSH, ACTH, FSH, LH, prolactin; releases ADH and oxytocin', about: 'The pea-sized “master gland” under the brain. Its hormones control many other glands.', targets: ['thyroid', 'adrenal', 'gonads', 'kidney', 'bones'] },
  pineal: { name: 'Pineal gland', pos: [[526, 62]], colour: '#5d6fd6', hormone: 'melatonin', hormones: 'Melatonin', about: 'Releases melatonin in darkness, helping to set the sleep–wake cycle.', targets: ['brain'] },
  thyroid: { name: 'Thyroid gland', pos: [[500, 168]], colour: '#e0a43a', hormone: 'thyroxine', hormones: 'Thyroxine (T4) and T3, calcitonin', about: 'A butterfly-shaped gland in the neck. Its hormones set the metabolic rate of almost every cell; they need iodine.', targets: ['heart', 'liver', 'muscle'] },
  adrenal: { name: 'Adrenal glands', pos: [[455, 292], [545, 292]], colour: '#e07a3a', hormone: 'adrenaline', hormones: 'Adrenaline (fight or flight), cortisol (stress, blood glucose), aldosterone (salt balance)', about: 'Sit on top of the kidneys. Adrenaline prepares the body for action within seconds.', targets: ['heart', 'lungs', 'liver', 'muscle'] },
  pancreas: { name: 'Pancreas', pos: [[530, 335]], colour: '#3fb68b', hormone: 'insulin', hormones: 'Insulin and glucagon (from the islets of Langerhans)', about: 'Mostly a digestive gland, but small clusters of cells (islets) release the hormones that control blood glucose.', targets: ['liver', 'muscle', 'fat'] },
  gonads: { name: 'Ovaries or testes', pos: [[470, 440], [530, 440]], colour: '#d6578a', hormone: 'sex hormones', hormones: 'Oestrogen and progesterone (ovaries); testosterone (testes)', about: 'Reproductive glands that also make sex hormones, which drive puberty and control reproduction.', targets: ['bones', 'muscle'] },
};
const TARGETS: Record<string, P> = {
  pituitary: [500, 96], thyroid: [500, 168], adrenal: [455, 292], gonads: [500, 440], kidney: [560, 310], bones: [540, 520],
  heart: [478, 228], lungs: [570, 215], liver: [440, 305], muscle: [455, 510], fat: [575, 390], brain: [470, 58],
};
const TARGET_NAME: Record<string, string> = { pituitary: 'pituitary', thyroid: 'thyroid', adrenal: 'adrenal glands', gonads: 'ovaries/testes', kidney: 'kidneys', bones: 'bones', heart: 'heart', lungs: 'lungs', liver: 'liver', muscle: 'muscles', fat: 'fat tissue', brain: 'brain' };

function effect(id: string, lv: number): [string, string, 'ok' | 'warn' | 'bad' | null] {
  const tone = lv < 0.6 || lv > 1.5 ? 'warn' : 'ok';
  switch (id) {
    case 'thyroid':
      return [`Metabolic rate about ${Math.round(60 + 40 * lv)} % · resting heart rate about ${Math.round(55 + 15 * lv)} bpm`, lv < 0.6 ? 'Too little: tiredness, feeling cold, weight gain, slow heart (like an underactive thyroid).' : lv > 1.5 ? 'Too much: fast heart, weight loss, feeling hot and anxious (like an overactive thyroid).' : 'Normal metabolism.', tone];
    case 'adrenal':
      return [`Heart rate about ${Math.round(70 * (1 + 0.55 * (lv - 1)))} bpm · breathing faster · liver releases glucose`, lv > 1.5 ? 'Fight or flight: heart races, airways widen, blood diverted to muscles, glucose released for energy.' : lv < 0.6 ? 'Calm, resting state.' : 'Normal alertness.', lv > 1.5 ? 'warn' : 'ok'];
    case 'pancreas':
      return [`Blood glucose about ${(5 / Math.max(lv, 0.15) ** 0.7).toFixed(1)} mmol/L`, lv < 0.6 ? 'Too little insulin: glucose stays in the blood (high blood sugar), as in diabetes.' : lv > 1.5 ? 'Too much insulin: glucose falls too low (hypoglycaemia): shakiness, confusion.' : 'Glucose kept in its normal range of about 4–7 mmol/L.', tone];
    case 'pituitary':
      return [`Growth rate in childhood about ${Math.round(100 * lv)} % of normal`, lv < 0.6 ? 'Too little growth hormone in childhood slows growth.' : lv > 1.5 ? 'Too much growth hormone in childhood causes unusually tall growth.' : 'Normal growth; it also controls other glands.', tone];
    case 'hypothalamus':
      return [`Pituitary output about ${Math.round(100 * lv)} % of normal`, lv < 0.6 ? 'Less releasing hormone means the pituitary, and the glands it controls, all slow down.' : lv > 1.5 ? 'More releasing hormone drives the pituitary and its target glands harder.' : 'Normal control of the pituitary.', tone];
    case 'pineal':
      return [`Melatonin ${Math.round(100 * lv)} %`, lv > 1.3 ? 'High melatonin (as at night): sleepiness.' : lv < 0.6 ? 'Low melatonin (as in daylight): alert.' : 'Normal sleep–wake rhythm.', 'ok'];
    default:
      return [`Sex hormones ${Math.round(100 * lv)} %`, lv < 0.6 ? 'Low levels delay puberty and can weaken bones.' : lv > 1.5 ? 'High levels speed up puberty-type changes.' : 'Normal development and reproduction.', tone];
  }
}

export function initEndocrine(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const graphPanel = root.querySelector<HTMLElement>('[data-graph-panel]')!;

  const st = { view: 'glands' as View, gland: 'thyroid', level: 1, scenario: 'normal', tablets: 0, diabetes: 'none' as 'none' | 't1' | 't2' };
  let t = 0;
  let particles: { x: number; y: number; tx: number; ty: number; f: number; c: string }[] = [];
  // thyroid axis
  let ax = { TRH: 1, TSH: 1, T4: 1, goitre: 1, day: 0 };
  let axHist: { TRH: Point[]; TSH: Point[]; T4: Point[] } = { TRH: [], TSH: [], T4: [] };
  // glucose
  let gl = { G: 4.9, I: 0.32, Gn: 0.1, J: 0, min: 0, meal: -1e9, exercise: -1e9, glycogen: 0 };
  let glHist: Point[] = [];

  function resetAxis() {
    ax = { TRH: 1, TSH: 1, T4: 1, goitre: 1, day: 0 };
    axHist = { TRH: [{ x: 0, y: 100 }], TSH: [{ x: 0, y: 100 }], T4: [{ x: 0, y: 100 }] };
  }
  function resetGlucose() {
    gl = { G: 4.9, I: 0.32, Gn: 0.1, J: 0, min: 0, meal: -1e9, exercise: -1e9, glycogen: 0 };
    if (st.diabetes === 't1') ((gl.G = 8.2), (gl.I = 0.05));
    if (st.diabetes === 't2') gl.G = 5.5;
    glHist = [{ x: 0, y: gl.G }];
  }
  resetAxis();
  resetGlucose();

  /* ---------- Models ---------- */
  function stepAxis(days: number) {
    const cap = st.scenario === 'iodine' ? 0.3 : 1;
    const auto = st.scenario === 'graves' ? 2 : 0;
    const pit = st.scenario === 'pituitary' ? 0.25 : 1;
    const n = Math.ceil(days / 0.05);
    const h = days / n;
    for (let i = 0; i < n; i++) {
      const f = 1 / (1 + ax.T4 ** 2);
      ax.TRH += (4 * f - 2 * ax.TRH) * h;
      ax.TSH += (2 * ax.TRH * f * pit - ax.TSH) * h;
      ax.T4 += 0.15 * (ax.TSH * cap + auto + st.tablets - ax.T4) * h;
      ax.goitre += ((ax.TSH - ax.goitre) / 40) * h;
      ax.day += h;
    }
    if (ax.day - axHist.T4[axHist.T4.length - 1].x >= 1) {
      for (const key of ['TRH', 'TSH', 'T4'] as const) {
        axHist[key].push({ x: ax.day, y: ax[key] * 100 });
        if (axHist[key].length > 400) axHist[key].shift();
      }
    }
  }
  function stepGlucose(mins: number) {
    const prod = st.diabetes === 't1' ? 0.03 : st.diabetes === 't2' ? 1.2 : 1;
    const sens = st.diabetes === 't2' ? 0.3 : 1;
    const n = Math.ceil(mins / 0.5);
    const h = mins / n;
    for (let i = 0; i < n; i++) {
      const tm = gl.min - gl.meal;
      const meal = tm >= 0 ? 12 * (tm / 900) * Math.exp(-tm / 30) : 0;
      const ins = gl.I + gl.J;
      const liver = 0.03 * (1 + 1.5 * gl.Gn) * (1 - (0.8 * Math.min(ins * sens, 1.2)) / 1.2);
      const exercise = gl.min - gl.exercise >= 0 && gl.min - gl.exercise < 60 ? (0.012 * gl.G) / 5 : 0;
      const uptake = 0.003 * gl.G + (0.05 * ins * sens * gl.G) / 5 + exercise;
      gl.G = Math.max(1.5, gl.G + (meal + liver - uptake) * h);
      gl.I += ((prod * Math.max(0, gl.G - 4) * 0.35 - gl.I) / 20) * h;
      gl.J -= (gl.J / 120) * h;
      gl.Gn += ((Math.max(0, 5.2 - gl.G) * 0.8 - gl.Gn) / 15) * h;
      gl.glycogen = liver - 0.03; // positive: liver releasing glucose; negative: storing it
      gl.min += h;
    }
    if (gl.min - glHist[glHist.length - 1].x >= 5) {
      glHist.push({ x: gl.min, y: gl.G });
      if (glHist.length > 400) glHist.shift();
    }
  }

  function step(dt: number) {
    t += dt;
    if (st.view === 'thyroid') stepAxis(dt * 3);
    else if (st.view === 'glucose') stepGlucose(dt * 10);
    else {
      // hormone particles from the chosen gland to its targets
      const g = GLANDS[st.gland];
      if (Math.random() < dt * 8 * st.level) {
        const from = g.pos[Math.floor(Math.random() * g.pos.length)];
        const to = TARGETS[g.targets[Math.floor(Math.random() * g.targets.length)]];
        particles.push({ x: from[0], y: from[1], tx: to[0], ty: to[1], f: 0, c: g.colour });
      }
      for (const p of particles) p.f += dt * 0.6;
      particles = particles.filter((p) => p.f < 1);
    }
  }

  /* ---------- Drawing (design box 1000 × 560) ---------- */
  const tf = () => {
    const k = Math.min(size.w / 1000, size.h / 560);
    return { k, ox: (size.w - 1000 * k) / 2, oy: (size.h - 560 * k) / 2 };
  };
  function body() {
    ctx.fillStyle = 'rgba(230, 185, 150, 0.16)';
    ctx.strokeStyle = 'rgba(200, 145, 110, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(500, 80, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(470, 130, 60, 50, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(390, 175, 220, 300, [60, 60, 30, 30]);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(410, 470, 75, 85, 20);
    ctx.roundRect(515, 470, 75, 85, 20);
    ctx.fill();
    ctx.stroke();
  }
  function tag(text: string, x: number, y: number, fs: (n: number, w?: number) => string, k: number, align: CanvasTextAlign = 'center') {
    ctx.font = fs(11, 700);
    const tw = ctx.measureText(text).width;
    const ph = 20 / k;
    const bx = align === 'left' ? x : align === 'right' ? x - tw : x - tw / 2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(bx - 6 / k, y - ph / 2, tw + 12 / k, ph, ph / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx, y + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    if (st.view === 'glands') drawGlands(fs, k);
    else if (st.view === 'thyroid') drawThyroid(fs, k);
    else drawGlucose(fs, k);
    ctx.restore();
    updateReadouts();
    drawGraph();
  }

  function drawGlands(fs: (n: number, w?: number) => string, k: number) {
    body();
    const g = GLANDS[st.gland];
    // highlight target organs
    for (const id of g.targets) {
      const [x, y] = TARGETS[id];
      ctx.strokeStyle = g.colour;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, 20 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // hormone particles travelling in the blood
    for (const p of particles) {
      const x = p.x + (p.tx - p.x) * p.f + Math.sin(p.f * 12) * 6;
      const y = p.y + (p.ty - p.y) * p.f;
      ctx.fillStyle = p.c;
      ctx.globalAlpha = clamp(1.2 - p.f, 0, 1);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // glands
    for (const [id, gd] of Object.entries(GLANDS)) {
      for (const [x, y] of gd.pos) {
        ctx.fillStyle = gd.colour;
        ctx.beginPath();
        ctx.arc(x, y, id === st.gland ? 13 : 10, 0, Math.PI * 2);
        ctx.fill();
        if (id === st.gland) {
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    }
    // labels on alternating sides
    const left: [string, number][] = [['hypothalamus', 72], ['thyroid', 168], ['adrenal', 292], ['gonads', 440]];
    const right: [string, number][] = [['pineal', 62], ['pituitary', 100], ['pancreas', 335]];
    for (const [id, y] of left) {
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(GLANDS[id].pos[0][0] - 12, y);
      ctx.lineTo(330, y);
      ctx.stroke();
      tag(GLANDS[id].name, 322, y, fs, k, 'right');
    }
    for (const [id, y] of right) {
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(GLANDS[id].pos[GLANDS[id].pos.length - 1][0] + 12, y);
      ctx.lineTo(670, y);
      ctx.stroke();
      tag(GLANDS[id].name, 678, y, fs, k, 'left');
    }
    ctx.font = fs(11, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'left';
    ctx.fillText(`Targets of ${g.hormone}: ${g.targets.map((x) => TARGET_NAME[x]).join(', ')}`, 20, 548);
  }

  function drawThyroid(fs: (n: number, w?: number) => string, k: number) {
    const box = (x: number, y: number, label: string, colour: string) => {
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.roundRect(x - 90, y - 30, 180, 60, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = fs(13, 800);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + 5);
    };
    const flow = (x1: number, y1: number, x2: number, y2: number, level: number, colour: string, label: string) => {
      arrow(ctx, x1, y1, x2, y2, colour, clamp(2 + level * 4, 1.5, 14), 16);
      ctx.font = fs(12, 750);
      ctx.fillStyle = colour;
      ctx.textAlign = 'left';
      ctx.fillText(`${label} ${Math.round(level * 100)}%`, x1 + 14, (y1 + y2) / 2 + 4);
    };
    box(300, 70, 'Hypothalamus', '#e0605a');
    box(300, 210, 'Pituitary gland', '#8e6bd8');
    // thyroid: grows into a goitre when TSH stays high
    const gs = clamp(0.8 + 0.4 * ax.goitre, 0.7, 1.6);
    ctx.fillStyle = '#e0a43a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(300 + side * 32 * gs, 360, 28 * gs, 40 * gs, side * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = fs(13, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText(gs > 1.35 ? 'Thyroid (enlarged: goitre)' : 'Thyroid gland', 300, 360 + 52 * gs + 18);
    box(300, 515, 'Body cells (metabolism)', '#3fb68b');
    flow(300, 100, 300, 178, ax.TRH, '#e0605a', 'TRH');
    flow(300, 240, 300, 315, ax.TSH, '#8e6bd8', 'TSH');
    flow(300, 360 + 46 * gs, 300, 483, ax.T4, '#e0a43a', 'T4');
    if (st.tablets > 0) {
      ctx.font = fs(12, 750);
      ctx.fillStyle = pal.success;
      ctx.textAlign = 'left';
      ctx.fillText(`+ tablets (${Math.round(st.tablets * 100)}% of normal output)`, 330, 470);
    }
    // negative feedback arrows
    ctx.setLineDash([7, 6]);
    for (const ty of [70, 210]) {
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(420, 380);
      ctx.quadraticCurveTo(560, (380 + ty) / 2, 395, ty);
      ctx.stroke();
      ctx.font = fs(18, 800);
      ctx.fillStyle = pal.danger;
      ctx.fillText('−', 402, ty - 8);
    }
    ctx.setLineDash([]);
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal.danger;
    ctx.textAlign = 'left';
    ctx.fillText('Negative feedback: T4 switches off TRH and TSH', 560, 220);
    ctx.font = fs(12, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText(`Day ${Math.floor(ax.day)}`, 560, 250);
  }

  function drawGlucose(fs: (n: number, w?: number) => string, k: number) {
    // blood vessel with glucose particles
    ctx.fillStyle = 'rgba(200, 60, 70, 0.18)';
    ctx.beginPath();
    ctx.roundRect(60, 230, 880, 100, 50);
    ctx.fill();
    const n = Math.round(clamp(gl.G, 0, 25) * 3);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(80 + ((i * 97 + t * 40) % 840), 250 + ((i * 37) % 60), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = fs(12, 750);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText(`Blood: glucose ${gl.G.toFixed(1)} mmol/L`, 500, 222);
    // pancreas releasing insulin (blue) and glucagon (orange)
    ctx.fillStyle = '#3fb68b';
    ctx.beginPath();
    ctx.ellipse(200, 120, 90, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    tag('Pancreas', 200, 70, fs, k);
    const ins = clamp((gl.I + gl.J) * 8, 0, 14);
    const glc = clamp(gl.Gn * 10, 0, 14);
    for (let i = 0; i < ins; i++) {
      const f = (t * 0.7 + i / ins) % 1;
      ctx.fillStyle = '#4c8dd6';
      ctx.beginPath();
      ctx.arc(170 + (i % 4) * 8, 150 + f * 90, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < glc; i++) {
      const f = (t * 0.7 + i / glc) % 1;
      ctx.fillStyle = '#e07a3a';
      ctx.beginPath();
      ctx.arc(220 + (i % 4) * 8, 150 + f * 90, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // liver: stores glucose as glycogen or releases it
    ctx.fillStyle = '#9b4a3a';
    ctx.beginPath();
    ctx.ellipse(780, 120, 110, 50, -0.1, 0, Math.PI * 2);
    ctx.fill();
    tag('Liver', 780, 60, fs, k);
    const storing = gl.glycogen < -0.002;
    arrow(ctx, 780, storing ? 230 : 172, 780, storing ? 172 : 230, storing ? '#4c8dd6' : '#e07a3a', 6, 16);
    ctx.font = fs(11.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(storing ? 'Storing glucose as glycogen' : 'Releasing glucose', 800, 205);
    // muscles taking up glucose
    ctx.fillStyle = '#c0564b';
    ctx.beginPath();
    ctx.roundRect(380, 400, 240, 70, 30);
    ctx.fill();
    tag('Muscle and fat cells', 500, 495, fs, k);
    const exercising = gl.min - gl.exercise >= 0 && gl.min - gl.exercise < 60;
    arrow(ctx, 500, 335, 500, 395, '#f2c94c', clamp(2 + (gl.I + gl.J) * 10 + (exercising ? 6 : 0), 2, 14), 16);
    if (gl.min - gl.meal >= 0 && gl.min - gl.meal < 150) tag('Digesting a meal: glucose absorbed from the gut', 500, 360, fs, k);
    // legend
    ctx.font = fs(11, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4c8dd6';
    ctx.fillText('● Insulin: lowers glucose', 60, 530);
    ctx.fillStyle = '#e07a3a';
    ctx.fillText('● Glucagon: raises glucose', 260, 530);
    ctx.fillStyle = '#c99a1e';
    ctx.fillText('● Glucose', 470, 530);
    ctx.fillStyle = pal['text-faint'];
    const hh = Math.floor(gl.min / 60);
    ctx.fillText(`Time: ${hh} h ${Math.round(gl.min - hh * 60)} min`, 620, 530);
  }

  /* ---------- Readouts and graph ---------- */
  function updateReadouts() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    if (st.view === 'glands') {
      const g = GLANDS[st.gland];
      const [eff, note, tone] = effect(st.gland, st.level);
      r('r1', 'Gland', g.name);
      r('r2', 'Hormones', g.hormones);
      r('r3', `Effect of ${g.hormone} at ${Math.round(st.level * 100)}%`, eff, tone);
      r('r4', 'Target organs', g.targets.map((x) => TARGET_NAME[x]).join(', '));
      sim.setBadge(g.name);
      noteEl.textContent = `${g.about} ${note}`;
    } else if (st.view === 'thyroid') {
      const T4 = ax.T4;
      r('r1', 'Thyroid hormone (T4)', `${Math.round(T4 * 100)} % of normal`, T4 < 0.75 || T4 > 1.4 ? 'warn' : 'ok');
      r('r2', 'TSH from the pituitary', `${Math.round(ax.TSH * 100)} % of normal`, ax.TSH < 0.5 || ax.TSH > 1.6 ? 'warn' : null);
      r('r3', 'TRH from the hypothalamus', `${Math.round(ax.TRH * 100)} % of normal`);
      r('r4', 'Metabolic rate', `about ${Math.round(60 + 40 * T4)} % of normal${ax.goitre > 1.5 ? ' · goitre forming' : ''}`);
      sim.setBadge(T4 < 0.75 ? 'Underactive' : T4 > 1.4 ? 'Overactive' : 'Balanced');
      noteEl.textContent = {
        normal: 'Negative feedback keeps T4 steady: if it rises, TRH and TSH fall; if it falls, they rise. Try adding tablets and watch TSH drop to compensate.',
        iodine: 'Without enough iodine the thyroid cannot make enough T4. Low T4 removes the feedback brake, so TSH rises and keeps stimulating the thyroid, which swells into a goitre.',
        graves: 'In Graves’ disease, antibodies stimulate the thyroid directly. T4 rises regardless of TSH, so the feedback loop switches TSH almost off.',
        pituitary: 'If the pituitary cannot make enough TSH, the thyroid is not stimulated: both TSH and T4 are low, unlike iodine deficiency.',
      }[st.scenario]!;
    } else {
      const G = gl.G;
      r('r1', 'Blood glucose', `${G.toFixed(1)} mmol/L (${Math.round(G * 18)} mg/dL)`, G < 3.9 ? 'bad' : G > 11 ? 'bad' : G > 7.8 ? 'warn' : 'ok');
      r('r2', 'Insulin', `${Math.round((gl.I + gl.J) * 100 / 0.32)} % of fasting level${gl.J > 0.05 ? ' (includes injection)' : ''}`);
      r('r3', 'Glucagon', `${Math.round(gl.Gn * 100 / 0.24)} % of fasting level`);
      r('r4', 'Liver', gl.glycogen < -0.002 ? 'Storing glucose as glycogen' : 'Releasing glucose');
      sim.setBadge(G < 3.9 ? 'Low glucose' : G > 11 ? 'High glucose' : 'In range');
      noteEl.textContent =
        st.diabetes === 't1'
          ? 'Type 1 diabetes: the immune system has destroyed the insulin-making cells, so glucose stays high. Injected insulin lets cells take up glucose again.'
          : st.diabetes === 't2'
            ? 'Type 2 diabetes: insulin is made, but cells respond to it weakly (insulin resistance), so glucose rises higher after meals and falls back more slowly.'
            : 'After a meal, glucose rises, the pancreas releases insulin, and cells and the liver take glucose in. Between meals, glucagon tells the liver to release glucose. This negative feedback keeps glucose near 4–7 mmol/L.';
    }
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="en-graph"]')!, {
    x: { min: 0, span: 60 },
    y: { min: 0, max: 300, step: 50 },
  });
  function drawGraph() {
    if (st.view === 'glands') return;
    graph.clear();
    if (st.view === 'thyroid') {
      graph.opts.x = { min: Math.max(0, ax.day - 120), span: 120, max: Math.max(120, ax.day), format: (x) => `${Math.round(x)} d` };
      const top = Math.max(250, ...axHist.T4.map((p) => p.y), ...axHist.TSH.map((p) => p.y));
      graph.opts.y = { min: 0, max: Math.ceil(top / 50) * 50, step: 50, format: (v) => `${v}%` };
      graph.opts.refs = [{ value: 100, label: 'Normal', color: 'text-faint' }];
      graph.set('trh', { label: 'TRH', color: '#e0605a', points: axHist.TRH });
      graph.set('tsh', { label: 'TSH', color: '#8e6bd8', points: axHist.TSH, width: 2.5 });
      graph.set('t4', { label: 'T4 (thyroxine)', color: '#e0a43a', points: axHist.T4, width: 3 });
    } else {
      graph.opts.x = { min: Math.max(0, gl.min - 720), span: 720, max: Math.max(720, gl.min), step: 120, format: (x) => `${Math.round(x / 60)} h` };
      graph.opts.y = { min: 0, max: 20, step: 4, format: (v) => `${v}` };
      graph.opts.refs = [
        { value: 4, label: 'Low', color: 'warning' },
        { value: 7.8, label: 'High after a meal', color: 'warning' },
      ];
      graph.set('g', { label: 'Blood glucose (mmol/L)', color: 'accent', points: glHist, width: 3 });
    }
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="en-graph"]'));
  }

  /* ---------- Interaction ---------- */
  canvas.addEventListener('click', (e) => {
    if (st.view !== 'glands') return;
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - r.left - ox) / k;
    const y = (e.clientY - r.top - oy) / k;
    for (const [id, g] of Object.entries(GLANDS))
      if (g.pos.some(([gx, gy]) => Math.hypot(x - gx, y - gy) < 16)) {
        gland.value = id;
        st.gland = id;
        particles = [];
        sim.showTooltip(e.clientX - r.left, e.clientY - r.top, g.name, g.hormones);
        sim.requestRender();
        return;
      }
    sim.hideTooltip();
  });

  const ui = controls(root);
  const gland = root.querySelector<HTMLSelectElement>('[data-gland]')!;
  gland.addEventListener('change', () => {
    st.gland = gland.value;
    particles = [];
    sim.requestRender();
  });
  const show = (v: View) => {
    ui.showWhen('[data-only="glands"]', v === 'glands');
    ui.showWhen('[data-only="thyroid"]', v === 'thyroid');
    ui.showWhen('[data-only="glucose"]', v === 'glucose');
    graphPanel.hidden = v === 'glands';
  };
  const viewCtl = ui.choice<View>('en-view', (v) => {
    st.view = v;
    show(v);
    sim.hideTooltip();
    sim.requestRender();
  });
  const levelCtl = ui.range('en-level', (v) => `${Math.round(v * 100)} % of normal`, (v) => ((st.level = v), sim.requestRender()));
  const scenCtl = ui.choice<string>('en-scen', (v) => {
    st.scenario = v;
    sim.play();
  });
  const tabCtl = ui.range('en-tablets', (v) => (v === 0 ? 'None' : `${Math.round(v * 100)} % of normal output`), (v) => {
    st.tablets = v;
    sim.play();
  });
  const diaCtl = ui.choice<'none' | 't1' | 't2'>('en-diabetes', (v) => {
    st.diabetes = v;
    resetGlucose();
    sim.play();
  });
  root.querySelector('[data-meal]')!.addEventListener('click', () => {
    gl.meal = gl.min;
    sim.play();
  });
  root.querySelector('[data-exercise]')!.addEventListener('click', () => {
    gl.exercise = gl.min;
    sim.play();
  });
  root.querySelector('[data-inject]')!.addEventListener('click', () => {
    gl.J += 0.6;
    sim.play();
  });
  show('glands');

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { view: 'glands', gland: 'thyroid', level: 1, scenario: 'normal', tablets: 0, diabetes: 'none' });
      viewCtl.set('glands', false);
      gland.value = 'thyroid';
      levelCtl.set(1, false);
      scenCtl.set('normal', false);
      tabCtl.set(0, false);
      diaCtl.set('none', false);
      show('glands');
      particles = [];
      resetAxis();
      resetGlucose();
    },
  });
}
