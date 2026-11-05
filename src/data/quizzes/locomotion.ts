import type { QuizQuestion } from '../quiz-types';

export const locomotionQuiz: QuizQuestion[] = [
  {
    question: 'Which four forces act on a flying bird?',
    options: ['Lift, weight, thrust and drag', 'Gravity, friction, magnetism and lift', 'Speed, mass, energy and power', 'Push, pull, twist and bend'],
    answer: 0,
    explanation: 'Lift pushes up, weight pulls down, thrust pushes forward and drag holds it back. In steady level flight lift = weight and thrust = drag.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, what happens if you tilt the wing past about 15°?',
    options: ['Lift keeps increasing', 'The wing stalls: airflow breaks away and lift suddenly drops', 'The bird flies faster', 'Drag disappears'],
    answer: 1,
    explanation: 'Beyond the critical angle of attack, air can no longer follow the curved upper surface. Birds land by deliberately stalling just above the ground.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do large birds such as albatrosses need very long wings?',
    options: [
      'To look impressive',
      'Weight grows faster than wing area as birds get bigger, so heavy birds need much larger wings to make enough lift',
      'To swim better',
      'Long wings make them lighter',
    ],
    answer: 1,
    explanation: 'Lift depends on wing area (length²) while weight depends on volume (length³). Very large birds need huge wings or high speeds.',
    difficulty: 'Advanced',
  },
  {
    question: 'How does a fish push itself forward?',
    options: [
      'By sucking water in',
      'Its tail pushes water backwards, so the water pushes the fish forwards',
      'By floating',
      'By flapping its gills',
    ],
    answer: 1,
    explanation: 'This is Newton’s third law: every action has an equal and opposite reaction.',
    difficulty: 'Basic',
  },
  {
    question: 'Why are fast fish such as tuna streamlined?',
    options: [
      'To look like other fish',
      'A smooth, tapered shape greatly reduces drag, so less energy is needed to swim fast',
      'To store more oxygen',
      'Streamlining makes them heavier',
    ],
    answer: 1,
    explanation: 'Water is about 800 times denser than air, so drag is a huge cost. Compare the drag of the streamlined and boxy shapes in the simulator.',
    difficulty: 'Basic',
  },
  {
    question: 'What does a swim bladder do?',
    options: [
      'Helps the fish breathe',
      'Holds gas to make the fish the same density as water, so it neither sinks nor floats up',
      'Stores food',
      'Produces thrust',
    ],
    answer: 1,
    explanation: 'Without one, a fish is denser than water and must keep swimming to avoid sinking, as sharks do.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Animals of very different sizes switch from walking to running at about the same Froude number. What is it roughly?',
    options: ['0.05', '0.5', '5', '50'],
    answer: 1,
    explanation: 'Fr = v² ÷ (g × leg length). Around 0.5, gravity can no longer keep the body vaulting over a stiff leg, so a running gait becomes better.',
    difficulty: 'Advanced',
  },
  {
    question: 'Using Fr = 0.5, roughly how fast can a person with 0.9 m legs walk before they need to break into a run?',
    options: ['About 0.5 m/s', 'About 2 m/s', 'About 5 m/s', 'About 10 m/s'],
    answer: 1,
    explanation: 'v = √(0.5 × 9.81 × 0.9) ≈ 2.1 m/s, close to the speed at which people actually switch to running.',
    difficulty: 'Intermediate',
  },
];
