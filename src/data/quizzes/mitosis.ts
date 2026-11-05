import type { QuizQuestion } from '../quiz-types';

export const mitosisQuiz: QuizQuestion[] = [
  {
    question: 'What does mitosis produce?',
    options: [
      'Four genetically different cells with half the chromosomes',
      'Two genetically identical cells with the same number of chromosomes as the parent',
      'One larger cell',
      'Two cells with half the chromosomes each',
    ],
    answer: 1,
    explanation: 'Mitosis separates sister chromatids, so each daughter cell gets a complete, identical set of chromosomes. Four different cells with half the chromosomes is meiosis.',
    difficulty: 'Basic',
  },
  {
    question: 'Which of these is NOT a job of mitosis?',
    options: ['Growth of a multicellular organism', 'Repairing damaged tissue', 'Making sperm and egg cells', 'Asexual reproduction, for example in yeast or plants grown from cuttings'],
    answer: 2,
    explanation: 'Gametes are made by meiosis, which halves the chromosome number. Mitosis is used for growth, repair and asexual reproduction.',
    difficulty: 'Basic',
  },
  {
    question: 'During which phase is the DNA copied?',
    options: ['Prophase', 'S phase of interphase', 'Anaphase', 'Cytokinesis'],
    answer: 1,
    explanation: 'DNA replication happens in the S (synthesis) phase. Afterwards each chromosome consists of two identical sister chromatids, and the DNA content per cell has doubled.',
    difficulty: 'Basic',
  },
  {
    question: 'In which stage do the chromosomes line up across the middle of the cell?',
    options: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'],
    answer: 1,
    explanation: 'In metaphase, spindle fibres from both poles attach to each chromosome’s kinetochore and line the chromosomes up on the metaphase plate.',
    difficulty: 'Basic',
  },
  {
    question: 'What happens in anaphase?',
    options: [
      'The nuclear envelope re-forms',
      'Sister chromatids separate and are pulled to opposite poles',
      'The DNA is copied',
      'Homologous chromosomes pair up and swap pieces',
    ],
    answer: 1,
    explanation: 'The centromeres split and each chromatid becomes a separate chromosome moving to a pole. Pairing and swapping pieces (crossing over) happens in meiosis, not mitosis.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A body cell has 46 chromosomes. How many chromosomes are in the cell during anaphase, and in each daughter cell afterwards?',
    options: ['46, then 23', '92, then 46', '23, then 46', '46, then 92'],
    answer: 1,
    explanation: 'When the 46 pairs of sister chromatids separate, each chromatid counts as a chromosome, so the cell briefly holds 92. Each daughter receives 46. The graph in the simulator shows the same pattern.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why are checkpoints in the cell cycle important?',
    options: [
      'They make the cell divide faster',
      'They stop the cycle if DNA is damaged or chromosomes are not attached properly, preventing faulty daughter cells',
      'They copy the DNA',
      'They make the cell larger',
    ],
    answer: 1,
    explanation: 'If one chromosome fails to separate (as in the simulator’s mistake option), daughters get too many or too few chromosomes. Failures of cell-cycle control are linked to cancer.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does cytokinesis differ between animal and plant cells?',
    options: [
      'Animal cells form a cleavage furrow; plant cells build a cell plate that becomes a new cell wall',
      'Plant cells form a cleavage furrow; animal cells build a cell wall',
      'Only plant cells carry out cytokinesis',
      'There is no difference',
    ],
    answer: 0,
    explanation: 'A ring of actin and myosin pinches an animal cell in two. Plant cells have rigid walls, so vesicles build a cell plate across the middle instead.',
    difficulty: 'Advanced',
  },
];
