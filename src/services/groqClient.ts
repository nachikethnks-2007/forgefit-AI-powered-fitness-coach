import type { UserProfile, NutritionPlan, ChatMessage } from '@/types/fitness';
import { buildCompleteNutritionPlan } from '@/utils/calculations';
import { useAppStore } from '@/store/useAppStore';
import { FORGEFIT_GROQ_TOOLS, executeForgefitTool } from '@/utils/aiTools';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TOOL_MODEL = 'llama-3.3-70b-versatile';

interface GroqToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface GroqMessage {
  role: string;
  content?: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

interface GroqChoice {
  message: GroqMessage;
}

interface GroqResponse {
  choices: GroqChoice[];
}

/* ---------------- BASIC CALL ---------------- */

export async function callGroq(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = localStorage.getItem('groqApiKey');
  console.log('API key used:', apiKey?.slice(0, 8) + '...');
  if (!apiKey) throw new Error('Missing API key');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TOOL_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error: ${text}`);
  }

  const data: GroqResponse = await res.json();
  return data.choices[0]?.message?.content || '';
}

/* ---------------- HELPERS ---------------- */

function formatTodayFoodTotals(): string {
  const { foodLog } = useAppStore.getState();
  const today = new Date().toISOString().split('T')[0];

  const rows = foodLog.filter((f) => f.date === today);
  if (!rows.length) return 'No food logged today.';

  const totalCalories = rows.reduce((a, f) => a + f.calories, 0);

  return `Today's calories: ${totalCalories}. Foods: ${rows.map((f) => f.name).join(', ')}`;
}

function lastFourWeeksWeightTrend(): string {
  const { measurements } = useAppStore.getState();
  const cutoff = Date.now() - 28 * 86400000;

  const rows = measurements
    .filter((m) => new Date(m.date + 'T12:00:00').getTime() >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!rows.length) return 'No weigh-ins in last 4 weeks.';

  return rows.map((m) => `${m.date}: ${m.weight}`).join(', ');
}

/* ---------------- SYSTEM PROMPT ---------------- */

export function buildForgeFitAISystemPrompt(extra = ''): string {
  const { profile, nutritionPlan } = useAppStore.getState();

  if (!profile || !nutritionPlan) return 'User data missing.';

  const bodyweightConstraint = profile.equipment === 'bodyweight' ? `
CRITICAL: User equipment preference is ${profile.equipment}. If equipment is bodyweight, you must ONLY generate bodyweight exercises. Never suggest any exercise requiring gym equipment, barbells, dumbbells, cables or machines. Bodyweight exercises only include: Push-up, Knee Push-up, Wall Push-up, Diamond Push-up, Pike Push-up, Decline Push-up, Pull-up, Chin-up, Inverted Row, Australian Pull-up, Bodyweight Squat, Lunge, Bulgarian Split Squat, Glute Bridge, Hip Thrust, Wall Sit, Calf Raise, Plank, Side Plank, Dead Bug, Hollow Body Hold, Leg Raise, Bicycle Crunch, Tricep Dip using chair, Mountain Climber, Burpee, Jump Squat.` : '';

  return `You are a simplified fitness AI coach.

User: ${profile.name}, goal: ${profile.mode}

Daily target: ${nutritionPlan.dailyCalories} kcal
Protein target: ${nutritionPlan.protein}g

${formatTodayFoodTotals()}

Weight trend: ${lastFourWeeksWeightTrend()}

${bodyweightConstraint}

SIMPLIFIED AI COACH RULES:
1. You control ONLY: Calories, Macros, Workout Tracker (exercises, reps, difficulty, split)
2. NEVER run frequently - only respond to user requests or scheduled analyses
3. Exercise Replacement: Use replace_exercise when user can't do exercise or wants different one
4. Workout Split: Use change_workout_split when user explicitly requests new split
5. Volume Adjustment: Use adjust_exercise_volume for progressive overload
6. Nutrition: Use update_nutrition_targets for calories/macros changes
7. Always use flag_alert to explain changes and next steps
8. Be conservative and prioritize safety in all recommendations

CRITICAL: NUMERIC FIELD REQUIREMENTS
- ALL numeric fields MUST be sent as actual numbers, NOT strings
- calories: 2000 (not "2000")
- protein: 150 (not "150") 
- carbs: 200 (not "200")
- fats: 65 (not "65")
- sets: 3 (not "3")
- days_per_week: 4 (not "4")
- ONLY reps field can be string (like "10" or "8-12")
- Failure to send numbers as numbers will cause tool call validation errors

${extra}

Focus on helping user progressively get stronger and reach their fitness goal efficiently.`;
}

/* ---------------- MAIN TOOL CALL ---------------- */

export async function callGroqWithTools(
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: { extraSystemSuffix?: string }
): Promise<{ content: string; toolSummaries: string[] }> {

  const apiKey = localStorage.getItem('groqApiKey');
  if (!apiKey) throw new Error('Missing API key');

  const system = buildForgeFitAISystemPrompt(options?.extraSystemSuffix ?? '');

  const messages: GroqMessage[] = [
    { role: 'system', content: system },
    ...conversationMessages,
  ];

  const toolSummaries: string[] = [];
  const maxRounds = 2;

  for (let round = 0; round < maxRounds; round++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TOOL_MODEL,
        messages,
        tools: FORGEFIT_GROQ_TOOLS,
        tool_choice: 'auto',
        temperature: 0.5,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const text = await res.text();

      if (text.includes("rate_limit_exceeded")) {
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }

      throw new Error(text);
    }

    const data: GroqResponse = await res.json();
    const message = data.choices?.[0]?.message;
    if (!message) break;

    messages.push(message);

    // Check for proper tool calls first
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          const result = executeForgefitTool(toolName, JSON.stringify(toolArgs));

          toolSummaries.push(result.summary);

          // Add result as tool response message
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ ok: result.ok, summary: result.summary }),
          });
        }
      }
    } else {
      // Also check if AI returned tool call as raw text (fallback)
      // Look for pattern <function=toolname>{...}</function> in message.content
      // If found parse it and execute manually
      const rawText = message.content || '';
      const functionMatch = rawText.match(/<function=(\w+)>(.*?)<\/function>/s);
      if (functionMatch) {
        const toolName = functionMatch[1];
        const toolArgs = JSON.parse(functionMatch[2]);
        const result = executeForgefitTool(toolName, JSON.stringify(toolArgs));

        toolSummaries.push(result.summary);
      }
    }

    // Check if we have tool calls to continue conversation
    const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
    const hasRawFunction = (message.content || '').match(/<function=(\w+)>(.*?)<\/function>/s);
    
    if (!hasToolCalls && !hasRawFunction) {
      return { content: message.content?.trim() || '', toolSummaries };
    }
  }

  // Dispatch workout plan updated event to re-render immediately
  if (toolSummaries.length > 0) {
    window.dispatchEvent(new Event('workoutPlanUpdated'));
  }

  return { content: '', toolSummaries };
}

/* ---------------- WORKOUT GENERATION (ADDED BACK) ---------------- */

export async function generateWorkoutPlan(
  _apiKey: string,
  profile: UserProfile
): Promise<string> {

  const bodyweightConstraint = profile.equipment === 'bodyweight' ? `
CRITICAL: User equipment preference is ${profile.equipment}. If equipment is bodyweight, you must ONLY generate bodyweight exercises. Never suggest any exercise requiring gym equipment, barbells, dumbbells, cables or machines. Bodyweight exercises only include: Push-up, Knee Push-up, Wall Push-up, Diamond Push-up, Pike Push-up, Decline Push-up, Pull-up, Chin-up, Inverted Row, Australian Pull-up, Bodyweight Squat, Lunge, Bulgarian Split Squat, Glute Bridge, Hip Thrust, Wall Sit, Calf Raise, Plank, Side Plank, Dead Bug, Hollow Body Hold, Leg Raise, Bicycle Crunch, Tricep Dip using chair, Mountain Climber, Burpee, Jump Squat.` : '';

  const prompt = `
Create a structured weekly workout plan.

User details:
- Fitness level: ${profile.fitnessLevel}
- Training days per week: ${profile.trainingDays}
- Goal: ${profile.mode}
- Equipment available: ${profile.equipment}

${bodyweightConstraint}

Return ONLY valid JSON in this format:
{
  "weeklyPlan": [
    {
      "day": "Monday",
      "focus": "Upper Body Push",
      "exercises": [
        {
          "name": "Push-up",
          "sets": 3,
          "reps": "10",
          "targetWeight": 0,
          "muscleGroup": "chest"
        }
      ]
    }
  ]
}
`;

  return await callGroq([
    {
      role: 'system',
      content: 'You are a fitness coach. Return ONLY JSON.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]);
}

/* ---------------- OTHER ---------------- */

export function calculateNutritionPlan(_apiKey: string, profile: UserProfile): Promise<NutritionPlan> {
  return Promise.resolve(buildCompleteNutritionPlan(profile));
}

export function chatMessagesToApiPayload(
  history: ChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

// Add API key logging for debugging
console.log('API key used:', localStorage.getItem('groqApiKey')?.slice(0, 8) + '...');