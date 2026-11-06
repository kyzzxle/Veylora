/**
 * Volcano lab, in three views:
 *   3d      – a stratovolcano or shield volcano to rotate, with a cutaway showing
 *             the magma chamber, conduit, side vent, crater and layers.
 *   magma   – magma rising from a chamber. Viscosity comes from silica, temperature
 *             and crystals (a simplified relationship). Water solubility follows
 *             S ≈ 0.42·√P wt% (P in MPa); exsolved gas expands as an ideal gas, so
 *             its volume fraction is φ = r/(1+r), r = x·ρ·R·T/(M·P). Gas escapes if
 *             coalesced bubbles (5 cm) rise faster than the magma (Stokes), or by
 *             permeable outgassing if ascent is very slow; otherwise the magma
 *             fragments where φ reaches 0.75 and the eruption is explosive. Column
 *             height H ≈ 2.0·Q^0.241 km (Mastin et al., 2009).
 *   hazards – a terrain map with lava flows (downhill, limited volume), pyroclastic
 *             density currents (energy-cone model, H/L = 0.2), lahars (down valleys
 *             when it rains) and ash fall (downwind), plus a location pin.
 */
import type * as T from 'three';
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { EXAMPLES, HAZARDS, PARTS, STYLES, TYPES, type HazardId, type PartId, type StyleId, type VolcanoType } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = '3d' | 'magma' | 'hazards';
type Pt = [number, number];
const LAVA = '#f76707';
const MAGMA = '#e03131';
const ASH = '#868e96';
const STYLE_COL: Record<StyleId, string> = { effusive: '#f76707', fountain: '#fab005', dome: '#a9e34b', vulcanian: '#9775fa', plinian: '#e64980' };

/* ======================= Magma physics ======================= */
interface Magma {
  sio2: number; // wt%
  temp: number; // °C
  crystals: number; // volume %
  gas: number; // wt% H2O
  logQ: number; // log10 eruption rate, m³/s
  depth: number; // chamber depth, km
}
const MPA_PER_KM = 26; // lithostatic gradient, ρ ≈ 2650 kg/m³
/** Simplified viscosity (log10 Pa·s): silica raises it, heat lowers it, crystals stiffen it (Einstein–Roscoe). */
function logViscosity(m: Magma) {
  const melt = clamp(2 + 0.2 * (m.sio2 - 48) - 0.01 * (m.temp - 1150), 0.5, 12.5);
  const phi = clamp(m.crystals / 100, 0, 0.55);
  return clamp(melt - 2.5 * Math.log10(1 - phi / 0.6), 0.5, 13);
}
const solubility = (pMPa: number) => 0.42 * Math.sqrt(Math.max(0, pMPa)); // wt% H2O
const pressureAt = (zKm: number) => 0.1 + MPA_PER_KM * zKm;
/** Volume fraction of gas bubbles at depth z (closed system: the gas stays with the magma). */
function gasFraction(m: Magma, zKm: number) {
  const p = pressureAt(zKm);
  const x = Math.max(0, m.gas - solubility(p)) / 100;
  const r = (x * 2400 * 8.314 * (m.temp + 273)) / (0.018 * p * 1e6);
  return r / (1 + r);
}
const saturationDepth = (m: Magma) => Math.max(0, ((m.gas / 0.42) ** 2 - 0.1) / MPA_PER_KM);
/** Depth (km) where the gas fraction reaches 0.75 and the magma shatters, or 0. */
function fragmentationDepth(m: Magma) {
  for (let z = Math.min(m.depth, 10); z >= 0; z -= 0.01) if (gasFraction(m, z) >= 0.75) return z;
  return 0;
}
function ascent(m: Magma) {
  const q = 10 ** m.logQ;
  const r = 5 * q ** 0.25; // assumed conduit radius (m), wider for bigger eruptions
  const vm = q / (Math.PI * r * r);
  const vb = (2400 * 9.81 * 0.1 ** 2) / (3 * 10 ** logViscosity(m)); // 10 cm coalesced bubbles (slugs), Stokes
  return { vm, vb, decouple: vb / vm };
}
function classify(m: Magma): StyleId {
  const { vm, decouple } = ascent(m);
  if (decouple > 1) return m.gas >= 1.5 ? 'fountain' : 'effusive';
  const viscous = logViscosity(m) > 5;
  // slow ascent lets gas leak out through connected bubbles; too little gas never reaches fragmentation
  if (vm < 0.02 || fragmentationDepth(m) < 0.25) return viscous ? 'dome' : 'effusive';
  return m.logQ >= 3 ? 'plinian' : 'vulcanian';
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const columnHeight = (logQ: number) => 2.0 * (10 ** logQ) ** 0.241; // km

/* ======================= Hazard terrain ======================= */
const GW = 100;
const GH = 80;
const CELL = 0.25; // km
const VENT: Pt = [46, 36];

export function initVolcano(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    view: '3d' as View,
    type: 'strato' as VolcanoType,
    cut: true,
    labels: false,
    magma: { sio2: 62, temp: 950, crystals: 20, gas: 4.5, logQ: 3.5, depth: 6 } as Magma,
    haz: { lava: true, pdc: true, lahar: true, ash: true } as Record<HazardId, boolean>,
    windDir: 90,
    wind: 15,
    rain: true,
    ridge: false,
  };
  let t = 0;
  let lastMsg = '';

  /* ---------- Eruption cycle in the magma view ---------- */
  const cyc = { over: 17, erupting: false, eT: 0 };
  function stepMagma(dt: number) {
    const m = st.magma;
    if (!cyc.erupting) {
      cyc.over += dt * (0.6 + 0.35 * m.logQ);
      if (cyc.over >= 20) {
        cyc.erupting = true;
        cyc.eT = 0;
        sim.announce(`Eruption: ${STYLES[classify(m)].name}.`);
      }
    } else {
      cyc.eT += dt;
      cyc.over = Math.max(0, cyc.over - dt * 1.6);
      if (cyc.over <= 0) cyc.erupting = false;
    }
  }

  /* ---------- 3D eruption ---------- */
  let erupt3d = -1;

  /* ---------- Hazards ---------- */
  let H = new Float32Array(GW * GH);
  const idx = (i: number, j: number) => j * GW + i;
  const lavaT = new Float32Array(GW * GH);
  const pdcT = new Float32Array(GW * GH);
  const laharT = new Float32Array(GW * GH);
  const ashMM = new Float32Array(GW * GH);
  let hours = 0;
  let pin: Pt = [74, 52];
  let shade: ImageData | null = null;
  function buildTerrain() {
    H = new Float32Array(GW * GH);
    const valleys = [25, 115, 205, 300].map((d) => (d * Math.PI) / 180);
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const dx = (i - VENT[0]) * CELL;
        const dy = (j - VENT[1]) * CELL;
        const r = Math.hypot(dx, dy);
        let h = 2500 * Math.exp(-r / 3.2) + 300 - dy * 12 + 40 * Math.sin(i * 0.31) * Math.cos(j * 0.27);
        const a = Math.atan2(dy, dx);
        for (const v of valleys) {
          const da = Math.atan2(Math.sin(a - v), Math.cos(a - v));
          const perp = Math.abs(Math.sin(da)) * r;
          if (Math.cos(da) > 0) h -= 260 * Math.exp(-((perp / 0.55) ** 2)) * Math.min(1, r / 2.5);
        }
        if (st.ridge) {
          const x = i * CELL;
          const y = j * CELL;
          if (y > 2 && y < 17) h += 1500 * Math.exp(-(((x - 15.2) / 0.6) ** 2));
        }
        H[idx(i, j)] = h;
      }
    computeHazards();
    shade = null;
  }
  const N8: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function computeHazards() {
    // lava: follows the steepest way down from the vent (a channel), spreading a little sideways, up to 9 km
    lavaT.fill(Infinity);
    {
      let [i, j] = VENT;
      let tt = 0;
      let dist = 0;
      for (let k = 0; k < 200 && dist < 9000; k++) {
        const c = idx(i, j);
        for (const [di, dj] of [[0, 0], ...N8]) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
          const n = idx(ni, nj);
          if (H[n] <= H[c] + 25) lavaT[n] = Math.min(lavaT[n], tt + (di || dj ? 0.15 : 0));
        }
        let best = -1;
        let bh = H[c];
        for (const [di, dj] of N8) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
          if (H[idx(ni, nj)] < bh) {
            bh = H[idx(ni, nj)];
            best = idx(ni, nj);
          }
        }
        if (best < 0) break;
        const bi = best % GW;
        const bj = Math.floor(best / GW);
        const d = Math.hypot(bi - i, bj - j) * CELL * 1000;
        const v = 0.05 + 0.9 * Math.max(0, (H[c] - bh) / d); // m/s: faster on steep ground
        tt += d / v / 3600;
        dist += d;
        i = bi;
        j = bj;
      }
    }
    // pyroclastic density current: energy cone from 300 m above the summit, H/L = 0.35
    pdcT.fill(Infinity);
    const v0 = idx(...VENT);
    const h0 = H[v0] + 300;
    const queue = [v0];
    pdcT[v0] = 0;
    while (queue.length) {
      const c = queue.shift()!;
      const ci = c % GW;
      const cj = Math.floor(c / GW);
      for (const [di, dj] of N8) {
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        const n = idx(ni, nj);
        if (pdcT[n] < Infinity) continue;
        const L = Math.hypot(ni - VENT[0], nj - VENT[1]) * CELL * 1000;
        if (H[n] < h0 - 0.35 * L) {
          pdcT[n] = L / 30 / 3600; // ~30 m/s
          queue.push(n);
        }
      }
    }
    // lahars: from valley heads, following the steepest descent for up to 22 km
    laharT.fill(Infinity);
    if (st.rain)
      for (const ang of [25, 115, 205, 300]) {
        const a = (ang * Math.PI) / 180;
        let i = Math.round(VENT[0] + Math.cos(a) * 8);
        let j = Math.round(VENT[1] + Math.sin(a) * 8);
        let dist = 0;
        for (let k = 0; k < 140 && dist < 22000; k++) {
          const c = idx(i, j);
          const tt = 0.5 + dist / 8 / 3600; // starts ~30 min after the eruption, ~8 m/s
          for (const [di, dj] of [[0, 0], ...N8]) {
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && nj >= 0 && ni < GW && nj < GH) laharT[idx(ni, nj)] = Math.min(laharT[idx(ni, nj)], tt);
          }
          let best = -1;
          let bh = H[c];
          for (const [di, dj] of N8) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
            if (H[idx(ni, nj)] < bh) {
              bh = H[idx(ni, nj)];
              best = idx(ni, nj);
            }
          }
          if (best < 0) break;
          const bi = best % GW;
          const bj = Math.floor(best / GW);
          dist += Math.hypot(bi - i, bj - j) * CELL * 1000;
          i = bi;
          j = bj;
        }
      }
    // ash fall: thickest near the vent and stretched downwind
    const wa = (st.windDir * Math.PI) / 180;
    const L = 3 + st.wind * 0.35;
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const dx = (i - VENT[0]) * CELL;
        const dy = (j - VENT[1]) * CELL;
        const along = dx * Math.cos(wa) + dy * Math.sin(wa);
        const cross = -dx * Math.sin(wa) + dy * Math.cos(wa);
        const width = 1.2 + Math.max(0, along) * 0.18;
        const a2 = along >= 0 ? along / L : -along / 0.8;
        ashMM[idx(i, j)] = 800 * Math.exp(-a2) * Math.exp(-((cross / width) ** 2));
      }
  }
  const ashArrival = (i: number, j: number) => {
    const d = Math.hypot(i - VENT[0], j - VENT[1]) * CELL * 1000;
    return 0.1 + d / st.wind / 3600;
  };

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === 'magma') stepMagma(dt);
    else if (st.view === 'hazards') hours = Math.min(12, hours + dt * 0.25);
    else if (erupt3d >= 0) erupt3d += dt;
  }

  /* ======================= 2D helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
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
  function ell(x: number, y: number, rx: number, ry: number, fill: string) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const rnd = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const fmtEta = (l: number) => `10${String(Math.round(l)).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])} Pa·s`;

  /* ======================= Magma view ======================= */
  const magLayout = () =>
    portrait()
      ? { col: { x: 14, y: 14, w: 250, h: 600 }, surf: { x: 274, y: 100, w: 392, h: 514 }, chart: { x: 14, y: 624, w: 652, h: 364 } }
      : { col: { x: 14, y: 14, w: 300, h: 572 }, surf: { x: 326, y: 70, w: 660, h: 300 }, chart: { x: 326, y: 380, w: 660, h: 206 } };
  function drawMagma() {
    const L = magLayout();
    const m = st.magma;
    const style = classify(m);
    const { decouple } = ascent(m);
    const frag = style === 'plinian' || style === 'vulcanian' ? fragmentationDepth(m) : 0;
    const sat = saturationDepth(m);
    // conduit column
    const C = L.col;
    panel(C.x, C.y, C.w, C.h);
    text('Conduit (depth)', C.x + 12, C.y + 20, 11.5, pal['sim-text'], 'left', 750);
    const top = C.y + 50;
    const zmax = Math.max(m.depth + 1, 4);
    const bot = C.y + C.h - 70;
    const Y = (z: number) => top + (z / zmax) * (bot - top);
    const cx = C.x + C.w * 0.55;
    const cw = 50;
    ctx.fillStyle = withAlpha('#8d6e63', 0.25);
    ctx.fillRect(C.x + 8, top, C.w - 16, bot - top + 50);
    for (let z = 0; z <= zmax; z += 1) {
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.4);
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      ctx.moveTo(C.x + 10, Y(z));
      ctx.lineTo(C.x + 34, Y(z));
      ctx.stroke();
      text(`${z} km`, C.x + 12, Y(z) - 3 / cur, 9.5, pal['text-muted'], 'left', 650);
    }
    // chamber
    ell(cx, Y(m.depth) + 14, 90, 30, MAGMA);
    text('Magma chamber', cx, Y(m.depth) + 52, 10.5, pal['sim-text'], 'center', 750);
    // conduit
    ctx.fillStyle = '#c92a2a';
    ctx.fillRect(cx - cw / 2, top, cw, Y(m.depth) - top + 4);
    // bubbles / ash
    const speed = 30;
    for (let k = 0; k < 260; k++) {
      const yr = ((rnd(k) * (bot - top) - t * speed * (decouple > 1 ? 2.2 : 1)) % (Y(m.depth) - top) + (Y(m.depth) - top)) % (Y(m.depth) - top);
      const y = top + yr;
      const z = ((y - top) / (bot - top)) * zmax;
      const x = cx - cw / 2 + 4 + rnd(k + 999) * (cw - 8);
      if (frag > 0 && z < frag) {
        ctx.fillStyle = withAlpha(ASH, 0.9);
        ctx.fillRect(x, y, 2.6, 2.6);
        continue;
      }
      const phi = gasFraction(m, z);
      if (rnd(k + 77) > phi * 1.6) continue;
      const r = (decouple > 1 ? 2.2 + 4 * phi : 1.2 + 3.2 * phi) * (0.6 + rnd(k + 5) * 0.6);
      ctx.strokeStyle = '#ffe3e3';
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // levels
    const mark = (z: number, s: string, c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2 / cur;
      ctx.setLineDash([5 / cur, 4 / cur]);
      ctx.beginPath();
      ctx.moveTo(cx - cw / 2 - 12, Y(z));
      ctx.lineTo(C.x + C.w - 10, Y(z));
      ctx.stroke();
      ctx.setLineDash([]);
      pill(s, C.x + C.w - 12, Y(z) - 9 / cur, 'right', 10, c);
    };
    if (sat > 0.02) mark(Math.min(sat, m.depth), sat >= m.depth ? 'Bubbly already in chamber' : 'Bubbles start', '#1c7ed6');
    if (frag > 0) mark(frag, 'Fragmentation', '#e64980');
    // surface
    ctx.fillStyle = '#5c940d';
    ctx.fillRect(C.x + 8, top - 6, C.w - 16, 6);
    text(cyc.erupting ? 'Erupting' : `Pressure building: ${cyc.over.toFixed(0)} of 20 MPa`, C.x + 12, C.y + C.h - 14, 10.5, cyc.erupting ? pal.danger : pal['text-muted'], 'left', 750);
    drawSurface(L.surf, style);
    drawChart(L.chart);
  }
  function drawSurface(B: { x: number; y: number; w: number; h: number }, style: StyleId) {
    panel(B.x, B.y, B.w, B.h, pal['surface-2']);
    const m = st.magma;
    const logEta = logViscosity(m);
    const groundY = B.y + B.h - 26;
    const kmToPx = (B.h - 70) / 40; // 40 km of sky
    const cx = B.x + B.w / 2;
    // the volcano gets steeper with more viscous magma
    const steep = clamp((logEta - 2) / 8, 0, 1);
    const halfW = lerp(B.w * 0.42, B.w * 0.2, steep);
    const peak = lerp(30, 70, steep);
    ctx.fillStyle = '#6d5a4b';
    ctx.beginPath();
    ctx.moveTo(cx - halfW, groundY);
    ctx.quadraticCurveTo(cx - halfW * 0.3, groundY - peak * 0.4, cx - 12, groundY - peak);
    ctx.lineTo(cx + 12, groundY - peak);
    ctx.quadraticCurveTo(cx + halfW * 0.3, groundY - peak * 0.4, cx + halfW, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#74b816';
    ctx.fillRect(B.x + 1, groundY, B.w - 2, B.y + B.h - groundY - 1);
    const vy = groundY - peak;
    const on = cyc.erupting;
    if (on) {
      if (style === 'effusive' || style === 'fountain') {
        for (const s of [-1, 1]) {
          ctx.strokeStyle = LAVA;
          ctx.lineWidth = 5 / cur;
          ctx.beginPath();
          ctx.moveTo(cx + s * 8, vy);
          const len = Math.min(1, cyc.eT / 4);
          ctx.quadraticCurveTo(cx + s * halfW * 0.4, vy + peak * 0.5, cx + s * halfW * (0.3 + 0.6 * len), groundY - 2);
          ctx.stroke();
        }
        if (style === 'fountain')
          for (let k = 0; k < 40; k++) {
            const ph = (t * 1.3 + rnd(k)) % 1;
            const vx = (rnd(k + 3) - 0.5) * 60;
            const h = 90 * (0.5 + rnd(k + 9) * 0.5);
            ell(cx + vx * ph, vy - h * 4 * ph * (1 - ph), 2.5, 2.5, rnd(k) > 0.5 ? LAVA : '#fab005');
          }
      } else if (style === 'dome') {
        const g = Math.min(1, cyc.eT / 8);
        ctx.fillStyle = '#5c3d2e';
        ctx.beginPath();
        ctx.ellipse(cx, vy, 22 + 10 * g, 10 + 14 * g, 0, Math.PI, 0);
        ctx.fill();
        ell(cx, vy - 6 - 6 * g, 8, 3, withAlpha(LAVA, 0.8));
      } else {
        const Hk = style === 'plinian' ? columnHeight(m.logQ) : Math.min(columnHeight(m.logQ), 6 + 3 * Math.sin(t * 2) ** 2);
        const grow = style === 'plinian' ? Math.min(1, cyc.eT / 3) : (Math.sin(cyc.eT * 1.8) * 0.5 + 0.5);
        const hpx = Math.min(B.h - 50, Hk * kmToPx) * grow;
        for (let k = 0; k < 70; k++) {
          const u = rnd(k);
          const y = vy - u * hpx;
          const w = 10 + u * 40 + Math.sin(t * 2 + k) * 4;
          ell(cx + (rnd(k + 4) - 0.5) * w, y, 10 + u * 22, 8 + u * 14, withAlpha(rnd(k + 2) > 0.5 ? '#868e96' : '#adb5bd', 0.55));
        }
        if (style === 'plinian' && grow >= 1) {
          for (let k = 0; k < 24; k++) ell(cx + (k - 12) * 10 + 40, vy - hpx + Math.sin(k) * 6, 26, 12, withAlpha('#868e96', 0.6));
        }
        // ballistic blocks
        for (let k = 0; k < 10; k++) {
          const ph = (t * 0.8 + rnd(k + 40)) % 1;
          ell(cx + (rnd(k + 41) - 0.5) * 160 * ph, vy - 70 * 4 * ph * (1 - ph), 2.4, 2.4, '#343a40');
        }
        if (grow > 0.2) pill(`Column ≈ ${Hk.toFixed(0)} km`, B.x + B.w - 12, vy - hpx * 0.7, 'right', 11, pal['sim-text']);
      }
    }
    // altitude scale
    for (const km of [10, 20, 30]) {
      const y = groundY - km * kmToPx;
      if (y < B.y + 30) continue;
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.3);
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      ctx.moveTo(B.x + 6, y);
      ctx.lineTo(B.x + 22, y);
      ctx.stroke();
      text(`${km} km`, B.x + 26, y + 4 / cur, 9.5, pal['text-muted'], 'left', 650);
    }
    const S = STYLES[style];
    pill(S.name, B.x + 12, B.y + 22, 'left', 12, STYLE_COL[style]);
    text(`${S.kind} · like ${S.example}`, B.x + 14, B.y + 22 + 22 / cur, 10.5, pal['text-muted'], 'left', 650);
  }
  function drawChart(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    const P = { x: B.x + 40, y: B.y + 18 + 16 / cur, w: B.w - 56, h: B.h - 18 - 16 / cur - 30 };
    const m = st.magma;
    // classify a grid at the current eruption rate, temperature and chamber depth
    const nx = 48;
    const ny = 24;
    const crystFree = { ...m, crystals: 0 };
    for (let a = 0; a < nx; a++)
      for (let b = 0; b < ny; b++) {
        const logEta = 0.5 + ((a + 0.5) / nx) * 12.5;
        const gas = ((b + 0.5) / ny) * 6;
        // choose a silica content that gives this viscosity at the current temperature
        const sio2 = 48 + (logEta - 2 + 0.01 * (crystFree.temp - 1150)) / 0.2;
        const s = classify({ ...crystFree, sio2, gas });
        ctx.fillStyle = withAlpha(STYLE_COL[s], 0.28);
        ctx.fillRect(P.x + (a / nx) * P.w, P.y + P.h - ((b + 1) / ny) * P.h, P.w / nx + 0.5, P.h / ny + 0.5);
      }
    const X = (l: number) => P.x + ((l - 0.5) / 12.5) * P.w;
    const Yg = (g: number) => P.y + P.h - (g / 6) * P.h;
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1 / cur;
    ctx.strokeRect(P.x, P.y, P.w, P.h);
    text('Viscosity (log₁₀ Pa·s) →', P.x + P.w, P.y + P.h + 24 / cur, 10, pal['text-muted'], 'right', 650);
    for (let l = 2; l <= 12; l += 2) text(String(l), X(l), P.y + P.h + 12 / cur, 9.5, pal['text-faint'], 'center', 600);
    text('Gas (wt%)', B.x + 8, B.y + 18, 10, pal['text-muted'], 'left', 650);
    for (let g = 0; g <= 6; g += 2) text(String(g), P.x - 6, Yg(g) + 3 / cur, 9.5, pal['text-faint'], 'right', 600);
    for (const e of EXAMPLES) {
      ell(X(e.logEta), Yg(e.gas), 3 / cur, 3 / cur, pal['sim-text']);
      text(e.name, X(e.logEta) + 5 / cur, Yg(e.gas) - 4 / cur, 9.5, pal['text-muted'], 'left', 650);
    }
    const lx = X(logViscosity(m));
    const ly = Yg(m.gas);
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5 / cur;
    ctx.beginPath();
    ctx.arc(lx, ly, 7 / cur, 0, Math.PI * 2);
    ctx.stroke();
    pill('Your magma', lx, ly < P.y + 30 / cur ? ly + 20 / cur : ly - 14 / cur, 'center', 10, pal['sim-text']);
    // legend
    let lgx = P.x + 4;
    const lgy = B.y + 16;
    ctx.font = fs(9.5, 700);
    for (const s of Object.keys(STYLES) as StyleId[]) {
      const nm = { effusive: 'Flows', fountain: 'Fountains', dome: 'Dome', vulcanian: 'Vulcanian', plinian: 'Plinian' }[s];
      ell(lgx + 60 + 4, lgy - 3 / cur, 4 / cur, 4 / cur, STYLE_COL[s]);
      text(nm, lgx + 60 + 10 / cur, lgy, 9.5, pal['text-muted'], 'left', 700);
      lgx += ctx.measureText(nm).width + 20 / cur;
    }
  }
  /* ======================= Hazards view ======================= */
  const hazLayout = () => (portrait() ? { map: { x: 10, y: 70, w: 660, h: 560 }, info: { x: 10, y: 640, w: 660, h: 350 } } : { map: { x: 10, y: 10, w: 700, h: 580 }, info: { x: 720, y: 70, w: 270, h: 520 } });
  let mapF = { x: 0, y: 0, s: 1 };
  function drawHazards() {
    const L = hazLayout();
    const M = L.map;
    panel(M.x, M.y, M.w, M.h, pal['surface-2']);
    const s = Math.min((M.w - 12) / GW, (M.h - 12) / GH);
    const ox = M.x + (M.w - GW * s) / 2;
    const oy = M.y + (M.h - GH * s) / 2;
    mapF = { x: ox, y: oy, s };
    // shaded relief (cached)
    if (!shade) {
      const off = document.createElement('canvas');
      off.width = GW;
      off.height = GH;
      const c2 = off.getContext('2d')!;
      shade = c2.createImageData(GW, GH);
      for (let j = 0; j < GH; j++)
        for (let i = 0; i < GW; i++) {
          const h = H[idx(i, j)];
          const hx = H[idx(Math.min(GW - 1, i + 1), j)] - H[idx(Math.max(0, i - 1), j)];
          const hy = H[idx(i, Math.min(GH - 1, j + 1))] - H[idx(i, Math.max(0, j - 1))];
          const light = clamp(0.85 - (hx + hy) / 450, 0.3, 1.25);
          const u = clamp(h / 2800, 0, 1);
          const base = [lerp(140, 150, u), lerp(185, 120, u), lerp(105, 100, u)];
          const k = (j * GW + i) * 4;
          shade.data[k] = base[0] * light;
          shade.data[k + 1] = base[1] * light;
          shade.data[k + 2] = base[2] * light;
          shade.data[k + 3] = 255;
        }
      reliefCanvas = off;
      c2.putImageData(shade, 0, 0);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(reliefCanvas!, ox, oy, GW * s, GH * s);
    // hazards revealed over time
    const cellAt = (arr: Float32Array, i: number, j: number) => arr[idx(i, j)] <= hours;
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const x = ox + i * s;
        const y = oy + j * s;
        if (st.haz.ash && ashMM[idx(i, j)] > 1 && ashArrival(i, j) <= hours) {
          ctx.fillStyle = withAlpha('#adb5bd', clamp(Math.log10(ashMM[idx(i, j)]) / 3, 0.1, 0.7));
          ctx.fillRect(x, y, s + 0.4, s + 0.4);
        }
        if (st.haz.lahar && cellAt(laharT, i, j)) {
          ctx.fillStyle = withAlpha(HAZARDS.lahar.color, 0.85);
          ctx.fillRect(x, y, s + 0.4, s + 0.4);
        }
        if (st.haz.pdc && cellAt(pdcT, i, j)) {
          ctx.fillStyle = withAlpha('#495057', 0.6);
          ctx.fillRect(x, y, s + 0.4, s + 0.4);
        }
        if (st.haz.lava && cellAt(lavaT, i, j)) {
          ctx.fillStyle = withAlpha(LAVA, 0.9);
          ctx.fillRect(x, y, s + 0.4, s + 0.4);
        }
      }
    // vent
    ctx.fillStyle = MAGMA;
    ctx.beginPath();
    ctx.moveTo(ox + VENT[0] * s, oy + VENT[1] * s - 8 / cur);
    ctx.lineTo(ox + VENT[0] * s + 7 / cur, oy + VENT[1] * s + 5 / cur);
    ctx.lineTo(ox + VENT[0] * s - 7 / cur, oy + VENT[1] * s + 5 / cur);
    ctx.closePath();
    ctx.fill();
    // wind arrow
    const wa = (st.windDir * Math.PI) / 180;
    const ax = ox + 40;
    const ay = oy + 40;
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5 / cur;
    ctx.beginPath();
    ctx.moveTo(ax - Math.cos(wa) * 18, ay - Math.sin(wa) * 18);
    ctx.lineTo(ax + Math.cos(wa) * 18, ay + Math.sin(wa) * 18);
    ctx.stroke();
    ell(ax + Math.cos(wa) * 18, ay + Math.sin(wa) * 18, 4 / cur, 4 / cur, pal['sim-text']);
    text(`Wind ${st.wind} m/s`, ax, ay + 32 / cur, 10, pal['sim-text'], 'center', 750);
    // scale bar
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2 / cur;
    ctx.beginPath();
    ctx.moveTo(ox + 12, oy + GH * s - 14);
    ctx.lineTo(ox + 12 + 20 * s, oy + GH * s - 14);
    ctx.stroke();
    text('5 km', ox + 12 + 10 * s, oy + GH * s - 20, 10, pal['sim-text'], 'center', 700);
    // location pin
    const [px, py] = [ox + pin[0] * s, oy + pin[1] * s];
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(px, py - 12 / cur, 7 / cur, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.5 / cur;
    ctx.beginPath();
    ctx.moveTo(px, py - 6 / cur);
    ctx.lineTo(px, py);
    ctx.stroke();
    pill('Your location (drag)', px, py - 28 / cur, 'center', 10, pal.accent);
    pill('Educational model: not a forecast or evacuation tool', M.x + M.w / 2, M.y + M.h - 12, 'center', 10, pal.danger);
    drawHazInfo(L.info);
  }
  let reliefCanvas: HTMLCanvasElement | null = null;
  const pinReport = () => {
    const c = idx(Math.round(pin[0]), Math.round(pin[1]));
    const i = Math.round(pin[0]);
    const j = Math.round(pin[1]);
    const fmt = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(1)} h`);
    return {
      lava: lavaT[c] < Infinity ? fmt(lavaT[c]) : null,
      pdc: pdcT[c] < Infinity ? fmt(pdcT[c]) : null,
      lahar: laharT[c] < Infinity ? fmt(laharT[c]) : null,
      ash: ashMM[c] > 1 ? `${ashMM[c] >= 10 ? ashMM[c].toFixed(0) : ashMM[c].toFixed(1)} mm after ${fmt(ashArrival(i, j))}` : null,
    };
  };
  function drawHazInfo(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    text('At your location', B.x + 14, B.y + 24, 12.5, pal['sim-text'], 'left', 800);
    const rep = pinReport();
    const wide = portrait();
    (Object.keys(HAZARDS) as HazardId[]).forEach((k, n) => {
      const H2 = HAZARDS[k];
      const col = wide ? n % 2 : 0;
      const row = wide ? Math.floor(n / 2) : n;
      const x = B.x + 14 + col * (B.w / 2);
      const y = B.y + 56 + row * (wide ? 4 : 4.2) * (16 / cur);
      ctx.fillStyle = H2.color;
      ctx.fillRect(x, y - 10 / cur, 12 / cur, 12 / cur);
      text({ lava: 'Lava flow', pdc: 'Pyroclastic current', lahar: 'Lahar', ash: 'Ash fall' }[k], x + 18 / cur, y, 11.5, st.haz[k] ? pal['sim-text'] : pal['text-faint'], 'left', 750);
      const r = rep[k];
      text(!st.haz[k] ? 'switched off' : r ? `Reaches you: ${r}` : 'Does not reach you', x, y + 18 / cur, 10.5, !st.haz[k] ? pal['text-faint'] : r ? pal.danger : pal.success, 'left', 700);
      text(H2.speed, x, y + 34 / cur, 9.5, pal['text-muted'], 'left', 600);
    });
  }

  /* ======================= 3D volcano ======================= */
  let three: ThreeScene | null = null;
  let threeFailed = false;
  let loading3D = false;
  let rebuild3D = () => {};
  let update3D = () => {};
  let positionLabels = () => {};
  async function ensure3D() {
    if (three || threeFailed || loading3D) return;
    loading3D = true;
    sim.setLoading('Loading the 3D volcano…');
    try {
      const asp = container.clientWidth / Math.max(1, container.clientHeight);
      const back = clamp(Math.pow(asp, -1), 1, 1.9);
      three = await createThreeScene(container, {
        label: 'A 3D volcano with a cutaway showing the magma chamber, conduit, side vent, crater and layers. Drag to rotate; tap a part to inspect it.',
        camera: { position: [7.2 * back, 2.6 * back, 4.2 * back], target: [0, 0, 0] },
        minDistance: 3,
        maxDistance: 25,
        onFrame: () => {
          update3D();
          positionLabels();
        },
      });
      build3D(three);
    } catch (err) {
      console.error(err);
      threeFailed = true;
      container.innerHTML = '<p class="vo-no3d">3D graphics are not available in this browser, so the 3D volcano cannot be shown. Choose Magma and eruptions or Hazards above.</p>';
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
    const world = new THREE.Group();
    scene.add(world);
    const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0); // removes x > 0
    const clipMats: T.Material[] = [];
    const mat = (c: string, extra: Partial<T.MeshStandardMaterialParameters> = {}, clip = true) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide, ...extra });
      if (clip) clipMats.push(m);
      return m;
    };
    const parts: T.Object3D[] = [];
    const tag = <O extends T.Object3D>(o: O, id: PartId): O => {
      o.traverse((c) => (c.userData.part = id));
      parts.push(o);
      return o;
    };
    const dyn = new THREE.Group();
    world.add(dyn);
    let lavaFlow: T.Mesh | null = null;
    let plume: T.Points | null = null;
    let lake: T.Mesh | null = null;

    rebuild3D = () => {
      for (const c of [...dyn.children]) dyn.remove(c);
      parts.length = 0;
      clipMats.length = 0;
      const shield = st.type === 'shield';
      const Hh = shield ? 1.0 : 2.4;
      const R = shield ? 4.2 : 3.0;
      const cr = shield ? 0.45 : 0.32;
      const cd = shield ? 0.12 : 0.28;
      /** radius of the cone surface at height y (outer profile). */
      const prof = (u: number): Pt => {
        // u from 0 (rim) to 1 (base): concave for strato, convex for shield
        const r = cr + (R - cr) * u;
        const y = shield ? Hh * (1 - u ** 1.6) : Hh * (1 - u) ** 2.1;
        return [r, y];
      };
      const pts: T.Vector2[] = [new THREE.Vector2(0.001, Hh - cd), new THREE.Vector2(cr * 0.75, Hh - cd * 0.7)];
      for (let k = 0; k <= 30; k++) {
        const [r, y] = prof(k / 30);
        pts.push(new THREE.Vector2(r, y));
      }
      const cone = tag(new THREE.Mesh(new THREE.LatheGeometry(pts, 64), mat(shield ? '#4a4040' : '#7a6a5a', { flatShading: false })), 'layers');
      dyn.add(cone);
      // cut face showing the layers (in the plane x = 0)
      const nL = shield ? 7 : 6;
      for (let k = nL; k >= 1; k--) {
        const f = k / nL;
        const shape = new THREE.Shape();
        shape.moveTo(-R * f, 0);
        for (let q = 30; q >= 0; q--) {
          const [r, y] = prof(q / 30);
          shape.lineTo(-r * f, y * f);
        }
        for (let q = 0; q <= 30; q++) {
          const [r, y] = prof(q / 30);
          shape.lineTo(r * f, y * f);
        }
        shape.lineTo(R * f, 0);
        const g = new THREE.ShapeGeometry(shape);
        g.rotateY(Math.PI / 2);
        const col = shield ? (k % 2 ? '#495057' : '#343a40') : k % 2 ? '#5c4b3b' : '#c2a77f';
        const m = tag(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 1 })), 'layers');
        m.position.x = 0.002 + (nL - k) * 0.0005;
        m.userData.cutFace = true;
        dyn.add(m);
      }
      // bedrock with its cut face
      const bed = tag(new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 2.8, 64, 1, true), mat('#8d7b68')), 'bedrock');
      bed.position.y = -1.4;
      dyn.add(bed);
      const ground = tag(new THREE.Mesh(new THREE.RingGeometry(R, 5.2, 64), mat('#7a8f4a')), 'bedrock');
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.002;
      dyn.add(ground);
      const bedFace = tag(new THREE.Mesh(new THREE.PlaneGeometry(10.4, 2.8), new THREE.MeshStandardMaterial({ color: '#a39282', side: THREE.DoubleSide })), 'bedrock');
      bedFace.rotation.y = Math.PI / 2;
      bedFace.position.set(0.001, -1.4, 0);
      bedFace.userData.cutFace = true;
      dyn.add(bedFace);
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(5.2, 64), mat('#6d5a4b'));
      bottom.rotation.x = Math.PI / 2;
      bottom.position.y = -2.8;
      dyn.add(bottom);
      // magma chamber
      const ch = tag(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mat(MAGMA, { emissive: '#7a1010' })), 'chamber');
      ch.scale.set(shield ? 1.6 : 1.1, 0.42, shield ? 1.6 : 1.1);
      ch.position.y = -1.9;
      dyn.add(ch);
      // conduit
      const condLen = Hh - cd + 1.6;
      const cond = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, condLen, 20), mat(MAGMA, { emissive: '#801010' })), 'conduit');
      cond.position.y = -1.6 + condLen / 2;
      dyn.add(cond);
      // side vent (dike) to a flank cone, in the cut plane on the +z side
      const [fr, fy] = prof(0.45);
      const start = new THREE.Vector3(0, shield ? 0.05 : 0.3, 0);
      const end = new THREE.Vector3(0, fy, fr);
      const dl = start.distanceTo(end);
      const dike = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, dl, 12), mat(MAGMA, { emissive: '#801010' })), 'vent');
      dike.position.copy(start.clone().add(end).multiplyScalar(0.5));
      dike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
      dyn.add(dike);
      // cross-section faces of the plumbing, drawn on the cut plane in front of the rock
      const faceMat = new THREE.MeshStandardMaterial({ color: MAGMA, emissive: '#801010', side: THREE.DoubleSide });
      const addFace = (shape: T.Shape, id: PartId) => {
        const g = new THREE.ShapeGeometry(shape, 32);
        g.rotateY(Math.PI / 2);
        const m = tag(new THREE.Mesh(g, faceMat), id);
        m.position.x = 0.006;
        m.userData.cutFace = true;
        dyn.add(m);
      };
      const chS = new THREE.Shape();
      chS.absellipse(0, -1.9, shield ? 1.6 : 1.1, 0.42, 0, Math.PI * 2, false, 0);
      addFace(chS, 'chamber');
      const coS = new THREE.Shape();
      coS.moveTo(-0.12, -1.6);
      coS.lineTo(0.12, -1.6);
      coS.lineTo(0.09, Hh - cd);
      coS.lineTo(-0.09, Hh - cd);
      addFace(coS, 'conduit');
      const dkS = new THREE.Shape();
      const w = 0.05;
      const ang = Math.atan2(end.y - start.y, end.z - start.z);
      const nx = -Math.sin(ang) * w;
      const ny = Math.cos(ang) * w;
      // shape x maps to −z after the rotation
      dkS.moveTo(-(start.z + nx), start.y + ny);
      dkS.lineTo(-(end.z + nx), end.y + ny);
      dkS.lineTo(-(end.z - nx), end.y - ny);
      dkS.lineTo(-(start.z - nx), start.y - ny);
      addFace(dkS, 'vent');
      const par = tag(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 24), mat('#5c4b3b')), 'parasite');
      par.position.set(0, fy + 0.06, fr);
      dyn.add(par);
      // crater lava lake
      lake = tag(new THREE.Mesh(new THREE.CircleGeometry(cr * 0.7, 32), mat(LAVA, { emissive: '#a63a00' })), 'crater');
      lake.rotation.x = -Math.PI / 2;
      lake.position.y = Hh - cd + 0.01;
      dyn.add(lake);
      // lava flow down the -x flank (kept side)
      const flowPts: T.Vector3[] = [];
      for (let k = 0; k <= 24; k++) {
        const [r, y] = prof(k / 24);
        const a = 2.2 + Math.sin(k * 0.5) * 0.04; // down the flank facing the viewer, on the side kept in the cutaway
        flowPts.push(new THREE.Vector3(Math.cos(a) * r * 1.0, y + 0.03, Math.sin(a) * r * 1.0));
      }
      const curve = new THREE.CatmullRomCurve3(flowPts);
      lavaFlow = tag(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.07, 8, false), mat(LAVA, { emissive: '#b33c00' }, false)), 'flow');
      lavaFlow.scale.set(1, 0.5, 1);
      dyn.add(lavaFlow);
      // eruption column (particles)
      const n = 500;
      const pos = new Float32Array(n * 3);
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      plume = tag(new THREE.Points(pg, new THREE.PointsMaterial({ color: '#868e96', size: 0.16, transparent: true, opacity: 0.75, depthWrite: false })), 'plume');
      plume.userData.base = Hh;
      dyn.add(plume);
      applyCut();
      view.requestRender();
    };
    const applyCut = () => {
      for (const m of clipMats) {
        m.clippingPlanes = st.cut ? [cutPlane] : [];
        m.needsUpdate = true;
      }
      for (const c of dyn.children) if (c.userData.cutFace) c.visible = st.cut;
      view.requestRender();
    };
    applyCutRef = applyCut;
    rebuild3D();

    // labels
    const layer = document.createElement('div');
    layer.className = 'earth-labels';
    layer.setAttribute('aria-hidden', 'true');
    container.appendChild(layer);
    const names: [PartId, () => T.Vector3][] = [
      ['chamber', () => new THREE.Vector3(0.05, -1.9, 0)],
      ['conduit', () => new THREE.Vector3(0.05, -0.6, 0)],
      ['vent', () => new THREE.Vector3(0.05, st.type === 'shield' ? 0.3 : 0.75, st.type === 'shield' ? 2.0 : 1.2)],
      ['crater', () => new THREE.Vector3(0, st.type === 'shield' ? 1.25 : 2.7, 0)],
      ['layers', () => new THREE.Vector3(0.05, st.type === 'shield' ? 0.4 : 0.9, st.type === 'shield' ? -2.2 : -1.2)],
      ['flow', () => new THREE.Vector3(Math.cos(2.2) * (st.type === 'shield' ? 2.6 : 1.8), st.type === 'shield' ? 0.45 : 0.5, Math.sin(2.2) * (st.type === 'shield' ? 2.6 : 1.8))],
      ['bedrock', () => new THREE.Vector3(0.05, -0.6, -3.8)],
    ];
    const els = names.map(([id]) => {
      const el = document.createElement('span');
      el.textContent = PARTS[id].name;
      layer.appendChild(el);
      return el;
    });
    const tmp = new THREE.Vector3();
    positionLabels = () => {
      names.forEach(([id, p], k) => {
        tmp.copy(p()).project(camera);
        const internal = id === 'chamber' || id === 'conduit' || id === 'vent';
        els[k].style.display = st.labels && tmp.z < 1 && (!internal || st.cut) ? '' : 'none';
        els[k].style.transform = `translate(${((tmp.x + 1) / 2) * container.clientWidth}px, ${((1 - tmp.y) / 2) * container.clientHeight}px) translate(-50%, -50%)`;
      });
    };
    update3D = () => {
      const e = erupt3d;
      if (lavaFlow) lavaFlow.visible = e >= 0 || st.type === 'shield';
      if (lake) ((lake.material as T.MeshStandardMaterial).emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 3));
      if (plume) {
        const on = e >= 0 && st.type === 'strato';
        plume.visible = on;
        if (on) {
          const arr = (plume.geometry.attributes.position as T.BufferAttribute).array as Float32Array;
          const base = plume.userData.base as number;
          for (let k = 0; k < arr.length / 3; k++) {
            const ph = (e * 0.25 + rnd(k)) % 1;
            const hgt = Math.min(e * 1.5, 6) * ph;
            const spread = 0.2 + hgt * 0.25 + (ph > 0.8 ? (ph - 0.8) * 8 : 0);
            arr[k * 3] = (rnd(k + 7) - 0.5) * spread + (ph > 0.8 ? (ph - 0.8) * 6 : 0);
            arr[k * 3 + 1] = base + hgt;
            arr[k * 3 + 2] = (rnd(k + 13) - 0.5) * spread;
          }
          plume.geometry.attributes.position.needsUpdate = true;
        }
      }
      if (lavaFlow && e >= 0) lavaFlow.scale.y = 0.5 + 0.5 * Math.min(1, e / 3);
    };
    view.onPick(
      () => parts,
      (hit, at) => {
        const id = hit?.object.userData.part as PartId | undefined;
        if (!id) {
          sim.hideTooltip();
          return;
        }
        sim.showTooltip(at.x, at.y, PARTS[id].name, PARTS[id].text);
      },
      (hit) => !st.cut || hit.point.x <= 0.01 || !!hit.object.userData.cutFace,
    );
  }
  let applyCutRef = () => {};

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
      if (st.view === 'magma') drawMagma();
      else drawHazards();
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
      const V = TYPES[st.type];
      r('r1', 'Volcano type', V.name);
      r('r2', 'Typical magma', V.magma);
      r('r3', 'Examples', V.example);
      r('r4', 'View', st.cut ? 'Cutaway (cross-section)' : 'Exterior');
      r('r5', 'Eruption', erupt3d >= 0 ? (st.type === 'strato' ? 'Explosive column and lava' : 'Effusive lava flows') : 'Quiet');
      r('r6', 'Magma or lava?', 'Magma underground, lava at the surface');
      note ||= threeFailed ? '3D graphics are not available in this browser. The Magma and Hazards views still work.' : `${V.name}: ${V.text} Rotate it, tap any part, and switch between the cutaway and the exterior.`;
      sim.setBadge(V.name);
    } else if (st.view === 'magma') {
      const m = st.magma;
      const style = classify(m);
      const a = ascent(m);
      const frag = style === 'plinian' || style === 'vulcanian' ? fragmentationDepth(m) : 0;
      const sat = saturationDepth(m);
      r('r1', 'Viscosity', `≈ ${fmtEta(logViscosity(m))}`);
      r('r2', 'Gas bubbles appear', sat >= m.depth ? 'Already in the chamber' : sat > 0.02 ? `${sat.toFixed(1)} km down` : 'Only at the surface');
      r('r3', 'Gas escapes?', a.decouple > 1 ? 'Yes: bubbles rise out' : a.vm < 0.02 ? 'Slowly, through connected bubbles' : 'No: trapped in the magma', a.decouple > 1 ? 'ok' : a.vm < 0.02 ? null : 'warn');
      r('r4', 'Fragmentation', frag > 0 ? `${frag.toFixed(1)} km down` : 'None');
      r('r5', 'Eruption style', `${STYLES[style].kind}: ${STYLES[style].name}`, STYLES[style].kind === 'Explosive' ? 'bad' : 'ok');
      r('r6', STYLES[style].kind === 'Explosive' ? 'Column height' : 'Eruption rate', STYLES[style].kind === 'Explosive' ? `≈ ${columnHeight(m.logQ).toFixed(0)} km` : `${(10 ** m.logQ).toExponential(0)} m³/s`);
      note ||= `${STYLES[style].text} Change one property at a time and watch the dot move on the chart: no single variable decides the style.`;
      sim.setBadge(STYLES[style].name);
      canvas.setAttribute('aria-label', `Magma at ${fmtEta(logViscosity(m))} with ${m.gas}% gas: ${STYLES[style].name}.`);
    } else {
      const rep = pinReport();
      const hits = (Object.keys(rep) as HazardId[]).filter((k) => st.haz[k] && rep[k]);
      r('r1', 'Time since eruption began', `${hours.toFixed(1)} h`);
      r('r2', 'Hazards at your location', hits.length ? hits.map((k) => HAZARDS[k].name).join(', ') : 'None of the selected', hits.length ? 'bad' : 'ok');
      r('r3', 'Lava flow', st.haz.lava ? rep.lava ?? 'Does not reach you' : 'Off');
      r('r4', 'Pyroclastic current', st.haz.pdc ? rep.pdc ?? 'Does not reach you' : 'Off', rep.pdc && st.haz.pdc ? 'bad' : null);
      r('r5', 'Lahar', !st.rain ? 'No rain: none' : st.haz.lahar ? rep.lahar ?? 'Does not reach you' : 'Off');
      r('r6', 'Ash fall', st.haz.ash ? rep.ash ?? 'Less than 1 mm' : 'Off');
      note ||= 'Drag your location around the map. Hazards follow the terrain: lava and lahars run down valleys, pyroclastic currents spread wherever the ground is low enough, and ash drifts downwind. This is an educational model, not a forecast or an evacuation tool.';
      sim.setBadge(`${hours.toFixed(1)} h after start`);
      canvas.setAttribute('aria-label', `Hazard map ${hours.toFixed(1)} hours after the eruption. At your location: ${hits.length ? hits.map((k) => HAZARDS[k].name).join(', ') : 'no selected hazards'}.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.dataset.voView = st.view === '3d' ? '3d' : '2d';
    ui.showWhen('[data-only="3d"]', st.view === '3d');
    ui.showWhen('[data-only="magma"]', st.view === 'magma');
    ui.showWhen('[data-only="hazards"]', st.view === 'hazards');
    if (st.view === '3d') {
      void ensure3D();
      three?.setAnimating(true);
    } else three?.setAnimating(false);
  }
  const viewCtl = ui.choice<View>('vo-view', (v) => {
    st.view = v;
    lastMsg = '';
    sim.hideTooltip();
    showView();
    if (v !== '3d' && !sim.running) sim.play();
    sim.requestRender();
  });
  const typeCtl = ui.choice<VolcanoType>('vo-type', (v) => {
    st.type = v;
    erupt3d = -1;
    rebuild3D();
    sim.requestRender();
  });
  const cutCtl = ui.toggle('vo-cut', (v) => {
    st.cut = v;
    applyCutRef();
    positionLabels();
    sim.requestRender();
  });
  const labelCtl = ui.toggle('vo-labels', (v) => ((st.labels = v), positionLabels(), sim.requestRender()));
  root.querySelector('[data-erupt]')?.addEventListener('click', () => {
    erupt3d = 0;
    lastMsg = st.type === 'strato' ? 'The stratovolcano erupts explosively: an ash column rises from the crater, and a short, sticky lava flow creeps down the flank.' : 'The shield volcano erupts effusively: runny basalt pours from the crater and flows far down the gentle slopes.';
    if (!sim.running) sim.play();
    sim.requestRender();
  });
  const magmaCtl = {
    sio2: ui.range('vo-sio2', (v) => `${v}%`, (v) => setMagma({ sio2: v })),
    temp: ui.range('vo-temp', (v) => `${v} °C`, (v) => setMagma({ temp: v })),
    crystals: ui.range('vo-cryst', (v) => `${v}%`, (v) => setMagma({ crystals: v })),
    gas: ui.range('vo-gas', (v) => `${v.toFixed(1)} wt%`, (v) => setMagma({ gas: v })),
    logQ: ui.range('vo-rate', (v) => `${(10 ** v).toExponential(0)} m³/s`, (v) => setMagma({ logQ: v })),
    depth: ui.range('vo-depth', (v) => `${v} km`, (v) => setMagma({ depth: v })),
  };
  function setMagma(p: Partial<Magma>) {
    Object.assign(st.magma, p);
    lastMsg = '';
    sim.requestRender();
  }
  const PRESETS: Record<string, Partial<Magma>> = {
    basalt: { sio2: 50, temp: 1170, crystals: 5, gas: 0.6, logQ: 2, depth: 4 },
    andesite: { sio2: 60, temp: 1000, crystals: 25, gas: 3, logQ: 2.5, depth: 6 },
    rhyolite: { sio2: 73, temp: 800, crystals: 10, gas: 5.5, logQ: 4.5, depth: 7 },
  };
  root.querySelectorAll<HTMLButtonElement>('[data-mp]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = PRESETS[b.dataset.mp!];
      for (const [k, v] of Object.entries(p)) magmaCtl[k as keyof Magma].set(v as number, false);
      setMagma(p);
      cyc.over = 18;
      cyc.erupting = false;
      if (!sim.running) sim.play();
    }),
  );
  const hazCtl = (['lava', 'pdc', 'lahar', 'ash'] as HazardId[]).map((k) => ui.toggle(`vo-h-${k}`, (v) => ((st.haz[k] = v), sim.requestRender())));
  const windDirCtl = ui.range('vo-winddir', (v) => `${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][Math.round(v / 45) % 8]} (towards)`, (v) => {
    st.windDir = v;
    computeHazards();
    sim.requestRender();
  });
  const windCtl = ui.range('vo-wind', (v) => `${v} m/s`, (v) => {
    st.wind = v;
    computeHazards();
    sim.requestRender();
  });
  const rainCtl = ui.toggle('vo-rain', (v) => {
    st.rain = v;
    computeHazards();
    lastMsg = v ? 'Heavy rain mixes with loose ash on the slopes: lahars can rush down the river valleys.' : 'Without rain or melting snow, the loose ash stays put: no lahars.';
    sim.requestRender();
  });
  const ridgeCtl = ui.toggle('vo-ridge', (v) => {
    st.ridge = v;
    buildTerrain();
    lastMsg = v ? 'A ridge east of the volcano now blocks pyroclastic currents and lava from reaching the valley behind it.' : '';
    sim.requestRender();
  });
  root.querySelector('[data-replay]')?.addEventListener('click', () => {
    hours = 0;
    if (!sim.running) sim.play();
  });

  /* ======================= Pointer ======================= */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  const toGrid = ([bx, by]: Pt): Pt => [(bx - mapF.x) / mapF.s, (by - mapF.y) / mapF.s];
  enableDrag<'pin'>(canvas, {
    hit(x, y) {
      if (st.view !== 'hazards') return null;
      const [gi, gj] = toGrid(toBox(x, y));
      return Math.hypot(gi - pin[0], gj - (pin[1] - 2)) < 6 ? 'pin' : null;
    },
    move(_id, x, y) {
      const [gi, gj] = toGrid(toBox(x, y));
      pin = [clamp(gi, 0, GW - 1), clamp(gj, 0, GH - 1)];
      lastMsg = '';
      sim.requestRender();
    },
    click(x, y) {
      if (st.view !== 'hazards') return;
      const [gi, gj] = toGrid(toBox(x, y));
      if (gi >= 0 && gj >= 0 && gi < GW && gj < GH) {
        pin = [gi, gj];
        sim.requestRender();
      }
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, { type: 'strato', cut: true, labels: false, windDir: 90, wind: 15, rain: true, ridge: false });
      st.magma = { sio2: 62, temp: 950, crystals: 20, gas: 4.5, logQ: 3.5, depth: 6 };
      st.haz = { lava: true, pdc: true, lahar: true, ash: true };
      typeCtl.set('strato', false);
      cutCtl.set(true, false);
      labelCtl.set(false, false);
      for (const [k, v] of Object.entries(st.magma)) magmaCtl[k as keyof Magma].set(v, false);
      hazCtl.forEach((c) => c.set(true, false));
      windDirCtl.set(90, false);
      windCtl.set(15, false);
      rainCtl.set(true, false);
      ridgeCtl.set(false, false);
      cyc.over = 17;
      cyc.erupting = false;
      erupt3d = -1;
      hours = 0;
      pin = [74, 52];
      lastMsg = '';
      viewCtl.set(st.view, false);
      buildTerrain();
      rebuild3D();
      applyCutRef();
      showView();
    },
  });

  buildTerrain();
  showView();
  sim.requestRender();
}
