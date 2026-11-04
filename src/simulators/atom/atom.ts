/**
 * Atomic structure with a simplified Bohr model.
 * Element = number of protons (Z). Mass number A = Z + N. Charge = Z − electrons.
 * Electrons fill shells of capacity 2, 8, 8, 18 (the simple rule used for the first 20 elements).
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { font, pill } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'danger', 'text-faint', 'bg-elev', 'border-strong', 'warning'] as const;

const ELEMENTS: [string, string, number[]][] = [
  // symbol, name, stable mass numbers
  ['H', 'Hydrogen', [1, 2]],
  ['He', 'Helium', [3, 4]],
  ['Li', 'Lithium', [6, 7]],
  ['Be', 'Beryllium', [9]],
  ['B', 'Boron', [10, 11]],
  ['C', 'Carbon', [12, 13]],
  ['N', 'Nitrogen', [14, 15]],
  ['O', 'Oxygen', [16, 17, 18]],
  ['F', 'Fluorine', [19]],
  ['Ne', 'Neon', [20, 21, 22]],
  ['Na', 'Sodium', [23]],
  ['Mg', 'Magnesium', [24, 25, 26]],
  ['Al', 'Aluminium', [27]],
  ['Si', 'Silicon', [28, 29, 30]],
  ['P', 'Phosphorus', [31]],
  ['S', 'Sulfur', [32, 33, 34, 36]],
  ['Cl', 'Chlorine', [35, 37]],
  ['Ar', 'Argon', [36, 38, 40]],
  ['K', 'Potassium', [39, 41]],
  ['Ca', 'Calcium', [40, 42, 43, 44, 46, 48]],
];
const LIMITS = { p: 20, n: 28, e: 22 };
const SHELLS = [2, 8, 8, 18];

export function shellConfig(e: number) {
  const out: number[] = [];
  let left = e;
  for (const cap of SHELLS) {
    if (left <= 0) break;
    const k = Math.min(cap, left);
    out.push(k);
    left -= k;
  }
  return out;
}

export function initAtom(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const a = { p: 6, n: 6, e: 6 };
  const view = { rot: 0, rings: true, excite: 0 };
  let nucleus: { x: number; y: number; kind: 'p' | 'n' }[] = [];

  /* ---------- Nucleus packing (deterministic spiral) ---------- */
  function buildNucleus() {
    const total = a.p + a.n;
    const kinds: ('p' | 'n')[] = [];
    // Interleave protons and neutrons so both are visible
    let pi = 0;
    let ni = 0;
    for (let i = 0; i < total; i++) {
      const wantP = pi / Math.max(1, a.p) <= ni / Math.max(1, a.n);
      if ((wantP && pi < a.p) || ni >= a.n) kinds.push('p'), pi++;
      else kinds.push('n'), ni++;
    }
    nucleus = kinds.map((kind, i) => {
      const r = 6.2 * Math.sqrt(i);
      const t = i * 2.39996; // golden angle
      return { x: Math.cos(t) * r, y: Math.sin(t) * r, kind };
    });
  }

  /* ---------- Physics facts ---------- */
  const info = () => {
    const el = a.p > 0 ? ELEMENTS[a.p - 1] : null;
    const A = a.p + a.n;
    const charge = a.p - a.e;
    let stability = '—';
    let tone: 'ok' | 'warn' | 'bad' | null = null;
    if (el) {
      if (el[2].includes(A)) (stability = 'Stable isotope'), (tone = 'ok');
      else {
        const nearest = Math.min(...el[2].map((m) => Math.abs(m - A)));
        if (a.n === 0 && a.p > 1) (stability = 'Cannot exist (no neutrons)'), (tone = 'bad');
        else if (nearest <= 4) (stability = 'Radioactive (unstable)'), (tone = 'warn');
        else (stability = 'Too unbalanced to hold together'), (tone = 'bad');
      }
    }
    return { el, A, charge, stability, tone };
  };

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.38;
    const cy = h / 2;
    const maxR = Math.min(w * 0.34, h * 0.46);
    const shells = shellConfig(a.e);
    const ringR = (i: number) => 38 + (i + 1) * ((maxR - 38) / 4);

    // Shell rings
    if (view.rings) {
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = pal['border-strong'];
        ctx.globalAlpha = i < shells.length ? 0.7 : 0.25;
        ctx.setLineDash(i < shells.length ? [] : [3, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR(i), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal['text-faint'];
        ctx.font = font(10, 600, 'mono');
        ctx.fillText(`n=${i + 1}`, cx + ringR(i) * 0.707 + 4, cy - ringR(i) * 0.707 - 4);
      }
    }

    // Nucleus
    const scaleN = Math.min(1, 34 / (6.2 * Math.sqrt(Math.max(1, nucleus.length)) + 7));
    for (const q of nucleus) {
      ctx.fillStyle = q.kind === 'p' ? pal.danger : pal['text-faint'];
      ctx.beginPath();
      ctx.arc(cx + q.x * scaleN, cy + q.y * scaleN, 6.5 * Math.max(0.65, scaleN), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal['sim-bg'];
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (!nucleus.length) {
      ctx.fillStyle = pal['text-faint'];
      ctx.font = font(12, 600);
      ctx.textAlign = 'center';
      ctx.fillText('Add protons to build a nucleus', cx, cy + 4);
      ctx.textAlign = 'left';
    }

    // Electrons
    electronPos = [];
    shells.forEach((count, si) => {
      const r = ringR(si);
      for (let k = 0; k < count; k++) {
        let rr = r;
        const isOuter = si === shells.length - 1 && k === count - 1;
        if (isOuter && view.excite > 0) {
          // Jump out to the next shell and fall back
          const t = view.excite;
          const up = t > 0.6 ? 1 : t / 0.6;
          const down = t > 0.6 ? (1 - t) / 0.4 : 1;
          const jump = Math.min(ringR(si + 1) - r, ((maxR - 38) / 4) * 0.6); // stay inside the stage
          rr = r + jump * Math.min(up, down);
        }
        const ang = view.rot * (1 / (si + 1)) + (k / count) * Math.PI * 2 + si * 0.4;
        const x = cx + Math.cos(ang) * rr;
        const y = cy + Math.sin(ang) * rr;
        electronPos.push({ x, y, shell: si + 1 });
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        // As the electron falls back to its shell, it emits a photon (wavy line)
        if (isOuter && view.excite > 0.6) {
          const prog = (1 - view.excite) / 0.4; // 1 → 0
          const d = (1 - prog) * maxR * 0.9;
          ctx.strokeStyle = pal.warning;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const u = i / 40;
            const px = x + Math.cos(ang) * (d * u + 6);
            const py = y + Math.sin(ang) * (d * u + 6);
            const off = Math.sin(u * 18) * 5;
            const qx = px - Math.sin(ang) * off;
            const qy = py + Math.cos(ang) * off;
            if (i) ctx.lineTo(qx, qy);
            else ctx.moveTo(qx, qy);
          }
          ctx.stroke();
        }
      }
    });

    // Element tile
    const f = info();
    const tx = w * 0.72;
    const ty = h * 0.18;
    const tw = Math.min(w * 0.24, 190);
    const th = tw * 1.15;
    ctx.fillStyle = pal['bg-elev'];
    ctx.strokeStyle = pal['border-strong'];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'left';
    ctx.font = font(Math.round(tw * 0.11), 600, 'mono');
    ctx.fillText(String(a.p), tx + 12, ty + tw * 0.16);
    ctx.textAlign = 'right';
    ctx.fillText(String(f.A), tx + tw - 12, ty + tw * 0.16);
    ctx.textAlign = 'center';
    ctx.font = font(Math.round(tw * 0.42), 700);
    ctx.fillText(f.el ? f.el[0] : '?', tx + tw / 2, ty + th * 0.6);
    ctx.font = font(Math.round(tw * 0.1), 600);
    ctx.fillText(f.el ? f.el[1] : 'No element', tx + tw / 2, ty + th * 0.8);
    if (f.charge !== 0) {
      ctx.fillStyle = f.charge > 0 ? pal.danger : pal.accent;
      ctx.font = font(Math.round(tw * 0.12), 700);
      ctx.fillText(`${Math.abs(f.charge) > 1 ? Math.abs(f.charge) : ''}${f.charge > 0 ? '+' : '−'}`, tx + tw - 22, ty + th * 0.36);
    }
    ctx.fillStyle = pal['text-faint'];
    ctx.font = font(11, 500);
    ctx.fillText('atomic number · mass number', tx + tw / 2, ty + th + 18);
    ctx.textAlign = 'left';

    // Readouts
    ui.readout('element', f.el ? `${f.el[1]} (${f.el[0]})` : 'None — no protons');
    ui.readout('mass', `${f.A} (${a.p}p + ${a.n}n)`);
    ui.readout('charge', f.charge === 0 ? '0 (neutral)' : `${f.charge > 0 ? '+' : '−'}${Math.abs(f.charge)}`);
    ui.readout('kind', f.charge === 0 ? 'Neutral atom' : f.charge > 0 ? 'Positive ion (cation)' : 'Negative ion (anion)');
    ui.readout('stable', f.stability, f.tone);
    ui.readout('config', shells.length ? `${shells.join(', ')} · ${shells[shells.length - 1]} valence` : 'No electrons');
    root.querySelectorAll<HTMLElement>('[data-count]').forEach((o) => (o.textContent = String(a[o.dataset.count as 'p' | 'n' | 'e'])));
    root.querySelectorAll<HTMLButtonElement>('[data-dec]').forEach((b) => (b.disabled = a[b.dataset.dec as 'p' | 'n' | 'e'] <= 0));
    root.querySelectorAll<HTMLButtonElement>('[data-inc]').forEach((b) => {
      const k = b.dataset.inc as 'p' | 'n' | 'e';
      b.disabled = a[k] >= LIMITS[k];
    });
    sim.setBadge(f.el ? `${f.el[1]}-${f.A}${f.charge ? ` ion (${f.charge > 0 ? '+' : '−'}${Math.abs(f.charge)})` : ''}` : 'No element');
    canvas.setAttribute(
      'aria-label',
      `Bohr model with ${a.p} protons, ${a.n} neutrons and ${a.e} electrons: ${f.el ? f.el[1] : 'no element'}, mass number ${f.A}, charge ${f.charge}. Electron shells: ${shells.join(', ') || 'none'}.`,
    );
  }
  let electronPos: { x: number; y: number; shell: number }[] = [];

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const change = () => {
    buildNucleus();
    sim.requestRender();
    const f = info();
    sim.announce(`${f.el ? f.el[1] : 'No element'}, mass number ${f.A}, charge ${f.charge}.`);
  };
  root.querySelectorAll<HTMLButtonElement>('[data-inc]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.inc as 'p' | 'n' | 'e';
      a[k] = Math.min(LIMITS[k], a[k] + 1);
      change();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-dec]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.dec as 'p' | 'n' | 'e';
      a[k] = Math.max(0, a[k] - 1);
      change();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
    b.addEventListener('click', () => {
      a.p = Number(b.dataset.p);
      a.n = Number(b.dataset.n);
      a.e = Number(b.dataset.e);
      change();
    }),
  );
  ui.toggle('atom-cloud', (v) => ((view.rings = v), sim.requestRender()));
  root.querySelector('[data-excite]')!.addEventListener('click', () => {
    if (a.e === 0) return;
    view.excite = 0.001;
    sim.announce('The outer electron absorbs energy, jumps to a higher shell, then falls back and emits a photon of light.');
    if (!sim.running) {
      // Animate the jump even when paused
      const t0 = performance.now();
      const tick = (now: number) => {
        view.excite = Math.min(1, (now - t0) / 1600);
        render();
        if (view.excite < 1) requestAnimationFrame(tick);
        else (view.excite = 0), render();
      };
      requestAnimationFrame(tick);
    }
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const el = electronPos.find((q) => Math.hypot(q.x - x, q.y - y) < 10);
    const cx = size.w * 0.38;
    const cy = size.h / 2;
    if (el) sim.showTooltip(x, y, `Electron (shell ${el.shell})`, 'Charge −1, about 1/1836 of a proton’s mass. Electrons in the outer shell take part in chemical bonding.');
    else if (Math.hypot(x - cx, y - cy) < 40 && nucleus.length)
      sim.showTooltip(x, y, 'Nucleus', `${a.p} protons (+) and ${a.n} neutrons. It holds almost all of the atom’s mass in a tiny space — about 1/100,000 of the atom’s width.`);
    else sim.showTooltip(x, y, 'Mostly empty space', 'Real atoms are mostly empty. If the nucleus were a marble, the electrons would be found over a region the size of a stadium.');
  });

  const sim = createSimController(root, {
    step: (dt) => {
      view.rot += dt * 0.8;
      if (view.excite > 0) {
        view.excite += dt / 1.6;
        if (view.excite >= 1) view.excite = 0;
      }
    },
    render,
    autoplay: !prefersReducedMotion(),
    reset() {
      Object.assign(a, { p: 6, n: 6, e: 6 });
      view.excite = 0;
      buildNucleus();
    },
  });
  buildNucleus();
  sim.requestRender();
}
