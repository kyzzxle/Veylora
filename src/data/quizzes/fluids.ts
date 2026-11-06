import type { QuizQuestion } from '../quiz-types';

export const fluidsQuiz: QuizQuestion[] = [
  {
    question: 'What is the gauge pressure 0.5 m below the surface of fresh water (ρ = 1000 kg/m³, g = 9.81 m/s²)?',
    options: ['0.5 kPa', '4.9 kPa', '49 kPa', '101.3 kPa'],
    answer: 1,
    explanation: 'p = ρgh = 1000 × 9.81 × 0.5 = 4905 Pa ≈ 4.9 kPa. Measure it with the probe.',
    difficulty: 'Basic',
  },
  {
    question: 'At that depth, what is the absolute pressure?',
    options: ['4.9 kPa', 'About 96.4 kPa', 'About 106.2 kPa', 'About 202.6 kPa'],
    answer: 2,
    explanation: 'Absolute pressure includes the atmosphere pressing on the surface: p = p₀ + ρgh = 101.3 + 4.9 ≈ 106.2 kPa. Gauge pressure leaves out the atmospheric part.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Roughly how far below the surface of water does the pressure increase by one atmosphere (about 100 kPa)?',
    options: ['1 m', 'About 10 m', 'About 100 m', 'About 1 km'],
    answer: 1,
    explanation: 'ρgh = 100 000 Pa gives h = 100 000 ÷ (1000 × 9.81) ≈ 10 m. A diver at 10 m feels about twice the pressure at the surface.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What does Archimedes’ principle state?',
    options: [
      'The buoyant force equals the weight of the object',
      'The buoyant force equals the weight of the fluid the object displaces',
      'Heavy objects always sink',
      'Pressure is the same at all depths',
    ],
    answer: 1,
    explanation: 'B = ρ_fluid g V_displaced. It only equals the object’s weight when the object is floating.',
    difficulty: 'Basic',
  },
  {
    question: 'Why is there an upward buoyant force on a submerged object?',
    options: [
      'Water attracts objects upwards',
      'The pressure on its bottom is greater than the pressure on its top, because the bottom is deeper',
      'Objects become lighter in water',
      'The sideways pressures push it up',
    ],
    answer: 1,
    explanation: 'Pressure increases with depth. The arrows on the objects show the bigger push on the lower surfaces; the sideways pushes cancel, leaving a net upward force.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A 1 L wooden block with density 500 kg/m³ floats in fresh water. What fraction of it is below the surface?',
    options: ['All of it', 'Half', 'A quarter', 'None'],
    answer: 1,
    explanation: 'A floating object displaces its own weight of fluid, so the fraction submerged is ρ_object ÷ ρ_fluid = 500 ÷ 1000 = 0.5.',
    difficulty: 'Basic',
  },
  {
    question: 'Ice (917 kg/m³) floats in sea water (1025 kg/m³). About what fraction of an iceberg is under water?',
    options: ['About 10%', 'About 50%', 'About 89%', '100%'],
    answer: 2,
    explanation: '917 ÷ 1025 ≈ 0.89. That is why only the “tip of the iceberg” shows.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A 1 L aluminium sphere (2700 kg/m³) rests on the bottom of a tank of fresh water. How hard does it press on the floor?',
    options: ['26.5 N, its full weight', 'About 16.7 N', '9.81 N', '0 N'],
    answer: 1,
    explanation: 'W = 2.7 × 9.81 ≈ 26.5 N and B = 1000 × 9.81 × 0.001 ≈ 9.81 N, so the floor supplies 26.5 − 9.81 ≈ 16.7 N. This is its apparent weight in water.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A cube, a sphere and a cylinder all have a volume of 1 L and are fully submerged in water. Which has the largest buoyant force?',
    options: ['The cube', 'The sphere', 'The cylinder', 'They are all the same'],
    answer: 3,
    explanation: 'The buoyant force depends only on the volume of fluid displaced (and the fluid’s density), not on the shape: each experiences 9.81 N.',
    difficulty: 'Basic',
  },
  {
    question: 'An object exactly as dense as the fluid is placed half-way down the tank. What does it do?',
    options: ['Sinks slowly', 'Rises to the surface', 'Stays where it is (neutral buoyancy)', 'Spins'],
    answer: 2,
    explanation: 'When fully submerged its buoyant force equals its weight at any depth. Submarines and fish adjust their average density to hover like this.',
    difficulty: 'Basic',
  },
];
