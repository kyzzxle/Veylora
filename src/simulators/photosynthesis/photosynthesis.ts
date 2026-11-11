/**
 * Photosynthesis lab: a leaf cross-section, a zoomable chloroplast, the
 * light-dependent reactions on the thylakoid membrane, the Calvin cycle in the
 * stroma, and a rate lab. Every view is driven by the same simplified
 * leaf-level model (model.ts), so changing light, CO₂, water or temperature
 * changes the animations, the O₂ meter and the graphs together.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { LIMIT_TEXT, SCENARIOS, T_OPT, lightLimited, co2Limited, internalCO2, rates, stomata, tempFactor } from './model';
import type { Cond, Rates } from './model';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'leaf' | 'chloro' | 'light' | 'calvin' | 'rate';
type Axis = 'light' | 'co2' | 'temp' | 'water';
type Box = { x: number; y: number; w: number; h: number };
type Pt = [number, number];

const C_LIGHT = '#fab005';
const C_CO2 = '#868e96';
const C_O2 = '#e03131';
const C_H2O = '#1c7ed6';
const C_SUGAR = '#f76707';
const C_ATP = '#f08c00';
const C_NADPH = '#ae3ec9';
const C_GREEN = '#2f9e44';

/** Short names for the readout and badge. */
const SHORT: Record<Rates['limit'], string> = {
  dark: 'No light',
  light: 'Light',
  co2: 'Carbon dioxide',
  stomata: 'CO₂ (stomata closing)',
  colimited: 'Light and CO₂',
  temperature: 'Temperature',
  water: 'Water',
};
const fmt = (v: number, sig = 3) => {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 0.005) return '0';
  return (+v.toPrecision(sig)).toString().replace('-', '−');
};

/** Small deterministic random numbers, so the leaf looks the same every time. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* ======================= Structure descriptions ======================= */
const INFO: Record<string, { name: string; text: string }> = {
  cuticle: { name: 'Cuticle', text: 'A waxy, waterproof layer made by the epidermis. It reduces water loss and is transparent, so light passes straight through. Plants from dry, sunny places often have a thicker cuticle.' },
  upperEpi: { name: 'Upper epidermis', text: 'A single layer of transparent cells with few or no chloroplasts. It protects the leaf and lets light through to the mesophyll below.' },
  palisade: { name: 'Palisade mesophyll', text: 'Tall, tightly packed cells just under the upper surface, packed with chloroplasts. They receive the most light, so most photosynthesis happens here. Tap a chloroplast (green oval) to zoom in.' },
  spongy: { name: 'Spongy mesophyll', text: 'Rounded, loosely packed cells with fewer chloroplasts. The air spaces between them let CO₂ diffuse from the stomata to every cell, and let O₂ and water vapour diffuse out.' },
  air: { name: 'Air space', text: 'A connected network of gaps leading to the stomata. Gases diffuse through it; the moist cell surfaces let CO₂ dissolve and enter the cells.' },
  lowerEpi: { name: 'Lower epidermis', text: 'The protective lower surface of the leaf. It contains most of the stomata, where they are shaded and lose less water.' },
  stoma: { name: 'Stoma (pore)', text: 'A pore between two guard cells. CO₂ diffuses in for the Calvin cycle; O₂ made in the light-dependent reactions and water vapour diffuse out.' },
  guard: { name: 'Guard cells', text: 'A pair of cells that swell with water to open the stoma and go limp to close it. When the plant is short of water they close, which saves water but also cuts off the supply of CO₂.' },
  xylem: { name: 'Xylem', text: 'Hollow, dead tubes with lignified walls that carry water and mineral ions up from the roots. Water leaves the xylem and moves into the mesophyll cells, where some is split in the light-dependent reactions.' },
  phloem: { name: 'Phloem', text: 'Living tubes that carry sugars (mainly sucrose, made from the glucose of photosynthesis) away from the leaf to the rest of the plant.' },
  bundle: { name: 'Vascular bundle (vein)', text: 'Xylem and phloem together, surrounded by a bundle sheath. Veins bring water into the leaf, carry sugar out, and support the leaf blade.' },
  chloroplastLeaf: { name: 'Chloroplast', text: 'The organelle where photosynthesis happens. Tap one to zoom inside.' },
  outer: { name: 'Outer membrane', text: 'The outer layer of the chloroplast’s double envelope. Small molecules such as CO₂, O₂ and water cross it easily.' },
  inner: { name: 'Inner membrane', text: 'The inner layer of the envelope. It controls what enters and leaves the stroma, for example letting sugar phosphates out to the cytoplasm.' },
  stroma: { name: 'Stroma', text: 'The fluid filling the chloroplast. The Calvin cycle (light-independent reactions) happens here: enzymes such as RuBisCO fix CO₂ into sugar using ATP and NADPH from the thylakoids.' },
  granum: { name: 'Granum (stack of thylakoids)', text: 'A stack of thylakoids, like a pile of coins. Stacking packs a huge area of light-capturing membrane into a small space. (Plural: grana.)' },
  thylakoid: { name: 'Thylakoid', text: 'A flattened membrane sac. Its membrane holds chlorophyll, the two photosystems, the electron transport chain and ATP synthase: the light-dependent reactions happen here. Choose “3. Light-dependent reactions” to look inside the membrane.' },
  lumen: { name: 'Thylakoid lumen', text: 'The space inside a thylakoid. Water is split on this side of photosystem II, releasing O₂, and H⁺ ions build up here to drive ATP synthase.' },
  lamella: { name: 'Stroma lamella', text: 'An unstacked thylakoid linking two grana, so the whole thylakoid system is one connected membrane enclosing one lumen.' },
  ribosome: { name: 'Ribosomes', text: 'Chloroplasts make some of their own proteins, including part of the enzyme RuBisCO, on their own small ribosomes.' },
  dna: { name: 'Chloroplast DNA', text: 'A small, circular genome. Like the ribosomes, it is evidence that chloroplasts evolved from photosynthetic bacteria (the endosymbiotic theory).' },
  starch: { name: 'Starch grain', text: 'Glucose made by photosynthesis is stored as insoluble starch. In this model the grain grows as sugar is made; at night it is broken down and exported.' },
  plastoglobule: { name: 'Plastoglobulus', text: 'A small lipid droplet attached to the thylakoids that stores lipids and pigments.' },
  calvinSite: { name: 'Where the Calvin cycle runs', text: 'The Calvin cycle runs throughout the stroma. ATP and NADPH arrive from the thylakoids, CO₂ arrives from the air spaces, and sugar is made. Choose “4. Calvin cycle” to see the steps.' },
  psii: { name: 'Photosystem II (P680)', text: 'Chlorophyll and other pigments absorb light, and the energy excites electrons in the reaction centre. PSII replaces the lost electrons by splitting water: 2H₂O → O₂ + 4H⁺ + 4e⁻. All the O₂ released by photosynthesis comes from this step.' },
  pq: { name: 'Plastoquinone (PQ)', text: 'A small mobile carrier inside the membrane that takes electrons from PSII to the cytochrome complex.' },
  b6f: { name: 'Cytochrome b₆f complex', text: 'Passes electrons on to plastocyanin and uses their energy to pump H⁺ from the stroma into the lumen, building up a concentration gradient.' },
  pc: { name: 'Plastocyanin (PC)', text: 'A small copper-containing protein in the lumen that carries electrons to photosystem I.' },
  psi: { name: 'Photosystem I (P700)', text: 'Absorbs light a second time, re-energising the electrons so they have enough energy to reduce NADP⁺.' },
  fd: { name: 'Ferredoxin (Fd)', text: 'A small iron–sulfur protein on the stroma side that hands the electrons to NADP⁺ reductase.' },
  fnr: { name: 'NADP⁺ reductase', text: 'Makes NADPH: NADP⁺ + 2e⁻ + H⁺ → NADPH. NADPH carries high-energy electrons (reducing power) to the Calvin cycle.' },
  atps: { name: 'ATP synthase', text: 'H⁺ flows from the lumen back to the stroma through this enzyme, turning part of it like a turbine and joining ADP + Pi → ATP. This is photophosphorylation.' },
  membrane: { name: 'Thylakoid membrane', text: 'A phospholipid bilayer studded with the photosystems and carriers. It separates the lumen (inside) from the stroma (outside), which lets an H⁺ gradient build up.' },
  lumenL: { name: 'Thylakoid lumen', text: 'The inside of the thylakoid. Water splitting and H⁺ pumping make it acidic (high H⁺); those H⁺ ions drive ATP synthase.' },
  stromaL: { name: 'Stroma', text: 'Outside the thylakoid. NADPH and ATP are released here, right where the Calvin cycle needs them.' },
  fix: { name: 'Carbon fixation (RuBisCO)', text: 'The enzyme RuBisCO attaches CO₂ to RuBP, a 5-carbon sugar. The unstable 6-carbon product splits at once into two molecules of 3-PGA (3 carbons each). No ATP or NADPH is used in this step.' },
  pga: { name: '3-PGA (glycerate 3-phosphate)', text: 'The first stable product of carbon fixation, a 3-carbon acid. It is not yet a sugar: it must be reduced using ATP and NADPH.' },
  g3p: { name: 'G3P (glyceraldehyde 3-phosphate)', text: 'A 3-carbon sugar. For every 3 CO₂ fixed, one G3P leaves the cycle; two G3P make one glucose, which can become sucrose, starch or cellulose.' },
  rubp: { name: 'RuBP (ribulose bisphosphate)', text: 'The 5-carbon CO₂ acceptor. Five G3P (15 carbons) are rearranged into three RuBP (15 carbons) using 3 ATP, so the cycle can keep going.' },
  lightBox: { name: 'From the light-dependent reactions', text: 'ATP supplies energy and NADPH supplies high-energy electrons for the reduction step; ADP, Pi and NADP⁺ return to the thylakoids to be recharged. Without light these run out within seconds, so the Calvin cycle stops too.' },
  sugarBox: { name: 'Sugar products', text: 'G3P leaving the cycle is used to make glucose and then sucrose (exported in the phloem), starch (stored) and cellulose (cell walls).' },
};

const STAGES = [
  { t: 'Light is absorbed by photosystem II', d: 'Chlorophyll in PSII absorbs light energy, exciting electrons in its reaction centre (P680) to a higher energy level.', on: ['psii'] },
  { t: 'Water is split (photolysis)', d: 'PSII replaces its lost electrons by splitting water: 2H₂O → O₂ + 4H⁺ + 4e⁻. The O₂ diffuses out of the leaf: the oxygen released by photosynthesis comes from water, not from CO₂.', on: ['psii'] },
  { t: 'Electron transport pumps H⁺', d: 'Excited electrons pass through plastoquinone to the cytochrome b₆f complex, which uses their energy to pump H⁺ from the stroma into the lumen.', on: ['pq', 'b6f'] },
  { t: 'Plastocyanin carries electrons to PSI', d: 'Plastocyanin, a small protein in the lumen, carries the electrons (now lower in energy) to photosystem I.', on: ['pc'] },
  { t: 'Light is absorbed by photosystem I', d: 'Chlorophyll in PSI absorbs more light and re-energises the electrons (P700).', on: ['psi'] },
  { t: 'NADPH is made', d: 'Ferredoxin passes the electrons to NADP⁺ reductase: NADP⁺ + 2e⁻ + H⁺ → NADPH, on the stroma side.', on: ['fd', 'fnr'] },
  { t: 'ATP synthase makes ATP', d: 'H⁺ that has built up in the lumen flows back to the stroma through ATP synthase, which joins ADP + Pi → ATP.', on: ['atps'] },
  { t: 'ATP and NADPH go to the Calvin cycle', d: 'ATP and NADPH are released into the stroma and used to turn CO₂ into sugar. ADP and NADP⁺ come back to be recharged. No CO₂ is used or made in the light-dependent reactions.', on: ['atps', 'fnr'] },
];
const PHASES = [
  { t: 'Carbon fixation', d: '3 CO₂ + 3 RuBP (5 C each) → 6 × 3-PGA (3 C each). The enzyme RuBisCO joins each CO₂ to an RuBP. Carbon count: 3 + 15 = 18 = 6 × 3.', on: 'fix' },
  { t: 'Reduction', d: '6 × 3-PGA + 6 ATP + 6 NADPH → 6 × G3P. Energy from the light-dependent reactions is now stored in a sugar.', on: 'pga' },
  { t: 'Release of sugar', d: '1 of the 6 G3P leaves the cycle (net gain: 3 carbons, one from each CO₂). Two such G3P make one glucose, C₆H₁₂O₆.', on: 'g3p' },
  { t: 'Regeneration of RuBP', d: '5 G3P (15 C) + 3 ATP → 3 RuBP (15 C), ready to fix more CO₂. Per 3 CO₂ the cycle uses 9 ATP and 6 NADPH.', on: 'rubp' },
];

export function initPhotosynthesis(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const viewSel = root.querySelector<HTMLSelectElement>('[data-view]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const DEF: Cond = { I: 800, co2: 420, water: 80, T: 25 };
  const st = { view: 'leaf' as View, c: { ...DEF }, speed: 1, axis: 'light' as Axis };
  let R: Rates = rates(st.c);
  let simMin = 0; // model minutes elapsed
  let sugarMg = 0; // glucose made, mg per m² of leaf
  let sel: string | null = null;
  let lastMsg = '';
  let stage = -1; // light reactions: −1 = everything at once
  let phaseStep = -1; // Calvin cycle: −1 = continuous
  let stepping = false; // play() called by the Step button
  let cycleP = 0; // Calvin cycle progress, phases 0–4
  let turns = 0;
  let atpSpin = 0;
  let zoom = { z: 1, cx: 320, cy: 210 };
  let zoomAnim: { t: number; x: number; y: number } | null = null;

  /* ======================= Leaf geometry (local 640 × 480) ======================= */
  const rnd = seeded(11);
  const STOMATA = [150, 490];
  const VB = { x: 320, y: 300, rx: 62, ry: 52 };
  const upperEpi = Array.from({ length: 16 }, (_, i) => ({ x: i * 40, y: 68, w: 40, h: 30 }));
  const palisade = Array.from({ length: 18 }, (_, i) => ({ x: 4 + i * 35.3, y: 101, w: 31, h: 114 }));
  const spongy: { x: number; y: number; r: number }[] = [];
  for (let tries = 0; tries < 900 && spongy.length < 34; tries++) {
    const x = 14 + rnd() * 612;
    const y = 232 + rnd() * 142;
    const r = 13 + rnd() * 7;
    if (((x - VB.x) / (VB.rx + r + 6)) ** 2 + ((y - VB.y) / (VB.ry + r + 6)) ** 2 < 1) continue;
    if (STOMATA.some((sx) => Math.abs(x - sx) < 34 && y > 340)) continue;
    if (spongy.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + 7)) continue;
    spongy.push({ x, y, r });
  }
  const lowerEpi = Array.from({ length: 16 }, (_, i) => ({ x: i * 40, y: 386, w: 40, h: 30 })).filter((c) => !STOMATA.some((sx) => c.x + c.w > sx - 22 && c.x < sx + 22));
  const chlLeaf: { x: number; y: number; cell: number }[] = [];
  palisade.forEach((c, k) => {
    for (let i = 0; i < 5; i++) {
      chlLeaf.push({ x: c.x + 7, y: c.y + 12 + i * 22, cell: k });
      chlLeaf.push({ x: c.x + c.w - 7, y: c.y + 20 + i * 21, cell: k });
    }
  });
  spongy.forEach((c) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + c.x;
      chlLeaf.push({ x: c.x + Math.cos(a) * c.r * 0.6, y: c.y + Math.sin(a) * c.r * 0.6, cell: -1 });
    }
  });
  const sheath = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x: VB.x + Math.cos(a) * (VB.rx - 8), y: VB.y + Math.sin(a) * (VB.ry - 8), r: 9 };
  });
  const xylem = [
    { x: 300, y: 283, r: 10 },
    { x: 322, y: 278, r: 11 },
    { x: 343, y: 285, r: 9 },
    { x: 311, y: 300, r: 7 },
    { x: 333, y: 301, r: 7 },
  ];
  const phloem = [
    { x: 302, y: 322, r: 5 },
    { x: 315, y: 327, r: 4.5 },
    { x: 328, y: 324, r: 5 },
    { x: 340, y: 318, r: 4.5 },
    { x: 322, y: 314, r: 4 },
  ];
  const cellTargets: Pt[] = [...palisade.map((c) => [c.x + c.w / 2, c.y + 20 + rnd() * 70] as Pt), ...palisade.map((c) => [c.x + c.w / 2, c.y + 30 + rnd() * 60] as Pt), ...spongy.map((c) => [c.x, c.y] as Pt)];

  /* ======================= Chloroplast geometry (local 640 × 420) ======================= */
  const CH = { x: 320, y: 210, rx: 290, ry: 170 };
  const GRANA: [number, number, number][] = [
    [125, 205, 7],
    [190, 128, 6],
    [205, 268, 8],
    [285, 190, 9],
    [300, 318, 6],
    [372, 118, 7],
    [388, 240, 8],
    [545, 185, 6],
  ];
  const DISC = { w: 58, h: 8, gap: 2.6 };
  const stackRect = (g: [number, number, number]): Box => {
    const h = g[2] * (DISC.h + DISC.gap) - DISC.gap;
    return { x: g[0] - DISC.w / 2, y: g[1] - h / 2, w: DISC.w, h };
  };
  const LAMELLAE: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [3, 5],
    [3, 6],
    [5, 6],
    [6, 7],
    [4, 6],
  ];
  const CALVIN_SITE: Pt = [468, 300];
  const STARCH: Pt = [150, 318];
  const PLASTOGLOBULI: Pt[] = [
    [252, 92],
    [335, 252],
    [452, 105],
    [560, 262],
  ];
  const DNA: Pt = [98, 132];
  const r2 = seeded(5);
  const RIBOSOMES: Pt[] = [];
  for (let i = 0; i < 400 && RIBOSOMES.length < 46; i++) {
    const x = CH.x + (r2() * 2 - 1) * CH.rx * 0.9;
    const y = CH.y + (r2() * 2 - 1) * CH.ry * 0.85;
    if (((x - CH.x) / (CH.rx - 18)) ** 2 + ((y - CH.y) / (CH.ry - 18)) ** 2 > 1) continue;
    if (GRANA.some((g) => {
      const b = stackRect(g);
      return x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6;
    })) continue;
    if (Math.hypot(x - CALVIN_SITE[0], y - CALVIN_SITE[1]) < 46 || Math.hypot(x - STARCH[0], y - STARCH[1]) < 36) continue;
    RIBOSOMES.push([x, y]);
  }

  /* ======================= Particles ======================= */
  interface Tok {
    kind: string;
    path: Pt[];
    d: number;
    len: number;
    speed: number;
    then?: () => void;
  }
  const pathLen = (p: Pt[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
  const along = (p: Pt[], d: number): Pt => {
    for (let i = 1; i < p.length; i++) {
      const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (d <= L || i === p.length - 1) {
        const f = L ? clamp(d / L, 0, 1) : 1;
        return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f];
      }
      d -= L;
    }
    return p[p.length - 1];
  };
  let toks: Tok[] = [];
  let flashes: { x: number; y: number; t: number }[] = [];
  const acc: Record<string, number> = {};
  const add = (kind: string, path: Pt[], speed: number, then?: () => void) => toks.push({ kind, path, d: 0, len: pathLen(path), speed, then });
  const spawn = (key: string, rate: number, dt: number, make: () => void) => {
    acc[key] = (acc[key] ?? 0) + rate * dt;
    let n = 0;
    while (acc[key] >= 1 && n++ < 6) {
      acc[key] -= 1;
      make();
    }
    if (acc[key] > 3) acc[key] = 0;
  };
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const jitter = (v: number, s: number) => v + (Math.random() * 2 - 1) * s;

  function leafSpawn(dt: number) {
    const A = R.A;
    spawn('ray', (st.c.I / 2000) * 60, dt, () => {
      const x = 8 + Math.random() * 624;
      const u = Math.random();
      const stop = u < 0.68 ? 105 + Math.random() * 110 : u < 0.93 ? 225 + Math.random() * 150 : 470;
      add('ray', [
        [x, 0],
        [x, stop],
      ], 430, stop < 460 ? () => flashes.push({ x, y: stop, t: 0 }) : undefined);
    });
    const nearStoma = (x: number) => STOMATA.reduce((m, s) => (Math.abs(s - x) < Math.abs(m - x) ? s : m));
    spawn('co2', A * 0.45, dt, () => {
      const sx = pick(STOMATA);
      const t = pick(cellTargets);
      add('co2', [
        [jitter(sx, 12), 478],
        [sx, 404],
        [jitter(sx, 18), 362],
        [jitter((sx + t[0]) / 2, 20), jitter(Math.max(t[1], 240), 12)],
        t,
      ], 75);
    });
    spawn('o2', Math.max(0, A) * 0.45, dt, () => {
      const s = pick(cellTargets);
      const sx = nearStoma(s[0]);
      add('o2', [s, [jitter((sx + s[0]) / 2, 20), jitter(320, 20)], [jitter(sx, 14), 364], [sx, 404], [jitter(sx, 16), 480]], 80);
    });
    spawn('h2o', (st.c.water / 100) * 6 + A * 0.15, dt, () => {
      const x0 = pick(xylem);
      const t = pick(cellTargets);
      const a = Math.atan2(t[1] - VB.y, t[0] - VB.x);
      add('h2o', [
        [x0.x, x0.y],
        [VB.x + Math.cos(a) * VB.rx, VB.y + Math.sin(a) * VB.ry],
        t,
      ], 60);
    });
    spawn('sugar', A * 0.1, dt, () => {
      const s = pick(cellTargets);
      const p = pick(phloem);
      const a = Math.atan2(s[1] - VB.y, s[0] - VB.x);
      add('sugar', [s, [VB.x + Math.cos(a) * VB.rx, VB.y + Math.sin(a) * VB.ry], [p.x, p.y]], 55);
    });
  }
  function chloroSpawn(dt: number) {
    const A = R.A;
    spawn('ph', (st.c.I / 2000) * 26, dt, () => {
      const g = pick(GRANA);
      const b = stackRect(g);
      const x = jitter(g[0], 20);
      add('ray', [
        [x - 60, -30],
        [x, b.y + 4],
      ], 420, () => flashes.push({ x, y: b.y + 4, t: 0 }));
    });
    spawn('atp', A * 0.3, dt, () => {
      const g = pick(GRANA);
      add('atp', [
        [g[0] + DISC.w / 2, g[1]],
        [jitter((g[0] + CALVIN_SITE[0]) / 2, 20), jitter((g[1] + CALVIN_SITE[1]) / 2, 20)],
        [jitter(CALVIN_SITE[0], 10), jitter(CALVIN_SITE[1], 10)],
      ], 70);
    });
    spawn('nadph', A * 0.2, dt, () => {
      const g = pick(GRANA);
      add('nadph', [
        [g[0] + DISC.w / 2, g[1] + 6],
        [jitter((g[0] + CALVIN_SITE[0]) / 2, 20), jitter((g[1] + CALVIN_SITE[1]) / 2, 20)],
        [jitter(CALVIN_SITE[0], 10), jitter(CALVIN_SITE[1], 10)],
      ], 70);
    });
    spawn('co2', A * 0.2, dt, () => {
      const a = Math.PI * (0.05 + Math.random() * 0.5);
      add('co2', [
        [CH.x + Math.cos(a) * (CH.rx + 40), CH.y + Math.sin(a) * (CH.ry + 40)],
        [jitter(CALVIN_SITE[0], 10), jitter(CALVIN_SITE[1], 10)],
      ], 70);
    });
    spawn('o2', A * 0.2, dt, () => {
      const g = pick(GRANA);
      const a = Math.atan2(g[1] - CH.y, g[0] - CH.x);
      add('o2', [
        [g[0], g[1]],
        [CH.x + Math.cos(a) * (CH.rx + 50), CH.y + Math.sin(a) * (CH.ry + 50)],
      ], 70);
    });
    spawn('sugar', A * 0.05, dt, () => add('sugar', [CALVIN_SITE, [jitter(330, 30), jitter(360, 10)], STARCH], 55));
  }
  /* light reactions: stage k produces these tokens (local 640 × 480) */
  function lightStage(k: number) {
    const sp = 120;
    if (k === 0) add('photon', [[20, 8], [82, 168]], 260);
    if (k === 1) {
      add('h2o', [[30, 470], [80, 272]], sp, () => {
        add('o2', [[80, 275], [150, 470]], sp * 0.8);
        add('h', [[88, 278], [120, 340]], sp);
      });
    }
    if (k === 2) {
      add('e', [[100, 200], [155, 214], [222, 206]], sp * 1.3);
      add('h', [[226, 112], [226, 322]], sp);
    }
    if (k === 3) add('e', [[232, 252], [298, 290], [366, 252]], sp * 1.3);
    if (k === 4) add('photon', [[312, 8], [372, 168]], 260);
    if (k === 5) {
      add('e', [[388, 172], [432, 140], [470, 128]], sp * 1.3);
      add('nadp', [[430, 14], [482, 108]], sp, () => add('nadph', [[492, 104], [536, 8]], sp));
    }
    if (k === 6) {
      add('h', [[575, 360], [575, 262], [575, 158]], sp);
      add('adp', [[636, 52], [596, 116]], sp, () => add('atp', [[600, 112], [632, 8]], sp));
    }
    if (k === 7) {
      add('atp', [[600, 100], [612, 2]], sp * 0.8);
      add('nadph', [[492, 96], [470, 2]], sp * 0.8);
    }
  }
  function lightSpawn(dt: number) {
    if (st.c.I <= 0) return;
    if (stage >= 0) {
      spawn(`ls${stage}`, 1.6, dt, () => lightStage(stage));
      return;
    }
    const rate = R.A * 0.16;
    for (let k = 0; k < 7; k++) spawn(`ls${k}`, rate, dt, () => lightStage(k));
  }
  function moveToks(dt: number) {
    for (const t of toks) {
      t.d += t.speed * dt;
      if (t.d >= t.len && t.then) {
        const f = t.then;
        t.then = undefined;
        f();
      }
    }
    toks = toks.filter((t) => t.d < t.len);
    flashes.forEach((f) => (f.t += dt));
    flashes = flashes.filter((f) => f.t < 0.35);
    if (toks.length > 900) toks = toks.slice(-900);
  }

  /* ======================= Simulation step ======================= */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    const d = dt * st.speed;
    simMin += d;
    sugarMg += R.glucose * 60 * d * 0.18016; // µmol m⁻² s⁻¹ × 60 s × minutes × mg per µmol
    atpSpin += R.A * 0.08 * d;
    if (zoomAnim) return;
    if (st.view === 'leaf') leafSpawn(d);
    else if (st.view === 'chloro') chloroSpawn(d);
    else if (st.view === 'light') lightSpawn(d);
    else if (st.view === 'calvin') {
      const speed = phaseStep >= 0 ? (st.c.I > 0 ? 0.6 : 0) : (R.A / 20) * 0.9;
      cycleP += speed * d;
      if (phaseStep >= 0 && cycleP >= phaseStep + 1) {
        cycleP = phaseStep + 0.999;
        stepping = false;
        sim.pause();
      }
      if (cycleP >= 4) {
        cycleP -= 4;
        turns++;
      }
    }
    moveToks(d);
  }

  /* ======================= Drawing helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const toBox = (x: number, yy: number): [number, number] => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (yy - oy) / k];
  };
  let cur = 1;
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  function text(s: string, x: number, yy: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, yy);
    ctx.textAlign = 'left';
  }
  function tag(s: string, x: number, yy: number, color: string, px = 10.5, align: CanvasTextAlign = 'left', wt = 750) {
    ctx.font = fs(px, wt);
    const w = ctx.measureText(s).width;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    ctx.fillStyle = withAlpha(pal['sim-bg'], 0.84);
    ctx.beginPath();
    ctx.roundRect(x0 - 4 / cur, yy - (px + 2) / cur, w + 8 / cur, (px + 7) / cur, 4 / cur);
    ctx.fill();
    text(s, x, yy, px, color, align, wt);
  }
  function wrap(s: string, x: number, yy: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600, maxY = Infinity) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    let line = '';
    for (const w of s.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        if (yy + lh > maxY) {
          ctx.fillText(`${line}…`, x, yy);
          return yy + lh;
        }
        ctx.fillText(line, x, yy);
        line = w;
        yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
    return yy + lh;
  }
  function panel(B: Box, fill = pal['bg-elev']) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(B.x, B.y, B.w, B.h, 10);
    ctx.fill();
    ctx.stroke();
  }
  function arrow(x0: number, y0: number, x1: number, y1: number, col: string, lw = 2.5) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 0.5) return;
    const a = Math.atan2(y1 - y0, x1 - x0);
    const hs = Math.min(10 / cur, L * 0.45);
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw / cur;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - Math.cos(a) * hs * 0.7, y1 - Math.sin(a) * hs * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hs * Math.cos(a - 0.45), y1 - hs * Math.sin(a - 0.45));
    ctx.lineTo(x1 - hs * Math.cos(a + 0.45), y1 - hs * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  }
  const circle = (x: number, y: number, r: number, fill: string | null, stroke?: string, lw = 1) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw / cur;
      ctx.stroke();
    }
  };
  const niceStep = (span: number, target: number) => {
    const raw = span / target;
    const p = 10 ** Math.floor(Math.log10(raw));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };
  /** True when the page uses the dark theme (judged from the simulator background). */
  const dark = () => {
    ctx.fillStyle = pal['sim-bg'];
    const c = String(ctx.fillStyle);
    const m = c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : (c.match(/\d+(\.\d+)?/g) ?? ['255', '255', '255']).slice(0, 3).map(Number);
    return m[0] * 0.3 + m[1] * 0.59 + m[2] * 0.11 < 128;
  };

  /* ======================= Layout ======================= */
  const layout = () =>
    portrait() && st.view === 'rate'
      ? { vis: { x: 14, y: 104, w: 652, h: 600 }, side: { x: 14, y: 716, w: 652, h: 152 }, foot: { x: 14, y: 880, w: 652, h: 108 } }
      : portrait()
      ? { vis: { x: 14, y: 104, w: 652, h: 470 }, side: { x: 14, y: 586, w: 652, h: 282 }, foot: { x: 14, y: 880, w: 652, h: 108 } }
      : { vis: { x: 14, y: 14, w: 640, h: 520 }, side: { x: 666, y: 66, w: 320, h: 468 }, foot: { x: 14, y: 546, w: 972, h: 40 } };
  /** Map a local drawing (w × h) into a box, centred. */
  const fitLocal = (B: Box, w: number, h: number, pad = 10) => {
    const s = Math.min((B.w - pad * 2) / w, (B.h - pad * 2) / h);
    return { s, ox: B.x + (B.w - w * s) / 2, oy: B.y + (B.h - h * s) / 2 };
  };
  let hits: { id: string; test: (x: number, y: number) => boolean }[] = [];
  let localMap: { s: number; ox: number; oy: number } = { s: 1, ox: 0, oy: 0 };
  const hl = (id: string) => sel === id;

  /* ======================= Leaf ======================= */
  function drawToks(kinds?: string[]) {
    for (const t of toks) {
      if (kinds && !kinds.includes(t.kind)) continue;
      const [x, y] = along(t.path, t.d);
      if (t.kind === 'ray') {
        const [x0, y0] = along(t.path, Math.max(0, t.d - 26));
        ctx.strokeStyle = withAlpha(C_LIGHT, 0.9);
        ctx.lineWidth = 2.4 / cur;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (t.kind === 'co2') circle(x, y, 3.4 / Math.sqrt(cur), C_CO2, pal['sim-text'], 0.6);
      else if (t.kind === 'o2') circle(x, y, 3.2 / Math.sqrt(cur), C_O2);
      else if (t.kind === 'h2o') circle(x, y, 2.8 / Math.sqrt(cur), C_H2O);
      else if (t.kind === 'sugar') {
        ctx.fillStyle = C_SUGAR;
        ctx.fillRect(x - 2.8 / Math.sqrt(cur), y - 2.8 / Math.sqrt(cur), 5.6 / Math.sqrt(cur), 5.6 / Math.sqrt(cur));
      } else if (t.kind === 'atp') circle(x, y, 3.4 / Math.sqrt(cur), C_ATP);
      else if (t.kind === 'nadph') circle(x, y, 3.4 / Math.sqrt(cur), C_NADPH);
    }
    for (const f of flashes) {
      ctx.fillStyle = withAlpha('#fff3bf', 0.85 * (1 - f.t / 0.35));
      ctx.beginPath();
      ctx.arc(f.x, f.y, (3 + f.t * 30) / Math.sqrt(cur), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawLeaf(B: Box) {
    panel(B, pal['surface-2']);
    const M = fitLocal(B, 640, 480, 6);
    localMap = M;
    ctx.save();
    ctx.beginPath();
    ctx.rect(B.x + 1, B.y + 1, B.w - 2, B.h - 2);
    ctx.clip();
    let zs = 1;
    if (zoomAnim) {
      zs = 1 + 9 * zoomAnim.t * zoomAnim.t;
      ctx.translate(zoomAnim.x, zoomAnim.y);
      ctx.scale(zs, zs);
      ctx.translate(-zoomAnim.x, -zoomAnim.y);
      ctx.globalAlpha = 1 - 0.6 * zoomAnim.t;
    }
    ctx.translate(M.ox, M.oy);
    ctx.scale(M.s, M.s);
    const saved = cur;
    cur = cur * M.s * zs;
    hits = [];
    const g = R.g;
    // air outside, sky above
    ctx.fillStyle = withAlpha(C_LIGHT, 0.08);
    ctx.fillRect(0, 0, 640, 60);
    // leaf interior (air spaces)
    ctx.fillStyle = dark() ? '#1f3326' : '#eef7ea';
    ctx.fillRect(0, 60, 640, 364);
    hits.push({ id: 'air', test: (_x, y) => y > 215 && y < 386 });
    // spongy mesophyll
    for (const c of spongy) {
      circle(c.x, c.y, c.r, withAlpha('#b2f2bb', hl('spongy') ? 0.95 : 0.7), '#2b8a3e', hl('spongy') ? 2.2 : 1);
      hits.push({ id: 'spongy', test: (x, y) => Math.hypot(x - c.x, y - c.y) < c.r });
    }
    // vascular bundle
    ctx.beginPath();
    ctx.ellipse(VB.x, VB.y, VB.rx, VB.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha('#dee2e6', 0.9);
    ctx.fill();
    ctx.strokeStyle = hl('bundle') ? C_GREEN : '#868e96';
    ctx.lineWidth = (hl('bundle') ? 3 : 1.2) / cur;
    ctx.stroke();
    hits.push({ id: 'bundle', test: (x, y) => ((x - VB.x) / VB.rx) ** 2 + ((y - VB.y) / VB.ry) ** 2 < 1 });
    for (const c of sheath) circle(c.x, c.y, c.r, '#ced4da', '#868e96');
    for (const c of xylem) {
      circle(c.x, c.y, c.r, withAlpha('#a5d8ff', 0.95), hl('xylem') ? C_GREEN : '#1864ab', hl('xylem') ? 3.5 : 2.6);
      hits.push({ id: 'xylem', test: (x, y) => Math.hypot(x - c.x, y - c.y) < c.r + 1 });
    }
    for (const c of phloem) {
      circle(c.x, c.y, c.r, '#ffe8cc', hl('phloem') ? C_GREEN : '#d9480f', hl('phloem') ? 2.5 : 1.2);
      hits.push({ id: 'phloem', test: (x, y) => Math.hypot(x - c.x, y - c.y) < c.r + 2 });
    }
    // palisade
    for (const c of palisade) {
      ctx.fillStyle = withAlpha('#b2f2bb', hl('palisade') ? 1 : 0.8);
      ctx.strokeStyle = '#2b8a3e';
      ctx.lineWidth = (hl('palisade') ? 2.2 : 1) / cur;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 9);
      ctx.fill();
      ctx.stroke();
      hits.push({ id: 'palisade', test: (x, y) => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h });
    }
    for (const k of chlLeaf) {
      ctx.fillStyle = C_GREEN;
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, 5, 3.3, 0.3, 0, Math.PI * 2);
      ctx.fill();
      hits.push({ id: 'chloroplastLeaf', test: (x, y) => Math.hypot(x - k.x, y - k.y) < 7 });
    }
    // epidermis and cuticle
    for (const c of upperEpi) {
      ctx.fillStyle = withAlpha('#e6fcf5', dark() ? 0.25 : 0.85);
      ctx.strokeStyle = '#5c940d';
      ctx.lineWidth = (hl('upperEpi') ? 2.2 : 1) / cur;
      ctx.beginPath();
      ctx.roundRect(c.x + 1, c.y, c.w - 2, c.h, 6);
      ctx.fill();
      ctx.stroke();
      hits.push({ id: 'upperEpi', test: (_x, y) => y > 68 && y < 98 });
    }
    for (const c of lowerEpi) {
      ctx.fillStyle = withAlpha('#e6fcf5', dark() ? 0.25 : 0.85);
      ctx.strokeStyle = '#5c940d';
      ctx.lineWidth = (hl('lowerEpi') ? 2.2 : 1) / cur;
      ctx.beginPath();
      ctx.roundRect(c.x + 1, c.y, c.w - 2, c.h, 6);
      ctx.fill();
      ctx.stroke();
    }
    hits.push({ id: 'lowerEpi', test: (_x, y) => y > 386 && y < 416 });
    ctx.fillStyle = withAlpha('#ffe066', hl('cuticle') ? 1 : 0.75);
    ctx.fillRect(0, 60, 640, 8);
    ctx.fillRect(0, 416, 640, 6);
    hits.push({ id: 'cuticle', test: (_x, y) => (y >= 56 && y <= 68) || (y >= 416 && y <= 424) });
    // stomata
    for (const sx of STOMATA) {
      ctx.fillStyle = dark() ? '#18281e' : '#dfeedd';
      ctx.beginPath();
      ctx.ellipse(sx, 362, 28, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      const open = 1.5 + g * 7;
      for (const s of [-1, 1]) {
        const gx = sx + s * (open + 8);
        ctx.fillStyle = '#8ce99a';
        ctx.strokeStyle = hl('guard') ? C_GREEN : '#2b8a3e';
        ctx.lineWidth = (hl('guard') ? 2.6 : 1.2) / cur;
        ctx.beginPath();
        ctx.ellipse(gx, 402, 9, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        circle(gx + s * 2, 396, 2.2, C_GREEN);
        circle(gx + s * 2, 408, 2.2, C_GREEN);
        hits.push({ id: 'guard', test: (x, y) => ((x - gx) / 10) ** 2 + ((y - 402) / 16) ** 2 < 1 });
      }
      hits.push({ id: 'stoma', test: (x, y) => Math.abs(x - sx) < open + 2 && y > 386 && y < 424 });
      if (hl('stoma')) {
        ctx.strokeStyle = C_GREEN;
        ctx.lineWidth = 2.5 / cur;
        ctx.strokeRect(sx - open, 388, open * 2, 32);
      }
    }
    drawToks();
    // sun
    ctx.restore();
    cur = saved;
    // labels (screen-constant text)
    const L = (s: string, y: number) => tag(s, B.x + 10 / cur, M.oy + y * M.s, pal['sim-text'], 10, 'left', 800);
    if (!zoomAnim) {
      L('Light ↓', 30);
      L('Cuticle', 66);
      L('Upper epidermis', 90);
      L('Palisade mesophyll', 160);
      L('Spongy mesophyll', 250);
      tag('Vascular bundle', M.ox + (VB.x + VB.rx + 8) * M.s, M.oy + (VB.y - 30) * M.s, pal['sim-text'], 10, 'left', 800);
      L('Lower epidermis', 405);
      tag('Stoma', M.ox + (STOMATA[0] + 30) * M.s, M.oy + 445 * M.s, pal['sim-text'], 10, 'left', 800);
      text(`Stomata ${Math.round(g * 100)}% open`, B.x + B.w - 10 / cur, M.oy + 466 * M.s, 10.5, g < 0.5 ? pal.danger : pal['text-muted'], 'right', 750);
    }
  }

  /* ======================= Chloroplast ======================= */
  const chMap = () => {
    const B = layout().vis;
    const M = fitLocal(B, 640, 420, 6);
    return { ...M, B };
  };
  const chToLocal = (bx: number, by: number): Pt => {
    const { s, ox, oy } = chMap();
    // screen = o + s·(z·(p − c) + (320, 210))
    return [(((bx - ox) / s - 320) / zoom.z) + zoom.cx, (((by - oy) / s - 210) / zoom.z) + zoom.cy];
  };
  function drawChloroplast(B: Box) {
    panel(B, pal['surface-2']);
    const M = fitLocal(B, 640, 420, 6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(B.x + 1, B.y + 1, B.w - 2, B.h - 2);
    ctx.clip();
    ctx.translate(M.ox, M.oy);
    ctx.scale(M.s, M.s);
    ctx.translate(320, 210);
    ctx.scale(zoom.z, zoom.z);
    ctx.translate(-zoom.cx, -zoom.cy);
    const saved = cur;
    cur = cur * M.s * zoom.z;
    hits = [];
    // envelope
    ctx.beginPath();
    ctx.ellipse(CH.x, CH.y, CH.rx, CH.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = dark() ? '#244a2c' : '#c3f0c8';
    ctx.fill();
    ctx.strokeStyle = hl('outer') ? '#fab005' : '#2b8a3e';
    ctx.lineWidth = hl('outer') ? 6 : 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(CH.x, CH.y, CH.rx - 9, CH.ry - 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = dark() ? '#1d3d25' : hl('stroma') ? '#d8f5a2' : '#e3f9e0';
    ctx.fill();
    ctx.strokeStyle = hl('inner') ? '#fab005' : '#37b24d';
    ctx.lineWidth = hl('inner') ? 5 : 3;
    ctx.stroke();
    const e = (x: number, y: number, rx: number, ry: number) => ((x - CH.x) / rx) ** 2 + ((y - CH.y) / ry) ** 2;
    hits.push({ id: 'stroma', test: (x, y) => e(x, y, CH.rx - 11, CH.ry - 11) < 1 });
    hits.push({ id: 'inner', test: (x, y) => e(x, y, CH.rx - 4, CH.ry - 4) < 1 && e(x, y, CH.rx - 13, CH.ry - 13) >= 1 });
    hits.push({ id: 'outer', test: (x, y) => e(x, y, CH.rx + 4, CH.ry + 4) < 1 && e(x, y, CH.rx - 4, CH.ry - 4) >= 1 });
    // Calvin cycle site
    ctx.strokeStyle = withAlpha(C_ATP, 0.7);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(CALVIN_SITE[0], CALVIN_SITE[1], 32, 0.3, Math.PI * 1.85);
    ctx.stroke();
    ctx.setLineDash([]);
    arrow(CALVIN_SITE[0] + 32 * Math.cos(Math.PI * 1.8), CALVIN_SITE[1] + 32 * Math.sin(Math.PI * 1.8), CALVIN_SITE[0] + 32 * Math.cos(Math.PI * 1.95), CALVIN_SITE[1] + 32 * Math.sin(Math.PI * 1.95), withAlpha(C_ATP, 0.8), 2);
    text('Calvin', CALVIN_SITE[0], CALVIN_SITE[1] - 2, 10, pal['sim-text'], 'center', 800);
    text('cycle', CALVIN_SITE[0], CALVIN_SITE[1] + 11 / Math.max(1, zoom.z * 0.7), 10, pal['sim-text'], 'center', 800);
    hits.push({ id: 'calvinSite', test: (x, y) => Math.hypot(x - CALVIN_SITE[0], y - CALVIN_SITE[1]) < 34 });
    // ribosomes, DNA, plastoglobuli, starch
    for (const [x, y] of RIBOSOMES) circle(x, y, 1.8, hl('ribosome') ? '#fab005' : '#5c7cfa');
    hits.push({ id: 'ribosome', test: (x, y) => RIBOSOMES.some(([a, b]) => Math.hypot(x - a, y - b) < 4) });
    ctx.strokeStyle = hl('dna') ? '#fab005' : '#9c36b5';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r = 15 + 3 * Math.sin(a * 6);
      const x = DNA[0] + Math.cos(a) * r;
      const y = DNA[1] + Math.sin(a) * r * 0.7;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    hits.push({ id: 'dna', test: (x, y) => Math.hypot(x - DNA[0], y - DNA[1]) < 20 });
    for (const [x, y] of PLASTOGLOBULI) {
      circle(x, y, 5, hl('plastoglobule') ? '#fab005' : '#ffd43b', '#f08c00');
      hits.push({ id: 'plastoglobule', test: (a, b) => Math.hypot(a - x, b - y) < 7 });
    }
    const grow = 0.75 + Math.min(1.1, sugarMg / 400);
    ctx.beginPath();
    ctx.ellipse(STARCH[0], STARCH[1], 24 * grow, 14 * grow, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = dark() ? '#e9ecef' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = hl('starch') ? '#fab005' : '#adb5bd';
    ctx.lineWidth = hl('starch') ? 3 : 1.4;
    ctx.stroke();
    hits.push({ id: 'starch', test: (x, y) => ((x - STARCH[0]) / (24 * grow)) ** 2 + ((y - STARCH[1]) / (14 * grow)) ** 2 < 1 });
    // stroma lamellae
    ctx.strokeStyle = hl('lamella') ? '#fab005' : '#2b8a3e';
    ctx.lineWidth = hl('lamella') ? 4 : 3;
    for (const [a, b] of LAMELLAE) {
      const A = GRANA[a];
      const Bg = GRANA[b];
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo((A[0] + Bg[0]) / 2, (A[1] + Bg[1]) / 2 - 12, Bg[0], Bg[1]);
      ctx.stroke();
      hits.push({
        id: 'lamella',
        test: (x, y) => {
          const dx = Bg[0] - A[0];
          const dy = Bg[1] - A[1];
          const t = clamp(((x - A[0]) * dx + (y - A[1]) * dy) / (dx * dx + dy * dy), 0, 1);
          const px = A[0] + t * dx;
          const py = A[1] + t * dy - 12 * 4 * t * (1 - t) * 0.5;
          return Math.hypot(x - px, y - py) < 5;
        },
      });
    }
    // grana
    GRANA.forEach((g, gi) => {
      const b = stackRect(g);
      const selStack = hl('granum') && grSel === gi;
      for (let i = 0; i < g[2]; i++) {
        const y = b.y + i * (DISC.h + DISC.gap);
        ctx.beginPath();
        ctx.roundRect(b.x, y, b.w, DISC.h, 4);
        ctx.fillStyle = '#2b8a3e';
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(b.x + 2.2, y + 2.2, b.w - 4.4, DISC.h - 4.4, 2);
        ctx.fillStyle = hl('lumen') && grSel === gi && thySel === i ? '#ffe066' : '#8ce99a';
        ctx.fill();
        if ((hl('thylakoid') && grSel === gi && thySel === i) || selStack) {
          ctx.strokeStyle = '#fab005';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(b.x - 1, y - 1, b.w + 2, DISC.h + 2, 4);
          ctx.stroke();
        }
      }
      hits.push({
        id: 'granum',
        test: (x, y) => {
          if (!(x > b.x - 3 && x < b.x + b.w + 3 && y > b.y - 3 && y < b.y + b.h + 3)) return false;
          grSel = gi;
          const i = Math.floor((y - b.y) / (DISC.h + DISC.gap));
          const yi = b.y + i * (DISC.h + DISC.gap);
          const inDisc = i >= 0 && i < g[2] && y >= yi && y <= yi + DISC.h;
          thySel = i;
          if (inDisc && zoom.z >= 1.8) {
            hitOverride = y > yi + 2.2 && y < yi + DISC.h - 2.2 && x > b.x + 2.2 && x < b.x + b.w - 2.2 && zoom.z >= 2.6 ? 'lumen' : 'thylakoid';
          } else hitOverride = null;
          return true;
        },
      });
    });
    drawToks(['ray', 'atp', 'nadph', 'co2', 'o2', 'sugar']);
    ctx.restore();
    cur = saved;
    // labels
    const lab = (s: string, p: Pt, dx = 0, dy = -22) => {
      const { s: sc, ox, oy } = M;
      const x = ox + sc * (zoom.z * (p[0] - zoom.cx) + 320);
      const y = oy + sc * (zoom.z * (p[1] - zoom.cy) + 210);
      if (x < B.x + 30 || x > B.x + B.w - 30 || y < B.y + 14 || y > B.y + B.h - 6) return;
      tag(s, x + dx / cur, y + dy / cur, pal['sim-text'], 10, 'center', 800);
    };
    lab('Granum', [GRANA[3][0], stackRect(GRANA[3]).y], 0, -8);
    lab('Stroma', [250, 360], 0, 0);
    lab('Starch grain', STARCH, 0, 30);
    lab('Outer and inner membranes', [CH.x, CH.y - CH.ry], 0, -8);
    lab('DNA', DNA, 0, -16);
    if (zoom.z >= 1.8) lab('Thylakoid', [GRANA[3][0] + DISC.w / 2, GRANA[3][1]], 46, 4);
    lab('Stroma lamella', [(GRANA[6][0] + GRANA[7][0]) / 2, (GRANA[6][1] + GRANA[7][1]) / 2], 0, 22);
    text(`Zoom ${fmt(zoom.z, 2)}×  ·  drag to move, scroll or pinch to zoom, tap to inspect`, B.x + B.w - 10 / cur, B.y + B.h - 10 / cur, 10, pal['text-faint'], 'right', 650);
  }
  let grSel = -1;
  let thySel = -1;
  let hitOverride: string | null = null;

  /* ======================= Light-dependent reactions ======================= */
  const LR: Record<string, Box> = {
    psii: { x: 48, y: 148, w: 68, h: 124 },
    pq: { x: 140, y: 198, w: 30, h: 26 },
    b6f: { x: 200, y: 154, w: 52, h: 112 },
    pc: { x: 282, y: 274, w: 30, h: 30 },
    psi: { x: 340, y: 148, w: 64, h: 124 },
    fd: { x: 418, y: 124, w: 28, h: 28 },
    fnr: { x: 458, y: 100, w: 56, h: 46 },
    atps: { x: 545, y: 100, w: 60, h: 164 },
  };
  function drawLight(B: Box) {
    panel(B, pal['surface-2']);
    const M = fitLocal(B, 640, 480, 6);
    localMap = M;
    ctx.save();
    ctx.beginPath();
    ctx.rect(B.x + 1, B.y + 1, B.w - 2, B.h - 2);
    ctx.clip();
    ctx.translate(M.ox, M.oy);
    ctx.scale(M.s, M.s);
    const saved = cur;
    cur = cur * M.s;
    const small = cur < 0.6;
    if (small) cur = 0.62;
    hits = [];
    const on = stage >= 0 ? STAGES[stage].on : [];
    // regions
    ctx.fillStyle = dark() ? '#1d3d25' : '#e3f9e0';
    ctx.fillRect(0, 0, 640, 170);
    ctx.fillStyle = dark() ? '#3b3420' : '#fff9db';
    ctx.fillRect(0, 250, 640, 230);
    hits.push({ id: 'stromaL', test: (_x, y) => y < 170 });
    hits.push({ id: 'lumenL', test: (_x, y) => y > 250 });
    // membrane
    ctx.fillStyle = dark() ? '#4a3f2a' : '#f3e3c3';
    ctx.fillRect(0, 170, 640, 80);
    ctx.fillStyle = hl('membrane') ? '#fab005' : '#d9a441';
    for (let x = 4; x < 640; x += 9) {
      ctx.beginPath();
      ctx.arc(x, 174, 3.6, 0, Math.PI * 2);
      ctx.arc(x, 246, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    hits.push({ id: 'membrane', test: (_x, y) => y >= 170 && y <= 250 });
    // H⁺ in the lumen: more when the gradient is steeper
    const nH = st.c.I > 0 ? Math.round(4 + R.A * 0.9) : 2;
    const rh = seeded(3);
    for (let i = 0; i < nH; i++) text('H⁺', 20 + rh() * 600, 300 + rh() * 160, 10, '#e8590c', 'center', 800);
    const rs = seeded(9);
    for (let i = 0; i < 4; i++) text('H⁺', 30 + rs() * 560, 30 + rs() * 120, 10, withAlpha('#e8590c', 0.7), 'center', 800);
    // electron path
    ctx.strokeStyle = withAlpha(C_LIGHT, 0.55);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 200);
    ctx.lineTo(155, 214);
    ctx.lineTo(222, 206);
    ctx.lineTo(232, 252);
    ctx.lineTo(298, 290);
    ctx.lineTo(366, 252);
    ctx.lineTo(388, 172);
    ctx.lineTo(432, 140);
    ctx.lineTo(470, 128);
    ctx.stroke();
    ctx.setLineDash([]);
    const comp = (id: string, fill: string, label: string, sub = '') => {
      const b = LR[id];
      const lit = hl(id) || on.includes(id);
      ctx.fillStyle = fill;
      ctx.strokeStyle = lit ? '#fab005' : withAlpha('#212529', 0.45);
      ctx.lineWidth = lit ? 4 : 1.4;
      ctx.beginPath();
      if (id === 'pq' || id === 'pc' || id === 'fd') ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      else ctx.roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      ctx.stroke();
      text(label, b.x + b.w / 2, b.y + b.h / 2 + (sub ? -2 : 4), 11, '#212529', 'center', 800);
      if (sub) text(sub, b.x + b.w / 2, b.y + b.h / 2 + 13, 9, '#343a40', 'center', 700);
      hits.push({ id, test: (x, y) => x > b.x - 3 && x < b.x + b.w + 3 && y > b.y - 3 && y < b.y + b.h + 3 });
    };
    comp('psii', '#69db7c', 'PSII', 'P680');
    comp('pq', '#ffe066', 'PQ');
    comp('b6f', '#ffa94d', 'Cyt', 'b₆f');
    comp('pc', '#74c0fc', 'PC');
    comp('psi', '#38d9a9', 'PSI', 'P700');
    comp('fd', '#e599f7', 'Fd');
    comp('fnr', '#da77f2', 'NADP⁺', 'reductase');
    // ATP synthase: membrane stalk + head in the stroma
    {
      const lit = hl('atps') || on.includes('atps');
      ctx.fillStyle = '#ffd43b';
      ctx.strokeStyle = lit ? '#fab005' : withAlpha('#212529', 0.45);
      ctx.lineWidth = lit ? 4 : 1.4;
      ctx.beginPath();
      ctx.roundRect(560, 160, 30, 104, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(575, 128, 30, 27, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#212529', 0.55);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = atpSpin + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(575, 128);
        ctx.lineTo(575 + Math.cos(a) * 20, 128 + Math.sin(a) * 18);
        ctx.stroke();
      }
      text('ATP synthase', 575, 290, 10.5, pal['sim-text'], 'center', 800);
      hits.push({ id: 'atps', test: (x, y) => x > 543 && x < 607 && y > 98 && y < 268 });
    }
    // region labels
    text('Stroma (outside the thylakoid)', 10, 18, 11, pal['sim-text'], 'left', 800);
    if (!small) text('Thylakoid membrane', 474, 214, 10, dark() ? '#ffd8a8' : '#7a5c1e', 'center', 800);
    text('Thylakoid lumen (inside)', 630, 470, 11, pal['sim-text'], 'right', 800);
    tag('2H₂O → O₂ + 4H⁺ + 4e⁻', 130, 330, C_H2O, 10.5, 'left');
    if (!small) {
      text('NADP⁺ + 2e⁻ + H⁺ → NADPH', 470, 74, 10, C_NADPH, 'center', 800);
      text('ADP + Pi → ATP', 575, 80, 10, C_ATP, 'center', 800);
    }
    text('to the Calvin cycle ↑', 540, 30, 10, pal['text-muted'], 'center', 750);
    // tokens
    for (const t of toks) {
      const [x, y] = along(t.path, t.d);
      const lbl = (s: string, col: string, r: number, filled = true) => {
        circle(x, y, r, filled ? col : withAlpha(pal['sim-bg'], 0.9), col, 2);
        text(s, x, y + 3.5, 8.5, filled ? '#ffffff' : col, 'center', 800);
      };
      if (t.kind === 'photon') {
        ctx.strokeStyle = C_LIGHT;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const [x0, y0] = along(t.path, Math.max(0, t.d - 40));
        const n = 4;
        for (let i = 0; i <= n * 6; i++) {
          const f = i / (n * 6);
          const px = x0 + (x - x0) * f;
          const py = y0 + (y - y0) * f;
          const off = Math.sin(f * n * Math.PI * 2) * 4;
          const L = Math.hypot(x - x0, y - y0) || 1;
          const qx = px + (-(y - y0) / L) * off;
          const qy = py + ((x - x0) / L) * off;
          if (i) ctx.lineTo(qx, qy);
          else ctx.moveTo(qx, qy);
        }
        ctx.stroke();
        circle(x, y, 3.5, C_LIGHT);
      } else if (t.kind === 'e') lbl('e⁻', '#e67700', 7);
      else if (t.kind === 'h') text('H⁺', x, y + 4, 11, '#e8590c', 'center', 900);
      else if (t.kind === 'h2o') lbl('H₂O', C_H2O, 11);
      else if (t.kind === 'o2') lbl('O₂', C_O2, 9);
      else if (t.kind === 'nadp') lbl('NADP⁺', C_NADPH, 15, false);
      else if (t.kind === 'nadph') lbl('NADPH', C_NADPH, 15);
      else if (t.kind === 'adp') lbl('ADP', C_ATP, 11, false);
      else if (t.kind === 'atp') lbl('ATP', C_ATP, 11);
    }
    if (st.c.I <= 0) tag('Dark: no light is absorbed, so no electrons flow and no O₂, ATP or NADPH is made.', 320, 100, pal.danger, 11, 'center');
    ctx.restore();
    cur = saved;
  }

  /* ======================= Calvin cycle ======================= */
  const CV = { cx: 290, cy: 245, r: 140 };
  const NODE: Record<string, Pt> = { fix: [290, 105], pga: [430, 245], g3p: [290, 385], rubp: [150, 245] };
  const arcPt = (a: number): Pt => [CV.cx + Math.cos(a) * CV.r, CV.cy + Math.sin(a) * CV.r];
  function chain(x: number, y: number, n: number, col: string, label: string) {
    const per = Math.min(n, 6);
    const rows = Math.ceil(n / per);
    const w = per * 7;
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.95);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2 / cur;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 8, y - 9 - rows * 3.5, w + 16, 20 + rows * 7 + 4, 7);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < n; i++) circle(x - w / 2 + 3.5 + (i % per) * 7, y - rows * 3.5 + Math.floor(i / per) * 7, 2.6, pal['sim-text']);
    text(label, x, y + rows * 3.5 + 10, 9.5, col, 'center', 800);
  }
  function drawCalvin(B: Box) {
    panel(B, pal['surface-2']);
    const M = fitLocal(B, 640, 480, 6);
    localMap = M;
    ctx.save();
    ctx.beginPath();
    ctx.rect(B.x + 1, B.y + 1, B.w - 2, B.h - 2);
    ctx.clip();
    ctx.translate(M.ox, M.oy);
    ctx.scale(M.s, M.s);
    const saved = cur;
    cur = cur * M.s;
    const small = cur < 0.6;
    if (small) cur = 0.62;
    hits = [];
    const ph = Math.floor(cycleP) % 4;
    const f = cycleP - Math.floor(cycleP);
    text('Stroma of the chloroplast', 10, 18, 11, pal['sim-text'], 'left', 800);
    // cycle ring
    ctx.strokeStyle = withAlpha(C_GREEN, 0.35);
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(CV.cx, CV.cy, CV.r, 0, Math.PI * 2);
    ctx.stroke();
    const seg = [
      [Math.PI, Math.PI * 1.5],
      [Math.PI * 1.5, Math.PI * 2],
      [0, Math.PI * 0.5],
      [Math.PI * 0.5, Math.PI],
    ];
    const segPhase = [0, 0, 1, 3];
    seg.forEach(([a0, a1], i) => {
      const lit = segPhase[i] === ph && (sim.running || phaseStep >= 0);
      ctx.strokeStyle = lit ? '#fab005' : withAlpha(C_GREEN, 0.75);
      ctx.lineWidth = lit ? 6 : 3.5;
      ctx.beginPath();
      ctx.arc(CV.cx, CV.cy, CV.r, a0 + 0.12, a1 - 0.12);
      ctx.stroke();
      const e = arcPt(a1 - 0.12);
      const e0 = arcPt(a1 - 0.2);
      arrow(e0[0], e0[1], e[0], e[1], lit ? '#fab005' : withAlpha(C_GREEN, 0.85), 3.5);
    });
    // phase labels
    const plab = (s: string, x: number, y: number, i: number, align: CanvasTextAlign = 'center') => tag(s, x, y, i === ph ? '#e67700' : pal['sim-text'], 11, align, 800);
    plab(small ? '1 Fixation' : '1 Fixation (RuBisCO)', 236, 156, 0, 'right');
    plab('2 Reduction', 448, 360, 1, 'center');
    plab('3 Sugar leaves', 290, 446, 2, 'center');
    plab('4 Regeneration', 120, 370, 3, 'center');
    // nodes
    const node = (id: string, fill: string, label: string, sub: string) => {
      const [x, y] = NODE[id];
      const lit = hl(id) || PHASES[ph].on === id;
      ctx.fillStyle = fill;
      ctx.strokeStyle = lit ? '#fab005' : withAlpha('#212529', 0.4);
      ctx.lineWidth = lit ? 4 : 1.4;
      ctx.beginPath();
      ctx.roundRect(x - 44, y - 22, 88, 44, 12);
      ctx.fill();
      ctx.stroke();
      text(label, x, y - 2, 12, '#212529', 'center', 900);
      text(sub, x, y + 13, 9, '#343a40', 'center', 700);
      hits.push({ id, test: (a, b) => Math.abs(a - x) < 46 && Math.abs(b - y) < 24 });
    };
    node('fix', '#ffc9c9', 'RuBisCO', 'fixes CO₂');
    node('pga', '#ffe8cc', '3-PGA', '3 carbons');
    node('g3p', '#fff3bf', 'G3P', '3-carbon sugar');
    node('rubp', '#d0ebff', 'RuBP', '5 carbons');
    // inputs and outputs
    tag('CO₂ from the air spaces', 20, 52, pal['sim-text'], 10.5, 'left');
    arrow(80, 62, NODE.fix[0] - 46, NODE.fix[1] - 6, C_CO2, 3);
    hits.push({ id: 'fix', test: (x, y) => x < 230 && y < 90 && y > 40 });
    // light box
    ctx.fillStyle = withAlpha('#ffec99', dark() ? 0.25 : 0.7);
    ctx.strokeStyle = hl('lightBox') ? '#fab005' : withAlpha(C_ATP, 0.7);
    ctx.lineWidth = hl('lightBox') ? 4 : 1.5;
    ctx.beginPath();
    ctx.roundRect(500, 150, 134, 124, 12);
    ctx.fill();
    ctx.stroke();
    text(small ? 'Light reactions' : 'From the light', 567, 170, 10.5, pal['sim-text'], 'center', 800);
    if (!small) text('reactions', 567, 184, 10.5, pal['sim-text'], 'center', 800);
    hits.push({ id: 'lightBox', test: (x, y) => x > 498 && y > 148 && y < 276 });
    // supply bars: light-reaction capacity vs Calvin demand
    const bar = (y: number, v: number, col: string, label: string) => {
      text(label, 510, y - 3, 9, pal['text-muted'], 'left', 750);
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.25);
      ctx.fillRect(510, y, 114, 8);
      ctx.fillStyle = col;
      ctx.fillRect(510, y, 114 * clamp(v, 0, 1), 8);
    };
    const supply = R.Ac > 0 ? R.Aj / R.Ac : 0;
    bar(210, Math.min(1, supply), C_ATP, small ? 'ATP, NADPH' : 'ATP + NADPH supply');
    bar(240, Math.min(1, R.Ac > 0 && R.Aj > 0 ? R.Ac / R.Aj : 0), C_GREEN, small ? 'CO₂ capacity' : 'CO₂ fixing capacity');
    text(R.Aj < R.Ac ? (small ? 'light limits' : 'light supply limits') : small ? 'CO₂ limits' : 'CO₂ supply limits', 567, 266, 9.5, '#e67700', 'center', 800);
    // ATP and NADPH arrows into the reduction arc
    arrow(500, 225, 448, 300, C_ATP, 2.5);
    tag(small ? '6 ATP, 6 NADPH' : '6 ATP + 6 NADPH', small ? 470 : 486, 300, C_ATP, 10, 'left');
    arrow(452, 330, 500, 276, withAlpha(C_NADPH, 0.7), 2);
    if (!small) tag('6 ADP + 6 NADP⁺', 520, 330, C_NADPH, 9.5, 'left');
    arrow(500, 262, 205, 345, withAlpha(C_ATP, 0.5), 1.8);
    tag('3 ATP', 300, 312, C_ATP, 10, 'center');
    // sugar out
    ctx.fillStyle = withAlpha('#fff3bf', dark() ? 0.25 : 0.85);
    ctx.strokeStyle = hl('sugarBox') ? '#fab005' : withAlpha(C_SUGAR, 0.8);
    ctx.lineWidth = hl('sugarBox') ? 4 : 1.5;
    ctx.beginPath();
    ctx.roundRect(410, 410, 222, 62, 12);
    ctx.fill();
    ctx.stroke();
    text('1 G3P out per 3 CO₂', 521, 432, 10.5, pal['sim-text'], 'center', 800);
    text(small ? '2 G3P → 1 glucose' : '2 G3P → 1 glucose (C₆H₁₂O₆)', 521, 450, 10, pal['text-muted'], 'center', 700);
    if (!small) text('→ sucrose, starch, cellulose', 521, 464, 10, pal['text-muted'], 'center', 700);
    hits.push({ id: 'sugarBox', test: (x, y) => x > 408 && y > 408 });
    arrow(NODE.g3p[0] + 46, NODE.g3p[1] + 10, 408, 440, C_SUGAR, 3);
    // moving molecules for the current phase
    const moving = sim.running || phaseStep >= 0;
    if (moving) {
      const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const onArc = (a0: number, a1: number, t: number) => arcPt(a0 + (a1 - a0) * t);
      if (ph === 0) {
        if (f < 0.5) {
          const p = lerp([80, 62], [NODE.fix[0] - 30, NODE.fix[1]], f * 2);
          chain(p[0], p[1], 3, C_CO2, '3 CO₂');
          const q = onArc(Math.PI, Math.PI * 1.5, f * 2);
          chain(q[0], q[1], 15, '#1c7ed6', '3 RuBP');
        } else {
          const q = onArc(Math.PI * 1.5, Math.PI * 2, (f - 0.5) * 2);
          chain(q[0], q[1], 18, '#e8590c', '6 × 3-PGA');
        }
      } else if (ph === 1) {
        const q = onArc(0, Math.PI * 0.5, f);
        chain(q[0], q[1], 18, f < 0.5 ? '#e8590c' : '#f08c00', f < 0.5 ? '6 × 3-PGA' : '→ 6 G3P');
        const a = lerp([500, 225], [448, 300], f);
        circle(a[0], a[1], 6, C_ATP);
        const b = lerp([500, 235], [452, 308], f);
        circle(b[0], b[1], 6, C_NADPH);
      } else if (ph === 2) {
        const q = arcPt(Math.PI * 0.5);
        chain(q[0] - 40, q[1] - 40, 15, '#f08c00', '5 G3P stay');
        const out = lerp([NODE.g3p[0] + 46, NODE.g3p[1] + 10], [440, 436], f);
        chain(out[0], out[1], 3, C_SUGAR, '1 G3P out');
      } else {
        const q = onArc(Math.PI * 0.5, Math.PI, f);
        chain(q[0], q[1], 15, '#1c7ed6', f < 0.5 ? '5 G3P' : '→ 3 RuBP');
        const a = lerp([500, 262], [205, 345], f);
        circle(a[0], a[1], 6, C_ATP);
      }
    }
    if (st.c.I <= 0) tag('Dark: ATP and NADPH have run out, so the cycle has stopped.', 290, 245, pal.danger, 11, 'center');
    ctx.restore();
    cur = saved;
  }

  /* ======================= Rate lab ======================= */
  const AX: Record<Axis, { lo: number; hi: number; label: string; key: keyof Cond; unit: string }> = {
    light: { lo: 0, hi: 2000, label: 'Light intensity (µmol photons/m²/s)', key: 'I', unit: '' },
    co2: { lo: 0, hi: 1500, label: 'CO₂ in the air (ppm)', key: 'co2', unit: ' ppm' },
    temp: { lo: 0, hi: 50, label: 'Temperature (°C)', key: 'T', unit: ' °C' },
    water: { lo: 0, hi: 100, label: 'Water availability (%)', key: 'water', unit: '%' },
  };
  let cardHits: { key: keyof typeof SCENARIOS; b: Box }[] = [];
  function drawRate(B: Box) {
    panel(B, pal['surface-2']);
    const gH = B.h * (portrait() ? 0.56 : 0.58);
    const P = { x: B.x + 52, y: B.y + 34, w: B.w - 68, h: gH - 34 - 50 / cur };
    const ax = AX[st.axis];
    const yMax = 40;
    const X = (v: number) => P.x + ((v - ax.lo) / (ax.hi - ax.lo)) * P.w;
    const Y = (v: number) => P.y + P.h - (clamp(v, 0, yMax) / yMax) * P.h;
    text(`Rate of photosynthesis (O₂ produced, µmol/m²/s)`, B.x + 12, B.y + 20, 11.5, pal['sim-text'], 'left', 800);
    const sx = niceStep(ax.hi - ax.lo, 6);
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.2);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    for (let v = ax.lo; v <= ax.hi + 1e-9; v += sx) {
      ctx.moveTo(X(v), P.y);
      ctx.lineTo(X(v), P.y + P.h);
    }
    for (let v = 0; v <= yMax; v += 10) {
      ctx.moveTo(P.x, Y(v));
      ctx.lineTo(P.x + P.w, Y(v));
    }
    ctx.stroke();
    for (let v = ax.lo; v <= ax.hi + 1e-9; v += sx) text(fmt(v, 4), X(v), P.y + P.h + 13 / cur, 9.5, pal['text-faint'], 'center', 600);
    for (let v = 0; v <= yMax; v += 10) text(String(v), P.x - 6 / cur, Y(v) + 3 / cur, 9.5, pal['text-faint'], 'right', 600);
    text(ax.label, P.x + P.w, P.y + P.h + 27 / cur, 10, pal['text-muted'], 'right', 700);
    const curve = (over: Partial<Cond>, fn: (c: Cond) => number = (c) => rates(c).A) => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 120; i++) {
        const v = ax.lo + ((ax.hi - ax.lo) * i) / 120;
        pts.push([v, fn({ ...st.c, ...over, [ax.key]: v } as Cond)]);
      }
      return pts;
    };
    const draw = (pts: Pt[], col: string, lw: number, dash: number[] = []) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw / cur;
      ctx.setLineDash(dash.map((d) => d / cur));
      ctx.beginPath();
      pts.forEach(([v, a], i) => (i ? ctx.lineTo(X(v), Y(a)) : ctx.moveTo(X(v), Y(a))));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const refLabels: [string, number][] = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(P.x, P.y - 2, P.w, P.h + 4);
    ctx.clip();
    // shaded zones
    if (st.axis === 'light') {
      const pts = curve({});
      const top = pts[pts.length - 1][1];
      const sat = pts.find((q) => q[1] >= 0.95 * top);
      if (sat && top > 0.5) {
        ctx.fillStyle = withAlpha(pal.warning, 0.1);
        ctx.fillRect(X(sat[0]), P.y, P.x + P.w - X(sat[0]), P.h);
      }
      // the two ceilings
      const fT = tempFactor(st.c.T);
      draw(curve({}, (c) => lightLimited(c.I, fT)), withAlpha(C_LIGHT, 0.9), 1.8, [6, 4]);
      const ac = co2Limited(internalCO2(st.c.co2, stomata(st.c.water)), fT);
      draw([[ax.lo, ac], [ax.hi, ac]], withAlpha(C_CO2, 0.9), 1.8, [6, 4]);
      for (const co2 of [200, 1000]) if (Math.abs(co2 - st.c.co2) > 60) {
        const pts = curve({ co2 });
        draw(pts, withAlpha(pal['text-faint'], 0.6), 1.6);
        refLabels.push([`${co2} ppm CO₂`, pts[pts.length - 1][1]]);
      }
    } else if (st.axis === 'co2') {
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.6);
      ctx.setLineDash([4 / cur, 4 / cur]);
      ctx.beginPath();
      ctx.moveTo(X(420), P.y);
      ctx.lineTo(X(420), P.y + P.h);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const I of [200, 2000]) if (Math.abs(I - st.c.I) > 100) {
        const pts = curve({ I });
        draw(pts, withAlpha(pal['text-faint'], 0.6), 1.6);
        refLabels.push([`light ${I}`, pts[pts.length - 1][1]]);
      }
    } else if (st.axis === 'temp') {
      ctx.fillStyle = withAlpha(pal.danger, 0.1);
      ctx.fillRect(X(40), P.y, P.x + P.w - X(40), P.h);
      for (const I of [200, 2000]) if (Math.abs(I - st.c.I) > 100) {
        const pts = curve({ I });
        draw(pts, withAlpha(pal['text-faint'], 0.6), 1.6);
        refLabels.push([`light ${I}`, pts[pts.length - 1][1]]);
      }
    } else {
      ctx.fillStyle = withAlpha(pal.danger, 0.08);
      ctx.fillRect(P.x, P.y, X(60) - P.x, P.h);
    }
    draw(curve({}), C_GREEN, 3);
    const cx = st.c[ax.key];
    ctx.strokeStyle = withAlpha(pal['sim-text'], 0.5);
    ctx.setLineDash([4 / cur, 4 / cur]);
    ctx.lineWidth = 1.2 / cur;
    ctx.beginPath();
    ctx.moveTo(X(cx), P.y);
    ctx.lineTo(X(cx), P.y + P.h);
    ctx.stroke();
    ctx.setLineDash([]);
    circle(X(cx), Y(R.A), 6.5 / cur, C_GREEN, pal['sim-bg'], 2);
    ctx.restore();
    // annotations
    if (st.axis === 'light') {
      const pts = curve({});
      const top = pts[pts.length - 1][1];
      const sat = pts.find((q) => q[1] >= 0.95 * top);
      if (sat && top > 0.5) tag('Light saturation: more light barely helps', Math.min(X(sat[0]) + 6 / cur, P.x + P.w - 4 / cur), P.y + P.h - 8 / cur, '#e67700', 10, X(sat[0]) > P.x + P.w * 0.55 ? 'right' : 'left');
      tag('light-limited ceiling', X(240), Y(lightLimited(240, tempFactor(st.c.T))) - 12 / cur, '#e67700', 9.5, 'left');
      const ac = co2Limited(internalCO2(st.c.co2, stomata(st.c.water)), tempFactor(st.c.T));
      tag('CO₂-limited ceiling', P.x + P.w - 4 / cur, Y(ac) - 7 / cur, pal['text-muted'], 9.5, 'right');
    } else if (st.axis === 'co2') tag('today’s air', X(420) + 4 / cur, P.y + 14 / cur, pal['text-muted'], 9.5, 'left');
    else if (st.axis === 'temp') {
      tag('enzymes damaged', X(40) + 4 / cur, P.y + 14 / cur, pal.danger, 9.5, 'left');
      tag(`optimum ≈ ${T_OPT} °C`, X(T_OPT), P.y + 14 / cur, C_GREEN, 9.5, 'center');
    } else tag('stomata closing', X(30), P.y + 14 / cur, pal.danger, 9.5, 'center');
    for (const [s2, v] of refLabels) tag(s2, P.x + P.w - 4 / cur, Y(v) - 6 / cur, pal['text-faint'], 9.5, 'right');
    tag(`now: ${fmt(R.A)}`, clamp(X(cx) + 8 / cur, P.x, P.x + P.w - 60 / cur), Y(R.A) - 10 / cur, C_GREEN, 10.5, 'left');
    // comparison cards
    cardHits = [];
    const keys = Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[];
    const top = B.y + gH;
    const cw = (B.w - 24 - 16) / 3;
    const ch = B.h - gH - 12;
    text('Compare limiting conditions (tap a card to use it)', B.x + 12, top - 6 / cur, 10.5, pal['sim-text'], 'left', 800);
    keys.forEach((k, i) => {
      const S = SCENARIOS[k];
      const r = rates(S.c);
      const cb = { x: B.x + 12 + i * (cw + 8), y: top + 4, w: cw, h: ch - 4 };
      const active = (Object.keys(S.c) as (keyof Cond)[]).every((q) => S.c[q] === st.c[q]);
      ctx.fillStyle = pal['bg-elev'];
      ctx.strokeStyle = active ? C_GREEN : pal.border;
      ctx.lineWidth = (active ? 3 : 1) / cur;
      ctx.beginPath();
      ctx.roundRect(cb.x, cb.y, cb.w, cb.h, 8);
      ctx.fill();
      ctx.stroke();
      cardHits.push({ key: k, b: cb });
      let yy = cb.y + 17 / cur;
      const x0 = cb.x + 8 / cur;
      const mw = cb.w - 16 / cur;
      yy = wrap(S.name.replace('-', ' '), x0, yy, mw, 11.5, pal['sim-text'], 800);
      yy = wrap(`${S.c.I} light · ${S.c.co2} ppm · ${S.c.T} °C`, x0, yy, mw, 9.5, pal['text-faint'], 650);
      yy = wrap(`Rate ${fmt(r.A)}`, x0, yy, mw, 11, C_GREEN, 800);
      const fx = [
        { s: 'Double the light', a: rates({ ...S.c, I: S.c.I * 2 }).A },
        { s: 'Double the CO₂', a: rates({ ...S.c, co2: S.c.co2 * 2 }).A },
        { s: `${S.c.T < T_OPT ? 'Warm' : 'Cool'} to ${T_OPT} °C`, a: rates({ ...S.c, T: T_OPT }).A },
      ]
        .map((e) => ({ ...e, p: r.A > 0 ? (100 * (e.a - r.A)) / r.A : 0 }))
        .sort((u, v) => v.p - u.p);
      const best = Math.max(...fx.map((e) => e.p));
      for (const e of fx) {
        if (yy > cb.y + cb.h - 4 / cur) break;
        yy = wrap(`${e.s}: ${e.p >= 0 ? '+' : '−'}${fmt(Math.abs(e.p), 2)}%`, x0, yy, mw, 9.5, e.p === best && best > 10 ? C_GREEN : pal['text-muted'], e.p === best && best > 10 ? 800 : 650);
      }
    });
  }

  /* ======================= Side panel and footer ======================= */
  function drawSide(B: Box) {
    panel(B);
    text('Simplified model, not a full biochemical model', B.x + B.w - 10 / cur, B.y + B.h - 8 / cur, 9.5, pal['text-faint'], 'right', 650);
    const x0 = B.x + 14;
    const maxW = B.w - 28;
    let yy = B.y + 22;
    const maxY = B.y + B.h - 22 / cur;
    const ln = (s: string, col = pal['text-muted'], px = 11, wt = 600) => {
      if (yy + 2 / cur > maxY) return;
      yy = wrap(s, x0, yy, maxW, px, col, wt, maxY);
    };
    if (st.view === 'light' && stage >= 0) {
      ln(`Step ${stage + 1} of 8: ${STAGES[stage].t}`, '#e67700', 12.5, 800);
      ln(STAGES[stage].d, pal['sim-text'], 11, 650);
      yy += 4 / cur;
    } else if (st.view === 'calvin' && phaseStep >= 0) {
      ln(`Phase ${phaseStep + 1} of 4: ${PHASES[phaseStep].t}`, '#e67700', 12.5, 800);
      ln(PHASES[phaseStep].d, pal['sim-text'], 11, 650);
      yy += 4 / cur;
    }
    if (sel && INFO[sel]) {
      ln(INFO[sel].name, C_GREEN, 13, 800);
      ln(INFO[sel].text, pal['sim-text'], 11, 600);
      const live = liveLine(sel);
      if (live) {
        yy += 2 / cur;
        ln(live, '#e67700', 10.5, 750);
      }
      return;
    }
    if ((st.view === 'light' && stage >= 0) || (st.view === 'calvin' && phaseStep >= 0)) return;
    const intro: Record<View, string> = {
      leaf: 'A cross-section through a leaf. Light enters from above; CO₂ diffuses in through the stomata; water arrives in the xylem of the vein; O₂ leaves through the stomata and sugar is carried away in the phloem. Tap any structure to inspect it, or tap a chloroplast to zoom in.',
      chloro: 'Inside one chloroplast. The thylakoids, stacked into grana, capture light and make ATP and NADPH (orange and purple dots) and O₂. In the stroma, the Calvin cycle uses them to fix CO₂ into sugar, stored as starch. Tap a structure to inspect it.',
      light: 'A patch of thylakoid membrane. Light drives electrons from water, through PSII and PSI, to NADP⁺. On the way, H⁺ is pumped into the lumen and flows back through ATP synthase to make ATP. Press Next stage to go through it one stage at a time.',
      calvin: 'The Calvin cycle in the stroma fixes CO₂ into sugar using ATP and NADPH from the light-dependent reactions. It does not use light directly, but it stops in the dark when ATP and NADPH run out. Press Next phase to go phase by phase.',
      rate: 'The rate is set by whichever factor is in shortest supply. Increasing a factor that is not limiting barely changes the rate. Light saturates: above a certain intensity more light no longer helps.',
    };
    ln(intro[st.view], pal['sim-text'], 11, 600);
    yy += 4 / cur;
    if (st.view === 'leaf' || st.view === 'chloro') {
      const items: [string, string][] = st.view === 'leaf' ? [[C_LIGHT, 'Light'], [C_CO2, 'CO₂ in'], [C_O2, 'O₂ out'], [C_H2O, 'Water'], [C_SUGAR, 'Sugar to phloem']] : [[C_LIGHT, 'Light'], [C_ATP, 'ATP'], [C_NADPH, 'NADPH'], [C_CO2, 'CO₂'], [C_O2, 'O₂'], [C_SUGAR, 'Sugar']];
      let lx = x0;
      for (const [col, s] of items) {
        ctx.font = fs(10.5, 750);
        const w = ctx.measureText(s).width + 26 / cur;
        if (lx + w > B.x + B.w - 10) {
          lx = x0;
          yy += 16 / cur;
        }
        circle(lx + 5 / cur, yy - 4 / cur, 4.5 / cur, col);
        text(s, lx + 13 / cur, yy, 10.5, pal['text-muted'], 'left', 750);
        lx += w;
      }
      yy += 20 / cur;
    }
    ln(`Limiting factor now: ${LIMIT_TEXT[R.limit]}.`, '#e67700', 11, 800);
    if (st.view === 'rate') ln(rateExplain(), pal['text-muted'], 10.5, 600);
  }
  function rateExplain() {
    const c = st.c;
    switch (R.limit) {
      case 'light':
        return 'More light would speed it up; more CO₂ would barely help until the light increases.';
      case 'co2':
        return 'The light reactions could go faster, but RuBisCO is short of CO₂. More light would barely help; more CO₂ would.';
      case 'stomata':
        return 'The leaf is short of water, so its stomata are partly closed and less CO₂ gets in. Watering the plant would help.';
      case 'colimited':
        return 'Light and CO₂ are both close to limiting, so raising either one helps a little.';
      case 'temperature':
        return c.T < T_OPT ? 'It is too cold: the enzymes of the Calvin cycle work slowly. Warming towards the optimum would help most.' : 'It is too hot: enzymes and membranes are being damaged. Cooling would help.';
      case 'water':
        return 'The leaf is wilting: stomata are shut and its cells are damaged. Photosynthesis is almost stopped.';
      default:
        return 'In the dark the leaf still respires, so it takes in O₂ and gives out CO₂.';
    }
  }
  function liveLine(id: string) {
    const A = R.A;
    switch (id) {
      case 'stoma':
      case 'guard':
        return `Now: stomata ${Math.round(R.g * 100)}% open; CO₂ inside the leaf ≈ ${Math.round(R.ci)} ppm.`;
      case 'palisade':
      case 'spongy':
      case 'chloroplastLeaf':
        return `Now: producing ${fmt(A)} µmol O₂ per m² per second.`;
      case 'xylem':
        return `Water availability ${st.c.water}%.`;
      case 'phloem':
        return `Sugar made so far: ${fmt(sugarMg)} mg of glucose per m² of leaf.`;
      case 'psii':
        return `Now: ${fmt(R.electrons)} µmol of electrons and ${fmt(A)} µmol of O₂ per m² per second.`;
      case 'atps':
        return `Now: ${fmt(R.atp)} µmol ATP per m² per second.`;
      case 'fnr':
        return `Now: ${fmt(R.nadph)} µmol NADPH per m² per second.`;
      case 'fix':
        return `Now: fixing ${fmt(A)} µmol CO₂ per m² per second (CO₂ inside the leaf ≈ ${Math.round(R.ci)} ppm).`;
      case 'starch':
        return `Sugar made so far: ${fmt(sugarMg)} mg of glucose per m² of leaf.`;
      default:
        return '';
    }
  }
  function drawFoot(B: Box) {
    panel(B);
    const eq = '6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂';
    if (portrait()) {
      text(eq, B.x + B.w / 2, B.y + 10 + 14 / cur, 12.5, pal['sim-text'], 'center', 800);
      drawMeter(B.x + 14, B.y + 10 + 30 / cur, B.w - 28);
    } else {
      text(eq, B.x + 14, B.y + B.h / 2 + 5 / cur, 13, pal['sim-text'], 'left', 800);
      drawMeter(B.x + B.w * 0.5, B.y + B.h / 2 - 4 / cur, B.w * 0.5 - 14);
    }
  }
  function drawMeter(x: number, y: number, w: number) {
    const label = 'O₂ production';
    text(label, x, y + 8 / cur, 10.5, pal['text-muted'], 'left', 800);
    ctx.font = fs(10.5, 800);
    const lw = ctx.measureText(label).width + 10 / cur;
    const val = `${fmt(R.A)} µmol/m²/s`;
    ctx.font = fs(10.5, 800);
    const valW = ctx.measureText(val).width + 12 / cur;
    const bw = Math.max(30, w - lw - valW);
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.22);
    ctx.fillRect(x + lw, y, bw, 10 / cur);
    ctx.fillStyle = C_O2;
    ctx.fillRect(x + lw, y, bw * clamp(R.A / 35, 0, 1), 10 / cur);
    // moving tick marks show the flow
    if (R.A > 0.1) {
      ctx.fillStyle = withAlpha('#ffffff', 0.6);
      const sp = (simMin * R.A * 2) % 12;
      for (let k = sp; k < bw * clamp(R.A / 35, 0, 1); k += 12) ctx.fillRect(x + lw + k, y + 2 / cur, 2 / cur, 6 / cur);
    }
    text(val, x + lw + bw + 8 / cur, y + 9 / cur, 10.5, R.A > 0.1 ? C_O2 : pal['text-faint'], 'left', 800);
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    const { k, ox, oy } = tf();
    cur = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const Lo = layout();
    if (st.view === 'leaf') drawLeaf(Lo.vis);
    else if (st.view === 'chloro') drawChloroplast(Lo.vis);
    else if (st.view === 'light') drawLight(Lo.vis);
    else if (st.view === 'calvin') drawCalvin(Lo.vis);
    else drawRate(Lo.vis);
    drawSide(Lo.side);
    drawFoot(Lo.foot);
    ctx.restore();
    updateUi();
  }

  /* ======================= Readouts ======================= */
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    r('r1', 'O₂ produced', `${fmt(R.A)} µmol/m²/s`, R.A > 0.1 ? 'ok' : 'bad');
    r('r2', 'Net O₂ released', `${fmt(R.net)} µmol/m²/s`, R.net < 0 ? 'bad' : null);
    r('r3', 'Limiting factor', SHORT[R.limit], R.limit === 'water' || R.limit === 'dark' ? 'bad' : 'warn');
    r('r4', 'Stomata open', `${Math.round(R.g * 100)}%`, R.g < 0.5 ? 'bad' : null);
    r('r5', 'ATP / NADPH made', `${fmt(R.atp)} / ${fmt(R.nadph)} µmol/m²/s`);
    r('r6', `Sugar made (${fmt(simMin, 3)} min)`, `${fmt(sugarMg)} mg glucose/m²`);
    let note = lastMsg;
    if (!note) {
      if (st.view === 'light') note = stage >= 0 ? `Step ${stage + 1} of 8: ${STAGES[stage].t}. Press Next stage to continue, or Start to run everything together.` : 'Press Start to run the whole chain at the rate set by the conditions, or Next stage to go through it one stage at a time. Tap a protein to inspect it.';
      else if (st.view === 'calvin') note = phaseStep >= 0 ? `Phase ${phaseStep + 1} of 4: ${PHASES[phaseStep].t}. ${turns} turn${turns === 1 ? '' : 's'} completed: ${turns * 3} CO₂ fixed, ${turns * 9} ATP and ${turns * 6} NADPH used, ${turns} G3P made.` : `Press Start to run the cycle at the rate set by the conditions, or Next phase for one phase at a time. ${turns} turn${turns === 1 ? '' : 's'} completed: ${turns * 3} CO₂ fixed, ${turns * 9} ATP and ${turns * 6} NADPH used.`;
      else if (st.view === 'leaf') note = 'Press Start to watch light, CO₂, water and O₂ move through the leaf. Change the conditions with the sliders. Tap a structure to inspect it; tap a chloroplast to zoom in.';
      else if (st.view === 'chloro') note = 'Press Start to see the chloroplast at work. Drag to move, scroll or pinch (or use the zoom buttons) to zoom, and tap any part to inspect it. Zoom in on a granum to pick out a single thylakoid and its lumen.';
      else note = `${LIMIT_TEXT[R.limit]} is limiting. ${rateExplain()}`;
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
    sim.setBadge(st.view === 'rate' ? (R.limit === 'dark' ? 'No light' : `Limit: ${SHORT[R.limit].toLowerCase().replace('co₂', 'CO₂')}`) : { leaf: 'Leaf', chloro: 'Chloroplast', light: 'Thylakoid membrane', calvin: 'Calvin cycle' }[st.view as Exclude<View, 'rate'>]);
    canvas.setAttribute('aria-label', `${viewSel.selectedOptions[0]?.textContent ?? ''}. ${noteEl.textContent}`);
  }

  /* ======================= Interaction ======================= */
  const local = (e: { clientX: number; clientY: number }) => {
    const rc = canvas.getBoundingClientRect();
    return toBox(e.clientX - rc.left, e.clientY - rc.top);
  };
  const inBox = (B: Box, x: number, y: number) => x >= B.x && x <= B.x + B.w && y >= B.y && y <= B.y + B.h;
  function hitAt(lx: number, ly: number) {
    hitOverride = null;
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].test(lx, ly)) return hitOverride ?? hits[i].id;
    return null;
  }
  function select(id: string | null) {
    sel = id;
    lastMsg = '';
    sim.requestRender();
  }
  function startZoom(lx: number, ly: number) {
    const M = localMap;
    zoomAnim = { t: 0, x: M.ox + lx * M.s, y: M.oy + ly * M.s };
    let last = performance.now();
    const tick = (now: number) => {
      if (!zoomAnim) return;
      zoomAnim.t = Math.min(1, zoomAnim.t + (now - last) / 700);
      last = now;
      if (zoomAnim.t >= 1) {
        zoomAnim = null;
        setView('chloro');
        return;
      }
      sim.requestRender();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const pointers = new Map<number, Pt>();
  let dragStart: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  let pinch: { d: number; z: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    const [bx, by] = local(e);
    const Lo = layout();
    if (!inBox(Lo.vis, bx, by)) return;
    pointers.set(e.pointerId, [bx, by]);
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2 && st.view === 'chloro') {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom.z };
      dragStart = null;
      return;
    }
    dragStart = { x: bx, y: by, cx: zoom.cx, cy: zoom.cy, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    const [bx, by] = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [bx, by]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setZoom(pinch.z * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
      return;
    }
    if (dragStart) {
      if (Math.hypot(bx - dragStart.x, by - dragStart.y) > 6) dragStart.moved = true;
      if (dragStart.moved && st.view === 'chloro') {
        const { s } = chMap();
        zoom.cx = dragStart.cx - (bx - dragStart.x) / (s * zoom.z);
        zoom.cy = dragStart.cy - (by - dragStart.y) / (s * zoom.z);
        clampPan();
        sim.requestRender();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const Lo = layout();
      canvas.style.cursor = inBox(Lo.vis, bx, by) ? (st.view === 'chloro' ? 'grab' : st.view === 'rate' ? (cardHits.some((c) => inBox(c.b, bx, by)) ? 'pointer' : '') : 'pointer') : '';
    }
  });
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const d = dragStart;
    dragStart = null;
    if (!d || d.moved) return;
    const [bx, by] = [d.x, d.y];
    if (st.view === 'rate') {
      const c = cardHits.find((q) => inBox(q.b, bx, by));
      if (c) applyConditions(SCENARIOS[c.key].c, `${SCENARIOS[c.key].name} conditions applied.`);
      return;
    }
    let lx: number;
    let ly: number;
    if (st.view === 'chloro') [lx, ly] = chToLocal(bx, by);
    else {
      lx = (bx - localMap.ox) / localMap.s;
      ly = (by - localMap.oy) / localMap.s;
    }
    const id = hitAt(lx, ly);
    if (st.view === 'leaf' && id === 'chloroplastLeaf') {
      sel = null;
      startZoom(lx, ly);
      return;
    }
    select(id === sel ? null : id);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    pinch = null;
    dragStart = null;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (st.view !== 'chloro') return;
      e.preventDefault();
      setZoom(zoom.z * Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (st.view !== 'chloro') return;
      const [bx, by] = local(e.touches[0]);
      if (inBox(layout().vis, bx, by)) e.preventDefault();
    },
    { passive: false },
  );
  function clampPan() {
    const m = CH.rx * (1 - 1 / zoom.z) + 20;
    const n = CH.ry * (1 - 1 / zoom.z) + 20;
    zoom.cx = clamp(zoom.cx, CH.x - m, CH.x + m);
    zoom.cy = clamp(zoom.cy, CH.y - n, CH.y + n);
    if (zoom.z <= 1.001) {
      zoom.cx = CH.x;
      zoom.cy = CH.y;
    }
  }
  function setZoom(z: number) {
    zoom.z = clamp(z, 1, 4);
    clampPan();
    sim.requestRender();
  }

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.querySelectorAll<HTMLElement>('[data-views]').forEach((el) => (el.hidden = !el.dataset.views!.split(' ').includes(st.view)));
    const stepBtn = root.querySelector<HTMLButtonElement>('[data-step]')!;
    stepBtn.textContent = st.view === 'light' ? 'Next stage' : st.view === 'calvin' ? 'Next phase' : 'Step 1 minute';
  }
  function setView(v: View) {
    st.view = v;
    viewSel.value = v;
    toks = [];
    flashes = [];
    sel = null;
    lastMsg = '';
    stage = -1;
    phaseStep = -1;
    showView();
    sim.requestRender();
  }
  viewSel.addEventListener('change', () => setView(viewSel.value as View));
  const condChanged = () => {
    R = rates(st.c);
    lastMsg = '';
    sim.requestRender();
  };
  const lightCtl = ui.range('ps-light', (q) => (q === 0 ? 'dark' : `${q}`), (q) => ((st.c.I = q), condChanged()));
  const co2Ctl = ui.range('ps-co2', (q) => `${q} ppm`, (q) => ((st.c.co2 = q), condChanged()));
  const waterCtl = ui.range('ps-water', (q) => `${q}%`, (q) => ((st.c.water = q), condChanged()));
  const tempCtl = ui.range('ps-temp', (q) => `${q} °C`, (q) => ((st.c.T = q), condChanged()));
  const speedCtl = ui.range('ps-speed', (q) => `${q}×`, (q) => (st.speed = q));
  const axisCtl = ui.choice<Axis>('ps-axis', (q) => ((st.axis = q), sim.requestRender()));
  function applyConditions(c: Cond, msg: string) {
    st.c = { ...c };
    lightCtl.set(c.I, false);
    co2Ctl.set(c.co2, false);
    waterCtl.set(c.water, false);
    tempCtl.set(c.T, false);
    R = rates(st.c);
    lastMsg = `${msg} ${LIMIT_TEXT[R.limit]} is now limiting. ${rateExplain()}`;
    sim.requestRender();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-cond]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.cond!;
      if (k === 'default') applyConditions(DEF, 'Typical conditions on a bright day.');
      else if (k === 'drought') applyConditions({ ...DEF, I: 1500, water: 25 }, 'Drought: bright light but the leaf is short of water.');
      else {
        const S = SCENARIOS[k as keyof typeof SCENARIOS];
        applyConditions(S.c, `${S.name} conditions applied.`);
      }
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.zoom;
      if (k === 'in') setZoom(zoom.z * 1.5);
      else if (k === 'out') setZoom(zoom.z / 1.5);
      else {
        zoom = { z: 1, cx: CH.x, cy: CH.y };
        sim.requestRender();
      }
    }),
  );
  root.querySelector('[data-step]')?.addEventListener('click', () => {
    lastMsg = '';
    if (st.view === 'light') {
      stage = (stage + 1) % STAGES.length;
      toks = [];
      acc[`ls${stage}`] = 1;
      sel = null;
      if (st.c.I <= 0) lastMsg = 'It is dark, so nothing happens: turn the light up to see this stage.';
      stepping = true;
      sim.play();
      return;
    }
    if (st.view === 'calvin') {
      const prev = phaseStep;
      phaseStep = prev < 0 ? Math.floor(cycleP) % 4 : (prev + 1) % 4;
      if (prev === 3 && phaseStep === 0) turns++;
      cycleP = phaseStep;
      sel = null;
      if (st.c.I <= 0) lastMsg = 'It is dark: without ATP and NADPH from the light-dependent reactions the cycle cannot turn. Turn the light up.';
      stepping = true;
      sim.play();
      return;
    }
    sim.pause();
    for (let i = 0; i < 20; i++) step(0.05 / st.speed);
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(isOn: boolean) {
      if (!isOn) return;
      if (!stepping) {
        stage = -1;
        phaseStep = -1;
      }
      stepping = false;
      lastMsg = '';
    },
    reset() {
      st.c = { ...DEF };
      lightCtl.set(DEF.I, false);
      co2Ctl.set(DEF.co2, false);
      waterCtl.set(DEF.water, false);
      tempCtl.set(DEF.T, false);
      st.speed = 1;
      speedCtl.set(1, false);
      st.axis = 'light';
      axisCtl.set('light', false);
      R = rates(st.c);
      simMin = 0;
      sugarMg = 0;
      turns = 0;
      cycleP = 0;
      zoom = { z: 1, cx: CH.x, cy: CH.y };
      toks = [];
      flashes = [];
      sel = null;
      stage = -1;
      phaseStep = -1;
      lastMsg = '';
    },
  });

  showView();
  sim.requestRender();
}
