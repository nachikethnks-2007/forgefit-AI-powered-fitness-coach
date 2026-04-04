import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { callGroq, buildSystemPrompt } from '@/services/groqClient';
import { toast } from 'sonner';

export default function AICoach() {
  const { profile, nutritionPlan, foodLog, chatHistory, addChatMessage, groqApiKey, setCurrentPage } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  if (!profile || !nutritionPlan) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayFood = foodLog.filter((f) => f.date === today);
  const consumed = todayFood.reduce((a, f) => ({ cal: a.cal + f.calories, p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fats }), { cal: 0, p: 0, c: 0, f: 0 });

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!groqApiKey) {
      toast.error('Please add your Groq API key in Settings');
      return;
    }

    const userMsg = { role: 'user' as const, content: input, timestamp: Date.now() };
    addChatMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const foodContext = todayFood.length
        ? `Today's food log: ${todayFood.map((f) => `${f.name} (${f.calories}kcal, ${f.protein}p/${f.carbs}c/${f.fats}f)`).join(', ')}`
        : 'No food logged today yet.';

      const systemPrompt = buildSystemPrompt(profile, nutritionPlan, foodContext);
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: input },
      ];

      const response = await callGroq(messages);
      addChatMessage({ role: 'assistant', content: response, timestamp: Date.now() });
    } catch (err: any) {
      toast.error(err.message || 'Failed to get AI response');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="glass-strong border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('dashboard')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading font-bold gradient-text">AI Nutrition Coach</h1>
          </div>
        </div>
      </div>

      {/* Context card */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-3">
        <div className="glass rounded-xl px-4 py-3 flex justify-between text-xs text-muted-foreground">
          <span>{profile.mode.toUpperCase()} · {nutritionPlan.dailyCalories} kcal</span>
          <span>Left: {nutritionPlan.dailyCalories - consumed.cal} kcal · {nutritionPlan.protein - consumed.p}g P</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full space-y-4">
        {chatHistory.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Ask me anything about your nutrition, meal ideas, or progress!</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {['Why these macros?', 'Meal ideas for today', 'Am I eating enough protein?', "I'm not losing weight"].map((q) => (
                <button key={q} onClick={() => setInput(q)}
                  className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs hover:bg-secondary/80 transition-colors">{q}</button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.filter(m => m.role !== 'system').map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user' ? 'gradient-primary text-primary-foreground' : 'glass-strong border-glow'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </motion.div>
        ))}

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="glass-strong border-glow rounded-2xl px-4 py-3 animate-pulse-glow">
              <div className="flex items-center gap-2 text-primary text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> AI is thinking...
              </div>
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="glass-strong border-t border-border px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask your AI coach..."
            className="flex-1 bg-input border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={handleSend} disabled={loading || !input.trim()}
            className="gradient-primary text-primary-foreground p-3 rounded-xl disabled:opacity-40">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
