import type { QuizQuestion } from '../quiz-types';

export const plantDiversityQuiz: QuizQuestion[] = [
  {
    question: 'Which group of land plants has no vascular tissue (xylem and phloem)?',
    options: ['Ferns', 'Conifers', 'Bryophytes (mosses, liverworts and hornworts)', 'Flowering plants'],
    answer: 2,
    explanation: 'Bryophytes have no lignified vascular tissue, so they cannot move water far or support a tall body. That is why they stay small.',
    difficulty: 'Basic',
  },
  {
    question: 'In what order did these innovations appear during plant evolution?',
    options: [
      'Vascular tissue → seeds and pollen → flowers and fruits',
      'Flowers → seeds → vascular tissue',
      'Seeds → vascular tissue → flowers',
      'They all appeared at the same time',
    ],
    answer: 0,
    explanation: 'Vascular plants appeared about 430 million years ago, seed plants about 360 million years ago, and flowering plants about 140 million years ago.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is a clubmoss placed with the ferns and their allies rather than with the mosses?',
    options: [
      'It is bigger than a moss',
      'It has flowers',
      'It makes seeds in cones',
      'It has vascular tissue and makes spores, so it is a seedless vascular plant despite its name',
    ],
    answer: 3,
    explanation: 'Names can mislead: the clubmoss is a lycophyte, a vascular plant. True mosses lack vascular tissue.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What does “alternation of generations” mean?',
    options: [
      'Plants grow in spring and die in autumn',
      'The life cycle alternates between a haploid gametophyte that makes gametes and a diploid sporophyte that makes spores',
      'Parents and offspring look different',
      'Plants switch between sexual and asexual reproduction every year',
    ],
    answer: 1,
    explanation: 'All land plants have both generations. Gametes are made by mitosis in the gametophyte; spores are made by meiosis in the sporophyte.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When you look at a green, leafy moss plant, which generation are you seeing?',
    options: ['The haploid gametophyte', 'The diploid sporophyte', 'A zygote', 'A seed'],
    answer: 0,
    explanation: 'In mosses the gametophyte (n) is the dominant, long-lived stage. The sporophyte (2n) is the stalk and capsule that grows on top and depends on it.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When you look at a fern plant with fronds, which generation are you seeing?',
    options: ['The haploid gametophyte', 'A spore', 'The diploid sporophyte', 'A pollen grain'],
    answer: 2,
    explanation: 'The fern plant is the sporophyte (2n). Its gametophyte is a tiny, heart-shaped prothallus about 1 cm across that lives on its own.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where in a moss or fern life cycle does meiosis happen?',
    options: ['When gametes are made', 'When spores are made in a capsule or sporangium', 'At fertilisation', 'When the spore germinates'],
    answer: 1,
    explanation: 'Meiosis halves the chromosome number from 2n to n as spores are produced. The gametes are already haploid, so the gametophyte makes them by mitosis.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why do mosses and ferns usually grow in damp places?',
    options: [
      'Their seeds need water to germinate',
      'They cannot make chlorophyll in dry air',
      'Their roots rot in dry soil',
      'Their sperm must swim through a film of water to reach the eggs',
    ],
    answer: 3,
    explanation: 'Turn the water down in the simulator and moss and fern fertilisation stops, while the pine and the flower are unaffected because pollen travels through the air.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the main difference between gymnosperms and angiosperms?',
    options: [
      'Gymnosperm seeds are “naked” on cone scales, while angiosperm seeds develop inside an ovary that becomes a fruit',
      'Gymnosperms have no vascular tissue',
      'Angiosperms make spores instead of seeds',
      'Gymnosperms are all small plants',
    ],
    answer: 0,
    explanation: 'Gymnosperm means “naked seed”; angiosperm means “seed in a vessel”. Angiosperms also have flowers.',
    difficulty: 'Basic',
  },
  {
    question: 'Which advantage did seeds give to plants over spores?',
    options: [
      'Seeds are smaller and lighter than spores',
      'Seeds do not need any water to grow',
      'A seed contains an embryo with a food store and a protective coat, so it can survive until conditions are good and give the seedling a head start',
      'Seeds can photosynthesise',
    ],
    answer: 2,
    explanation: 'Spores are single cells with no stored food. A seed is a protected, multicellular package, which helped seed plants spread into drier and more seasonal places.',
    difficulty: 'Intermediate',
  },
];
