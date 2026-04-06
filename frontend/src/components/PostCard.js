import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PostCard({ post, userId, onLike, onComment, style, className }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const navigate = useNavigate();
  const isLiked = (post.likes || []).includes(userId);
  const timeAgo = post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : '';

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onComment(post.id, commentText);
    setCommentText('');
  };

  return (
    <article className={`border-b border-border p-6 hover:bg-muted/30 transition-colors ${className || ''}`}
      style={style} data-testid={`post-card-${post.id}`}>
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0 cursor-pointer"
          onClick={() => navigate(`/profile/${post.username}`)}>
          {post.avatar_url ? <img src={post.avatar_url} alt="" className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-sm font-medium text-foreground">
              {post.username?.[0]?.toUpperCase()}
            </div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground cursor-pointer hover:underline"
              onClick={() => navigate(`/profile/${post.username}`)} data-testid={`post-author-${post.id}`}>
              {post.display_name}
            </span>
            <span className="text-xs text-muted-foreground">@{post.username}</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <p className="mt-2 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
          {post.image && (
            <div className="mt-3 rounded-md overflow-hidden border border-border">
              <img src={post.image} alt="" className="w-full max-h-[70vh] object-cover" data-testid={`post-image-${post.id}`} />
            </div>
          )}
          <div className="flex items-center gap-6 mt-4">
            <button onClick={() => onLike(post.id)} data-testid={`like-btn-${post.id}`}
              className={`flex items-center gap-1.5 text-xs transition-colors ${isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-400'}`}>
              <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
              <span>{(post.likes || []).length}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)} data-testid={`comment-toggle-${post.id}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#0055FF] transition-colors">
              <MessageCircle size={16} />
              <span>{(post.comments || []).length}</span>
              {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Share2 size={16} />
            </button>
          </div>
          {showComments && (
            <div className="mt-4 space-y-3 animate-fade-in">
              {(post.comments || []).map(c => (
                <div key={c.id} className="flex gap-2 pl-2 border-l-2 border-border">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0">
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-medium">{c.username?.[0]?.toUpperCase()}</div>}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-foreground">{c.display_name}</span>
                    <p className="text-xs text-foreground/80 mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
              <form onSubmit={handleSubmitComment} className="flex gap-2 mt-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..." data-testid={`comment-input-${post.id}`}
                  className="flex-1 bg-surface border border-border rounded-sm px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#0055FF]" />
                <button type="submit" data-testid={`comment-submit-${post.id}`}
                  className="px-3 py-2 bg-[#0055FF] text-white text-xs rounded-sm hover:bg-[#0044CC] transition-colors">
                  Post
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
