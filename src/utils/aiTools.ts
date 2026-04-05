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
          day: { type: 'string' },
          exercise_to_replace: { type: 'string' },
          replacement_exercise: { type: 'string' },
          sets: { type: 'number', default: 3 },
          reps: { type: 'string' },
          muscleGroup: { type: 'string' },
          reason: { type: 'string' },
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
          new_split: { type: 'string' },
          days_per_week: { type: 'number', default: 3 },
          reason: { type: 'string' },
        },
        required: ['new_split', 'reason'],
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
          day: { type: 'string' },
          exercise_name: { type: 'string' },
          new_sets: { type: 'number', default: 3 },
          new_reps: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['day', 'exercise_name', 'new_reps', 'reason'],
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
          day: { type: 'string' },
          exercise_name: { type: 'string' },
          sets: { type: 'number', default: 3 },
          reps: { type: 'string' },
          muscleGroup: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['day', 'exercise_name', 'reps', 'muscleGroup', 'reason'],
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
          day: { type: 'string' },
          exercise_name: { type: 'string' },
          reason: { type: 'string' },
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
          adjustment: { type: 'string' },
          percentage: { type: 'number' },
          affected_exercises: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['adjustment', 'percentage', 'affected_exercises', 'reason'],
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
  // Safety checks for parameters
  const sets = typeof args.sets === 'number' ? args.sets : 3;
  const reps = typeof args.reps === 'string' ? args.reps : '10';
  
  const plan = JSON.parse(localStorage.getItem('forgefit_workout_plan') || '{}');
  const days = plan.weeklyPlan || [];
  
  const dayIndex = days.findIndex((d: any) => 
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: 'Day not found' };
  
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
  
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Replaced ${args.exercise_to_replace} with ${args.replacement_exercise} on ${args.day}` 
  };
}

function changeSplit(args: any): ToolExecutionResult {
  // Safety check for days_per_week
  const daysPerWeek = typeof args.days_per_week === 'number' ? args.days_per_week : 3;
  
  const { profile } = useAppStore.getState();
  if (!profile) return { ok: false, summary: 'No profile found' };
  
  const prompt = `Generate a ${args.new_split} workout split for ${daysPerWeek} days per week.
User equipment: ${profile.equipment}
User fitness level: ${profile.fitnessLevel}
CRITICAL: Only use bodyweight exercises if equipment is bodyweight.
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

  return callGroq([
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
      return { ok: true, summary: `✅ Workout split changed to ${args.new_split}` };
    } catch {
      return { ok: false, summary: 'Failed to parse workout plan' };
    }
  }).catch(() => {
    return { ok: false, summary: 'Failed to generate workout plan' };
  }) as ToolExecutionResult;
}

function adjustVolume(args: any): ToolExecutionResult {
  // Safety checks for parameters
  const newSets = typeof args.new_sets === 'number' ? args.new_sets : 3;
  const newReps = typeof args.new_reps === 'string' ? args.new_reps : '10';
  
  const plan = JSON.parse(localStorage.getItem('forgefit_workout_plan') || '{}');
  const days = plan.weeklyPlan || [];
  
  const dayIndex = days.findIndex((d: any) => 
    d.day.toLowerCase().trim() === args.day.toLowerCase().trim()
  );
  if (dayIndex === -1) return { ok: false, summary: 'Day not found' };
  
  const exIndex = days[dayIndex].exercises.findIndex((e: any) =>
    e.name.toLowerCase().trim() === args.exercise_name.toLowerCase().trim()
  );
  if (exIndex === -1) return { ok: false, summary: 'Exercise not found' };
  
  days[dayIndex].exercises[exIndex].sets = newSets;
  days[dayIndex].exercises[exIndex].reps = newReps;
  
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Updated ${args.exercise_name} to ${newSets}×${newReps} on ${args.day}` 
  };
}

function addExercise(args: any): ToolExecutionResult {
  // Safety checks for parameters
  const sets = typeof args.sets === 'number' ? args.sets : 3;
  const reps = typeof args.reps === 'string' ? args.reps : '10';
  
  const plan = JSON.parse(localStorage.getItem('forgefit_workout_plan') || '{}');
  const days = plan.weeklyPlan || [];
  
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
  
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Added ${args.exercise_name} to ${args.day}` 
  };
}

function removeExercise(args: any): ToolExecutionResult {
  const plan = JSON.parse(localStorage.getItem('forgefit_workout_plan') || '{}');
  const days = plan.weeklyPlan || [];
  
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
  
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
  window.dispatchEvent(new Event('workoutPlanUpdated'));
  
  return { 
    ok: true, 
    summary: `✅ Removed ${args.exercise_name} from ${args.day}` 
  };
}

function updateIntensity(args: any): ToolExecutionResult {
  // Safety check for percentage
  const percentage = typeof args.percentage === 'number' ? args.percentage : 5;
  
  const plan = JSON.parse(localStorage.getItem('forgefit_workout_plan') || '{}');
  const days = plan.weeklyPlan || [];
  
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
  
  plan.weeklyPlan = days;
  localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
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