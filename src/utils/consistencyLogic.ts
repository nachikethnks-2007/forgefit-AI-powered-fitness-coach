import {
  ConsistencyTier,
  ConsistencyHistory,
  WeeklyActivity,
  TIER_THRESHOLDS,
} from '@/types/consistency';

export function calculateTier(score: number): ConsistencyTier {
  let currentTier = TIER_THRESHOLDS[0];
  
  for (const tier of TIER_THRESHOLDS) {
    if (score >= tier.threshold) {
      currentTier = tier;
    } else {
      break;
    }
  }
  
  return currentTier;
}

export function getNextTier(currentScore: number): ConsistencyTier | null {
  const currentIndex = TIER_THRESHOLDS.findIndex(
    tier => currentScore < tier.threshold
  );
  
  if (currentIndex === -1) {
    return null; // Already at max tier
  }
  
  return TIER_THRESHOLDS[currentIndex];
}

export function updateStreak(
  lastWorkoutDate: string | null,
  currentDate: string,
  currentStreak: number
): { newStreak: number; missedDays: number; shouldWarn: boolean } {
  if (!lastWorkoutDate) {
    return { newStreak: 1, missedDays: 0, shouldWarn: false };
  }

  const lastDate = new Date(lastWorkoutDate);
  const nowDate = new Date(currentDate);
  const diffTime = nowDate.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { newStreak: currentStreak, missedDays: 0, shouldWarn: false };
  }

  if (diffDays === 1) {
    return { newStreak: currentStreak + 1, missedDays: 0, shouldWarn: false };
  }

  const missedDays = diffDays - 1;
  const shouldWarn = missedDays >= 2;
  
  return {
    newStreak: 1,
    missedDays,
    shouldWarn
  };
}

export function calculateConsistencyScore(
  workoutCompleted: boolean,
  streak: number,
  weeklyActiveDays: number
): { basePoints: number; bonusPoints: number; totalPoints: number } {
  let basePoints = 0;
  let bonusPoints = 0;

  if (workoutCompleted) {
    basePoints = 10;
  }

  // Streak bonuses
  if (streak >= 3) bonusPoints += 5;
  if (streak >= 7) bonusPoints += 10;
  if (streak >= 14) bonusPoints += 20;

  // Weekly consistency bonuses
  if (weeklyActiveDays >= 5) bonusPoints += 15;
  if (weeklyActiveDays >= 6) bonusPoints += 20;
  if (weeklyActiveDays >= 7) bonusPoints += 30;

  return {
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints
  };
}

export function applyPenalty(
  currentScore: number,
  missedDays: number,
  currentTier: ConsistencyTier
): { newScore: number; shouldDemote: boolean } {
  let penalty = 0;
  
  if (missedDays === 1) {
    penalty = 5;
  } else if (missedDays >= 2) {
    penalty = missedDays * 5;
  }

  const newScore = Math.max(0, currentScore - penalty);
  const newTier = calculateTier(newScore);
  const shouldDemote = newTier.rank !== currentTier.rank || newTier.level !== currentTier.level;

  return {
    newScore,
    shouldDemote
  };
}

export function getWeeklyActivity(
  workoutDates: string[],
  weekStart: Date
): WeeklyActivity {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const activeDays = workoutDates.filter(date => {
    const workoutDate = new Date(date);
    return workoutDate >= weekStart && workoutDate <= weekEnd;
  }).length;

  const pointsEarned = calculateConsistencyScore(
    activeDays > 0,
    0,
    activeDays
  ).totalPoints;

  const weekKey = `${weekStart.toISOString().split('T')[0]}_${weekEnd.toISOString().split('T')[0]}`;

  return {
    week: weekKey,
    activeDays,
    pointsEarned
  };
}

export function getTierProgress(currentScore: number, currentTier: ConsistencyTier): {
  current: number;
  target: number;
  percentage: number;
} {
  const nextTier = getNextTier(currentScore);
  
  if (!nextTier) {
    return {
      current: currentScore,
      target: currentTier.threshold,
      percentage: 100
    };
  }

  const current = currentScore - currentTier.threshold;
  const target = nextTier.threshold - currentTier.threshold;
  const percentage = Math.min(100, (current / target) * 100);

  return {
    current,
    target,
    percentage
  };
}

export function createConsistencyHistoryEntry(
  date: string,
  pointsEarned: number,
  streak: number,
  tier: ConsistencyTier,
  activityType: 'workout' | 'streak_bonus' | 'weekly_bonus' | 'penalty'
): ConsistencyHistory {
  return {
    date,
    pointsEarned,
    streak,
    tier: `${tier.rank} ${tier.level}`,
    activityType
  };
}
