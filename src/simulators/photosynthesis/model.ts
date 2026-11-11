/**
 * A simplified, leaf-level model of C3 photosynthesis (not a complete
 * biochemical model). Rates are gross O₂ production in µmol O₂ per m² of leaf
 * per second, which in this model equals the gross rate of CO₂ fixation (one O₂
 * released per CO₂ fixed; photorespiration is ignored).
 *
 *   Light-limited rate   Aj: non-rectangular hyperbola in light intensity I,
 *                            so it rises steeply at low light and then saturates.
 *   CO₂-limited rate     Ac: Michaelis–Menten in the CO₂ inside the leaf (Ci),
 *                            which depends on the air's CO₂ and how open the
 *                            stomata are.
 *   Gross rate           A  = smooth minimum of Aj and Ac (whichever is lower
 *                            limits), × a water factor for severe drought.
 * Temperature scales the enzyme-driven capacities with an optimum near 27 °C;
 * above about 40 °C enzymes and membranes are damaged and the rate collapses.
 * Water mainly acts through the stomata: a short-of-water leaf closes them,
 * which starves the Calvin cycle of CO₂.
 */
export interface Cond {
  /** Light intensity, µmol photons m⁻² s⁻¹ (full sunlight ≈ 2000). */
  I: number;
  /** CO₂ in the air, ppm (today's air ≈ 420). */
  co2: number;
  /** Water available to the leaf, % (100 = fully watered). */
  water: number;
  /** Leaf temperature, °C. */
  T: number;
}
export type Limit = 'dark' | 'light' | 'co2' | 'stomata' | 'colimited' | 'temperature' | 'water';
export interface Rates {
  Aj: number;
  Ac: number;
  A: number;
  net: number;
  Rd: number;
  fT: number;
  g: number;
  ci: number;
  limit: Limit;
  /** ATP and NADPH made by the light reactions and used by the Calvin cycle (3 ATP + 2 NADPH per CO₂). */
  atp: number;
  nadph: number;
  /** Electron flow through the light reactions: 4 e⁻ per O₂. */
  electrons: number;
  /** Glucose made, µmol m⁻² s⁻¹ (6 CO₂ per glucose). */
  glucose: number;
}

export const PHI = 0.06; // O₂ per absorbed photon at low light (max ≈ 1/8 in theory)
export const JMAX = 34; // light-limited ceiling at the optimum temperature
export const VMAX = 48; // CO₂-limited ceiling at the optimum temperature
export const KC = 380; // Ci at which the CO₂-limited rate is half its ceiling, ppm
export const THETA = 0.8;
export const T_OPT = 27;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Enzyme activity relative to the optimum (0–1). */
export function tempFactor(T: number) {
  if (T >= 45 || T <= -5) return 0;
  if (T <= T_OPT) return Math.exp(-(((T - T_OPT) / 18) ** 2));
  const f = Math.exp(-(((T - T_OPT) / 10) ** 2));
  return T > 40 ? f * (45 - T) / 5 : f;
}
/** How open the stomata are (0–1): they close as the leaf runs short of water. */
export const stomata = (water: number) => clamp((water - 15) / 45, 0.03, 1);
/** Severe drought also damages the leaf directly. */
export const waterFactor = (water: number) => clamp(water / 15, 0, 1);
/** CO₂ inside the leaf, ppm: about 70% of the air's when stomata are fully open. */
export const internalCO2 = (co2: number, g: number) => co2 * (0.2 + 0.5 * g);

export function lightLimited(I: number, fT: number) {
  const a = PHI * Math.max(0, I);
  const m = JMAX * fT;
  if (m <= 0) return 0;
  const b = a + m;
  return (b - Math.sqrt(Math.max(0, b * b - 4 * THETA * a * m))) / (2 * THETA);
}
export const co2Limited = (ci: number, fT: number) => (VMAX * fT * Math.max(0, ci)) / (Math.max(0, ci) + KC);
/** Smooth minimum: close to the smaller of x and y, with a gentle transition. */
export function smoothMin(x: number, y: number, th = 0.98) {
  const b = x + y;
  return (b - Math.sqrt(Math.max(0, b * b - 4 * th * x * y))) / (2 * th);
}
/** The leaf's own respiration, which uses O₂ day and night. */
export const respiration = (T: number) => (T >= 50 ? 0 : 1.0 * 2 ** ((T - 25) / 10));

export function rates(c: Cond): Rates {
  const fT = tempFactor(c.T);
  const g = stomata(c.water);
  const ci = internalCO2(c.co2, g);
  const Aj = lightLimited(c.I, fT);
  const Ac = co2Limited(ci, fT);
  const A = smoothMin(Aj, Ac) * waterFactor(c.water);
  const Rd = respiration(c.T);
  let limit: Limit;
  if (c.I <= 0) limit = 'dark';
  else if (c.water < 15) limit = 'water';
  else if (fT < 0.55) limit = 'temperature';
  else if (Math.abs(Aj - Ac) < 0.08 * Math.max(Aj, Ac)) limit = 'colimited';
  else if (Aj < Ac) limit = 'light';
  else limit = g < 0.6 ? 'stomata' : 'co2';
  return { Aj, Ac, A, net: A - Rd, Rd, fT, g, ci, limit, atp: 3 * A, nadph: 2 * A, electrons: 4 * A, glucose: A / 6 };
}

export const LIMIT_TEXT: Record<Limit, string> = {
  dark: 'No light: the light reactions stop, so no ATP, NADPH or O₂ is made',
  light: 'Light intensity',
  co2: 'Carbon dioxide',
  stomata: 'Carbon dioxide (stomata closing to save water)',
  colimited: 'Light and carbon dioxide together',
  temperature: 'Temperature',
  water: 'Water (the leaf is wilting)',
};

/** Example conditions for comparing the three classic limiting factors. */
export const SCENARIOS: Record<'light' | 'co2' | 'temperature', { name: string; c: Cond }> = {
  light: { name: 'Light-limited', c: { I: 150, co2: 420, water: 80, T: 25 } },
  co2: { name: 'CO₂-limited', c: { I: 1500, co2: 200, water: 80, T: 25 } },
  temperature: { name: 'Temperature-limited', c: { I: 1500, co2: 1000, water: 80, T: 8 } },
};
