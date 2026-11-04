import type { QuizQuestion } from '../quiz-types';

export const climateQuiz: QuizQuestion[] = [
  {
    question: 'How do greenhouse gases such as CO₂ warm the planet?',
    options: [
      'They block sunlight from reaching Earth',
      'They absorb infrared heat radiated by Earth’s surface and send some of it back down',
      'They make a hole in the ozone layer',
      'They produce heat chemically',
    ],
    answer: 1,
    explanation:
      'Sunlight passes through the atmosphere easily. Earth then radiates heat as infrared light, and greenhouse gases absorb and re-emit part of it back toward the surface, so less heat escapes to space.',
    difficulty: 'Basic',
  },
  {
    question: 'About what was the atmospheric CO₂ concentration before the Industrial Revolution?',
    options: ['About 150 ppm', 'About 280 ppm', 'About 420 ppm', 'About 1,000 ppm'],
    answer: 1,
    explanation: 'Ice cores show about 280 ppm before industrialization. By 2024 it had risen above 420 ppm, mainly from burning fossil fuels.',
    difficulty: 'Basic',
  },
  {
    question: 'What does “climate sensitivity” mean?',
    options: [
      'How quickly weather changes from day to day',
      'The long-term warming caused by doubling atmospheric CO₂',
      'How sensitive people are to heat',
      'The amount of CO₂ emitted each year',
    ],
    answer: 1,
    explanation: 'Equilibrium climate sensitivity is the eventual warming once Earth has adjusted to a doubling of CO₂. The IPCC’s best estimate is about 3 °C.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, if CO₂ is frozen at today’s level, what happens to temperature?',
    options: [
      'It stops rising immediately',
      'It keeps rising for decades before levelling off, because the oceans are still catching up',
      'It falls back to 1850 levels',
      'It rises without limit',
    ],
    answer: 1,
    explanation:
      'The oceans absorb heat slowly, so the surface has not yet reached equilibrium with today’s CO₂. Even with frozen concentrations, some extra warming is “in the pipeline” — see the “warming still to come” readout.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is CO₂ forcing calculated with a logarithm, F = 5.35 · ln(C/C₀)?',
    options: [
      'Each extra ppm of CO₂ has a slightly smaller effect than the one before',
      'CO₂ has no effect at high concentrations',
      'It makes the numbers smaller',
      'Logarithms are needed for all gases',
    ],
    answer: 0,
    explanation:
      'The main absorption bands of CO₂ are already partly saturated, so adding more has a diminishing effect per molecule. Each doubling of CO₂ adds roughly the same extra forcing, about 3.7 W/m².',
    difficulty: 'Advanced',
  },
  {
    question: 'The Paris Agreement aims to limit warming to well below 2 °C and to pursue efforts to limit it to…',
    options: ['0.5 °C', '1.0 °C', '1.5 °C', '3.0 °C'],
    answer: 2,
    explanation: 'The 2015 Paris Agreement set the goal of well below 2 °C above pre-industrial levels, while pursuing efforts to limit warming to 1.5 °C.',
    difficulty: 'Basic',
  },
  {
    question: 'With a climate sensitivity of 3 °C, roughly how much eventual warming would a CO₂ level of 560 ppm (double the pre-industrial value) cause?',
    options: ['About 1.5 °C', 'About 3 °C', 'About 6 °C', 'None'],
    answer: 1,
    explanation:
      'By definition, climate sensitivity is the eventual warming for doubled CO₂ — so about 3 °C. The simulator’s “eventual warming” readout shows this value; the actual temperature reaches it only after decades to centuries.',
    difficulty: 'Advanced',
  },
];
