import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Sparkles, X, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getAICoachResponse } from '@/services/aiService';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function WeeklyCheckIn() {
  const { profile, nutritionPlan, foodLog, workoutSessions, measurements } = useAppStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);

  if (!profile || !nutritionPlan) return null;

  const now = new Date();
  const isSunday = now.getDay() === 0;
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const weekWorkouts = workoutSessions.filter(s => new Date(s.date) >= weekAgo);
  const weekFood = foodLog.filter(f => new Date(f.date) >= weekAgo);
  const weekMeasurements = measurements.filter(m => new Date(m.date) >= weekAgo);

  const generateReview = async () => {
    setLoading(true);
    setOpen(true);

    const totalCalories = weekFood.reduce((a, f) => a + f.calories, 0);
    const avgCalories = weekFood.length > 0 ? Math.round(totalCalories / 7) : 0;

    const totalProtein = weekFood.reduce((a, f) => a + f.protein, 0);
    const avgProtein = weekFood.length > 0 ? Math.round(totalProtein / 7) : 0;

    const totalVolume = weekWorkouts.reduce((acc, s) =>
      acc + s.exercises.reduce((a, ex) =>
        a + ex.sets.reduce((b, set) => b + set.reps * set.weight, 0), 0)
    , 0);

    const latestWeight = weekMeasurements.length > 0
      ? weekMeasurements[weekMeasurements.length - 1].weight
      : profile.weight;

    const context = `
WEEKLY CHECK-IN DATA (last 7 days):
- Workouts completed: ${weekWorkouts.length} / ${profile.trainingDays} planned
- Avg daily calories: ${avgCalories} kcal (target: ${nutritionPlan.dailyCalories} kcal)
- Avg daily protein: ${avgProtein}g (target: ${nutritionPlan.protein}g)
- Total volume lifted: ${totalVolume.toLocaleString()} ${profile.units === 'metric' ? 'kg' : 'lbs'}
- Latest weight: ${latestWeight} ${profile.units === 'metric' ? 'kg' : 'lbs'}
- Weight at start: ${profile.weight} ${profile.units === 'metric' ? 'kg' : 'lbs'}
${profile.targetWeight ? `- Target weight: ${profile.targetWeight} ${profile.units === 'metric' ? 'kg' : 'lbs'}` : ''}

Generate a comprehensive weekly review with:
1. Overview
2. What Went Well
3. Areas to Improve
4. Adjusted Targets
5. Focus for Next Week
`;

    try {
      const { content, toolSummaries } = await getAICoachResponse(
        [{ role: 'user', content: context }],
        {
          profile,
          nutritionPlan,
        }
      );

      setReview(
        [toolSummaries && toolSummaries.length ? `**Updates:**\n${toolSummaries.map((s) => `- ${s}`).join('\n')}` : '', content]
          .filter(Boolean)
          .join('\n\n')
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate review');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={generateReview}
        className={`w-full glass-strong rounded-2xl p-5 border-glow text-left flex items-center gap-4 transition-all ${isSunday ? 'glow-primary-sm' : ''}`}
      >
        <div className="gradient-primary p-3 rounded-xl">
          <Calendar className="w-6 h-6 text-primary-foreground" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold">Weekly AI Check-In</h3>
            {isSunday && (
              <span className="text-[10px] font-semibold uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                Today
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSunday ? 'It\'s Sunday — time for your weekly review!' : 'Get an AI-powered review of your week'}
          </p>
        </div>

        <Sparkles className="w-5 h-5 text-primary" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
            onClick={() => !loading && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-strong rounded-2xl p-6 max-w-lg w-full border-glow relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="font-heading font-bold text-xl gradient-text">
                  Weekly Review
                </h2>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Analyzing your week...
                  </p>
                </div>
              ) : review ? (
                <div className="prose prose-sm prose-invert max-w-none text-foreground text-sm leading-relaxed">
                  <ReactMarkdown>{review}</ReactMarkdown>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}