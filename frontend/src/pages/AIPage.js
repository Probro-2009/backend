import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Send, Sparkles, Trash2 } from 'lucide-react';

export default function AIPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const sid = sessionId || `${user.id}_default`;
      const { data } = await api.get(`/ai/history?session_id=${sid}`);
      setMessages(data);
    } catch {}
  }, [user?.id, sessionId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, created_at: new Date().toISOString() }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { message: userMsg, session_id: sessionId });
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, created_at: new Date().toISOString() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', created_at: new Date().toISOString() }]);
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(`${user.id}_${Date.now()}`);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className="flex flex-col h-screen" data-testid="ai-page">
      <div className="glass-header bg-background/70 border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-[#0055FF] to-[#002FA7] flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-medium text-foreground">T.P AI</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Powered by GPT-4o</p>
          </div>
        </div>
        <button onClick={clearChat} data-testid="clear-chat-btn"
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm transition-all">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6" data-testid="ai-messages-area">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#0055FF]/20 to-[#002FA7]/20 flex items-center justify-center mb-6">
              <Sparkles size={28} className="text-[#0055FF]" />
            </div>
            <h3 className="font-heading text-2xl font-light text-foreground">How can I help?</h3>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              I'm T.P AI, your privacy-conscious assistant. Ask me anything about privacy, encryption, or just have a conversation.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-8 w-full">
              {['What is E2E encryption?', 'Privacy tips for social media', 'How does T.P protect me?', 'Write a creative post'].map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="p-3 text-left text-xs text-muted-foreground bg-surface border border-border rounded-md hover:bg-surface-elevated hover:text-foreground transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 animate-fade-in ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`ai-message-${i}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-[#0055FF] to-[#002FA7] flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles size={14} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] ${
                  m.role === 'user'
                    ? 'bg-[#1E1E1E] text-white px-4 py-3 rounded-lg rounded-br-sm'
                    : 'bg-transparent border-l-2 border-[#0055FF] pl-4 py-2 text-foreground'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-[#0055FF] to-[#002FA7] flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="flex gap-1 py-3">
                  <div className="w-2 h-2 rounded-full bg-[#0055FF] typing-dot" />
                  <div className="w-2 h-2 rounded-full bg-[#0055FF] typing-dot" />
                  <div className="w-2 h-2 rounded-full bg-[#0055FF] typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-3">
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            rows={1} placeholder="Message T.P AI..." data-testid="ai-input"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed" />
          <button onClick={sendMessage} disabled={!input.trim() || loading} data-testid="ai-send-btn"
            className="p-2 bg-[#0055FF] hover:bg-[#0044CC] text-white rounded-sm transition-all disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/40 mt-2">T.P AI can make mistakes. Consider verifying important info.</p>
      </div>
    </div>
  );
}
