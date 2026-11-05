import type { QuizQuestion } from '../quiz-types';

export const cellStructureQuiz: QuizQuestion[] = [
  {
    question: 'Which organelle contains the cell’s DNA and controls its activities?',
    options: ['Mitochondrion', 'Nucleus', 'Ribosome', 'Golgi apparatus'],
    answer: 1,
    explanation: 'The nucleus holds the chromosomes. Genes in the DNA carry the instructions for making the cell’s proteins.',
    difficulty: 'Basic',
  },
  {
    question: 'Where is most of the energy released from glucose in aerobic respiration?',
    options: ['Nucleus', 'Mitochondria', 'Cell membrane', 'Lysosomes'],
    answer: 1,
    explanation: 'Mitochondria carry out aerobic respiration and make ATP, the cell’s energy currency. Very active cells, such as muscle cells, contain many.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the job of ribosomes?',
    options: ['Storing water', 'Building proteins', 'Making fats only', 'Digesting old organelles'],
    answer: 1,
    explanation: 'Ribosomes read messenger RNA and join amino acids into proteins. They are found free in the cytoplasm and on the rough ER.',
    difficulty: 'Basic',
  },
  {
    question: 'What makes the rough endoplasmic reticulum “rough”?',
    options: ['Its wrinkled shape', 'Ribosomes attached to its surface', 'Hard mineral deposits', 'Chlorophyll'],
    answer: 1,
    explanation: 'Ribosomes stud its surface. Proteins they make enter the RER, are folded, and are sent on to the Golgi apparatus.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A protein hormone is made for export out of the cell. In what order does it pass through these structures?',
    options: [
      'Golgi → ribosome on RER → vesicle → membrane',
      'Ribosome on RER → Golgi apparatus → vesicle → cell membrane',
      'Nucleus → mitochondrion → membrane',
      'Lysosome → Golgi → ribosome',
    ],
    answer: 1,
    explanation: 'It is made on ribosomes on the rough ER, modified and packaged in the Golgi apparatus, carried in a vesicle and released when the vesicle fuses with the membrane (exocytosis).',
    difficulty: 'Advanced',
  },
  {
    question: 'Which structure controls which substances enter and leave the cell?',
    options: ['Cell wall', 'Cell membrane', 'Nucleolus', 'Centriole'],
    answer: 1,
    explanation: 'The selectively permeable cell membrane regulates traffic in and out. A cell wall, where present, gives support but lets most substances through.',
    difficulty: 'Basic',
  },
  {
    question: 'Why might a white blood cell that destroys bacteria contain many lysosomes?',
    options: [
      'To make more DNA',
      'Lysosomes contain digestive enzymes that break down the engulfed bacteria',
      'To photosynthesise',
      'To store water',
    ],
    answer: 1,
    explanation: 'After engulfing a bacterium, the cell fuses lysosomes with the vesicle so their enzymes can digest it — structure matches function.',
    difficulty: 'Intermediate',
  },
];

export const plantCellQuiz: QuizQuestion[] = [
  {
    question: 'Which three structures are found in plant cells but not in animal cells?',
    options: [
      'Nucleus, mitochondria and ribosomes',
      'Cell wall, chloroplasts and a large central vacuole',
      'Cell membrane, cytoplasm and nucleus',
      'Centrioles, lysosomes and Golgi apparatus',
    ],
    answer: 1,
    explanation: 'The cellulose wall, chloroplasts and large permanent vacuole are the classic differences. Both cell types have a nucleus, membrane, mitochondria and ribosomes.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the cell wall made of in plants?',
    options: ['Chitin', 'Cellulose', 'Protein', 'Starch'],
    answer: 1,
    explanation: 'Plant cell walls are built mainly of cellulose fibres. Fungi use chitin, and bacteria use peptidoglycan.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the function of chloroplasts?',
    options: ['Respiration', 'Photosynthesis', 'Protein synthesis', 'Storing water'],
    answer: 1,
    explanation: 'Chloroplasts contain chlorophyll, which absorbs light energy used to make glucose from carbon dioxide and water.',
    difficulty: 'Basic',
  },
  {
    question: 'Do plant cells have mitochondria?',
    options: ['No, chloroplasts replace them', 'Yes — plants respire all the time to release energy', 'Only in roots', 'Only at night'],
    answer: 1,
    explanation: 'Plant cells need mitochondria for respiration, day and night. Chloroplasts make glucose; mitochondria release its energy.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does the large central vacuole help a plant stay upright?',
    options: [
      'It stores sugar that hardens the cell',
      'When full of water it pushes the cytoplasm against the wall, making the cell firm (turgid)',
      'It contains bones',
      'It produces cellulose',
    ],
    answer: 1,
    explanation: 'Water pressure in the vacuole presses outward against the wall. When many cells are turgid, leaves and young stems are supported; when water is lost, the plant wilts.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Root cells are plant cells but usually have no chloroplasts. Why?',
    options: ['Roots are dead', 'Roots are underground and receive no light for photosynthesis', 'Chloroplasts would dissolve in soil water', 'Roots use their wall for photosynthesis'],
    answer: 1,
    explanation: 'Cells only develop the structures they need. Without light there is no point in having chloroplasts, so root cells lack them.',
    difficulty: 'Advanced',
  },
  {
    question: 'What can pass through the cell wall?',
    options: ['Nothing at all', 'Water and dissolved substances — the wall is fully permeable', 'Only oxygen', 'Only sugars'],
    answer: 1,
    explanation: 'Unlike the selectively permeable membrane, the wall lets water and solutes through freely; its job is support and protection, not control.',
    difficulty: 'Advanced',
  },
];
