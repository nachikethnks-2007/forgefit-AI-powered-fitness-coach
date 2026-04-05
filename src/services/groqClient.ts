import type { UserProfile, NutritionPlan, ChatMessage } from '@/types/fitness';
import { buildCompleteNutritionPlan } from '@/utils/calculations';
import { useAppStore } from '@/store/useAppStore';
import { FORGEFIT_GROQ_TOOLS, executeForgefitTool } from '@/utils/aiTools';
import {
  ensureWgerExerciseDb,
  formatExerciseListForPrompt,
  getRelevantExercisesForChatContext,
  getRelevantExercisesForWorkoutGeneration,
} from '@/services/wgerExerciseDb';

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
  messages: Array<{ role: string; content: string }>,
  model = TOOL_MODEL
): Promise<string> {
  const apiKey = localStorage.getItem('groqApiKey');
  if (!apiKey) throw new Error('Missing API key');

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
      max_tokens: 500, // 🔥 reduced
    }),
  });

  if (!res.ok) {
    const text = await res.text();

    // 🔥 retry logic
    if (text.includes("rate_limit_exceeded")) {
      await new Promise(r => setTimeout(r, 15000));

      const retry = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      const retryData: GroqResponse = await retry.json();
      return retryData.choices[0]?.message?.content || '';
    }

    throw new Error(`Groq API error (${res.status}): ${text}`);
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

  const t = rows.reduce(
    (a, f) => ({
      cal: a.cal + f.calories,
      p: a.p + f.protein,
    }),
    { cal: 0, p: 0 }
  );

  return `Today: ${t.cal} kcal, ${t.p}g protein. Foods: ${rows.map((f) => f.name).join(', ')}`;
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

export function buildForgeFitAISystemPrompt(
  extraContext = '',
  exerciseBlock: string
): string {
  const { profile, nutritionPlan, workoutSessions, workoutPlan } = useAppStore.getState();

  if (!profile || !nutritionPlan) {
    return 'User profile not loaded.';
  }

  const last3 = workoutSessions.slice(-3);

  return `You are a fitness AI coach.

User:
${profile.name}, ${profile.age}, ${profile.mode}

Calories: ${nutritionPlan.dailyCalories}
Protein: ${nutritionPlan.protein}g

${formatTodayFoodTotals()}

Recent workouts:
${last3.map(s => `${s.date} - ${s.type}`).join(', ')}

${exerciseBlock}

${extraContext}

Be short, clear, and helpful.`;
}

/* ---------------- MAIN TOOL CALL ---------------- */

export async function callGroqWithTools(
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: { extraSystemSuffix?: string }
): Promise<{ content: string; toolSummaries: string[] }> {

  const apiKey = localStorage.getItem('groqApiKey');
  if (!apiKey) throw new Error('Missing API key');

  await ensureWgerExerciseDb();

  const { profile } = useAppStore.getState();

  let exerciseBlock = formatExerciseListForPrompt([], 'EXERCISES');

  if (profile) {
    const recent = conversationMessages
      .filter(m => m.role === 'user')
      .slice(-2)
      .map(m => m.content)
      .join('\n');

    const picks = getRelevantExercisesForChatContext(
      recent,
      profile.equipment,
      profile.fitnessLevel
    );

    exerciseBlock = formatExerciseListForPrompt(picks, 'EXERCISES (TOP 5)');
  }

  const system = buildForgeFitAISystemPrompt(
    options?.extraSystemSuffix ?? '',
    exerciseBlock
  );

  const messages: GroqMessage[] = [
    { role: 'system', content: system },
    ...conversationMessages,
  ];

  const toolSummaries: string[] = [];
  const maxRounds = 2; // 🔥 reduced

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
        max_tokens: 500, // 🔥 reduced
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
    const msg = data.choices?.[0]?.message;
    if (!msg) break;

    messages.push(msg);

    const calls = msg.tool_calls?.filter(t => t.type === 'function') ?? [];

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

/* ---------------- OTHER ---------------- */

export function calculateNutritionPlan(_apiKey: string, profile: UserProfile): Promise<NutritionPlan> {
  return Promise.resolve(buildCompleteNutritionPlan(profile));
}

export async function generateWorkoutPlan(_apiKey: string, profile: UserProfile): Promise<string> {
  await ensureWgerExerciseDb();

  const picks = getRelevantExercisesForWorkoutGeneration(profile, 15);

  const exerciseDb = formatExerciseListForPrompt(picks, 'EXERCISES');

  const prompt = `${exerciseDb}

Create workout plan JSON only.`;

  return await callGroq([
    { role: 'system', content: 'Return JSON only.' },
    { role: 'user', content: prompt },
  ]);
}

export function chatMessagesToApiPayload(
  history: ChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));
}