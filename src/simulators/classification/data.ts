/**
 * Dichotomous key for major animal groups, and animals to classify.
 * Each question node has a yes-branch and a no-branch; leaves are groups.
 */

export interface Group {
  id: string;
  name: string;
  about: string;
}

export interface QNode {
  id: string;
  q: string;
  short: string;
  yes: string;
  no: string;
}

export const GROUPS: Record<string, Group> = {
  birds: { id: 'birds', name: 'Birds', about: 'Feathers, beaks, wings, lay hard-shelled eggs, warm-blooded. Not all birds fly.' },
  mammals: { id: 'mammals', name: 'Mammals', about: 'Hair or fur, feed young on milk, warm-blooded. Most give birth to live young; a few lay eggs.' },
  fish: { id: 'fish', name: 'Fish', about: 'Live in water, breathe with gills all their lives, usually have fins and scales.' },
  reptiles: { id: 'reptiles', name: 'Reptiles', about: 'Dry, scaly skin, breathe with lungs, most lay leathery eggs on land, cold-blooded.' },
  amphibians: { id: 'amphibians', name: 'Amphibians', about: 'Moist skin without scales; young usually live in water with gills, adults often breathe with lungs.' },
  insects: { id: 'insects', name: 'Insects', about: 'Arthropods with 6 legs, 3 body parts and usually wings and antennae.' },
  arachnids: { id: 'arachnids', name: 'Arachnids', about: 'Arthropods with 8 legs, 2 body parts and no antennae.' },
  crustaceans: { id: 'crustaceans', name: 'Crustaceans', about: 'Arthropods, mostly aquatic, with many legs, two pairs of antennae and a hard shell.' },
  molluscs: { id: 'molluscs', name: 'Molluscs', about: 'Soft, unsegmented bodies, often protected by a shell; many have a muscular foot.' },
  annelids: { id: 'annelids', name: 'Annelids (segmented worms)', about: 'Long soft bodies divided into many ring-like segments.' },
  cnidarians: { id: 'cnidarians', name: 'Cnidarians', about: 'Soft, often jelly-like bodies with stinging tentacles around a single opening.' },
  echinoderms: { id: 'echinoderms', name: 'Echinoderms', about: 'Spiny skin, five-part body symmetry and tube feet; all live in the sea.' },
};

export const NODES: Record<string, QNode> = {
  backbone: { id: 'backbone', q: 'Does it have a backbone?', short: 'Backbone?', yes: 'feathers', no: 'arthropod' },
  feathers: { id: 'feathers', q: 'Does it have feathers?', short: 'Feathers?', yes: 'birds', no: 'hair' },
  hair: { id: 'hair', q: 'Does it have hair or fur (and feed its young on milk)?', short: 'Hair or fur?', yes: 'mammals', no: 'gills' },
  gills: { id: 'gills', q: 'Does it breathe with gills all its life and have fins?', short: 'Gills & fins for life?', yes: 'fish', no: 'scales' },
  scales: { id: 'scales', q: 'Does it have dry, scaly skin?', short: 'Dry scaly skin?', yes: 'reptiles', no: 'amphibians' },
  arthropod: { id: 'arthropod', q: 'Does it have jointed legs and a hard outer skeleton (exoskeleton)?', short: 'Jointed legs?', yes: 'six', no: 'shell' },
  six: { id: 'six', q: 'Does it have exactly six legs?', short: 'Six legs?', yes: 'insects', no: 'eight' },
  eight: { id: 'eight', q: 'Does it have exactly eight legs?', short: 'Eight legs?', yes: 'arachnids', no: 'crustaceans' },
  shell: { id: 'shell', q: 'Does it have a soft, unsegmented body (often with a shell)?', short: 'Soft body?', yes: 'molluscs', no: 'segments' },
  segments: { id: 'segments', q: 'Is its body long and divided into ring-like segments?', short: 'Segmented worm?', yes: 'annelids', no: 'tentacles' },
  tentacles: { id: 'tentacles', q: 'Does it have stinging tentacles?', short: 'Stinging tentacles?', yes: 'cnidarians', no: 'echinoderms' },
};

export interface Animal {
  name: string;
  emoji: string;
  group: string;
  /** Explanations for the questions most likely to trip people up. */
  notes?: Partial<Record<string, string>>;
}

export const ANIMALS: Animal[] = [
  { name: 'Dolphin', emoji: '🐬', group: 'mammals', notes: { gills: 'Dolphins live in water but breathe air with lungs.', hair: 'Dolphins are born with a few whiskers and feed their calves milk — they are mammals.' } },
  { name: 'Bat', emoji: '🦇', group: 'mammals', notes: { feathers: 'Bats fly with skin-covered wings, not feathers.' } },
  { name: 'Platypus', emoji: '🐾', group: 'mammals', notes: { hair: 'A platypus lays eggs, but it has fur and feeds its young milk — it is a mammal.' } },
  { name: 'Penguin', emoji: '🐧', group: 'birds', notes: { feathers: 'Penguins cannot fly, but they are covered in dense feathers.' } },
  { name: 'Eagle', emoji: '🦅', group: 'birds' },
  { name: 'Shark', emoji: '🦈', group: 'fish', notes: { gills: 'Sharks breathe with gills and have fins all their lives, so they are fish — even though their skeleton is made of cartilage.' } },
  { name: 'Salmon', emoji: '🐟', group: 'fish' },
  { name: 'Sea turtle', emoji: '🐢', group: 'reptiles', notes: { gills: 'Sea turtles live in the ocean but breathe air with lungs.' } },
  { name: 'Snake', emoji: '🐍', group: 'reptiles' },
  { name: 'Frog', emoji: '🐸', group: 'amphibians', notes: { scales: 'Frog skin is moist and smooth, not dry and scaly.', gills: 'Tadpoles have gills, but adult frogs breathe with lungs and through their skin.' } },
  { name: 'Salamander', emoji: '🐾', group: 'amphibians', notes: { scales: 'Salamanders look like lizards, but their skin is moist and has no scales — they are amphibians.' } },
  { name: 'Butterfly', emoji: '🦋', group: 'insects' },
  { name: 'Ant', emoji: '🐜', group: 'insects' },
  { name: 'Spider', emoji: '🕷️', group: 'arachnids', notes: { six: 'Spiders have eight legs, so they are not insects.' } },
  { name: 'Scorpion', emoji: '🦂', group: 'arachnids' },
  { name: 'Crab', emoji: '🦀', group: 'crustaceans', notes: { eight: 'Crabs have ten legs (including their claws).' } },
  { name: 'Lobster', emoji: '🦞', group: 'crustaceans' },
  { name: 'Octopus', emoji: '🐙', group: 'molluscs', notes: { arthropod: 'An octopus has soft arms with no joints or exoskeleton.', shell: 'An octopus is a mollusc whose shell has been lost during evolution.' } },
  { name: 'Snail', emoji: '🐌', group: 'molluscs' },
  { name: 'Earthworm', emoji: '🪱', group: 'annelids' },
  { name: 'Jellyfish', emoji: '🪼', group: 'cnidarians', notes: { backbone: 'Despite the name, a jellyfish is not a fish — it has no backbone.' } },
  { name: 'Starfish (sea star)', emoji: '⭐', group: 'echinoderms', notes: { backbone: 'Despite the name, a starfish is not a fish — it has no backbone.' } },
];

/** The correct path through the key for a group: list of [nodeId, answer]. */
export function pathTo(group: string): [string, boolean][] {
  const walk = (id: string, acc: [string, boolean][]): [string, boolean][] | null => {
    if (id === group) return acc;
    const n = NODES[id];
    if (!n) return null;
    return walk(n.yes, [...acc, [id, true]]) ?? walk(n.no, [...acc, [id, false]]);
  };
  return walk('backbone', []) ?? [];
}
