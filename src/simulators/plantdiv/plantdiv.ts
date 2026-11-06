/**
 * Plant diversity and life cycles, in three views:
 *   groups – an evolutionary tree of the four main groups of land plants with
 *            the key innovations, and a sorting task with 12 specimens
 *   cycle  – alternation of generations, step by step, for a moss, a fern, a
 *            pine and a flowering plant, coloured by chromosome number
 *   water  – why mosses and ferns need water to reproduce: sperm can only swim
 *            through a continuous water film (≥ 30 on the slider), conifer
 *            pollen needs wind, and an insect-pollinated flower needs insects
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { CYCLES, GROUPS, GROUP_ORDER, INNOVATIONS, SPECIMENS, type Art, type CycleId, type GroupId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'groups' | 'cycle' | 'water';
type Pt = [number, number];
const N_COL = '#4dabf7'; // haploid
const D_COL = '#f08c00'; // diploid
const DEF = { view: 'groups' as View, cycle: 'moss' as CycleId, stage: 0, water: 60, wind: 50, insects: true, sun: false };
const SWIM = 30; // water film needed for sperm to swim

interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}

export function initPlantDiv(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const st = { ...DEF };
  let t = 0;
  let stageT = 0;
  let autoT = 0;

  /* ---------- Sorting state ---------- */
  let placed: Record<GroupId, Art[]> = { bryo: [], fern: [], gymno: [], angio: [] };
  let order: Art[] = [];
  let attempts = 0;
  let wrong: { art: Art; t: number } | null = null;
  let lastMsg = '';
  function shuffle() {
    order = SPECIMENS.map((s) => s.id).sort(() => Math.random() - 0.5);
    placed = { bryo: [], fern: [], gymno: [], angio: [] };
    attempts = 0;
    lastMsg = '';
  }

  /* ---------- Water experiment state ---------- */
  type Particle = { x: number; y: number; vx: number; vy: number; age: number; ok: boolean; done: boolean };
  const parts: Record<CycleId, Particle[]> = { moss: [], fern: [], pine: [], flower: [] };
  const success: Record<CycleId, number[]> = { moss: [], fern: [], pine: [], flower: [] };
  let spawnT = 0;
  const bee = { x: 40, y: 120, dir: 1 };
  const canFertilise = (id: CycleId) => (id === 'moss' || id === 'fern' ? st.water >= SWIM : id === 'pine' ? st.wind >= 20 : st.insects);

  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    stageT += dt;
    if (st.view === 'cycle') {
      autoT += dt;
      if (autoT > 3.2) {
        autoT = 0;
        goStage((st.stage + 1) % CYCLES[st.cycle].stages.length);
      }
    }
    if (st.view === 'water') stepWater(dt);
  }
  /** Each panel uses local coordinates 0–230 × 0–440 (ground at 360). */
  function stepWater(dt: number) {
    if (st.sun && st.water > 0) {
      st.water = Math.max(0, st.water - 3 * dt);
      waterCtl.set(Math.round(st.water), false);
    }
    spawnT += dt;
    const spawn = spawnT > 0.7;
    if (spawn) spawnT = 0;
    for (const id of ['moss', 'fern', 'pine', 'flower'] as CycleId[]) {
      const ps = parts[id];
      if (spawn && ps.length < 14) {
        if (id === 'moss' || id === 'fern') ps.push({ x: 50, y: 352, vx: 0, vy: 0, age: 0, ok: st.water >= SWIM, done: false });
        else if (id === 'pine') ps.push({ x: 60, y: 150, vx: 0, vy: 0, age: 0, ok: false, done: false });
        else if (!st.insects) ps.push({ x: 55, y: 230, vx: 0, vy: 0, age: 0, ok: false, done: false });
      }
      for (const p of ps) {
        p.age += dt;
        if (p.done) continue;
        if (id === 'moss' || id === 'fern') {
          if (st.water >= SWIM) {
            p.vx = 45;
            p.y = 352 + Math.sin(p.age * 12 + p.x) * 2;
            p.ok = true;
          } else p.vx = 0;
          p.x += p.vx * dt;
          if (p.x >= 178) {
            p.done = true;
            success[id].push(t);
          }
        } else if (id === 'pine') {
          p.vx = st.wind * 1.4;
          p.vy = 18 + Math.sin(p.age * 3) * 6;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.x > 160 && p.x < 200 && p.y > 140 && p.y < 230) {
            p.done = true;
            success.pine.push(t);
          }
        } else {
          // insect-pollinated flower: pollen is sticky and heavy, so without insects it just drops
          p.vy = 60;
          p.y += p.vy * dt;
        }
      }
      parts[id] = ps.filter((p) => p.age < (p.done ? 0.6 : 5) && p.y < 380 && p.x < 240);
      success[id] = success[id].filter((x) => t - x < 6);
    }
    if (st.insects) {
      bee.x += bee.dir * 70 * dt;
      if (bee.x > 180) {
        bee.dir = -1;
        success.flower.push(t);
      }
      if (bee.x < 50) bee.dir = 1;
      bee.y = 200 + Math.sin(t * 5) * 14;
    }
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let K = 1;
  let cur = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  let areas: Area[] = [];
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({ test: (px, py) => {
      const lx = (px - f.x) / f.s;
      const ly = (py - f.y) / f.s;
      return lx >= x && lx <= x + w && ly >= y && ly <= y + h;
    }, title, text });
  }
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(s: string, x: number, y: number, maxW: number, px = 11.5, color = pal['text-muted'], wt = 600) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    const lh = (px + 4) / cur;
    let line = '';
    for (const w of s.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
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
  const line = (pts: Pt[], color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  const dot = (x: number, y: number, r: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const ell = (x: number, y: number, rx: number, ry: number, c: string, rot = 0) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  };

  /* ---------- Specimen drawings (bottom-centre at 0,0; about 100 units tall) ---------- */
  function specimen(art: Art) {
    if (art === 'moss') {
      for (let k = -4; k <= 4; k++) {
        const x = k * 7;
        line([[x, 0], [x + k, -32 - (k % 2) * 6]], '#4c8c2c', 3);
        for (let y = -6; y > -32; y -= 6) {
          line([[x, y], [x - 4, y - 4]], '#6ab04c', 2);
          line([[x, y], [x + 4, y - 4]], '#6ab04c', 2);
        }
      }
      for (const x of [-14, 10]) {
        line([[x, -34], [x + 2, -78]], '#8a5a2b', 2);
        ell(x + 2, -82, 4, 7, '#a0522d', 0.2);
      }
    } else if (art === 'liverwort') {
      for (const [x, r] of [[-20, 0.4], [0, 0], [20, -0.4]] as Pt[]) ell(x, -6, 22, 9, '#3f8f3a', r);
      line([[6, -10], [6, -48]], '#6ab04c', 2);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI;
        line([[6, -48], [6 + Math.cos(a) * 12, -48 - Math.sin(a) * 6]], '#4c8c2c', 3);
      }
    } else if (art === 'hornwort') {
      ell(0, -6, 34, 10, '#3f8f3a');
      for (const x of [-16, -4, 8, 20]) line([[x, -10], [x + 2, -60 + Math.abs(x)]], '#6b8e23', 3);
    } else if (art === 'fern') {
      for (const [a, len] of [[-2.2, 70], [-1.6, 90], [-1.0, 72]] as Pt[]) {
        const ex = Math.cos(a) * len;
        const ey = Math.sin(a) * len;
        line([[0, 0], [ex * 0.5, ey * 0.6 - 10], [ex, ey]], '#3f7f2c', 2.5);
        for (let k = 0.2; k < 1; k += 0.12) {
          const px = ex * k;
          const py = ey * k - Math.sin(k * Math.PI) * 10;
          const l = 14 * (1 - k * 0.7);
          line([[px, py], [px - Math.sin(a) * l, py + Math.cos(a) * l]], '#5aa02c', 3);
          line([[px, py], [px + Math.sin(a) * l, py - Math.cos(a) * l]], '#5aa02c', 3);
        }
      }
      ctx.strokeStyle = '#5aa02c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(14, -24, 6, 0, Math.PI * 1.6);
      ctx.stroke();
    } else if (art === 'horsetail') {
      line([[0, 0], [0, -90]], '#6b8e23', 4);
      for (let y = -10; y > -80; y -= 12) {
        line([[0, y], [-18, y + 8]], '#7cb342', 1.5);
        line([[0, y], [18, y + 8]], '#7cb342', 1.5);
        line([[-5, y], [5, y]], '#2f4f1f', 2);
      }
      ell(0, -96, 4, 9, '#8a6a3a');
    } else if (art === 'clubmoss') {
      for (const x of [-12, 0, 12]) {
        line([[x, 0], [x, -60 - Math.abs(x)]], '#4c8c2c', 6);
        for (let y = -4; y > -60; y -= 5) {
          line([[x, y], [x - 5, y - 3]], '#6ab04c', 1.5);
          line([[x, y], [x + 5, y - 3]], '#6ab04c', 1.5);
        }
        ell(x, -68 - Math.abs(x), 3.5, 8, '#c9b03a');
      }
    } else if (art === 'pine') {
      line([[0, 0], [0, -30]], '#6d4c33', 7);
      ctx.fillStyle = '#2e6b3a';
      for (let k = 0; k < 4; k++) {
        const y = -24 - k * 18;
        const w = 36 - k * 7;
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(0, y - 30);
        ctx.lineTo(w, y);
        ctx.closePath();
        ctx.fill();
      }
      ell(22, -40, 5, 9, '#8a5a2b');
    } else if (art === 'ginkgo') {
      line([[0, 0], [0, -60]], '#6d4c33', 6);
      for (const [x, y] of [[-24, -62], [-8, -82], [12, -78], [28, -58], [0, -96]] as Pt[]) {
        ctx.fillStyle = '#7cb342';
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.arc(x, y + 8, 14, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.closePath();
        ctx.fill();
      }
      dot(-10, -50, 5, '#e0b84a');
    } else if (art === 'cycad') {
      ctx.fillStyle = '#7a5a3c';
      ctx.fillRect(-9, -40, 18, 40);
      for (const a of [-2.8, -2.3, -1.8, -1.3, -0.8, -0.35]) {
        const ex = Math.cos(a) * 56;
        const ey = -40 + Math.sin(a) * 40;
        line([[0, -40], [ex, ey]], '#2e7d32', 3);
        for (let k = 0.2; k < 1; k += 0.15) line([[ex * k, -40 + (ey + 40) * k], [ex * k, -40 + (ey + 40) * k - 8]], '#43a047', 2);
      }
      ell(0, -46, 8, 12, '#c9a24a');
    } else if (art === 'oak') {
      line([[0, 0], [0, -40]], '#6d4c33', 9);
      for (const [x, y, r] of [[-20, -60, 22], [18, -62, 24], [0, -80, 24]] as [number, number, number][]) dot(x, y, r, '#3a7d2c');
      ell(30, -20, 5, 7, '#a0703c');
    } else if (art === 'grass') {
      for (let k = -4; k <= 4; k++) line([[k * 3, 0], [k * 9, -50 - Math.abs(k) * 3]], '#6ab04c', 2.5);
      for (const x of [-10, 8]) {
        line([[x, 0], [x + 2, -86]], '#9ab04c', 2);
        for (let y = -86; y < -60; y += 5) ell(x + 2 + (y % 2 ? 3 : -3), y, 2.5, 4, '#d4b84a');
      }
    } else {
      // rose
      line([[0, 0], [2, -70]], '#3f7f2c', 3);
      for (const [y, sg] of [[-25, -1], [-45, 1]] as Pt[]) ell(sg * 12, y, 10, 5, '#4c9a2a', sg * 0.5);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ell(2 + Math.cos(a) * 9, -78 + Math.sin(a) * 9, 9, 7, '#e64980', a);
      }
      dot(2, -78, 6, '#c2255c');
    }
  }
  function drawSpecimen(art: Art, x: number, y: number, s: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    specimen(art);
    ctx.restore();
  }

  /* ======================= Groups view ======================= */
  const groupLayout = () =>
    portrait()
      ? { trunkX: 30, bx: 60, bw: 610, bh: 112, by: (i: number) => 20 + i * 140, tray: { x: 10, y: 590, w: 660, h: 400, cols: 3 } }
      : { trunkX: 40, bx: 70, bw: 470, bh: 112, by: (i: number) => 14 + i * 136, tray: { x: 556, y: 52, w: 434, h: 538, cols: 2 } };
  let cards: { art: Art; x: number; y: number; w: number; h: number }[] = [];
  let dragCard: { art: Art; x: number; y: number } | null = null;
  function drawGroups() {
    const L = groupLayout();
    const n = GROUP_ORDER.length;
    const branchY = (i: number) => L.by(i) + L.bh / 2;
    // trunk
    line([[L.trunkX, L.by(n - 1) + L.bh + 14], [L.trunkX, branchY(0)]], pal['border-strong'], 4);
    GROUP_ORDER.forEach((g, i) => {
      const G = GROUPS[g];
      const y = L.by(i);
      line([[L.trunkX, branchY(i)], [L.bx, branchY(i)]], pal['border-strong'], 4);
      const over = dragCard && hitBox(dragCard.x, dragCard.y) === g;
      panel(L.bx, y, L.bw, L.bh, over ? withAlpha(pal.accent, 0.15) : pal['bg-elev']);
      drawSpecimen(G.art, L.bx + 44, y + L.bh - 12, 0.85);
      text(G.name, L.bx + 92, y + 24, 14, pal['sim-text'], 'left', 800);
      text(G.short, L.bx + 92, y + 24 + 17 / cur, 11.5, pal['text-muted'], 'left', 650);
      text(`~${G.mya} Mya · ${G.species}`, L.bx + 92, y + 24 + 33 / cur, 11, pal['text-faint'], 'left', 600);
      // placed specimens
      placed[g].forEach((art, k) => {
        const cx = L.bx + L.bw - 50 - k * 62;
        ctx.fillStyle = withAlpha(pal.success, 0.12);
        ctx.beginPath();
        ctx.roundRect(cx - 28, y + L.bh - 54, 56, 48, 8);
        ctx.fill();
        drawSpecimen(art, cx, y + L.bh - 16, 0.3);
        text(SPECIMENS.find((s) => s.id === art)!.name, cx, y + L.bh - 9, 9.5, pal.success, 'center', 700);
      });
      rect(L.bx, y, L.bw, L.bh, G.name, () => `${G.text} Key features: ${G.traits.join('; ')}.`);
    });
    // innovations on the trunk
    INNOVATIONS.forEach((inn) => {
      const iTo = GROUP_ORDER.indexOf(inn.between[1]);
      const y = inn.between[0] === null ? L.by(n - 1) + L.bh + 14 : (branchY(iTo) + branchY(GROUP_ORDER.indexOf(inn.between[0]))) / 2;
      ctx.fillStyle = pal.warning;
      ctx.beginPath();
      ctx.moveTo(L.trunkX, y - 8);
      ctx.lineTo(L.trunkX + 8, y);
      ctx.lineTo(L.trunkX, y + 8);
      ctx.lineTo(L.trunkX - 8, y);
      ctx.closePath();
      ctx.fill();
      text(`+ ${inn.name}`, L.trunkX + 14, y + 4, 11.5, pal.warning, 'left', 750);
      rect(L.trunkX - 12, y - 12, 180, 24, inn.name, () => inn.text);
    });
    text('↑ newer', L.trunkX - 30, L.by(0) - 2, 10, pal['text-faint'], 'left', 600);
    // tray of specimens
    const T = L.tray;
    panel(T.x, T.y, T.w, T.h);
    const left = order.filter((a) => !Object.values(placed).some((p) => p.includes(a)));
    text(left.length ? `Drag each specimen to its group (${left.length} left)` : 'All sorted!', T.x + 12, T.y + 22, 12.5, left.length ? pal['sim-text'] : pal.success, 'left', 750);
    cards = [];
    const cw = (T.w - 20 - (T.cols - 1) * 10) / T.cols;
    const rows = Math.ceil(order.length / T.cols);
    const ch = Math.min(86, (T.h - 40 - (rows - 1) * 8) / rows);
    order.forEach((art, i) => {
      if (!left.includes(art)) return;
      if (dragCard?.art === art) return;
      const c = i % T.cols;
      const r = Math.floor(i / T.cols);
      const x = T.x + 10 + c * (cw + 10);
      const y = T.y + 34 + r * (ch + 8);
      const bad = wrong && wrong.art === art && t - wrong.t < 0.8;
      panel(x, y, cw, ch, bad ? withAlpha(pal.danger, 0.2) : pal['sim-bg']);
      drawSpecimen(art, x + 40, y + ch - 8, (ch - 14) / 100);
      text(SPECIMENS.find((s) => s.id === art)!.name, x + 78, y + ch / 2 + 5, 13, pal['sim-text'], 'left', 750);
      cards.push({ art, x, y, w: cw, h: ch });
    });
    if (dragCard) {
      ctx.globalAlpha = 0.9;
      drawSpecimen(dragCard.art, dragCard.x, dragCard.y + 30, 0.6);
      ctx.globalAlpha = 1;
    }
  }
  function hitBox(x: number, y: number): GroupId | null {
    const L = groupLayout();
    for (let i = 0; i < GROUP_ORDER.length; i++) {
      const by = L.by(i);
      if (x >= L.bx && x <= L.bx + L.bw && y >= by && y <= by + L.bh) return GROUP_ORDER[i];
    }
    return null;
  }

  /* ======================= Life-cycle view ======================= */
  function stageArt(art: string, cx: number, cy: number, s: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    const ground = () => {
      ctx.fillStyle = withAlpha('#7a5a3c', 0.35);
      ctx.fillRect(-150, 60, 300, 40);
    };
    const sperm = (x: number, y: number, a = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ell(0, 0, 5, 3, N_COL);
      line([[-4, 0], [-14, -5], [-22, -1]], N_COL, 1.2);
      line([[-4, 1], [-14, 6], [-22, 3]], N_COL, 1.2);
      ctx.restore();
    };
    const pollen = (x: number, y: number, pine = false) => {
      if (pine) {
        ell(x - 6, y, 5, 4, withAlpha('#f5d76e', 0.7));
        ell(x + 6, y, 5, 4, withAlpha('#f5d76e', 0.7));
      }
      dot(x, y, 5, '#e0b84a');
    };
    const water = () => {
      ctx.fillStyle = withAlpha('#4dabf7', 0.45);
      ctx.fillRect(-150, 52, 300, 10);
    };
    const bigSpecimen = (a: Art, sc = 1.3) => {
      ctx.save();
      ctx.translate(0, 60);
      ctx.scale(sc, sc);
      specimen(a);
      ctx.restore();
    };
    switch (art) {
      case 'moss-gam':
        ground();
        bigSpecimen('moss', 1.6);
        break;
      case 'moss-gametes':
      case 'fern-gametes': {
        ground();
        water();
        if (art === 'fern-gametes') {
          ctx.fillStyle = '#5aa02c';
          ctx.beginPath();
          ctx.moveTo(0, 50);
          ctx.bezierCurveTo(-120, -40, -40, -90, 0, -30);
          ctx.bezierCurveTo(40, -90, 120, -40, 0, 50);
          ctx.fill();
        }
        // antheridium (left) and archegonium (right)
        ell(-70, 20, 14, 22, '#8fbf5a');
        ctx.fillStyle = '#8fbf5a';
        ctx.beginPath();
        ctx.moveTo(60, 50);
        ctx.quadraticCurveTo(45, 10, 70, -20);
        ctx.lineTo(80, -20);
        ctx.quadraticCurveTo(105, 10, 90, 50);
        ctx.closePath();
        ctx.fill();
        dot(75, 30, 9, N_COL);
        text('egg (n)', 75, 74, 11, N_COL, 'center', 700);
        text('sperm (n)', -70, 74, 11, N_COL, 'center', 700);
        for (let k = 0; k < 5; k++) {
          const p = ((stageT * 0.4 + k * 0.2) % 1) * 130;
          sperm(-60 + p, 54 - Math.sin(p / 12) * 2, 0);
        }
        break;
      }
      case 'zygote':
        dot(0, 0, 34, D_COL);
        dot(0, 0, 12, withAlpha('#ffffff', 0.6));
        text('zygote (2n)', 0, 62, 13, D_COL, 'center', 800);
        break;
      case 'moss-spo':
        ground();
        bigSpecimen('moss', 1.6);
        ctx.strokeStyle = D_COL;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-36, -140, 60, 90);
        ctx.setLineDash([]);
        text('sporophyte (2n)', 60, -110, 12, D_COL, 'left', 750);
        text('gametophyte (n)', 50, 30, 12, N_COL, 'left', 750);
        break;
      case 'spores':
        ell(0, -20, 26, 44, '#a0522d');
        for (let k = 0; k < 26; k++) {
          const a = k * 2.4;
          const r = 40 + ((k * 37) % 70) + stageT * 20;
          dot(Math.cos(a) * r * 1.3, -20 + Math.sin(a) * r * 0.7, 3, N_COL);
        }
        text('spores (n), made by meiosis', 0, 90, 12, N_COL, 'center', 750);
        break;
      case 'protonema':
        ground();
        line([[-100, 55], [-40, 50], [10, 56], [70, 50], [110, 55]], '#6ab04c', 3);
        for (const x of [-60, 20, 80]) line([[x, 52], [x + 6, 30]], '#6ab04c', 2);
        ell(20, 26, 8, 12, '#4c8c2c');
        text('thread-like protonema with a bud', 0, 92, 12, N_COL, 'center', 700);
        break;
      case 'fern-spo':
        ground();
        bigSpecimen('fern', 1.6);
        break;
      case 'sori': {
        ctx.fillStyle = '#5aa02c';
        ctx.beginPath();
        ctx.ellipse(0, 0, 120, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let k = -4; k <= 4; k++) {
          dot(k * 24, -14, 7, '#8a5a2b');
          dot(k * 24, 14, 7, '#8a5a2b');
        }
        for (let k = 0; k < 14; k++) dot(-40 + ((k * 23 + stageT * 30) % 200) - 60, -60 - ((k * 17 + stageT * 25) % 60), 3, N_COL);
        text('underside of a frond: sori release spores (n)', 0, 80, 12, N_COL, 'center', 750);
        break;
      }
      case 'prothallus':
        ground();
        ctx.fillStyle = '#5aa02c';
        ctx.beginPath();
        ctx.moveTo(0, 50);
        ctx.bezierCurveTo(-120, -40, -40, -90, 0, -30);
        ctx.bezierCurveTo(40, -90, 120, -40, 0, 50);
        ctx.fill();
        for (const x of [-20, 0, 20]) line([[x, 50], [x + 4, 70]], '#c9b08a', 1.5);
        text('prothallus (n), about 1 cm', 0, 92, 12, N_COL, 'center', 750);
        break;
      case 'young-fern':
        ground();
        ctx.fillStyle = withAlpha('#5aa02c', 0.6);
        ctx.beginPath();
        ctx.moveTo(0, 60);
        ctx.bezierCurveTo(-80, 0, -30, -30, 0, 10);
        ctx.bezierCurveTo(30, -30, 80, 0, 0, 60);
        ctx.fill();
        ctx.save();
        ctx.translate(0, 30);
        ctx.scale(0.7, 0.7);
        specimen('fern');
        ctx.restore();
        text('young sporophyte (2n) on the old prothallus (n)', 0, 92, 12, D_COL, 'center', 750);
        break;
      case 'pine-spo':
        ground();
        bigSpecimen('pine', 1.7);
        break;
      case 'cones':
        // male cone with pollen, female cone with ovules
        ell(-70, 0, 18, 30, '#c9a24a');
        for (let k = 0; k < 8; k++) pollen(-70 + Math.cos(k + stageT) * 40, -30 + Math.sin(k * 2 + stageT) * 30, true);
        text('male cone: pollen', -70, 70, 12, N_COL, 'center', 750);
        ctx.fillStyle = '#8a5a2b';
        for (let r = 0; r < 5; r++) for (const sg of [-1, 1]) ell(70 + sg * 14, -40 + r * 18, 16, 8, '#8a5a2b', sg * 0.4);
        dot(84, -22, 5, N_COL);
        dot(56, 14, 5, N_COL);
        text('female cone: ovules', 70, 70, 12, N_COL, 'center', 750);
        break;
      case 'pine-pollination':
        for (let r = 0; r < 5; r++) for (const sg of [-1, 1]) ell(60 + sg * 14, -40 + r * 18, 16, 8, '#8a5a2b', sg * 0.4);
        for (let k = 0; k < 10; k++) {
          const x = -120 + ((k * 31 + stageT * 60) % 180);
          pollen(x, -50 + ((k * 17) % 60), true);
        }
        arrow(ctx, -130, -90, -40, -90, pal['text-muted'], 2.5, 9);
        text('wind', -85, -100, 12, pal['text-muted'], 'center', 700);
        break;
      case 'pine-fert':
      case 'double-fert':
        ell(0, 0, 70, 50, '#d9c9a0');
        ell(0, 10, 40, 28, art === 'double-fert' ? withAlpha('#be4bdb', 0.35) : withAlpha('#c9b08a', 0.8));
        dot(0, 18, 12, D_COL);
        line([[-90, -90], [-40, -40], [-6, 6]], '#e0b84a', 3);
        pollen(-92, -92, art === 'pine-fert');
        text(art === 'double-fert' ? 'zygote (2n) and endosperm (3n)' : 'pollen tube delivers sperm to the egg', 0, 80, 12, D_COL, 'center', 750);
        break;
      case 'pine-seed':
        ell(0, 10, 22, 14, '#8a5a2b');
        dot(0, 10, 7, D_COL);
        ctx.fillStyle = withAlpha('#c9a24a', 0.8);
        ctx.beginPath();
        ctx.moveTo(18, 4);
        ctx.quadraticCurveTo(110, -40, 120, 10);
        ctx.quadraticCurveTo(80, 30, 18, 16);
        ctx.fill();
        text('seed: embryo (2n), food store, coat, wing', 20, 70, 12, D_COL, 'center', 750);
        break;
      case 'seedling':
        ground();
        line([[0, 60], [0, -10]], '#5aa02c', 4);
        ell(-14, -14, 14, 6, '#6ab04c', -0.4);
        ell(14, -14, 14, 6, '#6ab04c', 0.4);
        for (const x of [-10, 0, 10]) line([[0, 60], [x, 90]], '#c9b08a', 1.5);
        break;
      case 'flower-spo':
        ground();
        bigSpecimen('rose', 1.6);
        break;
      case 'flower-section':
        for (const sg of [-1, 1]) {
          line([[sg * 50, 60], [sg * 50, -40]], '#7cb342', 3);
          ell(sg * 50, -50, 9, 14, '#e0b84a');
        }
        ctx.fillStyle = '#9ccc65';
        ctx.beginPath();
        ctx.moveTo(-26, 60);
        ctx.quadraticCurveTo(-30, 10, 0, 10);
        ctx.quadraticCurveTo(30, 10, 26, 60);
        ctx.closePath();
        ctx.fill();
        line([[0, 10], [0, -60]], '#9ccc65', 6);
        ell(0, -66, 10, 6, '#7cb342');
        for (const x of [-10, 10]) ell(x, 38, 6, 9, '#d4e8b0');
        dot(-10, 38, 3, N_COL);
        dot(10, 38, 3, N_COL);
        text('anthers make pollen (n)', 0, -92, 11.5, N_COL, 'center', 750);
        text('ovules hold embryo sacs (n)', 0, 84, 11.5, N_COL, 'center', 750);
        break;
      case 'pollination':
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ell(Math.cos(a) * 30, Math.sin(a) * 30, 26, 16, '#f783ac', a);
        }
        dot(0, 0, 14, '#ffd43b');
        // bee
        {
          const bx = Math.sin(stageT * 1.5) * 60;
          const by = -70 + Math.cos(stageT * 2) * 10;
          ell(bx, by, 14, 9, '#f2c94c');
          line([[bx - 6, by - 9], [bx - 6, by + 9]], '#222', 3);
          line([[bx + 3, by - 9], [bx + 3, by + 9]], '#222', 3);
          ell(bx - 2, by - 14, 8, 5, withAlpha('#ffffff', 0.7));
          for (let k = 0; k < 3; k++) pollen(bx - 8 + k * 6, by + 12, false);
        }
        break;
      case 'fruit':
        dot(0, 0, 52, '#e03131');
        ell(-18, -18, 12, 8, withAlpha('#ffffff', 0.35));
        line([[0, -50], [4, -70]], '#6d4c33', 4);
        for (const [x, y] of [[-14, 6], [12, 10], [0, -12]] as Pt[]) ell(x, y, 5, 8, '#fff3bf');
        text('ovary → fruit, ovules → seeds (2n embryos)', 0, 80, 12, D_COL, 'center', 750);
        break;
    }
    ctx.restore();
  }
  const cycleLayout = () =>
    portrait()
      ? { ring: { x: 340, y: 205, r: 150 }, panel: { x: 20, y: 405, w: 640, h: 345 }, strip: { x: 20, y: 762, w: 640, h: 228 } }
      : { ring: { x: 746, y: 238, r: 140 }, panel: { x: 20, y: 20, w: 470, h: 420 }, strip: { x: 20, y: 456, w: 960, h: 134 } };
  let nodePos: Pt[] = [];
  function drawCycle() {
    const C = CYCLES[st.cycle];
    const L = cycleLayout();
    const S = C.stages[st.stage];
    // stage panel
    panel(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
    text(`${st.stage + 1}. ${S.name}`, L.panel.x + 14, L.panel.y + 24, 14, pal['sim-text'], 'left', 800);
    const tag = `${S.gen} · ${S.ploidy}`;
    ctx.font = fs(11.5, 800);
    const tw = ctx.measureText(tag).width + 18;
    ctx.fillStyle = S.ploidy === 'n' ? N_COL : D_COL;
    ctx.beginPath();
    ctx.roundRect(L.panel.x + L.panel.w - 12 - tw, L.panel.y + 10, tw, 16 / cur + 6, 11);
    ctx.fill();
    text(tag, L.panel.x + L.panel.w - 12 - tw / 2, L.panel.y + 10 + 13 / cur, 11.5, '#ffffff', 'center', 800);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.panel.x, L.panel.y + 36, L.panel.w, L.panel.h - 40);
    ctx.clip();
    const sc = Math.min(L.panel.w / 330, (L.panel.h - 60) / 260);
    stageArt(S.art, L.panel.x + L.panel.w / 2, L.panel.y + 40 + (L.panel.h - 40) / 2, sc);
    ctx.restore();
    if (S.water) {
      const msg = '💧 Needs water: sperm swim';
      ctx.font = fs(11.5, 800);
      const mw = ctx.measureText(msg).width + 20;
      const mh = 16 / cur + 6;
      ctx.fillStyle = withAlpha('#4dabf7', 0.9);
      ctx.beginPath();
      ctx.roundRect(L.panel.x + 14, L.panel.y + L.panel.h - 10 - mh, mw, mh, 11);
      ctx.fill();
      text(msg, L.panel.x + 14 + mw / 2, L.panel.y + L.panel.h - 10 - mh / 2 + 5 / cur, 11.5, '#ffffff', 'center', 800);
    }
    rect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, S.name, () => S.text);
    // ring
    const R = L.ring;
    const n = C.stages.length;
    nodePos = C.stages.map((_, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [R.x + Math.cos(a) * R.r, R.y + Math.sin(a) * R.r] as Pt;
    });
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / n;
      // the chromosome number halves at meiosis and doubles at fertilisation
      const from = C.stages[i].ploidy;
      const to = C.stages[(i + 1) % n].ploidy;
      const key = from === '2n' && to === 'n' ? 'meiosis' : from === 'n' && to === '2n' ? 'fertilisation' : '';
      ctx.strokeStyle = C.stages[i].ploidy === 'n' ? withAlpha(N_COL, 0.7) : withAlpha(D_COL, 0.7);
      ctx.lineWidth = i === st.stage ? 6 : 4;
      ctx.beginPath();
      ctx.arc(R.x, R.y, R.r, a0 + 0.17, a1 - 0.17);
      ctx.stroke();
      const ae = a1 - 0.17;
      const ex = R.x + Math.cos(ae) * R.r;
      const ey = R.y + Math.sin(ae) * R.r;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ae + Math.PI / 2) * 9, ey + Math.sin(ae + Math.PI / 2) * 9);
      ctx.lineTo(ex + Math.cos(ae) * 6, ey + Math.sin(ae) * 6);
      ctx.lineTo(ex - Math.cos(ae) * 6, ey - Math.sin(ae) * 6);
      ctx.closePath();
      ctx.fill();
      if (key) {
        const am = (a0 + a1) / 2;
        // Side arcs: label outside the ring, clear of the centre text. Top and bottom arcs: inside.
        const ca = Math.cos(am);
        const out = Math.abs(ca) > 0.7;
        const kr = out ? R.r + 14 : R.r - 30;
        text(key, R.x + ca * kr, R.y + Math.sin(am) * kr + 4, 11, key === 'meiosis' ? N_COL : D_COL, out ? (ca > 0 ? 'left' : 'right') : 'center', 800);
      }
    }
    nodePos.forEach(([x, y], i) => {
      const s = C.stages[i];
      const cur2 = i === st.stage;
      dot(x, y, cur2 ? 26 : 20, s.ploidy === 'n' ? N_COL : D_COL);
      if (cur2) {
        ctx.strokeStyle = pal['sim-text'];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
      text(String(i + 1), x, y + 5, 14, '#ffffff', 'center', 800);
      const f = { ...frame };
      areas.push({ test: (px, py) => Math.hypot((px - f.x) / f.s - x, (py - f.y) / f.s - y) < 30, title: `${i + 1}. ${s.name} (${s.ploidy})`, text: () => s.text });
    });
    text(C.name, R.x, R.y - 12, 15, pal['sim-text'], 'center', 800);
    text(`next: ${S.next}`, R.x, R.y + 12, 11.5, pal['text-muted'], 'center', 650);
    // strip: generations
    const P = L.strip;
    panel(P.x, P.y, P.w, P.h);
    text('Alternation of generations', P.x + 14, P.y + 22, 13, pal['sim-text'], 'left', 750);
    const wide = P.w > 700;
    const lh = 16 / cur;
    const rowsY = wide ? [P.y + 52, P.y + 88] : [P.y + 22 + 1.6 * lh, P.y + 22 + 1.6 * lh + 2 * lh + 16];
    (['Gametophyte', 'Sporophyte'] as const).forEach((g, i) => {
      const y = rowsY[i];
      const dom = C.dominant === g;
      const col = g === 'Gametophyte' ? N_COL : D_COL;
      text(`${g} (${g === 'Gametophyte' ? 'n' : '2n'})${dom ? ' · dominant' : ''}`, P.x + 14, y, 12, col, 'left', dom ? 800 : 650);
      const bx = wide ? P.x + 300 : P.x + 14;
      const by = wide ? y - 12 : y + 0.4 * lh;
      const bw = (wide ? 260 : P.w - 28) * (dom ? 1 : 0.18);
      ctx.fillStyle = withAlpha(col, dom ? 0.9 : 0.5);
      ctx.fillRect(bx, by, bw, 14);
      text(C.sizes[i], wide ? bx + 270 : P.x + 14, wide ? y : by + 14 + lh, 11, pal['text-muted'], 'left', 600);
    });
    const ny = P.y + P.h - 14;
    if (wide) text(`Fertilisation ${C.group === 'bryo' || C.group === 'fern' ? 'needs water (swimming sperm)' : 'does not need water (pollen)'} · Dispersal: ${C.disperse}`, P.x + 14, ny, 11.5, pal['text-muted'], 'left', 650);
    rect(P.x, P.y, P.w, P.h, 'Alternation of generations', () => 'All land plants alternate between a haploid gametophyte, which makes gametes by mitosis, and a diploid sporophyte, which makes spores by meiosis. In mosses the gametophyte is the main plant; in ferns and seed plants the sporophyte is, and in seed plants the gametophytes are reduced to a few cells inside pollen grains and ovules.');
  }
  function goStage(i: number) {
    const n = CYCLES[st.cycle].stages.length;
    st.stage = ((i % n) + n) % n;
    stageT = 0;
    autoT = 0;
    updateUi();
    sim.requestRender();
  }

  /* ======================= Water view ======================= */
  const waterLayout = (i: number) =>
    portrait() ? { x: 20 + (i % 2) * 325, y: 56 + Math.floor(i / 2) * 385, w: 315, h: 375 } : { x: 14 + i * 245, y: 52, w: 235, h: 414 };
  function drawWaterPanel(id: CycleId, i: number) {
    const L = waterLayout(i);
    const ok = canFertilise(id);
    panel(L.x, L.y, L.w, L.h);
    const s = Math.min(L.w / 230, L.h / 440);
    enter(L.x + (L.w - 230 * s) / 2, L.y, s);
    const name = { moss: 'Moss', fern: 'Fern (prothallus)', pine: 'Pine', flower: 'Insect-pollinated flower' }[id];
    text(name, 115, 26, 13, pal['sim-text'], 'center', 800);
    // ground and water film
    ctx.fillStyle = withAlpha('#7a5a3c', 0.4);
    ctx.fillRect(0, 360, 230, 80);
    if (st.water > 2) {
      const film = 2 + st.water * 0.12;
      ctx.fillStyle = withAlpha('#4dabf7', st.water >= SWIM ? 0.6 : 0.3);
      if (st.water >= SWIM) ctx.fillRect(0, 360 - film, 230, film);
      else for (let k = 0; k < 6; k++) ell(20 + k * 38, 358, 8 + st.water * 0.3, 3, withAlpha('#4dabf7', 0.5));
    }
    if (id === 'moss' || id === 'fern') {
      if (id === 'moss') {
        ctx.save();
        ctx.translate(50, 360);
        ctx.scale(0.8, 0.8);
        specimen('moss');
        ctx.restore();
        ctx.save();
        ctx.translate(180, 360);
        ctx.scale(0.8, 0.8);
        specimen('moss');
        ctx.restore();
        text('male', 50, 400, 11, N_COL, 'center', 700);
        text('female', 180, 400, 11, N_COL, 'center', 700);
      } else {
        ctx.fillStyle = '#5aa02c';
        ctx.beginPath();
        ctx.moveTo(115, 362);
        ctx.bezierCurveTo(-10, 290, 70, 250, 115, 310);
        ctx.bezierCurveTo(160, 250, 240, 290, 115, 362);
        ctx.fill();
        text('male', 50, 400, 11, N_COL, 'center', 700);
        text('female', 180, 400, 11, N_COL, 'center', 700);
      }
      dot(182, 350, 6, N_COL);
      for (const p of parts[id]) {
        const a = p.done ? 1 - p.age : st.water >= SWIM ? 1 : Math.max(0, 1 - p.age / 2);
        ctx.globalAlpha = clamp(a, 0, 1);
        ell(p.x, p.y, 4, 2.5, N_COL);
        line([[p.x - 3, p.y], [p.x - 10, p.y - 3]], N_COL, 1);
        ctx.globalAlpha = 1;
      }
    } else if (id === 'pine') {
      ctx.save();
      ctx.translate(50, 360);
      ctx.scale(1.4, 1.4);
      specimen('pine');
      ctx.restore();
      for (let r = 0; r < 4; r++) for (const sg of [-1, 1]) ell(180 + sg * 9, 160 + r * 14, 11, 6, '#8a5a2b', sg * 0.4);
      text('female cone', 180, 240, 10.5, N_COL, 'center', 700);
      for (const p of parts.pine) {
        ctx.globalAlpha = p.done ? clamp(1 - p.age, 0, 1) : 1;
        ell(p.x - 4, p.y, 3, 2.5, withAlpha('#f5d76e', 0.7));
        ell(p.x + 4, p.y, 3, 2.5, withAlpha('#f5d76e', 0.7));
        dot(p.x, p.y, 3, '#e0b84a');
        ctx.globalAlpha = 1;
      }
      if (st.wind > 5) arrow(ctx, 20, 70, 20 + st.wind * 1.4, 70, pal['text-muted'], 2.5, 9);
    } else {
      for (const x of [50, 180]) {
        line([[x, 360], [x, 240]], '#5aa02c', 3);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ell(x + Math.cos(a) * 14, 230 + Math.sin(a) * 14, 12, 7, '#f783ac', a);
        }
        dot(x, 230, 7, '#ffd43b');
      }
      if (st.insects) {
        ell(bee.x, bee.y, 10, 6, '#f2c94c');
        line([[bee.x - 3, bee.y - 6], [bee.x - 3, bee.y + 6]], '#222', 2);
        ell(bee.x - 1, bee.y - 9, 6, 4, withAlpha('#ffffff', 0.7));
        dot(bee.x + 2, bee.y + 8, 2.5, '#e0b84a');
      }
      for (const p of parts.flower) dot(p.x, p.y, 3, '#e0b84a');
    }
    // result banner
    ctx.font = fs(12, 800);
    let label = ok ? '✓ Fertilisation possible' : '✗ No fertilisation';
    if (ctx.measureText(label).width > 196) label = ok ? '✓ Fertilises' : '✗ Fails';
    ctx.fillStyle = ok ? withAlpha(pal.success, 0.9) : withAlpha(pal.danger, 0.9);
    ctx.beginPath();
    ctx.roundRect(10, 44, 210, 16 / cur + 8, 13);
    ctx.fill();
    text(label, 115, 44 + 8 / cur + 9, 12, '#ffffff', 'center', 800);
    const why =
      id === 'moss' || id === 'fern'
        ? ok
          ? 'Sperm swim through the water film'
          : 'Sperm cannot swim: no water film'
        : id === 'pine'
          ? ok
            ? 'Wind carries the pollen'
            : 'Too little wind to carry the pollen'
          : ok
            ? 'Insects carry the pollen'
            : 'No insects; the sticky pollen just falls';
    wrap(why, 12, 44 + 16 / cur + 8 + 15 / cur, 206, 11, pal['text-muted'], 650);
    leave();
    rect(L.x, L.y, L.w, L.h, name, () =>
      id === 'moss' || id === 'fern'
        ? `Bryophyte and fern sperm have flagella and must swim to the egg through a continuous film of water (here, water ≥ ${SWIM}). This is why mosses and ferns are most common in damp places, and why the gametophyte must stay small and close to the ground.`
        : id === 'pine'
          ? 'Conifer pollen grains have air sacs and are carried by the wind, so fertilisation does not need water. Wind pollination wastes a lot of pollen, which is why conifers make so much.'
          : 'This flower is pollinated by insects: its pollen is sticky and heavy, so it does not travel on the wind. Insects visit for nectar and carry pollen between flowers. (Grasses and many trees use the wind instead.)',
    );
  }
  function drawWater() {
    (['moss', 'fern', 'pine', 'flower'] as CycleId[]).forEach((id, i) => drawWaterPanel(id, i));
    const P = portrait() ? { x: 20, y: 812, w: 640, h: 182 } : { x: 14, y: 476, w: 970, h: 112 };
    panel(P.x, P.y, P.w, P.h);
    const ty = wrap('Moving onto land: getting sperm to the egg without water', P.x + 14, P.y + 24, P.w - 28, 13, pal['sim-text'], 750);
    wrap(`Water on the ground: ${Math.round(st.water)} (sperm need ≥ ${SWIM}). Wind: ${st.wind}. Insects: ${st.insects ? 'present' : 'absent'}. Pollen let seed plants reproduce in dry places.`, P.x + 14, ty + 4, P.w - 28, 11.5, pal['text-muted'], 600);
  }

  /* ---------- Render ---------- */
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
    areas = [];
    if (st.view === 'groups') drawGroups();
    else if (st.view === 'cycle') drawCycle();
    else drawWater();
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts ---------- */
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = '';
    if (st.view === 'groups') {
      const n = Object.values(placed).reduce((a, b) => a + b.length, 0);
      r('r1', 'Sorted correctly', `${n} of ${SPECIMENS.length}`, n === SPECIMENS.length ? 'ok' : null);
      r('r2', 'Attempts', String(attempts));
      r('r3', 'Oldest group', 'Bryophytes (~470 million years)');
      r('r4', 'Largest group', 'Flowering plants (~300,000 species)');
      r('r5', 'Spore plants', 'Bryophytes, ferns and allies');
      r('r6', 'Seed plants', 'Gymnosperms, angiosperms');
      note = lastMsg || 'Four main groups of land plants evolved one after another. Drag each specimen onto its group, and tap a group or a yellow innovation on the tree to learn more.';
      sim.setBadge(`${n} of ${SPECIMENS.length} sorted`);
      canvas.setAttribute('aria-label', `Plant evolution tree with four groups. ${n} of ${SPECIMENS.length} specimens sorted.`);
    } else if (st.view === 'cycle') {
      const C = CYCLES[st.cycle];
      const S = C.stages[st.stage];
      r('r1', 'Stage', `${st.stage + 1} of ${C.stages.length}: ${S.name}`);
      r('r2', 'Chromosomes', S.ploidy === 'n' ? 'Haploid (n)' : 'Diploid (2n)');
      r('r3', 'Generation', S.gen);
      r('r4', 'Dominant generation', C.dominant);
      r('r5', 'Fertilisation needs water?', C.group === 'bryo' || C.group === 'fern' ? 'Yes: sperm swim' : 'No: pollen', C.group === 'bryo' || C.group === 'fern' ? 'warn' : 'ok');
      r('r6', 'Dispersal', C.disperse);
      note = `${S.name}: ${S.text}`;
      sim.setBadge(`Stage ${st.stage + 1}/${C.stages.length}`);
      canvas.setAttribute('aria-label', `${C.name} life cycle, stage ${st.stage + 1}: ${S.name}, ${S.gen}, ${S.ploidy}.`);
    } else {
      const lab = (id: CycleId) => (canFertilise(id) ? 'Fertilisation possible' : 'No fertilisation');
      r('r1', 'Moss', lab('moss'), canFertilise('moss') ? 'ok' : 'bad');
      r('r2', 'Fern', lab('fern'), canFertilise('fern') ? 'ok' : 'bad');
      r('r3', 'Pine', lab('pine'), canFertilise('pine') ? 'ok' : 'bad');
      r('r4', 'Insect-pollinated flower', lab('flower'), canFertilise('flower') ? 'ok' : 'bad');
      r('r5', 'Water film', st.water >= SWIM ? `${Math.round(st.water)} (continuous)` : `${Math.round(st.water)} (too little)`);
      r('r6', 'Wind', String(st.wind));
      note =
        st.water < SWIM
          ? 'The ground is too dry for a continuous water film, so moss and fern sperm cannot swim to the eggs. The seed plants are unaffected: pollen travels through the air.'
          : 'With a film of water on the ground, moss and fern sperm can swim a few centimetres to the eggs. Now dry the ground out, or let the sun do it.';
      sim.setBadge(`Water ${Math.round(st.water)} · wind ${st.wind}`);
      canvas.setAttribute('aria-label', `Water experiment: moss ${lab('moss')}, fern ${lab('fern')}, pine ${lab('pine')}, flower ${lab('flower')}.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const showFor = () => {
    ui.showWhen('[data-only="groups"]', st.view === 'groups');
    ui.showWhen('[data-only="cycle"]', st.view === 'cycle');
    ui.showWhen('[data-only="water"]', st.view === 'water');
  };
  const viewCtl = ui.choice<View>('pd-view', (v) => {
    st.view = v;
    showFor();
    sim.hideTooltip();
    if (v === 'cycle') sim.pause();
    else sim.play();
    sim.requestRender();
  });
  const cycleCtl = ui.choice<CycleId>('pd-cycle', (v) => {
    st.cycle = v;
    goStage(0);
  });
  root.querySelector('[data-prev]')?.addEventListener('click', () => goStage(st.stage - 1));
  root.querySelector('[data-next]')?.addEventListener('click', () => goStage(st.stage + 1));
  root.querySelector('[data-shuffle]')?.addEventListener('click', () => {
    shuffle();
    sim.requestRender();
  });
  root.querySelector('[data-solve]')?.addEventListener('click', () => {
    for (const s of SPECIMENS) if (!placed[s.group].includes(s.id)) placed[s.group].push(s.id);
    lastMsg = 'Here is the answer. Notice the clubmoss among the ferns and allies, and the oak and grass among the flowering plants.';
    sim.requestRender();
  });
  const waterCtl = ui.range('pd-water', (v) => `${v}`, (v) => ((st.water = v), sim.requestRender()));
  const windCtl = ui.range('pd-wind', (v) => `${v}`, (v) => ((st.wind = v), sim.requestRender()));
  const insectCtl = ui.toggle('pd-insects', (v) => ((st.insects = v), sim.requestRender()));
  const sunCtl = ui.toggle('pd-sun', (v) => ((st.sun = v), v && !sim.running && sim.play()));
  root.querySelector('[data-rain]')?.addEventListener('click', () => {
    waterCtl.set(85);
    if (!sim.running) sim.play();
  });

  /* ---------- Dragging ---------- */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  enableDrag<'card'>(canvas, {
    hit(x, y) {
      if (st.view !== 'groups') return null;
      const [bx, by] = toBox(x, y);
      return cards.some((c) => bx >= c.x && bx <= c.x + c.w && by >= c.y && by <= c.y + c.h) ? 'card' : null;
    },
    start(_id, x, y) {
      sim.hideTooltip();
      const [bx, by] = toBox(x, y);
      const c = cards.find((q) => bx >= q.x && bx <= q.x + q.w && by >= q.y && by <= q.y + q.h)!;
      dragCard = { art: c.art, x: bx, y: by };
    },
    move(_id, x, y) {
      const [bx, by] = toBox(x, y);
      if (dragCard) {
        dragCard.x = bx;
        dragCard.y = by;
      }
      sim.requestRender();
    },
    end() {
      if (!dragCard) return;
      const g = hitBox(dragCard.x, dragCard.y);
      const spec = SPECIMENS.find((s) => s.id === dragCard!.art)!;
      if (g) {
        attempts++;
        if (g === spec.group) {
          placed[g].push(spec.id);
          lastMsg = `Correct! ${spec.hint}`;
          sim.announce(`Correct: ${spec.name} is in ${GROUPS[g].name}.`);
        } else {
          wrong = { art: spec.id, t };
          lastMsg = `Not quite: the ${spec.name.toLowerCase()} is not one of the ${GROUPS[g].name.toLowerCase()}. Clue: ${spec.hint.split(':')[0]}.`;
          sim.announce(`Not quite. Try again.`);
        }
      }
      dragCard = null;
      sim.requestRender();
    },
    click(x, y) {
      const [bx, by] = toBox(x, y);
      for (let i = areas.length - 1; i >= 0; i--)
        if (areas[i].test(bx, by)) {
          sim.showTooltip(x, y, areas[i].title, areas[i].text());
          return;
        }
      if (st.view === 'cycle') {
        const hit = nodePos.findIndex(([nx, ny]) => Math.hypot(bx - nx, by - ny) < 30);
        if (hit >= 0) goStage(hit);
      }
      sim.hideTooltip();
    },
  });
  // a tap on a cycle node also jumps to that stage
  canvas.addEventListener('click', (e) => {
    if (st.view !== 'cycle') return;
    const r = canvas.getBoundingClientRect();
    const [bx, by] = toBox(e.clientX - r.left, e.clientY - r.top);
    const hit = nodePos.findIndex(([nx, ny]) => Math.hypot(bx - nx, by - ny) < 30);
    if (hit >= 0 && hit !== st.stage) goStage(hit);
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: true,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set(DEF.view, false);
      cycleCtl.set(DEF.cycle, false);
      waterCtl.set(DEF.water, false);
      windCtl.set(DEF.wind, false);
      insectCtl.set(DEF.insects, false);
      sunCtl.set(DEF.sun, false);
      shuffle();
      showFor();
      for (const k of Object.keys(parts) as CycleId[]) parts[k] = [];
    },
  });
  shuffle();
  showFor();
  updateUi();
}
