/** Fault types, model parts, seismic waves and crustal wave speeds for the earthquake lab. */

export type FaultId = 'normal' | 'reverse' | 'strike';

export const FAULTS: Record<FaultId, { name: string; motion: string; stress: string; example: string; text: string }> = {
  normal: {
    name: 'Normal fault',
    motion: 'Hanging wall moves down',
    stress: 'Tension (crust pulled apart)',
    example: 'East African Rift, Basin and Range (USA)',
    text: 'The crust is being stretched. The block above the sloping fault (the hanging wall) slides down relative to the block below it (the footwall).',
  },
  reverse: {
    name: 'Reverse (thrust) fault',
    motion: 'Hanging wall moves up',
    stress: 'Compression (crust squeezed)',
    example: 'Himalayas, Japan trench, 2011 Tōhoku earthquake',
    text: 'The crust is being squeezed. The hanging wall is pushed up and over the footwall. Low-angle reverse faults are called thrust faults.',
  },
  strike: {
    name: 'Strike-slip fault',
    motion: 'Blocks slide sideways',
    stress: 'Shear (blocks slide past each other)',
    example: 'San Andreas Fault (USA), North Anatolian Fault (Türkiye)',
    text: 'The fault is nearly vertical and the blocks slide horizontally past each other. On a right-lateral fault, the far block moves to the right as you look across it.',
  },
};

export type PartId = 'hanging' | 'footwall' | 'fault' | 'focus' | 'epicenter' | 'station' | 'layers' | 'fence';
export const PARTS: Record<PartId, { name: string; text: string }> = {
  hanging: { name: 'Hanging wall', text: 'The block of rock above a sloping fault plane. (On a vertical strike-slip fault the two blocks are simply the two sides.)' },
  footwall: { name: 'Footwall', text: 'The block of rock below a sloping fault plane: miners standing in a tunnel along a fault had it under their feet.' },
  fault: { name: 'Fault plane', text: 'A fracture in the crust along which the rocks on either side have moved. Friction locks it between earthquakes while strain builds up.' },
  focus: { name: 'Focus (hypocenter)', text: 'The point underground where the rupture starts and seismic waves are first released. Most earthquakes start in the upper 70 km.' },
  epicenter: { name: 'Epicenter', text: 'The point on the surface directly above the focus. On a sloping fault it is not where the fault reaches the surface.' },
  station: { name: 'Seismic station', text: 'A seismometer records ground motion. The P-wave arrives first, then the S-wave; the gap between them tells you how far away the focus is.' },
  layers: { name: 'Rock layers', text: 'Sedimentary layers were laid down flat. Where they are offset across the fault, they record how far the rocks have moved.' },
  fence: { name: 'Fence across the fault', text: 'Between earthquakes the rocks bend elastically and the fence curves. In the earthquake the fault slips and the rocks spring back: elastic rebound. The fence is left broken and offset.' },
};

/** Typical crustal speeds (km/s), as used in introductory seismology. */
export const VP = 6.0;
export const VS = 3.5;
export const VR = 3.1;
/** d = Δt · Vp·Vs/(Vp − Vs): distance per second of S–P delay. */
export const KM_PER_S = (VP * VS) / (VP - VS);

export type WaveId = 'p' | 's' | 'surface';
export const WAVES: Record<WaveId, { name: string; motion: string; speed: string; liquid: string; text: string }> = {
  p: {
    name: 'P-wave (primary)',
    motion: 'Push–pull, along the direction of travel',
    speed: `About ${VP} km/s in the crust`,
    liquid: 'Yes: solids, liquids and gases',
    text: 'A compressional wave: rock is squeezed and stretched in the direction the wave travels, like a pulse along a slinky. It is the fastest seismic wave, so it arrives first.',
  },
  s: {
    name: 'S-wave (secondary)',
    motion: 'Side to side, across the direction of travel',
    speed: `About ${VS} km/s in the crust`,
    liquid: 'No: only through solids',
    text: 'A shear (transverse) wave: rock moves sideways, perpendicular to the direction of travel. Liquids cannot resist shearing, so S-waves cannot pass through them.',
  },
  surface: {
    name: 'Surface wave (Rayleigh)',
    motion: 'Rolling, along the surface',
    speed: `About ${VR} km/s, slowest`,
    liquid: 'Travels along the surface only',
    text: 'Surface waves are trapped near the ground surface. In a Rayleigh wave the ground rolls in ellipses, like ocean waves; Love waves shake it side to side. They arrive last but often cause the most damage.',
  },
};
