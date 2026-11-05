import type { QuizQuestion } from '../quiz-types';

export const endocrineQuiz: QuizQuestion[] = [
  {
    question: 'How do hormones travel from glands to their target organs?',
    options: ['Along nerves', 'In the bloodstream', 'Through the lymph only', 'Through the air we breathe'],
    answer: 1,
    explanation: 'Endocrine glands release hormones directly into the blood, which carries them all around the body. Only cells with the right receptors respond.',
    difficulty: 'Basic',
  },
  {
    question: 'Which gland is often called the “master gland”?',
    options: ['Thyroid', 'Pituitary', 'Adrenal', 'Pancreas'],
    answer: 1,
    explanation: 'The pituitary releases hormones (such as TSH, ACTH, FSH and LH) that control many other glands. It is itself controlled by the hypothalamus.',
    difficulty: 'Basic',
  },
  {
    question: 'Which hormone lowers blood glucose?',
    options: ['Glucagon', 'Adrenaline', 'Insulin', 'Cortisol'],
    answer: 2,
    explanation: 'Insulin from the pancreas helps cells take up glucose and tells the liver to store it as glycogen. Glucagon, adrenaline and cortisol raise glucose.',
    difficulty: 'Basic',
  },
  {
    question: 'In the thyroid feedback simulation, what happens to TSH when you add thyroxine tablets to a healthy person?',
    options: ['TSH rises', 'TSH falls, because extra T4 switches off TRH and TSH', 'TSH stays exactly the same', 'TSH turns into T4'],
    answer: 1,
    explanation: 'This is negative feedback: the system responds to a change by reducing its cause, keeping T4 near its normal level.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why can iodine deficiency cause a goitre (swollen thyroid)?',
    options: [
      'Iodine makes the thyroid shrink',
      'Low T4 removes negative feedback, so TSH stays high and keeps stimulating the thyroid to grow',
      'The pituitary stops working',
      'Too much T4 is made',
    ],
    answer: 1,
    explanation: 'The thyroid needs iodine to make T4. Adding iodine to table salt has made goitre rare in many countries.',
    difficulty: 'Advanced',
  },
  {
    question: 'What is the main difference between type 1 and type 2 diabetes?',
    options: [
      'Type 1 is caused by eating sugar',
      'In type 1 the body makes little or no insulin; in type 2 cells respond poorly to insulin',
      'Type 2 only affects children',
      'There is no difference',
    ],
    answer: 1,
    explanation: 'Type 1 is usually caused by the immune system destroying insulin-making cells and needs insulin treatment. Type 2 involves insulin resistance and is linked to lifestyle and genetics.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which hormone prepares the body for “fight or flight”?',
    options: ['Melatonin', 'Adrenaline', 'Oestrogen', 'Thyroxine'],
    answer: 1,
    explanation: 'Adrenaline from the adrenal glands raises heart and breathing rate and releases glucose for energy within seconds.',
    difficulty: 'Basic',
  },
  {
    question: 'How does the endocrine system differ from the nervous system?',
    options: [
      'Hormones act faster than nerve impulses',
      'Hormones travel in the blood and usually act more slowly but for longer',
      'The nervous system uses chemicals in the blood',
      'They never work together',
    ],
    answer: 1,
    explanation: 'Nerve impulses take milliseconds and act on specific cells; hormones take seconds to hours and can affect many organs for a long time.',
    difficulty: 'Intermediate',
  },
];
