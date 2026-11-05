import type { QuizQuestion } from '../quiz-types';

export const skeletonQuiz: QuizQuestion[] = [
  {
    question: 'How many bones are in a typical adult human skeleton?',
    options: ['106', '206', '306', 'about 300'],
    answer: 1,
    explanation: 'Adults have 206 bones. Babies are born with around 300, many of which fuse together as they grow.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the longest and strongest bone in the body?',
    options: ['Humerus', 'Tibia', 'Femur', 'Spine'],
    answer: 2,
    explanation: 'The femur (thigh bone) is about a quarter of a person’s height and can support many times the body’s weight.',
    difficulty: 'Basic',
  },
  {
    question: 'Which type of joint is found at the shoulder and the hip?',
    options: ['Hinge joint', 'Pivot joint', 'Ball-and-socket joint', 'Fixed joint'],
    answer: 2,
    explanation: 'A rounded head fits into a cup-shaped socket, allowing movement in many directions, including rotation.',
    difficulty: 'Basic',
  },
  {
    question: 'Which of these is NOT a main function of the skeleton?',
    options: ['Supporting the body', 'Protecting organs', 'Making blood cells', 'Digesting food'],
    answer: 3,
    explanation: 'The skeleton supports, protects, allows movement with muscles, stores minerals such as calcium, and makes blood cells in the red bone marrow.',
    difficulty: 'Basic',
  },
  {
    question: 'Try the sliders: why can the elbow bend only forwards and back, while the shoulder can swing the arm in a circle?',
    options: [
      'The elbow has no muscles',
      'The elbow is a hinge joint that moves in one plane; the shoulder is a ball-and-socket joint that moves in many',
      'The shoulder has more bones',
      'The elbow is a fixed joint',
    ],
    answer: 1,
    explanation: 'The shape of the bone surfaces decides the movement: a hinge works like a door, a ball-and-socket like a joystick.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The patella (kneecap) is a sesamoid bone. What does that mean?',
    options: ['It is hollow', 'It develops inside a tendon', 'It is the smallest bone', 'It is made of cartilage'],
    answer: 1,
    explanation: 'Sesamoid bones form within tendons. The patella protects the knee and improves the leverage of the thigh muscles.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which pair of bones in the forearm lets you turn your palm up and down?',
    options: ['Tibia and fibula', 'Radius and ulna', 'Humerus and scapula', 'Carpals and metacarpals'],
    answer: 1,
    explanation: 'The radius rotates around the ulna, a movement called pronation and supination.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do the skull bones meet at fixed joints (sutures) instead of movable ones?',
    options: [
      'To let the head turn',
      'To form a rigid case that protects the brain, while the open sutures in babies let the skull grow',
      'To make the skull lighter',
      'Because the skull has no blood supply',
    ],
    answer: 1,
    explanation: 'Rigid joints give maximum protection. In infants the sutures and “soft spots” are still open, allowing the brain and skull to grow.',
    difficulty: 'Advanced',
  },
];
