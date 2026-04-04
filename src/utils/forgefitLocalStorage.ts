import type { AppState, BodyMeasurement, FoodEntry, WorkoutSession } from '@/types/fitness';

export const FORGEFIT_PROFILE_KEY = 'forgefit_profile';
export const FORGEFIT_WEIGHT_LOG_KEY = 'forgefit_weight_log';
export const FORGEFIT_FOOD_LOG_KEY = 'forgefit_food_log';
export const FORGEFIT_WORKOUT_SESSIONS_KEY = 'forgefit_workout_sessions';

/** Mirror profile-related slices to named keys for charts and external tooling. */
export function syncForgefitLocalStorage(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      FORGEFIT_PROFILE_KEY,
      JSON.stringify({
        profile: state.profile,
        nutritionPlan: state.nutritionPlan,
      })
    );
    localStorage.setItem(FORGEFIT_WEIGHT_LOG_KEY, JSON.stringify(state.measurements));
    localStorage.setItem(FORGEFIT_FOOD_LOG_KEY, JSON.stringify(state.foodLog));
    localStorage.setItem(FORGEFIT_WORKOUT_SESSIONS_KEY, JSON.stringify(state.workoutSessions));
  } catch {
    /* quota / private mode */
  }
}

export function readForgefitWeightLog(): BodyMeasurement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FORGEFIT_WEIGHT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readForgefitFoodLog(): FoodEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FORGEFIT_FOOD_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readForgefitWorkoutSessions(): WorkoutSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FORGEFIT_WORKOUT_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readForgefitProfilePayload(): {
  profile: AppState['profile'];
  nutritionPlan: AppState['nutritionPlan'];
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FORGEFIT_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { profile: AppState['profile']; nutritionPlan: AppState['nutritionPlan'] };
  } catch {
    return null;
  }
}
