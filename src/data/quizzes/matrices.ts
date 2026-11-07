import type { QuizQuestion } from '../quiz-types';

export const matricesQuiz: QuizQuestion[] = [
  {
    question: 'A is a 2×3 matrix and B is a 3×4 matrix. What is the size of AB, and is BA defined?',
    options: ['AB is 3×3; BA is 4×2', 'AB is 2×4; BA is not defined', 'AB is 2×4; BA is 4×2', 'Neither product is defined'],
    answer: 1,
    explanation: 'AB needs the columns of A (3) to equal the rows of B (3), and has the outer sizes 2×4. BA would need the columns of B (4) to equal the rows of A (2), so it is not defined.',
    difficulty: 'Intermediate',
  },
  {
    question: 'For A = [1 2; 3 4] and B = [5 6; 7 8], what is the entry in row 1, column 2 of AB?',
    options: ['12', '19', '20', '22'],
    answer: 3,
    explanation: 'Row 1 of A times column 2 of B: 1·6 + 2·8 = 6 + 16 = 22.',
    difficulty: 'Basic',
  },
  {
    question: 'In the 2D view, “rotate 90° then stretch sideways” gives a different shape from “stretch sideways then rotate 90°”. What does this show?',
    options: [
      'Matrix multiplication is not commutative: in general AB ≠ BA',
      'Rotations always undo stretches',
      'The determinant changes sign',
      'Matrix addition is not commutative',
    ],
    answer: 0,
    explanation: 'Combining transformations multiplies their matrices, and the order of multiplication matters. With column vectors, “T₁ then T₂” is the product T₂·T₁.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why do 2D transformations that include a translation use 3×3 matrices?',
    options: [
      'Because 2×2 matrices cannot rotate',
      'Because translations need a third spatial dimension',
      'A translation is not linear (it moves the origin), so points are written as (x, y, 1) to make it a matrix product',
      'It makes the determinant larger',
    ],
    answer: 2,
    explanation: 'Every 2×2 matrix keeps the origin fixed. Homogeneous coordinates add a 1, so that [1 0 tₓ; 0 1 t_y; 0 0 1] shifts every point by (tₓ, t_y).',
    difficulty: 'Intermediate',
  },
  {
    question: 'A 2×2 matrix has determinant −3. What does it do to the unit square?',
    options: [
      'Shrinks it to area −3',
      'Maps it to a parallelogram of area 3 with its orientation reversed',
      'Collapses it onto a line',
      'Leaves its area unchanged',
    ],
    answer: 1,
    explanation: '|det| = 3 is the area-scaling factor, and the negative sign means the image is a mirror image (orientation flips). Areas themselves are never negative.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the determinant of [2 4; 1 2], and what does it tell you?',
    options: ['8: the area grows eightfold', '4: the matrix doubles areas twice', '−2: orientation flips', '0: the plane collapses onto a line, so the matrix has no inverse'],
    answer: 3,
    explanation: 'det = 2·2 − 4·1 = 0. The two columns point the same way, so every vector lands on one line. Information is lost and cannot be undone.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the inverse of A = [1 2; 3 4]?',
    options: ['[−2 1; 3/2 −1/2]', '[4 −2; −3 1]', '[1 3; 2 4]', '[1/1 1/2; 1/3 1/4]'],
    answer: 0,
    explanation: 'det A = 4 − 6 = −2, so A⁻¹ = (1/−2)·[4 −2; −3 1] = [−2 1; 3/2 −1/2]. Check: A·A⁻¹ = I.',
    difficulty: 'Advanced',
  },
  {
    question: 'What does A v = λ v mean for an eigenvector v?',
    options: [
      'A rotates v by the angle λ',
      'v is unchanged by A',
      'A only stretches, shrinks or reverses v along its own line, by the factor λ',
      'v is perpendicular to Av',
    ],
    answer: 2,
    explanation: 'An eigenvector keeps its line through the origin. The eigenvalue λ is the scale factor: |λ| > 1 stretches, |λ| < 1 shrinks, and a negative λ reverses the direction.',
    difficulty: 'Basic',
  },
  {
    question: 'In the Eigen view, a 90° rotation matrix [0 −1; 1 0] shows no green eigen-lines. Why?',
    options: [
      'Its eigenvalues are complex (±i), so no real vector keeps its direction',
      'The simulator could not compute them',
      'Every vector is an eigenvector',
      'Its determinant is zero',
    ],
    answer: 0,
    explanation: 'λ² + 1 = 0 has no real solutions. A rotation turns every non-zero vector, so it has no real eigenvectors, even though it is invertible (det = 1).',
    difficulty: 'Advanced',
  },
  {
    question: 'In the 3D view you drag to orbit the camera around the transformed block. What happens to the transformation matrix?',
    options: [
      'It rotates along with the camera',
      'Its determinant changes',
      'It becomes the identity',
      'Nothing: moving the camera changes the viewpoint, not the object or its matrix',
    ],
    answer: 3,
    explanation: 'Transforming an object changes its coordinates; moving the camera only changes how we look at it. The matrix, its determinant and the object stay the same.',
    difficulty: 'Basic',
  },
];
