/**
 * Tides and the Earth–Moon–Sun system (equilibrium tide).
 *
 * Tidal acceleration from a body of mass M at distance d scales as M / d³.
 * With real masses and distances the Sun's tidal effect is about 0.46 of the
 * Moon's. The equilibrium tide raised by each body at a point at angle α from
 * the body's direction is η = A · cos 2α, with amplitude
 *     A = ¾ (M / M_Earth) (R_Earth / d)³ R_Earth   (≈ 0.27 m Moon, 0.12 m Sun).
 * The two add, so the tidal range is
 *     2 √(A_m² + A_s² + 2 A_m A_s cos 2ψ)
 * where ψ is the Moon's angle from the Sun: largest at new and full moon
 * (spring tides), smallest at the quarters (neap tides).
 *
 * The town is on the equator, and the Moon and Sun are taken to lie in the
 * equatorial plane (no declination), so the two daily tides are equal.
 * Real coastal tides are shaped by ocean basins, coastlines and depth and can
 * be many times larger, smaller, or delayed.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { arrow, font } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'sim-water'] as const;
type Fs = (px: number, w?: number) => string;
type Dist = 'near' | 'mean' | 'far';
type Show = 'both' | 'moon' | 'sun';

const DEG = Math.PI / 180;
const M_EARTH = 5.972e24;
const M_MOON = 7.342e22;
const M_SUN = 1.989e30;
const R_EARTH = 6371e3;
const D_SUN = 149.6e9;
const DISTS: Record<Dist, number> = { near: 363300e3, mean: 384400e3, far: 405500e3 };
const SYNODIC_H = 29.53 * 24;
const DEF = { psi: 0, hour: 12, dist: 'mean' as Dist, show: 'both' as Show, forces: true, speed: 2 };

const amp = (M: number, d: number) => 0.75 * (M / M_EARTH) * Math.pow(R_EARTH / d, 3) * R_EARTH;
const A_SUN = amp(M_SUN, D_SUN);

export function initTides(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  const aMoon = () => amp(M_MOON, DISTS[st.dist]);
  const aSun = () => A_SUN;
  const useM = () => (st.show === 'sun' ? 0 : 1);
  const useS = () => (st.show === 'moon' ? 0 : 1);
  /** Water height (m) at a point whose angle (from the Sun direction) is a, with the Moon at elongation psi. */
  const eta = (a: number, psi = st.psi) => useM() * aMoon() * Math.cos(2 * (a - psi) * DEG) + useS() * aSun() * Math.cos(2 * a * DEG);
  const range = (psi = st.psi) => {
    const m = useM() * aMoon();
    const s = useS() * aSun();
    return 2 * Math.sqrt(m * m + s * s + 2 * m * s * Math.cos(2 * psi * DEG));
  };
  const springRange = () => 2 * (aMoon() + aSun());
  const neapRange = () => 2 * Math.abs(aMoon() - aSun());
  /** The town's angle from the Sun direction (local solar time: noon faces the Sun). */
  const townAngle = (hour = st.hour) => (hour - 12) * 15;
  const phaseName = (t: number) => ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Third quarter', 'Waning crescent'][Math.floor((((t + 22.5) % 360) + 360) % 360 / 45)];
  const alignment = () => {
    const c = Math.cos(2 * st.psi * DEG);
    return c > 0.85 ? 'spring' : c < -0.85 ? 'neap' : 'between';
  };

  /* ---------- Time ---------- */
  function step(dt: number) {
    const h = dt * st.speed;
    st.hour = (st.hour + h) % 24;
    st.psi = (st.psi + (360 / SYNODIC_H) * h) % 360;
    psiCtl.set(Math.round(st.psi) % 360, false);
    hourCtl.set(Math.round(st.hour * 4) / 4, false);
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 1133] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  const centre = () => (portrait() ? { ex: 360, ey: 300, orbit: 225 } : { ex: 390, ey: 305, orbit: 225 });
  const panel = () => (portrait() ? { x: 30, y: 600, w: 620 } : { x: 660, y: 70, w: 320 });
  const R = 92; // Earth's drawn radius
  const WATER = 110; // px per metre of tide: hugely exaggerated
  const moonXY = () => {
    const c = centre();
    const a = Math.PI + st.psi * DEG;
    return { x: c.ex + Math.cos(a) * c.orbit, y: c.ey - Math.sin(a) * c.orbit };
  };

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];

  /** Screen direction (math angle, radians) for an angle measured from the Sun direction (the Sun is to the left). */
  const dirOf = (a: number) => Math.PI + a * DEG;

  function drawMain(fs: Fs, k: number) {
    const c = centre();
    // the Sun, far away to the left
    const g = ctx.createRadialGradient(-60, c.ey, 20, -60, c.ey, 120);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.7, '#ffcc33');
    g.addColorStop(1, 'rgba(255, 170, 30, 0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(-60, c.ey, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = pal.warning;
    ctx.textAlign = 'left';
    ctx.fillText('to the Sun (very far away)', 66, c.ey - 132);
    // the Moon's orbit
    ctx.strokeStyle = pal['text-faint'];
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.2 / k;
    ctx.beginPath();
    ctx.arc(c.ex, c.ey, c.orbit, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // water envelope (exaggerated) and separate bulges
    const shape = (fn: (a: number) => number) => {
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * 360;
        const rr = R + 14 + WATER * fn(a);
        const t = dirOf(a);
        const x = c.ex + Math.cos(t) * rr;
        const y = c.ey - Math.sin(t) * rr;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    shape((a) => eta(a));
    ctx.fillStyle = 'rgba(56, 132, 255, 0.35)';
    ctx.fill();
    ctx.strokeStyle = pal['sim-water'];
    ctx.lineWidth = 2 / k;
    ctx.stroke();
    if (st.show === 'both') {
      // the Moon's and Sun's bulges on their own, as outlines
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5 / k;
      ctx.strokeStyle = pal['text-muted'];
      shape((a) => aMoon() * Math.cos(2 * (a - st.psi) * DEG));
      ctx.stroke();
      ctx.strokeStyle = pal.warning;
      shape((a) => aSun() * Math.cos(2 * a * DEG));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Earth
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.arc(c.ex, c.ey, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(5, 10, 25, 0.45)';
    ctx.beginPath();
    ctx.arc(c.ex, c.ey, R, Math.PI / 2, -Math.PI / 2, true);
    ctx.fill();
    // tidal force arrows on the surface
    if (st.forces) {
      const Km = useM() * aMoon();
      const Ks = useS() * aSun();
      const scale = 95;
      for (let i = 0; i < 16; i++) {
        const a = i * 22.5;
        const t = dirOf(a);
        const px = c.ex + Math.cos(t) * (R + 4);
        const py = c.ey - Math.sin(t) * (R + 4);
        let fx = 0;
        let fy = 0;
        for (const [K, dir] of [
          [Km, st.psi],
          [Ks, 0],
        ] as const) {
          const al = (a - dir) * DEG; // angle from the body's direction
          const radial = 2 * Math.cos(al) * Math.cos(al) - Math.sin(al) * Math.sin(al); // component along the radius
          const tang = -3 * Math.cos(al) * Math.sin(al);
          // tidal acceleration ∝ (2x, −y) in the body's frame: decompose into radial and tangential
          const rx = Math.cos(t);
          const ry = Math.sin(t);
          fx += K * (radial * rx - tang * ry);
          fy += K * (radial * ry + tang * rx);
        }
        const len = Math.hypot(fx, fy) * scale;
        if (len < 3) continue;
        arrow(ctx, px, py, px + fx * scale, py - fy * scale, pal['accent-2'], 2 / k, 7 / k);
      }
    }
    // the town on the equator
    const tA = dirOf(townAngle());
    const tx = c.ex + Math.cos(tA) * R;
    const ty = c.ey - Math.sin(tA) * R;
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // the Moon
    const m = moonXY();
    ctx.fillStyle = '#d9d4c4';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(5, 10, 25, 0.6)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 20, Math.PI / 2, -Math.PI / 2, true);
    ctx.fill();
    ctx.font = fs(10.5, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.fillText('Moon', m.x, m.y + 36);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'left';
    // Earth's 6,371 km radius is drawn 92 px wide, so 110 px per metre of water exaggerates heights about 7.6 million times
    ctx.fillText('From above the North Pole · not to scale', 14, 24);
    ctx.fillText('Water heights exaggerated millions of times', 14, 24 + 16 / k);
    areas.push(
      { test: (x, y) => Math.hypot(x - m.x, y - m.y) < 28, title: 'The Moon', text: () => `${phaseName(st.psi)}. Drag the Moon around its orbit. Its pull is a little stronger on the near side of Earth than at the centre, and a little weaker on the far side: this difference raises two bulges.` },
      { test: (x, y) => Math.hypot(x - tx, y - ty) < 14, title: 'The town', text: () => `A coastal town on the equator. As Earth spins it is carried through both bulges, so it gets two high tides and two low tides about every 24 hours 50 minutes. Water level now: ${(eta(townAngle()) * 100).toFixed(0)} cm from the average.` },
      { test: (x, y) => Math.hypot(x - c.ex, y - c.ey) < R + 50, title: 'Tidal bulges', text: () => 'The blue shape shows the ocean’s equilibrium tide, enormously exaggerated. The grey dashed outline is the Moon’s bulge alone and the yellow dashed outline the Sun’s. Purple arrows show the tidal force: outwards towards and away from each body, inwards at the sides.' },
    );
  }

  function drawPanel(fs: Fs, k: number) {
    const p = panel();
    const portraitLayout = portrait();
    let y = p.y;
    ctx.textAlign = 'left';
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Tide-raising effect', p.x, y);
    y += 20 / k;
    const bars: [string, number, string][] = [
      ['Moon', aMoon() / amp(M_MOON, DISTS.mean), pal['text-muted']],
      ['Sun', aSun() / amp(M_MOON, DISTS.mean), pal.warning],
    ];
    const bw = p.w * 0.62;
    for (const [label, v, col] of bars) {
      ctx.font = fs(10.5, 650);
      ctx.fillStyle = pal['text-muted'];
      ctx.fillText(label, p.x, y + 12 / k);
      ctx.fillStyle = pal.border;
      ctx.fillRect(p.x + 56, y, bw, 14 / k);
      ctx.fillStyle = col;
      ctx.fillRect(p.x + 56, y, (bw * v) / 1.25, 14 / k);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(`${Math.round(v * 100)}%`, p.x + 64 + bw, y + 12 / k);
      y += 24 / k;
    }
    y += 10 / k;
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Tidal range (idealized open ocean)', p.x, y);
    y += 22 / k;
    const rNow = range();
    const rMax = 2 * (amp(M_MOON, DISTS.near) + A_SUN);
    ctx.fillStyle = pal.border;
    ctx.fillRect(p.x, y, p.w * 0.85, 16 / k);
    ctx.fillStyle = alignment() === 'spring' ? pal.success : alignment() === 'neap' ? pal.accent : pal['sim-water'];
    ctx.fillRect(p.x, y, (p.w * 0.85 * rNow) / rMax, 16 / k);
    // spring and neap marks
    for (const [v, label] of [
      [springRange(), 'spring'],
      [neapRange(), 'neap'],
    ] as const) {
      const x = p.x + (p.w * 0.85 * v) / rMax;
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      ctx.moveTo(x, y - 4 / k);
      ctx.lineTo(x, y + 20 / k);
      ctx.stroke();
      ctx.font = fs(9.5, 650);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + 32 / k);
    }
    ctx.textAlign = 'left';
    y += 50 / k;
    ctx.font = fs(13, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`${(rNow * 100).toFixed(0)} cm between high and low water`, p.x, y);
    y += 30 / k;
    // the town's tide gauge
    const gx = p.x + 10;
    const gy = y;
    const gh = portraitLayout ? Math.max(120, 1110 - y - 14 / k) : Math.max(120, 540 - y);
    const gw = 60;
    ctx.font = fs(12, 700);
    ctx.fillText('The town’s harbour', p.x, gy);
    const top = gy + 14 / k;
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 2 / k;
    ctx.strokeRect(gx, top, gw, gh);
    const lvl = eta(townAngle());
    const half = 0.45; // m shown either side of the mean
    const wy = top + gh / 2 - (gh / 2) * clamp(lvl / half, -1, 1);
    ctx.fillStyle = 'rgba(56, 132, 255, 0.55)';
    ctx.fillRect(gx + 1, wy, gw - 2, top + gh - wy - 1);
    ctx.strokeStyle = pal['text-faint'];
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(gx - 6, top + gh / 2);
    ctx.lineTo(gx + gw + 6, top + gh / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = fs(10, 650);
    ctx.fillStyle = pal['text-muted'];
    ctx.fillText('average level', gx + gw + 10, top + gh / 2 + 4);
    ctx.font = fs(12, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText(`${lvl >= 0 ? '+' : '−'}${Math.abs(lvl * 100).toFixed(0)} cm`, gx + gw + 10, wy + 4);
    areas.push({ test: (x, yy) => x > gx && x < gx + gw && yy > top && yy < top + gh, title: 'Tide gauge', text: () => 'The water level at the town, in the idealized open-ocean model. Real harbours often have much bigger tides, because the shape of the coast and the sea floor amplify them.' });
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    if (hintEl) hintEl.style.display = portrait() ? 'none' : '';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    drawMain(fs, k);
    drawPanel(fs, k);
    ctx.restore();
    updateUi();
    drawGraph();
  }

  /* ---------- Readouts ---------- */
  let lastNote = '';
  function updateUi() {
    const al = alignment();
    ui.readout('align', al === 'spring' ? 'Spring tide: Sun and Moon in line' : al === 'neap' ? 'Neap tide: Sun and Moon at right angles' : 'Between spring and neap', al === 'spring' ? 'ok' : null);
    ui.readout('phase', `${phaseName(st.psi)} (${Math.round(st.psi)}°)`);
    ui.readout('range', `${(range() * 100).toFixed(0)} cm (spring ${(springRange() * 100).toFixed(0)}, neap ${(neapRange() * 100).toFixed(0)})`);
    ui.readout('ratio', `${((aSun() / aMoon()) * 100).toFixed(0)}% of the Moon’s`);
    ui.readout('level', `${eta(townAngle()) >= 0 ? '+' : '−'}${Math.abs(eta(townAngle()) * 100).toFixed(0)} cm`);
    const hh = Math.floor(st.hour);
    ui.readout('time', `${hh.toString().padStart(2, '0')}:${Math.floor((st.hour - hh) * 60).toString().padStart(2, '0')} local solar time`);
    sim.setBadge(al === 'spring' ? 'Spring tide' : al === 'neap' ? 'Neap tide' : phaseName(st.psi));
    let note: string;
    if (st.show === 'moon') note = 'The Moon alone raises two bulges: one facing the Moon and one on the opposite side. Its tide is about twice the Sun’s.';
    else if (st.show === 'sun') note = 'The Sun alone also raises two bulges, but they are less than half as high as the Moon’s, even though the Sun’s overall pull on Earth is about 180 times stronger. Tides depend on how much the pull changes across Earth, which falls off with distance cubed.';
    else if (al === 'spring') note = `Spring tide: at ${phaseName(st.psi).toLowerCase()} the Sun and Moon are in line, so their bulges add up. High tides are higher and low tides lower than usual. (“Spring” means “to leap up”, not the season.)`;
    else if (al === 'neap') note = 'Neap tide: at the quarter moons the Sun and Moon pull at right angles. The Sun’s bulges fill in the Moon’s low tides, so the difference between high and low water is smallest.';
    else note = 'Between spring and neap tides. Spring tides come about every 14.8 days, at new and full moon, with neap tides in between.';
    if (note !== lastNote) noteEl.textContent = lastNote = note;
    canvas.setAttribute('aria-label', `Earth with exaggerated tidal bulges. ${phaseName(st.psi)}, ${al === 'between' ? 'between spring and neap tides' : al + ' tide'}. Tidal range ${(range() * 100).toFixed(0)} centimetres. Water level at the town ${(eta(townAngle()) * 100).toFixed(0)} centimetres.`);
  }

  /* ---------- Graph: the town's tide over the next 30 days ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="td-graph"]')!, { x: { min: 0, span: 30 }, y: { min: -0.5, max: 0.5, step: 0.25 } });
  function drawGraph() {
    const pts: Point[] = [];
    const env: Point[] = [];
    for (let t = 0; t <= 30 * 24; t += 0.25) {
      const psi = st.psi + (360 / SYNODIC_H) * t;
      pts.push({ x: t / 24, y: eta(townAngle(st.hour + t), psi) });
      if (t % 6 === 0) env.push({ x: t / 24, y: range(psi) / 2 });
    }
    graph.opts = { x: { min: 0, span: 30, max: 30, step: 5, format: (v) => `${v} d` }, y: { min: -0.45, max: 0.45, step: 0.15, format: (v) => `${Math.round(v * 100)} cm` } };
    graph.set('w', { label: 'Water level at the town', color: 'sim-water', points: pts, width: 1.2 });
    graph.set('e', { label: 'Half the tidal range (spring–neap cycle)', color: 'success', points: env, width: 2, dash: [6, 4] });
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend="td-graph"]'));
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const psiCtl = ui.range('td-moon', (v) => `${v}° (${phaseName(v)})`, (v) => ((st.psi = v), sim.requestRender()));
  ui.presets('td-moon', psiCtl);
  const hourCtl = ui.range('td-hour', (v) => {
    const h = Math.floor(v);
    return `${h.toString().padStart(2, '0')}:${Math.round((v - h) * 60).toString().padStart(2, '0')}`;
  }, (v) => ((st.hour = v), sim.requestRender()));
  const distCtl = ui.choice<Dist>('td-dist', (v) => ((st.dist = v), sim.requestRender()));
  const showCtl = ui.choice<Show>('td-show', (v) => ((st.show = v), sim.requestRender()));
  const forceCtl = ui.toggle('td-forces', (v) => ((st.forces = v), sim.requestRender()));
  const speedCtl = ui.range('td-speed', (v) => `${v} hours per second`, (v) => (st.speed = v));

  const toDesign = (x: number, y: number) => {
    const { k, ox, oy } = tf();
    return { x: (x - ox) / k, y: (y - oy) / k };
  };
  enableDrag<'moon'>(canvas, {
    hit: (x, y) => {
      const p = toDesign(x, y);
      const m = moonXY();
      return Math.hypot(p.x - m.x, p.y - m.y) < 30 ? 'moon' : null;
    },
    move: (_id, x, y) => {
      const p = toDesign(x, y);
      const c = centre();
      const a = Math.atan2(-(p.y - c.ey), p.x - c.ex);
      psiCtl.set(Math.round(((((a - Math.PI) / DEG) % 360) + 360) % 360) % 360);
    },
    click: (x, y) => {
      const p = toDesign(x, y);
      const a = areas.find((q) => q.test(p.x, p.y));
      if (a) sim.showTooltip(x, y, a.title, a.text());
      else sim.hideTooltip();
    },
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    reset() {
      Object.assign(st, DEF);
      psiCtl.set(DEF.psi, false);
      hourCtl.set(DEF.hour, false);
      distCtl.set(DEF.dist, false);
      showCtl.set(DEF.show, false);
      forceCtl.set(DEF.forces, false);
      speedCtl.set(DEF.speed, false);
    },
  });
}
