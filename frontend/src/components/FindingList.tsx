import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Wand2 } from 'lucide-react';
import type { Finding, Severity } from '../types';
import { cn, severityMeta } from '../lib/format';
import { useWorkspace } from '../store/WorkspaceContext';
import { Empty } from './ui';

const FILTERS: { id: 'all' | Severity; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: 'info', label: 'Notes' },
];

export function FindingList({
  findings,
  onFix,
  emptyHint,
}: {
  findings: Finding[];
  onFix?: () => void;
  emptyHint?: string;
}) {
  const { jumpToLine, setLayout } = useWorkspace();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? findings : findings.filter((finding) => finding.severity === filter)),
    [findings, filter],
  );

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: findings.length };
    for (const finding of findings) tally[finding.severity] = (tally[finding.severity] ?? 0) + 1;
    return tally;
  }, [findings]);

  if (!findings.length) {
    return <Empty title="No findings" body={emptyHint ?? 'Nothing to report here yet.'} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-ink-700/70 px-3 py-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              filter === item.id ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {item.label}
            <span className="ml-1 font-mono text-[10px] text-slate-500">{counts[item.id] ?? 0}</span>
          </button>
        ))}
        {onFix && (
          <button className="btn-ghost ml-auto text-[11px]" onClick={onFix} title="Prepare patches for the autofixable findings">
            <Wand2 size={13} /> Fix
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {filtered.map((finding) => {
          const meta = severityMeta[finding.severity];
          const expanded = open === finding.id;
          return (
            <article
              key={finding.id}
              className={cn(
                'mb-2 rounded-lg border border-ink-700/70 bg-ink-900/50 transition-colors',
                expanded && 'ring-1 ring-inset ring-accent-500/30',
              )}
            >
              <button
                className="flex w-full items-start gap-2 p-2.5 text-left"
                onClick={() => setOpen(expanded ? null : finding.id)}
              >
                <span className={cn('mt-0.5 text-sm', meta.color)} aria-hidden>
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-slate-100">{finding.title}</span>
                    <span className="font-mono text-[10px] text-slate-500">L{finding.line}</span>
                    {finding.autofixable && (
                      <span className="chip bg-moss-500/15 text-emerald-200 ring-emerald-500/30">auto-fixable</span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                    {finding.rule} · {finding.category} · {Math.round(finding.confidence * 100)}% confidence
                  </span>
                </span>
                <ChevronDown
                  size={14}
                  className={cn('mt-1 flex-shrink-0 text-slate-500 transition-transform', expanded && 'rotate-180')}
                />
              </button>

              {expanded && (
                <div className="animate-fade-in space-y-2 border-t border-ink-700/60 px-3 py-2.5 text-[12px]">
                  <p className="text-slate-300">{finding.message}</p>
                  {finding.snippet && (
                    <pre className="overflow-x-auto rounded bg-ink-950 p-2 font-mono text-[11.5px] text-slate-300">
                      {finding.snippet}
                    </pre>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
                    <p className="text-slate-300">{finding.why_it_matters}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">How to fix it</p>
                    <p className="text-slate-300">{finding.how_to_fix}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button className="btn-outline text-[11px]" onClick={() => jumpToLine(finding.line)}>
                      Go to line {finding.line}
                    </button>
                    <button
                      className="btn-ghost text-[11px]"
                      onClick={() =>
                        setLayout({ dockTab: 'mentor', dockOpen: true })
                      }
                    >
                      Ask the mentor
                    </button>
                    {finding.references.map((reference) => (
                      <a
                        key={reference}
                        href={reference}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-accent-300 underline decoration-dotted"
                      >
                        reference <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
