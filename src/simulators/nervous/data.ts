/**
 * Data for the nervous system simulator. Timings are typical approximate
 * values for a human; animal responses are simplified descriptions of
 * well-documented behaviours.
 */
export type AnimalId = 'hydra' | 'planarian' | 'earthworm' | 'insect' | 'cat';
export type Stimulus = 'light' | 'sound' | 'touch' | 'motion';

export interface SenseResponse {
  /** Does the animal have receptors for this stimulus? */
  sense: boolean;
  receptor: string;
  response: string;
  /** Strength (0–1) needed before the animal responds. */
  threshold: number;
}
export interface Animal {
  id: AnimalId;
  name: string;
  system: string;
  centralised: string;
  speed: string;
  text: string;
  responses: Record<Stimulus, SenseResponse>;
}

const no = (receptor: string): SenseResponse => ({ sense: false, receptor, response: 'No response: it has no receptors that detect this stimulus.', threshold: 2 });

export const ANIMALS: Record<AnimalId, Animal> = {
  hydra: {
    id: 'hydra',
    name: 'Hydra',
    system: 'Nerve net (no brain)',
    centralised: 'None: neurons are spread evenly through the body',
    speed: 'Slow; signals spread outwards in all directions',
    text: 'A hydra, a tiny freshwater relative of jellyfish, has a nerve net: a mesh of neurons spread through its body wall with no brain or nerve cord. A signal spreads out in all directions, so the whole animal tends to respond at once.',
    responses: {
      light: { sense: true, receptor: 'Light-sensitive cells (no eyes)', response: 'It slowly moves or bends towards moderate light, where the food it catches is likely to be.', threshold: 0.3 },
      sound: no('No hearing organs'),
      touch: { sense: true, receptor: 'Touch-sensitive cells in the body wall and tentacles', response: 'Its body and tentacles contract into a small ball.', threshold: 0.2 },
      motion: no('No eyes, so it cannot see moving objects'),
    },
  },
  planarian: {
    id: 'planarian',
    name: 'Planarian (flatworm)',
    system: 'Two nerve cords and a simple “brain” (cerebral ganglia)',
    centralised: 'Partial: a cluster of neurons at the head end',
    speed: 'Moderate',
    text: 'A planarian has a cluster of neurons at its head end, the cerebral ganglia, connected to two nerve cords joined by cross-links, like a ladder. Concentrating neurons at the front, where the senses are, is the beginning of a brain.',
    responses: {
      light: { sense: true, receptor: 'Two eyespots (detect light direction, not images)', response: 'It turns and glides away from the light, towards darker places where it is safer from predators.', threshold: 0.2 },
      sound: no('No hearing organs'),
      touch: { sense: true, receptor: 'Touch receptors in the skin', response: 'It contracts and turns away from the touch.', threshold: 0.25 },
      motion: no('Eyespots cannot form images, so it cannot see moving objects'),
    },
  },
  earthworm: {
    id: 'earthworm',
    name: 'Earthworm',
    system: 'Brain (cerebral ganglia) and a ventral nerve cord with a ganglion in each segment',
    centralised: 'Moderate: a brain plus a ganglion in every segment',
    speed: 'Fast escapes: giant nerve fibres carry signals very quickly',
    text: 'An earthworm has a small brain above its throat and a nerve cord along its underside, with a ganglion (a cluster of neurons) in every segment. Giant nerve fibres in the cord carry escape signals very fast.',
    responses: {
      light: { sense: true, receptor: 'Light-sensitive cells in the skin (no eyes)', response: 'It moves away from bright light and back into the soil, avoiding drying out and predators.', threshold: 0.35 },
      sound: { sense: true, receptor: 'Vibration receptors (it feels vibrations through the ground rather than hearing sound)', response: 'Strong vibrations make it move; many worms come to the surface, possibly to escape digging moles.', threshold: 0.5 },
      touch: { sense: true, receptor: 'Touch receptors along the body', response: 'It rapidly shortens its body and pulls back into its burrow, using its giant nerve fibres.', threshold: 0.15 },
      motion: no('No eyes, so it cannot see moving objects'),
    },
  },
  insect: {
    id: 'insect',
    name: 'Insect (cockroach)',
    system: 'Brain and a ventral nerve cord with ganglia',
    centralised: 'High: a brain plus fused ganglia that control legs and wings',
    speed: 'Very fast escape reflexes',
    text: 'Insects have a brain and a ventral nerve cord with ganglia that control the legs and wings. Many behaviours are run by these ganglia directly, which makes escape reactions extremely fast.',
    responses: {
      light: { sense: true, receptor: 'Compound eyes and simple eyes (ocelli)', response: 'A cockroach runs away from light to a dark hiding place.', threshold: 0.3 },
      sound: { sense: true, receptor: 'Hairs on the cerci (rear feelers) sense air vibrations', response: 'A sudden puff of air or low sound triggers it to turn and run away.', threshold: 0.35 },
      touch: { sense: true, receptor: 'Touch hairs on the legs and antennae', response: 'It jerks away and runs.', threshold: 0.15 },
      motion: { sense: true, receptor: 'Compound eyes, which are very good at detecting movement', response: 'It freezes or darts away from the approaching object.', threshold: 0.25 },
    },
  },
  cat: {
    id: 'cat',
    name: 'Cat',
    system: 'Brain and spinal cord (central nervous system), plus nerves (peripheral nervous system)',
    centralised: 'Very high: a large brain processes and combines information from all the senses',
    speed: 'Fast, with myelinated nerves; responses can be learned and planned',
    text: 'Vertebrates have a central nervous system (brain and spinal cord) and a peripheral nervous system of nerves to the body. The large brain combines information from many senses, stores memories and can choose among many possible responses.',
    responses: {
      light: { sense: true, receptor: 'Eyes, with a reflective layer for seeing in dim light', response: 'Its pupils narrow to slits in bright light (a reflex) and widen in the dark.', threshold: 0.15 },
      sound: { sense: true, receptor: 'Ears, sensitive to high-pitched sounds', response: 'It turns its ears towards the sound and may look, or jump in a startle reflex if the sound is loud.', threshold: 0.1 },
      touch: { sense: true, receptor: 'Touch receptors in the skin and whiskers', response: 'It flinches or turns to investigate; whiskers help it judge gaps and nearby objects.', threshold: 0.1 },
      motion: { sense: true, receptor: 'Eyes, very sensitive to small movements', response: 'It fixes its gaze on the moving object and may crouch to pounce.', threshold: 0.1 },
    },
  },
};

export type ReflexId = 'withdraw' | 'knee';
export interface ReflexStep {
  name: string;
  text: string;
}
export const REFLEX: Record<ReflexId, { title: string; steps: ReflexStep[]; reflexMs: number; awareMs: number; note: string }> = {
  withdraw: {
    title: 'Withdrawal reflex (touching something hot)',
    reflexMs: 50,
    awareMs: 250,
    note: 'A withdrawal reflex uses three neurons: sensory, relay and motor. The signal also travels up the spinal cord to the brain, but you only feel the pain after your hand has already started to move.',
    steps: [
      { name: 'Stimulus', text: 'The hand touches a hot object. Heat is the stimulus: a change in the environment.' },
      { name: 'Receptor', text: 'Pain and heat receptors in the skin detect the change and start nerve impulses.' },
      { name: 'Sensory neuron', text: 'A sensory neuron carries impulses from the receptor to the spinal cord.' },
      { name: 'Relay neuron (spinal cord)', text: 'In the spinal cord, the sensory neuron passes the signal across a synapse to a relay neuron, which passes it on to a motor neuron. The brain is not needed for this decision.' },
      { name: 'Motor neuron', text: 'A motor neuron carries impulses from the spinal cord to a muscle.' },
      { name: 'Effector', text: 'The biceps muscle (the effector) contracts.' },
      { name: 'Response', text: 'The arm bends and the hand is pulled away, within about 50 milliseconds.' },
      { name: 'Brain becomes aware', text: 'Meanwhile, other neurons carry the signal up the spinal cord to the brain. Only now do you feel “ouch!”, after the reflex has already happened.' },
    ],
  },
  knee: {
    title: 'Knee-jerk reflex (stretch reflex)',
    reflexMs: 25,
    awareMs: 250,
    note: 'The knee-jerk is one of the simplest reflexes: the sensory neuron connects directly to the motor neuron in the spinal cord, with only one synapse and no relay neuron. Doctors tap the knee to check that this pathway works.',
    steps: [
      { name: 'Stimulus', text: 'A tap just below the kneecap stretches the tendon and the thigh muscle above it.' },
      { name: 'Receptor', text: 'Stretch receptors (muscle spindles) in the thigh muscle detect the sudden stretch.' },
      { name: 'Sensory neuron', text: 'A sensory neuron carries impulses to the spinal cord.' },
      { name: 'One synapse (spinal cord)', text: 'In the spinal cord, the sensory neuron connects directly to a motor neuron: only one synapse, so the reflex is extra fast.' },
      { name: 'Motor neuron', text: 'The motor neuron carries impulses back to the thigh muscle.' },
      { name: 'Effector', text: 'The quadriceps muscle at the front of the thigh contracts.' },
      { name: 'Response', text: 'The lower leg kicks forwards, within about 25 milliseconds. This reflex normally helps keep you standing upright.' },
      { name: 'Brain becomes aware', text: 'The brain is informed afterwards: you feel the tap and see the kick, but you did not decide to kick.' },
    ],
  },
};
