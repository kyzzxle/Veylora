import type { QuizQuestion } from '../quiz-types';

export const plantAdaptationsQuiz: QuizQuestion[] = [
  {
    question: 'What is a xerophyte?',
    options: ['A plant adapted to salty soil', 'A plant adapted to very dry conditions', 'A plant that lives in water', 'A plant that catches insects'],
    answer: 1,
    explanation: 'Xerophytes, such as cacti, are adapted to dry places. Hydrophytes live in water, halophytes tolerate salt, and carnivorous plants catch prey.',
    difficulty: 'Basic',
  },
  {
    question: 'Why are a cactus’s leaves reduced to spines?',
    options: [
      'To store water',
      'To reduce the surface area that water can evaporate from (and to deter animals)',
      'To catch insects',
      'To carry out most of the photosynthesis',
    ],
    answer: 1,
    explanation: 'With almost no leaf surface, the cactus loses very little water. Photosynthesis happens in the green stem instead.',
    difficulty: 'Basic',
  },
  {
    question: 'How does CAM photosynthesis help desert plants such as cacti?',
    options: [
      'It makes them grow faster',
      'The stomata open at night, when it is cool, so far less water is lost than if they opened in the heat of the day',
      'It lets them photosynthesise without light',
      'It stops them needing carbon dioxide',
    ],
    answer: 1,
    explanation: 'CO₂ taken in at night is stored and used for photosynthesis the next day while the stomata stay closed. This is a physiological adaptation.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why are the stomata of a water lily on the upper surface of its leaves?',
    options: [
      'The lower surface faces the water, so only the upper surface is in contact with the air for gas exchange',
      'To absorb water',
      'To reflect light',
      'There is no reason',
    ],
    answer: 0,
    explanation: 'Floating leaves can only exchange gases with the air above them. Most land plants have more stomata on the lower surface instead.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the main job of the large air spaces (aerenchyma) in water lily stems and leaf stalks?',
    options: [
      'Storing sugar',
      'Carrying oxygen down to roots in oxygen-poor mud, and helping the leaves float',
      'Making the stems stronger',
      'Absorbing nitrogen',
    ],
    answer: 1,
    explanation: 'Waterlogged mud contains very little oxygen. In the simulator, waterlogging stresses plants without this kind of adaptation, such as the cactus and sunflower.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which pair of features helps a red mangrove survive on a tidal, salty shore?',
    options: [
      'Spines and a water-storing stem',
      'Prop roots with pores for taking in air, and roots that filter out most of the salt',
      'Floating leaves and flexible stalks',
      'Trap leaves and trigger hairs',
    ],
    answer: 1,
    explanation: 'Mangroves are halophytes. Some species keep salt out at the roots; others excrete it from salt glands on their leaves.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does a Venus flytrap get the energy it needs to live?',
    options: [
      'Only by digesting insects',
      'By photosynthesis; insects mainly supply extra nitrogen and phosphorus missing from bog soil',
      'From the soil',
      'From other plants it grows on',
    ],
    answer: 1,
    explanation: 'Carnivorous plants are green and photosynthesise. Prey supplements nutrients, which is why they thrive in nutrient-poor bogs. Turn the insects off in the simulator and the flytrap becomes limited by nutrients.',
    difficulty: 'Basic',
  },
  {
    question: 'A bromeliad grows high on a rainforest tree. Which statement is correct?',
    options: [
      'It is a parasite that steals sugar from the tree',
      'It is an epiphyte: it uses the tree only for support, reaching more light, and collects water and nutrients in its leaf tank',
      'It is a halophyte',
      'It needs deep soil for its roots',
    ],
    answer: 1,
    explanation: 'Epiphytes grow on other plants without feeding on them. Absorbing scales on the leaves take up water and nutrients from the tank.',
    difficulty: 'Basic',
  },
  {
    question: 'Which of these is a physiological rather than a structural adaptation?',
    options: ['Spines on a cactus', 'Prop roots of a mangrove', 'An oak dropping its leaves in autumn when it gets cold', 'Floating leaves of a water lily'],
    answer: 2,
    explanation: 'Leaf fall is triggered by changes in the plant’s internal processes in response to cooling and shorter days. Structural adaptations are physical features such as spines, roots and leaf shape.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, a cactus and a sunflower are grown in the same desert. Why does the sunflower fail?',
    options: [
      'Deserts have no light',
      'It loses far more water than its roots can supply and cannot store water, so its water balance becomes the limiting factor',
      'It is too salty',
      'The cactus takes all its water',
    ],
    answer: 1,
    explanation: 'The sunflower is a mesophyte with large leaves and many open stomata. Adaptations suit a plant to particular conditions; they are not better or worse in general. In wet, fertile soil the sunflower grows far faster than a cactus.',
    difficulty: 'Basic',
  },
];
