import { callGroqWithTools } from '@/services/groqClient';
import { useAppStore } from '@/store/useAppStore';

interface WorkoutLog {
  id: string;
  date: string;
  dayLabel: string;
  exercises: LoggedExercise[];
  timestamp: number;
}

interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
  notes?: string;
}

interface LoggedSet {
  plannedReps: number;
  actualReps: number;
  weight: number;
  completed: boolean;
}

export async function runBiWeeklyWorkoutAnalysis(): Promise<string | null> {
  // Check if 14 days have passed since last analysis
  const lastAnalysis = localStorage.getItem('forgefit_last_workout_analysis');
  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  if (lastAnalysis && (now - parseInt(lastAnalysis)) < fourteenDays) {
    return null; // Not time yet
  }

  // Check API key
  const apiKey = localStorage.getItem('groqApiKey');
  if (!apiKey) {
    return "Add your API key in settings to enable AI insights";
  }

  // Get workout logs from localStorage
  const logsString = localStorage.getItem('forgefit_workout_logs');
  if (!logsString) {
    return null; // No logs to analyze
  }

  try {
    const workoutLogs: WorkoutLog[] = JSON.parse(logsString);
    
    // Safety check: ensure we have an array
    if (!Array.isArray(workoutLogs)) {
      return null;
    }
    
    // Filter logs from last 14 days
    const fourteenDaysAgo = now - fourteenDays;
    const recentLogs = workoutLogs.filter(log => log.timestamp > fourteenDaysAgo);

    if (recentLogs.length === 0) {
      return null; // No recent logs
    }

    // Get user profile
    const { profile } = useAppStore.getState();
    if (!profile) return null;

    // Analyze exercise performance
    const exerciseAnalysis = analyzeExercisePerformance(recentLogs);

    // Generate AI suggestions
    const prompt = `Analyze this workout data from the last 14 days and provide progressive overload suggestions:

User: ${profile.name}, Level: ${profile.fitnessLevel}, Equipment: ${profile.equipment}

Recent Workout Logs: ${JSON.stringify(recentLogs.slice(0, 5))}

Exercise Performance Analysis: ${JSON.stringify(exerciseAnalysis)}

RULES:
1. If user consistently hits or exceeds planned reps for 2+ sessions:
   - Suggest: "Increase [Exercise] from [current] reps to [new] reps"
   - Example: "Increase Push-ups from 10 to 12 reps"

2. If user consistently underperforms (actual < planned by 20%+):
   - Suggest: "Reduce reps to [lower] for better form"
   - OR: "Switch to easier variation of [Exercise]"
   - Example: "Reduce reps to 8 for better form"

3. If performance is stable (within 10% of planned):
   - Suggest: "Try increasing weight by 2.5kg for [Exercise]"
   - OR: "Try harder variation of [Exercise]"

4. Focus on 2-3 key exercises only
5. Be specific with exercise names and numbers
6. Keep suggestions concise and actionable

DO NOT:
- Modify workout plan automatically
- Call any update functions
- Change exercises, sets, or reps

Return suggestions as plain text only.`;

    try {
      const { content } = await callGroqWithTools([
        {
          role: 'user',
          content: prompt
        }
      ], { extraSystemSuffix: 'Provide specific progressive overload suggestions based on the data.' });

      // Save analysis timestamp
      localStorage.setItem('forgefit_last_workout_analysis', now.toString());

      return content;
    } catch (apiError) {
      console.error('API call failed:', apiError);
      return "Unable to generate insights. Please check your API key.";
    }

  } catch (error) {
    console.error('Bi-weekly workout analysis failed:', error);
    return null;
  }
}

function analyzeExercisePerformance(logs: WorkoutLog[]) {
  // Safety check: ensure logs is an array
  if (!Array.isArray(logs) || logs.length === 0) {
    return {};
  }

  const exerciseStats: Record<string, {
    plannedReps: number[];
    actualReps: number[];
    consistency: number;
  }> = {};

  // Collect data for each exercise
  if (Array.isArray(logs)) {
    logs.forEach(log => {
      // Safety check for exercises array
      const exercises = log.exercises || [];
      exercises.forEach(exercise => {
        if (!exerciseStats[exercise.name]) {
          exerciseStats[exercise.name] = {
            plannedReps: [],
            actualReps: [],
            consistency: 0
          };
        }

        // Safety check for sets array
        const sets = exercise.sets || [];
        sets.forEach(set => {
          exerciseStats[exercise.name].plannedReps.push(set.plannedReps);
          exerciseStats[exercise.name].actualReps.push(set.actualReps);
        });
      });
    });
  }

  // Calculate consistency and performance
  if (exerciseStats && typeof exerciseStats === 'object') {
    Object.keys(exerciseStats).forEach(exerciseName => {
      const stats = exerciseStats[exerciseName];
      if (stats.plannedReps.length > 0) {
        const avgPlanned = stats.plannedReps.reduce((a, b) => a + b, 0) / stats.plannedReps.length;
        const avgActual = stats.actualReps.reduce((a, b) => a + b, 0) / stats.actualReps.length;
        stats.consistency = avgActual / avgPlanned; // 1.0 = perfect, <1.0 = underperforming, >1.0 = overperforming
      }
    });
  }

  return exerciseStats;
}

export function getDefaultInsight(): string {
  return "Keep logging your workouts to receive insights";
}
