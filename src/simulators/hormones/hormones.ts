/**
 * Plant hormones lab, in three views:
 *   plant – a growing plant (with an untreated plant beside it) whose internodes,
 *           side buds, roots, leaves and fruit respond to five hormone levels.
 *           Remove the shoot tip, put auxin paste on the cut, or add drought.
 *   cells – a file of shoot cells (division → elongation → differentiation) and
 *           a dose–response chart: one auxin concentration, three tissues.
 *   tests – four small experiments: stomata (ABA), fruit ripening (ethylene),
 *           starch breakdown in a cereal grain (GA vs ABA) and tissue culture
 *           (the auxin : cytokinin ratio).
 *
 * Levels are multiples of the normal level (1 = normal, 0 = blocked). Every
 * response is a smooth, saturating or optimum-shaped curve, never on/off.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { HORMONES, HORMONE_ORDER, NORMAL, ORGANS, PRESETS, type HormoneId, type Levels } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'plant' | 'cells' | 'tests';
type Pt = [number, number];
const MAXN = 12; // nodes on the main stem
const DAYS = 40;
const STEM = '#5c940d';
const LEAF = '#51cf66';
const LEAF_OLD = '#fab005';
const SOIL = '#8d6e63';

/* ---------- Response curves ---------- */
const sat = (x: number, k: number) => x / (x + k);
const fGA = (g: number) => 0.2 + (0.8 * sat(g, 1.2)) / sat(1, 1.2);
const fAux = (a: number) => 0.5 + 0.5 * Math.min(a, 1.5) - 0.25 * Math.max(0, a - 2);
const fEth = (e: number) => 1 / (1 + 0.8 * Math.max(0, e - 1));
const fABA = (b: number) => 1 / (1 + 0.35 * Math.max(0, b - 1));
const fRootAux = (a: number) => (a <= 1 ? 0.7 + 0.3 * a : 1 / (1 + 0.8 * (a - 1)));
const fDiv = (a: number, c: number) => Math.max(0.03, ((sat(a, 0.4) / sat(1, 0.4)) * sat(c, 0.5)) / sat(1, 0.5));

interface Env {
  aux: number;
  ga: number;
  ck: number;
  aba: number;
  eth: number;
  water: number;
}
/** Hormone levels the tissues actually see: drought raises ABA and lowers cytokinin; high auxin triggers ethylene. */
function env(L: Levels, drought: boolean): Env {
  return {
    aux: L.aux,
    ga: L.ga,
    ck: L.ck * (drought ? 0.6 : 1),
    aba: L.aba * (drought ? 3.5 : 1),
    eth: L.eth * (1 + 0.6 * Math.max(0, L.aux - 1.5)) * (drought ? 1.2 : 1),
    water: drought ? 0.7 : 1,
  };
}
const elongation = (E: Env) => fGA(E.ga) * fEth(E.eth) * fABA(E.aba) * E.water;

/* ---------- Plant model ---------- */
interface PNode {
  len: number; // internode length, cm
  age: number; // days
  side: 1 | -1;
  leaf: number; // 0–1 expansion
  sen: number; // 0–1 senescence (yellowing)
  dropped: boolean;
  branch: number; // side-shoot length, cm
}
interface Plant {
  nodes: PNode[];
  nodeT: number;
  apex: boolean;
  paste: boolean;
  root: number; // cm
  laterals: number;
  flower: number; // days since flowering, -1 = none
  fruit: number; // days since fruit set, -1 = none
  ripe: number;
  day: number;
}
function newPlant(): Plant {
  return {
    nodes: [
      { len: 2.2, age: 5, side: -1, leaf: 1, sen: 0, dropped: false, branch: 0 },
      { len: 1.2, age: 2, side: 1, leaf: 0.6, sen: 0, dropped: false, branch: 0 },
    ],
    nodeT: 0,
    apex: true,
    paste: false,
    root: 3,
    laterals: 1,
    flower: -1,
    fruit: -1,
    ripe: 0,
    day: 0,
  };
}
/** Auxin reaching node i, relative to normal. It comes from the shoot tip (or paste) and fades down the stem. */
function auxAt(P: Plant, i: number, E: Env) {
  const source = P.apex || P.paste ? E.aux : 0;
  const dist = P.nodes.length - 1 - i;
  return source * (0.45 + 0.55 * Math.exp(-dist / 5));
}
const BUD_T = 0.6; // bud grows when its release index is above this
const budRelease = (P: Plant, i: number, E: Env) => (0.7 * E.ck) / (0.7 * E.ck + auxAt(P, i, E) + 1e-6);

function growPlant(P: Plant, E: Env, dt: number) {
  if (P.day >= DAYS) return;
  P.day = Math.min(DAYS, P.day + dt);
  const el = elongation(E);
  if (P.apex && P.nodes.length < MAXN) {
    P.nodeT += dt * 0.42 * fABA(E.aba) * (0.6 + 0.4 * E.water);
    if (P.nodeT >= 1) {
      P.nodeT -= 1;
      P.nodes.push({ len: 0, age: 0, side: P.nodes.length % 2 ? 1 : -1, leaf: 0, sen: 0, dropped: false, branch: 0 });
    }
  }
  P.nodes.forEach((n, i) => {
    n.age += dt;
    if (n.age < 4) n.len += dt * 0.85 * el * fAux(Math.max(auxAt(P, i, E), 0.3 * E.aux));
    n.leaf = Math.min(1, n.leaf + dt * 0.3);
    if (n.age > 16) n.sen = Math.min(1.2, n.sen + (dt * 0.03 * E.eth * (1 + 0.5 * Math.max(0, E.aba - 1))) / Math.max(0.3, E.ck));
    if (!n.dropped && n.sen >= 1 && E.eth > 1.3 && E.aux < 2) n.dropped = true;
    if (n.age > 2) {
      const rel = budRelease(P, i, E);
      if (rel > BUD_T) n.branch += dt * (rel - BUD_T) * 2.4 * el;
    }
  });
  P.root += dt * 0.9 * fRootAux(E.aux) * (1 / (1 + 0.5 * Math.max(0, E.ck - 1))) * (E.water < 1 ? 1.15 : 1);
  P.laterals = Math.min(14, P.laterals + dt * 0.25 * Math.min(E.aux, 2.5) * (E.ck > 1.5 ? 0.6 : 1));
  if (P.flower < 0 && P.day >= 18 / (0.8 + 0.2 * Math.min(E.ga, 2.5))) P.flower = 0;
  else if (P.flower >= 0) P.flower += dt;
  if (P.flower > 4 && P.fruit < 0) P.fruit = 0;
  else if (P.fruit >= 0) P.fruit += dt;
  if (P.fruit >= 6) P.ripe = Math.min(1, P.ripe + dt * 0.035 * E.eth * (1 + 3 * P.ripe));
}
const height = (P: Plant) => P.nodes.reduce((a, n) => a + n.len, 0);
const branches = (P: Plant) => P.nodes.filter((n) => n.branch > 1).length;

export function initHormones(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const showSel = root.querySelector<HTMLSelectElement>('[data-show]')!;
  const decapBtn = root.querySelector<HTMLButtonElement>('[data-decap]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = { view: 'plant' as View, levels: { ...NORMAL } as Levels, drought: false, compare: true, show: 'all', conc: -8 };
  let lastMsg = '';
  let t = 0;
  let treated = newPlant();
  let control = newPlant();
  const E = () => env(st.levels, st.drought);
  const E0 = env(NORMAL, false);

  /* ======================= Hormone particles ======================= */
  type Part = { k: HormoneId; u: number; v: number; x: number; y: number; vx: number; vy: number; age: number; off: number };
  let parts: Part[] = [];
  let spawn: Record<HormoneId, number> = { aux: 0, ga: 0, ck: 0, aba: 0, eth: 0 };
  let chain: Pt[] = []; // treated plant: shoot tip → base → root tip
  let ethSources: Pt[] = [];
  function stepParticles(dt: number) {
    if (st.show === 'none') {
      parts = [];
      return;
    }
    const e = E();
    const rate: Record<HormoneId, number> = {
      aux: treated.apex || treated.paste ? 2 * e.aux : 0,
      ga: 1.4 * e.ga,
      ck: 1.6 * e.ck,
      aba: 0.8 * e.aba,
      eth: ethSources.length ? 1.4 * e.eth : 0,
    };
    for (const k of HORMONE_ORDER) {
      if (st.show !== 'all' && st.show !== k) continue;
      spawn[k] += dt * rate[k];
      while (spawn[k] >= 1 && parts.length < 220) {
        spawn[k] -= 1;
        const off = (Math.random() - 0.5) * 6;
        if (k === 'aux') parts.push({ k, u: 0, v: 0.1, x: 0, y: 0, vx: 0, vy: 0, age: 0, off });
        else if (k === 'ck' || k === 'aba') parts.push({ k, u: 1, v: -0.09 - Math.random() * 0.03, x: 0, y: 0, vx: 0, vy: 0, age: 0, off });
        else if (k === 'ga') parts.push({ k, u: Math.random() * 0.12, v: 0.05, x: 0, y: 0, vx: 0, vy: 0, age: 0, off });
        else {
          const [sx, sy] = ethSources[Math.floor(Math.random() * ethSources.length)];
          const a = Math.random() * Math.PI * 2;
          parts.push({ k, u: 0, v: 0, x: sx, y: sy, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22 - 8, age: 0, off });
        }
      }
    }
    for (const p of parts) {
      p.age += dt;
      if (p.k === 'eth') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else p.u += p.v * dt;
    }
    // Auxin flows down to the roots; cytokinin and ABA travel up from the roots; GA stays near the top; ethylene drifts away as a gas
    parts = parts.filter((p) => (p.k === 'eth' ? p.age < 2.5 : p.k === 'ga' ? p.u < 0.45 : p.k === 'aux' ? p.u < 1 : p.u > 0.02 && p.age < 14));
    if (st.show !== 'all') parts = parts.filter((p) => p.k === st.show);
  }
  function chainPoint(u: number): Pt {
    if (chain.length < 2) return [0, 0];
    const seg = chain.slice(1).map((q, i) => Math.hypot(q[0] - chain[i][0], q[1] - chain[i][1]));
    let d = seg.reduce((a, b) => a + b, 0) * clamp(u, 0, 1);
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const f = seg[i] ? clamp(d / seg[i], 0, 1) : 0;
        return [chain[i][0] + (chain[i + 1][0] - chain[i][0]) * f, chain[i][1] + (chain[i + 1][1] - chain[i][1]) * f];
      }
      d -= seg[i];
    }
    return chain[chain.length - 1];
  }

  /* ======================= Cells model ======================= */
  type Cell = { l: number };
  const M_ZONE = 90;
  const E_ZONE = 200;
  let cells: Cell[] = [];
  let divisions: number[] = [];
  function seedCells() {
    cells = [];
    let y = 0;
    while (y < 700) {
      const l = y < M_ZONE ? 12 + (cells.length % 3) * 3 : y < M_ZONE + E_ZONE ? 12 + ((y - M_ZONE) / E_ZONE) * 84 : 96;
      cells.push({ l });
      y += l;
    }
    divisions = [];
  }
  seedCells();
  const cellParams = () => {
    const e = E();
    const el = elongation(e) * fAux(e.aux);
    return { div: 0.35 * fDiv(e.aux, e.ck) * e.water, kEl: 40 * el, lMax: clamp(12 * (2 + 6 * el), 20, 130) };
  };
  function stepCells(dt: number) {
    const p = cellParams();
    let y = 0;
    const next: Cell[] = [];
    for (const c of cells) {
      if (y < M_ZONE) {
        c.l += dt * p.div * c.l;
        if (c.l >= 24) {
          next.push({ l: c.l / 2 }, { l: c.l / 2 });
          divisions.push(t);
          y += c.l;
          continue;
        }
      } else if (y < M_ZONE + E_ZONE && c.l < p.lMax) c.l = Math.min(p.lMax, c.l + dt * p.kEl);
      next.push(c);
      y += c.l;
      if (y > 900) break;
    }
    cells = next;
    divisions = divisions.filter((d) => t - d < 20);
  }

  /* ======================= Lab tests model ======================= */
  const test = { day: 0, ap: 1, ripe: [0.06, 0.12, 0.02], digest: 0, callus: 0 };
  function resetTests() {
    Object.assign(test, { day: 0, ap: 1, ripe: [0.06, 0.12, 0.02], digest: 0, callus: 0 });
  }
  const stomataTarget = () => clamp(1 / (1 + 1.2 * Math.max(0, E().aba - 1)), 0.08, 1);
  function stepTests(dt: number) {
    const e = E();
    test.ap += (stomataTarget() - test.ap) * Math.min(1, dt * 1.5);
    if (test.day >= 12) return;
    const dd = dt * 0.5; // half a day per second
    test.day = Math.min(12, test.day + dd);
    const avg = test.ripe.reduce((a, b) => a + b, 0) / 3;
    test.ripe = test.ripe.map((r) => Math.min(1, r + dd * 0.09 * st.levels.eth * (0.3 + 2 * avg)));
    test.digest = Math.min(1, test.digest + (dd * 0.11 * (sat(st.levels.ga, 0.5) / sat(1, 0.5))) / (1 + 1.2 * Math.max(0, st.levels.aba - 1)));
    test.callus = Math.min(1, test.callus + dd * 0.12 * fDiv(st.levels.aux, st.levels.ck) * (e.water < 1 ? 0.8 : 1));
  }
  const cultureRatio = () => st.levels.aux / Math.max(0.01, st.levels.ck);
  const cultureOutcome = () => {
    if (st.levels.aux < 0.05 || st.levels.ck < 0.05) return 'No growth';
    if (test.callus < 0.3) return 'Callus growing';
    const r = cultureRatio();
    return r >= 2.5 ? 'Roots form' : r <= 0.4 ? 'Shoots form' : 'Callus only';
  };

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === 'plant') {
      if (treated.day < DAYS) {
        const dd = dt * 2; // two days per second
        growPlant(treated, E(), dd);
        growPlant(control, E0, dd);
        if (treated.day >= DAYS) {
          lastMsg = `Day ${DAYS}: compare the two plants, or press “Grow new plants” to start again with these hormone levels.`;
          sim.pause();
        }
      }
      stepParticles(dt);
    } else if (st.view === 'cells') stepCells(dt);
    else stepTests(dt);
  }

  /* ======================= Drawing helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let K = 1;
  let cur = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({
      test: (px, py) => {
        const lx = (px - f.x) / f.s;
        const ly = (py - f.y) / f.s;
        return lx >= Math.min(x, x + w) && lx <= Math.max(x, x + w) && ly >= Math.min(y, y + h) && ly <= Math.max(y, y + h);
      },
      title,
      text,
    });
  }
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(s: string, x: number, y: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    let line = '';
    for (const w of s.split(' ')) {
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
  function panel(x: number, y: number, w: number, h: number, fill = pal['bg-elev']) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }
  function pill(s: string, x: number, y: number, align: CanvasTextAlign = 'left', px = 11, color = pal['sim-text']) {
    ctx.font = fs(px, 700);
    const w = ctx.measureText(s).width;
    const pad = 5 / cur;
    const h = (px + 7) / cur;
    const x0 = align === 'left' ? x - pad : align === 'right' ? x - w - pad : x - w / 2 - pad;
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.92);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x0, y - 4 / cur - h / 2, w + 2 * pad, h, h / 2);
    ctx.fill();
    ctx.stroke();
    text(s, x, y, px, color, align, 700);
  }
  function enter(x: number, y: number, s: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    frame = { x: frame.x + x * frame.s, y: frame.y + y * frame.s, s: frame.s * s };
    cur = K * frame.s;
  }
  function leave() {
    ctx.restore();
    frame = { x: 0, y: 0, s: 1 };
    cur = K;
  }
  function ell(x: number, y: number, rx: number, ry: number, fill: string | null, stroke: string | null = null, lw = 1.5, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  function mix(c1: string, c2: string, u: number) {
    const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1);
    const b = p(c2);
    return `#${a.map((v, i) => Math.round(v + (b[i] - v) * clamp(u, 0, 1)).toString(16).padStart(2, '0')).join('')}`;
  }
  const fmt = (x: number) => (x >= 10 ? x.toFixed(0) : x.toFixed(1));

  /* ======================= Plant view ======================= */
  const plantLayout = () => {
    const [W, H] = box();
    const ground = portrait() ? 690 : 440;
    const xs = st.compare ? (portrait() ? [180, 500] : [290, 700]) : [W / 2];
    return { W, H, ground, xs };
  };
  function leafShape(x: number, y: number, len: number, ang: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = withAlpha('#2b8a3e', 0.6);
    ctx.lineWidth = 1 / cur;
    ctx.stroke();
    ctx.restore();
  }
  function fruitColor(r: number) {
    return r < 0.5 ? mix('#69db7c', '#fab005', r * 2) : mix('#fab005', '#e03131', (r - 0.5) * 2);
  }
  /** Draw a plant with its base at (x0, ground). u = px per cm for shoots, ru for roots. */
  function drawPlant(P: Plant, e: Env, x0: number, ground: number, u: number, ru: number, isTreated: boolean) {
    const pts: Pt[] = [[x0, ground]];
    P.nodes.forEach((n, i) => {
      const py = pts[pts.length - 1][1];
      pts.push([x0 + (i % 2 ? 1.5 : -1.5), py - n.len * u]);
    });
    // roots
    const rootLen = P.root * ru;
    ctx.strokeStyle = '#e9d8a6';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.2 / cur;
    ctx.beginPath();
    ctx.moveTo(x0, ground);
    ctx.quadraticCurveTo(x0 + 6, ground + rootLen * 0.5, x0 - 2, ground + rootLen);
    ctx.stroke();
    const nl = Math.floor(P.laterals);
    ctx.lineWidth = 1.6 / cur;
    for (let k = 0; k < nl; k++) {
      const d = ((k + 1) / (nl + 1)) * rootLen * 0.9;
      const len = (rootLen * 0.42 * (1 - k / (nl + 2))) + 6;
      const s = k % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x0, ground + d);
      ctx.quadraticCurveTo(x0 + s * len * 0.6, ground + d + len * 0.2, x0 + s * len * 0.85, ground + d + len * 0.55);
      ctx.stroke();
    }
    rect(x0 - 40, ground + 4, 80, Math.max(30, rootLen), ORGANS.root.name, () => {
      const m = 0.9 * fRootAux(e.aux) * (1 / (1 + 0.5 * Math.max(0, e.ck - 1)));
      return `${ORGANS.root.text} Root length ${P.root.toFixed(0)} cm, ${nl} side roots. Growth ${(m / 0.9 * 100).toFixed(0)}% of normal.`;
    });
    // stem
    ctx.strokeStyle = STEM;
    for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = Math.max(1.5, (5 - i * 0.28) * Math.min(1, u / 9)) / cur + 1;
      ctx.beginPath();
      ctx.moveTo(...pts[i - 1]);
      ctx.lineTo(...pts[i]);
      ctx.stroke();
      const n = P.nodes[i - 1];
      rect(x0 - 8, pts[i][1], 16, n.len * u, ORGANS.internode.name, () => {
        const a = auxAt(P, i - 1, e);
        return `${ORGANS.internode.text} Length ${n.len.toFixed(1)} cm. Elongation now ${(elongation(e) * fAux(Math.max(a, 0.3 * e.aux)) * 100).toFixed(0)}% of normal.`;
      });
    }
    // leaves and side shoots at each node
    let tipTop: Pt = pts[pts.length - 1];
    let longest = { len: 0, tip: tipTop };
    P.nodes.forEach((n, i) => {
      const [nx, ny] = pts[i + 1];
      const s = n.side;
      if (n.branch > 0.3) {
        // the side shoot leaves the stem at an angle, then curves upwards
        const bl = n.branch * u;
        const SEG = 8;
        const bp: Pt[] = [[nx, ny]];
        const angs: number[] = [];
        for (let k = 0; k < SEG; k++) {
          const a = -Math.PI / 2 + s * (0.85 - (0.6 * k) / SEG);
          angs.push(a);
          const [qx, qy] = bp[k];
          bp.push([qx + (Math.cos(a) * bl) / SEG, qy + (Math.sin(a) * bl) / SEG]);
        }
        ctx.strokeStyle = STEM;
        ctx.lineWidth = 2 / cur + 0.5;
        ctx.beginPath();
        bp.forEach(([qx, qy], k) => (k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy)));
        ctx.stroke();
        const nleaves = Math.floor(n.branch / 1.6);
        for (let j = 1; j <= nleaves; j++) {
          const k = Math.min(SEG - 1, Math.floor((j / (nleaves + 1)) * SEG));
          leafShape(bp[k + 1][0], bp[k + 1][1], 1.9 * u, angs[k] + (j % 2 ? 0.9 : -0.9), LEAF);
        }
        const [bx, by] = bp[SEG];
        ell(bx, by, 2.5 / cur + 1, 2.5 / cur + 1, '#94d82d');
        if (n.branch > longest.len) longest = { len: n.branch, tip: [bx, by] };
        const xs = bp.map((q) => q[0]);
        const ys = bp.map((q) => q[1]);
        rect(Math.min(...xs) - 6, Math.min(...ys) - 6, Math.max(...xs) - Math.min(...xs) + 12, Math.max(...ys) - Math.min(...ys) + 12, 'Side shoot', () => budText(P, i, e, n));
      } else if (n.age > 2) {
        ell(nx + s * 4, ny - 3, 2.6 / cur + 0.8, 2.6 / cur + 0.8, '#94d82d', '#2b8a3e', 1 / cur);
        rect(nx + s * 4 - 7, ny - 10, 14, 14, ORGANS.bud.name, () => budText(P, i, e, n));
      }
      if (!n.dropped && n.leaf > 0.05) {
        const color = mix(LEAF, LEAF_OLD, n.sen);
        const L = 4.2 * u * n.leaf * (0.85 + 0.15 * Math.min(e.ck, 2));
        const ang = s > 0 ? -0.35 : Math.PI + 0.35;
        leafShape(nx, ny, L, ang, color);
        const lx = nx + Math.cos(ang) * L * 0.5;
        const ly = ny + Math.sin(ang) * L * 0.5;
        rect(lx - L / 2, ly - L * 0.3, L, L * 0.6, ORGANS.leaf.name, () => {
          const ap = clamp(1 / (1 + 1.2 * Math.max(0, e.aba - 1)), 0.08, 1);
          return `${ORGANS.leaf.text} This leaf is ${n.age.toFixed(0)} days old and ${n.sen < 0.15 ? 'green' : n.sen < 1 ? 'yellowing' : 'yellow'}. Stomata ${(ap * 100).toFixed(0)}% open.`;
        });
        if (isTreated && n.sen > 0.3) ethSources.push([lx, ly]);
      } else if (n.dropped) {
        leafShape(nx + s * 30, ground - 3, 2.2 * u, s > 0 ? 0.1 : Math.PI - 0.1, mix(LEAF_OLD, '#a07850', 0.5));
      }
    });
    // shoot tip, or the cut
    const [tx, ty] = tipTop;
    if (P.apex) {
      ctx.fillStyle = '#94d82d';
      ctx.beginPath();
      ctx.moveTo(tx - 5, ty + 2);
      ctx.quadraticCurveTo(tx, ty - 12, tx + 5, ty + 2);
      ctx.fill();
      rect(tx - 10, ty - 14, 20, 18, ORGANS.apex.name, () => `${ORGANS.apex.text} Auxin output ${(e.aux * 100).toFixed(0)}% of normal.`);
    } else {
      ctx.strokeStyle = '#a07850';
      ctx.lineWidth = 3 / cur;
      ctx.beginPath();
      ctx.moveTo(tx - 5, ty);
      ctx.lineTo(tx + 5, ty);
      ctx.stroke();
      if (P.paste) ell(tx, ty - 4, 7, 5, HORMONES.aux.color, '#a64d00', 1 / cur);
      rect(tx - 10, ty - 12, 20, 16, P.paste ? 'Auxin paste' : 'Cut stem', () =>
        P.paste
          ? 'Auxin paste on the cut replaces the auxin from the missing shoot tip, so the side buds stay dormant, just as in the experiment by Thimann and Skoog (1933).'
          : 'With the shoot tip gone, no auxin comes down the stem, so the side buds are released from apical dominance and grow.',
      );
    }
    // flower or fruit, on the main tip (or the longest side shoot if the tip was cut)
    const at: Pt | null = P.apex ? [tx, ty - 10] : longest.len > 2 ? longest.tip : null;
    if (at && P.flower >= 0) {
      const [fx, fy] = at;
      if (P.fruit < 0) {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          ell(fx + Math.cos(a) * 5, fy - 4 + Math.sin(a) * 5, 4.5, 3, '#fff0f6', '#e64980', 0.8 / cur, a);
        }
        ell(fx, fy - 4, 2.5, 2.5, '#fcc419');
        rect(fx - 10, fy - 14, 20, 20, ORGANS.flower.name, () => ORGANS.flower.text);
      } else {
        const r = (4 + 8 * Math.min(1, P.fruit / 6)) * Math.max(0.8, Math.min(1.4, u / 9));
        ell(fx, fy + r * 0.3, r, r, fruitColor(P.ripe), withAlpha('#7a1f1f', 0.5), 1 / cur);
        ell(fx, fy + r * 0.3 - r, 3, 2, STEM);
        if (isTreated && P.ripe > 0.05) ethSources.push([fx, fy]);
        rect(fx - r - 4, fy - r - 4, 2 * r + 8, 2 * r + 8, ORGANS.fruit.name, () =>
          `${ORGANS.fruit.text} Ripeness ${(P.ripe * 100).toFixed(0)}%${P.fruit < 6 ? ' (still growing)' : ''}. Ethylene ${(e.eth * 100).toFixed(0)}% of normal.`,
        );
      }
    }
    if (isTreated) {
      chain = [...pts].reverse();
      chain.push([x0 - 2, ground + rootLen]);
    }
  }
  function budText(P: Plant, i: number, e: Env, n: PNode) {
    const a = auxAt(P, i, e);
    const rel = budRelease(P, i, e);
    const state = rel > BUD_T ? (n.branch > 1 ? 'growing into a side shoot' : 'starting to grow') : 'held dormant';
    return `${ORGANS.bud.text} Auxin arriving from above: ${(a * 100).toFixed(0)}% of the normal tip level. Cytokinin: ${(e.ck * 100).toFixed(0)}%. This bud is ${state}${n.branch > 1 ? ` (${n.branch.toFixed(1)} cm)` : ''}.`;
  }

  function drawPlantView() {
    const L = plantLayout();
    ctx.fillStyle = withAlpha(SOIL, 0.22);
    ctx.fillRect(0, L.ground, L.W, L.H - L.ground);
    ctx.fillStyle = withAlpha(SOIL, 0.7);
    ctx.fillRect(0, L.ground, L.W, 3);
    const plants = st.compare ? [control, treated] : [treated];
    const hMax = Math.max(...plants.map((p) => height(p) + Math.max(0, ...p.nodes.map((n) => n.branch * 0.66)) + 3), 12);
    // fit the tallest plant vertically and the widest side shoots horizontally
    const reach = Math.max(...plants.map((p) => Math.max(0, ...p.nodes.map((n) => n.branch * 0.6))), 1);
    const room = st.compare ? (L.xs[1] - L.xs[0]) / 2 - 12 : L.W / 2 - 20;
    const u = Math.min(14, (L.ground - 90) / hMax, room / reach);
    const rMax = Math.max(...plants.map((p) => p.root), 8);
    const ru = Math.min(u, (L.H - L.ground - 46) / rMax);
    ethSources = [];
    plants.forEach((p, k) => {
      const isT = p === treated;
      drawPlant(p, isT ? E() : E0, L.xs[k], L.ground, u, ru, isT);
      const lbl = st.compare ? (isT ? 'Treated' : 'Untreated') : 'Your plant';
      pill(lbl, L.xs[k], L.H - 16, 'center', 12, isT ? pal.accent : pal['text-muted']);
    });
    // hormone particles on the treated plant
    for (const p of parts) {
      let x: number;
      let y: number;
      if (p.k === 'eth') [x, y] = [p.x, p.y];
      else {
        [x, y] = chainPoint(p.u);
        x += p.off;
      }
      const a = p.k === 'eth' ? Math.max(0, 1 - p.age / 2.5) : 0.95;
      ell(x, y, 3.2 / cur, 3.2 / cur, withAlpha(HORMONES[p.k].color, a), withAlpha('#ffffff', a * 0.8), 0.8 / cur);
    }
    // scale bar
    const sb = 5 * u;
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 1.5 / cur;
    ctx.beginPath();
    ctx.moveTo(18, L.ground - 12);
    ctx.lineTo(18, L.ground - 12 - sb);
    ctx.stroke();
    text('5 cm', 24, L.ground - 12 - sb / 2, 10.5, pal['text-muted'], 'left', 650);
    if (st.drought) pill('☀ Drought: soil dry', 18, 30, 'left', 11.5, pal.danger);
  }

  /* ======================= Cells view ======================= */
  const cellsLayout = () =>
    portrait()
      ? { file: { x: 14, y: 14, w: 652, h: 400 }, chart: { x: 14, y: 424, w: 652, h: 306 }, sum: { x: 14, y: 740, w: 652, h: 250 } }
      : { file: { x: 14, y: 14, w: 440, h: 572 }, chart: { x: 466, y: 70, w: 520, h: 360 }, sum: { x: 466, y: 442, w: 520, h: 144 } };
  const CURVES: { name: string; peak: number; color: string }[] = [
    { name: 'Roots', peak: -10, color: '#a0522d' },
    { name: 'Buds', peak: -8, color: '#2f9e44' },
    { name: 'Stems', peak: -5, color: '#1c7ed6' },
  ];
  const resp = (x: number, peak: number) => 1.05 * Math.exp(-((x - peak) ** 2) / (2 * 0.95 ** 2)) - 0.85 / (1 + Math.exp(-(x - (peak + 1.9)) * 2.4));
  let chartBox = { x: 0, y: 0, w: 1, h: 1 };
  function drawCells() {
    const L = cellsLayout();
    const F = L.file;
    panel(F.x, F.y, F.w, F.h);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(F.x, F.y, F.w, F.h, 10);
    ctx.clip();
    const cx = F.x + F.w * (portrait() ? 0.36 : 0.42);
    const top = F.y + 62;
    const cols = 5;
    const cw = 30;
    // apex dome
    ctx.fillStyle = '#b2f2bb';
    ctx.beginPath();
    ctx.ellipse(cx, top, (cols * cw) / 2, 30, 0, Math.PI, 0);
    ctx.fill();
    text('Shoot tip', cx, top - 36, 11, pal['text-muted'], 'center', 700);
    // the file of cells, drawn in parallel columns
    for (let c = 0; c < cols; c++) {
      let y = top + (c % 2) * 5;
      const x = cx - (cols * cw) / 2 + c * cw;
      const xylem = c === 2;
      for (const cell of cells) {
        const yy = y - top;
        if (y > F.y + F.h) break;
        const zone = yy < M_ZONE ? 0 : yy < M_ZONE + E_ZONE ? 1 : 2;
        const fill = zone === 0 ? '#8ce99a' : zone === 1 ? '#c3fae8' : xylem ? '#ffe8cc' : '#e6fcf5';
        ctx.fillStyle = fill;
        ctx.strokeStyle = '#2b8a3e';
        ctx.lineWidth = 1 / cur;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, cw - 2, cell.l - 2, 4);
        ctx.fill();
        ctx.stroke();
        if (zone === 0) ell(x + cw / 2, y + cell.l / 2, 4, Math.min(4, cell.l / 3), '#2b8a3e');
        else if (zone === 1) ell(x + cw / 2, y + cell.l / 2, cw * 0.3, Math.max(1, cell.l * 0.32), withAlpha('#ffffff', 0.85));
        else if (xylem)
          for (let k = 6; k < cell.l - 4; k += 7) {
            ctx.strokeStyle = '#d9480f';
            ctx.beginPath();
            ctx.moveTo(x + 3, y + k);
            ctx.lineTo(x + cw - 3, y + k + 3);
            ctx.stroke();
          }
        y += cell.l;
      }
    }
    ctx.restore();
    // zone brackets
    const bx = cx + (cols * cw) / 2 + 12;
    const zones: [string, string, number, number][] = [
      ['Cell division', 'cytokinin + auxin', 0, M_ZONE],
      ['Cell elongation', 'gibberellin + auxin', M_ZONE, M_ZONE + E_ZONE],
      ['Differentiation', 'cells mature', M_ZONE + E_ZONE, F.y + F.h - top - 10],
    ];
    for (const [name, sub, a, b] of zones) {
      ctx.strokeStyle = pal['text-muted'];
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      ctx.moveTo(bx, top + a + 3);
      ctx.lineTo(bx + 6, top + a + 3);
      ctx.lineTo(bx + 6, top + b - 3);
      ctx.lineTo(bx, top + b - 3);
      ctx.stroke();
      const my = top + (a + b) / 2;
      text(name, bx + 14, my - 3, 12, pal['sim-text'], 'left', 750);
      text(sub, bx + 14, my + 13 / cur, 10.5, pal['text-muted'], 'left', 600);
    }
    drawChart(L.chart);
    drawCellSummary(L.sum);
  }
  function drawChart(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    text('Same auxin, different tissues', B.x + 14, B.y + 22, 12.5, pal['sim-text'], 'left', 750);
    const P = { x: B.x + 28, y: B.y + 30 + 20 / cur, w: B.w - 52, h: B.h - 30 - 20 / cur - 46 };
    chartBox = P;
    const X = (v: number) => P.x + ((v + 12) / 10) * P.w;
    const Y = (r: number) => P.y + P.h / 2 - (r / 1.15) * (P.h / 2);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x, P.y + P.h);
    ctx.moveTo(P.x, Y(0));
    ctx.lineTo(P.x + P.w, Y(0));
    ctx.stroke();
    // legend in the title row: above the line promotes growth, below it inhibits
    ctx.font = fs(10, 700);
    const iw = ctx.measureText('▼ inhibits').width;
    text('▼ inhibits', B.x + B.w - 14, B.y + 22, 10, pal.danger, 'right', 700);
    text('▲ promotes', B.x + B.w - 14 - iw - 10 / cur, B.y + 22, 10, pal.success, 'right', 700);
    for (let v = -12; v <= -2; v += 2) {
      power(v, X(v), P.y + P.h + 16 / cur);
    }
    text('Auxin concentration (mol/dm³)', P.x + P.w / 2, P.y + P.h + 34 / cur, 10.5, pal['text-muted'], 'center', 650);
    for (const c of CURVES) {
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2.5 / cur;
      ctx.beginPath();
      for (let v = -12; v <= -2; v += 0.05) {
        const px = X(v);
        const py = Y(resp(v, c.peak));
        if (v === -12) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      text(c.name, X(c.peak), Y(resp(c.peak, c.peak)) - 8 / cur, 11, c.color, 'center', 800);
    }
    // marker
    const mx = X(st.conc);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2 / cur;
    ctx.setLineDash([5 / cur, 4 / cur]);
    ctx.beginPath();
    ctx.moveTo(mx, P.y);
    ctx.lineTo(mx, P.y + P.h);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const c of CURVES) ell(mx, Y(resp(st.conc, c.peak)), 4.5 / cur, 4.5 / cur, c.color, '#ffffff', 1.2 / cur);
    pill('Drag me', mx, Y(-0.95), 'center', 10.5, pal.accent);
  }
  /** "10" with a raised exponent, drawn by hand so it works in every font. */
  function power(v: number, x: number, y: number) {
    ctx.font = fs(10, 650);
    const a = ctx.measureText('10').width;
    ctx.font = fs(8, 700);
    const b = ctx.measureText(String(v)).width;
    const x0 = x - (a + b) / 2;
    text('10', x0, y, 10, pal['text-muted'], 'left', 650);
    text(String(v), x0 + a + 1 / cur, y - 5 / cur, 8, pal['text-muted'], 'left', 700);
  }
  const sup = (v: number) => String(v).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  const effectWord = (r: number) => (r > 0.15 ? 'promoted' : r < -0.15 ? 'inhibited' : 'little effect');
  function drawCellSummary(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    const p = cellParams();
    const perMin = divisions.length * 3;
    text('Growth = number of new cells × length of each cell', B.x + 14, B.y + 24, 12.5, pal['sim-text'], 'left', 750);
    let y = B.y + 24 + 22 / cur;
    y = wrap(`New cells: ${perMin} per minute (cytokinin ${fmt(E().ck * 100)}%, auxin ${fmt(st.levels.aux * 100)}%). Final cell length: about ${p.lMax.toFixed(0)} µm (gibberellin ${fmt(st.levels.ga * 100)}%, ethylene ${fmt(E().eth * 100)}%, ABA ${fmt(E().aba * 100)}%).`, B.x + 14, y, B.w - 28, 11.5, pal['text-muted'], 600);
    wrap(`On the chart, 10${sup(Math.round(st.conc))} mol/dm³ auxin: roots ${effectWord(resp(st.conc, -10))}, buds ${effectWord(resp(st.conc, -8))}, stems ${effectWord(resp(st.conc, -5))}.`, B.x + 14, y + 4 / cur, B.w - 28, 11.5, pal['text-muted'], 600);
  }

  /* ======================= Lab tests view ======================= */
  const testRects = () =>
    portrait()
      ? [0, 1, 2, 3].map((i) => ({ x: 14, y: 70 + i * 232, w: 652, h: 222 }))
      : [0, 1, 2, 3].map((i) => ({ x: 14 + (i % 2) * 492, y: 70 + Math.floor(i / 2) * 268, w: 480, h: 258 }));
  function drawTests() {
    const R = testRects();
    const titles = ['Stomata and ABA', 'Fruit ripening and ethylene', 'Cereal grain: gibberellin vs ABA', 'Tissue culture: auxin and cytokinin'];
    const draws = [drawStomata, drawRipening, drawGrain, drawCulture];
    R.forEach((r, i) => {
      panel(r.x, r.y, r.w, r.h);
      const s = Math.min(r.w / 400, r.h / 240);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.clip();
      enter(r.x + (r.w - 400 * s) / 2, r.y + (r.h - 240 * s) / 2, s);
      draws[i]();
      leave();
      ctx.restore();
      pill(titles[i], r.x + 12, r.y + 20, 'left', 11.5);
    });
  }
  function status(s: string, color = pal['sim-text']) {
    pill(s, 200, 226, 'center', 11.5, color);
  }
  function drawStomata() {
    // epidermis
    ctx.fillStyle = '#f4fce3';
    ctx.fillRect(-100, 0, 600, 240);
    ctx.strokeStyle = '#c0eb75';
    ctx.lineWidth = 1.2;
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 9; c++) {
        ctx.beginPath();
        ctx.roundRect(-30 + c * 56 + (r % 2) * 28, 28 + r * 36, 52, 32, 12);
        ctx.stroke();
      }
    const ap = test.ap;
    for (const cx of [130, 270]) {
      const cy = 118;
      const gap = 4 + 12 * ap;
      ell(cx, cy, 2 + 8 * ap, 30, '#343a40');
      for (const s of [-1, 1]) {
        ell(cx + s * (gap + 9), cy, 13, 38, '#69db7c', '#2b8a3e', 2, s * 0.05);
        for (let k = 0; k < 4; k++) ell(cx + s * (gap + 9), cy - 22 + k * 15, 2.5, 2.5, '#2b8a3e');
      }
      // water vapour leaving the open pore
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.8 + k * 0.25 + cx) % 1;
        if (ap > 0.15) ell(cx + Math.sin(k * 2 + t) * 5, cy - 20 - ph * 60, 3, 3, withAlpha('#4dabf7', ap * (1 - ph)));
      }
      if (E().aba > 1.3) {
        for (const s of [-1, 1]) {
          ctx.strokeStyle = HORMONES.aba.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + s * (gap + 14), cy + 34);
          ctx.lineTo(cx + s * (gap + 32), cy + 48);
          ctx.stroke();
        }
      }
    }
    if (E().aba > 1.3) pill('K⁺ and water leave the guard cells', 200, 186, 'center', 10.5);
    status(`ABA ${fmt(E().aba * 100)}% → stomata ${(ap * 100).toFixed(0)}% open`, ap < 0.5 ? pal.danger : pal.success);
  }
  function drawRipening() {
    ctx.fillStyle = withAlpha('#c3a68a', 0.35);
    ctx.fillRect(40, 168, 320, 10);
    test.ripe.forEach((r, i) => {
      const x = 100 + i * 100;
      const y = 130;
      ell(x, y, 34, 31, fruitColor(r), withAlpha('#7a1f1f', 0.4), 1.5);
      ell(x - 10, y - 10, 8, 5, withAlpha('#ffffff', 0.35));
      for (let k = 0; k < 5; k++) ell(x + Math.cos(k * 1.26) * 7, y - 30 + Math.sin(k * 1.26) * 3, 6, 2.5, STEM, null, 1, k * 1.26);
      // ethylene puffs
      if (st.levels.eth > 0)
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.5 + k / 3 + i * 0.2) % 1;
          ell(x + Math.sin(k * 2.1 + i) * 20 * ph, y - 40 - ph * 50, 3.5, 3.5, withAlpha(HORMONES.eth.color, r * st.levels.eth * 0.6 * (1 - ph)));
        }
      text(`${(r * 100).toFixed(0)}%`, x, y + 56, 11, pal['sim-text'], 'center', 750);
    });
    const avg = test.ripe.reduce((a, b) => a + b, 0) / 3;
    status(st.levels.eth === 0 ? 'Ethylene blocked: the fruit stays green' : `Ethylene ${fmt(st.levels.eth * 100)}% → ripeness ${(avg * 100).toFixed(0)}%`, st.levels.eth === 0 ? pal.danger : pal['sim-text']);
  }
  function drawGrain() {
    const cx = 210;
    const cy = 118;
    const rx = 150;
    const ry = 78;
    ell(cx, cy, rx, ry, '#ffd8a8', '#d9480f', 2);
    ell(cx, cy, rx - 9, ry - 9, '#fff9db');
    // starch granules disappear from the aleurone layer inwards
    for (let gx = cx - rx; gx <= cx + rx; gx += 13)
      for (let gy = cy - ry; gy <= cy + ry; gy += 13) {
        const d = Math.sqrt(((gx - cx) / (rx - 14)) ** 2 + ((gy - cy) / (ry - 14)) ** 2);
        if (d >= 1) continue;
        const depth = 1 - d;
        if (depth < test.digest * 1.05) continue;
        ell(gx, gy, 4.5, 4.5, '#ffffff', '#ced4da', 1);
      }
    // embryo
    ell(cx - rx + 26, cy + 30, 26, 32, '#ffa94d', '#d9480f', 1.5, -0.4);
    text('embryo', cx - rx + 26, cy + 78, 10.5, pal['sim-text'], 'center', 700);
    // GA moving along the aleurone layer, amylase moving inwards
    if (st.levels.ga > 0.05)
      for (let k = 0; k < 8; k++) {
        const ph = (t * 0.25 + k / 8) % 1;
        const a = Math.PI * 0.8 - ph * Math.PI * 1.6;
        ell(cx + Math.cos(a) * (rx - 4), cy + Math.sin(a) * (ry - 4), 3.2, 3.2, HORMONES.ga.color);
        const b = a + 0.3;
        const inward = 0.6 + 0.35 * ((t * 0.6 + k * 0.37) % 1);
        if (st.levels.aba < 2.5) ell(cx + Math.cos(b) * (rx - 4) * inward, cy + Math.sin(b) * (ry - 4) * inward, 2.4, 2.4, '#fd7e14');
      }
    status(
      st.levels.ga < 0.05 ? 'No gibberellin: starch stays locked up' : `Starch → sugar: ${(test.digest * 100).toFixed(0)}% (GA ${fmt(st.levels.ga * 100)}%, ABA ${fmt(st.levels.aba * 100)}%)`,
      st.levels.ga < 0.05 ? pal.danger : pal['sim-text'],
    );
    text('starch', cx + 30, cy + 4, 10.5, pal['text-muted'], 'center', 700);
  }
  function drawCulture() {
    const cx = 200;
    const cy = 112;
    ell(cx, cy, 120, 84, '#e7f5ff', '#adb5bd', 3);
    ell(cx, cy, 112, 76, '#fff9db');
    const g = test.callus;
    const out = cultureOutcome();
    const prog = clamp((g - 0.3) / 0.7, 0, 1);
    if (out === 'Roots form')
      for (let k = 0; k < 9; k++) {
        const a = 0.3 + (k / 8) * (Math.PI - 0.6);
        const len = 16 + 46 * prog * (0.6 + 0.4 * ((k * 7) % 3) / 2);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 12);
        ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.8, cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.75);
        ctx.strokeStyle = '#a0522d';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = '#e9d8a6';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    const r = 12 + 26 * g;
    for (let k = 0; k < 7; k++) ell(cx + Math.cos(k) * r * 0.45, cy + Math.sin(k * 1.7) * r * 0.3, r * 0.55, r * 0.42, '#f3d9a4', '#c9a86a', 1);
    if (out === 'Shoots form')
      for (let k = 0; k < 4; k++) {
        const x = cx - 24 + k * 16;
        const h = 18 + 40 * prog;
        ctx.strokeStyle = STEM;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, cy - r * 0.2);
        ctx.lineTo(x + (k - 1.5) * 4, cy - r * 0.2 - h);
        ctx.stroke();
        leafShape(x + (k - 1.5) * 4, cy - r * 0.2 - h * 0.7, 14 * (0.5 + prog), -0.5, LEAF);
        leafShape(x + (k - 1.5) * 4, cy - r * 0.2 - h * 0.5, 14 * (0.5 + prog), Math.PI + 0.5, LEAF);
      }
    const ratio = cultureRatio();
    status(
      out === 'No growth' ? 'No growth: dividing cells need both hormones' : `Auxin : cytokinin = ${ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1)} : 1 → ${out.toLowerCase()}`,
      out === 'No growth' ? pal.danger : pal['sim-text'],
    );
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    const { k, ox, oy } = tf();
    K = k;
    cur = k;
    frame = { x: 0, y: 0, s: 1 };
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    if (st.view === 'plant') drawPlantView();
    else if (st.view === 'cells') drawCells();
    else drawTests();
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
    const e = E();
    let note = lastMsg;
    if (st.view === 'plant') {
      const ht = height(treated);
      const hc = height(control);
      r('r1', 'Day', `${treated.day.toFixed(0)} of ${DAYS}`);
      r('r2', 'Height', st.compare ? `${ht.toFixed(0)} cm (untreated ${hc.toFixed(0)} cm)` : `${ht.toFixed(0)} cm`, st.compare && Math.abs(ht - hc) > 0.15 * hc ? 'warn' : null);
      r('r3', 'Side shoots', st.compare ? `${branches(treated)} (untreated ${branches(control)})` : String(branches(treated)), branches(treated) > branches(control) + 1 ? 'warn' : null);
      r('r4', 'Root length', st.compare ? `${treated.root.toFixed(0)} cm (untreated ${control.root.toFixed(0)} cm)` : `${treated.root.toFixed(0)} cm`);
      const ap = clamp(1 / (1 + 1.2 * Math.max(0, e.aba - 1)), 0.08, 1);
      r('r5', 'Stomata', `${(ap * 100).toFixed(0)}% open`, ap < 0.5 ? 'warn' : null);
      r('r6', 'Fruit', treated.fruit < 0 ? (treated.flower >= 0 ? 'Flowering' : 'Not yet') : treated.fruit < 6 ? 'Growing' : treated.ripe >= 0.95 ? 'Ripe' : `Ripening ${(treated.ripe * 100).toFixed(0)}%`);
      note ||= 'The plant on the right grows with your hormone levels; the one on the left is untreated. Tap any part of a plant to inspect it. Changes apply from now on; press “Grow new plants” to start again with your settings.';
      sim.setBadge(`Day ${treated.day.toFixed(0)}`);
      canvas.setAttribute('aria-label', `Day ${treated.day.toFixed(0)}. Treated plant ${ht.toFixed(0)} cm tall with ${branches(treated)} side shoots; untreated plant ${hc.toFixed(0)} cm with ${branches(control)}.`);
    } else if (st.view === 'cells') {
      const p = cellParams();
      const perMin = divisions.length * 3;
      r('r1', 'New cells', `${perMin} per minute`);
      r('r2', 'Final cell length', `≈ ${p.lMax.toFixed(0)} µm`);
      r('r3', 'Elongation speed', `${((p.kEl / 40) * 100).toFixed(0)}% of normal`);
      r('r4', 'Chart: auxin', `10${sup(Math.round(st.conc))} mol/dm³`);
      r('r5', 'Roots · buds', `${effectWord(resp(st.conc, -10))} · ${effectWord(resp(st.conc, -8))}`);
      r('r6', 'Stems', effectWord(resp(st.conc, -5)));
      note ||= 'Shoots grow in two ways: cells divide near the tip, then stretch. Cytokinin and auxin drive division; gibberellin and auxin drive elongation. On the chart, drag the dashed line to see that the same auxin concentration can promote one tissue and inhibit another.';
      sim.setBadge(`${perMin} cells/min`);
      canvas.setAttribute('aria-label', `Shoot cells: ${perMin} new cells per minute, final length about ${p.lMax.toFixed(0)} micrometres.`);
    } else {
      const avg = test.ripe.reduce((a, b) => a + b, 0) / 3;
      r('r1', 'Stomata (ABA)', `${(test.ap * 100).toFixed(0)}% open`, test.ap < 0.5 ? 'warn' : null);
      r('r2', 'Fruit ripeness (ethylene)', `${(avg * 100).toFixed(0)}%`);
      r('r3', 'Starch digested (GA vs ABA)', `${(test.digest * 100).toFixed(0)}%`);
      r('r4', 'Tissue culture', cultureOutcome(), cultureOutcome() === 'No growth' ? 'bad' : null);
      r('r5', 'Auxin : cytokinin', `${cultureRatio() >= 10 ? cultureRatio().toFixed(0) : cultureRatio().toFixed(1)} : 1`);
      r('r6', 'Experiment day', `${test.day.toFixed(1)} of 12`);
      note ||= 'Four classic experiments run at once with your hormone levels. Try raising ABA, blocking ethylene (0%), or setting auxin high and cytokinin low for the tissue culture.';
      sim.setBadge(`Day ${test.day.toFixed(1)}`);
      canvas.setAttribute('aria-label', `Lab tests: stomata ${(test.ap * 100).toFixed(0)}% open, fruit ${(avg * 100).toFixed(0)}% ripe, starch ${(test.digest * 100).toFixed(0)}% digested, tissue culture: ${cultureOutcome()}.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    ui.showWhen('[data-only="plant"]', st.view === 'plant');
    ui.showWhen('[data-only="cells"]', st.view === 'cells');
    ui.showWhen('[data-only="tests"]', st.view === 'tests');
  }
  const viewCtl = ui.choice<View>('ph-view', (v) => {
    st.view = v;
    lastMsg = '';
    sim.hideTooltip();
    showView();
    if (!sim.running && !(v === 'plant' && treated.day >= DAYS)) sim.play();
    sim.requestRender();
  });
  const sliders = HORMONE_ORDER.map((k) =>
    ui.range(`ph-${k}`, (v) => `${v}%`, (v) => {
      st.levels[k] = v / 100;
      lastMsg = '';
      syncPresets();
      sim.requestRender();
    }),
  );
  const presetBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-hp]')];
  function syncPresets() {
    for (const b of presetBtns) {
      const L = PRESETS[b.dataset.hp!].levels;
      b.setAttribute('aria-pressed', String(HORMONE_ORDER.every((k) => Math.abs(L[k] - st.levels[k]) < 0.005)));
    }
  }
  presetBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const p = PRESETS[b.dataset.hp!];
      HORMONE_ORDER.forEach((k, i) => sliders[i].set(Math.round(p.levels[k] * 100)));
      lastMsg = `${p.label}: ${p.note}${st.view === 'plant' && treated.day > 1 ? ' Press “Grow new plants” to see it from the start.' : ''}`;
      sim.requestRender();
    }),
  );
  const droughtCtl = ui.toggle('ph-drought', (v) => {
    st.drought = v;
    lastMsg = v
      ? 'Drought: the roots sense dry soil and make more ABA, which travels to the leaves and closes the stomata. Shoot growth slows and cytokinin from the roots falls.'
      : 'Water restored: ABA falls back to normal and the stomata reopen.';
    sim.requestRender();
  });
  const compareCtl = ui.toggle('ph-compare', (v) => ((st.compare = v), sim.requestRender()));
  const pasteCtl = ui.toggle('ph-paste', (v) => {
    treated.paste = v;
    lastMsg = treated.apex
      ? 'The paste only matters once the shoot tip has been cut off.'
      : v
        ? 'Auxin paste now replaces the missing shoot tip: the side buds stay dormant (Thimann and Skoog, 1933).'
        : 'No paste: without auxin from above, the side buds are free to grow.';
    sim.requestRender();
  });
  decapBtn.addEventListener('click', () => {
    treated.apex = !treated.apex;
    decapBtn.textContent = treated.apex ? 'Cut off the shoot tip' : 'Let the tip regrow';
    decapBtn.setAttribute('aria-pressed', String(!treated.apex));
    lastMsg = treated.apex
      ? 'The shoot tip is back. Its auxin flows down the stem again and slows the side buds.'
      : treated.paste
        ? 'Shoot tip cut off, but the auxin paste replaces its auxin: the side buds stay dormant.'
        : 'Shoot tip cut off! Its auxin no longer flows down the stem, so the side buds are released from apical dominance and start to grow. Gardeners do this when they pinch out plants to make them bushy.';
    if (!sim.running && treated.day < DAYS) sim.play();
    sim.requestRender();
  });
  function regrow() {
    treated = newPlant();
    control = newPlant();
    treated.paste = pasteCtl.value;
    decapBtn.textContent = 'Cut off the shoot tip';
    decapBtn.setAttribute('aria-pressed', 'false');
    parts = [];
  }
  root.querySelector('[data-regrow]')?.addEventListener('click', () => {
    regrow();
    lastMsg = 'Two new seedlings, growing with your current hormone levels.';
    if (!sim.running) sim.play();
    sim.requestRender();
  });
  showSel.addEventListener('change', () => {
    st.show = showSel.value;
    parts = [];
    sim.requestRender();
  });
  const concCtl = ui.range('ph-conc', (v) => `10${sup(Math.round(v))} mol/dm³`, (v) => ((st.conc = v), sim.requestRender()));
  root.querySelector('[data-restart]')?.addEventListener('click', () => {
    resetTests();
    if (!sim.running) sim.play();
    sim.requestRender();
  });
  root.querySelector('[data-step]')?.addEventListener('click', () => {
    sim.pause();
    const n = st.view === 'plant' ? 25 : 20;
    for (let i = 0; i < n; i++) step(0.02); // plant: 1 day; others: 0.4 s (0.2 day in the tests)
    sim.requestRender();
  });

  /* ======================= Pointer ======================= */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  const onChart = (bx: number, by: number) => bx >= chartBox.x - 10 && bx <= chartBox.x + chartBox.w + 10 && by >= chartBox.y - 10 && by <= chartBox.y + chartBox.h + 10;
  const setConcFromX = (bx: number) => concCtl.set(clamp(Math.round(((bx - chartBox.x) / chartBox.w) * 10 - 12), -12, -2));
  enableDrag<'conc'>(canvas, {
    hit(x, y) {
      if (st.view !== 'cells') return null;
      const [bx, by] = toBox(x, y);
      return onChart(bx, by) ? 'conc' : null;
    },
    start(_id, x) {
      setConcFromX(toBox(x, 0)[0]);
    },
    move(_id, x) {
      setConcFromX(toBox(x, 0)[0]);
    },
    click(x, y) {
      const [bx, by] = toBox(x, y);
      for (let i = areas.length - 1; i >= 0; i--)
        if (areas[i].test(bx, by)) {
          sim.showTooltip(x, y, areas[i].title, areas[i].text());
          return;
        }
      sim.hideTooltip();
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: true,
    reset() {
      st.drought = false;
      st.compare = true;
      st.show = 'all';
      st.conc = -8;
      HORMONE_ORDER.forEach((k, i) => {
        st.levels[k] = 1;
        sliders[i].set(100, false);
      });
      syncPresets();
      droughtCtl.set(false, false);
      compareCtl.set(true, false);
      pasteCtl.set(false, false);
      concCtl.set(-8, false);
      showSel.value = 'all';
      viewCtl.set(st.view, false);
      regrow();
      seedCells();
      resetTests();
      lastMsg = '';
      t = 0;
      showView();
      sim.play();
    },
  });

  syncPresets();
  showView();
  sim.requestRender();
}
