import type { QuizQuestion } from '../quiz-types';

export const fractalsQuiz: QuizQuestion[] = [
  {
    question: 'For the Mandelbrot set, z starts at 0 and repeats z → z² + c. What are the first three values of z for c = 1?',
    options: ['0, 1, 2', '0, 1, 1', '0, 1, 4', '1, 2, 5'],
    answer: 0,
    explanation: 'z₀ = 0, z₁ = 0² + 1 = 1, z₂ = 1² + 1 = 2, then z₃ = 5, 26, … The sequence grows without limit, so c = 1 is not in the set.',
    difficulty: 'Basic',
  },
  {
    question: 'Once some zₙ has |zₙ| > 2, what can we conclude about c?',
    options: [
      'c is in the Mandelbrot set',
      'Nothing yet: we need more iterations',
      'The sequence will escape to infinity, so c is not in the set',
      'The sequence will come back below 2',
    ],
    answer: 2,
    explanation: 'It can be proved that once |z| exceeds 2 the values grow without bound. That is why the lab stops a point as soon as it passes |z| = 2.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the lab a point stays black after 200 iterations. Does that prove it is in the Mandelbrot set?',
    options: [
      'Yes: 200 iterations is a proof',
      'No: it only shows the sequence stayed bounded so far; it might escape after more iterations',
      'No: black points are never in the set',
      'Yes, as long as the colouring is “smooth”',
    ],
    answer: 1,
    explanation: 'A finite iteration limit can confirm escape but never membership. Points near the boundary may need thousands of iterations to escape, which is why deep zooms need a higher limit.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How is a Julia set different from the Mandelbrot set?',
    options: [
      'They use different formulas',
      'The Julia set uses z → z³ + c',
      'There is only one Julia set',
      'For a Julia set, c is fixed and the starting value z₀ varies; for the Mandelbrot set, z₀ = 0 and c varies',
    ],
    answer: 3,
    explanation: 'Both use z → z² + c. Each value of c has its own Julia set, while the Mandelbrot set is a map of all the c values.',
    difficulty: 'Basic',
  },
  {
    question: 'In the lab you drag c from inside the black Mandelbrot set to outside it. What happens to the Julia set?',
    options: [
      'It changes from one connected piece to scattered “dust”',
      'Nothing changes',
      'It becomes a perfect circle',
      'It becomes the Mandelbrot set',
    ],
    answer: 0,
    explanation: 'A Julia set is connected exactly when c is in the Mandelbrot set; for c outside it, the Julia set is a totally disconnected Cantor dust.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What fraction of the original area of the Sierpinski triangle remains after 3 steps?',
    options: ['1/2', '1/8', '27/64', '3/4'],
    answer: 2,
    explanation: 'Each step keeps 3 of 4 equal triangles, so (3/4)³ = 27/64 ≈ 0.42 remains. As the steps continue the area tends to 0.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Each step of the Koch snowflake multiplies the perimeter by 4/3. What happens to the perimeter and the area as the steps continue?',
    options: [
      'Both grow without limit',
      'Both approach fixed values',
      'The perimeter shrinks to 0',
      'The perimeter grows without limit while the area approaches 8/5 of the original triangle',
    ],
    answer: 3,
    explanation: '(4/3)ⁿ grows forever, but each new set of bumps adds less and less area, so the area converges. An infinitely long curve encloses a finite region.',
    difficulty: 'Advanced',
  },
  {
    question: 'The Sierpinski triangle is made of 3 copies of itself, each scaled by 1/2. What is its similarity dimension?',
    options: ['log 2 / log 3 ≈ 0.63', 'log 3 / log 2 ≈ 1.585', '1.5 exactly', '2, because it is a triangle'],
    answer: 1,
    explanation: 'For N copies scaled by r, D = log N / log(1/r) = log 3 / log 2 ≈ 1.585. The Koch curve, with 4 copies scaled by 1/3, has D = log 4 / log 3 ≈ 1.262: fractals do not all share the same dimension.',
    difficulty: 'Advanced',
  },
  {
    question: 'The chaos game picks corners at random, yet always draws the same Sierpinski triangle. Why?',
    options: [
      'Every jump halves the distance to the triangle, so points are pulled onto it whatever the random choices; randomness only changes the order',
      'The computer secretly draws the triangle first',
      'Random numbers always repeat',
      'It only works with exactly 1,000 points',
    ],
    answer: 0,
    explanation: 'The three “jump halfway to a corner” maps have the Sierpinski triangle as their unique attractor. The random choices decide which points appear and when, not the final shape.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the lab you change the lean of map f₂ of the Barnsley fern. Why does the whole fern curl, not just one part?',
    options: [
      'Because f₂ controls only the colour',
      'Because every leaflet is a smaller copy of the whole fern made by repeatedly applying the maps, so changing one map changes every scale',
      'Because the fern is drawn by hand',
      'Because f₂ is used only once',
    ],
    answer: 1,
    explanation: 'f₂ maps the whole fern onto its slightly smaller upper part and is used about 85% of the time. Self-similarity means a change to it appears at every level of detail.',
    difficulty: 'Intermediate',
  },
];
