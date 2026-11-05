import type { QuizQuestion } from '../quiz-types';

export const rocksQuiz: QuizQuestion[] = [
  {
    question: 'How are igneous rocks formed?',
    options: ['From layers of sediment', 'From magma or lava that cools and hardens', 'By heat and pressure without melting', 'From the shells of sea creatures'],
    answer: 1,
    explanation: 'Igneous rocks form when molten rock (magma underground, lava at the surface) cools and crystallises.',
    difficulty: 'Basic',
  },
  {
    question: 'Which rock type is most likely to contain fossils?',
    options: ['Igneous', 'Sedimentary', 'Metamorphic', 'Magma'],
    answer: 1,
    explanation: 'Sedimentary rocks form at low temperatures from layers of sediment that can bury and preserve remains of living things.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does granite have large crystals while basalt has tiny ones?',
    options: [
      'Granite is older',
      'Granite cooled slowly underground, giving crystals time to grow; basalt lava cooled quickly at the surface',
      'Basalt was crushed',
      'Granite contains more water',
    ],
    answer: 1,
    explanation: 'Crystal size is a clue to cooling speed: slow cooling → large crystals (intrusive), fast cooling → small crystals (extrusive).',
    difficulty: 'Intermediate',
  },
  {
    question: 'Limestone is heated and squeezed deep underground without melting. What does it become?',
    options: ['Granite', 'Slate', 'Marble', 'Sandstone'],
    answer: 2,
    explanation: 'Limestone recrystallises into marble. Shale becomes slate, and sandstone becomes quartzite.',
    difficulty: 'Basic',
  },
  {
    question: 'What turns loose sediment into sedimentary rock?',
    options: ['Melting', 'Compaction by the weight of overlying layers and cementation by minerals', 'Eruption', 'Weathering'],
    answer: 1,
    explanation: 'Burial squeezes out water and packs grains together; minerals such as calcite or silica precipitate between them and glue them into rock.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, why can’t you weather a rock that is buried deep underground?',
    options: [
      'Buried rocks are too hard',
      'Weathering needs exposure to rain, ice, air and living things at the surface, so the rock must be uplifted first',
      'Weathering only works on magma',
      'It can be weathered at any depth',
    ],
    answer: 1,
    explanation: 'Uplift by plate movements, followed by erosion of what lies above, brings deep rocks back to the surface.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Shale is metamorphosed further and further. What is the order?',
    options: ['Shale → gneiss → schist → slate', 'Shale → slate → schist → gneiss', 'Shale → marble → slate', 'Shale → granite → basalt'],
    answer: 1,
    explanation: 'Rising temperature and pressure give slate, then schist (visible mica), then gneiss (light and dark bands). Even hotter, it would melt.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which statement about the rock cycle is true?',
    options: [
      'Rocks always follow the same fixed path',
      'Any rock type can become any other type by different routes, over millions of years',
      'Metamorphic rocks can never melt',
      'The rock cycle has stopped',
    ],
    answer: 1,
    explanation: 'There are many shortcuts: igneous rock can be metamorphosed directly, metamorphic rock can be weathered into sediment, and so on. Plate tectonics keeps the cycle running.',
    difficulty: 'Advanced',
  },
];
