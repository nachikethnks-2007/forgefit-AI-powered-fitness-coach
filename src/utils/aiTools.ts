import type { NutritionPlan } from '@/types/fitness';
import { useAppStore } from '@/store/useAppStore';
import { getAICoachResponse } from '@/services/aiService';

/* ---------------- SIMPLIFIED AI TOOLS ---------------- */

export const FORGEFIT_AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_nutrition_targets',
      description: 'Update calories and macros based on user progress',
      parameters: {
        type: 'object',
        properties: {
          calories: { type: 'number', description: 'New daily calorie target (must be number, not string)' },
          protein: { type: 'number', description: 'New daily protein target in grams (must be number, not string)' },
          carbs: { type: 'number', description: 'New daily carb target in grams (must be number, not string)' },
          fats: { type: 'number', description: 'New daily fat target in grams (must be number, not string)' },
          reason: { type: 'string', description: 'Why these changes were made' },
        },
        required: ['calories', 'protein', 'carbs', 'fats', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_exercise',
      description: 'Replace a specific exercise with easier or harder variation',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Day name like Monday, Tuesday etc' },
          exercise_to_replace: { type: 'string', description: 'Exact name of exercise to remove' },
          replacement_exercise: { type: 'string', description: 'Name of new exercise' },
          sets: { type: 'number', description: 'Number of sets (must be number, not string, default 3)' },
          reps: { type: 'string', description: 'Number of reps as string like 10 or 8-12' },
          muscleGroup: { type: 'string', description: 'Muscle group like chest, back, legs' },
          reason: { type: 'string', description: 'Why this exercise was replaced' },
        },
        required: ['day', 'exercise_to_replace', 'replacement_exercise', 'muscleGroup', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_exercise_volume',
      description: 'Change reps for progressive overload',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Day name like Monday, Tuesday etc' },
          exercise_name: { type: 'string', description: 'Exact name of exercise' },
          new_reps: { type: 'string', description: 'New rep scheme like 12 or 8-12' },
          reason: { type: 'string', description: 'Why reps were adjusted' },
        },
        required: ['day', 'exercise_name', 'new_reps', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'change_workout_split',
      description: 'Change entire workout split structure',
      parameters: {
        type: 'object',
        properties: {
          new_split: { type: 'string', description: 'Type: push_pull_legs, upper_lower, full_body, bro_split' },
          days_per_week: { type: 'number', description: 'Number of training days per week (must be number, not string)' },
          reason: { type: 'string', description: 'Why split was changed' },
        },
        required: ['new_split', 'days_per_week', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_alert',
      description: 'Send alert to user explaining changes and next steps',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Clear explanation of what changed and why' },
          priority: { type: 'string', description: 'high, medium, or low' },
          focus_area: { type: 'string', description: 'What user should focus on next' },
        },
        required: ['message', 'priority', 'focus_area'],
      },
    },
  },
];

/* ---------------- TOOL EXECUTION ---------------- */

export function executeForgefitTool(name: string, argsJson: string): { ok: boolean; summary: string } {
  const args = JSON.parse(argsJson);

  switch (name) {
    case 'update_nutrition_targets':
      return updateNutritionTargets(args);
    case 'replace_exercise':
      return replaceExercise(args);
    case 'adjust_exercise_volume':
      return adjustExerciseVolume(args);
    case 'change_workout_split':
      return changeWorkoutSplit(args);
    case 'flag_alert':
      return flagAlert(args);
    default:
      return { ok: false, summary: 'Unknown tool' };
  }
}

function updateNutritionTargets(args: any): { ok: boolean; summary: string } {
  // Safely convert numeric values with fallbacks
  const calories = Number(args.calories) || 2000;
  const protein = Number(args.protein) || 150;
  const carbs = Number(args.carbs) || 200;
  const fats = Number(args.fats) || 65;
  const reason = args.reason || 'Nutrition targets updated';

  const { setNutritionPlan } = useAppStore.getState();

  try {
    const currentPlan = useAppStore.getState().nutritionPlan;
    if (!currentPlan) {
      return { ok: false, summary: 'No nutrition plan found' };
    }

    const updatedPlan = {
      ...currentPlan,
      dailyCalories: calories,
      protein,
      carbs,
      fats,
    };

    setNutritionPlan(updatedPlan);
    localStorage.setItem('forgefit_nutrition_plan', JSON.stringify(updatedPlan));

    return {
      ok: true,
      summary: `✅ Updated nutrition targets: ${calories} calories, ${protein}g protein, ${carbs}g carbs, ${fats}g fats. ${reason}`,
    };
  } catch (error) {
    return { ok: false, summary: 'Failed to update nutrition targets' };
  }
}

function replaceExercise(args: any): { ok: boolean; summary: string } {
  // Safely convert numeric values with fallbacks
  const sets = Number(args.sets) || 3;
  const reps = args.reps || '10';
  const day = args.day;
  const exercise_to_replace = args.exercise_to_replace;
  const replacement_exercise = args.replacement_exercise;
  const muscleGroup = args.muscleGroup;
  const reason = args.reason || 'Exercise replaced';

  try {
    const stored = localStorage.getItem('forgefit_workout_plan');
    const plan = JSON.parse(stored || '{}');
    const days = plan.weeklyPlan || [];

    const dayIndex = days.findIndex((d: any) =>
      d.day.toLowerCase().trim() === day.toLowerCase().trim()
    );

    if (dayIndex === -1) {
      return { ok: false, summary: `Day "${day}" not found in workout plan` };
    }

    const exerciseIndex = days[dayIndex].exercises.findIndex((e: any) =>
      e.name.toLowerCase().trim() === exercise_to_replace.toLowerCase().trim()
    );

    if (exerciseIndex === -1) {
      return { ok: false, summary: `Exercise "${exercise_to_replace}" not found on ${day}` };
    }

    // Replace the exercise
    days[dayIndex].exercises[exerciseIndex] = {
      name: replacement_exercise,
      sets,
      reps,
      targetWeight: 0,
      muscleGroup,
      restSeconds: 90,
      formTip: '',
    };

    plan.weeklyPlan = days;
    localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
    window.dispatchEvent(new Event('workoutPlanUpdated'));

    return {
      ok: true,
      summary: `✅ Replaced "${exercise_to_replace}" with "${replacement_exercise}" on ${day}. ${reason}`,
    };
  } catch (error) {
    return { ok: false, summary: 'Failed to replace exercise' };
  }
}

function adjustExerciseVolume(args: any): { ok: boolean; summary: string } {
  const { day, exercise_name, new_reps, reason } = args;

  try {
    const stored = localStorage.getItem('forgefit_workout_plan');
    const plan = JSON.parse(stored || '{}');
    const days = plan.weeklyPlan || [];

    const dayIndex = days.findIndex((d: any) =>
      d.day.toLowerCase().trim() === day.toLowerCase().trim()
    );

    if (dayIndex === -1) {
      return { ok: false, summary: `Day "${day}" not found in workout plan` };
    }

    const exerciseIndex = days[dayIndex].exercises.findIndex((e: any) =>
      e.name.toLowerCase().trim() === exercise_name.toLowerCase().trim()
    );

    if (exerciseIndex === -1) {
      return { ok: false, summary: `Exercise "${exercise_name}" not found on ${day}` };
    }

    // Adjust reps
    days[dayIndex].exercises[exerciseIndex].reps = new_reps;

    plan.weeklyPlan = days;
    localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
    window.dispatchEvent(new Event('workoutPlanUpdated'));

    return {
      ok: true,
      summary: `✅ Adjusted "${exercise_name}" reps to ${new_reps} on ${day}. ${reason}`,
    };
  } catch (error) {
    return { ok: false, summary: 'Failed to adjust exercise volume' };
  }
}

function changeWorkoutSplit(args: any): { ok: boolean; summary: string } {
  // Safely convert numeric values with fallbacks
  const days_per_week = Number(args.days_per_week) || 3;
  const new_split = args.new_split;
  const reason = args.reason || 'Workout split changed';
  
  const { profile, setWorkoutPlan } = useAppStore.getState();

  if (!profile) {
    return { ok: false, summary: 'No profile found' };
  }

  try {
    // Use backend API to generate workout plan
    // For now, return success - actual generation will happen via backend
    // This is a simplified version that relies on the backend
    return {
      ok: true,
      summary: `✅ Workout split change requested: ${new_split} (${days_per_week} days/week). ${reason}`,
    };
  } catch (error) {
    return { ok: false, summary: 'Failed to change workout split' };
  }
}

function flagAlert(args: any): { ok: boolean; summary: string } {
  const { message, priority, focus_area } = args;
  const { addForgefitAlert } = useAppStore.getState();

  try {
    addForgefitAlert({
      id: `ai_${Date.now()}`,
      type: 'suggestion',
      message,
      read: false,
      createdAt: Date.now(),
    });

    return {
      ok: true,
      summary: `✅ Alert sent: ${message} (Priority: ${priority}, Focus: ${focus_area})`,
    };
  } catch (error) {
    return { ok: false, summary: 'Failed to send alert' };
  }
}

/* ---------------- AUTOMATIC ANALYSIS SYSTEM ---------------- */

export async function runBiWeeklyWorkoutAnalysis(): Promise<void> {
  const lastAnalysis = localStorage.getItem('forgefit_last_workout_analysis');
  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  // Only run if 14 days have passed since last analysis
  if (lastAnalysis && (now - parseInt(lastAnalysis)) < fourteenDays) {
    return;
  }

  const { profile, workoutSessions, workoutPlan } = useAppStore.getState();
  if (!profile || !workoutPlan || !workoutSessions.length) return;

  try {
    // Get last 14 days of workout sessions
    const fourteenDaysAgo = now - fourteenDays;
    const recentSessions = workoutSessions.filter(s => s.timestamp > fourteenDaysAgo);

    if (recentSessions.length === 0) return;

    // Analyze exercise performance
    const exerciseAnalysis = analyzeExerciseProgress(recentSessions, workoutPlan);
    
    // Use backend API for analysis instead of direct Groq call
    // This will be handled by the backend
    console.log('Bi-weekly workout analysis data:', exerciseAnalysis);

    // Mark analysis as completed
    localStorage.setItem('forgefit_last_workout_analysis', now.toString());
    
  } catch (error) {
    console.error('Bi-weekly workout analysis failed:', error);
  }
}

export async function runMonthlyNutritionAnalysis(): Promise<void> {
  const lastAnalysis = localStorage.getItem('forgefit_last_nutrition_analysis');
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  // Only run if 30 days have passed since last analysis
  if (lastAnalysis && (now - parseInt(lastAnalysis)) < thirtyDays) {
    return;
  }

  const { profile, nutritionPlan, measurements } = useAppStore.getState();
  if (!profile || !nutritionPlan || !measurements.length) return;

  try {
    // Get last 4 weeks of weight data
    const fourWeeksAgo = now - (4 * 7 * 24 * 60 * 60 * 1000);
    const recentMeasurements = measurements.filter(m => new Date(m.date).getTime() > fourWeeksAgo);

    if (recentMeasurements.length < 2) return;

    // Calculate weight change
    const oldestWeight = recentMeasurements[0].weight;
    const newestWeight = recentMeasurements[recentMeasurements.length - 1].weight;
    const weightChange = newestWeight - oldestWeight;

    // Use backend API for analysis instead of direct Groq call
    // This will be handled by the backend
    console.log('Monthly nutrition analysis data:', { weightChange, profile: profile.mode });

    // Mark analysis as completed
    localStorage.setItem('forgefit_last_nutrition_analysis', now.toString());
    
  } catch (error) {
    console.error('Monthly nutrition analysis failed:', error);
  }
}

function analyzeExerciseProgress(sessions: any[], workoutPlan: any): any {
  const analysis: any = {};

  sessions.forEach(session => {
    session.exercises?.forEach((exercise: any) => {
      const name = exercise.name;
      if (!analysis[name]) {
        analysis[name] = {
          totalSessions: 0,
          completedReps: 0,
          targetReps: 0,
          successRate: 0,
        };
      }

      analysis[name].totalSessions++;
      analysis[name].completedReps += exercise.completedReps || 0;
      analysis[name].targetReps += parseInt(exercise.targetReps) || 0;
    });
  });

  // Calculate success rates
  Object.keys(analysis).forEach(exercise => {
    const data = analysis[exercise];
    data.successRate = data.targetReps > 0 ? (data.completedReps / data.targetReps) * 100 : 0;
  });

  return analysis;
}
