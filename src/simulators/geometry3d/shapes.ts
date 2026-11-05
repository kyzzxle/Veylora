/**
 * Formulas for the 3D Geometry Explorer. All shapes stand on their base with
 * height measured upwards; dimensions are in cm.
 */
export type ShapeId = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'sphere' | 'pyramid' | 'prism' | 'tetrahedron';
export type Dim = 'a' | 'b' | 'h' | 'r';

export interface Dims {
  a: number;
  b: number;
  h: number;
  r: number;
}

export interface ShapeInfo {
  name: string;
  dims: Dim[];
  volume: (d: Dims) => number;
  area: (d: Dims) => number;
  vFormula: string;
  aFormula: string;
  /** Faces, edges, vertices (null for curved shapes that are not polyhedra). */
  fev: [number, number, number] | null;
  curved?: string;
  height: (d: Dims) => number;
  /** Cross-section at height y above the base: description and area. */
  section: (d: Dims, y: number) => { shape: string; area: number };
  about: string;
}

const SQ3 = Math.sqrt(3);
const tri = (a: number) => (SQ3 / 4) * a * a;

export const SHAPES: Record<ShapeId, ShapeInfo> = {
  cube: {
    name: 'Cube',
    dims: ['a'],
    volume: ({ a }) => a ** 3,
    area: ({ a }) => 6 * a * a,
    vFormula: 'V = a³',
    aFormula: 'A = 6a²',
    fev: [6, 12, 8],
    height: ({ a }) => a,
    section: ({ a }) => ({ shape: 'Square', area: a * a }),
    about: 'Six identical square faces. Every edge is the same length.',
  },
  cuboid: {
    name: 'Cuboid',
    dims: ['a', 'b', 'h'],
    volume: ({ a, b, h }) => a * b * h,
    area: ({ a, b, h }) => 2 * (a * b + a * h + b * h),
    vFormula: 'V = l × w × h',
    aFormula: 'A = 2(lw + lh + wh)',
    fev: [6, 12, 8],
    height: ({ h }) => h,
    section: ({ a, b }) => ({ shape: 'Rectangle', area: a * b }),
    about: 'A box with six rectangular faces, in three pairs of identical opposite faces.',
  },
  cylinder: {
    name: 'Cylinder',
    dims: ['r', 'h'],
    volume: ({ r, h }) => Math.PI * r * r * h,
    area: ({ r, h }) => 2 * Math.PI * r * r + 2 * Math.PI * r * h,
    vFormula: 'V = πr²h',
    aFormula: 'A = 2πr² + 2πrh',
    fev: null,
    curved: '2 flat circular faces, 1 curved surface, 2 curved edges, no vertices',
    height: ({ h }) => h,
    section: ({ r }) => ({ shape: 'Circle', area: Math.PI * r * r }),
    about: 'A prism with circular ends. Unrolled, its curved surface is a rectangle 2πr long.',
  },
  cone: {
    name: 'Cone',
    dims: ['r', 'h'],
    volume: ({ r, h }) => (Math.PI * r * r * h) / 3,
    area: ({ r, h }) => Math.PI * r * r + Math.PI * r * Math.hypot(r, h),
    vFormula: 'V = ⅓πr²h',
    aFormula: 'A = πr² + πrl,  l = √(r² + h²)',
    fev: null,
    curved: '1 flat circular face, 1 curved surface, 1 curved edge, 1 apex',
    height: ({ h }) => h,
    section: ({ r, h }, y) => ({ shape: 'Circle', area: Math.PI * (r * (1 - y / h)) ** 2 }),
    about: 'A cone holds exactly one third of the cylinder with the same base and height.',
  },
  sphere: {
    name: 'Sphere',
    dims: ['r'],
    volume: ({ r }) => (4 / 3) * Math.PI * r ** 3,
    area: ({ r }) => 4 * Math.PI * r * r,
    vFormula: 'V = ⁴⁄₃πr³',
    aFormula: 'A = 4πr²',
    fev: null,
    curved: '1 curved surface, no edges, no vertices',
    height: ({ r }) => 2 * r,
    section: ({ r }, y) => ({ shape: 'Circle', area: Math.PI * Math.max(0, r * r - (y - r) ** 2) }),
    about: 'Every point on the surface is the same distance from the centre. It has the smallest surface area for a given volume.',
  },
  pyramid: {
    name: 'Square-based pyramid',
    dims: ['a', 'h'],
    volume: ({ a, h }) => (a * a * h) / 3,
    area: ({ a, h }) => a * a + 2 * a * Math.hypot(h, a / 2),
    vFormula: 'V = ⅓a²h',
    aFormula: 'A = a² + 2as,  s = √(h² + (a/2)²)',
    fev: [5, 8, 5],
    height: ({ h }) => h,
    section: ({ a, h }, y) => ({ shape: 'Square', area: (a * (1 - y / h)) ** 2 }),
    about: 'A square base and four triangular faces meeting at the apex, like the pyramids of Giza.',
  },
  prism: {
    name: 'Triangular prism',
    dims: ['a', 'h'],
    volume: ({ a, h }) => tri(a) * h,
    area: ({ a, h }) => 2 * tri(a) + 3 * a * h,
    vFormula: 'V = (√3⁄4)a² × h',
    aFormula: 'A = 2 × (√3⁄4)a² + 3ah',
    fev: [5, 9, 6],
    height: ({ h }) => h,
    section: ({ a }) => ({ shape: 'Equilateral triangle', area: tri(a) }),
    about: 'Two identical triangular ends joined by three rectangles. Every slice parallel to the ends is the same triangle.',
  },
  tetrahedron: {
    name: 'Regular tetrahedron',
    dims: ['a'],
    volume: ({ a }) => a ** 3 / (6 * Math.SQRT2),
    area: ({ a }) => SQ3 * a * a,
    vFormula: 'V = a³ ⁄ (6√2)',
    aFormula: 'A = √3 a²',
    fev: [4, 6, 4],
    height: ({ a }) => a * Math.sqrt(2 / 3),
    section: ({ a }, y) => ({ shape: 'Equilateral triangle', area: tri(a * (1 - y / (a * Math.sqrt(2 / 3)))) }),
    about: 'Four equilateral triangles. It is the simplest Platonic solid and the pyramid with a triangular base.',
  },
};

export const DIM_LABEL: Record<Dim, string> = { a: 'Side length a', b: 'Width w', h: 'Height h', r: 'Radius r' };
