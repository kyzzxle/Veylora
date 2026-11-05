/**
 * Immune system: three views.
 *   organs    – immune organs, lymphatic vessels and circulating immune cells
 *   infection – a wound in the skin lets a pathogen in; innate immunity
 *               (inflammation, phagocytes) acts within hours, adaptive immunity
 *               (B and T cells, antibodies) takes days the first time
 *   memory    – the same model run twice to compare primary and secondary responses
 *
 * Teaching model (time in days, relative units):
 *   pathogen  P' = r·P·(1 − P/10⁴) − kN·N·P − 0.3·A·P
 *   phagocytes N' = 3·P/(P+20) − 0.5·(N − 0.1)      (innate: fast)
 *   antigen presented S' = P/(P+20) − 0.4·S
 *   B and T cells E' = 0.01·S + g·E·S/(S+0.3) − 0.3·E   (adaptive: clonal expansion)
 *   antibodies A' = 0.8·E − 0.1·A
 *   Immune memory starts the next response with many more ready cells (E₀)
 *   and faster expansion (g), so the secondary response is quicker and larger.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'organs' | 'infection' | 'memory';
type Pathogen = 'bacteria' | 'virus';
interface State {
  P: number;
  N: number;
  S: number;
  E: number;
  A: number;
}

const INFO: Record<string, [string, string]> = {
  marrow: ['Bone marrow', 'Soft tissue inside bones where all blood cells, including white blood cells, are made. B cells also mature here.'],
  thymus: ['Thymus', 'A gland in the chest where T cells mature and learn not to attack the body’s own cells. Largest in childhood.'],
  spleen: ['Spleen', 'Filters the blood, removes old red blood cells and contains white blood cells that respond to pathogens in the blood.'],
  nodes: ['Lymph nodes', 'Bean-shaped filters along lymph vessels where B and T cells meet antigens. They swell when fighting an infection.'],
  tonsils: ['Tonsils and adenoids', 'Lymphatic tissue in the throat that samples pathogens entering through the mouth and nose.'],
  vessels: ['Lymphatic vessels', 'Carry lymph (fluid from tissues, with immune cells) through the lymph nodes and back into the blood near the heart.'],
  blood: ['Blood vessels', 'Carry white blood cells around the body so they can reach any infected tissue quickly.'],
};

/** Run the teaching model for `days` from a starting state, calling `each` every step. */
function simulate(s: State, days: number, path: Pathogen, memory: boolean, each?: (t: number, s: State) => void) {
  const r = path === 'virus' ? 1.9 : 1.5;
  const kN = path === 'virus' ? 0.18 : 0.35;
  const g = memory ? 1.6 : 1.2;
  const dt = 0.01;
  for (let t = 0; t < days; t += dt) {
    s.N += (3 * s.P / (s.P + 20) - 0.5 * (s.N - 0.1)) * dt;
    s.S += (s.P / (s.P + 20) - 0.4 * s.S) * dt;
    s.E += (0.01 * s.S + (g * s.E * s.S) / (s.S + 0.3) - 0.3 * s.E) * dt;
    s.A += (0.8 * s.E - 0.1 * s.A) * dt;
    s.P += (r * s.P * (1 - s.P / 1e4) - kN * s.N * s.P - 0.3 * s.A * s.P) * dt;
    if (s.P < 0.01) s.P = 0;
    each?.(t, s);
  }
  return s;
}

export function initImmune(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const graphPanel = root.querySelector<HTMLElement>('[data-graph-panel]')!;

  const st = { view: 'organs' as View, path: 'bacteria' as Pathogen, dose: 20, memory: false };
  let anim = 0;
  let day = 0;
  let infected = false;
  let s: State = { P: 0, N: 0.1, S: 0, E: 0.02, A: 0 };
  let hist: { P: Point[]; A: Point[] } = { P: [], A: [] };
  let cleared = -1;

  const memoryReady = () => st.memory;
  function infect() {
    const mem = memoryReady();
    s = { P: st.dose, N: 0.1, S: 0, E: mem ? 3 : 0.02, A: mem ? 0.5 : 0 };
    day = 0;
    infected = true;
    cleared = -1;
    hist = { P: [{ x: 0, y: st.dose }], A: [{ x: 0, y: s.A / 5 }] };
    sim.play();
  }
  function heal() {
    s = { P: 0, N: 0.1, S: 0, E: 0.02, A: 0 };
    infected = false;
    day = 0;
    hist = { P: [], A: [] };
  }

  function step(dt: number) {
    anim += dt;
    if (st.view !== 'infection' || !infected) return;
    const days = dt * 0.6;
    simulate(s, days, st.path, memoryReady());
    day += days;
    if (s.P === 0 && cleared < 0) {
      cleared = day;
      st.memory = true;
      memCtl.set(true, false);
      sim.announce(`Infection cleared on day ${day.toFixed(1)}. Memory cells now remain.`);
    }
    if (day - (hist.P[hist.P.length - 1]?.x ?? 0) >= 0.25) {
      hist.P.push({ x: day, y: s.P });
      hist.A.push({ x: day, y: s.A / 5 });
    }
    if (day > 30) sim.pause();
  }

  /* ---------- Drawing (design box 1000 × 560; on tall phone screens each view
     uses its own crop or a stacked layout) ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => {
    if (!portrait()) return [0, 0, 1000, 560];
    if (st.view === 'organs') return [290, 0, 440, 560];
    if (st.view === 'infection') return [20, 50, 680, 750];
    return [0, 20, 1000, 1310];
  };
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  function tag(text: string, x: number, y: number, fs: (n: number, w?: number) => string, k: number) {
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

  // Organs view geometry
  const NODES: [number, number][] = [[465, 140], [535, 140], [420, 205], [580, 205], [470, 330], [530, 330], [455, 430], [545, 430]];
  const LYMPH: [number, number][][] = [
    [[455, 430], [470, 330], [490, 250], [480, 175]],
    [[545, 430], [530, 330], [510, 250], [480, 175]],
    [[420, 205], [480, 175]],
    [[580, 205], [480, 175]],
    [[465, 140], [480, 175]],
    [[535, 140], [480, 175]],
  ];
  function drawOrgans(fs: (n: number, w?: number) => string, k: number) {
    // body outline
    ctx.fillStyle = 'rgba(230, 185, 150, 0.15)';
    ctx.strokeStyle = 'rgba(200, 145, 110, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(500, 75, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(400, 160, 200, 300, [50, 50, 25, 25]);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(330, 170, 60, 220, 25);
    ctx.roundRect(610, 170, 60, 220, 25);
    ctx.roundRect(415, 455, 75, 100, 20);
    ctx.roundRect(510, 455, 75, 100, 20);
    ctx.fill();
    ctx.stroke();
    // bone marrow in the thigh bones and sternum
    for (const x of [452, 548]) {
      ctx.fillStyle = '#efe6d2';
      ctx.fillRect(x - 9, 465, 18, 85);
      ctx.fillStyle = '#c0453c';
      ctx.fillRect(x - 4, 472, 8, 70);
    }
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(492, 190, 16, 60);
    ctx.fillStyle = '#c0453c';
    ctx.fillRect(497, 196, 6, 48);
    // blood loop
    ctx.strokeStyle = 'rgba(200, 60, 70, 0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(500, 320, 70, 150, 0, 0, Math.PI * 2);
    ctx.stroke();
    // lymphatic vessels
    ctx.strokeStyle = '#5fbf6a';
    ctx.lineWidth = 3;
    for (const path of LYMPH) {
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // thymus, spleen, tonsils, nodes
    ctx.fillStyle = '#b38bd9';
    ctx.beginPath();
    ctx.ellipse(500, 205, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8e4a6a';
    ctx.beginPath();
    ctx.ellipse(565, 290, 18, 30, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d68fb0';
    for (const x of [488, 512]) {
      ctx.beginPath();
      ctx.arc(x, 112, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y] of NODES) {
      ctx.fillStyle = '#3fae5a';
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // immune cells moving: white blood cells in the blood, lymphocytes in lymph
    for (let i = 0; i < 18; i++) {
      const a = anim * 0.9 + (i / 18) * Math.PI * 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#8e6bd8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(500 + Math.cos(a) * 70, 320 + Math.sin(a) * 150, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    LYMPH.forEach((path, j) => {
      const f = (anim * 0.25 + j * 0.17) % 1;
      const lens = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
      let d = f * lens.reduce((x, y) => x + y, 0);
      let pt = path[0];
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i]) {
          pt = [path[i][0] + ((path[i + 1][0] - path[i][0]) * d) / lens[i], path[i][1] + ((path[i + 1][1] - path[i][1]) * d) / lens[i]];
          break;
        }
        d -= lens[i];
      }
      ctx.fillStyle = '#c7f0cf';
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1 / k;
    for (const [x1, y1, x2, y2] of [
      [400, 112, 480, 112], [610, 140, 543, 140], [400, 205, 478, 205], [625, 290, 583, 290],
      [600, 380, 515, 300], [385, 510, 440, 505], [385, 330, 430, 330],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    tag('Tonsils', 370, 112, fs, k);
    tag('Lymph nodes', 650, 140, fs, k);
    tag('Thymus', 370, 205, fs, k);
    tag('Spleen', 660, 290, fs, k);
    tag('Lymphatic vessels', 650, 380, fs, k);
    tag('Bone marrow', 350, 510, fs, k);
    tag('Blood vessels', 350, 330, fs, k);
  }

  function drawInfection(fs: (n: number, w?: number) => string, k: number) {
    const inflam = clamp(s.N / (s.N + 2), 0, 1);
    // tissue
    ctx.fillStyle = `rgba(${230 + inflam * 20}, ${170 - inflam * 70}, ${160 - inflam * 70}, 0.55)`;
    ctx.fillRect(40, 110, 640, 380);
    // skin with a cut
    ctx.fillStyle = '#e7c2a2';
    ctx.fillRect(40, 70, 640, 40);
    ctx.fillStyle = '#c99a7a';
    ctx.fillRect(40, 70, 640, 8);
    if (infected) {
      ctx.fillStyle = pal['sim-bg'];
      ctx.beginPath();
      ctx.moveTo(330, 70);
      ctx.lineTo(360, 112);
      ctx.lineTo(390, 70);
      ctx.fill();
    }
    const tall = portrait();
    const [NX, NY] = tall ? [540, 630] : [860, 310];
    // lymph vessel to a lymph node (drawn under the capillary)
    ctx.strokeStyle = '#5fbf6a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(600, 300);
    if (tall) ctx.bezierCurveTo(680, 380, 640, 470, NX, NY - 40);
    else ctx.quadraticCurveTo(700, 260, 800, 300);
    ctx.stroke();
    // capillary dilates with inflammation
    const cw = 30 + inflam * 26;
    ctx.fillStyle = 'rgba(200, 50, 60, 0.75)';
    ctx.fillRect(40, 470 - cw / 2, 640, cw);
    const swell = 1 + clamp(s.E / 8, 0, 0.6);
    ctx.fillStyle = '#3fae5a';
    ctx.beginPath();
    ctx.ellipse(NX, NY, 70 * swell, 50 * swell, 0, 0, Math.PI * 2);
    ctx.fill();
    // B and T cells activated in the node
    const lymphocytes = Math.round(clamp(4 + s.E * 4, 4, 40));
    for (let i = 0; i < lymphocytes; i++) {
      const a = i * 2.4;
      const rr = Math.sqrt(i / lymphocytes) * 55 * swell;
      ctx.fillStyle = i % 2 ? '#4c8dd6' : '#e0a43a';
      ctx.beginPath();
      ctx.arc(NX + Math.cos(a) * rr, NY + Math.sin(a) * rr * 0.7, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // pathogens around the wound
    const nP = Math.round(clamp(Math.log10(s.P + 1) * 22, 0, 90));
    for (let i = 0; i < nP; i++) {
      const x = 360 + Math.cos(i * 2.39) * (20 + (i % 11) * 22) + Math.sin(anim + i) * 3;
      const y = 150 + ((i * 53) % 260) * (0.4 + (i % 5) * 0.12);
      ctx.fillStyle = st.path === 'virus' ? '#d64fb0' : '#7cb342';
      ctx.beginPath();
      if (st.path === 'virus') ctx.arc(x, y, 4, 0, Math.PI * 2);
      else ctx.ellipse(x, y, 7, 3.5, i, 0, Math.PI * 2);
      ctx.fill();
    }
    // phagocytes leave the capillary and gather at the infection
    const nN = Math.round(clamp((s.N - 0.1) * 6, 0, 22));
    for (let i = 0; i < nN; i++) {
      const progress = clamp(((anim * 0.2 + i * 0.13) % 1) * 1.4, 0, 1);
      const x = 120 + ((i * 97) % 480) * (1 - progress) + (340 + Math.cos(i) * 80) * progress;
      const y = 460 - progress * (230 + (i % 4) * 30);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = '#8e6bd8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8e6bd8';
      ctx.beginPath();
      ctx.arc(x - 3, y - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // antibodies (Y shapes)
    const nA = Math.round(clamp(s.A / 6, 0, 60));
    ctx.strokeStyle = '#4c8dd6';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < nA; i++) {
      // even scatter (R2 low-discrepancy sequence) with a gentle drift
      const x = 70 + ((0.5 + i * 0.7548777) % 1) * 580 + Math.sin(anim * 0.8 + i) * 4;
      const y = 130 + ((0.5 + i * 0.5698403) % 1) * 310 + Math.cos(anim * 0.7 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y);
      ctx.lineTo(x - 5, y - 6);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5, y - 6);
      ctx.stroke();
    }
    tag('Skin (barrier)', 160, 90, fs, k);
    tag('Capillary', 150, 470, fs, k);
    tag('Lymph node', NX, tall ? NY + 50 * swell + 16 / k : NY - 50 * swell - 16 / k, fs, k);
    if (tall) tag('Lymph vessel', 560, 400, fs, k);
    else tag('Lymph vessel', 700, 250, fs, k);
    if (!infected) tag('Press “Introduce pathogen”', 360, 280, fs, k);
    // legend
    ctx.font = fs(11, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const legend: [string, string][] = [
      [st.path === 'virus' ? '#d64fb0' : '#7cb342', st.path === 'virus' ? '● Virus' : '● Bacteria'],
      ['#8e6bd8', '● Phagocyte (innate)'],
      ['#e0a43a', '● T cell'],
      ['#4c8dd6', '● B cell    Y antibody'],
      [pal['text-faint'], `Day ${day.toFixed(1)}`],
    ];
    const [LX, LY] = tall ? [50, 540] : [730, 400];
    legend.forEach(([c, t], i) => {
      ctx.fillStyle = c;
      ctx.fillText(t, LX, LY + (i * 18) / k);
    });
    ctx.textBaseline = 'alphabetic';
  }

  let memCache: { key: string; P: Point[][]; A: Point[][] } | null = null;
  // Each exposure is followed for 40 days. The second happens months later,
  // after antibody levels have fallen but memory cells remain.
  const SPAN = 40;
  const GAP = 10;
  function memoryCurves(): { P: Point[][]; A: Point[][] } {
    const key = `${st.path}|${st.dose}`;
    if (memCache?.key === key) return memCache;
    const P: Point[][] = [[], []];
    const A: Point[][] = [[], []];
    const starts: State[] = [
      { P: st.dose, N: 0.1, S: 0, E: 0.02, A: 0 },
      { P: st.dose, N: 0.1, S: 0, E: 3, A: 0.5 },
    ];
    starts.forEach((s0, j) => {
      let next = 0;
      simulate(s0, SPAN + 0.01, st.path, j === 1, (t, x) => {
        if (t + 1e-6 < next) return;
        P[j].push({ x: t, y: x.P });
        A[j].push({ x: t, y: x.A / 5 });
        next += 0.25;
      });
    });
    memCache = { key, P, A };
    return memCache;
  }
  function drawMemory(fs: (n: number, w?: number) => string, k: number) {
    const { P, A } = memoryCurves();
    const tall = portrait();
    const X = (j: number, d: number) => (tall ? 80 + (d / SPAN) * 880 : 80 + ((j * (SPAN + GAP) + d) / (2 * SPAN + GAP)) * 880);
    const off = (j: number) => (tall ? j * 700 : 0);
    const yMax = Math.max(...A.flat().map((p) => p.y), ...P.flat().map((p) => p.y)) * 1.1;
    const Yj = (j: number, v: number) => 480 + off(j) - (v / yMax) * 380;
    ctx.lineWidth = 1 / k;
    ctx.font = fs(11, 600);
    ctx.textAlign = 'center';
    for (const j of [0, 1]) {
      for (let d = 0; d <= SPAN; d += 10) {
        ctx.strokeStyle = pal.border;
        ctx.beginPath();
        ctx.moveTo(X(j, d), 100 + off(j));
        ctx.lineTo(X(j, d), 480 + off(j));
        ctx.stroke();
        ctx.fillStyle = pal['text-faint'];
        ctx.fillText(d ? `${d}` : 'Day 0', X(j, d), 480 + off(j) + 20 / k);
      }
      ctx.fillStyle = pal['sim-text'];
      ctx.font = fs(12, 800);
      ctx.fillText(j ? 'Second exposure (immune memory)' : 'First exposure', X(j, SPAN / 2), 480 + off(j) + 42 / k);
      ctx.font = fs(11, 600);
    }
    // axis break between the two exposures
    ctx.fillStyle = pal['text-faint'];
    if (tall) {
      ctx.fillText('… months later …', 520, 480 + 70 / k);
    } else {
      ctx.fillText('months', X(0, SPAN + GAP / 2), 285);
      ctx.fillText('later', X(0, SPAN + GAP / 2), 302);
      ctx.strokeStyle = pal['text-faint'];
      ctx.beginPath();
      for (const dx of [-6, 6]) {
        const x = X(0, SPAN + GAP / 2) + dx;
        ctx.moveTo(x - 4, 490);
        ctx.lineTo(x + 4, 470);
      }
      ctx.stroke();
    }
    for (const [sets, colour] of [[P, '#7cb342'], [A, '#4c8dd6']] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 3 / k;
      for (const j of [0, 1]) {
        ctx.beginPath();
        sets[j].forEach((p, i) => (i ? ctx.lineTo(X(j, p.x), Yj(j, p.y)) : ctx.moveTo(X(j, p.x), Yj(j, p.y))));
        ctx.stroke();
      }
    }
    for (const j of [0, 1]) {
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 1.5 / k;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(X(j, 0), 100 + off(j));
      ctx.lineTo(X(j, 0), 480 + off(j));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const peak = (pts: Point[]) => pts.reduce((a, b) => (b.y > a.y ? b : a));
    const p1 = peak(A[0]);
    const p2 = peak(A[1]);
    tag('Primary: slow, small', X(0, p1.x), Yj(0, p1.y) - 18 / k, fs, k);
    tag('Secondary: fast, large', X(1, p2.x), Yj(1, p2.y) - 18 / k, fs, k);
    // legend
    ctx.font = fs(12, 800);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7cb342';
    ctx.fillText('— Pathogen', 90, 70);
    ctx.fillStyle = '#4c8dd6';
    ctx.fillText('— Antibodies', 90 + ctx.measureText('— Pathogen').width + 18 / k, 70);
    return { p1, p2, path1: peak(P[0]), path2: peak(P[1]) };
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    let mem: ReturnType<typeof drawMemory> | null = null;
    if (st.view === 'organs') drawOrgans(fs, k);
    else if (st.view === 'infection') drawInfection(fs, k);
    else mem = drawMemory(fs, k);
    ctx.restore();
    updateReadouts(mem);
    drawGraph();
  }

  function updateReadouts(mem: ReturnType<typeof drawMemory> | null) {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    if (st.view === 'organs') {
      r('r1', 'Immune organs', 'Bone marrow, thymus, spleen, lymph nodes, tonsils');
      r('r2', 'Made in', 'All white blood cells are made in the bone marrow');
      r('r3', 'T cells mature in', 'The thymus');
      r('r4', 'Lymph returns to the blood', 'Near the heart, through the subclavian veins');
      r('r5', 'Main immune cells', 'Phagocytes (innate), B cells and T cells (adaptive)');
      sim.setBadge('Immune organs');
      noteEl.textContent = 'Click any organ. White blood cells (white) circulate in the blood; lymphocytes (green) travel through the lymphatic vessels and lymph nodes.';
    } else if (st.view === 'infection') {
      const stage = !infected ? 'Healthy: skin and mucus are the first barriers' : s.P === 0 ? 'Recovered: memory cells remain' : s.E > 1 || s.A > 5 ? 'Adaptive response: antibodies and T cells' : 'Innate response: inflammation and phagocytes';
      r('r1', 'What is happening', stage, s.P === 0 && infected ? 'ok' : null);
      r('r2', 'Day', infected ? day.toFixed(1) : '—');
      r('r3', 'Pathogens', infected ? (s.P === 0 ? 'Cleared' : `${Math.round(s.P)} (relative units)`) : 'None', s.P > 100 ? 'bad' : s.P > 0 ? 'warn' : 'ok');
      r('r4', 'Antibodies', `${(s.A / 5).toFixed(1)} (relative)${memoryReady() ? ' · memory cells present' : ''}`);
      r('r5', 'Body temperature (fever)', `about ${(37 + (1.8 * Math.max(0, s.N - 0.1)) / (s.N + 1.5)).toFixed(1)} °C`);
      sim.setBadge(!infected ? 'Healthy' : s.P === 0 ? 'Recovered' : 'Infection');
      noteEl.textContent = !infected
        ? 'Skin, mucus, stomach acid and tears stop most pathogens getting in. Choose a pathogen and dose, then introduce it through a cut.'
        : s.P === 0
          ? `Cleared on day ${cleared.toFixed(1)}. Memory B and T cells remain, so the next infection with this pathogen will be fought off faster. Introduce it again to compare.`
          : s.E > 1 || s.A > 5
            ? 'Adaptive immunity: in the lymph node, B and T cells that recognise this antigen multiply. Plasma B cells release antibodies that stick to pathogens; T cells kill infected cells and coordinate the response.'
            : 'Innate immunity: damaged cells release chemicals that cause inflammation (redness, swelling, heat). Capillaries widen and phagocytes squeeze out to engulf and digest the pathogens.';
    } else if (mem) {
      const { p1, p2, path1, path2 } = mem;
      r('r1', 'Primary antibody peak', `day ${p1.x.toFixed(0)} after exposure, level ${p1.y.toFixed(0)}`);
      r('r2', 'Secondary antibody peak', `day ${p2.x.toFixed(0)} after exposure, level ${p2.y.toFixed(0)}`, 'ok');
      r('r3', 'Secondary response is', `${(p2.y / Math.max(p1.y, 0.01)).toFixed(1)} × higher and ${(p1.x - p2.x).toFixed(0)} days sooner`);
      r('r4', 'Pathogen peak (2nd vs 1st)', `${Math.round(path2.y)} vs ${Math.round(path1.y)}`);
      r('r5', 'Why', 'Memory cells are ready from the first exposure');
      sim.setBadge('Immune memory');
      noteEl.textContent = 'The first time, few B and T cells recognise the pathogen, so it takes days to multiply them. Afterwards, long-lived memory cells respond within days, often before you feel ill. Vaccines create this memory safely.';
    }
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="im-graph"]')!, { x: { min: 0, span: 30 }, y: { min: 0, max: 100, step: 20 } });
  function drawGraph() {
    graphPanel.hidden = st.view !== 'infection';
    if (st.view !== 'infection') return;
    const top = Math.max(50, ...hist.P.map((p) => p.y), ...hist.A.map((p) => p.y));
    graph.opts.x = { min: 0, span: 30, max: 30, step: 5, format: (x) => `${x} d` };
    graph.opts.y = { min: 0, max: Math.ceil(top / 50) * 50, step: Math.ceil(top / 250) * 50, format: (v) => `${v}` };
    graph.set('p', { label: 'Pathogens', color: '#7cb342', points: hist.P, width: 3 });
    graph.set('a', { label: 'Antibodies', color: '#4c8dd6', points: hist.A, width: 3 });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="im-graph"]'));
  }

  /* ---------- Interaction ---------- */
  canvas.addEventListener('click', (e) => {
    if (st.view !== 'organs') return;
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - r.left - ox) / k;
    const y = (e.clientY - r.top - oy) / k;
    let id: string | null = null;
    if (Math.hypot(x - 500, y - 205) < 22) id = 'thymus';
    else if (Math.hypot((x - 565) / 20, (y - 290) / 32) < 1) id = 'spleen';
    else if (y > 100 && y < 125 && Math.abs(x - 500) < 20) id = 'tonsils';
    else if (NODES.some(([nx, ny]) => Math.hypot(x - nx, y - ny) < 14)) id = 'nodes';
    else if ((y > 460 && (Math.abs(x - 452) < 12 || Math.abs(x - 548) < 12)) || (Math.abs(x - 500) < 10 && y > 185 && y < 255)) id = 'marrow';
    else if (LYMPH.some((p) => p.slice(1).some((b, i) => distSeg(x, y, p[i], b) < 8))) id = 'vessels';
    else if (Math.abs(Math.hypot((x - 500) / 70, (y - 320) / 150) - 1) < 0.08) id = 'blood';
    if (!id) return sim.hideTooltip();
    sim.showTooltip(e.clientX - r.left, e.clientY - r.top, INFO[id][0], INFO[id][1]);
  });
  const distSeg = (x: number, y: number, a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };

  const ui = controls(root);
  const show = (v: View) => {
    ui.showWhen('[data-only="infection"]', v !== 'organs');
    ui.showWhen('[data-only="inf-only"]', v === 'infection');
  };
  const viewCtl = ui.choice<View>('im-view', (v) => {
    st.view = v;
    show(v);
    sim.hideTooltip();
    sim.requestRender();
  });
  const pathCtl = ui.choice<Pathogen>('im-path', (v) => {
    st.path = v;
    heal();
    sim.requestRender();
  });
  const doseCtl = ui.range('im-dose', (v) => `${v}`, (v) => ((st.dose = v), sim.requestRender()));
  const memCtl = ui.toggle('im-vacc', (v) => {
    st.memory = v;
    sim.requestRender();
  });
  root.querySelector('[data-infect]')!.addEventListener('click', () => {
    if (st.view !== 'infection') viewCtl.set('infection');
    infect();
  });
  show('organs');

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { view: 'organs', path: 'bacteria', dose: 20, memory: false });
      viewCtl.set('organs', false);
      pathCtl.set('bacteria', false);
      doseCtl.set(20, false);
      memCtl.set(false, false);
      show('organs');
      heal();
    },
  });
}
