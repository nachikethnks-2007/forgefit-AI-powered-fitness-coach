import type {
  Exercise,
  ForgefitAlertType,
  NutritionPlan,
  UserProfile,
  WorkoutDay,
  WorkoutPlan,
} from '@/types/fitness';
import { useAppStore } from '@/store/useAppStore';
import { calculateBodyFatPercent } from '@/utils/calculations';
import { writeForgefitProfilePayload, FORGEFIT_MEASUREMENTS_LOG_KEY } from '@/utils/forgefitLocalStorage';
import { getCachedExerciseById } from '@/services/wgerExerciseDb';

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
  {
    type: 'function',
    function: {
      name: 'replace_exercise',
      description:
        'Replace one exercise on a training day with a different movement from the wger database (same day label as in the current plan).',
      parameters: {
        type: 'object',
        properties: {
          day_label: { type: 'string', description: 'Day label e.g. Push Day (match current plan)' },
          old_exercise_name: { type: 'string' },
          wger_exercise_id: { type: 'number' },
          sets: { type: 'number' },
          reps: { type: 'number' },
          weight: { type: 'number', description: 'Target weight; 0 if unknown' },
          rest_seconds: { type: 'number' },
          form_tip: { type: 'string' },
          reason: { type: 'string' },
        },
        required: [
          'day_label',
          'old_exercise_name',
          'wger_exercise_id',
          'sets',
          'reps',
          'rest_seconds',
          'reason',
        ],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_exercise',
      description: 'Append an exercise from the wger database to an existing day in the workout plan.',
      parameters: {
        type: 'object',
        properties: {
          day_label: { type: 'string' },
          wger_exercise_id: { type: 'number' },
          sets: { type: 'number' },
          reps: { type: 'number' },
          weight: { type: 'number' },
          rest_seconds: { type: 'number' },
          form_tip: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['day_label', 'wger_exercise_id', 'sets', 'reps', 'rest_seconds', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_exercise',
      description: 'Remove an exercise by name from a day in the workout plan.',
      parameters: {
        type: 'object',
        properties: {
          day_label: { type: 'string' },
          exercise_name: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['day_label', 'exercise_name', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_exercise_volume',
      description: 'Change sets and/or reps for a named exercise on a given day.',
      parameters: {
        type: 'object',
        properties: {
          day_label: { type: 'string' },
          exercise_name: { type: 'string' },
          sets: { type: 'number', description: 'New set count (omit to leave unchanged)' },
          reps: { type: 'number', description: 'New rep target (omit to leave unchanged)' },
          reason: { type: 'string' },
        },
        required: ['day_label', 'exercise_name', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'change_workout_split',
      description:
        'Replace the entire weekly workout plan. weekly_plan_json must be a JSON array of {day,label,exercises:[{wger_exercise_id,sets,reps,weight?,rest_seconds,form_tip?}]}. All wger_exercise_id values must exist in the cached database.',
      parameters: {
        type: 'object',
        properties: {
          weekly_plan_json: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['weekly_plan_json', 'reason'],
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

  switch (functionName) {
    case 'update_nutrition_targets':
      return toolUpdateNutritionTargets(args);
    case 'update_body_stats':
      return toolUpdateBodyStats(args);
    case 'update_workout_intensity':
      return toolUpdateWorkoutIntensity(args);
    case 'flag_alert':
      return toolFlagAlert(args);
    case 'replace_exercise':
      return toolReplaceExercise(args);
    case 'add_exercise':
      return toolAddExercise(args);
    case 'remove_exercise':
      return toolRemoveExercise(args);
    case 'adjust_exercise_volume':
      return toolAdjustExerciseVolume(args);
    case 'change_workout_split':
      return toolChangeWorkoutSplit(args);
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

function cloneWorkoutPlan(p: WorkoutPlan): WorkoutPlan {
  return {
    generatedAt: p.generatedAt,
    weeklyPlan: p.weeklyPlan.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => ({ ...e })),
    })),
  };
}

function findDayRef(plan: WorkoutPlan, day_label: string): WorkoutDay | null {
  const L = day_label.trim().toLowerCase();
  return (
    plan.weeklyPlan.find(
      (d) => d.label.trim().toLowerCase() === L || d.day.trim().toLowerCase() === L
    ) ?? null
  );
}

function commitWorkoutPlanFromWeekly(weeklyPlan: WorkoutDay[], summary: string): ToolExecutionResult {
  useAppStore.getState().setWorkoutPlan({ weeklyPlan, generatedAt: Date.now() });
  return { ok: true, summary };
}

function buildExerciseFromWger(
  wgerId: number,
  sets: number,
  reps: number,
  restSeconds: number,
  weight?: number,
  formTip?: string
): Exercise | null {
  const c = getCachedExerciseById(wgerId);
  if (!c) return null;
  return {
    name: c.name,
    sets: Math.round(sets),
    reps: Math.round(reps),
    weight: weight !== undefined && Number.isFinite(weight) ? weight : undefined,
    restSeconds: Math.round(restSeconds),
    formTip:
      formTip ||
      `${c.category} · ${c.difficulty} · ${c.equipment.slice(0, 3).join(', ') || 'wger'}`,
    wgerExerciseId: c.id,
  };
}

function toolReplaceExercise(args: Record<string, unknown>): ToolExecutionResult {
  const { workoutPlan } = useAppStore.getState();
  if (!workoutPlan) return { ok: false, summary: 'No workout plan.' };
  const day_label = String(args.day_label ?? '');
  const oldName = String(args.old_exercise_name ?? '');
  const wgerId = Number(args.wger_exercise_id);
  const sets = Number(args.sets);
  const reps = Number(args.reps);
  const weight = args.weight !== undefined && args.weight !== null ? Number(args.weight) : undefined;
  const rest_seconds = Number(args.rest_seconds);
  const form_tip = args.form_tip != null ? String(args.form_tip) : undefined;
  const reason = String(args.reason ?? '');

  const next = cloneWorkoutPlan(workoutPlan);
  const day = findDayRef(next, day_label);
  if (!day) return { ok: false, summary: `Day "${day_label}" not found.` };
  const idx = day.exercises.findIndex((e) => e.name.trim().toLowerCase() === oldName.trim().toLowerCase());
  if (idx < 0) return { ok: false, summary: `Exercise "${oldName}" not found on that day.` };
  const built = buildExerciseFromWger(wgerId, sets, reps, rest_seconds, weight, form_tip);
  if (!built) return { ok: false, summary: `Unknown wger_exercise_id ${wgerId} (refresh exercise DB?).` };
  day.exercises[idx] = built;
  return commitWorkoutPlanFromWeekly(
    next.weeklyPlan,
    `Replaced "${oldName}" with "${built.name}" (wger ${wgerId}). ${reason}`
  );
}

function toolAddExercise(args: Record<string, unknown>): ToolExecutionResult {
  const { workoutPlan } = useAppStore.getState();
  if (!workoutPlan) return { ok: false, summary: 'No workout plan.' };
  const day_label = String(args.day_label ?? '');
  const wgerId = Number(args.wger_exercise_id);
  const sets = Number(args.sets);
  const reps = Number(args.reps);
  const weight = args.weight !== undefined && args.weight !== null ? Number(args.weight) : undefined;
  const rest_seconds = Number(args.rest_seconds);
  const form_tip = args.form_tip != null ? String(args.form_tip) : undefined;
  const reason = String(args.reason ?? '');

  const next = cloneWorkoutPlan(workoutPlan);
  const day = findDayRef(next, day_label);
  if (!day) return { ok: false, summary: `Day "${day_label}" not found.` };
  const built = buildExerciseFromWger(wgerId, sets, reps, rest_seconds, weight, form_tip);
  if (!built) return { ok: false, summary: `Unknown wger_exercise_id ${wgerId}.` };
  day.exercises.push(built);
  return commitWorkoutPlanFromWeekly(next.weeklyPlan, `Added "${built.name}" to ${day.label}. ${reason}`);
}

function toolRemoveExercise(args: Record<string, unknown>): ToolExecutionResult {
  const { workoutPlan } = useAppStore.getState();
  if (!workoutPlan) return { ok: false, summary: 'No workout plan.' };
  const day_label = String(args.day_label ?? '');
  const exercise_name = String(args.exercise_name ?? '');
  const reason = String(args.reason ?? '');

  const next = cloneWorkoutPlan(workoutPlan);
  const day = findDayRef(next, day_label);
  if (!day) return { ok: false, summary: `Day "${day_label}" not found.` };
  const before = day.exercises.length;
  day.exercises = day.exercises.filter(
    (e) => e.name.trim().toLowerCase() !== exercise_name.trim().toLowerCase()
  );
  if (day.exercises.length === before) {
    return { ok: false, summary: `Exercise "${exercise_name}" not found on that day.` };
  }
  return commitWorkoutPlanFromWeekly(next.weeklyPlan, `Removed "${exercise_name}" from ${day.label}. ${reason}`);
}

function toolAdjustExerciseVolume(args: Record<string, unknown>): ToolExecutionResult {
  const { workoutPlan } = useAppStore.getState();
  if (!workoutPlan) return { ok: false, summary: 'No workout plan.' };
  const day_label = String(args.day_label ?? '');
  const exercise_name = String(args.exercise_name ?? '');
  const reason = String(args.reason ?? '');
  const hasSets = args.sets !== undefined && args.sets !== null;
  const hasReps = args.reps !== undefined && args.reps !== null;
  if (!hasSets && !hasReps) return { ok: false, summary: 'Provide sets and/or reps to change.' };

  const next = cloneWorkoutPlan(workoutPlan);
  const day = findDayRef(next, day_label);
  if (!day) return { ok: false, summary: `Day "${day_label}" not found.` };
  const ex = day.exercises.find((e) => e.name.trim().toLowerCase() === exercise_name.trim().toLowerCase());
  if (!ex) return { ok: false, summary: `Exercise "${exercise_name}" not found.` };
  if (hasSets) ex.sets = Math.round(Number(args.sets));
  if (hasReps) ex.reps = Math.round(Number(args.reps));
  return commitWorkoutPlanFromWeekly(
    next.weeklyPlan,
    `Updated volume for "${exercise_name}" (${ex.sets}x${ex.reps}). ${reason}`
  );
}

type SplitExerciseIn = {
  wger_exercise_id: number;
  sets: number;
  reps: number;
  weight?: number;
  rest_seconds: number;
  form_tip?: string;
};

type SplitDayIn = {
  day: string;
  label: string;
  exercises: SplitExerciseIn[];
};

function toolChangeWorkoutSplit(args: Record<string, unknown>): ToolExecutionResult {
  const raw = String(args.weekly_plan_json ?? '');
  const reason = String(args.reason ?? '');
  let parsed: SplitDayIn[];
  try {
    parsed = JSON.parse(raw) as SplitDayIn[];
  } catch {
    return { ok: false, summary: 'Invalid weekly_plan_json (must be JSON array).' };
  }
  if (!Array.isArray(parsed) || !parsed.length) {
    return { ok: false, summary: 'weekly_plan_json must be a non-empty array of days.' };
  }

  const weeklyPlan: WorkoutDay[] = [];
  for (const d of parsed) {
    if (!d || typeof d.day !== 'string' || typeof d.label !== 'string' || !Array.isArray(d.exercises)) {
      return { ok: false, summary: 'Each day needs string day, label, and exercises array.' };
    }
    const exercises: Exercise[] = [];
    for (const ex of d.exercises) {
      const built = buildExerciseFromWger(
        Number(ex.wger_exercise_id),
        Number(ex.sets),
        Number(ex.reps),
        Number(ex.rest_seconds),
        ex.weight !== undefined ? Number(ex.weight) : undefined,
        ex.form_tip
      );
      if (!built) {
        return { ok: false, summary: `Unknown wger_exercise_id ${ex.wger_exercise_id} in split.` };
      }
      exercises.push(built);
    }
    weeklyPlan.push({ day: d.day, label: d.label, exercises });
  }

  return commitWorkoutPlanFromWeekly(
    weeklyPlan,
    `Workout split replaced (${weeklyPlan.length} days). ${reason}`
  );
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
