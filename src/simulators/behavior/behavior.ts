/**
 * Animal behaviour and biological rhythms, in three views:
 *   habitat  – a flock of migratory songbirds in a meadow with food, bushes
 *              (shelter) and a hawk. Temperature, day length, food and the
 *              predator change what the birds do: forage, roost, hide after
 *              an alarm call, sing and defend territories, or migrate.
 *   rhythms  – a 24-hour clock and an actogram for a diurnal, nocturnal or
 *              crepuscular animal, with constant darkness and a jet-lag shift
 *   learning – instinct (goose egg-rolling), habituation (a snail) and
 *              trial-and-error learning (a young bird and warning colours)
 *
 * The habitat is a simple rule-based model, not a simulation of real birds:
 * each bird follows a few rules in order of priority (migrate if the days are
 * short; roost at night; flee to a bush when alarmed; feed when hungry;
 * defend a territory in the breeding season; otherwise rest and wander).
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, withAlpha } from '../shared/draw';
import { EXP, RHYTHM, type ExpId, type RhythmId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type View = 'habitat' | 'rhythms' | 'learning';
type Pt = [number, number];
type Fs = (px: number, w?: number) => string;

const DEF = {
  view: 'habitat' as View,
  temp: 18,
  day: 14,
  food: 60,
  predator: false,
  alarm: true,
  terr: true,
  rhythm: 'nocturnal' as RhythmId,
  rday: 12,
  dd: false,
  exp: 'instinct' as ExpId,
  obj: 'egg' as 'egg' | 'ball',
};

/* ---------- Habitat ---------- */
const BUSH: Pt[] = [[150, 336], [520, 336], [862, 336]];
const PERCH: Pt[] = [[330, 262], [692, 262]];
const TERR_R = 135;
const N_BIRDS = 12;
type BState = 'rest' | 'forage' | 'eat' | 'toroost' | 'roost' | 'flee' | 'hide' | 'toperch' | 'sing' | 'chase' | 'chased' | 'migrate' | 'away' | 'return';
interface Bird {
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: BState;
  e: number;
  male: boolean;
  young: boolean;
  holder: number;
  timer: number;
  food: Food | null;
  chase: Bird | null;
  dir: number;
  flap: number;
  fly: boolean;
  alarm: number;
  caught: boolean;
}
interface Food {
  x: number;
  y: number;
  insect: boolean;
}
type Cat = 'forage' | 'rest' | 'hide' | 'territory' | 'migrate';
const CATS: Cat[] = ['forage', 'rest', 'hide', 'territory', 'migrate'];
const CAT_NAME: Record<Cat, string> = { forage: 'Foraging', rest: 'Resting, roosting', hide: 'Hiding', territory: 'Song, territory', migrate: 'Migrating, away' };
const CAT_COL: Record<Cat, string> = { forage: '#40a845', rest: '#7c8db5', hide: '#e8590c', territory: '#e0a800', migrate: '#9c5de0' };
const catOf = (s: BState): Cat =>
  s === 'forage' || s === 'eat' ? 'forage' : s === 'flee' || s === 'hide' ? 'hide' : s === 'sing' || s === 'chase' || s === 'toperch' ? 'territory' : s === 'migrate' || s === 'away' || s === 'return' ? 'migrate' : 'rest';

/* ---------- Rhythms ---------- */
const RCOL: Record<RhythmId, string> = { diurnal: '#f2a516', nocturnal: '#6c7cf5', crepuscular: '#e8590c' };
const DAYS_SHOWN = 14;
const R_HPS = 4.8; // simulated hours per second

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap24 = (h: number) => ((h % 24) + 24) % 24;
const wrapPM = (h: number) => {
  const w = wrap24(h);
  return w > 12 ? w - 24 : w;
};
const hhmm = (h: number) => {
  const w = wrap24(h);
  const m = Math.floor(w * 60 + 1e-6);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

interface Area {
  test: (x: number, y: number) => boolean;
  title: string;
  text: () => string;
}

export function initBehavior(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => ((pal = readPalette(COLORS)), sim.requestRender()));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const st = { ...DEF };
  let simT = 0;

  /* ======================= Habitat model ======================= */
  let clock = 7;
  let dayNo = 1;
  let birds: Bird[] = [];
  let foods: Food[] = [];
  let foodAcc = 0;
  let caught = 0;
  let fledged = 0;
  let alarmT = -1;
  let lastCatch = -99;
  const hawk = { phase: 'off' as 'off' | 'enter' | 'circle' | 'swoop' | 'leave', x: 1100, y: 60, t: 0, next: 3, target: null as Bird | null, dir: -1 };
  const budget: Record<Cat, number> = { forage: 0.4, rest: 0.4, hide: 0, territory: 0.2, migrate: 0 };

  const sunrise = () => 12 - st.day / 2;
  const sunset = () => 12 + st.day / 2;
  function light(h: number) {
    const a = ease((h - (sunrise() - 0.6)) / 1.2);
    const b = 1 - ease((h - (sunset() - 0.6)) / 1.2);
    return clamp(Math.min(a, b), 0, 1);
  }
  const breeding = () => st.day >= 13 && st.temp >= 5;
  const migrateCue = () => st.day <= 10.5 || (st.temp <= -2 && st.food <= 25);

  function newBird(male: boolean, young = false): Bird {
    const b: Bird = { x: 0, y: 0, tx: 0, ty: 0, state: 'rest', e: 0.5 + Math.random() * 0.4, male, young, holder: -1, timer: 0, food: null, chase: null, dir: 1, flap: Math.random() * 6, fly: false, alarm: -9, caught: false };
    pickRest(b);
    b.x = b.tx;
    b.y = b.ty;
    return b;
  }
  function pickRest(b: Bird) {
    b.tx = 40 + Math.random() * 920;
    b.ty = 356 + Math.random() * 62;
    b.timer = 2 + Math.random() * 3;
  }
  function assignHolders() {
    const males = birds.filter((b) => b.male && !b.young);
    for (let k = 0; k < PERCH.length; k++) {
      if (males.some((m) => m.holder === k)) continue;
      const free = males.find((m) => m.holder < 0);
      if (free) free.holder = k;
    }
  }
  function resetHabitat() {
    birds = [];
    for (let i = 0; i < N_BIRDS; i++) birds.push(newBird(i % 2 === 0));
    assignHolders();
    foods = [];
    for (let i = 0; i < 18; i++) foods.push(newFood());
    caught = 0;
    fledged = 0;
    clock = 7;
    dayNo = 1;
    hawk.phase = 'off';
    hawk.next = 3;
    alarmT = -1;
  }
  function newFood(): Food {
    return { x: 30 + Math.random() * 940, y: 362 + Math.random() * 64, insect: st.temp > 5 && Math.random() < 0.5 };
  }
  function move(b: Bird, spd: number, dt: number) {
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 1) b.dir = dx > 0 ? 1 : -1;
    b.fly = spd >= 100 && d > 4;
    if (d <= spd * dt || d < 1) {
      b.x = b.tx;
      b.y = b.ty;
      b.fly = false;
      return true;
    }
    b.x += (dx / d) * spd * dt;
    b.y += (dy / d) * spd * dt;
    return false;
  }
  const nearestBush = (b: Bird) => {
    let k = 0;
    BUSH.forEach((p, i) => {
      if (Math.abs(p[0] - b.x) < Math.abs(BUSH[k][0] - b.x)) k = i;
    });
    return k;
  };
  const exposed = (b: Bird) => !['hide', 'roost', 'away', 'migrate', 'return'].includes(b.state);

  function newDay() {
    dayNo++;
    if (breeding() && birds.length < N_BIRDS && birds.some((b) => b.state !== 'away')) {
      const y = newBird(Math.random() < 0.5, true);
      const k = Math.floor(Math.random() * BUSH.length);
      y.x = BUSH[k][0];
      y.y = BUSH[k][1];
      birds.push(y);
      fledged++;
    }
    for (const b of birds) if (b.young && Math.random() < 0.5) b.young = false;
    assignHolders();
  }

  function stepHawk(dt: number, L: number) {
    const present = birds.filter((b) => b.state !== 'away');
    if (hawk.phase === 'off') {
      alarmT = -1;
      if (st.predator && L > 0.6 && present.length) {
        hawk.next -= dt;
        if (hawk.next <= 0) {
          hawk.phase = 'enter';
          hawk.x = 1080;
          hawk.y = 50;
          hawk.t = 0;
        }
      }
      return;
    }
    hawk.t += dt;
    const go = (tx: number, ty: number, spd: number) => {
      const d = Math.hypot(tx - hawk.x, ty - hawk.y);
      if (Math.abs(tx - hawk.x) > 1) hawk.dir = tx > hawk.x ? 1 : -1;
      if (d <= spd * dt) {
        hawk.x = tx;
        hawk.y = ty;
        return true;
      }
      hawk.x += ((tx - hawk.x) / d) * spd * dt;
      hawk.y += ((ty - hawk.y) / d) * spd * dt;
      return false;
    };
    if ((L < 0.5 || !st.predator) && hawk.phase !== 'leave') hawk.phase = 'leave';
    if (hawk.phase === 'enter') {
      if (go(720, 110, 230)) {
        hawk.phase = 'circle';
        hawk.t = 0;
      }
    } else if (hawk.phase === 'circle') {
      const a = hawk.t * 1.5;
      const nx = 500 + Math.cos(a) * 220;
      hawk.dir = -Math.sin(a) > 0 ? 1 : -1;
      hawk.x = nx;
      hawk.y = 110 + Math.sin(a) * 45;
      if (hawk.t > 4.2) {
        const targets = birds.filter((b) => exposed(b) && b.y > 220);
        targets.sort((p, q) => dist(p, hawk) - dist(q, hawk));
        hawk.target = targets[0] ?? null;
        hawk.phase = hawk.target ? 'swoop' : 'leave';
        hawk.t = 0;
      }
    } else if (hawk.phase === 'swoop') {
      const tg = hawk.target!;
      if (!exposed(tg) || tg.caught) {
        hawk.phase = 'leave';
      } else if (go(tg.x, tg.y - 6, 430)) {
        if (Math.random() < 0.7) {
          tg.caught = true;
          caught++;
          lastCatch = simT;
          sim.announce('The hawk caught a bird that was still in the open.');
        }
        hawk.phase = 'leave';
      }
    } else if (hawk.phase === 'leave') {
      if (go(1120, -60, 280)) {
        hawk.phase = 'off';
        hawk.next = 8 + Math.random() * 6;
      }
    }
  }

  function stepHabitat(dt: number) {
    const L = light(clock);
    const prev = clock;
    clock += dt * (L > 0.5 ? 0.6 : 1.6);
    if (clock >= 24) clock -= 24;
    if (prev < sunrise() && clock >= sunrise()) newDay();
    // food grows back
    const f = st.food / 100;
    const max = Math.round(40 * f);
    foodAcc += dt * 3 * f * (st.temp < 0 ? 0.4 : 1);
    while (foodAcc >= 1) {
      foodAcc -= 1;
      if (foods.length < max) foods.push(newFood());
    }
    if (foods.length > max) foods.length = max;
    for (const fd of foods) if (fd.insect && st.temp <= 5) fd.insect = false;
    stepHawk(dt, L);
    const danger = hawk.phase === 'circle' || hawk.phase === 'swoop' || (hawk.phase === 'enter' && hawk.x < 980);
    if (danger && alarmT < 0)
      for (const b of birds)
        if (exposed(b) && dist(b, hawk) < 320) {
          alarmT = simT;
          b.alarm = simT;
          break;
        }
    const ctxB = { L, danger, breed: breeding(), mig: migrateCue() };
    for (const b of birds) updateBird(b, dt, ctxB);
    birds = birds.filter((b) => !b.caught);
    // time budget (smoothed over about half a simulated day)
    const tot = birds.length || 1;
    const c: Record<Cat, number> = { forage: 0, rest: 0, hide: 0, territory: 0, migrate: 0 };
    for (const b of birds) c[catOf(b.state)]++;
    const k = Math.min(1, dt / 12);
    for (const cat of CATS) budget[cat] += (c[cat] / tot - budget[cat]) * k;
  }

  function updateBird(b: Bird, dt: number, cx: { L: number; danger: boolean; breed: boolean; mig: boolean }) {
    const cost = 0.02 * (1 + Math.max(0, (12 - st.temp) / 15)) * (b.state === 'roost' ? 0.3 : b.state === 'away' ? 0 : 1);
    b.e = Math.max(0, b.e - cost * dt);
    b.flap += dt * 22;
    if (b.state === 'away') {
      if (!cx.mig) {
        b.state = 'return';
        b.x = -30 - Math.random() * 120;
        b.y = 60 + Math.random() * 80;
        pickRest(b);
        b.e = 0.8;
      }
      return;
    }
    if (cx.mig && b.state !== 'migrate') {
      b.state = 'migrate';
      b.tx = -60 - Math.random() * 60;
      b.ty = 50 + Math.random() * 70;
    }
    if (b.state === 'migrate') {
      if (move(b, 160, dt)) b.state = 'away';
      return;
    }
    if (b.state === 'return') {
      if (move(b, 150, dt)) b.state = 'rest';
      return;
    }
    // night: roost in a bush
    if (cx.L < 0.2) {
      if (b.state !== 'roost') {
        if (b.state !== 'toroost') {
          const k = nearestBush(b);
          b.tx = BUSH[k][0] + (Math.random() - 0.5) * 70;
          b.ty = BUSH[k][1] - 8 + (Math.random() - 0.5) * 24;
          b.state = 'toroost';
        }
        if (move(b, 120, dt)) b.state = 'roost';
      }
      return;
    }
    if (b.state === 'roost' || b.state === 'toroost') {
      b.state = 'rest';
      pickRest(b);
    }
    // danger: alarm calls warn the whole flock; without them each bird must see the hawk itself
    const sees = cx.danger && dist(b, hawk) < 320;
    const alarmed = cx.danger && (sees || (st.alarm && alarmT >= 0 && simT - alarmT > 0.25));
    if (alarmed) {
      if (b.state !== 'flee' && b.state !== 'hide') {
        const k = nearestBush(b);
        b.tx = BUSH[k][0] + (Math.random() - 0.5) * 70;
        b.ty = BUSH[k][1] - 6 + (Math.random() - 0.5) * 22;
        b.state = 'flee';
      }
    }
    if (b.state === 'flee') {
      if (move(b, 210, dt)) {
        b.state = 'hide';
        b.timer = 1.5 + Math.random() * 1.5;
      }
      return;
    }
    if (b.state === 'hide') {
      if (cx.danger) return;
      b.timer -= dt;
      if (b.timer > 0) return;
      b.state = 'rest';
      pickRest(b);
    }
    if (b.state === 'chased') {
      if (move(b, 170, dt)) {
        b.state = 'rest';
        b.timer = 2;
      }
      return;
    }
    // feeding
    if (b.state === 'eat') {
      b.timer -= dt;
      if (b.timer <= 0) b.state = b.e < 0.85 ? 'forage' : 'rest';
      return;
    }
    if (b.e < 0.55 || (b.state === 'forage' && b.e < 0.9)) {
      b.state = 'forage';
      if (!b.food || !foods.includes(b.food)) {
        b.food = null;
        let best = Infinity;
        for (const fd of foods) {
          const d = Math.hypot(fd.x - b.x, fd.y - b.y);
          if (d < best) {
            best = d;
            b.food = fd;
          }
        }
        if (b.food) {
          b.tx = b.food.x;
          b.ty = b.food.y - 4;
        } else if (b.timer <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < 2) pickRest(b);
      }
      b.timer -= dt;
      if (move(b, b.food ? 110 : 60, dt) && b.food) {
        foods.splice(foods.indexOf(b.food), 1);
        b.food = null;
        b.e = Math.min(1, b.e + 0.3);
        b.state = 'eat';
        b.timer = 0.45;
      }
      return;
    }
    // territory: holders sing from a perch and chase away other males
    if (cx.breed && b.holder >= 0) {
      const [px, py] = PERCH[b.holder];
      if (b.state === 'chase' && b.chase) {
        b.tx = b.chase.x;
        b.ty = b.chase.y - 4;
        b.timer -= dt;
        move(b, 185, dt);
        if (b.timer <= 0 || Math.abs(b.chase.x - px) > TERR_R + 20) b.state = 'toperch';
        return;
      }
      if (b.state === 'sing') {
        b.x = px;
        b.y = py;
        const intr = birds.find((o) => o !== b && o.male && o.holder < 0 && !o.young && exposed(o) && o.state !== 'chased' && o.y > 300 && Math.abs(o.x - px) < TERR_R);
        if (intr) {
          b.state = 'chase';
          b.chase = intr;
          b.timer = 1.8;
          intr.state = 'chased';
          intr.tx = clamp(intr.x < px ? px - TERR_R - 70 : px + TERR_R + 70, 20, 980);
          intr.ty = 360 + Math.random() * 50;
        }
        return;
      }
      b.state = 'toperch';
      b.tx = px;
      b.ty = py;
      if (move(b, 140, dt)) b.state = 'sing';
      return;
    }
    if (b.state !== 'rest') {
      b.state = 'rest';
      pickRest(b);
    }
    b.timer -= dt;
    if (b.timer <= 0) pickRest(b);
    move(b, 45, dt);
  }

  /* ======================= Rhythms model ======================= */
  let rT = 0; // simulated hours since the start
  let P = 0; // internal "subjective dawn", clock hour
  let shift = 0;
  let lastLD = 12;
  let prevLight = false;
  let rows: { day: number; act: Uint8Array; light: Uint8Array }[] = [];
  let lastBin = -1;
  let jetT = -99;
  const lightsOn = () => wrap24(12 - st.rday / 2 + shift);
  const isLight = (h: number) => !st.dd && wrap24(h - lightsOn()) < st.rday;
  function activeAt(id: RhythmId, h: number, p: number, D: number) {
    const r = wrap24(h - p);
    if (id === 'diurnal') return r >= 0.3 && r <= D - 0.3;
    if (id === 'nocturnal') return r >= D + 0.3 && r <= 23.7;
    return r >= 22.6 || r <= 1.4 || Math.abs(r - D) <= 1.4;
  }
  const Dint = () => (st.dd ? lastLD : st.rday);
  function resetRhythms() {
    rT = 6;
    shift = 0;
    P = lightsOn();
    rows = [];
    lastBin = -1;
    prevLight = isLight(rT);
    jetT = -99;
  }
  function stepRhythms(dt: number) {
    const dh = dt * R_HPS;
    rT += dh;
    const tau = RHYTHM[st.rhythm].tau;
    P = wrap24(P + ((tau - 24) * dh) / 24);
    const h = wrap24(rT);
    const lit = isLight(h);
    if (lit && !prevLight) {
      const e = wrapPM(lightsOn() - P);
      P = wrap24(P + clamp(0.7 * e, -1.5, 1.5));
    }
    prevLight = lit;
    if (!st.dd) lastLD = st.rday;
    const day = Math.floor(rT / 24);
    let row = rows[rows.length - 1];
    if (!row || row.day !== day) {
      row = { day, act: new Uint8Array(96), light: new Uint8Array(96) };
      rows.push(row);
      if (rows.length > DAYS_SHOWN) rows.shift();
    }
    const bin = Math.floor(h * 4) % 96;
    if (bin !== lastBin) {
      lastBin = bin;
      row.light[bin] = lit ? 1 : 0;
      row.act[bin] = activeAt(st.rhythm, h + 0.125, P, Dint()) && Math.random() < 0.85 ? 1 : 0;
    }
  }

  /* ======================= Learning models ======================= */
  const inst = { phase: 'idle' as 'idle' | 'notice' | 'reach' | 'roll' | 'settle', t: 0, obj: 'egg' as 'egg' | 'ball', removed: false, rolls: 0, removedRolls: 0, log: [] as string[] };
  const hab = { h: 0, events: [] as { kind: 'touch' | 'shadow' | 'rest'; s: number }[], anim: null as null | { t0: number; s: number; kind: 'touch' | 'shadow' }, taps: 0 };
  const tri = { pS: 0.9, pP: 0.9, offers: 0, hist: [{ pS: 0.9, pP: 0.9 }], cur: null as null | { kind: 'plain' | 'striped'; t0: number; attack: boolean; done: boolean }, log: [] as string[], auto: 0 };
  function resetLearning() {
    Object.assign(inst, { phase: 'idle', t: 0, removed: false, rolls: 0, removedRolls: 0, log: [] });
    Object.assign(hab, { h: 0, events: [], anim: null, taps: 0 });
    Object.assign(tri, { pS: 0.9, pP: 0.9, offers: 0, hist: [{ pS: 0.9, pP: 0.9 }], cur: null, log: [], auto: 0 });
  }
  const OBJ0: Pt = [440, 346];
  const NEST: Pt = [205, 350];
  const IDLE_HEAD: Pt = [300, 196];
  function instObj(): Pt {
    if (inst.phase === 'roll') {
      const u = ease(inst.t / 3);
      return [lerp(OBJ0[0], NEST[0] + 92, u), OBJ0[1]];
    }
    return OBJ0;
  }
  function instHead(): Pt {
    const reach: Pt = [OBJ0[0] + 14, OBJ0[1] - 20];
    if (inst.phase === 'reach') {
      const u = ease(inst.t / 1.2);
      return [lerp(IDLE_HEAD[0], reach[0], u), lerp(IDLE_HEAD[1], reach[1], u)];
    }
    if (inst.phase === 'roll') {
      const [ox, oy] = instObj();
      return [ox + 14, oy - 20 + Math.sin(inst.t * 9) * 3];
    }
    if (inst.phase === 'settle') {
      const u = ease(inst.t / 0.9);
      return [lerp(NEST[0] + 106, IDLE_HEAD[0], u), lerp(OBJ0[1] - 20, IDLE_HEAD[1], u)];
    }
    return [IDLE_HEAD[0] + Math.sin(simT * 1.2) * 2, IDLE_HEAD[1]];
  }
  function stepLearning(dt: number) {
    if (inst.phase !== 'idle') {
      inst.t += dt;
      const dur = { notice: 0.6, reach: 1.2, roll: 3, settle: 0.9 }[inst.phase];
      if (inst.t >= dur) {
        inst.t = 0;
        if (inst.phase === 'notice') inst.phase = 'reach';
        else if (inst.phase === 'reach') inst.phase = 'roll';
        else if (inst.phase === 'roll') inst.phase = 'settle';
        else {
          inst.phase = 'idle';
          inst.rolls++;
          if (inst.removed) inst.removedRolls++;
          const name = inst.obj === 'egg' ? 'Egg' : 'Ball';
          inst.log.unshift(`Trial ${inst.rolls}: ${name}${inst.removed ? ' removed mid-roll. The goose completed the rolling movement anyway.' : ' rolled back into the nest.'}`);
          inst.log.length = Math.min(inst.log.length, 4);
          updateUi();
        }
      }
    }
    hab.h *= Math.exp(-dt / 25);
    if (tri.cur) {
      const a = simT - tri.cur.t0;
      if (!tri.cur.done && a > 1.4) {
        tri.cur.done = true;
        const c = tri.cur;
        if (c.attack && c.kind === 'striped') tri.pS = Math.max(0.03, tri.pS * 0.3);
        if (c.attack && c.kind === 'plain') tri.pP = Math.min(0.97, tri.pP + 0.03);
        tri.offers++;
        tri.hist.push({ pS: tri.pS, pP: tri.pP });
        tri.log.unshift(`Offer ${tri.offers}: ${c.kind} caterpillar, ${c.attack ? (c.kind === 'striped' ? 'attacked, tasted bad, dropped' : 'attacked and eaten') : 'ignored'}`);
        tri.log.length = Math.min(tri.log.length, 4);
        updateUi();
      }
      if (a > 2.6) tri.cur = null;
    }
    if (st.view === 'learning' && st.exp === 'trial') {
      tri.auto += dt;
      if (tri.auto > 3 && !tri.cur) {
        tri.auto = 0;
        offer(Math.random() < 0.5 ? 'plain' : 'striped');
      }
    }
  }
  function placeObject() {
    if (inst.phase !== 'idle') return;
    inst.phase = 'notice';
    inst.t = 0;
    inst.removed = false;
    inst.obj = st.obj;
    if (!sim.running) sim.play();
    updateUi();
  }
  function removeObject() {
    if (inst.phase === 'idle' || inst.phase === 'settle' || inst.removed) return;
    inst.removed = true;
    updateUi();
  }
  function stimulateSnail(kind: 'touch' | 'shadow') {
    if (hab.anim && simT - hab.anim.t0 < 1) return;
    let s: number;
    if (kind === 'touch') {
      s = Math.max(0.05, 1 - hab.h);
      hab.h += (1 - hab.h) * 0.32;
      hab.taps++;
    } else s = 1;
    hab.anim = { t0: simT, s, kind };
    hab.events.push({ kind, s });
    if (hab.events.length > 16) hab.events.shift();
    if (!sim.running) sim.play();
    updateUi();
  }
  function restSnail() {
    hab.h *= Math.exp(-30 / 25);
    hab.events.push({ kind: 'rest', s: 0 });
    if (hab.events.length > 16) hab.events.shift();
    updateUi();
    sim.requestRender();
  }
  function offer(kind: 'plain' | 'striped') {
    if (tri.cur) return;
    tri.cur = { kind, t0: simT, attack: Math.random() < (kind === 'striped' ? tri.pS : tri.pP), done: false };
    tri.auto = 0;
    if (!sim.running) sim.play();
  }

  /* ---------- Time ---------- */
  function step(dt: number) {
    dt = Math.min(dt, 0.05);
    simT += dt;
    if (st.view === 'habitat') stepHabitat(dt);
    else if (st.view === 'rhythms') stepRhythms(dt);
    else stepLearning(dt);
  }

  /* ---------- Layout and helpers ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number] => (portrait() ? [680, st.view === 'habitat' ? 720 : 1000] : [1000, 600]);
  const tf = () => {
    const [bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };
  let K = 1;
  let cur = 1;
  let frame = { x: 0, y: 0, s: 1 };
  const fs: Fs = (px, wt = 650) => font(px / cur, wt);
  function enter(x: number, y: number, s: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    frame = { x, y, s };
    cur = K * s;
  }
  function leave() {
    ctx.restore();
    frame = { x: 0, y: 0, s: 1 };
    cur = K;
  }
  let areas: Area[] = [];
  function rect(x: number, y: number, w: number, h: number, title: string, text: () => string) {
    const f = { ...frame };
    areas.push({ test: (px, py) => {
      const lx = (px - f.x) / f.s;
      const ly = (py - f.y) / f.s;
      return lx >= x && lx <= x + w && ly >= y && ly <= y + h;
    }, title, text });
  }
  function text(t: string, x: number, y: number, px = 12, color = pal['text-muted'], align: CanvasTextAlign = 'center', wt = 650) {
    ctx.font = fs(px, wt);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
    ctx.textAlign = 'left';
  }
  function wrap(t: string, x: number, y: number, maxW: number, lh: number) {
    let line = '';
    for (const w of t.split(' ')) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = w;
        y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lh;
  }
  function panel(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / cur;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }
  function poly(pts: Pt[], color: string, w: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  function mix(a: string, b: string, t: number) {
    const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const A = p(a);
    const B = p(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
  }

  /* ======================= Habitat drawing ======================= */
  function drawSongbird(x: number, y: number, dir: number, male: boolean, fly: boolean, flap: number, s = 1, fluff = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);
    const body = male ? '#e3b412' : '#a3a95c';
    const wing = male ? '#6b5a1a' : '#5f6436';
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(-8, -1);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 * fluff, 6.5 * fluff, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -5, 5 * Math.sqrt(fluff), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b3b3b';
    ctx.beginPath();
    ctx.moveTo(12, -6);
    ctx.lineTo(17, -4.5);
    ctx.lineTo(12, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(9.5, -6, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = wing;
    if (fly) {
      const w = Math.sin(flap) * 9;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(6, -2);
      ctx.lineTo(0, -2 - 10 - w);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(-2, -1, 6, 3.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawHawk() {
    ctx.save();
    ctx.translate(hawk.x, hawk.y);
    ctx.scale(hawk.dir, 1);
    const flap = hawk.phase === 'swoop' ? -0.6 : Math.sin(simT * 5) * 0.3;
    ctx.fillStyle = '#5b3d24';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.quadraticCurveTo(-26, -18 + flap * 20, -46, -8 + flap * 26);
    ctx.quadraticCurveTo(-24, 2, -6, 6);
    ctx.moveTo(6, 0);
    ctx.quadraticCurveTo(-4, -22 + flap * 20, 2, -10 + flap * 26);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 2, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.lineTo(-32, -2);
    ctx.lineTo(-32, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8d6b0';
    ctx.beginPath();
    ctx.arc(18, -1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0a800';
    ctx.beginPath();
    ctx.moveTo(23, -2);
    ctx.lineTo(28, 1);
    ctx.lineTo(22, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function bushShape(x: number, y: number, col: string) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const [dx, dy, r] of [[-44, 0, 34], [-14, -22, 38], [22, -14, 36], [48, 2, 30], [0, 6, 40]] as [number, number, number][]) {
      ctx.moveTo(x + dx + r, y + dy);
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawHabitat() {
    const L = light(clock);
    const cold = st.temp < 0;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, 330);
    g.addColorStop(0, mix('#0b1633', '#5aa7e8', L));
    g.addColorStop(1, mix('#1d2a4f', cold ? '#d4e4f2' : '#bfe0fa', L));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(0, 0, 1000, 440, 12);
    ctx.fill();
    if (L < 0.5) {
      ctx.fillStyle = withAlpha('#ffffff', 0.7 * (1 - L * 2));
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 131) % 990, (i * 47) % 260, 2, 2);
    }
    // sun or moon on an arc
    const sr = sunrise();
    const dayFrac = (clock - sr) / st.day;
    if (dayFrac > -0.05 && dayFrac < 1.05) {
      const sx = 60 + dayFrac * 880;
      const sy = 300 - Math.sin(clamp(dayFrac, 0, 1) * Math.PI) * 240;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
      sg.addColorStop(0, withAlpha('#fff3b0', 0.95));
      sg.addColorStop(0.3, withAlpha('#ffd43b', 0.8));
      sg.addColorStop(1, withAlpha('#ffd43b', 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, 60, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const nf = wrap24(clock - sunset()) / (24 - st.day);
      const mx = 60 + nf * 880;
      const my = 300 - Math.sin(nf * Math.PI) * 220;
      ctx.fillStyle = '#e9ecef';
      ctx.beginPath();
      ctx.arc(mx, my, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix('#0b1633', '#5aa7e8', L);
      ctx.beginPath();
      ctx.arc(mx + 7, my - 4, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // ground
    const grass = mix('#26402a', cold ? '#e9eef2' : st.temp > 28 ? '#b5a253' : '#6aa84f', 0.25 + 0.75 * L);
    ctx.fillStyle = grass;
    ctx.beginPath();
    ctx.roundRect(0, 330, 1000, 110, [0, 0, 12, 12]);
    ctx.fill();
    // territories
    if (breeding() && st.terr) {
      PERCH.forEach(([px], i) => {
        const holder = birds.find((b) => b.holder === i && b.state !== 'away');
        if (!holder) return;
        ctx.fillStyle = withAlpha('#e0a800', 0.1);
        ctx.strokeStyle = withAlpha('#e0a800', 0.6);
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(px, 384, TERR_R, 44, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
    // perches
    for (const [px, py] of PERCH) {
      ctx.fillStyle = mix('#3a2a1a', '#8a6a48', 0.3 + 0.7 * L);
      ctx.fillRect(px - 4, py + 6, 8, 340 - py);
    }
    // food
    for (const fd of foods) {
      ctx.fillStyle = fd.insect ? '#3b2a1a' : '#d9b56a';
      ctx.beginPath();
      ctx.ellipse(fd.x, fd.y, fd.insect ? 3.5 : 2.6, fd.insect ? 2.2 : 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // hidden birds (inside bushes)
    const fluff = st.temp < 5 ? 1.2 : 1;
    for (const b of birds) if (b.state === 'hide' || b.state === 'roost') drawSongbird(b.x, b.y, b.dir, b.male, false, b.flap, b.young ? 0.75 : 1, fluff);
    // bushes (shelter)
    const bushCol = mix('#173322', cold ? '#5d7a68' : '#2f7a43', 0.25 + 0.75 * L);
    ctx.globalAlpha = 0.92;
    for (const [bx, by] of BUSH) bushShape(bx, by - 10, bushCol);
    ctx.globalAlpha = 1;
    // visible birds
    for (const b of birds) {
      if (b.state === 'hide' || b.state === 'roost' || b.state === 'away') continue;
      const hop = !b.fly && (b.state === 'forage' || b.state === 'rest') && Math.hypot(b.tx - b.x, b.ty - b.y) > 2 ? -Math.abs(Math.sin(b.flap * 0.6)) * 4 : 0;
      drawSongbird(b.x, b.y + hop, b.dir, b.male, b.fly || b.state === 'migrate' || b.state === 'return', b.flap, b.young ? 0.75 : 1, b.fly ? 1 : fluff);
      if (b.state === 'sing' && Math.sin(simT * 3 + b.x) > 0) text('♪', b.x + 14 * b.dir, b.y - 18 - ((simT * 20) % 14), 15, '#e0a800', 'center', 700);
      if (b.state === 'chase') text('!', b.x, b.y - 16, 13, pal.danger, 'center', 800);
    }
    for (const b of birds) if (simT - b.alarm < 1.6 && b.state !== 'away') {
      ctx.fillStyle = withAlpha('#ffffff', 0.92);
      ctx.beginPath();
      ctx.roundRect(b.x - 34, b.y - 46, 68, 24, 10);
      ctx.fill();
      text('Alarm call!', b.x, b.y - 29, 11.5, '#c92a2a', 'center', 800);
    }
    if (hawk.phase !== 'off') drawHawk();
    if (simT - lastCatch < 2) text('Caught!', clamp(hawk.x, 60, 940), clamp(hawk.y - 22, 30, 420), 14, pal.danger, 'center', 800);
    if (birds.length && birds.every((b) => b.state === 'away')) {
      ctx.fillStyle = withAlpha(pal['bg-elev'], 0.85);
      ctx.beginPath();
      ctx.roundRect(300, 160, 400, 56, 14);
      ctx.fill();
      text('The birds have migrated south', 500, 186, 15, pal['sim-text'], 'center', 700);
      text(st.day <= 10.5 ? 'They return when the days get longer' : 'They return when it is warmer or food is plentiful', 500, 205, 12, pal['text-muted'], 'center', 600);
    }
    if (cold) text('Frost', 960, 428, 12, '#37506b', 'right', 700);
    text('Model: a flock of migratory songbirds (simplified)', 14, 24, 12, withAlpha('#ffffff', 0.85), 'left', 700);

    rect(0, 0, 1000, 320, 'Sky and daylight', () => `Day length is ${st.day} hours. Many animals use day length (photoperiod) as a calendar: it changes in the same way every year, unlike the weather. Long days trigger breeding; shortening days trigger migration and preparation for winter.`);
    rect(0, 330, 1000, 110, 'Food', () => `Seeds and insects grow back faster when food availability is high. Insects only appear when it is warmer than about 5 °C. Birds forage when they are hungry; in the cold they use more energy and must eat more.`);
    BUSH.forEach(([bx, by]) => rect(bx - 80, by - 70, 160, 90, 'Bushes (shelter)', () => 'Shelter from predators and from the cold. The birds hide here when a hawk appears and roost here at night.'));
    PERCH.forEach(([px, py]) => rect(px - 14, py - 20, 28, 340 - py + 20, 'Song perch and territory', () => 'In the breeding season, a male sings from a high perch to claim a territory: an area with food and nest sites that he defends. Song warns rival males away and attracts females. Other males that enter are chased out.'));
    if (hawk.phase !== 'off') rect(hawk.x - 50, hawk.y - 30, 100, 50, 'Hawk (predator)', () => 'A hawk hunts small birds by day. Birds that see it give an alarm call, a sharp note that warns others, and every bird that hears it flies to cover.');
  }

  function drawHabitatPanel(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    const P = portrait();
    // clock dial
    const cr = P ? 54 : 50;
    const cx = x + 18 + cr;
    const cy = y + (P ? 18 + cr : h / 2);
    const ang = (hr: number) => -Math.PI / 2 + (hr / 24) * Math.PI * 2;
    ctx.fillStyle = '#1d2a4f';
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, cr, ang(sunrise()), ang(sunset()));
    ctx.closePath();
    ctx.fill();
    poly([[cx, cy], [cx + Math.cos(ang(clock)) * (cr - 6), cy + Math.sin(ang(clock)) * (cr - 6)]], pal.danger, 3);
    text(hhmm(clock), cx, cy + cr + 18, 13, pal['sim-text'], 'center', 700);
    rect(cx - cr, cy - cr, cr * 2, cr * 2 + 24, '24-hour clock', () => `Yellow is daylight (${st.day} h), dark blue is night. Change the daylight hours to move through the seasons.`);
    // time budget
    const bx = P ? cx + cr + 30 : x + 160;
    const bw = P ? x + w - 16 - bx : (w - 160) * 0.56;
    const by = y + 34;
    text('Time budget (share of birds)', bx, by - 12, 12.5, pal['sim-text'], 'left', 700);
    let acc = 0;
    const tot = CATS.reduce((s, c) => s + budget[c], 0) || 1;
    for (const c of CATS) {
      const f = budget[c] / tot;
      ctx.fillStyle = CAT_COL[c];
      ctx.fillRect(bx + acc * bw, by, f * bw, 22);
      acc += f;
    }
    CATS.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = bx + col * (bw / 2);
      const ly = by + 42 + row * (P ? 24 : 21);
      ctx.fillStyle = CAT_COL[c];
      ctx.fillRect(lx, ly - 10, 11, 11);
      text(`${CAT_NAME[c]} ${Math.round((budget[c] / tot) * 100)}%`, lx + 16, ly, 11.5, pal['text-muted'], 'left', 600);
    });
    rect(bx, by - 24, bw, 110, 'Time budget', () => 'How the flock divides its time between activities, averaged over about half a day. Animals must balance feeding, resting, avoiding predators and reproducing.');
    // active cues
    const cues: [string, string, boolean][] = [
      [`Long days`, 'song, territories', breeding()],
      [`Short days`, 'migrate south', st.day <= 10.5],
      ['Darkness', 'roost in shelter', light(clock) < 0.2],
      ['Hawk', 'alarm call, hide', hawk.phase !== 'off' && hawk.phase !== 'leave'],
      ['Cold', 'feed more, fluff up', st.temp < 5],
      ['Little food', 'forage longer', st.food < 30],
    ];
    const act = cues.filter((c) => c[2]);
    const qx = P ? x + 16 : bx + bw + 24;
    const qy = P ? y + 2 * cr + 70 : y + 22;
    const qw = P ? w - 32 : x + w - 16 - qx;
    text('Cue → response', qx, qy, 12.5, pal['sim-text'], 'left', 700);
    if (!act.length) text('No strong cues: forage and rest', qx, qy + 22, 11.5, pal['text-muted'], 'left', 600);
    act.slice(0, P ? 6 : 4).forEach(([a, b], i) => {
      const yy = qy + 22 + i * (P ? 24 : 21);
      text(a, qx, yy, 11.5, pal['sim-text'], 'left', 700);
      ctx.font = fs(11.5, 700);
      const aw = ctx.measureText(a).width;
      text(`→ ${b}`, qx + aw + 6 / cur, yy, 11.5, pal['text-muted'], 'left', 600);
    });
    rect(qx, qy - 16, qw, 110, 'Environmental cues', () => 'A cue is a change in the environment that triggers a behaviour. Some cues act immediately (a hawk, darkness); others, like day length, act as a calendar for seasonal behaviour.');
  }

  /* ======================= Rhythms drawing ======================= */
  function drawCritter(id: RhythmId, x: number, y: number, s: number, awake: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const fur = id === 'diurnal' ? '#b0703c' : id === 'nocturnal' ? '#9b9389' : '#a68a6d';
    ctx.fillStyle = fur;
    if (id === 'diurnal') {
      ctx.beginPath();
      ctx.ellipse(-30, -18, 18, 34, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (id === 'nocturnal') poly([[-26, 6], [-50, 0], [-62, -10]], fur, 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(24, -10, 13, 0, Math.PI * 2);
    ctx.fill();
    if (id === 'crepuscular') {
      ctx.beginPath();
      ctx.ellipse(18, -36, 5, 18, -0.2, 0, Math.PI * 2);
      ctx.ellipse(26, -36, 5, 18, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(18, -22, id === 'nocturnal' ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#111';
    ctx.fillStyle = '#111';
    ctx.lineWidth = 2;
    if (awake) {
      ctx.beginPath();
      ctx.arc(29, -12, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(25, -12);
      ctx.lineTo(32, -12);
      ctx.stroke();
    }
    ctx.restore();
    if (!awake) text('z z', x + 40 * s, y - 40 * s, 15, pal['text-muted'], 'left', 700);
  }

  function drawDial(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    const P = portrait();
    const R = Math.min(P ? h / 2 - 40 : w / 2 - 44, P ? 104 : 114);
    const cx = P ? x + 26 + R : x + w / 2;
    const cy = P ? y + h / 2 : y + 46 + R;
    const ang = (hr: number) => -Math.PI / 2 + (hr / 24) * Math.PI * 2;
    const h0 = wrap24(rT);
    // light and dark
    ctx.fillStyle = '#1d2a4f';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    if (!st.dd) {
      ctx.fillStyle = withAlpha('#ffd43b', 0.85);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, ang(lightsOn()), ang(lightsOn() + st.rday));
      ctx.closePath();
      ctx.fill();
    }
    // activity ring
    ctx.lineWidth = 10;
    for (let b = 0; b < 96; b++) {
      const hh = b / 4;
      if (!activeAt(st.rhythm, hh + 0.125, P_, Dint())) continue;
      ctx.strokeStyle = RCOL[st.rhythm];
      ctx.beginPath();
      ctx.arc(cx, cy, R + 9, ang(hh), ang(hh + 0.25) + 0.01);
      ctx.stroke();
    }
    ctx.fillStyle = pal['sim-bg'];
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // hours
    ctx.font = fs(11, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    for (const hr of [0, 6, 12, 18]) {
      ctx.fillStyle = isLight(hr) ? '#3b2f00' : '#dbe4ff';
      ctx.fillText(String(hr).padStart(2, '0'), cx + Math.cos(ang(hr)) * (R - 14), cy + Math.sin(ang(hr)) * (R - 14) + 4);
    }
    ctx.textAlign = 'left';
    // internal dawn marker
    const ia = ang(P_);
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ia) * (R * 0.58), cy + Math.sin(ia) * (R * 0.58));
    ctx.lineTo(cx + Math.cos(ia + 0.12) * (R * 0.78), cy + Math.sin(ia + 0.12) * (R * 0.78));
    ctx.lineTo(cx + Math.cos(ia - 0.12) * (R * 0.78), cy + Math.sin(ia - 0.12) * (R * 0.78));
    ctx.closePath();
    ctx.fill();
    // hand
    poly([[cx, cy], [cx + Math.cos(ang(h0)) * (R + 2), cy + Math.sin(ang(h0)) * (R + 2)]], pal.danger, 3);
    const awake = activeAt(st.rhythm, h0, P_, Dint());
    drawCritter(st.rhythm, cx - 6, cy + 8, R / 120, awake);
    // legend
    const lx = P ? cx + R + 40 : x + 18;
    let ly = P ? y + 78 : cy + R + 46;
    const leg: [string, string][] = [
      ['#ffd43b', 'Light'],
      ['#1d2a4f', 'Dark'],
      [RCOL[st.rhythm], 'Active'],
      [pal.accent, 'Internal “dawn”'],
    ];
    if (P)
      for (const [c, t] of leg) {
        ctx.fillStyle = c;
        ctx.fillRect(lx, ly - 10, 12, 12);
        text(t, lx + 18, ly, 11.5, pal['text-muted'], 'left', 600);
        ly += 24;
      }
    if (!P) {
      leg.forEach(([c, t], i) => {
        const xx = x + 18 + (i % 2) * (w / 2 - 10);
        const yy = cy + R + 40 + Math.floor(i / 2) * 20;
        ctx.fillStyle = c;
        ctx.fillRect(xx, yy - 10, 12, 12);
        text(t, xx + 18, yy, 11, pal['text-muted'], 'left', 600);
      });
    } else {
      text(`${RHYTHM[st.rhythm].animal}: ${awake ? 'active' : 'asleep'}`, lx, ly + 14, 13, pal['sim-text'], 'left', 700);
      text(`Day ${Math.floor(rT / 24) + 1}, ${hhmm(h0)}`, lx, ly + 36, 12, pal['text-muted'], 'left', 600);
    }
    if (!P) text(`${RHYTHM[st.rhythm].animal}: ${awake ? 'active' : 'asleep'}  ·  Day ${Math.floor(rT / 24) + 1}, ${hhmm(h0)}`, x + w / 2, y + 20, 13, pal['sim-text'], 'center', 700);
    rect(cx - R - 20, cy - R - 20, 2 * R + 40, 2 * R + 40, 'Daily clock', () => 'The yellow part of the dial is daylight. The coloured ring shows when the animal is active. The triangle marks the animal’s internal “dawn”: its body clock’s idea of when the day begins.');
  }

  function drawActogram(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Actogram: one row per day', x + 14, y + 22, 13, pal['sim-text'], 'left', 700);
    const gx = x + 50;
    const gy = y + 40;
    const gw = w - 66;
    const gh = h - 74;
    const rh = gh / DAYS_SHOWN;
    rows.forEach((row, i) => {
      const ry = gy + i * rh;
      for (let b = 0; b < 96; b++) {
        const bx = gx + (b / 96) * gw;
        ctx.fillStyle = row.light[b] ? withAlpha('#ffd43b', 0.45) : withAlpha('#1d2a4f', 0.45);
        ctx.fillRect(bx, ry, gw / 96 + 0.3, rh - 1);
        if (row.act[b]) {
          ctx.fillStyle = RCOL[st.rhythm];
          ctx.fillRect(bx, ry + rh * 0.15, gw / 96 + 0.3, rh * 0.7 - 1);
        }
      }
      text(String(row.day + 1), gx - 8, ry + rh * 0.7, 10, pal['text-faint'], 'right', 600);
    });
    // now marker
    if (rows.length) {
      const ry = gy + (rows.length - 1) * rh;
      const nx = gx + (wrap24(rT) / 24) * gw;
      ctx.fillStyle = pal.danger;
      ctx.fillRect(nx - 1, ry - 2, 2, rh + 3);
    }
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    for (let hr = 0; hr <= 24; hr += 6) ctx.fillText(String(hr).padStart(2, '0'), gx + (hr / 24) * gw, gy + gh + 16);
    ctx.textAlign = 'left';
    text('Hour of the day', gx + gw / 2, y + h - 6, 10.5, pal['text-faint']);
    text('Day', x + 14, gy + 10, 10.5, pal['text-faint'], 'left');
    rect(x, y, w, h, 'Actogram', () => 'Scientists record animal activity like this, one row per day. Activity that lines up in a vertical band means the rhythm is locked (entrained) to the light. In constant darkness the band slopes: the internal clock runs a little faster or slower than 24 hours.');
  }

  function drawProfiles(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    text('Typical activity over 24 hours', x + 14, y + 22, 13, pal['sim-text'], 'left', 700);
    const gx = x + (portrait() ? 175 : 120);
    const gw = x + w - 16 - gx;
    const gy = y + 34;
    const gh = h - 58;
    const lo = wrap24(12 - st.rday / 2);
    for (let b = 0; b < 96; b++) {
      const hh = b / 4;
      const lit = wrap24(hh - lo) < st.rday;
      ctx.fillStyle = lit ? withAlpha('#ffd43b', 0.22) : withAlpha('#1d2a4f', 0.3);
      ctx.fillRect(gx + (b / 96) * gw, gy, gw / 96 + 0.3, gh);
    }
    const ids: RhythmId[] = ['diurnal', 'nocturnal', 'crepuscular'];
    const lh = gh / 3;
    ids.forEach((id, i) => {
      const sel = id === st.rhythm;
      const ry = gy + i * lh;
      text(RHYTHM[id].name, x + 14, ry + lh / 2 + 4, 12, sel ? pal['sim-text'] : pal['text-muted'], 'left', sel ? 800 : 600);
      ctx.fillStyle = withAlpha(RCOL[id], sel ? 0.95 : 0.45);
      for (let b = 0; b < 96; b++) if (activeAt(id, b / 4 + 0.125, lo, st.rday)) ctx.fillRect(gx + (b / 96) * gw, ry + lh * 0.2, gw / 96 + 0.3, lh * 0.6);
    });
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    for (let hr = 0; hr <= 24; hr += 6) ctx.fillText(String(hr).padStart(2, '0'), gx + (hr / 24) * gw, gy + gh + 14);
    ctx.textAlign = 'left';
    rect(x, y, w, h, 'Diurnal, nocturnal, crepuscular', () => `Diurnal animals (${RHYTHM.diurnal.examples}) are active by day; nocturnal animals (${RHYTHM.nocturnal.examples}) at night; crepuscular animals (${RHYTHM.crepuscular.examples}) at dawn and dusk.`);
  }

  /* ======================= Learning drawing ======================= */
  function drawGoose() {
    // ground and nest
    ctx.fillStyle = withAlpha('#6aa84f', 0.35);
    ctx.fillRect(0, 360, 600, 60);
    ctx.fillStyle = '#8a6a3c';
    ctx.beginPath();
    ctx.ellipse(NEST[0], NEST[1], 100, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#5a4020', 0.7);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(NEST[0] - 95 + i * 14, NEST[1] + 10);
      ctx.lineTo(NEST[0] - 85 + i * 14, NEST[1] - 12);
      ctx.stroke();
    }
    // goose body
    const head = instHead();
    ctx.fillStyle = '#9a8f80';
    ctx.beginPath();
    ctx.ellipse(195, 300, 90, 44, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d7266';
    ctx.beginPath();
    ctx.ellipse(175, 292, 62, 26, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a8f80';
    ctx.beginPath();
    ctx.moveTo(108, 292);
    ctx.lineTo(82, 280);
    ctx.lineTo(96, 306);
    ctx.closePath();
    ctx.fill();
    // neck
    ctx.strokeStyle = '#8c8173';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(262, 284);
    ctx.quadraticCurveTo(290 + (head[0] - 300) * 0.3, 240, head[0] - 10, head[1] + 6);
    ctx.stroke();
    ctx.fillStyle = '#8c8173';
    ctx.beginPath();
    ctx.ellipse(head[0], head[1], 18, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f08c00';
    ctx.beginPath();
    ctx.moveTo(head[0] + 14, head[1] - 4);
    ctx.lineTo(head[0] + 34, head[1] + 4);
    ctx.lineTo(head[0] + 14, head[1] + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(head[0] + 6, head[1] - 4, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // object
    const showObj = inst.phase !== 'idle' && inst.phase !== 'settle' && !inst.removed;
    if (showObj) {
      const [ox, oy] = instObj();
      if (inst.obj === 'egg') {
        ctx.fillStyle = '#f4efe2';
        ctx.strokeStyle = '#b9b09a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(ox, oy, 15, 11, inst.phase === 'roll' ? inst.t * 3 : 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#4dabf7';
        ctx.beginPath();
        ctx.arc(ox, oy - 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ox, oy - 2, 9, inst.t * 3, inst.t * 3 + 2);
        ctx.stroke();
      }
    }
    if (inst.removed && inst.phase === 'roll') {
      text('Object removed… the movement continues', 300, 60, 14, pal.danger, 'center', 800);
    } else if (inst.phase === 'notice') text('The goose sees the object', 300, 60, 14, pal.warning, 'center', 800);
    else if (inst.phase === 'reach' || inst.phase === 'roll') text('Stretches its neck and rolls it back with its bill', 300, 60, 14, pal.success, 'center', 800);
    else if (inst.phase === 'idle') text('Press “Place object outside the nest”', 300, 60, 13, pal['text-muted'], 'center', 700);
    rect(90, 240, 220, 120, 'Greylag goose', () => 'A nesting greylag goose. Egg-rolling is innate: every goose does it in the same way, the first time, without learning. It was described by Konrad Lorenz and Niko Tinbergen in the 1930s.');
    rect(380, 310, 120, 60, 'Sign stimulus', () => 'An egg-shaped object just outside the nest is the sign stimulus that triggers the behaviour. Geese will also roll back other rounded objects, such as balls.');
  }

  function drawSnail() {
    ctx.fillStyle = withAlpha('#6aa84f', 0.35);
    ctx.fillRect(0, 360, 600, 60);
    // response: extension of the body (1 = fully out)
    let ext = 1;
    const an = hab.anim;
    if (an) {
      const a = simT - an.t0;
      const hold = 0.3 + 2.6 * an.s;
      const depth = an.s;
      if (a < 0.25) ext = 1 - depth * (a / 0.25);
      else if (a < 0.25 + hold) ext = 1 - depth;
      else if (a < 1.4 + hold) ext = 1 - depth * (1 - ease((a - 0.25 - hold) / 1.15));
      // shadow passing
      if (an.kind === 'shadow' && a < 1.6) {
        const sx = lerp(-80, 680, a / 1.6);
        ctx.fillStyle = withAlpha('#000000', 0.25);
        ctx.beginPath();
        ctx.ellipse(sx, 330, 120, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        text('Bird shadow', clamp(sx, 60, 540), 80, 13, pal['text-muted'], 'center', 700);
      }
      if (an.kind === 'touch' && a < 0.6) {
        const d = Math.sin(clamp(a / 0.3, 0, 1) * Math.PI) * 20;
        poly([[430 + d, 170 + d], [372 + d * 0.3, 232 + d * 0.3]], pal['text-muted'], 7);
      }
    }
    if (!an || simT - an.t0 >= 0.6) poly([[470, 130], [420, 180]], withAlpha(pal['text-muted'], 0.6), 7);
    // foot and head
    const footL = 300 - 150 * ext;
    ctx.fillStyle = '#c9b29a';
    ctx.beginPath();
    ctx.roundRect(footL, 330, 380 - footL, 30, 15);
    ctx.fill();
    if (ext > 0.15) {
      const tl = 40 * ext;
      const hx = footL + 14;
      poly([[hx, 336], [hx - 10, 336 - tl]], '#b09779', 4);
      poly([[hx + 10, 336], [hx + 6, 336 - tl * 1.05]], '#b09779', 4);
      ctx.fillStyle = '#3b2a1a';
      ctx.beginPath();
      ctx.arc(hx - 10, 336 - tl, 3.5, 0, Math.PI * 2);
      ctx.arc(hx + 6, 336 - tl * 1.05, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // shell
    ctx.fillStyle = '#b5651d';
    ctx.beginPath();
    ctx.arc(330, 290, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a3f10';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.1) {
      const r = 52 - a * 3.1;
      const px = 330 + Math.cos(a) * r;
      const py = 290 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    const out = ext > 0.9 ? 'Out of its shell' : ext < 0.3 ? 'Withdrawn into its shell' : 'Partly withdrawn';
    text(out, 300, 60, 14, ext > 0.9 ? pal.success : pal.warning, 'center', 800);
    rect(250, 220, 200, 150, 'Garden snail', () => 'Pulling back into the shell protects the snail. But responding to every harmless touch wastes time and energy, so the response to a repeated, harmless stimulus fades: habituation.');
  }

  function drawCaterpillar(x: number, y: number, kind: 'plain' | 'striped', alpha = 1) {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = kind === 'plain' ? (i % 2 ? '#7cb342' : '#8bc34a') : i % 2 ? '#222' : '#fcc419';
      ctx.beginPath();
      ctx.arc(x + i * 8, y + Math.sin(simT * 6 + i) * 1.2, i === 6 ? 7 : 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawTrial() {
    // branch
    poly([[20, 300], [580, 286]], '#7a5230', 12);
    poly([[480, 289], [540, 250]], '#7a5230', 6);
    ctx.fillStyle = '#4c9a4c';
    for (const [lx, ly] of [[120, 286], [260, 282], [520, 246], [560, 270]] as Pt[]) {
      ctx.beginPath();
      ctx.ellipse(lx, ly, 22, 9, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const c = tri.cur;
    const a = c ? simT - c.t0 : -1;
    // bird position
    let bx = 170;
    let by = 268;
    let shake = 0;
    if (c && c.attack) {
      if (a > 0.6 && a < 1.0) bx = lerp(170, 368, ease((a - 0.6) / 0.4));
      else if (a >= 1.0 && a < 2.0) bx = 368;
      else if (a >= 2.0) bx = lerp(368, 170, ease((a - 2.0) / 0.5));
      if (c.kind === 'striped' && a > 1.2 && a < 2.0) shake = Math.sin(a * 40) * 0.25;
    }
    // prey
    if (c) {
      const gone = c.attack && c.kind === 'plain' && a > 1.25;
      const dropped = c.attack && c.kind === 'striped' && a > 1.4;
      if (!gone) {
        const py = dropped ? 280 + Math.min(120, (a - 1.4) * 260) : 280;
        drawCaterpillar(400, py, c.kind, a < 0.3 ? a / 0.3 : 1);
      }
    }
    // young bird (a fledgling jay-like bird)
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(shake);
    ctx.scale(2.2, 2.2);
    ctx.fillStyle = '#8d7b6a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -7, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b5bdb';
    ctx.beginPath();
    ctx.ellipse(-3, -1, 7, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(15, -8);
    ctx.lineTo(22, -6);
    ctx.lineTo(15, -4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, -1);
    ctx.lineTo(-20, -4);
    ctx.lineTo(-20, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(12, -8, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // speech bubble
    if (c && a > 1.1) {
      const msg = !c.attack ? 'Ignored' : c.kind === 'striped' ? 'Yuck!' : 'Tasty!';
      const col = !c.attack ? pal['text-muted'] : c.kind === 'striped' ? pal.danger : pal.success;
      text(msg, bx + 10, by - 50, 16, col, 'center', 800);
    } else if (!c) text('Press Start, or offer a caterpillar', 300, 60, 13, pal['text-muted'], 'center', 700);
    rect(120, 220, 120, 90, 'Young bird', () => 'An inexperienced young bird does not know which prey are safe to eat. It learns from the results of its own actions: trial and error.');
    rect(380, 260, 80, 50, 'Caterpillars', () => 'The striped yellow and black caterpillar tastes bad. Bright warning colours (aposematism) are easy to remember, so predators learn to avoid them after only a few tries.');
  }

  function legend(items: [string, string][], x: number, y: number) {
    let xx = x;
    for (const [c, t] of items) {
      ctx.fillStyle = c;
      ctx.fillRect(xx, y - 10 / cur, 11 / cur, 11 / cur);
      text(t, xx + 16 / cur, y, 11.5, pal['text-muted'], 'left', 600);
      ctx.font = fs(11.5, 600);
      xx += 16 / cur + ctx.measureText(t).width + 16 / cur;
    }
  }
  function drawLearnPanel(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    if (st.exp === 'instinct') {
      text('Is it an instinct?', x + 16, y + 26, 14, pal['sim-text'], 'left', 700);
      const items: [string, boolean][] = [
        ['Done correctly the first time, without learning', true],
        ['Performed the same way by every goose', true],
        ['Triggered by a sign stimulus: a rounded object near the nest', inst.rolls > 0 || inst.phase !== 'idle'],
        ['Once started, completed even if the object is removed', inst.removedRolls > 0],
      ];
      let yy = y + 58;
      ctx.font = fs(12.5, 600);
      for (const [t, ok] of items) {
        text(ok ? '✓' : '○', x + 22, yy, 15, ok ? pal.success : pal['text-faint'], 'center', 800);
        ctx.font = fs(12.5, 600);
        ctx.fillStyle = ok ? pal['sim-text'] : pal['text-muted'];
        yy = wrap(t, x + 40, yy, w - 56, 17 / cur) + 12 / cur;
      }
      ctx.font = fs(12, 500);
      ctx.fillStyle = pal['text-muted'];
      wrap('Instincts are inherited: they are coded in the genes and shaped by natural selection. They suit situations where there is no chance to learn, such as escaping a predator or caring for eggs.', x + 16, yy + 10 / cur, w - 32, 16 / cur);
      rect(x, y, w, h, 'Instinct (innate behaviour)', () => 'Innate behaviour is inherited, not learned. A fixed action pattern is a sequence that, once triggered, runs to completion.');
    } else if (st.exp === 'habituation') {
      text('Response to each stimulus', x + 16, y + 26, 14, pal['sim-text'], 'left', 700);
      const gx = x + 46;
      const gy = y + 46;
      const gw = w - 62;
      const gh = y + h - 46 / cur - gy;
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1 / cur;
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.font = fs(10.5, 600);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'right';
      for (const v of [0, 50, 100]) ctx.fillText(`${v}%`, gx - 6, gy + gh - (v / 100) * gh + 4);
      ctx.textAlign = 'left';
      const n = 16;
      const bw = gw / n;
      hab.events.forEach((ev, i) => {
        const bx = gx + i * bw;
        if (ev.kind === 'rest') {
          ctx.setLineDash([4, 4]);
          poly([[bx + bw / 2, gy], [bx + bw / 2, gy + gh]], pal.accent, 1.5);
          ctx.setLineDash([]);
          text('rest', bx + bw / 2, gy + 14, 10, pal.accent, 'center', 700);
          return;
        }
        ctx.fillStyle = ev.kind === 'touch' ? pal.warning : pal['accent-2'];
        ctx.fillRect(bx + bw * 0.15, gy + gh - ev.s * gh, bw * 0.7, ev.s * gh);
      });
      legend([[pal.warning, 'Touch'], [pal['accent-2'], 'Bird shadow']], x + 16, y + h - 26 / cur);
      text('Each bar: how strongly the snail withdrew', x + 16, y + h - 8 / cur, 10.5, pal['text-faint'], 'left', 600);
      rect(x, y, w, h, 'Habituation graph', () => 'Each repeated touch gives a weaker response. After a rest the response partly recovers (spontaneous recovery). A different stimulus, the shadow of a bird, still gives a full response, so the snail is not just tired.');
    } else {
      text('Chance of attacking each prey', x + 16, y + 26, 14, pal['sim-text'], 'left', 700);
      const gx = x + 46;
      const gy = y + 46;
      const gw = w - 62;
      const gh = y + h - 46 / cur - gy;
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1 / cur;
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.font = fs(10.5, 600);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'right';
      for (const v of [0, 50, 100]) ctx.fillText(`${v}%`, gx - 6, gy + gh - (v / 100) * gh + 4);
      ctx.textAlign = 'left';
      const n = Math.max(10, tri.hist.length - 1);
      const px = (i: number) => gx + (i / n) * gw;
      const py = (p: number) => gy + gh - p * gh;
      const line = (key: 'pS' | 'pP', col: string) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5 / cur;
        ctx.beginPath();
        tri.hist.forEach((hh, i) => (i ? ctx.lineTo(px(i), py(hh[key])) : ctx.moveTo(px(i), py(hh[key]))));
        ctx.stroke();
      };
      line('pP', '#40a845');
      line('pS', '#e0a800');
      legend([['#40a845', 'Plain'], ['#e0a800', 'Striped (bad taste)']], x + 16, y + h - 26 / cur);
      text('Number of caterpillars offered →', x + 16, y + h - 8 / cur, 10.5, pal['text-faint'], 'left', 600);
      rect(x, y, w, h, 'Learning curve', () => 'After each bad-tasting striped caterpillar, the bird is much less likely to attack another. Plain caterpillars keep being eaten. The bird has learned to link a colour pattern with a bad experience: associative learning.');
    }
  }

  function drawLog(x: number, y: number, w: number, h: number) {
    panel(x, y, w, h);
    const lines = st.exp === 'instinct' ? inst.log : st.exp === 'trial' ? tri.log : [];
    ctx.font = fs(13, 700);
    ctx.fillStyle = pal['sim-text'];
    let yy = wrap(EXP[st.exp].title, x + 14, y + 8 + 14 / cur, w - 28, 17 / cur) + 4 / cur;
    ctx.font = fs(11.5, 600);
    ctx.fillStyle = pal['text-muted'];
    if (st.exp === 'habituation') {
      const pct = Math.round(Math.max(0.05, 1 - hab.h) * 100);
      wrap(`Taps so far: ${hab.taps}. The next tap would cause a response of about ${pct}% of the first. Press “Rest” to let the snail recover, or try the bird shadow.`, x + 14, yy, w - 28, 16 / cur);
      return;
    }
    if (!lines.length) {
      wrap(EXP[st.exp].text, x + 14, yy, w - 28, 16 / cur);
      return;
    }
    for (const l of lines.slice(0, portrait() ? 4 : 3)) yy = wrap(l, x + 14, yy, w - 28, 16 / cur);
  }

  /* ---------- Render ---------- */
  let P_ = 0; // internal dawn used for drawing
  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    K = k;
    cur = k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    P_ = P;
    const isP = portrait();
    if (st.view === 'habitat') {
      if (isP) {
        enter(0, 50, 0.68);
        drawHabitat();
        leave();
        drawHabitatPanel(10, 360, 660, 350);
      } else {
        enter(0, 0, 1);
        drawHabitat();
        leave();
        drawHabitatPanel(10, 450, 980, 144);
      }
    } else if (st.view === 'rhythms') {
      if (isP) {
        drawDial(10, 50, 660, 300);
        drawActogram(10, 360, 660, 400);
        drawProfiles(10, 770, 660, 220);
      } else {
        drawDial(10, 60, 330, 358);
        drawActogram(350, 60, 640, 358);
        drawProfiles(10, 426, 980, 166);
      }
    } else {
      if (isP) {
        enter(10, 40, 1.1);
        drawLearnScene();
        leave();
        drawLearnPanel(10, 516, 660, 262);
        drawLog(10, 786, 660, 206);
      } else {
        enter(10, 10, 1);
        drawLearnScene();
        leave();
        drawLearnPanel(626, 62, 364, 528);
        drawLog(10, 440, 600, 150);
      }
    }
    ctx.restore();
    updateUi();
  }
  function drawLearnScene() {
    ctx.fillStyle = withAlpha(pal['text-faint'], 0.06);
    ctx.beginPath();
    ctx.roundRect(0, 0, 600, 420, 12);
    ctx.fill();
    if (st.exp === 'instinct') drawGoose();
    else if (st.exp === 'habituation') drawSnail();
    else drawTrial();
  }

  /* ---------- Readouts and text ---------- */
  let lastNote = '';
  function updateUi() {
    const r = (name: string, label: string, t: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, t, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    let note = '';
    if (st.view === 'habitat') {
      const L = light(clock);
      const here = birds.filter((b) => b.state !== 'away').length;
      const breed = breeding();
      const mig = migrateCue();
      const season = breed ? 'Long days: breeding season' : st.day <= 10.5 ? 'Short days: time to migrate' : 'Medium days: no breeding';
      r('r1', 'Time of day', `${hhmm(clock)} (${L > 0.5 ? 'day' : 'night'})`);
      r('r2', 'Day-length cue', season);
      r('r3', 'Birds here', here ? `${here} of ${birds.length}${caught ? `, ${caught} caught` : ''}` : 'All migrated south', here ? null : 'warn');
      const tot = CATS.reduce((s, c) => s + budget[c], 0) || 1;
      const top = [...CATS].sort((a, b) => budget[b] - budget[a])[0];
      r('r4', 'Most time spent', `${CAT_NAME[top]} (${Math.round((budget[top] / tot) * 100)}%)`);
      const extra = `${st.temp < 5 ? ' It is cold, so the birds use more energy keeping warm and must feed more.' : ''}${st.food < 30 ? ' Food is scarce, so they spend much of their time searching for it.' : ''}`;
      if (!here && birds.length) note = st.day <= 10.5 ? `Short days (${st.day} h) are the birds’ cue that winter is coming, so they have migrated south, where food is easier to find. Day length is a reliable calendar, so many birds migrate even when it is still warm. Increase the daylight hours to bring spring: they will return.` : 'Freezing weather and very little food have driven the birds to leave early. Raise the temperature or the food to bring them back.';
      else if (mig) note = 'Migration: the cue has been detected and the flock is flying south.';
      else if (hawk.phase !== 'off' && hawk.phase !== 'leave') note = st.alarm ? 'A hawk! The first bird to see it gave an alarm call, and every bird that heard it flew into the bushes. Alarm calls are communication: one bird’s warning protects the whole flock.' : 'A hawk, and alarm calls are switched off. Each bird must spot the hawk itself, so birds further away stay in the open and are more likely to be caught.';
      else if (simT - lastCatch < 4) note = 'The hawk caught a bird that was still in the open. Predators remove the slowest or least alert individuals.';
      else if (L < 0.2) note = 'Night. These songbirds are diurnal, so they roost in the bushes, saving energy and hiding from predators. The hawk does not hunt at night.';
      else if (breed) note = `Long days (${st.day} h) trigger breeding behaviour. Two males sing from perches to claim territories and chase away other males. Song is communication: it warns rivals and attracts mates.${extra}`;
      else note = `The days are not long enough for breeding, so the birds spend their time foraging and resting in a loose flock.${extra}`;
      sim.setBadge(`${hhmm(clock)} · ${breed ? 'breeding season' : mig ? 'migration' : 'non-breeding'}`);
      canvas.setAttribute('aria-label', `Songbird habitat at ${hhmm(clock)}. ${here} birds present. ${season}.`);
    } else if (st.view === 'rhythms') {
      const R = RHYTHM[st.rhythm];
      const h0 = wrap24(rT);
      const awake = activeAt(st.rhythm, h0, P, Dint());
      r('r1', 'Time', `Day ${Math.floor(rT / 24) + 1}, ${hhmm(h0)}`);
      r('r2', 'Light', st.dd ? 'Constant darkness' : `On ${hhmm(lightsOn())} to ${hhmm(lightsOn() + st.rday)} (${st.rday} h)`);
      r('r3', 'Internal clock period', `about ${R.tau} h`);
      const diff = wrapPM(P - lightsOn());
      r('r4', st.dd ? 'Rhythm' : 'Internal dawn vs real dawn', st.dd ? 'Free-running (no light cue)' : `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)} h`, !st.dd && Math.abs(diff) > 1.6 ? 'warn' : null);
      note = st.dd
        ? `Constant darkness: there is no light cue, but the ${R.animal.toLowerCase()} keeps a daily rhythm, so it must have an internal clock. Its clock runs about ${R.tau} h per cycle, so activity starts about ${Math.round(Math.abs(R.tau - 24) * 60)} minutes ${R.tau < 24 ? 'earlier' : 'later'} each day. Watch the actogram band slope.`
        : simT - jetT < 25 && Math.abs(diff) > 0.8
          ? 'The light schedule has moved 6 hours, like flying across six time zones. The body clock can shift only about 1–1.5 hours a day, so for several days the animal is active at the wrong times: jet lag.'
          : `${R.name}: ${R.text} The internal clock runs about ${R.tau} h, but daylight resets it every day, so it stays in step with the 24-hour day (entrainment). ${awake ? `The ${R.animal.toLowerCase()} is active now.` : `The ${R.animal.toLowerCase()} is asleep now.`}`;
      sim.setBadge(`${R.name} · ${awake ? 'active' : 'asleep'}`);
      canvas.setAttribute('aria-label', `${R.name} ${R.animal.toLowerCase()}, day ${Math.floor(rT / 24) + 1}, ${hhmm(h0)}, ${awake ? 'active' : 'asleep'}.`);
    } else {
      if (st.exp === 'instinct') {
        r('r1', 'Behaviour type', 'Innate: a fixed action pattern');
        r('r2', 'Trigger (sign stimulus)', 'A rounded object near the nest');
        r('r3', 'Rolls completed', String(inst.rolls));
        r('r4', 'Completed after the object was removed', String(inst.removedRolls), inst.removedRolls ? 'ok' : null);
        note = inst.removed && inst.phase !== 'idle' ? 'The object has gone, but the goose keeps going: once the egg-rolling pattern starts, it runs to completion. The behaviour is not guided by learning or by checking the result.' : EXP.instinct.text;
        sim.setBadge('Instinct');
      } else if (st.exp === 'habituation') {
        const last = [...hab.events].reverse().find((e) => e.kind !== 'rest');
        r('r1', 'Taps', String(hab.taps));
        r('r2', 'Last response', last ? `${Math.round(last.s * 100)}% (${last.kind === 'touch' ? 'touch' : 'shadow'})` : '—');
        r('r3', 'Next tap would give', `about ${Math.round(Math.max(0.05, 1 - hab.h) * 100)}%`);
        r('r4', 'Type of learning', 'Habituation');
        note = last && last.kind === 'shadow' ? 'The shadow of a bird, a new and possibly dangerous stimulus, still makes the snail withdraw fully. Habituation is specific to the harmless stimulus that was repeated.' : hab.taps >= 4 ? 'The snail has learned that this touch is harmless: each response is weaker and shorter. This is habituation, the simplest kind of learning. Try resting, or the bird shadow.' : EXP.habituation.text;
        sim.setBadge('Habituation');
      } else {
        r('r1', 'Caterpillars offered', String(tri.offers));
        r('r2', 'Chance of attacking striped', `${Math.round(tri.pS * 100)}%`, tri.pS < 0.3 ? 'ok' : null);
        r('r3', 'Chance of attacking plain', `${Math.round(tri.pP * 100)}%`);
        r('r4', 'Type of learning', 'Trial and error (associative)');
        note = tri.pS < 0.3 ? 'The bird has learned to avoid the striped caterpillars after a bad experience, but still eats plain ones. Learning by trial and error lets animals adjust to their own surroundings.' : EXP.trial.text;
        sim.setBadge('Trial and error');
      }
      canvas.setAttribute('aria-label', EXP[st.exp].title);
    }
    if (note !== lastNote) noteEl.textContent = lastNote = note;
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const showFor = () => {
    root.style.setProperty('--stage-aspect-mobile', st.view === 'habitat' ? '680 / 720' : '680 / 1000');
    ui.showWhen('[data-only="habitat"]', st.view === 'habitat');
    ui.showWhen('[data-only="rhythms"]', st.view === 'rhythms');
    ui.showWhen('[data-only="learning"]', st.view === 'learning');
    ui.showWhen('[data-only="instinct"]', st.exp === 'instinct');
    ui.showWhen('[data-only="habituation"]', st.exp === 'habituation');
    ui.showWhen('[data-only="trial"]', st.exp === 'trial');
  };
  const viewCtl = ui.choice<View>('bh-view', (v) => {
    st.view = v;
    showFor();
    sim.hideTooltip();
    sim.play();
    updateUi();
    sim.requestRender();
  });
  const tempCtl = ui.range('bh-temp', (v) => `${v} °C`, (v) => ((st.temp = v), updateUi()));
  const dayCtl = ui.range('bh-day', (v) => `${v} h`, (v) => ((st.day = v), updateUi()));
  const foodCtl = ui.range('bh-food', (v) => `${v}%`, (v) => ((st.food = v), updateUi()));
  const predCtl = ui.toggle('bh-predator', (v) => {
    st.predator = v;
    hawk.next = 1;
    updateUi();
  });
  const alarmCtl = ui.toggle('bh-alarm', (v) => (st.alarm = v));
  const terrCtl = ui.toggle('bh-terr', (v) => ((st.terr = v), sim.requestRender()));
  const rhythmCtl = ui.choice<RhythmId>('bh-rhythm', (v) => {
    st.rhythm = v;
    rows = [];
    lastBin = -1;
    P = lightsOn();
    updateUi();
    sim.requestRender();
  });
  const rdayCtl = ui.range('bh-rday', (v) => `${v} h`, (v) => ((st.rday = v), updateUi(), sim.requestRender()));
  const ddCtl = ui.toggle('bh-dd', (v) => {
    st.dd = v;
    if (!v) prevLight = isLight(wrap24(rT));
    updateUi();
    sim.requestRender();
  });
  root.querySelector('[data-jetlag]')?.addEventListener('click', () => {
    shift = wrap24(shift + 6);
    jetT = simT;
    if (st.dd) ddCtl.set(false);
    if (!sim.running) sim.play();
    updateUi();
  });
  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    rows = [];
    lastBin = -1;
    sim.requestRender();
  });
  const expCtl = ui.choice<ExpId>('bh-exp', (v) => {
    st.exp = v;
    showFor();
    sim.hideTooltip();
    updateUi();
    sim.requestRender();
  });
  const objCtl = ui.choice<'egg' | 'ball'>('bh-obj', (v) => (st.obj = v));
  root.querySelector('[data-place]')?.addEventListener('click', placeObject);
  root.querySelector('[data-remove]')?.addEventListener('click', removeObject);
  root.querySelector('[data-tap]')?.addEventListener('click', () => stimulateSnail('touch'));
  root.querySelector('[data-shadow]')?.addEventListener('click', () => stimulateSnail('shadow'));
  root.querySelector('[data-rest]')?.addEventListener('click', restSnail);
  root.querySelector('[data-plain]')?.addEventListener('click', () => offer('plain'));
  root.querySelector('[data-striped]')?.addEventListener('click', () => offer('striped'));
  root.querySelector('[data-newbird]')?.addEventListener('click', () => {
    Object.assign(tri, { pS: 0.9, pP: 0.9, offers: 0, hist: [{ pS: 0.9, pP: 0.9 }], cur: null, log: [], auto: 0 });
    updateUi();
    sim.requestRender();
  });

  canvas.addEventListener('click', (e) => {
    const rc = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rc.left - ox) / k;
    const y = (e.clientY - rc.top - oy) / k;
    let a: Area | undefined;
    for (let i = areas.length - 1; i >= 0; i--)
      if (areas[i].test(x, y)) {
        a = areas[i];
        break;
      }
    if (a) sim.showTooltip(e.clientX - rc.left, e.clientY - rc.top, a.title, a.text());
    else sim.hideTooltip();
  });

  const sim = createSimController(root, {
    step,
    render,
    autoplay: true,
    reset() {
      Object.assign(st, DEF);
      viewCtl.set(DEF.view, false);
      tempCtl.set(DEF.temp, false);
      dayCtl.set(DEF.day, false);
      foodCtl.set(DEF.food, false);
      predCtl.set(DEF.predator, false);
      alarmCtl.set(DEF.alarm, false);
      terrCtl.set(DEF.terr, false);
      rhythmCtl.set(DEF.rhythm, false);
      rdayCtl.set(DEF.rday, false);
      ddCtl.set(DEF.dd, false);
      expCtl.set(DEF.exp, false);
      objCtl.set(DEF.obj, false);
      showFor();
      resetHabitat();
      resetRhythms();
      resetLearning();
      for (const c of CATS) budget[c] = c === 'forage' || c === 'rest' ? 0.4 : c === 'territory' ? 0.2 : 0;
    },
  });
  resetHabitat();
  resetRhythms();
  showFor();
  updateUi();
}
