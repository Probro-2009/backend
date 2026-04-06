import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import StoriesRow from '@/components/StoriesRow';
import CreatePost from '@/components/CreatePost';
import PostCard from '@/components/PostCard';
import RightSidebar from '@/components/RightSidebar';

export default function HomePage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    try {
      const [postsRes, storiesRes] = await Promise.all([
        api.get('/posts/feed'),
        api.get('/stories')
      ]);
      setPosts(postsRes.data);
      setStories(storiesRes.data);
    } catch (err) { console.error('Feed error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleNewPost = (post) => setPosts(prev => [post, ...prev]);

  const handleLike = async (postId) => {
    try {
      const { data } = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const likes = data.liked
          ? [...(p.likes || []), user.id]
          : (p.likes || []).filter(id => id !== user.id);
        return { ...p, likes };
      }));
    } catch {}
  };

  const handleComment = async (postId, content) => {
    try {
      const { data } = await api.post(`/posts/${postId}/comment`, { content });
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments: [...(p.comments || []), data] } : p
      ));
    } catch {}
  };

  return (
    <div className="grid grid-cols-9" data-testid="home-page">
      <div className="col-span-9 lg:col-span-6 border-r border-border min-h-screen">
        <div className="glass-header bg-background/70 border-b border-border sticky top-0 z-50 px-6 py-4">
          <h2 className="font-heading text-lg font-medium text-foreground" data-testid="feed-title">Feed</h2>
        </div>
        <StoriesRow stories={stories} />
        <CreatePost onPost={handleNewPost} />
        {loading ? (
          <div className="p-6 space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-32 skeleton-shimmer rounded-md" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground" data-testid="empty-feed">
            <p className="text-lg font-heading">No posts yet</p>
            <p className="text-sm mt-1">Follow people or create a post to get started</p>
          </div>
        ) : (
          <div data-testid="posts-feed">
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} userId={user?.id}
                onLike={handleLike} onComment={handleComment}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-fade-in" />
            ))}
          </div>
        )}
      </div>
      <div className="col-span-3 hidden lg:block">
        <RightSidebar />
      </div>
    </div>
  );
}
