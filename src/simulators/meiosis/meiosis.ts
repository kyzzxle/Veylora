/**
 * Meiosis and genetic variation: two views.
 *   steps     – a diploid cell (2n) through interphase, prophase I (synapsis and
 *               crossing over), metaphase I, anaphase I, telophase I, metaphase II,
 *               anaphase II and telophase II, ending with four haploid cells
 *   variation – flip the metaphase I orientation of each homologous pair and
 *               see the gametes; make many gametes and count the different
 *               types, with and without crossing over
 *
 * Chromosome model: each pair has a maternal (M, warm colour) and a paternal
 * (P, cool colour) homologue. After S phase each homologue has two sister
 * chromatids. Crossing over swaps the end of one maternal and one paternal
 * (non-sister) chromatid beyond a random point. Metaphase I orientation of each
 * pair is random and independent (independent assortment); in meiosis II the
 * sister chromatids separate.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'steps' | 'variation';
type Fs = (px: number, w?: number) => string;
type V2 = [number, number];
type Hom = 'M' | 'P';

const MAT = ['#e76f51', '#f4a261', '#e9c46a'];
const PAT = ['#4c8dd6', '#7b6cd9', '#2a9d8f'];
const LENGTHS = [84, 62, 44];
const colourOf = (pair: number, h: Hom) => (h === 'M' ? MAT[pair] : PAT[pair]);

export const STAGES = [
  { key: 'Int', name: 'Interphase', text: 'Before meiosis the cell copies its DNA in S phase, just as before mitosis. Each chromosome now has two identical sister chromatids. The cell is diploid (2n): it has two of each chromosome, one inherited from each parent.' },
  { key: 'PI', name: 'Prophase I', text: 'Chromosomes condense. Each one finds its homologue, the same-sized partner from the other parent, and they pair up closely (synapsis), forming a bivalent of four chromatids. Non-sister chromatids swap matching pieces at points called chiasmata: this is crossing over.' },
  { key: 'MI', name: 'Metaphase I', text: 'The homologous pairs line up across the middle of the cell. The orientation of each pair is random: whether the maternal or the paternal chromosome faces a given pole does not depend on the other pairs. This is independent assortment.' },
  { key: 'AI', name: 'Anaphase I', text: 'The homologous chromosomes are pulled to opposite poles. Unlike in mitosis, the sister chromatids stay together. Each pole receives one chromosome of every pair.' },
  { key: 'TI', name: 'Telophase I and cytokinesis', text: 'The cell divides into two. Each new cell is haploid (n): it has one chromosome from each pair, although every chromosome still has two chromatids. The DNA is not copied again before meiosis II.' },
  { key: 'MII', name: 'Prophase II and metaphase II', text: 'In each cell a new spindle forms and the chromosomes line up across the middle, this time one by one rather than in pairs.' },
  { key: 'AII', name: 'Anaphase II', text: 'The sister chromatids finally separate and move to opposite poles, as in mitosis. Because of crossing over, two sister chromatids may no longer be identical.' },
  { key: 'TII', name: 'Telophase II and cytokinesis', text: 'Both cells divide, giving four haploid cells, each with one chromatid of every chromosome. In animals they develop into sperm or eggs. Thanks to independent assortment and crossing over, they are genetically different.' },
];
const KEY_U = [0.8, 0.95, 0.9, 0.7, 1, 0.9, 0.7, 1];

interface Chromatid {
  pair: number;
  hom: Hom;
  sister: 0 | 1;
  tip?: { from: Hom; at: number };
}
interface Meiosis {
  orient: number[]; // 0: maternal homologue to cell A
  flip2: number[][]; // [pair][cell]: which sister goes to the first gamete
  cross: (number | null)[]; // crossover point per pair
  cm: number[]; // maternal sister involved
  cp: number[]; // paternal sister involved
}

function randomMeiosis(pairs: number, crossing: boolean, fixedSisters = false): Meiosis {
  const r = () => (Math.random() < 0.5 ? 0 : 1);
  return {
    orient: Array.from({ length: pairs }, r),
    flip2: Array.from({ length: pairs }, () => [r(), r()]),
    cross: Array.from({ length: pairs }, () => (crossing ? 0.25 + Math.random() * 0.5 : null)),
    cm: Array.from({ length: pairs }, () => (fixedSisters ? 1 : r())),
    cp: Array.from({ length: pairs }, () => (fixedSisters ? 0 : r())),
  };
}
/** The chromatid after crossing over (if any). */
function chromatid(m: Meiosis, pair: number, hom: Hom, sister: 0 | 1, crossed = true): Chromatid {
  const c: Chromatid = { pair, hom, sister };
  const at = m.cross[pair];
  if (crossed && at !== null) {
    if (hom === 'M' && sister === m.cm[pair]) c.tip = { from: 'P', at };
    if (hom === 'P' && sister === m.cp[pair]) c.tip = { from: 'M', at };
  }
  return c;
}
/** Four gametes: A1, A2 from cell A and B1, B2 from cell B. */
function gametes(m: Meiosis, pairs: number): Chromatid[][] {
  const out: Chromatid[][] = [[], [], [], []];
  for (let p = 0; p < pairs; p++) {
    const homA: Hom = m.orient[p] === 0 ? 'M' : 'P';
    const homB: Hom = homA === 'M' ? 'P' : 'M';
    const a = m.flip2[p][0] as 0 | 1;
    const b = m.flip2[p][1] as 0 | 1;
    out[0].push(chromatid(m, p, homA, a));
    out[1].push(chromatid(m, p, homA, (1 - a) as 0 | 1));
    out[2].push(chromatid(m, p, homB, b));
    out[3].push(chromatid(m, p, homB, (1 - b) as 0 | 1));
  }
  return out;
}
const keyOf = (g: Chromatid[]) => g.map((c) => `${c.pair}${c.hom}${c.tip ? `${c.tip.from}${c.tip.at.toFixed(3)}` : ''}`).join('|');

export function initMeiosis(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const graphPanel = root.querySelector<HTMLElement>('[data-graph-panel]')!;
  const stageLabel = root.querySelector<HTMLElement>('[data-stage-label]')!;
  const stageText = root.querySelector<HTMLElement>('[data-stage-text]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const DEF = { view: 'steps' as View, stage: 0, u: 0.8, pairs: 2, crossing: true, speed: 1, count: 23 };
  const st = { ...DEF };
  let anim = 0;
  let mei = randomMeiosis(st.pairs, st.crossing, true);
  let made: Chromatid[][] = [];
  let seen = new Set<string>();

  /* ---------- Layout ---------- */
  const CX = 330;
  const CY = 300;
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => {
    const tall = portrait();
    if (st.view === 'steps') return tall ? [0, -15, 660, 950] : [0, 40, 1000, 590];
    return tall ? [0, 30, 500, 1040] : [0, 30, 1000, 600];
  };
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };

  /* ---------- Hit regions ---------- */
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
  const ease = (t: number) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lerp2 = (a: V2, b: V2, t: number): V2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  /** One chromatid as a rod from a to b, with a crossed-over tip in the homologue's colour. */
  function rod(c: Chromatid, a: V2, b: V2, width: number, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    const own = colourOf(c.pair, c.hom);
    if (c.tip) {
      const m = lerp2(a, b, c.tip.at);
      ctx.strokeStyle = own;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(m[0], m[1]);
      ctx.stroke();
      ctx.strokeStyle = colourOf(c.pair, c.tip.from);
      ctx.beginPath();
      ctx.moveTo(m[0], m[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    } else {
      ctx.strokeStyle = own;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
  }
  function chromatidHit(c: Chromatid, a: V2, b: V2, stageName: string, withSister: boolean) {
    const who = c.hom === 'M' ? 'mother' : 'father';
    const title = `Chromosome ${c.pair + 1} from the ${who}${withSister ? '' : ` (chromatid ${c.sister + 1})`}`;
    const parts = [
      withSister ? `${stageName}: made of two sister chromatids joined at the centromere.` : `${stageName}: a single chromatid.`,
      `Its homologue is the same length in the ${c.hom === 'M' ? 'cool' : 'warm'} colour, inherited from the ${c.hom === 'M' ? 'father' : 'mother'}.`,
      c.tip ? 'This chromatid carries a piece of its homologue (the other colour) after crossing over, so it is recombinant.' : '',
    ];
    hits.push({ id: 'chrom', test: (x, y) => segDist(x, y, a, b) < 7, title, text: parts.join(' ') });
  }
  /** A duplicated chromosome: two sister chromatids side by side. */
  function dup(pair: number, hom: Hom, at: V2, angle: number, L: number, crossed: boolean, stageName: string, alpha = 1) {
    const d: V2 = [Math.cos(angle), Math.sin(angle)];
    const p: V2 = [-d[1], d[0]];
    for (const s of [0, 1] as const) {
      const c = chromatid(mei, pair, hom, s, crossed);
      const off = s === 0 ? -4 : 4;
      const a: V2 = [at[0] - (d[0] * L) / 2 + p[0] * off, at[1] - (d[1] * L) / 2 + p[1] * off];
      const b: V2 = [at[0] + (d[0] * L) / 2 + p[0] * off, at[1] + (d[1] * L) / 2 + p[1] * off];
      rod(c, a, b, 7, alpha);
      if (alpha > 0.5) chromatidHit(c, a, b, stageName, true);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(at[0], at[1], 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function single(c: Chromatid, at: V2, angle: number, L: number, stageName: string) {
    const d: V2 = [Math.cos(angle), Math.sin(angle)];
    const a: V2 = [at[0] - (d[0] * L) / 2, at[1] - (d[1] * L) / 2];
    const b: V2 = [at[0] + (d[0] * L) / 2, at[1] + (d[1] * L) / 2];
    rod(c, a, b, 6);
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(at[0], at[1], 3, 0, Math.PI * 2);
    ctx.fill();
    chromatidHit(c, a, b, stageName, false);
  }
  function chromatin(colour: string, cx: number, cy: number, alpha: number, seed: number, off = 0) {
    if (alpha <= 0.01) return;
    ctx.strokeStyle = colour;
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let j = 0; j <= 48; j++) {
      const t = j / 48;
      const x = cx + off + 20 * Math.sin(Math.PI * 2 * t * 1.3 + seed) + 7 * Math.sin(Math.PI * 2 * t * 5 + seed * 2);
      const y = cy + off + 17 * Math.cos(Math.PI * 2 * t * 0.9 + seed) + 7 * Math.cos(Math.PI * 2 * t * 4.3 + seed * 3);
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function fibre(a: V2, b: V2, alpha = 1) {
    if (alpha <= 0.01) return;
    ctx.strokeStyle = '#8fa3bf';
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function centrosome(x: number, y: number, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#5c677d';
    ctx.fillRect(x - 6, y - 3, 12, 6);
    ctx.fillRect(x - 3, y - 6, 6, 12);
    ctx.globalAlpha = 1;
  }
  /** Ellipse with an optional waist (pinch 0–1) across the horizontal or vertical axis. */
  function pinched(cx: number, cy: number, rx: number, ry: number, pinch: number, vertical: boolean) {
    const path = new Path2D();
    for (let j = 0; j <= 160; j++) {
      const th = (j / 160) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const x = vertical ? rx * c * (1 - pinch * 0.98 * Math.pow(Math.abs(c), 8)) : rx * c;
      const y = vertical ? ry * s : ry * s * (1 - pinch * 0.98 * Math.pow(Math.abs(s), 8));
      if (j) path.lineTo(cx + x, cy + y);
      else path.moveTo(cx + x, cy + y);
    }
    path.closePath();
    return path;
  }
  function cell(path: Path2D) {
    ctx.fillStyle = 'rgba(120, 170, 220, 0.13)';
    ctx.fill(path);
    ctx.strokeStyle = '#6aa7d8';
    ctx.lineWidth = 4;
    ctx.stroke(path);
  }

  /* ---------- Steps view ---------- */
  function drawSteps(fs: Fs, k: number) {
    const s = st.stage;
    const u = st.u;
    const name = STAGES[s].name;
    const n = st.pairs;
    const crossShown = st.crossing && (s > 1 || (s === 1 && u > 0.72));
    const plateY = (p: number) => CY + (p - (n - 1) / 2) * (n === 3 ? 72 : 90);
    const L = (p: number) => LENGTHS[p] * (n === 3 ? 0.85 : 1);
    const homA = (p: number): Hom => (mei.orient[p] === 0 ? 'M' : 'P');
    const homB = (p: number): Hom => (homA(p) === 'M' ? 'P' : 'M');
    const terr = (p: number, h: Hom): V2 => {
      const i = p * 2 + (h === 'M' ? 0 : 1);
      const a = (i / (2 * n)) * Math.PI * 2 + 0.5;
      return [CX + Math.cos(a) * 48, CY + Math.sin(a) * 42];
    };
    const cellX = [CX - 150, CX + 150];

    // ----- cells -----
    if (s <= 3) {
      const r = s === 0 ? lerp(160, 175, u) : 175;
      const e = s === 3 ? ease(u) : 0;
      cell(pinched(CX, CY, r + 40 * e, r - 15 * e, 0, false));
    } else if (s === 4) {
      const p = ease(u / 0.8);
      if (u < 0.8) cell(pinched(CX, CY, 215, 160, p, false));
      else for (const x of cellX) cell(pinched(x, CY, 125, 125, 0, false));
    } else if (s === 5 || s === 6) {
      const e = s === 6 ? ease(u) : 0;
      for (const x of cellX) cell(pinched(x, CY, 120 - 10 * e, 125 + 25 * e, 0, false));
    } else {
      const p = ease(u / 0.8);
      for (const x of cellX) {
        if (u < 0.8) cell(pinched(x, CY, 110, 150, p, true));
        else for (const dy of [-82, 82]) cell(pinched(x, CY + dy, 78, 78, 0, false));
      }
    }

    // ----- nucleus in interphase / early prophase I -----
    if (s === 0 || s === 1) {
      const env = s === 0 ? 1 : 1 - ease((u - 0.75) / 0.25);
      if (env > 0.02) {
        ctx.globalAlpha = env;
        ctx.strokeStyle = '#7b6cd9';
        ctx.fillStyle = 'rgba(123, 108, 217, 0.1)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(CX, CY, 110, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ----- chromosomes -----
    for (let p = 0; p < n; p++) {
      for (const h of ['M', 'P'] as Hom[]) {
        const T = terr(p, h);
        const col = colourOf(p, h);
        if (s === 0) {
          chromatin(col, T[0], T[1], 1, p * 2 + (h === 'M' ? 0 : 1));
          chromatin(col, T[0], T[1], ease(u / 0.8), p * 2 + (h === 'M' ? 0 : 1), 3);
          hits.push({ id: 'chrom', test: (x, y) => Math.hypot(x - T[0], y - T[1]) < 24, title: `Chromosome ${p + 1} from the ${h === 'M' ? 'mother' : 'father'}`, text: 'Uncoiled as chromatin. During S phase it is copied into two sister chromatids.' });
        } else if (s === 1) {
          // condense, then pair with the homologue (synapsis), then cross over
          const cond = ease(u / 0.3);
          chromatin(col, T[0], T[1], 1 - cond, p * 2 + (h === 'M' ? 0 : 1));
          const pairAt: V2 = [CX + (p - (n - 1) / 2) * 110 + (h === 'M' ? -9 : 9), CY];
          const at = lerp2(T, pairAt, ease((u - 0.3) / 0.35));
          const ang = lerp(0.6 + p, Math.PI / 2, ease((u - 0.3) / 0.35));
          dup(p, h, at, ang, L(p) * (0.6 + 0.4 * cond), crossShown, name, cond);
        } else if (s === 2 || s === 3) {
          // homologues side by side on the plate; orientation decides which pole each faces
          const left = homA(p) === h;
          const plateAt: V2 = [CX + (left ? -11 : 11), plateY(p)];
          const from: V2 = s === 2 ? [CX + (p - (n - 1) / 2) * 110 + (h === 'M' ? -9 : 9), CY] : plateAt;
          let at = s === 2 ? lerp2(from, plateAt, ease(u / 0.7)) : plateAt;
          if (s === 3) at = [lerp(plateAt[0], CX + (left ? -150 : 150) + (p - (n - 1) / 2) * 26, ease(u)), lerp(plateY(p), CY, ease(u))];
          const pole: V2 = [s === 3 ? CX + (left ? -1 : 1) * (190 + 40 * ease(u)) : CX + (left ? -190 : 190), CY];
          fibre(pole, at);
          dup(p, h, at, Math.PI / 2, L(p), crossShown, name);
        } else if (s === 4) {
          const cx = cellX[homA(p) === h ? 0 : 1];
          const from: V2 = [CX + (homA(p) === h ? -150 : 150) + (p - (n - 1) / 2) * 26, CY];
          const to: V2 = [cx + (p - (n - 1) / 2) * 30, CY];
          dup(p, h, lerp2(from, to, ease(u)), Math.PI / 2, L(p), crossShown, name);
        }
      }
      if (s === 1 && st.crossing && u > 0.6) {
        // chiasma marker between the inner non-sister chromatids
        const x = CX + (p - (n - 1) / 2) * 110;
        const y = CY - (L(p) / 2) + (mei.cross[p] ?? 0.5) * L(p);
        const a = ease((u - 0.6) / 0.2) * (u > 0.85 ? 1 - ease((u - 0.85) / 0.15) * 0.5 : 1);
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2.5 / k;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // meiosis II: each cell handles its chromosomes one by one
    if (s >= 5) {
      [0, 1].forEach((ci) => {
        const x0 = cellX[ci];
        const homOf = (p: number) => (ci === 0 ? homA(p) : homB(p));
        const top: V2 = [x0, CY - (s === 6 ? 125 + 25 * ease(st.u) : 125)];
        const bot: V2 = [x0, CY + (s === 6 ? 125 + 25 * ease(st.u) : 125)];
        if (s <= 6) {
          centrosome(top[0], top[1] + 14);
          centrosome(bot[0], bot[1] - 14);
        }
        for (let p = 0; p < n; p++) {
          const x = x0 + (p - (n - 1) / 2) * (n === 3 ? 62 : 80);
          const len = L(p) * 0.8;
          // orient so the sister that will move up is drawn on top
          const base = mei.flip2[p][ci] ? Math.PI : 0;
          if (s === 5) {
            const from: V2 = [x0 + (p - (n - 1) / 2) * 30, CY];
            const at = lerp2(from, [x, CY], ease(u / 0.7));
            const ang = lerp(Math.PI / 2, base, ease(u / 0.7));
            fibre([top[0], top[1] + 14], [at[0], at[1] - 4], ease((u - 0.4) / 0.4));
            fibre([bot[0], bot[1] - 14], [at[0], at[1] + 4], ease((u - 0.4) / 0.4));
            dup(p, homOf(p), at, ang, len, crossShown, name);
          } else {
            // sister chromatids separate: the first-gamete sister goes up
            const firstSister = mei.flip2[p][ci] as 0 | 1;
            for (const goesUp of [true, false]) {
              const sis = (goesUp ? firstSister : 1 - firstSister) as 0 | 1;
              const c = chromatid(mei, p, homOf(p), sis, crossShown);
              if (s === 6) {
                const at: V2 = [x, lerp(CY + (goesUp ? -4 : 4), CY + (goesUp ? -95 : 95), ease(u))];
                fibre(goesUp ? [top[0], top[1] + 14] : [bot[0], bot[1] - 14], at);
                single(c, at, base, len, name);
              } else {
                const gy = CY + (goesUp ? -82 : 82);
                const from: V2 = [x, CY + (goesUp ? -95 : 95)];
                const to: V2 = [x0 + (p - (n - 1) / 2) * 26, gy];
                const at = lerp2(from, to, ease(u));
                single(c, at, lerp(base, Math.PI / 2, ease(u)), len * lerp(1, 0.85, ease(u)), name);
              }
            }
          }
        }
      });
    }
    // spindle poles for meiosis I
    if (s >= 1 && s <= 3) {
      const a = s === 1 ? ease((u - 0.5) / 0.5) : 1;
      const out = s === 3 ? 40 * ease(u) : 0;
      centrosome(CX - 190 - out, CY, a);
      centrosome(CX + 190 + out, CY, a);
    }

    // labels
    if (s === 0) tag(u < 0.8 ? 'DNA being copied (S phase)' : 'Each chromosome now has 2 chromatids', CX, CY - 135, fs, k);
    if (s === 1) tag(u < 0.3 ? 'Chromosomes condense' : u < 0.65 ? 'Homologues pair up (synapsis)' : st.crossing ? 'Crossing over at chiasmata' : 'Bivalents (no crossing over)', CX, CY - 135, fs, k);
    if (s === 2) tag('Pairs line up: orientation is random', CX, CY - 200, fs, k);
    if (s === 3) tag('Homologues separate; sisters stay together', CX, CY - 200, fs, k);
    if (s === 4 && u > 0.8) for (const x of cellX) tag('Haploid: n = ' + n, x, CY + 150, fs, k);
    if (s === 5) tag('Chromosomes line up singly', CX, CY - 175, fs, k);
    if (s === 6) tag('Sister chromatids separate', CX, CY - 175, fs, k);
    if (s === 7 && u > 0.8) {
      const names = ['A1', 'A2', 'B1', 'B2'];
      [0, 1].forEach((ci) => [-1, 1].forEach((d, j) => tag(`Gamete ${names[ci * 2 + j]}`, cellX[ci], CY + d * 82 + (d < 0 ? -95 : 95), fs, k)));
    }
    drawPanel(fs, k);
  }

  /** Mini cell holding a list of chromatids (or duplicated homologues). */
  function miniCell(x: number, y: number, r: number, items: Chromatid[], dupl: boolean, label: string, fs: Fs, k: number, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(120, 170, 220, 0.15)';
    ctx.strokeStyle = '#6aa7d8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (alpha > 0.5) {
      const gap = Math.min(15, (r * 1.4) / Math.max(1, items.length));
      items.forEach((c, i) => {
        const cx = x + (i - (items.length - 1) / 2) * gap;
        const len = LENGTHS[c.pair] * (r / 80);
        const offs = dupl ? [-2.6, 2.6] : [0];
        for (const o of offs) rod(c, [cx + o, y - len / 2], [cx + o, y + len / 2], 4.5);
      });
    }
    if (label) tag(label, x, y + r + 14 / k, fs, k);
  }

  function drawPanel(fs: Fs, k: number) {
    const tall = portrait();
    const n = st.pairs;
    const px = tall ? 20 : 680;
    const py = tall ? 620 : 115;
    const w = tall ? 620 : 300;
    ctx.textAlign = 'left';
    ctx.font = fs(12, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Start', px, py);
    const start: Chromatid[] = [];
    for (let p = 0; p < n; p++) start.push({ pair: p, hom: 'M', sister: 0 }, { pair: p, hom: 'P', sister: 0 });
    const r0 = tall ? 52 : 50;
    const sx = tall ? px + 70 : px + w / 2;
    const sy = tall ? py + 75 : py + 72;
    miniCell(sx, sy, r0, start, false, `2n = ${2 * n} (${n} pairs)`, fs, k);
    const ex = tall ? px + 190 : px;
    const ey = tall ? py : sy + r0 + 58 / k;
    ctx.textAlign = 'left';
    ctx.font = fs(12, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`After meiosis: 4 haploid cells (n = ${n})`, ex, ey);
    const gs = gametes(mei, n);
    const done = st.stage === 7 && st.u > 0.8;
    const r1 = tall ? 40 : 38;
    const names = ['A1', 'A2', 'B1', 'B2'];
    gs.forEach((g, i) => {
      const gx = tall ? ex + 50 + i * 105 : px + (w / 4) * (i + 0.5);
      const gy = tall ? ey + 70 : ey + 52 / k;
      miniCell(gx, gy, r1, g, false, names[i], fs, k, done ? 1 : 0.25);
    });
    if (!tall) {
      let ly = ey + 52 / k + r1 + 52 / k;
      ctx.font = fs(11, 700);
      ctx.textAlign = 'left';
      for (const [c, t] of [
        [MAT[0], '■ Warm: chromosome from the mother'],
        [PAT[0], '■ Cool: chromosome from the father'],
        [pal['text-faint'], 'Two colours = crossed over'],
      ] as [string, string][]) {
        ctx.fillStyle = c;
        ctx.fillText(t, px, ly);
        ly += 17 / k;
      }
    }
  }

  /* ---------- Variation view ---------- */
  let rowHits: { p: number; y0: number; y1: number }[] = [];
  /** On phones the lab sits lower so the badge does not cover its title. */
  const varOffset = () => (portrait() ? 80 : 0);
  function drawVariation(fs: Fs, k: number) {
    const tall = portrait();
    ctx.translate(0, varOffset());
    const n = st.pairs;
    const lx = tall ? 20 : 30;
    const lw = tall ? 460 : 450;
    ctx.fillStyle = 'rgba(155, 93, 229, 0.06)';
    ctx.beginPath();
    ctx.roundRect(lx, 50, lw, tall ? 470 : 540, 16);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = fs(13, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(tall ? 'Click a pair to flip it' : 'Metaphase I: click a pair to flip it', lx + 14, 50 + 20 / k);
    const plateX = lx + lw / 2;
    const top = 50 + 46 / k;
    const rowH = (tall ? 200 : 300) / n;
    tag('to cell A', lx + 60, top + 4, fs, k);
    tag('to cell B', lx + lw - 60, top + 4, fs, k);
    ctx.strokeStyle = pal['text-faint'];
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    ctx.moveTo(plateX, top + 14 / k);
    ctx.lineTo(plateX, top + 14 / k + rowH * n);
    ctx.stroke();
    ctx.setLineDash([]);
    rowHits = [];
    for (let p = 0; p < n; p++) {
      const y = top + 14 / k + rowH * (p + 0.5);
      const hA: Hom = mei.orient[p] === 0 ? 'M' : 'P';
      const hB: Hom = hA === 'M' ? 'P' : 'M';
      const len = Math.min(LENGTHS[p], rowH * 0.8);
      for (const [h, side] of [[hA, -1], [hB, 1]] as [Hom, number][]) {
        for (const s of [0, 1] as const) {
          const c = chromatid(mei, p, h, s, st.crossing);
          const x = plateX + side * (12 + s * 7);
          rod(c, [x, y - len / 2], [x, y + len / 2], 5.5);
        }
      }
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1 / k;
      ctx.strokeRect(lx + 10, y - rowH / 2 + 4, lw - 20, rowH - 8);
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'left';
      ctx.fillText(`Pair ${p + 1}: ${hA === 'M' ? 'mother’s' : 'father’s'} to A`, lx + 16, y - rowH / 2 + 4 + 14 / k);
      rowHits.push({ p, y0: y - rowH / 2, y1: y + rowH / 2 });
    }
    // resulting gametes
    const gy = top + 14 / k + rowH * n + (tall ? 70 : 80);
    ctx.font = fs(12, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText('Gametes from this arrangement', lx + 14, gy - 50);
    gametes(mei, n).forEach((g, i) => miniCell(lx + lw * (0.13 + i * 0.25), gy, tall ? 32 : 40, g, false, ['A1', 'A2', 'B1', 'B2'][i], fs, k));

    // gallery of gametes made so far
    const gx = tall ? 20 : 510;
    const gyy = tall ? 540 : 90;
    const gw = tall ? 460 : 470;
    ctx.fillStyle = 'rgba(46, 194, 126, 0.06)';
    ctx.beginPath();
    ctx.roundRect(gx, gyy, gw, tall ? 400 : 500, 16);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = fs(13, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Gametes made', gx + 14, gyy + 20 / k);
    ctx.font = fs(11, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText(`${made.length} made · ${seen.size} different · ${st.crossing ? 'crossing over on' : `${2 ** n} possible types`}`, gx + 14, gyy + 40 / k);
    if (!made.length) tag('Press “Make 4 gametes”', gx + gw / 2, gyy + 200, fs, k);
    const per = tall ? 7 : 7;
    const cw = (gw - 28) / per;
    const ch = cw * 1.15;
    const startY = gyy + 56 / k;
    const maxRows = Math.max(1, Math.floor(((tall ? 400 : 500) - (56 / k) - 10) / ch));
    made.slice(-per * maxRows).forEach((g, i) => {
      const col = i % per;
      const row = Math.floor(i / per);
      const x = gx + 14 + col * cw + cw / 2;
      const y = startY + row * ch + ch / 2;
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      ctx.roundRect(x - cw / 2 + 3, y - ch / 2 + 3, cw - 6, ch - 6, 8);
      ctx.stroke();
      g.forEach((c, j) => {
        const len = LENGTHS[c.pair] * (ch / 140);
        const xx = x + (j - (g.length - 1) / 2) * Math.min(12, cw / (g.length + 1));
        rod(c, [xx, y - len / 2], [xx, y + len / 2], 4);
      });
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
    if (st.view === 'steps') drawSteps(fs, k);
    else drawVariation(fs, k);
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
    const n = st.pairs;
    const s = st.stage;
    if (st.view === 'steps') {
      const cells = s <= 3 || (s === 4 && st.u < 0.8) ? 1 : s < 7 || st.u < 0.8 ? 2 : 4;
      const perCell = s <= 3 || (s === 4 && st.u < 0.8) ? 2 * n : s === 6 ? 2 * n : n;
      r('r1', 'Stage', `${STAGES[s].name} (meiosis ${s <= 4 ? (s === 0 ? '— before' : 'I') : 'II'})`);
      r('r2', 'Cells', `${cells}`);
      r('r3', 'Chromosomes per cell', `${perCell}${s === 6 ? ' (sister chromatids separating)' : ''} · ${perCell === 2 * n && s !== 6 ? 'diploid (2n)' : s === 6 ? 'n per pole' : 'haploid (n)'}`);
      r('r4', 'Chromatids per chromosome', s === 0 ? (st.u < 0.8 ? '1 → 2 (being copied)' : '2') : s <= 5 ? '2' : '1');
      r('r5', 'DNA per cell (relative)', s === 0 ? '2 → 4' : s <= 3 || (s === 4 && st.u < 0.8) ? '4' : s < 7 || st.u < 0.8 ? '2' : '1');
      sim.setBadge(s === 0 ? 'Interphase' : s <= 4 ? 'Meiosis I' : 'Meiosis II');
      noteEl.textContent = `Click any chromosome. Warm colours came from the mother, cool from the father. ${st.crossing ? 'Two-coloured chromatids have crossed over.' : 'Crossing over is switched off.'} Press “New random meiosis” to shuffle the metaphase I arrangement and crossover points.`;
      stageLabel.textContent = `Stage ${s + 1} of 8: ${STAGES[s].name}`;
      stageText.textContent = STAGES[s].text;
    } else {
      const comb = 2 ** st.count;
      r('r1', 'Gametes made', `${made.length}`);
      r('r2', 'Different types seen', `${seen.size}`);
      r('r3', `Possible types from ${n} pairs (no crossing over)`, `2^${n} = ${2 ** n}`);
      r('r4', `Independent assortment alone, ${st.count} pairs`, `2^${st.count} = ${comb.toLocaleString('en')}`);
      r('r5', 'Possible offspring from two parents', `about ${(comb * comb).toExponential(1).replace('e+', ' × 10^')}`);
      sim.setBadge('Genetic variation');
      noteEl.textContent = st.crossing
        ? 'With crossing over, the exchange points vary every time, so almost every gamete is unique. Real chromosomes usually have one to three crossovers each.'
        : `Without crossing over, the only variation is how the pairs line up. With ${n} pairs there are 2^${n} = ${2 ** n} possible gamete types; keep making gametes until you have seen them all.`;
    }
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="me-graph"]')!, { x: { min: 0, span: 8 }, y: { min: 0, max: 8, step: 1 } });
  function drawGraph() {
    graphPanel.hidden = st.view !== 'steps';
    if (st.view !== 'steps') return;
    const n = st.pairs;
    const dna: Point[] = [];
    const num: Point[] = [];
    for (let x = 0; x <= 8; x += 0.02) {
      const s = Math.min(7, Math.floor(x));
      const u = x - s;
      dna.push({ x, y: s === 0 ? (u < 0.8 ? 2 + 2 * (u / 0.8) : 4) : s <= 3 || (s === 4 && u < 0.8) ? 4 : s < 7 || u < 0.8 ? 2 : 1 });
      num.push({ x, y: s <= 3 || (s === 4 && u < 0.8) ? 2 * n : s === 6 || (s === 7 && u < 0.8) ? 2 * n : n });
    }
    graph.opts.x = { min: 0, span: 8, max: 8, step: 1, format: (v) => ['Int', 'P I', 'M I', 'A I', 'T I', 'M II', 'A II', 'T II', ''][Math.round(v)] ?? '' };
    graph.opts.y = { min: 0, max: 2 * n + 1, step: 1, format: (v) => `${v}` };
    graph.opts.refs = [{ value: st.stage + st.u, label: 'Now', color: 'accent', axis: 'x' }];
    graph.set('dna', { label: 'DNA per cell (relative units)', color: '#4c8dd6', points: dna, width: 3 });
    graph.set('n', { label: 'Chromosomes per cell (separated chromatids count)', color: '#e76f51', points: num, width: 2, dash: [5, 4] });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="me-graph"]'));
  }

  /* ---------- Time and stepping ---------- */
  function step(dt: number) {
    anim += dt;
    if (st.view !== 'steps') return;
    st.u += (dt * st.speed) / 4;
    if (st.u >= 1) {
      st.u = 0;
      st.stage = (st.stage + 1) % STAGES.length;
      if (st.stage === 0) mei = randomMeiosis(st.pairs, st.crossing, true);
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
  function makeGametes() {
    const m = randomMeiosis(st.pairs, st.crossing);
    for (const g of gametes(m, st.pairs)) {
      made.push(g);
      seen.add(keyOf(g));
    }
    updateReadouts();
    sim.requestRender();
  }

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    if (st.view === 'variation') {
      const tall = portrait();
      const lx = tall ? 20 : 30;
      const lw = tall ? 460 : 450;
      const yy = y - varOffset();
      const row = rowHits.find((h) => yy >= h.y0 && yy <= h.y1 && x >= lx && x <= lx + lw);
      if (row) {
        mei.orient[row.p] = 1 - mei.orient[row.p];
        sim.announce(`Pair ${row.p + 1} flipped.`);
        sim.requestRender();
      }
      return;
    }
    const hit = [...hits].reverse().find((h) => h.test(x, y));
    if (!hit) return sim.hideTooltip();
    sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, hit.title ?? '', hit.text ?? '');
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const showFor = (v: View) => {
    ui.showWhen('[data-only="steps"]', v === 'steps');
    ui.showWhen('[data-only="variation"]', v === 'variation');
    if (hintEl) hintEl.style.display = v === 'steps' ? '' : 'none';
  };
  const viewCtl = ui.choice<View>('me-view', (v) => {
    st.view = v;
    showFor(v);
    sim.hideTooltip();
    graphPanel.hidden = v !== 'steps';
    updateReadouts();
    sim.requestRender();
  });
  root.querySelector('[data-prev]')!.addEventListener('click', () => goTo(st.stage - 1));
  root.querySelector('[data-next]')!.addEventListener('click', () => goTo(st.stage + 1));
  const posCtl = ui.range('me-pos', (v) => STAGES[Math.min(7, Math.floor(v / 100))].name, (v) => {
    if (sim.running) sim.pause();
    goTo(Math.min(7, Math.floor(v / 100)), v >= 800 ? 1 : (v % 100) / 100);
  });
  const speedCtl = ui.range('me-speed', (v) => `${v}×`, (v) => (st.speed = v));
  const pairsCtl = ui.choice<'2' | '3'>('me-pairs', (v) => {
    st.pairs = Number(v);
    mei = randomMeiosis(st.pairs, st.crossing, true);
    made = [];
    seen = new Set();
    updateReadouts();
    sim.requestRender();
  });
  const crossCtl = ui.toggle('me-cross', (v) => {
    st.crossing = v;
    mei = randomMeiosis(st.pairs, st.crossing, true);
    made = [];
    seen = new Set();
    updateReadouts();
    sim.requestRender();
  });
  const countCtl = ui.range('me-count', (v) => `${v} pairs`, (v) => ((st.count = v), updateReadouts()));
  root.querySelector('[data-shuffle]')!.addEventListener('click', () => {
    mei = randomMeiosis(st.pairs, st.crossing, true);
    updateReadouts();
    sim.requestRender();
  });
  root.querySelector('[data-make]')!.addEventListener('click', makeGametes);
  root.querySelector('[data-clear]')!.addEventListener('click', () => {
    made = [];
    seen = new Set();
    updateReadouts();
    sim.requestRender();
  });
  showFor('steps');

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set('steps', false);
      speedCtl.set(1, false);
      pairsCtl.set('2', false);
      crossCtl.set(true, false);
      countCtl.set(23, false);
      mei = randomMeiosis(st.pairs, st.crossing, true);
      made = [];
      seen = new Set();
      showFor('steps');
      anim = 0;
      goTo(0, 0);
    },
  });
  posCtl.set(Math.round((st.stage + st.u) * 100), false);
}
