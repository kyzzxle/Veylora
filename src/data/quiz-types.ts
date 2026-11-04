export type Difficulty = 'Basic' | 'Intermediate' | 'Advanced';

export interface QuizQuestion {
  question: string;
  options: string[];
  /** Index into options of the correct answer. */
  answer: number;
  /** Shown after answering, whether right or wrong. */
  explanation: string;
  difficulty: Difficulty;
}
