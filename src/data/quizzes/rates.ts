import type { QuizQuestion } from '../quiz-types';

export const ratesQuiz: QuizQuestion[] = [
  {
    question: 'According to collision theory, what must happen for particles to react?',
    options: [
      'They must simply be in the same container',
      'They must collide with enough energy (at least the activation energy) and the right orientation',
      'They must be heated to boiling',
      'They must be the same colour',
    ],
    answer: 1,
    explanation: 'Most collisions just bounce. Only collisions with energy above the activation energy (and a suitable orientation) break bonds and form products.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does powdered solid react faster than a single lump of the same mass?',
    options: ['Powder is heavier', 'Powder has a much larger surface area exposed to the other reactant', 'Powder is hotter', 'Lumps cannot react at all'],
    answer: 1,
    explanation: 'Only particles on the surface can be hit. Breaking a lump into smaller pieces exposes far more surface, so there are more collisions per second.',
    difficulty: 'Basic',
  },
  {
    question: 'How does increasing concentration affect the rate of reaction?',
    options: ['It decreases the rate', 'It increases the rate, because particles collide more often', 'It has no effect', 'It lowers the activation energy'],
    answer: 1,
    explanation: 'More particles in the same volume means more frequent collisions, and so more successful collisions per second.',
    difficulty: 'Basic',
  },
  {
    question: 'Raising the temperature increases the rate mainly because…',
    options: [
      'particles become bigger',
      'more particles have energy greater than the activation energy, and they collide more often',
      'the activation energy rises',
      'the catalyst is used up',
    ],
    answer: 1,
    explanation:
      'Faster particles collide more often, but the bigger effect is that a much larger fraction of collisions now have enough energy. That is why a 10 °C rise can roughly double the rate of many reactions.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What does a catalyst do?',
    options: [
      'It is used up as the reaction speeds up',
      'It provides an alternative pathway with a lower activation energy and is not used up',
      'It increases the temperature',
      'It increases the amount of product formed in total',
    ],
    answer: 1,
    explanation: 'A catalyst lowers the energy barrier, so more collisions succeed. It is unchanged at the end and does not change how much product can eventually form — only how fast.',
    difficulty: 'Intermediate',
  },
  {
    question: 'On the graph of product formed against time, what does the gradient (steepness) represent?',
    options: ['The total amount of product', 'The rate of reaction at that moment', 'The temperature', 'The activation energy'],
    answer: 1,
    explanation: 'Rate = change in product ÷ change in time, which is the slope of the graph. It is steepest at the start and flattens as reactants are used up.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why does the rate slow down as the reaction proceeds, even at constant temperature?',
    options: [
      'The particles get tired',
      'Reactants are used up, so there are fewer particles to collide',
      'The catalyst stops working',
      'Products block all collisions',
    ],
    answer: 1,
    explanation: 'As reactant particles are converted into products, the concentration of reactants falls and successful collisions become less frequent, so the graph levels off.',
    difficulty: 'Advanced',
  },
];
