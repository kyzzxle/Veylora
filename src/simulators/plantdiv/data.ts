/**
 * Data for the plant diversity and life cycles simulator.
 * Dates are approximate first appearances in the fossil record; species
 * counts are rounded estimates of living species.
 */
export type GroupId = 'bryo' | 'fern' | 'gymno' | 'angio';
export type Art =
  | 'moss' | 'liverwort' | 'hornwort' | 'fern' | 'horsetail' | 'clubmoss' | 'pine' | 'ginkgo' | 'cycad' | 'oak' | 'grass' | 'rose';

export const GROUPS: Record<GroupId, { name: string; short: string; when: string; mya: number; species: string; art: Art; text: string; traits: string[] }> = {
  bryo: {
    name: 'Bryophytes',
    short: 'Mosses, liverworts, hornworts',
    when: '~470 million years ago',
    mya: 470,
    species: '~20,000 species',
    art: 'moss',
    text: 'The earliest land plants to survive today (Mya = million years ago). They have no lignified vascular tissue, so they stay small and absorb water over their whole surface. The green plant you see is the haploid gametophyte, and their sperm must swim through water.',
    traits: ['No vascular tissue', 'Rhizoids, no true roots', 'Spores', 'Gametophyte dominant'],
  },
  fern: {
    name: 'Ferns and allies',
    short: 'Ferns, horsetails, clubmosses',
    when: '~430 million years ago',
    mya: 430,
    species: '~13,000 species',
    art: 'fern',
    text: 'The first plants with vascular tissue: xylem strengthened with lignin, and phloem. This let them grow tall, with true roots, stems and leaves. They still reproduce with spores and need water for their swimming sperm. The fern you see is the diploid sporophyte.',
    traits: ['Vascular tissue (xylem, phloem)', 'True roots, stems, leaves', 'Spores', 'Sporophyte dominant'],
  },
  gymno: {
    name: 'Gymnosperms',
    short: 'Conifers, cycads, ginkgo',
    when: '~360 million years ago (seeds)',
    mya: 360,
    species: '~1,100 species',
    art: 'pine',
    text: 'Seed plants whose seeds are “naked”: they sit on the surface of cone scales instead of inside a fruit. Pollen carries the male gametes, usually on the wind, so fertilisation no longer needs a film of water.',
    traits: ['Vascular tissue', 'Pollen and seeds', 'Seeds on cone scales (no fruit)', 'Sporophyte dominant'],
  },
  angio: {
    name: 'Angiosperms',
    short: 'Flowering plants',
    when: '~140 million years ago',
    mya: 140,
    species: '~300,000 species',
    art: 'rose',
    text: 'Flowering plants, by far the largest group. Their ovules are enclosed in an ovary, which becomes a fruit that protects and spreads the seeds. Flowers can attract animal pollinators. Grasses and most trees, such as oaks, are flowering plants too.',
    traits: ['Vascular tissue', 'Flowers', 'Seeds enclosed in fruits', 'Sporophyte dominant'],
  },
};
export const GROUP_ORDER: GroupId[] = ['angio', 'gymno', 'fern', 'bryo'];

export const INNOVATIONS: { name: string; between: [GroupId | null, GroupId]; text: string }[] = [
  { name: 'Life on land', between: [null, 'bryo'], text: 'The first land plants (about 470 million years ago) evolved from green algae. A waxy cuticle reduced drying out, spores had tough walls, and embryos were protected inside the parent plant.' },
  { name: 'Vascular tissue', between: ['bryo', 'fern'], text: 'Xylem and phloem: tubes that carry water and food, with xylem walls strengthened by lignin. Plants could now grow tall, with true roots and leaves.' },
  { name: 'Seeds and pollen', between: ['fern', 'gymno'], text: 'Pollen carries male gametes through the air, so fertilisation no longer needs water. A seed packages an embryo with a food store and a protective coat, and can wait for good conditions.' },
  { name: 'Flowers and fruits', between: ['gymno', 'angio'], text: 'Flowers attract animal pollinators and enclose the ovules in an ovary, which develops into a fruit that helps spread the seeds.' },
];

export const SPECIMENS: { id: Art; name: string; group: GroupId; hint: string }[] = [
  { id: 'moss', name: 'Moss', group: 'bryo', hint: 'A moss has no vascular tissue and reproduces with spores from a capsule.' },
  { id: 'liverwort', name: 'Liverwort', group: 'bryo', hint: 'Liverworts are flat, simple plants with no vascular tissue: bryophytes.' },
  { id: 'hornwort', name: 'Hornwort', group: 'bryo', hint: 'Hornworts are bryophytes: their horn-shaped sporophytes grow from a flat gametophyte.' },
  { id: 'fern', name: 'Fern', group: 'fern', hint: 'Ferns have vascular tissue but no seeds: they make spores under their fronds.' },
  { id: 'horsetail', name: 'Horsetail', group: 'fern', hint: 'Horsetails have vascular tissue and make spores in cones, but no seeds: ferns and allies.' },
  { id: 'clubmoss', name: 'Clubmoss', group: 'fern', hint: 'Despite the name, a clubmoss is not a moss: it has vascular tissue. It makes spores, not seeds.' },
  { id: 'pine', name: 'Pine', group: 'gymno', hint: 'Pines make seeds on the scales of woody cones, not inside fruits: gymnosperms.' },
  { id: 'ginkgo', name: 'Ginkgo', group: 'gymno', hint: 'Ginkgo has naked seeds with a fleshy coat, not true fruits: a gymnosperm.' },
  { id: 'cycad', name: 'Cycad', group: 'gymno', hint: 'Cycads look like palms but make seeds in cones: gymnosperms.' },
  { id: 'oak', name: 'Oak', group: 'angio', hint: 'Oaks have (small, wind-pollinated) flowers, and the acorn is a fruit: an angiosperm.' },
  { id: 'grass', name: 'Grass', group: 'angio', hint: 'Grasses have small wind-pollinated flowers, and each grain is a fruit: angiosperms.' },
  { id: 'rose', name: 'Rose', group: 'angio', hint: 'Roses have flowers and fruits (rose hips): angiosperms.' },
];

export type CycleId = 'moss' | 'fern' | 'pine' | 'flower';
export interface Stage {
  name: string;
  ploidy: 'n' | '2n';
  gen: 'Gametophyte' | 'Sporophyte';
  art: string;
  next: string; // the process leading to the next stage
  water?: boolean;
  text: string;
}
export const CYCLES: Record<CycleId, { name: string; group: GroupId; dominant: 'Gametophyte' | 'Sporophyte'; sizes: [string, string]; disperse: string; stages: Stage[] }> = {
  moss: {
    name: 'Moss',
    group: 'bryo',
    dominant: 'Gametophyte',
    sizes: ['Leafy plant, a few cm', 'Stalk and capsule growing on it, a few cm'],
    disperse: 'Spores, by wind',
    stages: [
      { name: 'Leafy moss plant', ploidy: 'n', gen: 'Gametophyte', art: 'moss-gam', next: 'mitosis makes gametes', text: 'The green, leafy moss is the gametophyte: every cell is haploid (n). It is the long-lived, dominant stage and makes its own food.' },
      { name: 'Sperm swim to the egg', ploidy: 'n', gen: 'Gametophyte', art: 'moss-gametes', next: 'fertilisation', water: true, text: 'Male organs (antheridia) release sperm with two flagella. They must swim through a film of rain or dew to the egg inside a female organ (archegonium), so mosses need water to reproduce.' },
      { name: 'Zygote', ploidy: '2n', gen: 'Sporophyte', art: 'zygote', next: 'grows by mitosis', text: 'Sperm and egg fuse to form a diploid (2n) zygote, the first cell of the sporophyte generation.' },
      { name: 'Sporophyte on the moss', ploidy: '2n', gen: 'Sporophyte', art: 'moss-spo', next: 'meiosis in the capsule', text: 'The zygote grows into a stalk with a capsule on top. It stays attached to the gametophyte and depends on it for water and food.' },
      { name: 'Spores', ploidy: 'n', gen: 'Gametophyte', art: 'spores', next: 'germination', text: 'Inside the capsule, meiosis produces haploid spores. The capsule opens and the wind carries them away.' },
      { name: 'Protonema', ploidy: 'n', gen: 'Gametophyte', art: 'protonema', next: 'grows leafy shoots', text: 'A spore germinates into a green, thread-like protonema, which grows buds that develop into new leafy moss plants.' },
    ],
  },
  fern: {
    name: 'Fern',
    group: 'fern',
    dominant: 'Sporophyte',
    sizes: ['Prothallus, about 1 cm, lives independently', 'Fern plant with fronds, often 1 m or more'],
    disperse: 'Spores, by wind',
    stages: [
      { name: 'Fern plant', ploidy: '2n', gen: 'Sporophyte', art: 'fern-spo', next: 'meiosis in sporangia', text: 'The familiar fern, with roots, a stem (rhizome) and fronds, is the diploid sporophyte. It has vascular tissue and is the dominant stage.' },
      { name: 'Sori and spores', ploidy: 'n', gen: 'Gametophyte', art: 'sori', next: 'spores germinate', text: 'Brown clusters (sori) under the fronds contain sporangia, where meiosis makes haploid spores. The sporangia flick the spores into the air.' },
      { name: 'Prothallus', ploidy: 'n', gen: 'Gametophyte', art: 'prothallus', next: 'mitosis makes gametes', text: 'A spore grows into a tiny, heart-shaped prothallus: the gametophyte. It is only about 1 cm across but lives independently, making its own food.' },
      { name: 'Sperm swim to the egg', ploidy: 'n', gen: 'Gametophyte', art: 'fern-gametes', next: 'fertilisation', water: true, text: 'On the underside of the prothallus, sperm are released and must swim through water to an egg in an archegonium.' },
      { name: 'Young fern', ploidy: '2n', gen: 'Sporophyte', art: 'young-fern', next: 'grows', text: 'The diploid zygote grows into a young sporophyte that sprouts from the prothallus, which then dies.' },
    ],
  },
  pine: {
    name: 'Pine (conifer)',
    group: 'gymno',
    dominant: 'Sporophyte',
    sizes: ['Microscopic: inside pollen grains and ovules', 'The whole tree'],
    disperse: 'Winged seeds, by wind',
    stages: [
      { name: 'Pine tree', ploidy: '2n', gen: 'Sporophyte', art: 'pine-spo', next: 'meiosis in cones', text: 'The tree is the diploid sporophyte. It produces two kinds of cones: small male cones and larger female cones.' },
      { name: 'Pollen and ovules', ploidy: 'n', gen: 'Gametophyte', art: 'cones', next: 'wind pollination', text: 'Male cones make pollen grains, each a tiny male gametophyte with two air sacs. Ovules on the female cone scales each contain a female gametophyte with eggs.' },
      { name: 'Pollination', ploidy: 'n', gen: 'Gametophyte', art: 'pine-pollination', next: 'a pollen tube grows', text: 'Wind carries pollen to the female cones. No water film is needed. In pines, fertilisation happens about a year later.' },
      { name: 'Fertilisation', ploidy: '2n', gen: 'Sporophyte', art: 'pine-fert', next: 'embryo develops', text: 'A pollen tube grows through the ovule and delivers a sperm cell to the egg. The zygote (2n) develops into an embryo.' },
      { name: 'Winged seed', ploidy: '2n', gen: 'Sporophyte', art: 'pine-seed', next: 'wind dispersal and germination', text: 'The ovule becomes a seed: an embryo, a food store and a protective coat. The seed lies “naked” on the cone scale, not inside a fruit, and has a wing for the wind.' },
      { name: 'Seedling', ploidy: '2n', gen: 'Sporophyte', art: 'seedling', next: 'grows into a tree', text: 'In good conditions the seed germinates and the seedling grows into a new tree.' },
    ],
  },
  flower: {
    name: 'Flowering plant',
    group: 'angio',
    dominant: 'Sporophyte',
    sizes: ['Microscopic: pollen grain (2–3 cells) and embryo sac (7 cells)', 'The whole plant'],
    disperse: 'Seeds in fruits, by wind, water or animals',
    stages: [
      { name: 'Flowering plant', ploidy: '2n', gen: 'Sporophyte', art: 'flower-spo', next: 'meiosis in anthers and ovules', text: 'The plant with roots, leaves and flowers is the diploid sporophyte.' },
      { name: 'Pollen and embryo sac', ploidy: 'n', gen: 'Gametophyte', art: 'flower-section', next: 'pollination', text: 'Anthers make pollen grains (male gametophytes). Each ovule, inside the ovary, contains an embryo sac (the female gametophyte) with an egg.' },
      { name: 'Pollination', ploidy: 'n', gen: 'Gametophyte', art: 'pollination', next: 'a pollen tube grows', text: 'Insects, birds, wind or water carry pollen to the stigma of a flower. No water film is needed for the sperm.' },
      { name: 'Double fertilisation', ploidy: '2n', gen: 'Sporophyte', art: 'double-fert', next: 'seed and fruit develop', text: 'A pollen tube delivers two sperm: one fertilises the egg to make the zygote (2n); the other fuses with the central cell to form the endosperm, the seed’s food store (usually 3n). See the Plant Reproduction topic for the details.' },
      { name: 'Fruit and seeds', ploidy: '2n', gen: 'Sporophyte', art: 'fruit', next: 'dispersal and germination', text: 'Ovules become seeds and the ovary becomes a fruit, which helps spread the seeds by wind, water or animals.' },
      { name: 'Seedling', ploidy: '2n', gen: 'Sporophyte', art: 'seedling', next: 'grows and flowers', text: 'The seed germinates and grows into a new sporophyte.' },
    ],
  },
};
