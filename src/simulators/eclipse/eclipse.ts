/**
 * Solar and lunar eclipses.
 *
 * Geometry (real values): Sun radius 696,000 km at 149.6 million km; Earth
 * radius 6,371 km; Moon radius 1,737 km at 363,300–405,500 km; the Moon's
 * orbit is tilted 5.145° to Earth's orbital plane (the ecliptic).
 *
 * θ = elongation (Moon's angle from the Sun along its orbit; 0° new, 180° full)
 * φ = angle from the Sun's direction to the Moon's ascending node
 * Moon's ecliptic latitude: β = asin(sin i · sin(θ − φ))
 *
 * Solar: angular separation of the Moon and Sun centres, reduced by the
 * Moon's parallax (the best-placed observer on Earth's surface), compared
 * with the two angular radii → total / annular / partial / none.
 * Lunar: separation of the Moon from the centre of Earth's shadow compared
 * with the umbra and penumbra radii (enlarged 2% for Earth's atmosphere) →
 * total / partial / penumbral / none.
 *
 * "Play" advances time at real rates: θ by 360°/29.53 days and φ by
 * −360°/346.6 days (the Sun moves along the ecliptic while the nodes regress),
 * so eclipse seasons emerge by themselves.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { arrow, font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'sim-water'] as const;
type Fs = (px: number, w?: number) => string;
type Dist = 'near' | 'mean' | 'far' | 'vary';

const DEG = Math.PI / 180;
const R_SUN = 696000;
const D_SUN = 149.6e6;
const R_EARTH = 6371;
const R_MOON = 1737.4;
const INC = 5.145;
const SYNODIC = 29.53;
const ECL_YEAR = 346.62;
const ANOMALISTIC = 27.555;
const DISTS: Record<Exclude<Dist, 'vary'>, number> = { near: 363300, mean: 384400, far: 405500 };
const EXAG = 8; // sizes and heights in the drawings
const DEF = { theta: 0, phi: 0, dist: 'mean' as Dist, speed: 4 };

type Solar = 'total' | 'annular' | 'partial' | null;
type Lunar = 'total' | 'partial' | 'penumbral' | null;

const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const asinD = (x: number) => Math.asin(clamp(x, -1, 1)) / DEG;

/** Area of overlap between two circles (radii r1, r2, centres d apart) as a fraction of circle 1. */
function overlap(r1: number, r2: number, d: number) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return r2 >= r1 ? 1 : (r2 * r2) / (r1 * r1);
  const a1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const area = r1 * r1 * (a1 - Math.sin(2 * a1) / 2) + r2 * r2 * (a2 - Math.sin(2 * a2) / 2);
  return area / (Math.PI * r1 * r1);
}

export function initEclipse(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const logEl = root.querySelector<HTMLElement>('[data-log]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let day = 0;
  let log: string[] = [];
  let lastEvent = '';

  /* ---------- Astronomy ---------- */
  const dist = () => (st.dist === 'vary' ? 384400 - 21100 * Math.cos((2 * Math.PI * day) / ANOMALISTIC) : DISTS[st.dist]);
  const beta = () => asinD(Math.sin(INC * DEG) * Math.sin((st.theta - st.phi) * DEG));
  const sunR = () => asinD(R_SUN / D_SUN); // ≈ 0.267°
  const moonR = () => asinD(R_MOON / dist());
  const parallax = () => asinD(R_EARTH / dist());
  const umbraR = () => 1.02 * (parallax() + asinD(R_EARTH / D_SUN) - sunR());
  const penR = () => 1.02 * (parallax() + asinD(R_EARTH / D_SUN) + sunR());
  /** Offset of the Moon from the Sun (solar) or from the shadow centre (lunar), in degrees: [east–west, north–south]. */
  const offsetSolar = (): [number, number] => {
    const b = beta();
    return [wrap180(st.theta) * Math.cos(b * DEG), b];
  };
  const offsetLunar = (): [number, number] => {
    const b = beta();
    return [wrap180(st.theta - 180) * Math.cos(b * DEG), b];
  };
  function solar(): { type: Solar; sep: number; cover: number } {
    const [x, y] = offsetSolar();
    const geo = Math.hypot(x, y);
    const sep = Math.max(0, geo - parallax()); // best-placed observer on Earth's surface
    const m = moonR();
    const s = sunR();
    let type: Solar = null;
    if (sep < Math.abs(m - s)) type = m >= s ? 'total' : 'annular';
    else if (sep < m + s) type = 'partial';
    return { type, sep, cover: overlap(s, m, sep) };
  }
  function lunar(): { type: Lunar; sep: number } {
    const [x, y] = offsetLunar();
    const sep = Math.hypot(x, y);
    const m = moonR();
    let type: Lunar = null;
    if (sep <= umbraR() - m) type = 'total';
    else if (sep < umbraR() + m) type = 'partial';
    else if (sep < penR() + m) type = 'penumbral';
    return { type, sep };
  }
  const phaseName = (t: number) => ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Third quarter', 'Waning crescent'][Math.floor((((t + 22.5) % 360) + 360) % 360 / 45)];
  const eclipseText = () => {
    const s = solar().type;
    const l = lunar().type;
    if (s) return `${cap(s)} solar eclipse`;
    if (l) return `${cap(l)} lunar eclipse`;
    return 'No eclipse';
  };
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  /* ---------- Time ---------- */
  function step(dt: number) {
    const total = dt * st.speed;
    // small sub-steps (≤ 0.02 day, about 0.25° of the Moon's orbit) so short eclipses are never skipped
    const n = Math.max(1, Math.ceil(total / 0.02));
    for (let i = 0; i < n; i++) {
      const d = total / n;
      day += d;
      st.theta = (st.theta + (360 / SYNODIC) * d) % 360;
      st.phi = (((st.phi - (360 / ECL_YEAR) * d) % 360) + 360) % 360;
      // record each eclipse once, at its deepest point (closest approach of the Moon to the line)
      const ev = eclipseText();
      const kind = ev.includes('solar') ? 'solar' : ev.includes('lunar') ? 'lunar' : '';
      if (kind && kind !== lastEvent) {
        log.unshift(`Day ${Math.round(day)}: ${kind} eclipse`);
        log = log.slice(0, 10);
        best = ev;
        bestDist = dist();
      } else if (kind && rank(ev) > rank(best)) (best = ev), (bestDist = dist());
      if (kind) log[0] = `Day ${Math.round(day)}: ${best.toLowerCase()}${kind === 'solar' ? ` (Moon ${Math.round(bestDist).toLocaleString('en')} km away)` : ''}`;
      if (!kind && lastEvent) {
        renderLog();
        sim.announce(`${log[0]}.`);
      }
      lastEvent = kind;
    }
    thetaCtl.set(Math.round(st.theta) % 360, false);
    phiCtl.set(Math.round(st.phi) % 360, false);
  }
  let best = '';
  let bestDist = 0;
  const rank = (ev: string) => (ev.startsWith('Total') ? 3 : ev.startsWith('Annular') ? 3 : ev.startsWith('Partial') ? 2 : ev.startsWith('Penumbral') ? 1 : 0);
  function renderLog() {
    logEl.innerHTML = log.length ? log.map((l) => `<li>${l}</li>`).join('') : '<li class="muted">Press Start to run time forward and record each eclipse.</li>';
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1062] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  type Rect = { x: number; y: number; w: number; h: number };
  const topR = (): Rect => (portrait() ? { x: 0, y: 0, w: 680, h: 400 } : { x: 0, y: 0, w: 590, h: 360 });
  const sideR = (): Rect => (portrait() ? { x: 0, y: 760, w: 680, h: 300 } : { x: 0, y: 365, w: 590, h: 235 });
  const skyR = (): Rect => (portrait() ? { x: 110, y: 405, w: 460, h: 350 } : { x: 610, y: 62, w: 380, h: 330 });
  /** Pixels per km for Earth–Moon distances: the average orbit is 150 px. */
  const S = 150 / 384400;

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
  function sunGlow(x: number, y: number, r: number) {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.7, '#ffcc33');
    g.addColorStop(1, 'rgba(255, 170, 30, 0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function earth(x: number, y: number, r: number, lightFrom: number) {
    ctx.fillStyle = '#2f6fd6';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // night side
    ctx.fillStyle = 'rgba(5, 10, 25, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r, lightFrom + Math.PI / 2, lightFrom - Math.PI / 2);
    ctx.fill();
  }
  function moon(x: number, y: number, r: number, lightFrom: number) {
    ctx.fillStyle = '#d9d4c4';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(5, 10, 25, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, r, lightFrom + Math.PI / 2, lightFrom - Math.PI / 2);
    ctx.fill();
  }
  /** A shadow cone along +x from (x0, y) with radius r0, ending with radius r1 at length len. */
  function cone(x0: number, y: number, r0: number, len: number, r1: number, colour: string, dir = 1) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x0, y - r0);
    ctx.lineTo(x0 + dir * len, y - Math.max(0, r1));
    ctx.lineTo(x0 + dir * len, y + Math.max(0, r1));
    ctx.lineTo(x0, y + r0);
    ctx.closePath();
    ctx.fill();
    // outline the edges so shadows stay visible on a dark background
    ctx.strokeStyle = pal['text-faint'];
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y - r0);
    ctx.lineTo(x0 + dir * len, y - Math.max(0, r1));
    ctx.moveTo(x0, y + r0);
    ctx.lineTo(x0 + dir * len, y + Math.max(0, r1));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  /** Faint sunlight wash over a panel, so shadows read as dark cut-outs in light and dark themes. */
  function sunlight(r: Rect) {
    ctx.fillStyle = 'rgba(255, 196, 60, 0.09)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  /* ---------- Top view ---------- */
  function topCentre() {
    const r = topR();
    return { ex: r.x + r.w * 0.56, ey: r.y + r.h * 0.54 };
  }
  const moonTop = () => {
    const { ex, ey } = topCentre();
    const a = Math.PI + st.theta * DEG;
    const R = dist() * S;
    return { x: ex + Math.cos(a) * R, y: ey - Math.sin(a) * R };
  };
  function drawTop(fs: Fs, k: number) {
    const r = topR();
    const { ex, ey } = topCentre();
    const R = dist() * S;
    const rE = EXAG * R_EARTH * S;
    const rM = EXAG * R_MOON * S;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    sunlight(r);
    // the Sun, far to the left
    sunGlow(r.x - 70, ey, 110);
    for (let i = -2; i <= 2; i++) arrow(ctx, r.x + 50, ey + i * 50, r.x + 85, ey + i * 50, pal.warning, 2 / k, 8 / k);
    // Earth's shadow: widths enlarged ×8 like the bodies, length to scale
    const pen = (x: number) => EXAG * S * (R_EARTH + (x * (R_SUN + R_EARTH)) / D_SUN);
    const umb = (x: number) => EXAG * S * (R_EARTH - (x * (R_SUN - R_EARTH)) / D_SUN);
    const far = 520 / S;
    cone(ex, ey, rE, far * S, pen(far), 'rgba(30, 40, 70, 0.28)');
    const lenU = (R_EARTH * D_SUN) / (R_SUN - R_EARTH);
    cone(ex, ey, rE, lenU * S, umb(lenU), 'rgba(8, 12, 26, 0.6)');
    // the Moon's orbit: solid where it is above Earth's orbital plane, dashed below
    for (const above of [true, false]) {
      ctx.strokeStyle = above ? pal['sim-text'] : pal['text-faint'];
      ctx.globalAlpha = above ? 0.7 : 0.6;
      ctx.lineWidth = (above ? 2 : 1.5) / k;
      ctx.setLineDash(above ? [] : [5, 5]);
      ctx.beginPath();
      const a0 = Math.PI + st.phi * DEG + (above ? 0 : Math.PI);
      ctx.arc(ex, ey, R, -a0 - Math.PI, -a0, false);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // line of nodes
    const an = Math.PI + st.phi * DEG;
    ctx.strokeStyle = pal.accent;
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    ctx.moveTo(ex - Math.cos(an) * (R + 30), ey + Math.sin(an) * (R + 30));
    ctx.lineTo(ex + Math.cos(an) * (R + 30), ey - Math.sin(an) * (R + 30));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = pal.accent;
    ctx.textAlign = 'center';
    // labels sit beyond the orbit and just off the line, so they never cover the Moon
    const px = Math.sin(an) * 16;
    const py = Math.cos(an) * 16;
    ctx.fillText('rising node', ex + Math.cos(an) * (R + 50) + px, ey - Math.sin(an) * (R + 50) + py + 4);
    ctx.fillText('falling node', ex - Math.cos(an) * (R + 50) + px, ey + Math.sin(an) * (R + 50) + py + 4);
    // the Moon's shadow near new moon
    const m = moonTop();
    if (Math.abs(wrap180(st.theta)) < 40) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(Math.atan2(ey - m.y, ex - m.x));
      const lenM = (R_MOON * D_SUN) / (R_SUN - R_MOON); // ≈ 374,000 km
      const toSurface = Math.hypot(ex - m.x, ey - m.y) - rE;
      // how far the umbra tip ends from Earth's surface (true km), shown ×8 like the sizes
      const gap = dist() - R_EARTH - lenM;
      const tip = gap > 0 ? Math.max(4, toSurface - gap * S * EXAG) : toSurface + 3;
      const penLen = toSurface + rE;
      cone(0, 0, rM, penLen, rM + EXAG * S * ((penLen / S) * (R_SUN + R_MOON)) / D_SUN, 'rgba(30, 40, 70, 0.26)');
      cone(0, 0, rM, tip, gap > 0 ? 0 : rM * 0.1, 'rgba(8, 12, 26, 0.75)');
      ctx.restore();
    }
    earth(ex, ey, rE, Math.PI);
    moon(m.x, m.y, rM, Math.PI);
    ctx.restore();
    title('Top view (from above the North Pole)', r, fs);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'left';
    ctx.fillText('Earth and Moon ×8 size; distances to scale', r.x + 14, r.y + r.h - 12);
    areas.push(
      { test: (x, y) => Math.hypot(x - m.x, y - m.y) < 22, title: 'The Moon', text: () => `${phaseName(st.theta)}, ${Math.round(dist()).toLocaleString('en')} km from Earth. Drag it around its orbit. Solid orbit: above Earth’s orbital plane; dashed: below.` },
      { test: (x, y) => Math.hypot(x - ex, y - ey) < rE + 6, title: 'Earth', text: () => 'Earth’s shadow points away from the Sun: a dark central umbra and a paler, wider penumbra. A lunar eclipse happens when the full moon passes into it.' },
      { test: (x, y) => Math.abs((x - ex) * Math.sin(an) + (y - ey) * Math.cos(an)) < 6 && Math.hypot(x - ex, y - ey) < R + 50, title: 'Line of nodes', text: () => 'The two places where the Moon’s tilted orbit crosses Earth’s orbital plane. Eclipses only happen when a new or full moon falls close to one of these nodes.' },
    );
  }

  /* ---------- Side view ---------- */
  function drawSide(fs: Fs, k: number) {
    const r = sideR();
    const ex = r.x + r.w * 0.56;
    const ey = r.y + r.h * 0.55;
    const R = dist() * S;
    const rE = EXAG * R_EARTH * S;
    const rM = EXAG * R_MOON * S;
    const z = (u: number) => EXAG * R * Math.sin(INC * DEG) * Math.sin(u * DEG); // height above the plane, ×8
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    sunlight(r);
    // Earth's orbital plane and sunlight
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    ctx.moveTo(r.x, ey);
    ctx.lineTo(r.x + r.w, ey);
    ctx.stroke();
    sunGlow(r.x - 70, ey, 100);
    // Earth's shadow band (side-on)
    cone(ex, ey, rE, 400, EXAG * S * (R_EARTH + (400 / S) * ((R_SUN + R_EARTH) / D_SUN)), 'rgba(30, 40, 70, 0.28)');
    cone(ex, ey, rE, 400, EXAG * S * (R_EARTH - (400 / S) * ((R_SUN - R_EARTH) / D_SUN)), 'rgba(8, 12, 26, 0.6)');
    // the Moon's orbit seen edge-on: x along the Sun–Earth line, y = height (exaggerated)
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    for (let t = 0; t <= 360; t += 4) {
      const x = ex - R * Math.cos(t * DEG);
      const y = ey - z(t - st.phi);
      if (t) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    const mx = ex - R * Math.cos(st.theta * DEG);
    const my = ey - z(st.theta - st.phi);
    // the Moon's shadow towards Earth near new moon
    if (Math.cos(st.theta * DEG) > 0.6) {
      const pts: [number, number] = [mx, my];
      ctx.fillStyle = 'rgba(10, 15, 30, 0.35)';
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1] - rM);
      ctx.lineTo(r.x + r.w, pts[1] - rM * 1.4);
      ctx.lineTo(r.x + r.w, pts[1] + rM * 1.4);
      ctx.lineTo(pts[0], pts[1] + rM);
      ctx.fill();
    }
    earth(ex, ey, rE, Math.PI);
    moon(mx, my, rM, Math.PI);
    ctx.restore();
    title('Side view: heights and sizes ×8', r, fs);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'left';
    ctx.fillText('Earth’s orbital plane', r.x + 40, ey + 16);
    const b = beta();
    ctx.textAlign = 'center';
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`${Math.abs(b).toFixed(2)}° ${b >= 0 ? 'above' : 'below'}`, mx, my + (b >= 0 ? -rM - 8 : rM + 16));
    areas.push({ test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: 'Side view', text: () => 'Looking along Earth’s orbital plane. The Moon’s orbit is tilted about 5°, so at most new and full moons the Moon passes above or below the line from the Sun to Earth, and its shadow misses Earth (or Earth’s shadow misses it). Heights are exaggerated ×8 so you can see this.' });
  }

  /* ---------- View from Earth ---------- */
  function drawSky(fs: Fs, k: number) {
    const r = skyR();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 10;
    const rad = Math.min(r.w, r.h) / 2 - 22;
    const nearNew0 = Math.abs(wrap180(st.theta)) < 30;
    // the solar view is zoomed in further so the thin ring of an annular eclipse is visible
    const pxPerDeg = nearNew0 ? rad / 0.85 : rad / 1.75;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    const sol = solar();
    const lun = lunar();
    const nearNew = Math.abs(wrap180(st.theta)) < 30;
    const nearFull = Math.abs(wrap180(st.theta - 180)) < 30;
    // sky colour darkens during a total solar eclipse
    ctx.fillStyle = nearNew ? (sol.type === 'total' ? '#0b1020' : `rgb(${Math.round(70 + 90 * (1 - sol.cover))}, ${Math.round(110 + 80 * (1 - sol.cover))}, ${Math.round(170 + 50 * (1 - sol.cover))})`) : '#0b1020';
    ctx.fill();
    ctx.clip();
    if (nearNew) {
      const [ox, oy] = offsetSolar();
      const geo = Math.hypot(ox, oy) || 1;
      const scale = sol.sep / geo; // shift to the best-placed observer
      if (sol.type === 'total') {
        const g = ctx.createRadialGradient(cx, cy, sunR() * pxPerDeg, cx, cy, sunR() * pxPerDeg * 2.6);
        g.addColorStop(0, 'rgba(235, 240, 255, 0.85)');
        g.addColorStop(1, 'rgba(235, 240, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, sunR() * pxPerDeg * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      sunGlow(cx, cy, sunR() * pxPerDeg);
      ctx.fillStyle = '#141826';
      ctx.beginPath();
      // east is to the left in the sky as seen from the northern hemisphere facing south
      ctx.arc(cx - ox * scale * pxPerDeg, cy - oy * scale * pxPerDeg, moonR() * pxPerDeg, 0, Math.PI * 2);
      ctx.fill();
    } else if (nearFull) {
      const [ox, oy] = offsetLunar();
      ctx.fillStyle = 'rgba(160, 170, 200, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, penR() * pxPerDeg, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 170, 200, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, umbraR() * pxPerDeg, 0, Math.PI * 2);
      ctx.fill();
      const mx = cx - ox * pxPerDeg;
      const my = cy - oy * pxPerDeg;
      const mr = moonR() * pxPerDeg;
      ctx.fillStyle = '#e8e2cf';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      // umbra darkens and reddens the part of the Moon inside it; penumbra dims it slightly
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(20, 20, 40, 0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, penR() * pxPerDeg, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lun.type === 'total' ? 'rgba(140, 45, 25, 0.85)' : 'rgba(90, 30, 25, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, umbraR() * pxPerDeg, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(200, 210, 240, 0.4)';
      ctx.lineWidth = 1.2 / k;
      ctx.setLineDash([4, 4]);
      for (const rr of [umbraR(), penR()]) {
        ctx.beginPath();
        ctx.arc(cx, cy, rr * pxPerDeg, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.font = fs(9.5, 700);
      ctx.fillStyle = 'rgba(220, 225, 245, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('umbra', cx, cy - umbraR() * pxPerDeg + 14);
      ctx.fillText('penumbra', cx, cy - penR() * pxPerDeg + 14);
    } else {
      ctx.font = fs(12, 650);
      ctx.fillStyle = '#c9d2e8';
      ctx.textAlign = 'center';
      ctx.fillText(`${phaseName(st.theta)}:`, cx, cy - 8 / k);
      ctx.fillText('not lined up with the Sun', cx, cy + 10 / k);
    }
    ctx.restore();
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['text-muted'];
    ctx.textAlign = 'center';
    ctx.fillText(nearNew ? 'Seen from the best place on Earth' : nearFull ? 'The Moon seen from Earth’s night side' : 'Seen from Earth', cx, r.y + 12);
    areas.push({
      test: (x, y) => Math.hypot(x - cx, y - cy) < rad,
      title: nearNew ? 'The Sun seen from Earth' : nearFull ? 'The Moon and Earth’s shadow' : 'View from Earth',
      text: () =>
        nearNew
          ? `The Sun and Moon look almost the same size in our sky: the Sun is about 400 times wider but also about 400 times farther away. Here the Moon’s disc is ${((moonR() / sunR()) * 100).toFixed(0)}% as wide as the Sun’s, so a central eclipse would be ${moonR() >= sunR() ? 'total' : 'annular (a ring of sunlight remains)'}.`
          : nearFull
            ? 'Earth’s shadow at the Moon’s distance: the dark umbra is about 2.7 Moon-widths across, surrounded by the paler penumbra. Inside the umbra the Moon turns red, lit only by sunlight bent through Earth’s atmosphere.'
            : 'Eclipses can only happen near new moon (solar) or full moon (lunar).',
    });
  }

  /* ---------- Render ---------- */
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
    drawTop(fs, k);
    drawSide(fs, k);
    drawSky(fs, k);
    ctx.restore();
    updateUi();
  }

  let lastNote = '';
  function updateUi() {
    const sol = solar();
    const lun = lunar();
    const ev = eclipseText();
    const b = beta();
    const ratio = moonR() / sunR();
    ui.readout('ecl', ev, ev === 'No eclipse' ? null : 'ok');
    ui.readout('phase', `${phaseName(st.theta)} (${Math.round(st.theta)}°)`);
    ui.readout('lat', `${Math.abs(b).toFixed(2)}° ${b >= 0 ? 'above' : 'below'} Earth’s orbital plane`);
    ui.readout('dist', `${Math.round(dist()).toLocaleString('en')} km`);
    ui.readout('size', `${(ratio * 100).toFixed(1)}% of the Sun’s width`);
    const nodeOff = Math.min(Math.abs(wrap180(st.phi)), Math.abs(wrap180(st.phi - 180)));
    ui.readout('season', nodeOff < 17 ? `Yes: nodes within ${Math.round(nodeOff)}° of the Sun` : `No: nodes ${Math.round(nodeOff)}° from the Sun line`, nodeOff < 17 ? 'ok' : null);
    ui.readout('cover', sol.type ? `${Math.round(sol.cover * 100)}% of the Sun’s disc` : lun.type ? '—' : '—');
    sim.setBadge(st.dist === 'vary' || day > 0 ? `Day ${Math.round(day)}` : ev);
    let note: string;
    if (sol.type === 'total') note = 'Total solar eclipse: the Moon covers the whole Sun and its pale outer atmosphere, the corona, appears. Totality is seen only inside the Moon’s small umbra, a path usually less than about 270 km wide; people nearby see a partial eclipse.';
    else if (sol.type === 'annular') note = 'Annular solar eclipse: the Moon is too far from Earth to cover the whole Sun, so a bright ring remains. Its umbra ends before reaching Earth.';
    else if (sol.type === 'partial') note = 'Partial solar eclipse: the Moon covers only part of the Sun, as seen from places in its penumbra.';
    else if (lun.type === 'total') note = 'Total lunar eclipse: the whole Moon is inside Earth’s umbra. It turns coppery red, lit by sunlight bent and reddened by Earth’s atmosphere. Everyone on Earth’s night side can see it.';
    else if (lun.type === 'partial') note = 'Partial lunar eclipse: part of the Moon is in Earth’s dark umbra.';
    else if (lun.type === 'penumbral') note = 'Penumbral lunar eclipse: the Moon is only in Earth’s faint outer shadow, so it dims slightly. Easy to miss!';
    else if (Math.abs(wrap180(st.theta)) < 15 || Math.abs(wrap180(st.theta - 180)) < 15)
      note = `The Moon is ${Math.abs(b).toFixed(1)}° ${b >= 0 ? 'above' : 'below'} Earth’s orbital plane, so ${Math.abs(wrap180(st.theta)) < 15 ? 'its shadow passes ' + (b >= 0 ? 'above' : 'below') + ' Earth' : 'it passes ' + (b >= 0 ? 'above' : 'below') + ' Earth’s shadow'}. This is why most new and full moons give no eclipse.`;
    else note = 'Eclipses need a new or full moon (the Sun, Earth and Moon in a line) that falls near one of the nodes, where the Moon’s tilted orbit crosses Earth’s orbital plane.';
    if (note !== lastNote) noteEl.textContent = lastNote = note;
    canvas.setAttribute('aria-label', `Sun, Earth and Moon. ${phaseName(st.theta)}, the Moon is ${Math.abs(b).toFixed(2)} degrees ${b >= 0 ? 'above' : 'below'} Earth's orbital plane, ${Math.round(dist())} kilometres away. ${ev}.`);
  }

  /* ---------- Interaction ---------- */
  const ui = controls(root);
  const thetaCtl = ui.range('ecl-moon', (v) => `${v}° (${phaseName(v)})`, (v) => ((st.theta = v), sim.requestRender()));
  const phiCtl = ui.range('ecl-node', (v) => `${v}°`, (v) => ((st.phi = v), sim.requestRender()));
  ui.presets('ecl-moon', thetaCtl);
  ui.presets('ecl-node', phiCtl);
  const distCtl = ui.choice<Dist>('ecl-dist', (v) => ((st.dist = v), sim.requestRender()));
  const speedCtl = ui.range('ecl-speed', (v) => `${v} days per second`, (v) => (st.speed = v));
  root.querySelector('[data-clear-log]')?.addEventListener('click', () => {
    log = [];
    day = 0;
    renderLog();
    sim.requestRender();
  });
  const toDesign = (x: number, y: number) => {
    const { k, ox, oy } = tf();
    return { x: (x - ox) / k, y: (y - oy) / k };
  };
  enableDrag<'moon'>(canvas, {
    hit: (x, y) => {
      const p = toDesign(x, y);
      const m = moonTop();
      return Math.hypot(p.x - m.x, p.y - m.y) < 24 ? 'moon' : null;
    },
    move: (_id, x, y) => {
      const p = toDesign(x, y);
      const { ex, ey } = topCentre();
      const a = Math.atan2(-(p.y - ey), p.x - ex);
      thetaCtl.set(Math.round((((a - Math.PI) / DEG) % 360 + 360) % 360) % 360);
    },
    click: (x, y) => {
      const p = toDesign(x, y);
      const a = areas.find((q) => q.test(p.x, p.y));
      if (a) sim.showTooltip(x, y, a.title, a.text());
      else sim.hideTooltip();
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, DEF);
      thetaCtl.set(DEF.theta, false);
      phiCtl.set(DEF.phi, false);
      distCtl.set(DEF.dist, false);
      speedCtl.set(DEF.speed, false);
      day = 0;
      log = [];
      lastEvent = '';
      renderLog();
    },
  });
  renderLog();
}
