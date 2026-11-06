import type { QuizQuestion } from '../quiz-types';

export const transitQuiz: QuizQuestion[] = [
  {
    question: 'What does the transit method detect?',
    options: [
      'Light reflected by the planet',
      'A small, regular dip in a star’s brightness when a planet passes in front of it',
      'The planet’s gravity pulling on the telescope',
      'Radio signals from the planet',
    ],
    answer: 1,
    explanation: 'Telescopes usually cannot see the planet at all. They measure the star’s total light, and a planet crossing the star’s disc blocks a tiny fraction of it.',
    difficulty: 'Basic',
  },
  {
    question: 'A planet’s radius is doubled while everything else stays the same. What happens to the transit depth?',
    options: ['It halves', 'It doubles', 'It becomes about four times deeper', 'It stays the same'],
    answer: 2,
    explanation: 'The depth depends on the area of the star that is blocked: depth ≈ (planet radius ÷ star radius)². Doubling the radius quadruples the area.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is an Earth-sized planet much easier to detect around a small red dwarf than around a Sun-like star?',
    options: [
      'Red dwarfs are brighter',
      'The planet blocks a larger fraction of a smaller star’s disc, so the dip is deeper',
      'Red dwarfs are closer to Earth',
      'Planets around red dwarfs are always bigger',
    ],
    answer: 1,
    explanation: 'A red dwarf with 0.3 times the Sun’s radius gives a dip about 11 times deeper for the same planet. Its planets also orbit closer, so they transit more often.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why can’t we see transits of most planets around other stars?',
    options: [
      'Most planets are too dark',
      'The planet’s orbit must be lined up almost edge-on to our line of sight; otherwise it passes above or below the star as seen from Earth',
      'Transits only happen at night',
      'Most stars have no planets',
    ],
    answer: 1,
    explanation: 'Orbits are tilted at random. The chance of a transit is roughly the star’s radius divided by the orbit’s radius: about 0.5% for an Earth twin and about 10% for a hot Jupiter.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, a Jupiter twin transits at 90° inclination but not at 89°. Why does such a small change matter?',
    options: [
      'Jupiter shrinks',
      'At 5.2 AU, a 1° tilt shifts the planet’s path by about 20 star radii, far above or below the star',
      'The star moves',
      'The period changes',
    ],
    answer: 1,
    explanation: 'The impact parameter b = a cos i. With a ≈ 1,100 star radii, cos 89° × 1,100 ≈ 19. Transits need b < 1 + Rp/R*.',
    difficulty: 'Advanced',
  },
  {
    question: 'How do astronomers find a planet’s orbital period from transits?',
    options: [
      'By measuring the depth of the dip',
      'By timing the interval between repeated transits',
      'By measuring the star’s colour',
      'By counting the number of planets',
    ],
    answer: 1,
    explanation: 'The dips repeat once per orbit. Then Kepler’s third law gives the orbit’s size from the period and the star’s mass.',
    difficulty: 'Basic',
  },
  {
    question: 'Compare the Hot Jupiter and Jupiter twin presets. Why does the Jupiter twin’s transit last much longer (about 33 h compared with 3 h)?',
    options: [
      'Its planet is bigger',
      'A planet far from its star moves much more slowly along its orbit, so it takes longer to cross the star',
      'Its star is bigger',
      'Long transits are caused by noise',
    ],
    answer: 1,
    explanation: 'Orbital speed falls with distance (v ∝ 1/√a). Distant planets cross the star slowly, but transit only once per long orbit: every 11.9 years for a Jupiter twin.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does a transit light curve have a curved, rounded bottom instead of a perfectly flat one?',
    options: [
      'The planet spins',
      'Limb darkening: the star looks dimmer near its edge than at its centre, so the planet blocks more light when it is near the middle',
      'The telescope is out of focus',
      'The planet has rings',
    ],
    answer: 1,
    explanation: 'Near the edge we see cooler, higher layers of the star. Fitting the shape of the dip tells astronomers about both the planet and the star.',
    difficulty: 'Advanced',
  },
  {
    question: 'An Earth twin crossing a Sun-like star dims it by only about 0.01% (about 100 parts per million). What does this mean for finding Earth-like planets?',
    options: [
      'They are easy to spot with any telescope',
      'Very precise measurements are needed, usually from space, and many transits are combined to see the dip above the noise',
      'They cannot be found at all',
      'They are found by their reflected light',
    ],
    answer: 1,
    explanation: 'Try the Ground telescope noise in the simulator: the Earth twin’s dip disappears in the scatter. Space telescopes such as Kepler avoid the blurring and flickering caused by Earth’s atmosphere.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The transit depth gives a planet’s radius. What extra measurement lets astronomers work out whether it is rocky or gaseous?',
    options: [
      'Its colour in the simulator',
      'Its mass, usually from the star’s wobble (radial velocity), giving the planet’s density',
      'The number of transits',
      'The star’s age',
    ],
    answer: 1,
    explanation: 'Radius plus mass gives density: rocky planets are dense, gas giants are not. During a transit, starlight filtering through the planet’s atmosphere can also reveal its gases.',
    difficulty: 'Advanced',
  },
];
