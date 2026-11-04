/**
 * Approximate properties of Earth's interior.
 * Density and pressure follow the Preliminary Reference Earth Model (PREM,
 * Dziewonski & Anderson 1981). Temperatures are representative estimates;
 * published values vary by several hundred degrees, especially deep down.
 */

export const R_EARTH = 6371; // km

export interface Layer {
  id: string;
  name: string;
  top: number; // depth in km
  bottom: number;
  state: string;
  composition: string;
  temp: string;
  density: string;
  colour: string;
  about: string;
}

export const LAYERS: Layer[] = [
  {
    id: 'crust',
    name: 'Crust',
    top: 0,
    bottom: 35,
    state: 'Solid rock',
    composition: 'Granite (continents) and basalt (ocean floor)',
    temp: '≈ 15 °C at the surface to ≈ 500–900 °C at the base',
    density: '2.7–3.0 g/cm³',
    colour: '#8d6e4f',
    about: 'Earth’s thin, rocky skin: about 5–10 km thick under oceans and 30–70 km under continents. Together with the top of the mantle it forms the rigid tectonic plates.',
  },
  {
    id: 'upper-mantle',
    name: 'Upper mantle',
    top: 35,
    bottom: 660,
    state: 'Solid, but hot enough to flow very slowly',
    composition: 'Peridotite — rock rich in the mineral olivine',
    temp: '≈ 500 °C to ≈ 1,700 °C',
    density: '3.3–4.0 g/cm³',
    colour: '#d9541e',
    about: 'Includes the asthenosphere, a weak, slowly flowing zone on which tectonic plates move. Small amounts of melt here feed many volcanoes.',
  },
  {
    id: 'lower-mantle',
    name: 'Lower mantle',
    top: 660,
    bottom: 2890,
    state: 'Solid (flows over millions of years)',
    composition: 'Magnesium-iron silicates such as bridgmanite',
    temp: '≈ 1,700 °C to ≈ 3,500 °C',
    density: '4.4–5.6 g/cm³',
    colour: '#b83a26',
    about: 'The largest layer by volume. Enormous pressure keeps it solid despite the heat; slow convection here helps drive plate tectonics.',
  },
  {
    id: 'outer-core',
    name: 'Outer core',
    top: 2890,
    bottom: 5150,
    state: 'Liquid metal',
    composition: 'Iron and nickel with some lighter elements',
    temp: '≈ 4,000 °C to ≈ 5,200 °C',
    density: '9.9–12.2 g/cm³',
    colour: '#f0a020',
    about: 'Swirling liquid iron in the outer core generates Earth’s magnetic field (the geodynamo), which shields us from the solar wind.',
  },
  {
    id: 'inner-core',
    name: 'Inner core',
    top: 5150,
    bottom: 6371,
    state: 'Solid metal',
    composition: 'Mostly iron and nickel',
    temp: '≈ 5,200 °C to ≈ 5,500 °C (about as hot as the Sun’s surface)',
    density: '12.8–13.1 g/cm³',
    colour: '#ffe27a',
    about: 'Although it is the hottest layer, the immense pressure — over 3.3 million times atmospheric pressure — keeps it solid.',
  },
];

// Depth profiles: [depth km, temperature °C, density g/cm³, pressure GPa]
export const PROFILE: [number, number, number, number][] = [
  [0, 15, 2.7, 0],
  [35, 600, 3.38, 1],
  [100, 1300, 3.37, 3.2],
  [410, 1500, 3.72, 13.4],
  [660, 1700, 3.99, 23.8],
  [660.01, 1700, 4.38, 23.8],
  [1000, 1900, 4.58, 38.6],
  [2000, 2400, 5.12, 89],
  [2890, 3500, 5.57, 136],
  [2890.01, 4000, 9.9, 136],
  [4000, 4600, 11.0, 238],
  [5150, 5200, 12.17, 329],
  [5150.01, 5200, 12.76, 329],
  [6371, 5400, 13.09, 364],
];

export function profileAt(depth: number) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (depth <= b[0]) {
      const t = (depth - a[0]) / (b[0] - a[0] || 1);
      return { temp: a[1] + (b[1] - a[1]) * t, density: a[2] + (b[2] - a[2]) * t, pressure: a[3] + (b[3] - a[3]) * t };
    }
  }
  const z = PROFILE[PROFILE.length - 1];
  return { temp: z[1], density: z[2], pressure: z[3] };
}

export const layerAt = (depth: number) => LAYERS.find((l) => depth >= l.top && depth <= l.bottom) ?? LAYERS[LAYERS.length - 1];
