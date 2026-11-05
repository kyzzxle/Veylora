/**
 * Urinary system and kidney function.
 *
 * Whole-body numbers (simplified textbook physiology):
 *   GFR (glomerular filtration rate) ≈ 125 mL/min ≈ 180 L/day. It stays fairly
 *   steady between mean arterial pressures of about 80 and 170 mmHg
 *   (autoregulation) and falls steeply below that.
 *   Glucose: filtered load = GFR × blood glucose. Tubules can reabsorb about
 *   1.25 mmol/min, so glucose appears in urine above ~10 mmol/L; it then drags
 *   water with it (osmotic diuresis).
 *   Water: the kidneys aim to excrete roughly (water intake − 0.5 L/day of
 *   losses through skin, breath and faeces). Urine concentration = solutes ÷
 *   volume, limited to 50–1,200 mOsm/kg. ADH (antidiuretic hormone) is what
 *   sets it, by making the collecting duct permeable to water.
 *
 * The nephron view is a particle animation: each particle's fate (filtered or
 * not, and where it is reabsorbed) is chosen from the same rules.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type Kind = 'water' | 'salt' | 'glucose' | 'urea' | 'protein' | 'cell' | 'secrete';
type Seg = 'pct' | 'desc' | 'asc' | 'dct' | 'cd';
const KIND: Record<Kind, { colour: string; r: number; name: string }> = {
  water: { colour: '#5aa9ff', r: 3, name: 'Water' },
  salt: { colour: '#f4f4f4', r: 3, name: 'Salt (Na⁺)' },
  glucose: { colour: '#f2c94c', r: 3.5, name: 'Glucose' },
  urea: { colour: '#b07a45', r: 3.5, name: 'Urea (waste)' },
  protein: { colour: '#a77bd8', r: 6, name: 'Protein' },
  cell: { colour: '#d8433a', r: 6, name: 'Red blood cell' },
  secrete: { colour: '#4caf50', r: 3.5, name: 'Secreted waste (H⁺, drugs)' },
};

const INFO: Record<string, [string, string]> = {
  kidney: ['Kidney', 'A bean-shaped organ about 11 cm long. Each kidney contains about a million nephrons that filter the blood.'],
  ureter: ['Ureter', 'A muscular tube, about 25 cm long, that carries urine from the kidney to the bladder by waves of contraction.'],
  bladder: ['Urinary bladder', 'A stretchy muscular bag that stores urine. The urge to urinate usually starts at about 200–300 mL.'],
  urethra: ['Urethra', 'The tube that carries urine out of the body. Sphincter muscles control when it opens.'],
  aorta: ['Aorta and renal arteries', 'About a fifth of all the blood pumped by the heart flows through the kidneys.'],
  cava: ['Vena cava and renal veins', 'Filtered blood leaves the kidneys and returns towards the heart.'],
  glomerulus: ['Glomerulus', 'A knot of leaky capillaries. Blood pressure pushes water and small molecules out; cells and large proteins stay in the blood.'],
  capsule: ['Bowman’s capsule', 'A cup surrounding the glomerulus that collects the filtered fluid (filtrate).'],
  pct: ['Proximal convoluted tubule', 'Reabsorbs about two thirds of the water and salt, and normally all the glucose and amino acids, back into the blood. Some wastes are secreted in.'],
  desc: ['Descending loop of Henle', 'Permeable to water but not salt. Water leaves into the salty medulla.'],
  asc: ['Ascending loop of Henle', 'Pumps salt out but lets no water through, building the salty gradient in the medulla.'],
  dct: ['Distal convoluted tubule', 'Fine-tunes salt, potassium and acid (H⁺) levels, controlled by hormones such as aldosterone.'],
  cd: ['Collecting duct', 'ADH makes it permeable to water. With lots of ADH, water is drawn out into the salty medulla and urine is concentrated.'],
  capillary: ['Peritubular capillaries', 'Blood vessels wrapped around the tubule that take back reabsorbed substances.'],
  afferent: ['Afferent arteriole', 'Brings blood into the glomerulus.'],
  efferent: ['Efferent arteriole', 'Carries blood away from the glomerulus to the capillaries around the tubule.'],
};

/* ---------- Nephron geometry (local coordinates, 640 × 580) ---------- */
type P = [number, number];
const TUBULE: P[] = [
  [128, 110], [165, 88], [200, 112], [168, 148], [212, 168], [250, 145], // PCT
  [262, 175], [266, 300], [268, 450], // descending limb
  [292, 478], [316, 450], // loop tip and start of ascending
  [320, 300], [322, 190], // ascending limb
  [338, 160], [372, 148], [352, 118], [396, 104], [430, 128], // DCT
  [455, 150], [457, 300], [459, 450], [461, 540], // collecting duct
];
const SEG_AT: [number, Seg][] = [[0, 'pct'], [6, 'desc'], [10, 'asc'], [13, 'dct'], [18, 'cd']];
const segLens = TUBULE.slice(1).map((p, i) => Math.hypot(p[0] - TUBULE[i][0], p[1] - TUBULE[i][1]));
const cum = [0];
segLens.forEach((l) => cum.push(cum[cum.length - 1] + l));
const TOTAL = cum[cum.length - 1];
const segStart: Record<Seg, number> = Object.fromEntries(SEG_AT.map(([i, s]) => [s, cum[i]])) as Record<Seg, number>;
const segEnd: Record<Seg, number> = { pct: segStart.desc, desc: segStart.asc, asc: segStart.dct, dct: segStart.cd, cd: TOTAL };
const segOf = (s: number): Seg => (s < segStart.desc ? 'pct' : s < segStart.asc ? 'desc' : s < segStart.dct ? 'asc' : s < segStart.cd ? 'dct' : 'cd');
const tubeAt = (s: number): { p: P; n: P } => {
  const d = clamp(s, 0, TOTAL - 0.01);
  let i = cum.findIndex((c, j) => j > 0 && c > d) - 1;
  if (i < 0) i = TUBULE.length - 2;
  const a = TUBULE[i];
  const b = TUBULE[i + 1];
  const t = (d - cum[i]) / segLens[i];
  const len = segLens[i] || 1;
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len] };
};
const GLOM: P = [90, 110];

interface Particle {
  kind: Kind;
  stage: 'blood' | 'efferent' | 'tubule' | 'reabsorb' | 'urine';
  s: number;
  t: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  fate: number; // tubule position where it is reabsorbed, or Infinity for urine
  tracked?: boolean;
}

export function initKidney(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;

  const st = { intake: 2, salt: 'normal' as 'low' | 'normal' | 'high', glucose: 5, pressure: 93, follow: true, labels: true };
  let parts: Particle[] = [];
  let spawnAcc = 0;
  let bladder = 120; // mL
  let minutes = 0;
  let trackedWhere = '';
  let trackTimer = 0;

  /* ---------- Whole-body kidney model ---------- */
  function model() {
    const map = st.pressure;
    const gfr = map >= 80 ? 125 * (1 + (map - 93) * 0.0015) : 125 * clamp((map - 40) / 40, 0, 1) * (1 + (80 - 93) * 0.0015);
    const filteredGlucose = (gfr * st.glucose) / 1000; // mmol/min
    const glucoseLost = Math.max(0, filteredGlucose - 1.25); // mmol/min above the reabsorption limit
    const solutes = { low: 450, normal: 700, high: 1000 }[st.salt]; // mOsm/day
    let V = Math.max(st.intake - 0.5, 0.05); // L/day the body tries to excrete
    let U = solutes / V;
    let limit = '';
    if (U > 1200) {
      U = 1200;
      V = solutes / 1200;
      limit = 'max';
    }
    if (U < 50) {
      U = 50;
      V = solutes / 50;
      limit = 'min';
    }
    // glucose in the tubule holds water (osmotic diuresis)
    const extra = (glucoseLost * 1440) / 300;
    const Uall = (solutes + glucoseLost * 1440) / (V + extra);
    V = (V + extra) * Math.min(1, gfr / 100);
    const adh = clamp(((U - 50) / 1150) ** (1 / 1.2), 0, 1);
    const filtrate = (gfr * 1440) / 1000; // L/day
    const reabsorbed = 1 - V / Math.max(filtrate, 0.01);
    const glucoseReabsorb = filteredGlucose > 0 ? Math.min(1, 1.25 / filteredGlucose) : 1;
    return { gfr, V, U: Uall, adh, filtrate, reabsorbed, glucoseLost, glucoseReabsorb, limit, aldo: st.salt === 'low' ? 0.9 : st.salt === 'high' ? 0.25 : 0.55 };
  }

  /** Decide where a filtered particle will be reabsorbed (or that it reaches the urine). */
  function fate(kind: Kind, m: ReturnType<typeof model>): number {
    const r = Math.random;
    const inSeg = (seg: Seg) => segStart[seg] + (segEnd[seg] - segStart[seg]) * (0.15 + r() * 0.7);
    // chance of being reabsorbed in each segment, given it reached that segment
    const chances: Record<Kind, Partial<Record<Seg, number>>> = {
      water: { pct: 0.65, desc: 0.45, dct: 0.25, cd: 0.15 + 0.8 * m.adh },
      salt: { pct: 0.65, asc: 0.7, dct: 0.4, cd: m.aldo },
      glucose: { pct: m.glucoseReabsorb },
      urea: { pct: 0.4, cd: 0.4 * m.adh },
      secrete: {},
      protein: {},
      cell: {},
    };
    for (const seg of ['pct', 'desc', 'asc', 'dct', 'cd'] as Seg[]) {
      const c = chances[kind][seg];
      if (c && r() < c) return inSeg(seg);
    }
    return Infinity;
  }

  function spawn(m: ReturnType<typeof model>, tracked = false) {
    const r = Math.random();
    const glucoseShare = 0.06 * clamp(st.glucose / 5, 0.5, 3);
    const kind: Kind = tracked ? 'water' : r < 0.42 ? 'water' : r < 0.6 ? 'salt' : r < 0.6 + glucoseShare ? 'glucose' : r < 0.74 + glucoseShare ? 'urea' : r < 0.84 + glucoseShare ? 'protein' : 'cell';
    parts.push({ kind, stage: 'blood', s: 0, t: 0, x: 0, y: 80 + Math.random() * 20, fx: 0, fy: 0, fate: fate(kind, m), tracked });
  }

  function step(dt: number) {
    const m = model();
    minutes += dt * 10; // 1 s = 10 minutes of body time
    bladder = clamp(bladder + ((m.V * 1000) / 1440) * dt * 10, 0, 700);
    // particles
    spawnAcc += dt * 14 * clamp(m.gfr / 125, 0.15, 1.3);
    while (spawnAcc > 1) {
      spawnAcc--;
      if (parts.length < 260) spawn(m);
    }
    trackTimer -= dt;
    if (st.follow && !parts.some((p) => p.tracked) && trackTimer <= 0) {
      spawn(m, true);
      trackTimer = 2;
    }
    // secreted wastes enter the tubule from the blood in the PCT and DCT
    if (Math.random() < dt * 1.2 && parts.length < 260) {
      const seg: Seg = Math.random() < 0.6 ? 'pct' : 'dct';
      const s = segStart[seg] + (segEnd[seg] - segStart[seg]) * Math.random();
      const { p, n } = tubeAt(s);
      parts.push({ kind: 'secrete', stage: 'reabsorb', s, t: -1, x: p[0] + n[0] * 24, y: p[1] + n[1] * 24, fx: p[0], fy: p[1], fate: Infinity });
    }
    const speed = 85;
    for (const p of parts) {
      p.t += dt;
      if (p.stage === 'blood') {
        // afferent arteriole → glomerulus
        p.x += speed * 1.4 * dt;
        p.y += (GLOM[1] - p.y) * dt * 2;
        if (p.x >= GLOM[0] - 8) {
          const filters = p.kind !== 'protein' && p.kind !== 'cell' && (p.tracked || Math.random() < 0.55);
          if (filters) {
            p.stage = 'tubule';
            p.s = 0;
          } else {
            p.stage = 'efferent';
            p.t = 0;
          }
        }
      } else if (p.stage === 'efferent') {
        p.x -= 30 * dt;
        p.y += 60 * dt;
        if (p.t > 1.4) p.t = 99;
      } else if (p.stage === 'tubule') {
        p.s += speed * dt;
        const { p: q } = tubeAt(p.s);
        p.x = q[0];
        p.y = q[1];
        if (p.s >= p.fate) {
          const { n } = tubeAt(p.s);
          p.stage = 'reabsorb';
          p.t = 0;
          p.fx = q[0] + n[0] * 24;
          p.fy = q[1] + n[1] * 24;
        } else if (p.s >= TOTAL - 1) {
          p.stage = 'urine';
          p.t = 0;
        }
      } else if (p.stage === 'reabsorb') {
        if (p.t < 0) {
          // secretion: blood → tubule, then flows on as urine
          p.x += (p.fx - p.x) * dt * 3;
          p.y += (p.fy - p.y) * dt * 3;
          if (Math.hypot(p.fx - p.x, p.fy - p.y) < 1.5) {
            p.stage = 'tubule';
            p.fate = Infinity;
          }
        } else {
          p.x += (p.fx - p.x) * dt * 4;
          p.y += (p.fy - p.y) * dt * 4;
        }
      } else if (p.stage === 'urine') {
        p.y += 40 * dt;
      }
      if (p.tracked) {
        trackedWhere = p.stage === 'blood' ? 'Afferent arteriole (in the blood)' : p.stage === 'tubule' ? INFO[segOf(p.s)][0] : p.stage === 'reabsorb' ? 'Reabsorbed into the blood' : p.stage === 'urine' ? 'In the urine, heading for the bladder' : 'Leaving in the blood';
      }
    }
    parts = parts.filter((p) => !(p.stage === 'efferent' && p.t > 1.4) && !(p.stage === 'reabsorb' && p.t > 0.9) && !(p.stage === 'urine' && p.t > 0.8));
  }

  /* ---------- Layout ---------- */
  const isStacked = () => size.h > size.w;
  const box = () => (isStacked() ? { bw: 660, bh: 1200, ov: [160, 10] as P, nf: [10, 610] as P } : { bw: 1000, bh: 590, ov: [0, 0] as P, nf: [360, 0] as P });
  const tf = () => {
    const b = box();
    const k = Math.min(size.w / b.bw, size.h / b.bh);
    return { k, ox: (size.w - b.bw * k) / 2, oy: (size.h - b.bh * k) / 2, b };
  };

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy, b } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    const m = model();
    const tag = (text: string, x: number, y: number) => {
      if (!st.labels) return;
      ctx.font = fs(11, 700);
      const tw = ctx.measureText(text).width;
      const ph = 20 / k;
      ctx.globalAlpha = 0.88;
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
    };

    /* Overview of the urinary system */
    ctx.save();
    ctx.translate(...b.ov);
    ctx.fillStyle = 'rgba(230, 185, 150, 0.12)';
    ctx.strokeStyle = 'rgba(200, 145, 110, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, 20, 260, 550, 60);
    ctx.fill();
    ctx.stroke();
    // aorta and vena cava
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(182, 40);
    ctx.lineTo(182, 380);
    ctx.stroke();
    ctx.strokeStyle = '#3a62c8';
    ctx.beginPath();
    ctx.moveTo(158, 40);
    ctx.lineTo(158, 380);
    ctx.stroke();
    ctx.lineWidth = 6;
    for (const side of [-1, 1]) {
      const kx = side < 0 ? 95 : 245;
      ctx.strokeStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(182, 160);
      ctx.lineTo(kx + side * -18, 150);
      ctx.stroke();
      ctx.strokeStyle = '#3a62c8';
      ctx.beginPath();
      ctx.moveTo(158, 172);
      ctx.lineTo(kx + side * -18, 168);
      ctx.stroke();
    }
    // ureters with urine drops
    ctx.strokeStyle = '#e8c96a';
    ctx.lineWidth = 6;
    const ureters: [P, P][] = [[[110, 180], [150, 400]], [[230, 180], [200, 400]]];
    for (const [a, c] of ureters) {
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.quadraticCurveTo(a[0] + (c[0] - a[0]) * 0.2, (a[1] + c[1]) / 2, ...c);
      ctx.stroke();
      const n = Math.round(clamp(m.V, 0.3, 6) * 1.5);
      for (let i = 0; i < n; i++) {
        const f = ((minutes / 6 + i / n) % 1 + 1) % 1;
        const x = (1 - f) * (1 - f) * a[0] + 2 * (1 - f) * f * (a[0] + (c[0] - a[0]) * 0.2) + f * f * c[0];
        const y = (1 - f) * (1 - f) * a[1] + 2 * (1 - f) * f * ((a[1] + c[1]) / 2) + f * f * c[1];
        ctx.fillStyle = '#c99a1e';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // kidneys
    for (const kx of [95, 245]) {
      ctx.fillStyle = '#9b3b3b';
      ctx.beginPath();
      ctx.ellipse(kx, 160, 34, 58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c7615a';
      ctx.beginPath();
      ctx.ellipse(kx, 160, 22, 44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // bladder: grows with its contents; urine colour follows concentration
    const bs = 34 + Math.sqrt(bladder) * 1.6;
    const yellow = clamp((m.U - 50) / 1150, 0, 1);
    ctx.fillStyle = '#d9a3a3';
    ctx.beginPath();
    ctx.ellipse(175, 440, bs * 0.9, bs * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(${245 - yellow * 40}, ${232 - yellow * 90}, ${150 - yellow * 130})`;
    ctx.beginPath();
    ctx.ellipse(175, 440 + bs * 0.12, bs * 0.72, bs * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d9a3a3';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(175, 440 + bs * 0.72);
    ctx.lineTo(175, 560);
    ctx.stroke();
    // magnifier linking a kidney to the nephron view
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(232, 120, 36, 36);
    if (!isStacked()) {
      ctx.beginPath();
      ctx.moveTo(268, 120);
      ctx.lineTo(360, 30);
      ctx.moveTo(268, 156);
      ctx.lineTo(360, 560);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    tag('Kidney', 95, 238);
    tag('Ureter', 108, 300);
    tag('Bladder', 175, 440);
    tag('Urethra', 220, 545);
    tag('Aorta', 222, 70);
    tag('Vena cava', 110, 70);
    ctx.restore();

    /* Nephron */
    ctx.save();
    ctx.translate(...b.nf);
    // cortex and medulla (saltier deeper down)
    ctx.fillStyle = 'rgba(214, 120, 110, 0.12)';
    ctx.fillRect(0, 0, 640, 205);
    const med = ctx.createLinearGradient(0, 205, 0, 560);
    med.addColorStop(0, 'rgba(214, 120, 110, 0.18)');
    med.addColorStop(1, 'rgba(160, 60, 70, 0.45)');
    ctx.fillStyle = med;
    ctx.fillRect(0, 205, 640, 355);
    ctx.font = fs(10.5, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'right';
    ctx.fillText('Cortex', 630, 196);
    ctx.fillText('Medulla', 630, 222);
    ctx.fillText('300 → 1,200 mOsm/kg', 630, 238);
    ctx.fillText('saltier deeper down', 630, 254);
    // peritubular capillary alongside the tubule
    ctx.strokeStyle = 'rgba(200, 70, 80, 0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let s = 0; s <= TOTAL; s += 8) {
      const { p, n } = tubeAt(s);
      const x = p[0] + n[0] * 24;
      const y = p[1] + n[1] * 24;
      s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    // afferent and efferent arterioles
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 90);
    ctx.lineTo(70, 105);
    ctx.stroke();
    ctx.strokeStyle = '#b35060';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(78, 128);
    ctx.lineTo(40, 190);
    ctx.stroke();
    // tubule, coloured by segment
    const segColour: Record<Seg, string> = { pct: '#e6b85c', desc: '#79b7e0', asc: '#5d8fd6', dct: '#e09a5c', cd: '#9aa3ad' };
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const seg of ['pct', 'desc', 'asc', 'dct', 'cd'] as Seg[]) {
      ctx.strokeStyle = segColour[seg];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let s = segStart[seg]; s <= segEnd[seg] + 0.1; s += 4) {
        const { p } = tubeAt(Math.min(s, segEnd[seg]));
        s === segStart[seg] ? ctx.moveTo(...p) : ctx.lineTo(...p);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Bowman's capsule and glomerulus
    ctx.strokeStyle = '#e6b85c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(GLOM[0], GLOM[1], 38, -2.3, 2.6);
    ctx.stroke();
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(GLOM[0] + Math.cos(i) * 10, GLOM[1] + Math.sin(i * 1.7) * 10, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    // renal pelvis outlet
    ctx.fillStyle = '#e8c96a';
    ctx.beginPath();
    ctx.ellipse(461, 560, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // particles
    for (const p of parts) {
      const kd = KIND[p.kind];
      ctx.globalAlpha = p.stage === 'reabsorb' && p.t > 0 ? clamp(1 - p.t, 0, 1) : p.stage === 'urine' || p.stage === 'efferent' ? clamp(1 - p.t * 0.8, 0, 1) : 1;
      ctx.fillStyle = kd.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, kd.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.tracked) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pal.warning;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    tag('Glomerulus', 90, 165);
    tag('Bowman’s capsule', 90, 58);
    tag('Proximal tubule', 210, 70);
    tag('Loop of Henle', 292, 505);
    tag('Distal tubule', 400, 82);
    tag('Collecting duct', 520, 400);
    tag('Capillary', 215, 340);
    ctx.restore();
    ctx.restore();
    updateReadouts(m);
  }

  function updateReadouts(m: ReturnType<typeof model>) {
    ui.readout('urine', `${m.V.toFixed(2)} L per day (${Math.round((m.V * 1000) / 24)} mL per hour)`, m.V < 0.5 ? 'bad' : m.V > 3.5 ? 'warn' : 'ok');
    ui.readout('conc', `${Math.round(m.U)} mOsm/kg ${m.U > 900 ? '(dark, concentrated)' : m.U < 200 ? '(pale, dilute)' : ''}`);
    ui.readout('gfr', `${Math.round(m.gfr)} mL/min (${m.filtrate.toFixed(0)} L of filtrate a day)`, m.gfr < 90 ? 'warn' : null);
    ui.readout('reab', `${(m.reabsorbed * 100).toFixed(1)} % of filtered water`);
    ui.readout('adh', `${Math.round(m.adh * 100)} %`);
    ui.readout('glucose', m.glucoseLost > 0 ? `Yes: about ${Math.round(m.glucoseLost * 1440 * 0.18)} g per day (blood glucose above the kidney’s limit)` : 'None: all reabsorbed', m.glucoseLost > 0 ? 'bad' : 'ok');
    ui.readout('bladder', `${Math.round(bladder)} mL${bladder > 300 ? ' (urge to urinate)' : ''}`, bladder > 450 ? 'warn' : null);
    ui.readout('track', st.follow ? trackedWhere || 'Waiting…' : 'Off');
    sim.setBadge(m.gfr < 90 ? 'Low filtration' : m.limit === 'max' ? 'Saving water' : m.limit === 'min' ? 'Removing water' : m.glucoseLost > 0 ? 'Glucose in urine' : 'Balanced');
    noteEl.textContent =
      m.gfr < 90
        ? 'Low blood pressure: less blood is filtered, so urine output falls. Severe drops can damage the kidneys.'
        : m.glucoseLost > 0
          ? 'Blood glucose is above what the tubules can reabsorb, so glucose spills into the urine and drags water with it: more urine, and thirst. This is a classic sign of untreated diabetes.'
          : m.limit === 'max'
            ? 'Not enough water: ADH is at maximum, the collecting ducts reabsorb as much water as possible, and urine is as concentrated as it can be. The body still loses some water, so you would feel thirsty.'
            : m.limit === 'min'
              ? 'Lots of water: ADH is switched off, the collecting ducts stay watertight, and large volumes of very dilute urine are produced.'
              : 'The kidneys are balancing what you drink: ADH adjusts how much water the collecting ducts reabsorb.';
  }

  /* ---------- Interaction ---------- */
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy, b } = tf();
    const X = (e.clientX - r.left - ox) / k;
    const Y = (e.clientY - r.top - oy) / k;
    let id: string | null = null;
    // overview
    const x = X - b.ov[0];
    const y = Y - b.ov[1];
    if (x >= 30 && x <= 310 && y >= 0 && y <= 580 && (isStacked() ? Y < 600 : X < 350)) {
      if ((Math.hypot((x - 95) / 36, (y - 160) / 60) < 1) || Math.hypot((x - 245) / 36, (y - 160) / 60) < 1) id = 'kidney';
      else if (Math.hypot((x - 175) / 80, (y - 440) / 70) < 1) id = 'bladder';
      else if (y > 500 && Math.abs(x - 175) < 14) id = 'urethra';
      else if (y > 180 && y < 400 && (Math.abs(x - (110 + ((y - 180) / 220) * 40)) < 12 || Math.abs(x - (230 - ((y - 180) / 220) * 30)) < 12)) id = 'ureter';
      else if (Math.abs(x - 182) < 9) id = 'aorta';
      else if (Math.abs(x - 158) < 9) id = 'cava';
    } else {
      const nx = X - b.nf[0];
      const ny = Y - b.nf[1];
      if (Math.hypot(nx - GLOM[0], ny - GLOM[1]) < 22) id = 'glomerulus';
      else if (Math.hypot(nx - GLOM[0], ny - GLOM[1]) < 44) id = 'capsule';
      else if (nx < 70 && ny < 115) id = 'afferent';
      else if (nx < 80 && ny > 120 && ny < 200) id = 'efferent';
      else {
        let best = 1e9;
        let bestS = 0;
        let cap = false;
        for (let s = 0; s <= TOTAL; s += 4) {
          const { p, n } = tubeAt(s);
          const d1 = Math.hypot(nx - p[0], ny - p[1]);
          const d2 = Math.hypot(nx - p[0] - n[0] * 24, ny - p[1] - n[1] * 24);
          if (d1 < best) ((best = d1), (bestS = s), (cap = false));
          if (d2 < best) ((best = d2), (bestS = s), (cap = true));
        }
        if (best < 14) id = cap ? 'capillary' : segOf(bestS);
      }
    }
    if (!id) return sim.hideTooltip();
    sim.showTooltip(e.clientX - r.left, e.clientY - r.top, INFO[id][0], INFO[id][1]);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const intake = ui.range('kd-water', (v) => `${v} L per day`, (v) => ((st.intake = v), sim.requestRender()));
  const salt = ui.choice<'low' | 'normal' | 'high'>('kd-salt', (v) => ((st.salt = v), sim.requestRender()));
  const glucose = ui.range('kd-glucose', (v) => `${v} mmol/L`, (v) => ((st.glucose = v), sim.requestRender()));
  const pressure = ui.range('kd-bp', (v) => `${v} mmHg`, (v) => ((st.pressure = v), sim.requestRender()));
  const follow = ui.toggle('kd-follow', (v) => ((st.follow = v), sim.requestRender()));
  const labels = ui.toggle('kd-labels', (v) => ((st.labels = v), sim.requestRender()));
  root.querySelector('[data-empty]')!.addEventListener('click', () => {
    bladder = 0;
    sim.announce('Bladder emptied.');
    sim.requestRender();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-kd]').forEach((b) =>
    b.addEventListener('click', () => {
      const [wtr, sl, gl, bp] = b.dataset.kd!.split(',');
      intake.set(Number(wtr));
      salt.set(sl as 'low' | 'normal' | 'high');
      glucose.set(Number(gl));
      pressure.set(Number(bp));
    }),
  );

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { intake: 2, salt: 'normal', glucose: 5, pressure: 93, follow: true, labels: true });
      intake.set(2, false);
      salt.set('normal', false);
      glucose.set(5, false);
      pressure.set(93, false);
      follow.set(true, false);
      labels.set(true, false);
      parts = [];
      bladder = 120;
      minutes = 0;
    },
  });
}
