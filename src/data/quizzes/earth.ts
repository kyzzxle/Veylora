import type { QuizQuestion } from '../quiz-types';

export const earthQuiz: QuizQuestion[] = [
  {
    question: 'What are Earth’s main layers, from the surface inward?',
    options: [
      'Mantle, crust, inner core, outer core',
      'Crust, mantle, outer core, inner core',
      'Crust, outer core, mantle, inner core',
      'Inner core, outer core, mantle, crust',
    ],
    answer: 1,
    explanation: 'Going down from the surface: the thin rocky crust, the thick mantle, the liquid outer core and the solid inner core.',
    difficulty: 'Basic',
  },
  {
    question: 'Which layer is liquid?',
    options: ['The crust', 'The lower mantle', 'The outer core', 'The inner core'],
    answer: 2,
    explanation: 'The outer core is molten iron and nickel. Its motion generates Earth’s magnetic field. The mantle is solid rock that flows extremely slowly.',
    difficulty: 'Basic',
  },
  {
    question: 'Which layer makes up most of Earth’s volume?',
    options: ['The crust', 'The mantle', 'The outer core', 'The inner core'],
    answer: 1,
    explanation: 'The mantle is about 2,900 km thick and makes up roughly 84% of Earth’s volume. The crust is less than 1%.',
    difficulty: 'Basic',
  },
  {
    question: 'The inner core is hotter than the outer core. Why is it solid?',
    options: [
      'It is made of rock instead of metal',
      'The enormous pressure at the centre keeps the iron solid despite the heat',
      'It is cooled by the mantle',
      'It is actually liquid',
    ],
    answer: 1,
    explanation:
      'Pressure raises the melting point of iron. At the centre, pressure is about 3.6 million times atmospheric pressure, enough to keep iron solid at over 5,000 °C.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How do scientists know about Earth’s interior when no one has drilled deeper than about 12 km?',
    options: [
      'From photos taken by satellites',
      'By studying how seismic waves from earthquakes bend, speed up, slow down or are blocked',
      'From rocks brought up by volcanoes only',
      'By guessing',
    ],
    answer: 1,
    explanation:
      'Seismic waves change speed and direction at layer boundaries. S-waves cannot travel through liquids, and their “shadow zone” on the far side of Earth revealed that the outer core is liquid.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does density jump so sharply at about 2,900 km depth?',
    options: [
      'The temperature suddenly drops',
      'It is the boundary between the rocky mantle and the iron-rich core',
      'The crust starts again',
      'Water is trapped there',
    ],
    answer: 1,
    explanation:
      'At the core–mantle boundary, silicate rock (about 5.6 g/cm³) gives way to liquid iron alloy (about 9.9 g/cm³). Heavy elements like iron sank to the centre early in Earth’s history.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which part of Earth makes up the tectonic plates?',
    options: [
      'The crust alone',
      'The lithosphere — the crust plus the rigid top of the upper mantle',
      'The outer core',
      'The lower mantle',
    ],
    answer: 1,
    explanation:
      'Plates are pieces of the lithosphere, typically about 100 km thick. They slide over the weaker, slowly flowing asthenosphere in the upper mantle.',
    difficulty: 'Advanced',
  },
];
