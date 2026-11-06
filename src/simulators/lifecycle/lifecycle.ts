/**
 * Animal reproduction and life cycles, in three views:
 *   cycle  – stage-by-stage life cycles of a butterfly, grasshopper, frog and chicken
 *   dev    – fertilisation and early development, step by step
 *   repro  – a sexual vs asexual population model, and where embryos develop
 *
 * Sexual vs asexual model (illustrative). Each individual has two genes with
 * three variants (nine types, shown as colours). Every generation, each
 * reproducing female leaves offspring: asexual females make clones,
 * while sexual females need a male, and each offspring gets one variant of
 * each gene from a random parent (with a small mutation rate), and half are
 * male. Every female has three offspring, so clones triple each generation while
 * the half-male sexual population grows 1.5× (the "twofold cost of sex"). Space is limited, so random individuals die when the population is
 * full. A disease outbreak strikes the most common type (as parasites tend to
 * adapt to the commonest hosts) and kills most of its members.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { BIRTH, DEV_STEPS, SPECIES, type BirthId, type SpeciesId, type StageArt } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'sim-water', 'surface-2'] as const;
type Fs = (px: number, w?: number) => string;
type View = 'cycle' | 'dev' | 'repro';
const GENO = ['#e03131', '#f08c00', '#fab005', '#40c057', '#12b886', '#15aabf', '#4c6ef5', '#7950f2', '#e64980'];
const CAP = 110;
const DEF = { view: 'cycle' as View, species: 'butterfly' as SpeciesId, stage: 0, dev: 0, internal: false, birth: 'ovi' as BirthId };

interface Ind {
  g: [number, number];
  male: boolean;
  x: number;
  y: number;
}

export function initLifeCycle(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const stagesEl = root.querySelector<HTMLElement>('[data-stages]')!;
  const devEl = root.querySelector<HTMLElement>('[data-devsteps]')!;

  const st = { ...DEF };
  let t = 0;
  let tween = 1; // 0 → 1 after a stage change, for a smooth transition
  let autoTimer = 0;
  let gen = 0;
  let asex: Ind[] = [];
  let sex: Ind[] = [];
  let history: { a: number; s: number }[] = [];
  let lastOutbreak = '';
  let genTimer = 0;

  const SP = () => SPECIES[st.species];

  /* ---------- Population model ---------- */
  const typeOf = (i: Ind) => i.g[0] * 3 + i.g[1];
  /** Positions are stored as fractions of the panel, so they survive layout changes. */
  function place(i: Ind, _left: boolean) {
    i.x = Math.random();
    i.y = Math.random();
    return i;
  }
  function resetPop() {
    gen = 0;
    asex = Array.from({ length: 4 }, () => place({ g: [0, 0], male: false, x: 0, y: 0 }, true));
    const founders: [number, number][] = [[0, 0], [1, 2], [2, 1], [0, 1], [1, 0], [2, 2], [0, 2], [1, 1]];
    sex = founders.map((g, n) => place({ g, male: n % 2 === 1, x: 0, y: 0 }, false));
    history = [{ a: asex.length, s: sex.length }];
    lastOutbreak = '';
  }
  const mutate = (v: number) => (Math.random() < 0.005 ? Math.floor(Math.random() * 3) : v);
  function generation() {
    gen++;
    // asexual: every individual is a female that leaves two clones
    const na: Ind[] = [];
    for (const p of asex) for (let k = 0; k < 3; k++) na.push(place({ g: [mutate(p.g[0]), mutate(p.g[1])], male: false, x: 0, y: 0 }, true));
    // sexual: each female mates with a random male and leaves two offspring
    const males = sex.filter((i) => i.male);
    const ns: Ind[] = [];
    if (males.length)
      for (const f of sex.filter((i) => !i.male))
        for (let k = 0; k < 3; k++) {
          const m = males[Math.floor(Math.random() * males.length)];
          const g: [number, number] = [mutate(Math.random() < 0.5 ? f.g[0] : m.g[0]), mutate(Math.random() < 0.5 ? f.g[1] : m.g[1])];
          ns.push(place({ g, male: Math.random() < 0.5, x: 0, y: 0 }, false));
        }
    // limited space: random deaths when full
    const cull = (a: Ind[]) => {
      while (a.length > CAP) a.splice(Math.floor(Math.random() * a.length), 1);
      return a;
    };
    asex = cull(na);
    sex = cull(ns);
    history.push({ a: asex.length, s: sex.length });
    if (history.length > 30) history.shift();
  }
  function outbreak() {
    const hit = (pop: Ind[]) => {
      if (!pop.length) return 0;
      const counts = new Map<number, number>();
      for (const i of pop) counts.set(typeOf(i), (counts.get(typeOf(i)) ?? 0) + 1);
      const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const before = pop.length;
      for (let i = pop.length - 1; i >= 0; i--) if (typeOf(pop[i]) === common && Math.random() < 0.95) pop.splice(i, 1);
      return before - pop.length;
    };
    const ka = hit(asex);
    const ks = hit(sex);
    lastOutbreak = `Disease outbreak: it killed ${ka} of the clones and ${ks} of the sexual population.`;
    history.push({ a: asex.length, s: sex.length });
    sim.announce(lastOutbreak);
  }
  const variety = (pop: Ind[]) => new Set(pop.map(typeOf)).size;

  /* ---------- Time ---------- */
  function step(dt: number) {
    t += dt;
    tween = Math.min(1, tween + dt * 1.6);
    if (st.view === 'cycle') {
      autoTimer += dt;
      if (autoTimer > 3.2) {
        autoTimer = 0;
        goStage((st.stage + 1) % SP().stages.length);
      }
    } else if (st.view === 'dev') {
      autoTimer += dt;
      if (autoTimer > 3.2) {
        autoTimer = 0;
        if (st.dev < DEV_STEPS.length - 1) goDev(st.dev + 1);
        else sim.pause();
      }
    } else {
      genTimer += dt;
      if (genTimer > 1.1) {
        genTimer = 0;
        generation();
        updateUi();
      }
      // gentle jiggle
      for (const i of [...asex, ...sex]) (i.x = clamp(i.x + (Math.random() - 0.5) * 0.06 * dt, 0, 1)), (i.y = clamp(i.y + (Math.random() - 0.5) * 0.06 * dt, 0, 1));
    }
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1090] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  type Rect = { x: number; y: number; w: number; h: number };
  function popR(left: boolean): Rect {
    return portrait() ? { x: 10, y: left ? 40 : 330, w: 660, h: 280 } : { x: left ? 10 : 320, y: 40, w: 300, h: 330 };
  }

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];

  /* ---------- Stage drawings (all centred at 0,0, roughly 200 × 160 units) ---------- */
  function art(a: StageArt) {
    const c = ctx;
    const wob = Math.sin(t * 3) * 0.03;
    const ell = (x: number, y: number, rx: number, ry: number, fill: string, rot = 0) => {
      c.fillStyle = fill;
      c.beginPath();
      c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      c.fill();
    };
    const line = (pts: [number, number][], stroke: string, w = 3) => {
      c.strokeStyle = stroke;
      c.lineWidth = w;
      c.lineCap = 'round';
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    };
    const leaf = () => {
      c.fillStyle = withAlpha('#40c057', 0.35);
      c.beginPath();
      c.ellipse(0, 40, 110, 40, -0.15, 0, Math.PI * 2);
      c.fill();
    };
    switch (a) {
      case 'bf-egg':
        leaf();
        ell(0, 10, 16, 22, '#fff3bf');
        for (let i = -2; i <= 2; i++) line([[i * 5, -10], [i * 6, 30]], '#e9d48a', 1.5);
        break;
      case 'bf-larva': {
        leaf();
        for (let i = 0; i < 9; i++) {
          const x = -80 + i * 20;
          const y = 10 + Math.sin(t * 4 + i * 0.8) * 4;
          ell(x, y, 13, 16, i % 2 ? '#212529' : '#f8f9fa');
          line([[x - 10, y - 4], [x + 10, y - 4]], '#fab005', 4);
        }
        line([[-88, -6], [-96, -26]], '#212529', 2.5);
        line([[-78, -6], [-82, -26]], '#212529', 2.5);
        break;
      }
      case 'bf-pupa':
        line([[0, -80], [0, -62]], '#495057', 3);
        ell(0, -10, 30 + wob * 20, 52, '#69db7c');
        for (const [x, y] of [[-12, -40], [0, -42], [12, -40], [-18, 10], [18, 10]] as [number, number][]) ell(x, y, 3.2, 3.2, '#fab005');
        line([[-24, -34], [24, -34]], '#2b8a3e', 2);
        break;
      case 'bf-adult': {
        const flap = 0.75 + 0.25 * Math.sin(t * 6);
        c.save();
        for (const s of [-1, 1]) {
          c.save();
          c.scale(s * flap, 1);
          ell(40, -28, 52, 40, '#f76707', -0.4);
          ell(32, 30, 36, 30, '#f76707', 0.5);
          line([[8, -10], [70, -50]], '#212529', 3);
          line([[8, 0], [55, 35]], '#212529', 3);
          c.restore();
        }
        c.restore();
        ell(0, 0, 7, 46, '#212529');
        line([[0, -44], [-14, -78]], '#212529', 2);
        line([[0, -44], [14, -78]], '#212529', 2);
        break;
      }
      case 'gh-egg':
        c.fillStyle = withAlpha('#8d6e63', 0.4);
        c.fillRect(-110, 10, 220, 70);
        ell(0, 40, 26, 22, '#d9c7a6');
        for (let i = 0; i < 7; i++) ell(-12 + (i % 4) * 8, 32 + Math.floor(i / 4) * 12, 3.5, 5.5, '#f1e3c7');
        break;
      case 'gh-nymph':
      case 'gh-adult': {
        const s = a === 'gh-nymph' ? 0.6 : 1;
        c.save();
        c.scale(s, s);
        ell(10, 0, 70, 20, '#74b816');
        ell(-62, -8, 22, 20, '#74b816');
        ell(-68, -12, 4, 4, '#212529');
        if (a === 'gh-adult') ell(20, -16, 66, 14, withAlpha('#5c940d', 0.9), -0.05);
        else ell(-10, -14, 16, 6, '#5c940d', -0.2);
        line([[20, 12], [60, -30], [95, 30]], '#5c940d', 6);
        line([[-30, 14], [-36, 40]], '#5c940d', 3);
        line([[-10, 14], [-6, 40]], '#5c940d', 3);
        line([[-70, -26], [-110, -70]], '#5c940d', 2);
        c.restore();
        break;
      }
      case 'fr-spawn':
        c.fillStyle = withAlpha('#a5d8ff', 0.3);
        c.fillRect(-120, -80, 240, 160);
        for (let i = 0; i < 30; i++) {
          const x = -80 + (i % 6) * 32 + (Math.floor(i / 6) % 2) * 16;
          const y = -60 + Math.floor(i / 6) * 28;
          ell(x, y, 13, 13, withAlpha('#e7f5ff', 0.85));
          ell(x, y, 4.5, 4.5, '#212529');
        }
        break;
      case 'fr-tadpole':
      case 'fr-legs':
      case 'fr-froglet': {
        c.fillStyle = withAlpha('#a5d8ff', 0.3);
        c.fillRect(-120, -80, 240, 160);
        const tail = a === 'fr-froglet' ? 0.3 : 1;
        const sw = Math.sin(t * 7) * 10 * tail;
        c.fillStyle = '#495057';
        c.beginPath();
        c.moveTo(-10, -10);
        c.quadraticCurveTo(40, -18 + sw, 40 + 70 * tail, sw);
        c.quadraticCurveTo(40, 18 + sw, -10, 10);
        c.fill();
        ell(-36, 0, 38, 30, a === 'fr-froglet' ? '#5c940d' : '#343a40');
        ell(-58, -10, 4, 4, '#f8f9fa');
        if (a !== 'fr-tadpole') {
          line([[-12, 18], [10, 38], [-4, 52]], a === 'fr-froglet' ? '#5c940d' : '#343a40', 5);
        }
        if (a === 'fr-froglet') line([[-50, 22], [-60, 44]], '#5c940d', 5);
        break;
      }
      case 'fr-adult':
        ell(0, 10, 70, 46, '#5c940d');
        ell(-46, -24, 14, 14, '#5c940d');
        ell(20, -24, 14, 14, '#5c940d');
        ell(-46, -26, 6, 6, '#212529');
        ell(20, -26, 6, 6, '#212529');
        line([[40, 30], [90, 52], [70, 60]], '#5c940d', 9);
        line([[-40, 40], [-60, 62]], '#5c940d', 6);
        break;
      case 'ch-egg':
      case 'ch-embryo':
      case 'ch-hatch': {
        ell(0, 0, 70, 90, '#fff4e6');
        c.strokeStyle = '#e8c39e';
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(0, 0, 70, 90, 0, 0, Math.PI * 2);
        c.stroke();
        if (a === 'ch-hatch') {
          line([[-40, -30], [-25, -42], [-10, -28], [6, -44], [20, -30], [40, -40]], '#495057', 2.5);
          ell(0, -50, 28, 22, '#ffd43b');
          ell(-8, -56, 3, 3, '#212529');
          c.fillStyle = '#f08c00';
          c.beginPath();
          c.moveTo(-26, -52);
          c.lineTo(-38, -48);
          c.lineTo(-26, -44);
          c.fill();
          break;
        }
        ell(0, 18, 46, 48, '#ffd43b');
        if (a === 'ch-egg') ell(0, -26, 9, 6, '#f8f9fa');
        else {
          c.strokeStyle = '#e03131';
          c.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) {
            c.beginPath();
            c.moveTo(0, -10);
            c.quadraticCurveTo(-40 + i * 16, 0, -44 + i * 18, 40);
            c.stroke();
          }
          ell(0, -18, 22, 16, '#ffc9c9');
          ell(-8, -22, 5, 5, '#495057');
        }
        break;
      }
      case 'ch-chick':
        ell(0, 10, 46, 40, '#ffd43b');
        ell(-30, -30, 26, 24, '#ffd43b');
        ell(-38, -36, 3.5, 3.5, '#212529');
        c.fillStyle = '#f08c00';
        c.beginPath();
        c.moveTo(-54, -32);
        c.lineTo(-70, -27);
        c.lineTo(-54, -22);
        c.fill();
        line([[0, 48], [0, 70]], '#f08c00', 4);
        line([[16, 46], [16, 70]], '#f08c00', 4);
        break;
      case 'ch-adult':
        ell(10, 10, 70, 52, '#c2410c');
        ell(-52, -38, 26, 26, '#c2410c');
        c.fillStyle = '#e03131';
        c.beginPath();
        c.arc(-60, -66, 10, 0, Math.PI * 2);
        c.arc(-48, -68, 9, 0, Math.PI * 2);
        c.fill();
        ell(-62, -40, 3.5, 3.5, '#212529');
        c.fillStyle = '#f08c00';
        c.beginPath();
        c.moveTo(-76, -38);
        c.lineTo(-94, -32);
        c.lineTo(-76, -26);
        c.fill();
        ell(74, -10, 20, 34, '#7c2d12', 0.5);
        line([[0, 60], [-4, 90]], '#f08c00', 5);
        line([[24, 60], [28, 90]], '#f08c00', 5);
        break;
    }
  }

  /* ---------- View: life cycle ---------- */
  function drawCycle(fs: Fs, k: number) {
    const sp = SP();
    const n = sp.stages.length;
    const P = portrait();
    const cx = P ? 340 : 300;
    const cy = P ? 305 : 305;
    const R = P ? 200 : 215;
    // the cycle ring
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / k;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // arrows between stages
    const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = (angle(i) + angle(i + 1)) / 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = pal['text-muted'];
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -7);
      ctx.lineTo(-6, 7);
      ctx.fill();
      ctx.restore();
    }
    // stage nodes
    for (let i = 0; i < n; i++) {
      const s = sp.stages[i];
      const x = cx + Math.cos(angle(i)) * R;
      const y = cy + Math.sin(angle(i)) * R;
      const on = i === st.stage;
      ctx.fillStyle = on ? withAlpha(pal.accent, 0.2) : pal['bg-elev'];
      ctx.strokeStyle = on ? pal.accent : pal.border;
      ctx.lineWidth = (on ? 3 : 1.5) / k;
      ctx.beginPath();
      ctx.arc(x, y, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.3, 0.3);
      art(s.art);
      ctx.restore();
      ctx.font = fs(10.5, on ? 750 : 600);
      ctx.fillStyle = on ? pal['sim-text'] : pal['text-muted'];
      ctx.textAlign = 'center';
      const below = Math.sin(angle(i)) > -0.3;
      ctx.fillText(s.name.split(' (')[0], x, y + (below ? 46 + 16 / k : -46 - 8 / k));
      areas.push({ test: (px, py) => Math.hypot(px - x, py - y) < 48, title: s.name, text: () => `${s.text} Typical duration: ${s.duration}.`, });
      stageHits.push({ i, x, y });
    }
    // the current stage, large, in the middle
    const s = sp.stages[st.stage];
    ctx.save();
    ctx.translate(cx, cy);
    const sc = 0.8 * (0.85 + 0.15 * tween);
    ctx.globalAlpha = tween;
    ctx.scale(sc, sc);
    art(s.art);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = fs(13, 750);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText(`${st.stage + 1}. ${s.name}`, cx, cy + 92);
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-muted'];
    ctx.fillText(s.duration, cx, cy + 92 + 18 / k);

    // right panel: survival from egg to adult, and the type of development
    const px = P ? 30 : 600;
    const py = P ? 590 : 86;
    const pw = P ? 620 : 380;
    ctx.textAlign = 'left';
    ctx.font = fs(11.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`From ${sp.start.toLocaleString('en')} eggs to adults (illustrative)`, px, py);
    const max = sp.start;
    sp.stages.forEach((sg, i) => {
      const y = py + 14 + i * (26 / k * 0.75 + 8);
      const bw = ((pw - 190) * Math.max(0.004, sg.alive / max));
      ctx.font = fs(9.5, 650);
      ctx.fillStyle = i === st.stage ? pal['sim-text'] : pal['text-muted'];
      ctx.fillText(sg.name.split(' (')[0], px, y + 11);
      ctx.fillStyle = i === st.stage ? pal.accent : withAlpha(pal['text-faint'], 0.5);
      ctx.fillRect(px + 150, y, bw, 14);
      ctx.fillStyle = pal['text-muted'];
      ctx.fillText(sg.alive.toLocaleString('en'), px + 156 + bw, y + 11);
    });
    const yy = py + 14 + n * (26 / k * 0.75 + 8) + 10;
    ctx.font = fs(10, 600);
    ctx.fillStyle = pal['text-faint'];
    wrap(`${sp.eggs}. On average only about two offspring per pair need to survive and breed for the population to stay the same size.`, px, yy, pw, 15 / k);
    // metamorphosis comparison
    const my = yy + 70 / k + (P ? 0 : 20);
    ctx.font = fs(11.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Two kinds of insect metamorphosis', px, my);
    const rows: [string, string[], boolean][] = [
      ['Complete', ['Egg', 'Larva', 'Pupa', 'Adult'], st.species === 'butterfly'],
      ['Incomplete', ['Egg', 'Nymph', 'Adult'], st.species === 'grasshopper'],
    ];
    rows.forEach(([label, chips, on], r) => {
      const y = my + 14 + r * (30 / k * 0.8 + 6);
      ctx.font = fs(10, 700);
      ctx.fillStyle = on ? pal.accent : pal['text-muted'];
      ctx.fillText(label, px, y + 12);
      let x = px + (P ? 140 : 96);
      for (const ch of chips) {
        ctx.font = fs(9.5, 650);
        const w = ctx.measureText(ch).width + 14;
        ctx.fillStyle = on ? withAlpha(pal.accent, 0.18) : pal['bg-elev'];
        ctx.beginPath();
        ctx.roundRect(x, y, w, 18, 9);
        ctx.fill();
        ctx.fillStyle = pal['sim-text'];
        ctx.fillText(ch, x + 7, y + 13);
        x += w + 12;
      }
    });
    areas.push({ test: (x, y) => x > px && x < px + pw && y > my - 14 && y < my + 70, title: 'Complete vs incomplete metamorphosis', text: () => 'Complete metamorphosis (butterflies, beetles, flies, bees) has a pupa, in which the body is rebuilt; larva and adult live very different lives. Incomplete metamorphosis (grasshoppers, dragonflies, cockroaches) has no pupa: nymphs gradually become adults with each moult.' });
    areas.push({ test: (x, y) => x > px && x < px + pw && y > py - 14 && y < my - 14, title: 'Why so many eggs?', text: () => 'Most eggs and young are eaten, starve or die of disease. Animals that give little care produce huge numbers of offspring; animals that care for their young, like birds and mammals, produce far fewer but each has a better chance of surviving.' });
  }
  let stageHits: { i: number; x: number; y: number }[] = [];
  function wrap(text: string, x: number, y: number, maxW: number, lh: number) {
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        y += lh;
        line = word;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lh;
  }

  /* ---------- View: fertilisation and early development ---------- */
  function drawDev(fs: Fs, k: number) {
    const P = portrait();
    const cx = P ? 340 : 330;
    const cy = P ? 330 : 300;
    const R = 120;
    const s = st.dev;
    const f = tween;
    // the egg (jelly coat for the frog, membranes for the chicken)
    ctx.fillStyle = st.internal ? withAlpha('#ffd43b', 0.18) : withAlpha('#a5d8ff', 0.25);
    ctx.beginPath();
    ctx.arc(cx, cy, R + 34, 0, Math.PI * 2);
    ctx.fill();
    if (s <= 2) {
      ctx.fillStyle = st.internal ? '#ffe066' : '#495057';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      if (!st.internal) {
        ctx.fillStyle = '#f1f3f5';
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.fill();
      }
      // sperm
      const nSperm = s === 0 ? 14 : 0;
      for (let i = 0; i < nSperm; i++) {
        const a = (i / nSperm) * Math.PI * 2 + t * 0.2;
        const d = R + 30 + 120 * (1 - f) + Math.sin(t * 5 + i) * 6;
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        ctx.fillStyle = pal['sim-text'];
        ctx.beginPath();
        ctx.ellipse(x, y, 5, 3.5, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal['sim-text'];
        ctx.lineWidth = 1.2 / k;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
        ctx.quadraticCurveTo(x + Math.cos(a) * 14 + Math.sin(t * 9 + i) * 4, y + Math.sin(a) * 14, x + Math.cos(a) * 24, y + Math.sin(a) * 24);
        ctx.stroke();
      }
      // nuclei: separate at fertilisation, fused in the zygote
      const sep = s === 1 ? 40 * (1 - f) : s === 0 ? 60 : 0;
      ctx.fillStyle = '#e64980';
      ctx.beginPath();
      ctx.arc(cx - sep / 2, cy - 10, 14, 0, Math.PI * 2);
      ctx.fill();
      if (s >= 1) {
        ctx.fillStyle = '#4c6ef5';
        ctx.beginPath();
        ctx.arc(cx + sep / 2, cy - 10, s === 2 ? 14 : 12, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s === 1) {
        // fertilisation envelope lifting off
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 3 / k;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 8 * f, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (s <= 5) {
      const cells = s === 3 ? 2 : s === 4 ? 4 : 8;
      // cleavage: 2 side by side, then 2 × 2, then 4 × 2 (cells get smaller; the embryo does not grow)
      const cols = cells === 8 ? 4 : 2;
      const rows = cells === 2 ? 1 : 2;
      const rr = cells === 2 ? R / 1.95 : cells === 4 ? R / 2.15 : R / 3.4;
      const gap = rr * 2.04 * (0.85 + 0.15 * f);
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const x = cx + (col - (cols - 1) / 2) * gap;
          const y = cy + (row - (rows - 1) / 2) * gap;
          const lower = rows > 1 && row === 1;
          ctx.fillStyle = st.internal ? '#ffe066' : lower ? '#f1f3f5' : '#868e96';
          ctx.strokeStyle = pal['sim-text'];
          ctx.lineWidth = 1.5 / k;
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#7950f2';
          ctx.beginPath();
          ctx.arc(x, y, rr * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (s === 6) {
      // blastula: hollow ball of many cells
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        ctx.fillStyle = st.internal ? '#ffe066' : i > 7 && i < 21 ? '#f1f3f5' : '#868e96';
        ctx.strokeStyle = pal['sim-text'];
        ctx.lineWidth = 1 / k;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.font = fs(10.5, 650);
      ctx.fillStyle = pal['text-muted'];
      ctx.textAlign = 'center';
      ctx.fillText('fluid-filled cavity', cx, cy + 4);
    } else if (s === 7) {
      // gastrula: three germ layers
      const layers: [string, number, string][] = [
        ['#4dabf7', 1, 'ectoderm'],
        ['#ff6b6b', 0.78, 'mesoderm'],
        ['#ffd43b', 0.56, 'endoderm'],
      ];
      for (const [col, rr] of layers) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, R * rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = pal['sim-bg'];
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = '#10161f';
      ctx.textAlign = 'center';
      ctx.fillText('ectoderm', cx, cy - R * 0.88);
      ctx.fillText('mesoderm', cx, cy - R * 0.66);
      ctx.fillText('endoderm', cx, cy - R * 0.44);
      ctx.fillStyle = pal['text-muted'];
      ctx.fillText('gut cavity', cx, cy + 4);
    } else {
      // organ formation: a curled embryo with a neural tube and somites
      ctx.strokeStyle = st.internal ? '#ffa8a8' : '#495057';
      ctx.lineWidth = 46;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.6, Math.PI * 0.9, Math.PI * 2.4);
      ctx.stroke();
      ctx.strokeStyle = '#4dabf7';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.6 - 12, Math.PI * 0.95, Math.PI * 2.35);
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.15 + i * 0.12);
        ctx.fillStyle = '#ff8787';
        ctx.fillRect(cx + Math.cos(a) * R * 0.6 - 4, cy + Math.sin(a) * R * 0.6 - 4, 8, 8);
      }
      ctx.fillStyle = '#212529';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(Math.PI * 2.4) * R * 0.6, cy + Math.sin(Math.PI * 2.4) * R * 0.6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = fs(10.5, 650);
      ctx.fillStyle = pal['text-muted'];
      ctx.textAlign = 'center';
      ctx.fillText('neural tube (blue) and somites (pink blocks)', cx, cy + R + 50);
    }
    ctx.font = fs(13, 750);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText(`${s + 1}. ${DEV_STEPS[s].name}`, cx, cy - R - 50);
    ctx.font = fs(10, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText(`${st.internal ? 'Chicken: internal fertilisation' : 'Frog: external fertilisation in water'} · not to scale`, cx, cy - R - 50 + 18 / k);
    areas.push({ test: (x, y) => Math.hypot(x - cx, y - cy) < R + 40, title: DEV_STEPS[s].name, text: () => DEV_STEPS[s].text(st.internal) });
    // chromosome panel
    const px = P ? 30 : 640;
    const py = P ? 640 : 120;
    ctx.textAlign = 'left';
    ctx.font = fs(11.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Chromosome numbers', px, py);
    const n = st.internal ? 39 : 18;
    const rows: [string, string, string][] = [
      ['Egg (from the mother)', `${n}`, '#e64980'],
      ['Sperm (from the father)', `${n}`, '#4c6ef5'],
      ['Zygote and every body cell', `${2 * n}`, '#7950f2'],
    ];
    rows.forEach(([label, v, col], i) => {
      const y = py + 24 / k + i * (24 / k);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px + 7, y - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = fs(10.5, 650);
      ctx.fillStyle = pal['text-muted'];
      ctx.fillText(label, px + 20, y);
      ctx.font = fs(11, 750);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(v, px + (P ? 300 : 250), y);
    });
    ctx.font = fs(10, 600);
    ctx.fillStyle = pal['text-faint'];
    wrap(`Eggs and sperm are made by meiosis, so they carry one set of chromosomes (haploid). Fertilisation restores two sets (diploid). Values for the ${st.internal ? 'chicken' : 'African clawed frog'}.`, px, py + 24 / k * 4, P ? 600 : 330, 15 / k);
  }

  /* ---------- View: reproduction strategies ---------- */
  function drawRepro(fs: Fs, k: number) {
    for (const left of [true, false]) {
      const r = popR(left);
      const pop = left ? asex : sex;
      ctx.fillStyle = pal['bg-elev'];
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.font = fs(11.5, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'left';
      ctx.fillText(left ? 'Asexual: females make clones' : 'Sexual: two parents mix genes', r.x + 12, r.y + 20);
      ctx.font = fs(10, 600);
      ctx.fillStyle = pal['text-muted'];
      ctx.fillText(`${pop.length} individuals · ${variety(pop)} of 9 types`, r.x + 12, r.y + 20 + 16 / k);
      for (const i of pop) {
        const x = r.x + 12 + i.x * (r.w - 24);
        const y = r.y + 48 + i.y * (r.h - 58);
        ctx.fillStyle = GENO[typeOf(i)];
        ctx.beginPath();
        if (i.male) ctx.rect(x - 5, y - 5, 10, 10);
        else ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!pop.length) {
        ctx.font = fs(13, 750);
        ctx.fillStyle = pal.danger;
        ctx.textAlign = 'center';
        ctx.fillText('Extinct', r.x + r.w / 2, r.y + r.h / 2);
      }
      areas.push({
        test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h,
        title: left ? 'Asexual reproduction' : 'Sexual reproduction',
        text: () =>
          left
            ? 'Every individual is a female that produces offspring genetically identical to herself (apart from rare mutations). Examples: aphids in summer, some lizards and stick insects (parthenogenesis), hydra (budding), flatworms (splitting). The population grows fast, but everyone shares the same weaknesses.'
            : 'Each offspring gets a mix of genes from two parents, so the population contains many different types (colours). Only females give birth, so it grows more slowly, but variety means some individuals usually survive a new disease or change.',
      });
    }
    // population history chart and birth-type comparison
    const P = portrait();
    const gx = P ? 20 : 640;
    const gy = P ? 640 : 84;
    const gw = P ? 640 : 345;
    const gh = P ? 130 : 110;
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(`Population size · generation ${gen}`, gx, gy);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / k;
    ctx.strokeRect(gx, gy + 10, gw, gh);
    for (const [key, col] of [
      ['a', pal.warning],
      ['s', pal.accent],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5 / k;
      ctx.beginPath();
      history.forEach((h, i) => {
        const x = gx + (i / 29) * gw;
        const y = gy + 10 + gh - (h[key] / CAP) * (gh - 6);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    ctx.font = fs(9.5, 650);
    ctx.fillStyle = pal.warning;
    ctx.fillText('asexual', gx + 6, gy + gh + 26 / k);
    ctx.fillStyle = pal.accent;
    ctx.fillText('sexual', gx + 70, gy + gh + 26 / k);
    // where the embryo develops
    const by = gy + gh + 60 / k;
    const b = BIRTH[st.birth];
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(b.name, gx, by);
    drawBirth(gx, by + 14, gw, P ? 150 : 190, k, fs);
    areas.push({ test: (x, y) => x > gx && x < gx + gw && y > by - 14 && y < by + (P ? 170 : 210), title: b.name, text: () => `${b.text} Examples: ${b.examples}.` });
  }
  function drawBirth(x: number, y: number, w: number, h: number, k: number, fs: Fs) {
    const mid = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.12);
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / k;
    // the mother (outline)
    ctx.beginPath();
    ctx.ellipse(mid - w * 0.14, cy, w * 0.26, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    if (st.birth === 'ovi') {
      // eggs outside the mother
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#fff4e6';
        ctx.strokeStyle = '#e8c39e';
        ctx.beginPath();
        ctx.ellipse(x + w * 0.74 + i * 22, cy + h * 0.2, 9, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath();
        ctx.arc(x + w * 0.74 + i * 22, cy + h * 0.22, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      labelAt('eggs laid outside', x + w * 0.74 + 22, cy + h * 0.2 - 22, fs);
      labelAt('yolk feeds the embryo', x + w * 0.74 + 22, cy + h * 0.2 + 34, fs);
    } else if (st.birth === 'ovovivi') {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = withAlpha('#fff4e6', 0.9);
        ctx.beginPath();
        ctx.ellipse(mid - w * 0.14 - 34 + i * 34, cy, 13, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath();
        ctx.arc(mid - w * 0.14 - 34 + i * 34, cy + 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#868e96';
        ctx.beginPath();
        ctx.ellipse(mid - w * 0.14 - 34 + i * 34, cy - 6, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      labelAt('eggs kept inside; they hatch inside her', mid, cy - h * 0.44, fs);
      labelAt('fed mainly by yolk', mid, cy + h * 0.5, fs);
    } else {
      ctx.fillStyle = withAlpha('#ffa8a8', 0.6);
      ctx.beginPath();
      ctx.arc(mid - w * 0.14, cy, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8787';
      ctx.beginPath();
      ctx.ellipse(mid - w * 0.14, cy, 13, 18, 0.4, 0, Math.PI * 2);
      ctx.fill();
      // placenta and nutrient flow
      ctx.fillStyle = '#c92a2a';
      ctx.beginPath();
      ctx.ellipse(mid - w * 0.14 + 34, cy - 10, 10, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha('#e03131', 0.4 + 0.6 * pulse);
      ctx.lineWidth = 3 / k;
      ctx.beginPath();
      ctx.moveTo(mid - w * 0.14 + 32, cy - 4);
      ctx.quadraticCurveTo(mid - w * 0.14 + 22, cy + 10, mid - w * 0.14 + 8, cy + 6);
      ctx.stroke();
      labelAt('placenta: food and oxygen from the mother', mid, cy - h * 0.44, fs);
      labelAt('embryo develops in the uterus', mid, cy + h * 0.5, fs);
    }
  }
  function labelAt(text: string, x: number, y: number, fs: Fs) {
    ctx.font = fs(9.5, 650);
    ctx.fillStyle = pal['text-muted'];
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
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
    stageHits = [];
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    if (st.view === 'cycle') drawCycle(fs, k);
    else if (st.view === 'dev') drawDev(fs, k);
    else drawRepro(fs, k);
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts and text ---------- */
  let lastNote = '';
  function updateUi() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = '';
    if (st.view === 'cycle') {
      const sp = SP();
      const s = sp.stages[st.stage];
      r('r1', 'Stage', `${st.stage + 1} of ${sp.stages.length}: ${s.name}`);
      r('r2', 'Typical duration', s.duration);
      r('r3', 'Development', sp.development);
      r('r4', 'Offspring', sp.eggs);
      note = `${s.name}: ${s.text}`;
      sim.setBadge(`${sp.name}: ${s.name.split(' (')[0]}`);
      canvas.setAttribute('aria-label', `Life cycle of a ${sp.example}. Stage ${st.stage + 1} of ${sp.stages.length}: ${s.name}.`);
    } else if (st.view === 'dev') {
      r('r1', 'Step', `${st.dev + 1} of ${DEV_STEPS.length}: ${DEV_STEPS[st.dev].name}`);
      r('r2', 'Fertilisation', st.internal ? 'Internal (inside the hen)' : 'External (in the water)');
      r('r3', 'Number of cells', st.dev <= 2 ? '1' : st.dev === 3 ? '2' : st.dev === 4 ? '4' : st.dev === 5 ? '8' : st.dev === 6 ? 'tens to thousands' : 'thousands and more');
      r('r4', 'Chromosomes per body cell', st.internal ? '78 (chicken)' : '36 (African clawed frog)');
      note = DEV_STEPS[st.dev].text(st.internal);
      sim.setBadge(DEV_STEPS[st.dev].name);
      canvas.setAttribute('aria-label', `Early development, step ${st.dev + 1}: ${DEV_STEPS[st.dev].name}.`);
    } else {
      r('r1', 'Generation', String(gen));
      r('r2', 'Asexual population', `${asex.length} (${variety(asex)} types)`, asex.length ? null : 'bad');
      r('r3', 'Sexual population', `${sex.length} (${variety(sex)} types)`, sex.length ? null : 'bad');
      const b = BIRTH[st.birth];
      r('r4', 'Embryo develops', `${b.where}; fed by ${b.food.charAt(0).toLowerCase()}${b.food.slice(1)}`);
      note = lastOutbreak || (gen < 4 ? 'Press Start. Watch how quickly each population grows: every asexual individual gives birth, but only half of the sexual population (the females, circles) can. Then press “Disease outbreak”.' : 'The asexual population grew faster: this is the “twofold cost” of sex, because males do not give birth. But look at the variety of colours (types). Now press “Disease outbreak”.');
      sim.setBadge(`Generation ${gen}`);
      canvas.setAttribute('aria-label', `Population model at generation ${gen}: asexual ${asex.length} individuals, sexual ${sex.length} individuals.`);
    }
    if (note !== lastNote) noteEl.textContent = lastNote = note;
  }

  /* ---------- Navigation ---------- */
  function buildStageButtons() {
    const sp = SP();
    stagesEl.innerHTML = sp.stages.map((s, i) => `<button type="button" class="preset" data-stage-btn="${i}" aria-pressed="${i === st.stage}">${i + 1}. ${s.name.split(' (')[0]}</button>`).join('');
    stagesEl.querySelectorAll<HTMLButtonElement>('[data-stage-btn]').forEach((b) => b.addEventListener('click', () => goStage(Number(b.dataset.stageBtn))));
    devEl.innerHTML = DEV_STEPS.map((s, i) => `<button type="button" class="preset" data-dev-btn="${i}" aria-pressed="${i === st.dev}">${i + 1}. ${s.name}</button>`).join('');
    devEl.querySelectorAll<HTMLButtonElement>('[data-dev-btn]').forEach((b) => b.addEventListener('click', () => goDev(Number(b.dataset.devBtn))));
  }
  function goStage(i: number) {
    st.stage = (i + SP().stages.length) % SP().stages.length;
    // fade in only while playing; when paused, show the new stage at once
    tween = sim.running ? 0 : 1;
    autoTimer = 0;
    stagesEl.querySelectorAll<HTMLButtonElement>('[data-stage-btn]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stageBtn) === st.stage)));
    updateUi();
    sim.requestRender();
  }
  function goDev(i: number) {
    st.dev = clamp(i, 0, DEV_STEPS.length - 1);
    tween = sim.running ? 0 : 1;
    autoTimer = 0;
    devEl.querySelectorAll<HTMLButtonElement>('[data-dev-btn]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.devBtn) === st.dev)));
    updateUi();
    sim.requestRender();
  }
  root.querySelector('[data-prev]')?.addEventListener('click', () => (st.view === 'dev' ? goDev(st.dev - 1) : goStage(st.stage - 1)));
  root.querySelector('[data-next]')?.addEventListener('click', () => (st.view === 'dev' ? goDev(st.dev + 1) : goStage(st.stage + 1)));
  root.querySelector('[data-outbreak]')?.addEventListener('click', () => {
    outbreak();
    updateUi();
    sim.requestRender();
  });
  root.querySelector('[data-repop]')?.addEventListener('click', () => {
    resetPop();
    updateUi();
    sim.requestRender();
  });

  const ui = controls(root);
  const showFor = (v: View) => {
    ui.showWhen('[data-only="cycle"]', v === 'cycle');
    ui.showWhen('[data-only="dev"]', v === 'dev');
    ui.showWhen('[data-only="repro"]', v === 'repro');
    ui.showWhen('[data-only="steps"]', v !== 'repro');
  };
  const viewCtl = ui.choice<View>('lc-view', (v) => {
    st.view = v;
    tween = 1;
    autoTimer = 0;
    showFor(v);
    sim.pause();
    sim.hideTooltip();
    updateUi();
    sim.requestRender();
  });
  const speciesSel = root.querySelector<HTMLSelectElement>('[data-species]')!;
  const spCtl = { set: (v: SpeciesId, _n = false) => (speciesSel.value = v) };
  speciesSel.addEventListener('change', () => {
    const v = speciesSel.value as SpeciesId;
    st.species = v;
    st.stage = 0;
    tween = 1;
    buildStageButtons();
    updateUi();
    sim.requestRender();
  });
  const fertCtl = ui.choice<'ext' | 'int'>('lc-fert', (v) => ((st.internal = v === 'int'), updateUi(), sim.requestRender()));
  const birthCtl = ui.choice<BirthId>('lc-birth', (v) => ((st.birth = v), updateUi(), sim.requestRender()));

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    if (st.view === 'cycle') {
      const hit = stageHits.find((s) => Math.hypot(x - s.x, y - s.y) < 48);
      if (hit) goStage(hit.i);
    }
    const a = areas.find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set(DEF.view, false);
      spCtl.set(DEF.species, false);
      fertCtl.set('ext', false);
      birthCtl.set(DEF.birth, false);
      showFor(DEF.view);
      buildStageButtons();
      resetPop();
      tween = 1;
    },
  });
  resetPop();
  buildStageButtons();
  showFor(DEF.view);
  updateUi();
}
