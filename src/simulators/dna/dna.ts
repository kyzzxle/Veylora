/**
 * DNA replication at a single replication fork.
 *
 * The parent molecule has N base pairs. The fork (helicase) moves left to
 * right, unzipping the helix. The top template runs 5′→3′ left to right, so
 * its new partner must be built right-to-left (away from the fork): this is
 * the lagging strand, made as Okazaki fragments of FRAG bases. The bottom
 * template runs 3′→5′, so its new strand is built continuously toward the
 * fork: the leading strand.
 *
 * Each lagging fragment goes through: wait for the fork → primase lays an RNA
 * primer → DNA polymerase III extends it away from the fork → DNA polymerase I
 * replaces the previous fragment's primer with DNA → DNA ligase seals the nick.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'accent'] as const;
const N = 40;
const FRAG = 8;
const PRIMER = 3;
const FORK_RATE = 1.6; // bases per second at speed 1

const OLD = '#3b7dd8';
const NEW = '#f08a4b';
const RNA = '#d64fb0';
const BASE_COLOUR: Record<string, string> = { A: '#5bbf72', T: '#e0605a', U: '#e0605a', G: '#f2c14e', C: '#7a8cf0' };
const PAIR: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
const BASE_NAME: Record<string, string> = { A: 'adenine', T: 'thymine', U: 'uracil', G: 'guanine', C: 'cytosine' };

type Fill = 0 | 1 | 2; // none, RNA primer, DNA
type Phase = 'waiting' | 'priming' | 'extending' | 'replacing' | 'ligating' | 'done';
interface Fragment {
  start: number;
  end: number;
  phase: Phase;
  t: number;
  pos: number;
}
interface Enzyme {
  id: keyof typeof ENZYMES;
  x: number;
  y: number;
  r: number;
}

const ENZYMES = {
  helicase: { name: 'Helicase', about: 'Unzips the double helix by breaking the hydrogen bonds between base pairs, opening the replication fork.', colour: '#8e6bd8' },
  primase: { name: 'Primase', about: 'Lays a short RNA primer. DNA polymerase cannot start a strand from nothing, so it needs this starting point.', colour: '#d64fb0' },
  polLead: { name: 'DNA polymerase III (leading strand)', about: 'Adds nucleotides continuously in the 5′→3′ direction, following the fork.', colour: '#2a9d8f' },
  polLag: { name: 'DNA polymerase III (lagging strand)', about: 'Can only build 5′→3′, so on this strand it works away from the fork, one Okazaki fragment at a time.', colour: '#2a9d8f' },
  pol1: { name: 'DNA polymerase I', about: 'Removes an RNA primer and replaces it with DNA.', colour: '#c9a227' },
  ligase: { name: 'DNA ligase', about: 'Seals the nick between neighbouring fragments, joining the sugar-phosphate backbone.', colour: '#e76f51' },
} as const;

export function initDna(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));

  const opt = { speed: 1, letters: true, enzymes: true };
  let seq: string[] = [];
  let top: Fill[] = []; // new strand paired with the top template (lagging)
  let bot: Fill[] = []; // new strand paired with the bottom template (leading)
  let frags: Fragment[] = [];
  let fork = 0;
  let lead = { phase: 'priming' as Phase, t: 0, pos: 0 };
  let time = 0;
  let finished = false;
  let enzymes: Enzyme[] = [];
  let stepText = '';

  function restart() {
    seq = Array.from({ length: N }, () => 'ATGC'[Math.floor(Math.random() * 4)]);
    top = Array(N).fill(0);
    bot = Array(N).fill(0);
    frags = [];
    for (let s = 0; s < N; s += FRAG) frags.push({ start: s, end: Math.min(N, s + FRAG), phase: 'waiting', t: 0, pos: 0 });
    fork = 2;
    lead = { phase: 'priming', t: 0, pos: 0 };
    time = 0;
    finished = false;
  }

  /* ---------- Model ---------- */
  function step(dt: number) {
    if (finished) return;
    const sp = opt.speed;
    time += dt;
    // The fork runs a few bases past the end so the last pairs fully separate
    fork = Math.min(N + 5, fork + FORK_RATE * sp * dt);

    // Leading strand: one primer at the origin, then continuous synthesis
    if (lead.phase === 'priming') {
      lead.t += dt * sp;
      for (let i = 0; i < PRIMER; i++) if (lead.t > (i + 1) * 0.18) bot[i] = 1;
      if (lead.t > 0.6) Object.assign(lead, { phase: 'extending', pos: PRIMER });
    } else if (lead.phase === 'extending') {
      lead.pos = Math.min(fork >= N ? N : fork - 3, lead.pos + FORK_RATE * 1.6 * sp * dt);
      for (let i = PRIMER; i < Math.floor(lead.pos); i++) bot[i] = 2;
      if (lead.pos >= N) lead.phase = 'done';
    }

    // Lagging strand fragments
    frags.forEach((f, k) => {
      if (f.phase === 'waiting' && fork >= f.end) Object.assign(f, { phase: 'priming', t: 0 });
      if (f.phase === 'priming') {
        f.t += dt * sp;
        for (let i = 0; i < PRIMER; i++) if (f.t > (i + 1) * 0.18) top[f.end - 1 - i] = 1;
        if (f.t > 0.6) Object.assign(f, { phase: 'extending', pos: f.end - PRIMER });
      } else if (f.phase === 'extending') {
        f.pos = Math.max(f.start, f.pos - FORK_RATE * 2.5 * sp * dt);
        for (let i = Math.ceil(f.pos); i < f.end - PRIMER; i++) top[i] = 2;
        if (f.pos <= f.start) Object.assign(f, k === 0 ? { phase: 'done' } : { phase: 'replacing', pos: f.start });
      } else if (f.phase === 'replacing') {
        const stop = f.start - PRIMER;
        f.pos = Math.max(stop, f.pos - FORK_RATE * 1.5 * sp * dt);
        for (let i = Math.ceil(f.pos); i < f.start; i++) top[i] = 2;
        if (f.pos <= stop) Object.assign(f, { phase: 'ligating', t: 0 });
      } else if (f.phase === 'ligating') {
        f.t += dt * sp;
        if (f.t > 0.8) f.phase = 'done';
      }
    });

    if (fork >= N + 5 && lead.phase === 'done' && frags.every((f) => f.phase === 'done')) {
      finished = true;
      sim.pause();
      sim.setBadge('Complete');
      sim.announce('Replication complete: two DNA molecules, each with one original and one new strand.');
    }
  }

  /* ---------- Layout ---------- */
  const layout = () => {
    const { w, h } = size;
    const m = Math.max(28, w * 0.05);
    const dx = (w - m * 2) / N;
    const cy = h * 0.52;
    const g = clamp(h * 0.04, 9, 16); // half-gap between paired strands
    const S = h * 0.24; // how far the daughter duplexes move apart
    return { m, dx, cy, g, S, x: (i: number) => m + (i + 0.5) * dx };
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  /** 0 where the helix is still closed, 1 once well behind the fork. */
  const open = (i: number) => smooth(clamp((fork - (i + 0.5)) / 5, 0, 1));
  /** y of the four strands at base i: top template, top new, bottom new, bottom template. */
  const ys = (i: number) => {
    const { cy, g, S } = layout();
    const s = open(i) * S;
    return { tt: cy - g - s, tn: cy + g - s, bn: cy - g + s, bt: cy + g + s };
  };

  function nickAt(): number[] {
    const out: number[] = [];
    for (const f of frags) {
      if (f.phase === 'replacing') out.push(Math.ceil(f.pos));
      if (f.phase === 'ligating') out.push(f.start - PRIMER);
    }
    return out;
  }

  /* ---------- Drawing ---------- */
  /** Draw one strand's backbone. Templates are continuous; new strands only where filled. */
  function strand(ysOf: (i: number) => number, fill: ((i: number) => Fill) | null, breaks: number[] = []) {
    const L = layout();
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const xAt = (t: number) => L.m + (t + 0.5) * L.dx;
    if (!fill) {
      ctx.strokeStyle = OLD;
      ctx.beginPath();
      for (let t = -0.5; t <= N - 0.5 + 1e-6; t += 0.25) {
        const tc = clamp(t, 0, N - 1);
        if (t === -0.5) ctx.moveTo(xAt(t), ysOf(tc));
        else ctx.lineTo(xAt(t), ysOf(tc));
      }
      ctx.stroke();
      return;
    }
    for (let i = 0; i < N; i++) {
      const a = fill(i);
      if (!a) continue;
      ctx.strokeStyle = a === 1 ? RNA : NEW;
      const joinL = i > 0 && fill(i - 1) && !breaks.includes(i);
      const joinR = i < N - 1 && fill(i + 1) && !breaks.includes(i + 1);
      const tl = i - (joinL ? 0.5 : 0.3);
      const tr = i + (joinR ? 0.5 : 0.3);
      ctx.beginPath();
      ctx.moveTo(xAt(tl), ysOf(clamp(tl, 0, N - 1)));
      ctx.lineTo(xAt(i), ysOf(i));
      ctx.lineTo(xAt(tr), ysOf(clamp(tr, 0, N - 1)));
      ctx.stroke();
    }
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const L = layout();
    const { dx, g } = L;
    const stubW = Math.max(2, dx * 0.45);
    const letters = opt.letters && dx >= 11;
    ctx.font = font(clamp(dx * 0.7, 8, 12), 700, 'mono');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bases (stubs) first, backbones on top
    const comp = (b: string) => PAIR[b];
    const rnaLetter = (b: string) => (b === 'T' ? 'U' : b);
    for (let i = 0; i < N; i++) {
      const y = ys(i);
      const x = L.x(i);
      const draws: [number, number, string][] = [];
      draws.push([y.tt, 1, seq[i]]); // top template base points down
      draws.push([y.bt, -1, comp(seq[i])]); // bottom template base points up
      if (top[i]) draws.push([y.tn, -1, top[i] === 1 ? rnaLetter(comp(seq[i])) : comp(seq[i])]);
      if (bot[i]) draws.push([y.bn, 1, bot[i] === 1 ? rnaLetter(seq[i]) : seq[i]]);
      for (const [yy, dir, b] of draws) {
        ctx.fillStyle = BASE_COLOUR[b];
        const len = g - 1.5;
        ctx.fillRect(x - stubW / 2, dir > 0 ? yy : yy - len, stubW, len);
        if (letters) {
          ctx.fillStyle = '#10131a';
          ctx.fillText(b, x, yy + dir * len * 0.55);
        }
      }
    }
    const nicks = nickAt();
    strand((i) => ys(i).tt, null);
    strand((i) => ys(i).bt, null);
    strand((i) => ys(i).tn, (i) => top[i], nicks);
    strand((i) => ys(i).bn, (i) => bot[i]);

    // Strand-end labels
    ctx.font = font(11, 700);
    ctx.fillStyle = pal['text-faint'];
    const y0 = ys(0);
    const yN = ys(N - 1);
    const lx = L.m - 14;
    const rx = L.x(N - 1) + dx / 2 + 12;
    ctx.fillText('5′', lx, y0.tt);
    ctx.fillText('3′', lx, y0.bt);
    if (top[0]) ctx.fillText('3′', lx, y0.tn);
    if (bot[0]) ctx.fillText('5′', lx, y0.bn);
    ctx.fillText('3′', rx, yN.tt);
    ctx.fillText('5′', rx, yN.bt);
    if (fork >= N) {
      if (top[N - 1]) ctx.fillText('5′', rx, yN.tn);
      if (bot[N - 1]) ctx.fillText('3′', rx, yN.bn);
    }

    // Enzymes
    enzymes = [];
    const r = clamp(dx * 1.1, 9, 16);
    const fx = L.x(Math.min(N - 1, fork - 0.5));
    if (fork < N) enzymes.push({ id: 'helicase', x: fx + dx * 0.4, y: L.cy, r: r * 1.15 });
    if (lead.phase === 'priming') enzymes.push({ id: 'primase', x: L.x(1), y: ys(1).bn - r * 0.5, r: r * 0.8 });
    if (lead.phase === 'extending') {
      const i = clamp(lead.pos, 0, N - 1);
      enzymes.push({ id: 'polLead', x: L.x(i) - dx * 0.2, y: ys(i).bn - r * 0.5, r });
    }
    for (const f of frags) {
      if (f.phase === 'priming') enzymes.push({ id: 'primase', x: L.x(f.end - 2), y: ys(f.end - 2).tn + r * 0.5, r: r * 0.8 });
      if (f.phase === 'extending') {
        const i = clamp(f.pos, 0, N - 1);
        enzymes.push({ id: 'polLag', x: L.x(i) + dx * 0.2, y: ys(i).tn + r * 0.5, r });
      }
      if (f.phase === 'replacing') {
        const i = clamp(f.pos, 0, N - 1);
        enzymes.push({ id: 'pol1', x: L.x(i), y: ys(i).tn + r * 0.5, r: r * 0.85 });
      }
      if (f.phase === 'ligating') {
        const i = f.start - PRIMER;
        const pulse = 1 + Math.sin(time * 10) * 0.08;
        enzymes.push({ id: 'ligase', x: L.x(i) - dx / 2, y: ys(i).tn + r * 0.5, r: r * 0.8 * pulse });
      }
    }
    for (const e of enzymes) {
      const info = ENZYMES[e.id];
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = info.colour;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.r, e.r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.stroke();
    }
    if (opt.enzymes) {
      ctx.font = font(11, 650);
      for (const e of enzymes) {
        const name = ENZYMES[e.id].name.replace(/ \((leading|lagging) strand\)/, '');
        // Labels point toward the open middle of the fork, away from the bases
        const above = e.id === 'helicase' || e.y > L.cy;
        const tw = ctx.measureText(name).width;
        // The leading polymerase sits just behind the helicase, so its label goes to the left
        const side = e.id === 'polLead';
        const ty = side ? e.y + e.r * 0.4 : above ? e.y - e.r - 14 : e.y + e.r + 14;
        const bx = clamp(side ? e.x - e.r - tw - 16 : e.x - tw / 2 - 5, 4, w - tw - 14);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pal['bg-elev'];
        ctx.beginPath();
        ctx.roundRect(bx, ty - 10, tw + 10, 20, 10);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal['sim-text'];
        ctx.textAlign = 'left';
        ctx.fillText(name, bx + 5, ty + 1);
        ctx.textAlign = 'center';
      }
    }

    // Strand names on the left side, once the fork has opened enough
    if (fork > 10 && w > 520) {
      ctx.font = font(11, 650);
      ctx.textAlign = 'left';
      ctx.fillStyle = pal['text-faint'];
      ctx.fillText('Lagging strand (built in fragments)', L.m, ys(0).tt - 22);
      ctx.fillText('Leading strand (built continuously)', L.m, ys(0).bt + 22);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    updateReadouts();
    sim.setTime(time);
  }

  function updateReadouts() {
    const active = frags.find((f) => f.phase === 'ligating')
      ? 'DNA ligase is sealing a nick between two fragments.'
      : frags.find((f) => f.phase === 'replacing')
        ? 'DNA polymerase I is swapping an RNA primer for DNA.'
        : frags.find((f) => f.phase === 'priming') || lead.phase === 'priming'
          ? 'Primase is laying a short RNA primer.'
          : frags.find((f) => f.phase === 'extending')
            ? 'DNA polymerase III is building an Okazaki fragment away from the fork.'
            : fork < N
              ? 'Helicase is unzipping the helix; the leading strand follows it.'
              : finished
                ? 'Done: two identical molecules, each half old and half new.'
                : 'Finishing the last fragment.';
    if (active !== stepText) stepText = active;
    ui.readout('step', stepText, finished ? 'ok' : null);
    ui.readout('fork', `${Math.min(N, Math.floor(fork))} of ${N} base pairs unzipped`);
    const copied = top.filter((v) => v === 2).length + bot.filter((v) => v === 2).length;
    ui.readout('copied', `${copied} DNA bases (${top.concat(bot).filter((v) => v === 1).length} RNA primer)`);
    const joined = frags.filter((f, k) => k > 0 && f.phase === 'done').length;
    ui.readout('frags', `${joined} of ${frags.length - 1} joins`);
  }

  /* ---------- Click to inspect ---------- */
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const enz = enzymes.find((z) => Math.hypot(px - z.x, py - z.y) <= z.r + 4);
    if (enz) {
      const info = ENZYMES[enz.id];
      sim.showTooltip(px, py, info.name, info.about);
      return;
    }
    const L = layout();
    const i = Math.floor((px - L.m) / L.dx);
    if (i < 0 || i >= N) return sim.hideTooltip();
    const y = ys(i);
    const options: [number, string, string][] = [
      [y.tt, seq[i], 'Original strand (template)'],
      [y.bt, PAIR[seq[i]], 'Original strand (template)'],
    ];
    if (top[i]) options.push([y.tn, top[i] === 1 && PAIR[seq[i]] === 'T' ? 'U' : PAIR[seq[i]], top[i] === 1 ? 'RNA primer on the lagging strand' : 'New strand (lagging, Okazaki fragment)']);
    if (bot[i]) options.push([y.bn, bot[i] === 1 && seq[i] === 'T' ? 'U' : seq[i], bot[i] === 1 ? 'RNA primer on the leading strand' : 'New strand (leading)']);
    const best = options.reduce((a, b) => (Math.abs(b[0] - py) < Math.abs(a[0] - py) ? b : a));
    if (Math.abs(best[0] - py) > L.g * 1.8) return sim.hideTooltip();
    const [, b, where] = best;
    const partner = b === 'U' ? 'A' : PAIR[b];
    sim.showTooltip(px, py, `${b}: ${BASE_NAME[b]}`, `${where}. Pairs with ${partner} (${BASE_NAME[partner]}). Base ${i + 1} of ${N}.`);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const speed = ui.range('dn-speed', (v) => `${v}×`, (v) => (opt.speed = v));
  const lettersCtl = ui.toggle('dn-letters', (v) => ((opt.letters = v), sim.requestRender()));
  const enzCtl = ui.toggle('dn-enzymes', (v) => ((opt.enzymes = v), sim.requestRender()));

  restart();
  const sim = createSimController(root, {
    step,
    render,
    reset() {
      speed.set(1);
      lettersCtl.set(true);
      enzCtl.set(true);
      restart();
      sim.setBadge('Replicating');
    },
  });
}
