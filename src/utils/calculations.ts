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

function toInchesLinear(value: number, units: Units): number {
  return units === 'metric' ? value / 2.54 : value;
}

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

  if (h <= 0 || n <= 0 || w <= 0) return 25;

  let bf: number;
  if (sex === 'male') {
    const diff = w - n;
    if (diff <= 0) return 25;
    bf = 86.01 * Math.log10(diff) - 70.041 * Math.log10(h) + 36.76;
  } else {
    const sum = w + hi - n;
    if (sum <= 0) return 25;
    bf = 163.205 * Math.log10(sum) - 97.684 * Math.log10(h) - 78.387;
  }

  if (!Number.isFinite(bf) || bf < 0) return 25;
  if (bf > 60) return 60;
  return Math.round(bf * 10) / 10;
}

// ✅ ADDED BACK (FIXES YOUR ERROR)
export function bodyFatForMeasurement(
  profile: UserProfile,
  m: BodyMeasurement
): number | null {
  const neck = m.neck ?? profile.neck;
  const waist = m.waist ?? profile.waist;
  const hip = m.hip ?? profile.hip;

  if (!neck || !waist) return null;
  if (profile.sex === 'female' && !hip) return null;

  return calculateBodyFatPercent(
    profile.sex,
    profile.height,
    neck,
    waist,
    hip,
    profile.units
  );
}

export function calculateBmr(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function calculateTdee(
  bmr: number,
  activityLevel: ActivityLevel
): number {
  const m = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * m);
}

export function calorieTargetFromTdee(
  tdee: number,
  mode: Mode
): number {
  if (mode === 'cut') return Math.round(tdee - 500);
  if (mode === 'bulk') return Math.round(tdee + 300);
  return Math.round(tdee);
}

export function proteinGramsPerKg(
  mode: Mode,
  bodyFatPercent: number
): number {
  if (mode === 'cut') {
    if (bodyFatPercent > 25) return 1.6;
    if (bodyFatPercent > 18) return 1.8;
    return 2.2;
  }
  if (mode === 'recomp') return 1.8;
  if (mode === 'bulk') return 1.6;
  return 1.8;
}

export function calculateMacrosFromCaloriesAndMode(
  dailyCalories: number,
  mode: Mode,
  weightKg: number,
  bodyFatPercent: number
): { protein: number; carbs: number; fats: number } {
  let bodyFat = bodyFatPercent / 100;

  if (!Number.isFinite(bodyFat) || bodyFat <= 0 || bodyFat > 0.6) {
    bodyFat = 0.25;
  }

  const leanBodyMass = weightKg * (1 - bodyFat);

  const proteinG = Math.round(
    leanBodyMass * proteinGramsPerKg(mode, bodyFatPercent)
  );

  const proteinCals = proteinG * 4;
  let remaining = dailyCalories - proteinCals;

  if (remaining < 0) remaining = 0;

  const minFatGrams = Math.round(weightKg * 0.6);

  let fats = Math.round((remaining * 0.3) / 9);
  fats = Math.max(fats, minFatGrams);

  const fatsCals = fats * 9;
  let carbsCals = remaining - fatsCals;

  if (carbsCals < 0) carbsCals = 0;

  const carbs = Math.round(carbsCals / 4);

  return {
    protein: proteinG,
    carbs,
    fats,
  };
}

export function buildCompleteNutritionPlan(
  profile: UserProfile
): NutritionPlan {
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

  const bmr = calculateBmr(
    weightKg,
    heightCm,
    profile.age,
    profile.sex
  );

  const tdee = calculateTdee(
    bmr,
    profile.activityLevel
  );

  const dailyCalories = calorieTargetFromTdee(
    tdee,
    profile.mode
  );

  const { protein, carbs, fats } =
    calculateMacrosFromCaloriesAndMode(
      dailyCalories,
      profile.mode,
      weightKg,
      bodyFatPercent
    );

  return {
    bodyFatPercent,
    bmr,
    tdee,
    dailyCalories,
    protein,
    carbs,
    fats,
    explanation:
      'Adaptive protein (LBM-based), Mifflin–St Jeor BMR, activity-based TDEE, and balanced macros with minimum fat intake.',
  };
}

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
