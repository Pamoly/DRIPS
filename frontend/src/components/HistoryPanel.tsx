import React from 'react';
import { Activity, Play, ShieldCheck, User } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn, relativeTime } from '../lib/format';
import { Empty, Panel } from './ui';

const ACTION_TONE: Record<string, string> = {
  'patch.applied': 'text-emerald-300',
  'patch.approved': 'text-emerald-300',
  'patch.rejected': 'text-rose-300',
  'patch.proposed': 'text-accent-200',
  'review.approved': 'text-emerald-300',
  'review.changes-requested': 'text-orange-300',
  'review.rejected': 'text-rose-300',
  'file.write': 'text-sky-300',
  'runtime.run': 'text-violet-300',
};

export function HistoryPanel() {
  const { audit, runs } = useWorkspace();

  return (
    <div className="min-h-0 space-y-3 overflow-auto p-3">
      <Panel
        title="Audit trail"
        subtitle="Every decision, who made it and when — the record a reviewer would ask for"
        actions={<ShieldCheck size={14} className="text-emerald-300" />}
      >
        {audit.length === 0 ? (
          <Empty title="Nothing recorded yet" />
        ) : (
          <ol className="space-y-1.5">
            {audit.map((event) => (
              <li key={event.id} className="flex items-start gap-2 rounded-lg bg-ink-900/50 px-2.5 py-2">
                <Activity size={13} className={cn('mt-0.5', ACTION_TONE[event.action] ?? 'text-slate-400')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-200">
                    <span className="font-mono text-[11px] text-slate-400">{event.action}</span>
                    <span className="text-slate-500"> · {event.target}</span>
                  </p>
                  {event.detail && <p className="truncate text-[11px] text-slate-500">{event.detail}</p>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 text-[10px] text-slate-500">
                  <User size={10} />
                  {event.actor} · {relativeTime(event.created_at)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="Recent runs" subtitle="Sandboxed execution: rlimits, timeout, isolated interpreter">
        {runs.length === 0 ? (
          <Empty title="No runs yet" body="Press Run to execute the active file. If it crashes, the debugger reads the output for you." />
        ) : (
          <ul className="space-y-1.5">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg bg-ink-900/50 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <Play size={12} className={run.exit_code === 0 ? 'text-emerald-300' : 'text-rose-300'} />
                    {run.file_path}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    exit {run.exit_code} · {run.duration_ms.toFixed(0)} ms
                  </span>
                </div>
                {run.traceback_summary && (
                  <p className="mt-1 truncate font-mono text-[11px] text-rose-200">{run.traceback_summary}</p>
                )}
                <p className="text-[10px] text-slate-500">{relativeTime(run.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
