/**
 * Species and habitats for the plant adaptations simulator.
 *
 * Trait values are illustrative, relative numbers chosen to reflect each
 * plant's documented tolerances (for example, mangroves tolerate sea-water
 * salinity, cacti store water and use CAM, water lilies need standing water).
 * They are not measurements.
 */
export type HabitatId = 'desert' | 'pond' | 'mangrove' | 'bog' | 'rainforest' | 'temperate';
export type SpeciesId = 'cactus' | 'lily' | 'mangrove' | 'flytrap' | 'bromeliad' | 'oak' | 'sunflower';
export type Cat = 'conserve' | 'acquire' | 'salt' | 'nutrients' | 'gas' | 'support' | 'light' | 'cold';

export const CAT: Record<Cat, { name: string; color: string }> = {
  conserve: { name: 'Conserves water', color: '#e8590c' },
  acquire: { name: 'Gets water', color: '#228be6' },
  salt: { name: 'Tolerates salt', color: '#7048e8' },
  nutrients: { name: 'Gets nutrients', color: '#2f9e44' },
  gas: { name: 'Gas exchange', color: '#0ca678' },
  support: { name: 'Support', color: '#868e96' },
  light: { name: 'Light', color: '#f08c00' },
  cold: { name: 'Survives cold', color: '#3bc9db' },
};

export interface Env {
  temp: number; // °C
  water: number; // 0 very dry … 60 moist … 85+ waterlogged … 100 standing water
  salt: number; // g of salt per litre (sea water ≈ 35)
  light: number; // % of full sunlight
  nutrients: number; // % (relative availability of nitrogen and phosphorus)
}

export const HABITATS: Record<HabitatId, { name: string; env: Env; text: string; native: SpeciesId }> = {
  desert: { name: 'Hot desert', env: { temp: 38, water: 8, salt: 2, light: 100, nutrients: 30 }, native: 'cactus', text: 'Very little and unpredictable rain, intense sunlight and high daytime temperatures.' },
  pond: { name: 'Freshwater pond', env: { temp: 22, water: 100, salt: 0, light: 80, nutrients: 60 }, native: 'lily', text: 'Roots sit in mud under standing water, which holds little oxygen, while the leaves float in full sun.' },
  mangrove: { name: 'Mangrove coast', env: { temp: 30, water: 95, salt: 35, light: 90, nutrients: 50 }, native: 'mangrove', text: 'Tropical shores flooded by salty tides twice a day: waterlogged, oxygen-poor mud and sea-water salinity.' },
  bog: { name: 'Bog', env: { temp: 18, water: 82, salt: 0, light: 90, nutrients: 5 }, native: 'flytrap', text: 'Wet, acidic, sunny wetland with very little nitrogen or phosphorus in the soil.' },
  rainforest: { name: 'Tropical rainforest', env: { temp: 27, water: 78, salt: 0, light: 35, nutrients: 20 }, native: 'bromeliad', text: 'Warm and wet all year. Below the canopy it is shady, and the thin soils are poor in nutrients.' },
  temperate: { name: 'Temperate woodland', env: { temp: 12, water: 55, salt: 0, light: 60, nutrients: 60 }, native: 'oak', text: 'Moderate rain, fertile soils, warm summers and cold winters with frost.' },
};

export interface Traits {
  use: number; // water demand (relative)
  storage: number; // water buffer (days of reserve, relative)
  roots: number; // how well roots collect available water
  floodTol: number; // 0–1 tolerance of waterlogged, oxygen-poor soil
  saltTol: number; // salinity (g/L) tolerated without stress
  tMin: number;
  tOptLo: number;
  tOptHi: number;
  tMax: number;
  lightNeed: number; // % sunlight for full photosynthesis
  lightMax: number; // above this the leaves are damaged (100 = no limit)
  nNeed: number; // nutrient need (0–1)
  aquatic?: boolean;
  epiphyte?: boolean;
  carnivore?: boolean;
  deciduous?: boolean;
}

export interface Adaptation {
  name: string;
  cat: Cat;
  kind: 'Structural' | 'Physiological' | 'Behavioural';
  text: string;
  /** Hotspot position in the inspect view, as a fraction of the drawing box. */
  at: [number, number];
}

export interface Species {
  id: SpeciesId;
  name: string;
  sci: string;
  group: string;
  home: HabitatId;
  traits: Traits;
  blurb: string;
  adaptations: Adaptation[];
}

export const SPECIES: Record<SpeciesId, Species> = {
  cactus: {
    id: 'cactus',
    name: 'Saguaro cactus',
    sci: 'Carnegiea gigantea',
    group: 'Xerophyte',
    home: 'desert',
    traits: { use: 0.15, storage: 8, roots: 1, floodTol: 0, saltTol: 4, tMin: -4, tOptLo: 18, tOptHi: 42, tMax: 52, lightNeed: 70, lightMax: 100, nNeed: 0.2 },
    blurb: 'A xerophyte: a plant adapted to very dry places. It stores water in its stem and loses very little.',
    adaptations: [
      { name: 'Spines (modified leaves)', cat: 'conserve', kind: 'Structural', at: [0.33, 0.3], text: 'The leaves are reduced to spines, so there is almost no leaf surface to lose water from. Spines also shade the stem a little and deter animals.' },
      { name: 'Thick green stem', cat: 'light', kind: 'Structural', at: [0.5, 0.45], text: 'With no leaves, photosynthesis happens in the stem, which is green.' },
      { name: 'Water-storage tissue', cat: 'conserve', kind: 'Structural', at: [0.5, 0.62], text: 'Large, thin-walled parenchyma cells inside the stem store water after rain. A big saguaro can hold well over a thousand litres.' },
      { name: 'Pleated ribs', cat: 'conserve', kind: 'Structural', at: [0.62, 0.36], text: 'The folds let the stem swell when it fills with water and shrink as it is used, without splitting.' },
      { name: 'Thick waxy cuticle', cat: 'conserve', kind: 'Structural', at: [0.4, 0.5], text: 'A thick layer of wax makes the surface almost waterproof, so very little water evaporates through it.' },
      { name: 'CAM photosynthesis', cat: 'conserve', kind: 'Physiological', at: [0.58, 0.5], text: 'The stomata open at night, when it is cool, to take in CO₂, and stay closed in the heat of the day. This saves a great deal of water.' },
      { name: 'Wide, shallow roots', cat: 'acquire', kind: 'Structural', at: [0.5, 0.94], text: 'A spreading network just below the surface soaks up rain quickly, before it evaporates or drains away.' },
    ],
  },
  lily: {
    id: 'lily',
    name: 'Water lily',
    sci: 'Nymphaea',
    group: 'Hydrophyte',
    home: 'pond',
    traits: { use: 1.2, storage: 0.5, roots: 1, floodTol: 1, saltTol: 1, tMin: 2, tOptLo: 15, tOptHi: 32, tMax: 38, lightNeed: 60, lightMax: 100, nNeed: 0.4, aquatic: true },
    blurb: 'A hydrophyte: a plant adapted to living in water. Its leaves float and air channels carry oxygen to roots in the mud.',
    adaptations: [
      { name: 'Floating leaves', cat: 'light', kind: 'Structural', at: [0.3, 0.32], text: 'Broad, flat leaves float on the surface, where light is brightest.' },
      { name: 'Stomata on the upper surface', cat: 'gas', kind: 'Structural', at: [0.62, 0.3], text: 'Unlike most leaves, the stomata are on top, the only side in contact with the air.' },
      { name: 'Waxy upper surface', cat: 'gas', kind: 'Structural', at: [0.45, 0.28], text: 'A waxy surface sheds water, so the stomata are not blocked by water.' },
      { name: 'Air spaces (aerenchyma)', cat: 'gas', kind: 'Structural', at: [0.5, 0.6], text: 'Large air-filled channels in the leaf stalks and stems carry oxygen down to the roots in the oxygen-poor mud and help the leaves float.' },
      { name: 'Flexible stalks', cat: 'support', kind: 'Structural', at: [0.42, 0.72], text: 'Water supports the plant, so the stalks have little strengthening tissue and can bend with currents instead of snapping.' },
      { name: 'Reduced roots and xylem', cat: 'acquire', kind: 'Structural', at: [0.5, 0.92], text: 'Water is all around, so the roots mainly anchor the plant and the water-transporting tissue is reduced.' },
    ],
  },
  mangrove: {
    id: 'mangrove',
    name: 'Red mangrove',
    sci: 'Rhizophora mangle',
    group: 'Halophyte',
    home: 'mangrove',
    traits: { use: 0.5, storage: 1.5, roots: 1, floodTol: 1, saltTol: 45, tMin: 5, tOptLo: 20, tOptHi: 36, tMax: 42, lightNeed: 60, lightMax: 100, nNeed: 0.35 },
    blurb: 'A halophyte: a plant adapted to salty conditions. It keeps most salt out at its roots and breathes through its aerial roots.',
    adaptations: [
      { name: 'Prop (stilt) roots', cat: 'support', kind: 'Structural', at: [0.35, 0.8], text: 'Arching roots from the trunk brace the tree in soft, shifting mud and against waves and tides.' },
      { name: 'Lenticels on aerial roots', cat: 'gas', kind: 'Structural', at: [0.62, 0.78], text: 'Small pores on the roots above the mud take in air at low tide; air spaces carry the oxygen down to roots buried in oxygen-poor mud. (Black mangroves also grow upright breathing roots, pneumatophores.)' },
      { name: 'Salt exclusion by the roots', cat: 'salt', kind: 'Physiological', at: [0.5, 0.92], text: 'Root membranes filter out most of the salt as water is taken in. Other mangroves instead excrete salt through glands on their leaves.' },
      { name: 'Thick, waxy leaves', cat: 'conserve', kind: 'Structural', at: [0.5, 0.2], text: 'Taking water from salty soil is hard, so the leaves are leathery and waxy to save water. Salt can also be stored in older leaves that are then shed.' },
      { name: 'Seedlings grow on the tree', cat: 'support', kind: 'Physiological', at: [0.72, 0.4], text: 'Seeds germinate while still attached to the parent (vivipary). The long seedling drops and can root quickly in the mud or float to a new shore.' },
    ],
  },
  flytrap: {
    id: 'flytrap',
    name: 'Venus flytrap',
    sci: 'Dionaea muscipula',
    group: 'Carnivorous plant',
    home: 'bog',
    traits: { use: 0.6, storage: 0.8, roots: 0.8, floodTol: 0.7, saltTol: 0.5, tMin: -5, tOptLo: 12, tOptHi: 32, tMax: 40, lightNeed: 70, lightMax: 100, nNeed: 0.4, carnivore: true },
    blurb: 'A carnivorous plant from nutrient-poor bogs. It still makes its food by photosynthesis, but catches insects for extra nitrogen and phosphorus.',
    adaptations: [
      { name: 'Hinged trap leaf', cat: 'nutrients', kind: 'Structural', at: [0.5, 0.3], text: 'The end of each leaf is a two-lobed trap that snaps shut in a fraction of a second.' },
      { name: 'Trigger hairs', cat: 'nutrients', kind: 'Physiological', at: [0.42, 0.34], text: 'Three sensitive hairs on each lobe. The trap only closes if a hair is touched twice within about 20 seconds, so raindrops do not waste a trap.' },
      { name: 'Interlocking teeth (cilia)', cat: 'nutrients', kind: 'Structural', at: [0.68, 0.24], text: 'Stiff bristles along the rims mesh together like prison bars as the trap closes.' },
      { name: 'Digestive glands', cat: 'nutrients', kind: 'Physiological', at: [0.55, 0.38], text: 'Glands on the inner surface release enzymes that digest the prey over several days and absorb nitrogen and phosphorus.' },
      { name: 'Small root system', cat: 'acquire', kind: 'Structural', at: [0.5, 0.92], text: 'The bog soil is wet but poor in nutrients, so the roots are small. Strong fertiliser can actually damage them.' },
    ],
  },
  bromeliad: {
    id: 'bromeliad',
    name: 'Tank bromeliad',
    sci: 'Guzmania / Aechmea',
    group: 'Epiphyte',
    home: 'rainforest',
    traits: { use: 0.3, storage: 3, roots: 1, floodTol: 1, saltTol: 5, tMin: 8, tOptLo: 18, tOptHi: 32, tMax: 38, lightNeed: 20, lightMax: 75, nNeed: 0.3, epiphyte: true },
    blurb: 'An epiphyte: it grows on the branches of rainforest trees without taking anything from them, reaching the light above the dark forest floor.',
    adaptations: [
      { name: 'Grows on branches', cat: 'light', kind: 'Structural', at: [0.5, 0.9], text: 'Perching high on a tree reaches far more light than the forest floor. It uses the tree only for support; it is not a parasite.' },
      { name: 'Water tank', cat: 'acquire', kind: 'Structural', at: [0.5, 0.48], text: 'The overlapping leaves form a cup that collects rainwater, since there is no soil to draw from.' },
      { name: 'Absorbing leaf scales', cat: 'nutrients', kind: 'Structural', at: [0.36, 0.42], text: 'Special scales (trichomes) on the leaves absorb water and nutrients from the tank, including those from leaf litter and droppings that fall in.' },
      { name: 'Anchoring roots', cat: 'support', kind: 'Structural', at: [0.42, 0.82], text: 'The roots mainly grip the bark; most water and nutrients come in through the leaves.' },
      { name: 'Stiff, waxy leaves', cat: 'conserve', kind: 'Structural', at: [0.7, 0.3], text: 'Between rains a perch on a branch can dry out, so many bromeliads have tough leaves and some use CAM to save water.' },
    ],
  },
  oak: {
    id: 'oak',
    name: 'English oak',
    sci: 'Quercus robur',
    group: 'Deciduous tree',
    home: 'temperate',
    traits: { use: 0.6, storage: 2, roots: 1, floodTol: 0.3, saltTol: 3, tMin: -30, tOptLo: 12, tOptHi: 28, tMax: 40, lightNeed: 50, lightMax: 100, nNeed: 0.45, deciduous: true },
    blurb: 'A deciduous tree of temperate woodland. Broad leaves capture light in summer and are shed before the winter frosts.',
    adaptations: [
      { name: 'Broad, thin leaves', cat: 'light', kind: 'Structural', at: [0.5, 0.25], text: 'A large leaf area catches plenty of light in summer, when water is usually available.' },
      { name: 'Leaf fall in autumn', cat: 'cold', kind: 'Physiological', at: [0.7, 0.2], text: 'Cooling and shorter days trigger the tree to recover nutrients from its leaves and drop them. Without leaves, it loses little water when the ground is frozen.' },
      { name: 'Protected winter buds', cat: 'cold', kind: 'Structural', at: [0.3, 0.3], text: 'Next year’s leaves wait inside buds wrapped in tough scales.' },
      { name: 'Deep tap root', cat: 'acquire', kind: 'Structural', at: [0.5, 0.95], text: 'A deep root reaches water lower in the soil during dry summers.' },
      { name: 'Woody trunk with bark', cat: 'support', kind: 'Structural', at: [0.5, 0.62], text: 'Wood (lignified xylem) supports a tall crown, and bark protects against cold, fire and animals.' },
    ],
  },
  sunflower: {
    id: 'sunflower',
    name: 'Sunflower',
    sci: 'Helianthus annuus',
    group: 'Mesophyte (crop)',
    home: 'temperate',
    traits: { use: 1.0, storage: 1, roots: 0.9, floodTol: 0.2, saltTol: 5, tMin: 2, tOptLo: 18, tOptHi: 30, tMax: 40, lightNeed: 70, lightMax: 100, nNeed: 0.55 },
    blurb: 'A mesophyte: a plant suited to moderate conditions, with no special adaptations for extremes. A useful “typical plant” to compare with.',
    adaptations: [
      { name: 'Large leaves with many stomata', cat: 'gas', kind: 'Structural', at: [0.35, 0.45], text: 'Large leaves and open stomata allow fast photosynthesis and growth, but lose a lot of water. Great in moist soil; risky in drought.' },
      { name: 'Hairy stem and leaves', cat: 'conserve', kind: 'Structural', at: [0.55, 0.6], text: 'Fine hairs slightly reduce water loss and deter some insects, a modest adaptation compared with true xerophytes.' },
      { name: 'Tall, stiff stem', cat: 'support', kind: 'Structural', at: [0.5, 0.72], text: 'A strong stem holds the flower head up towards the light.' },
      { name: 'Fibrous root system', cat: 'acquire', kind: 'Structural', at: [0.5, 0.95], text: 'Many roots spread through moist topsoil, but cannot store water or cope with salt or waterlogging.' },
    ],
  },
};

export const ORDER: SpeciesId[] = ['cactus', 'lily', 'mangrove', 'flytrap', 'bromeliad', 'oak', 'sunflower'];
