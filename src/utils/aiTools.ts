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

/* ---------------- TOOLS ---------------- */

export const FORGEFIT_GROQ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_workout_intensity',
      description: 'Adjust workout weights',
      parameters: {
        type: 'object',
        properties: {
          adjustment: { type: 'string' },
          percentage: { type: 'number' },
          affected_exercises: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['adjustment', 'percentage', 'affected_exercises', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_exercise',
      description: 'Replace exercise using name only (no DB)',
      parameters: {
        type: 'object',
        properties: {
          day_label: { type: 'string' },
          old_exercise_name: { type: 'string' },
          exercise_name: { type: 'string' },
          sets: { type: 'number' },
          reps: { type: 'number' },
          weight: { type: 'number' },
          rest_seconds: { type: 'number' },
          form_tip: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['day_label', 'old_exercise_name', 'exercise_name', 'sets', 'reps', 'rest_seconds', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'change_workout_split',
      description: 'Change full workout split using exercise names only',
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

/* ---------------- CORE ---------------- */

export interface ToolExecutionResult {
  ok: boolean;
  summary: string;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

/* ---------------- HELPERS ---------------- */

function buildExercise(
  name: string,
  sets: number,
  reps: string,
  targetWeight: number,
  muscleGroup: string,
  restSeconds?: number,
  formTip?: string
): Exercise {
  return {
    name,
    sets,
    reps,
    targetWeight,
    muscleGroup,
    restSeconds: restSeconds || 90,
    formTip: formTip || 'Focus on form',
  };
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

function findDay(plan: WorkoutPlan, label: string): WorkoutDay | null {
  const normalizedLabel = label.trim().toLowerCase();
  return plan.weeklyPlan.find(d => d.focus.trim().toLowerCase() === normalizedLabel) || null;
}

function commit(plan: WorkoutPlan, summary: string): ToolExecutionResult {
  useAppStore.getState().setWorkoutPlan(plan);
  return { ok: true, summary };
}

/* ---------------- TOOL EXECUTION ---------------- */

export function executeForgefitTool(name: string, argsJson: string): ToolExecutionResult {
  const args = parseArgs(argsJson);

  switch (name) {
    case 'update_workout_intensity':
      return updateIntensity(args);
    case 'replace_exercise':
      return replaceExercise(args);
    case 'change_workout_split':
      return changeSplit(args);
    default:
      return { ok: false, summary: 'Unknown tool' };
  }
}

/* ---------------- TOOLS ---------------- */

function updateIntensity(args: any): ToolExecutionResult {
  const { workoutPlan } = useAppStore.getState();
  console.log('DEBUG: localStorage workout plan structure:', JSON.stringify(localStorage.getItem('forgefit_workout_plan'), null, 2));
  console.log('DEBUG: current workoutPlan from store:', JSON.stringify(workoutPlan, null, 2));
  if (!workoutPlan) return { ok: false, summary: 'No plan' };

  const next = cloneWorkoutPlan(workoutPlan);

  next.weeklyPlan.forEach(day => {
    day.exercises.forEach(ex => {
      if (args.adjustment === 'increase') {
        ex.targetWeight = ex.targetWeight * 1.05;
      } else if (args.adjustment === 'decrease') {
        ex.targetWeight = ex.targetWeight * 0.95;
      }
    });
  });

  return commit(next, 'Workout intensity updated');
}

function replaceExercise(args: any): ToolExecutionResult {
  const { workoutPlan } = useAppStore.getState();
  console.log('DEBUG: localStorage workout plan structure:', JSON.stringify(localStorage.getItem('forgefit_workout_plan'), null, 2));
  console.log('DEBUG: current workoutPlan from store:', JSON.stringify(workoutPlan, null, 2));
  if (!workoutPlan) return { ok: false, summary: 'No plan' };

  const next = cloneWorkoutPlan(workoutPlan);
  const day = findDay(next, args.day_label);
  if (!day) return { ok: false, summary: 'Day not found' };

  const index = day.exercises.findIndex(e => e.name === args.old_exercise_name);
  if (index === -1) return { ok: false, summary: 'Exercise not found' };

  day.exercises[index] = buildExercise(
    args.exercise_name,
    args.sets,
    args.reps.toString(),
    args.weight || 0,
    args.muscle_group || 'general',
    args.rest_seconds,
    args.form_tip
  );

  return commit(next, 'Exercise replaced');
}

function changeSplit(args: any): ToolExecutionResult {
  console.log('DEBUG: localStorage workout plan structure (before):', JSON.stringify(localStorage.getItem('forgefit_workout_plan'), null, 2));
  const { workoutPlan } = useAppStore.getState();
  console.log('DEBUG: current workoutPlan from store (before):', JSON.stringify(workoutPlan, null, 2));
  
  let parsed;

  try {
    parsed = JSON.parse(args.weekly_plan_json);
  } catch {
    return { ok: false, summary: 'Invalid JSON' };
  }

  console.log('DEBUG: parsed weekly_plan_json:', JSON.stringify(parsed, null, 2));

  // 🔥 FIX: handle both formats and ensure array structure
  if (!Array.isArray(parsed)) {
    if (Array.isArray(parsed.weeklyPlan)) {
      parsed = parsed.weeklyPlan;
    } else {
      return { ok: false, summary: 'Invalid workout format (expected array)' };
    }
  }

  console.log('DEBUG: final array to process:', JSON.stringify(parsed, null, 2));

  const weeklyPlan: WorkoutDay[] = parsed.map((d: any) => ({
    day: d.day,
    focus: d.focus || d.label || 'Workout',
    exercises: (d.exercises || []).map((e: any) =>
      buildExercise(
        e.name || 'Exercise',
        e.sets || 3,
        e.reps?.toString() || '10',
        e.targetWeight || e.weight || 0,
        e.muscleGroup || e.muscle_group || 'general',
        e.rest_seconds || 60,
        e.form_tip
      )
    ),
  }));

  const result = commit(
    { weeklyPlan, generatedAt: Date.now() },
    'Workout split changed successfully'
  );
  
  console.log('DEBUG: localStorage workout plan structure (after):', JSON.stringify(localStorage.getItem('forgefit_workout_plan'), null, 2));
  console.log('DEBUG: workout plan stored in expected array format');
  
  return result;
}

export function applyNutritionTargetsUpdate(partial: {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  reason: string;
}) {
  const { nutritionPlan, setNutritionPlan } = useAppStore.getState();

  if (!nutritionPlan) {
    return { ok: false, summary: 'No nutrition plan found' };
  }

  const updated = {
    ...nutritionPlan,
    dailyCalories: partial.calories,
    protein: partial.protein,
    carbs: partial.carbs,
    fats: partial.fats,
  };

  setNutritionPlan(updated);

  return {
    ok: true,
    summary: `Nutrition updated: ${partial.calories} kcal`,
  };
}