import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/store/useAppStore';
import { callGroqWithTools, chatMessagesToApiPayload } from '@/services/groqClient';
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
  const consumed = todayFood.reduce((a, f) => ({
    cal: a.cal + f.calories,
    p: a.p + f.protein,
    c: a.c + f.carbs,
    f: a.f + f.fats
  }), { cal: 0, p: 0, c: 0, f: 0 });

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
        ? `Today's food log: ${todayFood
            .map((f) => `${f.name} (${f.calories}kcal)`)
            .join(', ')}`
        : 'No food logged today yet.';

      // 🔥 FIX: Trim chat history (ONLY LAST 5 MESSAGES)
      const fullHistory = useAppStore.getState().chatHistory;
      const trimmedHistory = fullHistory.slice(-5);

      const conversation = chatMessagesToApiPayload(trimmedHistory);

      const { content, toolSummaries } = await callGroqWithTools(conversation, {
        extraSystemSuffix: foodContext,
      });

      if (toolSummaries.length) {
        addChatMessage({
          role: 'plan_update',
          content: `⚡ AI Updated Your Plan — ${toolSummaries.join(' · ')}`,
          timestamp: Date.now(),
        });
      }

      addChatMessage({
        role: 'assistant',
        content: content || (toolSummaries.length
          ? 'Changes applied. Let me know if you want to tweak anything.'
          : ''),
        timestamp: Date.now(),
      });

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
        {chatHistory.filter(m => m.role !== 'system').map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'gradient-primary text-primary-foreground'
                : 'glass-strong border-glow'
            }`}>
              {msg.role === 'user'
                ? <p>{msg.content}</p>
                : <ReactMarkdown>{msg.content}</ReactMarkdown>}
            </div>

          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="glass-strong border-glow px-4 py-3">
              <Loader2 className="animate-spin" /> AI is thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="glass-strong border-t border-border px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl"
          />
          <button onClick={handleSend} disabled={loading}>
            <Send />
          </button>
        </div>
      </div>
    </div>
  );
}