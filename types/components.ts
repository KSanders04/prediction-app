import { User } from './user';

export interface UserStatsProps {
  currentUser: User;
  authUser: any;
  getCurrentUserRank: () => number;
  getRankSuffix: (rank: number) => string;
  getAccuracy: (correct: number, total: number) => number;
  formatLastPlayed: (timestamp: any) => string;
}

export interface ProfileStatsProps {
  currentUser: User;
  authUser: any;
  getCurrentUserRank: () => number;
  getRankSuffix: (rank: number) => string;
  getAccuracy: (correct: number, total: number) => number;
  formatLastPlayed: (timestamp: any) => string;
}

export interface ActivePlayersProps {
  currentGameId?: string | null;
}