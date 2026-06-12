import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  BookOpen, 
  User,
  AlertCircle,
  Clock
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  sources?: string[];
}

export const KnowledgeAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am the Nurse Fatigue Intelligence Agent. I can assist you by explaining workforce schedule interventions, retrieving St. Jude fatigue policies, citing WHO workload regulations, or validating shift rules. Ask me anything, for example: 'Why was Nurse Sarah replaced?'",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: textToSend })
      });
      
      const data = await res.json();
      
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: data.answer,
        timestamp: new Date(),
        sources: data.sources
      };
      
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Error asking RAG Assistant:", err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: "I encountered a communication error with the vector indexing database. Please ensure the backend service is running and try again.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (q: string) => {
    handleSendMessage(q);
  };

  const quickQuestions = [
    "Why was Nurse Sarah replaced?",
    "What are the shift limits for nurses?",
    "Explain the fatigue score thresholds.",
    "Which bio-sensors track cardiac fatigue?"
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden px-8 py-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4 mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-slate-900">RAG Knowledge Assistant</h2>
        <p className="text-sm text-slate-500">Search hospital policies, WHO guidelines, and justify schedule replacement decisions.</p>
      </div>

      {/* Main Chat Container */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
        
        {/* Left Side: Chat Feed */}
        <div className="flex-1 rounded-xl border border-slate-200 bg-white flex flex-col shadow-sm min-h-0">
          
          {/* Chat Bubble Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg) => {
              const isAssistant = msg.sender === 'assistant';
              return (
                <div 
                  key={msg.id}
                  className={`flex items-start gap-3 max-w-[85%] ${isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                >
                  {/* Icon */}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white flex-shrink-0 ${
                    isAssistant ? 'bg-sky-500' : 'bg-teal-500'
                  }`}>
                    {isAssistant ? <Bot size={16} /> : <User size={16} />}
                  </div>

                  {/* Text bubble */}
                  <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed border shadow-sm ${
                    isAssistant 
                      ? 'bg-slate-50 border-slate-100 text-slate-800 rounded-tl-none' 
                      : 'bg-teal-500 border-teal-600 text-white rounded-tr-none'
                  }`}>
                    {/* Preserve line breaks */}
                    <p className="whitespace-pre-line font-medium">{msg.text}</p>
                    
                    {/* Sources citation */}
                    {isAssistant && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 border-t border-slate-200/80 pt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <BookOpen size={10} />
                        <span>Sources:</span>
                        {msg.sources.map(src => (
                          <span key={src} className="rounded bg-sky-100/60 text-sky-800 font-bold px-1.5 py-0.5 border border-sky-200/50">
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Typing Loader */}
            {loading && (
              <div className="flex items-start gap-3 mr-auto max-w-[80%]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white flex-shrink-0">
                  <Bot size={16} />
                </div>
                <div className="rounded-xl px-4 py-3 text-xs bg-slate-50 border border-slate-100 text-slate-500 rounded-tl-none flex items-center gap-1.5 shadow-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce delay-100"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce delay-200"></div>
                  <span>Grounded context lookup...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Input */}
          <div className="border-t border-slate-100 p-4">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus-within:border-sky-500 focus-within:bg-white transition"
            >
              <input
                type="text"
                placeholder="Ask about fatigue policies, replacement history, or guidelines..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 bg-transparent pl-2 text-xs text-slate-800 focus:outline-none disabled:text-slate-400"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-lg bg-sky-500 p-2 text-white hover:bg-sky-600 transition disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Quick Action Panel */}
        <div className="w-full md:w-72 flex-shrink-0 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-sky-500" />
              Quick Queries
            </h4>
            <div className="flex flex-col gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickQuestion(q)}
                  disabled={loading}
                  className="w-full text-left rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/10 p-2.5 text-[11px] font-semibold text-slate-700 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={14} className="text-slate-500" />
              Active Guidelines
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertCircle size={14} className="text-sky-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800 block">St. Jude Fatigue Policy</span>
                  <p className="text-[10px] text-slate-400">Shift restrictions & mandatory replacement values.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs">
                <Clock size={14} className="text-sky-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800 block">WHO Workload Norms</span>
                  <p className="text-[10px] text-slate-400">Burnout limits and clinical risk matrices.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default KnowledgeAssistant;
