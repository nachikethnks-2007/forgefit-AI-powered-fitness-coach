import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Scale, Dumbbell, Calendar, Flame } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const modeIcons = { cut: Flame, bulk: Dumbbell, recomposition: Scale };

export default function Achievements() {
  const { completedGoals, setCurrentPage } = useAppStore();

  return (
    <div className="min-h-screen pb-8">
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('home')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Trophy className="w-5 h-5 text-primary" />
          <h1 className="font-heading font-bold gradient-text">Past Achievements</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        {completedGoals.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No completed goals yet. Keep pushing!</p>
          </div>
        ) : (
          completedGoals.map((goal, i) => {
            const ModeIcon = modeIcons[goal.mode];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-strong rounded-2xl p-5 border-glow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="gradient-primary p-2 rounded-lg">
                    <ModeIcon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold capitalize">{goal.mode}</h3>
                    <p className="text-xs text-muted-foreground">{goal.startDate} → {goal.endDate}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-secondary/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Weight</p>
                    <p className="font-semibold">{goal.startWeight} → {goal.endWeight}</p>
                  </div>
                  {goal.startBodyFat && goal.endBodyFat && (
                    <div className="bg-secondary/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Body Fat</p>
                      <p className="font-semibold">{goal.startBodyFat}% → {goal.endBodyFat}%</p>
                    </div>
                  )}
                  <div className="bg-secondary/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Workouts</p>
                    <p className="font-semibold">{goal.totalWorkouts}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Volume</p>
                    <p className="font-semibold">{goal.totalVolume.toLocaleString()}</p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
