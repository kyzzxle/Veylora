/**
 * States of matter with a simplified particle model.
 *
 * 100 identical particles in a 2D box attract each other weakly when close and
 * repel strongly when they overlap (a Lennard-Jones pair potential, the
 * standard textbook model for a simple substance such as argon). A heater
 * (thermostat) nudges their average kinetic energy towards the chosen
 * temperature, and weak gravity keeps a liquid at the bottom. Nothing tells
 * the particles which state to be in: the crystal, the flowing liquid and the
 * gas all emerge from the attractions competing with thermal motion.
 *
 * Reduced units: particle diameter σ = 1, well depth ε = 1, mass = 1, so
 * temperature is in units of ε/k. Displayed temperatures are T × 100 "model
 * units". In this model the solid melts at about 35 and boils at about 70.
 * These are properties of the model, not of any real substance.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'sim-water', 'warning', 'danger', 'success'] as const;
type Fs = (px: number, w?: number) => string;
type Arr = 'solid' | 'liquid' | 'gas';
type Proc = 'melt' | 'freeze' | 'evap' | 'boil' | 'condense' | 'sublime';

const W = 26; // box width in particle diameters
const H = 18;
const N = 100;
const RC2 = 2.5 * 2.5;
const DT = 0.01;
const G = 0.05;
const TAU = 1; // thermostat time constant (model time units)
const T_MELT = 0.35; // approximate transitions in this model
const T_BOIL = 0.7;
const T_MAX = 1.6;
const DEF = { T: 0.15, speed: 3, colour: 'speed' as 'speed' | 'arrangement', bonds: true };

/** Lennard-Jones energy of one pair at squared distance r2 (clamped so overlaps cannot blow up). */
const ljForce = (r2: number) => {
  const ir2 = 1 / Math.max(r2, 0.6);
  const ir6 = ir2 * ir2 * ir2;
  return { f: 24 * ir6 * (2 * ir6 - 1) * ir2, u: 4 * ir6 * (ir6 - 1) };
};

const NOTES: Record<Proc | 'intro', string> = {
  intro:
    'Every state is made of the same particles. What changes is how fast they move compared with how strongly they attract each other. Heat the solid and watch it melt, then boil.',
  melt: 'Melting (solid → liquid). As the solid is heated, its particles vibrate harder about their fixed places until they break out of the regular pattern and start sliding past each other. They are still touching, so the liquid takes up about the same space.',
  freeze: 'Freezing (liquid → solid). As the liquid cools, particles slow down until the attractions lock them into fixed places. Real substances usually freeze into a regular crystal; fast cooling in this model can leave small defects.',
  evap: 'Evaporation (liquid → gas at the surface). Even below the boiling point, a few particles at the surface move fast enough to escape the attractions of their neighbours. Watch individual particles leave the liquid and fly around the empty space.',
  boil: 'Boiling (liquid → gas throughout). At the boiling point, particles throughout the liquid have enough energy to separate. Real boiling forms bubbles of gas inside the liquid; this small 2D model mostly shows the liquid breaking apart.',
  condense: 'Condensation (gas → liquid). As the gas cools, particles slow down. When slow particles meet, the attractions hold them together, and droplets form and run to the bottom of the container.',
  sublime:
    'Sublimation (solid → gas) skips the liquid state. It happens when the pressure is below the substance’s triple point, so the liquid cannot exist: dry ice (solid carbon dioxide) does this at normal air pressure. The reverse, gas → solid, is deposition, as when frost forms on a cold window. This 100-particle model cannot show sublimation at a realistic rate, so follow the sublimation line on the phase diagram instead.',
};

const PROCS: Record<Exclude<Proc, 'sublime'>, { from: number; to: number; secs: number }> = {
  melt: { from: 0.2, to: 0.48, secs: 10 },
  freeze: { from: 0.45, to: 0.12, secs: 8 },
  evap: { from: 0.45, to: 0.5, secs: 12 },
  boil: { from: 0.45, to: 1.1, secs: 10 },
  condense: { from: 1.2, to: 0.42, secs: 10 },
};

export function initStates(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let target = DEF.T;
  const x = new Float64Array(N);
  const y = new Float64Array(N);
  const vx = new Float64Array(N);
  const vy = new Float64Array(N);
  const fx = new Float64Array(N);
  const fy = new Float64Array(N);
  const arr: Arr[] = new Array(N).fill('solid');
  const nb = new Uint8Array(N);
  let pe = 0;
  let tNow = 0;
  let Tmeas = DEF.T;
  let peAvg = -2.7;
  let hist: Point[][] = [[], [], []];
  // position history for mobility: one snapshot every 0.25 model time units
  let snaps: Float64Array[] = [];
  let lastSnap = 0;
  let frame = 0;
  let proc: { id: Proc; phase: 'prep' | 'ramp'; t: number } | null = null;

  /* ---------- Model ---------- */
  function forces() {
    fx.fill(0);
    fy.fill(0);
    pe = 0;
    for (let i = 0; i < N; i++) {
      fy[i] -= G;
      const xi = x[i];
      const yi = y[i];
      for (let j = i + 1; j < N; j++) {
        const dx = xi - x[j];
        const dy = yi - y[j];
        const r2 = dx * dx + dy * dy;
        if (r2 > RC2) continue;
        const { f, u } = ljForce(r2);
        pe += u;
        fx[i] += f * dx;
        fy[i] += f * dy;
        fx[j] -= f * dx;
        fy[j] -= f * dy;
      }
      // soft walls half a diameter in from each side
      if (xi < 0.5) fx[i] += 60 * (0.5 - xi);
      if (xi > W - 0.5) fx[i] -= 60 * (xi - W + 0.5);
      if (yi < 0.5) fy[i] += 60 * (0.5 - yi);
      if (yi > H - 0.5) fy[i] -= 60 * (yi - H + 0.5);
    }
  }
  function gauss() {
    const u = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  }
  function crystal(T: number) {
    const a = 1.12;
    for (let n = 0; n < N; n++) {
      const r = Math.floor(n / 10);
      const c = n % 10;
      x[n] = W / 2 - 5 * a + c * a + (r % 2) * (a / 2) + 0.25;
      y[n] = 0.6 + r * a * 0.866;
      vx[n] = gauss() * Math.sqrt(T);
      vy[n] = gauss() * Math.sqrt(T);
    }
    // no overall drift
    let mx = 0;
    let my = 0;
    for (let n = 0; n < N; n++) (mx += vx[n]), (my += vy[n]);
    for (let n = 0; n < N; n++) (vx[n] -= mx / N), (vy[n] -= my / N);
    forces();
    snaps = [];
    lastSnap = tNow;
    classify();
  }
  function integrate() {
    for (let i = 0; i < N; i++) {
      vx[i] += (fx[i] * DT) / 2;
      vy[i] += (fy[i] * DT) / 2;
      x[i] += vx[i] * DT;
      y[i] += vy[i] * DT;
    }
    forces();
    let ke = 0;
    for (let i = 0; i < N; i++) {
      vx[i] += (fx[i] * DT) / 2;
      vy[i] += (fy[i] * DT) / 2;
      ke += 0.5 * (vx[i] * vx[i] + vy[i] * vy[i]);
    }
    // heater / cooler: Berendsen thermostat towards the target temperature
    const Tk = ke / N;
    const lam = Math.sqrt(Math.max(0.5, 1 + (DT / TAU) * (target / Math.max(Tk, 1e-4) - 1)));
    for (let i = 0; i < N; i++) (vx[i] *= lam), (vy[i] *= lam);
    Tmeas += (Tk - Tmeas) * 0.01;
    peAvg += (pe / N - peAvg) * 0.01;
    tNow += DT;
  }

  /**
   * Label each particle by its local arrangement:
   *  gas-like    – not part of a cluster of at least 8 touching particles
   *  solid-like  – in a cluster and has hardly moved from its place in the last 5 time units
   *  liquid-like – in a cluster but free to wander
   */
  function classify() {
    const R2 = 1.4 * 1.4;
    const adj: number[][] = Array.from({ length: N }, () => []);
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const dx = x[i] - x[j];
        const dy = y[i] - y[j];
        if (dx * dx + dy * dy < R2) adj[i].push(j), adj[j].push(i);
      }
    const comp = new Int32Array(N).fill(-1);
    const compSize: number[] = [];
    for (let i = 0; i < N; i++) {
      if (comp[i] >= 0) continue;
      const id = compSize.length;
      const stack = [i];
      comp[i] = id;
      let n = 0;
      while (stack.length) {
        const k = stack.pop()!;
        n++;
        for (const j of adj[k]) if (comp[j] < 0) (comp[j] = id), stack.push(j);
      }
      compSize.push(n);
    }
    const old = snaps.length >= 20 ? snaps[0] : null;
    for (let i = 0; i < N; i++) {
      nb[i] = adj[i].length;
      if (compSize[comp[i]] < 8) arr[i] = 'gas';
      else {
        const moved = old ? Math.hypot(x[i] - old[i], y[i] - old[i + N]) : 0;
        arr[i] = (old ? moved < 0.6 : adj[i].length >= 3) ? 'solid' : 'liquid';
      }
    }
  }
  const counts = () => {
    const c = { solid: 0, liquid: 0, gas: 0 };
    for (const a of arr) c[a]++;
    return c;
  };

  function step(dt: number) {
    const n = Math.max(1, Math.round((st.speed * dt) / DT));
    for (let i = 0; i < n; i++) integrate();
    if (tNow - lastSnap >= 0.25) {
      const s = new Float64Array(2 * N);
      s.set(x, 0);
      s.set(y, N);
      snaps.push(s);
      if (snaps.length > 20) snaps.shift();
      lastSnap = tNow;
    }
    if (++frame % 6 === 0) {
      classify();
      const c = counts();
      const tt = tNow;
      hist[0].push({ x: tt, y: c.solid });
      hist[1].push({ x: tt, y: c.liquid });
      hist[2].push({ x: tt, y: c.gas });
      for (const h of hist) while (h.length && h[0].x < tt - 120) h.shift();
    }
    runProcess(dt);
  }

  /* ---------- Guided processes ---------- */
  function runProcess(dt: number) {
    if (!proc || proc.id === 'sublime') return;
    const p = PROCS[proc.id];
    if (proc.phase === 'prep') {
      target = p.from;
      proc.t += dt;
      // wait until the temperature has settled near the starting point
      if (Math.abs(Tmeas - p.from) < 0.03 && proc.t > 2) (proc.phase = 'ramp'), (proc.t = 0);
    } else {
      proc.t += dt;
      const f = clamp(proc.t / p.secs, 0, 1);
      target = p.from + (p.to - p.from) * f;
      if (f >= 1) {
        sim.announce(`${procName(proc.id)} demonstration finished.`);
        proc = null;
      }
    }
    tempCtl.set(Math.round(target * 100), false);
  }
  const procName = (id: Proc) => ({ melt: 'Melting', freeze: 'Freezing', evap: 'Evaporation', boil: 'Boiling', condense: 'Condensation', sublime: 'Sublimation' })[id];
  function startProcess(id: Proc) {
    noteEl.textContent = NOTES[id];
    highlight = id === 'sublime' ? 'sublime' : null;
    root.querySelectorAll<HTMLButtonElement>('[data-proc]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.proc === id)));
    if (id === 'sublime') {
      proc = { id, phase: 'ramp', t: 0 };
      sim.requestRender();
      return;
    }
    const p = PROCS[id];
    // start from the right state: a fresh crystal for melting, otherwise let the model settle at the start temperature
    if (id === 'melt' && counts().solid < 70) crystal(p.from);
    if (id === 'condense' && counts().gas < 70) target = p.from;
    proc = { id, phase: 'prep', t: 0 };
    target = p.from;
    tempCtl.set(Math.round(p.from * 100), false);
    if (!sim.running) sim.play();
  }
  function stopProcess() {
    proc = null;
    highlight = null;
    root.querySelectorAll<HTMLButtonElement>('[data-proc]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }
  let highlight: 'sublime' | null = null;

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1062] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  const cont = () => (portrait() ? { x: 20, y: 52, s: 640 / W } : { x: 20, y: 78, s: 620 / W });
  const thermo = () => (portrait() ? { x: 44, y: 560, h: 210 } : { x: 684, y: 70, h: 150 });
  const energy = () => (portrait() ? { x: 110, y: 548, w: 550 } : { x: 732, y: 62, w: 255 });
  const diag = () => (portrait() ? { x: 100, y: 772, w: 565, h: 285 } : { x: 668, y: 300, w: 325, h: 292 });
  const diagT = (T: number) => {
    // map model temperature onto the schematic diagram so the dot crosses the
    // melting line (u ≈ 0.295) and the boiling line (u ≈ 0.585) at the model's transitions
    const d = diag();
    const u = T <= T_MELT ? (0.295 * T) / T_MELT : T <= T_BOIL ? 0.295 + (0.29 * (T - T_MELT)) / (T_BOIL - T_MELT) : 0.585 + (0.37 * (T - T_BOIL)) / (T_MAX - T_BOIL);
    return d.x + 30 + clamp(u, 0, 0.98) * (d.w - 40);
  };

  interface Hit {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let hits: Hit[] = [];

  function tag(text: string, cx: number, cy: number, fs: Fs, k: number, align: 'center' | 'left' = 'center', bg?: string) {
    ctx.font = fs(11, 700);
    const tw = ctx.measureText(text).width;
    const ph = 20 / k;
    const x0 = align === 'center' ? cx - tw / 2 - 7 / k : cx;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = bg ?? pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(x0, cy - ph / 2, tw + 14 / k, ph, ph / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + 7 / k, cy + 1 / k);
    ctx.textBaseline = 'alphabetic';
  }

  const speedColour = (v: number) => {
    const f = clamp(v / 2.2, 0, 1);
    return `hsl(${Math.round(225 - 220 * f)}, 80%, ${Math.round(52 + 4 * f)}%)`;
  };
  const arrColour = (a: Arr) => (a === 'solid' ? pal['sim-water'] : a === 'liquid' ? pal.accent : pal.warning);

  /* ---------- Drawing ---------- */
  function drawContainer(fs: Fs, k: number) {
    const c = cont();
    const cw = W * c.s;
    const ch = H * c.s;
    // heater plate under the container: colour shows heating or cooling
    const heating = target - Tmeas;
    const band = 0.03 + 0.06 * target; // ignore normal temperature fluctuations
    const mode = heating > band ? 'Heating' : heating < -band ? 'Cooling' : 'Holding temperature';
    ctx.fillStyle = mode === 'Heating' ? pal.danger : mode === 'Cooling' ? pal['sim-water'] : pal['border-strong'];
    ctx.globalAlpha = 0.8;
    ctx.fillRect(c.x - 6, c.y + ch + 6, cw + 12, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['text-faint'];
    ctx.font = fs(11, 600);
    ctx.textAlign = 'right';
    ctx.fillText(mode, c.x + cw, c.y + ch + 18 + 14 / k);
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 3;
    ctx.strokeRect(c.x - 3, c.y - 3, cw + 6, ch + 6);
    // attractions between touching particles
    if (st.bonds) {
      ctx.strokeStyle = pal['text-faint'];
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5 / k;
      ctx.beginPath();
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          const dx = x[i] - x[j];
          const dy = y[i] - y[j];
          if (dx * dx + dy * dy < 1.35 * 1.35) {
            ctx.moveTo(c.x + x[i] * c.s, c.y + (H - y[i]) * c.s);
            ctx.lineTo(c.x + x[j] * c.s, c.y + (H - y[j]) * c.s);
          }
        }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const r = 0.47 * c.s;
    for (let i = 0; i < N; i++) {
      const px = c.x + x[i] * c.s;
      const py = c.y + (H - y[i]) * c.s;
      ctx.fillStyle = st.colour === 'speed' ? speedColour(Math.hypot(vx[i], vy[i])) : arrColour(arr[i]);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      if (picked === i) {
        ctx.strokeStyle = pal['sim-text'];
        ctx.lineWidth = 2.5 / k;
        ctx.stroke();
      }
    }
    tag('Simplified particle model', c.x - 3, c.y - 8 - 12 / k, fs, k, 'left');
    hits.push({
      test: (px, py) => px > c.x && px < c.x + cw && py > c.y && py < c.y + ch,
      title: 'The container',
      text: () => 'Each circle stands for one particle (an atom or molecule). Lines join particles close enough to attract each other strongly. Click a particle to inspect it.',
    });
  }

  function drawThermo(fs: Fs, k: number) {
    const t = thermo();
    const w = 22;
    const frac = clamp(Tmeas / T_MAX, 0, 1);
    ctx.fillStyle = pal.border;
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, w, t.h, w / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(t.x + w / 2, t.y + t.h + 10, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    ctx.arc(t.x + w / 2, t.y + t.h + 10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(t.x + 6, t.y + t.h * (1 - frac), w - 12, t.h * frac + 6);
    // target marker
    const ty = t.y + t.h * (1 - clamp(target / T_MAX, 0, 1));
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.moveTo(t.x + w, ty);
    ctx.lineTo(t.x + w + 8, ty);
    ctx.stroke();
    // marks where this model melts and boils
    ctx.font = fs(9.5, 600);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const T of [T_MELT, T_BOIL]) {
      const yy = t.y + t.h * (1 - T / T_MAX);
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1.5 / k;
      ctx.beginPath();
      ctx.moveTo(t.x, yy);
      ctx.lineTo(t.x + 7, yy);
      ctx.stroke();
      ctx.fillStyle = pal['text-faint'];
      ctx.fillText(String(Math.round(T * 100)), t.x - 4 / k, yy);
    }
    ctx.textBaseline = 'alphabetic';
    hits.push({
      test: (px, py) => px > t.x - 10 && px < t.x + w + 10 && py > t.y && py < t.y + t.h + 30,
      title: 'Thermometer',
      text: () => `Temperature measures the average kinetic (motion) energy of the particles: now ${Math.round(Tmeas * 100)} model units. The black tick is the heater setting. In this model the solid melts at about 35 and the liquid boils at about 70 units.`,
    });
  }

  function drawEnergy(fs: Fs, k: number) {
    const e = energy();
    const ke = Tmeas; // per particle (2D: kT)
    const sep = clamp((peAvg + 2.75) / 2.75, 0, 1); // 0 for a cold crystal, 1 when attractions are fully overcome
    const rows: [string, number, string, string][] = [
      ['Motion energy', ke / T_MAX, pal.danger, 'Kinetic energy: the faster the particles move, the higher the temperature.'],
      ['Separation energy', sep, pal.accent, 'Energy stored by pulling particles away from the neighbours that attract them. It jumps during melting and especially during boiling, while the motion energy hardly changes.'],
    ];
    ctx.textAlign = 'left';
    const row = 36 / k;
    rows.forEach(([label, v, c, text], i) => {
      const yy = e.y + i * row;
      ctx.font = fs(11, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(label, e.x, yy + 11 / k);
      ctx.fillStyle = pal.border;
      ctx.fillRect(e.x, yy + 16 / k, e.w, 9 / k);
      ctx.fillStyle = c;
      ctx.fillRect(e.x, yy + 16 / k, e.w * clamp(v, 0, 1), 9 / k);
      hits.push({ test: (px, py) => px > e.x && px < e.x + e.w && py > yy && py < yy + row, title: label, text: () => text });
    });
    // share of particles in each arrangement; the title doubles as the colour key
    const c = counts();
    const yy = e.y + 2 * row;
    const parts: [Arr, string][] = [['solid', 'Solid'], ['liquid', 'Liquid'], ['gas', 'Gas']];
    ctx.font = fs(11, 700);
    let lx = e.x;
    for (const [a, label] of parts) {
      ctx.fillStyle = arrColour(a);
      ctx.fillText(label, lx, yy + 11 / k);
      lx += ctx.measureText(label).width + 10 / k;
    }
    ctx.fillStyle = pal['text-faint'];
    ctx.font = fs(10, 600);
    ctx.fillText('-like', lx - 8 / k, yy + 11 / k);
    let x0 = e.x;
    for (const [a] of parts) {
      const w = (e.w * c[a]) / N;
      ctx.fillStyle = arrColour(a);
      ctx.fillRect(x0, yy + 16 / k, w, 9 / k);
      x0 += w;
    }
    hits.push({
      test: (px, py) => px > e.x && px < e.x + e.w && py > yy && py < yy + row,
      title: 'Particles in each arrangement',
      text: () =>
        `Solid-like ${c.solid}%, liquid-like ${c.liquid}%, gas-like ${c.gas}%. Solid-like: held in one place by its neighbours. Liquid-like: touching others but moving around. Gas-like: on its own, far from the rest. During melting or boiling, two kinds exist at once.`,
    });
  }

  function drawDiagram(fs: Fs, k: number) {
    const d = diag();
    const x0 = d.x + 30;
    const y0 = d.y + 34 / k;
    const w = d.w - 40;
    const h = d.h - 34 / k - 24 / k;
    const X = (u: number) => x0 + u * w;
    const Y = (v: number) => y0 + (1 - v) * h;
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText('Phase diagram (schematic)', d.x, d.y + 11 / k);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('Red dot ≈ the model', d.x, d.y + 25 / k);
    // axes
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y0 + h);
    ctx.lineTo(x0 + w, y0 + h);
    ctx.stroke();
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    ctx.fillText('Temperature →', x0 + w / 2, y0 + h + 16 / k);
    ctx.save();
    ctx.translate(x0 - 12 / k, y0 + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Pressure →', 0, 0);
    ctx.restore();
    // curves: triple point TP, critical point CP
    const tp: [number, number] = [0.28, 0.3];
    const cp: [number, number] = [0.86, 0.86];
    const sub: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const u = (tp[0] * i) / 20;
      sub.push([u, tp[1] * Math.pow(u / tp[0], 3)]);
    }
    const vap: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const f = i / 20;
      vap.push([tp[0] + (cp[0] - tp[0]) * f, tp[1] + (cp[1] - tp[1]) * Math.pow(f, 1.6)]);
    }
    const line = (pts: [number, number][], hl: boolean) => {
      ctx.strokeStyle = hl ? pal.warning : pal['sim-text'];
      ctx.lineWidth = (hl ? 4 : 2) / k;
      ctx.beginPath();
      pts.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
      ctx.stroke();
    };
    line(sub, highlight === 'sublime');
    line(vap, false);
    line([tp, [0.33, 1]], false);
    ctx.fillStyle = pal['sim-text'];
    for (const p of [tp, cp]) {
      ctx.beginPath();
      ctx.arc(X(p[0]), Y(p[1]), 3.5 / k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-water'];
    ctx.fillText('Solid', X(0.13), Y(0.62));
    ctx.fillStyle = pal.accent;
    ctx.fillText('Liquid', X(0.55), Y(0.82));
    ctx.fillStyle = pal.warning;
    ctx.fillText('Gas', X(0.7), Y(0.22));
    // normal pressure line and the model's position
    const pN = 0.5;
    ctx.strokeStyle = pal['text-faint'];
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2 / k;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(pN));
    ctx.lineTo(X(1), Y(pN));
    ctx.stroke();
    ctx.setLineDash([]);
    const dx = diagT(Tmeas);
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    ctx.arc(dx, Y(pN), 6.5 / k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal['bg-elev'];
    ctx.lineWidth = 2 / k;
    ctx.stroke();
    if (highlight === 'sublime') {
      // a low-pressure path that crosses the sublimation line
      const pL = 0.12;
      ctx.strokeStyle = pal.warning;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      ctx.moveTo(X(0.05), Y(pL));
      ctx.lineTo(X(0.5), Y(pL));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = fs(9.5, 700);
      ctx.fillStyle = pal.warning;
      ctx.textAlign = 'left';
      ctx.fillText('low pressure: solid → gas', X(0.02), Y(pL) + 14 / k);
    }
    // hit areas
    const near = (pts: [number, number][], px: number, py: number) => pts.some(([u, v]) => Math.hypot(X(u) - px, Y(v) - py) < 12);
    hits.push(
      { test: (px, py) => px > x0 && px < x0 + w && py > y0 && py < y0 + h, title: 'Phase diagram', text: () => 'A phase diagram shows which state a substance is in at each temperature and pressure. The dashed line is normal air pressure; the red dot shows roughly where the model is. The exact lines are different for every substance.' },
      { test: (px, py) => near([[0.3, 0.6], [0.31, 0.75], [0.32, 0.9]], px, py), title: 'Melting / freezing line', text: () => 'Crossing this line to the right is melting; crossing it to the left is freezing.' },
      { test: (px, py) => near(vap, px, py), title: 'Boiling / condensation line', text: () => 'Crossing this line to the right is boiling; crossing it to the left is condensation. It ends at the critical point, beyond which liquid and gas can no longer be told apart.' },
      { test: (px, py) => near(sub, px, py), title: 'Sublimation / deposition line', text: () => 'Below the triple point pressure, a solid turns straight into a gas when heated (sublimation), and a gas turns straight into a solid when cooled (deposition).' },
      { test: (px, py) => Math.hypot(X(tp[0]) - px, Y(tp[1]) - py) < 10, title: 'Triple point', text: () => 'The one temperature and pressure where solid, liquid and gas can all exist together. For water it is 0.01 °C at about 0.6% of normal air pressure.' },
    );
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    hits = [];
    if (hintEl) hintEl.style.display = portrait() ? 'none' : '';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    drawContainer(fs, k);
    drawThermo(fs, k);
    drawEnergy(fs, k);
    drawDiagram(fs, k);
    ctx.restore();
    updateReadouts();
    drawGraph();
  }

  function stateText() {
    const c = counts();
    if (c.solid >= 70) return c.gas >= 3 ? 'Solid (a few particles escaping)' : 'Solid';
    if (c.gas >= 75) return 'Gas';
    if (c.liquid >= 55 && c.solid < 15) return c.gas >= 4 ? 'Liquid, with some gas above it' : 'Liquid';
    if (c.solid >= 15 && c.liquid >= 15) return 'Solid and liquid (melting or freezing)';
    if (c.gas >= 20 && c.liquid + c.solid >= 20) return 'Liquid and gas (boiling or condensing)';
    return 'Mixture';
  }
  function updateReadouts() {
    let sp = 0;
    for (let i = 0; i < N; i++) sp += Math.hypot(vx[i], vy[i]);
    // average nearest-neighbour distance, in particle diameters
    let nn = 0;
    for (let i = 0; i < N; i++) {
      let best = 1e9;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const d = (x[i] - x[j]) ** 2 + (y[i] - y[j]) ** 2;
        if (d < best) best = d;
      }
      nn += Math.sqrt(best);
    }
    const s = stateText();
    ui.readout('state', s);
    ui.readout('temp', `${Math.round(Tmeas * 100)} model units (heater ${Math.round(target * 100)})`);
    ui.readout('speed', `${(sp / N).toFixed(2)} diameters per time unit`);
    ui.readout('space', `${(nn / N).toFixed(2)} particle diameters`);
    let cl = 0;
    let cn = 0;
    for (let i = 0; i < N; i++) if (arr[i] !== 'gas') (cl += nb[i]), cn++;
    ui.readout('touch', cn ? `${(cl / cn).toFixed(1)} (in the solid or liquid)` : 'None: all particles are separate');
    sim.setBadge(s.split(' (')[0].split(',')[0]);
    canvas.setAttribute('aria-label', `Particle model of a simple substance at ${Math.round(Tmeas * 100)} model units of temperature. State: ${s}. ${counts().solid} particles are solid-like, ${counts().liquid} liquid-like and ${counts().gas} gas-like.`);
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="som-graph"]')!, { x: { min: 0, span: 60 }, y: { min: 0, max: 100, step: 25 } });
  function drawGraph() {
    const tMax = Math.max(60, tNow);
    graph.opts.x = { min: Math.max(0, tMax - 120), span: 60, max: Math.max(tMax, 60), step: 20, format: (v) => `${Math.round(v)}` };
    graph.opts.y = { min: 0, max: 100, step: 25, format: (v) => `${v}%` };
    graph.set('s', { label: 'Solid-like', color: 'sim-water', points: hist[0], width: 2.2 });
    graph.set('l', { label: 'Liquid-like', color: 'accent', points: hist[1], width: 2.2 });
    graph.set('g', { label: 'Gas-like', color: 'warning', points: hist[2], width: 2.2 });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="som-graph"]'));
  }

  /* ---------- Clicks ---------- */
  let picked = -1;
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const px = (e.clientX - rect.left - ox) / k;
    const py = (e.clientY - rect.top - oy) / k;
    const c = cont();
    let best = -1;
    let bd = 0.9 * c.s;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(c.x + x[i] * c.s - px, c.y + (H - y[i]) * c.s - py);
      if (d < bd) (bd = d), (best = i);
    }
    picked = best;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (best >= 0) {
      const v = Math.hypot(vx[best], vy[best]);
      const a = arr[best];
      const avg = Math.sqrt(2 * Math.max(Tmeas, 0.01));
      sim.showTooltip(
        sx,
        sy,
        `Particle (${a === 'solid' ? 'solid-like' : a === 'liquid' ? 'liquid-like' : 'gas-like'})`,
        `Speed ${v.toFixed(2)} diameters per time unit (${v > avg * 1.3 ? 'faster than' : v < avg * 0.7 ? 'slower than' : 'close to'} the typical speed at this temperature). Close neighbours: ${nb[best]}. ${a === 'solid' ? 'It vibrates about a fixed place.' : a === 'liquid' ? 'It touches its neighbours but can slide past them.' : 'It is far from the others and moves freely until it hits something.'} Particles at the same temperature have a range of speeds.`,
      );
    } else {
      const hit = [...hits].reverse().find((h) => h.test(px, py));
      if (hit) sim.showTooltip(sx, sy, hit.title, hit.text());
      else sim.hideTooltip();
    }
    sim.requestRender();
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const tempCtl = ui.range('som-temp', (v) => `${v} model units`, (v) => {
    stopProcess();
    target = v / 100;
    noteEl.textContent = v / 100 < T_MELT - 0.05 ? 'Cold: the particles only vibrate about fixed places. Raise the temperature past about 35 to melt the solid.' : v / 100 < T_BOIL - 0.05 ? 'In this range the model is a liquid: particles stay close together but slide around. A few fast ones escape from the surface (evaporation).' : 'Hot: most particles have enough energy to escape their neighbours completely, so the substance becomes a gas that fills the container.';
    if (!sim.running) sim.play();
    sim.requestRender();
  });
  const speedCtl = ui.range('som-speed', (v) => (v <= 1 ? 'Slow' : v >= 6 ? 'Fast' : `${v}×`), (v) => (st.speed = v));
  const colourCtl = ui.choice<'speed' | 'arrangement'>('som-colour', (v) => {
    st.colour = v;
    root.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => (el.hidden = el.dataset.key !== v));
    sim.requestRender();
  });
  const bondsCtl = ui.toggle('som-bonds', (v) => ((st.bonds = v), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-state]').forEach((b) =>
    b.addEventListener('click', () => {
      const s = b.dataset.state as Arr;
      stopProcess();
      const T = s === 'solid' ? 0.15 : s === 'liquid' ? 0.45 : 1.2;
      if (s === 'solid' && counts().solid < 70) crystal(T);
      target = T;
      tempCtl.set(Math.round(T * 100), false);
      noteEl.textContent =
        s === 'solid'
          ? 'Solid: particles are packed closely in a regular pattern. They vibrate about fixed places, so a solid keeps its own shape and volume.'
          : s === 'liquid'
            ? 'Liquid: particles are still close together, but they move past each other. A liquid flows and takes the shape of the bottom of its container, but keeps its volume.'
            : 'Gas: particles are far apart and move quickly in all directions until they hit another particle or the walls. A gas spreads out to fill its whole container.';
      if (!sim.running) sim.play();
      sim.requestRender();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-proc]').forEach((b) => b.addEventListener('click', () => startProcess(b.dataset.proc as Proc)));

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      stopProcess();
      target = DEF.T;
      tempCtl.set(Math.round(DEF.T * 100), false);
      speedCtl.set(DEF.speed, false);
      colourCtl.set('speed', true);
      bondsCtl.set(true, false);
      tNow = 0;
      Tmeas = DEF.T;
      peAvg = -2.7;
      hist = [[], [], []];
      picked = -1;
      crystal(DEF.T);
      noteEl.textContent = NOTES.intro;
    },
  });
  crystal(DEF.T);
  noteEl.textContent = NOTES.intro;
}
