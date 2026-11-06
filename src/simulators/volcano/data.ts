/** Volcano parts, eruption styles, example eruptions and hazards. */

export type VolcanoType = 'strato' | 'shield';
export const TYPES: Record<VolcanoType, { name: string; example: string; magma: string; text: string }> = {
  strato: {
    name: 'Stratovolcano',
    example: 'Mount Fuji, Mount St. Helens, Mayon',
    magma: 'Andesite to dacite: viscous, often gas-rich',
    text: 'A steep cone built from alternating layers of lava and fragmented material (tephra) from explosive eruptions.',
  },
  shield: {
    name: 'Shield volcano',
    example: 'Mauna Loa and Kīlauea (Hawaiʻi)',
    magma: 'Basalt: hot, runny, gas escapes easily',
    text: 'A broad, gently sloping volcano built from thousands of thin, fluid lava flows, shaped like a warrior’s shield lying on the ground.',
  },
};

export type PartId = 'chamber' | 'conduit' | 'vent' | 'crater' | 'layers' | 'flow' | 'bedrock' | 'plume' | 'parasite';
export const PARTS: Record<PartId, { name: string; text: string }> = {
  chamber: { name: 'Magma chamber', text: 'A region of the crust, usually several kilometres down, where molten and partly crystallised magma collects. Many are mushy zones of crystals and melt rather than a single big cavity.' },
  conduit: { name: 'Main conduit', text: 'The pipe-like pathway that magma rises through from the chamber to the vent at the surface.' },
  vent: { name: 'Side vent (dike)', text: 'Magma can also break out sideways through a crack (a dike) and erupt from the flank instead of the summit.' },
  parasite: { name: 'Flank cone', text: 'A small cone built where a side vent reaches the surface, such as the many cones on the flanks of Mount Etna.' },
  crater: { name: 'Crater', text: 'The bowl-shaped depression around the main vent at the summit. A much larger collapse after a huge eruption forms a caldera.' },
  layers: { name: 'Layers of the volcano', text: 'Each eruption adds a layer. Stratovolcanoes alternate lava flows with ash and other tephra; shield volcanoes are mostly thin lava flows.' },
  flow: { name: 'Lava flow', text: 'Molten rock flowing over the surface. Once magma reaches the surface it is called lava. Runny basalt flows can travel tens of kilometres.' },
  bedrock: { name: 'Surrounding crust', text: 'Older rock beneath and around the volcano. Rising magma must push it aside or melt its way through.' },
  plume: { name: 'Eruption column', text: 'In an explosive eruption, hot gas and ash rise as a column that can reach the stratosphere, then spread downwind.' },
};

export type StyleId = 'effusive' | 'fountain' | 'dome' | 'vulcanian' | 'plinian';
export const STYLES: Record<StyleId, { name: string; kind: 'Effusive' | 'Explosive'; example: string; text: string }> = {
  effusive: { name: 'Effusive lava flows', kind: 'Effusive', example: 'Kīlauea, 2018', text: 'Runny, low-gas magma lets bubbles escape, so lava pours out quietly and flows downhill.' },
  fountain: { name: 'Hawaiian / Strombolian', kind: 'Effusive', example: 'Stromboli', text: 'Gas escapes from runny magma in bursts and jets, throwing lava fountains or blobs into the air, but the magma does not shatter into fine ash.' },
  dome: { name: 'Lava dome', kind: 'Effusive', example: 'Soufrière Hills, Montserrat', text: 'Very viscous magma that has lost much of its gas squeezes out and piles up as a steep dome or a short, thick flow. Domes can collapse into pyroclastic flows.' },
  vulcanian: { name: 'Vulcanian explosions', kind: 'Explosive', example: 'Sakurajima', text: 'Viscous magma traps gas until pressure blasts it apart in short, violent explosions that throw out ash and blocks.' },
  plinian: { name: 'Plinian eruption', kind: 'Explosive', example: 'Pinatubo, 1991', text: 'Gas-rich viscous magma shatters into ash in the conduit and is blasted out in a sustained column tens of kilometres high.' },
};

/** Rough positions of well-known eruptions on the viscosity–gas chart (illustrative, not measured values). */
export const EXAMPLES: { name: string; logEta: number; gas: number }[] = [
  { name: 'Kīlauea', logEta: 2.5, gas: 0.6 },
  { name: 'Stromboli', logEta: 3.2, gas: 2.2 },
  { name: 'Soufrière Hills', logEta: 9.5, gas: 1.2 },
  { name: 'St. Helens 1980', logEta: 8.5, gas: 4.6 },
  { name: 'Pinatubo 1991', logEta: 9.6, gas: 5.8 },
];

export type HazardId = 'lava' | 'pdc' | 'lahar' | 'ash';
export const HAZARDS: Record<HazardId, { name: string; color: string; speed: string; text: string }> = {
  lava: { name: 'Lava flow', color: '#f76707', speed: 'Usually walking pace or slower', text: 'Lava follows valleys downhill. People can usually walk away, but it buries and burns everything in its path.' },
  pdc: { name: 'Pyroclastic density current', color: '#868e96', speed: 'Often over 100 km/h', text: 'A ground-hugging avalanche of hot gas, ash and rock, hundreds of degrees hot. It is the deadliest volcanic hazard and cannot be outrun.' },
  lahar: { name: 'Lahar', color: '#8d6e63', speed: 'Tens of km/h', text: 'A volcanic mudflow of water and loose debris that rushes down river valleys, sometimes tens of kilometres from the volcano. Rain or melting snow can trigger it long after an eruption.' },
  ash: { name: 'Ash fall', color: '#adb5bd', speed: 'Carried by the wind', text: 'Fine rock fragments that fall downwind. Thick ash collapses roofs, ruins crops, contaminates water and grounds aircraft.' },
};
