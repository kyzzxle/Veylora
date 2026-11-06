import type { QuizQuestion } from '../quiz-types';

export const volcanoesQuiz: QuizQuestion[] = [
  {
    question: 'What is the difference between magma and lava?',
    options: [
      'Magma is hotter than lava',
      'Magma is molten rock underground; lava is the same material once it erupts at the surface',
      'Lava contains crystals and magma does not',
      'They come from different parts of the mantle',
    ],
    answer: 1,
    explanation: 'It is the same material in a different place. Lava has usually lost much of its dissolved gas.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, raising the silica content makes the magma much more viscous. Why?',
    options: [
      'Silica makes magma hotter',
      'Silica dissolves the gas',
      'Silicate units link into chains and networks that resist flow',
      'Silica turns into crystals instantly',
    ],
    answer: 2,
    explanation: 'More silica means more linked silicate structures. Rhyolite (about 70–75% SiO₂) is far stickier than basalt (about 50%).',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which change would make a magma less viscous?',
    options: ['Raising its temperature', 'Adding more crystals', 'Increasing its silica content', 'Cooling it down'],
    answer: 0,
    explanation: 'Hotter magma flows more easily. Crystals and silica both increase viscosity.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does dissolved gas come out of solution as magma rises?',
    options: [
      'The magma gets hotter',
      'The pressure falls, so less gas can stay dissolved, like opening a fizzy drink',
      'Crystals absorb the gas',
      'The gas is made by the crater',
    ],
    answer: 1,
    explanation: 'Gas solubility increases with pressure. As pressure drops on the way up, bubbles form and expand.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Two magmas have the same high gas content. One is runny basalt, the other sticky rhyolite rising quickly. Which is more likely to erupt explosively, and why?',
    options: [
      'The basalt, because it is hotter',
      'Both erupt identically because they have the same gas',
      'Neither, because gas does not affect eruptions',
      'The rhyolite, because its bubbles cannot escape, so the magma fragments into ash',
    ],
    answer: 3,
    explanation: 'In runny magma, bubbles rise out. In viscous, fast-rising magma they are trapped until the magma shatters. Gas alone does not decide the style.',
    difficulty: 'Advanced',
  },
  {
    question: 'A very viscous magma rises extremely slowly and erupts as a steep lava dome instead of exploding. What explains this in the simulator?',
    options: [
      'It has no gas at all',
      'Slow ascent lets gas leak out through connected bubbles before the magma can fragment',
      'Domes only form on shield volcanoes',
      'The chamber is too deep',
    ],
    answer: 1,
    explanation: 'Outgassing during slow ascent removes the gas that would otherwise drive an explosion. Ascent rate matters as well as composition.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which describes a shield volcano?',
    options: [
      'A broad, gently sloping volcano built mainly from runny basalt lava flows',
      'A steep cone of alternating ash and lava layers',
      'A small cone built only of cinders',
      'A collapsed crater filled with water',
    ],
    answer: 0,
    explanation: 'Mauna Loa and Kīlauea are shield volcanoes. Stratovolcanoes such as Mount Fuji are steeper and alternate lava with explosive deposits.',
    difficulty: 'Basic',
  },
  {
    question: 'Which volcanic hazard is usually the deadliest, because it is hot, fast and cannot be outrun?',
    options: ['Lava flows', 'Ash fall', 'Volcanic gas from fumaroles', 'Pyroclastic density currents'],
    answer: 3,
    explanation: 'Pyroclastic density currents can exceed 100 km/h at hundreds of degrees Celsius. Lava flows are usually slow enough to escape.',
    difficulty: 'Basic',
  },
  {
    question: 'On the hazard map, turning on heavy rain makes lahars appear far down the river valleys. What are lahars?',
    options: [
      'Fast lava flows',
      'Clouds of volcanic gas',
      'Volcanic mudflows of water mixed with ash and debris, which follow river channels',
      'Earthquakes caused by eruptions',
    ],
    answer: 2,
    explanation: 'Rain or melting snow mixes with loose volcanic material. Lahars can travel tens of kilometres and strike long after an eruption.',
    difficulty: 'Intermediate',
  },
  {
    question: 'With the wind blowing east, a town to the west of the volcano gets almost no ash, but a town 15 km east gets a thick layer. What does this show?',
    options: [
      'Ash only falls on eastern towns',
      'Ash fall depends on wind direction and speed as well as distance',
      'The western town is higher up',
      'Ash moves along valleys like lava',
    ],
    answer: 1,
    explanation: 'Ash is carried by the wind. Hazard maps for ash use typical wind patterns, while lava and lahars follow the terrain instead.',
    difficulty: 'Intermediate',
  },
];
