import type { QuizQuestion } from '../quiz-types';

export const behaviorQuiz: QuizQuestion[] = [
  {
    question: 'Which of these is an example of innate (instinctive) behaviour?',
    options: [
      'A dog learning to sit for a treat',
      'A greylag goose rolling an egg back into its nest the first time it sees one outside',
      'A young bird learning to avoid bad-tasting caterpillars',
      'A chimpanzee learning to use a stick from its mother',
    ],
    answer: 1,
    explanation: 'Innate behaviour is inherited and performed correctly without learning. The other examples all depend on experience.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, the egg is removed while the goose is rolling it back. What happens, and what does it show?',
    options: [
      'The goose stops at once, showing that it is learning',
      'The goose finishes the whole rolling movement anyway, showing a fixed action pattern',
      'The goose looks for the egg, showing insight',
      'The goose leaves the nest',
    ],
    answer: 1,
    explanation: 'A fixed action pattern is an innate sequence that, once triggered by a sign stimulus, runs to completion.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A snail stops withdrawing into its shell after being touched gently many times, but still withdraws fully when a bird’s shadow passes. What is this?',
    options: ['Imprinting', 'Habituation', 'Fatigue of its muscles', 'Instinct'],
    answer: 1,
    explanation: 'Habituation is learning to ignore a repeated, harmless stimulus. The full response to the shadow shows the snail is not simply tired.',
    difficulty: 'Basic',
  },
  {
    question: 'Why do many predators quickly learn to avoid brightly striped, bad-tasting prey?',
    options: [
      'Bright colours are invisible to them',
      'Through trial and error they link the warning colours with a bad experience, and bright patterns are easy to remember',
      'They are born knowing all poisonous prey',
      'Striped prey are too big to eat',
    ],
    answer: 1,
    explanation: 'This is associative learning. Warning colours (aposematism) benefit both predator and prey, because fewer attacks are needed before the predator learns.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the habitat model, the daylight is set to 10 hours while the temperature is still 20 °C. What do the songbirds do, and why?',
    options: [
      'Nothing, because it is warm',
      'They migrate, because short days are a reliable seasonal cue that winter is coming',
      'They start breeding',
      'They become nocturnal',
    ],
    answer: 1,
    explanation: 'Many birds use day length (photoperiod) to time migration and breeding, because it changes in the same way every year, unlike the weather.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A bird sees a hawk and gives a sharp call, and the rest of the flock flies into cover. What kind of behaviour is the call?',
    options: ['Foraging', 'Communication (an alarm call)', 'Territorial display', 'Migration'],
    answer: 1,
    explanation: 'With alarm calls switched off in the model, each bird must spot the hawk itself, so more birds are caught in the open.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does a male songbird sing from a high perch in spring?',
    options: [
      'To keep warm',
      'To claim and defend a territory, warning rival males away and attracting a mate',
      'To call its young',
      'To find food',
    ],
    answer: 1,
    explanation: 'A territory contains food and nest sites. Song and chasing intruders are territorial behaviours, triggered by long days in the breeding season.',
    difficulty: 'Basic',
  },
  {
    question: 'An animal that is most active at dawn and dusk, such as a rabbit, is described as:',
    options: ['Diurnal', 'Nocturnal', 'Crepuscular', 'Hibernating'],
    answer: 2,
    explanation: 'Diurnal animals are active by day and nocturnal animals at night. Crepuscular animals use the twilight hours.',
    difficulty: 'Basic',
  },
  {
    question: 'A mouse kept in constant darkness still sleeps and wakes in a rhythm, but its activity starts about 20 minutes earlier each day. What does this show?',
    options: [
      'Mice cannot tell the time',
      'It has an internal (circadian) clock that runs slightly faster than 24 hours; normally daylight resets it each day',
      'The darkness makes it ill',
      'Its rhythm is learned from other mice',
    ],
    answer: 1,
    explanation: 'The rhythm continues without light cues, so it is internal. Light acts as a time-giver that keeps the clock entrained to exactly 24 hours.',
    difficulty: 'Advanced',
  },
  {
    question: 'After the light schedule is shifted by 6 hours, why does it take the animal several days to adjust?',
    options: [
      'It has to learn the new times by trial and error',
      'The body clock can only shift by about 1–1.5 hours per day, so it catches up gradually: jet lag',
      'It does not notice the change',
      'Its eyes need time to heal',
    ],
    answer: 1,
    explanation: 'The same happens to people who fly across several time zones.',
    difficulty: 'Intermediate',
  },
];
