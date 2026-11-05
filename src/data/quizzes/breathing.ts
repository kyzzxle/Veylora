import type { QuizQuestion } from '../quiz-types';

export const breathingQuiz: QuizQuestion[] = [
  {
    question: 'What happens to the diaphragm when you breathe in?',
    options: ['It relaxes and moves up', 'It contracts, flattens and moves down', 'It stays still', 'It pushes air into the lungs'],
    answer: 1,
    explanation: 'The diaphragm contracts and flattens, making the chest cavity taller. The lungs expand with it and air flows in.',
    difficulty: 'Basic',
  },
  {
    question: 'Where does gas exchange take place in the lungs?',
    options: ['In the trachea', 'In the bronchi', 'In the alveoli', 'In the diaphragm'],
    answer: 2,
    explanation: 'Alveoli are tiny air sacs with walls one cell thick, surrounded by capillaries, so gases can diffuse across easily.',
    difficulty: 'Basic',
  },
  {
    question: 'Why does air flow INTO the lungs when the chest gets bigger?',
    options: [
      'The lungs suck air in with their own muscles',
      'A bigger volume lowers the pressure inside the lungs below the outside air pressure',
      'The pressure inside the lungs rises',
      'The trachea pumps air',
    ],
    answer: 1,
    explanation: 'Gas pressure falls as volume rises (Boyle’s law). Air moves from the higher outside pressure to the lower pressure in the lungs. The simulator shows a small negative pressure while breathing in.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which feature does NOT help alveoli exchange gases efficiently?',
    options: ['A huge total surface area', 'Walls one cell thick', 'A rich blood supply', 'A thick layer of cartilage'],
    answer: 3,
    explanation: 'Cartilage is found in the trachea and bronchi to keep them open. Alveoli need thin walls, large area and good blood flow for fast diffusion.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, why does blood oxygen saturation fall at high altitude even though you breathe faster?',
    options: [
      'The lungs get smaller',
      'Air pressure is lower, so each breath contains fewer oxygen molecules and less oxygen diffuses into the blood',
      'There is less nitrogen',
      'The heart stops pumping',
    ],
    answer: 1,
    explanation: 'Oxygen is still 21 % of the air, but the total pressure is lower, so the oxygen partial pressure in the alveoli falls.',
    difficulty: 'Intermediate',
  },
  {
    question: 'During an asthma attack, why does the lung volume baseline creep upwards in the simulator?',
    options: [
      'The person breathes in more deeply on purpose',
      'Narrowed airways make breathing out slow, so not all the air leaves before the next breath (air trapping)',
      'The alveoli grow',
      'The diaphragm stops working',
    ],
    answer: 1,
    explanation: 'Airway resistance is highest when breathing out, so each breath out is incomplete and air is trapped, leaving less room for fresh air.',
    difficulty: 'Advanced',
  },
  {
    question: 'A person breathes 15 times a minute with a tidal volume of 500 mL. What is their minute ventilation?',
    options: ['0.5 L per minute', '3 L per minute', '7.5 L per minute', '15 L per minute'],
    answer: 2,
    explanation: 'Minute ventilation = rate × tidal volume = 15 × 500 mL = 7,500 mL = 7.5 L per minute.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which gas level in the blood is the main trigger that makes you breathe faster during exercise?',
    options: ['Rising nitrogen', 'Rising carbon dioxide', 'Rising oxygen', 'Falling carbon dioxide'],
    answer: 1,
    explanation: 'Chemoreceptors are very sensitive to rising CO₂ (which also makes blood more acidic). This drives faster, deeper breathing.',
    difficulty: 'Advanced',
  },
];
