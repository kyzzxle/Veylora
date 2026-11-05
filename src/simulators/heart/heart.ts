/**
 * Heart and double circulation.
 *
 * A schematic front view (the patient's right side is on the viewer's left).
 * Blood cells move around one closed loop:
 *   body → vena cava → right atrium → right ventricle → pulmonary artery →
 *   lungs → pulmonary veins → left atrium → left ventricle → aorta → body
 *
 * The cardiac cycle (atrial systole 12 %, ventricular systole 38 %, diastole
 * 50 % of each beat) opens and closes the four valves. A cell may not pass a
 * closed valve, so blood collects in the atria and veins while the valves are
 * shut, then surges through when they open. Each cell has an "ideal" position
 * that moves steadily, and catches up to it at up to three times normal speed,
 * so the queues clear every beat.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border-strong', 'accent', 'warning'] as const;
const DEF = { hr: 72, sv: 70, slow: false, labels: true, trace: true };
const BW = 1000;
const BH = 620;
const N_CELLS = 90;
const OXY = '#d83a3a';
const DEOXY = '#4a68d6';

type Pt = [number, number];
type Region = 'body' | 'vc' | 'ra' | 'rv' | 'pa' | 'lungs' | 'pvein' | 'la' | 'lv' | 'aorta';
type ValveId = 'tricuspid' | 'pulmonary' | 'mitral' | 'aortic';

const REGION_NAME: Record<Region, string> = {
  body: 'Body capillaries',
  vc: 'Vena cava',
  ra: 'Right atrium',
  rv: 'Right ventricle',
  pa: 'Pulmonary artery',
  lungs: 'Lung capillaries',
  pvein: 'Pulmonary vein',
  la: 'Left atrium',
  lv: 'Left ventricle',
  aorta: 'Aorta',
};

const INFO: Record<string, [string, string]> = {
  ra: ['Right atrium', 'Receives deoxygenated blood from the body through the venae cavae.'],
  rv: ['Right ventricle', 'Pumps deoxygenated blood to the lungs through the pulmonary artery.'],
  la: ['Left atrium', 'Receives oxygenated blood from the lungs through the pulmonary veins.'],
  lv: ['Left ventricle', 'The strongest chamber. Its thick muscular wall pumps oxygenated blood to the whole body through the aorta.'],
  septum: ['Septum', 'A wall of muscle that keeps oxygenated and deoxygenated blood apart.'],
  tricuspid: ['Tricuspid valve', 'Between the right atrium and right ventricle. It shuts when the ventricle contracts so blood cannot flow back.'],
  mitral: ['Mitral (bicuspid) valve', 'Between the left atrium and left ventricle. It shuts when the ventricle contracts so blood cannot flow back.'],
  pulmonary: ['Pulmonary valve', 'Opens as the right ventricle contracts and shuts afterwards so blood cannot flow back from the pulmonary artery.'],
  aortic: ['Aortic valve', 'Opens as the left ventricle contracts and shuts afterwards so blood cannot flow back from the aorta.'],
  vc: ['Vena cava', 'The largest veins. They carry deoxygenated blood from the body back to the right atrium.'],
  pa: ['Pulmonary artery', 'Carries deoxygenated blood to the lungs: the only artery in an adult that carries deoxygenated blood.'],
  pvein: ['Pulmonary veins', 'Carry oxygenated blood from the lungs to the left atrium.'],
  aorta: ['Aorta', 'The largest artery. It carries oxygenated blood from the left ventricle to the body.'],
  lungs: ['Lung capillaries', 'Blood picks up oxygen and gives up carbon dioxide (the pulmonary circuit).'],
  body: ['Body tissues', 'Cells take oxygen from the blood and add carbon dioxide (the systemic circuit).'],
};

/* ---------- Geometry (design box 1000 × 620) ---------- */
const CH = {
  ra: { x: 360, y: 228, w: 112, h: 94 },
  la: { x: 528, y: 228, w: 112, h: 94 },
  rv: { x: 360, y: 330, w: 134, h: 142 },
  lv: { x: 506, y: 330, w: 134, h: 152 },
} as const;

// The loop, starting at the body capillaries. Tagged points start a new region or mark a valve.
const LOOP: [number, number, Region?, ValveId?][] = [
  [780, 565, 'body'],
  [300, 565, 'vc'],
  [300, 275],
  [360, 275, 'ra'],
  [415, 280],
  [415, 326, 'rv', 'tricuspid'],
  [428, 420],
  [470, 380],
  [490, 326, 'pa', 'pulmonary'],
  [490, 150],
  [300, 150],
  [300, 72, 'lungs'],
  [700, 72, 'pvein'],
  [700, 275],
  [640, 275, 'la'],
  [585, 280],
  [585, 326, 'lv', 'mitral'],
  [570, 440],
  [600, 425],
  [640, 425, 'aorta', 'aortic'],
  [780, 425],
  [780, 565],
];

interface Seg {
  a: Pt;
  b: Pt;
  s0: number;
  len: number;
}
const segs: Seg[] = [];
let total = 0;
for (let i = 0; i < LOOP.length - 1; i++) {
  const a: Pt = [LOOP[i][0], LOOP[i][1]];
  const b: Pt = [LOOP[i + 1][0], LOOP[i + 1][1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  segs.push({ a, b, s0: total, len });
  total += len;
}
// Fractions along the loop where each region starts and each valve sits
const regionStarts: [number, Region][] = [];
const valveAt = {} as Record<ValveId, number>;
LOOP.forEach((p, i) => {
  const s = i < segs.length ? segs[i].s0 / total : 1;
  if (p[2]) regionStarts.push([s, p[2]]);
  if (p[3]) valveAt[p[3]] = s;
});
const regionOf = (s: number): Region => {
  let r: Region = 'body';
  for (const [s0, reg] of regionStarts) if (s >= s0) r = reg;
  return r;
};
const regionSpan = (reg: Region): [number, number] => {
  const i = regionStarts.findIndex(([, r]) => r === reg);
  return [regionStarts[i][0], i + 1 < regionStarts.length ? regionStarts[i + 1][0] : 1];
};
const pointAt = (s: number): Pt => {
  const d = (((s % 1) + 1) % 1) * total;
  const seg = segs.find((g) => d <= g.s0 + g.len) ?? segs[segs.length - 1];
  const t = seg.len ? (d - seg.s0) / seg.len : 0;
  return [seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t];
};
/** Oxygen level 0–1 along the loop: rises in the lungs, falls in the body. */
const oxygenAt = (s: number) => {
  const [l0, l1] = regionSpan('lungs');
  const [b0, b1] = regionSpan('body');
  if (s >= b0 && s < b1) return 1 - clamp((s - b0) / ((b1 - b0) * 0.6), 0, 1);
  if (s >= l0 && s < l1) return clamp((s - l0) / ((l1 - l0) * 0.5), 0, 1);
  return s > l1 ? 1 : 0;
};
const mix = (t: number) => {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(c(DEOXY, i) + (c(OXY, i) - c(DEOXY, i)) * t)).join(',')})`;
};

/* Valves: centre, direction along the valve opening, direction of flow, half-width */
const VALVES: Record<ValveId, { c: Pt; along: Pt; flow: Pt; hw: number; av: boolean }> = {
  tricuspid: { c: [415, 326], along: [1, 0], flow: [0, 1], hw: 34, av: true },
  mitral: { c: [585, 326], along: [1, 0], flow: [0, 1], hw: 34, av: true },
  pulmonary: { c: [490, 326], along: [1, 0], flow: [0, -1], hw: 15, av: false },
  aortic: { c: [640, 425], along: [0, 1], flow: [1, 0], hw: 15, av: false },
};

const VESSELS: { id: string; pts: Pt[]; oxy: boolean }[] = [
  { id: 'vc', pts: [[300, 565], [300, 275], [360, 275]], oxy: false },
  { id: 'pa', pts: [[490, 326], [490, 150], [300, 150], [300, 72]], oxy: false },
  { id: 'pvein', pts: [[700, 72], [700, 275], [640, 275]], oxy: true },
  { id: 'aorta', pts: [[640, 425], [780, 425], [780, 565]], oxy: true },
];

/** Cardiac cycle phase fraction (0–1) → which phase. */
const phaseOf = (f: number) => (f < 0.12 ? 'as' : f < 0.5 ? 'vs' : 'd');
const PHASE_TEXT = {
  as: ['Atrial systole', 'The atria contract and top up the ventricles. Tricuspid and mitral valves are open.'],
  vs: ['Ventricular systole', 'The ventricles contract. Tricuspid and mitral valves snap shut (“lub”); blood is pushed out through the pulmonary and aortic valves.'],
  d: ['Diastole', 'The heart muscle relaxes. The pulmonary and aortic valves shut (“dub”) and the chambers fill with blood from the veins.'],
} as const;

export function initHeart(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { ...DEF };
  let time = 0;
  let beatPhase = 0; // 0–1 within the current beat
  let beats = 0;
  let cells: { ideal: number; pos: number }[] = [];
  const open: Record<ValveId, number> = { tricuspid: 1, mitral: 1, pulmonary: 0, aortic: 0 };
  let sound = { text: '', t: 9 };

  function restart() {
    time = 0;
    beatPhase = 0.6;
    beats = 0;
    cells = Array.from({ length: N_CELLS }, (_, i) => ({ ideal: i / N_CELLS, pos: i / N_CELLS }));
    sound = { text: '', t: 9 };
  }

  const valveOpen = (v: ValveId) => {
    const f = beatPhase;
    return VALVES[v].av ? f < 0.12 || f >= 0.5 : f >= 0.15 && f < 0.47;
  };

  /* ---------- Model ---------- */
  function step(dtReal: number) {
    const dt = dtReal * (p.slow ? 0.3 : 1);
    time += dt;
    const period = 60 / p.hr;
    const before = beatPhase;
    beatPhase += dt / period;
    if (beatPhase >= 1) {
      beatPhase -= 1;
      beats++;
    }
    if (before < 0.12 && beatPhase >= 0.12) sound = { text: 'LUB', t: 0 };
    if (before < 0.47 && beatPhase >= 0.47) sound = { text: 'DUB', t: 0 };
    sound.t += dt;

    for (const v of Object.keys(open) as ValveId[]) {
      const target = valveOpen(v) ? 1 : 0;
      open[v] += (target - open[v]) * Math.min(1, dt * 25);
    }

    // A cell takes about 8 beats to go once round the whole loop (real blood: about a minute)
    const v = 1 / (8 * period);
    const queued: Record<ValveId, number> = { tricuspid: 0, mitral: 0, pulmonary: 0, aortic: 0 };
    // Front-most cells first, so queues stack up behind a closed valve
    const order = [...cells].sort((a, b) => b.pos - a.pos);
    for (const c of order) {
      c.ideal += v * dt;
      let next = Math.min(c.ideal, c.pos + v * 3 * dt);
      next = Math.max(next, c.pos);
      for (const id of Object.keys(VALVES) as ValveId[]) {
        if (valveOpen(id)) continue;
        const sv = valveAt[id];
        const crossing = sv + Math.floor(c.pos - sv) + 1; // next time this cell would reach the valve
        if (next >= crossing - 0.002) {
          next = Math.max(c.pos, crossing - 0.004 - queued[id] * 0.006);
          queued[id]++;
        }
      }
      c.pos = next;
    }
  }

  /* ---------- Drawing helpers ---------- */
  const tf = () => {
    const k = Math.min(size.w / BW, size.h / BH);
    return { k, ox: (size.w - BW * k) / 2, oy: (size.h - BH * k) / 2 };
  };

  function chamberScale(id: keyof typeof CH) {
    const f = beatPhase;
    const atrium = id === 'ra' || id === 'la';
    if (atrium && f < 0.12) return 1 - 0.08 * Math.sin((Math.PI * f) / 0.12);
    if (!atrium && f >= 0.12 && f < 0.5) return 1 - 0.1 * Math.sin((Math.PI * (f - 0.12)) / 0.38);
    return 1;
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const small = k < 0.55;

    // Lungs and body capillary beds
    const bed = (x: number, y: number, bw: number, bh: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, 30);
      ctx.fill();
    };
    bed(250, 22, 500, 100, 'rgba(240, 150, 165, 0.22)');
    bed(250, 520, 580, 90, 'rgba(240, 190, 140, 0.2)');
    // alveoli bubbles
    ctx.strokeStyle = 'rgba(220, 120, 140, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(290 + i * 28, 40 + (i % 2) * 12, 9, 0, Math.PI * 2);
      ctx.arc(290 + i * 28, 104 - (i % 2) * 10, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Vessels (thick tubes), coloured by the blood they carry
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const ves of VESSELS) {
      ctx.strokeStyle = ves.oxy ? 'rgba(216, 58, 58, 0.28)' : 'rgba(74, 104, 214, 0.28)';
      ctx.lineWidth = 26;
      ctx.beginPath();
      ves.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // Capillary paths
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(160, 90, 160, 0.25)';
    ctx.beginPath();
    ctx.moveTo(300, 72);
    ctx.lineTo(700, 72);
    ctx.moveTo(780, 565);
    ctx.lineTo(300, 565);
    ctx.stroke();

    // Heart muscle outline behind the chambers
    ctx.fillStyle = 'rgba(190, 70, 80, 0.16)';
    ctx.beginPath();
    ctx.roundRect(345, 214, 310, 284, 60);
    ctx.fill();

    // Chambers
    for (const id of ['ra', 'la', 'rv', 'lv'] as const) {
      const c = CH[id];
      const s = chamberScale(id);
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const cw = c.w * s;
      const chh = c.h * s;
      const oxy = id === 'la' || id === 'lv';
      ctx.fillStyle = oxy ? 'rgba(216, 58, 58, 0.16)' : 'rgba(74, 104, 214, 0.16)';
      ctx.strokeStyle = '#b5485a';
      ctx.lineWidth = id === 'lv' ? 12 : id === 'rv' ? 6 : 4;
      ctx.beginPath();
      ctx.roundRect(cx - cw / 2, cy - chh / 2, cw, chh, 20);
      ctx.fill();
      ctx.stroke();
    }
    // Septum
    ctx.fillStyle = '#b5485a';
    ctx.fillRect(496, 338, 8, 136);

    // Blood cells
    for (const c of cells) {
      const s = ((c.pos % 1) + 1) % 1;
      const [x, y] = pointAt(s);
      ctx.fillStyle = mix(oxygenAt(s));
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.trace) {
      const s = ((cells[0].pos % 1) + 1) % 1;
      const [x, y] = pointAt(s);
      ctx.strokeStyle = pal.warning;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Valves: two flaps each
    for (const id of Object.keys(VALVES) as ValveId[]) {
      const v = VALVES[id];
      const o = open[id];
      ctx.strokeStyle = valveOpen(id) ? '#f2f2f2' : '#ffd166';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const hx = v.c[0] + v.along[0] * v.hw * side;
        const hy = v.c[1] + v.along[1] * v.hw * side;
        // closed: tip meets at the centre; open: swung along the flow
        const tx = hx + (v.c[0] - hx) * (1 - o) * 0.95 + v.flow[0] * v.hw * 0.85 * o;
        const ty = hy + (v.c[1] - hy) * (1 - o) * 0.95 + v.flow[1] * v.hw * 0.85 * o;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }

    // Heart sound
    if (sound.t < 0.35 && sound.text) {
      ctx.globalAlpha = 1 - sound.t / 0.35;
      ctx.fillStyle = pal.accent;
      ctx.font = font(34, 800);
      ctx.textAlign = 'center';
      ctx.fillText(sound.text, 890, 330);
      ctx.globalAlpha = 1;
    }

    // Labels
    if (p.labels) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tag = (text: string, x: number, y: number) => {
        ctx.font = font(12.5 / k, 700); // constant on-screen size
        const tw = ctx.measureText(text).width;
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = pal['bg-elev'];
        ctx.beginPath();
        const ph = 22 / k;
        ctx.roundRect(x - tw / 2 - 7 / k, y - ph / 2, tw + 14 / k, ph, ph / 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal['sim-text'];
        ctx.fillText(text, x, y + 1);
      };
      tag(small ? 'RA' : 'Right atrium', 416, 250);
      tag(small ? 'LA' : 'Left atrium', 584, 250);
      tag(small ? 'RV' : 'Right ventricle', 428, 455);
      tag(small ? 'LV' : 'Left ventricle', 573, 462);
      tag('Lungs', 500, 22);
      tag(small ? 'Body' : 'Body tissues', 540, 600);
      if (!small) {
        tag('Vena cava', 240, 420);
        tag('Pulmonary artery', 395, 175);
        tag('Pulmonary vein', 790, 180);
        tag('Aorta', 840, 470);
        ctx.font = font(12 / k, 650);
        ctx.fillStyle = pal['text-faint'];
        ctx.fillText('Pulmonary circuit', 125, 50);
        ctx.fillText('(to the lungs)', 125, 50 + 17 / k);
        ctx.fillText('Systemic circuit', 905, 545);
        ctx.fillText('(to the body)', 905, 545 + 17 / k);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Phase timeline (left side, clear of the badge)
    const tx = 30;
    const ty = 200;
    const tw = 200;
    const parts: [number, number, string][] = [[0, 0.12, 'A'], [0.12, 0.5, 'Pump'], [0.5, 1, 'Relax']];
    ctx.font = font(11 / k, 650);
    for (const [a, b, name] of parts) {
      const active = beatPhase >= a && beatPhase < b;
      ctx.fillStyle = active ? pal.accent : pal['border-strong'];
      ctx.globalAlpha = active ? 0.9 : 0.4;
      ctx.fillRect(tx + a * tw + 1, ty, (b - a) * tw - 2, 18);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal['sim-text'];
      if (name !== 'A') ctx.fillText(name, tx + a * tw + 4, ty + 18 + 14 / k);
    }
    ctx.fillStyle = pal['sim-text'];
    ctx.fillRect(tx + beatPhase * tw - 1.5, ty - 5, 3, 28);
    ctx.font = font(11 / k, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('One heartbeat', tx, ty - 12);

    ctx.restore();
    updateReadouts();
    sim.setTime(time);
  }

  function updateReadouts() {
    const ph = phaseOf(beatPhase);
    ui.readout('phase', PHASE_TEXT[ph][0]);
    sim.setBadge(PHASE_TEXT[ph][0]);
    phaseText.textContent = PHASE_TEXT[ph][1];
    ui.readout('hr', `${p.hr} beats per minute`);
    const co = (p.hr * p.sv) / 1000;
    ui.readout('co', `${co.toFixed(1)} L per minute`, co > 12 ? 'warn' : null);
    ui.readout('cell', p.trace ? REGION_NAME[regionOf(((cells[0].pos % 1) + 1) % 1)] : 'Tracking off');
    ui.readout('beats', `${beats}`);
  }

  /* ---------- Click to inspect ---------- */
  const distSeg = (x: number, y: number, a: Pt, b: Pt) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - r.left - ox) / k;
    const y = (e.clientY - r.top - oy) / k;
    let id: string | null = null;
    for (const v of Object.keys(VALVES) as ValveId[]) if (Math.hypot(x - VALVES[v].c[0], y - VALVES[v].c[1]) < VALVES[v].hw * 0.7 + 8) id = v;
    if (!id && x > 492 && x < 508 && y > 336 && y < 476) id = 'septum';
    if (!id) for (const c of ['ra', 'la', 'rv', 'lv'] as const) if (x >= CH[c].x && x <= CH[c].x + CH[c].w && y >= CH[c].y && y <= CH[c].y + CH[c].h) id = c;
    if (!id) for (const v of VESSELS) for (let i = 0; i < v.pts.length - 1; i++) if (distSeg(x, y, v.pts[i], v.pts[i + 1]) < 16) id = v.id;
    if (!id && x > 250 && x < 750 && y > 22 && y < 122) id = 'lungs';
    if (!id && x > 250 && x < 830 && y > 520 && y < 610) id = 'body';
    if (!id) return sim.hideTooltip();
    const [name, about] = INFO[id];
    let extra = '';
    if (id in VALVES) extra = valveOpen(id as ValveId) ? ' It is open right now.' : ' It is shut right now.';
    sim.showTooltip(e.clientX - r.left, e.clientY - r.top, name, about + extra);
  });

  /* ---------- Controls ---------- */
  const phaseText = root.querySelector<HTMLElement>('[data-phase-text]')!;
  const ui = controls(root);
  const hr = ui.range('ht-hr', (v) => `${v} bpm`, (v) => ((p.hr = v), sim.requestRender()));
  const sv = ui.range('ht-sv', (v) => `${v} mL`, (v) => ((p.sv = v), sim.requestRender()));
  const slow = ui.toggle('ht-slow', (v) => (p.slow = v));
  const labels = ui.toggle('ht-labels', (v) => ((p.labels = v), sim.requestRender()));
  const trace = ui.toggle('ht-trace', (v) => ((p.trace = v), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((b) =>
    b.addEventListener('click', () => {
      const [h, s] = b.dataset.scenario!.split(',').map(Number);
      hr.set(h);
      sv.set(s);
    }),
  );

  restart();
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(p, DEF);
      hr.set(DEF.hr, false);
      sv.set(DEF.sv, false);
      slow.set(DEF.slow, false);
      labels.set(DEF.labels, false);
      trace.set(DEF.trace, false);
      restart();
    },
  });
}
