import { motion } from 'framer-motion';
import { Trophy, Flame, TrendingUp, Award } from 'lucide-react';
import { useConsistencyStore } from '@/store/consistencyStore';
import { TIER_COLORS } from '@/types/consistency';

export default function ConsistencyTierDisplay() {
  const {
    currentTier,
    progressScore,
    streak,
    totalWorkouts,
    longestStreak,
    getTierProgress,
    getNextTier,
  } = useConsistencyStore();

  const tierProgress = getTierProgress();
  const nextTier = getNextTier();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Consistency Tier
        </h2>
        <div
          className="px-3 py-1 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: TIER_COLORS[currentTier.rank] }}
        >
          {currentTier.rank} {currentTier.level}
        </div>
      </div>

      {/* Tier Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress to {nextTier ? `${nextTier.rank} ${nextTier.level}` : 'Max Tier'}</span>
          <span className="font-medium">{tierProgress.percentage.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tierProgress.percentage}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full transition-all"
            style={{ backgroundColor: TIER_COLORS[currentTier.rank] }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{progressScore} pts</span>
          <span>{nextTier ? `${nextTier.threshold} pts` : '∞'}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <p className="text-xl font-heading font-bold">{streak}</p>
          <p className="text-xs text-muted-foreground">Current Streak</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xl font-heading font-bold">{totalWorkouts}</p>
          <p className="text-xs text-muted-foreground">Total Workouts</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <Award className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-heading font-bold">{longestStreak}</p>
          <p className="text-xs text-muted-foreground">Best Streak</p>
        </div>
      </div>
    </motion.div>
  );
}
