import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ProgressHub() {
  const { profile, nutritionPlan, measurements, foodLog, workoutSessions, setCurrentPage } = useAppStore();

  if (!profile || !nutritionPlan) return null;

  // Weight over time
  const weightData = measurements.map((m) => ({ date: m.date.slice(5), weight: m.weight }));

  // Body fat over time
  const bfData = measurements.filter(m => m.bodyFatPercent).map((m) => ({ date: m.date.slice(5), bf: m.bodyFatPercent }));

  // Weekly calorie averages
  const weeklyCalories: Record<string, number[]> = {};
  foodLog.forEach((f) => {
    const week = f.date.slice(0, 7);
    if (!weeklyCalories[week]) weeklyCalories[week] = [];
    weeklyCalories[week].push(f.calories);
  });
  const calAvgData = Object.entries(weeklyCalories).slice(-8).map(([week, cals]) => ({
    week: week.slice(2),
    avg: Math.round(cals.reduce((a, b) => a + b, 0) / Math.max(cals.length, 1)),
    target: nutritionPlan.dailyCalories,
  }));

  // Weekly volume
  const weeklyVolume: Record<string, number> = {};
  workoutSessions.forEach((s) => {
    const week = s.date.slice(0, 7);
    const vol = s.exercises.reduce((a, ex) => a + ex.sets.reduce((b, set) => b + set.reps * set.weight, 0), 0);
    weeklyVolume[week] = (weeklyVolume[week] || 0) + vol;
  });
  const volData = Object.entries(weeklyVolume).slice(-8).map(([week, vol]) => ({ week: week.slice(2), volume: vol }));

  // PRs
  const prs: Record<string, number> = {};
  workoutSessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      const max = Math.max(...ex.sets.map((set) => set.weight), 0);
      if (!prs[ex.name] || max > prs[ex.name]) prs[ex.name] = max;
    });
  });

  // Workout streak heatmap (simple)
  const workoutDates = new Set(workoutSessions.map((s) => s.date));

  const chartStyle = { background: 'transparent', border: 'none', borderRadius: 8 };

  return (
    <div className="min-h-screen pb-8">
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('dashboard')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-bold gradient-text">Progress Hub</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Weight */}
        {weightData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-4">Weight Over Time</h2>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={chartStyle} />
                  <Line type="monotone" dataKey="weight" stroke="#00d4aa" strokeWidth={2} dot={{ r: 3, fill: '#00d4aa' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Body Fat */}
        {bfData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-4">Body Fat %</h2>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={bfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={chartStyle} />
                  <Line type="monotone" dataKey="bf" stroke="#4a9eff" strokeWidth={2} dot={{ r: 3, fill: '#4a9eff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Volume */}
        {volData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-4">Weekly Volume</h2>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={volData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={chartStyle} />
                  <Bar dataKey="volume" fill="#00d4aa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* PRs */}
        {Object.keys(prs).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-4">🏆 Personal Records</h2>
            <div className="space-y-2">
              {Object.entries(prs).map(([name, weight]) => (
                <div key={name} className="flex justify-between text-sm bg-secondary/50 rounded-lg px-4 py-2">
                  <span>{name}</span>
                  <span className="text-primary font-semibold">{weight} {profile.units === 'metric' ? 'kg' : 'lbs'}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Workout Heatmap */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-strong rounded-2xl p-6 border-glow">
          <h2 className="font-heading font-bold text-lg mb-4">Workout Streak</h2>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 90 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (89 - i));
              const dateStr = d.toISOString().split('T')[0];
              const active = workoutDates.has(dateStr);
              return (
                <div key={i} className={`w-3 h-3 rounded-sm ${active ? 'bg-primary' : 'bg-secondary'}`}
                  title={dateStr} />
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Last 90 days</p>
        </motion.div>

        {/* Empty state */}
        {weightData.length === 0 && volData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Log workouts and measurements to see your progress here!</p>
          </div>
        )}
      </div>
    </div>
  );
}
