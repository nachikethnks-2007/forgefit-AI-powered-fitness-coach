import { motion } from 'framer-motion';
import { Flame, Dumbbell, Scale, Utensils, Activity, TrendingUp, Settings, MessageSquare, Plus, Trophy, Bell } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { toast } from 'sonner';
import MuscleHeatmap from '@/components/MuscleHeatmap';
import WeeklyCheckIn from '@/components/WeeklyCheckIn';
import { computeGoalEta } from '@/utils/goalEta';
import { runBiWeeklyWorkoutAnalysis, getDefaultInsight } from '@/utils/workoutAnalysis';

const modeIcons = { cut: Flame, bulk: Dumbbell, recomposition: Scale };
const modeColors = { cut: 'text-orange-400', bulk: 'text-primary', recomposition: 'text-violet-400' };

export default function Dashboard() {
  const {
    profile,
    nutritionPlan,
    foodLog,
    workoutSessions,
    measurements,
    setCurrentPage,
    addFoodEntry,
    addMeasurement,
  } = useAppStore();
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [food, setFood] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '' });
  const [goalReached, setGoalReached] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [workoutInsight, setWorkoutInsight] = useState<string | null>(null);

  // Run bi-weekly workout analysis on component mount
  useEffect(() => {
    const analyzeWorkouts = async () => {
      try {
        const insight = await runBiWeeklyWorkoutAnalysis();
        if (insight) {
          setWorkoutInsight(insight);
        }
      } catch (error) {
        console.error('Workout analysis failed:', error);
      }
    };

    analyzeWorkouts();
  }, []);

  useEffect(() => {
    // DISABLED: Automatic weekly checkin was causing workout tool calls on page load
    // void import('@/utils/proactiveAI').then((m) => m.runSundayWeeklyCheckin());
  }, []);

  // Check if target weight reached
  useEffect(() => {
    if (!profile?.targetWeight || measurements.length === 0) return;
    const latest = measurements[measurements.length - 1].weight;
    const target = profile.targetWeight;
    const mode = profile.mode;
    if (mode === 'cut' && latest <= target) setGoalReached(true);
    else if (mode === 'bulk' && latest >= target) setGoalReached(true);
    else if (mode === 'recomposition' && Math.abs(latest - target) <= 1) setGoalReached(true);
  }, [profile, measurements]);

  if (!profile || !nutritionPlan) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayFood = foodLog.filter((f) => f.date === today);
  const consumed = todayFood.reduce((a, f) => ({
    cal: a.cal + f.calories, p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fats,
  }), { cal: 0, p: 0, c: 0, f: 0 });

  const calRemaining = nutritionPlan.dailyCalories - consumed.cal;
  const thisWeekWorkouts = workoutSessions.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return d >= weekAgo;
  }).length;

  const ModeIcon = modeIcons[profile.mode];

  const macroData = [
    { name: 'Protein', value: consumed.p, target: nutritionPlan.protein, color: '#00d4aa' },
    { name: 'Carbs', value: consumed.c, target: nutritionPlan.carbs, color: '#4a9eff' },
    { name: 'Fats', value: consumed.f, target: nutritionPlan.fats, color: '#ff6b6b' },
  ];

  const calData = [
    { name: 'Consumed', value: consumed.cal, color: '#00d4aa' },
    { name: 'Remaining', value: Math.max(calRemaining, 0), color: '#1a2332' },
  ];

  const weightData = measurements.slice(-14).map((m) => ({ date: m.date.slice(5), weight: m.weight }));

  const goalEta = computeGoalEta(profile, measurements);

  const handleLogWeight = () => {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w <= 0) return;
    addMeasurement({
      date: today,
      weight: w,
      timestamp: Date.now(),
    });
    setWeightInput('');
    toast.success('Weight logged');
  };

  const handleAddFood = () => {
    if (!food.name || !food.calories) return;
    addFoodEntry({
      id: Date.now().toString(), name: food.name,
      calories: Number(food.calories), protein: Number(food.protein || 0),
      carbs: Number(food.carbs || 0), fats: Number(food.fats || 0),
      date: today, timestamp: Date.now(),
    });
    setFood({ name: '', calories: '', protein: '', carbs: '', fats: '' });
    setShowFoodModal(false);
    toast.success('Food logged!');
  };

  const quickFoods = [
    { name: 'Chicken Breast (150g)', calories: 248, protein: 46, carbs: 0, fats: 5 },
    { name: 'Rice (1 cup)', calories: 206, protein: 4, carbs: 45, fats: 0 },
    { name: 'Protein Shake', calories: 150, protein: 30, carbs: 5, fats: 2 },
    { name: 'Eggs (2)', calories: 156, protein: 12, carbs: 1, fats: 11 },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Top Bar */}
      <div className="glass-strong border-b border-border px-4 py-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="gradient-primary p-2 rounded-lg">
              <ModeIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-heading font-bold text-lg gradient-text">ForgeFit</span>
              <span className={`ml-2 text-xs font-semibold uppercase ${modeColors[profile.mode]}`}>{profile.mode}</span>
            </div>
          </div>
          <button onClick={() => setCurrentPage('settings')} className="text-muted-foreground hover:text-foreground">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Calories Left', value: calRemaining, unit: 'kcal', color: calRemaining < 0 ? 'text-destructive' : 'text-primary' },
            { label: 'Protein', value: `${consumed.p}/${nutritionPlan.protein}`, unit: 'g', color: 'text-primary' },
            { label: 'Workouts', value: thisWeekWorkouts, unit: 'this week', color: 'text-primary' },
          ].map((s) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-heading font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.unit}</p>
            </motion.div>
          ))}
        </div>

        {/* AI Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-strong rounded-2xl p-5 border-glow"
        >
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-heading font-bold text-lg mb-1">AI Insights</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {workoutInsight || getDefaultInsight()}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Goal ETA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass-strong rounded-2xl p-5 border-glow"
        >
          <h2 className="font-heading font-bold text-lg mb-2">Goal ETA</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {profile.targetWeight == null
              ? 'Add a target weight in onboarding or settings to see an ETA.'
              : goalEta
                ? `At your current trend, you may reach your goal around ${goalEta.label} (~${goalEta.weeksRemaining} weeks).`
                : 'Log at least 2 weigh-ins to predict your ETA.'}
          </p>
        </motion.div>

        {/* Nutrition Ring */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-6 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-lg">Today's Nutrition</h2>
            <button onClick={() => setShowFoodModal(true)} className="gradient-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Log Food
            </button>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={calData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                    {calData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {macroData.map((m) => (
                <div key={m.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{m.name}</span>
                    <span className="text-foreground font-medium">{m.value}g / {m.target}g</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((m.value / m.target) * 100, 100)}%`, backgroundColor: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's log */}
          {todayFood.length > 0 && (
            <div className="mt-4 space-y-2">
              {todayFood.map((f) => (
                <div key={f.id} className="flex justify-between text-sm bg-secondary/50 rounded-lg px-3 py-2">
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">{f.calories} kcal</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Body Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-6 border-glow">
          <h2 className="font-heading font-bold text-lg mb-4">Body Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-heading font-bold text-primary">{profile.weight}</p>
              <p className="text-xs text-muted-foreground">{profile.units === 'metric' ? 'kg' : 'lbs'}</p>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-primary">{nutritionPlan.bodyFatPercent}%</p>
              <p className="text-xs text-muted-foreground">Body Fat</p>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-primary">{nutritionPlan.dailyCalories}</p>
              <p className="text-xs text-muted-foreground">Daily kcal</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Log today&apos;s weight ({profile.units === 'metric' ? 'kg' : 'lbs'})</label>
              <input
                type="number"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder={String(profile.weight)}
              />
            </div>
            <button
              type="button"
              onClick={handleLogWeight}
              className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
            >
              Log
            </button>
          </div>
        </motion.div>

        {/* Weight Chart */}
        {weightData.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-4">Weight Trend</h2>
            <div className="h-40">
              <ResponsiveContainer>
                <LineChart data={weightData}>
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="weight" stroke="#00d4aa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Goal Reached Banner */}
        {goalReached && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong rounded-2xl p-5 border-glow glow-primary text-center"
          >
            <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
            <h2 className="font-heading font-bold text-xl gradient-text">Goal Reached!</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-3">You've hit your target weight. Ready to celebrate?</p>
            <button
              onClick={() => setCurrentPage('goalComplete')}
              className="gradient-primary text-primary-foreground px-6 py-2 rounded-xl font-semibold text-sm"
            >
              View Achievement Summary
            </button>
          </motion.div>
        )}

        {/* Muscle Heatmap */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <MuscleHeatmap />
        </motion.div>

        {/* Weekly Check-In */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <WeeklyCheckIn />
        </motion.div>

        {/* Nav Cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: MessageSquare, label: 'AI Coach', page: 'coach', desc: 'Nutrition advice' },
            { icon: Activity, label: 'Workouts', page: 'workout-tracker', desc: 'Train & log' },
            { icon: Plus, label: 'Split Builder', page: 'split-builder', desc: 'Create splits' },
            { icon: TrendingUp, label: 'Progress', page: 'progress', desc: 'Charts & PRs' },
            { icon: Utensils, label: 'Settings', page: 'settings', desc: 'Edit profile' },
          ].map((nav) => (
            <motion.button
              key={nav.page}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentPage(nav.page)}
              className="glass rounded-xl p-4 text-left group border-glow hover:glow-primary-sm transition-all"
            >
              <nav.icon className="w-6 h-6 text-primary mb-2" />
              <p className="font-heading font-semibold">{nav.label}</p>
              <p className="text-xs text-muted-foreground">{nav.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Food Modal */}
      {showFoodModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFoodModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-strong rounded-2xl p-6 max-w-sm w-full border-glow" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-lg mb-4">Log Food</h3>
            <div className="space-y-3">
              <input value={food.name} onChange={(e) => setFood({ ...food, name: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Food name" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: 'calories', l: 'Calories' }, { k: 'protein', l: 'Protein (g)' },
                  { k: 'carbs', l: 'Carbs (g)' }, { k: 'fats', l: 'Fats (g)' },
                ].map((f) => (
                  <input key={f.k} type="number" value={(food as any)[f.k]} onChange={(e) => setFood({ ...food, [f.k]: e.target.value })}
                    className="bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none" placeholder={f.l} />
                ))}
              </div>
              <button onClick={handleAddFood} className="w-full gradient-primary text-primary-foreground py-2 rounded-lg font-semibold text-sm">Add</button>
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Quick Add</p>
              <div className="space-y-1">
                {quickFoods.map((qf) => (
                  <button key={qf.name} onClick={() => {
                    addFoodEntry({ id: Date.now().toString(), ...qf, date: today, timestamp: Date.now() });
                    toast.success(`${qf.name} logged!`);
                    setShowFoodModal(false);
                  }} className="w-full text-left text-sm bg-secondary/50 hover:bg-secondary rounded-lg px-3 py-2 flex justify-between">
                    <span>{qf.name}</span>
                    <span className="text-muted-foreground">{qf.calories} kcal</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
