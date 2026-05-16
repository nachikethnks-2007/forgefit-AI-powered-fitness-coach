export type TierRank = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster';
export type TierLevel = 'I' | 'II' | 'III' | 'IV' | 'V';

export interface ConsistencyTier {
  rank: TierRank;
  level: TierLevel;
  threshold: number;
}

export interface ConsistencyHistory {
  date: string;
  pointsEarned: number;
  streak: number;
  tier: string;
  activityType: 'workout' | 'streak_bonus' | 'weekly_bonus' | 'penalty';
}

export interface WeeklyActivity {
  week: string;
  activeDays: number;
  pointsEarned: number;
}

export interface ConsistencyState {
  currentTier: ConsistencyTier;
  progressScore: number;
  streak: number;
  weeklyActivity: WeeklyActivity[];
  lastWorkoutDate: string | null;
  consistencyHistory: ConsistencyHistory[];
  totalWorkouts: number;
  longestStreak: number;
  missedDays: number;
  lastPenaltyDate: string | null;
}

export const TIER_THRESHOLDS: ConsistencyTier[] = [
  { rank: 'Bronze', level: 'I', threshold: 0 },
  { rank: 'Bronze', level: 'II', threshold: 50 },
  { rank: 'Bronze', level: 'III', threshold: 100 },
  { rank: 'Bronze', level: 'IV', threshold: 150 },
  { rank: 'Bronze', level: 'V', threshold: 200 },
  { rank: 'Silver', level: 'I', threshold: 300 },
  { rank: 'Silver', level: 'II', threshold: 400 },
  { rank: 'Silver', level: 'III', threshold: 500 },
  { rank: 'Silver', level: 'IV', threshold: 600 },
  { rank: 'Silver', level: 'V', threshold: 700 },
  { rank: 'Gold', level: 'I', threshold: 850 },
  { rank: 'Gold', level: 'II', threshold: 1000 },
  { rank: 'Gold', level: 'III', threshold: 1200 },
  { rank: 'Gold', level: 'IV', threshold: 1400 },
  { rank: 'Gold', level: 'V', threshold: 1600 },
  { rank: 'Platinum', level: 'I', threshold: 1850 },
  { rank: 'Platinum', level: 'II', threshold: 2100 },
  { rank: 'Platinum', level: 'III', threshold: 2400 },
  { rank: 'Platinum', level: 'IV', threshold: 2700 },
  { rank: 'Platinum', level: 'V', threshold: 3000 },
  { rank: 'Diamond', level: 'I', threshold: 3400 },
  { rank: 'Diamond', level: 'II', threshold: 3800 },
  { rank: 'Diamond', level: 'III', threshold: 4300 },
  { rank: 'Diamond', level: 'IV', threshold: 4800 },
  { rank: 'Diamond', level: 'V', threshold: 5400 },
  { rank: 'Master', level: 'I', threshold: 6000 },
  { rank: 'Master', level: 'II', threshold: 6700 },
  { rank: 'Master', level: 'III', threshold: 7500 },
  { rank: 'Master', level: 'IV', threshold: 8400 },
  { rank: 'Master', level: 'V', threshold: 9500 },
  { rank: 'Grandmaster', level: 'I', threshold: 11000 },
  { rank: 'Grandmaster', level: 'II', threshold: 13000 },
  { rank: 'Grandmaster', level: 'III', threshold: 15500 },
  { rank: 'Grandmaster', level: 'IV', threshold: 18500 },
  { rank: 'Grandmaster', level: 'V', threshold: 22000 },
];

export const TIER_COLORS: Record<TierRank, string> = {
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#e5e4e2',
  Diamond: '#b9f2ff',
  Master: '#9b59b6',
  Grandmaster: '#ff6b6b',
};
