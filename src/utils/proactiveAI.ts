import { useAppStore } from '@/store/useAppStore';
import { callGroqWithTools } from '@/services/groqClient';
import { applyNutritionTargetsUpdate } from '@/utils/aiTools';
import { calculateMacrosFromCaloriesAndMode, toKg } from '@/utils/calculations';
import {
  FORGEFIT_SUNDAY_AI_KEY,
  writeForgefitWeeklyCheckin,
} from '@/utils/forgefitLocalStorage';
import type { WorkoutSession } from '@/types/fitness';
import { getISOWeek, getISOWeekYear } from 'date-fns';

const PROACTIVE_LOCK_WEIGHT = 'forgefit_proactive_weight';

function hasApiKey(): boolean {
  return Boolean(useAppStore.getState().groqApiKey || localStorage.getItem('groqApiKey'));
}

/** ~1 kg/week loss threshold in user's weight unit */
function weeklyLossTooFast(weeklyDelta: number, units: 'metric' | 'imperial'): boolean {
  const lossPerWeek = -weeklyDelta;
  const threshold = units === 'metric' ? 1 : 2.20462;
  return lossPerWeek > threshold;
}

function weeklyGainTooFast(weeklyDelta: number, units: 'metric' | 'imperial'): boolean {
  const gainPerWeek = weeklyDelta;
  const threshold = units === 'metric' ? 0.5 : 1.10231;
  return gainPerWeek > threshold;
}

function lastFourWeeksWeightTrend(): string {
  const { measurements } = useAppStore.getState();
  const weeks = 4;
  const weeklyAvgs: number[] = [];
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < weeks; i++) {
    const weekStart = now - (i + 1) * msPerWeek;
    const weekEnd = now - i * msPerWeek;
    const weekMeasures = measurements.filter(
      (m) => m.timestamp >= weekStart && m.timestamp < weekEnd
    );
    if (weekMeasures.length > 0) {
      const avg = weekMeasures.reduce((sum, m) => sum + m.weight, 0) / weekMeasures.length;
      weeklyAvgs.unshift(avg);
    }
  }

  if (weeklyAvgs.length < 2) return 'Insufficient data';

  const deltas = weeklyAvgs.slice(1).map((avg, i) => avg - weeklyAvgs[i]);
  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  const units = useAppStore.getState().profile?.units || 'metric';

  let trend = '';
  if (avgDelta < -0.1) trend = '↓ losing';
  else if (avgDelta > 0.1) trend = '↑ gaining';
  else trend = '→ stable';

  const amount = Math.abs(avgDelta).toFixed(1);
  return `${trend} ${amount} ${units === 'metric' ? 'kg' : 'lbs'}/week`;
}

function formatTodayFoodTotals(): string {
  const { foodLog } = useAppStore.getState();
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = foodLog.filter((e) => e.date === today);
  const totals = todayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fats: acc.fats + e.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
  return `Today: ${totals.calories} kcal, ${totals.protein}g protein`;
}

function currentWeekKey(): string {
  const d = new Date();
  return `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
}

export async function runAfterWorkoutLogged(): Promise<void> {
  if (!hasApiKey()) return;
  const { profile, workoutSessions } = useAppStore.getState();
  if (!profile || workoutSessions.length === 0) return;

  // Only run if last workout was logged in last 5 minutes
  const lastWorkoutSession = workoutSessions[workoutSessions.length - 1];
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  if (lastWorkoutSession.timestamp < fiveMinutesAgo) {
    console.log('PROACTIVE: Skipping workout analysis - last workout was more than 5 minutes ago');
    return;
  }

  try {
    const exerciseSessions = lastThreeSessionsPerExercise(workoutSessions);
    const suggestions: Array<{exercise: string, suggestion: string, adjustment: string}> = [];
    
    exerciseSessions.forEach((sessions, exerciseName) => {
      if (sessions.length >= 2) {
        const analysis = analyzeExerciseProgress(sessions);
        if (analysis === 'increase') {
          suggestions.push({
            exercise: exerciseName, 
            suggestion: `Consider increasing weight for ${exerciseName} - you've been hitting all target reps consistently`,
            adjustment: 'increase'
          });
        } else if (analysis === 'decrease') {
          suggestions.push({
            exercise: exerciseName, 
            suggestion: `Consider decreasing weight for ${exerciseName} - you've been missing reps consistently`,
            adjustment: 'decrease'
          });
        }
      }
    });
    
    if (suggestions.length > 0) {
      // Create suggestion message asking for user confirmation
      const suggestionText = suggestions.map(s => s.suggestion).join('\n');
      
      useAppStore.getState().addForgefitAlert({
        id: `${Date.now()}_progressive`,
        type: 'suggestion',
        message: `Progressive Overload Suggestions:\n\n${suggestionText}\n\nTell me "increase intensity" or "decrease intensity" if you'd like me to apply these changes.`,
        read: false,
        createdAt: Date.now(),
      });
    }
  } catch {
    /* ignore proactive failures */
  }
}

function lastThreeSessionsPerExercise(sessions: WorkoutSession[]): Map<string, WorkoutSession[]> {
  const exerciseMap = new Map<string, WorkoutSession[]>();
  
  // Get last 12 sessions total
  const recentSessions = sessions.slice(-12);
  
  // Group by exercise name
  recentSessions.forEach(session => {
    session.exercises.forEach(exercise => {
      const name = exercise.name.toLowerCase().trim();
      if (!exerciseMap.has(name)) {
        exerciseMap.set(name, []);
      }
      exerciseMap.get(name)!.push({
        ...session,
        exercises: [exercise] // Only include this specific exercise
      });
    });
  });
  
  // Keep only last 3 sessions per exercise
  exerciseMap.forEach((sessionList, exerciseName) => {
    exerciseMap.set(exerciseName, sessionList.slice(-3));
  });
  
  return exerciseMap;
}

function analyzeExerciseProgress(sessions: WorkoutSession[]): 'increase' | 'decrease' | 'hold' {
  if (sessions.length < 2) return 'hold';
  
  const lastSession = sessions[sessions.length - 1];
  const previousSession = sessions[sessions.length - 2];
  
  const lastExercise = lastSession.exercises[0];
  const previousExercise = previousSession.exercises[0];
  
  // Check if user hit target reps in both sessions
  const lastHitTarget = lastExercise.sets.every((set: any) => set.reps >= Number(lastExercise.name.includes('reps') ? '10' : '8'));
  const previousHitTarget = previousExercise.sets.every((set: any) => set.reps >= Number(previousExercise.name.includes('reps') ? '10' : '8'));
  
  if (lastHitTarget && previousHitTarget) {
    return 'increase'; // Hit target reps 2 sessions in a row
  } else if (!lastHitTarget && !previousHitTarget) {
    return 'decrease'; // Failed reps 2 sessions in a row
  }
  
  return 'hold'; // Mixed results
}

export async function runAfterWeightLogged(): Promise<void> {
  if (!hasApiKey()) return;
  if (sessionStorage.getItem(PROACTIVE_LOCK_WEIGHT)) return;
  const { profile, measurements } = useAppStore.getState();
  if (!profile || measurements.length < 2) return;

  sessionStorage.setItem(PROACTIVE_LOCK_WEIGHT, '1');
  try {
    const recent = measurements.slice(-4);
    if (recent.length < 2) return;

    const latest = recent[recent.length - 1];
    const previous = recent[recent.length - 2];
    const daysDiff = (latest.timestamp - previous.timestamp) / (1000 * 60 * 60 * 24);
    const weightDelta = latest.weight - previous.weight;
    const weeklyDelta = (weightDelta / daysDiff) * 7;

    const units = profile.units;
    let shouldAdjust = false;
    let direction: 'increase' | 'decrease' = 'increase';
    let reason = '';

    if (profile.mode === 'cut') {
      if (weeklyLossTooFast(weeklyDelta, units)) {
        shouldAdjust = true;
        direction = 'increase';
        reason = 'Losing weight too fast';
      } else if (weightDelta > 0 && daysDiff < 7) {
        shouldAdjust = true;
        direction = 'decrease';
        reason = 'Weight trending up';
      }
    } else if (profile.mode === 'bulk') {
      if (weeklyGainTooFast(weeklyDelta, units)) {
        shouldAdjust = true;
        direction = 'decrease';
        reason = 'Gaining weight too fast';
      } else if (weightDelta < 0 && daysDiff < 7) {
        shouldAdjust = true;
        direction = 'increase';
        reason = 'Weight trending down';
      }
    }

    if (shouldAdjust) {
      const { nutritionPlan } = useAppStore.getState();
      if (!nutritionPlan) return;

      const pct = 5;
      const newCalories = Math.round(
        direction === 'increase'
          ? nutritionPlan.dailyCalories * (1 + pct / 100)
          : nutritionPlan.dailyCalories * (1 - pct / 100)
      );
      const macros = calculateMacrosFromCaloriesAndMode(newCalories, profile.mode);

      const userMsg = `My weight changed ${weightDelta.toFixed(1)} ${units === 'metric' ? 'kg' : 'lbs'} in ${Math.round(daysDiff)} days. ${reason}. Adjust my calories by ${pct}% and update macros accordingly.`;

      const { content, toolSummaries } = await callGroqWithTools([
        { role: 'user', content: userMsg },
      ]);

      if (toolSummaries.length) {
        useAppStore.getState().addForgefitAlert({
          id: `${Date.now()}_w`,
          type: 'suggestion',
          message: `Weight review: ${toolSummaries.join(' · ')}${content ? ` — ${content}` : ''}`,
          read: false,
          createdAt: Date.now(),
        });
      }
    }
  } catch {
    /* ignore proactive failures */
  } finally {
    sessionStorage.removeItem(PROACTIVE_LOCK_WEIGHT);
  }
}

export async function runSundayWeeklyCheckin(): Promise<void> {
  if (!hasApiKey()) return;
  const wk = currentWeekKey();
  if (localStorage.getItem(FORGEFIT_SUNDAY_AI_KEY) === wk) return;

  const { profile, nutritionPlan, foodLog, measurements } = useAppStore.getState();
  if (!profile || !nutritionPlan) return;

  localStorage.setItem(FORGEFIT_SUNDAY_AI_KEY, wk);

  try {
    const userMsg = `Run weekly check-in automatically. Review food logs and weight trend only. Do NOT analyze or suggest workout plan changes. Do NOT call any workout modification tools. Summarize wins, gaps, and next-week nutrition focus. Use nutrition tools only if necessary; otherwise respond with a clear markdown summary.`;

    const { content, toolSummaries } = await callGroqWithTools([{ role: 'user', content: userMsg }]);

    const summary = [toolSummaries.join('\n'), content].filter(Boolean).join('\n\n');
    writeForgefitWeeklyCheckin({
      summary: summary || 'Weekly check-in completed.',
      savedAt: new Date().toISOString(),
    });
  } catch {
    localStorage.removeItem(FORGEFIT_SUNDAY_AI_KEY);
  }
}
