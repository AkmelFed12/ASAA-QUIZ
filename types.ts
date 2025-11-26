
export interface User {
  username: string;
  role: 'USER' | 'ADMIN';
  lastPlayedDate: string | null; // ISO Date string YYYY-MM-DD
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT' | 'ADAPTIVE';

export interface Question {
  id?: number; // Optional because AI questions might not have ID immediately
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
  difficulty?: Difficulty;
  source?: 'AI' | 'MANUAL';
}

export interface QuizResult {
  username: string;
  score: number;
  totalQuestions: number;
  date: string; // ISO String
  difficultyLevel?: string;
}

export enum AppView {
  AUTH = 'AUTH',
  HOME = 'HOME',
  QUIZ = 'QUIZ',
  LEADERBOARD = 'LEADERBOARD',
  ADMIN = 'ADMIN',
  PROFILE = 'PROFILE'
}

export interface GlobalState {
  isManualOverride: boolean; // If true, ignores time check
  isQuizOpen: boolean; // Manual open/close state if override is on
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  conditionType: 'COUNT' | 'SCORE' | 'PERFECT' | 'TOTAL_SCORE';
  threshold: number;
}

export interface UserBadge {
  username: string;
  badgeId: string;
  dateEarned: string;
}
