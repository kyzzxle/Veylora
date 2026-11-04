import type { QuizQuestion } from '../quiz-types';

export const acidBaseQuiz: QuizQuestion[] = [
  {
    question: 'A solution has a pH of 3. It is…',
    options: ['strongly basic', 'neutral', 'acidic', 'slightly basic'],
    answer: 2,
    explanation: 'At 25 °C, pH below 7 is acidic, 7 is neutral and above 7 is basic. pH 3 is clearly acidic — similar to orange juice or vinegar.',
    difficulty: 'Basic',
  },
  {
    question: 'Which ion do acids increase in water?',
    options: ['Hydroxide, OH⁻', 'Hydronium, H₃O⁺ (often written H⁺)', 'Sodium, Na⁺', 'Chloride, Cl⁻'],
    answer: 1,
    explanation: 'Acids donate H⁺ ions to water, forming hydronium ions (H₃O⁺). Bases increase hydroxide ions (OH⁻) or remove H⁺.',
    difficulty: 'Basic',
  },
  {
    question: 'Phenolphthalein is added to a solution and it stays colourless. What can you conclude?',
    options: ['The pH is above 10', 'The pH is below about 8.2', 'The solution is neutral exactly', 'The solution is basic'],
    answer: 1,
    explanation: 'Phenolphthalein is colourless below about pH 8.2 and turns pink above it. Colourless tells you only that the solution is not strongly basic — it could be acidic or neutral.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How many times more H₃O⁺ does a solution at pH 2 have compared with one at pH 4?',
    options: ['2 times', '20 times', '100 times', '1,000 times'],
    answer: 2,
    explanation: 'The pH scale is logarithmic: each unit is a factor of 10. Two units apart means 10 × 10 = 100 times the hydronium concentration.',
    difficulty: 'Intermediate',
  },
  {
    question: 'You dilute a strong acid solution with pH 2 by a factor of 10 with pure water. What is the new pH, approximately?',
    options: ['1', '2', '3', '7'],
    answer: 2,
    explanation: 'Dividing [H₃O⁺] by 10 raises the pH by one unit, from 2 to 3. However much you dilute an acid, it never becomes basic — it just approaches pH 7.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the titration, 25.0 mL of 0.100 M HCl is neutralized by 0.100 M NaOH. At what volume of NaOH is the equivalence point?',
    options: ['12.5 mL', '25.0 mL', '50.0 mL', '0.100 mL'],
    answer: 1,
    explanation: 'Moles of HCl = 0.100 × 0.0250 = 0.00250 mol. The same number of moles of NaOH is needed: 0.00250 / 0.100 = 0.0250 L = 25.0 mL. HCl + NaOH → NaCl + H₂O.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why does the pH change so steeply near the equivalence point of a strong acid–strong base titration?',
    options: [
      'The indicator causes it',
      'Almost all the acid has been used up, so each tiny extra drop of base changes [H₃O⁺] by a huge factor',
      'The temperature rises suddenly',
      'Salt is very basic',
    ],
    answer: 1,
    explanation:
      'Far from equivalence, plenty of acid (or base) remains to absorb each drop, so pH changes slowly. Near equivalence, the remaining excess is tiny, so one drop can change the hydronium concentration by many powers of ten — pH can jump from about 4 to 10 in less than a millilitre.',
    difficulty: 'Advanced',
  },
];
