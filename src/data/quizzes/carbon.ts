import type { QuizQuestion } from '../quiz-types';

export const carbonQuiz: QuizQuestion[] = [
  {
    question: 'Which process removes carbon dioxide from the atmosphere?',
    options: ['Respiration', 'Burning fossil fuels', 'Photosynthesis', 'Decomposition'],
    answer: 2,
    explanation: 'Plants and algae use CO₂ and light energy to make glucose. Respiration, decomposition and combustion all release CO₂.',
    difficulty: 'Basic',
  },
  {
    question: 'Where is most of Earth’s actively cycling carbon stored?',
    options: ['The atmosphere', 'Living plants', 'The deep ocean', 'Animals'],
    answer: 2,
    explanation: 'The deep ocean holds about 37,000 GtC, roughly 40 times more than the atmosphere. Even more is locked in rocks such as limestone.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How did the carbon in coal, oil and gas get underground?',
    options: [
      'From volcanoes',
      'From plants and plankton that were buried and compressed over millions of years',
      'From the Earth’s core',
      'From meteorites',
    ],
    answer: 1,
    explanation: 'Fossil fuels store carbon taken from the air by ancient photosynthesis. Burning them returns, in decades, carbon that took millions of years to bury.',
    difficulty: 'Basic',
  },
  {
    question: 'Roughly what share of the CO₂ emitted by humans has stayed in the atmosphere?',
    options: ['All of it', 'About half', 'About 5 %', 'None of it'],
    answer: 1,
    explanation: 'Oceans and land have absorbed roughly half. The simulator’s “Still in the air” readout shows this airborne fraction.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is the ocean becoming more acidic?',
    options: [
      'Acid rain from factories',
      'It absorbs CO₂, which reacts with water to form carbonic acid',
      'Melting ice is acidic',
      'Fish produce acid',
    ],
    answer: 1,
    explanation: 'Surface ocean pH has dropped from about 8.2 to 8.1 since 1850, which makes it harder for corals and shellfish to build their skeletons.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, choose “Net zero by 2050”. What happens to atmospheric CO₂ afterwards?',
    options: [
      'It immediately drops back to 280 ppm',
      'It stops rising and slowly falls as the ocean and land keep absorbing carbon',
      'It keeps rising just as fast',
      'It doubles',
    ],
    answer: 1,
    explanation: 'Once emissions stop, natural sinks slowly draw CO₂ down, but it takes centuries to approach pre-industrial levels.',
    difficulty: 'Advanced',
  },
  {
    question: 'How does cutting down a forest affect the carbon cycle?',
    options: [
      'It has no effect',
      'Carbon in the trees is released, and there is less photosynthesis to take CO₂ out of the air in future',
      'It only affects oxygen levels',
      'It increases photosynthesis',
    ],
    answer: 1,
    explanation: 'Deforestation turns a carbon store and sink into a source. It accounts for about a tenth of human emissions.',
    difficulty: 'Basic',
  },
  {
    question: '1 GtC of carbon makes about how much CO₂ when burned?',
    options: ['1 billion tonnes', 'About 3.7 billion tonnes', 'About 12 billion tonnes', 'Half a billion tonnes'],
    answer: 1,
    explanation: 'Each carbon atom (mass 12) joins two oxygen atoms to make CO₂ (mass 44), so the mass is multiplied by 44/12 ≈ 3.67.',
    difficulty: 'Advanced',
  },
];
