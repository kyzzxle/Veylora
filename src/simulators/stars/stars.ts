/**
 * Stellar life cycle on a Hertzsprung–Russell diagram.
 *
 * Main-sequence values use standard textbook scaling relations
 * (L in solar luminosities, R in solar radii, M in solar masses):
 *   L ≈ 0.23 M^2.3 (M < 0.43), M^4 (M < 2), 1.4 M^3.5 (M < 55)
 *   R ≈ M^0.8 (M < 1), M^0.57 (M ≥ 1)
 *   T = 5,778 K × (L / R²)^¼          (from L = 4πR²σT⁴)
 *   main-sequence lifetime ≈ 10 billion years × M^−2.5
 * Later stages use typical positions for each kind of star: an approximate,
 * schematic track rather than a detailed stellar-evolution model.
 *   M < 0.5     red dwarf: still on the main sequence everywhere in the universe
 *   0.5 – 8     red giant → planetary nebula → white dwarf
 *   8 – 20      red supergiant → supernova → neutron star
 *   > 20        red supergiant → supernova → black hole
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning'] as const;
const LOGT: [number, number] = [5.1, 3.4]; // hot on the left, as astronomers draw it
const LOGL: [number, number] = [-4.5, 6.5];

type Stage = 'Protostar' | 'Main sequence' | 'Subgiant' | 'Red giant' | 'Helium burning' | 'Asymptotic giant' | 'Planetary nebula' | 'White dwarf' | 'Red supergiant' | 'Supernova' | 'Neutron star' | 'Black hole' | 'Future white dwarf';
interface Point {
  stage: Stage;
  T: number;
  L: number;
  years: number; // time to get here from the previous point
  secs: number; // animation time for this step
  offChart?: boolean;
}

const STAGE_TEXT: Record<Stage, string> = {
  Protostar: 'A cloud of gas and dust collapses under gravity. It heats up and glows, but nuclear fusion has not started yet.',
  'Main sequence': 'Hydrogen fuses into helium in the core. The outward push of hot gas balances gravity, so the star stays stable for most of its life.',
  Subgiant: 'The core runs out of hydrogen. It shrinks and heats up while hydrogen keeps burning in a shell around it, so the outer layers start to swell.',
  'Red giant': 'The outer layers swell enormously and cool, glowing red. The Sun will grow past the orbit of Venus at this stage.',
  'Helium burning': 'The core becomes hot enough (about 100 million °C) to fuse helium into carbon and oxygen. The star settles down for a while.',
  'Asymptotic giant': 'Helium runs out in the core too. The star swells again and puffs off its outer layers in strong winds.',
  'Planetary nebula': 'The ejected outer layers form a glowing shell of gas around the hot exposed core. It fades within tens of thousands of years.',
  'White dwarf': 'The leftover core: about the size of Earth but as massive as the Sun. No fusion happens; it slowly cools and fades over billions of years.',
  'Red supergiant': 'A massive star swells into one of the largest objects in the universe, fusing heavier and heavier elements in layers down to iron.',
  Supernova: 'An iron core cannot release energy by fusion. It collapses in under a second and the star explodes, briefly outshining a whole galaxy.',
  'Neutron star': 'The collapsed core: about 1.4 times the Sun’s mass crushed into a ball about 20 km across. A teaspoon would weigh billions of tonnes.',
  'Black hole': 'The core is so massive that nothing, not even light, can escape its gravity once inside the event horizon.',
  'Future white dwarf': 'Red dwarfs last so long that none has died yet: the universe is only 13.8 billion years old. They are expected to end as faint white dwarfs.',
};

/* ---------- Physics helpers ---------- */
export function mainSequence(M: number) {
  const L = M < 0.43 ? 0.23 * M ** 2.3 : M < 2 ? M ** 4 : M < 55 ? 1.4 * M ** 3.5 : 32000 * M;
  const R = M < 1 ? M ** 0.8 : M ** 0.57;
  const T = 5778 * (L / (R * R)) ** 0.25;
  const life = 1e10 * M ** -2.5 * (M < 0.5 ? 4 : 1); // fully mixed red dwarfs burn almost all their hydrogen
  return { L, R, T, life };
}
const radiusOf = (T: number, L: number) => Math.sqrt(L) / (T / 5778) ** 2;

function buildTrack(M: number): Point[] {
  const ms = mainSequence(M);
  const pre = 3e7 * M ** -2.5;
  const pts: Point[] = [{ stage: 'Protostar', T: 3100, L: 15 * ms.L ** 0.6, years: 0, secs: 0 }];
  if (M >= 0.5) pts.push({ stage: 'Protostar', T: 4000, L: ms.L * 0.6, years: pre * 0.6, secs: 1.5 });
  pts.push({ stage: 'Main sequence', T: ms.T, L: ms.L * 0.8, years: pre * 0.4, secs: 1.5 });
  pts.push({ stage: 'Main sequence', T: ms.T * 0.93, L: ms.L * 1.5, years: ms.life, secs: 6 });
  if (M < 0.5) {
    pts.push({ stage: 'Future white dwarf', T: 7000, L: 1e-3, years: 1e12, secs: 3 });
  } else if (M < 8) {
    const tipL = M < 2.2 ? 2500 : 300 * M ** 1.5;
    const agbL = Math.max(3000, 1000 * M ** 1.3);
    pts.push({ stage: 'Subgiant', T: Math.min(5000, ms.T * 0.8), L: ms.L * 2.2, years: ms.life * 0.08, secs: 1.5 });
    pts.push({ stage: 'Red giant', T: 3400 + 80 * Math.min(M, 3), L: tipL, years: ms.life * 0.05, secs: 2.5 });
    pts.push({ stage: 'Helium burning', T: M < 2 ? 4800 : 5200, L: M < 2 ? 50 : 100 * M ** 1.5, years: ms.life * 0.012, secs: 2 });
    pts.push({ stage: 'Asymptotic giant', T: 3000, L: agbL, years: ms.life * 0.002, secs: 2 });
    pts.push({ stage: 'Planetary nebula', T: 100000, L: agbL * 0.8, years: 3e4, secs: 2 });
    pts.push({ stage: 'White dwarf', T: 30000, L: 0.1, years: 1e6, secs: 1.5 });
    pts.push({ stage: 'White dwarf', T: 6000, L: 1e-4, years: 1e10, secs: 3 });
  } else {
    pts.push({ stage: 'Red supergiant', T: 3600, L: ms.L * 1.6, years: ms.life * 0.1, secs: 3 });
    pts.push({ stage: 'Supernova', T: 15000, L: 1e9, years: 1, secs: 1.5, offChart: true });
    pts.push({ stage: M < 20 ? 'Neutron star' : 'Black hole', T: 15000, L: 1e9, years: 1, secs: 2, offChart: true });
  }
  return pts;
}

/** Approximate colour of a star's light at temperature T. */
function starColour(T: number) {
  const stops: [number, string][] = [[2500, '#ff8a3d'], [3500, '#ffb46b'], [5000, '#ffe2b0'], [6000, '#fff4e8'], [7500, '#f2f4ff'], [10000, '#cad8ff'], [20000, '#a9c1ff'], [40000, '#9bb2ff']];
  const t = clamp(T, 2500, 40000);
  let i = stops.findIndex(([s]) => s >= t);
  if (i <= 0) return stops[Math.max(0, i)][1];
  const [t0, c0] = stops[i - 1];
  const [t1, c1] = stops[i];
  const f = (Math.log(t) - Math.log(t0)) / (Math.log(t1) - Math.log(t0));
  const ch = (c: string, k: number) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
  return `rgb(${[0, 1, 2].map((k) => Math.round(ch(c0, k) + (ch(c1, k) - ch(c0, k)) * f)).join(',')})`;
}

const KNOWN: [string, number, number][] = [
  ['Sun', 5778, 1],
  ['Sirius A', 9940, 25],
  ['Sirius B', 25000, 0.056],
  ['Vega', 9600, 40],
  ['Proxima Centauri', 3042, 0.0017],
  ['Aldebaran', 3910, 440],
  ['Betelgeuse', 3600, 1.1e5],
  ['Rigel', 12100, 1.2e5],
];

const fmtYears = (y: number) =>
  y < 1e3 ? `${Math.round(y)} years` : y < 1e6 ? `${(y / 1e3).toFixed(0)} thousand years` : y < 1e9 ? `${(y / 1e6).toFixed(y < 1e7 ? 1 : 0)} million years` : y < 1e12 ? `${(y / 1e9).toFixed(1)} billion years` : `${(y / 1e12).toFixed(1)} trillion years`;
const fmtNum = (x: number) => (x >= 1000 ? Math.round(x).toLocaleString() : x >= 10 ? x.toFixed(0) : x >= 0.1 ? x.toFixed(2) : x.toExponential(1));

export function initStars(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const textEl = root.querySelector<HTMLElement>('[data-stage-text]')!;

  const st = { M: 1, known: true };
  let track = buildTrack(1);
  let seg = 1; // moving from track[seg-1] to track[seg]
  let f = 0;
  let time = 0;
  let done = false;

  // The slider is logarithmic (0.1 to 40 solar masses); values snap to round numbers
  const NICE = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40];
  const massFromSlider = (v: number) => {
    const raw = 0.1 * 400 ** (v / 100);
    const near = NICE.reduce((a, n) => (Math.abs(Math.log(n / raw)) < Math.abs(Math.log(a / raw)) ? n : a));
    return Math.abs(Math.log(near / raw)) < 0.06 ? near : +raw.toPrecision(2);
  };
  const sliderFromMass = (m: number) => Math.round((100 * Math.log(m / 0.1)) / Math.log(400));

  function restart() {
    track = buildTrack(st.M);
    seg = 1;
    f = 0;
    time = 0;
    done = false;
  }

  const current = () => {
    const a = track[seg - 1];
    const b = track[seg];
    const lt = Math.log10(a.T) + (Math.log10(b.T) - Math.log10(a.T)) * f;
    const ll = Math.log10(a.L) + (Math.log10(b.L) - Math.log10(a.L)) * f;
    return { T: 10 ** lt, L: 10 ** ll, stage: f < 0.02 && seg > 1 ? a.stage : b.stage, off: !!b.offChart };
  };
  const age = () => track.slice(1, seg).reduce((s, p) => s + p.years, 0) + track[seg].years * f;

  function step(dt: number) {
    if (done) return;
    time += dt;
    f += dt / track[seg].secs;
    while (f >= 1) {
      if (seg < track.length - 1) {
        f -= 1;
        seg++;
        sim.announce(`${track[seg].stage}.`);
      } else {
        f = 1;
        done = true;
        sim.pause();
        break;
      }
    }
  }

  /* ---------- Layout ---------- */
  const isStacked = () => size.h > size.w;
  const box = () => (isStacked() ? { bw: 620, bh: 1130 } : { bw: 1000, bh: 560 });
  const chart = () => ({ x: 110, y: 30, w: 490, h: 450 });
  const panel = () => (isStacked() ? { cx: 330, cy: 790, tlY: 990 } : { cx: 810, cy: 210, tlY: 430 });
  const tf = () => {
    const { bw, bh } = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const toXY = (T: number, L: number) => {
    const c = chart();
    const x = c.x + ((Math.log10(T) - LOGT[0]) / (LOGT[1] - LOGT[0])) * c.w;
    const y = c.y + c.h - ((Math.log10(L) - LOGL[0]) / (LOGL[1] - LOGL[0])) * c.h;
    return [x, y] as const;
  };

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    const c = chart();

    /* HR diagram */
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / k;
    ctx.font = fs(11, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    for (const T of [40000, 20000, 10000, 6000, 3000]) {
      const [x] = toXY(T, 1);
      ctx.beginPath();
      ctx.moveTo(x, c.y);
      ctx.lineTo(x, c.y + c.h);
      ctx.stroke();
      ctx.fillText(`${T.toLocaleString()} K`, x, c.y + c.h + 18 / k);
    }
    ctx.textAlign = 'right';
    for (let e = -4; e <= 6; e += 2) {
      const [, y] = toXY(5778, 10 ** e);
      ctx.beginPath();
      ctx.moveTo(c.x, y);
      ctx.lineTo(c.x + c.w, y);
      ctx.stroke();
      ctx.fillText(e === 0 ? '1' : `10${e < 0 ? '⁻' : ''}${'⁰¹²³⁴⁵⁶'[Math.abs(e)]}`, c.x - 8 / k, y + 4 / k);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = pal['text-muted'];
    ctx.font = fs(12, 700);
    ctx.fillText('Surface temperature (hotter ←)', c.x + c.w / 2, c.y + c.h + 38 / k);
    ctx.save();
    ctx.translate(22, c.y + c.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Luminosity (Sun = 1)', 0, 0);
    ctx.restore();

    // Main-sequence band
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x, c.y, c.w, c.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120, 160, 255, 0.18)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let lm = -1; lm <= 1.75; lm += 0.05) {
      const m = mainSequence(10 ** lm);
      const [x, y] = toXY(m.T, m.L * 1.1);
      lm === -1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal['text-faint'];
    const lab = (t: string, T: number, L: number, rot = 0) => {
      const [x, y] = toXY(T, L);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillText(t, 0, 0);
      ctx.restore();
    };
    lab('Main sequence', 14000, 2, 0.5);
    lab('Giants', 5200, 1800);
    lab('Supergiants', 7000, 1.6e6);
    lab('White dwarfs', 30000, 3e-3);

    // Well-known stars
    if (st.known) {
      ctx.font = fs(10.5, 600);
      for (const [name, T, L] of KNOWN) {
        const [x, y] = toXY(T, L);
        ctx.fillStyle = starColour(T);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal['text-faint'];
        // Labels near the right edge go on the left of the dot
        const right = x > c.x + c.w - 90;
        ctx.textAlign = right ? 'right' : 'left';
        ctx.fillText(name, right ? x - 7 : x + 7, y + 4);
      }
    }

    // The track so far
    const cur = current();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.5 / k;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let i = 0; i < seg; i++) {
      if (track[i].offChart) break;
      const [x, y] = toXY(track[i].T, track[i].L);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    if (!cur.off) {
      const [x, y] = toXY(cur.T, cur.L);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Remaining path, faint and dashed
    ctx.setLineDash([4 / k, 5 / k]);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    let started = false;
    for (let i = seg; i < track.length; i++) {
      if (track[i].offChart) break;
      const [x, y] = toXY(track[i].T, track[i].L);
      if (!started) {
        const [cx, cy] = toXY(cur.T, cur.L);
        ctx.moveTo(cx, cy);
        started = true;
      }
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    if (!cur.off) {
      const [x, y] = toXY(cur.T, cur.L);
      ctx.fillStyle = starColour(cur.T);
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    /* Star picture */
    const P = panel();
    const stage = cur.stage;
    ctx.textAlign = 'center';
    if (stage === 'Supernova') {
      const t = Math.min(1, f);
      for (let i = 3; i >= 0; i--) {
        ctx.fillStyle = ['#fff7d6', '#ffd27a', '#ff9a5a', '#c04a8a'][i];
        ctx.globalAlpha = 0.85 - i * 0.15;
        ctx.beginPath();
        ctx.arc(P.cx, P.cy, 20 + t * (40 + i * 35), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (stage === 'Neutron star') {
      ctx.fillStyle = 'rgba(192, 74, 138, 0.25)';
      ctx.beginPath();
      ctx.arc(P.cx, P.cy, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfe0ff';
      ctx.shadowColor = '#8fb4ff';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(P.cx, P.cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // radio beams
      ctx.strokeStyle = 'rgba(160, 200, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const a = time * 3;
      ctx.moveTo(P.cx - Math.cos(a) * 120, P.cy - Math.sin(a) * 120);
      ctx.lineTo(P.cx + Math.cos(a) * 120, P.cy + Math.sin(a) * 120);
      ctx.stroke();
    } else if (stage === 'Black hole') {
      ctx.fillStyle = 'rgba(192, 74, 138, 0.2)';
      ctx.beginPath();
      ctx.arc(P.cx, P.cy, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffb35c';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(P.cx, P.cy, 60, 18, -0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(P.cx, P.cy, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const R = radiusOf(cur.T, cur.L);
      const r = clamp(20 + 24 * Math.log10(R), 4, 140);
      if (stage === 'Planetary nebula' || (stage === 'White dwarf' && seg === track.length - 2 && f < 0.5)) {
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = ['rgba(90, 200, 190, 0.5)', 'rgba(220, 90, 140, 0.45)', 'rgba(120, 150, 255, 0.4)'][i];
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.ellipse(P.cx, P.cy, 70 + i * 22, 55 + i * 16, 0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const g = ctx.createRadialGradient(P.cx, P.cy, r * 0.2, P.cx, P.cy, r * 1.25);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, starColour(cur.T));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(P.cx, P.cy, r * 1.25, 0, Math.PI * 2);
      ctx.fill();
      if (stage === 'Protostar') {
        ctx.strokeStyle = 'rgba(180, 140, 110, 0.5)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.ellipse(P.cx, P.cy, r * 2.6 + 20, r * 0.6 + 6, -0.15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Sun-size reference
    ctx.font = fs(11, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.strokeStyle = pal['text-faint'];
    ctx.lineWidth = 1 / k;
    ctx.beginPath();
    ctx.arc(P.cx - 130, P.cy - 150, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText('Sun’s size', P.cx - 130, P.cy - 116);
    ctx.font = fs(15, 750);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(stage, P.cx, P.cy + 170);

    /* Timeline of stages */
    const names = [...new Set(track.slice(1).map((p) => p.stage))];
    const tw = 340;
    const x0 = P.cx - tw / 2;
    const bw = tw / names.length;
    names.forEach((n, i) => {
      const active = n === stage;
      const passed = names.indexOf(stage) > i;
      ctx.fillStyle = active ? pal.accent : passed ? pal['border-strong'] : pal.border;
      ctx.globalAlpha = active ? 0.95 : 0.6;
      ctx.fillRect(x0 + i * bw + 1, P.tlY, bw - 2, 12);
      ctx.globalAlpha = 1;
    });
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'left';
    ctx.fillText('Start', x0, P.tlY + 28 / k);
    ctx.textAlign = 'right';
    ctx.fillText(names[names.length - 1], x0 + tw, P.tlY + 28 / k);
    ctx.textAlign = 'left';
    ctx.restore();
    updateReadouts(cur);
  }

  function updateReadouts(cur: ReturnType<typeof current>) {
    const ms = mainSequence(st.M);
    ui.readout('stage', cur.stage);
    sim.setBadge(`${st.M} M☉`);
    textEl.textContent = STAGE_TEXT[cur.stage];
    ui.readout('age', fmtYears(age()));
    if (cur.off) {
      ui.readout('temp', '—');
      ui.readout('lum', cur.stage === 'Supernova' ? 'up to about a billion × the Sun, briefly' : '—');
      ui.readout('radius', cur.stage === 'Neutron star' ? 'about 10 km' : cur.stage === 'Black hole' ? `event horizon about ${Math.round(2.95 * Math.max(3, st.M * 0.3))} km` : '—');
    } else {
      ui.readout('temp', `${Math.round(cur.T / 10) * 10} K`);
      ui.readout('lum', `${fmtNum(cur.L)} × the Sun`);
      ui.readout('radius', `${fmtNum(radiusOf(cur.T, cur.L))} × the Sun`);
    }
    ui.readout('life', fmtYears(ms.life));
    const fate = st.M < 0.5 ? 'White dwarf (in the far future)' : st.M < 8 ? 'Planetary nebula, then white dwarf' : st.M < 20 ? 'Supernova, then neutron star' : 'Supernova, then black hole';
    ui.readout('fate', fate, st.M >= 8 ? 'warn' : null);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const mass = ui.range('sl-mass', (v) => `${massFromSlider(v)} × the Sun`, (v) => {
    st.M = massFromSlider(v);
    restart();
    sim.requestRender();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-mass]').forEach((b) => b.addEventListener('click', () => mass.set(sliderFromMass(Number(b.dataset.mass)))));
  root.querySelector('[data-next]')!.addEventListener('click', () => {
    if (seg < track.length - 1) {
      seg++;
      f = 0.05;
    } else f = 1;
    done = seg === track.length - 1 && f >= 1;
    sim.requestRender();
  });
  const known = ui.toggle('sl-known', (v) => ((st.known = v), sim.requestRender()));

  restart();
  const sim = createSimController(root, {
    step,
    render,
    onPlayChange: (playing) => playing && done && restart(),
    reset() {
      st.M = 1;
      mass.set(sliderFromMass(1), false);
      known.set(true, false);
      restart();
    },
  });
  mass.set(sliderFromMass(1), false);
}
