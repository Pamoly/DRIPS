import React from 'react';
import { FileCode2, FileJson, FileText, Trash2 } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn } from '../lib/format';
import { GradeBadge } from './ui';

export function Explorer() {
  const { files, activePath, openFile, deleteFile, overview, learning } = useWorkspace();

  const iconFor = (path: string) => {
    if (path.endsWith('.json')) return <FileJson size={15} className="text-amber-300" />;
    if (path.endsWith('.md')) return <FileText size={15} className="text-slate-400" />;
    return <FileCode2 size={15} className="text-accent-300" />;
  };

  return (
    <aside className="flex h-full w-full flex-col bg-ink-900/70">
      <div className="flex items-center justify-between border-b border-ink-700/70 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">workspace</span>
        <span className="font-mono text-[11px] text-slate-500">{files.length} files</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {files.map((file) => {
          const active = file.path === activePath;
          return (
            <div
              key={file.path}
              className={cn(
                'group mb-1 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors',
                active ? 'bg-accent-500/12 ring-1 ring-inset ring-accent-500/40' : 'hover:bg-ink-800/70',
              )}
              onClick={() => openFile(file.path)}
            >
              {iconFor(file.path)}
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-[13px]', active ? 'font-medium text-white' : 'text-slate-300')}>
                  {file.path}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="uppercase tracking-wide">{file.language}</span>
                  {file.finding_count ? <span>{file.finding_count} findings</span> : <span>clean</span>}
                </div>
              </div>
              <GradeBadge grade={file.grade} size="sm" />
              <button
                className="opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete file"
                onClick={(event) => {
                  event.stopPropagation();
                  if (confirm(`Delete ${file.path}? This cannot be undone.`)) deleteFile(file.path);
                }}
              >
                <Trash2 size={14} className="text-slate-500 hover:text-rose-300" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-ink-700/70 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">project health</span>
          {overview?.average_health != null && (
            <span className="font-mono text-xs text-slate-300">{overview.average_health.toFixed(0)}/100</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <Stat label="critical" value={overview?.severities?.critical ?? 0} tone="text-rose-300" />
          <Stat label="major" value={overview?.severities?.major ?? 0} tone="text-amber-300" />
          <Stat label="patches" value={overview?.pending_patches ?? 0} tone="text-accent-200" />
          <Stat label="reviews" value={overview?.open_reviews ?? 0} tone="text-violet-300" />
        </div>

        {learning && (
          <div className="mt-3 rounded-lg bg-ink-800/70 p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-200">
                L{learning.level.n} · {learning.level.title}
              </span>
              <span className="font-mono text-slate-400">{learning.learner.xp} XP</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-400 to-moss-400 transition-all duration-700"
                style={{ width: `${learning.level.progress_to_next}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              {learning.level.next ? `Next: ${learning.level.next.title}` : 'Top level reached'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-ink-800/60 px-2 py-1.5">
      <div className={cn('font-mono text-sm font-semibold', tone)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
