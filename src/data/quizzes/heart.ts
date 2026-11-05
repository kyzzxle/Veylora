import type { QuizQuestion } from '../quiz-types';

export const heartQuiz: QuizQuestion[] = [
  {
    question: 'Which chamber of the heart pumps blood to the whole body?',
    options: ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'],
    answer: 3,
    explanation: 'The left ventricle pumps oxygenated blood into the aorta, which branches to supply the whole body.',
    difficulty: 'Basic',
  },
  {
    question: 'Which blood vessel carries deoxygenated blood from the heart to the lungs?',
    options: ['Aorta', 'Pulmonary artery', 'Pulmonary vein', 'Vena cava'],
    answer: 1,
    explanation: 'The pulmonary artery leaves the right ventricle. Arteries carry blood away from the heart, whether or not it is oxygenated.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the main job of the heart valves?',
    options: ['To add oxygen to the blood', 'To stop blood flowing backwards', 'To make the heartbeat', 'To filter the blood'],
    answer: 1,
    explanation: 'Valves open to let blood through in one direction and shut to stop it flowing back, as you can see in the simulator.',
    difficulty: 'Basic',
  },
  {
    question: 'Why is the wall of the left ventricle much thicker than the wall of the right ventricle?',
    options: [
      'It holds more blood',
      'It must pump blood at higher pressure all around the body, while the right ventricle only pumps to the nearby lungs',
      'It contains the pacemaker',
      'It carries deoxygenated blood',
    ],
    answer: 1,
    explanation: 'Both ventricles pump the same volume, but the systemic circuit needs much higher pressure (about 120 mmHg versus about 25 mmHg).',
    difficulty: 'Intermediate',
  },
  {
    question: 'The first heart sound, “lub”, is caused by…',
    options: ['The atria contracting', 'The tricuspid and mitral valves closing', 'The aortic and pulmonary valves closing', 'Blood entering the aorta'],
    answer: 1,
    explanation: 'When the ventricles start to contract, the atrioventricular valves snap shut (“lub”). The “dub” is the semilunar valves closing as the ventricles relax.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A person’s heart rate is 70 beats per minute and their stroke volume is 70 mL. What is their cardiac output?',
    options: ['140 mL per minute', 'About 1 L per minute', 'About 4.9 L per minute', '70 L per minute'],
    answer: 2,
    explanation: 'Cardiac output = heart rate × stroke volume = 70 × 70 mL = 4,900 mL, or about 4.9 L, per minute.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do mammals have a double circulation?',
    options: [
      'So blood passes through the heart twice per circuit, keeping pressure high for the body after the low-pressure trip through the lungs',
      'So blood can skip the lungs',
      'Because there are two hearts',
      'To keep the blood cold',
    ],
    answer: 0,
    explanation: 'Blood loses pressure in the delicate lung capillaries. Returning to the heart lets the left ventricle re-pressurise it before sending it to the body.',
    difficulty: 'Advanced',
  },
  {
    question: 'During exercise, cardiac output rises from about 5 to 15 L per minute. In the simulator, which two settings achieve this?',
    options: ['Only lowering heart rate', 'Raising both heart rate and stroke volume', 'Closing the valves', 'Lowering stroke volume'],
    answer: 1,
    explanation: 'The nervous system and adrenaline speed up the heart and make each beat stronger, so both factors in rate × volume increase.',
    difficulty: 'Advanced',
  },
];
