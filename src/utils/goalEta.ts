import type { BodyMeasurement, UserProfile } from '@/types/fitness';

export interface GoalEtaResult {
  /** e.g. "July 2026" */
  label: string;
  weeksRemaining: number;
}

export function computeGoalEta(
  profile: UserProfile,
  measurements: BodyMeasurement[]
): GoalEtaResult | null {
  if (profile.targetWeight == null || measurements.length < 2) return null;

  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const cur = sorted[sorted.length - 1].weight;
  const tgt = profile.targetWeight;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const t0 = new Date(first.date + 'T12:00:00').getTime();
  const t1 = new Date(last.date + 'T12:00:00').getTime();
  const weeksElapsed = (t1 - t0) / (7 * 86400000);
  if (weeksElapsed < 0.5) return null;

  const weeklyDelta = (last.weight - first.weight) / weeksElapsed;

  let diff = 0;
  let weeklyProgress = 0;

  if (profile.mode === 'cut') {
    diff = cur - tgt;
    if (diff <= 0) {
      return {
        label: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        weeksRemaining: 0,
      };
    }
    if (weeklyDelta >= 0) return null;
    weeklyProgress = -weeklyDelta;
  } else if (profile.mode === 'bulk') {
    diff = tgt - cur;
    if (diff <= 0) {
      return {
        label: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        weeksRemaining: 0,
      };
    }
    if (weeklyDelta <= 0) return null;
    weeklyProgress = weeklyDelta;
  } else {
    diff = Math.abs(cur - tgt);
    if (diff < 0.5) {
      return {
        label: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        weeksRemaining: 0,
      };
    }
    const toward = tgt - cur;
    const aligned = Math.sign(toward) * weeklyDelta > 0;
    if (!aligned || Math.abs(weeklyDelta) < 1e-6) return null;
    weeklyProgress = Math.abs(weeklyDelta);
  }

  if (weeklyProgress < 1e-6) return null;
  const weeksRemaining = diff / weeklyProgress;
  if (!Number.isFinite(weeksRemaining) || weeksRemaining > 520) return null;

  const eta = new Date(Date.now() + weeksRemaining * 7 * 86400000);
  return {
    label: eta.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    weeksRemaining: Math.max(0, Math.ceil(weeksRemaining)),
  };
}
