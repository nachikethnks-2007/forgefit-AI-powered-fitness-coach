import { useAppStore } from '@/store/useAppStore';
import ModeSelection from '@/components/ModeSelection';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';
import AICoach from '@/components/AICoach';
import WorkoutTracker from '@/components/WorkoutTracker';
import ProgressHub from '@/components/ProgressHub';
import SettingsPage from '@/components/SettingsPage';
import GoalCompletion from '@/components/GoalCompletion';
import Achievements from '@/components/Achievements';
import { AnimatePresence, motion } from 'framer-motion';

const pages: Record<string, React.FC> = {
  home: ModeSelection,
  onboarding: Onboarding,
  dashboard: Dashboard,
  coach: AICoach,
  workouts: WorkoutTracker,
  progress: ProgressHub,
  settings: SettingsPage,
  goalComplete: GoalCompletion,
  achievements: Achievements,
};

const Index = () => {
  const currentPage = useAppStore((s) => s.currentPage);

  // 🔥 SAFE FALLBACK
  const safePage = currentPage && pages[currentPage] ? currentPage : "home";

  const PageComponent = pages[safePage];

  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={safePage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          <PageComponent />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Index;