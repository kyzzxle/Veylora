import type { QuizQuestion } from '../quiz-types';

export const expansionQuiz: QuizQuestion[] = [
  {
    question: 'What does “redshift” mean for light from a distant galaxy?',
    options: [
      'The galaxy is made of red stars',
      'The light’s wavelengths have been stretched, shifting features in its spectrum towards longer (redder) wavelengths',
      'The light has lost its colour',
      'The galaxy is very hot',
    ],
    answer: 1,
    explanation: 'Redshift z compares observed and emitted wavelengths: 1 + z = λ_observed ÷ λ_emitted. A hydrogen line emitted at 656 nm and seen at 1,312 nm has z = 1.',
    difficulty: 'Basic',
  },
  {
    question: 'According to the simulator, what causes cosmological redshift?',
    options: [
      'Galaxies rushing through space like exploding fragments',
      'Space itself expanding while the light travels, stretching its wavelength by the same factor as the universe grows',
      'Dust absorbing blue light',
      'Light getting tired and losing energy for no reason',
    ],
    answer: 1,
    explanation: 'If the universe doubles in size while the light is on its way, the wavelength doubles too: 1 + z = (size now) ÷ (size when the light left).',
    difficulty: 'Basic',
  },
  {
    question: 'Why does light from more distant galaxies generally have a larger redshift?',
    options: [
      'Distant galaxies are bigger',
      'Their light has travelled longer, so the universe has expanded more during the journey',
      'Distant galaxies are made of different elements',
      'Light slows down over long distances',
    ],
    answer: 1,
    explanation: 'Compare the presets: light from a galaxy now 1 billion light-years away travelled about 1 billion years and has z ≈ 0.07; light from one 21 billion light-years away travelled about 11.5 billion years and has z ≈ 3.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What does Hubble’s law (the Hubble–Lemaître law) say?',
    options: [
      'All galaxies are the same distance away',
      'Galaxies recede from us at a rate roughly proportional to their distance: v = H₀ × d',
      'Nearby galaxies recede faster than distant ones',
      'The universe is shrinking',
    ],
    answer: 1,
    explanation: 'Twice as far away means receding twice as fast. This is exactly what uniform expansion produces, and it holds as a straight line for nearby galaxies. The graph shows how it curves at large distances.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In an expanding universe, where is the centre of the expansion?',
    options: [
      'At the Milky Way',
      'There is no centre: observers in every galaxy see all other distant galaxies receding, just as we do',
      'At the Sun',
      'At the edge of the universe',
    ],
    answer: 1,
    explanation: 'Like dots on an inflating balloon’s surface, every point moves away from every other. The Big Bang was not an explosion at one place in space; it happened everywhere.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which of these does NOT get bigger as the universe expands?',
    options: [
      'The distances between distant galaxy clusters',
      'The galaxies themselves, the Solar System and atoms',
      'The wavelength of light crossing intergalactic space',
      'The spacing of the comoving grid',
    ],
    answer: 1,
    explanation: 'Gravity and other forces hold galaxies, planetary systems and atoms together, so they keep their size. In the simulator the galaxies stay the same size while the grid stretches.',
    difficulty: 'Basic',
  },
  {
    question: 'How is cosmological redshift different from the Doppler shift of a galaxy moving through space?',
    options: [
      'They are exactly the same thing',
      'A Doppler shift is fixed when the light is emitted; cosmological redshift builds up gradually during the whole journey as space stretches',
      'Doppler shifts only affect sound',
      'Cosmological redshift only happens to nearby galaxies',
    ],
    answer: 1,
    explanation: 'Switch the simulator to “Motion through space”: the wave leaves already stretched and then stays the same. In expanding space it starts unstretched and grows longer all the way.',
    difficulty: 'Advanced',
  },
  {
    question: 'A galaxy now 30 billion light-years away is receding at more than twice the speed of light. Does this break the rule that nothing can travel faster than light?',
    options: [
      'Yes, so the measurement must be wrong',
      'No: the galaxy is not moving through space faster than light; the space between us is expanding, and relativity’s speed limit applies to motion through space',
      'Yes, relativity is wrong',
      'No, because light from it never reaches us',
    ],
    answer: 1,
    explanation: 'The recession rate is H₀ × distance, which exceeds c beyond about 14 billion light-years. Locally, every galaxy moves slower than light; we can still see such galaxies because their light set out long ago.',
    difficulty: 'Advanced',
  },
  {
    question: 'The H-alpha line is emitted at 656 nm. A galaxy has z = 3. At what wavelength is the line observed, and what kind of light is that?',
    options: ['219 nm, ultraviolet', '656 nm, red', 'About 2,625 nm, infrared', '1,968 nm, visible'],
    answer: 2,
    explanation: 'λ_observed = (1 + z) × λ_emitted = 4 × 656 ≈ 2,625 nm, well into the infrared. This is why telescopes such as JWST observe the most distant galaxies in infrared light.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the simulator, the light from a galaxy with z ≈ 1 left when the universe was about half its present size. What does 1 + z = 2 tell you?',
    options: [
      'The galaxy is 2 billion light-years away',
      'The universe has doubled in size (distances between distant galaxies have doubled) since the light was emitted',
      'The light took 2 billion years to arrive',
      'The galaxy is twice as bright',
    ],
    answer: 1,
    explanation: 'Redshift measures the expansion directly: 1 + z = (size now) ÷ (size then). Converting it into a distance or a travel time needs a model of how fast the universe expanded.',
    difficulty: 'Intermediate',
  },
];
