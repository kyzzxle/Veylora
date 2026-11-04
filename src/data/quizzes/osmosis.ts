import type { QuizQuestion } from '../quiz-types';

export const osmosisQuiz: QuizQuestion[] = [
  {
    question: 'In osmosis, what moves across the selectively permeable membrane?',
    options: ['Solute particles', 'Water', 'Both water and solute equally', 'Only proteins'],
    answer: 1,
    explanation:
      'Osmosis is specifically the movement of water (the solvent) across a selectively permeable membrane. The solute particles cannot cross — that is exactly why water moves instead.',
    difficulty: 'Basic',
  },
  {
    question: 'Water moves by osmosis from a region of…',
    options: [
      'higher solute concentration to lower solute concentration',
      'lower solute concentration to higher solute concentration',
      'larger volume to smaller volume',
      'the cell to the outside, always',
    ],
    answer: 1,
    explanation:
      'Net water movement is toward the side with more solute (less “free” water). In the simulator, water flows into the cell whenever the inside concentration is higher than the outside.',
    difficulty: 'Basic',
  },
  {
    question: 'A red blood cell is placed in a solution that is hypertonic to it. What happens?',
    options: [
      'It swells and bursts',
      'It stays the same size',
      'It loses water and shrinks (crenates)',
      'Salt enters the cell until it bursts',
    ],
    answer: 2,
    explanation:
      'A hypertonic solution has a higher solute concentration than the cell, so water leaves the cell. Red blood cells shrink and develop a spiky, crenated outline.',
    difficulty: 'Basic',
  },
  {
    question: 'When a cell is in an isotonic solution, which statement is true?',
    options: [
      'Water molecules stop moving across the membrane',
      'Water crosses in both directions at equal rates, so there is no net change',
      'Only solute particles move',
      'The cell slowly shrinks',
    ],
    answer: 1,
    explanation:
      'Water never stops moving. In an isotonic solution the rates in and out are equal, so the volume does not change. Watch the “Water crossings / s” readout at 300 mOsm/L — molecules still cross both ways.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does a plant cell placed in distilled water not burst, while a red blood cell does?',
    options: [
      'Plant cells have no membrane',
      'Plant cells contain no solutes',
      'The rigid cell wall resists expansion, building turgor pressure that stops further water entry',
      'Water cannot enter plant cells',
    ],
    answer: 2,
    explanation:
      'As the protoplast swells it presses on the cell wall. The wall pushes back (turgor pressure), raising the water potential inside until net water entry stops. Animal cells have no wall, so they keep swelling until they lyse.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, you increase membrane water permeability (more aquaporins). What changes?',
    options: [
      'The cell reaches its final size faster, but the final size is the same',
      'The cell ends up larger',
      'The cell ends up smaller',
      'Solute particles can now cross the membrane',
    ],
    answer: 0,
    explanation:
      'Permeability affects the rate of water movement, not the equilibrium. The final volume is set by the concentrations. Save one run at 0.5× and one at 3× to compare their curves.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A plant cell is moved into concentrated salt water. The membrane pulls away from the cell wall. What fills the gap?',
    options: ['A vacuum', 'Cytoplasm', 'The outside salt solution', 'Air'],
    answer: 2,
    explanation:
      'This is plasmolysis. The cell wall is fully permeable, so the outside solution (water and salt) flows through it and fills the space between the wall and the shrinking protoplast.',
    difficulty: 'Advanced',
  },
  {
    question:
      'A cell contains 300 mOsm/L of solute and none of the solute can cross the membrane. It is placed in a 600 mOsm/L solution. Ignoring osmotically inactive material, roughly what fraction of its original volume will it have at equilibrium?',
    options: ['About 200%', 'About 100%', 'About 50%', 'About 25%'],
    answer: 2,
    explanation:
      'At equilibrium the inside concentration must equal 600 mOsm/L. The amount of solute is fixed, so the volume must halve (300/600 = 0.5). Real cells shrink a little less because part of their volume is osmotically inactive — the simulator includes this, which is why it settles near 70%.',
    difficulty: 'Advanced',
  },
];
