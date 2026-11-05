/**
 * Animal locomotion: the forces behind flying, swimming and walking.
 *
 * Flying (a bird gliding or flapping at steady speed):
 *   lift  L = ½ ρ v² S C_L,  C_L = 0.1 per degree of angle of attack, up to a
 *         stall at about 15° where lift collapses
 *   drag  D = ½ ρ v² S (0.03 + 0.05 C_L²)   (shape drag + drag caused by lift)
 *   weight W = m g. If L > W the bird climbs; if L < W it sinks.
 *   To keep its speed the bird must flap to make thrust equal to the drag.
 * Swimming (a fish):
 *   speed ≈ efficiency × body length × tail beats per second
 *          (fish swim roughly 0.6–0.8 body lengths per tail beat)
 *   drag D = ½ ρ_water v² C_d A; at steady speed thrust = drag.
 *   Without a swim bladder a fish is denser than water and sinks unless it swims.
 * Walking and running (legs):
 *   Froude number Fr = v² / (g × leg length). Animals of all sizes change
 *   from walking to running at about Fr ≈ 0.5, and gallop above about 2.5.
 *   stride length ≈ 2.3 × leg length × Fr^0.3 (Alexander, 1984)
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { arrow, font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent', 'warning', 'danger', 'success'] as const;
type Mode = 'fly' | 'swim' | 'walk';
const RHO_AIR = 1.225;
const RHO_WATER = 1000;
const G = 9.81;

export function initLocomotion(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;

  const st = {
    mode: 'fly' as Mode,
    // flying
    mass: 0.4,
    wing: 0.07,
    speed: 12,
    aoa: 6,
    // swimming
    length: 0.4,
    beats: 3,
    shape: 'streamlined' as 'streamlined' | 'average' | 'boxy',
    bladder: true,
    // walking
    leg: 0.9,
    walkSpeed: 1.4,
  };
  let t = 0;
  let scroll = 0;
  let altitude = 0; // bird height change (scene px)

  const SHAPES = { streamlined: { cd: 0.05, eff: 0.75, label: 'Streamlined (like a tuna)' }, average: { cd: 0.15, eff: 0.6, label: 'Average' }, boxy: { cd: 0.5, eff: 0.4, label: 'Boxy (like a boxfish)' } };

  function flight() {
    const stall = st.aoa > 15;
    const cl = stall ? 0.6 : 0.1 * st.aoa;
    const q = 0.5 * RHO_AIR * st.speed ** 2;
    const lift = q * st.wing * cl;
    const drag = q * st.wing * (0.03 + 0.05 * cl * cl) * (stall ? 2.5 : 1);
    const weight = st.mass * G;
    return { lift, drag, weight, thrust: drag, power: drag * st.speed, stall, ratio: lift / weight };
  }
  function swim() {
    const s = SHAPES[st.shape];
    const v = s.eff * st.length * st.beats;
    const mass = 12 * st.length ** 3; // kg, a fish-shaped body
    const area = 0.012 * st.length ** 2 / 0.16; // frontal area scales with length²
    const drag = 0.5 * RHO_WATER * v * v * s.cd * area;
    const sink = st.bladder ? 0 : mass * G * (1 - 1000 / 1070);
    return { v, drag, thrust: drag, power: drag * v, sink, mass };
  }
  function walk() {
    const fr = st.walkSpeed ** 2 / (G * st.leg);
    const gait = fr < 0.5 ? 'Walking' : fr < 2.5 ? 'Running / trotting' : 'Galloping';
    const stride = 2.3 * st.leg * fr ** 0.3;
    const freq = st.walkSpeed / Math.max(stride, 0.01);
    const maxWalk = Math.sqrt(0.5 * G * st.leg);
    return { fr, gait, stride, freq, maxWalk };
  }

  function step(dt: number) {
    t += dt;
    if (st.mode === 'fly') {
      const f = flight();
      scroll += st.speed * 14 * dt;
      // net vertical force moves the bird up or down on screen
      const climb = clamp((f.lift - f.weight) / f.weight, -1, 1);
      altitude = clamp(altitude - climb * 60 * dt, -150, 150);
      if (Math.abs(climb) < 0.03) altitude *= 1 - dt * 0.5;
    } else if (st.mode === 'swim') {
      const s = swim();
      scroll += s.v * 120 * dt;
      altitude = clamp(altitude + (s.sink > 0 ? 20 : -altitude * 0.8) * dt, -100, 140);
    } else {
      scroll += st.walkSpeed * 90 * dt;
    }
  }

  /* ---------- Drawing (design box 1000 × 520) ---------- */
  const tf = () => {
    const k = Math.min(size.w / 1000, size.h / 520);
    return { k, ox: (size.w - 1000 * k) / 2, oy: (size.h - 520 * k) / 2 };
  };

  function forceArrow(x: number, y: number, dx: number, dy: number, colour: string, label: string, value: number, fs: (n: number, w?: number) => string) {
    if (Math.hypot(dx, dy) < 3) return;
    arrow(ctx, x, y, x + dx, y + dy, colour, 5, 16);
    ctx.font = fs(12, 750);
    ctx.fillStyle = colour;
    ctx.textAlign = dx > 5 ? 'left' : dx < -5 ? 'right' : 'center';
    ctx.fillText(`${label} ${value < 10 ? value.toFixed(2) : value.toFixed(0)} N`, x + dx + (dx > 5 ? 8 : dx < -5 ? -8 : 0), y + dy + (dy > 5 ? 18 : dy < -5 ? -10 : 4));
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.roundRect(0, 0, 1000, 520, 14);
    ctx.clip();
    const fs = (px: number, wt = 650) => font(px / k, wt);

    if (st.mode === 'fly') {
      const f = flight();
      ctx.fillStyle = '#8fc4ec';
      ctx.fillRect(0, 0, 1000, 520);
      // drifting clouds show the airspeed
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i++) {
        const x = 1100 - ((scroll * (0.6 + (i % 3) * 0.2) + i * 230) % 1300);
        const y = 60 + ((i * 97) % 380);
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.arc(x + 30, y - 10, 32, 0, Math.PI * 2);
        ctx.arc(x + 62, y, 24, 0, Math.PI * 2);
        ctx.fill();
      }
      const bx = 480;
      const by = 260 + altitude;
      // the bird, pitched up by the angle of attack, flapping
      const scale = 0.6 + Math.sqrt(st.wing / 0.07) * 0.4;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate((-st.aoa * Math.PI) / 180);
      ctx.fillStyle = '#5a6b7c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 46 * scale, 15 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(44 * scale, -6 * scale, 12 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2a541';
      ctx.beginPath();
      ctx.moveTo(54 * scale, -8 * scale);
      ctx.lineTo(70 * scale, -4 * scale);
      ctx.lineTo(54 * scale, -1 * scale);
      ctx.fill();
      const flap = Math.sin(t * 9) * 0.6;
      ctx.fillStyle = '#7d8fa1';
      ctx.beginPath();
      ctx.moveTo(-5 * scale, -4 * scale);
      ctx.lineTo(-30 * scale, -70 * scale * Math.cos(flap) * Math.sqrt(st.wing / 0.07));
      ctx.lineTo(20 * scale, -6 * scale);
      ctx.fill();
      ctx.restore();
      const sc = 120 / Math.max(f.weight, f.lift, 0.5);
      forceArrow(bx, by - 25, 0, -f.lift * sc, '#2e9d5b', 'Lift', f.lift, fs);
      forceArrow(bx, by + 25, 0, f.weight * sc, '#c0392b', 'Weight', f.weight, fs);
      forceArrow(bx + 70, by, f.thrust * sc * 3, 0, '#2a6fdb', 'Thrust', f.thrust, fs);
      forceArrow(bx - 70, by, -f.drag * sc * 3, 0, '#8e6bd8', 'Drag', f.drag, fs);
      if (f.stall) {
        ctx.font = fs(22, 800);
        ctx.fillStyle = pal.danger;
        ctx.textAlign = 'center';
        ctx.fillText('STALL! Air no longer flows smoothly over the wing', 500, 40);
      }
    } else if (st.mode === 'swim') {
      const s = swim();
      const water = ctx.createLinearGradient(0, 0, 0, 520);
      water.addColorStop(0, '#2f78c4');
      water.addColorStop(1, '#0f3a6b');
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, 1000, 520);
      // bubbles stream past
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 30; i++) {
        const x = 1000 - ((scroll * 0.8 + i * 71) % 1050);
        const y = (i * 53) % 520;
        ctx.beginPath();
        ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#c9a66b';
      ctx.fillRect(0, 490, 1000, 30);
      const fx = 480;
      const fy = 240 + altitude;
      const L = 120 + st.length * 120;
      const bodyH = st.shape === 'streamlined' ? L * 0.22 : st.shape === 'average' ? L * 0.32 : L * 0.5;
      const wag = Math.sin(t * st.beats * Math.PI * 2) * 0.5;
      ctx.fillStyle = '#f2a541';
      ctx.beginPath();
      if (st.shape === 'boxy') ctx.roundRect(fx - L / 2, fy - bodyH / 2, L * 0.85, bodyH, 18);
      else ctx.ellipse(fx, fy, L / 2, bodyH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // tail fin, beating side to side (seen from the side as up and down)
      ctx.beginPath();
      ctx.moveTo(fx - L / 2 + 6, fy);
      ctx.lineTo(fx - L / 2 - 40, fy - 30 + wag * 30);
      ctx.lineTo(fx - L / 2 - 40, fy + 30 + wag * 30);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(fx + L / 2 - 22, fy - bodyH * 0.12, 5, 0, Math.PI * 2);
      ctx.fill();
      if (st.bladder) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(fx, fy - bodyH * 0.05, L * 0.18, bodyH * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const sc = 140 / Math.max(s.drag, s.sink, 0.5);
      // lighter colours show up better against the blue water
      forceArrow(fx + L / 2 + 10, fy, s.thrust * sc, 0, '#9fd0ff', 'Thrust', s.thrust, fs);
      forceArrow(fx - L / 2 - 50, fy, -s.drag * sc, 0, '#e2c8ff', 'Drag', s.drag, fs);
      if (s.sink > 0) forceArrow(fx, fy + bodyH / 2 + 10, 0, Math.max(30, s.sink * sc), '#ff9a8a', 'Sinking force', s.sink, fs);
    } else {
      const g = walk();
      ctx.fillStyle = '#bfe0f2';
      ctx.fillRect(0, 0, 1000, 520);
      ctx.fillStyle = '#7aa35a';
      ctx.fillRect(0, 420, 1000, 100);
      // ground markers
      ctx.fillStyle = '#5f8a44';
      for (let i = 0; i < 12; i++) ctx.fillRect(1000 - ((scroll + i * 100) % 1100), 430, 40, 6);
      // a four-legged animal with legs swinging like pendulums
      const legPx = 60 + st.leg * 110;
      const bodyY = 420 - legPx;
      const bx = 480;
      const phase = t * g.freq * Math.PI * 2;
      const swing = clamp(0.25 + g.fr * 0.12, 0.25, 0.7);
      const bounce = g.fr > 0.5 ? Math.abs(Math.sin(phase)) * 10 : 0;
      ctx.strokeStyle = '#6b4a2e';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      const legs: [number, number][] = g.fr < 2.5 ? [[-60, 0], [-40, Math.PI], [60, Math.PI], [80, 0]] : [[-60, 0], [-40, 0.4], [60, Math.PI], [80, Math.PI + 0.4]];
      for (const [lx, ph] of legs) {
        const a = Math.sin(phase + ph) * swing;
        ctx.beginPath();
        ctx.moveTo(bx + lx, bodyY - bounce);
        ctx.lineTo(bx + lx + Math.sin(a) * legPx, bodyY - bounce + Math.cos(a) * legPx);
        ctx.stroke();
      }
      ctx.fillStyle = '#8a6440';
      ctx.beginPath();
      ctx.ellipse(bx + 10, bodyY - 20 - bounce, 100, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx + 120, bodyY - 55 - bounce, 30, 22, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // leg length marker
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bx - 120, bodyY);
      ctx.lineTo(bx - 120, 420);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = fs(11, 700);
      ctx.fillStyle = '#1d2a1d';
      ctx.textAlign = 'right';
      ctx.fillText(`leg ${st.leg} m`, bx - 126, (bodyY + 420) / 2);
      // gait banner
      ctx.font = fs(22, 800);
      ctx.textAlign = 'center';
      ctx.fillStyle = g.fr < 0.5 ? '#2e7d32' : g.fr < 2.5 ? '#c77d0a' : '#c0392b';
      ctx.fillText(g.gait.toUpperCase(), 500, 50);
      // Froude meter
      const fx = 300;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(fx, 470, 400, 14);
      const pos = (fr: number) => fx + clamp(Math.log10(fr * 100 + 1) / Math.log10(501), 0, 1) * 400;
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(fx, 470, pos(0.5) - fx, 14);
      ctx.fillStyle = '#e0a43a';
      ctx.fillRect(pos(0.5), 470, pos(2.5) - pos(0.5), 14);
      ctx.fillStyle = '#e0605a';
      ctx.fillRect(pos(2.5), 470, fx + 400 - pos(2.5), 14);
      ctx.fillStyle = '#111';
      ctx.fillRect(pos(g.fr) - 2, 464, 4, 26);
      ctx.font = fs(11, 700);
      ctx.fillStyle = '#1d2a1d';
      ctx.textAlign = 'left';
      ctx.fillText('Froude number: walk | run | gallop', fx, 504);
    }
    ctx.restore();
    updateReadouts();
  }

  function updateReadouts() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    if (st.mode === 'fly') {
      const f = flight();
      r('r1', 'Lift compared with weight', `${(f.ratio * 100).toFixed(0)} %${f.ratio > 1.03 ? ' (climbing)' : f.ratio < 0.97 ? ' (sinking)' : ' (level flight)'}`, f.stall ? 'bad' : Math.abs(f.ratio - 1) < 0.05 ? 'ok' : 'warn');
      r('r2', 'Lift / weight', `${f.lift.toFixed(2)} N / ${f.weight.toFixed(2)} N`);
      r('r3', 'Drag (thrust needed)', `${f.drag.toFixed(2)} N`);
      r('r4', 'Power needed', `${f.power.toFixed(1)} W`);
      r('r5', 'Lift-to-drag ratio', (f.lift / f.drag).toFixed(1));
      sim.setBadge(f.stall ? 'Stall' : 'Flying');
      noteEl.textContent = f.stall
        ? 'The wing is tilted too steeply: the airflow breaks away from the top surface and lift collapses.'
        : 'Air flowing over the curved, tilted wing is pushed downwards, so the air pushes the wing up (lift). Faster flight or a bigger wing gives more lift.';
    } else if (st.mode === 'swim') {
      const s = swim();
      r('r1', 'Swimming speed', `${s.v.toFixed(2)} m/s (${(s.v / st.length).toFixed(1)} body lengths per second)`);
      r('r2', 'Drag = thrust at steady speed', `${s.drag.toFixed(2)} N`);
      r('r3', 'Power needed', `${s.power.toFixed(1)} W`);
      r('r4', 'Fish mass', `${s.mass.toFixed(2)} kg`);
      r('r5', 'Buoyancy', st.bladder ? 'Neutral: the swim bladder balances its weight' : `Sinks with a force of ${s.sink.toFixed(2)} N unless it keeps swimming`, st.bladder ? 'ok' : 'warn');
      sim.setBadge('Swimming');
      noteEl.textContent = 'The tail pushes water backwards, so the water pushes the fish forwards (Newton’s third law). Water is about 800 times denser than air, so a streamlined shape matters enormously.';
    } else {
      const g = walk();
      r('r1', 'Gait', g.gait, g.fr < 0.5 ? 'ok' : null);
      r('r2', 'Froude number (v² ÷ g × leg length)', g.fr.toFixed(2));
      r('r3', 'Stride length', `${g.stride.toFixed(2)} m`);
      r('r4', 'Strides per second', g.freq.toFixed(2));
      r('r5', 'Fastest comfortable walk for this leg length', `${g.maxWalk.toFixed(1)} m/s`);
      sim.setBadge(g.gait);
      noteEl.textContent =
        'In walking, the body vaults over a stiff leg like an upside-down pendulum. Above a Froude number of about 0.5, gravity can no longer hold the body on that arc, so animals switch to running, using springy tendons instead.';
    }
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const modeCtl = ui.choice<Mode>('lc-mode', (v) => {
    st.mode = v;
    altitude = 0;
    for (const m of ['fly', 'swim', 'walk'] as const) ui.showWhen(`[data-mode="${m}"]`, m === v);
    sim.requestRender();
  });
  const set = <K extends keyof typeof st>(key: K) => (v: (typeof st)[K]) => {
    st[key] = v;
    sim.requestRender();
  };
  const ctls = {
    mass: ui.range('lc-mass', (v) => `${v} kg`, set('mass')),
    wing: ui.range('lc-wing', (v) => `${v} m²`, set('wing')),
    speed: ui.range('lc-speed', (v) => `${v} m/s`, set('speed')),
    aoa: ui.range('lc-aoa', (v) => `${v}°`, set('aoa')),
    length: ui.range('lc-length', (v) => `${v} m`, set('length')),
    beats: ui.range('lc-beats', (v) => `${v} per second`, set('beats')),
    leg: ui.range('lc-leg', (v) => `${v} m`, set('leg')),
    walkSpeed: ui.range('lc-walkspeed', (v) => `${v} m/s`, set('walkSpeed')),
  };
  const shapeCtl = ui.choice<'streamlined' | 'average' | 'boxy'>('lc-shape', set('shape'));
  const bladderCtl = ui.toggle('lc-bladder', set('bladder'));
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const vals = JSON.parse(b.dataset.preset!) as Record<string, number>;
      for (const [k, v] of Object.entries(vals)) ctls[k as keyof typeof ctls].set(v);
    }),
  );
  for (const m of ['fly', 'swim', 'walk'] as const) ui.showWhen(`[data-mode="${m}"]`, m === 'fly');

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { mode: 'fly', mass: 0.4, wing: 0.07, speed: 12, aoa: 6, length: 0.4, beats: 3, shape: 'streamlined', bladder: true, leg: 0.9, walkSpeed: 1.4 });
      modeCtl.set('fly');
      for (const [k, v] of Object.entries({ mass: 0.4, wing: 0.07, speed: 12, aoa: 6, length: 0.4, beats: 3, leg: 0.9, walkSpeed: 1.4 })) ctls[k as keyof typeof ctls].set(v, false);
      shapeCtl.set('streamlined', false);
      bladderCtl.set(true, false);
      altitude = 0;
    },
  });
}
