import type { QuizQuestion } from '../quiz-types';

export const pollutionQuiz: QuizQuestion[] = [
  {
    question: 'What is eutrophication?',
    options: [
      'A lake drying up',
      'Excess nutrients in water causing algae to grow rapidly, which can lead to oxygen loss',
      'Water becoming too salty',
      'Fish eating too much',
    ],
    answer: 1,
    explanation: 'Fertiliser or sewage adds nitrates and phosphates, triggering an algal bloom. When the algae die, decomposing bacteria use up the oxygen.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, why do fish die after an algal bloom, even though algae produce oxygen?',
    options: [
      'Algae are poisonous to all fish',
      'Bacteria decomposing the large amount of dead algae use more oxygen than the living algae make',
      'The water gets too cold',
      'Fish eat too much algae',
    ],
    answer: 1,
    explanation: 'Decomposition is the main oxygen drain. Thick algae also block light, so plants deeper down die too, adding more dead matter.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the minimum dissolved oxygen most fish need to stay healthy?',
    options: ['About 0.5 mg/L', 'About 5 mg/L', 'About 50 mg/L', 'Fish do not need oxygen'],
    answer: 1,
    explanation: 'Many fish become stressed below about 5 mg/L, and most die below about 2 mg/L. Clean, cool water holds about 8–10 mg/L.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is bioaccumulation?',
    options: [
      'Animals growing larger over time',
      'A substance building up in an organism faster than it can be removed',
      'Algae spreading over a lake',
      'Plants absorbing sunlight',
    ],
    answer: 1,
    explanation: 'Persistent substances such as mercury and some pesticides are stored in body tissue instead of being excreted, so levels rise over an animal’s lifetime.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does a fish-eating bird have much more mercury in its body than the water around it?',
    options: [
      'It drinks more water',
      'Mercury becomes more concentrated at each step up the food chain (biomagnification)',
      'Birds make mercury',
      'Mercury falls from the sky onto birds',
    ],
    answer: 1,
    explanation: 'Each animal eats many organisms from the level below, keeping their mercury. Concentrations multiply at every level: the bars in the simulator use a log scale for this reason.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Stop the mercury in the simulator. Why does the level in large fish fall only slowly?',
    options: [
      'Mercury is not toxic',
      'Large, long-lived fish lose mercury very slowly, and the lake still contains some',
      'The factory keeps polluting secretly',
      'Fish make more mercury',
    ],
    answer: 1,
    explanation: 'This is why fish advisories can last years after a pollution source is cleaned up.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which action would best reduce eutrophication in a lake next to farmland?',
    options: [
      'Adding more fish',
      'Using less fertiliser and planting buffer strips of vegetation along the banks',
      'Painting the factory',
      'Heating the water',
    ],
    answer: 1,
    explanation: 'Buffer strips and wetlands trap nutrients before they reach the water; careful fertiliser use stops the excess in the first place.',
    difficulty: 'Basic',
  },
  {
    question: 'In the 1950s, people in Minamata, Japan, were poisoned by eating fish. What was the cause?',
    options: ['Oil spills', 'Mercury released by a factory that built up in seafood', 'Algal toxins', 'Radioactive waste'],
    answer: 1,
    explanation: 'Methylmercury from a chemical factory biomagnified in fish and shellfish, causing severe neurological disease. It led to an international treaty, the Minamata Convention (2013).',
    difficulty: 'Advanced',
  },
];
