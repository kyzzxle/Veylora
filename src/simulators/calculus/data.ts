/** Preset functions for the calculus lab. Exact derivatives and antiderivatives are given only where they are known in closed form. */

export type View4 = [number, number, number, number]; // x0, x1, y0, y1
export interface Preset {
  name: string;
  /** Formula as shown, using the current a and b. */
  tex: (a: number, b: number) => string;
  f: (x: number, a: number, b: number) => number;
  df?: (x: number, a: number, b: number) => number;
  dtex?: (a: number, b: number) => string;
  /** An antiderivative, valid on any interval that avoids `sing`. */
  F?: (x: number, a: number, b: number) => number;
  Ftex?: (a: number, b: number) => string;
  /** x-values where f is unbounded (the integral across them is improper). */
  sing?: number[];
  /** x-values where f′ does not exist although f is defined (corners, cusps, jumps). */
  nodiff?: number[];
  /** Points to mark: open circles (holes) and filled dots (the actual value). */
  holes?: (a: number, b: number) => [number, number][];
  dots?: (a: number, b: number) => [number, number][];
  uses: ('a' | 'b')[];
  def: { a: number; b: number };
  view: View4;
  target?: number;
  kind: string;
}

const n = (v: number) => (Math.abs(v) < 1e-9 ? '0' : (+v.toFixed(2)).toString().replace('-', '−'));
const coef = (v: number, s: string) => (v === 1 ? s : v === -1 ? `−${s}` : `${n(v)}${s}`);
const plus = (v: number, s = '') => (v === 0 ? '' : v < 0 ? ` − ${n(-v)}${s}` : ` + ${n(v)}${s}`);

export const PRESETS: Record<string, Preset> = {
  linear: {
    name: 'Linear: a·x + b',
    kind: 'linear',
    tex: (a, b) => `f(x) = ${coef(a, 'x')}${plus(b)}`,
    f: (x, a, b) => a * x + b,
    df: (_x, a) => a,
    dtex: (a) => `f′(x) = ${n(a)}`,
    F: (x, a, b) => (a * x * x) / 2 + b * x,
    Ftex: (a, b) => `F(x) = ${coef(a / 2, 'x²')}${plus(b, 'x')} + C`,
    uses: ['a', 'b'],
    def: { a: 1, b: 1 },
    view: [-5, 5, -4, 6],
  },
  quad: {
    name: 'Quadratic: a·x² + b',
    kind: 'quadratic',
    tex: (a, b) => `f(x) = ${coef(a, 'x²')}${plus(b)}`,
    f: (x, a, b) => a * x * x + b,
    df: (x, a) => 2 * a * x,
    dtex: (a) => `f′(x) = ${coef(2 * a, 'x')}`,
    F: (x, a, b) => (a * x ** 3) / 3 + b * x,
    Ftex: (a, b) => `F(x) = ${coef(+(a / 3).toFixed(3), 'x³')}${plus(b, 'x')} + C`,
    uses: ['a', 'b'],
    def: { a: 1, b: 0 },
    view: [-4, 4, -2, 10],
  },
  cubic: {
    name: 'Cubic: x³ − a·x',
    kind: 'cubic',
    tex: (a) => `f(x) = x³${plus(-a, 'x')}`,
    f: (x, a) => x ** 3 - a * x,
    df: (x, a) => 3 * x * x - a,
    dtex: (a) => `f′(x) = 3x²${plus(-a)}`,
    F: (x, a) => x ** 4 / 4 - (a * x * x) / 2,
    Ftex: (a) => `F(x) = x⁴/4${plus(-a / 2, 'x²')} + C`,
    uses: ['a'],
    def: { a: 3, b: 0 },
    view: [-3.5, 3.5, -6, 6],
  },
  poly: {
    name: 'Polynomial: x⁴/4 − 2x² + b',
    kind: 'polynomial',
    tex: (_a, b) => `f(x) = x⁴/4 − 2x²${plus(b)}`,
    f: (x, _a, b) => x ** 4 / 4 - 2 * x * x + b,
    df: (x) => x ** 3 - 4 * x,
    dtex: () => 'f′(x) = x³ − 4x',
    F: (x, _a, b) => x ** 5 / 20 - (2 * x ** 3) / 3 + b * x,
    Ftex: (_a, b) => `F(x) = x⁵/20 − 2x³/3${plus(b, 'x')} + C`,
    uses: ['b'],
    def: { a: 1, b: 0 },
    view: [-3.5, 3.5, -6, 6],
  },
  exp: {
    name: 'Exponential: e^(a·x)',
    kind: 'exponential',
    tex: (a) => `f(x) = e^(${coef(a, 'x')})`,
    f: (x, a) => Math.exp(a * x),
    df: (x, a) => a * Math.exp(a * x),
    dtex: (a) => `f′(x) = ${a === 1 ? '' : `${n(a)}·`}e^(${coef(a, 'x')})`,
    F: (x, a) => (a === 0 ? x : Math.exp(a * x) / a),
    Ftex: (a) => (a === 0 ? 'F(x) = x + C' : `F(x) = ${a === 1 ? '' : `(1/${n(a)})·`}e^(${coef(a, 'x')}) + C`),
    uses: ['a'],
    def: { a: 1, b: 0 },
    view: [-4, 3, -1, 8],
  },
  sin: {
    name: 'Sine: a·sin(b·x)',
    kind: 'trigonometric',
    tex: (a, b) => `f(x) = ${a === 1 ? '' : a === -1 ? '−' : n(a)}sin(${coef(b, 'x')})`,
    f: (x, a, b) => a * Math.sin(b * x),
    df: (x, a, b) => a * b * Math.cos(b * x),
    dtex: (a, b) => `f′(x) = ${coef(+(a * b).toFixed(3), '')}cos(${coef(b, 'x')})`.replace('= cos', '= cos'),
    F: (x, a, b) => (b === 0 ? 0 : (-a / b) * Math.cos(b * x)),
    Ftex: (a, b) => (b === 0 ? 'F(x) = C' : `F(x) = ${coef(+(-a / b).toFixed(3), '')}cos(${coef(b, 'x')}) + C`),
    uses: ['a', 'b'],
    def: { a: 1, b: 1 },
    view: [-7, 7, -3, 3],
  },
  abs: {
    name: 'Corner: |x|',
    kind: 'absolute value',
    tex: () => 'f(x) = |x|',
    f: (x) => Math.abs(x),
    df: (x) => (x === 0 ? NaN : Math.sign(x)),
    dtex: () => 'f′(x) = −1 for x < 0, 1 for x > 0, undefined at 0',
    F: (x) => (x * Math.abs(x)) / 2,
    Ftex: () => 'F(x) = x·|x|/2 + C',
    nodiff: [0],
    uses: [],
    def: { a: 1, b: 0 },
    view: [-4, 4, -1.5, 4.5],
  },
  cusp: {
    name: 'Cusp: x^(2/3)',
    kind: 'cusp',
    tex: () => 'f(x) = x^(2/3)',
    f: (x) => Math.cbrt(x) ** 2,
    df: (x) => (x === 0 ? NaN : 2 / (3 * Math.cbrt(x))),
    dtex: () => 'f′(x) = 2 / (3·x^(1/3)), undefined at 0',
    F: (x) => 0.6 * Math.cbrt(x) ** 5,
    Ftex: () => 'F(x) = (3/5)·x^(5/3) + C',
    nodiff: [0],
    uses: [],
    def: { a: 1, b: 0 },
    view: [-4, 4, -1, 3],
  },
  hole: {
    name: 'Removable hole: (x² − 1)/(x − 1)',
    kind: 'removable discontinuity',
    tex: () => 'f(x) = (x² − 1)/(x − 1)',
    f: (x) => (x * x - 1) / (x - 1),
    df: (x) => (x === 1 ? NaN : 1),
    dtex: () => 'f′(x) = 1 for x ≠ 1',
    F: (x) => (x * x) / 2 + x,
    Ftex: () => 'F(x) = x²/2 + x + C (for x ≠ 1)',
    nodiff: [1],
    holes: () => [[1, 2]],
    uses: [],
    def: { a: 1, b: 0 },
    view: [-3, 4, -2, 5],
    target: 1,
  },
  holeval: {
    name: 'Hole with a different value: f(1) = 3',
    kind: 'removable discontinuity',
    tex: () => 'f(x) = (x² − 1)/(x − 1) for x ≠ 1, f(1) = 3',
    f: (x) => (x === 1 ? 3 : (x * x - 1) / (x - 1)),
    df: (x) => (x === 1 ? NaN : 1),
    dtex: () => 'f′(x) = 1 for x ≠ 1',
    F: (x) => (x * x) / 2 + x,
    Ftex: () => 'F(x) = x²/2 + x + C (one point does not change an integral)',
    nodiff: [1],
    holes: () => [[1, 2]],
    dots: () => [[1, 3]],
    uses: [],
    def: { a: 1, b: 0 },
    view: [-3, 4, -2, 5],
    target: 1,
  },
  jump: {
    name: 'Jump: x² for x < 1, x + 2 for x ≥ 1',
    kind: 'jump discontinuity',
    tex: () => 'f(x) = x² (x < 1), x + 2 (x ≥ 1)',
    f: (x) => (x < 1 ? x * x : x + 2),
    df: (x) => (x === 1 ? NaN : x < 1 ? 2 * x : 1),
    dtex: () => 'f′(x) = 2x (x < 1), 1 (x > 1), undefined at 1',
    F: (x) => (x < 1 ? x ** 3 / 3 : 1 / 3 + (x * x) / 2 + 2 * x - 2.5),
    Ftex: () => 'F(x) = x³/3 (x < 1), x²/2 + 2x − 13/6 (x ≥ 1)',
    nodiff: [1],
    holes: () => [[1, 1]],
    dots: () => [[1, 3]],
    uses: [],
    def: { a: 1, b: 0 },
    view: [-3, 4, -1, 6],
    target: 1,
  },
  inv2: {
    name: 'Infinite limit: 1/(x − 2)²',
    kind: 'vertical asymptote',
    tex: () => 'f(x) = 1/(x − 2)²',
    f: (x) => 1 / (x - 2) ** 2,
    df: (x) => -2 / (x - 2) ** 3,
    dtex: () => 'f′(x) = −2/(x − 2)³',
    F: (x) => -1 / (x - 2),
    Ftex: () => 'F(x) = −1/(x − 2) + C (on each side of x = 2)',
    sing: [2],
    uses: [],
    def: { a: 1, b: 0 },
    view: [-1, 5, -1, 8],
    target: 2,
  },
  inv: {
    name: 'Asymptote with opposite signs: 1/x',
    kind: 'vertical asymptote',
    tex: () => 'f(x) = 1/x',
    f: (x) => 1 / x,
    df: (x) => -1 / (x * x),
    dtex: () => 'f′(x) = −1/x²',
    F: (x) => Math.log(Math.abs(x)),
    Ftex: () => 'F(x) = ln|x| + C (on each side of x = 0)',
    sing: [0],
    uses: [],
    def: { a: 1, b: 0 },
    view: [-4, 4, -6, 6],
    target: 0,
  },
  osc: {
    name: 'Oscillating: sin(1/x)',
    kind: 'oscillation',
    tex: () => 'f(x) = sin(1/x)',
    f: (x) => Math.sin(1 / x),
    df: (x) => -Math.cos(1 / x) / (x * x),
    dtex: () => 'f′(x) = −cos(1/x)/x²',
    uses: [],
    def: { a: 1, b: 0 },
    view: [-1, 1, -1.5, 1.5],
    target: 0,
  },
};
export type PresetId = keyof typeof PRESETS;
