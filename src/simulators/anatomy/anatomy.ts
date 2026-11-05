/**
 * Plant anatomy explorer: each view is a list of parts built as Path2D shapes,
 * so the same shape is used for drawing, highlighting and click detection.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { PARTS, VIEWS, type ViewId } from './data';

const VIEW_LABEL = Object.fromEntries(VIEWS.map((v) => [v.id, v.label])) as Record<ViewId, string>;

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'accent', 'sim-water', 'warning'] as const;

interface Part {
  id: string;
  path: Path2D;
  fill?: string;
  stroke?: string;
  width?: number;
  label?: [number, number]; // label anchor
}

const GREEN = '#4f9a3c';
const DARK_GREEN = '#2f6e2a';
const SOIL = '#7a5235';

/** Add a separate ellipse to a path (a bare ellipse() would join it to the previous shape with a line). */
function addEllipse(p: Path2D, x: number, y: number, rx: number, ry: number, rot: number) {
  const q = new Path2D();
  q.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  p.addPath(q);
}

export function initPlantAnatomy(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const zoomBtn = root.querySelector<HTMLButtonElement>('[data-zoom]')!;
  const infoTitle = root.querySelector<HTMLElement>('[data-info-title]')!;
  const infoText = root.querySelector<HTMLElement>('[data-info-text]')!;

  const st = { view: 'plant' as ViewId, labels: true, transport: true, selected: '', target: '', score: 0, tries: 0, t: 0 };
  let parts: Part[] = [];
  let flowPaths: { path: [number, number][]; colour: string; dir: 1 | -1 }[] = [];

  /* ---------- View builders ---------- */
  function buildPlant(w: number, h: number) {
    const cx = w * 0.45;
    const ground = h * 0.66;
    const top = h * 0.14;
    const list: Part[] = [];
    const stem = new Path2D();
    stem.moveTo(cx, ground);
    stem.bezierCurveTo(cx - 10, ground - (ground - top) * 0.4, cx + 12, ground - (ground - top) * 0.7, cx, top + 30);
    list.push({ id: 'stem', path: stem, stroke: GREEN, width: 10, label: [cx + 8, ground - 80] });
    const leaves: [number, number, number][] = [
      [ground - 70, -1, 0.5],
      [ground - 140, 1, -0.45],
      [ground - 200, -1, 0.35],
    ];
    leaves.forEach(([y, side, rotA], i) => {
      const leaf = new Path2D();
      addEllipse(leaf, cx + side * 52, y, 50, 18, rotA * side * -1);
      list.push({ id: 'leaf', path: leaf, fill: GREEN, stroke: DARK_GREEN, width: 1.5, label: i === 0 ? [cx - 100, y] : undefined });
    });
    const bud = new Path2D();
    addEllipse(bud, cx + 16, ground - 168, 7, 11, 0.5);
    list.push({ id: 'bud', path: bud, fill: DARK_GREEN, label: [cx + 30, ground - 175] });
    const flower = new Path2D();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      addEllipse(flower, cx + Math.cos(a) * 20, top + 14 + Math.sin(a) * 20, 18, 10, a);
    }
    list.push({ id: 'flower', path: flower, fill: '#e76fa2', stroke: '#b2426f', width: 1, label: [cx + 46, top] });
    const centre = new Path2D();
    centre.arc(cx, top + 14, 9, 0, Math.PI * 2);
    list.push({ id: 'flower', path: centre, fill: '#f7c948' });
    const roots = new Path2D();
    roots.moveTo(cx, ground);
    roots.lineTo(cx + 4, ground + 90);
    for (const [dx, dy, len] of [[-1, 25, 60], [1, 40, 55], [-1, 60, 45], [1, 70, 40], [-1, 82, 25]] as const) {
      roots.moveTo(cx + 2, ground + dy);
      roots.quadraticCurveTo(cx + dx * len * 0.5, ground + dy + 6, cx + dx * len, ground + dy + 22);
    }
    list.push({ id: 'roots', path: roots, stroke: '#d9c8a5', width: 4, label: [cx + 70, ground + 50] });
    flowPaths = [
      { path: [[cx + 4, ground + 80], [cx, ground], [cx + 4, ground - 120], [cx, top + 30]], colour: 'sim-water', dir: 1 },
      { path: [[cx - 4, top + 40], [cx - 6, ground - 120], [cx - 4, ground], [cx - 2, ground + 70]], colour: 'warning', dir: 1 },
    ];
    return { list, ground };
  }

  function buildLeaf(w: number, h: number) {
    const x0 = w * 0.06;
    const x1 = w * 0.94;
    const y0 = h * 0.14;
    const list: Part[] = [];
    const rect = (y: number, hh: number) => {
      const p = new Path2D();
      p.rect(x0, y, x1 - x0, hh);
      return p;
    };
    list.push({ id: 'cuticle', path: rect(y0, 8), fill: '#e8e3b0', label: [x1 - 40, y0 + 4] });
    const ue = new Path2D();
    for (let x = x0; x < x1; x += 34) ue.rect(x, y0 + 8, 32, 22);
    list.push({ id: 'upper-epidermis', path: ue, fill: '#dfeccd', stroke: '#9bb57e', width: 1, label: [x1 - 60, y0 + 19] });
    const pal1 = new Path2D();
    for (let x = x0; x < x1; x += 22) pal1.roundRect(x + 1, y0 + 32, 20, 70, 6);
    list.push({ id: 'palisade', path: pal1, fill: '#7dbd5a', stroke: '#4f8c37', width: 1, label: [x1 - 70, y0 + 66] });
    const sp = new Path2D();
    for (let i = 0; i < 28; i++) {
      const cx = x0 + 16 + ((i * 53) % (x1 - x0 - 32));
      const cy = y0 + 118 + ((i * 37) % 60);
      addEllipse(sp, cx, cy, 15, 11, i);
    }
    list.push({ id: 'spongy', path: sp, fill: '#a7d488', stroke: '#6fa356', width: 1, label: [x0 + 70, y0 + 150] });
    const vx = (x0 + x1) / 2;
    const vy = y0 + 142;
    const xy = new Path2D();
    xy.arc(vx, vy - 9, 13, 0, Math.PI * 2);
    list.push({ id: 'leaf-xylem', path: xy, fill: '#5b8fd6', stroke: '#2e5f9e', width: 1.5, label: [vx + 70, vy - 18] });
    const ph = new Path2D();
    ph.arc(vx, vy + 15, 11, 0, Math.PI * 2);
    list.push({ id: 'leaf-phloem', path: ph, fill: '#e8a54b', stroke: '#b5761f', width: 1.5, label: [vx + 70, vy + 22] });
    const le = new Path2D();
    const ly = y0 + 196;
    for (let x = x0; x < x1; x += 34) if (Math.abs(x + 16 - (x0 + x1 * 0.3)) > 30) le.rect(x, ly, 32, 20);
    list.push({ id: 'lower-epidermis', path: le, fill: '#dfeccd', stroke: '#9bb57e', width: 1, label: [x1 - 60, ly + 10] });
    const sx = x0 + x1 * 0.3;
    const stoma = new Path2D();
    addEllipse(stoma, sx - 9, ly + 10, 8, 12, 0);
    addEllipse(stoma, sx + 9, ly + 10, 8, 12, 0);
    list.push({ id: 'stoma', path: stoma, fill: '#5c9e3c', stroke: '#2f6e2a', width: 1.5, label: [sx, ly + 40] });
    list.push({ id: 'cuticle', path: rect(ly + 20, 7), fill: '#e8e3b0' });
    flowPaths = [];
    return { list };
  }

  function buildStem(w: number, h: number) {
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.42;
    const list: Part[] = [];
    const ring = (r1: number, r2: number) => {
      const p = new Path2D();
      p.arc(cx, cy, r1, 0, Math.PI * 2);
      p.arc(cx, cy, r2, 0, Math.PI * 2, true);
      return p;
    };
    list.push({ id: 'stem-epidermis', path: ring(R, R - 8), fill: '#9fcb7d', label: [cx + R * 0.72, cy - R * 0.72] });
    list.push({ id: 'cortex', path: ring(R - 8, R * 0.72), fill: '#cfe5b8', label: [cx - R * 0.82, cy + R * 0.2] });
    list.push({ id: 'pith', path: ring(R * 0.5, 0), fill: '#f3f0dc', label: [cx, cy] });
    const n = 8;
    const xyl = new Path2D();
    const phl = new Path2D();
    const cam = new Path2D();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const bx = cx + Math.cos(a) * R * 0.62;
      const by = cy + Math.sin(a) * R * 0.62;
      addEllipse(xyl, cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, R * 0.07, R * 0.09, a);
      addEllipse(phl, cx + Math.cos(a) * R * 0.69, cy + Math.sin(a) * R * 0.69, R * 0.05, R * 0.08, a);
      addEllipse(cam, bx, by, R * 0.012, R * 0.07, a);
    }
    list.push({ id: 'stem-xylem', path: xyl, fill: '#5b8fd6', stroke: '#2e5f9e', width: 1, label: [cx + R * 0.55, cy + 6] });
    list.push({ id: 'stem-phloem', path: phl, fill: '#e8a54b', stroke: '#b5761f', width: 1, label: [cx - R * 0.15, cy - R * 0.7] });
    list.push({ id: 'cambium', path: cam, fill: '#2f6e2a', label: [cx + R * 0.45, cy + R * 0.45] });
    flowPaths = [];
    return { list };
  }

  function buildRoot(w: number, h: number) {
    const cx = w * 0.5;
    const list: Part[] = [];
    const W = Math.min(70, w * 0.1);
    const top = h * 0.06;
    const bottom = h * 0.9;
    const zone = (y1: number, y2: number) => {
      const p = new Path2D();
      p.rect(cx - W, y1, W * 2, y2 - y1);
      return p;
    };
    const L = bottom - top;
    list.push({ id: 'root-hairs', path: zone(top, top + L * 0.42), fill: '#efe3c8', label: [cx + W + 110, top + L * 0.2] });
    const hairs = new Path2D();
    for (let i = 0; i < 14; i++) {
      const y = top + 8 + i * ((L * 0.4) / 14);
      const side = i % 2 ? 1 : -1;
      hairs.moveTo(cx + side * W, y);
      hairs.quadraticCurveTo(cx + side * (W + 30), y - 6, cx + side * (W + 60 + (i % 3) * 12), y + 4);
    }
    list.push({ id: 'root-hairs', path: hairs, stroke: '#d4c29b', width: 3 });
    list.push({ id: 'elongation', path: zone(top + L * 0.42, top + L * 0.7), fill: '#e8dcbf', label: [cx + W + 90, top + L * 0.56] });
    list.push({ id: 'meristem', path: zone(top + L * 0.7, top + L * 0.86), fill: '#d6c49d', label: [cx + W + 90, top + L * 0.78] });
    const cap = new Path2D();
    cap.moveTo(cx - W, top + L * 0.86);
    cap.quadraticCurveTo(cx - W, bottom + 10, cx, bottom + 14);
    cap.quadraticCurveTo(cx + W, bottom + 10, cx + W, top + L * 0.86);
    cap.closePath();
    list.push({ id: 'root-cap', path: cap, fill: '#b99d6b', label: [cx + W + 70, bottom] });
    const xy = new Path2D();
    xy.rect(cx - W * 0.22, top, W * 0.44, L * 0.68);
    list.push({ id: 'root-xylem', path: xy, fill: '#8fb3e6', stroke: '#2e5f9e', width: 1, label: [cx - W - 90, top + L * 0.3] });
    flowPaths = [{ path: [[cx, top + L * 0.6], [cx, top]], colour: 'sim-water', dir: 1 }];
    return { list };
  }

  function buildFlower(w: number, h: number) {
    const cx = w * 0.5;
    const base = h * 0.82;
    const list: Part[] = [];
    const sepal = new Path2D();
    sepal.moveTo(cx - 30, base);
    sepal.quadraticCurveTo(cx - 120, base - 20, cx - 130, base - 60);
    sepal.quadraticCurveTo(cx - 70, base - 40, cx - 20, base - 10);
    sepal.moveTo(cx + 30, base);
    sepal.quadraticCurveTo(cx + 120, base - 20, cx + 130, base - 60);
    sepal.quadraticCurveTo(cx + 70, base - 40, cx + 20, base - 10);
    list.push({ id: 'sepal', path: sepal, fill: GREEN, stroke: DARK_GREEN, width: 1.5, label: [cx - 150, base - 70] });
    const petal = new Path2D();
    petal.moveTo(cx - 40, base - 10);
    petal.bezierCurveTo(cx - 220, base - 120, cx - 160, base - 300, cx - 70, base - 130);
    petal.closePath();
    petal.moveTo(cx + 40, base - 10);
    petal.bezierCurveTo(cx + 220, base - 120, cx + 160, base - 300, cx + 70, base - 130);
    petal.closePath();
    list.push({ id: 'petal', path: petal, fill: '#f29ac0', stroke: '#c0527f', width: 1.5, label: [cx - 190, base - 220] });
    const ovary = new Path2D();
    addEllipse(ovary, cx, base - 34, 30, 26, 0);
    list.push({ id: 'ovary', path: ovary, fill: '#9ccc65', stroke: '#558b2f', width: 1.5, label: [cx + 60, base - 20] });
    const ovules = new Path2D();
    for (const [dx, dy] of [[-10, -6], [8, -10], [-4, 8], [12, 6]]) addEllipse(ovules, cx + dx, base - 34 + dy, 6, 4, 0.4);
    list.push({ id: 'ovule', path: ovules, fill: '#fff4c2', stroke: '#b59b3a', width: 1, label: [cx - 80, base - 2] });
    const style = new Path2D();
    style.rect(cx - 4, base - 160, 8, 102);
    list.push({ id: 'style', path: style, fill: '#9ccc65', label: [cx - 70, base - 110] });
    const stigma = new Path2D();
    addEllipse(stigma, cx, base - 166, 16, 8, 0);
    list.push({ id: 'stigma', path: stigma, fill: '#7cb342', stroke: '#33691e', width: 1.5, label: [cx, base - 200] });
    const filament = new Path2D();
    filament.moveTo(cx - 22, base - 40);
    filament.quadraticCurveTo(cx - 50, base - 100, cx - 52, base - 140);
    filament.moveTo(cx + 22, base - 40);
    filament.quadraticCurveTo(cx + 50, base - 100, cx + 52, base - 140);
    list.push({ id: 'filament', path: filament, stroke: '#e6d27a', width: 3, label: [cx + 95, base - 90] });
    const anther = new Path2D();
    addEllipse(anther, cx - 52, base - 148, 8, 14, -0.2);
    addEllipse(anther, cx + 52, base - 148, 8, 14, 0.2);
    list.push({ id: 'anther', path: anther, fill: '#f4b400', stroke: '#a77800', width: 1.5, label: [cx + 110, base - 160] });
    flowPaths = [];
    return { list };
  }

  /** Scale parts drawn in a fixed design box (bw × bh) to fit the canvas, centred. */
  function fitParts(list: Part[], bw: number, bh: number) {
    const { w, h } = size;
    const k = Math.min(w / bw, h / bh);
    const m = new DOMMatrix().translate((w - bw * k) / 2, (h - bh * k) / 2).scale(k);
    return list.map((part) => {
      const path = new Path2D();
      path.addPath(part.path, m);
      const label = part.label ? ([part.label[0] * k + m.e, part.label[1] * k + m.f] as [number, number]) : undefined;
      return { ...part, path, width: part.width ? part.width * Math.max(0.6, k) : part.width, label };
    });
  }

  /* ---------- Render ---------- */
  function build() {
    const { w, h } = size;
    let b: { list: Part[]; ground?: number };
    if (st.view === 'plant') b = buildPlant(w, h);
    else if (st.view === 'stem') b = buildStem(w, h);
    else if (st.view === 'root') b = buildRoot(w, h);
    else if (st.view === 'leaf') b = { list: fitParts(buildLeaf(620, 300).list, 620, 300) };
    else b = { list: fitParts(buildFlower(480, 420).list, 480, 420) };
    parts = b.list;
    return b;
  }

  function polyPoint(path: [number, number][], u: number): [number, number] {
    const segs = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[1] - path[i][1]));
    const total = segs.reduce((a, b) => a + b, 0);
    let d = u * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i]) {
        const t = d / segs[i];
        return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
      }
      d -= segs[i];
    }
    return path[path.length - 1];
  }

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const b = build();
    if (st.view === 'plant' && b.ground !== undefined) {
      ctx.fillStyle = SOIL;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, b.ground, w, h);
      ctx.globalAlpha = 1;
    }
    for (const part of parts) {
      const sel = part.id === st.selected;
      if (part.fill) {
        ctx.fillStyle = part.fill;
        ctx.fill(part.path);
      }
      if (part.stroke) {
        ctx.strokeStyle = part.stroke;
        ctx.lineWidth = part.width ?? 1;
        ctx.lineCap = 'round';
        ctx.stroke(part.path);
      }
      if (sel) {
        ctx.save();
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = (part.fill ? 3 : (part.width ?? 2) + 4);
        ctx.globalAlpha = 0.9;
        ctx.stroke(part.path);
        ctx.restore();
      }
    }
    // Transport dots
    if (st.transport) {
      for (const f of flowPaths) {
        ctx.fillStyle = pal[f.colour as 'sim-water' | 'warning'];
        for (let k = 0; k < 6; k++) {
          const u = ((st.t * 0.12 + k / 6) % 1 + 1) % 1;
          const [x, y] = polyPoint(f.path, u);
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Labels
    if (st.labels && !st.target) {
      ctx.font = font(11, 650);
      for (const part of parts) {
        if (!part.label) continue;
        const [x, y] = part.label;
        const text = PARTS[part.id].name;
        const tw = ctx.measureText(text).width;
        const bx = Math.max(4, Math.min(w - tw - 14, x - tw / 2 - 5));
        ctx.fillStyle = pal['bg-elev'];
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(bx, y - 10, tw + 10, 20, 10);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal['sim-text'];
        ctx.fillText(text, bx + 5, y + 4);
      }
    }
    if (st.transport && flowPaths.length) {
      ctx.font = font(10, 600);
      ctx.fillStyle = pal['sim-water'];
      ctx.fillText('● water (xylem)', 10, h - 26);
      if (flowPaths.length > 1) {
        ctx.fillStyle = pal.warning;
        ctx.fillText('● sugars (phloem)', 10, h - 12);
      }
    }

    ui.readout('selected', st.selected ? PARTS[st.selected].name : '—');
    ui.readout('challenge', st.target ? `Find: ${PARTS[st.target].name}` : 'Not running');
    ui.readout('score', `${st.score} of ${st.tries}`);
    zoomBtn.hidden = !(st.view === 'plant' && ['leaf', 'stem', 'roots', 'flower'].includes(st.selected));
    sim.setBadge(VIEW_LABEL[st.view]);
    canvas.setAttribute('aria-label', `${st.view === 'plant' ? 'Whole plant' : `${st.view} close-up`} with parts: ${[...new Set(parts.map((q) => PARTS[q.id].name))].join(', ')}.`);
  }

  /* ---------- Interaction ---------- */
  function partAt(x: number, y: number) {
    const dpr = size.dpr;
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part.fill && ctx.isPointInPath(part.path, x * dpr, y * dpr)) return part;
      if (part.stroke && !part.fill) {
        ctx.save();
        ctx.lineWidth = (part.width ?? 1) + 10;
        const hit = ctx.isPointInStroke(part.path, x * dpr, y * dpr);
        ctx.restore();
        if (hit) return part;
      }
    }
    return null;
  }
  function select(id: string, x: number, y: number) {
    st.selected = id;
    infoTitle.textContent = PARTS[id].name;
    infoText.textContent = PARTS[id].about;
    if (st.target) {
      st.tries++;
      if (id === st.target) {
        st.score++;
        sim.showTooltip(x, y, 'Correct!', `${PARTS[id].name}: ${PARTS[id].about}`);
      } else {
        sim.showTooltip(x, y, 'Not quite', `That is the ${PARTS[id].name.toLowerCase()}. Try again to find the ${PARTS[st.target].name.toLowerCase()}.`);
        sim.requestRender();
        return;
      }
      st.target = '';
    } else {
      sim.showTooltip(x, y, PARTS[id].name, PARTS[id].about);
    }
    sim.requestRender();
  }
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    build();
    const part = partAt(x, y);
    if (part) select(part.id, x, y);
  });

  const ui = controls(root);
  const viewCtl = ui.choice<ViewId>('pa-view', (v) => {
    st.view = v;
    st.selected = '';
    st.target = '';
    sim.hideTooltip();
    sim.requestRender();
  });
  ui.toggle('pa-labels', (v) => ((st.labels = v), sim.requestRender()));
  ui.toggle('pa-transport', (v) => ((st.transport = v), sim.requestRender()));
  zoomBtn.addEventListener('click', () => {
    const map: Record<string, ViewId> = { leaf: 'leaf', stem: 'stem', roots: 'root', flower: 'flower' };
    const v = map[st.selected];
    if (v) viewCtl.set(v);
  });
  root.querySelector('[data-challenge]')!.addEventListener('click', () => {
    build();
    const ids = [...new Set(parts.map((q) => q.id))].filter((id) => id !== st.target);
    st.target = ids[Math.floor(Math.random() * ids.length)];
    st.selected = '';
    sim.announce(`Find the ${PARTS[st.target].name}.`);
    sim.requestRender();
  });

  const sim = createSimController(root, {
    step: (dt) => (st.t += dt),
    render,
    reset() {
      viewCtl.set('plant', false);
      Object.assign(st, { view: 'plant', selected: '', target: '', score: 0, tries: 0 });
      infoTitle.textContent = 'Click a part of the plant';
      infoText.textContent = 'Each structure has a job. Click one to learn what it does, or use “Find the part” to test yourself.';
    },
  });
  sim.requestRender();
}
