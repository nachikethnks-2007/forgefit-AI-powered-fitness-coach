import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppState, UserProfile, NutritionPlan, FoodEntry,
  WorkoutPlan, WorkoutSession, BodyMeasurement, ChatMessage, CompletedGoal
} from '@/types/fitness';

interface AppActions {
  setProfile: (profile: UserProfile) => void;
  setNutritionPlan: (plan: NutritionPlan) => void;
  addFoodEntry: (entry: FoodEntry) => void;
  removeFoodEntry: (id: string) => void;
  setWorkoutPlan: (plan: WorkoutPlan) => void;
  addWorkoutSession: (session: WorkoutSession) => void;
  addMeasurement: (m: BodyMeasurement) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChatHistory: () => void;
  completeGoal: (goal: CompletedGoal) => void;
  setGroqApiKey: (key: string) => void;
  setCurrentPage: (page: string) => void;
  resetAll: () => void;
}

const initialState: AppState = {
  profile: null,
  nutritionPlan: null,
  foodLog: [],
  workoutPlan: null,
  workoutSessions: [],
  measurements: [],
  chatHistory: [],
  completedGoals: [],
  groqApiKey: '',
  currentPage: 'home',
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      ...initialState,
      setProfile: (profile) => set({ profile }),
      setNutritionPlan: (plan) => set({ nutritionPlan: plan }),
      addFoodEntry: (entry) => set((s) => ({ foodLog: [...s.foodLog, entry] })),
      removeFoodEntry: (id) => set((s) => ({ foodLog: s.foodLog.filter((f) => f.id !== id) })),
      setWorkoutPlan: (plan) => set({ workoutPlan: plan }),
      addWorkoutSession: (session) => set((s) => ({ workoutSessions: [...s.workoutSessions, session] })),
      addMeasurement: (m) => set((s) => ({ measurements: [...s.measurements, m] })),
      addChatMessage: (msg) => set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
      clearChatHistory: () => set({ chatHistory: [] }),
      completeGoal: (goal) => set((s) => ({
        completedGoals: [...s.completedGoals, goal],
        profile: null,
        nutritionPlan: null,
        foodLog: [],
        workoutPlan: null,
        workoutSessions: [],
        measurements: [],
        chatHistory: [],
        currentPage: 'home',
      })),
      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setCurrentPage: (page) => set({ currentPage: page }),
      resetAll: () => set({ ...initialState }),
    }),
    { name: 'forgefit-storage' }
  )
);
