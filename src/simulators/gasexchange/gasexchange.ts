/**
 * Animal respiratory systems and gas exchange: fish gills, insect tracheae
 * and mammalian lungs. The numbers come from model.ts; this file draws the
 * animals, animates the water or air flow, and runs a particle picture of
 * diffusion across the exchange surface (O₂ and CO₂ molecules random-walk;
 * each side is topped up to the concentration the model gives, so the net
 * flow down each concentration gradient emerges from the random motion).
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';
import { gill, lung, trachea } from './model';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'sim-water', 'surface-2'] as const;
type Fs = (px: number, w?: number) => string;
type Animal = 'fish' | 'insect' | 'mammal';
const O2C = '#e03131';
const CO2C = '#868e96';
const DEF = { animal: 'fish' as Animal, avail: 100, area: 100, thick: 1, length: 1, counter: true, active: false };

interface Mol {
  x: number;
  y: number;
  co2: boolean;
}

export function initGasExchange(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let t = 0;
  let mols: Mol[] = [];
  let flowDots: { u: number; lane: number }[] = Array.from({ length: 60 }, (_, i) => ({ u: Math.random(), lane: i % 3 }));

  /* ---------- Model results ---------- */
  type Res = { kind: 'gill'; r: ReturnType<typeof gill> } | { kind: 'lung'; r: ReturnType<typeof lung> } | { kind: 'trach'; r: ReturnType<typeof trachea> };
  let res: Res;
  let base = 1;
  function compute() {
    const a = st.avail / 100;
    const ar = st.area / 100;
    if (st.animal === 'fish') {
      res = { kind: 'gill', r: gill(st.counter, a, ar, st.thick, st.active) };
      base = gill(true, 1, 1, 1, st.active).uptake;
    } else if (st.animal === 'mammal') {
      res = { kind: 'lung', r: lung(a, ar, st.thick, st.active) };
      base = lung(1, 1, 1, st.active).uptake;
    } else {
      res = { kind: 'trach', r: trachea(a, ar, st.length, st.active) };
      base = 1;
    }
  }
  compute();
  /** Partial pressures on the two sides of the close-up (medium above, blood or cell below), mid-way along. */
  function zoomLevels() {
    if (res.kind === 'gill') {
      const i = Math.floor(res.r.prof.x.length / 2);
      return { top: res.r.prof.medium[i], bottom: res.r.prof.blood[i], co2Top: 2, co2Bottom: 8 };
    }
    if (res.kind === 'lung') {
      const i = Math.floor(res.r.prof.x.length * 0.08);
      return { top: res.r.alveolar, bottom: res.r.prof.blood[i], co2Top: 40, co2Bottom: 46 };
    }
    return { top: Math.max(0, res.r.tip), bottom: Math.max(0, res.r.tip * 0.4), co2Top: 5, co2Bottom: st.active ? 30 : 12 };
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1072] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  type Rect = { x: number; y: number; w: number; h: number };
  const mainR = (): Rect => (portrait() ? { x: 0, y: 0, w: 680, h: 500 } : { x: 0, y: 0, w: 600, h: 600 });
  const zoomR = (): Rect => (portrait() ? { x: 6, y: 505, w: 668, h: 300 } : { x: 610, y: 52, w: 380, h: 280 });
  const fickR = (): Rect => (portrait() ? { x: 6, y: 815, w: 668, h: 252 } : { x: 610, y: 342, w: 380, h: 252 });

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];
  const box2 = (x: number, y: number, w: number, h: number, title: string, text: string) => areas.push({ test: (px, py) => px > x && px < x + w && py > y && py < y + h, title, text: () => text });

  /* ---------- Main views ---------- */
  function drawFish(fs: Fs, k: number, r: Rect) {
    const ox = r.x;
    const oy = r.y + (portrait() ? -40 : 0);
    // head outline
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.08);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.moveTo(ox + 40, oy + 300);
    ctx.quadraticCurveTo(ox + 70, oy + 150, ox + 280, oy + 140);
    ctx.lineTo(ox + 590, oy + 160);
    ctx.lineTo(ox + 590, oy + 470);
    ctx.lineTo(ox + 280, oy + 480);
    ctx.quadraticCurveTo(ox + 70, oy + 460, ox + 40, oy + 300);
    ctx.fill();
    ctx.stroke();
    // mouth and operculum (gill cover) open and close in turn
    const pump = Math.sin(t * 2.4);
    const mouth = 10 + 10 * Math.max(0, pump);
    ctx.fillStyle = pal['sim-bg'];
    ctx.beginPath();
    ctx.ellipse(ox + 46, oy + 300, 14, mouth, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 3 / k;
    ctx.beginPath();
    const flap = 8 * Math.max(0, -pump);
    ctx.moveTo(ox + 330, oy + 170);
    ctx.quadraticCurveTo(ox + 360 + flap, oy + 300, ox + 330, oy + 440);
    ctx.stroke();
    // gill arches with filaments
    for (let a = 0; a < 4; a++) {
      const gx = ox + 200 + a * 30;
      ctx.strokeStyle = pal['text-muted'];
      ctx.lineWidth = 4 / k;
      ctx.beginPath();
      ctx.moveTo(gx, oy + 200);
      ctx.quadraticCurveTo(gx - 20, oy + 300, gx, oy + 400);
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#e64980', 0.7);
      ctx.lineWidth = 1.5 / k;
      for (let f = 0; f < 18; f++) {
        const yy = oy + 210 + f * 10.5;
        const xx = gx - 20 * Math.sin(((yy - oy - 200) / 200) * Math.PI) * 0.75;
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx + 22, yy);
        ctx.stroke();
      }
    }
    // water flow: in at the mouth, over the gills, out under the gill cover
    for (const d of flowDots) {
      const u = d.u;
      const lane = (d.lane - 1) * 50;
      let x: number;
      let y: number;
      if (u < 0.4) (x = ox + 50 + (u / 0.4) * 150), (y = oy + 300 + lane * (u / 0.4));
      else if (u < 0.7) (x = ox + 200 + ((u - 0.4) / 0.3) * 130), (y = oy + 300 + lane);
      else (x = ox + 330 + ((u - 0.7) / 0.3) * 120), (y = oy + 300 + lane + ((u - 0.7) / 0.3) * 120 * Math.sign(lane || 1));
      // water loses oxygen as it passes the gills
      const o2 = u < 0.4 ? 1 : u < 0.7 ? 1 - ((u - 0.4) / 0.3) * (res.kind === 'gill' ? res.r.extraction : 0) : 1 - (res.kind === 'gill' ? res.r.extraction : 0);
      ctx.fillStyle = withAlpha(pal['sim-water'], 0.6);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      // a fixed fraction of the water dots carry an oxygen marker, fewer after the gills
      if (((d.u * 37 + d.lane * 0.37) % 1) < o2 * 0.9 + 0.1 && d.lane !== 1) {
        ctx.fillStyle = O2C;
        ctx.beginPath();
        ctx.arc(x + 4, y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // blood vessels: to the gills (oxygen-poor) and away (oxygen-rich)
    ctx.lineWidth = 6 / k;
    ctx.strokeStyle = '#4c6ef5';
    ctx.beginPath();
    ctx.moveTo(ox + 250, oy + 470);
    ctx.lineTo(ox + 250, oy + 420);
    ctx.stroke();
    ctx.strokeStyle = O2C;
    ctx.beginPath();
    ctx.moveTo(ox + 250, oy + 180);
    ctx.lineTo(ox + 560, oy + 180);
    ctx.stroke();
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText('water in', ox + 60, oy + 250);
    ctx.fillText('water out', ox + 420, oy + 470);
    ctx.fillText('gills', ox + 230, oy + 192);
    ctx.fillText('gill cover', ox + 350, oy + 230);
    ctx.fillText('blood to the body', ox + 400, oy + 172);
    box2(ox + 180, oy + 200, 140, 200, 'Gills', 'Four gill arches on each side carry hundreds of thin filaments, each covered in tiny plates (lamellae) where blood comes within a few micrometres of the water.');
    box2(ox + 25, oy + 270, 50, 60, 'Mouth', 'The fish opens its mouth to draw water in, then closes it and squeezes the water back over the gills. Some fast fish, like tuna, simply swim with their mouths open (ram ventilation).');
    box2(ox + 325, oy + 170, 50, 270, 'Gill cover (operculum)', 'Protects the gills and opens to let water out, keeping the flow over the gills going in one direction.');
  }

  function drawInsect(fs: Fs, k: number, r: Rect) {
    const ox = r.x;
    const oy = r.y + (portrait() ? -20 : 0);
    const pump = st.active ? 1 + 0.06 * Math.sin(t * 9) : 1;
    ctx.save();
    ctx.translate(ox, oy + 320);
    ctx.scale(1, 1);
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.08);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.ellipse(95, 0, 50, 70, 0, 0, Math.PI * 2);
    ctx.moveTo(300, 0);
    ctx.ellipse(215, 0, 85, 110, 0, 0, Math.PI * 2);
    ctx.moveTo(590, 0);
    ctx.ellipse(440, 0, 150, 120 * pump, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // flight muscles
    ctx.fillStyle = withAlpha(pal.danger, 0.14);
    ctx.beginPath();
    ctx.roundRect(ox + 160, oy + 240, 110, 90, 12);
    ctx.fill();
    // spiracles along the side and tracheal tubes branching inwards
    const sp: [number, number][] = [
      [ox + 190, oy + 420],
      [ox + 250, oy + 420],
      [ox + 330, oy + 425],
      [ox + 400, oy + 432 * pump - (pump - 1) * 320],
      [ox + 470, oy + 432 * pump - (pump - 1) * 320],
      [ox + 540, oy + 420],
    ];
    const L = st.length;
    ctx.strokeStyle = withAlpha('#74c0fc', 0.9);
    for (const [sx, sy] of sp) {
      ctx.lineWidth = 6 / k;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy - 60);
      ctx.stroke();
      ctx.lineWidth = 3 / k;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 60);
      ctx.lineTo(sx - 25, sy - 60 - 40 * Math.min(L, 2));
      ctx.moveTo(sx, sy - 60);
      ctx.lineTo(sx + 25, sy - 60 - 40 * Math.min(L, 2));
      ctx.stroke();
      ctx.lineWidth = 1.2 / k;
      ctx.beginPath();
      for (const dx of [-25, 25]) {
        const ex = sx + dx;
        const ey = sy - 60 - 40 * Math.min(L, 2);
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 10, ey - 30);
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + 10, ey - 30);
      }
      ctx.stroke();
      ctx.fillStyle = pal['sim-text'];
      ctx.beginPath();
      ctx.ellipse(sx, sy, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // oxygen moving in along the tubes, carbon dioxide moving out
    const tip = res.kind === 'trach' ? res.r.tip : 150;
    for (const d of flowDots) {
      const [sx, sy] = sp[d.lane * 2 % sp.length];
      const u = d.u;
      const inward = d.lane !== 2;
      const p = inward ? u : 1 - u;
      const x = sx + (d.lane === 0 ? -1 : 1) * 25 * Math.max(0, (p - 0.4) / 0.6);
      const y = sy - p * (60 + 40 * Math.min(L, 2));
      if (inward && p > 0.7 && tip < 20) continue; // oxygen runs out before reaching the tips
      ctx.fillStyle = inward ? O2C : CO2C;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText('spiracles', ox + 180, oy + 456);
    ctx.fillText('tracheae', ox + 360, oy + 300);
    ctx.fillText('flight muscles', ox + 168, oy + 232);
    if (st.active) ctx.fillText('abdomen pumping', ox + 430, oy + 190);
    box2(ox + 170, oy + 400, 400, 40, 'Spiracles', 'Openings along the sides of the body. Valves can close them to save water: an insect’s biggest challenge on land is drying out.');
    box2(ox + 160, oy + 240, 110, 90, 'Flight muscles', 'Flying insect muscle has one of the highest oxygen demands of any tissue. Fine tracheoles run right into the muscle fibres.');
    box2(ox + 300, oy + 260, 260, 140, 'Tracheae and tracheoles', 'Air-filled tubes stiffened with rings of cuticle. They branch into tracheoles less than a micrometre wide that end right next to cells, so oxygen reaches cells without the blood.');
  }

  function drawMammal(fs: Fs, k: number, r: Rect) {
    const ox = r.x + (portrait() ? 40 : 0);
    const oy = r.y + (portrait() ? -30 : 0);
    const breath = (1 - Math.cos(t * 1.6)) / 2; // 0 = breathed out, 1 = breathed in
    const insp = Math.sin(t * 1.6) > 0;
    // chest outline
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.08);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.roundRect(ox + 110 - breath * 12, oy + 190, 380 + breath * 24, 300, 70);
    ctx.fill();
    ctx.stroke();
    // trachea and bronchi
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 16 / k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox + 300, oy + 70);
    ctx.lineTo(ox + 300, oy + 240);
    ctx.moveTo(ox + 300, oy + 240);
    ctx.lineTo(ox + 230, oy + 290);
    ctx.moveTo(ox + 300, oy + 240);
    ctx.lineTo(ox + 370, oy + 290);
    ctx.stroke();
    // lungs
    const lungW = 95 + 14 * breath;
    for (const side of [-1, 1]) {
      const cx = ox + 300 + side * 110;
      ctx.fillStyle = withAlpha('#f783ac', 0.35 + 0.15 * breath);
      ctx.strokeStyle = '#e64980';
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      ctx.ellipse(cx, oy + 340, lungW, 125 + 8 * breath, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // bronchiole tree
      ctx.strokeStyle = withAlpha(pal['text-muted'], 0.7);
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      for (let b = 0; b < 5; b++) {
        const ang = -0.9 + b * 0.45;
        ctx.moveTo(ox + 300 + side * 70, oy + 290);
        ctx.lineTo(cx + side * Math.cos(ang) * 60, oy + 340 + Math.sin(ang) * 80);
      }
      ctx.stroke();
      // alveolar clusters
      for (let b = 0; b < 5; b++) {
        const ang = -0.9 + b * 0.45;
        const ax = cx + side * Math.cos(ang) * 60;
        const ay = oy + 340 + Math.sin(ang) * 80;
        ctx.fillStyle = withAlpha('#f06595', 0.6);
        for (let c = 0; c < 4; c++) {
          ctx.beginPath();
          ctx.arc(ax + Math.cos(c * 1.6) * 7, ay + Math.sin(c * 1.6) * 7, 5 + 1.5 * breath, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // diaphragm moves down when breathing in
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 5 / k;
    ctx.beginPath();
    ctx.moveTo(ox + 140, oy + 480);
    ctx.quadraticCurveTo(ox + 300, oy + 400 + breath * 60, ox + 460, oy + 480);
    ctx.stroke();
    // air moving in and out (tidal flow)
    for (const d of flowDots) {
      const u = insp ? d.u : 1 - d.u;
      const lane = d.lane - 1;
      const x = u < 0.6 ? ox + 300 + lane * 4 : ox + 300 + (lane || 1) * ((u - 0.6) / 0.4) * 110;
      const y = u < 0.6 ? oy + 50 + (u / 0.6) * 190 : oy + 240 + ((u - 0.6) / 0.4) * 100;
      ctx.fillStyle = insp ? O2C : CO2C;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(insp ? 'breathing in ↓' : 'breathing out ↑', ox + 315, oy + (portrait() ? 110 : 70));
    ctx.fillText('trachea', ox + 315, oy + 150);
    ctx.fillText('lungs', ox + 160, oy + 210);
    ctx.fillText('diaphragm', ox + 250, oy + 505);
    box2(ox + 280, oy + 60, 40, 180, 'Trachea and bronchi', 'Tubes held open by rings of cartilage. They carry air in and out; mucus and tiny hairs (cilia) trap and remove dust.');
    box2(ox + 110, oy + 220, 380, 240, 'Lungs and alveoli', 'The bronchi branch about 23 times, ending in roughly 300–500 million alveoli: tiny air sacs with walls one cell thick, wrapped in capillaries. Their total area is about 70 m².');
    box2(ox + 140, oy + 440, 320, 60, 'Diaphragm', 'A sheet of muscle under the lungs. It contracts and flattens to breathe in, enlarging the chest so air flows in. Air flows in and out the same way (tidal breathing).');
  }

  /* ---------- Close-up: diffusion across the barrier ---------- */
  function drawZoom(fs: Fs, k: number) {
    const r = zoomR();
    const lv = zoomLevels();
    const ins = st.animal === 'insect';
    const membraneH = 6 + 8 * (st.thick - 1);
    const mid = r.y + r.h / 2 + 12;
    const top = { y0: r.y + 40, y1: mid - membraneH / 2 };
    const bot = { y0: mid + membraneH / 2, y1: r.y + r.h - 34 };
    ctx.fillStyle = pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.fillStyle = st.animal === 'fish' ? withAlpha(pal['sim-water'], 0.15) : withAlpha(pal['text-faint'], 0.08);
    ctx.fillRect(r.x + 8, top.y0, r.w - 16, top.y1 - top.y0);
    ctx.fillStyle = ins ? withAlpha(pal.danger, 0.1) : withAlpha('#c92a2a', 0.12);
    ctx.fillRect(r.x + 8, bot.y0, r.w - 16, bot.y1 - bot.y0);
    ctx.fillStyle = withAlpha(pal['text-muted'], 0.45);
    ctx.fillRect(r.x + 8, top.y1, r.w - 16, membraneH);
    // red blood cells: most of the blood's oxygen is bound to haemoglobin inside them, not dissolved
    if (!ins) {
      const sat = res.kind === 'gill' ? (res.r.satIn + res.r.satOut) / 2 : res.kind === 'lung' ? res.r.satOut : 0;
      const dir = st.animal === 'fish' && st.counter ? -1 : 1;
      for (let i = 0; i < 7; i++) {
        const u = ((((i / 7 + dir * t * 0.08) % 1) + 1) % 1);
        const x = r.x + 20 + u * (r.w - 40);
        const y = (bot.y0 + bot.y1) / 2 + Math.sin(i * 2.3) * (bot.y1 - bot.y0) * 0.18;
        const f = clamp((sat - 0.3) / 0.67, 0, 1);
        ctx.fillStyle = `rgba(${Math.round(90 + 134 * f)}, ${Math.round(70 - 30 * f)}, ${Math.round(160 - 120 * f)}, 0.75)`;
        ctx.beginPath();
        ctx.ellipse(x, y, 13, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // molecules
    for (const m of mols) {
      ctx.fillStyle = m.co2 ? CO2C : O2C;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.co2 ? 3.2 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(ins ? 'Close-up: tracheole tip and muscle cell' : st.animal === 'fish' ? 'Close-up: one gill lamella' : 'Close-up: alveolus and capillary', r.x + 12, r.y + 22);
    ctx.font = fs(10, 650);
    ctx.fillStyle = pal['text-muted'];
    ctx.fillText(ins ? 'air in the tracheole' : st.animal === 'fish' ? 'water' : 'air in the alveolus', r.x + 14, top.y0 + 14);
    ctx.fillText(ins ? 'muscle cell (uses O₂, makes CO₂)' : 'blood (most O₂ rides inside red cells)', r.x + 14, bot.y1 - 6);
    // flow arrows
    if (!ins) {
      const dirW = 1;
      const dirB = st.animal === 'fish' && st.counter ? -1 : 1;
      arrowLine(r.x + r.w - 90, top.y0 + 10, dirW, st.animal === 'fish' ? 'water flow' : '', fs, k);
      arrowLine(r.x + r.w - 90, bot.y1 - 10, dirB, 'blood flow', fs, k);
    }
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'right';
    ctx.fillText(`barrier ×${st.thick.toFixed(1)}`, r.x + r.w - 12, top.y1 - 3);
    areas.push({ test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: 'Diffusion across the exchange surface', text: () => `Red dots are oxygen, grey dots carbon dioxide. Each molecule wanders randomly, but because there are more oxygen molecules ${ins ? 'in the air tube than in the cell' : 'on the outside than in the blood'}, more cross one way than the other: diffusion down a concentration gradient. Partial pressure of O₂ here: ${Math.round(lv.top)} mmHg outside, ${Math.round(lv.bottom)} mmHg inside.` });
  }
  function arrowLine(x: number, y: number, dir: number, label: string, fs: Fs, k: number) {
    ctx.strokeStyle = pal['sim-text'];
    ctx.fillStyle = pal['sim-text'];
    ctx.lineWidth = 2 / k;
    const x0 = x;
    const x1 = x + 60;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const tipX = dir > 0 ? x1 : x0;
    ctx.beginPath();
    ctx.moveTo(tipX + dir * 6, y);
    ctx.lineTo(tipX - dir * 4, y - 5);
    ctx.lineTo(tipX - dir * 4, y + 5);
    ctx.fill();
    if (label) {
      ctx.font = fs(9, 650);
      ctx.textAlign = 'right';
      ctx.fillText(label, x0 - 6, y + 3);
    }
  }
  function stepMols(dt: number) {
    const r = zoomR();
    const lv = zoomLevels();
    const membraneH = 6 + 8 * (st.thick - 1);
    const mid = r.y + r.h / 2 + 12;
    const yTop0 = r.y + 40;
    const yM0 = mid - membraneH / 2;
    const yM1 = mid + membraneH / 2;
    const yBot1 = r.y + r.h - 34;
    const x0 = r.x + 10;
    const x1 = r.x + r.w - 10;
    const ins = st.animal === 'insect';
    const flowB = ins ? 0 : (st.animal === 'fish' && st.counter ? -1 : 1) * 40;
    const flowT = st.animal === 'fish' ? 40 : 0;
    const area = (x1 - x0) * (yM0 - yTop0);
    // target counts on each side from the partial pressures (0.12 molecules per mmHg per 10,000 px²)
    const want = (p: number) => Math.round((p * 0.12 * area) / 10000);
    const top = mols.filter((m) => m.y < yM0);
    const bottom = mols.filter((m) => m.y > yM1);
    for (const [co2, side, target] of [
      [false, top, want(lv.top)],
      [false, bottom, want(lv.bottom)],
      [true, top, want(lv.co2Top)],
      [true, bottom, want(lv.co2Bottom)],
    ] as const) {
      const list = side.filter((m) => m.co2 === co2);
      const isTop = side === top;
      // the flowing medium (or the muscle cell's metabolism) slowly resets each side towards its target
      if (list.length < target && Math.random() < dt * 12) mols.push({ x: x0 + Math.random() * (x1 - x0), y: isTop ? yTop0 + Math.random() * (yM0 - yTop0) : yM1 + Math.random() * (yBot1 - yM1), co2 });
      if (list.length > target + 2 && Math.random() < dt * 12) mols.splice(mols.indexOf(list[Math.floor(Math.random() * list.length)]), 1);
    }
    const D = 90;
    const pm = 1 / st.thick; // a thicker barrier is harder to cross
    for (const m of mols) {
      let nx = m.x + (Math.random() - 0.5) * D * 2 * dt;
      let ny = m.y + (Math.random() - 0.5) * D * 2 * dt;
      if (ny < yM0) nx += flowT * dt;
      else if (ny > yM1) nx += flowB * dt;
      // crossing the barrier is slower
      if (ny >= yM0 && ny <= yM1 && Math.random() > pm) ny = m.y;
      if (nx < x0) nx += x1 - x0;
      if (nx > x1) nx -= x1 - x0;
      m.x = nx;
      m.y = clamp(ny, yTop0, yBot1);
    }
    if (mols.length > 500) mols.splice(0, mols.length - 500);
  }

  /* ---------- Fick's law panel ---------- */
  function drawFick(fs: Fs, k: number) {
    const r = fickR();
    ctx.fillStyle = pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText('Fick’s law: rate ∝ area × gradient ÷ thickness', r.x + 12, r.y + 22);
    const lv = zoomLevels();
    const grad = st.animal === 'insect' ? (res.kind === 'trach' ? res.r.air - Math.max(0, res.r.tip) : 0) : lv.top - lv.bottom;
    const bars: [string, number, number, string][] = [
      ['Surface area', st.area / 100, 1.5, pal.accent],
      [st.animal === 'insect' ? 'Diffusion distance' : 'Barrier thickness', st.animal === 'insect' ? st.length : st.thick, st.animal === 'insect' ? 6 : 5, pal['text-muted']],
      ['O₂ available', st.avail / 100, 1.6, pal['sim-water']],
      ['O₂ uptake', uptakeRel(), 1.6, pal.danger],
    ];
    const lx = portrait() ? 220 : 138; // where the bars start, leaving room for the labels
    const bw = r.w - lx - 12;
    let y = r.y + 30 + 18 / k;
    for (const [label, v, max, col] of bars) {
      ctx.font = fs(10, 650);
      ctx.fillStyle = pal['text-muted'];
      ctx.textAlign = 'left';
      ctx.fillText(label, r.x + 12, y + 10);
      ctx.fillStyle = pal.border;
      ctx.fillRect(r.x + lx, y, bw, 12);
      ctx.fillStyle = col;
      ctx.fillRect(r.x + lx, y, (bw * clamp(v, 0, max)) / max, 12);
      y += 16 / k + 6;
    }
    ctx.font = fs(10, 600);
    ctx.fillStyle = pal['text-faint'];
    wrap(st.animal === 'fish' ? `Water holds about 30 times less oxygen than air, so gills must work hard: they remove ${Math.round((res.kind === 'gill' ? res.r.extraction : 0) * 100)}% of the oxygen from the water.` : st.animal === 'mammal' ? `Gradient across the barrier: about ${Math.round(Math.max(0, grad))} mmHg where blood enters the alveolar capillaries.` : 'Insects rely on diffusion along air-filled tubes, which is fast in air but only over short distances.', r.x + 12, y + 8, r.w - 24, 14 / k);
    areas.push({ test: (x, yy) => x > r.x && x < r.x + r.w && yy > r.y && yy < r.y + r.h, title: 'Fick’s law', text: () => 'The rate of diffusion increases with a larger surface area and a steeper concentration (or partial-pressure) gradient, and decreases with a thicker barrier. Respiratory surfaces are large, thin and moist, and breathing and blood flow keep the gradient steep.' });
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
  }
  function uptakeRel() {
    if (res.kind === 'trach') {
      // the muscles' supply starts to fall once the oxygen left at the tracheole tips drops below about 20 mmHg
      return clamp(res.r.tip / 20, 0, 1);
    }
    return base > 0 ? res.r.uptake / base : 0;
  }

  /* ---------- Render ---------- */
  function step(dt: number) {
    t += dt;
    const speed = st.animal === 'mammal' ? 0.35 : st.active ? 0.5 : 0.25;
    for (const d of flowDots) d.u = (d.u + dt * speed * (0.8 + d.lane * 0.15)) % 1;
    stepMols(dt);
  }
  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    if (hintEl) hintEl.style.display = 'none';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    const m = mainR();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.x, m.y, m.w, m.h);
    ctx.clip();
    if (st.animal === 'fish') drawFish(fs, k, m);
    else if (st.animal === 'insect') drawInsect(fs, k, m);
    else drawMammal(fs, k, m);
    ctx.restore();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['text-muted'];
    ctx.textAlign = 'left';
    ctx.fillText({ fish: 'Fish (trout): gills · schematic', insect: 'Insect (grasshopper): tracheal system · schematic', mammal: 'Mammal: lungs · schematic' }[st.animal], 12, 20);
    drawZoom(fs, k);
    drawFick(fs, k);
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts, note and graph ---------- */
  let lastNote = '';
  function updateUi() {
    const a = st.avail / 100;
    ui.readout('medium', st.animal === 'fish' ? `Water: about ${(7 * a).toFixed(1)} mL O₂ per litre` : `Air: about ${Math.round(210 * a)} mL O₂ per litre`);
    if (res.kind === 'gill') {
      ui.readout('out', `${Math.round(res.r.satOut * 100)}% saturated`, res.r.satOut < 0.75 ? 'warn' : null);
      ui.readout('extra', `${Math.round(res.r.extraction * 100)}% of the oxygen in the water`);
    } else if (res.kind === 'lung') {
      ui.readout('out', `${Math.round(res.r.satOut * 100)}% saturated`, res.r.satOut < 0.9 ? 'warn' : null);
      ui.readout('extra', `PO₂ in alveoli about ${Math.round(res.r.alveolar)} mmHg`);
    } else {
      ui.readout('out', res.r.ok ? `about ${Math.round(res.r.tip)} mmHg PO₂ at the tracheole tips` : 'Oxygen runs out before the tips!', res.r.ok ? null : 'bad');
      ui.readout('extra', `PO₂ of the outside air about ${Math.round(res.r.air)} mmHg`);
    }
    ui.readout('uptake', `${Math.round(uptakeRel() * 100)}% of normal`, uptakeRel() < 0.7 ? 'warn' : null);
    ui.readout('surface', { fish: 'Gill lamellae: thin, folded; barrier a few micrometres', insect: 'Tracheoles: < 1 µm wide, ending beside the cells', mammal: 'About 70 m² of alveoli (human); barrier ≈ 0.5 µm' }[st.animal]);
    sim.setBadge(st.active ? (st.animal === 'insect' ? 'Flying' : 'Active') : 'Resting');
    let note: string;
    if (st.animal === 'fish')
      note = st.counter
        ? 'Countercurrent flow: water and blood move in opposite directions along each lamella, so blood always meets water with a little more oxygen than itself. The gradient stays steep all the way along, and the blood leaves almost as oxygenated as the incoming water.'
        : 'Parallel flow (an imaginary fish): water and blood move the same way, so their oxygen levels quickly even out and exchange stops halfway. Compare the uptake with countercurrent flow.';
    else if (st.animal === 'insect')
      note = res.kind === 'trach' && !res.r.ok
        ? 'With these settings oxygen cannot diffuse far enough down the tracheae to supply the muscles. This is one reason insects are small: diffusion only works over short distances. (Some giant insects lived 300 million years ago, when the air had more oxygen.)'
        : st.active
          ? 'Flying multiplies the muscles’ oxygen demand. Insects pump air through their main tracheae by squeezing the abdomen, so diffusion only has to cover the last tiny distance.'
          : 'At rest, oxygen simply diffuses from the spiracles down the tracheae to the cells, and carbon dioxide diffuses out. No blood is needed to carry it.';
    else note = 'Air flows in and out the same way (tidal breathing), so the lungs always hold some stale air. Oxygen diffuses from the alveoli into the blood across a barrier only about half a micrometre thick; carbon dioxide diffuses the other way.';
    if (note !== lastNote) noteEl.textContent = lastNote = note;
    canvas.setAttribute('aria-label', `${st.animal} gas exchange. Oxygen uptake ${Math.round(uptakeRel() * 100)} percent of normal.`);
  }
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="gx-graph"]')!, { x: { min: 0, span: 1 }, y: { min: 0, max: 200, step: 50 } });
  const gTitle = root.querySelector<HTMLElement>('#gx-graph-title')!;
  function drawGraph() {
    const prof = res.r.prof;
    const pts = (ys: number[]): Point[] => prof.x.map((x, i) => ({ x: x * 100, y: ys[i] }));
    graph.clear();
    graph.opts = { x: { min: 0, span: 100, max: 100, step: 25, format: (v) => `${v}%` }, y: { min: 0, max: 200, step: 50, format: (v) => `${v}` } };
    if (res.kind === 'gill') {
      gTitle.textContent = `Oxygen partial pressure along a gill lamella (${st.counter ? 'countercurrent' : 'parallel'} flow), mmHg`;
      graph.set('m', { label: st.counter ? 'Water (flowing right to left)' : 'Water (flowing left to right)', color: 'sim-water', points: pts(prof.medium), width: 2.4 });
      graph.set('b', { label: 'Blood (flowing left to right)', color: 'danger', points: pts(prof.blood), width: 2.4 });
    } else if (res.kind === 'lung') {
      gTitle.textContent = 'Oxygen partial pressure along a lung capillary, mmHg';
      graph.set('m', { label: 'Air in the alveolus', color: 'sim-water', points: pts(prof.medium), width: 2.4 });
      graph.set('b', { label: 'Blood', color: 'danger', points: pts(prof.blood), width: 2.4 });
    } else {
      gTitle.textContent = 'Oxygen partial pressure from the spiracle to the tissue, mmHg';
      graph.set('m', { label: 'Air in the tracheal system', color: 'sim-water', points: pts(prof.medium), width: 2.4 });
    }
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="gx-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const update = () => {
    compute();
    drawGraph();
    sim.requestRender();
  };
  const showFor = (a: Animal) => {
    ui.showWhen('[data-only="fish"]', a === 'fish');
    ui.showWhen('[data-only="insect"]', a === 'insect');
    ui.showWhen('[data-only="barrier"]', a !== 'insect');
    const lbl = root.querySelector<HTMLElement>('[data-active-label]');
    if (lbl) lbl.textContent = a === 'insect' ? 'Flying (high oxygen demand)' : 'Active (exercise: faster blood flow)';
  };
  const animalCtl = ui.choice<Animal>('gx-animal', (v) => {
    st.animal = v;
    mols = [];
    showFor(v);
    sim.hideTooltip();
    update();
  });
  const availCtl = ui.range('gx-avail', (v) => `${v}% of normal`, (v) => ((st.avail = v), update()));
  const areaCtl = ui.range('gx-area', (v) => `${v}% of normal`, (v) => ((st.area = v), update()));
  const thickCtl = ui.range('gx-thick', (v) => `${v.toFixed(1)} × normal`, (v) => ((st.thick = v), update()));
  const lenCtl = ui.range('gx-len', (v) => `${v.toFixed(1)} × a grasshopper`, (v) => ((st.length = v), update()));
  const flowCtl = ui.choice<'counter' | 'parallel'>('gx-flow', (v) => ((st.counter = v === 'counter'), update()));
  const actCtl = ui.toggle('gx-active', (v) => ((st.active = v), update()));

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const a = [...areas].reverse().find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      animalCtl.set(DEF.animal, false);
      availCtl.set(DEF.avail, false);
      areaCtl.set(DEF.area, false);
      thickCtl.set(DEF.thick, false);
      lenCtl.set(DEF.length, false);
      flowCtl.set('counter', false);
      actCtl.set(false, false);
      mols = [];
      showFor(DEF.animal);
      compute();
      drawGraph();
    },
  });
  showFor(DEF.animal);
  drawGraph();
}
