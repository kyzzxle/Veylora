import type { QuizQuestion } from '../quiz-types';

export const starsQuiz: QuizQuestion[] = [
  {
    question: 'What powers a star during its main-sequence life?',
    options: ['Burning coal', 'Nuclear fusion of hydrogen into helium in its core', 'Gravity alone', 'Chemical reactions with oxygen'],
    answer: 1,
    explanation: 'In the core, hydrogen nuclei fuse into helium, converting a little mass into a lot of energy (E = mc²).',
    difficulty: 'Basic',
  },
  {
    question: 'What single property decides how a star lives and dies?',
    options: ['Its colour', 'Its starting mass', 'Its distance from Earth', 'Its age'],
    answer: 1,
    explanation: 'Mass sets the core temperature and pressure, and so the fusion rate, lifetime and final fate.',
    difficulty: 'Basic',
  },
  {
    question: 'What will the Sun become at the very end of its life?',
    options: ['A black hole', 'A neutron star', 'A white dwarf', 'A supernova'],
    answer: 2,
    explanation: 'The Sun will become a red giant, shed its outer layers as a planetary nebula and leave behind a white dwarf.',
    difficulty: 'Basic',
  },
  {
    question: 'Compare a 1-solar-mass star with a 12-solar-mass star. Which lives longer, and why?',
    options: [
      'The 12-solar-mass star, because it has more fuel',
      'The 1-solar-mass star, because massive stars burn their fuel far faster than the extra fuel makes up for',
      'They live the same time',
      'The 12-solar-mass star, because it is hotter',
    ],
    answer: 1,
    explanation: 'Luminosity rises roughly as M³·⁵ while fuel rises only as M, so lifetime falls roughly as M⁻²·⁵: about 10 billion years for the Sun versus about 20 million for 12 Suns.',
    difficulty: 'Intermediate',
  },
  {
    question: 'On a Hertzsprung–Russell diagram, where are red giants found?',
    options: ['Bottom left: hot and dim', 'Top right: cool but very bright', 'Bottom right: cool and dim', 'Top left: hot and bright'],
    answer: 1,
    explanation: 'Red giants are cool (red) but enormous, so they give out a lot of light in total. They sit above the main sequence on the right.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does a massive star’s core collapse when it becomes iron?',
    options: [
      'Iron is radioactive',
      'Fusing iron absorbs energy instead of releasing it, so nothing holds the core up against gravity',
      'Iron is too light',
      'The star runs out of oxygen',
    ],
    answer: 1,
    explanation: 'Fusion up to iron releases energy. With an iron core, the outward pressure fails and the core collapses in under a second, triggering a supernova.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why has no red dwarf star ever died?',
    options: [
      'They are too far away to see',
      'Their main-sequence lifetimes are far longer than the current age of the universe',
      'They do not use fuel',
      'They turn into planets',
    ],
    answer: 1,
    explanation: 'A red dwarf burns hydrogen so slowly that it can shine for hundreds of billions to trillions of years; the universe is only 13.8 billion years old.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where did most of the elements heavier than iron, such as gold, come from?',
    options: ['The Big Bang', 'Main-sequence fusion in the Sun', 'Supernovae and collisions of neutron stars', 'Planets'],
    answer: 2,
    explanation: 'Heavy elements are built by rapid neutron capture in extreme events such as supernovae and neutron-star mergers, then scattered into space.',
    difficulty: 'Advanced',
  },
];
