import type { Exercise, ForgefitAlertType, NutritionPlan, UserProfile, WorkoutPlan } from '@/types/fitness';
import { useAppStore } from '@/store/useAppStore';
import { calculateBodyFatPercent } from '@/utils/calculations';
import { writeForgefitProfilePayload, FORGEFIT_MEASUREMENTS_LOG_KEY } from '@/utils/forgefitLocalStorage';

export const FORGEFIT_GROQ_TOOLS: Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: 'function',
    function: {
      name: 'update_nutrition_targets',
      description:
        'Update daily calorie and macro targets in the app and forgefit_profile. Use when nutrition needs to change based on progress.',
      parameters: {
        type: 'object',
        properties: {
          calories: { type: 'number', description: 'Daily calorie target (kcal)' },
          protein: { type: 'number', description: 'Daily protein (g)' },
          carbs: { type: 'number', description: 'Daily carbs (g)' },
          fats: { type: 'number', description: 'Daily fats (g)' },
          reason: { type: 'string', description: 'Short reason for the user' },
        },
        required: ['calories', 'protein', 'carbs', 'fats', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_body_stats',
      description:
        'Update weight and/or circumference measurements. Recalculates body fat with US Navy formula, logs to forgefit_measurements_log, updates profile and forgefit_profile.',
      parameters: {
        type: 'object',
        properties: {
          weight: { type: 'number', description: 'Body weight in user units (kg or lbs)' },
          neck: { type: 'number', description: 'Neck circumference in user units' },
          waist: { type: 'number', description: 'Waist circumference in user units' },
          hip: { type: 'number', description: 'Hip circumference (female); use 0 if N/A' },
          reason: { type: 'string', description: 'Why these values are being set' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_workout_intensity',
      description:
        'Adjust target weights in the saved workout plan (forgefit_workout_plan). Use after reviewing logged sessions.',
      parameters: {
        type: 'object',
        properties: {
          adjustment: {
            type: 'string',
            enum: ['increase', 'decrease', 'hold', 'deload'],
            description: 'How to adjust loads',
          },
          percentage: {
            type: 'number',
            description: 'Percent change to apply (e.g. 5 for 5%). For deload, use 10–20 if unsure.',
          },
          affected_exercises: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exercise names to change; empty array = all exercises in the plan',
          },
          reason: { type: 'string' },
        },
        required: ['adjustment', 'percentage', 'affected_exercises', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_alert',
      description: 'Surface an insight, warning, or success to the user on the dashboard.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['warning', 'success', 'suggestion'] },
          message: { type: 'string' },
        },
        required: ['type', 'message'],
      },
    },
  },
];

export interface ToolExecutionResult {
  ok: boolean;
  summary: string;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function persistMeasurementsLogFromStore(): void {
  if (typeof window === 'undefined') return;
  try {
    const m = useAppStore.getState().measurements;
    localStorage.setItem(FORGEFIT_MEASUREMENTS_LOG_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

function syncProfileToLS(profile: UserProfile | null, plan: NutritionPlan | null): void {
  if (!profile || !plan) return;
  writeForgefitProfilePayload({ profile, nutritionPlan: plan });
}

export function executeForgefitTool(functionName: string, argumentsJson: string): ToolExecutionResult {
  const args = parseArgs(argumentsJson);
  const store = useAppStore.getState();

  switch (functionName) {
    case 'update_nutrition_targets':
      return toolUpdateNutritionTargets(args);
    case 'update_body_stats':
      return toolUpdateBodyStats(args);
    case 'update_workout_intensity':
      return toolUpdateWorkoutIntensity(args);
    case 'flag_alert':
      return toolFlagAlert(args);
    default:
      return { ok: false, summary: `Unknown tool: ${functionName}` };
  }
}

function toolUpdateNutritionTargets(args: Record<string, unknown>): ToolExecutionResult {
  const calories = Number(args.calories);
  const protein = Number(args.protein);
  const carbs = Number(args.carbs);
  const fats = Number(args.fats);
  const reason = String(args.reason ?? '');
  const { profile, nutritionPlan, setNutritionPlan } = useAppStore.getState();
  if (!profile || !nutritionPlan) {
    return { ok: false, summary: 'No active profile or nutrition plan.' };
  }
  if ([calories, protein, carbs, fats].some((n) => !Number.isFinite(n))) {
    return { ok: false, summary: 'Invalid macro numbers.' };
  }
  const next: NutritionPlan = {
    ...nutritionPlan,
    dailyCalories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
  };
  setNutritionPlan(next);
  syncProfileToLS(profile, next);
  return {
    ok: true,
    summary: `Nutrition targets → ${next.dailyCalories} kcal, P${next.protein}/C${next.carbs}/F${next.fats}g. ${reason}`,
  };
}

function toolUpdateBodyStats(args: Record<string, unknown>): ToolExecutionResult {
  const reason = String(args.reason ?? '');
  const { profile, nutritionPlan, setProfile, addMeasurement } = useAppStore.getState();
  if (!profile || !nutritionPlan) {
    return { ok: false, summary: 'No active profile or nutrition plan.' };
  }

  const weight = args.weight !== undefined && args.weight !== null ? Number(args.weight) : profile.weight;
  const neck = args.neck !== undefined && args.neck !== null ? Number(args.neck) : profile.neck;
  const waist = args.waist !== undefined && args.waist !== null ? Number(args.waist) : profile.waist;
  const hipRaw = args.hip !== undefined && args.hip !== null ? Number(args.hip) : profile.hip;

  if (!Number.isFinite(weight) || !Number.isFinite(neck) || !Number.isFinite(waist)) {
    return { ok: false, summary: 'Invalid body measurements.' };
  }

  const hip = profile.sex === 'female' ? hipRaw : profile.hip;
  const updatedProfile: UserProfile = {
    ...profile,
    weight,
    neck,
    waist,
    hip: profile.sex === 'female' ? hip : profile.hip,
  };

  const bf = calculateBodyFatPercent(
    updatedProfile.sex,
    updatedProfile.height,
    updatedProfile.neck,
    updatedProfile.waist,
    updatedProfile.hip,
    updatedProfile.units
  );

  const today = new Date().toISOString().split('T')[0];
  const entry = {
    date: today,
    weight,
    neck,
    waist,
    hip: updatedProfile.hip,
    bodyFatPercent: bf,
    timestamp: Date.now(),
  };

  setProfile(updatedProfile);
  addMeasurement(entry);
  persistMeasurementsLogFromStore();

  const after = useAppStore.getState().nutritionPlan;
  if (after) syncProfileToLS(updatedProfile, after);

  return {
    ok: true,
    summary: `Body stats updated (weight ${weight}, Navy BF ~${bf}%). ${reason}`,
  };
}

function applyIntensityToPlan(
  plan: WorkoutPlan,
  adjustment: string,
  percentage: number,
  affected: string[]
): WorkoutPlan {
  const names = new Set(affected.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const all = names.size === 0;

  let mult = 1;
  if (adjustment === 'hold') mult = 1;
  else if (adjustment === 'increase') mult = 1 + percentage / 100;
  else if (adjustment === 'decrease' || adjustment === 'deload') mult = Math.max(0.5, 1 - percentage / 100);

  const bump = (ex: Exercise): Exercise => {
    const match = all || names.has(ex.name.trim().toLowerCase());
    if (!match || adjustment === 'hold') return ex;
    const w = ex.weight ?? 0;
    const nextW = w > 0 ? Math.round(w * mult * 10) / 10 : w;
    return { ...ex, weight: nextW };
  };

  return {
    ...plan,
    generatedAt: plan.generatedAt,
    weeklyPlan: plan.weeklyPlan.map((d) => ({
      ...d,
      exercises: d.exercises.map(bump),
    })),
  };
}

function toolUpdateWorkoutIntensity(args: Record<string, unknown>): ToolExecutionResult {
  const adjustment = String(args.adjustment ?? 'hold');
  const pct = Number(args.percentage ?? 0);
  const affected_exercises = Array.isArray(args.affected_exercises)
    ? (args.affected_exercises as unknown[]).map((x) => String(x))
    : [];
  const reason = String(args.reason ?? '');
  const { workoutPlan, setWorkoutPlan } = useAppStore.getState();
  if (!workoutPlan) {
    return { ok: false, summary: 'No workout plan to adjust.' };
  }
  const percentage = Number.isFinite(pct) ? Math.abs(pct) : 5;
  const next = applyIntensityToPlan(workoutPlan, adjustment, percentage, affected_exercises);
  setWorkoutPlan(next);
  return {
    ok: true,
    summary: `Workout intensity: ${adjustment} ~${percentage}% on ${affected_exercises.length ? affected_exercises.join(', ') : 'all plan lifts'}. ${reason}`,
  };
}

function toolFlagAlert(args: Record<string, unknown>): ToolExecutionResult {
  const type = String(args.type ?? 'suggestion') as ForgefitAlertType;
  const message = String(args.message ?? '');
  if (!message) return { ok: false, summary: 'Empty alert message.' };
  const allowed: ForgefitAlertType[] = ['warning', 'success', 'suggestion'];
  const t = allowed.includes(type) ? type : 'suggestion';
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  useAppStore.getState().addForgefitAlert({ id, type: t, message, read: false, createdAt: Date.now() });
  return { ok: true, summary: `Alert [${t}]: ${message}` };
}

/** Direct calls from proactive rules (same persistence as tool). */
export function applyNutritionTargetsUpdate(partial: {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  reason: string;
}): ToolExecutionResult {
  return toolUpdateNutritionTargets({
    calories: partial.calories,
    protein: partial.protein,
    carbs: partial.carbs,
    fats: partial.fats,
    reason: partial.reason,
  });
}
