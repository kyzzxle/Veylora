/**
 * Data for the animal behaviour and biological rhythms simulator.
 * Free-running periods are typical illustrative values: nocturnal rodents
 * usually run slightly shorter than 24 h in constant darkness, many diurnal
 * animals slightly longer.
 */
export type RhythmId = 'diurnal' | 'nocturnal' | 'crepuscular';

export const RHYTHM: Record<RhythmId, { name: string; animal: string; tau: number; text: string; examples: string }> = {
  diurnal: {
    name: 'Diurnal',
    animal: 'Squirrel',
    tau: 24.4,
    text: 'Diurnal animals are active in daylight and sleep at night. They usually rely on vision, and daylight makes finding food and spotting predators easier.',
    examples: 'squirrels, most songbirds, butterflies, bees, lizards, humans',
  },
  nocturnal: {
    name: 'Nocturnal',
    animal: 'Mouse',
    tau: 23.6,
    text: 'Nocturnal animals are active at night and rest by day. Darkness hides them from many predators, and in hot places the night is cooler and less drying. They often rely on hearing, smell and touch.',
    examples: 'mice, owls, bats, hedgehogs, moths, many desert animals',
  },
  crepuscular: {
    name: 'Crepuscular',
    animal: 'Rabbit',
    tau: 24.1,
    text: 'Crepuscular animals are most active at dawn and dusk, when there is still some light to see by but many predators that hunt by day or by night are less active.',
    examples: 'rabbits, deer, many cats, fireflies, some mosquitoes',
  },
};

export type ExpId = 'instinct' | 'habituation' | 'trial';

export const EXP: Record<ExpId, { title: string; text: string }> = {
  instinct: {
    title: 'Instinct: egg-rolling in the greylag goose',
    text: 'A nesting goose that sees an egg outside its nest stretches out its neck and rolls the egg back with its bill. It does this correctly the first time, without learning. If the egg is removed half-way, the goose still finishes the whole movement: a fixed action pattern.',
  },
  habituation: {
    title: 'Habituation: a snail that is tapped again and again',
    text: 'When a snail is touched, it pulls back into its shell. If the harmless touch is repeated, it pulls back less each time and comes out sooner. A new stimulus, such as the shadow of a bird, still causes a full response.',
  },
  trial: {
    title: 'Trial and error: a young bird learns which prey to avoid',
    text: 'A young bird attacks both plain and striped caterpillars at first. The striped ones taste bad. After one or two bad experiences, the bird learns to leave striped caterpillars alone, but keeps eating the plain ones.',
  },
};
