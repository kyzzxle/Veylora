import type { QuizQuestion } from '../quiz-types';

export const tidesQuiz: QuizQuestion[] = [
  {
    question: 'What mainly causes the ocean tides?',
    options: [
      'Wind blowing across the ocean',
      'The difference in the Moon’s (and Sun’s) gravitational pull across Earth',
      'Earth’s magnetic field',
      'Rivers flowing into the sea',
    ],
    answer: 1,
    explanation: 'The Moon pulls slightly harder on the side of Earth nearest to it and slightly less on the far side. This difference, the tidal force, stretches the oceans into two bulges.',
    difficulty: 'Basic',
  },
  {
    question: 'Why are there usually two high tides a day rather than one?',
    options: [
      'The Moon orbits Earth twice a day',
      'There are two tidal bulges, one facing the Moon and one on the opposite side, and Earth’s spin carries each place through both',
      'The Sun and the Moon each cause one',
      'Waves reflect off the continents',
    ],
    answer: 1,
    explanation: 'On the far side, the Moon’s pull is weaker than at Earth’s centre, so the water there is effectively left behind, forming a second bulge.',
    difficulty: 'Basic',
  },
  {
    question: 'High tides happen about every 12 hours 25 minutes, not every 12 hours. Why?',
    options: [
      'Earth’s spin is slowing down very quickly',
      'While Earth spins, the Moon moves along its orbit, so Earth must turn a little extra (24 h 50 min in total) to face the Moon again',
      'Tides are delayed by the Sun',
      'Clocks are not accurate enough',
    ],
    answer: 1,
    explanation: 'The Moon moves about 12° a day around Earth. Turning that extra 12° takes about 50 minutes, so the tides arrive about 50 minutes later each day.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When do spring tides (the largest tidal range) occur?',
    options: [
      'Only in the spring season',
      'At new moon and full moon, when the Sun and Moon are in line with Earth',
      'At the quarter moons',
      'When the Moon is farthest from Earth',
    ],
    answer: 1,
    explanation: 'When the Sun, Earth and Moon line up, the Sun’s bulges add to the Moon’s. “Spring” comes from an old word meaning “to leap up”, not the season.',
    difficulty: 'Basic',
  },
  {
    question: 'Why is the tidal range smallest at the first and third quarter moons (neap tides)?',
    options: [
      'The Moon is closest to the Sun',
      'The Sun and Moon pull at right angles, so the Sun’s bulges partly fill in the Moon’s low tides',
      'The Moon stops pulling',
      'The oceans are frozen',
    ],
    answer: 1,
    explanation: 'In the simulator at the quarters, the Sun’s dashed bulge lies across the Moon’s, so high tides are lower and low tides higher.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The Sun’s gravitational pull on Earth is about 180 times stronger than the Moon’s. Why is the Sun’s tidal effect only about 46% of the Moon’s?',
    options: [
      'Sunlight pushes the oceans back',
      'Tides depend on how much the pull changes across Earth’s width, which falls off with the cube of distance; the Sun is about 390 times farther away',
      'The Sun only pulls during the day',
      'The Sun’s gravity does not reach Earth’s oceans',
    ],
    answer: 1,
    explanation: 'Tidal effect ∝ mass ÷ distance³. The Sun is 27 million times more massive than the Moon, but 390³ ≈ 59 million, so its tidal effect is about 27 ÷ 59 ≈ 0.46 of the Moon’s.',
    difficulty: 'Advanced',
  },
  {
    question: 'In the idealized model, about how much bigger is the spring tide range than the neap tide range?',
    options: ['About the same', 'About 1.2 times', 'About 2.7 times', 'About 10 times'],
    answer: 2,
    explanation: 'Spring range ∝ 1 + 0.46 and neap range ∝ 1 − 0.46, so the ratio is about 1.46 ÷ 0.54 ≈ 2.7. Real places differ because of local geography.',
    difficulty: 'Advanced',
  },
  {
    question: 'Set the Moon to “Near” in the simulator. What happens to the tides, and why?',
    options: [
      'They get smaller, because the Moon moves faster',
      'They get larger, because the Moon’s tidal effect depends strongly on distance (1/d³)',
      'Nothing changes',
      'The Sun’s tides disappear',
    ],
    answer: 1,
    explanation: 'At its closest the Moon’s tidal effect is about 18% larger than average. A spring tide at the same time gives especially high “king tides”.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which of these is a real limitation of the simulator’s tide heights?',
    options: [
      'Real tides at coasts depend on coastlines, ocean depth and basin shape, so local ranges can be far larger, smaller or delayed',
      'Real tides are never more than 10 cm',
      'The Moon has no effect on real tides',
      'Real tides happen once a week',
    ],
    answer: 0,
    explanation: 'The model shows the “equilibrium tide” on an Earth covered by ocean. The Bay of Fundy in Canada has ranges of over 15 m, while parts of the Mediterranean have only a few tens of centimetres.',
    difficulty: 'Basic',
  },
  {
    question: 'Over millions of years, tidal friction has an effect on the Earth–Moon system. What is it?',
    options: [
      'Earth’s spin speeds up and the Moon gets closer',
      'Earth’s spin slows down (days get longer) and the Moon slowly moves away, about 3.8 cm per year',
      'The Moon stops orbiting',
      'Nothing measurable',
    ],
    answer: 1,
    explanation: 'Friction from the tides transfers spin energy from Earth to the Moon’s orbit. The Moon’s retreat is measured by bouncing lasers off reflectors left by the Apollo astronauts.',
    difficulty: 'Advanced',
  },
];
