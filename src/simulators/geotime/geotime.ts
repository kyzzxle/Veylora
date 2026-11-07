/**
 * Geological time lab, in four views:
 *   timeline – a zoomable, draggable timeline of eons, eras and periods (ICS 2023)
 *              with key events, a time cursor and a 24-hour-clock comparison.
 *   layers   – a rock cross-section: tilted Paleozoic layers, an angular
 *              unconformity, flat younger layers with fossils, two dated ash beds
 *              and a dike. Peel off the young layers; answer “which is older?”.
 *   fossil   – drag an organism into an environment, set burial, oxygen,
 *              scavengers and minerals, and step through six stages of fossilisation.
 *   dating   – radioactive decay N = N₀·(½)^(t/T) with real half-lives, an atom
 *              grid and decay curve, a sample to match, and ash beds that bracket
 *              a fossil’s age.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { EVENTS, INTERVALS, ISOTOPES, LAYERS, ORGANISMS, type GeoEvent, type Interval, type OrgId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'timeline' | 'layers' | 'fossil' | 'dating';
type Env = 'sea' | 'river' | 'land' | 'resin';
type Pt = [number, number];
const PARENT = '#f08c00';
const DAUGHTER = '#4dabf7';
const AGE = 4540; // Ma, age of Earth used for the 24-hour clock

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function fmtMa(t: number) {
  if (t >= 1000) return `${(t / 1000).toFixed(t >= 4000 ? 2 : 1)} billion years ago`;
  if (t >= 1) return `${t >= 100 ? t.toFixed(0) : t.toFixed(1)} million years ago`;
  if (t >= 0.001) return `${Math.round(t * 1000).toLocaleString('en')} thousand years ago`;
  return 'today';
}
function fmtYears(y: number) {
  if (y >= 1e9) return `${(y / 1e9).toFixed(y >= 1e10 ? 0 : 2)} billion years`;
  if (y >= 1e6) return `${(y / 1e6).toFixed(1)} million years`;
  return `${Math.round(y).toLocaleString('en')} years`;
}
function clock(t: number) {
  const s = Math.round(((AGE - Math.min(t, AGE)) / AGE) * 86400);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- Layers: the order of events, oldest first ---------- */
const ORDER = ['A', 'B', 'C', 'tilt', 'unconformity', 'D', 'E', 'dike', 'F', 'G', 'H'];
const FEATURE_NAMES: Record<string, string> = {
  A: 'Layer A',
  B: 'Layer B',
  C: 'Layer C',
  tilt: 'the tilting of layers A–C',
  unconformity: 'the erosion surface (unconformity)',
  D: 'Layer D',
  E: 'ash layer E',
  dike: 'the dike',
  F: 'Layer F',
  G: 'ash layer G',
  H: 'Layer H',
};
const CONSTRAINT: Record<string, string> = {
  A: 'Paleozoic (trilobites); older than 75 Ma',
  B: 'Paleozoic; older than 75 Ma',
  C: 'Late Paleozoic plants; older than 75 Ma',
  D: 'Older than 75 Ma (below ash E); Mesozoic footprints',
  E: '75 Ma (dated ash)',
  dike: '70 Ma (dated igneous rock)',
  F: 'Between 70 and 66 Ma (above the dike, with ammonites)',
  G: '60 Ma (dated ash)',
  H: 'Younger than 60 Ma',
  unconformity: 'A gap in the record: millions of years of erosion',
};

export function initGeoTime(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    view: 'timeline' as View,
    range: { a: 4600, b: 0 },
    cursor: 66,
    sel: null as Interval | GeoEvent | null,
    removed: 0, // number of top layers peeled off (H, G, F, E, D)
    layerSel: null as string | null,
    q: null as [string, string] | null,
    score: [0, 0],
    org: 'fish' as OrgId,
    env: 'sea' as Env,
    burial: 70,
    oxygen: 30,
    minerals: true,
    scav: false,
    placed: false,
    stage: 0,
    sediment: 0,
    iso: 'k40',
    halves: 1,
    n0: 1000,
    sample: null as number | null,
  };
  let t = 0;
  let stageT = 0;
  let lastMsg = '';
  let anim: { a: number; b: number; a0: number; b0: number; u: number } | null = null;

  /* ======================= Fossil model ======================= */
  function fossilOutcome() {
    const O = ORGANISMS[st.org];
    if (st.org === 'insect') {
      return st.env === 'resin'
        ? { score: 70, type: 'Preserved remains (amber)', ok: true, why: 'Sticky resin sealed the insect away from air and decay, then hardened into amber.' }
        : { score: 3, type: 'No fossil', ok: false, why: 'A small insect on the forest floor is eaten or decays within days.' };
    }
    if (st.env === 'resin') return { score: 0, type: 'No fossil', ok: false, why: 'Only small animals such as insects get trapped in tree resin.' };
    const burial = st.burial / 100;
    const oxy = st.oxygen / 100;
    const envF = st.env === 'sea' ? 1 : st.env === 'river' ? 0.8 : 0.25;
    const score = Math.round(100 * O.hard * (0.25 + 0.75 * burial) * (1 - 0.6 * oxy) * (st.scav ? 0.45 : 1) * envF);
    if (score < 15) {
      const why = st.env === 'land' ? 'On open ground the remains were scavenged, weathered and decayed before anything could bury them.' : burial < 0.3 ? 'Burial was too slow: decay and scavengers destroyed the remains first.' : st.org === 'jelly' ? 'With no hard parts, the jellyfish decayed completely.' : 'Oxygen and decay destroyed the remains.';
      return { score, type: 'No fossil', ok: false, why };
    }
    if (st.org === 'dino') return { score, type: 'Trace fossil (footprints)', ok: true, why: 'Footprints in soft mud were quickly filled and covered by sediment, then turned to rock. They record behaviour, not the body.' };
    if (st.org === 'jelly') return { score, type: 'Impression (very rare)', ok: true, why: 'Very rapid burial in fine mud with little oxygen left a faint impression of the soft body: a rare find.' };
    if (st.org === 'leaf') return { score, type: 'Carbon film (compression)', ok: true, why: 'Pressure squeezed the leaf flat, leaving a thin film of carbon in the fine sediment.' };
    if (st.org === 'shell') return st.minerals ? { score, type: 'Mold and cast', ok: true, why: 'Groundwater dissolved the shell, leaving a hollow mold, which minerals later filled to make a cast.' } : { score, type: 'Body fossil (original shell)', ok: true, why: 'The hard shell itself survived inside the rock.' };
    return st.minerals ? { score, type: 'Petrified (permineralised) bones', ok: true, why: 'Minerals from groundwater filled the tiny spaces in the bones, turning them to stone.' } : { score, type: 'Body fossil (bones)', ok: true, why: 'The bones survived, but the flesh decayed.' };
  }
  const STAGES = ['The organism dies', 'Sediment buries it', 'Soft tissue decays', 'More sediment, rock forms', 'Minerals may fill or replace', 'Uplift and erosion expose it'];

  /* ======================= Dating model ======================= */
  const iso = () => ISOTOPES[st.iso];
  const frac = (h: number) => 0.5 ** h;

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (anim) {
      anim.u = Math.min(1, anim.u + dt * 2.5);
      const e = anim.u * anim.u * (3 - 2 * anim.u);
      st.range = { a: lerp(anim.a0, anim.a, e), b: lerp(anim.b0, anim.b, e) };
      if (anim.u >= 1) anim = null;
    }
    if (st.view === 'fossil' && st.placed) {
      stageT += dt;
      if (st.stage === 1 || st.stage === 3) st.sediment = Math.min(st.stage === 1 ? 3 : 8, st.sediment + dt * (0.4 + 1.6 * (st.burial / 100)));
      if (stageT > 3.2 && st.stage < 5) goStage(st.stage + 1);
    }
    if (st.view === 'dating' && st.sample === null) {
      st.halves = Math.min(6, st.halves + dt * 0.25);
      halvesCtl.set(Math.round(st.halves * 100) / 100, false);
      if (st.halves >= 6) sim.pause();
    }
  }
  function goStage(i: number) {
    st.stage = clamp(i, 0, 5);
    stageT = 0;
    if (st.stage >= 3) st.sediment = Math.max(st.sediment, 3);
    if (st.stage >= 4) st.sediment = Math.max(st.sediment, 7);
    if (st.stage === 5) {
      const o = fossilOutcome();
      lastMsg = `${o.type}. ${o.why}${o.ok ? '' : ' Most organisms never become fossils.'}`;
      sim.announce(o.type);
    }
    sim.requestRender();
  }

  /* ======================= 2D helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let cur = 1;
  let K = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(s: string, x: number, y: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600, maxY = Infinity) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    let line = '';
    for (const w of s.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        if (y + lh > maxY) {
          ctx.fillText(`${line}…`, x, y);
          return y + lh;
        }
        ctx.fillText(line, x, y);
        line = w;
        y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lh;
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
  function pill(s: string, x: number, y: number, align: CanvasTextAlign = 'left', px = 11, color = pal['sim-text']) {
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
    text(s, x, y, px, color, align, 700);
    return [x0, x0 + w + 2 * pad];
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

  /* ======================= Timeline ======================= */
  const tlLayout = () =>
    portrait()
      ? { x: 14, w: 652, rows: [72, 112, 152], rowH: 36, lane: [200, 560], axis: 580, info: { x: 14, y: 620, w: 652, h: 370 } }
      : { x: 20, w: 960, rows: [70, 106, 142], rowH: 32, lane: [184, 340], axis: 356, info: { x: 20, y: 398, w: 960, h: 190 } };
  const X = (tm: number) => {
    const L = tlLayout();
    return L.x + ((st.range.a - tm) / (st.range.a - st.range.b)) * L.w;
  };
  const T = (x: number) => {
    const L = tlLayout();
    return st.range.a - ((x - L.x) / L.w) * (st.range.a - st.range.b);
  };
  let eventHits: { e: GeoEvent; x: number; y: number }[] = [];
  function niceStep(span: number) {
    const raw = span / 6;
    const p = 10 ** Math.floor(Math.log10(raw));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function drawTimeline() {
    const L = tlLayout();
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.x, 0, L.w, L.axis + 30);
    ctx.clip();
    for (const iv of INTERVALS) {
      if (iv.end > st.range.a || iv.start < st.range.b) continue;
      const x0 = Math.max(L.x, X(iv.start));
      const x1 = Math.min(L.x + L.w, X(iv.end));
      const y = L.rows[iv.level];
      const sel = st.sel === iv;
      ctx.fillStyle = iv.color;
      ctx.fillRect(x0, y, x1 - x0, L.rowH);
      ctx.strokeStyle = sel ? pal['sim-text'] : withAlpha('#000000', 0.25);
      ctx.lineWidth = (sel ? 2.5 : 1) / cur;
      ctx.strokeRect(x0, y, x1 - x0, L.rowH);
      ctx.font = fs(11, 750);
      const label = `${iv.name}${iv.level === 1 && /ean$|zoic$/.test(iv.name) && !iv.name.includes('Era') ? ' eon' : ''}`;
      const nm = ctx.measureText(label).width < x1 - x0 - 8 ? label : ctx.measureText(iv.name.slice(0, 3)).width < x1 - x0 - 6 ? iv.name.slice(0, 3) : '';
      if (nm) text(nm, (x0 + x1) / 2, y + L.rowH / 2 + 4 / cur, 11, '#212529', 'center', 750);
    }
    // events
    eventHits = [];
    const laneRows = portrait() ? 9 : 5;
    const used: [number, number][][] = Array.from({ length: laneRows }, () => []);
    const vis = EVENTS.filter((e) => e.t <= st.range.a && e.t >= st.range.b).sort((p, q) => q.t - p.t);
    for (const e of vis) {
      const x = X(e.t);
      ctx.font = fs(10.5, 700);
      const w = ctx.measureText(e.name).width + 14 / cur;
      const align: CanvasTextAlign = x > L.x + L.w - w ? 'right' : x < L.x + w / 2 ? 'left' : 'center';
      const ext: [number, number] = align === 'left' ? [x, x + w] : align === 'right' ? [x - w, x] : [x - w / 2, x + w / 2];
      let row = -1;
      for (let r = 0; r < laneRows; r++)
        if (used[r].every(([a0, a1]) => ext[1] + 6 / cur < a0 || ext[0] - 6 / cur > a1)) {
          row = r;
          break;
        }
      const col = e.kind === 'extinction' ? pal.danger : e.kind === 'life' ? pal.success : '#1c7ed6';
      ctx.strokeStyle = withAlpha(col, 0.6);
      ctx.lineWidth = 1.2 / cur;
      const ly = L.lane[0] + 14 + Math.max(0, row) * ((L.lane[1] - L.lane[0] - 20) / laneRows);
      ctx.beginPath();
      ctx.moveTo(x, L.rows[2] + L.rowH);
      ctx.lineTo(x, row >= 0 ? ly : L.lane[0]);
      ctx.stroke();
      ell(x, L.rows[2] + L.rowH + 4, 3.5 / cur, 3.5 / cur, col);
      if (row >= 0) {
        used[row].push(ext);
        pill(`${e.approx ? '~' : ''}${e.name}`, x, ly, align, 10.5, st.sel === e ? pal.accent : col);
        eventHits.push({ e, x, y: ly });
      } else eventHits.push({ e, x, y: L.rows[2] + L.rowH + 4 });
    }
    // cursor
    const cx = X(st.cursor);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.5 / cur;
    ctx.beginPath();
    ctx.moveTo(cx, L.rows[0] - 4);
    ctx.lineTo(cx, L.axis);
    ctx.stroke();
    ctx.restore();
    // axis
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.moveTo(L.x, L.axis);
    ctx.lineTo(L.x + L.w, L.axis);
    ctx.stroke();
    const span = st.range.a - st.range.b;
    const stp = niceStep(span);
    for (let v = Math.ceil(st.range.b / stp) * stp; v <= st.range.a; v += stp) {
      const x = X(v);
      ctx.beginPath();
      ctx.moveTo(x, L.axis);
      ctx.lineTo(x, L.axis + 6);
      ctx.stroke();
      text(v === 0 ? 'Now' : `${v >= 1 ? +v.toFixed(2) : +v.toFixed(3)} Ma`, x, L.axis + 20 / cur, 10, pal['text-muted'], x > L.x + L.w - 24 ? 'right' : x < L.x + 24 ? 'left' : 'center', 650);
    }
    pill(`${fmtMa(st.cursor)}`, Math.min(L.x + L.w - 4, Math.max(L.x + 4, cx)), L.rows[0] - 14 / cur, cx > L.x + L.w - 120 ? 'right' : cx < L.x + 120 ? 'left' : 'center', 11, pal.accent);
    // info panel
    const P = L.info;
    panel(P.x, P.y, P.w, P.h);
    const at = INTERVALS.filter((iv) => iv.start >= st.cursor && iv.end <= st.cursor);
    const nm = (lv: number) => at.find((iv) => iv.level === lv)?.name ?? '—';
    text(`At the cursor: ${fmtMa(st.cursor)}`, P.x + 14, P.y + 24, 13, pal['sim-text'], 'left', 800);
    text(`${nm(0)} · ${nm(1)}${st.cursor <= 538.8 ? ` · ${nm(2)} Period` : ''}`, P.x + 14, P.y + 24 + 20 / cur, 11.5, pal['text-muted'], 'left', 700);
    text(`On a 24-hour clock of Earth’s history, this is ${clock(st.cursor)}`, P.x + 14, P.y + 24 + 40 / cur, 11.5, pal['text-muted'], 'left', 650);
    const s = st.sel;
    if (s) {
      const title = 'start' in s ? `${s.name}: ${s.approx ? 'about ' : ''}${s.start} to ${s.end} Ma` : `${s.approx ? 'About ' : ''}${fmtMa(s.t)}: ${s.name}`;
      text(title, P.x + 14, P.y + 24 + 66 / cur, 12, pal.accent, 'left', 800);
      wrap(s.text, P.x + 14, P.y + 24 + 84 / cur, P.w - 28, 11.5, pal['text-muted'], 600, P.y + P.h - 8);
    } else wrap('Tap a coloured interval to zoom into it, tap an event to read about it, and drag the timeline to move along it. Drag the orange cursor to read any moment.', P.x + 14, P.y + 24 + 66 / cur, P.w - 28, 11.5, pal['text-muted'], 600, P.y + P.h - 8);
  }
  function zoomTo(a: number, b: number) {
    const pad = (a - b) * 0.04;
    anim = { a0: st.range.a, b0: st.range.b, a: Math.min(4700, a + pad), b: Math.max(-0.0001, b - pad), u: 0 };
    if (!sim.running) sim.play();
  }
  function zoomBy(f: number) {
    const c = clamp(st.cursor, st.range.b, st.range.a);
    const a = c + (st.range.a - c) * f;
    const b = c - (c - st.range.b) * f;
    if (a - b < 0.05 && f < 1) return;
    zoomTo(Math.min(4600, a), Math.max(0, b));
  }

  /* ======================= Layers ======================= */
  const lyLayout = () => (portrait() ? { sec: { x: 14, y: 70, w: 652, h: 560 }, info: { x: 14, y: 642, w: 652, h: 346 } } : { sec: { x: 14, y: 14, w: 640, h: 572 }, info: { x: 666, y: 70, w: 320, h: 516 } });
  // local section coordinates 640 × 440; ground surface at y = 40
  const TOPS: Record<string, number> = { H: 40, G: 92, F: 104, E: 152, D: 164 };
  const UPPER = ['H', 'G', 'F', 'E', 'D'];
  const unc = (x: number) => 214 + 6 * Math.sin(x / 40);
  const tiltB = (k: number, x: number) => [470, 380, 310, 240][k] - 0.25 * (x - 320);
  const DIKE = (y: number) => 430 + (440 - y) * 0.05;
  let secFrame = { x: 0, y: 0, s: 1 };
  const cutY = () => (st.removed >= 5 ? unc(0) - 8 : TOPS[UPPER[st.removed]]);
  function featureAt(lx: number, ly: number): string | null {
    if (ly < cutY() - 2 || ly > 440 || lx < 0 || lx > 640) return null;
    if (Math.abs(lx - DIKE(ly)) < 11 && ly > TOPS.E) return 'dike';
    if (Math.abs(ly - unc(lx)) < 5) return 'unconformity';
    if (ly < unc(lx)) {
      for (const id of UPPER) {
        const top = TOPS[id];
        const idx = UPPER.indexOf(id);
        const bottom = idx < 4 ? TOPS[UPPER[idx + 1]] : unc(lx);
        if (ly >= top && ly < bottom) return id;
      }
      return null;
    }
    if (ly > tiltB(1, lx)) return 'A';
    if (ly > tiltB(2, lx)) return 'B';
    return 'C';
  }
  function fossilIcon(kind: string, x: number, y: number, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = '#3b2a20';
    ctx.fillStyle = withAlpha('#3b2a20', 0.25);
    ctx.lineWidth = 1.3;
    if (kind === 'trilobite') {
      ell(0, 0, 7, 10, withAlpha('#3b2a20', 0.25), '#3b2a20', 1.3);
      for (let k = -6; k <= 6; k += 3) {
        ctx.beginPath();
        ctx.moveTo(-6, k);
        ctx.lineTo(6, k);
        ctx.stroke();
      }
    } else if (kind === 'brachiopod') {
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.quadraticCurveTo(0, -10, 8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'fern') {
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, -10);
      for (let k = -8; k < 9; k += 3) {
        ctx.moveTo(0, k);
        ctx.lineTo(-6, k - 3);
        ctx.moveTo(0, k);
        ctx.lineTo(6, k - 3);
      }
      ctx.stroke();
    } else if (kind === 'footprint') {
      for (const dx of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(dx, -6);
        ctx.stroke();
      }
    } else if (kind === 'ammonite') {
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.2) {
        const r = 1 + a * 0.75;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
    } else if (kind === 'tooth') {
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(4, -5);
      ctx.lineTo(2, 6);
      ctx.lineTo(-2, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawLayers() {
    const L = lyLayout();
    const S = L.sec;
    panel(S.x, S.y, S.w, S.h, pal['surface-2']);
    const s = Math.min((S.w - 12) / 640, (S.h - 12) / 440);
    const ox = S.x + (S.w - 640 * s) / 2;
    const oy = S.y + (S.h - 440 * s) / 2;
    secFrame = { x: ox, y: oy, s };
    enter(ox, oy, s);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 640, 440);
    ctx.clip();
    const cy = cutY();
    // tilted lower layers
    const colors = { A: LAYERS[0].color, B: LAYERS[1].color, C: LAYERS[2].color };
    (['A', 'B', 'C'] as const).forEach((id, k) => {
      ctx.fillStyle = colors[id];
      ctx.beginPath();
      for (let x = 0; x <= 640; x += 8) ctx.lineTo(x, Math.max(k === 2 ? unc(x) : tiltB(k + 1, x), Math.max(unc(x), cy)));
      for (let x = 640; x >= 0; x -= 8) ctx.lineTo(x, Math.max(tiltB(k, x), unc(x)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha('#000000', 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    // upper flat layers, from the bottom (D) up
    for (let i = 4; i >= st.removed; i--) {
      const id = UPPER[i];
      const lay = LAYERS.find((l) => l.id === id)!;
      const top = TOPS[id];
      ctx.fillStyle = lay.color;
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(640, top);
      if (i === 4) for (let x = 640; x >= 0; x -= 8) ctx.lineTo(x, unc(x));
      else {
        ctx.lineTo(640, TOPS[UPPER[i + 1]]);
        ctx.lineTo(0, TOPS[UPPER[i + 1]]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha('#000000', 0.2);
      ctx.stroke();
      if (id === 'E' || id === 'G') {
        for (let x = 6; x < 640; x += 14) ell(x, top + 6, 1.2, 1.2, withAlpha('#868e96', 0.8));
      }
    }
    // unconformity line
    ctx.strokeStyle = '#c92a2a';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    for (let x = 0; x <= 640; x += 6) ctx.lineTo(x, unc(x));
    ctx.stroke();
    ctx.setLineDash([]);
    // dike: cuts A–E, truncated by F
    ctx.fillStyle = '#495057';
    ctx.beginPath();
    const dTop = st.removed >= 5 ? unc(DIKE(214)) : Math.max(cy, TOPS.E);
    ctx.moveTo(DIKE(440) - 10, 440);
    ctx.lineTo(DIKE(dTop) - 9, dTop);
    ctx.lineTo(DIKE(dTop) + 9, dTop);
    ctx.lineTo(DIKE(440) + 10, 440);
    ctx.closePath();
    ctx.fill();
    // fossils
    const place: Record<string, Pt[]> = { A: [[80, 430], [520, 390]], B: [[150, 380], [600, 330]], C: [[60, 330], [300, 275]], D: [[120, 192], [520, 188]], F: [[200, 126], [560, 130]], H: [[90, 66], [470, 72]] };
    for (const lay of LAYERS) {
      if (!lay.fossilKind) continue;
      const i = UPPER.indexOf(lay.id);
      if (i >= 0 && i < st.removed) continue;
      for (const [x, y] of place[lay.id] ?? []) if (y > cy) fossilIcon(lay.fossilKind, x, y, 1.1);
    }
    // surface
    ctx.fillStyle = '#74b816';
    ctx.fillRect(0, cy - 6, 640, 6);
    // selection
    if (st.layerSel) {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 3;
      const f = st.layerSel;
      ctx.beginPath();
      if (f === 'dike') ctx.rect(DIKE(300) - 14, Math.max(cy, TOPS.E), 28, 440 - Math.max(cy, TOPS.E));
      else if (UPPER.includes(f)) {
        const i = UPPER.indexOf(f);
        const bottom = i < 4 ? TOPS[UPPER[i + 1]] : 214;
        ctx.rect(2, TOPS[f], 636, bottom - TOPS[f]);
      }
      ctx.stroke();
    }
    ctx.restore();
    // labels
    const lab = (s2: string, x: number, y: number) => pill(s2, x, y, 'left', 10.5);
    for (const id of UPPER.slice(st.removed)) lab(id === 'E' || id === 'G' ? `Ash ${id}` : id, 8, TOPS[id] + (id === 'G' || id === 'E' ? 8 : 20));
    lab('C', 8, unc(0) + 30);
    lab('B', 8, 360);
    lab('A', 8, 430);
    if (st.removed >= 5 || st.layerSel === 'unconformity') pill('Unconformity', 330, unc(330) - 10, 'center', 10.5, '#c92a2a');
    lab('Dike', DIKE(380) + 14, 390);
    leave();
    if (st.removed < 5) pill('Drag the top layer away', S.x + 14, S.y + 22, 'left', 11, pal.accent);
    if (st.q) pill(`Which is older: ${FEATURE_NAMES[st.q[0]]} or ${FEATURE_NAMES[st.q[1]]}?`, S.x + S.w / 2, S.y + S.h - 16, 'center', 11.5, pal.accent);
    drawLayerInfo(L.info);
  }
  function drawLayerInfo(P: { x: number; y: number; w: number; h: number }) {
    panel(P.x, P.y, P.w, P.h);
    text('Oldest at the bottom', P.x + 14, P.y + 22, 12.5, pal['sim-text'], 'left', 800);
    const rows = [...ORDER].reverse();
    const lh = (P.h - 40) / rows.length;
    rows.forEach((f, k) => {
      const y = P.y + 40 + k * lh + lh * 0.65;
      const sel = st.layerSel === f;
      const lay = LAYERS.find((l) => l.id === f);
      ctx.fillStyle = f === 'dike' ? '#495057' : f === 'unconformity' ? '#c92a2a' : f === 'tilt' ? pal['text-faint'] : lay!.color;
      ctx.fillRect(P.x + 14, y - 9 / cur, 14 / cur, 10 / cur);
      const nm = f === 'tilt' ? 'Tilting' : f === 'unconformity' ? 'Erosion (unconformity)' : f === 'dike' ? 'Dike intrudes' : lay!.name;
      text(`${ORDER.length - k}. ${nm}`, P.x + 14 + 20 / cur, y, 10.5, sel ? pal.accent : pal['sim-text'], 'left', sel ? 800 : 650);
    });
  }

  /* ======================= Fossil view ======================= */
  const fsLayout = () => (portrait() ? { scene: { x: 14, y: 70, w: 652, h: 560 }, strip: { x: 14, y: 642, w: 652, h: 346 } } : { scene: { x: 14, y: 14, w: 640, h: 572 }, strip: { x: 666, y: 70, w: 320, h: 516 } });
  let sceneFrame = { x: 0, y: 0, s: 1 };
  const TRAY = { x: 12, y: 12, w: 170, h: 60 };
  const SPOT = { x: 320, y: 300 }; // where the organism lies (local 640 × 440)
  let drag: Pt | null = null;
  function drawOrganism(x: number, y: number, decay: number, kind: OrgId, minerals: number) {
    const flesh = 1 - decay;
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'fish') {
      ell(0, 0, 46, 15, withAlpha('#74c0fc', flesh), withAlpha('#1c7ed6', flesh), 1.5);
      ctx.strokeStyle = mixC('#f1f3f5', '#495057', minerals);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(36, 0);
      for (let k = -30; k < 32; k += 8) {
        ctx.moveTo(k, -10);
        ctx.lineTo(k, 10);
      }
      ctx.stroke();
      ell(40, 0, 7, 7, mixC('#f1f3f5', '#495057', minerals));
      ctx.beginPath();
      ctx.moveTo(-44, 0);
      ctx.lineTo(-60, -12);
      ctx.lineTo(-60, 12);
      ctx.closePath();
      ctx.fillStyle = withAlpha('#74c0fc', flesh);
      ctx.fill();
    } else if (kind === 'shell') {
      ctx.fillStyle = mixC('#e9ecef', '#868e96', minerals);
      ctx.beginPath();
      ctx.moveTo(-26, 6);
      ctx.quadraticCurveTo(0, -30, 26, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (let k = -18; k <= 18; k += 6) {
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(k, -14 + Math.abs(k) * 0.5);
        ctx.stroke();
      }
    } else if (kind === 'leaf') {
      ctx.rotate(-0.2);
      ctx.fillStyle = mixC('#51cf66', '#343a40', decay);
      ctx.beginPath();
      ctx.moveTo(-36, 0);
      ctx.quadraticCurveTo(0, -18, 36, 0);
      ctx.quadraticCurveTo(0, 18, -36, 0);
      ctx.fill();
    } else if (kind === 'jelly') {
      ell(0, 0, 30, 9, withAlpha('#e599f7', flesh * 0.8), withAlpha('#be4bdb', flesh), 1.2);
    } else if (kind === 'dino') {
      for (let k = 0; k < 3; k++) {
        const fx = -50 + k * 50;
        ctx.strokeStyle = '#5c3d2e';
        ctx.lineWidth = 3;
        for (const dx of [-8, 0, 8]) {
          ctx.beginPath();
          ctx.moveTo(fx, 6);
          ctx.lineTo(fx + dx, -6);
          ctx.stroke();
        }
      }
    } else if (kind === 'insect') {
      ell(0, 0, 10, 4, '#343a40');
      ell(-6, -4, 7, 3, withAlpha('#e7f5ff', 0.8), null, 1, -0.5);
    }
    ctx.restore();
  }
  const mixC = (c1: string, c2: string, u: number) => {
    const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1);
    const b = p(c2);
    return `#${a.map((v, i) => Math.round(lerp(v, b[i], clamp(u, 0, 1))).toString(16).padStart(2, '0')).join('')}`;
  };
  function drawFossil() {
    const L = fsLayout();
    const S = L.scene;
    panel(S.x, S.y, S.w, S.h, pal['surface-2']);
    const s = Math.min((S.w - 12) / 640, (S.h - 12) / 440);
    const ox = S.x + (S.w - 640 * s) / 2;
    const oy = S.y + (S.h - 440 * s) / 2;
    sceneFrame = { x: ox, y: oy, s };
    enter(ox, oy, s);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 640, 440);
    ctx.clip();
    const stage = st.placed ? st.stage : -1;
    const u = st.placed ? clamp(stageT / 3, 0, 1) : 0;
    const uplift = stage === 5 ? 190 * Math.min(1, u * 1.4) : 0;
    const floor = 310 - uplift;
    const resin = st.env === 'resin';
    // background
    if (st.env === 'sea' || st.env === 'river') {
      ctx.fillStyle = st.env === 'sea' ? '#a5d8ff' : '#c5f6fa';
      ctx.fillRect(0, 0, 640, floor);
    } else {
      ctx.fillStyle = '#e7f5ff';
      ctx.fillRect(0, 0, 640, floor);
    }
    if (resin) {
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(250, 0, 140, floor);
      text('Tree trunk', 320, 40, 11, '#ffffff', 'center', 700);
    }
    // ground and sediment pile
    ctx.fillStyle = st.env === 'land' ? '#a9845a' : '#c9b38a';
    ctx.fillRect(0, floor, 640, 440 - floor);
    const sed = st.placed ? st.sediment : 0;
    const layerH = 14;
    const top = floor - sed * layerH;
    for (let k = 0; k < Math.ceil(sed); k++) {
      const h = Math.min(1, sed - k) * layerH;
      const y = floor - k * layerH - h;
      ctx.fillStyle = mixC(k % 2 ? '#d4b483' : '#bfa071', '#8a7356', stage >= 3 ? 0.5 : 0);
      ctx.fillRect(0, y, 640, h);
    }
    // erosion after uplift
    if (stage === 5) {
      const eroded = Math.min(1, Math.max(0, u * 1.4 - 0.4));
      ctx.fillStyle = '#e7f5ff';
      ctx.fillRect(0, 0, 640, top + (floor - top) * eroded + 4);
      ctx.fillStyle = '#74b816';
      ctx.fillRect(0, top + (floor - top) * eroded, 640, 5);
    }
    // the organism
    if (st.placed) {
      const O = fossilOutcome();
      const decay = stage < 2 ? (stage === 1 ? u * 0.3 : 0) : stage === 2 ? 0.3 + u * 0.7 : 1;
      const mins = stage >= 4 && st.minerals ? (stage === 4 ? u : 1) : 0;
      const orgY = resin ? 140 : floor - 8;
      const exposedFail = !O.ok && stage >= 2;
      if (resin && st.org === 'insect') {
        ell(320, orgY, 26 + (stage >= 1 ? 6 : 0), 20, withAlpha('#fab005', stage >= 1 ? 0.7 : 0.3), '#e67700', 1.5);
        drawOrganism(320, orgY, 0, 'insect', 0);
      } else if (!exposedFail || stage < 3) {
        ctx.globalAlpha = exposedFail ? 1 - u : 1;
        drawOrganism(320, orgY, st.org === 'jelly' ? decay : decay, st.org, mins);
        ctx.globalAlpha = 1;
      }
      if (stage === 4 && st.minerals && O.ok) for (let k = 0; k < 18; k++) ell(320 + (rnd(k) - 0.5) * 120, orgY + (rnd(k + 9) - 0.5) * 30, 2, 2, withAlpha('#ffffff', 0.9 * Math.sin(t * 4 + k) ** 2));
      if (st.scav && stage <= 2 && !resin) {
        // a scavenger nibbles while the remains are exposed
        const bx = 320 + Math.sin(t * 2) * 60;
        ell(bx, orgY - 30, 14, 6, '#5c3d2e');
        ell(bx + 14, orgY - 34, 5, 5, '#5c3d2e');
      }
      if (stage === 5) pill(O.type, 320, Math.max(40, floor - 60), 'center', 13, O.ok ? pal.success : pal.danger);
    } else {
      text('Drag the organism here', SPOT.x, SPOT.y - 40, 13, pal.accent, 'center', 750);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(SPOT.x - 80, SPOT.y - 30, 160, 50);
      ctx.setLineDash([]);
    }
    ctx.restore();
    // tray
    if (!st.placed) {
      panel(TRAY.x, TRAY.y, TRAY.w, TRAY.h);
      drawOrganism(TRAY.x + 52, TRAY.y + 32, 0, st.org, 0);
      text(ORGANISMS[st.org].name.split(' (')[0], TRAY.x + 104, TRAY.y + 36, 11, pal['sim-text'], 'left', 700);
    }
    if (drag) drawOrganism(drag[0], drag[1], 0, st.org, 0);
    leave();
    drawFossilStrip(L.strip);
  }
  function drawFossilStrip(P: { x: number; y: number; w: number; h: number }) {
    panel(P.x, P.y, P.w, P.h);
    text('Stages of fossilisation', P.x + 14, P.y + 22, 12.5, pal['sim-text'], 'left', 800);
    const lh = 24 / cur;
    STAGES.forEach((nm, k) => {
      const y = P.y + 30 + (k + 1) * lh;
      const on = st.placed && st.stage >= k;
      ell(P.x + 22, y - 4 / cur, 8 / cur, 8 / cur, on ? pal.accent : withAlpha(pal['text-faint'], 0.3));
      text(String(k + 1), P.x + 22, y, 10, '#ffffff', 'center', 800);
      text(nm, P.x + 38, y, 11, st.placed && st.stage === k ? pal.accent : on ? pal['sim-text'] : pal['text-muted'], 'left', st.stage === k ? 800 : 650);
    });
    const O = fossilOutcome();
    const y0 = P.y + 30 + 7 * lh + 6;
    text(`Preservation score: ${O.score}%`, P.x + 14, y0, 11.5, O.score >= 15 ? pal['sim-text'] : pal.danger, 'left', 750);
    const bw = P.w - 28;
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.25);
    ctx.fillRect(P.x + 14, y0 + 8 / cur, bw, 8 / cur);
    ctx.fillStyle = O.score >= 15 ? pal.success : pal.danger;
    ctx.fillRect(P.x + 14, y0 + 8 / cur, (bw * Math.min(100, O.score)) / 100, 8 / cur);
    wrap(st.placed && st.stage === 5 ? `${O.type}: ${O.why}` : `Likely result: ${O.type}. ${ORGANISMS[st.org].text}`, P.x + 14, y0 + 34 / cur, P.w - 28, 11, pal['text-muted'], 600, P.y + P.h - 8);
  }

  /* ======================= Dating view ======================= */
  const dtLayout = () =>
    portrait()
      ? { grid: { x: 14, y: 70, w: 652, h: 170 }, curve: { x: 14, y: 250, w: 652, h: 250 }, formula: { x: 14, y: 510, w: 652, h: 300 }, bracket: { x: 14, y: 820, w: 652, h: 170 } }
      : { grid: { x: 14, y: 14, w: 330, h: 330 }, curve: { x: 356, y: 70, w: 630, h: 274 }, bracket: { x: 14, y: 356, w: 470, h: 230 }, formula: { x: 496, y: 356, w: 490, h: 230 } };
  function drawDating() {
    const L = dtLayout();
    const I = iso();
    const fr = frac(st.halves);
    // atom grid: 200 representative atoms
    const G = L.grid;
    panel(G.x, G.y, G.w, G.h);
    text(`${st.n0.toLocaleString('en')} atoms of ${I.parent} at the start`, G.x + 12, G.y + 20, 11.5, pal['sim-text'], 'left', 750);
    const cols = portrait() ? 25 : 14;
    const rows = Math.ceil(200 / cols);
    const cell = Math.min((G.w - 24) / cols, (G.h - 40) / rows);
    const gx = G.x + (G.w - cols * cell) / 2;
    const gy = G.y + 30 + (G.h - 36 - rows * cell) / 2;
    for (let k = 0; k < 200; k++) {
      const parent = rnd(k + 17) < fr;
      ell(gx + (k % cols) * cell + cell / 2, gy + Math.floor(k / cols) * cell + cell / 2, cell * 0.36, cell * 0.36, parent ? PARENT : DAUGHTER);
    }
    // decay curve
    const C = L.curve;
    panel(C.x, C.y, C.w, C.h);
    const P = { x: C.x + 46, y: C.y + 30, w: C.w - 62, h: C.h - 30 - 16 - 34 / cur };
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1 / cur;
    ctx.strokeRect(P.x, P.y, P.w, P.h);
    const Xh = (h: number) => P.x + (h / 6) * P.w;
    const Yf = (f: number) => P.y + P.h - f * P.h;
    for (let h = 0; h <= 6; h++) {
      text(`${h}`, Xh(h), P.y + P.h + 14 / cur, 10, pal['text-muted'], 'center', 650);
      ctx.strokeStyle = withAlpha(pal['text-faint'], 0.25);
      ctx.beginPath();
      ctx.moveTo(Xh(h), P.y);
      ctx.lineTo(Xh(h), P.y + P.h);
      ctx.stroke();
    }
    text('Half-lives elapsed →', P.x + P.w / 2, P.y + P.h + 30 / cur, 10, pal['text-muted'], 'center', 650);
    for (const f of [0, 0.25, 0.5, 0.75, 1]) text(`${f * 100}%`, P.x - 6, Yf(f) + 3 / cur, 9.5, pal['text-muted'], 'right', 600);
    for (const [col, fn] of [[PARENT, (h: number) => frac(h)], [DAUGHTER, (h: number) => 1 - frac(h)]] as [string, (h: number) => number][]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5 / cur;
      ctx.beginPath();
      for (let h = 0; h <= 6; h += 0.05) {
        if (h === 0) ctx.moveTo(Xh(h), Yf(fn(h)));
        else ctx.lineTo(Xh(h), Yf(fn(h)));
      }
      ctx.stroke();
    }
    ctx.strokeStyle = pal.accent;
    ctx.setLineDash([5 / cur, 4 / cur]);
    ctx.beginPath();
    ctx.moveTo(Xh(st.halves), P.y);
    ctx.lineTo(Xh(st.halves), P.y + P.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ell(Xh(st.halves), Yf(fr), 5 / cur, 5 / cur, PARENT, '#ffffff', 1.5 / cur);
    ell(Xh(st.halves), Yf(1 - fr), 5 / cur, 5 / cur, DAUGHTER, '#ffffff', 1.5 / cur);
    text(`Parent ${I.parent}`, P.x + P.w - 8, P.y + P.h * 0.42, 10.5, PARENT, 'right', 750);
    text(`Daughter ${I.daughter}`, P.x + P.w - 8, P.y + P.h * 0.42 + 16 / cur, 10.5, DAUGHTER, 'right', 750);
    text(`N = N₀ × (½)^(t / T)`, C.x + C.w - 14, C.y + 20, 12, pal['sim-text'], 'right', 750);
    // sample to match
    if (st.sample !== null) {
      const sf = frac(st.sample);
      ctx.strokeStyle = pal.danger;
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      ctx.moveTo(P.x, Yf(sf));
      ctx.lineTo(P.x + P.w, Yf(sf));
      ctx.stroke();
      pill(`Sample: ${(sf * 100).toFixed(0)}% parent left`, P.x + 10, Yf(sf) - 10 / cur, 'left', 10.5, pal.danger);
    }
    drawBracket(L.bracket);
    drawFormula(L.formula);
  }
  function drawBracket(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    text('Dating a fossil with ash layers', B.x + 12, B.y + 20, 11.5, pal['sim-text'], 'left', 750);
    const cx = B.x + 20;
    const cw = Math.min(150, B.w * 0.42);
    const top = B.y + 36;
    const h = B.h - 46;
    const bands: [string, string, number][] = [
      ['Ash: 60 Ma', '#f3eee6', 0.16],
      ['Fossil layer', '#9c8f7a', 0.5],
      ['Ash: 75 Ma', '#efe7da', 0.16],
      ['Older rock', '#d9895b', 0.18],
    ];
    let y = top;
    for (const [nm, col, f] of bands) {
      ctx.fillStyle = col;
      ctx.fillRect(cx, y, cw, h * f);
      ctx.strokeStyle = withAlpha('#000000', 0.25);
      ctx.strokeRect(cx, y, cw, h * f);
      if (nm === 'Fossil layer') fossilIcon('ammonite', cx + cw - 24, y + (h * f) / 2, 1.4);
      text(nm, cx + 8, y + (h * f) / 2 + 4 / cur, 10.5, '#212529', 'left', 750);
      y += h * f;
    }
    wrap('The fossil is younger than the ash below it and older than the ash above it: between 60 and 75 million years old. Most fossils are dated this way, not directly.', cx + cw + 14, top + 14 / cur, B.w - cw - 46, 10.5, pal['text-muted'], 600, B.y + B.h - 8);
  }
  function drawFormula(B: { x: number; y: number; w: number; h: number }) {
    panel(B.x, B.y, B.w, B.h);
    const I = iso();
    const fr = frac(st.halves);
    const age = st.halves * I.half;
    let y = B.y + 22;
    text(I.name, B.x + 12, y, 12, pal['sim-text'], 'left', 800);
    y += 20 / cur;
    text(`Half-life T = ${fmtYears(I.half)}`, B.x + 12, y, 11.5, pal['text-muted'], 'left', 650);
    y += 20 / cur;
    const P = Math.round(st.n0 * fr);
    const D = st.n0 - P;
    text(`Parent P = ${P.toLocaleString('en')} · Daughter D = ${D.toLocaleString('en')}`, B.x + 12, y, 11.5, pal['text-muted'], 'left', 650);
    y += 24 / cur;
    text(`Age t = T × log₂(1 + D/P)`, B.x + 12, y, 12, pal['sim-text'], 'left', 750);
    y += 20 / cur;
    if (P > 0) {
      text(`= ${fmtYears(I.half)} × log₂(1 + ${(D / Math.max(1, P)).toFixed(2)})`, B.x + 12, y, 11.5, pal.accent, 'left', 750);
      y += 18 / cur;
      text(`= ${fmtYears(age)}`, B.x + 12, y, 12, pal.accent, 'left', 800);
    } else text('Too few parent atoms left to measure', B.x + 12, y, 11.5, pal.accent, 'left', 750);
    y += 22 / cur;
    wrap(`Used for: ${I.use}`, B.x + 12, y, B.w - 24, 10.5, pal['text-muted'], 600, B.y + B.h - 8);
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    const { k, ox, oy } = tf();
    K = k;
    cur = k;
    frame = { x: 0, y: 0, s: 1 };
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    if (st.view === 'timeline') drawTimeline();
    else if (st.view === 'layers') drawLayers();
    else if (st.view === 'fossil') drawFossil();
    else drawDating();
    ctx.restore();
    updateUi();
  }

  /* ======================= Readouts ======================= */
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = lastMsg;
    if (st.view === 'timeline') {
      const at = INTERVALS.filter((iv) => iv.start >= st.cursor && iv.end <= st.cursor);
      const nm = (lv: number) => at.find((iv) => iv.level === lv)?.name ?? '—';
      r('r1', 'Cursor', fmtMa(st.cursor));
      r('r2', 'Eon · era', `${nm(0)} · ${nm(1)}`);
      r('r3', 'Period', st.cursor <= 538.8 ? nm(2) : 'Before the Cambrian');
      r('r4', '24-hour clock', clock(st.cursor));
      r('r5', 'Selected', st.sel ? st.sel.name : 'Nothing');
      r('r6', 'Showing', `${+st.range.a.toFixed(2)} to ${+Math.max(0, st.range.b).toFixed(2)} Ma`);
      note ||= 'Earth is about 4.54 billion years old. Zoom in and out, drag along the timeline, and tap intervals and events. Dates marked ~ are approximate.';
      sim.setBadge(clock(st.cursor));
      canvas.setAttribute('aria-label', `Geological timeline showing ${+st.range.a.toFixed(1)} to ${+st.range.b.toFixed(1)} million years ago; cursor at ${fmtMa(st.cursor)}.`);
    } else if (st.view === 'layers') {
      const f = st.layerSel;
      const lay = f ? LAYERS.find((l) => l.id === f) : null;
      r('r1', 'Selected', f ? FEATURE_NAMES[f].replace(/^the /, '').replace(/^./, (c) => c.toUpperCase()) : 'Tap a layer');
      r('r2', 'Rock', lay ? lay.rock : f === 'dike' ? 'Igneous rock (basalt)' : f === 'unconformity' ? 'Erosion surface' : '—');
      r('r3', 'Fossils', lay ? lay.fossil ?? 'None' : '—');
      r('r4', 'Relative age', f ? `${ORDER.indexOf(f) + 1} of ${ORDER.length} (1 = oldest)` : '—');
      r('r5', 'Age evidence', f ? CONSTRAINT[f] ?? '—' : '—');
      r('r6', 'Older-or-younger score', `${st.score[0]} of ${st.score[1]}`);
      note ||= 'Lower layers are older (superposition); layers were laid down flat (original horizontality), so tilted layers were tilted later; anything that cuts across layers is younger than them (cross-cutting); and the red unconformity marks a gap where rock was eroded away.';
      sim.setBadge(`${5 - st.removed} young layers left`);
      canvas.setAttribute('aria-label', 'Rock cross-section with tilted lower layers, an unconformity, flat upper layers, two ash beds and a dike.');
    } else if (st.view === 'fossil') {
      const O = fossilOutcome();
      r('r1', 'Organism', ORGANISMS[st.org].name);
      r('r2', 'Environment', { sea: 'Sea floor (fine mud)', river: 'River bank (sand)', land: 'Open ground', resin: 'Tree resin' }[st.env]);
      r('r3', 'Stage', st.placed ? `${st.stage + 1} of 6: ${STAGES[st.stage]}` : 'Not placed yet');
      r('r4', 'Burial and oxygen', `${st.burial >= 60 ? 'Rapid' : st.burial >= 30 ? 'Moderate' : 'Slow'} burial · ${st.oxygen >= 60 ? 'high' : st.oxygen >= 30 ? 'some' : 'low'} oxygen`);
      r('r5', 'Preservation score', `${O.score}%`, O.score >= 15 ? 'ok' : 'bad');
      r('r6', 'Fossil type', st.placed && st.stage === 5 ? O.type : `Likely: ${O.type}`, O.ok ? null : 'warn');
      note ||= st.placed ? `${STAGES[st.stage]}. ${O.why}` : 'Choose an organism and an environment, then drag the organism into the scene. Rapid burial, little oxygen and hard parts all improve the chance of a fossil.';
      sim.setBadge(st.placed ? `Stage ${st.stage + 1}/6` : 'Drag to start');
      canvas.setAttribute('aria-label', `Fossilisation: ${ORGANISMS[st.org].name}, stage ${st.stage + 1}. Likely result: ${O.type}.`);
    } else {
      const I = iso();
      const fr = frac(st.halves);
      r('r1', 'Isotope system', `${I.parent} → ${I.daughter}`);
      r('r2', 'Half-life', fmtYears(I.half));
      r('r3', 'Elapsed', `${st.halves.toFixed(2)} half-lives = ${fmtYears(st.halves * I.half)}`);
      r('r4', 'Parent left', `${Math.round(st.n0 * fr).toLocaleString('en')} (${(fr * 100).toFixed(1)}%)`);
      r('r5', 'Daughter made', `${(st.n0 - Math.round(st.n0 * fr)).toLocaleString('en')} (${((1 - fr) * 100).toFixed(1)}%)`);
      const match = st.sample !== null ? Math.abs(frac(st.sample) - fr) : null;
      r('r6', 'Sample', st.sample === null ? 'Press “Date a sample”' : match! < 0.015 ? `Matched: about ${fmtYears(st.sample * I.half)}` : 'Move the slider to match', match !== null && match < 0.015 ? 'ok' : null);
      note ||= `Each half-life, half of the remaining ${I.parent} atoms decay to ${I.daughter}. It does not matter how many atoms you start with: the fraction left depends only on time. ${I.use}`;
      sim.setBadge(`${(fr * 100).toFixed(0)}% parent`);
      canvas.setAttribute('aria-label', `Radioactive decay of ${I.parent}: ${(fr * 100).toFixed(1)} percent left after ${st.halves.toFixed(2)} half-lives.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= Controls ======================= */
  const ui = controls(root);
  const showView = () => {
    for (const v of ['timeline', 'layers', 'fossil', 'dating']) ui.showWhen(`[data-only="${v}"]`, st.view === v);
  };
  const viewCtl = ui.choice<View>('gt-view', (v) => {
    st.view = v;
    lastMsg = '';
    sim.hideTooltip();
    showView();
    sim.requestRender();
  });
  root.querySelector('[data-zin]')?.addEventListener('click', () => zoomBy(0.4));
  root.querySelector('[data-zout]')?.addEventListener('click', () => zoomBy(2.5));
  root.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach((b) =>
    b.addEventListener('click', () => {
      const j = b.dataset.jump!;
      const span: Record<string, [number, number]> = { all: [4600, 0], pre: [4600, 538.8], pal: [538.8, 251.9], mes: [251.9, 66], cen: [66, 0], hum: [8, 0] };
      const [a, bb] = span[j];
      st.cursor = (a + bb) / 2;
      st.sel = null;
      zoomTo(a, bb);
    }),
  );
  root.querySelector('[data-peel]')?.addEventListener('click', () => peel());
  root.querySelector('[data-restore]')?.addEventListener('click', () => {
    st.removed = 0;
    lastMsg = 'All layers restored.';
    sim.requestRender();
  });
  function peel() {
    if (st.removed >= 5) return;
    const id = UPPER[st.removed];
    st.removed++;
    lastMsg = st.removed >= 5 ? 'You have reached the unconformity: the wavy red erosion surface. Below it, layers A–C are tilted, so they were laid down flat, tilted and eroded before layer D was deposited on top.' : `${FEATURE_NAMES[id].replace(/^./, (c) => c.toUpperCase())} removed. The layer below is older.`;
    sim.requestRender();
  }
  const QUIZ = ['A', 'B', 'C', 'unconformity', 'D', 'E', 'dike', 'F', 'G', 'H'];
  root.querySelector('[data-ask]')?.addEventListener('click', () => {
    st.removed = 0;
    let a = QUIZ[Math.floor(Math.random() * QUIZ.length)];
    let b = a;
    while (b === a) b = QUIZ[Math.floor(Math.random() * QUIZ.length)];
    if (Math.random() < 0.5) [a, b] = [b, a];
    st.q = [a, b];
    lastMsg = `Tap the older of the two: ${FEATURE_NAMES[a]} or ${FEATURE_NAMES[b]}.`;
    sim.requestRender();
  });
  function answer(f: string) {
    if (!st.q || !st.q.includes(f)) return false;
    const other = st.q[0] === f ? st.q[1] : st.q[0];
    const ok = ORDER.indexOf(f) < ORDER.indexOf(other);
    const older = ok ? f : other;
    const younger = ok ? other : f;
    const why = [older, younger].includes('dike')
      ? 'Cross-cutting relationships: the dike cuts layers A to E, so it is younger than them, but layer F lies on top of it, so F is younger.'
      : [older, younger].includes('unconformity')
        ? 'The erosion surface cuts across the tilted layers, so it is younger than them, and the flat layers were deposited on top of it, so they are younger still.'
        : ['A', 'B', 'C'].includes(older) && !['A', 'B', 'C'].includes(younger)
          ? 'The tilted layers lie below the unconformity: they were laid down, tilted and eroded before the flat layers above were deposited.'
          : 'Superposition: in an undisturbed sequence, lower layers are older than the layers above them.';
    st.score[1]++;
    if (ok) st.score[0]++;
    lastMsg = `${ok ? 'Correct!' : 'Not quite.'} ${FEATURE_NAMES[older].replace(/^./, (c) => c.toUpperCase())} is older than ${FEATURE_NAMES[younger]}. ${why}`;
    st.q = null;
    return true;
  }
  const orgSel = root.querySelector<HTMLSelectElement>('[data-org]')!;
  orgSel.addEventListener('change', () => {
    st.org = orgSel.value as OrgId;
    st.placed = false;
    lastMsg = '';
    sim.requestRender();
  });
  const orgCtl = { set: (v: OrgId) => (orgSel.value = v) };
  const envCtl = ui.choice<Env>('gt-env', (v) => {
    st.env = v;
    st.placed = false;
    lastMsg = '';
    sim.requestRender();
  });
  const burialCtl = ui.range('gt-burial', (v) => (v >= 60 ? 'Rapid' : v >= 30 ? 'Moderate' : 'Slow'), (v) => ((st.burial = v), sim.requestRender()));
  const oxyCtl = ui.range('gt-oxygen', (v) => (v >= 60 ? 'High' : v >= 30 ? 'Some' : 'Low'), (v) => ((st.oxygen = v), sim.requestRender()));
  const minCtl = ui.toggle('gt-minerals', (v) => ((st.minerals = v), sim.requestRender()));
  const scavCtl = ui.toggle('gt-scav', (v) => ((st.scav = v), sim.requestRender()));
  root.querySelector('[data-sediment]')?.addEventListener('click', () => {
    if (!st.placed) return;
    st.sediment = Math.min(9, st.sediment + 1);
    if (st.stage < 1) goStage(1);
    sim.requestRender();
  });
  root.querySelector('[data-fnext]')?.addEventListener('click', () => {
    if (!st.placed) {
      placeOrganism();
      return;
    }
    sim.pause();
    goStage(st.stage + 1);
  });
  function placeOrganism() {
    st.placed = true;
    st.sediment = 0;
    lastMsg = '';
    goStage(0);
    if (!sim.running) sim.play();
  }
  const isoCtl = ui.choice<string>('gt-iso', (v) => {
    st.iso = v;
    lastMsg = '';
    sim.requestRender();
  });
  const halvesCtl = ui.range('gt-halves', (v) => `${v.toFixed(2)}`, (v) => {
    st.halves = v;
    if (st.sample !== null && Math.abs(frac(st.sample) - frac(v)) < 0.015) lastMsg = `Match! The sample has been decaying for about ${st.sample.toFixed(1)} half-lives: ${fmtYears(st.sample * iso().half)}.`;
    sim.requestRender();
  });
  const n0Ctl = ui.range('gt-n0', (v) => v.toLocaleString('en'), (v) => ((st.n0 = v), sim.requestRender()));
  root.querySelector('[data-sample]')?.addEventListener('click', () => {
    st.sample = Math.round((0.3 + Math.random() * 4.5) * 20) / 20;
    sim.pause();
    lastMsg = `A rock sample has ${(frac(st.sample) * 100).toFixed(0)}% of its ${iso().parent} left (the red line). Move the half-lives slider until the parent matches, then read the age.`;
    sim.requestRender();
  });
  root.querySelector('[data-clear-sample]')?.addEventListener('click', () => {
    st.sample = null;
    lastMsg = '';
    sim.requestRender();
  });

  /* ======================= Pointer ======================= */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  const toLocal = (fr: { x: number; y: number; s: number }, [bx, by]: Pt): Pt => [(bx - fr.x) / fr.s, (by - fr.y) / fr.s];
  let dragKind: 'pan' | 'cursor' | 'layer' | 'org' | null = null;
  let start: { x: number; range: { a: number; b: number }; y: number } = { x: 0, range: { a: 0, b: 0 }, y: 0 };
  let peelOff = 0;
  enableDrag<'d'>(canvas, {
    hit(x, y) {
      const b = toBox(x, y);
      if (st.view === 'timeline') {
        const L = tlLayout();
        if (b[1] < L.axis + 20 && b[0] >= L.x && b[0] <= L.x + L.w) {
          dragKind = Math.abs(b[0] - X(st.cursor)) < 16 ? 'cursor' : 'pan';
          return 'd';
        }
        return null;
      }
      if (st.view === 'layers') {
        const [lx, ly] = toLocal(secFrame, b);
        if (st.removed < 5 && featureAt(lx, ly) === UPPER[st.removed] && !st.q) {
          dragKind = 'layer';
          return 'd';
        }
        return null;
      }
      if (st.view === 'fossil' && !st.placed) {
        const [lx, ly] = toLocal(sceneFrame, b);
        if (lx >= TRAY.x && lx <= TRAY.x + TRAY.w && ly >= TRAY.y && ly <= TRAY.y + TRAY.h) {
          dragKind = 'org';
          return 'd';
        }
      }
      return null;
    },
    start(_id, x, y) {
      const b = toBox(x, y);
      start = { x: b[0], y: b[1], range: { ...st.range } };
      peelOff = 0;
      sim.hideTooltip();
    },
    move(_id, x, y) {
      const b = toBox(x, y);
      if (dragKind === 'cursor') st.cursor = clamp(T(b[0]), Math.max(0, st.range.b), Math.min(4567, st.range.a));
      else if (dragKind === 'pan') {
        const L = tlLayout();
        const span = start.range.a - start.range.b;
        const shift = ((b[0] - start.x) / L.w) * span;
        let a = start.range.a + shift;
        let bb = start.range.b + shift;
        if (bb < 0) {
          a -= bb;
          bb = 0;
        }
        if (a > 4600) {
          bb -= a - 4600;
          a = 4600;
        }
        st.range = { a, b: bb };
      } else if (dragKind === 'layer') peelOff = Math.hypot(b[0] - start.x, b[1] - start.y);
      else if (dragKind === 'org') drag = toLocal(sceneFrame, b);
      sim.requestRender();
    },
    end() {
      if (dragKind === 'layer' && peelOff > 40) peel();
      if (dragKind === 'org' && drag) {
        if (Math.abs(drag[0] - SPOT.x) < 140 && Math.abs(drag[1] - SPOT.y) < 120) placeOrganism();
        drag = null;
      }
      dragKind = null;
      sim.requestRender();
    },
    click(x, y) {
      const b = toBox(x, y);
      if (st.view === 'timeline') {
        const L = tlLayout();
        const ev = eventHits.find((h) => Math.abs(h.x - b[0]) < 30 && Math.abs(h.y - b[1]) < 12);
        if (ev) {
          st.sel = ev.e;
          st.cursor = ev.e.t;
        } else {
          const lv = L.rows.findIndex((ry) => b[1] >= ry && b[1] <= ry + L.rowH);
          if (lv >= 0) {
            const tm = T(b[0]);
            const iv = INTERVALS.find((q) => q.level === lv && q.start >= tm && q.end <= tm);
            if (iv) {
              st.sel = iv;
              st.cursor = (iv.start + iv.end) / 2;
              zoomTo(iv.start, iv.end);
            }
          } else st.cursor = clamp(T(b[0]), Math.max(0, st.range.b), Math.min(4567, st.range.a));
        }
        sim.requestRender();
        return;
      }
      if (st.view === 'layers') {
        const [lx, ly] = toLocal(secFrame, b);
        const f = featureAt(lx, ly);
        if (f) {
          if (!answer(f)) {
            st.layerSel = f;
            lastMsg = '';
            const lay = LAYERS.find((l) => l.id === f);
            sim.showTooltip(x, y, FEATURE_NAMES[f].replace(/^the /, '').replace(/^./, (c) => c.toUpperCase()), lay ? lay.text : f === 'dike' ? 'A sheet of igneous rock that forced its way up through layers A to E while molten. It is dated at 70 Ma. Layer F lies across its top, so F is younger.' : 'An erosion surface: the tilted layers were worn down before new sediment was laid on top. The missing rock means a gap in the record.');
          } else st.layerSel = f;
        } else sim.hideTooltip();
        sim.requestRender();
      }
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, { range: { a: 4600, b: 0 }, cursor: 66, sel: null, removed: 0, layerSel: null, q: null, score: [0, 0], org: 'fish', env: 'sea', burial: 70, oxygen: 30, minerals: true, scav: false, placed: false, stage: 0, sediment: 0, iso: 'k40', halves: 1, n0: 1000, sample: null });
      orgCtl.set('fish');
      envCtl.set('sea', false);
      burialCtl.set(70, false);
      oxyCtl.set(30, false);
      minCtl.set(true, false);
      scavCtl.set(false, false);
      isoCtl.set('k40', false);
      halvesCtl.set(1, false);
      n0Ctl.set(1000, false);
      anim = null;
      lastMsg = '';
      viewCtl.set(st.view, false);
      showView();
    },
  });

  showView();
  sim.requestRender();
}
