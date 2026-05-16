import { motion } from 'framer-motion';
import { Flame, Dumbbell, Scale } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { Mode } from '@/types/fitness';
import { useState } from 'react';

const modes = [
  {
    id: 'cut' as Mode,
    icon: Flame,
    title: 'Cut',
    subtitle: 'Lose fat, keep muscle',
    description: 'Optimize your calorie deficit to shed body fat while preserving lean muscle mass.',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 'bulk' as Mode,
    icon: Dumbbell,
    title: 'Bulk',
    subtitle: 'Build muscle mass',
    description: 'Strategic calorie surplus with progressive overload to maximize muscle growth.',
    gradient: 'from-primary to-cyan-400',
  },
  {
    id: 'recomposition' as Mode,
    icon: Scale,
    title: 'Recomp',
    subtitle: 'Lose fat & gain muscle',
    description: 'The balanced approach — simultaneously reduce fat and increase lean mass.',
    gradient: 'from-violet-500 to-primary',
  },
];

export default function ModeSelection() {
  const { profile, setCurrentPage, completedGoals } = useAppStore();
  const [showWelcomeBack, setShowWelcomeBack] = useState(!!profile);

  const handleSelectMode = (mode: Mode) => {
    if (profile) {
      // Returning user — go to dashboard
      useAppStore.getState().setProfile({ ...profile, mode });
      setCurrentPage('dashboard');
    } else {
      // New user — go to onboarding
      useAppStore.setState({ currentPage: 'onboarding' });
      // Store selected mode temporarily
      sessionStorage.setItem('selectedMode', mode);
    }
  };

  const handleKeepData = () => {
    setCurrentPage('dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gray-50">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl md:text-7xl font-heading font-extrabold gradient-text tracking-tight">
          ForgeFit
        </h1>
        <p className="text-muted-foreground mt-3 text-lg font-body">
          AI-Powered Fitness Intelligence
        </p>
      </motion.div>

      {/* Welcome back */}
      {showWelcomeBack && profile && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl p-6 mb-8 max-w-md w-full text-center shadow-sm border border-gray-200"
        >
          <p className="text-primary font-heading font-semibold text-lg">Welcome back, {profile.name}!</p>
          <p className="text-muted-foreground text-sm mt-1">
            {profile.weight}{profile.units === 'metric' ? 'kg' : 'lbs'} · {profile.mode} mode
          </p>
          <div className="flex gap-3 mt-4 justify-center">
            <button
              onClick={handleKeepData}
              className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm"
            >
              Continue Journey
            </button>
            <button
              onClick={() => setShowWelcomeBack(false)}
              className="border border-border px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Choose New Mode
            </button>
          </div>
        </motion.div>
      )}

      {/* Mode cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        {modes.map((mode, i) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelectMode(mode.id)}
            className="bg-white rounded-2xl p-8 text-left group cursor-pointer border border-gray-200 hover:shadow-md transition-all duration-300"
          >
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
              <mode.icon className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="font-heading font-bold text-2xl text-foreground mb-1">{mode.title}</h2>
            <p className="text-primary text-sm font-semibold mb-3">{mode.subtitle}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{mode.description}</p>
          </motion.button>
        ))}
      </div>

      {/* Past achievements */}
      {completedGoals.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={() => setCurrentPage('achievements')}
          className="mt-8 text-primary text-sm hover:underline font-body"
        >
          🏆 View Past Achievements ({completedGoals.length})
        </motion.button>
      )}
    </div>
  );
}
