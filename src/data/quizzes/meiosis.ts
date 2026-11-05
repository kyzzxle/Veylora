import type { QuizQuestion } from '../quiz-types';

export const meiosisQuiz: QuizQuestion[] = [
  {
    question: 'What does meiosis produce?',
    options: [
      'Two identical diploid cells',
      'Four genetically different haploid cells',
      'Four identical diploid cells',
      'One haploid cell',
    ],
    answer: 1,
    explanation: 'Meiosis has two divisions. The first halves the chromosome number and the second separates sister chromatids, giving four haploid cells that differ because of independent assortment and crossing over.',
    difficulty: 'Basic',
  },
  {
    question: 'What are homologous chromosomes?',
    options: [
      'The two identical copies made when DNA is replicated',
      'A pair of chromosomes of the same size and carrying the same genes, one from each parent',
      'Any two chromosomes in the same cell',
      'The sex chromosomes only',
    ],
    answer: 1,
    explanation: 'Homologues carry the same genes but may carry different versions (alleles). The identical copies made by DNA replication are sister chromatids.',
    difficulty: 'Basic',
  },
  {
    question: 'Which event happens in meiosis I but not in mitosis?',
    options: [
      'Sister chromatids separate',
      'Homologous chromosomes pair up, cross over and then separate',
      'DNA is copied',
      'The nuclear envelope breaks down',
    ],
    answer: 1,
    explanation: 'In prophase I homologues pair (synapsis) and swap pieces; in anaphase I the homologues, not the sister chromatids, move to opposite poles.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A human body cell has 46 chromosomes. How many chromosomes does each cell have after meiosis I, and after meiosis II?',
    options: ['46, then 23', '23, then 23', '23, then 46', '92, then 46'],
    answer: 1,
    explanation: 'Meiosis I halves the number to 23, though each chromosome still has two chromatids. Meiosis II separates the chromatids, so each of the four cells has 23 single-chromatid chromosomes.',
    difficulty: 'Advanced',
  },
  {
    question: 'What is crossing over?',
    options: [
      'The exchange of matching pieces between non-sister chromatids of homologous chromosomes',
      'The movement of chromosomes to the poles',
      'The fusion of two gametes',
      'Copying of DNA in S phase',
    ],
    answer: 0,
    explanation: 'Crossing over happens at chiasmata in prophase I. It creates chromatids with new combinations of alleles, shown in the simulator as two-coloured chromatids.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is independent assortment?',
    options: [
      'Each homologous pair lines up at metaphase I in a random orientation, independently of the other pairs',
      'Sister chromatids are always identical',
      'Every gamete gets all the maternal chromosomes',
      'Chromosomes are copied independently',
    ],
    answer: 0,
    explanation: 'Because each pair orients randomly, a gamete can receive any mix of maternal and paternal chromosomes. Flip the pairs in the variation lab to see the different gametes.',
    difficulty: 'Intermediate',
  },
  {
    question: 'With n pairs of chromosomes and no crossing over, how many different gametes can independent assortment produce?',
    options: ['n', '2n', '2ⁿ', 'n²'],
    answer: 2,
    explanation: 'Each pair has two possible orientations, so the number of combinations is 2 × 2 × … = 2ⁿ. For humans, 2²³ is about 8.4 million, before crossing over adds even more.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why is it important that gametes are haploid?',
    options: [
      'So that gametes can divide by mitosis',
      'So that when two gametes fuse at fertilisation, the zygote has the normal diploid number',
      'So that they are smaller',
      'So that they contain no DNA',
    ],
    answer: 1,
    explanation: 'n + n = 2n. If gametes were diploid, the chromosome number would double in every generation.',
    difficulty: 'Basic',
  },
];
