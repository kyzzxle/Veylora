/**
 * Electrochemistry: galvanic (voltaic) cells and electrolytic cells.
 *
 * Galvanic: two metal | metal-ion half-cells joined by a wire and a salt
 * bridge. Each electrode's reduction potential follows the Nernst equation,
 *     E = E° + (RT/nF) ln[Mⁿ⁺]   (25 °C, activity ≈ concentration),
 * the electrode with the lower E is the anode, and E_cell = E_cathode − E_anode.
 * With a bulb connected, I = E_cell / (R_internal + R_bulb); the charge passed
 * dissolves the anode and plates the cathode (Faraday's law), changing the
 * concentrations so the voltage gradually falls. Model time: 1 s = 1 hour.
 *
 * Electrolytic: a power supply drives a non-spontaneous reaction. Current
 * flows only above a practical onset voltage: I = (V − V_onset) / R. Products
 * follow Faraday's law (n = Q / zF). Model time: 1 s = 1 minute.
 * Resistances, onset voltages and volumes are illustrative.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';
import { CELLS, F, METALS, MOLAR_GAS_VOLUME, RT_F, type CellId, type MetalId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'sim-water', 'warning', 'danger', 'success', 'surface-2'] as const;
type Fs = (px: number, w?: number) => string;
type Mode = 'galvanic' | 'electrolytic';
type V2 = [number, number];

const ELECTRON = '#f2c94c';
const R_INT = 4;
const R_BULB = 6;
const R_ELECTROLYSIS = 4;
const VOL_L = 0.1; // litres in each half-cell
const VOL_E = 0.2; // litres in the electrolysis cell
const MASS0 = 20; // g, starting mass of each electrode
const DEF = { mode: 'galvanic' as Mode, left: 'Zn' as MetalId, right: 'Cu' as MetalId, logL: 0, logR: 0, load: 'open' as 'open' | 'bulb', cell: 'water' as CellId, V: 4 };

interface Ion {
  x: number;
  y: number;
  side: 0 | 1; // galvanic: beaker; electrolytic: unused
  kind: 'cat' | 'an';
}

export function initElectrochem(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const leftSel = root.querySelector<HTMLSelectElement>('[data-left]')!;
  const rightSel = root.querySelector<HTMLSelectElement>('[data-right]')!;
  const cellSel = root.querySelector<HTMLSelectElement>('[data-cell]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  // galvanic state
  let cL = 1;
  let cR = 1;
  let mL = MASS0;
  let mR = MASS0;
  let hours = 0;
  let current = 0;
  let vHist: Point[] = [];
  // electrolytic state
  let ne = 0; // mol of electrons passed
  let minutes = 0;
  let pHist: [Point[], Point[]] = [[], []];
  // animation
  let ions: Ion[] = [];
  let bridge: { u: number; kind: 'cat' | 'an' }[] = [];
  let wireT = 0;
  let bubbles: { x: number; y: number; vy: number; side: 0 | 1 }[] = [];
  let anim = 0;

  /* ---------- Galvanic model ---------- */
  const ML = () => METALS[st.left];
  const MR = () => METALS[st.right];
  const eRed = (id: MetalId, c: number) => METALS[id].E0 + (RT_F / METALS[id].n) * Math.log(Math.max(c, 1e-6));
  const anodeLeft = () => eRed(st.left, cL) < eRed(st.right, cR);
  const eCell = () => Math.abs(eRed(st.left, cL) - eRed(st.right, cR));
  const e0Cell = () => Math.abs(ML().E0 - MR().E0);

  function galvanicStep(dt: number) {
    if (st.load === 'bulb') hours += dt;
    const aL = anodeLeft();
    const anodeMass = aL ? mL : mR;
    const cathC = aL ? cR : cL;
    current = st.load === 'bulb' && anodeMass > 0.01 ? eCell() / (R_INT + R_BULB) : 0;
    // too few ions left at the cathode limits the current (mass transport)
    current *= clamp(cathC / 0.002, 0, 1);
    const dne = (current * 3600 * dt) / F;
    if (dne > 0) {
      const an = aL ? ML() : MR();
      const ca = aL ? MR() : ML();
      const dissolved = Math.min(dne / an.n, (aL ? mL : mR) / an.M);
      const deposited = Math.min(dne / ca.n, (cathC * VOL_L) - 1e-7);
      if (aL) {
        mL -= dissolved * an.M;
        cL += dissolved / VOL_L;
        mR += Math.max(0, deposited) * ca.M;
        cR = Math.max(1e-6, cR - Math.max(0, deposited) / VOL_L);
      } else {
        mR -= dissolved * an.M;
        cR += dissolved / VOL_L;
        mL += Math.max(0, deposited) * ca.M;
        cL = Math.max(1e-6, cL - Math.max(0, deposited) / VOL_L);
      }
      mL = Math.max(0, mL);
      mR = Math.max(0, mR);
    }
    const last = vHist[vHist.length - 1];
    if (st.load === 'bulb' && (!last || hours - last.x >= 0.25)) vHist.push({ x: hours, y: eCell() });
    if (vHist.length > 600) vHist.shift();
  }

  /* ---------- Electrolysis model ---------- */
  const C = () => CELLS[st.cell];
  const cu0 = 1.0; // mol/L copper(II) chloride at the start
  const cuNow = () => (st.cell === 'cucl2' ? Math.max(0, cu0 - ne / 2 / VOL_E) : st.cell === 'refine' ? 1 : 0);
  function eCurrent() {
    let I = Math.max(0, st.V - C().onset) / R_ELECTROLYSIS;
    if (st.cell === 'cucl2') I *= clamp(cuNow() / 0.02, 0, 1);
    if (st.cell === 'refine') I *= clamp((MASS0 - refined()) / 0.5, 0, 1);
    return I;
  }
  const refined = () => (ne / 2) * 63.55;
  function products(): [number, number, string, string] {
    if (st.cell === 'water') return [(ne / 2) * MOLAR_GAS_VOLUME * 1000, (ne / 4) * MOLAR_GAS_VOLUME * 1000, 'mL', 'mL'];
    if (st.cell === 'cucl2') return [(ne / 2) * 63.55, (ne / 2) * MOLAR_GAS_VOLUME * 1000, 'g', 'mL'];
    return [refined(), refined(), 'g', 'g'];
  }
  function electrolyticStep(dt: number) {
    minutes += dt;
    current = eCurrent();
    ne += (current * 60 * dt) / F;
    const last = pHist[0][pHist[0].length - 1];
    if (!last || minutes - last.x >= 0.25) {
      const [a, b] = products();
      pHist[0].push({ x: minutes, y: a });
      pHist[1].push({ x: minutes, y: b });
      if (pHist[0].length > 800) pHist.forEach((h) => h.shift());
    }
  }

  function step(dt: number) {
    anim += dt;
    if (st.mode === 'galvanic') galvanicStep(dt);
    else electrolyticStep(dt);
    animateParticles(dt);
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 920] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  /** The apparatus is drawn in a 1000 × 600 scene; on phones it is scaled down and the text moves below it. */
  const scene = () => (portrait() ? { x: 0, y: 70, s: 0.68 } : { x: 0, y: 0, s: 1 });

  // galvanic geometry (scene coordinates)
  const G = {
    beakers: [
      { x0: 70, x1: 390 },
      { x0: 610, x1: 930 },
    ],
    floor: 540,
    liquid: 330,
    top: 270,
    elX: [190, 810],
    elTop: 180,
    elBottom: 505,
    wireY: 95,
    bridge: { x0: 330, x1: 670, top: 225, bottom: 470 },
  };
  // drawn width exaggerates mass changes so they are visible (the readouts give the real masses)
  const elWidth = (m: number) => (m <= 0.01 ? 0 : clamp(26 + (m - MASS0) * 2.5, 6, 64));
  // electrolysis geometry
  const E = { x0: 210, x1: 790, floor: 540, liquid: 300, top: 250, elX: [380, 620], elTop: 180, elBottom: 500, wireY: 95 };

  /* ---------- Particles ---------- */
  function targetCations(c: number) {
    return Math.round(clamp(14 * Math.pow(c, 0.6), 0, 34));
  }
  function animateParticles(dt: number) {
    const flow = clamp(current / 0.12, 0, 3);
    wireT += dt * (0.08 + 0.35 * flow) * (current > 1e-5 ? 1 : 0);
    if (st.mode === 'galvanic') {
      const aL = anodeLeft();
      for (const side of [0, 1] as const) {
        const c = side === 0 ? cL : cR;
        const target = targetCations(c);
        const mine = ions.filter((i) => i.side === side && i.kind === 'cat');
        const isAnode = (side === 0) === aL;
        const ex = G.elX[side];
        if (mine.length < target) {
          // new ions leave the anode surface (or appear anywhere when a solution is changed)
          const fromEl = isAnode && current > 0;
          ions.push({ x: fromEl ? ex + (Math.random() < 0.5 ? -1 : 1) * 20 : rand(G.beakers[side].x0 + 15, G.beakers[side].x1 - 15), y: rand(G.liquid + 15, G.floor - 15), side, kind: 'cat' });
        } else if (mine.length > target) {
          // ions are removed at the cathode surface, nearest first
          let best = mine[0];
          for (const i of mine) if (Math.abs(i.x - ex) < Math.abs(best.x - ex)) best = i;
          ions.splice(ions.indexOf(best), 1);
        }
        const an = ions.filter((i) => i.side === side && i.kind === 'an').length;
        if (an < 10) ions.push({ x: rand(G.beakers[side].x0 + 15, G.beakers[side].x1 - 15), y: rand(G.liquid + 15, G.floor - 15), side, kind: 'an' });
      }
      for (const i of ions) {
        const b = G.beakers[i.side];
        const isCathodeSide = (i.side === 0) !== aL;
        let drift = 0;
        if (current > 0 && i.kind === 'cat' && isCathodeSide) drift = Math.sign(G.elX[i.side] - i.x) * 25 * flow;
        i.x = clamp(i.x + (drift + (Math.random() - 0.5) * 140) * dt, b.x0 + 10, b.x1 - 10);
        i.y = clamp(i.y + (Math.random() - 0.5) * 140 * dt, G.liquid + 10, G.floor - 10);
        // keep out of the electrode
        const ew = elWidth(i.side === 0 ? mL : mR) / 2 + 6;
        if (Math.abs(i.x - G.elX[i.side]) < ew && i.y < G.elBottom) i.x = G.elX[i.side] + Math.sign(i.x - G.elX[i.side] || 1) * ew;
      }
      // salt bridge ions: cations towards the cathode beaker, anions towards the anode beaker
      if (bridge.length < 10) for (let n = 0; n < 10; n++) bridge.push({ u: Math.random(), kind: n % 2 ? 'an' : 'cat' });
      for (const b of bridge) {
        const dir = (b.kind === 'cat') === aL ? 1 : -1; // u = 0 at the left beaker, 1 at the right
        b.u += dt * (current > 0 ? dir * 0.06 * flow : 0) + (Math.random() - 0.5) * 0.03 * dt;
        if (b.u > 1) b.u -= 1;
        if (b.u < 0) b.u += 1;
      }
    } else {
      const nC = st.cell === 'water' ? 16 : targetCations(cuNow() || 0.0001);
      const cats = ions.filter((i) => i.kind === 'cat');
      if (cats.length < nC) ions.push({ x: st.cell === 'refine' && current > 0 ? E.elX[1] - 20 : rand(E.x0 + 15, E.x1 - 15), y: rand(E.liquid + 15, E.floor - 15), side: 0, kind: 'cat' });
      else if (cats.length > nC) {
        let best = cats[0];
        for (const i of cats) if (Math.abs(i.x - E.elX[0]) < Math.abs(best.x - E.elX[0])) best = i;
        ions.splice(ions.indexOf(best), 1);
      }
      if (ions.filter((i) => i.kind === 'an').length < 14) ions.push({ x: rand(E.x0 + 15, E.x1 - 15), y: rand(E.liquid + 15, E.floor - 15), side: 0, kind: 'an' });
      for (const i of ions) {
        // cations drift to the cathode (left), anions to the anode (right)
        const to = i.kind === 'cat' ? E.elX[0] : E.elX[1];
        const drift = current > 0 ? Math.sign(to - i.x) * 30 * flow : 0;
        i.x = clamp(i.x + (drift + (Math.random() - 0.5) * 140) * dt, E.x0 + 10, E.x1 - 10);
        i.y = clamp(i.y + (Math.random() - 0.5) * 140 * dt, E.liquid + 10, E.floor - 10);
        // ions that reach an electrode where they react are recycled elsewhere
        if (current > 0 && Math.abs(i.x - to) < 16 && (i.kind === 'cat' || st.cell !== 'refine')) i.x = rand(E.x0 + 15, E.x1 - 15);
      }
      // gas bubbles
      const gas: [0 | 1, number][] = st.cell === 'water' ? [[0, 2], [1, 1]] : st.cell === 'cucl2' ? [[1, 1]] : [];
      for (const [side, rate] of gas) if (Math.random() < dt * current * 12 * rate) bubbles.push({ x: E.elX[side] + rand(-14, 14), y: E.elBottom - rand(0, 200), vy: rand(60, 110), side });
    }
    for (const b of bubbles) b.y -= b.vy * dt;
    bubbles = bubbles.filter((b) => b.y > E.liquid + 4 && b.y > (st.cell === 'water' ? tubeLevel(b.side) : 0));
  }
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const fmtE = (v: number) => (v < 0 ? `−${(-v).toFixed(2)}` : `+${v.toFixed(2)}`);

  // collection tubes over the electrodes in the water cell
  const TUBE = { top: 160, bottom: 470, w: 64, cap: 60 }; // cap in mL
  function tubeLevel(side: 0 | 1) {
    const [h2, o2] = products();
    const v = side === 0 ? h2 : o2;
    return TUBE.top + (TUBE.bottom - TUBE.top) * clamp(v / TUBE.cap, 0, 1);
  }

  /* ---------- Drawing helpers ---------- */
  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];
  function label(text: string, x: number, y: number, fs: Fs, size0 = 11, colour?: string, align: CanvasTextAlign = 'center', weight = 700) {
    ctx.font = fs(size0, weight);
    ctx.fillStyle = colour ?? pal['sim-text'];
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }
  /** Electrode name and process: beside the wire on wide screens, centred on a backing pill on phones. */
  function electrodeLabel(name: string, process: string, x: number, top: number, side: 0 | 1, colour: string, fs: Fs) {
    if (!portrait()) {
      const lx = side === 0 ? x - 14 : x + 14;
      const la: CanvasTextAlign = side === 0 ? 'right' : 'left';
      label(name, lx, top - 26, fs, 12, colour, la);
      label(process, lx, top - 10, fs, 10, pal['text-faint'], la, 600);
      return;
    }
    ctx.font = fs(12, 700);
    const m = ctx.measureText(name);
    const w = m.width + 16;
    const hh = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * 3.2;
    ctx.fillStyle = pal['bg-elev'];
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, top - 8 - hh, w, hh, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    label(name, x, top - 8 - hh * 0.55, fs, 12, colour);
    label(process, x, top - 8 - hh * 0.12, fs, 10, pal['text-faint'], 'center', 600);
  }
  function beaker(x0: number, x1: number, top: number, liquid: number, floor: number, tint: string) {
    ctx.fillStyle = tint;
    ctx.fillRect(x0, liquid, x1 - x0, floor - liquid);
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x0 - 3, top);
    ctx.lineTo(x0, floor + 2);
    ctx.lineTo(x1, floor + 2);
    ctx.lineTo(x1 + 3, top);
    ctx.stroke();
  }
  function wirePath(pts: V2[], electrons: boolean, reverse = false) {
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    if (!electrons) return;
    // electrons spaced along the wire, moving from the first point to the last
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = lens.reduce((a, b) => a + b, 0);
    const n = Math.round(total / 45);
    for (let j = 0; j < n; j++) {
      let d = (((j / n + wireT) % 1) + 1) % 1;
      if (reverse) d = 1 - d;
      let s = d * total;
      let i = 0;
      while (i < lens.length - 1 && s > lens[i]) (s -= lens[i]), i++;
      const f = lens[i] ? s / lens[i] : 0;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
      const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
      ctx.fillStyle = ELECTRON;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function ionDot(i: Ion, colour: string) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(i.x, i.y, i.kind === 'cat' ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
  function arrowHead(x: number, y: number, dir: 1 | -1, colour: string) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x + dir * 10, y);
    ctx.lineTo(x - dir * 6, y - 7);
    ctx.lineTo(x - dir * 6, y + 7);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- Galvanic drawing ---------- */
  function drawGalvanic(fs: Fs) {
    const aL = anodeLeft();
    const metals = [ML(), MR()];
    const conc = [cL, cR];
    const mass = [mL, mR];
    for (const side of [0, 1] as const) {
      const m = metals[side];
      const b = G.beakers[side];
      const tint = m.tint ? withAlpha(m.tint, clamp(0.08 + 0.3 * Math.min(conc[side], 1.5), 0.08, 0.5)) : withAlpha(pal['sim-water'], 0.14);
      beaker(b.x0, b.x1, G.top, G.liquid, G.floor, tint);
    }
    // salt bridge
    const sb = G.bridge;
    ctx.strokeStyle = withAlpha(pal['sim-water'], 0.35);
    ctx.lineWidth = 34;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sb.x0, sb.bottom);
    ctx.lineTo(sb.x0, sb.top);
    ctx.lineTo(sb.x1, sb.top);
    ctx.lineTo(sb.x1, sb.bottom);
    ctx.stroke();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2;
    for (const off of [-17, 17]) {
      ctx.beginPath();
      ctx.moveTo(sb.x0 + off, sb.bottom);
      ctx.lineTo(sb.x0 + off, sb.top - off);
      ctx.lineTo(sb.x1 - off, sb.top - off);
      ctx.lineTo(sb.x1 - off, sb.bottom);
      ctx.stroke();
    }
    const bridgeLen = 2 * (sb.bottom - sb.top) + (sb.x1 - sb.x0);
    for (const b of bridge) {
      let s = b.u * bridgeLen;
      let x: number;
      let y: number;
      if (s < sb.bottom - sb.top) (x = sb.x0), (y = sb.bottom - s);
      else if ((s -= sb.bottom - sb.top) < sb.x1 - sb.x0) (x = sb.x0 + s), (y = sb.top);
      else (x = sb.x1), (y = sb.top + (s - (sb.x1 - sb.x0)));
      ctx.fillStyle = b.kind === 'cat' ? pal['accent-2'] : pal['text-muted'];
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    label('Salt bridge (KNO₃)', 500, sb.top - 26, fs, 10.5, pal['text-faint']);
    areas.push({ test: (x, y) => x > sb.x0 - 18 && x < sb.x1 + 18 && y > sb.top - 18 && y < sb.top + 18, title: 'Salt bridge', text: () => `A tube of potassium nitrate gel. It completes the circuit: K⁺ ions drift towards the cathode beaker and NO₃⁻ ions towards the anode beaker, keeping both solutions electrically neutral. Without it, charge would build up and the current would stop at once.` });
    // ions
    ions.forEach((i) => ionDot(i, i.kind === 'cat' ? metals[i.side].ionColour : pal['text-faint']));
    // electrodes
    for (const side of [0, 1] as const) {
      const m = metals[side];
      const w = elWidth(mass[side]);
      const x = G.elX[side];
      ctx.fillStyle = m.metal;
      ctx.fillRect(x - w / 2, G.elTop, w, G.elBottom - G.elTop);
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - w / 2, G.elTop, w, G.elBottom - G.elTop);
      ctx.save();
      ctx.translate(x, (G.elTop + G.liquid) / 2 + 10);
      ctx.fillStyle = '#10161f';
      ctx.font = fs(12, 800);
      ctx.textAlign = 'center';
      ctx.fillText(m.id, 0, 4);
      ctx.restore();
      const isAnode = (side === 0) === aL;
      // labels beside the wire, on the outer side
      electrodeLabel(isAnode ? 'Anode (−)' : 'Cathode (+)', isAnode ? 'oxidation' : 'reduction', x, G.elTop, side, isAnode ? pal.success : pal.danger, fs);
      if (!portrait()) label(isAnode ? `${m.id} → ${m.ion} + ${m.n === 1 ? '' : m.n}e⁻` : `${m.ion} + ${m.n === 1 ? '' : m.n}e⁻ → ${m.id}`, (G.beakers[side].x0 + G.beakers[side].x1) / 2, G.floor + 30, fs, 12.5, pal['sim-text'], 'center', 650);
      areas.push({
        test: (px, py) => Math.abs(px - x) < w / 2 + 8 && py > G.elTop && py < G.elBottom,
        title: `${m.name} electrode: the ${isAnode ? 'anode' : 'cathode'}`,
        text: () =>
          isAnode
            ? `${m.name} atoms lose electrons and dissolve as ${m.ion} ions (oxidation). The electrons it leaves behind make this the negative electrode. Mass now ${mass[side].toFixed(2)} g.`
            : `${m.ion} ions from the solution gain electrons here and are deposited as ${m.name.toLowerCase()} metal (reduction). This is the positive electrode. Mass now ${mass[side].toFixed(2)} g.`,
      });
      const bk = G.beakers[side];
      areas.push({ test: (px, py) => px > bk.x0 && px < bk.x1 && py > G.liquid && py < G.floor, title: `${m.salt} solution`, text: () => `${conc[side] < 0.01 ? conc[side].toExponential(1) : conc[side].toFixed(2)} mol/L of ${m.ion} ions (coloured dots). Grey dots are the negative ions that balance their charge.` });
    }
    // wire, electrons and the meter or bulb
    const xa = G.elX[aL ? 0 : 1];
    const xc = G.elX[aL ? 1 : 0];
    const pts: V2[] = [
      [xa, G.elTop],
      [xa, G.wireY],
      [xc, G.wireY],
      [xc, G.elTop],
    ];
    wirePath(pts, current > 1e-5);
    if (current > 1e-5) {
      label('electron flow', 500 + (aL ? -150 : 150), G.wireY - 14, fs, 10.5, ELECTRON);
      arrowHead(500 + (aL ? -80 : 80), G.wireY - 18, aL ? 1 : -1, ELECTRON);
    }
    const mx = 500;
    const my = G.wireY;
    if (st.load === 'open') {
      ctx.fillStyle = pal['bg-elev'];
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(mx - 70, my - 32, 140, 64, 10);
      ctx.fill();
      ctx.stroke();
      label(`${eCell().toFixed(2)} V`, mx, my + 8, fs, 18, pal.success, 'center', 750);
      label('voltmeter', mx, my + 24, fs, 9.5, pal['text-faint'], 'center', 600);
    } else {
      const power = current * current * R_BULB;
      const glow = clamp(power / 0.08, 0, 1);
      if (glow > 0.02) {
        const g = ctx.createRadialGradient(mx, my, 4, mx, my, 70);
        g.addColorStop(0, `rgba(255, 220, 90, ${0.75 * glow})`);
        g.addColorStop(1, 'rgba(255, 220, 90, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, 70, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = glow > 0.02 ? `rgba(255, 236, 150, ${0.5 + 0.5 * glow})` : pal['bg-elev'];
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mx, my, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      label(`${eCell().toFixed(2)} V · ${(current * 1000).toFixed(0)} mA`, mx, my + 46, fs, 11, pal['sim-text']);
    }
    areas.push({ test: (x, y) => Math.abs(x - mx) < 75 && Math.abs(y - my) < 40, title: st.load === 'open' ? 'Voltmeter' : 'Light bulb', text: () => (st.load === 'open' ? 'A voltmeter barely lets any current through, so it reads the cell’s full voltage. No electrons flow and nothing changes in the beakers.' : 'The bulb lets current flow. Electrons travel through the wire from the anode to the cathode, and the reactions in the beakers start. Watch the voltage slowly fall as the cell is used.') });
    areas.push({ test: (x, y) => y > G.wireY - 8 && y < G.wireY + 8 && x > Math.min(xa, xc) && x < Math.max(xa, xc), title: 'External circuit', text: () => 'Electrons flow through the wire from the anode (where they are released) to the cathode (where they are used). Electrons never travel through the solution: there, ions carry the charge.' });
  }

  /* ---------- Electrolytic drawing ---------- */
  function drawElectrolytic(fs: Fs) {
    const cell = C();
    const tint = cell.tint ? withAlpha(cell.tint, clamp(0.06 + 0.28 * cuNow(), 0.04, 0.4)) : withAlpha(pal['sim-water'], 0.14);
    beaker(E.x0, E.x1, E.top, E.liquid, E.floor, tint);
    ions.forEach((i) => ionDot(i, i.kind === 'cat' ? cell.cationColour : cell.anionColour));
    // collection tubes (water)
    if (st.cell === 'water') {
      const [h2, o2] = products();
      for (const side of [0, 1] as const) {
        const x = E.elX[side];
        const lvl = tubeLevel(side);
        // the tube starts full of liquid; collected gas pushes the liquid down
        ctx.fillStyle = withAlpha(pal['sim-water'], 0.22);
        ctx.fillRect(x - TUBE.w / 2, lvl, TUBE.w, TUBE.bottom - lvl);
        ctx.fillStyle = withAlpha(pal.warning, 0.22);
        ctx.fillRect(x - TUBE.w / 2, TUBE.top + 4, TUBE.w, lvl - TUBE.top - 4);
        ctx.strokeStyle = pal['sim-water'];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - TUBE.w / 2, lvl);
        ctx.lineTo(x + TUBE.w / 2, lvl);
        ctx.stroke();
        // scale marks every 10 mL
        ctx.strokeStyle = pal['text-faint'];
        ctx.lineWidth = 1;
        for (let mL = 10; mL < TUBE.cap; mL += 10) {
          const yy = TUBE.top + ((TUBE.bottom - TUBE.top) * mL) / TUBE.cap;
          ctx.beginPath();
          ctx.moveTo(x + TUBE.w / 2 - 10, yy);
          ctx.lineTo(x + TUBE.w / 2, yy);
          ctx.stroke();
        }
        ctx.strokeStyle = pal['sim-text'];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - TUBE.w / 2, TUBE.bottom);
        ctx.lineTo(x - TUBE.w / 2, TUBE.top + 10);
        ctx.quadraticCurveTo(x - TUBE.w / 2, TUBE.top, x, TUBE.top);
        ctx.quadraticCurveTo(x + TUBE.w / 2, TUBE.top, x + TUBE.w / 2, TUBE.top + 10);
        ctx.lineTo(x + TUBE.w / 2, TUBE.bottom);
        ctx.stroke();
        label(side === 0 ? `H₂ ${Math.min(h2, TUBE.cap).toFixed(1)} mL` : `O₂ ${Math.min(o2, TUBE.cap).toFixed(1)} mL`, x + (side === 0 ? -1 : 1) * (TUBE.w / 2 + 10), E.liquid + 40, fs, 12, pal['sim-text'], side === 0 ? 'right' : 'left');
        if ((side === 0 ? h2 : o2) >= TUBE.cap) label('tube full', x + (side === 0 ? -1 : 1) * (TUBE.w / 2 + 10), E.liquid + 58, fs, 10, pal.warning, side === 0 ? 'right' : 'left');
      }
    }
    // electrodes
    for (const side of [0, 1] as const) {
      const x = E.elX[side];
      const inert = st.cell !== 'refine';
      const w = inert ? 20 : clamp(26 + (side === 0 ? 1 : -1) * (refined() / 0.6) * 12, 6, 44);
      ctx.fillStyle = inert ? (st.cell === 'water' ? '#d0d5dc' : '#454c55') : '#c8743a';
      ctx.fillRect(x - w / 2, E.elTop, w, E.elBottom - E.elTop);
      // copper plating on the cathode
      if (side === 0 && st.cell === 'cucl2') {
        const t = clamp(products()[0] / 0.5, 0, 1) * 8;
        ctx.fillStyle = '#c8743a';
        ctx.fillRect(x - w / 2 - t, E.liquid, w + 2 * t, E.elBottom - E.liquid);
      }
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - w / 2, E.elTop, w, E.elBottom - E.elTop);
      electrodeLabel(side === 0 ? 'Cathode (−)' : 'Anode (+)', side === 0 ? 'reduction' : 'oxidation', x, E.elTop, side, side === 0 ? pal.danger : pal.success, fs);
      areas.push({
        test: (px, py) => Math.abs(px - x) < w / 2 + 10 && py > E.elTop && py < E.elBottom,
        title: side === 0 ? 'Cathode (negative)' : 'Anode (positive)',
        text: () => (side === 0 ? `Connected to the negative terminal, it pushes electrons into the solution’s positive ions: ${cell.cathode}. Product: ${cell.cathodeProduct}.` : `Connected to the positive terminal, it pulls electrons away: ${cell.anode}. Product: ${cell.anodeProduct}.`),
      });
    }
    // bubbles
    for (const b of bubbles) {
      ctx.strokeStyle = pal['sim-text'];
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // power supply and wires
    const px = 500;
    const py = E.wireY;
    const on = current > 1e-6;
    wirePath([[px - 60, py], [E.elX[0], py], [E.elX[0], E.elTop]], on);
    wirePath([[E.elX[1], E.elTop], [E.elX[1], py], [px + 60, py]], on);
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(px - 60, py - 34, 120, 68, 10);
    ctx.fill();
    ctx.stroke();
    label(`${st.V.toFixed(1)} V`, px, py + 6, fs, 17, pal.warning, 'center', 750);
    label('power supply', px, py + 24, fs, 9.5, pal['text-faint'], 'center', 600);
    label('−', px - 46, py - 10, fs, 16, pal.danger, 'center', 800);
    label('+', px + 46, py - 10, fs, 16, pal.success, 'center', 800);
    if (on) {
      label('electrons', (E.elX[0] + px - 60) / 2, py - 24, fs, 10.5, ELECTRON);
      arrowHead(E.elX[0] + 6, py - 16, -1, ELECTRON);
      arrowHead(E.elX[1] + 70, py - 16, 1, ELECTRON);
    }
    areas.push({ test: (x, y) => Math.abs(x - px) < 64 && Math.abs(y - py) < 38, title: 'Power supply', text: () => `It pumps electrons from the anode round to the cathode, forcing a reaction that would not happen by itself. Below about ${cell.onset.toFixed(cell.onset < 1 ? 2 : 1)} V almost no current flows.` });
    if (!portrait()) {
      label(`Cathode: ${cell.cathode}`, E.x0, E.floor + 30, fs, 12.5, pal['sim-text'], 'left', 650);
      label(`Anode: ${cell.anode}`, E.x1, E.floor + 30, fs, 12.5, pal['sim-text'], 'right', 650);
    }
  }

  /* ---------- Info below the apparatus on phones ---------- */
  function drawPhoneInfo(k: number) {
    const lines: [string, string][] =
      st.mode === 'galvanic'
        ? (() => {
            const aL = anodeLeft();
            const a = aL ? ML() : MR();
            const c = aL ? MR() : ML();
            return [
              ['Anode (oxidation)', `${a.id} → ${a.ion} + ${a.n === 1 ? '' : a.n}e⁻`],
              ['Cathode (reduction)', `${c.ion} + ${c.n === 1 ? '' : c.n}e⁻ → ${c.id}`],
              ['Cell voltage', `${eCell().toFixed(2)} V (standard ${e0Cell().toFixed(2)} V)`],
            ];
          })()
        : [
            ['Cathode (reduction)', C().cathode],
            ['Anode (oxidation)', C().anode],
            ['Current', `${current.toFixed(2)} A at ${st.V.toFixed(1)} V`],
          ];
    let y = 530;
    for (const [t, v] of lines) {
      ctx.font = font(11 / k, 700);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'left';
      ctx.fillText(t, 30, y);
      ctx.font = font(14 / k, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(v, 30, y + 20 / k);
      y += 52 / k;
    }
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    if (hintEl) hintEl.style.display = portrait() ? 'none' : '';
    const sc = scene();
    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.scale(sc.s, sc.s);
    const fs: Fs = (px, wt = 650) => font(px / (k * sc.s), wt);
    if (st.mode === 'galvanic') drawGalvanic(fs);
    else drawElectrolytic(fs);
    ctx.restore();
    // hit areas were recorded in scene coordinates: convert them
    areas = areas.map((a) => ({ ...a, test: (x: number, y: number) => a.test((x - sc.x) / sc.s, (y - sc.y) / sc.s) }));
    if (portrait()) drawPhoneInfo(k);
    ctx.restore();
    updateUi();
    drawGraph();
  }

  /* ---------- Readouts ---------- */
  const r = (name: string, label0: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
    ui.readout(name, text, tone);
    const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
    if (dt && dt.textContent !== label0) dt.textContent = label0;
  };
  function updateUi() {
    if (st.mode === 'galvanic') {
      const aL = anodeLeft();
      const a = aL ? ML() : MR();
      const c = aL ? MR() : ML();
      r('r1', 'Cell voltage', `${eCell().toFixed(2)} V`, eCell() < 0.05 ? 'bad' : null);
      r('r2', 'Standard cell voltage (1 mol/L, 25 °C)', `E°cathode − E°anode = ${fmtE(c.E0)} − (${fmtE(a.E0)}) = ${e0Cell().toFixed(2)} V`);
      r('r3', 'Current', st.load === 'open' ? '0 (voltmeter only)' : `${(current * 1000).toFixed(0)} mA`);
      r('r4', `Anode: ${a.name.toLowerCase()}`, `${(aL ? mL : mR).toFixed(2)} g, ${a.ion} ${(aL ? cL : cR).toFixed(2)} mol/L`);
      r('r5', `Cathode: ${c.name.toLowerCase()}`, `${(aL ? mR : mL).toFixed(2)} g, ${c.ion} ${(aL ? cR : cL) < 0.01 ? (aL ? cR : cL).toExponential(1) : (aL ? cR : cL).toFixed(2)} mol/L`);
      r('r6', 'Time with the bulb connected', st.load === 'bulb' || hours > 0 ? `${hours.toFixed(1)} h (1 s = 1 h)` : '—');
      sim.setBadge(st.load === 'open' ? 'Open circuit' : current > 1e-5 ? 'Current flowing' : 'Cell exhausted');
      canvas.setAttribute('aria-label', `Galvanic cell with a ${ML().name.toLowerCase()} electrode on the left and a ${MR().name.toLowerCase()} electrode on the right. The ${a.name.toLowerCase()} electrode is the anode. Cell voltage ${eCell().toFixed(2)} volts; current ${(current * 1000).toFixed(0)} milliamps.`);
    } else {
      const cell = C();
      const [p1, p2, u1, u2] = products();
      r('r1', 'Current', `${current.toFixed(2)} A`, current < 1e-6 ? 'warn' : null);
      r('r2', 'Voltage needed', `about ${cell.onset.toFixed(cell.onset < 1 ? 2 : 1)} V (theory ${cell.theory.toFixed(2)} V)`);
      r('r3', 'Charge passed', `${(ne * F).toFixed(0)} C = ${(ne * 1000).toFixed(2)} mmol of electrons`);
      r('r4', `At the cathode: ${cell.cathodeProduct}`, `${p1.toFixed(u1 === 'g' ? 3 : 1)} ${u1}`);
      r('r5', st.cell === 'refine' ? 'Lost from the anode' : `At the anode: ${cell.anodeProduct}`, `${p2.toFixed(u2 === 'g' ? 3 : 1)} ${u2}`);
      r('r6', 'Time', `${minutes.toFixed(1)} min (1 s = 1 min)`);
      sim.setBadge(current > 1e-6 ? 'Electrolysis running' : 'Voltage too low');
      canvas.setAttribute('aria-label', `Electrolysis of ${cell.title.toLowerCase()}. Applied voltage ${st.V.toFixed(1)} volts, current ${current.toFixed(2)} amps.`);
    }
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ec-graph"]')!, { x: { min: 0, span: 24 }, y: { min: 0, max: 2, step: 0.5 } });
  const gTitle = root.querySelector<HTMLElement>('#ec-graph-title')!;
  const gDesc = root.querySelector<HTMLElement>('[data-graph-desc="ec-graph"]')!;
  function drawGraph() {
    graph.clear();
    if (st.mode === 'galvanic') {
      gTitle.textContent = 'Cell voltage over time';
      gDesc.textContent = 'The cell voltage against time in hours while the bulb is connected.';
      const top = Math.max(0.5, Math.ceil((Math.max(e0Cell(), ...vHist.map((p) => p.y)) + 0.2) * 2) / 2);
      graph.opts = { x: { min: 0, span: 24, step: 6, format: (v) => `${v} h` }, y: { min: 0, max: top, step: top > 2 ? 1 : 0.5, format: (v) => `${v} V` } };
      graph.set('v', { label: 'Cell voltage', color: 'success', points: vHist, width: 2.2 });
    } else {
      const cell = C();
      const [, , u1, u2] = products();
      gTitle.textContent = 'Products formed over time';
      gDesc.textContent = `Amount of ${cell.cathodeProduct} and ${cell.anodeProduct} against time in minutes. Each grows in proportion to the charge passed (Faraday's law).`;
      const all = [...pHist[0], ...pHist[1]].map((p) => p.y);
      const top0 = Math.max(u1 === 'g' ? 0.5 : 10, ...all) * 1.15;
      const mag = Math.pow(10, Math.floor(Math.log10(top0)));
      const top = Math.ceil(top0 / mag) * mag;
      graph.opts = { x: { min: 0, span: 30, step: 10, format: (v) => `${v} min` }, y: { min: 0, max: top, step: top / 4, format: (v) => `${+v.toPrecision(3)}` } };
      graph.set('a', { label: `${cap(cell.cathodeProduct)} (${u1})`, color: 'danger', points: pHist[0], width: 2.2 });
      graph.set('b', { label: st.cell === 'refine' ? 'Copper lost from the anode (g)' : `${cap(cell.anodeProduct)} (${u2})`, color: 'success', points: pHist[1], width: 2.2, dash: st.cell === 'refine' ? [6, 4] : undefined });
    }
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="ec-graph"]'));
  }
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

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
  const fmtC = (v: number) => {
    const c = Math.pow(10, v);
    return `${c < 0.1 ? c.toFixed(3) : c.toFixed(2)} mol/L`;
  };
  function newGalvanic() {
    cL = Math.pow(10, st.logL);
    cR = Math.pow(10, st.logR);
    mL = mR = MASS0;
    hours = 0;
    current = 0;
    vHist = [];
    ions = [];
    bridge = [];
  }
  function newElectrolysis() {
    ne = 0;
    minutes = 0;
    current = 0;
    pHist = [[], []];
    ions = [];
    bubbles = [];
  }
  function galvanicNote() {
    const aL = anodeLeft();
    const a = aL ? ML() : MR();
    const c = aL ? MR() : ML();
    noteEl.textContent = `${a.name} has a more negative electrode potential (${fmtE(a.E0)} V) than ${c.name.toLowerCase()} (${fmtE(c.E0)} V), so it gives up electrons more readily: ${a.name.toLowerCase()} is the anode and is oxidized, and ${c.ion} ions are reduced at the ${c.name.toLowerCase()} cathode. ${st.load === 'open' ? 'Connect the light bulb to let current flow.' : 'The bulb is connected, so electrons flow through the wire from anode to cathode.'}`;
  }
  const lCtl = ui.range('ec-cl', fmtC, (v) => {
    st.logL = v;
    cL = Math.pow(10, v);
    galvanicNote();
    sim.requestRender();
  });
  const rCtl = ui.range('ec-cr', fmtC, (v) => {
    st.logR = v;
    cR = Math.pow(10, v);
    galvanicNote();
    sim.requestRender();
  });
  const loadCtl = ui.choice<'open' | 'bulb'>('ec-load', (v) => {
    st.load = v;
    galvanicNote();
    if (v === 'bulb' && !sim.running) sim.play();
    sim.requestRender();
  });
  const vCtl = ui.range('ec-v', (v) => `${v.toFixed(1)} V`, (v) => {
    st.V = v;
    if (!sim.running) sim.play();
    sim.requestRender();
  });
  function syncMetals(changed: 'left' | 'right') {
    // the two half-cells must be different metals
    if (leftSel.value === rightSel.value) {
      const other = changed === 'left' ? rightSel : leftSel;
      other.value = other.value === 'Cu' ? 'Zn' : 'Cu';
      if (leftSel.value === rightSel.value) other.value = 'Ag';
    }
    st.left = leftSel.value as MetalId;
    st.right = rightSel.value as MetalId;
    newGalvanic();
    galvanicNote();
    sim.hideTooltip();
    sim.requestRender();
  }
  leftSel.addEventListener('change', () => syncMetals('left'));
  rightSel.addEventListener('change', () => syncMetals('right'));
  cellSel.addEventListener('change', () => {
    st.cell = cellSel.value as CellId;
    newElectrolysis();
    noteEl.textContent = C().note;
    sim.hideTooltip();
    sim.requestRender();
  });
  root.querySelector('[data-renew]')?.addEventListener('click', () => {
    if (st.mode === 'galvanic') newGalvanic();
    else newElectrolysis();
    sim.requestRender();
  });
  function showMode(m: Mode) {
    ui.showWhen('[data-only="galvanic"]', m === 'galvanic');
    ui.showWhen('[data-only="electrolytic"]', m === 'electrolytic');
  }
  const modeCtl = ui.choice<Mode>('ec-mode', (m) => {
    st.mode = m;
    ions = [];
    bubbles = [];
    current = 0;
    showMode(m);
    if (m === 'galvanic') galvanicNote();
    else noteEl.textContent = `${C().note} In an electrolytic cell the anode is positive and the cathode negative: the opposite signs to a galvanic cell, but oxidation still happens at the anode and reduction at the cathode.`;
    sim.hideTooltip();
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      modeCtl.set('galvanic', false);
      leftSel.value = DEF.left;
      rightSel.value = DEF.right;
      cellSel.value = DEF.cell;
      lCtl.set(0, false);
      rCtl.set(0, false);
      loadCtl.set('open', false);
      vCtl.set(DEF.V, false);
      newGalvanic();
      newElectrolysis();
      showMode('galvanic');
      galvanicNote();
    },
  });
  newGalvanic();
  newElectrolysis();
  showMode('galvanic');
  galvanicNote();
}
