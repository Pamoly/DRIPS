import React, { useState } from 'react';
import {
  Activity,
  Bot,
  FilePlus2,
  GitPullRequest,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Undo2,
  Wand2,
} from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { Confidence, GradeBadge, Spinner } from './ui';
import { cn } from '../lib/format';

const AUTONOMY = [
  { id: 'manual', label: 'Manual', hint: 'Explain only. I never propose changes unless you ask.' },
  { id: 'supervised', label: 'Supervised', hint: 'I propose diffs; you approve each one before it is written.' },
  { id: 'autopilot', label: 'Autopilot', hint: 'I apply provably safe fixes only, then file a review you can revert.' },
];

export function TopBar() {
  const {
    activeFile,
    analysis,
    autonomy,
    reasoning,
    setAutonomy,
    analyzeActive,
    proposeFixes,
    runActive,
    createReview,
    createFile,
    streaming,
    openFile,
    layout,
    setLayout,
    resetWorkspace,
    completeLesson,
  } = useWorkspace();
  const [newFile, setNewFile] = useState('');
  const [showNew, setShowNew] = useState(false);

  const dirty = Boolean(activeFile && layout.editorTab === 'code');

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between gap-4 border-b border-ink-700/70 bg-ink-900/80 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 font-bold text-ink-950">
          D
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">DRIPS</span>
            <span className="chip bg-ink-700/60 text-slate-300 ring-ink-600">autonomous editor</span>
          </div>
          <p className="truncate text-[11px] text-slate-500">
            {activeFile ? activeFile.path : 'no file open'}
            {analysis && ` · ${analysis.metrics.functions} fn · ${analysis.metrics.code_lines} loc`}
          </p>
        </div>
        {analysis && (
          <div className="ml-1 flex items-center gap-2">
            <GradeBadge grade={analysis.grade} />
            <span className="font-mono text-xs text-slate-400">{analysis.health_score.toFixed(0)}/100</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ToolButton icon={<FilePlus2 size={14} />} label="New" onClick={() => setShowNew((value) => !value)} />
        <ToolButton icon={<Activity size={14} />} label="Analyze" onClick={() => analyzeActive()} />
        <ToolButton icon={<Wand2 size={14} />} label="Propose fixes" onClick={() => proposeFixes()} />
        <ToolButton icon={<Play size={14} />} label="Run" onClick={() => runActive()} />
        <ToolButton icon={<GitPullRequest size={14} />} label="Review" onClick={() => createReview()} />
        <ToolButton
          icon={<Undo2 size={14} />}
          label="Reset demo"
          onClick={() => resetWorkspace()}
          subtle
        />

        <div className="mx-1 h-6 w-px bg-ink-700" />

        <div className="flex items-center gap-1 rounded-lg bg-ink-800/80 p-0.5">
          {AUTONOMY.map((mode) => (
            <button
              key={mode.id}
              title={mode.hint}
              onClick={() => setAutonomy(mode.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                autonomy === mode.id ? 'bg-accent-500 text-ink-950' : 'text-slate-400 hover:text-white',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div
          className="hidden items-center gap-1.5 rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-slate-400 lg:flex"
          title={
            reasoning?.has_llm
              ? `Narration by ${reasoning.provider}. Findings, patches and scores still come from the verified engine.`
              : 'No API key needed: the deterministic engine answers everything. Add OPENAI_API_KEY to upgrade the prose.'
          }
        >
          <Bot size={13} className={reasoning?.has_llm ? 'text-emerald-300' : 'text-accent-300'} />
          {reasoning?.has_llm ? reasoning.provider : 'offline engine'}
        </div>

        <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 xl:flex">
          <ShieldCheck size={13} />
          human approval required
        </div>

        {streaming && (
          <span className="flex items-center gap-1.5 text-[11px] text-accent-200">
            <Spinner /> thinking
          </span>
        )}
      </div>

      {showNew && (
        <div className="absolute left-4 top-16 z-30 w-80 panel p-3 shadow-2xl animate-fade-in">
          <p className="mb-2 text-xs font-medium text-slate-300">New file in the workspace</p>
          <div className="flex gap-2">
            <input
              autoFocus
              className="input"
              placeholder="cart_utils.py"
              value={newFile}
              onChange={(event) => setNewFile(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && newFile.trim()) {
                  createFile(newFile.trim());
                  setNewFile('');
                  setShowNew(false);
                }
                if (event.key === 'Escape') setShowNew(false);
              }}
            />
            <button
              className="btn-primary"
              onClick={() => {
                if (newFile.trim()) {
                  createFile(newFile.trim());
                  setNewFile('');
                  setShowNew(false);
                }
              }}
            >
              Create
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            The engine picks the language from the extension and analyses it immediately.
          </p>
        </div>
      )}
    </header>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  subtle,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'btn text-[12px]',
        subtle ? 'text-slate-500 hover:text-slate-300' : 'btn-outline',
      )}
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
