import type { UserProfile, WorkoutSession } from '@/types/fitness';

// Helper function to count workouts in last 7 days
export function getWorkoutsLast7Days(logs: WorkoutSession[]): number {
  if (!Array.isArray(logs) || logs.length === 0) {
    return 0;
  }

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  // Count workouts based on workout logs
  const recentWorkouts = logs.filter((log: WorkoutSession) => {
    console.log("RAW LOG:", log);
    
    // Safe date extraction - handle both date and timestamp
    let d: Date | null = null;
    
    if (log.date) {
      d = new Date(log.date);
      // If date is just "YYYY-MM-DD", it might be timezone issues
      if (d && !isNaN(d.getTime())) {
        console.log("PARSED DATE:", d, "timestamp:", d.getTime());
      }
    } else if ((log as any).timestamp) {
      d = new Date((log as any).timestamp);
      console.log("PARSED TIMESTAMP:", d);
    }

    if (!d || isNaN(d.getTime())) {
      console.log("INVALID DATE - skipping log");
      return false;
    }

    const workoutDate = d.getTime();
    const isRecent = workoutDate > sevenDaysAgo;
    console.log("Workout date:", workoutDate, "sevenDaysAgo:", sevenDaysAgo, "isRecent:", isRecent);
    
    return isRecent;
  });

  // Group by date to count unique workout days
  const uniqueWorkoutDays = new Set(
    recentWorkouts.map((log: WorkoutSession) => {
      // Safe date extraction for grouping
      let d: Date | null = null;
      
      if (log.date) {
        d = new Date(log.date);
      } else if ((log as any).timestamp) {
        d = new Date((log as any).timestamp);
      }

      if (!d || isNaN(d.getTime())) {
        return 'invalid-date';
      }

      const date = d.toISOString().split('T')[0];
      return date;
    })
  );

  // Filter out invalid dates
  const validWorkoutDays = Array.from(uniqueWorkoutDays).filter(date => date !== 'invalid-date');

  console.log(`Workouts in last 7 days: ${validWorkoutDays.length}`);
  console.log("Unique workout days:", validWorkoutDays);
  return validWorkoutDays.length;
}

// New function to get workout logs from localStorage
function getWorkoutLogsFromStorage() {
  try {
    const logsString = localStorage.getItem('forgefit_workout_logs');
    if (!logsString) return [];
    
    const logs = JSON.parse(logsString);
    return Array.isArray(logs) ? logs : [];
  } catch (error) {
    console.error('Error parsing workout logs:', error);
    return [];
  }
}

// Map workout frequency to activity level
export function getAdaptiveActivityLevel(workoutsPerWeek: number): string {
  if (workoutsPerWeek === 0) {
    return 'sedentary';
  } else if (workoutsPerWeek >= 1 && workoutsPerWeek <= 2) {
    return 'lightly_active';
  } else if (workoutsPerWeek >= 3 && workoutsPerWeek <= 4) {
    return 'moderately_active';
  } else if (workoutsPerWeek >= 5) {
    return 'very_active';
  }
  
  return 'sedentary'; // fallback
}

// Test function to simulate adaptive TDEE calculation
export function simulateAdaptiveTdee(profile: UserProfile, workoutLogs: WorkoutSession[]): {
  workoutsPerWeek: number;
  adaptiveActivity: string;
  tdee: number;
} {
  // Import BMR calculation function (assuming it exists in calculations)
  // We'll need to import this - for now using a placeholder
  const bmr = calculateBMR(profile);
  
  // Get workout logs from localStorage (this is where actual workout data is stored)
  const actualWorkoutLogs = getWorkoutLogsFromStorage();
  console.log("STORE workoutSessions:", workoutLogs.length);
  console.log("LOCALSTORAGE workout logs:", actualWorkoutLogs.length);
  
  // Count workouts in last 7 days using localStorage data
  const workoutsLast7Days = getWorkoutsLast7Days(actualWorkoutLogs);
  
  // Get adaptive activity level
  const adaptiveActivity = getAdaptiveActivityLevel(workoutsLast7Days);
  
  // Activity multipliers (same as existing system)
  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9
  };
  
  // Calculate TDEE using adaptive activity level
  const multiplier = activityMultipliers[adaptiveActivity as keyof typeof activityMultipliers] || 1.2;
  const tdee = Math.round(bmr * multiplier);
  
  console.log("=== Adaptive Activity Test ===");
  console.log("Workouts last 7 days:", workoutsLast7Days);
  console.log("Adaptive Activity:", adaptiveActivity);
  console.log("Activity Multiplier:", multiplier);
  console.log("BMR:", bmr);
  console.log("Adaptive TDEE:", tdee);
  
  return {
    workoutsPerWeek: workoutsLast7Days,
    adaptiveActivity,
    tdee
  };
}

// Placeholder BMR calculation - this should match existing function
function calculateBMR(profile: UserProfile): number {
  // Using Mifflin-St Jeor equation (same as existing system)
  const { weight, height, age, sex } = profile;
  
  if (sex === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
}

// Export types for TypeScript
export type AdaptiveActivityResult = ReturnType<typeof simulateAdaptiveTdee>;
