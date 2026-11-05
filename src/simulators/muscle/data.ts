/** Major skeletal muscles shown in the 3D atlas. */

export type Region = 'head' | 'arm' | 'trunk' | 'leg';

/** Joint angles in degrees produced when a muscle contracts fully (c = 1). */
export interface Pose {
  elbow?: number;
  shoulderAbd?: number;
  shoulderFlex?: number;
  shrug?: number;
  wrist?: number;
  trunkFlex?: number;
  trunkTwist?: number;
  head?: number;
  hip?: number;
  knee?: number;
  ankle?: number;
}

export interface Muscle {
  name: string;
  region: Region;
  location: string;
  action: string;
  /** Joint movement shown when it contracts, as a function of contraction 0–1. */
  pose: (c: number) => Pose;
  /** The muscle that does the opposite movement (it relaxes and lengthens). */
  antagonist?: string;
}

export const MUSCLES: Record<string, Muscle> = {
  sternocleidomastoid: {
    name: 'Sternocleidomastoid',
    region: 'head',
    location: 'Side of the neck, from behind the ear to the collarbone and breastbone.',
    action: 'Turns the head to the opposite side and bends the neck forward.',
    pose: (c) => ({ head: 50 * c }),
  },
  trapezius: {
    name: 'Trapezius',
    region: 'trunk',
    location: 'Upper back and back of the neck, a large diamond-shaped muscle.',
    action: 'Lifts (shrugs), pulls back and rotates the shoulder blades; supports the head.',
    pose: (c) => ({ shrug: c }),
  },
  deltoid: {
    name: 'Deltoid',
    region: 'arm',
    location: 'Caps the shoulder joint, from the collarbone and shoulder blade to the humerus.',
    action: 'Raises the arm out to the side (abduction) and helps move it forwards and backwards.',
    pose: (c) => ({ shoulderAbd: 90 * c }),
    antagonist: 'latissimus',
  },
  pectoralis: {
    name: 'Pectoralis major',
    region: 'trunk',
    location: 'Front of the chest, from the breastbone and collarbone to the humerus.',
    action: 'Pulls the arm forwards and across the chest, as in a push-up or a hug.',
    pose: (c) => ({ shoulderFlex: 70 * c }),
    antagonist: 'latissimus',
  },
  biceps: {
    name: 'Biceps brachii',
    region: 'arm',
    location: 'Front of the upper arm, from the shoulder blade to the radius just below the elbow.',
    action: 'Bends (flexes) the elbow and turns the palm upwards.',
    pose: (c) => ({ elbow: 10 + 125 * c }),
    antagonist: 'triceps',
  },
  triceps: {
    name: 'Triceps brachii',
    region: 'arm',
    location: 'Back of the upper arm, from the shoulder blade and humerus to the point of the elbow (olecranon).',
    action: 'Straightens (extends) the elbow, as when pushing or throwing.',
    pose: (c) => ({ elbow: 110 * (1 - c) }),
    antagonist: 'biceps',
  },
  forearm: {
    name: 'Forearm flexors',
    region: 'arm',
    location: 'Front of the forearm, from the elbow to the wrist and fingers by long tendons.',
    action: 'Bend the wrist and curl the fingers to grip.',
    pose: (c) => ({ elbow: 10, wrist: 60 * c }),
  },
  rectus: {
    name: 'Rectus abdominis',
    region: 'trunk',
    location: 'Front of the abdomen, from the pubic bone to the ribs (the “six-pack”).',
    action: 'Bends the trunk forwards and supports the organs of the abdomen.',
    pose: (c) => ({ trunkFlex: 30 * c }),
  },
  obliques: {
    name: 'External obliques',
    region: 'trunk',
    location: 'Sides of the abdomen, running diagonally from the lower ribs to the pelvis.',
    action: 'Twist the trunk and bend it to the side.',
    pose: (c) => ({ trunkTwist: 30 * c }),
  },
  latissimus: {
    name: 'Latissimus dorsi',
    region: 'trunk',
    location: 'Lower and middle back, from the spine and pelvis to the front of the humerus.',
    action: 'Pulls the arm down and backwards, as in climbing, rowing or swimming.',
    pose: (c) => ({ shoulderFlex: -40 * c }),
    antagonist: 'deltoid',
  },
  gluteus: {
    name: 'Gluteus maximus',
    region: 'leg',
    location: 'The buttock, from the pelvis and sacrum to the femur.',
    action: 'Straightens the hip and moves the leg backwards; used in climbing stairs and standing up.',
    pose: (c) => ({ hip: -30 * c }),
  },
  quadriceps: {
    name: 'Quadriceps femoris',
    region: 'leg',
    location: 'Front of the thigh: four muscles joined to the kneecap and tibia by the patellar tendon.',
    action: 'Straightens (extends) the knee; one part also bends the hip.',
    pose: (c) => ({ knee: 90 * (1 - c) }),
    antagonist: 'hamstrings',
  },
  hamstrings: {
    name: 'Hamstrings',
    region: 'leg',
    location: 'Back of the thigh, from the pelvis to the top of the tibia and fibula.',
    action: 'Bend (flex) the knee and straighten the hip.',
    pose: (c) => ({ knee: 100 * c }),
    antagonist: 'quadriceps',
  },
  gastrocnemius: {
    name: 'Gastrocnemius (calf)',
    region: 'leg',
    location: 'Back of the lower leg, joined to the heel bone by the Achilles tendon.',
    action: 'Points the foot downwards (plantar flexion), lifting the heel when you walk, run or jump.',
    pose: (c) => ({ ankle: 40 * c }),
    antagonist: 'tibialis',
  },
  tibialis: {
    name: 'Tibialis anterior',
    region: 'leg',
    location: 'Front of the lower leg, beside the shin bone (tibia).',
    action: 'Lifts the foot and toes upwards (dorsiflexion), so the toes clear the ground as you walk.',
    pose: (c) => ({ ankle: -25 * c }),
    antagonist: 'gastrocnemius',
  },
};
