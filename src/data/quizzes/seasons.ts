import type { QuizQuestion } from '../quiz-types';

export const seasonsQuiz: QuizQuestion[] = [
  {
    question: 'What is the main cause of Earth’s seasons?',
    options: [
      'Earth’s changing distance from the Sun',
      'The tilt of Earth’s axis, which changes the angle of sunlight and the length of the day through the year',
      'The Sun getting hotter and cooler',
      'The Moon blocking sunlight',
    ],
    answer: 1,
    explanation: 'Earth’s axis is tilted 23.4°. As Earth orbits, each hemisphere spends half the year tilted towards the Sun (higher Sun, longer days) and half tilted away.',
    difficulty: 'Basic',
  },
  {
    question: 'When it is summer in the Northern Hemisphere, what season is it in the Southern Hemisphere?',
    options: ['Summer', 'Spring', 'Winter', 'Autumn'],
    answer: 2,
    explanation: 'When the north is tilted towards the Sun, the south is tilted away. Compare the two sunlight panels in the simulator in June and December.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, Earth is closest to the Sun in early January. What does this show?',
    options: [
      'Distance is the main cause of the seasons',
      'Distance is not the main cause: the north has winter while Earth is at its closest',
      'January is summer everywhere',
      'Earth’s orbit is a long, thin ellipse',
    ],
    answer: 1,
    explanation: 'Earth is only about 3% closer to the Sun in January than in July. If distance caused the seasons, both hemispheres would have summer at the same time.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does sunlight heat the ground more when the Sun is high in the sky?',
    options: [
      'The Sun is closer at noon',
      'The same beam of light is concentrated on a smaller area, so each square metre receives more energy',
      'High sunlight is a different colour',
      'The atmosphere is thinner at noon',
    ],
    answer: 1,
    explanation: 'A low Sun spreads the same beam over a larger patch of ground (the orange patch in the simulator). Low sunlight also passes through more atmosphere.',
    difficulty: 'Basic',
  },
  {
    question: 'On the June solstice, which statement is true?',
    options: [
      'Day and night are 12 hours everywhere',
      'The Sun is overhead at noon on the Tropic of Cancer (23.4°N), and the Northern Hemisphere has its longest day',
      'The Sun is overhead at the equator',
      'The South Pole has 24 hours of daylight',
    ],
    answer: 1,
    explanation: 'The latitude where the noon Sun is overhead moves between 23.4°N and 23.4°S through the year. In June the North Pole is tilted towards the Sun, so the Arctic has midnight sun and the Antarctic has polar night.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is special about the equinoxes (around 20 March and 22 September)?',
    options: [
      'Earth is closest to the Sun',
      'Neither hemisphere is tilted towards the Sun, so day and night are about 12 hours everywhere',
      'The Sun does not rise at the poles',
      'They are the hottest days of the year',
    ],
    answer: 1,
    explanation: 'At an equinox the Sun is overhead at the equator. The word means “equal night”. (Real days are a few minutes longer than 12 hours because of atmospheric refraction and the size of the Sun’s disc.)',
    difficulty: 'Basic',
  },
  {
    question: 'Set the tilt to 0° in the simulator. What happens?',
    options: [
      'Seasons become more extreme',
      'There are no seasons: the noon Sun height and day length stay the same all year at every latitude',
      'Only the Southern Hemisphere has seasons',
      'Earth stops orbiting',
    ],
    answer: 1,
    explanation: 'Without a tilt, every place would get the same sunlight every day of the year, apart from the tiny effect of Earth’s changing distance.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does the length of the day change through the year more at high latitudes than near the equator?',
    options: [
      'High latitudes spin faster',
      'With the axis tilted, high-latitude circles are mostly in daylight or mostly in darkness, while the equator is always cut in half by the day–night line',
      'There are more clouds near the equator',
      'The Sun is farther from the poles',
    ],
    answer: 1,
    explanation: 'In the side-on view, the yellow part of each latitude line is daytime. The equator’s line is always split in half (12 hours), but lines near the poles can be entirely in light or dark.',
    difficulty: 'Advanced',
  },
  {
    question: 'The longest day in the north is around 21 June, yet the warmest weather usually comes in July or August. Why?',
    options: [
      'Earth is closest to the Sun in August',
      'Oceans and land take weeks to warm up, so temperatures keep rising while incoming sunlight is still greater than the heat lost',
      'The Sun is hotter in August',
      'Clouds disappear in August',
    ],
    answer: 1,
    explanation: 'This seasonal lag happens because water and land store heat. The simulator shows sunlight at the top of the atmosphere, not air temperature.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the simulator, the noon Sun height at latitude 50°N on the June solstice is about 63°. Which formula gives this?',
    options: [
      'Height = 90° − |latitude − Sun’s overhead latitude| = 90° − |50° − 23.4°|',
      'Height = latitude + 23.4°',
      'Height = 90° − latitude',
      'Height = 23.4° × 2',
    ],
    answer: 0,
    explanation: '90° − (50° − 23.4°) = 63.4°. At 50°S on the same day it is 90° − (50° + 23.4°) = 16.6°.',
    difficulty: 'Advanced',
  },
];
