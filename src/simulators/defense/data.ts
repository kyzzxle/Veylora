/** Defense structures, pathogen types and pathway steps for the plant defense lab. */

export type PartId = 'cuticle' | 'trichome' | 'prickle' | 'thorn' | 'spine' | 'bark' | 'root';

export interface Part {
  name: string;
  kind: string;
  against: string;
  text: string;
}

export const PARTS: Record<PartId, Part> = {
  cuticle: {
    name: 'Cuticle and epidermis',
    kind: 'Physical barrier',
    against: 'Most microbes, water loss',
    text: 'A waxy cuticle over tightly packed epidermal cells with thick walls is the first barrier. Most microbes cannot cross it: bacteria must find a stoma or a wound, while some fungi bore through with enzymes and pressure.',
  },
  trichome: {
    name: 'Trichomes (leaf hairs)',
    kind: 'Mechanical and chemical',
    against: 'Small insects such as aphids and mites',
    text: 'Leaf hairs make it hard for small insects to walk and feed. Glandular trichomes release sticky or toxic chemicals that can trap them.',
  },
  prickle: {
    name: 'Prickles',
    kind: 'Mechanical defense',
    against: 'Large grazing animals',
    text: 'Prickles, like those on a rose stem, are sharp outgrowths of the epidermis and outer stem. They deter large animals from eating the stem.',
  },
  thorn: {
    name: 'Thorn',
    kind: 'Mechanical defense',
    against: 'Large grazing animals',
    text: 'A true thorn is a modified side shoot ending in a hard, sharp point, as on hawthorn and citrus. Thorns, spines and prickles look alike but grow from different organs.',
  },
  spine: {
    name: 'Spines (cactus)',
    kind: 'Mechanical defense',
    against: 'Large grazing animals',
    text: 'Spines are modified leaves. On a cactus they protect the juicy stem from animals, and also shade it and reduce water loss.',
  },
  bark: {
    name: 'Bark (cork)',
    kind: 'Physical barrier',
    against: 'Microbes, insects, water loss',
    text: 'Cork cells in bark are dead and their walls are filled with waterproof suberin. They seal the stem, and a wound is quickly sealed with new cork.',
  },
  root: {
    name: 'Roots',
    kind: 'Barriers and chemicals',
    against: 'Soil microbes and nematodes',
    text: 'Roots release antimicrobial chemicals into the soil, the root cap sheds slime and cells, and the endodermis with its Casparian strip helps keep microbes out of the xylem.',
  },
};
export const PART_ORDER: PartId[] = ['cuticle', 'trichome', 'prickle', 'thorn', 'spine', 'bark', 'root'];

export type PathogenId = 'bacteria' | 'fungus';
export const PATHOGENS: Record<PathogenId, { name: string; pamp: string; entry: string }> = {
  bacteria: {
    name: 'Bacterium',
    pamp: 'flagellin (from its flagellum)',
    entry: 'Bacteria cannot cross the cuticle. They swim in surface water and get in through open stomata or wounds, then multiply in the spaces between cells.',
  },
  fungus: {
    name: 'Fungus',
    pamp: 'chitin (from its cell wall)',
    entry: 'A fungal spore germinates on the leaf, makes a swollen appressorium and pushes a narrow peg through the cuticle and cell wall.',
  },
};

export const STEPS = [
  { id: 'pamp', name: 'PRRs detect PAMPs', text: 'Pattern recognition receptors (PRRs) on the cell surface recognise molecules common to whole groups of microbes (PAMPs), such as bacterial flagellin or fungal chitin.' },
  { id: 'pti', name: 'Pattern-triggered immunity', text: 'PTI: stomata close, callose reinforces cell walls, reactive oxygen bursts out and antimicrobial chemicals are made. This stops most microbes.' },
  { id: 'eff', name: 'Effectors suppress PTI', text: 'Adapted pathogens inject effector proteins that block PTI. Some bacterial effectors even reopen the stomata.' },
  { id: 'eti', name: 'R protein → ETI', text: 'If the plant has a matching resistance (R) protein, it recognises the effector and triggers effector-triggered immunity (ETI), a faster and stronger response.' },
  { id: 'hr', name: 'Hypersensitive response', text: 'Cells around the infection kill themselves, walling the pathogen off in a small patch of dead tissue.' },
  { id: 'sar', name: 'Systemic acquired resistance', text: 'Salicylic acid and mobile signals travel to the rest of the plant, priming distant leaves to resist later attacks for weeks.' },
] as const;
