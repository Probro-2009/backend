import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import PostCard from '@/components/PostCard';
import { UserPlus, UserMinus, MessageCircle, ArrowLeft } from 'lucide-react';

export default function ProfilePage() {
  const { username } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const isOwnProfile = user?.username === username;

  const fetchProfile = useCallback(async () => {
    try {
      const [profileRes, postsRes] = await Promise.all([
        api.get(`/users/profile/${username}`),
        api.get(`/posts/user/${username}`)
      ]);
      setProfile(profileRes.data);
      setPosts(postsRes.data);
      setIsFollowing((user?.following || []).includes(profileRes.data.id));
    } catch {}
    finally { setLoading(false); }
  }, [username, user?.following]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFollow = async () => {
    if (!profile) return;
    try {
      if (isFollowing) {
        await api.post(`/users/${profile.id}/unfollow`);
        setIsFollowing(false);
        setProfile(p => ({ ...p, follower_count: (p.follower_count || 1) - 1 }));
      } else {
        await api.post(`/users/${profile.id}/follow`);
        setIsFollowing(true);
        setProfile(p => ({ ...p, follower_count: (p.follower_count || 0) + 1 }));
      }
      refreshUser();
    } catch {}
  };

  const handleMessage = async () => {
    if (!profile) return;
    try {
      await api.post('/messages/conversation', { recipient_id: profile.id });
      navigate('/messages');
    } catch {}
  };

  const handleLike = async (postId) => {
    try {
      const { data } = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const likes = data.liked ? [...(p.likes || []), user.id] : (p.likes || []).filter(id => id !== user.id);
        return { ...p, likes };
      }));
    } catch {}
  };

  const handleComment = async (postId, content) => {
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { content });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), data] } : p));
    } catch {}
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[80vh]"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (!profile) {
    return <div className="flex items-center justify-center h-[80vh]"><p className="text-muted-foreground">User not found</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto" data-testid="profile-page">
      <div className="glass-header bg-background/70 border-b border-border sticky top-0 z-40 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground" data-testid="back-btn">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-heading text-lg font-medium text-foreground">{profile.display_name}</h2>
      </div>

      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-elevated" data-testid="profile-avatar">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> :
                <div className="w-full h-full flex items-center justify-center text-2xl font-medium text-foreground">
                  {profile.username?.[0]?.toUpperCase()}
                </div>}
            </div>
            <div>
              <h1 className="font-heading text-xl font-medium text-foreground" data-testid="profile-display-name">{profile.display_name}</h1>
              <p className="text-sm text-muted-foreground" data-testid="profile-username">@{profile.username}</p>
              {profile.bio && <p className="text-sm text-foreground/80 mt-2 max-w-sm">{profile.bio}</p>}
            </div>
          </div>
          {!isOwnProfile && (
            <div className="flex gap-2">
              <button onClick={handleMessage} data-testid="profile-message-btn"
                className="p-2.5 border border-border rounded-sm text-muted-foreground hover:text-[#0055FF] hover:border-[#0055FF]/30 transition-all">
                <MessageCircle size={18} />
              </button>
              <button onClick={handleFollow} data-testid="profile-follow-btn"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all ${
                  isFollowing ? 'bg-surface border border-border text-foreground hover:text-red-400 hover:border-red-400/30'
                    : 'bg-[#0055FF] text-white hover:bg-[#0044CC]'}`}>
                {isFollowing ? <><UserMinus size={16} /> Unfollow</> : <><UserPlus size={16} /> Follow</>}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-6 mt-6">
          <div className="text-center">
            <p className="text-lg font-medium text-foreground" data-testid="profile-posts-count">{profile.post_count || 0}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-foreground" data-testid="profile-followers-count">{profile.follower_count || 0}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-foreground" data-testid="profile-following-count">{profile.following_count || 0}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Following</p>
          </div>
        </div>
      </div>

      <div data-testid="profile-posts">
        {posts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">No posts yet</p>
          </div>
        ) : posts.map(post => (
          <PostCard key={post.id} post={post} userId={user?.id} onLike={handleLike} onComment={handleComment} />
        ))}
      </div>
    </div>
  );
}
