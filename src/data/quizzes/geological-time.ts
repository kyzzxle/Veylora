import type { QuizQuestion } from '../quiz-types';

export const geologicalTimeQuiz: QuizQuestion[] = [
  {
    question: 'If Earth’s 4.54-billion-year history were squeezed into 24 hours, roughly when would modern humans appear?',
    options: ['Around noon', 'Around 18:00', 'Around 23:00', 'A few seconds before midnight'],
    answer: 3,
    explanation: 'Homo sapiens appeared about 300,000 years ago: around 23:59:54 on the 24-hour clock.',
    difficulty: 'Basic',
  },
  {
    question: 'Which era is often called the “age of reptiles”, ending with the asteroid impact 66 million years ago?',
    options: ['Paleozoic', 'Mesozoic', 'Cenozoic', 'Precambrian'],
    answer: 1,
    explanation: 'The Mesozoic (251.9–66.0 Ma) includes the Triassic, Jurassic and Cretaceous periods, the time of the dinosaurs.',
    difficulty: 'Basic',
  },
  {
    question: 'In an undisturbed sequence of sedimentary layers, which layer is oldest?',
    options: ['The bottom layer', 'The top layer', 'The thickest layer', 'The layer with the most fossils'],
    answer: 0,
    explanation: 'This is the principle of superposition: each layer is deposited on top of the one before.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, a dike cuts through layers A to E but not layer F above it. What can you conclude?',
    options: [
      'The dike is older than layer A',
      'Layer F is older than the dike',
      'The dike is younger than layers A–E but older than layer F',
      'Nothing: dikes cannot be ordered',
    ],
    answer: 2,
    explanation: 'Cross-cutting relationships: a feature is younger than the rocks it cuts. Layer F was deposited across the top of the dike, so F is younger still.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Layers A–C are tilted, while layer D lies flat across their eroded tops. What sequence of events does this show?',
    options: [
      'A–C were deposited tilted, then D',
      'A–C were deposited flat, tilted and eroded, then D was deposited: an angular unconformity',
      'D was deposited first, then A–C',
      'All the layers formed at the same time',
    ],
    answer: 1,
    explanation: 'Original horizontality says sediment is laid down flat, so the tilting came later. The erosion surface is a gap in the record.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which conditions give an organism the best chance of becoming a fossil?',
    options: [
      'Lying on open ground in the sun',
      'Being eaten by scavengers',
      'Having only soft tissue',
      'Having hard parts and being buried quickly in fine sediment with little oxygen',
    ],
    answer: 3,
    explanation: 'Rapid burial protects remains from scavengers and decay, and hard parts survive much better than soft tissue.',
    difficulty: 'Basic',
  },
  {
    question: 'A dinosaur footprint preserved in rock is an example of which type of fossil?',
    options: ['A trace fossil', 'A body fossil', 'A cast of a bone', 'Preserved remains'],
    answer: 0,
    explanation: 'Trace fossils record an organism’s activity, such as footprints or burrows, rather than its body.',
    difficulty: 'Basic',
  },
  {
    question: 'A rock sample contains 25% of its original potassium-40 (half-life 1.25 billion years). How old is it?',
    options: ['1.25 billion years', '312 million years', '2.5 billion years', '5 billion years'],
    answer: 2,
    explanation: '25% is (½)², so two half-lives have passed: 2 × 1.25 = 2.5 billion years.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why can’t carbon-14 be used to date a 70-million-year-old dinosaur bone?',
    options: [
      'Dinosaurs did not contain carbon',
      'With a half-life of 5,730 years, almost no carbon-14 is left after about 50,000 years',
      'Carbon-14 only works on rocks',
      'Carbon-14 decays too slowly',
    ],
    answer: 1,
    explanation: 'After about nine half-lives, too little carbon-14 remains to measure. Dinosaur ages come from volcanic layers dated by methods such as potassium–argon or uranium–lead.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A fossil layer lies between a volcanic ash dated at 75 Ma below and one dated at 60 Ma above. What is the best estimate of the fossil’s age?',
    options: ['Exactly 75 Ma', 'Older than 75 Ma', 'Between 60 and 75 Ma', 'Younger than 60 Ma'],
    answer: 2,
    explanation: 'By superposition the fossil is younger than the ash below and older than the ash above. Bracketing between dated layers is how most fossils are dated.',
    difficulty: 'Advanced',
  },
];
