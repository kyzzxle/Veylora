import type { QuizQuestion } from '../quiz-types';

export const inclineQuiz: QuizQuestion[] = [
  {
    question: 'A 5 kg block rests on a 30° slope (g = 9.81 m/s²). What is the component of its weight along the slope?',
    options: ['49.1 N', '42.5 N', '24.5 N', '5.0 N'],
    answer: 2,
    explanation: 'W∥ = mg sin θ = 5 × 9.81 × sin 30° = 5 × 9.81 × 0.5 ≈ 24.5 N. The component into the slope is mg cos θ ≈ 42.5 N.',
    difficulty: 'Basic',
  },
  {
    question: 'For the same block on the 30° slope, what is the normal force?',
    options: ['49.1 N, the full weight', 'mg cos θ ≈ 42.5 N', 'mg sin θ ≈ 24.5 N', 'Zero, because the slope is tilted'],
    answer: 1,
    explanation: 'Nothing else pushes into or out of the surface, so the normal force balances the perpendicular component of the weight: N = mg cos θ. It is less than the weight on any tilted surface.',
    difficulty: 'Basic',
  },
  {
    question: 'A 5 kg block rests on a 20° slope with μs = 0.5. How large is the static friction force on it?',
    options: [
      '23.0 N, the maximum μs N',
      '16.8 N, exactly enough to balance W∥',
      '0 N, because the block is not moving',
      '49.1 N, the full weight',
    ],
    answer: 1,
    explanation: 'Static friction is only as large as it needs to be. W∥ = mg sin 20° ≈ 16.8 N, which is less than the maximum μs mg cos 20° ≈ 23.0 N, so friction is 16.8 N and the block stays put.',
    difficulty: 'Intermediate',
  },
  {
    question: 'With μs = 0.5, at what angle does a block on the slope start to slip?',
    options: ['About 26.6°', 'About 30°', 'About 45°', 'It depends on the mass of the block'],
    answer: 0,
    explanation: 'The block slips when mg sin θ > μs mg cos θ, that is, when tan θ > μs. So θc = tan⁻¹(0.5) ≈ 26.6°. The mass cancels.',
    difficulty: 'Intermediate',
  },
  {
    question: 'You double the mass of a sliding block, keeping the angle and surfaces the same. What happens to its acceleration?',
    options: ['It doubles', 'It halves', 'It stays the same', 'It becomes zero'],
    answer: 2,
    explanation: 'Every force along the slope (W∥ and friction) is proportional to m, so a = g (sin θ − μk cos θ) does not depend on mass. Try it with the mass slider.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the acceleration of a block sliding down a frictionless 30° slope?',
    options: ['9.81 m/s²', '4.91 m/s²', '8.50 m/s²', '0 m/s²'],
    answer: 1,
    explanation: 'With no friction, a = g sin θ = 9.81 × 0.5 ≈ 4.91 m/s². This is the frictionless block in the comparison lane.',
    difficulty: 'Basic',
  },
  {
    question: 'A block slides down a 40° slope with μk = 0.35. What is its acceleration?',
    options: ['About 6.31 m/s²', 'About 3.68 m/s²', 'About 2.63 m/s²', 'About 9.81 m/s²'],
    answer: 1,
    explanation: 'a = g (sin θ − μk cos θ) = 9.81 × (0.643 − 0.35 × 0.766) ≈ 9.81 × 0.375 ≈ 3.68 m/s².',
    difficulty: 'Advanced',
  },
  {
    question: 'You push a block so that it slides UP the slope. Which way does kinetic friction act while it moves up?',
    options: ['Up the slope', 'Down the slope, opposing the motion', 'Into the surface', 'There is no friction while it moves up'],
    answer: 1,
    explanation: 'Kinetic friction always opposes the direction of sliding. Moving up, both friction and W∥ point down the slope, so the block slows at g (sin θ + μk cos θ).',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is μk usually smaller than μs for the same pair of surfaces?',
    options: [
      'Moving objects are lighter',
      'Once surfaces slide, tiny bumps have less time to settle into each other and bond, so it takes less force to keep them sliding than to start them',
      'Kinetic friction does not depend on the normal force',
      'Gravity is weaker on moving objects',
    ],
    answer: 1,
    explanation: 'This is why it is harder to start pushing a heavy box than to keep it moving, and why a block can stay put until the slope is steep enough, then slide off quickly.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A block sits still on a slope. Which statement about the forces on it is correct?',
    options: [
      'The normal force equals the weight',
      'The net force is zero: N balances W⊥ and static friction balances W∥',
      'Friction is larger than W∥',
      'Only gravity acts on it',
    ],
    answer: 1,
    explanation: 'At rest, Newton’s first law requires the forces to balance in both directions: perpendicular to the slope (N = mg cos θ) and along it (fs = mg sin θ).',
    difficulty: 'Basic',
  },
];
