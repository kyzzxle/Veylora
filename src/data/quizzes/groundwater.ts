import type { QuizQuestion } from '../quiz-types';

export const groundwaterQuiz: QuizQuestion[] = [
  {
    question: 'In an ordinary sand aquifer, where is the groundwater?',
    options: [
      'In an underground lake in a large cave',
      'In a fast-flowing underground river',
      'In the tiny pores between the sand grains',
      'Only in a layer of mud on top of the rock',
    ],
    answer: 2,
    explanation: 'Groundwater fills the spaces between grains and in cracks. Underground rivers exist only in special settings such as limestone caves.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the water table?',
    options: [
      'The top of the saturated zone, below which every pore is full of water',
      'The bottom of the deepest well in an area',
      'The surface of the nearest lake',
      'A layer of clay that stops water moving',
    ],
    answer: 0,
    explanation: 'Above the water table the pores hold both air and water (the unsaturated zone); below it they are full of water (the saturated zone).',
    difficulty: 'Basic',
  },
  {
    question: 'In the pores lab, clay has a higher porosity than sand but water soaks through it far more slowly. Why?',
    options: [
      'Clay has no pores at all',
      'Clay’s pores are tiny, so water flows through them very slowly and much of it clings to the particles',
      'Sand repels water',
      'Clay is heavier than sand',
    ],
    answer: 1,
    explanation: 'Porosity measures how much space there is; permeability depends on how large and well connected the openings are. High porosity does not mean high permeability.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Fractured granite can have a porosity below 1% yet still supply a well. How?',
    options: [
      'The granite slowly dissolves into water',
      'Water is stored inside the crystals',
      'The well pumps air instead',
      'Water flows quickly along connected cracks, even though they hold little water',
    ],
    answer: 3,
    explanation: 'Permeability depends strongly on fracture width (roughly its cube), so a few open, connected cracks can carry water well despite the small total volume.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the difference between an aquifer and an aquitard?',
    options: [
      'An aquitard stores and transmits water easily; an aquifer does not',
      'There is no difference',
      'An aquifer stores and transmits useful amounts of water; an aquitard lets water through only very slowly',
      'An aquifer is always made of clay',
    ],
    answer: 2,
    explanation: 'Aquifers (sand, gravel, fractured rock) yield water to wells. Aquitards such as clay slow water movement and can confine the aquifer below.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does water in a well drilled into a confined aquifer rise above the top of the aquifer, and sometimes flow out at the surface?',
    options: [
      'The water is under pressure because it is recharged higher up and trapped beneath an aquitard',
      'The pump pushes it up',
      'Heat from the Earth makes it boil upward',
      'Rain falls into the well',
    ],
    answer: 0,
    explanation: 'The water level in such a well rises to the potentiometric surface. Where that surface is above the ground, the well is a flowing artesian well.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Using Darcy’s law, Q = K × A × i: if K = 10 m/day, A = 500 m² and i = 0.002, what is the discharge Q?',
    options: ['0.1 m³/day', '10 m³/day', '100 m³/day', '2,500 m³/day'],
    answer: 1,
    explanation: 'Q = 10 m/day × 500 m² × 0.002 = 10 m³/day. Doubling the hydraulic gradient or the conductivity would double the flow.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the simulator, turning up the pumping well lowers the water table in a V-shaped dip around the well. What is this called?',
    options: ['A recharge mound', 'A potentiometric spring', 'An aquitard', 'A cone of depression'],
    answer: 3,
    explanation: 'Pumping draws water towards the well from all directions, lowering the water table most at the well (drawdown) and less further away.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, heavy pumping near the river makes the river change from “gaining” to “losing”. What does this mean?',
    options: [
      'The river gets more water from the aquifer than before',
      'The water table near the river falls below the river level, so river water leaks into the ground',
      'The river freezes',
      'Rainfall stops',
    ],
    answer: 1,
    explanation: 'Groundwater and surface water are connected: lowering the water table can reduce stream flow or dry up streams and wetlands.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the contamination experiment, salt and lead leak from the same tank. Why does the lead plume move much more slowly?',
    options: [
      'Lead is carried by the wind instead',
      'Lead flows uphill',
      'Lead sticks to clay and mineral surfaces (sorption), so it is held back relative to the groundwater',
      'Lead does not dissolve at all',
    ],
    answer: 2,
    explanation: 'Contaminants that sorb onto grains are retarded: they move at the groundwater speed divided by a retardation factor. Some, like fuel, also break down over time.',
    difficulty: 'Advanced',
  },
];
