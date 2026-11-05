import type { QuizQuestion } from '../quiz-types';

export const respirationQuiz: QuizQuestion[] = [
  {
    question: 'What is the main purpose of cellular respiration?',
    options: [
      'To make glucose from carbon dioxide',
      'To release energy from glucose and store it in ATP that the cell can use',
      'To take oxygen into the lungs',
      'To make proteins',
    ],
    answer: 1,
    explanation: 'Respiration is a chemical process in every living cell. Breathing only supplies the oxygen; respiration transfers energy from glucose into ATP, which powers muscle contraction, active transport, building molecules and more.',
    difficulty: 'Basic',
  },
  {
    question: 'Where in the cell does glycolysis take place?',
    options: ['In the nucleus', 'In the mitochondrial matrix', 'In the cytoplasm', 'On the inner mitochondrial membrane'],
    answer: 2,
    explanation: 'Glycolysis happens in the cytoplasm and does not need oxygen. The link reaction and Krebs cycle happen in the matrix, and the electron transport chain is on the inner membrane.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the role of oxygen in aerobic respiration?',
    options: [
      'It is the final electron acceptor at the end of the electron transport chain, forming water',
      'It is split to release carbon dioxide',
      'It joins glucose at the start of glycolysis',
      'It is turned directly into ATP',
    ],
    answer: 0,
    explanation: 'Without oxygen to accept electrons, the chain stops, NADH cannot be recycled to NAD⁺, and the link reaction and Krebs cycle stop too. In the simulator, setting oxygen to 0% idles the mitochondria.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which stage makes most of the ATP in aerobic respiration?',
    options: ['Glycolysis', 'The link reaction', 'The Krebs cycle', 'The electron transport chain with ATP synthase'],
    answer: 3,
    explanation: 'Glycolysis and the Krebs cycle make only 2 ATP each per glucose. Most ATP (about 26–28) is made by ATP synthase, driven by the H⁺ gradient that the electron transport chain builds.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, oxygen is reduced while an active muscle cell keeps working. What happens?',
    options: [
      'ATP production stops completely',
      'The cell uses glucose much faster, lactate builds up, and each glucose gives far less ATP',
      'The cell makes more ATP per glucose',
      'Nothing changes',
    ],
    answer: 1,
    explanation: 'Anaerobic respiration gives only 2 ATP per glucose instead of about 30–32, so glycolysis must run much faster to try to keep up. The extra pyruvate becomes lactate.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do cells make lactate (or ethanol in yeast) when oxygen is missing?',
    options: [
      'To produce extra ATP',
      'To regenerate NAD⁺ so that glycolysis can continue',
      'To store oxygen',
      'Lactate is the cell’s main fuel',
    ],
    answer: 1,
    explanation: 'Glycolysis needs NAD⁺. Without oxygen, NADH cannot pass its electrons to the transport chain, so fermentation passes them to pyruvate instead, recycling NAD⁺ and keeping the 2 ATP from glycolysis coming.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which word equation correctly summarises aerobic respiration?',
    options: [
      'Carbon dioxide + water → glucose + oxygen',
      'Glucose + oxygen → carbon dioxide + water (+ energy transferred to ATP)',
      'Glucose → lactate (+ energy)',
      'Glucose → ethanol + carbon dioxide',
    ],
    answer: 1,
    explanation: 'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O. The first option is photosynthesis; the last two are anaerobic pathways in animals and yeast.',
    difficulty: 'Basic',
  },
  {
    question: 'Modern estimates say aerobic respiration yields about 30–32 ATP per glucose, while older textbooks say 36–38. Why are these only estimates?',
    options: [
      'Because scientists have never measured ATP',
      'Because some of the H⁺ gradient leaks, and the cost of moving molecules into mitochondria varies, so the yield is not a fixed whole number',
      'Because glucose contains different amounts of energy each time',
      'Because ATP is sometimes made from oxygen directly',
    ],
    answer: 1,
    explanation: 'The amount of ATP per NADH and FADH₂ depends on how many H⁺ ions pass through ATP synthase, membrane leaks and transport costs. The simulator uses a simplified fixed value.',
    difficulty: 'Advanced',
  },
];
