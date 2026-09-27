import React, { useState } from 'react';
import { CheckCircle2, Circle, GitPullRequest, MessageSquare, ShieldAlert, XCircle } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import type { Review } from '../types';
import { cn, relativeTime, severityMeta } from '../lib/format';
import { Empty, Panel } from './ui';

export function ReviewPanel() {
  const { reviews, decideReview, commentReview, createReview, activePath } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(reviews[0]?.id ?? null);

  const current = reviews.find((review) => review.id === selected) ?? reviews[0] ?? null;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,auto)_minmax(0,1fr)]">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-ink-700/70 px-3 py-2">
        <button className="btn-primary text-[11px]" onClick={() => createReview()} disabled={!activePath}>
          <GitPullRequest size={13} /> Review {activePath?.split('/').pop() ?? 'the file'}
        </button>
        <span className="text-[11px] text-slate-500">
          {reviews.length} review request(s) · the agent prepares, you decide
        </span>
      </div>

      <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-auto border-r border-ink-700/70 p-2">
          {reviews.length === 0 && <p className="p-2 text-[11px] text-slate-500">No reviews yet.</p>}
          {reviews.map((review) => (
            <button
              key={review.id}
              onClick={() => setSelected(review.id)}
              className={cn(
                'mb-1 w-full rounded-lg px-2 py-2 text-left transition-colors',
                current?.id === review.id ? 'bg-accent-500/12 ring-1 ring-inset ring-accent-500/35' : 'hover:bg-ink-800/70',
              )}
            >
              <p className="truncate text-[12px] text-slate-100">{review.file_path}</p>
              <p className="truncate text-[10.5px] text-slate-500">{review.title}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <StatusChip status={review.status} />
                <span className="text-[10px] text-slate-500">{relativeTime(review.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-auto p-3">
          {!current ? (
            <Empty
              title="No review selected"
              body="Create a review request for the active file. The reviewer agent writes the checklist, the blocking issues and the ready-to-post comments — the judgement stays with you."
            />
          ) : (
            <ReviewDetail
              review={current}
              onDecision={(decision, note) => decideReview(current.id, decision, note)}
              onComment={(body, line, kind) => commentReview(current.id, body, line, kind)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: Review['status'] }) {
  const map: Record<Review['status'], string> = {
    pending: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
    'in-review': 'bg-accent-500/15 text-accent-100 ring-accent-500/30',
    approved: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
    'changes-requested': 'bg-orange-500/15 text-orange-200 ring-orange-500/30',
    rejected: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
  };
  return <span className={cn('chip ring-inset', map[status])}>{status.replace('-', ' ')}</span>;
}

function ReviewDetail({
  review,
  onDecision,
  onComment,
}: {
  review: Review;
  onDecision: (decision: string, note: string) => void;
  onComment: (body: string, line: number, kind: string) => void;
}) {
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [line, setLine] = useState(1);

  return (
    <div className="space-y-3">
      <Panel
        title={review.title}
        subtitle={`${review.file_path} · by ${review.author} · reviewer ${review.reviewer}`}
        actions={<StatusChip status={review.status} />}
      >
        <p className="text-[12.5px] text-slate-300">{review.summary}</p>

        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
          {review.checklist.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-[12px]">
              {item.done ? (
                <CheckCircle2 size={14} className="text-emerald-300" />
              ) : (
                <Circle size={14} className="text-slate-500" />
              )}
              <span className={item.done ? 'text-slate-300' : 'text-slate-400'}>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="input flex-1 text-[12px]"
            placeholder="Decision note — the part of the review your teammates will read later"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button className="btn-primary text-xs" onClick={() => onDecision('approve', note)}>
            <CheckCircle2 size={14} /> Approve
          </button>
          <button className="btn-outline text-xs" onClick={() => onDecision('changes-requested', note)}>
            <ShieldAlert size={14} /> Request changes
          </button>
          <button className="btn-danger text-xs" onClick={() => onDecision('reject', note)}>
            <XCircle size={14} /> Reject
          </button>
        </div>
      </Panel>

      <Panel title={`Comments (${review.comments.length})`} subtitle="Reviewer-agent drafts; edit or delete before you post">
        <div className="space-y-2">
          {review.comments.map((item) => (
            <div key={item.id} className="rounded-lg border border-ink-700/70 bg-ink-900/50 p-2.5">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <MessageSquare size={12} />
                  {item.author}
                  <span className="font-mono text-slate-500">line {item.line}</span>
                </span>
                <span
                  className={cn(
                    'chip ring-inset',
                    item.kind === 'blocker'
                      ? 'bg-rose-500/15 text-rose-200 ring-rose-500/30'
                      : 'bg-ink-700/60 text-slate-300 ring-ink-600',
                  )}
                >
                  {item.kind}
                </span>
              </div>
              <p className="text-[12px] text-slate-300">{item.body}</p>
              {item.resolved && <p className="mt-1 text-[10.5px] text-emerald-300">resolved by an applied patch</p>}
            </div>
          ))}
          {review.comments.length === 0 && <p className="text-[12px] text-slate-500">No comments yet.</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="input flex-1 text-[12px]"
            placeholder="Your own review comment…"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <input
            className="input w-20 text-[12px]"
            type="number"
            min={1}
            value={line}
            onChange={(event) => setLine(Number(event.target.value))}
          />
          <button
            className="btn-outline text-xs"
            onClick={() => {
              if (!comment.trim()) return;
              onComment(comment.trim(), line, 'comment');
              setComment('');
            }}
          >
            Add comment
          </button>
        </div>
      </Panel>
    </div>
  );
}
