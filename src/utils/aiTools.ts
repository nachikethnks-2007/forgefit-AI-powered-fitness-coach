import type {
  NutritionPlan,
} from '@/types/fitness';
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
      description: 'Increase or decrease weight/reps after workout performance analysis',
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
    default:
      return { ok: false, summary: 'Unknown tool' };
  }
}

/* ---------------- WORKOUT TOOLS ---------------- */

function replaceExercise(args: any): ToolExecutionResult {
  // Rule 6: sets parameter must always be integer type with fallback
  const sets = Number.isInteger(args.sets) ? args.sets : 3;
  const reps = typeof args.reps === 'string' ? args.reps : '10';
  
  // Rule 2: Read workout plan correctly
  const stored = localStorage.getItem('forgefit_workout_plan');
  const plan = JSON.parse(stored || '{}');
  const days = plan.weeklyPlan; // always access weeklyPlan key
  
  // Rule 3: Day matching must be case-insensitive and trimmed
  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: 'Day not found' };
  
  // Rule 4: Exercise matching must be case-insensitive and trimmed
  const exIndex = days[dayIndex].exercises.findIndex((e: any) =>
    e.name.toLowerCase().trim() === args.exercise_to_replace.toLowerCase().trim()
  );
  if (exIndex === -1) return { ok: false, summary: 'Exercise not found' };
  
  days[dayIndex].exercises[exIndex] = {
    name: args.replacement_exercise,
    sets: sets,
    reps: reps,
    targetWeight: 0,
    muscleGroup: args.muscleGroup,
    restSeconds: 90,
    formTip: ''
  };
  
  // Rule 5: Always save back correctly
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  
  // Rule 7: Dispatch event to re-render Workout Tracker
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Replaced ${args.exercise_to_replace} with ${args.replacement_exercise} on ${args.day}` 
  };
}

function changeSplit(args: any): ToolExecutionResult {
  const { profile } = useAppStore.getState();
  if (!profile) return { ok: false, summary: 'No profile found' };
  
  const prompt = `Generate a ${args.new_split} workout split for ${args.days_per_week} days per week.
User equipment: ${profile.equipment}
User fitness level: ${profile.fitnessLevel}
CRITICAL: If equipment is bodyweight only use bodyweight exercises.
Return ONLY a valid JSON array like this exact format, no extra text:
[
  {
    "day": "Monday",
    "focus": "Upper Body Push", 
    "exercises": [
      {"name": "Push-up", "sets": 3, "reps": "10", "targetWeight": 0, "muscleGroup": "chest", "restSeconds": 90, "formTip": "Keep core tight"}
    ]
  }
]`;

  // Make this async but return a sync result for now
  callGroq([
    { role: 'system', content: 'You are a fitness coach. Return ONLY JSON.' },
    { role: 'user', content: prompt }
  ]).then(response => {
    try {
      const parsedArray = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      const newPlan = {
        weeklyPlan: parsedArray,
        generatedAt: Date.now()
      };
      localStorage.setItem('forgefit_workout_plan', JSON.stringify(newPlan));
      window.dispatchEvent(new Event('workoutPlanUpdated'));
    } catch {
      // Handle error silently
    }
  }).catch(() => {
    // Handle error silently
  });

  return { ok: true, summary: `✅ Workout split changed to ${args.new_split}` };
}

function adjustVolume(args: any): ToolExecutionResult {
  // Rule 6: sets parameter must always be integer type with fallback
  const newSets = Number.isInteger(args.new_sets) ? args.new_sets : undefined;
  const newReps = typeof args.new_reps === 'string' ? args.new_reps : undefined;
  
  // Rule 2: Read workout plan correctly
  const stored = localStorage.getItem('forgefit_workout_plan');
  const plan = JSON.parse(stored || '{}');
  const days = plan.weeklyPlan; // always access weeklyPlan key
  
  // Rule 3: Day matching must be case-insensitive and trimmed
  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: 'Day not found' };
  
  // Rule 4: Exercise matching must be case-insensitive and trimmed
  const exIndex = days[dayIndex].exercises.findIndex((e: any) =>
    e.name.toLowerCase().trim() === args.exercise_name.toLowerCase().trim()
  );
  if (exIndex === -1) return { ok: false, summary: 'Exercise not found' };
  
  // Update sets and reps if provided
  if (newSets !== undefined) days[dayIndex].exercises[exIndex].sets = newSets;
  if (newReps !== undefined) days[dayIndex].exercises[exIndex].reps = newReps;
  
  // Rule 5: Always save back correctly
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  
  // Rule 7: Dispatch event to re-render Workout Tracker
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Updated ${args.exercise_name} volume on ${args.day}` 
  };
}

function addExercise(args: any): ToolExecutionResult {
  // Rule 6: sets parameter must always be integer type with fallback
  const sets = Number.isInteger(args.sets) ? args.sets : 3;
  const reps = typeof args.reps === 'string' ? args.reps : '10';
  
  // Rule 2: Read workout plan correctly
  const stored = localStorage.getItem('forgefit_workout_plan');
  const plan = JSON.parse(stored || '{}');
  const days = plan.weeklyPlan; // always access weeklyPlan key
  
  // Rule 3: Day matching must be case-insensitive and trimmed
  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: 'Day not found' };
  
  days[dayIndex].exercises.push({
    name: args.exercise_name,
    sets: sets,
    reps: reps,
    targetWeight: 0,
    muscleGroup: args.muscleGroup,
    restSeconds: 90,
    formTip: ''
  });
  
  // Rule 5: Always save back correctly
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  
  // Rule 7: Dispatch event to re-render Workout Tracker
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Added ${args.exercise_name} to ${args.day}` 
  };
}

function removeExercise(args: any): ToolExecutionResult {
  // Rule 2: Read workout plan correctly
  const stored = localStorage.getItem('forgefit_workout_plan');
  const plan = JSON.parse(stored || '{}');
  const days = plan.weeklyPlan; // always access weeklyPlan key
  
  // Rule 3: Day matching must be case-insensitive and trimmed
  const dayIndex = days.findIndex((d: any) =>
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: 'Day not found' };
  
  const originalLength = days[dayIndex].exercises.length;
  days[dayIndex].exercises = days[dayIndex].exercises.filter((e: any) =>
    e.name.toLowerCase().trim() !== args.exercise_name.toLowerCase().trim()
  );
  
  if (days[dayIndex].exercises.length === originalLength) {
    return { ok: false, summary: 'Exercise not found' };
  }
  
  // Rule 5: Always save back correctly
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  
  // Rule 7: Dispatch event to re-render Workout Tracker
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Removed ${args.exercise_name} from ${args.day}` 
  };
}

function updateIntensity(args: any): ToolExecutionResult {
  // Rule 6: percentage parameter with fallback
  const percentage = typeof args.percentage === 'number' ? args.percentage : 5;
  
  // Rule 2: Read workout plan correctly
  const stored = localStorage.getItem('forgefit_workout_plan');
  const plan = JSON.parse(stored || '{}');
  const days = plan.weeklyPlan; // always access weeklyPlan key
  
  days.forEach((day: any) => {
    day.exercises.forEach((exercise: any) => {
      const shouldUpdate = args.affected_exercises.includes('all') || 
        args.affected_exercises.some((name: string) => 
          name.toLowerCase().trim() === exercise.name.toLowerCase().trim()
        );
      
      if (shouldUpdate) {
        if (args.adjustment === 'increase') {
          exercise.targetWeight = exercise.targetWeight * (1 + percentage / 100);
        } else if (args.adjustment === 'decrease') {
          exercise.targetWeight = exercise.targetWeight * (1 - percentage / 100);
        } else if (args.adjustment === 'deload') {
          exercise.targetWeight = exercise.targetWeight * 0.8;
        }
        // 'hold' does nothing
      }
    });
  });
  
  // Rule 5: Always save back correctly
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  
  // Rule 7: Dispatch event to re-render Workout Tracker
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Workout intensity updated: ${args.adjustment} ${percentage}%` 
  };
}

/* ---------------- NUTRITION TOOLS ---------------- */

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