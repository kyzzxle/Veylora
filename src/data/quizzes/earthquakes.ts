import type { QuizQuestion } from '../quiz-types';

export const earthquakesQuiz: QuizQuestion[] = [
  {
    question: 'In the simulator, the fence across the fault bends gradually and then snaps. What does this show?',
    options: [
      'Elastic strain builds up in locked rocks and is released suddenly when the fault slips',
      'The fault slides smoothly all the time',
      'Earthquakes are caused by the fence',
      'Rocks melt before an earthquake',
    ],
    answer: 0,
    explanation: 'This is elastic rebound: the rocks bend while the fault is locked, then spring back when it slips, leaving a permanent offset.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the difference between the focus and the epicenter?',
    options: [
      'They are the same point',
      'The epicenter is underground and the focus is on the surface',
      'The focus is where the rupture starts underground; the epicenter is the point on the surface directly above it',
      'The focus is the place with the most damage',
    ],
    answer: 2,
    explanation: 'On a sloping fault the epicenter can even lie some distance from where the fault reaches the surface.',
    difficulty: 'Basic',
  },
  {
    question: 'In a fault, the hanging wall has moved up relative to the footwall. What kind of fault is it, and what stress caused it?',
    options: [
      'A normal fault, caused by tension',
      'A strike-slip fault, caused by shear',
      'A transform boundary caused by melting',
      'A reverse fault, caused by compression',
    ],
    answer: 3,
    explanation: 'Squeezing the crust pushes the hanging wall up over the footwall. Tension produces normal faults, where it slides down.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How do particles of rock move as a P-wave passes?',
    options: [
      'Back and forth in the same direction the wave is travelling',
      'Up and down, perpendicular to the direction of travel',
      'In circles along the surface only',
      'They do not move',
    ],
    answer: 0,
    explanation: 'P-waves are compressional: the rock is squeezed and stretched along the direction of travel.',
    difficulty: 'Basic',
  },
  {
    question: 'When you add a liquid layer in the simulator, the S-wave stops at the boundary. Why?',
    options: [
      'S-waves are too slow to cross',
      'Liquids cannot resist shearing, so a shear wave cannot travel through them',
      'Liquids absorb all seismic energy',
      'S-waves only travel through air',
    ],
    answer: 1,
    explanation: 'S-waves need a material that springs back when sheared. This is how scientists discovered that Earth’s outer core is liquid.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A station records the P-wave and then, 20 s later, the S-wave. Using d = 8.4 km/s × (S–P), roughly how far away was the earthquake?',
    options: ['20 km', '8.4 km', '168 km', '1,680 km'],
    answer: 2,
    explanation: '20 s × 8.4 km/s = 168 km. The constant comes from Vp·Vs/(Vp − Vs) with Vp = 6.0 and Vs = 3.5 km/s.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why are at least three stations needed to locate an epicenter?',
    options: [
      'Each station only works for one wave type',
      'Two stations always give the exact location',
      'Three stations make the earthquake larger',
      'Each station gives only a distance (a circle); two circles cross at two points, and a third picks out one',
    ],
    answer: 3,
    explanation: 'This is triangulation. Real networks use many stations and also work out the depth of the focus.',
    difficulty: 'Intermediate',
  },
  {
    question: 'One earthquake shakes the nearest station much harder than a distant one. What does this tell you about magnitude and intensity?',
    options: [
      'The earthquake has one magnitude, but the intensity of shaking varies from place to place',
      'The earthquake has a different magnitude at each station',
      'Intensity and magnitude are the same thing',
      'Distant stations record a bigger magnitude',
    ],
    answer: 0,
    explanation: 'Magnitude measures the earthquake itself. Intensity describes shaking at a location and depends on distance, depth and ground conditions.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, which change makes the moment magnitude (Mw) larger?',
    options: [
      'Making the focus deeper',
      'Moving the stations further away',
      'Increasing the rupture length or the amount of slip',
      'Choosing a strike-slip fault',
    ],
    answer: 2,
    explanation: 'The seismic moment M₀ = μ·A·D depends on the area that slipped and the amount of slip. Depth changes the shaking at the surface, not the magnitude.',
    difficulty: 'Advanced',
  },
  {
    question: 'Earthquake early-warning systems can give a few seconds of warning before strong shaking. Which fact makes this possible?',
    options: [
      'Surface waves arrive first',
      'Animals detect earthquakes days in advance',
      'Earthquakes always start slowly',
      'Fast P-waves arrive before the slower, more damaging S- and surface waves',
    ],
    answer: 3,
    explanation: 'Detecting the P-wave near the source lets alerts travel faster than the damaging waves, giving seconds to tens of seconds of warning further away.',
    difficulty: 'Intermediate',
  },
];
