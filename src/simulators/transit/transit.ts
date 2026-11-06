/**
 * Exoplanets and the transit method.
 *
 * Units: distances in stellar radii (R*) unless stated. Period from Kepler's
 * third law, P[years] = √(a[AU]³ / M*[M☉]). For a circular orbit with
 * inclination i, at orbital angle θ from mid-transit the planet's projected
 * position on the sky is x = a sin θ, y = a cos i cos θ; it is in front of
 * the star when cos θ > 0.
 *
 * The fraction of starlight blocked is found by integrating the stellar
 * surface brightness (linear limb darkening, I(r) = 1 − u(1 − √(1 − r²)),
 * u = 0.6) over the planet's disc, sampled with 400 points. Depth ≈ (Rp/R*)².
 * Transit duration T = (P/π) asin(√((1 + k)² − b²) / (a sin i)), with
 * impact parameter b = a cos i and k = Rp/R*. Geometric transit
 * probability ≈ R* ÷ a.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'sim-water'] as const;
type Fs = (px: number, w?: number) => string;
type StarId = 'sun' | 'red' | 'hot';
type Noise = 'none' | 'space' | 'ground';

const DEG = Math.PI / 180;
const R_SUN_KM = 695700;
const AU_KM = 149.6e6;
const R_EARTH_KM = 6371;
const U = 0.6;
const STARS: Record<StarId, { name: string; R: number; M: number; colour: string; glow: string }> = {
  sun: { name: 'Sun-like star', R: 1, M: 1, colour: '#ffd56b', glow: '#ffb020' },
  red: { name: 'Red dwarf', R: 0.3, M: 0.3, colour: '#ff8a5c', glow: '#e8590c' },
  hot: { name: 'Hotter, larger star', R: 1.6, M: 1.5, colour: '#e6efff', glow: '#9ec5ff' },
};
const NOISE: Record<Noise, number> = { none: 0, space: 0.0001, ground: 0.002 };
const DEF = { star: 'sun' as StarId, rp: 11, loga: Math.log10(0.05), inc: 90, noise: 'none' as Noise, speed: 1 };

// sunflower sample of the unit disc (equal-area points)
const SAMPLES: [number, number][] = Array.from({ length: 400 }, (_, i) => {
  const r = Math.sqrt((i + 0.5) / 400);
  const t = i * 2.399963;
  return [r * Math.cos(t), r * Math.sin(t)];
});
const intensity = (r2: number) => (r2 >= 1 ? 0 : 1 - U * (1 - Math.sqrt(1 - r2)));
const F_TOTAL = Math.PI * (1 - U / 3);

/** Fraction of the star's light blocked by a planet of radius k (in R*) whose centre is d from the star's centre. */
function blocked(d: number, k: number) {
  if (d >= 1 + k) return 0;
  let s = 0;
  for (const [px, py] of SAMPLES) {
    const x = d + px * k;
    const y = py * k;
    s += intensity(x * x + y * y);
  }
  return ((s / SAMPLES.length) * Math.PI * k * k) / F_TOTAL;
}

export function initTransit(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let tH = -12; // hours since mid-transit
  let noiseSeed = 1;

  /* ---------- Physics ---------- */
  const star = () => STARS[st.star];
  const aAU = () => Math.pow(10, st.loga);
  const aR = () => (aAU() * AU_KM) / (star().R * R_SUN_KM); // a in stellar radii
  const k = () => (st.rp * R_EARTH_KM) / (star().R * R_SUN_KM); // Rp / R*
  const periodH = () => Math.sqrt(Math.pow(aAU(), 3) / star().M) * 365.25 * 24;
  const b = () => aR() * Math.cos(st.inc * DEG);
  const transits = () => b() < 1 + k();
  const duration = () => {
    const x = Math.pow(1 + k(), 2) - b() * b();
    if (x <= 0) return 0;
    return (periodH() / Math.PI) * Math.asin(clamp(Math.sqrt(x) / (aR() * Math.sin(st.inc * DEG)), 0, 1));
  };
  const pos = (t: number) => {
    const th = (2 * Math.PI * t) / periodH();
    return { x: aR() * Math.sin(th), y: aR() * Math.cos(st.inc * DEG) * Math.cos(th), front: Math.cos(th) > 0, th };
  };
  const flux = (t: number) => {
    const p = pos(t);
    return p.front ? 1 - blocked(Math.hypot(p.x, p.y), k()) : 1;
  };
  const depth = () => (transits() ? 1 - flux(0) : 0);
  let rand = 1;
  const gauss = () => {
    // deterministic noise so the curve does not flicker between frames
    rand = (rand * 16807) % 2147483647;
    const u1 = rand / 2147483647;
    rand = (rand * 16807) % 2147483647;
    const u2 = rand / 2147483647;
    return Math.sqrt(-2 * Math.log(u1 + 1e-12)) * Math.cos(2 * Math.PI * u2);
  };

  /* ---------- Time ---------- */
  function step(dt: number) {
    const P = periodH();
    const T = Math.max(duration(), 1);
    // normally one orbit per 10 s; near the star, slow down so a transit lasts about 4 s on screen
    const p = pos(tH);
    const near = p.front && Math.abs(p.x) < 1.6 + k();
    const rate = near ? Math.min(P / 10, T / 4) : P / 10;
    // never jump past the start of the slow window in one fast step
    const tWin = (-Math.asin(Math.min(1, (1.6 + k()) / aR())) / (2 * Math.PI)) * P;
    const next = tH + dt * rate * st.speed;
    tH = tH < tWin && next > tWin && !near ? tWin + 1e-6 : next;
    if (tH > P / 2) tH -= P;
    slowEl.hidden = !(near && rate < P / 10);
  }
  const slowEl = root.querySelector<HTMLElement>('[data-slow]')!;

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1060] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const kk = Math.min(size.w / bw, size.h / bh);
    return { k: kk, ox: (size.w - bw * kk) / 2 - bx * kk, oy: (size.h - bh * kk) / 2 - by * kk };
  };
  type Rect = { x: number; y: number; w: number; h: number };
  const skyR = (): Rect => (portrait() ? { x: 0, y: 0, w: 680, h: 380 } : { x: 0, y: 0, w: 580, h: 360 });
  const curveR = (): Rect => (portrait() ? { x: 0, y: 385, w: 680, h: 300 } : { x: 0, y: 365, w: 580, h: 235 });
  const topR = (): Rect => (portrait() ? { x: 0, y: 690, w: 340, h: 370 } : { x: 590, y: 40, w: 410, h: 270 });
  const sideR = (): Rect => (portrait() ? { x: 340, y: 690, w: 340, h: 370 } : { x: 590, y: 315, w: 410, h: 285 });

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];
  function title(text: string, r: Rect, fs: Fs) {
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['text-muted'];
    ctx.textAlign = 'left';
    ctx.fillText(text, r.x + 14, r.y + 20);
  }
  function starDisc(x: number, y: number, r: number) {
    const s = star();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    // limb darkening: the edge is dimmer than the centre
    g.addColorStop(0, s.colour);
    g.addColorStop(0.75, s.colour);
    g.addColorStop(1, s.glow);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- Telescope view ---------- */
  function drawSky(fs: Fs, kk: number) {
    const r = skyR();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 10;
    const RS = Math.min(r.w, r.h) * 0.32;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // a few background stars
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) ctx.fillRect(r.x + ((i * 97) % r.w), r.y + ((i * 53) % r.h), 1.5, 1.5);
    const p = pos(tH);
    // the planet's path across the sky (dashed)
    ctx.strokeStyle = 'rgba(200, 210, 240, 0.35)';
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.2 / kk;
    ctx.beginPath();
    const yPath = cy + b() * RS;
    ctx.moveTo(r.x, yPath);
    ctx.lineTo(r.x + r.w, yPath);
    ctx.stroke();
    ctx.setLineDash([]);
    const px = cx + p.x * RS;
    const py = cy + p.y * RS;
    const pr = Math.max(1.2, k() * RS);
    if (!p.front) drawPlanet(px, py, pr);
    starDisc(cx, cy, RS);
    if (p.front) drawPlanet(px, py, pr);
    if (pr < 3 && Math.abs(p.x) < 1.6) {
      // mark a tiny planet so it can be found
      ctx.strokeStyle = '#8ce99a';
      ctx.lineWidth = 1.5 / kk;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    title('Through the telescope (planet size to scale with the star)', r, fs);
    ctx.font = fs(10, 600);
    ctx.fillStyle = '#c9d2e8';
    ctx.textAlign = 'left';
    ctx.fillText(p.front ? (Math.abs(p.x) < 1 + k() && Math.abs(p.y) < 1 + k() ? 'Transit: the planet is crossing the star' : 'Planet on our side of its orbit, not crossing the star') : 'Planet behind the star (hidden)', r.x + 14, r.y + r.h - 12);
    areas.push({
      test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h,
      title: 'The telescope’s view',
      text: () =>
        `Real telescopes cannot see the planet or even the star’s disc: they only measure the total light. Here the planet is drawn to scale: its radius is ${(k() * 100).toFixed(1)}% of the star’s, so it blocks about ${(k() * k() * 100).toFixed(k() < 0.03 ? 3 : 2)}% of the light. The dashed line is its path across the sky.`,
    });
  }
  function drawPlanet(x: number, y: number, r: number) {
    ctx.fillStyle = '#0d1019';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 180, 220, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ---------- Live light curve around the transit ---------- */
  function drawCurve(fs: Fs, kk: number) {
    const r = curveR();
    const T = duration();
    const win = transits() ? Math.max(T * 1.6, 2) : Math.min(periodH() / 6, 48);
    const x0 = r.x + 92;
    const x1 = r.x + r.w - 20;
    const y0 = r.y + 40;
    const y1 = r.y + r.h - 38;
    const dep = depth();
    const span = Math.max(dep * 1.5, NOISE[st.noise] * 4, 0.0002);
    const Y = (f: number) => y0 + ((1 - f) / span) * (y1 - y0) * 0.85 + 6;
    const X = (t: number) => x0 + ((t + win) / (2 * win)) * (x1 - x0);
    ctx.fillStyle = pal['bg-elev'];
    ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
    // axes
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / kk;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'right';
    for (const f of [1, 1 - span / 2, 1 - span]) ctx.fillText(`${(f * 100).toFixed(span < 0.002 ? 3 : 2)}%`, x0 - 4, Y(f) + 3);
    ctx.textAlign = 'center';
    for (const t of [-win, 0, win]) ctx.fillText(`${t === 0 ? 'mid-transit' : `${t > 0 ? '+' : '−'}${Math.abs(t).toFixed(1)} h`}`, X(t), y1 + 14 / kk);
    // noisy measurements, then the true curve
    rand = 1234 + noiseSeed;
    const sigma = NOISE[st.noise];
    if (sigma > 0) {
      ctx.fillStyle = pal['text-faint'];
      for (let i = 0; i <= 160; i++) {
        const t = -win + (2 * win * i) / 160;
        const f = flux(t) + sigma * gauss();
        const yy = Y(f);
        if (yy > y0 - 4 && yy < y1 + 4) ctx.fillRect(X(t) - 1.5, yy - 1.5, 3, 3);
      }
    }
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.2 / kk;
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const t = -win + (2 * win * i) / 240;
      const yy = Y(flux(t));
      if (i) ctx.lineTo(X(t), yy);
      else ctx.moveTo(X(t), yy);
    }
    ctx.stroke();
    // current time
    const tw = ((tH % periodH()) + periodH() * 1.5) % periodH() - periodH() / 2;
    if (Math.abs(tw) <= win) {
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 1.5 / kk;
      ctx.beginPath();
      ctx.moveTo(X(tw), y0);
      ctx.lineTo(X(tw), y1);
      ctx.stroke();
      ctx.fillStyle = pal.danger;
      ctx.beginPath();
      ctx.arc(X(tw), Y(flux(tw)), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText('Starlight measured by the telescope (zoomed on the transit)', r.x + 16, r.y + 26);
    if (!transits()) {
      ctx.font = fs(11, 650);
      ctx.fillStyle = pal.warning;
      ctx.textAlign = 'center';
      ctx.fillText('No dip: from our direction the planet never crosses the star', (x0 + x1) / 2, (y0 + y1) / 2);
    }
    areas.push({ test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: 'Light curve', text: () => (transits() ? `The star dims by ${(dep * 100).toFixed(dep < 0.001 ? 4 : 3)}% (${Math.round(dep * 1e6).toLocaleString('en')} parts per million) for about ${duration().toFixed(1)} hours. The curved bottom comes from limb darkening: the star’s edge is dimmer than its centre.` : 'The planet’s orbit is tilted too far from our line of sight, so it passes above or below the star and its light never dips.') });
  }

  /* ---------- Top view (orbit and observer) ---------- */
  function drawTop(fs: Fs, kk: number) {
    const r = topR();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 4;
    const Ro = Math.min(r.w, r.h) * 0.34;
    const p = pos(tH);
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.5 / kk;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Ro, Ro, 0, 0, Math.PI * 2);
    ctx.stroke();
    // star (not to scale) and planet
    starDisc(cx, cy, 14);
    const qx = cx + Math.sin(p.th) * Ro;
    const qy = cy + Math.cos(p.th) * Ro;
    ctx.fillStyle = pal['sim-water'];
    ctx.beginPath();
    ctx.arc(qx, qy, 7, 0, Math.PI * 2);
    ctx.fill();
    // line of sight towards the observer (down the page)
    ctx.strokeStyle = pal.success;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy + 16);
    ctx.lineTo(cx, r.y + r.h - 26);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = fs(10, 700);
    ctx.fillStyle = pal.success;
    ctx.textAlign = 'center';
    ctx.fillText('to our telescope ↓', cx, r.y + r.h - 12);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('transits happen here', cx + Ro * 0.62, cy + Ro + 16);
    title(portrait() ? 'Top view' : 'Top view (not to scale)', r, fs);
    areas.push({ test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: 'Top view', text: () => `The planet orbits once every ${fmtPeriod(periodH())}. It can only transit when it passes between the star and us, at the bottom of this view. On the far side it is hidden behind the star.` });
  }

  /* ---------- Side view (inclination, to scale) ---------- */
  function drawSide(fs: Fs, kk: number) {
    const r = sideR();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 8;
    const half = r.w * 0.42; // orbit radius in px
    const rs = Math.max(0.6, half / aR()); // star radius to scale
    // transit zone: the band in which the planet must cross the line of sight to hide part of the star
    ctx.fillStyle = 'rgba(140, 233, 154, 0.12)';
    ctx.fillRect(r.x + 8, cy - rs * (1 + k()), r.w - 16, 2 * rs * (1 + k()));
    // line of sight
    ctx.strokeStyle = pal.success;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.2 / kk;
    ctx.beginPath();
    ctx.moveTo(r.x + 8, cy);
    ctx.lineTo(r.x + r.w - 8, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    // the orbit seen edge-on, tilted by (90° − i)
    const tilt = (90 - st.inc) * DEG;
    ctx.strokeStyle = pal['text-muted'];
    ctx.lineWidth = 2 / kk;
    ctx.beginPath();
    // the near side dips below the line of sight, matching the telescope view (y = a cos i cos θ, drawn downwards)
    ctx.moveTo(cx - Math.cos(tilt) * half, cy - Math.sin(tilt) * half);
    ctx.lineTo(cx + Math.cos(tilt) * half, cy + Math.sin(tilt) * half);
    ctx.stroke();
    starDisc(cx, cy, rs);
    if (rs < 3) {
      ctx.strokeStyle = star().glow;
      ctx.lineWidth = 1.5 / kk;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the planet's side-on position: towards (right) the observer is at the near crossing
    const p = pos(tH);
    const along = Math.cos(p.th); // +1 nearest to us
    const sx = cx + along * Math.cos(tilt) * half;
    const sy = cy + along * Math.sin(tilt) * half;
    ctx.fillStyle = pal['sim-water'];
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = fs(10, 700);
    ctx.fillStyle = pal.success;
    ctx.textAlign = 'right';
    ctx.fillText('to our telescope →', r.x + r.w - 12, cy + 18);
    ctx.fillStyle = pal['text-muted'];
    ctx.textAlign = 'left';
    ctx.fillText(`tilt from edge-on: ${(90 - st.inc).toFixed(2)}°`, r.x + 14, r.y + r.h - 14);
    title(portrait() ? 'Side view, to scale' : 'Side view (to scale)', r, fs);
    areas.push({ test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: 'Side view, to scale', text: () => `The green band shows how far the orbit may tilt and still cross the star. The star is only ${(100 / aR()).toFixed(aR() > 100 ? 2 : 1)}% as wide as the orbit, so a randomly tilted orbit has only about a ${((100 * (1 + k())) / aR()).toFixed(aR() > 100 ? 2 : 1)}% chance of lining up with us.` });
  }

  /** A moment just before the slowed-down transit window, so the whole crossing plays slowly. */
  const startBefore = () => (-Math.asin(Math.min(1, (1.7 + k()) / aR())) / (2 * Math.PI)) * periodH();
  const fmtPeriod = (h: number) => (h < 48 ? `${h.toFixed(1)} hours` : h < 24 * 400 ? `${(h / 24).toFixed(1)} days` : `${(h / 24 / 365.25).toFixed(2)} years`);

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k: kk, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(kk, kk);
    areas = [];
    if (hintEl) hintEl.style.display = 'none';
    const fs: Fs = (px, wt = 650) => font(px / kk, wt);
    drawSky(fs, kk);
    drawCurve(fs, kk);
    drawTop(fs, kk);
    drawSide(fs, kk);
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts and graph ---------- */
  let lastNote = '';
  let graphKey = '';
  function updateUi() {
    const dep = depth();
    ui.readout('vis', transits() ? 'Yes: the planet transits' : 'No transit from our direction', transits() ? 'ok' : 'warn');
    ui.readout('depth', transits() ? `${(dep * 100).toFixed(dep < 0.001 ? 4 : 3)}% (${Math.round(dep * 1e6).toLocaleString('en')} ppm)` : '—');
    ui.readout('dur', transits() ? `${duration().toFixed(1)} hours` : '—');
    ui.readout('per', fmtPeriod(periodH()));
    ui.readout('b', `${b().toFixed(2)} star radii${transits() ? '' : ` (needs < ${(1 + k()).toFixed(2)})`}`);
    ui.readout('prob', `${Math.min(100, (100 * (1 + k())) / aR()).toFixed(aR() > 100 ? 2 : 1)}%`);
    ui.readout('size', `${st.rp.toFixed(1)} Earth radii (${(st.rp / 11.21).toFixed(2)} Jupiter)`);
    sim.setBadge(transits() ? (Math.abs(pos(tH).x) < 1 + k() && pos(tH).front ? 'Transit in progress' : 'Waiting for transit') : 'No transit');
    let note: string;
    if (!transits()) note = `At this tilt the planet passes ${b().toFixed(1)} star radii above or below the star’s centre, so from Earth it never crosses the star’s disc and no dip is seen. Most planets are missed this way: the orbit has to be within ${(Math.acos(Math.min(1, (1 + k()) / aR())) / DEG).toFixed(2)}° of edge-on (inclination ${(90 - Math.acos(Math.min(1, (1 + k()) / aR())) / DEG).toFixed(2)}°) to transit.`;
    else if (st.noise === 'ground' && dep < NOISE.ground * 1.5) note = 'The dip is smaller than the scatter in ground-based measurements, so a single transit is lost in the noise. Astronomers use space telescopes and average many transits to find small planets.';
    else note = `The planet blocks about (Rp/R*)² = ${(k() * k() * 100).toFixed(k() < 0.03 ? 4 : 3)}% of the star’s area. A bigger planet gives a deeper dip; a planet farther from its star moves more slowly, so its transits last longer but happen less often.`;
    if (note !== lastNote) noteEl.textContent = lastNote = note;
    canvas.setAttribute('aria-label', `A planet ${st.rp} Earth radii across orbiting a ${star().name.toLowerCase()} at ${aAU().toFixed(3)} AU with inclination ${st.inc.toFixed(2)} degrees. ${transits() ? `It transits, dimming the star by ${(dep * 100).toFixed(3)} percent for ${duration().toFixed(1)} hours.` : 'It does not transit.'}`);
    const key = [st.star, st.rp, st.loga, st.inc, st.noise, noiseSeed].join('|');
    if (key !== graphKey) {
      graphKey = key;
      drawGraph();
    }
  }
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="tr-graph"]')!, { x: { min: 0, span: 3 }, y: { min: 0.99, max: 1.001, step: 0.002 } });
  function drawGraph() {
    // three orbits, sampled densely around each transit so short dips are not missed
    const P = periodH();
    const T = Math.max(duration(), 0.5);
    const pts: Point[] = [];
    const noisy: Point[] = [];
    rand = 999 + noiseSeed;
    const sigma = NOISE[st.noise];
    const ts: number[] = [];
    for (let n = 0; n <= 3; n++) {
      for (let i = 0; i <= 60; i++) ts.push(n * P - T + (2 * T * i) / 60);
      if (n < 3) for (let i = 1; i < 40; i++) ts.push(n * P + T + ((P - 2 * T) * i) / 40);
    }
    for (const t of ts) {
      if (t < 0 || t > 3 * P) continue;
      const f = flux(t);
      pts.push({ x: t / P, y: f });
      if (sigma > 0) noisy.push({ x: t / P, y: f + sigma * gauss() });
    }
    const dep = depth();
    const span = Math.max(dep * 1.4, sigma * 4, 0.0002);
    const step = span / 4;
    graph.opts = {
      x: { min: 0, span: 3, max: 3, step: 0.5, format: (v) => `${v} P` },
      y: { min: 1 - span, max: 1 + sigma * 3, step, format: (v) => `${(v * 100).toFixed(span < 0.004 ? 3 : 2)}%` },
    };
    graph.clear();
    if (sigma > 0) graph.set('n', { label: 'Measurements with noise', color: 'text-faint', points: noisy, type: 'points' });
    graph.set('f', { label: 'Brightness of the star', color: 'accent', points: pts, width: 2 });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="tr-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const starCtl = ui.choice<StarId>('tr-star', (v) => ((st.star = v), sim.requestRender()));
  const rpCtl = ui.range('tr-rp', (v) => `${v.toFixed(1)} Earth radii`, (v) => ((st.rp = v), sim.requestRender()));
  const aCtl = ui.range('tr-a', (v) => {
    const a = Math.pow(10, v);
    return `${a < 0.1 ? a.toFixed(3) : a.toFixed(2)} AU`;
  }, (v) => ((st.loga = v), (tH = startBefore()), sim.requestRender()));
  const incCtl = ui.range('tr-inc', (v) => `${v.toFixed(2)}°`, (v) => ((st.inc = v), sim.requestRender()));
  const noiseCtl = ui.choice<Noise>('tr-noise', (v) => ((st.noise = v), (noiseSeed += 1), sim.requestRender()));
  const speedCtl = ui.range('tr-speed', (v) => `${v}×`, (v) => (st.speed = v));
  const presets: Record<string, Partial<typeof DEF>> = {
    hotjup: { star: 'sun', rp: 13, loga: Math.log10(0.047), inc: 89 },
    earth: { star: 'sun', rp: 1, loga: 0, inc: 90 },
    reddwarf: { star: 'red', rp: 1.4, loga: Math.log10(0.03), inc: 90 },
    jupiter: { star: 'sun', rp: 11.2, loga: Math.log10(5.2), inc: 90 },
  };
  root.querySelectorAll<HTMLButtonElement>('[data-planet]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const p = presets[btn.dataset.planet!];
      Object.assign(st, p);
      starCtl.set(st.star, false);
      rpCtl.set(st.rp, false);
      aCtl.set(st.loga, false);
      incCtl.set(st.inc, false);
      tH = startBefore();
      root.querySelectorAll<HTMLButtonElement>('[data-planet]').forEach((b2) => b2.setAttribute('aria-pressed', String(b2 === btn)));
      if (!sim.running) sim.play();
      sim.requestRender();
    }),
  );

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      starCtl.set(DEF.star, false);
      rpCtl.set(DEF.rp, false);
      aCtl.set(DEF.loga, false);
      incCtl.set(DEF.inc, false);
      noiseCtl.set(DEF.noise, false);
      speedCtl.set(DEF.speed, false);
      tH = startBefore();
      root.querySelectorAll<HTMLButtonElement>('[data-planet]').forEach((b2) => b2.setAttribute('aria-pressed', 'false'));
    },
  });
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k: kk, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / kk;
    const y = (e.clientY - rect.top - oy) / kk;
    const a = areas.find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });
}
