import type { QuizQuestion } from '../quiz-types';

export const bondingQuiz: QuizQuestion[] = [
  {
    question: 'What is a covalent bond?',
    options: ['A transfer of electrons from one atom to another', 'A shared pair of electrons between two atoms', 'An attraction between metal ions and free electrons', 'A force between molecules'],
    answer: 1,
    explanation: 'In a covalent bond, two (usually non-metal) atoms share a pair of electrons, which both nuclei attract.',
    difficulty: 'Basic',
  },
  {
    question: 'What happens when sodium reacts with chlorine to form sodium chloride?',
    options: [
      'They share electrons equally',
      'Sodium transfers an electron to chlorine, forming Na⁺ and Cl⁻ ions',
      'Chlorine gives an electron to sodium',
      'They form a double bond',
    ],
    answer: 1,
    explanation: 'Sodium loses its single outer electron and chlorine gains it; both now have full outer shells, and the oppositely charged ions attract.',
    difficulty: 'Basic',
  },
  {
    question: 'How many pairs of electrons are shared in the triple bond of N₂?',
    options: ['1', '2', '3', '6'],
    answer: 2,
    explanation: 'A triple bond shares three pairs (six electrons). It is very strong, which is why nitrogen gas is so unreactive.',
    difficulty: 'Basic',
  },
  {
    question: 'Why is water a bent molecule rather than a straight one?',
    options: [
      'Hydrogen atoms repel each other only',
      'The two lone pairs on oxygen repel the bonding pairs, pushing the O–H bonds closer together',
      'Water is ionic',
      'Oxygen has no lone pairs',
    ],
    answer: 1,
    explanation: 'Oxygen has four electron pairs (two bonding, two lone). They spread out roughly tetrahedrally, giving a bent shape with a 104.5° angle.',
    difficulty: 'Intermediate',
  },
  {
    question: 'CO₂ has two polar C=O bonds. Why is the molecule non-polar overall?',
    options: [
      'Carbon and oxygen have the same electronegativity',
      'The molecule is linear, so the two bond dipoles point in opposite directions and cancel',
      'It has no lone pairs',
      'Double bonds are never polar',
    ],
    answer: 1,
    explanation: 'Polarity depends on both bond polarity and shape. In bent water the dipoles add up; in linear CO₂ they cancel.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Two elements have electronegativities of 0.93 and 3.16. What type of bond will they most likely form?',
    options: ['Non-polar covalent', 'Polar covalent', 'Ionic', 'Metallic'],
    answer: 2,
    explanation: 'The difference is 2.23, well above about 1.8, so one atom effectively takes the electron: an ionic bond (this is sodium and chlorine).',
    difficulty: 'Advanced',
  },
  {
    question: 'Why does magnesium oxide melt at 2,852 °C while sodium chloride melts at 801 °C?',
    options: [
      'MgO is heavier',
      'Mg²⁺ and O²⁻ have double charges, so the attraction between the ions is much stronger',
      'MgO is covalent',
      'NaCl contains water',
    ],
    answer: 1,
    explanation: 'Electrostatic attraction grows with the size of the charges. Small, highly charged ions make very strong ionic lattices.',
    difficulty: 'Advanced',
  },
  {
    question: 'Methane and diamond are both made of carbon and covalent bonds. Why does methane boil at −162 °C while diamond does not melt even at 3,000 °C?',
    options: [
      'Diamond has stronger C–H bonds',
      'Methane is made of separate small molecules held together by weak forces; diamond is one giant network of strong covalent bonds',
      'Methane is ionic',
      'Diamond contains metal',
    ],
    answer: 1,
    explanation: 'Boiling methane only overcomes weak forces between molecules. Melting diamond would mean breaking huge numbers of strong covalent bonds.',
    difficulty: 'Intermediate',
  },
];
