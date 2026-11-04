import type { QuizQuestion } from '../quiz-types';

export const atomQuiz: QuizQuestion[] = [
  {
    question: 'Which particle determines what element an atom is?',
    options: ['Electron', 'Neutron', 'Proton', 'Photon'],
    answer: 2,
    explanation: 'The number of protons is the atomic number. Change it by one and you have a different element — try it in the simulator.',
    difficulty: 'Basic',
  },
  {
    question: 'An atom has 8 protons, 8 neutrons and 8 electrons. What is its mass number?',
    options: ['8', '16', '24', '0'],
    answer: 1,
    explanation: 'Mass number = protons + neutrons = 8 + 8 = 16. Electrons are so light that they are not counted. This is oxygen-16.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the charge of an atom with 11 protons and 10 electrons?',
    options: ['−1', '0', '+1', '+11'],
    answer: 2,
    explanation: 'Charge = protons − electrons = 11 − 10 = +1. This is a sodium ion, Na⁺, as found in table salt.',
    difficulty: 'Basic',
  },
  {
    question: 'Carbon-12 and carbon-14 are…',
    options: ['different elements', 'isotopes: same number of protons, different numbers of neutrons', 'ions with different charges', 'the same atom'],
    answer: 1,
    explanation:
      'Both have 6 protons (so both are carbon), but carbon-14 has 8 neutrons instead of 6. Carbon-14 is radioactive, which makes it useful for dating ancient organic material.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simple shell model, how are 11 electrons arranged?',
    options: ['2, 9', '2, 8, 1', '8, 3', '2, 2, 7'],
    answer: 1,
    explanation: 'The first shell holds 2 and the second holds 8, so the eleventh electron goes into the third shell: 2, 8, 1. That single outer electron makes sodium very reactive.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A chlorine atom gains one electron. What does it become?',
    options: ['Argon', 'A chloride ion with charge −1', 'A chlorine isotope', 'A chloride ion with charge +1'],
    answer: 1,
    explanation: 'Gaining an electron does not change the number of protons, so it is still chlorine — but now it has one more negative charge than positive: Cl⁻, a chloride ion.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does an excited electron give off light when it falls back to a lower shell?',
    options: [
      'It loses mass, which turns into light',
      'It releases the energy difference between the two shells as a photon',
      'The nucleus pushes it away',
      'Electrons always glow',
    ],
    answer: 1,
    explanation:
      'Electrons can only have certain energies. Dropping from a higher level to a lower one releases exactly the energy difference as a photon, whose colour depends on that energy. This is why each element has its own spectrum of colours — used in fireworks and to identify elements in distant stars.',
    difficulty: 'Advanced',
  },
];
