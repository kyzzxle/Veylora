import type { QuizQuestion } from '../quiz-types';

export const vectorsQuiz: QuizQuestion[] = [
  {
    question: 'Which of these is a vector quantity?',
    options: ['Mass', 'Temperature', 'Velocity', 'Time'],
    answer: 2,
    explanation: 'A vector has both magnitude and direction. Velocity (for example 20 m/s north) is a vector; mass, temperature and time have size only — they are scalars.',
    difficulty: 'Basic',
  },
  {
    question: 'A vector of length 3 and a vector of length 4 point in the same direction. What is the length of their sum?',
    options: ['1', '5', '7', '12'],
    answer: 2,
    explanation: 'Vectors in the same direction add like ordinary numbers: 3 + 4 = 7. Use the “Same direction” button to check.',
    difficulty: 'Basic',
  },
  {
    question: 'The same two vectors (3 and 4) point in opposite directions. What is the length of their sum?',
    options: ['1', '5', '7', '0'],
    answer: 0,
    explanation: 'Opposite vectors partly cancel: 4 − 3 = 1, and the resultant points in the direction of the larger vector.',
    difficulty: 'Basic',
  },
  {
    question: 'A vector of length 3 and a vector of length 4 are perpendicular. What is the length of their sum?',
    options: ['7', '5', '1', '12'],
    answer: 1,
    explanation: 'The two vectors and the resultant form a right triangle, so |R| = √(3² + 4²) = √25 = 5 (the Pythagorean theorem).',
    difficulty: 'Intermediate',
  },
  {
    question: 'A = (2, 5) and B = (4, −1). What is A + B?',
    options: ['(6, 4)', '(8, −5)', '(−2, 6)', '(6, 6)'],
    answer: 0,
    explanation: 'Add the components separately: x: 2 + 4 = 6, y: 5 + (−1) = 4. This works for any vectors, whatever their directions.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A vector has magnitude 10 and direction 30° above the positive x-axis. What is its x-component?',
    options: ['5', 'About 8.66', '10', 'About 11.5'],
    answer: 1,
    explanation: 'The x-component is |v|·cos θ = 10 × cos 30° ≈ 10 × 0.866 = 8.66. The y-component is 10 × sin 30° = 5.',
    difficulty: 'Advanced',
  },
  {
    question: 'What does the vector A − B represent when both start at the origin?',
    options: [
      'The vector from the tip of A to the tip of B',
      'The vector from the tip of B to the tip of A',
      'The same as B − A',
      'The sum of their lengths',
    ],
    answer: 1,
    explanation:
      'A − B = A + (−B). Geometrically it is the arrow that goes from B’s tip to A’s tip, because B + (A − B) = A. In physics this is how you find relative velocity or displacement between two positions.',
    difficulty: 'Advanced',
  },
];
