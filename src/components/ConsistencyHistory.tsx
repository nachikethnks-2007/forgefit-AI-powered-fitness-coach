import { motion } from 'framer-motion';
import { History, TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { useConsistencyStore } from '@/store/consistencyStore';
import { TIER_COLORS } from '@/types/consistency';

export default function ConsistencyHistory() {
  const { consistencyHistory } = useConsistencyStore();

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'workout':
        return <Flame className="w-4 h-4 text-orange-500" />;
      case 'streak_bonus':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'weekly_bonus':
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'penalty':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <History className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityColor = (pointsEarned: number) => {
    if (pointsEarned > 0) return 'text-green-600';
    if (pointsEarned < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"
    >
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-lg">Consistency History</h2>
      </div>

      {consistencyHistory.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No consistency history yet. Start working out to track your progress!
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {consistencyHistory.map((entry, index) => (
            <motion.div
              key={`${entry.date}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getActivityIcon(entry.activityType)}
                <div>
                  <p className="text-sm font-medium">{entry.activityType.replace('_', ' ')}</p>
                  <p className="text-xs text-muted-foreground">{entry.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${getActivityColor(entry.pointsEarned)}`}>
                  {entry.pointsEarned > 0 ? '+' : ''}{entry.pointsEarned} pts
                </p>
                <p className="text-xs text-muted-foreground">{entry.tier}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
