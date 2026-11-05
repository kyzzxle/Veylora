import type { QuizQuestion } from '../quiz-types';

export const ecosystemQuiz: QuizQuestion[] = [
  {
    question: 'What is the original source of energy for almost every ecosystem?',
    options: ['The soil', 'The Sun', 'Decomposers', 'Water'],
    answer: 1,
    explanation: 'Producers capture light energy by photosynthesis and store it in organic compounds. Every consumer depends, directly or indirectly, on that captured energy.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the role of decomposers such as fungi and bacteria?',
    options: [
      'They make food from sunlight',
      'They break down dead matter and waste, returning nutrients to the soil',
      'They are top predators',
      'They create energy from nothing',
    ],
    answer: 1,
    explanation: 'Without decomposers, nutrients stay locked in dead matter. In the simulator, removing decomposers makes dead matter pile up and soil nutrients run out.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does energy decrease at each step up a food chain?',
    options: [
      'Animals destroy energy when they eat',
      'Most energy is used for life processes and lost as heat, and some food is not eaten or digested',
      'Energy turns into nutrients',
      'Plants keep all the energy',
    ],
    answer: 1,
    explanation: 'Energy cannot be destroyed, but most of it leaves the food chain as heat from respiration, or stays in uneaten parts and waste that go to decomposers.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the main difference between energy flow and nutrient cycling?',
    options: [
      'Energy flows one way and is lost as heat, while nutrients are recycled again and again',
      'Nutrients flow one way and energy is recycled',
      'Both are recycled',
      'Both flow one way only',
    ],
    answer: 0,
    explanation: 'Ecosystems need a constant input of sunlight, but the same carbon and nitrogen atoms can be reused for millions of years.',
    difficulty: 'Intermediate',
  },
  {
    question: 'About how much of the energy at one trophic level usually ends up in the next?',
    options: ['Exactly 10% in every ecosystem', 'Often about 5–20%, varying between ecosystems and organisms', 'About 90%', '100%'],
    answer: 1,
    explanation: 'The “10% rule” is a useful rough guide, not a law of nature. Efficiencies differ: for example, cold-blooded animals often pass on more than warm-blooded ones, which spend a lot of energy keeping warm.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which process removes carbon dioxide from the air?',
    options: ['Respiration', 'Decomposition', 'Photosynthesis', 'Burning fossil fuels'],
    answer: 2,
    explanation: 'Photosynthesis builds carbon dioxide into sugars. Respiration by plants, animals and decomposers, and burning, return it to the air.',
    difficulty: 'Basic',
  },
  {
    question: 'How do plants obtain the nitrogen they need to make proteins?',
    options: [
      'By absorbing nitrogen gas through their leaves',
      'Mostly by absorbing nitrates (and ammonium) from the soil through their roots',
      'By eating animals',
      'From sunlight',
    ],
    answer: 1,
    explanation: 'Nitrogen gas must first be fixed by bacteria (or lightning). Decomposers and nitrifying bacteria then produce ammonium and nitrates that roots can absorb.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, foxes are removed. Which chain of effects is most likely?',
    options: [
      'Rabbits increase, then plants decrease',
      'Rabbits decrease and plants decrease',
      'Nothing changes',
      'Frogs disappear immediately',
    ],
    answer: 0,
    explanation: 'With no predators, rabbits increase until food becomes limiting, so plants decline. Changes at one level spread through the food web.',
    difficulty: 'Advanced',
  },
];
