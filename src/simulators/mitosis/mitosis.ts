/**
 * Mitosis and the cell cycle: two views.
 *   cycle   – one animal cell through G1, S, G2, prophase, metaphase, anaphase,
 *             telophase and cytokinesis, with chromosomes (warm = from the
 *             mother, cool = from the father), centrosomes, spindle fibres and
 *             nuclear envelope; a cell-cycle wheel; DNA and chromosome counts
 *   compare – mitosis vs meiosis: two identical diploid cells vs four
 *             genetically different haploid cells
 *
 * Every stage gets the same animation time so each can be seen clearly; the
 * wheel shows typical real proportions (human cell: G1 ≈ 11 h, S ≈ 8 h,
 * G2 ≈ 4 h, M ≈ 1 h). An optional "mistake" makes one chromosome fail to
 * separate in anaphase (non-disjunction), giving daughters with 2n + 1 and 2n − 1.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'cycle' | 'compare';
type Fs = (px: number, w?: number) => string;
type V2 = [number, number];

export const STAGES = [
  { key: 'G1', name: 'G1 phase', part: 'Interphase', text: 'The cell grows, makes proteins and organelles and does its normal job. Its DNA is spread out as thin chromatin inside the nucleus, so genes can be read.' },
  { key: 'S', name: 'S phase', part: 'Interphase', text: 'DNA replication: every chromosome is copied, so each now consists of two identical sister chromatids. The centrosome is duplicated too.' },
  { key: 'G2', name: 'G2 phase', part: 'Interphase', text: 'The cell keeps growing and checks that its DNA has been copied correctly before it commits to dividing.' },
  { key: 'Pro', name: 'Prophase', part: 'Mitosis', text: 'Chromatin coils into short, thick chromosomes, each made of two sister chromatids joined at a centromere. The nucleolus disappears and the centrosomes move apart, building the spindle. Late in prophase (prometaphase) the nuclear envelope breaks down and spindle fibres attach to the kinetochores.' },
  { key: 'Meta', name: 'Metaphase', part: 'Mitosis', text: 'Spindle fibres from opposite poles pull on every chromosome until they all line up across the middle of the cell, on the metaphase plate. A checkpoint makes sure every chromosome is attached to both poles before division continues.' },
  { key: 'Ana', name: 'Anaphase', part: 'Mitosis', text: 'The centromeres split and the sister chromatids are pulled to opposite poles. Each separated chromatid now counts as a chromosome, so for a moment the cell holds twice the usual number. The cell lengthens.' },
  { key: 'Telo', name: 'Telophase', part: 'Mitosis', text: 'A complete set of chromosomes reaches each pole and starts to uncoil. A new nuclear envelope forms around each set, nucleoli reappear and the spindle breaks down.' },
  { key: 'Cyto', name: 'Cytokinesis', part: 'Cell division', text: 'A ring of actin and myosin pinches the membrane inward, forming a cleavage furrow, until the cell splits into two daughter cells. It usually begins during late anaphase or telophase. Each daughter has the same chromosomes as the parent.' },
];
/** Moment shown when stepping to a stage while paused. */
const KEY_U = [0.5, 0.65, 0.5, 0.85, 0.9, 0.65, 0.7, 1];
const WHEEL: [string, number, string][] = [
  ['G1', 11, '#5fbf6a'],
  ['S', 8, '#4c8dd6'],
  ['G2', 4, '#e0a43a'],
  ['M', 1, '#e8584c'],
];

const MAT = ['#e76f51', '#f4a261', '#e9c46a'];
const PAT = ['#4c8dd6', '#7b6cd9', '#2a9d8f'];
const LENGTHS = [58, 44, 32];

interface Chrom {
  pair: number;
  mat: boolean;
  colour: string;
  len: number;
  terr: V2; // territory in the interphase nucleus
  angle: number; // orientation when it first condenses
  phase: number[]; // random phases for the chromatin squiggle
}

const INFO: Record<string, [string, string]> = {
  membrane: ['Cell membrane', 'Surrounds the cell. In cytokinesis a ring of actin and myosin just inside it contracts to pinch the cell in two.'],
  cytoplasm: ['Cytoplasm', 'Contains the organelles. It is shared between the two daughter cells during cytokinesis.'],
  nucleus: ['Nucleus', 'Holds the chromosomes. Between divisions the DNA is spread out as chromatin so its genes can be used.'],
  envelope: ['Nuclear envelope', 'The double membrane around the nucleus. It breaks down at the end of prophase so spindle fibres can reach the chromosomes, and re-forms in telophase.'],
  nucleolus: ['Nucleolus', 'Makes ribosomes. It disappears during prophase and reappears in telophase.'],
  centrosome: ['Centrosome', 'Organises microtubules. It is copied in S phase; the two centrosomes move to opposite poles and build the spindle. In animal cells each contains a pair of centrioles.'],
  spindle: ['Spindle fibres', 'Microtubules that grow from the centrosomes. Some attach to the kinetochore at each centromere and pull the sister chromatids apart; others push the poles apart.'],
  furrow: ['Cleavage furrow', 'The groove where the membrane is pinched inward during cytokinesis in animal cells. (Plant cells build a cell plate instead.)'],
  plate: ['Metaphase plate', 'The imaginary plane across the middle of the cell where chromosomes line up in metaphase.'],
};

export function initMitosis(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const graphPanel = root.querySelector<HTMLElement>('[data-graph-panel]')!;
  const stageLabel = root.querySelector<HTMLElement>('[data-stage-label]')!;
  const stageText = root.querySelector<HTMLElement>('[data-stage-text]')!;

  const DEF = { view: 'cycle' as View, stage: 0, u: 0.5, pairs: 2, error: false, labels: true, speed: 1 };
  const st = { ...DEF };
  let anim = 0;

  /* ---------- Chromosomes ---------- */
  let chroms: Chrom[] = [];
  function makeChroms() {
    chroms = [];
    const n = st.pairs * 2;
    for (let i = 0; i < n; i++) {
      const pair = Math.floor(i / 2);
      const mat = i % 2 === 0;
      const a = (i / n) * Math.PI * 2 + 0.4;
      const r = 44 + (i % 3) * 8;
      chroms.push({
        pair,
        mat,
        colour: mat ? MAT[pair] : PAT[pair],
        len: LENGTHS[pair],
        terr: [Math.cos(a) * r, Math.sin(a) * r * 0.85],
        angle: a * 1.7,
        phase: [i * 1.3, i * 2.1 + 0.5, i * 0.7 + 1.1],
      });
    }
  }
  makeChroms();

  /* ---------- Layout ---------- */
  const CX = 330;
  const CY = 300;
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => {
    const tall = portrait();
    if (st.view === 'cycle') return tall ? [0, 90, 660, 800] : [0, 30, 1000, 600];
    return tall ? [0, 30, 700, 630] : [0, 30, 1000, 630];
  };
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  const panelAt = () => (portrait() ? { x: 20, y: 520 } : { x: 670, y: 105 });

  /* ---------- Hit regions (rebuilt every frame) ---------- */
  interface Hit {
    id: string;
    test: (x: number, y: number) => boolean;
    title?: string;
    text?: string;
  }
  let hits: Hit[] = [];
  const segDist = (x: number, y: number, a: V2, b: V2) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };

  /* ---------- Drawing helpers ---------- */
  function tag(text: string, x: number, y: number, fs: Fs, k: number) {
    ctx.font = fs(11, 700);
    const tw = ctx.measureText(text).width;
    const ph = 20 / k;
    ctx.globalAlpha = 0.92;
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
  function lead(x1: number, y1: number, x2: number, y2: number, k: number) {
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1 / k;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const ease = (t: number) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lerp2 = (a: V2, b: V2, t: number): V2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  /** Thin chromatin thread around a centre. */
  function chromatin(c: Chrom, cx: number, cy: number, alpha: number, scale = 1, offset = 0) {
    if (alpha <= 0.01) return;
    ctx.strokeStyle = c.colour;
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let j = 0; j <= 48; j++) {
      const t = j / 48;
      const [p0, p1, p2] = c.phase;
      const x = cx + offset + scale * (20 * Math.sin(Math.PI * 2 * t * 1.3 + p0) + 7 * Math.sin(Math.PI * 2 * t * 5 + p1));
      const y = cy + offset + scale * (18 * Math.cos(Math.PI * 2 * t * 0.9 + p0) + 7 * Math.cos(Math.PI * 2 * t * 4.3 + p2));
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  /** A duplicated chromosome: two sister chromatids joined at the centromere. */
  function xChrom(c: Chrom, at: V2, angle: number, L: number, alpha: number, idx: number, stageName: string) {
    if (alpha <= 0.01) return;
    const d: V2 = [Math.cos(angle), Math.sin(angle)];
    const p: V2 = [-d[1], d[0]];
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c.colour;
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    const segs: [V2, V2][] = [];
    for (const s of [-1, 1]) {
      const a: V2 = [at[0] - d[0] * L / 2 + p[0] * s * 7, at[1] - d[1] * L / 2 + p[1] * s * 7];
      const b: V2 = [at[0] + d[0] * L / 2 + p[0] * s * 7, at[1] + d[1] * L / 2 + p[1] * s * 7];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(at[0] + p[0] * s * 1.5, at[1] + p[1] * s * 1.5, b[0], b[1]);
      ctx.stroke();
      segs.push([a, at], [at, b]);
    }
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(at[0], at[1], 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
    addChromHit(c, idx, segs, stageName, true);
  }
  /** A single chromatid pulled by its centromere (V shape trailing behind). */
  function vChrom(c: Chrom, at: V2, back: number, spread: number, L: number, alpha: number, idx: number, stageName: string) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c.colour;
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    const segs: [V2, V2][] = [];
    for (const s of [-1, 1]) {
      const end: V2 = [at[0] + back * Math.cos(spread) * L / 2, at[1] + s * Math.sin(spread) * L / 2];
      ctx.beginPath();
      ctx.moveTo(at[0], at[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      segs.push([at, end]);
    }
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(at[0], at[1], 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
    addChromHit(c, idx, segs, stageName, false);
  }
  function addChromHit(c: Chrom, idx: number, segs: [V2, V2][], stageName: string, duplicated: boolean) {
    const who = c.mat ? 'mother' : 'father';
    const title = `Chromosome ${c.pair + 1} (from the ${who})`;
    const text = duplicated
      ? `${stageName}: two identical sister chromatids joined at the centromere, where the kinetochore attaches to spindle fibres. Its homologue, the same size in the other colour, came from the ${c.mat ? 'father' : 'mother'}.`
      : `${stageName}: one chromatid, now counted as a chromosome of its own. An identical copy is going to the other daughter cell.`;
    hits.push({ id: `chrom${idx}`, test: (x, y) => segs.some(([a, b]) => segDist(x, y, a, b) < 7), title, text });
  }
  function centrosome(x: number, y: number) {
    ctx.fillStyle = '#5c677d';
    ctx.save();
    ctx.translate(x, y);
    ctx.fillRect(-7, -3, 14, 6);
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-1, -3, 14, 6);
    ctx.restore();
    hits.push({ id: 'centrosome', test: (px, py) => Math.hypot(px - x, py - y) < 14 });
  }
  function aster(x: number, y: number, alpha: number) {
    if (alpha <= 0.01) return;
    ctx.strokeStyle = '#8fa3bf';
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      ctx.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function fibre(a: V2, b: V2, alpha: number) {
    if (alpha <= 0.01) return;
    ctx.strokeStyle = '#8fa3bf';
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.globalAlpha = 1;
    hits.push({ id: 'spindle', test: (x, y) => segDist(x, y, a, b) < 4 });
  }
  /** Cell outline: an ellipse with a pinched waist, or two separate cells. */
  function cellPath(rx: number, ry: number, pinch: number, split: number) {
    const path = new Path2D();
    if (split > 0) {
      const d = lerp(118, 132, split);
      const r = lerp(112, 118, split);
      path.ellipse(CX - d, CY, r, r, 0, 0, Math.PI * 2);
      path.moveTo(CX + d + r, CY);
      path.ellipse(CX + d, CY, r, r, 0, 0, Math.PI * 2);
      return path;
    }
    for (let j = 0; j <= 160; j++) {
      const th = (j / 160) * Math.PI * 2;
      const s = Math.sin(th);
      const x = CX + rx * Math.cos(th);
      const y = CY + ry * s * (1 - pinch * Math.pow(Math.abs(s), 8) * 0.98);
      if (j) path.lineTo(x, y);
      else path.moveTo(x, y);
    }
    path.closePath();
    return path;
  }

  /* ---------- Cycle view ---------- */
  function drawCycle(fs: Fs, k: number) {
    const s = st.stage;
    const u = st.u;
    const name = STAGES[s].name;
    const n = chroms.length;
    const fit = Math.min(1, (0.85 * Math.min(50, 200 / (n - 1))) / LENGTHS[0]);
    const spacing = Math.min(50, 200 / (n - 1));
    const plateY = (i: number) => CY + (i - (n - 1) / 2) * spacing;
    const poleL: V2 = [CX - 165, CY];
    const poleR: V2 = [CX + 165, CY];

    // cell size and shape
    let rx = 182;
    let ry = 182;
    let pinch = 0;
    let split = 0;
    if (s === 0) rx = ry = lerp(152, 170, u);
    else if (s === 1) rx = ry = 170;
    else if (s === 2) rx = ry = lerp(170, 182, u);
    else if (s === 5) {
      rx = 182 + 50 * ease(u);
      ry = 182 - 22 * ease(u);
    } else if (s >= 6) {
      rx = 232;
      ry = 160;
      pinch = s === 6 ? 0.35 * ease(u) : lerp(0.35, 1, ease(u / 0.85));
      if (s === 7 && u > 0.85) split = (u - 0.85) / 0.15;
    }
    const body = cellPath(rx, ry, pinch, split);
    ctx.fillStyle = 'rgba(120, 170, 220, 0.13)';
    ctx.fill(body);
    ctx.strokeStyle = '#6aa7d8';
    ctx.lineWidth = 4;
    ctx.stroke(body);
    lastBody = body;
    hits.push({ id: 'cytoplasm', test: (x, y) => inBody(x, y, false) });

    const nucR = 98;
    // interphase nucleus
    if (s <= 3) {
      const envAlpha = s < 3 ? 1 : 1 - ease((u - 0.6) / 0.35);
      if (envAlpha > 0.02) {
        ctx.fillStyle = `rgba(123, 108, 217, ${0.12 * envAlpha})`;
        ctx.strokeStyle = '#7b6cd9';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = envAlpha;
        if (s === 3 && u > 0.6) ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(CX, CY, nucR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        hits.push({ id: 'envelope', test: (x, y) => Math.abs(Math.hypot(x - CX, y - CY) - nucR) < 6 });
        hits.push({ id: 'nucleus', test: (x, y) => Math.hypot(x - CX, y - CY) < nucR - 6 });
      }
      const nucleolus = s < 3 ? 1 : 1 - ease(u / 0.5);
      if (nucleolus > 0.02) {
        ctx.fillStyle = `rgba(80, 60, 140, ${0.75 * nucleolus})`;
        ctx.beginPath();
        ctx.arc(CX + 30, CY - 28, 16, 0, Math.PI * 2);
        ctx.fill();
        hits.push({ id: 'nucleolus', test: (x, y) => Math.hypot(x - CX - 30, y - CY + 28) < 16 });
      }
    }

    // centrosomes and spindle
    let cL: V2 = [CX - 12, CY - nucR - 22];
    let cR: V2 = [CX + 12, CY - nucR - 22];
    let spindle = 0;
    if (s === 0) cL = cR = [CX, CY - nucR - 22];
    else if (s === 1) cR = lerp2([CX, CY - nucR - 22], cR, ease(u));
    else if (s === 3) {
      cL = lerp2(cL, poleL, ease(u / 0.7));
      cR = lerp2(cR, poleR, ease(u / 0.7));
      spindle = ease((u - 0.2) / 0.5);
    } else if (s >= 4) {
      const out = s === 5 ? 45 * ease(u) : s >= 6 ? 45 : 0;
      cL = [poleL[0] - out, CY];
      cR = [poleR[0] + out, CY];
      spindle = s <= 5 ? 1 : s === 6 ? 1 - ease(u) : 0;
      if (s === 7) {
        cL = [CX - 190, CY - 40];
        cR = [CX + 190, CY - 40];
      }
    }
    aster(cL[0], cL[1], spindle);
    aster(cR[0], cR[1], spindle);
    // polar fibres
    if (spindle > 0.01 && s >= 3) {
      for (const dy of [-60, -25, 25, 60]) {
        ctx.strokeStyle = '#8fa3bf';
        ctx.globalAlpha = spindle * 0.5;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cL[0], cL[1]);
        ctx.quadraticCurveTo(CX, CY + dy * 1.6, cR[0], cR[1]);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // chromosomes
    const attach = s === 3 ? ease((u - 0.65) / 0.35) : s >= 4 && s <= 5 ? 1 : 0;
    chroms.forEach((c, i) => {
      const terr: V2 = [CX + c.terr[0], CY + c.terr[1]];
      const L = c.len * fit;
      const plate: V2 = [CX, plateY(i)];
      if (s <= 2) {
        chromatin(c, terr[0], terr[1], 1);
        const copy = s === 0 ? 0 : s === 1 ? ease(u) : 1;
        chromatin(c, terr[0], terr[1], copy, 1, 3);
        hits.push({
          id: `chrom${i}`,
          test: (x, y) => Math.hypot(x - terr[0], y - terr[1]) < 26,
          title: `Chromosome ${c.pair + 1} (from the ${c.mat ? 'mother' : 'father'})`,
          text: s === 0 ? 'Uncoiled as chromatin so its genes can be read. It is a single DNA molecule at this stage.' : s === 1 ? 'Being copied: when S phase ends it will be two identical sister chromatids.' : 'Already copied into two sister chromatids, but still uncoiled.',
        });
      } else if (s === 3) {
        const cond = ease(u / 0.6);
        chromatin(c, terr[0], terr[1], 1 - cond);
        chromatin(c, terr[0], terr[1], 1 - cond, 1, 3);
        xChrom(c, terr, c.angle, L * (0.6 + 0.4 * cond), cond, i, name);
        if (attach > 0) {
          fibre(cL, lerp2(cL, [terr[0] - 7, terr[1]], attach), 1);
          fibre(cR, lerp2(cR, [terr[0] + 7, terr[1]], attach), 1);
        }
      } else if (s === 4) {
        const m = ease(u / 0.75);
        const at = lerp2(terr, plate, m);
        const ang = lerp(c.angle, Math.PI / 2, m);
        fibre(cL, [at[0] - 7, at[1]], 1);
        fibre(cR, [at[0] + 7, at[1]], 1);
        xChrom(c, at, ang, L, 1, i, name);
      } else if (s === 5) {
        const e = ease(u);
        const spread = lerp(Math.PI / 2, 0.55, e);
        const yEnd = CY + (i - (n - 1) / 2) * 16;
        for (const side of [-1, 1]) {
          // the mistake: chromosome 1's sisters both go to the left pole
          const goes = st.error && i === 0 ? -1 : side;
          const tx = CX + goes * 128 + (st.error && i === 0 && side === 1 ? 14 : 0);
          const at: V2 = [lerp(CX + side * 7, tx, e), lerp(plateY(i), yEnd, e)];
          fibre(goes < 0 ? cL : cR, at, 1);
          vChrom(c, at, -goes, spread, L, 1, i, name);
        }
      } else if (s === 6 || s === 7) {
        const dec = s === 6 ? ease((u - 0.3) / 0.6) : 1;
        for (const side of [-1, 1]) {
          const goes = st.error && i === 0 ? -1 : side;
          const at: V2 = [CX + goes * 128 + (st.error && i === 0 && side === 1 ? 14 : 0), CY + (i - (n - 1) / 2) * 16];
          vChrom(c, at, -goes, 0.55, L, 1 - dec, i, name);
          const nuc: V2 = s === 7 && split > 0 ? [CX + goes * lerp(118, 132, split), CY] : [CX + goes * 135, CY];
          const jit: V2 = [nuc[0] + c.terr[0] * 0.45 + (st.error && i === 0 && side === 1 ? 10 : 0), nuc[1] + c.terr[1] * 0.45];
          chromatin(c, jit[0], jit[1], dec, 0.5);
          if (dec > 0.5)
            hits.push({
              id: `chrom${i}`,
              test: (x, y) => Math.hypot(x - jit[0], y - jit[1]) < 14,
              title: `Chromosome ${c.pair + 1} (from the ${c.mat ? 'mother' : 'father'})`,
              text: 'Uncoiling again inside a new nucleus. Each daughter nucleus has received one copy.',
            });
        }
      }
    });

    // new nuclear envelopes in telophase / cytokinesis
    if (s >= 6) {
      const a = s === 6 ? ease((u - 0.3) / 0.6) : 1;
      for (const side of [-1, 1]) {
        const nx = s === 7 && split > 0 ? CX + side * lerp(118, 132, split) : CX + side * 135;
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#7b6cd9';
        ctx.fillStyle = 'rgba(123, 108, 217, 0.12)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(nx, CY, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (a > 0.5) hits.push({ id: 'envelope', test: (x, y) => Math.abs(Math.hypot(x - nx, y - CY) - 58) < 6 });
      }
    }
    // centrosomes drawn on top
    centrosome(cL[0], cL[1]);
    if (s > 0) centrosome(cR[0], cR[1]);
    if (s >= 6 && pinch > 0.05) hits.push({ id: 'furrow', test: (x, y) => Math.abs(x - CX) < 22 && Math.abs(y - CY) > ry * (1 - pinch) - 30 });
    if (s === 4) hits.push({ id: 'plate', test: (x, y) => Math.abs(x - CX) < 5 && Math.abs(y - CY) < 130 });
    hits.push({ id: 'membrane', test: (x, y) => inBody(x, y, true) });

    // labels
    if (st.labels) {
      ctx.lineWidth = 1 / k;
      if (s <= 2) {
        tag('Nucleus', CX - 150, CY + 120, fs, k);
        lead(CX - 150, CY + 110, CX - 70, CY + 68, k);
        if (s === 0) {
          tag('Nucleolus', CX + 150, CY - 80, fs, k);
          lead(CX + 112, CY - 76, CX + 44, CY - 34, k);
        }
        tag(s === 1 ? 'Chromatin being copied' : 'Chromatin (uncoiled DNA)', CX + 120, CY + 140, fs, k);
        lead(CX + 100, CY + 130, CX + 40, CY + 50, k);
        tag(s === 0 ? 'Centrosome' : 'Two centrosomes', CX, CY - nucR - 50, fs, k);
      } else if (s === 3) {
        tag(u > 0.6 ? 'Nuclear envelope breaking down' : 'Chromosomes condensing', CX, CY - 150, fs, k);
        if (u > 0.4) tag('Spindle forming', cL[0] + 10, cL[1] + 60, fs, k);
      } else if (s === 4) {
        tag('Metaphase plate', CX, CY - 170, fs, k);
        lead(CX, CY - 160, CX, CY - 120, k);
        tag('Spindle fibres', CX - 100, CY + 140, fs, k);
        tag('Pole', cL[0], cL[1] - 40, fs, k);
        tag('Pole', cR[0], cR[1] - 40, fs, k);
      } else if (s === 5) {
        tag('Sister chromatids pulled apart', CX, CY - 160, fs, k);
      } else if (s === 6) {
        tag('New nuclear envelopes', CX, CY - 130, fs, k);
        tag('Cleavage furrow begins', CX, CY + 165, fs, k);
      } else {
        const counts = daughterCounts();
        tag(`Daughter cell: ${counts[0]} chromosomes`, CX - 130, CY + 150, fs, k);
        tag(`Daughter cell: ${counts[1]} chromosomes`, CX + 130, CY + 190, fs, k);
        if (split === 0) tag('Cleavage furrow', CX, CY - 175, fs, k);
      }
    }
    drawPanel(fs, k);
  }

  /** Is a design-space point inside (or on the outline of) the cell? */
  let lastBody: Path2D | null = null;
  function inBody(x: number, y: number, outline: boolean) {
    if (!lastBody) return false;
    const { k, ox, oy } = tf();
    const d = size.dpr;
    ctx.save();
    ctx.setTransform(d * k, 0, 0, d * k, d * ox, d * oy);
    ctx.lineWidth = 12;
    const px = (x * k + ox) * d;
    const py = (y * k + oy) * d;
    const r = outline ? ctx.isPointInStroke(lastBody, px, py) : ctx.isPointInPath(lastBody, px, py);
    ctx.restore();
    return r;
  }

  const daughterCounts = () => {
    const n = chroms.length;
    return st.error ? [n + 1, n - 1] : [n, n];
  };

  /* ---------- Side panel: cell-cycle wheel ---------- */
  function wheelPos() {
    const total = WHEEL.reduce((a, b) => a + b[1], 0);
    const s = st.stage;
    let start = 0;
    let span = 0;
    if (s <= 2) {
      start = WHEEL.slice(0, s).reduce((a, b) => a + b[1], 0);
      span = WHEEL[s][1];
    } else {
      start = 23 + ((s - 3) / 5) * 1;
      span = 1 / 5;
    }
    return ((start + span * st.u) / total) * Math.PI * 2 - Math.PI / 2;
  }
  function drawPanel(fs: Fs, k: number) {
    const P = panelAt();
    const tall = portrait();
    const wx = P.x + (tall ? 120 : 150);
    const wy = P.y + 120;
    const R = 92;
    const total = WHEEL.reduce((a, b) => a + b[1], 0);
    let a0 = -Math.PI / 2;
    for (const [label, h, col] of WHEEL) {
      const a1 = a0 + (h / total) * Math.PI * 2;
      ctx.strokeStyle = col;
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.arc(wx, wy, R, a0 + 0.01, a1 - 0.01);
      ctx.stroke();
      const am = (a0 + a1) / 2;
      const lr = label === 'M' ? R + 34 : R;
      tag(label === 'M' ? 'M (mitosis)' : label, wx + Math.cos(am) * lr, wy + Math.sin(am) * lr, fs, k);
      const s0 = a0;
      const s1 = a1;
      hits.push({
        id: `wheel-${label}`,
        test: (x, y) => {
          const r = Math.hypot(x - wx, y - wy);
          let ang = Math.atan2(y - wy, x - wx);
          if (ang < -Math.PI / 2) ang += Math.PI * 2;
          return r > R - 16 && r < R + 16 && ang >= s0 && ang <= s1;
        },
      });
      a0 = a1;
    }
    // checkpoints
    for (const h of [11, 23, 23.5]) {
      const a = (h / total) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = pal['sim-text'];
      ctx.beginPath();
      ctx.arc(wx + Math.cos(a) * (R - 22), wy + Math.sin(a) * (R - 22), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // current position
    const a = wheelPos();
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3 / k;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(a) * (R - 24), wy + Math.sin(a) * (R - 24));
    ctx.lineTo(wx + Math.cos(a) * (R + 18), wy + Math.sin(a) * (R + 18));
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(wx + Math.cos(a) * R, wy + Math.sin(a) * R, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = fs(11, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(STAGES[st.stage].name, wx, wy - 4 / k);
    ctx.font = fs(10, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('about 24 h in total', wx, wy + 12 / k);
    // legend
    const lx = tall ? P.x + 270 : P.x;
    let ly = tall ? P.y + 40 : wy + R + 70;
    ctx.textAlign = 'left';
    ctx.font = fs(11, 700);
    const items: [string, string][] = [
      [MAT[0], '■ Warm: from the mother'],
      [PAT[0], '■ Cool: from the father'],
      [pal['sim-text'], 'Same length = homologous pair'],
      [pal['text-faint'], '● = checkpoint'],
    ];
    for (const [c, t] of items) {
      ctx.fillStyle = c;
      ctx.fillText(t, lx, ly);
      ly += 18 / k;
    }
  }

  /* ---------- Compare view ---------- */
  function miniChrom(x: number, y: number, len: number, colour: string, doubled: boolean, tip?: string) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    const offs = doubled ? [-3.5, 3.5] : [0];
    offs.forEach((o, j) => {
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x + o, y - len / 2);
      ctx.lineTo(x + o, y + len / 2);
      ctx.stroke();
      // a crossed-over segment from the homologue
      if (tip && (!doubled || j === 1)) {
        ctx.strokeStyle = tip;
        ctx.beginPath();
        ctx.moveTo(x + o, y + len / 8);
        ctx.lineTo(x + o, y + len / 2);
        ctx.stroke();
      }
    });
    ctx.lineCap = 'butt';
  }
  function miniCell(x: number, y: number, r: number, items: [number, string, boolean, string?][], label: string, fs: Fs, k: number, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(120, 170, 220, 0.15)';
    ctx.strokeStyle = '#6aa7d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const gap = Math.min(16, (r * 1.4) / items.length);
    items.forEach(([len, col, dbl, tip], i) => miniChrom(x + (i - (items.length - 1) / 2) * gap, y, len * (r / 60), col, dbl, tip));
    ctx.globalAlpha = 1;
    if (label && alpha > 0.5) tag(label, x, y + r + 16 / k, fs, k);
  }
  function drawCompare(fs: Fs, k: number) {
    const tall = portrait();
    ctx.translate(0, 30); // keep the columns clear of the badge
    const prog = sim.running ? (anim % 7) / 7 : 1;
    const W = tall ? 335 : 450;
    const parent: [number, string, boolean][] = [
      [58, MAT[0], true],
      [58, PAT[0], true],
      [36, MAT[1], true],
      [36, PAT[1], true],
    ];
    const cols = [
      { x0: tall ? 10 : 30, title: 'Mitosis' },
      { x0: tall ? 355 : 520, title: 'Meiosis' },
    ];
    cols.forEach(({ x0, title }, j) => {
      ctx.fillStyle = j === 0 ? 'rgba(46, 194, 126, 0.07)' : 'rgba(155, 93, 229, 0.07)';
      ctx.beginPath();
      ctx.roundRect(x0, 60, W, tall ? 560 : 555, 18);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = fs(14, 800);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(title, x0 + 16, 60 + 22 / k);
      const mx = x0 + W / 2;
      const r0 = tall ? 46 : 55;
      miniCell(mx, 165, r0, parent, tall ? 'Parent 2n = 4' : 'Parent cell: 2n = 4', fs, k);
      if (j === 0) {
        const show = prog > 0.35 ? 1 : 0.15;
        const kids: [number, string, boolean][] = [
          [58, MAT[0], false],
          [58, PAT[0], false],
          [36, MAT[1], false],
          [36, PAT[1], false],
        ];
        for (const dx of [-1, 1]) {
          ctx.strokeStyle = pal['text-faint'];
          ctx.lineWidth = 2 / k;
          ctx.beginPath();
          ctx.moveTo(mx + dx * 20, 165 + r0 + 34 / k);
          ctx.lineTo(mx + dx * W * 0.24, 360 - r0 - 6);
          ctx.stroke();
          miniCell(mx + dx * W * 0.24, 360, r0, kids, tall ? '2n = 4' : 'Identical, 2n = 4', fs, k, show);
        }
      } else {
        const show1 = prog > 0.3 ? 1 : 0.15;
        const show2 = prog > 0.65 ? 1 : 0.15;
        const r1 = tall ? 38 : 45;
        const r2 = tall ? 30 : 36;
        // meiosis I: homologues separate (with crossing over between the long pair)
        const m1: [number, string, boolean, string?][][] = [
          [[58, MAT[0], true, PAT[0]], [36, PAT[1], true]],
          [[58, PAT[0], true, MAT[0]], [36, MAT[1], true]],
        ];
        m1.forEach((items, i) => {
          const x = mx + (i ? 1 : -1) * W * 0.24;
          ctx.strokeStyle = pal['text-faint'];
          ctx.lineWidth = 2 / k;
          ctx.beginPath();
          ctx.moveTo(mx + (i ? 20 : -20), 165 + r0 + 34 / k);
          ctx.lineTo(x, 300 - r1 - 6);
          ctx.stroke();
          miniCell(x, 300, r1, items, '', fs, k, show1);
        });
        tag(tall ? 'Meiosis I' : 'Meiosis I: pairs separate', mx, 300, fs, k);
        // meiosis II: sister chromatids separate → four different cells
        const m2: [number, string, boolean, string?][][] = [
          [[58, MAT[0], false], [36, PAT[1], false]],
          [[58, MAT[0], false, PAT[0]], [36, PAT[1], false]],
          [[58, PAT[0], false, MAT[0]], [36, MAT[1], false]],
          [[58, PAT[0], false], [36, MAT[1], false]],
        ];
        m2.forEach((items, i) => {
          const x = x0 + W * (0.14 + i * 0.24);
          const from = mx + (i < 2 ? -1 : 1) * W * 0.24;
          ctx.strokeStyle = pal['text-faint'];
          ctx.lineWidth = 2 / k;
          ctx.beginPath();
          ctx.moveTo(from, 300 + r1 + 4);
          ctx.lineTo(x, 470 - r2 - 4);
          ctx.stroke();
          miniCell(x, 470, r2, items, '', fs, k, show2);
        });
        tag(tall ? 'Meiosis II: n = 2' : 'Meiosis II: 4 different cells, n = 2', mx, 392, fs, k);
      }
      // summary (on phones the readouts carry it)
      if (!tall) {
        const rows = j === 0 ? ['1 division → 2 identical cells (2n)', 'For growth, repair and asexual reproduction'] : ['2 divisions → 4 different cells (n)', 'Makes gametes for sexual reproduction'];
        ctx.textAlign = 'left';
        ctx.font = fs(11, 650);
        ctx.fillStyle = pal['sim-text'];
        rows.forEach((row, i) => ctx.fillText(`• ${row}`, x0 + 20, 560 + (i * 17) / k));
      }
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
    hits = [];
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    if (st.view === 'cycle') drawCycle(fs, k);
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
    const s = st.stage;
    const n = chroms.length;
    if (st.view === 'cycle') {
      const [a, b] = daughterCounts();
      const chromText =
        s <= 4 ? `${n} (${n / 2} pairs)` : s === 5 ? `${2 * n}: chromatids have separated` : s === 6 ? `${a} + ${b} in two forming nuclei` : `${a} and ${b} in the two daughter cells`;
      r('r1', 'Stage', `${STAGES[s].name} (${STAGES[s].part.toLowerCase()})`);
      r('r2', 'Chromosomes', chromText, st.error && s >= 5 ? 'bad' : null);
      r('r3', 'Chromatids per chromosome', s === 0 ? '1' : s === 1 ? '1 → 2 (being copied)' : s <= 4 ? '2 (sister chromatids)' : '1');
      r('r4', 'DNA per cell (relative)', s === 0 ? '2 units' : s === 1 ? '2 → 4 units' : s <= 6 ? '4 units' : '2 units in each daughter');
      r('r5', 'Typical time (human cell)', s <= 2 ? `${['about 11 h', 'about 8 h', 'about 4 h'][s]}` : 'Mitosis takes about 1 h in total');
      sim.setBadge(STAGES[s].part);
      noteEl.textContent =
        st.error && s >= 5
          ? `Mistake switched on: chromosome 1 from the mother failed to separate, so both chromatids went to one pole. The daughter cells get ${a} and ${b} chromosomes instead of ${n}. Errors like this can cause cell death or disease, which is why checkpoints exist.`
          : 'Click a chromosome, a centrosome, a spindle fibre or any part of the cell. Click the wheel to jump to a phase.';
      stageLabel.textContent = `Stage ${s + 1} of 8: ${STAGES[s].name}`;
      stageText.textContent = STAGES[s].text;
    } else {
      r('r1', 'Divisions', 'Mitosis 1 · meiosis 2');
      r('r2', 'Cells produced', 'Mitosis 2 · meiosis 4');
      r('r3', 'Chromosome number', 'Mitosis keeps 2n · meiosis halves to n');
      r('r4', 'Daughter cells', 'Mitosis: identical · meiosis: all different');
      r('r5', 'Used for', 'Mitosis: growth and repair · meiosis: gametes');
      sim.setBadge('Mitosis vs meiosis');
      noteEl.textContent = 'Both start with a cell whose chromosomes have been copied. Mitosis separates sister chromatids once, giving two identical cells. Meiosis first separates the homologous pairs, after swapping pieces (crossing over), then separates the chromatids, giving four different cells with half the chromosomes.';
    }
  }

  /* ---------- Graph: DNA and chromosome number across the cycle ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="mi-graph"]')!, { x: { min: 0, span: 8 }, y: { min: 0, max: 14, step: 2 } });
  function drawGraph() {
    graphPanel.hidden = st.view !== 'cycle';
    if (st.view !== 'cycle') return;
    const n = chroms.length;
    const dna: Point[] = [];
    const num: Point[] = [];
    for (let x = 0; x <= 8; x += 0.02) {
      const s = Math.min(7, Math.floor(x));
      const u = x - s;
      dna.push({ x, y: s === 0 ? 2 : s === 1 ? 2 + 2 * u : s < 7 ? 4 : u < 0.85 ? 4 : 2 });
      num.push({ x, y: s < 5 ? n : s < 7 || u < 0.85 ? 2 * n : n });
    }
    graph.opts.x = { min: 0, span: 8, max: 8, step: 1, format: (v) => ['G1', 'S', 'G2', 'Pro', 'Meta', 'Ana', 'Telo', 'Cyto', ''][Math.round(v)] ?? '' };
    graph.opts.y = { min: 0, max: Math.max(8, 2 * n + 2), step: 2, format: (v) => `${v}` };
    graph.opts.refs = [{ value: st.stage + st.u, label: 'Now', color: 'accent', axis: 'x' }];
    graph.set('dna', { label: 'DNA per cell (relative units)', color: '#4c8dd6', points: dna, width: 3 });
    graph.set('n', { label: 'Chromosomes in the cell (separated chromatids count)', color: '#e76f51', points: num, width: 2, dash: [5, 4] });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="mi-graph"]'));
  }

  /* ---------- Time and stepping ---------- */
  function step(dt: number) {
    anim += dt;
    if (st.view !== 'cycle') return;
    st.u += (dt * st.speed) / 4;
    if (st.u >= 1) {
      st.u = 0;
      st.stage = (st.stage + 1) % STAGES.length;
    }
    posCtl.set(Math.round((st.stage + st.u) * 100), false);
  }
  function goTo(stage: number, u?: number) {
    st.stage = (stage + STAGES.length) % STAGES.length;
    st.u = u ?? (sim.running ? 0 : KEY_U[st.stage]);
    posCtl.set(Math.round((st.stage + st.u) * 100), false);
    updateReadouts();
    sim.requestRender();
  }

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    // the last region drawn is on top
    const hit = [...hits].reverse().find((h) => h.test(x, y));
    if (!hit) return sim.hideTooltip();
    if (hit.id.startsWith('wheel-')) {
      const label = hit.id.slice(6);
      goTo(label === 'G1' ? 0 : label === 'S' ? 1 : label === 'G2' ? 2 : 3);
      return sim.hideTooltip();
    }
    const [title, text] = hit.title ? [hit.title, hit.text ?? ''] : INFO[hit.id];
    sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, title, text);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');
  const showFor = (v: View) => {
    ui.showWhen('[data-only="cycle"]', v === 'cycle');
    if (hintEl) hintEl.style.display = v === 'cycle' ? '' : 'none';
  };
  const viewCtl = ui.choice<View>('mi-view', (v) => {
    st.view = v;
    showFor(v);
    sim.hideTooltip();
    graphPanel.hidden = v !== 'cycle';
    updateReadouts();
    sim.requestRender();
  });
  root.querySelector('[data-prev]')!.addEventListener('click', () => goTo(st.stage - 1));
  root.querySelector('[data-next]')!.addEventListener('click', () => goTo(st.stage + 1));
  const posCtl = ui.range('mi-pos', (v) => STAGES[Math.min(7, Math.floor(v / 100))].name, (v) => {
    if (sim.running) sim.pause();
    goTo(Math.min(7, Math.floor(v / 100)), Math.min(1, (v % 100) / 100 || (v >= 800 ? 1 : 0)));
  });
  const speedCtl = ui.range('mi-speed', (v) => `${v}×`, (v) => (st.speed = v));
  const pairsCtl = ui.choice<'2' | '3'>('mi-pairs', (v) => {
    st.pairs = Number(v);
    makeChroms();
    updateReadouts();
    sim.requestRender();
  });
  const errorCtl = ui.toggle('mi-error', (v) => {
    st.error = v;
    updateReadouts();
    sim.requestRender();
  });
  const labelsCtl = ui.toggle('mi-labels', (v) => ((st.labels = v), sim.requestRender()));
  showFor('cycle');

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set('cycle', false);
      speedCtl.set(1, false);
      pairsCtl.set('2', false);
      errorCtl.set(false, false);
      labelsCtl.set(true, false);
      makeChroms();
      showFor('cycle');
      anim = 0;
      goTo(0, 0);
    },
  });
  posCtl.set(Math.round((st.stage + st.u) * 100), false);
}
