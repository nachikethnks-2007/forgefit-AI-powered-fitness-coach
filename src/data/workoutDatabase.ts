export type Exercise = {
  name: string;
  type: string;
  muscle: string;
  equipment: string;
  difficulty: string;
};

export const exercises: Exercise[] = [
  // Push exercises 
  { name: "Wall push-ups", type: "push", muscle: "chest", equipment: "bodyweight", difficulty: "easy" },
  { name: "Inclined push-ups", type: "push", muscle: "chest", equipment: "bodyweight", difficulty: "easy" },
  { name: "Knee push-ups", type: "push", muscle: "chest", equipment: "bodyweight", difficulty: "medium" },
  { name: "Negative Push-ups", type: "push", muscle: "chest", equipment: "bodyweight", difficulty: "medium" },
  { name: "Push-ups", type: "push", muscle: "chest", equipment: "bodyweight", difficulty: "medium" },
  { name: "Declined Push-ups", type: "push", muscle: "chest", equipment: "bodyweight", difficulty: "hard" },
  { name: "Dumbbell Floor Press", type: "push", muscle: "chest", equipment: "dumbbell", difficulty: "easy" },
  { name: "Dumbbell Bench Press", type: "push", muscle: "chest", equipment: "dumbbell", difficulty: "medium" },
  { name: "Inclined Dumbbell Bench Press", type: "push", muscle: "chest", equipment: "dumbbell", difficulty: "medium" },
  { name: "Dumbbell Chest Flyes", type: "push", muscle: "chest", equipment: "dumbbell", difficulty: "medium" },
  { name: "Barbell Bench Press", type: "push", muscle: "chest", equipment: "gym", difficulty: "hard" },
  { name: "Chest Press Machine", type: "push", muscle: "chest", equipment: "gym", difficulty: "hard" },
  { name: "Cable Chest Flyes", type: "push", muscle: "chest", equipment: "gym", difficulty: "medium" },
  { name: "Shoulder Taps", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "easy" },
  { name: "Inclined Pike Pushups", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "medium" },
  { name: "Negative Pike Pushups", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "medium" },
  { name: "Pike Pushups", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "medium" },
  { name: "Elevated Pike Pushups", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "hard" },
  { name: "Wall Walks", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "hard" },
  { name: "Hand Stand", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "hard" },
  { name: "Hand Stand Pushups", type: "push", muscle: "shoulders", equipment: "bodyweight", difficulty: "hard" },
  { name: "Dumbbell Shoulder Press", type: "push", muscle: "shoulders", equipment: "dumbbell", difficulty: "medium" },
  { name: "Arnold Press", type: "push", muscle: "shoulders", equipment: "dumbbell", difficulty: "medium" },
  { name: "Lateral Raises", type: "push", muscle: "shoulders", equipment: "dumbbell", difficulty: "easy" },
  { name: "Front Raises", type: "push", muscle: "shoulders", equipment: "dumbbell", difficulty: "easy" },
  { name: "Shoulder Press Machine", type: "push", muscle: "shoulders", equipment: "gym", difficulty: "medium" },
  { name: "Overhead Press", type: "push", muscle: "shoulders", equipment: "gym", difficulty: "hard" },
  { name: "Cable Lateral Raises", type: "push", muscle: "shoulders", equipment: "gym", difficulty: "medium" },
  { name: "Reverse Pec Deck Flyes", type: "push", muscle: "shoulders", equipment: "gym", difficulty: "medium" },
  { name: "Bench Dips", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "easy" },
  { name: "Diamond Knee Pushups", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "easy" },
  { name: "Inclined Diamond Pushups", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "easy" },
  { name: "Diamond Pushups", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "medium" },
  { name: "Legs Elevated Bench Dips", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "medium" },
  { name: "Parallel Bar Support Hold", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "medium" },
  { name: "Negative Parallel Bar Dips", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "hard" },
  { name: "Parallel Bar Dips", type: "push", muscle: "triceps", equipment: "bodyweight", difficulty: "hard" },
  { name: "Dumbbell Tricep Kickbacks", type: "push", muscle: "triceps", equipment: "dumbbell", difficulty: "medium" },
  { name: "Overhead Dumbbell Extension", type: "push", muscle: "triceps", equipment: "dumbbell", difficulty: "medium" },
  { name: "Dumbbell Skull Crushers", type: "push", muscle: "triceps", equipment: "dumbbell", difficulty: "medium" },
  { name: "Tricep Rope Pushdown", type: "push", muscle: "triceps", equipment: "gym", difficulty: "medium" },
  { name: "Close Grip Bench Press", type: "push", muscle: "triceps", equipment: "gym", difficulty: "medium" },

  // Pull exercises
  { name: "Incline Inverted Rows", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "medium" },
  { name: "Deadhang", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "medium" },
  { name: "Activehang", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "medium" },
  { name: "Scapula Pull-ups", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "medium" },
  { name: "Negative Pull-ups", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "hard" },
  { name: "Chin-ups", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "hard" },
  { name: "Pull-ups", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "hard" },
  { name: "Muscle-ups", type: "pull", muscle: "back", equipment: "bodyweight", difficulty: "hard" },
  { name: "Single Arm Dumbbell Row", type: "pull", muscle: "back", equipment: "dumbbell", difficulty: "easy" },
  { name: "Dumbbell Chest Supported Row", type: "pull", muscle: "back", equipment: "dumbbell", difficulty: "medium" },
  { name: "Dumbbell Pullover", type: "pull", muscle: "back", equipment: "dumbbell", difficulty: "medium" },
  { name: "Dumbbell Shrugs", type: "pull", muscle: "back", equipment: "dumbbell", difficulty: "easy" },
  { name: "Barbell Bent Over Row", type: "pull", muscle: "back", equipment: "gym", difficulty: "hard" },
  { name: "Barbell Deadlift", type: "pull", muscle: "back", equipment: "gym", difficulty: "hard" },
  { name: "Barbell Shrugs", type: "pull", muscle: "back", equipment: "gym", difficulty: "medium" },
  { name: "Lat Pulldowns", type: "pull", muscle: "back", equipment: "gym", difficulty: "medium" },
  { name: "Seated Cable Rows", type: "pull", muscle: "back", equipment: "gym", difficulty: "medium" },
  { name: "Floor Y and T Raises", type: "pull", muscle: "shoulders", equipment: "bodyweight", difficulty: "easy" },
  { name: "Superman Pulldowns", type: "pull", muscle: "shoulders", equipment: "bodyweight", difficulty: "medium" },
  { name: "Superman Hold", type: "pull", muscle: "shoulders", equipment: "bodyweight", difficulty: "medium" },
  { name: "Dumbbell Reverse Flyes", type: "pull", muscle: "shoulders", equipment: "dumbbell", difficulty: "medium" },
  { name: "Face Pulls", type: "pull", muscle: "shoulders", equipment: "gym", difficulty: "medium" },
  { name: "Inverted Bicep Curls", type: "pull", muscle: "biceps", equipment: "bodyweight", difficulty: "medium" },
  { name: "Pelican Curls", type: "pull", muscle: "biceps", equipment: "bodyweight", difficulty: "medium" },
  { name: "Dumbbell Bicep Curls", type: "pull", muscle: "biceps", equipment: "dumbbell", difficulty: "easy" },
  { name: "Hammer Curls", type: "pull", muscle: "biceps", equipment: "dumbbell", difficulty: "easy" },
  { name: "Concentration Curls", type: "pull", muscle: "biceps", equipment: "dumbbell", difficulty: "medium" },
  { name: "Cable Bicep Curls", type: "pull", muscle: "biceps", equipment: "gym", difficulty: "easy" },
  { name: "Preacher Curl Machine", type: "pull", muscle: "biceps", equipment: "gym", difficulty: "medium" },

  // Legs exercises
  { name: "Bodyweight Squats", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Box Squats", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Lunges", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Bulgarian Split Squats", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Pistol Squats", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "hard" },
  { name: "Glute Bridges", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Single Leg Glute Bridges", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "hard" },
  { name: "Nordic Curls", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "hard" },
  { name: "Calf Raises", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Elevated Calf Raises", type: "legs", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Goblet Squat", type: "legs", muscle: "legs", equipment: "dumbbell", difficulty: "medium" },
  { name: "Weighted Lunges", type: "legs", muscle: "legs", equipment: "dumbbell", difficulty: "hard" },
  { name: "Dumbbell Step Ups", type: "legs", muscle: "legs", equipment: "dumbbell", difficulty: "hard" },
  { name: "Dumbbell Romanian Deadlift", type: "legs", muscle: "legs", equipment: "dumbbell", difficulty: "hard" },
  { name: "Dumbbell Hamstring Curl", type: "legs", muscle: "legs", equipment: "dumbbell", difficulty: "hard" },
  { name: "Barbell Back Squat", type: "legs", muscle: "legs", equipment: "gym", difficulty: "hard" },
  { name: "Barbell Deadlift", type: "legs", muscle: "legs", equipment: "gym", difficulty: "hard" },
  { name: "Barbell Hip Thrust", type: "legs", muscle: "legs", equipment: "gym", difficulty: "hard" },
  { name: "Leg Press Machine", type: "legs", muscle: "legs", equipment: "gym", difficulty: "medium" },
  { name: "Leg Extension Machine", type: "legs", muscle: "legs", equipment: "gym", difficulty: "easy" },
  { name: "Seated Leg Curl Machine", type: "legs", muscle: "legs", equipment: "gym", difficulty: "easy" },
  { name: "Hack Squat Machine", type: "legs", muscle: "legs", equipment: "gym", difficulty: "hard" },

  // Core exercises
  { name: "Plank", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Side Plank", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Hollow Body Hold", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "hard" },
  { name: "Reverse Crunches", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Bicycle Crunches", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "hard" },
  { name: "V-Ups", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "hard" },
  { name: "Heel Touches", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "easy" },
  { name: "Russian Twists", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Hanging Knee Raises", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Hanging Leg Raises", type: "core", muscle: "abs", equipment: "bodyweight", difficulty: "medium" },

  // Cardio exercises
  { name: "Jumping Jacks", type: "cardio", muscle: "legs", equipment: "bodyweight", difficulty: "easy" },
  { name: "High Knees", type: "cardio", muscle: "legs", equipment: "bodyweight", difficulty: "easy" },
  { name: "Mountain Climbers", type: "cardio", muscle: "abs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Burpees", type: "cardio", muscle: "legs", equipment: "bodyweight", difficulty: "hard" },
  { name: "Jump Rope", type: "cardio", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Jogging", type: "cardio", muscle: "legs", equipment: "bodyweight", difficulty: "medium" },
  { name: "Running", type: "cardio", muscle: "legs", equipment: "bodyweight", difficulty: "hard" },
  { name: "Walking", type: "cardio", muscle: "legs", equipment: "bodyweight", difficulty: "easy" },
  { name: "Treadmill Jogging", type: "cardio", muscle: "legs", equipment: "gym", difficulty: "medium" },
  { name: "Treadmill Walking", type: "cardio", muscle: "legs", equipment: "gym", difficulty: "easy" }
];

// Group exercises by type using Array.reduce()
export const groupedExercises: Record<string, Exercise[]> = exercises.reduce((acc, exercise) => {
  const { type } = exercise;
  if (!acc[type]) {
    acc[type] = [];
  }
  acc[type].push(exercise);
  return acc;
}, {} as Record<string, Exercise[]>);

// Filter exercises by type and equipment
export const getExercises = (type: string, equipment: string): Exercise[] => {
  const typeExercises = groupedExercises[type] || [];
  
  if (equipment === 'bodyweight') {
    return typeExercises;
  }
  
  return typeExercises.filter(exercise => 
    exercise.equipment === equipment || exercise.equipment === 'bodyweight'
  );
};
