/** Materials, layers and contaminants for the groundwater lab. Values are typical textbook ranges (Freeze & Cherry 1979; Heath, USGS WSP 2220). */

export type MatId = 'gravel' | 'sand' | 'silt' | 'clay' | 'fractured';
export const MATERIALS: Record<MatId, { name: string; color: string; grain: string; d: number; n: number; text: string }> = {
  gravel: { name: 'Gravel', color: '#b0a089', grain: '#8d7b68', d: 4, n: 0.3, text: 'Large grains with large, well-connected pores: water flows through very easily.' },
  sand: { name: 'Sand', color: '#e3c88f', grain: '#c9a66b', d: 0.4, n: 0.35, text: 'Medium grains with connected pores: a good aquifer material.' },
  silt: { name: 'Silt', color: '#c2a98a', grain: '#a08a6c', d: 0.03, n: 0.42, text: 'Fine grains with small pores: water moves slowly.' },
  clay: { name: 'Clay', color: '#a1887f', grain: '#8d6e63', d: 0.002, n: 0.5, text: 'Tiny, flat particles. Lots of pore space, but the pores are so small that water barely moves and much of it is held to the particles.' },
  fractured: { name: 'Fractured rock', color: '#868e96', grain: '#6c757d', d: 0, n: 0.01, text: 'Solid rock such as granite with cracks. Very little open space, but water can move quickly along connected fractures.' },
};

export type LayerId = 'soil' | 'unsat' | 'sat' | 'aquitard' | 'confined' | 'bedrock' | 'river' | 'recharge' | 'pump' | 'artesian' | 'domestic' | 'watertable';
export const LAYERS: Record<LayerId, { name: string; text: string; props?: string }> = {
  soil: { name: 'Soil', text: 'The top layer. Rain soaks in here (infiltration); plant roots take up some of the water.', props: 'Porosity ≈ 40–55%' },
  unsat: { name: 'Unsaturated zone', text: 'Above the water table the pores hold both air and water. Water seeping down through it becomes recharge when it reaches the water table.', props: 'Pores partly filled with water' },
  sat: { name: 'Unconfined aquifer (saturated sand)', text: 'Below the water table every pore is full of water. This aquifer is unconfined: its top is the water table, which rises and falls freely.', props: 'Sand: porosity ≈ 35%, K ≈ 1–100 m/day' },
  aquitard: { name: 'Aquitard (clay)', text: 'A layer of clay that lets water through only very slowly. It separates the two aquifers and protects the lower one from pollution above.', props: 'Clay: porosity ≈ 50%, K ≈ 0.0001 m/day' },
  confined: { name: 'Confined aquifer (gravel and sandstone)', text: 'An aquifer sandwiched between low-permeability layers. Its water is under pressure, so water in a well rises above the top of the aquifer.', props: 'Porosity ≈ 25–30%, K ≈ 10–100 m/day' },
  bedrock: { name: 'Bedrock', text: 'Dense rock with very few connected openings. Here it acts as the impermeable base of the system.', props: 'Porosity < 5%, K very low' },
  river: { name: 'River', text: 'Where the water table meets the river, groundwater seeps into it (a gaining river). If pumping lowers the water table, river water can leak into the ground instead (a losing river).' },
  recharge: { name: 'Recharge area', text: 'Where the confined aquifer reaches the surface on the hill, rain can soak straight into it. Paving or polluting this area affects the whole aquifer.' },
  pump: { name: 'Pumping well', text: 'A well that pumps water from the aquifer. The water level around it drops in a cone of depression.' },
  artesian: { name: 'Artesian well', text: 'A well into the confined aquifer. Pressure pushes the water up to the potentiometric surface; where that is above the ground, the well flows on its own.' },
  domestic: { name: 'Shallow well', text: 'A neighbour’s shallow well in the unconfined aquifer. If the water table falls below its bottom, it runs dry.' },
  watertable: { name: 'Water table', text: 'The top of the saturated zone, where the water pressure equals air pressure. It roughly follows the shape of the land, higher under hills and lower near rivers.' },
};

export type ContamId = 'salt' | 'fuel' | 'metal';
export const CONTAMINANTS: Record<ContamId, { name: string; color: string; R: number; half: number; text: string }> = {
  salt: { name: 'Road salt (chloride)', color: '#7950f2', R: 1, half: 0, text: 'Dissolves completely and does not stick to grains, so it moves at the same speed as the groundwater and does not break down.' },
  fuel: { name: 'Fuel (benzene)', color: '#e8590c', R: 2, half: 2, text: 'Sticks a little to organic matter, so it moves about half as fast as the water, and microbes slowly break it down (half-life of about 2 years here).' },
  metal: { name: 'Lead', color: '#495057', R: 40, half: 0, text: 'Sticks strongly to clay and mineral surfaces, so it moves far more slowly than the water. It never breaks down.' },
};
