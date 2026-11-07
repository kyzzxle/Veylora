import type { QuizQuestion } from '../quiz-types';

export const weatheringErosionQuiz: QuizQuestion[] = [
  {
    question: 'What is the difference between weathering and erosion?',
    options: [
      'Weathering moves rock; erosion breaks it down',
      'They are two names for the same process',
      'Weathering breaks rock down in place; erosion removes and carries the pieces away',
      'Weathering only happens underwater',
    ],
    answer: 2,
    explanation: 'Weathering happens where the rock is. Erosion is the removal and transport of the weathered material by water, wind, ice or gravity.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does freeze–thaw weathering work best where temperatures often cross 0 °C?',
    options: [
      'Water expands by about 9% when it freezes, and each freeze widens cracks a little more',
      'Ice is heavier than rock',
      'Cold air dissolves rock',
      'Snow reflects sunlight onto the rock',
    ],
    answer: 0,
    explanation: 'Repeated cycles of freezing and thawing prise rock apart. If it stays frozen all the time, or never freezes, there are few cycles.',
    difficulty: 'Basic',
  },
  {
    question: 'Which rock is most affected by dissolution in slightly acidic rainwater?',
    options: ['Granite', 'Basalt', 'Quartz sandstone', 'Limestone'],
    answer: 3,
    explanation: 'Limestone is calcium carbonate, which reacts with the weak carbonic acid in rain. This forms caves, sinkholes and karst landscapes.',
    difficulty: 'Basic',
  },
  {
    question: 'Rusty red-brown stains on a rock rich in iron minerals are a sign of which process?',
    options: ['Freeze–thaw', 'Oxidation', 'Abrasion', 'Root wedging'],
    answer: 1,
    explanation: 'Oxidation is chemical weathering: iron in minerals reacts with oxygen and water to form iron oxides, which weakens the rock.',
    difficulty: 'Basic',
  },
  {
    question: 'In the erosion view, which change reduces soil loss the most on a slope in heavy rain?',
    options: [
      'Increasing the slope',
      'Removing the plants',
      'Increasing the vegetation cover',
      'Making the rain heavier',
    ],
    answer: 2,
    explanation: 'Plants intercept raindrops, slow runoff and bind soil with their roots. Bare, steep slopes in heavy rain lose soil fastest.',
    difficulty: 'Intermediate',
  },
  {
    question: 'According to the Hjulström curve, why is fine sand (about 0.2–0.5 mm) easier for a river to erode than clay?',
    options: [
      'Clay particles stick together, so a faster flow is needed to lift them',
      'Clay is heavier than sand',
      'Sand dissolves in water',
      'Clay only moves in wind',
    ],
    answer: 0,
    explanation: 'Tiny clay and silt particles are cohesive and lie in a smooth bed, so they need faster water to be picked up, even though once lifted they stay in suspension for a long time.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does wind usually move sand-sized grains?',
    options: ['High in suspension for thousands of kilometres', 'By bouncing along the ground (saltation)', 'Only by dissolving them', 'It cannot move sand'],
    answer: 1,
    explanation: 'Sand hops in low arcs close to the ground. Fine dust is carried in suspension; coarser grains roll and slide (creep).',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where does a meandering river erode, and where does it deposit sediment?',
    options: [
      'It erodes the inside of bends and deposits on the outside',
      'It erodes and deposits evenly everywhere',
      'It only deposits at its source',
      'It erodes the outside of bends and deposits point bars on the inside',
    ],
    answer: 3,
    explanation: 'The fastest water swings to the outside of a bend, cutting the bank. On the inside the flow slows and drops sand, so the bends grow until a neck is cut through, leaving an oxbow lake.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A valley has a broad, flat floor and steep, straight sides. Which agent most likely carved it?',
    options: ['A small river', 'Wind', 'A glacier', 'Rain splash'],
    answer: 2,
    explanation: 'Glaciers erode the whole valley floor and sides by plucking and abrasion, leaving a U shape. Rivers cut down into their beds, making V-shaped valleys.',
    difficulty: 'Basic',
  },
  {
    question: 'In the gravity model, a saturated slope with no roots fails, but the same slope stays put when dry. Why?',
    options: [
      'Water in the soil pushes the grains apart and reduces friction, lowering the factor of safety',
      'Water makes the soil lighter',
      'Dry soil has more gravity',
      'Roots make the soil heavier',
    ],
    answer: 0,
    explanation: 'Water pressure in the pores reduces the friction between grains, and roots add cohesion. When the resisting forces fall below the pull of gravity down the slope (factor of safety below 1), a landslide occurs.',
    difficulty: 'Advanced',
  },
];
