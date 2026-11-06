import type { QuizQuestion } from '../quiz-types';

export const opticsQuiz: QuizQuestion[] = [
  {
    question: 'A light ray hits a plane mirror at 35° to the normal. At what angle to the normal is it reflected?',
    options: ['55°', '35°', '70°', '90°'],
    answer: 1,
    explanation: 'Law of reflection: the angle of reflection equals the angle of incidence, both measured from the normal.',
    difficulty: 'Basic',
  },
  {
    question: 'You tilt a mirror by 10° while the laser stays still. How far does the reflected beam turn?',
    options: ['5°', '10°', '20°', '40°'],
    answer: 2,
    explanation: 'Tilting the mirror by δ changes both the angle of incidence and the angle of reflection by δ, so the reflected beam turns by 2δ = 20°.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What does a refractive index of 1.5 tell you about glass?',
    options: [
      'Light travels 1.5 times faster in glass than in a vacuum',
      'Light travels 1.5 times slower in glass than in a vacuum (n = c/v)',
      'Glass reflects 1.5% of light',
      'Glass is 1.5 times denser than water',
    ],
    answer: 1,
    explanation: 'n = c/v, so v = c/1.5 ≈ 2.0 × 10⁸ m/s. The slower light travels in a material, the more it bends on entering it.',
    difficulty: 'Basic',
  },
  {
    question: 'Light passes from air (n = 1.00) into glass (n = 1.50) at 40° to the normal. What is the angle of refraction?',
    options: ['About 25°', 'About 40°', 'About 60°', 'About 74°'],
    answer: 0,
    explanation: 'Snell’s law: 1.00 × sin 40° = 1.50 × sin θ₂, so sin θ₂ = 0.643 ÷ 1.50 = 0.428 and θ₂ ≈ 25.4°. It bends towards the normal.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When can total internal reflection happen?',
    options: [
      'When light goes from a less dense to a denser medium at any angle',
      'Only when light goes from a higher to a lower refractive index and the angle of incidence exceeds the critical angle',
      'Whenever light hits glass',
      'Only at a mirror',
    ],
    answer: 1,
    explanation: 'Snell’s law then needs sin θ₂ > 1, which is impossible, so no light is transmitted. Going from air into glass it can never happen.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the critical angle for light going from water (n = 1.33) into air?',
    options: ['About 24°', 'About 42°', 'About 49°', 'About 90°'],
    answer: 2,
    explanation: 'sin θc = n₂/n₁ = 1.00/1.33, so θc ≈ 48.8°. For glass (1.50) it is about 41.8°, and for diamond (2.42) only about 24.4°, which is why diamonds sparkle.',
    difficulty: 'Intermediate',
  },
  {
    question: 'An object is 30 cm from a converging lens with a focal length of 10 cm. Where is the image?',
    options: ['7.5 cm from the lens', '15 cm on the other side of the lens', '30 cm on the other side', 'There is no image'],
    answer: 1,
    explanation: '1/f = 1/dₒ + 1/dᵢ gives 1/dᵢ = 1/10 − 1/30 = 2/30, so dᵢ = 15 cm. It is real, inverted and half the size: m = −15/30 = −0.5.',
    difficulty: 'Intermediate',
  },
  {
    question: 'An object is 5 cm from a converging lens with f = 10 cm. Which description of the image is correct?',
    options: [
      'Real, inverted and smaller',
      'Virtual, upright and twice the size, on the same side as the object',
      'Real, upright and the same size',
      'No image forms',
    ],
    answer: 1,
    explanation: '1/dᵢ = 1/10 − 1/5 = −1/10, so dᵢ = −10 cm (virtual) and m = −(−10)/5 = +2. This is how a magnifying glass works.',
    difficulty: 'Advanced',
  },
  {
    question: 'What kind of image does a diverging (concave) lens form of a real object?',
    options: [
      'Always real and inverted',
      'Always virtual, upright and smaller',
      'Real or virtual depending on distance',
      'Always magnified',
    ],
    answer: 1,
    explanation: 'A diverging lens spreads rays out, so they never meet. For f = −10 cm and dₒ = 20 cm: dᵢ ≈ −6.7 cm and m ≈ +0.33.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the difference between a real and a virtual image?',
    options: [
      'Real images are larger',
      'Light rays actually meet at a real image, so it can be projected onto a screen; they only appear to come from a virtual image',
      'Virtual images only form in mirrors',
      'There is no difference',
    ],
    answer: 1,
    explanation: 'Cameras and projectors form real images on a sensor or screen; magnifying glasses and plane mirrors form virtual images you can only see by looking into them.',
    difficulty: 'Basic',
  },
];
