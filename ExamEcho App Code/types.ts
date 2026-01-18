
export type QuizType = 'MCQ' | 'Subjective' | 'Mixed';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

export interface Question {
  id: number;
  type: 'MCQ' | 'Subjective';
  question: string;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer?: string;
  expected_answer_points?: string[];
  evidence: string;
  source: string;
}

export interface Quiz {
  quiz_title: string;
  quiz_type: QuizType;
  difficulty: Difficulty;
  total_questions: number;
  questions: Question[];
  instructions_to_user: string;
  ready_for_answers: boolean;
}

export interface QuestionReview {
  id: number;
  question: string;
  your_answer: string;
  correct_answer: string;
  explanation: string;
  evidence: string;
  source: string;
  is_correct: boolean;
  score_attained: number;
}

export interface EvaluationResults {
  total_questions: number;
  correct: number;
  incorrect: number;
  score: number;
  total_score: number;
  percentage: number;
  all_questions_review: QuestionReview[];
  final_feedback: string;
}

export interface QuizHistoryEntry {
  id: string;
  timestamp: number;
  title: string;
  percentage: number;
  results: EvaluationResults;
  quiz: Quiz;
}

export interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

export type AppSource = 
  | { type: 'pdf', data: FileData }
  | { type: 'generated', topic: string, content: string };

export type AppStep = 'UPLOAD' | 'PREVIEW' | 'CONFIG' | 'LOADING' | 'QUIZ' | 'REVIEW' | 'HISTORY_VIEW';
