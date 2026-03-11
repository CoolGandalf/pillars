export interface Value {
  id: number;
  name: string;
  definition: string;
  detail?: string;
}

export interface Comparison {
  id?: number;
  sessionId: string;
  winnerId: number;
  loserId: number;
  timestamp: number;
  undone?: boolean;
}

export interface ValueScore {
  valueId: number;
  score: number;
  sigma: number;
  rank: number;
  appearances: number;
  top2Prob: number;
  top25Prob: number;
}

export type Phase = 'mapping' | 'refining' | 'locking' | 'done';

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  phase: Phase;
  comparisonCount: number;
  displayName?: string;
}

export interface ResultSnapshot {
  id: string;
  sessionId: string;
  createdAt: number;
  top2: [number, number];
  top25: number[];
  fullRanking: number[];
  totalComparisons: number;
  confidenceTier: 'locked' | 'likely';
}
