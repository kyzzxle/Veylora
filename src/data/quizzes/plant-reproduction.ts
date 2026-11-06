import type { QuizQuestion } from '../quiz-types';

export const plantReproductionQuiz: QuizQuestion[] = [
  {
    question: 'What is the difference between pollination and fertilisation?',
    options: [
      'They are two names for the same event',
      'Pollination is the transfer of pollen to a stigma; fertilisation is the fusion of a sperm cell with an egg cell inside the ovule',
      'Fertilisation happens first, then pollination',
      'Pollination makes the fruit and fertilisation makes the petals',
    ],
    answer: 1,
    explanation: 'Pollination only moves pollen. Fertilisation happens later, after the pollen tube has grown down the style and delivered sperm to the ovule.',
    difficulty: 'Basic',
  },
  {
    question: 'Which parts make up the stamen, the male part of a flower?',
    options: ['Stigma and style', 'Ovary and ovules', 'Sepals and petals', 'Anther and filament'],
    answer: 3,
    explanation: 'The anther makes pollen and the filament holds it up. The carpel (stigma, style and ovary) is the female part.',
    difficulty: 'Basic',
  },
  {
    question: 'Which statement about a pollen grain is correct?',
    options: [
      'It is a tiny male gametophyte that produces two sperm cells',
      'It is a single sperm cell',
      'It is a seed',
      'It is a female gamete',
    ],
    answer: 0,
    explanation: 'The grain contains a tube cell and a generative cell. The generative cell divides by mitosis into two sperm cells.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How do the sperm cells of a flowering plant reach the egg?',
    options: [
      'They swim through a film of water on the style',
      'Insects inject them into the ovary',
      'A pollen tube grows from the stigma down through the style and into the ovule, carrying them',
      'The wind blows them into the ovary',
    ],
    answer: 2,
    explanation: 'Flowering-plant sperm cannot swim. The pollen tube, guided by chemical signals from the ovule, delivers them through the micropyle.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In double fertilisation, what does the second sperm cell fuse with?',
    options: [
      'A second egg cell, making twins',
      'The central cell with its two polar nuclei, forming a triploid (3n) endosperm nucleus',
      'The pollen tube nucleus',
      'The ovary wall',
    ],
    answer: 1,
    explanation: 'One sperm + egg gives the diploid zygote. The other sperm + two polar nuclei (n + n + n) gives the 3n primary endosperm nucleus, which becomes the food store.',
    difficulty: 'Advanced',
  },
  {
    question: 'After fertilisation, what do the ovule and the ovary become?',
    options: [
      'The ovule becomes the seed and the ovary becomes the fruit',
      'The ovule becomes the fruit and the ovary becomes the seed',
      'Both become petals',
      'Both wither and fall off',
    ],
    answer: 0,
    explanation: 'Each fertilised ovule becomes a seed (its integuments become the seed coat), and the ovary wall grows into the fruit around the seeds.',
    difficulty: 'Basic',
  },
  {
    question: 'Which set of features suggests a flower is wind-pollinated?',
    options: [
      'Bright petals, scent and nectar',
      'Sticky pollen hidden deep inside a tube-shaped flower',
      'Large flowers that open only at night',
      'Small dull flowers, dangling anthers, feathery stigmas and lots of light pollen',
    ],
    answer: 3,
    explanation: 'Wind pollination needs pollen that blows easily and stigmas that catch it. Petals and nectar would be wasted, as there are no animals to attract.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does a single apple tree often produce few apples, even when bees visit its flowers?',
    options: [
      'Apple trees are wind-pollinated',
      'Bees eat all the pollen',
      'Apple trees are self-incompatible: their own pollen is rejected, so they need pollen from a different variety',
      'Apple flowers have no ovules',
    ],
    answer: 2,
    explanation: 'In self-incompatible plants the style stops tubes from the plant’s own pollen. Cross-pollination with a compatible variety is needed.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, pollen from the blue flower is placed on a stigma of Plant 1. What happens?',
    options: [
      'Pollination has happened, but the pollen of another species is not recognised and does not lead to fertilisation',
      'Fertilisation happens and a hybrid seed forms',
      'The pollen grows two tubes',
      'The ovary immediately becomes a fruit',
    ],
    answer: 0,
    explanation: 'Landing on a stigma is pollination, whatever the species. Fertilisation needs compatible pollen of the same species.',
    difficulty: 'Basic',
  },
  {
    question: 'A tomato contains about 100 seeds. What is the minimum number of pollen grains that had to germinate and deliver sperm?',
    options: ['1', 'About 100, because each ovule needs its own pollen tube', '2', '50, because each tube carries two sperm cells'],
    answer: 1,
    explanation: 'Each pollen tube carries two sperm, but both are used in one ovule (one for the egg, one for the central cell). So every seed needs its own pollen grain.',
    difficulty: 'Advanced',
  },
];
