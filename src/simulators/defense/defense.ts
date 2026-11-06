/**
 * Plant defense lab, in three views:
 *   3d       – a plant to rotate and inspect; choosing a structure zooms the camera to it
 *   pathogen – a leaf cross-section. Bacteria enter only through open stomata or
 *              wounds; fungi push through the cuticle. PAMPs → PRRs → PTI (stomata
 *              close, callose, antimicrobials). Effectors suppress PTI unless a
 *              matching R protein triggers ETI and the hypersensitive response.
 *              Salicylic acid spreads systemic acquired resistance (SAR).
 *   insect   – drag caterpillars or aphids onto a plant. Chewing triggers
 *              jasmonate (JA) signalling, toxins build up in the damaged leaf and
 *              then in distant leaves, and volatiles attract parasitic wasps.
 */
import type * as T from 'three';
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { enableDrag } from '../shared/drag';
import { createThreeScene, type ThreeScene } from '../shared/three';
import { PARTS, PART_ORDER, PATHOGENS, STEPS, type PartId, type PathogenId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = '3d' | 'pathogen' | 'insect';
type Herb = 'caterpillar' | 'aphid';
type Pt = [number, number];
const LEAF = '#51cf66';
const STEM = '#5c940d';
const JA_COL = '#f08c00';
const TOX_COL = '#9775fa';
const SA_COL = '#e64980';
const CALLOSE = '#74c0fc';

const sat = (x: number, k: number) => x / (x + k);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
function mix(c1: string, c2: string, u: number) {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1);
  const b = p(c2);
  return `#${a.map((v, i) => Math.round(lerp(v, b[i], clamp(u, 0, 1))).toString(16).padStart(2, '0')).join('')}`;
}

/* Leaf cross-section geometry (local 620 × 560) */
const CUT_Y = 112; // top of the cuticle
const EPI_Y = 122;
const EPI_B = 178;
const STOMA_X = 279;
const WOUND_X = 465;

export function initDefense(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const pick = root.querySelector<HTMLSelectElement>('[data-pick]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));

  const st = {
    view: '3d' as View,
    threat: 4,
    defense: 1,
    pathogen: 'bacteria' as PathogenId,
    effectors: true,
    rgene: false,
    wound: false,
    herb: 'caterpillar' as Herb,
    ja: true,
    trich: true,
    signals: true,
    labels: false,
  };
  let t = 0;
  let lastMsg = '';

  /* ======================= Pathogen model ======================= */
  type Bug = { x: number; y: number; inside: boolean; dead: number; age: number };
  type Spore = { x: number; dir: 1 | -1; age: number; stage: 'germ' | 'try' | 'blocked' | 'in' | 'dead'; path: Pt[]; grow: number; target: number };
  interface MCell {
    x: number;
    y: number;
    w: number;
    h: number;
    round: boolean;
    inf: number;
    dead: boolean;
  }
  const cells: MCell[] = [];
  for (let i = 0; i < 15; i++) cells.push({ x: 6 + i * 41, y: 186, w: 36, h: 94, round: false, inf: 0, dead: false });
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 10; c++) {
      const x = 34 + c * 62 + (r % 2) * 28;
      const y = 316 + r * 56;
      if (x > 600 || (Math.abs(x - 310) < 70 && y > 430)) continue;
      cells.push({ x, y, w: 25, h: 23, round: true, inf: 0, dead: false });
    }
  const cellCenter = (c: MCell): Pt => (c.round ? [c.x, c.y] : [c.x + c.w / 2, c.y + c.h / 2]);
  const pz = { bugs: [] as Bug[], spores: [] as Spore[], epiDead: [] as number[], pti: 0, eti: 0, etiT: 0, sa: 0, spread: 0, primed: 0, ap: 1, hr: 0, entered: 0, callose: [] as number[] };
  function clearLeaf(keepSar: boolean) {
    pz.bugs = [];
    pz.spores = [];
    pz.pti = 0;
    pz.eti = 0;
    pz.etiT = 0;
    pz.ap = 1;
    pz.hr = 0;
    pz.entered = 0;
    pz.callose = [];
    pz.epiDead = [];
    for (const c of cells) {
      c.inf = 0;
      c.dead = false;
    }
    if (keepSar) pz.primed = pz.spread;
    else {
      pz.sa = 0;
      pz.spread = 0;
      pz.primed = 0;
    }
  }
  function inoculate(x?: number) {
    const n = st.pathogen === 'bacteria' ? 4 * st.threat : st.threat;
    for (let i = 0; i < n; i++) {
      const px = x === undefined ? 20 + Math.random() * 580 : clamp(x + (Math.random() - 0.5) * 70, 10, 610);
      if (st.pathogen === 'bacteria') pz.bugs.push({ x: px, y: CUT_Y - 6, inside: false, dead: 0, age: 0 });
      else pz.spores.push({ x: px, dir: Math.random() < 0.5 ? -1 : 1, age: 0, stage: 'germ', path: [], grow: 0, target: 0 });
    }
  }
  const effActive = () => st.effectors && (pz.bugs.some((b) => b.inside && !b.dead) || pz.spores.some((s) => s.stage === 'in'));
  // effectors cut PTI to a quarter; a leaf primed by SAR partly resists this suppression
  const ptiEff = () => Math.max(effActive() ? pz.pti * (0.25 + 0.4 * pz.primed) : pz.pti, pz.eti);

  function stepPathogen(dt: number) {
    const live = pz.bugs.filter((b) => !b.dead);
    const outside = live.filter((b) => !b.inside).length;
    const inside = live.length - outside;
    const germ = pz.spores.filter((s) => s.stage === 'germ' || s.stage === 'try').length;
    const sporesIn = pz.spores.filter((s) => s.stage === 'in').length;
    // PRRs detect PAMPs; contact inside the leaf is a far stronger signal than microbes sitting on the cuticle
    const contacts = outside * 0.08 + inside + germ * 0.6 + sporesIn * 2;
    const pamp = sat(contacts, 4);
    const target = clamp(st.defense * pamp * (1 + 0.6 * pz.primed), 0, 1);
    pz.pti += (target - pz.pti) * dt * 0.5 * (1 + 2 * pz.primed);
    if (effActive() && st.rgene) {
      pz.etiT += dt;
      if (pz.etiT > 0.8) pz.eti = Math.min(clamp(st.defense, 0, 1), pz.eti + dt * 0.8);
    } else pz.eti = Math.max(0, pz.eti - dt * 0.2);
    const pe = ptiEff();
    // stomata close as part of PTI (bacterial effectors that suppress PTI let them reopen)
    pz.ap += (clamp(1 - 0.85 * pe, 0.08, 1) - pz.ap) * dt * 1.5;
    // bacteria
    for (const b of pz.bugs) {
      b.age += dt;
      if (b.dead) continue;
      if (!b.inside) {
        const targets: number[] = [];
        if (pz.ap > 0.2) targets.push(STOMA_X);
        if (st.wound) targets.push(WOUND_X);
        let drift = 0;
        if (targets.length) {
          const tx = targets.reduce((a, c) => (Math.abs(c - b.x) < Math.abs(a - b.x) ? c : a));
          if (Math.abs(tx - b.x) < 220) drift = Math.sign(tx - b.x) * 14;
          const gate = tx === STOMA_X ? 4 + pz.ap * 9 : 24;
          if (Math.abs(tx - b.x) < gate) {
            b.inside = true;
            b.x = tx + (Math.random() - 0.5) * 16;
            b.y = EPI_B + 10;
            pz.entered++;
            continue;
          }
        }
        b.x = clamp(b.x + (drift + (Math.random() - 0.5) * 60) * dt, 4, 616);
        b.y = CUT_Y - 6 + Math.sin(b.age * 3 + b.x) * 1.5;
      } else {
        b.x = clamp(b.x + (Math.random() - 0.5) * 110 * dt, 6, 614);
        b.y = clamp(b.y + (Math.random() - 0.35) * 100 * dt, EPI_B + 6, 525);
        // antimicrobials kill; growth slows under PTI/ETI
        if (Math.random() < dt * 0.25 * pe) b.dead = t;
        else if (Math.random() < dt * 0.35 * (1 - 0.9 * pe) && pz.bugs.length < 320) pz.bugs.push({ x: b.x + 3, y: b.y + 2, inside: true, dead: 0, age: 0 });
      }
    }
    // fungi
    for (const s of pz.spores) {
      s.age += dt;
      if (s.stage === 'germ' && s.age > 1.6) s.stage = 'try';
      if (s.stage === 'try' && s.age > 2.4) {
        // the appressorium tries to push through; callose papillae made during PTI can stop it
        const block = clamp(0.1 + 0.8 * pe, 0, 0.95);
        if (Math.random() < block) {
          s.stage = 'blocked';
          pz.callose.push(s.x + s.dir * 26);
        } else {
          s.stage = 'in';
          pz.entered++;
          const ax = clamp(s.x + s.dir * 26, 10, 610);
          const tgt = nearCell([ax, EPI_B + 40], 0);
          s.target = tgt;
          const [cx, cy] = cellCenter(cells[tgt]);
          s.path = [[ax, CUT_Y + 4], [ax, EPI_B - 6], [lerp(ax, cx, 0.5), lerp(EPI_B, cy, 0.5) + 20], [cx, cy]];
        }
      }
      if (s.stage === 'in') {
        s.grow = Math.min(1, s.grow + dt * 0.12 * (1 - 0.85 * pe));
        const tip = pathPoint(s.path, s.grow);
        const c = cellAt(tip);
        if (c && !c.dead) c.inf = Math.min(1, c.inf + dt * 0.5);
        if (s.grow >= 1 && s.path.length < 9) {
          // reaches its target cell and grows on to another
          const before = pathLen(s.path);
          // hyphae grow between neighbouring cells, not across the leaf
          const [nx, ny] = cellCenter(cells[nearCell(tip, 30)]);
          s.path.push([lerp(tip[0], nx, 0.5) + (Math.random() - 0.5) * 10, lerp(tip[1], ny, 0.5)], [nx, ny]);
          s.grow = before / pathLen(s.path);
        }
      }
    }
    // infection of cells by bacteria in the spaces between them
    const liveIn = pz.bugs.filter((b) => b.inside && !b.dead);
    for (const c of cells) {
      if (c.dead) continue;
      const [cx, cy] = cellCenter(c);
      let n = 0;
      for (const b of liveIn) if (Math.abs(b.x - cx) < 40 && Math.abs(b.y - cy) < 50) n++;
      if (n) c.inf = Math.min(1, c.inf + dt * 0.035 * n * (1 - 0.8 * pe));
    }
    // hypersensitive response: infected cells die and take the pathogen with them
    if (pz.eti > 0.5) {
      for (const c of cells)
        if (!c.dead && c.inf > 0.04) {
          c.dead = true;
          pz.hr++;
        }
      for (const b of liveIn) {
        const near = cells.some((c) => c.dead && Math.hypot(cellCenter(c)[0] - b.x, cellCenter(c)[1] - b.y) < 60);
        if (near && Math.random() < dt * 2.5) b.dead = t;
      }
      for (const s of pz.spores)
        if (s.stage === 'in') {
          // the epidermal cell the fungus entered dies with it
          s.stage = 'dead';
          const i = clamp(Math.floor((s.path[0]?.[0] ?? s.x) / 62), 0, 9);
          if (!pz.epiDead.includes(i)) {
            pz.epiDead.push(i);
            pz.hr++;
          }
        }
    }
    pz.bugs = pz.bugs.filter((b) => !b.dead || t - b.dead < 1.5);
    // salicylic acid and SAR
    pz.sa = clamp(pz.sa + dt * (0.25 * pz.eti + 0.04 * pe) - dt * 0.015 * pz.sa, 0, 1);
    pz.spread = clamp(pz.spread + dt * 0.06 * pz.sa, 0, 1);
  }
  /** A random cell within reach of p (at least minD away), or the nearest one. */
  function nearCell(p: Pt, minD: number) {
    const d = cells.map((c, i) => ({ i, d: Math.hypot(cellCenter(c)[0] - p[0], cellCenter(c)[1] - p[1]) }));
    const near = d.filter((q) => q.d > minD && q.d < 95);
    if (near.length) return near[Math.floor(Math.random() * near.length)].i;
    return d.sort((a, b) => a.d - b.d)[0].i;
  }
  const pathLen = (pts: Pt[]) => pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
  function pathPoint(pts: Pt[], u: number): Pt {
    const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    let d = seg.reduce((a, b) => a + b, 0) * clamp(u, 0, 1);
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const f = seg[i] ? clamp(d / seg[i], 0, 1) : 0;
        return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
      }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  }
  const cellAt = ([x, y]: Pt) => cells.find((c) => (c.round ? Math.hypot(x - c.x, y - c.y) < c.w : x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h));
  const diseased = () => cells.filter((c) => !c.dead && c.inf > 0.5).length / cells.length;

  /* ======================= Herbivore model ======================= */
  interface HLeaf {
    eaten: number;
    sap: number;
    ja: number;
    tox: number;
  }
  type Bug2 = { type: Herb; leaf: number; u: number; state: 'feed' | 'move' | 'trapped' | 'para' | 'drop'; t: number; from: number; y: number };
  const NL = 6;
  const hz = { leaves: [] as HLeaf[], herbs: [] as Bug2[], voc: 0, wasps: [] as { x: number; y: number; target: Bug2 | null }[], waspN: 0, off: 0, trapped: 0, signals: [] as { from: number; to: number; u: number }[] };
  function clearPlant() {
    hz.leaves = Array.from({ length: NL }, () => ({ eaten: 0, sap: 0, ja: 0, tox: 0.05 * st.defense }));
    hz.herbs = [];
    hz.voc = 0;
    hz.wasps = [];
    hz.waspN = 0;
    hz.off = 0;
    hz.trapped = 0;
    hz.signals = [];
  }
  clearPlant();
  const feeding = () => hz.herbs.filter((h) => h.state === 'feed');
  function addHerb(leaf: number, u = 0.3 + Math.random() * 0.5) {
    if (hz.herbs.length >= 40) return;
    hz.herbs.push({ type: st.herb, leaf, u, state: 'feed', t: 0, from: leaf, y: 0 });
  }
  function stepInsect(dt: number) {
    const L = hz.leaves;
    for (const h of hz.herbs) {
      h.t += dt;
      const lf = L[h.leaf];
      if (h.state === 'feed') {
        if (h.type === 'caterpillar') {
          const rate = 0.05 * (st.trich ? 0.6 : 1) * (1 - 0.85 * lf.tox);
          lf.eaten = Math.min(0.95, lf.eaten + dt * rate);
          if (st.ja) {
            lf.ja = Math.min(1, lf.ja + dt * 0.22 * (rate / 0.05));
            hz.voc += dt * 0.08 * (rate / 0.05);
          }
          if (lf.tox > 0.55 || lf.eaten >= 0.95) {
            // the caterpillar leaves for the least defended leaf, or gives up
            const best = L.map((l, i) => ({ i, s: l.tox + (l.eaten > 0.9 ? 2 : 0) })).sort((a, b) => a.s - b.s)[0];
            if (best.i !== h.leaf && best.s < 0.5) {
              h.state = 'move';
              h.from = h.leaf;
              h.leaf = best.i;
              h.t = 0;
            } else {
              h.state = 'drop';
              h.t = 0;
              hz.off++;
            }
          }
        } else {
          lf.sap = Math.min(1, lf.sap + dt * 0.006);
          if (st.ja) {
            // sap-sucking causes little wounding: a weak jasmonate response
            if (lf.ja < 0.35) lf.ja = Math.min(0.35, lf.ja + dt * 0.012);
            hz.voc += dt * 0.02;
          }
          if (st.trich && Math.random() < dt * 0.06) {
            h.state = 'trapped';
            h.t = 0;
            hz.trapped++;
          } else if (h.t > 6 / Math.max(0.15, 1 - 0.8 * lf.tox) && hz.herbs.filter((q) => q.leaf === h.leaf && q.state === 'feed').length < 8) {
            h.t = 0;
            addHerb(h.leaf, clamp(h.u + (Math.random() - 0.5) * 0.3, 0.15, 0.9));
          }
        }
      } else if (h.state === 'move' && h.t > 2.2) {
        h.state = 'feed';
        h.t = 0;
      }
    }
    hz.herbs = hz.herbs.filter((h) => !((h.state === 'drop' && h.t > 1.5) || ((h.state === 'trapped' || h.state === 'para') && h.t > 4)));
    // jasmonate travels to the other leaves through the vascular system; toxins follow
    const src = L.reduce((a, l, i) => (l.ja > L[a].ja ? i : a), 0);
    if (st.ja && L[src].ja > 0.05) {
      if (Math.random() < dt * 2 * L[src].ja) hz.signals.push({ from: src, to: Math.floor(Math.random() * NL), u: 0 });
      for (let j = 0; j < NL; j++) if (j !== src) L[j].ja += dt * 0.05 * Math.max(0, L[src].ja * 0.7 - L[j].ja);
    }
    for (const l of L) {
      l.ja = Math.max(0, l.ja - dt * 0.015);
      l.tox = clamp(l.tox + dt * 0.045 * l.ja * st.defense - dt * 0.004 * (l.tox - 0.05 * st.defense), 0, 1);
    }
    hz.signals = hz.signals.filter((s) => (s.u += dt * 0.6) < 1);
    // volatiles attract parasitic wasps
    if (hz.voc >= 1 && hz.wasps.length < 2) {
      const prey = feeding();
      if (prey.length) {
        hz.voc -= 1;
        const [W] = box();
        hz.wasps.push({ x: W + 20, y: 60, target: prey[Math.floor(Math.random() * prey.length)] });
        hz.waspN++;
      }
    }
    for (const w of hz.wasps) {
      if (!w.target || w.target.state !== 'feed') {
        w.target = feeding()[0] ?? null;
        if (!w.target) {
          w.x += 120 * dt;
          w.y -= 40 * dt;
          continue;
        }
      }
      const [tx, ty] = herbPos(w.target);
      const d = Math.hypot(tx - w.x, ty - 14 - w.y);
      if (d < 8) {
        w.target.state = 'para';
        w.target.t = 0;
        w.target = null;
        w.y = -999;
      } else {
        w.x += ((tx - w.x) / d) * 150 * dt;
        w.y += ((ty - 14 - w.y) / d) * 150 * dt + Math.sin(t * 12) * 0.6;
      }
    }
    hz.wasps = hz.wasps.filter((w) => w.y > -100 && w.x < 1200);
  }

  /* ======================= Layout ======================= */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  const pathLayout = () =>
    portrait()
      ? { leaf: { x: 10, y: 10, w: 660, h: 460 }, steps: { x: 10, y: 480, w: 660, h: 510 } }
      : { leaf: { x: 10, y: 10, w: 632, h: 580 }, steps: { x: 652, y: 70, w: 338, h: 520 } };
  const insLayout = () =>
    portrait()
      ? { x: 250, ground: 630, top: 150, hx: 560, hground: 630, hs: 0.55, status: { x: 10, y: 706, w: 660, h: 284 }, tray: { x: 14, y: 14, w: 200, h: 66 } }
      : { x: 330, ground: 562, top: 110, hx: 800, hground: 330, hs: 0.55, status: { x: 600, y: 360, w: 390, h: 230 }, tray: { x: 14, y: 14, w: 200, h: 66 } };
  const leafNode = (i: number, s = 1, ground?: number, top?: number) => {
    const L = insLayout();
    const g = ground ?? L.ground;
    const tp = top ?? L.top;
    const y = g - 70 * s - (i * (g - tp - 90 * s)) / (NL - 1);
    return { y, side: i % 2 ? 1 : -1 };
  };
  function herbPos(h: Bug2): Pt {
    const L = insLayout();
    const n = leafNode(h.leaf);
    if (h.state === 'move') {
      const f = clamp(h.t / 2.2, 0, 1);
      const a = leafNode(h.from);
      const y = lerp(a.y, n.y, f);
      return [L.x + (f < 0.15 ? a.side * 40 * (1 - f / 0.15) : f > 0.85 ? n.side * 40 * ((f - 0.85) / 0.15) : 0), y - 4];
    }
    const x = L.x + n.side * (24 + h.u * 96);
    const y = n.y - 6 - Math.sin(h.u * Math.PI) * 10 + (h.state === 'drop' ? h.t * h.t * 120 : 0);
    return [x, y];
  }

  /* ======================= Steps ======================= */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    t += dt;
    if (st.view === 'pathogen') stepPathogen(dt);
    else if (st.view === 'insect') stepInsect(dt);
  }

  /* ======================= Drawing helpers ======================= */
  let K = 1;
  let cur = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs = (px: number, wt = 650) => font(px / cur, wt);
  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({
      test: (px, py) => {
        const lx = (px - f.x) / f.s;
        const ly = (py - f.y) / f.s;
        return lx >= x && lx <= x + w && ly >= y && ly <= y + h;
      },
      title,
      text,
    });
  }
  function text(s: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
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
  function leafPath(x: number, y: number, len: number, ang: number, wid = 0.3) {
    ctx.beginPath();
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const P = (a: number, b: number): Pt => [x + a * c - b * s, y + a * s + b * c];
    ctx.moveTo(...P(0, 0));
    ctx.quadraticCurveTo(...P(len * 0.5, -len * wid), ...P(len, 0));
    ctx.quadraticCurveTo(...P(len * 0.5, len * wid), ...P(0, 0));
  }
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  /* ======================= Pathogen view ======================= */
  let leafFrame = { x: 0, y: 0, s: 1 };
  function drawLeafSection() {
    const L = pathLayout();
    panel(L.leaf.x, L.leaf.y, L.leaf.w, L.leaf.h, pal['surface-2']);
    const s = Math.min((L.leaf.w - 10) / 620, (L.leaf.h - 10) / 560);
    const ox = L.leaf.x + (L.leaf.w - 620 * s) / 2;
    const oy = L.leaf.y + (L.leaf.h - 560 * s) / 2;
    leafFrame = { x: ox, y: oy, s };
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(L.leaf.x, L.leaf.y, L.leaf.w, L.leaf.h, 10);
    ctx.clip();
    enter(ox, oy, s);
    const pe = ptiEff();
    // leaf interior (air spaces)
    ctx.fillStyle = '#ebfbee';
    ctx.fillRect(0, EPI_B, 620, 380);
    // mesophyll cells
    for (const c of cells) {
      const fill = c.dead ? '#5c3d2e' : mix(mix('#8ce99a', '#ffe066', c.inf * 1.2), '#c0a060', Math.max(0, c.inf - 0.5) * 2);
      ctx.fillStyle = fill;
      ctx.strokeStyle = c.dead ? '#3b2a20' : '#2b8a3e';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (c.round) ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
      else ctx.roundRect(c.x, c.y, c.w, c.h, 8);
      ctx.fill();
      ctx.stroke();
      if (!c.dead) {
        const [cx, cy] = cellCenter(c);
        for (let k = 0; k < (c.round ? 4 : 6); k++) ell(cx + Math.cos(k * 2.1) * (c.round ? 12 : 9), cy + Math.sin(k * 1.7) * (c.round ? 9 : 30), 3.5, 2.5, withAlpha('#2b8a3e', 0.7));
        // antimicrobial compounds made during PTI/ETI
        if (pe > 0.25 && (k2(c) % 3 === 0)) ell(cx + 6, cy - 4, 2.6, 2.6, withAlpha(SA_COL, pe));
      }
    }
    // vein
    ell(310, 506, 62, 40, '#d3f9d8', '#2b8a3e', 2);
    for (let k = 0; k < 7; k++) ell(282 + (k % 4) * 18, 494 + Math.floor(k / 4) * 22, 7, 7, '#ffd8a8', '#d9480f', 1);
    if (pz.sa > 0.05) {
      for (let k = 0; k < 6; k++) {
        const ph = (t * 0.6 + k / 6) % 1;
        ell(lerp(310, 620, ph), 506 + Math.sin(ph * 9 + k) * 6, 4, 4, withAlpha(SA_COL, pz.sa));
      }
    }
    rect(248, 466, 124, 80, 'Vein', () => 'The vein carries water (xylem) and sugars (phloem). During an immune response, salicylic acid and other mobile signals travel through it to the rest of the plant.');
    // lower epidermis
    ctx.fillStyle = '#d3f9d8';
    ctx.fillRect(0, 538, 620, 22);
    // upper epidermis, stoma and wound
    for (let i = 0; i < 10; i++) {
      const x = i * 62;
      if (i === 4) continue;
      if (st.wound && i === 7) continue;
      const dead = pz.epiDead.includes(i);
      ctx.fillStyle = dead ? '#5c3d2e' : '#e6fcf5';
      ctx.strokeStyle = dead ? '#3b2a20' : '#2b8a3e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(x + 1, EPI_Y, 60, EPI_B - EPI_Y, 6);
      ctx.fill();
      ctx.stroke();
    }
    // cuticle (wax)
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(0, CUT_Y, 620, EPI_Y - CUT_Y);
    // stoma: two guard cells around a pore
    const gap = 3 + 12 * pz.ap;
    ctx.fillStyle = '#ebfbee';
    ctx.fillRect(248, CUT_Y, 62, EPI_B - CUT_Y);
    for (const sgn of [-1, 1]) ell(STOMA_X + sgn * (gap + 12), (EPI_Y + EPI_B) / 2 - 2, 14, 30, '#69db7c', '#2b8a3e', 1.8);
    rect(248, CUT_Y - 10, 62, EPI_B - CUT_Y + 10, 'Stoma', () =>
      `Stomata let carbon dioxide in, but they are also a way in for bacteria. Closing them is one of the first PTI responses. Now ${pct(pz.ap)} open.`,
    );
    // wound
    if (st.wound) {
      ctx.fillStyle = '#ebfbee';
      ctx.fillRect(434, CUT_Y, 62, EPI_B - CUT_Y);
      ctx.strokeStyle = '#a0522d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.lineTo(434 + k * 12, CUT_Y + (k % 2 ? 30 : 8));
      ctx.stroke();
      text('wound', WOUND_X, CUT_Y - 18, 10.5, '#a0522d', 'center', 750);
      rect(434, CUT_Y - 10, 62, EPI_B - CUT_Y + 10, 'Wound', () => 'A wound, from hail, pruning or an insect, breaks the cuticle and lets bacteria and fungi straight in.');
    }
    rect(0, CUT_Y, 620, EPI_Y - CUT_Y + 2, PARTS.cuticle.name, () => PARTS.cuticle.text);
    rect(0, EPI_Y, 620, EPI_B - EPI_Y, 'Epidermis', () => 'A single layer of tightly fitting cells with thick walls. Pattern recognition receptors (PRRs) in their membranes detect PAMPs.');
    rect(0, 184, 620, 100, 'Palisade mesophyll', () => 'Column-shaped cells packed with chloroplasts. Callose, reactive oxygen and antimicrobial chemicals are made here when the leaf is attacked.');
    // callose papillae where fungal pegs were stopped
    for (const x of pz.callose) ell(x, EPI_Y + 8, 9, 7, CALLOSE, '#1c7ed6', 1.2);
    // fungi
    for (const sp of pz.spores) {
      const dead = sp.stage === 'dead' || sp.stage === 'blocked';
      const col = dead ? '#868e96' : '#495057';
      ell(sp.x, CUT_Y - 8, 8, 6, col, '#212529', 1);
      const tube = Math.min(1, sp.age / 1.6) * 26;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sp.x, CUT_Y - 4);
      ctx.quadraticCurveTo(sp.x + sp.dir * tube * 0.5, CUT_Y - 8, sp.x + sp.dir * tube, CUT_Y - 4);
      ctx.stroke();
      if (sp.age > 1.6) ell(sp.x + sp.dir * 26, CUT_Y - 4, 5.5, 5, col, '#212529', 1);
      if (sp.stage === 'in' || (sp.stage === 'dead' && sp.path.length)) {
        ctx.strokeStyle = sp.stage === 'dead' ? '#868e96' : '#495057';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const n = 40;
        for (let k = 0; k <= n; k++) {
          const [px, py] = pathPoint(sp.path, (k / n) * (sp.stage === 'in' ? Math.max(sp.grow, 0.05) : 1));
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }
    // bacteria
    for (const b of pz.bugs) {
      const a = b.dead ? Math.max(0, 1 - (t - b.dead) / 1.5) : 1;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate((b.x * 7 + b.y) % 3);
      ctx.fillStyle = withAlpha(b.dead ? '#868e96' : '#c92a2a', a);
      ctx.beginPath();
      ctx.roundRect(-5, -2.5, 10, 5, 2.5);
      ctx.fill();
      ctx.restore();
    }
    // tray to drag pathogens from
    panel(10, 12, 200, 64, pal['bg-elev']);
    if (st.pathogen === 'bacteria')
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = '#c92a2a';
        ctx.beginPath();
        ctx.roundRect(24 + (k % 4) * 11, 30 + Math.floor(k / 4) * 9, 9, 4.5, 2);
        ctx.fill();
      }
    else for (let k = 0; k < 3; k++) ell(30 + k * 14, 40, 6, 5, '#495057', '#212529', 1);
    text('Drag onto', 84, 38, 11, pal['sim-text'], 'left', 750);
    text('the leaf', 84, 38 + 15 / cur, 11, pal['sim-text'], 'left', 750);
    // labels
    if (st.labels) {
      pill('Cuticle (wax)', 610, CUT_Y - 8, 'right', 10.5);
      pill('Epidermis', 610, 152, 'right', 10.5);
      pill('Stoma', STOMA_X, EPI_B + 20, 'center', 10.5);
      pill('Palisade mesophyll', 610, 236, 'right', 10.5);
      pill('Spongy mesophyll', 610, 390, 'right', 10.5);
      pill('Vein', 310, 470, 'center', 10.5);
    }
    leave();
    ctx.restore();
  }
  const k2 = (c: MCell) => Math.round(c.x * 3 + c.y);

  function drawSteps() {
    const L = pathLayout();
    const P = L.steps;
    panel(P.x, P.y, P.w, P.h);
    text('Immune response', P.x + 14, P.y + 24, 13, pal['sim-text'], 'left', 800);
    const live = pz.bugs.filter((b) => !b.dead);
    const contacts = live.length + pz.spores.filter((s) => s.stage !== 'dead' && s.stage !== 'blocked').length;
    const eff = effActive();
    const status: [boolean, string, string][] = [
      [contacts > 0, contacts > 0 ? `Detected: ${PATHOGENS[st.pathogen].pamp}` : 'Waiting for a microbe', pal.accent],
      [pz.pti > 0.08, pz.pti > 0.08 ? `${pct(pz.pti)}${eff ? ' (suppressed)' : ''}` : '—', pal.accent],
      [eff, !st.effectors ? 'This strain makes none' : eff ? 'PTI suppressed' : 'Not inside yet', pal.danger],
      [pz.eti > 0.05, !st.effectors ? 'Not triggered' : !st.rgene ? 'No matching R protein' : pz.eti > 0.05 ? `${pct(pz.eti)}` : pz.hr ? 'Done' : 'Waiting', pal.accent],
      [pz.hr > 0, pz.hr ? `${pz.hr} cell${pz.hr === 1 ? '' : 's'} sacrificed` : '—', '#5c3d2e'],
      [pz.sa > 0.05, pz.sa > 0.05 ? `SA ${pct(pz.sa)} · ${pct(pz.spread)} spread` : '—', SA_COL],
    ];
    const wide = portrait();
    const rowW = wide ? P.w * 0.62 : P.w - 28;
    const rh = Math.min(60, (wide ? P.h - 50 : P.h - 236) / 6);
    STEPS.forEach((s, i) => {
      const y = P.y + 44 + i * rh;
      const [on, msg, col] = status[i];
      ell(P.x + 22, y + 6 / cur, 8 / cur, 8 / cur, on ? col : withAlpha(pal['text-faint'], 0.3));
      text(String(i + 1), P.x + 22, y + 10 / cur, 10, '#ffffff', 'center', 800);
      text(s.name, P.x + 38, y + 10 / cur, 11.5, on ? pal['sim-text'] : pal['text-muted'], 'left', on ? 800 : 650);
      text(msg, P.x + 38, y + 27 / cur, 10.5, on ? col : pal['text-faint'], 'left', 650);
      rect(P.x + 10, y - 6, rowW, rh, s.name, () => s.text);
      if (i < 5) {
        ctx.strokeStyle = withAlpha(pal['text-faint'], 0.5);
        ctx.lineWidth = 1.5 / cur;
        ctx.beginPath();
        ctx.moveTo(P.x + 22, y + 16 / cur);
        ctx.lineTo(P.x + 22, y + rh - 4 / cur);
        ctx.stroke();
      }
    });
    // mini plant showing SAR
    const mx = wide ? P.x + P.w * 0.86 : P.x + P.w / 2;
    const my = P.y + P.h - 10 - 40 / cur;
    const mh = wide ? 220 : 128;
    ctx.strokeStyle = STEM;
    ctx.lineWidth = 3 / cur + 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx, my - mh);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const y = my - 20 - i * (mh - 30) / 4;
      const sd = i % 2 ? 1 : -1;
      const infected = i === 0;
      const prim = infected ? 0 : clamp(pz.spread * 1.4 - i * 0.12, 0, 1);
      const col = infected ? mix(LEAF, '#c0a060', diseased() * 2) : mix(LEAF, '#12b886', prim);
      leafPath(mx, y, mh * 0.32, sd > 0 ? -0.3 : Math.PI + 0.3, 0.32);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = prim > 0.5 ? '#087f5b' : withAlpha('#2b8a3e', 0.6);
      ctx.lineWidth = (prim > 0.5 ? 2.5 : 1) / cur;
      ctx.stroke();
      if (infected) {
        for (let k = 0; k < 4; k++) ell(mx + sd * (14 + k * 9), y - 2 + (k % 2) * 4, 2.6, 2.6, pz.hr ? '#5c3d2e' : diseased() > 0.05 ? '#a0522d' : 'transparent');
      }
    }
    text(pz.spread > 0.3 ? 'Other leaves primed' : 'Whole plant', mx, my + 16 / cur, 10.5, pz.spread > 0.3 ? '#0ca678' : pal['text-muted'], 'center', 750);
    text('(lowest leaf infected)', mx, my + 31 / cur, 9.5, pal['text-muted'], 'center', 650);
    if (pz.primed > 0.05) pill(`Primed ${pct(pz.primed)}`, P.x + P.w - 14, P.y + 22, 'right', 10.5, '#0ca678');
  }

  /* ======================= Insect view ======================= */
  function drawPlant2d(x: number, ground: number, top: number, s: number, leaves: HLeaf[] | null, interactive: boolean) {
    ctx.strokeStyle = STEM;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x, top);
    ctx.stroke();
    // prickles on the lower stem
    for (let k = 0; k < 5; k++) {
      const y = ground - 20 * s - k * 22 * s;
      const sd = k % 2 ? 1 : -1;
      ctx.fillStyle = '#a07850';
      ctx.beginPath();
      ctx.moveTo(x + sd * 3 * s, y - 5 * s);
      ctx.lineTo(x + sd * 13 * s, y + 2 * s);
      ctx.lineTo(x + sd * 3 * s, y + 4 * s);
      ctx.fill();
    }
    if (interactive) rect(x - 18, ground - 130 * s, 36, 120 * s, PARTS.prickle.name, () => `${PARTS.prickle.text} They deter browsing mammals, but caterpillars and aphids simply climb past them.`);
    for (let i = 0; i < NL; i++) {
      const n = leafNode(i, s, ground, top);
      const lf = leaves?.[i] ?? { eaten: 0, sap: 0, ja: 0, tox: 0.05 * st.defense };
      const ang = n.side > 0 ? -0.18 : Math.PI + 0.18;
      const len = 125 * s;
      const col = mix(mix(LEAF, '#2f9e44', lf.tox * 0.8), '#e9d36b', lf.sap * 3);
      ctx.save();
      leafPath(x, n.y, len, ang, 0.3);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = withAlpha('#2b8a3e', 0.7);
      ctx.lineWidth = 1.2 / cur;
      ctx.stroke();
      ctx.clip();
      // bites eaten from the leaf edge, from the tip inwards
      const bites = Math.floor(lf.eaten * 16);
      ctx.fillStyle = pal['sim-bg'];
      for (let b = 0; b < bites; b++) {
        const u = 0.95 - (b % 8) * 0.1;
        const edge = b < 8 ? 1 : -1;
        const bx = x + Math.cos(ang) * len * u - Math.sin(ang) * edge * len * 0.17;
        const by = n.y + Math.sin(ang) * len * u + Math.cos(ang) * edge * len * 0.17;
        ell(bx, by, 13 * s, 11 * s, pal['sim-bg']);
      }
      // defensive compounds in the leaf
      const dots = Math.round(lf.tox * 10);
      for (let d = 0; d < dots; d++) ell(x + Math.cos(ang) * len * (0.2 + d * 0.07), n.y + Math.sin(ang) * len * (0.2 + d * 0.07) + ((d % 2) * 2 - 1) * 5 * s, 2.6 * s, 2.6 * s, withAlpha(TOX_COL, 0.85));
      ctx.restore();
      // trichomes
      if (st.trich)
        for (let k = 1; k < 12; k++) {
          const u = k / 12;
          const w = Math.sin(u * Math.PI) * len * 0.15;
          for (const e of [-1, 1]) {
            const hx = x + Math.cos(ang) * len * u - Math.sin(ang) * e * w;
            const hy = n.y + Math.sin(ang) * len * u + Math.cos(ang) * e * w;
            ctx.strokeStyle = withAlpha('#f8f9fa', 0.9);
            ctx.lineWidth = 1 / cur;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx - Math.sin(ang) * e * 5 * s, hy + Math.cos(ang) * e * 5 * s - 2 * s);
            ctx.stroke();
          }
        }
      if (lf.ja > 0.05 && st.signals) {
        ctx.strokeStyle = withAlpha(JA_COL, lf.ja);
        ctx.lineWidth = 2.5 / cur;
        ctx.beginPath();
        ctx.moveTo(x, n.y);
        ctx.lineTo(x + Math.cos(ang) * len * 0.92, n.y + Math.sin(ang) * len * 0.92);
        ctx.stroke();
      }
      if (interactive)
        rect(Math.min(x, x + Math.cos(ang) * len), n.y - len * 0.3, len, len * 0.6, `Leaf ${i + 1}`, () =>
          `${pct(lf.eaten)} eaten. Jasmonate ${pct(lf.ja)}. Defensive compounds (such as proteinase inhibitors and toxins) ${pct(lf.tox)}.${st.trich ? ' Covered in trichomes.' : ''}`,
        );
    }
  }
  function drawHerb(h: Bug2) {
    const [x, y] = herbPos(h);
    const a = h.state === 'drop' ? Math.max(0, 1 - h.t / 1.5) : h.state === 'para' || h.state === 'trapped' ? Math.max(0.3, 1 - h.t / 4) : 1;
    if (h.type === 'caterpillar') {
      const col = h.state === 'para' ? '#ced4da' : '#94d82d';
      for (let k = 0; k < 6; k++) ell(x - 12 + k * 5, y + Math.sin(t * 8 + k) * (h.state === 'feed' ? 1.2 : 0.3), 4.2, 4.2, withAlpha(col, a), withAlpha('#2b8a3e', a), 0.8 / cur);
      ell(x + 15, y - 1, 4.5, 4.5, withAlpha('#495057', a));
    } else {
      const col = h.state === 'trapped' ? '#adb5bd' : '#37b24d';
      ell(x, y, 4, 3, withAlpha(col, a), withAlpha('#1b5e20', a), 0.8 / cur);
      ell(x + 4, y - 1, 1.6, 1.6, withAlpha('#1b5e20', a));
    }
  }
  function drawInsect() {
    const L = insLayout();
    const [W] = box();
    ctx.fillStyle = withAlpha('#8d6e63', 0.25);
    ctx.fillRect(0, L.ground, W, 1000);
    // jasmonate signals moving through the stem
    drawPlant2d(L.x, L.ground, L.top, 1, hz.leaves, true);
    if (st.signals)
      for (const sg of hz.signals) {
        const a = leafNode(sg.from).y;
        const b = leafNode(sg.to).y;
        ell(L.x, lerp(a, b, sg.u), 3.4, 3.4, JA_COL, '#ffffff', 0.8 / cur);
      }
    // volatiles
    if (st.signals && st.ja) {
      const ff = feeding().filter((h) => h.type === 'caterpillar').length + feeding().length * 0.2;
      for (let k = 0; k < Math.min(14, ff * 4); k++) {
        const ph = (t * 0.35 + k / 14) % 1;
        const h = feeding()[k % Math.max(1, feeding().length)];
        if (!h) break;
        const [hx, hy] = herbPos(h);
        ell(hx + Math.sin(k * 3 + t) * 30 * ph, hy - ph * 120, 3.5, 3.5, withAlpha('#ced4da', 0.7 * (1 - ph)));
      }
    }
    for (const h of hz.herbs) drawHerb(h);
    for (const w of hz.wasps) {
      ell(w.x, w.y, 7, 3, '#212529');
      ell(w.x - 2, w.y - 4, 6, 2.5, withAlpha('#e7f5ff', 0.8), null, 1, Math.sin(t * 40) * 0.5);
      ell(w.x + 5, w.y, 2.5, 2.5, '#fab005');
    }
    pill('Attacked plant', L.x, L.ground + 26, 'center', 12, pal.accent);
    // healthy plant
    drawPlant2d(L.hx, L.hground, L.hground - 260 * L.hs * (portrait() ? 1.6 : 1), L.hs, null, false);
    pill('Healthy plant', L.hx, L.hground + 22, 'center', 11.5, pal['text-muted']);
    // tray
    const T = L.tray;
    panel(T.x, T.y, T.w, T.h);
    const ix = T.x + 34;
    const iy = T.y + T.h / 2;
    if (st.herb === 'caterpillar') {
      for (let k = 0; k < 6; k++) ell(ix - 12 + k * 5, iy, 4.2, 4.2, '#94d82d', '#2b8a3e', 0.8 / cur);
      ell(ix + 15, iy - 1, 4.5, 4.5, '#495057');
    } else for (let k = 0; k < 3; k++) ell(ix - 8 + k * 9, iy + (k % 2) * 4, 4, 3, '#37b24d', '#1b5e20', 0.8 / cur);
    text('Drag onto', T.x + 70, T.y + 28, 11, pal['sim-text'], 'left', 750);
    text('the plant', T.x + 70, T.y + 28 + 15 / cur, 11, pal['sim-text'], 'left', 750);
    if (drag) {
      if (drag.type === 'caterpillar') for (let k = 0; k < 6; k++) ell(drag.x - 12 + k * 5, drag.y, 4.2, 4.2, '#94d82d', '#2b8a3e', 0.8 / cur);
      else ell(drag.x, drag.y, 4, 3, '#37b24d', '#1b5e20', 0.8 / cur);
    }
    drawStatus(L.status);
  }
  function drawStatus(P: { x: number; y: number; w: number; h: number }) {
    panel(P.x, P.y, P.w, P.h);
    text('Leaf by leaf', P.x + 14, P.y + 22, 12.5, pal['sim-text'], 'left', 800);
    const cols: [string, string, (l: HLeaf) => number][] = [
      ['Eaten', '#a0522d', (l) => l.eaten],
      ['Jasmonate', JA_COL, (l) => l.ja],
      ['Toxins', TOX_COL, (l) => l.tox],
    ];
    ctx.font = fs(10.5, 650);
    const x0 = P.x + 14 + ctx.measureText('Leaf 6').width + 10 / cur;
    const cw = (P.w - 84) / 3;
    cols.forEach(([n, c], k) => text(n, x0 + k * cw, P.y + 44, 10.5, c, 'left', 750));
    const rh = (P.h - 60) / NL;
    for (let i = NL - 1; i >= 0; i--) {
      const y = P.y + 54 + (NL - 1 - i) * rh;
      text(`Leaf ${i + 1}`, P.x + 14, y + rh * 0.6, 10.5, pal['text-muted'], 'left', 650);
      cols.forEach(([, c, f], k) => {
        const bw = cw - 12;
        ctx.fillStyle = withAlpha(pal['text-faint'], 0.2);
        ctx.fillRect(x0 + k * cw, y + rh * 0.25, bw, rh * 0.45);
        ctx.fillStyle = c;
        ctx.fillRect(x0 + k * cw, y + rh * 0.25, bw * clamp(f(hz.leaves[i]), 0, 1), rh * 0.45);
      });
    }
  }

  /* ======================= Render ======================= */
  function render() {
    const { w: cw, h: ch } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, cw, ch);
    areas = [];
    if (st.view !== '3d') {
      const { k, ox, oy } = tf();
      K = k;
      cur = k;
      frame = { x: 0, y: 0, s: 1 };
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      if (st.view === 'pathogen') {
        drawLeafSection();
        drawSteps();
      } else drawInsect();
      ctx.restore();
    }
    updateUi();
  }

  /* ======================= Readouts ======================= */
  const explored = new Set<PartId>();
  let selected: PartId | null = null;
  function updateUi() {
    const r = (name: string, label: string, s: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, s, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = lastMsg;
    if (st.view === '3d') {
      const p = selected ? PARTS[selected] : null;
      r('r1', 'Selected structure', p ? p.name : 'None');
      r('r2', 'Type of defense', p ? p.kind : '—');
      r('r3', 'Works against', p ? p.against : '—');
      r('r4', 'Structures explored', `${explored.size} of ${PART_ORDER.length}`, explored.size === PART_ORDER.length ? 'ok' : null);
      r('r5', 'Physical defenses', 'Barriers + mechanical');
      r('r6', 'Chemical defenses', 'Always present + induced');
      note ||= p
        ? `${p.name} (${p.kind}): ${p.text}`
        : threeFailed
          ? '3D graphics are not available in this browser. The Pathogen and Insect views still work.'
          : 'Rotate the plant and tap a structure, or choose one from the list to zoom in on it. Start spins the plant.';
      sim.setBadge(`Explored ${explored.size}/${PART_ORDER.length}`);
    } else if (st.view === 'pathogen') {
      const inside = pz.bugs.filter((b) => b.inside && !b.dead).length + pz.spores.filter((s) => s.stage === 'in').length;
      const dis = diseased();
      r('r1', 'Pathogens inside', `${inside}${st.pathogen === 'bacteria' ? ' bacteria' : ' fungal hyphae'}`, inside > 30 ? 'bad' : null);
      r('r2', 'Stomata', `${pct(pz.ap)} open`, pz.ap < 0.4 ? 'ok' : null);
      r('r3', 'PTI', `${pct(pz.pti)}${effActive() ? ' (suppressed by effectors)' : ''}`, effActive() ? 'warn' : null);
      r('r4', 'ETI and HR', pz.hr > 0 || pz.eti > 0.05 ? `${pz.eti > 0.05 ? 'Active' : 'Done'} · ${pz.hr} cell${pz.hr === 1 ? '' : 's'} died` : st.effectors && st.rgene ? 'Ready' : 'Off');
      r('r5', 'Diseased tissue', pct(dis), dis > 0.2 ? 'bad' : dis > 0.05 ? 'warn' : null);
      r('r6', 'Systemic resistance', pz.sa > 0.05 ? `SA ${pct(pz.sa)} · leaves ${pct(pz.spread)}` : '—');
      note ||= `${PATHOGENS[st.pathogen].entry} Drag microbes onto the leaf or press “Inoculate the leaf”.`;
      sim.setBadge(`Disease ${pct(dis)}`);
      canvas.setAttribute('aria-label', `Leaf cross-section: ${inside} pathogens inside, stomata ${pct(pz.ap)} open, PTI ${pct(pz.pti)}, ${pz.hr} cells in the hypersensitive response, ${pct(dis)} of tissue diseased.`);
    } else {
      const eaten = hz.leaves.reduce((a, l) => a + l.eaten, 0) / NL;
      const src = hz.leaves.reduce((a, l, i) => (l.ja > hz.leaves[a].ja ? i : a), 0);
      const others = hz.leaves.filter((_, i) => i !== src);
      const otherJa = others.reduce((a, l) => a + l.ja, 0) / others.length;
      const otherTox = others.reduce((a, l) => a + l.tox, 0) / others.length;
      r('r1', 'Leaf area eaten', `${pct(eaten)} (healthy 0%)`, eaten > 0.15 ? 'bad' : null);
      r('r2', 'Herbivores feeding', String(feeding().length));
      r('r3', 'Jasmonate', `damaged leaf ${pct(hz.leaves[src].ja)} · others ${pct(otherJa)}`);
      r('r4', 'Toxins in other leaves', `${pct(otherTox)} (healthy ${pct(0.05 * st.defense)})`, otherTox > 0.3 ? 'ok' : null);
      r('r5', 'Parasitic wasps attracted', String(hz.waspN));
      r('r6', 'Left or trapped', `${hz.off} left · ${hz.trapped} trapped`);
      note ||=
        st.herb === 'caterpillar'
          ? 'Drag a caterpillar onto a leaf. Chewing wounds the leaf and triggers jasmonate signalling: toxins build up, first in the damaged leaf, then in distant leaves, and volatiles call in parasitic wasps.'
          : 'Drag aphids onto a leaf. They suck phloem sap with little wounding, so they trigger a weaker jasmonate response; sticky glandular trichomes can trap them.';
      sim.setBadge(`Eaten ${pct(eaten)}`);
      canvas.setAttribute('aria-label', `Insect attack: ${pct(eaten)} of leaf area eaten, ${feeding().length} herbivores feeding, ${hz.waspN} wasps attracted.`);
    }
    if (noteEl.textContent !== note) noteEl.textContent = note;
  }

  /* ======================= 3D plant ======================= */
  let three: ThreeScene | null = null;
  let threeFailed = false;
  let loading3D = false;
  let positionLabels = () => {};
  let highlight = () => {};
  let focusPart = (_id: PartId | null) => {};
  let plantGroup: T.Group | null = null;
  async function ensure3D() {
    if (three || threeFailed || loading3D) return;
    loading3D = true;
    sim.setLoading('Loading the 3D plant…');
    try {
      const asp = container.clientWidth / Math.max(1, container.clientHeight);
      const back = clamp(Math.pow(asp, -1.1), 1, 1.8);
      three = await createThreeScene(container, {
        label: 'A 3D plant with prickles, a thorn, hairy leaves, bark and roots, beside a cactus. Drag to rotate, tap a structure to inspect it.',
        camera: { position: [2.0 * back, 0.8 + 1.9 * back, 2.6 * back], target: [0.15, 0.8, 0] },
        minDistance: 0.5,
        maxDistance: 10,
        onFrame: (dt) => {
          if (plantGroup) plantGroup.rotation.y += dt * 0.35;
          positionLabels();
        },
      });
      build3D(three);
    } catch (err) {
      console.error(err);
      threeFailed = true;
      container.innerHTML = '<p class="df-no3d">3D graphics are not available in this browser, so the 3D plant cannot be shown. Choose Pathogen attack or Insect attack above.</p>';
    } finally {
      loading3D = false;
      sim.setLoading(null);
      if (st.view === '3d') three?.setAnimating(sim.running && !prefersReducedMotion());
      sim.requestRender();
    }
  }
  function build3D(view: ThreeScene) {
    const { THREE, scene } = view;
    const plant = new THREE.Group();
    plantGroup = plant;
    scene.add(plant);
    const groups: Partial<Record<PartId, T.Mesh[]>> = {};
    const mat = (c: string, extra: Partial<T.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.7, metalness: 0, ...extra });
    const add = (id: PartId | null, mesh: T.Mesh, parent: T.Object3D = plant) => {
      if (id) {
        mesh.userData.part = id;
        (groups[id] ??= []).push(mesh);
      }
      parent.add(mesh);
      return mesh;
    };
    const sphere = new THREE.SphereGeometry(1, 24, 16);
    // soil disc
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 40), mat('#6d4c41', { transparent: true, opacity: 0.45, depthWrite: false }));
    soil.position.y = -0.03;
    plant.add(soil);
    // stem, with bark at the base
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.2, 14), mat('#5c940d'));
    stem.position.y = 1.1;
    plant.add(stem);
    const bark = add('bark', new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.62, 14), mat('#7a5230', { roughness: 1 })));
    bark.position.y = 0.31;
    for (let k = 0; k < 10; k++) {
      const ridge = add('bark', new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), mat('#5c3d2e')));
      const a = (k / 10) * Math.PI * 2;
      ridge.position.set(Math.cos(a) * 0.085, 0.32, Math.sin(a) * 0.085);
    }
    // prickles
    const cone = new THREE.ConeGeometry(0.025, 0.11, 8);
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4;
      const y = 0.7 + k * 0.1;
      const p = add('prickle', new THREE.Mesh(cone, mat('#a07850')));
      p.position.set(Math.cos(a) * 0.08, y, Math.sin(a) * 0.08);
      p.lookAt(Math.cos(a) * 2, y - 0.4, Math.sin(a) * 2);
      p.rotateX(Math.PI / 2);
    }
    // a thorn: a short side shoot ending in a sharp point
    const thorn = add('thorn', new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.42, 10), mat('#6b4f2a')));
    thorn.position.set(-0.2, 1.38, 0.05);
    thorn.rotation.z = Math.PI / 2.6;
    // leaves with trichomes
    const hair = new THREE.CylinderGeometry(0.004, 0.006, 0.05, 4);
    const hairMat = mat('#f8f9fa');
    const gland = new THREE.SphereGeometry(0.012, 6, 6);
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.position.y = 0.9 + i * 0.24;
      pivot.rotation.y = i * 2.4;
      plant.add(pivot);
      const leaf = add('cuticle', new THREE.Mesh(sphere, mat('#51cf66', { roughness: 0.55 })), pivot);
      leaf.scale.set(0.34 - i * 0.02, 0.02, 0.17);
      leaf.position.set(0.38, 0.04, 0);
      leaf.rotation.z = 0.2;
      for (let k = 0; k < 18; k++) {
        const u = (k % 9) / 8;
        const side = k < 9 ? 1 : -1;
        const hx = 0.12 + u * 0.48;
        const w = Math.sin(u * Math.PI) * 0.1 * side;
        const h = add('trichome', new THREE.Mesh(k % 6 === 0 ? gland : hair, hairMat), pivot);
        h.position.set(hx, 0.04 + (hx - 0.38) * Math.tan(0.2) + 0.035, w * 1.2);
      }
    }
    // roots
    const rootMat = mat('#e9d8a6');
    const main = add('root', new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.012, 1, 10), rootMat));
    main.position.y = -0.52;
    for (let k = 0; k < 6; k++) {
      const lat = add('root', new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.006, 0.5, 6), rootMat));
      const a = k * 1.9;
      lat.position.set(Math.cos(a) * 0.17, -0.25 - k * 0.11, Math.sin(a) * 0.17);
      lat.lookAt(Math.cos(a) * 3, -1.2 - k * 0.2, Math.sin(a) * 3);
      lat.rotateX(Math.PI / 2);
    }
    // cactus with spines, beside the plant
    const cactus = add('spine', new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.8, 8), mat('#2f9e44', { flatShading: true })));
    cactus.position.set(0.95, 0.4, 0.55);
    const dome = add('spine', new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2f9e44', { flatShading: true })));
    dome.position.set(0.95, 0.8, 0.55);
    for (let k = 0; k < 32; k++) {
      const a = (k % 8) * (Math.PI / 4);
      const y = 0.12 + Math.floor(k / 8) * 0.2;
      const sp = add('spine', new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.17, 4), mat('#fff3bf')));
      sp.position.set(0.95 + Math.cos(a) * 0.2, y, 0.55 + Math.sin(a) * 0.2);
      sp.lookAt(0.95 + Math.cos(a) * 3, y, 0.55 + Math.sin(a) * 3);
      sp.rotateX(Math.PI / 2);
    }

    highlight = () => {
      for (const [id, list] of Object.entries(groups) as [PartId, T.Mesh[]][])
        for (const m of list) {
          const mm = m.material as T.MeshStandardMaterial;
          mm.emissive?.setHex(id === selected ? 0x553311 : 0x000000);
        }
      view.requestRender();
    };
    // labels
    const layer = document.createElement('div');
    layer.className = 'earth-labels';
    layer.setAttribute('aria-hidden', 'true');
    container.appendChild(layer);
    const labels = PART_ORDER.map((id) => {
      const el = document.createElement('span');
      el.textContent = PARTS[id].name;
      layer.appendChild(el);
      return { id, el };
    });
    const tmp = new THREE.Vector3();
    const centre = (id: PartId) => {
      const v = new THREE.Vector3();
      const list = groups[id] ?? [];
      for (const m of list) v.add(m.getWorldPosition(tmp));
      return v.multiplyScalar(1 / Math.max(1, list.length));
    };
    positionLabels = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const l of labels) {
        const c = centre(l.id);
        if (l.id === 'cuticle') (groups.cuticle?.[2] ?? groups.cuticle?.[0])?.getWorldPosition(c);
        c.project(view.camera);
        l.el.style.display = c.z < 1 && (st.labels || l.id === selected) ? '' : 'none';
        l.el.style.transform = `translate(${((c.x + 1) / 2) * w}px, ${((1 - c.y) / 2) * h}px) translate(-50%, -50%)`;
        l.el.style.outline = l.id === selected ? '2px solid var(--accent)' : '';
      }
    };
    view.controls.addEventListener('change', positionLabels);
    // zoom the camera to a structure (or back to the whole plant)
    const home = { pos: view.camera.position.clone(), target: view.controls.target.clone() };
    let anim = 0;
    focusPart = (id) => {
      const target = id ? centre(id) : home.target.clone();
      const dist = id === 'trichome' || id === 'cuticle' ? 0.9 : id === 'prickle' || id === 'thorn' ? 1.1 : id ? 1.5 : 0;
      const dir = view.camera.position.clone().sub(view.controls.target).normalize();
      const pos = id ? target.clone().add(dir.multiplyScalar(dist)) : home.pos.clone();
      const p0 = view.camera.position.clone();
      const t0 = view.controls.target.clone();
      const start = performance.now();
      cancelAnimationFrame(anim);
      const tick = () => {
        const u = Math.min(1, (performance.now() - start) / 700);
        const e = u * u * (3 - 2 * u);
        view.camera.position.lerpVectors(p0, pos, e);
        view.controls.target.lerpVectors(t0, target, e);
        view.controls.update();
        positionLabels();
        view.requestRender();
        if (u < 1) anim = requestAnimationFrame(tick);
      };
      tick();
    };
    view.onPick(
      () => plant.children,
      (hit, at) => {
        let o: T.Object3D | null = hit?.object ?? null;
        while (o && !o.userData.part) o = o.parent;
        const id = o?.userData.part as PartId | undefined;
        if (!id) {
          sim.hideTooltip();
          return;
        }
        select(id, false);
        sim.showTooltip(at.x, at.y, PARTS[id].name, `${PARTS[id].kind}. ${PARTS[id].text}`);
      },
    );
    highlight();
    positionLabels();
  }
  function select(id: PartId | null, zoom: boolean) {
    selected = id;
    pick.value = id ?? '';
    if (id) explored.add(id);
    lastMsg = '';
    highlight();
    if (zoom) {
      if (id && sim.running) sim.pause();
      focusPart(id);
    }
    positionLabels();
    sim.requestRender();
  }
  pick.addEventListener('change', () => select((pick.value as PartId) || null, true));
  root.querySelector('[data-whole]')?.addEventListener('click', () => select(null, true));

  /* ======================= Controls ======================= */
  const ui = controls(root);
  function showView() {
    root.dataset.dfView = st.view === '3d' ? '3d' : '2d';
    ui.showWhen('[data-only="3d"]', st.view === '3d');
    ui.showWhen('[data-only="2d"]', st.view !== '3d');
    ui.showWhen('[data-only="pathogen"]', st.view === 'pathogen');
    ui.showWhen('[data-only="insect"]', st.view === 'insect');
    if (st.view === '3d') {
      void ensure3D();
      three?.setAnimating(sim.running && !prefersReducedMotion());
      positionLabels();
    } else three?.setAnimating(false);
  }
  const viewCtl = ui.choice<View>('df-view', (v) => {
    st.view = v;
    lastMsg = '';
    sim.hideTooltip();
    showView();
    if (v !== '3d' && !sim.running) sim.play();
    sim.requestRender();
  });
  const threatCtl = ui.range('df-threat', (v) => `${v}`, (v) => ((st.threat = v), sim.requestRender()));
  const defCtl = ui.range('df-defense', (v) => `${v}%`, (v) => ((st.defense = v / 100), sim.requestRender()));
  const pathCtl = ui.choice<PathogenId>('df-pathogen', (v) => {
    st.pathogen = v;
    clearLeaf(false);
    lastMsg = '';
    sim.requestRender();
  });
  const effCtl = ui.toggle('df-effectors', (v) => {
    st.effectors = v;
    lastMsg = v
      ? 'This strain is adapted to the plant: it injects effectors that suppress pattern-triggered immunity.'
      : 'A non-adapted strain with no effectors: pattern-triggered immunity alone usually stops it.';
    sim.requestRender();
  });
  const rCtl = ui.toggle('df-rgene', (v) => {
    st.rgene = v;
    lastMsg = v
      ? 'The plant now has a resistance (R) protein that recognises this pathogen’s effector, which triggers ETI and the hypersensitive response.'
      : 'No matching R protein: the effectors go unrecognised.';
    sim.requestRender();
  });
  const woundCtl = ui.toggle('df-wound', (v) => ((st.wound = v), sim.requestRender()));
  const labelCtl = ui.toggle('df-labels', (v) => ((st.labels = v), positionLabels(), sim.requestRender()));
  root.querySelector('[data-inoculate]')?.addEventListener('click', () => {
    inoculate();
    lastMsg = '';
    if (!sim.running) sim.play();
  });
  root.querySelector('[data-reinfect]')?.addEventListener('click', () => {
    clearLeaf(true);
    inoculate();
    lastMsg =
      pz.primed > 0.05
        ? `A new leaf is infected. Systemic acquired resistance has primed it (${pct(pz.primed)}), so its defenses switch on faster and stronger.`
        : 'A new leaf is infected. No systemic acquired resistance yet, so it starts unprimed.';
    if (!sim.running) sim.play();
  });
  const herbCtl = ui.choice<Herb>('df-herb', (v) => {
    st.herb = v;
    lastMsg = '';
    sim.requestRender();
  });
  const jaCtl = ui.toggle('df-ja', (v) => {
    st.ja = v;
    lastMsg = v ? 'Jasmonate signalling restored: damage now switches on induced defenses.' : 'Jasmonate signalling off, like a mutant that cannot make jasmonic acid: damage no longer induces toxins or volatiles.';
    sim.requestRender();
  });
  const trichCtl = ui.toggle('df-trich', (v) => ((st.trich = v), sim.requestRender()));
  const sigCtl = ui.toggle('df-signals', (v) => ((st.signals = v), sim.requestRender()));
  root.querySelector('[data-addherb]')?.addEventListener('click', () => {
    const n = Math.ceil(st.threat / 2);
    for (let i = 0; i < n; i++) addHerb(Math.floor(Math.random() * NL));
    lastMsg = '';
    if (!sim.running) sim.play();
  });
  root.querySelector('[data-clearplant]')?.addEventListener('click', () => {
    clearPlant();
    sim.requestRender();
  });
  root.querySelector('[data-step]')?.addEventListener('click', () => {
    sim.pause();
    for (let i = 0; i < 25; i++) step(0.02);
    sim.requestRender();
  });

  /* ======================= Pointer ======================= */
  const toBox = (x: number, y: number): Pt => {
    const { k, ox, oy } = tf();
    return [(x - ox) / k, (y - oy) / k];
  };
  const toLeaf = ([bx, by]: Pt): Pt => [(bx - leafFrame.x) / leafFrame.s, (by - leafFrame.y) / leafFrame.s];
  let drag: { type: Herb | PathogenId; x: number; y: number } | null = null;
  enableDrag<'item'>(canvas, {
    hit(x, y) {
      const b = toBox(x, y);
      if (st.view === 'pathogen') {
        const [lx, ly] = toLeaf(b);
        return lx >= 10 && lx <= 210 && ly >= 12 && ly <= 76 ? 'item' : null;
      }
      if (st.view === 'insect') {
        const T = insLayout().tray;
        return b[0] >= T.x && b[0] <= T.x + T.w && b[1] >= T.y && b[1] <= T.y + T.h ? 'item' : null;
      }
      return null;
    },
    start(_id, x, y) {
      sim.hideTooltip();
      const [bx, by] = toBox(x, y);
      drag = { type: st.view === 'pathogen' ? st.pathogen : st.herb, x: bx, y: by };
    },
    move(_id, x, y) {
      const [bx, by] = toBox(x, y);
      if (drag) Object.assign(drag, { x: bx, y: by });
      sim.requestRender();
    },
    end() {
      if (!drag) return;
      if (st.view === 'pathogen') {
        const [lx, ly] = toLeaf([drag.x, drag.y]);
        if (lx > 0 && lx < 620 && ly > 60 && ly < 560) {
          inoculate(lx);
          const where = Math.abs(lx - STOMA_X) < 40 ? 'right by a stoma' : st.wound && Math.abs(lx - WOUND_X) < 40 ? 'on the wound' : 'on the waxy cuticle';
          lastMsg = `${st.pathogen === 'bacteria' ? 'Bacteria' : 'Fungal spores'} landed ${where}. ${PATHOGENS[st.pathogen].entry}`;
          if (!sim.running) sim.play();
        }
      } else {
        const L = insLayout();
        let best = -1;
        let bd = 1e9;
        for (let i = 0; i < NL; i++) {
          const n = leafNode(i);
          const lx = L.x + n.side * 70;
          const d = Math.hypot(drag.x - lx, drag.y - n.y);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        const onStem = Math.abs(drag.x - L.x) < 20 && drag.y > L.top && drag.y < L.ground;
        if (bd < 90 || onStem) {
          addHerb(best);
          lastMsg = onStem
            ? `The ${st.herb} climbs past the prickles to leaf ${best + 1}: prickles deter large grazing animals, not small insects.`
            : `A ${st.herb} starts feeding on leaf ${best + 1}.${st.trich ? (st.herb === 'caterpillar' ? ' The leaf hairs slow it down.' : ' Sticky glandular hairs may trap it.') : ''}`;
          if (!sim.running) sim.play();
        }
      }
      drag = null;
      sim.requestRender();
    },
    click(x, y) {
      const [bx, by] = toBox(x, y);
      for (let i = areas.length - 1; i >= 0; i--)
        if (areas[i].test(bx, by)) {
          sim.showTooltip(x, y, areas[i].title, areas[i].text());
          return;
        }
      sim.hideTooltip();
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    onPlayChange(on) {
      if (st.view === '3d') three?.setAnimating(on && !prefersReducedMotion());
    },
    reset() {
      Object.assign(st, { threat: 4, defense: 1, pathogen: 'bacteria', effectors: true, rgene: false, wound: false, herb: 'caterpillar', ja: true, trich: true, signals: true, labels: false });
      threatCtl.set(4, false);
      defCtl.set(100, false);
      pathCtl.set('bacteria', false);
      effCtl.set(true, false);
      rCtl.set(false, false);
      woundCtl.set(false, false);
      herbCtl.set('caterpillar', false);
      jaCtl.set(true, false);
      trichCtl.set(true, false);
      sigCtl.set(true, false);
      labelCtl.set(false, false);
      viewCtl.set(st.view, false);
      clearLeaf(false);
      clearPlant();
      explored.clear();
      select(null, true);
      lastMsg = '';
      showView();
    },
  });

  showView();
  sim.requestRender();
}
