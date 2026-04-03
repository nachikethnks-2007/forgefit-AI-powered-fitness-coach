import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Trophy, ArrowRight, Flame, Dumbbell, Scale, Calendar, TrendingDown, Activity } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import confetti from 'canvas-confetti';

const modeLabels = { cut: 'Cut', bulk: 'Bulk', recomposition: 'Recomposition' };
const modeIcons = { cut: Flame, bulk: Dumbbell, recomposition: Scale };

export default function GoalCompletion() {
  const { profile, nutritionPlan, measurements, workoutSessions, completeGoal, setCurrentPage } = useAppStore();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // Fire confetti burst
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#00d4aa', '#4a9eff', '#a855f7', '#f59e0b'];

    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // Big center burst
    confetti({ particleCount: 100, spread: 100, origin: { y: 0.6 }, colors });
  }, []);

  if (!profile) return null;

  const startWeight = profile.weight;
  const latestWeight = measurements.length > 0 ? measurements[measurements.length - 1].weight : startWeight;
  const startBf = nutritionPlan?.bodyFatPercent;
  const latestBf = measurements.length > 0
    ? measurements.filter(m => m.bodyFatPercent).pop()?.bodyFatPercent
    : startBf;

  const totalWorkouts = workoutSessions.length;
  const totalVolume = workoutSessions.reduce((acc, s) =>
    acc + s.exercises.reduce((a, ex) => a + ex.sets.reduce((b, set) => b + set.reps * set.weight, 0), 0)
  , 0);

  const startDate = workoutSessions.length > 0
    ? workoutSessions[0].date
    : new Date().toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  const ModeIcon = modeIcons[profile.mode];

  const handleComplete = () => {
    completeGoal({
      mode: profile.mode,
      startWeight,
      endWeight: latestWeight,
      startBodyFat: startBf,
      endBodyFat: latestBf,
      totalWorkouts,
      totalVolume,
      startDate,
      endDate,
    });
    setCurrentPage('home');
  };

  const stats = [
    { icon: Scale, label: 'Weight Change', value: `${startWeight} → ${latestWeight}`, unit: profile.units === 'metric' ? 'kg' : 'lbs' },
    { icon: TrendingDown, label: 'Body Fat', value: startBf && latestBf ? `${startBf}% → ${latestBf}%` : 'N/A', unit: '' },
    { icon: Activity, label: 'Workouts', value: totalWorkouts.toString(), unit: 'sessions' },
    { icon: Dumbbell, label: 'Total Volume', value: totalVolume.toLocaleString(), unit: profile.units === 'metric' ? 'kg' : 'lbs' },
    { icon: Calendar, label: 'Duration', value: startDate === endDate ? '< 1 day' : `${startDate} — ${endDate}`, unit: '' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="max-w-md w-full"
      >
        {/* Trophy header */}
        <motion.div
          initial={{ y: -30 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 mx-auto gradient-primary rounded-full flex items-center justify-center mb-4 glow-primary">
            <Trophy className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-heading font-extrabold gradient-text">Goal Complete!</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <ModeIcon className="w-5 h-5 text-primary" />
            <p className="text-muted-foreground font-body">{modeLabels[profile.mode]} journey finished</p>
          </div>
        </motion.div>

        {/* Stats card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-strong rounded-2xl p-6 border-glow space-y-4"
        >
          <h2 className="font-heading font-bold text-lg text-center">Achievement Summary</h2>
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="flex items-center gap-3 bg-secondary/50 rounded-xl px-4 py-3"
            >
              <s.icon className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{s.value} {s.unit}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-6 space-y-3"
        >
          {!confirmed ? (
            <button
              onClick={() => setConfirmed(true)}
              className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-heading font-bold text-lg flex items-center justify-center gap-2 glow-primary-sm"
            >
              Archive & Start New Goal <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="glass-strong rounded-xl p-4 border-glow text-center space-y-3">
              <p className="text-sm text-muted-foreground">Your progress will be archived. Ready to start fresh?</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmed(false)} className="flex-1 border border-border py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button onClick={handleComplete} className="flex-1 gradient-primary text-primary-foreground py-2 rounded-lg font-semibold text-sm">
                  Confirm
                </button>
              </div>
            </div>
          )}
          <button onClick={() => setCurrentPage('dashboard')} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
            Back to Dashboard
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
