import type { QuizQuestion } from '../quiz-types';

export const orbitsQuiz: QuizQuestion[] = [
  {
    question: 'What keeps a planet in orbit around a star?',
    options: [
      'A forward push from the star',
      'Gravity pulling it toward the star while it moves sideways',
      'The absence of gravity in space',
      'Magnetism',
    ],
    answer: 1,
    explanation:
      'Gravity constantly pulls the planet toward the star. Because the planet is also moving sideways, it keeps “falling around” the star instead of into it.',
    difficulty: 'Basic',
  },
  {
    question: 'A planet in an elliptical orbit moves fastest when it is…',
    options: ['farthest from the star', 'closest to the star', 'halfway between', 'at the same speed everywhere'],
    answer: 1,
    explanation:
      'Kepler’s second law: a planet sweeps out equal areas in equal times, so it must move faster when it is close to the star. Watch the speed graph peak at each closest approach.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, what happens if you launch a planet with much less than circular speed?',
    options: ['It flies away', 'It follows a smaller, more elongated ellipse and swings close to the star', 'It stops', 'It orbits in a perfect circle'],
    answer: 1,
    explanation:
      'Too little sideways speed means gravity bends the path inward. The launch point becomes the farthest point of an ellipse, and the planet dives toward the star. With very little speed, it falls in.',
    difficulty: 'Basic',
  },
  {
    question: 'Escape speed is about what percentage of circular orbit speed at the same distance?',
    options: ['100%', '120%', 'About 141% (√2 times)', '200%'],
    answer: 2,
    explanation:
      'Escape speed is √(2GM/r) and circular speed is √(GM/r), so escape speed is √2 ≈ 1.414 times faster. Try 140% and 143% to see the change from a huge ellipse to an escape.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Planet A orbits at 1 AU and planet B at 4 AU from the same star. How do their periods compare?',
    options: ['B takes 4 times as long', 'B takes 8 times as long', 'B takes 16 times as long', 'They take the same time'],
    answer: 1,
    explanation: 'Kepler’s third law: T² ∝ a³. With a 4 times larger, T² is 64 times larger, so T is 8 times longer.',
    difficulty: 'Intermediate',
  },
  {
    question: 'If the star had twice the mass, how would the period of a planet at the same distance change?',
    options: ['It would double', 'It would be about 0.71 times as long', 'It would halve', 'It would not change'],
    answer: 1,
    explanation:
      'The general form of Kepler’s third law is T² = 4π²a³/(GM). Doubling M divides T² by 2, so T is divided by √2 — it becomes about 0.71 times as long. A heavier star means stronger gravity and faster orbits.',
    difficulty: 'Advanced',
  },
  {
    question: 'An orbit has eccentricity 0. What shape is it?',
    options: ['A circle', 'A very long ellipse', 'A parabola', 'A straight line'],
    answer: 0,
    explanation:
      'Eccentricity measures how stretched an orbit is: 0 is a circle, values between 0 and 1 are ellipses, 1 is a parabola (just escaping), and above 1 is a hyperbola. Earth’s orbit has e ≈ 0.017, very nearly circular.',
    difficulty: 'Advanced',
  },
];
