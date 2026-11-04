import type { QuizQuestion } from '../quiz-types';

export const functionsQuiz: QuizQuestion[] = [
  {
    question: 'How does the graph of y = x² + 3 compare with y = x²?',
    options: ['Shifted 3 units right', 'Shifted 3 units up', 'Stretched by a factor of 3', 'Shifted 3 units down'],
    answer: 1,
    explanation: 'Adding a constant k outside the function moves every point up by k. Set k = 3 to see the vertex move to (0, 3).',
    difficulty: 'Basic',
  },
  {
    question: 'Which equation shifts y = |x| five units to the right?',
    options: ['y = |x| + 5', 'y = |x + 5|', 'y = |x − 5|', 'y = 5|x|'],
    answer: 2,
    explanation:
      'Inside the function, x − h shifts the graph right by h. The minus sign is easy to misread: |x − 5| has its vertex at x = 5, whereas |x + 5| is shifted left.',
    difficulty: 'Basic',
  },
  {
    question: 'What does a negative value of a do to y = a·f(x)?',
    options: [
      'Reflects the graph across the x-axis',
      'Reflects the graph across the y-axis',
      'Shifts the graph left',
      'Makes the graph disappear',
    ],
    answer: 0,
    explanation: 'Multiplying every output by a negative number flips the graph upside down — a reflection across the x-axis. A negative b reflects across the y-axis instead.',
    difficulty: 'Basic',
  },
  {
    question: 'The graph of y = 3x² compared with y = x² is…',
    options: ['wider', 'narrower (steeper)', 'shifted up 3', 'shifted right 3'],
    answer: 1,
    explanation: 'Each y-value is tripled, so the parabola rises three times as fast — it looks narrower. A value of a between 0 and 1 would make it wider.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the period of y = sin(2x)?',
    options: ['2π', 'π', '4π', '2'],
    answer: 1,
    explanation: 'A horizontal stretch factor b changes the period from 2π to 2π/|b|. With b = 2 the graph repeats twice as often, so the period is π.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the vertex of y = −2(x + 1)² + 4?',
    options: ['(1, 4)', '(−1, 4)', '(−1, −4)', '(2, 4)'],
    answer: 1,
    explanation:
      'Writing it as a(x − h)² + k gives h = −1 and k = 4, so the vertex is (−1, 4). Because a is negative, the parabola opens downward and the vertex is a maximum.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where are the asymptotes of y = 1/(x − 2) + 3?',
    options: ['x = −2 and y = 3', 'x = 2 and y = 3', 'x = 2 and y = −3', 'x = 3 and y = 2'],
    answer: 1,
    explanation:
      'The function is undefined where x − 2 = 0, giving a vertical asymptote at x = 2. As x grows very large, 1/(x − 2) approaches 0, so y approaches 3: a horizontal asymptote at y = 3.',
    difficulty: 'Advanced',
  },
];
