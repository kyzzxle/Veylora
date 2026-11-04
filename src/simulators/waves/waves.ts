/**
 * Wave interference (superposition).
 * String view:  y₁ = A₁ sin(k₁x − ω₁t),  y₂ = A₂ sin(k₂x − ω₂t + φ),  y = y₁ + y₂
 * Ripple tank:  two point sources of the same frequency; at each point the
 * waves arrive with path difference Δr. Average intensity
 *   I = A₁² + A₂² + 2A₁A₂ cos(kΔr − φ)
 * so bright fringes appear where kΔr − φ = 2πn.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'bg-elev', 'border-strong'] as const;
const SPEED = 2; // wave speed, units per second
const DEF = { phase: 0, f1: 0.5, f2: 0.5, a1: 1, a2: 1, sep: 3 };

const hexRGB = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function initWaves(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { mode: 'string' as 'string' | 'ripple', ...DEF, avg: false, t: 0 };
  const phi = () => (p.phase * Math.PI) / 180;

  /* ---------- Physics helpers ---------- */
  const sameF = () => Math.abs(p.f1 - p.f2) < 1e-6;
  const resultant = () => Math.sqrt(p.a1 ** 2 + p.a2 ** 2 + 2 * p.a1 * p.a2 * Math.cos(phi()));
  function classify(): { label: string; tone: 'ok' | 'warn' | 'bad' | null } {
    if (p.mode === 'string' && !sameF()) return { label: 'Beats (changing)', tone: 'warn' };
    const c = Math.cos(phi());
    if (c > 0.95) return { label: 'Constructive', tone: 'ok' };
    if (c < -0.95) return { label: 'Destructive', tone: 'bad' };
    return { label: 'Partial', tone: 'warn' };
  }

  /* ---------- String view ---------- */
  const X_MAX = 10;
  function drawString() {
    const { w, h } = size;
    const y1 = (x: number): number => p.a1 * Math.sin(k(p.f1) * x - 2 * Math.PI * p.f1 * p.t);
    const y2 = (x: number): number => p.a2 * Math.sin(k(p.f2) * x - 2 * Math.PI * p.f2 * p.t + phi());
    const bands = [
      { y: h * 0.18, label: 'Wave 1', color: pal.accent, f: y1, amp: 1 },
      { y: h * 0.47, label: 'Wave 2', color: pal['accent-2'], f: y2, amp: 1 },
      { y: h * 0.79, label: 'Sum (what you actually see)', color: pal['sim-solute'], f: (x: number) => y1(x) + y2(x), amp: 2 },
    ];
    const bandH = h * 0.11;
    const X = (x: number) => 20 + (x / X_MAX) * (w - 40);
    for (const b of bands) {
      ctx.strokeStyle = pal['sim-grid'];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, b.y);
      ctx.lineTo(w - 20, b.y);
      ctx.stroke();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.amp === 2 ? 3.5 : 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 400; i++) {
        const x = (i / 400) * X_MAX;
        const yy = b.y - b.f(x) * bandH * 0.45; // same scale for every band
        if (i) ctx.lineTo(X(x), yy);
        else ctx.moveTo(X(x), yy);
      }
      ctx.stroke();
      ctx.fillStyle = pal['text-faint'];
      ctx.font = font(12, 600);
      ctx.fillText(b.label, 22, b.y - bandH - 6);
    }
    // Beat envelope
    if (!sameF() && p.a1 > 0 && p.a2 > 0) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = pal['text-faint'];
      ctx.lineWidth = 1.2;
      for (const sign of [1, -1]) {
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) {
          const x = (i / 300) * X_MAX;
          const d = (k(p.f1) - k(p.f2)) * x - 2 * Math.PI * (p.f1 - p.f2) * p.t - phi();
          const env = Math.sqrt(p.a1 ** 2 + p.a2 ** 2 + 2 * p.a1 * p.a2 * Math.cos(d));
          const yy = bands[2].y - sign * env * bandH * 0.45;
          if (i) ctx.lineTo(X(x), yy);
          else ctx.moveTo(X(x), yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  const k = (f: number) => (2 * Math.PI * f) / SPEED;

  /* ---------- Ripple tank ---------- */
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d')!;
  const geom = { res: 3, gw: 0, gh: 0, lambdaPx: 40, s1: { x: 0, y: 0 }, s2: { x: 0, y: 0 } };
  function rippleGeom() {
    const { w, h } = size;
    geom.res = w < 500 ? 3 : 4;
    geom.gw = Math.ceil(w / geom.res);
    geom.gh = Math.ceil(h / geom.res);
    geom.lambdaPx = Math.min(w, h) / 9;
    const half = (p.sep * geom.lambdaPx) / 2;
    geom.s1 = { x: w * 0.12, y: h / 2 - half };
    geom.s2 = { x: w * 0.12, y: h / 2 + half };
  }
  function drawRipple() {
    rippleGeom();
    const { gw, gh, res, lambdaPx, s1, s2 } = geom;
    if (off.width !== gw || off.height !== gh) {
      off.width = gw;
      off.height = gh;
    }
    const img = offCtx.createImageData(gw, gh);
    const bg = hexRGB(pal['sim-bg']);
    const pos = hexRGB(pal.accent);
    const neg = hexRGB(pal['accent-2']);
    const kk = (2 * Math.PI) / lambdaPx;
    const wt = 2 * Math.PI * p.f1 * p.t;
    const maxA = p.a1 + p.a2 || 1;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const x = i * res;
        const y = j * res;
        const r1 = Math.hypot(x - s1.x, y - s1.y);
        const r2 = Math.hypot(x - s2.x, y - s2.y);
        let v: number;
        if (p.avg) {
          const I = p.a1 ** 2 + p.a2 ** 2 + 2 * p.a1 * p.a2 * Math.cos(kk * (r2 - r1) - phi());
          v = I / (maxA * maxA); // 0…1
        } else {
          v = (p.a1 * Math.cos(kk * r1 - wt) + p.a2 * Math.cos(kk * r2 - wt + phi())) / maxA; // −1…1
        }
        const c = p.avg ? pos : v >= 0 ? pos : neg;
        const t = Math.min(1, Math.abs(v)) * (p.avg ? 0.95 : 0.85);
        const o = (j * gw + i) * 4;
        img.data[o] = bg[0] + (c[0] - bg[0]) * t;
        img.data[o + 1] = bg[1] + (c[1] - bg[1]) * t;
        img.data[o + 2] = bg[2] + (c[2] - bg[2]) * t;
        img.data[o + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, gw * res, gh * res);
    for (const [s, name] of [
      [s1, 'S₁'],
      [s2, 'S₂'],
    ] as const) {
      ctx.fillStyle = pal['sim-text'];
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      pill(ctx, name, s.x - 26, s.y, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
    }
  }

  /* ---------- Render ---------- */
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    if (p.mode === 'string') drawString();
    else drawRipple();

    const cls = classify();
    ui.readout('type', cls.label, cls.tone);
    ui.readout('amp', p.mode === 'string' && !sameF() ? `Varies 0 – ${(p.a1 + p.a2).toFixed(2)}` : `${resultant().toFixed(2)} (max ${(p.a1 + p.a2).toFixed(2)})`);
    ui.readout('lambda', p.mode === 'string' ? `${(SPEED / p.f1).toFixed(2)} / ${(SPEED / p.f2).toFixed(2)} units` : `Sources ${p.sep} λ apart`);
    ui.readout('beat', p.mode === 'string' ? `${Math.abs(p.f1 - p.f2).toFixed(2)} Hz` : '— (same frequency)');
    sim.setBadge(p.mode === 'string' ? `${cls.label} · φ = ${p.phase}°` : p.avg ? 'Average intensity: strong colour = strong vibration' : 'Ripple tank');
    canvas.setAttribute(
      'aria-label',
      p.mode === 'string'
        ? `Two waves on a string with frequencies ${p.f1} and ${p.f2} hertz and a phase difference of ${p.phase} degrees. Interference: ${cls.label}.`
        : `Ripple tank with two sources ${p.sep} wavelengths apart, showing an interference pattern of alternating strong and weak regions.`,
    );
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const upd = () => sim.requestRender();
  const ctl = {
    phase: ui.range('wv-phase', (v) => `${v}°`, (v) => ((p.phase = v), upd())),
    f1: ui.range('wv-f1', (v) => `${v.toFixed(2)} Hz`, (v) => ((p.f1 = v), upd())),
    f2: ui.range('wv-f2', (v) => `${v.toFixed(2)} Hz`, (v) => ((p.f2 = v), upd())),
    a1: ui.range('wv-a1', (v) => v.toFixed(2), (v) => ((p.a1 = v), upd())),
    a2: ui.range('wv-a2', (v) => v.toFixed(2), (v) => ((p.a2 = v), upd())),
    sep: ui.range('wv-sep', (v) => `${v} λ`, (v) => ((p.sep = v), upd())),
  };
  ui.presets('wv-phase', ctl.phase);
  const modeCtl = ui.choice<'string' | 'ripple'>('wv-mode', (v) => ((p.mode = v), sim.hideTooltip(), upd()));
  const avgCtl = ui.toggle('wv-avg', (v) => ((p.avg = v), upd()));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (p.mode === 'ripple') {
      const d = (Math.hypot(x - geom.s2.x, y - geom.s2.y) - Math.hypot(x - geom.s1.x, y - geom.s1.y)) / geom.lambdaPx;
      const net = d - p.phase / 360;
      const frac = Math.abs(net - Math.round(net));
      const kind = frac < 0.15 ? 'constructive (bright fringe)' : frac > 0.35 ? 'destructive (dark fringe)' : 'partial';
      sim.showTooltip(x, y, `Path difference ${Math.abs(d).toFixed(2)} λ`, `The waves from S₁ and S₂ arrive ${kind} here. Whole-number path differences (in phase) give bright fringes; half-numbers give dark fringes.`);
    } else {
      const band = y < size.h * 0.33 ? 'Wave 1' : y < size.h * 0.63 ? 'Wave 2' : 'Sum';
      sim.showTooltip(x, y, band, band === 'Sum' ? 'At every point, the displacement of the sum equals wave 1 plus wave 2 — the principle of superposition.' : 'A travelling wave moving to the right. Its wavelength is speed ÷ frequency.');
    }
  });

  const sim = createSimController(root, {
    step: (dt) => (p.t += dt),
    render,
    reset() {
      (Object.keys(ctl) as (keyof typeof ctl)[]).forEach((key) => ctl[key].set(DEF[key], false));
      Object.assign(p, DEF, { mode: 'string', avg: false, t: 0 });
      modeCtl.set('string', false);
      avgCtl.set(false, false);
    },
  });
  sim.requestRender();
}
