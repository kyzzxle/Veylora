/**
 * Cosmic expansion and redshift.
 *
 * Expansion history: a flat universe with matter and dark energy (ΛCDM) with
 * H₀ = 70 km/s/Mpc, Ωm = 0.3, ΩΛ = 0.7, for which the scale factor has the
 * exact form  a(t) = (Ωm/ΩΛ)^⅓ · sinh^⅔(1.5 √ΩΛ H₀ t),  a(today) = 1
 * (age ≈ 13.5 billion years; radiation is neglected). Units: billion years and
 * billion light-years, so c = 1.
 *
 * Light reaching us today from a galaxy at comoving distance χ left it at the
 * time t_e where ∫ c dt / a(t) from t_e to now equals χ. While travelling,
 * the light's wavelength stretches in step with space:
 *     λ(t) = λ_emitted · a(t) / a(t_e),   so   1 + z = 1 / a(t_e).
 * The photon's comoving distance from us at time t is the same integral from
 * t to now, so its proper distance is a(t) times that.
 *
 * Comparison mode: a galaxy moving through non-expanding space with the
 * relativistic Doppler shift 1 + z = √((1 + β)/(1 − β)); its light is shifted
 * once, at emission, and then keeps the same wavelength.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'sim-water'] as const;
type Fs = (px: number, w?: number) => string;
type Mode = 'expand' | 'doppler';
type Line = 'lya' | 'hb' | 'ha';

const H0 = 70 / 977.8; // per billion years
const OM = 0.3;
const OL = 0.7;
const A0 = Math.pow(OM / OL, 1 / 3);
const K = 1.5 * Math.sqrt(OL) * H0;
const aOf = (t: number) => A0 * Math.pow(Math.sinh(K * t), 2 / 3);
const T0 = Math.asinh(Math.sqrt(OL / OM)) / K; // age today ≈ 13.5 Gyr
const LINES: Record<Line, { name: string; nm: number }> = {
  lya: { name: 'Lyman-alpha (hydrogen)', nm: 121.6 },
  hb: { name: 'H-beta (hydrogen)', nm: 486.1 },
  ha: { name: 'H-alpha (hydrogen)', nm: 656.3 },
};
const DEF = { mode: 'expand' as Mode, chi: 10, line: 'ha' as Line, speed: 1 };

// Table of χ(t) = ∫ₜ^T0 dt / a  (comoving distance light travels from t to today)
const N = 4000;
const TT: number[] = [];
const CHI: number[] = [];
(() => {
  for (let i = 0; i <= N; i++) TT.push(T0 * Math.pow(i / N, 3) + 1e-6);
  const c = new Array(N + 1).fill(0);
  for (let i = N - 1; i >= 0; i--) c[i] = c[i + 1] + ((TT[i + 1] - TT[i]) * (1 / aOf(TT[i]) + 1 / aOf(TT[i + 1]))) / 2;
  CHI.push(...c);
})();
/** Comoving distance light covers between time t and today. */
function chiOf(t: number) {
  if (t >= T0) return 0;
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (TT[m] <= t) lo = m;
    else hi = m;
  }
  const f = (t - TT[lo]) / (TT[hi] - TT[lo]);
  return CHI[lo] + (CHI[hi] - CHI[lo]) * f;
}
/** Emission time for light arriving today from comoving distance χ. */
function emitTime(chi: number) {
  let lo = 1e-6;
  let hi = T0;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (chiOf(m) > chi) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
export const zOf = (chi: number) => 1 / aOf(emitTime(chi)) - 1;

/** Approximate visible colour for a wavelength in nm (outside 380–750 nm: null). */
function nmColour(nm: number): string | null {
  if (nm < 380 || nm > 750) return null;
  const stops: [number, [number, number, number]][] = [
    [380, [110, 0, 160]],
    [440, [40, 60, 255]],
    [490, [0, 200, 255]],
    [530, [40, 220, 60]],
    [580, [255, 230, 0]],
    [620, [255, 120, 0]],
    [700, [230, 20, 20]],
    [750, [140, 0, 0]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (nm <= stops[i][0]) {
      const [w0, c0] = stops[i - 1];
      const [w1, c1] = stops[i];
      const f = (nm - w0) / (w1 - w0);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * f)).join(',')})`;
    }
  }
  return null;
}
const band = (nm: number) => (nm < 380 ? 'ultraviolet' : nm > 750 ? 'infrared' : 'visible');

export function initExpansion(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let prog = 0; // 0 = light just emitted, 1 = arrives today

  /* ---------- Derived quantities ---------- */
  const tE = () => emitTime(st.chi);
  const aE = () => aOf(tE());
  const zFinal = () => 1 / aE() - 1;
  const beta = () => {
    const s = Math.pow(1 + zFinal(), 2);
    return (s - 1) / (s + 1);
  };
  /** Model time now (billion years after the Big Bang) during the animation. */
  const tNow = () => (st.mode === 'expand' ? tE() + (T0 - tE()) * prog : 0);
  const aNow = () => (st.mode === 'expand' ? aOf(tNow()) : 1);
  const zSoFar = () => (st.mode === 'expand' ? aNow() / aE() - 1 : zFinal());
  const lam0 = () => LINES[st.line].nm;
  const lamNow = () => lam0() * (1 + zSoFar());

  /* ---------- Background galaxies (fixed comoving positions) ---------- */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const galaxies = Array.from({ length: 70 }, () => ({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, r: 2 + rnd() * 3, tilt: rnd() * Math.PI, hue: rnd() }));

  /* ---------- Time ---------- */
  function step(dt: number) {
    prog = Math.min(1, prog + (dt * st.speed) / 9);
    progCtl.set(Math.round(prog * 100), false);
    if (prog >= 1) {
      sim.pause();
      sim.announce(`The light has arrived. Redshift z = ${zFinal().toFixed(2)}.`);
    }
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1105] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  type Rect = { x: number; y: number; w: number; h: number };
  const spaceR = (): Rect => (portrait() ? { x: 0, y: 0, w: 680, h: 470 } : { x: 0, y: 0, w: 640, h: 440 });
  const infoR = (): Rect => (portrait() ? { x: 24, y: 495, w: 632, h: 300 } : { x: 655, y: 82, w: 330, h: 360 });
  const specR = (): Rect => (portrait() ? { x: 0, y: 925, w: 680, h: 180 } : { x: 0, y: 445, w: 1000, h: 155 });

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];

  function galaxy(x: number, y: number, r: number, tilt: number, hue: number, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
    g.addColorStop(0, `hsla(${40 + hue * 200}, 80%, 85%, 1)`);
    g.addColorStop(1, `hsla(${40 + hue * 200}, 70%, 60%, 0)`);
    ctx.fillStyle = g;
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  /** Draw a wave packet centred at (x, y), travelling along angle `ang`, with on-screen wavelength `wl`. */
  function wave(x: number, y: number, ang: number, wl: number, colour: string, k: number) {
    const cycles = 3;
    const len = wl * cycles;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3 / k;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const u = -len / 2 + (len * i) / 120;
      const env = Math.sin((Math.PI * i) / 120);
      const yy = Math.sin((2 * Math.PI * u) / wl) * 12 * env;
      if (i) ctx.lineTo(u, yy);
      else ctx.moveTo(u, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSpace(fs: Fs, k: number) {
    const r = spaceR();
    const cx = r.x + r.w * 0.78;
    const cy = r.y + r.h * 0.55;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const expand = st.mode === 'expand';
    const span = r.w * 0.66; // on-screen distance to the source today
    // px per billion light-years; in the comparison mode leave room for the galaxy's motion during the journey
    const s = expand ? span / st.chi : span / (st.chi * (1 + beta()));
    const a = aNow();
    // comoving grid, stretched by the scale factor
    const g = st.chi / 3;
    ctx.strokeStyle = 'rgba(120, 150, 220, 0.18)';
    ctx.lineWidth = 1 / k;
    ctx.beginPath();
    for (let i = -12; i <= 12; i++) {
      const p = i * g * a * s;
      ctx.moveTo(cx + p, r.y);
      ctx.lineTo(cx + p, r.y + r.h);
      ctx.moveTo(r.x, cy + p);
      ctx.lineTo(r.x + r.w, cy + p);
    }
    ctx.stroke();
    // background galaxies keep fixed grid positions: their separations grow with the grid
    for (const gal of galaxies) galaxy(cx + gal.x * st.chi * 1.6 * a * s, cy + gal.y * st.chi * 1.6 * a * s, gal.r, gal.tilt, gal.hue, 0.8);
    // the source galaxy and the light
    let srcX: number;
    let phX: number;
    if (expand) {
      srcX = cx - st.chi * a * s;
      // the light's remaining comoving distance from us is ∫ dt/a from now until today
      phX = cx - chiOf(tNow()) * a * s;
    } else {
      // moving through non-expanding space: the galaxy recedes at β c; the light moves at c
      const travel = st.chi; // billion years (static space)
      const time = travel * prog;
      srcX = cx - (st.chi + beta() * time) * s;
      phX = cx - (st.chi - time) * s;
    }
    galaxy(srcX, cy, 9, 0.4, 0.15, 1);
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = '#ffd8a8';
    ctx.textAlign = 'center';
    ctx.fillText('distant galaxy', srcX, cy + 32);
    // our galaxy
    galaxy(cx, cy, 11, -0.3, 0.55, 1);
    ctx.fillStyle = '#a5d8ff';
    ctx.fillText('us (Milky Way)', cx, cy + 34);
    const wlPx = 10 * (1 + zSoFar());
    const col = nmColour(lamNow()) ?? (lamNow() > 750 ? '#8c1c1c' : '#7048e8');
    if (prog < 1 || st.mode === 'doppler') wave(Math.min(phX, cx - 14), cy, 0, Math.min(wlPx, 160), col, k);
    else wave(cx - wlPx * 1.6, cy, 0, Math.min(wlPx, 160), col, k);
    if (!expand) {
      // arrow showing the galaxy's motion through space
      ctx.strokeStyle = '#ffd8a8';
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      ctx.moveTo(srcX - 14, cy - 22);
      ctx.lineTo(srcX - 54, cy - 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(srcX - 54, cy - 22);
      ctx.lineTo(srcX - 46, cy - 27);
      ctx.lineTo(srcX - 46, cy - 17);
      ctx.fill();
      ctx.fillStyle = '#ffd8a8';
      ctx.fillText(`moving at ${beta().toFixed(2)} c`, srcX - 34, cy - 30);
    }
    ctx.restore();
    ctx.font = fs(11, 700);
    ctx.fillStyle = '#c9d2e8';
    ctx.textAlign = 'left';
    const short = portrait();
    ctx.fillText(expand ? (short ? 'Expanding space' : 'Expanding space: the grid and the light wave stretch together') : short ? 'Moving through space' : 'Moving through space: the grid does not stretch', r.x + 14, r.y + 22);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = '#8f9bb8';
    ctx.fillText(short ? 'Not to scale · galaxies drawn much larger' : 'Not to scale · galaxies drawn much larger · wave length on screen ∝ 1 + z', r.x + 14, r.y + r.h - 12);
    areas.push(
      { test: (x, y) => Math.hypot(x - srcX, y - cy) < 26, title: 'The distant galaxy', text: () => (expand ? `It is not moving through space: it stays at its place on the grid. The grid itself grows, carrying it away from us. Today it is ${st.chi.toFixed(1)} billion light-years away; when the light left it was only ${(st.chi * aE()).toFixed(1)} billion light-years away.` : `In this comparison the galaxy is moving away through ordinary, non-expanding space at ${beta().toFixed(2)} times the speed of light. Its light is Doppler shifted once, when it is emitted.`) },
      { test: (x, y) => Math.abs(x - phX) < 50 && Math.abs(y - cy) < 24, title: 'The light wave', text: () => (expand ? `Emitted at ${lam0()} nm. So far the universe has grown ${(aNow() / aE()).toFixed(2)} times since the light left, so its wavelength is now ${lamNow().toFixed(0)} nm. It keeps stretching until it reaches us.` : `Already stretched to ${lamNow().toFixed(0)} nm when it left the moving galaxy. In non-expanding space it keeps the same wavelength all the way to us.`) },
      { test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: expand ? 'Expanding space' : 'Non-expanding space', text: () => (expand ? 'The grid marks fixed positions in space (comoving coordinates). As the universe expands, all the grid squares grow, so every galaxy gets farther from every other. Galaxies themselves, stars and atoms do not expand: gravity and other forces hold them together.' : 'Here space does not expand. The distant galaxy itself moves away through it, like a train leaving a station.') },
    );
  }

  function drawInfo(fs: Fs, k: number) {
    const r = infoR();
    let y = r.y;
    const line = (label: string, value: string, colour?: string) => {
      ctx.font = fs(10, 650);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'left';
      ctx.fillText(label, r.x, y);
      ctx.font = fs(14, 700);
      ctx.fillStyle = colour ?? pal['sim-text'];
      ctx.fillText(value, r.x, y + 20 / k);
      y += 46 / k;
    };
    if (st.mode === 'expand') {
      line('Time since the Big Bang', `${tNow().toFixed(2)} billion years`);
      line('Size of the universe (compared with today)', `${(aNow() * 100).toFixed(1)}%`);
      line('Growth since the light left', `× ${(aNow() / aE()).toFixed(2)}  →  z = ${zSoFar().toFixed(2)}`, pal.warning);
    } else {
      line('Galaxy’s speed through space', `${beta().toFixed(3)} × speed of light`);
      line('Doppler shift (fixed at emission)', `z = ${zFinal().toFixed(2)}`, pal.warning);
    }
    line('Wavelength', `${lam0().toFixed(1)} nm → ${lamNow().toFixed(0)} nm (${band(lamNow())})`);
    // wavelength ruler: emitted vs now
    const w0 = 18;
    const w1 = Math.min(r.w - 10, w0 * (1 + zSoFar()));
    ctx.fillStyle = pal['text-muted'];
    ctx.fillRect(r.x, y - 8 / k, w0, 6);
    ctx.fillStyle = pal.warning;
    ctx.fillRect(r.x, y + 4, w1, 6);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText(w1 >= r.w - 10 ? 'emitted / now (bar clipped)' : 'emitted / now', r.x, y + 26);
  }

  function drawSpectrum(fs: Fs, k: number) {
    const r = specR();
    const x0 = r.x + 104;
    const x1 = r.x + r.w - 20;
    const L0 = Math.log10(80);
    const L1 = Math.log10(9000);
    const X = (nm: number) => x0 + ((Math.log10(clamp(nm, 80, 9000)) - L0) / (L1 - L0)) * (x1 - x0);
    const rows: [string, number, number][] = [
      ['Emitted', 1, r.y + 34],
      ['Observed', 1 + zSoFar(), r.y + 34 + 46 / k],
    ];
    for (const [label, f, yy] of rows) {
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'right';
      ctx.fillText(label, x0 - 10, yy + 12);
      ctx.fillStyle = '#0b0f1c';
      ctx.fillRect(x0, yy, x1 - x0, 18);
      // visible band
      for (let nm = 380; nm < 750; nm += 5) {
        ctx.fillStyle = nmColour(nm)!;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(X(nm), yy, X(nm + 5) - X(nm) + 0.5, 18);
      }
      ctx.globalAlpha = 1;
      for (const [id, l] of Object.entries(LINES)) {
        const nm = l.nm * f;
        if (nm > 9000) continue;
        ctx.fillStyle = id === st.line ? '#ffffff' : 'rgba(255,255,255,0.55)';
        ctx.fillRect(X(nm) - (id === st.line ? 1.5 : 1), yy - 3, id === st.line ? 3 : 2, 24);
      }
    }
    // axis
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    const ty = r.y + 34 + 46 / k + 36 + 4 / k;
    for (const nm of [100, 200, 500, 1000, 2000, 5000]) ctx.fillText(nm >= 1000 ? `${nm / 1000} µm` : `${nm} nm`, X(nm), ty);
    ctx.fillText('ultraviolet', (X(80) + X(380)) / 2, r.y + 22);
    ctx.fillText('visible', (X(380) + X(750)) / 2, r.y + 22);
    ctx.fillText('infrared', (X(750) + X(9000)) / 2, r.y + 22);
    areas.push({ test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: 'Spectrum', text: () => `White marks are three hydrogen lines: Lyman-alpha (121.6 nm), H-beta (486.1 nm) and H-alpha (656.3 nm). Redshift multiplies every wavelength by the same factor, 1 + z = ${(1 + zSoFar()).toFixed(2)}, so the whole pattern slides towards the red and infrared. The scale is logarithmic.` });
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
    if (hintEl) hintEl.style.display = 'none';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    drawSpace(fs, k);
    drawInfo(fs, k);
    drawSpectrum(fs, k);
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts and graph ---------- */
  let lastNote = '';
  let graphKey = '';
  function updateUi() {
    const z = zFinal();
    ui.readout('z', `z = ${z.toFixed(2)} (wavelengths × ${(1 + z).toFixed(2)})`);
    ui.readout('travel', `${(T0 - tE()).toFixed(2)} billion years`);
    ui.readout('then', `${tE().toFixed(2)} billion years after the Big Bang`);
    ui.readout('dist', `${(st.chi * aE()).toFixed(2)} → ${st.chi.toFixed(1)} billion light-years`);
    ui.readout('rec', `${(H0 * st.chi).toFixed(2)} × the speed of light`, H0 * st.chi > 1 ? 'warn' : null);
    sim.setBadge(prog >= 1 ? 'Light arrived' : prog === 0 ? 'Light just emitted' : 'Light travelling');
    let note: string;
    if (st.mode === 'doppler') note = `Motion through space: a galaxy rushing away at ${beta().toFixed(2)}c would give the same redshift by the Doppler effect, but the stretch happens once, at emission. Cosmological redshift is different: the wave stretches gradually, all the way, as space expands. Astronomers can tell the two apart because only expansion explains why redshift grows smoothly with distance in every direction.`;
    else if (st.chi < 1.5) note = `Nearby galaxy: the light took only ${(T0 - tE()).toFixed(2)} billion years, the universe grew only ${((1 / aE() - 1) * 100).toFixed(1)}% meanwhile, and the redshift is small. At small distances redshift is roughly proportional to distance (Hubble’s law).`;
    else note = `The light left when the universe was ${(aE() * 100).toFixed(0)}% of its present size. Space has since stretched by ${(1 / aE()).toFixed(2)} times, and so has the light’s wavelength: z = ${z.toFixed(2)}. The farther away a galaxy is, the longer its light travels and the more the universe expands meanwhile.`;
    if (note !== lastNote) noteEl.textContent = lastNote = note;
    canvas.setAttribute('aria-label', `${st.mode === 'expand' ? 'Expanding' : 'Non-expanding'} space with light travelling from a galaxy now ${st.chi.toFixed(1)} billion light-years away. Redshift so far ${zSoFar().toFixed(2)}; final redshift ${z.toFixed(2)}.`);
    const key = `${st.chi}`;
    if (key !== graphKey) (graphKey = key), drawGraph();
  }
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ex-graph"]')!, { x: { min: 0, span: 32 }, y: { min: 0, max: 12, step: 2 } });
  function drawGraph() {
    const curve: Point[] = [];
    for (let d = 0; d <= 32; d += 0.25) curve.push({ x: d, y: zOf(d) });
    const hubble: Point[] = [
      { x: 0, y: 0 },
      { x: 12, y: H0 * 12 },
    ];
    graph.opts = { x: { min: 0, span: 32, max: 32, step: 4, format: (v) => `${v} Gly` }, y: { min: 0, max: 12, step: 2, format: (v) => `${v}` } };
    graph.set('c', { label: 'Redshift z for galaxies at each distance today (ΛCDM model)', color: 'accent', points: curve, width: 2.4 });
    graph.set('h', { label: 'Hubble’s law straight line (good only when z is small)', color: 'text-faint', points: hubble, width: 1.5, dash: [6, 4] });
    graph.set('p', { label: 'Your galaxy', color: 'danger', points: [{ x: st.chi, y: zFinal() }], type: 'points' });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="ex-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const chiCtl = ui.range('ex-dist', (v) => `${v.toFixed(1)} Gly · z = ${zOf(v).toFixed(2)}`, (v) => {
    st.chi = v;
    prog = 0;
    progCtl.set(0, false);
    sim.pause();
    sim.requestRender();
  });
  ui.presets('ex-dist', chiCtl);
  const modeCtl = ui.choice<Mode>('ex-mode', (v) => {
    st.mode = v;
    prog = 0;
    progCtl.set(0, false);
    sim.pause();
    sim.requestRender();
  });
  const lineCtl = ui.choice<Line>('ex-line', (v) => ((st.line = v), sim.requestRender()));
  const speedCtl = ui.range('ex-speed', (v) => `${v}×`, (v) => (st.speed = v));
  const progCtl = ui.range('ex-prog', (v) => `${v}% of the journey`, (v) => ((prog = v / 100), sim.pause(), sim.requestRender()));

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(on) {
      if (on && prog >= 1) prog = 0;
    },
    reset() {
      Object.assign(st, DEF);
      chiCtl.set(DEF.chi, false);
      modeCtl.set(DEF.mode, false);
      lineCtl.set(DEF.line, false);
      speedCtl.set(DEF.speed, false);
      prog = 0;
      progCtl.set(0, false);
    },
  });
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const a = areas.find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });
}
