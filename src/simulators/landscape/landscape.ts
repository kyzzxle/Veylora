/**
 * Landscape lab, in four views:
 *   3d        – a terrain (mountains, glacial valley, hills, river, fan, dunes,
 *               cliff, delta) shaped by a simple landscape-evolution model:
 *               stream-power erosion and deposition (capacity ∝ rain·√A·S, reduced
 *               by vegetation) plus hillslope diffusion. Show change, cross-section.
 *   weather   – a rock block under freeze–thaw, thermal expansion, oxidation,
 *               dissolution and root wedging, each with a rate that depends on
 *               climate and rock type (relative, illustrative rates).
 *   erosion   – water (USLE-style soil loss and the Hjulström curve), wind
 *               (suspension, saltation, creep), glaciers (Glen’s flow law) and
 *               gravity (infinite-slope factor of safety).
 *   landforms – delta, alluvial fan, meanders, beach and spit, dunes, and V/U
 *               valleys, each shown before and after.
 */
import type * as T from 'three';
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { FORMS, LANDFORMS, ROCKS, WEATHERING, type AgentId, type FormId, type LandformId, type ProcId, type RockId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = '3d' | 'weather' | 'erosion' | 'landforms';
type Pt = [number, number];
const N = 100; // terrain grid
const SIZE = 10; // world units across
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const sstep = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/* ======================= Terrain ======================= */
const riverX = (z: number) => 0.6 + 0.9 * Math.sin(z * 0.75);
function baseHeight(x: number, z: number) {
  let h = 0.55 - 0.18 * z;
  h += 2.3 * Math.exp(-(((z + 3.3) / 1.3) ** 2)) * (0.72 + 0.22 * Math.sin(x * 1.3) + 0.12 * Math.sin(x * 3.1 + 1));
  h += 0.45 * Math.exp(-(((z - 0.2) / 1.6) ** 2)) * (0.5 + 0.5 * Math.sin(x * 0.9 + 0.5) * Math.cos(z * 1.1));
  // glacial U-valley in the mountains (west)
  const gx = Math.abs(x + 2.6);
  if (z < -1.6 && gx < 0.9) h -= 0.9 * (1 - (gx / 0.9) ** 4) * sstep(-1.6, -2.6, z);
  // river valley
  const dx = x - riverX(z);
  if (z > -3.2) h -= 0.45 * Math.exp(-((dx / 0.38) ** 2)) * sstep(-3.2, -2.2, z);
  // alluvial fan at the mountain front (east)
  const fr = Math.hypot(x - 3.1, z + 1.3);
  h += 0.32 * Math.max(0, 1 - fr / 1.3) ** 1.5;
  // dunes on the western lowland
  if (x < -2 && z > -0.4 && z < 1.9) h += 0.07 * Math.sin(x * 6.5 + z * 2) ** 2 * sstep(-2, -2.6, x) * sstep(1.9, 1.5, z);
  // coast: sea to the south, with a high cliff in the south-east
  const cz = coastZ(x);
  const cliff = sstep(1.7, 2.4, x);
  h -= (1 - cliff) * Math.min(0.55, Math.max(0, z - cz) * 0.55);
  if (cliff > 0) {
    h += cliff * 0.3 * (1 - sstep(cz + 0.05, cz + 0.2, z));
    h -= cliff * sstep(cz + 0.05, cz + 0.2, z) * 0.95;
  }
  // delta lobe at the river mouth, pushing out into the sea
  const dz = z - DELTA[1];
  const da = Math.atan2(x - DELTA[0], dz);
  const dr = Math.hypot(x - DELTA[0], dz) / (1 + 0.22 * Math.cos(3 * da));
  if (dz > -0.6 && dr < 1.05) h = Math.max(h, 0.03 + 0.09 * (1 - dr / 1.05));
  return h;
}
const coastZ = (x: number) => 2.3 + 0.2 * Math.sin(x * 0.9);
const DELTA: [number, number] = [riverX(2.5), 2.75];
/**
 * Priority-flood: raise every closed hollow to its spill height (plus a tiny
 * gradient) so that water from every land cell can drain to the sea or the edge.
 */
function fillPits(a: Float32Array) {
  const heap: number[] = [];
  const done = new Uint8Array(N * N);
  const less = (p: number, q: number) => a[heap[p]] < a[heap[q]];
  const push = (k: number) => {
    heap.push(k);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (!less(c, p)) break;
      [heap[c], heap[p]] = [heap[p], heap[c]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && less(l, m)) m = l;
        if (r < heap.length && less(r, m)) m = r;
        if (m === c) break;
        [heap[c], heap[m]] = [heap[m], heap[c]];
        c = m;
      }
    }
    return top;
  };
  for (let k = 0; k < N * N; k++) {
    const i = k % N;
    const j = (k / N) | 0;
    if (i === 0 || j === 0 || i === N - 1 || j === N - 1 || a[k] <= 0) {
      done[k] = 1;
      push(k);
    }
  }
  while (heap.length) {
    const k = pop();
    const i = k % N;
    const j = (k / N) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const n = nj * N + ni;
        if (done[n]) continue;
        done[n] = 1;
        if (a[n] <= a[k]) a[n] = a[k] + 1e-4;
        push(n);
      }
  }
}
function landformAt(x: number, z: number, h: number): LandformId {
  const cz = coastZ(x);
  if (Math.hypot(x - DELTA[0], z - DELTA[1]) < 1.15 && z > DELTA[1] - 0.6 && h > -0.05) return 'delta';
  if (x > 2.1 && z > cz - 0.5 && h > -0.2) return 'cliff';
  if (h < 0.01) return 'sea';
  if (z > cz - 0.45) return 'beach';
  if (Math.abs(x + 2.6) < 1 && z < -1.6) return 'glacial';
  if (z < -2.2) return 'peak';
  if (Math.hypot(x - 3.1, z + 1.3) < 1.3) return 'fan';
  if (x < -2 && z > -0.4 && z < 1.9) return 'dunes';
  if (Math.abs(x - riverX(z)) < 0.55) return 'river';
  return 'hills';
}

/* ======================= Weathering ======================= */
interface Climate {
  temp: number; // mean °C
  range: number; // daily range °C
  water: number; // 0–100
  ph: number;
  veg: number; // 0–100
}
function weatherRates(c: Climate, rock: RockId): Record<ProcId, number> {
  const R = ROCKS[rock];
  const w = c.water / 100;
  // days per year when the temperature crosses 0 °C (simplified)
  const ftDays = 365 * clamp(1 - Math.abs(c.temp) / Math.max(1, c.range / 2), 0, 1);
  const arr = 2 ** ((c.temp - 15) / 10); // chemical reactions roughly double every 10 °C
  return {
    ft: (ftDays / 365) * w * R.ft,
    thermal: (c.range / 30) ** 2 * (1 - 0.6 * w) * R.thermal * 0.8,
    ox: arr * w * R.iron * 0.6,
    hydro: arr * w * R.feld * 0.5,
    diss: arr * w * R.diss * clamp(10 ** (5.6 - c.ph), 0.2, 30) * 0.5,
    roots: (c.veg / 100) * w * (c.temp > 0 ? 1 : 0.2) * 0.5,
  };
}

/* ======================= Erosion agents ======================= */
/** Approximate Hjulström curves (velocity in cm/s vs grain size in mm). */
const HJ_ERODE: Pt[] = [[0.001, 150], [0.01, 60], [0.1, 22], [0.3, 19], [1, 30], [10, 100], [100, 310], [1000, 900]];
const HJ_SETTLE: Pt[] = [[0.03, 0.15], [0.1, 1], [1, 10], [10, 80], [100, 260], [1000, 750]];
function logInterp(pts: Pt[], d: number) {
  const x = Math.log10(d);
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [Math.log10(pts[i][0]), Math.log10(pts[i + 1][0])];
    if (x <= b || i === pts.length - 2) {
      const u = (x - a) / (b - a);
      return 10 ** lerp(Math.log10(pts[i][1]), Math.log10(pts[i + 1][1]), u);
    }
  }
  return pts[pts.length - 1][1];
}
const settleV = (d: number) => (d < 0.03 ? 0 : logInterp(HJ_SETTLE, d));

export function initLandscape(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    view: '3d' as View,
    rain3: 1,
    veg3: 30,
    showChange: false,
    section: false,
    labels: false,
    climate: { temp: 2, range: 14, water: 70, ph: 5.6, veg: 30 } as Climate,
    rock: 'granite' as RockId,
    agent: 'water' as AgentId,
    rain: 50,
    slope: 15,
    veg: 30,
    grain: 0.3, // mm
    wind: 12,
    ice: 200,
    temp: 0,
    form: 'meander' as FormId,
    flow: 50,
    supply: 50,
    wave: 40,
    split: true,
  };
  let t = 0;
  let lastMsg = '';

  /* ---------- terrain model ---------- */
  const h0 = new Float32Array(N * N);
  const h = new Float32Array(N * N);
  const acc = new Float32Array(N * N);
  const rec = new Int32Array(N * N);
  const order = new Int32Array(N * N);
  let years = 0;
  const xOf = (i: number) => -SIZE / 2 + (i / (N - 1)) * SIZE;
  function buildTerrain() {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h0[j * N + i] = baseHeight(xOf(i), xOf(j));
    fillPits(h0);
    h.set(h0);
    years = 0;
    routeFlow();
  }
  function routeFlow() {
    const idx = Array.from({ length: N * N }, (_, k) => k).sort((a, b) => h[b] - h[a]);
    order.set(idx);
    const d = SIZE / (N - 1);
    for (let k = 0; k < N * N; k++) {
      const i = k % N;
      const j = (k / N) | 0;
      let best = -1;
      let bs = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const s = (h[k] - h[nj * N + ni]) / (d * Math.hypot(di, dj));
          if (s > bs) {
            bs = s;
            best = nj * N + ni;
          }
        }
      rec[k] = best;
    }
    acc.fill(st.rain3);
    for (let n = 0; n < N * N; n++) {
      const k = order[n];
      if (rec[k] >= 0) acc[rec[k]] += acc[k];
    }
  }
  /** One step ≈ 1,000 model years of stream-power erosion, deposition and hillslope creep. */
  function erodeStep() {
    routeFlow();
    const d = SIZE / (N - 1);
    const load = new Float32Array(N * N);
    const veg = st.veg3 / 100;
    for (let n = 0; n < N * N; n++) {
      const k = order[n];
      const r = rec[k];
      if (h[k] <= 0) {
        // the sea traps sediment: it settles close to the shore first, building a delta
        const dep = Math.min(load[k], 0.006, -h[k] + 0.02);
        h[k] += dep;
        load[k] -= dep;
        if (r >= 0) load[r] += load[k];
        continue; // anything left at the edge is carried out to the open sea
      }
      if (r < 0 && (k % N === 0 || k % N === N - 1 || k < N || k >= N * (N - 1))) continue; // leaves the map
      const S = r >= 0 ? Math.max(0, (h[k] - h[r]) / d) : 0;
      // transport capacity ∝ discharge × slope; detachment ∝ √discharge × slope, reduced by plant cover
      const cap = 0.008 * acc[k] * S;
      if (load[k] > cap) {
        const dep = (load[k] - cap) * 0.3;
        h[k] += dep;
        load[k] -= dep;
      } else {
        const e = Math.min(cap - load[k], 0.0004 * Math.sqrt(acc[k]) * S * (1 - 0.8 * veg), 0.003, r >= 0 ? Math.max(0, h[k] - h[r]) * 0.5 : 0);
        h[k] -= e;
        load[k] += e;
      }
      if (r >= 0) load[r] += load[k];
    }
    // hillslope diffusion (soil creep, rockfall): smoother where vegetation is sparse
    const kd = 0.005 * (1 - 0.5 * veg);
    const nh = new Float32Array(h);
    for (let j = 1; j < N - 1; j++)
      for (let i = 1; i < N - 1; i++) {
        const k = j * N + i;
        if (h[k] <= 0) {
          // new sediment on the sea floor spreads downslope (waves and currents)
          const s = h[k] - h0[k];
          if (s <= 0.0005) continue;
          for (const n of [k - 1, k + 1, k - N, k + N]) {
            if (h[n] >= h[k]) continue;
            const flux = Math.min(0.12 * (h[k] - h[n]), s / 4);
            nh[k] -= flux;
            nh[n] += flux;
          }
          continue;
        }
        const lap = h[k - 1] + h[k + 1] + h[k - N] + h[k + N] - 4 * h[k];
        nh[k] += kd * lap;
      }
    h.set(nh);
    years += 1000;
  }

  /* ---------- weathering state ---------- */
  const wx = { years: 0, dmg: { ft: 0, thermal: 0, ox: 0, hydro: 0, diss: 0, roots: 0 } as Record<ProcId, number> };
  function stepWeather(dt: number) {
    const rates = weatherRates(st.climate, st.rock);
    wx.years += dt * 500;
    for (const p of Object.keys(rates) as ProcId[]) wx.dmg[p] = Math.min(1, wx.dmg[p] + rates[p] * dt * 0.1);
  }

  /* ---------- erosion state ---------- */
  const ez = { t: 0, slide: 0, soil: 0 };
  const glacierSpeed = () => {
    const A = 2.4e-24;
    const tau = 900 * 9.81 * Math.sin((st.slope * Math.PI) / 180);
    return ((2 * A) / 4) * tau ** 3 * st.ice ** 4 * 3.156e7; // m per year (internal deformation)
  };
  const factorOfSafety = () => {
    const th = (st.slope * Math.PI) / 180;
    const c = 0.5 + 9 * (st.veg / 100); // kPa, roots add cohesion
    const g = 19;
    const z = 2;
    const m = clamp(st.rain / 100, 0, 1); // saturated fraction of the soil
    const phi = (32 * Math.PI) / 180;
    return c / (g * z * Math.sin(th) * Math.cos(th)) + (1 - (m * 9.81) / g) * (Math.tan(phi) / Math.tan(th));
  };
  /** Relative soil loss (USLE-style: rainfall erosivity × slope factor × cover factor). */
  const soilLoss = () => {
    const R = (st.rain / 50) ** 2;
    const s = Math.sin((st.slope * Math.PI) / 180);
    const LS = (65.4 * s * s + 4.56 * s + 0.065) * 1.2;
    const C = 10 ** (-2.2 * (st.veg / 100));
    return 6 * R * LS * C; // t/ha/yr (illustrative scale)
  };
  /** Runoff speed (cm/s): faster with more rain and steeper slopes (illustrative scaling). */
  const flowVelocity = () => clamp(40 * Math.sqrt(Math.max(st.rain, 2) / 50) * Math.sqrt(Math.sin((Math.max(st.slope, 0.5) * Math.PI) / 180) / Math.sin(Math.PI / 12)), 1, 400);
  const waterMode = () => {
    const v = flowVelocity();
    const d = st.grain;
    if (v >= logInterp(HJ_ERODE, d)) return 'eroded';
    if (v >= settleV(d)) return 'transported';
    return 'deposited';
  };
  const windMode = () => {
    const d = st.grain;
    const thr = 4 + 6 * Math.abs(Math.log10(d / 0.08)) ** 1.3; // threshold wind speed m/s, lowest for fine sand
    const eff = st.wind * (1 - 0.7 * (st.veg / 100));
    if (eff < thr) return 'stays put';
    if (d < 0.07) return 'suspension';
    if (d < 1) return 'saltation';
    return 'creep';
  };

  /* ---------- landforms state ---------- */
  let ft = 0; // landform time 0–1

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === '3d') {
      stepAcc += dt;
      if (stepAcc > 0.12) {
        stepAcc = 0;
        erodeStep();
        terrainDirty = true;
        if (years >= 400000) {
          lastMsg = 'After 400,000 model years the valleys are deeper, the hills rounder and the delta has grown. Press Reset to start again.';
          sim.pause();
        }
      }
    } else if (st.view === 'weather') stepWeather(dt);
    else if (st.view === 'erosion') {
      ez.t += dt;
      if (st.agent === 'gravity' && factorOfSafety() < 1) ez.slide = Math.min(1, ez.slide + dt * 0.5);
      else ez.slide = Math.max(0, ez.slide - dt * 0.2);
      if (st.agent === 'water') ez.soil = Math.min(1, ez.soil + dt * soilLoss() / 300);
    } else {
      ft = Math.min(1, ft + dt * 0.06);
      timeCtl.set(Math.round(ft * 100), false);
      if (ft >= 1) sim.pause();
    }
  }
  let stepAcc = 0;
  let terrainDirty = true;

  /* ======================= 2D helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let cur = 1;
  let K = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(s: string, x: number, y: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600, maxY = Infinity) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    let line = '';
    for (const w of s.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        if (y + lh > maxY) {
          ctx.fillText(`${line}…`, x, y);
          return y + lh;
        }
        ctx.fillText(line, x, y);
        line = w;
        y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lh;
  }
  function panel(x: number, y: number, w: number, hh: number, fill = pal['bg-elev']) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x, y, w, hh, 10);
    ctx.fill();
    ctx.stroke();
  }
  function pill(s: string, x: number, y: number, align: CanvasTextAlign = 'left', px = 11, color = pal['sim-text']) {
    ctx.font = fs(px, 700);
    const w = ctx.measureText(s).width;
    const pad = 5 / cur;
    const hh = (px + 7) / cur;
    const x0 = align === 'left' ? x - pad : align === 'right' ? x - w - pad : x - w / 2 - pad;
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.92);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x0, y - 4 / cur - hh / 2, w + 2 * pad, hh, hh / 2);
    ctx.fill();
    ctx.stroke();
    text(s, x, y, px, color, align, 700);
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
  /** Fit a local w×h drawing into box B; returns nothing, enter() is active until leave(). */
  function fit(B: { x: number; y: number; w: number; h: number }, w: number, hh: number, pad = 8) {
    const s = Math.min((B.w - pad * 2) / w, (B.h - pad * 2) / hh);
    enter(B.x + (B.w - w * s) / 2, B.y + (B.h - hh * s) / 2, s);
  }
  function bars(B: { x: number; y: number; w: number; h: number }, title: string, items: [string, number, string][]) {
    panel(B.x, B.y, B.w, B.h);
    text(title, B.x + 12, B.y + 22, 12.5, pal['sim-text'], 'left', 800);
    const max = Math.max(0.15, ...items.map((i) => i[1]));
    const top = B.y + 34;
    const lh = (B.y + B.h - 8 - top) / items.length;
    const bh = Math.min(16, lh * 0.32);
    items.forEach(([nm, v, col], k) => {
      const y = top + k * lh;
      text(nm, B.x + 12, y + lh * 0.38, 11, pal['sim-text'], 'left', 700);
      const bw = B.w - 24;
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.2);
      ctx.fillRect(B.x + 12, y + lh * 0.5, bw, bh);
      ctx.fillStyle = col;
      ctx.fillRect(B.x + 12, y + lh * 0.5, Math.max(2 / cur, (bw * v) / max), bh);
    });
  }

  /* ======================= Weathering view ======================= */
  const wLayout = () => (portrait() ? { rock: { x: 14, y: 70, w: 652, h: 560 }, rates: { x: 14, y: 642, w: 652, h: 346 } } : { rock: { x: 14, y: 14, w: 620, h: 572 }, rates: { x: 646, y: 70, w: 340, h: 516 } });
  function drawWeather() {
    const L = wLayout();
    panel(L.rock.x, L.rock.y, L.rock.w, L.rock.h, pal['surface-2']);
    fit(L.rock, 600, 460);
    const R = ROCKS[st.rock];
    const D = wx.dmg;
    const c = st.climate;
    // sky and ground
    ctx.fillStyle = c.temp < 0 ? '#e7f5ff' : '#d0ebff';
    ctx.fillRect(0, 0, 600, 380);
    ctx.fillStyle = '#a9845a';
    ctx.fillRect(0, 380, 600, 80);
    // rock block, worn back by thermal flaking and dissolution
    const loss = 22 * D.thermal + 30 * D.diss;
    const bx = 120 + loss * 0.5;
    const by = 150 + loss;
    const bw = 360 - loss;
    ctx.fillStyle = R.color;
    ctx.beginPath();
    ctx.moveTo(bx, 380);
    ctx.lineTo(bx, by + 20);
    ctx.quadraticCurveTo(bx, by, bx + 20, by);
    ctx.lineTo(bx + bw - 20, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 20);
    ctx.lineTo(bx + bw, 380);
    ctx.closePath();
    ctx.fill();
    // oxidation rind
    if (D.ox > 0.02) {
      ctx.strokeStyle = withAlpha('#c2541a', Math.min(0.85, D.ox * 1.4));
      ctx.lineWidth = 4 + 26 * D.ox;
      ctx.stroke();
    }
    // hydrolysis: feldspar rots to a soft, pale clay skin that crumbles into grains
    if (D.hydro > 0.02) {
      ctx.fillStyle = withAlpha('#e8d5b7', Math.min(0.9, D.hydro * 1.3));
      ctx.fillRect(bx, by, bw, 6 + 24 * D.hydro);
      for (let k = 0; k < Math.round(D.hydro * 30); k++) ell(bx - 8 - rnd(k + 11) * 40, 374 - rnd(k + 12) * 6, 2.5, 2, '#d9c6a5');
    }
    // dissolution pits and grooves on top
    for (let k = 0; k < Math.round(D.diss * 14); k++) {
      const x = bx + 20 + rnd(k) * (bw - 40);
      ell(x, by + 4, 4 + 8 * D.diss, 3 + 10 * D.diss * rnd(k + 3), withAlpha('#868e96', 0.7));
    }
    // thermal flakes (exfoliation sheets)
    if (D.thermal > 0.05)
      for (let k = 0; k < 3; k++) {
        const off = 8 + k * 9;
        ctx.strokeStyle = withAlpha('#343a40', Math.min(0.7, D.thermal * 1.5));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx + off, 380);
        ctx.lineTo(bx + off, by + off + 14);
        ctx.quadraticCurveTo(bx + off, by + off, bx + off + 14, by + off);
        ctx.lineTo(bx + bw - off - 14, by + off);
        ctx.stroke();
      }
    // joints opened by frost and roots
    const open = 1.5 + 14 * D.ft + 10 * D.roots;
    const cracks = [bx + bw * 0.3, bx + bw * 0.62];
    for (const cxk of cracks) {
      ctx.fillStyle = '#343a40';
      ctx.beginPath();
      ctx.moveTo(cxk - open / 2, by);
      ctx.lineTo(cxk + open / 2, by);
      ctx.lineTo(cxk + 1, by + 120 + 120 * D.ft);
      ctx.lineTo(cxk - 1, by + 120 + 120 * D.ft);
      ctx.closePath();
      ctx.fill();
      if (c.temp - c.range / 2 < 0 && c.water > 10 && Math.sin(t * 2) < 0) {
        ctx.fillStyle = withAlpha('#a5d8ff', 0.95);
        ctx.fillRect(cxk - open / 2, by, open, 30 + 40 * D.ft);
      }
    }
    // a tree whose roots wedge the right-hand crack
    if (c.veg > 5) {
      const tx = cracks[1];
      ctx.strokeStyle = '#6b4f2a';
      ctx.lineWidth = 2 + 3 * D.roots;
      ctx.beginPath();
      ctx.moveTo(tx, by);
      ctx.lineTo(tx, by + 40 + 120 * D.roots);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(tx, by);
      ctx.lineTo(tx, by - 50);
      ctx.stroke();
      ell(tx, by - 66, 36 * (0.4 + c.veg / 150), 30 * (0.4 + c.veg / 150), '#2f9e44');
    }
    // fragments piled at the foot (the products of weathering)
    const frag = Math.round(40 * Math.min(1, D.ft + D.thermal * 0.8 + D.roots * 0.6));
    for (let k = 0; k < frag; k++) {
      const side = k % 2 ? 1 : -1;
      const x = side > 0 ? bx + bw + 10 + rnd(k) * 60 : bx - 10 - rnd(k) * 60;
      ell(x, 376 - rnd(k + 9) * 14, 5 + rnd(k + 5) * 6, 4 + rnd(k + 7) * 4, R.color, '#495057', 0.8);
    }
    // weather
    if (c.water > 20 && c.temp > 0)
      for (let k = 0; k < Math.round(c.water / 4); k++) {
        const ph = (t * 1.2 + rnd(k)) % 1;
        ctx.strokeStyle = withAlpha(c.ph < 5 ? '#e67700' : '#4dabf7', 0.6);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(30 + rnd(k + 2) * 540, ph * 360);
        ctx.lineTo(28 + rnd(k + 2) * 540, ph * 360 + 12);
        ctx.stroke();
      }
    if (c.range > 18) ell(540, 50, 22, 22, withAlpha('#fab005', 0.9));
    leave();
    pill(`${R.name} · ${Math.round(wx.years).toLocaleString('en')} years`, L.rock.x + 14, L.rock.y + 24, 'left', 11.5);
    pill('Weathering breaks rock in place; erosion carries it away.', L.rock.x + L.rock.w / 2, L.rock.y + L.rock.h - 16, 'center', 10.5, pal['text-muted']);
    const rates = weatherRates(c, st.rock);
    bars(L.rates, 'Weathering rates here', (Object.keys(WEATHERING) as ProcId[]).map((p) => [`${WEATHERING[p].name} (${WEATHERING[p].kind.toLowerCase()})`, rates[p], WEATHERING[p].color]));
  }

  /* ======================= Erosion view ======================= */
  const eLayout = () => (portrait() ? { scene: { x: 14, y: 70, w: 652, h: 520 }, side: { x: 14, y: 602, w: 652, h: 386 } } : { scene: { x: 14, y: 14, w: 600, h: 572 }, side: { x: 626, y: 70, w: 360, h: 516 } });
  function drawErosion() {
    const L = eLayout();
    panel(L.scene.x, L.scene.y, L.scene.w, L.scene.h, pal['surface-2']);
    fit(L.scene, 600, 480);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 600, 480);
    ctx.clip();
    if (st.agent === 'water') drawWater();
    else if (st.agent === 'wind') drawWind();
    else if (st.agent === 'glacier') drawGlacier();
    else drawGravity();
    ctx.restore();
    leave();
    if (st.agent === 'water') drawHjulstrom(L.side);
    else drawAgentInfo(L.side);
  }
  const slopeLine = (x: number) => 380 - (520 - x) * Math.tan((Math.max(st.slope, 1) * Math.PI) / 180) * 0.8;
  function drawWater() {
    ctx.fillStyle = '#e7f5ff';
    ctx.fillRect(0, 0, 600, 480);
    // hillslope
    ctx.fillStyle = '#a9845a';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    for (let x = 0; x <= 520; x += 10) ctx.lineTo(x, Math.max(60, slopeLine(x)) + ez.soil * 18 * (x / 520));
    ctx.lineTo(600, 380);
    ctx.lineTo(600, 480);
    ctx.closePath();
    ctx.fill();
    // gullies
    for (let k = 0; k < Math.round(ez.soil * 8); k++) {
      const x = 80 + k * 50;
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, Math.max(60, slopeLine(x)) + 2);
      ctx.lineTo(x + 20, Math.max(60, slopeLine(x + 20)) + 10 + 10 * ez.soil);
      ctx.stroke();
    }
    // vegetation
    for (let k = 0; k < Math.round(st.veg / 5); k++) {
      const x = 20 + rnd(k) * 480;
      const y = Math.max(60, slopeLine(x));
      ctx.strokeStyle = '#2f9e44';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 14 - rnd(k + 1) * 14);
      ctx.stroke();
      ell(x, y - 22 - rnd(k + 1) * 10, 9, 8, '#51cf66');
    }
    // rain and runoff carrying soil
    for (let k = 0; k < Math.round(st.rain / 2); k++) {
      const ph = (t * 1.5 + rnd(k)) % 1;
      const x = rnd(k + 3) * 600;
      ctx.strokeStyle = withAlpha('#4dabf7', 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, ph * Math.max(60, slopeLine(x)));
      ctx.lineTo(x - 2, ph * Math.max(60, slopeLine(x)) + 10);
      ctx.stroke();
    }
    const mode = waterMode();
    const nGrains = Math.round(clamp(soilLoss() / 1.5, 2, 40));
    for (let k = 0; k < nGrains; k++) {
      const ph = (t * (mode === 'deposited' ? 0.02 : 0.25) + rnd(k)) % 1;
      const x = ph * 560;
      const y = Math.max(60, slopeLine(Math.min(x, 520))) - 3 - (mode === 'transported' ? 4 : 0);
      ell(x, y, 2 + Math.log10(st.grain * 10 + 1) * 3, 2 + Math.log10(st.grain * 10 + 1) * 3, '#6d4c41');
    }
    // deposit at the foot of the slope
    ctx.fillStyle = '#c9a66b';
    ctx.beginPath();
    ctx.ellipse(560, 382, 70, 6 + 30 * ez.soil, 0, Math.PI, 0);
    ctx.fill();
    text('Deposit where the slope flattens', 590, 470, 11, '#343a40', 'right', 700);
  }
  function drawHjulstrom(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    text('Erode, transport or deposit?', B.x + 12, B.y + 20, 12, pal['sim-text'], 'left', 800);
    const P = { x: B.x + 48, y: B.y + 34, w: B.w - 62, h: B.h - 34 - 42 / cur - 40 };
    const X = (d: number) => P.x + ((Math.log10(d) + 3) / 6) * P.w;
    const Y = (v: number) => P.y + P.h - ((Math.log10(v) + 1) / 4) * P.h;
    ctx.fillStyle = withAlpha('#e64980', 0.15);
    ctx.beginPath();
    ctx.moveTo(X(0.001), P.y);
    for (let e = -3; e <= 3; e += 0.1) ctx.lineTo(X(10 ** e), Y(logInterp(HJ_ERODE, 10 ** e)));
    ctx.lineTo(X(1000), P.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = withAlpha('#adb5bd', 0.25);
    ctx.beginPath();
    ctx.moveTo(X(0.03), P.y + P.h);
    for (let e = Math.log10(0.03); e <= 3; e += 0.1) ctx.lineTo(X(10 ** e), Y(Math.max(0.1, settleV(10 ** e))));
    ctx.lineTo(X(1000), P.y + P.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1 / cur;
    ctx.strokeRect(P.x, P.y, P.w, P.h);
    text('Erosion', X(1), P.y + 16 / cur, 10.5, '#c2255c', 'center', 750);
    text('Transport', X(0.05), Y(3), 10.5, pal['text-muted'], 'center', 750);
    text('Deposition', X(30), P.y + P.h - 8 / cur, 10.5, pal['text-muted'], 'center', 750);
    for (const d of [0.001, 0.01, 0.1, 1, 10, 100, 1000]) text(`${d}`, X(d), P.y + P.h + 12 / cur, 8.5, pal['text-faint'], 'center', 600);
    text('Grain size (mm) →', P.x + P.w, P.y + P.h + 26 / cur, 9.5, pal['text-muted'], 'right', 650);
    for (const v of [1, 10, 100]) text(`${v}`, P.x - 4, Y(v) + 3 / cur, 9, pal['text-faint'], 'right', 600);
    text('cm/s', P.x - 4, P.y - 4, 9, pal['text-faint'], 'right', 600);
    const v = flowVelocity();
    ell(X(st.grain), Y(v), 6 / cur, 6 / cur, pal.accent, '#ffffff', 1.5 / cur);
    const mode = waterMode();
    text(`Water at ${v.toFixed(0)} cm/s: ${st.grain} mm grains are ${mode}`, B.x + 12, B.y + B.h - 14, 11, pal.accent, 'left', 750);
    text('After Hjulström (1935), approximate', B.x + 12, B.y + B.h - 14 - 16 / cur, 9.5, pal['text-faint'], 'left', 600);
  }
  function drawWind() {
    ctx.fillStyle = '#fff4e6';
    ctx.fillRect(0, 0, 600, 480);
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    for (let x = 0; x <= 600; x += 10) ctx.lineTo(x, 380 + 10 * Math.sin(x / 50));
    ctx.lineTo(600, 480);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < Math.round(st.veg / 6); k++) {
      const x = 30 + rnd(k) * 540;
      ctx.strokeStyle = '#5c940d';
      ctx.lineWidth = 2;
      for (let a = -2; a <= 2; a++) {
        ctx.beginPath();
        ctx.moveTo(x, 380);
        ctx.lineTo(x + a * 5, 360);
        ctx.stroke();
      }
    }
    const mode = windMode();
    const g = st.grain;
    for (let k = 0; k < 40; k++) {
      const ph = (t * (0.15 + st.wind / 40) + rnd(k)) % 1;
      let x = rnd(k + 2) * 600;
      let y = 376;
      if (mode === 'suspension') {
        x = (rnd(k + 2) * 600 + ph * 600) % 600;
        y = 120 + rnd(k + 5) * 200 + Math.sin(t * 2 + k) * 20;
      } else if (mode === 'saltation') {
        const hop = (ph * 4) % 1;
        x = (rnd(k + 2) * 600 + ph * 400) % 600;
        y = 376 - Math.sin(hop * Math.PI) * 26 * (1 - hop * 0.5);
      } else if (mode === 'creep') x = (rnd(k + 2) * 600 + ph * 60) % 600;
      const r = clamp(1.5 + Math.log10(g * 10 + 1) * 4, 1.5, 9);
      ell(x, y, r, r, '#b08968', '#7f5539', 0.8);
    }
    for (let k = 0; k < 5; k++) {
      const y = 60 + k * 50;
      const x = ((t * st.wind * 12 + k * 130) % 700) - 100;
      ctx.strokeStyle = withAlpha('#868e96', 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 30, y - 6, x + 60, y + 6, x + 90, y);
      ctx.stroke();
    }
  }
  function drawGlacier() {
    ctx.fillStyle = '#e7f5ff';
    ctx.fillRect(0, 0, 600, 480);
    // valley floor
    const th = (st.slope * Math.PI) / 180;
    const fy = (x: number) => 190 + x * Math.tan(th) * 0.9;
    ctx.fillStyle = '#868e96';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    for (let x = 0; x <= 600; x += 10) ctx.lineTo(x, Math.min(470, fy(x)));
    ctx.lineTo(600, 480);
    ctx.closePath();
    ctx.fill();
    // glacier: length set by temperature (snout retreats when warm)
    const len = clamp(520 - st.temp * 30 + (st.ice - 200) * 0.4, 80, 560);
    const thick = clamp(st.ice / 2.5, 20, 180);
    ctx.fillStyle = withAlpha('#d0ebff', 0.95);
    ctx.strokeStyle = '#74c0fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, fy(0) - thick);
    for (let x = 0; x <= len; x += 10) ctx.lineTo(x, Math.min(470, fy(x)) - thick * Math.sqrt(Math.max(0, 1 - (x / len) ** 3)));
    for (let x = len; x >= 0; x -= 10) ctx.lineTo(x, Math.min(470, fy(x)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // boulders carried in the ice, dropped at the snout as moraine
    const u = glacierSpeed();
    for (let k = 0; k < 14; k++) {
      const ph = (t * clamp(u / 200, 0.02, 0.4) + rnd(k)) % 1;
      const x = ph * len;
      ell(x, Math.min(470, fy(x)) - 6 - rnd(k + 4) * thick * 0.5 * (1 - x / len), 5 + rnd(k) * 6, 4 + rnd(k) * 4, '#495057');
    }
    for (let k = 0; k < 26; k++) ell(len + 6 + rnd(k) * 40, Math.min(470, fy(len + 20)) - rnd(k + 2) * 18, 3 + rnd(k + 5) * 7, 3 + rnd(k + 6) * 5, '#868e96', '#495057', 0.8);
    text('Moraine (unsorted till)', Math.min(500, len + 30), Math.min(460, fy(len + 20)) - 30, 10.5, '#343a40', 'center', 750);
  }
  function drawGravity() {
    ctx.fillStyle = '#e7f5ff';
    ctx.fillRect(0, 0, 600, 480);
    const th = (st.slope * Math.PI) / 180;
    const g = 0.75 * Math.tan(th);
    const ang = Math.atan(g);
    const surf = (x: number) => clamp(280 + (x - 330) * g, 30, 470);
    // bedrock hillside
    ctx.fillStyle = '#868e96';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    for (let x = 0; x <= 600; x += 10) ctx.lineTo(x, surf(x));
    ctx.lineTo(600, 480);
    ctx.closePath();
    ctx.fill();
    const F = factorOfSafety();
    const X0 = 190;
    const X1 = 470;
    const D = 56; // soil thickness on screen
    // soil layer that stays in place outside the block
    ctx.fillStyle = '#b08968';
    ctx.beginPath();
    for (let x = 0; x <= 600; x += 10) ctx.lineTo(x, surf(x));
    for (let x = 600; x >= 0; x -= 10) ctx.lineTo(x, surf(x) + 16);
    ctx.closePath();
    ctx.fill();
    // the soil block slides downslope when the factor of safety drops below 1
    const s = ez.slide;
    const dist = s * 140;
    const dx = dist * Math.cos(ang);
    const dy = dist * Math.sin(ang);
    if (s > 0.02) {
      ctx.fillStyle = withAlpha('#495057', 0.5);
      ctx.beginPath();
      for (let x = X0; x <= X1; x += 10) ctx.lineTo(x, surf(x));
      for (let x = X1; x >= X0; x -= 10) ctx.lineTo(x, surf(x) + D);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.translate(dx, dy);
    if (s > 0) {
      ctx.translate(X1, surf(X1));
      ctx.rotate(s * 0.12);
      ctx.translate(-X1, -surf(X1));
    }
    ctx.fillStyle = '#a9845a';
    ctx.beginPath();
    for (let x = X0; x <= X1; x += 10) ctx.lineTo(x, surf(x));
    for (let x = X1; x >= X0; x -= 10) ctx.lineTo(x, surf(x) + D);
    ctx.closePath();
    ctx.fill();
    // water-saturated lower part of the soil
    const m = clamp(st.rain / 100, 0, 1);
    if (m > 0.05) {
      ctx.fillStyle = withAlpha('#4dabf7', 0.45);
      ctx.beginPath();
      for (let x = X0; x <= X1; x += 10) ctx.lineTo(x, surf(x) + D * (1 - m));
      for (let x = X1; x >= X0; x -= 10) ctx.lineTo(x, surf(x) + D);
      ctx.closePath();
      ctx.fill();
    }
    // trees with roots reaching into the soil
    const nT = Math.round(st.veg / 12);
    for (let k = 0; k < nT; k++) {
      const x = X0 + 18 + (k + 0.5) * ((X1 - X0 - 36) / Math.max(1, nT));
      const y0 = surf(x);
      ctx.strokeStyle = '#6b4f2a';
      ctx.lineWidth = 1.5;
      for (const o of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x + o, y0 + D * 0.8);
        ctx.stroke();
      }
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 - 30);
      ctx.stroke();
      ell(x, y0 - 42, 15, 17, '#2f9e44');
    }
    // slip surface
    ctx.strokeStyle = F < 1 ? '#c92a2a' : F < 1.3 ? '#e67700' : withAlpha('#343a40', 0.5);
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = X0; x <= X1; x += 10) ctx.lineTo(x, surf(x) + D);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    text('Possible slip surface', X1 - 6 + dx, surf(X1 - 6) + D + 22 + dy, 11, '#343a40', 'right', 750);
    if (m > 0.05 && s < 0.3) text('Water-filled soil', X0 - 6, surf(X0) + D * (1 - m / 2) + 4, 10.5, '#1864ab', 'right', 750);
    // pull of gravity split into down-slope and into-slope parts
    const cx = (X0 + X1) / 2 + dx;
    const cy = surf((X0 + X1) / 2) + D / 2 + dy;
    const arrow = (x1: number, y1: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      const a = Math.atan2(y1 - cy, x1 - cx);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4));
      ctx.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4));
      ctx.closePath();
      ctx.fill();
    };
    const L = 70;
    arrow(cx, cy + L, '#343a40');
    arrow(cx + L * Math.sin(th) * Math.cos(ang), cy + L * Math.sin(th) * Math.sin(ang), '#c92a2a');
    text('Gravity', cx - 8, cy + L * 0.6, 10.5, '#343a40', 'right', 750);
    text('Down-slope pull', cx + L * Math.sin(th) * Math.cos(ang) + 6, cy + L * Math.sin(th) * Math.sin(ang) + 14, 10.5, '#c92a2a', 'left', 750);
  }
  function drawAgentInfo(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    let y = B.y + 22;
    const line = (s: string, col = pal['text-muted'], px = 11.5, wt = 650) => {
      y = wrap(s, B.x + 12, y, B.w - 24, px, col, wt, B.y + B.h - 6);
    };
    if (st.agent === 'wind') {
      const m = windMode();
      line('Wind erosion', pal['sim-text'], 12.5, 800);
      line(`Wind ${st.wind} m/s, grains ${st.grain} mm: ${m}.`, pal.accent, 12, 750);
      line('Dust (< 0.07 mm) is lifted high in suspension and can cross oceans. Sand bounces in short hops (saltation), and coarser grains roll and slide (creep). Pebbles only move in storms.');
      line('Vegetation slows the wind at ground level and binds the soil, so planting is the main defence against wind erosion. The finest sand moves most easily: smaller dust grains stick together, and larger grains are too heavy.');
    } else if (st.agent === 'glacier') {
      const u = glacierSpeed();
      line('Glacial erosion', pal['sim-text'], 12.5, 800);
      line(`Ice flow ≈ ${u < 1 ? u.toFixed(2) : u.toFixed(0)} m per year (deformation only)`, pal.accent, 12, 750);
      line('Ice deforms slowly under its own weight. Glen’s flow law gives a surface speed u = (2A/4)(ρg sinθ)³H⁴, so doubling the thickness H makes the ice flow 16 times faster.');
      line('Glaciers pluck blocks from the bed and grind it with embedded rock (abrasion), carving U-shaped valleys. They carry every size of debris together and drop it as unsorted till in moraines when the ice melts. Warmer air makes the snout retreat.');
    } else {
      const F = factorOfSafety();
      line('Mass movement (gravity)', pal['sim-text'], 12.5, 800);
      line(`Factor of safety: ${F.toFixed(2)} ${F < 1 ? '→ landslide!' : F < 1.3 ? '→ marginal' : '→ stable'}`, F < 1 ? pal.danger : F < 1.3 ? pal.warning : pal.success, 12, 750);
      line('The factor of safety compares the forces holding the soil (friction and root cohesion) with the pull of gravity down the slope. Below 1, the slope fails.');
      line('Steeper slopes, water in the soil (which pushes the grains apart and reduces friction) and the loss of vegetation (roots add cohesion) all lower it. Slower forms include soil creep and rockfall.');
    }
  }

  /* ======================= Landforms view ======================= */
  const fLayout = () =>
    portrait()
      ? { a: { x: 14, y: 104, w: 652, h: 270 }, b: { x: 14, y: 384, w: 652, h: 346 }, info: { x: 14, y: 740, w: 652, h: 248 } }
      : st.split
        ? { a: { x: 14, y: 70, w: 380, h: 300 }, b: { x: 404, y: 70, w: 582, h: 384 }, info: { x: 14, y: 380, w: 380, h: 206 } }
        : { a: null, b: { x: 14, y: 70, w: 620, h: 516 }, info: { x: 646, y: 70, w: 340, h: 516 } };
  function drawLandforms() {
    const L = fLayout();
    const show = (B: { x: number; y: number; w: number; h: number }, tt: number, label: string) => {
      panel(B.x, B.y, B.w, B.h, pal['surface-2']);
      small = B.w < 500 || B.h < 300;
      fit(B, 600, 400, 10);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 600, 400);
      ctx.clip();
      ({ delta: formDelta, fan: formFan, meander: formMeander, coast: formCoast, dunes: formDunes, valley: formValley })[st.form](tt);
      ctx.restore();
      leave();
      pill(label, B.x + 12, B.y + 22, 'left', 11.5, label.startsWith('Before') ? pal['text-muted'] : pal.accent);
    };
    if (L.a && (st.split || portrait())) show(L.a, 0, 'Before');
    show(L.b, ft, `After ${Math.round(ft * 100)}% of the time`);
    const F = FORMS[st.form];
    const I = L.info;
    panel(I.x, I.y, I.w, I.h);
    let y = text2(F.name, I.x + 12, I.y + 22);
    y = wrap(`Time scale: ${F.time}`, I.x + 12, y, I.w - 24, 11, pal.accent, 700);
    wrap(F.text, I.x + 12, y + 2, I.w - 24, 11, pal['text-muted'], 600, I.y + I.h - 6);
  }
  let small = false;
  /** Caption under a landform drawing (left out in the small Before panel). */
  const cap = (s: string, color = '#343a40') => {
    if (small) return;
    let px = 11.5;
    ctx.font = fs(px, 750);
    const tw = ctx.measureText(s).width;
    if (tw > 570) px *= 570 / tw;
    ctx.font = fs(px, 750);
    const w = ctx.measureText(s).width + 16 / cur;
    ctx.fillStyle = withAlpha('#ffffff', 0.85);
    ctx.beginPath();
    ctx.roundRect(300 - w / 2, 372, w, 22, 11);
    ctx.fill();
    text(s, 300, 388, px, color, 'center', 750);
  };
  const text2 = (s: string, x: number, y: number) => {
    text(s, x, y, 12.5, pal['sim-text'], 'left', 800);
    return y + 20 / cur;
  };
  const sea = (y0: number) => {
    ctx.fillStyle = '#a5d8ff';
    ctx.fillRect(0, y0, 600, 400 - y0);
  };
  const land = () => {
    ctx.fillStyle = '#b2f2bb';
    ctx.fillRect(0, 0, 600, 400);
  };
  function formDelta(tt: number) {
    land();
    sea(230);
    const supply = st.supply / 100;
    const wave = st.wave / 100;
    const area = tt * supply;
    const r = 30 + 170 * Math.sqrt(area);
    const fingers = wave < supply * 0.6;
    ctx.fillStyle = '#e9c46a';
    if (fingers) {
      for (let k = -2; k <= 2; k++) {
        const a = Math.PI / 2 + k * 0.38;
        ctx.save();
        ctx.translate(300, 230);
        ctx.rotate(a - Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, r * 0.5, 18 + 20 * area, r * (0.6 + 0.12 * Math.abs(k % 2)), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(300, 230, r * (1 + wave), r * 0.55 * (1 - wave * 0.4), 0, 0, Math.PI);
      ctx.fill();
    }
    // river and distributaries
    ctx.strokeStyle = '#4dabf7';
    ctx.lineWidth = 6 + st.flow / 15;
    ctx.beginPath();
    ctx.moveTo(300, 0);
    ctx.quadraticCurveTo(280, 120, 300, 230);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let k = -2; k <= 2; k++) {
      const a = Math.PI / 2 + k * 0.38;
      ctx.beginPath();
      ctx.moveTo(300, 230);
      ctx.lineTo(300 + Math.cos(a) * r * (fingers ? 1.05 : 0.5), 230 + Math.sin(a) * r * (fingers ? 1.05 : 0.5));
      ctx.stroke();
    }
    cap(fingers ? 'River-dominated (bird’s-foot) delta' : 'Wave-dominated (arc) delta', '#1864ab');
  }
  function formFan(tt: number) {
    land();
    ctx.fillStyle = '#868e96';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(600, 0);
    ctx.lineTo(600, 90);
    for (let x = 600; x >= 0; x -= 20) ctx.lineTo(x, 90 + 15 * Math.sin(x / 40));
    ctx.closePath();
    ctx.fill();
    const vol = tt * (st.supply / 100) * (0.5 + st.flow / 100);
    const r = 20 + 260 * Math.sqrt(vol);
    const g = ctx.createRadialGradient(300, 95, 5, 300, 95, r);
    g.addColorStop(0, '#a1887f');
    g.addColorStop(1, '#e9c46a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(300, 95);
    ctx.arc(300, 95, r, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4dabf7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(300, 0);
    ctx.lineTo(300, 95);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) {
      const a = 0.25 * Math.PI + k * 0.125 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(300, 95);
      ctx.lineTo(300 + Math.cos(a) * r * 0.9, 95 + Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    cap('Coarse gravel near the apex, finer sand at the edge');
  }
  function formMeander(tt: number) {
    land();
    const lowSlope = 1 - st.wave / 100; // the third slider is the valley slope for meanders
    const amp = 12 + 105 * tt * (0.3 + 0.7 * lowSlope) * (0.5 + st.flow / 100);
    const k = (Math.PI * 4) / 600;
    const cut = amp > 95; // the neck of the second bend is cut through
    const cutW = (x: number) => (cut ? 0.85 * Math.exp(-(((x - 225) / 55) ** 2)) : 0);
    const yAt = (x: number) => 200 + amp * (1 - cutW(x)) * Math.sin(k * x);
    // floodplain
    ctx.fillStyle = '#d3f9d8';
    ctx.fillRect(0, 200 - amp - 40, 600, 2 * amp + 80);
    // point bars on the inside of each bend, cut banks on the outside
    for (let n = 0; n < 4; n++) {
      const x = 75 + 150 * n;
      if (cut && n === 1) continue;
      const sgn = Math.sin(k * x);
      const y = yAt(x);
      ell(x, y - sgn * (10 + 6 * tt), 26 + amp * 0.35, 6 + amp * 0.12, '#e9c46a');
      ctx.strokeStyle = '#c92a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + sgn * 4, 24 + amp * 0.3, 8 + amp * 0.1, 0, sgn > 0 ? 0.15 * Math.PI : 1.15 * Math.PI, sgn > 0 ? 0.85 * Math.PI : 1.85 * Math.PI);
      ctx.stroke();
    }
    if (cut) {
      // the abandoned loop becomes an oxbow lake
      ctx.strokeStyle = '#74c0fc';
      ctx.lineWidth = 10;
      ctx.beginPath();
      for (let x = 160; x <= 290; x += 4) ctx.lineTo(x, 200 + amp * Math.sin(k * x));
      ctx.stroke();
      text('Oxbow lake', 225, 200 - amp - 18, 11.5, '#1864ab', 'center', 750);
    }
    ctx.strokeStyle = '#1c7ed6';
    ctx.lineWidth = 7 + st.flow / 20;
    ctx.beginPath();
    for (let x = -10; x <= 610; x += 4) ctx.lineTo(x, yAt(x));
    ctx.stroke();
    if (!small && amp > 40) {
      text('Cut bank (erosion)', 375, 200 + amp + 30, 10.5, '#c92a2a', 'center', 750);
      text('Point bar (deposition)', 375, 200 + amp - 30 - 6 * tt - amp * 0.12, 10.5, '#8d6e00', 'center', 750);
    }
    cap('Outside of each bend: erosion. Inside: deposition.');
  }
  function formCoast(tt: number) {
    sea(0);
    const retreat = tt * (st.wave / 100) * 60;
    ctx.fillStyle = '#b2f2bb';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 160);
    ctx.lineTo(220 - retreat, 160);
    ctx.lineTo(240 - retreat, 260 - retreat);
    ctx.lineTo(320, 250 - retreat);
    ctx.lineTo(330, 110);
    ctx.lineTo(600, 110);
    ctx.lineTo(600, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(0, 150, 225 - retreat, 14);
    const spit = tt * (st.supply / 100) * (0.4 + st.wave / 100) * 260;
    ctx.beginPath();
    ctx.moveTo(320, 250 - retreat);
    ctx.quadraticCurveTo(330 + spit * 0.6, 270 - retreat, 330 + spit, 230 - retreat - spit * 0.15);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#e9c46a';
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const x = 40 + k * 90;
      ctx.strokeStyle = withAlpha('#ffffff', 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 360);
      ctx.lineTo(x + 40, 320);
      ctx.stroke();
    }
    cap('Waves arrive at an angle → longshore drift builds a spit', '#1864ab');
    if (retreat > 5) text('Cliff retreats', 230 - retreat, 290 - retreat, 10.5, '#c92a2a', 'center', 750);
  }
  function formDunes(tt: number) {
    ctx.fillStyle = '#fff4e6';
    ctx.fillRect(0, 0, 600, 400);
    const shift = tt * Math.max(0, st.flow - 15) * 3;
    const lots = st.supply > 60;
    ctx.strokeStyle = '#b08968';
    ctx.lineWidth = 1.5;
    if (lots) {
      // long transverse ridges at right angles to the wind, steep slip face downwind
      for (let k = 0; k < 6; k++) {
        const x = ((40 + k * 105 + shift) % 680) - 40;
        const wig = (y: number) => 10 * Math.sin(y / 40 + k);
        ctx.fillStyle = '#e9c46a';
        ctx.beginPath();
        for (let y = 20; y <= 360; y += 20) ctx.lineTo(x + wig(y), y);
        for (let y = 360; y >= 20; y -= 20) ctx.lineTo(x + 40 + wig(y), y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c99a4a';
        ctx.beginPath();
        for (let y = 20; y <= 360; y += 20) ctx.lineTo(x + 40 + wig(y), y);
        for (let y = 360; y >= 20; y -= 20) ctx.lineTo(x + 52 + wig(y), y);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // barchans: crescents with horns pointing downwind; small ones move fastest
      for (let k = 0; k < 6; k++) {
        const R = 22 + rnd(k + 1) * 22;
        const x = ((80 + rnd(k) * 440 + (shift * 40) / R) % 680) - 40;
        const y = 60 + ((k * 53) % 280);
        ctx.fillStyle = '#e9c46a';
        ctx.beginPath();
        ctx.arc(x, y, R, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.quadraticCurveTo(x + R * 0.9, y - R * 1.05, x + R * 1.1, y - R * 0.95);
        ctx.quadraticCurveTo(x + R * 0.2, y - R * 0.55, x + R * 0.25, y);
        ctx.quadraticCurveTo(x + R * 0.2, y + R * 0.55, x + R * 1.1, y + R * 0.95);
        ctx.quadraticCurveTo(x + R * 0.9, y + R * 1.05, x, y + R);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#868e96';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(14, 110 + k * 90);
      ctx.lineTo(54, 110 + k * 90);
      ctx.lineTo(46, 104 + k * 90);
      ctx.moveTo(54, 110 + k * 90);
      ctx.lineTo(46, 116 + k * 90);
      ctx.stroke();
    }
    if (!small) text('Wind', 34, 98, 10.5, '#495057', 'center', 750);
    cap(lots ? 'Lots of sand: transverse dune ridges' : 'Little sand: crescent-shaped barchans, horns pointing downwind');
  }
  function formValley(tt: number) {
    ctx.fillStyle = '#e7f5ff';
    ctx.fillRect(0, 0, 600, 400);
    const glacier = st.wave > 50; // the third slider picks river or glacier
    const hard = st.supply / 100; // the second slider is rock hardness for valleys
    const vProf = (x: number, d: number, w: number) => 70 + d * Math.max(0, 1 - Math.abs(x - 300) / w);
    let prof: (x: number) => number;
    let label: string;
    if (glacier) {
      // a glacier moves into an existing V-shaped river valley and widens and deepens it into a U
      const dU = 150 + 90 * (st.flow / 100);
      const wU = 190;
      const uProf = (x: number) => 70 + dU * Math.max(0, 1 - (Math.abs(x - 300) / wU) ** 4);
      prof = (x) => lerp(vProf(x, 140, 190), uProf(x), sstep(0, 1, tt));
      label = tt < 0.05 ? 'A river valley before glaciation (V-shaped)' : 'U-shaped glacial valley';
    } else {
      const d = 40 + 230 * tt * (st.flow / 100 + 0.3);
      const w = 40 + 220 * (1 - hard) + d * 0.25;
      prof = (x) => vProf(x, Math.min(d, 300), w);
      label = hard > 0.7 && tt > 0.3 ? 'Deep, steep-walled canyon in hard rock' : 'V-shaped river valley';
    }
    // rock layers
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 400);
    for (let x = 0; x <= 600; x += 5) ctx.lineTo(x, prof(x));
    ctx.lineTo(600, 400);
    ctx.closePath();
    ctx.fillStyle = '#a1887f';
    ctx.fill();
    ctx.clip();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#8d6e63' : '#bcaaa4';
      ctx.fillRect(0, 110 + k * 50, 600, 18);
    }
    ctx.restore();
    if (glacier && tt > 0.02 && tt < 0.98) {
      // the glacier fills the valley while it is being carved
      const top = 70 + 25 * (1 - tt);
      ctx.fillStyle = withAlpha('#d0ebff', 0.95);
      ctx.strokeStyle = '#74c0fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let x = 0; x <= 600; x += 5) {
        if (prof(x) <= top) continue;
        if (!started) ctx.moveTo(x, top);
        started = true;
        ctx.lineTo(x, prof(x));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!small) text('Glacier ice', 300, top + 30, 11.5, '#1864ab', 'center', 750);
    } else {
      ctx.fillStyle = '#4dabf7';
      const yb = prof(300);
      ctx.fillRect(290, yb - 6, 20, 6);
      if (!small) text(glacier ? 'A small river is left in the U-shaped valley' : 'River', 300, yb + 18, 10.5, '#1864ab', 'center', 750);
    }
    cap(label);
  }

  /* ======================= 3D landscape ======================= */
  let three: ThreeScene | null = null;
  let threeFailed = false;
  let loading3D = false;
  let update3D = () => {};
  let positionLabels = () => {};
  async function ensure3D() {
    if (three || threeFailed || loading3D) return;
    loading3D = true;
    sim.setLoading('Loading the 3D landscape…');
    try {
      const asp = container.clientWidth / Math.max(1, container.clientHeight);
      const back = clamp(Math.pow(asp, -1), 1, 1.45);
      three = await createThreeScene(container, {
        label: 'A 3D landscape with mountains, a glacial valley, hills, a river, an alluvial fan, dunes, a sea cliff and a delta. Drag to rotate; tap a landform.',
        camera: { position: [8.5 * back, 8.5 * back, 10.5 * back], target: [0, 0, 0.3] },
        minDistance: 4,
        maxDistance: 30,
        onFrame: () => {
          update3D();
          positionLabels();
        },
      });
      build3D(three);
    } catch (err) {
      console.error(err);
      threeFailed = true;
      container.innerHTML = '<p class="ls-no3d">3D graphics are not available in this browser, so the landscape cannot be shown. The other views still work.</p>';
    } finally {
      loading3D = false;
      sim.setLoading(null);
      three?.setAnimating(st.view === '3d');
      sim.requestRender();
    }
  }
  function build3D(view: ThreeScene) {
    const { THREE, scene, renderer, camera } = view;
    renderer.localClippingEnabled = true;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1);
    geo.rotateX(-Math.PI / 2);
    const colors = new Float32Array(N * N * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.3); // keeps z ≤ 0.3
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    const seaMat = new THREE.MeshStandardMaterial({ color: '#4dabf7', transparent: true, opacity: 0.78, roughness: 0.3, side: THREE.DoubleSide });
    const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), seaMat);
    seaMesh.rotateX(-Math.PI / 2);
    seaMesh.position.y = 0;
    scene.add(seaMesh);
    // side walls, so the landscape reads as a block of ground
    const edge: number[] = [];
    for (let i = 0; i < N; i++) edge.push(i); // north (z = -5)
    for (let j = 0; j < N; j++) edge.push(j * N + N - 1); // east
    for (let i = N - 1; i >= 0; i--) edge.push((N - 1) * N + i); // south
    for (let j = N - 1; j >= 0; j--) edge.push(j * N); // west
    const skirtPos = new Float32Array(edge.length * 6);
    const skirtIdx: number[] = [];
    for (let e = 0; e < edge.length - 1; e++) {
      const a = e * 2;
      skirtIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const skirtGeo = new THREE.BufferGeometry();
    skirtGeo.setAttribute('position', new THREE.BufferAttribute(skirtPos, 3));
    skirtGeo.setIndex(skirtIdx);
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#8d6e52', roughness: 1, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(skirtGeo, skirtMat));
    const waterPos = new Float32Array(edge.length * 6);
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.BufferAttribute(waterPos, 3));
    waterGeo.setIndex(skirtIdx);
    const waterMesh = new THREE.Mesh(waterGeo, seaMat);
    scene.add(waterMesh);
    const BOT = -1.3;
    const writeSkirt = () => {
      edge.forEach((k, e) => {
        const x = xOf(k % N);
        const z = xOf((k / N) | 0);
        skirtPos.set([x, h[k], z, x, BOT, z], e * 6);
        waterPos.set([x, Math.max(0, h[k]), z, x, h[k], z], e * 6);
      });
      skirtGeo.attributes.position.needsUpdate = true;
      waterGeo.attributes.position.needsUpdate = true;
      waterGeo.computeVertexNormals();
      skirtGeo.computeVertexNormals();
    };
    // cross-section face (rebuilt when the terrain changes)
    let face: T.Group | null = null;
    const VEX = 1;
    const c = new THREE.Color();
    const colorAt = (k: number, x: number, z: number) => {
      const hh = h[k];
      const d = hh - h0[k];
      if (st.showChange) {
        if (d < -0.02) return c.set('#ffa94d').lerp(new THREE.Color('#c92a2a'), clamp(-d * 5, 0, 1));
        if (d > 0.005) return c.set('#4dabf7').lerp(new THREE.Color('#1864ab'), clamp(d * 8, 0, 1));
        return c.set('#ced4da');
      }
      const lf = landformAt(x, z, h0[k]);
      if (hh <= 0.02) return c.set(lf === 'delta' || lf === 'beach' ? '#e9c46a' : '#c9b38a');
      if (acc[k] > 160 * st.rain3 && hh > 0.03 && (lf === 'river' || lf === 'hills' || lf === 'glacial' || lf === 'peak' || lf === 'fan')) return c.set('#339af0');
      const nb = k + 1 < N * N ? h[k + 1] : hh;
      const nz = k + N < N * N ? h[k + N] : hh;
      const slope = Math.max(Math.abs(nb - hh), Math.abs(nz - hh)) * (N / SIZE);
      if (hh > 1.75) return c.set('#f8f9fa');
      if (slope > 0.9) return c.set('#868e96');
      if (lf === 'dunes' || lf === 'beach' || lf === 'delta') return c.set('#e9c46a');
      if (lf === 'fan') return c.set('#bfa071');
      if (d > 0.01) return c.set('#d9b77e');
      return c.set(hh > 1.2 ? '#7a8f4a' : '#74b816').lerp(new THREE.Color('#2f9e44'), st.veg3 / 200);
    };
    const writeTerrain = () => {
      const pos = geo.attributes.position as T.BufferAttribute;
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const k = j * N + i;
          pos.setY(k, h[k] * VEX);
          const col = colorAt(k, xOf(i), xOf(j));
          colors[k * 3] = col.r;
          colors[k * 3 + 1] = col.g;
          colors[k * 3 + 2] = col.b;
        }
      pos.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.computeVertexNormals();
      writeSkirt();
      seaMesh.visible = waterMesh.visible = !st.showChange;
      if (st.section) buildFace();
      view.requestRender();
    };
    const buildFace = () => {
      if (face) scene.remove(face);
      face = new THREE.Group();
      const z0 = 0.3;
      const j = Math.round(((z0 + SIZE / 2) / SIZE) * (N - 1));
      const prof = (arr: Float32Array) => Array.from({ length: N }, (_, i) => arr[j * N + i]);
      const top = prof(h);
      const bed = prof(h0).map((v, i) => Math.min(v, top[i]));
      const mk = (pts: Pt[], col: string) => {
        const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ShapeGeometry(shape);
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide }));
        m.position.z = z0;
        face!.add(m);
      };
      // bedrock in three layers
      const layer = (a: number, b: number, col: string) => {
        const pts: Pt[] = [];
        for (let i = 0; i < N; i++) pts.push([xOf(i), Math.min(bed[i], bed[i] - a)]);
        for (let i = N - 1; i >= 0; i--) pts.push([xOf(i), Math.min(bed[i] - a + 0.001, bed[i] - b)]);
        mk(pts, col);
      };
      layer(0, 0.4, '#b08968');
      layer(0.4, 1.0, '#9c8f7a');
      const pts: Pt[] = [];
      for (let i = 0; i < N; i++) pts.push([xOf(i), bed[i] - 1.0]);
      for (let i = N - 1; i >= 0; i--) pts.push([xOf(i), BOT]);
      mk(pts, '#6c757d');
      // new sediment deposited on top
      const dep: Pt[] = [];
      for (let i = 0; i < N; i++) dep.push([xOf(i), Math.max(top[i], bed[i])]);
      for (let i = N - 1; i >= 0; i--) dep.push([xOf(i), bed[i]]);
      mk(dep, '#f2d79b');
      scene.add(face);
    };
    const applySection = () => {
      mat.clippingPlanes = st.section ? [cutPlane] : [];
      seaMat.clippingPlanes = st.section ? [cutPlane] : [];
      skirtMat.clippingPlanes = st.section ? [cutPlane] : [];
      skirtMat.needsUpdate = true;
      mat.needsUpdate = true;
      seaMat.needsUpdate = true;
      if (st.section) buildFace();
      else if (face) {
        scene.remove(face);
        face = null;
      }
      view.requestRender();
    };
    sectionRef = applySection;
    redrawRef = () => {
      terrainDirty = true;
    };
    // labels
    const layer = document.createElement('div');
    layer.className = 'earth-labels';
    layer.setAttribute('aria-hidden', 'true');
    container.appendChild(layer);
    const spots: [LandformId, number, number][] = [['peak', 0.8, -3.6], ['glacial', -2.6, -3.2], ['hills', -0.8, 0.4], ['river', riverX(0.8), 0.8], ['fan', 3.1, -1.0], ['dunes', -3.4, 0.8], ['cliff', 3.7, coastZ(3.7) - 0.1], ['delta', DELTA[0], DELTA[1] + 0.5]];
    const els = spots.map(([id]) => {
      const el = document.createElement('span');
      el.textContent = LANDFORMS[id].name;
      layer.appendChild(el);
      return el;
    });
    const tmp = new THREE.Vector3();
    positionLabels = () => {
      spots.forEach(([, x, z], k) => {
        const i = Math.round(((x + SIZE / 2) / SIZE) * (N - 1));
        const j = Math.round(((z + SIZE / 2) / SIZE) * (N - 1));
        tmp.set(x, Math.max(0, h[j * N + i]) + 0.35, z).project(camera);
        els[k].style.display = st.labels && tmp.z < 1 ? '' : 'none';
        els[k].style.transform = `translate(${((tmp.x + 1) / 2) * container.clientWidth}px, ${((1 - tmp.y) / 2) * container.clientHeight}px) translate(-50%, -50%)`;
      });
    };
    update3D = () => {
      if (terrainDirty) {
        terrainDirty = false;
        writeTerrain();
      }
    };
    view.onPick(
      () => [mesh],
      (hit, at) => {
        if (!hit) {
          sim.hideTooltip();
          return;
        }
        const i = Math.round(((hit.point.x + SIZE / 2) / SIZE) * (N - 1));
        const j = Math.round(((hit.point.z + SIZE / 2) / SIZE) * (N - 1));
        const k = clamp(j, 0, N - 1) * N + clamp(i, 0, N - 1);
        const lf = landformAt(hit.point.x, hit.point.z, h0[k]);
        const d = (h[k] - h0[k]) * 1000;
        const L = LANDFORMS[lf];
        const ch = Math.abs(d) < 1 ? ' Almost no change so far.' : ` So far ${Math.abs(d).toFixed(0)} m has been ${d < 0 ? 'eroded' : 'deposited'} here.`;
        sim.showTooltip(at.x, at.y, L.name, `${L.text} Main process: ${L.process.toLowerCase()}.${years ? ch : ''}`);
        lastPicked = lf;
        sim.requestRender();
      },
      (hit) => !st.section || hit.point.z <= 0.3,
    );
    writeTerrain();
  }
  let sectionRef = () => {};
  let redrawRef = () => {};
  let lastPicked: LandformId | null = null;

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    if (st.view !== '3d') {
      const { k, ox, oy } = tf();
      K = k;
      cur = k;
      frame = { x: 0, y: 0, s: 1 };
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      if (st.view === 'weather') drawWeather();
      else if (st.view === 'erosion') drawErosion();
      else drawLandforms();
      ctx.restore();
    }
    updateUi();
  }

  /* ======================= Readouts ======================= */
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = lastMsg;
    if (st.view === '3d') {
      let eroded = 0;
      let deposited = 0;
      let maxCut = 0;
      for (let k = 0; k < N * N; k++) {
        const d = h[k] - h0[k];
        if (d < 0) eroded -= d;
        else deposited += d;
        maxCut = Math.max(maxCut, -d);
      }
      const cell = (SIZE / (N - 1)) ** 2; // km² per cell (1 unit = 1 km)
      r('r1', 'Model time', `${years.toLocaleString('en')} years`);
      r('r2', 'Rainfall · vegetation', `${st.rain3.toFixed(1)}× · ${st.veg3}%`);
      r('r3', 'Rock eroded', `${(eroded * cell).toFixed(2)} km³`);
      r('r4', 'Sediment deposited', `${(deposited * cell).toFixed(2)} km³`);
      r('r5', 'Deepest erosion', `${(maxCut * 1000).toFixed(0)} m`);
      r('r6', 'Selected landform', lastPicked ? LANDFORMS[lastPicked].name : 'Tap the landscape');
      note ||= threeFailed ? '3D graphics are not available. The other views still work.' : 'Press Start to let rain and gravity reshape the landscape over hundreds of thousands of years. Turn on “Show change” to see where rock was eroded (red) and where sediment was deposited (blue).';
      sim.setBadge(years ? `${(years / 1000).toFixed(0)}k years` : 'Year 0');
    } else if (st.view === 'weather') {
      const rates = weatherRates(st.climate, st.rock);
      const top = (Object.keys(rates) as ProcId[]).sort((a, b) => rates[b] - rates[a])[0];
      const c = st.climate;
      r('r1', 'Rock', ROCKS[st.rock].name);
      r('r2', 'Main process here', `${WEATHERING[top].name} (${WEATHERING[top].kind.toLowerCase()})`);
      r('r3', 'Freeze–thaw days a year', `${Math.round(365 * clamp(1 - Math.abs(c.temp) / Math.max(1, c.range / 2), 0, 1))}`);
      r('r4', 'Chemical speed-up', `${(2 ** ((c.temp - 15) / 10)).toFixed(2)}× (doubles every 10 °C)`);
      r('r5', 'Rain acidity', `pH ${c.ph.toFixed(1)}${c.ph < 5 ? ' (acid rain)' : ''}`, c.ph < 5 ? 'warn' : null);
      r('r6', 'Time', `${Math.round(wx.years).toLocaleString('en')} years`);
      note ||= `${WEATHERING[top].text} ${ROCKS[st.rock].text}`;
      sim.setBadge(WEATHERING[top].name);
      canvas.setAttribute('aria-label', `Weathering of ${ROCKS[st.rock].name}: the main process here is ${WEATHERING[top].name}.`);
    } else if (st.view === 'erosion') {
      if (st.agent === 'water') {
        r('r1', 'Agent', 'Running water');
        r('r2', 'Runoff speed', `${flowVelocity().toFixed(0)} cm/s`);
        r('r3', `${st.grain} mm grains`, waterMode(), waterMode() === 'eroded' ? 'warn' : null);
        r('r4', 'Soil loss (illustrative)', `${soilLoss().toFixed(1)} t/ha/yr`, soilLoss() > 20 ? 'bad' : null);
        r('r5', 'Slope · rain', `${st.slope}° · ${st.rain}%`);
        r('r6', 'Vegetation cover', `${st.veg}%`);
        note ||= 'Rain splashes soil loose and runoff carries it downhill. Faster water can pick up and carry bigger grains; where it slows, it drops them. Vegetation shields the ground and binds the soil.';
      } else if (st.agent === 'wind') {
        r('r1', 'Agent', 'Wind');
        r('r2', 'Wind speed', `${st.wind} m/s`);
        r('r3', `${st.grain} mm grains`, windMode());
        r('r4', 'Vegetation cover', `${st.veg}%`);
        r('r5', 'Moves most easily', 'Fine sand (≈ 0.1 mm)');
        r('r6', 'Landforms made', 'Dunes, loess, desert pavement');
      } else if (st.agent === 'glacier') {
        const u = glacierSpeed();
        r('r1', 'Agent', 'Glacier ice');
        r('r2', 'Ice speed (deformation)', `${u < 1 ? u.toFixed(2) : u.toFixed(0)} m/yr`);
        r('r3', 'Ice thickness · slope', `${st.ice} m · ${st.slope}°`);
        r('r4', 'Air temperature', `${st.temp} °C`);
        r('r5', 'Erosion by', 'Plucking and abrasion');
        r('r6', 'Deposits', 'Moraines of unsorted till');
      } else {
        const F = factorOfSafety();
        r('r1', 'Agent', 'Gravity (mass movement)');
        r('r2', 'Factor of safety', F.toFixed(2), F < 1 ? 'bad' : F < 1.3 ? 'warn' : 'ok');
        r('r3', 'Slope', `${st.slope}°`);
        r('r4', 'Water in the soil', `${st.rain}%`);
        r('r5', 'Root cohesion', `${(0.5 + 9 * (st.veg / 100)).toFixed(1)} kPa`);
        r('r6', 'State', ez.slide > 0.05 ? 'Landslide!' : F < 1.3 ? 'Marginal' : 'Stable', ez.slide > 0.05 ? 'bad' : null);
      }
      sim.setBadge({ water: 'Running water', wind: 'Wind', glacier: 'Glacier', gravity: 'Gravity' }[st.agent]);
      canvas.setAttribute('aria-label', `Erosion by ${st.agent}.`);
    } else {
      const F = FORMS[st.form];
      r('r1', 'Landform', F.name);
      r('r2', 'Time scale', F.time);
      r('r3', 'Progress', `${Math.round(ft * 100)}%`);
      r('r4', 'Flow / wind', `${st.flow}%`);
      r('r5', st.form === 'valley' ? 'Rock hardness' : 'Sediment supply', `${st.supply}%`);
      r('r6', st.form === 'valley' ? 'Agent' : st.form === 'meander' ? 'Valley slope' : 'Wave energy', st.form === 'valley' ? (st.wave > 50 ? 'Glacier' : 'River') : `${st.wave}%`);
      note ||= `${F.text} Press Start to run time, or drag the time slider; compare the before and after views.`;
      sim.setBadge(F.name);
      canvas.setAttribute('aria-label', `${F.name}, ${Math.round(ft * 100)} percent through the time span.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.dataset.lsView = st.view === '3d' ? '3d' : '2d';
    for (const v of ['3d', 'weather', 'erosion', 'landforms']) ui.showWhen(`[data-only="${v}"]`, st.view === v);
    const show: Record<AgentId, string[]> = { water: ['rain', 'slope', 'veg', 'grain'], wind: ['wind', 'veg', 'grain'], glacier: ['slope', 'ice', 'temp'], gravity: ['slope', 'rain', 'veg'] };
    for (const k of ['rain', 'slope', 'veg', 'grain', 'wind', 'ice', 'temp']) ui.showWhen(`[data-ag="${k}"]`, st.view === 'erosion' && show[st.agent].includes(k));
    if (st.view === '3d') {
      void ensure3D();
      three?.setAnimating(true);
    } else three?.setAnimating(false);
  }
  const viewCtl = ui.choice<View>('ls-view', (v) => {
    st.view = v;
    lastMsg = '';
    sim.hideTooltip();
    showView();
    if ((v === 'weather' || v === 'erosion') && !sim.running) sim.play();
    sim.requestRender();
  });
  const rain3Ctl = ui.range('ls-rain3', (v) => `${v.toFixed(1)}×`, (v) => ((st.rain3 = v), redrawRef()));
  const veg3Ctl = ui.range('ls-veg3', (v) => `${v}%`, (v) => ((st.veg3 = v), redrawRef()));
  const changeCtl = ui.toggle('ls-change', (v) => ((st.showChange = v), redrawRef()));
  const sectionCtl = ui.toggle('ls-section', (v) => ((st.section = v), sectionRef()));
  const labelCtl = ui.toggle('ls-labels', (v) => ((st.labels = v), positionLabels()));
  root.querySelector('[data-regen]')?.addEventListener('click', () => {
    buildTerrain();
    terrainDirty = true;
    lastMsg = 'Fresh landscape.';
    sim.requestRender();
  });
  const climCtl = {
    temp: ui.range('ls-ctemp', (v) => `${v} °C`, (v) => setClim({ temp: v })),
    range: ui.range('ls-crange', (v) => `${v} °C`, (v) => setClim({ range: v })),
    water: ui.range('ls-cwater', (v) => `${v}%`, (v) => setClim({ water: v })),
    ph: ui.range('ls-cph', (v) => `pH ${v.toFixed(1)}`, (v) => setClim({ ph: v })),
    veg: ui.range('ls-cveg', (v) => `${v}%`, (v) => setClim({ veg: v })),
  };
  function setClim(p: Partial<Climate>) {
    Object.assign(st.climate, p);
    lastMsg = '';
    sim.requestRender();
  }
  const CLIMATES: Record<string, Climate> = {
    mountain: { temp: 1, range: 14, water: 70, ph: 5.6, veg: 10 },
    desert: { temp: 25, range: 28, water: 8, ph: 6.5, veg: 2 },
    tropics: { temp: 27, range: 8, water: 95, ph: 5.4, veg: 90 },
    forest: { temp: 10, range: 10, water: 70, ph: 5.2, veg: 85 },
    city: { temp: 12, range: 9, water: 60, ph: 4.3, veg: 10 },
  };
  root.querySelectorAll<HTMLButtonElement>('[data-clim]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = CLIMATES[b.dataset.clim!];
      for (const [k, v] of Object.entries(c)) climCtl[k as keyof Climate].set(v, false);
      setClim(c);
      wx.years = 0;
      wx.dmg = { ft: 0, thermal: 0, ox: 0, hydro: 0, diss: 0, roots: 0 };
      if (!sim.running) sim.play();
    }),
  );
  const rockCtl = ui.choice<RockId>('ls-rock', (v) => {
    st.rock = v;
    wx.years = 0;
    wx.dmg = { ft: 0, thermal: 0, ox: 0, hydro: 0, diss: 0, roots: 0 };
    sim.requestRender();
  });
  const agentCtl = ui.choice<AgentId>('ls-agent', (v) => {
    st.agent = v;
    // glaciers usually sit on gentler slopes than hillsides
    if (v === 'glacier' && st.slope > 10) eCtl.slope.set(6);
    ez.slide = 0;
    ez.soil = 0;
    lastMsg = '';
    showView();
    sim.requestRender();
  });
  const eCtl = {
    rain: ui.range('ls-rain', (v) => `${v}%`, (v) => ((st.rain = v), sim.requestRender())),
    slope: ui.range('ls-slope', (v) => `${v}°`, (v) => ((st.slope = v), sim.requestRender())),
    veg: ui.range('ls-veg', (v) => `${v}%`, (v) => ((st.veg = v), sim.requestRender())),
    grain: ui.range('ls-grain', (v) => `${(10 ** v).toPrecision(2)} mm`, (v) => ((st.grain = +(10 ** v).toPrecision(2)), sim.requestRender())),
    wind: ui.range('ls-wind', (v) => `${v} m/s`, (v) => ((st.wind = v), sim.requestRender())),
    ice: ui.range('ls-ice', (v) => `${v} m`, (v) => ((st.ice = v), sim.requestRender())),
    temp: ui.range('ls-temp', (v) => `${v} °C`, (v) => ((st.temp = v), sim.requestRender())),
  };
  const formSel = root.querySelector<HTMLSelectElement>('[data-form]')!;
  const onForm = (v: FormId) => {
    st.form = v;
    ft = 0.6;
    timeCtl.set(60, false);
    lastMsg = '';
    relabel();
    sim.requestRender();
  };
  formSel.addEventListener('change', () => onForm(formSel.value as FormId));
  const formCtl = {
    set(v: FormId, notify = true) {
      formSel.value = v;
      if (notify) onForm(v);
    },
  };
  const flowCtl = ui.range('ls-flow', (v) => `${v}%`, (v) => ((st.flow = v), sim.requestRender()));
  const supplyCtl = ui.range('ls-supply', (v) => `${v}%`, (v) => ((st.supply = v), sim.requestRender()));
  const waveCtl = ui.range('ls-wave', (v) => (st.form === 'valley' ? (v > 50 ? 'Glacier' : 'River') : `${v}%`), (v) => ((st.wave = v), sim.requestRender()));
  const timeCtl = ui.range('ls-time', (v) => `${v}%`, (v) => ((ft = v / 100), sim.requestRender()));
  const splitCtl = ui.toggle('ls-split', (v) => ((st.split = v), sim.requestRender()));
  /** The three landform sliders mean different things for different landforms. */
  function relabel() {
    const lab = (name: string, s: string) => {
      const el = root.querySelector(`label[for="ctl-${name}"]`);
      if (el) el.textContent = s;
    };
    const L: Record<FormId, [string, string, string]> = {
      delta: ['River flow', 'Sediment supply', 'Wave energy'],
      fan: ['Stream flow', 'Sediment supply', 'Wave energy (no effect)'],
      meander: ['River flow', 'Sediment supply', 'Valley slope'],
      coast: ['Wave height', 'Sand supply', 'Wave energy'],
      dunes: ['Wind strength', 'Sand supply', 'Wave energy (no effect)'],
      valley: ['Water or ice flow', 'Rock hardness', 'River ← → Glacier'],
    };
    const [a, b, c] = L[st.form];
    lab('ls-flow', a);
    lab('ls-supply', b);
    lab('ls-wave', c);
    waveCtl.set(st.wave, false);
  }

  /* ---------- challenges ---------- */
  const CH = [
    {
      q: 'Which landscape is most vulnerable to soil erosion?',
      opts: ['A steep, bare slope in heavy rain', 'A gentle forested slope in heavy rain', 'A flat grassy field in light rain'],
      ok: 0,
      why: 'Steep slopes make runoff faster, heavy rain gives it more energy, and bare soil has nothing to protect or bind it.',
      setup: () => setErosion('water', { rain: 90, slope: 30, veg: 0 }),
    },
    {
      q: 'How does vegetation affect soil erosion?',
      opts: ['It has no effect', 'It greatly reduces erosion', 'It increases erosion'],
      ok: 1,
      why: 'Plants intercept rain, slow runoff and bind soil with roots. In the model, cover reduces soil loss by more than 100 times.',
      setup: () => setErosion('water', { rain: 70, slope: 20, veg: 90 }),
    },
    {
      q: 'What happens when water flows down a steeper slope?',
      opts: ['It flows faster and can move larger grains', 'It flows slower', 'It drops all its sediment'],
      ok: 0,
      why: 'Steeper slopes speed the flow, and faster water can erode and carry coarser grains (see the Hjulström diagram).',
      setup: () => setErosion('water', { rain: 60, slope: 35, veg: 10, grain: 0 }),
    },
    {
      q: 'How does wind move fine sand compared with dust and pebbles?',
      opts: ['Sand is lifted high in suspension', 'Sand bounces along in saltation, dust is suspended and pebbles barely move', 'All sizes move the same way'],
      ok: 1,
      why: 'Dust stays aloft in suspension, sand hops along (saltation), and pebbles only creep in strong winds.',
      setup: () => setErosion('wind', { wind: 12, grain: -0.7, veg: 0 }),
    },
    {
      q: 'Where is a river most likely to deposit sediment?',
      opts: ['In a steep mountain gorge', 'Where it slows down, such as at the sea or on the inside of a bend', 'On the outside of a bend'],
      ok: 1,
      why: 'Deposition happens when the flow loses energy: at river mouths (deltas), where it leaves the mountains (fans) and on inner bends (point bars).',
      setup: () => {
        viewCtl.set('landforms');
        formCtl.set('delta');
      },
    },
  ];
  function setErosion(a: AgentId, p: Partial<{ rain: number; slope: number; veg: number; grain: number; wind: number }>) {
    viewCtl.set('erosion');
    agentCtl.set(a);
    for (const [k, v] of Object.entries(p)) (eCtl as Record<string, { set: (v: number) => void }>)[k].set(v);
  }
  const chQ = root.querySelector<HTMLElement>('[data-ch-q]')!;
  const chOpts = root.querySelector<HTMLElement>('[data-ch-opts]')!;
  const chFb = root.querySelector<HTMLElement>('[data-ch-fb]')!;
  let chIdx = 0;
  function showChallenge(i: number) {
    chIdx = i;
    const c = CH[i];
    chQ.textContent = `${i + 1}. ${c.q}`;
    chFb.textContent = '';
    chOpts.innerHTML = '';
    c.opts.forEach((o, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm';
      b.textContent = o;
      b.addEventListener('click', () => {
        chFb.textContent = `${k === c.ok ? 'Correct!' : 'Not quite.'} ${c.why} The simulator is now set up to show it.`;
        chFb.dataset.tone = k === c.ok ? 'ok' : 'bad';
        c.setup();
        if (!sim.running) sim.play();
      });
      chOpts.appendChild(b);
    });
  }
  root.querySelector('[data-ch-next]')?.addEventListener('click', () => showChallenge((chIdx + 1) % CH.length));
  showChallenge(0);

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, { rain3: 1, veg3: 30, showChange: false, section: false, labels: false, rock: 'granite', agent: 'water', rain: 50, slope: 15, veg: 30, grain: 0.3, wind: 12, ice: 200, temp: 0, form: 'meander', flow: 50, supply: 50, wave: 40, split: true });
      st.climate = { temp: 2, range: 14, water: 70, ph: 5.6, veg: 30 };
      rain3Ctl.set(1, false);
      veg3Ctl.set(30, false);
      changeCtl.set(false, false);
      sectionCtl.set(false, false);
      labelCtl.set(false, false);
      for (const [k, v] of Object.entries(st.climate)) climCtl[k as keyof Climate].set(v, false);
      rockCtl.set('granite', false);
      agentCtl.set('water', false);
      eCtl.rain.set(50, false);
      eCtl.slope.set(15, false);
      eCtl.veg.set(30, false);
      eCtl.grain.set(Math.log10(0.3), false);
      eCtl.wind.set(12, false);
      eCtl.ice.set(200, false);
      eCtl.temp.set(0, false);
      formCtl.set('meander', false);
      flowCtl.set(50, false);
      supplyCtl.set(50, false);
      waveCtl.set(40, false);
      timeCtl.set(60, false);
      splitCtl.set(true, false);
      ft = 0.6;
      wx.years = 0;
      wx.dmg = { ft: 0, thermal: 0, ox: 0, hydro: 0, diss: 0, roots: 0 };
      ez.slide = 0;
      ez.soil = 0;
      buildTerrain();
      terrainDirty = true;
      sectionRef();
      lastMsg = '';
      lastPicked = null;
      relabel();
      showChallenge(0);
      viewCtl.set(st.view, false);
      showView();
    },
  });

  buildTerrain();
  ft = 0.6;
  relabel();
  showView();
  sim.requestRender();
}
