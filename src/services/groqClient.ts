import type { ChatMessage, UserProfile, NutritionPlan } from '@/types/fitness';

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

export async function calculateNutritionPlan(apiKey: string, profile: UserProfile): Promise<NutritionPlan> {
  const prompt = `Based on this user's data, calculate their fitness metrics. Return ONLY valid JSON (no markdown, no code blocks) with these exact fields:
{
  "bodyFatPercent": number,
  "bmr": number,
  "tdee": number,
  "dailyCalories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "explanation": "string"
}

Use the US Navy body fat formula, Mifflin-St Jeor for BMR, and adjust calories for ${profile.mode} mode (${profile.timeline} pace).

User data:
- Sex: ${profile.sex}, Age: ${profile.age}
- Height: ${profile.height}${profile.units === 'metric' ? 'cm' : 'in'}
- Weight: ${profile.weight}${profile.units === 'metric' ? 'kg' : 'lbs'}
- Neck: ${profile.neck}${profile.units === 'metric' ? 'cm' : 'in'}
- Waist: ${profile.waist}${profile.units === 'metric' ? 'cm' : 'in'}
- Hip: ${profile.hip}${profile.units === 'metric' ? 'cm' : 'in'}
- Activity Level: ${profile.activityLevel}
- Mode: ${profile.mode}
- Timeline: ${profile.timeline}`;

  const response = await callGroq([
    { role: 'system', content: 'You are a precision fitness calculator. Return ONLY valid JSON, no additional text.' },
    { role: 'user', content: prompt },
  ]);

  try {
    const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback calculation
    return fallbackCalculation(profile);
  }
}

function fallbackCalculation(p: UserProfile): NutritionPlan {
  const w = p.units === 'imperial' ? p.weight * 0.4536 : p.weight;
  const h = p.units === 'imperial' ? p.height * 2.54 : p.height;

  const bmr = p.sex === 'male'
    ? 10 * w + 6.25 * h - 5 * p.age + 5
    : 10 * w + 6.25 * h - 5 * p.age - 161;

  const actMult: Record<string, number> = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, athlete: 1.9 };
  const tdee = Math.round(bmr * (actMult[p.activityLevel] || 1.55));

  const modeMult: Record<string, number> = { cut: -500, bulk: 300, recomposition: -100 };
  const pace: Record<string, number> = { slow: 0.7, moderate: 1, aggressive: 1.3 };
  const dailyCalories = Math.round(tdee + (modeMult[p.mode] || 0) * (pace[p.timeline] || 1));

  const protein = Math.round(w * 2.2);
  const fats = Math.round((dailyCalories * 0.25) / 9);
  const carbs = Math.round((dailyCalories - protein * 4 - fats * 9) / 4);

  return {
    bodyFatPercent: 20,
    bmr: Math.round(bmr),
    tdee,
    dailyCalories,
    protein,
    carbs: Math.max(carbs, 50),
    fats,
    explanation: 'Calculated using Mifflin-St Jeor equation with activity multiplier.',
  };
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
