import type { QuizQuestion } from '../quiz-types';

export const plantHormonesQuiz: QuizQuestion[] = [
  {
    question: 'A gardener pinches out the shoot tip of a basil plant. Why does it become bushier?',
    options: [
      'The cut releases ethylene, which makes branches',
      'Removing the tip stops the flow of auxin down the stem, so side buds are released from apical dominance',
      'The plant makes more gibberellin to repair the wound',
      'Cutting makes the roots absorb more water',
    ],
    answer: 1,
    explanation: 'Auxin from the shoot tip keeps the side buds dormant. Without the tip, the buds grow into side shoots.',
    difficulty: 'Basic',
  },
  {
    question: 'In Thimann and Skoog’s experiment, what happened when auxin was put on the cut stump of a decapitated shoot?',
    options: [
      'The side buds grew even faster',
      'The plant died',
      'The side buds stayed dormant, as if the tip were still there',
      'The stump grew a new flower',
    ],
    answer: 2,
    explanation: 'Auxin replaced the missing shoot tip and restored apical dominance, showing that auxin is the inhibiting signal.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A mutant pea plant is very short, but grows to normal height when sprayed with gibberellin. What is the most likely cause?',
    options: [
      'It makes too much ethylene',
      'It cannot respond to auxin',
      'It has too much cytokinin',
      'It cannot make enough gibberellin',
    ],
    answer: 3,
    explanation: 'Mendel’s dwarf peas lack an enzyme needed to make active gibberellin. Adding gibberellin restores stem elongation.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which hormone closes stomata when a plant is short of water?',
    options: ['Abscisic acid (ABA)', 'Gibberellin', 'Cytokinin', 'Auxin'],
    answer: 0,
    explanation: 'ABA rises during drought and makes guard cells lose potassium ions and water, so the stomata close and less water is lost.',
    difficulty: 'Basic',
  },
  {
    question: 'Why can one ripe banana in a bag make the other bananas ripen faster?',
    options: [
      'It releases gibberellin, which travels through the bag',
      'It releases ethylene gas, which triggers ripening, and ripening fruit make even more ethylene',
      'It uses up the oxygen in the bag',
      'It warms the other bananas up',
    ],
    answer: 1,
    explanation: 'Ethylene is a gas, and ripening is a positive-feedback process: ethylene triggers more ethylene production.',
    difficulty: 'Basic',
  },
  {
    question: 'In tissue culture, a callus is grown on a jelly with a high ratio of auxin to cytokinin. What is it likely to form?',
    options: ['Shoots', 'Flowers', 'Roots', 'Nothing: it dies'],
    answer: 2,
    explanation: 'Skoog and Miller found that a high auxin : cytokinin ratio favours roots, a low ratio favours shoots, and a balance keeps an undifferentiated callus.',
    difficulty: 'Advanced',
  },
  {
    question: 'In a germinating barley grain, what does gibberellin from the embryo do?',
    options: [
      'It makes the aleurone layer produce amylase, which breaks down stored starch into sugar',
      'It closes the seed coat',
      'It keeps the seed dormant',
      'It makes the seed produce ethylene',
    ],
    answer: 0,
    explanation: 'Gibberellin triggers amylase production in the aleurone layer. The sugar released feeds the growing seedling. ABA opposes this effect.',
    difficulty: 'Intermediate',
  },
  {
    question: 'The same auxin concentration speeds up stem growth but slows root growth. What does this show?',
    options: [
      'Auxin only works in stems',
      'Roots have no auxin receptors',
      'Auxin is broken down in roots',
      'Different tissues have different sensitivities, so the response depends on concentration and tissue type',
    ],
    answer: 3,
    explanation: 'Roots respond best to far lower auxin concentrations than stems. A concentration that is optimal for a stem is inhibitory for a root.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which pair of hormones generally acts against each other in controlling seed dormancy and germination?',
    options: ['Auxin and cytokinin', 'Gibberellin and abscisic acid', 'Ethylene and auxin', 'Cytokinin and gibberellin'],
    answer: 1,
    explanation: 'ABA keeps seeds dormant and gibberellin promotes germination. The balance between them decides when the seed germinates.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Where are cytokinins mainly made, and how do they reach the shoot?',
    options: [
      'In root tips, carried up in the xylem',
      'In flowers, carried down in the phloem',
      'In the shoot tip, moving down cell by cell',
      'In ripe fruit, released as a gas',
    ],
    answer: 0,
    explanation: 'Root tips make most cytokinin, which travels up in the xylem sap and promotes cell division and bud growth in the shoot.',
    difficulty: 'Intermediate',
  },
];
