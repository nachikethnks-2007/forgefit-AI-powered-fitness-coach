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
      max_tokens: 600, // reduced but safe
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

  return `You are a fitness AI coach.

User: ${profile.name}, goal: ${profile.mode}

Daily target: ${nutritionPlan.dailyCalories} kcal
Protein target: ${nutritionPlan.protein}g

${formatTodayFoodTotals()}

Weight trend: ${lastFourWeeksWeightTrend()}

${extra}

Always explain your answers clearly.`;
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
  const maxRounds = 2; // reduced from 5

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
        tools: FORGEFIT_GROQ_TOOLS, // ✅ still enabled
        tool_choice: 'auto',
        temperature: 0.5,
        max_tokens: 600,
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

export function chatMessagesToApiPayload(
  history: ChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
}