import { useAppStore } from '@/store/useAppStore';
import { runBiWeeklyWorkoutAnalysis, runMonthlyNutritionAnalysis } from '@/utils/aiTools';

/* ---------------- SCHEDULED AI ANALYSIS ---------------- */

// This replaces the old proactiveAI.ts with a minimal system
// Only runs the 2 scheduled analyses: bi-weekly workout and monthly nutrition

export async function runScheduledAIAnalysis(): Promise<void> {
  const { groqApiKey } = useAppStore.getState();
  
  // Only run if API key is available
  if (!groqApiKey) return;

  try {
    // Run bi-weekly workout analysis (every 14 days)
    await runBiWeeklyWorkoutAnalysis();
    
    // Run monthly nutrition analysis (every 30 days) 
    await runMonthlyNutritionAnalysis();
    
  } catch (error) {
    console.error('Scheduled AI analysis failed:', error);
  }
}

// Export the scheduled functions for direct calling if needed
export { runBiWeeklyWorkoutAnalysis, runMonthlyNutritionAnalysis };
