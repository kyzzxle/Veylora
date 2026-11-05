/** Plant structures shown in the anatomy explorer. */
export interface PartInfo {
  name: string;
  about: string;
}

export const PARTS: Record<string, PartInfo> = {
  // Whole plant
  flower: { name: 'Flower', about: 'The reproductive organ. It attracts pollinators and produces seeds after fertilization.' },
  leaf: { name: 'Leaf', about: 'The main site of photosynthesis. Its broad, thin shape captures light and lets gases diffuse in and out.' },
  stem: { name: 'Stem', about: 'Supports the leaves and flowers and carries water, minerals and sugars between roots and leaves.' },
  roots: { name: 'Roots', about: 'Anchor the plant and absorb water and mineral ions from the soil. Some also store food.' },
  bud: { name: 'Bud', about: 'An undeveloped shoot. Buds grow into new leaves, stems or flowers.' },
  // Leaf cross-section
  cuticle: { name: 'Waxy cuticle', about: 'A waterproof layer that reduces water loss from the leaf surface.' },
  'upper-epidermis': { name: 'Upper epidermis', about: 'A transparent, protective layer of cells that lets light pass through to the cells below.' },
  palisade: { name: 'Palisade mesophyll', about: 'Tall, tightly packed cells full of chloroplasts — where most photosynthesis happens.' },
  spongy: { name: 'Spongy mesophyll', about: 'Loosely packed cells with air spaces between them, allowing gases to diffuse through the leaf.' },
  'lower-epidermis': { name: 'Lower epidermis', about: 'The lower protective layer, which contains most of the stomata in many plants.' },
  stoma: { name: 'Stoma and guard cells', about: 'A pore that lets carbon dioxide in and oxygen and water vapour out. Two guard cells open and close it.' },
  'leaf-xylem': { name: 'Xylem (in the vein)', about: 'Brings water and minerals into the leaf.' },
  'leaf-phloem': { name: 'Phloem (in the vein)', about: 'Carries sugars made by photosynthesis out of the leaf to the rest of the plant.' },
  // Stem cross-section
  'stem-epidermis': { name: 'Epidermis', about: 'The outer protective layer of the young stem.' },
  cortex: { name: 'Cortex', about: 'Packing and storage tissue between the epidermis and the vascular bundles.' },
  'stem-xylem': { name: 'Xylem', about: 'Dead, hollow, lignified tubes that carry water and minerals upward and help support the stem.' },
  'stem-phloem': { name: 'Phloem', about: 'Living sieve tubes that carry dissolved sugars up or down the plant (translocation).' },
  cambium: { name: 'Cambium', about: 'A layer of dividing cells between xylem and phloem that makes the stem grow thicker (forming wood in trees).' },
  pith: { name: 'Pith', about: 'Soft storage tissue in the centre of the stem.' },
  // Root tip
  'root-cap': { name: 'Root cap', about: 'Protects the growing tip as it pushes through soil, and senses gravity.' },
  meristem: { name: 'Zone of cell division', about: 'Meristem cells divide rapidly by mitosis to produce new cells.' },
  elongation: { name: 'Zone of elongation', about: 'New cells absorb water and lengthen, pushing the root tip deeper.' },
  'root-hairs': { name: 'Root hair cells', about: 'Long thin extensions that hugely increase surface area for absorbing water (by osmosis) and minerals (by active transport).' },
  'root-xylem': { name: 'Xylem (vascular cylinder)', about: 'The central cylinder of xylem and phloem that carries water up from the root.' },
  // Flower
  petal: { name: 'Petal', about: 'Often brightly coloured and scented to attract pollinators.' },
  sepal: { name: 'Sepal', about: 'Protects the flower while it is a bud.' },
  anther: { name: 'Anther', about: 'Produces pollen, which contains the male gametes. Part of the stamen.' },
  filament: { name: 'Filament', about: 'The stalk that holds up the anther. Part of the stamen.' },
  stigma: { name: 'Stigma', about: 'The sticky tip of the carpel that catches pollen.' },
  style: { name: 'Style', about: 'Connects the stigma to the ovary; the pollen tube grows down through it.' },
  ovary: { name: 'Ovary', about: 'Contains the ovules. After fertilization it becomes the fruit.' },
  ovule: { name: 'Ovule', about: 'Contains the female gamete. After fertilization it becomes a seed.' },
};

export const VIEWS = [
  { id: 'plant', label: 'Whole plant' },
  { id: 'leaf', label: 'Leaf section' },
  { id: 'stem', label: 'Stem section' },
  { id: 'root', label: 'Root tip' },
  { id: 'flower', label: 'Flower' },
] as const;
export type ViewId = (typeof VIEWS)[number]['id'];
