/**
 * Circulatory layouts for the four example animals. Each closed system is a
 * set of "legs" (polylines in a 660 × 600 diagram box) joined end to end;
 * blood particles travel leg by leg. Diagrams are schematic, not anatomical.
 *
 * Pressures are approximate typical mean values in mmHg and vary with species,
 * size, temperature and activity:
 *   mammal (human) aorta ≈ 93, pulmonary artery ≈ 15;
 *   fish (e.g. rainbow trout) ventral aorta ≈ 40, dorsal aorta after the gills ≈ 28;
 *   frog systemic and pulmocutaneous arches ≈ 30;
 *   insect hemolymph only a few mmHg.
 */
export type AnimalId = 'insect' | 'fish' | 'frog' | 'mammal';
export type LegKind = 'heart' | 'artery' | 'gas' | 'tissue' | 'vein';
export type Pt = [number, number];

export interface Leg {
  id: string;
  pts: Pt[];
  kind: LegKind;
  name: string;
  info: string;
  /** Possible next legs (the frog's conus splits two ways). */
  next: string[];
}

export interface Animal {
  id: AnimalId;
  name: string;
  example: string;
  open: boolean;
  circulation: string;
  chambers: string;
  passes: string;
  hr: [number, number] | null; // beats per minute at rest and at maximum activity
  pressureBody: number;
  supports: string;
  venousRest: number; // O₂ saturation of blood returning from the body at rest
  venousMax: number;
  arterialMax: number; // saturation reached in the gas-exchange organ
  legs: Leg[];
  /** Labelled blocks drawn in the diagram. */
  organs: { label: string; x: number; y: number; w: number; h: number; info: string; kind: 'gas' | 'organ' | 'heart' }[];
  summary: string;
}

const L = (id: string, kind: LegKind, name: string, pts: Pt[], next: string[], info: string): Leg => ({ id, kind, name, pts, next, info });

export const ANIMALS: Record<AnimalId, Animal> = {
  mammal: {
    id: 'mammal',
    name: 'Mammal',
    example: 'human',
    open: false,
    circulation: 'Closed, double circulation',
    chambers: '4 (2 atria, 2 ventricles)',
    passes: 'Twice per full circuit',
    hr: [60, 180],
    pressureBody: 93,
    supports: 'High: fully separated circuits keep oxygen-rich blood at high pressure',
    venousRest: 0.75,
    venousMax: 0.3,
    arterialMax: 0.97,
    summary:
      'Mammals (and birds) have a four-chambered heart and two completely separate circuits. The right side pumps oxygen-poor blood to the lungs at low pressure; the left side pumps oxygen-rich blood to the body at high pressure. Oxygen-rich and oxygen-poor blood never mix, which supports the high metabolic rate of warm-blooded animals.',
    legs: [
      L('ra', 'heart', 'Right atrium', [[290, 262], [290, 292]], ['rv'], 'Receives oxygen-poor blood returning from the body through the venae cavae.'),
      L('rv', 'heart', 'Right ventricle', [[290, 292], [290, 352]], ['pa'], 'Pumps oxygen-poor blood to the lungs. Its wall is thinner than the left ventricle’s because the lungs need only low pressure.'),
      L('pa', 'artery', 'Pulmonary artery', [[290, 352], [230, 352], [230, 115], [255, 98]], ['lung'], 'Carries oxygen-poor blood from the right ventricle to the lungs: the only artery in the adult body that carries oxygen-poor blood.'),
      L('lung', 'gas', 'Lung capillaries', [[255, 98], [405, 98]], ['pv'], 'Blood passes through capillaries around millions of tiny air sacs (alveoli), picking up oxygen and releasing carbon dioxide by diffusion.'),
      L('pv', 'vein', 'Pulmonary veins', [[405, 98], [432, 115], [432, 262], [370, 262]], ['la'], 'Return oxygen-rich blood from the lungs to the left atrium.'),
      L('la', 'heart', 'Left atrium', [[370, 262], [370, 292]], ['lv'], 'Receives oxygen-rich blood from the lungs.'),
      L('lv', 'heart', 'Left ventricle', [[370, 292], [370, 352]], ['ao'], 'The strongest chamber: its thick muscular wall pumps oxygen-rich blood around the whole body at high pressure.'),
      L('ao', 'artery', 'Aorta and arteries', [[370, 352], [482, 352], [482, 505]], ['body'], 'Thick, elastic arteries carry oxygen-rich blood away from the heart at high pressure. They stretch with each heartbeat and recoil, smoothing the flow.'),
      L('body', 'tissue', 'Body capillaries', [[482, 505], [470, 522], [190, 522], [178, 505]], ['vc'], 'Tiny vessels with walls one cell thick. Oxygen, glucose and other nutrients diffuse out to the cells; carbon dioxide and wastes diffuse in.'),
      L('vc', 'vein', 'Veins and venae cavae', [[178, 505], [178, 262], [290, 262]], ['ra'], 'Veins carry oxygen-poor blood back to the heart at low pressure. Valves stop it flowing backwards, and squeezing muscles help push it along.'),
    ],
    organs: [
      { label: 'Lungs', x: 245, y: 60, w: 170, h: 70, kind: 'gas', info: 'Gas exchange organ: thin, moist alveoli with a huge surface area (about 70 m² in an adult human).' },
      { label: 'Heart', x: 255, y: 240, w: 150, h: 130, kind: 'heart', info: 'Four chambers: two atria on top, two ventricles below. The septum (wall) down the middle keeps the two sides separate.' },
      { label: 'Brain', x: 200, y: 540, w: 60, h: 40, kind: 'organ', info: 'The brain uses about a fifth of the body’s oxygen at rest and is damaged within minutes without it.' },
      { label: 'Gut', x: 270, y: 540, w: 60, h: 40, kind: 'organ', info: 'Blood picks up digested nutrients from the small intestine and carries them first to the liver.' },
      { label: 'Kidneys', x: 340, y: 540, w: 64, h: 40, kind: 'organ', info: 'Filter wastes such as urea out of the blood and control its water and salt content.' },
      { label: 'Muscles', x: 414, y: 540, w: 64, h: 40, kind: 'organ', info: 'During exercise, muscles take far more oxygen from the blood, so blood returns to the heart with much less.' },
    ],
  },
  fish: {
    id: 'fish',
    name: 'Fish',
    example: 'rainbow trout',
    open: false,
    circulation: 'Closed, single circulation',
    chambers: '2 in series (atrium, ventricle), plus the sinus venosus and bulbus',
    passes: 'Once per full circuit',
    hr: [40, 100],
    pressureBody: 28,
    supports: 'Moderate: blood loses pressure in the gills before reaching the body',
    venousRest: 0.7,
    venousMax: 0.3,
    arterialMax: 0.95,
    summary:
      'A fish heart pumps oxygen-poor blood forwards to the gills. After picking up oxygen, the blood flows straight on to the body without returning to the heart. Squeezing through the gill capillaries costs a lot of pressure, so blood reaches the body more slowly than in a mammal. Water’s buoyancy and fishes’ (mostly) cold-blooded lifestyle mean this is enough.',
    legs: [
      L('sv', 'heart', 'Sinus venosus', [[312, 470], [268, 470]], ['at'], 'A thin-walled chamber that collects oxygen-poor blood from the veins before it enters the atrium.'),
      L('at', 'heart', 'Atrium', [[268, 470], [222, 470]], ['ve'], 'Receives blood from the sinus venosus and pushes it into the ventricle.'),
      L('ve', 'heart', 'Ventricle', [[222, 470], [172, 470]], ['va'], 'The muscular pump. A fish heart contains only oxygen-poor blood.'),
      L('va', 'artery', 'Ventral aorta', [[172, 470], [128, 470], [128, 400]], ['gill'], 'Carries oxygen-poor blood from the heart forwards to the gills.'),
      L('gill', 'gas', 'Gill capillaries', [[128, 400], [128, 210]], ['da'], 'Thin gill filaments with a large surface area. Blood flows in the opposite direction to the water (countercurrent flow), so it can pick up most of the dissolved oxygen.'),
      L('da', 'artery', 'Dorsal aorta', [[128, 210], [160, 175], [540, 175]], ['body'], 'Carries oxygen-rich blood from the gills along the back to the body. Pressure here is already lower than in the ventral aorta.'),
      L('body', 'tissue', 'Body capillaries', [[540, 175], [585, 255], [585, 395], [540, 440]], ['vn'], 'Oxygen and nutrients diffuse out to the muscles and organs; carbon dioxide and wastes diffuse in.'),
      L('vn', 'vein', 'Veins', [[540, 440], [312, 470]], ['sv'], 'Return oxygen-poor blood to the heart at low pressure.'),
    ],
    organs: [
      { label: 'Gills', x: 80, y: 205, w: 96, h: 200, kind: 'gas', info: 'Gas exchange organ: water flows over thin, folded filaments. Water holds far less oxygen than air, so gills must be very efficient.' },
      { label: 'Heart', x: 160, y: 445, w: 165, h: 50, kind: 'heart', info: 'Chambers in a single line: sinus venosus → atrium → ventricle → bulbus arteriosus.' },
      { label: 'Swimming muscles', x: 300, y: 205, w: 210, h: 60, kind: 'organ', info: 'Most of a fish’s body is muscle. Fast-swimming fish such as tuna have many more blood vessels in their red muscle.' },
      { label: 'Gut', x: 300, y: 300, w: 120, h: 50, kind: 'organ', info: 'Absorbs digested food into the blood.' },
      { label: 'Kidney', x: 430, y: 300, w: 90, h: 50, kind: 'organ', info: 'Controls water and salt balance; freshwater and seawater fish face opposite problems.' },
    ],
  },
  frog: {
    id: 'frog',
    name: 'Amphibian',
    example: 'frog',
    open: false,
    circulation: 'Closed, double circulation (partly separated)',
    chambers: '3 (2 atria, 1 ventricle)',
    passes: 'Twice per full circuit',
    hr: [40, 80],
    pressureBody: 30,
    supports: 'Moderate: some mixing in the single ventricle, but both circuits get fresh pressure',
    venousRest: 0.65,
    venousMax: 0.3,
    arterialMax: 0.92,
    summary:
      'A frog heart has two atria but only one ventricle. Oxygen-poor blood from the body and oxygen-rich blood from the lungs enter the same ventricle, yet they mix only partly: the timing of filling, ridges in the ventricle and a spiral valve in the outflow channel send most oxygen-poor blood to the lungs and skin and most oxygen-rich blood to the body. Frogs also take in oxygen through their moist skin.',
    legs: [
      L('ra', 'heart', 'Right atrium', [[290, 270], [290, 300], [322, 345]], ['v'], 'Receives oxygen-poor blood from the body.'),
      L('la', 'heart', 'Left atrium', [[370, 270], [370, 300], [338, 345]], ['v'], 'Receives oxygen-rich blood from the lungs.'),
      L('v', 'heart', 'Single ventricle', [[330, 345], [330, 390]], ['conus'], 'Both streams of blood enter one ventricle, so some mixing happens, but much less than you might expect.'),
      L('conus', 'heart', 'Conus arteriosus (spiral valve)', [[330, 390], [330, 418]], ['pc', 'sys'], 'The outflow channel contains a spiral fold that helps direct oxygen-poor blood to the lungs and skin and oxygen-rich blood to the body.'),
      L('pc', 'artery', 'Pulmocutaneous arteries', [[330, 418], [230, 418], [200, 385], [200, 115], [240, 92]], ['gas'], 'Carry blood to the lungs and the skin, both of which exchange gases.'),
      L('gas', 'gas', 'Lung and skin capillaries', [[240, 92], [420, 92]], ['pv'], 'Frogs breathe through their lungs and their thin, moist skin. Underwater or in winter the skin can supply most of their oxygen.'),
      L('pv', 'vein', 'Pulmonary veins', [[420, 92], [452, 112], [452, 250], [370, 250], [370, 270]], ['la'], 'Return oxygen-rich blood from the lungs to the left atrium. (Blood from the skin returns to the right atrium in real frogs.)'),
      L('sys', 'artery', 'Systemic arches', [[330, 418], [482, 418], [482, 510]], ['body'], 'Carry blood, mostly oxygen-rich, to the body.'),
      L('body', 'tissue', 'Body capillaries', [[482, 510], [470, 530], [190, 530], [170, 512]], ['vc'], 'Oxygen and nutrients diffuse out to the tissues.'),
      L('vc', 'vein', 'Veins', [[170, 512], [150, 480], [150, 250], [290, 250], [290, 270]], ['ra'], 'Return oxygen-poor blood to the right atrium (through the sinus venosus).'),
    ],
    organs: [
      { label: 'Lungs and skin', x: 235, y: 55, w: 190, h: 70, kind: 'gas', info: 'Two gas exchange surfaces: simple, sac-like lungs and thin, moist, well-supplied skin.' },
      { label: 'Heart', x: 262, y: 240, w: 136, h: 190, kind: 'heart', info: 'Three chambers: two atria and one ventricle.' },
      { label: 'Brain', x: 200, y: 548, w: 60, h: 36, kind: 'organ', info: 'The brain receives blood from the systemic arches.' },
      { label: 'Gut', x: 270, y: 548, w: 60, h: 36, kind: 'organ', info: 'Absorbs digested insects and other food.' },
      { label: 'Kidneys', x: 340, y: 548, w: 64, h: 36, kind: 'organ', info: 'Remove wastes and control water balance.' },
      { label: 'Muscles', x: 414, y: 548, w: 70, h: 36, kind: 'organ', info: 'Powerful jumping muscles. Amphibians tire quickly in bursts of activity.' },
    ],
  },
  insect: {
    id: 'insect',
    name: 'Insect',
    example: 'grasshopper',
    open: true,
    circulation: 'Open circulation',
    chambers: 'A tube-like dorsal vessel with many openings (ostia)',
    passes: 'No separate circuits: hemolymph bathes the organs directly',
    hr: null,
    pressureBody: 3,
    supports: 'Oxygen comes through air tubes (tracheae), not the hemolymph',
    venousRest: 0,
    venousMax: 0,
    arterialMax: 0,
    summary:
      'Insects have an open circulatory system. A tube-shaped heart along the back pumps hemolymph forwards and releases it into the body cavity (hemocoel), where it bathes the organs directly before seeping back into the heart through valved openings called ostia. Pressure is low. Hemolymph carries nutrients, hormones, wastes and immune cells, but in insects it carries little oxygen: air reaches the cells through a separate network of tubes, the tracheae.',
    legs: [],
    organs: [
      { label: 'Gut', x: 150, y: 318, w: 420, h: 34, kind: 'organ', info: 'Nutrients absorbed from the gut pass straight into the surrounding hemolymph.' },
      { label: 'Flight muscles', x: 165, y: 230, w: 120, h: 70, kind: 'organ', info: 'Among the most active muscles known. They get oxygen directly from fine tracheal tubes, not from the hemolymph.' },
      { label: 'Nerve cord', x: 120, y: 448, w: 440, h: 14, kind: 'organ', info: 'The ventral nerve cord runs along the underside of the body.' },
      { label: 'Fat body', x: 330, y: 372, w: 200, h: 40, kind: 'organ', info: 'Stores energy and makes proteins, a little like a liver. It is bathed in hemolymph.' },
    ],
  },
};

/** Approximate pressure driving blood to the body tissues (mmHg), for the comparison chart. */
export const ORDER: AnimalId[] = ['insect', 'fish', 'frog', 'mammal'];
