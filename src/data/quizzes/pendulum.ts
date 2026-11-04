import type { QuizQuestion } from '../quiz-types';

export const pendulumQuiz: QuizQuestion[] = [
  {
    question: 'What is the period of a pendulum?',
    options: [
      'The distance the bob travels in one swing',
      'The time for one complete back-and-forth swing',
      'The highest angle the bob reaches',
      'The number of swings per second',
    ],
    answer: 1,
    explanation:
      'The period T is the time for one full cycle — out, back, and returning to the starting point. The number of swings per second is the frequency, f = 1/T.',
    difficulty: 'Basic',
  },
  {
    question: 'You double the mass of the bob and keep everything else the same. What happens to the period?',
    options: ['It doubles', 'It halves', 'It stays the same', 'It increases by about 41%'],
    answer: 2,
    explanation:
      'Mass does not appear in T = 2π√(L/g). A heavier bob feels a bigger gravitational force but also has more inertia, and the two effects cancel. Record trials at different masses to confirm.',
    difficulty: 'Basic',
  },
  {
    question: 'Which change makes a pendulum swing more slowly (longer period)?',
    options: ['A shorter string', 'A longer string', 'A heavier bob', 'Moving it to Jupiter'],
    answer: 1,
    explanation:
      'The period grows with the square root of length. A longer string means the bob travels a longer arc with a gentler restoring force. Stronger gravity, as on Jupiter, would shorten the period.',
    difficulty: 'Basic',
  },
  {
    question: 'To double the period of a pendulum, the length must be…',
    options: ['doubled', 'halved', 'multiplied by 4', 'multiplied by √2'],
    answer: 2,
    explanation:
      'Because T ∝ √L, doubling T requires √L to double, which means L must become four times longer.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A pendulum clock is taken from Earth to the Moon, where g is about one-sixth as large. Its period becomes about…',
    options: ['6 times shorter', 'the same', '2.45 times longer', '6 times longer'],
    answer: 2,
    explanation:
      'T ∝ 1/√g. Dividing g by 6 multiplies T by √6 ≈ 2.45, so the clock would run much too slowly.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where in the swing is the bob moving fastest?',
    options: ['At the highest point on either side', 'At the lowest point', 'Halfway up', 'Its speed is constant'],
    answer: 1,
    explanation:
      'Energy is converted from gravitational potential energy to kinetic energy as the bob falls. At the lowest point potential energy is smallest, so kinetic energy — and speed — is greatest. Watch the energy bars.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Released from 70° instead of 10°, the measured period is slightly longer than 2π√(L/g). Why?',
    options: [
      'Air resistance is stronger at large angles',
      'The formula assumes small angles, where sin θ ≈ θ; at large angles the restoring force is weaker than that approximation',
      'The string stretches more',
      'The mass increases at large angles',
    ],
    answer: 1,
    explanation:
      'The simple formula comes from approximating sin θ by θ (in radians). For large angles, sin θ is noticeably smaller than θ, so the restoring force is weaker than the approximation predicts and each swing takes a little longer — about 10% longer at 70°.',
    difficulty: 'Advanced',
  },
];
