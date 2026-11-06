import type { QuizQuestion } from '../quiz-types';

export const gasExchangeQuiz: QuizQuestion[] = [
  {
    question: 'How do oxygen and carbon dioxide cross a respiratory surface?',
    options: [
      'By active transport, using energy',
      'By diffusion, moving from where their concentration (partial pressure) is higher to where it is lower',
      'By being pumped by the heart',
      'By osmosis',
    ],
    answer: 1,
    explanation: 'Gas exchange is passive diffusion. Oxygen moves from the water or air into the blood, and carbon dioxide moves the other way, each down its own gradient.',
    difficulty: 'Basic',
  },
  {
    question: 'Which combination makes a respiratory surface most efficient?',
    options: [
      'Small area, thick barrier, dry surface',
      'Large area, thin barrier, moist surface, and a steep gradient kept up by breathing and blood flow',
      'Large area and thick barrier',
      'Any surface works equally well',
    ],
    answer: 1,
    explanation: 'Fick’s law: rate ∝ area × gradient ÷ thickness. Gases also have to dissolve in a thin film of water before they can diffuse into cells, so the surface must stay moist.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, what happens to a mammal’s blood oxygen during exercise if the barrier is made three times thicker?',
    options: [
      'Nothing changes',
      'Blood leaves the lungs less oxygenated, because it rushes through the capillaries before enough oxygen can diffuse across',
      'Blood picks up more oxygen',
      'The lungs stop working completely',
    ],
    answer: 1,
    explanation: 'At rest there is time to spare, so even a thicker barrier lets blood reach equilibrium. In exercise, blood passes through about three times faster, and a thick barrier (as in some lung diseases) can no longer keep up.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why is countercurrent flow in fish gills so effective?',
    options: [
      'Water flows faster than blood',
      'Water and blood flow in opposite directions, so blood always meets water with slightly more oxygen than itself, keeping a gradient along the whole gill',
      'Blood and water mix together',
      'The water is warmer than the blood',
    ],
    answer: 1,
    explanation: 'In the simulator, countercurrent flow removes about 84% of the oxygen from the water; parallel flow only about 69%, because the two streams soon reach the same level and exchange stops.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do fish need such efficient gills compared with air-breathing animals?',
    options: [
      'Fish are warm-blooded',
      'Water holds about 30 times less oxygen than air, and it is dense and viscous, so moving it over the gills costs a lot of energy',
      'Water contains no oxygen',
      'Fish are larger than land animals',
    ],
    answer: 1,
    explanation: 'A litre of air contains about 210 mL of oxygen; a litre of water only about 5–10 mL, and less when it is warm. Oxygen also diffuses about 10,000 times more slowly in water than in air.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does oxygen reach an insect’s flight muscles?',
    options: [
      'Through the hemolymph, like blood',
      'Through air-filled tubes (tracheae) that run from spiracles in the body wall and branch into tiny tracheoles right beside the cells',
      'Through gills on the legs',
      'Through the mouth and gut',
    ],
    answer: 1,
    explanation: 'The tracheal system delivers oxygen directly to the tissues, independently of the circulatory system. That is why insect hemolymph carries little oxygen.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, a very large insect cannot supply its flight muscles with oxygen. Why does body size matter so much for insects?',
    options: [
      'Big insects have fewer spiracles',
      'Insects rely partly on diffusion along their air tubes, and diffusion becomes very slow over longer distances',
      'Big insects need less oxygen',
      'Large insects cannot fly',
    ],
    answer: 1,
    explanation: 'Diffusion is fast only over short distances. Pumping helps, but it limits insect size. When air contained more oxygen, around 300 million years ago, giant insects such as dragonfly relatives with wingspans of about 70 cm existed.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why do insects close their spiracles when they can?',
    options: [
      'To keep out light',
      'To reduce water loss: an open, moist respiratory surface lets water evaporate',
      'To stop carbon dioxide leaving',
      'To make sound',
    ],
    answer: 1,
    explanation: 'Every air-breathing animal faces the same trade-off: a respiratory surface must be moist, and moist surfaces lose water to dry air. Lungs and tracheae are internal for this reason.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which feature of mammalian lungs gives them a very large surface area?',
    options: [
      'A single large air sac',
      'Hundreds of millions of tiny alveoli at the ends of branching airways, together about 70 m² in an adult human',
      'Gill filaments',
      'Thick muscular walls',
    ],
    answer: 1,
    explanation: 'Each alveolus is wrapped in capillaries, with only about half a micrometre of tissue between air and blood.',
    difficulty: 'Basic',
  },
  {
    question: 'Mammals breathe tidally (air flows in and out the same way). What is one consequence?',
    options: [
      'Air in the alveoli is always completely fresh',
      'Some stale air always remains in the lungs, so alveolar air has less oxygen than outside air (about 100 mmHg compared with about 160 mmHg)',
      'Mammals cannot exhale carbon dioxide',
      'Blood flows in the same direction as the air',
    ],
    answer: 1,
    explanation: 'Fresh air mixes with air left over from the last breath. Birds avoid this with a one-way flow of air through their lungs, driven by air sacs, which helps them breathe at high altitudes.',
    difficulty: 'Advanced',
  },
];
