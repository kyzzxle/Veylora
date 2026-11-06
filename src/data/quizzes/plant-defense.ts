import type { QuizQuestion } from '../quiz-types';

export const plantDefenseQuiz: QuizQuestion[] = [
  {
    question: 'Which of these is a chemical defense rather than a physical one?',
    options: ['A waxy cuticle', 'Thorns on a hawthorn', 'Nicotine in tobacco leaves', 'Cork in bark'],
    answer: 2,
    explanation: 'Nicotine is a toxic alkaloid, a chemical defense. The cuticle, thorns and cork are physical structures.',
    difficulty: 'Basic',
  },
  {
    question: 'A rose has prickles, a cactus has spines and a hawthorn has thorns. How do they differ?',
    options: [
      'They are three names for the same structure',
      'Prickles grow from the epidermis, spines are modified leaves and thorns are modified shoots',
      'Spines are modified roots',
      'Thorns are made of dead hairs',
    ],
    answer: 1,
    explanation: 'All three deter large animals, but they develop from different organs.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How do most bacteria get inside a leaf?',
    options: [
      'Through open stomata or wounds',
      'By dissolving the cuticle',
      'By swimming through the cell walls',
      'They are carried in by the roots',
    ],
    answer: 0,
    explanation: 'Bacteria cannot cross the cuticle. In the simulator, closing the stomata during PTI leaves them stranded on the surface.',
    difficulty: 'Basic',
  },
  {
    question: 'What do pattern recognition receptors (PRRs) detect?',
    options: [
      'Effector proteins injected by adapted pathogens',
      'Molecules shared by whole groups of microbes, such as bacterial flagellin or fungal chitin (PAMPs)',
      'Antibodies made by the plant',
      'Light and gravity',
    ],
    answer: 1,
    explanation: 'PRRs on the cell surface recognise PAMPs and trigger pattern-triggered immunity (PTI).',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is closing the stomata part of pattern-triggered immunity?',
    options: [
      'It saves water during infection',
      'It stops photosynthesis so the pathogen starves',
      'It makes the leaf heavier',
      'Stomata are a main entry route for bacteria, so closing them keeps more out',
    ],
    answer: 3,
    explanation: 'Stomatal closure is one of the first PTI responses. Some bacteria fight back with effectors such as coronatine that reopen them.',
    difficulty: 'Intermediate',
  },
  {
    question: 'An adapted pathogen injects effectors that suppress PTI. What allows the plant to resist it anyway?',
    options: [
      'A resistance (R) protein that recognises the effector and triggers effector-triggered immunity (ETI)',
      'Antibodies against the effector',
      'Growing more trichomes',
      'Closing its roots',
    ],
    answer: 0,
    explanation: 'This is the gene-for-gene relationship: an R gene matching one of the pathogen’s effectors turns the effector into an alarm signal.',
    difficulty: 'Advanced',
  },
  {
    question: 'What is the hypersensitive response?',
    options: [
      'An allergy the plant develops to pollen',
      'Rapid wilting of the whole plant',
      'Rapid, deliberate death of cells around an infection site, which walls the pathogen off',
      'Faster growth after an attack',
    ],
    answer: 2,
    explanation: 'Sacrificing a few cells deprives the pathogen of living tissue. It is often triggered by ETI.',
    difficulty: 'Intermediate',
  },
  {
    question: 'After one leaf fights off an infection, distant leaves become more resistant for weeks. What is this called, and which signal is central to it?',
    options: [
      'Apical dominance, auxin',
      'Systemic acquired resistance (SAR), salicylic acid',
      'Systemic wound response, gibberellin',
      'Adaptive immunity, antibodies',
    ],
    answer: 1,
    explanation: 'Salicylic acid and mobile signals prime distant leaves to respond faster and more strongly.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A caterpillar chews one leaf of a tomato plant. Which response is expected?',
    options: [
      'Jasmonate signalling makes toxins and proteinase inhibitors build up in the damaged leaf and then in other leaves',
      'The hypersensitive response kills the whole leaf at once',
      'The plant makes antibodies against the caterpillar',
      'Nothing: plants cannot detect insects',
    ],
    answer: 0,
    explanation: 'Wounding triggers the jasmonic acid pathway and a systemic wound response. In the simulator, turning jasmonate signalling off removes this induced defense.',
    difficulty: 'Basic',
  },
  {
    question: 'How do volatiles released by caterpillar-damaged leaves help the plant?',
    options: [
      'They poison the caterpillar directly',
      'They make the leaves taste sweeter',
      'They close the stomata',
      'They attract predators and parasitic wasps that attack the caterpillars',
    ],
    answer: 3,
    explanation: 'This is an indirect defense: the plant recruits the herbivore’s natural enemies.',
    difficulty: 'Intermediate',
  },
];
