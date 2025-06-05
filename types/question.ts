import { Timestamp } from 'firebase/firestore';

export interface Question {
  id: string;
  gameId: string;
  question: string;
  options: string[];
  status: "active" | "closed" | "finished";
  actual_result: string;
  createdAt: Date;
  createdBy: string;
  templateId?: string;
}

export interface QuestionTemplate {
  id: string;
  text: string;
  options: Array<{ optionText: string }>;
  type: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Guess {
  id: string;
  prediction: string;
  questionId: string;
  playerId: string;
  playerEmail?: string;
  userName?: string;
  timestamp: Timestamp | Date | any;
}