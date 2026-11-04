/**
 * Graphing functions with transformations: y = a·f(b(x − h)) + k.
 */
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { LineGraph, runComparer, type Point } from '../shared/graph';

type Family = 'linear' | 'quad' | 'abs' | 'sqrt' | 'sin' | 'exp' | 'recip';
const PARENT: Record<Family, { f: (x: number) => number; name: string }> = {
  linear: { f: (x) => x, name: 'x' },
  quad: { f: (x) => x * x, name: 'u²' },
  abs: { f: (x) => Math.abs(x), name: '|u|' },
  sqrt: { f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), name: '√u' },
  sin: { f: (x) => Math.sin(x), name: 'sin(u)' },
  exp: { f: (x) => 2 ** x, name: '2^u' },
  recip: { f: (x) => (x === 0 ? NaN : 1 / x), name: '1/u' },
};
const DEF = { a: 1, b: 1, h: 0, k: 0 };
const R = 10; // view is −10…10 on both axes

export function initFunctions(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-plot]')!;
  const family = root.querySelector<HTMLSelectElement>('[data-family]')!;
  const p = { fam: 'quad' as Family, ...DEF, trace: 2, parent: true };
  family.value = p.fam;

  const graph = new LineGraph(canvas, {
    x: { min: -R, span: 2 * R, max: R, format: (v) => `${v}` },
    y: { min: -R, max: R, step: 2 },
  });

  const f = (x: number) => p.a * PARENT[p.fam].f(p.b * (x - p.h)) + p.k;
  const num = (v: number) => (Math.abs(v) < 0.005 ? '0' : (+v.toFixed(2)).toString().replace('-', '−'));
  const signed = (v: number) => (v < 0 ? ` − ${num(-v)}` : v > 0 ? ` + ${num(v)}` : '');

  function equation() {
    if (p.fam === 'linear') {
      // a·b·(x − h) + k  →  slope m = a·b, intercept c = −a·b·h + k
      const m = p.a * p.b;
      return `y = ${num(m)}x${signed(-m * p.h + p.k)}`;
    }
    // Inner expression u = b(x − h), written as simply as possible
    const xh = p.h === 0 ? 'x' : `(x${signed(-p.h)})`;
    const bPart = p.b === 1 ? '' : p.b === -1 ? '−' : num(p.b);
    const u = p.b === 1 ? (p.h === 0 ? 'x' : `x${signed(-p.h)}`) : `${bPart}${xh}`;
    const simple = u === 'x';
    const bodies: Record<Family, string> = {
      linear: '',
      quad: simple ? 'x²' : `(${u})²`,
      abs: `|${u}|`,
      sqrt: simple ? '√x' : `√(${u})`,
      sin: `sin(${u})`,
      exp: simple ? '2ˣ' : `2^(${u})`,
      recip: simple ? '1/x' : `1/(${u})`,
    };
    const body = bodies[p.fam];
    const lead = p.a === 1 ? '' : p.a === -1 ? '−' : `${num(p.a)}·`;
    return `y = ${lead}${body}${signed(p.k)}`;
  }

  /** Sample a function into continuous segments (breaks at gaps and asymptotes). */
  function segments(fn: (x: number) => number): Point[][] {
    const out: Point[][] = [];
    let cur: Point[] = [];
    const n = 800;
    let prev: Point | null = null;
    for (let i = 0; i <= n; i++) {
      const x = -R + (2 * R * i) / n;
      const y = fn(x);
      const ok = Number.isFinite(y) && Math.abs(y) < 1e3;
      if (!ok || (prev && Math.abs(y - prev.y) > 3 * R)) {
        if (cur.length > 1) out.push(cur);
        cur = [];
        prev = null;
        if (!ok) continue;
      }
      const pt = { x, y };
      cur.push(pt);
      prev = pt;
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }

  function roots(): number[] {
    const r: number[] = [];
    const n = 4000;
    let px = -R;
    let py = f(px);
    for (let i = 1; i <= n; i++) {
      const x = -R + (2 * R * i) / n;
      const y = f(x);
      if (Number.isFinite(py) && Number.isFinite(y)) {
        if (y === 0) r.push(x);
        else if (py * y < 0 && Math.abs(y - py) < 5) r.push(px - (py * (x - px)) / (y - py));
      }
      px = x;
      py = y;
    }
    // De-duplicate
    return r.filter((v, i) => i === 0 || Math.abs(v - r[i - 1]) > 0.05);
  }

  function feature(): string {
    const { a, b, h, k } = p;
    switch (p.fam) {
      case 'linear':
        return `Slope ${num(a * b)}`;
      case 'quad':
        return `Vertex (${num(h)}, ${num(k)}) · opens ${a * 1 > 0 ? 'up' : a < 0 ? 'down' : '—'}`;
      case 'abs':
        return `Vertex (${num(h)}, ${num(k)})`;
      case 'sqrt':
        return `Starts at (${num(h)}, ${num(k)})`;
      case 'sin':
        return `Amplitude ${num(Math.abs(a))} · period ${b === 0 ? '∞' : num((2 * Math.PI) / Math.abs(b))}`;
      case 'exp':
        return `Horizontal asymptote y = ${num(k)}`;
      case 'recip':
        return `Asymptotes x = ${num(h)}, y = ${num(k)}`;
    }
  }

  function domainRange(): string {
    const { a, b, h, k } = p;
    if (a === 0 || b === 0) return `All x / y = ${num(a === 0 ? k : a * PARENT[p.fam].f(0) + k)}`;
    switch (p.fam) {
      case 'linear':
        return 'All x / all y';
      case 'quad':
      case 'abs':
        return `All x / y ${a > 0 ? '≥' : '≤'} ${num(k)}`;
      case 'sqrt':
        return `x ${b > 0 ? '≥' : '≤'} ${num(h)} / y ${a > 0 ? '≥' : '≤'} ${num(k)}`;
      case 'sin':
        return `All x / ${num(k - Math.abs(a))} ≤ y ≤ ${num(k + Math.abs(a))}`;
      case 'exp':
        return `All x / y ${a > 0 ? '>' : '<'} ${num(k)}`;
      case 'recip':
        return `x ≠ ${num(h)} / y ≠ ${num(k)}`;
    }
  }

  function render() {
    for (const id of graph.ids()) if (id.startsWith('cur') || id.startsWith('parent') || id === 'trace') graph.remove(id);
    if (p.parent) {
      segments(PARENT[p.fam].f).forEach((pts, i) =>
        graph.set(`parent-${i}`, { label: 'Parent function', color: 'text-faint', points: pts, width: 1.5, dash: [6, 5], legend: i === 0 }),
      );
    }
    segments(f).forEach((pts, i) => graph.set(`cur-${i}`, { label: equation(), color: 'accent', points: pts, legend: i === 0 }));
    const ty = f(p.trace);
    if (Number.isFinite(ty)) graph.set('trace', { label: 'Trace point', color: 'sim-solute', points: [{ x: p.trace, y: ty }], type: 'points' });
    // Asymptote reference lines
    graph.opts.refs =
      p.fam === 'recip'
        ? [
            { value: p.h, label: `x = ${num(p.h)}`, color: 'accent-2', axis: 'x' },
            { value: p.k, label: `y = ${num(p.k)}`, color: 'accent-2' },
          ]
        : p.fam === 'exp'
          ? [{ value: p.k, label: `y = ${num(p.k)}`, color: 'accent-2' }]
          : [];
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend]'));

    const xr = roots();
    const y0 = f(0);
    ui.readout('eq', equation());
    ui.readout('point', Number.isFinite(ty) ? `(${num(p.trace)}, ${num(ty)})` : `undefined at x = ${num(p.trace)}`);
    ui.readout('yint', Number.isFinite(y0) ? `(0, ${num(y0)})` : 'None');
    ui.readout('xint', xr.length === 0 ? 'None in view' : xr.length > 4 ? `${xr.length} in view` : xr.map((r) => num(r)).join(', '));
    ui.readout('feature', feature());
    ui.readout('domain', domainRange());
    canvas.setAttribute('aria-label', `Graph of ${equation()}. ${feature()}. y-intercept ${Number.isFinite(y0) ? num(y0) : 'none'}.`);
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const upd = () => sim.requestRender();
  const ctl = {
    a: ui.range('fx-a', (v) => v.toFixed(1), (v) => ((p.a = v), upd())),
    b: ui.range('fx-b', (v) => v.toFixed(1), (v) => ((p.b = v), upd())),
    h: ui.range('fx-h', (v) => v.toFixed(1), (v) => ((p.h = v), upd())),
    k: ui.range('fx-k', (v) => v.toFixed(1), (v) => ((p.k = v), upd())),
  };
  const traceCtl = ui.range('fx-trace', (v) => v.toFixed(1), (v) => ((p.trace = v), upd()));
  ui.toggle('fx-parent', (v) => ((p.parent = v), upd()));
  family.addEventListener('change', () => {
    p.fam = family.value as Family;
    upd();
  });

  const comparer = runComparer(root, graph, {
    currentId: 'cur-0',
    label: equation,
    colors: ['accent-2', 'warning', 'sim-membrane'],
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    // Matches LineGraph padding (l 50, r 14, t 12, b 30)
    const x = -R + ((e.clientX - r.left - 50) / (r.width - 64)) * 2 * R;
    const y = R - ((e.clientY - r.top - 12) / (r.height - 42)) * 2 * R;
    const fy = f(x);
    sim.showTooltip(
      e.clientX - r.left,
      e.clientY - r.top,
      `(${num(x)}, ${num(y)})`,
      Number.isFinite(fy) ? `On the curve at x = ${num(x)}, y = ${num(fy)}.` : `The function is undefined at x = ${num(x)}.`,
    );
  });

  const sim = createSimController(root, {
    render,
    reset() {
      (Object.keys(ctl) as (keyof typeof ctl)[]).forEach((key) => ctl[key].set(DEF[key], false));
      Object.assign(p, DEF, { fam: 'quad', trace: 2 });
      traceCtl.set(2, false);
      family.value = 'quad';
    },
  });
  comparer.refresh();
  sim.requestRender();
}
