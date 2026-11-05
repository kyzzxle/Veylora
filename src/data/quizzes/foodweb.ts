import type { QuizQuestion } from '../quiz-types';

export const foodWebQuiz: QuizQuestion[] = [
  {
    question: 'What is a producer in a food chain?',
    options: ['An animal that eats plants', 'An organism that makes its own food, usually by photosynthesis', 'A top predator', 'A decomposer'],
    answer: 1,
    explanation: 'Producers such as grass, trees and algae capture the Sun’s energy. Every food chain starts with them.',
    difficulty: 'Basic',
  },
  {
    question: 'In a food web diagram, what does an arrow show?',
    options: ['Which animal is bigger', 'The direction energy flows: from the food to the organism that eats it', 'Where animals migrate', 'Which animal is faster'],
    answer: 1,
    explanation: 'Grass → rabbit → fox means the energy in grass passes to the rabbit, then to the fox.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, remove the wolves. What happens to the deer and the plants?',
    options: [
      'Deer decrease and plants increase',
      'Deer increase and grass and oak trees decrease',
      'Nothing changes',
      'Everything dies',
    ],
    answer: 1,
    explanation: 'Without their predator, deer multiply and eat more plants. A change at the top spreading down the web is called a trophic cascade.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why are there usually far fewer top predators than herbivores?',
    options: [
      'Predators breed more slowly on purpose',
      'Only about 10 % of energy passes from one level to the next, so each level supports less life',
      'Predators eat each other',
      'Herbivores are smaller',
    ],
    answer: 1,
    explanation: 'Most energy is used for movement, warmth and life processes or lost as heat, so energy pyramids narrow rapidly towards the top.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Remove the grasshoppers and caterpillars. Why do the frogs die out but the foxes survive?',
    options: [
      'Frogs are weaker',
      'Frogs eat only insects, while foxes have many other foods to switch to',
      'Foxes eat frogs',
      'Insects were poisonous',
    ],
    answer: 1,
    explanation: 'Specialists that depend on one kind of food are much more vulnerable than generalists with varied diets.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which organisms break down dead material and return nutrients to the soil?',
    options: ['Producers', 'Herbivores', 'Decomposers such as fungi and bacteria', 'Top predators'],
    answer: 2,
    explanation: 'Decomposers recycle the nutrients in every dead organism and waste product, so producers can use them again.',
    difficulty: 'Basic',
  },
  {
    question: 'Why is a food web more realistic than a single food chain?',
    options: [
      'It is easier to draw',
      'Most animals eat, and are eaten by, several different species',
      'Food chains are always wrong',
      'It includes only plants',
    ],
    answer: 1,
    explanation: 'Real ecosystems are networks. Multiple links can make them more stable, because animals can switch food when one source is scarce.',
    difficulty: 'Basic',
  },
  {
    question: 'A toxin that does not break down is sprayed on grass. Which animal would end up with the highest concentration in its body?',
    options: ['Grasshopper', 'Mouse', 'Hawk', 'Grass'],
    answer: 2,
    explanation: 'Biomagnification: each predator eats many prey and stores their toxin, so concentrations rise up the food chain, as happened with DDT and birds of prey.',
    difficulty: 'Advanced',
  },
];
