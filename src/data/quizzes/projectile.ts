import type { QuizQuestion } from '../quiz-types';

export const projectileQuiz: QuizQuestion[] = [
  {
    question: 'Ignoring air resistance, what happens to a projectile’s horizontal velocity during its flight?',
    options: ['It decreases steadily', 'It stays constant', 'It increases steadily', 'It becomes zero at the top'],
    answer: 1,
    explanation:
      'With no air resistance there is no horizontal force, so the horizontal velocity never changes. In the graph, the vₓ line is perfectly flat.',
    difficulty: 'Basic',
  },
  {
    question: 'At the highest point of its path, a projectile’s vertical velocity is…',
    options: ['at its maximum', 'equal to its launch speed', 'zero', 'equal to its horizontal velocity'],
    answer: 2,
    explanation:
      'At the top the projectile stops rising and is about to fall, so v_y = 0 for an instant. It is still moving horizontally, so its total speed is not zero.',
    difficulty: 'Basic',
  },
  {
    question: 'On level ground with no air resistance, which launch angle gives the greatest range?',
    options: ['30°', '45°', '60°', '90°'],
    answer: 1,
    explanation:
      'Range R = v² sin(2θ)/g is largest when sin(2θ) = 1, which happens at θ = 45°. Try 30° and 60° — they give the same range.',
    difficulty: 'Basic',
  },
  {
    question: 'Two balls are launched at the same speed, one at 30° and one at 60°. Ignoring air, how do their ranges compare?',
    options: ['The 60° ball goes twice as far', 'The 30° ball goes twice as far', 'They land at the same place', 'The 60° ball lands closer'],
    answer: 2,
    explanation:
      'Complementary angles (adding to 90°) give the same value of sin(2θ), so the ranges are equal. The 60° ball flies higher and stays in the air longer.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The same launch is repeated on the Moon, where gravity is about one-sixth of Earth’s. Ignoring air, the range becomes…',
    options: ['the same', 'about 6 times longer', 'about 36 times longer', 'about 6 times shorter'],
    answer: 1,
    explanation:
      'Range on level ground is R = v² sin(2θ)/g, so it is inversely proportional to g. Dividing g by about 6 multiplies the range by about 6.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When air resistance is switched on, how does the shape of the path change?',
    options: [
      'It stays a perfect parabola, only shorter',
      'It becomes lopsided: the descent is steeper than the climb',
      'It becomes a straight line',
      'It becomes taller and longer',
    ],
    answer: 1,
    explanation:
      'Drag removes horizontal speed throughout the flight, so the projectile covers less ground on the way down than on the way up. The path is no longer a symmetric parabola, and the best angle for range drops below 45°.',
    difficulty: 'Advanced',
  },
  {
    question: 'A ball is thrown horizontally from a 20 m cliff at 10 m/s on Earth (g ≈ 9.8 m/s²). About how long until it lands?',
    options: ['1.0 s', '2.0 s', '4.1 s', '0.5 s'],
    answer: 1,
    explanation:
      'Vertical motion is independent of horizontal motion: 20 = ½ · 9.8 · t², so t = √(40/9.8) ≈ 2.0 s — the same time as a ball simply dropped from the cliff.',
    difficulty: 'Advanced',
  },
];
