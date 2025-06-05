export interface Game {
  id: string;
  name: string;
  status: string;
  createdBy: string;
  url?: string;
  videoId?: string;
  createdAt: Date;
  liveViewers?: string[];
  totalViewers?: string[];
}