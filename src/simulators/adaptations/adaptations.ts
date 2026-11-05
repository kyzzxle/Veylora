/**
 * Animal adaptations experiment: design a mammal and test it in a habitat.
 *
 * Survival is the product of four scores (each 0–1):
 *   warmth  – insulation from fur and body size (bigger bodies lose heat
 *             more slowly: Bergmann's rule) minus heat lost through large
 *             ears (Allen's rule) sets a comfortable temperature;
 *             score = exp(−((T − T_comfort)/18)²)
 *   water   – dry habitats are hard unless the animal is active at night
 *             and small (burrows, less water lost)
 *   food    – how much of the chosen diet the habitat provides, helped by
 *             hibernating through a cold, lean winter
 *   hiding  – camouflage that matches the habitat (and size or night
 *             activity) protects against predators
 * Year-long survival chance = warmth × water × food × hiding.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent', 'warning', 'danger', 'success'] as const;
type Habitat = 'arctic' | 'desert' | 'forest' | 'grassland';
type Fur = 'thin' | 'medium' | 'thick';
type Size = 'small' | 'medium' | 'large';
type Ears = 'small' | 'large';
type Coat = 'white' | 'sandy' | 'brown' | 'golden';
type Diet = 'seeds' | 'insects' | 'leaves' | 'meat' | 'fish';

const HABITATS: Record<Habitat, { name: string; temp: number; dry: number; food: Record<Diet, number>; coat: Coat; cold: boolean; sky: string; ground: string; example: string }> = {
  arctic: { name: 'Arctic tundra', temp: -20, dry: 0.1, food: { seeds: 0.15, insects: 0.15, leaves: 0.2, meat: 0.9, fish: 0.95 }, coat: 'white', cold: true, sky: '#bcd6ea', ground: '#f2f6f8', example: 'Arctic fox: thick white fur, small ears and a compact body; the fur turns brown in summer.' },
  desert: { name: 'Hot desert', temp: 38, dry: 1, food: { seeds: 0.6, insects: 0.75, leaves: 0.25, meat: 0.5, fish: 0 }, coat: 'sandy', cold: false, sky: '#f5d9a0', ground: '#e2b878', example: 'Fennec fox: huge ears radiate heat, pale sandy fur, active at night, and gets most of its water from food.' },
  forest: { name: 'Temperate forest', temp: 8, dry: 0.15, food: { seeds: 0.75, insects: 0.85, leaves: 0.9, meat: 0.6, fish: 0.4 }, coat: 'brown', cold: true, sky: '#a9cfe6', ground: '#5e7d3a', example: 'Red squirrel and dormouse: brown coats for camouflage; the dormouse hibernates through the lean winter.' },
  grassland: { name: 'Savanna grassland', temp: 27, dry: 0.35, food: { seeds: 0.8, insects: 0.7, leaves: 0.85, meat: 0.75, fish: 0.1 }, coat: 'golden', cold: false, sky: '#bfe0f2', ground: '#d4b456', example: 'Gazelles and lions: golden coats blend into dry grass, and thin fur and slim bodies shed heat in the sun.' },
};
const COAT_COLOUR: Record<Coat, string> = { white: '#f4f4f4', sandy: '#e3c28b', brown: '#7a5232', golden: '#d2a347' };
const DIET_NAME: Record<Diet, string> = { seeds: 'Seeds', insects: 'Insects', leaves: 'Leaves and grass', meat: 'Other animals', fish: 'Fish' };

export function initAdaptations(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const adviceEl = root.querySelector<HTMLElement>('[data-advice]')!;

  const st = {
    habitat: 'arctic' as Habitat,
    temp: -20,
    foodMul: 1,
    predators: 0.6,
    fur: 'medium' as Fur,
    size: 'medium' as Size,
    ears: 'large' as Ears,
    coat: 'brown' as Coat,
    diet: 'seeds' as Diet,
    night: false,
    hibernate: false,
  };
  // A year in the life: 24 animals, each with a fixed random "luck" so results are stable
  const herd = Array.from({ length: 24 }, (_, i) => ({ luck: ((i * 0.618034) % 1 + 0.02) % 1, x: 60 + ((i * 97) % 520), y: 330 + ((i * 53) % 150), dir: i % 2 ? 1 : -1 }));

  function scores() {
    const H = HABITATS[st.habitat];
    const insulation = { thin: 0.15, medium: 0.55, thick: 1.0 }[st.fur] + { small: 0, medium: 0.15, large: 0.3 }[st.size] - (st.ears === 'large' ? 0.2 : 0);
    const comfort = 30 - 45 * insulation;
    // night activity avoids the hottest part of the day
    const feltTemp = st.temp > 25 && st.night ? st.temp - 10 : st.temp;
    const warmth = Math.exp(-(((feltTemp - comfort) / 18) ** 2));
    const waterSaving = (st.night ? 0.5 : 0) + (st.size === 'small' ? 0.25 : 0);
    const water = clamp(1 - H.dry * (0.75 - waterSaving), 0.05, 1);
    const winter = H.cold && st.temp < 12;
    const food = clamp(H.food[st.diet] * st.foodMul * (winter ? (st.hibernate ? 1 : 0.85) : st.hibernate ? 0.85 : 1), 0.02, 1);
    const match = st.coat === H.coat ? 1 : (st.coat === 'golden' && H.coat === 'sandy') || (st.coat === 'sandy' && H.coat === 'golden') ? 0.7 : 0.25;
    const sizeSafety = st.size === 'large' ? 0.35 : st.size === 'medium' ? 0.1 : 0;
    const hiding = clamp(1 - st.predators * (1 - match) * (1 - sizeSafety) * (st.night ? 0.75 : 1), 0.05, 1);
    const survival = warmth * water * food * hiding;
    return { warmth, water, food, hiding, survival, comfort, feltTemp };
  }

  function step(dt: number) {
    for (const a of herd) {
      a.x += a.dir * dt * 22;
      if (a.x < 40 || a.x > 600) a.dir *= -1;
    }
  }

  /* ---------- Drawing (design box 1000 × 560) ---------- */
  const tf = () => {
    const k = Math.min(size.w / 1000, size.h / 560);
    return { k, ox: (size.w - 1000 * k) / 2, oy: (size.h - 560 * k) / 2 };
  };

  /** A simple mammal drawn from its traits. */
  function drawAnimal(x: number, y: number, scale: number, faded: boolean, facing: number) {
    const s = scale * { small: 0.6, medium: 0.85, large: 1.15 }[st.size];
    const furPad = { thin: 1, medium: 4, thick: 8 }[st.fur] * s;
    const col = COAT_COLOUR[st.coat];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.globalAlpha = faded ? 0.25 : 1;
    // legs
    ctx.fillStyle = '#4a3a2c';
    for (const lx of [-26, -12, 14, 26]) ctx.fillRect(lx * s - 3 * s, 10 * s, 6 * s, 26 * s);
    // fluffy outline for fur
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 40 * s + furPad, 22 * s + furPad, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // tail
    ctx.beginPath();
    ctx.ellipse(-46 * s - furPad, -6 * s, 16 * s + furPad * 0.6, 6 * s + furPad * 0.4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // head
    ctx.beginPath();
    ctx.arc(44 * s, -16 * s, 16 * s + furPad * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // ears
    const ear = st.ears === 'large' ? 26 : 9;
    for (const ex of [36, 50]) {
      ctx.beginPath();
      ctx.moveTo((ex - 6) * s, -26 * s);
      ctx.lineTo(ex * s, (-26 - ear) * s);
      ctx.lineTo((ex + 6) * s, -26 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // eye and nose
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(50 * s, -18 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.arc(60 * s, -12 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const H = HABITATS[st.habitat];
    const sc = scores();

    // Habitat scene (x 0–640)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, 640, 560, 14);
    ctx.clip();
    ctx.fillStyle = st.night ? '#1c2440' : H.sky;
    ctx.fillRect(0, 0, 640, 300);
    ctx.fillStyle = H.ground;
    ctx.fillRect(0, 290, 640, 270);
    // habitat details
    if (st.habitat === 'arctic') {
      ctx.fillStyle = '#e4edf3';
      ctx.beginPath();
      ctx.moveTo(0, 290);
      ctx.lineTo(120, 200);
      ctx.lineTo(240, 290);
      ctx.moveTo(300, 290);
      ctx.lineTo(450, 180);
      ctx.lineTo(620, 290);
      ctx.fill();
    } else if (st.habitat === 'desert') {
      ctx.fillStyle = '#d9a95f';
      ctx.beginPath();
      ctx.ellipse(160, 300, 220, 50, 0, Math.PI, 0);
      ctx.ellipse(500, 300, 200, 40, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#4f8a3a';
      ctx.fillRect(560, 230, 12, 70);
      ctx.fillRect(548, 250, 12, 8);
    } else if (st.habitat === 'forest') {
      for (const tx of [40, 140, 260, 380, 520, 600]) {
        ctx.fillStyle = '#5a3d24';
        ctx.fillRect(tx - 7, 200, 14, 100);
        ctx.fillStyle = '#2f6b2a';
        ctx.beginPath();
        ctx.arc(tx, 190, 45, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#5f7a3a';
      ctx.fillRect(470, 230, 10, 65);
      ctx.beginPath();
      ctx.ellipse(475, 225, 70, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8963c';
      ctx.lineWidth = 2;
      for (let i = 0; i < 60; i++) {
        const gx = (i * 37) % 640;
        ctx.beginPath();
        ctx.moveTo(gx, 560 - ((i * 23) % 260));
        ctx.lineTo(gx + 3, 548 - ((i * 23) % 260));
        ctx.stroke();
      }
    }
    if (!st.night && st.habitat !== 'forest') {
      ctx.fillStyle = st.habitat === 'desert' ? '#ffd34d' : '#fff3b0';
      ctx.beginPath();
      ctx.arc(580, 60, st.habitat === 'desert' ? 34 : 24, 0, Math.PI * 2);
      ctx.fill();
    }
    // The herd: animals whose "luck" is above the survival chance fade out
    herd.forEach((a) => drawAnimal(a.x, a.y, 0.55, a.luck > sc.survival, a.dir));
    ctx.font = fs(12, 700);
    ctx.fillStyle = st.night ? '#ffffff' : '#1d1d1d';
    ctx.textAlign = 'left';
    ctx.fillText(`${H.name} · ${st.temp} °C`, 16, 28);
    ctx.restore();

    /* Score panel (x 670–990) */
    const px = 670;
    drawAnimal(800, 150, 1, false, 1);
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    ctx.fillText('Your animal', 800, 222);
    const bars: [string, number][] = [
      ['Keeping the right temperature', sc.warmth],
      ['Saving water', sc.water],
      ['Finding food', sc.food],
      ['Hiding from predators', sc.hiding],
    ];
    ctx.textAlign = 'left';
    bars.forEach(([label, v], i) => {
      const y = 255 + i * 58;
      ctx.font = fs(11.5, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(label, px, y);
      ctx.fillStyle = 'rgba(128,128,128,0.25)';
      ctx.fillRect(px, y + 10, 310, 16);
      ctx.fillStyle = v > 0.75 ? pal.success : v > 0.45 ? pal.warning : pal.danger;
      ctx.fillRect(px, y + 10, 310 * v, 16);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(v * 100)}%`, px + 310, y);
      ctx.textAlign = 'left';
    });
    ctx.font = fs(15, 800);
    ctx.fillStyle = sc.survival > 0.6 ? pal.success : sc.survival > 0.3 ? pal.warning : pal.danger;
    ctx.fillText(`Survive the year: ${Math.round(sc.survival * 100)}%`, px, 515);
    ctx.restore();
    updateReadouts(sc);
  }

  function updateReadouts(sc: ReturnType<typeof scores>) {
    const H = HABITATS[st.habitat];
    ui.readout('survival', `${Math.round(sc.survival * 100)} % of animals like this survive a year`, sc.survival > 0.6 ? 'ok' : sc.survival > 0.3 ? 'warn' : 'bad');
    sim.setBadge(H.name);
    ui.readout('comfort', `Comfortable at about ${Math.round(sc.comfort)} °C (habitat feels like ${Math.round(sc.feltTemp)} °C)`);
    ui.readout('diet', `${DIET_NAME[st.diet]}: ${Math.round(H.food[st.diet] * 100)} % available here`);
    ui.readout('example', H.example);
    // the weakest score gives the main advice
    const parts: [string, number, string][] = [
      ['temperature', sc.warmth, sc.feltTemp < sc.comfort ? 'It is too cold: try thicker fur, a bigger body or smaller ears.' : 'It is too hot: try thinner fur, larger ears to lose heat, or being active at night.'],
      ['water', sc.water, 'Water is scarce: being small (to shelter in burrows) and active at night saves water.'],
      ['food', sc.food, `Its diet is hard to find here: choose food the habitat offers${H.cold ? ', or hibernate through winter' : ''}.`],
      ['predators', sc.hiding, `It stands out to predators: a ${H.coat} coat would blend in better.`],
    ];
    const worst = parts.reduce((a, b) => (b[1] < a[1] ? b : a));
    adviceEl.textContent = sc.survival > 0.8 ? 'Well adapted! This animal is suited to its habitat.' : `Biggest problem: ${worst[0]}. ${worst[2]}`;
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const tempCtl = ui.range('ad-temp', (v) => `${v} °C`, (v) => ((st.temp = v), sim.requestRender()));
  const habCtl = ui.choice<Habitat>('ad-hab', (v) => {
    st.habitat = v;
    tempCtl.set(HABITATS[v].temp);
  });
  const foodCtl = ui.range('ad-food', (v) => `${Math.round(v * 100)} %`, (v) => ((st.foodMul = v), sim.requestRender()));
  const predCtl = ui.range('ad-pred', (v) => (v < 0.3 ? 'Few' : v < 0.7 ? 'Some' : 'Many'), (v) => ((st.predators = v), sim.requestRender()));
  const trait = <K extends 'fur' | 'size' | 'ears' | 'coat' | 'diet'>(name: string, key: K) => ui.choice<(typeof st)[K]>(name, (v) => ((st[key] = v), sim.requestRender()));
  const furCtl = trait('ad-fur', 'fur');
  const sizeCtl = trait('ad-size', 'size');
  const earCtl = trait('ad-ears', 'ears');
  const coatCtl = trait('ad-coat', 'coat');
  const dietCtl = trait('ad-diet', 'diet');
  const nightCtl = ui.toggle('ad-night', (v) => ((st.night = v), sim.requestRender()));
  const hibCtl = ui.toggle('ad-hib', (v) => ((st.hibernate = v), sim.requestRender()));
  root.querySelector('[data-best]')!.addEventListener('click', () => {
    // a well-adapted design for the current habitat
    const best: Record<Habitat, [Fur, Size, Ears, Coat, Diet, boolean, boolean]> = {
      arctic: ['thick', 'medium', 'small', 'white', 'meat', false, false],
      desert: ['thin', 'small', 'large', 'sandy', 'insects', true, false],
      forest: ['medium', 'small', 'small', 'brown', 'seeds', false, true],
      grassland: ['thin', 'medium', 'large', 'golden', 'leaves', false, false],
    };
    const [f, s, e, c, d, n, hb] = best[st.habitat];
    furCtl.set(f);
    sizeCtl.set(s);
    earCtl.set(e);
    coatCtl.set(c);
    dietCtl.set(d);
    nightCtl.set(n);
    hibCtl.set(hb);
  });

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { habitat: 'arctic', temp: -20, foodMul: 1, predators: 0.6, fur: 'medium', size: 'medium', ears: 'large', coat: 'brown', diet: 'seeds', night: false, hibernate: false });
      habCtl.set('arctic', false);
      tempCtl.set(-20, false);
      foodCtl.set(1, false);
      predCtl.set(0.6, false);
      furCtl.set('medium', false);
      sizeCtl.set('medium', false);
      earCtl.set('large', false);
      coatCtl.set('brown', false);
      dietCtl.set('seeds', false);
      nightCtl.set(false, false);
      hibCtl.set(false, false);
    },
  });
}
