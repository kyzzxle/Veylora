import type { QuizQuestion } from '../quiz-types';

export const electrochemQuiz: QuizQuestion[] = [
  {
    question: 'In any electrochemical cell, galvanic or electrolytic, what happens at the anode?',
    options: ['Reduction', 'Oxidation', 'Neutralization', 'Nothing: it only carries current'],
    answer: 1,
    explanation: 'The anode is always where oxidation (loss of electrons) happens, and the cathode is always where reduction happens. Only the signs of the electrodes differ between the two kinds of cell.',
    difficulty: 'Basic',
  },
  {
    question: 'In a zinc–copper (Daniell) cell, which way do electrons flow through the external wire?',
    options: ['From copper to zinc', 'From zinc to copper', 'Through the salt bridge', 'They do not flow'],
    answer: 1,
    explanation: 'Zinc is oxidized (Zn → Zn²⁺ + 2e⁻), releasing electrons that travel through the wire to the copper electrode, where Cu²⁺ ions gain them.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the job of the salt bridge?',
    options: [
      'To let electrons cross between the beakers',
      'To complete the circuit by letting ions move, keeping both solutions electrically neutral',
      'To supply the metal for the cathode',
      'To raise the cell voltage',
    ],
    answer: 1,
    explanation: 'Electrons travel only through the wire. In the solutions and the salt bridge, the current is carried by ions: anions move towards the anode beaker and cations towards the cathode beaker. Without the bridge, charge would build up and the reaction would stop almost immediately.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Using standard reduction potentials Cu²⁺/Cu = +0.34 V and Zn²⁺/Zn = −0.76 V, what is the standard voltage of the zinc–copper cell?',
    options: ['0.42 V', '−1.10 V', '1.10 V', '0.34 V'],
    answer: 2,
    explanation: 'E°cell = E°cathode − E°anode = 0.34 − (−0.76) = 1.10 V. The simulator’s voltmeter reads 1.10 V when both solutions are 1 mol/L.',
    difficulty: 'Intermediate',
  },
  {
    question: 'You build a cell from magnesium (E° = −2.37 V) and silver (E° = +0.80 V). Which statement is correct?',
    options: [
      'Silver is the anode',
      'Magnesium is the anode, and the standard voltage is about 3.17 V',
      'The voltage is 1.57 V',
      'No current can flow between two different metals',
    ],
    answer: 1,
    explanation: 'The metal with the more negative electrode potential gives up electrons more readily, so magnesium is oxidized at the anode. E°cell = 0.80 − (−2.37) = 3.17 V. The bigger the difference in reactivity, the bigger the voltage.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why does the simulated cell’s voltage slowly fall while the bulb is lit?',
    options: [
      'The wire gets tired',
      'The reaction uses up cathode ions and builds up anode ions, so the cell moves towards equilibrium and the voltage drops',
      'The salt bridge evaporates',
      'Electrons are destroyed',
    ],
    answer: 1,
    explanation: 'The Nernst equation links the voltage to the concentrations. As Cu²⁺ is used up and Zn²⁺ builds up, the driving force decreases. A completely “flat” battery is one whose reaction has reached equilibrium.',
    difficulty: 'Advanced',
  },
  {
    question: 'What is the main difference between a galvanic cell and an electrolytic cell?',
    options: [
      'A galvanic cell uses a spontaneous reaction to produce electricity; an electrolytic cell uses electricity to drive a non-spontaneous reaction',
      'Only electrolytic cells have electrodes',
      'Galvanic cells have no anode',
      'There is no difference',
    ],
    answer: 0,
    explanation: 'A battery is a galvanic cell. Electrolysis, used for splitting water, electroplating and extracting reactive metals such as aluminium, needs an external power supply.',
    difficulty: 'Basic',
  },
  {
    question: 'In the electrolysis of water, why is the volume of hydrogen twice the volume of oxygen?',
    options: [
      'Hydrogen molecules are smaller',
      'Making one H₂ molecule needs 2 electrons, but one O₂ molecule releases 4, so the same charge makes twice as many H₂ molecules',
      'Oxygen dissolves completely',
      'The cathode is twice as big',
    ],
    answer: 1,
    explanation: 'Cathode: 2H⁺ + 2e⁻ → H₂. Anode: 2H₂O → O₂ + 4H⁺ + 4e⁻. Every 4 electrons give 2 H₂ and 1 O₂, matching the formula H₂O: two hydrogen atoms for every oxygen atom.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In an electrolytic cell, which electrode is connected to the negative terminal of the power supply, and what happens there?',
    options: [
      'The anode; oxidation',
      'The cathode; reduction (positive ions gain electrons)',
      'The cathode; oxidation',
      'The anode; reduction',
    ],
    answer: 1,
    explanation: 'The power supply pushes electrons into the cathode, so it is negative and positive ions (cations) are attracted to it and reduced. In a galvanic cell the signs are reversed: the cathode is positive.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A current of 0.50 A flows through copper(II) sulfate solution for 1930 s. How many moles of copper are deposited? (F = 96,485 C/mol; Cu²⁺ + 2e⁻ → Cu)',
    options: ['0.0010 mol', '0.0050 mol', '0.010 mol', '0.50 mol'],
    answer: 1,
    explanation: 'Charge Q = I × t = 0.50 × 1930 = 965 C, which is 965 ÷ 96,485 = 0.010 mol of electrons. Each Cu²⁺ needs 2 electrons, so 0.0050 mol of copper (about 0.32 g) is deposited. This is Faraday’s law.',
    difficulty: 'Advanced',
  },
];
