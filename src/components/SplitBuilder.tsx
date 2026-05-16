import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Dumbbell, Users, Activity } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getExercises, groupedExercises, type Exercise } from '@/data/workoutDatabase';
import type { WorkoutDay, Exercise as WorkoutExercise } from '@/types/fitness';

interface DaySlot {
  exercise: Exercise | null;
  sets: number;
  reps: string;
  weight: number;
}

interface SplitData {
  [day: string]: {
    type: string;
    slots: DaySlot[];
  };
}

export default function SplitBuilder() {
  const { profile, setCurrentPage, setWorkoutPlan } = useAppStore();
  const [splitType, setSplitType] = useState<'push-pull-legs' | 'upper-lower' | 'custom' | null>(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [dayType, setDayType] = useState('');
  const [slots, setSlots] = useState<DaySlot[]>(Array(5).fill(null).map(() => ({
    exercise: null,
    sets: 3,
    reps: '10',
    weight: 0
  })));
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [splitData, setSplitData] = useState<SplitData>({});

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const getSplitOptions = () => {
    if (splitType === 'push-pull-legs') {
      return ['Push', 'Pull', 'Legs'];
    }
    if (splitType === 'upper-lower') {
      return ['Upper', 'Lower'];
    }
    return ['Push', 'Pull', 'Legs', 'Cardio', 'Core', 'Upper', 'Lower'];
  };

  const handleSplitSelect = (type: 'push-pull-legs' | 'upper-lower' | 'custom') => {
    setSplitType(type);
    setSelectedDay('');
    setDayType('');
  };

  const handleDaySelect = (day: string, type: string) => {
    setSelectedDay(day);
    setDayType(type);
    setSlots(Array(5).fill(null).map(() => ({
      exercise: null,
      sets: 3,
      reps: '10',
      weight: 0
    })));
  };

  const getExerciseType = (dayType: string): string => {
    const typeMap: Record<string, string> = {
      'Push': 'push',
      'pull': 'pull',
      'Pull': 'pull',
      'Legs': 'legs',
      'legs': 'legs',
      'Upper': 'push',
      'Lower': 'legs',
      'upper': 'push',
      'lower': 'legs',
      'upper body': 'push',
      'lower body': 'legs',
      'Cardio': 'cardio',
      'cardio': 'cardio',
      'Core': 'core',
      'core': 'core'
    };
    return typeMap[dayType] || 'push';
  };

  const openExerciseList = (slotIndex: number) => {
    setSelectedSlot(slotIndex);
    setShowExerciseList(true);
  };

  const selectExercise = (exercise: Exercise) => {
    if (selectedSlot === null) return;
    
    const newSlots = [...slots];
    newSlots[selectedSlot] = {
      ...newSlots[selectedSlot],
      exercise
    };
    setSlots(newSlots);
    setShowExerciseList(false);
    setSelectedSlot(null);
  };

  const updateSlot = (slotIndex: number, field: keyof DaySlot, value: any) => {
    const newSlots = [...slots];
    newSlots[slotIndex] = {
      ...newSlots[slotIndex],
      [field]: value
    };
    setSlots(newSlots);
  };

  const saveDay = () => {
    if (!selectedDay || !dayType) return;

    const exercises: WorkoutExercise[] = slots
      .filter(slot => slot.exercise)
      .map(slot => ({
        name: slot.exercise!.name,
        sets: slot.sets,
        reps: slot.reps,
        targetWeight: slot.weight,
        muscleGroup: slot.exercise!.muscle,
        restSeconds: 90,
        formTip: ''
      }));

    const workoutDay: WorkoutDay = {
      day: selectedDay,
      focus: dayType,
      exercises
    };

    const currentPlan = JSON.parse(localStorage.getItem('forgefit_workout_plan') || '{"weeklyPlan": []}');
    const plan = { ...currentPlan };
    const dayIndex = plan.weeklyPlan.findIndex((d: any) => d.day === selectedDay);
    
    if (dayIndex >= 0) {
      plan.weeklyPlan[dayIndex] = workoutDay;
    } else {
      plan.weeklyPlan.push(workoutDay);
    }

    localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
    setWorkoutPlan(plan);
    setSplitData(prev => ({
      ...prev,
      [selectedDay]: {
        type: dayType,
        slots
      }
    }));
  };

  const saveWeek = () => {
    const weeklyPlan: WorkoutDay[] = Object.entries(splitData).map(([day, data]) => ({
      day,
      focus: data.type,
      exercises: data.slots
        .filter(slot => slot.exercise)
        .map(slot => ({
          name: slot.exercise!.name,
          sets: slot.sets,
          reps: slot.reps,
          targetWeight: slot.weight,
          muscleGroup: slot.exercise!.muscle,
          restSeconds: 90,
          formTip: ''
        }))
    }));

    const plan = { weeklyPlan, generatedAt: Date.now() };
    localStorage.setItem('forgefit_workout_plan', JSON.stringify(plan));
    setWorkoutPlan(plan);
    setCurrentPage('workout-tracker');
  };

  const getAvailableExercises = () => {
    if (!profile) return [];
    
    const normalizedDayType = dayType.toLowerCase();
    
    // Handle custom split mapping for combined exercise groups
    if (normalizedDayType === 'upper' || normalizedDayType === 'upper body') {
      const upperExercises = [...(groupedExercises.push || []), ...(groupedExercises.pull || [])];
      const uniqueExercises = Array.from(new Map(upperExercises.map(ex => [ex.name, ex])).values());
      return uniqueExercises.filter(ex => ex.equipment === profile.equipment || ex.equipment === 'bodyweight');
    }
    
    if (normalizedDayType === 'lower' || normalizedDayType === 'lower body') {
      const lowerExercises = [...(groupedExercises.legs || []), ...(groupedExercises.core || [])];
      const uniqueExercises = Array.from(new Map(lowerExercises.map(ex => [ex.name, ex])).values());
      return uniqueExercises.filter(ex => ex.equipment === profile.equipment || ex.equipment === 'bodyweight');
    }
    
    // Handle standard single-type exercises
    const exerciseType = getExerciseType(dayType);
    return getExercises(exerciseType, profile.equipment);
  };

  if (!splitType) {
    return (
      <div className="min-h-screen pb-8 bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button onClick={() => setCurrentPage('workout-tracker')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading font-bold gradient-text">Choose Workout Split</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
          <div className="grid gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleSplitSelect('push-pull-legs')}
              className="bg-white p-6 cursor-pointer hover:scale-[1.02] transition-all shadow-sm border border-gray-200"
            >
              <div className="flex items-center gap-4">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-lg">Push Pull Legs</h3>
                  <p className="text-muted-foreground text-sm">Classic 3-day split focusing on major movement patterns</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => handleSplitSelect('upper-lower')}
              className="bg-white p-6 cursor-pointer hover:scale-[1.02] transition-all shadow-sm border border-gray-200"
            >
              <div className="flex items-center gap-4">
                <Activity className="w-8 h-8 text-green-500" />
                <div>
                  <h3 className="font-semibold text-lg">Upper Lower</h3>
                  <p className="text-muted-foreground text-sm">2-day split for upper and lower body focus</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => handleSplitSelect('custom')}
              className="bg-white p-6 cursor-pointer hover:scale-[1.02] transition-all shadow-sm border border-gray-200"
            >
              <div className="flex items-center gap-4">
                <Dumbbell className="w-8 h-8 text-purple-500" />
                <div>
                  <h3 className="font-semibold text-lg">Custom</h3>
                  <p className="text-muted-foreground text-sm">Create your own workout split</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedDay) {
    return (
      <div className="min-h-screen pb-8 bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button onClick={() => setSplitType(null)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading font-bold gradient-text">Select Workout Days</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
          {weekDays.map((day) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: weekDays.indexOf(day) * 0.1 }}
              className="bg-white p-4 shadow-sm border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{day}</h3>
                <div className="flex gap-2">
                  {getSplitOptions().map((type) => (
                    <button
                      key={type}
                      onClick={() => handleDaySelect(day, type)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => setSelectedDay('')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-bold gradient-text">{selectedDay} - {dayType} Day</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <div className="space-y-4">
          {slots.map((slot, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white p-4 shadow-sm border border-gray-200"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Slot {index + 1}</h4>
                <button
                  onClick={() => openExerciseList(index)}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Exercise
                </button>
              </div>

              {slot.exercise ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <h5 className="font-medium">{slot.exercise.name}</h5>
                    <div className="text-sm text-muted-foreground">
                      {slot.exercise.muscle} • {slot.exercise.equipment} • {slot.exercise.difficulty}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Sets</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={slot.sets}
                        onChange={(e) => updateSlot(index, 'sets', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Reps</label>
                      <input
                        type="text"
                        value={slot.reps}
                        onChange={(e) => updateSlot(index, 'reps', e.target.value)}
                        placeholder="10 or 8-12"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {slot.exercise.equipment !== 'bodyweight' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="2.5"
                          value={slot.weight}
                          onChange={(e) => updateSlot(index, 'weight', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Click "Add Exercise" to select an exercise for this slot
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={saveDay}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors font-medium"
          >
            Save Day
          </button>
          <button
            onClick={saveWeek}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Save Entire Week
          </button>
        </div>
      </div>

      {showExerciseList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-lg">Select Exercise</h3>
              <button
                onClick={() => setShowExerciseList(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {getAvailableExercises().map((exercise) => (
                  <button
                    key={exercise.name}
                    onClick={() => selectExercise(exercise)}
                    className="w-full text-left p-3 bg-white hover:scale-[1.02] transition-all shadow-sm border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{exercise.name}</h4>
                        <div className="text-sm text-muted-foreground">
                          {exercise.muscle} • {exercise.equipment} • {exercise.difficulty}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
