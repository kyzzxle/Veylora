import type { QuizQuestion } from '../quiz-types';

export const reproductionQuiz: QuizQuestion[] = [
  {
    question: 'Where are sperm cells produced?',
    options: ['In the prostate gland', 'In the testes', 'In the bladder', 'In the vas deferens'],
    answer: 1,
    explanation: 'Sperm are made in the coiled seminiferous tubules of the testes, then mature in the epididymis.',
    difficulty: 'Basic',
  },
  {
    question: 'Where does fertilisation usually take place?',
    options: ['In the ovary', 'In the uterus', 'In a fallopian tube', 'In the cervix'],
    answer: 2,
    explanation: 'The egg is fertilised in the fallopian tube, then the early embryo travels to the uterus over about five days.',
    difficulty: 'Basic',
  },
  {
    question: 'How many chromosomes does a human egg or sperm cell contain?',
    options: ['46', '23', '92', '12'],
    answer: 1,
    explanation: 'Gametes are made by meiosis and contain half the usual number. When they join, the zygote has the full 46.',
    difficulty: 'Basic',
  },
  {
    question: 'Which hormone surge triggers ovulation?',
    options: ['Progesterone', 'Luteinising hormone (LH)', 'Testosterone', 'Insulin'],
    answer: 1,
    explanation: 'High oestrogen causes the pituitary gland to release a surge of LH around day 14, and the follicle releases its egg about a day later.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the main role of progesterone in the second half of the cycle?',
    options: [
      'To make follicles grow',
      'To keep the uterine lining thick and ready for an embryo',
      'To trigger a period',
      'To produce sperm',
    ],
    answer: 1,
    explanation: 'Progesterone from the corpus luteum maintains the lining. When it falls (no pregnancy), the lining is shed as a period.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, switch on pregnancy. Why does menstruation not happen?',
    options: [
      'The ovaries stop working completely',
      'The implanted embryo releases hCG, which keeps the corpus luteum making progesterone, so the lining is maintained',
      'Oestrogen disappears',
      'FSH rises sharply',
    ],
    answer: 1,
    explanation: 'hCG is also the hormone detected by pregnancy tests. Later, the placenta takes over making progesterone.',
    difficulty: 'Advanced',
  },
  {
    question: 'What does the seminal vesicle add to semen?',
    options: ['Sperm', 'A sugary fluid that gives sperm energy', 'Urine', 'Eggs'],
    answer: 1,
    explanation: 'Seminal vesicles add fructose-rich fluid; the prostate adds an alkaline fluid. Together they make up most of the volume of semen.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is a blastocyst?',
    options: [
      'A fertilised egg before it divides',
      'A hollow ball of cells, about five days after fertilisation, that implants in the uterus',
      'A type of hormone',
      'Part of the ovary',
    ],
    answer: 1,
    explanation: 'Its inner cell mass becomes the embryo; its outer layer helps form the placenta.',
    difficulty: 'Advanced',
  },
];
