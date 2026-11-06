/**
 * Life-cycle, development and reproduction data. Durations are typical
 * ranges for the named example species and vary with temperature, food and
 * region. Survival numbers are illustrative orders of magnitude, not
 * measurements of a particular population.
 */
export type SpeciesId = 'butterfly' | 'grasshopper' | 'frog' | 'chicken';
export type StageArt =
  | 'bf-egg' | 'bf-larva' | 'bf-pupa' | 'bf-adult'
  | 'gh-egg' | 'gh-nymph' | 'gh-adult'
  | 'fr-spawn' | 'fr-tadpole' | 'fr-legs' | 'fr-froglet' | 'fr-adult'
  | 'ch-egg' | 'ch-embryo' | 'ch-hatch' | 'ch-chick' | 'ch-adult';

export interface Stage {
  name: string;
  art: StageArt;
  duration: string;
  text: string;
  /** Number still alive at this stage, out of the starting eggs (illustrative). */
  alive: number;
}
export interface Species {
  id: SpeciesId;
  name: string;
  example: string;
  development: string;
  developmentShort: 'complete' | 'incomplete' | 'amphibian' | 'direct';
  eggs: string;
  start: number;
  stages: Stage[];
  summary: string;
}

export const SPECIES: Record<SpeciesId, Species> = {
  butterfly: {
    id: 'butterfly',
    name: 'Butterfly',
    example: 'monarch butterfly',
    development: 'Complete metamorphosis (egg → larva → pupa → adult)',
    developmentShort: 'complete',
    eggs: 'A female lays about 300–500 eggs, one at a time on milkweed leaves',
    start: 100,
    summary: 'Butterflies go through complete metamorphosis. The larva (caterpillar) looks and lives nothing like the adult: it is an eating machine, while the adult is built for flying, finding mates and laying eggs. The two stages do not even compete for the same food.',
    stages: [
      { name: 'Egg', art: 'bf-egg', duration: 'about 3–5 days', alive: 100, text: 'A tiny ridged egg, laid singly under a milkweed leaf. Inside, the fertilised cell divides and develops into a tiny caterpillar.' },
      { name: 'Larva (caterpillar)', art: 'bf-larva', duration: 'about 2 weeks', alive: 40, text: 'The caterpillar eats milkweed almost non-stop and grows about 2,000 times heavier. Its tough skin cannot stretch, so it moults (sheds its skin) five times; each stage between moults is an instar. Toxins from milkweed make it taste bad to birds.' },
      { name: 'Pupa (chrysalis)', art: 'bf-pupa', duration: 'about 8–15 days', alive: 10, text: 'Inside the chrysalis, most of the caterpillar’s body is broken down and rebuilt from clusters of cells called imaginal discs into wings, legs, antennae and adult organs. It looks still, but it is the most dramatic stage of all.' },
      { name: 'Adult (butterfly)', art: 'bf-adult', duration: '2–6 weeks; up to about 8 months for migrating monarchs', alive: 5, text: 'The adult drinks nectar, mates and lays eggs. It does not grow any more. The final generation each autumn migrates thousands of kilometres to overwinter in Mexico or California.' },
    ],
  },
  grasshopper: {
    id: 'grasshopper',
    name: 'Grasshopper',
    example: 'grasshopper',
    development: 'Incomplete metamorphosis (egg → nymph → adult)',
    developmentShort: 'incomplete',
    eggs: 'A female lays pods of about 15–150 eggs in the soil, several pods in a season',
    start: 100,
    summary: 'Grasshoppers go through incomplete metamorphosis. There is no pupa: the young (nymphs) look like small adults without full wings, eat the same plants as their parents, and change gradually with each moult.',
    stages: [
      { name: 'Egg', art: 'gh-egg', duration: 'often several months (many overwinter in the soil)', alive: 100, text: 'Eggs are laid in a frothy pod in the soil, where many survive the winter before hatching in spring.' },
      { name: 'Nymph', art: 'gh-nymph', duration: 'about 5–7 weeks, through 5–6 moults', alive: 15, text: 'Nymphs look like small, wingless adults and eat the same plants. Their wing buds grow a little larger with each moult.' },
      { name: 'Adult', art: 'gh-adult', duration: 'several weeks to a few months', alive: 5, text: 'After the final moult the adult has full wings and can reproduce. Unlike a butterfly, it did not pass through a pupa.' },
    ],
  },
  frog: {
    id: 'frog',
    name: 'Frog',
    example: 'common frog',
    development: 'Metamorphosis from an aquatic larva (tadpole) to a land-living adult',
    developmentShort: 'amphibian',
    eggs: 'A female lays a clump of about 1,000–2,000 eggs in water',
    start: 1000,
    summary: 'Frogs reproduce in water. The tadpole breathes with gills, eats algae and swims with a tail; the adult breathes with lungs and skin, eats insects and hops on land. Hormones from the thyroid gland trigger the change, called metamorphosis.',
    stages: [
      { name: 'Eggs (frogspawn)', art: 'fr-spawn', duration: 'about 1–3 weeks', alive: 1000, text: 'Eggs are fertilised outside the body as the female lays them. Each black embryo is protected by a ball of jelly that swells in the water.' },
      { name: 'Tadpole', art: 'fr-tadpole', duration: 'several weeks', alive: 400, text: 'The tadpole has a tail for swimming and gills for breathing underwater, first outside and then hidden under a fold of skin. It scrapes algae with tiny horny teeth.' },
      { name: 'Tadpole with legs', art: 'fr-legs', duration: 'about 6–10 weeks after hatching', alive: 80, text: 'Back legs grow first, then front legs. Lungs develop, and the tadpole starts gulping air at the surface.' },
      { name: 'Froglet', art: 'fr-froglet', duration: 'about 12–16 weeks after hatching', alive: 20, text: 'The tail is absorbed, providing energy, the gut shortens for a meat diet, and the young frog leaves the water.' },
      { name: 'Adult frog', art: 'fr-adult', duration: 'breeds after about 2–3 years', alive: 5, text: 'The adult breathes with lungs and its moist skin, hunts insects, and returns to the water to breed.' },
    ],
  },
  chicken: {
    id: 'chicken',
    name: 'Chicken',
    example: 'chicken',
    development: 'Direct development inside an amniotic egg (no larva)',
    developmentShort: 'direct',
    eggs: 'A wild junglefowl hen lays a clutch of about 4–8 eggs; farm hens about 250–300 eggs a year',
    start: 8,
    summary: 'Birds lay shelled eggs on land. Inside, membranes keep the embryo moist (the amnion), store waste and exchange gases (the allantois), and a large yolk feeds it. The chick hatches looking like a small version of its parents: there is no larval stage.',
    stages: [
      { name: 'Fertilised egg', art: 'ch-egg', duration: 'laid about a day after fertilisation', alive: 8, text: 'Fertilisation happens inside the hen. As the egg travels down the oviduct, it gains egg white (albumen), membranes and a porous shell. Only fertilised eggs that are kept warm develop.' },
      { name: 'Embryo', art: 'ch-embryo', duration: 'incubation: 21 days in total', alive: 7, text: 'The embryo grows on top of the yolk, which feeds it through blood vessels. A heart beats within about two days, and the beak, legs and feathers form by the second week. Air passes through tiny pores in the shell.' },
      { name: 'Hatching', art: 'ch-hatch', duration: 'about day 20–21', alive: 6, text: 'The chick breaks into the air space and starts breathing, then chips its way out using a small “egg tooth” on its beak.' },
      { name: 'Chick', art: 'ch-chick', duration: 'grows for about 4–5 months', alive: 4, text: 'Chicks hatch with down feathers and open eyes and can walk and feed almost at once, but stay close to the hen for warmth and protection.' },
      { name: 'Adult hen', art: 'ch-adult', duration: 'starts laying at about 18–22 weeks', alive: 3, text: 'The adult reproduces. Hens lay eggs whether or not they have mated; only eggs fertilised by a rooster can develop into chicks.' },
    ],
  },
};

export interface DevStep {
  name: string;
  text: (internal: boolean) => string;
}
export const DEV_STEPS: DevStep[] = [
  { name: 'Sperm meet the egg', text: (i) => (i ? 'Internal fertilisation (chicken): the rooster transfers sperm into the hen, and fertilisation happens inside her body, before the shell is added. This protects sperm and eggs from drying out on land.' : 'External fertilisation (frog): the male clasps the female and releases sperm over the eggs as she lays them in the water. Huge numbers of eggs and sperm make up for the losses.') },
  { name: 'Fertilisation', text: () => 'One sperm fuses with the egg. Its nucleus joins the egg’s nucleus. The egg then changes its surface so that no other sperm can enter.' },
  { name: 'Zygote', text: (i) => `The fertilised egg, the zygote, has two sets of chromosomes: one from each parent (a ${i ? 'chicken has 78' : 'clawed frog has 36'} chromosomes per body cell, half from the egg and half from the sperm).` },
  { name: '2 cells', text: () => 'Cleavage begins: the zygote divides by mitosis into 2 cells, then 4, then 8. The cells get smaller each time; the embryo does not grow yet.' },
  { name: '4 cells', text: () => 'Each division copies all the chromosomes, so every cell has the same genetic information.' },
  { name: '8 cells', text: () => 'Divisions continue rapidly. In a frog egg the yolk-filled lower half divides more slowly than the top.' },
  { name: 'Morula and blastula', text: () => 'A solid ball of cells (morula) becomes a hollow ball (blastula), with a fluid-filled space inside.' },
  { name: 'Gastrula', text: () => 'Cells move inwards to form three germ layers: ectoderm (outer, becomes skin and nerves), mesoderm (middle, becomes muscle, bone and blood) and endoderm (inner, becomes the gut lining).' },
  { name: 'Organ formation', text: (i) => (i ? 'Organs begin to form: the neural tube becomes the brain and spinal cord, and a heart starts beating within about two days in a chick. The embryo then develops inside the egg until it hatches.' : 'Organs begin to form: the neural tube becomes the brain and spinal cord. Within days a tadpole hatches from the jelly and starts life as a free-swimming larva.') },
];

export type BirthId = 'ovi' | 'ovovivi' | 'vivi';
export const BIRTH: Record<BirthId, { name: string; examples: string; where: string; food: string; text: string }> = {
  ovi: { name: 'Oviparous (egg-laying)', examples: 'birds, most reptiles, most fish, most insects, frogs; also platypus and echidnas', where: 'Outside the mother, in an egg', food: 'The yolk inside the egg', text: 'Eggs are laid and the embryo develops outside the mother. Egg-laying frees the mother from carrying the young, but eggs can be eaten or must be guarded, and birds must keep them warm.' },
  ovovivi: { name: 'Ovoviviparous (eggs kept inside)', examples: 'some sharks, many vipers and garter snakes, some lizards and fish', where: 'Inside the mother, in eggs that hatch inside her', food: 'Mainly the yolk; the mother provides protection, with little or no direct feeding', text: 'Eggs stay inside the mother’s body until they hatch, so the young are born live. The mother protects the eggs but mostly does not feed them. Many biologists now treat this as one form of live birth (viviparity), because there is a range of in-between cases.' },
  vivi: { name: 'Viviparous (live birth)', examples: 'most mammals; also some sharks, lizards and fish', where: 'Inside the mother, usually in a uterus', food: 'Nutrients from the mother, in mammals through a placenta', text: 'The embryo develops inside the mother and is fed by her, in most mammals through a placenta that brings nutrients and oxygen from her blood and removes wastes. Young are born live and usually cared for afterwards. This gives protection but limits how many young a mother can carry.' },
};
