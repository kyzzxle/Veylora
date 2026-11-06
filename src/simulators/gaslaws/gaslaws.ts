/**
 * Gas laws in a sealed cylinder with a piston.
 *
 * Particles are ideal-gas points: they do not attract each other and take up
 * no space, and (as in the simplest kinetic theory) they do not collide with
 * each other, only with the walls. The bottom and side walls exchange heat
 * with the gas: a particle bouncing off them leaves with a speed drawn from
 * the thermal (Maxwell–Boltzmann) distribution at the heater temperature, so
 * the gas warms or cools towards it. The piston is insulated and can move.
 *
 * Pressure is measured, not calculated: every bounce pushes on the wall, and
 * the gauge adds up those pushes over the last three seconds and divides by the
 * wall length and the time. A fixed calibration converts this 2D measurement
 * to kilopascals, so that on average it agrees with PV = nRT for the amount of
 * gas each dot represents (0.001 mol, about 6 × 10²⁰ molecules).
 *
 * In "Charles's law" mode the piston is free: it rises when the measured
 * pressure is above the fixed outside pressure and falls when it is below.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'sim-water', 'warning', 'danger', 'success', 'surface-2'] as const;
type Fs = (px: number, w?: number) => string;
type Mode = 'explore' | 'boyle' | 'charles' | 'gaylussac';

const R = 8.314;
const MOL_PER_DOT = 0.001;
const CYL_W = 360; // design px
const PX_PER_L = 84; // cylinder height per litre
const A_PER_L = CYL_W * PX_PER_L;
const CV = 200; // rms speed of one velocity component at 300 K, design px/s
// kPa per unit of measured 2D pressure (impulse per wall length per second): P_real / P_2D = n_dot·R·A_per_L·300 / CV²
const K_KPA = (MOL_PER_DOT * R * A_PER_L * 300) / (CV * CV);
const WINDOW = 3; // seconds of collisions averaged by the gauge
const BIN = 0.1;
const V_MIN = 1;
const V_MAX = 5;
const DEF = { mode: 'explore' as Mode, V: 2.5, T: 300, n: 0.2 };

interface P {
  x: number;
  y: number; // height above the cylinder floor (y up)
  vx: number;
  vy: number;
}
interface Hit {
  x: number;
  y: number;
  side: 'b' | 'l' | 'r' | 'p';
  age: number;
}

const gauss = () => {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
};
/** Speed component normal to a wall for a particle leaving a wall at temperature T (flux-weighted, Rayleigh). */
const rayleigh = (s: number) => s * Math.sqrt(-2 * Math.log(1 - Math.random()));

const MODE_INFO: Record<Mode, { title: string; law: string; constant: string; note: string }> = {
  explore: {
    title: 'Explore the gas',
    law: 'PV = nRT',
    constant: 'Nothing is held constant: change anything.',
    note: 'Change the volume, temperature or amount of gas and watch the pressure gauge. Each bounce off a wall is a tiny push; pressure is all those pushes added up.',
  },
  boyle: {
    title: 'Boyle’s law',
    law: 'P × V = constant',
    constant: 'Held constant: temperature and amount of gas.',
    note: 'Drag the volume slider. Squeezing the gas into half the space doubles how often particles hit each part of the wall, so the pressure doubles. Wait for the gauge to settle, then press Record point.',
  },
  charles: {
    title: 'Charles’s law',
    law: 'V ÷ T = constant',
    constant: 'Held constant: pressure (the piston is free, with the same air and weight pushing on it) and amount of gas.',
    note: 'Change the temperature. Faster particles push harder on the free piston, so it rises until the pressure inside again matches the pressure outside. Temperatures must be in kelvin.',
  },
  gaylussac: {
    title: 'Pressure–temperature law (Gay-Lussac’s law)',
    law: 'P ÷ T = constant',
    constant: 'Held constant: volume (the piston is locked) and amount of gas.',
    note: 'Change the temperature. Hotter particles move faster, so they hit the walls more often and harder: the pressure rises in proportion to the kelvin temperature.',
  },
};

export function initGasLaws(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let parts: P[] = [];
  let hits: Hit[] = [];
  let h = DEF.V * PX_PER_L; // piston height above the floor
  let vp = 0; // piston velocity
  let bins: number[] = [0];
  let binT = 0;
  let pMeas = 0; // kPa, from collisions
  let pShown = 0;
  let pExt = 0; // outside pressure in Charles mode
  let t = 0;
  let stop = '';
  let samples: Point[] = []; // recorded points
  let trace: { meas: Point[]; ideal: Point[] } = { meas: [], ideal: [] };

  const sigma = (T: number) => CV * Math.sqrt(T / 300);
  const N = () => parts.length;
  const vol = () => h / PX_PER_L;
  const pIdeal = () => (st.n * R * st.T) / (vol() / 1000) / 1000; // kPa, at the heater temperature
  let tSmooth = DEF.T;
  /** Instantaneous temperature from the particles' kinetic energy (noisy with only ~100 particles). */
  const tInst = () => {
    if (!parts.length) return st.T;
    let s = 0;
    for (const p of parts) s += p.vx * p.vx + p.vy * p.vy;
    return (300 * (s / parts.length)) / (2 * CV * CV);
  };
  /** Thermometer reading: the kinetic temperature averaged over about a second, like a real thermometer. */
  const tGas = () => tSmooth;
  const pKinetic = () => (N() * MOL_PER_DOT * R * tGas()) / (vol() / 1000) / 1000;

  function newParticle(T: number, nearTop = false): P {
    const s = sigma(T);
    return { x: 6 + Math.random() * (CYL_W - 12), y: nearTop ? h * (0.7 + 0.25 * Math.random()) : 4 + Math.random() * (h - 8), vx: gauss() * s, vy: gauss() * s };
  }
  function setAmount(n: number, refill = false) {
    const target = Math.round(n / MOL_PER_DOT);
    if (refill) parts = [];
    while (parts.length < target) parts.push(newParticle(st.T, !refill));
    while (parts.length > target) parts.splice(Math.floor(Math.random() * parts.length), 1);
  }
  function restart() {
    h = st.V * PX_PER_L;
    vp = 0;
    setAmount(st.n, true);
    bins = [0];
    binT = 0;
    pMeas = pShown = pIdeal();
    tSmooth = st.T;
    hits = [];
    t = 0;
    trace = { meas: [], ideal: [] };
  }

  /* ---------- Model ---------- */
  function step(dt: number) {
    t += dt;
    // piston
    const hOld = h;
    if (st.mode === 'charles') {
      // free piston: moves until the measured inside pressure matches the outside pressure
      const ratio = pShown / pExt;
      h = h * (1 + clamp(ratio - 1, -0.6, 0.6) * dt * 0.6);
    } else {
      const target = st.V * PX_PER_L;
      const maxStep = 260 * dt;
      h += clamp(target - h, -maxStep, maxStep);
    }
    stop = '';
    if (h < V_MIN * PX_PER_L) (h = V_MIN * PX_PER_L), (stop = 'bottom');
    if (h > V_MAX * PX_PER_L) (h = V_MAX * PX_PER_L), (stop = 'top');
    vp = dt > 0 ? (h - hOld) / dt : 0;

    const s = sigma(st.T);
    let impulse = 0;
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) {
        p.x = -p.x;
        impulse += 2 * Math.abs(p.vx);
        p.vx = rayleigh(s);
        p.vy = gauss() * s;
        hits.push({ x: 0, y: p.y, side: 'l', age: 0 });
      } else if (p.x > CYL_W) {
        p.x = 2 * CYL_W - p.x;
        impulse += 2 * Math.abs(p.vx);
        p.vx = -rayleigh(s);
        p.vy = gauss() * s;
        hits.push({ x: CYL_W, y: p.y, side: 'r', age: 0 });
      }
      if (p.y < 0) {
        p.y = -p.y;
        impulse += 2 * Math.abs(p.vy);
        p.vy = rayleigh(s);
        p.vx = gauss() * s;
        hits.push({ x: p.x, y: 0, side: 'b', age: 0 });
      } else if (p.y > h) {
        // insulated moving piston: elastic bounce in the piston's frame
        p.y = Math.max(0, 2 * h - p.y);
        const rel = p.vy - vp;
        if (rel > 0) {
          impulse += 2 * rel;
          p.vy = 2 * vp - p.vy;
        }
        hits.push({ x: p.x, y: h, side: 'p', age: 0 });
      }
      if (p.y > h) p.y = h * Math.random();
    }
    // gauge: impulse per unit wall length per second, averaged over WINDOW seconds
    bins[bins.length - 1] += impulse;
    binT += dt;
    if (binT >= BIN) {
      binT -= BIN;
      bins.push(0);
      if (bins.length > WINDOW / BIN + 1) bins.shift();
    }
    const span = (bins.length - 1) * BIN + binT;
    if (span > 0.3) {
      const perim = 2 * (CYL_W + h);
      const p2 = bins.reduce((a, b) => a + b, 0) / (perim * span);
      pMeas = p2 * K_KPA;
    }
    pShown += (pMeas - pShown) * Math.min(1, dt * 3);
    tSmooth += (tInst() - tSmooth) * Math.min(1, dt * 0.6);
    for (const hh of hits) hh.age += dt;
    hits = hits.filter((hh) => hh.age < 0.3).slice(-300);
    // time traces for Explore
    const last = trace.meas[trace.meas.length - 1];
    if (!last || t - last.x >= 0.2) {
      trace.meas.push({ x: t, y: pShown });
      trace.ideal.push({ x: t, y: pKinetic() });
      while (trace.meas.length && trace.meas[0].x < t - 60) trace.meas.shift(), trace.ideal.shift();
    }
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1000] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  const cyl = () => (portrait() ? { x: 40, floor: 530 } : { x: 40, floor: 540 });
  const gauge = () => (portrait() ? { x: 545, y: 205, r: 85 } : { x: 545, y: 170, r: 92 });
  const thermo = () => (portrait() ? { x: 535, y: 390, h: 112 } : { x: 535, y: 350, h: 140 });
  const card = () => (portrait() ? { x: 30, y: 600, w: 620 } : { x: 668, y: 95, w: 315 });

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];
  const speedColour = (v: number) => {
    const f = clamp(v / (CV * 2.4), 0, 1);
    return `hsl(${Math.round(225 - 220 * f)}, 80%, ${Math.round(52 + 4 * f)}%)`;
  };

  function drawCylinder(fs: Fs, k: number) {
    const c = cyl();
    const top = c.floor - V_MAX * PX_PER_L - 24;
    const py = c.floor - h;
    // heater
    const heat = clamp((st.T - 100) / 500, 0, 1);
    ctx.fillStyle = `hsl(${Math.round(210 - 210 * heat)}, 75%, ${Math.round(55)}%)`;
    ctx.beginPath();
    ctx.roundRect(c.x - 10, c.floor + 8, CYL_W + 20, 14, 6);
    ctx.fill();
    ctx.font = fs(10.5, 650);
    ctx.fillStyle = pal['text-faint'];
    if (portrait()) {
      ctx.textAlign = 'center';
      ctx.fillText(`Heater ${st.T} K`, c.x + CYL_W / 2, c.floor + 24 + 14 / k);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(`Heater ${st.T} K`, c.x + CYL_W + 16, c.floor + 20);
    }
    // gas region
    ctx.fillStyle = pal['surface-2'];
    ctx.globalAlpha = 0.5;
    ctx.fillRect(c.x, py, CYL_W, h);
    ctx.globalAlpha = 1;
    // walls
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(c.x - 2, top);
    ctx.lineTo(c.x - 2, c.floor + 2);
    ctx.lineTo(c.x + CYL_W + 2, c.floor + 2);
    ctx.lineTo(c.x + CYL_W + 2, top);
    ctx.stroke();
    // volume scale
    ctx.font = fs(9.5, 600);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pal['text-faint'];
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.2 / k;
    for (let L = 1; L <= V_MAX; L++) {
      const yy = c.floor - L * PX_PER_L;
      ctx.beginPath();
      ctx.moveTo(c.x - 4, yy);
      ctx.lineTo(c.x - 12, yy);
      ctx.stroke();
      ctx.fillText(`${L} L`, c.x - 15, yy);
    }
    ctx.textBaseline = 'alphabetic';
    // collision flashes
    for (const hh of hits) {
      const a = 1 - hh.age / 0.3;
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = hh.side === 'p' ? pal.warning : pal.danger;
      const hx = c.x + hh.x;
      const hy = c.floor - hh.y;
      if (hh.side === 'b' || hh.side === 'p') ctx.fillRect(hx - 5, hy - 2, 10, 4);
      else ctx.fillRect(hx - 2, hy - 5, 4, 10);
    }
    ctx.globalAlpha = 1;
    // particles
    for (const p of parts) {
      ctx.fillStyle = speedColour(Math.hypot(p.vx, p.vy));
      ctx.beginPath();
      ctx.arc(c.x + p.x, c.floor - p.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // piston
    const locked = st.mode === 'gaylussac';
    ctx.fillStyle = pal['border-strong'];
    ctx.fillRect(c.x + 2, py - 16, CYL_W - 4, 16);
    ctx.fillRect(c.x + CYL_W / 2 - 7, top - 30, 14, py - 16 - top + 30);
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 2, py - 16, CYL_W - 4, 16);
    if (st.mode === 'charles') {
      // a fixed weight (plus the air) pushes down with constant pressure
      ctx.fillStyle = pal['text-muted'];
      ctx.beginPath();
      ctx.roundRect(c.x + CYL_W / 2 - 50, py - 60, 100, 40, 6);
      ctx.fill();
      ctx.fillStyle = pal['bg-elev'];
      ctx.font = fs(10.5, 700);
      ctx.textAlign = 'center';
      ctx.fillText('weight', c.x + CYL_W / 2, py - 36);
      arrow(ctx, c.x + 40, py - 70, c.x + 40, py - 22, pal['text-faint'], 2.5 / k, 9 / k);
      arrow(ctx, c.x + CYL_W - 40, py - 70, c.x + CYL_W - 40, py - 22, pal['text-faint'], 2.5 / k, 9 / k);
    }
    if (locked || stop) {
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = pal.warning;
      ctx.textAlign = 'right';
      ctx.fillText(locked ? 'Piston locked' : stop === 'top' ? 'At the top stop' : 'At the bottom stop', c.x + CYL_W - 8, py - 24);
    }
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(`V = ${vol().toFixed(2)} L`, c.x + 8, py - 24);
    areas.push(
      { test: (x, y) => x > c.x && x < c.x + CYL_W && y > py && y < c.floor, title: 'Gas particles', text: () => `${N()} dots, each standing for about 6 × 10²⁰ gas molecules (0.001 mol). Colour shows speed: blue slow, red fast. The particles in this model do not attract each other, take up no space and only bounce off the walls: an ideal gas.` },
      { test: (x, y) => x > c.x && x < c.x + CYL_W && y > py - 20 && y <= py, title: locked ? 'Locked piston' : st.mode === 'charles' ? 'Free piston' : 'Piston', text: () => (locked ? 'The piston is fixed, so the volume cannot change.' : st.mode === 'charles' ? 'The piston can slide. It rises when the gas pushes up harder than the weight and air push down, and stops when the pressures balance.' : 'Move the volume slider to push the piston in or pull it out. The gas warms slightly as you compress it quickly, then the walls bring it back to the heater temperature.') },
      { test: (x, y) => x > c.x - 10 && x < c.x + CYL_W + 10 && y > c.floor && y < c.floor + 30, title: 'Heater and cooler', text: () => 'The bottom and side walls are kept at the set temperature. Particles that bounce off them leave with speeds typical of that temperature, so the gas heats up or cools down to match.' },
    );
  }

  function drawGauge(fs: Fs, k: number) {
    const g = gauge();
    const pMax = gaugeMax();
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    const ang = (p: number) => a0 + (a1 - a0) * clamp(p / pMax, 0, 1);
    ctx.font = fs(9, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const v = (pMax * i) / 5;
      const a = ang(v);
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(a) * (g.r - 4), g.y + Math.sin(a) * (g.r - 4));
      ctx.lineTo(g.x + Math.cos(a) * (g.r - 14), g.y + Math.sin(a) * (g.r - 14));
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), g.x + Math.cos(a) * (g.r - 30), g.y + Math.sin(a) * (g.r - 30));
    }
    ctx.textBaseline = 'alphabetic';
    // predicted marker
    const ai = ang(pKinetic());
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r - 6, ai - 0.04, ai + 0.04);
    ctx.stroke();
    // needle
    const a = ang(pShown);
    ctx.strokeStyle = pal.danger;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(a) * (g.r - 16), g.y + Math.sin(a) * (g.r - 16));
    ctx.stroke();
    ctx.fillStyle = pal['sim-text'];
    ctx.beginPath();
    ctx.arc(g.x, g.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = fs(12, 700);
    ctx.fillText(`${Math.round(pShown)} kPa`, g.x, g.y + g.r + 18 / k);
    ctx.font = fs(10, 650);
    ctx.fillStyle = pal['text-faint'];
    if (!portrait()) ctx.fillText('Pressure gauge', g.x, g.y - g.r - 10 / k);
    areas.push({
      test: (x, y) => Math.hypot(x - g.x, y - g.y) < g.r,
      title: 'Pressure gauge',
      text: () => `The red needle shows the pressure measured from collisions over the last 3 seconds: ${Math.round(pShown)} kPa. The green mark is the value PV = nRT predicts for the gas’s current temperature (${Math.round(pKinetic())} kPa). They differ a little because collisions are random. Normal air pressure is about 101 kPa.`,
    });
  }
  const gaugeMax = () => {
    const p = Math.max(pIdeal(), pShown, 1);
    return p < 180 ? 200 : p < 450 ? 500 : p < 900 ? 1000 : 2500;
  };

  function drawThermo(fs: Fs, k: number) {
    const t0 = thermo();
    const w = 20;
    const Tg = tGas();
    const frac = clamp(Tg / 650, 0, 1);
    ctx.fillStyle = pal.border;
    ctx.beginPath();
    ctx.roundRect(t0.x, t0.y, w, t0.h, w / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(t0.x + w / 2, t0.y + t0.h + 10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    ctx.arc(t0.x + w / 2, t0.y + t0.h + 10, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(t0.x + 5, t0.y + t0.h * (1 - frac), w - 10, t0.h * frac + 6);
    ctx.font = fs(10, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    ctx.fillText('Gas', t0.x + w / 2, t0.y - 8 / k);
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`${Math.round(Tg)} K`, t0.x + w / 2, t0.y + t0.h + 30 + 12 / k);
    areas.push({ test: (x, y) => x > t0.x - 14 && x < t0.x + w + 14 && y > t0.y && y < t0.y + t0.h + 40, title: 'Gas temperature', text: () => `Worked out from the particles’ average kinetic energy: ${Math.round(Tg)} K (${Math.round(Tg - 273)} °C). It follows the heater, with a short delay.` });
  }

  function drawCard(fs: Fs, k: number) {
    const c = card();
    const info = MODE_INFO[st.mode];
    const lh = 17 / k;
    let y = c.y + 14 / k;
    ctx.textAlign = 'left';
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(info.title, c.x, y);
    y += 26 / k;
    ctx.font = fs(16, 700);
    ctx.fillStyle = pal.accent;
    ctx.fillText(info.law, c.x, y);
    y += 24 / k;
    ctx.font = fs(11, 600);
    ctx.fillStyle = pal['sim-text'];
    const P = pKinetic();
    const V = vol();
    const T = tGas();
    const lines: string[] =
      st.mode === 'boyle'
        ? [`P × V = ${Math.round(P)} × ${V.toFixed(2)} = ${Math.round(P * V)} kPa·L`]
        : st.mode === 'charles'
          ? [`V ÷ T = ${V.toFixed(2)} ÷ ${Math.round(T)} = ${((1000 * V) / T).toFixed(2)} mL/K`]
          : st.mode === 'gaylussac'
            ? [`P ÷ T = ${Math.round(P)} ÷ ${Math.round(T)} = ${(P / T).toFixed(3)} kPa/K`]
            : [`P = ${Math.round(P)} kPa   V = ${V.toFixed(2)} L`, `n = ${st.n.toFixed(2)} mol   T = ${Math.round(T)} K`];
    for (const l of lines) (ctx.fillText(l, c.x, y), (y += lh));
    ctx.font = fs(10, 600);
    ctx.fillStyle = pal['text-faint'];
    y = wrap(info.constant, c.x, y + 4 / k, c.w, 15 / k);
    if (st.mode !== 'explore') wrap('Values use the gas’s measured temperature; P is the value PV = nRT predicts for it.', c.x, y + 2 / k, c.w, 15 / k);
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

  function render() {
    const { w, h: hh } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, hh);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    if (hintEl) hintEl.style.display = portrait() ? 'none' : '';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    drawCylinder(fs, k);
    drawGauge(fs, k);
    drawThermo(fs, k);
    drawCard(fs, k);
    ctx.restore();
    updateReadouts();
    drawGraph();
  }

  function updateReadouts() {
    const Tg = tGas();
    ui.readout('p', `${Math.round(pShown)} kPa (measured)`);
    ui.readout('pi', `${Math.round(pKinetic())} kPa`);
    ui.readout('v', `${vol().toFixed(2)} L`);
    ui.readout('t', `${Math.round(Tg)} K (${Math.round(Tg - 273)} °C)`);
    ui.readout('n', `${st.n.toFixed(2)} mol (${N()} dots)`);
    // mean speed of nitrogen molecules at this temperature (real value)
    ui.readout('speed', `${Math.round(Math.sqrt((8 * R * Tg) / (Math.PI * 0.028)))} m/s`);
    sim.setBadge({ explore: 'Explore', boyle: 'Boyle’s law', charles: 'Charles’s law', gaylussac: 'P–T law' }[st.mode]);
    canvas.setAttribute('aria-label', `A cylinder of gas with a piston. Volume ${vol().toFixed(2)} litres, temperature ${Math.round(Tg)} kelvin, ${st.n.toFixed(2)} moles. Measured pressure ${Math.round(pShown)} kilopascals.`);
  }

  /* ---------- Graph ---------- */
  const graphEl = root.querySelector<HTMLCanvasElement>('[data-graph="gl-graph"]')!;
  const graph = new LineGraph(graphEl, { x: { min: 0, span: 60 }, y: { min: 0, max: 500, step: 100 } });
  const titleEl = root.querySelector<HTMLElement>('#gl-graph-title')!;
  const descEl = root.querySelector<HTMLElement>('[data-graph-desc="gl-graph"]')!;
  const niceMax = (v: number) => (v <= 200 ? 200 : v <= 500 ? 500 : v <= 1000 ? 1000 : v <= 2000 ? 2000 : 3000);
  function drawGraph() {
    graph.clear();
    const n = st.n;
    if (st.mode === 'explore') {
      titleEl.textContent = 'Pressure over time';
      descEl.textContent = 'Measured pressure and the value predicted by PV = nRT over the last 60 seconds.';
      const top = niceMax(Math.max(...trace.meas.map((p) => p.y), ...trace.ideal.map((p) => p.y), 100));
      graph.opts = { x: { min: Math.max(0, t - 60), span: 60, max: Math.max(60, t), step: 10, format: (v) => `${Math.round(v)} s` }, y: { min: 0, max: top, step: top / 4, format: (v) => `${v}` } };
      graph.set('m', { label: 'Measured pressure (kPa)', color: 'danger', points: trace.meas, width: 2 });
      graph.set('i', { label: 'Predicted by PV = nRT', color: 'accent', points: trace.ideal, width: 2, dash: [6, 4] });
    } else if (st.mode === 'boyle') {
      titleEl.textContent = 'Pressure against volume';
      descEl.textContent = `Recorded pressure–volume points and the curve P = nRT/V for ${n.toFixed(2)} mol at ${st.T} K.`;
      const top = niceMax((n * R * st.T) / 1);
      graph.opts = { x: { min: 0, span: 5, max: 5, step: 1, format: (v) => `${v} L` }, y: { min: 0, max: top, step: top / 4, format: (v) => `${v}` } };
      graph.set('c', { label: 'P = nRT ÷ V', color: 'accent', points: LineGraph.sample((V) => (n * R * st.T) / V, 0.8, 5, 120), width: 2, dash: [6, 4] });
    } else {
      const charles = st.mode === 'charles';
      titleEl.textContent = charles ? 'Volume against temperature' : 'Pressure against temperature';
      descEl.textContent = charles
        ? 'Recorded volume–temperature points and the straight line through absolute zero predicted by Charles’s law.'
        : 'Recorded pressure–temperature points and the straight line through absolute zero predicted by the pressure–temperature law.';
      if (charles) {
        graph.opts = { x: { min: 0, span: 600, max: 600, step: 100, format: (v) => `${v} K` }, y: { min: 0, max: 5, step: 1, format: (v) => `${v} L` } };
        const slope = (n * R) / pExt; // L per K
        graph.set('c', { label: 'V = (nR ÷ P) × T', color: 'accent', points: [{ x: 0, y: 0 }, { x: 600, y: slope * 600 }], width: 2, dash: [6, 4] });
      } else {
        const top = niceMax((n * R * 600) / vol());
        graph.opts = { x: { min: 0, span: 600, max: 600, step: 100, format: (v) => `${v} K` }, y: { min: 0, max: top, step: top / 4, format: (v) => `${v}` } };
        graph.set('c', { label: 'P = (nR ÷ V) × T', color: 'accent', points: [{ x: 0, y: 0 }, { x: 600, y: (n * R * 600) / vol() }], width: 2, dash: [6, 4] });
      }
      graph.opts.refs = [{ value: 0, label: '0 K', color: 'text-faint', axis: 'x' }];
    }
    if (st.mode !== 'explore') graph.set('s', { label: 'Your recorded points', color: 'danger', points: samples, type: 'points' });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="gl-graph"]'));
  }

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const a = [...areas].reverse().find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const vCtl = ui.range('gl-v', (v) => `${v.toFixed(1)} L`, (v) => {
    st.V = v;
    if (!sim.running) sim.play();
  });
  const tCtl = ui.range('gl-t', (v) => `${v} K (${v - 273} °C)`, (v) => {
    st.T = v;
    if (!sim.running) sim.play();
  });
  const nCtl = ui.range('gl-n', (v) => `${v.toFixed(2)} mol`, (v) => {
    st.n = v;
    setAmount(v);
    if (!sim.running) sim.play();
  });
  const lock = (name: string, locked: boolean) => {
    const input = root.querySelector<HTMLInputElement>(`[data-ctrl="${name}"]`)!;
    input.disabled = locked;
    const tag = root.querySelector<HTMLElement>(`[data-lock="${name}"]`);
    if (tag) tag.hidden = !locked;
  };
  function applyMode(m: Mode) {
    st.mode = m;
    samples = [];
    lock('gl-v', m === 'charles' || m === 'gaylussac');
    lock('gl-t', m === 'boyle');
    lock('gl-n', m !== 'explore');
    if (m === 'charles') {
      // hold the outside pressure at the gas's current (predicted) pressure
      pExt = clamp(pIdeal(), 50, 2000);
    }
    if (m !== 'charles') st.V = Math.round(vol() * 10) / 10;
    vCtl.set(st.V, false);
    ui.showWhen('[data-record]', m !== 'explore');
    noteEl.textContent = MODE_INFO[m].note;
    sim.hideTooltip();
    sim.requestRender();
  }
  const modeCtl = ui.choice<Mode>('gl-mode', applyMode);
  root.querySelector('[data-record-btn]')?.addEventListener('click', () => {
    const P = pShown;
    const V = vol();
    const T = tGas();
    const pt = st.mode === 'boyle' ? { x: V, y: P } : st.mode === 'charles' ? { x: T, y: V } : { x: T, y: P };
    samples.push(pt);
    sim.announce(st.mode === 'boyle' ? `Recorded ${V.toFixed(2)} litres at ${Math.round(P)} kilopascals.` : st.mode === 'charles' ? `Recorded ${V.toFixed(2)} litres at ${Math.round(T)} kelvin.` : `Recorded ${Math.round(P)} kilopascals at ${Math.round(T)} kelvin.`);
    sim.requestRender();
  });
  root.querySelector('[data-clear-btn]')?.addEventListener('click', () => ((samples = []), sim.requestRender()));

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      modeCtl.set('explore', false);
      tCtl.set(DEF.T, false);
      nCtl.set(DEF.n, false);
      vCtl.set(DEF.V, false);
      restart();
      applyMode('explore');
    },
  });
  restart();
  applyMode('explore');
}
