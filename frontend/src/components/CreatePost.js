import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api, { compressImage } from '@/lib/api';
import { ImagePlus, X, Send } from 'lucide-react';

export default function CreatePost({ onPost }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setImage(compressed);
    setPreview(compressed);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !image) return;
    setLoading(true);
    try {
      const { data } = await api.post('/posts', { content: content.trim(), image });
      onPost(data);
      setContent('');
      setImage(null);
      setPreview(null);
    } catch (err) { console.error('Post error:', err); }
    finally { setLoading(false); }
  };

  return (
    <div className="border-b border-border p-6" data-testid="create-post">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0">
          {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-sm font-medium text-foreground">
              {user?.username?.[0]?.toUpperCase()}
            </div>}
        </div>
        <div className="flex-1">
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="What's on your mind?" rows={2} data-testid="create-post-input"
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none leading-relaxed" />
          {preview && (
            <div className="relative mt-2 rounded-md overflow-hidden border border-border inline-block">
              <img src={preview} alt="" className="max-h-48 rounded-md" />
              <button onClick={() => { setImage(null); setPreview(null); }}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80">
                <X size={14} className="text-white" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <button onClick={() => fileRef.current?.click()} data-testid="create-post-image-btn"
              className="text-muted-foreground hover:text-[#0055FF] transition-colors">
              <ImagePlus size={20} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            <button onClick={handleSubmit} disabled={loading || (!content.trim() && !image)} data-testid="create-post-submit-btn"
              className="flex items-center gap-2 px-4 py-2 bg-[#0055FF] hover:bg-[#0044CC] text-white text-xs font-medium rounded-sm transition-all disabled:opacity-40">
              <Send size={14} /> {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
