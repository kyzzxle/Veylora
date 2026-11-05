/**
 * Carbon cycle box model, 1850 to 2100 (carbon in GtC = billion tonnes).
 *
 * Stores start at pre-industrial values: atmosphere 590 (280 ppm; 2.12 GtC
 * per ppm), plants 450, soils 1,500, surface ocean 900, deep ocean 37,100.
 * Yearly flows:
 *   photosynthesis   120 × (1 + 0.3 ln(A/590)) × forest area (CO₂ fertilisation)
 *   plant respiration and litterfall   60 each × P/450
 *   soil respiration (decomposition)   60 × S/1500
 *   air → surface ocean   0.5 × (A − A_eq), where the ocean's equilibrium
 *                         CO₂ rises steeply as it fills: A_eq = 590 (O/900)^10
 *                         (Revelle buffer factor ≈ 10)
 *   surface → deep ocean  0.08 × (O − 900 · D/37100)
 *   fossil fuels and deforestation add carbon to the air; cleared forest
 *   also stops photosynthesising.
 * With historical emissions it reproduces the observed rise (about 369 ppm in
 * 2000 and 413 ppm in 2020, ocean sink about 3 GtC/yr, land about 2.5).
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent'] as const;
type Scenario = 'rising' | 'steady' | 'netzero' | 'custom';
const NOW = 2025;
// Fossil fuel + cement emissions (GtC per year), rounded from the Global Carbon Budget
const HIST: [number, number][] = [[1850, 0.05], [1900, 0.5], [1950, 1.6], [1970, 4.0], [1990, 6.1], [2000, 6.8], [2010, 9.0], [2020, 9.6], [2025, 10.1]];
const histFossil = (y: number) => {
  for (let i = 1; i < HIST.length; i++) if (y <= HIST[i][0]) return HIST[i - 1][1] + ((HIST[i][1] - HIST[i - 1][1]) * (y - HIST[i - 1][0])) / (HIST[i][0] - HIST[i - 1][0]);
  return HIST[HIST.length - 1][1];
};
const histLand = (y: number) => (y < 1950 ? 0.5 : y < 2000 ? 1.3 : 1.1);

const INFO: Record<string, [string, string]> = {
  air: ['Atmosphere', 'Carbon dioxide in the air. It is the smallest active store, so small changes make a big difference to its concentration and to the greenhouse effect.'],
  plants: ['Plants', 'Plants take in CO₂ for photosynthesis and release some back by respiration. Forests hold most of the carbon in living things on land.'],
  soil: ['Soils', 'Dead leaves, roots and organisms decompose slowly in the soil. Soils hold about three times as much carbon as plants.'],
  fossil: ['Fossil fuels', 'Coal, oil and gas formed over millions of years from buried plants and plankton. Burning them returns that ancient carbon to the air in decades.'],
  ocean: ['Surface ocean', 'CO₂ dissolves into the sea surface, forming carbonic acid. The ocean has absorbed about a quarter of human emissions, making it more acidic.'],
  deep: ['Deep ocean', 'By far the largest active store. Carbon reaches it slowly, through sinking cold water and the remains of plankton (the biological pump).'],
};

export function initCarbon(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const st = { scenario: 'steady' as Scenario, custom: 10, land: 1.1, speed: 5 };
  let year = 1850;
  let s = { A: 590, P: 450, S: 1500, O: 900, D: 37100, area: 1, emitted: 0, fossilLeft: 1000 + 470 };
  let f = { photo: 0, presp: 0, sresp: 0, ocean: 0, mix: 0, fossil: 0, land: 0 };
  let history: Point[] = [];
  let anim = 0;

  function restart() {
    year = 1850;
    s = { A: 590, P: 450, S: 1500, O: 900, D: 37100, area: 1, emitted: 0, fossilLeft: 1470 };
    history = [{ x: 1850, y: 280 }];
    fluxes();
  }

  const fossilAt = (y: number) => {
    if (y <= NOW) return histFossil(y);
    const now = histFossil(NOW);
    switch (st.scenario) {
      case 'rising':
        return now + (y - NOW) * 0.15;
      case 'steady':
        return now;
      case 'netzero':
        return Math.max(0, now * (1 - (y - NOW) / 25));
      case 'custom':
        return st.custom;
    }
  };
  const landAt = (y: number) => (y <= NOW ? histLand(y) : st.land);

  function fluxes() {
    f.photo = 120 * (1 + 0.3 * Math.log(s.A / 590)) * s.area;
    f.presp = (60 * s.P) / 450;
    f.sresp = (60 * s.S) / 1500;
    f.ocean = 0.5 * (s.A - 590 * (s.O / 900) ** 10);
    f.mix = 0.08 * (s.O - (900 * s.D) / 37100);
    f.fossil = Math.min(fossilAt(year), s.fossilLeft);
    f.land = landAt(year);
  }

  function step(dt: number) {
    anim += dt;
    if (year >= 2100) {
      sim.pause();
      return;
    }
    const years = dt * st.speed;
    const n = Math.ceil(years / 0.05);
    const h = years / n;
    for (let i = 0; i < n && year < 2100; i++) {
      fluxes();
      const litter = (60 * s.P) / 450;
      s.A += (f.fossil + f.land - f.photo + f.presp + f.sresp - f.ocean) * h;
      s.P += (f.photo - f.presp - litter - f.land) * h;
      s.S += (litter - f.sresp) * h;
      s.O += (f.ocean - f.mix) * h;
      s.D += f.mix * h;
      // clearing forest reduces photosynthesis; replanting (negative values) restores it
      s.area = clamp(s.area - (f.land * h) / 1800, 0.3, 1.1);
      s.emitted += (f.fossil + f.land) * h;
      s.fossilLeft -= f.fossil * h;
      year += h;
      if (Math.floor(year) > history[history.length - 1].x) history.push({ x: Math.floor(year), y: s.A / 2.12 });
    }
    fluxes();
  }

  /* ---------- Drawing (design box 1000 × 560) ---------- */
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
    const ppm = s.A / 2.12;
    const haze = clamp((ppm - 280) / 400, 0, 1);

    // Atmosphere: hazier as CO₂ rises
    const sky = ctx.createLinearGradient(0, 0, 0, 230);
    sky.addColorStop(0, `rgb(${60 + haze * 60}, ${110 + haze * 20}, ${190 - haze * 90})`);
    sky.addColorStop(1, `rgb(${160 + haze * 50}, ${200 - haze * 20}, ${235 - haze * 110})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1000, 240);
    // Land: surface, soil, rock with fossil fuels
    ctx.fillStyle = '#5c8a3c';
    ctx.fillRect(0, 230, 560, 22);
    ctx.fillStyle = '#6e4f33';
    ctx.fillRect(0, 252, 560, 120);
    ctx.fillStyle = '#4a4440';
    ctx.fillRect(0, 372, 560, 188);
    // fossil fuel seams shrink as they are burned
    const left = s.fossilLeft / 1470;
    ctx.fillStyle = '#1d1b1a';
    ctx.fillRect(40, 430, 470 * left, 26);
    ctx.fillStyle = '#2c241c';
    ctx.beginPath();
    ctx.ellipse(300, 505, 200 * left + 10, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ocean
    ctx.fillStyle = '#2f78c4';
    ctx.fillRect(560, 236, 440, 90);
    ctx.fillStyle = '#123a6b';
    ctx.fillRect(560, 326, 440, 234);
    // Trees: number follows forest area, size follows plant carbon
    const trees = Math.round(9 * s.area);
    const scale = clamp(s.P / 450, 0.6, 1.4);
    for (let i = 0; i < 10; i++) {
      const x = 40 + i * 30;
      if (i < trees) {
        ctx.fillStyle = '#5a3d24';
        ctx.fillRect(x - 3, 230 - 14 * scale, 6, 14 * scale);
        ctx.fillStyle = '#2f7a35';
        ctx.beginPath();
        ctx.arc(x, 230 - 24 * scale, 13 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#7a5b3a';
        ctx.fillRect(x - 4, 224, 8, 6);
      }
    }
    // Factory and power station
    ctx.fillStyle = '#7d828a';
    ctx.fillRect(400, 180, 90, 50);
    ctx.fillRect(420, 130, 14, 50);
    ctx.fillRect(450, 145, 14, 35);
    const smoke = clamp(f.fossil / 12, 0, 1.6);
    for (let i = 0; i < 8 * smoke; i++) {
      const t = (anim * 0.6 + i / 8) % 1;
      ctx.fillStyle = `rgba(120,120,120,${0.55 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(427 + t * 30 + Math.sin(i) * 6, 125 - t * 90, 8 + t * 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flux arrows: width shows size, moving dashes show direction
    const flow = (x1: number, y1: number, x2: number, y2: number, gt: number, colour: string, label: string, lx: number, ly: number) => {
      const wdt = clamp(2 + Math.abs(gt) * 0.5, 2, 14);
      const [ax, ay, bx, by] = gt >= 0 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -anim * 30;
      ctx.strokeStyle = colour;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
      arrow(ctx, ax + (bx - ax) * 0.82, ay + (by - ay) * 0.82, bx, by, colour, wdt, 12 + wdt);
      ctx.font = fs(11, 700);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${label} ${Math.abs(gt).toFixed(1)}`, lx, ly);
    };
    flow(110, 95, 110, 190, f.photo, '#5fd16f', 'Photosynthesis', 100, 84);
    flow(250, 190, 250, 80, f.presp + f.sresp, '#ffb066', 'Respiration & decay', 262, 66);
    flow(470, 120, 470, 40, f.fossil, '#9a9a9a', 'Fossil fuels', 470, 30);
    if (f.land > 0.05) flow(330, 200, 330, 120, f.land, '#e0605a', 'Deforestation', 330, 110);
    else if (f.land < -0.05) flow(330, 120, 330, 200, -f.land, '#5fd16f', 'Tree planting', 330, 110);
    flow(780, 120, 780, 230, f.ocean, '#7cc3ff', 'Into ocean', 780, 110);
    flow(860, 300, 860, 380, f.mix, '#5aa0e8', 'To deep ocean', 900, 400);
    // Store labels
    const store = (title: string, gt: number, x: number, y: number) => {
      const t = `${title}: ${Math.round(gt).toLocaleString()} GtC`;
      ctx.font = fs(12, 750);
      const tw = ctx.measureText(t).width;
      const ph = 22 / k;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = pal['bg-elev'];
      ctx.beginPath();
      ctx.roundRect(x - tw / 2 - 7 / k, y - ph / 2, tw + 14 / k, ph, ph / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, x, y + 1);
      ctx.textBaseline = 'alphabetic';
    };
    store(`Atmosphere (${Math.round(ppm)} ppm CO₂)`, s.A, 680, 40);
    store('Plants', s.P, 110, 268);
    store('Soils', s.S, 260, 330);
    store('Fossil fuels left', s.fossilLeft, 280, 400);
    store('Surface ocean', s.O, 680, 262);
    store('Deep ocean', s.D, 760, 470);
    ctx.font = fs(26, 800);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(year)), 985, 210);
    ctx.font = fs(11, 650);
    ctx.fillText('Arrows: GtC per year', 985, 228);
    ctx.textAlign = 'left';
    ctx.restore();
    updateReadouts();
    drawGraph();
  }

  function updateReadouts() {
    const ppm = s.A / 2.12;
    ui.readout('year', `${Math.floor(year)}${year > NOW ? ' (future scenario)' : ''}`);
    sim.setBadge(year > NOW ? 'Future' : 'History');
    ui.readout('ppm', `${Math.round(ppm)} ppm (pre-industrial 280)`, ppm > 450 ? 'bad' : ppm > 350 ? 'warn' : null);
    ui.readout('emis', `${(f.fossil + f.land).toFixed(1)} GtC per year (${((f.fossil + f.land) * 3.664).toFixed(0)} billion tonnes of CO₂)`);
    const landSink = f.photo - f.presp - f.sresp;
    ui.readout('sinks', `Ocean ${f.ocean.toFixed(1)} · land ${landSink.toFixed(1)} GtC per year`);
    const airborne = s.emitted > 1 ? (s.A - 590) / s.emitted : 0;
    ui.readout('airborne', s.emitted > 1 ? `${Math.round(airborne * 100)} % of all carbon emitted since 1850` : '—');
    ui.readout('ph', (8.18 - 0.6 * Math.log10(ppm / 280)).toFixed(2));
    const warm = 3 * Math.log2(ppm / 280);
    ui.readout('warm', `about ${warm.toFixed(1)} °C above pre-industrial`, warm > 2 ? 'bad' : warm > 1.5 ? 'warn' : null);
  }

  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="cc-graph"]')!, {
    x: { min: 1850, span: 250, max: 2100, step: 50, format: (x) => `${x}` },
    y: { min: 250, max: 650, step: 100, format: (v) => `${v}` },
    refs: [
      { value: 280, label: 'Pre-industrial', color: 'text-faint' },
      { value: NOW, label: 'Today', color: 'text-faint', axis: 'x' },
    ],
  });
  function drawGraph() {
    const top = Math.max(650, Math.ceil(Math.max(...history.map((p) => p.y)) / 100) * 100 + 50);
    graph.opts.y = { min: 250, max: top, step: 100, format: (v) => `${v}` };
    graph.set('co2', { label: 'CO₂ in the air (ppm)', color: 'accent', points: history });
    graph.draw();
  }

  /* ---------- Interaction ---------- */
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - r.left - ox) / k;
    const y = (e.clientY - r.top - oy) / k;
    const id = y < 228 ? 'air' : x < 560 ? (y < 252 ? 'plants' : y < 372 ? 'soil' : 'fossil') : y < 326 ? 'ocean' : 'deep';
    sim.showTooltip(e.clientX - r.left, e.clientY - r.top, INFO[id][0], INFO[id][1]);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const scen = ui.choice<Scenario>('cc-scen', (v) => {
    st.scenario = v;
    ui.showWhen('[data-custom-only]', v === 'custom');
    fluxes();
    sim.requestRender();
  });
  const custom = ui.range('cc-custom', (v) => `${v} GtC per year`, (v) => ((st.custom = v), sim.requestRender()));
  const land = ui.range('cc-land', (v) => (v < 0 ? `Planting: ${-v} GtC per year` : v === 0 ? 'None' : `${v} GtC per year`), (v) => ((st.land = v), sim.requestRender()));
  const speed = ui.range('cc-speed', (v) => `${v} years per second`, (v) => (st.speed = v));
  ui.showWhen('[data-custom-only]', false);

  restart();
  const sim = createSimController(root, {
    step,
    render,
    onPlayChange: (playing) => playing && year >= 2100 && restart(),
    reset() {
      Object.assign(st, { scenario: 'steady', custom: 10, land: 1.1, speed: 5 });
      scen.set('steady', false);
      custom.set(10, false);
      land.set(1.1, false);
      speed.set(5, false);
      ui.showWhen('[data-custom-only]', false);
      restart();
    },
  });
}
