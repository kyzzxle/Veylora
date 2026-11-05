/**
 * Planet data from the NASA Planetary Fact Sheet (rounded).
 * a: semi-major axis (AU); period: orbital period (Earth days);
 * L0: mean longitude at J2000.0 (degrees), used to place planets for a date
 * on circular orbits.
 */
export interface Planet {
  id: string;
  name: string;
  a: number;
  period: number;
  diameter: number; // km
  moons: string;
  temp: string;
  day: string;
  kind: string;
  colour: string;
  L0: number;
  fact: string;
}

export const PLANETS: Planet[] = [
  { id: 'mercury', name: 'Mercury', a: 0.387, period: 87.97, diameter: 4879, moons: '0', temp: '−180 °C to 430 °C', day: '176 Earth days (sunrise to sunrise)', kind: 'Rocky', colour: '#a8a29a', L0: 252.25, fact: 'The smallest planet and the closest to the Sun. With almost no atmosphere, its nights are freezing and its days scorching.' },
  { id: 'venus', name: 'Venus', a: 0.723, period: 224.7, diameter: 12104, moons: '0', temp: 'about 464 °C', day: '117 Earth days (it spins backwards)', kind: 'Rocky', colour: '#e8c77a', L0: 181.98, fact: 'The hottest planet: its thick carbon dioxide atmosphere traps heat in a runaway greenhouse effect.' },
  { id: 'earth', name: 'Earth', a: 1.0, period: 365.25, diameter: 12756, moons: '1', temp: 'about 15 °C (average)', day: '24 hours', kind: 'Rocky', colour: '#4f8fd9', L0: 100.46, fact: 'The only place known to have life, and the only planet with liquid water on its surface.' },
  { id: 'mars', name: 'Mars', a: 1.524, period: 687.0, diameter: 6792, moons: '2', temp: 'about −65 °C (average)', day: '24 h 40 min', kind: 'Rocky', colour: '#d0643c', L0: 355.45, fact: 'Home to Olympus Mons, the largest volcano in the solar system. Its red colour comes from iron oxide (rust) in the dust.' },
  { id: 'jupiter', name: 'Jupiter', a: 5.203, period: 4331, diameter: 142984, moons: '95+', temp: 'about −110 °C (cloud tops)', day: '9 h 56 min', kind: 'Gas giant', colour: '#d9b08c', L0: 34.4, fact: 'More than twice as massive as all the other planets combined. The Great Red Spot is a storm wider than Earth.' },
  { id: 'saturn', name: 'Saturn', a: 9.537, period: 10747, diameter: 120536, moons: '270+', temp: 'about −140 °C (cloud tops)', day: '10 h 33 min', kind: 'Gas giant', colour: '#e6cf94', L0: 49.94, fact: 'Its rings are made of countless pieces of ice and rock, but are mostly less than 1 km thick.' },
  { id: 'uranus', name: 'Uranus', a: 19.19, period: 30589, diameter: 51118, moons: '28+', temp: 'about −195 °C', day: '17 h 14 min', kind: 'Ice giant', colour: '#9fdbe0', L0: 313.23, fact: 'It is tipped on its side, with its axis tilted about 98°, probably after an ancient collision.' },
  { id: 'neptune', name: 'Neptune', a: 30.07, period: 59800, diameter: 49528, moons: '16', temp: 'about −200 °C', day: '16 h 6 min', kind: 'Ice giant', colour: '#4f6fe0', L0: 304.88, fact: 'The windiest planet, with gusts over 2,000 km/h. It was found in 1846 by mathematics before anyone saw it.' },
];

export const SUN = { name: 'The Sun', diameter: 1392700, fact: 'A medium-sized star that holds 99.8 % of the solar system’s mass. Light from it takes about 8 minutes 20 seconds to reach Earth.' };
export const AU_KM = 149_597_871;
