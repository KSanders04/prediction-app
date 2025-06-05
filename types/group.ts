import { Timestamp } from 'firebase/firestore';

export interface Group {
  id: string;
  code: string;
  createdAt: Date;
  createdBy: string;
  members: string[];
  groupStatus: 'active' | 'closed';
  isAdmin: boolean;
  adminId: string;
  groupName: string;
  currentGameId?: string;
  currentGameName?: string;
  url?: string;
  groupAdminID?: string;
}

export interface GroupData {
  id: string;
  code: string;
  groupStatus: string;
  createdBy: string;
  members: string[];
  groupName: string;
  currentGameId?: string;
  currentGameName?: string;
  url?: string;
  groupAdminID: string;
  lastGameUpdate?: Timestamp;
  updatedBy?: string;
}