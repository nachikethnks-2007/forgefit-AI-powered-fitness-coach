import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { bodyFatForMeasurement } from '@/utils/calculations';
import {
  readForgefitFoodLog,
  readForgefitProfilePayload,
  readForgefitWeightLog,
  readForgefitWorkoutSessions,
} from '@/utils/forgefitLocalStorage';
import type { BodyMeasurement, FoodEntry, UserProfile, WorkoutSession } from '@/types/fitness';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';

function isoWeekKey(dateStr: string): string {
  const d = parseISO(dateStr);
  const y = getISOWeekYear(d);
  const w = getISOWeek(d);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

function sessionVolumeKg(session: WorkoutSession): number {
  return session.exercises.reduce(
    (acc, ex) => acc + ex.sets.reduce((b, set) => b + set.reps * set.weight, 0),
    0
  );
}

function mergeWeightLog(ls: BodyMeasurement[], store: BodyMeasurement[]): BodyMeasurement[] {
  return ls.length > 0 ? ls : store;
}

function mergeFoodLog(ls: FoodEntry[], store: FoodEntry[]): FoodEntry[] {
  return ls.length > 0 ? ls : store;
}

function mergeSessions(ls: WorkoutSession[], store: WorkoutSession[]): WorkoutSession[] {
  return ls.length > 0 ? ls : store;
}

export default function ProgressHub() {
  const { profile, nutritionPlan, measurements, foodLog, workoutSessions, setCurrentPage } = useAppStore();

  const lsWeight = readForgefitWeightLog();
  const lsFood = readForgefitFoodLog();
  const lsSessions = readForgefitWorkoutSessions();
  const lsProfile = readForgefitProfilePayload();

  const weightLog = useMemo(
    () => [...mergeWeightLog(lsWeight, measurements)].sort((a, b) => a.date.localeCompare(b.date)),
    [lsWeight, measurements]
  );

  const food = useMemo(
    () => mergeFoodLog(lsFood, foodLog),
    [lsFood, foodLog]
  );

  const sessions = useMemo(
    () => mergeSessions(lsSessions, workoutSessions),
    [lsSessions, workoutSessions]
  );

  const effectiveProfile = (lsProfile?.profile ?? profile) as UserProfile | null;
  const effectivePlan = lsProfile?.nutritionPlan ?? nutritionPlan;

  const chartStyle = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827' };

  const calorieTarget = effectivePlan?.dailyCalories ?? nutritionPlan?.dailyCalories ?? 0;
  const proteinTarget = effectivePlan?.protein ?? nutritionPlan?.protein ?? 0;

  const weightData = weightLog.map((m) => ({ date: m.date.slice(5), weight: m.weight }));

  const bfData =
    effectiveProfile &&
    weightLog
      .map((m) => {
        const bf = bodyFatForMeasurement(effectiveProfile, m);
        return bf != null ? { date: m.date.slice(5), bf } : null;
      })
      .filter((x): x is { date: string; bf: number } => x != null);

  const dayCalories: Record<string, number> = {};
  food.forEach((f) => {
    dayCalories[f.date] = (dayCalories[f.date] || 0) + f.calories;
  });
  const weekCalTotals: Record<string, number> = {};
  Object.entries(dayCalories).forEach(([date, cal]) => {
    const k = isoWeekKey(date);
    weekCalTotals[k] = (weekCalTotals[k] || 0) + cal;
  });
  const calAvgData = Object.entries(weekCalTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, total]) => {
      const avg = Math.round(total / 7);
      return {
        week: week.replace(/^\d{4}-W/, 'W'),
        avg,
        target: calorieTarget,
        within: Math.abs(avg - calorieTarget) <= 100,
      };
    });

  const dayProtein: Record<string, number> = {};
  food.forEach((f) => {
    dayProtein[f.date] = (dayProtein[f.date] || 0) + f.protein;
  });
  const weekProteinTotals: Record<string, number> = {};
  Object.entries(dayProtein).forEach(([date, p]) => {
    const k = isoWeekKey(date);
    weekProteinTotals[k] = (weekProteinTotals[k] || 0) + p;
  });
  const macroAdherenceData = Object.entries(weekProteinTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, total]) => {
      const pct = proteinTarget > 0 ? Math.round((total / (7 * proteinTarget)) * 1000) / 10 : 0;
      return {
        week: week.replace(/^\d{4}-W/, 'W'),
        adherence: Math.min(pct, 200),
      };
    });

  const weeklyVolume: Record<string, number> = {};
  sessions.forEach((s) => {
    const k = isoWeekKey(s.date);
    weeklyVolume[k] = (weeklyVolume[k] || 0) + sessionVolumeKg(s);
  });
  const volData = Object.entries(weeklyVolume)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, vol]) => ({ week: week.replace(/^\d{4}-W/, 'W'), volume: vol }));

  const prRows = useMemo(() => {
    const ms = 86400000;
    const now = Date.now();
    const t30 = now - 30 * ms;
    const t60 = now - 60 * ms;

    const map = new Map<
      string,
      { best: number; bestDate: string; recentBest: number; prevBest: number }
    >();

    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((s) => {
      const t = new Date(s.date + 'T12:00:00').getTime();
      s.exercises.forEach((ex) => {
        const maxSet = Math.max(0, ...ex.sets.map((st) => st.weight));
        if (maxSet <= 0) return;
        let row = map.get(ex.name);
        if (!row) {
          row = { best: 0, bestDate: s.date, recentBest: 0, prevBest: 0 };
          map.set(ex.name, row);
        }
        if (maxSet > row.best) {
          row.best = maxSet;
          row.bestDate = s.date;
        }
        if (t >= t30 && maxSet > row.recentBest) row.recentBest = maxSet;
        if (t >= t60 && t < t30 && maxSet > row.prevBest) row.prevBest = maxSet;
      });
    });

    const unit = profile?.units === 'metric' ? 'kg' : 'lbs';
    return Array.from(map.entries())
      .map(([name, r]) => {
        let vsLast = '—';
        if (r.prevBest > 0) {
          const d = r.recentBest - r.prevBest;
          vsLast = `${d >= 0 ? '+' : ''}${d.toFixed(1)} ${unit}`;
        } else if (r.recentBest > 0) {
          vsLast = 'No prior month';
        }
        return { name, best: r.best, bestDate: r.bestDate, vsLast };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions, profile]);

  const workoutDates = new Set(sessions.map((s) => s.date));

  if (!profile || !nutritionPlan) return null;

  const emptyWeight =
    'Log body measurements from the dashboard (or your check-in flow) to chart weight. Entries are stored in localStorage as forgefit_weight_log.';
  const emptyBf =
    'Weight log entries need neck and waist (and hip for women) to plot Navy body fat over time. Update measurements alongside weight when logging.';
  const emptyFood =
    'Log meals from the dashboard to build forgefit_food_log. Weekly calorie and protein charts use those entries grouped by calendar week.';
  const emptyWorkouts =
    'Complete workouts in the Workout Tracker to populate forgefit_workout_sessions for volume and personal records.';

  return (
    <div className="min-h-screen pb-8 bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('dashboard')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-bold gradient-text">Progress Hub</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h2 className="font-heading font-bold text-lg mb-4">Weight Over Time</h2>
          {weightData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={chartStyle} />
                  <Line type="monotone" dataKey="weight" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3, fill: '#7c3aed' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{emptyWeight}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
        >
          <h2 className="font-heading font-bold text-lg mb-4">Body Fat % Over Time</h2>
          {bfData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={chartStyle} />
                  <Line type="monotone" dataKey="bf" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{emptyBf}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
        >
          <h2 className="font-heading font-bold text-lg mb-4">Weekly Calorie Average vs Target</h2>
          {calAvgData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calAvgData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={chartStyle} />
                  <ReferenceLine y={calorieTarget} stroke="#6b7280" strokeDasharray="4 4" />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                    {calAvgData.map((entry, i) => (
                      <Cell key={i} fill={entry.within ? '#10b981' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{emptyFood}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
        >
          <h2 className="font-heading font-bold text-lg mb-4">Weekly Protein Adherence %</h2>
          {macroAdherenceData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={macroAdherenceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 'auto']} />
                  <Tooltip contentStyle={chartStyle} />
                  <ReferenceLine y={90} stroke="#4a9eff" strokeDasharray="4 4" label={{ value: '90%', fill: '#6b7280', fontSize: 10 }} />
                  <Bar dataKey="adherence" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{emptyFood}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
        >
          <h2 className="font-heading font-bold text-lg mb-4">Total Volume per Week</h2>
          {volData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={chartStyle} />
                  <Bar dataKey="volume" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{emptyWorkouts}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 overflow-x-auto"
        >
          <h2 className="font-heading font-bold text-lg mb-4">Personal Records</h2>
          {prRows.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-muted-foreground border-b border-gray-200">
                  <th className="pb-2 pr-2 font-medium">Exercise</th>
                  <th className="pb-2 pr-2 font-medium">Best weight</th>
                  <th className="pb-2 pr-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">vs last month</th>
                </tr>
              </thead>
              <tbody>
                {prRows.map((row) => (
                  <tr key={row.name} className="border-b border-gray-100">
                    <td className="py-2 pr-2">{row.name}</td>
                    <td className="py-2 pr-2 text-primary font-semibold">
                      {row.best} {profile.units === 'metric' ? 'kg' : 'lbs'}
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">{row.bestDate}</td>
                    <td className="py-2">{row.vsLast}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{emptyWorkouts}</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h2 className="font-heading font-bold text-lg mb-4">Workout Streak</h2>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 90 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (89 - i));
              const dateStr = d.toISOString().split('T')[0];
              const active = workoutDates.has(dateStr);
              return (
                <div key={i} className={`w-3 h-3 rounded-sm ${active ? 'bg-primary' : 'bg-gray-200'}`} title={dateStr} />
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Last 90 days</p>
        </motion.div>
      </div>
    </div>
  );
}
