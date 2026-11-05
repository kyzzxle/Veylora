import type { QuizQuestion } from '../quiz-types';

export const statesQuiz: QuizQuestion[] = [
  {
    question: 'In the simulator, what is the main difference between the particles of a solid and those of a liquid?',
    options: [
      'Solid particles do not move at all',
      'Solid particles vibrate about fixed places; liquid particles stay close but slide past each other',
      'Liquid particles are bigger than solid particles',
      'Liquid particles are far apart, like a gas',
    ],
    answer: 1,
    explanation: 'Particles in a solid still move: they vibrate. What they cannot do is leave their places. In a liquid they are still touching, but they can move around each other, which is why liquids flow.',
    difficulty: 'Basic',
  },
  {
    question: 'What does temperature measure in the particle model?',
    options: [
      'The size of the particles',
      'The number of particles',
      'The average kinetic (motion) energy of the particles',
      'How strongly the particles attract each other',
    ],
    answer: 2,
    explanation: 'Raising the heater setting makes the particles move faster on average. The attractions between particles stay the same; what changes is whether the particles have enough energy to overcome them.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does a gas spread out to fill its whole container?',
    options: [
      'Gas particles repel each other strongly',
      'Gas particles are moving fast enough that the attractions cannot hold them together, so they fly freely until they hit something',
      'Gas particles are lighter than air',
      'The container pulls on the particles',
    ],
    answer: 1,
    explanation: 'In a gas the particles’ kinetic energy is much larger than the energy of their attractions, so they separate and move in straight lines between collisions, spreading through all the available space.',
    difficulty: 'Basic',
  },
  {
    question: 'Which change of state is the reverse of condensation?',
    options: ['Freezing', 'Melting', 'Evaporation (or boiling)', 'Deposition'],
    answer: 2,
    explanation: 'Condensation is gas → liquid. Its reverse, liquid → gas, is called evaporation when it happens at the surface and boiling when it happens throughout the liquid.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, a liquid at about 45 units loses a few particles from its surface even though it is below the boiling point. Why?',
    options: [
      'The model is broken',
      'Particles at the same temperature have a range of speeds, and a few fast ones at the surface can escape',
      'All the particles are boiling slowly',
      'Gravity pushes them out',
    ],
    answer: 1,
    explanation: 'Temperature is an average. Some particles are much faster than average; if one of them is at the surface and moving outwards, it can break free. This is evaporation, which is why puddles dry without boiling.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When a solid is melting, where does most of the heat energy go?',
    options: [
      'Into making the particles move much faster',
      'Into overcoming the attractions that hold particles in fixed places',
      'Into making the particles bigger',
      'It is destroyed',
    ],
    answer: 1,
    explanation: 'During a change of state, much of the energy supplied goes into pulling particles away from their neighbours (shown by the “Energy used to pull apart” bar) rather than raising the temperature. For a pure substance, the temperature stays nearly constant while it melts or boils.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Dry ice (solid carbon dioxide) turns straight into a gas at room temperature and normal pressure. What is this called?',
    options: ['Evaporation', 'Condensation', 'Sublimation', 'Deposition'],
    answer: 2,
    explanation: 'Sublimation is solid → gas without becoming a liquid. Carbon dioxide’s triple point pressure is about 5 times normal air pressure, so at normal pressure liquid carbon dioxide cannot exist.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Frost forms on a cold window when water vapour in the air turns directly into ice. What is this change called?',
    options: ['Freezing', 'Deposition', 'Sublimation', 'Melting'],
    answer: 1,
    explanation: 'Deposition is gas → solid, the reverse of sublimation. Freezing is liquid → solid.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The model’s solid melts at about 35 model units and boils at about 70. What can you conclude about real substances?',
    options: [
      'All substances melt at 35 °C',
      'Nothing directly: real melting and boiling points depend on the substance (the strength of its attractions) and on the pressure',
      'Real substances do not have melting points',
      'Every substance boils at twice its melting temperature',
    ],
    answer: 1,
    explanation: 'The model’s numbers come from its own particles. Substances with strong attractions, such as iron or salt, melt at high temperatures; those with weak attractions, such as oxygen, melt far below 0 °C. Pressure also shifts boiling points.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which statement about the simplified particle model is accurate?',
    options: [
      'It shows exactly how water molecules behave',
      'It uses 100 identical round particles in two dimensions, so it shows the general behaviour of states, not the exact properties of a real substance',
      'Its particles are drawn to scale with real atoms',
      'It includes chemical reactions between particles',
    ],
    answer: 1,
    explanation: 'Real substances have trillions of particles in three dimensions, and many (like water) have shaped molecules with special interactions such as hydrogen bonds. The model keeps only the key idea: attractions competing with thermal motion.',
    difficulty: 'Advanced',
  },
];
