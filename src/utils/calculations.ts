import type {
  ActivityLevel,
  BodyMeasurement,
  Mode,
  NutritionPlan,
  Sex,
  UserProfile,
  Units,
} from '@/types/fitness';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  athlete: 1.9,
};

export function toKg(weight: number, units: Units): number {
  return units === 'imperial' ? weight * 0.45359237 : weight;
}

export function toCm(height: number, units: Units): number {
  return units === 'imperial' ? height * 2.54 : height;
}

/** Convert cm or inches to inches (US Navy uses inches). */
function toInchesLinear(value: number, units: Units): number {
  return units === 'metric' ? value / 2.54 : value;
}

/**
 * US Navy body fat estimation (neck, waist, hip, height).
 * Log10 form; all circumferences and height converted to inches internally.
 */
export function calculateBodyFatPercent(
  sex: Sex,
  height: number,
  neck: number,
  waist: number,
  hip: number,
  units: Units
): number {
  const h = toInchesLinear(height, units);
  const n = toInchesLinear(neck, units);
  const w = toInchesLinear(waist, units);
  const hi = toInchesLinear(hip || 0, units);

  if (h <= 0 || n <= 0 || w <= 0) return 0;

  let bf: number;
  if (sex === 'male') {
    const diff = w - n;
    if (diff <= 0) return 0;
    bf = 86.01 * Math.log10(diff) - 70.041 * Math.log10(h) + 36.76;
  } else {
    const sum = w + hi - n;
    if (sum <= 0) return 0;
    bf = 163.205 * Math.log10(sum) - 97.684 * Math.log10(h) - 78.387;
  }

  if (!Number.isFinite(bf) || bf < 0) return 0;
  if (bf > 60) return 60;
  return Math.round(bf * 10) / 10;
}

/** Body fat % for a logged measurement row (falls back to profile circumferences). */
export function bodyFatForMeasurement(
  profile: UserProfile,
  m: BodyMeasurement
): number | null {
  const neck = m.neck ?? profile.neck;
  const waist = m.waist ?? profile.waist;
  const hip = m.hip ?? profile.hip;
  if (!neck || !waist) return null;
  if (profile.sex === 'female' && !hip) return null;
  return calculateBodyFatPercent(profile.sex, profile.height, neck, waist, hip, profile.units);
}

export function calculateBmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  const m = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * m);
}

export function calorieTargetFromTdee(tdee: number, mode: Mode): number {
  if (mode === 'cut') return Math.round(tdee - 500);
  if (mode === 'bulk') return Math.round(tdee + 300);
  return Math.round(tdee);
}

export function proteinGramsPerKg(mode: Mode): number {
  if (mode === 'cut') return 2.2;
  if (mode === 'bulk') return 1.8;
  return 2.0;
}

/**
 * After protein (g/kg by mode), remaining calories split 70% carbs / 30% fats.
 */
export function calculateMacrosFromCaloriesAndMode(
  dailyCalories: number,
  mode: Mode,
  weightKg: number
): { protein: number; carbs: number; fats: number } {
  const proteinG = Math.round(weightKg * proteinGramsPerKg(mode));
  const proteinCals = proteinG * 4;
  let remaining = dailyCalories - proteinCals;
  if (remaining < 0) remaining = 0;
  const carbs = Math.round((remaining * 0.7) / 4);
  const fats = Math.round((remaining * 0.3) / 9);
  return {
    protein: proteinG,
    carbs: Math.max(carbs, 0),
    fats: Math.max(fats, 0),
  };
}

export function buildCompleteNutritionPlan(profile: UserProfile): NutritionPlan {
  const weightKg = toKg(profile.weight, profile.units);
  const heightCm = toCm(profile.height, profile.units);
  const bodyFatPercent = calculateBodyFatPercent(
    profile.sex,
    profile.height,
    profile.neck,
    profile.waist,
    profile.hip,
    profile.units
  );
  const bmr = calculateBmr(weightKg, heightCm, profile.age, profile.sex);
  const tdee = calculateTdee(bmr, profile.activityLevel);
  const dailyCalories = calorieTargetFromTdee(tdee, profile.mode);
  const { protein, carbs, fats } = calculateMacrosFromCaloriesAndMode(dailyCalories, profile.mode, weightKg);

  return {
    bodyFatPercent,
    bmr,
    tdee,
    dailyCalories,
    protein,
    carbs,
    fats,
    explanation:
      'Calculated with the US Navy body fat method, Mifflin–St Jeor BMR, TDEE from your activity level, and mode-based calories and macros.',
  };
}

/** Mode switch: keep BMR, TDEE, body fat; recompute daily calories and macros from saved TDEE. */
export function recalculateNutritionFromSavedTdee(
  existing: NutritionPlan,
  profile: UserProfile
): NutritionPlan {
  const weightKg = toKg(profile.weight, profile.units);
  const dailyCalories = calorieTargetFromTdee(existing.tdee, profile.mode);
  const { protein, carbs, fats } = calculateMacrosFromCaloriesAndMode(dailyCalories, profile.mode, weightKg);

  return {
    bodyFatPercent: existing.bodyFatPercent,
    bmr: existing.bmr,
    tdee: existing.tdee,
    dailyCalories,
    protein,
    carbs,
    fats,
    explanation: existing.explanation,
  };
}

/** Full metabolic recalculation when body measurements / activity / age / sex affecting BMR or Navy BF change. */
export function recalculateFullNutritionPreservingMode(
  profile: UserProfile,
  previousPlan: NutritionPlan | null
): NutritionPlan {
  const next = buildCompleteNutritionPlan(profile);
  return {
    ...next,
    explanation: previousPlan?.explanation ?? next.explanation,
  };
}
