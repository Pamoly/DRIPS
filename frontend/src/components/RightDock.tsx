import React from 'react';
import { Activity, BookOpen, MessageSquare, GitPullRequest, Wrench } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn } from '../lib/format';
import { ChatPanel } from './ChatPanel';
import { FixesPanel } from './FixesPanel';
import { ReviewPanel } from './ReviewPanel';
import { CoachPanel } from './CoachPanel';
import { HistoryPanel } from './HistoryPanel';

const TABS = [
  { id: 'mentor', label: 'Mentor', icon: MessageSquare },
  { id: 'fixes', label: 'Fixes', icon: Wrench },
  { id: 'review', label: 'Review', icon: GitPullRequest },
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'history', label: 'History', icon: Activity },
] as const;

export function RightDock() {
  const { layout, setLayout, patches, reviews } = useWorkspace();
  const pendingFixes = patches.filter((patch) => patch.status === 'proposed').length;
  const openReviews = reviews.filter((review) => review.status === 'pending' || review.status === 'in-review').length;

  const badge = (id: (typeof TABS)[number]['id']) =>
    id === 'fixes' ? pendingFixes : id === 'review' ? openReviews : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900/60">
      <nav className="flex flex-shrink-0 items-center gap-1 border-b border-ink-700/70 px-2 py-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = layout.dockTab === tab.id;
          const count = badge(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setLayout({ dockTab: tab.id })}
              className={cn('tab', active ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-slate-200')}
            >
              <Icon size={13} />
              {tab.label}
              {count > 0 && (
                <span className="rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-ink-950">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1">
        {layout.dockTab === 'mentor' && <ChatPanel />}
        {layout.dockTab === 'fixes' && <FixesPanel />}
        {layout.dockTab === 'review' && <ReviewPanel />}
        {layout.dockTab === 'learn' && <CoachPanel />}
        {layout.dockTab === 'history' && <HistoryPanel />}
      </div>
    </div>
  );
}
