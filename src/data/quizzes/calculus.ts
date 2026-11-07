import type { QuizQuestion } from '../quiz-types';

export const calculusQuiz: QuizQuestion[] = [
  {
    question: 'f(x) = (x² − 4)/(x − 2) is undefined at x = 2. What is the limit of f(x) as x → 2?',
    options: ['It does not exist, because f(2) is undefined', '0', '4', '2'],
    answer: 2,
    explanation: 'For x ≠ 2, f(x) = x + 2, so the values approach 4 from both sides. A limit depends on values near the point, not at it: this is a removable discontinuity.',
    difficulty: 'Intermediate',
  },
  {
    question: 'As x → 0 from the left, g(x) → −1; as x → 0 from the right, g(x) → 1. What can you conclude?',
    options: [
      'The two-sided limit does not exist, because the one-sided limits differ',
      'The limit is 0, the average of −1 and 1',
      'The limit is 1',
      'g must be undefined at 0',
    ],
    answer: 0,
    explanation: 'A two-sided limit exists only when the left-hand and right-hand limits are equal. Here g has a jump discontinuity at 0, whatever g(0) is.',
    difficulty: 'Basic',
  },
  {
    question: 'What does the derivative f′(a) measure?',
    options: [
      'The average rate of change of f over a long interval',
      'The area under f from 0 to a',
      'The value of f at a',
      'The instantaneous rate of change of f at a: the slope of the tangent line there',
    ],
    answer: 3,
    explanation: 'f′(a) = lim h→0 [f(a + h) − f(a)]/h is the limit of secant slopes (average rates of change) as the interval shrinks to zero.',
    difficulty: 'Basic',
  },
  {
    question: 'For f(x) = x², the secant slope from x = 3 to x = 3 + h is 6 + h. In the simulator, what do you predict as you drag Q towards P?',
    options: ['The secant slope grows without limit', 'The secant slope approaches 6, the tangent slope f′(3)', 'The secant slope approaches 9', 'The secant slope approaches 0'],
    answer: 1,
    explanation: 'As h → 0, 6 + h → 6. The derivative of x² is 2x, and 2 × 3 = 6.',
    difficulty: 'Intermediate',
  },
  {
    question: 'f′(x) > 0 for all x in an interval. What does this tell you about f on that interval?',
    options: ['f is increasing', 'f is decreasing', 'f is positive', 'f has a maximum there'],
    answer: 0,
    explanation: 'A positive derivative means the tangent slopes upward everywhere in the interval, so f increases. It says nothing about whether f itself is positive.',
    difficulty: 'Basic',
  },
  {
    question: 'For f(x) = x³, f′(0) = 0. Is x = 0 a local maximum or minimum?',
    options: [
      'A local maximum',
      'A local minimum',
      'Neither: f′ is positive on both sides, so f keeps increasing through 0',
      'Both a maximum and a minimum',
    ],
    answer: 2,
    explanation: 'A stationary point (f′ = 0) is a maximum or minimum only if f′ changes sign there. For x³, f′(x) = 3x² ≥ 0 on both sides, so 0 is a stationary inflection point.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does f(x) = |x| have no derivative at x = 0?',
    options: [
      'Because f(0) = 0',
      'Because the slope from the left (−1) and from the right (+1) are different: there is a corner',
      'Because |x| is not continuous at 0',
      'Because |x| is never negative',
    ],
    answer: 1,
    explanation: '|x| is continuous at 0, but the one-sided difference quotients disagree, so no single tangent slope exists. Continuity does not guarantee differentiability.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Using 2 midpoint rectangles, estimate ∫ from 0 to 2 of x² dx.',
    options: ['2', '2.5', '8/3', '4'],
    answer: 1,
    explanation: 'Δx = 1 and the midpoints are 0.5 and 1.5, so the sum is 1 × (0.25 + 2.25) = 2.5. The exact value is 8/3 ≈ 2.67.',
    difficulty: 'Advanced',
  },
  {
    question: '∫ from 0 to 2π of sin x dx = 0. Why is this not the same as the total area between the curve and the x-axis?',
    options: [
      'Because sin x is never zero',
      'Because the calculation is wrong; the area must be 0',
      'Because 2π is not a real number',
      'Because the integral counts area below the axis as negative; the geometric area is 4',
    ],
    answer: 3,
    explanation: 'The definite integral measures signed accumulation. The parts above and below the axis each have area 2 and cancel; the total geometric area ∫|sin x| dx is 4.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A(x) = ∫ from 0 to x of f(t) dt, where f is continuous. According to the fundamental theorem of calculus, what is A′(x)?',
    options: ['f(x)', 'f′(x)', 'A(x) − A(0)', 'x · f(x)'],
    answer: 0,
    explanation: 'The rate at which accumulated area grows equals the height of the curve at the moving edge: d/dx ∫ₐˣ f(t) dt = f(x). This links integration and differentiation.',
    difficulty: 'Advanced',
  },
];
