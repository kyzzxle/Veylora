import type { QuizQuestion } from '../quiz-types';

export const biodiversityQuiz: QuizQuestion[] = [
  {
    question: 'What does biodiversity mean?',
    options: ['The number of animals in a zoo', 'The variety of life: genes, species and ecosystems', 'The size of a forest', 'The number of plants in a field'],
    answer: 1,
    explanation: 'Biodiversity includes genetic diversity within species, the variety of species, and the variety of ecosystems.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, why does the monoculture (plot A) collapse during the ryegrass disease, while plot C barely changes?',
    options: [
      'Plot C has bigger plants',
      'In plot C, other species are not affected by the disease and quickly fill the space',
      'Plot C is watered more',
      'The disease cannot reach plot C',
    ],
    answer: 1,
    explanation: 'When one species is hit, others take over its role. Relying on a single species puts everything at risk, as in the Irish potato famine.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the “insurance hypothesis” of biodiversity?',
    options: [
      'Diverse ecosystems are more likely to include species that can cope with any particular disturbance',
      'Rare species are protected by law',
      'Farmers insure their crops',
      'Biodiversity only matters in rainforests',
    ],
    answer: 0,
    explanation: 'Different species respond differently to droughts, heat, pests and diseases, so a mix keeps the ecosystem working whatever happens.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Ecologists talk about resistance and resilience. What is resilience?',
    options: [
      'How little an ecosystem changes during a disturbance',
      'How quickly an ecosystem recovers after a disturbance',
      'How many species it has',
      'How old it is',
    ],
    answer: 1,
    explanation: 'Resistance is how much it changes during the disturbance; resilience is how fast it bounces back. Compare the lowest points and recovery times in the graph.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Long-term grassland experiments found that plots with more species tend to be more productive. Why?',
    options: [
      'Species use space, light, water and nutrients in different ways, so together they use resources more fully',
      'More species means more fertiliser',
      'Diverse plots get more rain',
      'Weeds grow faster',
    ],
    answer: 0,
    explanation: 'This is complementarity: deep and shallow roots, early and late growth, and nitrogen-fixing legumes such as clover all add to total growth.',
    difficulty: 'Advanced',
  },
  {
    question: 'What is a keystone species?',
    options: [
      'The most common species',
      'A species with a much larger effect on its ecosystem than its numbers suggest',
      'Any endangered species',
      'A species found on rocks',
    ],
    answer: 1,
    explanation: 'Examples include sea otters, which eat sea urchins and protect kelp forests, and beavers, whose dams create wetlands.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which is currently the biggest cause of biodiversity loss worldwide?',
    options: ['Volcanic eruptions', 'Habitat loss and land-use change', 'Meteorite impacts', 'Too many zoos'],
    answer: 1,
    explanation: 'Clearing land for farming and building is the leading cause, followed by overexploitation, climate change, pollution and invasive species.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, why does adding species beyond about four or five give smaller extra benefits during a drought?',
    options: [
      'Extra species are weaker',
      'Once at least one drought-tolerant species is present, more species add less extra insurance for that particular threat',
      'The plot runs out of room',
      'Droughts affect all species equally',
    ],
    answer: 1,
    explanation: 'But many different threats occur over time, so higher diversity keeps paying off across droughts, heat, pests and diseases.',
    difficulty: 'Advanced',
  },
];
