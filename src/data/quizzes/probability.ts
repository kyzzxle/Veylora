import type { QuizQuestion } from '../quiz-types';

export const probabilityQuiz: QuizQuestion[] = [
  {
    question: 'What is the theoretical probability of rolling a 4 on a fair six-sided die?',
    options: ['1/4', '1/6', '4/6', '1/2'],
    answer: 1,
    explanation: 'There are 6 equally likely outcomes and only one of them is a 4, so P(4) = 1/6 ≈ 0.167.',
    difficulty: 'Basic',
  },
  {
    question: 'You flip a fair coin 10 times and get 7 heads. What does this tell you?',
    options: [
      'The coin must be unfair',
      'Small samples often differ from the theoretical probability; 7 heads in 10 is not unusual',
      'The next flip will probably be tails',
      'Probability does not work for coins',
    ],
    answer: 1,
    explanation:
      'With only 10 trials, results vary a lot. Getting 7 or more heads happens about 17% of the time with a fair coin. Run many more trials and the proportion settles close to 0.5.',
    difficulty: 'Basic',
  },
  {
    question: 'What does the law of large numbers say?',
    options: [
      'Large numbers are more likely to come up',
      'As the number of trials grows, the experimental probability tends to get closer to the theoretical probability',
      'After many heads, tails becomes more likely',
      'Every outcome must occur the same number of times',
    ],
    answer: 1,
    explanation:
      'Over many trials, the running proportion settles toward the true probability — watch the graph flatten out near the dashed line. It does not mean outcomes “balance out” in the short run.',
    difficulty: 'Basic',
  },
  {
    question: 'A fair coin lands heads five times in a row. What is the probability that the next flip is heads?',
    options: ['Less than 1/2, because tails is “due”', 'Exactly 1/2', 'More than 1/2, because heads is “hot”', '1/32'],
    answer: 1,
    explanation:
      'Each flip is independent: the coin has no memory. The probability is still 1/2. Believing tails is “due” is called the gambler’s fallacy.',
    difficulty: 'Intermediate',
  },
  {
    question: 'When rolling two dice, which sum is most likely?',
    options: ['2', '6', '7', '12'],
    answer: 2,
    explanation:
      'There are 6 ways to make 7 (1+6, 2+5, 3+4, 4+3, 5+2, 6+1) out of 36 equally likely combinations, so P(7) = 6/36 = 1/6. Sums of 2 and 12 each have only one way.',
    difficulty: 'Intermediate',
  },
  {
    question: 'What is the probability of a sum of 4 with two fair dice?',
    options: ['1/12', '1/9', '1/6', '4/36'],
    answer: 0,
    explanation: 'The combinations are (1,3), (2,2) and (3,1): 3 out of 36, which simplifies to 1/12 ≈ 0.083.',
    difficulty: 'Advanced',
  },
  {
    question: 'A coin is biased so that P(heads) = 0.7. In 1,000 flips, about how many heads would you expect?',
    options: ['300', '500', '700', '1,000'],
    answer: 2,
    explanation:
      'Expected count = probability × number of trials = 0.7 × 1,000 = 700. Actual results will vary a little around this value — typically within about ±30.',
    difficulty: 'Advanced',
  },
];
