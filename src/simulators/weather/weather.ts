/**
 * Weather: will a rising bubble of air make a cloud, and what kind?
 *
 * Physics (standard meteorology):
 *   dew point (Magnus):  γ = ln(RH/100) + bT/(c+T),  Td = cγ/(b − γ),  b = 17.62, c = 243.12 °C
 *   cloud base (lifting condensation level) ≈ 125 m × (T − Td)
 *   below cloud base the rising air cools at the dry rate, 9.8 °C per km
 *   inside the cloud it cools more slowly (moist adiabatic rate) because
 *   condensing water releases latent heat:
 *     Γm = g (1 + Lv·rs/(Rd·T)) / (cp + Lv²·rs·ε/(Rd·T²))
 *   the air keeps rising while it is warmer than its surroundings.
 *
 * The surroundings: on a sunny day the lowest 1–1.5 km is well mixed (cooling
 * at the dry rate). Above that, the temperature falls at a rate set by the
 * pressure system: slowly under high pressure (stable, with a warm "lid"),
 * faster under low pressure (unstable, so clouds can tower).
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger'] as const;
type Sys = 'high' | 'normal' | 'low';
const SYS: Record<Sys, { p0: number; mixTop: number; lapse: number; lid: number; name: string }> = {
  high: { p0: 1030, mixTop: 1.0, lapse: 5.0, lid: 4, name: 'High pressure (stable, sinking air)' },
  normal: { p0: 1013, mixTop: 1.5, lapse: 6.0, lid: 1.5, name: 'Average pressure' },
  low: { p0: 995, mixTop: 1.5, lapse: 7.5, lid: 0, name: 'Low pressure (unstable, rising air)' },
};
const ZMAX = 13; // km

export function dewPoint(T: number, RH: number) {
  const g = Math.log(Math.max(RH, 1) / 100) + (17.62 * T) / (243.12 + T);
  return (243.12 * g) / (17.62 - g);
}
/** Moist adiabatic lapse rate (°C per km) at temperature T (°C) and pressure p (hPa). */
function moistLapse(T: number, p: number) {
  const Tk = T + 273.15;
  const es = 6.112 * Math.exp((17.67 * T) / (T + 243.5));
  const rs = (0.622 * es) / Math.max(p - es, 1);
  const Lv = 2.5e6;
  const Rd = 287;
  const cp = 1004;
  return (9.81 * (1 + (Lv * rs) / (Rd * Tk))) / (cp + (Lv * Lv * rs * 0.622) / (Rd * Tk * Tk)) * 1000;
}

interface Result {
  td: number;
  base: number; // km, cloud base (or NaN)
  top: number; // km where the parcel stops rising
  env: [number, number][]; // [z, T]
  parcel: [number, number][];
  type: string;
  precip: string;
  freezing: number;
  fog: boolean;
  storm: boolean;
  snow: boolean;
}

function solve(T0: number, RH: number, sys: Sys): Result {
  const s = SYS[sys];
  const td = dewPoint(T0, RH);
  const lcl = Math.max(0, (T0 - td) / 8);
  const envT = (z: number) => {
    if (z <= s.mixTop) return T0 - 9.8 * z;
    const atTop = T0 - 9.8 * s.mixTop;
    // a warm "lid" (inversion) above the mixed layer under high pressure
    const lid = s.lid * clamp((z - s.mixTop) / 0.3, 0, 1);
    const zz = Math.min(z, 11) - s.mixTop; // stops cooling at the tropopause (~11 km)
    return atTop + lid - s.lapse * zz;
  };
  const env: [number, number][] = [];
  for (let z = 0; z <= ZMAX + 0.001; z += 0.1) env.push([z, envT(z)]);
  // Lift a parcel that starts slightly warmer than its surroundings (sun-warmed ground)
  const parcel: [number, number][] = [[0, T0 + 0.5]];
  let T = T0 + 0.5;
  let z = 0;
  const dz = 0.05;
  let top = 0;
  while (z < ZMAX) {
    const p = s.p0 * Math.exp(-z / 8.4);
    const rate = z < lcl ? 9.8 : moistLapse(T, p);
    T -= rate * dz;
    z += dz;
    parcel.push([z, T]);
    // In the mixed layer the parcel stays just warmer than its surroundings
    if (z > s.mixTop && T < envT(z)) break;
    top = z;
  }
  const fog = RH >= 97;
  const cloud = lcl < top && !fog;
  const thick = cloud ? top - lcl : 0;
  const topT = parcel[parcel.length - 1][1];
  const freezing = T0 <= 0 ? 0 : T0 / 6.5;
  const snow = T0 <= 2;
  let type = 'No clouds: the rising air cannot cool to its dew point';
  let precip = 'None';
  let storm = false;
  if (fog) {
    type = 'Fog (a cloud at ground level)';
    precip = 'Drizzle or none';
  } else if (cloud) {
    if (thick < 1) type = 'Fair-weather cumulus';
    else if (thick < 3) type = 'Cumulus';
    else if (top < 8) type = 'Cumulus congestus (towering cumulus)';
    else type = 'Cumulonimbus (thunderstorm cloud)';
    if (thick >= 2.5) precip = snow ? 'Snow showers' : 'Rain showers';
    if (top >= 8) {
      storm = true;
      precip = snow ? 'Heavy snow' : topT < -20 && thick > 8 ? 'Heavy rain, thunder and lightning, possible hail' : 'Heavy rain with thunder and lightning';
    }
  }
  return { td, base: cloud || fog ? (fog ? 0 : lcl) : NaN, top, env, parcel, type, precip, freezing, fog, storm, snow };
}

export function initWeather(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;

  const st = { T: 20, RH: 50, sys: 'normal' as Sys };
  let res = solve(st.T, st.RH, st.sys);
  let z = 0; // current parcel height (km)
  let t = 0;
  let drops: { x: number; y: number; v: number }[] = [];
  let flash = 0;

  function recompute() {
    res = solve(st.T, st.RH, st.sys);
    z = 0;
    t = 0;
    drops = [];
    sim?.play();
  }

  function step(dt: number) {
    t += dt;
    const target = res.fog ? 0 : res.top;
    z = Math.min(target, z + dt * 1.2);
    const grown = z >= target - 1e-6;
    // precipitation once the cloud has fully grown
    if (grown && res.precip !== 'None' && !res.fog) {
      const n = res.storm ? 8 : 3;
      for (let i = 0; i < n; i++) drops.push({ x: 160 + Math.random() * 300, y: yOf(res.base), v: res.snow ? 60 + Math.random() * 30 : 380 + Math.random() * 120 });
    }
    for (const d of drops) {
      d.y += d.v * dt;
      if (res.snow) d.x += Math.sin(d.y / 20) * 0.6;
    }
    drops = drops.filter((d) => d.y < 500);
    if (res.storm && grown && Math.random() < dt * 0.6) flash = 0.25;
    flash = Math.max(0, flash - dt);
  }

  /* ---------- Layout (design box 1000 × 560) ---------- */
  const yOf = (km: number) => 500 - (km / ZMAX) * 460;
  // Phones: the chart goes below the sky instead of beside it
  const isStacked = () => size.h > size.w;
  const tf = () => {
    const [bw, bh] = isStacked() ? [620, 1130] : [1000, 560];
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2, oy: (size.h - bh * k) / 2 };
  };

  function cloudShape(base: number, top: number, cx: number) {
    const yb = yOf(base);
    const yt = yOf(top);
    const h = yb - yt;
    const wBase = 120 + Math.min(h, 200) * 0.6;
    ctx.beginPath();
    const puffs = Math.max(3, Math.round(h / 28));
    for (let i = 0; i < puffs; i++) {
      const f = i / Math.max(1, puffs - 1);
      const y = yb - f * h;
      const w = wBase * (1 - f * 0.35);
      for (const dx of [-0.35, 0, 0.35]) ctx.moveTo(cx + dx * w + 34, y), ctx.arc(cx + dx * w, y, 34 + (1 - f) * 10, 0, Math.PI * 2);
    }
    // anvil at the tropopause for thunderstorms
    if (top >= 8) {
      ctx.moveTo(cx - 170, yt + 10);
      ctx.ellipse(cx + 40, yt + 6, 210, 22, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    // flat cloud base
    ctx.fillRect(cx - wBase * 0.55, yb - 10, wBase * 1.1, 12);
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

    /* Sky scene (x 0–600) */
    const sky = ctx.createLinearGradient(0, 30, 0, 500);
    const dark = res.storm ? 0.45 : res.precip !== 'None' ? 0.25 : 0;
    sky.addColorStop(0, `rgba(${40 - dark * 20}, ${90 - dark * 50}, ${170 - dark * 80}, 1)`);
    sky.addColorStop(1, `rgba(${150 - dark * 60}, ${200 - dark * 80}, ${240 - dark * 90}, 1)`);
    ctx.fillStyle = sky;
    ctx.beginPath();
    ctx.roundRect(0, 30, 610, 500, 14);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 30, 610, 500, 14);
    ctx.clip();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 2})`;
      ctx.fillRect(0, 30, 610, 500);
    }
    // sun
    if (!res.storm) {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(540, 90, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    // altitude grid
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let km = 2; km <= 12; km += 2) {
      ctx.beginPath();
      ctx.moveTo(0, yOf(km));
      ctx.lineTo(610, yOf(km));
      ctx.stroke();
      ctx.fillText(`${km} km`, 8, yOf(km) - 4);
    }
    // cloud (grows as the parcel rises past cloud base)
    if (res.fog) {
      ctx.fillStyle = 'rgba(230, 235, 240, 0.85)';
      ctx.fillRect(0, yOf(0.4), 610, 500 - yOf(0.4));
    } else if (!Number.isNaN(res.base) && z > res.base) {
      ctx.fillStyle = res.storm ? 'rgba(120, 125, 140, 0.95)' : res.precip !== 'None' ? 'rgba(190, 195, 205, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      cloudShape(res.base, Math.max(res.base + 0.15, z), 310);
    }
    // precipitation
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.8)';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (const d of drops) {
      if (res.snow) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2, d.y + 10);
        ctx.stroke();
      }
    }
    // the rising air parcel
    if (!res.fog) {
      const py = yOf(z);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(110, 500);
      ctx.lineTo(110, py);
      ctx.stroke();
      ctx.setLineDash([]);
      const inCloud = !Number.isNaN(res.base) && z >= res.base;
      ctx.fillStyle = inCloud ? 'rgba(255,255,255,0.95)' : 'rgba(255, 170, 90, 0.9)';
      ctx.beginPath();
      ctx.arc(110, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = fs(11, 700);
      ctx.fillStyle = '#fff';
      ctx.fillText('Rising air', 130, py + 4);
    }
    ctx.restore();
    // ground
    ctx.fillStyle = res.snow && res.precip !== 'None' ? '#eef3f7' : '#4f7d3e';
    ctx.fillRect(0, 500, 610, 30);
    ctx.fillStyle = '#3b5f2e';
    for (const x of [60, 200, 420, 560]) {
      ctx.beginPath();
      ctx.moveTo(x, 500);
      ctx.lineTo(x + 12, 470);
      ctx.lineTo(x + 24, 500);
      ctx.fill();
    }
    if (!Number.isNaN(res.base) && !res.fog) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, yOf(res.base));
      ctx.lineTo(610, yOf(res.base));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = fs(11, 700);
      ctx.fillStyle = '#fff';
      ctx.fillText('Cloud base (dew point reached)', 380, yOf(res.base) + 16);
    }

    /* Temperature profile chart (x 680–970, or below the sky on phones) */
    ctx.save();
    if (isStacked()) ctx.translate(-510, 570);
    const cx0 = 680;
    const cw = 290;
    const tx = (T: number) => cx0 + ((T + 70) / 110) * cw;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(cx0, yOf(ZMAX), cw, 500 - yOf(ZMAX));
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / k;
    ctx.font = fs(10.5, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    for (let T = -60; T <= 40; T += 20) {
      ctx.beginPath();
      ctx.moveTo(tx(T), yOf(ZMAX));
      ctx.lineTo(tx(T), 500);
      ctx.stroke();
      ctx.fillText(`${T}°`, tx(T), 516 + 6 / k);
    }
    ctx.fillText('Temperature (°C)', cx0 + cw / 2, 548);
    ctx.textAlign = 'left';
    // freezing line
    ctx.strokeStyle = 'rgba(120, 190, 255, 0.6)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(tx(0), yOf(ZMAX));
    ctx.lineTo(tx(0), 500);
    ctx.stroke();
    ctx.setLineDash([]);
    const line = (pts: [number, number][], colour: string, upTo = ZMAX) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.5 / k;
      ctx.beginPath();
      let first = true;
      for (const [zz, T] of pts) {
        if (zz > upTo) break;
        const x = clamp(tx(T), cx0, cx0 + cw);
        first ? ctx.moveTo(x, yOf(zz)) : ctx.lineTo(x, yOf(zz));
        first = false;
      }
      ctx.stroke();
    };
    line(res.env, '#4fa3e0');
    if (!res.fog) line(res.parcel, '#ff8a3d', z + 0.01);
    if (!Number.isNaN(res.base) && !res.fog) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cx0, yOf(res.base));
      ctx.lineTo(cx0 + cw, yOf(res.base));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Legend on the warm side of the chart, clear of the lines and the badge
    ctx.font = fs(11, 700);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4fa3e0';
    ctx.fillText('Surrounding air', cx0 + cw - 6, yOf(8));
    ctx.fillStyle = '#ff8a3d';
    ctx.fillText('Rising air', cx0 + cw - 6, yOf(8) + 16 / k);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('Height ↑ vs temperature →', cx0 + cw - 6, yOf(8) - 18 / k);
    ctx.textAlign = 'left';
    ctx.restore();
    ctx.restore();
    updateReadouts();
  }

  function updateReadouts() {
    ui.readout('type', res.type);
    sim.setBadge(res.fog ? 'Fog' : res.storm ? 'Thunderstorm' : res.precip !== 'None' ? 'Showers' : Number.isNaN(res.base) ? 'Clear sky' : 'Cloudy');
    ui.readout('td', `${res.td.toFixed(1)} °C`);
    ui.readout('base', res.fog ? 'At the ground' : Number.isNaN(res.base) ? 'No cloud forms' : `${(res.base * 1000).toFixed(0)} m`);
    ui.readout('top', Number.isNaN(res.base) || res.fog ? '—' : `${(res.top * 1000).toFixed(0)} m`);
    ui.readout('precip', res.precip, res.storm ? 'bad' : res.precip !== 'None' ? 'warn' : null);
    ui.readout('pressure', `${SYS[st.sys].p0} hPa · ${SYS[st.sys].name}`);
    ui.readout('freezing', st.T <= 0 ? 'At the ground' : `about ${Math.round(res.freezing * 1000)} m`);
    noteEl.textContent =
      res.fog
        ? 'The air near the ground is saturated, so water vapour condenses right where you are: fog.'
        : Number.isNaN(res.base)
          ? 'The air is too dry: it would have to rise above the mixed layer to cool to its dew point, and the stable air above stops it.'
          : res.storm
            ? 'Once inside the cloud, released heat keeps the air warmer than its surroundings, so it surges up to the top of the troposphere.'
            : 'The air cools as it rises. At the dew point its water vapour condenses into droplets: the cloud base.';
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const tCtl = ui.range('wx-t', (v) => `${v} °C`, (v) => ((st.T = v), recompute()));
  const rhCtl = ui.range('wx-rh', (v) => `${v} %`, (v) => ((st.RH = v), recompute()));
  const sysCtl = ui.choice<Sys>('wx-sys', (v) => ((st.sys = v), recompute()));
  root.querySelectorAll<HTMLButtonElement>('[data-wx]').forEach((b) =>
    b.addEventListener('click', () => {
      const [T, RH, sys] = b.dataset.wx!.split(',');
      tCtl.set(Number(T), false);
      rhCtl.set(Number(RH), false);
      sysCtl.set(sys as Sys, false);
      Object.assign(st, { T: Number(T), RH: Number(RH), sys });
      recompute();
    }),
  );

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { T: 20, RH: 50, sys: 'normal' });
      tCtl.set(20, false);
      rhCtl.set(50, false);
      sysCtl.set('normal', false);
      recompute();
    },
  });
}
