import React from 'react';
import { AlertTriangle, Bug, CheckCircle2, Cpu, UserCheck } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn } from '../lib/format';

export function StatusBar() {
  const { analysis, activeFile, severityCounts, autonomy, reasoning, layout, setLayout, overview, streaming } =
    useWorkspace();

  return (
    <footer className="flex h-7 flex-shrink-0 items-center justify-between gap-3 border-t border-ink-700/70 bg-ink-950/90 px-3 text-[11px] text-slate-500">
      <div className="flex items-center gap-3">
        <button
          className={cn('flex items-center gap-1 hover:text-slate-300', analysis && 'text-slate-400')}
          onClick={() => setLayout({ editorTab: 'health' })}
          title="Open the health report"
        >
          <Bug size={12} />
          {activeFile ? activeFile.path : 'no file'}
          {analysis && <span className="font-mono">· {analysis.language}</span>}
        </button>

        {analysis && (
          <>
            <span className="text-rose-300">
              {severityCounts.critical} critical
            </span>
            <span className="text-amber-300">{severityCounts.major} major</span>
            <span className="text-sky-300">{severityCounts.minor} minor</span>
            <span className="text-slate-500">{severityCounts.info} notes</span>
            <span className="font-mono text-slate-400">
              cx max {analysis.metrics.max_complexity} · nest {analysis.metrics.max_nesting}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {overview && (
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} className={overview.severities.critical ? 'text-rose-300' : 'text-emerald-300'} />
            project {overview.average_health?.toFixed(0) ?? '—'}/100
            {overview.severities.critical > 0 && (
              <span className="flex items-center gap-1 text-rose-300">
                <AlertTriangle size={11} /> {overview.severities.critical} critical
              </span>
            )}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Cpu size={12} />
          {reasoning?.has_llm ? `${reasoning.provider} narration` : 'deterministic engine'}
        </span>
        <span className="flex items-center gap-1 text-emerald-300/90">
          <UserCheck size={12} />
          {autonomy}
        </span>
        <span className={cn('font-mono', streaming ? 'text-accent-300' : 'text-slate-500')}>
          {streaming ? 'streaming…' : `tab: ${layout.editorTab}`}
        </span>
      </div>
    </footer>
  );
}
