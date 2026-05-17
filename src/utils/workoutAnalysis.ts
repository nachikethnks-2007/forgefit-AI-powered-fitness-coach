import { analyzeWorkout } from '@/services/aiService';
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

    // Call backend AI service
    const insight = await analyzeWorkout({
      workoutLogs: recentLogs,
      profile,
      exerciseAnalysis,
    });

    // Save analysis timestamp
    localStorage.setItem('forgefit_last_workout_analysis', now.toString());

    return insight;

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
