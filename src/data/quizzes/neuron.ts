import type { QuizQuestion } from '../quiz-types';

export const neuronQuiz: QuizQuestion[] = [
  {
    question: 'What is the typical resting membrane potential of a neuron?',
    options: ['About +40 mV', 'About 0 mV', 'About −70 mV', 'About −200 mV'],
    answer: 2,
    explanation: 'At rest, the inside of a neuron is negative compared with the outside — about −65 to −70 mV. The simulator uses −65 mV, the value in the classic Hodgkin–Huxley model.',
    difficulty: 'Basic',
  },
  {
    question: 'Which ions rush into the neuron during the rising phase (depolarization) of an action potential?',
    options: ['Potassium (K⁺)', 'Sodium (Na⁺)', 'Chloride (Cl⁻)', 'Calcium in the axon'],
    answer: 1,
    explanation: 'Voltage-gated sodium channels open, and Na⁺ flows in down its concentration gradient, making the inside positive. Watch the orange channels open first.',
    difficulty: 'Basic',
  },
  {
    question: 'What does “all-or-none” mean for an action potential?',
    options: [
      'A bigger stimulus makes a bigger spike',
      'Once threshold is reached, a full-size spike fires; below threshold, no spike fires',
      'All neurons fire at once',
      'Every stimulus produces a spike',
    ],
    answer: 1,
    explanation:
      'Spikes have the same size whatever the stimulus strength, as long as threshold is reached. The nervous system encodes stronger stimuli by firing spikes more often — try a steady current at different strengths.',
    difficulty: 'Basic',
  },
  {
    question: 'What causes the repolarization (falling phase) of the action potential?',
    options: [
      'Na⁺ channels opening wider',
      'Na⁺ channels inactivating and K⁺ channels opening, so K⁺ flows out',
      'The sodium–potassium pump working instantly',
      'Chloride rushing in',
    ],
    answer: 1,
    explanation:
      'Sodium channels close (inactivate) on their own, while slower potassium channels open. K⁺ leaving the cell makes the inside negative again. Block K⁺ channels with TEA and see how the spike becomes much longer.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why can’t a second action potential be triggered immediately after the first?',
    options: [
      'The neuron has run out of sodium',
      'During the refractory period, Na⁺ channels are inactivated and K⁺ channels are still open',
      'The axon is too hot',
      'Neurons can only fire once',
    ],
    answer: 1,
    explanation:
      'In the absolute refractory period, inactivated Na⁺ channels cannot reopen. In the relative refractory period, a stronger-than-normal stimulus is needed. This is also why signals travel in only one direction along the axon.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Tetrodotoxin (TTX), found in puffer fish, blocks voltage-gated Na⁺ channels. What does it do to action potentials?',
    options: ['Makes them larger', 'Prevents them from firing', 'Makes them faster', 'Has no effect'],
    answer: 1,
    explanation:
      'Without Na⁺ channels, the rising phase cannot happen, so no action potential fires however strong the stimulus. This is why TTX is extremely dangerous — it can stop the nerves that control breathing.',
    difficulty: 'Advanced',
  },
  {
    question: 'How does myelin speed up the signal?',
    options: [
      'It adds more sodium channels everywhere',
      'It insulates the axon so the signal jumps between gaps (nodes of Ranvier) — saltatory conduction',
      'It makes the axon shorter',
      'It raises the resting potential',
    ],
    answer: 1,
    explanation:
      'Myelin prevents current leaking out, so the electrical signal spreads quickly under the insulated sections and only needs to regenerate at the nodes. Myelinated axons can conduct at up to about 100 m/s, compared with around 1 m/s for thin unmyelinated ones.',
    difficulty: 'Advanced',
  },
];
