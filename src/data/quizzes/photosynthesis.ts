import type { QuizQuestion } from '../quiz-types';

export const photosynthesisQuiz: QuizQuestion[] = [
  {
    question: 'What are the raw materials (reactants) of photosynthesis?',
    options: ['Oxygen and glucose', 'Carbon dioxide and water', 'Nitrogen and water', 'Glucose and carbon dioxide'],
    answer: 1,
    explanation: 'Plants use light energy to combine carbon dioxide and water into glucose, releasing oxygen: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.',
    difficulty: 'Basic',
  },
  {
    question: 'What gas are the bubbles from the pondweed?',
    options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Water vapour'],
    answer: 1,
    explanation: 'Oxygen is a by-product of splitting water during the light-dependent reactions. Counting bubbles is a simple way to estimate the rate of photosynthesis.',
    difficulty: 'Basic',
  },
  {
    question: 'The lamp is moved from 20 cm to 10 cm away. How does the light intensity at the plant change?',
    options: ['It doubles', 'It becomes 4 times greater', 'It halves', 'It stays the same'],
    answer: 1,
    explanation: 'Light intensity follows the inverse-square law, I ∝ 1/d². Halving the distance makes the light (20 ÷ 10)² = 4 times more intense.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In very bright light, adding more light no longer increases the rate. What is the most likely explanation?',
    options: [
      'The plant is dead',
      'Another factor, such as carbon dioxide or temperature, has become limiting',
      'Light stops photosynthesis',
      'The bubbles become too big to count',
    ],
    answer: 1,
    explanation: 'The rate is limited by whichever factor is in shortest supply. Once light is plentiful, increasing CO₂ or warming the water (up to the optimum) raises the rate further.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does photosynthesis slow down sharply above about 40 °C?',
    options: ['The water boils', 'The enzymes that control the reactions are denatured', 'Chlorophyll turns green', 'There is too much oxygen'],
    answer: 1,
    explanation: 'Photosynthesis is controlled by enzymes such as RuBisCO. High temperatures change their shape, so they stop working.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does green light give the lowest rate of photosynthesis?',
    options: ['Green light is too hot', 'Chlorophyll reflects most green light instead of absorbing it', 'Green light is too dim', 'Plants only use ultraviolet light'],
    answer: 1,
    explanation: 'Chlorophyll absorbs red and blue light strongly but reflects much of the green — which is exactly why leaves look green.',
    difficulty: 'Basic',
  },
  {
    question: 'A student finds that doubling CO₂ doubles the rate at 10 cm, but has almost no effect at 50 cm. What is limiting at 50 cm?',
    options: ['Carbon dioxide', 'Light intensity', 'Water', 'Oxygen'],
    answer: 1,
    explanation:
      'At 50 cm the light is 25 times dimmer than at 10 cm, so light limits the rate and extra CO₂ makes little difference. This interaction is the heart of the principle of limiting factors.',
    difficulty: 'Advanced',
  },
];
