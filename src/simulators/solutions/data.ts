/**
 * Solubility data, in grams of solute that dissolve in 100 g of water, from
 * standard reference tables (rounded). Copper(II) sulfate is given as the
 * anhydrous salt. Between the listed temperatures, values are interpolated
 * linearly.
 */
export type SoluteId = 'nacl' | 'kno3' | 'cuso4' | 'sugar' | 'li2so4';

export interface Solute {
  id: SoluteId;
  name: string;
  formula: string;
  /** g/mol */
  molar: number;
  /** [°C, g per 100 g water] */
  curve: [number, number][];
  ionic: boolean;
  /** Particles released by one formula unit, e.g. Na⁺ + Cl⁻ → 2 */
  ions: string[];
  /** Colour of the dissolved particles in the beaker, and of the solution if coloured. */
  dot: string;
  tint?: string;
  crystal: string;
  note: string;
}

export const SOLUTES: Record<SoluteId, Solute> = {
  nacl: {
    id: 'nacl',
    name: 'Table salt',
    formula: 'NaCl',
    molar: 58.44,
    curve: [[0, 35.7], [20, 35.9], [40, 36.4], [60, 37.1], [80, 38.0], [100, 39.2]],
    ionic: true,
    ions: ['Na⁺', 'Cl⁻'],
    dot: '#9aa7bd',
    crystal: '#e8edf5',
    note: 'Sodium chloride’s solubility hardly changes with temperature, so cooling salty water does not make much salt crystallize.',
  },
  kno3: {
    id: 'kno3',
    name: 'Potassium nitrate',
    formula: 'KNO₃',
    molar: 101.1,
    curve: [[0, 13.3], [10, 20.9], [20, 31.6], [30, 45.8], [40, 63.9], [50, 85.5], [60, 110], [70, 138], [80, 169], [90, 202], [100, 246]],
    ionic: true,
    ions: ['K⁺', 'NO₃⁻'],
    dot: '#d9480f',
    crystal: '#f4f1ea',
    note: 'Potassium nitrate is far more soluble in hot water than in cold, so a hot saturated solution forms many crystals as it cools.',
  },
  cuso4: {
    id: 'cuso4',
    name: 'Copper(II) sulfate',
    formula: 'CuSO₄',
    molar: 159.6,
    curve: [[0, 14.3], [20, 20.7], [40, 28.5], [60, 40.0], [80, 55.0], [100, 75.4]],
    ionic: true,
    ions: ['Cu²⁺', 'SO₄²⁻'],
    dot: '#74c0fc',
    tint: '#1c7ed6',
    crystal: '#3b8de0',
    note: 'Hydrated copper ions are blue, so the colour deepens as the concentration rises. Its solubility rises steadily with temperature.',
  },
  sugar: {
    id: 'sugar',
    name: 'Sugar (sucrose)',
    formula: 'C₁₂H₂₂O₁₁',
    molar: 342.3,
    curve: [[0, 179], [20, 204], [40, 238], [60, 287], [80, 362], [100, 487]],
    ionic: false,
    ions: ['C₁₂H₂₂O₁₁'],
    dot: '#b5838d',
    crystal: '#fbf7f0',
    note: 'Sugar is extremely soluble: about 2 g dissolves in every 1 g of water at room temperature. It dissolves as whole molecules, not ions.',
  },
  li2so4: {
    id: 'li2so4',
    name: 'Lithium sulfate',
    formula: 'Li₂SO₄',
    molar: 109.9,
    curve: [[0, 36.1], [20, 34.8], [40, 33.7], [60, 32.6], [80, 31.4], [100, 30.9]],
    ionic: true,
    ions: ['Li⁺', 'SO₄²⁻'],
    dot: '#2b8a3e',
    crystal: '#eef5ee',
    note: 'Unusually, lithium sulfate becomes slightly less soluble as the water gets hotter, so heating a saturated solution makes some crystallize.',
  },
};

/** Solubility in g per 100 g water at temperature T (°C). */
export function solubility(s: Solute, T: number) {
  const c = s.curve;
  if (T <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (T <= c[i][0]) {
      const [t0, v0] = c[i - 1];
      const [t1, v1] = c[i];
      return v0 + ((v1 - v0) * (T - t0)) / (t1 - t0);
    }
  }
  return c[c.length - 1][1];
}
