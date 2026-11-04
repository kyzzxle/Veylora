/**
 * Animal classification with a dichotomous key.
 * The key is drawn as a tree; the learner answers yes/no questions for an
 * animal and gets immediate feedback if an answer is wrong.
 */
import { fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';
import { ANIMALS, GROUPS, NODES, pathTo } from './data';

const COLORS = ['sim-bg', 'sim-grid', 'sim-text', 'accent', 'accent-2', 'text-faint', 'bg-elev', 'border-strong', 'success', 'danger', 'warning'] as const;

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  leaf: boolean;
}

export function initClassification(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const animalSel = root.querySelector<HTMLSelectElement>('[data-animal]')!;
  const qEl = root.querySelector<HTMLElement>('[data-question]')!;
  const fbEl = root.querySelector<HTMLElement>('[data-feedback]')!;
  const emojiEl = root.querySelector<HTMLElement>('[data-emoji]')!;
  const answerBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-answer]')];

  const st = { animal: 0, node: 'backbone', path: [] as string[], done: false, score: 0, tried: new Set<number>(), mistakes: 0 };

  /* ---------- Tree layout ---------- */
  // Depth-first layout: leaves get evenly spaced rows, parents sit at the midpoint of their children.
  let boxes: Record<string, Box> = {};
  function layout() {
    boxes = {};
    const leaves: string[] = [];
    const depthOf: Record<string, number> = {};
    const visit = (id: string, d: number) => {
      depthOf[id] = d;
      const n = NODES[id];
      if (!n) return leaves.push(id);
      visit(n.yes, d + 1);
      visit(n.no, d + 1);
    };
    visit('backbone', 0);
    const maxD = Math.max(...Object.values(depthOf));
    const { w, h } = size;
    const colW = (w - 20) / (maxD + 1);
    const rowH = (h - 20) / leaves.length;
    const bw = Math.min(colW - 14, 150);
    const bh = Math.min(rowH - 4, 26);
    const pos = (id: string): number => {
      const n = NODES[id];
      const y = n ? (pos(n.yes) + pos(n.no)) / 2 : 10 + rowH * (leaves.indexOf(id) + 0.5);
      boxes[id] = { id, x: 10 + depthOf[id] * colW, y: y - bh / 2, w: bw, h: bh, leaf: !n };
      return y;
    };
    pos('backbone');
  }

  /* ---------- Drawing ---------- */
  function render() {
    const { w, h } = size;
    layout();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);

    const animal = ANIMALS[st.animal];
    const onPath = new Set(st.path);
    // Edges
    for (const n of Object.values(NODES)) {
      const a = boxes[n.id];
      for (const [child, label] of [
        [n.yes, 'yes'],
        [n.no, 'no'],
      ] as const) {
        const b = boxes[child];
        const active = onPath.has(n.id) && (onPath.has(child) || child === st.node);
        ctx.strokeStyle = active ? pal.accent : pal['border-strong'];
        ctx.lineWidth = active ? 3 : 1.2;
        ctx.beginPath();
        ctx.moveTo(a.x + a.w, a.y + a.h / 2);
        const mx = (a.x + a.w + b.x) / 2;
        ctx.bezierCurveTo(mx, a.y + a.h / 2, mx, b.y + b.h / 2, b.x, b.y + b.h / 2);
        ctx.stroke();
        ctx.fillStyle = active ? pal.accent : pal['text-faint'];
        ctx.font = font(9, 600);
        ctx.fillText(label, mx - 6, (a.y + b.y) / 2 + a.h / 2 + (label === 'yes' ? -3 : 9));
      }
    }
    // Boxes
    for (const b of Object.values(boxes)) {
      const current = b.id === st.node && !st.done;
      const visited = onPath.has(b.id);
      const finalHit = st.done && b.id === animal.group;
      ctx.fillStyle = finalHit ? pal.success : current ? pal.accent : pal['bg-elev'];
      ctx.strokeStyle = visited || current ? pal.accent : b.leaf ? pal['accent-2'] : pal['border-strong'];
      ctx.lineWidth = current || finalHit ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, b.leaf ? b.h / 2 : 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = finalHit || current ? '#fff' : b.leaf ? pal['accent-2'] : pal['sim-text'];
      ctx.font = font(b.w < 110 ? 9 : 11, b.leaf ? 700 : 600);
      ctx.textAlign = 'center';
      const text = b.leaf ? GROUPS[b.id].name.replace(' (segmented worms)', '') : NODES[b.id].short;
      ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2 + 4, b.w - 6);
      ctx.textAlign = 'left';
    }
    // Animal token on the current box
    const cur = boxes[st.done ? animal.group : st.node];
    if (cur) {
      ctx.font = '22px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(animal.emoji, cur.x - 4, cur.y - 4);
    }

    // Panel
    emojiEl.textContent = animal.emoji;
    if (st.done) {
      qEl.textContent = `${animal.name} is in the group: ${GROUPS[animal.group].name}.`;
      answerBtns.forEach((b) => (b.disabled = true));
    } else {
      qEl.textContent = NODES[st.node].q;
      answerBtns.forEach((b) => (b.disabled = false));
    }
    ui.readout('animal', `${animal.emoji} ${animal.name}`);
    ui.readout('steps', String(st.path.length));
    ui.readout('group', st.done ? GROUPS[animal.group].name : 'Keep going…', st.done ? 'ok' : null);
    ui.readout('score', `${st.score} of ${ANIMALS.length}`);
    canvas.setAttribute(
      'aria-label',
      st.done ? `${animal.name} was classified as ${GROUPS[animal.group].name}.` : `Classifying ${animal.name}. Current question: ${NODES[st.node].q}`,
    );
  }

  /* ---------- Logic ---------- */
  const ui = controls(root);
  function start(i: number) {
    st.animal = i;
    st.node = 'backbone';
    st.path = [];
    st.done = false;
    st.mistakes = 0;
    animalSel.value = String(i);
    answerBtns.forEach((b) => (b.disabled = false));
    fbEl.textContent = '';
    fbEl.className = 'cls-feedback';
    sim.requestRender();
  }

  function answer(yes: boolean) {
    if (st.done) return;
    const animal = ANIMALS[st.animal];
    const correct = pathTo(animal.group).find(([id]) => id === st.node)?.[1];
    if (correct === undefined) return;
    if (yes !== correct) {
      st.mistakes++;
      const note = animal.notes?.[st.node];
      fbEl.textContent = `Not quite. ${note ?? `For a ${animal.name.toLowerCase()}, the answer is “${correct ? 'yes' : 'no'}”.`} Try again.`;
      fbEl.className = 'cls-feedback no';
      sim.announce(fbEl.textContent);
      return;
    }
    st.path.push(st.node);
    const next = yes ? NODES[st.node].yes : NODES[st.node].no;
    const note = animal.notes?.[st.node];
    fbEl.textContent = note ? `Correct — ${note}` : 'Correct!';
    fbEl.className = 'cls-feedback ok';
    if (GROUPS[next]) {
      st.done = true;
      if (st.mistakes === 0 && !st.tried.has(st.animal)) st.score++;
      st.tried.add(st.animal);
      fbEl.textContent = `${note ? `${note} ` : ''}${animal.name}: ${GROUPS[next].name}. ${GROUPS[next].about}`;
      sim.announce(`${animal.name} is classified as ${GROUPS[next].name}.`);
    } else {
      st.node = next;
    }
    sim.requestRender();
  }

  answerBtns.forEach((b) => b.addEventListener('click', () => answer(b.dataset.answer === 'yes')));
  animalSel.addEventListener('change', () => start(Number(animalSel.value)));
  root.querySelector('[data-next]')!.addEventListener('click', () => {
    const untried = ANIMALS.map((_, i) => i).filter((i) => !st.tried.has(i) && i !== st.animal);
    const pool = untried.length ? untried : ANIMALS.map((_, i) => i).filter((i) => i !== st.animal);
    start(pool[Math.floor(Math.random() * pool.length)]);
  });
  root.querySelector('[data-reveal]')!.addEventListener('click', () => {
    const animal = ANIMALS[st.animal];
    st.tried.add(st.animal);
    st.path = pathTo(animal.group).map(([id]) => id);
    st.done = true;
    fbEl.textContent = `${animal.name}: ${GROUPS[animal.group].name}. ${GROUPS[animal.group].about}`;
    fbEl.className = 'cls-feedback';
    sim.requestRender();
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const b = Object.values(boxes).find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (!b) return;
    if (b.leaf) {
      const g = GROUPS[b.id];
      const members = ANIMALS.filter((a) => a.group === b.id).map((a) => `${a.emoji} ${a.name}`).join(', ');
      sim.showTooltip(x, y, g.name, `${g.about} Examples: ${members}.`);
    } else {
      sim.showTooltip(x, y, NODES[b.id].short, NODES[b.id].q);
    }
  });

  const sim = createSimController(root, {
    render,
    reset() {
      st.score = 0;
      st.tried.clear();
      start(0);
    },
  });
  start(0);
}
