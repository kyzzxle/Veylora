/**
 * Plate tectonics: four kinds of plate boundary.
 *
 * Cross-sections (1 s of animation = 1 million years):
 *   divergent  – a mid-ocean ridge. New sea floor forms at the ridge and is
 *                magnetised in the direction of Earth's field at the time,
 *                giving symmetric stripes as the field reverses. The sea
 *                floor deepens with age: depth ≈ 2.5 km + 0.35 km × √(age in Myr).
 *   subduction – an ocean plate sinks under a continent: trench, deep
 *                earthquakes along the slab, and a volcanic mountain arc.
 *   collision  – two continents collide and crumple into high mountains.
 * Map view (1 s = 20 years):
 *   transform  – plates slide past each other. The fault is locked, so the
 *                ground bends elastically until the stored slip is released
 *                in an earthquake (elastic rebound). Magnitude from average
 *                slip D (metres): M ≈ 7.04 + 0.89 log10 D (Wells & Coppersmith, 1994).
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent', 'warning', 'danger'] as const;
type Kind = 'divergent' | 'subduction' | 'collision' | 'transform';

const INFO: Record<Kind, { title: string; feature: string; example: string; hazards: string; text: string }> = {
  divergent: {
    title: 'Divergent boundary',
    feature: 'Mid-ocean ridge and new ocean floor',
    example: 'Mid-Atlantic Ridge (Iceland sits on top of it); East African Rift on land',
    hazards: 'Frequent small, shallow earthquakes; gentle volcanic eruptions',
    text: 'The plates pull apart. Hot mantle rock rises, partly melts and fills the gap, so new ocean crust forms at the ridge. Each strip of new rock records the direction of Earth’s magnetic field as it cools, making mirror-image stripes on both sides.',
  },
  subduction: {
    title: 'Convergent boundary (ocean meets continent)',
    feature: 'Deep ocean trench and a chain of volcanic mountains',
    example: 'The Andes and the Peru–Chile Trench; the Cascades',
    hazards: 'The largest earthquakes on Earth (up to magnitude 9+), tsunamis and explosive volcanoes',
    text: 'The denser ocean plate dives beneath the lighter continent. Earthquakes happen along the sinking slab, getting deeper inland. At about 100 km depth, water released from the slab melts the mantle above it, feeding a line of volcanoes.',
  },
  collision: {
    title: 'Convergent boundary (continent meets continent)',
    feature: 'High fold mountains with a thick crustal root',
    example: 'The Himalayas, formed as India collides with Asia (still rising a few mm per year)',
    hazards: 'Large shallow earthquakes and landslides; few volcanoes',
    text: 'Continental crust is too light to sink, so when two continents meet the crust crumples, folds and stacks up. The mountains rise and a deep root of crust pushes down into the mantle beneath them.',
  },
  transform: {
    title: 'Transform boundary',
    feature: 'A long fault where the ground is offset sideways',
    example: 'The San Andreas Fault, California',
    hazards: 'Sudden shallow earthquakes; no volcanoes',
    text: 'The plates slide past each other. Friction locks the fault, so the rocks bend like a stretched spring. When the stress becomes too great the fault suddenly slips, releasing the energy as an earthquake and snapping the ground back.',
  },
};

export function initTectonics(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const textEl = root.querySelector<HTMLElement>('[data-kind-text]')!;

  const st = { kind: 'divergent' as Kind, speed: 5, convection: true, quakes: true, labels: true };
  let t = 0; // Myr, or years for the transform view
  let quakes: { x: number; y: number; age: number }[] = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  // Magnetic reversals: times (Myr) when the field flipped, irregular like the real record
  const reversals: number[] = [];
  for (let x = 0; x < 400; x += 0.3 + rnd() * 1.4) reversals.push(x);
  const polarityAt = (time: number) => reversals.filter((r) => r <= time).length % 2 === 0;
  // Transform fault state
  let slip = 0; // metres released on the fault so far
  let nextQuakeAt = 5;
  let lastMag = 0;
  let quakeCount = 0;
  let shake = 0;

  function restart() {
    t = 0;
    quakes = [];
    slip = 0;
    lastMag = 0;
    quakeCount = 0;
    nextQuakeAt = 4 + rnd() * 2;
    shake = 0;
  }

  /* ---------- Model ---------- */
  function step(dt: number) {
    if (st.kind === 'transform') {
      t += dt * 20; // years
      const total = (st.speed / 100) * t; // metres of plate motion
      if (total - slip > nextQuakeAt) {
        const D = total - slip;
        slip = total;
        lastMag = 7.04 + 0.89 * Math.log10(D);
        quakeCount++;
        shake = 1;
        nextQuakeAt = 4 + rnd() * 2.5;
        sim.announce(`Earthquake! About magnitude ${lastMag.toFixed(1)}.`);
      }
      shake = Math.max(0, shake - dt * 1.5);
      return;
    }
    t += dt;
    // Earthquakes where they really happen at each boundary
    if (st.quakes && rnd() < dt * 4) {
      if (st.kind === 'divergent') quakes.push({ x: 500 + (rnd() - 0.5) * 40, y: 205 + rnd() * 30, age: 0 });
      if (st.kind === 'subduction') {
        const s = rnd() * 520;
        const [x, y] = slabPoint(380 + s);
        quakes.push({ x, y: y + 10 + rnd() * 15, age: 0 });
      }
      if (st.kind === 'collision') quakes.push({ x: 500 + (rnd() - 0.5) * 220, y: 170 + rnd() * 90, age: 0 });
    }
    for (const q of quakes) q.age += dt;
    quakes = quakes.filter((q) => q.age < 1.2);
  }

  /** Point along the top of the subducting plate, s measured from the left edge. */
  function slabPoint(s: number): [number, number] {
    if (s <= 520) return [s, 230];
    const u = s - 520;
    // bends down to about 35° and continues straight
    const a = Math.min(0.62, u / 260);
    const bendLen = 0.62 * 260;
    if (u <= bendLen) {
      const ang = u / 260;
      return [520 + 260 * Math.sin(ang), 230 + 260 * (1 - Math.cos(ang))];
    }
    const [bx, by] = [520 + 260 * Math.sin(0.62), 230 + 260 * (1 - Math.cos(0.62))];
    return [bx + (u - bendLen) * Math.cos(a), by + (u - bendLen) * Math.sin(a)];
  }

  /* ---------- Layout ---------- */
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
    const jitter = shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
    ctx.translate(ox + jitter, oy + jitter * 0.6);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    const tag = (text: string, x: number, y: number, align: CanvasTextAlign = 'center') => {
      if (!st.labels) return;
      ctx.font = fs(12, 700);
      const tw = ctx.measureText(text).width;
      const ph = 22 / k;
      const bx = align === 'center' ? x - tw / 2 : align === 'left' ? x : x - tw;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = pal['bg-elev'];
      ctx.beginPath();
      ctx.roundRect(bx - 7 / k, y - ph / 2, tw + 14 / k, ph, ph / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx, y + 1);
      ctx.textBaseline = 'alphabetic';
    };

    if (st.kind === 'transform') drawTransform(fs, tag);
    else {
      drawMantle();
      if (st.kind === 'divergent') drawDivergent(tag);
      if (st.kind === 'subduction') drawSubduction(tag);
      if (st.kind === 'collision') drawCollision(tag);
      for (const q of quakes) {
        ctx.globalAlpha = clamp(1.2 - q.age, 0, 1);
        ctx.fillStyle = pal.warning;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 5 + q.age * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.font = fs(11, 650);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'left';
      ctx.fillText('Cross-section, not to scale (vertical exaggeration)', 14, 548);
    }
    ctx.restore();
    updateReadouts();
  }

  function drawMantle() {
    const g = ctx.createLinearGradient(0, 220, 0, 560);
    g.addColorStop(0, '#c9622f');
    g.addColorStop(1, '#7a2416');
    ctx.fillStyle = g;
    ctx.fillRect(0, 220, 1000, 340);
    ctx.fillStyle = '#7fb7e6';
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, 0, 1000, 120);
    ctx.globalAlpha = 1;
    if (st.convection) {
      // Convection currents: rising under ridges, sinking where plates descend
      const cells: [number, number, number][] =
        st.kind === 'divergent' ? [[300, 410, 1], [700, 410, -1]] : st.kind === 'subduction' ? [[300, 420, -1], [760, 450, 1]] : [[280, 420, -1], [720, 420, 1]];
      ctx.strokeStyle = 'rgba(255, 230, 190, 0.55)';
      ctx.lineWidth = 3;
      for (const [cx, cy, dir] of cells) {
        const phase = (t * 0.6) % (Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 170, 80, 0, phase, phase + Math.PI * 1.4);
        ctx.stroke();
        const end = phase + Math.PI * 1.4;
        const ex = cx + 170 * Math.cos(end);
        const ey = cy + 80 * Math.sin(end);
        const tx = -170 * Math.sin(end) * dir;
        const ty = 80 * Math.cos(end) * dir;
        const l = Math.hypot(tx, ty) || 1;
        arrow(ctx, ex - (tx / l) * 4, ey - (ty / l) * 4, ex + (tx / l) * 14, ey + (ty / l) * 14, 'rgba(255, 230, 190, 0.8)', 3, 12);
      }
    }
  }

  function drawDivergent(tag: (s: string, x: number, y: number, a?: CanvasTextAlign) => void) {
    const v = st.speed; // cm/yr = km/Myr ×10 … 1 cm/yr = 10 km/Myr
    const halfKmPerMyr = (v * 10) / 2;
    const pxPerKm = 0.5; // horizontal scale
    // Sea floor depth profile from age: d = 2.5 + 0.35 √age (km); drawn with vertical exaggeration
    const depthAt = (x: number) => {
      const age = Math.abs(x - 500) / pxPerKm / halfKmPerMyr; // Myr
      return 2.5 + 0.35 * Math.sqrt(Math.min(age, t + 200));
    };
    const ySea = (x: number) => 120 + (depthAt(x) - 2.5) * 22 + 40;
    // Water
    ctx.fillStyle = 'rgba(40, 110, 190, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 120);
    ctx.lineTo(1000, 120);
    for (let x = 1000; x >= 0; x -= 10) ctx.lineTo(x, ySea(x));
    ctx.fill();
    // Oceanic lithosphere with magnetic stripes: rock at distance d from the ridge formed (d / speed) Myr ago
    for (let x = 0; x < 1000; x += 2) {
      const dist = Math.abs(x + 1 - 500) / pxPerKm; // km
      const age = dist / halfKmPerMyr;
      const formedAt = t - age;
      const top = ySea(x);
      const thick = 26 + Math.sqrt(age) * 4;
      ctx.fillStyle = formedAt < 0 ? '#5d5a57' : polarityAt(formedAt) ? '#2f3b55' : '#c9c2b4';
      ctx.fillRect(x, top, 2.2, thick);
    }
    // Rising magma under the ridge
    const g = ctx.createRadialGradient(500, 250, 5, 500, 250, 70);
    g.addColorStop(0, 'rgba(255, 200, 80, 0.95)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(500, 240, 60, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    arrow(ctx, 380, 190, 260, 190, '#ffffff', 4, 14);
    arrow(ctx, 620, 190, 740, 190, '#ffffff', 4, 14);
    tag('Mid-ocean ridge', 500, 140);
    tag('New ocean crust (magnetic stripes)', 250, 300);
    tag('Rising magma', 500, 330);
    tag('Mantle (asthenosphere)', 820, 470);
    tag('Ocean', 120, 145);
  }

  function drawSubduction(tag: (s: string, x: number, y: number, a?: CanvasTextAlign) => void) {
    const mt = Math.min(75, t * 3); // mountain height
    // Ocean water over the oceanic plate
    ctx.fillStyle = 'rgba(40, 110, 190, 0.55)';
    ctx.fillRect(0, 120, 540, 110);
    // Oceanic plate: drawn as a thick band along the slab path, with moving markers
    const thick = 34;
    // The plate is drawn as a thick stroke along the slab path
    ctx.strokeStyle = '#3d4658';
    ctx.lineWidth = thick;
    ctx.beginPath();
    for (let s = 0; s <= 900; s += 10) {
      const [x, y] = slabPoint(s);
      s === 0 ? ctx.moveTo(x, y + thick / 2) : ctx.lineTo(x, y + thick / 2);
    }
    ctx.stroke();
    // Moving markers show the plate travelling into the mantle
    const pxPerMyr = st.speed * 1.2;
    ctx.fillStyle = '#9aa7c2';
    for (let s = (t * pxPerMyr) % 60; s < 900; s += 60) {
      const [x, y] = slabPoint(s);
      ctx.fillRect(x - 3, y + 8, 6, thick - 16);
    }
    // Continental plate
    ctx.fillStyle = '#9c8461';
    ctx.beginPath();
    ctx.moveTo(500, 140);
    ctx.lineTo(560, 120);
    ctx.lineTo(640, 120);
    ctx.lineTo(700, 120 - mt);
    ctx.lineTo(735, 112 - mt * 0.7);
    ctx.lineTo(770, 120 - mt * 0.85);
    ctx.lineTo(840, 120);
    ctx.lineTo(1000, 120);
    ctx.lineTo(1000, 260);
    ctx.lineTo(760, 260);
    for (let s = 760; s >= 520; s -= 10) {
      const [x, y] = slabPoint(s);
      ctx.lineTo(x, y - 2);
    }
    ctx.lineTo(520, 230);
    ctx.closePath();
    ctx.fill();
    // Trench
    ctx.fillStyle = 'rgba(20, 60, 120, 0.8)';
    ctx.beginPath();
    ctx.moveTo(470, 230);
    ctx.quadraticCurveTo(515, 262, 540, 228);
    ctx.fill();
    // Magma rising from the slab to the volcano
    const pulse = (t * 2) % 1;
    ctx.fillStyle = 'rgba(255, 150, 50, 0.85)';
    for (let i = 0; i < 4; i++) {
      const f = (pulse + i / 4) % 1;
      ctx.beginPath();
      ctx.arc(735 + Math.sin(f * 9) * 6, 360 - f * (240 + mt * 0.7), 7 - f * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (mt > 20 && Math.sin(t * 3) > 0.6) {
      ctx.fillStyle = 'rgba(140, 140, 140, 0.6)';
      ctx.beginPath();
      ctx.arc(738, 100 - mt * 0.7 - 20, 18, 0, Math.PI * 2);
      ctx.arc(750, 100 - mt * 0.7 - 40, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    arrow(ctx, 150, 205, 300, 205, '#ffffff', 4, 14);
    tag('Ocean plate (dense)', 180, 255);
    tag('Continental plate (lighter)', 880, 200);
    tag('Trench', 470, 280);
    tag('Volcanic mountains', 610, 120 - mt - 22);
    tag('Slab melts mantle above it', 720, 400);
  }

  function drawCollision(tag: (s: string, x: number, y: number, a?: CanvasTextAlign) => void) {
    const H = Math.min(150, t * 5);
    const root = H * 0.9;
    // Continental crust: two plates meeting, thickened in the middle
    const top = (x: number) => 140 - H * Math.exp(-(((x - 500) / 150) ** 2));
    const bottom = (x: number) => 260 + root * Math.exp(-(((x - 500) / 180) ** 2));
    ctx.fillStyle = '#a58b62';
    ctx.beginPath();
    for (let x = 0; x <= 1000; x += 10) x === 0 ? ctx.moveTo(x, top(x)) : ctx.lineTo(x, top(x));
    for (let x = 1000; x >= 0; x -= 10) ctx.lineTo(x, bottom(x));
    ctx.fill();
    // Folded rock layers, buckling more as the mountains grow
    ctx.save();
    ctx.beginPath();
    for (let x = 0; x <= 1000; x += 10) x === 0 ? ctx.moveTo(x, top(x)) : ctx.lineTo(x, top(x));
    for (let x = 1000; x >= 0; x -= 10) ctx.lineTo(x, bottom(x));
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(90, 70, 45, 0.5)' : 'rgba(220, 200, 160, 0.45)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let x = 0; x <= 1000; x += 6) {
        const frac = (i + 1) / 7;
        const base = top(x) + (bottom(x) - top(x)) * frac;
        const fold = Math.exp(-(((x - 500) / 200) ** 2)) * Math.sin((x - 500) / 22) * (H / 150) * 18;
        x === 0 ? ctx.moveTo(x, base + fold) : ctx.lineTo(x, base + fold);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Snow caps on the highest peaks
    if (H > 80) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      for (let x = 430; x <= 570; x += 5) x === 430 ? ctx.moveTo(x, top(x)) : ctx.lineTo(x, top(x));
      ctx.lineTo(570, top(570) + 12);
      ctx.lineTo(430, top(430) + 12);
      ctx.fill();
    }
    arrow(ctx, 90, 200, 230, 200, '#ffffff', 4, 14);
    arrow(ctx, 910, 200, 770, 200, '#ffffff', 4, 14);
    tag('Fold mountains', 500, top(500) - 28);
    tag('Continent', 120, 240);
    tag('Continent', 880, 240);
    tag('Thick crustal root', 500, bottom(500) + 30);
  }

  function drawTransform(fs: (px: number, wt?: number) => string, tag: (s: string, x: number, y: number, a?: CanvasTextAlign) => void) {
    // Map view: west plate moves north (up), east plate moves south, relative to each other
    const total = (st.speed / 100) * t; // metres
    const stored = total - slip;
    const PX = 6; // px per metre (hugely exaggerated)
    ctx.fillStyle = '#5f7f4a';
    ctx.fillRect(0, 0, 500, 560);
    ctx.fillStyle = '#7a8f52';
    ctx.fillRect(500, 0, 500, 560);
    const disp = (x: number) => {
      const side = x < 500 ? 1 : -1;
      const d = Math.abs(x - 500);
      return side * (slip / 2 + (stored / 2) * (1 - Math.exp(-d / 140)));
    };
    // Roads (fences) crossing the fault, offset by the motion
    const spacing = 140;
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = 6;
    // Roads repeat every `spacing` px, so wrap their positions; start a new line where one wraps
    const road = (base: number, x0: number, x1: number) => {
      ctx.beginPath();
      let prev = NaN;
      for (let x = x0; x <= x1; x += 5) {
        const y = ((((base - disp(x) * PX) % (spacing * 5)) + spacing * 5) % (spacing * 5)) - spacing;
        if (Number.isNaN(prev) || Math.abs(y - prev) > spacing) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        prev = y;
      }
      ctx.stroke();
    };
    for (let base = 0; base < spacing * 5; base += spacing) {
      road(base, 0, 495);
      road(base, 505, 1000);
    }
    // Fault line
    ctx.strokeStyle = shake > 0 ? pal.danger : 'rgba(200, 50, 50, 0.9)';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(500, 0);
    ctx.lineTo(500, 560);
    ctx.stroke();
    ctx.setLineDash([]);
    arrow(ctx, 250, 470, 250, 390, '#ffffff', 5, 16);
    arrow(ctx, 750, 390, 750, 470, '#ffffff', 5, 16);
    // Stress meter
    const frac = clamp(stored / 6.5, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(820, 100, 150, 18);
    ctx.fillStyle = frac > 0.75 ? pal.danger : pal.warning;
    ctx.fillRect(820, 100, 150 * frac, 18);
    ctx.font = fs(11, 700);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('Stored strain', 820, 136);
    if (shake > 0) {
      ctx.font = fs(26, 800);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`EARTHQUAKE · M ${lastMag.toFixed(1)}`, 500, 290);
    }
    tag('Pacific plate moving north-west', 250, 505);
    tag('North American plate', 750, 505);
    tag('Fault (locked)', 500, 40);
    ctx.font = fs(11, 650);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('Map view from above · ground movement exaggerated', 14, 548);
  }

  function updateReadouts() {
    const info = INFO[st.kind];
    ui.readout('kind', info.title);
    sim.setBadge(info.title.split(' (')[0]);
    textEl.textContent = info.text;
    ui.readout('feature', info.feature);
    ui.readout('example', info.example);
    ui.readout('hazards', info.hazards);
    if (st.kind === 'transform') {
      const total = (st.speed / 100) * t;
      ui.readout('time', `${Math.round(t).toLocaleString()} years`);
      ui.readout('moved', `${total.toFixed(1)} m of plate motion · ${(total - slip).toFixed(1)} m stored as strain`);
      ui.readout('quakes', quakeCount ? `${quakeCount} so far · last about magnitude ${lastMag.toFixed(1)}` : 'None yet: strain is building', shake > 0 ? 'bad' : null);
    } else {
      ui.readout('time', `${t.toFixed(1)} million years`);
      const km = st.speed * 10 * t;
      ui.readout('moved', st.kind === 'divergent' ? `${Math.round(km).toLocaleString()} km of new ocean floor (both sides together)` : `${Math.round(km).toLocaleString()} km of convergence`);
      ui.readout(
        'quakes',
        st.kind === 'subduction' ? 'Shallow near the trench, down to about 700 km deep under the continent' : st.kind === 'collision' ? 'Shallow and widespread' : 'Shallow, along the ridge',
      );
    }
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const kindCtl = ui.choice<Kind>('pt-kind', (v) => {
    st.kind = v;
    restart();
    sim.requestRender();
  });
  const speed = ui.range('pt-speed', (v) => `${v} cm per year`, (v) => ((st.speed = v), sim.requestRender()));
  const conv = ui.toggle('pt-conv', (v) => ((st.convection = v), sim.requestRender()));
  const qk = ui.toggle('pt-quakes', (v) => ((st.quakes = v), sim.requestRender()));
  const lab = ui.toggle('pt-labels', (v) => ((st.labels = v), sim.requestRender()));

  restart();
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { kind: 'divergent', speed: 5, convection: true, quakes: true, labels: true });
      kindCtl.set('divergent', false);
      speed.set(5, false);
      conv.set(true, false);
      qk.set(true, false);
      lab.set(true, false);
      restart();
    },
  });
}
