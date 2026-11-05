import type { QuizQuestion } from '../quiz-types';

export const compareCellsQuiz: QuizQuestion[] = [
  {
    question: 'Which structure is found in plant cells but NOT in animal cells?',
    options: ['Nucleus', 'Cell membrane', 'Cell wall', 'Mitochondria'],
    answer: 2,
    explanation: 'Plant cells have a cellulose cell wall outside the membrane. Animal cells have only a flexible membrane.',
    difficulty: 'Basic',
  },
  {
    question: 'Which structures do both animal and plant cells have?',
    options: ['Chloroplasts and cell wall', 'Nucleus, cell membrane, cytoplasm and mitochondria', 'Large central vacuole', 'Centrioles only'],
    answer: 1,
    explanation: 'Both are eukaryotic cells, so they share a nucleus, membrane, cytoplasm, mitochondria, ribosomes, ER and Golgi apparatus.',
    difficulty: 'Basic',
  },
  {
    question: 'Why don’t animal cells need chloroplasts?',
    options: ['Animals live in the dark', 'Animals get their food by eating other organisms rather than making it by photosynthesis', 'Their mitochondria do photosynthesis', 'Chloroplasts are too big'],
    answer: 1,
    explanation: 'Animals are consumers (heterotrophs): they take in food. Plants are producers (autotrophs) and use chloroplasts to make their own.',
    difficulty: 'Basic',
  },
  {
    question: 'How do plants and animals store excess glucose differently?',
    options: ['Both store it as fat only', 'Plants store starch; animals store glycogen (and fat)', 'Plants store glycogen; animals store starch', 'Neither stores glucose'],
    answer: 1,
    explanation: 'Starch grains are common in plant cells (think of potatoes), while animals store glycogen, mainly in liver and muscle cells.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do animal cells tend to have more varied, irregular shapes than plant cells?',
    options: ['They have no nucleus', 'They have no rigid cell wall, so their shape is set by the membrane and cytoskeleton', 'They are always bigger', 'They contain more water'],
    answer: 1,
    explanation: 'The wall gives plant cells a fixed, often box-like shape. Without one, animal cells can be round, flat, long or branched depending on their job.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A cell is placed in pure water. Which is most likely to burst?',
    options: ['A plant cell', 'An animal cell', 'Both equally', 'Neither'],
    answer: 1,
    explanation: 'Water enters both by osmosis, but the plant cell’s wall resists expansion. The animal cell has no wall, so it can swell until it bursts (see the osmosis simulator).',
    difficulty: 'Advanced',
  },
  {
    question: 'Which statement about vacuoles is correct?',
    options: [
      'Only animal cells have vacuoles',
      'Plant cells usually have one large permanent vacuole; animal cells may have small temporary vacuoles',
      'Vacuoles make proteins',
      'Vacuoles are the same size in all cells',
    ],
    answer: 1,
    explanation: 'The large central vacuole stores cell sap and maintains turgor in plants. Animal cells have only small vesicles or vacuoles, if any.',
    difficulty: 'Advanced',
  },
];
