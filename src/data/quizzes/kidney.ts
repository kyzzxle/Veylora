import type { QuizQuestion } from '../quiz-types';

export const kidneyQuiz: QuizQuestion[] = [
  {
    question: 'What is the functional filtering unit of the kidney called?',
    options: ['The alveolus', 'The nephron', 'The neuron', 'The villus'],
    answer: 1,
    explanation: 'Each kidney contains about a million nephrons, each with a glomerulus for filtering and a tubule for reabsorption and secretion.',
    difficulty: 'Basic',
  },
  {
    question: 'Which of these is normally NOT filtered out of the blood in the glomerulus?',
    options: ['Water', 'Glucose', 'Red blood cells and large proteins', 'Urea'],
    answer: 2,
    explanation: 'The filter lets small molecules through but holds back cells and large proteins. Protein or blood in urine can be a sign of kidney damage.',
    difficulty: 'Basic',
  },
  {
    question: 'About how much fluid do the kidneys filter each day, and how much becomes urine?',
    options: ['1.5 L filtered, 1.5 L of urine', 'About 180 L filtered, about 1–2 L of urine', '10 L filtered, 5 L of urine', '500 L filtered, 50 L of urine'],
    answer: 1,
    explanation: 'Over 99 % of the filtrate is reabsorbed. Check the “Water reabsorbed” readout in the simulator.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When you are dehydrated, what does ADH do?',
    options: [
      'It stops the kidneys filtering',
      'It makes the collecting ducts more permeable to water, so more water is reabsorbed and urine becomes concentrated',
      'It makes urine more dilute',
      'It removes glucose from the blood',
    ],
    answer: 1,
    explanation: 'ADH (antidiuretic hormone) is released by the pituitary gland when the blood becomes too concentrated, helping the body save water.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why does glucose appear in the urine when blood glucose is very high?',
    options: [
      'The glomerulus stops filtering glucose',
      'The tubules can only reabsorb glucose up to a limit; above it, the extra glucose stays in the urine',
      'The bladder makes glucose',
      'Insulin pushes glucose into urine',
    ],
    answer: 1,
    explanation: 'Above about 10 mmol/L, filtered glucose exceeds the transport capacity of the proximal tubule. The glucose also pulls water with it, causing more urination and thirst.',
    difficulty: 'Advanced',
  },
  {
    question: 'What is the correct order of urine flow through the urinary system?',
    options: ['Bladder → ureter → kidney → urethra', 'Kidney → ureter → bladder → urethra', 'Kidney → urethra → bladder → ureter', 'Ureter → kidney → bladder → urethra'],
    answer: 1,
    explanation: 'Urine forms in the kidneys, travels down the ureters, is stored in the bladder and leaves through the urethra.',
    difficulty: 'Basic',
  },
  {
    question: 'What is the main nitrogen-containing waste removed by the kidneys?',
    options: ['Glucose', 'Urea', 'Oxygen', 'Haemoglobin'],
    answer: 1,
    explanation: 'The liver converts toxic ammonia from broken-down proteins into urea, which the kidneys excrete.',
    difficulty: 'Basic',
  },
  {
    question: 'Why can a sharp fall in blood pressure reduce urine production?',
    options: [
      'The bladder shrinks',
      'Less pressure pushes fluid out of the glomerulus, so less is filtered',
      'ADH stops working',
      'The ureters close',
    ],
    answer: 1,
    explanation: 'Filtration is driven by blood pressure. The kidneys keep it steady over a wide range (autoregulation), but very low pressure reduces filtration.',
    difficulty: 'Advanced',
  },
];
