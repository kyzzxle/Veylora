import type { QuizQuestion } from '../quiz-types';

export const immuneQuiz: QuizQuestion[] = [
  {
    question: 'What is the body’s first line of defence against pathogens?',
    options: ['Antibodies', 'Physical and chemical barriers such as skin, mucus and stomach acid', 'Memory T cells', 'The spleen'],
    answer: 1,
    explanation: 'Unbroken skin, sticky mucus, cilia, tears and stomach acid stop most pathogens from ever entering the tissues. In the simulator, the pathogen only gets in through a cut.',
    difficulty: 'Basic',
  },
  {
    question: 'Where do T cells mature?',
    options: ['In the bone marrow', 'In the thymus', 'In the stomach', 'In the lymph nodes'],
    answer: 1,
    explanation: 'All white blood cells are made in the bone marrow, but T cells travel to the thymus to mature. B cells mature in the bone marrow itself.',
    difficulty: 'Basic',
  },
  {
    question: 'What do phagocytes do?',
    options: ['Make antibodies', 'Engulf and digest pathogens', 'Carry oxygen', 'Remember past infections'],
    answer: 1,
    explanation: 'Phagocytes such as neutrophils and macrophages are part of innate immunity. They surround a pathogen, take it inside and destroy it with enzymes.',
    difficulty: 'Basic',
  },
  {
    question: 'Why do inflamed areas look red, swollen and feel warm?',
    options: [
      'The pathogen produces heat',
      'Capillaries widen and become leakier, bringing more blood, fluid and white blood cells to the area',
      'The skin is dying',
      'Antibodies are red',
    ],
    answer: 1,
    explanation: 'Damaged cells release chemicals such as histamine. Wider, leakier capillaries let phagocytes and fluid reach the infection quickly; this is why the capillary widens in the simulation.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is an antigen?',
    options: [
      'A type of white blood cell',
      'A molecule, often on the surface of a pathogen, that the immune system recognises as foreign',
      'A medicine that kills bacteria',
      'A protein made by B cells',
    ],
    answer: 1,
    explanation: 'Each B or T cell carries receptors that fit one particular antigen. Antibodies are the proteins made by B cells that bind to antigens.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, why does the adaptive response take several days the first time?',
    options: [
      'Antibodies have to travel from the brain',
      'Only a few B and T cells recognise the new antigen, and they must divide many times before there are enough',
      'The pathogen hides for a week',
      'The body waits for a fever first',
    ],
    answer: 1,
    explanation: 'This multiplication is called clonal expansion. The innate response holds the infection back while the adaptive response builds up.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Why is the secondary immune response faster and larger than the primary response?',
    options: [
      'The pathogen is weaker the second time',
      'Memory B and T cells from the first exposure recognise the antigen at once and multiply quickly',
      'Antibodies from the first infection last for life at high levels',
      'The secondary response uses only phagocytes',
    ],
    answer: 1,
    explanation: 'Antibody levels fall after an infection, but memory cells remain for years. This is the basis of vaccination.',
    difficulty: 'Advanced',
  },
  {
    question: 'How does a vaccine protect a person?',
    options: [
      'It contains antibodies that last forever',
      'It exposes the immune system to a harmless form of an antigen, so memory cells form without causing the disease',
      'It kills all bacteria in the body',
      'It makes the skin thicker',
    ],
    answer: 1,
    explanation: 'Vaccines trigger a primary response safely. If the real pathogen arrives later, the fast secondary response usually clears it before it causes serious illness.',
    difficulty: 'Advanced',
  },
];
