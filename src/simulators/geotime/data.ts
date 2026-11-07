/**
 * Geological time intervals and events, rock-layer sequence, fossil types and isotope systems.
 * Ages in millions of years ago (Ma), following the International Chronostratigraphic Chart
 * (ICS, 2023). Boundaries marked approx are not fixed by a dated reference point or are rounded.
 */

export interface Interval {
  name: string;
  start: number; // Ma (older)
  end: number; // Ma (younger)
  color: string;
  level: 0 | 1 | 2; // eon, era, period
  approx?: boolean;
  text: string;
}

export const INTERVALS: Interval[] = [
  { name: 'Precambrian', start: 4567, end: 538.8, color: '#f06292', level: 0, text: 'Almost 90% of Earth’s history: the planet forms, the oceans and continents appear, life begins as microbes and oxygen builds up in the air. Informally split into the Hadean, Archean and Proterozoic eons.' },
  { name: 'Phanerozoic', start: 538.8, end: 0, color: '#74c0fc', level: 0, text: 'The eon of “visible life”, from the Cambrian explosion of animal life to today.' },
  { name: 'Hadean', start: 4567, end: 4031, color: '#ae3e8b', level: 1, approx: true, text: 'Earth forms and is heavily bombarded. The oldest known mineral grains (zircons) date from about 4,400 Ma.' },
  { name: 'Archean', start: 4031, end: 2500, color: '#e64980', level: 1, text: 'The first continents and the earliest widely accepted fossils: stromatolites built by microbial mats.' },
  { name: 'Proterozoic', start: 2500, end: 538.8, color: '#f783ac', level: 1, text: 'Oxygen builds up in the atmosphere, complex (eukaryotic) cells appear, and the first large multicellular organisms (the Ediacaran biota) live near the end.' },
  { name: 'Paleozoic Era', start: 538.8, end: 251.9, color: '#99c1a8', level: 1, text: 'The “era of ancient life”: animals diversify in the seas, then plants, arthropods and vertebrates move onto land. Ends with the largest mass extinction.' },
  { name: 'Mesozoic Era', start: 251.9, end: 66.0, color: '#7ec8c8', level: 1, text: 'The “age of reptiles”: dinosaurs, the first mammals, birds and flowering plants. Ends with an asteroid impact and mass extinction.' },
  { name: 'Cenozoic Era', start: 66.0, end: 0, color: '#ffd43b', level: 1, text: 'The “age of mammals”: mammals and birds diversify, grasslands spread, and humans appear.' },
  { name: 'Cambrian', start: 538.8, end: 486.9, color: '#7fa056', level: 2, text: 'Most animal groups appear in the fossil record within a few tens of millions of years: the Cambrian explosion. Trilobites are common.' },
  { name: 'Ordovician', start: 486.9, end: 443.8, color: '#009270', level: 2, text: 'Marine life diversifies; the first land plants appear. Ends with a mass extinction during an ice age.' },
  { name: 'Silurian', start: 443.8, end: 419.2, color: '#b3e1b6', level: 2, text: 'Coral reefs grow, jawed fish spread, and small vascular plants and arthropods colonise land.' },
  { name: 'Devonian', start: 419.2, end: 358.9, color: '#cb8c37', level: 2, text: 'The “age of fishes”. The first forests grow and the first four-legged vertebrates (tetrapods) appear.' },
  { name: 'Carboniferous', start: 358.9, end: 298.9, color: '#67a599', level: 2, text: 'Vast swamp forests form coal; giant insects fly and the first reptiles (amniotes) appear.' },
  { name: 'Permian', start: 298.9, end: 251.9, color: '#f04028', level: 2, text: 'The continents join into Pangaea. Ends with the end-Permian extinction, which wiped out most marine species.' },
  { name: 'Triassic', start: 251.9, end: 201.4, color: '#812b92', level: 2, text: 'Life recovers; the first dinosaurs and the first mammal relatives appear.' },
  { name: 'Jurassic', start: 201.4, end: 143.1, color: '#34b2c9', level: 2, approx: true, text: 'Giant dinosaurs dominate; the first birds appear. The end of the Jurassic is not yet fixed by a dated reference point (about 143–145 Ma).' },
  { name: 'Cretaceous', start: 143.1, end: 66.0, color: '#7fc64e', level: 2, approx: true, text: 'Flowering plants spread; dinosaurs and ammonites thrive until the asteroid impact at 66 Ma.' },
  { name: 'Paleogene', start: 66.0, end: 23.03, color: '#fd9a52', level: 2, text: 'Mammals and birds diversify rapidly after the extinction of the non-avian dinosaurs.' },
  { name: 'Neogene', start: 23.03, end: 2.58, color: '#ffe619', level: 2, text: 'Grasslands spread, many modern mammal groups appear, and early human ancestors evolve in Africa.' },
  { name: 'Quaternary', start: 2.58, end: 0, color: '#f9f97f', level: 2, text: 'Repeated ice ages; Homo sapiens appears and spreads around the world.' },
];

export interface GeoEvent {
  t: number; // Ma
  name: string;
  approx: boolean;
  kind: 'life' | 'extinction' | 'earth';
  text: string;
}

export const EVENTS: GeoEvent[] = [
  { t: 4540, name: 'Earth forms', approx: true, kind: 'earth', text: 'Dated from meteorites and the oldest Earth and Moon rocks to about 4.54 billion years ago.' },
  { t: 4400, name: 'Oldest mineral grains', approx: true, kind: 'earth', text: 'Zircon crystals from Western Australia, about 4.4 billion years old, suggest liquid water already existed.' },
  { t: 3500, name: 'Early life (stromatolites)', approx: true, kind: 'life', text: 'Layered mounds built by microbial mats are among the oldest widely accepted evidence of life. Some evidence may be even older.' },
  { t: 2400, name: 'Great Oxidation Event', approx: true, kind: 'earth', text: 'Photosynthesising microbes make oxygen build up in the atmosphere for the first time.' },
  { t: 575, name: 'Ediacaran biota', approx: true, kind: 'life', text: 'The first large, complex multicellular organisms, soft-bodied and unlike most living animals.' },
  { t: 538.8, name: 'Cambrian explosion', approx: false, kind: 'life', text: 'Most major animal groups appear in the fossil record within a few tens of millions of years.' },
  { t: 470, name: 'Plants on land', approx: true, kind: 'life', text: 'Fossil spores show that the first land plants, related to liverworts, had appeared.' },
  { t: 445, name: 'End-Ordovician extinction', approx: true, kind: 'extinction', text: 'One of the “big five” mass extinctions, linked to a brief ice age.' },
  { t: 375, name: 'Vertebrates move onto land', approx: true, kind: 'life', text: 'Fish with limb-like fins, such as Tiktaalik, lead to the first four-legged animals.' },
  { t: 372, name: 'Late Devonian extinction', approx: true, kind: 'extinction', text: 'A series of extinction pulses that devastated reefs.' },
  { t: 252, name: 'End-Permian extinction', approx: false, kind: 'extinction', text: 'The largest mass extinction: around 80–90% of marine species disappeared, linked to huge volcanic eruptions in Siberia.' },
  { t: 231, name: 'First dinosaurs', approx: true, kind: 'life', text: 'Early dinosaurs were small, two-legged animals.' },
  { t: 201.4, name: 'End-Triassic extinction', approx: false, kind: 'extinction', text: 'Another of the big five; afterwards, dinosaurs came to dominate the land.' },
  { t: 200, name: 'Early mammals', approx: true, kind: 'life', text: 'Small, mostly nocturnal mammals and close relatives lived alongside the dinosaurs.' },
  { t: 150, name: 'Archaeopteryx', approx: true, kind: 'life', text: 'A feathered dinosaur showing how birds evolved from dinosaurs.' },
  { t: 130, name: 'Flowering plants', approx: true, kind: 'life', text: 'The oldest accepted flowering-plant fossils date from the Early Cretaceous.' },
  { t: 66, name: 'Asteroid impact (K–Pg)', approx: false, kind: 'extinction', text: 'An asteroid struck what is now Mexico, ending the age of non-avian dinosaurs and ammonites.' },
  { t: 56, name: 'Mammals diversify', approx: true, kind: 'life', text: 'Mammals radiate into the space left by the dinosaurs, during a warm interval.' },
  { t: 7, name: 'Human lineage splits from chimpanzees', approx: true, kind: 'life', text: 'Genetic and fossil evidence put the split at about 7–6 million years ago.' },
  { t: 0.3, name: 'Homo sapiens', approx: true, kind: 'life', text: 'The oldest Homo sapiens fossils, from Morocco, are about 300,000 years old.' },
];

/** Rock layers in the cross-section, listed from the bottom up. */
export interface Layer {
  id: string;
  name: string;
  rock: string;
  color: string;
  fossil: string | null;
  fossilKind: 'trilobite' | 'brachiopod' | 'fern' | 'footprint' | 'ammonite' | 'tooth' | null;
  tilted: boolean;
  age?: string;
  text: string;
}

export const LAYERS: Layer[] = [
  { id: 'A', name: 'Layer A', rock: 'Limestone', color: '#b8c4cc', fossil: 'Trilobites', fossilKind: 'trilobite', tilted: true, text: 'A marine limestone with trilobites, which lived only in the Paleozoic.' },
  { id: 'B', name: 'Layer B', rock: 'Shale', color: '#8a9aa8', fossil: 'Brachiopods', fossilKind: 'brachiopod', tilted: true, text: 'Mud that settled in a quiet sea, with brachiopod shells.' },
  { id: 'C', name: 'Layer C', rock: 'Coal-bearing sandstone', color: '#6b6b58', fossil: 'Fern-like plants', fossilKind: 'fern', tilted: true, text: 'A swamp deposit with fossil plants and thin coal seams.' },
  { id: 'D', name: 'Layer D', rock: 'Red sandstone', color: '#d9895b', fossil: 'Dinosaur footprints (trace fossils)', fossilKind: 'footprint', tilted: false, text: 'River sand with dinosaur footprints. It lies flat across the eroded, tilted layers below: an angular unconformity.' },
  { id: 'E', name: 'Volcanic ash E', rock: 'Volcanic ash (tuff)', color: '#efe7da', fossil: null, fossilKind: null, tilted: false, age: '75 Ma (radiometric)', text: 'An ash layer from a distant eruption. Its crystals can be dated radiometrically: 75 million years.' },
  { id: 'F', name: 'Layer F', rock: 'Shale', color: '#9c8f7a', fossil: 'Ammonites', fossilKind: 'ammonite', tilted: false, text: 'A marine shale with ammonites, which died out 66 million years ago.' },
  { id: 'G', name: 'Volcanic ash G', rock: 'Volcanic ash (tuff)', color: '#f3eee6', fossil: null, fossilKind: null, tilted: false, age: '60 Ma (radiometric)', text: 'A second ash layer, dated to 60 million years.' },
  { id: 'H', name: 'Layer H', rock: 'Siltstone', color: '#c9a66b', fossil: 'Mammal teeth', fossilKind: 'tooth', tilted: false, text: 'River silt with early mammal teeth.' },
];

export type OrgId = 'shell' | 'fish' | 'leaf' | 'jelly' | 'dino' | 'insect';
export const ORGANISMS: Record<OrgId, { name: string; hard: number; text: string }> = {
  shell: { name: 'Clam (shell)', hard: 1, text: 'A hard mineral shell survives much better than soft tissue.' },
  fish: { name: 'Fish (bones)', hard: 0.8, text: 'Bones and teeth can be preserved; the flesh usually decays.' },
  leaf: { name: 'Leaf', hard: 0.35, text: 'Leaves can leave carbon films or impressions in fine mud.' },
  jelly: { name: 'Jellyfish', hard: 0.05, text: 'With no hard parts, a jellyfish almost never fossilises.' },
  dino: { name: 'Dinosaur walking (footprints)', hard: 0.9, text: 'Footprints in soft mud are trace fossils: evidence of behaviour, not the body.' },
  insect: { name: 'Insect on a tree', hard: 0.3, text: 'Insects caught in sticky tree resin can be preserved whole in amber.' },
};

export interface Isotope {
  name: string;
  parent: string;
  daughter: string;
  half: number; // years
  use: string;
}
export const ISOTOPES: Record<string, Isotope> = {
  c14: { name: 'Carbon-14 → Nitrogen-14', parent: 'C-14', daughter: 'N-14', half: 5730, use: 'Once-living material (wood, bone, shell) up to about 50,000 years old.' },
  k40: { name: 'Potassium-40 → Argon-40', parent: 'K-40', daughter: 'Ar-40', half: 1.25e9, use: 'Volcanic rocks and ash layers, from thousands to billions of years old.' },
  u238: { name: 'Uranium-238 → Lead-206', parent: 'U-238', daughter: 'Pb-206', half: 4.47e9, use: 'Zircon crystals in igneous rocks; the most precise method for very old rocks.' },
  rb87: { name: 'Rubidium-87 → Strontium-87', parent: 'Rb-87', daughter: 'Sr-87', half: 4.9e10, use: 'Very old igneous and metamorphic rocks.' },
};
