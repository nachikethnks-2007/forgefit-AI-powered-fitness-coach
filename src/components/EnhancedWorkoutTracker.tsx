import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Edit, Plus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { WorkoutDay, WorkoutPlan } from '@/types/fitness';
import WorkoutSession from './WorkoutSession';

export default function EnhancedWorkoutTracker() {
  const { profile, setCurrentPage } = useAppStore();
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<WorkoutDay | null>(null);

  // Load workout plan from localStorage
  useEffect(() => {
    const plan = localStorage.getItem('forgefit_workout_plan');
    if (plan) {
      try {
        setWorkoutPlan(JSON.parse(plan));
      } catch {
        console.error('Failed to parse workout plan');
      }
    }
  }, []);

  const startLogging = (day: WorkoutDay) => {
    setSelectedWorkoutDay(day);
  };

  const editDay = (day: WorkoutDay) => {
    // Navigate to split builder with pre-filled data
    setCurrentPage('split-builder');
  };

  // If a workout session is selected, show the WorkoutSession component
  if (selectedWorkoutDay) {
    return <WorkoutSession day={selectedWorkoutDay} />;
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen pb-8">
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('dashboard')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-bold gradient-text">Workout Tracker</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {workoutPlan?.weeklyPlan && workoutPlan.weeklyPlan.length > 0 ? (
          <div className="grid gap-4">
            {workoutPlan.weeklyPlan
              .filter(day => day.exercises && day.exercises.length > 0)
              .map((day, index) => (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{day.day}</h3>
                    <p className="text-muted-foreground text-sm">{day.focus}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startLogging(day)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start Workout
                    </button>
                    <button
                      onClick={() => editDay(day)}
                      className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                </div>

                {/* Exercise List */}
                <div className="space-y-3">
                  {day.exercises.map((exercise) => (
                    <div key={exercise.name} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{exercise.name}</h4>
                        <span className="text-sm text-muted-foreground">
                          {exercise.sets} × {exercise.reps}
                          {exercise.targetWeight > 0 && ` @ ${exercise.targetWeight}kg`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="glass-card p-8 max-w-md mx-auto">
              <Plus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No workout plan created yet</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Create your first workout split to get started with your fitness journey.
              </p>
              <button
                onClick={() => setCurrentPage('split-builder')}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors font-medium"
              >
                Create Workout Split
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
