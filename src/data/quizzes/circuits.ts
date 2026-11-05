import type { QuizQuestion } from '../quiz-types';

export const circuitsQuiz: QuizQuestion[] = [
  {
    question: 'A 12 V battery is connected to a single 6 Ω bulb. What current flows?',
    options: ['0.5 A', '2 A', '18 A', '72 A'],
    answer: 1,
    explanation: 'Ohm’s law: I = V / R = 12 V ÷ 6 Ω = 2 A.',
    difficulty: 'Basic',
  },
  {
    question: 'In a series circuit, one bulb breaks (or its switch opens). What happens to the other bulbs?',
    options: ['They get brighter', 'They stay the same', 'They all go out', 'Only the next bulb goes out'],
    answer: 2,
    explanation: 'A series circuit has only one path. Breaking it anywhere stops the current everywhere. Open any switch in the series view to see this.',
    difficulty: 'Basic',
  },
  {
    question: 'Why are the lights in a house wired in parallel rather than in series?',
    options: [
      'It uses less wire',
      'Each light gets the full voltage and can be switched on or off independently',
      'Parallel circuits use no electricity',
      'Series circuits are illegal',
    ],
    answer: 1,
    explanation: 'In parallel, every branch is connected directly across the supply, so each gets the full voltage and one switch does not affect the others.',
    difficulty: 'Basic',
  },
  {
    question: 'Three 10 Ω bulbs are connected in series to a 12 V battery. What is the voltage across each bulb?',
    options: ['12 V', '4 V', '36 V', '1.2 V'],
    answer: 1,
    explanation: 'Total resistance is 30 Ω, so I = 12 ÷ 30 = 0.4 A. Each bulb has V = I × R = 0.4 × 10 = 4 V. In series, the battery voltage is shared.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The same three 10 Ω bulbs are connected in parallel to 12 V. What is the total current from the battery?',
    options: ['0.4 A', '1.2 A', '3.6 A', '12 A'],
    answer: 2,
    explanation: 'Each branch gets 12 V, so each carries 12 ÷ 10 = 1.2 A. The battery supplies the total: 3 × 1.2 = 3.6 A. Total resistance is 10 ÷ 3 ≈ 3.3 Ω.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Adding another bulb in parallel does what to the total resistance of the circuit?',
    options: ['Increases it', 'Decreases it', 'Leaves it the same', 'Makes it infinite'],
    answer: 1,
    explanation: 'Each new branch gives the current another path, so the total resistance falls and the battery supplies more current. That is why overloading a household circuit can trip a breaker.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the series circuit, bulb 1 has 30 Ω and bulbs 2 and 3 have 10 Ω each. Which bulb glows brightest?',
    options: ['Bulb 1', 'Bulbs 2 and 3', 'All equally', 'None of them'],
    answer: 0,
    explanation: 'In series the current is the same in every bulb, so power P = I² × R is largest for the largest resistance. (In parallel, the opposite is true: the smallest resistance gets the most power.)',
    difficulty: 'Advanced',
  },
];
