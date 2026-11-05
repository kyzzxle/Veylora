/**
 * The rock cycle as a set of rules. A rock (or sediment, or magma) sits in a
 * place (at the surface, buried, or molten underground) and each process
 * changes it in a geologically sensible way:
 *   weathering and erosion  surface rock → sediment (sand, mud or shell debris)
 *   deposition and burial   sediment → sedimentary rock (compaction + cementation)
 *   heat and pressure       buried rock → metamorphic rock (shale → slate → schist → gneiss)
 *   melting                 buried rock → magma
 *   slow cooling            magma → coarse-grained intrusive rock (granite, gabbro)
 *   eruption                magma → fine-grained extrusive rock (rhyolite, basalt)
 *   uplift                  buried rock → exposed at the surface
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent', 'border-strong'] as const;

type Kind = 'igneous' | 'sedimentary' | 'metamorphic' | 'sediment' | 'magma';
type Where = 'surface' | 'buried' | 'molten';
type Texture = 'coarse' | 'fine' | 'grains' | 'layers' | 'foliated' | 'banded' | 'crystalline' | 'loose' | 'melt';
type Proc = 'weather' | 'deposit' | 'metamorph' | 'melt' | 'cool' | 'erupt' | 'uplift';

interface Rock {
  name: string;
  kind: Kind;
  texture: Texture;
  colours: string[];
  about: string;
  mafic?: boolean;
}

const ROCKS: Record<string, Rock> = {
  granite: { name: 'Granite', kind: 'igneous', texture: 'coarse', colours: ['#e3c9c0', '#f2ede6', '#2b2b2b', '#c98f80'], about: 'Large interlocking crystals of quartz, feldspar and mica: it cooled slowly deep underground, giving crystals time to grow.' },
  gabbro: { name: 'Gabbro', kind: 'igneous', texture: 'coarse', colours: ['#3a3f3c', '#5e6560', '#1d1f1e', '#8a8f86'], about: 'A dark, coarse-grained rock made from iron- and magnesium-rich magma that cooled slowly underground.', mafic: true },
  basalt: { name: 'Basalt', kind: 'igneous', texture: 'fine', colours: ['#3b3d40', '#4a4c50'], about: 'Dark, with crystals too small to see: lava cooled quickly at the surface. Most of the ocean floor is basalt.', mafic: true },
  rhyolite: { name: 'Rhyolite', kind: 'igneous', texture: 'fine', colours: ['#cdb7a4', '#a8907c', '#e6d6c6'], about: 'Pale, fine-grained rock from sticky, silica-rich lava. Cooled very fast it becomes glassy obsidian; full of gas bubbles, it becomes pumice.' },
  sandstone: { name: 'Sandstone', kind: 'sedimentary', texture: 'grains', colours: ['#d8b67a', '#c9a265', '#e8cf9b'], about: 'Sand grains, mostly quartz, pressed together and cemented by minerals from groundwater.' },
  shale: { name: 'Shale', kind: 'sedimentary', texture: 'layers', colours: ['#6f6a62', '#5f5a53'], about: 'Very fine mud and clay squeezed into thin layers. It often contains fossils and splits into flat sheets.' },
  limestone: { name: 'Limestone', kind: 'sedimentary', texture: 'layers', colours: ['#dcd6c4', '#cfc8b2'], about: 'Calcium carbonate, mostly from the shells and skeletons of sea creatures. It fizzes in acid and is often full of fossils.' },
  quartzite: { name: 'Quartzite', kind: 'metamorphic', texture: 'crystalline', colours: ['#efe6da', '#e2d6c6'], about: 'Sandstone baked until its quartz grains fused together: one of the hardest common rocks.' },
  slate: { name: 'Slate', kind: 'metamorphic', texture: 'foliated', colours: ['#4a5260', '#3e4552'], about: 'Low-grade metamorphic rock from shale. New flat minerals line up, so it splits into thin sheets used for roofs.' },
  schist: { name: 'Schist', kind: 'metamorphic', texture: 'foliated', colours: ['#8c8f86', '#b7b9ad', '#6d7066'], about: 'Medium- to high-grade metamorphic rock. Shiny mica crystals have grown big enough to see and lie in wavy layers.' },
  gneiss: { name: 'Gneiss', kind: 'metamorphic', texture: 'banded', colours: ['#e8e2d8', '#3a3a3a'], about: 'High-grade metamorphic rock with light and dark minerals separated into bands. Any hotter and it would start to melt.' },
  marble: { name: 'Marble', kind: 'metamorphic', texture: 'crystalline', colours: ['#f4f1ea', '#dcd6cc'], about: 'Limestone recrystallised by heat and pressure into interlocking calcite crystals. Prized for sculpture and buildings.' },
  sand: { name: 'Sand', kind: 'sediment', texture: 'loose', colours: ['#e0c486', '#cfae6c'], about: 'Loose grains, mostly quartz, the toughest common mineral: it survives weathering when other minerals break down.' },
  mud: { name: 'Mud and clay', kind: 'sediment', texture: 'loose', colours: ['#8a7a66', '#7a6b58'], about: 'Tiny clay particles formed when feldspar and other minerals are chemically weathered. Carried far by rivers.' },
  shells: { name: 'Shell debris', kind: 'sediment', texture: 'loose', colours: ['#f0ead8', '#ddd3bc'], about: 'Calcium carbonate dissolved by weathering is used by sea creatures to build shells, which pile up on the sea floor.' },
  felsicMagma: { name: 'Magma (silica-rich)', kind: 'magma', texture: 'melt', colours: ['#ffb347', '#ff6a2a'], about: 'Molten rock at 650–900 °C. Silica-rich magma is thick and sticky, so it often erupts explosively.' },
  maficMagma: { name: 'Magma (basaltic)', kind: 'magma', texture: 'melt', colours: ['#ffcc55', '#ff7a2a'], about: 'Runny molten rock at about 1,100–1,250 °C, poor in silica. It erupts as flowing lava.', mafic: true },
};

const KIND_LABEL: Record<Kind, string> = { igneous: 'Igneous rock', sedimentary: 'Sedimentary rock', metamorphic: 'Metamorphic rock', sediment: 'Sediment', magma: 'Magma (molten rock)' };
const KIND_COLOUR: Record<Kind, string> = { igneous: '#e0605a', sedimentary: '#e0a43a', metamorphic: '#8e6bd8', sediment: '#c9a265', magma: '#ff7a2a' };

const PROC: Record<Proc, { label: string; years: number; text: string }> = {
  weather: { label: 'Weathering and erosion', years: 1e5, text: 'Rain, ice, wind and plant roots break the rock down; rivers carry the pieces to the sea.' },
  deposit: { label: 'Deposition and burial', years: 2e6, text: 'Layers of sediment settle on the sea floor. Buried under more layers, they are compacted and cemented into rock.' },
  metamorph: { label: 'Heat and pressure', years: 1e7, text: 'Deep burial or colliding plates heat and squeeze the rock. Without melting, its minerals recrystallise.' },
  melt: { label: 'Melting', years: 1e6, text: 'Deep in the crust, or above a subducting plate, the rock gets hot enough to melt into magma.' },
  cool: { label: 'Slow cooling underground', years: 1e6, text: 'Magma trapped underground cools over hundreds of thousands of years, growing large crystals.' },
  erupt: { label: 'Eruption and fast cooling', years: 10, text: 'Magma erupts as lava or ash and cools in days to years, so crystals stay tiny.' },
  uplift: { label: 'Uplift', years: 1e7, text: 'Plate movements push buried rock up into mountains; erosion removes what was on top, exposing it.' },
};

const weatherTo = (id: string) => (['granite', 'rhyolite', 'sandstone', 'quartzite', 'gneiss'].includes(id) ? 'sand' : ['limestone', 'marble'].includes(id) ? 'shells' : 'mud');
const depositTo: Record<string, string> = { sand: 'sandstone', mud: 'shale', shells: 'limestone' };
const metamorphTo: Record<string, string> = { sandstone: 'quartzite', shale: 'slate', slate: 'schist', schist: 'gneiss', gneiss: 'gneiss', limestone: 'marble', marble: 'marble', granite: 'gneiss', rhyolite: 'gneiss', basalt: 'schist', gabbro: 'schist', quartzite: 'quartzite' };

const fmtYears = (y: number) => (y < 1e3 ? `${Math.round(y)} years` : y < 1e6 ? `${Math.round(y / 1e3)} thousand years` : y < 1e9 ? `${+(y / 1e6).toFixed(1)} million years` : `${(y / 1e9).toFixed(2)} billion years`);
const WHERE_TEXT: Record<Where, string> = { surface: 'At the surface', buried: 'Buried deep underground', molten: 'In a magma chamber' };

export function initRocks(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const statusEl = root.querySelector<HTMLElement>('[data-status-text]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-proc]')];
  const startPick = root.querySelector<HTMLSelectElement>('[data-start]')!;

  const st = { rock: 'granite', where: 'surface' as Where, years: 0, journey: ['Granite'], last: '' };
  // Token animation from one place to another, through optional waypoints
  let anim: { path: [number, number][]; t: number } | null = null;

  /* ---------- Where things happen in the landscape (design box 1000 × 560) ---------- */
  const SPOTS = {
    peak: [150, 150] as [number, number],
    river: [380, 262] as [number, number],
    seabed: [540, 318] as [number, number],
    sedLayer: [540, 352] as [number, number],
    meta: [300, 428] as [number, number],
    magma: [330, 505] as [number, number],
    pluton: [190, 470] as [number, number],
    volcano: [372, 190] as [number, number],
  };
  function spotFor(id: string, where: Where): [number, number] {
    const r = ROCKS[id];
    if (r.kind === 'magma') return SPOTS.magma;
    if (r.kind === 'sediment') return SPOTS.seabed;
    if (where === 'surface') return r.kind === 'igneous' && !['granite', 'gabbro'].includes(id) ? SPOTS.volcano : SPOTS.peak;
    if (r.kind === 'sedimentary') return SPOTS.sedLayer;
    if (r.kind === 'metamorphic') return SPOTS.meta;
    return SPOTS.pluton;
  }

  /* ---------- Rules ---------- */
  function allowed(p: Proc): string | null {
    const r = ROCKS[st.rock];
    const solid = r.kind !== 'magma' && r.kind !== 'sediment';
    switch (p) {
      case 'weather':
        return solid && st.where === 'surface' ? null : r.kind === 'magma' ? 'Magma must cool into rock first.' : r.kind === 'sediment' ? 'It is already sediment.' : 'It is buried: uplift it to the surface first.';
      case 'deposit':
        return r.kind === 'sediment' ? null : 'Only loose sediment can be deposited and cemented into rock.';
      case 'metamorph':
        return solid && st.where === 'buried' ? null : r.kind === 'sediment' ? 'Sediment must be buried and turned into rock first.' : r.kind === 'magma' ? 'Magma is already molten.' : 'Rock must be buried deep underground to be heated and squeezed.';
      case 'melt':
        return solid && st.where === 'buried' ? null : r.kind === 'magma' ? 'It is already molten.' : 'Rock must be deep underground to melt.';
      case 'cool':
      case 'erupt':
        return r.kind === 'magma' ? null : 'Only magma can cool into igneous rock.';
      case 'uplift':
        return solid && st.where === 'buried' ? null : st.where === 'surface' ? 'It is already at the surface.' : 'Only solid buried rock can be uplifted.';
    }
  }

  function apply(p: Proc) {
    const reason = allowed(p);
    if (reason) {
      statusEl.textContent = reason;
      return;
    }
    const from = spotFor(st.rock, st.where);
    const r = ROCKS[st.rock];
    let next = st.rock;
    let where: Where = st.where;
    let via: [number, number][] = [];
    switch (p) {
      case 'weather':
        next = weatherTo(st.rock);
        where = 'surface';
        via = [SPOTS.river];
        break;
      case 'deposit':
        next = depositTo[st.rock];
        where = 'buried';
        break;
      case 'metamorph':
        next = metamorphTo[st.rock];
        where = 'buried';
        break;
      case 'melt':
        next = r.mafic ? 'maficMagma' : 'felsicMagma';
        where = 'molten';
        break;
      case 'cool':
        next = r.mafic ? 'gabbro' : 'granite';
        where = 'buried';
        break;
      case 'erupt':
        next = r.mafic ? 'basalt' : 'rhyolite';
        where = 'surface';
        via = [[330, 280]];
        break;
      case 'uplift':
        where = 'surface';
        break;
    }
    const same = next === st.rock && where === st.where;
    st.rock = next;
    st.where = where;
    st.years += PROC[p].years;
    if (!same && st.journey[st.journey.length - 1] !== ROCKS[next].name) st.journey.push(ROCKS[next].name);
    st.last = p;
    const to = spotFor(next, where);
    anim = { path: [from, ...via, to], t: 0 };
    statusEl.textContent =
      p === 'metamorph' && same ? `${PROC[p].text} ${ROCKS[next].name} is already as changed as it can get without melting.` : `${PROC[p].text} Result: ${ROCKS[next].name.toLowerCase()}.`;
    sim.announce(`${PROC[p].label}: now ${ROCKS[next].name}.`);
    updateButtons();
    sim.play();
  }

  function updateButtons() {
    for (const b of buttons) {
      const reason = allowed(b.dataset.proc as Proc);
      b.setAttribute('aria-disabled', String(!!reason));
      b.classList.toggle('is-off', !!reason);
      b.title = reason ?? PROC[b.dataset.proc as Proc].text;
    }
  }

  /* ---------- Model: only the token animation moves ---------- */
  function step(dt: number) {
    if (!anim) return sim.pause();
    anim.t += dt / 1.6;
    if (anim.t >= 1) {
      anim = null;
      sim.pause();
    }
  }
  const tokenPos = (): [number, number] => {
    if (!anim) return spotFor(st.rock, st.where);
    const segs = anim.path.length - 1;
    const u = Math.min(0.999, anim.t) * segs;
    const i = Math.floor(u);
    const f = u - i;
    const e = f * f * (3 - 2 * f);
    const [a, b] = [anim.path[i], anim.path[i + 1]];
    return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
  };

  /* ---------- Drawing ---------- */
  const isStacked = () => size.h > size.w;
  const tf = () => {
    const [bw, bh] = isStacked() ? [620, 1000] : [1000, 560];
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };

  function drawSample(cx: number, cy: number, r: number, id: string) {
    const rock = ROCKS[id];
    let seed = id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = rock.colours[0];
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const c = rock.colours;
    switch (rock.texture) {
      case 'coarse':
        for (let i = 0; i < 70; i++) {
          ctx.fillStyle = c[Math.floor(rnd() * c.length)];
          const x = cx + (rnd() - 0.5) * r * 2;
          const y = cy + (rnd() - 0.5) * r * 2;
          const s = r * (0.08 + rnd() * 0.14);
          ctx.beginPath();
          ctx.moveTo(x, y - s);
          ctx.lineTo(x + s, y - s * 0.2);
          ctx.lineTo(x + s * 0.5, y + s);
          ctx.lineTo(x - s * 0.8, y + s * 0.6);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'fine':
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = c[i % c.length];
          ctx.globalAlpha = 0.6;
          ctx.fillRect(cx + (rnd() - 0.5) * r * 2, cy + (rnd() - 0.5) * r * 2, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
        if (id === 'basalt')
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(cx + (rnd() - 0.5) * r * 1.6, cy + (rnd() - 0.5) * r * 1.6, r * 0.04, 0, Math.PI * 2);
            ctx.fill();
          }
        break;
      case 'grains':
      case 'loose':
        for (let i = 0; i < (rock.texture === 'loose' ? 160 : 260); i++) {
          ctx.fillStyle = c[Math.floor(rnd() * c.length)];
          ctx.beginPath();
          ctx.arc(cx + (rnd() - 0.5) * r * 2, cy + (rnd() - 0.5) * r * 2, r * (id === 'mud' ? 0.02 : 0.045), 0, Math.PI * 2);
          ctx.fill();
        }
        if (id === 'shells')
          for (let i = 0; i < 10; i++) {
            ctx.strokeStyle = '#b8ad94';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + (rnd() - 0.5) * r * 1.6, cy + (rnd() - 0.5) * r * 1.6, r * 0.1, Math.PI, 0);
            ctx.stroke();
          }
        break;
      case 'layers':
        for (let y = cy - r; y < cy + r; y += r * 0.12) {
          ctx.fillStyle = c[Math.floor(rnd() * c.length)];
          ctx.fillRect(cx - r, y, r * 2, r * 0.06);
        }
        if (id === 'limestone' || id === 'shale') {
          ctx.strokeStyle = 'rgba(80,70,60,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx + r * 0.2, cy + r * 0.1, r * 0.18, Math.PI, Math.PI * 2.3);
          ctx.stroke();
        }
        break;
      case 'foliated':
        for (let i = 0; i < 26; i++) {
          ctx.strokeStyle = c[i % c.length];
          ctx.lineWidth = r * 0.05;
          ctx.beginPath();
          const y0 = cy - r + i * r * 0.08;
          for (let x = cx - r; x <= cx + r; x += 4) ctx.lineTo(x, y0 + Math.sin((x - cx) / (r * 0.18) + i) * r * (id === 'schist' ? 0.05 : 0.01) + (x - cx) * 0.25);
          ctx.stroke();
        }
        if (id === 'schist')
          for (let i = 0; i < 40; i++) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(cx + (rnd() - 0.5) * r * 2, cy + (rnd() - 0.5) * r * 2, 3, 1.5);
          }
        break;
      case 'banded':
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = i % 2 ? c[1] : c[0];
          ctx.beginPath();
          const y0 = cy - r + i * r * 0.18;
          ctx.moveTo(cx - r, y0);
          for (let x = cx - r; x <= cx + r; x += 4) ctx.lineTo(x, y0 + Math.sin((x - cx) / (r * 0.3)) * r * 0.12);
          ctx.lineTo(cx + r, y0 + r * 0.12);
          for (let x = cx + r; x >= cx - r; x -= 4) ctx.lineTo(x, y0 + r * 0.1 + Math.sin((x - cx) / (r * 0.3)) * r * 0.12);
          ctx.fill();
        }
        break;
      case 'crystalline':
        for (let i = 0; i < 50; i++) {
          ctx.strokeStyle = 'rgba(160,150,140,0.45)';
          ctx.lineWidth = 1.5;
          const x = cx + (rnd() - 0.5) * r * 2;
          const y = cy + (rnd() - 0.5) * r * 2;
          ctx.strokeRect(x, y, r * 0.18, r * 0.14);
        }
        if (id === 'marble') {
          ctx.strokeStyle = 'rgba(120,120,130,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - r, cy - r * 0.3);
          ctx.bezierCurveTo(cx - r * 0.3, cy, cx, cy - r * 0.6, cx + r, cy + r * 0.2);
          ctx.stroke();
        }
        break;
      case 'melt': {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, '#fff2a8');
        g.addColorStop(0.5, c[0]);
        g.addColorStop(1, c[1]);
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        break;
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
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
    const fs = (px: number, wt = 650) => font(px / k, wt);
    const stacked = isStacked();

    /* Landscape (0–600 wide) */
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, 600, 560, 16);
    ctx.clip();
    ctx.fillStyle = '#9cc8ec';
    ctx.fillRect(0, 0, 600, 260);
    // underground
    const g = ctx.createLinearGradient(0, 260, 0, 560);
    g.addColorStop(0, '#9c8461');
    g.addColorStop(0.55, '#7c5d45');
    g.addColorStop(1, '#5a2f22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 250, 600, 310);
    // heat zone and magma chamber
    const heat = ctx.createRadialGradient(330, 505, 10, 330, 505, 220);
    heat.addColorStop(0, 'rgba(255, 140, 40, 0.75)');
    heat.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = heat;
    ctx.fillRect(0, 300, 600, 260);
    ctx.fillStyle = '#ff7a2a';
    ctx.beginPath();
    ctx.ellipse(330, 510, 90, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    // conduit and volcano
    ctx.fillStyle = '#ff8c3a';
    ctx.fillRect(322, 200, 16, 300);
    ctx.fillStyle = '#5b4c42';
    ctx.beginPath();
    ctx.moveTo(270, 262);
    ctx.lineTo(320, 165);
    ctx.lineTo(340, 165);
    ctx.lineTo(420, 262);
    ctx.fill();
    // mountains
    ctx.fillStyle = '#8f8a80';
    ctx.beginPath();
    ctx.moveTo(0, 262);
    ctx.lineTo(0, 200);
    ctx.lineTo(80, 150);
    ctx.lineTo(150, 110);
    ctx.lineTo(220, 170);
    ctx.lineTo(270, 262);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(150, 110);
    ctx.lineTo(130, 125);
    ctx.lineTo(170, 127);
    ctx.fill();
    // sea and sediment layers
    ctx.fillStyle = 'rgba(40, 110, 190, 0.8)';
    ctx.fillRect(470, 250, 130, 70);
    ctx.fillStyle = '#5f8b4a';
    ctx.fillRect(0, 252, 470, 10);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#d6b77c', '#a39a8a', '#ddd6c2', '#bfa06a'][i];
      ctx.fillRect(440, 322 + i * 12, 160, 12);
    }
    // metamorphic zone
    ctx.fillStyle = 'rgba(142, 107, 216, 0.25)';
    ctx.fillRect(0, 400, 600, 55);
    // river
    ctx.strokeStyle = '#3d8fd6';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(240, 240);
    ctx.quadraticCurveTo(380, 270, 470, 262);
    ctx.stroke();
    // labels
    ctx.font = fs(11, 700);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    const tagL = (t: string, x: number, y: number) => {
      ctx.save();
      ctx.font = fs(11, 700);
      const tw = ctx.measureText(t).width;
      ctx.fillStyle = 'rgba(10,12,20,0.55)';
      ctx.beginPath();
      ctx.roundRect(x - tw / 2 - 6 / k, y - 10 / k, tw + 12 / k, 20 / k, 10 / k);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, x, y);
      ctx.restore();
    };
    tagL('Mountains: weathering', 120, 80);
    tagL('Volcano', 345, 140);
    tagL('River: erosion', 380, 290);
    tagL('Sea: deposition', 535, 235);
    tagL('Burial: heat & pressure', 150, 428);
    tagL('Magma chamber: melting', 330, 548);
    ctx.restore();

    // Token
    const [tx, ty] = tokenPos();
    if (anim) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      anim.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawSample(tx, ty, 16, st.rock);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 19, 0, Math.PI * 2);
    ctx.stroke();

    /* Sample panel */
    const P = stacked ? { x: 310, y: 760 } : { x: 800, y: 210 };
    const rock = ROCKS[st.rock];
    drawSample(P.x, P.y, 120, st.rock);
    ctx.textAlign = 'center';
    ctx.fillStyle = pal['sim-text'];
    ctx.font = fs(18, 800);
    ctx.fillText(rock.name, P.x, P.y + 160);
    ctx.font = fs(12, 700);
    const label = KIND_LABEL[rock.kind];
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = KIND_COLOUR[rock.kind];
    ctx.beginPath();
    ctx.roundRect(P.x - tw / 2 - 10 / k, P.y + 172, tw + 20 / k, 24 / k, 12 / k);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, P.x, P.y + 172 + 12 / k);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
    updateReadouts();
  }

  function updateReadouts() {
    const rock = ROCKS[st.rock];
    ui.readout('rock', rock.name);
    ui.readout('kind', KIND_LABEL[rock.kind]);
    ui.readout('where', WHERE_TEXT[st.where]);
    ui.readout('about', rock.about);
    ui.readout('journey', st.journey.join(' → '));
    ui.readout('time', st.years ? `about ${fmtYears(st.years)}` : '—');
    sim.setBadge(KIND_LABEL[rock.kind]);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.proc as Proc)));
  function start(id: string) {
    st.rock = id;
    // Igneous starting rocks begin exposed at the surface; the others begin buried
    st.where = ROCKS[id].kind === 'igneous' ? 'surface' : 'buried';
    st.years = 0;
    st.journey = [ROCKS[id].name];
    anim = null;
    statusEl.textContent = 'Choose a process below to change the rock.';
    updateButtons();
    sim.requestRender();
  }
  startPick.addEventListener('change', () => start(startPick.value));

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      startPick.value = 'granite';
      start('granite');
    },
  });
  start('granite');
}
