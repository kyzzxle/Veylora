/**
 * Muscular system: four views in one simulator.
 *   atlas  – 3D figure with clickable major skeletal muscles; a muscle
 *            contracts (shortens, thickens) and moves its joint while its
 *            antagonist relaxes and is stretched
 *   fibre  – muscle → fascicle → fibre → myofibril → sarcomere, with an
 *            animated actin–myosin cross-bridge cycle driven by stimulation
 *   lever  – biceps and triceps moving the forearm as a third-class lever
 *   types  – skeletal, cardiac and smooth muscle compared
 *
 * Fibre model (model time in ms; drawn 5× slower than real time):
 *   each stimulus releases calcium:  a ← a + 0.9·(1 − a)
 *   calcium is pumped back:          a' = −a / 35
 *   force follows calcium:           F' = (a − F) / 45
 *   One stimulus gives a twitch (~38 % of maximum); faster stimulation sums
 *   twitches into an unfused, then fused, tetanus. Force from the whole
 *   muscle = fibre force × share of motor units recruited.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { buildAtlas } from './atlas';
import { MUSCLES } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'atlas' | 'fibre' | 'lever' | 'types';
type Fs = (px: number, w?: number) => string;

const SLOW = 5;
const RED = '#c9473f';
const RESTING = '#9a5f58';
const CONTRACT = '#e8584c';
const STRETCH = '#5b8fd6';
const ACTIN = '#e0a43a';
const MYOSIN = '#8e6bd8';
const HEAD_ON = '#d64fb0';
const CALCIUM = '#33b8d6';
const BONE = '#ece3cf';

const DEF = {
  view: 'atlas' as View,
  muscle: 'biceps',
  contract: 0,
  repeat: false,
  freq: 20,
  recruit: 60,
  atp: true,
  angle: 30,
  load: 5,
  forces: true,
};

export async function initMuscle(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const stageEl = root.querySelector<HTMLElement>('[data-stage]')!;
  const hint = root.querySelector<HTMLElement>('[data-hint]');
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const pick = root.querySelector<HTMLSelectElement>('[data-pick]')!;
  const infoTitle = root.querySelector<HTMLElement>('[data-info-title]')!;
  const infoText = root.querySelector<HTMLElement>('[data-info-text]')!;
  const graphPanel = root.querySelector<HTMLElement>('[data-graph-panel]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const st = { ...DEF };
  let anim = 0;
  let typesH = 1300;

  /* ---------- Fibre model ---------- */
  let tm = 0;
  let ca = 0;
  let F = 0;
  let nextPulse = 0;
  let lastStim = -1e9;
  let cyc = 0;
  let attached = 0;
  let totalHeads = 0;
  let hist: { f: Point[]; c: Point[] } = { f: [], c: [] };
  const fibreForce = () => clamp(F / 0.75, 0, 1);
  function stimulate() {
    if (!st.atp) return;
    ca += 0.9 * (1 - ca);
    lastStim = tm;
  }
  function stepFibre(realDt: number) {
    let left = (realDt * 1000) / SLOW;
    while (left > 0) {
      const h = Math.min(0.5, left);
      left -= h;
      if (st.repeat && tm >= nextPulse) {
        stimulate();
        nextPulse = tm + 1000 / st.freq;
      }
      // Without ATP calcium is not pumped away and cross-bridges cannot let go
      if (st.atp) {
        ca += (-ca / 35) * h;
        F += ((ca - F) / 45) * h;
      }
      tm += h;
    }
    if (st.atp) cyc += realDt * 3.2 * clamp(ca * 1.6, 0, 1);
    const last = hist.f[hist.f.length - 1];
    if (!last || tm - last.x >= 4) {
      hist.f.push({ x: tm, y: fibreForce() * st.recruit });
      hist.c.push({ x: tm, y: ca * 100 });
      while (hist.f.length && hist.f[0].x < tm - 1200) (hist.f.shift(), hist.c.shift());
    }
  }

  /* ---------- Lever ---------- */
  let moving = 0; // +1 bending, −1 straightening, 0 still

  /* ---------- 3D atlas ---------- */
  let three: ThreeScene | null = null;
  let atlas: ReturnType<typeof buildAtlas> | null = null;
  let no3d = false;

  function step(dt: number) {
    anim += dt;
    if (st.view === 'atlas') {
      st.contract = 0.5 - 0.5 * Math.cos(anim * 2.2);
      contractCtl.set(Math.round(st.contract * 100), false);
    } else if (st.view === 'fibre') {
      stepFibre(dt);
    } else if (st.view === 'lever') {
      const next = 75 + 65 * Math.sin(anim * 1.3);
      moving = Math.sign(next - st.angle);
      st.angle = next;
      angleCtl.set(Math.round(next), false);
    }
  }

  /* ---------- Layout helpers ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => {
    const tall = portrait();
    if (st.view === 'fibre') return tall ? [100, 60, 800, 740] : [0, 0, 1000, 605];
    if (st.view === 'lever') return tall ? [150, 20, 520, 740] : [0, 0, 1000, 600];
    // On phones the muscle-types panels stack; their height depends on how
    // the text wraps, so it is measured while drawing (typesH)
    if (st.view === 'types') return tall ? [0, 0, 700, typesH] : [0, 0, 1000, 580];
    return [0, 0, 1000, 560];
  };
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  function tag(text: string, x: number, y: number, fs: Fs, k: number) {
    ctx.font = fs(11, 700);
    const tw = ctx.measureText(text).width;
    const ph = 20 / k;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(x - tw / 2 - 6 / k, y - ph / 2, tw + 12 / k, ph, ph / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.textBaseline = 'alphabetic';
  }
  /** Word-wrapped text; returns the y below the last line. */
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
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  /* ---------- Fibre view ---------- */
  function drawHierarchy(fs: Fs, k: number) {
    const names = ['Muscle', 'Fascicle', 'Fibre (cell)', 'Myofibril', 'Sarcomere'];
    names.forEach((name, i) => {
      const cx = 95 + i * 178;
      const cy = 92;
      ctx.save();
      if (i === 0) {
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 52, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - 75, cy);
        ctx.lineTo(cx - 50, cy);
        ctx.moveTo(cx + 50, cy);
        ctx.lineTo(cx + 75, cy);
        ctx.stroke();
      } else if (i === 1) {
        ctx.fillStyle = 'rgba(201, 71, 63, 0.35)';
        ctx.beginPath();
        ctx.roundRect(cx - 60, cy - 26, 120, 52, 26);
        ctx.fill();
        ctx.fillStyle = RED;
        ctx.strokeStyle = pal['sim-bg'];
        ctx.lineWidth = 1.5;
        for (let j = 0; j < 7; j++) {
          const a = (j / 6) * Math.PI * 2;
          const r = j === 6 ? 0 : 14;
          ctx.beginPath();
          ctx.arc(cx - 34 + Math.cos(a) * r, cy + Math.sin(a) * r, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (i === 2) {
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.roundRect(cx - 65, cy - 14, 130, 28, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        for (let x = cx - 58; x < cx + 60; x += 5) {
          ctx.beginPath();
          ctx.moveTo(x, cy - 12);
          ctx.lineTo(x, cy + 12);
          ctx.stroke();
        }
        ctx.fillStyle = '#5a2c7a';
        for (const nx of [-40, 5, 45]) {
          ctx.beginPath();
          ctx.ellipse(cx + nx, cy - 10, 7, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (i === 3) {
        for (let x = cx - 65; x < cx + 65; x += 26) {
          ctx.fillStyle = '#e9a6a0';
          ctx.fillRect(x, cy - 8, 26, 16);
          ctx.fillStyle = '#8f2f2a';
          ctx.fillRect(x + 7, cy - 8, 12, 16);
          ctx.fillStyle = pal['sim-text'];
          ctx.fillRect(x - 1, cy - 10, 2, 20);
        }
      } else {
        ctx.strokeStyle = pal['sim-text'];
        ctx.lineWidth = 3;
        for (const x of [cx - 55, cx + 55]) {
          ctx.beginPath();
          ctx.moveTo(x, cy - 24);
          ctx.lineTo(x, cy + 24);
          ctx.stroke();
        }
        ctx.strokeStyle = ACTIN;
        ctx.lineWidth = 2;
        for (const y of [-16, 0, 16]) {
          ctx.beginPath();
          ctx.moveTo(cx - 55, cy + y);
          ctx.lineTo(cx - 8, cy + y);
          ctx.moveTo(cx + 55, cy + y);
          ctx.lineTo(cx + 8, cy + y);
          ctx.stroke();
        }
        ctx.strokeStyle = MYOSIN;
        ctx.lineWidth = 4;
        for (const y of [-8, 8]) {
          ctx.beginPath();
          ctx.moveTo(cx - 35, cy + y);
          ctx.lineTo(cx + 35, cy + y);
          ctx.stroke();
        }
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2 / k;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(cx - 72, cy - 34, 144, 68);
        ctx.setLineDash([]);
      }
      ctx.restore();
      ctx.font = fs(portrait() ? 10 : 11, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'center';
      ctx.fillText(name, cx, cy + 34 + 14 / k);
      const half = [75, 60, 65, 65, 72];
      if (i < 4) arrow(ctx, cx + half[i] + 6, cy, cx + 178 - half[i + 1] - 6, cy, pal['text-faint'], 2 / k, 9 / k);
    });
  }

  function drawFibre(fs: Fs, k: number) {
    const tall = portrait();
    if (tall) {
      ctx.font = fs(11, 700);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'center';
      ctx.fillText('Muscle › fascicle › fibre › myofibril ›', 500, 95);
      ctx.fillStyle = pal.accent;
      ctx.fillText('one sarcomere (below)', 500, 95 + 16 / k);
    } else drawHierarchy(fs, k);
    const act = clamp(ca * 1.6, 0, 1);
    const Fn = fibreForce();
    const L = 760 - 140 * Fn;
    const zl = 500 - L / 2;
    const zr = 500 + L / 2;
    const AL = 300;
    const top = 198;
    const rows = [0, 1, 2, 3, 4, 5].map((i) => top + 20 + i * 52);
    const bottom = rows[5] + 20;

    // A band shading
    ctx.fillStyle = 'rgba(142, 107, 216, 0.08)';
    ctx.fillRect(265, top, 470, bottom - top);
    // M-line
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.5 / k;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(500, top);
    ctx.lineTo(500, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    // Z-discs (zig-zag)
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 4;
    for (const z of [zl, zr]) {
      ctx.beginPath();
      for (let y = top, i = 0; y <= bottom; y += 13, i++) ctx.lineTo(z + (i % 2 ? 5 : -5), y);
      ctx.stroke();
    }
    // Actin (beads) with tropomyosin
    for (const y of rows) {
      for (const [from, to] of [[zl, zl + AL], [zr - AL, zr]]) {
        ctx.fillStyle = ACTIN;
        for (let x = from + 4; x < to; x += 9) {
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#6b4a12';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(from, y - (act > 0.1 ? 4 : 0));
        ctx.lineTo(to, y - (act > 0.1 ? 4 : 0));
        ctx.stroke();
      }
    }
    // Myosin with heads
    attached = 0;
    totalHeads = 0;
    let idx = 0;
    for (let r = 0; r < 5; r++) {
      const ym = (rows[r] + rows[r + 1]) / 2;
      for (const dir of [-1, 1]) {
        for (let j = 0; j < 7; j++) {
          const xb = 500 + dir * (62 + j * 28);
          const overlap = dir < 0 ? xb > zl && xb < zl + AL : xb < zr && xb > zr - AL;
          for (const ud of [-1, 1]) {
            idx++;
            totalHeads++;
            const p = (cyc + ((idx * 0.618) % 1)) % 1;
            let on = false;
            let tilt = 40;
            if (!st.atp && overlap) {
              on = true;
              tilt = -10;
            } else if (st.atp && overlap && act > 0.08) {
              if (p < 0.12) (on = true), (tilt = 40);
              else if (p < 0.5) (on = true), (tilt = lerp(40, -10, (p - 0.12) / 0.38));
              else if (p < 0.62) tilt = -10;
              else tilt = lerp(-10, 40, (p - 0.62) / 0.38);
            }
            if (on) attached++;
            const len = on ? 21 : 13;
            const t = (tilt * Math.PI) / 180;
            const bx = xb;
            const by = ym + ud * 5;
            const tx = bx + dir * Math.sin(t) * len;
            const ty = by + ud * Math.cos(t) * len;
            ctx.strokeStyle = on ? HEAD_ON : '#a58be0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.fillStyle = on ? HEAD_ON : '#a58be0';
            ctx.beginPath();
            ctx.ellipse(tx, ty, 5, 3.5, Math.atan2(ty - by, tx - bx), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.fillStyle = MYOSIN;
      ctx.beginPath();
      ctx.roundRect(265, ym - 5, 470, 10, 5);
      ctx.fill();
    }
    // Calcium ions
    const nCa = Math.round(ca * 46);
    ctx.fillStyle = CALCIUM;
    for (let i = 0; i < nCa; i++) {
      const x = zl + 20 + ((0.5 + i * 0.7548777) % 1) * (L - 40) + Math.sin(anim * 2 + i) * 3;
      const y = top + 8 + ((0.5 + i * 0.5698403) % 1) * (bottom - top - 16);
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Labels
    tag('Z-disc', tall ? Math.max(zl, 100 + 28 / k) : zl, top - 14 / k, fs, k);
    tag('Z-disc', tall ? Math.min(zr, 900 - 28 / k) : zr, top - 14 / k, fs, k);
    tag('M-line', 500, top - 14 / k, fs, k);
    // Sarcomere length bracket
    const by = bottom + 14;
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    ctx.moveTo(zl, by - 6);
    ctx.lineTo(zl, by + 6);
    ctx.moveTo(zl, by);
    ctx.lineTo(zr, by);
    ctx.moveTo(zr, by - 6);
    ctx.lineTo(zr, by + 6);
    ctx.stroke();
    tag(`One sarcomere: ${((2.5 * L) / 760).toFixed(2)} µm`, 500, by, fs, k);

    // Legend and motor units
    ctx.font = fs(11, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const items: [string, string][] = [
      [ACTIN, '● Actin (thin filament)'],
      [MYOSIN, '● Myosin (thick filament)'],
      [HEAD_ON, '● Myosin head attached (cross-bridge)'],
      [CALCIUM, '● Calcium ions (Ca²⁺)'],
    ];
    const ly = by + 32 / k;
    const lx = tall ? 120 : 40;
    if (tall) {
      items.forEach(([c, t], i) => {
        ctx.fillStyle = c;
        ctx.fillText(t, lx, ly + (i * 18) / k);
      });
    } else {
      let x = lx;
      for (const [c, t] of items) {
        ctx.fillStyle = c;
        ctx.fillText(t, x, ly);
        x += ctx.measureText(t).width + 18 / k;
      }
    }
    const my = tall ? ly + (4 * 18 + 8) / k : ly + 22 / k;
    const nUnits = Math.round(st.recruit / 10);
    const flash = tm - lastStim < 25;
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`Motor units recruited: ${nUnits} of 10`, lx, my);
    // On phones the motor-unit dots go on their own line
    const mx = tall ? lx + 6 / k : lx + ctx.measureText(`Motor units recruited: ${nUnits} of 10`).width + 14 / k;
    const dy = tall ? my + 20 / k : my;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.arc(mx + (i * 18) / k, dy, 6 / k, 0, Math.PI * 2);
      ctx.fillStyle = i < nUnits ? (flash ? '#ffd54a' : pal.accent) : pal.border;
      ctx.fill();
    }
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------- Lever view ---------- */
  function spindle(o: [number, number], ins: [number, number], w: number, colour: string) {
    const dx = ins[0] - o[0];
    const dy = ins[1] - o[1];
    const L = Math.hypot(dx, dy);
    const ux = dx / L;
    const uy = dy / L;
    const p1: [number, number] = [o[0] + ux * L * 0.16, o[1] + uy * L * 0.16];
    const p2: [number, number] = [o[0] + ux * L * 0.8, o[1] + uy * L * 0.8];
    const mx = (p1[0] + p2[0]) / 2;
    const my = (p1[1] + p2[1]) / 2;
    // tendons
    ctx.strokeStyle = '#f4efe6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(o[0], o[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.moveTo(p2[0], p2[1]);
    ctx.lineTo(ins[0], ins[1]);
    ctx.stroke();
    // belly
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.quadraticCurveTo(mx - uy * w * 1.3, my + ux * w * 1.3, p2[0], p2[1]);
    ctx.quadraticCurveTo(mx + uy * w * 1.3, my - ux * w * 1.3, p1[0], p1[1]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    return L;
  }
  function bone(a: [number, number], b: [number, number], w: number) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#b9ad94';
    ctx.lineWidth = w + 3;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = BONE;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  /** Lever geometry for the current elbow angle. */
  function leverGeom() {
    const th = (st.angle * Math.PI) / 180;
    const S: [number, number] = [330, 70];
    const E: [number, number] = [330, 300];
    const d = [Math.sin(th), Math.cos(th)];
    const n = [Math.cos(th), -Math.sin(th)];
    const H: [number, number] = [E[0] + 210 * d[0], E[1] + 210 * d[1]];
    const Ib: [number, number] = [E[0] + 26 * d[0] + 8 * n[0], E[1] + 26 * d[1] + 8 * n[1]];
    const Ob: [number, number] = [348, 83];
    const It: [number, number] = [E[0] - 22 * n[0] - 4 * d[0], E[1] - 22 * n[1] - 4 * d[1]];
    const Ot: [number, number] = [312, 83];
    // Moment of the load and forearm about the elbow, and the biceps force needed
    const moment = (st.load * 0.33 + 1.5 * 0.15) * 9.81 * Math.sin(th);
    const bx = Ob[0] - Ib[0];
    const byy = Ob[1] - Ib[1];
    const sinB = Math.abs(d[0] * byy - d[1] * bx) / Math.hypot(bx, byy);
    const Fb = moment / (0.04 * Math.max(sinB, 0.05));
    return { S, E, H, d, n, Ib, Ob, It, Ot, Fb };
  }
  function drawLever(fs: Fs, k: number) {
    const tall = portrait();
    const g = leverGeom();
    const hold = st.load > 0 && st.angle > 5;
    const bicepsOn = moving > 0 || (moving === 0 && hold);
    const tricepsOn = moving < 0;
    // scapula and humerus
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.moveTo(300, 45);
    ctx.lineTo(352, 67);
    ctx.lineTo(318, 135);
    ctx.closePath();
    ctx.fill();
    bone(g.S, g.E, 18);
    // forearm and olecranon
    bone(g.E, g.H, 14);
    bone([g.E[0] - 18 * g.n[0], g.E[1] - 18 * g.n[1]], [g.E[0] + 20 * g.d[0], g.E[1] + 20 * g.d[1]], 12);
    ctx.fillStyle = '#d9c8b5';
    ctx.beginPath();
    ctx.arc(g.H[0] + 10 * g.d[0], g.H[1] + 10 * g.d[1], 16, 0, Math.PI * 2);
    ctx.fill();
    // muscles: length decides thickness (volume stays the same)
    const lb = Math.hypot(g.Ob[0] - g.Ib[0], g.Ob[1] - g.Ib[1]);
    const lt = Math.hypot(g.Ot[0] - g.It[0], g.Ot[1] - g.It[1]);
    spindle(g.Ot, g.It, 17 * Math.sqrt(225 / lt), tricepsOn ? CONTRACT : bicepsOn ? STRETCH : RESTING);
    spindle(g.Ob, g.Ib, 15 * Math.sqrt(245 / lb), bicepsOn ? CONTRACT : tricepsOn ? STRETCH : RESTING);
    // elbow joint (fulcrum)
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.arc(g.E[0], g.E[1], 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // load
    if (st.load > 0) {
      const wx = g.H[0] + 10 * g.d[0];
      const wy = g.H[1] + 10 * g.d[1];
      const s = 30 + st.load * 2.4;
      ctx.fillStyle = '#5d6b7a';
      ctx.beginPath();
      ctx.roundRect(wx - s / 2, wy + 8, s, s * 0.8, 4);
      ctx.fill();
      ctx.strokeStyle = '#5d6b7a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx, wy + 8);
      ctx.stroke();
      ctx.font = fs(10, 800);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${st.load} kg`, wx, wy + 8 + s * 0.4);
      ctx.textBaseline = 'alphabetic';
      if (st.forces) arrow(ctx, wx + s / 2 + 12, wy + 10, wx + s / 2 + 12, wy + 26 + st.load * 6, pal.warning, 3 / k, 10 / k);
    }
    if (st.forces && st.angle > 5) {
      const ux = g.Ob[0] - g.Ib[0];
      const uy = g.Ob[1] - g.Ib[1];
      const ul = Math.hypot(ux, uy);
      const len = clamp(30 + g.Fb / 9, 30, 140);
      arrow(ctx, g.Ib[0], g.Ib[1], g.Ib[0] + (ux / ul) * len, g.Ib[1] + (uy / ul) * len, pal.success, 3.5 / k, 11 / k);
      // fulcrum marker
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.moveTo(g.E[0], g.E[1] + 12);
      ctx.lineTo(g.E[0] - 12, g.E[1] + 32);
      ctx.lineTo(g.E[0] + 12, g.E[1] + 32);
      ctx.closePath();
      ctx.fill();
    }
    // labels
    tag('Humerus', 235, 235, fs, k);
    tag('Elbow (hinge joint)', g.E[0] - 95, g.E[1] + 6, fs, k);
    const mid = (a: [number, number], b: [number, number], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    const [bxl, byl] = mid(g.Ob, g.Ib, 0.45);
    tag('Biceps', bxl + 70, byl - 10, fs, k);
    const tyl = mid(g.Ot, g.It, 0.4)[1];
    tag('Triceps', 240, Math.min(tyl, 180) - 40, fs, k);
    const fx = g.E[0] + 125 * g.d[0] - 26 * g.n[0];
    const fy = g.E[1] + 125 * g.d[1] - 26 * g.n[1];
    tag('Radius and ulna', fx, fy, fs, k);

    // explanation panel
    const px = tall ? 160 : 640;
    let py = tall ? 600 : 115;
    const pw = tall ? 500 : 330;
    ctx.textAlign = 'left';
    ctx.font = fs(12, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Muscles, bones and joints', px, py);
    py += 22 / k;
    ctx.font = fs(11, 600);
    const lines = [
      [CONTRACT, '■ Contracting: shortens and pulls'],
      [STRETCH, '■ Relaxing: stretched by its partner'],
      [pal.success, '→ Effort: biceps pull on the radius'],
      [pal.warning, '↓ Load: weight in the hand'],
      [pal.accent, '▲ Fulcrum: the elbow joint'],
    ];
    for (const [c, t] of lines) {
      ctx.fillStyle = c;
      ctx.fillText(t, px, py);
      py += 18 / k;
    }
    if (!tall) {
      py += 8 / k;
      ctx.fillStyle = pal['text-faint'];
      py = wrap('Muscles can only pull. The biceps bends the elbow and the triceps straightens it, so they work as an antagonistic pair. Tendons join muscles to bones; ligaments hold the bones of the joint together.', px, py, pw, 17 / k);
    }
  }

  /* ---------- Muscle types view ---------- */
  function drawTypes(fs: Fs, k: number) {
    const tall = portrait();
    const types = [
      { name: 'Skeletal muscle', facts: ['Attached to bones by tendons', 'Voluntary: you decide when it contracts', 'Striated (striped)', 'Long cylindrical cells with many nuclei', 'Fast and powerful, but tires quickly'] },
      { name: 'Cardiac muscle', facts: ['Found only in the wall of the heart', 'Involuntary: beats on its own', 'Striated, with branched cells', 'One nucleus; cells joined by intercalated discs', 'Works all your life without tiring'] },
      { name: 'Smooth muscle', facts: ['Walls of the gut, blood vessels, bladder and airways', 'Involuntary', 'Not striated', 'Spindle-shaped cells with one nucleus', 'Slow, long-lasting contractions'] },
    ];
    let cursor = 20;
    types.forEach((t, j) => {
      const x0 = tall ? 20 : 25 + j * 325;
      const y0 = tall ? cursor : 52;
      const w = tall ? 660 : 300;
      const ph = tall ? 130 : 230;
      ctx.textAlign = 'left';
      ctx.font = fs(13, 800);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(t.name, x0, y0 + 14);
      const py = y0 + 14 + 14 / k;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x0, py, w, ph, 12);
      ctx.fillStyle = '#f3d9d4';
      ctx.fill();
      ctx.clip();
      if (j === 0) {
        // skeletal: twitches every 1.6 s
        const ph0 = (anim % 1.6) / 1.6;
        const c = sim.running && ph0 < 0.25 ? Math.sin((ph0 / 0.25) * Math.PI) : 0;
        const rows = 3;
        for (let r = 0; r < rows; r++) {
          const fh = ph / rows - 10;
          const fy = py + 5 + r * (ph / rows);
          const fw = w * (1 - 0.12 * c) + 40;
          const fx = x0 - 20 + (w + 40 - fw) / 2;
          ctx.fillStyle = '#c55a52';
          ctx.beginPath();
          ctx.roundRect(fx, fy, fw, fh, fh / 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(90, 20, 20, 0.45)';
          ctx.lineWidth = 1.6;
          const sp = 8 * (1 - 0.15 * c);
          for (let x = fx + 4; x < fx + fw; x += sp) {
            ctx.beginPath();
            ctx.moveTo(x, fy + 2);
            ctx.lineTo(x, fy + fh - 2);
            ctx.stroke();
          }
          ctx.fillStyle = '#4a2a6a';
          for (let q = 0; q < 6; q++) {
            ctx.beginPath();
            ctx.ellipse(fx + 30 + q * (fw / 6), fy + (q % 2 ? fh - 4 : 4), 9, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (j === 1) {
        // cardiac: beats at 72 per minute
        const beat = (anim * 1.2) % 1;
        const c = sim.running && beat < 0.35 ? Math.sin((beat / 0.35) * Math.PI) : 0;
        const s = 1 - 0.1 * c;
        const cx = x0 + w / 2;
        const cy = py + ph / 2;
        ctx.translate(cx, cy);
        ctx.scale(s, 1);
        ctx.translate(-cx, -cy);
        const cellW = 90;
        const rowsN = Math.round(ph / 46);
        for (let r = 0; r < rowsN; r++) {
          const fy = py + 10 + r * 46;
          const shift = r % 2 ? 45 : 0;
          for (let x = x0 - 60 + shift; x < x0 + w + 40; x += cellW) {
            ctx.fillStyle = '#c55a52';
            ctx.beginPath();
            ctx.roundRect(x, fy, cellW - 4, 28, 8);
            ctx.fill();
            // branch to the next row
            ctx.beginPath();
            ctx.moveTo(x + 50, fy + 24);
            ctx.lineTo(x + 70, fy + 50);
            ctx.lineTo(x + 84, fy + 50);
            ctx.lineTo(x + 66, fy + 24);
            ctx.fill();
            ctx.strokeStyle = 'rgba(90, 20, 20, 0.4)';
            ctx.lineWidth = 1.4;
            for (let sx = x + 4; sx < x + cellW - 6; sx += 7) {
              ctx.beginPath();
              ctx.moveTo(sx, fy + 3);
              ctx.lineTo(sx, fy + 25);
              ctx.stroke();
            }
            ctx.strokeStyle = '#3a1020';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + cellW - 4, fy + 2);
            ctx.lineTo(x + cellW - 4, fy + 26);
            ctx.stroke();
            ctx.fillStyle = '#4a2a6a';
            ctx.beginPath();
            ctx.ellipse(x + cellW / 2 - 6, fy + 14, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // smooth: a slow wave of contraction passes along the sheet
        const rowsN = Math.round(ph / 26);
        for (let r = 0; r < rowsN; r++) {
          for (let q = 0; q < 8; q++) {
            const cx = x0 + (q + (r % 2) * 0.5) * (w / 7) - 10;
            const cy = py + 14 + r * 26;
            const c = sim.running ? 0.5 + 0.5 * Math.sin(anim * 1.4 - cx * 0.02) : 0;
            const len = (w / 7) * (1.05 - 0.22 * c);
            const thick = 9 + 4 * c;
            ctx.fillStyle = '#d27a6f';
            ctx.beginPath();
            ctx.moveTo(cx - len / 2, cy);
            ctx.quadraticCurveTo(cx, cy - thick, cx + len / 2, cy);
            ctx.quadraticCurveTo(cx, cy + thick, cx - len / 2, cy);
            ctx.fill();
            ctx.fillStyle = '#4a2a6a';
            ctx.beginPath();
            ctx.ellipse(cx, cy, len * 0.16, 2.4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
      ctx.font = fs(11, 600);
      ctx.fillStyle = pal['sim-text'];
      let fy = py + ph + 22 / k;
      // On phones only the first fact (where it is found) fits; the readouts list the rest
      for (const f of tall ? t.facts.slice(0, 1) : t.facts) fy = wrap(`• ${f}`, x0, fy, w, 16 / k);
      cursor = fy + 14 / k;
    });
    // Fit the stacked phone layout to its measured height (settles in a frame or two)
    const fitH = clamp(cursor, 500, 1600);
    if (tall && Math.abs(fitH - typesH) > 4) {
      typesH = fitH;
      sim.requestRender();
    }
  }

  /* ---------- Render and readouts ---------- */
  function drawFallback() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(14, 700);
    ctx.textAlign = 'center';
    ctx.fillText('3D graphics (WebGL) are not available in this browser.', w / 2, h / 2 - 10);
    ctx.font = font(12, 500);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('Choose a muscle from the list to read about it, or try the other views.', w / 2, h / 2 + 14);
  }

  function render() {
    if (st.view === 'atlas') {
      if (no3d) drawFallback();
      else atlas?.update(st.muscle, st.contract, three!.cssColor('accent'));
    } else {
      const { w, h } = size;
      ctx.fillStyle = pal['sim-bg'];
      ctx.fillRect(0, 0, w, h);
      const { k, ox, oy } = tf();
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      const fs: Fs = (px, wt = 650) => font(px / k, wt);
      if (st.view === 'fibre') drawFibre(fs, k);
      else if (st.view === 'lever') drawLever(fs, k);
      else drawTypes(fs, k);
      ctx.restore();
    }
    updateReadouts();
    drawGraph();
  }

  function updateReadouts() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    if (st.view === 'atlas') {
      const m = MUSCLES[st.muscle];
      const ant = m.antagonist ? MUSCLES[m.antagonist].name : 'None shown in this model';
      r('r1', 'Selected muscle', m.name);
      r('r2', 'Contraction', st.contract < 0.03 ? 'Relaxed' : `${Math.round(st.contract * 100)}%: shorter and thicker`);
      r('r3', 'What it does', m.action);
      r('r4', 'Antagonist (relaxes and lengthens)', ant);
      r('r5', 'Muscle type', 'Skeletal muscle (voluntary)');
      sim.setBadge(m.name);
      noteEl.textContent = 'Click any muscle or choose one from the list, then press Start or move the contraction slider. The muscle (red) shortens, thickens and pulls on a bone; its antagonist (blue) relaxes and is stretched.';
    } else if (st.view === 'fibre') {
      const Fn = fibreForce();
      const L = 760 - 140 * Fn;
      const pattern = !st.atp
        ? 'Rigor: no ATP, cross-bridges stuck'
        : st.repeat && sim.running
          ? st.freq < 6
            ? `Separate twitches (${st.freq} per second)`
            : st.freq < 30
              ? `Summation: unfused tetanus (${st.freq} Hz)`
              : `Fused tetanus (${st.freq} Hz)`
          : tm - lastStim < 300
            ? 'Single twitch'
            : Fn > 0.05
              ? 'Relaxing'
              : 'Relaxed';
      r('r1', 'Stimulation', pattern, !st.atp ? 'bad' : null);
      r('r2', 'Whole-muscle force', `${Math.round(Fn * st.recruit)}% of maximum`);
      r('r3', 'Sarcomere length', `${((2.5 * L) / 760).toFixed(2)} µm (rest 2.50)`);
      r('r4', 'Cross-bridges attached', `${attached} of ${totalHeads}`);
      r('r5', 'Calcium in the fibre', ca > 0.4 ? 'High' : ca > 0.08 ? 'Falling' : 'Low (pumped away)');
      sim.setBadge(`${SLOW}× slower`);
      noteEl.textContent = !st.atp
        ? 'Without ATP, myosin heads cannot let go of actin and calcium cannot be pumped away, so the fibre stays locked. This is what causes rigor mortis after death. Turn ATP back on.'
        : 'A nerve impulse releases calcium inside the fibre. Calcium moves tropomyosin off the binding sites on actin, so myosin heads attach, pull (the power stroke) and let go using ATP. Actin slides towards the M-line and the sarcomere shortens.';
    } else if (st.view === 'lever') {
      const g = leverGeom();
      const on = moving > 0 ? 'Biceps (triceps relaxes)' : moving < 0 ? 'Triceps (biceps relaxes)' : st.load > 0 && st.angle > 5 ? 'Biceps, holding the load' : 'Neither (arm hanging)';
      r('r1', 'Elbow bend', `${Math.round(st.angle)}°`);
      r('r2', 'Contracting', on);
      const load = st.load * 9.81;
      r('r3', 'Biceps force needed', st.angle > 5 ? `${Math.round(g.Fb)} N${st.load > 0 ? ` (${(g.Fb / load).toFixed(1)} × the load)` : ''}` : 'Almost none', g.Fb > 900 ? 'warn' : null);
      r('r4', 'Load in the hand', `${st.load} kg = ${Math.round(load)} N`);
      r('r5', 'Lever type', 'Third class: effort between fulcrum and load');
      sim.setBadge('Antagonistic pair');
      noteEl.textContent = 'Press Start to watch the arm bend and straighten, or drag the elbow slider. The biceps is attached only 4 cm from the elbow but the load is 33 cm away, so the muscle must pull many times harder than the weight. In return, the hand moves far and fast.';
    } else {
      r('r1', 'Skeletal', 'Voluntary · striated · many nuclei per cell');
      r('r2', 'Cardiac', 'Involuntary · striated · branched · 1 nucleus');
      r('r3', 'Smooth', 'Involuntary · not striated · spindle cells');
      r('r4', 'This simulator models', 'Skeletal muscle (atlas, fibre and lever views)');
      r('r5', 'All three', 'Contract using actin and myosin');
      sim.setBadge('Three muscle types');
      noteEl.textContent = 'All muscle contracts by sliding actin and myosin filaments, but the three types differ in where they are, how they look and how they are controlled. Press Start to see each one contract.';
    }
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="mu-graph"]')!, { x: { min: 0, span: 1000 }, y: { min: 0, max: 100, step: 20 } });
  function drawGraph() {
    if (st.view !== 'fibre') return;
    graph.opts.x = { min: Math.max(0, tm - 1000), span: 1000, max: Math.max(1000, tm), step: 200, format: (x) => `${(x / 1000).toFixed(1)} s` };
    graph.opts.y = { min: 0, max: 100, step: 20, format: (v) => `${v}%` };
    graph.set('f', { label: 'Muscle force (% of maximum)', color: '#e8584c', points: hist.f, width: 3 });
    graph.set('c', { label: 'Calcium level', color: CALCIUM, points: hist.c, width: 1.5, dash: [5, 4] });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="mu-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  function select(id: string) {
    if (!MUSCLES[id]) return;
    st.muscle = id;
    pick.value = id;
    const m = MUSCLES[id];
    infoTitle.textContent = m.name;
    infoText.textContent = `${m.location} ${m.action}`;
    sim.requestRender();
  }
  pick.addEventListener('change', () => select(pick.value));

  function applyView() {
    const is3d = st.view === 'atlas' && !no3d;
    container.style.display = is3d ? '' : 'none';
    canvas.style.display = is3d ? 'none' : '';
    stageEl.classList.toggle('mu-flat', !is3d);
    if (hint) hint.style.display = is3d ? '' : 'none';
    graphPanel.hidden = st.view !== 'fibre';
    for (const v of ['atlas', 'fibre', 'lever'] as const) ui.showWhen(`[data-only="${v}"]`, st.view === v);
    sim.setLoading(st.view === 'atlas' && !three && !no3d ? 'Loading 3D muscles…' : null);
    sim.hideTooltip();
    sim.requestRender();
  }
  const viewCtl = ui.choice<View>('mu-view', (v) => {
    st.view = v;
    moving = 0;
    applyView();
  });
  const contractCtl = ui.range('mu-contract', (v) => (v === 0 ? 'Relaxed' : `${v}%`), (v) => {
    st.contract = v / 100;
    if (sim.running) sim.pause();
    sim.requestRender();
  });
  root.querySelector('[data-twitch]')!.addEventListener('click', () => {
    stimulate();
    if (!sim.running) sim.play();
  });
  const repeatCtl = ui.toggle('mu-repeat', (v) => {
    st.repeat = v;
    nextPulse = tm;
    if (v && !sim.running) sim.play();
    sim.requestRender();
  });
  const freqCtl = ui.range('mu-freq', (v) => `${v} per second`, (v) => ((st.freq = v), sim.requestRender()));
  const recruitCtl = ui.range('mu-recruit', (v) => `${v / 10} of 10 motor units`, (v) => ((st.recruit = v), sim.requestRender()));
  root.querySelector('[data-relax]')!.addEventListener('click', () => {
    st.repeat = false;
    repeatCtl.set(false, false);
    if (!sim.running) sim.play();
    sim.announce(st.atp ? 'Stimulation stopped. Calcium is pumped away and the fibre relaxes.' : 'The fibre cannot relax without ATP.');
  });
  const atpCtl = ui.toggle('mu-atp', (v) => {
    st.atp = v;
    sim.requestRender();
  });
  const angleCtl = ui.range('mu-angle', (v) => `${v}°`, (v) => {
    moving = Math.sign(v - st.angle);
    st.angle = v;
    if (sim.running) sim.pause();
    sim.requestRender();
  });
  const loadCtl = ui.range('mu-load', (v) => `${v} kg`, (v) => ((st.load = v), sim.requestRender()));
  const forcesCtl = ui.toggle('mu-forces', (v) => ((st.forces = v), sim.requestRender()));

  const sim = createSimController(root, {
    step,
    render,
    onPlayChange: (on) => {
      if (!on) moving = 0;
    },
    reset() {
      Object.assign(st, DEF);
      viewCtl.set('atlas', false);
      contractCtl.set(0, false);
      repeatCtl.set(false, false);
      freqCtl.set(DEF.freq, false);
      recruitCtl.set(DEF.recruit, false);
      atpCtl.set(true, false);
      angleCtl.set(DEF.angle, false);
      loadCtl.set(DEF.load, false);
      forcesCtl.set(true, false);
      tm = ca = F = cyc = anim = 0;
      lastStim = -1e9;
      moving = 0;
      hist = { f: [], c: [] };
      select('biceps');
      applyView();
      three?.resetView();
    },
  });

  select('biceps');
  applyView();

  /* ---------- 3D (loaded last so the 2D views work straight away) ---------- */
  try {
    three = await createThreeScene(container, {
      label: 'A 3D human figure showing major skeletal muscles. Click a muscle to learn about it.',
      camera: { position: [0.75, 1.05, 2.45], target: [0, 0.92, 0] },
      minDistance: 0.6,
      maxDistance: 6,
    });
  } catch {
    no3d = true;
    applyView();
    return;
  }
  atlas = buildAtlas(three);
  three.onPick(
    () => [atlas!.body],
    (hit, at) => {
      const id = hit?.object.userData.muscle as string | undefined;
      if (!id) return sim.hideTooltip();
      select(id);
      sim.showTooltip(at.x, at.y, MUSCLES[id].name, MUSCLES[id].action);
    },
  );
  applyView();
}
