import type { NutritionPlan } from '@/types/fitness';
import { useAppStore } from '@/store/useAppStore';
import { callGroq } from '@/services/groqClient';

/* ---------------- TOOLS ---------------- */

export const FORGEFIT_GROQ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'replace_exercise',
      description: 'Replace a specific exercise in the workout plan with a different one',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Day name like Monday, Tuesday etc' },
          exercise_to_replace: { type: 'string', description: 'Exact name of exercise to remove' },
          replacement_exercise: { type: 'string', description: 'Name of new exercise' },
          sets: { type: 'integer', description: 'Number of sets as integer, default 3 if not specified' },
          reps: { type: 'string', description: 'Number of reps as string like 10 or 8-12, default same as replaced exercise' },
          muscleGroup: { type: 'string', description: 'Muscle group like chest, back, legs' },
          reason: { type: 'string', description: 'Reason for replacement' },
        },
        required: ['day', 'exercise_to_replace', 'replacement_exercise', 'muscleGroup', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'change_workout_split',
      description: 'Completely regenerate weekly workout plan with different split',
      parameters: {
        type: 'object',
        properties: {
          new_split: { type: 'string', description: 'Type of split: push_pull_legs, upper_lower, full_body, bro_split' },
          days_per_week: { type: 'integer', description: 'Number of training days per week' },
          reason: { type: 'string', description: 'Reason for changing split' },
        },
        required: ['new_split', 'days_per_week', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_exercise_volume',
      description: 'Change sets and reps for a specific exercise',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Day name like Monday, Tuesday etc' },
          exercise_name: { type: 'string', description: 'Exact name of exercise to modify' },
          new_sets: { type: 'integer', description: 'New number of sets as integer' },
          new_reps: { type: 'string', description: 'New number of reps as string like 10 or 8-12' },
          reason: { type: 'string', description: 'Reason for volume adjustment' },
        },
        required: ['day', 'exercise_name', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_exercise',
      description: 'Add a new exercise to a specific day',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Day name like Monday, Tuesday etc' },
          exercise_name: { type: 'string', description: 'Name of new exercise to add' },
          sets: { type: 'integer', description: 'Number of sets as integer, default 3 if not specified' },
          reps: { type: 'string', description: 'Number of reps as string like 10 or 8-12, default 10 if not specified' },
          muscleGroup: { type: 'string', description: 'Muscle group like chest, back, legs' },
          reason: { type: 'string', description: 'Reason for adding exercise' },
        },
        required: ['day', 'exercise_name', 'muscleGroup', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_exercise',
      description: 'Remove an exercise from a specific day',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Day name like Monday, Tuesday etc' },
          exercise_name: { type: 'string', description: 'Exact name of exercise to remove' },
          reason: { type: 'string', description: 'Reason for removal' },
        },
        required: ['day', 'exercise_name', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_workout_intensity',
      description: 'Increase or decrease weight/reps after workout performance analysis. ONLY call when user explicitly says workout is too easy or too hard',
      parameters: {
        type: 'object',
        properties: {
          adjustment: { type: 'string', description: 'Type of adjustment: increase, decrease, hold, deload' },
          percentage: { type: 'number', description: 'Percentage for increase/decrease, default 5 if not specified' },
          affected_exercises: { type: 'array', items: { type: 'string' }, description: 'Array of exercise names or ["all"] for all exercises' },
          reason: { type: 'string', description: 'Reason for intensity adjustment' },
        },
        required: ['adjustment', 'affected_exercises', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_nutrition_targets',
      description: 'Update daily calorie and macro targets when user reports plateau, wants changes, or progress analysis requires adjustment',
      parameters: {
        type: 'object',
        properties: {
          calories: { type: 'number', description: 'New daily calorie target' },
          protein: { type: 'number', description: 'New protein target in grams' },
          carbs: { type: 'number', description: 'New carbs target in grams' },
          fats: { type: 'number', description: 'New fats target in grams' },
          reason: { type: 'string', description: 'Reason for updating nutrition targets' },
        },
        required: ['calories', 'protein', 'carbs', 'fats', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_body_stats',
      description: 'Update body stats when user provides new weight or measurements',
      parameters: {
        type: 'object',
        properties: {
          weight: { type: 'number', description: 'New weight in kg' },
          neck: { type: 'number', description: 'Neck circumference in cm' },
          waist: { type: 'number', description: 'Waist circumference in cm' },
          hip: { type: 'number', description: 'Hip circumference in cm' },
          reason: { type: 'string', description: 'Reason for updating body stats' },
        },
        required: ['weight', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_alert',
      description: 'Send a proactive alert or suggestion to the user on dashboard',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Alert type: warning, success, suggestion' },
          message: { type: 'string', description: 'The alert message to show' },
        },
        required: ['type', 'message'],
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

/* ---------------- TOOL EXECUTION ---------------- */

export function executeForgefitTool(name: string, argsJson: string): ToolExecutionResult {
  const args = parseArgs(argsJson);

  switch (name) {
    case 'replace_exercise':
      return replaceExercise(args);
    case 'change_workout_split':
      return changeSplit(args);
    case 'adjust_exercise_volume':
      return adjustVolume(args);
    case 'add_exercise':
      return addExercise(args);
    case 'remove_exercise':
      return removeExercise(args);
    case 'update_workout_intensity':
      return updateIntensity(args);
    case 'update_nutrition_targets':
      return updateNutritionTargets(args);
    case 'update_body_stats':
      return updateBodyStats(args);
    case 'flag_alert':
      return flagAlert(args);
    default:
      return { ok: false, summary: 'Unknown tool' };
  }
}

/* ---------------- WORKOUT TOOLS ---------------- */

function replaceExercise(args: any): ToolExecutionResult {
  const sets = Number.isInteger(args.sets) ? args.sets : 3;
  const reps = typeof args.reps === 'string' ? args.reps : '10';

  const stored = localStorage.getItem('forgefit_workout_plan');
  if (!stored) return { ok: false, summary: 'No workout plan found' };

  const plan = JSON.parse(stored);
  const days = plan.weeklyPlan;
  if (!Array.isArray(days)) return { ok: false, summary: 'Invalid workout plan format' };

  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: `Day not found: ${args.day}` };

  const exIndex = days[dayIndex].exercises.findIndex((e: any) =>
    e.name.toLowerCase().trim() === args.exercise_to_replace.toLowerCase().trim()
  );
  if (exIndex === -1) return { ok: false, summary: `Exercise not found: ${args.exercise_to_replace}` };

  days[dayIndex].exercises[exIndex] = {
    name: args.replacement_exercise,
    sets,
    reps,
    targetWeight: 0,
    muscleGroup: args.muscleGroup,
    restSeconds: 90,
    formTip: '',
  };

  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));

  return {
    ok: true,
    summary: `✅ Replaced ${args.exercise_to_replace} with ${args.replacement_exercise} on ${args.day}`,
  };
}

function changeSplit(args: any): ToolExecutionResult {
  const { profile } = useAppStore.getState();
  if (!profile) return { ok: false, summary: 'No profile found' };

  const bodyweightList = profile.equipment === 'bodyweight'
    ? `CRITICAL: Only use these bodyweight exercises: Push-up, Knee Push-up, Wall Push-up, Diamond Push-up, Pike Push-up, Decline Push-up, Pull-up, Chin-up, Inverted Row, Australian Pull-up, Bodyweight Squat, Lunge, Bulgarian Split Squat, Glute Bridge, Hip Thrust, Wall Sit, Calf Raise, Plank, Side Plank, Dead Bug, Hollow Body Hold, Leg Raise, Bicycle Crunch, Tricep Dip using chair, Mountain Climber, Burpee, Jump Squat.`
    : '';

  const prompt = `Generate a ${args.new_split} workout split for ${args.days_per_week} days per week.
User equipment: ${profile.equipment}
User fitness level: ${profile.fitnessLevel}
${bodyweightList}
Return ONLY a valid JSON array, no extra text:
[
  {
    "day": "Monday",
    "focus": "Upper Body Push",
    "exercises": [
      {"name": "Push-up", "sets": 3, "reps": "10", "targetWeight": 0, "muscleGroup": "chest", "restSeconds": 90, "formTip": "Keep core tight"}
    ]
  }
]`;

  callGroq([
    { role: 'system', content: 'You are a fitness coach. Return ONLY valid JSON array. No markdown, no explanation.' },
    { role: 'user', content: prompt },
  ]).then((response) => {
    try {
      const clean = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsedArray = JSON.parse(clean);
      const newPlan = { weeklyPlan: parsedArray, generatedAt: Date.now() };
      localStorage.setItem('forgefit_workout_plan', JSON.stringify(newPlan));
      window.dispatchEvent(new Event('workoutPlanUpdated'));
    } catch {
      // silent fail
    }
  }).catch(() => {});

  return { ok: true, summary: `✅ Generating new ${args.new_split} split, please wait a moment...` };
}

function adjustVolume(args: any): ToolExecutionResult {
  const newSets = Number.isInteger(args.new_sets) ? args.new_sets : undefined;
  const newReps = typeof args.new_reps === 'string' ? args.new_reps : undefined;

  const stored = localStorage.getItem('forgefit_workout_plan');
  if (!stored) return { ok: false, summary: 'No workout plan found' };

  const plan = JSON.parse(stored);
  const days = plan.weeklyPlan;
  if (!Array.isArray(days)) return { ok: false, summary: 'Invalid workout plan format' };

  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: `Day not found: ${args.day}` };

  const exIndex = days[dayIndex].exercises.findIndex((e: any) =>
    e.name.toLowerCase().trim() === args.exercise_name.toLowerCase().trim()
  );
  if (exIndex === -1) return { ok: false, summary: `Exercise not found: ${args.exercise_name}` };

  if (newSets !== undefined) days[dayIndex].exercises[exIndex].sets = newSets;
  if (newReps !== undefined) days[dayIndex].exercises[exIndex].reps = newReps;

  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));

  return { ok: true, summary: `✅ Updated ${args.exercise_name} volume on ${args.day}` };
}

function addExercise(args: any): ToolExecutionResult {
  const sets = Number.isInteger(args.sets) ? args.sets : 3;
  const reps = typeof args.reps === 'string' ? args.reps : '10';

  const stored = localStorage.getItem('forgefit_workout_plan');
  if (!stored) return { ok: false, summary: 'No workout plan found' };

  const plan = JSON.parse(stored);
  const days = plan.weeklyPlan;
  if (!Array.isArray(days)) return { ok: false, summary: 'Invalid workout plan format' };

  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: `Day not found: ${args.day}` };

  days[dayIndex].exercises.push({
    name: args.exercise_name,
    sets,
    reps,
    targetWeight: 0,
    muscleGroup: args.muscleGroup,
    restSeconds: 90,
    formTip: '',
  });

  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));

  return { ok: true, summary: `✅ Added ${args.exercise_name} to ${args.day}` };
}

function removeExercise(args: any): ToolExecutionResult {
  const stored = localStorage.getItem('forgefit_workout_plan');
  if (!stored) return { ok: false, summary: 'No workout plan found' };

  const plan = JSON.parse(stored);
  const days = plan.weeklyPlan;
  if (!Array.isArray(days)) return { ok: false, summary: 'Invalid workout plan format' };

  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: `Day not found: ${args.day}` };

  const originalLength = days[dayIndex].exercises.length;
  days[dayIndex].exercises = days[dayIndex].exercises.filter((e: any) =>
    e.name.toLowerCase().trim() !== args.exercise_name.toLowerCase().trim()
  );

  if (days[dayIndex].exercises.length === originalLength) {
    return { ok: false, summary: `Exercise not found: ${args.exercise_name}` };
  }

  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));

  return { ok: true, summary: `✅ Removed ${args.exercise_name} from ${args.day}` };
}

function updateIntensity(args: any): ToolExecutionResult {
  const percentage = typeof args.percentage === 'number' ? args.percentage : 5;

  const stored = localStorage.getItem('forgefit_workout_plan');
  if (!stored) return { ok: false, summary: 'No workout plan found' };

  const plan = JSON.parse(stored);
  const days = plan.weeklyPlan;
  if (!Array.isArray(days)) return { ok: false, summary: 'Invalid workout plan format' };

  days.forEach((day: any) => {
    day.exercises.forEach((exercise: any) => {
      const shouldUpdate =
        args.affected_exercises.includes('all') ||
        args.affected_exercises.some((name: string) =>
          name.toLowerCase().trim() === exercise.name.toLowerCase().trim()
        );

      if (shouldUpdate) {
        if (args.adjustment === 'increase') {
          exercise.targetWeight = Math.round(exercise.targetWeight * (1 + percentage / 100));
        } else if (args.adjustment === 'decrease') {
          exercise.targetWeight = Math.round(exercise.targetWeight * (1 - percentage / 100));
        } else if (args.adjustment === 'deload') {
          exercise.targetWeight = Math.round(exercise.targetWeight * 0.8);
        }
      }
    });
  });

  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));

  return { ok: true, summary: `✅ Workout intensity ${args.adjustment}d by ${percentage}%` };
}

/* ---------------- NUTRITION TOOLS ---------------- */

function updateNutritionTargets(args: any): ToolExecutionResult {
  const { nutritionPlan, setNutritionPlan } = useAppStore.getState();
  if (!nutritionPlan) return { ok: false, summary: 'No nutrition plan found' };

  const updated = {
    ...nutritionPlan,
    dailyCalories: args.calories,
    protein: args.protein,
    carbs: args.carbs,
    fats: args.fats,
  };

  setNutritionPlan(updated);
  window.dispatchEvent(new Event('nutritionUpdated'));

  return {
    ok: true,
    summary: `✅ Nutrition updated: ${args.calories} kcal, ${args.protein}g protein, ${args.carbs}g carbs, ${args.fats}g fats. Reason: ${args.reason}`,
  };
}

function updateBodyStats(args: any): ToolExecutionResult {
  const { profile, setProfile } = useAppStore.getState();
  if (!profile) return { ok: false, summary: 'No profile found' };

  const updated = {
    ...profile,
    weight: args.weight ?? profile.weight,
    neck: args.neck ?? profile.neck,
    waist: args.waist ?? profile.waist,
    hip: args.hip ?? profile.hip,
  };

  setProfile(updated);

  const log = JSON.parse(localStorage.getItem('forgefit_measurements_log') || '[]');
  log.push({ date: new Date().toISOString(), ...args });
  localStorage.setItem('forgefit_measurements_log', JSON.stringify(log));

  window.dispatchEvent(new Event('profileUpdated'));

  return {
    ok: true,
    summary: `✅ Body stats updated: weight ${args.weight}kg. Reason: ${args.reason}`,
  };
}

function flagAlert(args: any): ToolExecutionResult {
  const alerts = JSON.parse(localStorage.getItem('forgefit_alerts') || '[]');
  alerts.unshift({
    type: args.type,
    message: args.message,
    date: new Date().toISOString(),
    read: false,
  });
  localStorage.setItem('forgefit_alerts', JSON.stringify(alerts));
  window.dispatchEvent(new Event('newAlert'));

  return {
    ok: true,
    summary: `✅ Alert created: ${args.message}`,
  };
}

/* ---------------- NUTRITION PLAN HELPER ---------------- */

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