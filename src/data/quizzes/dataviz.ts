import type { QuizQuestion } from '../quiz-types';

export const dataVizQuiz: QuizQuestion[] = [
  {
    question: 'Which chart is best for showing how two numerical variables are related, such as temperature and ice-cream sales?',
    options: ['Pie chart', 'Scatter graph', 'Bar chart', 'Histogram'],
    answer: 1,
    explanation: 'Each point on a scatter graph is one pair of measurements, so you can see whether and how the two variables are related.',
    difficulty: 'Basic',
  },
  {
    question: 'Which chart is most suitable for showing how rainfall changes month by month?',
    options: ['Line graph', 'Pie chart', 'Histogram', 'Scatter graph with no order'],
    answer: 0,
    explanation: 'Line graphs show change over time; the slope between points shows rises and falls. A bar chart also works.',
    difficulty: 'Basic',
  },
  {
    question: 'What does a histogram show?',
    options: [
      'Parts of a whole',
      'How often values fall into each range (the distribution of one numerical variable)',
      'The relationship between two variables',
      'Change over time',
    ],
    answer: 1,
    explanation: 'Histograms group numerical data into bins with no gaps between bars, revealing the shape, centre and spread of the data.',
    difficulty: 'Basic',
  },
  {
    question: 'In the simulator, turn off “Start the y-axis at zero” on the rainfall bar chart. What happens?',
    options: [
      'Nothing changes',
      'Differences between months look much bigger than they really are',
      'The data changes',
      'The bars get wider',
    ],
    answer: 1,
    explanation: 'A truncated axis exaggerates differences. It is a common way charts mislead, deliberately or by accident. Bar charts should start at zero.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Adding one very low score to a class’s test results affects which average more?',
    options: ['The median', 'The mean', 'Both equally', 'Neither'],
    answer: 1,
    explanation: 'The mean uses every value, so an outlier pulls it strongly; the median only depends on the middle value, so it barely moves.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A correlation coefficient of r = 0.9 means…',
    options: [
      'One variable definitely causes the other',
      'There is a strong positive linear relationship: as one goes up, the other tends to go up',
      'There is no relationship',
      'There is a strong negative relationship',
    ],
    answer: 1,
    explanation: 'r ranges from −1 to +1. Values near ±1 mean a strong linear relationship, but correlation alone does not prove cause.',
    difficulty: 'Intermediate',
  },
  {
    question: 'Ice-cream sales and shark attacks both rise in summer. What is the best explanation?',
    options: [
      'Eating ice cream attracts sharks',
      'A third factor, hot weather bringing more people to the beach, causes both',
      'Sharks eat ice cream',
      'It is a coincidence with no explanation',
    ],
    answer: 1,
    explanation: 'This is a confounding variable. Correlation does not imply causation; controlled experiments are needed to show cause and effect.',
    difficulty: 'Advanced',
  },
  {
    question: 'Why can a small sample give a misleading picture?',
    options: [
      'Small samples are always wrong',
      'Random variation has a bigger effect, so patterns can appear or disappear by chance',
      'Charts cannot show small samples',
      'Small samples have no mean',
    ],
    answer: 1,
    explanation: 'Try 5 days instead of 200 in the simulator: the trend and correlation jump around much more with fewer data points.',
    difficulty: 'Advanced',
  },
];
