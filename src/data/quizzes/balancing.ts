import type { QuizQuestion } from '../quiz-types';

export const balancingQuiz: QuizQuestion[] = [
  {
    question: 'Why must chemical equations be balanced?',
    options: [
      'To make them look neat',
      'Because atoms are not created or destroyed in a chemical reaction (conservation of mass)',
      'Because reactions always produce more atoms',
      'So the coefficients add up to 10',
    ],
    answer: 1,
    explanation: 'Atoms are only rearranged. The number of each type of atom must therefore be the same before and after the reaction.',
    difficulty: 'Basic',
  },
  {
    question: 'In 3 H₂O, how many hydrogen atoms are there?',
    options: ['2', '3', '5', '6'],
    answer: 3,
    explanation: 'The coefficient 3 multiplies the whole formula: 3 molecules × 2 hydrogen atoms each = 6 hydrogen atoms (and 3 oxygen atoms).',
    difficulty: 'Basic',
  },
  {
    question: 'When balancing, which numbers are you allowed to change?',
    options: ['The subscripts inside formulas', 'The coefficients in front of formulas', 'Both', 'Neither'],
    answer: 1,
    explanation: 'Changing a subscript changes the substance itself — H₂O₂ is hydrogen peroxide, not water. Only coefficients may change.',
    difficulty: 'Basic',
  },
  {
    question: 'Which coefficients balance  __ H₂ + __ O₂ → __ H₂O?',
    options: ['1, 1, 1', '2, 1, 2', '1, 2, 2', '2, 2, 2'],
    answer: 1,
    explanation: '2 H₂ + O₂ → 2 H₂O gives 4 H and 2 O on each side. (2, 2, 2 is not balanced: it has 4 O on the left but only 2 on the right.)',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which coefficients balance  __ CH₄ + __ O₂ → __ CO₂ + __ H₂O?',
    options: ['1, 1, 1, 1', '1, 2, 1, 2', '2, 1, 2, 1', '1, 3, 1, 2'],
    answer: 1,
    explanation: 'Carbon: 1 = 1. Hydrogen: 4 = 2 × 2. Oxygen: 2 × 2 = 4 on the left, and 2 + 2 = 4 on the right.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A student writes 4 H₂ + 2 O₂ → 4 H₂O. What is wrong with it?',
    options: ['It is not balanced', 'It is balanced but not in the simplest whole-number ratio', 'Water cannot be made this way', 'Nothing is wrong'],
    answer: 1,
    explanation: 'The atoms do balance, but all coefficients can be divided by 2. By convention, equations use the smallest whole numbers: 2 H₂ + O₂ → 2 H₂O.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the balanced equation for photosynthesis, 6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂, how many oxygen atoms are on each side?',
    options: ['12', '18', '6', '24'],
    answer: 1,
    explanation: 'Left: 6 × 2 (in CO₂) + 6 × 1 (in H₂O) = 18. Right: 6 (in glucose) + 6 × 2 (in O₂) = 18.',
    difficulty: 'Advanced',
  },
];
