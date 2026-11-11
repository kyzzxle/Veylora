import type { QuizQuestion } from '../quiz-types';

export const optimizationQuiz: QuizQuestion[] = [
  {
    question: 'In a linear programming problem, what is the feasible region?',
    options: [
      'The point where the objective is largest',
      'The set of all points that satisfy every constraint',
      'The line where the objective equals zero',
      'The area outside all the constraint lines',
    ],
    answer: 1,
    explanation: 'Each constraint keeps one side of a line. The feasible region is where all those allowed sides overlap: every point in it is a plan you are allowed to choose.',
    difficulty: 'Basic',
  },
  {
    question: 'Maximize Z = 3x + 2y subject to x + y ≤ 4, x ≤ 2, y ≤ 3, x ≥ 0, y ≥ 0. What is the maximum?',
    options: ['Z = 9 at (1, 3)', 'Z = 6 at (2, 0)', 'Z = 10 at (2, 2)', 'Z = 12 at (4, 0)'],
    answer: 2,
    explanation: 'The corners are (0, 0), (2, 0), (2, 2), (1, 3) and (0, 3), giving Z = 0, 6, 10, 9 and 6. The largest is 10 at (2, 2). The point (4, 0) breaks x ≤ 2.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is it enough to check only the corners of the feasible region in a linear program?',
    options: [
      'Because the objective is linear, so if a best value exists it is reached at a corner',
      'Because the corners are the only points that satisfy the constraints',
      'Because the objective is zero everywhere else',
      'It is not enough; every point must be checked',
    ],
    answer: 0,
    explanation: 'Level lines of a linear objective are parallel straight lines. Sliding them in the improving direction, the last contact with a polygon is at a corner (or along a whole edge, which includes corners).',
    difficulty: 'Intermediate',
  },
  {
    question: 'The objective’s level lines are parallel to one edge of the feasible region, and that edge is on the improving side. What happens?',
    options: ['The problem becomes infeasible', 'There is no optimum', 'Only the origin is optimal', 'Every point on that edge is optimal (multiple optima)'],
    answer: 3,
    explanation: 'The best level line touches the region along the whole edge, so all its points give the same best value, including the two corners at its ends.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A problem has constraints x + y ≥ 6, x ≤ 2 and y ≤ 3. What can you say?',
    options: ['It is unbounded', 'It is infeasible: no point satisfies all three', 'The optimum is at (2, 3)', 'It has multiple optima'],
    answer: 1,
    explanation: 'With x ≤ 2 and y ≤ 3, x + y is at most 5, so x + y ≥ 6 can never hold at the same time. There is no feasible point to optimize over.',
    difficulty: 'Basic',
  },
  {
    question: 'When is a maximization linear program called unbounded?',
    options: [
      'When the feasible region is empty',
      'When the constraints are all ≤',
      'When feasible points exist with arbitrarily large objective values',
      'When the objective has a negative coefficient',
    ],
    answer: 2,
    explanation: 'An open (unbounded) feasible region is not enough on its own: the objective must also keep improving in a direction the region extends in forever. Then there is no maximum.',
    difficulty: 'Intermediate',
  },
  {
    question: 'At the optimum, a constraint has zero slack. What is it called, and what does relaxing it do?',
    options: [
      'Redundant; relaxing it changes nothing',
      'Infeasible; relaxing it makes the problem unbounded',
      'Free; relaxing it lowers the objective',
      'Binding; relaxing it can improve the best value, by its shadow price per unit',
    ],
    answer: 3,
    explanation: 'A binding constraint is used up exactly. Loosening its limit by one unit moves the optimal corner and changes the best value by the shadow price, as long as the same constraints stay binding.',
    difficulty: 'Advanced',
  },
  {
    question: 'A farmer has 40 m of fence to enclose a rectangular field. Which dimensions give the largest area?',
    options: ['10 m × 10 m', '5 m × 15 m', '12 m × 8 m', '20 m × 20 m'],
    answer: 0,
    explanation: 'With 2x + 2y = 40, the area is A = x(20 − x). A′(x) = 20 − 2x = 0 gives x = 10, so the best shape is a 10 m square with area 100 m². 20 m × 20 m would need 80 m of fence.',
    difficulty: 'Basic',
  },
  {
    question: 'A closed can must hold a fixed volume V using as little metal as possible. In the simple model S = 2πr² + 2V/r, what shape is best?',
    options: ['Very tall and thin', 'Height equal to the diameter (h = 2r)', 'Height equal to the radius', 'Very short and wide'],
    answer: 1,
    explanation: 'S′(r) = 4πr − 2V/r² = 0 gives V = 2πr³, and since V = πr²h this means h = 2r: the can is as tall as it is wide. Real cans differ because lids and seams cost more.',
    difficulty: 'Advanced',
  },
  {
    question: 'In a factory problem the best corner is (6.5, 11), but only whole numbers of crates can be made. What is the right approach?',
    options: [
      'Always round both numbers up',
      'Always round both numbers down',
      'Use the corner anyway and ignore the fractions',
      'Check the allowed whole-number points near the corner; rounding may break a constraint or miss the best plan',
    ],
    answer: 3,
    explanation: 'Rounding up can break a limit, and rounding down is allowed but not always best. Integer programming searches the allowed whole-number points; in the simulator the best whole-number plan is (6, 11).',
    difficulty: 'Advanced',
  },
];
