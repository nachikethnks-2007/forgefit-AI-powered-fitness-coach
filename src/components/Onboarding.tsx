import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { buildCompleteNutritionPlan } from '@/utils/calculations';
import type { UserProfile, Sex, Units, FitnessLevel, ActivityLevel, Equipment, Timeline, DietPref, Mode } from '@/types/fitness';
import { toast } from 'sonner';

const steps = ['Basic Info', 'Body Measurements', 'Fitness & Activity', 'Goal Details'];

export default function Onboarding() {
  const { setProfile, setNutritionPlan, setCurrentPage } = useAppStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', age: '', sex: 'male' as Sex, units: 'metric' as Units,
    height: '', weight: '', neck: '', waist: '', hip: '',
    fitnessLevel: 'beginner' as FitnessLevel, activityLevel: 'moderately_active' as ActivityLevel,
    trainingDays: '4', equipment: 'full_gym' as Equipment,
    targetWeight: '', timeline: 'moderate' as Timeline, injuries: '', dietPref: 'none' as DietPref,
  });

  const mode = (sessionStorage.getItem('selectedMode') || 'cut') as Mode;

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    const profile: UserProfile = {
      name: form.name, age: Number(form.age), sex: form.sex, units: form.units,
      height: Number(form.height), weight: Number(form.weight),
      neck: Number(form.neck), waist: Number(form.waist), hip: Number(form.hip || 0),
      fitnessLevel: form.fitnessLevel, activityLevel: form.activityLevel,
      trainingDays: Number(form.trainingDays), equipment: form.equipment,
      targetWeight: form.targetWeight ? Number(form.targetWeight) : undefined,
      timeline: form.timeline, injuries: form.injuries || undefined,
      dietPref: form.dietPref, mode,
    };

    setProfile(profile);
    setNutritionPlan(buildCompleteNutritionPlan(profile));
    toast.success('Your personalized plan is ready!');
    setCurrentPage('dashboard');
  };

  const canProceed = () => {
    if (step === 0) return form.name && form.age;
    if (step === 1) return form.height && form.weight && form.neck && form.waist;
    if (step === 2) return true;
    if (step === 3) return true;
    return true;
  };

  const SelectButton = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        selected ? 'gradient-primary text-primary-foreground glow-primary-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full transition-all ${i <= step ? 'gradient-primary' : 'bg-secondary'}`} />
              <p className={`text-xs mt-1 ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="glass-strong rounded-2xl p-8"
          >
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl">Let's get started</h2>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Name</label>
                  <input value={form.name} onChange={(e) => update('name', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Your name" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Age</label>
                  <input type="number" value={form.age} onChange={(e) => update('age', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="25" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Biological Sex</label>
                  <div className="flex gap-3">
                    <SelectButton selected={form.sex === 'male'} onClick={() => update('sex', 'male')}>Male</SelectButton>
                    <SelectButton selected={form.sex === 'female'} onClick={() => update('sex', 'female')}>Female</SelectButton>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Units</label>
                  <div className="flex gap-3">
                    <SelectButton selected={form.units === 'metric'} onClick={() => update('units', 'metric')}>Metric (kg/cm)</SelectButton>
                    <SelectButton selected={form.units === 'imperial'} onClick={() => update('units', 'imperial')}>Imperial (lbs/in)</SelectButton>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl">Body Measurements</h2>
                <p className="text-muted-foreground text-sm">Used for body fat % calculation (US Navy formula)</p>
                {[
                  { key: 'height', label: `Height (${form.units === 'metric' ? 'cm' : 'inches'})`, ph: form.units === 'metric' ? '175' : '69' },
                  { key: 'weight', label: `Weight (${form.units === 'metric' ? 'kg' : 'lbs'})`, ph: form.units === 'metric' ? '80' : '176' },
                  { key: 'neck', label: `Neck (${form.units === 'metric' ? 'cm' : 'inches'})`, ph: form.units === 'metric' ? '38' : '15' },
                  { key: 'waist', label: `Waist (${form.units === 'metric' ? 'cm' : 'inches'})`, ph: form.units === 'metric' ? '85' : '33' },
                  ...(form.sex === 'female' ? [{ key: 'hip', label: `Hip (${form.units === 'metric' ? 'cm' : 'inches'})`, ph: form.units === 'metric' ? '95' : '37' }] : []),
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-sm text-muted-foreground block mb-1">{f.label}</label>
                    <input type="number" value={(form as any)[f.key]} onChange={(e) => update(f.key, e.target.value)}
                      className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder={f.ph} />
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl">Fitness & Activity</h2>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Fitness Level</label>
                  <div className="flex flex-wrap gap-2">
                    {(['beginner', 'intermediate', 'advanced'] as FitnessLevel[]).map((l) => (
                      <SelectButton key={l} selected={form.fitnessLevel === l} onClick={() => update('fitnessLevel', l)}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </SelectButton>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Activity Level</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: 'sedentary', l: 'Sedentary' }, { v: 'lightly_active', l: 'Light' },
                      { v: 'moderately_active', l: 'Moderate' }, { v: 'very_active', l: 'Very Active' },
                      { v: 'athlete', l: 'Athlete' },
                    ].map((a) => (
                      <SelectButton key={a.v} selected={form.activityLevel === a.v} onClick={() => update('activityLevel', a.v)}>
                        {a.l}
                      </SelectButton>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Training Days / Week</label>
                  <input type="number" min="1" max="7" value={form.trainingDays} onChange={(e) => update('trainingDays', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Equipment</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: 'full_gym', l: 'Full Gym' }, { v: 'home_dumbbells', l: 'Home + DB' },
                      { v: 'bodyweight', l: 'Bodyweight' }, { v: 'resistance_bands', l: 'Bands' },
                    ].map((e) => (
                      <SelectButton key={e.v} selected={form.equipment === e.v} onClick={() => update('equipment', e.v)}>
                        {e.l}
                      </SelectButton>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl">Goal Details</h2>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">
                    Target Weight ({form.units === 'metric' ? 'kg' : 'lbs'}) — optional
                  </label>
                  <input type="number" value={form.targetWeight} onChange={(e) => update('targetWeight', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Optional" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Timeline</label>
                  <div className="flex gap-2">
                    {[{ v: 'slow', l: 'Slow & Steady' }, { v: 'moderate', l: 'Moderate' }, { v: 'aggressive', l: 'Aggressive' }].map((t) => (
                      <SelectButton key={t.v} selected={form.timeline === t.v} onClick={() => update('timeline', t.v)}>{t.l}</SelectButton>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Injuries / Limitations</label>
                  <textarea value={form.injuries} onChange={(e) => update('injuries', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none h-20" placeholder="Optional" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Dietary Preference</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: 'none', l: 'No Restriction' }, { v: 'vegetarian', l: 'Vegetarian' },
                      { v: 'vegan', l: 'Vegan' }, { v: 'keto', l: 'Keto' }, { v: 'high_protein', l: 'High Protein' },
                    ].map((d) => (
                      <SelectButton key={d.v} selected={form.dietPref === d.v} onClick={() => update('dietPref', d.v)}>{d.l}</SelectButton>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              {step > 0 ? (
                <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <button onClick={() => setCurrentPage('home')} className="text-muted-foreground hover:text-foreground text-sm">Cancel</button>
              )}

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="gradient-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-40"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="gradient-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                >
                  Launch ForgeFit <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
