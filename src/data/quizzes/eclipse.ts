import type { QuizQuestion } from '../quiz-types';

export const eclipseQuiz: QuizQuestion[] = [
  {
    question: 'What lines up during a solar eclipse?',
    options: [
      'Sun – Earth – Moon, with Earth in the middle',
      'Sun – Moon – Earth, with the Moon in the middle',
      'Earth – Sun – Moon, with the Sun in the middle',
      'Nothing needs to line up',
    ],
    answer: 1,
    explanation: 'In a solar eclipse the Moon passes between the Sun and Earth, and its shadow falls on Earth. It can only happen at new moon.',
    difficulty: 'Basic',
  },
  {
    question: 'At which phase of the Moon can a lunar eclipse happen?',
    options: ['New moon', 'First quarter', 'Full moon', 'Any phase'],
    answer: 2,
    explanation: 'A lunar eclipse happens when the Moon passes into Earth’s shadow, which points directly away from the Sun. The Moon is there only at full moon.',
    difficulty: 'Basic',
  },
  {
    question: 'Why don’t we get a solar eclipse at every new moon?',
    options: [
      'The Moon is too small',
      'The Moon’s orbit is tilted about 5° to Earth’s orbit, so the Moon usually passes above or below the Sun',
      'Clouds block most eclipses',
      'The Moon only orbits Earth twice a year',
    ],
    answer: 1,
    explanation: 'Eclipses need a new or full moon that falls close to a node, where the tilted orbit crosses Earth’s orbital plane. In the side view, the Moon’s shadow usually misses Earth.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the difference between the umbra and the penumbra?',
    options: [
      'The umbra is the dark central shadow where the light source is completely hidden; the penumbra is the paler outer shadow where it is only partly hidden',
      'The umbra is the Moon’s shadow and the penumbra is Earth’s shadow',
      'They are two names for the same shadow',
      'The penumbra is darker than the umbra',
    ],
    answer: 0,
    explanation: 'Because the Sun is a large disc, not a point, every shadow has a fully dark core (umbra) and a partly lit fringe (penumbra).',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do some solar eclipses leave a bright ring (annular eclipses) instead of being total?',
    options: [
      'The Sun is bigger on those days',
      'The Moon is near the far point of its orbit, so it looks slightly smaller than the Sun and cannot cover it completely',
      'Earth’s atmosphere bends light around the Moon',
      'The Moon is only partly in front of the Sun',
    ],
    answer: 1,
    explanation: 'The Moon’s distance varies from about 363,000 km to 405,000 km. In the simulator, at “Far” and “Average” distances the Moon is slightly smaller than the Sun, giving an annular eclipse; at “Near” it covers the Sun completely.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why can the Moon just cover the Sun even though the Sun is about 400 times wider?',
    options: [
      'The Sun is also about 400 times farther away, so they look almost the same size in our sky',
      'The Moon is closer to the Sun',
      'The Moon is made of denser material',
      'It is an optical illusion caused by the atmosphere',
    ],
    answer: 0,
    explanation: 'Apparent size depends on size divided by distance. Both ratios are about 400, so the two discs appear about half a degree wide: a remarkable coincidence.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does the Moon often look red during a total lunar eclipse?',
    options: [
      'The Moon heats up',
      'Sunlight passing through Earth’s atmosphere is bent into the shadow, and blue light is scattered out, leaving reddish light',
      'Mars reflects light onto it',
      'The Moon is made of iron',
    ],
    answer: 1,
    explanation: 'Earth’s atmosphere scatters blue light (the reason sunsets are red) and bends the remaining light into the umbra. The Moon is lit by the glow of all Earth’s sunrises and sunsets at once.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why can a total lunar eclipse be seen by far more people than a total solar eclipse?',
    options: [
      'Lunar eclipses last longer and are visible from the whole night side of Earth; totality in a solar eclipse is seen only along a narrow path where the Moon’s small umbra touches Earth',
      'Lunar eclipses happen during the day',
      'Solar eclipses only happen at the poles',
      'They are equally widely visible',
    ],
    answer: 0,
    explanation: 'Earth’s umbra is much bigger than the Moon, so everyone who can see the Moon sees the eclipse. The Moon’s umbra on Earth is usually less than about 270 km wide.',
    difficulty: 'Advanced',
  },
  {
    question: 'Eclipses come in “eclipse seasons” about every 173 days. What causes this?',
    options: [
      'The Moon speeds up twice a year',
      'Twice a year the line of nodes of the Moon’s orbit points towards the Sun, so new and full moons near those times happen close to a node',
      'Earth’s axis flips every six months',
      'The Sun’s activity cycle',
    ],
    answer: 1,
    explanation: 'As Earth orbits the Sun, the Sun lines up with the line of nodes twice in each “eclipse year” of about 346.6 days (slightly shorter than a calendar year because the nodes slowly drift). Play time forward to see eclipses cluster.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which statement about the simulator is accurate?',
    options: [
      'All the bodies and distances are drawn to scale',
      'Eclipse types are calculated from real sizes, distances and the 5.1° tilt, but in the drawings the Earth, Moon and heights are enlarged ×8 so you can see them',
      'It predicts the exact date and path of the next real eclipse',
      'It shows the Moon orbiting in the same plane as Earth',
    ],
    answer: 1,
    explanation: 'Real eclipse prediction also needs the Moon’s elliptical orbit, Earth’s rotation and many small perturbations. The simulator keeps the geometry that decides whether an eclipse happens and what type it is.',
    difficulty: 'Advanced',
  },
];
