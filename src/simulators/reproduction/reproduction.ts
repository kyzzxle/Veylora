/**
 * Human reproductive system: four views.
 *   female  – schematic front view: ovaries, fallopian tubes, uterus, cervix,
 *             vagina, with an egg released at ovulation travelling down a tube
 *   male    – schematic front view: testes, epididymis, vas deferens, seminal
 *             vesicles, prostate, urethra, with sperm transported from the
 *             testes through the ducts
 *   cycle   – an idealised 28-day menstrual cycle: FSH, LH, oestrogen and
 *             progesterone (relative levels), the ovary and the uterine lining
 *   fertilisation – days 0–10 after fertilisation: zygote, cleavage, morula,
 *             blastocyst, implantation
 * Diagrams are deliberately simple, neutral textbook schematics.
 */
import { clamp, fitCanvas, readPalette } from '../shared';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { font } from '../shared/draw';

const COLORS = ['sim-bg', 'sim-text', 'text-faint', 'bg-elev', 'border', 'accent', 'warning', 'danger', 'success'] as const;
type View = 'female' | 'male' | 'cycle' | 'fert';

const INFO: Record<string, [string, string]> = {
  ovary: ['Ovary', 'Produces egg cells (ova) and the hormones oestrogen and progesterone. A person is born with all the immature eggs they will ever have.'],
  tube: ['Fallopian tube (oviduct)', 'Carries the egg from the ovary to the uterus. Fertilisation usually happens here. Tiny hairs (cilia) and muscle contractions move the egg along.'],
  fimbriae: ['Fimbriae', 'Finger-like ends of the fallopian tube that sweep the released egg into the tube.'],
  uterus: ['Uterus (womb)', 'A strong, muscular organ where a fertilised egg can implant and develop into a baby over about 40 weeks.'],
  lining: ['Endometrium (uterine lining)', 'The inner lining of the uterus. It thickens each cycle ready for a possible pregnancy and is shed as a period if no pregnancy occurs.'],
  cervix: ['Cervix', 'The narrow neck of the uterus. It produces mucus that changes during the cycle and widens greatly during birth.'],
  vagina: ['Vagina', 'A muscular canal that connects the cervix to the outside of the body. It is also the birth canal.'],
  testis: ['Testis (testicle)', 'Produces sperm in coiled seminiferous tubules, and the hormone testosterone. Sperm production takes about 74 days.'],
  scrotum: ['Scrotum', 'Holds the testes outside the body, where it is about 2–3 °C cooler: sperm production needs a slightly lower temperature.'],
  epididymis: ['Epididymis', 'A tightly coiled tube about 6 m long on the back of each testis, where sperm mature and are stored.'],
  vas: ['Vas deferens (sperm duct)', 'A muscular tube that carries sperm from the epididymis up and over the bladder towards the urethra.'],
  vesicle: ['Seminal vesicle', 'Adds a sugary fluid (fructose) that gives sperm energy. It makes up most of the volume of semen.'],
  prostate: ['Prostate gland', 'Adds a slightly alkaline fluid that helps sperm survive. It surrounds the urethra just below the bladder.'],
  urethra: ['Urethra', 'In males it carries both urine and semen (at different times) out of the body.'],
  bladder: ['Bladder', 'Part of the urinary system, shown for position.'],
  penis: ['Penis', 'Contains the urethra, which carries urine or semen out of the body.'],
};

const g = (d: number, c: number, w: number) => Math.exp(-(((d - c) / w) ** 2));
/** Relative hormone levels (0–1) on day d of an idealised 28-day cycle. */
function hormones(d: number, pregnant: boolean) {
  let fsh = 0.32 + 0.2 * g(d, 3, 3) + 0.35 * g(d, 13.8, 1.1) - 0.12 * g(d, 21, 5);
  let lh = 0.18 + 0.85 * g(d, 14, 0.9);
  let oes = 0.15 + 0.72 * g(d, 12.5, 2.4) + 0.35 * g(d, 21, 3.5);
  let prog = 0.05 + 0.85 * g(d, 21, 3.6);
  let hcg = 0;
  if (pregnant && d > 19) {
    // hCG from the implanted embryo keeps the corpus luteum making hormones
    const f = clamp((d - 19) / 4, 0, 1);
    prog = Math.max(prog, 0.05 + 0.85 * g(21, 21, 3.6) * (0.9 + 0.1 * f));
    oes = Math.max(oes, 0.5 + 0.1 * f);
    fsh = Math.min(fsh, 0.2);
    lh = Math.min(lh, 0.2);
    hcg = clamp((d - 21) / 7, 0, 1);
  }
  return { fsh, lh, oes, prog, hcg };
}
/** Uterine lining thickness in mm. */
function lining(d: number, pregnant: boolean) {
  if (d <= 5) return 8 - ((d - 1) / 4) * 6;
  if (d <= 14) return 2 + ((d - 5) / 9) * 7;
  if (pregnant) return 9 + Math.min(4, (d - 14) * 0.3);
  if (d <= 25) return 9 + ((d - 14) / 11) * 3;
  return 12 - ((d - 25) / 3) * 3;
}
const cyclePhase = (d: number, pregnant: boolean) =>
  d <= 5 ? 'Menstruation (period)' : d < 13 ? 'Follicular phase' : d <= 15 ? 'Ovulation' : pregnant && d > 21 ? 'Early pregnancy' : 'Luteal phase';
const cycleText = (d: number, pregnant: boolean) =>
  d <= 5
    ? 'Levels of oestrogen and progesterone are low, so the thickened lining from the last cycle breaks down and is shed: a period. FSH starts to rise.'
    : d < 13
      ? 'FSH stimulates follicles in the ovary to grow. The leading follicle makes oestrogen, which rebuilds the uterine lining.'
      : d <= 15
        ? 'High oestrogen triggers a surge of LH (and FSH) from the pituitary. About a day later, the mature follicle releases an egg: ovulation.'
        : pregnant && d > 21
          ? 'An embryo has implanted and makes hCG, which keeps the corpus luteum producing progesterone. The lining is maintained and there is no period. Pregnancy tests detect hCG.'
          : d < 25
            ? 'The empty follicle becomes the corpus luteum, which makes progesterone. Progesterone keeps the lining thick and rich in blood vessels, ready for a possible embryo.'
            : 'Without a pregnancy, the corpus luteum breaks down. Progesterone and oestrogen fall, and soon the lining will be shed again.';

const STAGES: [number, string, string, string][] = [
  [0, 'Fertilisation', '1 cell', 'A single sperm enters the egg in the fallopian tube. Their nuclei combine to form a zygote with a full set of 46 chromosomes.'],
  [1, 'Zygote divides', '2 cells', 'About a day later the zygote divides by mitosis into two cells. It does not grow; the cells just get smaller.'],
  [2, 'Cleavage', '4 cells', 'Cells keep dividing as cilia and muscles move the embryo along the tube.'],
  [3, 'Cleavage', '8 cells', 'At this stage each cell could still become any type of body cell.'],
  [4, 'Morula', 'about 16–32 cells', 'A solid ball of cells, named after the Latin for mulberry, reaches the uterus.'],
  [5, 'Blastocyst', 'about 100 cells', 'A hollow ball with an inner cell mass (which becomes the embryo) and an outer layer (which helps form the placenta).'],
  [6, 'Implantation begins', 'about 100+ cells', 'The blastocyst hatches from its protective coat and starts to burrow into the thick uterine lining.'],
  [8, 'Implanted', 'hundreds of cells', 'The embryo is embedded in the lining and starts releasing hCG, which signals that a pregnancy has begun.'],
  [10, 'Early embryo', 'thousands of cells', 'Implantation is complete. Over the next weeks the placenta forms and organs begin to develop.'],
];

export function initReproduction(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const { ctx, size } = fitCanvas(canvas, () => sim.requestRender());
  let pal = readPalette(COLORS);
  window.addEventListener('themechange', () => (pal = readPalette(COLORS)));
  const noteEl = root.querySelector<HTMLElement>('[data-note]')!;

  const st = { view: 'female' as View, day: 14, fertDay: 0, pregnant: false, labels: true };
  let t = 0;
  // clickable regions; tubes are hit-tested along their outline (stroke width)
  let hit: { id: string; path: Path2D; stroke?: number }[] = [];

  function step(dt: number) {
    t += dt;
    if (st.view === 'cycle') {
      st.day += dt * 2;
      if (st.day > 28.99) st.day = 1;
      dayCtl.set(Math.round(st.day * 2) / 2, false);
    } else if (st.view === 'fert') {
      st.fertDay += dt * 0.6;
      if (st.fertDay > 10) {
        st.fertDay = 10;
        sim.pause();
      }
      fertCtl.set(Math.round(st.fertDay * 10) / 10, false);
    }
  }

  /* ---------- Drawing (design box 1000 × 560) ---------- */
  const tf = () => {
    const k = Math.min(size.w / 1000, size.h / 560);
    return { k, ox: (size.w - 1000 * k) / 2, oy: (size.h - 560 * k) / 2 };
  };

  function region(id: string, draw: (p: Path2D) => void, fill: string, stroke?: string, width = 2) {
    const p = new Path2D();
    draw(p);
    hit.push({ id, path: p });
    ctx.fillStyle = fill;
    ctx.fill(p);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke(p);
    }
  }
  function tube(id: string, pts: [number, number][], width: number, colour: string) {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(p);
    hit.push({ id, path: p, stroke: width + 10 });
  }
  const along = (pts: [number, number][], f: number): [number, number] => {
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    let d = clamp(f, 0, 1) * lens.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i]) return [pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * d) / lens[i], pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * d) / lens[i]];
      d -= lens[i];
    }
    return pts[pts.length - 1];
  };

  /** Female schematic. Returns the path of the right-hand tube for animations. */
  function drawFemale(cx: number, cy: number, s: number, liningMm: number) {
    const tubeR: [number, number][] = [[cx + 40 * s, cy - 60 * s], [cx + 110 * s, cy - 85 * s], [cx + 175 * s, cy - 70 * s], [cx + 205 * s, cy - 25 * s]];
    const tubeL: [number, number][] = tubeR.map(([x, y]) => [2 * cx - x, y]);
    tube('tube', tubeL, 9 * s, '#d98f8f');
    tube('tube', tubeR, 9 * s, '#d98f8f');
    // fimbriae
    for (const side of [-1, 1]) {
      const fx = cx + side * 210 * s;
      for (let i = -2; i <= 2; i++) {
        ctx.strokeStyle = '#d98f8f';
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.moveTo(fx - side * 5 * s, cy - 25 * s);
        ctx.lineTo(fx + side * 8 * s + i * 4 * s, cy - 2 * s + Math.abs(i) * 3 * s);
        ctx.stroke();
      }
      hit.push({ id: 'fimbriae', path: (() => { const p = new Path2D(); p.arc(fx, cy - 12 * s, 18 * s, 0, Math.PI * 2); return p; })() });
    }
    // ovaries
    for (const side of [-1, 1]) region('ovary', (p) => p.ellipse(cx + side * 190 * s, cy + 22 * s, 32 * s, 20 * s, side * 0.3, 0, Math.PI * 2), '#e8b4a8', '#c58c80');
    // uterus body
    region(
      'uterus',
      (p) => {
        p.moveTo(cx - 70 * s, cy - 70 * s);
        p.quadraticCurveTo(cx, cy - 100 * s, cx + 70 * s, cy - 70 * s);
        p.quadraticCurveTo(cx + 75 * s, cy + 20 * s, cx + 22 * s, cy + 80 * s);
        p.lineTo(cx - 22 * s, cy + 80 * s);
        p.quadraticCurveTo(cx - 75 * s, cy + 20 * s, cx - 70 * s, cy - 70 * s);
      },
      '#e39a9a',
      '#c47474',
    );
    // endometrium (inner lining) – thickness shown by the size of the inner layer
    const lt = clamp(liningMm / 12, 0.1, 1.1);
    region(
      'lining',
      (p) => {
        p.moveTo(cx - 45 * s, cy - 55 * s);
        p.quadraticCurveTo(cx, cy - 72 * s, cx + 45 * s, cy - 55 * s);
        p.quadraticCurveTo(cx + 46 * s, cy + 10 * s, cx + 10 * s, cy + 62 * s);
        p.lineTo(cx - 10 * s, cy + 62 * s);
        p.quadraticCurveTo(cx - 46 * s, cy + 10 * s, cx - 45 * s, cy - 55 * s);
      },
      `rgba(196, 70, 90, ${0.25 + lt * 0.5})`,
    );
    // cavity
    ctx.fillStyle = '#f6d6d6';
    ctx.beginPath();
    ctx.moveTo(cx - 45 * s + 22 * lt * s, cy - 50 * s + 6 * lt * s);
    ctx.quadraticCurveTo(cx, cy - 64 * s + 14 * lt * s, cx + 45 * s - 22 * lt * s, cy - 50 * s + 6 * lt * s);
    ctx.lineTo(cx + 4 * s, cy + 56 * s);
    ctx.lineTo(cx - 4 * s, cy + 56 * s);
    ctx.closePath();
    ctx.fill();
    // cervix and vagina
    region('cervix', (p) => p.rect(cx - 22 * s, cy + 78 * s, 44 * s, 26 * s), '#d48888', '#c47474');
    region('vagina', (p) => p.roundRect(cx - 18 * s, cy + 104 * s, 36 * s, 90 * s, 8 * s), '#e6b0b0', '#c47474');
    return tubeR;
  }

  function drawMale(cx: number, cy: number) {
    // bladder
    region('bladder', (p) => p.ellipse(cx, cy - 150, 70, 52, 0, 0, Math.PI * 2), 'rgba(232, 201, 106, 0.45)', '#c9a64a');
    // seminal vesicles
    for (const side of [-1, 1]) region('vesicle', (p) => p.ellipse(cx + side * 68, cy - 92, 16, 34, side * -0.5, 0, Math.PI * 2), '#c7a4d6', '#9c78ae');
    // prostate
    region('prostate', (p) => p.ellipse(cx, cy - 72, 34, 24, 0, 0, Math.PI * 2), '#b5a0c9', '#8f79a8');
    // urethra and penis (simple tube)
    region('penis', (p) => p.roundRect(cx - 20, cy - 44, 40, 150, 18), '#e2b7a4', '#c09080');
    tube('urethra', [[cx, cy - 110], [cx, cy + 100]], 7, '#e8c96a');
    // scrotum and testes
    region('scrotum', (p) => p.ellipse(cx, cy + 40, 95, 62, 0, 0, Math.PI * 2), 'rgba(226, 183, 164, 0.55)', '#c09080');
    const vas: [number, number][][] = [];
    for (const side of [-1, 1]) {
      region('testis', (p) => p.ellipse(cx + side * 48, cy + 42, 28, 38, 0, 0, Math.PI * 2), '#e8c0b0', '#b58a7a');
      // epididymis along the outer side
      tube('epididymis', [[cx + side * 70, cy + 70], [cx + side * 80, cy + 40], [cx + side * 72, cy + 10]], 10, '#c98b6b');
      const path: [number, number][] = [[cx + side * 72, cy + 10], [cx + side * 100, cy - 30], [cx + side * 115, cy - 130], [cx + side * 90, cy - 200], [cx + side * 40, cy - 190], [cx + side * 38, cy - 120], [cx + side * 12, cy - 80]];
      tube('vas', path, 5, '#7d8fd6');
      vas.push(path);
    }
    return vas;
  }

  function drawSperm(x: number, y: number, ang: number, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = '#3a6fd8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a6fd8';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(-4 * s, 0);
    for (let i = 1; i <= 8; i++) ctx.lineTo(-4 * s - i * 2.2 * s, Math.sin(t * 20 + i) * 2 * s);
    ctx.stroke();
    ctx.restore();
  }

  function tagAt(text: string, x: number, y: number, fs: (n: number, w?: number) => string, k: number) {
    if (!st.labels) return;
    ctx.font = fs(11, 700);
    const tw = ctx.measureText(text).width;
    const ph = 20 / k;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pal['bg-elev'];
    ctx.beginPath();
    ctx.roundRect(x - tw / 2 - 6 / k, y - ph / 2, tw + 12 / k, ph, ph / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal['sim-text'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function render() {
    const { w, h } = size;
    ctx.fillStyle = pal['sim-bg'];
    ctx.fillRect(0, 0, w, h);
    const { k, ox, oy } = tf();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const fs = (px: number, wt = 650) => font(px / k, wt);
    hit = [];

    if (st.view === 'female') {
      const tubeR = drawFemale(400, 250, 1.25, 9);
      // ovulated egg travels down the tube towards the uterus
      const f = (t * 0.12) % 1;
      const [ex, ey] = along([...tubeR].reverse(), f);
      ctx.fillStyle = '#f6e6a8';
      ctx.strokeStyle = '#d4b04a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      tagAt('Ovary', 400 - 240, 300, fs, k);
      tagAt('Ovary', 400 + 240, 300, fs, k);
      tagAt('Fallopian tube', 400 - 140, 120, fs, k);
      tagAt('Uterus', 400 + 120, 210, fs, k);
      tagAt('Lining (endometrium)', 400, 250, fs, k);
      tagAt('Cervix', 400 + 90, 365, fs, k);
      tagAt('Vagina', 400 + 80, 440, fs, k);
      tagAt('Egg', ex, ey - 20, fs, k);
      drawEggCell(820, 290, fs, k);
    } else if (st.view === 'male') {
      const vas = drawMale(400, 330);
      // sperm move from testis up the vas deferens to the urethra
      for (let i = 0; i < 10; i++) {
        const path = vas[i % 2];
        const f = (t * 0.1 + i / 10) % 1;
        const [x, y] = along(path, f);
        const [x2, y2] = along(path, Math.min(1, f + 0.01));
        drawSperm(x, y, Math.atan2(y2 - y, x2 - x), 1.5);
      }
      tagAt('Bladder', 400, 180, fs, k);
      tagAt('Seminal vesicle', 400 - 150, 230, fs, k);
      tagAt('Prostate', 400 + 110, 258, fs, k);
      tagAt('Vas deferens', 400 + 175, 160, fs, k);
      tagAt('Urethra', 400 + 70, 330, fs, k);
      tagAt('Epididymis', 400 - 150, 370, fs, k);
      tagAt('Testis', 400 + 140, 410, fs, k);
      tagAt('Scrotum', 400, 470, fs, k);
      drawSpermCell(820, 290, fs, k);
    } else if (st.view === 'cycle') drawCycle(fs, k);
    else drawFertilisation(fs, k);

    ctx.restore();
    updateReadouts();
  }

  function drawEggCell(cx: number, cy: number, fs: (n: number, w?: number) => string, k: number) {
    ctx.fillStyle = pal['text-faint'];
    ctx.font = fs(12, 750);
    ctx.textAlign = 'center';
    ctx.fillText('Egg cell (magnified)', cx, cy - 120);
    ctx.fillStyle = 'rgba(240, 220, 160, 0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6e6a8';
    ctx.beginPath();
    ctx.arc(cx, cy, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8e6bd8';
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 5, 18, 0, Math.PI * 2);
    ctx.fill();
    tagAt('Nucleus (23 chromosomes)', cx, cy + 22, fs, k);
    tagAt('Food store (cytoplasm)', cx, cy + 52, fs, k);
    tagAt('Protective coat', cx, cy - 95, fs, k);
    ctx.font = fs(11, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('About 0.1 mm: the largest human cell', cx, cy + 120);
  }
  function drawSpermCell(cx: number, cy: number, fs: (n: number, w?: number) => string, k: number) {
    ctx.fillStyle = pal['text-faint'];
    ctx.font = fs(12, 750);
    ctx.textAlign = 'center';
    ctx.fillText('Sperm cell (magnified)', cx, cy - 120);
    drawSperm(cx + 45, cy - 20, Math.PI, 7);
    tagAt('Head: nucleus', cx + 45, cy - 58, fs, k);
    tagAt('Acrosome: enzymes', cx + 50, cy + 22, fs, k);
    tagAt('Midpiece: mitochondria', cx - 10, cy + 55, fs, k);
    tagAt('Tail: swims', cx - 60, cy - 58, fs, k);
    ctx.font = fs(11, 600);
    ctx.fillStyle = pal['text-faint'];
    ctx.fillText('About 0.05 mm long', cx, cy + 120);
  }

  function drawCycle(fs: (n: number, w?: number) => string, k: number) {
    const X = (d: number) => 90 + ((d - 1) / 27) * 860;
    const top = 75;
    const gh = 180;
    // hormone graph
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1 / k;
    for (const d of [1, 7, 14, 21, 28]) {
      ctx.beginPath();
      ctx.moveTo(X(d), top);
      ctx.lineTo(X(d), 520);
      ctx.stroke();
      ctx.font = fs(11, 650);
      ctx.fillStyle = pal['text-faint'];
      ctx.textAlign = 'center';
      ctx.fillText(`Day ${d}`, X(d), 540);
    }
    const series: [keyof ReturnType<typeof hormones>, string, string][] = [
      ['fsh', '#4c8dd6', 'FSH'],
      ['lh', '#e0605a', 'LH'],
      ['oes', '#e0a43a', 'Oestrogen'],
      ['prog', '#8e6bd8', 'Progesterone'],
    ];
    if (st.pregnant) series.push(['hcg', '#3fb68b', 'hCG']);
    for (const [key, colour, name] of series) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 3 / k;
      ctx.beginPath();
      for (let d = 1; d <= 28; d += 0.25) {
        const v = hormones(d, st.pregnant)[key];
        const y = top + gh - v * gh;
        d === 1 ? ctx.moveTo(X(d), y) : ctx.lineTo(X(d), y);
      }
      ctx.stroke();
      ctx.fillStyle = colour;
      ctx.font = fs(11, 750);
      ctx.textAlign = 'left';
      const lx = name === 'hCG' ? X(25) : name === 'LH' ? X(15) : name === 'FSH' ? X(4) : name === 'Oestrogen' ? X(8.5) : X(22);
      const ly = top + gh - hormones(name === 'hCG' ? 26 : name === 'LH' ? 14 : name === 'FSH' ? 3 : name === 'Oestrogen' ? 11 : 21, st.pregnant)[key] * gh - 8;
      ctx.fillText(name, lx, ly);
    }
    ctx.fillStyle = pal['text-faint'];
    ctx.font = fs(11, 700);
    ctx.textAlign = 'left';
    ctx.fillText('Hormone levels (relative)', 10, top - 14);
    // ovary strip
    const oy = 300;
    ctx.fillText('Ovary', 10, oy + 5);
    for (let d = 1; d <= 28; d += 3) {
      const x = X(d + 1);
      if (d < 14) {
        const r = 6 + d * 1.4;
        ctx.fillStyle = '#f6e6a8';
        ctx.strokeStyle = '#d4b04a';
        ctx.beginPath();
        ctx.arc(x, oy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (d < 16) {
        ctx.fillStyle = '#f6e6a8';
        ctx.beginPath();
        ctx.arc(x, oy, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const fade = st.pregnant ? 1 : clamp(1 - (d - 22) / 6, 0.2, 1);
        ctx.fillStyle = `rgba(226, 180, 60, ${fade})`;
        ctx.beginPath();
        ctx.arc(x, oy, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.font = fs(10.5, 650);
    ctx.fillStyle = pal['text-faint'];
    ctx.textAlign = 'center';
    ctx.fillText('Follicle grows', X(7), oy + 36);
    ctx.fillText('Egg released', X(14.5), oy + 36);
    ctx.fillText(st.pregnant ? 'Corpus luteum kept' : 'Corpus luteum', X(22), oy + 36);
    // uterine lining
    const ly = 470;
    ctx.textAlign = 'left';
    ctx.fillText('Uterine lining', 10, ly - 50);
    ctx.fillStyle = 'rgba(196, 70, 90, 0.75)';
    ctx.beginPath();
    ctx.moveTo(X(1), ly);
    for (let d = 1; d <= 28; d += 0.25) ctx.lineTo(X(d), ly - lining(d, st.pregnant) * 7);
    ctx.lineTo(X(28), ly);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e39a9a';
    ctx.fillRect(X(1), ly, X(28) - X(1), 14);
    if (!st.pregnant) {
      // menstrual flow on days 1–5
      ctx.fillStyle = '#b3243a';
      for (let d = 1; d <= 5; d += 0.5) {
        ctx.beginPath();
        ctx.arc(X(d), ly + 22, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // current day marker
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3 / k;
    ctx.beginPath();
    ctx.moveTo(X(st.day), top - 6);
    ctx.lineTo(X(st.day), 530);
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.font = fs(12, 800);
    ctx.textAlign = 'center';
    ctx.fillText(`Day ${Math.floor(st.day)}`, X(st.day), top - 12);
  }

  function drawFertilisation(fs: (n: number, w?: number) => string, k: number) {
    const tubeR = drawFemale(330, 250, 1.1, 11);
    const d = st.fertDay;
    // route: from the outer part of the tube (where fertilisation happens) into the uterus
    const rev = [...tubeR].reverse();
    const route: [number, number][] = [along(rev, 0.25), rev[1], rev[2], rev[3], [348, 220]];
    const [x, y] = along(route, clamp(d / 5.5, 0, 1));
    const stage = [...STAGES].reverse().find((s) => d >= s[0])!;
    // embryo marker
    ctx.fillStyle = '#f6e6a8';
    ctx.strokeStyle = '#d4b04a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (d < 0.3)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t;
        drawSperm(x + Math.cos(a) * 26, y + Math.sin(a) * 26, a + Math.PI, 0.7);
      }
    tagAt(stage[1], x, y - 24, fs, k);
    // magnified view of the current stage
    const cx = 790;
    const cy = 250;
    ctx.fillStyle = pal['text-faint'];
    ctx.font = fs(12, 750);
    ctx.textAlign = 'center';
    ctx.fillText(`Day ${d.toFixed(1)}: ${stage[1]} (magnified)`, cx, cy - 140);
    ctx.fillStyle = 'rgba(240, 220, 160, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fill();
    const cells = d < 1 ? 1 : d < 2 ? 2 : d < 3 ? 4 : d < 4 ? 8 : d < 5 ? 24 : 60;
    if (d >= 5) {
      // blastocyst: hollow ball with an inner cell mass
      ctx.strokeStyle = '#d4a04a';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c97f3c';
      ctx.beginPath();
      ctx.ellipse(cx - 40, cy - 20, 32, 40, 0.4, 0, Math.PI * 2);
      ctx.fill();
      tagAt('Inner cell mass (becomes the embryo)', cx, cy + 10, fs, k);
      tagAt('Outer layer (helps form the placenta)', cx, cy + 105, fs, k);
      if (d >= 6) {
        ctx.fillStyle = 'rgba(196, 70, 90, 0.4)';
        ctx.fillRect(cx - 130, cy + 70, 260, 50);
        tagAt('Uterine lining', cx, cy + 130, fs, k);
      }
    } else if (cells === 1) {
      ctx.fillStyle = '#f6e6a8';
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8e6bd8';
      ctx.beginPath();
      ctx.arc(cx - 14, cy, 16, 0, Math.PI * 2);
      ctx.arc(cx + 14, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      tagAt(d < 0.4 ? 'Egg and sperm nuclei meeting' : 'Zygote: 46 chromosomes', cx, cy + 40, fs, k);
    } else {
      const r = 80 / Math.sqrt(cells) * 0.95;
      for (let i = 0; i < cells; i++) {
        const a = i * 2.399;
        const rr = Math.sqrt(i / cells) * (80 - r);
        ctx.fillStyle = '#f6e6a8';
        ctx.strokeStyle = '#d4b04a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function updateReadouts() {
    const r = (name: string, label: string, text: string, tone: 'ok' | 'warn' | 'bad' | null = null) => {
      ui.readout(name, text, tone);
      const dt = root.querySelector(`[data-readout="${name}"]`)?.closest('div')?.querySelector('dt');
      if (dt && dt.textContent !== label) dt.textContent = label;
    };
    if (st.view === 'female') {
      r('r1', 'Gametes made', 'Egg cells (ova), usually one released per cycle');
      r('r2', 'Main hormones', 'Oestrogen and progesterone (from the ovaries)');
      r('r3', 'Where fertilisation happens', 'In a fallopian tube');
      r('r4', 'Chromosomes in an egg', '23 (half the usual 46)');
      sim.setBadge('Female anatomy');
      noteEl.textContent = 'Click any structure to learn its job. The egg released at ovulation is swept into the fallopian tube and moves towards the uterus over a few days.';
    } else if (st.view === 'male') {
      r('r1', 'Gametes made', 'Sperm cells: millions every day from puberty onwards');
      r('r2', 'Main hormone', 'Testosterone (from the testes)');
      r('r3', 'Route of sperm', 'Testis → epididymis → vas deferens → urethra');
      r('r4', 'Chromosomes in a sperm', '23 (half the usual 46)');
      sim.setBadge('Male anatomy');
      noteEl.textContent = 'Sperm are made in the testes by meiosis, mature in the epididymis, then travel along the vas deferens. Fluids from the seminal vesicles and prostate join them to form semen.';
    } else if (st.view === 'cycle') {
      const d = Math.floor(st.day);
      const h = hormones(st.day, st.pregnant);
      const top = (Object.entries({ FSH: h.fsh, LH: h.lh, Oestrogen: h.oes, Progesterone: h.prog, hCG: h.hcg }) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0];
      r('r1', 'Day of cycle', `${d} of 28`);
      r('r2', 'Phase', cyclePhase(st.day, st.pregnant), d >= 13 && d <= 15 ? 'ok' : null);
      r('r3', 'Highest hormone now', top);
      r('r4', 'Uterine lining', `about ${lining(st.day, st.pregnant).toFixed(0)} mm thick`);
      sim.setBadge(cyclePhase(st.day, st.pregnant));
      noteEl.textContent = cycleText(st.day, st.pregnant);
    } else {
      const stage = [...STAGES].reverse().find((s) => st.fertDay >= s[0])!;
      r('r1', 'Days after fertilisation', st.fertDay.toFixed(1));
      r('r2', 'Stage', stage[1]);
      r('r3', 'Number of cells', stage[2]);
      r('r4', 'Where it is', st.fertDay < 4 ? 'Travelling along the fallopian tube' : st.fertDay < 6 ? 'Free in the uterus' : 'Implanting in the uterine lining');
      sim.setBadge(stage[1]);
      noteEl.textContent = stage[3];
    }
  }

  /* ---------- Interaction ---------- */
  canvas.addEventListener('click', (e) => {
    if (st.view === 'cycle' || st.view === 'fert') return;
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = tf();
    const x = (e.clientX - r.left) * size.dpr;
    const y = (e.clientY - r.top) * size.dpr;
    ctx.save();
    ctx.setTransform(size.dpr * k, 0, 0, size.dpr * k, ox * size.dpr, oy * size.dpr);
    let found: string | null = null;
    // later-drawn shapes are on top: search from the end
    for (let i = hit.length - 1; i >= 0 && !found; i--) {
      const hh = hit[i];
      if (hh.stroke) {
        ctx.lineWidth = hh.stroke;
        if (ctx.isPointInStroke(hh.path, x, y)) found = hh.id;
      } else if (ctx.isPointInPath(hh.path, x, y)) found = hh.id;
    }
    ctx.restore();
    if (!found) return sim.hideTooltip();
    sim.showTooltip(e.clientX - r.left, e.clientY - r.top, INFO[found][0], INFO[found][1]);
  });

  /* ---------- Controls ---------- */
  const ui = controls(root);
  const viewCtl = ui.choice<View>('rp-view', (v) => {
    st.view = v;
    ui.showWhen('[data-only="cycle"]', v === 'cycle');
    ui.showWhen('[data-only="fert"]', v === 'fert');
    if (v === 'fert') st.fertDay = 0;
    sim.hideTooltip();
    sim.requestRender();
  });
  const dayCtl = ui.range('rp-day', (v) => `Day ${Math.floor(v)}`, (v) => ((st.day = v), sim.requestRender()));
  const fertCtl = ui.range('rp-fday', (v) => `Day ${v}`, (v) => ((st.fertDay = v), sim.requestRender()));
  const pregCtl = ui.toggle('rp-preg', (v) => ((st.pregnant = v), sim.requestRender()));
  const labelCtl = ui.toggle('rp-labels', (v) => ((st.labels = v), sim.requestRender()));
  ui.showWhen('[data-only="cycle"]', false);
  ui.showWhen('[data-only="fert"]', false);

  const sim = createSimController(root, {
    step,
    render,
    reset() {
      Object.assign(st, { view: 'female', day: 14, fertDay: 0, pregnant: false, labels: true });
      viewCtl.set('female');
      dayCtl.set(14, false);
      fertCtl.set(0, false);
      pregCtl.set(false, false);
      labelCtl.set(true, false);
      t = 0;
    },
  });
}
