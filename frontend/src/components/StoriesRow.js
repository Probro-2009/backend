import React, { useState } from 'react';
import StoryViewer from '@/components/StoryViewer';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function StoriesRow({ stories }) {
  const { user } = useAuth();
  const [viewingStory, setViewingStory] = useState(null);

  if (!stories || stories.length === 0) return null;

  return (
    <>
      <div className="border-b border-border px-4 py-4" data-testid="stories-row">
        <div className="flex gap-4 overflow-x-auto hide-scrollbar">
          <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group" data-testid="add-story-btn">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-[#0055FF] transition-colors">
              <Plus size={20} className="text-muted-foreground group-hover:text-[#0055FF]" />
            </div>
            <span className="text-[10px] text-muted-foreground">Your Story</span>
          </div>
          {stories.map((storyGroup) => (
            <div key={storyGroup.user_id}
              className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
              onClick={() => setViewingStory(storyGroup)}
              data-testid={`story-${storyGroup.username}`}>
              <div className="story-ring p-[2px] rounded-full">
                <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-background p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-surface-elevated">
                    {storyGroup.avatar_url ?
                      <img src={storyGroup.avatar_url} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-xs font-medium text-foreground">
                        {storyGroup.username?.[0]?.toUpperCase()}
                      </div>}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground truncate max-w-[64px]">
                {storyGroup.user_id === user?.id ? 'You' : storyGroup.username}
              </span>
            </div>
          ))}
        </div>
      </div>
      {viewingStory && <StoryViewer storyGroup={viewingStory} onClose={() => setViewingStory(null)} />}
    </>
  );
}
