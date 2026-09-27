import React, { useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { Explorer } from './components/Explorer';
import { EditorPane } from './components/EditorPane';
import { HealthPanel } from './components/HealthPanel';
import { RunPanel } from './components/RunPanel';
import { RightDock } from './components/RightDock';
import { StatusBar } from './components/StatusBar';
import { Toasts } from './components/Toasts';
import { useWorkspace } from './store/WorkspaceContext';
import { cn } from './lib/format';
import { Spinner } from './components/ui';

const EDITOR_TABS = [
  { id: 'code', label: 'Code' },
  { id: 'health', label: 'Health' },
  { id: 'run', label: 'Run' },
] as const;

export default function App() {
  const { layout, setLayout, ready, error, activePath, analyzeActive, activeFile } = useWorkspace();

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-semibold text-rose-300">The engine is not answering</p>
        <p className="max-w-lg text-sm text-slate-400">{error}</p>
        <pre className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-left font-mono text-[12px] text-slate-300">
          python3 -m backend.app.server --port 8000
        </pre>
        <p className="text-xs text-slate-500">
          Start the engine (or run <span className="font-mono">npm run dev</span> in frontend/ so the proxy can reach it),
          then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-ink-950">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        {layout.explorerOpen && (
          <div
            className="relative flex-shrink-0 border-r border-ink-700/70"
            style={{ width: layout.explorerWidth }}
          >
            <Explorer />
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center gap-1 border-b border-ink-700/70 bg-ink-900/40 px-2">
            <button
              className="btn-ghost px-2 py-1"
              title={layout.explorerOpen ? 'Hide the explorer' : 'Show the explorer'}
              onClick={() => setLayout({ explorerOpen: !layout.explorerOpen })}
            >
              {layout.explorerOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>

            <div className="flex items-center gap-1">
              {EDITOR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLayout({ editorTab: tab.id })}
                  className={cn(
                    'tab',
                    layout.editorTab === tab.id ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!ready && (
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Spinner /> loading workspace
                </span>
              )}
              {ready && activePath && layout.editorTab !== 'health' && (
                <button className="btn-ghost text-[11px]" onClick={() => analyzeActive()}>
                  analyse {activeFile?.path}
                </button>
              )}
              <button
                className="btn-ghost px-2 py-1"
                title={layout.dockOpen ? 'Hide the mentor dock' : 'Show the mentor dock'}
                onClick={() => setLayout({ dockOpen: !layout.dockOpen })}
              >
                {layout.dockOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {layout.editorTab === 'code' && <EditorPane />}
            {layout.editorTab === 'health' && <HealthPanel />}
            {layout.editorTab === 'run' && <RunPanel />}
          </div>
        </main>

        {layout.dockOpen && (
          <ResizableDock width={layout.dockWidth}>
            <RightDock />
          </ResizableDock>
        )}
      </div>

      <StatusBar />
      <Toasts />
    </div>
  );
}

/** A drag handle so the mentor dock can be widened while reading a long explanation. */
function ResizableDock({ width, children }: { width: number; children: React.ReactNode }) {
  const { setLayout } = useWorkspace();
  const [localWidth, setLocalWidth] = useState(width);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(Math.max(window.innerWidth - event.clientX, 320), 900);
      setLocalWidth(next);
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        setLayout({ dockWidth: localWidth });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [localWidth, setLayout]);

  return (
    <aside className="relative flex-shrink-0 border-l border-ink-700/70" style={{ width: localWidth }}>
      <div
        className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize hover:bg-accent-500/30"
        onMouseDown={() => {
          dragging.current = true;
        }}
      />
      {children}
    </aside>
  );
}
