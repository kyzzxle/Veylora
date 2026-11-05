import type { QuizQuestion } from '../quiz-types';

export const dnaQuiz: QuizQuestion[] = [
  {
    question: 'Which enzyme unzips the DNA double helix at the replication fork?',
    options: ['DNA ligase', 'Helicase', 'Primase', 'DNA polymerase I'],
    answer: 1,
    explanation: 'Helicase breaks the hydrogen bonds between base pairs, separating the two strands so each can act as a template.',
    difficulty: 'Basic',
  },
  {
    question: 'A template strand reads A T G C. What is the new complementary DNA strand?',
    options: ['A T G C', 'T A C G', 'U A C G', 'G C A T'],
    answer: 1,
    explanation: 'A pairs with T and G pairs with C, so A T G C is copied as T A C G. (U only appears in RNA, such as primers.)',
    difficulty: 'Basic',
  },
  {
    question: 'Why is DNA replication called semi-conservative?',
    options: [
      'Only half of the DNA is copied',
      'Each new DNA molecule contains one original strand and one newly made strand',
      'The original molecule is kept whole and a completely new one is made',
      'Half of the bases are changed during copying',
    ],
    answer: 1,
    explanation: 'Each parent strand serves as a template and stays paired with its new partner, so both daughter molecules are half old and half new.',
    difficulty: 'Basic',
  },
  {
    question: 'Why is the lagging strand made in short Okazaki fragments?',
    options: [
      'Its template is damaged',
      'DNA polymerase can only add nucleotides in the 5′→3′ direction, which on this strand points away from the fork',
      'Primase works faster than helicase',
      'There are not enough nucleotides',
    ],
    answer: 1,
    explanation: 'The two template strands are antiparallel. On one, 5′→3′ synthesis follows the fork (leading strand); on the other it runs away from it, so it must restart repeatedly.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the job of primase?',
    options: ['To join Okazaki fragments', 'To lay a short RNA primer that gives DNA polymerase a starting point', 'To proofread errors', 'To unwind the helix'],
    answer: 1,
    explanation: 'DNA polymerase can only extend an existing strand. Primase makes a short RNA primer that polymerase can build onto.',
    difficulty: 'Intermediate',
  },
  {
    question: 'After DNA polymerase I replaces an RNA primer with DNA, what is still needed?',
    options: ['Helicase must re-zip the strands', 'DNA ligase must seal the nick in the sugar-phosphate backbone', 'Primase must add another primer', 'Nothing; the strand is complete'],
    answer: 1,
    explanation: 'A gap in the backbone (a nick) is left between the fragments. DNA ligase forms the final bond to join them into one continuous strand.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, a new base on the lagging strand shows the letter U. What does that tell you?',
    options: [
      'A mutation has happened',
      'That base is part of an RNA primer, because RNA uses uracil instead of thymine',
      'The base is on the template strand',
      'The base has not been paired yet',
    ],
    answer: 1,
    explanation: 'Primers are RNA, and RNA uses uracil (U) to pair with adenine. Once DNA polymerase I replaces the primer, the U becomes T.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the Meselson–Stahl experiment, bacteria grown in heavy nitrogen (¹⁵N) were moved to normal nitrogen (¹⁴N). After one round of replication, all DNA had an intermediate density. Which model did this support?',
    options: ['Conservative replication only', 'Semi-conservative or dispersive replication; a second round ruled out dispersive', 'No replication occurred', 'Replication without templates'],
    answer: 1,
    explanation: 'One hybrid band ruled out the conservative model. After a second round, half the DNA was hybrid and half light, which only the semi-conservative model predicts.',
    difficulty: 'Advanced',
  },
];
