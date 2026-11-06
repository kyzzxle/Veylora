import type { QuizQuestion } from '../quiz-types';

export const circulationQuiz: QuizQuestion[] = [
  {
    question: 'What is the main difference between an open and a closed circulatory system?',
    options: [
      'Open systems have no heart',
      'In a closed system blood stays inside vessels; in an open system the fluid leaves the vessels and bathes the organs directly in a body cavity',
      'Closed systems only occur in fish',
      'Open systems carry more oxygen',
    ],
    answer: 1,
    explanation: 'In the insect, hemolymph spills out of the dorsal vessel into the hemocoel. In the fish, frog and mammal, blood stays inside arteries, capillaries and veins.',
    difficulty: 'Basic',
  },
  {
    question: 'Which group of animals has an open circulatory system?',
    options: ['Mammals', 'Birds', 'Insects', 'Fish'],
    answer: 2,
    explanation: 'Insects and other arthropods, and most molluscs such as snails and clams, have open systems. Vertebrates, earthworms, and octopuses and squid have closed systems.',
    difficulty: 'Basic',
  },
  {
    question: 'How do insects get oxygen to their cells if their hemolymph carries very little?',
    options: [
      'Through their skin only',
      'Through tracheae: air tubes that run from openings called spiracles right to the cells',
      'Through gills',
      'They do not need oxygen',
    ],
    answer: 1,
    explanation: 'Because the tracheae deliver oxygen directly, an insect’s circulation can be slow and low-pressure. Turn on the tracheae in the simulator to see them.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A fish has single circulation. What does this mean?',
    options: [
      'It has only one blood vessel',
      'Blood passes through the heart once per circuit: heart → gills → body → heart',
      'Its heart has one chamber',
      'It has one circuit for each side of the body',
    ],
    answer: 1,
    explanation: 'After the gills, blood flows straight on to the body without returning to the heart. Follow one blood cell in the fish to see the route.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does blood reach a fish’s body tissues at fairly low pressure?',
    options: [
      'Fish hearts beat backwards',
      'Blood loses much of its pressure squeezing through the narrow gill capillaries before it travels on to the body',
      'Water pushes on the blood vessels',
      'Fish blood is thicker',
    ],
    answer: 1,
    explanation: 'In the comparison chart, the fish’s pressure to the body (≈28 mmHg) is far below the mammal’s (≈93 mmHg). A second pump after the gas exchange organ, as in double circulation, solves this.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In a mammal, what is the advantage of double circulation with a four-chambered heart?',
    options: [
      'Blood never needs to go to the lungs',
      'Oxygen-rich and oxygen-poor blood are kept completely apart, and blood is pumped to the body at high pressure after collecting oxygen',
      'The heart beats more slowly',
      'It needs less blood',
    ],
    answer: 1,
    explanation: 'The right side pumps blood to the lungs at low pressure and the left side pumps it to the body at high pressure. This supports the high oxygen demand of warm-blooded animals.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A frog’s heart has three chambers: two atria and one ventricle. Which statement is accurate?',
    options: [
      'Oxygen-rich and oxygen-poor blood mix completely, so the frog’s body gets half-oxygenated blood',
      'Some mixing occurs, but ridges in the ventricle, timing and a spiral valve send most oxygen-poor blood to the lungs and skin and most oxygen-rich blood to the body',
      'Frogs have single circulation like fish',
      'Frog blood carries no oxygen',
    ],
    answer: 1,
    explanation: 'In the simulator, blood going to a frog’s body is about 89% saturated, a little less than the mammal’s 97%. Frogs also absorb oxygen through their moist skin.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which vessels exchange substances with the body’s cells?',
    options: ['Arteries', 'Veins', 'Capillaries', 'The aorta'],
    answer: 2,
    explanation: 'Capillary walls are only one cell thick and red blood cells pass in single file, so oxygen and nutrients can diffuse out and carbon dioxide and wastes can diffuse in.',
    difficulty: 'Basic',
  },
  {
    question: 'Why do veins have valves while arteries generally do not?',
    options: [
      'Veins carry blood at low pressure, so valves stop it flowing backwards on its way to the heart',
      'Valves add oxygen to the blood',
      'Arteries are too small for valves',
      'Valves make blood flow faster away from the heart',
    ],
    answer: 0,
    explanation: 'By the time blood reaches the veins, most of the pressure from the heart has been used up. Valves, and squeezing muscles around the veins, keep it moving towards the heart.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, increasing the activity level makes blood return to the heart with much less oxygen. Why?',
    options: [
      'The lungs stop working during exercise',
      'Active muscles use more oxygen, so they take more of it from the blood in the body capillaries',
      'Blood loses oxygen in the veins',
      'The heart uses up the oxygen',
    ],
    answer: 1,
    explanation: 'The heart also beats faster, delivering more blood per minute. Together, faster flow and greater oxygen extraction supply the extra oxygen working muscles need.',
    difficulty: 'Intermediate',
  },
];
