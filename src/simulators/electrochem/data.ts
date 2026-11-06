/**
 * Data for the electrochemistry simulator.
 * Standard reduction potentials at 25 °C (V vs the standard hydrogen
 * electrode), from standard tables, rounded to 0.01 V.
 */
export type MetalId = 'Mg' | 'Zn' | 'Fe' | 'Pb' | 'Cu' | 'Ag';
export interface Metal {
  id: MetalId;
  name: string;
  ion: string;
  n: number;
  E0: number;
  M: number; // g/mol
  metal: string; // electrode colour
  ionColour: string;
  /** Solution tint (only for coloured ions) */
  tint?: string;
  salt: string;
}
export const METALS: Record<MetalId, Metal> = {
  Mg: { id: 'Mg', name: 'Magnesium', ion: 'Mg²⁺', n: 2, E0: -2.37, M: 24.31, metal: '#c9ced6', ionColour: '#adb5bd', salt: 'magnesium nitrate' },
  Zn: { id: 'Zn', name: 'Zinc', ion: 'Zn²⁺', n: 2, E0: -0.76, M: 65.38, metal: '#9aabbd', ionColour: '#94a3b8', salt: 'zinc sulfate' },
  Fe: { id: 'Fe', name: 'Iron', ion: 'Fe²⁺', n: 2, E0: -0.44, M: 55.85, metal: '#7d8794', ionColour: '#8ce99a', tint: '#8ce99a', salt: 'iron(II) sulfate' },
  Pb: { id: 'Pb', name: 'Lead', ion: 'Pb²⁺', n: 2, E0: -0.13, M: 207.2, metal: '#6c7a89', ionColour: '#a5b4c4', salt: 'lead(II) nitrate' },
  Cu: { id: 'Cu', name: 'Copper', ion: 'Cu²⁺', n: 2, E0: 0.34, M: 63.55, metal: '#c8743a', ionColour: '#4dabf7', tint: '#1c7ed6', salt: 'copper(II) sulfate' },
  Ag: { id: 'Ag', name: 'Silver', ion: 'Ag⁺', n: 1, E0: 0.8, M: 107.87, metal: '#d0d5dc', ionColour: '#ced4da', salt: 'silver nitrate' },
};

export type CellId = 'water' | 'cucl2' | 'refine';
export interface Electrolysis {
  id: CellId;
  title: string;
  electrolyte: string;
  electrodes: string;
  /** Voltage below which (practically) no current flows */
  onset: number;
  /** Theoretical minimum from standard potentials */
  theory: number;
  cathode: string;
  anode: string;
  cathodeProduct: string;
  anodeProduct: string;
  cation: string;
  anion: string;
  cationColour: string;
  anionColour: string;
  tint?: string;
  note: string;
}
export const CELLS: Record<CellId, Electrolysis> = {
  water: {
    id: 'water',
    title: 'Water (with dilute sulfuric acid)',
    electrolyte: 'water with a little sulfuric acid to let it conduct',
    electrodes: 'platinum (inert)',
    onset: 1.7,
    theory: 1.23,
    cathode: '2H⁺ + 2e⁻ → H₂',
    anode: '2H₂O → O₂ + 4H⁺ + 4e⁻',
    cathodeProduct: 'hydrogen gas',
    anodeProduct: 'oxygen gas',
    cation: 'H⁺',
    anion: 'SO₄²⁻',
    cationColour: '#e9ecef',
    anionColour: '#e0b030',
    note: 'Every 4 electrons make 2 molecules of hydrogen but only 1 of oxygen, so twice as much hydrogen collects. Water needs at least 1.23 V to split; in practice about 1.7 V or more, because of extra “overpotential” at the electrodes.',
  },
  cucl2: {
    id: 'cucl2',
    title: 'Copper(II) chloride solution',
    electrolyte: 'copper(II) chloride solution',
    electrodes: 'graphite (inert)',
    onset: 1.3,
    theory: 1.02,
    cathode: 'Cu²⁺ + 2e⁻ → Cu',
    anode: '2Cl⁻ → Cl₂ + 2e⁻',
    cathodeProduct: 'copper metal',
    anodeProduct: 'chlorine gas',
    cation: 'Cu²⁺',
    anion: 'Cl⁻',
    cationColour: '#4dabf7',
    anionColour: '#69db7c',
    tint: '#1c7ed6',
    note: 'Copper coats the cathode while chlorine bubbles off the anode (some of it dissolves). As copper ions are used up, the blue colour fades.',
  },
  refine: {
    id: 'refine',
    title: 'Copper refining (copper electrodes)',
    electrolyte: 'copper(II) sulfate solution',
    electrodes: 'copper (the anode dissolves)',
    onset: 0.05,
    theory: 0,
    cathode: 'Cu²⁺ + 2e⁻ → Cu',
    anode: 'Cu → Cu²⁺ + 2e⁻',
    cathodeProduct: 'copper metal (deposited)',
    anodeProduct: 'copper ions (the anode dissolves)',
    cation: 'Cu²⁺',
    anion: 'SO₄²⁻',
    cationColour: '#4dabf7',
    anionColour: '#e0b030',
    tint: '#1c7ed6',
    note: 'The anode dissolves and the same mass of copper is deposited on the cathode, so the solution stays the same. Industry uses this to purify copper and to electroplate objects.',
  },
};

export const F = 96485; // C/mol
export const RT_F = 0.02569; // V at 25 °C
export const MOLAR_GAS_VOLUME = 24.0; // L/mol at room temperature and pressure
