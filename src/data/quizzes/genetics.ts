import type { QuizQuestion } from '../quiz-types';

export const geneticsQuiz: QuizQuestion[] = [
  {
    question: 'What is an allele?',
    options: ['A whole chromosome', 'A different version of the same gene', 'A type of cell division', 'An observable trait such as flower colour'],
    answer: 1,
    explanation: 'A gene for flower colour can have a purple allele (P) and a white allele (p). The observable trait itself is the phenotype.',
    difficulty: 'Basic',
  },
  {
    question: 'A pea plant has the genotype Pp. Which statement is correct?',
    options: [
      'It is homozygous and has white flowers',
      'It is heterozygous and has purple flowers, because P is dominant',
      'It is heterozygous and has pale purple flowers',
      'It cannot pass on the p allele',
    ],
    answer: 1,
    explanation: 'One dominant allele is enough for the dominant phenotype. The recessive p allele is still there and can be passed on to half of its gametes.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the difference between genotype and phenotype?',
    options: [
      'Genotype is the alleles an organism has; phenotype is the characteristics it shows',
      'They mean the same thing',
      'Phenotype is the alleles; genotype is the appearance',
      'Genotype only applies to plants',
    ],
    answer: 0,
    explanation: 'PP and Pp are different genotypes with the same phenotype (purple). Phenotype can also be affected by the environment.',
    difficulty: 'Basic',
  },
  {
    question: 'Two heterozygous purple plants (Pp × Pp) are crossed. What fraction of the offspring is expected to be white?',
    options: ['None', '1/4', '1/2', '3/4'],
    answer: 1,
    explanation: 'The Punnett square gives PP, Pp, Pp and pp. Only pp (1 box in 4) is white, so the phenotype ratio is 3 purple : 1 white.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A couple who are both carriers (heterozygous) of a recessive condition already have one affected child. What is the chance that their next child is affected?',
    options: ['0%, because they already had their 1 in 4', '25%', '50%', '100%'],
    answer: 1,
    explanation: 'Each child is an independent event: the gametes do not remember previous children. A Punnett square gives probabilities, not a guaranteed pattern within a family.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How can a test cross show whether a purple plant is PP or Pp?',
    options: [
      'Cross it with a pp plant: if any white offspring appear, the purple plant must be Pp',
      'Cross it with another purple plant and count the purple offspring',
      'Look at its flowers more closely',
      'It is impossible to tell',
    ],
    answer: 0,
    explanation: 'A pp parent can only give p. PP × pp gives all purple; Pp × pp gives about half white. Try both in the simulator.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator you breed 10 offspring from Pp × Pp and get 4 white ones instead of the predicted 2 or 3. What does this show?',
    options: [
      'The Punnett square is wrong',
      'Random chance makes small samples differ from the prediction; with many more offspring the proportion approaches 1/4',
      'White is actually dominant',
      'The parents must be pp',
    ],
    answer: 1,
    explanation: 'Mendel counted thousands of peas to see clear ratios. The graph shows the bred percentage settling towards the prediction as numbers grow.',
    difficulty: 'Advanced',
  },
  {
    question: 'Crossing two RrYy pea plants gives about 9 round yellow : 3 round green : 3 wrinkled yellow : 1 wrinkled green. Why?',
    options: [
      'Because the two genes are inherited independently, so each 3 : 1 ratio combines (3 : 1 × 3 : 1)',
      'Because round and yellow are always inherited together',
      'Because there are 16 chromosomes',
      'Because wrinkled is dominant',
    ],
    answer: 0,
    explanation: 'This is Mendel’s law of independent assortment. It holds for genes on different chromosomes; genes close together on the same chromosome tend to be inherited together (linkage).',
    difficulty: 'Advanced',
  },
];
