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

const PROACTIVE_LOCK_WORKOUT = 'forgefit_proactive_workout';
const PROACTIVE_LOCK_WEIGHT = 'forgefit_proactive_weight';

function hasApiKey(): boolean {
  return Boolean(useAppStore.getState().groqApiKey || localStorage.getItem('groqApiKey'));
}

function lastThreeSessionsForOverlap(sessions: WorkoutSession[]): WorkoutSession[] {
  const last3 = sessions.slice(-3);
  const names = new Set<string>();
  last3.forEach((s) => s.exercises.forEach((e) => names.add(e.name.toLowerCase())));
  const relevant = sessions.filter((s) => s.exercises.some((e) => names.has(e.name.toLowerCase())));
  return relevant.slice(-12);
}

export async function runAfterWorkoutLogged(): Promise<void> {
  if (!hasApiKey()) return;
  if (sessionStorage.getItem(PROACTIVE_LOCK_WORKOUT)) return;
  const { profile, nutritionPlan, workoutSessions } = useAppStore.getState();
  if (!profile || !nutritionPlan || workoutSessions.length === 0) return;

  sessionStorage.setItem(PROACTIVE_LOCK_WORKOUT, '1');
  try {
    const subset = lastThreeSessionsForOverlap(workoutSessions);
    const userMsg = `You are running automatically after the user logged a workout. Review these recent sessions (focus on the last 3 and same exercise names). Decide if target weights should increase, decrease, hold, or deload. Call update_workout_intensity when appropriate with clear percentage and affected_exercises. Call flag_alert to summarize for the user.

Sessions JSON:
${JSON.stringify(subset.slice(-8))}`;

    const { content, toolSummaries } = await callGroqWithTools([
      { role: 'user', content: userMsg },
    ]);

    if (toolSummaries.length) {
      const line = toolSummaries.join(' · ');
      useAppStore.getState().addForgefitAlert({
        id: `${Date.now()}_w`,
        type: 'suggestion',
        message: `Workout review: ${line}${content ? ` — ${content}` : ''}`,
        read: false,
        createdAt: Date.now(),
      });
    }
  } catch {
    /* ignore proactive failures */
  } finally {
    sessionStorage.removeItem(PROACTIVE_LOCK_WORKOUT);
  }
}

/** ~1 kg/week loss threshold in user's weight unit */
function weeklyLossTooFast(weeklyDelta: number, units: 'metric' | 'imperial'): boolean {
  const lossPerWeek = -weeklyDelta;
  const threshold = units === 'metric' ? 1 : 2.20462;
  return lossPerWeek > threshold;
}

function weeklyGainTooFast(weeklyDelta: number, units: 'metric' | 'imperial'): boolean {
  const threshold = units === 'metric' ? 0.5 : 1.10231;
  return weeklyDelta > threshold;
}

function avgWeeklyDelta(measurements: { date: string; weight: number }[]): number | null {
  if (measurements.length < 2) return null;
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const t0 = new Date(first.date + 'T12:00:00').getTime();
  const t1 = new Date(last.date + 'T12:00:00').getTime();
  const weeks = (t1 - t0) / (7 * 86400000);
  if (weeks < 0.5) return null;
  return (last.weight - first.weight) / weeks;
}

export function runAfterWeightLogged(): void {
  if (sessionStorage.getItem(PROACTIVE_LOCK_WEIGHT)) return;
  const { profile, nutritionPlan, measurements } = useAppStore.getState();
  if (!profile || !nutritionPlan || measurements.length < 2) return;

  sessionStorage.setItem(PROACTIVE_LOCK_WEIGHT, '1');
  try {
    const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
    const now = new Date();
    const twoWeeksAgoStr = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0];

    const delta = avgWeeklyDelta(sorted.slice(-8));
    if (delta == null) {
      sessionStorage.removeItem(PROACTIVE_LOCK_WEIGHT);
      return;
    }

    const wKg = toKg(profile.weight, profile.units);
    let changed = false;

    if (profile.mode === 'cut') {
      if (weeklyLossTooFast(delta, profile.units)) {
        const nc = nutritionPlan.dailyCalories + 200;
        const m = calculateMacrosFromCaloriesAndMode(nc, profile.mode, wKg);
        applyNutritionTargetsUpdate({
          calories: nc,
          protein: m.protein,
          carbs: m.carbs,
          fats: m.fats,
          reason: 'Auto: weight dropping faster than ~1kg/lb per week — added 200 kcal to protect lean mass.',
        });
        changed = true;
      } else {
        const window = sorted.filter((m) => m.date >= twoWeeksAgoStr);
        if (window.length >= 2) {
          const w0 = window[0].weight;
          const w1 = window[window.length - 1].weight;
          const tol = profile.units === 'metric' ? 0.25 : 0.5;
          if (w1 >= w0 - tol) {
            const nc = Math.max(800, nutritionPlan.dailyCalories - 150);
            const m = calculateMacrosFromCaloriesAndMode(nc, profile.mode, wKg);
            applyNutritionTargetsUpdate({
              calories: nc,
              protein: m.protein,
              carbs: m.carbs,
              fats: m.fats,
              reason: 'Auto: little/no loss over ~2 weeks on a cut — reduced calories by 150.',
            });
            changed = true;
          }
        }
      }
    }

    if (profile.mode === 'bulk' && weeklyGainTooFast(delta, profile.units)) {
      const nc = Math.max(nutritionPlan.tdee - 200, nutritionPlan.dailyCalories - 200);
      const m = calculateMacrosFromCaloriesAndMode(nc, profile.mode, wKg);
      applyNutritionTargetsUpdate({
        calories: nc,
        protein: m.protein,
        carbs: m.carbs,
        fats: m.fats,
        reason: 'Auto: gaining faster than ~0.5 kg/week — trimmed surplus by ~200 kcal.',
      });
      changed = true;
    }

    if (changed) {
      useAppStore.getState().addForgefitAlert({
        id: `${Date.now()}_wt`,
        type: 'suggestion',
        message: 'Nutrition targets were auto-adjusted from your latest weigh-in trend. Open AI Coach for details.',
        read: false,
        createdAt: Date.now(),
      });
    }
  } finally {
    sessionStorage.removeItem(PROACTIVE_LOCK_WEIGHT);
  }
}

function currentWeekKey(): string {
  const d = new Date();
  return `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
}

export async function runSundayWeeklyCheckin(): Promise<void> {
  if (!hasApiKey()) return;
  const wk = currentWeekKey();
  if (localStorage.getItem(FORGEFIT_SUNDAY_AI_KEY) === wk) return;

  const { profile, nutritionPlan, foodLog, workoutSessions, measurements } = useAppStore.getState();
  if (!profile || !nutritionPlan) return;

  localStorage.setItem(FORGEFIT_SUNDAY_AI_KEY, wk);

  try {
    const userMsg = `Run the weekly check-in automatically. Review the full week: food logs, workouts, and weight trend. Summarize wins, gaps, and next-week focus. Use tools only if you must change targets or flag alerts; otherwise respond with a clear markdown summary.`;

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
