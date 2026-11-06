import type { QuizQuestion } from '../quiz-types';

export const nervousQuiz: QuizQuestion[] = [
  {
    question: 'In which order does a nerve impulse normally travel through a neuron?',
    options: [
      'Axon terminals → axon → cell body → dendrites',
      'Dendrites → cell body → axon → axon terminals',
      'Cell body → dendrites → axon → axon terminals',
      'Axon → dendrites → cell body → axon terminals',
    ],
    answer: 1,
    explanation: 'Dendrites receive signals, the cell body combines them, the axon carries the impulse away, and the axon terminals pass it to the next cell at a synapse.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, a 40% stimulus raises the voltage only to −58 mV. What happens?',
    options: [
      'A smaller action potential travels along the axon',
      'Nothing is sent: the small graded potential fades because the −55 mV threshold was not reached',
      'The neuron fires two weak impulses',
      'The impulse travels more slowly',
    ],
    answer: 1,
    explanation: 'Action potentials are all-or-none. Below the threshold, no impulse is sent; at or above it, a full-sized impulse fires.',
    difficulty: 'Basic',
  },
  {
    question: 'If every action potential is the same size, how does the nervous system tell a strong stimulus from a weak one?',
    options: [
      'Strong stimuli make bigger impulses',
      'Strong stimuli make impulses travel faster',
      'Strong stimuli make impulses more frequent, and may activate more neurons',
      'It cannot tell them apart',
    ],
    answer: 2,
    explanation: 'With the stimulus held on, a stronger stimulus makes the neuron fire more often. The refractory period sets an upper limit on how often a neuron can fire.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do impulses travel faster along a myelinated axon?',
    options: [
      'Myelin carries the electricity itself',
      'Myelin insulates the axon, so the impulse is regenerated only at the nodes and jumps from node to node',
      'Myelin makes the axon shorter',
      'Myelin releases neurotransmitter',
    ],
    answer: 1,
    explanation: 'This is saltatory conduction. Myelinated axons can conduct at up to about 100 m/s, compared with about 0.5–2 m/s in thin unmyelinated axons.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How does a signal cross a synapse?',
    options: [
      'The electrical impulse jumps across the gap',
      'The two neurons are joined, so the impulse flows straight through',
      'The impulse causes the release of neurotransmitter, which diffuses across the gap and binds to receptors on the next neuron',
      'Ions flow along a tube between the neurons',
    ],
    answer: 2,
    explanation: 'At most synapses the signal changes from electrical to chemical and back to electrical.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, the receptors on the next neuron are blocked. What happens when an impulse arrives?',
    options: [
      'Neurotransmitter is released, but it cannot bind, so the next neuron receives no signal',
      'The impulse travels backwards',
      'No neurotransmitter is released',
      'The next neuron fires twice',
    ],
    answer: 0,
    explanation: 'Some drugs and toxins work this way. Curare, for example, blocks the receptors on muscles, which causes paralysis.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the correct order of a withdrawal reflex arc?',
    options: [
      'Receptor → motor neuron → relay neuron → sensory neuron → effector',
      'Stimulus → receptor → sensory neuron → relay neuron → motor neuron → effector → response',
      'Stimulus → brain → spinal cord → muscle',
      'Effector → motor neuron → receptor → response',
    ],
    answer: 1,
    explanation: 'The relay neuron is in the spinal cord. The brain is informed too, but only after the reflex has started.',
    difficulty: 'Basic',
  },
  {
    question: 'Why is the knee-jerk reflex even faster than the withdrawal reflex?',
    options: [
      'It uses the brain',
      'The sensory neuron connects directly to the motor neuron, with only one synapse and no relay neuron',
      'Leg nerves are not myelinated',
      'It has more neurons',
    ],
    answer: 1,
    explanation: 'Each synapse adds a short delay. The knee-jerk is monosynaptic (one synapse); the withdrawal reflex has two synapses in the spinal cord.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A hydra is touched on one side and its whole body contracts. Which feature of its nervous system explains this?',
    options: [
      'A large brain',
      'A spinal cord',
      'A nerve net, with neurons spread through the body and no brain, so signals spread in all directions',
      'Compound eyes',
    ],
    answer: 2,
    explanation: 'Animals that are more active and move head-first, like flatworms, insects and vertebrates, have neurons concentrated in a head (cephalisation) and along nerve cords.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, an earthworm does not react to an object moving towards it, even at 100% strength. Why?',
    options: [
      'Its threshold is too high',
      'It has no eyes, so it has no receptors that can detect a moving object',
      'Its nerves are blocked',
      'Earthworms cannot move',
    ],
    answer: 1,
    explanation: 'An animal can only respond to a stimulus that its receptors can detect. Earthworms do have light-sensitive cells in their skin, and they react strongly to vibrations and touch.',
    difficulty: 'Intermediate',
  },
];
