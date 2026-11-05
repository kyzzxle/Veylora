import type { QuizQuestion } from '../quiz-types';

export const germinationQuiz: QuizQuestion[] = [
  {
    question: 'Which three conditions do almost all seeds need in order to germinate?',
    options: ['Light, soil and fertilizer', 'Water, oxygen and a suitable temperature', 'Sunlight, wind and rain', 'Carbon dioxide, light and soil'],
    answer: 1,
    explanation: 'Water activates the seed, oxygen allows respiration to release energy, and a suitable temperature lets enzymes work. Many seeds germinate perfectly well in the dark and without soil.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does a seed need water to germinate?',
    options: [
      'To wash off the seed coat',
      'Water makes the seed swell, softens the coat and activates enzymes that break down stored food',
      'Water provides light energy',
      'Seeds drink water like animals',
    ],
    answer: 1,
    explanation: 'Absorbing water (imbibition) rehydrates the cells and switches on enzymes that convert stored starch into sugars for the growing embryo.',
    difficulty: 'Basic',
  },
  {
    question: 'Why do seeds fail to germinate when they are completely under water?',
    options: ['They are too wet to grow', 'There is too little oxygen for respiration', 'Water is too cold', 'Light cannot reach them'],
    answer: 1,
    explanation: 'Waterlogged seeds cannot get enough oxygen. Without aerobic respiration they cannot release the energy needed to grow, and they may rot.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the first structure to emerge from a germinating seed?',
    options: ['The leaves', 'The flower', 'The radicle (embryonic root)', 'The stem'],
    answer: 2,
    explanation: 'The radicle breaks through the seed coat first, anchoring the seedling and absorbing water. The shoot (plumule) follows.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Bean seeds germinate faster at 25 °C than at 12 °C. Why?',
    options: [
      'Warmer seeds are softer',
      'Enzyme-controlled reactions in the seed run faster at warmer temperatures, up to an optimum',
      'Cold seeds have no water',
      'Light is brighter when it is warm',
    ],
    answer: 1,
    explanation: 'Germination is driven by enzymes. Within the normal range, warmth speeds them up; too hot and the enzymes denature and germination stops.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do bean seeds still germinate in the dark?',
    options: [
      'They photosynthesise without light',
      'They use food stored in the seed (cotyledons) for energy until they can photosynthesise',
      'They absorb light through the soil',
      'They do not need energy',
    ],
    answer: 1,
    explanation: 'Seeds contain a food store. Only after the first leaves open does the seedling need light for photosynthesis.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Some lettuce seeds germinate well in light but poorly in darkness. What is the advantage of needing light?',
    options: [
      'It saves water',
      'Small seeds with little stored food only germinate near the surface, where the seedling can reach light before its reserves run out',
      'It keeps them warm',
      'It makes them grow faster in the dark',
    ],
    answer: 1,
    explanation:
      'A tiny seed buried deep might run out of food before reaching light. Light-sensitive pigments (phytochromes) let such seeds “know” they are near the surface. This was discovered in classic experiments on Grand Rapids lettuce.',
    difficulty: 'Advanced',
  },
];
