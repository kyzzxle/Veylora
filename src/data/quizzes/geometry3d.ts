import type { QuizQuestion } from '../quiz-types';

export const geometry3dQuiz: QuizQuestion[] = [
  {
    question: 'What is the volume of a cube with sides of 4 cm?',
    options: ['16 cm³', '48 cm³', '64 cm³', '96 cm³'],
    answer: 2,
    explanation: 'V = a³ = 4 × 4 × 4 = 64 cm³. (96 cm² is its surface area: 6 × 4².)',
    difficulty: 'Basic',
  },
  {
    question: 'How many faces, edges and vertices does a square-based pyramid have?',
    options: ['4, 6, 4', '5, 8, 5', '6, 12, 8', '5, 9, 6'],
    answer: 1,
    explanation: 'A square base plus 4 triangles = 5 faces; 4 base edges + 4 sloping edges = 8; 4 base corners + 1 apex = 5 vertices.',
    difficulty: 'Basic',
  },
  {
    question: 'Euler’s formula for polyhedra says F − E + V = ?',
    options: ['0', '1', '2', 'It depends on the shape'],
    answer: 2,
    explanation: 'For any convex polyhedron, faces − edges + vertices = 2. Check it with every flat-faced shape in the simulator.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A cone and a cylinder have the same radius and height. How do their volumes compare?',
    options: ['They are equal', 'The cone is half the cylinder', 'The cone is one third of the cylinder', 'The cone is twice the cylinder'],
    answer: 2,
    explanation: 'V(cone) = ⅓πr²h and V(cylinder) = πr²h, so three cones fill one cylinder.',
    difficulty: 'Intermediate',
  },
  {
    question: 'If you double every length of a shape, what happens to its volume?',
    options: ['It doubles', 'It becomes 4 times bigger', 'It becomes 8 times bigger', 'It stays the same'],
    answer: 2,
    explanation: 'Volume scales with the cube of the scale factor: 2³ = 8. Surface area scales with the square: 2² = 4.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Slice a cone parallel to its base. What shape is the cross-section?',
    options: ['A triangle', 'A circle', 'A square', 'An ellipse that gets bigger towards the top'],
    answer: 1,
    explanation: 'Horizontal slices of a cone are circles, getting smaller towards the apex. A slice through the apex and the base would be a triangle.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the surface area of a sphere with radius 3 cm (to the nearest whole number)?',
    options: ['28 cm²', '57 cm²', '113 cm²', '339 cm²'],
    answer: 2,
    explanation: 'A = 4πr² = 4 × π × 9 ≈ 113 cm². Its volume is ⁴⁄₃π × 27 ≈ 113 cm³ too: a coincidence that happens only when r = 3.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Look at the surface area : volume readout as you make a shape bigger. Why do small animals lose heat faster than large ones?',
    options: [
      'Small animals have thinner fur',
      'Smaller objects have more surface area for each unit of volume, so heat escapes faster relative to their size',
      'Large animals are always warmer',
      'Volume and surface area grow at the same rate',
    ],
    answer: 1,
    explanation: 'Surface area grows as length² but volume as length³, so the ratio falls as size increases. This principle applies to cells, animals and buildings.',
    difficulty: 'Advanced',
  },
];
