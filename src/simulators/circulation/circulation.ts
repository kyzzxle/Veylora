/**
 * Animal circulatory systems: open vs closed, single vs double circulation.
 *
 * Closed systems: blood "particles" travel along the legs of each animal's
 * circuit (data.ts). Speeds depend on the vessel type (fast in arteries, slow
 * in capillaries) and on the heartbeat and activity level. Oxygen saturation
 * rises along gas-exchange capillaries towards the maximum for that organ and
 * falls along body capillaries towards a venous level that drops as activity
 * (oxygen demand) rises. In the frog's single ventricle each particle's
 * saturation is partly mixed with the ventricle average, and the outflow
 * channel sends oxygen-poor blood mostly to the lungs and skin and
 * oxygen-rich blood mostly to the body, so partial mixing emerges.
 *
 * Insect (open system): hemolymph is pumped forward along the dorsal vessel,
 * spills out in the head, drifts back through the body cavity (hemocoel)
 * around the organs and re-enters the heart through the ostia.
 *
 * Colour code: red = oxygen-rich, blue = oxygen-poor. (Real oxygen-poor blood
 * is dark red, not blue.) Values are illustrative or approximate.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { ANIMALS, ORDER, type AnimalId, type Leg, type Pt } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type Fs = (px: number, w?: number) => string;
type Vessel = 'artery' | 'capillary' | 'vein';

const SPEED: Record<Leg['kind'], number> = { heart: 70, artery: 150, gas: 34, tissue: 34, vein: 80 };
const HEMOLYMPH = '#b8c95a';
const DEF = { animal: 'mammal' as AnimalId, act: 0, vessel: 'artery' as Vessel, tracheae: true };

interface P {
  leg: string;
  s: number; // distance along the leg
  sat: number;
  /** Frog only: did this blood enter the ventricle from the right atrium (from the body)? */
  fromRight?: boolean;
  tracked?: boolean;
}
interface H {
  x: number;
  y: number;
  inVessel: boolean;
  tracked?: boolean;
}

/** Colour for an oxygen saturation (0.3 → blue, 0.97 → red). */
export function satColour(sat: number) {
  const f = clamp((sat - 0.3) / 0.67, 0, 1);
  const r = Math.round(59 + (224 - 59) * f);
  const g = Math.round(91 + (49 - 91) * f);
  const b = Math.round(219 + (49 - 219) * f);
  return `rgb(${r},${g},${b})`;
}

export function initCirculation(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const followBtn = root.querySelector<HTMLButtonElement>('[data-follow]')!;
  const hintEl = root.querySelector<HTMLElement>('[data-hint]');

  const st = { ...DEF };
  let parts: P[] = [];
  let hemo: H[] = [];
  let beat = 0; // heartbeat phase (cycles)
  let tracking = false;
  let trip: string[] = [];

  const A = () => ANIMALS[st.animal];
  const legMap = () => new Map(A().legs.map((l) => [l.id, l]));
  let legs = legMap();
  const heartRate = () => {
    const hr = A().hr;
    return hr ? hr[0] + (hr[1] - hr[0]) * st.act : 30 + 60 * st.act;
  };
  const venous = () => A().venousRest + (A().venousMax - A().venousRest) * st.act;
  const flowFactor = () => (0.35 + 0.65 * (heartRate() / (A().hr?.[1] ?? 90))) * 1.6;

  /* ---------- Geometry helpers ---------- */
  const lengths = new Map<string, number[]>();
  function segLens(l: Leg) {
    let v = lengths.get(l.id + st.animal);
    if (!v) {
      v = l.pts.slice(1).map((p, i) => Math.hypot(p[0] - l.pts[i][0], p[1] - l.pts[i][1]));
      lengths.set(l.id + st.animal, v);
    }
    return v;
  }
  const legLen = (l: Leg) => segLens(l).reduce((a, b) => a + b, 0);
  function at(l: Leg, s: number): Pt {
    const ls = segLens(l);
    let i = 0;
    while (i < ls.length - 1 && s > ls[i]) (s -= ls[i]), i++;
    const f = ls[i] ? clamp(s / ls[i], 0, 1) : 0;
    return [l.pts[i][0] + (l.pts[i + 1][0] - l.pts[i][0]) * f, l.pts[i][1] + (l.pts[i + 1][1] - l.pts[i][1]) * f];
  }

  /* ---------- Setup ---------- */
  function setup() {
    legs = legMap();
    parts = [];
    hemo = [];
    tracking = false;
    trip = [];
    followBtn.setAttribute('aria-pressed', 'false');
    const a = A();
    if (a.open) {
      for (let i = 0; i < 130; i++) hemo.push(randomHemocoel());
      for (let i = 0; i < 26; i++) hemo.push({ x: 140 + Math.random() * 440, y: VY, inVessel: true });
      return;
    }
    // spread particles around the circuit in proportion to each leg's length
    const total = a.legs.reduce((s, l) => s + legLen(l), 0);
    const n = 110;
    for (const l of a.legs) {
      const k = Math.round((n * legLen(l)) / total);
      for (let i = 0; i < k; i++) parts.push({ leg: l.id, s: Math.random() * legLen(l), sat: initialSat(l) });
    }
  }
  function initialSat(l: Leg) {
    const a = A();
    const rich = ['pv', 'la', 'lv', 'ao', 'da', 'sys'].includes(l.id);
    return rich ? a.arterialMax : l.kind === 'gas' ? (a.arterialMax + venous()) / 2 : venous();
  }
  function randomHemocoel(): H {
    for (;;) {
      const x = 90 + Math.random() * 500;
      const y = 215 + Math.random() * 250;
      if (inBody(x, y)) return { x, y, inVessel: false };
    }
  }
  /** Is a point inside the insect's body outline (head, thorax and abdomen ellipses)? */
  const inBody = (x: number, y: number) =>
    Math.pow((x - 110) / 52, 2) + Math.pow((y - 300) / 80, 2) < 1 ||
    Math.pow((x - 225) / 85, 2) + Math.pow((y - 330) / 125, 2) < 1 ||
    Math.pow((x - 450) / 160, 2) + Math.pow((y - 335) / 135, 2) < 1;

  /* ---------- Time ---------- */
  function step(dt: number) {
    beat += (dt * heartRate()) / 60;
    const pulse = 0.55 + 0.9 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * beat)), 2);
    if (A().open) return stepOpen(dt, pulse);
    const ff = flowFactor();
    const a = A();
    // average saturation in the frog's ventricle, for mixing
    const inV = parts.filter((p) => p.leg === 'v');
    const vAvg = inV.length ? inV.reduce((s, p) => s + p.sat, 0) / inV.length : 0.7;
    for (const p of parts) {
      let l = legs.get(p.leg)!;
      const v = SPEED[l.kind] * ff * (l.kind === 'artery' || l.kind === 'heart' ? pulse : 1);
      const len = legLen(l);
      const before = p.s / len;
      p.s += v * dt;
      const after = Math.min(1, p.s / len);
      // gas exchange along capillaries
      if (l.kind === 'gas') p.sat += (a.arterialMax - p.sat) * clamp((after - before) / Math.max(0.05, 1 - before), 0, 1);
      if (l.kind === 'tissue') p.sat += (venous() - p.sat) * clamp((after - before) / Math.max(0.05, 1 - before), 0, 1);
      while (p.s >= len) {
        p.s -= len;
        let next = l.next[0];
        if (l.id === 'conus') {
          // the spiral valve sends most oxygen-poor blood to the lungs and skin, most oxygen-rich blood to the body
          // blood from the right atrium mostly goes to the lungs and skin, blood from the left atrium mostly to the body
          next = Math.random() < (p.fromRight ? 0.85 : 0.15) ? 'pc' : 'sys';
        }
        if (next === 'v') {
          p.fromRight = l.id === 'ra';
          p.sat = 0.85 * p.sat + 0.15 * vAvg;
        }
        l = legs.get(next)!;
        p.leg = next;
        if (p.tracked) onTrackedEnter(l);
      }
    }
  }
  function stepOpen(dt: number, pulse: number) {
    const ff = 0.6 + 1.4 * st.act;
    for (const h of hemo) {
      if (h.inVessel) {
        // pumped forwards (towards the head) along the dorsal vessel
        h.x -= 120 * ff * pulse * dt;
        h.y = VY + Math.sin(h.x * 0.05) * 2;
        if (h.x < 135) {
          h.inVessel = false;
          h.y = 245 + Math.random() * 130;
          if (h.tracked) narrate('Hemolymph leaves the open front end of the dorsal vessel in the head and spills into the body cavity (hemocoel), bathing the brain and muscles.');
        }
      } else {
        // drift back through the whole body cavity, bathing the organs; near the rear it rises towards the heart
        const rear = h.x > 470;
        const vx = (35 + 50 * Math.random()) * ff * (h.x > 540 ? 0.3 : 1);
        const vy = (Math.random() - 0.5) * 240 + (rear ? -70 * ff : 0);
        const nx = h.x + vx * dt;
        const ny = h.y + vy * dt;
        if (inBody(nx, ny)) (h.x = nx), (h.y = ny);
        else h.y += (330 - h.y) * 0.05;
        // re-enter the heart through an ostium in the abdomen
        if (h.x > 340 && h.y < VY + 22 && OSTIA.some((ox) => Math.abs(ox - h.x) < 12)) {
          h.inVessel = true;
          h.y = VY;
          if (h.tracked) narrate('It re-enters the heart through an ostium, a slit-like opening with a valve that lets hemolymph in but not out. The heart pumps it forwards again.');
        }
      }
    }
  }
  const OSTIA = [360, 410, 460, 510, 560];
  const VY = 224; // height of the dorsal vessel, just inside the insect's back

  /* ---------- Follow one blood cell ---------- */
  function narrate(text: string) {
    noteEl.textContent = text;
  }
  function onTrackedEnter(l: Leg) {
    trip.push(l.name);
    if (trip.length > 14) trip.shift();
    narrate(`${l.name}: ${l.info}`);
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 940] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  type Rect = { x: number; y: number; w: number; h: number };
  const diagR = (): Rect => (portrait() ? { x: 10, y: 0, w: 660, h: 600 } : { x: 0, y: 0, w: 660, h: 600 });
  const vesselR = (): Rect => (portrait() ? { x: 0, y: 610, w: 340, h: 330 } : { x: 665, y: 62, w: 330, h: 256 });
  const chartR = (): Rect => (portrait() ? { x: 345, y: 610, w: 335, h: 330 } : { x: 665, y: 325, w: 330, h: 270 });

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];
  const nearLine = (pts: Pt[], x: number, y: number, d: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
      const t = clamp(((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / L2, 0, 1);
      if (Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1))) < d) return true;
    }
    return false;
  };

  /* ---------- Diagram ---------- */
  function drawOutline(k: number) {
    ctx.strokeStyle = pal['border-strong'];
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.06);
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    if (st.animal === 'fish') {
      ctx.ellipse(330, 320, 290, 205, 0, 0, Math.PI * 2);
      ctx.moveTo(612, 320);
      ctx.lineTo(655, 230);
      ctx.lineTo(655, 410);
      ctx.closePath();
    } else if (st.animal === 'insect') {
      ctx.ellipse(110, 300, 52, 80, 0, 0, Math.PI * 2);
      ctx.moveTo(310, 330);
      ctx.ellipse(225, 330, 85, 125, 0, 0, Math.PI * 2);
      ctx.moveTo(610, 335);
      ctx.ellipse(450, 335, 160, 135, 0, 0, Math.PI * 2);
    } else {
      ctx.roundRect(120, 30, 420, 565, 60);
    }
    ctx.fill();
    ctx.stroke();
  }
  function drawClosed(fs: Fs, k: number) {
    const a = A();
    // organ blocks
    for (const o of a.organs) {
      ctx.fillStyle = o.kind === 'gas' ? withAlpha(pal.accent, 0.12) : o.kind === 'heart' ? withAlpha(pal.danger, 0.08) : withAlpha(pal['text-faint'], 0.12);
      ctx.strokeStyle = o.kind === 'gas' ? pal.accent : pal.border;
      ctx.lineWidth = 1.2 / k;
      ctx.beginPath();
      ctx.roundRect(o.x, o.y, o.w, o.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = pal['text-muted'];
      ctx.textAlign = 'center';
      const ly = o.kind === 'gas' ? o.y + 16 : o.kind === 'heart' ? o.y - 8 : o.y + o.h / 2 + 4;
      ctx.fillText(o.label, o.x + o.w / 2, ly);
      areas.push({ test: (x, y) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h, title: o.label, text: () => o.info });
    }
    // vessels coloured by the average oxygen of the blood in them
    const sq = Math.pow(Math.max(0, Math.sin(2 * Math.PI * beat)), 2);
    for (const l of a.legs) {
      const ps = parts.filter((p) => p.leg === l.id);
      const avg = ps.length ? ps.reduce((s, p) => s + p.sat, 0) / ps.length : initialSat(l);
      const w = l.kind === 'artery' ? 9 : l.kind === 'vein' ? 11 : l.kind === 'heart' ? 26 + (l.id.endsWith('v') || l.id === 'v' || l.id === 've' ? -6 * sq : 0) : 5;
      ctx.strokeStyle = satColour(avg);
      ctx.globalAlpha = l.kind === 'heart' ? 0.55 : l.kind === 'gas' || l.kind === 'tissue' ? 0.4 : 0.45;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (l.kind === 'gas' || l.kind === 'tissue') ctx.setLineDash([3, 4]);
      ctx.beginPath();
      l.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (l.kind === 'heart') {
        ctx.font = fs(9, 700);
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'center';
        const mid = at(l, legLen(l) / 2);
        const short: Record<string, string> = { ra: 'RA', rv: 'RV', la: 'LA', lv: 'LV', sv: 'SV', at: 'A', ve: 'V', v: 'V', conus: 'C' };
        ctx.fillText(short[l.id] ?? '', mid[0] + (st.animal === 'fish' ? 0 : l.id.startsWith('r') ? -24 : 24), mid[1] + (st.animal === 'fish' ? -18 : 4));
      }
      areas.push({ test: (x, y) => nearLine(l.pts, x, y, Math.max(10, w / 2 + 4)), title: l.name, text: () => l.info });
    }
    // particles
    for (const p of parts) {
      const [x, y] = at(legs.get(p.leg)!, p.s);
      ctx.fillStyle = satColour(p.sat);
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      if (p.tracked) {
        ctx.strokeStyle = pal.warning;
        ctx.lineWidth = 3 / k;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // flow arrows at a few points
    ctx.fillStyle = pal['text-muted'];
    for (const l of a.legs) {
      if (l.kind !== 'artery' && l.kind !== 'vein') continue;
      const L0 = legLen(l);
      const [x1, y1] = at(l, L0 * 0.45);
      const [x2, y2] = at(l, L0 * 0.55);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.save();
      ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-5, 6);
      ctx.fill();
      ctx.restore();
    }
  }
  function drawOpen(fs: Fs, k: number) {
    const a = A();
    // tracheae: air tubes from spiracles on the body wall to the tissues
    if (st.tracheae) {
      ctx.strokeStyle = withAlpha('#74c0fc', 0.75);
      ctx.lineWidth = 1.6 / k;
      const sp: Pt[] = [
        [205, 448],
        [255, 448],
        [330, 462],
        [390, 466],
        [450, 466],
        [510, 462],
        [565, 445],
      ];
      for (const [sx, sy] of sp) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 6, sy - 60);
        ctx.lineTo(sx - 14, sy - 120);
        ctx.moveTo(sx + 6, sy - 60);
        ctx.lineTo(sx + 24, sy - 110);
        ctx.moveTo(sx - 14, sy - 120);
        ctx.lineTo(sx - 20, sy - 160);
        ctx.stroke();
        ctx.fillStyle = '#74c0fc';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      areas.push({ test: (x, y) => y > 430 && y < 480 && x > 190 && x < 580, title: 'Spiracles and tracheae', text: () => 'Air enters through spiracles (holes in the body wall) and travels down branching tracheae right to the cells. This is how insects get oxygen: their hemolymph carries very little.' });
    }
    for (const o of a.organs) {
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.16);
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1.2 / k;
      ctx.beginPath();
      ctx.roundRect(o.x, o.y, o.w, o.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.font = fs(10.5, 700);
      ctx.fillStyle = pal['text-muted'];
      ctx.textAlign = 'center';
      ctx.fillText(o.label, o.x + o.w / 2, o.y + o.h / 2 + 4);
      areas.push({ test: (x, y) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h, title: o.label, text: () => o.info });
    }
    // dorsal vessel with ostia
    const sq = Math.pow(Math.max(0, Math.sin(2 * Math.PI * beat)), 2);
    ctx.strokeStyle = withAlpha(HEMOLYMPH, 0.7);
    ctx.lineWidth = 14 - 4 * sq;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(585, VY);
    ctx.lineTo(132, VY);
    ctx.stroke();
    ctx.fillStyle = pal['sim-text'];
    for (const ox of OSTIA) {
      ctx.beginPath();
      ctx.ellipse(ox, VY + 8, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = fs(10.5, 700);
    ctx.textAlign = 'left';
    ctx.fillText('Dorsal vessel (heart) ← pumps forwards', 300, VY - 18);
    ctx.fillText('ostia', 520, VY + 26);
    areas.push(
      { test: (x, y) => y > VY - 12 && y < VY + 14 && x > 130 && x < 590, title: 'Dorsal vessel', text: () => 'A muscular tube along the insect’s back. The rear part (the heart) pumps hemolymph forwards; the front part (the aorta) carries it to the head, where it spills out into the body cavity.' },
      { test: (x, y) => inBody(x, y), title: 'Hemocoel (body cavity)', text: () => 'In an open system there are no capillaries or veins: hemolymph flows freely around the organs, delivering nutrients and hormones and collecting wastes, then drifts back to the heart.' },
    );
    for (const h of hemo) {
      ctx.fillStyle = HEMOLYMPH;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
      if (h.tracked) {
        ctx.strokeStyle = pal.warning;
        ctx.lineWidth = 3 / k;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /* ---------- Vessel inspector ---------- */
  function drawVessel(fs: Fs, k: number) {
    const r = vesselR();
    ctx.fillStyle = pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    const titleText = A().open ? 'No arteries, capillaries or veins' : { artery: 'Artery', capillary: 'Capillary', vein: 'Vein' }[st.vessel];
    ctx.fillText(titleText, r.x + 14, r.y + 22);
    const cy = r.y + r.h / 2 + 4;
    const x0 = r.x + 20;
    const x1 = r.x + r.w - 20;
    if (A().open) {
      ctx.font = fs(10.5, 600);
      ctx.fillStyle = pal['text-muted'];
      wrap('Insects have only a dorsal vessel. Everywhere else, hemolymph flows freely through the body cavity, so the vessel inspector does not apply. Choose a fish, frog or mammal to compare blood vessels.', r.x + 14, r.y + 48, r.w - 28, 16 / k);
      return;
    }
    const t = beat;
    const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * t)), 2);
    const cfg = st.vessel === 'artery' ? { wall: 22, lumen: 26 + 4 * pulse, cells: 6, speed: 1.2 } : st.vessel === 'vein' ? { wall: 7, lumen: 46, cells: 7, speed: 0.5 } : { wall: 3, lumen: 14, cells: 3, speed: 0.25 };
    const top = cy - cfg.lumen / 2;
    const bottom = cy + cfg.lumen / 2;
    // walls
    if (st.vessel === 'artery') {
      // three layers: outer connective tissue, thick muscle and elastic middle layer, thin inner lining
      ctx.fillStyle = withAlpha(pal.warning, 0.45);
      ctx.fillRect(x0, top - cfg.wall, x1 - x0, cfg.wall * 0.65);
      ctx.fillRect(x0, bottom + cfg.wall * 0.35, x1 - x0, cfg.wall * 0.65);
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.5);
      ctx.fillRect(x0, top - cfg.wall * 0.35, x1 - x0, cfg.wall * 0.35);
      ctx.fillRect(x0, bottom, x1 - x0, cfg.wall * 0.35);
    } else {
      ctx.fillStyle = withAlpha(pal['text-faint'], 0.55);
      ctx.fillRect(x0, top - cfg.wall, x1 - x0, cfg.wall);
      ctx.fillRect(x0, bottom, x1 - x0, cfg.wall);
    }
    // valve in the vein
    if (st.vessel === 'vein') {
      const vx = (x0 + x1) / 2;
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2.5 / k;
      ctx.beginPath();
      ctx.moveTo(vx - 18, top);
      ctx.quadraticCurveTo(vx, top + 6, vx + 6, cy - 3);
      ctx.moveTo(vx - 18, bottom);
      ctx.quadraticCurveTo(vx, bottom - 6, vx + 6, cy + 3);
      ctx.stroke();
    }
    // red blood cells moving left to right
    const sat = st.vessel === 'artery' ? A().arterialMax : st.vessel === 'vein' ? venous() : (A().arterialMax + venous()) / 2;
    for (let i = 0; i < cfg.cells * 2; i++) {
      const u = (((i / (cfg.cells * 2) + t * cfg.speed * 0.25) % 1) + 1) % 1;
      const x = x0 + 8 + u * (x1 - x0 - 16);
      const y = cy + (st.vessel === 'capillary' ? 0 : Math.sin(i * 2.1) * cfg.lumen * 0.25);
      ctx.fillStyle = satColour(st.vessel === 'capillary' ? A().arterialMax + (venous() - A().arterialMax) * u : sat);
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // exchange arrows across the capillary wall
    if (st.vessel === 'capillary') {
      ctx.font = fs(9.5, 700);
      ctx.textAlign = 'center';
      for (const [dx, label, out] of [
        [-80, 'O₂', true],
        [-25, 'glucose', true],
        [30, 'CO₂', false],
        [85, 'urea', false],
      ] as const) {
        const x = (x0 + x1) / 2 + dx;
        ctx.strokeStyle = out ? pal.danger : pal['accent-2'];
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2 / k;
        const ya = out ? top - 6 : top - 34;
        const yb = out ? top - 34 : top - 6;
        ctx.beginPath();
        ctx.moveTo(x, ya);
        ctx.lineTo(x, yb);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, yb + (out ? -6 : 6));
        ctx.lineTo(x - 5, yb + (out ? 2 : -2));
        ctx.lineTo(x + 5, yb + (out ? 2 : -2));
        ctx.fill();
        ctx.fillText(label, x, top - 40);
      }
    }
    ctx.font = fs(10, 600);
    ctx.fillStyle = pal['text-muted'];
    ctx.textAlign = 'left';
    const caption = {
      artery: 'Thick, muscular, elastic wall; narrow lumen; high pressure. Carries blood away from the heart and pulses with each beat.',
      capillary: 'Wall only one cell thick; red blood cells pass in single file. This is where substances are exchanged with the tissues.',
      vein: 'Thin wall, wide lumen, low pressure. Valves stop blood flowing backwards on its way to the heart.',
    }[st.vessel];
    wrap(caption, r.x + 14, r.y + r.h - 50 / k * 0.9, r.w - 28, 15 / k);
    areas.push({ test: (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h, title: titleText, text: () => caption });
  }
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

  /* ---------- Comparison chart ---------- */
  function drawChart(fs: Fs, k: number) {
    const r = chartR();
    ctx.fillStyle = pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(portrait() ? 'Pressure to the body' : 'Pressure driving blood to the body', r.x + 14, r.y + 22);
    ctx.font = fs(9.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('approximate mean, mmHg', r.x + 14, r.y + 22 + 15 / k);
    const x0 = r.x + 24;
    const bw = (r.w - 48) / 4;
    const base = r.y + r.h - 34;
    const top = r.y + 30 + 34 / k;
    ORDER.forEach((id, i) => {
      const a = ANIMALS[id];
      const h = ((base - top) * a.pressureBody) / 100;
      const x = x0 + i * bw + bw * 0.18;
      ctx.fillStyle = id === st.animal ? pal.danger : withAlpha(pal['text-faint'], 0.5);
      ctx.fillRect(x, base - h, bw * 0.64, h);
      ctx.font = fs(10, 700);
      ctx.fillStyle = pal['sim-text'];
      ctx.textAlign = 'center';
      ctx.fillText(id === 'insect' ? '≈3' : `≈${a.pressureBody}`, x + bw * 0.32, base - h - 6);
      ctx.font = fs(9.5, 650);
      ctx.fillStyle = id === st.animal ? pal['sim-text'] : pal['text-muted'];
      ctx.fillText({ insect: 'Insect', fish: 'Fish', frog: 'Frog', mammal: 'Mammal' }[id], x + bw * 0.32, base + 16);
      areas.push({
        test: (px, py) => px > x - 4 && px < x + bw * 0.7 && py > top && py < base + 20,
        title: `${a.name} (${a.example})`,
        text: () => `${a.circulation}. ${a.supports}.`,
      });
    });
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
    if (hintEl) hintEl.style.display = 'none';
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    const d = diagR();
    ctx.save();
    ctx.translate(d.x, d.y);
    drawOutline(k);
    if (A().open) drawOpen(fs, k);
    else drawClosed(fs, k);
    ctx.font = fs(11, 700);
    ctx.fillStyle = pal['text-muted'];
    ctx.textAlign = 'left';
    ctx.fillText(`${A().name} (${A().example}): ${A().circulation.toLowerCase()} · schematic`, 12, 18);
    ctx.restore();
    if (d.x) areas = areas.map((a) => ({ ...a, test: (x: number, y: number) => a.test(x - d.x, y - d.y) }));
    drawVessel(fs, k);
    drawChart(fs, k);
    ctx.restore();
    updateUi();
  }

  /* ---------- Readouts ---------- */
  function avgSat(ids: string[]) {
    const ps = parts.filter((p) => ids.includes(p.leg));
    return ps.length ? ps.reduce((s, p) => s + p.sat, 0) / ps.length : NaN;
  }
  function updateUi() {
    const a = A();
    ui.readout('type', a.circulation, null);
    ui.readout('chambers', a.chambers);
    ui.readout('passes', a.passes);
    ui.readout('hr', a.hr ? `about ${Math.round(heartRate())} beats per minute` : 'varies widely between species');
    if (a.open) {
      ui.readout('o2out', 'Hemolymph carries little oxygen');
      ui.readout('o2back', 'Oxygen arrives through the tracheae');
    } else {
      const toBody = avgSat(st.animal === 'mammal' ? ['ao'] : st.animal === 'fish' ? ['da'] : ['sys']);
      const back = avgSat(st.animal === 'fish' ? ['vn'] : ['vc']);
      ui.readout('o2out', isNaN(toBody) ? '—' : `${Math.round(toBody * 100)}% saturated`);
      ui.readout('o2back', isNaN(back) ? '—' : `${Math.round(back * 100)}% saturated`);
    }
    ui.readout('supports', a.supports);
    sim.setBadge(st.act < 0.15 ? 'At rest' : st.act > 0.85 ? 'Maximum activity' : 'Active');
    canvas.setAttribute('aria-label', `Schematic circulatory system of a ${a.example}: ${a.circulation.toLowerCase()}. Activity ${Math.round(st.act * 100)} percent.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  function intro() {
    noteEl.textContent = A().summary;
  }
  const animalCtl = ui.choice<AnimalId>('cs-animal', (v) => {
    st.animal = v;
    setup();
    intro();
    ui.showWhen('[data-only="insect"]', v === 'insect');
    sim.hideTooltip();
    sim.requestRender();
  });
  const actCtl = ui.range('cs-act', (v) => (v < 15 ? `${v}% (resting)` : v > 85 ? `${v}% (flat out)` : `${v}%`), (v) => {
    st.act = v / 100;
    sim.requestRender();
  });
  const vesselCtl = ui.choice<Vessel>('cs-vessel', (v) => ((st.vessel = v), sim.requestRender()));
  const trachCtl = ui.toggle('cs-tracheae', (v) => ((st.tracheae = v), sim.requestRender()));
  followBtn.addEventListener('click', () => {
    tracking = !tracking;
    followBtn.setAttribute('aria-pressed', String(tracking));
    for (const p of parts) p.tracked = false;
    for (const h of hemo) h.tracked = false;
    if (!tracking) return (intro(), sim.requestRender());
    if (A().open) {
      const h = hemo.find((q) => q.inVessel) ?? hemo[0];
      h.tracked = true;
      narrate('Following one drop of hemolymph. Watch it travel forwards along the dorsal vessel.');
    } else {
      // pick a cell entering the heart from the body, so the story starts at the beginning
      const startLeg = st.animal === 'fish' ? 'vn' : 'vc';
      const p = parts.find((q) => q.leg === startLeg) ?? parts[0];
      p.tracked = true;
      trip = [];
      onTrackedEnter(legs.get(p.leg)!);
    }
    if (!sim.running) sim.play();
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const a = areas.find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, DEF);
      animalCtl.set(DEF.animal, false);
      actCtl.set(0, false);
      vesselCtl.set(DEF.vessel, false);
      trachCtl.set(true, false);
      ui.showWhen('[data-only="insect"]', false);
      setup();
      intro();
    },
  });
  setup();
  intro();
}
