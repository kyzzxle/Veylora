/** Flower parts, pollination sources and the stages from pollination to fruit. */

export type PartId = 'sepal' | 'petal' | 'filament' | 'anther' | 'stigma' | 'style' | 'ovary' | 'ovule';

export interface Part {
  name: string;
  group: string;
  job: string;
  after: string;
}

export const PARTS: Record<PartId, Part> = {
  sepal: {
    name: 'Sepal',
    group: 'Calyx: protects the bud',
    job: 'Green, leaf-like sepals enclose and protect the flower while it is still a bud.',
    after: 'Usually wither (the green cap of a strawberry or tomato is the sepals)',
  },
  petal: {
    name: 'Petal',
    group: 'Corolla: attracts pollinators',
    job: 'Coloured, often scented petals advertise the flower to pollinators. Many have nectar guides that bees see in ultraviolet light.',
    after: 'Wilt and fall off',
  },
  filament: {
    name: 'Filament',
    group: 'Stamen (male part)',
    job: 'The stalk of a stamen. It holds the anther where a visiting animal, or the wind, will brush against it.',
    after: 'Withers and falls off',
  },
  anther: {
    name: 'Anther',
    group: 'Stamen (male part)',
    job: 'Makes pollen grains. Each pollen grain is a tiny male gametophyte that produces two sperm cells: the grain itself is not a sperm.',
    after: 'Withers and falls off',
  },
  stigma: {
    name: 'Stigma',
    group: 'Carpel (female part)',
    job: 'The sticky tip of the carpel that catches pollen (feathery in wind-pollinated flowers). Pollination is complete when pollen lands here.',
    after: 'Withers',
  },
  style: {
    name: 'Style',
    group: 'Carpel (female part)',
    job: 'The stalk joining the stigma to the ovary. Pollen tubes grow down through it to reach the ovules.',
    after: 'Withers',
  },
  ovary: {
    name: 'Ovary',
    group: 'Carpel (female part)',
    job: 'The swollen base of the carpel. It encloses and protects the ovules.',
    after: 'Becomes the fruit',
  },
  ovule: {
    name: 'Ovule',
    group: 'Carpel (female part)',
    job: 'Contains the embryo sac (the female gametophyte) with the egg cell and the central cell. Each ovule needs its own pollen tube.',
    after: 'Becomes a seed',
  },
};
export const PART_ORDER: PartId[] = ['sepal', 'petal', 'filament', 'anther', 'stigma', 'style', 'ovary', 'ovule'];

/** The three flowers in the pollination experiment: two plants of one species and one of another species. */
export const FLOWERS = [
  { name: 'Plant 1', species: 0, petal: '#f783ac', pollen: '#f2c94c', pollenName: 'gold' },
  { name: 'Plant 2', species: 0, petal: '#f783ac', pollen: '#ff922b', pollenName: 'orange' },
  { name: 'Another species', species: 1, petal: '#74c0fc', pollen: '#b197fc', pollenName: 'lilac' },
] as const;

export type StageId = 'land' | 'germinate' | 'tube' | 'enter' | 'double' | 'seed' | 'fruit';
export interface Stage {
  id: StageId;
  name: string;
  where: string;
  phase: string;
  text: string;
}

export const STAGES: Stage[] = [
  {
    id: 'land',
    name: 'Pollination',
    where: 'Stigma',
    phase: 'Pollination',
    text: 'A bee brings a pollen grain from another plant of the same species, and it sticks to the stigma. This transfer of pollen from an anther to a stigma is pollination. Nothing has been fertilised yet.',
  },
  {
    id: 'germinate',
    name: 'Pollen germinates',
    where: 'Stigma',
    phase: 'Between pollination and fertilisation',
    text: 'The stigma accepts compatible pollen, and the grain takes up water. Its tube cell grows a pollen tube, and the generative cell divides by mitosis into two sperm cells. (In some plants, such as grasses, this division has already happened inside the anther.)',
  },
  {
    id: 'tube',
    name: 'Pollen tube grows',
    where: 'Style',
    phase: 'Between pollination and fertilisation',
    text: 'The pollen tube grows down through the style, guided by chemical signals from the ovule. The tube nucleus leads and the two sperm cells travel inside the tube. Flowering-plant sperm cannot swim: the tube delivers them.',
  },
  {
    id: 'enter',
    name: 'Sperm delivered',
    where: 'Ovule (embryo sac)',
    phase: 'Between pollination and fertilisation',
    text: 'The tube enters the ovule through a small opening, the micropyle, grows into one of the two synergid cells beside the egg and bursts, releasing both sperm cells into the embryo sac.',
  },
  {
    id: 'double',
    name: 'Double fertilisation',
    where: 'Embryo sac',
    phase: 'Fertilisation',
    text: 'One sperm fuses with the egg cell (n + n), forming a diploid zygote (2n). The other sperm fuses with the central cell and its two polar nuclei (n + n + n), forming a triploid primary endosperm nucleus (3n). Two fusions: double fertilisation.',
  },
  {
    id: 'seed',
    name: 'Ovule becomes a seed',
    where: 'Ovule',
    phase: 'Seed development',
    text: 'The zygote divides by mitosis into an embryo with a root, a shoot and one or two seed leaves (cotyledons). The endosperm nucleus divides to make endosperm, a food store. The outer layers of the ovule (integuments) harden into the seed coat.',
  },
  {
    id: 'fruit',
    name: 'Ovary becomes a fruit',
    where: 'Ovary',
    phase: 'Fruit development',
    text: 'The ovary wall grows into the fruit wall, which protects the seeds and helps to spread them. Petals, stamens, style and stigma wither and fall. A pea pod, a tomato and a cherry are all ripened ovaries.',
  },
];
