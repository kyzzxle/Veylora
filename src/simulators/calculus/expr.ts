/**
 * A small, safe maths-expression parser. It never uses eval() or Function():
 * the text is tokenised, parsed by recursive descent into a tree, and the tree
 * is turned into plain closures.
 *
 * Supported: numbers (2, 0.5, 1e-3), variables (x and any names passed in),
 * constants pi and e, + − * / ^ (right-associative), unary minus, brackets,
 * implicit multiplication (2x, 3sin(x), (x+1)(x−1), x(x+2)), and the functions
 * sin cos tan asin acos atan sinh cosh tanh exp ln log sqrt cbrt abs floor ceil sign.
 */

export type Fn = (vars: Record<string, number>) => number;
export interface Parsed {
  fn: Fn;
  /** Names of the variables the expression uses. */
  uses: Set<string>;
}
export class ExprError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  sign: (v) => (v === 0 ? 0 : Math.sign(v)),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
export const FUNCTION_NAMES = Object.keys(FUNCS);

type Tok = { t: 'num'; v: number; p: number } | { t: 'id'; v: string; p: number } | { t: 'op'; v: string; p: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExprError(`I can’t read the number at position ${i + 1}.`, i);
      out.push({ t: 'num', v: parseFloat(m[0]), p: i });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Zπ]/.test(c)) {
      const m = /^([a-zA-Z]+|π)/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0] === 'π' ? 'pi' : m[0].toLowerCase(), p: i });
      i += m[0].length;
      continue;
    }
    const op = { '−': '-', '×': '*', '·': '*', '÷': '/', '²': '^2', '³': '^3' }[c] ?? c;
    if (op === '^2' || op === '^3') {
      out.push({ t: 'op', v: '^', p: i }, { t: 'num', v: +op[1], p: i });
      i++;
      continue;
    }
    if ('+-*/^()|'.includes(op)) {
      out.push({ t: 'op', v: op, p: i });
      i++;
      continue;
    }
    throw new ExprError(`“${c}” is not allowed (position ${i + 1}).`, i);
  }
  return out;
}

/**
 * Split runs of letters into known names: “xsin” → x, sin; “ax” → a, x.
 * Longest known name first, so “sinh” is not read as “sin” + “h”.
 */
function splitIds(toks: Tok[], vars: string[]): Tok[] {
  const known = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...vars].sort((p, q) => q.length - p.length);
  const out: Tok[] = [];
  for (const tk of toks) {
    if (tk.t !== 'id') {
      out.push(tk);
      continue;
    }
    let s = tk.v;
    let p = tk.p;
    while (s.length) {
      const k = known.find((n) => s.startsWith(n));
      if (!k) throw new ExprError(`Unknown name “${tk.v}”. Use x${vars.length > 1 ? `, ${vars.filter((v) => v !== 'x').join(', ')}` : ''}, pi, e or a function such as sin( ).`, p);
      out.push({ t: 'id', v: k, p });
      s = s.slice(k.length);
      p += k.length;
    }
  }
  return out;
}

export function parseExpr(src: string, vars: string[] = ['x']): Parsed {
  if (!src.trim()) throw new ExprError('Type an expression, for example x^2 − 3x + 1.', 0);
  if (src.length > 120) throw new ExprError('That expression is too long (120 characters at most).', 120);
  const toks = splitIds(tokenize(src), vars);
  let i = 0;
  const uses = new Set<string>();
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && peek().v === v;
  const startsFactor = () => {
    const tk = peek();
    return !!tk && (tk.t === 'num' || tk.t === 'id' || (tk.t === 'op' && (tk.v === '(' || tk.v === '|')));
  };
  let absDepth = 0;

  // expr := term (('+'|'-') term)*
  function expr(): Fn {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[i++].v;
      const r = term();
      const l = left;
      left = op === '+' ? (s) => l(s) + r(s) : (s) => l(s) - r(s);
    }
    return left;
  }
  // term := unary (('*'|'/'|implicit) unary)*
  function term(): Fn {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[i++].v;
        const r = unary();
        const l = left;
        left = op === '*' ? (s) => l(s) * r(s) : (s) => l(s) / r(s);
      } else if (startsFactor() && !(isOp('|') && absDepth > 0)) {
        const r = power();
        const l = left;
        left = (s) => l(s) * r(s);
      } else return left;
    }
  }
  // unary := ('-'|'+') unary | power
  function unary(): Fn {
    if (isOp('-')) {
      i++;
      const u = unary();
      return (s) => -u(s);
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  }
  // power := factor ('^' unary)?   (right-associative; −x^2 means −(x²))
  function power(): Fn {
    const base = factor();
    if (isOp('^')) {
      i++;
      const ex = unary();
      return (s) => Math.pow(base(s), ex(s));
    }
    return base;
  }
  function factor(): Fn {
    const tk = peek();
    if (!tk) throw new ExprError('The expression ends too early.', src.length);
    if (tk.t === 'num') {
      i++;
      const v = tk.v;
      return () => v;
    }
    if (tk.t === 'op' && tk.v === '(') {
      i++;
      const e = expr();
      if (!isOp(')')) throw new ExprError('A closing bracket “)” is missing.', peek()?.p ?? src.length);
      i++;
      return e;
    }
    if (tk.t === 'op' && tk.v === '|') {
      i++;
      absDepth++;
      const e = expr();
      absDepth--;
      if (!isOp('|')) throw new ExprError('A closing “|” is missing.', peek()?.p ?? src.length);
      i++;
      return (s) => Math.abs(e(s));
    }
    if (tk.t === 'id') {
      i++;
      if (tk.v in FUNCS) {
        const f = FUNCS[tk.v];
        if (!isOp('(')) throw new ExprError(`Put brackets after ${tk.v}, for example ${tk.v}(x).`, tk.p);
        const arg = factor();
        return (s) => f(arg(s));
      }
      if (tk.v in CONSTS) {
        const v = CONSTS[tk.v];
        return () => v;
      }
      const name = tk.v;
      uses.add(name);
      return (s) => s[name];
    }
    throw new ExprError(`Unexpected “${tk.v}” at position ${tk.p + 1}.`, tk.p);
  }
  const fn = expr();
  if (i < toks.length) throw new ExprError(`Unexpected “${toks[i].v}” at position ${toks[i].p + 1}.`, toks[i].p);
  return { fn, uses };
}
