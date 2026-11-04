/**
 * Phases of the Moon.
 * θ = elongation (angle Sun–Earth–Moon measured along the orbit; 0° new, 180° full).
 * Fraction of the visible disc that is lit: k = (1 − cos θ) / 2.
 * Synodic month (new moon to new moon): 29.53 days.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { enableDrag } from '../shared/drag';
import { arrow, font, pill } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'text-faint', 'bg-elev', 'border-strong', 'warning', 'sim-water'] as const;
const SYNODIC = 29.53;

const PHASES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Third quarter',
  'Waning crescent',
];

export function phaseName(deg: number) {
  return PHASES[Math.floor((((deg + 22.5) % 360) + 360) % 360 / 45)];
}

export function initMoon(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { theta: 0, speed: 3, south: false, shadow: false, sight: true };

  /* ---------- Layout: orbit view on the left, sky view on the right ---------- */
  const L = () => {
    const { w, h } = size;
    const split = w * 0.6;
    const orbitR = Math.min(split * 0.33, h * 0.36);
    return { split, ex: split * 0.55, ey: h / 2, orbitR, skyX: split + (w - split) / 2, skyY: h * 0.47, skyR: Math.min((w - split) * 0.3, h * 0.26) };
  };
  // Sun is far to the left. Moon orbits anticlockwise (viewed from above the North Pole).
  const moonPos = () => {
    const l = L();
    const a = Math.PI + (p.theta * Math.PI) / 180; // θ = 0 → Moon on the Sun side
    return { x: l.ex + Math.cos(a) * l.orbitR, y: l.ey - Math.sin(a) * l.orbitR };
  };

  function drawSkyMoon(cx: number, cy: number, r: number) {
    const th = (p.theta * Math.PI) / 180;
    const waxing = p.theta < 180;
    // In the northern hemisphere a waxing moon is lit on the right; mirrored in the south.
    const litRight = waxing !== p.south;
    const lit = '#f2ecd6';
    const dark = '#2a3142';
    // Dark disc
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Lit half
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !litRight);
    ctx.closePath();
    ctx.fill();
    // Terminator ellipse: covers part of the lit half (crescent) or extends light over the dark half (gibbous)
    const rx = r * Math.abs(Math.cos(th));
    ctx.fillStyle = Math.cos(th) > 0 ? dark : lit;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // Faint craters for realism
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000';
    for (const [dx, dy, cr] of [
      [-0.3, -0.25, 0.14],
      [0.25, 0.1, 0.1],
      [-0.05, 0.4, 0.12],
      [0.35, -0.4, 0.07],
    ])
      ctx.beginPath(), ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, Math.PI * 2), ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function render() {
    const { w, h } = size;
    const l = L();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Sunlight from the left
    ctx.fillStyle = pal.warning;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(-l.orbitR * 0.6, l.ey, l.orbitR * 0.75, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = -3; i <= 3; i++) arrow(ctx, 30, l.ey + i * l.orbitR * 0.32, 70, l.ey + i * l.orbitR * 0.32, pal.warning, 2, 8);
    pill(ctx, 'Sunlight', 60, l.ey - l.orbitR * 1.15, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Earth's shadow
    if (p.shadow) {
      ctx.fillStyle = pal['sim-text'];
      ctx.globalAlpha = 0.12;
      ctx.fillRect(l.ex, l.ey - 16, l.split - l.ex, 32);
      ctx.globalAlpha = 1;
      pill(ctx, 'Earth’s shadow', l.ex + l.orbitR + 34, l.ey + 30, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
    }

    // Orbit
    ctx.strokeStyle = pal['border-strong'];
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(l.ex, l.ey, l.orbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth: day side faces the Sun
    const er = 16;
    ctx.fillStyle = '#1b3a5c';
    ctx.beginPath();
    ctx.arc(l.ex, l.ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal['sim-water'];
    ctx.beginPath();
    ctx.arc(l.ex, l.ey, er, Math.PI / 2, -Math.PI / 2);
    ctx.fill();
    pill(ctx, 'Earth', l.ex, l.ey + er + 16, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Moon in orbit: the half facing the Sun is always lit
    const m = moonPos();
    const mr = 11;
    if (p.sight) {
      ctx.strokeStyle = pal['accent-2'];
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(l.ex, l.ey);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#2a3142';
    ctx.beginPath();
    ctx.arc(m.x, m.y, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ecd6';
    ctx.beginPath();
    ctx.arc(m.x, m.y, mr, Math.PI / 2, -Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, mr + 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(11, 600);
    ctx.fillText('View from above the North Pole (not to scale)', 12, h - 12);

    // Divider and sky view
    ctx.strokeStyle = pal['border-strong'];
    ctx.beginPath();
    ctx.moveTo(l.split, 16);
    ctx.lineTo(l.split, h - 16);
    ctx.stroke();
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(13, 650);
    ctx.textAlign = 'center';
    ctx.fillText('What you see from Earth', l.skyX, 30);
    drawSkyMoon(l.skyX, l.skyY, l.skyR);
    ctx.font = font(15, 700);
    ctx.fillText(phaseName(p.theta), l.skyX, l.skyY + l.skyR + 34);
    ctx.font = font(11, 500);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText(p.south ? 'Southern hemisphere view' : 'Northern hemisphere view', l.skyX, l.skyY + l.skyR + 54);
    ctx.textAlign = 'left';

    // Readouts
    const th = (p.theta * Math.PI) / 180;
    const k = (1 - Math.cos(th)) / 2;
    const day = (p.theta / 360) * SYNODIC;
    const riseH = (6 + (p.theta / 360) * 24) % 24;
    const hh = Math.floor(riseH);
    const mm = Math.round((riseH - hh) * 60 / 15) * 15;
    const time = `${((hh + 11) % 12) + 1}:${String(mm % 60).padStart(2, '0')} ${hh < 12 ? 'a.m.' : 'p.m.'}`;
    const name = phaseName(p.theta);
    ui.readout('phase', name);
    ui.readout('illum', `${Math.round(k * 100)}%`);
    ui.readout('day', `Day ${day.toFixed(1)} of ${SYNODIC}`);
    ui.readout('trend', name === 'New moon' || name === 'Full moon' ? '—' : p.theta < 180 ? 'Waxing (growing)' : 'Waning (shrinking)');
    ui.readout('rise', time);
    ui.readout(
      'best',
      name === 'New moon' ? 'Not visible (near the Sun)' : p.theta < 155 ? 'Evening sky' : p.theta <= 205 ? 'All night' : 'Late night & morning',
    );
    sim.setBadge(`${name} · ${Math.round(k * 100)}% lit`);
    canvas.setAttribute(
      'aria-label',
      `The Moon is ${p.theta} degrees around its orbit from the Sun direction. From the ${p.south ? 'southern' : 'northern'} hemisphere it appears as a ${name.toLowerCase()}, ${Math.round(k * 100)} percent lit.`,
    );
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const angleCtl = ui.range('mn-angle', (v) => `${v}°`, (v) => ((p.theta = v), sim.requestRender()));
  ui.presets('mn-angle', angleCtl);
  const speedCtl = ui.range('mn-speed', (v) => `${v} days/s`, (v) => (p.speed = v));
  const hemiCtl = ui.choice<string>('mn-hemi', (v) => ((p.south = v === 'south'), sim.requestRender()));
  const shadowCtl = ui.toggle('mn-shadow', (v) => ((p.shadow = v), sim.requestRender()));
  ui.toggle('mn-sight', (v) => ((p.sight = v), sim.requestRender()));

  enableDrag<'moon'>(canvas, {
    hit: (x, y) => {
      const m = moonPos();
      return Math.hypot(x - m.x, y - m.y) < 26 ? 'moon' : null;
    },
    move: (_id, x, y) => {
      const l = L();
      const a = Math.atan2(-(y - l.ey), x - l.ex); // math angle
      const deg = (((a - Math.PI) * 180) / Math.PI + 720) % 360;
      angleCtl.set(Math.round(deg) % 360);
    },
    click: (x, y) => {
      const l = L();
      if (x > l.split) {
        sim.showTooltip(x, y, 'The Moon from Earth', 'We always see the same face of the Moon. How much of its sunlit half we can see depends on where it is in its orbit.');
      } else if (Math.hypot(x - l.ex, y - l.ey) < 22) {
        sim.showTooltip(x, y, 'Earth', 'The side facing the Sun has daytime. Earth spins once a day, so the Moon rises and sets like the Sun.');
      } else {
        sim.showTooltip(x, y, 'Sunlight', 'The Sun always lights exactly half of the Moon — the half facing the Sun. Phases come from viewing that lit half from different angles.');
      }
    },
  });

  const sim = createSimController(root, {
    step: (dt) => {
      p.theta = (p.theta + (dt * p.speed * 360) / SYNODIC) % 360;
      angleCtl.set(Math.round(p.theta) % 360, false);
    },
    render,
    reset() {
      angleCtl.set(0, false);
      speedCtl.set(3, false);
      hemiCtl.set('north', false);
      shadowCtl.set(false, false);
      Object.assign(p, { theta: 0, speed: 3, south: false, shadow: false });
    },
    autoplay: false,
  });
  sim.requestRender();
}
