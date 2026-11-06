/**
 * Oxidation–reduction and electron transfer.
 *
 * Each reaction plays in three stages: reactants (with oxidation states),
 * electron transfer, and products. For ionic and metal-displacement
 * reactions, electrons are drawn moving from the reducing agent to the
 * oxidizing agent. For the covalent reaction (hydrogen + oxygen → water),
 * no electrons jump: the shared electron pairs are drawn shifting towards the
 * more electronegative oxygen, and oxidation states are presented as
 * bookkeeping. Particle sizes are schematic.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { REACTIONS, elColour, fmtOx, type Form, type ReactionId } from './data';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'text-muted', 'bg-elev', 'border', 'border-strong', 'accent', 'accent-2', 'warning', 'danger', 'success', 'surface-2'] as const;
type Fs = (px: number, w?: number) => string;
type Role = 'oxidized' | 'reduced' | 'oxAgent' | 'redAgent';

const ELECTRON = '#f2c94c';
const DEF = { id: 'zncu' as ReactionId, speed: 1, showOx: true, test: false };

export function initRedox(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const rxSel = root.querySelector<HTMLSelectElement>('[data-rx]')!;
  const stageEl = root.querySelector<HTMLElement>('[data-stage-label]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;
  const tableBody = root.querySelector<HTMLElement>('[data-ox-table]')!;
  const testBox = root.querySelector<HTMLElement>('[data-test]')!;
  const feedback = root.querySelector<HTMLElement>('[data-feedback]')!;

  const st = { ...DEF };
  let prog = 0; // 0–1 reactants, 1–2 electron transfer, 2–3 products
  let stopAt = 3;
  const R = () => REACTIONS[st.id];

  /* ---------- Time ---------- */
  function step(dt: number) {
    prog = Math.min(stopAt, prog + dt * 0.45 * st.speed);
    if (prog >= stopAt) {
      sim.pause();
      if (stopAt >= 3) sim.announce('Reaction complete. Compare the oxidation states before and after.');
    }
    updateStage();
  }
  const stageOf = () => (prog < 1 ? 0 : prog <= 2 ? 1 : 2);
  let lastStage = -1;
  function updateStage() {
    const s = stageOf();
    if (s === lastStage) return;
    lastStage = s;
    const r = R();
    const text = [
      'Stage 1 of 3: the reactants. The small numbers above each particle are oxidation states.',
      r.kind === 'covalent' ? 'Stage 2 of 3: bonds break and re-form. Shared electrons shift towards oxygen.' : `Stage 2 of 3: ${r.electrons} electrons move from the reducing agent to the oxidizing agent.`,
      'Stage 3 of 3: the products. Green ↑ marks oxidation states that went up (oxidized); red ↓ marks those that went down (reduced).',
    ][s];
    stageEl.textContent = text;
    root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.go) === s)));
    sim.announce(text);
  }

  /* ---------- Layout ---------- */
  const portrait = () => size.h > size.w;
  const box = (): [number, number, number, number] => (portrait() ? [0, 0, 680, 960] : [0, 0, 1000, 600]);
  const tf = () => {
    const [bx, by, bw, bh] = box();
    const k = Math.min(size.w / bw, size.h / bh);
    return { k, ox: (size.w - bw * k) / 2 - bx * k, oy: (size.h - bh * k) / 2 - by * k };
  };
  /** Stage box (800 × 300 particle coordinates) → design coordinates. */
  const region = () => (portrait() ? { x: 20, y: 250, s: 0.8 } : { x: 60, y: 110, s: 1.1 });
  const P = (x: number, y: number) => {
    const g = region();
    return [g.x + x * g.s, g.y + y * g.s] as const;
  };
  const ease = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const morph = () => ease(clamp(prog - 2, 0, 1)); // 0 = reactant form, 1 = product form
  const formAt = (i: number): Form & { t: number } => {
    const p = R().particles[i];
    const t = morph();
    return { ...(t < 0.5 ? p.a : p.b), x: lerp(p.a.x, p.b.x, t), y: lerp(p.a.y, p.b.y, t), r: lerp(p.a.r, p.b.r, t), t };
  };

  interface Area {
    test: (x: number, y: number) => boolean;
    title: string;
    text: () => string;
  }
  let areas: Area[] = [];

  function drawEquation(fs: Fs, k: number) {
    const r = R();
    if (portrait()) {
      // phones: break each equation after the arrow, left-aligned below the badge
      const split = (eq: string) => {
        const i = eq.indexOf('→');
        return [eq.slice(0, i + 1).trim(), eq.slice(i + 1).trim()];
      };
      let y = 92;
      ctx.textAlign = 'left';
      ctx.fillStyle = pal['sim-text'];
      ctx.font = fs(14, 700);
      for (const line of split(r.equation)) (ctx.fillText(line, 30, y), (y += 22 / k));
      if (r.ionic) {
        ctx.font = fs(11, 600);
        ctx.fillStyle = pal['text-muted'];
        const [a0, b0] = split(r.ionic);
        ctx.fillText(`Ionic: ${a0}`, 30, y + 4 / k);
        ctx.fillText(b0, 30, y + 22 / k);
      }
      return;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = pal['sim-text'];
    ctx.font = fs(17, 700);
    ctx.fillText(r.equation, 500, 50);
    if (r.ionic) {
      ctx.font = fs(11.5, 600);
      ctx.fillStyle = pal['text-muted'];
      ctx.fillText(`Ionic equation: ${r.ionic}`, 500, 50 + 22 / k);
    }
  }

  function drawParticles(fs: Fs, k: number) {
    const r = R();
    const s = region().s;
    const t = morph();
    // bonds
    const bonds = t < 0.5 ? r.bondsA : r.bondsB;
    const fade = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
    for (const [i, j] of bonds) {
      const a = formAt(i);
      const b = formAt(j);
      const [ax, ay] = P(a.x, a.y);
      const [bx, by] = P(b.x, b.y);
      ctx.strokeStyle = pal['text-faint'];
      ctx.globalAlpha = fade;
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // shared electron pair: equal sharing in H–H, O=O, Cl–Cl, Br–Br; pulled towards O in water
      if (r.kind === 'covalent' || st.id === 'nacl' || st.id === 'mgo' || st.id === 'clbr') {
        const towardsA = t >= 0.5 && r.kind === 'covalent' ? 0.4 : 0.5; // bondsB lists oxygen first: the pair sits nearer O
        const ex = lerp(ax, bx, towardsA);
        const ey = lerp(ay, by, towardsA);
        const nx = -(by - ay);
        const ny = bx - ax;
        const nl = Math.hypot(nx, ny) || 1;
        ctx.fillStyle = ELECTRON;
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(ex + (sgn * nx * 5 * s) / nl, ey + (sgn * ny * 5 * s) / nl, 4.2 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    // particles
    r.particles.forEach((p, i) => {
      const fm = formAt(i);
      const [x, y] = P(fm.x, fm.y);
      const rad = fm.r * s * 1.25;
      ctx.globalAlpha = p.spectator ? 0.55 : 1;
      ctx.fillStyle = elColour(p.el);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal['sim-text'];
      ctx.lineWidth = 1.5 / k;
      ctx.stroke();
      ctx.fillStyle = '#10161f';
      ctx.font = fs(fm.sym.length > 2 ? 10.5 : 13, 750);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fm.sym, x, y + 1);
      if (fm.charge) {
        ctx.font = fs(11, 800);
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'left';
        ctx.fillText(fm.charge, x + rad * 0.72, y - rad * 0.78);
      }
      if (fm.delta) {
        ctx.font = fs(10.5, 700);
        ctx.fillStyle = fm.delta === 'δ+' ? pal.accent : pal.danger;
        ctx.textAlign = 'center';
        ctx.globalAlpha = (p.spectator ? 0.55 : 1) * clamp((t - 0.5) * 2, 0, 1);
        ctx.fillText(fm.delta, x, y + rad + 12 / k);
      }
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
      // oxidation state badge
      if (st.showOx && !p.spectator) {
        const change = p.b.ox - p.a.ox;
        const done = t >= 0.5;
        const label = fmtOx(fm.ox) + (done && change !== 0 && !st.test ? (change > 0 ? ' ↑' : ' ↓') : '');
        ctx.font = fs(11, 800);
        const tw = ctx.measureText(label).width;
        // badge on the outer side, so bonded pairs stacked vertically do not hide each other's labels
        const below = fm.y > 150;
        const bx = x;
        const by = below ? y + rad + 13 / k + (fm.delta ? 16 / k : 0) : y - rad - 13 / k;
        ctx.fillStyle = done && change !== 0 && !st.test ? (change > 0 ? pal.success : pal.danger) : pal['bg-elev'];
        ctx.beginPath();
        ctx.roundRect(bx - tw / 2 - 6 / k, by - 9 / k, tw + 12 / k, 18 / k, 9 / k);
        ctx.fill();
        ctx.strokeStyle = pal.border;
        ctx.lineWidth = 1 / k;
        ctx.stroke();
        ctx.fillStyle = done && change !== 0 && !st.test ? '#fff' : pal['sim-text'];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx, by + 1 / k);
        ctx.textBaseline = 'alphabetic';
      }
      areas.push({
        test: (px, py) => Math.hypot(px - x, py - y) < rad + 6,
        title: t < 0.5 ? cap(p.name[0]) : cap(p.name[1]),
        text: () => {
          if (p.spectator) return 'A spectator ion: it is present in the solution but its charge and oxidation state do not change, so it takes no part in the electron transfer.';
          const change = p.b.ox - p.a.ox;
          const now = t < 0.5 ? p.a.ox : p.b.ox;
          let s0 = `Oxidation state ${fmtOx(now)}. `;
          if (t < 0.5) s0 += change > 0 ? (st.test ? 'Watch what happens to its oxidation state.' : `It will lose ${change} electron${change > 1 ? 's' : ''} (be oxidized): it is the reducing agent.`) : change < 0 ? (st.test ? 'Watch what happens to its oxidation state.' : `It will gain ${-change} electron${change < -1 ? 's' : ''} (be reduced): it is part of the oxidizing agent.`) : '';
          else s0 += change > 0 ? `Up from ${fmtOx(p.a.ox)}: it has been oxidized.` : change < 0 ? `Down from ${fmtOx(p.a.ox)}: it has been reduced.` : '';
          if (R().kind === 'covalent') s0 += ' In a covalent molecule this is a bookkeeping number: the electrons are shared unequally, not fully transferred.';
          return s0;
        },
      });
    });
    // electrons in flight
    if (prog > 1 && prog < 2.05 && r.kind === 'transfer') {
      const u = ease(clamp(prog - 1, 0, 1));
      for (const [from, to, n] of r.transfers) {
        const a = r.particles[from].a;
        const b = r.particles[to].a;
        const [cx0, cy0] = P(a.x, a.y);
        const [cx1, cy1] = P(b.x, b.y);
        const mx = (cx0 + cx1) / 2;
        const my = Math.min(cy0, cy1) - 70 * s;
        // start and end on the edges of the two particles, not their centres
        const edge = (cx: number, cy: number, r0: number) => {
          const d = Math.hypot(mx - cx, my - cy) || 1;
          return [cx + ((mx - cx) / d) * r0 * s * 1.25, cy + ((my - cy) / d) * r0 * s * 1.25] as const;
        };
        const [ax, ay] = edge(cx0, cy0, a.r);
        const [bx, by] = edge(cx1, cy1, b.r);
        // faint path
        ctx.strokeStyle = ELECTRON;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([5, 6]);
        ctx.lineWidth = 2 / k;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        for (let e = 0; e < n; e++) {
          const v = clamp(u - e * 0.08, 0, 1);
          const w = 1 - v;
          const ex = w * w * ax + 2 * w * v * mx + v * v * bx;
          const ey = w * w * ay + 2 * w * v * my + v * v * by;
          ctx.fillStyle = ELECTRON;
          ctx.beginPath();
          ctx.arc(ex, ey, 7 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#10161f';
          ctx.font = fs(9, 800);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('e⁻', ex, ey + 0.5);
          ctx.textBaseline = 'alphabetic';
        }
      }
    }
    if (r.kind === 'covalent' && prog > 1 && prog < 2.2) {
      const [x, y] = P(400, 150);
      ctx.font = fs(11.5, 700);
      ctx.fillStyle = pal.warning;
      ctx.textAlign = 'center';
      ctx.fillText('No electrons jump: bonds break and re-form, and', x, y - 8 / k);
      ctx.fillText('the shared pairs end up closer to oxygen', x, y + 10 / k);
    }
  }
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  function drawHalves(fs: Fs, k: number) {
    const r = R();
    const x0 = portrait() ? 30 : 110;
    const y0 = portrait() ? 540 : 470;
    const lh = 24 / k;
    const show = prog >= 1;
    ctx.textAlign = 'left';
    const rows: [string, string, string][] = [
      [st.test ? 'Half-equation 1' : 'Oxidation (loss of electrons)', r.halfOx, pal.success],
      [st.test ? 'Half-equation 2' : 'Reduction (gain of electrons)', r.halfRed, pal.danger],
    ];
    rows.forEach(([label, eq, col], i) => {
      const y = y0 + i * lh * 2.2;
      ctx.font = fs(11, 700);
      ctx.fillStyle = st.test ? pal['text-muted'] : col;
      ctx.fillText(label, x0, y);
      ctx.font = fs(13.5, 650);
      ctx.fillStyle = pal['sim-text'];
      ctx.globalAlpha = show ? 1 : 0.25;
      ctx.fillText(show ? eq : 'appears at stage 2', x0, y + lh);
      ctx.globalAlpha = 1;
    });
    if (!st.test) {
      ctx.font = fs(11, 650);
      ctx.fillStyle = pal['text-faint'];
      const tx = portrait() ? x0 : 640;
      const ty = portrait() ? y0 + lh * 4.8 : y0;
      ctx.fillText('OIL RIG:', tx, ty);
      ctx.fillText('Oxidation Is Loss,', tx, ty + 18 / k);
      ctx.fillText('Reduction Is Gain (of electrons)', tx, ty + 36 / k);
    }
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    areas = [];
    const fs: Fs = (px, wt = 650) => font(px / k, wt);
    drawEquation(fs, k);
    drawParticles(fs, k);
    drawHalves(fs, k);
    ctx.restore();
    updateReadouts();
  }

  /* ---------- Readouts, table and explanation ---------- */
  function updateReadouts() {
    const r = R();
    const hide = st.test;
    ui.readout('kind', r.kind === 'covalent' ? 'Redox with shared electrons (covalent product)' : r.ionic ? 'Electron transfer (displacement)' : 'Electron transfer (ionic product)');
    ui.readout('e', `${r.electrons} per equation as written${r.kind === 'covalent' ? ' (formally)' : ''}`);
    ui.readout('ox', hide ? '?' : r.roles.oxidized);
    ui.readout('red', hide ? '?' : r.roles.reduced);
    ui.readout('oa', hide ? '?' : r.roles.oxAgent);
    ui.readout('ra', hide ? '?' : r.roles.redAgent);
    sim.setBadge(['Reactants', 'Electron transfer', 'Products'][stageOf()]);
    canvas.setAttribute('aria-label', `${r.title}: ${r.equation}. ${['Showing the reactants', 'Showing the electron transfer', 'Showing the products'][stageOf()]}.`);
  }
  function buildTable() {
    const r = R();
    // one row per element that is not a spectator
    const seen = new Map<string, { before: number; after: number; a: string; b: string }>();
    for (const p of r.particles) {
      if (p.spectator || seen.has(p.el)) continue;
      seen.set(p.el, { before: p.a.ox, after: p.b.ox, a: p.name[0], b: p.name[1] });
    }
    tableBody.innerHTML = [...seen.entries()]
      .map(([el, v]) => {
        const ch = v.after - v.before;
        const meaning = st.test ? '?' : ch > 0 ? 'Oxidized (lost electrons)' : ch < 0 ? 'Reduced (gained electrons)' : 'No change';
        return `<tr><td><strong>${el}</strong></td><td>${fmtOx(v.before)}</td><td>${fmtOx(v.after)}</td><td>${ch > 0 ? '+' : ch < 0 ? '−' : ''}${Math.abs(ch) || '0'}</td><td>${meaning}</td></tr>`;
      })
      .join('');
    if (r.spectator) tableBody.innerHTML += `<tr><td>${r.spectator}</td><td colspan="4">Spectator ion: unchanged</td></tr>`;
  }
  function explain() {
    const r = R();
    noteEl.innerHTML = `<strong>In the lab:</strong> ${r.lab}<br /><strong>What happens:</strong> ${r.how}`;
  }

  /* ---------- Test yourself ---------- */
  const selects = [...root.querySelectorAll<HTMLSelectElement>('[data-role]')];
  function fillTest() {
    const r = R();
    for (const s of selects) s.innerHTML = `<option value="">Choose…</option>${r.options.map((o) => `<option value="${o}">${o}</option>`).join('')}`;
    feedback.textContent = '';
    feedback.className = 'redox-feedback';
  }
  root.querySelector('[data-check]')?.addEventListener('click', () => {
    const r = R();
    let right = 0;
    const wrong: string[] = [];
    const names: Record<Role, string> = { oxidized: 'oxidized', reduced: 'reduced', oxAgent: 'the oxidizing agent', redAgent: 'the reducing agent' };
    for (const s of selects) {
      const role = s.dataset.role as Role;
      if (s.value === r.roles[role]) right++;
      else wrong.push(`${r.roles[role]} is ${names[role]}`);
    }
    feedback.className = `redox-feedback ${right === 4 ? 'is-ok' : 'is-bad'}`;
    feedback.textContent =
      right === 4
        ? 'All four correct! The species that is oxidized is the reducing agent, and the species that is reduced is the oxidizing agent.'
        : `${right} of 4 correct. ${wrong.join('; ')}. Tip: find the element whose oxidation state goes up (oxidized) and the one that goes down (reduced).`;
    sim.announce(feedback.textContent);
  });

  /* ---------- Clicks ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - rect.left - ox) / k;
    const y = (e.clientY - rect.top - oy) / k;
    const a = [...areas].reverse().find((q) => q.test(x, y));
    if (a) sim.showTooltip(e.clientX - rect.left, e.clientY - rect.top, a.title, a.text());
    else sim.hideTooltip();
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  function load(id: ReactionId) {
    st.id = id;
    prog = 0;
    stopAt = 3;
    lastStage = -1;
    buildTable();
    explain();
    fillTest();
    updateStage();
    sim.hideTooltip();
    sim.requestRender();
  }
  rxSel.addEventListener('change', () => {
    load(rxSel.value as ReactionId);
    sim.pause();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const s = Number(b.dataset.go);
      if (s === 0) (prog = 0), (stopAt = 3), sim.pause();
      else if (s === 1) (prog = 1), (stopAt = 2), sim.play();
      else (prog = 3), (stopAt = 3), sim.pause();
      updateStage();
      sim.requestRender();
    }),
  );
  const oxCtl = ui.toggle('rx-ox', (v) => ((st.showOx = v), sim.requestRender()));
  const testCtl = ui.toggle('rx-test', (v) => {
    st.test = v;
    testBox.hidden = !v;
    buildTable();
    fillTest();
    sim.requestRender();
  });
  const speedCtl = ui.range('rx-speed', (v) => (v < 1 ? 'Slow' : v > 1 ? 'Fast' : 'Normal'), (v) => (st.speed = v));

  const sim = createSimController(root, {
    step,
    render,
    autoplay: false,
    onPlayChange(on) {
      // pressing Start after the end replays the reaction from the beginning
      if (on && prog >= stopAt) {
        if (prog >= 3) prog = 0;
        stopAt = 3;
        lastStage = -1;
        updateStage();
      }
    },
    reset() {
      Object.assign(st, DEF);
      rxSel.value = DEF.id;
      oxCtl.set(true, false);
      testCtl.set(false, false);
      testBox.hidden = true;
      speedCtl.set(1, false);
      load(DEF.id);
    },
  });
  load(DEF.id);
}
