import type { QuizQuestion } from '../quiz-types';

export const redoxQuiz: QuizQuestion[] = [
  {
    question: 'In terms of electrons, what is oxidation?',
    options: ['Gain of electrons', 'Loss of electrons', 'Gain of protons', 'Loss of neutrons'],
    answer: 1,
    explanation: 'OIL RIG: Oxidation Is Loss, Reduction Is Gain (of electrons). When an atom or ion is oxidized, its oxidation state goes up.',
    difficulty: 'Basic',
  },
  {
    question: 'In the reaction Zn + Cu²⁺ → Zn²⁺ + Cu, which species is oxidized?',
    options: ['Zn', 'Cu²⁺', 'Zn²⁺', 'Cu'],
    answer: 0,
    explanation: 'Zinc goes from oxidation state 0 to +2: it loses two electrons, so it is oxidized. Copper(II) ions gain those electrons and are reduced.',
    difficulty: 'Basic',
  },
  {
    question: 'What is an oxidizing agent?',
    options: [
      'A substance that loses electrons and is oxidized',
      'A substance that accepts electrons from another substance, and is itself reduced',
      'Any substance that contains oxygen',
      'A catalyst for redox reactions',
    ],
    answer: 1,
    explanation: 'The oxidizing agent causes oxidation by taking electrons, so it is reduced. The reducing agent gives electrons and is oxidized. Many oxidizing agents, such as chlorine, contain no oxygen at all.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which half-equation shows magnesium being oxidized?',
    options: ['Mg²⁺ + 2e⁻ → Mg', 'Mg → Mg²⁺ + 2e⁻', 'Mg + 2e⁻ → Mg²⁺', 'Mg → Mg⁻ + e⁻'],
    answer: 1,
    explanation: 'Oxidation half-equations have electrons on the product side: the atom loses them. Charge must balance: 0 = (+2) + 2 × (−1).',
    difficulty: 'Basic',
  },
  {
    question: 'What is the oxidation state of sulfur in the sulfate ion, SO₄²⁻?',
    options: ['−2', '+2', '+4', '+6'],
    answer: 3,
    explanation: 'Each oxygen is −2, so four oxygens give −8. The ion’s total is −2, so sulfur must be +6: x + 4(−2) = −2.',
    difficulty: 'Advanced',
  },
  {
    question: 'Is the neutralization NaOH + HCl → NaCl + H₂O a redox reaction?',
    options: [
      'Yes, because ions are involved',
      'No: every element keeps the same oxidation state (Na +1, O −2, H +1, Cl −1)',
      'Yes, because water forms',
      'Only if it is heated',
    ],
    answer: 1,
    explanation: 'A reaction is redox only if some oxidation states change. In neutralization, ions swap partners but no electrons are transferred.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In Cu + 2Ag⁺ → Cu²⁺ + 2Ag, why are two silver ions needed for each copper atom?',
    options: [
      'Silver atoms are smaller',
      'Each copper atom loses two electrons, and each silver ion can accept only one, so electrons lost must equal electrons gained',
      'Copper is a catalyst',
      'It is a coincidence',
    ],
    answer: 1,
    explanation: 'Electrons are not created or destroyed: in a balanced redox equation, the electrons lost in oxidation exactly equal the electrons gained in reduction.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the sulfate ion doing in the reaction between zinc and copper(II) sulfate solution?',
    options: ['It is oxidized', 'It is reduced', 'It is a spectator ion: it is present but does not change', 'It provides the electrons'],
    answer: 2,
    explanation: 'Sulfate’s charge and oxidation states stay the same, so it is left out of the ionic equation Zn + Cu²⁺ → Zn²⁺ + Cu.',
    difficulty: 'Basic',
  },
  {
    question: 'In 2H₂ + O₂ → 2H₂O, hydrogen goes from 0 to +1 and oxygen from 0 to −2. Which statement is accurate?',
    options: [
      'Each oxygen atom literally receives two free electrons from hydrogen',
      'It is redox, but water is covalent: electrons are shared unequally, pulled towards oxygen; oxidation states count them as if they were transferred',
      'It is not a redox reaction because no ions form',
      'Hydrogen is reduced',
    ],
    answer: 1,
    explanation: 'Oxidation states are a bookkeeping tool: they assign shared electrons to the more electronegative atom. In combustion no electrons travel freely, but in a hydrogen fuel cell the same half-reactions happen at separate electrodes and the electrons flow through a wire.',
    difficulty: 'Advanced',
  },
  {
    question: 'Chlorine water turns potassium bromide solution orange, but bromine water does not react with potassium chloride. Why?',
    options: [
      'Bromine is more reactive than chlorine',
      'Chlorine is a stronger oxidizing agent: it takes electrons from bromide ions, but bromine cannot take electrons from chloride ions',
      'Potassium chloride is insoluble',
      'Bromide ions are oxidizing agents',
    ],
    answer: 1,
    explanation: 'Reactivity of the halogens decreases down the group. A more reactive halogen oxidizes the ions of a less reactive one: Cl₂ + 2Br⁻ → 2Cl⁻ + Br₂.',
    difficulty: 'Advanced',
  },
];
