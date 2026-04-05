import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Check, Loader2, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { generateWorkoutPlan, callGroqWithTools } from '@/services/groqClient';
import type { WorkoutDay, LoggedExercise, LoggedSet, Exercise, WorkoutPlan } from '@/types/fitness';
import { toast } from 'sonner';

function normalizeGeneratedPlan(raw: { weeklyPlan?: unknown[] }): WorkoutPlan {
  const days = Array.isArray(raw.weeklyPlan) ? raw.weeklyPlan : [];
  const weeklyPlan: WorkoutDay[] = days.map((d) => {
    const day = d as Record<string, unknown>;
    const exList = Array.isArray(day.exercises) ? day.exercises : [];
    const exercises: Exercise[] = exList.map((ex) => {
      const e = ex as Record<string, unknown>;
      const out: Exercise = {
        name: String(e.name ?? ''),
        sets: Number(e.sets) || 0,
        reps: Number(e.reps) || 0,
        weight: e.weight != null && e.weight !== '' ? Number(e.weight) : undefined,
        restSeconds: Number(e.restSeconds ?? e.rest_seconds) || 90,
        formTip: String(e.formTip ?? e.form_tip ?? ''),
      };
      const wid = e.wgerExerciseId ?? e.wger_exercise_id;
      if (wid != null && Number.isFinite(Number(wid))) out.wgerExerciseId = Number(wid);
      return out;
    });
    return {
      day: String(day.day ?? ''),
      label: String(day.label ?? ''),
      exercises,
    };
  });
  return { weeklyPlan, generatedAt: Date.now() };
}

export default function WorkoutTracker() {
  const { profile, nutritionPlan, workoutPlan, setWorkoutPlan, addWorkoutSession, groqApiKey, setCurrentPage, workoutSessions } = useAppStore();
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [logging, setLogging] = useState(false);
  const [logData, setLogData] = useState<Record<string, LoggedSet[]>>({});
  const [aiTip, setAiTip] = useState('');
  const [askingAI, setAskingAI] = useState(false);

  if (!profile) return null;

  const handleGenerate = async () => {
    if (!groqApiKey) { toast.error('Add Groq API key in Settings'); return; }
    setGenerating(true);
    try {
      const raw = await generateWorkoutPlan(groqApiKey, profile);
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as { weeklyPlan?: unknown[] };
      setWorkoutPlan(normalizeGeneratedPlan(parsed));
      toast.success('Workout plan generated!');
    } catch {
      toast.error('Failed to generate plan. Check API key.');
    }
    setGenerating(false);
  };

  const startLogging = (day: WorkoutDay) => {
    setSelectedDay(day);
    setLogging(true);
    const initial: Record<string, LoggedSet[]> = {};
    day.exercises.forEach((e) => {
      initial[e.name] = Array.from({ length: e.sets }, () => ({ reps: e.reps, weight: e.weight || 0 }));
    });
    setLogData(initial);
  };

  const updateSet = (exName: string, setIdx: number, field: 'reps' | 'weight', value: number) => {
    setLogData((prev) => ({
      ...prev,
      [exName]: prev[exName].map((s, i) => i === setIdx ? { ...s, [field]: value } : s),
    }));
  };

  const saveWorkout = () => {
    if (!selectedDay) return;
    const exercises: LoggedExercise[] = selectedDay.exercises.map((e) => ({
      name: e.name, sets: logData[e.name] || [],
    }));
    addWorkoutSession({
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      dayLabel: selectedDay.label,
      exercises,
      timestamp: Date.now(),
    });
    setLogging(false);
    setSelectedDay(null);
    toast.success('Workout logged! 💪');
  };

  const askExerciseTip = async (exerciseName: string) => {
    if (!groqApiKey) { toast.error('Add API key'); return; }
    if (!nutritionPlan) { toast.error('Complete onboarding first'); return; }
    setAskingAI(true);
    try {
      const { content } = await callGroqWithTools(
        [
          {
            role: 'user',
            content: `Give me a quick form tip and alternative for "${exerciseName}" with ${profile.equipment} equipment. Be concise. Do not change the workout plan unless truly necessary.`,
          },
        ],
        { extraSystemSuffix: 'Short answer only unless the user needs a plan change.' }
      );
      setAiTip(content);
    } catch { toast.error('AI error'); }
    setAskingAI(false);
  };

  // Workout history
  const recentSessions = workoutSessions.slice(-5).reverse();

  return (
    <div className="min-h-screen pb-8">
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('dashboard')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading font-bold gradient-text">Workout Tracker</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {!workoutPlan ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <p className="text-muted-foreground mb-4">No workout plan yet. Let AI create one for you!</p>
            <button onClick={handleGenerate} disabled={generating}
              className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : 'Generate Workout Plan'}
            </button>
          </motion.div>
        ) : logging && selectedDay ? (
          /* Logging View */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-xl">{selectedDay.label}</h2>
              <button onClick={() => setLogging(false)} className="text-sm text-muted-foreground">Cancel</button>
            </div>
            {selectedDay.exercises.map((ex) => (
              <div key={ex.name} className="glass-strong rounded-xl p-4 border-glow">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold">{ex.name}</p>
                    <p className="text-xs text-muted-foreground">{ex.formTip}</p>
                  </div>
                  <button onClick={() => askExerciseTip(ex.name)} className="text-primary">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {(logData[ex.name] || []).map((set, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-8">#{i + 1}</span>
                      <input type="number" value={set.reps} onChange={(e) => updateSet(ex.name, i, 'reps', Number(e.target.value))}
                        className="w-16 bg-input border border-border rounded px-2 py-1 text-center text-foreground" />
                      <span className="text-muted-foreground">reps ×</span>
                      <input type="number" value={set.weight} onChange={(e) => updateSet(ex.name, i, 'weight', Number(e.target.value))}
                        className="w-20 bg-input border border-border rounded px-2 py-1 text-center text-foreground" />
                      <span className="text-muted-foreground">{profile.units === 'metric' ? 'kg' : 'lbs'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={saveWorkout} className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center gap-2 justify-center">
              <Check className="w-5 h-5" /> Save Workout
            </button>
          </motion.div>
        ) : (
          /* Plan View */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-xl">Weekly Plan</h2>
              <button onClick={handleGenerate} disabled={generating} className="text-xs text-primary hover:underline">
                {generating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
            {workoutPlan.weeklyPlan.map((day) => (
              <motion.div key={day.day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-strong rounded-xl p-5 border-glow">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-heading font-bold">{day.day}</p>
                    <p className="text-primary text-sm">{day.label}</p>
                  </div>
                  <button onClick={() => startLogging(day)} className="gradient-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                    <Play className="w-3 h-3" /> Start
                  </button>
                </div>
                <div className="space-y-1">
                  {day.exercises.map((ex) => (
                    <p key={ex.name} className="text-sm text-muted-foreground">
                      {ex.name} — {ex.sets}×{ex.reps} {ex.weight ? `@ ${ex.weight}${profile.units === 'metric' ? 'kg' : 'lbs'}` : ''}
                    </p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* AI Tip */}
        {(aiTip || askingAI) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-strong rounded-xl p-4 border-glow">
            {askingAI ? (
              <div className="flex items-center gap-2 text-primary text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Getting tip...</div>
            ) : (
              <div>
                <p className="text-xs text-primary font-semibold mb-1">AI Tip</p>
                <p className="text-sm whitespace-pre-wrap">{aiTip}</p>
                <button onClick={() => setAiTip('')} className="text-xs text-muted-foreground mt-2 hover:underline">Dismiss</button>
              </div>
            )}
          </motion.div>
        )}

        {/* Recent History */}
        {recentSessions.length > 0 && (
          <div>
            <h2 className="font-heading font-bold text-lg mb-3">Recent Sessions</h2>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div key={s.id} className="glass rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm">{s.dayLabel}</p>
                    <p className="text-xs text-muted-foreground">{s.date}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.exercises.length} exercises</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
