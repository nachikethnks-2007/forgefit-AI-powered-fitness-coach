import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';

// Maps exercise names (lowercase keywords) to muscle groups
const exerciseMuscleMap: Record<string, string[]> = {
  'bench press': ['chest', 'front_delt', 'triceps'],
  'push up': ['chest', 'front_delt', 'triceps'],
  'pushup': ['chest', 'front_delt', 'triceps'],
  'chest fly': ['chest'],
  'incline': ['chest', 'front_delt'],
  'dip': ['chest', 'triceps'],
  'overhead press': ['front_delt', 'side_delt', 'triceps'],
  'shoulder press': ['front_delt', 'side_delt', 'triceps'],
  'lateral raise': ['side_delt'],
  'front raise': ['front_delt'],
  'face pull': ['rear_delt', 'upper_back'],
  'shrug': ['traps'],
  'deadlift': ['lower_back', 'glutes', 'hamstrings', 'traps'],
  'squat': ['quads', 'glutes', 'hamstrings'],
  'leg press': ['quads', 'glutes'],
  'lunge': ['quads', 'glutes', 'hamstrings'],
  'leg extension': ['quads'],
  'leg curl': ['hamstrings'],
  'hamstring curl': ['hamstrings'],
  'calf raise': ['calves'],
  'calf': ['calves'],
  'row': ['upper_back', 'lats', 'biceps'],
  'pull up': ['lats', 'biceps', 'upper_back'],
  'pullup': ['lats', 'biceps', 'upper_back'],
  'chin up': ['lats', 'biceps'],
  'lat pulldown': ['lats', 'biceps'],
  'pulldown': ['lats', 'biceps'],
  'curl': ['biceps'],
  'bicep': ['biceps'],
  'tricep': ['triceps'],
  'skull crusher': ['triceps'],
  'extension': ['triceps'],
  'plank': ['abs'],
  'crunch': ['abs'],
  'sit up': ['abs'],
  'ab': ['abs'],
  'core': ['abs', 'obliques'],
  'oblique': ['obliques'],
  'russian twist': ['obliques', 'abs'],
  'hip thrust': ['glutes', 'hamstrings'],
  'glute bridge': ['glutes'],
  'cable': ['chest', 'triceps'],
  'fly': ['chest'],
};

function getMusclesForExercise(name: string): string[] {
  const lower = name.toLowerCase();
  for (const [keyword, muscles] of Object.entries(exerciseMuscleMap)) {
    if (lower.includes(keyword)) return muscles;
  }
  return [];
}

// Muscle group positions and SVG path data for front/back body views
interface MuscleRegion {
  id: string;
  label: string;
  side: 'front' | 'back';
  path: string;
}

const muscleRegions: MuscleRegion[] = [
  // FRONT
  { id: 'chest', label: 'Chest', side: 'front', path: 'M35,38 Q50,32 65,38 L62,50 Q50,54 38,50 Z' },
  { id: 'front_delt', label: 'Front Delts', side: 'front', path: 'M28,34 L35,38 L33,46 L26,42 Z' },
  { id: 'side_delt', label: 'Side Delts', side: 'front', path: 'M72,34 L65,38 L67,46 L74,42 Z' },
  { id: 'biceps', label: 'Biceps', side: 'front', path: 'M24,46 L28,44 L30,58 L24,58 Z M76,46 L72,44 L70,58 L76,58 Z' },
  { id: 'abs', label: 'Abs', side: 'front', path: 'M40,50 L60,50 L58,72 L42,72 Z' },
  { id: 'obliques', label: 'Obliques', side: 'front', path: 'M35,50 L40,50 L42,68 L36,66 Z M65,50 L60,50 L58,68 L64,66 Z' },
  { id: 'quads', label: 'Quads', side: 'front', path: 'M38,72 L48,72 L46,92 L36,90 Z M52,72 L62,72 L64,90 L54,92 Z' },
  { id: 'calves', label: 'Calves', side: 'front', path: 'M38,92 L46,92 L44,108 L40,108 Z M54,92 L62,92 L60,108 L56,108 Z' },
  // BACK
  { id: 'traps', label: 'Traps', side: 'back', path: 'M40,30 L50,26 L60,30 L56,38 L44,38 Z' },
  { id: 'rear_delt', label: 'Rear Delts', side: 'back', path: 'M28,34 L35,36 L33,44 L26,42 Z M72,34 L65,36 L67,44 L74,42 Z' },
  { id: 'upper_back', label: 'Upper Back', side: 'back', path: 'M38,38 L62,38 L60,52 L40,52 Z' },
  { id: 'lats', label: 'Lats', side: 'back', path: 'M34,44 L40,48 L42,62 L34,58 Z M66,44 L60,48 L58,62 L66,58 Z' },
  { id: 'triceps', label: 'Triceps', side: 'back', path: 'M24,44 L28,42 L30,56 L24,56 Z M76,44 L72,42 L70,56 L76,56 Z' },
  { id: 'lower_back', label: 'Lower Back', side: 'back', path: 'M42,54 L58,54 L56,68 L44,68 Z' },
  { id: 'glutes', label: 'Glutes', side: 'back', path: 'M38,68 L62,68 L60,80 L40,80 Z' },
  { id: 'hamstrings', label: 'Hamstrings', side: 'back', path: 'M38,80 L48,80 L46,96 L36,94 Z M52,80 L62,80 L64,94 L54,96 Z' },
];

function getIntensityColor(intensity: number): string {
  if (intensity === 0) return 'hsl(220 15% 12%)';
  // Scale from dim cyan to bright cyan
  const alpha = Math.min(intensity, 1);
  const lightness = 25 + alpha * 35;
  const saturation = 40 + alpha * 45;
  return `hsl(175 ${saturation}% ${lightness}%)`;
}

export default function MuscleHeatmap() {
  const { workoutSessions } = useAppStore();

  const volumeByMuscle = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const volumes: Record<string, number> = {};
    let maxVol = 0;

    workoutSessions
      .filter(s => new Date(s.date) >= weekAgo)
      .forEach(session => {
        session.exercises.forEach(ex => {
          const vol = ex.sets.reduce((a, set) => a + set.reps * set.weight, 0);
          const muscles = getMusclesForExercise(ex.name);
          muscles.forEach(m => {
            volumes[m] = (volumes[m] || 0) + vol;
            if (volumes[m] > maxVol) maxVol = volumes[m];
          });
        });
      });

    // Normalize to 0-1
    const normalized: Record<string, number> = {};
    Object.entries(volumes).forEach(([m, v]) => {
      normalized[m] = maxVol > 0 ? v / maxVol : 0;
    });
    return normalized;
  }, [workoutSessions]);

  const bodyOutlineFront = 'M50,8 Q42,8 40,14 L38,22 Q36,28 30,32 Q24,36 24,44 L22,60 Q22,64 26,64 L30,60 Q32,72 36,72 L38,72 L36,90 Q34,96 36,100 L38,108 Q39,112 42,112 L46,112 Q48,110 48,108 L50,94 L52,108 Q52,110 54,112 L58,112 Q61,112 62,108 L64,100 Q66,96 64,90 L62,72 L64,72 Q68,72 70,60 L74,64 Q78,64 78,60 L76,44 Q76,36 70,32 Q64,28 62,22 L60,14 Q58,8 50,8 Z';
  const bodyOutlineBack = bodyOutlineFront; // Symmetric silhouette

  const renderBody = (side: 'front' | 'back') => {
    const regions = muscleRegions.filter(r => r.side === side);
    return (
      <div className="flex flex-col items-center">
        <p className="text-xs text-muted-foreground font-heading font-semibold uppercase tracking-wider mb-2">
          {side === 'front' ? 'Front' : 'Back'}
        </p>
        <svg viewBox="16 4 68 114" className="w-28 h-auto">
          {/* Body outline */}
          <path d={side === 'front' ? bodyOutlineFront : bodyOutlineBack}
            fill="hsl(220 15% 8%)" stroke="hsl(220 15% 20%)" strokeWidth="0.5" />
          {/* Muscle regions */}
          {regions.map(r => {
            const intensity = volumeByMuscle[r.id] || 0;
            return (
              <g key={r.id}>
                <path
                  d={r.path}
                  fill={getIntensityColor(intensity)}
                  stroke={intensity > 0 ? 'hsl(175 85% 50% / 0.3)' : 'transparent'}
                  strokeWidth="0.3"
                  opacity={intensity > 0 ? 0.9 : 0.4}
                >
                  <title>{r.label}: {intensity > 0 ? `${Math.round(intensity * 100)}%` : 'Not trained'}</title>
                </path>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const trainedCount = Object.keys(volumeByMuscle).length;

  return (
    <div className="glass-strong rounded-2xl p-6 border-glow">
      <h2 className="font-heading font-bold text-lg mb-1">Muscle Heatmap</h2>
      <p className="text-xs text-muted-foreground mb-4">
        {trainedCount > 0 ? `${trainedCount} muscle groups trained this week` : 'No workouts logged this week'}
      </p>
      <div className="flex justify-center gap-8">
        {renderBody('front')}
        {renderBody('back')}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-xs text-muted-foreground">Low</span>
        <div className="flex gap-0.5">
          {[0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
            <div key={v} className="w-5 h-3 rounded-sm" style={{ backgroundColor: getIntensityColor(v) }} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">High</span>
      </div>
    </div>
  );
}
