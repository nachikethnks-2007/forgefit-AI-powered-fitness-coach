export type Mode = 'cut' | 'bulk' | 'recomposition';
export type Sex = 'male' | 'female';
export type Units = 'metric' | 'imperial';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'athlete';
export type Equipment = 'full_gym' | 'home_dumbbells' | 'bodyweight' | 'resistance_bands';
export type Timeline = 'slow' | 'moderate' | 'aggressive';
export type DietPref = 'none' | 'vegetarian' | 'vegan' | 'keto' | 'high_protein';

export interface UserProfile {
  name: string;
  age: number;
  sex: Sex;
  units: Units;
  height: number; // cm or inches
  weight: number; // kg or lbs
  neck: number;
  waist: number;
  hip: number;
  fitnessLevel: FitnessLevel;
  activityLevel: ActivityLevel;
  trainingDays: number;
  equipment: Equipment;
  targetWeight?: number;
  timeline: Timeline;
  injuries?: string;
  dietPref: DietPref;
  mode: Mode;
}

export interface NutritionPlan {
  bodyFatPercent: number;
  bmr: number;
  tdee: number;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  explanation: string;
}

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restSeconds: number;
  formTip: string;
}

export interface WorkoutDay {
  day: string;
  label: string;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  weeklyPlan: WorkoutDay[];
  generatedAt: number;
}

export interface LoggedSet {
  reps: number;
  weight: number;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  dayLabel: string;
  exercises: LoggedExercise[];
  timestamp: number;
}

export interface BodyMeasurement {
  date: string;
  weight: number;
  neck?: number;
  waist?: number;
  hip?: number;
  bodyFatPercent?: number;
  timestamp: number;
}

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'plan_update';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  timestamp: number;
}

export type ForgefitAlertType = 'warning' | 'success' | 'suggestion';

export interface ForgefitAlert {
  id: string;
  type: ForgefitAlertType;
  message: string;
  read: boolean;
  createdAt: number;
}

export interface ForgefitWeeklyCheckin {
  summary: string;
  savedAt: string;
}

export interface CompletedGoal {
  mode: Mode;
  startWeight: number;
  endWeight: number;
  startBodyFat?: number;
  endBodyFat?: number;
  totalWorkouts: number;
  totalVolume: number;
  startDate: string;
  endDate: string;
}

export interface AppState {
  profile: UserProfile | null;
  nutritionPlan: NutritionPlan | null;
  foodLog: FoodEntry[];
  workoutPlan: WorkoutPlan | null;
  workoutSessions: WorkoutSession[];
  measurements: BodyMeasurement[];
  chatHistory: ChatMessage[];
  completedGoals: CompletedGoal[];
  groqApiKey: string;
  currentPage: string;
  forgefitAlerts: ForgefitAlert[];
}
