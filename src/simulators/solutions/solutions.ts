/**
 * Solutions, solubility and concentration.
 *
 * Solubility limits come from real data (see data.ts). Solid dissolves at a
 * finite rate that grows with its surface area (∝ mass^⅔), temperature and
 * stirring, and slows as the solution approaches saturation:
 *    dissolving rate = k · (0.5 + T/100) · stir · m_solid^⅔ · (1 − c/c_sat)
 * If the dissolved amount exceeds the solubility (after cooling, or after
 * water evaporates) and undissolved crystals are present, the excess
 * crystallizes onto them. With no crystals present, the solution can stay
 * supersaturated until a seed crystal is added or it exceeds 1.25 × the
 * solubility (a simplified threshold: real limits vary with the substance,
 * dust and disturbance). 1 mL of water is treated as 1 g.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { LineGraph } from '../shared/graph';
import { SOLUTES, solubility, type SoluteId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'sim-water', 'warning', 'danger', 'success', 'surface-2'] as const;
type Fs = (px: number, w?: number) => string;
type State = 'empty' | 'unsat' | 'sat' | 'cryst' | 'super';

const KD = 1.0;
const KC = 1.6;
const SPONT = 1.25;
const ML_PX = 1.4;
const DEF = { sub: 'kno3' as SoluteId, water: 100, T: 20, stir: false };

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Fall {
  x: number;
  y: number;
  vy: number;
}

export function initSolutions(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const subSel = root.querySelector<HTMLSelectElement>('[data-sub]')!;
  const seedBtn = root.querySelector<HTMLButtonElement>('[data-seed]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let dissolved = 0;
  let solid = 0;
  let dots: Dot[] = [];
  let falling: Fall[] = [];
  let anim = 0;
  let event = '';

  const S = () => SOLUTES[st.sub];
  const sol = () => solubility(S(), st.T); // g per 100 g water
  const cap = () => (sol() * st.water) / 100; // g that can dissolve in this water
  const ratio = () => (cap() > 0 ? dissolved / cap() : 0);
  const state = (): State => {
    if (dissolved < 0.005 && solid < 0.005) return 'empty';
    const r = ratio();
    if (r > 1.005) return solid > 0.01 ? 'cryst' : 'super';
    if (r >= 0.995) return 'sat';
    return 'unsat';
  };

  /* ---------- Model ---------- */
  function step(dt: number) {
    anim += dt;
    const c = cap();
    const stir = st.stir ? 3 : 1;
    if (solid > 0 && dissolved < c) {
      // the small +0.02 lets the last trace dissolve in a reasonable time instead of approaching saturation forever
      const rate = KD * (0.5 + st.T / 100) * stir * Math.pow(solid, 2 / 3) * (1 - dissolved / c + 0.02);
      const d = Math.min(solid, rate * dt, c - dissolved);
      solid -= d;
      dissolved += d;
      if (solid < 1e-4) solid = 0;
    } else if (dissolved > c && (solid > 0.001 || dissolved > SPONT * c)) {
      if (solid <= 0.001 && dissolved > SPONT * c && event !== 'spont') {
        event = 'spont';
        sim.announce('The solution was too supersaturated: crystals formed by themselves.');
        noteEl.textContent = 'The solution held so much extra solute that crystals appeared on their own. In this model that happens above 1.25 times the solubility; in real solutions the limit depends on the substance, dust and how much the solution is disturbed.';
      }
      const d = Math.min(dissolved - c, KC * (dissolved - c) * (st.stir ? 2 : 1) * dt + 0.02 * dt);
      dissolved -= d;
      solid += d;
    }
    // dots follow the concentration
    syncDots(dt);
    for (const f of falling) (f.vy += 900 * dt), (f.y += f.vy * dt);
    falling = falling.filter((f) => f.y < beakerFloor() - 6);
    updateUi();
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1000] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  const beaker = () => (portrait() ? { x: 40, w: 520, floor: 530 } : { x: 60, w: 360, floor: 545 });
  const beakerFloor = () => beaker().floor;
  const zoom = () => (portrait() ? { x: 170, y: 790, r: 135 } : { x: 700, y: 235, r: 140 });
  const meter = () => (portrait() ? { x: 345, y: 700, w: 310 } : { x: 520, y: 430, w: 440 });

  /* ---------- Dots in the beaker (concentration made visible) ---------- */
  const dotTarget = () => {
    const cMax = (solubility(S(), 100) * 10) / 1; // g/L at the substance's highest solubility
    const conc = (1000 * dissolved) / st.water;
    return Math.round(clamp((260 * conc) / cMax, 0, 340) + (dissolved > 0 ? 3 : 0));
  };
  function inWater(): { x0: number; x1: number; top: number; bottom: number } {
    const b = beaker();
    return { x0: 6, x1: b.w - 6, top: 6, bottom: st.water * ML_PX - 6 };
  }
  function syncDots(dt: number) {
    const target = dotTarget();
    const w = inWater();
    const b = beaker();
    while (dots.length < target) {
      // new particles leave the undissolved crystals at the bottom (or appear anywhere if there are none)
      const fromSolid = solid > 0.01;
      dots.push({
        x: fromSolid ? b.w / 2 + (Math.random() - 0.5) * pileWidth() : w.x0 + Math.random() * (w.x1 - w.x0),
        y: fromSolid ? 8 + Math.random() * 10 : w.top + Math.random() * (w.bottom - w.top),
        vx: 0,
        vy: 0,
      });
    }
    if (dots.length > target) {
      // particles leave the solution by joining crystals near the bottom
      dots.sort((a, c) => a.y - c.y);
      dots.splice(0, dots.length - target);
    }
    const diff = 600; // random spreading (diffusion), much faster than in real water so the dots fill the beaker in seconds
    for (const d of dots) {
      if (st.stir) {
        // swirl around the middle of the beaker
        const cx = b.w / 2;
        const cy = (w.bottom + w.top) / 2;
        d.vx = -(d.y - cy) * 1.4;
        d.vy = (d.x - cx) * 0.25;
      } else (d.vx = 0), (d.vy = 0);
      d.x += (d.vx + (Math.random() - 0.5) * diff * 2) * dt;
      d.y += (d.vy + (Math.random() - 0.5) * diff * 2) * dt;
      d.x = clamp(d.x, w.x0, w.x1);
      d.y = clamp(d.y, w.top, w.bottom);
    }
  }
  const pileWidth = () => Math.min(beaker().w - 30, 40 + Math.sqrt(solid) * 26);

  /* ---------- Drawing ---------- */
  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];

  function drawBeaker(fs: Fs, k: number) {
    const b = beaker();
    const s = S();
    const hW = st.water * ML_PX;
    const top = b.floor - 250 * ML_PX - 30;
    const surf = b.floor - hW;
    // water (tinted for coloured solutions)
    let water = withAlpha(pal['sim-water'], 0.16);
    if (s.tint) {
      const a = clamp((0.55 * dissolved) / Math.max(1, (solubility(s, 100) * st.water) / 100), 0, 0.6);
      water = withAlpha(s.tint, 0.12 + a);
    }
    ctx.fillStyle = water;
    ctx.fillRect(b.x, surf, b.w, hW);
    ctx.strokeStyle = withAlpha(pal['sim-water'], 0.6);
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.moveTo(b.x, surf);
    ctx.lineTo(b.x + b.w, surf);
    ctx.stroke();
    // dissolved particles
    ctx.fillStyle = s.dot;
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(b.x + d.x, b.floor - d.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // undissolved crystals: a heap on the floor
    const n = Math.min(260, Math.round(Math.sqrt(solid) * 16));
    const pw = pileWidth();
    const cs = 8;
    let i = 0;
    for (let row = 0; i < n; row++) {
      const rowW = Math.max(cs, pw - row * cs * 1.6);
      const per = Math.max(1, Math.floor(rowW / cs));
      for (let j = 0; j < per && i < n; j++, i++) {
        const x = b.x + b.w / 2 - rowW / 2 + j * cs + ((row * 3) % 4);
        const y = b.floor - 4 - row * (cs - 1) - cs;
        ctx.fillStyle = s.crystal;
        ctx.strokeStyle = pal['border-strong'];
        ctx.lineWidth = 1 / k;
        ctx.fillRect(x, y, cs - 1, cs - 1);
        ctx.strokeRect(x, y, cs - 1, cs - 1);
      }
    }
    for (const f of falling) {
      ctx.fillStyle = s.crystal;
      ctx.strokeStyle = pal['border-strong'];
      ctx.fillRect(b.x + f.x - 3, f.y - 3, 6, 6);
      ctx.strokeRect(b.x + f.x - 3, f.y - 3, 6, 6);
    }
    // glass
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(b.x - 4, top);
    ctx.lineTo(b.x - 2, b.floor + 2);
    ctx.lineTo(b.x + b.w + 2, b.floor + 2);
    ctx.lineTo(b.x + b.w + 4, top);
    ctx.stroke();
    // volume marks
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.2 / k;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let v = 50; v <= 250; v += 50) {
      const yy = b.floor - v * ML_PX;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w - 2, yy);
      ctx.lineTo(b.x + b.w - 16, yy);
      ctx.stroke();
      ctx.fillText(`${v} mL`, b.x + b.w + 10, yy);
    }
    ctx.textBaseline = 'alphabetic';
    // thermometer strip and stirrer
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(`${s.name} in water · ${st.T} °C`, b.x - 4, top - 14);
    if (st.stir) {
      const sx = b.x + b.w / 2 + Math.sin(anim * 6) * (b.w * 0.25);
      ctx.strokeStyle = pal['text-muted'];
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2 + 40, top - 4);
      ctx.lineTo(sx, b.floor - 30);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    if (solid > 0.01) {
      ctx.font = fs(10.5, 700);
      const label = `${solid < 1 ? solid.toFixed(2) : solid.toFixed(1)} g undissolved`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = pal['bg-elev'];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.roundRect(b.x + 8, b.floor - 36 - 18 / k, tw + 14 / k, 20 / k, 10 / k);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(label, b.x + 8 + 7 / k, b.floor - 36 - 4 / k);
    }
    areas.push(
      { test: (x, y) => x > b.x && x < b.x + b.w && y > b.floor - 45 && y < b.floor && solid > 0.01, title: 'Undissolved solid', text: () => `${solid.toFixed(1)} g of ${s.name.toLowerCase()} is sitting on the bottom. ${state() === 'sat' && ratio() > 0.99 ? 'The water already holds as much as it can at this temperature, so it will not dissolve. Particles still leave and rejoin the crystals at equal rates.' : 'It is still dissolving. Stirring or warming speeds this up.'}` },
      { test: (x, y) => x > b.x && x < b.x + b.w && y > surf && y < b.floor, title: 'The solution', text: () => `${st.water} mL of water (the solvent) with ${dissolved.toFixed(1)} g of ${s.name.toLowerCase()} (the solute) dissolved in it. The dots show how concentrated it is. ${s.note}` },
    );
  }

  function drawZoom(fs: Fs, k: number) {
    const z = zoom();
    const s = S();
    ctx.save();
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.fillStyle = pal['bg-elev'];
    ctx.fill();
    ctx.clip();
    // water molecules
    const wn = 46;
    for (let i = 0; i < wn; i++) {
      const a = i * 2.39996;
      const rr = z.r * Math.sqrt((i + 0.5) / wn) * 0.95;
      const x = z.x + Math.cos(a) * rr + Math.sin(anim * 3 + i) * 4;
      const y = z.y + Math.sin(a) * rr + Math.cos(anim * 2.6 + i * 1.7) * 4;
      waterMol(x, y, a + anim);
    }
    // a crystal lattice at the bottom if solid is present
    const lat = solid > 0.01;
    if (lat) {
      const cs = 15;
      for (let row = 0; row < 3; row++)
        for (let col = -8; col <= 8; col++) {
          const x = z.x + col * cs;
          const y = z.y + z.r - 12 - row * cs;
          soluteParticle(x, y, s.ionic ? ((row + col) % 2 === 0 ? 0 : 1) : 0, 6.2, k, false);
        }
    }
    // dissolved particles, spaced by concentration
    const conc = dissolved / Math.max(1, (solubility(s, 100) * st.water) / 100);
    const n = dissolved > 0.05 ? Math.max(2, Math.round(clamp(conc, 0, 1.3) * 24)) : 0;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + 0.7;
      const rr = z.r * Math.sqrt((i + 0.5) / 25) * (lat ? 0.7 : 0.85);
      const x = z.x + Math.cos(a) * rr + Math.sin(anim * 1.3 + i * 2) * 10;
      const y = z.y - (lat ? 18 : 0) + Math.sin(a) * rr * (lat ? 0.75 : 1) + Math.cos(anim * 1.1 + i) * 10;
      const kind = s.ionic ? i % 2 : 0;
      // hydration shell: water molecules cling to each particle
      ctx.strokeStyle = withAlpha(pal['sim-water'], 0.5);
      ctx.lineWidth = 2 / k;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      soluteParticle(x, y, kind, 10, k, true);
    }
    ctx.restore();
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText('Particle view (not to scale)', z.x, z.y - z.r - 10 / k);
    areas.push({
      test: (x, y) => Math.hypot(x - z.x, y - z.y) < z.r,
      title: 'Particle view',
      text: () =>
        s.ionic
          ? `${s.formula} is ionic. When it dissolves, water molecules pull the ${s.ions.join(' and ')} ions out of the crystal and surround them (dashed rings). The ions spread out evenly through the water.`
          : 'Sugar is made of molecules, not ions. Water molecules surround each whole sugar molecule and carry it away from the crystal; the molecule itself does not break apart.',
    });
  }
  function waterMol(x: number, y: number, a: number) {
    ctx.fillStyle = withAlpha(pal['sim-water'], 0.55);
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(pal['sim-water'], 0.35);
    for (const d of [-0.9, 0.9]) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(a + d) * 5.5, y + Math.sin(a + d) * 5.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function soluteParticle(x: number, y: number, kind: number, r: number, k: number, label: boolean) {
    const s = S();
    if (!s.ionic) {
      ctx.fillStyle = s.dot;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        if (i) ctx.lineTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1);
        else ctx.moveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
    const cation = kind === 0;
    ctx.fillStyle = cation ? s.dot : pal['text-muted'];
    ctx.beginPath();
    ctx.arc(x, y, cation ? r * 0.8 : r * 1.05, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = font(10 / k > 14 ? 14 : 11, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cation ? '+' : '−', x, y + 0.5);
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawMeter(fs: Fs, k: number) {
    const m = meter();
    const r = ratio();
    const top = 1.5;
    const st0 = state();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(portrait() ? 'How full is it?' : 'How full is the solution?', m.x, m.y);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'right';
    if (!portrait()) ctx.fillText('supersaturated →', m.x + m.w, m.y);
    const by = m.y + 10 / k;
    const bh = 16 / k;
    ctx.fillStyle = pal.border;
    ctx.fillRect(m.x, by, m.w, bh);
    ctx.fillStyle = st0 === 'super' || st0 === 'cryst' ? pal.warning : st0 === 'sat' ? pal.success : pal.accent;
    ctx.fillRect(m.x, by, (m.w * clamp(r, 0, top)) / top, bh);
    const x100 = m.x + m.w / top;
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.moveTo(x100, by - 4 / k);
    ctx.lineTo(x100, by + bh + 4 / k);
    ctx.stroke();
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    ctx.fillText('saturated', x100, by + bh + 14 / k);
    ctx.textAlign = 'left';
    if (!portrait()) ctx.fillText('unsaturated', m.x, by + bh + 14 / k);
    ctx.textAlign = 'left';
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`${Math.round(r * 100)}% of the solubility`, m.x, by + bh + 36 / k);
    areas.push({
      test: (x, y) => x > m.x && x < m.x + m.w && y > m.y - 14 && y < by + bh + 40 / k,
      title: 'Saturation meter',
      text: () => `The dissolved amount compared with the most that can stay dissolved in ${st.water} mL at ${st.T} °C (${cap().toFixed(1)} g). Below 100%: unsaturated. At 100% with solid left over: saturated. Above 100%: supersaturated and unstable.`,
    });
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
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    drawBeaker(fs, k);
    drawZoom(fs, k);
    drawMeter(fs, k);
    ctx.restore();
    updateUi();
    drawGraph();
  }

  /* ---------- Readouts and explanation ---------- */
  const STATE_TEXT: Record<State, string> = {
    empty: 'Pure water',
    unsat: 'Unsaturated',
    sat: 'Saturated',
    cryst: 'Crystals forming',
    super: 'Supersaturated',
  };
  let lastState: string | null = null;
  function updateUi() {
    const s = S();
    const conc = (1000 * dissolved) / st.water;
    const st0 = state();
    ui.readout('state', STATE_TEXT[st0], st0 === 'super' || st0 === 'cryst' ? 'warn' : st0 === 'sat' ? 'ok' : null);
    ui.readout('gl', `${conc.toFixed(conc < 10 ? 1 : 0)} g/L`);
    ui.readout('mol', `${(conc / s.molar).toFixed(2)} mol/L`);
    ui.readout('pct', `${((100 * dissolved) / (dissolved + st.water)).toFixed(1)}%`);
    ui.readout('sol', `${sol().toFixed(1)} g per 100 g water`);
    ui.readout('max', `${cap().toFixed(1)} g`);
    ui.readout('amt', `${dissolved.toFixed(1)} g`);
    ui.readout('solid', `${solid.toFixed(1)} g`);
    seedBtn.disabled = st0 !== 'super';
    sim.setBadge(STATE_TEXT[st0]);
    const key = `${st0}${solid > 0.01 ? '+solid' : ''}`;
    if (key !== lastState) {
      const changed = !lastState || !lastState.startsWith(st0);
      lastState = key;
      if (event !== 'spont' || st0 !== 'sat') noteEl.textContent = explain(st0);
      if (st0 !== 'sat') event = '';
      if (changed) sim.announce(`The solution is now ${STATE_TEXT[st0].toLowerCase()}.`);
    }
    canvas.setAttribute('aria-label', `A beaker of ${st.water} millilitres of water at ${st.T} degrees Celsius with ${dissolved.toFixed(1)} grams of ${s.name.toLowerCase()} dissolved and ${solid.toFixed(1)} grams undissolved. The solution is ${STATE_TEXT[st0].toLowerCase()}, at ${Math.round(ratio() * 100)} percent of the solubility.`);
  }
  function explain(s0: State) {
    const s = S();
    if (s0 === 'empty') return `Add ${s.name.toLowerCase()} with the spoon buttons and watch it dissolve. ${s.note}`;
    if (s0 === 'unsat') return solid > 0.01 ? 'Unsaturated and still dissolving: the water can hold more, so the crystals at the bottom keep dissolving. Stirring and warming make them dissolve faster.' : 'Unsaturated: the water could dissolve more of the solute. Add more with the spoon buttons.';
    if (s0 === 'sat') return 'Saturated: the water holds as much as it can at this temperature, so extra solid stays at the bottom. Particles still leave the crystals, but others rejoin them at the same rate (a dynamic equilibrium). Stirring will not dissolve any more; changing the temperature or adding water can.';
    if (s0 === 'cryst') return 'Crystals forming: the solution holds more than the solubility, and there are crystals for the extra solute to build on. Solute leaves the solution and grows the crystals until the solution is just saturated.';
    return 'Supersaturated: the solution holds more than the solubility, because there were no crystals for the extra solute to grow on. It is unstable. Press “Drop in a seed crystal” and watch the excess crystallize.';
  }

  /* ---------- Graph: solubility curve ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="sol-graph"]')!, { x: { min: 0, span: 100 }, y: { min: 0, max: 100, step: 25 } });
  const titleEl = root.querySelector<HTMLElement>('#sol-graph-title')!;
  function drawGraph() {
    const s = S();
    const top = Math.max(...s.curve.map((c) => c[1]), (100 * dissolved) / st.water) * 1.15;
    const step = top > 400 ? 100 : top > 150 ? 50 : top > 60 ? 20 : 10;
    titleEl.textContent = `Solubility curve: ${s.name}`;
    graph.opts = {
      x: { min: 0, span: 100, max: 100, step: 20, format: (v) => `${v} °C` },
      y: { min: 0, max: Math.ceil(top / step) * step, step, format: (v) => `${v} g` },
      refs: [{ value: st.T, label: `${st.T} °C`, color: 'text-faint', axis: 'x' }],
    };
    graph.clear();
    graph.set('curve', { label: `Solubility (g per 100 g water)`, color: 'accent', points: LineGraph.sample((T) => solubility(s, T), 0, 100, 100), width: 2.5 });
    graph.set('now', { label: 'Your solution', color: state() === 'super' ? 'warning' : 'danger', points: [{ x: st.T, y: (100 * dissolved) / st.water }], type: 'points' });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="sol-graph"]'));
  }

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const a = areas.find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const play = () => {
    if (!sim.running) sim.play();
    sim.requestRender();
  };
  function empty() {
    dissolved = solid = 0;
    dots = [];
    falling = [];
    event = '';
    lastState = null;
  }
  function addSolid(g: number) {
    solid += g;
    const b = beaker();
    for (let i = 0; i < Math.min(30, 4 + g); i++) falling.push({ x: b.w / 2 + (Math.random() - 0.5) * 60, y: b.floor - 250 * ML_PX - 20 - Math.random() * 30, vy: Math.random() * 100 });
    if (state() === 'super') noteEl.textContent = 'Adding solid to a supersaturated solution gives the extra solute crystals to grow on.';
    play();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => b.addEventListener('click', () => addSolid(Number(b.dataset.add))));
  seedBtn.addEventListener('click', () => {
    solid += 0.05;
    noteEl.textContent = 'A tiny seed crystal gives the extra solute somewhere to build on. Crystals grow quickly until the solution is just saturated.';
    play();
  });
  root.querySelector('[data-empty]')?.addEventListener('click', () => {
    empty();
    noteEl.textContent = explain('empty');
    sim.requestRender();
  });
  root.querySelector('[data-hot]')?.addEventListener('click', () => {
    // a solution saturated at 70 °C with no crystals left: cool it to see crystallization or supersaturation
    empty();
    st.T = 70;
    tCtl.set(70, false);
    dissolved = cap();
    lastState = 'sat';
    noteEl.textContent = `This beaker holds as much ${S().name.toLowerCase()} as will dissolve at 70 °C, and every crystal has dissolved. Now lower the temperature slowly and watch the meter and the graph.`;
    play();
  });
  const tCtl = ui.range('sol-t', (v) => `${v} °C`, (v) => ((st.T = v), play()));
  const wCtl = ui.range('sol-w', (v) => `${v} mL`, (v) => {
    if (v < st.water) noteEl.textContent = 'Removing water (by evaporation) leaves the solute behind, so the solution becomes more concentrated.';
    else if (v > st.water) noteEl.textContent = 'Adding water dilutes the solution: the same amount of solute is spread through more solvent, and more can now dissolve.';
    st.water = v;
    play();
  });
  const stirCtl = ui.toggle('sol-stir', (v) => {
    st.stir = v;
    if (v) noteEl.textContent = 'Stirring brings fresh water to the crystals, so they dissolve faster. It does not change how much can dissolve.';
    play();
  });
  subSel.addEventListener('change', () => {
    st.sub = subSel.value as SoluteId;
    empty();
    noteEl.textContent = explain('empty');
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      subSel.value = DEF.sub;
      tCtl.set(DEF.T, false);
      wCtl.set(DEF.water, false);
      stirCtl.set(false, false);
      empty();
      noteEl.textContent = explain('empty');
    },
  });
  noteEl.textContent = explain('empty');
}
