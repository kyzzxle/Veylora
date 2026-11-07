/** Landforms, weathering processes, rock types and challenges for the landscape lab. */

export type LandformId = 'peak' | 'glacial' | 'hills' | 'river' | 'fan' | 'dunes' | 'cliff' | 'delta' | 'beach' | 'sea';
export const LANDFORMS: Record<LandformId, { name: string; process: string; text: string }> = {
  peak: { name: 'Mountain peaks', process: 'Uplift, frost weathering, rockfall', text: 'High, steep peaks of hard granite. Frost shatters the rock, and gravity brings the fragments down as scree.' },
  glacial: { name: 'Glacial U-shaped valley', process: 'Glacial erosion (plucking and abrasion)', text: 'A glacier filled this valley and scraped it into a wide U shape with steep sides and a flat floor.' },
  hills: { name: 'Rolling hills', process: 'Soil creep and slope wash', text: 'Softer sandstone hills, rounded by slow downslope movement of soil and by rain wash.' },
  river: { name: 'River valley and meanders', process: 'River erosion and deposition', text: 'Running water carves a V-shaped valley upstream; on the gentle lowland the river winds in meanders.' },
  fan: { name: 'Alluvial fan', process: 'Deposition where a steep stream meets flat ground', text: 'A mountain stream suddenly slows as it leaves its steep valley and spreads its load of gravel and sand in a fan.' },
  dunes: { name: 'Sand dunes', process: 'Wind transport and deposition', text: 'Wind bounces sand grains along the ground (saltation) and piles them into dunes that slowly migrate downwind.' },
  cliff: { name: 'Sea cliff', process: 'Wave erosion and rockfall', text: 'Waves undercut the base of the cliff until the rock above collapses, so the cliff retreats inland.' },
  delta: { name: 'River delta', process: 'Deposition where a river enters the sea', text: 'The river slows as it enters the sea and drops its sediment, building new land that spreads out in channels.' },
  beach: { name: 'Beach', process: 'Wave deposition', text: 'Sand and shingle deposited by waves, and moved along the coast by longshore drift.' },
  sea: { name: 'Sea', process: 'The final destination of most sediment', text: 'Fine sediment carried by rivers eventually settles on the sea floor, where it may become new sedimentary rock.' },
};

export type RockId = 'granite' | 'sandstone' | 'limestone' | 'basalt';
export const ROCKS: Record<RockId, { name: string; color: string; ft: number; thermal: number; diss: number; iron: number; feld: number; text: string }> = {
  granite: { name: 'Granite', color: '#c9b8a8', ft: 1, thermal: 1.1, diss: 0.05, iron: 0.35, feld: 1, text: 'Hard and crystalline, with joints that frost and roots can open.' },
  sandstone: { name: 'Sandstone', color: '#d9b77e', ft: 1.3, thermal: 0.9, diss: 0.15, iron: 0.6, feld: 0.3, text: 'Grains held by cement; porous, so water gets in easily.' },
  limestone: { name: 'Limestone', color: '#d8d6c8', ft: 1, thermal: 0.8, diss: 1, iron: 0.1, feld: 0.05, text: 'Calcium carbonate, which dissolves in slightly acidic rainwater.' },
  basalt: { name: 'Basalt', color: '#5c5f66', ft: 0.8, thermal: 1.2, diss: 0.05, iron: 1, feld: 0.8, text: 'Dark volcanic rock rich in iron minerals, which rust when exposed.' },
};

export const WEATHERING = {
  ft: { name: 'Freeze–thaw', kind: 'Physical', color: '#4dabf7', text: 'Water in cracks freezes and expands by about 9%, prising the rock apart a little more each cycle.' },
  thermal: { name: 'Thermal expansion', kind: 'Physical', color: '#f08c00', text: 'Daily heating and cooling makes the outer layers expand and contract until they crack and peel off.' },
  ox: { name: 'Oxidation', kind: 'Chemical', color: '#c92a2a', text: 'Iron in minerals reacts with oxygen and water, forming rusty iron oxides that weaken the rock.' },
  hydro: { name: 'Hydrolysis', kind: 'Chemical', color: '#cc5de8', text: 'Water reacts with feldspar minerals and turns them into soft clay, so granite slowly rots, fastest in warm, wet climates.' },
  diss: { name: 'Dissolution', kind: 'Chemical', color: '#7950f2', text: 'Rainwater containing dissolved carbon dioxide is a weak acid that slowly dissolves limestone.' },
  roots: { name: 'Root wedging', kind: 'Biological', color: '#2f9e44', text: 'Plant roots grow into cracks and widen them as they thicken; roots and lichens also release acids.' },
} as const;
export type ProcId = keyof typeof WEATHERING;

export type AgentId = 'water' | 'wind' | 'glacier' | 'gravity';
export type FormId = 'delta' | 'fan' | 'meander' | 'coast' | 'dunes' | 'valley';
export const FORMS: Record<FormId, { name: string; text: string; time: string }> = {
  delta: { name: 'River delta', text: 'A river slows where it enters the sea and drops its load. With strong waves the sediment is spread along the coast; with weak waves, finger-like channels push out to sea.', time: 'Hundreds to thousands of years' },
  fan: { name: 'Alluvial fan', text: 'A mountain stream loses energy as it spreads onto flat ground and drops its gravel and sand in a cone-shaped fan.', time: 'Thousands of years' },
  meander: { name: 'Meanders and oxbow lakes', text: 'Water flows fastest round the outside of a bend, eroding that bank, and slowest on the inside, where a point bar is deposited. Bends grow until the river cuts through the neck, leaving an oxbow lake.', time: 'Decades to centuries' },
  coast: { name: 'Beach and spit', text: 'Waves arriving at an angle move sand along the beach (longshore drift). Where the coast turns, the sand keeps going and builds a spit, while waves erode the headland.', time: 'Decades to centuries' },
  dunes: { name: 'Sand dunes', text: 'Wind moves sand up the gentle windward side; it avalanches down the steep lee side, so the whole dune creeps downwind. With little sand, crescent-shaped barchans form; with lots, long transverse ridges.', time: 'Years to centuries' },
  valley: { name: 'V-shaped and U-shaped valleys', text: 'A river cuts down into its bed and the slopes wear back into a V. A glacier erodes the floor and sides, carving a broad U. Fast uplift with hard rock makes deep canyons.', time: 'Tens of thousands to millions of years' },
};
