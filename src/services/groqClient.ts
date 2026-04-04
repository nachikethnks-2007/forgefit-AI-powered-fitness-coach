import type { UserProfile, NutritionPlan } from '@/types/fitness';
import { buildCompleteNutritionPlan } from '@/utils/calculations';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqResponse {
  choices: Array<{
    message: { role: string; content: string };
  }>;
}

export async function callGroq(
  messages: Array<{ role: string; content: string }>,
  model = 'llama-3.3-70b-versatile'
): Promise<string> {

  const apiKey = localStorage.getItem("groqApiKey");

  if (!apiKey) {
    throw new Error("Missing API key");
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error (${res.status}): ${text}`);
  }

  const data: GroqResponse = await res.json();
  return data.choices[0]?.message?.content || '';
}

export function buildSystemPrompt(profile: UserProfile, plan: NutritionPlan | null, extraContext = ''): string {
  const modeLabel = { cut: 'Cutting (fat loss)', bulk: 'Bulking (muscle gain)', recomposition: 'Body Recomposition' };
  return `You are ForgeFit AI, an expert fitness and nutrition coach. You have full context of this user:

Name: ${profile.name}
Age: ${profile.age}, Sex: ${profile.sex}
Mode: ${modeLabel[profile.mode]}
Height: ${profile.height}${profile.units === 'metric' ? 'cm' : 'in'}, Weight: ${profile.weight}${profile.units === 'metric' ? 'kg' : 'lbs'}
Fitness Level: ${profile.fitnessLevel}, Activity: ${profile.activityLevel}
Training Days: ${profile.trainingDays}/week, Equipment: ${profile.equipment}
Diet Preference: ${profile.dietPref}
${profile.injuries ? `Injuries/Limitations: ${profile.injuries}` : ''}
${profile.targetWeight ? `Target Weight: ${profile.targetWeight}${profile.units === 'metric' ? 'kg' : 'lbs'}` : ''}
Timeline: ${profile.timeline}

${plan ? `Current Plan:
- Body Fat: ${plan.bodyFatPercent}%
- BMR: ${plan.bmr} kcal, TDEE: ${plan.tdee} kcal
- Daily Target: ${plan.dailyCalories} kcal
- Macros: ${plan.protein}g protein, ${plan.carbs}g carbs, ${plan.fats}g fats` : ''}

${extraContext}

Be concise, actionable, and supportive. Use data to back up recommendations.`;
}

/** Nutrition metrics use deterministic formulas only (see @/utils/calculations). */
export function calculateNutritionPlan(_apiKey: string, profile: UserProfile): Promise<NutritionPlan> {
  return Promise.resolve(buildCompleteNutritionPlan(profile));
}

export async function generateWorkoutPlan(apiKey: string, profile: UserProfile): Promise<string> {
  const prompt = `Create a weekly workout plan for this user. Return ONLY valid JSON (no markdown):
{
  "weeklyPlan": [
    {
      "day": "Monday",
      "label": "Push Day",
      "exercises": [
        { "name": "Exercise Name", "sets": 3, "reps": 10, "weight": 0, "restSeconds": 90, "formTip": "Brief tip" }
      ]
    }
  ]
}

User: ${profile.fitnessLevel} level, ${profile.trainingDays} days/week, ${profile.equipment} equipment, mode: ${profile.mode}.
${profile.injuries ? `Injuries: ${profile.injuries}` : ''}`;

  return await callGroq([
    { role: 'system', content: 'You are an expert workout programmer. Return ONLY valid JSON.' },
    { role: 'user', content: prompt },
  ]);
}
