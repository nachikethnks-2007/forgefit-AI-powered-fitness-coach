import { describe, expect, it } from 'vitest';
import {
  buildCompleteNutritionPlan,
  calculateBmr,
  calculateTdee,
  calorieTargetFromTdee,
  calculateMacrosFromCaloriesAndMode,
  recalculateNutritionFromSavedTdee,
  toKg,
} from './calculations';
import type { UserProfile } from '@/types/fitness';

const baseProfile: UserProfile = {
  name: 'Test',
  age: 30,
  sex: 'male',
  units: 'metric',
  height: 180,
  weight: 80,
  neck: 38,
  waist: 85,
  hip: 0,
  fitnessLevel: 'intermediate',
  activityLevel: 'moderately_active',
  trainingDays: 4,
  equipment: 'full_gym',
  timeline: 'moderate',
  dietPref: 'none',
  mode: 'cut',
};

describe('calculations', () => {
  it('computes Mifflin-St Jeor BMR for male', () => {
    const w = toKg(80, 'metric');
    const bmr = calculateBmr(w, 180, 30, 'male');
    expect(bmr).toBe(Math.round(10 * 80 + 6.25 * 180 - 5 * 30 + 5));
  });

  it('applies activity multiplier for TDEE', () => {
    const bmr = 1700;
    expect(calculateTdee(bmr, 'sedentary')).toBe(Math.round(bmr * 1.2));
    expect(calculateTdee(bmr, 'athlete')).toBe(Math.round(bmr * 1.9));
  });

  it('calorie targets from TDEE by mode', () => {
    expect(calorieTargetFromTdee(2500, 'cut')).toBe(2000);
    expect(calorieTargetFromTdee(2500, 'bulk')).toBe(2800);
    expect(calorieTargetFromTdee(2500, 'recomposition')).toBe(2500);
  });

  it('splits remaining calories 70/30 carbs/fats after protein', () => {
    const { protein, carbs, fats } = calculateMacrosFromCaloriesAndMode(2000, 'cut', 80);
    expect(protein).toBe(Math.round(80 * 2.2));
    const rem = 2000 - protein * 4;
    expect(carbs).toBe(Math.round((rem * 0.7) / 4));
    expect(fats).toBe(Math.round((rem * 0.3) / 9));
  });

  it('buildCompleteNutritionPlan returns consistent plan', () => {
    const plan = buildCompleteNutritionPlan(baseProfile);
    expect(plan.bmr).toBeGreaterThan(0);
    expect(plan.tdee).toBeGreaterThanOrEqual(plan.bmr);
    expect(plan.dailyCalories).toBe(calorieTargetFromTdee(plan.tdee, 'cut'));
  });

  it('mode switch preserves TDEE and BMR', () => {
    const full = buildCompleteNutritionPlan(baseProfile);
    const bulkProfile = { ...baseProfile, mode: 'bulk' as const };
    const next = recalculateNutritionFromSavedTdee(full, bulkProfile);
    expect(next.tdee).toBe(full.tdee);
    expect(next.bmr).toBe(full.bmr);
    expect(next.bodyFatPercent).toBe(full.bodyFatPercent);
    expect(next.dailyCalories).toBe(calorieTargetFromTdee(full.tdee, 'bulk'));
  });
});
