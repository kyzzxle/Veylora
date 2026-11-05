/**
 * Animal cell vs. plant cell comparison with clickable structures,
 * a "highlight differences" mode and a sorting challenge.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'accent', 'success', 'danger'] as const;
type Where = 'animal' | 'plant' | 'both';

interface Info {
  name: string;
  where: Where;
  about: string;
  colour: string;
}
const INFO: Record<string, Info> = {
  membrane: { name: 'Cell membrane', where: 'both', about: 'Controls what enters and leaves the cell.', colour: '#5aa9e6' },
  cytoplasm: { name: 'Cytoplasm', where: 'both', about: 'Jelly-like fluid where many chemical reactions happen.', colour: 'rgba(240, 150, 175, 0.28)' },
  nucleus: { name: 'Nucleus', where: 'both', about: 'Contains DNA and controls the cell.', colour: '#8e6bd8' },
  mitochondria: { name: 'Mitochondria', where: 'both', about: 'Release energy by aerobic respiration.', colour: '#f08a4b' },
  ribosomes: { name: 'Ribosomes', where: 'both', about: 'Make proteins.', colour: '#3d5a80' },
  er: { name: 'Endoplasmic reticulum', where: 'both', about: 'Makes and transports proteins and lipids.', colour: '#5ab4ac' },
  golgi: { name: 'Golgi apparatus', where: 'both', about: 'Packages and ships proteins.', colour: '#f2c14e' },
  wall: { name: 'Cell wall', where: 'plant', about: 'A rigid cellulose layer that supports the cell and stops it bursting.', colour: '#7cae4b' },
  chloroplasts: { name: 'Chloroplasts', where: 'plant', about: 'Carry out photosynthesis using chlorophyll.', colour: '#3f9e4a' },
  vacuole: { name: 'Large central vacuole', where: 'plant', about: 'Stores cell sap and keeps the cell turgid.', colour: '#9ad1ff' },
  starch: { name: 'Starch grains', where: 'plant', about: 'Plants store excess glucose as starch.', colour: '#efe7c9' },
  centrioles: { name: 'Centrioles', where: 'animal', about: 'Help organise cell division (absent from most plant cells).', colour: '#c9a227' },
  lysosomes: { name: 'Lysosomes', where: 'animal', about: 'Digest waste and engulfed material (plants mostly use the vacuole instead).', colour: '#e05a8a' },
  glycogen: { name: 'Glycogen granules', where: 'animal', about: 'Animals store excess glucose as glycogen.', colour: '#b98bd8' },
  smallvac: { name: 'Small temporary vacuoles', where: 'animal', about: 'Animal cells may have small vacuoles or vesicles, but no large permanent vacuole.', colour: '#cfe6ff' },
};

interface Part {
  id: string;
  path: Path2D;
  label?: [number, number];
}

function ell(p: Path2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  const q = new Path2D();
  q.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  p.addPath(q);
}

export function initCompare(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const qEl = root.querySelector<HTMLElement>('[data-q]')!;
  const fbEl = root.querySelector<HTMLElement>('[data-fb]')!;

  const st = { selected: '', diff: false, labels: true, target: '', score: 0, asked: 0 };
  let parts: Part[] = [];

  /* ---------- Build both cells in a design box ----------
   * Wide screens: side by side in 1000 × 560. Narrow (portrait) screens:
   * stacked in 500 × 1060 (plus padding), with the plant cell below the animal cell. */
  const isStacked = () => size.h > size.w;
  // Stacked boxes get extra room top and bottom for the badge and hint chip
  const box = () => (isStacked() ? { bw: 500, bh: 1180, top: 60 } : { bw: 1000, bh: 560, top: 0 });
  function build(stacked: boolean): Part[] {
    const list: Part[] = [];
    // Animal cell (left)
    const ax = 250;
    const ay = 290;
    const cyto = new Path2D();
    cyto.moveTo(ax + 200, ay);
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.1) {
      const r = 200 + Math.sin(a * 3) * 14 + Math.cos(a * 5) * 8;
      cyto.lineTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r * 0.82);
    }
    list.push({ id: 'cytoplasm', path: cyto, label: [ax - 40, ay - 140] });
    const mem = new Path2D();
    mem.addPath(cyto);
    list.push({ id: 'membrane', path: mem, label: [ax + 150, ay - 160] });
    const nucA = new Path2D();
    ell(nucA, ax - 20, ay - 10, 62, 54);
    list.push({ id: 'nucleus', path: nucA, label: [ax - 20, ay - 10] });
    const mitoA = new Path2D();
    for (const [x, y, r] of [[ax + 90, ay - 90, 0.5], [ax - 130, ay + 30, -0.3], [ax + 110, ay + 80, 1.2]]) ell(mitoA, x, y, 30, 13, r);
    list.push({ id: 'mitochondria', path: mitoA, label: [ax - 140, ay + 62] });
    const erA = new Path2D();
    for (let i = 0; i < 3; i++) ell(erA, ax - 20, ay + 70 + i * 14, 70 - i * 8, 6);
    list.push({ id: 'er', path: erA, label: [ax - 20, ay + 128] });
    const golA = new Path2D();
    for (let i = 0; i < 4; i++) ell(golA, ax + 70, ay + 10 + i * 11, 34 - i * 4, 4.5, 0.2);
    list.push({ id: 'golgi', path: golA, label: [ax + 150, ay + 20] });
    const lyso = new Path2D();
    for (const [x, y] of [[ax - 100, ay - 90], [ax + 30, ay - 120], [ax - 150, ay - 30]]) ell(lyso, x, y, 11, 11);
    list.push({ id: 'lysosomes', path: lyso, label: [ax - 160, ay - 110] });
    const cen = new Path2D();
    cen.rect(ax + 40, ay - 70, 26, 9);
    cen.rect(ax + 50, ay - 82, 9, 26);
    list.push({ id: 'centrioles', path: cen, label: [ax + 60, ay - 100] });
    const gly = new Path2D();
    for (const [x, y] of [[ax - 60, ay + 140], [ax - 48, ay + 146], [ax - 54, ay + 132]]) ell(gly, x, y, 5, 5);
    list.push({ id: 'glycogen', path: gly });
    const sv = new Path2D();
    ell(sv, ax + 150, ay - 40, 14, 12);
    list.push({ id: 'smallvac', path: sv });
    const ribA = new Path2D();
    for (let i = 0; i < 24; i++) ell(ribA, ax - 160 + ((i * 47) % 320), ay - 140 + ((i * 71) % 280) * 0.95, 2.6, 2.6);
    list.push({ id: 'ribosomes', path: ribA });

    // Plant cell (right)
    const px = stacked ? 50 : 560;
    const py = stacked ? 610 : 80;
    const pw = 400;
    const ph = 420;
    const wall = new Path2D();
    wall.roundRect(px, py, pw, ph, 18);
    const inner = new Path2D();
    inner.roundRect(px + 14, py + 14, pw - 28, ph - 28, 12);
    list.push({ id: 'wall', path: wall, label: [px + 70, py + ph - 2] });
    list.push({ id: 'cytoplasm', path: inner });
    list.push({ id: 'membrane', path: inner, label: [px + 90, py + 26] });
    const vac = new Path2D();
    vac.roundRect(px + 120, py + 90, 230, 250, 60);
    list.push({ id: 'vacuole', path: vac, label: [px + 235, py + 215] });
    const nucP = new Path2D();
    ell(nucP, px + 70, py + 90, 38, 34);
    list.push({ id: 'nucleus', path: nucP, label: [px + 70, py + 90] });
    const chl = new Path2D();
    for (const [x, y, r] of [[px + 60, py + 200, 1.4], [px + 60, py + 290, 1.6], [px + 110, py + 370, 0], [px + 220, py + 370, 0.1], [px + 330, py + 370, 0], [px + 370, py + 250, 1.5], [px + 370, py + 140, 1.4], [px + 250, py + 50, 0], [px + 150, py + 50, 0.1]])
      ell(chl, x, y, 24, 11, r);
    list.push({ id: 'chloroplasts', path: chl, label: [px + 330, py + 400] });
    const mitoP = new Path2D();
    ell(mitoP, px + 60, py + 345, 20, 9, 0.6);
    ell(mitoP, px + 300, py + 52, 20, 9, 0);
    list.push({ id: 'mitochondria', path: mitoP });
    const st2 = new Path2D();
    for (const [x, y] of [[px + 340, py + 330], [px + 32, py + 160]]) ell(st2, x, y, 9, 7);
    list.push({ id: 'starch', path: st2, label: [px + 360, py + 310] });
    const golP = new Path2D();
    for (let i = 0; i < 3; i++) ell(golP, px + 60, py + 245 + i * 9, 22 - i * 3, 3.5);
    list.push({ id: 'golgi', path: golP });
    const erP = new Path2D();
    for (let i = 0; i < 2; i++) ell(erP, px + 130, py + 130 - 20 + i * 10, 26, 4, 0.9);
    list.push({ id: 'er', path: erP });
    const ribP = new Path2D();
    for (let i = 0; i < 14; i++) ell(ribP, px + 30 + ((i * 53) % 80), py + 120 + ((i * 89) % 220), 2.6, 2.6);
    list.push({ id: 'ribosomes', path: ribP });
    return list;
  }

  const transform = () => {
    const { w, h } = size;
    const { bw, bh, top } = box();
    const k = Math.min(w / bw, h / bh);
    return new DOMMatrix().translate((w - bw * k) / 2, (h - bh * k) / 2).scale(k).translate(0, top);
  };

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const m = transform();
    const stacked = isStacked();
    parts = build(stacked).map((p) => {
      const path = new Path2D();
      path.addPath(p.path, m);
      return { ...p, path, label: p.label ? ([p.label[0] * m.a + m.e, p.label[1] * m.d + m.f] as [number, number]) : undefined };
    });
    for (const part of parts) {
      const info = INFO[part.id];
      const dim = st.diff && info.where === 'both';
      ctx.globalAlpha = dim ? 0.25 : 1;
      if (part.id === 'membrane') {
        ctx.strokeStyle = info.colour;
        ctx.lineWidth = 4;
        ctx.stroke(part.path);
      } else {
        if (part.id === 'cytoplasm') {
          // Paint the background first so the wall's green does not show through
          ctx.globalAlpha = 1;
          ctx.fillStyle = pal['sim-bg'];
          ctx.fill(part.path);
          ctx.globalAlpha = dim ? 0.25 : 1;
        }
        ctx.fillStyle = info.colour;
        ctx.fill(part.path);
        if (part.id === 'wall') {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#4d7a2a';
          ctx.stroke(part.path);
        }
      }
      if (st.diff && !dim) {
        ctx.strokeStyle = info.where === 'plant' ? pal.success : pal.danger;
        ctx.lineWidth = 2.5;
        ctx.stroke(part.path);
      }
      if (part.id === st.selected) {
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 3.5;
        ctx.stroke(part.path);
      }
      ctx.globalAlpha = 1;
    }
    // Titles
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(Math.max(12, 16 * m.a), 700);
    ctx.textAlign = 'center';
    ctx.fillText('Animal cell', 250 * m.a + m.e, 46 * m.d + m.f);
    ctx.fillText('Plant cell', (stacked ? 250 : 760) * m.a + m.e, (stacked ? 576 : 46) * m.d + m.f);
    ctx.textAlign = 'left';
    // Labels
    if (st.labels) {
      ctx.font = font(11, 650);
      for (const part of parts) {
        if (!part.label) continue;
        const text = INFO[part.id].name;
        const tw = ctx.measureText(text).width;
        const [x, y] = part.label;
        const bx = Math.max(4, Math.min(w - tw - 14, x - tw / 2 - 5));
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pal['bg-elev'];
        ctx.beginPath();
        ctx.roundRect(bx, y - 10, tw + 10, 20, 10);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal['sim-text'];
        ctx.fillText(text, bx + 5, y + 4);
      }
    }
    if (st.diff) {
      // Legend between the two cells, clear of the hint chip
      ctx.font = font(11, 700);
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.danger;
      const [lx, ly] = stacked ? [250, 512] : [505, 250];
      ctx.fillText('■ animal only', lx * m.a + m.e, ly * m.d + m.f);
      ctx.fillStyle = pal.success;
      ctx.fillText('■ plant only', lx * m.a + m.e, (ly + 20) * m.d + m.f);
      ctx.textAlign = 'left';
    }
    sim.setBadge(st.diff ? 'Differences highlighted' : 'Explore');
    ui.readout('score', `${st.score} of ${st.asked}`);
  }

  /* ---------- Interaction ---------- */
  const whereText = (w: Where) => (w === 'both' ? 'Both animal and plant cells' : w === 'plant' ? 'Plant cells only' : 'Animal cells (most plant cells lack it)');
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * size.dpr;
    const y = (e.clientY - r.top) * size.dpr;
    // Topmost first, but skip the large background shapes unless nothing else is hit
    const order = [...parts].reverse();
    const inside = (p: Part) => {
      if (p.id !== 'membrane') return ctx.isPointInPath(p.path, x, y);
      // The membrane is a thin line, so test near its outline only
      ctx.save();
      ctx.lineWidth = 10;
      const near = ctx.isPointInStroke(p.path, x, y);
      ctx.restore();
      return near;
    };
    const hit = order.find((p) => !['cytoplasm', 'membrane', 'wall'].includes(p.id) && inside(p)) ?? order.find(inside);
    if (!hit) return;
    const id = hit.id;
    st.selected = id;
    const info = INFO[id];
    ui.readout('selected', info.name);
    ui.readout('where', whereText(info.where), info.where === 'both' ? null : 'ok');
    sim.showTooltip(e.clientX - r.left, e.clientY - r.top, info.name, info.about);
    sim.requestRender();
  });

  root.querySelector('[data-new]')!.addEventListener('click', () => {
    const ids = Object.keys(INFO).filter((id) => id !== st.target);
    st.target = ids[Math.floor(Math.random() * ids.length)];
    qEl.textContent = `${INFO[st.target].name}: animal only, plant only, or both?`;
    fbEl.textContent = '';
  });
  root.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!st.target) {
        fbEl.textContent = 'Press “New question” first.';
        return;
      }
      const info = INFO[st.target];
      st.asked++;
      const ok = b.dataset.ans === info.where;
      if (ok) st.score++;
      fbEl.textContent = `${ok ? 'Correct!' : 'Not quite.'} ${info.name}: ${whereText(info.where).toLowerCase()}. ${info.about}`;
      fbEl.style.color = ok ? 'var(--success)' : 'var(--danger)';
      sim.announce(fbEl.textContent);
      st.target = '';
      qEl.textContent = 'Press “New question” for another.';
      sim.requestRender();
    }),
  );

  const ui = controls(root);
  const diffCtl = ui.toggle('cc-diff', (v) => ((st.diff = v), sim.requestRender()));
  ui.toggle('cc-labels', (v) => ((st.labels = v), sim.requestRender()));

  const sim = createSimController(root, {
    render,
    reset() {
      Object.assign(st, { selected: '', diff: false, target: '', score: 0, asked: 0 });
      diffCtl.set(false, false);
      qEl.textContent = 'Press “New question” to start.';
      fbEl.textContent = '';
      ui.readout('selected', '—');
      ui.readout('where', '—');
    },
  });
  ui.readout('selected', '—');
  ui.readout('where', '—');
  sim.requestRender();
}
