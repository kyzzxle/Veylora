import type { QuizQuestion } from '../quiz-types';

export const waterCycleQuiz: QuizQuestion[] = [
  {
    question: 'What provides the energy that drives the water cycle?',
    options: ['The Moon', 'The Sun', 'Earth’s core', 'Wind turbines'],
    answer: 1,
    explanation: 'Sunlight heats water so it evaporates, and drives the winds that carry water vapour around the world. Gravity brings it back down.',
    difficulty: 'Basic',
  },
  {
    question: 'What is condensation?',
    options: ['Water turning into ice', 'Water vapour cooling and turning into liquid droplets', 'Rain soaking into the ground', 'Ice turning straight into vapour'],
    answer: 1,
    explanation: 'As water vapour rises it cools; at its dew point it condenses into the tiny droplets that make up clouds.',
    difficulty: 'Basic',
  },
  {
    question: 'What is transpiration?',
    options: [
      'Water flowing over the ground',
      'Water vapour released from plant leaves',
      'Water moving underground',
      'Snow melting',
    ],
    answer: 1,
    explanation: 'Plants draw water from the soil and release it as vapour through tiny pores in their leaves (stomata).',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, switch the ground cover from forest to city. What happens?',
    options: [
      'More rain soaks into the ground',
      'Much less water infiltrates and more runs off quickly into rivers',
      'Evaporation from the ocean stops',
      'It rains less',
    ],
    answer: 1,
    explanation: 'Roads and roofs are impermeable, so rainwater rushes into drains and rivers instead of soaking in. This is why cities are prone to flash floods.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does it often rain more on the side of a mountain facing the sea?',
    options: [
      'Mountains attract clouds magnetically',
      'Moist air is forced to rise over the mountain, cools and condenses, producing rain',
      'The sea is warmer there',
      'Mountains create wind',
    ],
    answer: 1,
    explanation: 'This is relief (orographic) rainfall. The air that descends on the far side is drier, creating a “rain shadow”.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where is most of Earth’s water stored?',
    options: ['In rivers and lakes', 'In the atmosphere', 'In the oceans', 'Underground'],
    answer: 2,
    explanation: 'About 97 % of Earth’s water is salty ocean water. Most fresh water is locked in ice caps and glaciers or underground.',
    difficulty: 'Basic',
  },
  {
    question: 'The total number of drops in the simulator never changes. What principle does this show?',
    options: [
      'Water is created by clouds',
      'Water is conserved: it changes state and place but is not created or destroyed',
      'Water disappears when it evaporates',
      'The ocean makes new water',
    ],
    answer: 1,
    explanation: 'The water you drink today has been cycling for billions of years, through oceans, clouds, rivers, plants and animals.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A water molecule stays in the atmosphere for about how long, on average?',
    options: ['About 9 days', 'About 1 year', 'About 100 years', 'About 3,000 years'],
    answer: 0,
    explanation: 'Water vapour cycles quickly: around 9 days in the air. By contrast, it can stay in the deep ocean for thousands of years, and in some groundwater for over 10,000 years.',
    difficulty: 'Advanced',
  },
];
