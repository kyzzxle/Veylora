import type { QuizQuestion } from '../quiz-types';

export const populationsQuiz: QuizQuestion[] = [
  {
    question: 'In a predator–prey cycle, which population usually peaks first?',
    options: ['The predators', 'The prey', 'They always peak together', 'Neither — they stay constant'],
    answer: 1,
    explanation:
      'Prey increase first when predators are few. The extra food then lets predators multiply, so the predator peak comes later. Watch the fox line lag behind the rabbit line.',
    difficulty: 'Basic',
  },
  {
    question: 'What happens to the rabbit population soon after the fox population reaches a peak?',
    options: ['It rises sharply', 'It falls, because many rabbits are being eaten', 'It stays exactly the same', 'It becomes extinct every time'],
    answer: 1,
    explanation: 'With many predators hunting, prey are eaten faster than they can reproduce, so the prey population falls — which later causes the predators to decline too.',
    difficulty: 'Basic',
  },
  {
    question: 'In the model without a carrying capacity, what happens if all the foxes disappear?',
    options: ['Rabbits die out', 'Rabbits grow without limit', 'Rabbits stay constant', 'Rabbits cycle as before'],
    answer: 1,
    explanation:
      'Without predators and without any limit on food or space, the prey grow exponentially. Real populations are eventually limited by resources — switch on the carrying capacity to see them level off.',
    difficulty: 'Basic',
  },
  {
    question: 'What does “carrying capacity” mean?',
    options: [
      'The maximum number of predators in an area',
      'The largest population an environment can support over time with its available resources',
      'How many prey one predator can carry',
      'The birth rate of a species',
    ],
    answer: 1,
    explanation: 'Carrying capacity (K) is set by limited resources such as food, water and space. As a population approaches K, its growth slows to zero.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the phase plot (foxes against rabbits), what does a closed loop show?',
    options: ['Both species are going extinct', 'The populations repeat the same cycle over and over', 'The populations are constant', 'There is an error in the model'],
    answer: 1,
    explanation:
      'Each point on the loop is a combination of rabbits and foxes. Going around the same loop means the system returns to the same state and the cycle repeats. A spiral inward means the cycles are damping toward a stable balance.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Ecologists reduce the fox population by half when foxes are at their peak. In this model, what is the long-term effect?',
    options: [
      'The cycles stop permanently',
      'The populations shift to a different-sized cycle around the same balance point',
      'Rabbits become extinct',
      'Foxes become extinct',
    ],
    answer: 1,
    explanation:
      'In the classic Lotka–Volterra model, a disturbance moves the system onto a different loop around the same balance point; the cycles continue. Try the “Hunting” button and watch the phase plot.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the model, the balance number of rabbits is H* = m / (b·a). What happens to H* if foxes become better hunters (a increases)?',
    options: ['H* increases', 'H* decreases', 'H* is unchanged', 'H* becomes zero'],
    answer: 1,
    explanation:
      'Better hunters need fewer rabbits to sustain themselves, so the balance point for rabbits falls. This is a classic and somewhat surprising prediction: the predator’s efficiency, not the prey’s birth rate, sets the prey’s average level.',
    difficulty: 'Advanced',
  },
];
