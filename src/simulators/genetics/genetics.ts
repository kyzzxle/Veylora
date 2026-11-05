/**
 * Mendelian genetics: monohybrid and dihybrid crosses with Punnett squares.
 *   mono – one gene (four of Mendel's pea traits); pick each parent's genotype,
 *          read the Punnett square, then breed offspring and compare the
 *          simulated counts with the predicted ratios
 *   di   – two genes (seed shape R/r and seed colour Y/y) in a 4 × 4 square,
 *          assuming the genes assort independently (on different chromosomes)
 *
 * Each offspring receives one allele from each parent, chosen at random with
 * equal chance (segregation). The running proportion of the dominant
 * phenotype approaches the predicted probability as more offspring are bred.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'mono' | 'di';
type Fs = (px: number, w?: number) => string;
type V2 = [number, number];
type Icon = 'flower' | 'plant' | 'shape' | 'colour';

interface Trait {
  letter: string;
  name: string;
  dom: string;
  rec: string;
  icon: Icon;
  colour: string;
}
export const TRAITS: Record<string, Trait> = {
  flower: { letter: 'P', name: 'Flower colour', dom: 'purple', rec: 'white', icon: 'flower', colour: '#8e44ad' },
  height: { letter: 'T', name: 'Plant height', dom: 'tall', rec: 'short', icon: 'plant', colour: '#2e9d57' },
  shape: { letter: 'R', name: 'Seed shape', dom: 'round', rec: 'wrinkled', icon: 'shape', colour: '#c58b1b' },
  colour: { letter: 'Y', name: 'Seed colour', dom: 'yellow', rec: 'green', icon: 'colour', colour: '#d4a514' },
};
const DI_GENOTYPES = ['RRYY', 'RRYy', 'RRyy', 'RrYY', 'RrYy', 'Rryy', 'rrYY', 'rrYy', 'rryy'];

/** Dominant allele first, e.g. "pP" → "Pp". */
const norm = (a: string, b: string) => (a === a.toUpperCase() ? a + b : b === b.toUpperCase() ? b + a : a + b);
const isDom = (g: string) => g !== g.toLowerCase();
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function initGenetics(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const traitSel = root.querySelector<HTMLSelectElement>('[data-trait]')!;
  const di1 = root.querySelector<HTMLSelectElement>('[data-di1]')!;
  const di2 = root.querySelector<HTMLSelectElement>('[data-di2]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const DEF = { view: 'mono' as View, trait: 'flower', p1: 'Aa', p2: 'Aa', d1: 'RrYy', d2: 'RrYy' };
  const st = { ...DEF };
  let anim = 0;
  let breedTimer = 0;

  /* ---------- Genetics ---------- */
  const T = () => TRAITS[st.trait];
  /** Monohybrid genotype written with the trait's letter. */
  const lettered = (g: string) => g.replace(/A/g, T().letter).replace(/a/g, T().letter.toLowerCase());
  const monoAlleles = (g: string) => lettered(g).split('');
  const diGametes = (g: string) => {
    const [a1, a2, b1, b2] = g.split('');
    return [a1 + b1, a1 + b2, a2 + b1, a2 + b2];
  };
  /** The current cross as gametes for each parent (columns = parent 1, rows = parent 2). */
  function cross() {
    if (st.view === 'mono') return { top: monoAlleles(st.p1), left: monoAlleles(st.p2) };
    return { top: diGametes(st.d1), left: diGametes(st.d2) };
  }
  function childOf(a: string, b: string) {
    if (st.view === 'mono') return norm(a, b);
    return norm(a[0], b[0]) + norm(a[1], b[1]);
  }
  /** Phenotype key: for mono 'D'/'r'; for di two letters (shape, colour). */
  function phenoOf(g: string) {
    if (st.view === 'mono') return isDom(g) ? 'D' : 'r';
    return (isDom(g.slice(0, 2)) ? 'R' : 'w') + (isDom(g.slice(2)) ? 'Y' : 'g');
  }
  const phenoName = (key: string) => {
    if (st.view === 'mono') return key === 'D' ? T().dom : T().rec;
    return `${key[0] === 'R' ? 'round' : 'wrinkled'} ${key[1] === 'Y' ? 'yellow' : 'green'}`;
  };
  const phenoOrder = () => (st.view === 'mono' ? ['D', 'r'] : ['RY', 'Rg', 'wY', 'wg']);
  function predicted() {
    const { top, left } = cross();
    const geno = new Map<string, number>();
    const pheno = new Map<string, number>();
    for (const a of top)
      for (const b of left) {
        const g = childOf(a, b);
        geno.set(g, (geno.get(g) ?? 0) + 1);
        pheno.set(phenoOf(g), (pheno.get(phenoOf(g)) ?? 0) + 1);
      }
    return { geno, pheno, total: top.length * left.length };
  }

  /* ---------- Offspring ---------- */
  let kids: string[] = [];
  let counts = new Map<string, number>();
  let hist: Point[] = [];
  let flash: { i: number; j: number; t: number } | null = null;
  const targetPheno = () => (st.view === 'mono' ? 'D' : 'RY');
  function clearKids() {
    kids = [];
    counts = new Map();
    hist = [];
    flash = null;
  }
  function breed(n: number, animate: boolean) {
    const { top, left } = cross();
    for (let q = 0; q < n; q++) {
      const i = Math.floor(Math.random() * top.length);
      const j = Math.floor(Math.random() * left.length);
      const g = childOf(top[i], left[j]);
      kids.push(g);
      const p = phenoOf(g);
      counts.set(p, (counts.get(p) ?? 0) + 1);
      hist.push({ x: kids.length, y: (100 * (counts.get(targetPheno()) ?? 0)) / kids.length });
      if (animate && q === n - 1) flash = { i, j, t: 0 };
    }
    if (hist.length > 1500) hist = hist.filter((_, idx) => idx % 2 === 0 || idx === hist.length - 1);
    updateReadouts();
    sim.requestRender();
  }

  function step(dt: number) {
    anim += dt;
    if (flash) flash.t += dt / 0.7;
    if (flash && flash.t > 1.4) flash = null;
    breedTimer += dt;
    if (breedTimer > 0.45) {
      breedTimer = 0;
      breed(1, true);
    }
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 30, 540, 1060] : [0, 30, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  /** Punnett square geometry and the results panel position. */
  function geom() {
    const tall = portrait();
    const n = st.view === 'mono' ? 2 : 4;
    const cs = st.view === 'mono' ? (tall ? 150 : 145) : tall ? 92 : 96;
    const ox = tall ? (540 - cs * n) / 2 + 25 : st.view === 'mono' ? 130 : 105;
    const oy = st.view === 'mono' ? 150 : tall ? 182 : 125;
    const panel = tall ? { x: 20, y: oy + cs * n + 50, w: 500 } : { x: st.view === 'mono' ? 500 : 545, y: 110, w: st.view === 'mono' ? 470 : 430 };
    return { n, cs, ox, oy, panel };
  }

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
  /** An allele token: dominant = filled, recessive = outlined. */
  function allele(ch: string, x: number, y: number, r: number, colour: string, fs: Fs) {
    const dom = ch === ch.toUpperCase();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = dom ? colour : pal['bg-elev'];
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = dom ? '#ffffff' : colour;
    ctx.font = fs(Math.max(11, r * 0.9), 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + 1);
    ctx.textBaseline = 'alphabetic';
  }
  const alleleColour = (ch: string) => (st.view === 'mono' ? T().colour : ch.toLowerCase() === 'r' ? TRAITS.shape.colour : TRAITS.colour.colour);
  /** Phenotype picture for a genotype. */
  function icon(g: string, x: number, y: number, s: number) {
    if (st.view === 'di') return pea(x, y, s, isDom(g.slice(0, 2)), isDom(g.slice(2)));
    const dom = isDom(g);
    const ic = T().icon;
    if (ic === 'flower') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, s * 0.36, s * 0.26, a, 0, Math.PI * 2);
        ctx.fillStyle = dom ? '#8e44ad' : '#f4f1f8';
        ctx.fill();
        ctx.strokeStyle = dom ? '#5e2b74' : '#9a8fb0';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (ic === 'plant') {
      const h = dom ? s * 1.6 : s * 0.7;
      const base = y + s * 0.8;
      ctx.strokeStyle = '#2e9d57';
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - h);
      ctx.stroke();
      ctx.fillStyle = '#4cbf6f';
      for (let i = 1; i <= (dom ? 3 : 1); i++) {
        const ly = base - (h * i) / ((dom ? 3 : 1) + 0.6);
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(x + sgn * s * 0.22, ly, s * 0.24, s * 0.1, sgn * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(x - s * 0.3, base, s * 0.6, s * 0.12);
    } else if (ic === 'shape') pea(x, y, s, dom, true);
    else pea(x, y, s, true, dom);
  }
  function pea(x: number, y: number, s: number, round: boolean, yellow: boolean) {
    const r = s * 0.5;
    ctx.beginPath();
    for (let j = 0; j <= 48; j++) {
      const a = (j / 48) * Math.PI * 2;
      const rr = round ? r : r * (1 + 0.13 * Math.sin(a * 7)) * 0.92;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (j) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = yellow ? '#f2c94c' : '#6abf4b';
    ctx.fill();
    ctx.strokeStyle = yellow ? '#b8901f' : '#3f8a2d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (round) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const frac = (c: number, t: number) => {
    const g = gcd(c, t);
    return `${c / g}/${t / g}`;
  };

  /* ---------- Main drawing ---------- */
  interface Hit {
    test: (x: number, y: number) => boolean;
    title: string;
    text: string;
  }
  let hits: Hit[] = [];
  function draw(fs: Fs, k: number) {
    const { n, cs, ox, oy, panel } = geom();
    const { top, left } = cross();
    const pred = predicted();
    const mono = st.view === 'mono';
    const tokR = mono ? 18 : 11;
    const tall = portrait();

    // parent labels
    ctx.textAlign = 'center';
    ctx.font = fs(12, 800);
    ctx.fillStyle = pal['sim-text'];
    const g1 = mono ? lettered(st.p1) : st.d1;
    const g2 = mono ? lettered(st.p2) : st.d2;
    if (tall) ctx.textAlign = 'left'; // keeps clear of the badge on phones
    ctx.fillText(tall ? `Parent 1: ${g1}` : `Parent 1: ${g1} (${phenoName(phenoOf(g1))})`, tall ? 20 : ox + (cs * n) / 2, oy - 75);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(ox - 72, oy + (cs * n) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Parent 2: ${g2} (${phenoName(phenoOf(g2))})`, 0, 0);
    ctx.restore();
    // gamete headers
    const gHeader = (gam: string, x: number, y: number) => {
      const chars = gam.split('');
      chars.forEach((ch, idx) => allele(ch, x + (idx - (chars.length - 1) / 2) * (tokR * 2.2), y, tokR, alleleColour(ch), fs));
      hits.push({
        test: (px, py) => Math.abs(px - x) < tokR * 2.2 * chars.length / 2 + 4 && Math.abs(py - y) < tokR + 4,
        title: mono ? `Gamete carrying ${gam}` : `Gamete ${gam}`,
        text: mono
          ? `Each parent passes on one of its two alleles, chosen at random with an equal chance (Mendel’s law of segregation). ${gam === gam.toUpperCase() ? 'This is the dominant allele.' : 'This is the recessive allele.'}`
          : 'Each gamete gets one allele of each gene. With independent assortment, the four combinations are equally likely.',
      });
    };
    top.forEach((gam, i) => gHeader(gam, ox + cs * (i + 0.5), oy - 32));
    left.forEach((gam, j) => gHeader(gam, ox - (mono ? 32 : 38), oy + cs * (j + 0.5)));
    // grid cells
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = ox + cs * i;
        const y = oy + cs * j;
        const g = childOf(top[i], left[j]);
        const lit = flash && flash.i === i && flash.j === j && flash.t > 0.8;
        ctx.fillStyle = lit ? 'rgba(46, 194, 126, 0.25)' : (i + j) % 2 ? 'rgba(120,170,220,0.08)' : 'rgba(120,170,220,0.14)';
        ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = pal.border;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, cs, cs);
        icon(g, x + cs / 2, y + cs * 0.4, cs * (mono ? 0.32 : 0.36));
        ctx.font = fs(mono ? 14 : 11, 800);
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'center';
        ctx.fillText(g, x + cs / 2, y + cs - (mono ? 14 : 8));
        const count = pred.geno.get(g)!;
        hits.push({
          test: (px, py) => px >= x && px <= x + cs && py >= y && py <= y + cs,
          title: `${g}: ${phenoName(phenoOf(g))}`,
          text: mono
            ? `${g === g.toUpperCase() ? 'Homozygous dominant' : g === g.toLowerCase() ? 'Homozygous recessive' : 'Heterozygous'}. ${isDom(g) ? `At least one ${T().letter} allele, so the dominant ${T().dom} trait shows.` : `Two recessive alleles, so the ${T().rec} trait shows.`} Each box has a 1/4 chance; this genotype fills ${count} of 4 boxes (${frac(count, 4)}).`
            : `This genotype fills ${count} of 16 boxes (${frac(count, 16)}). Shape: ${isDom(g.slice(0, 2)) ? 'round (R is dominant)' : 'wrinkled (rr)'}. Colour: ${isDom(g.slice(2)) ? 'yellow (Y is dominant)' : 'green (yy)'}.`,
        });
      }
    tag(tall ? 'Filled = dominant · outlined = recessive' : 'Filled circle = dominant allele · outlined = recessive', ox + (cs * n) / 2, oy + cs * n + 22 / k, fs, k);
    // moving gametes for the latest offspring
    if (flash && flash.t <= 1) {
      const e = clamp(flash.t / 0.8, 0, 1);
      const cx = ox + cs * (flash.i + 0.5);
      const cy = oy + cs * (flash.j + 0.5);
      const a: V2 = [ox + cs * (flash.i + 0.5), oy - 32];
      const b: V2 = [ox - (mono ? 32 : 38), oy + cs * (flash.j + 0.5)];
      const draw2 = (from: V2, gam: string, dx: number) => {
        const x = from[0] + (cx + dx - from[0]) * e;
        const y = from[1] + (cy - from[1]) * e;
        gam.split('').forEach((ch, idx) => allele(ch, x + (idx - (gam.length - 1) / 2) * tokR * 2.2, y, tokR * 0.85, alleleColour(ch), fs));
      };
      draw2(a, top[flash.i], -tokR * 1.2);
      draw2(b, left[flash.j], tokR * 1.2);
    }

    // results panel
    // on phones the panel goes below the square and its legend
    let y = tall ? oy + cs * n + (mono ? 75 : 50) / k : panel.y;
    const x0 = panel.x;
    const w = panel.w;
    ctx.textAlign = 'left';
    ctx.font = fs(13, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Predicted vs bred offspring', x0, y);
    y += 14 / k;
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText(`Outline = predicted · filled = ${kids.length} bred`, x0, y + 6 / k);
    y += 26 / k;
    const total = kids.length;
    for (const key of phenoOrder()) {
      const p = (pred.pheno.get(key) ?? 0) / pred.total;
      const o = total ? (counts.get(key) ?? 0) / total : 0;
      ctx.font = fs(11, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'left';
      ctx.fillText(phenoName(key), x0 + 44, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(p * 100)}% · ${total ? `${Math.round(o * 100)}%` : '—'}`, x0 + w, y);
      // a genotype that shows this phenotype, just for the picture
      const iconG = mono ? (key === 'D' ? T().letter.repeat(2) : T().letter.toLowerCase().repeat(2)) : `${key[0] === 'R' ? 'R' : 'r'}r${key[1] === 'Y' ? 'Y' : 'y'}y`;
      icon(iconG, x0 + 16, y + 4 / k, 22);
      const by = y + 8 / k;
      const bh = 12 / k;
      const bw = w - 44;
      ctx.fillStyle = pal.border;
      ctx.fillRect(x0 + 44, by, bw, bh);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(x0 + 44, by, bw * o, bh);
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2 / k;
      ctx.strokeRect(x0 + 44, by, bw * p, bh);
      y += bh + (tall ? 20 : 30) / k;
    }
    if (tall) return; // phones: the readouts and graph below give the rest
    // genotype ratio line
    ctx.textAlign = 'left';
    ctx.font = fs(11, 650);
    ctx.fillStyle = pal['text-faint'];
    const genos = [...pred.geno.entries()].sort((a, b) => b[0].localeCompare(a[0]) || 0);
    const genoText = mono ? genos.map(([g, c]) => `${g} ${frac(c, pred.total)}`).join(' · ') : `${genos.length} different (click a box to see each one’s chance)`;
    y = wrapText(`Genotypes: ${genoText}`, x0, y, w, 15 / k);
    y += 10 / k;
    // offspring gallery
    ctx.font = fs(11, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(total ? `Latest offspring (${Math.min(total, 30)} of ${total})` : 'Press Breed or Start to produce offspring', x0, y);
    y += 12 / k;
    const per = 10;
    const cell = w / per;
    kids.slice(-30).forEach((g, i) => {
      const cx = x0 + cell * ((i % per) + 0.5);
      const cy = y + cell * (Math.floor(i / per) + 0.5);
      icon(g, cx, cy, cell * 0.55);
    });
  }
  function wrapText(text: string, x: number, y: number, maxW: number, lh: number) {
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

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    hits = [];
    if (hintEl) hintEl.style.display = portrait() ? 'none' : '';
    draw((px, wt = 650) => font(px / k, wt), k);
    ctx.restore();
    drawGraph();
  }

  /* ---------- Readouts ---------- */
  function ratioText(m: Map<string, number>) {
    const keys = phenoOrder().filter((key) => m.get(key));
    const vals = keys.map((key) => m.get(key)!);
    const g = vals.reduce((a, b) => gcd(a, b), 0) || 1;
    return `${keys.map((key) => phenoName(key)).join(' : ')} = ${vals.map((v) => v / g).join(' : ')}${keys.length === 1 ? ' (all)' : ''}`;
  }
  function updateReadouts() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    const pred = predicted();
    const mono = st.view === 'mono';
    const g1 = mono ? lettered(st.p1) : st.d1;
    const g2 = mono ? lettered(st.p2) : st.d2;
    r('r1', 'Cross', `${g1} × ${g2}`);
    r('r2', 'Predicted phenotype ratio', ratioText(pred.pheno));
    const t = kids.length;
    const target = targetPheno();
    const pT = (pred.pheno.get(target) ?? 0) / pred.total;
    const oT = t ? (counts.get(target) ?? 0) / t : 0;
    r('r3', `Chance of ${phenoName(target)} offspring`, `${frac(pred.pheno.get(target) ?? 0, pred.total)} = ${Math.round(pT * 100)}%`);
    r('r4', 'Offspring bred', t ? `${t}: ${phenoOrder().map((key) => `${counts.get(key) ?? 0} ${phenoName(key)}`).join(', ')}` : 'None yet');
    const diff = Math.abs(oT - pT) * 100;
    r('r5', 'Bred vs predicted', t ? `${phenoName(target)}: ${Math.round(oT * 100)}% vs ${Math.round(pT * 100)}% (${diff < 0.5 ? 'spot on' : `${diff.toFixed(0)} ${diff.toFixed(0) === '1' ? 'point' : 'points'} off`})` : '—', t >= 50 && diff > 15 ? 'warn' : null);
    // explanation for this cross
    let note = '';
    if (mono) {
      const L = T().letter;
      const both = [st.p1, st.p2].sort().join('×');
      if (both === 'AA×aa') note = `Every offspring is ${L}${L.toLowerCase()} and ${T().dom}. The recessive allele is hidden, not lost: cross two of these offspring (${L}${L.toLowerCase()} × ${L}${L.toLowerCase()}) and ${T().rec} plants reappear.`;
      else if (both === 'Aa×Aa') note = `Each offspring has a 1 in 4 chance of being ${T().rec}. That is a probability, not a guarantee: a family of 4 can have none, or several, ${T().rec} offspring. Breed more and the proportion gets closer to 3 : 1.`;
      else if (both === 'Aa×aa') note = `A test cross: crossing an unknown ${T().dom} plant with a ${T().rec} (${L.toLowerCase()}${L.toLowerCase()}) one. If any ${T().rec} offspring appear, the unknown parent must be heterozygous; here about half should be ${T().rec}.`;
      else if (both === 'AA×AA' || both === 'aa×aa') note = 'Both parents are homozygous for the same allele, so every offspring is identical to them for this gene: the line breeds true.';
      else note = `At least one parent is homozygous dominant (${L}${L}), so every offspring receives a dominant allele and is ${T().dom}.`;
    } else {
      note =
        st.d1 === 'RrYy' && st.d2 === 'RrYy'
          ? 'Mendel’s classic dihybrid cross gives 9 : 3 : 3 : 1, because each gene separately gives 3 : 1 and the two genes are inherited independently (3 : 1 × 3 : 1).'
          : 'Each gene is inherited independently, so the chance of a combination is the product of the chances for each gene. Genes close together on the same chromosome would not behave like this (they are linked).';
    }
    noteEl.textContent = note;
    sim.setBadge(mono ? T().name : 'Two traits');
  }

  /* ---------- Graph: running proportion vs prediction ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ge-graph"]')!, { x: { min: 0, span: 50 }, y: { min: 0, max: 100, step: 20 } });
  function drawGraph() {
    const pred = predicted();
    const target = targetPheno();
    const p = (100 * (pred.pheno.get(target) ?? 0)) / pred.total;
    const xmax = Math.max(50, kids.length);
    graph.opts.x = { min: 0, span: 50, max: xmax, step: xmax > 400 ? 100 : xmax > 100 ? 50 : 10, format: (v) => `${v}` };
    graph.opts.y = { min: 0, max: 100, step: 20, format: (v) => `${v}%` };
    graph.opts.refs = [{ value: p, label: `Predicted ${Math.round(p)}%`, color: 'text-faint' }];
    graph.set('o', { label: `Bred offspring that are ${phenoName(target)} (%)`, color: 'accent', points: hist, width: 2.5 });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="ge-graph"]'));
  }

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const hit = hits.find((h) => h.test(x, y));
    if (!hit) return sim.hideTooltip();
    sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, hit.title, hit.text);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  /** Relabel the genotype buttons with the trait's letter, e.g. PP / Pp / pp. */
  function relabel() {
    for (const name of ['ge-p1', 'ge-p2'])
      root.querySelectorAll<HTMLInputElement>(`input[data-ctrl="${name}"]`).forEach((inp) => {
        const span = inp.nextElementSibling;
        const g = lettered(inp.value);
        const kind = inp.value === 'AA' ? 'homozygous dominant' : inp.value === 'Aa' ? 'heterozygous' : 'homozygous recessive';
        if (span) span.textContent = g;
        inp.setAttribute('aria-label', `${g}, ${kind}`);
      });
  }
  const changed = () => {
    clearKids();
    updateReadouts();
    sim.requestRender();
  };
  const showFor = (v: View) => {
    ui.showWhen('[data-only="mono"]', v === 'mono');
    ui.showWhen('[data-only="di"]', v === 'di');
  };
  const viewCtl = ui.choice<View>('ge-view', (v) => {
    st.view = v;
    showFor(v);
    sim.hideTooltip();
    changed();
  });
  traitSel.addEventListener('change', () => {
    st.trait = traitSel.value;
    relabel();
    changed();
  });
  const p1Ctl = ui.choice<string>('ge-p1', (v) => ((st.p1 = v), changed()));
  const p2Ctl = ui.choice<string>('ge-p2', (v) => ((st.p2 = v), changed()));
  di1.addEventListener('change', () => ((st.d1 = di1.value), changed()));
  di2.addEventListener('change', () => ((st.d2 = di2.value), changed()));
  root.querySelectorAll<HTMLButtonElement>('[data-mono-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const [a, c] = b.dataset.monoPreset!.split('x');
      st.p1 = a;
      st.p2 = c;
      p1Ctl.set(a, false);
      p2Ctl.set(c, false);
      changed();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-di-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const [a, c] = b.dataset.diPreset!.split('x');
      st.d1 = di1.value = a;
      st.d2 = di2.value = c;
      changed();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-breed]').forEach((b) => b.addEventListener('click', () => breed(Number(b.dataset.breed), b.dataset.breed === '1')));
  root.querySelector('[data-clear]')!.addEventListener('click', changed);
  for (const sel of [di1, di2]) sel.innerHTML = DI_GENOTYPES.map((g) => `<option value="${g}"${g === 'RrYy' ? ' selected' : ''}>${g}</option>`).join('');
  showFor('mono');
  relabel();

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set('mono', false);
      traitSel.value = 'flower';
      p1Ctl.set('Aa', false);
      p2Ctl.set('Aa', false);
      di1.value = di2.value = 'RrYy';
      showFor('mono');
      relabel();
      anim = breedTimer = 0;
      clearKids();
      updateReadouts();
    },
  });
  updateReadouts();
}
