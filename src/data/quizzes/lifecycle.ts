import type { QuizQuestion } from '../quiz-types';

export const lifeCycleQuiz: QuizQuestion[] = [
  {
    question: 'What are the four stages of complete metamorphosis, in order?',
    options: ['Egg → nymph → pupa → adult', 'Egg → larva → pupa → adult', 'Egg → larva → nymph → adult', 'Larva → egg → pupa → adult'],
    answer: 1,
    explanation: 'Butterflies, beetles, flies and bees have complete metamorphosis. The larva (for a butterfly, a caterpillar) is rebuilt into the adult during the pupa stage.',
    difficulty: 'Basic',
  },
  {
    question: 'How does incomplete metamorphosis, as in a grasshopper, differ from complete metamorphosis?',
    options: [
      'It has an extra pupa stage',
      'There is no pupa: nymphs look like small, wingless adults and change gradually with each moult',
      'The young are born live',
      'Grasshoppers do not moult',
    ],
    answer: 1,
    explanation: 'Grasshopper nymphs eat the same food as adults and grow wing buds that get bigger with each moult, until the final moult gives fully winged adults.',
    difficulty: 'Basic',
  },
  {
    question: 'What happens inside a butterfly’s chrysalis (pupa)?',
    options: [
      'The caterpillar rests and does not change',
      'Much of the caterpillar’s body is broken down and rebuilt into wings, legs and adult organs from groups of cells called imaginal discs',
      'The butterfly lays eggs',
      'The caterpillar keeps eating',
    ],
    answer: 1,
    explanation: 'The pupa looks still, but it is the stage of the most dramatic change.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why must insects such as caterpillars moult as they grow?',
    options: [
      'To get rid of parasites',
      'Their hard outer skeleton (exoskeleton) cannot stretch, so they shed it and grow a larger one',
      'To change colour',
      'To breathe',
    ],
    answer: 1,
    explanation: 'A monarch caterpillar moults five times, and each stage between moults is called an instar.',
    difficulty: 'Basic',
  },
  {
    question: 'During a frog’s metamorphosis, which change is correct?',
    options: [
      'The froglet grows a tail',
      'Gills are replaced by lungs, legs grow and the tail is absorbed, as the tadpole changes from a water-living plant-eater to a land-hunting adult',
      'The adult returns to being a tadpole',
      'The tadpole breathes air from the start',
    ],
    answer: 1,
    explanation: 'The changes are triggered by thyroid hormones. Back legs appear first, then front legs, then the tail is absorbed.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do frogs lay thousands of eggs while a wild hen lays only a handful?',
    options: [
      'Frog eggs are bigger',
      'Most frog eggs and tadpoles are eaten or die, while chicks receive protection and care from the parent; animals that care for their young usually produce fewer offspring',
      'Chickens cannot make more eggs',
      'Frogs live longer',
    ],
    answer: 1,
    explanation: 'In the survival chart, about 5 of 1,000 frog eggs become adults. For a population to stay the same size, each pair needs only about two offspring to survive and breed.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A fertilised egg (zygote) of a chicken has 78 chromosomes. How many chromosomes does each sperm and each egg cell carry?',
    options: ['78', '156', '39', '18'],
    answer: 2,
    explanation: 'Eggs and sperm are made by meiosis and carry one set of chromosomes (39). Fertilisation joins two sets to give 78 again.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the sexual vs asexual model, why does the asexual population grow faster at first?',
    options: [
      'Clones live longer',
      'Every asexual individual is a female that can produce young, while half of a sexual population are males that do not give birth',
      'Sexual animals are smaller',
      'The model is biased',
    ],
    answer: 1,
    explanation: 'This is the “twofold cost of sex”. With the same number of young per female, an all-female clone population grows faster.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the model, a disease that targets the most common type kills almost all the clones but only some of the sexual population. Why?',
    options: [
      'Sexual animals are stronger',
      'Sexual reproduction mixes genes and produces varied offspring, so a disease adapted to one type cannot kill them all; clones share the same weaknesses',
      'The disease only affects females',
      'Clones are always weaker',
    ],
    answer: 1,
    explanation: 'Genetic variation helps populations survive diseases and changing conditions. This is one leading explanation for why sexual reproduction is so common despite its cost.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which example is correctly matched?',
    options: [
      'Chicken: viviparous (live birth with a placenta)',
      'Some sharks and garter snakes: ovoviviparous (eggs hatch inside the mother, young born live, fed mainly by yolk)',
      'Human: oviparous (egg-laying)',
      'Platypus: viviparous',
    ],
    answer: 1,
    explanation: 'Chickens are oviparous, humans viviparous, and the platypus is one of the few egg-laying (oviparous) mammals.',
    difficulty: 'Intermediate',
  },
];
