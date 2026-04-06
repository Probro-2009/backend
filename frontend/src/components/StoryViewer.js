import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';

export default function StoryViewer({ storyGroup, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const stories = storyGroup?.stories || [];
  const current = stories[currentIdx];

  useEffect(() => {
    if (!current) return;
    api.post(`/stories/${current.id}/view`).catch(() => {});
    const timer = setTimeout(() => {
      if (currentIdx < stories.length - 1) setCurrentIdx(prev => prev + 1);
      else onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentIdx, current, stories.length, onClose]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" data-testid="story-viewer">
      <div className="relative w-full max-w-sm h-[80vh] rounded-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <div className={`h-full bg-white rounded-full ${i < currentIdx ? 'w-full' : i === currentIdx ? 'w-full animate-[story-progress_5s_linear]' : 'w-0'}`}
                style={i === currentIdx ? { animation: 'story-progress 5s linear forwards' } : {}} />
            </div>
          ))}
        </div>
        <div className="absolute top-6 left-4 right-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20">
              {storyGroup.avatar_url ? <img src={storyGroup.avatar_url} alt="" className="w-full h-full object-cover" /> :
                <div className="w-full h-full flex items-center justify-center text-xs text-white">{storyGroup.username?.[0]?.toUpperCase()}</div>}
            </div>
            <span className="text-white text-sm font-medium">{storyGroup.username}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white" data-testid="story-close-btn">
            <X size={24} />
          </button>
        </div>
        <img src={current.image} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex">
          <div className="w-1/2 cursor-pointer" onClick={() => currentIdx > 0 && setCurrentIdx(prev => prev - 1)} />
          <div className="w-1/2 cursor-pointer" onClick={() => currentIdx < stories.length - 1 ? setCurrentIdx(prev => prev + 1) : onClose()} />
        </div>
      </div>
      <style>{`@keyframes story-progress { from { width: 0; } to { width: 100%; } }`}</style>
    </div>
  );
}
