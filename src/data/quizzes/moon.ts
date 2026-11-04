import type { QuizQuestion } from '../quiz-types';

export const moonQuiz: QuizQuestion[] = [
  {
    question: 'What causes the phases of the Moon?',
    options: [
      'Earth’s shadow falling on different parts of the Moon',
      'Clouds on the Moon',
      'Seeing different amounts of the Moon’s sunlit half as it orbits Earth',
      'The Moon producing more or less of its own light',
    ],
    answer: 2,
    explanation:
      'The Sun always lights half of the Moon. As the Moon orbits, we look at that lit half from different angles, so we see more or less of it. Earth’s shadow only matters during a lunar eclipse.',
    difficulty: 'Basic',
  },
  {
    question: 'During a new moon, where is the Moon?',
    options: ['On the far side of Earth from the Sun', 'Roughly between Earth and the Sun', 'At a right angle to the Sun', 'Inside Earth’s shadow'],
    answer: 1,
    explanation: 'At new moon the Moon is on the Sun’s side of Earth, so its lit half faces away from us. It is also lost in the Sun’s glare.',
    difficulty: 'Basic',
  },
  {
    question: 'About how long does it take to go from one full moon to the next?',
    options: ['7 days', '24 hours', 'About 29.5 days', '365 days'],
    answer: 2,
    explanation: 'The synodic month — the full cycle of phases — lasts about 29.5 days. That is why calendar months are roughly 30 days long.',
    difficulty: 'Basic',
  },
  {
    question: 'In the Northern Hemisphere, a waxing crescent moon is lit on which side?',
    options: ['The left', 'The right', 'The top', 'Both sides equally'],
    answer: 1,
    explanation: 'Waxing phases are lit on the right as seen from the Northern Hemisphere. Switch the simulator to the Southern Hemisphere to see the view flip.',
    difficulty: 'Intermediate',
  },
  {
    question: 'At what time of day does a full moon rise?',
    options: ['Around sunrise', 'Around noon', 'Around sunset', 'Around midnight'],
    answer: 2,
    explanation: 'A full moon is opposite the Sun in the sky, so it rises as the Sun sets and sets as the Sun rises — it is visible all night.',
    difficulty: 'Intermediate',
  },
  {
    question: 'At first quarter, roughly how much of the Moon’s whole surface is lit by the Sun?',
    options: ['One quarter', 'One half', 'All of it', 'None of it'],
    answer: 1,
    explanation:
      'The Sun always lights half of the Moon’s surface. “First quarter” refers to the Moon being a quarter of the way through its orbit — from Earth we see half of the disc lit.',
    difficulty: 'Advanced',
  },
  {
    question: 'If the full moon is behind Earth every month, why isn’t there a lunar eclipse every month?',
    options: [
      'The Moon is too far away',
      'The Moon’s orbit is tilted by about 5°, so it usually passes above or below Earth’s shadow',
      'The Sun is too bright',
      'Eclipses only happen in winter',
    ],
    answer: 1,
    explanation:
      'The Moon’s orbit is tilted about 5° relative to Earth’s orbit. Most months the full moon passes just above or below Earth’s shadow. An eclipse only happens when a full moon occurs near one of the two points where the orbits cross.',
    difficulty: 'Advanced',
  },
];
