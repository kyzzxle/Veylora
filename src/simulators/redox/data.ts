/**
 * Redox reactions shown in the simulator. Particle coordinates are in an
 * 800 × 300 "stage" box. Each particle has a reactant and a product form.
 * Oxidation states follow the standard rules (elements 0, monatomic ions =
 * their charge, O usually −2, H usually +1).
 */
export type ReactionId = 'zncu' | 'cuag' | 'nacl' | 'mgo' | 'clbr' | 'h2o';

export interface Form {
  sym: string;
  /** Ion charge as written, e.g. '2+' or '−'. Empty for neutral particles. */
  charge: string;
  ox: number;
  x: number;
  y: number;
  r: number;
  /** δ+ or δ− for polar covalent bonds */
  delta?: string;
}
export interface Particle {
  a: Form;
  b: Form;
  el: string;
  spectator?: boolean;
  /** Species name for tooltips */
  name: [string, string];
}
export interface Reaction {
  id: ReactionId;
  title: string;
  equation: string;
  ionic?: string;
  kind: 'transfer' | 'covalent';
  electrons: number;
  particles: Particle[];
  bondsA: [number, number][];
  bondsB: [number, number][];
  /** Electron transfers: from particle → to particle, number of electrons */
  transfers: [number, number, number][];
  halfOx: string;
  halfRed: string;
  roles: { oxidized: string; reduced: string; oxAgent: string; redAgent: string };
  options: string[];
  spectator?: string;
  lab: string;
  how: string;
}

const EL: Record<string, string> = {
  Zn: '#8fa3b8',
  Cu: '#c8743a',
  Ag: '#c0c6cf',
  Na: '#8e6fd8',
  Cl: '#3fae5a',
  Mg: '#b6bcc6',
  O: '#e03131',
  Br: '#a5402d',
  H: '#e9ecef',
  K: '#b197fc',
  S: '#e0b030',
  N: '#4c6ef5',
};
export const elColour = (el: string) => EL[el] ?? '#999';

const f = (sym: string, charge: string, ox: number, x: number, y: number, r: number, delta?: string): Form => ({ sym, charge, ox, x, y, r, delta });

export const REACTIONS: Record<ReactionId, Reaction> = {
  zncu: {
    id: 'zncu',
    title: 'Zinc in copper(II) sulfate',
    equation: 'Zn(s) + CuSO₄(aq) → ZnSO₄(aq) + Cu(s)',
    ionic: 'Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s)',
    kind: 'transfer',
    electrons: 2,
    particles: [
      { el: 'Zn', a: f('Zn', '', 0, 200, 150, 36), b: f('Zn', '2+', 2, 200, 150, 27), name: ['zinc atom (in the metal)', 'zinc ion, Zn²⁺'] },
      { el: 'Cu', a: f('Cu', '2+', 2, 560, 150, 27), b: f('Cu', '', 0, 560, 150, 34), name: ['copper(II) ion, Cu²⁺', 'copper atom (deposited metal)'] },
      { el: 'S', spectator: true, a: f('SO₄', '2−', -2, 680, 255, 30), b: f('SO₄', '2−', -2, 680, 255, 30), name: ['sulfate ion (spectator)', 'sulfate ion (spectator)'] },
    ],
    bondsA: [],
    bondsB: [],
    transfers: [[0, 1, 2]],
    halfOx: 'Zn → Zn²⁺ + 2e⁻',
    halfRed: 'Cu²⁺ + 2e⁻ → Cu',
    roles: { oxidized: 'Zn', reduced: 'Cu²⁺', oxAgent: 'Cu²⁺', redAgent: 'Zn' },
    options: ['Zn', 'Cu²⁺', 'SO₄²⁻'],
    spectator: 'SO₄²⁻',
    lab: 'A grey zinc strip in blue copper(II) sulfate solution gains a brown coating of copper, the blue colour fades and the solution warms up.',
    how: 'Electrons pass directly from zinc atoms on the surface of the metal to copper ions that touch it. Zinc is more reactive than copper, so it gives up its electrons more readily.',
  },
  cuag: {
    id: 'cuag',
    title: 'Copper in silver nitrate',
    equation: 'Cu(s) + 2AgNO₃(aq) → Cu(NO₃)₂(aq) + 2Ag(s)',
    ionic: 'Cu(s) + 2Ag⁺(aq) → Cu²⁺(aq) + 2Ag(s)',
    kind: 'transfer',
    electrons: 2,
    particles: [
      { el: 'Cu', a: f('Cu', '', 0, 200, 150, 34), b: f('Cu', '2+', 2, 200, 150, 27), name: ['copper atom (in the wire)', 'copper(II) ion, Cu²⁺'] },
      { el: 'Ag', a: f('Ag', '+', 1, 540, 85, 27), b: f('Ag', '', 0, 540, 85, 33), name: ['silver ion, Ag⁺', 'silver atom (deposited metal)'] },
      { el: 'Ag', a: f('Ag', '+', 1, 540, 215, 27), b: f('Ag', '', 0, 540, 215, 33), name: ['silver ion, Ag⁺', 'silver atom (deposited metal)'] },
      { el: 'N', spectator: true, a: f('NO₃', '−', -1, 690, 60, 28), b: f('NO₃', '−', -1, 690, 60, 28), name: ['nitrate ion (spectator)', 'nitrate ion (spectator)'] },
      { el: 'N', spectator: true, a: f('NO₃', '−', -1, 690, 240, 28), b: f('NO₃', '−', -1, 690, 240, 28), name: ['nitrate ion (spectator)', 'nitrate ion (spectator)'] },
    ],
    bondsA: [],
    bondsB: [],
    transfers: [
      [0, 1, 1],
      [0, 2, 1],
    ],
    halfOx: 'Cu → Cu²⁺ + 2e⁻',
    halfRed: '2Ag⁺ + 2e⁻ → 2Ag   (Ag⁺ + e⁻ → Ag, twice)',
    roles: { oxidized: 'Cu', reduced: 'Ag⁺', oxAgent: 'Ag⁺', redAgent: 'Cu' },
    options: ['Cu', 'Ag⁺', 'NO₃⁻'],
    spectator: 'NO₃⁻',
    lab: 'Shiny, branching crystals of silver grow on a copper wire, and the colourless solution slowly turns blue as copper(II) ions form.',
    how: 'Each copper atom gives two electrons, so it takes two silver ions, each accepting one electron, to balance them.',
  },
  nacl: {
    id: 'nacl',
    title: 'Sodium burning in chlorine',
    equation: '2Na(s) + Cl₂(g) → 2NaCl(s)',
    kind: 'transfer',
    electrons: 2,
    particles: [
      { el: 'Na', a: f('Na', '', 0, 170, 85, 38), b: f('Na', '+', 1, 370, 85, 26), name: ['sodium atom', 'sodium ion, Na⁺'] },
      { el: 'Na', a: f('Na', '', 0, 170, 215, 38), b: f('Na', '+', 1, 370, 215, 26), name: ['sodium atom', 'sodium ion, Na⁺'] },
      { el: 'Cl', a: f('Cl', '', 0, 540, 100, 28), b: f('Cl', '−', -1, 480, 85, 34), name: ['chlorine atom (in a Cl₂ molecule)', 'chloride ion, Cl⁻'] },
      { el: 'Cl', a: f('Cl', '', 0, 540, 200, 28), b: f('Cl', '−', -1, 480, 215, 34), name: ['chlorine atom (in a Cl₂ molecule)', 'chloride ion, Cl⁻'] },
    ],
    bondsA: [[2, 3]],
    bondsB: [],
    transfers: [
      [0, 2, 1],
      [1, 3, 1],
    ],
    halfOx: '2Na → 2Na⁺ + 2e⁻',
    halfRed: 'Cl₂ + 2e⁻ → 2Cl⁻',
    roles: { oxidized: 'Na', reduced: 'Cl₂', oxAgent: 'Cl₂', redAgent: 'Na' },
    options: ['Na', 'Cl₂'],
    lab: 'Hot sodium burns in chlorine gas with a bright yellow flame, leaving white sodium chloride: table salt.',
    how: 'Each sodium atom loses its single outer electron; each chlorine atom gains one. The oppositely charged ions then attract each other in an ionic lattice.',
  },
  mgo: {
    id: 'mgo',
    title: 'Magnesium burning in oxygen',
    equation: '2Mg(s) + O₂(g) → 2MgO(s)',
    kind: 'transfer',
    electrons: 4,
    particles: [
      { el: 'Mg', a: f('Mg', '', 0, 170, 85, 36), b: f('Mg', '2+', 2, 370, 85, 24), name: ['magnesium atom', 'magnesium ion, Mg²⁺'] },
      { el: 'Mg', a: f('Mg', '', 0, 170, 215, 36), b: f('Mg', '2+', 2, 370, 215, 24), name: ['magnesium atom', 'magnesium ion, Mg²⁺'] },
      { el: 'O', a: f('O', '', 0, 540, 102, 26), b: f('O', '2−', -2, 480, 85, 33), name: ['oxygen atom (in an O₂ molecule)', 'oxide ion, O²⁻'] },
      { el: 'O', a: f('O', '', 0, 540, 198, 26), b: f('O', '2−', -2, 480, 215, 33), name: ['oxygen atom (in an O₂ molecule)', 'oxide ion, O²⁻'] },
    ],
    bondsA: [[2, 3]],
    bondsB: [],
    transfers: [
      [0, 2, 2],
      [1, 3, 2],
    ],
    halfOx: '2Mg → 2Mg²⁺ + 4e⁻',
    halfRed: 'O₂ + 4e⁻ → 2O²⁻',
    roles: { oxidized: 'Mg', reduced: 'O₂', oxAgent: 'O₂', redAgent: 'Mg' },
    options: ['Mg', 'O₂'],
    lab: 'Magnesium ribbon burns with a dazzling white light, leaving a white powder of magnesium oxide.',
    how: 'This is where the word “oxidation” comes from: combining with oxygen. Each magnesium atom loses two electrons and each oxygen atom gains two.',
  },
  clbr: {
    id: 'clbr',
    title: 'Chlorine and potassium bromide',
    equation: 'Cl₂(aq) + 2KBr(aq) → 2KCl(aq) + Br₂(aq)',
    ionic: 'Cl₂(aq) + 2Br⁻(aq) → 2Cl⁻(aq) + Br₂(aq)',
    kind: 'transfer',
    electrons: 2,
    particles: [
      { el: 'Br', a: f('Br', '−', -1, 190, 85, 36), b: f('Br', '', 0, 190, 98, 30), name: ['bromide ion, Br⁻', 'bromine atom (in a Br₂ molecule)'] },
      { el: 'Br', a: f('Br', '−', -1, 190, 215, 36), b: f('Br', '', 0, 190, 202, 30), name: ['bromide ion, Br⁻', 'bromine atom (in a Br₂ molecule)'] },
      { el: 'Cl', a: f('Cl', '', 0, 540, 100, 28), b: f('Cl', '−', -1, 540, 85, 34), name: ['chlorine atom (in a Cl₂ molecule)', 'chloride ion, Cl⁻'] },
      { el: 'Cl', a: f('Cl', '', 0, 540, 200, 28), b: f('Cl', '−', -1, 540, 215, 34), name: ['chlorine atom (in a Cl₂ molecule)', 'chloride ion, Cl⁻'] },
      { el: 'K', spectator: true, a: f('K', '+', 1, 690, 60, 26), b: f('K', '+', 1, 690, 60, 26), name: ['potassium ion (spectator)', 'potassium ion (spectator)'] },
      { el: 'K', spectator: true, a: f('K', '+', 1, 690, 240, 26), b: f('K', '+', 1, 690, 240, 26), name: ['potassium ion (spectator)', 'potassium ion (spectator)'] },
    ],
    bondsA: [[2, 3]],
    bondsB: [[0, 1]],
    transfers: [
      [0, 2, 1],
      [1, 3, 1],
    ],
    halfOx: '2Br⁻ → Br₂ + 2e⁻',
    halfRed: 'Cl₂ + 2e⁻ → 2Cl⁻',
    roles: { oxidized: 'Br⁻', reduced: 'Cl₂', oxAgent: 'Cl₂', redAgent: 'Br⁻' },
    options: ['Cl₂', 'Br⁻', 'K⁺'],
    spectator: 'K⁺',
    lab: 'Pale chlorine water added to colourless potassium bromide solution turns it yellow-orange as bromine forms.',
    how: 'Chlorine is the more reactive halogen: it takes electrons from bromide ions. This is a halogen displacement reaction.',
  },
  h2o: {
    id: 'h2o',
    title: 'Hydrogen burning in oxygen',
    equation: '2H₂(g) + O₂(g) → 2H₂O(l)',
    kind: 'covalent',
    electrons: 4,
    particles: [
      { el: 'H', a: f('H', '', 0, 130, 80, 20), b: f('H', '', 1, 300, 110, 20, 'δ+'), name: ['hydrogen atom (in H₂)', 'hydrogen atom (in H₂O)'] },
      { el: 'H', a: f('H', '', 0, 210, 80, 20), b: f('H', '', 1, 500, 110, 20, 'δ+'), name: ['hydrogen atom (in H₂)', 'hydrogen atom (in H₂O)'] },
      { el: 'H', a: f('H', '', 0, 130, 220, 20), b: f('H', '', 1, 300, 200, 20, 'δ+'), name: ['hydrogen atom (in H₂)', 'hydrogen atom (in H₂O)'] },
      { el: 'H', a: f('H', '', 0, 210, 220, 20), b: f('H', '', 1, 500, 200, 20, 'δ+'), name: ['hydrogen atom (in H₂)', 'hydrogen atom (in H₂O)'] },
      { el: 'O', a: f('O', '', 0, 600, 100, 28), b: f('O', '', -2, 400, 50, 28, 'δ−'), name: ['oxygen atom (in O₂)', 'oxygen atom (in H₂O)'] },
      { el: 'O', a: f('O', '', 0, 600, 200, 28), b: f('O', '', -2, 400, 260, 28, 'δ−'), name: ['oxygen atom (in O₂)', 'oxygen atom (in H₂O)'] },
    ],
    bondsA: [
      [0, 1],
      [2, 3],
      [4, 5],
    ],
    bondsB: [
      [4, 0],
      [4, 1],
      [5, 2],
      [5, 3],
    ],
    transfers: [],
    halfOx: '2H₂ → 4H⁺ + 4e⁻   (formal)',
    halfRed: 'O₂ + 4H⁺ + 4e⁻ → 2H₂O   (formal)',
    roles: { oxidized: 'H₂', reduced: 'O₂', oxAgent: 'O₂', redAgent: 'H₂' },
    options: ['H₂', 'O₂'],
    lab: 'Hydrogen burns with an almost invisible flame (or pops in a test tube), producing water vapour.',
    how: 'No electrons are handed over completely: water is covalent, so its electrons are shared. Oxygen pulls the shared pairs towards itself (it is more electronegative), so it counts as having gained electrons. Oxidation states treat each bond as if it were ionic, which is bookkeeping, not a literal transfer. In a hydrogen fuel cell the two half-reactions really do happen separately, and the electrons flow through a wire.',
  },
};

export const fmtOx = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
