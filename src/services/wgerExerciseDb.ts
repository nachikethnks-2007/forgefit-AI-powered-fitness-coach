/**
 * Exercise metadata from wger.de public API.
 * We paginate /api/v2/exerciseinfo/ (richer than /api/v2/exercise/ for muscles + equipment in one response).
 * Source conceptually tied to https://wger.de/api/v2/exercise/ family.
 */

import type {
  Equipment,
  FitnessLevel,
  ForgefitCachedExercise,
  ForgefitExerciseCategory,
  ForgefitExerciseDbCache,
  UserProfile,
} from '@/types/fitness';

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

function allowedDifficultiesFilter(
  d: 'beginner' | 'intermediate' | 'advanced' | 'any'
): Set<'beginner' | 'intermediate' | 'advanced'> {
  if (d === 'any') return new Set(['beginner', 'intermediate', 'advanced']);
  if (d === 'beginner') return new Set(['beginner', 'intermediate']);
  if (d === 'intermediate') return new Set(['beginner', 'intermediate', 'advanced']);
  return new Set(['intermediate', 'advanced']);
}

function exerciseMatchesForgefitEquipment(ex: ForgefitCachedExercise, equipment: Equipment | string): boolean {
  const blob = ex.equipment.join(' ').toLowerCase();
  switch (equipment as Equipment) {
    case 'full_gym':
      return true;
    case 'home_dumbbells':
      return (
        blob.includes('dumbbell') ||
        blob.includes('none') ||
        blob.includes('bodyweight') ||
        blob.includes('pull-up')
      );
    case 'bodyweight':
      return (
        blob.includes('none') ||
        blob.includes('bodyweight') ||
        blob.includes('pull-up') ||
        blob.includes('other')
      );
    case 'resistance_bands':
      return (
        blob.includes('band') ||
        blob.includes('bodyweight') ||
        blob.includes('none') ||
        blob.includes('pull-up')
      );
    default:
      return true;
  }
}

export function mapFitnessLevelToSearchDifficulty(
  level: FitnessLevel
): 'beginner' | 'intermediate' | 'advanced' | 'any' {
  if (level === 'beginner') return 'beginner';
  if (level === 'advanced') return 'advanced';
  return 'intermediate';
}

/** Detect push/pull/legs/core intent from free text (chat, tips, etc.). */
export function inferMuscleGroupKeywordsFromText(text: string): ForgefitExerciseCategory[] {
  const t = text.toLowerCase();
  const categories = new Set<ForgefitExerciseCategory>();

  if (
    /push.?up|pushup|bench|chest|pectoral|shoulder|deltoid|overhead press|\bohp\b|tricep|triceps|\bdip\b|fly|pec\b/.test(
      t
    )
  ) {
    categories.add('push');
  }
  if (
    /pull.?up|pullup|\brow\b|rowing|lat\b|latissimus|\bback\b|bicep|biceps|chin.?up|chinup|rear delt|trap|shrug/.test(
      t
    )
  ) {
    categories.add('pull');
  }
  if (
    /squat|leg day|quad|hamstring|glute|calf|lunge|deadlift|\brdl\b|leg press|hip thrust|lower body|goblet|leg curl|leg extension/.test(
      t
    )
  ) {
    categories.add('legs');
  }
  if (/core|\bab\b|\babs\b|plank|crunch|oblique|six pack/.test(t)) {
    categories.add('core');
  }

  return [...categories];
}

function parseCategoriesFromMuscleGroupField(muscleGroup: string): ForgefitExerciseCategory[] {
  const mg = muscleGroup.toLowerCase();
  const out = new Set<ForgefitExerciseCategory>();
  if (/\bpush\b|chest|shoulder|tricep/.test(mg)) out.add('push');
  if (/\bpull\b|back|bicep|row|lat\b/.test(mg)) out.add('pull');
  if (/\bleg|squat|quad|glute|ham|calve/.test(mg)) out.add('legs');
  if (/\bcore\b|\bab\b|plank|crunch/.test(mg)) out.add('core');
  return [...out];
}

function scoreWithinCategory(ex: ForgefitCachedExercise, textBlob: string): number {
  if (!textBlob.trim()) return 0;
  const name = ex.name.toLowerCase();
  const musc = [...ex.muscles, ...ex.musclesSecondary].join(' ').toLowerCase();
  let s = 0;
  const tokens = textBlob
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((x) => x.length > 2);
  for (const tok of tokens) {
    if (name.includes(tok)) s += 12;
    if (musc.includes(tok)) s += 6;
  }
  return s;
}

function diversePick(pool: ForgefitCachedExercise[], limit: number): ForgefitCachedExercise[] {
  const byCat: Record<ForgefitExerciseCategory, ForgefitCachedExercise[]> = {
    push: [],
    pull: [],
    legs: [],
    core: [],
  };
  for (const e of pool) byCat[e.category].push(e);
  for (const k of Object.keys(byCat) as ForgefitExerciseCategory[]) {
    byCat[k].sort((a, b) => a.name.localeCompare(b.name));
  }
  const out: ForgefitCachedExercise[] = [];
  const seen = new Set<number>();
  let round = 0;
  const order: ForgefitExerciseCategory[] = ['push', 'pull', 'legs', 'core'];
  while (out.length < limit && round < pool.length + 8) {
    let added = false;
    for (let j = 0; j < 4; j++) {
      const cat = order[(round + j) % 4];
      const ex = byCat[cat].shift();
      if (ex && !seen.has(ex.id)) {
        seen.add(ex.id);
        out.push(ex);
        added = true;
        if (out.length >= limit) break;
      }
    }
    round++;
    if (!added) break;
  }
  for (const e of pool) {
    if (out.length >= limit) break;
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

/**
 * Filter the cached localStorage DB and return the top `limit` most relevant exercises.
 * muscleGroup: hints like "push", "chest,legs", or text snippets; empty string = balanced mix.
 */
export function searchExercises(
  muscleGroup: string,
  equipment: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'any',
  limit = 5
): ForgefitCachedExercise[] {
  const cache = readForgefitExerciseDbFromLS();
  if (!cache?.exercises.length) return [];

  const allowedDiff = allowedDifficultiesFilter(difficulty);
  let pool = cache.exercises.filter((e) => exerciseMatchesForgefitEquipment(e, equipment));
  pool = pool.filter((e) => allowedDiff.has(e.difficulty));

  const fromField = parseCategoriesFromMuscleGroupField(muscleGroup);
  const targetCategories = fromField.length ? fromField : [];

  if (targetCategories.length === 0) {
    return diversePick(pool, limit);
  }

  let narrowed = pool.filter((e) => targetCategories.includes(e.category));
  if (!narrowed.length) {
    narrowed = pool;
  }

  const textBlob = muscleGroup;
  const scored = narrowed
    .map((ex) => ({ ex, score: scoreWithinCategory(ex, textBlob) }))
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));

  const seen = new Set<number>();
  const out: ForgefitCachedExercise[] = [];
  for (const { ex } of scored) {
    if (seen.has(ex.id)) continue;
    seen.add(ex.id);
    out.push(ex);
    if (out.length >= limit) break;
  }
  if (out.length < limit) {
    for (const ex of diversePick(narrowed, limit)) {
      if (seen.has(ex.id)) continue;
      seen.add(ex.id);
      out.push(ex);
      if (out.length >= limit) break;
    }
  }
  return out.slice(0, limit);
}

/** Chat / coach: infer intent from user text, then top 5 with profile filters. */
export function getRelevantExercisesForChatContext(
  userAndContextText: string,
  equipment: Equipment,
  fitnessLevel: FitnessLevel
): ForgefitCachedExercise[] {
  const inferred = inferMuscleGroupKeywordsFromText(userAndContextText);
  const diff = mapFitnessLevelToSearchDifficulty(fitnessLevel);
  if (!inferred.length) {
    return searchExercises('', equipment, diff, 5);
  }
  return searchExercises(inferred.join(','), equipment, diff, 5);
}

/** Workout generator: equipment + level only, balanced split, max 20. */
export function getRelevantExercisesForWorkoutGeneration(
  profile: UserProfile,
  maxTotal = 20
): ForgefitCachedExercise[] {
  const diff = mapFitnessLevelToSearchDifficulty(profile.fitnessLevel);
  return searchExercises('', profile.equipment, diff, maxTotal);
}

export function formatExerciseListForPrompt(exercises: ForgefitCachedExercise[], title: string): string {
  if (!exercises.length) {
    return `${title}\n(no exercises matched filters — ensure the exercise cache has loaded from wger)\n`;
  }
  const lines = exercises.map(
    (e) =>
      `${e.id}\t${e.name}\t${e.category}\t${e.difficulty}\t${e.equipment.join('; ')}\t${e.muscles.join(', ')}`
  );
  return (
    `${title}\n` +
    `Columns: id | name | category | difficulty | equipment | primary muscles\n` +
    `${lines.join('\n')}\n` +
    `Only use wger_exercise_id + name pairs from this subset for this request. The full database stays in localStorage (forgefit_exercise_db) and is not sent to the model.\n`
  );
}
