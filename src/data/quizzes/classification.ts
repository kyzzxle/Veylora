import type { QuizQuestion } from '../quiz-types';

export const classificationQuiz: QuizQuestion[] = [
  {
    question: 'What is the first question in the key used to split animals into two big groups?',
    options: ['Can it fly?', 'Does it have a backbone?', 'Does it live in water?', 'Is it large or small?'],
    answer: 1,
    explanation:
      'Animals with a backbone are vertebrates; those without are invertebrates. “Can it fly?” or “Does it live in water?” would group unrelated animals together, such as bats with birds or whales with fish.',
    difficulty: 'Basic',
  },
  {
    question: 'A dolphin lives in the sea and has fins. Which group does it belong to?',
    options: ['Fish', 'Mammals', 'Amphibians', 'Reptiles'],
    answer: 1,
    explanation: 'Dolphins breathe air with lungs, are warm-blooded and feed their young milk. They are mammals that have adapted to life in water.',
    difficulty: 'Basic',
  },
  {
    question: 'Which feature tells you that a spider is not an insect?',
    options: ['It is small', 'It has eight legs', 'It has a backbone', 'It can bite'],
    answer: 1,
    explanation: 'Insects have six legs and three body parts. Spiders have eight legs and two body parts, which makes them arachnids, like scorpions and ticks.',
    difficulty: 'Basic',
  },
  {
    question: 'Which pair of animals belongs to the same group?',
    options: ['Bat and eagle', 'Crab and spider', 'Penguin and eagle', 'Starfish and salmon'],
    answer: 2,
    explanation: 'Penguins and eagles both have feathers, so both are birds, even though penguins cannot fly. Bats are mammals, crabs are crustaceans, and starfish are echinoderms.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What makes a frog an amphibian rather than a reptile?',
    options: [
      'It lives on land',
      'It has moist, scale-less skin and its young usually develop in water with gills',
      'It has four legs',
      'It lays eggs',
    ],
    answer: 1,
    explanation:
      'Reptiles have dry, scaly skin and lay eggs on land. Amphibians have moist skin and usually go through a water-dwelling larval stage, like tadpoles.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In scientific classification, which of these is the most specific level?',
    options: ['Kingdom', 'Class', 'Genus', 'Species'],
    answer: 3,
    explanation:
      'The main levels run from broad to specific: kingdom, phylum, class, order, family, genus, species. Members of the same species can breed together and produce fertile offspring.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The platypus lays eggs. Why is it still classified as a mammal?',
    options: [
      'Because it lives in Australia',
      'Because it has fur and feeds its young on milk',
      'Because it has a beak',
      'It is actually classified as a bird',
    ],
    answer: 1,
    explanation:
      'Classification uses a combination of shared features. Hair and milk-producing glands are defining mammal traits. The platypus and echidnas are monotremes — egg-laying mammals.',
    difficulty: 'Advanced',
  },
];
