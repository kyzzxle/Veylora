/** Approximate pH values of common solutions (they vary with brand and concentration). */
export const SUBSTANCES = [
  { name: 'Stomach acid', ph: 1.5 },
  { name: 'Lemon juice', ph: 2.2 },
  { name: 'Cola', ph: 2.5 },
  { name: 'Vinegar', ph: 2.8 },
  { name: 'Orange juice', ph: 3.5 },
  { name: 'Black coffee', ph: 5.0 },
  { name: 'Milk', ph: 6.6 },
  { name: 'Pure water', ph: 7.0 },
  { name: 'Blood', ph: 7.4 },
  { name: 'Seawater', ph: 8.1 },
  { name: 'Baking soda solution', ph: 8.3 },
  { name: 'Milk of magnesia', ph: 10.5 },
  { name: 'Household ammonia', ph: 11.5 },
  { name: 'Bleach', ph: 12.5 },
  { name: 'Drain cleaner (lye)', ph: 13.5 },
];

export type Indicator = 'universal' | 'phenolphthalein' | 'bromothymol' | 'methylorange' | 'litmus';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * Math.min(1, Math.max(0, t)))) as RGB;
const css = (c: RGB, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/** Indicator colour (and a plain-English name) for a given pH. Transition ranges follow standard references. */
export function indicatorColour(ind: Indicator, ph: number): { fill: string; name: string } {
  switch (ind) {
    case 'universal': {
      const stops: [number, RGB, string][] = [
        [0, [200, 30, 40], 'red'],
        [3, [240, 110, 30], 'orange'],
        [5, [235, 200, 40], 'yellow'],
        [7, [70, 170, 70], 'green'],
        [9, [40, 120, 200], 'blue'],
        [11, [70, 60, 170], 'indigo'],
        [14, [120, 40, 150], 'violet'],
      ];
      for (let i = 0; i < stops.length - 1; i++) {
        const [p0, c0, n0] = stops[i];
        const [p1, c1, n1] = stops[i + 1];
        if (ph <= p1 || i === stops.length - 2) {
          const t = (ph - p0) / (p1 - p0);
          return { fill: css(mix(c0, c1, t), 0.75), name: t < 0.5 ? n0 : n1 };
        }
      }
      return { fill: css([120, 40, 150], 0.75), name: 'violet' };
    }
    case 'phenolphthalein': {
      if (ph < 8.2) return { fill: 'rgba(255,255,255,0.12)', name: 'colourless' };
      const t = (ph - 8.2) / 1.8;
      return { fill: css(mix([250, 200, 220], [220, 30, 130], t), 0.25 + 0.55 * Math.min(1, t)), name: t < 0.5 ? 'pale pink' : 'pink-magenta' };
    }
    case 'bromothymol':
      if (ph < 6.0) return { fill: css([230, 200, 40], 0.75), name: 'yellow' };
      if (ph <= 7.6) return { fill: css(mix([230, 200, 40], [40, 110, 200], (ph - 6) / 1.6), 0.75), name: 'green' };
      return { fill: css([40, 110, 200], 0.75), name: 'blue' };
    case 'methylorange':
      if (ph < 3.1) return { fill: css([210, 40, 40], 0.75), name: 'red' };
      if (ph <= 4.4) return { fill: css(mix([210, 40, 40], [240, 200, 40], (ph - 3.1) / 1.3), 0.75), name: 'orange' };
      return { fill: css([240, 200, 40], 0.75), name: 'yellow' };
    case 'litmus':
      if (ph < 4.5) return { fill: css([200, 40, 60], 0.7), name: 'red' };
      if (ph <= 8.3) return { fill: css(mix([200, 40, 60], [50, 80, 190], (ph - 4.5) / 3.8), 0.7), name: 'purple' };
      return { fill: css([50, 80, 190], 0.7), name: 'blue' };
  }
}

const KW = 1e-14;

/** pH from a net strong-acid excess concentration C (mol/L; negative means excess base), including water's own ions. */
export function phFromExcess(C: number) {
  const h = (C + Math.sqrt(C * C + 4 * KW)) / 2;
  return -Math.log10(h);
}

/** Titration of Va mL of Ca M HCl with Vb mL of Cb M NaOH. */
export function titrationPH(Vb: number, Va = 25, Ca = 0.1, Cb = 0.1) {
  const na = (Ca * Va) / 1000;
  const nb = (Cb * Vb) / 1000;
  const V = (Va + Vb) / 1000;
  return phFromExcess((na - nb) / V);
}
