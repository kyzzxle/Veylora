import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { LineGraph, runComparer } from '../shared/graph';

type Kind = 'sin' | 'quad';
const DEFAULTS = { a: 1, b: 1, c: 0, d: 0 };

export function initGraphTemplate(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-plot]')!;
  const p = { kind: 'sin' as Kind, ...DEFAULTS };

  const graph = new LineGraph(canvas, {
    x: { min: -2 * Math.PI, span: 4 * Math.PI, max: 2 * Math.PI, format: (v) => v.toFixed(1) },
    y: { min: -6, max: 6, step: 2 },
  });

  const f = (x: number) => (p.kind === 'sin' ? p.a * Math.sin(p.b * x + p.c) + p.d : p.a * (x - p.c) ** 2 + p.d);
  const fmt = (v: number) => (v < 0 ? `− ${Math.abs(v).toFixed(1)}` : `+ ${v.toFixed(1)}`);
  const equation = () =>
    p.kind === 'sin'
      ? `y = ${p.a.toFixed(1)}·sin(${p.b.toFixed(1)}x ${fmt(p.c)}) ${fmt(p.d)}`
      : `y = ${p.a.toFixed(1)}(x ${fmt(-p.c)})² ${fmt(p.d)}`;

  const ui = controls(root);
  // Update the curve immediately so "Keep this curve" always saves what is shown.
  const syncCurve = () =>
    graph.set('current', { label: 'Current function', color: 'accent', points: LineGraph.sample(f, -2 * Math.PI, 2 * Math.PI) });
  const update = () => {
    syncCurve();
    sim.requestRender();
  };
  const ctl = {
    a: ui.range('fn-a', (v) => v.toFixed(1), (v) => ((p.a = v), update())),
    b: ui.range('fn-b', (v) => v.toFixed(1), (v) => ((p.b = v), update())),
    c: ui.range('fn-c', (v) => v.toFixed(1), (v) => ((p.c = v), update())),
    d: ui.range('fn-d', (v) => v.toFixed(1), (v) => ((p.d = v), update())),
  };
  const kind = ui.choice<Kind>('fn-kind', (v) => ((p.kind = v), update()));

  const comparer = runComparer(root, graph, { currentId: 'current', label: equation });

  function render() {
    syncCurve();
    graph.draw();
    graph.renderLegend(root.querySelector('[data-legend]'));
    ui.readout('eq', equation());
    if (p.kind === 'sin') {
      ui.readout('f1', `Amplitude ${Math.abs(p.a).toFixed(1)}`);
      ui.readout('f2', `Period ${((2 * Math.PI) / p.b).toFixed(2)}`);
    } else {
      ui.readout('f1', `Vertex (${p.c.toFixed(1)}, ${p.d.toFixed(1)})`);
      ui.readout('f2', p.a > 0 ? 'Opens upward' : p.a < 0 ? 'Opens downward' : 'Flat line (a = 0)');
    }
    canvas.setAttribute('aria-label', `Graph of ${equation()}`);
  }

  const sim = createSimController(root, {
    render,
    reset() {
      Object.assign(p, DEFAULTS, { kind: 'sin' });
      kind.set('sin', false);
      (Object.keys(ctl) as (keyof typeof ctl)[]).forEach((k) => ctl[k].set(DEFAULTS[k], false));
    },
  });
  comparer.refresh();
  sim.requestRender();
}
