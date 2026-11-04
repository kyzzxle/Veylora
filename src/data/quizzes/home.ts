import type { QuizQuestion } from '../quiz-types';

export const homeQuiz: QuizQuestion[] = [
  {
    question: 'A red blood cell is placed in pure (distilled) water. What happens to it?',
    options: [
      'It shrinks because water leaves the cell',
      'It swells and may burst because water enters the cell',
      'Nothing — water and the cell are already balanced',
      'Salt moves out of the cell until it disappears',
    ],
    answer: 1,
    explanation:
      'Pure water is hypotonic to the cell’s interior. Water moves by osmosis toward the higher solute concentration — into the cell — so the cell swells and can burst (hemolysis).',
    difficulty: 'Basic',
  },
  {
    question: 'Which particle in an atom determines which element it is?',
    options: ['Electron', 'Neutron', 'Proton', 'Photon'],
    answer: 2,
    explanation:
      'The number of protons (the atomic number) defines the element. Changing neutrons gives a different isotope; changing electrons gives an ion.',
    difficulty: 'Basic',
  },
  {
    question: 'If you double the length of a simple pendulum, its period (time for one swing)…',
    options: ['Doubles', 'Increases by about 41%', 'Stays exactly the same', 'Halves'],
    answer: 1,
    explanation:
      'For small swings the period is T = 2π√(L/g). Doubling L multiplies T by √2 ≈ 1.41, an increase of about 41%. The mass of the bob does not matter.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does the Moon show phases?',
    options: [
      'Earth’s shadow covers different parts of the Moon each night',
      'The Moon produces less light at certain times of the month',
      'We see different amounts of the Moon’s sunlit half as it orbits Earth',
      'Clouds in the Moon’s atmosphere block parts of it',
    ],
    answer: 2,
    explanation:
      'Half of the Moon is always lit by the Sun. As the Moon orbits Earth, we view that lit half from changing angles. Earth’s shadow only matters during a lunar eclipse.',
    difficulty: 'Intermediate',
  },
];
