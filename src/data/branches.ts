/**
 * The science catalog: every branch and topic on the site.
 *
 * This file is the single source of truth for navigation, branch pages,
 * search, related-topic links and the homepage. To publish a simulator,
 * build its page in src/pages/<branch>/<topic>.astro and set status to 'live'.
 */

export type TopicStatus = 'live' | 'planned';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type SimKind = '2D' | '3D' | 'Graph' | 'Experiment';

export interface Topic {
  slug: string;
  title: string;
  summary: string;
  keywords: string[];
  level: Level;
  kind: SimKind;
  status: TopicStatus;
  /** Approximate time to explore the simulator and quiz, in minutes. */
  minutes?: number;
  /** Hand-picked related topics as "branch/topic" paths, shown first. */
  related?: string[];
}

export interface Branch {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  /** Hue (0–360) used for the branch accent colour. */
  hue: number;
  icon: IconName;
  topics: Topic[];
}

export type IconName =
  | 'cell'
  | 'flask'
  | 'heart'
  | 'planet'
  | 'paw'
  | 'leaf'
  | 'pendulum'
  | 'mountain'
  | 'globe'
  | 'function';

export const branches: Branch[] = [
  {
    slug: 'biology',
    name: 'Biology',
    shortName: 'Biology',
    tagline: 'How living things work, from molecules to populations.',
    description:
      'Explore the machinery of life. Watch water cross cell membranes, take apart a cell organelle by organelle, tune the conditions for photosynthesis, unzip DNA and see natural selection reshape a population.',
    hue: 152,
    icon: 'cell',
    topics: [
      {
        slug: 'osmosis',
        title: 'Osmosis and Cell Tonicity',
        summary:
          'Adjust solute concentrations inside and outside a cell and watch water move across the membrane until the cell swells, shrinks or bursts.',
        keywords: ['osmosis', 'tonicity', 'hypotonic', 'hypertonic', 'isotonic', 'membrane', 'diffusion', 'water potential', 'red blood cell', 'plasmolysis', 'turgor'],
        level: 'Beginner',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['biology/cell-structure', 'botany/transpiration', 'zoology/animal-vs-plant-cell', 'botany/plant-cell'],
      },
      {
        slug: 'cell-structure',
        title: 'Cell Structure and Organelles',
        summary: 'Rotate and zoom an interactive 3D cell and click each organelle to learn what it does.',
        keywords: ['cell', 'organelles', 'nucleus', 'mitochondria', 'ribosome', 'golgi', 'endoplasmic reticulum'],
        level: 'Beginner',
        kind: '3D',
        status: 'live',
        minutes: 12,
        related: ['botany/plant-cell', 'zoology/animal-vs-plant-cell', 'biology/osmosis', 'biology/dna-replication'],
      },
      {
        slug: 'photosynthesis',
        title: 'Photosynthesis',
        summary: 'Change light intensity, carbon dioxide and temperature and measure how fast a plant makes sugar and oxygen.',
        keywords: ['photosynthesis', 'chlorophyll', 'light', 'carbon dioxide', 'limiting factor', 'chloroplast'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['botany/transpiration', 'biology/cell-structure', 'ecology/carbon-cycle', 'chemistry/balancing-equations'],
      },
      {
        slug: 'dna-replication',
        title: 'DNA Replication',
        summary: 'Step through helicase, primase and DNA polymerase as a double helix copies itself.',
        keywords: ['dna', 'replication', 'helicase', 'polymerase', 'okazaki', 'base pairing', 'leading strand'],
        level: 'Intermediate',
        kind: '3D',
        status: 'live',
        minutes: 15,
        related: ['biology/cell-structure', 'biology/natural-selection', 'mathematics/probability', 'biology/photosynthesis'],
      },
      {
        slug: 'natural-selection',
        title: 'Natural Selection and Evolution',
        summary: 'Change the environment and watch traits in a population shift across generations.',
        keywords: ['evolution', 'natural selection', 'adaptation', 'allele', 'fitness', 'population', 'darwin'],
        level: 'Intermediate',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['zoology/animal-adaptations', 'mathematics/probability', 'ecology/population-dynamics', 'ecology/biodiversity'],
      },
    ],
  },
  {
    slug: 'chemistry',
    name: 'Chemistry',
    shortName: 'Chemistry',
    tagline: 'Atoms, bonds and the reactions that rearrange them.',
    description:
      'Build atoms and molecules, balance equations atom by atom, mix acids and bases and speed reactions up or slow them down.',
    hue: 268,
    icon: 'flask',
    topics: [
      {
        slug: 'atomic-structure',
        title: 'Atomic Structure',
        summary: 'Add protons, neutrons and electrons and watch the element, charge and energy levels change.',
        keywords: ['atom', 'proton', 'neutron', 'electron', 'isotope', 'ion', 'energy level', 'shell'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['chemistry/chemical-bonding', 'chemistry/acids-and-bases', 'chemistry/balancing-equations', 'astronomy/stellar-life-cycle'],
      },
      {
        slug: 'chemical-bonding',
        title: 'Chemical Bonding',
        summary: 'Combine atoms into molecules and compare ionic and covalent bonds.',
        keywords: ['bond', 'ionic', 'covalent', 'electronegativity', 'molecule', 'valence'],
        level: 'Intermediate',
        kind: '3D',
        status: 'live',
        minutes: 15,
        related: ['chemistry/atomic-structure', 'chemistry/balancing-equations', 'chemistry/acids-and-bases', 'chemistry/reaction-rates'],
      },
      {
        slug: 'balancing-equations',
        title: 'Balancing Chemical Equations',
        summary: 'Adjust coefficients and count atoms on both sides until mass is conserved.',
        keywords: ['balancing', 'equation', 'coefficient', 'conservation of mass', 'reactant', 'product'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['chemistry/atomic-structure', 'chemistry/reaction-rates', 'biology/photosynthesis', 'chemistry/chemical-bonding'],
      },
      {
        slug: 'acids-and-bases',
        title: 'Acid-Base Reactions',
        summary: 'Change pH and watch indicators, ion concentrations and neutralization respond.',
        keywords: ['acid', 'base', 'ph', 'indicator', 'neutralization', 'hydrogen ion', 'titration'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['chemistry/atomic-structure', 'chemistry/reaction-rates', 'biology/osmosis', 'ecology/pollution'],
      },
      {
        slug: 'reaction-rates',
        title: 'Reaction Rates',
        summary: 'Vary temperature, concentration and surface area and measure how quickly particles react.',
        keywords: ['reaction rate', 'collision theory', 'activation energy', 'catalyst', 'temperature', 'kinetics'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['chemistry/balancing-equations', 'chemistry/acids-and-bases', 'biology/photosynthesis', 'ecology/climate-change'],
      },
    ],
  },
  {
    slug: 'anatomy-physiology',
    name: 'Anatomy and Physiology',
    shortName: 'Anatomy',
    tagline: 'The structure and function of the human body.',
    description:
      'Follow blood through the heart, watch the lungs fill, rotate the skeleton, fire a neuron and track a meal through the digestive tract. Educational models only — not medical advice.',
    hue: 352,
    icon: 'heart',
    topics: [
      {
        slug: 'heart-circulation',
        title: 'Human Heart and Blood Circulation',
        summary: 'Explore the chambers and valves of the heart and trace blood through both circuits.',
        keywords: ['heart', 'circulation', 'atrium', 'ventricle', 'valve', 'artery', 'vein', 'cardiac cycle'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['anatomy-physiology/neuron-firing', 'biology/osmosis', 'biology/cell-structure', 'physics/circuits'],
      },
      {
        slug: 'respiratory-system',
        title: 'Respiratory System',
        summary: 'Move the diaphragm, watch the lungs expand and follow oxygen into the blood.',
        keywords: ['lungs', 'breathing', 'diaphragm', 'alveoli', 'gas exchange', 'oxygen', 'carbon dioxide'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['anatomy-physiology/heart-circulation', 'biology/photosynthesis', 'biology/osmosis', 'anatomy-physiology/neuron-firing'],
      },
      {
        slug: 'skeletal-system',
        title: 'Human Skeletal System',
        summary: 'Rotate a 3D skeleton, select bones and explore the joints that connect them.',
        keywords: ['skeleton', 'bones', 'joints', 'femur', 'skull', 'cartilage'],
        level: 'Beginner',
        kind: '3D',
        status: 'live',
        minutes: 12,
        related: ['anatomy-physiology/respiratory-system', 'anatomy-physiology/heart-circulation', 'physics/newtons-laws', 'zoology/animal-classification'],
      },
      {
        slug: 'neuron-firing',
        title: 'Nervous System and Neuron Firing',
        summary: 'Stimulate a neuron and watch an action potential travel down the axon.',
        keywords: ['neuron', 'action potential', 'synapse', 'axon', 'sodium', 'potassium', 'nervous system'],
        level: 'Advanced',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['anatomy-physiology/heart-circulation', 'biology/osmosis', 'chemistry/atomic-structure', 'anatomy-physiology/respiratory-system'],
      },
      {
        slug: 'digestive-system',
        title: 'Digestive System',
        summary: 'Follow food from mouth to intestine and see where each nutrient is broken down and absorbed.',
        keywords: ['digestion', 'stomach', 'intestine', 'enzyme', 'absorption', 'liver', 'nutrients'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['anatomy-physiology/heart-circulation', 'biology/osmosis', 'chemistry/reaction-rates', 'chemistry/acids-and-bases'],
      },
      {
        slug: 'urinary-system',
        title: 'Urinary System and Kidney Function',
        summary: 'Follow blood through a nephron and see how the kidneys filter waste and balance water and salt.',
        keywords: ['kidney', 'nephron', 'urine', 'bladder', 'filtration', 'ADH', 'homeostasis', 'urinary system'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['anatomy-physiology/heart-circulation', 'biology/osmosis', 'anatomy-physiology/digestive-system', 'earth-science/water-cycle'],
      },
    ],
  },
  {
    slug: 'astronomy',
    name: 'Astronomy and Space Science',
    shortName: 'Astronomy',
    tagline: 'Planets, stars and the gravity that shapes the universe.',
    description:
      'Fly through the solar system, line up the Sun, Earth and Moon, design your own orbits, follow a star from birth to death and bend light around a black hole.',
    hue: 222,
    icon: 'planet',
    topics: [
      {
        slug: 'solar-system',
        title: 'Solar System Explorer',
        summary: 'Compare planets, their orbits and their relative sizes in an interactive 3D model.',
        keywords: ['solar system', 'planets', 'orbit', 'sun', 'mercury', 'jupiter', 'scale'],
        level: 'Beginner',
        kind: '3D',
        status: 'live',
        minutes: 12,
        related: ['astronomy/orbits-gravity', 'astronomy/moon-phases', 'earth-science/earth-layers', 'physics/newtons-laws'],
      },
      {
        slug: 'moon-phases',
        title: 'Phases of the Moon',
        summary: 'Move the Moon around the Earth and see which phase appears from the ground.',
        keywords: ['moon', 'phases', 'lunar', 'crescent', 'gibbous', 'eclipse'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['astronomy/orbits-gravity', 'astronomy/solar-system', 'earth-science/water-cycle', 'physics/wave-interference'],
      },
      {
        slug: 'orbits-gravity',
        title: 'Planetary Orbits and Gravity',
        summary: 'Set mass, distance and speed and watch orbits become circles, ellipses or escape paths.',
        keywords: ['gravity', 'orbit', 'kepler', 'ellipse', 'escape velocity', 'newton'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['astronomy/moon-phases', 'physics/projectile-motion', 'astronomy/solar-system', 'physics/newtons-laws'],
      },
      {
        slug: 'stellar-life-cycle',
        title: 'Stellar Life Cycle',
        summary: 'Choose a star’s mass and follow it from nebula to white dwarf, neutron star or black hole.',
        keywords: ['star', 'nebula', 'supernova', 'white dwarf', 'neutron star', 'main sequence', 'hr diagram'],
        level: 'Intermediate',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['astronomy/solar-system', 'astronomy/orbits-gravity', 'chemistry/atomic-structure', 'physics/wave-interference'],
      },
      {
        slug: 'black-holes',
        title: 'Black Holes and Gravitational Lensing',
        summary: 'Move a black hole across a star field and watch it bend the light passing nearby.',
        keywords: ['black hole', 'gravitational lensing', 'event horizon', 'relativity', 'einstein ring'],
        level: 'Advanced',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['astronomy/stellar-life-cycle', 'astronomy/orbits-gravity', 'astronomy/solar-system', 'physics/wave-interference'],
      },
    ],
  },
  {
    slug: 'zoology',
    name: 'Zoology and Animal Science',
    shortName: 'Zoology',
    tagline: 'The diversity, behaviour and survival of animals.',
    description:
      'Sort animals into groups, compare animal and plant cells, test adaptations against changing environments, rebalance a food web and study how animals move.',
    hue: 32,
    icon: 'paw',
    topics: [
      {
        slug: 'animal-classification',
        title: 'Animal Classification',
        summary: 'Sort animals using a branching key and discover the traits that define each group.',
        keywords: ['classification', 'taxonomy', 'vertebrate', 'invertebrate', 'mammal', 'phylum', 'kingdom'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['zoology/animal-adaptations', 'zoology/animal-vs-plant-cell', 'biology/natural-selection', 'ecology/biodiversity'],
      },
      {
        slug: 'animal-vs-plant-cell',
        title: 'Animal Cell vs. Plant Cell',
        summary: 'Compare the two cell types side by side and toggle the structures that make them different.',
        keywords: ['animal cell', 'plant cell', 'cell wall', 'chloroplast', 'vacuole', 'comparison'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['biology/cell-structure', 'botany/plant-cell', 'zoology/animal-classification', 'biology/osmosis'],
      },
      {
        slug: 'animal-adaptations',
        title: 'Animal Adaptations',
        summary: 'Change temperature, food and predators and see which adaptations help animals survive.',
        keywords: ['adaptation', 'camouflage', 'survival', 'habitat', 'environment'],
        level: 'Beginner',
        kind: 'Experiment',
        status: 'live',
        minutes: 12,
        related: ['biology/natural-selection', 'zoology/animal-classification', 'zoology/food-webs', 'ecology/biodiversity'],
      },
      {
        slug: 'food-webs',
        title: 'Food Chains and Food Webs',
        summary: 'Add or remove species and watch the effects ripple through an ecosystem.',
        keywords: ['food chain', 'food web', 'producer', 'consumer', 'predator', 'trophic level'],
        level: 'Intermediate',
        kind: 'Graph',
        status: 'live',
        minutes: 12,
        related: ['ecology/population-dynamics', 'zoology/animal-classification', 'biology/natural-selection', 'ecology/carbon-cycle'],
      },
      {
        slug: 'animal-locomotion',
        title: 'Animal Locomotion',
        summary: 'Explore the mechanics of walking, flying and swimming and the forces behind each.',
        keywords: ['locomotion', 'flight', 'swimming', 'walking', 'gait', 'biomechanics'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['physics/newtons-laws', 'physics/projectile-motion', 'zoology/animal-adaptations', 'physics/pendulum'],
      },
    ],
  },
  {
    slug: 'botany',
    name: 'Botany and Plant Science',
    shortName: 'Botany',
    tagline: 'How plants are built, grow and respond to the world.',
    description:
      'Look inside plant cells, dissect a flowering plant, measure transpiration, germinate seeds under different conditions and watch plants bend toward light.',
    hue: 96,
    icon: 'leaf',
    topics: [
      {
        slug: 'plant-cell',
        title: 'Plant Cell Structure',
        summary: 'Explore the cell wall, chloroplasts and central vacuole that make plant cells unique.',
        keywords: ['plant cell', 'cell wall', 'chloroplast', 'vacuole', 'organelles'],
        level: 'Beginner',
        kind: '3D',
        status: 'live',
        minutes: 12,
        related: ['biology/cell-structure', 'zoology/animal-vs-plant-cell', 'biology/photosynthesis', 'botany/plant-anatomy'],
      },
      {
        slug: 'plant-anatomy',
        title: 'Plant Anatomy',
        summary: 'Investigate roots, stems, leaves and flowers and the job each one does.',
        keywords: ['roots', 'stem', 'leaf', 'flower', 'xylem', 'phloem', 'anatomy'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['botany/transpiration', 'botany/plant-cell', 'biology/photosynthesis', 'zoology/animal-vs-plant-cell'],
      },
      {
        slug: 'transpiration',
        title: 'Transpiration',
        summary: 'Change humidity, wind, light and temperature and measure water loss from leaves.',
        keywords: ['transpiration', 'stomata', 'xylem', 'humidity', 'water loss'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['biology/osmosis', 'botany/plant-anatomy', 'biology/photosynthesis', 'earth-science/water-cycle'],
      },
      {
        slug: 'seed-germination',
        title: 'Seed Germination',
        summary: 'Control water, temperature and oxygen and see which seeds sprout.',
        keywords: ['germination', 'seed', 'dormancy', 'embryo', 'radicle'],
        level: 'Beginner',
        kind: 'Experiment',
        status: 'live',
        minutes: 12,
        related: ['botany/tropisms', 'botany/plant-anatomy', 'biology/photosynthesis', 'chemistry/reaction-rates'],
      },
      {
        slug: 'tropisms',
        title: 'Plant Growth and Tropisms',
        summary: 'Move the light source and tilt the pot to see how plants respond to light and gravity.',
        keywords: ['tropism', 'phototropism', 'gravitropism', 'auxin', 'growth'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['botany/seed-germination', 'botany/plant-anatomy', 'biology/photosynthesis', 'anatomy-physiology/neuron-firing'],
      },
    ],
  },
  {
    slug: 'physics',
    name: 'Physics and Mechanics',
    shortName: 'Physics',
    tagline: 'Forces, motion, waves and electricity.',
    description:
      'Push objects with Newton’s laws, launch projectiles, swing pendulums, overlap waves and wire up circuits — with live measurements for every variable.',
    hue: 196,
    icon: 'pendulum',
    topics: [
      {
        slug: 'newtons-laws',
        title: 'Newton’s Laws of Motion',
        summary: 'Apply forces to objects of different masses and measure the acceleration.',
        keywords: ['newton', 'force', 'mass', 'acceleration', 'inertia', 'friction', 'f=ma'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['physics/projectile-motion', 'mathematics/vector-addition', 'physics/pendulum', 'astronomy/orbits-gravity'],
      },
      {
        slug: 'projectile-motion',
        title: 'Projectile Motion',
        summary: 'Change launch angle, speed and gravity and predict where the projectile will land.',
        keywords: ['projectile', 'trajectory', 'parabola', 'launch angle', 'kinematics', 'gravity'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['physics/newtons-laws', 'mathematics/vector-addition', 'astronomy/orbits-gravity', 'mathematics/graphing-functions'],
      },
      {
        slug: 'pendulum',
        title: 'Pendulum Motion',
        summary: 'Adjust length, mass and starting angle and measure the period of oscillation.',
        keywords: ['pendulum', 'oscillation', 'period', 'simple harmonic motion', 'frequency'],
        level: 'Beginner',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['physics/wave-interference', 'physics/newtons-laws', 'mathematics/graphing-functions', 'astronomy/orbits-gravity'],
      },
      {
        slug: 'wave-interference',
        title: 'Wave Interference',
        summary: 'Overlap two waves and control frequency, amplitude and phase to see interference patterns.',
        keywords: ['wave', 'interference', 'frequency', 'amplitude', 'phase', 'superposition'],
        level: 'Intermediate',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['physics/pendulum', 'mathematics/graphing-functions', 'physics/circuits', 'mathematics/data-visualization'],
      },
      {
        slug: 'circuits',
        title: 'Electricity and Circuits',
        summary: 'Build series and parallel circuits and measure voltage, current and resistance.',
        keywords: ['circuit', 'voltage', 'current', 'resistance', 'ohm', 'series', 'parallel'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['physics/newtons-laws', 'chemistry/atomic-structure', 'anatomy-physiology/neuron-firing', 'physics/wave-interference'],
      },
    ],
  },
  {
    slug: 'earth-science',
    name: 'Earth Science and Geology',
    shortName: 'Earth Science',
    tagline: 'The forces that build mountains and move water and air.',
    description:
      'Drive tectonic plates together and apart, follow rocks through the rock cycle, slice into Earth’s layers, build weather systems and trace a water molecule around the planet.',
    hue: 18,
    icon: 'mountain',
    topics: [
      {
        slug: 'plate-tectonics',
        title: 'Plate Tectonics',
        summary: 'Move plates and observe what happens at divergent, convergent and transform boundaries.',
        keywords: ['plate tectonics', 'earthquake', 'volcano', 'subduction', 'boundary', 'continental drift'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['earth-science/earth-layers', 'astronomy/solar-system', 'physics/wave-interference', 'physics/newtons-laws'],
      },
      {
        slug: 'rock-cycle',
        title: 'Rock Cycle',
        summary: 'Apply heat, pressure and weathering to turn rocks from one type into another.',
        keywords: ['rock cycle', 'igneous', 'sedimentary', 'metamorphic', 'weathering', 'magma'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['earth-science/plate-tectonics', 'earth-science/earth-layers', 'chemistry/acids-and-bases', 'chemistry/atomic-structure'],
      },
      {
        slug: 'earth-layers',
        title: 'Earth’s Layers',
        summary: 'Cut into a 3D Earth and compare the temperature, density and state of each layer.',
        keywords: ['crust', 'mantle', 'core', 'layers', 'density', 'lithosphere'],
        level: 'Beginner',
        kind: '3D',
        status: 'live',
        minutes: 12,
        related: ['earth-science/plate-tectonics', 'earth-science/rock-cycle', 'astronomy/solar-system', 'mathematics/geometry-3d'],
      },
      {
        slug: 'weather',
        title: 'Weather and Atmospheric Conditions',
        summary: 'Change temperature, pressure and humidity and watch clouds and precipitation form.',
        keywords: ['weather', 'pressure', 'humidity', 'dew point', 'clouds', 'atmosphere'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['earth-science/earth-layers', 'ecology/climate-change', 'botany/transpiration', 'physics/newtons-laws'],
      },
      {
        slug: 'water-cycle',
        title: 'Water Cycle',
        summary: 'Control the sun and terrain and follow water through evaporation, condensation and runoff.',
        keywords: ['water cycle', 'evaporation', 'condensation', 'precipitation', 'runoff', 'groundwater'],
        level: 'Beginner',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['earth-science/weather', 'botany/transpiration', 'ecology/climate-change', 'earth-science/rock-cycle'],
      },
    ],
  },
  {
    slug: 'ecology',
    name: 'Ecology and Environmental Science',
    shortName: 'Ecology',
    tagline: 'How organisms interact with each other and the planet.',
    description:
      'Model predators and prey, trace carbon through the Earth system, test simple climate models and see how diversity and pollution affect ecosystem health.',
    hue: 168,
    icon: 'globe',
    topics: [
      {
        slug: 'population-dynamics',
        title: 'Ecosystem Population Dynamics',
        summary: 'Set predator and prey populations and watch their numbers rise and fall over time.',
        keywords: ['predator', 'prey', 'population', 'lotka-volterra', 'carrying capacity', 'ecosystem'],
        level: 'Intermediate',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['zoology/food-webs', 'ecology/biodiversity', 'biology/natural-selection', 'mathematics/graphing-functions'],
      },
      {
        slug: 'carbon-cycle',
        title: 'Carbon Cycle',
        summary: 'Move carbon between the atmosphere, oceans, living things and rocks.',
        keywords: ['carbon cycle', 'carbon dioxide', 'photosynthesis', 'respiration', 'fossil fuels', 'reservoir'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 15,
        related: ['ecology/climate-change', 'biology/photosynthesis', 'earth-science/water-cycle', 'ecology/population-dynamics'],
      },
      {
        slug: 'climate-change',
        title: 'Climate Change',
        summary: 'Change greenhouse gas levels in a simplified climate model and observe the temperature response.',
        keywords: ['climate change', 'greenhouse effect', 'global warming', 'co2', 'radiative forcing'],
        level: 'Advanced',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['ecology/carbon-cycle', 'earth-science/weather', 'ecology/biodiversity', 'earth-science/water-cycle'],
      },
      {
        slug: 'biodiversity',
        title: 'Biodiversity and Ecosystem Stability',
        summary: 'Add and remove species and test how diversity affects an ecosystem’s resilience.',
        keywords: ['biodiversity', 'species', 'stability', 'resilience', 'keystone species'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['zoology/food-webs', 'ecology/population-dynamics', 'biology/natural-selection', 'ecology/climate-change'],
      },
      {
        slug: 'pollution',
        title: 'Pollution and Environmental Impact',
        summary: 'Introduce pollutants into a simulated lake and track their effects on life.',
        keywords: ['pollution', 'eutrophication', 'contaminant', 'bioaccumulation', 'water quality'],
        level: 'Intermediate',
        kind: 'Experiment',
        status: 'live',
        minutes: 15,
        related: ['zoology/food-webs', 'ecology/biodiversity', 'chemistry/acids-and-bases', 'earth-science/water-cycle'],
      },
    ],
  },
  {
    slug: 'mathematics',
    name: 'Mathematics and Scientific Modeling',
    shortName: 'Math & Modeling',
    tagline: 'The language scientists use to describe the world.',
    description:
      'Rotate 3D shapes, add vectors, transform graphs, run probability experiments and learn to read scientific data with confidence.',
    hue: 44,
    icon: 'function',
    topics: [
      {
        slug: 'geometry-3d',
        title: '3D Geometry Explorer',
        summary: 'Rotate and resize 3D shapes and watch their surface area and volume update.',
        keywords: ['geometry', '3d', 'volume', 'surface area', 'polyhedron', 'prism', 'sphere'],
        level: 'Beginner',
        kind: '3D',
        status: 'live',
        minutes: 12,
        related: ['mathematics/vector-addition', 'mathematics/graphing-functions', 'mathematics/probability', 'earth-science/earth-layers'],
      },
      {
        slug: 'vector-addition',
        title: 'Vector Addition',
        summary: 'Drag vectors to change their size and direction and see the resultant form.',
        keywords: ['vector', 'resultant', 'magnitude', 'direction', 'components'],
        level: 'Intermediate',
        kind: '2D',
        status: 'live',
        minutes: 12,
        related: ['physics/projectile-motion', 'physics/newtons-laws', 'mathematics/graphing-functions', 'mathematics/geometry-3d'],
      },
      {
        slug: 'graphing-functions',
        title: 'Graphing Functions',
        summary: 'Change parameters in an equation and watch the graph shift, stretch and flip.',
        keywords: ['function', 'graph', 'parabola', 'transformation', 'slope', 'sine'],
        level: 'Beginner',
        kind: 'Graph',
        status: 'live',
        minutes: 15,
        related: ['mathematics/vector-addition', 'mathematics/data-visualization', 'physics/projectile-motion', 'physics/wave-interference'],
      },
      {
        slug: 'probability',
        title: 'Probability and Random Experiments',
        summary: 'Flip coins and roll dice thousands of times and watch distributions take shape.',
        keywords: ['probability', 'random', 'distribution', 'dice', 'coin', 'law of large numbers'],
        level: 'Beginner',
        kind: 'Experiment',
        status: 'live',
        minutes: 12,
        related: ['mathematics/data-visualization', 'biology/natural-selection', 'mathematics/graphing-functions', 'ecology/population-dynamics'],
      },
      {
        slug: 'data-visualization',
        title: 'Scientific Data Visualization',
        summary: 'Change variables in a dataset and learn how charts can reveal — or hide — patterns.',
        keywords: ['data', 'chart', 'graph', 'statistics', 'correlation', 'variables'],
        level: 'Intermediate',
        kind: 'Graph',
        status: 'live',
        minutes: 12,
        related: ['mathematics/probability', 'mathematics/graphing-functions', 'ecology/population-dynamics', 'ecology/climate-change'],
      },
    ],
  },
];

/* ---------- Helpers ---------- */

export const topicUrl = (branch: Branch, topic: Topic) => `/${branch.slug}/${topic.slug}/`;
export const branchUrl = (branch: Branch) => `/${branch.slug}/`;

export interface TopicRef {
  branch: Branch;
  topic: Topic;
  url: string;
}

export const allTopics: TopicRef[] = branches.flatMap((branch) =>
  branch.topics.map((topic) => ({ branch, topic, url: topicUrl(branch, topic) })),
);

export const liveTopics = allTopics.filter((t) => t.topic.status === 'live');

export function getBranch(slug: string): Branch | undefined {
  return branches.find((b) => b.slug === slug);
}

export function getTopic(branchSlug: string, topicSlug: string): TopicRef | undefined {
  return allTopics.find((t) => t.branch.slug === branchSlug && t.topic.slug === topicSlug);
}

/**
 * Related topics: other topics in the same branch first, then topics in other
 * branches that share keywords. Live topics are preferred.
 */
export function relatedTopics(ref: TopicRef, limit = 4): TopicRef[] {
  const kw = new Set(ref.topic.keywords);
  const scored = allTopics
    .filter((t) => t.url !== ref.url)
    .map((t) => {
      const path = `${t.branch.slug}/${t.topic.slug}`;
      let score = t.branch.slug === ref.branch.slug ? 3 : 0;
      if (ref.topic.related?.includes(path)) score += 20;
      score += t.topic.keywords.filter((k) => kw.has(k)).length * 2;
      if (t.topic.status === 'live') score += 1;
      return { t, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.t);
}

export const stats = {
  branches: branches.length,
  topics: allTopics.length,
  live: liveTopics.length,
};
