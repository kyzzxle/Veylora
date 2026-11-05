import type { QuizQuestion } from '../quiz-types';

export const newtonQuiz: QuizQuestion[] = [
  {
    question: 'A cart is sliding on ice and you stop pushing. According to Newton’s first law, what happens if there is no friction at all?',
    options: ['It stops immediately', 'It slows down gradually', 'It keeps moving at the same velocity', 'It speeds up'],
    answer: 2,
    explanation: 'An object keeps its velocity unless a net force acts on it (inertia). On real ice, a tiny friction force slowly brings it to rest.',
    difficulty: 'Basic',
  },
  {
    question: 'A 10 kg cart experiences a net force of 20 N. What is its acceleration?',
    options: ['0.5 m/s²', '2 m/s²', '30 m/s²', '200 m/s²'],
    answer: 1,
    explanation: 'Newton’s second law: a = F_net / m = 20 N ÷ 10 kg = 2 m/s².',
    difficulty: 'Basic',
  },
  {
    question: 'You push a box with 30 N but it does not move. What is the friction force on it?',
    options: ['0 N', 'Less than 30 N', 'Exactly 30 N, opposite to your push', 'More than 30 N'],
    answer: 2,
    explanation: 'The box does not accelerate, so the net force is zero. Static friction adjusts to exactly cancel your push — up to its maximum value.',
    difficulty: 'Basic',
  },
  {
    question: 'The same push is applied to a 5 kg cart and a 20 kg cart on the same surface. Which accelerates more?',
    options: ['The 20 kg cart', 'The 5 kg cart', 'Both the same', 'Neither moves'],
    answer: 1,
    explanation: 'For the same net force, acceleration is inversely proportional to mass. Note that the heavier cart also has more friction, which reduces its net force further.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A cart moves at a constant 3 m/s to the right. What is the net force on it?',
    options: ['A force to the right', 'A force to the left', 'Zero', 'It depends on the mass'],
    answer: 2,
    explanation: 'Constant velocity means zero acceleration, so the forces are balanced and the net force is zero. A force is needed to change motion, not to keep it going.',
    difficulty: 'Intermediate',
  },
  {
    question: 'You push a cart with 40 N. According to Newton’s third law, what does the cart do to you?',
    options: ['Nothing', 'Pushes back on you with 40 N in the opposite direction', 'Pushes back with less force because it moves', 'Pulls you forward'],
    answer: 1,
    explanation: 'Forces come in pairs that are equal in size and opposite in direction, acting on different objects. The cart moves because of the forces on the cart — the reaction force acts on you.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A 10 kg cart on wood (μk = 0.2) is pushed with 40 N while moving. Using g = 9.8 m/s², what is its acceleration?',
    options: ['4.0 m/s²', 'About 2.0 m/s²', 'About 0.04 m/s²', '0 m/s²'],
    answer: 1,
    explanation: 'Friction = μk × N = 0.2 × (10 × 9.8) ≈ 19.6 N. Net force = 40 − 19.6 ≈ 20.4 N. a = 20.4 ÷ 10 ≈ 2.0 m/s².',
    difficulty: 'Advanced',
  },
];
