/**
 * Balancing chemical equations: the law of conservation of mass requires the
 * same number of each kind of atom on both sides.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';
import { ELEMENT_COLOUR, ELEMENT_NAME, REACTIONS, type Species } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border-strong', 'success', 'danger', 'accent'] as const;
const MAX = 12;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function initBalancing(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const reactionSel = root.querySelector<HTMLSelectElement>('[data-reaction]')!;
  const eqEl = root.querySelector<HTMLElement>('[data-equation]')!;
  const msgEl = root.querySelector<HTMLElement>('[data-msg]')!;

  const st = { r: 0, coef: [] as number[], moves: 0, tilt: 0 };
  let atomsDrawn: { x: number; y: number; el: string }[] = [];

  const rx = () => REACTIONS[st.r];
  const species = () => [...rx().reactants, ...rx().products];
  const nR = () => rx().reactants.length;

  function counts() {
    const left: Record<string, number> = {};
    const right: Record<string, number> = {};
    species().forEach((s, i) => {
      const side = i < nR() ? left : right;
      for (const [el, n] of Object.entries(s.atoms)) side[el] = (side[el] ?? 0) + n * st.coef[i];
    });
    const elements = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    return { left, right, elements };
  }
  function status() {
    const c = counts();
    const balanced = c.elements.every((e) => (c.left[e] ?? 0) === (c.right[e] ?? 0));
    const g = st.coef.reduce((a, b) => gcd(a, b));
    return { ...c, balanced, simplest: balanced && g === 1 };
  }

  /* ---------- Equation editor (HTML) ---------- */
  function buildEditor() {
    eqEl.innerHTML = '';
    species().forEach((s, i) => {
      if (i > 0) {
        const op = document.createElement('span');
        op.textContent = i === nR() ? '→' : '+';
        op.setAttribute('aria-hidden', 'true');
        eqEl.appendChild(op);
      }
      const term = document.createElement('div');
      term.className = 'term';
      term.innerHTML = `<span><span class="coef" data-coef="${i}"></span> ${s.formula}</span>
        <span class="step"><button type="button" data-dec="${i}" aria-label="Decrease coefficient of ${s.formula}">−</button><button type="button" data-inc="${i}" aria-label="Increase coefficient of ${s.formula}">+</button></span>`;
      eqEl.appendChild(term);
    });
    eqEl.querySelectorAll<HTMLButtonElement>('[data-inc],[data-dec]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.inc ?? b.dataset.dec);
        const d = b.dataset.inc !== undefined ? 1 : -1;
        st.coef[i] = Math.max(1, Math.min(MAX, st.coef[i] + d));
        st.moves++;
        msgEl.textContent = '';
        afterChange();
      }),
    );
  }

  function afterChange() {
    const s = status();
    eqEl.querySelectorAll<HTMLElement>('[data-coef]').forEach((el) => {
      const c = st.coef[Number(el.dataset.coef)];
      el.textContent = c === 1 ? '' : String(c);
    });
    if (s.balanced) {
      msgEl.textContent = s.simplest ? `Balanced! ${rx().note}` : 'Balanced, but the coefficients can be divided by a common factor. Simplify them to the smallest whole numbers.';
      msgEl.style.color = s.simplest ? 'var(--success)' : 'var(--warning)';
      sim.announce(msgEl.textContent);
    }
    sim.requestRender();
  }

  function load(i: number) {
    st.r = i;
    st.coef = species().map(() => 1);
    st.moves = 0;
    reactionSel.value = String(i);
    msgEl.textContent = '';
    buildEditor();
    afterChange();
  }

  /* ---------- Canvas: molecules and atom tallies ---------- */
  function drawMolecule(s: Species, x: number, y: number, r: number) {
    // Lay atoms out in a compact cluster: biggest group first
    const list: string[] = [];
    Object.entries(s.atoms)
      .sort((a, b) => b[1] - a[1])
      .forEach(([el, n]) => {
        for (let k = 0; k < n; k++) list.push(el);
      });
    const n = list.length;
    const ring = n <= 1 ? 0 : r * (n <= 3 ? 0.9 : n <= 6 ? 1.25 : 1.8);
    list.forEach((el, k) => {
      const a = (k / Math.max(1, n)) * Math.PI * 2;
      const ax = x + (n === 1 ? 0 : Math.cos(a) * ring * (k % 2 && n > 8 ? 0.55 : 1));
      const ay = y + (n === 1 ? 0 : Math.sin(a) * ring * (k % 2 && n > 8 ? 0.55 : 1));
      ctx.fillStyle = ELEMENT_COLOUR[el] ?? '#888';
      ctx.strokeStyle = pal['border-strong']; // visible outline in both themes
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      atomsDrawn.push({ x: ax, y: ay, el });
    });
  }

  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    atomsDrawn = [];
    const s = status();
    const sp = species();

    // Molecules on each side
    const top = 20;
    const areaH = h * 0.56;
    const half = w / 2;
    const atomR = Math.max(5, Math.min(11, w / 75));
    for (const side of [0, 1]) {
      const list = sp.map((q, i) => ({ q, i })).filter(({ i }) => (side === 0 ? i < nR() : i >= nR()));
      const x0 = side === 0 ? 14 : half + 30;
      const x1 = side === 0 ? half - 30 : w - 14;
      const colW = (x1 - x0) / list.length;
      list.forEach(({ q, i }, k) => {
        const n = st.coef[i];
        const cols = Math.max(1, Math.floor(colW / (atomR * 5.2)));
        for (let m = 0; m < n; m++) {
          const cx = x0 + k * colW + atomR * 3 + (m % cols) * atomR * 5.2;
          const cy = top + 26 + Math.floor(m / cols) * atomR * 5.4;
          if (cy < top + areaH - 10) drawMolecule(q, cx, cy, atomR);
        }
        ctx.fillStyle = pal['text-faint'];
        ctx.font = font(12, 650);
        ctx.fillText(`${n > 1 ? n : ''}${q.formula}`, x0 + k * colW + 4, top + areaH + 4);
      });
    }
    ctx.fillStyle = pal['sim-text'];
    ctx.font = font(26, 700);
    ctx.textAlign = 'center';
    ctx.fillText('→', half, top + areaH / 2);
    ctx.textAlign = 'left';

    // Balance scale: tilts toward the heavier side (total atoms)
    const totalL = Object.values(s.left).reduce((a, b) => a + b, 0);
    const totalR = Object.values(s.right).reduce((a, b) => a + b, 0);
    const target = s.balanced ? 0 : Math.max(-0.18, Math.min(0.18, (totalR - totalL) * 0.03));
    st.tilt += (target - st.tilt) * 0.35;
    const by = h * 0.7;
    ctx.save();
    ctx.translate(half, by);
    ctx.strokeStyle = s.balanced ? pal.success : pal['border-strong'];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 22);
    ctx.stroke();
    ctx.rotate(st.tilt);
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, 0);
    ctx.lineTo(w * 0.3, 0);
    ctx.stroke();
    ctx.restore();

    // Element tallies
    const rowY = h * 0.8;
    const colW = Math.min(110, (w - 40) / Math.max(1, s.elements.length));
    s.elements.forEach((el, k) => {
      const x = 20 + k * colW;
      const l = s.left[el] ?? 0;
      const r = s.right[el] ?? 0;
      const ok = l === r;
      ctx.fillStyle = ELEMENT_COLOUR[el];
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(x + 8, rowY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ok ? pal.success : pal.danger;
      ctx.font = font(13, 700);
      ctx.fillText(`${el}: ${l} | ${r}`, x + 20, rowY + 5);
    });
    pill(ctx, 'Reactants', w * 0.25, h - 14, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);
    pill(ctx, 'Products', w * 0.75, h - 14, { bg: pal['bg-elev'], fg: pal['sim-text'] }, size);

    // Readouts
    ui.readout('status', s.simplest ? 'Balanced ✓' : s.balanced ? 'Balanced (not simplest)' : 'Not balanced', s.simplest ? 'ok' : s.balanced ? 'warn' : 'bad');
    ui.readout('counts', s.elements.map((e) => `${e} ${s.left[e] ?? 0}=${s.right[e] ?? 0}`).join(' · '));
    ui.readout('moves', String(st.moves));
    sim.setBadge(s.simplest ? 'Balanced!' : 'Not balanced');
    const text = species().map((q, i) => `${st.coef[i]} ${q.formula}`).join(', ');
    canvas.setAttribute('aria-label', `${rx().name}: ${text}. ${s.elements.map((e) => `${ELEMENT_NAME[e]} ${s.left[e] ?? 0} on the left and ${s.right[e] ?? 0} on the right`).join('; ')}.`);
    if (Math.abs(target - st.tilt) > 0.005) requestAnimationFrame(() => sim.requestRender());
  }

  /* ---------- Controls ---------- */
  const ui = controls(root);
  reactionSel.addEventListener('change', () => load(Number(reactionSel.value)));
  root.querySelector('[data-hint]')!.addEventListener('click', () => {
    const s = status();
    const wrong = s.elements.find((e) => (s.left[e] ?? 0) !== (s.right[e] ?? 0));
    msgEl.style.color = '';
    if (!wrong) msgEl.textContent = s.simplest ? 'It is already balanced!' : 'Divide every coefficient by their common factor.';
    else {
      msgEl.textContent = `${ELEMENT_NAME[wrong]} is unbalanced: ${s.left[wrong] ?? 0} on the left, ${s.right[wrong] ?? 0} on the right. Tip: balance elements that appear in only one substance on each side first, and leave lone elements like O₂ or H₂ until last.`;
    }
    sim.announce(msgEl.textContent);
  });
  root.querySelector('[data-show]')!.addEventListener('click', () => {
    st.coef = [...rx().answer];
    afterChange();
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const a = atomsDrawn.find((q) => Math.hypot(q.x - x, q.y - y) < 10);
    if (a) sim.showTooltip(x, y, `${ELEMENT_NAME[a.el]} atom (${a.el})`, 'Atoms are rearranged in a reaction, but none are created or destroyed — so every atom on the left must appear on the right.');
  });

  const sim = createSimController(root, {
    render,
    reset() {
      load(0);
    },
  });
  load(0);
}
