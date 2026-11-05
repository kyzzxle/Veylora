/**
 * Molecules and lattices for the chemical bonding viewer.
 * Positions in ångströms (1 Å = 10⁻¹⁰ m) from standard bond lengths and
 * VSEPR geometries. Electronegativities are Pauling values.
 */
export type El = 'H' | 'C' | 'N' | 'O' | 'Cl' | 'Na' | 'Mg';

export const ELEMENTS: Record<El, { name: string; colour: string; en: number; cov: number; vdw: number }> = {
  H: { name: 'Hydrogen', colour: '#f2f2f2', en: 2.2, cov: 0.31, vdw: 1.2 },
  C: { name: 'Carbon', colour: '#3a3a3a', en: 2.55, cov: 0.76, vdw: 1.7 },
  N: { name: 'Nitrogen', colour: '#3a62d6', en: 3.04, cov: 0.71, vdw: 1.55 },
  O: { name: 'Oxygen', colour: '#e0412f', en: 3.44, cov: 0.66, vdw: 1.52 },
  Cl: { name: 'Chlorine', colour: '#3fbf3f', en: 3.16, cov: 1.02, vdw: 1.75 },
  Na: { name: 'Sodium', colour: '#9b59d0', en: 0.93, cov: 1.66, vdw: 2.27 },
  Mg: { name: 'Magnesium', colour: '#2aa58c', en: 1.31, cov: 1.41, vdw: 1.73 },
};

export interface Atom {
  el: El;
  p: [number, number, number];
  charge?: number; // ions
  lone?: number; // lone pairs drawn on this atom
}
export interface Substance {
  name: string;
  formula: string;
  kind: 'covalent' | 'ionic' | 'giant';
  atoms: Atom[];
  bonds: [number, number, number][]; // [a, b, order]
  shape: string;
  angle: string;
  polar: string;
  mp: string;
  about: string;
}

const tetra = (d: number): [number, number, number][] => {
  const k = d / Math.sqrt(3);
  return [[k, k, k], [-k, -k, k], [-k, k, -k], [k, -k, -k]];
};

function lattice(a: El, b: El, ca: number, cb: number): { atoms: Atom[]; bonds: [number, number, number][] } {
  const atoms: Atom[] = [];
  const s = a === 'Na' ? 2.82 : 2.1;
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const even = (x + y + z + 3) % 2 === 0;
        atoms.push({ el: even ? b : a, p: [x * s, y * s, z * s], charge: even ? cb : ca });
      }
  const bonds: [number, number, number][] = [];
  atoms.forEach((u, i) =>
    atoms.forEach((v, j) => {
      if (j <= i) return;
      const d = Math.hypot(u.p[0] - v.p[0], u.p[1] - v.p[1], u.p[2] - v.p[2]);
      if (d < s * 1.05) bonds.push([i, j, 0]); // 0 = ionic attraction (drawn thin)
    }),
  );
  return { atoms, bonds };
}

function diamond(): { atoms: Atom[]; bonds: [number, number, number][] } {
  const a = 3.567;
  const pts: [number, number, number][] = [];
  const basis = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
  for (const [bx, by, bz] of basis)
    for (const off of [0, 0.25])
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (let k = -1; k <= 1; k++) {
            const p: [number, number, number] = [(bx + off + i) * a, (by + off + j) * a, (bz + off + k) * a];
            if (p.every((c) => c >= -0.1 && c <= a + 0.1)) pts.push(p);
          }
  const uniq = pts.filter((p, i) => pts.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 0.01) === i);
  const centred = uniq.map((p) => [p[0] - a / 2, p[1] - a / 2, p[2] - a / 2] as [number, number, number]);
  const bonds: [number, number, number][] = [];
  centred.forEach((u, i) =>
    centred.forEach((v, j) => {
      if (j > i && Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) < 1.6) bonds.push([i, j, 1]);
    }),
  );
  return { atoms: centred.map((p) => ({ el: 'C' as El, p })), bonds };
}

const nacl = lattice('Na', 'Cl', 1, -1);
const mgo = lattice('Mg', 'O', 2, -2);
const dia = diamond();
const ch4 = tetra(1.09);

export const SUBSTANCES: Record<string, Substance> = {
  h2: {
    name: 'Hydrogen', formula: 'H₂', kind: 'covalent',
    atoms: [{ el: 'H', p: [-0.37, 0, 0] }, { el: 'H', p: [0.37, 0, 0] }],
    bonds: [[0, 1, 1]], shape: 'Linear', angle: '—', polar: 'Non-polar (identical atoms share equally)', mp: 'Boils at −253 °C',
    about: 'The simplest molecule: two hydrogen atoms share one pair of electrons, so each feels as if it has a full outer shell of two.',
  },
  cl2: {
    name: 'Chlorine', formula: 'Cl₂', kind: 'covalent',
    atoms: [{ el: 'Cl', p: [-0.99, 0, 0], lone: 3 }, { el: 'Cl', p: [0.99, 0, 0], lone: 3 }],
    bonds: [[0, 1, 1]], shape: 'Linear', angle: '—', polar: 'Non-polar', mp: 'Boils at −34 °C',
    about: 'Each chlorine has 7 outer electrons; sharing one pair gives both a full octet of 8.',
  },
  o2: {
    name: 'Oxygen', formula: 'O₂', kind: 'covalent',
    atoms: [{ el: 'O', p: [-0.6, 0, 0], lone: 2 }, { el: 'O', p: [0.6, 0, 0], lone: 2 }],
    bonds: [[0, 1, 2]], shape: 'Linear', angle: '—', polar: 'Non-polar', mp: 'Boils at −183 °C',
    about: 'Two oxygen atoms share two pairs of electrons: a double bond.',
  },
  n2: {
    name: 'Nitrogen', formula: 'N₂', kind: 'covalent',
    atoms: [{ el: 'N', p: [-0.55, 0, 0], lone: 1 }, { el: 'N', p: [0.55, 0, 0], lone: 1 }],
    bonds: [[0, 1, 3]], shape: 'Linear', angle: '—', polar: 'Non-polar', mp: 'Boils at −196 °C',
    about: 'A triple bond (three shared pairs) makes N₂ very hard to break apart, which is why the nitrogen in air is so unreactive.',
  },
  hcl: {
    name: 'Hydrogen chloride', formula: 'HCl', kind: 'covalent',
    atoms: [{ el: 'H', p: [-0.64, 0, 0] }, { el: 'Cl', p: [0.64, 0, 0], lone: 3 }],
    bonds: [[0, 1, 1]], shape: 'Linear', angle: '—', polar: 'Polar: chlorine pulls the shared electrons towards itself', mp: 'Boils at −85 °C',
    about: 'An unequal sharing: chlorine is more electronegative, so it carries a small negative charge (δ−) and hydrogen a small positive charge (δ+).',
  },
  h2o: {
    name: 'Water', formula: 'H₂O', kind: 'covalent',
    atoms: [{ el: 'O', p: [0, 0.12, 0], lone: 2 }, { el: 'H', p: [0.757, -0.47, 0] }, { el: 'H', p: [-0.757, -0.47, 0] }],
    bonds: [[0, 1, 1], [0, 2, 1]], shape: 'Bent', angle: '104.5°', polar: 'Polar molecule', mp: 'Melts at 0 °C, boils at 100 °C',
    about: 'Two lone pairs on oxygen push the O–H bonds closer together than in a tetrahedron. The bent, polar shape lets water molecules form hydrogen bonds, giving water its unusually high boiling point.',
  },
  nh3: {
    name: 'Ammonia', formula: 'NH₃', kind: 'covalent',
    atoms: [{ el: 'N', p: [0, 0.38, 0], lone: 1 }, { el: 'H', p: [0.94, 0, 0] }, { el: 'H', p: [-0.47, 0, 0.81] }, { el: 'H', p: [-0.47, 0, -0.81] }],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], shape: 'Trigonal pyramidal', angle: '107°', polar: 'Polar molecule', mp: 'Boils at −33 °C',
    about: 'Three bonds and one lone pair arrange themselves roughly tetrahedrally; the lone pair makes a pyramid shape.',
  },
  ch4: {
    name: 'Methane', formula: 'CH₄', kind: 'covalent',
    atoms: [{ el: 'C', p: [0, 0, 0] }, ...ch4.map((p) => ({ el: 'H' as El, p }))],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], shape: 'Tetrahedral', angle: '109.5°', polar: 'Non-polar (symmetrical)', mp: 'Boils at −162 °C',
    about: 'Four bonding pairs repel each other equally and point to the corners of a tetrahedron. Methane is natural gas.',
  },
  co2: {
    name: 'Carbon dioxide', formula: 'CO₂', kind: 'covalent',
    atoms: [{ el: 'C', p: [0, 0, 0] }, { el: 'O', p: [-1.16, 0, 0], lone: 2 }, { el: 'O', p: [1.16, 0, 0], lone: 2 }],
    bonds: [[0, 1, 2], [0, 2, 2]], shape: 'Linear', angle: '180°', polar: 'Non-polar overall: the two polar C=O bonds point in opposite directions and cancel', mp: 'Turns straight to gas (sublimes) at −78 °C',
    about: 'Two double bonds. Each bond is polar, but the straight shape means the molecule as a whole has no positive or negative end.',
  },
  c2h4: {
    name: 'Ethene', formula: 'C₂H₄', kind: 'covalent',
    atoms: [
      { el: 'C', p: [-0.665, 0, 0] }, { el: 'C', p: [0.665, 0, 0] },
      { el: 'H', p: [-1.23, 0.93, 0] }, { el: 'H', p: [-1.23, -0.93, 0] }, { el: 'H', p: [1.23, 0.93, 0] }, { el: 'H', p: [1.23, -0.93, 0] },
    ],
    bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]], shape: 'Trigonal planar around each carbon (flat molecule)', angle: 'about 120°', polar: 'Non-polar', mp: 'Boils at −104 °C',
    about: 'The C=C double bond keeps the molecule flat and is the reactive spot used to make polythene.',
  },
  nacl: {
    name: 'Sodium chloride', formula: 'NaCl', kind: 'ionic', atoms: nacl.atoms, bonds: nacl.bonds,
    shape: 'Giant ionic lattice: each ion is surrounded by 6 of the opposite charge', angle: '90° between neighbours', polar: 'Made of ions, not molecules', mp: 'Melts at 801 °C',
    about: 'Sodium gives its one outer electron to chlorine, forming Na⁺ and Cl⁻ ions. Strong electrostatic attraction in every direction holds a huge lattice together.',
  },
  mgo: {
    name: 'Magnesium oxide', formula: 'MgO', kind: 'ionic', atoms: mgo.atoms, bonds: mgo.bonds,
    shape: 'Giant ionic lattice (same arrangement as salt)', angle: '90° between neighbours', polar: 'Made of ions, not molecules', mp: 'Melts at 2,852 °C',
    about: 'Magnesium gives two electrons to oxygen: Mg²⁺ and O²⁻. Doubly charged ions attract much more strongly, so MgO melts at a far higher temperature than salt.',
  },
  diamond: {
    name: 'Diamond', formula: 'C (giant covalent)', kind: 'giant', atoms: dia.atoms, bonds: dia.bonds,
    shape: 'Giant covalent network: every carbon bonds to 4 others in a tetrahedron', angle: '109.5°', polar: 'Non-polar', mp: 'Does not melt at normal pressure; turns to vapour above about 3,600 °C',
    about: 'Millions of carbon atoms joined by strong covalent bonds in 3D, making diamond the hardest natural material.',
  },
};

/** Pauling-style bond classification from an electronegativity difference. */
export function bondType(d: number) {
  if (d < 0.4) return 'Non-polar covalent';
  if (d < 1.8) return 'Polar covalent';
  return 'Ionic';
}
