import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  userName?: string;
  name: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profilePic?: string;
  totalPoints: number;
  gamesPlayed: number;
  correctPredictions: number;
  totalPredictions: number;
  lastPlayed: Timestamp | Date | any;
  groups?: string[];
  createdAt?: Timestamp | Date;
  isGamemaster?: boolean | null;
  uid?: string;
}

export interface ActivePlayer {
  userId: string;
  email: string;
  gameId: string;
  status: 'online' | 'offline';
  isPlaying: boolean;
  lastSeen: Timestamp;
  joinedAt: Timestamp;
}