/* ==================== AI SERVICE LAYER ==================== */
/* This service handles all AI communication with the backend */
/* Frontend NEVER directly calls Groq or any AI provider */
/* All AI calls go through Supabase Edge Function */

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  toolSummaries?: string[];
}

export interface WorkoutAnalysisRequest {
  workoutLogs: any[];
  profile: any;
  exerciseAnalysis?: any;
}

export interface NutritionAnalysisRequest {
  measurements: any[];
  profile: any;
  nutritionPlan: any;
}

/* ==================== BACKEND CONFIGURATION ==================== */

const SUPABASE_AI_ENDPOINT = 'https://izphqmekabhtosqtommm.supabase.co/functions/v1/ai-coach';

/* ==================== ERROR HANDLING ==================== */

class AIServiceError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/* ==================== BACKEND API CALLS ==================== */

/**
 * Generic API call to Supabase Edge Function
 */
async function callSupabaseAI(message: string): Promise<string> {
  try {
    const response = await fetch(SUPABASE_AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
      }),
    });

    if (!response.ok) {
      throw new AIServiceError(
        `Backend error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    
    if (!data.response) {
      throw new AIServiceError('Invalid response format from backend');
    }
    
    return data.response;
  } catch (error) {
    if (error instanceof AIServiceError) {
      throw error;
    }
    throw new AIServiceError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

/**
 * Get AI Coach response from backend
 */
export async function getAICoachResponse(
  messages: AIChatMessage[],
  context?: any
): Promise<AIResponse> {
  try {
    // Convert messages to a single message for the backend
    const lastUserMessage = messages
      .filter((m) => m.role === 'user')
      .pop()?.content || '';
    
    if (!lastUserMessage) {
      throw new AIServiceError('No user message provided');
    }

    const response = await callSupabaseAI(lastUserMessage);
    
    return {
      content: response,
      toolSummaries: [],
    };
  } catch (error) {
    console.error('AI Coach API call failed:', error);
    throw error;
  }
}

/**
 * Analyze workout data using AI
 */
export async function analyzeWorkout(
  request: WorkoutAnalysisRequest
): Promise<string> {
  try {
    const message = JSON.stringify({
      type: 'workout_analysis',
      ...request,
    });
    
    return await callSupabaseAI(message);
  } catch (error) {
    console.error('Workout analysis API call failed:', error);
    throw error;
  }
}

/**
 * Analyze nutrition data using AI
 */
export async function analyzeNutrition(
  request: NutritionAnalysisRequest
): Promise<string> {
  try {
    const message = JSON.stringify({
      type: 'nutrition_analysis',
      ...request,
    });
    
    return await callSupabaseAI(message);
  } catch (error) {
    console.error('Nutrition analysis API call failed:', error);
    throw error;
  }
}

/**
 * Generate workout plan using AI
 */
export async function generateWorkoutPlan(
  profile: any
): Promise<any> {
  try {
    const message = JSON.stringify({
      type: 'workout_plan',
      profile,
    });
    
    const response = await callSupabaseAI(message);
    
    // Try to parse as JSON, if it's a structured response
    try {
      return JSON.parse(response);
    } catch {
      // If not JSON, return as plain text
      return { weeklyPlan: [], generatedAt: Date.now(), rawResponse: response };
    }
  } catch (error) {
    console.error('Workout plan generation API call failed:', error);
    throw error;
  }
}

/**
 * Get AI recommendations
 */
export async function getRecommendations(
  context: any
): Promise<string> {
  try {
    const message = JSON.stringify({
      type: 'recommendations',
      ...context,
    });
    
    return await callSupabaseAI(message);
  } catch (error) {
    console.error('Recommendations API call failed:', error);
    throw error;
  }
}

/* ==================== UTILITY FUNCTIONS ==================== */

/**
 * Convert chat history to API payload format
 */
export function chatMessagesToApiPayload(
  history: any[]
): AIChatMessage[] {
  return history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

/**
 * Check if backend is available
 */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(SUPABASE_AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'health check',
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}

/**
 * Get friendly error message for display
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AIServiceError) {
    if (error.statusCode === 401) {
      return 'Authentication failed. Please check your API configuration.';
    }
    if (error.statusCode === 429) {
      return 'Too many requests. Please try again later.';
    }
    if (error.statusCode === 500) {
      return 'Server error. Please try again later.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
