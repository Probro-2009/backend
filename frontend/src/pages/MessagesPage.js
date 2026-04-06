import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { Lock, Send, Search, ArrowLeft, Plus, Shield } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/messages/conversations');
      setConversations(data);
    } catch {}
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = async (convo) => {
    setActiveConvo(convo);
    setLoading(true);
    try {
      const { data } = await api.get(`/messages/${convo.id}`);
      const decrypted = await Promise.all(data.map(async m => {
        if (m.is_encrypted && m.content) {
          const otherUser = convo.other_user;
          const text = await decryptMessage(m.content, user.id, otherUser?.id);
          return { ...m, content: text };
        }
        return m;
      }));
      setMessages(decrypted);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!activeConvo) return;
    pollRef.current = setInterval(() => openConversation(activeConvo), 5000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvo?.id]);

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeConvo?.other_user) return;
    const encrypted = await encryptMessage(msgInput.trim(), user.id, activeConvo.other_user.id);
    try {
      await api.post('/messages/send', { recipient_id: activeConvo.other_user.id, content: encrypted });
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender_id: user.id, sender_username: user.username,
        content: msgInput.trim(), is_encrypted: true,
        created_at: new Date().toISOString()
      }]);
      setMsgInput('');
      fetchConversations();
    } catch {}
  };

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/users/search?q=${q}`);
      setSearchResults(data);
    } catch {}
  };

  const startConversation = async (recipient) => {
    try {
      const { data } = await api.post('/messages/conversation', { recipient_id: recipient.id });
      setActiveConvo(data);
      setShowSearch(false);
      setSearch('');
      setSearchResults([]);
      fetchConversations();
      openConversation(data);
    } catch {}
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className="grid grid-cols-9 min-h-screen" data-testid="messages-page">
      <div className="col-span-9 lg:col-span-3 border-r border-border">
        <div className="glass-header bg-background/70 border-b border-border sticky top-0 z-40 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-[#0055FF]" />
            <h2 className="font-heading text-lg font-medium text-foreground">Messages</h2>
          </div>
          <button onClick={() => setShowSearch(!showSearch)} data-testid="new-message-btn"
            className="p-2 text-muted-foreground hover:text-[#0055FF] hover:bg-[#0055FF]/10 rounded-sm transition-all">
            <Plus size={18} />
          </button>
        </div>

        {showSearch && (
          <div className="p-3 border-b border-border animate-fade-in">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => handleSearch(e.target.value)} data-testid="user-search-input"
                placeholder="Search users..." autoFocus
                className="w-full bg-surface border border-border rounded-sm pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#0055FF]" />
            </div>
            {searchResults.map(u => (
              <div key={u.id} onClick={() => startConversation(u)} data-testid={`search-result-${u.username}`}
                className="flex items-center gap-3 p-3 hover:bg-surface rounded-sm cursor-pointer mt-1">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-elevated">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> :
                    <div className="w-full h-full flex items-center justify-center text-xs">{u.username?.[0]?.toUpperCase()}</div>}
                </div>
                <div><p className="text-sm font-medium text-foreground">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p></div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-y-auto" data-testid="conversations-list">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Shield size={32} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start an encrypted chat</p>
            </div>
          ) : conversations.map(c => (
            <div key={c.id} onClick={() => openConversation(c)} data-testid={`conversation-${c.id}`}
              className={`flex items-center gap-3 p-4 border-b border-border cursor-pointer transition-colors
                ${activeConvo?.id === c.id ? 'bg-[#0055FF]/5 border-l-2 border-l-[#0055FF]' : 'hover:bg-muted/30'}`}>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0">
                {c.other_user?.avatar_url ? <img src={c.other_user.avatar_url} alt="" className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-sm">{c.other_user?.username?.[0]?.toUpperCase()}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.other_user?.display_name}</p>
                <div className="flex items-center gap-1">
                  <Lock size={10} className="text-[#0055FF] flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{c.last_message || 'Start chatting'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-9 lg:col-span-6 flex flex-col h-screen">
        {activeConvo ? (
          <>
            <div className="glass-header bg-background/70 border-b border-border px-6 py-4 flex items-center gap-3 sticky top-0 z-40">
              <button className="lg:hidden mr-2 text-muted-foreground" onClick={() => setActiveConvo(null)}>
                <ArrowLeft size={20} />
              </button>
              <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-elevated">
                {activeConvo.other_user?.avatar_url ?
                  <img src={activeConvo.other_user.avatar_url} alt="" className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-sm">{activeConvo.other_user?.username?.[0]?.toUpperCase()}</div>}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{activeConvo.other_user?.display_name}</p>
                <div className="flex items-center gap-1">
                  <Lock size={10} className="text-[#0055FF]" />
                  <p className="text-[10px] text-[#0055FF]">End-to-end encrypted</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3" data-testid="messages-area">
              {loading ? (
                <div className="flex justify-center py-12"><p className="text-muted-foreground text-sm">Loading messages...</p></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Lock size={32} className="text-[#0055FF]/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Messages are end-to-end encrypted</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Only you and the recipient can read them</p>
                </div>
              ) : messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${m.id}`}>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-lg text-sm ${
                    m.sender_id === user.id
                      ? 'bg-[#0055FF] text-white rounded-br-sm'
                      : 'bg-surface border border-border text-foreground rounded-bl-sm'}`}>
                    <p className="leading-relaxed">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.sender_id === user.id ? 'text-white/50' : 'text-muted-foreground'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 bg-surface border border-border rounded-sm px-4 py-2">
                <Lock size={14} className="text-[#0055FF] flex-shrink-0" />
                <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Type an encrypted message..." data-testid="message-input"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                <button onClick={sendMessage} data-testid="send-message-btn"
                  className="p-2 text-[#0055FF] hover:bg-[#0055FF]/10 rounded-sm transition-colors disabled:opacity-40"
                  disabled={!msgInput.trim()}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" data-testid="no-conversation-selected">
            <div className="text-center">
              <Shield size={48} className="mx-auto mb-4 text-muted-foreground/20" />
              <h3 className="font-heading text-xl font-medium text-foreground">Encrypted Messages</h3>
              <p className="text-sm text-muted-foreground mt-2">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
