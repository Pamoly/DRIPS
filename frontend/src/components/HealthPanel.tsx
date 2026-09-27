import React from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { Meter, Panel, ScoreRing, SeverityChip } from './ui';
import { cn, relativeTime } from '../lib/format';
import { FindingList } from './FindingList';

export function HealthPanel() {
  const { analysis, analyzeActive, overview, findings, openFile, proposeFixes } = useWorkspace();

  if (!analysis) {
    return (
      <Panel title="Code health" bodyClassName="p-0">
        <div className="p-6 text-center text-sm text-slate-400">
          Open a file and press Analyze — the engine reports metrics, a 0-100 health score and every
          problem with its reason.
        </div>
      </Panel>
    );
  }

  const metrics = analysis.metrics;
  const documentation = Math.round(metrics.docstring_coverage);

  return (
    <div className="grid min-h-0 grid-cols-1 gap-3 overflow-auto p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Panel
          title={`Health · ${analysis.path}`}
          subtitle={analysis.summary}
          actions={
            <button className="btn-ghost text-xs" onClick={() => analyzeActive()}>
              <RefreshCw size={13} /> Re-analyse
            </button>
          }
        >
          <div className="flex items-center gap-5">
            <ScoreRing score={analysis.health_score} />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                <SeverityChip severity="critical" count={analysis.findings.filter((f) => f.severity === 'critical').length} />
                <SeverityChip severity="major" count={analysis.findings.filter((f) => f.severity === 'major').length} />
                <SeverityChip severity="minor" count={analysis.findings.filter((f) => f.severity === 'minor').length} />
                <SeverityChip severity="info" count={analysis.findings.filter((f) => f.severity === 'info').length} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <span>analyser took {analysis.duration_ms.toFixed(0)} ms</span>
                <span>analysed {relativeTime(analysis.analyzed_at)}</span>
                <span>{metrics.imports} imports</span>
                <span>{metrics.todo_count} TODO markers</span>
              </div>
              <button className="btn-outline text-xs" onClick={() => proposeFixes()}>
                Prepare the fixes for approval
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Metrics" subtitle="What the numbers mean for a reader">
          <div className="grid grid-cols-2 gap-4">
            <Meter
              label="max complexity"
              value={metrics.max_complexity}
              max={25}
              hint="Independent paths through the most complex function. Above 10 a reviewer cannot hold it in mind."
            />
            <Meter label="avg complexity" value={metrics.avg_complexity} max={15} hint="Average across functions; aim under 6." />
            <Meter
              label="longest function"
              value={metrics.max_function_length}
              max={120}
              hint="Lines in the longest function. Above 40 it usually mixes responsibilities."
            />
            <Meter label="max nesting" value={metrics.max_nesting} max={8} hint="Deepest indentation. Four levels is where mistakes start." />
            <Meter
              label="doc coverage"
              value={documentation}
              max={100}
              hint="Share of functions with a docstring. This is what the next reader needs."
            />
            <Meter label="comment ratio" value={metrics.comment_ratio} max={40} hint="Comments per line of code. Kind of a proxy for 'explains itself'." />
            <Meter label="duplication" value={metrics.duplication} max={40} hint="Near-identical blocks — every copy is a future forgotten fix." />
            <Meter label="functions" value={metrics.functions} max={Math.max(20, metrics.functions)} hint="Small functions are easier to test and name honestly." />
          </div>
          {overview?.maintainability != null && (
            <p className="mt-3 text-[11px] text-slate-500">
              Project maintainability index: <span className="font-mono text-slate-300">{overview.maintainability}</span> / 100
            </p>
          )}
        </Panel>

        {Boolean(metrics.extra?.functions?.length) && (
          <Panel title="Functions, hardest first" subtitle="Complexity is the cost of understanding each one">
            <table className="w-full text-left text-[12px]">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-1">function</th>
                  <th className="pb-1">line</th>
                  <th className="pb-1">cx</th>
                  <th className="pb-1">nest</th>
                  <th className="pb-1">len</th>
                  <th className="pb-1">doc</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-300">
                {metrics.extra.functions.slice(0, 10).map((fn: any) => (
                  <tr key={`${fn.name}-${fn.line}`} className="border-t border-ink-800">
                    <td className="py-1 pr-2 font-sans">{fn.name}</td>
                    <td className="py-1 pr-2">{fn.line}</td>
                    <td className={cn('py-1 pr-2', fn.complexity > 10 ? 'text-rose-300' : fn.complexity > 6 ? 'text-amber-300' : 'text-emerald-300')}>
                      {fn.complexity}
                    </td>
                    <td className="py-1 pr-2">{fn.nesting}</td>
                    <td className="py-1 pr-2">{fn.length}</td>
                    <td className="py-1">{fn.documented ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {overview?.hotspots && overview.hotspots.length > 0 && (
          <Panel title="Workspace hotspots" subtitle="Fix these first — they drag the average down">
            <ul className="space-y-1.5">
              {overview.hotspots.map((spot) => (
                <li key={spot.path} className="flex items-center justify-between gap-2 rounded-lg bg-ink-900/60 px-2.5 py-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => openFile(spot.path)}>
                    <p className="truncate text-[12.5px] text-slate-200">{spot.path}</p>
                    <p className="truncate text-[11px] text-slate-500">{spot.top_issue || 'no findings'}</p>
                  </button>
                  <span className="font-mono text-xs text-slate-400">
                    {spot.grade} · {spot.health_score.toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
            {overview.duplicates && overview.duplicates.length > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-200">
                <Link2 size={12} /> {overview.duplicates.length} duplicated block(s) across files
              </p>
            )}
          </Panel>
        )}
      </div>

      <Panel title={`Findings (${findings.length})`} subtitle="Sorted by severity, then line" bodyClassName="p-0 overflow-hidden">
        <FindingList findings={findings} emptyHint="Clean file — nothing to report." />
      </Panel>
    </div>
  );
}
