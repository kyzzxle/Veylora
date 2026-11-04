/**
 * Probability experiments: coin (optionally biased), one die, two dice.
 * Experimental probability = count / trials; it approaches the theoretical
 * probability as trials increase (law of large numbers).
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';
import { LineGraph, type Point } from '../shared/graph';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'sim-solute', 'text-faint', 'bg-elev', 'border-strong', 'warning'] as const;
type Exp = 'coin' | 'die' | 'dice';

export function initProbability(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const p = { exp: 'coin' as Exp, bias: 0.5, face: 6, sum: 7, rate: 20 };
  let counts: number[] = [];
  let trials = 0;
  let last: number[] = [];
  let running: Point[] = [];
  let carry = 0;

  const outcomes = () => (p.exp === 'coin' ? ['Heads', 'Tails'] : p.exp === 'die' ? ['1', '2', '3', '4', '5', '6'] : Array.from({ length: 11 }, (_, i) => String(i + 2)));
  const theoretical = (i: number) => (p.exp === 'coin' ? (i === 0 ? p.bias : 1 - p.bias) : p.exp === 'die' ? 1 / 6 : (6 - Math.abs(i + 2 - 7)) / 36);
  const trackedIndex = () => (p.exp === 'coin' ? 0 : p.exp === 'die' ? p.face - 1 : p.sum - 2);
  const trackedName = () => (p.exp === 'coin' ? 'Heads' : p.exp === 'die' ? `Rolling a ${p.face}` : `A sum of ${p.sum}`);

  function clear() {
    counts = new Array(outcomes().length).fill(0);
    trials = 0;
    last = [];
    running = [];
    carry = 0;
  }

  function trial() {
    let idx: number;
    if (p.exp === 'coin') {
      idx = Math.random() < p.bias ? 0 : 1;
      last = [idx];
    } else if (p.exp === 'die') {
      idx = Math.floor(Math.random() * 6);
      last = [idx + 1];
    } else {
      const a = 1 + Math.floor(Math.random() * 6);
      const b = 1 + Math.floor(Math.random() * 6);
      last = [a, b];
      idx = a + b - 2;
    }
    counts[idx]++;
    trials++;
    // Keep the running-proportion series to a manageable size
    const every = trials <= 500 ? 1 : trials <= 5000 ? 10 : 100;
    if (trials % every === 0) running.push({ x: trials, y: counts[trackedIndex()] / trials });
  }
  const runN = (n: number) => {
    for (let i = 0; i < n; i++) trial();
    sim.requestRender();
  };

  /* ---------- Graph ---------- */
  const graph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="pr-graph"]')!, {
    x: { min: 0, span: 50, step: 50, format: (v) => `${v}` },
    y: { min: 0, max: 1, step: 0.25, format: (v) => v.toFixed(2) },
  });

  /* ---------- Drawing ---------- */
  function drawDie(x: number, y: number, s: number, n: number) {
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['sim-text'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.16);
    ctx.fill();
    ctx.stroke();
    const pips: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    };
    ctx.fillStyle = pal['sim-text'];
    for (const [dx, dy] of pips[n]) {
      ctx.beginPath();
      ctx.arc(x + dx * s * 0.26, y + dy * s * 0.26, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let bars: { x: number; w: number; i: number }[] = [];
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    // Last outcome
    const topH = h * 0.3;
    if (last.length) {
      const s = Math.min(topH * 0.62, 70);
      if (p.exp === 'coin') {
        const heads = last[0] === 0;
        ctx.fillStyle = heads ? pal.warning : pal['border-strong'];
        ctx.beginPath();
        ctx.arc(w / 2, topH / 2 + 6, s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal['sim-text'];
        ctx.font = font(Math.round(s * 0.42), 700);
        ctx.textAlign = 'center';
        ctx.fillText(heads ? 'H' : 'T', w / 2, topH / 2 + 6 + s * 0.15);
      } else {
        last.forEach((n, i) => drawDie(w / 2 + (i - (last.length - 1) / 2) * s * 1.3, topH / 2 + 6, s, n));
        if (p.exp === 'dice') {
          ctx.fillStyle = pal['sim-text'];
          ctx.font = font(14, 650);
          ctx.textAlign = 'left';
          ctx.fillText(`= ${last[0] + last[1]}`, w / 2 + s * 1.35, topH / 2 + 11);
        }
      }
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = pal['text-faint'];
      ctx.font = font(14, 600);
      ctx.textAlign = 'center';
      ctx.fillText('Press Start or a +1 / +10 / +100 / +1000 button to run trials', w / 2, topH / 2 + 6);
      ctx.textAlign = 'left';
    }

    // Bar chart: observed relative frequency vs theoretical probability
    const names = outcomes();
    const chartTop = topH + 20;
    const chartBottom = h - 34;
    const chartH = chartBottom - chartTop;
    const left = 46;
    const right = w - 16;
    const maxP = Math.max(...names.map((_, i) => theoretical(i)), ...counts.map((c) => (trials ? c / trials : 0)));
    const yMax = Math.min(1, Math.ceil((maxP * 1.25) / 0.05) * 0.05 || 0.2);
    const Yp = (v: number) => chartBottom - (v / yMax) * chartH;
    ctx.strokeStyle = pal['sim-grid'];
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(10, 500, 'mono');
    ctx.textAlign = 'right';
    const tick = yMax <= 0.3 ? 0.05 : yMax <= 0.6 ? 0.1 : 0.25;
    for (let v = 0; v <= yMax + 1e-9; v += tick) {
      ctx.beginPath();
      ctx.moveTo(left, Yp(v));
      ctx.lineTo(right, Yp(v));
      ctx.stroke();
      ctx.fillText(v.toFixed(2), left - 6, Yp(v) + 3);
    }
    ctx.textAlign = 'center';
    const slot = (right - left) / names.length;
    const bw = slot * 0.62;
    bars = [];
    names.forEach((name, i) => {
      const cx = left + slot * (i + 0.5);
      const obs = trials ? counts[i] / trials : 0;
      const tracked = i === trackedIndex();
      ctx.fillStyle = tracked ? pal['sim-solute'] : pal.accent;
      ctx.globalAlpha = tracked ? 0.95 : 0.75;
      ctx.fillRect(cx - bw / 2, Yp(obs), bw, chartBottom - Yp(obs));
      ctx.globalAlpha = 1;
      // Theoretical marker
      ctx.strokeStyle = pal['accent-2'];
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 - 4, Yp(theoretical(i)));
      ctx.lineTo(cx + bw / 2 + 4, Yp(theoretical(i)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal['sim-text'];
      ctx.font = font(names.length > 6 ? 10 : 12, 600);
      ctx.fillText(name, cx, chartBottom + 16);
      bars.push({ x: cx - slot / 2, w: slot, i });
    });
    ctx.textAlign = 'left';
    pill(ctx, '— — theoretical', right - 70, chartTop + 4, { bg: pal['bg-elev'], fg: pal['accent-2'] }, size);

    // Readouts
    const ti = trackedIndex();
    const expP = trials ? counts[ti] / trials : 0;
    const theo = theoretical(ti);
    ui.readout('trials', trials.toLocaleString());
    ui.readout('event', `${trackedName()}: ${counts[ti]?.toLocaleString() ?? 0}`);
    ui.readout('exp', trials ? expP.toFixed(4) : '—');
    ui.readout('theo', theo.toFixed(4));
    ui.readout('diff', trials ? `${(expP - theo >= 0 ? '+' : '−')}${Math.abs(expP - theo).toFixed(4)}` : '—');
    ui.readout('expected', (theo * trials).toFixed(1));
    sim.setBadge(`${trials.toLocaleString()} trials`);
    canvas.setAttribute(
      'aria-label',
      `${trials} trials of ${p.exp === 'coin' ? 'a coin flip' : p.exp === 'die' ? 'rolling one die' : 'rolling two dice'}. ${trackedName()} occurred ${counts[ti] ?? 0} times, an experimental probability of ${expP.toFixed(3)} compared with a theoretical ${theo.toFixed(3)}.`,
    );

    graph.opts.x = { min: 0, span: 50, step: trials > 5000 ? 5000 : trials > 500 ? 500 : 50, format: (v) => `${v}` };
    graph.opts.refs = [{ value: theo, label: `theoretical ${theo.toFixed(3)}`, color: 'accent-2' }];
    graph.set('run', { label: 'Running proportion', color: 'sim-solute', points: running, legend: false });
    graph.draw();
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const restart = () => {
    clear();
    sim.requestRender();
  };
  const expCtl = ui.choice<Exp>('pr-exp', (v) => {
    p.exp = v;
    root.querySelectorAll<HTMLElement>('[data-only]').forEach((el) => (el.hidden = el.dataset.only !== v));
    restart();
  });
  const biasCtl = ui.range('pr-bias', (v) => v.toFixed(2), (v) => ((p.bias = v), restart()));
  const faceCtl = ui.range('pr-face', (v) => String(v), (v) => {
    p.face = v;
    running = []; // the tracked outcome changed; restart the running proportion
    sim.requestRender();
  });
  const sumCtl = ui.range('pr-sum', (v) => String(v), (v) => {
    p.sum = v;
    running = [];
    sim.requestRender();
  });
  ui.range('pr-rate', (v) => `${v}/s`, (v) => (p.rate = v));
  root.querySelectorAll<HTMLButtonElement>('[data-run]').forEach((b) => b.addEventListener('click', () => runN(Number(b.dataset.run))));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const bar = bars.find((b) => x >= b.x && x < b.x + b.w);
    if (bar && y > size.h * 0.3) {
      const name = outcomes()[bar.i];
      const c = counts[bar.i];
      sim.showTooltip(
        x,
        y,
        p.exp === 'coin' ? name : p.exp === 'die' ? `Face ${name}` : `Sum ${name}`,
        `Observed ${c} of ${trials} (${trials ? ((c / trials) * 100).toFixed(1) : 0}%). Theoretical ${(theoretical(bar.i) * 100).toFixed(1)}%.`,
      );
    }
  });

  const sim = createSimController(root, {
    step: (dt) => {
      carry += dt * p.rate;
      const n = Math.floor(carry);
      carry -= n;
      for (let i = 0; i < n; i++) trial();
    },
    render,
    autoplay: false,
    reset() {
      expCtl.set('coin', false);
      p.exp = 'coin';
      root.querySelectorAll<HTMLElement>('[data-only]').forEach((el) => (el.hidden = el.dataset.only !== 'coin'));
      biasCtl.set(0.5, false);
      faceCtl.set(6, false);
      sumCtl.set(7, false);
      Object.assign(p, { bias: 0.5, face: 6, sum: 7 });
      clear();
    },
  });
  clear();
  sim.requestRender();
}
