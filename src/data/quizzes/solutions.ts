import type { QuizQuestion } from '../quiz-types';

export const solutionsQuiz: QuizQuestion[] = [
  {
    question: 'In salt water, which substance is the solute and which is the solvent?',
    options: ['Water is the solute; salt is the solvent', 'Salt is the solute; water is the solvent', 'Both are solvents', 'Salt water has no solute'],
    answer: 1,
    explanation: 'The solute is the substance that dissolves (salt); the solvent is the substance it dissolves in, usually present in the larger amount (water). Together they make a solution.',
    difficulty: 'Basic',
  },
  {
    question: 'A solution has solid sitting at the bottom that no longer dissolves, even with stirring. What kind of solution is it?',
    options: ['Unsaturated', 'Saturated', 'Supersaturated', 'Dilute'],
    answer: 1,
    explanation: 'A saturated solution holds the maximum amount of solute that can stay dissolved at that temperature. Extra solid stays undissolved.',
    difficulty: 'Basic',
  },
  {
    question: 'What does stirring change when a solid dissolves?',
    options: [
      'It increases the solubility',
      'It makes the solid dissolve faster, but does not change how much can dissolve',
      'It makes the solid dissolve slower',
      'It turns the solution into a supersaturated one',
    ],
    answer: 1,
    explanation: 'Stirring carries the concentrated solution away from the crystals and brings fresh solvent to them, so dissolving is faster. The solubility depends on the substance and temperature, not on stirring.',
    difficulty: 'Basic',
  },
  {
    question: 'Using the solubility curve, about how much potassium nitrate can dissolve in 100 g of water at 60 °C, compared with 20 °C?',
    options: ['The same amount', 'About 110 g at 60 °C, compared with about 32 g at 20 °C', 'Less at 60 °C', 'About 36 g at both temperatures'],
    answer: 1,
    explanation: 'Potassium nitrate’s solubility rises steeply with temperature. That is why a hot saturated solution forms many crystals when it cools.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A saturated potassium nitrate solution at 60 °C (110 g in 100 g water) is cooled to 20 °C (solubility 31.6 g per 100 g). With crystals present, about how much solid forms?',
    options: ['About 32 g', 'About 78 g', 'About 110 g', 'None'],
    answer: 1,
    explanation: '110 g − 31.6 g ≈ 78 g cannot stay dissolved at 20 °C, so it crystallizes. The solution left behind is saturated at 20 °C.',
    difficulty: 'Advanced',
  },
  {
    question: 'Which statement about solubility is correct?',
    options: [
      'All solids become more soluble when the water is heated',
      'Solubility depends on the substance and the conditions: most solids dissolve better in hot water, but some, such as lithium sulfate, dissolve slightly less, and gases dissolve less',
      'Every substance has the same solubility',
      'Solubility depends only on how much water there is',
    ],
    answer: 1,
    explanation: 'Compare the curves in the simulator: potassium nitrate rises steeply, table salt barely changes, and lithium sulfate falls. Gases such as oxygen and carbon dioxide are less soluble in warm water.',
    difficulty: 'Intermediate',
  },
  {
    question: '20 g of salt is dissolved in water to make 0.50 L of solution. What is the concentration in g/L?',
    options: ['10 g/L', '20 g/L', '40 g/L', '0.025 g/L'],
    answer: 2,
    explanation: 'Concentration = mass of solute ÷ volume of solution = 20 g ÷ 0.50 L = 40 g/L.',
    difficulty: 'Intermediate',
  },
  {
    question: 'How is a supersaturated solution usually made, and why is it unstable?',
    options: [
      'By stirring a saturated solution hard; it is stable',
      'By carefully cooling (or evaporating) a saturated solution with no crystals present; adding a seed crystal makes the excess crystallize',
      'By adding more solid to a saturated solution',
      'By adding water',
    ],
    answer: 1,
    explanation: 'Without a surface to build on, the extra solute can stay dissolved for a while. A seed crystal, a scratch or dust gives it somewhere to start, and crystals grow until the solution is just saturated.',
    difficulty: 'Advanced',
  },
  {
    question: 'When sugar dissolves in water, what happens to the sugar particles?',
    options: [
      'They split into positive and negative ions',
      'Whole sugar molecules separate from the crystal and are surrounded by water molecules',
      'They disappear',
      'They react with water to make a new substance',
    ],
    answer: 1,
    explanation: 'Sugar is a molecular (covalent) compound, so it dissolves as intact molecules. Ionic compounds such as salt separate into ions. In both cases the mass of solute is conserved.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Water evaporates from an unsaturated salt solution. What happens to its concentration?',
    options: [
      'It decreases, because salt evaporates too',
      'It increases, because the same mass of salt is now in less water',
      'It stays the same',
      'The salt turns into water',
    ],
    answer: 1,
    explanation: 'Only the water evaporates. The solute stays behind in a smaller volume, so the concentration rises, and if enough water is lost, the solution becomes saturated and crystals form. This is how sea salt is made.',
    difficulty: 'Basic',
  },
];
