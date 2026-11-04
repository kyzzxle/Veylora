import type { QuizQuestion } from '../quiz-types';

export const wavesQuiz: QuizQuestion[] = [
  {
    question: 'What does the principle of superposition say?',
    options: [
      'Waves bounce off each other when they meet',
      'When waves overlap, the total displacement is the sum of the individual displacements',
      'The larger wave always cancels the smaller one',
      'Waves can only overlap if they have the same frequency',
    ],
    answer: 1,
    explanation:
      'At every point, the displacements of overlapping waves add together. Afterwards each wave continues unchanged — they pass through each other.',
    difficulty: 'Basic',
  },
  {
    question: 'Two identical waves meet exactly in phase (phase difference 0°). The resultant amplitude is…',
    options: ['zero', 'the same as one wave', 'double that of one wave', 'half that of one wave'],
    answer: 2,
    explanation:
      'Crests line up with crests and troughs with troughs, so the displacements add fully. This is constructive interference.',
    difficulty: 'Basic',
  },
  {
    question: 'Two waves of equal amplitude are 180° out of phase. What do you observe?',
    options: ['A wave twice as tall', 'Complete cancellation — a flat line', 'A wave with double the frequency', 'Beats'],
    answer: 1,
    explanation:
      'Each crest meets a trough of the same size, so they cancel everywhere. This is destructive interference, the principle behind noise-cancelling headphones.',
    difficulty: 'Basic',
  },
  {
    question: 'Two sound waves have frequencies of 440 Hz and 444 Hz. How often does the loudness rise and fall?',
    options: ['4 times per second', '442 times per second', '884 times per second', 'It never changes'],
    answer: 0,
    explanation:
      'The beat frequency equals the difference between the two frequencies: 444 − 440 = 4 Hz. Musicians use beats to tune instruments — the beats slow down and vanish as the notes match.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the ripple tank, two in-phase sources produce a bright fringe at a point. What must the path difference be there?',
    options: ['A whole number of wavelengths (0, λ, 2λ…)', 'Half a wavelength', 'Exactly 1.5 wavelengths', 'It does not matter'],
    answer: 0,
    explanation:
      'If the waves travel distances that differ by a whole number of wavelengths, they arrive in step and add constructively. Half-number differences (λ/2, 3λ/2…) give destructive interference.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Two waves have amplitudes 1.0 and 1.0 and a phase difference of 90°. What is the resultant amplitude?',
    options: ['0', 'About 1.41', '2.0', '1.0'],
    answer: 1,
    explanation:
      'A = √(A₁² + A₂² + 2A₁A₂ cos φ) = √(1 + 1 + 0) = √2 ≈ 1.41. Set the phase slider to 90° to check.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the ripple tank, what happens to the fringe pattern when you move the two sources farther apart?',
    options: [
      'The fringes disappear',
      'The fringes become more numerous and closer together',
      'The fringes become wider apart',
      'Nothing changes',
    ],
    answer: 1,
    explanation:
      'A larger source separation makes the path difference change faster with angle, so you pass through more whole wavelengths of difference: more fringes, packed more closely. Try it with “average intensity” switched on.',
    difficulty: 'Advanced',
  },
];
