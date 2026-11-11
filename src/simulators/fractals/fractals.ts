/**
 * Fractal lab:
 *   mandelbrot – escape-time rendering of z → z² + c from z₀ = 0, with progressive
 *                refinement (never blocks the page), pan/zoom and point orbits.
 *   julia      – the same iteration with c fixed and z₀ varying; c chosen on a small
 *                Mandelbrot map.
 *   sierpinski – deterministic recursive subdivision, or the randomised chaos game.
 *   koch       – the Koch snowflake built one iteration at a time.
 *   fern       – Barnsley’s fern from four affine maps chosen at random.
 * Coordinates are plain JavaScript doubles (about 16 significant digits), so the
 * deepest useful zoom is a view about 10⁻¹² wide; the lab stops there and says so.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type Frac = 'mandelbrot' | 'julia' | 'sierpinski' | 'koch' | 'fern';
type Box = { x: number; y: number; w: number; h: number };
type ViewW = { cx: number; cy: number; span: number }; // span = width of the plot in world units
type Mode = 'smooth' | 'bands' | 'binary';
const MIN_SPAN = 2e-12;

const DEFAULT_VIEW: Record<Frac, ViewW> = {
  mandelbrot: { cx: -0.6, cy: 0, span: 3.4 },
  julia: { cx: 0, cy: 0, span: 3.6 },
  sierpinski: { cx: 0.5, cy: 0.42, span: 1.25 },
  koch: { cx: 0, cy: 0, span: 1.5 },
  fern: { cx: 0, cy: 5, span: 12.5 },
};
const FERN = [
  { a: 0, b: 0, c: 0, d: 0.16, e: 0, f: 0, p: 0.01, col: [134, 142, 150] },
  { a: 0.85, b: 0.04, c: -0.04, d: 0.85, e: 0, f: 1.6, p: 0.85, col: [47, 158, 68] },
  { a: 0.2, b: -0.26, c: 0.23, d: 0.22, e: 0, f: 1.6, p: 0.07, col: [28, 126, 214] },
  { a: -0.15, b: 0.28, c: 0.26, d: 0.24, e: 0, f: 0.44, p: 0.07, col: [232, 89, 12] },
];
const JULIA_PRESETS: Record<string, [number, number, string]> = {
  rabbit: [-0.123, 0.745, 'Douady rabbit'],
  dendrite: [0, 1, 'Dendrite'],
  sanmarco: [-0.75, 0, 'San Marco'],
  siegel: [-0.391, -0.587, 'Siegel disc'],
  dust: [0.4, 0.4, 'Dust (c outside the Mandelbrot set)'],
  spiral: [-0.8, 0.156, 'Spirals (c just outside the Mandelbrot set, so this is actually dust)'],
};
const M_PLACES: Record<string, [number, number, number, string]> = {
  seahorse: [-0.7436447860, 0.1318252536, 0.004, 'Seahorse Valley'],
  elephant: [0.2925, 0.0151, 0.03, 'Elephant Valley'],
  mini: [-1.7686, 0.0017, 0.04, 'A miniature copy'],
  spiral: [-0.10109636, 0.95628651, 0.006, 'Spirals'],
};

/** A 256-colour palette from colour stops (r, g, b). */
function palette(stops: [number, number, number][]) {
  const out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const u = (i / 256) * stops.length;
    const k = Math.floor(u);
    const f = u - k;
    const a = stops[k % stops.length];
    const b = stops[(k + 1) % stops.length];
    for (let j = 0; j < 3; j++) out[i * 3 + j] = a[j] + (b[j] - a[j]) * f;
  }
  return out;
}
const PAL = palette([
  [9, 1, 47],
  [4, 4, 73],
  [0, 7, 100],
  [12, 44, 138],
  [24, 82, 177],
  [57, 125, 209],
  [134, 181, 229],
  [211, 236, 248],
  [241, 233, 191],
  [248, 201, 95],
  [255, 170, 0],
  [204, 128, 0],
  [153, 87, 0],
  [106, 52, 3],
]);

export function initFractals(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const fracSel = root.querySelector<HTMLSelectElement>('[data-frac]')!;
  const { ctx, size } = fitCanvas(canvas, () => {
    esc.dirty = true;
    pts.redraw = true;
    sim.requestRender();
  });
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    frac: 'mandelbrot' as Frac,
    iter: 200,
    mode: 'smooth' as Mode,
    cre: -0.123,
    cim: 0.745,
    sdepth: 4,
    chaos: false,
    kdepth: 2,
    newest: true,
    fernMax: 120000,
    lean: 0.04,
    byMap: false,
  };
  const views: Record<Frac, ViewW> = JSON.parse(JSON.stringify(DEFAULT_VIEW));
  let sel: [number, number] | null = null; // selected point for orbit display
  let lastMsg = '';
  let t = 0;
  let animT = 0;
  const kept: { cre: number; cim: number; img: HTMLCanvasElement }[] = [];

  /* ======================= Escape-time renderer ======================= */
  const esc = {
    off: document.createElement('canvas'),
    img: null as ImageData | null,
    key: '',
    level: 0,
    row: 0,
    dirty: true,
    done: false,
    t0: 0,
    ms: 0,
  };
  const LEVELS = [8, 2, 1]; // block sizes: coarse preview, then finer passes
  /** Iterate one point; returns the smooth escape count, or −1 if it never escaped. */
  function escapeAt(zr: number, zi: number, cr: number, ci: number, maxIt: number, mand: boolean) {
    if (mand) {
      // skip the main cardioid and the period-2 bulb, which are inside the set
      const q = (cr - 0.25) ** 2 + ci * ci;
      if (q * (q + (cr - 0.25)) <= 0.25 * ci * ci || (cr + 1) ** 2 + ci * ci <= 0.0625) return -1;
    }
    let x = zr;
    let y = zi;
    // periodicity check: if the orbit comes back to a saved value it is cycling, so it is bounded
    let sx = x;
    let sy = y;
    let span = 8;
    let k = 0;
    for (let n = 0; n < maxIt; n++) {
      const x2 = x * x;
      const y2 = y * y;
      if (x2 + y2 > 256) {
        // smooth (continuous) count; the larger bail-out radius only makes the colours smoother
        return n + 1 - Math.log2(Math.log2(x2 + y2) / 2);
      }
      y = 2 * x * y + ci;
      x = x2 - y2 + cr;
      if (Math.abs(x - sx) < 1e-13 && Math.abs(y - sy) < 1e-13) return -1;
      if (++k === span) {
        k = 0;
        span *= 2;
        sx = x;
        sy = y;
      }
    }
    return -1;
  }
  function colourFor(v: number, out: Uint8ClampedArray, o: number) {
    if (v < 0) {
      out[o] = 6;
      out[o + 1] = 6;
      out[o + 2] = 16;
      out[o + 3] = 255;
      return;
    }
    if (st.mode === 'binary') {
      out[o] = out[o + 1] = out[o + 2] = 238;
      out[o + 3] = 255;
      return;
    }
    // a square-root scale spreads the colours: most points escape within a few steps
    const idx = (Math.floor(Math.sqrt(Math.max(0, st.mode === 'bands' ? Math.floor(v) : v)) * 40) % 256) * 3;
    out[o] = PAL[idx];
    out[o + 1] = PAL[idx + 1];
    out[o + 2] = PAL[idx + 2];
    out[o + 3] = 255;
  }
  /** Render part of the escape-time image, within a time budget. */
  function escStep(W: number, H: number, budgetMs: number, previewOnly = false) {
    const V = views[st.frac];
    const mand = st.frac === 'mandelbrot';
    const key = `${st.frac}|${W}|${H}|${V.cx}|${V.cy}|${V.span}|${st.iter}|${st.mode}|${mand ? '' : `${st.cre},${st.cim}`}`;
    if (key !== esc.key || esc.dirty || !esc.img) {
      if (esc.off.width !== W || esc.off.height !== H) {
        esc.off.width = W;
        esc.off.height = H;
      }
      esc.img = new ImageData(W, H);
      esc.key = key;
      esc.level = 0;
      esc.row = 0;
      esc.dirty = false;
      esc.done = false;
      esc.t0 = performance.now();
    }
    if (esc.done) return;
    const start = performance.now();
    const s = V.span / W;
    const data = esc.img!.data;
    while (performance.now() - start < budgetMs) {
      const B = previewOnly ? 1 : LEVELS[esc.level];
      const y0 = esc.row;
      for (let x0 = 0; x0 < W; x0 += B) {
        const px = x0 + B / 2;
        const py = y0 + B / 2;
        const re = V.cx + (px - W / 2) * s;
        const im = V.cy - (py - H / 2) * s;
        const v = mand ? escapeAt(0, 0, re, im, st.iter, true) : escapeAt(re, im, st.cre, st.cim, st.iter, false);
        for (let yy = y0; yy < Math.min(H, y0 + B); yy++)
          for (let xx = x0; xx < Math.min(W, x0 + B); xx++) colourFor(v, data, (yy * W + xx) * 4);
      }
      esc.row += B;
      if (esc.row >= H) {
        esc.off.getContext('2d')!.putImageData(esc.img!, 0, 0);
        esc.row = 0;
        esc.level++;
        if (esc.level >= LEVELS.length || previewOnly) {
          esc.done = true;
          esc.ms = performance.now() - esc.t0;
          return;
        }
      }
    }
    // show the rows finished so far
    esc.off.getContext('2d')!.putImageData(esc.img!, 0, 0);
  }
  /** Orbit of the selected point (up to 60 steps), and whether it escaped |z| > 2. */
  function orbit(pr: number, pi: number) {
    const mand = st.frac === 'mandelbrot';
    let x = mand ? 0 : pr;
    let y = mand ? 0 : pi;
    const cr = mand ? pr : st.cre;
    const ci = mand ? pi : st.cim;
    const path: [number, number][] = [[x, y]];
    let esc2 = -1;
    for (let n = 1; n <= st.iter; n++) {
      const nx = x * x - y * y + cr;
      y = 2 * x * y + ci;
      x = nx;
      if (n <= 60) path.push([x, y]);
      if (x * x + y * y > 4) {
        esc2 = n;
        break;
      }
    }
    return { path, esc: esc2 };
  }
  const inMandel = (cr: number, ci: number, it = 500) => orbit2(cr, ci, it) < 0;
  function orbit2(cr: number, ci: number, it: number) {
    let x = 0;
    let y = 0;
    for (let n = 1; n <= it; n++) {
      const nx = x * x - y * y + cr;
      y = 2 * x * y + ci;
      x = nx;
      if (x * x + y * y > 4) return n;
    }
    return -1;
  }

  /* ======================= Point clouds (chaos game, fern) ======================= */
  const NMAX = 300000;
  const pts = { x: new Float32Array(NMAX), y: new Float32Array(NMAX), m: new Uint8Array(NMAX), n: 0, drawn: 0, redraw: true, img: null as ImageData | null, off: document.createElement('canvas'), key: '' };
  let px = 0;
  let py = 0;
  function resetPoints() {
    pts.n = 0;
    pts.drawn = 0;
    pts.redraw = true;
    px = 0;
    py = 0;
  }
  const SV: [number, number][] = [
    [0, 0],
    [1, 0],
    [0.5, Math.sqrt(3) / 2],
  ];
  function addPoints(k: number) {
    const max = st.frac === 'fern' ? st.fernMax : 150000;
    for (let i = 0; i < k && pts.n < max; i++) {
      let m = 0;
      if (st.frac === 'fern') {
        const r = Math.random();
        m = r < 0.01 ? 0 : r < 0.86 ? 1 : r < 0.93 ? 2 : 3;
        const F = FERN[m];
        const b = m === 1 ? st.lean : F.b;
        const c = m === 1 ? -st.lean : F.c;
        const nx = F.a * px + b * py + F.e;
        py = c * px + F.d * py + F.f;
        px = nx;
      } else {
        // chaos game: jump halfway towards a randomly chosen corner
        m = Math.floor(Math.random() * 3);
        px = (px + SV[m][0]) / 2;
        py = (py + SV[m][1]) / 2;
      }
      if (i < 20 && pts.n === 0 && st.frac !== 'fern') continue; // let the first jumps settle onto the attractor
      pts.x[pts.n] = px;
      pts.y[pts.n] = py;
      pts.m[pts.n] = m;
      pts.n++;
    }
  }

  /* ======================= Geometry ======================= */
  type Tri = [[number, number], [number, number], [number, number]];
  function sierpinski(depth: number): Tri[] {
    let tris: Tri[] = [[SV[0], SV[1], SV[2]] as Tri];
    for (let d = 0; d < depth; d++) {
      const next: Tri[] = [];
      for (const [a, b, c] of tris) {
        const ab: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const bc: [number, number] = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
        const ca: [number, number] = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
        next.push([a, ab, ca], [ab, b, bc], [ca, bc, c]);
      }
      tris = next;
    }
    return tris;
  }
  /** Koch snowflake vertices after n steps (starting from an equilateral triangle of side 1). */
  function koch(n: number): [number, number][] {
    const h = Math.sqrt(3) / 2;
    let p: [number, number][] = [
      [-0.5, -h / 3],
      [0, (2 * h) / 3],
      [0.5, -h / 3],
    ];
    for (let k = 0; k < n; k++) {
      const q: [number, number][] = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i];
        const b = p[(i + 1) % p.length];
        const dx = (b[0] - a[0]) / 3;
        const dy = (b[1] - a[1]) / 3;
        const p1: [number, number] = [a[0] + dx, a[1] + dy];
        const p3: [number, number] = [a[0] + 2 * dx, a[1] + 2 * dy];
        // the vertices run clockwise, so outwards is to the left: turn the edge direction +60°
        const p2: [number, number] = [p1[0] + dx * 0.5 - dy * h, p1[1] + dy * 0.5 + dx * h];
        q.push(a, p1, p2, p3);
      }
      p = q;
    }
    return p;
  }

  /* ======================= Drawing helpers ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const toBox = (x: number, y: number): [number, number] => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  let cur = 1;
  const fs = (px2: number, wt = 650) => font(px2 / cur, wt);
  function text(s: string, x: number, y: number, px2 = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px2, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(s: string, x: number, y: number, maxW: number, px2 = 11.5, color = pal['text-muted'], wt = 600, maxY = Infinity) {
    ctx.font = fs(px2, wt);
    ctx.fillStyle = color;
    const lh = (px2 + 4) / cur;
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
  function panel(B: Box, fill = pal['bg-elev']) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(B.x, B.y, B.w, B.h, 10);
    ctx.fill();
    ctx.stroke();
  }
  function pill(s: string, x: number, y: number, align: CanvasTextAlign = 'left', px2 = 11, color = pal['sim-text']) {
    ctx.font = fs(px2, 700);
    const w = ctx.measureText(s).width;
    const pad = 5 / cur;
    const hh = (px2 + 7) / cur;
    const x0 = align === 'left' ? x - pad : align === 'right' ? x - w - pad : x - w / 2 - pad;
    ctx.fillStyle = withAlpha(pal['bg-elev'], 0.92);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x0, y - 4 / cur - hh / 2, w + 2 * pad, hh, hh / 2);
    ctx.fill();
    ctx.stroke();
    text(s, x, y, px2, color, align, 700);
  }
  const fmt = (v: number, sig = 6) => (Math.abs(v) < 1e-14 ? '0' : (+v.toPrecision(sig)).toString().replace('-', '−'));

  /* ======================= Layout and world mapping ======================= */
  const layout = () => (portrait() ? { plot: { x: 14, y: 104, w: 652, h: 520 }, side: { x: 14, y: 636, w: 652, h: 352 } } : { plot: { x: 14, y: 14, w: 640, h: 572 }, side: { x: 666, y: 70, w: 320, h: 516 } });
  let PL: Box = { x: 0, y: 0, w: 1, h: 1 };
  const V = () => views[st.frac];
  const SX = (x: number) => PL.x + PL.w / 2 + ((x - V().cx) / V().span) * PL.w;
  const SY = (y: number) => PL.y + PL.h / 2 - ((y - V().cy) / V().span) * PL.w;
  const WX = (bx: number) => V().cx + ((bx - PL.x - PL.w / 2) / PL.w) * V().span;
  const WY = (by: number) => V().cy - ((by - PL.y - PL.h / 2) / PL.w) * V().span;
  let inset: Box | null = null; // the c-picker map (Julia)
  const INSET_V = { x0: -2.2, x1: 0.8, y0: -1.25, y1: 1.25 };
  const insetImg = document.createElement('canvas');
  let insetKey = '';

  /* ======================= Views ======================= */
  function drawEscape(animating: boolean) {
    // while animating, draw each frame at quarter resolution in one pass; refine when it stops
    const q = animating ? 0.25 : 1;
    const W = Math.max(8, Math.round(PL.w * cur * size.dpr * q));
    const H = Math.max(8, Math.round(PL.h * cur * size.dpr * q));
    escStep(W, H, animating ? 40 : 12, animating);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(esc.off, PL.x, PL.y, PL.w, PL.h);
    ctx.imageSmoothingEnabled = true;
    if (!esc.done) sim.requestRender();
    // axes ticks for orientation
    if (sel) {
      const o = orbit(sel[0], sel[1]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      o.path.forEach(([x, y], k) => (k ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y))));
      ctx.stroke();
      o.path.forEach(([x, y], k) => {
        ctx.fillStyle = k === 0 ? '#ffd43b' : '#ffffff';
        ctx.beginPath();
        ctx.arc(SX(x), SY(y), (k === 0 ? 5 : 2.5) / cur, 0, Math.PI * 2);
        ctx.fill();
      });
      const [x0, y0] = st.frac === 'mandelbrot' ? sel : o.path[0];
      ctx.strokeStyle = '#ffd43b';
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.arc(SX(x0), SY(y0), 7 / cur, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the circle |z| = 2
    ctx.strokeStyle = withAlpha('#ffffff', 0.25);
    ctx.setLineDash([5 / cur, 5 / cur]);
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.arc(SX(0), SY(0), (2 / V().span) * PL.w, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    pill(`Re ${fmt(V().cx, 8)} · Im ${fmt(V().cy, 8)} · width ${fmt(V().span, 3)}`, PL.x + 10 / cur, PL.y + PL.h - 14 / cur, 'left', 10, pal['text-muted']);
    if (!esc.done) pill(`Rendering… ${LEVELS[esc.level] > 1 ? 'preview' : `${Math.round((esc.row / Math.max(1, Math.round(PL.h * cur * size.dpr))) * 100)}%`}`, PL.x + PL.w - 10 / cur, PL.y + 18 / cur, 'right', 10, pal['text-muted']);
  }
  function drawGeometry() {
    ctx.fillStyle = pal['surface-2'];
    ctx.fillRect(PL.x, PL.y, PL.w, PL.h);
    if (st.frac === 'sierpinski' && !st.chaos) {
      ctx.fillStyle = pal['sim-bg'];
      ctx.beginPath();
      ctx.moveTo(SX(SV[0][0]), SY(SV[0][1]));
      ctx.lineTo(SX(SV[1][0]), SY(SV[1][1]));
      ctx.lineTo(SX(SV[2][0]), SY(SV[2][1]));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7048e8';
      ctx.beginPath();
      for (const [a, b, c] of sierpinski(st.sdepth)) {
        ctx.moveTo(SX(a[0]), SY(a[1]));
        ctx.lineTo(SX(b[0]), SY(b[1]));
        ctx.lineTo(SX(c[0]), SY(c[1]));
        ctx.closePath();
      }
      ctx.fill();
    } else if (st.frac === 'koch') {
      const n = st.kdepth;
      const p = koch(n);
      ctx.fillStyle = withAlpha('#1c7ed6', 0.2);
      ctx.strokeStyle = '#1c7ed6';
      ctx.lineWidth = 1.5 / cur;
      ctx.beginPath();
      p.forEach(([x, y], k) => (k ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y))));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (st.newest && n > 0 && n <= 4) {
        // the bumps added in the latest step are the middle vertices of each group of 4
        ctx.fillStyle = '#e8590c';
        for (let i = 2; i < p.length; i += 4) {
          ctx.beginPath();
          ctx.arc(SX(p[i][0]), SY(p[i][1]), 3.2 / cur, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else drawPoints();
  }
  function drawPoints() {
    const W = Math.max(8, Math.round(PL.w * cur * size.dpr));
    const H = Math.max(8, Math.round(PL.h * cur * size.dpr));
    const v = V();
    const key = `${W}|${H}|${v.cx}|${v.cy}|${v.span}|${st.byMap}|${st.frac}`;
    if (key !== pts.key || pts.redraw || !pts.img) {
      if (pts.off.width !== W || pts.off.height !== H) {
        pts.off.width = W;
        pts.off.height = H;
      }
      pts.img = new ImageData(W, H);
      pts.key = key;
      pts.drawn = 0;
      pts.redraw = false;
    }
    const d = pts.img.data;
    const s = W / v.span;
    for (let i = pts.drawn; i < pts.n; i++) {
      const x = Math.floor(W / 2 + (pts.x[i] - v.cx) * s);
      const y = Math.floor(H / 2 - (pts.y[i] - v.cy) * s);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4;
      const col = st.frac === 'fern' ? (st.byMap ? FERN[pts.m[i]].col : [47, 158, 68]) : [[224, 49, 49], [47, 158, 68], [28, 126, 214]][pts.m[i]];
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
      d[o + 3] = 255;
    }
    pts.drawn = pts.n;
    pts.off.getContext('2d')!.putImageData(pts.img, 0, 0);
    ctx.fillStyle = pal['surface-2'];
    ctx.fillRect(PL.x, PL.y, PL.w, PL.h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pts.off, PL.x, PL.y, PL.w, PL.h);
    ctx.imageSmoothingEnabled = true;
    if (st.frac === 'sierpinski') {
      for (const [k, [x, y]] of SV.entries()) {
        ctx.fillStyle = ['#e03131', '#2f9e44', '#1c7ed6'][k];
        ctx.beginPath();
        ctx.arc(SX(x), SY(y), 6 / cur, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ======================= Side panel ======================= */
  const DIM: Record<Frac, string> = {
    mandelbrot: 'The boundary of the Mandelbrot set has Hausdorff dimension exactly 2 (Shishikura, 1998): it is so wiggly that it is “as big as” an area.',
    julia: 'Julia set dimensions depend on c: about 1 for very smooth ones near c = 0, and up to 2 for some c on the boundary of the Mandelbrot set.',
    sierpinski: 'Self-similar: 3 copies, each scaled by 1/2. Dimension D = log 3 / log 2 ≈ 1.585 — between a line (1) and an area (2).',
    koch: 'Self-similar: each side is 4 copies scaled by 1/3. Dimension D = log 4 / log 3 ≈ 1.262.',
    fern: 'The fern is made by four different maps, not four identical scaled copies, so no simple log formula gives its dimension. Numerical estimates lie between 1 and 2.',
  };
  function drawSide(B: Box) {
    panel(B);
    const two = portrait();
    let y = B.y + 22;
    const x0 = B.x + 12;
    const cw = two && st.frac === 'julia' ? B.w / 2 - 20 : B.w - 24;
    const ln = (s: string, col = pal['text-muted'], px2 = 11, wt = 650, xx = x0, w = cw) => {
      y = wrap(s, xx, y, w, px2, col, wt, B.y + B.h - 6);
    };
    inset = null;
    if (st.frac === 'mandelbrot') {
      ln('zₙ₊₁ = zₙ² + c,  z₀ = 0', pal['sim-text'], 13, 800);
      ln('c is coloured black if its sequence stays bounded (|z| ≤ 2) for every iteration tried; otherwise by how fast it escapes.', pal['text-muted'], 10.5);
      if (sel) {
        const o = orbit(sel[0], sel[1]);
        ln(`c = ${fmt(sel[0], 6)} ${sel[1] < 0 ? '−' : '+'} ${fmt(Math.abs(sel[1]), 6)}i`, '#e8590c', 11.5, 800);
        o.path.slice(0, 6).forEach(([x, yy], k) => ln(`z${['₀', '₁', '₂', '₃', '₄', '₅'][k]} = ${fmt(x, 4)} ${yy < 0 ? '−' : '+'} ${fmt(Math.abs(yy), 4)}i   |z| = ${fmt(Math.hypot(x, yy), 4)}`, pal['text-muted'], 10, 650));
        ln(o.esc > 0 ? `Escaped: |z| > 2 after ${o.esc} iterations, so c is not in the set.` : `Stayed within |z| ≤ 2 for all ${st.iter} iterations: c is probably in the set. A larger limit could still show it escaping.`, o.esc > 0 ? pal.warning : pal.success, 10.5, 750);
      } else ln('Tap any point to follow its sequence.', pal.accent, 11, 700);
    } else if (st.frac === 'julia') {
      ln('zₙ₊₁ = zₙ² + c, c fixed, z₀ = each point', pal['sim-text'], 12, 800);
      const inM = inMandel(st.cre, st.cim);
      ln(`c = ${fmt(st.cre, 4)} ${st.cim < 0 ? '−' : '+'} ${fmt(Math.abs(st.cim), 4)}i — ${inM ? 'in the Mandelbrot set, so this Julia set is connected (one piece).' : 'outside the Mandelbrot set, so this Julia set is “dust”: disconnected points.'}`, inM ? pal.success : pal.warning, 10.5, 750);
      // c-picker map
      const S: Box = two ? { x: B.x + B.w / 2 + 6, y: B.y + 14, w: B.w / 2 - 20, h: (B.w / 2 - 20) * 0.83 } : { x: x0, y: y + 2, w: cw, h: cw * 0.83 };
      inset = S;
      const IW = Math.max(8, Math.round(S.w * cur * size.dpr));
      const IH = Math.max(8, Math.round(S.h * cur * size.dpr));
      if (insetKey !== `${IW}x${IH}`) {
        insetKey = `${IW}x${IH}`;
        insetImg.width = IW;
        insetImg.height = IH;
        const img = new ImageData(IW, IH);
        for (let j = 0; j < IH; j++)
          for (let i = 0; i < IW; i++) {
            const cr = INSET_V.x0 + ((i + 0.5) / IW) * (INSET_V.x1 - INSET_V.x0);
            const ci = INSET_V.y1 - ((j + 0.5) / IH) * (INSET_V.y1 - INSET_V.y0);
            const v = escapeAt(0, 0, cr, ci, 60, true);
            const o = (j * IW + i) * 4;
            if (v < 0) {
              img.data[o] = 30;
              img.data[o + 1] = 30;
              img.data[o + 2] = 50;
            } else {
              const g = 200 - Math.min(150, v * 8);
              img.data[o] = g;
              img.data[o + 1] = g + 20;
              img.data[o + 2] = 245;
            }
            img.data[o + 3] = 255;
          }
        insetImg.getContext('2d')!.putImageData(img, 0, 0);
      }
      ctx.drawImage(insetImg, S.x, S.y, S.w, S.h);
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1 / cur;
      ctx.strokeRect(S.x, S.y, S.w, S.h);
      const mx = S.x + ((st.cre - INSET_V.x0) / (INSET_V.x1 - INSET_V.x0)) * S.w;
      const my = S.y + ((INSET_V.y1 - st.cim) / (INSET_V.y1 - INSET_V.y0)) * S.h;
      ctx.fillStyle = '#e8590c';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / cur;
      ctx.beginPath();
      ctx.arc(mx, my, 7 / cur, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      text('Drag c on the Mandelbrot map', S.x + S.w / 2, S.y + S.h + 14 / cur, 10, pal['text-faint'], 'center', 650);
      if (!two) y = S.y + S.h + 30 / cur;
      // kept comparisons
      if (kept.length) {
        const kw = ((two ? B.w / 2 - 20 : cw) - 12) / 3;
        const ky = two ? y + 4 / cur : y;
        kept.forEach((k, i) => {
          const kx = x0 + i * (kw + 6);
          ctx.drawImage(k.img, kx, ky, kw, kw * 0.75);
          text(`${fmt(k.cre, 3)}${k.cim < 0 ? '−' : '+'}${fmt(Math.abs(k.cim), 3)}i`, kx + kw / 2, ky + kw * 0.75 + 12 / cur, 9, pal['text-faint'], 'center', 650);
        });
        y = ky + kw * 0.75 + 26 / cur;
      }
    } else if (st.frac === 'sierpinski') {
      if (st.chaos) {
        ln('Chaos game (randomised)', pal['sim-text'], 12.5, 800);
        ln('Start anywhere. Repeatedly pick one of the three corners at random and jump halfway towards it. The points land on the Sierpinski triangle; the colour shows which corner was chosen last.', pal['text-muted'], 10.5);
        ln('Different random choices draw the points in a different order, but they always fill in the same triangle.', pal['text-faint'], 10.5);
      } else {
        ln('Recursive construction (deterministic)', pal['sim-text'], 12.5, 800);
        ln('Step n: replace every filled triangle by its three corner triangles, removing the middle one. The same rule always gives the same picture.', pal['text-muted'], 10.5);
        ln(`Triangles: 3ⁿ = ${3 ** st.sdepth}. Area left: (3/4)ⁿ = ${fmt(0.75 ** st.sdepth, 4)} of the original — it tends to 0.`, '#7048e8', 11, 750);
      }
    } else if (st.frac === 'koch') {
      const n = st.kdepth;
      ln('Koch snowflake', pal['sim-text'], 12.5, 800);
      ln('Step n: on every edge, replace the middle third with two sides of an outward equilateral triangle.', pal['text-muted'], 10.5);
      ln(`Edges: 3·4ⁿ = ${(3 * 4 ** n).toLocaleString('en')}; each 1/3ⁿ = ${fmt(1 / 3 ** n, 4)} long`, '#1c7ed6', 11, 750);
      ln(`Perimeter: 3·(4/3)ⁿ = ${fmt(3 * (4 / 3) ** n, 5)} → grows without limit`, '#1c7ed6', 11, 750);
      const A0 = Math.sqrt(3) / 4;
      const area = A0 * (1 + (3 / 5) * (1 - (4 / 9) ** n));
      ln(`Area: ${fmt(area / A0, 5)} × the triangle → tends to 8/5 = 1.6`, '#1c7ed6', 11, 750);
    } else {
      ln('Barnsley fern (random iteration)', pal['sim-text'], 12.5, 800);
      ln('Each new point is made from the last by one of four affine maps (x, y) → (ax + by + e, cx + dy + f), chosen at random with the probabilities below.', pal['text-muted'], 10.5);
      const names = ['stem', 'smaller copy (main)', 'left leaflet', 'right leaflet'];
      FERN.forEach((F, k) => ln(`f${k + 1} ${Math.round(F.p * 100)}%: ${names[k]}`, `rgb(${F.col.join(',')})`, 10.5, 750));
      ln('The randomness only decides the order of the points: the four maps alone determine the final shape.', pal['text-faint'], 10);
    }
    y += 4 / cur;
    ln(`Dimension: ${DIM[st.frac]}`, pal['text-muted'], 10.5, 650, x0, two && (st.frac === 'julia') ? B.w / 2 - 20 : two ? B.w - 24 : cw);
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    const { k, ox, oy } = tf();
    cur = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const L = layout();
    PL = L.plot;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PL.x, PL.y, PL.w, PL.h, 10);
    ctx.clip();
    if (st.frac === 'mandelbrot' || st.frac === 'julia') drawEscape(sim.running);
    else drawGeometry();
    ctx.restore();
    drawSide(L.side);
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
    const v = V();
    let note = lastMsg;
    const zoom = DEFAULT_VIEW[st.frac].span / v.span;
    const zoomTxt = zoom >= 1e4 ? `${zoom.toExponential(1).replace('e+', ' × 10^')}×` : `${fmt(zoom, 3)}×`;
    if (st.frac === 'mandelbrot' || st.frac === 'julia') {
      const o = sel ? orbit(sel[0], sel[1]) : null;
      r('r1', 'Magnification', zoomTxt, v.span <= MIN_SPAN * 1.01 ? 'warn' : null);
      r('r2', 'Maximum iterations', `${st.iter}`);
      r('r3', st.frac === 'julia' ? 'Parameter c' : 'View centre', st.frac === 'julia' ? `${fmt(st.cre, 4)} ${st.cim < 0 ? '−' : '+'} ${fmt(Math.abs(st.cim), 4)}i` : `${fmt(v.cx, 8)} ${v.cy < 0 ? '−' : '+'} ${fmt(Math.abs(v.cy), 8)}i`);
      r('r4', st.frac === 'julia' ? 'Julia set' : 'Selected point', st.frac === 'julia' ? (inMandel(st.cre, st.cim) ? 'Connected (c in M)' : 'Disconnected dust (c not in M)') : sel ? `${fmt(sel[0], 6)} ${sel[1] < 0 ? '−' : '+'} ${fmt(Math.abs(sel[1]), 6)}i` : 'Tap the picture');
      r('r5', 'Sequence of the tapped point', o ? (o.esc > 0 ? `Escaped after ${o.esc} steps` : `Bounded for ${st.iter} steps`) : '—', o ? (o.esc > 0 ? 'warn' : 'ok') : null);
      r('r6', 'Render', esc.done ? `Done in ${Math.round(esc.ms)} ms` : 'Refining…');
      if (!note) {
        if (v.span <= MIN_SPAN * 1.01) note = 'You have reached the limit of double-precision numbers (about 16 digits). Zooming further would show blocky, wrong pictures, so the lab stops here.';
        else if (st.frac === 'mandelbrot') note = 'Black points never escaped |z| > 2 within the iteration limit (they are probably in the set). Drag to pan, use the zoom buttons, pinch or Ctrl + scroll, and double-click to zoom in. Raise the iterations when you zoom deep: the boundary needs more steps to resolve.';
        else note = 'Each picture uses one fixed c. Drag c around the small Mandelbrot map: inside the black set the Julia set is connected; outside it shatters into dust.';
      }
      sim.setBadge(st.frac === 'mandelbrot' ? 'Mandelbrot set' : 'Julia set');
    } else if (st.frac === 'sierpinski') {
      r('r1', 'Method', st.chaos ? 'Chaos game (random)' : 'Recursion (deterministic)');
      r('r2', st.chaos ? 'Points plotted' : 'Depth n', st.chaos ? pts.n.toLocaleString('en') : `${st.sdepth}`);
      r('r3', 'Triangles 3ⁿ', st.chaos ? '—' : (3 ** st.sdepth).toLocaleString('en'));
      r('r4', 'Area left (3/4)ⁿ', st.chaos ? '—' : fmt(0.75 ** st.sdepth, 4));
      r('r5', 'Dimension', 'log 3 / log 2 ≈ 1.585');
      r('r6', 'Magnification', zoomTxt);
      note ||= st.chaos ? 'Random jumps, yet the same triangle appears every time. Press Start to plot more points.' : 'Press Step or Start to add a level. Zoom into any corner: each small triangle is a half-size copy of the whole.';
      sim.setBadge(`Sierpinski · ${st.chaos ? 'chaos game' : `n = ${st.sdepth}`}`);
    } else if (st.frac === 'koch') {
      const n = st.kdepth;
      r('r1', 'Step n', `${n}`);
      r('r2', 'Edges 3·4ⁿ', (3 * 4 ** n).toLocaleString('en'));
      r('r3', 'Edge length 1/3ⁿ', fmt(1 / 3 ** n, 4));
      r('r4', 'Perimeter 3·(4/3)ⁿ', fmt(3 * (4 / 3) ** n, 5));
      r('r5', 'Area (triangle = 1)', `${fmt(1 + (3 / 5) * (1 - (4 / 9) ** n), 5)} → 1.6`);
      r('r6', 'Dimension', 'log 4 / log 3 ≈ 1.262');
      note ||= 'Each step multiplies the perimeter by 4/3, so it grows forever, while the area stays finite: a curve of infinite length around a finite region. Zoom into an edge to see the same shape repeating.';
      sim.setBadge(`Koch · n = ${n}`);
    } else {
      const counts = [0, 0, 0, 0];
      for (let i = 0; i < pts.n; i += 7) counts[pts.m[i]]++;
      const tot = counts.reduce((a, b) => a + b, 0) || 1;
      r('r1', 'Points plotted', pts.n.toLocaleString('en'));
      r('r2', 'Map use f₁ · f₂ · f₃ · f₄', counts.map((c) => `${Math.round((c / tot) * 100)}%`).join(' · '));
      r('r3', 'Lean of f₂', fmt(st.lean, 3));
      r('r4', 'Method', 'Random iteration (probabilistic)');
      r('r5', 'Colours', st.byMap ? 'By map' : 'Green');
      r('r6', 'Magnification', zoomTxt);
      note ||= 'Each leaflet is a smaller copy of the whole fern. Change the lean of map f₂ and the whole fern curls, because every part is built from it.';
      sim.setBadge('Barnsley fern');
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
    canvas.setAttribute('aria-label', `${fracSel.selectedOptions[0]?.textContent ?? 'Fractal'}. ${noteEl.textContent}`);
  }

  /* ======================= Step (animation) ======================= */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    animT += dt;
    if (st.frac === 'mandelbrot') {
      // zoom smoothly into Seahorse Valley
      const [tx, ty] = M_PLACES.seahorse;
      const v = views.mandelbrot;
      v.cx += (tx - v.cx) * Math.min(1, dt * 1.5);
      v.cy += (ty - v.cy) * Math.min(1, dt * 1.5);
      v.span = Math.max(MIN_SPAN, v.span * Math.exp(-dt * 0.9));
      st.iter = Math.min(2000, Math.max(st.iter, Math.round(150 + 60 * Math.log10(3.4 / v.span))));
      iterCtl.set(Math.min(1000, st.iter), false);
      if (v.span < 1e-6) sim.pause();
    } else if (st.frac === 'julia') {
      const th = animT * 0.35;
      st.cre = +(0.7885 * Math.cos(th)).toFixed(4);
      st.cim = +(0.7885 * Math.sin(th)).toFixed(4);
      creCtl.set(st.cre, false);
      cimCtl.set(st.cim, false);
    } else if (st.frac === 'sierpinski') {
      if (st.chaos) {
        addPoints(1500);
        if (pts.n >= 150000) sim.pause();
      } else if (animT > 0.9) {
        animT = 0;
        if (st.sdepth < 9) sdepthCtl.set(st.sdepth + 1);
        else sim.pause();
      }
    } else if (st.frac === 'koch') {
      if (animT > 1) {
        animT = 0;
        if (st.kdepth < 7) kdepthCtl.set(st.kdepth + 1);
        else sim.pause();
      }
    } else {
      addPoints(3000);
      if (pts.n >= st.fernMax) sim.pause();
    }
    sel = st.frac === 'mandelbrot' ? sel : st.frac === 'julia' ? sel : null;
  }

  /* ======================= Interaction ======================= */
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return toBox(e.clientX - r.left, e.clientY - r.top);
  };
  const inPlot = (bx: number, by: number) => {
    const L = layout().plot;
    return bx >= L.x && bx <= L.x + L.w && by >= L.y && by <= L.y + L.h;
  };
  const inInset = (bx: number, by: number) => !!inset && bx >= inset.x - 8 && bx <= inset.x + inset.w + 8 && by >= inset.y - 8 && by <= inset.y + inset.h + 8;
  function setView(v: ViewW) {
    v.span = clamp(v.span, MIN_SPAN, DEFAULT_VIEW[st.frac].span * 4);
    views[st.frac] = v;
    sim.requestRender();
  }
  function zoomAt(f: number, wx?: number, wy?: number) {
    lastMsg = '';
    const v = { ...V() };
    const cx = wx ?? v.cx;
    const cy = wy ?? v.cy;
    const ns = clamp(v.span * f, MIN_SPAN, DEFAULT_VIEW[st.frac].span * 4);
    const k = ns / v.span;
    setView({ cx: cx + (v.cx - cx) * k, cy: cy + (v.cy - cy) * k, span: ns });
  }
  function setC(bx: number, by: number) {
    if (!inset) return;
    st.cre = +clamp(INSET_V.x0 + ((bx - inset.x) / inset.w) * (INSET_V.x1 - INSET_V.x0), -2, 1).toFixed(3);
    st.cim = +clamp(INSET_V.y1 - ((by - inset.y) / inset.h) * (INSET_V.y1 - INSET_V.y0), -1.5, 1.5).toFixed(3);
    creCtl.set(st.cre, false);
    cimCtl.set(st.cim, false);
    lastMsg = '';
    sim.requestRender();
  }
  let drag: null | { kind: 'pan'; bx: number; by: number; v: ViewW } | { kind: 'c' } = null;
  let moved = false;
  let down = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (touches > 1) return;
    const [bx, by] = local(e);
    down = { x: bx, y: by };
    moved = false;
    if (st.frac === 'julia' && inInset(bx, by)) {
      drag = { kind: 'c' };
      if (sim.running) sim.pause();
      setC(bx, by);
    } else if (inPlot(bx, by) && e.pointerType !== 'touch') drag = { kind: 'pan', bx, by, v: { ...V() } };
    else if (inPlot(bx, by)) drag = null;
    if (drag) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const [bx, by] = local(e);
    if (!drag) {
      if (e.pointerType === 'mouse') canvas.style.cursor = st.frac === 'julia' && inInset(bx, by) ? 'crosshair' : inPlot(bx, by) ? 'move' : '';
      return;
    }
    if (Math.hypot(bx - down.x, by - down.y) > 3) moved = true;
    if (drag.kind === 'c') setC(bx, by);
    else if (moved) {
      const s = drag.v.span / layout().plot.w;
      setView({ cx: drag.v.cx - (bx - drag.bx) * s, cy: drag.v.cy + (by - drag.by) * s, span: drag.v.span });
    }
  });
  const end = (e: PointerEvent) => {
    const [bx, by] = local(e);
    const was = drag;
    drag = null;
    canvas.style.cursor = '';
    if (e.type !== 'pointerup' || moved || (was && was.kind === 'c')) return;
    if (inPlot(bx, by) && (st.frac === 'mandelbrot' || st.frac === 'julia')) {
      PL = layout().plot;
      sel = [WX(bx), WY(by)];
      lastMsg = '';
      sim.requestRender();
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('dblclick', (e) => {
    const [bx, by] = local(e);
    if (!inPlot(bx, by)) return;
    PL = layout().plot;
    zoomAt(0.4, WX(bx), WY(by));
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [bx, by] = local(e);
      PL = layout().plot;
      zoomAt(Math.exp(clamp(e.deltaY, -60, 60) * 0.01), WX(bx), WY(by));
    },
    { passive: false },
  );
  // touch: two fingers pinch and pan; one finger taps (or drags c on the Julia map)
  let touches = 0;
  let pinch: null | { d: number; mx: number; my: number; v: ViewW } = null;
  const tpts = (e: TouchEvent) => [...e.touches].slice(0, 2).map((tt) => local(tt));
  canvas.addEventListener(
    'touchstart',
    (e) => {
      touches = e.touches.length;
      if (e.touches.length === 2) {
        e.preventDefault();
        drag = null;
        const [p1, p2] = tpts(e);
        pinch = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), mx: (p1[0] + p2[0]) / 2, my: (p1[1] + p2[1]) / 2, v: { ...V() } };
      } else if (e.touches.length === 1 && st.frac === 'julia') {
        const [p1] = tpts(e);
        if (inInset(p1[0], p1[1])) e.preventDefault();
      }
    },
    { passive: false },
  );
  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [p1, p2] = tpts(e);
      const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      const k = clamp(pinch.d / Math.max(10, d), 0.02, 50);
      PL = layout().plot;
      views[st.frac] = { ...pinch.v };
      const wx = WX(pinch.mx);
      const wy = WY(pinch.my);
      zoomAt(k, wx, wy);
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      const s = V().span / PL.w;
      setView({ cx: V().cx - (mx - pinch.mx) * s, cy: V().cy + (my - pinch.my) * s, span: V().span });
    },
    { passive: false },
  );
  canvas.addEventListener('touchend', (e) => {
    touches = e.touches.length;
    if (e.touches.length < 2) pinch = null;
  });

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.querySelectorAll<HTMLElement>('[data-views]').forEach((el) => (el.hidden = !el.dataset.views!.split(' ').includes(st.frac)));
  }
  fracSel.addEventListener('change', () => {
    st.frac = fracSel.value as Frac;
    sim.pause();
    sel = null;
    lastMsg = '';
    animT = 0;
    if (st.frac === 'fern' || (st.frac === 'sierpinski' && st.chaos)) {
      resetPoints();
      addPoints(st.frac === 'fern' ? 30000 : 20000);
    }
    esc.dirty = true;
    showView();
    sim.requestRender();
  });
  const iterCtl = ui.range('fr-iter', (q) => `${q}`, (q) => ((st.iter = q), (lastMsg = ''), sim.requestRender()));
  const modeCtl = ui.choice<Mode>('fr-mode', (q) => ((st.mode = q), sim.requestRender()));
  const creCtl = ui.range('fr-cre', (q) => fmt(q, 4), (q) => ((st.cre = q), (lastMsg = ''), sim.requestRender()));
  const cimCtl = ui.range('fr-cim', (q) => fmt(q, 4), (q) => ((st.cim = q), (lastMsg = ''), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-jpreset]').forEach((b) =>
    b.addEventListener('click', () => {
      const [cr, ci, name] = JULIA_PRESETS[b.dataset.jpreset!];
      sim.pause();
      creCtl.set(cr);
      cimCtl.set(ci);
      lastMsg = `${name}: c = ${fmt(cr, 4)} ${ci < 0 ? '−' : '+'} ${fmt(Math.abs(ci), 4)}i.`;
      sim.requestRender();
    }),
  );
  root.querySelector('[data-keep]')?.addEventListener('click', () => {
    if (!esc.done) {
      lastMsg = 'Wait for the picture to finish rendering, then keep it.';
      sim.requestRender();
      return;
    }
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 120;
    c.getContext('2d')!.drawImage(esc.off, 0, 0, 160, 120);
    kept.push({ cre: st.cre, cim: st.cim, img: c });
    if (kept.length > 3) kept.shift();
    lastMsg = 'Kept for comparison (up to three are shown under the map).';
    sim.requestRender();
  });
  root.querySelector('[data-unkeep]')?.addEventListener('click', () => {
    kept.length = 0;
    sim.requestRender();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-mplace]').forEach((b) =>
    b.addEventListener('click', () => {
      const [cx, cy, span, name] = M_PLACES[b.dataset.mplace!];
      sim.pause();
      setView({ cx, cy, span });
      if (st.iter < 400) iterCtl.set(400);
      lastMsg = `${name}. Zoom further with double-click, pinch or Ctrl + scroll.`;
    }),
  );
  const sdepthCtl = ui.range('fr-sdepth', (q) => `${q}`, (q) => ((st.sdepth = q), (lastMsg = ''), sim.requestRender()));
  const chaosCtl = ui.choice<'rec' | 'chaos'>('fr-smode', (q) => {
    st.chaos = q === 'chaos';
    resetPoints();
    if (st.chaos) addPoints(500);
    lastMsg = '';
    sim.requestRender();
  });
  const kdepthCtl = ui.range('fr-kdepth', (q) => `${q}`, (q) => ((st.kdepth = q), (lastMsg = ''), sim.requestRender()));
  const newestCtl = ui.toggle('fr-newest', (q) => ((st.newest = q), sim.requestRender()));
  const fmaxCtl = ui.range('fr-points', (q) => q.toLocaleString('en'), (q) => ((st.fernMax = q), sim.requestRender()));
  const leanCtl = ui.range('fr-lean', (q) => fmt(q, 3), (q) => {
    st.lean = q;
    resetPoints();
    addPoints(30000);
    lastMsg = '';
    sim.requestRender();
  });
  const bymapCtl = ui.toggle('fr-bymap', (q) => ((st.byMap = q), (pts.redraw = true), sim.requestRender()));
  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      const z = b.dataset.zoom;
      if (z === 'in') zoomAt(0.5);
      else if (z === 'out') zoomAt(2);
      else setView({ ...DEFAULT_VIEW[st.frac] });
    }),
  );
  root.querySelector('[data-step]')?.addEventListener('click', () => {
    sim.pause();
    if (st.frac === 'sierpinski') {
      if (st.chaos) addPoints(5000);
      else sdepthCtl.set(Math.min(9, st.sdepth + 1));
    } else if (st.frac === 'koch') kdepthCtl.set(Math.min(7, st.kdepth + 1));
    else if (st.frac === 'fern') addPoints(5000);
    else zoomAt(0.5);
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(on: boolean) {
      if (on) animT = 0;
      else {
        // refine the last animation frame to full resolution
        esc.dirty = true;
        sim.requestRender();
      }
    },
    reset() {
      Object.assign(views, JSON.parse(JSON.stringify(DEFAULT_VIEW)));
      Object.assign(st, { iter: 200, mode: 'smooth', cre: -0.123, cim: 0.745, sdepth: 4, chaos: false, kdepth: 2, newest: true, fernMax: 120000, lean: 0.04, byMap: false });
      iterCtl.set(200, false);
      modeCtl.set('smooth', false);
      creCtl.set(-0.123, false);
      cimCtl.set(0.745, false);
      sdepthCtl.set(4, false);
      chaosCtl.set('rec', false);
      kdepthCtl.set(2, false);
      newestCtl.set(true, false);
      fmaxCtl.set(120000, false);
      leanCtl.set(0.04, false);
      bymapCtl.set(false, false);
      sel = null;
      kept.length = 0;
      lastMsg = '';
      resetPoints();
      if (st.frac === 'fern') addPoints(30000);
      esc.dirty = true;
    },
  });

  showView();
  sim.requestRender();
}
