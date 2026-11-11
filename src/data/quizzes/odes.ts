import type { QuizQuestion } from '../quiz-types';

export const odesQuiz: QuizQuestion[] = [
  {
    question: 'For dN/dt = kN with k = −0.2, what happens to N over time?',
    options: ['It grows exponentially', 'It decays exponentially towards 0', 'It stays constant', 'It oscillates'],
    answer: 1,
    explanation: 'The solution is N = N₀e^(−0.2t). A negative k means the rate of change is negative and proportional to N, so N shrinks ever more slowly towards 0.',
    difficulty: 'Basic',
  },
  {
    question: 'A quantity follows dN/dt = kN with k = 0.35 per hour. Roughly how long does it take to double?',
    options: ['0.35 hours', '0.7 hours', '2 hours', '3.5 hours'],
    answer: 2,
    explanation: 'The doubling time is ln 2 / k ≈ 0.693 / 0.35 ≈ 2 hours. It does not depend on the starting amount.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A cup of tea at 90 °C cools in a 20 °C room following dT/dt = −k(T − 20). When is it cooling fastest?',
    options: [
      'Right at the start, when the temperature difference is largest',
      'When it reaches 55 °C',
      'Just before it reaches room temperature',
      'The rate is the same all the time',
    ],
    answer: 0,
    explanation: 'The cooling rate is proportional to the gap T − 20. The gap is largest at the start, so the temperature falls fastest then, and more and more slowly afterwards.',
    difficulty: 'Basic',
  },
  {
    question: 'In the Newton’s law of cooling model, what temperature does the object approach in the long run?',
    options: ['0 °C', 'Its starting temperature', 'Halfway between its start and the room', 'The room (ambient) temperature Tₐ'],
    answer: 3,
    explanation: 'T(t) = Tₐ + (T₀ − Tₐ)e^(−kt), and e^(−kt) → 0, so T → Tₐ. In this model it approaches Tₐ but never exactly reaches it.',
    difficulty: 'Basic',
  },
  {
    question: 'A mass on a spring obeys m x″ + b x′ + k x = 0 with m = 1, k = 9. Which damping b makes it critically damped?',
    options: ['b = 3', 'b = 9', 'b = 6', 'b = 18'],
    answer: 2,
    explanation: 'Critical damping is b = 2√(mk) = 2√9 = 6. Smaller b gives oscillations that die away (underdamped); larger b gives a slow creep back (overdamped).',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the spring simulation you double the mass and keep k and b the same (still underdamped). What do you predict?',
    options: [
      'It oscillates faster',
      'It oscillates more slowly, because ω₀ = √(k/m) gets smaller',
      'It stops oscillating',
      'Nothing changes',
    ],
    answer: 1,
    explanation: 'The natural angular frequency √(k/m) falls by a factor of √2, so the period gets about 41% longer. Heavier masses respond more sluggishly to the same spring.',
    difficulty: 'Intermediate',
  },
  {
    question: 'For logistic growth dN/dt = rN(1 − N/K), at what value of N is the growth rate largest?',
    options: ['N = K', 'N = 0', 'N = 2K', 'N = K/2'],
    answer: 3,
    explanation: 'rN(1 − N/K) is a parabola in N with its peak halfway between its zeros at 0 and K. That is why the S-shaped curve is steepest at K/2.',
    difficulty: 'Intermediate',
  },
  {
    question: 'For the system x′ = ax + by, y′ = cx + dy, the matrix has eigenvalues −0.5 ± 2i. What do trajectories near the origin look like?',
    options: [
      'Straight lines out to infinity',
      'Closed loops that never change size',
      'Spirals that wind into the origin',
      'They stay where they start',
    ],
    answer: 2,
    explanation: 'The imaginary part makes solutions rotate, and the negative real part makes them shrink like e^(−0.5t): a stable spiral.',
    difficulty: 'Advanced',
  },
  {
    question: 'Euler’s method uses yₙ₊₁ = yₙ + h·f(tₙ, yₙ). What happens to the error at a fixed time if you halve the step size h?',
    options: ['It roughly halves', 'It doubles', 'It stays the same', 'It becomes exactly zero'],
    answer: 0,
    explanation: 'Euler’s method is first order: its global error is roughly proportional to h. Halving h about halves the error, at the cost of twice as many steps.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, Euler’s method for dy/dt = −y with h = 2.2 zig-zags and grows instead of decaying. Why?',
    options: [
      'The exact solution grows',
      'The computer made a rounding error',
      'Euler’s method is always unstable',
      'Each step multiplies y by 1 − h = −1.2, whose size is greater than 1, so the numbers grow',
    ],
    answer: 3,
    explanation: 'For y′ = −y, one step gives yₙ₊₁ = (1 − h)yₙ. This decays only if |1 − h| < 1, that is h < 2. With h = 2.2 the factor is −1.2, so the values flip sign and grow: the method is unstable.',
    difficulty: 'Advanced',
  },
];
