/**
 * Flower reproduction, in three views:
 *   3d        – a 3D flower to rotate, cut in half and click (Three.js, loaded on demand)
 *   pollinate – a pollination experiment with two plants of one species and one
 *               plant of another species. Pollen is moved by hand, by a bee or by
 *               the wind. Cross-pollen grows a tube to an ovule; self-pollen is
 *               stopped in the style when the plants are self-incompatible;
 *               pollen of another species does not germinate.
 *   fertilise – step by step from pollination to fruit: germination, pollen
 *               tube growth, sperm delivery, double fertilisation, seed and fruit,
 *               with a long section of the pistil and a magnified close-up.
 */
import type * as T from 'three';
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { FLOWERS, PARTS, PART_ORDER, STAGES, type PartId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = '3d' | 'pollinate' | 'fertilise';
type Method = 'hand' | 'insect' | 'wind';
type Pt = [number, number];
type Outcome = 'cross' | 'self' | 'foreign';

const N_COL = '#4dabf7'; // haploid
const D_COL = '#f08c00'; // diploid
const T_COL = '#9775fa'; // triploid
const CARPEL = '#a9e34b';
const CARPEL_D = '#5c940d';
const CAVITY = '#f4fce3';
const OVULE = '#fff3bf';
const OVULE_D = '#e8b04b';
const TUBE = '#e0a800';
const STEM = '#5c940d';

const DEF = { view: '3d' as View, method: 'hand' as Method, selfInc: true, wind: 50, stage: 0, cut: false, labels: false };
const STAGE_LEN = 6.5; // seconds per fertilisation stage when playing
const OV_LOCAL: Pt[] = [[-10, -32], [10, -32], [-10, -15], [10, -15]];
const STIG_Y = -128;
const ANTHERS: Record<'petal' | 'wind', Pt[]> = {
  petal: [[-54, -100], [-36, -116], [36, -116], [54, -100]],
  wind: [[-58, -110], [-44, -94], [44, -94], [58, -110]],
};

interface Grain {
  f: number;
  src: number;
  dx: number;
  prog: number;
  max: number;
  outcome: Outcome;
  rejected: boolean;
  ov: number;
}
interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const ease = (u: number) => u * u * (3 - 2 * u);
function mix(c1: string, c2: string, u: number) {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1);
  const b = p(c2);
  return `#${a.map((v, i) => Math.round(lerp(v, b[i], clamp(u, 0, 1))).toString(16).padStart(2, '0')).join('')}`;
}

export function initFlower(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const pick = root.querySelector<HTMLSelectElement>('[data-pick]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const st = { ...DEF };
  let t = 0;
  let stageT = 0;
  let lastMsg = '';

  /* ======================= Pollination experiment ======================= */
  let grains: Grain[] = [];
  let ovules: boolean[][] = [];
  let claimed: boolean[][] = [];
  let released = 0;
  let caught = 0;
  let visits = 0;
  let transfers = 0;
  type Particle = { x: number; y: number; vx: number; vy: number; src: number; age: number; seed: number; tried: number };
  let particles: Particle[] = [];
  let spawnT = 0;
  const bee = { x: -40, y: 120, tgt: 0, mode: 'fly' as 'fly' | 'visit', timer: 0, done: false, load: [] as number[] };
  function clearPollen() {
    grains = [];
    ovules = FLOWERS.map(() => [false, false, false, false]);
    claimed = FLOWERS.map(() => [false, false, false, false]);
    particles = [];
    released = caught = visits = transfers = 0;
    Object.assign(bee, { x: -40, y: 120, tgt: Math.random() < 0.5 ? 0 : 1, mode: 'fly', timer: 0, done: false, load: [] });
    lastMsg = '';
  }
  clearPollen();

  /** Pollen from flower `src` lands on the stigma of flower `f`. */
  function land(f: number, src: number, n = 1) {
    let first: Grain | null = null;
    for (let k = 0; k < n; k++) {
      if (grains.filter((g) => g.f === f).length >= 22) break;
      const outcome: Outcome = FLOWERS[f].species !== FLOWERS[src].species ? 'foreign' : f === src ? 'self' : 'cross';
      const rejected = outcome === 'self' && st.selfInc;
      const accepted = outcome === 'cross' || (outcome === 'self' && !rejected);
      let ov = -1;
      if (accepted) {
        ov = claimed[f].findIndex((c) => !c);
        if (ov >= 0) claimed[f][ov] = true;
      }
      const max = outcome === 'foreign' ? 0 : rejected ? 0.4 : ov < 0 ? 0.6 : 1;
      const g: Grain = { f, src, dx: (Math.random() * 2 - 1) * 12, prog: 0, max, outcome, rejected, ov };
      grains.push(g);
      first ??= g;
    }
    return first;
  }
  function landMessage(g: Grain | null) {
    if (!g) return 'This stigma is already covered in pollen.';
    const from = FLOWERS[g.src].name;
    const to = FLOWERS[g.f].name;
    if (g.outcome === 'foreign')
      return `Wrong species: pollen from ${from.toLowerCase()} on ${to === 'Another species' ? 'the blue flower' : to}. It is not recognised, so it never germinates. Pollination happened, but fertilisation will not.`;
    if (g.outcome === 'self' && g.rejected)
      return `Self-pollination: ${to} recognises its own pollen. Because it is self-incompatible, the pollen tube stops in the style and no ovule is fertilised.`;
    if (g.ov < 0) return `All four ovules in ${to} already have a pollen tube on the way, so this extra tube stops.`;
    if (g.outcome === 'self')
      return `Self-pollination: ${to} is self-compatible, so its own pollen grows a tube to an ovule. Seeds form, but the offspring are less varied than with cross-pollination.`;
    return `Cross-pollination: pollen from ${from} on ${to}. It is compatible, so it germinates and a pollen tube grows down the style to an ovule.`;
  }

  /* ---------- Pollination layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const polLayout = () =>
    portrait()
      ? { fx: [115, 340, 565], fy: 350, s: 1.15, ground: 560, strip: { x: 10, y: 616, w: 660, h: 374 } }
      : { fx: [170, 500, 830], fy: 272, s: 1, ground: 390, strip: { x: 10, y: 426, w: 980, h: 166 } };
  const stigmaPos = (i: number): Pt => {
    const L = polLayout();
    return [L.fx[i], L.fy + STIG_Y * L.s];
  };
  const antherPos = (i: number, k: number): Pt => {
    const L = polLayout();
    const a = ANTHERS[st.method === 'wind' ? 'wind' : 'petal'][k];
    return [L.fx[i] + a[0] * L.s, L.fy + a[1] * L.s];
  };

  function stepPollinate(dt: number) {
    for (const g of grains) {
      if (g.prog >= g.max) continue;
      g.prog = Math.min(g.max, g.prog + 0.2 * dt);
      if (g.prog >= 1 && g.ov >= 0 && !ovules[g.f][g.ov]) {
        ovules[g.f][g.ov] = true;
        sim.announce(`An ovule of ${FLOWERS[g.f].name} has been fertilised.`);
      }
    }
    if (st.method === 'insect') stepBee(dt);
    if (st.method === 'wind') stepWind(dt);
  }
  function stepBee(dt: number) {
    const L = polLayout();
    const [sx, sy] = stigmaPos(bee.tgt);
    const tx = sx;
    const ty = sy - 20 * L.s;
    if (bee.mode === 'fly') {
      const dx = tx - bee.x;
      const dy = ty - bee.y;
      const d = Math.hypot(dx, dy);
      const v = 240 * dt;
      if (d <= v) {
        bee.x = tx;
        bee.y = ty;
        bee.mode = 'visit';
        bee.timer = 0;
        bee.done = false;
      } else {
        bee.x += (dx / d) * v;
        bee.y += (dy / d) * v + Math.sin(t * 9) * 0.8;
      }
    } else {
      bee.timer += dt;
      bee.x = tx + Math.sin(t * 7) * 4;
      if (bee.timer > 0.5 && !bee.done) {
        bee.done = true;
        visits++;
        let first: Grain | null = null;
        for (const src of bee.load.splice(0, 2)) first ??= land(bee.tgt, src, 1);
        if (Math.random() < 0.3) first ??= land(bee.tgt, bee.tgt, 1); // the bee brushes the flower's own anthers first
        if (first) lastMsg = landMessage(first);
        bee.load.push(bee.tgt, bee.tgt, bee.tgt);
        bee.load = bee.load.slice(-8);
      }
      if (bee.timer > 1.05) {
        // Bees mostly stay faithful to one kind of flower
        const options = [0, 1, 2].filter((i) => i !== bee.tgt);
        const w = options.map((i) => (FLOWERS[i].species === 0 ? 1 : 0.35));
        let r = Math.random() * w.reduce((a, b) => a + b, 0);
        bee.tgt = options.find((_, k) => (r -= w[k]) < 0) ?? options[0];
        bee.mode = 'fly';
      }
    }
  }
  function stepWind(dt: number) {
    const L = polLayout();
    const [W] = box();
    if (st.wind > 3) {
      spawnT += dt * (st.wind / 50);
      while (spawnT > 0.16) {
        spawnT -= 0.16;
        for (let i = 0; i < 3; i++) {
          if (particles.length > 320) break;
          const [ax, ay] = antherPos(i, Math.floor(Math.random() * 4));
          particles.push({ x: ax, y: ay + 6, vx: st.wind * 2.2 * (0.7 + Math.random() * 0.6), vy: (Math.random() - 0.55) * 26, src: i, age: 0, seed: Math.random() * 6, tried: 0 });
          released++;
        }
      }
    }
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += (p.vy + Math.sin(p.age * 4 + p.seed) * 22) * dt;
      for (let f = 0; f < 3; f++) {
        if (p.tried & (1 << f)) continue;
        const [sx, sy] = stigmaPos(f);
        if (Math.abs(p.x - sx) < 26 * L.s && p.y > sy - 28 * L.s && p.y < sy + 30 * L.s) {
          p.tried |= 1 << f;
          if (Math.random() < 0.09) {
            const g = land(f, p.src, 1);
            if (g) {
              caught++;
              lastMsg = landMessage(g);
            }
            p.age = 99;
            break;
          }
        }
      }
    }
    particles = particles.filter((p) => p.age < 8 && p.x < W + 10 && p.y < L.ground);
  }

  /* ======================= Fertilisation sequence ======================= */
  const stageU = () => clamp(stageT / (STAGE_LEN - 1.5), 0, 1);
  function goStage(i: number) {
    st.stage = clamp(i, 0, STAGES.length - 1);
    stageT = 0;
    sim.hideTooltip();
    sim.requestRender();
  }

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === 'pollinate') stepPollinate(dt);
    if (st.view === 'fertilise') {
      stageT += dt;
      if (stageT > STAGE_LEN) {
        if (st.stage < STAGES.length - 1) goStage(st.stage + 1);
        else {
          stageT = STAGE_LEN;
          sim.pause();
        }
      }
    }
  }

  /* ======================= 2D drawing helpers ======================= */
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let K = 1;
  let cur = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  let areas: Area[] = [];
  let dots: Pt[] = [];
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({
      test: (px, py) => {
        const lx = (px - f.x) / f.s;
        const ly = (py - f.y) / f.s;
        return lx >= x && lx <= x + w && ly >= y && ly <= y + h;
      },
      title,
      text,
    });
  }
  const partArea = (id: PartId, x: number, y: number, w: number, h: number) =>
    rect(x, y, w, h, PARTS[id].name, () => `${PARTS[id].group}. ${PARTS[id].job}`);
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  /** Word-wrapped text; lines past maxY are dropped and the last line ends with an ellipsis. */
  function wrap(s: string, x: number, y: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600, maxY = Infinity) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    const lines: string[] = [];
    let line = '';
    for (const w of s.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    const fit = Math.max(1, Math.floor((maxY - y) / lh) + 1);
    if (lines.length > fit) {
      lines.length = fit;
      let last = lines[fit - 1];
      while (last.includes(' ') && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, last.lastIndexOf(' '));
      lines[fit - 1] = `${last}…`;
    }
    for (const l of lines) {
      ctx.fillText(l, x, y);
      y += lh;
    }
    return y;
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
  /** Spiky pollen grain. */
  function grain(x: number, y: number, r: number, color: string) {
    ctx.beginPath();
    const n = Math.max(10, Math.round(r * 1.2));
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 ? r : r * 0.82;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = withAlpha('#7a5a00', 0.6);
    ctx.lineWidth = Math.max(0.6, r * 0.08);
    ctx.stroke();
  }
  /** Draw a polyline up to fraction p of its length; returns the end point. */
  function path(pts: Pt[], p: number, color: string, w: number): Pt {
    const segs = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    let left = segs.reduce((a, b) => a + b, 0) * clamp(p, 0, 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    let end: Pt = pts[0];
    for (let i = 0; i < segs.length && left > 0; i++) {
      const u = Math.min(1, left / segs[i]);
      end = [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)];
      ctx.lineTo(...end);
      left -= segs[i];
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
    return end;
  }
  /** Text in a rounded pill, legible on any background. */
  function pill(s: string, x: number, y: number, align: CanvasTextAlign = 'left', px = 11) {
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
    text(s, x, y, px, pal['sim-text'], align, 700);
    return [x0, x0 + w + 2 * pad];
  }
  /** Label pill with a leader line to the point (tx, ty). */
  function label(s: string, x: number, y: number, tx: number, ty: number, align: CanvasTextAlign = 'left') {
    ctx.font = fs(11, 700);
    const w = ctx.measureText(s).width;
    const pad = 5 / cur;
    const x0 = align === 'left' ? x - pad : align === 'right' ? x - w - pad : x - w / 2 - pad;
    const x1 = x0 + w + 2 * pad;
    const sx = tx < x0 ? x0 : tx > x1 ? x1 : (x0 + x1) / 2;
    ctx.strokeStyle = '#868e96';
    ctx.lineWidth = 1.4 / cur;
    ctx.beginPath();
    ctx.moveTo(sx, y - 4 / cur);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ell(tx, ty, 2.6 / cur, 2.6 / cur, '#868e96');
    pill(s, x, y, align);
  }
  function bee2d(x: number, y: number, s: number, load: number[] = []) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const flap = Math.sin(t * 40) * 0.35;
    ell(-4, -9, 9, 5, withAlpha('#e7f5ff', 0.85), '#a5d8ff', 1, -0.6 + flap);
    ell(5, -9, 9, 5, withAlpha('#e7f5ff', 0.85), '#a5d8ff', 1, 0.6 - flap);
    ell(0, 0, 13, 9, '#fcc419', '#343a40', 1.2);
    ctx.fillStyle = '#343a40';
    ctx.fillRect(-4, -8, 3, 16);
    ctx.fillRect(3, -8, 3, 16);
    ell(13, -1, 5, 5, '#343a40');
    load.slice(-6).forEach((src, i) => grain(-8 + i * 3.5, 9, 2.4, FLOWERS[src].pollen));
    ctx.restore();
  }

  /* ======================= Pollinate view ======================= */
  function drawFlower(i: number) {
    const L = polLayout();
    const cx = L.fx[i];
    const cy = L.fy;
    const s = L.s;
    const F = FLOWERS[i];
    const wind = st.method === 'wind';
    // stem and leaf
    ctx.strokeStyle = STEM;
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, L.ground);
    ctx.stroke();
    ell(cx + 22 * s, (cy + L.ground) / 2 + 30 * s, 24 * s, 8 * s, '#74b816', null, 1, -0.5);
    enter(cx, cy, s);
    if (wind) {
      // grass-like flower: small bracts, long dangling anthers, feathery stigma
      ell(-14, -34, 9, 30, '#94d82d', CARPEL_D, 1, -0.25);
      ell(14, -34, 9, 30, '#94d82d', CARPEL_D, 1, 0.25);
      ANTHERS.wind.forEach(([ax, ay], k) => {
        ctx.strokeStyle = '#c3b091';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(k < 2 ? -8 : 8, -40);
        ctx.quadraticCurveTo(ax * 0.6, ay - 10, ax, ay - 10);
        ctx.stroke();
        const sw = Math.sin(t * 3 + k) * 0.25 * (st.wind / 100);
        ell(ax, ay, 5, 11, F.pollen, '#8d6e00', 1, sw);
      });
      partArea('anther', -70, -125, 140, 45);
    } else {
      ell(-52, -64, 24, 60, withAlpha(F.petal, 0.95), withAlpha('#c2255c', 0.4), 1, -0.6);
      ell(52, -64, 24, 60, withAlpha(F.petal, 0.95), withAlpha('#c2255c', 0.4), 1, 0.6);
      ell(-30, -6, 16, 7, '#74b816', CARPEL_D, 1, 0.5);
      ell(30, -6, 16, 7, '#74b816', CARPEL_D, 1, -0.5);
      partArea('petal', -82, -126, 164, 116);
      ANTHERS.petal.forEach(([ax, ay], k) => {
        ctx.strokeStyle = '#e9ecb0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(k < 2 ? -12 : 12, -12);
        ctx.quadraticCurveTo(ax * 0.5, ay * 0.5, ax, ay + 4);
        ctx.stroke();
        ell(ax, ay, 9, 5.5, F.pollen, '#8d6e00', 1, k < 2 ? -0.4 : 0.4);
      });
      partArea('anther', -64, -126, 34, 34);
      partArea('anther', 30, -126, 34, 34);
    }
    // pistil, cut open
    const fert = ovules[i].filter(Boolean).length;
    const swell = 1 + fert * 0.04;
    ell(0, -24, 26 * swell, 24 * swell, CARPEL, CARPEL_D, 1.5);
    ell(0, -23, 19 * swell, 17 * swell, CAVITY);
    OV_LOCAL.forEach(([ox, oy], k) => ell(ox * swell, oy, 5.5, 7, ovules[i][k] ? '#c08a4a' : OVULE, ovules[i][k] ? '#7a4b1c' : OVULE_D, 1));
    ctx.fillStyle = CARPEL;
    ctx.fillRect(-4, -122, 8, 76);
    ctx.strokeStyle = CARPEL_D;
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, -122, 8, 76);
    if (wind) {
      ctx.strokeStyle = '#d8f5a2';
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -120);
        ctx.lineTo(side * 18, -148);
        for (let j = 0; j < 6; j++) {
          const px = side * (3 + j * 2.6);
          const py = -124 - j * 4;
          ctx.moveTo(px, py);
          ctx.lineTo(px + side * 7, py + 4);
          ctx.moveTo(px, py);
          ctx.lineTo(px - side * 5, py - 6);
        }
        ctx.stroke();
      }
    } else ell(0, STIG_Y, 16, 7, '#d8f5a2', CARPEL_D, 1.2);
    partArea('ovary', -26, -48, 52, 48);
    partArea('style', -8, -120, 16, 70);
    partArea('stigma', -24, -152, 48, 30);
    // pollen grains and tubes
    for (const g of grains.filter((q) => q.f === i)) {
      const gx = g.dx;
      const gy = STIG_Y - 3;
      if (g.prog > 0) {
        const tgt: Pt = g.ov >= 0 ? [OV_LOCAL[g.ov][0] * swell, OV_LOCAL[g.ov][1] - 7] : [0, -36];
        const end = path([[gx, gy], [gx * 0.3, -116], [0, -60], [tgt[0] * 0.6, -48], tgt], g.prog, withAlpha(TUBE, 0.85), 1.6);
        if (g.rejected && g.prog >= g.max) {
          ctx.strokeStyle = '#e03131';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(end[0] - 3, end[1] - 3);
          ctx.lineTo(end[0] + 3, end[1] + 3);
          ctx.moveTo(end[0] + 3, end[1] - 3);
          ctx.lineTo(end[0] - 3, end[1] + 3);
          ctx.stroke();
        }
      }
      grain(gx, gy, 3.6, FLOWERS[g.src].pollen);
      if (g.outcome === 'foreign') {
        ctx.strokeStyle = '#e03131';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    leave();
    text(F.name, cx, L.ground + 22, 12.5, pal['sim-text'], 'center', 750);
  }

  function drawPollinate() {
    const L = polLayout();
    const [W] = box();
    // ground
    ctx.fillStyle = withAlpha('#8d6e63', 0.35);
    ctx.fillRect(0, L.ground, W, 6);
    if (st.method === 'wind') {
      ctx.strokeStyle = withAlpha(pal['text-muted'], 0.35);
      ctx.lineWidth = 1.5 / cur;
      for (let j = 0; j < 4; j++) {
        const y = 40 + j * 46 + (portrait() ? 30 : 0);
        const x0 = ((t * st.wind * 1.5 + j * 230) % (W + 200)) - 160;
        if (st.wind > 3) {
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.bezierCurveTo(x0 + 40, y - 8, x0 + 80, y + 8, x0 + 120, y);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 3; i++) drawFlower(i);
    for (const p of particles) grain(p.x, p.y, 2.6, FLOWERS[p.src].pollen);
    if (st.method === 'insect') bee2d(bee.x, bee.y, 1.1 * L.s, bee.load);
    if (drag) {
      for (let k = 0; k < 3; k++) grain(drag.x + (k - 1) * 6, drag.y + (k % 2) * 5, 4.5, FLOWERS[drag.src].pollen);
      text('Drop on a stigma', drag.x, drag.y - 16, 11, pal['sim-text'], 'center', 700);
    }
    if (st.method === 'hand' && !grains.length && !drag) {
      const [ax, ay] = antherPos(0, 1);
      const [sx, sy] = stigmaPos(1);
      ctx.setLineDash([5 / cur, 5 / cur]);
      ctx.strokeStyle = withAlpha(pal.accent, 0.8);
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      ctx.moveTo(ax, ay - 8);
      ctx.quadraticCurveTo((ax + sx) / 2, Math.min(ay, sy) - 70, sx, sy - 10);
      ctx.stroke();
      ctx.setLineDash([]);
      const hint = 'Drag pollen from an anther to a stigma';
      ctx.font = fs(12, 750);
      const hw = ctx.measureText(hint).width / 2 + 10;
      text(hint, clamp((ax + sx) / 2, hw, W - hw), Math.min(ay, sy) - 52, 12, pal.accent, 'center', 750);
    }
    drawResults(L.strip);
  }

  function drawResults(P: { x: number; y: number; w: number; h: number }) {
    panel(P.x, P.y, P.w, P.h);
    const wide = !portrait();
    const lh = 16 / cur;
    for (let i = 0; i < 3; i++) {
      const F = FLOWERS[i];
      const gs = grains.filter((g) => g.f === i);
      const n = (o: Outcome) => gs.filter((g) => g.outcome === o).length;
      const fert = ovules[i].filter(Boolean).length;
      const x = wide ? P.x + 16 + i * (P.w / 3) : P.x + 16;
      const y = wide ? P.y + 24 : P.y + 26 + i * (P.h / 3);
      const px = 1 / cur;
      ell(x + 6 * px, y - 4 * px, 6 * px, 6 * px, F.petal);
      text(`${F.name}`, x + 17 * px, y, 12.5, pal['sim-text'], 'left', 750);
      ctx.font = fs(12.5, 750);
      const nw = ctx.measureText(F.name).width;
      grain(x + nw + 28 * px, y - 4 * px, 5 * px, F.pollen);
      text(`${F.pollenName} pollen`, x + nw + 38 * px, y, 11, pal['text-muted'], 'left', 650);
      const colW = (wide ? P.w / 3 : P.w) - 24;
      const a = `Pollen: ${n('cross')} cross · ${n('self')} self`;
      const b = `${n('foreign')} other species`;
      ctx.font = fs(11, 600);
      const one = ctx.measureText(`${a} · ${b}`).width <= colW;
      let ly = y + lh * 1.3;
      text(one ? `${a} · ${b}` : a, x, ly, 11, pal['text-muted'], 'left', 600);
      if (!one) {
        ly += lh;
        text(`Other species: ${n('foreign')}`, x, ly, 11, pal['text-muted'], 'left', 600);
      }
      ly += lh * (wide ? 1.2 : 1.1);
      text('Ovules fertilised:', x, ly, 11, pal['text-muted'], 'left', 600);
      ctx.font = fs(11, 600);
      const ow = ctx.measureText('Ovules fertilised:').width;
      for (let k = 0; k < 4; k++) ell(x + ow + 12 / cur + k * 14 / cur, ly - 4 / cur, 5 / cur, 6 / cur, ovules[i][k] ? '#c08a4a' : OVULE, ovules[i][k] ? '#7a4b1c' : OVULE_D, 1 / cur);
      const status = fert ? [`✓ ${fert} seed${fert > 1 ? 's' : ''} will form`, pal.success] : gs.length ? ['Pollinated, not fertilised', pal.danger] : ['No pollen yet', pal['text-faint']];
      if (wide) text(status[0], x, ly + lh * 1.25, 11.5, status[1], 'left', 750);
      else text(status[0], x + ow + 76 * px, ly, 11.5, status[1], 'left', 750);
    }
  }

  /* ======================= Fertilise view ======================= */
  const ferLayout = () =>
    portrait()
      ? { mag: { x: 10, y: 100, w: 660, h: 446 }, pis: { x: 10, y: 556, w: 250, h: 434 }, strip: { x: 270, y: 556, w: 400, h: 434 } }
      : { pis: { x: 10, y: 16, w: 380, h: 570 }, mag: { x: 402, y: 70, w: 588, h: 362 }, strip: { x: 402, y: 442, w: 588, h: 146 } };

  /** Long section of a flower (local 300 × 560). */
  function drawPistil(stage: number, u: number) {
    const fruitU = stage === 6 ? ease(u) : 0;
    const seedU = stage === 5 ? ease(u) : stage > 5 ? 1 : 0;
    const fall = fruitU * 140;
    // petals and stamens (behind), falling as the fruit forms
    ctx.globalAlpha = 1 - fruitU;
    ell(52, 420 + fall, 36, 108, '#f783ac', '#c2255c', 1, -0.42);
    ell(248, 420 + fall, 36, 108, '#f783ac', '#c2255c', 1, 0.42);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#e9ecb0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(150 + side * 50, 535 + fall * 0.5);
      ctx.quadraticCurveTo(150 + side * 108, 420 + fall, 150 + side * 104, 268 + fall);
      ctx.stroke();
      ell(150 + side * 104, 252 + fall, 12, 22, '#fcc419', '#8d6e00', 1.2);
    }
    ctx.globalAlpha = 1;
    if (fruitU < 1) {
      partArea('petal', 10, 320, 50, 180);
      partArea('anther', 30, 225, 40, 55);
      partArea('anther', 230, 225, 40, 55);
    }
    // receptacle and sepals
    ell(150, 548, 74, 14, '#74b816', CARPEL_D, 1.2);
    ell(84, 538, 30, 9, '#74b816', CARPEL_D, 1, 0.35);
    ell(216, 538, 30, 9, '#74b816', CARPEL_D, 1, -0.35);
    // ovary → fruit
    const orx = 118 + 24 * fruitU;
    const ory = 98 + 18 * fruitU;
    ell(150, 440, orx, ory, mix(CARPEL, '#f76707', fruitU), mix(CARPEL_D, '#c92a2a', fruitU), 2);
    ell(150, 444, orx - 16, ory - 16, mix(CAVITY, '#ffe8cc', fruitU));
    partArea('ovary', 40, 350, 220, 180);
    // style and stigma (wither in the fruit stage)
    ctx.globalAlpha = 1 - 0.7 * fruitU;
    const sc = mix(CARPEL, '#a07850', fruitU);
    ctx.fillStyle = sc;
    ctx.fillRect(132, 62, 36, 288);
    ctx.fillStyle = mix('#d8f5a2', '#c9a77c', fruitU);
    ctx.fillRect(145, 62, 10, 288);
    ctx.strokeStyle = CARPEL_D;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(132, 62, 36, 288);
    ell(116, 50, 40, 18, mix('#c0eb75', '#a07850', fruitU), CARPEL_D, 1.2);
    ell(184, 50, 40, 18, mix('#c0eb75', '#a07850', fruitU), CARPEL_D, 1.2);
    for (let j = 0; j < 14; j++) ell(82 + j * 10.5, 36 - Math.sin((j / 13) * Math.PI) * 10, 4, 4, mix('#d8f5a2', '#a07850', fruitU));
    ctx.globalAlpha = 1;
    partArea('style', 128, 70, 44, 270);
    partArea('stigma', 76, 22, 148, 46);
    // ovules → seeds
    const OV: Pt[] = [[88, 448], [150, 476], [212, 448]];
    OV.forEach(([ox, oy]) => {
      const rx = 22 + 8 * seedU;
      const ry = 30 + 6 * seedU;
      ctx.strokeStyle = mix(OVULE_D, '#7a4b1c', seedU);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy + ry);
      ctx.lineTo(150, 528);
      ctx.stroke();
      ell(ox, oy, rx, ry, mix(OVULE, '#c08a4a', seedU), mix(OVULE_D, '#7a4b1c', seedU), 2);
      ell(ox, oy + 2, rx * 0.55, ry * 0.62, mix('#e7f5ff', '#ead7b5', seedU));
      ctx.fillStyle = mix(CAVITY, '#ffe8cc', fruitU);
      ctx.fillRect(ox - 3, oy - ry - 2, 6, 7); // micropyle
      if (stage >= 4) ell(ox, oy - ry * 0.35, 4 + 6 * seedU, 4 + 8 * seedU, D_COL);
    });
    partArea('ovule', 60, 410, 180, 110);
    // pollen grains and tubes
    const prog = [0, 0.07 * u, 0.07 + 0.8 * u, 0.87 + 0.13 * u, 1, 1, 1][stage];
    const other = [0, 0.05 * u, 0.05 + 0.62 * u, 0.67 + 0.33 * u, 1, 1, 1][stage];
    const tubeA = stage <= 4 ? 1 : stage === 5 ? 1 - u : 0;
    if (tubeA > 0) {
      ctx.globalAlpha = tubeA;
      path([[116, 32], [146, 66], [146, 350], [118, 392], [88, 416]], other, withAlpha(TUBE, 0.55), 3);
      path([[186, 34], [154, 66], [154, 350], [182, 392], [212, 416]], other, withAlpha(TUBE, 0.55), 3);
      const end = path([[150, 34], [150, 66], [150, 350], [150, 410], [150, 444]], prog, TUBE, 4);
      if (prog > 0.05 && stage <= 3) {
        ell(end[0], end[1] - 8, 2.6, 4, N_COL);
        ell(end[0], end[1] - 16, 2.6, 4, N_COL);
      }
      ctx.globalAlpha = 1;
    }
    if (fruitU < 1) {
      ctx.globalAlpha = 1 - fruitU;
      grain(116, 32, 8, '#f2c94c');
      grain(186, 34, 8, '#f2c94c');
      ctx.globalAlpha = 1;
    }
    // the bee and the main grain in stage 1
    if (stage === 0) {
      const bx = lerp(-30, 150, ease(Math.min(1, u / 0.55))) + (u > 0.55 ? (u - 0.55) * 300 : 0);
      const gy = u < 0.55 ? 26 : lerp(26, 34, ease((u - 0.55) / 0.45));
      grain(u < 0.55 ? bx : 150, gy, 9, '#f2c94c');
      bee2d(bx, u > 0.55 ? 12 - (u - 0.55) * 40 : 12, 1.1);
    } else if (fruitU < 1) {
      ctx.globalAlpha = 1 - fruitU;
      grain(150, 34, 9, '#f2c94c');
      ctx.globalAlpha = 1;
    }
    // labels
    if (stage < 6) {
      label('Stigma', 296, 96, 214, 58, 'right');
      label('Style', 184, 210, 168, 200, 'left');
      label(stage >= 5 ? 'Seeds' : 'Ovules', 296, 526, 222, 474, 'right');
      label('Ovary', 6, 320, 62, 384, 'left');
    } else {
      label('Fruit (ovary)', 296, 330, 252, 384, 'right');
      label('Seeds', 296, 526, 222, 474, 'right');
    }
  }

  /**
   * Magnified close-up for each stage. Local box 560 × 400: the drawing sits in
   * the middle 400 (shifted right by MX) and labels go in pills at the sides.
   */
  const MX = 80;
  type Lab = [string, number, number, number, number, CanvasTextAlign];
  let labs: Lab[] = [];
  /** Queue a label: (x, y) in box coordinates, target (tx, ty) in drawing coordinates. */
  const lab = (s: string, x: number, y: number, tx: number, ty: number, align: CanvasTextAlign) => labs.push([s, x, y, tx + MX, ty, align]);
  const L = (s: string, y: number, tx: number, ty: number) => lab(s, 8, y, tx, ty, 'left');
  const R = (s: string, y: number, tx: number, ty: number) => lab(s, 552, y, tx, ty, 'right');

  function drawMag(stage: number, u: number) {
    labs = [];
    const id = STAGES[stage].id;
    let title = '';
    if (id === 'land' || id === 'germinate') {
      // stigma surface (full width)
      ctx.fillStyle = '#c0eb75';
      ctx.fillRect(0, 252, 560, 148);
      for (let j = 0; j < 13; j++) ell(22 + j * 45, 252, 22, 18, '#d8f5a2', CARPEL_D, 1);
    }
    ctx.save();
    ctx.translate(MX, 0);
    if (id === 'land' || id === 'germinate') title = drawPollen(id, u);
    else if (id === 'tube') title = drawTube();
    else if (id === 'enter' || id === 'double') title = drawOvule(id === 'enter' ? u : 1, id === 'double' ? u : 0);
    else if (id === 'seed') title = drawSeed(u);
    else title = drawFruit(u);
    ctx.restore();
    for (const l of labs) label(...l);
    pill(title, 280, 26, 'center', 12);
  }

  function drawPollen(id: 'land' | 'germinate', u: number) {
    const gy = id === 'land' ? lerp(110, 168, ease(u)) : 168;
    const r = 76;
    let tipY = 0;
    if (id === 'germinate') {
      tipY = gy + r - 6 + 150 * ease(u);
      ctx.fillStyle = '#fff3bf';
      ctx.strokeStyle = TUBE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(186, gy + r - 14, 28, tipY - (gy + r - 14), 14);
      ctx.fill();
      ctx.stroke();
    }
    grain(200, gy, r, '#f2c94c');
    ell(200, gy, r * 0.74, r * 0.74, '#fff3bf');
    const tnY = id === 'germinate' ? lerp(gy + 8, tipY - 18, ease(clamp(u / 0.8, 0, 1))) : gy + 8;
    const tnX = id === 'germinate' ? lerp(176, 200, ease(u)) : 176;
    ell(tnX, tnY, 16, 16, N_COL);
    // generative cell → two sperm cells
    const split = id === 'germinate' ? clamp((u - 0.25) / 0.3, 0, 1) : 0;
    const move = id === 'germinate' ? ease(clamp((u - 0.5) / 0.5, 0, 1)) : 0;
    let sp: Pt = [226, gy - 18];
    if (split < 1) {
      ell(226, gy - 18, 26 - 6 * split, 15, withAlpha(N_COL, 0.25), N_COL, 2);
      ell(226 - 6 * split, gy - 18, 6, 6, N_COL);
      if (split > 0) ell(226 + 6 * split, gy - 18, 6, 6, N_COL);
    } else {
      for (const k of [0, 1]) {
        const sx = lerp(214 + k * 24, 196 + k * 8, move);
        const sy = lerp(gy - 18, tipY - 44 - k * 22, move);
        ell(sx, sy, 10, 7, withAlpha(N_COL, 0.3), N_COL, 1.5);
        ell(sx, sy, 4, 4, N_COL);
        if (k === 1) sp = [sx + 8, sy];
      }
    }
    L('Tube nucleus (n)', 92, tnX - 14, tnY - 6);
    R(split < 1 ? 'Generative cell (n)' : 'Two sperm cells (n)', 92, sp[0] + 10, sp[1]);
    if (id === 'germinate') R('Pollen tube', 330, 214, Math.min(tipY - 10, 320));
    L('Stigma', 382, 40, 300);
    return 'Pollen grain: a male gametophyte, not a sperm';
  }

  function drawTube() {
    const off = (t * 26) % 30;
    for (let row = -1; row < 15; row++)
      for (let col = -2; col < 11; col++) {
        const x = col * 48 + (row % 2 ? 24 : 0) - 20;
        const y = row * 30 - off;
        ctx.fillStyle = '#e9fac8';
        ctx.strokeStyle = '#b2d97a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, 44, 26, 8);
        ctx.fill();
        ctx.stroke();
      }
    // chemical guidance signals rising from the ovule
    for (let j = 0; j < 14; j++) {
      const yy = 400 - ((t * 40 + j * 29) % 140);
      ell(200 + Math.sin(j * 2.3 + t) * 34, yy, 3, 3, withAlpha('#e64980', 0.8));
    }
    const tip = 270;
    ctx.fillStyle = '#fff3bf';
    ctx.strokeStyle = TUBE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(186, -10, 28, tip + 10, 14);
    ctx.fill();
    ctx.stroke();
    ell(200, tip - 22, 10, 10, N_COL);
    for (const k of [0, 1]) {
      ell(200, tip - 58 - k * 28, 10, 7, withAlpha(N_COL, 0.3), N_COL, 1.5);
      ell(200, tip - 58 - k * 28, 4, 4, N_COL);
    }
    L('Pollen tube', 110, 186, 120);
    R('Two sperm cells (n)', 180, 212, tip - 70);
    R('Tube nucleus', 250, 212, tip - 22);
    L('Signals from the ovule', 372, 172, 360);
    return 'Inside the style';
  }

  /** Ovule with its embryo sac: e = tube entry progress, f = fusion progress. */
  function drawOvule(e: number, f: number) {
    for (const [rx, ry, c] of [[150, 176, OVULE], [134, 160, '#fff9db']] as [number, number, string][]) {
      ctx.fillStyle = c;
      ctx.strokeStyle = OVULE_D;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(200, 222, rx, ry, 0, -Math.PI / 2 + 0.1, (3 * Math.PI) / 2 - 0.1);
      ctx.fill();
      ctx.stroke();
    }
    ell(200, 232, 92, 120, '#e7f5ff', N_COL, 2); // embryo sac = central cell
    const burst = clamp((e - 0.45) / 0.15, 0, 1);
    const go = ease(clamp((e - 0.55) / 0.45, 0, 1));
    ell(172, 130, 17, 19, withAlpha('#d0ebff', 1 - burst * 0.75), withAlpha(N_COL, 1 - burst * 0.6), 1.5);
    ell(228, 130, 17, 19, '#d0ebff', N_COL, 1.5);
    ell(200, 156, 24, 22, mix('#a5d8ff', '#ffd8a8', f), mix(N_COL, D_COL, f), 1.5);
    ell(200, 158, 8 + 3 * f, 8 + 3 * f, mix(N_COL, D_COL, f));
    const pm = ease(f);
    if (f < 1) {
      ell(lerp(184, 200, pm), 236, 8, 8, N_COL);
      ell(lerp(216, 200, pm), 236, 8, 8, N_COL);
    }
    if (f > 0) ell(200, 236, 6 + 7 * pm, 6 + 7 * pm, mix(N_COL, T_COL, pm));
    ctx.globalAlpha = 1 - 0.6 * f;
    for (const [x, y] of [[180, 332], [200, 342], [220, 332]]) ell(x, y, 12, 11, '#d0ebff', N_COL, 1.2);
    ctx.globalAlpha = 1;
    const tubeP = ease(clamp(e / 0.45, 0, 1));
    if (tubeP > 0) path([[200, -10], [200, 50], [186, 100], [174, 124]], tubeP, TUBE, 7);
    if (e > 0 && f < 0.6) {
      const s1: Pt = burst < 1 ? [lerp(200, 176, tubeP), lerp(-4, 118, tubeP)] : [lerp(176, 200, go), lerp(122, 156, go)];
      const s2: Pt = burst < 1 ? [lerp(200, 178, tubeP), lerp(-20, 106, tubeP)] : [lerp(176, 200, go), lerp(132, 236, go)];
      for (const [x, y] of [s1, s2]) ell(x, y, 5, 3.5, N_COL, '#1864ab', 1);
    }
    L('Micropyle', 52, 192, 50);
    L('Synergids', 112, 158, 124);
    if (e > 0.55 && f === 0) L('Two sperm released', 200, 184, 150);
    L('Antipodal cells', 360, 170, 336);
    R('Integuments', 64, 320, 112);
    if (f < 0.5) {
      R('Egg cell (n)', 158, 222, 156);
      R('Central cell, 2 polar nuclei', 262, 214, 236);
    } else {
      R('Zygote (2n)', 158, 222, 156);
      R('Endosperm nucleus (3n)', 262, 214, 236);
    }
    return f > 0 ? 'Double fertilisation' : 'Inside an ovule';
  }

  function drawSeed(u: number) {
    const g = ease(u);
    ell(200, 216, 158, 178, mix(OVULE, '#b07b3f', g), mix(OVULE_D, '#6b3f12', g), 3 + 6 * g);
    ell(200, 222, 140, 160, mix('#e7f5ff', '#efe6ff', g));
    const n = Math.round(80 * g);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const r = 14 * Math.sqrt(i + 1);
      const x = 200 + Math.cos(a) * r * 0.85;
      const y = 236 + Math.sin(a) * r;
      if (((x - 200) / 132) ** 2 + ((y - 222) / 150) ** 2 < 1) ell(x, y, 6, 6, withAlpha(T_COL, 0.35), withAlpha(T_COL, 0.7), 1);
    }
    if (u < 0.35) {
      const k = 1 + Math.floor((u / 0.35) * 7);
      for (let i = 0; i < k; i++) ell(200 + Math.cos(i * 2.4) * 6 * Math.sqrt(i), 120 + Math.sin(i * 2.4) * 6 * Math.sqrt(i), 6, 6, D_COL, '#a64d00', 1);
      L('Embryo (2n)', 110, 190, 120);
    } else {
      const v = ease((u - 0.35) / 0.65);
      ctx.fillStyle = D_COL;
      ctx.strokeStyle = '#a64d00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(192, 88, 16, 40 + 40 * v, 8);
      ctx.fill();
      ctx.stroke();
      ell(184 - 10 * v, 140 + 46 * v, 12 + 8 * v, 26 + 40 * v, D_COL, '#a64d00', 1.5, 0.15);
      ell(216 + 10 * v, 140 + 46 * v, 12 + 8 * v, 26 + 40 * v, D_COL, '#a64d00', 1.5, -0.15);
      L('Embryo root (radicle)', 70, 192, 96);
      L('Seed leaves (cotyledons)', 230, 168, 200);
    }
    R('Seed coat', 80, 330, 100);
    R('Endosperm (3n): food store', 360, 262, 320);
    return 'Ovule becoming a seed';
  }

  function drawFruit(u: number) {
    const g = ease(u);
    const r = 140 + 26 * g;
    ell(200, 220, r, r * 0.95, mix('#c0eb75', '#ff8787', g), mix(CARPEL_D, '#c92a2a', g), 7);
    ell(200, 222, r - 26, r * 0.95 - 26, mix(CAVITY, '#ffe3e3', g));
    for (let j = 0; j < 5; j++) ell(200 + (j - 2) * 15, 220 - r * 0.95 - 4, 7, 13, '#74b816', CARPEL_D, 1, (j - 2) * 0.4);
    const S: Pt[] = [[136, 196], [264, 196], [200, 300], [200, 140]];
    for (const [x, y] of S) {
      ell(x, y, 26, 34, '#c08a4a', '#7a4b1c', 3);
      ell(x, y - 6, 9, 13, D_COL);
    }
    L('Old sepals', 52, 172, 66);
    L('Seeds (from the ovules)', 300, 136, 230);
    R('Fruit wall (from the ovary wall)', 382, 300, 340);
    return 'Ovary becoming a fruit (cut open)';
  }

  function drawFertilise() {
    const L = ferLayout();
    const u = stageU();
    const S = STAGES[st.stage];
    // pistil long section
    panel(L.pis.x, L.pis.y, L.pis.w, L.pis.h);
    const ps = Math.min((L.pis.w - 20) / 300, (L.pis.h - 20) / 560);
    enter(L.pis.x + (L.pis.w - 300 * ps) / 2, L.pis.y + (L.pis.h - 560 * ps) / 2, ps);
    drawPistil(st.stage, u);
    leave();
    // magnified view
    panel(L.mag.x, L.mag.y, L.mag.w, L.mag.h, pal['surface-2']);
    const ms = Math.min((L.mag.w - 16) / 560, (L.mag.h - 16) / 400);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(L.mag.x, L.mag.y, L.mag.w, L.mag.h, 10);
    ctx.clip();
    enter(L.mag.x + (L.mag.w - 560 * ms) / 2, L.mag.y + (L.mag.h - 400 * ms) / 2, ms);
    drawMag(st.stage, u);
    leave();
    ctx.restore();
    text('🔍 Magnified', L.mag.x + 12, L.mag.y - 10, 12, pal['text-muted'], 'left', 750);
    // strip: stage dots, title and the pollination → fertilisation timeline
    const P = L.strip;
    panel(P.x, P.y, P.w, P.h);
    dots = [];
    const gap = Math.min(64, (P.w - 90) / (STAGES.length - 1));
    const x0 = P.x + (P.w - gap * (STAGES.length - 1)) / 2;
    const dy = P.y + 26;
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / cur;
    ctx.beginPath();
    ctx.moveTo(x0, dy);
    ctx.lineTo(x0 + gap * (STAGES.length - 1), dy);
    ctx.stroke();
    STAGES.forEach((_, i) => {
      const x = x0 + i * gap;
      dots.push([x, dy]);
      const curr = i === st.stage;
      ell(x, dy, curr ? 15 : 12, curr ? 15 : 12, i <= st.stage ? pal.accent : pal['bg-elev'], pal.accent, 2 / cur);
      text(String(i + 1), x, dy + 4.5 / cur, 12, i <= st.stage ? '#ffffff' : pal['sim-text'], 'center', 800);
    });
    const ty = dy + 22 + 22 / cur;
    text(`${st.stage + 1}. ${S.name}`, P.x + 16, ty, 15, pal['sim-text'], 'left', 800);
    // timeline bar
    const segs: [string, number, number][] = [['Pollination', 0, 0], ['Germination and tube growth', 1, 3], ['Fertilisation', 4, 4], ['Seed and fruit', 5, 6]];
    const by = ty + 12 / cur;
    const bh = 18 / cur + 6;
    const bw = P.w - 32;
    let bx = P.x + 16;
    const widths = [0.17, 0.38, 0.2, 0.25];
    // Short names inside the bar when they all fit; otherwise the current phase is named under it
    ctx.font = fs(10.5, 750);
    const short = ['Pollination', 'Tube growth', 'Fertilisation', 'Seed and fruit'];
    const inBar = short.every((nm, k) => ctx.measureText(nm).width <= bw * widths[k] - 10 / cur);
    let current = '';
    segs.forEach(([name, a, b], k) => {
      const w = bw * widths[k];
      const on = st.stage >= a && st.stage <= b;
      if (on) current = name;
      ctx.fillStyle = on ? pal.accent : withAlpha(pal['text-faint'], 0.25);
      ctx.beginPath();
      ctx.roundRect(bx + 1, by, w - 2, bh, 6);
      ctx.fill();
      if (inBar) text(short[k], bx + w / 2, by + bh / 2 + 4 / cur, 10.5, on ? '#ffffff' : pal['text-muted'], 'center', 750);
      bx += w;
    });
    let wy = by + bh + 18 / cur;
    if (!inBar) {
      text(current, P.x + 16, wy, 11.5, pal.accent, 'left', 800);
      wy += 18 / cur;
    }
    text(`Where: ${S.where}`, P.x + 16, wy, 11.5, pal['text-muted'], 'left', 650);
    if (portrait()) wrap(S.text, P.x + 16, wy + 22 / cur, P.w - 32, 11.5, pal['text-muted'], 600, P.y + P.h - 12);
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    areas = [];
    if (st.view === '3d') {
      updateUi();
      return;
    }
    const { k, ox, oy } = tf();
    K = k;
    cur = k;
    frame = { x: 0, y: 0, s: 1 };
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    if (st.view === 'pollinate') drawPollinate();
    else drawFertilise();
    ctx.restore();
    updateUi();
  }

  /* ======================= Readouts and note ======================= */
  const explored = new Set<PartId>();
  let selected: PartId | null = null;
  function updateUi() {
    const r = (name: string, lab: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== lab) dt.textContent = lab;
    };
    let note = '';
    if (st.view === '3d') {
      const p = selected ? PARTS[selected] : null;
      r('r1', 'Selected part', p ? p.name : 'None');
      r('r2', 'Belongs to', p ? p.group : '—');
      r('r3', 'After fertilisation', p ? p.after : '—');
      r('r4', 'Parts explored', `${explored.size} of ${PART_ORDER.length}`, explored.size === PART_ORDER.length ? 'ok' : null);
      r('r5', 'Male part (stamen)', 'Anther + filament');
      r('r6', 'Female part (carpel)', 'Stigma + style + ovary');
      note = p
        ? `${p.name} (${p.group}). ${p.job} After fertilisation: ${p.after.toLowerCase()}.`
        : threeFailed
          ? '3D graphics are not available in this browser. The Pollination and Fertilisation views still work.'
          : 'Rotate the flower and tap any part, or choose one from the list. Turn on “Cut the flower in half” to see the ovules inside the ovary. Start spins the flower.';
      sim.setBadge(`Explored ${explored.size}/${PART_ORDER.length}`);
    } else if (st.view === 'pollinate') {
      const n = (o: Outcome) => grains.filter((g) => g.outcome === o).length;
      const fert = ovules.flat().filter(Boolean).length;
      const rej = grains.filter((g) => g.rejected).length;
      r('r1', 'Pollinated by', st.method === 'hand' ? 'Hand (you)' : st.method === 'insect' ? 'A bee' : 'Wind');
      r('r2', 'Pollen on stigmas', `${n('cross')} cross · ${n('self')} self`);
      r('r3', 'Other-species pollen', `${n('foreign')} (never germinates)`, n('foreign') ? 'bad' : null);
      r('r4', 'Self pollen rejected', st.selfInc ? String(rej) : 'None (self-compatible)', rej && st.selfInc ? 'warn' : null);
      r('r5', 'Ovules fertilised', `${fert} of 12`, fert ? 'ok' : null);
      if (st.method === 'wind') {
        const pct = released ? (caught / released) * 100 : 0;
        r('r6', 'Wind pollen that hit a stigma', `${caught} of ${released} (${pct.toFixed(pct < 10 ? 1 : 0)}%)`);
      } else if (st.method === 'insect') r('r6', 'Bee visits', String(visits));
      else r('r6', 'Pollen transfers', String(transfers));
      note =
        lastMsg ||
        (st.method === 'hand'
          ? 'Drag pollen from an anther (the coloured tips of the stamens) onto a stigma. Try the same flower (self-pollination), the other plant (cross-pollination), and the blue flower of another species.'
          : st.method === 'insect'
            ? 'A bee visits the flowers for nectar. Pollen sticks to its hairy body and rubs off on the next stigma it touches. Bees mostly stay with one kind of flower.'
            : 'Wind-pollinated flowers have no showy petals, dangling anthers and feathery stigmas. They release huge amounts of light pollen, but only a tiny fraction lands on a stigma.');
      sim.setBadge(`Seeds ${fert}/12`);
      canvas.setAttribute('aria-label', `Pollination experiment. ${n('cross')} cross-pollen grains, ${n('self')} self-pollen grains and ${n('foreign')} grains of another species on the stigmas. ${fert} of 12 ovules fertilised.`);
    } else {
      const S = STAGES[st.stage];
      const done = st.stage >= 4;
      r('r1', 'Stage', `${st.stage + 1} of ${STAGES.length}: ${S.name}`);
      r('r2', 'Where', S.where);
      r('r3', 'Phase', S.phase, st.stage === 0 ? 'warn' : st.stage === 4 ? 'ok' : null);
      r('r4', 'Zygote', done ? 'Sperm + egg → 2n' : 'Not yet');
      r('r5', 'Endosperm', done ? 'Sperm + 2 polar nuclei → 3n' : 'Not yet');
      r('r6', 'Becomes', st.stage < 5 ? 'Ovule → seed; ovary → fruit (later)' : st.stage === 5 ? 'Ovule → seed' : 'Ovary → fruit');
      note = `${S.name}: ${S.text}`;
      sim.setBadge(`Stage ${st.stage + 1}/${STAGES.length}`);
      canvas.setAttribute('aria-label', `Fertilisation, stage ${st.stage + 1} of ${STAGES.length}: ${S.name}, in the ${S.where.toLowerCase()}.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= 3D flower ======================= */
  let three: ThreeScene | null = null;
  let threeFailed = false;
  let loading3D = false;
  let positionLabels = () => {};
  let highlight = () => {};
  let applyCut = () => {};
  let flowerGroup: T.Group | null = null;

  async function ensure3D() {
    if (three || threeFailed || loading3D) return;
    loading3D = true;
    sim.setLoading('Loading the 3D flower…');
    try {
      // Pull the camera back on tall (phone) screens so the whole flower fits
      const asp = container.clientWidth / Math.max(1, container.clientHeight);
      const back = clamp(Math.pow(asp, -0.6), 1, 1.4);
      three = await createThreeScene(container, {
        label: 'A 3D flower with sepals, petals, stamens and a carpel. Drag to rotate, tap a part to inspect it.',
        camera: { position: [1.75 * back, 0.45 + 1.1 * back, 2.25 * back], target: [0, 0.45, 0] },
        minDistance: 1.4,
        maxDistance: 8,
        onFrame: (dt) => {
          if (flowerGroup) flowerGroup.rotation.y += dt * 0.45;
          syncPlane();
          positionLabels();
        },
      });
      build3D(three);
    } catch (err) {
      console.error(err);
      threeFailed = true;
      container.innerHTML = '<p class="fl-no3d">3D graphics are not available in this browser, so the 3D flower cannot be shown. Choose Pollination or Fertilisation above.</p>';
    } finally {
      loading3D = false;
      sim.setLoading(null);
      if (st.view === '3d') three?.setAnimating(sim.running && !prefersReducedMotion());
      sim.requestRender();
    }
  }
  let syncPlane = () => {};

  function build3D(view: ThreeScene) {
    const { THREE, scene, renderer } = view;
    renderer.localClippingEnabled = true;
    const flower = new THREE.Group();
    flowerGroup = flower;
    scene.add(flower);
    const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    // The cut always removes the half of the flower facing the viewer
    const facing = new THREE.Vector3(1, 0, 0);
    syncPlane = () => {
      facing.copy(view.camera.position).sub(view.controls.target).setY(0);
      if (facing.lengthSq() < 1e-6) facing.set(1, 0, 0);
      facing.normalize();
      plane.normal.copy(facing).negate();
    };
    const removed = (p: T.Vector3) => st.cut && p.x * facing.x + p.z * facing.z > 0.001;
    const mats: T.MeshStandardMaterial[] = [];
    const groups: Partial<Record<PartId, T.Mesh[]>> = {};
    const mat = (color: string, extra: Partial<T.MeshStandardMaterialParameters> = {}) => {
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6, metalness: 0, side: THREE.DoubleSide, ...extra });
      mats.push(m);
      return m;
    };
    const add = (id: PartId | null, mesh: T.Mesh, parent: T.Object3D = flower) => {
      if (id) {
        mesh.userData.part = id;
        (groups[id] ??= []).push(mesh);
      }
      parent.add(mesh);
      return mesh;
    };
    const sphere = new THREE.SphereGeometry(1, 28, 18);
    // stem, leaf and receptacle (not inspectable)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 16), mat('#5c940d'));
    stem.position.y = -1.2;
    flower.add(stem);
    const leaf = new THREE.Mesh(sphere, mat('#74b816'));
    leaf.scale.set(0.16, 0.02, 0.5);
    leaf.position.set(0, -1.3, 0.42);
    leaf.rotation.x = -0.5;
    flower.add(leaf);
    const rec = new THREE.Mesh(sphere, mat('#82c91e'));
    rec.scale.set(0.22, 0.12, 0.22);
    flower.add(rec);
    // sepals and petals
    for (let k = 0; k < 5; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * 2 * Math.PI) / 5 + Math.PI / 5;
      flower.add(pivot);
      const sepal = add('sepal', new THREE.Mesh(sphere, mat('#74b816')), pivot);
      sepal.scale.set(0.15, 0.025, 0.36);
      sepal.position.set(0, -0.04, 0.32);
      sepal.rotation.x = 0.35;
    }
    for (let k = 0; k < 5; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * 2 * Math.PI) / 5;
      flower.add(pivot);
      const petal = add('petal', new THREE.Mesh(sphere, mat('#f783ac')), pivot);
      petal.scale.set(0.3, 0.025, 0.6);
      petal.position.set(0, 0.2, 0.58);
      petal.rotation.x = -0.5;
    }
    // stamens
    const filGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.9, 8);
    filGeo.translate(0, 0.45, 0);
    for (let k = 0; k < 8; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * 2 * Math.PI) / 8 + 0.2;
      flower.add(pivot);
      const fil = add('filament', new THREE.Mesh(filGeo, mat('#e9ecb0')), pivot);
      fil.position.set(0, 0.04, 0.15);
      fil.rotation.x = 0.26;
      const anther = add('anther', new THREE.Mesh(sphere, mat('#fcc419')), pivot);
      anther.scale.set(0.05, 0.1, 0.07);
      anther.position.set(0, 0.04 + 0.9 * Math.cos(0.26), 0.15 + 0.9 * Math.sin(0.26));
    }
    // carpel: ovary with ovules on a central column, style and stigma
    const ovary = add('ovary', new THREE.Mesh(sphere, mat('#94d82d')));
    ovary.scale.set(0.26, 0.3, 0.26);
    ovary.position.y = 0.3;
    // pale lining, seen when the flower is cut open
    const lining = add('ovary', new THREE.Mesh(sphere, mat('#f4fce3', { side: THREE.BackSide })));
    lining.scale.set(0.24, 0.28, 0.24);
    lining.position.y = 0.3;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 10), mat('#d8f5a2'));
    column.position.y = 0.3;
    flower.add(column);
    for (let j = 0; j < 8; j++) {
      const a = j * (Math.PI / 2) + (j >= 4 ? Math.PI / 4 : 0);
      const ov = add('ovule', new THREE.Mesh(sphere, mat('#fff3bf')));
      ov.scale.setScalar(0.06);
      ov.position.set(Math.cos(a) * 0.1, 0.22 + (j >= 4 ? 0.16 : 0), Math.sin(a) * 0.1);
    }
    const style = add('style', new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.78, 12), mat('#a9e34b')));
    style.position.y = 0.95;
    const stigma = add('stigma', new THREE.Mesh(sphere, mat('#d8f5a2')));
    stigma.scale.set(0.11, 0.06, 0.11);
    stigma.position.y = 1.36;

    highlight = () => {
      for (const [id, list] of Object.entries(groups) as [PartId, T.Mesh[]][])
        for (const m of list) ((m.material as T.MeshStandardMaterial).emissive.setHex(id === selected ? 0x553311 : 0x000000));
      view.requestRender();
    };
    applyCut = () => {
      for (const m of mats) {
        m.clippingPlanes = st.cut ? [plane] : [];
        m.needsUpdate = true;
      }
      syncPlane();
      view.requestRender();
    };

    /* floating labels */
    const layer = document.createElement('div');
    layer.className = 'earth-labels fl-labels';
    layer.setAttribute('aria-hidden', 'true');
    container.appendChild(layer);
    const labels = PART_ORDER.map((id) => {
      const el = document.createElement('span');
      el.textContent = PARTS[id].name;
      layer.appendChild(el);
      return { id, el };
    });
    const tmp = new THREE.Vector3();
    positionLabels = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const l of labels) {
        const list = groups[l.id] ?? [];
        // pick the copy of the part nearest the camera
        let best: T.Mesh | null = null;
        let bd = Infinity;
        for (const m of list) {
          m.getWorldPosition(tmp);
          if (removed(tmp)) continue;
          const d = tmp.distanceTo(view.camera.position);
          if (d < bd) {
            bd = d;
            best = m;
          }
        }
        if (!best) {
          l.el.style.display = 'none';
          continue;
        }
        best.getWorldPosition(tmp);
        tmp.project(view.camera);
        l.el.style.display = tmp.z < 1 && (st.labels || l.id === selected) ? '' : 'none';
        l.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
        l.el.style.outline = l.id === selected ? '2px solid var(--accent)' : '';
      }
    };
    view.controls.addEventListener('change', () => (syncPlane(), positionLabels()));
    view.onPick(
      () => flower.children,
      (hit, at) => {
        const id = hit?.object.userData.part as PartId | undefined;
        if (!id) {
          sim.hideTooltip();
          return;
        }
        select(id);
        sim.showTooltip(at.x, at.y, PARTS[id].name, `${PARTS[id].group}. ${PARTS[id].job}`);
      },
      (hit) => !removed(hit.point),
    );
    applyCut();
    highlight();
    positionLabels();
  }

  function select(id: PartId | null) {
    selected = id;
    pick.value = id ?? '';
    if (id) explored.add(id);
    highlight();
    positionLabels();
    three?.requestRender();
    sim.requestRender();
  }
  pick.addEventListener('change', () => select((pick.value as PartId) || null));

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.dataset.flView = st.view === '3d' ? '3d' : '2d';
    ui.showWhen('[data-only="3d"]', st.view === '3d');
    ui.showWhen('[data-only="pollinate"]', st.view === 'pollinate');
    ui.showWhen('[data-only="fertilise"]', st.view === 'fertilise');
    ui.showWhen('[data-only-wind]', st.view === 'pollinate' && st.method === 'wind');
    ui.showWhen('[data-key="pollinate"]', st.view === 'pollinate');
    ui.showWhen('[data-key="fertilise"]', st.view === 'fertilise');
    if (st.view === '3d') {
      void ensure3D();
      three?.setAnimating(sim.running && !prefersReducedMotion());
      positionLabels();
    } else three?.setAnimating(false);
  }
  const viewCtl = ui.choice<View>('fl-view', (v) => {
    st.view = v;
    sim.hideTooltip();
    showView();
    if (v === 'fertilise') stageT = 0;
    sim.requestRender();
  });
  const methodCtl = ui.choice<Method>('fl-method', (v) => {
    st.method = v;
    particles = [];
    lastMsg = '';
    showView();
    if (v !== 'hand' && !sim.running) sim.play();
    sim.requestRender();
  });
  const selfCtl = ui.toggle('fl-selfinc', (v) => {
    st.selfInc = v;
    clearPollen();
    lastMsg = v
      ? 'Self-incompatible: each plant now rejects its own pollen, as in many apples, cherries and clovers. The pollen has been cleared.'
      : 'Self-compatible: each plant now accepts its own pollen, as in peas, tomatoes and wheat. The pollen has been cleared.';
    sim.requestRender();
  });
  const windCtl = ui.range('fl-wind', (v) => `${v}`, (v) => ((st.wind = v), sim.requestRender()));
  const cutCtl = ui.toggle('fl-cut', (v) => ((st.cut = v), applyCut(), positionLabels()));
  const labelCtl = ui.toggle('fl-labels', (v) => ((st.labels = v), positionLabels()));
  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    clearPollen();
    sim.requestRender();
  });
  root.querySelector('[data-prev]')?.addEventListener('click', () => goStage(st.stage - 1));
  root.querySelector('[data-next]')?.addEventListener('click', () => goStage(st.stage + 1));

  /* ======================= Pointer ======================= */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  let drag: { src: number; x: number; y: number } | null = null;
  const antherAt = (bx: number, by: number) => {
    const L = polLayout();
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) {
      const [ax, ay] = antherPos(i, k);
      if (Math.hypot(bx - ax, by - ay) < 18 * L.s) return i;
    }
    return -1;
  };
  enableDrag<'pollen'>(canvas, {
    hit(x, y) {
      if (st.view !== 'pollinate' || st.method !== 'hand') return null;
      const [bx, by] = toBox(x, y);
      return antherAt(bx, by) >= 0 ? 'pollen' : null;
    },
    start(_id, x, y) {
      sim.hideTooltip();
      const [bx, by] = toBox(x, y);
      drag = { src: antherAt(bx, by), x: bx, y: by };
    },
    move(_id, x, y) {
      const [bx, by] = toBox(x, y);
      if (drag) {
        drag.x = bx;
        drag.y = by;
      }
      sim.requestRender();
    },
    end() {
      if (!drag) return;
      const L = polLayout();
      const f = [0, 1, 2].find((i) => {
        const [sx, sy] = stigmaPos(i);
        return Math.abs(drag!.x - sx) < 30 * L.s && Math.abs(drag!.y - sy) < 26 * L.s;
      });
      if (f !== undefined) {
        transfers++;
        lastMsg = landMessage(land(f, drag.src, 3));
        sim.announce(lastMsg);
        if (!sim.running) sim.play();
      }
      drag = null;
      sim.requestRender();
    },
    click(x, y) {
      const [bx, by] = toBox(x, y);
      if (st.view === 'fertilise') {
        const hit = dots.findIndex(([dx, dy]) => Math.hypot(bx - dx, by - dy) < 22);
        if (hit >= 0) {
          goStage(hit);
          return;
        }
      }
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
    onPlayChange(on) {
      if (st.view === '3d') three?.setAnimating(on && !prefersReducedMotion());
    },
    reset() {
      Object.assign(st, DEF);
      viewCtl.set(DEF.view, false);
      methodCtl.set(DEF.method, false);
      selfCtl.set(DEF.selfInc, false);
      windCtl.set(DEF.wind, false);
      cutCtl.set(DEF.cut, false);
      labelCtl.set(DEF.labels, false);
      clearPollen();
      stageT = 0;
      explored.clear();
      select(null);
      applyCut();
      three?.resetView();
      showView();
    },
  });

  showView();
  sim.requestRender();
}
