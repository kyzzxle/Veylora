/**
 * Seasons and Earth's axial tilt.
 *
 * Day of year d (0 = 1 January). The Sun's ecliptic longitude is approximated
 * as λ = 360° × (d − 78) / 365.25 (0° at the March equinox; the small
 * variation in Earth's orbital speed is ignored). The Sun's declination,
 * the latitude where it is overhead at noon, is δ = asin(sin ε · sin λ).
 *
 * For latitude φ:
 *   noon Sun height  h = 90° − |φ − δ|            (below 0: the Sun stays down)
 *   day length       cos H₀ = −tan φ · tan δ, day = 2H₀/15° hours
 *   daily sunlight at the top of the atmosphere (W/m², averaged over 24 h)
 *     Q = (S₀/π)(a/r)² [H₀ sin φ sin δ + cos φ cos δ sin H₀]
 * Earth–Sun distance r = a(1 − e cos M) with e = 0.0167 and perihelion on
 * about 3 January, so its effect (about ±3.4% in sunlight) can be compared
 * with the far larger effect of the tilt.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'sim-water'] as const;
type Fs = (px: number, w?: number) => string;

const DEG = Math.PI / 180;
const S0 = 1361;
const AU = 149.6;
const ECC = 0.0167;
const YEAR = 365.25;
const DEF = { day: 171, lat: 50, tilt: 23.44, speed: 20 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function dateOf(day: number) {
  let d = Math.floor(((day % 365) + 365) % 365);
  for (let m = 0; m < 12; m++) {
    if (d < MDAYS[m]) return `${d + 1} ${MONTHS[m]}`;
    d -= MDAYS[m];
  }
  return '31 December';
}

export function initSeasons(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };

  /* ---------- Astronomy ---------- */
  const lambda = (d = st.day) => (360 * (d - 78)) / YEAR;
  const decl = (d = st.day) => Math.asin(Math.sin(st.tilt * DEG) * Math.sin(lambda(d) * DEG)) / DEG;
  const distance = (d = st.day) => AU * (1 - ECC * Math.cos((2 * Math.PI * (d - 2)) / YEAR)); // million km
  const noonHeight = (phi: number, d = st.day) => 90 - Math.abs(phi - decl(d));
  /** Half-day hour angle H₀ in radians (0 = polar night, π = midnight sun). */
  const h0 = (phi: number, d = st.day) => {
    const x = -Math.tan(phi * DEG) * Math.tan(decl(d) * DEG);
    return x >= 1 ? 0 : x <= -1 ? Math.PI : Math.acos(x);
  };
  const dayLength = (phi: number, d = st.day) => (24 * h0(phi, d)) / Math.PI;
  const insolation = (phi: number, d = st.day) => {
    const H = h0(phi, d);
    const p = phi * DEG;
    const de = decl(d) * DEG;
    return (S0 / Math.PI) * Math.pow(AU / distance(d), 2) * (H * Math.sin(p) * Math.sin(de) + Math.cos(p) * Math.cos(de) * Math.sin(H));
  };
  function season(north: boolean, d = st.day) {
    const l = ((lambda(d) % 360) + 360) % 360;
    const n = l < 90 ? 'Spring' : l < 180 ? 'Summer' : l < 270 ? 'Autumn' : 'Winter';
    if (north) return n;
    return { Spring: 'Autumn', Summer: 'Winter', Autumn: 'Spring', Winter: 'Summer' }[n]!;
  }
  const fmtHours = (h: number) => {
    if (h <= 0.01) return '0 h (the Sun does not rise)';
    if (h >= 23.99) return '24 h (the Sun does not set)';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh} h ${mm.toString().padStart(2, '0')} min`;
  };
  const latName = (phi: number) => `${Math.abs(phi)}°${phi > 0 ? 'N' : phi < 0 ? 'S' : ''}`;

  /* ---------- Time ---------- */
  function step(dt: number) {
    st.day = (st.day + dt * st.speed) % 365;
    dayCtl.set(Math.round(st.day) % 365, false);
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1190] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  type Rect = { x: number; y: number; w: number; h: number };
  const orbitR = (): Rect => (portrait() ? { x: 0, y: 0, w: 680, h: 330 } : { x: 0, y: 0, w: 520, h: 330 });
  const globeR = (): Rect => (portrait() ? { x: 0, y: 335, w: 680, h: 340 } : { x: 525, y: 0, w: 475, h: 330 });
  const beamR = (): Rect => (portrait() ? { x: 0, y: 680, w: 680, h: 510 } : { x: 0, y: 340, w: 1000, h: 260 });

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
  function sun(x: number, y: number, r: number) {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.7, '#ffcc33');
    g.addColorStop(1, 'rgba(255, 170, 30, 0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- Orbit view (oblique) ---------- */
  // Ecliptic frame: X, Y in the orbital plane, Z towards the north ecliptic pole.
  // Earth's position seen from the Sun: angle L = λ + 180°. North pole axis n = (0, sin ε, cos ε).
  function orbitGeom() {
    const r = orbitR();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 18;
    const A = Math.min(r.w * 0.34, 180);
    const flat = 0.42;
    // rotate by −90° so the solstices are on the left and right, the classic textbook view:
    // screen-x = ecliptic Y, screen-depth = −(ecliptic X)
    const P = (X: number, Y: number, Z: number) => [cx + Y * A, cy + X * A * flat - Z * A * 0.9] as const;
    return { cx, cy, A, flat, P };
  }
  const earthOrbitPos = (d = st.day) => {
    const g = orbitGeom();
    const L = (lambda(d) + 180) * DEG;
    const rr = distance(d) / AU;
    return g.P(rr * Math.cos(L), rr * Math.sin(L), 0);
  };
  function drawOrbit(fs: Fs, k: number) {
    const r = orbitR();
    const g = orbitGeom();
    // orbit
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    for (let d = 0; d <= 366; d += 3) {
      const L = (lambda(d) + 180) * DEG;
      const rr = distance(d) / AU;
      const [x, y] = g.P(rr * Math.cos(L), rr * Math.sin(L), 0);
      if (d) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // markers for equinoxes and solstices
    const marks: [number, string][] = [
      [78.5, 'Mar equinox'],
      [171, 'Jun solstice'],
      [264.5, 'Sep equinox'],
      [354.5, 'Dec solstice'],
    ];
    for (const [d, label] of marks) {
      const L = (lambda(d) + 180) * DEG;
      const [x, y] = g.P(Math.cos(L), Math.sin(L), 0);
      const side = Math.abs(x - g.cx) > g.A * 0.5;
      ctx.font = fs(10, 650);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'center';
      // solstices: label below the orbit point; equinoxes: above (back) or below (front)
      ctx.fillText(label, x, side ? y + 22 + 14 / k : y < g.cy ? y - 22 : y + 22 + 12 / k);
    }
    sun(g.cx, g.cy, 26);
    // Earth and its axis (always pointing the same way in space)
    const [ex, ey] = earthOrbitPos();
    const n: [number, number, number] = [0, Math.sin(st.tilt * DEG), Math.cos(st.tilt * DEG)];
    const L0 = (lambda() + 180) * DEG;
    const rr = distance() / AU;
    const base = [rr * Math.cos(L0), rr * Math.sin(L0), 0];
    const len = 0.32;
    const [ax, ay] = g.P(base[0] + n[0] * len, base[1] + n[1] * len, n[2] * len);
    const [bx, by] = g.P(base[0] - n[0] * len, base[1] - n[1] * len, -n[2] * len);
    // lit hemisphere facing the Sun
    ctx.fillStyle = '#2f6fd6';
    ctx.beginPath();
    ctx.arc(ex, ey, 14, 0, Math.PI * 2);
    ctx.fill();
    const toSun = Math.atan2(g.cy - ey, g.cx - ex);
    ctx.fillStyle = 'rgba(5, 10, 25, 0.55)';
    ctx.beginPath();
    ctx.arc(ex, ey, 14, toSun + Math.PI / 2, toSun - Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5 / k;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.font = fs(10, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText('N', ax + (ax - ex) * 0.25, ay + (ay - ey) * 0.25 - 2);
    title('Earth’s orbit (tilted view, not to scale)', r, fs);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'left';
    if (!portrait()) ctx.fillText('The axis always points the same way in space (towards Polaris)', r.x + 14, r.y + r.h - 10);
    areas.push(
      { test: (x, y) => Math.hypot(x - ex, y - ey) < 22, title: 'Earth', text: () => `${dateOf(st.day)}. Drag Earth around its orbit. Distance from the Sun: ${distance().toFixed(1)} million km. Notice that the axis keeps pointing the same way as Earth moves.` },
      { test: (x, y) => Math.hypot(x - g.cx, y - g.cy) < 30, title: 'The Sun', text: () => 'Earth’s orbit is almost a circle: Earth is only about 3% closer to the Sun in early January than in early July. That small change is not what causes the seasons.' },
    );
  }

  /* ---------- Globe (side view, Sun to the left) ---------- */
  function drawGlobe(fs: Fs, k: number) {
    const r = globeR();
    const cx = r.x + r.w * 0.58;
    const cy = r.y + r.h / 2 + 20;
    const R = Math.min(r.w * 0.27, r.h * 0.3);
    const d = decl();
    // sunlight from the left
    for (let i = -3; i <= 3; i++) arrow(ctx, r.x + 16, cy + i * R * 0.32, r.x + 58, cy + i * R * 0.32, pal.warning, 2 / k, 8 / k);
    ctx.font = fs(10, 650);
    ctx.fillStyle = pal.warning;
    ctx.textAlign = 'left';
    ctx.fillText('Sunlight', r.x + 14, cy + R * 1.25);
    // globe with day and night
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2f6fd6';
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.fillStyle = 'rgba(5, 10, 25, 0.6)';
    ctx.fillRect(cx, cy - R, R, 2 * R);
    // axis tilted towards (+) or away from (−) the Sun by the declination, as seen side-on
    const a = -d * DEG; // rotate the north pole towards the Sun (left) when δ > 0
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const along = (lat: number) => {
      // chord of a latitude circle seen edge-on: centre at R·sin(lat) along the axis, half-length R·cos(lat)
      const c = R * Math.sin(lat * DEG);
      const hl = R * Math.cos(lat * DEG);
      const mx = cx + ux * c;
      const my = cy + uy * c;
      // perpendicular to the axis: p = (−uy, ux); the chord runs from m − hl·p to m + hl·p
      return { x0: mx + uy * hl, y0: my - ux * hl, x1: mx - uy * hl, y1: my + ux * hl, mx, my };
    };
    const latLine = (lat: number, colour: string, width: number, dash: number[] = []) => {
      const l = along(lat);
      ctx.strokeStyle = colour;
      ctx.lineWidth = width / k;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(l.x0, l.y0);
      ctx.lineTo(l.x1, l.y1);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    latLine(0, 'rgba(255,255,255,0.55)', 1.5);
    latLine(23.44, 'rgba(255,255,255,0.3)', 1, [4, 4]);
    latLine(-23.44, 'rgba(255,255,255,0.3)', 1, [4, 4]);
    latLine(66.56, 'rgba(255,255,255,0.3)', 1, [4, 4]);
    latLine(-66.56, 'rgba(255,255,255,0.3)', 1, [4, 4]);
    // the chosen latitudes: daylight part of the circle in yellow, night part dark
    for (const phi of [st.lat, -st.lat]) {
      const l = along(phi);
      ctx.lineWidth = 5 / k;
      ctx.lineCap = 'round';
      // split the chord at the terminator (x = cx)
      const t = Math.abs(l.x1 - l.x0) < 1e-6 ? 0.5 : clamp((cx - l.x0) / (l.x1 - l.x0), 0, 1);
      const sx = l.x0 + (l.x1 - l.x0) * t;
      const sy = l.y0 + (l.y1 - l.y0) * t;
      const dayFirst = l.x0 < l.x1;
      ctx.strokeStyle = '#ffd43b';
      ctx.beginPath();
      ctx.moveTo(dayFirst ? l.x0 : l.x1, dayFirst ? l.y0 : l.y1);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.strokeStyle = '#0b1530';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(dayFirst ? l.x1 : l.x0, dayFirst ? l.y1 : l.y0);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    // subsolar point
    const sub = along(d);
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(Math.min(sub.x0, sub.x1), sub.x0 < sub.x1 ? sub.y0 : sub.y1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    // axis
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5 / k;
    ctx.beginPath();
    ctx.moveTo(cx - ux * R * 1.25, cy - uy * R * 1.25);
    ctx.lineTo(cx + ux * R * 1.25, cy + uy * R * 1.25);
    ctx.stroke();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText('N', cx + ux * R * 1.36, cy + uy * R * 1.36 + 4);
    ctx.fillText('S', cx - ux * R * 1.36, cy - uy * R * 1.36 + 4);
    // labels for the two latitude lines
    ctx.font = fs(10.5, 700);
    ctx.textAlign = 'left';
    for (const phi of [st.lat, -st.lat]) {
      const l = along(phi);
      const right = l.x0 > l.x1 ? { x: l.x0, y: l.y0 } : { x: l.x1, y: l.y1 };
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(latName(phi), right.x + 8, right.y + 4);
    }
    title('Earth seen side-on (Sun to the left)', r, fs);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'left';
    if (!portrait()) ctx.fillText('Yellow: the part of each latitude circle in daylight', r.x + 14, r.y + r.h - 10);
    areas.push({
      test: (x, y) => Math.hypot(x - cx, y - cy) < R,
      title: 'Day and night on Earth',
      text: () =>
        `Today the Sun is overhead at noon at latitude ${latName(Math.round(d * 10) / 10)} (yellow dot). The northern hemisphere is tilted ${d > 0.5 ? 'towards' : d < -0.5 ? 'away from' : 'neither towards nor away from'} the Sun. As Earth spins, a place travels along its latitude line: the yellow part is daytime, so its length shows the day length.`,
    });
  }

  /* ---------- Sunlight angle panels ---------- */
  function drawBeams(fs: Fs, k: number) {
    const r = beamR();
    // side by side on wide screens, stacked on phones
    const stack = portrait();
    const half = stack ? r.w : r.w / 2;
    const ph = stack ? r.h / 2 : r.h;
    [st.lat, -st.lat].forEach((phi, i) => {
      const x0 = r.x + (stack ? 0 : i * half);
      const y0 = r.y + (stack ? i * ph : 0);
      const h = noonHeight(phi);
      const groundY = y0 + ph - 32 - 16 / k;
      const gx = x0 + half / 2 + 40;
      ctx.font = fs(11.5, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'left';
      ctx.fillText(`${phi >= 0 ? 'Northern' : 'Southern'} hemisphere, ${latName(phi)}: ${season(phi >= 0)}`, x0 + 14, y0 + 22);
      // ground
      ctx.strokeStyle = pal['text-muted'];
      ctx.lineWidth = 3 / k;
      ctx.beginPath();
      ctx.moveTo(x0 + 24, groundY);
      ctx.lineTo(x0 + half - 24, groundY);
      ctx.stroke();
      if (h <= 0) {
        ctx.font = fs(11, 650);
        ctx.fillStyle = pal['text-faint'];
        ctx.textAlign = 'center';
        ctx.fillText('The Sun stays below the horizon all day', gx - 40, groundY - 60);
      } else {
        // a beam of fixed width arriving at angle h spreads over a ground patch of width w / sin h
        const w = 46;
        const patch = Math.min(w / Math.sin(h * DEG), half - 70);
        const dirx = -Math.cos(h * DEG);
        const diry = -Math.sin(h * DEG);
        const L = Math.min(150, (groundY - y0 - 40) / Math.max(0.3, Math.sin(h * DEG)));
        const p0 = gx - patch / 2;
        const p1 = gx + patch / 2;
        ctx.fillStyle = 'rgba(255, 200, 60, 0.35)';
        ctx.beginPath();
        ctx.moveTo(p0, groundY);
        ctx.lineTo(p0 + dirx * L, groundY + diry * L);
        ctx.lineTo(p1 + dirx * L, groundY + diry * L);
        ctx.lineTo(p1, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f59f00';
        ctx.lineWidth = 3 / k;
        ctx.beginPath();
        ctx.moveTo(p0, groundY - 1);
        ctx.lineTo(p1, groundY - 1);
        ctx.stroke();
        // angle arc
        ctx.strokeStyle = pal['text-faint'];
        ctx.lineWidth = 1.5 / k;
        ctx.beginPath();
        ctx.arc(p1, groundY, 30, Math.PI, Math.PI + h * DEG);
        ctx.stroke();
        ctx.font = fs(11, 700);
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'left';
        ctx.fillText(`${h.toFixed(0)}°`, p1 - 30 - 34 / k, groundY - 8);
      }
      ctx.font = fs(10.5, 650);
      ctx.fillStyle = pal['text-muted'];
      ctx.textAlign = 'left';
      ctx.fillText(`Noon Sun ${Math.max(0, h).toFixed(0)}° high · day ${fmtHours(dayLength(phi)).split(' (')[0]} · ${Math.round(Math.max(0, insolation(phi)))} W/m²`, x0 + 14, groundY + 10 + 14 / k);
      areas.push({
        test: (x, y) => x > x0 && x < x0 + half && y > y0 && y < y0 + ph,
        title: `Noon sunlight at ${latName(phi)}`,
        text: () =>
          h > 0
            ? `The same beam of sunlight is spread over ${(1 / Math.sin(h * DEG)).toFixed(1)} times the ground area it would cover if the Sun were overhead. A higher Sun concentrates the energy, and a longer day adds more hours of it.`
            : 'The Sun does not rise here today: this is polar night.',
      });
    });
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / k;
    ctx.beginPath();
    if (stack) (ctx.moveTo(r.x + 8, r.y + ph), ctx.lineTo(r.x + r.w - 8, r.y + ph));
    else (ctx.moveTo(r.x + r.w / 2, r.y + 8), ctx.lineTo(r.x + r.w / 2, r.y + r.h - 8));
    ctx.stroke();
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
    if (hintEl) hintEl.style.display = portrait() ? 'none' : '';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    drawOrbit(fs, k);
    drawGlobe(fs, k);
    drawBeams(fs, k);
    ctx.restore();
    updateUi();
    drawGraph();
  }

  /* ---------- Readouts ---------- */
  let lastNote = '';
  function updateUi() {
    const d = decl();
    const N = st.lat;
    ui.readout('date', `${dateOf(st.day)}: ${season(true).toLowerCase()} in the north, ${season(false).toLowerCase()} in the south`);
    ui.readout('decl', `${latName(Math.round(d * 10) / 10)}`);
    ui.readout('hn', `${Math.max(0, noonHeight(N)).toFixed(0)}° / ${Math.max(0, noonHeight(-N)).toFixed(0)}°`);
    ui.readout('dl', `${fmtHours(dayLength(N)).split(' (')[0]} / ${fmtHours(dayLength(-N)).split(' (')[0]}`);
    ui.readout('ins', `${Math.round(Math.max(0, insolation(N)))} / ${Math.round(Math.max(0, insolation(-N)))} W/m²`);
    ui.readout('dist', `${distance().toFixed(1)} million km`);
    sim.setBadge(dateOf(st.day));
    let note: string;
    if (st.tilt < 1) note = 'With no tilt, the Sun is always overhead at the equator, every place has 12-hour days all year, and there are no seasons, even though Earth’s distance from the Sun still changes slightly.';
    else if (Math.abs(d) < 2) note = `Near an equinox: the Sun is overhead near the equator, so day and night are about 12 hours everywhere and both hemispheres get similar sunlight.`;
    else
      note = `The northern hemisphere is tilted ${d > 0 ? 'towards' : 'away from'} the Sun, so at ${st.lat}° the noon Sun is ${d > 0 ? 'higher' : 'lower'} and days are ${d > 0 ? 'longer' : 'shorter'} in the north than at ${st.lat}°S. It is ${season(true).toLowerCase()} in the north and ${season(false).toLowerCase()} in the south.${distance() < 148 && d < 0 ? ' Earth is near its closest to the Sun now, yet it is northern winter: distance is not the cause.' : distance() > 151.5 && d > 0 ? ' Earth is near its farthest from the Sun now, yet it is northern summer: distance is not the cause.' : ''}`;
    if (note !== lastNote) noteEl.textContent = lastNote = note;
    canvas.setAttribute('aria-label', `Earth on ${dateOf(st.day)} with a ${st.tilt.toFixed(1)} degree tilt. The Sun is overhead at ${latName(Math.round(d))}. At ${st.lat} degrees north the noon Sun is ${Math.max(0, noonHeight(N)).toFixed(0)} degrees high and the day lasts ${fmtHours(dayLength(N))}; at ${st.lat} degrees south, ${Math.max(0, noonHeight(-N)).toFixed(0)} degrees and ${fmtHours(dayLength(-N))}.`);
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="sea-graph"]')!, { x: { min: 0, span: 365 }, y: { min: 0, max: 24, step: 6 } });
  const gTitle = root.querySelector<HTMLElement>('#sea-graph-title')!;
  let measure: 'day' | 'sun' = 'day';
  function drawGraph() {
    const mStart = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const N: Point[] = [];
    const S: Point[] = [];
    for (let d = 0; d <= 365; d += 2) {
      N.push({ x: d, y: measure === 'day' ? dayLength(st.lat, d) : Math.max(0, insolation(st.lat, d)) });
      S.push({ x: d, y: measure === 'day' ? dayLength(-st.lat, d) : Math.max(0, insolation(-st.lat, d)) });
    }
    gTitle.textContent = measure === 'day' ? `Day length through the year at ${st.lat}°N and ${st.lat}°S` : `Daily sunlight (top of atmosphere) at ${st.lat}°N and ${st.lat}°S`;
    const topI = Math.ceil(Math.max(...N.map((p) => p.y), ...S.map((p) => p.y), 100) / 100) * 100;
    graph.opts = {
      x: { min: 0, span: 365, max: 365, step: 30.4, format: (v) => MONTHS[Math.min(11, mStart.findLastIndex((m) => m <= v + 1))].slice(0, 3) },
      y: measure === 'day' ? { min: 0, max: 24, step: 6, format: (v) => `${v} h` } : { min: 0, max: topI, step: topI / 4, format: (v) => `${v}` },
      refs: [{ value: st.day, label: (([dd, mm]) => `${dd} ${mm.slice(0, 3)}`)(dateOf(st.day).split(' ')), color: 'text-faint', axis: 'x' }],
    };
    graph.set('n', { label: `${st.lat}°N`, color: 'accent', points: N, width: 2.4 });
    graph.set('s', { label: `${st.lat}°S`, color: 'warning', points: S, width: 2.4 });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="sea-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const dayCtl = ui.range('sea-day', (v) => dateOf(v), (v) => ((st.day = v), sim.requestRender()));
  ui.presets('sea-day', dayCtl);
  const latCtl = ui.range('sea-lat', (v) => `${v}°N and ${v}°S`, (v) => ((st.lat = v), sim.requestRender()));
  const tiltCtl = ui.range('sea-tilt', (v) => `${v.toFixed(1)}°`, (v) => ((st.tilt = v), sim.requestRender()));
  ui.presets('sea-tilt', tiltCtl);
  const speedCtl = ui.range('sea-speed', (v) => `${v} days per second`, (v) => (st.speed = v));
  const measureCtl = ui.choice<'day' | 'sun'>('sea-graph-q', (v) => ((measure = v), sim.requestRender()));

  const toDesign = (x: number, y: number) => {
    const { k, ox, oy } = tf();
    return { x: (x - ox) / k, y: (y - oy) / k };
  };
  enableDrag<'earth'>(canvas, {
    hit: (x, y) => {
      const p = toDesign(x, y);
      const [ex, ey] = earthOrbitPos();
      return Math.hypot(p.x - ex, p.y - ey) < 24 ? 'earth' : null;
    },
    move: (_id, x, y) => {
      const p = toDesign(x, y);
      const g = orbitGeom();
      // invert the oblique projection in the orbital plane
      const Y = (p.x - g.cx) / g.A;
      const X = (p.y - g.cy) / (g.A * g.flat);
      const L = Math.atan2(Y, X) / DEG;
      const day = ((((L - 180) * YEAR) / 360 + 78.5) % 365 + 365) % 365;
      dayCtl.set(Math.round(day) % 365);
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
      dayCtl.set(DEF.day, false);
      latCtl.set(DEF.lat, false);
      tiltCtl.set(DEF.tilt, false);
      speedCtl.set(DEF.speed, false);
      measureCtl.set('day', false);
      measure = 'day';
    },
  });
}
