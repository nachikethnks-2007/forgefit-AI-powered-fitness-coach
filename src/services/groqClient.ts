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

export async function callGroq(
  messages: Array<{ role: string; content: string }>,
  model = 'llama-3.3-70b-versatile'
): Promise<string> {
  const apiKey = localStorage.getItem('groqApiKey');

  if (!apiKey) {
    throw new Error('Missing API key');
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

function formatTodayFoodTotals(): string {
  const { foodLog } = useAppStore.getState();
  const today = new Date().toISOString().split('T')[0];
  const rows = foodLog.filter((f) => f.date === today);
  if (!rows.length) return 'No food logged today.';
  const t = rows.reduce(
    (a, f) => ({
      cal: a.cal + f.calories,
      p: a.p + f.protein,
      c: a.c + f.carbs,
      f: a.f + f.fats,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
  return `Today totals: ${t.cal} kcal, protein ${t.p}g, carbs ${t.c}g, fats ${t.f}g. Items: ${rows.map((f) => f.name).join(', ')}`;
}

function lastFourWeeksWeightTrend(): string {
  const { measurements } = useAppStore.getState();
  const cutoff = Date.now() - 28 * 86400000;
  const rows = measurements
    .filter((m) => new Date(m.date + 'T12:00:00').getTime() >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return 'No weigh-ins in the last 4 weeks.';
  return rows.map((m) => `${m.date}: ${m.weight}`).join('; ');
}

/** Full coach context + tool instructions for every Groq call that uses tools. */
export function buildForgeFitAISystemPrompt(extraContext = ''): string {
  const { profile, nutritionPlan, workoutSessions } = useAppStore.getState();
  if (!profile || !nutritionPlan) {
    return 'User profile is not loaded.';
  }

  const last3 = workoutSessions.slice(-3);
  const modeLabel = { cut: 'Cutting (fat loss)', bulk: 'Bulking (muscle gain)', recomposition: 'Body Recomposition' };

  return `You are ForgeFit AI, the user's 24/7 personal trainer. Address them by name (${profile.name}).

FULL PROFILE
- Name: ${profile.name}, Age: ${profile.age}, Sex: ${profile.sex}, Mode: ${modeLabel[profile.mode]}
- Weight: ${profile.weight} ${profile.units === 'metric' ? 'kg' : 'lbs'}, Height: ${profile.height}${profile.units === 'metric' ? 'cm' : 'in'}
- Neck / Waist / Hip: ${profile.neck} / ${profile.waist} / ${profile.hip || 'n/a'} (user units)
- Body fat (formula): ${nutritionPlan.bodyFatPercent}%
- Fitness: ${profile.fitnessLevel}, Activity: ${profile.activityLevel}, Training days/week: ${profile.trainingDays}
- Equipment: ${profile.equipment}, Diet pref: ${profile.dietPref}
${profile.injuries ? `- Injuries: ${profile.injuries}` : ''}
${profile.targetWeight != null ? `- Target weight: ${profile.targetWeight} ${profile.units === 'metric' ? 'kg' : 'lbs'}` : ''}

FORMULA-CALCULATED NUTRITION (do NOT recalculate BMR/TDEE/body fat yourself — these come from ForgeFit formulas only)
- BMR: ${nutritionPlan.bmr} kcal, TDEE: ${nutritionPlan.tdee} kcal
- Daily calorie target: ${nutritionPlan.dailyCalories} kcal
- Macros: ${nutritionPlan.protein}g protein, ${nutritionPlan.carbs}g carbs, ${nutritionPlan.fats}g fats

TODAY'S FOOD
${formatTodayFoodTotals()}

LAST 3 WORKOUT SESSIONS (JSON)
${JSON.stringify(last3)}

LAST 4 WEEKS WEIGHT TREND
${lastFourWeeksWeightTrend()}

TOOLS — use them when action is needed, then explain in your reply:
- If the user gives new measurements, call update_body_stats.
- If nutrition targets need adjusting, call update_nutrition_targets.
- If workout intensity or loads need changing, call update_workout_intensity.
- Use flag_alert for important dashboard insights.

Always explain what you changed and why. Be direct, motivating, and data-driven.

${extraContext ? `\nEXTRA:\n${extraContext}` : ''}`;
}

/** @deprecated Use buildForgeFitAISystemPrompt for coach flows; kept for minimal call sites. */
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

export async function callGroqWithTools(
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: { extraSystemSuffix?: string }
): Promise<{ content: string; toolSummaries: string[] }> {
  const apiKey = localStorage.getItem('groqApiKey');
  if (!apiKey) {
    throw new Error('Missing API key');
  }

  const system = buildForgeFitAISystemPrompt(options?.extraSystemSuffix ?? '');
  const messages: GroqMessage[] = [{ role: 'system', content: system }, ...conversationMessages];

  const toolSummaries: string[] = [];
  const maxRounds = 5;

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
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API error (${res.status}): ${text}`);
    }

    const data: GroqResponse = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) break;

    messages.push(msg);

    const calls = msg.tool_calls?.filter((t) => t.type === 'function') ?? [];
    if (!calls.length) {
      return { content: msg.content?.trim() || '', toolSummaries };
    }

    for (const tc of calls) {
      const result = executeForgefitTool(tc.function.name, tc.function.arguments);
      toolSummaries.push(result.summary);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({ ok: result.ok, summary: result.summary }),
      });
    }
  }

  return { content: '', toolSummaries };
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

export function chatMessagesToApiPayload(history: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
}
