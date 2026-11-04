/**
 * Acids, bases and pH.
 * pH = −log₁₀[H₃O⁺];  pOH = 14 − pH (at 25 °C);  [H₃O⁺][OH⁻] = 1.0 × 10⁻¹⁴.
 * Titration: strong acid (HCl) + strong base (NaOH) → NaCl + H₂O, equivalence at 25.0 mL.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';
import { SUBSTANCES, indicatorColour, phFromExcess, titrationPH, type Indicator } from './data';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'bg-elev', 'border-strong', 'sim-water', 'danger'] as const;
type Mode = 'explore' | 'titrate';

export function initAcidBase(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const substanceSel = root.querySelector<HTMLSelectElement>('[data-substance]')!;
  const indicatorSel = root.querySelector<HTMLSelectElement>('[data-indicator]')!;

  const p = { mode: 'explore' as Mode, sub: 7, dilute: 0, vol: 0, ind: 'universal' as Indicator };
  let curve: Point[] = [{ x: 0, y: titrationPH(0) }];
  let ions: { x: number; y: number; vx: number; vy: number; kind: 'H' | 'OH' }[] = [];

  /* ---------- Chemistry ---------- */
  function currentPH() {
    if (p.mode === 'titrate') return titrationPH(p.vol);
    const ph0 = SUBSTANCES[p.sub].ph;
    // Treat the solution as a net excess of acid or base, then dilute it.
    const excess = 10 ** -ph0 - 10 ** (ph0 - 14);
    return phFromExcess(excess / 10 ** p.dilute);
  }

  function syncIons(ph: number) {
    // Show the ratio of H₃O⁺ to OH⁻ on a log scale (real numbers differ by up to 10¹⁴).
    const total = 40;
    const diff = 7 - ph; // > 0 means more H₃O⁺
    const share = 1 / (1 + Math.exp(-diff * 0.9));
    const wantH = Math.round(total * share);
    const wantOH = total - wantH;
    const count = (k: 'H' | 'OH') => ions.filter((i) => i.kind === k).length;
    const add = (kind: 'H' | 'OH') => ions.push({ x: Math.random(), y: Math.random(), vx: Math.random() - 0.5, vy: Math.random() - 0.5, kind });
    while (count('H') < wantH) add('H');
    while (count('OH') < wantOH) add('OH');
    while (count('H') > wantH) ions.splice(ions.findIndex((i) => i.kind === 'H'), 1);
    while (count('OH') > wantOH) ions.splice(ions.findIndex((i) => i.kind === 'OH'), 1);
  }

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ab-graph"]')!, {
    x: { min: 0, span: 50, max: 50, format: (v) => `${v} mL` },
    y: { min: 0, max: 14, step: 2, format: (v) => `${v}` },
    refs: [
      { value: 7, label: 'neutral (pH 7)', color: 'text-faint' },
      { value: 25, label: 'equivalence 25 mL', color: 'accent-2', axis: 'x' },
    ],
  });
  const theory = Array.from({ length: 501 }, (_, i) => ({ x: i / 10, y: titrationPH(i / 10) }));

  /* ---------- Drawing ---------- */
  let geom = { bx: 0, by: 0, bw: 0, bh: 0, scaleY: 0, scaleX0: 0, scaleX1: 0 };
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const ph = currentPH();
    syncIons(ph);
    const col = indicatorColour(p.ind, ph);

    // Burette (titration mode)
    const bw = Math.min(w * 0.3, 220);
    const bh = Math.min(h * 0.5, 220);
    const bx = w * 0.32 - bw / 2;
    const by = h * 0.86 - bh;
    geom = { ...geom, bx, by, bw, bh };
    if (p.mode === 'titrate') {
      const tx = bx + bw / 2;
      ctx.fillStyle = pal['bg-elev'];
      ctx.strokeStyle = pal['border-strong'];
      ctx.lineWidth = 2;
      ctx.fillRect(tx - 9, 10, 18, by - 40);
      ctx.strokeRect(tx - 9, 10, 18, by - 40);
      const frac = 1 - p.vol / 50;
      ctx.fillStyle = 'rgba(120,160,255,0.35)';
      ctx.fillRect(tx - 7, 12 + (by - 44) * (1 - frac), 14, (by - 44) * frac);
      ctx.fillStyle = pal['text-faint'];
      ctx.font = font(10, 600);
      ctx.fillText('NaOH 0.100 M', tx + 14, 26);
      ctx.fillText(`${p.vol.toFixed(1)} mL added`, tx + 14, 42);
      ctx.beginPath();
      ctx.moveTo(tx - 3, by - 30);
      ctx.lineTo(tx + 3, by - 30);
      ctx.lineTo(tx + 1, by - 18);
      ctx.lineTo(tx - 1, by - 18);
      ctx.fill();
    }

    // Beaker with liquid
    const liquidTop = by + bh * 0.28;
    ctx.fillStyle = col.fill;
    ctx.fillRect(bx + 4, liquidTop, bw - 8, by + bh - liquidTop - 4);
    // Ions (log-scaled ratio)
    for (const ion of ions) {
      const ix = bx + 14 + ion.x * (bw - 28);
      const iy = liquidTop + 12 + ion.y * (by + bh - liquidTop - 28);
      ctx.fillStyle = ion.kind === 'H' ? pal.danger : pal['sim-water'];
      ctx.beginPath();
      ctx.arc(ix, iy, ion.kind === 'H' ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by);
    ctx.stroke();
    pill(
      ctx,
      p.mode === 'titrate' ? '25.0 mL HCl 0.100 M' : SUBSTANCES[p.sub].name + (p.dilute ? ` ÷ ${10 ** p.dilute}` : ''),
      bx + bw / 2,
      by + bh + 18,
      { bg: pal['bg-elev'], fg: pal['sim-text'] },
      size,
    );
    // Ion key (top-left corner, clear of the beaker, burette and pH scale)
    ctx.font = font(11, 600);
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    ctx.arc(22, 20, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('H₃O⁺', 32, 24);
    ctx.fillStyle = pal['sim-water'];
    ctx.beginPath();
    ctx.arc(22, 38, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('OH⁻', 32, 42);
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(10, 500);
    ctx.fillText('ratio on a log scale', 16, 58);

    // pH scale
    const sx0 = w * 0.62;
    const sx1 = w - 24;
    const sy = h * 0.2;
    const sh = h * 0.6;
    geom.scaleX0 = sx0;
    geom.scaleX1 = sx1;
    geom.scaleY = sy;
    const barW = 26;
    const barX = sx0 + 10;
    for (let i = 0; i < 140; i++) {
      const v = 14 - i / 10;
      ctx.fillStyle = indicatorColour('universal', v).fill.replace(/0\.75\)$/, '1)');
      ctx.fillRect(barX, sy + (i / 140) * sh, barW, sh / 140 + 1);
    }
    ctx.strokeStyle = pal['border-strong'];
    ctx.strokeRect(barX, sy, barW, sh);
    ctx.font = font(10, 500, 'mono');
    ctx.fillStyle = pal['text-faint'];
    for (let v = 0; v <= 14; v += 2) ctx.fillText(String(v), barX - 18, sy + ((14 - v) / 14) * sh + 4);
    ctx.font = font(11, 650);
    ctx.fillStyle = pal['sim-text'];
    ctx.fillText('Basic', barX + barW + 8, sy + 12);
    ctx.fillText('Neutral', barX + barW + 8, sy + sh / 2 + 4);
    ctx.fillText('Acidic', barX + barW + 8, sy + sh - 2);
    const my = sy + ((14 - Math.min(14, Math.max(0, ph))) / 14) * sh;
    ctx.fillStyle = pal['sim-text'];
    ctx.beginPath();
    ctx.moveTo(barX - 4, my);
    ctx.lineTo(barX - 14, my - 7);
    ctx.lineTo(barX - 14, my + 7);
    ctx.closePath();
    ctx.fill();
    pill(ctx, `pH ${ph.toFixed(2)}`, Math.min(sx1 - 40, barX + barW + 46), my, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Readouts
    const hconc = 10 ** -ph;
    const ohconc = 1e-14 / hconc;
    const sup = (n: number) => String(n).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
    const sci = (v: number) => {
      const e = Math.floor(Math.log10(v));
      return `${(v / 10 ** e).toFixed(1)} × 10${sup(e)} M`;
    };
    const nature = ph < 6.95 ? 'Acidic' : ph > 7.05 ? 'Basic (alkaline)' : 'Neutral';
    ui.readout('ph', ph.toFixed(2));
    ui.readout('nature', nature, ph < 6.95 ? 'bad' : ph > 7.05 ? 'warn' : 'ok');
    ui.readout('h', sci(hconc));
    ui.readout('oh', sci(ohconc));
    ui.readout('colour', col.name);
    if (p.mode === 'titrate') {
      const left = 25 - p.vol;
      ui.readout('extra', Math.abs(left) < 0.05 ? 'Equivalence point reached' : left > 0 ? `${left.toFixed(1)} mL more to neutralize` : `${(-left).toFixed(1)} mL excess NaOH`);
    } else {
      ui.readout('extra', p.dilute ? `Diluted ${10 ** p.dilute}× (pH moved toward 7)` : 'Switch to Titration mode');
    }
    sim.setBadge(`pH ${ph.toFixed(1)} · ${nature}`);
    canvas.setAttribute('aria-label', `${p.mode === 'titrate' ? `Titration flask after adding ${p.vol.toFixed(1)} mL of NaOH` : SUBSTANCES[p.sub].name}. pH ${ph.toFixed(2)}, ${nature.toLowerCase()}. ${indicatorSel.selectedOptions[0].text} is ${col.name}.`);

    graph.set('theory', { label: 'Predicted curve', color: 'text-faint', points: theory, dash: [5, 5], width: 1.5 });
    graph.set('data', { label: 'Your titration', color: 'accent', points: p.mode === 'titrate' ? curve : [], type: 'points' });
    graph.draw();
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const setVol = (v: number) => {
    p.vol = Math.min(50, Math.max(0, Math.round(v * 10) / 10));
    volCtl.set(p.vol, false);
    curve.push({ x: p.vol, y: titrationPH(p.vol) });
    curve.sort((a, b) => a.x - b.x);
    sim.requestRender();
  };
  const volCtl = ui.range('ab-vol', (v) => `${v.toFixed(1)} mL`, (v) => setVol(v));
  const dilCtl = ui.range('ab-dilute', (v) => (v ? `${10 ** v}×` : 'None'), (v) => ((p.dilute = v), sim.requestRender()));
  const modeCtl = ui.choice<Mode>('ab-mode', (v) => {
    p.mode = v;
    root.querySelectorAll<HTMLElement>('[data-mode-only]').forEach((el) => (el.hidden = el.dataset.modeOnly !== v));
    sim.requestRender();
  });
  substanceSel.addEventListener('change', () => {
    p.sub = Number(substanceSel.value);
    dilCtl.set(0);
  });
  indicatorSel.addEventListener('change', () => {
    p.ind = indicatorSel.value as Indicator;
    sim.requestRender();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) =>
    b.addEventListener('click', () => {
      if (p.mode !== 'titrate') modeCtl.set('titrate');
      setVol(p.vol + Number(b.dataset.add));
    }),
  );

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x > geom.scaleX0) {
      const v = 14 - ((y - geom.scaleY) / (size.h * 0.6)) * 14;
      const vv = Math.max(0, Math.min(14, v));
      const near = SUBSTANCES.reduce((a, s) => (Math.abs(s.ph - vv) < Math.abs(a.ph - vv) ? s : a));
      sim.showTooltip(x, y, `pH ${vv.toFixed(1)}`, `${vv < 7 ? 'Acidic' : vv > 7 ? 'Basic' : 'Neutral'}. A nearby example: ${near.name.toLowerCase()} (≈ pH ${near.ph}). Each step on the scale is a 10× change in [H₃O⁺].`);
    } else {
      sim.showTooltip(x, y, 'Ions in solution', 'Red dots are hydronium ions (H₃O⁺); blue dots are hydroxide ions (OH⁻). Acids have more H₃O⁺, bases more OH⁻. In water they always multiply to 1 × 10⁻¹⁴.');
    }
  });

  const sim = createSimController(root, {
    step: (dt) => {
      if (p.mode === 'titrate' && p.vol < 50) {
        // Slow down near the equivalence point, like a careful chemist
        const rate = Math.abs(p.vol - 25) < 3 ? 0.4 : 3;
        p.vol = Math.min(50, p.vol + rate * dt);
        volCtl.set(Math.round(p.vol * 10) / 10, false);
        const last = curve[curve.length - 1];
        if (!last || p.vol - last.x >= 0.2) curve.push({ x: p.vol, y: titrationPH(p.vol) });
      }
      for (const ion of ions) {
        ion.x = (ion.x + ion.vx * dt * 0.15 + 1) % 1;
        ion.y = (ion.y + ion.vy * dt * 0.15 + 1) % 1;
      }
    },
    render,
    autoplay: false,
    onPlayChange: (on) => {
      if (on && p.mode !== 'titrate') modeCtl.set('titrate');
    },
    reset() {
      modeCtl.set('explore');
      substanceSel.value = '7';
      indicatorSel.value = 'universal';
      Object.assign(p, { sub: 7, dilute: 0, vol: 0, ind: 'universal' });
      dilCtl.set(0, false);
      volCtl.set(0, false);
      curve = [{ x: 0, y: titrationPH(0) }];
    },
  });
  sim.requestRender();
}
