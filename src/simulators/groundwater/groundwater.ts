/**
 * Groundwater lab, in four views:
 *   3d     – a block diagram of a landscape with soil, the unsaturated zone, the
 *            water table, an unconfined sand aquifer, a clay aquitard, a confined
 *            aquifer that reaches the surface on a hill (recharge area), bedrock,
 *            a river and three wells.
 *   pores  – porosity, specific yield and permeability of gravel, sand, silt,
 *            clay and fractured rock (Kozeny–Carman for grains, cubic law for
 *            fractures), with water soaking down two columns.
 *   flow   – the same cross-section as a 2D groundwater model: Dupuit flow in the
 *            unconfined aquifer and confined flow below, leakage through the
 *            aquitard, recharge, a river, a pumping well and Darcy’s law.
 *   plume  – a map of a contaminant plume: advection with the groundwater,
 *            dispersion, sorption (retardation) and breakdown.
 * The 3D and 2D cross-sections show one shared model, so changes in one appear in
 * the other.
 */
import type * as T from 'three';
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { font, withAlpha } from '../shared/draw';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { CONTAMINANTS, LAYERS, MATERIALS, type ContamId, type LayerId, type MatId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = '3d' | 'pores' | 'flow' | 'plume';
type Pt = [number, number];
type Box = { x: number; y: number; w: number; h: number };
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const sstep = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const fmtNum = (v: number, sig = 2) => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return Math.round(v).toLocaleString('en');
  if (a >= 0.01) return (+v.toPrecision(sig)).toString();
  const e = Math.floor(Math.log10(a));
  return `${(v / 10 ** e).toFixed(1)} × 10${sup(e)}`;
};
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const mL = (n: number) => (n * 1000 < 10 ? (n * 1000).toFixed(1) : Math.round(n * 1000).toString());
/** A fraction as a percentage with sensible precision. */
const pct = (v: number) => `${(v * 100).toFixed(v >= 0.1 ? 0 : v >= 0.01 ? 1 : 2)}%`;
const sup = (n: number) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const fmtTime = (s: number) => {
  if (s < 90) return `${Math.round(s)} seconds`;
  if (s < 5400) return `${Math.round(s / 60)} minutes`;
  if (s < 2 * 86400) return `${Math.round(s / 3600)} hours`;
  if (s < 60 * 86400) return `${Math.round(s / 86400)} days`;
  if (s < 2 * 3.156e7) return `${Math.round(s / (30.4 * 86400))} months`;
  return `${fmtNum(s / 3.156e7, 2)} years`;
};

/* ======================= Material properties ======================= */
export interface MatProps {
  n: number; // porosity
  sy: number; // specific yield
  K: number; // hydraulic conductivity, m/day
}
const SY0: Record<MatId, number> = { gravel: 0.24, sand: 0.27, silt: 0.08, clay: 0.03, fractured: 1 };
/**
 * Grains: porosity falls with poor sorting and compaction; K from the Kozeny–Carman
 * equation K = (ρg/μ) d² n³ / (180 (1 − n)²) using an effective (finer) grain size
 * for poorly sorted material. Clay is not described by Kozeny–Carman (its flat,
 * charged particles hold water), so a typical measured value is used instead.
 * Fractures: parallel-plate cubic law, K = (ρg/μ) b³ / (12 s), porosity = b / s.
 */
function matProps(m: MatId, sorting: number, compact: number, apMm = 0.2, spM = 0.5): MatProps {
  const RG_MU = 9.81e6; // ρg/μ for water at about 20 °C, 1/(m·s)
  if (m === 'fractured') {
    const b = apMm / 1000;
    const n = b / spM;
    return { n, sy: n, K: ((RG_MU * b ** 3) / (12 * spM)) * 86400 };
  }
  const M = MATERIALS[m];
  const n = M.n * (1 - 0.3 * sorting) * (1 - 0.45 * compact);
  const sy = Math.min(n * 0.9, SY0[m] * (1 - 0.45 * sorting) * (1 - 0.5 * compact));
  if (m === 'clay') return { n, sy, K: 1e-4 * (n / 0.5) ** 3 };
  const d = (M.d / 1000) * (1 - 0.6 * sorting);
  return { n, sy, K: ((RG_MU * d * d * n ** 3) / (180 * (1 - n) ** 2)) * 86400 };
}
/** Aquifer-scale properties: natural material is moderately sorted and compacted. */
const aquiferProps = (m: MatId) => matProps(m, 0.5, 0.3);

/* ======================= Cross-section geometry (model units) ======================= */
// x: −5 … 5, one unit = 200 m (2 km section). y: one unit = 20 m (10× vertical exaggeration).
const UX = 200;
const UY = 20;
const RIV = 3.6;
const SOIL = 0.1;
const BOT = -2.4;
const XA = 2.85; // artesian well
const XD = 1.9; // neighbour's shallow well
const WIDTH = 100; // the model is a 100 m wide slice of the aquifer
const ground = (x: number) => 0.35 + 1.3 * sstep(2, -5, x) - 0.28 * Math.exp(-(((x - RIV) / 0.32) ** 2));
const gsurf = (x: number) => ground(x) - SOIL;
/** The confined aquifer lies nearly flat under the valley and bends up to reach the surface on the hill. */
const confTop = (x: number) => -1.05 - 0.05 * x + 2.85 * sstep(-2.3, -5, x);
const confBot = (x: number) => confTop(x) - 0.5;
const clayTop = (x: number) => confTop(x) + 0.4;
const STAGE = ground(RIV) + 0.08;
const inTown = (x: number) => x > -0.9 && x < 1.5;
/** Nodes under the river channel exchange water with the river. */
const isRiverX = (x: number) => ground(x) < STAGE - 0.01;
const M = 101;
const DX = (10 / (M - 1)) * UX; // m between nodes
const xOf = (i: number) => -5 + (i * 10) / (M - 1);
const iOf = (x: number) => clamp(Math.round(((x + 5) / 10) * (M - 1)), 0, M - 1);

/** Thomas algorithm for a tridiagonal system (a: below, b: diagonal, c: above). */
function thomas(a: Float64Array, b: Float64Array, c: Float64Array, d: Float64Array, i0: number, i1: number, out: Float64Array) {
  const cp = new Float64Array(M);
  const dp = new Float64Array(M);
  cp[i0] = c[i0] / b[i0];
  dp[i0] = d[i0] / b[i0];
  for (let i = i0 + 1; i <= i1; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  out[i1] = dp[i1];
  for (let i = i1 - 1; i >= i0; i--) out[i] = dp[i] - cp[i] * out[i + 1];
}

export function initGroundwater(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    view: '3d' as View,
    rain: 800, // mm per year
    aqMat: 'sand' as MatId,
    pumpOn: true,
    pumpQ: 100, // m³/day
    pumpAq: 'unconfined' as 'unconfined' | 'confined',
    xw: 0.9,
    xp1: -3.0,
    xp2: -1.0,
    paved: false,
    rechargeOn: true,
    speed: 0.5, // model years per second
    under: true,
    labels: false,
    // pores lab
    matA: 'sand' as MatId,
    matB: 'clay' as MatId,
    sorting: 0,
    compact: 0,
    ap: 0.2,
    sp: 0.5,
    // plume
    contam: 'salt' as ContamId,
    plMat: 'sand' as MatId,
    dir: 0, // degrees: 0 = towards the east (right)
    plSpeed: 1,
    leak: true,
    monitor: true,
  };
  let lastMsg = '';
  let t = 0;

  /* ======================= Groundwater model ======================= */
  const hU = new Float64Array(M); // water-table elevation, m
  const hC = new Float64Array(M); // confined head, m
  const E = (y: number) => y * UY;
  const active = new Uint8Array(M);
  const covered = new Uint8Array(M);
  let iu0 = 0;
  for (let i = 0; i < M; i++) {
    const x = xOf(i);
    active[i] = gsurf(x) - clayTop(x) > 0.03 ? 1 : 0;
    covered[i] = confTop(x) < gsurf(x) ? 1 : 0;
  }
  while (!active[iu0]) iu0++;
  const KC = 50; // confined aquifer, m/day
  const TC = KC * E(0.5); // transmissivity, m²/day
  const SC = 1e-4; // storativity
  const K_CLAY = 1e-4;
  let years = 0;
  let springQ = 0; // m³/day leaving where the water table reaches the surface
  let pumpFrac = 1; // fraction of the requested pumping the well can deliver
  let riverQ = 0; // m³/day into the river from the slice (negative = losing)
  let rechargeQ = 0; // m³/day recharge entering the slice
  let leakQ = 0;
  let domBottom = 0;
  let springs = 0;
  const leak = (i: number) => (active[i] && covered[i] ? K_CLAY / E(clayTop(xOf(i)) - confTop(xOf(i))) : 0);
  const recharge = (i: number) => {
    const x = xOf(i);
    let r = ((st.rain * 0.25) / 1000 / 365) * (st.aqMat === 'silt' ? 0.6 : 1);
    if (st.paved && inTown(x)) r *= 0.1;
    return r;
  };
  const wellNode = () => iOf(st.xw);
  function stepModel(dt: number) {
    if (!(dt > 0)) return;
    const a = new Float64Array(M);
    const b = new Float64Array(M);
    const c = new Float64Array(M);
    const d = new Float64Array(M);
    const P = aquiferProps(st.aqMat);
    const iw = wellNode();
    const qPump = st.pumpOn ? st.pumpQ / (WIDTH * DX) : 0; // m/day at the well node
    // --- unconfined aquifer ---
    // a dry cell transmits (almost) nothing, so it cannot keep draining
    const sat = (i: number) => Math.max(1e-6, hU[i] - E(clayTop(xOf(i))));
    // upstream weighting: the saturated thickness of the cell the water comes from
    const up = (i: number, j: number) => P.K * (hU[i] >= hU[j] ? sat(i) : sat(j));
    pumpFrac = 1;
    if (st.pumpOn && st.pumpAq === 'unconfined') pumpFrac = active[iw] ? clamp((hU[iw] - E(clayTop(st.xw)) - 1) / 3, 0, 1) : 0;
    if (st.pumpOn && st.pumpAq === 'confined') pumpFrac = clamp((hC[iw] - E(confBot(st.xw)) - 1) / 3, 0, 1);
    const dx2 = DX * DX;
    rechargeQ = 0;
    for (let i = iu0; i < M; i++) {
      const Tw = i > iu0 ? up(i, i - 1) : 0;
      const Te = i < M - 1 ? up(i, i + 1) : 0;
      const riv = isRiverX(xOf(i)) ? 0.5 : 0;
      const lk = leak(i);
      const R = recharge(i);
      rechargeQ += R * DX * WIDTH;
      const pu = st.pumpOn && st.pumpAq === 'unconfined' && i === iw ? qPump * pumpFrac : 0;
      a[i] = -Tw / dx2;
      c[i] = -Te / dx2;
      b[i] = P.sy / dt + (Tw + Te) / dx2 + riv + lk;
      d[i] = (P.sy / dt) * hU[i] + R - pu + riv * E(STAGE) + lk * hC[i];
    }
    thomas(a, b, c, d, iu0, M - 1, hU);
    // a nearly dry cell can overshoot below its base in one step; give the missing
    // water back from the neighbour it drained into, so no water is created
    for (let i = iu0; i < M; i++) {
      const base = E(clayTop(xOf(i)));
      if (hU[i] >= base) continue;
      const deficit = base - hU[i];
      hU[i] = base;
      const l = i > iu0 ? hU[i - 1] : Infinity;
      const r = i < M - 1 ? hU[i + 1] : Infinity;
      const j = r <= l ? i + 1 : i - 1;
      if (j >= iu0 && j < M) hU[j] -= deficit;
    }
    riverQ = 0;
    leakQ = 0;
    springs = 0;
    springQ = 0;
    for (let i = iu0; i < M; i++) {
      const x = xOf(i);
      const isRiver = isRiverX(x);
      const top = isRiver ? Infinity : E(ground(x)) - 0.2;
      if (hU[i] > top) {
        springs += 1;
        springQ += ((hU[i] - top) * P.sy * DX * WIDTH) / dt;
        hU[i] = top;
      }
      hU[i] = Math.max(hU[i], E(clayTop(x)));
      if (isRiver) riverQ += 0.5 * (hU[i] - E(STAGE)) * DX * WIDTH;
      leakQ += leak(i) * (hC[i] - hU[i]) * DX * WIDTH;
    }
    // --- confined aquifer ---
    const qc = st.pumpOn && st.pumpAq === 'confined' ? qPump * pumpFrac : 0;
    for (let i = 0; i < M; i++) {
      const x = xOf(i);
      if (i === M - 1) {
        // far down the valley the confined aquifer discharges (for example to springs or the sea)
        a[i] = 0;
        c[i] = 0;
        b[i] = 1;
        d[i] = E(ground(5)) + 2;
        continue;
      }
      if (!covered[i] && st.rechargeOn) {
        a[i] = 0;
        c[i] = 0;
        b[i] = 1;
        d[i] = E(gsurf(x)) - 4 * (1 - Math.min(1, st.rain / 800));
        continue;
      }
      const Tw = i > 0 ? TC : 0;
      const Te = i < M - 1 ? TC : 0;
      const lk = leak(i);
      a[i] = -Tw / dx2;
      c[i] = -Te / dx2;
      b[i] = SC / dt + (Tw + Te) / dx2 + lk;
      d[i] = (SC / dt) * hC[i] + lk * hU[i] - (i === iw ? qc : 0);
    }
    thomas(a, b, c, d, 0, M - 1, hC);
    for (let i = 0; i < M; i++) hC[i] = Math.max(hC[i], E(confBot(xOf(i))) + 0.5);
  }
  function spinUp() {
    for (let i = 0; i < M; i++) {
      const x = xOf(i);
      hU[i] = active[i] ? Math.max(E(clayTop(x)) + 2, Math.min(E(gsurf(x)) - 1, E(STAGE) + 2)) : 0;
      hC[i] = E(gsurf(-5));
    }
    const on = st.pumpOn;
    st.pumpOn = false;
    for (let k = 0; k < 400; k++) stepModel(40);
    domBottom = hU[iOf(XD)] - 6;
    st.pumpOn = on;
    for (let k = 0; k < 20; k++) stepModel(5);
    years = 0;
    respawnAll();
  }

  /* ---------- flow particles (shared by the 2D section and the 3D block) ---------- */
  const NP = 160;
  const pAq = new Uint8Array(NP); // 0 unconfined, 1 confined
  const pX = new Float64Array(NP);
  const pF = new Float64Array(NP); // fraction of the saturated thickness (0 bottom, 1 top)
  const pAge = new Float64Array(NP);
  function spawn(k: number) {
    const conf = k % 4 === 0;
    pAge[k] = 0;
    if (conf) {
      pAq[k] = 1;
      pX[k] = st.rechargeOn ? -5 + rnd(k + t * 13) * 0.6 : -5 + rnd(k + t * 13) * 8;
      pF[k] = 0.15 + 0.7 * rnd(k * 3 + t);
    } else {
      pAq[k] = 0;
      if (riverQ < -20 && rnd(k + t * 7) < 0.4) {
        pX[k] = RIV + (rnd(k + t) - 0.5) * 0.3;
        pF[k] = 0.95;
      } else {
        pX[k] = xOf(iu0) + rnd(k + t * 5) * (RIV - xOf(iu0) + 1.2);
        pF[k] = 0.85 + 0.12 * rnd(k * 7 + t);
      }
    }
  }
  function respawnAll() {
    for (let k = 0; k < NP; k++) {
      spawn(k);
      pAge[k] = rnd(k) * 20;
    }
  }
  function moveParticles(dtS: number, days: number) {
    const P = aquiferProps(st.aqMat);
    for (let k = 0; k < NP; k++) {
      const i = iOf(pX[k]);
      const i1 = Math.min(M - 1, i + 1);
      const i0 = Math.max(0, i - 1);
      const h = pAq[k] ? hC : hU;
      const K = pAq[k] ? KC : P.K;
      const n = pAq[k] ? 0.25 : P.n;
      const grad = (h[i1] - h[i0]) / ((i1 - i0) * DX);
      const v = (-K * grad) / n; // m/day (seepage velocity)
      pX[k] += clamp((v * days) / UX, -1.5 * dtS, 1.5 * dtS);
      pAge[k] += dtS;
      if (!pAq[k]) pF[k] = Math.max(0.06, pF[k] - dtS * 0.01);
      const x = pX[k];
      const captured = st.pumpOn && pumpFrac > 0 && (st.pumpAq === 'confined') === !!pAq[k] && Math.abs(x - st.xw) < 0.08;
      const toRiver = !pAq[k] && riverQ > 0 && Math.abs(x - RIV) < 0.08;
      if (captured || toRiver || x < -5 || x > 5 || (!pAq[k] && x < xOf(iu0)) || pAge[k] > 40) spawn(k);
    }
  }
  /** Position of particle k in section coordinates. */
  const partPos = (k: number): Pt => {
    const x = pX[k];
    const i = iOf(x);
    if (pAq[k]) {
      const top = Math.min(confTop(x), gsurf(x));
      return [x, confBot(x) + (top - confBot(x)) * pF[k]];
    }
    const b0 = clayTop(x);
    return [x, b0 + (Math.min(hU[i] / UY, gsurf(x)) - b0) * pF[k]];
  };

  /* ======================= Pores lab state ======================= */
  const pore = { a: 0, b: 0, running: false };
  const propsA = () => matProps(st.matA, st.sorting, st.compact, st.ap, st.sp);
  const propsB = () => matProps(st.matB, st.sorting, st.compact, st.ap, st.sp);
  /** Real time for water to soak through 1 m under gravity (unit hydraulic gradient): t = n / K. */
  const soakSeconds = (p: MatProps) => (p.n / Math.max(p.K, 1e-12)) * 86400;
  /** Playback is compressed: every 10× longer real time adds about one second. */
  const playDur = (s: number) => 1.5 + Math.max(0, Math.log10(Math.max(1, s)));

  /* ======================= Plume state ======================= */
  const MAP_W = 1000;
  const MAP_H = 600;
  const GRAD = 0.004;
  const NPL = 1600;
  const plX = new Float64Array(NPL);
  const plY = new Float64Array(NPL);
  const plOn = new Uint8Array(NPL);
  let plNext = 0;
  let plYears = 0;
  let plEmit = 0;
  const src: Pt = [180, 300];
  const mon: Pt = [520, 300];
  const town: Pt = [820, 330];
  const curve: Pt[] = [];
  let curveT = 0;
  const gwSpeed = () => {
    const p = aquiferProps(st.plMat);
    return (p.K * GRAD * 365) / p.n; // m per year
  };
  /** Playback scale: years of model time per second so that groundwater crosses the map in about 12 s. */
  const yearsPerSec = () => ((MAP_W / 12) / gwSpeed()) * st.plSpeed;
  const RELEASE = 60; // particles per (12 s / plSpeed) crossing time
  function clearPlume() {
    plOn.fill(0);
    plNext = 0;
    plYears = 0;
    curve.length = 0;
    curveT = 0;
  }
  function stepPlume(dtS: number) {
    const C = CONTAMINANTS[st.contam];
    const yrs = dtS * yearsPerSec();
    plYears += yrs;
    const v = gwSpeed();
    const vc = v / C.R;
    const th = (st.dir * Math.PI) / 180;
    const ux = Math.cos(th);
    const uy = -Math.sin(th);
    const dist = vc * yrs;
    const sL = Math.sqrt(2 * 10 * dist); // longitudinal dispersivity 10 m
    const sT = Math.sqrt(2 * 1.5 * dist); // transverse dispersivity 1.5 m
    const decay = C.half ? 1 - Math.exp((-Math.LN2 * yrs) / C.half) : 0;
    for (let k = 0; k < NPL; k++) {
      if (!plOn[k]) continue;
      const g1 = gauss();
      const g2 = gauss();
      plX[k] += ux * (dist + sL * g1) - uy * sT * g2;
      plY[k] += uy * (dist + sL * g1) + ux * sT * g2;
      if (plX[k] < -50 || plX[k] > MAP_W + 50 || plY[k] < -50 || plY[k] > MAP_H + 50 || (decay && Math.random() < decay)) plOn[k] = 0;
    }
    if (st.leak) {
      plEmit += dtS * (RELEASE / 12) * 6;
      while (plEmit >= 1) {
        plEmit -= 1;
        plOn[plNext] = 1;
        plX[plNext] = src[0] + (Math.random() - 0.5) * 16;
        plY[plNext] = src[1] + (Math.random() - 0.5) * 16;
        plNext = (plNext + 1) % NPL;
      }
    }
    curveT += dtS;
    if (curveT > 0.25) {
      curveT = 0;
      // a short running average smooths the particle noise
      const prev = curve.length ? curve[curve.length - 1][1] : 0;
      curve.push([plYears, prev + 0.35 * (concAt(mon) - prev)]);
      if (curve.length > 400) curve.shift();
    }
  }
  /** Approximate relative concentration C/C₀ near a point: particles within 25 m compared with a plug-flow estimate at the source. */
  function concAt(p: Pt) {
    const r = 35;
    let n = 0;
    for (let k = 0; k < NPL; k++) if (plOn[k] && Math.hypot(plX[k] - p[0], plY[k] - p[1]) < r) n++;
    const C = CONTAMINANTS[st.contam];
    const perSec = (RELEASE / 12) * 6;
    const crossS = (2 * r) / ((gwSpeed() / C.R) * yearsPerSec());
    return clamp(n / Math.max(1, perSec * crossS), 0, 1);
  }
  let spare: number | null = null;
  function gauss() {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    const u = Math.max(1e-9, Math.random());
    const v = Math.random();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  }

  /* ======================= Step ======================= */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === '3d' || st.view === 'flow') {
      const days = dt * st.speed * 365;
      if (days <= 0) return;
      const n = Math.min(40, Math.max(1, Math.ceil(days / 5)));
      for (let k = 0; k < n; k++) stepModel(days / n);
      years += days / 365;
      moveParticles(dt, days);
      modelDirty = true;
    } else if (st.view === 'pores') {
      const da = playDur(soakSeconds(propsA()));
      const db = playDur(soakSeconds(propsB()));
      pore.a = Math.min(1, pore.a + dt / da);
      pore.b = Math.min(1, pore.b + dt / db);
      if (pore.a >= 1 && pore.b >= 1) sim.pause();
    } else stepPlume(dt);
  }
  let modelDirty = true;

  /* ======================= 2D helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): Pt => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  let cur = 1;
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
  function arrow(x0: number, y0: number, x1: number, y1: number, col: string, lw = 2.5) {
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    const s = 4 + lw * 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - s * Math.cos(a - 0.45), y1 - s * Math.sin(a - 0.45));
    ctx.lineTo(x1 - s * Math.cos(a + 0.45), y1 - s * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  }

  /* ======================= Flow view (2D cross-section) ======================= */
  const flLayout = () => (portrait() ? { sec: { x: 14, y: 70, w: 652, h: 500 }, side: { x: 14, y: 580, w: 652, h: 408 } } : { sec: { x: 14, y: 14, w: 700, h: 572 }, side: { x: 726, y: 70, w: 260, h: 516 } });
  const YT = 2.6;
  let SX = (x: number) => x;
  let SY = (y: number) => y;
  const marks = Array.from({ length: 1100 }, (_, k): Pt => [-5 + rnd(k) * 10, BOT + rnd(k + 5000) * (2.2 - BOT)]);
  type Zone = 'soil' | 'aq' | 'clay' | 'conf' | 'rock' | 'air';
  const zoneAt = (x: number, y: number): Zone => {
    if (y > ground(x)) return 'air';
    if (y > gsurf(x)) return 'soil';
    if (y > clayTop(x)) return 'aq';
    if (y > confTop(x)) return 'clay';
    if (y > confBot(x)) return 'conf';
    return 'rock';
  };
  function layerPath(top: (x: number) => number, bot: (x: number) => number) {
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = -5 + i / 10;
      ctx.lineTo(SX(x), SY(top(x)));
    }
    for (let i = 100; i >= 0; i--) {
      const x = -5 + i / 10;
      ctx.lineTo(SX(x), SY(bot(x)));
    }
    ctx.closePath();
  }
  const hUy = (x: number) => {
    const i = iOf(x);
    return Math.min(active[i] ? hU[i] / UY : clayTop(x), gsurf(x));
  };
  function drawSection(S: Box) {
    SX = (x) => S.x + ((x + 5) / 10) * S.w;
    SY = (y) => S.y + ((YT - y) / (YT - BOT)) * S.h;
    const A = MATERIALS[st.aqMat];
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(S.x, S.y, S.w, S.h, 10);
    ctx.clip();
    ctx.fillStyle = '#e7f5ff';
    ctx.fillRect(S.x, S.y, S.w, S.h);
    const gmin = (f: (x: number) => number) => (x: number) => Math.min(f(x), gsurf(x));
    layerPath(gmin(confBot), () => BOT - 1);
    ctx.fillStyle = '#7d7f85';
    ctx.fill();
    layerPath(gmin(confTop), gmin(confBot));
    ctx.fillStyle = '#c8b28c';
    ctx.fill();
    layerPath(gmin(clayTop), gmin(confTop));
    ctx.fillStyle = '#a1887f';
    ctx.fill();
    layerPath(gsurf, gmin(clayTop));
    ctx.fillStyle = A.color;
    ctx.fill();
    // texture: grains, clay flakes, rock
    for (const [x, y] of marks) {
      const z = zoneAt(x, y);
      const px = SX(x);
      const py = SY(y);
      if (z === 'aq') {
        const r = st.aqMat === 'gravel' ? 3 : st.aqMat === 'sand' ? 1.4 : 0.8;
        ell(px, py, r, r, A.grain);
      } else if (z === 'conf') ell(px, py, 2.4, 2, null, '#8d7b68', 1);
      else if (z === 'clay') {
        ctx.strokeStyle = '#8d6e63';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 4, py);
        ctx.lineTo(px + 4, py);
        ctx.stroke();
      } else if (z === 'rock' && rnd(x * 7) < 0.4) {
        ctx.strokeStyle = '#5c5f66';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 3, py - 3);
        ctx.lineTo(px + 3, py + 3);
        ctx.moveTo(px + 3, py - 3);
        ctx.lineTo(px - 3, py + 3);
        ctx.stroke();
      }
    }
    // water fills the pores below the water table and throughout the confined aquifer
    layerPath(hUy, gmin(clayTop));
    ctx.fillStyle = withAlpha('#1c7ed6', 0.32);
    ctx.fill();
    layerPath(gmin(confTop), gmin(confBot));
    ctx.fillStyle = withAlpha('#1c7ed6', 0.32);
    ctx.fill();
    // soil and grass
    layerPath(ground, gsurf);
    ctx.fillStyle = '#7a5c3e';
    ctx.fill();
    ctx.strokeStyle = '#40c057';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) ctx.lineTo(SX(-5 + i / 10), SY(ground(-5 + i / 10)));
    ctx.stroke();
    // recharge area on the hill
    const xo = outcropEnd();
    ctx.strokeStyle = st.rechargeOn ? '#94d82d' : '#868e96';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = -5; x <= xo; x += 0.05) ctx.lineTo(SX(x), SY(ground(x)) - 2);
    ctx.stroke();
    // town
    for (let k = 0; k < 6; k++) {
      const x = -0.75 + k * 0.4;
      const gy = SY(ground(x));
      ctx.fillStyle = '#ced4da';
      ctx.fillRect(SX(x) - 9, gy - 14, 18, 14);
      ctx.fillStyle = '#c92a2a';
      ctx.beginPath();
      ctx.moveTo(SX(x) - 11, gy - 14);
      ctx.lineTo(SX(x), gy - 24);
      ctx.lineTo(SX(x) + 11, gy - 14);
      ctx.fill();
    }
    if (st.paved) {
      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = -0.9; x <= 1.5; x += 0.05) ctx.lineTo(SX(x), SY(ground(x)) + 1);
      ctx.stroke();
    }
    // river
    ctx.fillStyle = '#4dabf7';
    ctx.beginPath();
    let on = false;
    for (let x = RIV - 0.6; x <= RIV + 0.6; x += 0.02) {
      if (ground(x) < STAGE) {
        if (!on) ctx.moveTo(SX(x), SY(STAGE));
        on = true;
        ctx.lineTo(SX(x), SY(ground(x)));
      }
    }
    ctx.closePath();
    ctx.fill();
    // rain
    if (st.rain > 0) {
      const n = Math.round(st.rain / 30);
      ctx.strokeStyle = withAlpha('#4dabf7', 0.7);
      ctx.lineWidth = 1.5;
      for (let k = 0; k < n; k++) {
        const x = -5 + rnd(k) * 10;
        const y0 = YT - 0.1;
        const ph = (t * 0.9 + rnd(k + 9)) % 1;
        const y = y0 - ph * (y0 - ground(x));
        ctx.beginPath();
        ctx.moveTo(SX(x), SY(y));
        ctx.lineTo(SX(x) - 1.5, SY(y) + 8);
        ctx.stroke();
      }
    }
    // potentiometric surface of the confined aquifer
    ctx.strokeStyle = '#1864ab';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < M; i++) ctx.lineTo(SX(xOf(i)), SY(hC[i] / UY));
    ctx.stroke();
    ctx.setLineDash([]);
    // water table
    ctx.strokeStyle = '#1971c2';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = iu0; i < M; i++) ctx.lineTo(SX(xOf(i)), SY(hUy(xOf(i))));
    ctx.stroke();
    const tx = -0.2;
    const ty = SY(hUy(tx));
    ctx.fillStyle = '#1971c2';
    ctx.beginPath();
    ctx.moveTo(SX(tx) - 7, ty - 12);
    ctx.lineTo(SX(tx) + 7, ty - 12);
    ctx.lineTo(SX(tx), ty - 2);
    ctx.closePath();
    ctx.fill();
    // flow particles
    for (let k = 0; k < NP; k++) {
      const [x, y] = partPos(k);
      ell(SX(x), SY(y), 2.2, 2.2, pAq[k] ? '#0b7285' : '#1864ab');
    }
    // wells
    drawWell2D(XD, 'unconfined', 'domestic');
    drawWell2D(XA, 'confined', 'artesian');
    if (st.pumpOn) drawWell2D(st.xw, st.pumpAq, 'pump');
    // piezometers for Darcy’s law
    for (const [x, lab] of [[st.xp1, 'h₁'], [st.xp2, 'h₂']] as [number, string][]) {
      const gy = SY(ground(x));
      const by = SY(clayTop(x) + 0.08);
      ctx.fillStyle = withAlpha('#ffffff', 0.7);
      ctx.fillRect(SX(x) - 3, gy - 18, 6, by - gy + 18);
      ctx.fillStyle = '#1c7ed6';
      const wy = SY(hUy(x));
      ctx.fillRect(SX(x) - 3, wy, 6, by - wy);
      ctx.strokeStyle = '#343a40';
      ctx.lineWidth = 1;
      ctx.strokeRect(SX(x) - 3, gy - 18, 6, by - gy + 18);
      ell(SX(x), gy - 24, 7, 7, '#fab005', '#343a40', 1);
      text(lab, SX(x), gy - 36, 11, '#343a40', 'center', 800);
    }
    // river exchange
    const rx = SX(RIV);
    const ry = SY(STAGE);
    if (Math.abs(riverQ) > 1) {
      const gain = riverQ > 0;
      arrow(rx + (gain ? 34 : 6), ry + (gain ? 30 : 4), rx + (gain ? 6 : 34), ry + (gain ? 4 : 30), gain ? '#1864ab' : '#e8590c', 2.5);
    }
    ctx.restore();
    // labels
    const lab = (s: string, x: number, y: number, col = '#343a40', align: CanvasTextAlign = 'left') => text(s, SX(x), SY(y), portrait() ? 9.5 : 10.5, col, align, 750);
    lab('Unsaturated zone', 1.6, (hUy(1.6) + gsurf(1.6)) / 2 - 0.05);
    lab(portrait() ? 'Saturated zone' : 'Saturated zone (unconfined aquifer)', 1.2, (hUy(1.2) + clayTop(1.2)) / 2, '#0b3d91');
    lab('Aquitard (clay)', 2.2, (clayTop(2.2) + confTop(2.2)) / 2 - 0.06);
    lab('Confined aquifer', -0.8, (confTop(-0.8) + confBot(-0.8)) / 2 - 0.06, '#0b3d91');
    lab('Bedrock', -3.6, -2.1, '#f1f3f5');
    lab('Water table', tx + 0.15, hUy(tx) + 0.12, '#1971c2');
    const hcMid = hC[iOf(-2.5)] / UY;
    lab('Potentiometric surface', -3.3, hcMid + 0.14, '#1864ab');
    lab(st.rechargeOn ? 'Recharge area' : 'Recharge area sealed', -4.9, ground(-4.9) + 0.22, st.rechargeOn ? '#2b8a3e' : '#868e96');
    lab(riverQ >= 0 ? 'Gaining river' : 'Losing river', RIV, STAGE + 0.45, riverQ >= 0 ? '#1864ab' : '#e8590c', 'center');
    if (springQ > 5) lab('Water table at the surface: springs and wet ground', -1.8, 2.25, '#1864ab');
  }
  /** x where the confined aquifer stops reaching the surface (the end of the recharge area). */
  const outcropEnd = () => {
    let x = -5;
    while (x < 0 && confTop(x) >= gsurf(x)) x += 0.02;
    return x;
  };
  function drawWell2D(x: number, aq: 'unconfined' | 'confined', kind: 'pump' | 'domestic' | 'artesian') {
    const gy = SY(ground(x));
    const bottom = kind === 'domestic' ? domBottom / UY : aq === 'unconfined' ? clayTop(x) + 0.1 : confBot(x) + 0.08;
    const screenTop = kind === 'domestic' ? bottom + 0.15 : aq === 'unconfined' ? clayTop(x) + 0.5 : confTop(x) - 0.02;
    const by = SY(bottom);
    const w = 8;
    const level = aq === 'unconfined' ? hUy(x) : hC[iOf(x)] / UY;
    ctx.fillStyle = withAlpha('#f8f9fa', 0.85);
    ctx.fillRect(SX(x) - w / 2, gy - 16, w, by - gy + 16);
    ctx.fillStyle = '#4dabf7';
    const wy = Math.max(gy - 16, SY(Math.max(level, bottom)));
    ctx.fillRect(SX(x) - w / 2, wy, w, by - wy);
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(SX(x) - w / 2, gy - 16, w, by - gy + 16);
    // screen (slotted section where water enters)
    for (let y = SY(screenTop); y < by - 2; y += 5) {
      ctx.beginPath();
      ctx.moveTo(SX(x) - w / 2, y);
      ctx.lineTo(SX(x) + w / 2, y);
      ctx.stroke();
    }
    if (kind === 'pump') {
      ctx.fillStyle = '#495057';
      ctx.fillRect(SX(x) - 13, gy - 34, 26, 18);
      ctx.fillStyle = '#fab005';
      ctx.fillRect(SX(x) - 13, gy - 38, 26, 5);
      text(`Pump ${Math.round(st.pumpQ * pumpFrac)} m³/day`, SX(x), gy - 46, 10, '#343a40', 'center', 800);
    } else if (kind === 'domestic') {
      const dry = hU[iOf(x)] < domBottom;
      text(dry ? 'Shallow well: DRY' : 'Shallow well', SX(x), gy - 24, 10, dry ? '#c92a2a' : '#343a40', 'center', 800);
    } else {
      const flowing = level > ground(x);
      if (flowing)
        for (let k = 0; k < 10; k++) {
          const ph = (t * 1.6 + k / 10) % 1;
          const hgt = Math.min(40, (level - ground(x)) * UY * 2.5);
          ell(SX(x) + (k % 2 ? 1 : -1) * ph * 12, gy - 16 - Math.sin(ph * Math.PI) * hgt, 2, 2, '#4dabf7');
        }
      text(flowing ? 'Artesian (flowing)' : 'Artesian well', SX(x), gy - 72, 10, '#343a40', 'center', 800);
    }
  }
  function drawFlowSide(B: Box) {
    panel(B.x, B.y, B.w, B.h);
    const two = portrait();
    const colW = two ? B.w / 2 - 18 : B.w - 24;
    let y = B.y + 22;
    const x0 = B.x + 12;
    const P = aquiferProps(st.aqMat);
    const i1 = iOf(st.xp1);
    const i2 = iOf(st.xp2);
    const h1 = hU[i1];
    const h2 = hU[i2];
    const L = Math.abs(st.xp2 - st.xp1) * UX;
    const grad = (h1 - h2) / Math.max(1, L) * Math.sign(st.xp2 - st.xp1);
    const bMid = Math.max(0, (hU[iOf((st.xp1 + st.xp2) / 2)] - E(clayTop((st.xp1 + st.xp2) / 2))));
    const A = bMid * WIDTH;
    const Q = P.K * A * Math.abs(grad);
    text('Darcy’s law', x0, y, 12.5, pal['sim-text'], 'left', 800);
    y += 20 / cur;
    text('Q = K × A × i', x0, y, 13, pal.accent, 'left', 800);
    y += 20 / cur;
    const line = (s: string, col = pal['text-muted'], px = 11) => {
      y = wrap(s, x0, y, colW, px, col, 650);
    };
    line(`K = ${fmtNum(P.K)} m/day (${MATERIALS[st.aqMat].name.toLowerCase()})`);
    line(`A = ${bMid.toFixed(1)} m thick × ${WIDTH} m wide = ${Math.round(A).toLocaleString('en')} m²`);
    line(`i = (h₁ − h₂) / L = ${(h1 - h2).toFixed(2)} m / ${Math.round(L)} m = ${fmtNum(Math.abs(grad), 2)}`);
    line(`Q ≈ ${fmtNum(Q, 3)} m³/day ${grad >= 0 ? '→' : '←'}`, pal.accent, 12);
    y += 4 / cur;
    if (!two) line('Drag the yellow piezometers h₁ and h₂ to measure anywhere in the upper aquifer.', pal['text-faint'], 10);
    if (two) y = B.y + 22;
    const x1 = two ? B.x + B.w / 2 + 6 : x0;
    const line2 = (s: string, col = pal['text-muted'], px = 11) => {
      y = wrap(s, x1, y, colW, px, col, 650);
    };
    y += two ? 0 : 8 / cur;
    text('Water budget (100 m slice)', x1, y, 12, pal['sim-text'], 'left', 800);
    y += 18 / cur;
    line2(`Recharge in: ${Math.round(rechargeQ)} m³/day`, '#2b8a3e');
    line2(`Pumping out: ${Math.round(st.pumpOn ? st.pumpQ * pumpFrac : 0)} m³/day`, '#e8590c');
    line2(riverQ >= 0 ? `To the river: ${Math.round(riverQ)} m³/day` : `From the river: ${Math.round(-riverQ)} m³/day`, riverQ >= 0 ? '#1864ab' : '#e8590c');
    line2(`Upward leakage through the clay: ${fmtNum(leakQ, 2)} m³/day`);
    if (springQ > 1) line2(`Out at springs and wet ground: ${Math.round(springQ)} m³/day`, '#1864ab');
    // magnified pores
    const r = Math.min(two ? 46 : 40, (B.y + B.h - y - 40 / cur) / 2);
    if (r > 18) {
      const cy = y + r + 18 / cur;
      const cxs = [x1 + r + 4, x1 + 3 * r + 30];
      const labels = ['Unsaturated', 'Saturated'];
      cxs.forEach((cx, j) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = j ? '#74c0fc' : '#f1f3f5';
        ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        for (let k = 0; k < 14; k++) {
          const gx = cx - r + ((k % 4) + 0.5 + (Math.floor(k / 4) % 2) * 0.5) * (r / 2);
          const gy = cy - r + (Math.floor(k / 4) + 0.5) * (r / 2);
          if (!j) ell(gx, gy, r * 0.25, r * 0.25, '#74c0fc');
          ell(gx, gy, r * 0.2, r * 0.2, '#c9a66b', '#8d6e63', 1);
        }
        ctx.restore();
        ell(cx, cy, r, r, null, pal['border-strong'], 2 / cur);
        text(labels[j], cx, cy + r + 14 / cur, 9.5, pal['text-muted'], 'center', 700);
      });
      text('Magnified pores', x1, cy - r - 6 / cur, 9.5, pal['text-faint'], 'left', 650);
    }
  }

  /* ======================= Pores view ======================= */
  const poLayout = () =>
    portrait()
      ? { a: { x: 14, y: 104, w: 322, h: 526 }, b: { x: 344, y: 104, w: 322, h: 526 }, bars: { x: 14, y: 642, w: 652, h: 346 } }
      : { a: { x: 14, y: 14, w: 300, h: 572 }, b: { x: 326, y: 14, w: 300, h: 572 }, bars: { x: 638, y: 70, w: 348, h: 516 } };
  type Grain = { x: number; y: number; r: number; flat: boolean };
  const grainCache = new Map<string, Grain[]>();
  /** Random grain packing in a 200 × 400 tube (visual only; the numbers come from matProps). */
  function grains(m: MatId): Grain[] {
    const key = `${m}|${st.sorting}|${st.compact}|${st.ap}|${st.sp}`;
    const hit = grainCache.get(key);
    if (hit) return hit;
    const out: Grain[] = [];
    if (m !== 'fractured') {
      const r0 = { gravel: 15, sand: 7, silt: 3.6, clay: 2.2 }[m];
      const tries = m === 'clay' ? 2600 : m === 'silt' ? 6000 : 4000;
      const overlap = 0.9 - 0.25 * st.compact;
      let seed = 1;
      for (let k = 0; k < tries && out.length < 1400; k++) {
        const r = r0 * (1 + st.sorting * (rnd(seed++) * 1.6 - 0.8));
        const x = r + rnd(seed++) * (200 - 2 * r);
        const y = r + rnd(seed++) * (400 - 2 * r);
        if (out.every((g) => Math.hypot(g.x - x, g.y - y) > (g.r + r) * overlap)) out.push({ x, y, r, flat: m === 'clay' });
      }
    }
    grainCache.set(key, out);
    if (grainCache.size > 30) grainCache.delete(grainCache.keys().next().value!);
    return out;
  }
  function drawColumn(B: Box, m: MatId, p: MatProps, prog: number, tag: string) {
    panel(B.x, B.y, B.w, B.h);
    const Mt = MATERIALS[m];
    text(`${tag}: ${Mt.name}`, B.x + 12, B.y + 22, 12.5, pal['sim-text'], 'left', 800);
    const top = B.y + 34 / cur + 46;
    const bot = B.y + B.h - 92 / cur;
    const s = Math.min((B.w - 40) / 200, (bot - top) / 400);
    const tw = 200 * s;
    const th = 400 * s;
    const tx = B.x + (B.w - tw) / 2;
    const ty = top;
    // ponded water on top
    ctx.fillStyle = withAlpha('#4dabf7', 0.8);
    ctx.fillRect(tx, ty - 30, tw, 30);
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx, ty, tw, th);
    ctx.clip();
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(tx, ty, tw, th);
    // water front
    const fy = ty + th * prog;
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(tx, ty, tw, fy - ty);
    if (m === 'fractured') {
      ctx.fillStyle = Mt.color;
      ctx.fillRect(tx, ty, tw, th);
      const nF = Math.max(1, Math.round(1.5 / st.sp));
      const apPx = Math.max(1.2, st.ap * 6 * s);
      for (let k = 0; k < nF; k++) {
        const x = tx + ((k + 0.5) / nF) * tw;
        ctx.fillStyle = '#f8f9fa';
        ctx.beginPath();
        ctx.moveTo(x - apPx / 2, ty);
        for (let y = 0; y <= th; y += 10) ctx.lineTo(x - apPx / 2 + 6 * Math.sin(y / 23 + k), ty + y);
        for (let y = th; y >= 0; y -= 10) ctx.lineTo(x + apPx / 2 + 6 * Math.sin(y / 23 + k), ty + y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4dabf7';
        ctx.beginPath();
        ctx.moveTo(x - apPx / 2, ty);
        for (let y = 0; y <= th * prog; y += 10) ctx.lineTo(x - apPx / 2 + 6 * Math.sin(y / 23 + k), ty + y);
        for (let y = Math.floor((th * prog) / 10) * 10; y >= 0; y -= 10) ctx.lineTo(x + apPx / 2 + 6 * Math.sin(y / 23 + k), ty + y);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      for (const g of grains(m)) {
        const gx = tx + g.x * s;
        const gy = ty + g.y * s;
        if (g.flat) ell(gx, gy, g.r * s * 1.8, g.r * s * 0.6, Mt.grain, null, 1, rnd(g.x) * 0.6 - 0.3);
        else ell(gx, gy, g.r * s, g.r * s, Mt.grain, withAlpha('#495057', 0.5), 0.8);
      }
    }
    ctx.restore();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / cur;
    ctx.strokeRect(tx, ty, tw, th);
    // drips out of the bottom once the front arrives
    if (prog >= 1)
      for (let k = 0; k < 3; k++) {
        const ph = (t * 1.5 + k / 3) % 1;
        ell(tx + tw / 2 + (k - 1) * 10, ty + th + 4 / cur + (ph * 14) / cur, 3, 4, '#4dabf7');
      }
    const secs = soakSeconds(p);
    const cx = B.x + B.w / 2;
    text(`Porosity ${pct(p.n)}`, cx, B.y + B.h - 52 / cur, 10.5, pal['sim-text'], 'center', 750);
    text(`K = ${fmtNum(p.K)} m/day`, cx, B.y + B.h - 36 / cur, 10.5, pal['sim-text'], 'center', 750);
    text(`1 m in ≈ ${fmtTime(secs)}`, cx, B.y + B.h - 18 / cur, 10.5, pal.accent, 'center', 750);
    text(prog >= 1 ? 'Water is through' : prog > 0 ? 'Soaking in…' : 'Press Pour water', B.x + B.w - 10, B.y + 22, 9.5, pal['text-faint'], 'right', 650);
  }
  function drawPoreBars(B: Box) {
    panel(B.x, B.y, B.w, B.h);
    const pa = propsA();
    const pb = propsB();
    const two = portrait();
    let y = B.y + 22;
    text('Compare', B.x + 12, y, 12.5, pal['sim-text'], 'left', 800);
    y += 14 / cur;
    const colA = '#1c7ed6';
    const colB = '#e8590c';
    const bw = two ? (B.w / 2 - 30) * 0.8 : B.w - 24;
    const group = (title: string, va: number, vb: number, fmt: (v: number) => string, gx: number, gy: number) => {
      text(title, gx, gy + 12 / cur, 11, pal['sim-text'], 'left', 750);
      [va, vb].forEach((v, j) => {
        const yy = gy + 18 / cur + j * 18 / cur;
        ctx.fillStyle = withAlpha(pal['text-faint'], 0.2);
        ctx.fillRect(gx, yy, bw * 0.62, 12 / cur);
        ctx.fillStyle = j ? colB : colA;
        ctx.fillRect(gx, yy, bw * 0.62 * clamp(v, 0.005, 1), 12 / cur);
        text(fmt(j ? vb : va), gx + bw * 0.62 + 6 / cur, yy + 10 / cur, 10, pal['text-muted'], 'left', 700);
      });
      return gy + 62 / cur;
    };
    const lk = (K: number) => (Math.log10(Math.max(K, 1e-6)) + 6) / 10; // 10⁻⁶ … 10⁴ m/day
    const gx = B.x + 12;
    let gy = y;
    gy = group('Porosity', pa.n / 0.6, pb.n / 0.6, () => '', gx, gy);
    const ry = gy;
    gy = group('Specific yield', pa.sy / 0.6, pb.sy / 0.6, () => '', gx, gy);
    const kx = two ? B.x + B.w / 2 + 6 : gx;
    const ky = two ? y : gy;
    const ky2 = group('Permeability K (log)', lk(pa.K), lk(pb.K), () => '', kx, ky);
    // value labels
    const vals = (gy0: number, a: string, b: string, xx: number) => {
      text(a, xx + bw * 0.62 + 6 / cur, gy0 + 28 / cur, 10, colA, 'left', 750);
      text(b, xx + bw * 0.62 + 6 / cur, gy0 + 46 / cur, 10, colB, 'left', 750);
    };
    vals(y, `${pct(pa.n)}`, `${pct(pb.n)}`, gx);
    vals(ry, `${pct(pa.sy)}`, `${pct(pb.sy)}`, gx);
    vals(ky, `${fmtNum(pa.K)} m/d`, `${fmtNum(pb.K)} m/d`, kx);
    let ty = Math.max(gy, ky2) + 4 / cur;
    const tx = two ? kx : gx;
    if (two) ty = ky2 + 4 / cur;
    const msg =
      pa.n > pb.n !== pa.K > pb.K
        ? 'More porous does not mean more permeable: what matters for flow is how large and well connected the openings are.'
        : 'Porosity is how much space there is; permeability is how easily water flows through the connected spaces.';
    wrap(msg, tx, ty + 6 / cur, two ? B.w / 2 - 20 : B.w - 24, 10.5, pal['text-muted'], 650, B.y + B.h - 6);
  }

  /* ======================= Plume view ======================= */
  const plLayout = () => (portrait() ? { map: { x: 14, y: 70, w: 652, h: 430 }, side: { x: 14, y: 512, w: 652, h: 476 } } : { map: { x: 14, y: 14, w: 640, h: 572 }, side: { x: 666, y: 70, w: 320, h: 516 } });
  let MX = (x: number) => x;
  let MY = (y: number) => y;
  let mapScale = 1;
  function mapFrame(B: Box) {
    mapScale = Math.min(B.w / MAP_W, B.h / MAP_H);
    const ox = B.x + (B.w - MAP_W * mapScale) / 2;
    const oy = B.y + (B.h - MAP_H * mapScale) / 2;
    MX = (x) => ox + x * mapScale;
    MY = (y) => oy + y * mapScale;
    return { ox, oy };
  }
  function drawPlume(B: Box) {
    const { ox, oy } = mapFrame(B);
    const w = MAP_W * mapScale;
    const hh = MAP_H * mapScale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, hh, 10);
    ctx.clip();
    ctx.fillStyle = { gravel: '#e9e3d6', sand: '#f3e6c4', silt: '#e6dccb', clay: '#ddd', fractured: '#ddd' }[st.plMat];
    ctx.fillRect(ox, oy, w, hh);
    // fields and road
    ctx.fillStyle = withAlpha('#8ce99a', 0.45);
    for (let k = 0; k < 8; k++) ctx.fillRect(MX(rnd(k) * 850), MY(rnd(k + 3) * 480), 120 * mapScale, 90 * mapScale);
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 10 * mapScale;
    ctx.beginPath();
    ctx.moveTo(MX(0), MY(470));
    ctx.bezierCurveTo(MX(300), MY(430), MX(600), MY(520), MX(1000), MY(460));
    ctx.stroke();
    // flow arrows
    const th = (st.dir * Math.PI) / 180;
    const ux = Math.cos(th);
    const uy = -Math.sin(th);
    const phase = (t * 0.25) % 1;
    for (let gx = 50; gx < MAP_W; gx += 125)
      for (let gy = 50; gy < MAP_H; gy += 125) {
        const L = 40;
        const cx = gx + ux * (phase - 0.5) * 30;
        const cy = gy + uy * (phase - 0.5) * 30;
        arrow(MX(cx - (ux * L) / 2), MY(cy - (uy * L) / 2), MX(cx + (ux * L) / 2), MY(cy + (uy * L) / 2), withAlpha('#1c7ed6', 0.35), 2);
      }
    // plume
    const C = CONTAMINANTS[st.contam];
    ctx.fillStyle = withAlpha(C.color, 0.35);
    for (let k = 0; k < NPL; k++) {
      if (!plOn[k]) continue;
      ctx.beginPath();
      ctx.arc(MX(plX[k]), MY(plY[k]), Math.max(1.6, 6 * mapScale), 0, Math.PI * 2);
      ctx.fill();
    }
    // town and its supply well
    for (let k = 0; k < 7; k++) {
      const hx = town[0] - 70 + (k % 4) * 45;
      const hy = town[1] - 60 + Math.floor(k / 4) * 110;
      ctx.fillStyle = '#ced4da';
      ctx.fillRect(MX(hx), MY(hy), 26 * mapScale, 22 * mapScale);
      ctx.fillStyle = '#c92a2a';
      ctx.fillRect(MX(hx), MY(hy), 26 * mapScale, 7 * mapScale);
    }
    const tc = concAt(town);
    ell(MX(town[0]), MY(town[1]), 9, 9, tc > 0.01 ? '#c92a2a' : '#2f9e44', '#ffffff', 2);
    pill('Town well', MX(town[0]), MY(town[1]) - 16, 'center', 10);
    // source
    ctx.fillStyle = '#495057';
    ctx.fillRect(MX(src[0]) - 12, MY(src[1]) - 9, 24, 18);
    ctx.fillStyle = st.leak ? C.color : '#868e96';
    ell(MX(src[0]), MY(src[1]), 6, 6, st.leak ? C.color : '#868e96');
    pill(st.leak ? 'Leaking tank (drag me)' : 'Tank (leak stopped)', MX(src[0]), MY(src[1]) - 20, 'center', 10);
    // monitoring well
    if (st.monitor) {
      ell(MX(mon[0]), MY(mon[1]), 35 * mapScale, 35 * mapScale, null, '#1864ab', 2);
      ell(MX(mon[0]), MY(mon[1]), 6, 6, '#1864ab', '#ffffff', 2);
      pill(`Monitoring well ${Math.round(concAt(mon) * 100)}%`, MX(mon[0]), MY(mon[1]) + 26, 'center', 10);
    }
    // scale bar and north
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MX(30), MY(575));
    ctx.lineTo(MX(230), MY(575));
    ctx.stroke();
    text('200 m', MX(130), MY(575) - 6, 10, '#343a40', 'center', 750);
    text('N ↑', MX(965), MY(40), 11, '#343a40', 'center', 800);
    ctx.restore();
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, hh, 10);
    ctx.stroke();
  }
  function drawPlumeSide(B: Box) {
    panel(B.x, B.y, B.w, B.h);
    const C = CONTAMINANTS[st.contam];
    const two = portrait();
    let y = B.y + 22;
    const x0 = B.x + 12;
    const cw = two ? B.w / 2 - 20 : B.w - 24;
    text(C.name, x0, y, 12.5, C.color, 'left', 800);
    y += 18 / cur;
    y = wrap(C.text, x0, y, cw, 10.5, pal['text-muted'], 650);
    const v = gwSpeed();
    y = wrap(`Groundwater: ${fmtNum(v, 2)} m/year. ${C.name.split(' (')[0]}: ${fmtNum(v / C.R, 2)} m/year (retardation factor R = ${C.R}).`, x0, y + 4 / cur, cw, 10.5, pal['sim-text'], 700);
    // breakthrough curve
    const G = two ? { x: B.x + B.w / 2 + 6, y: B.y + 30, w: B.w / 2 - 22, h: B.h - 80 } : { x: x0 + 30, y: y + 18 / cur, w: B.w - 54, h: Math.max(80, B.y + B.h - y - 60 / cur) };
    text('At the monitoring well', G.x - (two ? 0 : 30), G.y - 8 / cur, 11, pal['sim-text'], 'left', 750);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1 / cur;
    ctx.strokeRect(G.x, G.y, G.w, G.h);
    text('100%', G.x - 4, G.y + 8 / cur, 9, pal['text-faint'], 'right', 600);
    text('0', G.x - 4, G.y + G.h, 9, pal['text-faint'], 'right', 600);
    const tMax = Math.max(1, ...curve.map((p) => p[0]));
    if (curve.length > 1) {
      ctx.strokeStyle = C.color;
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      curve.forEach(([tt, c], k) => {
        const px = G.x + (tt / tMax) * G.w;
        const py = G.y + G.h - c * G.h;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
    text(`Time since the leak began → ${fmtNum(tMax, 2)} years`, G.x + G.w, G.y + G.h + 14 / cur, 9.5, pal['text-faint'], 'right', 600);
    if (!st.monitor) text('Turn on the monitoring well to record a curve', G.x + G.w / 2, G.y + G.h / 2, 10, pal['text-faint'], 'center', 650);
  }

  /* ======================= 3D block diagram ======================= */
  let three: ThreeScene | null = null;
  let threeFailed = false;
  let loading3D = false;
  let update3D = () => {};
  let positionLabels = () => {};
  let applyUnder = () => {};
  const DZ = 4.4;
  async function ensure3D() {
    if (three || threeFailed || loading3D) return;
    loading3D = true;
    sim.setLoading('Loading the 3D aquifer…');
    try {
      const asp = container.clientWidth / Math.max(1, container.clientHeight);
      const back = clamp(Math.pow(asp, -1.3), 1, 2);
      three = await createThreeScene(container, {
        label: 'A 3D block diagram of groundwater: soil, the unsaturated zone, the water table, an unconfined aquifer, a clay aquitard, a confined aquifer, bedrock, a river and wells. Drag to rotate; tap a layer.',
        camera: { position: [4.5 * back, 4.2 * back, 11 * back], target: [0, -0.5, 0] },
        minDistance: 5,
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
      container.innerHTML = '<p class="gw-no3d">3D graphics are not available in this browser, so the block diagram cannot be shown. The other views still work.</p>';
    } finally {
      loading3D = false;
      sim.setLoading(null);
      three?.setAnimating(st.view === '3d');
      sim.requestRender();
    }
  }
  function build3D(view: ThreeScene) {
    const { THREE, scene, camera } = view;
    const FRONT = DZ / 2;
    const mkShape = (top: (x: number) => number, bot: (x: number) => number, x0 = -5, x1 = 5, n = 100) => {
      const pts: T.Vector2[] = [];
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        pts.push(new THREE.Vector2(x, top(x)));
      }
      for (let i = n; i >= 0; i--) {
        const x = x0 + ((x1 - x0) * i) / n;
        pts.push(new THREE.Vector2(x, Math.min(bot(x), top(x) - 0.002)));
      }
      return new THREE.Shape(pts);
    };
    const extrude = (shape: T.Shape, depth = DZ) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 });
      g.translate(0, 0, -depth / 2);
      return g;
    };
    const std = (color: string, extra: Partial<T.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
    const under = new THREE.Group();
    scene.add(under);
    const pickables: T.Object3D[] = [];
    const layer = (id: LayerId, top: (x: number) => number, bot: (x: number) => number, cap: string, side: string) => {
      const m = new THREE.Mesh(extrude(mkShape(top, bot)), [std(cap), std(side)]);
      m.userData.id = id;
      under.add(m);
      pickables.push(m);
      return m;
    };
    const gmin = (f: (x: number) => number) => (x: number) => Math.min(f(x), gsurf(x));
    layer('bedrock', gmin(confBot), () => BOT, '#7d7f85', '#7d7f85');
    layer('confined', gmin(confTop), gmin(confBot), '#6f9fc4', '#c8b28c');
    layer('aquitard', gmin(clayTop), gmin(confTop), '#a1887f', '#a1887f');
    const aqCap = () => MATERIALS[st.aqMat].color;
    const satMesh = new THREE.Mesh(new THREE.BufferGeometry(), [std('#5c9bd1'), std('#5c9bd1')]);
    const unsatMesh = new THREE.Mesh(new THREE.BufferGeometry(), [std(aqCap()), std(aqCap())]);
    satMesh.userData.id = 'sat';
    unsatMesh.userData.id = 'unsat';
    under.add(satMesh, unsatMesh);
    pickables.push(satMesh, unsatMesh);
    const soilMesh = layer('soil', ground, gsurf, '#7a5c3e', '#69b34c');
    // the plain ground block for the surface view
    const solid = new THREE.Mesh(extrude(mkShape(ground, () => BOT)), [std('#8d6e52'), std('#69b34c')]);
    solid.userData.id = 'soil';
    scene.add(solid);
    pickables.push(solid);
    // skins on the surface: recharge area and town pavement
    const skin = (x0: number, x1: number, color: string, id: LayerId) => {
      const m = new THREE.Mesh(extrude(mkShape((x) => ground(x) + 0.012, (x) => ground(x) - 0.004, x0, x1, 40), DZ + 0.004), std(color));
      m.userData.id = id;
      scene.add(m);
      pickables.push(m);
      return m;
    };
    const rechargeSkin = skin(-5, outcropEnd(), '#94d82d', 'recharge');
    const paveSkin = skin(-0.9, 1.5, '#868e96', 'soil');
    const rechOpen = rechargeSkin.material as T.MeshStandardMaterial;
    const rechSealed = std('#868e96');
    // river water
    const riverMesh = new THREE.Mesh(
      extrude(
        mkShape(
          () => STAGE,
          (x) => ground(x),
          RIV - 0.45,
          RIV + 0.45,
          30,
        ),
        DZ + 0.004,
      ),
      std('#4dabf7', { transparent: true, opacity: 0.85, roughness: 0.3 }),
    );
    riverMesh.userData.id = 'river';
    scene.add(riverMesh);
    pickables.push(riverMesh);
    // houses
    for (let k = 0; k < 9; k++) {
      const x = -0.7 + (k % 5) * 0.48;
      const z = -1.4 + Math.floor(k / 5) * 1.9 + rnd(k) * 0.4;
      const hse = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), std('#e9ecef'));
      hse.position.set(x, ground(x) + 0.08, z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.12, 4), std('#c92a2a'));
      roof.position.set(x, ground(x) + 0.22, z);
      roof.rotation.y = Math.PI / 4;
      scene.add(hse, roof);
    }
    // trees on the hill
    for (let k = 0; k < 14; k++) {
      const x = -4.6 + rnd(k + 40) * 3.2;
      const z = -1.9 + rnd(k + 60) * 3.6;
      const tr = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 7), std('#2f9e44'));
      tr.position.set(x, ground(x) + 0.2, z);
      scene.add(tr);
    }
    // lines on the cut face: water table and potentiometric surface
    const wtGeo = new THREE.BufferGeometry();
    wtGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    const wtLine = new THREE.Line(wtGeo, new THREE.LineBasicMaterial({ color: '#1864ab', linewidth: 2 }));
    const psGeo = new THREE.BufferGeometry();
    psGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    const psLine = new THREE.Line(psGeo, new THREE.LineDashedMaterial({ color: '#0b3d91', dashSize: 0.12, gapSize: 0.08 }));
    under.add(wtLine, psLine);
    // flow particles on the cut face
    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    const pts = new THREE.Points(ptGeo, new THREE.PointsMaterial({ color: '#0b3d91', size: 0.07 }));
    under.add(pts);
    // wells on the cut face
    const mkWell = (id: LayerId) => {
      const g = new THREE.Group();
      const casing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.04), std('#f1f3f5', { transparent: true, opacity: 0.9 }));
      const water = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.05), std('#1c7ed6'));
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), std('#495057'));
      casing.userData.id = water.userData.id = head.userData.id = id;
      g.add(casing, water, head);
      scene.add(g);
      pickables.push(casing, water, head);
      return { g, casing, water, head };
    };
    const wells = { pump: mkWell('pump'), domestic: mkWell('domestic'), artesian: mkWell('artesian') };
    const pumpHouse = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.34), std('#495057'));
    pumpHouse.userData.id = 'pump';
    scene.add(pumpHouse);
    pickables.push(pumpHouse);
    const fountain = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#4dabf7', size: 0.06 }));
    fountain.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
    scene.add(fountain);
    // rain
    const NR = 120;
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * 6), 3));
    const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#4dabf7', transparent: true, opacity: 0.6 }));
    scene.add(rainLines);

    const placeWell = (w: (typeof wells)['pump'], x: number, bottom: number, level: number, z: number) => {
      const top = ground(x) + 0.15;
      w.g.position.set(x, 0, z);
      w.casing.scale.y = top - bottom;
      w.casing.position.y = (top + bottom) / 2;
      const lv = clamp(level, bottom, top);
      w.water.scale.y = Math.max(0.001, lv - bottom);
      w.water.position.y = (lv + bottom) / 2;
      w.head.position.y = top + 0.1;
      w.water.visible = st.under || lv > ground(x);
    };
    let lastBuild = -1;
    const rebuildAquifer = () => {
      satMesh.geometry.dispose();
      unsatMesh.geometry.dispose();
      satMesh.geometry = extrude(mkShape(hUy, gmin(clayTop), -5, 5, 100));
      unsatMesh.geometry = extrude(mkShape(gsurf, hUy, -5, 5, 100));
      (unsatMesh.material as T.MeshStandardMaterial[]).forEach((m) => m.color.set(aqCap()));
      (satMesh.material as T.MeshStandardMaterial[]).forEach((m) => m.color.set(new THREE.Color(aqCap()).lerp(new THREE.Color('#1c7ed6'), 0.55)));
    };
    update3D = () => {
      const now = performance.now();
      if (modelDirty && now - lastBuild > 200) {
        lastBuild = now;
        modelDirty = false;
        rebuildAquifer();
        const wp = wtGeo.attributes.position as T.BufferAttribute;
        const pp = psGeo.attributes.position as T.BufferAttribute;
        for (let i = 0; i < M; i++) {
          const x = xOf(i);
          wp.setXYZ(i, Math.max(x, xOf(iu0)), hUy(Math.max(x, xOf(iu0))), FRONT + 0.006);
          pp.setXYZ(i, x, hC[i] / UY, FRONT + 0.008);
        }
        wp.needsUpdate = true;
        pp.needsUpdate = true;
        psLine.computeLineDistances();
        wtGeo.computeBoundingSphere();
        psGeo.computeBoundingSphere();
      }
      // particles
      const pa = ptGeo.attributes.position as T.BufferAttribute;
      for (let k = 0; k < NP; k++) {
        const [x, y] = partPos(k);
        pa.setXYZ(k, x, y, FRONT + 0.01);
      }
      pa.needsUpdate = true;
      // wells
      const wz = FRONT + 0.03;
      wells.pump.g.visible = pumpHouse.visible = st.pumpOn;
      placeWell(wells.pump, st.xw, st.pumpAq === 'unconfined' ? clayTop(st.xw) + 0.1 : confBot(st.xw) + 0.08, st.pumpAq === 'unconfined' ? hUy(st.xw) : hC[iOf(st.xw)] / UY, wz);
      pumpHouse.position.set(st.xw, ground(st.xw) + 0.3, wz - 0.12);
      placeWell(wells.domestic, XD, domBottom / UY, hUy(XD), wz);
      const hA = hC[iOf(XA)] / UY;
      placeWell(wells.artesian, XA, confBot(XA) + 0.08, hA, wz);
      for (const w of Object.values(wells)) {
        w.casing.visible = st.under;
      }
      const fp = fountain.geometry.attributes.position as T.BufferAttribute;
      const flowing = hA > ground(XA);
      fountain.visible = flowing;
      if (flowing) {
        const hgt = Math.min(0.8, (hA - ground(XA)) * 0.6);
        for (let k = 0; k < 30; k++) {
          const ph = (t * 1.4 + k / 30) % 1;
          fp.setXYZ(k, XA + Math.cos(k * 2.4) * ph * 0.25, ground(XA) + 0.3 + Math.sin(ph * Math.PI) * hgt, wz + Math.sin(k * 2.4) * ph * 0.25);
        }
        fp.needsUpdate = true;
      }
      // rain
      const ra = rainGeo.attributes.position as T.BufferAttribute;
      const nR = Math.round((st.rain / 1500) * NR);
      rainLines.visible = nR > 0;
      for (let k = 0; k < NR; k++) {
        const x = -5 + rnd(k) * 10;
        const z = -DZ / 2 + rnd(k + 77) * DZ;
        const top = 3.6;
        const ph = (t * 0.8 + rnd(k + 5)) % 1;
        const y = top - ph * (top - ground(x));
        const show = k < nR;
        ra.setXYZ(k * 2, x, show ? y : -50, z);
        ra.setXYZ(k * 2 + 1, x - 0.02, show ? y - 0.18 : -50, z);
      }
      ra.needsUpdate = true;
      rechargeSkin.material = st.rechargeOn ? rechOpen : rechSealed;
      paveSkin.visible = st.paved;
      view.requestRender();
    };
    applyUnder = () => {
      under.visible = st.under;
      solid.visible = !st.under;
      soilMesh.visible = st.under;
      view.requestRender();
    };
    applyUnder();
    // labels
    const layerEl = document.createElement('div');
    layerEl.className = 'earth-labels';
    layerEl.setAttribute('aria-hidden', 'true');
    container.appendChild(layerEl);
    type Spot = [string, () => [number, number, number], boolean];
    const spots: Spot[] = [
      ['Unsaturated zone', () => [1.7, (hUy(1.7) + gsurf(1.7)) / 2, FRONT], true],
      ['Water table', () => [-0.3, hUy(-0.3) + 0.05, FRONT], true],
      ['Saturated zone', () => [1.2, (hUy(1.2) + clayTop(1.2)) / 2, FRONT], true],
      ['Aquitard (clay)', () => [2.6, (clayTop(2.6) + confTop(2.6)) / 2, FRONT], true],
      ['Confined aquifer', () => [-1.2, (confTop(-1.2) + confBot(-1.2)) / 2, FRONT], true],
      ['Bedrock', () => [-3.2, -2.0, FRONT], true],
      ['Potentiometric surface', () => [-3.0, hC[iOf(-3)] / UY + 0.12, FRONT], true],
      ['Recharge area', () => [-4.8, ground(-4.8) + 0.35, 0], false],
      ['River', () => [RIV, STAGE + 0.35, 0], false],
      ['Pumping well', () => [st.xw, ground(st.xw) + 0.75, FRONT], false],
      ['Artesian well', () => [XA, ground(XA) + 0.95, FRONT], false],
      ['Shallow well', () => [XD, ground(XD) + 0.5, FRONT], false],
    ];
    const els = spots.map(([s]) => {
      const el = document.createElement('span');
      el.textContent = s;
      layerEl.appendChild(el);
      return el;
    });
    const tmp = new THREE.Vector3();
    positionLabels = () => {
      spots.forEach(([s, at, underOnly], k) => {
        const [x, y, z] = at();
        tmp.set(x, y, z).project(camera);
        const vis = st.labels && tmp.z < 1 && (!underOnly || st.under) && (s !== 'Pumping well' || st.pumpOn);
        els[k].style.display = vis ? '' : 'none';
        els[k].style.transform = `translate(${((tmp.x + 1) / 2) * container.clientWidth}px, ${((1 - tmp.y) / 2) * container.clientHeight}px) translate(-50%, -50%)`;
      });
    };
    view.onPick(
      () => pickables.filter((o) => o.visible && (o.parent?.visible ?? true)),
      (hit, at) => {
        if (!hit) {
          sim.hideTooltip();
          return;
        }
        let o: T.Object3D | null = hit.object;
        while (o && !o.userData.id) o = o.parent;
        const id = (o?.userData.id ?? 'soil') as LayerId;
        const L = LAYERS[id];
        let extra = '';
        if (id === 'sat' || id === 'unsat') {
          const P = aquiferProps(st.aqMat);
          extra = ` Here it is ${MATERIALS[st.aqMat].name.toLowerCase()}: porosity ≈ ${Math.round(P.n * 100)}%, K ≈ ${fmtNum(P.K)} m/day.`;
          if (id === 'unsat') extra = ` The water table is ${((gsurf(hit.point.x) - hUy(hit.point.x)) * UY + SOIL * UY).toFixed(1)} m below the ground here.`;
        }
        if (id === 'pump') extra = ` Pumping ${Math.round(st.pumpQ * pumpFrac)} m³/day from the ${st.pumpAq} aquifer; drawdown ${drawdown().toFixed(1)} m.`;
        if (id === 'domestic') extra = hU[iOf(XD)] < domBottom ? ' It is dry: the water table has fallen below the bottom of the well.' : ` Water ${(hU[iOf(XD)] - domBottom).toFixed(1)} m deep in the well.`;
        if (id === 'artesian') {
          const over = hC[iOf(XA)] - E(ground(XA));
          extra = over > 0 ? ` The pressure would lift water ${over.toFixed(1)} m above the ground, so it flows.` : ` Water rises to ${(-over).toFixed(1)} m below the ground, so it no longer flows.`;
        }
        if (id === 'river') extra = riverQ >= 0 ? ` Gaining: about ${Math.round(riverQ)} m³/day of groundwater seeps in from this slice.` : ` Losing: about ${Math.round(-riverQ)} m³/day leaks into the ground.`;
        sim.showTooltip(at.x, at.y, L.name, `${L.text}${L.props ? ` ${L.props}.` : ''}${extra}`);
        lastPicked = id;
        sim.requestRender();
      },
    );
    modelDirty = true;
  }
  let lastPicked: LayerId | null = null;
  /** Drawdown at the pumping well compared with the same place with no pumping (estimated from the neighbouring nodes’ trend). */
  let baseline = new Float64Array(M);
  const drawdown = () => {
    const i = wellNode();
    return st.pumpAq === 'unconfined' ? Math.max(0, baseline[i] - hU[i]) : Math.max(0, baselineC[i] - hC[i]);
  };
  let baselineC = new Float64Array(M);
  /** Run a copy of the model without pumping to get a baseline for drawdown. */
  function refreshBaseline() {
    const sU = hU.slice();
    const sC = hC.slice();
    const on = st.pumpOn;
    st.pumpOn = false;
    for (let k = 0; k < 150; k++) stepModel(40);
    baseline = hU.slice();
    baselineC = hC.slice();
    st.pumpOn = on;
    hU.set(sU);
    hC.set(sC);
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    if (st.view !== '3d') {
      const { k, ox, oy } = tf();
      cur = k;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      if (st.view === 'flow') {
        const L = flLayout();
        drawSection(L.sec);
        drawFlowSide(L.side);
      } else if (st.view === 'pores') {
        const L = poLayout();
        drawColumn(L.a, st.matA, propsA(), pore.a, 'A');
        drawColumn(L.b, st.matB, propsB(), pore.b, 'B');
        drawPoreBars(L.bars);
      } else {
        const L = plLayout();
        drawPlume(L.map);
        drawPlumeSide(L.side);
      }
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
    if (st.view === '3d' || st.view === 'flow') {
      const depth = E(ground(st.xp1)) - hU[iOf(st.xp1)];
      const dry = hU[iOf(XD)] < domBottom;
      const hA = hC[iOf(XA)] - E(ground(XA));
      r('r1', 'Model time', `${years.toFixed(1)} years`);
      r('r2', 'Pumping well', st.pumpOn ? `${Math.round(st.pumpQ * pumpFrac)} m³/day · drawdown ${drawdown().toFixed(1)} m` : 'Off', st.pumpOn && pumpFrac < 0.95 ? 'bad' : null);
      r('r3', 'River', riverQ >= 0 ? `Gaining ${Math.round(riverQ)} m³/day` : `Losing ${Math.round(-riverQ)} m³/day`, riverQ < 0 ? 'warn' : null);
      r('r4', 'Neighbour’s shallow well', dry ? 'Dry!' : `${(hU[iOf(XD)] - domBottom).toFixed(1)} m of water`, dry ? 'bad' : 'ok');
      r('r5', 'Artesian well', hA > 0 ? `Flowing (+${hA.toFixed(1)} m)` : `Not flowing (${hA.toFixed(1)} m)`, hA > 0 ? 'ok' : 'warn');
      r('r6', st.view === '3d' && lastPicked ? 'Selected' : 'Depth to water table at h₁', st.view === '3d' && lastPicked ? LAYERS[lastPicked].name : `${depth.toFixed(1)} m`);
      if (!note) {
        if (pumpFrac < 0.95 && st.pumpOn) note = 'The pumping well is running short of water: the water level has fallen close to the bottom of the well screen, so it can no longer pump the full rate.';
        else if (dry) note = 'The neighbour’s shallow well has run dry. Pumping (or less recharge) lowered the water table below the bottom of the well.';
        else if (riverQ < 0) note = 'The water table near the river is now below the river level, so river water leaks into the aquifer: pumping groundwater can dry up nearby streams.';
        else if (st.view === '3d') note = threeFailed ? '3D graphics are not available. The other views still work.' : 'Water fills the pores below the water table (blue). Rotate the block and tap any layer, well or the river. Press Start to run the model; change the rainfall, pumping and aquifer material and watch the water table and the dashed potentiometric surface respond.';
        else note = 'Press Start to run the groundwater model. Drag the pumping well to move it, and the yellow piezometers to measure the hydraulic gradient for Darcy’s law. Groundwater flows from high head to low head, towards the river and the well.';
      }
      sim.setBadge(st.view === '3d' ? (st.under ? 'Underground' : 'Surface') : `${years.toFixed(1)} years`);
    } else if (st.view === 'pores') {
      const pa = propsA();
      const pb = propsB();
      const nm = (m: MatId) => MATERIALS[m].name;
      r('r1', 'Porosity (A · B)', `${pct(pa.n)} · ${pct(pb.n)}`);
      r('r2', 'Specific yield (A · B)', `${pct(pa.sy)} · ${pct(pb.sy)}`);
      r('r3', 'Hydraulic conductivity K', `${fmtNum(pa.K)} · ${fmtNum(pb.K)} m/day`);
      r('r4', 'Water held by 1 litre (A · B)', `${mL(pa.n)} · ${mL(pb.n)} mL`);
      r('r5', `Soak through 1 m (${nm(st.matA)})`, fmtTime(soakSeconds(pa)));
      r('r6', `Soak through 1 m (${nm(st.matB)})`, fmtTime(soakSeconds(pb)));
      note ||= `${MATERIALS[st.matA].text} ${MATERIALS[st.matB].text}`;
      sim.setBadge('Porosity vs permeability');
      canvas.setAttribute('aria-label', `Two columns of ${nm(st.matA)} and ${nm(st.matB)}: porosity ${Math.round(pa.n * 100)} and ${Math.round(pb.n * 100)} percent.`);
    } else {
      const C = CONTAMINANTS[st.contam];
      const v = gwSpeed();
      const mc = concAt(mon);
      const tc = concAt(town);
      r('r1', 'Contaminant', C.name);
      r('r2', 'Groundwater speed', `${fmtNum(v, 2)} m/year`);
      r('r3', 'Plume speed', `${fmtNum(v / C.R, 2)} m/year`);
      r('r4', 'Monitoring well', st.monitor ? `${Math.round(mc * 100)}% of source` : 'Off', mc > 0.05 ? 'warn' : null);
      r('r5', 'Town supply well', tc > 0.01 ? 'Contaminated' : 'Clean', tc > 0.01 ? 'bad' : 'ok');
      r('r6', 'Time since the leak began', `${fmtNum(plYears, 2)} years`);
      note ||= 'Drag the leaking tank or tap the map to move it, drag the monitoring well, and change the flow direction. Different contaminants spread at different speeds through the same groundwater.';
      sim.setBadge(C.name);
      canvas.setAttribute('aria-label', `Map of a ${C.name} plume. Town well ${tc > 0.01 ? 'contaminated' : 'clean'}.`);
    }
    if (st.view !== '3d') {
      if (st.view === 'flow') canvas.setAttribute('aria-label', `Groundwater cross-section. Water table ${riverQ >= 0 ? 'above' : 'below'} the river level.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= Dragging (2D views) ======================= */
  type DragId = 'well' | 'p1' | 'p2' | 'src' | 'mon';
  enableDrag<DragId>(canvas, {
    hit(x, y) {
      if (st.view === 'flow') {
        const [bx, by] = toBox(x, y);
        const near = (wx: number, h0: number) => Math.abs(bx - SX(wx)) < 22 && by > SY(ground(wx)) - h0 && by < SY(ground(wx)) + 40;
        if (st.pumpOn && near(st.xw, 50)) return 'well';
        if (near(st.xp1, 40)) return 'p1';
        if (near(st.xp2, 40)) return 'p2';
      } else if (st.view === 'plume') {
        const [bx, by] = toBox(x, y);
        if (Math.hypot(bx - MX(src[0]), by - MY(src[1])) < 26) return 'src';
        if (st.monitor && Math.hypot(bx - MX(mon[0]), by - MY(mon[1])) < 26) return 'mon';
      }
      return null;
    },
    move(id, x, y) {
      const [bx, by] = toBox(x, y);
      if (id === 'src' || id === 'mon') {
        const p = id === 'src' ? src : mon;
        p[0] = clamp((bx - MX(0)) / mapScale, 20, MAP_W - 20);
        p[1] = clamp((by - MY(0)) / mapScale, 20, MAP_H - 20);
        if (id === 'mon') curve.length = 0;
      } else {
        const wx = -5 + ((bx - SX(-5)) / (SX(5) - SX(-5))) * 10;
        if (id === 'well') {
          st.xw = clamp(wx, -1.5, 4.8);
          refreshBaseline();
        } else if (id === 'p1') st.xp1 = clamp(wx, xOf(iu0) + 0.2, 4.8);
        else st.xp2 = clamp(wx, xOf(iu0) + 0.2, 4.8);
        modelDirty = true;
      }
      sim.requestRender();
    },
    click(x, y) {
      if (st.view !== 'plume') return;
      const [bx, by] = toBox(x, y);
      const mx = (bx - MX(0)) / mapScale;
      const my = (by - MY(0)) / mapScale;
      if (mx < 0 || my < 0 || mx > MAP_W || my > MAP_H) return;
      src[0] = mx;
      src[1] = my;
      clearPlume();
      lastMsg = 'Tank moved: a new leak has started here.';
      if (!sim.running) sim.play();
      sim.requestRender();
    },
  });

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.dataset.gwView = st.view === '3d' ? '3d' : '2d';
    root.querySelectorAll<HTMLElement>('[data-views]').forEach((el) => (el.hidden = !el.dataset.views!.split(' ').includes(st.view)));
    root.querySelectorAll<HTMLElement>('[data-frac]').forEach((el) => (el.hidden = !(st.matA === 'fractured' || st.matB === 'fractured')));
    if (st.view === '3d') {
      void ensure3D();
      three?.setAnimating(true);
    } else three?.setAnimating(false);
  }
  const viewCtl = ui.choice<View>('gw-view', (v) => {
    st.view = v;
    lastMsg = '';
    sim.hideTooltip();
    showView();
    if (v === 'plume' && !sim.running) sim.play();
    sim.requestRender();
  });
  const rainCtl = ui.range('gw-rain', (v) => `${v} mm/yr`, (v) => ((st.rain = v), (lastMsg = ''), refreshBaseline(), sim.requestRender()));
  const aqCtl = ui.choice<MatId>('gw-aq', (v) => {
    st.aqMat = v;
    lastMsg = `The upper aquifer is now ${MATERIALS[v].name.toLowerCase()}. Press Start and watch the water table adjust.`;
    refreshBaseline();
    modelDirty = true;
    sim.requestRender();
  });
  const pumpOnCtl = ui.toggle('gw-pump', (v) => ((st.pumpOn = v), (lastMsg = ''), (modelDirty = true), sim.requestRender()));
  const pumpQCtl = ui.range('gw-q', (v) => `${v} m³/day`, (v) => ((st.pumpQ = v), (lastMsg = ''), sim.requestRender()));
  const pumpAqCtl = ui.choice<'unconfined' | 'confined'>('gw-pumpaq', (v) => ((st.pumpAq = v), (lastMsg = ''), (modelDirty = true), sim.requestRender()));
  const pavedCtl = ui.toggle('gw-paved', (v) => ((st.paved = v), refreshBaseline(), sim.requestRender()));
  const rechCtl = ui.toggle('gw-recharge', (v) => ((st.rechargeOn = v), refreshBaseline(), sim.requestRender()));
  const speedCtl = ui.range('gw-speed', (v) => `${(10 ** v).toPrecision(2)} years/s`, (v) => ((st.speed = 10 ** v), sim.requestRender()));
  const underCtl = ui.toggle('gw-under', (v) => {
    st.under = v;
    applyUnder();
    sim.requestRender();
  });
  const labelCtl = ui.toggle('gw-labels', (v) => ((st.labels = v), positionLabels(), three?.requestRender()));
  const selA = root.querySelector<HTMLSelectElement>('[data-mat-a]')!;
  const selB = root.querySelector<HTMLSelectElement>('[data-mat-b]')!;
  const onMat = () => {
    st.matA = selA.value as MatId;
    st.matB = selB.value as MatId;
    pore.a = pore.b = 0;
    lastMsg = '';
    showView();
    sim.requestRender();
  };
  selA.addEventListener('change', onMat);
  selB.addEventListener('change', onMat);
  const sortCtl = ui.range('gw-sort', (v) => (v < 0.2 ? 'Well sorted' : v > 0.7 ? 'Poorly sorted' : 'Mixed'), (v) => ((st.sorting = v), (pore.a = pore.b = 0), sim.requestRender()));
  const compCtl = ui.range('gw-comp', (v) => `${Math.round(v * 100)}%`, (v) => ((st.compact = v), (pore.a = pore.b = 0), sim.requestRender()));
  const apCtl = ui.range('gw-ap', (v) => `${v.toFixed(2)} mm`, (v) => ((st.ap = v), (pore.a = pore.b = 0), sim.requestRender()));
  const spCtl = ui.range('gw-sp', (v) => `${v.toFixed(2)} m`, (v) => ((st.sp = v), (pore.a = pore.b = 0), sim.requestRender()));
  root.querySelector('[data-pour]')?.addEventListener('click', () => {
    pore.a = pore.b = 0;
    lastMsg = '';
    if (!sim.running) sim.play();
  });
  const contCtl = ui.choice<ContamId>('gw-contam', (v) => ((st.contam = v), clearPlume(), (lastMsg = ''), sim.requestRender()));
  const plMatCtl = ui.choice<MatId>('gw-plmat', (v) => ((st.plMat = v), clearPlume(), (lastMsg = ''), sim.requestRender()));
  const dirCtl = ui.range('gw-dir', (v) => ['East →', 'North-east ↗', 'North ↑', 'North-west ↖', 'West ←', 'South-west ↙', 'South ↓', 'South-east ↘'][Math.round(v / 45) % 8], (v) => ((st.dir = v), sim.requestRender()));
  const plSpeedCtl = ui.range('gw-plspeed', (v) => `${v.toFixed(2)}×`, (v) => ((st.plSpeed = v), sim.requestRender()));
  const monCtl = ui.toggle('gw-monitor', (v) => ((st.monitor = v), (curve.length = 0), sim.requestRender()));
  const leakBtn = root.querySelector<HTMLButtonElement>('[data-leak]')!;
  leakBtn.addEventListener('click', () => {
    st.leak = !st.leak;
    leakBtn.textContent = st.leak ? 'Stop the leak' : 'Restart the leak';
    lastMsg = st.leak ? '' : 'Leak stopped. The plume detaches from the source and keeps drifting with the groundwater while it spreads out.';
    if (!sim.running) sim.play();
    sim.requestRender();
  });
  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    clearPlume();
    lastMsg = '';
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, { rain: 800, aqMat: 'sand', pumpOn: true, pumpQ: 100, pumpAq: 'unconfined', xw: 0.9, xp1: -3.0, xp2: -1.0, paved: false, rechargeOn: true, speed: 0.5, under: true, labels: false, matA: 'sand', matB: 'clay', sorting: 0, compact: 0, ap: 0.2, sp: 0.5, contam: 'salt', plMat: 'sand', dir: 0, plSpeed: 1, leak: true, monitor: true });
      rainCtl.set(800, false);
      aqCtl.set('sand', false);
      pumpOnCtl.set(true, false);
      pumpQCtl.set(100, false);
      pumpAqCtl.set('unconfined', false);
      pavedCtl.set(false, false);
      rechCtl.set(true, false);
      speedCtl.set(Math.log10(0.5), false);
      underCtl.set(true, false);
      labelCtl.set(false, false);
      selA.value = 'sand';
      selB.value = 'clay';
      sortCtl.set(0, false);
      compCtl.set(0, false);
      apCtl.set(0.2, false);
      spCtl.set(0.5, false);
      contCtl.set('salt', false);
      plMatCtl.set('sand', false);
      dirCtl.set(0, false);
      plSpeedCtl.set(1, false);
      monCtl.set(true, false);
      leakBtn.textContent = 'Stop the leak';
      src[0] = 180;
      src[1] = 300;
      mon[0] = 520;
      mon[1] = 300;
      pore.a = pore.b = 0;
      clearPlume();
      spinUp();
      refreshBaseline();
      applyUnder();
      lastMsg = '';
      lastPicked = null;
      modelDirty = true;
      viewCtl.set(st.view, false);
      showView();
    },
  });

  spinUp();
  refreshBaseline();
  showView();
  sim.requestRender();
}
