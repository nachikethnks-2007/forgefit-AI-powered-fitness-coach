/**
 * Exercise metadata from wger.de public API.
 * We paginate /api/v2/exerciseinfo/ (richer than /api/v2/exercise/ for muscles + equipment in one response).
 * Source conceptually tied to https://wger.de/api/v2/exercise/ family.
 */

import type { ForgefitCachedExercise, ForgefitExerciseCategory, ForgefitExerciseDbCache } from '@/types/fitness';

export const FORGEFIT_EXERCISE_DB_KEY = 'forgefit_exercise_db';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const WGER_PAGE = 'https://wger.de/api/v2/exerciseinfo/?limit=100';

interface WgerMuscle {
  name?: string;
  name_en?: string;
}

interface WgerEquipment {
  name?: string;
}

interface WgerCategory {
  name?: string;
}

interface WgerTranslation {
  language?: number;
  name?: string;
}

interface WgerExerciseInfoRow {
  id: number;
  category?: WgerCategory;
  muscles?: WgerMuscle[];
  muscles_secondary?: WgerMuscle[];
  equipment?: WgerEquipment[];
  translations?: WgerTranslation[];
}

interface WgerListResponse {
  next: string | null;
  results: WgerExerciseInfoRow[];
}

function muscleLabel(m: WgerMuscle): string {
  return (m.name_en || m.name || '').trim();
}

function inferForgefitCategory(row: WgerExerciseInfoRow): ForgefitExerciseCategory {
  const primary = (row.muscles || []).map(muscleLabel).filter(Boolean);
  const secondary = (row.muscles_secondary || []).map(muscleLabel).filter(Boolean);
  const all = [...primary, ...secondary].map((s) => s.toLowerCase());

  const has = (sub: string) => all.some((x) => x.includes(sub));
  if (has('quad') || has('hamstring') || has('glute') || has('calf') || has('calves') || has('leg')) {
    return 'legs';
  }
  if (has('abs') || has('abdominal') || has('oblique')) {
    return 'core';
  }
  if (has('lat') || has('back') || has('biceps') || has('trap') || has('forearm')) {
    return 'pull';
  }
  if (has('chest') || has('shoulder') || has('triceps') || has('deltoid') || has('pec')) {
    return 'push';
  }

  const cn = (row.category?.name || '').toLowerCase();
  if (cn.includes('leg') || cn.includes('thigh') || cn.includes('calf')) return 'legs';
  if (cn.includes('back')) return 'pull';
  if (cn.includes('chest') || cn.includes('shoulder') || cn.includes('arms')) return 'push';
  if (cn.includes('abs') || cn.includes('abdominal')) return 'core';

  return 'push';
}

function inferDifficulty(equipment: WgerEquipment[]): 'beginner' | 'intermediate' | 'advanced' {
  const blob = equipment.map((e) => (e.name || '').toLowerCase()).join(' ');
  if (blob.includes('barbell') || blob.includes('smith') || blob.includes('olympic')) return 'advanced';
  if (blob.includes('kettlebell') || blob.includes('dumbbell') || blob.includes('machine')) return 'intermediate';
  if (blob.includes('none') || blob.includes('bodyweight')) return 'beginner';
  return 'intermediate';
}

/** wger uses language=2 for English in many datasets */
function pickEnglishName(translations: WgerTranslation[] | undefined): string {
  if (!translations?.length) return '';
  const en = translations.find((t) => t.language === 2 && t.name);
  if (en?.name) return en.name.trim();
  const any = translations.find((t) => t.name);
  return (any?.name || '').trim();
}

function mapRow(row: WgerExerciseInfoRow): ForgefitCachedExercise | null {
  const name = pickEnglishName(row.translations);
  if (!name) return null;
  return {
    id: row.id,
    name,
    category: inferForgefitCategory(row),
    muscles: (row.muscles || []).map(muscleLabel).filter(Boolean),
    musclesSecondary: (row.muscles_secondary || []).map(muscleLabel).filter(Boolean),
    equipment: (row.equipment || []).map((e) => (e.name || '').trim()).filter(Boolean),
    difficulty: inferDifficulty(row.equipment || []),
  };
}

export function readForgefitExerciseDbFromLS(): ForgefitExerciseDbCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FORGEFIT_EXERCISE_DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ForgefitExerciseDbCache;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.exercises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeForgefitExerciseDbToLS(cache: ForgefitExerciseDbCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FORGEFIT_EXERCISE_DB_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

export function isWgerExerciseDbExpired(fetchedAt: number): boolean {
  return Date.now() - fetchedAt > SEVEN_DAYS_MS;
}

async function fetchAllExerciseInfo(): Promise<ForgefitCachedExercise[]> {
  const out: ForgefitCachedExercise[] = [];
  let url: string | null = WGER_PAGE;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`wger ${res.status}`);
    const data = (await res.json()) as WgerListResponse;
    for (const row of data.results || []) {
      const ex = mapRow(row);
      if (ex) out.push(ex);
    }
    url = data.next;
  }

  return out;
}

let inflight: Promise<void> | null = null;

export function ensureWgerExerciseDb(): Promise<void> {
  if (inflight) return inflight;

  inflight = (async () => {
    const existing = readForgefitExerciseDbFromLS();
    if (existing && !isWgerExerciseDbExpired(existing.fetchedAt)) return;

    try {
      const exercises = await fetchAllExerciseInfo();
      writeForgefitExerciseDbToLS({ fetchedAt: Date.now(), exercises });
    } catch {
      if (!existing?.exercises?.length) {
        writeForgefitExerciseDbToLS({ fetchedAt: Date.now() - SEVEN_DAYS_MS, exercises: [] });
      }
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function getCachedExerciseById(id: number): ForgefitCachedExercise | undefined {
  const cache = readForgefitExerciseDbFromLS();
  return cache?.exercises.find((e) => e.id === id);
}

/** Tab-separated block for LLM context (truncate to stay within model limits). */
export function getWgerExerciseDbPromptSection(maxChars = 45000): string {
  const cache = readForgefitExerciseDbFromLS();
  if (!cache?.exercises.length) {
    return 'WGER EXERCISE DATABASE: (not loaded yet or empty after fetch failure — ask user to check network; tools requiring wger_exercise_id may fail until cache fills.)\n';
  }

  const header =
    'WGER EXERCISE DATABASE — Each line: id | name | push|pull|legs|core | difficulty | equipment | primary muscles | secondary muscles\n' +
    'You MUST only assign exercises from this list. Use the numeric id as wger_exercise_id in JSON/tools.\n';

  const lines = cache.exercises.map(
    (e) =>
      `${e.id}\t${e.name}\t${e.category}\t${e.difficulty}\t${e.equipment.join('; ')}\t${e.muscles.join(', ')}\t${e.musclesSecondary.join(', ')}`
  );

  let body = lines.join('\n');
  if (body.length > maxChars) {
    body = body.slice(0, maxChars) + `\n... [truncated; ${cache.exercises.length} exercises in local cache]`;
  }

  return header + body;
}
