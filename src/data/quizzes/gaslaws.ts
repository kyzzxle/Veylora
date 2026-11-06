import type { QuizQuestion } from '../quiz-types';

export const gasLawsQuiz: QuizQuestion[] = [
  {
    question: 'According to the particle model, what causes gas pressure?',
    options: [
      'The weight of the gas particles resting on the bottom',
      'Particles colliding with the walls of the container, each collision pushing on the wall',
      'Particles repelling each other',
      'Heat flowing out of the gas',
    ],
    answer: 1,
    explanation: 'Each bounce exerts a tiny force on the wall. Billions of collisions per second add up to a steady push per unit area: the pressure. The flashes on the cylinder walls show these collisions.',
    difficulty: 'Basic',
  },
  {
    question: 'In the Boyle’s law investigation, which quantities are held constant?',
    options: ['Pressure and volume', 'Temperature and the amount of gas', 'Volume and temperature', 'Pressure and the amount of gas'],
    answer: 1,
    explanation: 'Boyle’s law relates pressure and volume, so only those two may change. The heater keeps the temperature fixed and the cylinder is sealed, so the amount of gas cannot change.',
    difficulty: 'Basic',
  },
  {
    question: 'A sealed syringe holds 4.0 L of gas at 100 kPa. At constant temperature, it is squeezed to 2.0 L. What is the new pressure?',
    options: ['50 kPa', '100 kPa', '200 kPa', '400 kPa'],
    answer: 2,
    explanation: 'Boyle’s law: P₁V₁ = P₂V₂, so P₂ = 100 × 4.0 ÷ 2.0 = 200 kPa. Halving the volume doubles how often particles hit each part of the wall.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why must temperatures be in kelvin when using the gas laws?',
    options: [
      'Kelvin numbers are bigger, so the answers are more accurate',
      'Because pressure and volume are proportional to the absolute temperature, which starts at absolute zero (0 K), not at the freezing point of water',
      'It is just a convention with no effect on the answer',
      'Celsius cannot be used for gases',
    ],
    answer: 1,
    explanation: 'Doubling the temperature from 20 °C to 40 °C does not double the particles’ energy: in kelvin it goes from 293 K to 313 K, an increase of only about 7%. Only the kelvin scale is proportional to the particles’ average kinetic energy.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the Charles’s law investigation, the gas is heated. Why does the piston rise?',
    options: [
      'Hot gas particles get bigger',
      'Faster particles push harder on the free piston, so it moves up until the pressure inside again matches the constant pressure outside',
      'Heat is lighter than air',
      'The number of particles increases',
    ],
    answer: 1,
    explanation: 'The particles stay the same size and number. Faster particles hit the piston harder and more often; the piston rises until the larger volume brings the pressure back down to match the outside pressure.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A gas at constant pressure occupies 3.0 L at 300 K. What volume does it occupy at 450 K?',
    options: ['2.0 L', '3.0 L', '4.5 L', '9.0 L'],
    answer: 2,
    explanation: 'Charles’s law: V₁/T₁ = V₂/T₂, so V₂ = 3.0 × 450 ÷ 300 = 4.5 L.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the pressure–temperature investigation, the piston is locked. The kelvin temperature is doubled. What happens to the pressure?',
    options: ['It halves', 'It stays the same', 'It doubles', 'It increases four times'],
    answer: 2,
    explanation: 'At constant volume and amount, P/T is constant, so doubling the kelvin temperature doubles the pressure. The average particle speed rises by about √2, making each collision harder and collisions more frequent.',
    difficulty: 'Basic',
  },
  {
    question: 'If the straight line on a pressure–temperature or volume–temperature graph is extended backwards, where does it reach zero?',
    options: ['At 0 °C', 'At −100 °C', 'At about −273 °C (0 K, absolute zero)', 'It never reaches zero'],
    answer: 2,
    explanation: 'Extrapolating gas-law data led scientists to absolute zero, −273.15 °C. Real gases condense to liquids long before reaching it, so the line is an extrapolation, not a measurement.',
    difficulty: 'Advanced',
  },
  {
    question: 'Using PV = nRT, what is the pressure of 0.20 mol of gas in 2.5 L at 300 K? (R = 8.314 J/(mol·K); 1 L = 0.001 m³)',
    options: ['About 20 kPa', 'About 200 kPa', 'About 2,000 kPa', 'About 0.2 kPa'],
    answer: 1,
    explanation: 'P = nRT/V = 0.20 × 8.314 × 300 ÷ 0.0025 ≈ 200,000 Pa = 200 kPa, about twice normal air pressure. This is the simulator’s starting state.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which statement about the simulator’s gas is correct?',
    options: [
      'It behaves exactly like any real gas under all conditions',
      'It is an ideal gas: its particles take up no space and do not attract each other, so it obeys PV = nRT; real gases deviate at high pressure and low temperature',
      'Its particles are drawn to scale',
      'Its pressure is calculated from PV = nRT and the collisions are just decoration',
    ],
    answer: 1,
    explanation: 'The gauge really is measured from the simulated collisions; the ideal-gas assumptions are what make it agree with PV = nRT. Real particles have size and attract each other, which matters when they are squeezed close together or move slowly.',
    difficulty: 'Advanced',
  },
];
