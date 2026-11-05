/** Reactions for the balancing simulator. Each species lists its atoms explicitly. */

export interface Species {
  formula: string;
  atoms: Record<string, number>;
}
export interface Reaction {
  name: string;
  reactants: Species[];
  products: Species[];
  answer: number[]; // simplest balanced coefficients, reactants then products
  note: string;
}

const sp = (formula: string, atoms: Record<string, number>): Species => ({ formula, atoms });

export const REACTIONS: Reaction[] = [
  { name: 'Making water', reactants: [sp('H₂', { H: 2 }), sp('O₂', { O: 2 })], products: [sp('H₂O', { H: 2, O: 1 })], answer: [2, 1, 2], note: 'Hydrogen burns in oxygen to make water — the reaction in hydrogen fuel cells.' },
  { name: 'Making ammonia (Haber process)', reactants: [sp('N₂', { N: 2 }), sp('H₂', { H: 2 })], products: [sp('NH₃', { N: 1, H: 3 })], answer: [1, 3, 2], note: 'Used to make fertilizers that feed billions of people.' },
  { name: 'Making table salt', reactants: [sp('Na', { Na: 1 }), sp('Cl₂', { Cl: 2 })], products: [sp('NaCl', { Na: 1, Cl: 1 })], answer: [2, 1, 2], note: 'Sodium metal reacts violently with chlorine gas to form sodium chloride.' },
  { name: 'Burning methane', reactants: [sp('CH₄', { C: 1, H: 4 }), sp('O₂', { O: 2 })], products: [sp('CO₂', { C: 1, O: 2 }), sp('H₂O', { H: 2, O: 1 })], answer: [1, 2, 1, 2], note: 'Natural gas burning in a stove or power station.' },
  { name: 'Burning propane', reactants: [sp('C₃H₈', { C: 3, H: 8 }), sp('O₂', { O: 2 })], products: [sp('CO₂', { C: 1, O: 2 }), sp('H₂O', { H: 2, O: 1 })], answer: [1, 5, 3, 4], note: 'The fuel in camping stoves and many barbecues.' },
  { name: 'Rusting iron', reactants: [sp('Fe', { Fe: 1 }), sp('O₂', { O: 2 })], products: [sp('Fe₂O₃', { Fe: 2, O: 3 })], answer: [4, 3, 2], note: 'Iron slowly combines with oxygen (helped by water) to form rust.' },
  { name: 'Metal and acid', reactants: [sp('Al', { Al: 1 }), sp('HCl', { H: 1, Cl: 1 })], products: [sp('AlCl₃', { Al: 1, Cl: 3 }), sp('H₂', { H: 2 })], answer: [2, 6, 2, 3], note: 'Reactive metals release hydrogen gas from acids.' },
  { name: 'Decomposing potassium chlorate', reactants: [sp('KClO₃', { K: 1, Cl: 1, O: 3 })], products: [sp('KCl', { K: 1, Cl: 1 }), sp('O₂', { O: 2 })], answer: [2, 2, 3], note: 'Heating this salt releases oxygen; it is used in some emergency oxygen generators.' },
  { name: 'Cellular respiration', reactants: [sp('C₆H₁₂O₆', { C: 6, H: 12, O: 6 }), sp('O₂', { O: 2 })], products: [sp('CO₂', { C: 1, O: 2 }), sp('H₂O', { H: 2, O: 1 })], answer: [1, 6, 6, 6], note: 'How your cells release energy from glucose.' },
  { name: 'Photosynthesis', reactants: [sp('CO₂', { C: 1, O: 2 }), sp('H₂O', { H: 2, O: 1 })], products: [sp('C₆H₁₂O₆', { C: 6, H: 12, O: 6 }), sp('O₂', { O: 2 })], answer: [6, 6, 1, 6], note: 'Plants use light energy to turn carbon dioxide and water into glucose and oxygen.' },
];

/** CPK-style element colours used for atoms. */
export const ELEMENT_COLOUR: Record<string, string> = {
  H: '#f2f2f2',
  O: '#e53935',
  C: '#3a3a3a',
  N: '#3f6fe0',
  Na: '#9b5de5',
  Cl: '#43b047',
  Fe: '#e07b22',
  Al: '#b0a6a6',
  K: '#7a3db8',
};
export const ELEMENT_NAME: Record<string, string> = {
  H: 'Hydrogen',
  O: 'Oxygen',
  C: 'Carbon',
  N: 'Nitrogen',
  Na: 'Sodium',
  Cl: 'Chlorine',
  Fe: 'Iron',
  Al: 'Aluminium',
  K: 'Potassium',
};
