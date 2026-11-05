import type { QuizQuestion } from '../quiz-types';

export const lensingQuiz: QuizQuestion[] = [
  {
    question: 'What is the event horizon of a black hole?',
    options: [
      'The bright ring of gas around it',
      'The boundary inside which nothing, not even light, can escape',
      'The centre of the black hole',
      'The furthest distance its gravity reaches',
    ],
    answer: 1,
    explanation: 'Once inside the event horizon, the escape speed is greater than the speed of light, so nothing can get out.',
    difficulty: 'Basic',
  },
  {
    question: 'What is gravitational lensing?',
    options: [
      'A telescope lens made of glass',
      'The bending of light by the gravity of a massive object',
      'Light reflecting off a black hole',
      'Stars orbiting a black hole',
    ],
    answer: 1,
    explanation: 'Mass curves space-time, so light passing near a massive object follows a bent path, just as Einstein’s general relativity predicts.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, what do you see when the black hole is lined up exactly in front of the source?',
    options: ['Nothing changes', 'The source disappears completely', 'An Einstein ring: the source is smeared into a circle around the black hole', 'Two black holes'],
    answer: 2,
    explanation: 'With perfect alignment, light from the source is bent equally all the way round, forming a ring at the Einstein radius.',
    difficulty: 'Basic',
  },
  {
    question: 'If the black hole’s mass is multiplied by 4, what happens to the Einstein radius?',
    options: ['It stays the same', 'It doubles', 'It becomes 4 times bigger', 'It becomes 16 times bigger'],
    answer: 1,
    explanation: 'The Einstein radius grows with the square root of the mass: √4 = 2.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why can a black hole make a background star look brighter, even though the black hole itself gives out no light?',
    options: [
      'The black hole reflects starlight',
      'Lensing bends extra light from the star towards us, focusing it like a magnifying glass',
      'The star gets hotter',
      'The black hole emits X-rays',
    ],
    answer: 1,
    explanation: 'Lensing stretches the images of the source, and since surface brightness is preserved, bigger images mean more total light reaches us.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Astronomers watching millions of stars sometimes see one brighten and fade smoothly over weeks. What could cause this?',
    options: [
      'A supernova',
      'An unseen object, such as a black hole or planet, passing in front of it (microlensing)',
      'The star changing colour',
      'Clouds on Earth',
    ],
    answer: 1,
    explanation: 'This is microlensing, the curve recorded in the graph. It has been used to discover isolated black holes and planets around distant stars.',
    difficulty: 'Advanced',
  },
  {
    question: 'The Schwarzschild radius of a black hole is about 2.95 km per solar mass. How big is the event horizon of a 10-solar-mass black hole?',
    options: ['About 3 km radius', 'About 30 km radius', 'About 300 km radius', 'About 3,000 km radius'],
    answer: 1,
    explanation: 'r_s ≈ 2.95 km × 10 ≈ 30 km. That is 10 Suns’ worth of mass inside a sphere the size of a city.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which observation first confirmed that gravity bends light?',
    options: [
      'The first photo of a black hole in 2019',
      'Measurements of stars near the Sun during the 1919 solar eclipse',
      'The discovery of Neptune',
      'Galileo’s telescope observations',
    ],
    answer: 1,
    explanation: 'In 1919 Arthur Eddington’s expedition measured starlight bending around the eclipsed Sun by the amount Einstein predicted.',
    difficulty: 'Advanced',
  },
];
