/**
 * Digestive system: follow one meal from mouth to anus.
 *
 * The food moves along the tract through six stages. Each nutrient has a
 * "broken down" and an "absorbed" fraction that changes through each stage,
 * following textbook physiology:
 *   starch   – salivary amylase (mouth), pancreatic amylase and brush-border
 *              enzymes (small intestine) → glucose, absorbed in the small intestine
 *   protein  – pepsin (stomach), trypsin and peptidases (small intestine)
 *              → amino acids, absorbed in the small intestine
 *   fat      – emulsified by bile, digested by lipase (small intestine)
 *              → fatty acids and glycerol, absorbed into lacteals
 *   fibre    – not digested by human enzymes; partly fermented by bacteria
 *   water    – mostly absorbed in the small intestine, the rest in the colon
 * Times on the "body clock" are typical values; fatty meals stay longer in
 * the stomach.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border-strong', 'accent', 'success'] as const;

type Stage = 'mouth' | 'oesophagus' | 'stomach' | 'small' | 'large' | 'rectum';
type Nutrient = 'carbs' | 'protein' | 'fat' | 'fibre' | 'water';
type Meal = 'bread' | 'chicken' | 'oil' | 'balanced';

const MEALS: Record<Meal, Partial<Record<Nutrient, number>>> = {
  bread: { carbs: 50, protein: 9, fat: 3, fibre: 6, water: 40 },
  chicken: { protein: 31, fat: 4, water: 65 },
  oil: { fat: 20 },
  balanced: { carbs: 60, protein: 25, fat: 15, fibre: 8, water: 250 },
};
const KCAL: Record<Nutrient, number> = { carbs: 4, protein: 4, fat: 9, fibre: 2, water: 0 };
const NUTRIENT_NAME: Record<Nutrient, [string, string]> = {
  carbs: ['Carbohydrate (starch)', 'glucose'],
  protein: ['Protein', 'amino acids'],
  fat: ['Fat', 'fatty acids + glycerol'],
  fibre: ['Fibre', 'fermented by bacteria'],
  water: ['Water', 'absorbed'],
};
const NUTRIENT_COLOUR: Record<Nutrient, string> = { carbs: '#e0a43a', protein: '#d0605a', fat: '#e3c94a', fibre: '#7aa35a', water: '#4fa3d9' };

const STAGES: Stage[] = ['mouth', 'oesophagus', 'stomach', 'small', 'large', 'rectum'];
const STAGE_SECONDS: Record<Stage, number> = { mouth: 3, oesophagus: 2, stomach: 7, small: 11, large: 7, rectum: 2 };
const STAGE_NAME: Record<Stage, string> = {
  mouth: 'Mouth',
  oesophagus: 'Oesophagus',
  stomach: 'Stomach',
  small: 'Small intestine',
  large: 'Large intestine',
  rectum: 'Rectum',
};
const STAGE_TEXT: Record<Stage | 'done', string> = {
  mouth: 'Teeth break food into smaller pieces (mechanical digestion). Saliva moistens it and salivary amylase starts breaking starch down.',
  oesophagus: 'Waves of muscle contraction (peristalsis) squeeze the bolus down to the stomach in a few seconds.',
  stomach: 'The stomach churns food with gastric juice. Hydrochloric acid kills microbes and activates pepsin, which starts breaking proteins into smaller peptides.',
  small: 'Bile emulsifies fats into tiny droplets. Pancreatic enzymes (amylase, trypsin, lipase) finish digestion, and villi absorb sugars, amino acids and fatty acids.',
  large: 'Water and salts are absorbed. Gut bacteria ferment some fibre and make vitamin K. What remains becomes faeces.',
  rectum: 'Faeces are stored in the rectum until they leave the body through the anus (egestion).',
  done: 'Journey complete. The useful nutrients were absorbed in the small intestine; undigested fibre, bacteria and dead cells left as faeces.',
};

/** Cumulative [broken down, absorbed] fractions at the END of each stage. */
const PROFILE: Record<Nutrient, Record<Stage, [number, number]>> = {
  carbs: { mouth: [0.05, 0], oesophagus: [0.07, 0], stomach: [0.12, 0], small: [1, 0.98], large: [1, 0.98], rectum: [1, 0.98] },
  protein: { mouth: [0, 0], oesophagus: [0, 0], stomach: [0.2, 0], small: [1, 0.95], large: [1, 0.95], rectum: [1, 0.95] },
  fat: { mouth: [0, 0], oesophagus: [0, 0], stomach: [0.1, 0], small: [1, 0.95], large: [1, 0.95], rectum: [1, 0.95] },
  fibre: { mouth: [0, 0], oesophagus: [0, 0], stomach: [0, 0], small: [0, 0], large: [0.3, 0.3], rectum: [0.3, 0.3] },
  water: { mouth: [1, 0], oesophagus: [1, 0], stomach: [1, 0.05], small: [1, 0.8], large: [1, 0.98], rectum: [1, 0.98] },
};

const INFO: Record<string, [string, string]> = {
  mouth: ['Mouth', 'Teeth chew the food and saliva starts digesting starch.'],
  salivary: ['Salivary glands', 'Make about 1–1.5 litres of saliva a day, containing the enzyme amylase.'],
  oesophagus: ['Oesophagus', 'A muscular tube about 25 cm long. Peristalsis moves food down, so you can even swallow upside down.'],
  stomach: ['Stomach', 'A stretchy muscular bag. Gastric juice contains hydrochloric acid (pH about 1.5–3.5) and pepsin. Food stays about 2–4 hours.'],
  liver: ['Liver', 'Makes bile, processes absorbed nutrients and stores glycogen. It is the largest internal organ.'],
  gallbladder: ['Gallbladder', 'Stores and concentrates bile, then squeezes it into the small intestine after a fatty meal.'],
  pancreas: ['Pancreas', 'Releases juice containing amylase, trypsin and lipase into the small intestine, plus bicarbonate to neutralise stomach acid.'],
  small: ['Small intestine', 'About 6 m long. Folds and millions of finger-like villi give it a huge surface area for absorbing nutrients.'],
  large: ['Large intestine (colon)', 'About 1.5 m long. It absorbs water and salts and is home to trillions of helpful bacteria.'],
  rectum: ['Rectum and anus', 'The rectum stores faeces until they leave the body through the anus.'],
};

/* ---------- The tract (body coordinates, 520 × 700) ---------- */
type P = [number, number];
const TRACT: Record<Stage, P[]> = {
  mouth: [[245, 102], [262, 104], [266, 114]],
  oesophagus: [[266, 114], [262, 200], [266, 280], [286, 338]],
  stomach: [[286, 338], [318, 344], [344, 362], [352, 392], [338, 416], [312, 424], [294, 420]],
  small: [
    [294, 420], [302, 444], [288, 462], [258, 466], [238, 456], [216, 478],
    [340, 482], [340, 500], [200, 500], [200, 518], [340, 518], [340, 536], [200, 536], [200, 554], [340, 554], [340, 572], [205, 572], [180, 584],
  ],
  large: [[180, 584], [162, 580], [158, 458], [172, 444], [368, 444], [382, 460], [384, 598], [366, 622], [306, 614], [282, 630]],
  rectum: [[282, 630], [274, 660], [270, 690]],
};
const LEN = (pts: P[]) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const along = (pts: P[], u: number): P => {
  let d = clamp(u, 0, 1) * LEN(pts);
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) {
      const t = seg ? clamp(d / seg, 0, 1) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    d -= seg;
  }
  return pts[pts.length - 1];
};
const TUBE_WIDTH: Record<Stage, number> = { mouth: 10, oesophagus: 12, stomach: 0, small: 11, large: 22, rectum: 18 };

const STOMACH_SHAPE: P[] = [[282, 334], [300, 326], [336, 334], [364, 360], [370, 398], [350, 428], [312, 438], [290, 428], [298, 410], [326, 404], [334, 380], [316, 360], [292, 352]];
const LIVER_SHAPE: P[] = [[150, 300], [250, 286], [334, 296], [318, 328], [272, 352], [212, 368], [160, 360], [146, 330]];

export function initDigestion(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const textEl = root.querySelector<HTMLElement>('[data-stage-text]')!;

  const p = { meal: 'balanced' as Meal, speed: 1, enzymes: true, labels: true };
  let stageIdx = 0;
  let u = 0; // progress within the stage (0–1)
  let done = false;
  let time = 0;

  const stage = () => STAGES[stageIdx];
  const stomachHours = () => {
    const m = MEALS[p.meal];
    const total = (m.carbs ?? 0) + (m.protein ?? 0) + (m.fat ?? 0) + 1;
    return 2 + 2 * ((m.fat ?? 0) / total); // fat slows stomach emptying
  };
  /** Body-clock hours at the end of each stage. */
  const stageHours = (): Record<Stage, number> => {
    const mouth = 1 / 60;
    const oes = mouth + 10 / 3600;
    const st = oes + stomachHours();
    const small = st + 4;
    const large = small + 20;
    return { mouth, oesophagus: oes, stomach: st, small, large, rectum: large + 4 };
  };
  const clockHours = () => {
    const hrs = stageHours();
    if (done) return hrs.rectum;
    const start = stageIdx ? hrs[STAGES[stageIdx - 1]] : 0;
    return start + (hrs[stage()] - start) * u;
  };

  /** Broken-down and absorbed fractions of a nutrient right now. */
  const fractions = (n: Nutrient): [number, number] => {
    if (done) return PROFILE[n].rectum;
    const prev: [number, number] = stageIdx ? PROFILE[n][STAGES[stageIdx - 1]] : [0, 0];
    const end = PROFILE[n][stage()];
    // Absorption lags behind digestion within the small intestine
    const ub = stage() === 'small' ? clamp(u / 0.6, 0, 1) : u;
    const ua = stage() === 'small' ? clamp((u - 0.15) / 0.85, 0, 1) : u;
    return [prev[0] + (end[0] - prev[0]) * ub, prev[1] + (end[1] - prev[1]) * ua];
  };

  function restart() {
    stageIdx = 0;
    u = 0;
    done = false;
    time = 0;
  }

  function step(dt: number) {
    if (done) return;
    time += dt;
    u += (dt * p.speed) / STAGE_SECONDS[stage()];
    if (u >= 1) {
      if (stageIdx < STAGES.length - 1) {
        stageIdx++;
        u = 0;
        sim.announce(`Now in the ${STAGE_NAME[stage()].toLowerCase()}.`);
      } else {
        u = 1;
        done = true;
        sim.pause();
        sim.announce(STAGE_TEXT.done);
      }
    }
  }

  /* ---------- Layout ---------- */
  const isStacked = () => size.h > size.w;
  const box = () => (isStacked() ? { bw: 520, bh: 1280 } : { bw: 1000, bh: 700 });
  const barsAt = () => (isStacked() ? { x: 40, y: 715, w: 440 } : { x: 545, y: 120, w: 430 });
  const tf = () => {
    const { bw, bh } = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const poly = (pts: P[]) => {
    const path = new Path2D();
    pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
    return path;
  };
  const stroke = (pts: P[]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    const cur = done ? null : stage();

    // Body outline
    ctx.fillStyle = 'rgba(230, 185, 150, 0.14)';
    ctx.strokeStyle = 'rgba(200, 145, 110, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(260, 82, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(112, 168, 296, 528, [70, 70, 40, 40]);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(240, 136, 40, 36);

    // Accessory organs (behind the tract)
    const liver = poly(LIVER_SHAPE);
    ctx.fillStyle = 'rgba(150, 70, 55, 0.75)';
    ctx.fill(liver);
    ctx.fillStyle = 'rgba(110, 160, 80, 0.9)';
    ctx.beginPath();
    ctx.ellipse(232, 372, 14, 9, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(235, 200, 140, 0.9)';
    ctx.beginPath();
    ctx.ellipse(300, 434, 58, 10, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(235, 200, 160, 0.9)';
    for (const x of [226, 296]) {
      ctx.beginPath();
      ctx.ellipse(x, 120, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tract tubes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const tubeColour = (s: Stage) => (s === cur ? 'rgba(240, 150, 150, 0.95)' : 'rgba(225, 140, 140, 0.6)');
    for (const s of ['oesophagus', 'small', 'large', 'rectum', 'mouth'] as Stage[]) {
      ctx.strokeStyle = tubeColour(s);
      ctx.lineWidth = TUBE_WIDTH[s];
      stroke(TRACT[s]);
    }
    const stomach = poly(STOMACH_SHAPE);
    ctx.fillStyle = tubeColour('stomach');
    ctx.fill(stomach);
    // Gastric folds
    ctx.strokeStyle = 'rgba(190, 90, 100, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(320, 384, 18 + i * 9, -0.3, 1.6);
      ctx.stroke();
    }
    // Mouth
    ctx.strokeStyle = '#b04a4a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(254, 98, 14, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Bolus
    if (!done) {
      const pts = TRACT[stage()];
      let [bx, by] = along(pts, u);
      let r = 11;
      if (stage() === 'stomach') {
        // churning: wobble around inside the stomach
        bx += Math.sin(time * 5) * 6;
        by += Math.cos(time * 4) * 5;
        r = 15;
      }
      if (stage() === 'small') r = 7;
      if (stage() === 'large' || stage() === 'rectum') r = 10;
      // Peristalsis: a squeeze ring just behind the food
      if (stage() !== 'stomach') {
        const [qx, qy] = along(pts, Math.max(0, u - 0.05));
        ctx.strokeStyle = 'rgba(160, 60, 70, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(qx, qy, TUBE_WIDTH[stage()] * 0.45 + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      const colour = stage() === 'mouth' || stage() === 'oesophagus' ? '#b07a45' : stage() === 'stomach' || stage() === 'small' ? '#d9c272' : '#7a5530';
      ctx.fillStyle = colour;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Enzyme / juice callouts
    if (p.enzymes) {
      const callout = (text: string, x: number, y: number, active: boolean, tx: number, ty: number) => {
        ctx.font = fs(11, 700);
        const tw = ctx.measureText(text).width;
        const ph = 20 / k;
        ctx.strokeStyle = active ? pal.accent : pal['border-strong'];
        ctx.lineWidth = 1.5 / k;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = active ? pal.accent : pal['bg-elev'];
        ctx.globalAlpha = active ? 1 : 0.85;
        ctx.beginPath();
        ctx.roundRect(x - tw / 2 - 6 / k, y - ph / 2, tw + 12 / k, ph, ph / 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = active ? pal['sim-bg'] : pal['sim-text'];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      };
      callout('Saliva: amylase', 420, 110, cur === 'mouth', 300, 118);
      callout('Acid + pepsin', 460, 360, cur === 'stomach', 360, 380);
      callout('Bile', 70, 395, cur === 'small' && u < 0.6, 228, 376);
      callout('Pancreatic enzymes', 450, 435, cur === 'small' && u < 0.6, 355, 432);
      callout('Villi absorb nutrients', 440, 545, cur === 'small', 340, 530);
      callout('Water absorbed', 70, 520, cur === 'large', 160, 520);
    }
    if (p.labels) {
      ctx.font = fs(11, 650);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'center';
      ctx.fillText('Liver', 196, 322);
      ctx.fillText('Stomach', 336, 324);
      ctx.fillText('Oesophagus', 205, 230);
      ctx.fillText('Small intestine', 270, 600);
      ctx.fillText('Large intestine', 452, 640);
      ctx.textAlign = 'left';
    }

    /* Nutrient bars */
    const B = barsAt();
    ctx.fillStyle = pal['sim-text'];
    ctx.font = fs(13, 750);
    ctx.fillText('What has happened to the meal', B.x, B.y - 18);
    const meal = MEALS[p.meal];
    const list = (Object.keys(meal) as Nutrient[]).filter((n) => (meal[n] ?? 0) > 0);
    let y = B.y + 10;
    for (const n of list) {
      const grams = meal[n]!;
      const [bd, ab] = fractions(n);
      ctx.font = fs(12, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(`${NUTRIENT_NAME[n][0]} · ${grams} ${n === 'water' ? 'mL' : 'g'}`, B.x, y);
      const by = y + 8;
      const bh = 22;
      ctx.fillStyle = 'rgba(128,128,128,0.18)';
      ctx.fillRect(B.x, by, B.w, bh);
      // intact (solid), broken down (striped lighter), absorbed (green)
      const col = NUTRIENT_COLOUR[n];
      ctx.fillStyle = col;
      ctx.fillRect(B.x, by, B.w * (1 - bd), bh);
      ctx.globalAlpha = 0.45;
      ctx.fillRect(B.x + B.w * (1 - bd), by, B.w * (bd - ab), bh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.success;
      ctx.fillRect(B.x + B.w * (1 - ab), by, B.w * ab, bh);
      ctx.font = fs(11, 600);
      ctx.fillStyle = pal['text-faint'];
      const note = n === 'water' ? `${Math.round(ab * 100)} % absorbed` : `${Math.round((1 - bd) * 100)} % intact · ${Math.round(ab * 100)} % absorbed as ${NUTRIENT_NAME[n][1]}`;
      ctx.fillText(note, B.x, by + bh + 16 / k);
      y += 58 + 16 / k;
    }
    // Key
    ctx.font = fs(11, 650);
    const keyY = y + 4;
    const items: [string, string, number][] = [['Intact', '#a0a0a0', 1], ['Broken down', '#a0a0a0', 0.45], ['Absorbed', pal.success, 1]];
    let kx = B.x;
    for (const [label, c, a] of items) {
      ctx.globalAlpha = a;
      ctx.fillStyle = c;
      ctx.fillRect(kx, keyY, 14, 14);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal['text-faint'];
      ctx.fillText(label, kx + 20, keyY + 12);
      kx += ctx.measureText(label).width + 44;
    }

    ctx.restore();
    updateReadouts();
  }

  function updateReadouts() {
    const where = done ? 'Left the body' : STAGE_NAME[stage()];
    ui.readout('where', where);
    sim.setBadge(done ? 'Done' : STAGE_NAME[stage()]);
    textEl.textContent = done ? STAGE_TEXT.done : STAGE_TEXT[stage()];
    const hrs = clockHours();
    const H = Math.floor(hrs);
    const M = Math.round((hrs - H) * 60);
    ui.readout('clock', hrs < 1 / 60 ? `${Math.round(hrs * 3600)} seconds` : `${H} h ${M} min`);
    const meal = MEALS[p.meal];
    let kcal = 0;
    for (const n of Object.keys(meal) as Nutrient[]) kcal += (meal[n] ?? 0) * KCAL[n] * fractions(n)[1];
    ui.readout('energy', `${Math.round(kcal)} kcal`, done ? 'ok' : null);
  }

  /* ---------- Click to inspect ---------- */
  const near = (pts: P[], x: number, y: number, r: number) =>
    pts.slice(1).some((b, i) => {
      const a = pts[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < r;
    });
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - r.left - ox) / k;
    const y = (e.clientY - r.top - oy) / k;
    const scaled = (px: number, py: number) => [px * size.dpr * k + ox * size.dpr, py * size.dpr * k + oy * size.dpr] as const;
    const inPath = (path: Path2D) => {
      ctx.save();
      ctx.setTransform(size.dpr * k, 0, 0, size.dpr * k, ox * size.dpr, oy * size.dpr);
      const [sx, sy] = scaled(x, y);
      const hit = ctx.isPointInPath(path, sx, sy);
      ctx.restore();
      return hit;
    };
    let id: string | null = null;
    if (Math.hypot(x - 232, y - 372) < 16) id = 'gallbladder';
    else if (Math.abs(y - 120) < 12 && (Math.abs(x - 226) < 13 || Math.abs(x - 296) < 13)) id = 'salivary';
    else if (Math.hypot(x - 254, y - 100) < 20) id = 'mouth';
    else if (inPath(poly(STOMACH_SHAPE))) id = 'stomach';
    else if (near(TRACT.rectum, x, y, 12)) id = 'rectum';
    else if (near(TRACT.large, x, y, 14)) id = 'large';
    else if (near(TRACT.small, x, y, 10)) id = 'small';
    else if (Math.hypot((x - 300) / 60, (y - 434) / 12) < 1) id = 'pancreas';
    else if (near(TRACT.oesophagus, x, y, 10)) id = 'oesophagus';
    else if (inPath(poly(LIVER_SHAPE))) id = 'liver';
    if (!id) return sim.hideTooltip();
    sim.showTooltip(e.clientX - r.left, e.clientY - r.top, INFO[id][0], INFO[id][1]);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const mealCtl = ui.choice<Meal>('dg-meal', (v) => {
    p.meal = v;
    restart();
    sim.hideOverlay();
    sim.requestRender();
  });
  const speed = ui.range('dg-speed', (v) => `${v}×`, (v) => (p.speed = v));
  const enz = ui.toggle('dg-enzymes', (v) => ((p.enzymes = v), sim.requestRender()));
  const lab = ui.toggle('dg-labels', (v) => ((p.labels = v), sim.requestRender()));

  restart();
  const sim = createSimController(root, {
    step,
    render,
    // Pressing Start after the meal has finished begins a new one
    onPlayChange: (playing) => playing && done && restart(),
    reset() {
      Object.assign(p, { meal: 'balanced', speed: 1, enzymes: true, labels: true });
      mealCtl.set('balanced', false);
      speed.set(1, false);
      enz.set(true, false);
      lab.set(true, false);
      restart();
    },
  });
}
