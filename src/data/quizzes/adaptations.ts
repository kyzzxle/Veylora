import type { QuizQuestion } from '../quiz-types';

export const adaptationsQuiz: QuizQuestion[] = [
  {
    question: 'What is an adaptation?',
    options: [
      'A change an animal decides to make during its life',
      'An inherited feature that helps an organism survive and reproduce in its environment',
      'Moving to a new habitat',
      'Any change in the weather',
    ],
    answer: 1,
    explanation: 'Adaptations are passed on in genes and become common through natural selection over many generations.',
    difficulty: 'Basic',
  },
  {
    question: 'Why do Arctic foxes have small ears while desert fennec foxes have huge ears?',
    options: [
      'Fennec foxes hear better in sand',
      'Large ears lose heat, which helps in the desert; small ears keep heat in, which helps in the cold',
      'Arctic foxes do not need to hear',
      'It is random',
    ],
    answer: 1,
    explanation: 'Ears are thin and full of blood vessels, so they act like radiators. This pattern of smaller extremities in colder climates is called Allen’s rule.',
    difficulty: 'Basic',
  },
  {
    question: 'Why are animals in cold climates often larger than their relatives in warm climates (Bergmann’s rule)?',
    options: [
      'Cold makes animals grow',
      'A bigger body has less surface area for each unit of volume, so it loses heat more slowly',
      'There is more food in cold places',
      'Larger animals run faster',
    ],
    answer: 1,
    explanation: 'Heat is made throughout the body but lost through the surface. Doubling size gives 8 times the volume but only 4 times the surface.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does being nocturnal help a desert animal?',
    options: [
      'It can see better in the dark',
      'It avoids the hottest part of the day, losing less water and staying cooler',
      'Predators are always asleep at night',
      'Food only appears at night',
    ],
    answer: 1,
    explanation: 'Many desert animals shelter in cool burrows by day and come out at night, saving water they would otherwise lose keeping cool.',
    difficulty: 'Basic',
  },
  {
    question: 'An animal with a brown coat lives on snowy tundra. What is its main problem in the simulator?',
    options: ['It overheats', 'It is easily seen by predators and prey', 'It cannot find water', 'Nothing'],
    answer: 1,
    explanation: 'Camouflage matching the background helps both prey (to hide) and predators (to sneak up). Arctic hares and foxes turn white in winter.',
    difficulty: 'Basic',
  },
  {
    question: 'Which is a behavioural adaptation rather than a structural one?',
    options: ['Thick fur', 'Large ears', 'Hibernating through winter', 'A white coat'],
    answer: 2,
    explanation: 'Behavioural adaptations are things animals do (hibernating, migrating, being nocturnal). Structural adaptations are body features.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does hibernation help animals in a cold forest?',
    options: [
      'It keeps them warmer than being awake',
      'It saves energy when food is scarce in winter by slowing the body right down',
      'It hides them from rain',
      'It makes their fur thicker',
    ],
    answer: 1,
    explanation: 'During hibernation, heart rate, breathing and body temperature drop dramatically, so stored fat lasts all winter.',
    difficulty: 'Intermediate',
  },
  {
    question: 'An adaptation that helps in one habitat can be harmful in another. Which example shows this?',
    options: [
      'Thick fur keeps an Arctic fox warm but would cause overheating in a desert',
      'Eyes help all animals',
      'All animals need water',
      'Teeth are always useful',
    ],
    answer: 0,
    explanation: 'Adaptations are only advantages in a particular environment. When environments change quickly, well-adapted species can struggle.',
    difficulty: 'Advanced',
  },
];
