/** Organelles shown in the 3D cell models. */
export type CellKind = 'animal' | 'plant';

export interface Organelle {
  id: string;
  name: string;
  job: string;
  detail: string;
  foundIn: 'Animal and plant cells' | 'Plant cells only' | 'Animal cells (and some plant cells)';
  colour: string;
}

export const ORGANELLES: Record<string, Organelle> = {
  membrane: {
    id: 'membrane',
    name: 'Cell membrane',
    job: 'Controls what enters and leaves the cell.',
    detail: 'A thin, flexible double layer of phospholipids with proteins embedded in it. It is selectively permeable.',
    foundIn: 'Animal and plant cells',
    colour: '#7fc8f8',
  },
  nucleus: {
    id: 'nucleus',
    name: 'Nucleus',
    job: 'Contains the DNA and controls the cell’s activities.',
    detail: 'Surrounded by a double nuclear envelope with pores. Inside, the nucleolus makes ribosome subunits.',
    foundIn: 'Animal and plant cells',
    colour: '#8e6bd8',
  },
  nucleolus: {
    id: 'nucleolus',
    name: 'Nucleolus',
    job: 'Makes the parts of ribosomes.',
    detail: 'A dense region inside the nucleus where ribosomal RNA is made and assembled with proteins.',
    foundIn: 'Animal and plant cells',
    colour: '#4b2a91',
  },
  mitochondria: {
    id: 'mitochondria',
    name: 'Mitochondria',
    job: 'Release energy from food by aerobic respiration.',
    detail: 'Their folded inner membrane (cristae) provides a large surface for making ATP. They contain their own small loop of DNA.',
    foundIn: 'Animal and plant cells',
    colour: '#f08a4b',
  },
  rer: {
    id: 'rer',
    name: 'Rough endoplasmic reticulum',
    job: 'Makes and transports proteins.',
    detail: 'A network of flattened sacs studded with ribosomes, continuous with the nuclear envelope.',
    foundIn: 'Animal and plant cells',
    colour: '#5ab4ac',
  },
  ser: {
    id: 'ser',
    name: 'Smooth endoplasmic reticulum',
    job: 'Makes lipids and helps detoxify substances.',
    detail: 'Tubular membranes without ribosomes. In liver cells it breaks down drugs and toxins.',
    foundIn: 'Animal and plant cells',
    colour: '#9fd8c6',
  },
  golgi: {
    id: 'golgi',
    name: 'Golgi apparatus',
    job: 'Modifies, packages and ships proteins.',
    detail: 'A stack of flattened sacs that sorts proteins and lipids into vesicles bound for the membrane or other organelles.',
    foundIn: 'Animal and plant cells',
    colour: '#f2c14e',
  },
  ribosomes: {
    id: 'ribosomes',
    name: 'Ribosomes',
    job: 'Build proteins from amino acids.',
    detail: 'Tiny structures of RNA and protein, free in the cytoplasm or attached to the rough ER. They read messenger RNA.',
    foundIn: 'Animal and plant cells',
    colour: '#3d5a80',
  },
  lysosomes: {
    id: 'lysosomes',
    name: 'Lysosomes',
    job: 'Digest worn-out parts and engulfed material.',
    detail: 'Small vesicles full of digestive enzymes. Plant cells use their vacuole for many similar jobs.',
    foundIn: 'Animal cells (and some plant cells)',
    colour: '#e05a8a',
  },
  centrioles: {
    id: 'centrioles',
    name: 'Centrioles',
    job: 'Help organise the spindle during cell division.',
    detail: 'A pair of short cylinders of microtubules at right angles to each other. Most plant cells lack them.',
    foundIn: 'Animal cells (and some plant cells)',
    colour: '#c9a227',
  },
  wall: {
    id: 'wall',
    name: 'Cell wall',
    job: 'Supports and protects the cell and stops it bursting.',
    detail: 'A rigid layer of cellulose outside the membrane. It is fully permeable to water and dissolved substances.',
    foundIn: 'Plant cells only',
    colour: '#7cae4b',
  },
  chloroplasts: {
    id: 'chloroplasts',
    name: 'Chloroplasts',
    job: 'Carry out photosynthesis.',
    detail: 'Contain chlorophyll in stacks of membranes (grana). Like mitochondria, they have their own DNA.',
    foundIn: 'Plant cells only',
    colour: '#3f9e4a',
  },
  vacuole: {
    id: 'vacuole',
    name: 'Large central vacuole',
    job: 'Stores water and keeps the cell firm (turgid).',
    detail: 'Filled with cell sap and surrounded by a membrane (tonoplast). It can take up most of the cell’s volume.',
    foundIn: 'Plant cells only',
    colour: '#9ad1ff',
  },
};

export const ORGANELLE_LIST: Record<CellKind, string[]> = {
  animal: ['membrane', 'nucleus', 'nucleolus', 'mitochondria', 'rer', 'ser', 'golgi', 'ribosomes', 'lysosomes', 'centrioles'],
  plant: ['wall', 'membrane', 'vacuole', 'chloroplasts', 'nucleus', 'nucleolus', 'mitochondria', 'rer', 'golgi', 'ribosomes'],
};
