/**
 * Ecosystem energy flow and nutrient cycling: two views on one model.
 *   web    – a meadow food web (plants, grasshoppers, rabbits, frogs, foxes,
 *            decomposers). Energy flows one way from the Sun and is lost as heat
 *            at every level; dead matter goes to decomposers, which return
 *            nutrients to the soil for plants to reuse. Energy pyramid.
 *   cycles – the same ecosystem as a carbon cycle or a simplified nitrogen cycle
 *
 * Teaching model (relative biomass units, time in weeks; not measured values):
 *   plants   G' = r·light·G·N/(N+1)·(1 − G/100) − grazing − death
 *   animals  X' = e·food eaten − eaten by predators − death (incl. crowding)
 *   dead matter D' = deaths + egested food − decomposition
 *   decomposers B' = eB·decomposition − death
 *   soil nitrogen N' = release by decomposers + fixation − uptake by plants − losses
 * Each consumer turns about 20 % of the food it eats into its own body (e); about
 * 30 % passes out as waste and the rest is respired as heat. The transfer
 * efficiency between levels is not fixed: it emerges from the populations.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'web' | 'cycles';
type Fs = (px: number, w?: number) => string;
type V2 = [number, number];
type Org = 'G' | 'H' | 'R' | 'F' | 'X' | 'B';

const P = {
  rG: 1.41, K: 100, KN: 1, aH: 0.028, aR: 0.0203, aF: 0.078, aX: 0.0833, e: 0.2, eg: 0.3,
  mG: 0.03, mH: 0.06, qH: 0.02, mR: 0.04, qR: 0.02, mF: 0.05, qF: 0.05, mX: 0.05, qX: 0.05,
  k: 6.35, hD: 20, eB: 0.25, mB: 0.3, qB: 0.123, nC: 0.0356, fix: 0.1, leach: 0.05, u: 0.02,
};
interface State {
  G: number;
  H: number;
  R: number;
  F: number;
  X: number;
  B: number;
  D: number;
  N: number;
}
interface Flows {
  gpp: number;
  eH: number;
  eR: number;
  eF: number;
  eX: number;
  dec: number;
  deaths: Record<Org, number>;
  uptake: number;
  release: number;
  lost: number;
}
function flows(s: State, light: number): Flows {
  const gpp = P.rG * light * s.G * (s.N / (s.N + P.KN)) * Math.max(0, 1 - s.G / P.K);
  return {
    gpp,
    eH: P.aH * s.H * s.G,
    eR: P.aR * s.R * s.G,
    eF: P.aF * s.F * s.H,
    eX: P.aX * s.X * s.R,
    dec: (P.k * s.B * s.D) / (s.D + P.hD),
    deaths: {
      G: P.mG * s.G,
      H: P.mH * s.H + P.qH * s.H * s.H,
      R: P.mR * s.R + P.qR * s.R * s.R,
      F: P.mF * s.F + P.qF * s.F * s.F,
      X: P.mX * s.X + P.qX * s.X * s.X,
      B: P.mB * s.B + P.qB * s.B * s.B,
    },
    uptake: P.u * gpp,
    release: P.nC * ((P.k * s.B * s.D) / (s.D + P.hD)),
    lost: P.leach * s.N,
  };
}
function advance(s: State, light: number, weeks: number) {
  const dt = 0.02;
  for (let t = 0; t < weeks; t += dt) {
    const f = flows(s, light);
    const dG = f.gpp - f.eH - f.eR - f.deaths.G;
    const dH = P.e * f.eH - f.eF - f.deaths.H;
    const dR = P.e * f.eR - f.eX - f.deaths.R;
    const dF = P.e * f.eF - f.deaths.F;
    const dX = P.e * f.eX - f.deaths.X;
    const dB = P.eB * f.dec - f.deaths.B;
    const allDeaths = f.deaths.G + f.deaths.H + f.deaths.R + f.deaths.F + f.deaths.X + f.deaths.B;
    const dD = allDeaths + P.eg * (f.eH + f.eR + f.eF + f.eX) - f.dec;
    const dN = f.release + P.fix - f.uptake - f.lost;
    s.G = Math.max(0, s.G + dG * dt);
    s.H = Math.max(0, s.H + dH * dt);
    s.R = Math.max(0, s.R + dR * dt);
    s.F = Math.max(0, s.F + dF * dt);
    s.X = Math.max(0, s.X + dX * dt);
    s.B = Math.max(0, s.B + dB * dt);
    s.D = Math.max(0, s.D + dD * dt);
    s.N = Math.max(0, s.N + dN * dt);
    // a population that falls very low has died out
    for (const key of ['H', 'R', 'F', 'X', 'B'] as const) if (s[key] < 0.01) s[key] = 0;
  }
}
/** The balanced community the model settles to with normal sunlight. */
const EQ: State = (() => {
  const s: State = { G: 60, H: 8, R: 6, F: 1.5, X: 1, B: 4, D: 20, N: 2 };
  advance(s, 1, 600);
  return s;
})();
const EQF = flows(EQ, 1);

export const ORGS: Record<Org, { name: string; emoji: string; role: string; eats: string; eatenBy: string; colour: string }> = {
  G: { name: 'Plants', emoji: '🌿', role: 'Producer: captures light energy by photosynthesis', eats: 'Nothing: makes its own food', eatenBy: 'Grasshoppers and rabbits', colour: '#3fae5a' },
  H: { name: 'Grasshoppers', emoji: '🦗', role: 'Primary consumer (herbivore)', eats: 'Plants', eatenBy: 'Frogs', colour: '#9bbf3a' },
  R: { name: 'Rabbits', emoji: '🐇', role: 'Primary consumer (herbivore)', eats: 'Plants', eatenBy: 'Foxes', colour: '#b98a63' },
  F: { name: 'Frogs', emoji: '🐸', role: 'Secondary consumer (carnivore)', eats: 'Grasshoppers', eatenBy: 'Nothing in this model', colour: '#4caf50' },
  X: { name: 'Foxes', emoji: '🦊', role: 'Secondary consumer (carnivore)', eats: 'Rabbits', eatenBy: 'Nothing in this model', colour: '#e07a3f' },
  B: { name: 'Decomposers', emoji: '🍄', role: 'Decomposers (fungi and bacteria)', eats: 'Dead matter and waste from every level', eatenBy: 'Nothing in this model', colour: '#a1887f' },
};

export function initEcosystem(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const orgSel = root.querySelector<HTMLSelectElement>('[data-org]')!;

  const DEF = { view: 'web' as View, cycle: 'carbon' as 'carbon' | 'nitrogen', show: 'both' as 'energy' | 'matter' | 'both', light: 100, speed: 4 };
  const st = { ...DEF };
  let s: State = { ...EQ };
  let weeks = 0;
  let anim = 0;
  let lastEvent = '';
  let hist: Record<string, Point[]> = {};
  const light = () => st.light / 100;

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 20, 680, 940] : [0, 20, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  const panelAt = () => (portrait() ? { x: 30, y: 640, w: 620 } : { x: 705, y: 120, w: 280 });

  /* ---------- Web geometry ---------- */
  const NODE: Record<string, V2> = { sun: [70, 75], G: [300, 470], H: [165, 330], R: [435, 330], F: [165, 175], X: [435, 175], D: [600, 330], B: [600, 470], N: [450, 565] };
  type Edge = { from: string; to: string; kind: 'energy' | 'dead' | 'nutrient'; rate: () => number; bend: number };
  const vis = (flow: number) => 5 * Math.pow(Math.max(0, flow) / EQF.gpp, 0.55);
  const EDGES: Edge[] = [
    { from: 'sun', to: 'G', kind: 'energy', rate: () => vis(flows(s, light()).gpp) * 1.4, bend: 0.15 },
    { from: 'G', to: 'H', kind: 'energy', rate: () => vis(P.e * flows(s, light()).eH), bend: 0.1 },
    { from: 'G', to: 'R', kind: 'energy', rate: () => vis(P.e * flows(s, light()).eR), bend: -0.1 },
    { from: 'H', to: 'F', kind: 'energy', rate: () => vis(P.e * flows(s, light()).eF), bend: 0 },
    { from: 'R', to: 'X', kind: 'energy', rate: () => vis(P.e * flows(s, light()).eX), bend: 0 },
    ...(['G', 'H', 'R', 'F', 'X'] as Org[]).map((o) => ({ from: o, to: 'D', kind: 'dead' as const, rate: () => vis(flows(s, light()).deaths[o] * 1.5), bend: o === 'G' ? -0.2 : 0.12 })),
    { from: 'D', to: 'B', kind: 'dead', rate: () => vis(flows(s, light()).dec), bend: 0 },
    { from: 'B', to: 'N', kind: 'nutrient', rate: () => vis(flows(s, light()).release * 25), bend: 0.2 },
    { from: 'N', to: 'G', kind: 'nutrient', rate: () => vis(flows(s, light()).uptake * 25), bend: 0.2 },
  ];
  const curve = (a: V2, b: V2, bend: number, t: number): V2 => {
    const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
    const my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]];
  };

  /* ---------- Cycle geometry (same region) ---------- */
  interface Path {
    id: string;
    label: string;
    text: string;
    pts: V2[];
    rate: () => number;
    cycle: 'carbon' | 'nitrogen';
    lx: number;
    ly: number;
  }
  const animalIntake = () => {
    const f = flows(s, light());
    return f.eH + f.eR + f.eF + f.eX;
  };
  const totalDeaths = () => Object.values(flows(s, light()).deaths).reduce((a, b) => a + b, 0);
  const PATHS: Path[] = [
    // carbon: gross photosynthesis = new plant growth + plant respiration (taken as half of new growth)
    { id: 'photo', cycle: 'carbon', label: 'Photosynthesis', lx: 80, ly: 190, text: 'Plants take in carbon dioxide from the air and use light energy to build it into glucose and other carbon compounds.', pts: [[85, 110], [70, 210], [105, 275]], rate: () => vis(1.5 * flows(s, light()).gpp) },
    { id: 'presp', cycle: 'carbon', label: 'Respiration', lx: 215, ly: 165, text: 'Plants respire too, releasing part of the carbon they fix back to the air as carbon dioxide.', pts: [[145, 270], [190, 190], [190, 110]], rate: () => vis(0.5 * flows(s, light()).gpp) },
    { id: 'feed', cycle: 'carbon', label: 'Feeding', lx: 228, ly: 335, text: 'Carbon compounds pass to animals when they eat plants or other animals.', pts: [[160, 300], [235, 318], [300, 305]], rate: () => vis(animalIntake()) },
    { id: 'aresp', cycle: 'carbon', label: 'Respiration', lx: 385, ly: 185, text: 'Animals respire, releasing carbon dioxide; this is where most of the energy in their food is lost as heat.', pts: [[340, 270], [355, 190], [350, 110]], rate: () => vis(0.5 * animalIntake()) },
    { id: 'death', cycle: 'carbon', label: 'Death and waste', lx: 300, ly: 395, text: 'Dead organisms, shed leaves and faeces still contain carbon compounds.', pts: [[150, 330], [330, 372], [495, 368]], rate: () => vis(totalDeaths()) },
    { id: 'dec', cycle: 'carbon', label: 'Decomposition', lx: 465, ly: 440, text: 'Fungi and bacteria feed on dead matter and digest it.', pts: [[530, 388], [555, 425], [580, 455]], rate: () => vis(flows(s, light()).dec) },
    { id: 'dresp', cycle: 'carbon', label: 'Respiration', lx: 605, ly: 230, text: 'Decomposers respire, returning the carbon of dead matter to the air as carbon dioxide.', pts: [[615, 450], [665, 280], [610, 110]], rate: () => vis((1 - P.eB) * flows(s, light()).dec) },
    // nitrogen
    { id: 'fix', cycle: 'nitrogen', label: 'Nitrogen fixation', lx: 90, ly: 230, text: 'Nitrogen-fixing bacteria (in soil and in root nodules of plants such as peas and clover) turn nitrogen gas from the air into ammonium. Lightning fixes a little too.', pts: [[45, 110], [30, 430], [325, 470]], rate: () => vis(P.fix * 40) },
    { id: 'nitr', cycle: 'nitrogen', label: 'Nitrification', lx: 262, ly: 515, text: 'Nitrifying bacteria in the soil turn ammonium into nitrates, the form most plants absorb.', pts: [[330, 485], [262, 500], [200, 478]], rate: () => vis(flows(s, light()).uptake * 25) },
    { id: 'upt', cycle: 'nitrogen', label: 'Absorbed by roots', lx: 100, ly: 405, text: 'Plants absorb nitrates through their roots and use the nitrogen to make proteins and DNA.', pts: [[155, 455], [125, 395], [120, 335]], rate: () => vis(flows(s, light()).uptake * 25) },
    { id: 'nfeed', cycle: 'nitrogen', label: 'Feeding', lx: 228, ly: 335, text: 'Animals get nitrogen by eating plants (or other animals) and digesting their proteins.', pts: [[160, 300], [235, 318], [300, 305]], rate: () => vis(animalIntake()) },
    { id: 'ndeath', cycle: 'nitrogen', label: 'Death and waste', lx: 300, ly: 395, text: 'Dead organisms, urine and faeces contain nitrogen compounds such as proteins and urea.', pts: [[150, 330], [330, 372], [495, 368]], rate: () => vis(totalDeaths()) },
    { id: 'amm', cycle: 'nitrogen', label: 'Ammonification', lx: 470, ly: 530, text: 'Decomposers break down proteins and urea in dead matter and waste, releasing the nitrogen as ammonium in the soil.', pts: [[575, 470], [470, 505], [395, 490]], rate: () => vis(flows(s, light()).release * 25) },
    { id: 'denit', cycle: 'nitrogen', label: 'Denitrification', lx: 300, ly: 230, text: 'In waterlogged, airless soil, denitrifying bacteria turn nitrates back into nitrogen gas. Rain can also wash nitrates out of the soil (leaching).', pts: [[195, 455], [255, 300], [255, 110]], rate: () => vis(flows(s, light()).lost * 12) },
  ];
  const along = (pts: V2[], t: number): V2 => {
    const [a, m, b] = pts;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], u * u * a[1] + 2 * u * t * m[1] + t * t * b[1]];
  };

  /* ---------- Particles ---------- */
  interface Particle {
    key: string; // edge index or path id
    t: number;
    kind: 'energy' | 'dead' | 'nutrient' | 'heat' | 'atom';
    x?: number;
    y?: number;
  }
  let parts: Particle[] = [];
  const acc = new Map<string, number>();
  function spawn(key: string, rate: number, dt: number, kind: Particle['kind']) {
    const a = (acc.get(key) ?? Math.random()) + rate * dt;
    acc.set(key, a % 1);
    for (let i = 0; i < Math.floor(a); i++) if (parts.length < 260) parts.push({ key, t: 0, kind });
  }

  /* ---------- Time ---------- */
  function step(dt: number) {
    anim += dt;
    const w = dt * st.speed;
    advance(s, light(), w);
    weeks += w;
    // history every half week, last 100 weeks
    const last = hist.G?.[hist.G.length - 1];
    if (!last || weeks - last.x >= 0.5) {
      for (const key of ['G', 'H', 'R', 'F', 'X', 'B'] as Org[]) (hist[key] ??= []).push({ x: weeks, y: (100 * s[key]) / EQ[key] });
      (hist.N ??= []).push({ x: weeks, y: (100 * s.N) / EQ.N });
      for (const key in hist) while (hist[key].length && hist[key][0].x < weeks - 100) hist[key].shift();
    }
    // particles
    if (st.view === 'web') {
      EDGES.forEach((e, i) => {
        if (st.show === 'energy' && e.kind !== 'energy') return;
        if (st.show === 'matter' && e.kind === 'energy') return;
        spawn(`e${i}`, e.rate(), dt, e.kind);
      });
      if (st.show !== 'matter') {
        const f = flows(s, light());
        const heat: Record<string, number> = { G: f.gpp * 0.5, H: 0.5 * f.eH, R: 0.5 * f.eR, F: 0.5 * f.eF, X: 0.5 * f.eX, B: 0.75 * f.dec };
        for (const [n, h] of Object.entries(heat)) spawn(`h${n}`, vis(h) * 0.9, dt, 'heat');
      }
    } else {
      for (const p of PATHS) if (p.cycle === st.cycle) spawn(p.id, p.rate(), dt, 'atom');
    }
    for (const p of parts) p.t += dt * (p.kind === 'heat' ? 0.7 : 0.45);
    parts = parts.filter((p) => p.t < 1);
  }

  /* ---------- Drawing helpers ---------- */
  function tag(text: string, x: number, y: number, fs: Fs, k: number, bg?: string) {
    const small = portrait();
    ctx.font = fs(small ? 9.5 : 11, 700);
    const tw = ctx.measureText(text).width;
    const ph = (small ? 17 : 20) / k;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = bg ?? pal['bg-elev'];
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
  const emojiFont = (px: number) => `${px}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  function emoji(ch: string, x: number, y: number, px: number, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.font = emojiFont(px);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }
  interface Hit {
    test: (x: number, y: number) => boolean;
    title: string;
    text: string;
  }
  let hits: Hit[] = [];

  /* ---------- Web view ---------- */
  let selected: Org | null = null;
  function drawWeb(fs: Fs, k: number) {
    // ground and soil
    ctx.fillStyle = 'rgba(120, 200, 120, 0.06)';
    ctx.fillRect(10, 120, 680, 395);
    ctx.fillStyle = 'rgba(140, 100, 60, 0.18)';
    ctx.fillRect(10, 515, 680, 85);
    tag('Soil', 650, 560, fs, k);
    // edges
    EDGES.forEach((e) => {
      const a = NODE[e.from];
      const b = NODE[e.to];
      const hiddenKind = (st.show === 'energy' && e.kind !== 'energy') || (st.show === 'matter' && e.kind === 'energy');
      const lit = selected && (e.from === selected || e.to === selected);
      ctx.strokeStyle = e.kind === 'energy' ? '#f2c94c' : e.kind === 'dead' ? '#a1887f' : '#4caf50';
      ctx.globalAlpha = hiddenKind ? 0.12 : lit ? 1 : 0.45;
      ctx.lineWidth = (lit ? 3.5 : 2) / k;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const p = curve(a, b, e.bend, i / 20);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
      // arrow head
      const p1 = curve(a, b, e.bend, 0.72);
      const p0 = curve(a, b, e.bend, 0.66);
      const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(p1[0] + Math.cos(ang) * 9, p1[1] + Math.sin(ang) * 9);
      ctx.lineTo(p1[0] + Math.cos(ang + 2.5) * 9, p1[1] + Math.sin(ang + 2.5) * 9);
      ctx.lineTo(p1[0] + Math.cos(ang - 2.5) * 9, p1[1] + Math.sin(ang - 2.5) * 9);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // particles
    for (const p of parts) {
      if (p.key.startsWith('e')) {
        const e = EDGES[Number(p.key.slice(1))];
        const [x, y] = curve(NODE[e.from], NODE[e.to], e.bend, p.t);
        ctx.fillStyle = e.kind === 'energy' ? '#ffd23f' : e.kind === 'dead' ? '#8d6e63' : '#43a047';
        ctx.beginPath();
        ctx.arc(x, y, e.kind === 'energy' ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.key.startsWith('h')) {
        const n = NODE[p.key.slice(1)];
        const x = n[0] + Math.sin(p.t * 8 + p.key.length) * 8 + 26;
        const y = n[1] - 20 - p.t * 60;
        ctx.strokeStyle = '#e63946';
        ctx.globalAlpha = 1 - p.t;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 5, y - 6, x, y - 12);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // sun
    ctx.fillStyle = '#ffd23f';
    ctx.globalAlpha = 0.25 + 0.5 * clamp(light(), 0, 1.5) / 1.5;
    ctx.beginPath();
    ctx.arc(NODE.sun[0], NODE.sun[1], 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    emoji('☀️', NODE.sun[0], NODE.sun[1], 40);
    tag('Sunlight', NODE.sun[0], NODE.sun[1] + 46, fs, k);
    hits.push({ test: (x, y) => Math.hypot(x - NODE.sun[0], y - NODE.sun[1]) < 36, title: 'The Sun', text: 'The source of almost all energy in the ecosystem. Plants capture only a small share (often about 1–2 %) of the sunlight that reaches them.' });
    // organisms
    for (const o of Object.keys(ORGS) as Org[]) {
      const [x, y] = NODE[o];
      const rel = EQ[o] > 0 ? s[o] / EQ[o] : 0;
      const r = 26 * clamp(Math.sqrt(rel), 0.35, 1.7);
      const gone = s[o] === 0;
      ctx.fillStyle = gone ? pal.border : ORGS[o].colour;
      ctx.globalAlpha = gone ? 0.5 : 0.25;
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (selected === o) {
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 3 / k;
        ctx.beginPath();
        ctx.arc(x, y, r + 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      emoji(ORGS[o].emoji, x, y, Math.max(18, r * 1.2), gone ? 0.3 : 1);
      tag(gone ? `${ORGS[o].name}: gone` : `${ORGS[o].name} ${Math.round(rel * 100)}%`, x, y + Math.max(r + 22, 40), fs, k, gone ? 'rgba(230, 57, 70, 0.25)' : undefined);
      hits.push({
        test: (px, py) => Math.hypot(px - x, py - y) < Math.max(r + 10, 26),
        title: ORGS[o].name,
        text: `${ORGS[o].role}. Eats: ${ORGS[o].eats}. Eaten by: ${ORGS[o].eatenBy}. Population: ${gone ? 'gone' : `${Math.round(rel * 100)}% of the balanced level`}.`,
      });
    }
    // dead matter and soil nutrients
    const dRel = s.D / EQ.D;
    emoji('🍂', NODE.D[0], NODE.D[1], 22 + 10 * clamp(Math.sqrt(dRel), 0.4, 3));
    tag(`Dead matter ${Math.round(dRel * 100)}%`, NODE.D[0], NODE.D[1] + 38, fs, k);
    hits.push({ test: (x, y) => Math.hypot(x - NODE.D[0], y - NODE.D[1]) < 30, title: 'Dead matter and waste', text: 'Dead plants and animals, fallen leaves and droppings. It still holds energy and nutrients, which only decomposers can release.' });
    const nRel = s.N / EQ.N;
    ctx.fillStyle = '#43a047';
    for (let i = 0; i < Math.round(clamp(nRel, 0, 3) * 10); i++) {
      ctx.beginPath();
      ctx.arc(NODE.N[0] - 60 + ((i * 37) % 120), NODE.N[1] - 8 + ((i * 13) % 20), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    tag(`Soil nutrients ${Math.round(nRel * 100)}%`, NODE.N[0], NODE.N[1] + 20, fs, k);
    hits.push({ test: (x, y) => Math.hypot(x - NODE.N[0], y - NODE.N[1]) < 40, title: 'Soil nutrients', text: 'Mineral nutrients such as nitrates, released by decomposers and absorbed by plant roots. Here, nitrogen limits how fast plants can grow.' });
    drawPyramid(fs, k);
  }

  function drawPyramid(fs: Fs, k: number) {
    const P0 = panelAt();
    const tall = portrait();
    const f = flows(s, light());
    const lv = [
      { name: 'Producers', v: f.gpp, c: '#3fae5a' },
      { name: 'Herbivores', v: P.e * (f.eH + f.eR), c: '#9bbf3a' },
      { name: 'Carnivores', v: P.e * (f.eF + f.eX), c: '#e07a3f' },
    ];
    ctx.textAlign = 'left';
    ctx.font = fs(13, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Energy pyramid', P0.x, P0.y);
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('New biomass per week (relative)', P0.x, P0.y + 16 / k);
    const maxV = Math.max(EQF.gpp * 1.5, lv[0].v);
    const cx = P0.x + P0.w / 2;
    const top = P0.y + 30 / k;
    const bh = tall ? 34 : 38;
    lv.slice()
      .reverse()
      .forEach((l, i) => {
        const y = top + i * (bh + 22 / k);
        const w = Math.max(4, (P0.w - 10) * Math.sqrt(l.v / maxV));
        ctx.fillStyle = l.c;
        ctx.fillRect(cx - w / 2, y, w, bh);
        const idx = 2 - i;
        const pct = idx === 0 ? '' : ` · ${lv[idx - 1].v > 0 ? Math.round((100 * l.v) / lv[idx - 1].v) : 0}% of the level below`;
        ctx.font = fs(10.5, 700);
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'center';
        ctx.fillText(`${l.name}: ${l.v.toFixed(l.v < 1 ? 2 : 1)}${pct}`, cx, y + bh + 14 / k);
      });
    // on phones the colour key is in the instructions below the simulator
    if (tall) return;
    let y = top + 3 * (bh + 22 / k) + 10 / k;
    ctx.textAlign = 'left';
    ctx.font = fs(10.5, 700);
    const items: [string, string][] = [
      ['#ffd23f', '● Energy in food'],
      ['#e63946', '~ Energy lost as heat'],
      ['#8d6e63', '● Dead matter'],
      ['#43a047', '● Nutrients recycled'],
    ];
    for (const [c, t] of items) {
      ctx.fillStyle = c;
      ctx.fillText(t, P0.x, y);
      y += 16 / k;
    }
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('Widths on a square-root scale', P0.x, y + 4 / k);
  }

  /* ---------- Cycles view ---------- */
  function drawCycles(fs: Fs, k: number) {
    const carbon = st.cycle === 'carbon';
    // sky, ground, soil
    ctx.fillStyle = 'rgba(120, 180, 230, 0.1)';
    ctx.fillRect(10, 20, 680, 340);
    ctx.fillStyle = 'rgba(140, 100, 60, 0.2)';
    ctx.fillRect(10, 395, 680, 205);
    ctx.fillStyle = 'rgba(120, 200, 120, 0.25)';
    ctx.fillRect(10, 360, 680, 35);
    // air pool
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    ctx.roundRect(25, 40, 650, 70, 14);
    ctx.fill();
    ctx.stroke();
    tag(carbon ? 'Air: carbon dioxide (CO₂)' : 'Air: nitrogen gas (N₂), 78% of the air', 350, 75, fs, k);
    hits.push({ test: (x, y) => x > 25 && x < 675 && y > 40 && y < 110, title: carbon ? 'Carbon dioxide in the air' : 'Nitrogen gas in the air', text: carbon ? 'About 0.04 % of the air. Photosynthesis removes it; respiration, decomposition and burning return it.' : 'Most living things cannot use nitrogen gas directly; it must first be fixed into ammonium or nitrates by bacteria (or lightning).' });
    // organisms and pools
    const animalsRel = (s.H + s.R + s.F + s.X) / (EQ.H + EQ.R + EQ.F + EQ.X);
    emoji('🌳', 120, 300, 30 + 22 * clamp(Math.sqrt(s.G / EQ.G), 0.4, 1.5));
    tag(`Plants ${Math.round((100 * s.G) / EQ.G)}%`, 105, 352, fs, k);
    emoji('🐇', 320, 300, 26 * clamp(Math.sqrt(animalsRel), 0.4, 1.6));
    emoji('🦊', 365, 288, 22 * clamp(Math.sqrt(s.X / EQ.X || 0), 0.3, 1.6), s.X > 0 ? 1 : 0.25);
    tag(`Animals ${Math.round(animalsRel * 100)}%`, 345, 345, fs, k);
    emoji('🍂', 520, 372, 20 + 8 * clamp(Math.sqrt(s.D / EQ.D), 0.4, 3));
    tag(`Dead matter ${Math.round((100 * s.D) / EQ.D)}%`, 560, 410, fs, k);
    emoji('🍄', 595, 470, 30 * clamp(Math.sqrt(s.B / EQ.B || 0), 0.3, 1.5), s.B > 0 ? 1 : 0.25);
    tag(s.B > 0 ? `Decomposers ${Math.round((100 * s.B) / EQ.B)}%` : 'Decomposers: gone', 610, 505, fs, k);
    if (!carbon) {
      const nRel = s.N / EQ.N;
      tag('Ammonium (NH₄⁺)', 360, 465, fs, k);
      tag(`Nitrates (NO₃⁻) ${Math.round(nRel * 100)}%`, 150, 488, fs, k);
      ctx.fillStyle = '#43a047';
      for (let i = 0; i < Math.round(clamp(nRel, 0, 3) * 8); i++) {
        ctx.beginPath();
        ctx.arc(130 + ((i * 29) % 90), 448 + ((i * 11) % 16), 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // process paths, labels and moving atoms
    const paths = PATHS.filter((p) => p.cycle === st.cycle);
    for (const p of paths) {
      ctx.strokeStyle = carbon ? '#8fa3bf' : '#4c8dd6';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2 / k;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const q = along(p.pts, i / 20);
        if (i) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      const q1 = along(p.pts, 0.98);
      const q0 = along(p.pts, 0.9);
      const ang = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
      ctx.fillStyle = carbon ? '#8fa3bf' : '#4c8dd6';
      ctx.beginPath();
      ctx.moveTo(q1[0] + Math.cos(ang) * 8, q1[1] + Math.sin(ang) * 8);
      ctx.lineTo(q1[0] + Math.cos(ang + 2.5) * 8, q1[1] + Math.sin(ang + 2.5) * 8);
      ctx.lineTo(q1[0] + Math.cos(ang - 2.5) * 8, q1[1] + Math.sin(ang - 2.5) * 8);
      ctx.fill();
    }
    for (const part of parts) {
      const p = paths.find((q) => q.id === part.key);
      if (!p) continue;
      const [x, y] = along(p.pts, part.t);
      ctx.fillStyle = carbon ? '#5c677d' : '#2f6fc0';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = fs(8, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(carbon ? 'C' : 'N', x, y + 0.5);
      ctx.textBaseline = 'alphabetic';
    }
    for (const p of paths) {
      const { lx, ly } = p;
      const stopped = p.rate() < 0.05;
      tag(stopped ? `${p.label} (stopped)` : p.label, lx, ly, fs, k, stopped ? 'rgba(230, 57, 70, 0.3)' : undefined);
      hits.push({ test: (x, y) => Math.abs(x - lx) < 70 && Math.abs(y - ly) < 14, title: p.label, text: p.text });
    }
    drawPools(fs, k);
  }

  function drawPools(fs: Fs, k: number) {
    const P0 = panelAt();
    const tall = portrait();
    const f = flows(s, light());
    const carbon = st.cycle === 'carbon';
    ctx.textAlign = 'left';
    ctx.font = fs(13, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(carbon ? 'Carbon flows per week' : 'Nitrogen flows per week', P0.x, P0.y);
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('Relative units in this model', P0.x, P0.y + 16 / k);
    const rows: [string, number, string][] = carbon
      ? [
          ['Taken in by photosynthesis', 1.5 * f.gpp, '#3fae5a'],
          ['Returned by plants and animals', f.gpp * 0.5 + 0.5 * (f.eH + f.eR + f.eF + f.eX), '#8fa3bf'],
          ['Returned by decomposers', f.dec * (1 - P.eB), '#a1887f'],
        ]
      : [
          ['Absorbed by plants', f.uptake * 25, '#3fae5a'],
          ['Returned by decomposers', f.release * 25, '#a1887f'],
          ['Fixed from the air', P.fix * 25, '#4c8dd6'],
          ['Lost (denitrification, leaching)', f.lost * 25, '#e63946'],
        ];
    const maxV = Math.max(...rows.map((r) => r[1]), carbon ? 1.5 * EQF.gpp : EQF.uptake * 25) * 1.1;
    let y = P0.y + 40 / k;
    const cols = tall ? 2 : 1;
    const cw = tall ? (P0.w - 20) / 2 : P0.w;
    rows.forEach(([label, v, c], i) => {
      const x = P0.x + (i % cols) * (cw + 20);
      const yy = y + Math.floor(i / cols) * (44 / k);
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = pal['sim-text'];
      // short labels on phones, where two columns share the width
      const short: Record<string, string> = {
        'Taken in by photosynthesis': 'Photosynthesis',
        'Returned by plants and animals': 'Plants and animals',
        'Returned by decomposers': 'Decomposers',
        'Absorbed by plants': 'Absorbed',
        'Fixed from the air': 'Fixed',
        'Lost (denitrification, leaching)': 'Lost',
      };
      ctx.fillText(`${tall ? (short[label] ?? label) : label}: ${v.toFixed(1)}`, x, yy);
      ctx.fillStyle = pal.border;
      ctx.fillRect(x, yy + 6 / k, cw, 10 / k);
      ctx.fillStyle = c;
      ctx.fillRect(x, yy + 6 / k, (cw * v) / maxV, 10 / k);
    });
    y += Math.ceil(rows.length / cols) * (44 / k);
    if (!tall) {
      ctx.font = fs(10.5, 600);
      ctx.fillStyle = pal['text-faint'];
      const msg = carbon ? 'In a balanced ecosystem the carbon taken in roughly equals the carbon returned.' : 'Nitrogen keeps cycling between soil, plants, animals and decomposers.';
      wrap(msg, P0.x, y + 6 / k, P0.w, 15 / k);
    }
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

  /* ---------- Render and readouts ---------- */
  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    hits = [];
    // the click hint only fits in the wide food-web layout
    if (hintEl) hintEl.style.display = st.view === 'web' && !portrait() ? '' : 'none';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    if (st.view === 'web') drawWeb(fs, k);
    else drawCycles(fs, k);
    ctx.restore();
    updateReadouts();
    drawGraph();
  }

  function biggestChange() {
    let best: Org | null = null;
    let bestD = 0.08;
    // the knock-on effect: ignore organisms that were removed
    for (const o of ['G', 'H', 'R', 'F', 'X', 'B'] as Org[]) {
      if (s[o] === 0) continue;
      const d = Math.abs(s[o] / EQ[o] - 1);
      if (d > bestD) (bestD = d), (best = o);
    }
    return best;
  }
  function updateReadouts() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    const f = flows(s, light());
    const herb = P.e * (f.eH + f.eR);
    const carn = P.e * (f.eF + f.eX);
    const nRel = s.N / EQ.N;
    const dRel = s.D / EQ.D;
    if (st.view === 'web') {
      r('r1', 'Energy captured by plants', `${f.gpp.toFixed(1)} units per week`);
      r('r2', 'Reaching herbivores', `${herb.toFixed(1)} (${f.gpp ? Math.round((100 * herb) / f.gpp) : 0}% of plant production)`);
      r('r3', 'Reaching carnivores', `${carn.toFixed(2)} (${herb ? Math.round((100 * carn) / herb) : 0}% of herbivore production)`);
      r('r4', 'Soil nutrients', `${Math.round(nRel * 100)}% of the balanced level`, nRel < 0.5 ? 'bad' : nRel < 0.8 ? 'warn' : null);
      r('r5', 'Dead matter', `${Math.round(dRel * 100)}% of the balanced level`, dRel > 3 ? 'bad' : dRel > 1.5 ? 'warn' : null);
    } else if (st.cycle === 'carbon') {
      const inC = 1.5 * f.gpp;
      const outC = f.gpp * 0.5 + 0.5 * (f.eH + f.eR + f.eF + f.eX) + f.dec * (1 - P.eB);
      r('r1', 'Carbon taken from the air', `${inC.toFixed(1)} per week`);
      r('r2', 'Carbon returned to the air', `${outC.toFixed(1)} per week`);
      r('r3', 'Balance', Math.abs(inC - outC) < 0.15 * inC ? 'Roughly balanced' : inC > outC ? 'More taken in than returned: carbon is building up in living or dead matter' : 'More returned than taken in', Math.abs(inC - outC) < 0.15 * inC ? 'ok' : 'warn');
      r('r4', 'Carbon locked in dead matter', `${Math.round(dRel * 100)}% of the balanced level`, dRel > 2 ? 'warn' : null);
      r('r5', 'Decomposition', s.B > 0 ? `${Math.round((100 * f.dec) / EQF.dec)}% of the balanced rate` : 'Stopped: no decomposers', s.B > 0 ? null : 'bad');
    } else {
      r('r1', 'Absorbed by plants', `${(f.uptake * 25).toFixed(1)} per week`);
      r('r2', 'Returned by decomposers', `${(f.release * 25).toFixed(1)} per week`, s.B > 0 ? null : 'bad');
      r('r3', 'Fixed from the air', `${(P.fix * 25).toFixed(1)} per week`);
      r('r4', 'Soil nitrates', `${Math.round(nRel * 100)}% of the balanced level`, nRel < 0.5 ? 'bad' : nRel < 0.8 ? 'warn' : null);
      r('r5', 'Lost from the soil', `${(f.lost * 25).toFixed(1)} per week`);
    }
    sim.setBadge(`Week ${Math.floor(weeks)}`);
    // explanation
    const big = biggestChange();
    let note = st.view === 'web'
      ? 'Energy (yellow) flows one way: from the Sun to plants, then to animals, and every level loses most of it as heat (red). Nutrients (green) are different: decomposers return them to the soil, and plants use them again.'
      : st.cycle === 'carbon'
        ? 'Carbon atoms go round and round: from the air into plants, through animals and decomposers, and back to the air by respiration. Click a process to learn what happens.'
        : 'Nitrogen also cycles, but most organisms cannot use nitrogen gas. Bacteria do most of the work: fixing, nitrifying, decomposing and denitrifying.';
    if (s.B === 0) note = 'Without decomposers, dead matter piles up and its nutrients stay locked away. Soil nutrients run low, plants grow more slowly and every animal that depends on them declines. Energy still flows from the Sun, but nutrients stop cycling.';
    else if (lastEvent && big) {
      const name = ORGS[big].name.toLowerCase();
      note = `${lastEvent} So far the biggest change is in ${name}: now ${Math.round((100 * s[big]) / EQ[big])}% of their balanced level. Changes spread through the food web: predators depend on their prey, and herbivores on plants.`;
    }
    noteEl.textContent = note;
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="eco-graph"]')!, { x: { min: 0, span: 100 }, y: { min: 0, max: 250, step: 50 } });
  function drawGraph() {
    graph.opts.x = { min: Math.max(0, weeks - 100), span: 100, max: Math.max(100, weeks), step: 20, format: (v) => `wk ${Math.round(v)}` };
    const top = Math.max(200, ...Object.values(hist).flat().map((p) => p.y));
    graph.opts.y = { min: 0, max: Math.ceil(top / 50) * 50, step: top > 400 ? 100 : 50, format: (v) => `${v}%` };
    graph.opts.refs = [{ value: 100, label: 'Balanced', color: 'text-faint' }];
    for (const o of ['G', 'H', 'R', 'F', 'X', 'B'] as Org[]) graph.set(o, { label: ORGS[o].name, color: ORGS[o].colour, points: hist[o] ?? [], width: 2.2 });
    graph.set('N', { label: 'Soil nutrients', color: '#43a047', points: hist.N ?? [], width: 1.6, dash: [5, 4] });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="eco-graph"]'));
  }

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const hit = [...hits].reverse().find((h) => h.test(x, y));
    if (st.view === 'web') {
      const org = (Object.keys(ORGS) as Org[]).find((o) => Math.hypot(x - NODE[o][0], y - NODE[o][1]) < 34);
      selected = org ?? null;
      if (org) orgSel.value = org;
    }
    if (!hit) return (sim.hideTooltip(), sim.requestRender());
    sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, hit.title, hit.text);
    sim.requestRender();
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');
  const showFor = (v: View) => {
    // the hint would cover the soil pools in the cycle diagrams
    if (hintEl) hintEl.style.display = v === 'web' ? '' : 'none';
    ui.showWhen('[data-only="web"]', v === 'web');
    ui.showWhen('[data-only="cycles"]', v === 'cycles');
  };
  const viewCtl = ui.choice<View>('eco-view', (v) => {
    st.view = v;
    parts = [];
    showFor(v);
    sim.hideTooltip();
    updateReadouts();
    sim.requestRender();
  });
  const cycleCtl = ui.choice<'carbon' | 'nitrogen'>('eco-cycle', (v) => ((st.cycle = v), (parts = []), updateReadouts(), sim.requestRender()));
  const showCtl = ui.choice<'energy' | 'matter' | 'both'>('eco-show', (v) => ((st.show = v), (parts = []), sim.requestRender()));
  const lightCtl = ui.range('eco-light', (v) => `${v}% of normal`, (v) => {
    st.light = v;
    lastEvent = `Sunlight changed to ${v}% of normal.`;
    updateReadouts();
    sim.requestRender();
  });
  const speedCtl = ui.range('eco-speed', (v) => `${v} weeks per second`, (v) => (st.speed = v));
  function act(o: Org, how: 'remove' | 'halve' | 'double' | 'restore') {
    const name = ORGS[o].name;
    if (how === 'remove') s[o] = 0;
    else if (how === 'halve') s[o] = s[o] / 2;
    else if (how === 'double') s[o] = Math.max(s[o], 0) * 2 || EQ[o] * 0.5;
    else s[o] = EQ[o];
    lastEvent = how === 'remove' ? `${name} removed.` : how === 'halve' ? `${name} halved.` : how === 'double' ? `${name} doubled.` : `${name} restored.`;
    selected = o;
    if (!sim.running) sim.play();
    updateReadouts();
    sim.requestRender();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => act(orgSel.value as Org, b.dataset.act as 'remove' | 'halve' | 'double' | 'restore')));
  orgSel.addEventListener('change', () => ((selected = orgSel.value as Org), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((b) =>
    b.addEventListener('click', () => {
      const sc = b.dataset.scenario!;
      s = { ...EQ };
      st.light = 100;
      lightCtl.set(100, false);
      lastEvent = '';
      if (sc === 'nofox') (s.X = 0), (lastEvent = 'Foxes removed.');
      if (sc === 'nodecomp') (s.B = 0), (lastEvent = 'Decomposers removed.');
      if (sc === 'shade') (st.light = 50), lightCtl.set(50, false), (lastEvent = 'Sunlight halved.');
      if (sc === 'nofrog') (s.F = 0), (lastEvent = 'Frogs removed.');
      weeks = 0;
      hist = {};
      if (!sim.running) sim.play();
      updateReadouts();
      sim.requestRender();
    }),
  );
  showFor('web');

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set('web', false);
      cycleCtl.set('carbon', false);
      showCtl.set('both', false);
      lightCtl.set(100, false);
      speedCtl.set(4, false);
      orgSel.value = 'R';
      showFor('web');
      s = { ...EQ };
      weeks = anim = 0;
      hist = {};
      parts = [];
      selected = null;
      lastEvent = '';
    },
  });
}
