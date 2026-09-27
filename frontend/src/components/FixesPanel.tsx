import React, { useMemo, useState } from 'react';
import { Check, RotateCcw, ShieldCheck, Undo2, Wand2, X } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import type { Patch } from '../types';
import { cn, diffRows, relativeTime } from '../lib/format';
import { Confidence, Empty, Panel } from './ui';

const STATUS_TABS = [
  { id: 'proposed', label: 'Awaiting your decision' },
  { id: 'applied', label: 'Applied' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'Everything' },
] as const;

export function FixesPanel() {
  const { patches, decidePatch, applyPatch, revertPatch, proposeFixes, activePath } = useWorkspace();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]['id']>('proposed');

  const grouped = useMemo(() => {
    const list = tab === 'all' ? patches : patches.filter((patch) => patch.status === tab);
    return list.sort((a, b) => b.created_at - a.created_at);
  }, [patches, tab]);

  const pending = patches.filter((patch) => patch.status === 'proposed').length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-1 border-b border-ink-700/70 px-3 py-2">
        {STATUS_TABS.map((item) => {
          const count = item.id === 'all' ? patches.length : patches.filter((patch) => patch.status === item.id).length;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                tab === item.id ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {item.label}
              <span className="ml-1 font-mono text-[10px] text-slate-500">{count}</span>
            </button>
          );
        })}
        <button className="btn-ghost ml-auto text-[11px]" onClick={() => proposeFixes()} disabled={!activePath}>
          <Wand2 size={13} /> Propose for {activePath?.split('/').pop() ?? 'file'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {grouped.length === 0 ? (
          <Empty
            title={tab === 'proposed' ? 'Nothing waiting for approval' : 'Nothing here yet'}
            body={
              tab === 'proposed'
                ? 'Ask the mentor to fix the file — every change it prepares appears here as a diff you approve or reject.'
                : undefined
            }
          />
        ) : (
          grouped.map((patch) => (
            <PatchCard
              key={patch.id}
              patch={patch}
              onApprove={(note) => decidePatch(patch.id, true, note)}
              onReject={(note) => decidePatch(patch.id, false, note)}
              onApply={() => applyPatch(patch.id)}
              onRevert={() => revertPatch(patch.id)}
            />
          ))
        )}
        {pending > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={12} className="text-emerald-300" />
            Nothing is written to your files until you press Apply on an approved patch.
          </p>
        )}
      </div>
    </div>
  );
}

function PatchCard({
  patch,
  onApprove,
  onReject,
  onApply,
  onRevert,
}: {
  patch: Patch;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
  onApply: () => void;
  onRevert: () => void;
}) {
  const [open, setOpen] = useState(patch.status === 'proposed');
  const [note, setNote] = useState('');
  const rows = diffRows(patch.diff);

  const statusStyle: Record<Patch['status'], string> = {
    proposed: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
    approved: 'bg-accent-500/15 text-accent-100 ring-accent-500/30',
    applied: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
    reverted: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    rejected: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
    expired: 'bg-slate-500/15 text-slate-400 ring-slate-600',
  };

  return (
    <article className="mb-3 overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/50">
      <header className="flex items-start justify-between gap-3 px-3 py-2.5">
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((value) => !value)}>
          <p className="truncate text-[13px] font-medium text-slate-100">{patch.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="font-mono">{patch.file_path}</span>
            <Confidence value={patch.confidence} />
            <span className={cn('chip ring-inset', statusStyle[patch.status])}>{patch.status}</span>
            <span>risk {patch.risk}</span>
            <span>{relativeTime(patch.created_at)}</span>
            {patch.decided_by && <span>by {patch.decided_by}</span>}
          </p>
        </button>
        <button className="btn-ghost text-[11px]" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide diff' : 'Show diff'}
        </button>
      </header>

      {open && (
        <div className="animate-fade-in">
          <div className="border-y border-ink-700/60 bg-ink-950 py-2">
            {rows.length === 0 ? (
              <p className="px-3 text-[11px] text-slate-500">
                This patch adds a new file — open it in the editor after applying.
              </p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={index}
                  className={cn(
                    'diff-line',
                    row.kind === 'add' && 'diff-add',
                    row.kind === 'del' && 'diff-del',
                    row.kind === 'context' && 'diff-context',
                    row.kind === 'meta' && 'diff-meta',
                  )}
                >
                  {row.kind === 'add' ? '+ ' : row.kind === 'del' ? '- ' : '  '}
                  {row.text}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 px-3 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Why this change</p>
              <p className="text-[12px] text-slate-300">{patch.rationale}</p>
            </div>
            {patch.learning_note && (
              <div className="rounded-lg border border-accent-500/25 bg-accent-500/5 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-200">What you should learn here</p>
                <p className="text-[12px] text-slate-300">{patch.learning_note}</p>
              </div>
            )}
            {patch.decision_note && (
              <p className="text-[11px] text-slate-400">
                <span className="text-slate-500">Decision note:</span> {patch.decision_note}
              </p>
            )}

            {patch.status === 'proposed' && (
              <>
                <input
                  className="input text-[12px]"
                  placeholder="Optional note for the audit trail — why you approved or rejected this"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary text-xs" onClick={() => onApprove(note)}>
                    <Check size={14} /> Approve
                  </button>
                  <button className="btn-outline text-xs" onClick={() => onReject(note)}>
                    <X size={14} /> Reject
                  </button>
                </div>
              </>
            )}

            {patch.status === 'approved' && (
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-primary text-xs" onClick={onApply}>
                  <Check size={14} /> Apply to the file
                </button>
                <button className="btn-ghost text-xs" onClick={() => onReject(note)}>
                  Change my mind
                </button>
              </div>
            )}

            {patch.status === 'applied' && (
              <button className="btn-outline text-xs" onClick={onRevert}>
                <RotateCcw size={14} /> Revert this change
              </button>
            )}

            {patch.status === 'rejected' && (
              <p className="flex items-center gap-1.5 text-[11px] text-rose-200">
                <Undo2 size={12} /> You rejected this — the mentor will not re-propose the same change while the file is unchanged.
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
