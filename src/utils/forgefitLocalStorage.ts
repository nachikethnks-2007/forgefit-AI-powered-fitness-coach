import type { AppState, BodyMeasurement, FoodEntry, ForgefitAlert, ForgefitWeeklyCheckin, WorkoutSession } from '@/types/fitness';

export const FORGEFIT_PROFILE_KEY = 'forgefit_profile';
export const FORGEFIT_WEIGHT_LOG_KEY = 'forgefit_weight_log';
export const FORGEFIT_MEASUREMENTS_LOG_KEY = 'forgefit_measurements_log';
export const FORGEFIT_FOOD_LOG_KEY = 'forgefit_food_log';
export const FORGEFIT_WORKOUT_SESSIONS_KEY = 'forgefit_workout_sessions';
export const FORGEFIT_WORKOUT_PLAN_KEY = 'forgefit_workout_plan';
export const FORGEFIT_ALERTS_KEY = 'forgefit_alerts';
export const FORGEFIT_WEEKLY_CHECKIN_KEY = 'forgefit_weekly_checkin';
export const FORGEFIT_SUNDAY_AI_KEY = 'forgefit_weekly_ai_week';

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
    localStorage.setItem(FORGEFIT_MEASUREMENTS_LOG_KEY, JSON.stringify(state.measurements));
    localStorage.setItem(FORGEFIT_FOOD_LOG_KEY, JSON.stringify(state.foodLog));
    localStorage.setItem(FORGEFIT_WORKOUT_SESSIONS_KEY, JSON.stringify(state.workoutSessions));
    localStorage.setItem(FORGEFIT_WORKOUT_PLAN_KEY, JSON.stringify(state.workoutPlan));
    localStorage.setItem(FORGEFIT_ALERTS_KEY, JSON.stringify(state.forgefitAlerts));
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

export function writeForgefitProfilePayload(payload: {
  profile: AppState['profile'];
  nutritionPlan: AppState['nutritionPlan'];
}): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FORGEFIT_PROFILE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function writeForgefitWeeklyCheckin(entry: ForgefitWeeklyCheckin): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FORGEFIT_WEEKLY_CHECKIN_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export function readForgefitWeeklyCheckin(): ForgefitWeeklyCheckin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FORGEFIT_WEEKLY_CHECKIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ForgefitWeeklyCheckin;
  } catch {
    return null;
  }
}

export function readForgefitAlertsFromLS(): ForgefitAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FORGEFIT_ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ---------------- DATA MIGRATION ---------------- */

export function migrateWorkoutPlanData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const raw = localStorage.getItem(FORGEFIT_WORKOUT_PLAN_KEY);
    if (!raw) return;
    
    const parsed = JSON.parse(raw) as unknown;
    
    // Check if data is already in correct format (array with proper exercise structure)
    if (Array.isArray(parsed)) {
      const isValidFormat = parsed.every((day: any) => 
        day.day && 
        day.focus && 
        Array.isArray(day.exercises) &&
        day.exercises.every((ex: any) => 
          ex.name && 
          ex.sets !== undefined && 
          ex.reps !== undefined && 
          ex.targetWeight !== undefined && 
          ex.muscleGroup
        )
      );
      
      if (isValidFormat) return; // Already in correct format
    }
    
    // Data is in old format - clear it and let user regenerate
    console.log('MIGRATION: Detected old workout plan format, clearing for regeneration');
    localStorage.removeItem(FORGEFIT_WORKOUT_PLAN_KEY);
    
  } catch (error) {
    console.log('MIGRATION: Error reading workout plan, clearing for regeneration');
    localStorage.removeItem(FORGEFIT_WORKOUT_PLAN_KEY);
  }
}
