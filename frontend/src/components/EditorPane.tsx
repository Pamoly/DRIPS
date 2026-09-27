import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { Save, Wand2 } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn, monacoLanguage } from '../lib/format';
import { FindingList } from './FindingList';

/**
 * The code surface: Monaco for editing (with the analyser's findings published as real
 * editor markers, so problems are visible where they live), plus the findings list for
 * the beginner who wants the *why* next to the code.
 */
export function EditorPane() {
  const {
    activeFile,
    activeContent,
    analysis,
    editContent,
    saveActive,
    layout,
    setLayout,
    dirty,
    jumpToLine,
    proposeFixes,
    findings,
  } = useWorkspace();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const isDirty = Boolean(activeFile && dirty[activeFile.path] !== undefined);

  const publishMarkers = () => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;
    const markers = findings.map((finding) => ({
      severity:
        finding.severity === 'critical' || finding.severity === 'major'
          ? monaco.MarkerSeverity.Error
          : finding.severity === 'minor'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
      startLineNumber: finding.line,
      startColumn: finding.column || 1,
      endLineNumber: finding.end_line ?? finding.line,
      endColumn: (finding.end_line ?? finding.line) === finding.line ? 1000 : 1,
      message: `${finding.title}\n\nWhy it matters: ${finding.why_it_matters}\n\nHow to fix: ${finding.how_to_fix}`,
      source: `DRIPS · ${finding.rule}`,
      code: finding.rule,
    }));
    monaco.editor.setModelMarkers(model, 'drips', markers);
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.setTheme('drips-dark');
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveActive());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => proposeFixes());
    publishMarkers();
  };

  useEffect(() => {
    publishMarkers();
  }, [findings, activeFile?.path]);

  useEffect(() => {
    const line = layout.focusLine;
    if (!line || !editorRef.current) return;
    editorRef.current.revealLineInCenter(line);
    editorRef.current.setPosition({ lineNumber: line, column: 1 });
    editorRef.current.focus();
    setLayout({ focusLine: null });
  }, [layout.focusLine, setLayout]);

  if (!activeFile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Select a file in the explorer, or create one with the New button.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-700/70 bg-ink-900/60 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-200">{activeFile.path}</span>
          {isDirty && <span className="chip bg-amber-500/15 text-amber-200 ring-amber-500/30">unsaved</span>}
          <span className="text-slate-500">
            revision {activeFile.revision} · {analysis ? `${analysis.findings.length} findings` : 'not analysed'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={() => jumpToLine(1)}>
            analysis in Health tab
          </button>
          <button className={cn('btn-primary text-xs', !isDirty && 'opacity-60')} onClick={() => saveActive()}>
            <Save size={13} /> Save
            <span className="ml-1 hidden font-mono text-[10px] text-ink-950/70 md:inline">⌘S</span>
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 border-b border-ink-700/60 xl:border-b-0 xl:border-r">
          <Editor
            height="100%"
            theme="drips-dark"
            path={activeFile.path}
            language={monacoLanguage(activeFile.language)}
            value={activeContent}
            onChange={(value) => editContent(value ?? '')}
            onMount={onMount}
            options={{
              fontSize: 13.5,
              fontLigatures: true,
              minimap: { enabled: true, maxColumn: 80 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              renderWhitespace: 'selection',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              rulers: [100],
              padding: { top: 12 },
              bracketPairColorization: { enabled: true },
              guides: { indentation: true, bracketPairs: true },
            }}
            loading={
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                loading the editor…
              </div>
            }
          />
        </div>

        <div className="min-h-0 overflow-hidden">
          <FindingList
            findings={findings}
            onFix={() => proposeFixes()}
            emptyHint="Run Analyze and every problem lands here — with the reason, not just the rule name."
          />
        </div>
      </div>
    </div>
  );
}
