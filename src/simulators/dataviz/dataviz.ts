/**
 * Data visualisation lab: the same data shown with different charts, plus
 * the common tricks that make charts misleading.
 *
 * Four datasets (generated from fixed random seeds so they are repeatable):
 *   pair        temperature (°C) vs ice-cream sales: two numbers per day
 *   time        rainfall in each month: a sequence over time
 *   values      test scores: one number per student (a distribution)
 *   categories  favourite fruit: counts in named groups
 * Each chart type suits some kinds of data and not others; the verdict
 * explains why. Statistics: mean, median, range, and for paired data the
 * Pearson correlation r and a least-squares trend line.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'accent', 'accent-2', 'warning', 'danger', 'success'] as const;
type Dataset = 'pair' | 'time' | 'values' | 'categories';
type Chart = 'bar' | 'line' | 'scatter' | 'histogram' | 'pie';

const VERDICT: Record<Dataset, Record<Chart, [boolean, string]>> = {
  pair: {
    scatter: [true, 'A scatter graph is the right choice for two numbers measured together: each dot is one day, and the pattern shows how the variables are related.'],
    line: [false, 'Joining the dots implies the days follow on from each other in order of temperature. A scatter graph shows the relationship more honestly.'],
    bar: [false, 'Bars make each day look like a separate category and hide the relationship between temperature and sales.'],
    histogram: [false, 'A histogram shows the spread of one variable only; you lose the link between temperature and sales.'],
    pie: [false, 'Pie charts show parts of a whole. Daily sales are not parts of anything here, so a pie makes no sense.'],
  },
  time: {
    line: [true, 'A line graph is ideal for data over time: the slope shows rises and falls from month to month.'],
    bar: [true, 'A bar chart also works well for monthly totals, making each month easy to compare.'],
    scatter: [false, 'Without joined points, the pattern through the year is harder to follow. A line graph is clearer.'],
    histogram: [false, 'A histogram would throw away the order of the months, which is the whole point of the data.'],
    pie: [false, 'A pie chart hides the seasonal pattern and makes small differences between slices very hard to judge.'],
  },
  values: {
    histogram: [true, 'A histogram groups the scores into ranges (bins), showing the shape of the distribution: where most students scored, and how spread out they are.'],
    bar: [false, 'One bar per student in random order shows no pattern. Grouping into a histogram reveals the distribution.'],
    line: [false, 'The students are not in any meaningful order, so joining them with a line creates a fake pattern.'],
    scatter: [false, 'With only one variable, a scatter graph has nothing to plot against. Use a histogram.'],
    pie: [false, 'Scores are not parts of a whole. A pie chart cannot show a distribution.'],
  },
  categories: {
    bar: [true, 'A bar chart is the best way to compare counts in categories: lengths are easy to compare by eye.'],
    pie: [true, 'A pie chart works for parts of a whole (everyone chose one fruit), but small differences between slices are harder to see than with bars.'],
    line: [false, 'A line implies a continuous change between fruits, but there is no order between apple and banana.'],
    scatter: [false, 'Categories are not numbers, so a scatter graph has no meaningful x-axis.'],
    histogram: [false, 'Histograms are for numerical data split into ranges, not named categories.'],
  },
};
const DATASET_TITLE: Record<Dataset, string> = {
  pair: 'Ice-cream sales vs temperature',
  time: 'Rainfall each month',
  values: 'Test scores of a class',
  categories: 'Favourite fruit survey',
};
const FRUITS = ['Apple', 'Banana', 'Grapes', 'Mango', 'Orange', 'Pear'];
const FRUIT_SHARE = [0.24, 0.21, 0.17, 0.15, 0.13, 0.1];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RAIN = [78, 60, 55, 48, 52, 47, 45, 55, 58, 82, 88, 84];

/** Round a maximum up to a tidy value (1, 2, 2.5 or 5 times a power of ten), so axis ticks are round numbers. */
const niceCeil = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
};
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function initDataViz(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const verdictEl = root.querySelector<HTMLElement>('[data-verdict]')!;

  const st = { data: 'pair' as Dataset, chart: 'scatter' as Chart, n: 30, noise: 1, outlier: false, zero: true, trend: true, bins: 10 };

  function rng(seed: number) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  }
  const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-9))) * Math.cos(2 * Math.PI * r());

  /** Build the current dataset as labelled values (and x values for pairs). */
  function dataset() {
    const r = rng(42);
    if (st.data === 'pair') {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < st.n; i++) {
        const T = 12 + r() * 20;
        xs.push(T);
        ys.push(Math.max(0, 20 + 8 * T + gauss(r) * 25 * st.noise));
      }
      if (st.outlier) {
        xs.push(14);
        ys.push(420); // a festival day
      }
      return { xs, ys, labels: xs.map((x) => `${x.toFixed(0)}°`), unit: 'sales' };
    }
    if (st.data === 'time') {
      const ys = RAIN.map((v) => Math.max(5, v + gauss(r) * 8 * st.noise));
      if (st.outlier) ys[6] = 190; // a summer storm
      return { xs: ys.map((_, i) => i), ys, labels: MONTHS, unit: 'mm' };
    }
    if (st.data === 'values') {
      const ys: number[] = [];
      for (let i = 0; i < st.n; i++) ys.push(clamp(62 + gauss(r) * 12 * st.noise, 0, 100));
      if (st.outlier) ys.push(3);
      return { xs: ys.map((_, i) => i), ys, labels: ys.map((_, i) => `${i + 1}`), unit: 'marks' };
    }
    // categories: counts from n people choosing a fruit
    const counts = FRUITS.map(() => 0);
    for (let i = 0; i < st.n; i++) {
      let u = r() * (1 + (st.noise - 1) * 0.3);
      let k = 0;
      while (k < FRUITS.length - 1 && u > FRUIT_SHARE[k]) u -= FRUIT_SHARE[k++];
      counts[k]++;
    }
    if (st.outlier) counts[3] += Math.round(st.n * 0.5); // a mango-farm class visits
    return { xs: counts.map((_, i) => i), ys: counts, labels: FRUITS, unit: 'people' };
  }

  function stats(d: ReturnType<typeof dataset>) {
    const y = d.ys;
    const out: { mean: number; median: number; min: number; max: number; r?: number; slope?: number; icpt?: number } = { mean: mean(y), median: median(y), min: Math.min(...y), max: Math.max(...y) };
    if (st.data === 'pair') {
      const mx = mean(d.xs);
      const my = mean(y);
      let sxy = 0;
      let sxx = 0;
      let syy = 0;
      d.xs.forEach((x, i) => {
        sxy += (x - mx) * (y[i] - my);
        sxx += (x - mx) ** 2;
        syy += (y[i] - my) ** 2;
      });
      out.r = sxy / Math.sqrt(sxx * syy);
      out.slope = sxy / sxx;
      out.icpt = my - out.slope * mx;
    }
    return out;
  }

  /* ---------- Drawing (design box 1000 × 560) ---------- */
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
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    const d = dataset();
    const S = stats(d);
    const P = { x: 90, y: 60, w: 860, h: 400 };

    ctx.font = fs(15, 800);
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.fillText(DATASET_TITLE[st.data], P.x, 34);

    if (st.chart === 'pie') drawPie(d, P, fs);
    else {
      // y range: optionally truncated to exaggerate differences
      let yMin = 0;
      let yMax = st.chart === 'histogram' ? 0 : Math.max(...d.ys) * 1.1;
      let ys = d.ys;
      let labels = d.labels;
      let bars: { x0: number; x1: number; v: number }[] = [];
      if (st.chart === 'histogram') {
        const lo = st.data === 'pair' ? 0 : Math.floor(Math.min(...d.ys));
        const hi = Math.ceil(Math.max(...d.ys)) + 1e-6;
        const width = (hi - lo) / st.bins;
        bars = Array.from({ length: st.bins }, (_, i) => ({ x0: lo + i * width, x1: lo + (i + 1) * width, v: 0 }));
        for (const v of d.ys) bars[clamp(Math.floor((v - lo) / width), 0, st.bins - 1)].v++;
        yMax = Math.max(...bars.map((b) => b.v)) * 1.15;
      }
      yMax = niceCeil(yMax);
      if (!st.zero && st.chart !== 'histogram') yMin = Math.floor((Math.min(...d.ys) * 0.95) / (yMax / 10)) * (yMax / 10);
      const X = (i: number, n: number) => P.x + ((i + 0.5) / n) * P.w;
      const Y = (v: number) => P.y + P.h - ((v - yMin) / (yMax - yMin || 1)) * P.h;
      // axes and grid
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1 / k;
      ctx.font = fs(11, 600);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'right';
      for (let g = 0; g <= 5; g++) {
        const v = yMin + ((yMax - yMin) * g) / 5;
        const y = Y(v);
        ctx.beginPath();
        ctx.moveTo(P.x, y);
        ctx.lineTo(P.x + P.w, y);
        ctx.stroke();
        ctx.fillText(v >= 100 ? v.toFixed(0) : v.toFixed(v >= 10 ? 0 : 1), P.x - 8, y + 4);
      }
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      ctx.moveTo(P.x, P.y);
      ctx.lineTo(P.x, P.y + P.h);
      ctx.lineTo(P.x + P.w, P.y + P.h);
      ctx.stroke();
      if (!st.zero && st.chart !== 'histogram') {
        // zig-zag break to warn that the axis does not start at zero
        ctx.strokeStyle = pal.danger;
        ctx.beginPath();
        ctx.moveTo(P.x - 8, P.y + P.h - 14);
        ctx.lineTo(P.x + 8, P.y + P.h - 20);
        ctx.moveTo(P.x - 8, P.y + P.h - 6);
        ctx.lineTo(P.x + 8, P.y + P.h - 12);
        ctx.stroke();
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(P.x, P.y - 5, P.w + 5, P.h + 5);
      ctx.clip();
      const colour = pal.accent;
      if (st.chart === 'histogram') {
        const lo = bars[0].x0;
        const hi = bars[bars.length - 1].x1;
        bars.forEach((b) => {
          const x0 = P.x + ((b.x0 - lo) / (hi - lo)) * P.w;
          const x1 = P.x + ((b.x1 - lo) / (hi - lo)) * P.w;
          ctx.fillStyle = colour;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x0 + 1, Y(b.v), x1 - x0 - 2, P.y + P.h - Y(b.v));
          ctx.globalAlpha = 1;
        });
        // mean and median markers
        for (const [v, c, name] of [[S.mean, pal.danger, 'Mean'], [S.median, pal.success, 'Median']] as const) {
          const x = P.x + ((v - lo) / (hi - lo)) * P.w;
          ctx.strokeStyle = c;
          ctx.lineWidth = 3 / k;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(x, P.y);
          ctx.lineTo(x, P.y + P.h);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = fs(11, 750);
          ctx.fillStyle = c;
          ctx.textAlign = 'left';
          ctx.fillText(`${name} ${v.toFixed(1)}`, x + 5, P.y + (name === 'Mean' ? 14 : 30));
        }
        labels = bars.map((b) => `${b.x0.toFixed(0)}–${b.x1.toFixed(0)}`);
        ys = bars.map((b) => b.v);
      } else if (st.chart === 'scatter' && st.data === 'pair') {
        const xMin = 10;
        const xMax = 34;
        const SX = (x: number) => P.x + ((x - xMin) / (xMax - xMin)) * P.w;
        d.xs.forEach((x, i) => {
          ctx.fillStyle = st.outlier && i === d.xs.length - 1 ? pal.danger : colour;
          ctx.beginPath();
          ctx.arc(SX(x), Y(d.ys[i]), 6, 0, Math.PI * 2);
          ctx.fill();
        });
        if (st.trend && S.slope !== undefined) {
          ctx.strokeStyle = pal.warning;
          ctx.lineWidth = 3 / k;
          ctx.beginPath();
          ctx.moveTo(SX(xMin), Y(S.icpt! + S.slope * xMin));
          ctx.lineTo(SX(xMax), Y(S.icpt! + S.slope * xMax));
          ctx.stroke();
        }
        labels = [];
        for (let x = 10; x <= 34; x += 4) {
          ctx.font = fs(11, 600);
          ctx.fillStyle = pal['text-faint'];
          ctx.textAlign = 'center';
          ctx.fillText(`${x} °C`, SX(x), P.y + P.h + 18 / k);
        }
      } else {
        const n = ys.length;
        if (st.chart === 'bar') {
          const bw = (P.w / n) * 0.7;
          ys.forEach((v, i) => {
            ctx.fillStyle = colour;
            ctx.fillRect(X(i, n) - bw / 2, Y(v), bw, P.y + P.h - Y(v));
          });
        } else if (st.chart === 'line') {
          ctx.strokeStyle = colour;
          ctx.lineWidth = 3 / k;
          ctx.beginPath();
          ys.forEach((v, i) => (i ? ctx.lineTo(X(i, n), Y(v)) : ctx.moveTo(X(i, n), Y(v))));
          ctx.stroke();
          ys.forEach((v, i) => {
            ctx.fillStyle = colour;
            ctx.beginPath();
            ctx.arc(X(i, n), Y(v), 4, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          ys.forEach((v, i) => {
            ctx.fillStyle = colour;
            ctx.beginPath();
            ctx.arc(X(i, n), Y(v), 6, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
      ctx.restore();
      // x labels (thinned out when crowded)
      if (labels.length) {
        const n = labels.length;
        const every = Math.ceil(n / 14);
        ctx.font = fs(11, 600);
        ctx.fillStyle = pal['text-faint'];
        ctx.textAlign = 'center';
        labels.forEach((l, i) => {
          if (i % every === 0) ctx.fillText(l, X(i, n), P.y + P.h + 18 / k);
        });
      }
    }
    ctx.restore();
    updateReadouts(d, S);
  }

  function drawPie(d: ReturnType<typeof dataset>, P: { x: number; y: number; w: number; h: number }, fs: (n: number, w?: number) => string) {
    const total = d.ys.reduce((a, b) => a + b, 0) || 1;
    const cx = P.x + 260;
    const cy = P.y + P.h / 2;
    const r = 190;
    let a0 = -Math.PI / 2;
    const n = d.ys.length;
    d.ys.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      ctx.fillStyle = `hsl(${(i * 360) / n + 170}, 55%, ${45 + (i % 2) * 12}%)`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal['sim-bg'];
      ctx.lineWidth = n > 20 ? 0.5 : 2;
      ctx.stroke();
      a0 = a1;
    });
    // legend (first 12 slices)
    ctx.font = fs(11.5, 650);
    ctx.textAlign = 'left';
    d.ys.slice(0, 12).forEach((v, i) => {
      const y = P.y + 20 + i * 26;
      ctx.fillStyle = `hsl(${(i * 360) / n + 170}, 55%, ${45 + (i % 2) * 12}%)`;
      ctx.fillRect(P.x + 520, y - 10, 14, 14);
      ctx.fillStyle = pal['sim-text'];
      ctx.fillText(`${d.labels[i]}: ${v.toFixed(0)} (${((v / total) * 100).toFixed(0)}%)`, P.x + 542, y + 2);
    });
    if (n > 12) {
      ctx.fillStyle = pal['text-faint'];
      ctx.fillText(`…and ${n - 12} more slices`, P.x + 520, P.y + 20 + 12 * 26);
    }
  }

  function updateReadouts(d: ReturnType<typeof dataset>, S: ReturnType<typeof stats>) {
    const [good, why] = VERDICT[st.data][st.chart];
    verdictEl.textContent = why;
    verdictEl.dataset.good = String(good);
    ui.readout('verdict', good ? 'Good choice for this data' : 'Poor choice for this data', good ? 'ok' : 'bad');
    sim.setBadge(good ? 'Good chart' : 'Poor chart');
    ui.readout('n', `${d.ys.length}`);
    ui.readout('centre', `mean ${S.mean.toFixed(1)}, median ${S.median.toFixed(1)}${Math.abs(S.mean - S.median) > 0.08 * Math.abs(S.median) ? ' (an outlier is pulling the mean)' : ''}`);
    ui.readout('range', `${S.min.toFixed(0)} to ${S.max.toFixed(0)} ${d.unit}`);
    if (S.r !== undefined) {
      const r = S.r;
      const word = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : Math.abs(r) > 0.2 ? 'weak' : 'no clear';
      ui.readout('r', `r = ${r.toFixed(2)}: ${word} ${r > 0 ? 'positive' : 'negative'} correlation`);
    } else ui.readout('r', 'Only for paired data (ice cream vs temperature)');
    const lo = Math.min(...d.ys);
    const hi = Math.max(...d.ys);
    // same axis limits as the chart uses
    const top = niceCeil(hi * 1.1);
    const bottom = Math.floor((lo * 0.95) / (top / 10)) * (top / 10);
    const exaggeration = !st.zero && st.chart !== 'histogram' && st.chart !== 'pie' ? (hi - lo) / (top - bottom) / ((hi - lo) / top) : 1;
    ui.readout('axis', st.zero || st.chart === 'pie' || st.chart === 'histogram' ? 'Starts at zero: bar heights are fair' : `Truncated: differences look about ${exaggeration.toFixed(1)} × bigger than they are`, st.zero ? null : 'warn');
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const best: Record<Dataset, Chart> = { pair: 'scatter', time: 'line', values: 'histogram', categories: 'bar' };
  const dataCtl = ui.choice<Dataset>('dv-data', (v) => {
    st.data = v;
    chartCtl.set(best[v]);
    ui.showWhen('[data-pair-only]', v === 'pair');
    sim.requestRender();
  });
  const chartCtl = ui.choice<Chart>('dv-chart', (v) => {
    st.chart = v;
    ui.showWhen('[data-hist-only]', v === 'histogram');
    sim.requestRender();
  });
  const nCtl = ui.range('dv-n', (v) => `${v}`, (v) => ((st.n = v), sim.requestRender()));
  const noiseCtl = ui.range('dv-noise', (v) => (v < 0.5 ? 'Low' : v < 1.5 ? 'Medium' : 'High'), (v) => ((st.noise = v), sim.requestRender()));
  const binsCtl = ui.range('dv-bins', (v) => `${v} bins`, (v) => ((st.bins = v), sim.requestRender()));
  const outCtl = ui.toggle('dv-outlier', (v) => ((st.outlier = v), sim.requestRender()));
  const zeroCtl = ui.toggle('dv-zero', (v) => ((st.zero = v), sim.requestRender()));
  const trendCtl = ui.toggle('dv-trend', (v) => ((st.trend = v), sim.requestRender()));
  ui.showWhen('[data-hist-only]', false);

  const sim = createSimController(root, {
    render,
    reset() {
      Object.assign(st, { data: 'pair', chart: 'scatter', n: 30, noise: 1, outlier: false, zero: true, trend: true, bins: 10 });
      dataCtl.set('pair', false);
      chartCtl.set('scatter', false);
      nCtl.set(30, false);
      noiseCtl.set(1, false);
      binsCtl.set(10, false);
      outCtl.set(false, false);
      zeroCtl.set(true, false);
      trendCtl.set(true, false);
      ui.showWhen('[data-pair-only]', true);
      ui.showWhen('[data-hist-only]', false);
    },
  });
  sim.requestRender();
}
