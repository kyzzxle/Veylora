import type { QuizQuestion } from '../quiz-types';

export const transpirationQuiz: QuizQuestion[] = [
  {
    question: 'What is transpiration?',
    options: [
      'The movement of sugar from leaves to roots',
      'The loss of water vapour from a plant, mainly through its leaves',
      'The process plants use to make food',
      'Water entering roots from the soil',
    ],
    answer: 1,
    explanation: 'Transpiration is the evaporation of water from inside the leaves and its diffusion out through the stomata. It pulls more water up from the roots.',
    difficulty: 'Basic',
  },
  {
    question: 'Through which structures does most water vapour leave a leaf?',
    options: ['Root hairs', 'Stomata', 'Xylem vessels', 'Chloroplasts'],
    answer: 1,
    explanation: 'Stomata are tiny pores, mostly on the underside of leaves, controlled by pairs of guard cells. A thin waxy cuticle lets only a little water escape elsewhere.',
    difficulty: 'Basic',
  },
  {
    question: 'How does increasing humidity affect the rate of transpiration?',
    options: ['It increases the rate', 'It decreases the rate', 'It has no effect', 'It stops photosynthesis'],
    answer: 1,
    explanation: 'Moist air already holds a lot of water vapour, so the gradient between the inside of the leaf and the air is smaller. Water vapour diffuses out more slowly.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does wind usually increase transpiration?',
    options: [
      'It pushes water into the leaves',
      'It blows away the humid layer of air next to the leaf, keeping the diffusion gradient steep',
      'It cools the leaf so water evaporates faster',
      'It opens the stomata wider',
    ],
    answer: 1,
    explanation: 'Still air forms a thin, humid boundary layer around the leaf. Wind replaces it with drier air, so water vapour diffuses away faster.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the petroleum-jelly experiment, coating which surface reduces water loss the most?',
    options: ['The upper surface', 'The lower surface', 'Both make the same difference', 'Neither has any effect'],
    answer: 1,
    explanation: 'In most broad-leaved plants, many more stomata are on the lower surface, which is shaded and cooler. Blocking it cuts transpiration far more than coating the upper surface.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does transpiration slow down dramatically in the dark?',
    options: [
      'Water stops evaporating in the dark',
      'Guard cells close the stomata when there is no light for photosynthesis',
      'Xylem vessels close at night',
      'Roots stop absorbing water forever',
    ],
    answer: 1,
    explanation:
      'Stomata open mainly to let in carbon dioxide for photosynthesis. With no light, there is no need, so most plants close them and save water.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In very hot, dry conditions, the rate may not keep rising — or may even fall. Why?',
    options: [
      'The potometer breaks',
      'The plant partly closes its stomata to avoid losing too much water and wilting',
      'Water cannot evaporate above 30 °C',
      'Light is too bright',
    ],
    answer: 1,
    explanation:
      'When the air is very dry and the plant cannot replace water fast enough, guard cells lose turgor and stomata close. This protects the plant but also reduces photosynthesis — a trade-off.',
    difficulty: 'Advanced',
  },
];
