import type { QuizQuestion } from '../quiz-types';

export const plantAnatomyQuiz: QuizQuestion[] = [
  {
    question: 'Which organ is the main site of photosynthesis?',
    options: ['Root', 'Stem', 'Leaf', 'Flower'],
    answer: 2,
    explanation: 'Leaves are broad and thin to capture light and exchange gases, and their palisade cells are packed with chloroplasts.',
    difficulty: 'Basic',
  },
  {
    question: 'What does xylem transport?',
    options: ['Sugars, up and down the plant', 'Water and mineral ions, upward from the roots', 'Oxygen to the roots', 'Pollen to the flower'],
    answer: 1,
    explanation: 'Xylem vessels are hollow tubes of dead cells that carry water and dissolved minerals from roots to leaves.',
    difficulty: 'Basic',
  },
  {
    question: 'What does phloem transport?',
    options: ['Water only', 'Dissolved sugars, to wherever they are needed or stored', 'Air', 'Soil'],
    answer: 1,
    explanation: 'Phloem carries sugars made in the leaves to growing regions and storage organs, in either direction. This is called translocation.',
    difficulty: 'Basic',
  },
  {
    question: 'Why are palisade cells near the top of the leaf and packed with chloroplasts?',
    options: [
      'To store water',
      'To absorb as much light as possible for photosynthesis',
      'To protect the leaf from insects',
      'To make the leaf heavier',
    ],
    answer: 1,
    explanation: 'Light enters from above, so placing tightly packed, chloroplast-rich cells just under the transparent upper epidermis captures the most light.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How are root hair cells adapted for their job?',
    options: [
      'They contain many chloroplasts',
      'Their long, thin extensions give a huge surface area for absorbing water and minerals',
      'They are dead and hollow',
      'They produce pollen',
    ],
    answer: 1,
    explanation: 'Root hairs increase the surface area in contact with soil water, speeding up absorption by osmosis and active transport. They have no chloroplasts because they are underground.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which part of the flower becomes the fruit after fertilization?',
    options: ['Petal', 'Anther', 'Ovary', 'Sepal'],
    answer: 2,
    explanation: 'The ovary develops into the fruit, and the ovules inside it become seeds.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do the spongy mesophyll cells have air spaces between them?',
    options: [
      'To make the leaf float',
      'To let carbon dioxide, oxygen and water vapour diffuse quickly between the stomata and the photosynthesising cells',
      'To store starch',
      'To transport sugar',
    ],
    answer: 1,
    explanation: 'The air spaces form a network connected to the stomata, so gases can move easily to and from every cell inside the leaf.',
    difficulty: 'Advanced',
  },
];
