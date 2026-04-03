import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { Mode, ActivityLevel } from '@/types/fitness';
import { calculateNutritionPlan } from '@/services/groqClient';
import { toast } from 'sonner';

export default function SettingsPage() {
  const store = useAppStore();
  const { profile, groqApiKey, setGroqApiKey, setCurrentPage, resetAll, setProfile, setNutritionPlan } = store;
  const [apiKey, setApiKey] = useState(groqApiKey);
  const [showReset, setShowReset] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const handleSaveKey = () => {
    setGroqApiKey(apiKey);
    toast.success('API key saved');
  };

  const handleModeChange = async (mode: Mode) => {
    if (!profile) return;
    const updated = { ...profile, mode };
    setProfile(updated);
    setRecalculating(true);
    try {
      const plan = await calculateNutritionPlan(groqApiKey, updated);
      setNutritionPlan(plan);
      toast.success('Plan recalculated for ' + mode + ' mode');
    } catch {
      toast.info('Recalculated locally');
    }
    setRecalculating(false);
  };

  const handleReset = () => {
    resetAll();
    setCurrentPage('home');
    toast.success('All data cleared');
  };

  return (
    <div className="min-h-screen pb-8">
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('dashboard')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-bold gradient-text">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* API Key */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-strong rounded-2xl p-6 border-glow">
          <h2 className="font-heading font-bold text-lg mb-3">Groq API Key</h2>
          <p className="text-xs text-muted-foreground mb-3">Required for AI features. Get yours at console.groq.com</p>
          <div className="flex gap-2">
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="gsk_..." />
            <button onClick={handleSaveKey} className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">Save</button>
          </div>
        </motion.div>

        {/* Mode */}
        {profile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-3">Active Mode</h2>
            <div className="flex gap-2">
              {(['cut', 'bulk', 'recomposition'] as Mode[]).map((m) => (
                <button key={m} onClick={() => handleModeChange(m)} disabled={recalculating}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    profile.mode === m ? 'gradient-primary text-primary-foreground glow-primary-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Profile info */}
        {profile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-3">Profile</h2>
            <div className="space-y-2 text-sm">
              {[
                { l: 'Name', v: profile.name },
                { l: 'Age', v: profile.age },
                { l: 'Weight', v: `${profile.weight} ${profile.units === 'metric' ? 'kg' : 'lbs'}` },
                { l: 'Height', v: `${profile.height} ${profile.units === 'metric' ? 'cm' : 'in'}` },
                { l: 'Fitness', v: profile.fitnessLevel },
                { l: 'Activity', v: profile.activityLevel.replace('_', ' ') },
                { l: 'Equipment', v: profile.equipment.replace('_', ' ') },
              ].map((item) => (
                <div key={item.l} className="flex justify-between">
                  <span className="text-muted-foreground">{item.l}</span>
                  <span className="capitalize">{item.v}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Units toggle */}
        {profile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-strong rounded-2xl p-6 border-glow">
            <h2 className="font-heading font-bold text-lg mb-3">Units</h2>
            <div className="flex gap-2">
              {(['metric', 'imperial'] as const).map((u) => (
                <button key={u} onClick={() => setProfile({ ...profile, units: u })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                    profile.units === u ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}>
                  {u === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lbs/in)'}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Reset */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-strong rounded-2xl p-6 border border-destructive/20">
          <h2 className="font-heading font-bold text-lg mb-2 text-destructive">Danger Zone</h2>
          <p className="text-xs text-muted-foreground mb-4">Clear all data and start fresh</p>
          {!showReset ? (
            <button onClick={() => setShowReset(true)} className="flex items-center gap-2 text-destructive text-sm hover:underline">
              <Trash2 className="w-4 h-4" /> Reset & Restart
            </button>
          ) : (
            <div className="bg-destructive/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive text-sm mb-3">
                <AlertTriangle className="w-4 h-4" /> This will erase all your data!
              </div>
              <div className="flex gap-2">
                <button onClick={handleReset} className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-semibold">Confirm Delete</button>
                <button onClick={() => setShowReset(false)} className="text-muted-foreground text-sm hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
