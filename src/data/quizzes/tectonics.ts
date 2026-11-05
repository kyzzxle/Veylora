import type { QuizQuestion } from '../quiz-types';

export const tectonicsQuiz: QuizQuestion[] = [
  {
    question: 'What happens at a divergent plate boundary?',
    options: ['Plates move towards each other', 'Plates move apart and new crust forms', 'Plates slide past each other', 'One plate melts completely'],
    answer: 1,
    explanation: 'At divergent boundaries such as mid-ocean ridges, magma rises to fill the gap and forms new oceanic crust.',
    difficulty: 'Basic',
  },
  {
    question: 'Which type of boundary formed the Himalayas?',
    options: ['Divergent', 'Transform', 'Continent–continent collision', 'Ocean–ocean subduction'],
    answer: 2,
    explanation: 'India’s continental crust is colliding with Asia. Neither continent sinks, so the crust crumples upward into the highest mountains on Earth.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does the ocean plate sink beneath the continent at a subduction zone?',
    options: ['It is thicker', 'Oceanic crust is denser than continental crust', 'It is hotter', 'The continent pushes it down with its weight'],
    answer: 1,
    explanation: 'Oceanic lithosphere is made of dense basalt and gets colder and denser with age, so it sinks into the mantle.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What drives the plates to move?',
    options: [
      'The Moon’s gravity',
      'Heat from Earth’s interior, causing mantle convection, together with the pull of sinking slabs',
      'Ocean currents',
      'Earth’s spin',
    ],
    answer: 1,
    explanation: 'Heat escaping from the interior keeps the mantle slowly flowing. The weight of slabs sinking at subduction zones (slab pull) is thought to be the biggest single force.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why are there symmetrical magnetic stripes on both sides of a mid-ocean ridge?',
    options: [
      'Different minerals are deposited by currents',
      'New rock records Earth’s magnetic field as it cools, and the field reverses from time to time',
      'Earthquakes magnetise the rock',
      'Iron sinks to the bottom',
    ],
    answer: 1,
    explanation: 'As new crust spreads away on both sides, each reversal leaves matching stripes. This was key evidence for sea-floor spreading in the 1960s.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the transform fault view, why does an earthquake happen suddenly rather than the plates sliding smoothly?',
    options: [
      'The plates stop moving',
      'Friction locks the fault, strain builds up, and it is released all at once when the rocks slip',
      'Magma pushes the rocks apart',
      'The fault opens up',
    ],
    answer: 1,
    explanation: 'This is elastic rebound: rocks bend while the fault is stuck, then snap back during the earthquake.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A plate moves 5 cm per year. How far does it move in 1 million years?',
    options: ['5 m', '500 m', '50 km', '5,000 km'],
    answer: 2,
    explanation: '5 cm × 1,000,000 = 5,000,000 cm = 50 km. Over 100 million years that becomes 5,000 km: enough to open an ocean.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where are the deepest earthquakes found?',
    options: ['At mid-ocean ridges', 'Along subducting slabs at ocean–continent boundaries', 'At transform faults', 'In the middle of plates'],
    answer: 1,
    explanation: 'Earthquakes follow the sinking slab down to about 700 km. Ridges and transform faults have only shallow earthquakes.',
    difficulty: 'Advanced',
  },
];
