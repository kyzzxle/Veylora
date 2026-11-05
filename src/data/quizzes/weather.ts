import type { QuizQuestion } from '../quiz-types';

export const weatherQuiz: QuizQuestion[] = [
  {
    question: 'What is the dew point?',
    options: [
      'The temperature at which water boils',
      'The temperature to which air must cool for its water vapour to condense',
      'The amount of rain in a day',
      'The highest temperature of the day',
    ],
    answer: 1,
    explanation: 'When air cools to its dew point it becomes saturated and water vapour starts condensing into droplets: dew, fog or cloud.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does air cool as it rises?',
    options: [
      'It gets further from the Sun',
      'Air pressure is lower higher up, so the rising air expands, and expanding air cools',
      'It mixes with ice',
      'Clouds block sunlight',
    ],
    answer: 1,
    explanation: 'Rising air expands as the pressure around it falls. Expansion uses energy, so the air cools by about 10 °C per kilometre while it stays dry.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What kind of weather does a high-pressure system usually bring?',
    options: ['Storms and heavy rain', 'Settled, often clear weather', 'Tornadoes', 'Hurricanes'],
    answer: 1,
    explanation: 'In a high, air sinks and warms, which stops clouds growing. Expect clear skies, light winds, and sometimes fog or frost at night.',
    difficulty: 'Basic',
  },
  {
    question: 'The ground is 25 °C and the dew point is 17 °C. Roughly how high is the cloud base?',
    options: ['About 100 m', 'About 1,000 m', 'About 3,000 m', 'About 8,000 m'],
    answer: 1,
    explanation: 'Cloud base ≈ 125 m × (temperature − dew point) = 125 × 8 = 1,000 m.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does air inside a cloud cool more slowly as it rises than clear air does?',
    options: [
      'Clouds are made of warm water',
      'Condensing water vapour releases latent heat, partly offsetting the cooling',
      'Clouds absorb sunlight',
      'Air inside clouds does not expand',
    ],
    answer: 1,
    explanation: 'Each gram of vapour that condenses releases about 2,500 J. This extra heat can keep cloudy air warmer than its surroundings, so it keeps rising, building tall storm clouds.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the simulator, what happens to the cloud base if you increase the humidity while keeping the temperature the same?',
    options: ['It rises', 'It gets lower', 'It does not change', 'The cloud disappears'],
    answer: 1,
    explanation: 'Higher humidity means a higher dew point, closer to the air temperature, so the rising air reaches saturation sooner: a lower cloud base.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which cloud is associated with thunderstorms?',
    options: ['Cirrus', 'Stratus', 'Cumulonimbus', 'Fair-weather cumulus'],
    answer: 2,
    explanation: 'Cumulonimbus clouds can tower to 10–15 km, often spreading into an anvil shape at the top of the troposphere.',
    difficulty: 'Basic',
  },
  {
    question: 'What is fog?',
    options: ['Smoke from fires', 'A cloud at ground level, formed when air near the surface cools to its dew point', 'Rain that evaporates', 'Very fine snow'],
    answer: 1,
    explanation: 'On clear, calm nights the ground cools quickly; if the air near it reaches its dew point, fog forms.',
    difficulty: 'Basic',
  },
];
