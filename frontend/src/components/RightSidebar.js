import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { UserPlus, UserMinus, Lock } from 'lucide-react';

export default function RightSidebar() {
  const { user, refreshUser } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [followingSet, setFollowingSet] = useState(new Set());
  const navigate = useNavigate();

  const fetchSuggestions = useCallback(async () => {
    try {
      const { data } = await api.get('/users/suggestions');
      setSuggestions(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSuggestions();
    setFollowingSet(new Set(user?.following || []));
  }, [fetchSuggestions, user?.following]);

  const handleFollow = async (userId) => {
    try {
      if (followingSet.has(userId)) {
        await api.post(`/users/${userId}/unfollow`);
        setFollowingSet(prev => { const s = new Set(prev); s.delete(userId); return s; });
      } else {
        await api.post(`/users/${userId}/follow`);
        setFollowingSet(prev => new Set(prev).add(userId));
      }
      refreshUser();
    } catch {}
  };

  return (
    <div className="h-screen sticky top-0 p-6 overflow-y-auto" data-testid="right-sidebar">
      {user && (
        <div className="mb-6 p-4 bg-surface rounded-md border border-border cursor-pointer hover:bg-surface-elevated transition-colors"
          onClick={() => navigate(`/profile/${user.username}`)} data-testid="profile-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0">
              {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> :
                <div className="w-full h-full flex items-center justify-center text-lg font-medium text-foreground">
                  {user.username?.[0]?.toUpperCase()}
                </div>}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{user.display_name}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-border">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{user.following?.length || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Following</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{user.followers?.length || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Followers</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={12} className="text-[#0055FF]" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">E2E Encrypted</p>
        </div>
        <p className="text-[11px] text-muted-foreground/60">All DMs are end-to-end encrypted</p>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-bold mb-3">Who to follow</h3>
        <div className="space-y-2">
          {suggestions.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-md hover:bg-surface transition-colors"
              data-testid={`suggestion-${s.username}`}>
              <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0 cursor-pointer"
                onClick={() => navigate(`/profile/${s.username}`)}>
                {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-xs font-medium text-foreground">
                    {s.username?.[0]?.toUpperCase()}
                  </div>}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/profile/${s.username}`)}>
                <p className="text-sm font-medium text-foreground truncate">{s.display_name}</p>
                <p className="text-xs text-muted-foreground">@{s.username}</p>
              </div>
              <button onClick={() => handleFollow(s.id)} data-testid={`follow-btn-${s.username}`}
                className={`p-2 rounded-sm transition-all ${followingSet.has(s.id)
                  ? 'text-muted-foreground hover:text-red-400 hover:bg-red-500/10'
                  : 'text-[#0055FF] hover:bg-[#0055FF]/10'}`}>
                {followingSet.has(s.id) ? <UserMinus size={16} /> : <UserPlus size={16} />}
              </button>
            </div>
          ))}
          {suggestions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No suggestions right now</p>
          )}
        </div>
      </div>
    </div>
  );
}
