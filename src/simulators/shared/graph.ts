/**
 * LineGraph — a small, dependency-free chart for simulators.
 *
 * Supports line series (time series, function plots), point series
 * (measurements), dashed reference lines, an auto-extending x axis,
 * end markers and a legend. Colours are design-token names such as
 * "accent" or "accent-2", so graphs follow light and dark mode.
 *
 *   const g = new LineGraph(canvas, { x: { min: 0, span: 30, label: 's' }, y: { min: 0, max: 2, step: 0.5 } });
 *   g.set('run', { label: 'Current run', color: 'accent', points });
 *   g.draw();
 */
import { fitCanvas } from './index';

export interface Point {
  x: number;
  y: number;
}

export interface Series {
  label: string;
  /** Design token (e.g. "accent") or any CSS colour. */
  color: string;
  points: Point[];
  type?: 'line' | 'points';
  width?: number;
  dash?: number[];
  /** Text drawn at the last point, e.g. "✕". */
  endMarker?: string;
  /** Hide from the legend. */
  legend?: boolean;
}

export interface AxisX {
  min: number;
  /** Minimum visible span; the axis grows in `step`s as data extends past it. */
  span: number;
  /** Fixed maximum instead of auto-extending. */
  max?: number;
  step?: number;
  label?: string;
  format?: (v: number) => string;
}

export interface AxisY {
  min: number;
  max: number;
  step: number;
  label?: string;
  format?: (v: number) => string;
}

export interface RefLine {
  value: number;
  label: string;
  color: string;
  axis?: 'x' | 'y';
}

export interface GraphOptions {
  x: AxisX;
  y: AxisY;
  refs?: RefLine[];
}

const cssColor = (token: string, cs: CSSStyleDeclaration) =>
  /^(#|rgb|hsl)/.test(token) ? token : cs.getPropertyValue(`--${token}`).trim() || token;

export class LineGraph {
  private ctx: CanvasRenderingContext2D;
  private size: { w: number; h: number };
  private series = new Map<string, Series>();
  opts: GraphOptions;

  constructor(canvas: HTMLCanvasElement, opts: GraphOptions) {
    this.opts = opts;
    const fit = fitCanvas(canvas, () => this.draw());
    this.ctx = fit.ctx;
    this.size = fit.size;
    window.addEventListener('themechange', () => requestAnimationFrame(() => this.draw()));
  }

  set(id: string, s: Series) {
    this.series.set(id, s);
  }
  get(id: string) {
    return this.series.get(id);
  }
  remove(id: string) {
    this.series.delete(id);
  }
  clear() {
    this.series.clear();
  }
  ids() {
    return [...this.series.keys()];
  }

  /** Sample a function into points across the current x range. */
  static sample(fn: (x: number) => number, x0: number, x1: number, n = 300): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = fn(x);
      if (Number.isFinite(y)) pts.push({ x, y });
    }
    return pts;
  }

  xMax() {
    const { x } = this.opts;
    if (x.max !== undefined) return x.max;
    const step = x.step ?? 10;
    let dataMax = x.min;
    for (const s of this.series.values()) {
      const last = s.points[s.points.length - 1];
      if (last && last.x > dataMax) dataMax = last.x;
    }
    return Math.max(x.min + x.span, Math.ceil(dataMax / step) * step);
  }

  draw() {
    const g = this.ctx;
    const { w, h } = this.size;
    const cs = getComputedStyle(document.documentElement);
    const col = (t: string) => cssColor(t, cs);
    const { x: ax, y: ay } = this.opts;
    g.clearRect(0, 0, w, h);

    const pad = { l: 50, r: 14, t: 12, b: 30 };
    const pw = Math.max(1, w - pad.l - pad.r);
    const ph = Math.max(1, h - pad.t - pad.b);
    const x0 = ax.min;
    const x1 = this.xMax();
    const X = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * pw;
    const Y = (v: number) => pad.t + (1 - (v - ay.min) / (ay.max - ay.min)) * ph;
    const fx = ax.format ?? ((v: number) => `${+v.toFixed(2)}${ax.label ?? ''}`);
    const fy = ay.format ?? ((v: number) => `${+v.toFixed(2)}${ay.label ?? ''}`);

    g.font = '11px "JetBrains Mono Variable", ui-monospace, monospace';
    g.lineWidth = 1;
    g.strokeStyle = col('sim-grid');
    g.fillStyle = col('text-faint');

    // Horizontal grid + y labels
    for (let v = ay.min; v <= ay.max + 1e-9; v += ay.step) {
      const y = Y(v);
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(w - pad.r, y);
      g.stroke();
      g.textAlign = 'right';
      g.fillText(fy(v), pad.l - 6, y + 4);
    }
    // x labels
    const span = x1 - x0;
    const raw = span / Math.max(2, Math.floor(pw / 70));
    const mag = 10 ** Math.floor(Math.log10(raw));
    const tick = [1, 2, 5, 10].map((m) => m * mag).find((t) => t >= raw) ?? raw;
    g.textAlign = 'center';
    for (let v = Math.ceil(x0 / tick) * tick; v <= x1 + 1e-9; v += tick) {
      const x = X(v);
      g.beginPath();
      g.moveTo(x, pad.t);
      g.lineTo(x, pad.t + ph);
      g.globalAlpha = 0.5;
      g.stroke();
      g.globalAlpha = 1;
      g.fillText(fx(v), x, h - 10);
    }
    g.textAlign = 'left';

    // Zero line, if inside the range
    if (ay.min < 0 && ay.max > 0) {
      g.strokeStyle = col('border-strong');
      g.beginPath();
      g.moveTo(pad.l, Y(0));
      g.lineTo(w - pad.r, Y(0));
      g.stroke();
    }

    // Reference lines
    for (const r of this.opts.refs ?? []) {
      const c = col(r.color);
      g.save();
      g.setLineDash([5, 5]);
      g.strokeStyle = c;
      g.beginPath();
      if (r.axis === 'x') {
        g.moveTo(X(r.value), pad.t);
        g.lineTo(X(r.value), pad.t + ph);
      } else {
        g.moveTo(pad.l, Y(r.value));
        g.lineTo(w - pad.r, Y(r.value));
      }
      g.stroke();
      g.restore();
      g.fillStyle = c;
      if (r.axis === 'x') g.fillText(r.label, X(r.value) + 4, pad.t + 12);
      else g.fillText(r.label, pad.l + 6, Y(r.value) - 4);
    }

    // Series (clip to the plot area)
    g.save();
    g.beginPath();
    g.rect(pad.l, pad.t - 2, pw, ph + 4);
    g.clip();
    for (const s of this.series.values()) {
      if (!s.points.length) continue;
      const c = col(s.color);
      g.strokeStyle = c;
      g.fillStyle = c;
      if (s.type === 'points') {
        for (const p of s.points) {
          g.beginPath();
          g.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2);
          g.fill();
        }
        continue;
      }
      g.lineWidth = s.width ?? 2.5;
      g.setLineDash(s.dash ?? []);
      g.lineJoin = 'round';
      g.beginPath();
      s.points.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
    for (const s of this.series.values()) {
      const last = s.points[s.points.length - 1];
      if (!s.endMarker || !last) continue;
      g.fillStyle = col('danger');
      g.font = 'bold 14px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(s.endMarker, X(last.x), Y(last.y) + 5);
      g.textAlign = 'left';
    }
  }

  /** Render the legend into a <ul> (e.g. GraphPanel's [data-legend]). */
  renderLegend(ul: HTMLElement | null) {
    if (!ul) return;
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    ul.innerHTML = [...this.series.values()]
      .filter((s) => s.legend !== false)
      .map((s) => {
        const color = /^(#|rgb|hsl)/.test(s.color) ? s.color : `var(--${s.color})`;
        return `<li><span class="swatch${s.type === 'points' ? ' dot' : ''}" style="background:${color}"></span>${esc(s.label)}</li>`;
      })
      .join('');
  }
}

/**
 * Keeps up to `max` saved runs on a graph for comparison, wired to the
 * Save / Clear buttons of a <GraphPanel compare>.
 */
export function runComparer(
  panel: HTMLElement,
  graph: LineGraph,
  opts: {
    currentId: string;
    label: () => string;
    onSave?: () => void;
    colors?: string[];
    max?: number;
  },
) {
  const colors = opts.colors ?? ['accent-2', 'warning', 'text-faint'];
  const max = opts.max ?? 3;
  const saved: string[] = [];
  const saveBtn = panel.querySelector<HTMLButtonElement>('[data-save]');
  const clearBtn = panel.querySelector<HTMLButtonElement>('[data-clear]');
  const legend = panel.querySelector<HTMLElement>('[data-legend]');
  let counter = 0;

  const refresh = () => {
    saved.forEach((id, i) => {
      const s = graph.get(id);
      if (s) s.color = colors[i % colors.length];
    });
    if (clearBtn) clearBtn.disabled = saved.length === 0;
    graph.renderLegend(legend);
    graph.draw();
  };

  saveBtn?.addEventListener('click', () => {
    const cur = graph.get(opts.currentId);
    if (!cur || cur.points.length < 2) return;
    const id = `saved-${++counter}`;
    graph.set(id, { ...cur, points: [...cur.points], label: opts.label(), width: 2 });
    saved.push(id);
    if (saved.length > max) graph.remove(saved.shift()!);
    opts.onSave?.();
    refresh();
  });
  clearBtn?.addEventListener('click', () => {
    saved.splice(0).forEach((id) => graph.remove(id));
    refresh();
  });

  return { refresh, get count() {
    return saved.length;
  } };
}
