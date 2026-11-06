/** The five classic plant hormone groups, presets and organ descriptions. */

export type HormoneId = 'aux' | 'ga' | 'ck' | 'aba' | 'eth';

export interface Hormone {
  name: string;
  short: string;
  color: string;
  madeIn: string;
  moves: string;
  effects: string;
}

export const HORMONES: Record<HormoneId, Hormone> = {
  aux: {
    name: 'Auxin',
    short: 'Auxin',
    color: '#f08c00',
    madeIn: 'shoot tips and young leaves',
    moves: 'down the stem, cell to cell (polar transport)',
    effects: 'Cell elongation in stems, apical dominance, root initiation, fruit growth. Inhibits root elongation at high concentrations.',
  },
  ga: {
    name: 'Gibberellins',
    short: 'GA',
    color: '#2f9e44',
    madeIn: 'young leaves, shoot tips, roots and seed embryos',
    moves: 'in xylem and phloem',
    effects: 'Stem elongation, seed germination (starch breakdown in cereal grains), bolting and flowering in some plants, fruit growth.',
  },
  ck: {
    name: 'Cytokinins',
    short: 'Cytokinin',
    color: '#1c7ed6',
    madeIn: 'mainly root tips',
    moves: 'up to the shoot in the xylem',
    effects: 'Cell division, shoot and bud growth, leaf expansion. Delays leaf ageing (senescence).',
  },
  aba: {
    name: 'Abscisic acid (ABA)',
    short: 'ABA',
    color: '#e64980',
    madeIn: 'roots and leaves, especially when short of water',
    moves: 'in xylem and phloem',
    effects: 'Closes stomata during drought, keeps seeds and buds dormant, slows shoot growth under stress.',
  },
  eth: {
    name: 'Ethylene',
    short: 'Ethylene',
    color: '#9775fa',
    madeIn: 'ripening fruit, ageing leaves and stressed tissues',
    moves: 'as a gas, through air spaces and between plants',
    effects: 'Fruit ripening, leaf and fruit fall (abscission), senescence. Slows stem elongation.',
  },
};
export const HORMONE_ORDER: HormoneId[] = ['aux', 'ga', 'ck', 'aba', 'eth'];

/** Hormone levels as a multiple of the normal level (1 = normal, 0 = blocked). */
export type Levels = Record<HormoneId, number>;
export const NORMAL: Levels = { aux: 1, ga: 1, ck: 1, aba: 1, eth: 1 };

export const PRESETS: Record<string, { label: string; levels: Levels; note: string }> = {
  normal: { label: 'Normal', levels: { ...NORMAL }, note: 'All five hormones at their normal levels.' },
  dwarf: {
    label: 'GA-deficient dwarf',
    levels: { ...NORMAL, ga: 0.1 },
    note: 'A mutant that makes very little gibberellin, like Mendel’s dwarf peas. Its internodes stay short.',
  },
  gaspray: {
    label: 'Gibberellin spray',
    levels: { ...NORMAL, ga: 2.5 },
    note: 'Extra gibberellin makes the internodes much longer, as farmers once saw in rice infected by the “foolish seedling” fungus.',
  },
  cytokinin: {
    label: 'Cytokinin spray',
    levels: { ...NORMAL, ck: 2.5 },
    note: 'Extra cytokinin overcomes apical dominance, so side buds grow and the plant becomes bushy. Leaves also stay green longer.',
  },
  ethylene: {
    label: 'Ethylene gas',
    levels: { ...NORMAL, eth: 2.5 },
    note: 'Extra ethylene speeds fruit ripening and leaf ageing, and slows stem elongation.',
  },
};

export type OrganId = 'apex' | 'internode' | 'bud' | 'leaf' | 'root' | 'flower' | 'fruit';
export const ORGANS: Record<OrganId, { name: string; text: string }> = {
  apex: { name: 'Shoot tip', text: 'The apical meristem makes new leaves and stem. It is the main source of auxin, which flows down the stem.' },
  internode: { name: 'Internode', text: 'The stem between two leaves. Its length depends on cell elongation, driven by gibberellin and auxin and slowed by ethylene and ABA.' },
  bud: { name: 'Side (axillary) bud', text: 'A bud in the angle between leaf and stem. Auxin from above keeps it dormant (apical dominance); cytokinin from the roots promotes its growth.' },
  leaf: { name: 'Leaf', text: 'Leaves make sugars and some hormones. ABA closes their stomata in drought; cytokinin keeps them green; ethylene speeds their ageing and fall.' },
  root: { name: 'Roots', text: 'Root tips make cytokinin and ABA. Auxin from the shoot starts new side roots, but high auxin slows root elongation.' },
  flower: { name: 'Flower', text: 'Flowering is controlled by day length and by hormones such as gibberellin.' },
  fruit: { name: 'Fruit', text: 'A ripening fruit makes ethylene, which speeds its own ripening and that of nearby fruit: one ripe fruit can ripen a whole bag.' },
};
