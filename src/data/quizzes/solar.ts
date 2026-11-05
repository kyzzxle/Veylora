import type { QuizQuestion } from '../quiz-types';

export const solarQuiz: QuizQuestion[] = [
  {
    question: 'Which planet is closest to the Sun?',
    options: ['Venus', 'Earth', 'Mercury', 'Mars'],
    answer: 2,
    explanation: 'Mercury orbits at about 0.39 AU, roughly 58 million km from the Sun.',
    difficulty: 'Basic',
  },
  {
    question: 'Which is the largest planet in the solar system?',
    options: ['Saturn', 'Jupiter', 'Neptune', 'Earth'],
    answer: 1,
    explanation: 'Jupiter is about 11 times wider than Earth and more than twice as massive as all the other planets put together.',
    difficulty: 'Basic',
  },
  {
    question: 'What is an astronomical unit (AU)?',
    options: ['The distance light travels in a year', 'The average distance from Earth to the Sun, about 150 million km', 'The diameter of the Sun', 'The distance to Neptune'],
    answer: 1,
    explanation: '1 AU ≈ 149.6 million km. It is a handy unit for distances within the solar system.',
    difficulty: 'Basic',
  },
  {
    question: 'Run the simulation. Why do the outer planets move round their orbits so much more slowly than the inner ones?',
    options: [
      'They are heavier',
      'They are further from the Sun, so they have a longer path to travel and move more slowly because the Sun’s gravity is weaker there',
      'They spin faster',
      'They have more moons',
    ],
    answer: 1,
    explanation: 'Kepler’s third law: the square of the orbital period is proportional to the cube of the distance. Neptune takes about 165 years to orbit once.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Venus is further from the Sun than Mercury, yet it is hotter. Why?',
    options: ['It is bigger', 'Its thick carbon dioxide atmosphere traps heat (a runaway greenhouse effect)', 'It has volcanoes on its surface', 'It spins faster'],
    answer: 1,
    explanation: 'Venus’s atmosphere is about 96 % CO₂ and 90 times denser than Earth’s, keeping the surface at about 464 °C day and night.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Switch to “True scale”. Why are the planets so hard to see?',
    options: [
      'The simulation hides them',
      'The distances between planets are enormous compared with the sizes of the planets',
      'They are too dark',
      'They move too fast',
    ],
    answer: 1,
    explanation: 'If the Sun were a football, Earth would be a peppercorn about 24 m away and Neptune about 700 m away. The solar system is mostly empty space.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which group of planets are the gas and ice giants?',
    options: ['Mercury, Venus, Earth, Mars', 'Jupiter, Saturn, Uranus, Neptune', 'Earth, Mars, Jupiter, Saturn', 'Venus, Uranus, Neptune, Mercury'],
    answer: 1,
    explanation: 'The four inner planets are small and rocky; the four outer planets are large, made mostly of hydrogen, helium and ices, and all have rings.',
    difficulty: 'Basic',
  },
  {
    question: 'Light takes about 8.3 minutes to reach Earth from the Sun. About how long does it take to reach Neptune, 30 AU away?',
    options: ['About 8 minutes', 'About 1 hour', 'About 4 hours', 'About 30 days'],
    answer: 2,
    explanation: '30 × 8.3 minutes ≈ 250 minutes, a little over 4 hours. Select Neptune and check the distance readout.',
    difficulty: 'Advanced',
  },
];
