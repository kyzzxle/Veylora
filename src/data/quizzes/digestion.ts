import type { QuizQuestion } from '../quiz-types';

export const digestionQuiz: QuizQuestion[] = [
  {
    question: 'Where are most nutrients absorbed into the blood?',
    options: ['Stomach', 'Small intestine', 'Large intestine', 'Oesophagus'],
    answer: 1,
    explanation: 'The small intestine is about 6 m long and lined with villi, giving a huge surface area for absorbing sugars, amino acids and fatty acids.',
    difficulty: 'Basic',
  },
  {
    question: 'Which enzyme starts digesting starch in the mouth?',
    options: ['Pepsin', 'Lipase', 'Amylase', 'Trypsin'],
    answer: 2,
    explanation: 'Salivary amylase begins breaking starch into smaller sugars (maltose) while you chew.',
    difficulty: 'Basic',
  },
  {
    question: 'What moves food along the oesophagus and intestines?',
    options: ['Gravity only', 'Peristalsis: waves of muscle contraction', 'Cilia', 'Air pressure'],
    answer: 1,
    explanation: 'Rings of smooth muscle contract in waves behind the food, squeezing it forward. That is why astronauts can still swallow in space.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the job of bile?',
    options: [
      'It digests proteins',
      'It emulsifies fats into small droplets, giving lipase a larger surface to work on',
      'It absorbs water',
      'It makes the stomach acidic',
    ],
    answer: 1,
    explanation: 'Bile is made by the liver and stored in the gallbladder. It contains no enzymes, but breaking fat into droplets speeds up digestion by lipase. It also helps neutralise stomach acid.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does the stomach contain hydrochloric acid?',
    options: [
      'To digest fats',
      'To kill most microbes in food and provide the low pH that pepsin needs',
      'To absorb glucose',
      'To make bile',
    ],
    answer: 1,
    explanation: 'Pepsin works best at about pH 2. The acid also destroys many harmful bacteria swallowed with food.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, the fibre bar barely changes until the large intestine. Why?',
    options: [
      'Fibre is absorbed in the mouth',
      'Human enzymes cannot digest fibre; some is fermented later by gut bacteria',
      'Fibre turns into fat',
      'Fibre is digested by pepsin',
    ],
    answer: 1,
    explanation: 'We lack enzymes to break down cellulose and most other fibres. Bacteria in the colon ferment part of it; the rest adds bulk to faeces.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which pair correctly matches a nutrient with the small molecules it is digested into?',
    options: ['Protein → glucose', 'Fat → amino acids', 'Starch → glucose', 'Starch → fatty acids'],
    answer: 2,
    explanation: 'Starch → glucose (via maltose), proteins → amino acids, fats → fatty acids and glycerol.',
    difficulty: 'Basic',
  },
  {
    question: 'Choose “Olive oil” and compare the time in the stomach with “Bread”. What does this show?',
    options: [
      'Fat leaves the stomach faster',
      'Fat slows stomach emptying, so fatty meals stay in the stomach longer',
      'Bread is not digested',
      'Oil skips the small intestine',
    ],
    answer: 1,
    explanation: 'Hormones released when fat reaches the duodenum slow stomach emptying, giving bile and lipase time to work. This is why fatty meals feel filling.',
    difficulty: 'Advanced',
  },
];
