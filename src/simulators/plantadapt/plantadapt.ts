/**
 * Plant adaptations and environmental survival: an experiment with two plots
 * (A and B) grown side by side under the same conditions.
 *
 * Simplified model (relative indices, 0–100 %, not measurements). For each
 * plant and day, six stress factors are worked out from its traits and the
 * environment:
 *   water     – a water store that fills with uptake and empties with loss:
 *               supply = availability × roots × salt penalty
 *               loss   = water use × temperature × light × stomatal closure
 *               (aquatic plants need standing water; epiphytes use rain, not soil)
 *   oxygen    – waterlogged soil starves roots of oxygen unless the plant has
 *               air channels or aerial roots (flood tolerance)
 *   salt      – stress rises above the plant's salt tolerance
 *   nutrients – soil nutrients, plus prey for carnivorous plants and debris
 *               caught by an epiphyte's tank (never below 35%: shortage stunts
 *               growth rather than killing quickly)
 *   light     – too little for photosynthesis, or too much for shade leaves
 *   temperature – outside the plant's optimum range; a deciduous tree drops its
 *               leaves below 5 °C and becomes dormant
 * Health moves towards the most limiting factor (it falls faster than it
 * recovers). The simulator reports every factor and names the limiting one
 * rather than giving a single score.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { LineGraph, runComparer, type Point } from '../shared/graph';
import { CAT, HABITATS, ORDER, SPECIES, type Env, type HabitatId, type Species, type SpeciesId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type Pt = [number, number];
type PlotId = 'A' | 'B';
type FKey = 'water' | 'oxygen' | 'salt' | 'nutrients' | 'light' | 'temp';
const FKEYS: FKey[] = ['water', 'oxygen', 'salt', 'nutrients', 'light', 'temp'];
const FNAME: Record<FKey, string> = { water: 'Water balance', oxygen: 'Root oxygen', salt: 'Salt', nutrients: 'Nutrients', light: 'Light', temp: 'Temperature' };
const DAY_S = 0.5; // real seconds per simulated day
const GROUND = 360;
const PLOT_X: Record<PlotId, number> = { A: 200, B: 500 };
const COL_PLOT: Record<PlotId, string> = { A: '#3b82f6', B: '#f08c00' };
const DEF = { habitat: 'desert' as HabitatId, A: 'cactus' as SpeciesId, B: 'sunflower' as SpeciesId, insects: true };

interface Plant {
  sp: SpeciesId;
  water: number;
  health: number;
  trapShut: number; // days left with a trap closed
  caught: number;
}
interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
  act?: () => void;
}
const pct = (v: number) => `${Math.round(clamp(v, 0, 1) * 100)}%`;

/* ---------- Model ---------- */
function isDormant(sp: Species, e: Env) {
  return !!sp.traits.deciduous && e.temp < 5;
}
function waterFlow(sp: Species, e: Env, store: number) {
  const t = sp.traits;
  const avail = t.aquatic ? clamp((e.water - 60) / 25, 0, 1) : t.epiphyte ? clamp(e.water / 60, 0, 1) : clamp(e.water / 50, 0, 1);
  const saltPen = t.epiphyte ? 1 : clamp(1 - Math.max(0, e.salt - t.saltTol) / 20, 0, 1);
  const supply = avail * t.roots * saltPen;
  const stomata = clamp(0.2 + store * 1.6, 0.2, 1); // stomata close as the plant dries out
  const demand = t.use * (0.4 + 0.6 * clamp(e.temp / 35, 0, 1.3)) * (0.3 + 0.7 * (e.light / 100)) * stomata * (isDormant(sp, e) ? 0.1 : 1);
  return { supply, demand };
}
function factors(sp: Species, e: Env, store: number, insects: boolean): Record<FKey, number> {
  const t = sp.traits;
  const dormant = isDormant(sp, e);
  let temp = e.temp < t.tMin || e.temp > t.tMax ? 0 : e.temp < t.tOptLo ? (e.temp - t.tMin) / (t.tOptLo - t.tMin) : e.temp > t.tOptHi ? (t.tMax - e.temp) / (t.tMax - t.tOptHi) : 1;
  if (dormant) temp = e.temp >= t.tMin ? 1 : 0;
  let light = dormant ? 1 : Math.min(1, e.light / t.lightNeed);
  if (e.light > t.lightMax) light = Math.min(light, Math.max(0, 1 - (e.light - t.lightMax) / 50));
  const salt = clamp(1 - Math.max(0, e.salt - t.saltTol) / (t.saltTol * 0.5 + 6), 0, 1);
  const wlog = t.epiphyte ? 0 : clamp((e.water - 70) / 30, 0, 1);
  const oxygen = 1 - wlog * (1 - t.floodTol);
  const eff = e.nutrients / 100 + (t.carnivore && insects ? 0.6 : 0) + (t.epiphyte ? 0.2 : 0);
  // nutrient shortage stunts growth rather than killing quickly, so it bottoms out at 35%
  let nutrients = 0.35 + 0.65 * clamp(eff / t.nNeed, 0, 1);
  if (t.carnivore && e.nutrients > 60) nutrients *= clamp(1 - (e.nutrients - 60) / 80, 0, 1);
  const water = clamp(store / 0.6, 0, 1);
  return { water, oxygen, salt, nutrients, light, temp };
}
const limiting = (f: Record<FKey, number>) => FKEYS.reduce((a, k) => (f[k] < f[a] ? k : a), FKEYS[0]);
const status = (h: number) => (h > 0.75 ? 'Thriving' : h > 0.5 ? 'Coping' : h > 0.25 ? 'Struggling' : 'Not surviving');

export function initPlantAdapt(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const st = { habitat: DEF.habitat, insects: DEF.insects, env: { ...HABITATS[DEF.habitat].env } as Env };
  const newPlant = (sp: SpeciesId): Plant => ({ sp, water: 0.8, health: 0.85, trapShut: 0, caught: 0 });
  const plots: Record<PlotId, Plant | null> = { A: newPlant(DEF.A), B: newPlant(DEF.B) };
  let day = 0;
  let acc = 0;
  let t = 0;
  let inspect: PlotId | null = null;
  let hist: Record<PlotId, Point[]> = { A: [], B: [] };
  const fly = { x: 620, y: 120, vx: 30, vy: 12, held: false, caughtBy: null as PlotId | null, timer: 0 };

  function dayStep() {
    day++;
    for (const id of ['A', 'B'] as PlotId[]) {
      const p = plots[id];
      if (!p) continue;
      const sp = SPECIES[p.sp];
      const { supply, demand } = waterFlow(sp, st.env, p.water);
      p.water = clamp(p.water + (supply - demand) / sp.traits.storage, 0, 1);
      const f = factors(sp, st.env, p.water, st.insects);
      const target = f[limiting(f)];
      p.health += (target - p.health) * (target < p.health ? 0.3 : 0.12);
      if (p.trapShut > 0) p.trapShut--;
      hist[id].push({ x: day, y: Math.round(p.health * 100) });
      if (hist[id].length > 400) hist[id].shift();
    }
    graphDirty = true;
  }
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    acc += dt;
    while (acc >= DAY_S) {
      acc -= DAY_S;
      dayStep();
    }
    stepFly(dt);
    if (graphDirty) drawGraph();
  }

  /* ---------- Flies (prey) ---------- */
  function trapZone(id: PlotId): Pt {
    return [PLOT_X[id], GROUND - 40];
  }
  function stepFly(dt: number) {
    if (!st.insects || fly.held) return;
    if (fly.caughtBy) {
      fly.timer -= dt;
      if (fly.timer <= 0) {
        fly.caughtBy = null;
        fly.x = 680;
        fly.y = 60 + Math.random() * 120;
      }
      return;
    }
    fly.vx += (Math.random() - 0.5) * 200 * dt;
    fly.vy += (Math.random() - 0.5) * 200 * dt;
    // open traps lure insects with nectar and colour
    for (const id of ['A', 'B'] as PlotId[]) {
      const p = plots[id];
      if (p?.sp === 'flytrap' && p.trapShut === 0 && p.health > 0.25) {
        const [zx, zy] = trapZone(id);
        fly.vx += Math.sign(zx - fly.x) * 25 * dt;
        fly.vy += Math.sign(zy - fly.y) * 25 * dt;
      }
    }
    fly.vx = clamp(fly.vx, -70, 70);
    fly.vy = clamp(fly.vy, -50, 50);
    fly.x += fly.vx * dt;
    fly.y += fly.vy * dt;
    if (fly.x < 20 || fly.x > 680) fly.vx *= -1;
    if (fly.y < 30 || fly.y > GROUND - 20) fly.vy *= -1;
    fly.x = clamp(fly.x, 20, 680);
    fly.y = clamp(fly.y, 30, GROUND - 20);
    for (const id of ['A', 'B'] as PlotId[]) {
      const p = plots[id];
      if (p?.sp === 'flytrap' && p.trapShut === 0 && p.health > 0.25) {
        const [zx, zy] = trapZone(id);
        if (Math.hypot(fly.x - zx, fly.y - zy) < 30) catchFly(id);
      }
    }
  }
  function catchFly(id: PlotId) {
    const p = plots[id]!;
    p.trapShut = 6;
    p.caught++;
    fly.caughtBy = id;
    fly.timer = 4;
    sim.announce('Snap! The flytrap caught an insect.');
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1150] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const sceneFrame = () => (portrait() ? { x: 10, y: 10, s: 660 / 700 } : { x: 10, y: 10, s: 1 });
  let K = 1;
  let cur = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  let areas: Area[] = [];
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string, act?: () => void) {
    const f = { ...frame };
    areas.push({ test: (px, py) => {
      const lx = (px - f.x) / f.s;
      const ly = (py - f.y) / f.s;
      return lx >= x && lx <= x + w && ly >= y && ly <= y + h;
    }, title, text, act });
  }
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function panel(x: number, y: number, w: number, h: number, alpha = 1) {
    ctx.fillStyle = withAlpha(pal['bg-elev'], alpha);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }
  function mix(a: string, b: string, k: number) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(k, 0, 1))).join(',')})`;
  }
  /** Leaf colour from health: green → yellow → brown. */
  const leafCol = (h: number, base = '#3f9e44') => (h > 0.5 ? mix('#c9b03a', base, (h - 0.5) * 2) : mix('#8a5a2b', '#c9b03a', h * 2));

  /* ---------- Plant drawings (base at x, y = ground; s = scale) ---------- */
  function drawSpecies(id: SpeciesId, x: number, y: number, s: number, h: number, store: number, opts: { trapShut?: boolean; dormant?: boolean; waterY?: number; roots?: boolean }) {
    const droop = (1 - h) * 0.9;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (opts.roots) drawRoots(id);
    if (id === 'cactus') {
      const w = 22 + 12 * clamp(store, 0, 1); // shrinks as stored water is used
      const col = leafCol(h, '#4c8c4a');
      ctx.fillStyle = col;
      const column = (cx: number, top: number, bottom: number, ww: number) => {
        ctx.beginPath();
        ctx.roundRect(cx - ww / 2, top, ww, bottom - top, ww / 2);
        ctx.fill();
      };
      column(0, -210, 0, w);
      // arms
      ctx.strokeStyle = col;
      ctx.lineWidth = w * 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -95);
      ctx.lineTo(-38, -95);
      ctx.lineTo(-38, -150 + droop * 20);
      ctx.moveTo(0, -120);
      ctx.lineTo(36, -120);
      ctx.lineTo(36, -178 + droop * 20);
      ctx.stroke();
      // ribs and spines
      ctx.strokeStyle = withAlpha('#1f3d1f', 0.45);
      ctx.lineWidth = 1.2;
      for (const dx of [-w / 4, 0, w / 4]) {
        ctx.beginPath();
        ctx.moveTo(dx, -205);
        ctx.lineTo(dx, -4);
        ctx.stroke();
      }
      ctx.fillStyle = '#f1e7c9';
      for (let yy = -200; yy < -6; yy += 14)
        for (const dx of [-w / 2 + 2, w / 2 - 2]) {
          ctx.fillRect(dx - 1, yy, 2, 2);
        }
      if (h > 0.6) {
        ctx.fillStyle = '#f8f0c8';
        ctx.beginPath();
        ctx.arc(0, -214, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'lily') {
      const wy = opts.waterY !== undefined ? opts.waterY : 0; // water surface relative to ground (negative = above)
      const floating = wy < -20;
      const padY = floating ? wy : -6;
      const col = leafCol(h, '#2f8a3a');
      ctx.strokeStyle = mix('#5a7a3a', '#7a5a3a', 1 - h);
      ctx.lineWidth = 3;
      for (const dx of [-50, 0, 48]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(dx * 0.4, padY * 0.5, dx, padY + 2);
        ctx.stroke();
      }
      for (const [dx, r] of [[-50, 34], [48, 30], [8, 26]] as [number, number][]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(dx, padY, r, r * 0.28, 0, 0.25, Math.PI * 2 - 0.05);
        ctx.lineTo(dx, padY);
        ctx.closePath();
        ctx.fill();
      }
      if (floating && h > 0.5) {
        ctx.fillStyle = '#f7a8c4';
        for (let k = 0; k < 6; k++) {
          ctx.save();
          ctx.translate(10, padY - 6);
          ctx.rotate(-Math.PI / 2 + (k - 2.5) * 0.35);
          ctx.beginPath();
          ctx.ellipse(0, -8, 4, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath();
        ctx.arc(10, padY - 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#6b4f2e';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'mangrove') {
      const col = leafCol(h, '#2e7d32');
      ctx.strokeStyle = '#6d4c33';
      ctx.lineWidth = 4;
      for (const dx of [-60, -36, -14, 14, 38, 62]) {
        ctx.beginPath();
        ctx.moveTo(dx * 0.15, -70);
        ctx.quadraticCurveTo(dx * 0.9, -60, dx, 0);
        ctx.stroke();
      }
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.lineTo(0, -150);
      ctx.stroke();
      ctx.fillStyle = col;
      for (const [dx, dy, r] of [[-40, -165, 34], [0, -185, 40], [42, -165, 34], [0, -150, 30]] as [number, number, number][]) {
        ctx.beginPath();
        ctx.arc(dx, dy + droop * 10, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#7a9a3a';
      ctx.lineWidth = 3;
      for (const dx of [-28, 30]) {
        ctx.beginPath();
        ctx.moveTo(dx, -140);
        ctx.lineTo(dx + 2, -105);
        ctx.stroke();
      }
    } else if (id === 'flytrap') {
      const col = leafCol(h, '#5aa02c');
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.48;
        const len = 46 + (k % 2) * 8;
        const ex = Math.cos(a) * len;
        const ey = Math.sin(a) * len * 0.9 + droop * 10;
        ctx.strokeStyle = col;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(ex * 0.75, ey * 0.75);
        ctx.stroke();
        const shut = opts.trapShut && k === 2;
        const open = shut ? 0.05 : 0.6 - droop * 0.3;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a + Math.PI / 2);
        for (const sg of [-1, 1]) {
          ctx.save();
          ctx.rotate(sg * open);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, -10, 8, 13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = mix('#8a2a2a', '#d64545', h);
          ctx.beginPath();
          ctx.ellipse(sg * 2, -10, 5, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          for (let c = 0; c < 6; c++) {
            const cy = -20 + c * 4;
            ctx.beginPath();
            ctx.moveTo(sg * 7, cy);
            ctx.lineTo(sg * 12, cy - 2);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.restore();
      }
      if (h > 0.6) {
        ctx.strokeStyle = '#5aa02c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(4, -95);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(4, -98, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'bromeliad') {
      // a fallen branch to perch on
      ctx.fillStyle = '#6d4c33';
      ctx.beginPath();
      ctx.roundRect(-55, -26, 110, 26, 10);
      ctx.fill();
      const col = leafCol(h, '#3d8b40');
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k - 4) * 0.3;
        const len = 62 - Math.abs(k - 4) * 5;
        ctx.strokeStyle = col;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.quadraticCurveTo(Math.cos(a) * len * 0.5, -30 + Math.sin(a) * len * 0.6, Math.cos(a) * len, -30 + Math.sin(a) * len * 0.8 + droop * 18 + Math.abs(k - 4) * 4);
        ctx.stroke();
      }
      if (store > 0.25) {
        ctx.fillStyle = withAlpha('#4dabf7', 0.8);
        ctx.beginPath();
        ctx.ellipse(0, -46, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (h > 0.6) {
        ctx.fillStyle = '#e03131';
        ctx.beginPath();
        ctx.moveTo(0, -95);
        ctx.lineTo(-9, -58);
        ctx.lineTo(9, -58);
        ctx.closePath();
        ctx.fill();
      }
    } else if (id === 'oak') {
      ctx.strokeStyle = '#6d4c33';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -120);
      ctx.stroke();
      ctx.lineWidth = 6;
      for (const [dx, dy] of [[-50, -170], [45, -175], [-20, -200], [20, -150]] as Pt[]) {
        ctx.beginPath();
        ctx.moveTo(0, -110);
        ctx.lineTo(dx, dy);
        ctx.stroke();
      }
      if (!opts.dormant) {
        ctx.fillStyle = leafCol(h, '#3a7d2c');
        for (const [dx, dy, r] of [[-50, -165, 42], [45, -170, 44], [0, -200, 46], [-10, -150, 40], [30, -140, 34]] as [number, number, number][]) {
          ctx.beginPath();
          ctx.arc(dx, dy + droop * 8, r * (0.7 + 0.3 * h), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#9c6b30';
        for (let k = 0; k < 10; k++) ctx.fillRect(-60 + k * 13, -4 - (k % 3) * 2, 6, 3);
      }
    } else {
      // sunflower
      const col = leafCol(h, '#4c9a2a');
      const bend = droop * 1.2;
      ctx.strokeStyle = col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(0, -120, Math.sin(bend) * 40, -170 + (1 - Math.cos(bend)) * 40);
      ctx.stroke();
      for (const [ly, sg] of [[-50, -1], [-80, 1], [-110, -1]] as Pt[]) {
        ctx.save();
        ctx.translate(0, ly);
        ctx.rotate(sg * (0.9 + droop * 0.8));
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, -18, 10, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const hx = Math.sin(bend) * 40;
      const hy = -170 + (1 - Math.cos(bend)) * 40;
      ctx.fillStyle = mix('#8a6a2a', '#ffc107', h);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(hx + Math.cos(a) * 18, hy + Math.sin(a) * 18, 5, 9, a + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#5a3a1a';
      ctx.beginPath();
      ctx.arc(hx, hy, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawRoots(id: SpeciesId) {
    ctx.strokeStyle = withAlpha('#8a6a4a', 0.75);
    ctx.lineWidth = 2;
    const line = (pts: Pt[]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    if (id === 'cactus') for (const dx of [-90, -50, 50, 90]) line([[0, 2], [dx * 0.5, 10], [dx, 14]]);
    else if (id === 'oak') {
      ctx.lineWidth = 4;
      line([[0, 0], [0, 60]]);
      ctx.lineWidth = 2;
      for (const dx of [-40, 40]) line([[0, 10], [dx, 30]]);
    } else if (id === 'sunflower') for (const dx of [-30, -12, 12, 30]) line([[0, 0], [dx, 30]]);
    else if (id === 'flytrap') for (const dx of [-10, 10]) line([[0, 0], [dx, 16]]);
    else if (id === 'lily') for (const dx of [-24, 0, 24]) line([[0, 2], [dx, 22]]);
    else if (id === 'mangrove') for (const dx of [-40, 40]) line([[dx * 0.8, 0], [dx, 22]]);
  }

  /* ---------- Scene ---------- */
  function waterSurfaceY() {
    const w = st.env.water;
    return w > 70 ? GROUND - (w - 70) * 3.3 : null;
  }
  function drawScene() {
    const e = st.env;
    const hab = st.habitat;
    const lightK = 0.35 + 0.65 * (e.light / 100);
    // sky
    const skyTop = hab === 'rainforest' ? '#1f4d2e' : hab === 'desert' ? '#f2b56b' : '#7ec3ef';
    const skyBot = hab === 'rainforest' ? '#2f6b3a' : hab === 'desert' ? '#fde2b4' : '#d6eefc';
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, skyTop);
    g.addColorStop(1, skyBot);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(0, 0, 700, 470, 12);
    ctx.fill();
    // background scenery
    if (hab === 'desert') {
      ctx.fillStyle = withAlpha('#d9a066', 0.6);
      ctx.beginPath();
      ctx.moveTo(0, 300);
      ctx.quadraticCurveTo(150, 240, 330, 300);
      ctx.quadraticCurveTo(520, 250, 700, 300);
      ctx.lineTo(700, GROUND);
      ctx.lineTo(0, GROUND);
      ctx.fill();
    } else if (hab === 'rainforest') {
      ctx.fillStyle = '#16301d';
      for (const x of [40, 640]) ctx.fillRect(x - 18, 0, 36, GROUND);
      ctx.fillStyle = '#245a32';
      for (let k = 0; k < 9; k++) {
        ctx.beginPath();
        ctx.arc(k * 85, 20, 60, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (hab === 'temperate') {
      ctx.fillStyle = withAlpha('#3a6b3a', 0.5);
      for (let k = 0; k < 8; k++) {
        ctx.beginPath();
        ctx.arc(30 + k * 95, 290, 46, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (hab === 'mangrove') {
      ctx.fillStyle = withAlpha('#2e6b3a', 0.55);
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        ctx.ellipse(50 + k * 110, 280, 60, 30, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // ground
    const soil = hab === 'desert' ? '#d8b26a' : hab === 'bog' ? '#6b6a3a' : hab === 'mangrove' ? '#6b5a44' : '#7a5a3c';
    ctx.fillStyle = mix(soil, '#5a4630', e.water / 140);
    ctx.fillRect(0, GROUND, 700, 470 - GROUND);
    if (hab === 'bog' || hab === 'temperate') {
      ctx.fillStyle = hab === 'bog' ? '#8aa63a' : '#5aa02c';
      ctx.fillRect(0, GROUND - 4, 700, 8);
    }
    // dry cracks
    if (e.water < 20) {
      ctx.strokeStyle = withAlpha('#5a3a1a', 0.5);
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 14; k++) {
        const x = 20 + k * 50;
        ctx.beginPath();
        ctx.moveTo(x, GROUND + 10);
        ctx.lineTo(x + 12, GROUND + 26);
        ctx.lineTo(x + 4, GROUND + 40);
        ctx.stroke();
      }
    }
    // salt crust
    if (e.salt > 8) {
      ctx.fillStyle = withAlpha('#ffffff', clamp(e.salt / 45, 0.2, 0.8));
      for (let k = 0; k < 60; k++) ctx.fillRect((k * 53) % 700, GROUND + 2 + ((k * 17) % 10), 3, 2);
    }
    // plants (roots shown in the soil)
    const wy = waterSurfaceY();
    for (const id of ['A', 'B'] as PlotId[]) {
      const p = plots[id];
      const x = PLOT_X[id];
      ctx.strokeStyle = withAlpha(COL_PLOT[id], 0.7);
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, GROUND + 6, 80, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!p) {
        text(`Drop a plant in plot ${id}`, x, GROUND - 40, 12, pal['text-muted'], 'center', 700);
        continue;
      }
      drawSpecies(p.sp, x, GROUND, 1, p.health, p.water, { trapShut: p.trapShut > 0, dormant: isDormant(SPECIES[p.sp], e), waterY: wy !== null ? wy - GROUND : undefined, roots: true });
    }
    // standing water (drawn over the plants: they are under water)
    if (wy !== null) {
      ctx.fillStyle = e.salt > 10 ? withAlpha('#2b8a9e', 0.45) : withAlpha('#4dabf7', 0.42);
      ctx.fillRect(0, wy, 700, GROUND + 8 - wy);
      ctx.strokeStyle = withAlpha('#ffffff', 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= 700; x += 8) {
        const yy = wy + Math.sin(x / 20 + t * 2) * 1.5;
        if (x) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
      // floating lily pads stay on top of the water
      for (const id of ['A', 'B'] as PlotId[]) {
        const p = plots[id];
        if (p?.sp === 'lily' && wy < GROUND - 20) drawSpecies('lily', PLOT_X[id], GROUND, 1, p.health, p.water, { waterY: wy - GROUND });
      }
    }
    // frost and low light
    if (e.temp < 0) {
      ctx.fillStyle = withAlpha('#ffffff', 0.85);
      ctx.fillRect(0, GROUND - 3, 700, 5);
      for (let k = 0; k < 40; k++) {
        ctx.beginPath();
        ctx.arc((k * 97 + t * 12) % 700, (k * 41 + t * 30) % GROUND, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (lightK < 1) {
      ctx.fillStyle = withAlpha('#000000', (1 - lightK) * 0.55);
      ctx.fillRect(0, 0, 700, 470);
    }
    // the fly
    if (st.insects && !fly.caughtBy) {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.ellipse(fly.x, fly.y, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha('#ffffff', 0.7);
      const flap = Math.sin(t * 60) * 2;
      ctx.beginPath();
      ctx.ellipse(fly.x - 2, fly.y - 3 - flap, 3, 2, -0.5, 0, Math.PI * 2);
      ctx.ellipse(fly.x + 2, fly.y - 3 - flap, 3, 2, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // labels and plot tags
    for (const id of ['A', 'B'] as PlotId[]) {
      const p = plots[id];
      const x = PLOT_X[id];
      ctx.fillStyle = COL_PLOT[id];
      ctx.beginPath();
      ctx.arc(x - 70, GROUND + 30, 11, 0, Math.PI * 2);
      ctx.fill();
      text(id, x - 70, GROUND + 35, 12, '#ffffff', 'center', 800);
      if (p) {
        const sp = SPECIES[p.sp];
        text(sp.name, x - 52, GROUND + 35, 12.5, '#ffffff', 'left', 750);
        const s = status(p.health);
        ctx.fillStyle = s === 'Thriving' ? pal.success : s === 'Coping' ? pal.accent : s === 'Struggling' ? pal.warning : pal.danger;
        ctx.font = fs(11.5, 750);
        const w = ctx.measureText(s).width + 14;
        ctx.beginPath();
        ctx.roundRect(x - 52, GROUND + 42, w, 18 / cur + 2, 8);
        ctx.fill();
        text(s, x - 45, GROUND + 42 + 14 / cur, 11.5, '#ffffff', 'left', 750);
      }
      rect(x - 90, GROUND - 240, 180, 300, p ? `Plot ${id}: ${SPECIES[p.sp].name}` : `Plot ${id}`, () => (p ? `${SPECIES[p.sp].group}. ${SPECIES[p.sp].blurb} Tap “Inspect” to explore its adaptations.` : 'Empty plot. Drag a plant here from the tray.'), p ? () => openInspect(id) : undefined);
    }
    text(HABITATS[hab].name, 12, 24, 14, '#ffffff', 'left', 800);
  }

  /* ---------- Tray of plants ---------- */
  const trayFrame = () => (portrait() ? { x: 10, y: 470, w: 660, h: 120 } : { x: 10, y: 488, w: 700, h: 102 });
  let chips: { id: SpeciesId; x: number; y: number; w: number; h: number }[] = [];
  function drawTray() {
    const T = trayFrame();
    panel(T.x, T.y, T.w, T.h);
    const n = ORDER.length;
    const cw = T.w / n;
    chips = [];
    ORDER.forEach((id, i) => {
      const cx = T.x + cw * (i + 0.5);
      const by = T.y + T.h - 30;
      drawSpecies(id, cx, by, 0.22, 1, 1, { waterY: id === 'lily' ? -18 : undefined });
      const short: Record<SpeciesId, string> = { cactus: 'Cactus', lily: 'Lily', mangrove: 'Mangrove', flytrap: 'Flytrap', bromeliad: 'Bromeliad', oak: 'Oak', sunflower: 'Sunflower' };
      text(short[id], cx, T.y + T.h - 10, 10.5, pal['sim-text'], 'center', 700);
      chips.push({ id, x: cx - cw / 2, y: T.y, w: cw, h: T.h });
    });
    text('Drag a plant into plot A or B', T.x + 10, T.y + 16, 11, pal['text-faint'], 'left', 650);
  }

  /* ---------- Factor comparison panel ---------- */
  function drawFactors(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Stress factors (100% = none)', x + 12, y + 22, 12.5, pal['sim-text'], 'left', 750);
    const lh = 16 / cur;
    const blockH = 3 * lh + 10;
    const rowH = (h - 40 - 2 * blockH - 10) / FKEYS.length;
    const barX = x + 12;
    const barW = w - 24;
    const fA = plots.A ? factors(SPECIES[plots.A.sp], st.env, plots.A.water, st.insects) : null;
    const fB = plots.B ? factors(SPECIES[plots.B.sp], st.env, plots.B.water, st.insects) : null;
    const limA = fA ? limiting(fA) : null;
    const limB = fB ? limiting(fB) : null;
    const wide = w > 500;
    FKEYS.forEach((k, i) => {
      const yy = y + 36 + i * rowH;
      const bx = wide ? x + w * 0.36 : barX;
      const bw = wide ? x + w - 12 - bx : barW;
      text(FNAME[k], barX, wide ? yy + rowH / 2 + 4 : yy + 13, 11.5, pal['text-muted'], 'left', 700);
      [[fA, 'A', limA], [fB, 'B', limB]].forEach(([f, id, lim], j) => {
        const by = wide ? yy + rowH / 2 - 11 + j * 12 : yy + 18 + j * 11;
        ctx.fillStyle = withAlpha(pal['text-faint'], 0.18);
        ctx.fillRect(bx, by, bw, 9);
        if (f) {
          const v = (f as Record<FKey, number>)[k];
          ctx.fillStyle = COL_PLOT[id as PlotId];
          ctx.fillRect(bx, by, bw * v, 9);
          if (lim === k) {
            ctx.strokeStyle = pal.danger;
            ctx.lineWidth = 2 / cur;
            ctx.strokeRect(bx - 1, by - 1, bw + 2, 11);
          }
        }
      });
    });
    // status summary
    let yy = y + h - 2 * blockH + lh * 0.6;
    for (const id of ['A', 'B'] as PlotId[]) {
      const p = plots[id];
      ctx.fillStyle = COL_PLOT[id];
      ctx.fillRect(x + 12, yy - 10, 10, 10);
      if (!p) {
        text(`${id}: empty`, x + 28, yy, 11.5, pal['text-muted'], 'left', 700);
        yy += blockH;
        continue;
      }
      const f = factors(SPECIES[p.sp], st.env, p.water, st.insects);
      const lim = limiting(f);
      text(`${id}: ${SPECIES[p.sp].name}`, x + 28, yy, 11.5, pal['sim-text'], 'left', 750);
      text(`${status(p.health)} (health ${pct(p.health)})`, x + 28, yy + lh, 11, pal['text-muted'], 'left', 650);
      text(f[lim] > 0.95 ? 'No strong stress' : `Limited by: ${FNAME[lim].toLowerCase()}`, x + 28, yy + 2 * lh, 11, f[lim] > 0.95 ? pal.success : pal.danger, 'left', 700);
      yy += blockH;
    }
    rect(x, y, w, h, 'Stress factors', () => 'Each bar shows how well the plant copes with one condition (100% = no stress). The red outline marks the most limiting factor: as in real plants, the worst stress sets how well it can grow. These are simplified relative indices, not measurements.');
  }

  /* ---------- Inspect overlay ---------- */
  let inspectSel = -1;
  function openInspect(id: PlotId) {
    if (!plots[id]) return;
    inspect = id;
    inspectSel = -1;
    root.querySelector<HTMLElement>('[data-close]')!.hidden = false;
    sim.requestRender();
  }
  function closeInspect() {
    inspect = null;
    root.querySelector<HTMLElement>('[data-close]')!.hidden = true;
    sim.hideTooltip();
    sim.requestRender();
  }
  function drawInspect() {
    const p = plots[inspect!]!;
    const sp = SPECIES[p.sp];
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.97);
    ctx.beginPath();
    ctx.roundRect(0, 0, 700, 470, 12);
    ctx.fill();
    text(`${sp.name} (${sp.sci})`, 16, 26, 15, pal['sim-text'], 'left', 800);
    text(`${sp.group} · from: ${HABITATS[sp.home].name}`, 16, 46, 12, pal['text-muted'], 'left', 650);
    // drawing box
    const bx = 30;
    const by = 60;
    const bw = 300;
    const bh = 390;
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.08);
    ctx.fillRect(bx, by, bw, bh);
    const groundY = by + bh * 0.82;
    ctx.fillStyle = withAlpha('#7a5a3c', 0.35);
    ctx.fillRect(bx, groundY, bw, by + bh - groundY);
    drawSpecies(p.sp, bx + bw / 2, groundY, 1.45, Math.max(p.health, 0.9), Math.max(p.water, 0.8), { waterY: p.sp === 'lily' ? -bh * 0.5 : undefined, roots: true });
    if (p.sp === 'lily') {
      ctx.fillStyle = withAlpha('#4dabf7', 0.3);
      ctx.fillRect(bx, groundY - bh * 0.5, bw, bh * 0.5);
    }
    // hotspots
    sp.adaptations.forEach((a, i) => {
      const hx = bx + a.at[0] * bw;
      const hy = by + a.at[1] * bh;
      const c = CAT[a.cat].color;
      ctx.fillStyle = i === inspectSel ? c : withAlpha(c, 0.85);
      ctx.beginPath();
      ctx.arc(hx, hy, i === inspectSel ? 13 : 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(String(i + 1), hx, hy + 4, 11, '#ffffff', 'center', 800);
      const f = { ...frame };
      areas.push({ test: (px, py) => Math.hypot((px - f.x) / f.s - hx, (py - f.y) / f.s - hy) < 16, title: `${i + 1}. ${a.name}`, text: () => `${a.kind} adaptation · ${CAT[a.cat].name}. ${a.text}`, act: () => (inspectSel = i) });
    });
    // list: one line per adaptation; details for the selected one below
    const lx = 350;
    const lh = 15 / cur;
    const rowH = lh + 9;
    let ly = 64 + lh;
    sp.adaptations.forEach((a, i) => {
      const c = CAT[a.cat].color;
      const sel = i === inspectSel;
      const yTop = ly - lh;
      if (sel) {
        ctx.fillStyle = withAlpha(c, 0.18);
        ctx.fillRect(lx - 6, yTop - 2, 340, rowH);
      }
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(lx + 6, ly - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      text(String(i + 1), lx + 6, ly, 10, '#ffffff', 'center', 800);
      text(a.name, lx + 20, ly, 12, pal['sim-text'], 'left', sel ? 800 : 650);
      const f = { ...frame };
      areas.push({ test: (px, py) => {
        const X = (px - f.x) / f.s;
        const Y = (py - f.y) / f.s;
        return X >= lx - 6 && X <= lx + 334 && Y >= yTop - 2 && Y <= yTop - 2 + rowH;
      }, title: `${i + 1}. ${a.name}`, text: () => `${a.kind} adaptation · ${CAT[a.cat].name}. ${a.text}`, act: () => (inspectSel = i) });
      ly += rowH;
    });
    ly += 6;
    if (inspectSel >= 0) {
      const a = sp.adaptations[inspectSel];
      text(`${a.kind} · ${CAT[a.cat].name}`, lx - 4, ly + lh * 0.4, 11.5, CAT[a.cat].color, 'left', 750);
      ctx.font = fs(11.5, 600);
      ctx.fillStyle = pal['text-muted'];
      let line = '';
      let yy = ly + lh * 1.5;
      for (const wd of a.text.split(' ')) {
        const test = line ? `${line} ${wd}` : wd;
        if (ctx.measureText(test).width > 330 && line) {
          ctx.fillText(line, lx - 4, yy);
          line = wd;
          yy += lh;
        } else line = test;
      }
      if (line) ctx.fillText(line, lx - 4, yy);
    } else text('Tap a number for details', lx - 4, ly + lh * 0.4, 11.5, pal['text-faint'], 'left', 650);
  }

  /* ---------- Render ---------- */
  let dragChip: { id: SpeciesId; x: number; y: number } | null = null;
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    const { k, ox, oy } = tf();
    K = k;
    cur = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    frame = { x: 0, y: 0, s: 1 };
    drawTray();
    if (portrait()) drawFactors(10, 600, 660, 540);
    else drawFactors(720, 56, 270, 534);
    const S = sceneFrame();
    ctx.save();
    ctx.translate(S.x, S.y);
    ctx.scale(S.s, S.s);
    ctx.beginPath();
    ctx.roundRect(0, 0, 700, 470, 12);
    ctx.clip();
    frame = { x: S.x, y: S.y, s: S.s };
    cur = K * S.s;
    if (inspect) drawInspect();
    else drawScene();
    ctx.restore();
    frame = { x: 0, y: 0, s: 1 };
    cur = K;
    if (dragChip) {
      ctx.globalAlpha = 0.85;
      drawSpecies(dragChip.id, dragChip.x, dragChip.y + 30, 0.35, 1, 1, { waterY: dragChip.id === 'lily' ? -20 : undefined });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    updateUi();
  }

  /* ---------- Graph ---------- */
  let graphDirty = true;
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="pa-graph"]')!, {
    x: { min: 0, span: 60, step: 10, format: (v) => `${v}` },
    y: { min: 0, max: 100, step: 25, format: (v) => `${v}%` },
  });
  const comparer = runComparer(root.querySelector<HTMLElement>('[data-graph-panel="pa-graph"]')!, graph, {
    currentId: 'A',
    label: () => `${plots.A ? SPECIES[plots.A.sp].name : 'A'} in ${HABITATS[st.habitat].name.toLowerCase()}`,
  });
  function drawGraph() {
    graphDirty = false;
    graph.set('A', { label: `A: ${plots.A ? SPECIES[plots.A.sp].name : 'empty'} (health)`, color: COL_PLOT.A, points: hist.A });
    graph.set('B', { label: `B: ${plots.B ? SPECIES[plots.B.sp].name : 'empty'} (health)`, color: COL_PLOT.B, points: hist.B });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="pa-graph"]'));
  }

  /* ---------- Readouts ---------- */
  function updateUi() {
    ui.readout('day', `${day}`);
    for (const id of ['A', 'B'] as PlotId[]) {
      const p = plots[id];
      if (!p) {
        ui.readout(`s${id}`, 'Empty');
        ui.readout(`l${id}`, '—');
        continue;
      }
      const f = factors(SPECIES[p.sp], st.env, p.water, st.insects);
      const lim = limiting(f);
      const s = status(p.health);
      ui.readout(`s${id}`, `${SPECIES[p.sp].name}: ${s}`, s === 'Thriving' ? 'ok' : s === 'Coping' ? null : s === 'Struggling' ? 'warn' : 'bad');
      ui.readout(`l${id}`, f[lim] > 0.95 ? 'None' : `${FNAME[lim]} (${pct(f[lim])})`);
    }
    ui.readout('caught', `${(plots.A?.sp === 'flytrap' ? plots.A.caught : 0) + (plots.B?.sp === 'flytrap' ? plots.B.caught : 0)}`);
    sim.setBadge(inspect ? `Inspecting ${SPECIES[plots[inspect]!.sp].name}` : `${HABITATS[st.habitat].name} · day ${day}`);
    const pa = plots.A;
    const pb = plots.B;
    let note = HABITATS[st.habitat].text;
    if (inspect) note = `${SPECIES[plots[inspect]!.sp].blurb} Tap the numbered points to see what each adaptation does. Close the view to return to the experiment.`;
    else if (pa && pb) {
      const fa = factors(SPECIES[pa.sp], st.env, pa.water, st.insects);
      const fb = factors(SPECIES[pb.sp], st.env, pb.water, st.insects);
      const la = limiting(fa);
      const lb = limiting(fb);
      const say = (p: Plant, f: Record<FKey, number>, l: FKey) =>
        f[l] > 0.95
          ? `${SPECIES[p.sp].name} copes with every condition here`
          : `${SPECIES[p.sp].name} is limited by ${FNAME[l].toLowerCase()} (${pct(f[l])})`;
      note = `${HABITATS[st.habitat].text} ${say(pa, fa, la)}; ${say(pb, fb, lb).replace(/^./, (c) => c.toLowerCase())}.`;
      if (pa.sp === 'flytrap' || pb.sp === 'flytrap') note += st.insects ? ' Insects give the flytrap extra nitrogen and phosphorus.' : ' With no insects to catch, the flytrap depends on the poor soil alone.';
      if ((pa.sp === 'oak' || pb.sp === 'oak') && isDormant(SPECIES.oak, st.env)) note += ' Below 5 °C the oak has dropped its leaves and is dormant.';
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', `${HABITATS[st.habitat].name}, day ${day}. Plot A: ${pa ? `${SPECIES[pa.sp].name}, ${status(pa.health)}` : 'empty'}. Plot B: ${pb ? `${SPECIES[pb.sp].name}, ${status(pb.health)}` : 'empty'}.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  let syncing = false;
  const habSel = root.querySelector<HTMLSelectElement>('[data-habitat]')!;
  const selA = root.querySelector<HTMLSelectElement>('[data-plot="A"]')!;
  const selB = root.querySelector<HTMLSelectElement>('[data-plot="B"]')!;
  const envChanged = () => {
    if (syncing) return;
    graphDirty = true;
    sim.requestRender();
  };
  const tempCtl = ui.range('pa-temp', (v) => `${v} °C`, (v) => ((st.env.temp = v), envChanged()));
  const waterCtl = ui.range('pa-water', (v) => (v >= 85 ? `${v} (standing water)` : v >= 70 ? `${v} (waterlogged)` : v < 20 ? `${v} (very dry)` : `${v}`), (v) => ((st.env.water = v), envChanged()));
  const saltCtl = ui.range('pa-salt', (v) => `${v} g/L`, (v) => ((st.env.salt = v), envChanged()));
  const lightCtl = ui.range('pa-light', (v) => `${v}%`, (v) => ((st.env.light = v), envChanged()));
  const nutCtl = ui.range('pa-nut', (v) => `${v}%`, (v) => ((st.env.nutrients = v), envChanged()));
  const insectCtl = ui.toggle('pa-insects', (v) => ((st.insects = v), envChanged()));
  function setHabitat(h: HabitatId) {
    st.habitat = h;
    habSel.value = h;
    const e = HABITATS[h].env;
    syncing = true;
    tempCtl.set(e.temp);
    waterCtl.set(e.water);
    saltCtl.set(e.salt);
    lightCtl.set(e.light);
    nutCtl.set(e.nutrients);
    syncing = false;
    st.env = { ...e };
    graphDirty = true;
    sim.requestRender();
  }
  habSel.addEventListener('change', () => setHabitat(habSel.value as HabitatId));
  function plant(id: PlotId, sp: SpeciesId | '') {
    plots[id] = sp ? newPlant(sp) : null;
    (id === 'A' ? selA : selB).value = sp;
    hist[id] = [];
    if (inspect === id) closeInspect();
    graphDirty = true;
    sim.requestRender();
  }
  selA.addEventListener('change', () => plant('A', selA.value as SpeciesId | ''));
  selB.addEventListener('change', () => plant('B', selB.value as SpeciesId | ''));
  root.querySelector('[data-native]')?.addEventListener('click', () => plant('A', HABITATS[st.habitat].native));
  root.querySelector('[data-inspect="A"]')?.addEventListener('click', () => openInspect('A'));
  root.querySelector('[data-inspect="B"]')?.addEventListener('click', () => openInspect('B'));
  root.querySelector('[data-close]')?.addEventListener('click', closeInspect);
  root.querySelector('[data-step]')?.addEventListener('click', () => {
    sim.pause();
    dayStep();
    sim.requestRender();
  });

  /* ---------- Dragging ---------- */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  const toScene = (bx: number, by: number): Pt => {
    const S = sceneFrame();
    return [(bx - S.x) / S.s, (by - S.y) / S.s];
  };
  enableDrag<'chip' | 'fly'>(canvas, {
    hit(x, y) {
      const [bx, by] = toBox(x, y);
      if (!inspect && st.insects && !fly.caughtBy) {
        const [sx, sy] = toScene(bx, by);
        if (Math.hypot(sx - fly.x, sy - fly.y) < 16) return 'fly';
      }
      if (chips.some((c) => bx >= c.x && bx <= c.x + c.w && by >= c.y && by <= c.y + c.h)) return 'chip';
      return null;
    },
    start(id, x, y) {
      sim.hideTooltip();
      const [bx, by] = toBox(x, y);
      if (id === 'fly') fly.held = true;
      else {
        const c = chips.find((q) => bx >= q.x && bx <= q.x + q.w && by >= q.y && by <= q.y + q.h)!;
        dragChip = { id: c.id, x: bx, y: by };
      }
    },
    move(id, x, y) {
      const [bx, by] = toBox(x, y);
      if (id === 'fly') {
        const [sx, sy] = toScene(bx, by);
        fly.x = clamp(sx, 10, 690);
        fly.y = clamp(sy, 20, 460);
      } else if (dragChip) {
        dragChip.x = bx;
        dragChip.y = by;
      }
      sim.requestRender();
    },
    end(id) {
      if (id === 'fly') {
        fly.held = false;
        for (const pid of ['A', 'B'] as PlotId[]) {
          const p = plots[pid];
          const [zx, zy] = trapZone(pid);
          if (p?.sp === 'flytrap' && p.trapShut === 0 && Math.hypot(fly.x - zx, fly.y - zy) < 60) catchFly(pid);
        }
      } else if (dragChip) {
        const [sx, sy] = toScene(dragChip.x, dragChip.y);
        if (sx >= 0 && sx <= 700 && sy >= 0 && sy <= 470) {
          if (inspect) closeInspect();
          plant(sx < 350 ? 'A' : 'B', dragChip.id);
          if (!sim.running) sim.play();
        }
        dragChip = null;
      }
      sim.requestRender();
    },
    click(x, y) {
      const [bx, by] = toBox(x, y);
      for (let i = areas.length - 1; i >= 0; i--)
        if (areas[i].test(bx, by)) {
          areas[i].act?.();
          sim.showTooltip(x, y, areas[i].title, areas[i].text());
          sim.requestRender();
          return;
        }
      const c = chips.find((q) => bx >= q.x && bx <= q.x + q.w && by >= q.y && by <= q.y + q.h);
      if (c) sim.showTooltip(x, y, SPECIES[c.id].name, `${SPECIES[c.id].group}. ${SPECIES[c.id].blurb} Drag it into plot A or B.`);
      else sim.hideTooltip();
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: true,
    reset() {
      day = 0;
      acc = 0;
      hist = { A: [], B: [] };
      closeInspect();
      setHabitat(DEF.habitat);
      insectCtl.set(DEF.insects, false);
      st.insects = DEF.insects;
      plant('A', DEF.A);
      plant('B', DEF.B);
      comparer.refresh();
    },
  });
  setHabitat(DEF.habitat);
  drawGraph();
  updateUi();
}
