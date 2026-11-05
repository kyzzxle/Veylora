/**
 * Food web of a temperate woodland meadow.
 *
 * Each population is measured relative to its normal size (1 = normal).
 * Every year a species grows or shrinks depending on:
 *   food      – the average level of the things it eats (less food → decline)
 *   predation – the average level of the things that eat it (more predators → decline)
 *   crowding  – competition for space and territory pulls it back towards normal
 *   rate = a·(food − 1) − b·(predators − 1) − c·(N − 1)
 * Producers get energy from sunlight instead of food. A species that falls
 * below 3 % of normal dies out locally. At normal levels everything balances,
 * so any change you make ripples through the web.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'danger'] as const;

interface Species {
  id: string;
  name: string;
  icon: string;
  level: 0 | 1 | 2 | 3;
  eats: string[];
  x: number;
  about: string;
}
const LEVEL_NAME = ['Producer', 'Primary consumer (herbivore)', 'Secondary consumer', 'Top predator'];
const LEVEL_COLOUR = ['#4caf50', '#f2a541', '#4c8dd6', '#e0605a'];
const SPECIES: Species[] = [
  { id: 'grass', name: 'Grass', icon: '🌾', level: 0, eats: [], x: 160, about: 'Captures the Sun’s energy by photosynthesis. Producers are the base of every food web.' },
  { id: 'oak', name: 'Oak tree', icon: '🌳', level: 0, eats: [], x: 450, about: 'Its leaves feed caterpillars and its acorns and twigs feed deer.' },
  { id: 'berries', name: 'Berry bushes', icon: '🍒', level: 0, eats: [], x: 740, about: 'Fruit feeds rabbits, birds and foxes, which spread the seeds.' },
  { id: 'grasshopper', name: 'Grasshopper', icon: '🦗', level: 1, eats: ['grass'], x: 90, about: 'An insect herbivore. Insects are a vital food source for many animals.' },
  { id: 'caterpillar', name: 'Caterpillar', icon: '🐛', level: 1, eats: ['oak'], x: 250, about: 'Eats oak leaves. A single pair of songbirds may feed their chicks thousands of caterpillars.' },
  { id: 'rabbit', name: 'Rabbit', icon: '🐇', level: 1, eats: ['grass', 'berries'], x: 410, about: 'A fast-breeding herbivore eaten by several predators.' },
  { id: 'mouse', name: 'Mouse', icon: '🐁', level: 1, eats: ['grass', 'berries'], x: 570, about: 'Eats seeds and fruit. Prey for snakes, foxes and hawks.' },
  { id: 'deer', name: 'Deer', icon: '🦌', level: 1, eats: ['grass', 'oak'], x: 760, about: 'A large browser. Without predators, deer can overgraze and stop young trees growing.' },
  { id: 'frog', name: 'Frog', icon: '🐸', level: 2, eats: ['grasshopper', 'caterpillar'], x: 120, about: 'A specialist insect-eater: it depends entirely on insects.' },
  { id: 'songbird', name: 'Songbird', icon: '🐦', level: 2, eats: ['caterpillar', 'grasshopper', 'berries'], x: 330, about: 'An omnivore that eats insects and berries.' },
  { id: 'snake', name: 'Snake', icon: '🐍', level: 2, eats: ['mouse', 'frog'], x: 540, about: 'Eats mice and frogs, and is itself eaten by hawks.' },
  { id: 'fox', name: 'Fox', icon: '🦊', level: 2, eats: ['rabbit', 'mouse', 'songbird', 'berries'], x: 760, about: 'A flexible omnivore that can switch between many foods.' },
  { id: 'hawk', name: 'Hawk', icon: '🦅', level: 3, eats: ['mouse', 'rabbit', 'snake', 'songbird'], x: 300, about: 'A top predator. Pesticides that build up along food chains once nearly wiped out birds of prey.' },
  { id: 'wolf', name: 'Wolf', icon: '🐺', level: 3, eats: ['deer', 'rabbit'], x: 640, about: 'A top predator. When wolves returned to Yellowstone, fewer deer and elk let trees and rivers recover: a trophic cascade.' },
];
const BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const PREDATORS: Record<string, string[]> = Object.fromEntries(SPECIES.map((s) => [s.id, SPECIES.filter((p) => p.eats.includes(s.id)).map((p) => p.id)]));
const A = [0, 0.9, 0.7, 0.5]; // response to food, by level
const B = 0.6; // response to predators
const C = 0.35; // crowding
const LEVEL_Y = [470, 340, 210, 80];

export function initFoodWeb(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const infoTitle = root.querySelector<HTMLElement>('[data-info-title]')!;
  const infoText = root.querySelector<HTMLElement>('[data-info-text]')!;

  let N: Record<string, number> = {};
  let removed = new Set<string>();
  let lost = new Set<string>();
  let year = 0;
  let selected = 'wolf';
  let history: Record<string, Point[]> = {};

  function restart() {
    N = Object.fromEntries(SPECIES.map((s) => [s.id, 1]));
    removed = new Set();
    lost = new Set();
    year = 0;
    history = Object.fromEntries(SPECIES.map((s) => [s.id, [{ x: 0, y: 100 }]]));
  }

  const avg = (ids: string[]) => (ids.length ? ids.reduce((t, id) => t + N[id], 0) / ids.length : 1);

  function step(dt: number) {
    const years = dt * 1.5;
    const n = Math.ceil(years / 0.05);
    const h = years / n;
    for (let k = 0; k < n; k++) {
      const next: Record<string, number> = {};
      for (const s of SPECIES) {
        const x = N[s.id];
        if (x <= 0) {
          next[s.id] = 0;
          continue;
        }
        const preds = PREDATORS[s.id];
        const food = s.level === 0 ? 1 : Math.min(avg(s.eats), 1.8);
        const pred = preds.length ? avg(preds) : 1;
        const rate = (s.level === 0 ? 0 : A[s.level] * (food - 1)) - B * (pred - 1) - C * (x - 1);
        next[s.id] = clamp(x + x * rate * h, 0, 4);
      }
      for (const s of SPECIES) {
        N[s.id] = next[s.id];
        if (N[s.id] > 0 && N[s.id] < 0.03) {
          N[s.id] = 0;
          if (!removed.has(s.id)) {
            lost.add(s.id);
            sim.announce(`${s.name} has died out.`);
          }
        }
      }
      year += h;
    }
    if (Math.floor(year * 2) / 2 > history.grass[history.grass.length - 1].x)
      for (const s of SPECIES) history[s.id].push({ x: Math.floor(year * 2) / 2, y: N[s.id] * 100 });
  }

  /* ---------- Drawing (design box 900 × 560; squeezed to 470 wide on phones) ---------- */
  const narrow = () => size.w < 520;
  const tf = () => {
    const bw = narrow() ? 470 : 900;
    const k = Math.min(size.w / bw, size.h / 560);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - 560 * k) / 2 };
  };
  const pos = (s: Species) => [narrow() ? 48 + ((s.x - 90) / 670) * 380 : s.x, LEVEL_Y[s.level]] as const;
  const radius = (id: string) => 16 + 12 * Math.sqrt(Math.min(N[id], 3));

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);

    // Level bands
    for (let l = 0; l < 4; l++) {
      ctx.fillStyle = LEVEL_COLOUR[l];
      ctx.globalAlpha = 0.07;
      ctx.fillRect(0, LEVEL_Y[l] - 55, narrow() ? 470 : 900, 110);
      ctx.globalAlpha = 1;
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'left';
      ctx.fillText(LEVEL_NAME[l].split(' (')[0], 8, LEVEL_Y[l] - 40);
    }
    // Energy-flow arrows (prey → predator)
    for (const s of SPECIES) {
      for (const preyId of s.eats) {
        const prey = BY_ID[preyId];
        const [x1, y1] = pos(prey);
        const [x2, y2] = pos(s);
        const active = N[s.id] > 0 && N[preyId] > 0;
        const hl = selected === s.id || selected === preyId;
        const d = Math.hypot(x2 - x1, y2 - y1);
        const ux = (x2 - x1) / d;
        const uy = (y2 - y1) / d;
        const r1 = radius(preyId) + 2;
        const r2 = radius(s.id) + 4;
        ctx.globalAlpha = !active ? 0.12 : hl ? 0.95 : 0.3;
        arrow(ctx, x1 + ux * r1, y1 + uy * r1, x2 - ux * r2, y2 - uy * r2, hl ? pal.accent : pal['text-faint'], hl ? 3 : 1.6, 10);
        ctx.globalAlpha = 1;
      }
    }
    // Species nodes
    for (const s of SPECIES) {
      const [x, y] = pos(s);
      const n = N[s.id];
      const gone = n <= 0;
      const r = gone ? 18 : radius(s.id);
      ctx.fillStyle = gone ? 'rgba(120,120,120,0.25)' : LEVEL_COLOUR[s.level];
      ctx.globalAlpha = gone ? 1 : 0.28;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s.id === selected ? pal.accent : gone ? 'rgba(150,150,150,0.6)' : LEVEL_COLOUR[s.level];
      ctx.lineWidth = s.id === selected ? 4 : 2;
      ctx.setLineDash(gone ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${Math.round(r * 0.95)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = gone ? 0.3 : 1;
      ctx.fillText(s.icon, x, y + 1);
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'alphabetic';
      ctx.font = fs(11, 700);
      ctx.fillStyle = gone ? pal.danger : pal['sim-text'];
      if (narrow()) {
        // two short lines so neighbouring labels do not overlap
        ctx.font = fs(9.5, 700);
        ctx.fillText(s.name.split(' ')[0], x, y + r + 11 / k);
        ctx.fillText(gone ? '✕' : `${Math.round(n * 100)}%`, x, y + r + 22 / k);
      } else ctx.fillText(gone ? `${s.name} ✕` : `${s.name} ${Math.round(n * 100)}%`, x, y + r + 14 / k);
    }
    ctx.restore();
    updateReadouts();
    sim.setTime(year, ' years');
    drawGraph();
  }

  function updateReadouts() {
    const s = BY_ID[selected];
    infoTitle.textContent = `${s.icon} ${s.name}`;
    infoText.textContent = s.about;
    ui.readout('sel', s.name);
    ui.readout('level', LEVEL_NAME[s.level]);
    ui.readout('eats', s.level === 0 ? 'Sunlight (photosynthesis)' : s.eats.map((id) => BY_ID[id].name).join(', '));
    ui.readout('eatenBy', PREDATORS[s.id].length ? PREDATORS[s.id].map((id) => BY_ID[id].name).join(', ') : 'Nothing: it is a top predator');
    const n = N[s.id];
    ui.readout('pop', n <= 0 ? (removed.has(s.id) ? 'Removed' : 'Died out') : `${Math.round(n * 100)} % of normal`, n <= 0 ? 'bad' : n < 0.5 || n > 1.6 ? 'warn' : null);
    const alive = SPECIES.filter((x) => N[x.id] > 0).length;
    ui.readout('alive', `${alive} of ${SPECIES.length}${lost.size ? ` · lost by knock-on effects: ${[...lost].map((id) => BY_ID[id].name).join(', ')}` : ''}`, lost.size ? 'bad' : null);
    sim.setBadge(`${alive} species`);
    removeBtn.textContent = n <= 0 ? `Bring back ${s.name.toLowerCase()}` : `Remove ${s.name.toLowerCase()}`;
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="fw-graph"]')!, {
    x: { min: 0, span: 30, format: (x) => `${x.toFixed(0)} y` },
    y: { min: 0, max: 250, step: 50, format: (v) => `${v}%` },
    refs: [{ value: 100, label: 'Normal', color: 'text-faint' }],
  });
  function drawGraph() {
    graph.opts.x = { min: Math.max(0, year - 30), span: 30, max: Math.max(30, year), format: (x) => `${x.toFixed(0)} y` };
    graph.clear();
    const s = BY_ID[selected];
    const show = [s.id, ...s.eats, ...PREDATORS[s.id]];
    for (const id of show) {
      const sp = BY_ID[id];
      graph.set(id, { label: sp.name, color: LEVEL_COLOUR[sp.level], points: history[id], width: id === selected ? 3.5 : 1.8, dash: id === selected ? undefined : [5, 4] });
    }
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="fw-graph"]'));
  }

  /* ---------- Interaction ---------- */
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - r.left - ox) / k;
    const y = (e.clientY - r.top - oy) / k;
    const hit = SPECIES.find((s) => {
      const [sx, sy] = pos(s);
      return Math.hypot(x - sx, y - sy) < Math.max(26, radius(s.id) + 4);
    });
    if (!hit) return;
    selected = hit.id;
    sim.requestRender();
  });

  const ui = controls(root);
  const removeBtn = root.querySelector<HTMLButtonElement>('[data-remove]')!;
  removeBtn.addEventListener('click', () => {
    if (N[selected] > 0) {
      N[selected] = 0;
      removed.add(selected);
      sim.announce(`${BY_ID[selected].name} removed.`);
    } else {
      N[selected] = 0.3;
      removed.delete(selected);
      lost.delete(selected);
    }
    sim.play();
    sim.requestRender();
  });
  root.querySelector('[data-halve]')!.addEventListener('click', () => {
    if (N[selected] > 0) N[selected] *= 0.5;
    sim.play();
    sim.requestRender();
  });
  root.querySelector('[data-boost]')!.addEventListener('click', () => {
    if (N[selected] > 0) N[selected] = Math.min(4, N[selected] * 2);
    sim.play();
    sim.requestRender();
  });

  restart();
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      selected = 'wolf';
      restart();
    },
  });
}
