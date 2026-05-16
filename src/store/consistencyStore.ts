import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ConsistencyState,
  ConsistencyTier,
  ConsistencyHistory,
  WeeklyActivity,
  TIER_THRESHOLDS,
} from '@/types/consistency';
import {
  calculateTier,
  updateStreak,
  calculateConsistencyScore,
  applyPenalty,
  getWeeklyActivity,
  getTierProgress,
  createConsistencyHistoryEntry,
} from '@/utils/consistencyLogic';

interface ConsistencyStore extends ConsistencyState {
  recordWorkout: (date: string) => void;
  applyDailyPenalty: (date: string) => void;
  updateWeeklyActivity: (workoutDates: string[]) => void;
  resetConsistency: () => void;
  getTierProgress: () => { current: number; target: number; percentage: number };
  getNextTier: () => ConsistencyTier | null;
}

const initialState: ConsistencyState = {
  currentTier: TIER_THRESHOLDS[0],
  progressScore: 0,
  streak: 0,
  weeklyActivity: [],
  lastWorkoutDate: null,
  consistencyHistory: [],
  totalWorkouts: 0,
  longestStreak: 0,
  missedDays: 0,
  lastPenaltyDate: null,
};

export const useConsistencyStore = create<ConsistencyStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      recordWorkout: (date: string) => {
        const state = get();
        const { newStreak, missedDays, shouldWarn } = updateStreak(
          state.lastWorkoutDate,
          date,
          state.streak
        );

        // Apply penalty if there were missed days
        let newScore = state.progressScore;
        let currentTier = state.currentTier;

        if (missedDays > 0) {
          const penaltyResult = applyPenalty(state.progressScore, missedDays, state.currentTier);
          newScore = penaltyResult.newScore;
          currentTier = calculateTier(newScore);
          
          // Add penalty to history
          const penaltyHistory = createConsistencyHistoryEntry(
            date,
            -penaltyResult.newScore + state.progressScore,
            newStreak,
            currentTier,
            'penalty'
          );
          
          set({
            missedDays,
            lastPenaltyDate: date,
            consistencyHistory: [penaltyHistory, ...state.consistencyHistory].slice(0, 100),
          });
        }

        // Calculate points for workout completion
        const weeklyActiveDays = getWeeklyActivity(
          [...state.consistencyHistory.map(h => h.date), date],
          new Date(date)
        ).activeDays;

        const { totalPoints, basePoints, bonusPoints } = calculateConsistencyScore(
          true,
          newStreak,
          weeklyActiveDays
        );

        newScore = Math.max(0, newScore + totalPoints);
        const newTier = calculateTier(newScore);
        const newLongestStreak = Math.max(state.longestStreak, newStreak);

        // Create history entry
        const historyEntry = createConsistencyHistoryEntry(
          date,
          totalPoints,
          newStreak,
          newTier,
          'workout'
        );

        set({
          progressScore: newScore,
          currentTier: newTier,
          streak: newStreak,
          lastWorkoutDate: date,
          totalWorkouts: state.totalWorkouts + 1,
          longestStreak: newLongestStreak,
          consistencyHistory: [historyEntry, ...state.consistencyHistory].slice(0, 100),
        });
      },

      applyDailyPenalty: (date: string) => {
        const state = get();
        
        if (!state.lastWorkoutDate) return;

        const lastDate = new Date(state.lastWorkoutDate);
        const nowDate = new Date(date);
        const diffTime = nowDate.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
          const missedDays = diffDays - 1;
          const { newScore, shouldDemote } = applyPenalty(
            state.progressScore,
            missedDays,
            state.currentTier
          );

          const newTier = calculateTier(newScore);
          const newStreak = 0;

          const penaltyHistory = createConsistencyHistoryEntry(
            date,
            state.progressScore - newScore,
            newStreak,
            newTier,
            'penalty'
          );

          set({
            progressScore: newScore,
            currentTier: newTier,
            streak: newStreak,
            missedDays,
            lastPenaltyDate: date,
            consistencyHistory: [penaltyHistory, ...state.consistencyHistory].slice(0, 100),
          });
        }
      },

      updateWeeklyActivity: (workoutDates: string[]) => {
        const state = get();
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());

        const weeklyActivity = getWeeklyActivity(workoutDates, weekStart);

        // Update or add this week's activity
        const existingIndex = state.weeklyActivity.findIndex(
          wa => wa.week === weeklyActivity.week
        );

        let newWeeklyActivity: WeeklyActivity[];

        if (existingIndex >= 0) {
          newWeeklyActivity = [...state.weeklyActivity];
          newWeeklyActivity[existingIndex] = weeklyActivity;
        } else {
          newWeeklyActivity = [weeklyActivity, ...state.weeklyActivity].slice(0, 12);
        }

        set({ weeklyActivity: newWeeklyActivity });
      },

      resetConsistency: () => {
        set(initialState);
      },

      getTierProgress: () => {
        const state = get();
        return getTierProgress(state.progressScore, state.currentTier);
      },

      getNextTier: () => {
        const state = get();
        const currentIndex = TIER_THRESHOLDS.findIndex(
          tier => state.progressScore < tier.threshold
        );
        
        if (currentIndex === -1) {
          return null;
        }
        
        return TIER_THRESHOLDS[currentIndex];
      },
    }),
    {
      name: 'forgefit-consistency-storage',
    }
  )
);
