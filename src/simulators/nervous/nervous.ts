/**
 * Animal nervous systems and sensory responses, in three views:
 *   neuron  – a neuron you can stimulate: graded potentials, threshold,
 *             all-or-none action potentials, myelin, and a synapse close-up
 *   reflex  – a reflex arc, step by step (withdrawal reflex or knee-jerk)
 *   animals – five animals with simple to complex nervous systems responding
 *             (or not) to light, sound, touch and an approaching object
 *
 * Neuron model (simplified, slowed down about 1,000 times). The voltage at
 * the axon hillock relaxes towards −70 mV. A brief stimulus of strength s
 * raises it by 0.3·s mV (s in %), so the threshold of −55 mV is reached at
 * 50 %. A held stimulus pulls the voltage towards −70 + 0.3·s mV; above
 * threshold it fires repeatedly, and faster for stronger stimuli (rate
 * coding), limited by the refractory period. An action potential follows a
 * fixed shape (+30 mV peak, undershoot to −80 mV) whatever the stimulus
 * strength: all-or-none.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, withAlpha } from '../shared/draw';
import { ANIMALS, REFLEX, type AnimalId, type ReflexId, type Stimulus } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'neuron' | 'reflex' | 'animals';
type Pt = [number, number];
type Fs = (px: number, w?: number) => string;

const DEF = {
  view: 'neuron' as View,
  strength: 60,
  hold: false,
  myelin: true,
  block: false,
  ions: false,
  reflex: 'withdraw' as ReflexId,
  rstep: 0,
  animal: 'earthworm' as AnimalId,
  stim: 'light' as Stimulus,
  astrength: 60,
  showNS: true,
};

/* ---------- Neuron geometry (native frame 960 × 260) ---------- */
const SOMA = { x: 190, y: 130, r: 44 };
const AX0 = 262;
const AX1 = 780;
const AY = 130;
const NODES = 7;
const nodeX = (i: number) => AX0 + ((AX1 - AX0) * i) / (NODES - 1);
const DEND: Pt[][] = [
  [[156, 104], [104, 62], [62, 40]],
  [[104, 62], [98, 22]],
  [[148, 122], [84, 116], [30, 105]],
  [[84, 116], [44, 142]],
  [[154, 158], [108, 200], [72, 232]],
  [[108, 200], [58, 196]],
  [[176, 88], [162, 42], [134, 14]],
  [[184, 174], [172, 222], [150, 250]],
];
const TERM: Pt[][] = [
  [[AX1, AY], [812, AY], [868, 72]],
  [[AX1, AY], [812, AY], [886, AY]],
  [[AX1, AY], [812, AY], [868, 188]],
];
const STIM_PT: Pt = [30, 105];
const AP_LEN = 0.6;
const TERM_T = 0.35;
const TW = 4;
const RY = [70, 100, 130, 160, 190];

/* ---------- Reflex timings (approximate, ms) ---------- */
const TIMES: Record<ReflexId, number[]> = {
  withdraw: [0, 1, 15, 22, 35, 45, 50, 250],
  knee: [0, 1, 10, 12, 18, 22, 25, 250],
};

/* ---------- Animals ---------- */
const ORDER: AnimalId[] = ['hydra', 'planarian', 'earthworm', 'insect', 'cat'];
const SYS_SHORT: Record<AnimalId, string> = {
  hydra: 'Nerve net, no brain',
  planarian: 'Head ganglia, two nerve cords',
  earthworm: 'Brain, segmented nerve cord',
  insect: 'Brain, ventral nerve cord',
  cat: 'Brain and spinal cord',
};
const COORD: Record<AnimalId, string> = {
  hydra: 'Nerve net',
  planarian: 'Head ganglia',
  earthworm: 'Brain + nerve cord',
  insect: 'Brain + ganglia',
  cat: 'Brain + spinal cord',
};
const SHORT: Record<AnimalId, Partial<Record<Stimulus, string>>> = {
  hydra: { light: 'Bends towards light', touch: 'Contracts' },
  planarian: { light: 'Turns away', touch: 'Contracts, turns' },
  earthworm: { light: 'Burrows into soil', sound: 'Crawls away', touch: 'Shortens fast' },
  insect: { light: 'Runs to shelter', sound: 'Runs away', touch: 'Runs away', motion: 'Darts away' },
  cat: { light: 'Pupils narrow', sound: 'Ears turn', touch: 'Flinches', motion: 'Crouches, stares' },
};
const ORIGIN: Record<AnimalId, Pt> = { hydra: [300, 385], planarian: [300, 240], earthworm: [300, 290], insect: [330, 240], cat: [300, 250] };
interface Geo {
  rec: Partial<Record<Stimulus, Pt[]>>;
  center: Pt;
  eff: Pt[][];
  effFor?: Partial<Record<Stimulus, Pt[][]>>;
}
const CAT_LEGS: Pt[][] = [
  [[118, -55], [100, -35], [72, -30], [72, 95]],
  [[118, -55], [100, -35], [48, -31], [48, 95]],
  [[118, -55], [100, -35], [0, -32], [-56, -26], [-56, 95]],
  [[118, -55], [100, -35], [0, -32], [-82, -20], [-82, 95]],
];
const GEO: Record<AnimalId, Geo> = {
  hydra: { rec: { light: [[0, -182]], touch: [[18, -110]] }, center: [0, -90], eff: [] },
  planarian: {
    rec: { light: [[100, -8], [88, -4]], touch: [[0, -31], [0, -9], [88, -8]] },
    center: [88, 0],
    eff: [[[88, -8], [-120, -7]], [[88, 8], [-120, 7]]],
  },
  earthworm: {
    rec: { light: [[152, -14], [158, -6]], touch: [[40, -16], [40, 8], [150, 8], [158, -6]], sound: [[0, 16], [0, 8], [150, 8], [158, -6]] },
    center: [158, -6],
    eff: [[[158, -6], [150, 8], [-145, 8]]],
  },
  insect: {
    rec: {
      light: [[110, -14], [102, 0]],
      motion: [[110, -14], [102, 0]],
      sound: [[-118, -18], [-90, -5], [-80, 0], [102, 0]],
      touch: [[204, -58], [160, -40], [118, -8], [102, 0]],
    },
    center: [102, 0],
    eff: [
      [[102, 0], [72, 0], [92, -54]],
      [[102, 0], [72, 0], [92, 54]],
      [[102, 0], [60, 0], [56, -62]],
      [[102, 0], [60, 0], [56, 62]],
      [[102, 0], [48, 0], [14, -58]],
      [[102, 0], [48, 0], [14, 58]],
    ],
  },
  cat: {
    rec: { light: [[140, -55], [118, -55]], motion: [[140, -55], [118, -55]], sound: [[146, -98], [124, -62]], touch: [[0, -42], [0, -32], [100, -35], [118, -55]] },
    center: [118, -55],
    eff: CAT_LEGS,
    effFor: { light: [[[118, -55], [140, -55]]], sound: [[[118, -55], [118, -86]], [[118, -55], [144, -88]]], motion: [...CAT_LEGS, [[118, -55], [140, -55]]] },
  },
};
const SRC_T = 0.8;
const REC_T = 0.9;
const CEN_T = 1.8;
const EFF_T = 2.5;

/** A tiny seeded random generator so the nerve net looks the same every time. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const NET = (() => {
  const rnd = seeded(7);
  const pts: Pt[] = [];
  for (let i = 0; i < 30; i++) {
    const y = -8 - rnd() * 162;
    const half = 14 + 4 * Math.sin((-y / 170) * Math.PI);
    pts.push([(rnd() * 2 - 1) * half, y]);
  }
  const edges: [number, number][] = [];
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: Math.hypot(p[0] - q[0], p[1] - q[1]) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const n of near) if (i < n.j || !edges.some(([a, b]) => a === n.j && b === i)) edges.push([i, n.j]);
  });
  return { pts, edges };
})();

const mv = (v: number) => `${Math.round(v) < 0 ? '−' : ''}${Math.abs(Math.round(v))} mV`;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function polyLen(pts: Pt[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
function polyAt(pts: Pt[], u: number): Pt {
  if (pts.length === 1) return pts[0];
  let d = clamp(u, 0, 1) * polyLen(pts);
  for (let i = 1; i < pts.length; i++) {
    const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= s || i === pts.length - 1) {
      const t = s ? Math.min(1, d / s) : 0;
      return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
    }
    d -= s;
  }
  return pts[pts.length - 1];
}
/** The part of a polyline from its start up to fraction u. */
function polyPart(pts: Pt[], u: number): Pt[] {
  if (u >= 1) return pts;
  const L = polyLen(pts) * clamp(u, 0, 1);
  const out: Pt[] = [pts[0]];
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d + s >= L) {
      const t = s ? (L - d) / s : 0;
      out.push([lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]);
      return out;
    }
    out.push(pts[i]);
    d += s;
  }
  return out;
}

interface Imp {
  t0: number;
  rel: boolean;
}
interface Particle {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  phase: 'go' | 'bound' | 'gone';
  pAge: number;
  rel: number;
  j: number;
}
interface Trial {
  t0: number;
  stim: Stimulus;
  s: number;
  out: 'respond' | 'below' | 'none';
}
interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
  act?: () => void;
}

export function initNervous(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const st = { ...DEF };
  let simT = 0;

  /* ---------- Neuron state ---------- */
  let V = -70;
  let apAge = -1;
  let imps: Imp[] = [];
  let trace: { t: number; v: number }[] = [];
  let fired = 0;
  let passed = 0;
  let relCount = 0;
  const counted = new Set<number>();
  let parts: Particle[] = [];
  let fuseT = -9;
  let postT = -9;
  let stimT = -9;
  const recAct = RY.map(() => -9);
  let lastEvent: '' | 'below' | 'fired' | 'refractory' | 'passed' | 'blocked' | 'zero' = '';
  let lastPeak = -70;

  /* ---------- Reflex and animal state ---------- */
  let rAnim = 0;
  let rTimer = 0;
  let trial: Trial | null = null;

  const travel = () => (st.myelin ? 0.8 : 2.4);
  function apV(a: number) {
    if (a < 0.07) return -55 + 85 * (a / 0.07);
    if (a < 0.18) return 30 - 110 * ((a - 0.07) / 0.11);
    return -80 + 10 * (1 - Math.exp(-(a - 0.18) / 0.12));
  }
  function fire() {
    apAge = 0;
    V = -55;
    imps.push({ t0: simT, rel: false });
    fired++;
    lastEvent = 'fired';
  }
  function stimulate() {
    if (!sim.running) sim.play();
    stimT = simT;
    if (st.strength === 0) {
      lastEvent = 'zero';
      return;
    }
    if (apAge >= 0) {
      lastEvent = 'refractory';
      return;
    }
    const A = st.strength * 0.3;
    V = Math.max(V, -70 + A);
    if (-70 + A >= -55) fire();
    else {
      lastEvent = 'below';
      lastPeak = -70 + A;
    }
    updateUi();
  }
  function release() {
    relCount++;
    fuseT = simT;
    for (let i = 0; i < 16; i++) {
      const j = Math.floor(Math.random() * RY.length);
      const sy = 130 + (Math.random() - 0.5) * 90;
      parts.push({ sx: 194, sy, tx: 240, ty: RY[j] + (Math.random() - 0.5) * 6, x: 194, y: sy, vx: 0, vy: 0, age: -Math.random() * 0.15, phase: 'go', pAge: 0, rel: relCount, j });
    }
  }
  function stepNeuron(dt: number) {
    const A = st.strength * 0.3;
    if (apAge >= 0) {
      apAge += dt;
      V = apV(apAge);
      if (apAge >= AP_LEN) {
        apAge = -1;
        V = -70;
      }
    } else {
      const target = -70 + (st.hold && st.strength > 0 ? A + 0.8 : 0);
      V += (target - V) * (1 - Math.exp(-dt * (st.hold ? 4 : 2.5)));
      if (V >= -55) fire();
    }
    if (st.hold) stimT = simT;
    trace.push({ t: simT, v: V });
    while (trace.length && trace[0].t < simT - TW - 0.1) trace.shift();
    const T = travel();
    for (const im of imps)
      if (!im.rel && simT - im.t0 >= T + TERM_T) {
        im.rel = true;
        release();
      }
    imps = imps.filter((im) => simT - im.t0 < T + TERM_T + 0.3);
    for (const p of parts) {
      p.age += dt;
      if (p.age < 0) continue;
      if (p.phase === 'go') {
        const u = Math.min(1, p.age / 0.55);
        p.x = lerp(p.sx, p.tx, u) + Math.sin(p.age * 30 + p.j) * 2;
        p.y = lerp(p.sy, p.ty, u) + Math.cos(p.age * 26 + p.sy) * 3;
        if (u >= 1) {
          p.pAge = 0;
          if (!st.block) {
            p.phase = 'bound';
            recAct[p.j] = simT;
            if (!counted.has(p.rel)) {
              counted.add(p.rel);
              passed++;
              postT = simT;
              lastEvent = 'passed';
            }
          } else {
            p.phase = 'gone';
            p.vx = -50 - Math.random() * 60;
            p.vy = (Math.random() - 0.5) * 90;
            lastEvent = 'blocked';
          }
        }
      } else if (p.phase === 'bound') {
        p.pAge += dt;
        if (p.pAge > 0.6) {
          p.phase = 'gone';
          p.pAge = 0;
          p.vx = -30 - Math.random() * 30;
          p.vy = (Math.random() - 0.5) * 60;
        }
      } else {
        p.pAge += dt;
        p.x = clamp(p.x + p.vx * dt, 202, 238);
        p.y += p.vy * dt;
      }
    }
    parts = parts.filter((p) => !(p.phase === 'gone' && p.pAge > 0.9));
  }

  /* ---------- Time ---------- */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    simT += dt;
    stepNeuron(dt);
    if (st.view === 'reflex') {
      rAnim += dt;
      rTimer += dt;
      if (rTimer > 2.4) {
        rTimer = 0;
        if (st.rstep < 7) goStep(st.rstep + 1);
        else sim.pause();
      }
    }
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1150] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let K = 1;
  let cur = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs: Fs = (px, wt = 650) => font(px / cur, wt);
  function enter(x: number, y: number, s: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    frame = { x, y, s };
    cur = K * s;
  }
  function leave() {
    ctx.restore();
    frame = { x: 0, y: 0, s: 1 };
    cur = K;
  }
  let areas: Area[] = [];
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string, act?: () => void) {
    const f = { ...frame };
    areas.push({ test: (px, py) => {
      const lx = (px - f.x) / f.s;
      const ly = (py - f.y) / f.s;
      return lx >= x && lx <= x + w && ly >= y && ly <= y + h;
    }, title, text, act });
  }
  function circ(x: number, y: number, r: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({ test: (px, py) => Math.hypot((px - f.x) / f.s - x, (py - f.y) / f.s - y) <= r, title, text });
  }

  /* ---------- Drawing helpers ---------- */
  function poly(pts: Pt[], color: string, w: number) {
    if (pts.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  function glow(x: number, y: number, r: number, color: string, a: number) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha(color, 0.95 * a));
    g.addColorStop(0.45, withAlpha(color, 0.55 * a));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function text(t: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(t: string, x: number, y: number, maxW: number, lh: number) {
    const words = t.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = w;
        y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lh;
  }
  function panel(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  /* ======================= Neuron view ======================= */
  function drawNeuron(P = false) {
    const N = pal.accent;
    const W = pal.warning;
    const graded = apAge < 0 ? clamp((V + 70) / 15, 0, 1) : 0;
    // dendrites
    for (const d of DEND) poly(d, withAlpha(N, 0.6), 7);
    if (graded > 0.02) for (const d of DEND) poly(d, withAlpha(W, 0.45 * graded), 11);
    // stimulus probe on a dendrite tip
    const sf = clamp(1 - (simT - stimT) / 0.5, 0, 1);
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, 76);
    ctx.lineTo(STIM_PT[0] - 3, STIM_PT[1] - 3);
    ctx.stroke();
    glow(STIM_PT[0], STIM_PT[1], 26, W, sf * (0.3 + 0.7 * (st.strength / 100)));
    text('Stimulus', 2, P ? 58 : 66, 11.5, pal['text-muted'], 'left');
    // cell body
    ctx.fillStyle = withAlpha(N, 0.28);
    ctx.strokeStyle = N;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(SOMA.x, SOMA.y, SOMA.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (graded > 0.02) glow(SOMA.x, SOMA.y, SOMA.r + 8, W, 0.5 * graded);
    ctx.fillStyle = withAlpha(N, 0.65);
    ctx.beginPath();
    ctx.arc(SOMA.x - 4, SOMA.y - 2, 15, 0, Math.PI * 2);
    ctx.fill();
    // axon hillock (tapers from the cell body into the axon)
    ctx.fillStyle = withAlpha(N, 0.45);
    ctx.beginPath();
    ctx.moveTo(228, 110);
    ctx.quadraticCurveTo(246, 124, AX0, 125);
    ctx.lineTo(AX0, 135);
    ctx.quadraticCurveTo(246, 136, 228, 150);
    ctx.closePath();
    ctx.fill();
    // axon
    poly([[AX0, AY], [AX1, AY]], withAlpha(N, 0.6), 10);
    if (st.myelin)
      for (let i = 0; i < NODES - 1; i++) {
        const x0 = nodeX(i) + 7;
        const x1 = nodeX(i + 1) - 7;
        ctx.fillStyle = '#f1e7c9';
        ctx.strokeStyle = pal['border-strong'];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x0, AY - 15, x1 - x0, 30, 13);
        ctx.fill();
        ctx.stroke();
      }
    // terminals
    for (const b of TERM) poly(b, withAlpha(N, 0.6), 6);
    for (const b of TERM) {
      const [x, y] = b[b.length - 1];
      ctx.fillStyle = withAlpha(N, 0.4);
      ctx.strokeStyle = N;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // recording electrode at the axon hillock
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(258, 52);
    ctx.lineTo(248, 114);
    ctx.stroke();
    text(P ? 'Recording' : 'Recording electrode', P ? 300 : 262, 44, 11.5, pal['text-muted'], 'center');
    // impulses
    const T = travel();
    for (const im of imps) {
      const a = simT - im.t0;
      if (a < T) {
        const u = a / T;
        if (st.myelin) {
          const f = u * (NODES - 1);
          const n = Math.min(NODES - 1, Math.floor(f + 1e-6));
          const fr = f - n;
          const x = nodeX(n);
          glow(x, AY, 26, W, 1 - fr * 0.6);
          if (n < NODES - 1) {
            ctx.setLineDash([5, 6]);
            ctx.strokeStyle = withAlpha(W, 0.75 * (1 - fr));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, AY - 20);
            ctx.quadraticCurveTo((x + nodeX(n + 1)) / 2, AY - 48, nodeX(n + 1), AY - 20);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          if (st.ions) ions(x, x + 10);
        } else {
          const x = AX0 + u * (AX1 - AX0);
          const g = ctx.createLinearGradient(x - 90, 0, x, 0);
          g.addColorStop(0, withAlpha(pal['accent-2'], 0));
          g.addColorStop(1, withAlpha(pal['accent-2'], 0.55));
          ctx.fillStyle = g;
          ctx.fillRect(Math.max(AX0, x - 90), AY - 8, Math.min(90, x - AX0), 16);
          glow(x, AY, 24, W, 1);
          if (st.ions) ions(x, x - 30);
        }
      } else {
        const u = clamp((a - T) / TERM_T, 0, 1);
        for (const b of TERM) {
          const [x, y] = polyAt(b, u);
          glow(x, y, 18, W, 1 - u * 0.3);
        }
      }
    }
    // labels
    const L = pal['text-muted'];
    if (P) {
      text('Dendrites', 30, 250, 12, L, 'left');
      text('Cell body', SOMA.x + 40, 210, 12, L, 'left');
      text(st.myelin ? 'Axon with myelin' : 'Axon (no myelin)', (AX0 + AX1) / 2 + 40, AY + 54, 12, L);
      text('Terminals', 955, 250, 12, L, 'right');
    } else {
      text('Dendrites', 34, 186, 12.5, L);
      text('Cell body', SOMA.x, SOMA.y + SOMA.r + 22, 12.5, L);
      text('Axon hillock', 246, 172, 11, L);
      text(st.myelin ? 'Axon with myelin sheath' : 'Axon (no myelin)', (AX0 + AX1) / 2, AY + 44, 12.5, L);
      if (st.myelin) text('Node', nodeX(3), AY - 24, 10.5, pal['text-faint']);
      text('Axon terminals', 870, 232, 12.5, L);
      arrow(ctx, 560, 66, 650, 66, withAlpha(W, 0.9), 2.5, 10);
      text('Impulse travels one way', 605, 56, 11, L);
    }
    ctx.font = fs(10.5, 500);
    ctx.fillStyle = pal['text-faint'];
    const disc = 'Simplified: the glow marks where the membrane voltage is changing. Nothing moves along inside the axon. Slowed about 1,000×.';
    if (P) wrap(disc, 0, 300, 950, 13.5 / cur);
    else {
      ctx.textAlign = 'center';
      ctx.fillText(disc, 480, 274);
      ctx.textAlign = 'left';
    }

    // click areas
    rect(0, 0, 140, 250, 'Dendrites', () => 'Short, branched extensions that receive signals from receptors or other neurons. A signal here causes a small, graded change in voltage that fades as it spreads towards the cell body. Many small signals can add together.');
    rect(-6, 60, 50, 60, 'Stimulus electrode', () => 'Stimulates the tip of a dendrite. In a living animal, the signal would come from a sensory receptor or from another neuron across a synapse.');
    circ(SOMA.x, SOMA.y, SOMA.r + 4, 'Cell body', () => 'Contains the nucleus and most of the cell’s organelles. It adds together the signals arriving from all the dendrites.');
    rect(226, 108, 40, 44, 'Axon hillock', () => 'Where the axon leaves the cell body. If the combined signals raise the voltage here to the threshold (about −55 mV), an action potential starts. If not, nothing is sent: the response is all-or-none.');
    rect(240, 36, 40, 74, 'Recording electrode', () => 'Measures the voltage across the membrane at the axon hillock. The graph shows what it records.');
    rect(AX0, AY - 18, AX1 - AX0, 36, st.myelin ? 'Myelin sheath and nodes' : 'Axon', () =>
      st.myelin
        ? 'Myelin is a fatty insulating layer made by supporting cells wrapped around the axon. Impulses can only be regenerated at the gaps (nodes of Ranvier), so they jump from node to node (saltatory conduction). This is much faster: up to about 100 m/s.'
        : 'A long fibre that carries impulses away from the cell body. Without myelin, the impulse is regenerated at every point along the membrane, which is slower: about 0.5–2 m/s in thin axons. Squid and earthworms use very wide “giant” axons for speed instead.');
    rect(784, 50, 120, 160, 'Axon terminals', () => 'The branched ends of the axon. Each ends in a swelling at a synapse, where the electrical signal is turned into a chemical one. The close-up shows one synapse.');
  }
  function ions(xNa: number, xK: number) {
    const na = pal.success;
    const k = pal.danger;
    arrow(ctx, xNa, AY - 58, xNa, AY - 14, na, 2.5, 8);
    text('Na⁺ in', xNa, AY - 64, 11, na);
    arrow(ctx, xK, AY + 14, xK, AY + 56, k, 2.5, 8);
    text('K⁺ out', xK, AY + 70, 11, k);
  }

  function drawTrace(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Voltage at the axon hillock', x + 14, y + 22, 13, pal['sim-text'], 'left', 700);
    const px = x + 52;
    const py = y + 36;
    const pw = w - 66;
    const ph = h - 72;
    const vy = (v: number) => py + ((40 - v) / 130) * ph;
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'right';
    for (const v of [40, 0, -40, -80]) {
      ctx.fillText(`${v}`, px - 6, vy(v) + 4);
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.25);
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      ctx.moveTo(px, vy(v));
      ctx.lineTo(px + pw, vy(v));
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.save();
    ctx.translate(x + 14, py + ph / 2);
    ctx.rotate(-Math.PI / 2);
    text('mV', 0, 0, 10.5, pal['text-faint']);
    ctx.restore();
    const ref = (v: number, c: string, label: string) => {
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      ctx.moveTo(px, vy(v));
      ctx.lineTo(px + pw, vy(v));
      ctx.stroke();
      ctx.setLineDash([]);
      text(label, px + pw - 4, vy(v) - 5, 10.5, c, 'right');
    };
    ref(-70, pal['text-muted'], 'Resting −70 mV');
    ref(-55, pal.danger, 'Threshold −55 mV');
    // trace
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py - 6, pw, ph + 12);
    ctx.clip();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.4 / cur;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let first = true;
    for (const s of trace) {
      const tx = px + ((s.t - (simT - TW)) / TW) * pw;
      if (first) ctx.moveTo(tx, vy(s.v));
      else ctx.lineTo(tx, vy(s.v));
      first = false;
    }
    ctx.stroke();
    ctx.restore();
    text(`Now: ${mv(V)}`, px + 6, py + 12, 11, pal.accent, 'left', 700);
    text('Time (slowed: a real action potential lasts about 2 ms)', px + pw / 2, y + h - 12, 10.5, pal['text-faint']);
    rect(x, y, w, h, 'Membrane voltage', () => 'At rest the inside of a neuron is about 70 mV more negative than the outside. A weak stimulus makes a small bump that fades (a graded potential). If the voltage reaches the threshold, an action potential fires: it rises to about +30 mV, falls below the resting level, and recovers. Every action potential has the same size, so a stronger stimulus makes them more frequent, not bigger.');
  }

  function drawSynapse() {
    const N = pal.accent;
    const W = pal.warning;
    text('Synapse close-up', 0, -4, 13, pal['sim-text'], 'left', 700);
    // sending terminal
    ctx.fillStyle = withAlpha(N, 0.2);
    ctx.strokeStyle = N;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(8, 20, 190, 220, [16, 40, 40, 16]);
    ctx.fill();
    ctx.stroke();
    // receiving dendrite
    const pg = clamp(1 - (simT - postT) / 1.2, 0, 1);
    ctx.fillStyle = withAlpha(pal['accent-2'], 0.18);
    ctx.strokeStyle = pal['accent-2'];
    ctx.beginPath();
    ctx.roundRect(242, 20, 210, 220, [40, 16, 16, 40]);
    ctx.fill();
    ctx.stroke();
    if (pg > 0) {
      const gx = 250 + (1 - pg) * 200;
      const g = ctx.createLinearGradient(gx - 70, 0, gx + 10, 0);
      g.addColorStop(0, withAlpha(W, 0));
      g.addColorStop(0.8, withAlpha(W, 0.5 * pg));
      g.addColorStop(1, withAlpha(W, 0));
      ctx.fillStyle = g;
      ctx.fillRect(Math.max(246, gx - 70), 60, 80, 140);
    }
    // vesicles
    const fuse = clamp(1 - (simT - fuseT) / 0.5, 0, 1);
    const VES: Pt[] = [[70, 60], [110, 92], [60, 130], [120, 170], [74, 196], [150, 128], [170, 70], [168, 188]];
    VES.forEach(([vx, vy], i) => {
      const near = i === 5 || i === 2;
      const x = near && fuse > 0 ? lerp(vx, 186, fuse) : vx;
      ctx.fillStyle = withAlpha(N, 0.15);
      ctx.strokeStyle = withAlpha(N, 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, vy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = W;
      for (let d = 0; d < 5; d++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(d * 1.3) * 6, vy + Math.sin(d * 1.3) * 6, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // receptors
    RY.forEach((y, j) => {
      const on = !st.block && simT - recAct[j] < 0.7;
      ctx.fillStyle = on ? pal.success : withAlpha(pal['accent-2'], 0.7);
      ctx.beginPath();
      ctx.moveTo(244, y - 9);
      ctx.lineTo(236, y - 9);
      ctx.lineTo(236, y - 4);
      ctx.lineTo(240, y - 4);
      ctx.lineTo(240, y + 4);
      ctx.lineTo(236, y + 4);
      ctx.lineTo(236, y + 9);
      ctx.lineTo(244, y + 9);
      ctx.closePath();
      ctx.fill();
      if (st.block) {
        ctx.fillStyle = pal.danger;
        ctx.fillRect(232, y - 4, 7, 8);
      }
    });
    // neurotransmitter
    for (const p of parts) {
      if (p.age < 0) continue;
      const a = p.phase === 'gone' ? 1 - p.pAge / 0.9 : 1;
      ctx.fillStyle = withAlpha(W, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const L = pal['text-muted'];
    text('Axon terminal', 100, 228, 11.5, L);
    text('Next neuron', 350, 228, 11.5, L);
    text('Gap', 220, 254, 11, L);
    text(st.block ? 'Receptors blocked' : 'Receptors', 300, 40, 11, st.block ? pal.danger : L);
    text('Vesicles', 100, 38, 11, L);
    if (pg > 0) text('Signal continues', 360, 132, 12, W, 'center', 700);
    if (st.block && lastEvent === 'blocked' && simT - fuseT < 2) text('No signal passed on', 350, 132, 12, pal.danger, 'center', 700);

    rect(8, 20, 190, 220, 'Axon terminal', () => 'When an impulse arrives, vesicles (small membrane bubbles) fuse with the membrane and release neurotransmitter molecules into the gap.');
    rect(198, 20, 44, 240, 'Synaptic cleft', () => 'A gap of about 20 nanometres between the two neurons. The neurotransmitter crosses it by diffusion in a fraction of a millisecond. This is why signals pass across a synapse in one direction only: only the sending side releases neurotransmitter.');
    rect(226, 54, 26, 150, 'Receptors', () => (st.block ? 'The receptors are blocked, like the effect of some drugs and toxins (for example curare, a poison once used on arrow tips, blocks receptors on muscles). The neurotransmitter cannot bind, so no signal passes on.' : 'Protein receptors on the next neuron. When neurotransmitter binds, ion channels open and the next neuron’s voltage changes. The neurotransmitter is then broken down or taken back up, so each signal is brief.'));
    rect(252, 20, 200, 220, 'Next neuron', () => 'The dendrite of the next neuron. One synapse alone usually cannot make it fire: it adds its signal to those from many other synapses, some exciting and some inhibiting.');
  }

  /* ======================= Reflex view ======================= */
  function drawReflex(rx: number, ry: number, s0: number, P = false) {
    enter(rx, ry, s0);
    const knee = st.reflex === 'knee';
    const s = st.rstep;
    const p = sim.running ? clamp(rAnim / 1.1, 0, 1) : 1;
    const resp = s >= 6 ? (s === 6 ? (sim.running ? ease(rAnim / 0.6) : 1) : 1) : 0;
    const C = { sens: pal['accent-2'], relay: pal.success, motor: pal.danger, up: pal.accent };
    // torso outline
    ctx.strokeStyle = withAlpha(pal['text-muted'], 0.35);
    ctx.fillStyle = withAlpha(pal['text-muted'], 0.05);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(440, 122, 330, 290, 40);
    ctx.fill();
    ctx.stroke();
    // brain
    const bAct = s === 7 ? 0.4 + 0.6 * p : 0;
    ctx.fillStyle = withAlpha(pal.accent, 0.15 + 0.25 * bAct);
    ctx.strokeStyle = pal.accent;
    ctx.beginPath();
    ctx.ellipse(640, 62, 96, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(pal.accent, 0.4);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(590 + i * 34, 64 + (i % 2) * 8, 18, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    text('Brain', 640, 70, 13, pal['sim-text'], 'center', 700);
    if (s === 7 && p > 0.85) text(knee ? '“I felt that!”' : '“Ouch!”', 760, 30, 14, pal.accent, 'left', 700);
    // spinal cord cross-section
    ctx.fillStyle = withAlpha(pal['text-muted'], 0.12);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(640, 265, 92, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha(pal['text-muted'], 0.28);
    ctx.beginPath();
    ctx.moveTo(640, 250);
    ctx.bezierCurveTo(615, 220, 600, 215, 606, 236);
    ctx.bezierCurveTo(612, 252, 628, 258, 630, 266);
    ctx.bezierCurveTo(615, 285, 640 - 30, 312, 625, 305);
    ctx.bezierCurveTo(640, 290, 640, 282, 640, 280);
    ctx.bezierCurveTo(640, 282, 640, 290, 655, 305);
    ctx.bezierCurveTo(670, 312, 665, 285, 650, 266);
    ctx.bezierCurveTo(652, 258, 668, 252, 674, 236);
    ctx.bezierCurveTo(680, 215, 665, 220, 640, 250);
    ctx.fill();
    ctx.fillStyle = pal['sim-bg'];
    ctx.beginPath();
    ctx.arc(640, 266, 3.5, 0, Math.PI * 2);
    ctx.fill();
    text('Spinal cord (cross-section)', 640, 356, 12, pal['text-muted']);
    // dorsal root ganglion
    ctx.fillStyle = withAlpha(C.sens, 0.25);
    ctx.beginPath();
    ctx.ellipse(560, 212, 16, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // limb, with the response
    let rec: Pt;
    let muscle: Pt;
    let sensPath: Pt[];
    let motorPath: Pt[];
    if (!knee) {
      const sh: Pt = [446, 162];
      const el: Pt = [330, 300];
      const ang = (170 + 75 * resp) * (Math.PI / 180);
      const hand: Pt = [el[0] + Math.cos(ang) * 172, el[1] + Math.sin(ang) * 172];
      const mid: Pt = [el[0] + Math.cos(ang) * 90, el[1] + Math.sin(ang) * 90];
      // hot plate
      ctx.fillStyle = withAlpha(pal.danger, 0.75);
      ctx.fillRect(70, 352, 170, 18);
      ctx.strokeStyle = withAlpha(pal.danger, 0.6);
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const x = 92 + i * 42;
        const wob = Math.sin(simT * 4 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(x, 346);
        ctx.bezierCurveTo(x + 8 + wob, 336, x - 8 - wob, 326, x, 312);
        ctx.stroke();
      }
      text('Hot object', 155, 394, 12, pal.danger, 'center', 700);
      // arm
      const skin = withAlpha('#d9a77c', 0.9);
      poly([sh, el], skin, 36);
      poly([el, hand], skin, 28);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(hand[0], hand[1], 18, 0, Math.PI * 2);
      ctx.fill();
      // biceps on the front of the upper arm
      muscle = [388 - 0.773 * 15, 231 - 0.635 * 15];
      const mAct = s === 5 || s === 6 ? 1 : 0;
      ctx.save();
      ctx.translate(muscle[0], muscle[1]);
      ctx.rotate(Math.atan2(140, -115));
      ctx.fillStyle = withAlpha(pal.danger, 0.45 + 0.35 * mAct);
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 12 * (1 + 0.45 * resp), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (mAct) glow(muscle[0], muscle[1], 50, pal.danger, 0.35);
      text(P ? 'Biceps' : 'Biceps (effector)', 352, 168, 12, pal.danger, 'right', 700);
      rec = [hand[0], hand[1]];
      sensPath = [rec, mid, el, [388, 231], [446, 166], [500, 192], [560, 212], [606, 236], [626, 252]];
      motorPath = [[656, 286], [606, 300], [540, 300], [470, 266], [415, 238], muscle];
    } else {
      const hip: Pt = [440, 165];
      const kn: Pt = [300, 250];
      const ang = (92 + 58 * resp) * (Math.PI / 180);
      const ank: Pt = [kn[0] + Math.cos(ang) * 150, kn[1] + Math.sin(ang) * 150];
      const foot: Pt = [ank[0] + Math.cos(ang + Math.PI / 2) * 40, ank[1] + Math.sin(ang + Math.PI / 2) * 40];
      const skin = withAlpha('#d9a77c', 0.9);
      poly([hip, kn], skin, 42);
      poly([kn, ank], skin, 30);
      poly([ank, foot], skin, 18);
      ctx.fillStyle = withAlpha('#d9a77c', 1);
      ctx.beginPath();
      ctx.arc(kn[0] - 10, kn[1] - 6, 14, 0, Math.PI * 2);
      ctx.fill();
      // hammer
      const sw = s === 0 ? Math.sin(clamp(p, 0, 1) * Math.PI) * 0.5 : 0;
      ctx.save();
      ctx.translate(180, 300);
      ctx.rotate(-0.5 + sw);
      ctx.strokeStyle = pal['text-muted'];
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(90, -20);
      ctx.stroke();
      ctx.fillStyle = pal['text-muted'];
      ctx.beginPath();
      ctx.roundRect(84, -38, 16, 34, 4);
      ctx.fill();
      ctx.restore();
      text(P ? 'Knee tap' : 'Tap below the kneecap', 170, 342, 12, pal.danger, 'center', 700);
      muscle = [370 - 0.54 * 18, 207 - 0.84 * 18];
      const mAct = s === 5 || s === 6 ? 1 : 0;
      ctx.save();
      ctx.translate(muscle[0], muscle[1]);
      ctx.rotate(Math.atan2(-85, 140));
      ctx.fillStyle = withAlpha(pal.danger, 0.45 + 0.35 * mAct);
      ctx.beginPath();
      ctx.ellipse(0, 0, 52, 12 * (1 + 0.35 * resp), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (mAct) glow(muscle[0], muscle[1], 54, pal.danger, 0.35);
      text(P ? 'Quadriceps' : 'Quadriceps (effector)', P ? 300 : 330, P ? 120 : 150, 12, pal.danger, 'center', 700);
      rec = [muscle[0] + 18, muscle[1] - 4];
      sensPath = [rec, [440, 176], [500, 195], [560, 212], [606, 236], [640, 262], [656, 284]];
      motorPath = [[656, 286], [606, 300], [540, 300], [470, 246], muscle];
    }
    const relayPath: Pt[] = knee ? [] : [[626, 252], [640, 268], [656, 286]];
    const upPath: Pt[] = [[628, 246], [628, 196], [636, 108]];
    const segs: { pts: Pt[]; c: string; step: number }[] = [
      { pts: sensPath, c: C.sens, step: 2 },
      { pts: relayPath, c: C.relay, step: 3 },
      { pts: motorPath, c: C.motor, step: 4 },
      { pts: upPath, c: C.up, step: 7 },
    ];
    for (const g of segs) {
      if (!g.pts.length) continue;
      poly(g.pts, withAlpha(g.c, 0.22), 4);
      if (s > g.step) poly(g.pts, withAlpha(g.c, 0.9), 4);
      else if (s === g.step) {
        poly(polyPart(g.pts, p), withAlpha(g.c, 0.95), 4.5);
        const [x, y] = polyAt(g.pts, p);
        glow(x, y, 18, pal.warning, 1);
      }
    }
    // neuron cell bodies
    const body = (x: number, y: number, c: string) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, Math.PI * 2);
      ctx.fill();
    };
    body(560, 212, C.sens);
    if (!knee) body(640, 268, C.relay);
    body(662, 290, C.motor);
    if (knee && s >= 3) {
      ctx.strokeStyle = C.relay;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(656, 285, 11 + (s === 3 ? 4 * Math.sin(simT * 6) : 0), 0, Math.PI * 2);
      ctx.stroke();
    }
    // receptor and stimulus
    if (s >= 1) {
      ctx.strokeStyle = pal.warning;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rec[0], rec[1], 12 + (s === 1 ? 5 * Math.sin(simT * 7) : 0), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (s === 0) glow(rec[0], rec[1], 42, pal.danger, 0.5 + 0.3 * Math.sin(simT * 6));
    // labels
    const hl = (i: number) => (s === i ? 700 : 600);
    if (!P) text(knee ? 'Stretch receptor' : 'Receptor (skin)', rec[0], rec[1] - 26, 11.5, s === 1 ? pal.warning : pal['text-muted'], 'center', hl(1));
    if (!P) text('Sensory neuron', 505, 178, 11.5, s === 2 ? C.sens : pal['text-muted'], 'center', hl(2));
    if (P) {
      // on phones the step list names each neuron instead
    } else if (!knee) {
      text('Relay neuron', 744, 262, 11.5, s === 3 ? C.relay : pal['text-muted'], 'left', hl(3));
      poly([[740, 258], [650, 268]], withAlpha(C.relay, 0.5), 1.2);
    } else {
      text('One synapse', 744, 290, 11.5, s === 3 ? C.relay : pal['text-muted'], 'left', hl(3));
      poly([[740, 286], [668, 286]], withAlpha(C.relay, 0.5), 1.2);
    }
    if (!P) {
      text('Motor neuron', 505, 330, 11.5, s === 4 ? C.motor : pal['text-muted'], 'center', hl(4));
      text('To the brain', 620, 136, 11, s === 7 ? C.up : pal['text-faint'], 'right', hl(7));
    }

    // click areas
    rect(548, 16, 184, 94, 'Brain', () => 'The brain receives a copy of the signal through neurons that run up the spinal cord. You become aware of the pain or tap only after the reflex has started: the brain is not needed to make the reflex happen, though it can learn to override some reflexes.');
    rect(548, 195, 184, 140, 'Spinal cord', () => 'Part of the central nervous system, with the brain. Its grey matter (the butterfly shape) contains neuron cell bodies and synapses; the white matter around it contains bundles of axons running up to and down from the brain.');
    circ(560, 212, 18, 'Sensory neuron cell body', () => 'The cell bodies of sensory neurons sit in a swelling just outside the spinal cord, the dorsal root ganglion.');
    rect(rec[0] - 26, rec[1] - 26, 52, 52, 'Receptor', () => (knee ? 'Stretch receptors (muscle spindles) inside the muscle detect how fast and how far it is stretched.' : 'Sensory receptors in the skin detect heat, pain, pressure or touch and start nerve impulses in sensory neurons.'));
    circ(muscle[0], muscle[1], 46, 'Effector', () => 'An effector is the muscle or gland that carries out the response. Here the motor neuron makes the muscle contract.');
    leave();
  }

  function drawTimeline(x: number, y: number, w: number, h: number, list: boolean) {
    const RF = REFLEX[st.reflex];
    const times = TIMES[st.reflex];
    const s = st.rstep;
    panel(x, y, w, h);
    if (list) {
      text(RF.title, x + 16, y + 26, 13, pal['sim-text'], 'left', 700);
      const rowH = Math.min(62, (h - 170) / RF.steps.length);
      RF.steps.forEach((stp, i) => {
        const yy = y + 48 + i * rowH;
        if (i === s) {
          ctx.fillStyle = withAlpha(pal.accent, 0.12);
          ctx.beginPath();
          ctx.roundRect(x + 8, yy, w - 16, rowH - 6, 8);
          ctx.fill();
        }
        const pc = ({ 2: pal['accent-2'], 3: pal.success, 4: pal.danger, 7: pal.accent } as Record<number, string>)[i] ?? pal.warning;
        ctx.fillStyle = i <= s ? pc : withAlpha(pal['text-faint'], 0.4);
        ctx.beginPath();
        ctx.arc(x + 30, yy + (rowH - 6) / 2, 11, 0, Math.PI * 2);
        ctx.fill();
        text(String(i + 1), x + 30, yy + (rowH - 6) / 2 + 4.5, 11.5, pal['sim-bg'], 'center', 700);
        text(stp.name, x + 52, yy + (rowH - 6) / 2 + 5, 13, i === s ? pal['sim-text'] : pal['text-muted'], 'left', i === s ? 700 : 600);
        text(`≈ ${times[i]} ms`, x + w - 20, yy + (rowH - 6) / 2 + 5, 12, pal['text-faint'], 'right');
        rect(x + 8, yy, w - 16, rowH - 6, stp.name, () => stp.text, () => goStep(i));
      });
    } else {
      text('Timeline (milliseconds after the stimulus)', x + 16, y + 24, 12.5, pal['sim-text'], 'left', 700);
    }
    const bx0 = x + 30;
    const bx1 = x + w - 30;
    const by = list ? y + h - 70 : y + 70;
    const tx = (ms: number) => bx0 + (clamp(ms, 0, 300) / 300) * (bx1 - bx0);
    if (list) text('Timeline (ms after the stimulus)', x + 16, by - 40, 12, pal['sim-text'], 'left', 700);
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.18);
    ctx.fillRect(bx0, by - 7, bx1 - bx0, 14);
    ctx.fillStyle = withAlpha(pal.success, 0.75);
    ctx.fillRect(bx0, by - 7, tx(RF.reflexMs) - bx0, 14);
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    for (let ms = 0; ms <= 300; ms += 50) ctx.fillText(String(ms), tx(ms), by + 24);
    ctx.textAlign = 'left';
    text(`Reflex ≈ ${RF.reflexMs} ms`, tx(RF.reflexMs) + 4, by - 13, 11.5, pal.success, 'left', 700);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(tx(RF.awareMs) - 2, by - 12, 4, 24);
    text(list ? 'Aware ≈ 250 ms' : 'Brain aware ≈ 250 ms', tx(RF.awareMs), by - 17, 11.5, pal.accent, 'center', 700);
    // current step marker
    const cx = tx(times[s]);
    ctx.fillStyle = pal.warning;
    ctx.beginPath();
    ctx.moveTo(cx, by + 9);
    ctx.lineTo(cx - 7, by + 4 - 14);
    ctx.lineTo(cx + 7, by + 4 - 14);
    ctx.closePath();
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (!list) text(`Step ${s + 1}: ${RF.steps[s].name}`, x + w - 16, y + 24, 12, pal.warning, 'right', 700);
    rect(x, by - 30, w, 60, 'Reflex timing', () => `A reflex is fast because the signal takes the shortest route, through the spinal cord, with only ${st.reflex === 'knee' ? 'one synapse' : 'two synapses'}. Choosing to move in response to something you see takes about 200–250 ms, because the signal must be processed by the brain.`);
  }

  /* ======================= Animals view ======================= */
  const trialA = () => (trial ? simT - trial.t0 : -1);
  const respOf = () => (trial && trial.out === 'respond' ? ease((trialA() - EFF_T) / 1.4) : 0);

  function drawAnimal(id: AnimalId, r: number, stim: Stimulus | null) {
    const [ox, oy] = ORIGIN[id];
    const NS = pal.accent;
    const tr = trial;
    const a = trialA();
    ctx.save();
    ctx.translate(ox, oy);
    if (id === 'hydra') {
      const touch = stim === 'touch' ? r : 0;
      const bend = stim === 'light' ? r : 0;
      ctx.rotate(bend * 0.4);
      ctx.scale(1 + touch * 0.3, 1 - touch * 0.5);
      ctx.fillStyle = withAlpha('#5c9e5c', 0.8);
      ctx.strokeStyle = '#3d7a3d';
      ctx.lineWidth = 2;
      const L = 90 * (1 - touch * 0.7);
      for (let i = 0; i < 6; i++) {
        const sway = Math.sin(simT * 1.4 + i) * 0.14 * (1 - touch);
        const ang = -Math.PI / 2 + (i - 2.5) * 0.42 + sway;
        const sx = (i - 2.5) * 6;
        poly([[sx, -182], [sx + Math.cos(ang - 0.25) * L * 0.5, -182 + Math.sin(ang - 0.25) * L * 0.5], [sx + Math.cos(ang) * L, -182 + Math.sin(ang) * L]], '#5c9e5c', 4.5);
      }
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.bezierCurveTo(-24, -60, -14, -120, -20, -174);
      ctx.quadraticCurveTo(0, -200, 20, -174);
      ctx.bezierCurveTo(14, -120, 24, -60, 15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 21, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (st.showNS) {
        for (const [i, j] of NET.edges) poly([NET.pts[i], NET.pts[j]], withAlpha(NS, 0.65), 1.4);
        ctx.fillStyle = NS;
        for (const p of NET.pts) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (tr && a >= REC_T && tr.out === 'respond') {
        const src = GEO.hydra.rec[tr.stim]![0];
        const rr = ((a - REC_T) / (EFF_T - REC_T)) * 230;
        for (const p of NET.pts) {
          const d = Math.hypot(p[0] - src[0], p[1] - src[1]);
          if (d < rr) glow(p[0], p[1], 10, pal.warning, clamp(1 - (rr - d) / 120, 0.15, 1));
        }
      }
    } else if (id === 'planarian') {
      if (stim === 'light') {
        const rot = Math.min(1, r * 2);
        const g = Math.max(0, r * 2 - 1);
        ctx.translate(-150 * g, 0);
        ctx.rotate(Math.PI * rot);
      } else if (stim === 'touch') {
        ctx.rotate(-0.35 * r);
        ctx.scale(1 - 0.3 * r, 1 + 0.12 * r);
      }
      const top: Pt[] = [[132, 0], [126, -15], [118, -30], [104, -22], [80, -26], [30, -32], [-40, -30], [-100, -20], [-140, -6], [-148, 0]];
      const pts = [...top, ...top.slice(1, -1).reverse().map(([x, y]) => [x, -y] as Pt)];
      ctx.fillStyle = withAlpha('#8d6e63', 0.85);
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i <= pts.length; i++) {
        const p0 = pts[i % pts.length];
        const p1 = pts[(i + 1) % pts.length];
        ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha('#5d4037', 0.35);
      ctx.beginPath();
      ctx.ellipse(-10, 0, 30, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const sy of [-10, 10]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(100, sy, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(98, sy + (sy < 0 ? 1.5 : -1.5), 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (st.showNS) {
        ctx.fillStyle = withAlpha(NS, 0.8);
        for (const sy of [-7, 7]) {
          ctx.beginPath();
          ctx.ellipse(86, sy, 9, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        poly([[80, -8], [-122, -7]], NS, 2.5);
        poly([[80, 8], [-122, 7]], NS, 2.5);
        for (let x = 60; x > -120; x -= 24) poly([[x, -8], [x, 8]], withAlpha(NS, 0.7), 1.5);
      }
    } else if (id === 'earthworm') {
      if (stim === 'light') {
        ctx.translate(-40 * r, 95 * r);
        ctx.rotate(0.35 * r);
      } else if (stim === 'touch') ctx.scale(1 - 0.4 * r, 1 + 0.18 * r);
      else if (stim === 'sound') ctx.translate(-110 * r, 0);
      const wave = stim === 'sound' && r > 0 && r < 1 ? Math.sin(simT * 10) : 0;
      ctx.fillStyle = '#c98282';
      ctx.strokeStyle = '#8e4f4f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-152, -16 - wave, 326, 32 + wave * 2, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b06262';
      ctx.beginPath();
      ctx.roundRect(100, -18, 32, 36, 7);
      ctx.fill();
      ctx.strokeStyle = withAlpha('#8e4f4f', 0.55);
      ctx.lineWidth = 1.2;
      for (let x = -138; x < 166; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, -14);
        ctx.quadraticCurveTo(x + 3, 0, x, 14);
        ctx.stroke();
      }
      if (st.showNS) {
        ctx.fillStyle = NS;
        ctx.beginPath();
        ctx.ellipse(158, -6, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        poly([[158, -6], [150, 8], [-146, 8]], NS, 2.5);
        for (let x = 140; x > -146; x -= 26) {
          ctx.beginPath();
          ctx.arc(x, 8, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (id === 'insect') {
      const rot = Math.min(1, r / 0.3);
      const g = Math.max(0, (r - 0.3) / 0.7);
      ctx.translate(-185 * g, 0);
      ctx.rotate(Math.PI * rot);
      const running = r > 0 && r < 1;
      const body = '#7b4a2a';
      const sw = running ? Math.sin(simT * 22) * 9 : 0;
      const legs: [number, number, number][] = [[72, 92, 1], [60, 56, -1], [48, 14, 1]];
      for (const [bx, tx, ph] of legs)
        for (const sgn of [-1, 1]) {
          const o = sw * ph * sgn;
          poly([[bx, sgn * 12], [(bx + tx) / 2 + o / 2, sgn * 36], [tx + o, sgn * 58]], '#5a3520', 3.2);
        }
      const ant = Math.sin(simT * 2) * 6;
      poly([[116, -8], [160, -40 + ant / 2], [206, -58 + ant]], '#5a3520', 2);
      poly([[116, 8], [160, 40 - ant / 2], [206, 58 - ant]], '#5a3520', 2);
      poly([[-90, -8], [-120, -20]], '#5a3520', 3);
      poly([[-90, 8], [-120, 20]], '#5a3520', 3);
      ctx.fillStyle = withAlpha(body, 0.92);
      ctx.beginPath();
      ctx.ellipse(-30, 0, 64, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(60, 0, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(102, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha('#3b2414', 0.6);
      ctx.lineWidth = 1.2;
      for (let x = -70; x < 30; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, -24);
        ctx.quadraticCurveTo(x + 6, 0, x, 24);
        ctx.stroke();
      }
      ctx.fillStyle = '#222';
      for (const sy of [-13, 13]) {
        ctx.beginPath();
        ctx.ellipse(110, sy, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (st.showNS) {
        ctx.fillStyle = NS;
        ctx.beginPath();
        ctx.ellipse(100, 0, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        poly([[100, 0], [-82, 0]], NS, 2.5);
        for (const x of [72, 60, 48, 20, -10, -40, -66]) {
          ctx.beginPath();
          ctx.arc(x, 0, x > 40 ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // cat
      const crouch = stim === 'motion' ? r : 0;
      const jump = stim === 'sound' && tr && tr.s >= 0.6 ? Math.sin(Math.PI * r) * 26 : 0;
      const flinch = stim === 'touch' ? Math.sin(Math.PI * Math.min(1, r * 1.4)) * 12 + r * 4 : 0;
      const by = 16 * crouch - jump;
      const bx = -flinch;
      const fur = '#c9a27e';
      const dark = '#7a5c3e';
      // legs reach the fixed ground
      for (const lx of [72, 48, -56, -82]) poly([[lx + bx, 20 + by], [lx + bx * 0.5, 100 - jump]], fur, 15);
      for (const lx of [72, 48, -56, -82]) {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(lx + bx * 0.5 + 4, 102 - jump, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(bx, by);
      const tailSw = Math.sin(simT * (crouch > 0 ? 7 : 1.3)) * (crouch > 0 ? 10 : 6);
      ctx.strokeStyle = fur;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-100, -12);
      ctx.bezierCurveTo(-150, -10, -150 + tailSw, -60, -168 + tailSw, -92);
      ctx.stroke();
      ctx.fillStyle = fur;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 108, 42 * (1 - 0.08 * crouch), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // head
      ctx.beginPath();
      ctx.arc(125, -50, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const earTurn = stim === 'sound' ? 0.35 * r : 0;
      const earFlat = stim === 'touch' ? 0.25 * r : 0;
      const ear = (x: number, y: number, s: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s * (earTurn - earFlat));
        ctx.beginPath();
        ctx.moveTo(-11, 4);
        ctx.lineTo(0, -28);
        ctx.lineTo(12, 4);
        ctx.closePath();
        ctx.fillStyle = fur;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      ear(110, -78, 1);
      ear(144, -76, 1);
      ctx.fillStyle = '#c5d86d';
      ctx.beginPath();
      ctx.ellipse(140, -55, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      const pw = stim === 'light' ? 4 - 3 * r : stim === 'motion' ? 4 + 2.5 * r : 4;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(141, -55, Math.max(0.8, pw), 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d97a7a';
      ctx.beginPath();
      ctx.arc(160, -42, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(dark, 0.8);
      ctx.lineWidth = 1.2;
      for (const dy of [-4, 2, 8]) {
        ctx.beginPath();
        ctx.moveTo(158, -38);
        ctx.lineTo(196, -38 + dy * 2);
        ctx.stroke();
      }
      if (st.showNS) {
        ctx.fillStyle = withAlpha(NS, 0.85);
        ctx.beginPath();
        ctx.ellipse(116, -56, 20, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        poly([[100, -40], [60, -32], [0, -32], [-60, -26], [-100, -14]], NS, 3);
        for (const leg of CAT_LEGS) poly(leg.slice(2), withAlpha(NS, 0.7), 1.6);
      }
      ctx.restore();
    }
    // signal (drawn in the animal's own frame; the response only starts after it arrives)
    if (tr && a >= REC_T && id !== 'hydra') {
      const g = GEO[id];
      const path = g.rec[tr.stim];
      if (path) {
        const flash = clamp(1 - (a - REC_T) / 0.7, 0, 1);
        glow(path[0][0], path[0][1], 22, pal.warning, (tr.out === 'below' ? 0.35 : 1) * flash);
        if (tr.out === 'respond') {
          if (a < CEN_T) {
            const u = (a - REC_T) / (CEN_T - REC_T);
            poly(polyPart(path, u), withAlpha(pal.warning, 0.8), 3);
            const [x, y] = polyAt(path, u);
            glow(x, y, 14, pal.warning, 1);
          } else {
            glow(g.center[0], g.center[1], 24, pal.warning, clamp(1 - (a - EFF_T) / 0.8, 0, 1));
            if (a < EFF_T) {
              const u = (a - CEN_T) / (EFF_T - CEN_T);
              for (const e of g.effFor?.[tr.stim] ?? g.eff) {
                poly(polyPart(e, u), withAlpha(pal.warning, 0.7), 2.5);
                const [x, y] = polyAt(e, u);
                glow(x, y, 11, pal.warning, 1);
              }
            }
          }
        }
      }
    }
    ctx.restore();
  }

  function drawSource(stim: Stimulus, recW: Pt) {
    const tr = trial;
    const a = tr ? trialA() : -1;
    const s = tr ? tr.s : st.astrength / 100;
    const on = a >= 0;
    const W = pal.warning;
    const lbl = (t: string, x: number, y: number) => text(t, x, y, 12, pal['text-muted'], 'center', 700);
    if (stim === 'light') {
      const L: Pt = [620, 96];
      if (on) {
        glow(L[0], L[1], 30 + 70 * s, W, 0.5 + 0.4 * s);
        const ext = clamp(a / SRC_T, 0, 1);
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = withAlpha(W, 0.25 + 0.5 * s);
        ctx.lineWidth = 2.5;
        for (const off of [-30, 0, 30]) {
          const tx = recW[0] + off * 0.6;
          const ty = recW[1] + off;
          ctx.beginPath();
          ctx.moveTo(L[0], L[1]);
          ctx.lineTo(lerp(L[0], tx, ext), lerp(L[1], ty, ext));
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.fillStyle = on ? W : withAlpha(pal['text-faint'], 0.5);
      ctx.beginPath();
      ctx.arc(L[0], L[1], 16, 0, Math.PI * 2);
      ctx.fill();
      poly([[L[0], L[1] - 16], [L[0], 20]], pal['text-faint'], 3);
      lbl(on ? `Light ${Math.round(s * 100)}%` : 'Lamp', L[0], L[1] + 38);
      rect(L[0] - 40, 10, 80, 120, 'Light', () => 'Light is detected by photoreceptors. Simple animals have light-sensitive cells or eyespots that sense brightness and direction; insects and vertebrates have eyes that form images.');
    } else if (stim === 'sound') {
      const S: Pt = [640, 300];
      const quake = st.animal === 'earthworm';
      if (on && a < 3.5)
        for (let i = 0; i < 4; i++) {
          const rr = ((a * 120 + i * 45) % 180) + 20;
          ctx.strokeStyle = withAlpha(W, (0.25 + 0.6 * s) * (1 - rr / 200));
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(S[0], S[1], rr, Math.PI * 0.6, Math.PI * 1.4);
          ctx.stroke();
        }
      ctx.fillStyle = pal['text-muted'];
      ctx.beginPath();
      ctx.roundRect(S[0] - 8, S[1] - 30, 34, 60, 6);
      ctx.fill();
      ctx.fillStyle = pal['sim-bg'];
      ctx.beginPath();
      ctx.arc(S[0] + 9, S[1], 11, 0, Math.PI * 2);
      ctx.fill();
      lbl(on ? `${quake ? 'Vibration' : 'Sound'} ${Math.round(s * 100)}%` : quake ? 'Vibration source' : 'Speaker', S[0] + 8, S[1] + 52);
      rect(S[0] - 20, S[1] - 40, 60, 100, quake ? 'Sound and vibration' : 'Sound', () => 'Sound is a vibration that travels through air, water or the ground. Animals detect it with ears, with hairs that move in air currents, or with receptors that feel vibrations in the ground.');
    } else if (stim === 'touch') {
      const park: Pt = [690, recW[1] - 30];
      const pr = a < 0 ? 0 : a < SRC_T ? ease(a / SRC_T) : a < 1.6 ? 1 : a < 2.2 ? 1 - ease((a - 1.6) / 0.6) : 0;
      const tip: Pt = [lerp(park[0], recW[0] + 6, pr), lerp(park[1], recW[1] - 4, pr)];
      poly([tip, [tip[0] + 110, tip[1] - 60]], pal['text-muted'], 5);
      ctx.fillStyle = pal['text-muted'];
      ctx.beginPath();
      ctx.arc(tip[0], tip[1], 5, 0, Math.PI * 2);
      ctx.fill();
      lbl(on ? `Touch ${Math.round(s * 100)}%` : 'Probe', Math.min(600, tip[0] + 70), tip[1] - 70);
    } else {
      const park: Pt = [660, 150];
      const stop: Pt = [Math.min(640, recW[0] + 120), recW[1] - 50];
      const pr = a < 0 ? 0 : ease(a / SRC_T);
      const o: Pt = [lerp(park[0], stop[0], pr), lerp(park[1], stop[1], pr)];
      if (on && a < SRC_T) for (let i = 1; i < 4; i++) glow(o[0] + i * 18, o[1] - i * 4, 22, pal['text-faint'], 0.15);
      ctx.fillStyle = withAlpha(pal['sim-text'], 0.75);
      ctx.beginPath();
      ctx.arc(o[0], o[1], 16 + 18 * s, 0, Math.PI * 2);
      ctx.fill();
      lbl(on ? `Approaching object ${Math.round(s * 100)}%` : 'Moving object', Math.min(600, o[0]), o[1] + 30 + 18 * s + 6);
    }
  }

  function drawAnimals(fx: number, fy: number, fsS: number) {
    enter(fx, fy, fsS);
    const id = st.animal;
    const A = ANIMALS[id];
    const tr = trial;
    const stim = tr ? tr.stim : st.stim;
    const r = respOf();
    const watery = id === 'hydra' || id === 'planarian';
    ctx.fillStyle = watery ? withAlpha('#4dabf7', 0.12) : withAlpha('#a07850', 0.08);
    ctx.beginPath();
    ctx.roundRect(0, 0, 700, 440, 12);
    ctx.fill();
    text(A.name, 16, 12 + 16 / cur, 15, pal['sim-text'], 'left', 700);
    text(watery ? 'In fresh water' : id === 'earthworm' ? 'On damp soil' : 'On the ground', 16, 12 + 34 / cur, 12, pal['text-faint'], 'left');
    const ground = id === 'earthworm' ? 308 : id === 'hydra' ? 390 : id === 'cat' ? 356 : 0;
    if (ground) {
      ctx.fillStyle = id === 'earthworm' ? '#7a5c3e' : withAlpha(pal['text-faint'], 0.25);
      ctx.fillRect(0, ground, 700, 440 - ground);
    }
    if (id === 'insect' && stim === 'light') {
      ctx.fillStyle = withAlpha('#2f6f3a', 0.8);
      ctx.beginPath();
      ctx.ellipse(110, 250, 90, 46, -0.15, 0, Math.PI * 2);
      ctx.fill();
      text('Dark shelter', 110, 320, 11.5, pal['text-muted']);
    }
    const [ox, oy] = ORIGIN[id];
    const recPath = GEO[id].rec[stim];
    const recW: Pt = recPath ? [ox + recPath[0][0], oy + recPath[0][1]] : id === 'hydra' ? [ox + 18, oy - 110] : id === 'planarian' ? [ox + 100, oy - 10] : id === 'earthworm' ? [ox + 150, oy - 12] : [ox, oy - 40];
    drawAnimal(id, r, stim);
    if (id === 'earthworm') {
      ctx.fillStyle = withAlpha('#7a5c3e', 0.8);
      ctx.fillRect(0, ground, 700, 440 - ground);
      ctx.fillStyle = withAlpha('#5c4430', 0.6);
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc((i * 97) % 690, ground + 12 + ((i * 53) % 110), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      text('Soil', 40, 420, 12, '#f1e7c9');
    }
    if (id === 'insect' && stim === 'light') {
      ctx.fillStyle = withAlpha('#2f6f3a', r > 0.95 ? 0.85 : 0.35);
      ctx.beginPath();
      ctx.ellipse(110, 250, 90, 46, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSource(stim, recW);
    // outcome label
    const a = trialA();
    if (tr && a > REC_T) {
      const msg = tr.out === 'none' ? 'No receptors for this stimulus' : tr.out === 'below' ? 'Too weak: below threshold' : a > EFF_T ? SHORT[id][tr.stim] ?? 'Responds' : 'Signal travelling…';
      const c = tr.out === 'none' ? pal.danger : tr.out === 'below' ? pal.warning : pal.success;
      ctx.font = fs(13, 700);
      const tw = ctx.measureText(msg).width;
      ctx.fillStyle = withAlpha(pal['bg-elev'], 0.92);
      ctx.beginPath();
      ctx.roundRect(350 - tw / 2 - 12, 400, tw + 24, 28, 14);
      ctx.fill();
      text(msg, 350, 419, 13, c, 'center', 700);
    }
    if (st.showNS && !portrait()) text('Nervous system shown in colour', 684, 26, 11, pal.accent, 'right');
    // click areas
    const bodyBox: Record<AnimalId, [number, number, number, number]> = { hydra: [250, 180, 100, 215], planarian: [150, 205, 290, 70], earthworm: [140, 270, 340, 40], insect: [200, 180, 320, 120], cat: [120, 150, 300, 210] };
    const [bx, by, bw, bh] = bodyBox[id];
    rect(bx, by, bw, bh, A.name, () => `${A.text}`);
    const c = GEO[id].center;
    if (id !== 'hydra') circ(ox + c[0], oy + c[1], 20, id === 'cat' ? 'Brain' : 'Brain (cerebral ganglia)', () => (id === 'cat' ? 'The brain combines information from all the senses, compares it with memories, and chooses a response. With the spinal cord, it forms the central nervous system.' : 'A cluster of neurons at the head end, where the main senses are. This “cephalisation” lets the animal process information quickly as it moves forwards.'));
    if (recPath) circ(recW[0], recW[1], 22, 'Receptor', () => `${A.responses[stim].receptor}. Receptors detect a change (a stimulus) and turn it into nerve impulses.`);
    leave();
  }

  function drawLadder(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Simple → complex', x + 14, y + 24, 13, pal['sim-text'], 'left', 700);
    const rowH = (h - 40) / ORDER.length;
    ORDER.forEach((id, i) => {
      const yy = y + 36 + i * rowH;
      const sel = id === st.animal;
      if (sel) {
        ctx.fillStyle = withAlpha(pal.accent, 0.14);
        ctx.beginPath();
        ctx.roundRect(x + 6, yy, w - 12, rowH - 6, 8);
        ctx.fill();
      }
      text(ANIMALS[id].name.split(' (')[0], x + 16, yy + 4 + 16 / cur, 13, sel ? pal['sim-text'] : pal['text-muted'], 'left', 700);
      text(SYS_SHORT[id], x + 16, yy + 4 + 33 / cur, 11.5, pal['text-muted'], 'left', 600);
      const wide = w > 500;
      const bw = wide ? w * 0.36 : w - 32;
      const bx = wide ? x + w - 16 - bw : x + 16;
      const by = wide ? yy + 4 + 12 / cur : yy + rowH - 22;
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.2);
      ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = sel ? pal.accent : withAlpha(pal.accent, 0.5);
      ctx.fillRect(bx, by, (bw * (i + 1)) / ORDER.length, 7);
      rect(x + 6, yy, w - 12, rowH - 6, ANIMALS[id].name, () => `${ANIMALS[id].system}. Centralisation: ${ANIMALS[id].centralised}.`, () => selectAnimal(id));
    });
  }

  function drawFlow(x: number, y: number, w: number, h: number, vertical = false) {
    panel(x, y, w, h);
    const id = st.animal;
    const tr = trial;
    const stim = tr ? tr.stim : st.stim;
    const resp = ANIMALS[id].responses[stim];
    const a = trialA();
    const stage = !tr ? -1 : tr.out === 'none' ? (a < SRC_T ? 0 : 1) : tr.out === 'below' ? (a < SRC_T ? 0 : 1) : a < SRC_T ? 0 : a < REC_T + 0.2 ? 1 : a < CEN_T ? 2 : a < EFF_T ? 3 : 4;
    const stimName = { light: 'Light', sound: id === 'earthworm' ? 'Vibration' : 'Sound', touch: 'Touch', motion: 'Moving object' }[stim];
    const boxes = [
      ['Stimulus', stimName],
      ['Receptor', resp.sense ? resp.receptor.split(/[(,]/)[0].trim() : 'None'],
      ['Coordinator', COORD[id]],
      ['Effector', id === 'cat' && stim === 'light' ? 'Iris muscles' : 'Muscles'],
      ['Response', !resp.sense || (tr && tr.out !== 'respond') ? 'None' : SHORT[id][stim] ?? '—'],
    ];
    const n = boxes.length;
    const gap = vertical ? 8 : 16;
    const bw = vertical ? w - 24 : (w - 24 - gap * (n - 1)) / n;
    const bh = vertical ? (h - 24 - gap * (n - 1)) / n : h - 24;
    boxes.forEach(([t, sub], i) => {
      const bx = vertical ? x + 12 : x + 12 + i * (bw + gap);
      const by = vertical ? y + 12 + i * (bh + gap) : y + 12;
      const active = stage === i;
      const done = stage > i;
      const fail = tr && ((tr.out === 'none' && i === 1 && stage >= 1) || (tr.out === 'below' && i === 1 && stage >= 1));
      ctx.fillStyle = fail ? withAlpha(tr!.out === 'none' ? pal.danger : pal.warning, 0.18) : active ? withAlpha(pal.warning, 0.25) : done ? withAlpha(pal.success, 0.14) : withAlpha(pal['text-faint'], 0.1);
      ctx.strokeStyle = fail ? (tr!.out === 'none' ? pal.danger : pal.warning) : active ? pal.warning : pal.border;
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();
      if (vertical) {
        text(t, bx + 14, by + bh / 2 + 5, 13, pal['sim-text'], 'left', 700);
        text(sub, bx + bw - 14, by + bh / 2 + 5, 12.5, pal['text-muted'], 'right', 600);
      } else {
        text(t, bx + bw / 2, by + 22, 12.5, pal['sim-text'], 'center', 700);
        ctx.font = fs(11, 600);
        ctx.fillStyle = pal['text-muted'];
        ctx.textAlign = 'center';
        wrap(sub, bx + bw / 2, by + 42, bw - 10, 14);
        ctx.textAlign = 'left';
        if (i < n - 1) arrow(ctx, bx + bw + 2, by + bh / 2, bx + bw + gap - 2, by + bh / 2, pal['text-faint'], 2, 7);
      }
    });
    rect(x, y, w, h, 'Stimulus → response', () => 'Every response follows the same chain. A receptor detects a stimulus (a change), the nervous system (the coordinator) processes the signal, and an effector, usually a muscle, carries out the response.');
  }

  /* ---------- Render ---------- */
  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    K = k;
    cur = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    const P = portrait();
    if (st.view === 'neuron') {
      if (P) {
        enter(12, 56, 656 / 960);
        drawNeuron(true);
        leave();
        drawTrace(10, 340, 660, 350);
        enter(41, 726, 1.3);
        drawSynapse();
        leave();
      } else {
        enter(20, 20, 1);
        drawNeuron();
        leave();
        drawTrace(20, 308, 470, 280);
        enter(520, 326, 1);
        drawSynapse();
        leave();
      }
    } else if (st.view === 'reflex') {
      if (P) {
        drawReflex(-46, 84, 0.85, true);
        drawTimeline(10, 436, 660, 704, true);
      } else {
        drawReflex(0, 14, 1);
        drawTimeline(20, 455, 960, 135, false);
      }
    } else {
      if (P) {
        drawAnimals(10, 16, 660 / 700);
        drawFlow(10, 440, 660, 280, true);
        drawLadder(10, 732, 660, 408);
      } else {
        drawAnimals(10, 16, 1);
        drawLadder(726, 50, 264, 406);
        drawFlow(10, 470, 980, 118);
      }
    }
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts and text ---------- */
  let lastNote = '';
  function updateUi() {
    const r = (name: string, label: string, t: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, t, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = '';
    if (st.view === 'neuron') {
      r('r1', 'Voltage at the axon hillock', mv(V), V >= -55 ? 'warn' : null);
      r('r2', 'Impulses fired', String(fired));
      r('r3', 'Signals passed across the synapse', String(passed), st.block && fired > 0 ? 'bad' : null);
      r('r4', 'Conduction speed (real)', st.myelin ? 'Myelinated: up to ~100 m/s' : 'Unmyelinated: ~0.5–2 m/s');
      const pct = st.strength;
      note =
        lastEvent === 'below'
          ? `A ${pct}% stimulus raised the voltage to ${mv(lastPeak)}, below the −55 mV threshold. This small graded potential fades away and no impulse is sent.`
          : lastEvent === 'zero'
            ? 'A stimulus of 0% does not change the membrane at all. Increase the strength.'
            : lastEvent === 'refractory'
              ? 'The neuron is still recovering from its last impulse (the refractory period), so it cannot fire again yet. This also stops impulses travelling backwards.'
              : lastEvent === 'blocked'
                ? 'The impulse reached the synapse and neurotransmitter was released, but the blocked receptors cannot bind it, so the next neuron receives no signal. Some drugs and toxins act like this.'
                : lastEvent === 'passed'
                  ? 'The impulse reached the axon terminals. Neurotransmitter crossed the gap and bound to receptors on the next neuron, passing the signal on. Electrical → chemical → electrical.'
                  : lastEvent === 'fired'
                    ? st.hold
                      ? `A held ${pct}% stimulus fires a train of impulses. Every impulse is the same size; a stronger stimulus makes them more frequent (until the refractory period sets a limit).`
                      : 'The threshold was reached, so an action potential fired. It is always the same size, whatever the stimulus strength: it is all-or-none.'
                    : 'Set the stimulus strength and press Stimulate. Below about 50% the voltage rises a little and fades (a graded potential). At or above it, the threshold of −55 mV is reached and an action potential fires.';
      sim.setBadge(st.hold ? `Holding ${pct}% stimulus` : `Stimulus ${pct}%`);
      canvas.setAttribute('aria-label', `Neuron with ${st.myelin ? 'a myelinated' : 'an unmyelinated'} axon. Voltage ${mv(V)}. ${fired} impulses fired, ${passed} passed across the synapse.`);
    } else if (st.view === 'reflex') {
      const RF = REFLEX[st.reflex];
      const s = RF.steps[st.rstep];
      r('r1', 'Step', `${st.rstep + 1} of ${RF.steps.length}: ${s.name}`);
      r('r2', 'Time after the stimulus', `≈ ${TIMES[st.reflex][st.rstep]} ms`);
      r('r3', 'Neurons in the arc', st.reflex === 'knee' ? '2: sensory, motor' : '3: sensory, relay, motor');
      r('r4', 'Synapses in the spinal cord', st.reflex === 'knee' ? '1 (monosynaptic)' : '2');
      note = `${s.name}: ${s.text}${st.rstep === RF.steps.length - 1 ? ` ${RF.note}` : ''}`;
      sim.setBadge(`${st.reflex === 'knee' ? 'Knee-jerk' : 'Withdrawal'}: step ${st.rstep + 1}`);
      canvas.setAttribute('aria-label', `${RF.title}. Step ${st.rstep + 1} of ${RF.steps.length}: ${s.name}.`);
    } else {
      const A = ANIMALS[st.animal];
      const stim = trial ? trial.stim : st.stim;
      const R = A.responses[stim];
      r('r1', 'Nervous system', A.system);
      r('r2', 'Receptor', R.sense ? R.receptor : `None (${R.receptor.toLowerCase()})`, R.sense ? null : 'bad');
      const out = trial?.out;
      r('r3', 'Result', !trial ? 'Press “Apply stimulus”' : out === 'none' ? 'No response: no receptor' : out === 'below' ? `Below threshold (needs ≥ ${Math.round(R.threshold * 100)}%)` : 'Responds', out === 'respond' ? 'ok' : out === 'below' ? 'warn' : out === 'none' ? 'bad' : null);
      r('r4', 'Centralisation', A.centralised);
      const name = A.name.split(' (')[0];
      note = !trial
        ? `${A.text} Choose a stimulus and press “Apply stimulus”.`
        : out === 'none'
          ? `${name}: ${R.receptor}. A stimulus can only cause a response if the animal has receptors that detect it.`
          : out === 'below'
            ? `${name}: the receptors detected a weak change, but it was too small to trigger nerve impulses (it is below the threshold). Try a stronger stimulus.`
            : `${name}: ${R.receptor} detected the stimulus. ${R.response}`;
      sim.setBadge(`${name}: ${{ light: 'light', sound: 'sound', touch: 'touch', motion: 'movement' }[stim]}`);
      canvas.setAttribute('aria-label', `${A.name}, nervous system: ${A.system}. Stimulus: ${stim}. ${!trial ? '' : out === 'respond' ? R.response : out === 'below' ? 'Below threshold, no response.' : 'No receptors, no response.'}`);
    }
    if (note !== lastNote) noteEl.textContent = lastNote = note;
  }

  /* ---------- Actions ---------- */
  function goStep(i: number) {
    st.rstep = clamp(i, 0, 7);
    rAnim = 0;
    rTimer = 0;
    updateUi();
    sim.requestRender();
  }
  function selectAnimal(id: AnimalId) {
    st.animal = id;
    animalSel.value = id;
    trial = null;
    updateUi();
    sim.requestRender();
  }
  function apply() {
    const R = ANIMALS[st.animal].responses[st.stim];
    const s = st.astrength / 100;
    trial = { t0: simT, stim: st.stim, s, out: !R.sense ? 'none' : s + 1e-9 >= R.threshold && s > 0 ? 'respond' : 'below' };
    if (!sim.running) sim.play();
    updateUi();
    sim.requestRender();
  }

  const ui = controls(root);
  const showFor = (v: View) => {
    ui.showWhen('[data-only="neuron"]', v === 'neuron');
    ui.showWhen('[data-only="reflex"]', v === 'reflex');
    ui.showWhen('[data-only="animals"]', v === 'animals');
  };
  const viewCtl = ui.choice<View>('ns-view', (v) => {
    st.view = v;
    showFor(v);
    sim.hideTooltip();
    if (v === 'reflex') {
      sim.pause();
      goStep(0);
    } else sim.play();
    updateUi();
    sim.requestRender();
  });
  const strengthCtl = ui.range('ns-strength', (v) => `${v}%`, (v) => ((st.strength = v), updateUi()));
  const holdCtl = ui.toggle('ns-hold', (v) => {
    st.hold = v;
    if (v && !sim.running) sim.play();
    if (!v) stimT = -9;
    updateUi();
  });
  const myelinCtl = ui.toggle('ns-myelin', (v) => ((st.myelin = v), (imps = []), sim.requestRender(), updateUi()));
  const blockCtl = ui.toggle('ns-block', (v) => ((st.block = v), sim.requestRender(), updateUi()));
  const ionsCtl = ui.toggle('ns-ions', (v) => ((st.ions = v), sim.requestRender()));
  root.querySelector('[data-stimulate]')?.addEventListener('click', stimulate);
  const reflexCtl = ui.choice<ReflexId>('ns-reflex', (v) => {
    st.reflex = v;
    goStep(0);
  });
  root.querySelector('[data-prev]')?.addEventListener('click', () => goStep(st.rstep - 1));
  root.querySelector('[data-next]')?.addEventListener('click', () => goStep(st.rstep + 1));
  const animalSel = root.querySelector<HTMLSelectElement>('[data-animal]')!;
  animalSel.addEventListener('change', () => selectAnimal(animalSel.value as AnimalId));
  const stimSel = root.querySelector<HTMLSelectElement>('[data-stim]')!;
  stimSel.addEventListener('change', () => {
    st.stim = stimSel.value as Stimulus;
    trial = null;
    updateUi();
    sim.requestRender();
  });
  const aStrengthCtl = ui.range('ns-astrength', (v) => `${v}%`, (v) => {
    st.astrength = v;
    updateUi();
  });
  const nsCtl = ui.toggle('ns-show', (v) => ((st.showNS = v), sim.requestRender()));
  root.querySelector('[data-apply]')?.addEventListener('click', apply);

  canvas.addEventListener('click', (e) => {
    const rc = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rc.left - ox) / k;
    const y = (e.clientY - rc.top - oy) / k;
    let a: Area | undefined;
    for (let i = areas.length - 1; i >= 0; i--)
      if (areas[i].test(x, y)) {
        a = areas[i];
        break;
      }
    if (a?.act) a.act();
    if (a) sim.showTooltip(e.clientX - rc.left, e.clientY - rc.top, a.title, a.text());
    else sim.hideTooltip();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: true,
    onPlayChange(playing) {
      if (playing && st.view === 'reflex' && st.rstep === 7) goStep(0);
    },
    reset() {
      Object.assign(st, DEF);
      viewCtl.set(DEF.view, false);
      strengthCtl.set(DEF.strength, false);
      holdCtl.set(DEF.hold, false);
      myelinCtl.set(DEF.myelin, false);
      blockCtl.set(DEF.block, false);
      ionsCtl.set(DEF.ions, false);
      reflexCtl.set(DEF.reflex, false);
      animalSel.value = DEF.animal;
      stimSel.value = DEF.stim;
      aStrengthCtl.set(DEF.astrength, false);
      nsCtl.set(DEF.showNS, false);
      showFor(DEF.view);
      V = -70;
      apAge = -1;
      imps = [];
      trace = [];
      parts = [];
      fired = 0;
      passed = 0;
      counted.clear();
      lastEvent = '';
      stimT = fuseT = postT = -9;
      recAct.fill(-9);
      trial = null;
      rAnim = rTimer = 0;
    },
  });
  showFor(DEF.view);
  updateUi();
}
