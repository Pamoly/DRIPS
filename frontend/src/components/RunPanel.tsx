import React from 'react';
import { Bug, Play, Terminal } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn } from '../lib/format';
import { Empty, Panel } from './ui';

export function RunPanel() {
  const { lastRun, runActive, activeFile, askMentor, patches } = useWorkspace();

  return (
    <div className="grid min-h-0 grid-cols-1 gap-3 overflow-auto p-3">
      <Panel
        title="Sandboxed run"
        subtitle="Separate process · CPU + memory limits · 6 s timeout · isolated interpreter"
        actions={
          <>
            <button className="btn-primary text-xs" onClick={() => runActive()} disabled={!activeFile}>
              <Play size={13} /> Run {activeFile?.path ?? 'file'}
            </button>
            <button
              className="btn-outline text-xs"
              disabled={!lastRun || lastRun.exit_code === 0}
              onClick={() =>
                lastRun &&
                askMentor('Debug this traceback and tell me how to verify the fix.', { traceback: lastRun.stderr })
              }
            >
              <Bug size={13} /> Debug this
            </button>
          </>
        }
      >
        {!lastRun ? (
          <Empty
            title="Nothing has run yet"
            body="Press Run and the output appears here. Exit codes, stderr and a plain-language reading of the traceback."
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={cn(
                  'chip ring-inset',
                  lastRun.exit_code === 0
                    ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
                )}
              >
                exit {lastRun.exit_code}
              </span>
              <span className="font-mono text-slate-400">{lastRun.duration_ms.toFixed(0)} ms</span>
              {lastRun.timed_out && <span className="chip bg-amber-500/15 text-amber-200 ring-amber-500/30">timed out</span>}
              <span className="font-mono text-slate-500">{lastRun.command || 'no command'}</span>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">stdout</p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-[12px] text-slate-200">
                {lastRun.stdout || '(no output)'}
              </pre>
            </div>

            {lastRun.stderr && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                  <Terminal size={11} /> stderr
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 font-mono text-[12px] text-rose-100">
                  {lastRun.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </Panel>

      {patches.filter((patch) => patch.status === 'proposed').length > 0 && (
        <Panel title="Fixes prepared while debugging" subtitle="Open the Fixes tab to approve or reject them">
          <ul className="space-y-1.5">
            {patches
              .filter((patch) => patch.status === 'proposed')
              .slice(0, 5)
              .map((patch) => (
                <li key={patch.id} className="rounded-lg bg-ink-900/50 px-2.5 py-2 text-[12px] text-slate-300">
                  {patch.title}
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
