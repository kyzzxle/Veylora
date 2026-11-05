/**
 * Water cycle with a fixed number of water "parcels" (drops). Water is never
 * created or destroyed: each drop moves between stores by these processes,
 * each with a chance per second:
 *   evaporation      ocean → vapour (more with stronger sunshine)
 *   condensation     vapour → cloud once it has risen and cooled
 *   precipitation    cloud → rain or snow (more when clouds are big or are
 *                    pushed up over the mountain)
 *   infiltration     land surface → groundwater (depends on the ground cover)
 *   uptake and transpiration  land surface → plants → vapour
 *   runoff           land surface → river → ocean
 *   snowmelt         snow → land surface (when the sun is strong)
 *   groundwater flow ground → ocean or river (slowly)
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent'] as const;
type S = 'ocean' | 'vapour' | 'cloud' | 'fall' | 'surface' | 'river' | 'ground' | 'snow' | 'plant';
type Land = 'forest' | 'farm' | 'city';
const LAND: Record<Land, { infil: number; plant: number; name: string }> = {
  forest: { infil: 0.45, plant: 0.35, name: 'Forest' },
  farm: { infil: 0.3, plant: 0.15, name: 'Farmland' },
  city: { infil: 0.04, plant: 0.02, name: 'City (paved)' },
};
const N = 260;
const COAST = 340;
const SEA = 385;

interface Drop {
  s: S;
  x: number;
  y: number;
  t: number;
  c: number; // cloud index
  ox: number;
  oy: number;
}
interface Cloud {
  x: number;
  y: number;
}

/** Height of the land surface at x (mountain peak near x = 780). */
const landY = (x: number) => {
  if (x < COAST) return SEA + 6;
  if (x < 780) return SEA + 6 - ((x - COAST) / 440) ** 1.4 * 215;
  return 176 + ((x - 780) / 220) * 110;
};
const RIVER: [number, number][] = [[740, 205], [690, 238], [640, 262], [590, 300], [520, 330], [450, 360], [380, 378], [COAST, SEA + 2]];
const riverAt = (f: number): [number, number] => {
  const u = clamp(f, 0, 0.999) * (RIVER.length - 1);
  const i = Math.floor(u);
  const g = u - i;
  return [RIVER[i][0] + (RIVER[i + 1][0] - RIVER[i][0]) * g, RIVER[i][1] + (RIVER[i + 1][1] - RIVER[i][1]) * g];
};

export function initWaterCycle(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const st = { sun: 1, wind: 1, land: 'forest' as Land, labels: true };
  let drops: Drop[] = [];
  let clouds: Cloud[] = [];
  let flux = { evap: 0, transp: 0, precip: 0, runoff: 0, infil: 0 };
  let time = 0;
  let seed = 5;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

  function restart() {
    seed = 5;
    time = 0;
    flux = { evap: 0, transp: 0, precip: 0, runoff: 0, infil: 0 };
    clouds = [{ x: 200, y: 130 }];
    drops = [];
    for (let i = 0; i < N; i++) {
      const r = rnd();
      if (r < 0.78) drops.push(make('ocean', rnd() * COAST, SEA + 10 + rnd() * 160));
      else if (r < 0.9) {
        const x = COAST + 40 + rnd() * 560;
        drops.push(make('ground', x, landY(x) + 50 + rnd() * 70));
      } else if (r < 0.95) drops.push(make('snow', 740 + rnd() * 80, 0));
      else {
        const d = make('cloud', 200, 130);
        d.c = 0;
        drops.push(d);
      }
    }
    for (const d of drops) if (d.s === 'snow') d.y = landY(d.x) - 3;
  }
  function make(s: S, x: number, y: number): Drop {
    return { s, x, y, t: 0, c: -1, ox: (rnd() - 0.5) * 50, oy: (rnd() - 0.5) * 18 };
  }
  const set = (d: Drop, s: S) => {
    d.s = s;
    d.t = 0;
  };

  /* ---------- Model ---------- */
  function step(dt: number) {
    time += dt;
    const L = LAND[st.land];
    const cloudSize = new Array(clouds.length).fill(0);
    for (const d of drops) if (d.s === 'cloud' && d.c >= 0) cloudSize[d.c]++;
    // Clouds drift with the wind (from sea to land) and wrap round
    for (const c of clouds) {
      c.x += (8 + st.wind * 22) * dt;
      if (c.x > 1060) c.x = -60;
      // forced up over the mountain
      const ground = landY(clamp(c.x, 0, 1000));
      c.y += ((Math.min(140, ground - 120) - c.y) * 0.4) * dt;
    }
    for (const d of drops) {
      d.t += dt;
      const p = (rate: number) => rnd() < rate * dt;
      switch (d.s) {
        case 'ocean':
          d.x = clamp(d.x + (rnd() - 0.5) * 30 * dt, 4, COAST - 6);
          d.y = clamp(d.y + (rnd() - 0.5) * 30 * dt, SEA + 6, 552);
          if (p(0.012 * st.sun ** 1.5)) {
            set(d, 'vapour');
            d.y = SEA;
            flux.evap++;
          }
          break;
        case 'vapour':
          d.y -= 32 * dt;
          d.x += st.wind * 18 * dt;
          if (d.x > 1000) d.x -= 1000;
          if (d.y < 150 + d.oy) {
            // condense into the nearest cloud, or start a new one
            let best = -1;
            let bestD = 110;
            clouds.forEach((c, i) => {
              const dist = Math.abs(c.x - d.x);
              if (dist < bestD) ((bestD = dist), (best = i));
            });
            if (best < 0) {
              clouds.push({ x: d.x, y: d.y });
              best = clouds.length - 1;
            }
            d.c = best;
            set(d, 'cloud');
          }
          break;
        case 'cloud': {
          const c = clouds[d.c];
          if (!c) {
            set(d, 'vapour');
            break;
          }
          const n = cloudSize[d.c];
          const overMountain = c.x > 560 && c.x < 880;
          const rate = 0.004 + (n > 14 ? 0.03 : 0) + (overMountain ? 0.09 : 0);
          if (p(rate)) {
            set(d, 'fall');
            d.x = c.x + d.ox;
            d.y = c.y + 10;
            flux.precip++;
          }
          break;
        }
        case 'fall':
          d.y += 170 * dt;
          d.x += st.wind * 10 * dt;
          if (d.x > 1000) d.x -= 1000;
          if (d.y >= landY(d.x)) {
            if (d.x < COAST) set(d, 'ocean');
            else if (landY(d.x) < 250 && st.sun < 1.15) {
              set(d, 'snow');
              d.y = landY(d.x) - 3;
            } else {
              set(d, 'surface');
              d.y = landY(d.x) - 2;
            }
          }
          break;
        case 'snow':
          if (p(0.06 * Math.max(0, st.sun - 0.55))) {
            set(d, 'surface');
          }
          break;
        case 'surface':
          // flows downhill towards the coast
          d.x -= (14 + (st.land === 'city' ? 26 : 0)) * dt;
          d.y = landY(d.x) - 2;
          if (d.x < COAST) {
            set(d, 'ocean');
            flux.runoff++;
          } else if (p(L.infil)) {
            set(d, 'ground');
            d.y = landY(d.x) + 30 + rnd() * 60;
            flux.infil++;
          } else if (d.x > 400 && d.x < 660 && p(L.plant)) set(d, 'plant');
          else if (p(0.25 + (st.land === 'city' ? 0.6 : 0))) {
            set(d, 'river');
            // join the river at the nearest point downhill
            d.ox = clamp(1 - (d.x - COAST) / 420, 0, 0.95);
            flux.runoff++;
          }
          break;
        case 'river': {
          d.ox = Math.min(1, d.ox + dt * 0.18);
          [d.x, d.y] = riverAt(d.ox);
          if (d.ox >= 0.999) set(d, 'ocean');
          break;
        }
        case 'ground':
          d.x -= 5 * dt;
          d.y = clamp(d.y, landY(d.x) + 25, 552);
          if (d.x < COAST) {
            set(d, 'ocean');
            d.y = SEA + 60;
          } else if (p(0.004)) {
            set(d, 'river');
            d.ox = clamp(1 - (d.x - COAST) / 420, 0, 0.95);
          }
          break;
        case 'plant':
          if (d.t > 1.5 && p(0.25 * st.sun)) {
            set(d, 'vapour');
            d.y = landY(d.x) - 30;
            flux.transp++;
          }
          break;
      }
    }
    // Remove clouds that have rained out, renumbering the drops that remain
    const counts = new Array(clouds.length).fill(0);
    for (const d of drops) if (d.s === 'cloud') counts[d.c]++;
    const keep = clouds.map((_, i) => counts[i] > 0);
    if (keep.some((k) => !k)) {
      const map: number[] = [];
      let j = 0;
      keep.forEach((k, i) => (map[i] = k ? j++ : -1));
      clouds = clouds.filter((_, i) => keep[i]);
      for (const d of drops) if (d.s === 'cloud') d.c = map[d.c];
    }
  }

  /* ---------- Drawing ---------- */
  const tf = () => {
    const k = Math.min(size.w / 1000, size.h / 560);
    return { k, ox: (size.w - 1000 * k) / 2, oy: (size.h - 560 * k) / 2 };
  };

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.roundRect(0, 0, 1000, 560, 14);
    ctx.clip();
    const fs = (px: number, wt = 650) => font(px / k, wt);

    // Sky brightens with the sun
    const sky = ctx.createLinearGradient(0, 0, 0, 400);
    sky.addColorStop(0, `hsl(210, 60%, ${30 + st.sun * 20}%)`);
    sky.addColorStop(1, `hsl(200, 60%, ${55 + st.sun * 15}%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1000, 560);
    ctx.fillStyle = '#ffd34d';
    ctx.globalAlpha = clamp(0.4 + st.sun * 0.45, 0, 1);
    ctx.beginPath();
    ctx.arc(110, 70, 26 + st.sun * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Ocean
    ctx.fillStyle = '#1f5f9e';
    ctx.fillRect(0, SEA, COAST + 10, 175);
    // Land with soil and groundwater
    const landPath = new Path2D();
    landPath.moveTo(COAST - 10, 560);
    for (let x = COAST - 10; x <= 1000; x += 10) landPath.lineTo(x, landY(x));
    landPath.lineTo(1000, 560);
    landPath.closePath();
    ctx.fillStyle = '#7a5c3e';
    ctx.fill(landPath);
    ctx.save();
    ctx.clip(landPath);
    ctx.fillStyle = 'rgba(60, 120, 200, 0.28)';
    ctx.beginPath();
    ctx.moveTo(COAST - 10, 560);
    for (let x = COAST - 10; x <= 1000; x += 10) ctx.lineTo(x, Math.max(landY(x) + 30, SEA + 5));
    ctx.lineTo(1000, 560);
    ctx.fill();
    ctx.restore();
    // Surface cover
    ctx.strokeStyle = st.land === 'city' ? '#8c8c8c' : '#4f8a3a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = COAST; x <= 1000; x += 10) x === COAST ? ctx.moveTo(x, landY(x)) : ctx.lineTo(x, landY(x));
    ctx.stroke();
    for (let x = 410; x < 650; x += 34) {
      const y = landY(x);
      if (st.land === 'forest') {
        ctx.fillStyle = '#2f6b2a';
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x, y - 30);
        ctx.lineTo(x + 10, y);
        ctx.fill();
      } else if (st.land === 'farm') {
        ctx.strokeStyle = '#c9b45a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x - 8, y - 12);
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + 4, y - 14);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#9aa0a8';
        ctx.fillRect(x - 10, y - 26, 20, 26);
        ctx.fillStyle = '#d7dbe0';
        ctx.fillRect(x - 6, y - 22, 5, 5);
      }
    }
    // River
    ctx.strokeStyle = '#3b8ad6';
    ctx.lineWidth = 6;
    ctx.beginPath();
    RIVER.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();

    // Clouds
    const counts = new Array(clouds.length).fill(0);
    for (const d of drops) if (d.s === 'cloud') counts[d.c]++;
    clouds.forEach((c, i) => {
      const n = counts[i];
      const r = 12 + Math.sqrt(n) * 5;
      const grey = clamp(255 - n * 4, 150, 255);
      ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey + 5 > 255 ? 255 : grey + 5}, 0.95)`;
      ctx.beginPath();
      for (const [dx, dy, s] of [[-1, 0.2, 0.8], [0, -0.2, 1], [1, 0.2, 0.8], [-0.4, 0.3, 0.9], [0.5, 0.3, 0.9]])
        ctx.moveTo(c.x + dx * r + r * s, c.y + dy * r), ctx.arc(c.x + dx * r, c.y + dy * r, r * s, 0, Math.PI * 2);
      ctx.fill();
    });
    // Drops
    for (const d of drops) {
      switch (d.s) {
        case 'vapour':
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(d.x, d.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'fall':
          ctx.strokeStyle = landY(d.x) < 250 && st.sun < 1.15 ? '#ffffff' : '#9fd0ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 1, d.y + 7);
          ctx.stroke();
          break;
        case 'snow':
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'surface':
        case 'river':
          ctx.fillStyle = '#7cc3ff';
          ctx.beginPath();
          ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ground':
          ctx.fillStyle = '#4aa0e8';
          ctx.beginPath();
          ctx.arc(d.x, d.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ocean':
          ctx.fillStyle = 'rgba(140, 200, 255, 0.55)';
          ctx.beginPath();
          ctx.arc(d.x, d.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }

    // Labels
    if (st.labels) {
      const tag = (t: string, x: number, y: number) => {
        ctx.font = fs(11.5, 700);
        const tw = ctx.measureText(t).width;
        const ph = 22 / k;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = pal['bg-elev'];
        ctx.beginPath();
        ctx.roundRect(x - tw / 2 - 6 / k, y - ph / 2, tw + 12 / k, ph, ph / 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, x, y + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      };
      tag('Evaporation ↑', 210, 330);
      tag('Condensation', 330, 105);
      tag('Precipitation', 700, 120);
      tag('Transpiration ↑', 520, 200);
      tag('Runoff (river)', 500, 380);
      tag('Infiltration ↓', 760, 330);
      tag('Groundwater flow ←', 640, 520);
      tag('Ocean', 120, 470);
    }
    ctx.restore();
    updateReadouts();
    sim.setTime(time);
  }

  function updateReadouts() {
    const c: Record<S, number> = { ocean: 0, vapour: 0, cloud: 0, fall: 0, surface: 0, river: 0, ground: 0, snow: 0, plant: 0 };
    for (const d of drops) c[d.s]++;
    const pct = (n: number) => `${Math.round((100 * n) / N)} %`;
    ui.readout('ocean', pct(c.ocean));
    ui.readout('air', `${pct(c.vapour + c.cloud + c.fall)} (${c.cloud} drops in clouds)`);
    ui.readout('land', `${pct(c.surface + c.river + c.snow + c.plant)} (${c.snow} as snow, ${c.plant} in plants)`);
    ui.readout('ground', pct(c.ground));
    ui.readout('flows', `Evaporated ${flux.evap} · transpired ${flux.transp} · fell ${flux.precip} · ran off ${flux.runoff} · soaked in ${flux.infil}`);
    ui.readout('total', `${N} drops: water is never created or destroyed`);
    sim.setBadge(LAND[st.land].name);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const sun = ui.range('wc-sun', (v) => (v < 0.6 ? 'Weak (winter)' : v < 1.15 ? 'Moderate' : 'Strong (summer)'), (v) => ((st.sun = v), sim.requestRender()));
  const wind = ui.range('wc-wind', (v) => (v < 0.5 ? 'Calm' : v < 1.4 ? 'Breezy' : 'Windy'), (v) => (st.wind = v));
  const land = ui.choice<Land>('wc-land', (v) => ((st.land = v), sim.requestRender()));
  const labels = ui.toggle('wc-labels', (v) => ((st.labels = v), sim.requestRender()));

  restart();
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { sun: 1, wind: 1, land: 'forest', labels: true });
      sun.set(1, false);
      wind.set(1, false);
      land.set('forest', false);
      labels.set(true, false);
      restart();
    },
  });
}
