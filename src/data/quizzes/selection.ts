import type { QuizQuestion } from '../quiz-types';

export const selectionQuiz: QuizQuestion[] = [
  {
    question: 'In natural selection, which individuals are most likely to pass on their genes?',
    options: [
      'The biggest and strongest, always',
      'Those whose traits help them survive and reproduce in their current environment',
      'Those that try hardest to change',
      'Every individual equally',
    ],
    answer: 1,
    explanation:
      '“Fitness” in evolution means reproductive success in a particular environment. On light bark, light moths are fittest; on sooty bark, dark moths are.',
    difficulty: 'Basic',
  },
  {
    question: 'Why did dark peppered moths become common in industrial areas of 19th-century Britain?',
    options: [
      'Soot stained the moths black',
      'Moths decided to become dark to hide',
      'Birds found dark moths harder to see on soot-blackened bark, so more of them survived to breed',
      'Pollution caused every moth to mutate',
    ],
    answer: 2,
    explanation:
      'The dark form already existed as a rare variant. When pollution darkened the trees, birds ate more of the conspicuous light moths, so the dark allele became more common in each generation.',
    difficulty: 'Basic',
  },
  {
    question: 'What happens to the population when you switch from “Industrial pollution” back to “Clean forest”?',
    options: [
      'Nothing — evolution only goes one way',
      'Light moths become more common again',
      'All moths die',
      'The moths turn white during their lifetimes',
    ],
    answer: 1,
    explanation:
      'Selection depends on the current environment. After clean-air laws in the 1950s, bark became lighter and the light form became common again — exactly what was recorded in Britain.',
    difficulty: 'Basic',
  },
  {
    question: 'Does natural selection act on individuals or on populations?',
    options: [
      'Individuals evolve during their lives',
      'Selection acts on individuals, but it is populations that evolve over generations',
      'Only populations are affected; individuals do not matter',
      'Neither',
    ],
    answer: 1,
    explanation:
      'An individual moth cannot change its colour. Selection decides which individuals survive and reproduce, and the population’s allele frequencies change from one generation to the next.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Starting from 2% dark alleles in a polluted forest, the dark moths spread quickly at first. Why?',
    options: [
      'Mutation is very fast',
      'The dark allele is dominant, so every carrier of even one copy is dark and benefits from camouflage',
      'Light moths stop reproducing completely',
      'Birds prefer to eat dark moths',
    ],
    answer: 1,
    explanation:
      'A dominant allele is expressed in heterozygotes, so selection “sees” it even when it is rare. A rare recessive allele would be hidden in heterozygotes and spread much more slowly at first.',
    difficulty: 'Intermediate',
  },
  {
    question: 'With bird predation set to 0%, what does the dark allele frequency do in a small population?',
    options: [
      'It stays exactly constant',
      'It wanders up and down randomly (genetic drift) and may be lost or fixed by chance',
      'It always rises',
      'It always falls',
    ],
    answer: 1,
    explanation:
      'Without selection, chance alone changes allele frequencies — genetic drift. Drift is strongest in small populations. Try a population of 20 and save several runs to compare.',
    difficulty: 'Advanced',
  },
  {
    question: 'Where did the dark (carbonaria) form originally come from?',
    options: [
      'A random mutation that existed before pollution made it useful',
      'Moths absorbing soot into their wings',
      'Birds selecting for it',
      'Interbreeding with a different species',
    ],
    answer: 0,
    explanation:
      'Mutations arise randomly, not because they are needed. Genetic studies (van’t Hof et al., 2016) traced the carbonaria mutation to a single event in the early 1800s. Selection then made the existing variant common.',
    difficulty: 'Advanced',
  },
];
