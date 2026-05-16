import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useConsistencyStore } from '@/store/consistencyStore';
import type { WorkoutDay, Exercise as WorkoutExercise } from '@/types/fitness';

interface WorkoutLogEntry {
  exerciseName: string;
  plannedReps: number;
  actualReps: number;
  sets: number;
  weight: number;
}

interface WorkoutSessionProps {
  day: WorkoutDay;
}

export default function WorkoutSession({ day }: WorkoutSessionProps) {
  const { setCurrentPage } = useAppStore();
  const { recordWorkout } = useConsistencyStore();
  const [logEntries, setLogEntries] = useState<WorkoutLogEntry[]>(() => {
    return day.exercises.map(exercise => ({
      exerciseName: exercise.name,
      plannedReps: parseInt(exercise.reps) || 10,
      actualReps: parseInt(exercise.reps) || 10,
      sets: exercise.sets,
      weight: exercise.targetWeight
    }));
  });

  const updateActualReps = (index: number, actualReps: number) => {
    setLogEntries(prev => prev.map((entry, i) => 
      i === index ? { ...entry, actualReps } : entry
    ));
  };

  const saveWorkout = () => {
    const workoutLogs = JSON.parse(localStorage.getItem('forgefit_workout_logs') || '[]');
    
    // Create log entries for each set of each exercise
    const newLogs = [];
    const currentDate = new Date().toISOString().split('T')[0];
    
    logEntries.forEach(entry => {
      for (let set = 1; set <= entry.sets; set++) {
        newLogs.push({
          id: `${Date.now()}-${entry.exerciseName}-${set}`,
          date: currentDate,
          day: day.day,
          exercise: entry.exerciseName,
          plannedReps: entry.plannedReps,
          actualReps: entry.actualReps,
          weight: entry.weight,
          timestamp: Date.now()
        });
      }
    });

    // Save to localStorage
    const updatedLogs = [...newLogs, ...workoutLogs];
    localStorage.setItem('forgefit_workout_logs', JSON.stringify(updatedLogs));

    // Record workout in consistency tier system
    recordWorkout(currentDate);

    // Debug log before navigation
    console.log("Workout saved, navigating...");
    
    // Redirect back to workout tracker
    setCurrentPage('workout-tracker');
    
    // Fallback to ensure UI updates
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <div className="min-h-screen pb-8">
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('workout-tracker')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-bold gradient-text">{day.day} Workout</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <h2 className="font-semibold text-lg mb-4">{day.focus} Day</h2>
          <div className="space-y-6">
            {logEntries.map((entry, index) => (
              <motion.div
                key={entry.exerciseName}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-border rounded-lg p-4"
              >
                <h3 className="font-medium text-lg mb-3">{entry.exerciseName}</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="text-sm text-muted-foreground">
                    Planned: {entry.sets} × {entry.plannedReps} reps
                    {entry.weight > 0 && ` @ ${entry.weight}kg`}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium min-w-[80px]">Actual Reps:</label>
                    <input
                      type="number"
                      min="0"
                      value={entry.actualReps}
                      onChange={(e) => updateActualReps(index, Number(e.target.value))}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter actual reps"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3"
        >
          <button
            onClick={saveWorkout}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Finish Workout
          </button>
        </motion.div>
      </div>
    </div>
  );
}
