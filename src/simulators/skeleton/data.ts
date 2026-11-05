/** Bones and joints of the simplified 3D skeleton. Counts add up to 206. */

export type BoneType = 'long' | 'short' | 'flat' | 'irregular' | 'sesamoid';
export type JointType = 'ball' | 'hinge' | 'pivot' | 'gliding' | 'saddle' | 'fixed';

export interface Bone {
  name: string;
  type: BoneType;
  count: number;
  countNote?: string;
  about: string;
}

export const BONES: Record<string, Bone> = {
  skull: { name: 'Skull', type: 'flat', count: 21, countNote: '8 cranial + 13 facial bones (plus the mandible)', about: 'Protects the brain and supports the face. The cranial bones are locked together by immovable joints called sutures.' },
  mandible: { name: 'Mandible (lower jaw)', type: 'irregular', count: 1, about: 'The only skull bone that moves. It hinges at the temporomandibular joint for chewing and speaking.' },
  cervical: { name: 'Cervical vertebrae', type: 'irregular', count: 7, about: 'The seven neck vertebrae. The top two, the atlas and axis, form a pivot joint that lets you turn your head.' },
  thoracic: { name: 'Thoracic vertebrae', type: 'irregular', count: 12, about: 'The twelve vertebrae of the upper back. Each one joins a pair of ribs.' },
  lumbar: { name: 'Lumbar vertebrae', type: 'irregular', count: 5, about: 'The largest vertebrae, in the lower back. They carry most of the upper body’s weight.' },
  sacrum: { name: 'Sacrum and coccyx', type: 'irregular', count: 2, countNote: '5 fused sacral + 3–5 fused tailbone vertebrae', about: 'Fused vertebrae that lock the spine into the pelvis. The coccyx is the tailbone.' },
  ribs: { name: 'Ribs', type: 'flat', count: 24, countNote: '12 pairs', about: 'Twelve pairs of curved bones that protect the heart and lungs and lift when you breathe in. The lowest two pairs are “floating ribs” that do not reach the sternum.' },
  sternum: { name: 'Sternum (breastbone)', type: 'flat', count: 1, about: 'The flat bone in the centre of the chest. Most ribs attach to it by flexible cartilage.' },
  clavicle: { name: 'Clavicle (collarbone)', type: 'long', count: 2, about: 'Braces the shoulder out to the side. It is one of the most commonly broken bones.' },
  scapula: { name: 'Scapula (shoulder blade)', type: 'flat', count: 2, about: 'A flat triangular bone on the back that anchors many muscles and forms the shoulder socket.' },
  humerus: { name: 'Humerus', type: 'long', count: 2, about: 'The upper arm bone. Its rounded head fits the shoulder socket in a ball-and-socket joint.' },
  radius: { name: 'Radius', type: 'long', count: 2, about: 'The forearm bone on the thumb side. It rolls around the ulna to turn the palm up or down.' },
  ulna: { name: 'Ulna', type: 'long', count: 2, about: 'The forearm bone on the little-finger side. It forms the main hinge of the elbow with the humerus.' },
  carpals: { name: 'Carpals (wrist bones)', type: 'short', count: 16, countNote: '8 in each wrist', about: 'Small, cube-like bones that glide over one another, making the wrist flexible.' },
  metacarpals: { name: 'Metacarpals (palm)', type: 'long', count: 10, countNote: '5 in each hand', about: 'The five bones of the palm, one leading to each finger.' },
  handPhalanges: { name: 'Phalanges of the hand', type: 'long', count: 28, countNote: '14 in each hand', about: 'Finger bones: three in each finger and two in the thumb.' },
  pelvis: { name: 'Pelvis (hip bones)', type: 'irregular', count: 2, countNote: 'each formed from 3 fused bones', about: 'Supports the abdominal organs and passes the body’s weight to the legs. It contains the deep sockets of the hip joints.' },
  femur: { name: 'Femur (thigh bone)', type: 'long', count: 2, about: 'The longest and strongest bone in the body, about a quarter of your height.' },
  patella: { name: 'Patella (kneecap)', type: 'sesamoid', count: 2, about: 'A sesamoid bone that sits inside the thigh-muscle tendon, protecting the knee and improving leverage.' },
  tibia: { name: 'Tibia (shinbone)', type: 'long', count: 2, about: 'The larger lower-leg bone, carrying the body’s weight from the knee to the ankle.' },
  fibula: { name: 'Fibula', type: 'long', count: 2, about: 'The thin outer lower-leg bone. It mainly anchors muscles and steadies the ankle.' },
  tarsals: { name: 'Tarsals (ankle and heel)', type: 'short', count: 14, countNote: '7 in each foot', about: 'Includes the talus, which forms the ankle joint, and the calcaneus, the heel bone.' },
  metatarsals: { name: 'Metatarsals', type: 'long', count: 10, countNote: '5 in each foot', about: 'The five long bones of the foot, which form its arches.' },
  footPhalanges: { name: 'Phalanges of the foot', type: 'long', count: 28, countNote: '14 in each foot', about: 'Toe bones: three in each toe and two in the big toe.' },
};
/** Bones too small to model: 6 ear ossicles + 1 hyoid. */
export const HIDDEN_BONES = 7;

export const BONE_TYPE: Record<BoneType, { name: string; colour: string; about: string }> = {
  long: { name: 'Long bone', colour: '#5b8def', about: 'Longer than wide; act as levers for movement.' },
  short: { name: 'Short bone', colour: '#f2a541', about: 'Roughly cube-shaped; give stability with a little movement.' },
  flat: { name: 'Flat bone', colour: '#e0605a', about: 'Thin and often curved; protect organs and anchor muscles.' },
  irregular: { name: 'Irregular bone', colour: '#8e6bd8', about: 'Complex shapes that fit special jobs.' },
  sesamoid: { name: 'Sesamoid bone', colour: '#3fb68b', about: 'Small bones embedded in tendons.' },
};

export interface Joint {
  name: string;
  type: JointType;
  about: string;
}
export const JOINTS: Record<string, Joint> = {
  sutures: { name: 'Skull sutures', type: 'fixed', about: 'Fibrous joints that lock the skull bones together. In babies they are still open (the “soft spots”), so the skull can grow.' },
  neck: { name: 'Atlas–axis joint', type: 'pivot', about: 'A pivot joint between the first two neck vertebrae. It lets you turn your head to say “no”.' },
  shoulder: { name: 'Shoulder', type: 'ball', about: 'The rounded head of the humerus sits in a shallow socket on the scapula. It has the widest range of movement of any joint, but dislocates more easily than the hip.' },
  elbow: { name: 'Elbow', type: 'hinge', about: 'Bends and straightens in one plane, like a door hinge.' },
  wrist: { name: 'Wrist', type: 'gliding', about: 'The small carpal bones glide over each other, letting the hand bend and tilt.' },
  thumb: { name: 'Base of the thumb', type: 'saddle', about: 'Two saddle-shaped surfaces let the thumb swing across the palm, giving humans their precise grip.' },
  hip: { name: 'Hip', type: 'ball', about: 'The ball of the femur sits in a deep socket in the pelvis: strong and stable, with a wide range of movement.' },
  knee: { name: 'Knee', type: 'hinge', about: 'The largest joint in the body. It mainly bends and straightens; cartilage and ligaments cushion and hold it together.' },
  ankle: { name: 'Ankle', type: 'hinge', about: 'A hinge joint that lets the foot point up and down.' },
};
export const JOINT_TYPE: Record<JointType, { name: string; colour: string }> = {
  ball: { name: 'Ball-and-socket joint', colour: '#f08a4b' },
  hinge: { name: 'Hinge joint', colour: '#4c8dd6' },
  pivot: { name: 'Pivot joint', colour: '#8e6bd8' },
  gliding: { name: 'Gliding joint', colour: '#3fb68b' },
  saddle: { name: 'Saddle joint', colour: '#e05a8a' },
  fixed: { name: 'Fixed (fibrous) joint', colour: '#9aa3ad' },
};
