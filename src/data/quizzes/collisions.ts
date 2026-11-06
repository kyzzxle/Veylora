import type { QuizQuestion } from '../quiz-types';

export const collisionsQuiz: QuizQuestion[] = [
  {
    question: 'What is the momentum of a 2 kg puck moving at 3 m/s to the right?',
    options: ['1.5 kg·m/s', '5 kg·m/s', '6 kg·m/s to the right', '9 J'],
    answer: 2,
    explanation: 'Momentum p = mv = 2 × 3 = 6 kg·m/s. Momentum is a vector, so it has a direction: the same as the velocity.',
    difficulty: 'Basic',
  },
  {
    question: 'A 1 kg puck moving at 2 m/s hits an identical puck at rest in a head-on elastic collision. What happens?',
    options: [
      'Both move off together at 1 m/s',
      'The first puck stops and the second moves off at 2 m/s',
      'The first puck bounces back at 2 m/s',
      'Both stop',
    ],
    answer: 1,
    explanation: 'For equal masses in a head-on elastic collision, the velocities are exchanged. Momentum (2 kg·m/s) and kinetic energy (2 J) are both conserved. Try “Hit a still puck”.',
    difficulty: 'Basic',
  },
  {
    question: 'A 2 kg puck at 2 m/s and a 1 kg puck at 1 m/s move towards each other and stick together. What is their velocity afterwards?',
    options: ['1 m/s in the direction the 2 kg puck was moving', '3 m/s', '1.67 m/s', '0 m/s'],
    answer: 0,
    explanation: 'Total momentum = 2 × 2 + 1 × (−1) = 3 kg·m/s. Afterwards the 3 kg pair has v = 3 ÷ 3 = 1 m/s, in the original direction of the heavier puck.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In that sticky collision, how much kinetic energy is lost?',
    options: ['None', '1.5 J', '3 J (two-thirds of it)', '4.5 J (all of it)'],
    answer: 2,
    explanation: 'Before: ½ × 2 × 2² + ½ × 1 × 1² = 4.5 J. After: ½ × 3 × 1² = 1.5 J. So 3 J became heat, sound and deformation, even though momentum was conserved.',
    difficulty: 'Advanced',
  },
  {
    question: 'In which type of collision is total momentum conserved (for an isolated system)?',
    options: ['Only in elastic collisions', 'Only in sticky collisions', 'In all collisions', 'In none, because energy is lost'],
    answer: 2,
    explanation: 'The two objects push on each other with equal and opposite forces for the same time, so their momentum changes cancel. Only kinetic energy depends on the type of collision.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the difference between an elastic and an inelastic collision?',
    options: [
      'Momentum is lost in an inelastic collision',
      'Kinetic energy is conserved in an elastic collision but some is converted to other forms in an inelastic one',
      'Elastic collisions only happen between rubber objects',
      'Inelastic collisions are faster',
    ],
    answer: 1,
    explanation: 'In both, momentum is conserved. The kinetic energy graph shows the difference: flat for elastic, a step down for inelastic.',
    difficulty: 'Basic',
  },
  {
    question: 'Puck B gains 2 kg·m/s of momentum in a collision lasting 0.01 s. What was the average force on it?',
    options: ['0.02 N', '2 N', '20 N', '200 N'],
    answer: 3,
    explanation: 'Impulse J = F Δt = Δp, so F = Δp ÷ Δt = 2 ÷ 0.01 = 200 N. Puck A received an equal and opposite impulse.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do cars have crumple zones and airbags?',
    options: [
      'To reduce the change in momentum',
      'To make the collision elastic',
      'To make the collision last longer, so the same change in momentum happens with a smaller force',
      'To increase the kinetic energy',
    ],
    answer: 2,
    explanation: 'The change in momentum is fixed by the speeds involved. Since F = Δp ÷ Δt, a longer collision time means a smaller force on the passengers.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, a 4 kg puck at 1.5 m/s hits a 0.5 kg puck at rest elastically. Which statement is correct?',
    options: [
      'The heavy puck stops',
      'The heavy puck carries on at about 1.17 m/s and the light one shoots off at about 2.67 m/s',
      'Both move at 1.5 m/s',
      'The heavy puck bounces back',
    ],
    answer: 1,
    explanation: 'For a head-on elastic collision with B at rest: vA′ = (mA − mB)/(mA + mB) × vA and vB′ = 2mA/(mA + mB) × vA. Check: momentum 6 = 4 × 1.17 + 0.5 × 2.67.',
    difficulty: 'Advanced',
  },
  {
    question: 'What happens to the centre of mass of the two pucks during the collision?',
    options: [
      'It stops at the moment of impact',
      'It keeps moving in a straight line at constant velocity',
      'It speeds up',
      'It jumps to the heavier puck',
    ],
    answer: 1,
    explanation: 'The velocity of the centre of mass is the total momentum divided by the total mass. Since the total momentum does not change, neither does that velocity. Watch the green CM marker.',
    difficulty: 'Intermediate',
  },
];
