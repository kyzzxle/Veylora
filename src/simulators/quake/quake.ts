/**
 * Earthquake lab, in three views:
 *   3d     – a block of layered crust cut by a normal, reverse or strike-slip
 *            fault. Tectonic loading stores elastic strain (the fence bends);
 *            when the strain reaches the rock's strength, or on demand, the fault
 *            slips (elastic rebound), the ground shakes, and P- and S-wave fronts
 *            spread from the focus to three stations. Moment magnitude uses
 *            Mw = (2/3)(log10 M0 − 9.1) with M0 = μ·A·D (Hanks and Kanamori, 1979).
 *   waves  – particle motion in P, S and Rayleigh surface waves (S-waves stop at a
 *            liquid layer) and a seismogram at an adjustable distance.
 *   locate – three stations, three seismograms; the S–P time gives the distance
 *            d = Δt·Vp·Vs/(Vp − Vs) and three circles meet at the epicenter.
 */
import type * as T from 'three';
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { FAULTS, KM_PER_S, PARTS, VP, VR, VS, WAVES, type FaultId, type PartId, type WaveId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = '3d' | 'waves' | 'locate';
type Pt = [number, number];
const P_COL = '#f08c00';
const S_COL = '#1c7ed6';
const R_COL = '#2f9e44';
const ST_COLS = ['#e64980', '#7950f2', '#12b886'];
const UNIT_KM = 5; // one 3D model unit = 5 km
const VIS_PER_M = 0.12; // slip is drawn exaggerated: 0.12 model units per metre
const MU = 3.0e10; // shear modulus of crustal rock, Pa
const DIP = (60 * Math.PI) / 180;
const MAX_OFFSET = 20; // m
const FRONT = 3.03; // z of the front face of the block (just outside it)

/** Moment magnitude from slip (m) and rupture length (km); width = min(length, 15 km). */
function momentMagnitude(slipM: number, lengthKm: number) {
  const area = lengthKm * 1000 * Math.min(lengthKm, 15) * 1000;
  const m0 = MU * area * Math.max(slipM, 1e-6);
  return { m0, mw: (2 / 3) * (Math.log10(m0) - 9.1) };
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export function initQuake(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = { view: '3d' as View, fault: 'normal' as FaultId, slip: 1, length: 20, depth: 10, speed: 0.5, plane: true, labels: false, wave: 'p' as WaveId, liquid: false, dist: 150, marks: false };
  let t = 0;
  let lastMsg = '';

  /* ======================= Fault model state ======================= */
  const fm = { strain: 0, offset: 0, quakes: 0, eqT: -1, slipFrom: 0, slipTo: 0, lastSlip: 0, lastMw: 0 };
  const slipDir = (): [number, number, number] =>
    st.fault === 'normal' ? [Math.cos(DIP), -Math.sin(DIP), 0] : st.fault === 'reverse' ? [-Math.cos(DIP), Math.sin(DIP), 0] : [0, 0, -1];
  /** x position of the fault plane at height y (y ≤ 0, model units). */
  const faultX = (y: number) => (st.fault === 'strike' ? 0 : -y / Math.tan(DIP));
  const focusPos = (): [number, number, number] => {
    const y = -st.depth / UNIT_KM;
    return [faultX(y), y, FRONT]; // on the front cross-section face, so it can be seen
  };
  const STATIONS: [number, number, number][] = [[-3.2, 0, -2.1], [3.3, 0, 2.0], [-1.2, 0, 2.5]];
  const stationOnHanging = (i: number) => STATIONS[i][0] > 0;
  /** Hypocentral distance (km) from the focus to station i. */
  const stationKm = (i: number) => {
    const f = focusPos();
    const s = STATIONS[i];
    return Math.hypot(s[0] - f[0], s[1] - f[1], s[2] - f[2]) * UNIT_KM;
  };
  function triggerQuake(auto: boolean) {
    if (fm.eqT >= 0 && fm.eqT < 1.2) return;
    const released = Math.max(0.05, fm.strain) * st.slip;
    if (fm.offset + released > MAX_OFFSET) {
      lastMsg = 'The model has moved as far as it can be drawn. Press Reset to start again.';
      sim.pause();
      return;
    }
    const { mw } = momentMagnitude(released, st.length);
    fm.slipFrom = fm.offset;
    fm.slipTo = fm.offset + released;
    fm.lastSlip = released;
    fm.lastMw = mw;
    fm.strain = 0;
    fm.eqT = 0;
    fm.quakes++;
    lastMsg = `${auto ? 'The stored strain reached the strength of the rock: the' : 'The'} fault slipped ${released.toFixed(2)} m along a ${st.length} km rupture. Magnitude Mw ${mw.toFixed(1)}. ${FAULTS[st.fault].motion}. Watch the P-waves (orange) reach the stations before the S-waves (blue).`;
    sim.announce(`Earthquake of magnitude ${mw.toFixed(1)}.`);
  }

  /* ======================= Waves view state ======================= */
  let waveT = 0;
  let seisT = 0;

  /* ======================= Locate view state ======================= */
  const MAP_W = 600;
  const MAP_H = 520;
  const LOC_ST: Pt[] = [[110, 110], [490, 150], [290, 450]];
  const loc = { epi: [0, 0] as Pt, sp: [10, 10, 10], pin: [300, 260] as Pt, checked: false, shown: false, err: 0, tries: 0, best: Infinity };
  function newQuake() {
    loc.epi = [90 + Math.random() * 420, 90 + Math.random() * 340];
    loc.checked = false;
    loc.shown = false;
    loc.pin = [300, 260];
  }
  newQuake();
  const trueSP = (i: number) => Math.hypot(LOC_ST[i][0] - loc.epi[0], LOC_ST[i][1] - loc.epi[1]) / KM_PER_S;

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === '3d') {
      if (fm.eqT >= 0) {
        fm.eqT += dt;
        const u = Math.min(1, fm.eqT / 0.35);
        fm.offset = lerp(fm.slipFrom, fm.slipTo, 1 - (1 - u) ** 3);
        if (fm.eqT > 9) fm.eqT = -1;
      } else {
        fm.strain = Math.min(1, fm.strain + dt / 7);
        if (fm.strain >= 1) triggerQuake(true);
      }
    } else if (st.view === 'waves') {
      waveT += dt * st.speed * 2;
      seisT = Math.min(seisT + dt * 22, 160);
    }
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
  function arrow(x1: number, y1: number, x2: number, y2: number, color: string, w = 2) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = w / cur;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    const h = 8 / cur;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(a - 0.4) * h, y2 - Math.sin(a - 0.4) * h);
    ctx.lineTo(x2 - Math.cos(a + 0.4) * h, y2 - Math.sin(a + 0.4) * h);
    ctx.closePath();
    ctx.fill();
  }
  /** Deterministic pseudo-noise. */
  const noise = (x: number) => Math.sin(x * 12.9898) * 0.5 + Math.sin(x * 4.1414 + 1.7) * 0.3 + Math.sin(x * 27.31) * 0.2;

  /** Synthetic seismogram value at time s (seconds after origin) for distance km. */
  function trace(s: number, km: number) {
    const tp = km / VP;
    const ts = km / VS;
    const tr = km / VR;
    const att = 1 / (1 + km / 120);
    const env = (t0: number, rise: number, decay: number) => (s < t0 ? 0 : Math.min(1, (s - t0) / rise) * Math.exp(-(s - t0) / decay));
    let v = 0.03 * noise(s * 3.1);
    v += 0.32 * att * env(tp, 0.4, 6) * Math.sin(2 * Math.PI * 2.2 * (s - tp)) * (0.8 + 0.2 * noise(s));
    v += 0.62 * att * env(ts, 0.5, 7) * Math.sin(2 * Math.PI * 1.3 * (s - ts)) * (0.8 + 0.2 * noise(s + 9));
    v += 0.95 * att * env(tr, 1.2, 9) * Math.sin(2 * Math.PI * 0.5 * (s - tr));
    return clamp(v, -1, 1);
  }
  function drawSeismo(x: number, y: number, w: number, h: number, km: number, tmax: number, upto: number, color: string, marks: boolean, label: string) {
    panel(x, y, w, h, pal['surface-2']);
    const mid = y + h / 2 + 6 / cur;
    const X = (s: number) => x + 10 + (s / tmax) * (w - 20);
    // time grid
    for (let s = 0; s <= tmax; s += 5) {
      ctx.strokeStyle = withAlpha(pal['text-faint'], s % 10 === 0 ? 0.35 : 0.15);
      ctx.lineWidth = 1 / cur;
      ctx.beginPath();
      ctx.moveTo(X(s), y + 22 / cur);
      ctx.lineTo(X(s), y + h - 4);
      ctx.stroke();
      const every = tmax > 100 ? 20 : 10;
      if (s % every === 0) text(`${s}`, X(s), y + h - 6, 9, pal['text-faint'], 'center', 600);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4 / cur;
    ctx.beginPath();
    const amp = (h / 2 - 22 / cur) * 0.95;
    for (let s = 0; s <= Math.min(upto, tmax); s += tmax / 900) {
      const px = X(s);
      const py = mid - trace(s, km) * amp;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (marks) {
      for (const [s, c, n] of [[km / VP, P_COL, 'P'], [km / VS, S_COL, 'S'], [km / VR, R_COL, 'Surface']] as [number, string, string][]) {
        if (s > tmax || s > upto) continue;
        ctx.strokeStyle = c;
        ctx.lineWidth = 2 / cur;
        ctx.beginPath();
        ctx.moveTo(X(s), y + 24 / cur);
        ctx.lineTo(X(s), y + h - 16 / cur);
        ctx.stroke();
        text(n, X(s) + 3 / cur, y + 34 / cur, 10, c, 'left', 800);
      }
    }
    text(label, x + 10, y + 16 / cur, 11, pal['sim-text'], 'left', 750);
  }

  /* ======================= Waves view ======================= */
  const wavesLayout = () =>
    portrait()
      ? { med: { x: 14, y: 70, w: 652, h: 470 }, seis: { x: 14, y: 552, w: 652, h: 436 } }
      : { med: { x: 14, y: 14, w: 972, h: 330 }, seis: { x: 14, y: 356, w: 972, h: 232 } };
  function drawWaves() {
    const L = wavesLayout();
    const M = L.med;
    panel(M.x, M.y, M.w, M.h);
    const W = WAVES[st.wave];
    text(W.name, M.x + 14, M.y + 22, 13, pal['sim-text'], 'left', 800);
    text(W.motion, M.x + 14, M.y + 22 + 17 / cur, 11, pal['text-muted'], 'left', 650);
    const gx0 = M.x + 30;
    const gx1 = M.x + M.w - 30;
    const gy0 = M.y + 40 + 40 / cur;
    const gy1 = M.y + M.h - 40;
    const cols = portrait() ? 22 : 36;
    const rows = portrait() ? 10 : 7;
    const dx = (gx1 - gx0) / (cols - 1);
    const dy = (gy1 - gy0) / (rows - 1);
    const boundary = st.liquid ? gx0 + (gx1 - gx0) * 0.55 : Infinity;
    if (st.liquid) {
      ctx.fillStyle = withAlpha('#4dabf7', 0.15);
      ctx.fillRect(boundary, gy0 - dy * 0.6, gx1 - boundary + dx * 0.6, gy1 - gy0 + dy * 1.2);
      text('Liquid', (boundary + gx1) / 2, gy0 - dy * 0.6 - 6 / cur, 11, '#1c7ed6', 'center', 750);
      text('Solid rock', (gx0 + boundary) / 2, gy0 - dy * 0.6 - 6 / cur, 11, pal['text-muted'], 'center', 750);
    }
    if (st.wave === 'surface') {
      ctx.fillStyle = withAlpha('#8d6e63', 0.18);
      ctx.fillRect(gx0 - dx * 0.6, gy0 - 4, gx1 - gx0 + dx * 1.2, gy1 - gy0 + 8);
      text('Ground surface', gx0, gy0 - 10 / cur, 10.5, pal['text-muted'], 'left', 700);
    }
    const lam = (gx1 - gx0) / 4;
    const speedPx = st.speed * 160;
    const front = (waveT * 80) % ((gx1 - gx0) * 1.6) + gx0;
    const A = st.wave === 'p' ? dx * 0.8 : Math.min(dx, dy) * 0.45;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = gx0 + c * dx;
        const y0 = gy0 + r * dy;
        let ox = 0;
        let oy = 0;
        const inLiquid = x0 > boundary;
        // in the liquid, P-waves slow down (shorter wavelength); S-waves do not pass at all
        const k = (2 * Math.PI) / (inLiquid ? lam * 0.6 : lam);
        const phase = k * (x0 - gx0) - (2 * Math.PI * speedPx * waveT) / lam / 4;
        const reached = x0 < front;
        if (reached) {
          if (st.wave === 'p') ox = A * Math.sin(phase);
          else if (st.wave === 's') oy = inLiquid ? 0 : A * Math.sin(phase);
          else {
            const decay = Math.exp(-r / 2.2);
            ox = A * decay * Math.cos(phase);
            oy = -A * decay * Math.sin(phase);
          }
        }
        const isMarked = c % 6 === 3;
        ctx.fillStyle = isMarked ? (st.wave === 'p' ? P_COL : st.wave === 's' ? S_COL : R_COL) : inLiquid ? '#4dabf7' : pal['text-muted'];
        ctx.beginPath();
        ctx.arc(x0 + ox, y0 + oy, (isMarked ? 4.2 : 3) / cur + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // propagation and particle-motion arrows
    const ay = M.y + M.h - 18;
    arrow(gx0, ay, gx0 + 90, ay, pal['sim-text'], 2);
    text('wave travels', gx0 + 100, ay + 4 / cur, 10.5, pal['text-muted'], 'left', 650);
    const mx = gx1 - 190;
    if (st.wave === 'p') {
      arrow(mx, ay, mx + 34, ay, P_COL, 2);
      arrow(mx + 34, ay, mx, ay, P_COL, 2);
    } else if (st.wave === 's') {
      arrow(mx + 17, ay + 10, mx + 17, ay - 14, S_COL, 2);
      arrow(mx + 17, ay - 14, mx + 17, ay + 10, S_COL, 2);
    } else {
      ctx.strokeStyle = R_COL;
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.ellipse(mx + 17, ay - 2, 14, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    text('particles move', mx + 40, ay + 4 / cur, 10.5, pal['text-muted'], 'left', 650);
    if (st.liquid && st.wave === 's') pill('S-waves cannot travel through liquid', (boundary + gx1) / 2, gy0 + (gy1 - gy0) / 2, 'center', 11.5, pal.danger);
    // seismogram
    const S = L.seis;
    const tmax = Math.max(30, Math.ceil((st.dist / VR) * 1.25 / 10) * 10);
    drawSeismo(S.x, S.y, S.w, S.h, st.dist, tmax, seisT * (tmax / 160), pal['sim-text'], true, `Seismogram ${st.dist} km from the focus (time in seconds)`);
  }

  /* ======================= Locate view ======================= */
  const locLayout = () =>
    portrait()
      ? { map: { x: 14, y: 70, w: 652, h: 490 }, seis: { x: 14, y: 600, w: 652, h: 388 } }
      : { map: { x: 14, y: 14, w: 470, h: 572 }, seis: { x: 496, y: 70, w: 490, h: 518 } };
  let mapFrame = { x: 0, y: 0, s: 1 };
  function drawLocate() {
    const L = locLayout();
    const Mp = L.map;
    panel(Mp.x, Mp.y, Mp.w, Mp.h, pal['surface-2']);
    const s = Math.min((Mp.w - 16) / MAP_W, (Mp.h - 16) / MAP_H);
    const ox = Mp.x + (Mp.w - MAP_W * s) / 2;
    const oy = Mp.y + (Mp.h - MAP_H * s) / 2;
    mapFrame = { x: ox, y: oy, s };
    const P = (x: number, y: number): Pt => [ox + x * s, oy + y * s];
    // land and sea
    ctx.fillStyle = withAlpha('#a5d8ff', 0.35);
    ctx.fillRect(ox, oy, MAP_W * s, MAP_H * s);
    ctx.fillStyle = withAlpha('#b2f2bb', 0.55);
    ctx.beginPath();
    ctx.moveTo(...P(0, 0));
    ctx.lineTo(...P(600, 0));
    ctx.lineTo(...P(600, 300));
    ctx.bezierCurveTo(...P(520, 340), ...P(560, 420), ...P(600, 520));
    ctx.lineTo(...P(0, 520));
    ctx.closePath();
    ctx.fill();
    // grid every 100 km
    ctx.strokeStyle = withAlpha(pal['text-faint'], 0.25);
    ctx.lineWidth = 1 / cur;
    for (let g = 0; g <= 600; g += 100) {
      ctx.beginPath();
      ctx.moveTo(...P(g, 0));
      ctx.lineTo(...P(g, 520));
      ctx.stroke();
    }
    for (let g = 0; g <= 520; g += 100) {
      ctx.beginPath();
      ctx.moveTo(...P(0, g));
      ctx.lineTo(...P(600, g));
      ctx.stroke();
    }
    // scale bar
    const [sx, sy] = P(20, 500);
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2 / cur;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 100 * s, sy);
    ctx.stroke();
    text('100 km', sx + 50 * s, sy - 6 / cur, 10, pal['sim-text'], 'center', 700);
    // distance circles (kept inside the map)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(Mp.x, Mp.y, Mp.w, Mp.h, 10);
    ctx.clip();
    LOC_ST.forEach((stn, i) => {
      const r = (loc.shown ? trueSP(i) : loc.sp[i]) * KM_PER_S;
      ctx.strokeStyle = ST_COLS[i];
      ctx.lineWidth = 2.2 / cur;
      ctx.setLineDash(loc.shown ? [] : [6 / cur, 4 / cur]);
      ctx.beginPath();
      ctx.arc(...P(stn[0], stn[1]), r * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.restore();
    // stations
    LOC_ST.forEach((stn, i) => {
      const [x, y] = P(stn[0], stn[1]);
      ctx.fillStyle = ST_COLS[i];
      ctx.beginPath();
      ctx.moveTo(x, y - 10 / cur);
      ctx.lineTo(x + 8 / cur, y + 6 / cur);
      ctx.lineTo(x - 8 / cur, y + 6 / cur);
      ctx.closePath();
      ctx.fill();
      pill(`Station ${'ABC'[i]}`, x, y + 24 / cur, 'center', 10.5, ST_COLS[i]);
    });
    // true epicenter (after checking or showing)
    if (loc.checked || loc.shown) {
      const [ex, ey] = P(...loc.epi);
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 2.5 / cur;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(ex - 9 / cur, ey - d * 9 / cur);
        ctx.lineTo(ex + 9 / cur, ey + d * 9 / cur);
        ctx.stroke();
      }
      pill('Epicenter', ex, ey - 16 / cur, 'center', 10.5, pal.danger);
    }
    // the student's pin
    const [px, py] = P(...loc.pin);
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
    if (!loc.checked) pill('Drag the pin', px, py - 28 / cur, 'center', 10.5, pal.accent);
    // seismograms
    const Sg = L.seis;
    const gap = 8;
    const h = (Sg.h - 2 * gap) / 3;
    LOC_ST.forEach((stn, i) => {
      const km = Math.hypot(stn[0] - loc.epi[0], stn[1] - loc.epi[1]);
      drawSeismo(Sg.x, Sg.y + i * (h + gap), Sg.w, h, km, 160, 999, ST_COLS[i], st.marks || loc.shown, `Station ${'ABC'[i]}: your S–P = ${loc.sp[i].toFixed(1)} s`);
    });
    text('Time in seconds after the earthquake', Sg.x + 4, Sg.y - 8, 10.5, pal['text-muted'], 'left', 650);
  }

  /* ======================= 3D fault model ======================= */
  let three: ThreeScene | null = null;
  let threeFailed = false;
  let loading3D = false;
  let rebuild = () => {};
  let update3D = () => {};
  let positionLabels = () => {};
  async function ensure3D() {
    if (three || threeFailed || loading3D) return;
    loading3D = true;
    sim.setLoading('Loading the 3D fault model…');
    try {
      const asp = container.clientWidth / Math.max(1, container.clientHeight);
      const back = clamp(Math.pow(asp, -1), 1, 1.8);
      three = await createThreeScene(container, {
        label: 'A 3D block of layered crust cut by a fault, with the earthquake focus, the epicenter and three seismic stations. Drag to rotate; drag the hanging wall to move it.',
        camera: { position: [7.5 * back, 5.5 * back, 8.5 * back], target: [0, -1.4, 0] },
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
      container.innerHTML = '<p class="qk-no3d">3D graphics are not available in this browser, so the fault model cannot be shown. Choose Seismic waves or Locate the epicenter above.</p>';
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
    const foot = new THREE.Group();
    const hang = new THREE.Group();
    world.add(foot, hang);
    const LAYERS: [number, number, string][] = [
      [0, -0.18, '#8a9a5b'],
      [-0.18, -0.9, '#d4b483'],
      [-0.9, -1.7, '#b5651d'],
      [-1.7, -2.7, '#e0c9a6'],
      [-2.7, -4, '#868e96'],
    ];
    const partMeshes: T.Object3D[] = [];
    const tag = <O extends T.Object3D>(o: O, id: PartId): O => {
      o.traverse((c) => (c.userData.part = id));
      partMeshes.push(o);
      return o;
    };
    let planeMesh: T.Mesh | null = null;
    const focus = tag(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshStandardMaterial({ color: '#e03131', emissive: '#801010' })), 'focus');
    world.add(focus);
    const epi = tag(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 5), new THREE.MeshStandardMaterial({ color: '#fab005', emissive: '#6b4f00' })), 'epicenter');
    epi.rotation.x = Math.PI;
    world.add(epi);
    const dashGeo = new THREE.BufferGeometry();
    const dash = new THREE.Line(dashGeo, new THREE.LineDashedMaterial({ color: '#fab005', dashSize: 0.15, gapSize: 0.1 }));
    world.add(dash);
    const stations = STATIONS.map((p, i) => {
      const m = tag(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 3), new THREE.MeshStandardMaterial({ color: ST_COLS[i], emissive: '#000000' })), 'station');
      (stationOnHanging(i) ? hang : foot).add(m);
      m.position.set(p[0], 0.2, p[2]);
      return m;
    });
    // fence posts across the fault
    const posts = Array.from({ length: 25 }, (_, k) => {
      const m = tag(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), new THREE.MeshStandardMaterial({ color: k % 2 ? '#f8f9fa' : '#e03131' })), 'fence');
      world.add(m);
      return m;
    });
    const FENCE_Z = -1.6;
    const postX = (k: number) => -3.6 + k * 0.3;
    // wavefronts, clipped to the block
    // each wavefront is drawn where it meets the front face (a circle) and the ground surface (a circle around the epicenter)
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const faceClip = [new THREE.Plane(V(0, -1, 0), 0.01), new THREE.Plane(V(0, 1, 0), 4), new THREE.Plane(V(1, 0, 0), 4), new THREE.Plane(V(-1, 0, 0), 4)];
    const topClip = [new THREE.Plane(V(1, 0, 0), 4), new THREE.Plane(V(-1, 0, 0), 4), new THREE.Plane(V(0, 0, 1), 3), new THREE.Plane(V(0, 0, -1), 3)];
    const waveMat = (c: string, clip: T.Plane[]) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: clip });
    const ring = new THREE.RingGeometry(0.965, 1, 96);
    const mkRing = (c: string, flat: boolean) => {
      const m = new THREE.Mesh(ring, waveMat(c, flat ? topClip : faceClip));
      if (flat) m.rotation.x = -Math.PI / 2;
      world.add(m);
      return m;
    };
    const pFace = mkRing(P_COL, false);
    const sFace = mkRing(S_COL, false);
    const pTop = mkRing(P_COL, true);
    const sTop = mkRing(S_COL, true);
    const rings = [pFace, sFace, pTop, sTop];

    rebuild = () => {
      for (const g of [foot, hang]) for (const c of [...g.children]) if (c.userData.part !== 'station') g.remove(c);
      for (const [y0, y1, col] of LAYERS) {
        for (const side of ['foot', 'hang'] as const) {
          const shape = new THREE.Shape();
          const a = faultX(y0);
          const b = faultX(y1);
          if (side === 'foot') {
            shape.moveTo(-4, y0);
            shape.lineTo(a, y0);
            shape.lineTo(b, y1);
            shape.lineTo(-4, y1);
          } else {
            shape.moveTo(a, y0);
            shape.lineTo(4, y0);
            shape.lineTo(4, y1);
            shape.lineTo(b, y1);
          }
          const geo = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false });
          geo.translate(0, 0, -3);
          const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, flatShading: true }));
          tag(mesh, side === 'foot' ? 'footwall' : 'hanging');
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#3b2a20', transparent: true, opacity: 0.35 }));
          (side === 'foot' ? foot : hang).add(mesh, edges);
        }
      }
      if (planeMesh) world.remove(planeMesh);
      const xb = faultX(-4);
      const g = new THREE.BufferGeometry();
      // red traces of the fault: down the front face and along the ground surface
      const w = 0.05;
      const v = (x: number, y: number, z: number) => [x, y, z];
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [
            ...v(-w, 0, FRONT - 0.01), ...v(w, 0, FRONT - 0.01), ...v(xb + w, -4, FRONT - 0.01),
            ...v(-w, 0, FRONT - 0.01), ...v(xb + w, -4, FRONT - 0.01), ...v(xb - w, -4, FRONT - 0.01),
            ...v(-w, 0.015, -3), ...v(w, 0.015, -3), ...v(w, 0.015, 3),
            ...v(-w, 0.015, -3), ...v(w, 0.015, 3), ...v(-w, 0.015, 3),
          ],
          3,
        ),
      );
      g.computeVertexNormals();
      planeMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#e03131', side: THREE.DoubleSide }));
      tag(planeMesh, 'fault');
      world.add(planeMesh);
      view.requestRender();
    };
    rebuild();

    // labels
    const layer = document.createElement('div');
    layer.className = 'earth-labels';
    layer.setAttribute('aria-hidden', 'true');
    container.appendChild(layer);
    const mk = (s: string) => {
      const el = document.createElement('span');
      el.textContent = s;
      layer.appendChild(el);
      return el;
    };
    const lab = { focus: mk('Focus'), epi: mk('Epicenter'), hang: mk('Hanging wall'), foot: mk('Footwall'), fault: mk('Fault'), st: STATIONS.map((_, i) => mk(`Station ${'ABC'[i]}`)) };
    const tmp = new THREE.Vector3();
    const place = (el: HTMLElement, p: T.Vector3, show: boolean) => {
      tmp.copy(p).project(camera);
      el.style.display = show && tmp.z < 1 ? '' : 'none';
      el.style.transform = `translate(${((tmp.x + 1) / 2) * container.clientWidth}px, ${((1 - tmp.y) / 2) * container.clientHeight}px) translate(-50%, -50%)`;
    };
    positionLabels = () => {
      const f = focusPos();
      const showAll = st.labels;
      place(lab.focus, new THREE.Vector3(f[0], f[1] - 0.4, f[2]), true);
      place(lab.epi, new THREE.Vector3(f[0], 0.85 + (f[0] > 0 ? hang.position.y : 0), f[2] - 0.2), true);
      const sd = st.fault === 'strike';
      place(lab.hang, new THREE.Vector3(3, 0.35, sd ? 2.5 : -2.6).add(hang.position), showAll);
      place(lab.foot, new THREE.Vector3(-3, 0.35, sd ? 2.5 : -2.6), showAll);
      place(lab.fault, new THREE.Vector3(faultX(-3.2), -3.2, -3), showAll);
      lab.st.forEach((el, i) => place(el, stations[i].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.45, 0)), showAll));
    };

    update3D = () => {
      const d = slipDir();
      const vis = fm.offset * VIS_PER_M;
      hang.position.set(d[0] * vis, d[1] * vis, d[2] * vis);
      const f = focusPos();
      focus.position.set(...f);
      const ground = f[0] > 0 ? hang.position.y : 0;
      epi.position.set(f[0], 0.35 + ground, f[2] - 0.2);
      dashGeo.setFromPoints([new THREE.Vector3(...f), new THREE.Vector3(f[0], ground, f[2])]);
      dash.computeLineDistances();
      if (planeMesh) planeMesh.visible = st.plane;
      // fence: elastic bending while strain builds, a clean offset after the slip
      const el = fm.eqT >= 0 ? 0 : fm.strain * st.slip * VIS_PER_M;
      posts.forEach((m, k) => {
        const x = postX(k);
        const onHang = x > faultX(0);
        // continuous elastic bend across the fault, plus the permanent offset of the hanging wall
        const u = (onHang ? vis : 0) + el * (0.5 + 0.5 * Math.tanh(x / 1.1));
        m.position.set(x + d[0] * u, 0.11 + d[1] * u, FENCE_Z + d[2] * u);
      });
      // shaking and waves
      if (fm.eqT >= 0) {
        const amp = 0.012 * Math.max(0.5, fm.lastMw - 3.5) * Math.exp(-1.6 * fm.eqT);
        world.position.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
        const secs = fm.eqT * st.speed * 2; // simulated seconds
        const rp = (secs * VP) / UNIT_KM;
        const rs = (secs * VS) / UNIT_KM;
        const dep = -f[1];
        [[pFace, rp], [sFace, rs]].forEach(([m, r]) => {
          const mm = m as T.Mesh;
          mm.visible = (r as number) > 0.02 && (r as number) < 14;
          mm.position.set(...f);
          mm.scale.setScalar(Math.max(0.01, r as number));
        });
        [[pTop, rp], [sTop, rs]].forEach(([m, r]) => {
          const mm = m as T.Mesh;
          const rr = Math.sqrt(Math.max(0, (r as number) ** 2 - dep * dep));
          mm.visible = rr > 0.02 && rr < 14;
          mm.position.set(f[0], ground + 0.03, f[2] - 0.02);
          mm.scale.setScalar(Math.max(0.01, rr));
        });
        stations.forEach((m, i) => {
          const km = stationKm(i);
          const hitS = secs >= km / VS && secs < km / VS + 1.2;
          const hitP = secs >= km / VP && secs < km / VP + 1.2;
          (m.material as T.MeshStandardMaterial).emissive.set(hitS ? S_COL : hitP ? P_COL : '#000000');
          m.scale.setScalar(hitS ? 1.5 : hitP ? 1.25 : 1);
        });
      } else {
        world.position.set(0, 0, 0);
        for (const m of rings) m.visible = false;
        stations.forEach((m) => {
          (m.material as T.MeshStandardMaterial).emissive.set('#000000');
          m.scale.setScalar(1);
        });
      }
    };

    // click to inspect
    view.onPick(
      () => partMeshes,
      (hit, at) => {
        const id = hit?.object.userData.part as PartId | undefined;
        if (!id) {
          sim.hideTooltip();
          return;
        }
        let extra = '';
        if (id === 'focus') extra = ` Depth ${st.depth} km.`;
        if (id === 'epicenter') extra = st.fault === 'strike' ? '' : ` Here it is ${(Math.abs(focusPos()[0]) * UNIT_KM).toFixed(1)} km from where the fault meets the surface.`;
        if (id === 'hanging' || id === 'footwall') extra = ` ${FAULTS[st.fault].name}: ${FAULTS[st.fault].motion.toLowerCase()}.`;
        sim.showTooltip(at.x, at.y, PARTS[id].name, `${PARTS[id].text}${extra}`);
      },
    );

    // drag the hanging wall along the slip direction
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let dragging: { x: number; y: number; offset: number } | null = null;
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // only the hanging-wall rock counts (not its outline edges), and only if nothing nearer is in the way
      const first = ray.intersectObjects([...foot.children, ...hang.children], false).find((h) => (h.object as T.Mesh).isMesh);
      if (first && first.object.userData.part === 'hanging' && fm.eqT < 0) {
        dragging = { x: e.clientX, y: e.clientY, offset: fm.offset };
        view.controls.enabled = false;
        cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      // project the slip direction to the screen and move along it
      const d = slipDir();
      const a = new THREE.Vector3(0, -1, 0).project(camera);
      const b = new THREE.Vector3(d[0], -1 + d[1], d[2]).project(camera);
      const r = cv.getBoundingClientRect();
      const vx = ((b.x - a.x) / 2) * r.width;
      const vy = (-(b.y - a.y) / 2) * r.height;
      const len2 = vx * vx + vy * vy || 1;
      const along = ((e.clientX - dragging.x) * vx + (e.clientY - dragging.y) * vy) / len2;
      fm.offset = clamp(dragging.offset + along / VIS_PER_M, 0, MAX_OFFSET);
      offsetCtl.set(Math.round(fm.offset * 10) / 10, false);
      lastMsg = `You are moving the hanging wall: ${FAULTS[st.fault].motion.toLowerCase()}. Offset ${fm.offset.toFixed(1)} m (drawn exaggerated). Real faults move like this in sudden slips, not smoothly.`;
      view.requestRender();
      sim.requestRender();
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = null;
      view.controls.enabled = true;
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    update3D();
    positionLabels();
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
      if (st.view === 'waves') drawWaves();
      else drawLocate();
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
      const F = FAULTS[st.fault];
      const fx = Math.abs(focusPos()[0]) * UNIT_KM;
      r('r1', 'Fault type', `${F.name}: ${F.motion.toLowerCase()}`);
      r('r2', 'Stored elastic strain', `${Math.round(fm.strain * 100)}% of rock strength`, fm.strain > 0.8 ? 'warn' : null);
      r('r3', 'Last earthquake', fm.quakes ? `Slip ${fm.lastSlip.toFixed(2)} m · Mw ${fm.lastMw.toFixed(1)}` : 'None yet');
      r('r4', 'Focus and epicenter', `Focus ${st.depth} km deep${st.fault === 'strike' ? '' : `; epicenter ${fx.toFixed(1)} km from the fault trace`}`);
      const kms = STATIONS.map((_, i) => stationKm(i));
      const near = kms.indexOf(Math.min(...kms));
      const rel = kms.map((k) => Math.round((Math.min(...kms) / k) * 100));
      r('r5', 'Shaking at A · B · C', fm.quakes ? `${rel.join('% · ')}% (relative)` : `P then S: ${(kms[near] / VP).toFixed(1)} s, ${(kms[near] / VS).toFixed(1)} s at ${'ABC'[near]}`);
      r('r6', 'Total offset', `${fm.offset.toFixed(1)} m after ${fm.quakes} earthquake${fm.quakes === 1 ? '' : 's'}`);
      note ||= threeFailed
        ? '3D graphics are not available in this browser. The Seismic waves and Locate views still work.'
        : `${F.name}: ${F.text} Press Start to let tectonic forces load the fault, or drag the hanging wall. Stress: ${F.stress.toLowerCase()}. Example: ${F.example}.`;
      sim.setBadge(fm.quakes ? `Mw ${fm.lastMw.toFixed(1)}` : `Strain ${Math.round(fm.strain * 100)}%`);
    } else if (st.view === 'waves') {
      const W = WAVES[st.wave];
      r('r1', 'Wave', W.name);
      r('r2', 'Particle motion', W.motion);
      r('r3', 'Speed', W.speed);
      r('r4', 'Passes through liquid?', W.liquid, st.wave === 's' ? 'warn' : null);
      r('r5', `Arrivals at ${st.dist} km`, `P ${(st.dist / VP).toFixed(1)} s · S ${(st.dist / VS).toFixed(1)} s · surface ${(st.dist / VR).toFixed(1)} s`);
      r('r6', 'S–P time', `${(st.dist / VS - st.dist / VP).toFixed(1)} s (grows with distance)`);
      note ||= W.text;
      sim.setBadge(W.name.split(' (')[0]);
      canvas.setAttribute('aria-label', `${W.name}: ${W.motion}. Seismogram at ${st.dist} kilometres.`);
    } else {
      LOC_ST.forEach((_, i) => r(`r${i + 1}`, `Station ${'ABC'[i]} distance`, `${(loc.sp[i] * KM_PER_S).toFixed(0)} km (S–P ${loc.sp[i].toFixed(1)} s)`));
      r('r4', 'Distance rule', `d = ${KM_PER_S.toFixed(1)} km/s × (S–P)`);
      r('r5', 'Your pin', loc.checked ? `${loc.err.toFixed(0)} km from the epicenter` : 'Not checked yet', loc.checked ? (loc.err < 25 ? 'ok' : loc.err < 60 ? 'warn' : 'bad') : null);
      r('r6', 'Best try', Number.isFinite(loc.best) ? `${loc.best.toFixed(0)} km (${loc.tries} checks)` : '—');
      note ||= 'Read the S–P time on each seismogram (the gap between the first small wiggles and the larger S-wave), set it with the station sliders, then drag the pin to where the three circles meet and press Check.';
      sim.setBadge(loc.checked ? `${loc.err.toFixed(0)} km off` : 'Find the epicenter');
      canvas.setAttribute('aria-label', 'Map with three seismic stations and distance circles.');
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.dataset.qkView = st.view === '3d' ? '3d' : '2d';
    ui.showWhen('[data-only="3d"]', st.view === '3d');
    ui.showWhen('[data-only="waves"]', st.view === 'waves');
    ui.showWhen('[data-only="locate"]', st.view === 'locate');
    if (st.view === '3d') {
      void ensure3D();
      three?.setAnimating(true);
    } else three?.setAnimating(false);
  }
  const viewCtl = ui.choice<View>('qk-view', (v) => {
    st.view = v;
    lastMsg = '';
    sim.hideTooltip();
    if (v === 'waves') {
      seisT = 0;
      if (!sim.running) sim.play();
    }
    showView();
    sim.requestRender();
  });
  const faultCtl = ui.choice<FaultId>('qk-fault', (v) => {
    st.fault = v;
    fm.offset = 0;
    fm.strain = 0;
    fm.quakes = 0;
    fm.eqT = -1;
    offsetCtl.set(0, false);
    lastMsg = '';
    rebuild();
    sim.requestRender();
  });
  const slipCtl = ui.range('qk-slip', (v) => `${v.toFixed(1)} m`, (v) => ((st.slip = v), sim.requestRender()));
  const lenCtl = ui.range('qk-length', (v) => `${v} km`, (v) => ((st.length = v), sim.requestRender()));
  const depthCtl = ui.range('qk-depth', (v) => `${v} km`, (v) => ((st.depth = v), sim.requestRender()));
  const speedCtl = ui.range('qk-speed', (v) => `${v.toFixed(2)}×`, (v) => {
    st.speed = v;
    speed2Ctl.set(v, false);
  });
  const speed2Ctl = ui.range('qk-speed2', (v) => `${v.toFixed(2)}×`, (v) => {
    st.speed = v;
    speedCtl.set(v, false);
  });
  const offsetCtl = ui.range('qk-offset', (v) => `${v.toFixed(1)} m`, (v) => {
    if (fm.eqT >= 0) return;
    fm.offset = v;
    sim.requestRender();
  });
  const planeCtl = ui.toggle('qk-plane', (v) => (st.plane = v));
  const labelCtl = ui.toggle('qk-labels', (v) => (st.labels = v));
  root.querySelector('[data-quake]')?.addEventListener('click', () => {
    triggerQuake(false);
    if (!sim.running) sim.play();
  });
  const waveCtl = ui.choice<WaveId>('qk-wave', (v) => {
    st.wave = v;
    lastMsg = '';
    waveT = 0;
    sim.requestRender();
  });
  const liquidCtl = ui.toggle('qk-liquid', (v) => {
    st.liquid = v;
    lastMsg = v ? 'A liquid layer, like Earth’s outer core: P-waves pass through it (more slowly), but S-waves stop at the boundary because a liquid cannot be sheared.' : '';
    sim.requestRender();
  });
  const distCtl = ui.range('qk-dist', (v) => `${v} km`, (v) => {
    st.dist = v;
    seisT = 0;
    sim.requestRender();
  });
  root.querySelector('[data-replay]')?.addEventListener('click', () => {
    seisT = 0;
    waveT = 0;
    if (!sim.running) sim.play();
  });
  const spCtls = [0, 1, 2].map((i) =>
    ui.range(`qk-sp${i}`, (v) => `${v.toFixed(1)} s`, (v) => {
      loc.sp[i] = v;
      sim.requestRender();
    }),
  );
  const marksCtl = ui.toggle('qk-marks', (v) => ((st.marks = v), sim.requestRender()));
  root.querySelector('[data-check]')?.addEventListener('click', () => {
    loc.err = Math.hypot(loc.pin[0] - loc.epi[0], loc.pin[1] - loc.epi[1]);
    loc.checked = true;
    loc.tries++;
    loc.best = Math.min(loc.best, loc.err);
    lastMsg =
      loc.err < 25
        ? `Excellent: your pin is ${loc.err.toFixed(0)} km from the true epicenter (red cross).`
        : loc.err < 60
          ? `Close: ${loc.err.toFixed(0)} km away. Check each S–P reading again: a 1 s error moves a circle by ${KM_PER_S.toFixed(1)} km.`
          : `${loc.err.toFixed(0)} km away. The epicenter is where all three circles meet; re-read the S–P times on the seismograms.`;
    sim.requestRender();
  });
  root.querySelector('[data-show]')?.addEventListener('click', () => {
    loc.shown = true;
    loc.checked = true;
    loc.err = Math.hypot(loc.pin[0] - loc.epi[0], loc.pin[1] - loc.epi[1]);
    lastMsg = 'Here are the correct circles. Each one has a radius equal to that station’s distance; only one point is the right distance from all three.';
    sim.requestRender();
  });
  root.querySelector('[data-new]')?.addEventListener('click', () => {
    newQuake();
    lastMsg = 'A new earthquake has been recorded. Read the three seismograms and find it.';
    sim.requestRender();
  });

  /* ======================= Pointer (2D) ======================= */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  const toMap = ([bx, by]: Pt): Pt => [(bx - mapFrame.x) / mapFrame.s, (by - mapFrame.y) / mapFrame.s];
  enableDrag<'pin'>(canvas, {
    hit(x, y) {
      if (st.view !== 'locate') return null;
      const [mx, my] = toMap(toBox(x, y));
      return Math.hypot(mx - loc.pin[0], my - loc.pin[1]) < 40 ? 'pin' : null;
    },
    move(_id, x, y) {
      const [mx, my] = toMap(toBox(x, y));
      loc.pin = [clamp(mx, 0, MAP_W), clamp(my, 0, MAP_H)];
      loc.checked = loc.shown;
      sim.requestRender();
    },
    click(x, y) {
      if (st.view !== 'locate') return;
      const [mx, my] = toMap(toBox(x, y));
      const i = LOC_ST.findIndex((s) => Math.hypot(s[0] - mx, s[1] - my) < 30);
      if (i >= 0) sim.showTooltip(x, y, `Station ${'ABC'[i]}`, `Your S–P reading of ${loc.sp[i].toFixed(1)} s puts the earthquake ${(loc.sp[i] * KM_PER_S).toFixed(0)} km away: somewhere on this station’s circle.`);
      else sim.hideTooltip();
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, { fault: 'normal', slip: 1, length: 20, depth: 10, speed: 0.5, plane: true, labels: false, wave: 'p', liquid: false, dist: 150, marks: false });
      faultCtl.set('normal', false);
      slipCtl.set(1, false);
      lenCtl.set(20, false);
      depthCtl.set(10, false);
      speedCtl.set(0.5, false);
      speed2Ctl.set(0.5, false);
      planeCtl.set(true, false);
      labelCtl.set(false, false);
      waveCtl.set('p', false);
      liquidCtl.set(false, false);
      distCtl.set(150, false);
      marksCtl.set(false, false);
      offsetCtl.set(0, false);
      Object.assign(fm, { strain: 0, offset: 0, quakes: 0, eqT: -1, slipFrom: 0, slipTo: 0, lastSlip: 0, lastMw: 0 });
      loc.sp = [10, 10, 10];
      spCtls.forEach((c) => c.set(10, false));
      loc.tries = 0;
      loc.best = Infinity;
      newQuake();
      waveT = 0;
      seisT = 0;
      lastMsg = '';
      viewCtl.set(st.view, false);
      rebuild();
      showView();
    },
  });

  showView();
  sim.requestRender();
}
