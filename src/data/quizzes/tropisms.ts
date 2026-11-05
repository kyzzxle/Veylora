import type { QuizQuestion } from '../quiz-types';

export const tropismsQuiz: QuizQuestion[] = [
  {
    question: 'What is a tropism?',
    options: [
      'A plant disease',
      'A growth response of a plant toward or away from a stimulus',
      'A type of flower',
      'The movement of water in a plant',
    ],
    answer: 1,
    explanation: 'Tropisms are directional growth responses. Phototropism responds to light, gravitropism (geotropism) to gravity.',
    difficulty: 'Basic',
  },
  {
    question: 'A shoot bends toward a window. This is…',
    options: ['negative phototropism', 'positive phototropism', 'positive gravitropism', 'not a tropism'],
    answer: 1,
    explanation: 'Growing toward a stimulus is a positive response. Bending toward light helps leaves capture more light for photosynthesis.',
    difficulty: 'Basic',
  },
  {
    question: 'Roots grow downward. This is…',
    options: ['positive gravitropism', 'negative gravitropism', 'positive phototropism', 'thigmotropism'],
    answer: 0,
    explanation: 'Roots grow toward the pull of gravity, which takes them into the soil to find water and anchor the plant.',
    difficulty: 'Basic',
  },
  {
    question: 'Which plant hormone is mainly responsible for phototropism in shoots?',
    options: ['Insulin', 'Auxin', 'Adrenaline', 'Chlorophyll'],
    answer: 1,
    explanation: 'Auxin is produced in the shoot tip. Light from one side causes auxin to move to the shaded side.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does auxin make a shoot bend toward the light?',
    options: [
      'It kills cells on the shaded side',
      'It collects on the shaded side and makes those cells elongate more, so the shoot curves toward the light',
      'It makes cells on the lit side grow faster',
      'It absorbs light',
    ],
    answer: 1,
    explanation: 'Cells on the shaded side lengthen more than those on the lit side, so the shoot curves toward the light source.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A pot is tipped on its side. A few days later, how do the shoot and root look?',
    options: [
      'Both keep growing sideways',
      'The shoot curves upward and the root curves downward',
      'Both curve downward',
      'The plant stops growing',
    ],
    answer: 1,
    explanation: 'New growth re-orients: the shoot shows negative gravitropism and the root positive gravitropism. Only the growing regions bend, so the older parts stay sideways. Try tilting the pot to 90°.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does a seedling on a slowly rotating clinostat grow straight in its original direction?',
    options: [
      'Rotation damages its hormones',
      'Because the plant keeps turning, gravity (and any side light) acts equally from all directions, so there is no one-sided stimulus',
      'Clinostats remove all gravity from the Earth',
      'The plant becomes too dizzy to grow',
    ],
    answer: 1,
    explanation:
      'Gravity still pulls on the plant, but its direction relative to the plant keeps changing, so the effects cancel out. Clinostats were used to show that gravity, not something else, causes gravitropism.',
    difficulty: 'Advanced',
  },
];
