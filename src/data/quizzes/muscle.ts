import type { QuizQuestion } from '../quiz-types';

export const muscleQuiz: QuizQuestion[] = [
  {
    question: 'Which type of muscle is attached to bones and under voluntary control?',
    options: ['Smooth muscle', 'Cardiac muscle', 'Skeletal muscle', 'All three types'],
    answer: 2,
    explanation: 'Skeletal muscle is joined to bones by tendons and contracts when you decide to move. Cardiac and smooth muscle are involuntary.',
    difficulty: 'Basic',
  },
  {
    question: 'Why do muscles work in antagonistic pairs, like the biceps and triceps?',
    options: [
      'Muscles can only pull, not push, so a second muscle is needed to move the bone back',
      'One muscle is always tired',
      'Two muscles are needed to make blood cells',
      'So that both can contract at once and lock the joint',
    ],
    answer: 0,
    explanation: 'When the biceps contracts, the elbow bends and the triceps relaxes and is stretched. To straighten the arm the triceps contracts and the biceps relaxes.',
    difficulty: 'Basic',
  },
  {
    question: 'What joins a muscle to a bone?',
    options: ['A ligament', 'A tendon', 'Cartilage', 'A nerve'],
    answer: 1,
    explanation: 'Tendons are tough, inelastic cords that transmit the muscle’s pull to the bone. Ligaments join bone to bone at a joint.',
    difficulty: 'Basic',
  },
  {
    question: 'In the sliding filament model, what happens when a sarcomere contracts?',
    options: [
      'Actin and myosin filaments get shorter',
      'Myosin heads pull actin filaments towards the centre, so the filaments slide past each other and the Z-discs move closer',
      'The muscle cell divides',
      'Calcium pushes the Z-discs apart',
    ],
    answer: 1,
    explanation: 'The filaments themselves stay the same length. They overlap more, so each sarcomere, and therefore the whole fibre, gets shorter.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the role of calcium ions in muscle contraction?',
    options: [
      'They provide the energy for the power stroke',
      'They uncover the binding sites on actin so myosin heads can attach',
      'They make myosin heads let go',
      'They carry oxygen to the fibre',
    ],
    answer: 1,
    explanation: 'A nerve impulse releases calcium inside the fibre. Calcium binds to troponin, which moves tropomyosin away from the binding sites. When calcium is pumped away, the muscle relaxes.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, what happens when you turn off ATP during a contraction?',
    options: [
      'The muscle relaxes immediately',
      'Myosin heads stay attached to actin, so the fibre stays locked (rigor)',
      'The muscle contracts faster',
      'Nothing changes',
    ],
    answer: 1,
    explanation: 'ATP is needed for myosin heads to detach and to pump calcium away. Without it the cross-bridges stay locked, which is the cause of rigor mortis after death.',
    difficulty: 'Advanced',
  },
  {
    question: 'How does the body produce a stronger, smoother contraction?',
    options: [
      'By making each fibre contract harder than its maximum',
      'By recruiting more motor units and sending nerve impulses faster, so twitches add together',
      'By growing new muscle cells instantly',
      'By making the bones lighter',
    ],
    answer: 1,
    explanation: 'Each fibre contracts fully or not at all. Force is graded by recruitment and by summation, which leads to a smooth tetanus at high stimulation rates.',
    difficulty: 'Advanced',
  },
  {
    question: 'The biceps is attached about 4 cm from the elbow and a weight is held 33 cm away. Why must the biceps pull much harder than the weight?',
    options: [
      'Muscles are weak',
      'The forearm is a third-class lever: the effort acts close to the fulcrum, so it must be large, but the hand moves far and fast',
      'The weight is heavier when lifted',
      'Because the triceps pulls against it at the same time',
    ],
    answer: 1,
    explanation: 'Moments balance: force × distance must be equal on both sides of the fulcrum. A short effort arm needs a large force, in exchange for speed and range of movement at the hand.',
    difficulty: 'Advanced',
  },
];
