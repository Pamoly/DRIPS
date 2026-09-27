import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, CircleDashed, CornerDownLeft, Loader2, Send, Square, Terminal, TriangleAlert } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn, renderMarkdown } from '../lib/format';
import { Panel } from './ui';

const QUICK_ACTIONS: { label: string; prompt: string; icon?: React.ReactNode }[] = [
  { label: 'Explain this file', prompt: 'Explain this file line by line, as if I am reading it for the first time.' },
  { label: 'Health report', prompt: 'Check the health of this file and tell me what to fix first.' },
  { label: 'Fix what you can', prompt: 'Fix everything you can in this file and show me the diffs before applying anything.' },
  { label: 'Review this file', prompt: 'Review this file like a senior engineer and tell me what blocks a merge.' },
  { label: 'Write tests', prompt: 'Write the tests that would have caught the problems in this file.' },
  { label: 'Debug this', prompt: 'Here is a traceback — find the root cause and tell me how to verify it.' },
  { label: 'What should I learn?', prompt: 'Based on the problems in my code, what should I learn next?' },
  { label: 'Clean up safely', prompt: 'Run autopilot: apply only the provably safe fixes and tell me what was left for me.' },
];

export function ChatPanel() {
  const {
    messages,
    trace,
    streaming,
    askMentor,
    stopStreaming,
    activePath,
    autonomy,
    analysis,
    toast,
  } = useWorkspace();

  const [input, setInput] = useState('');
  const [traceback, setTraceback] = useState('');
  const [showTraceback, setShowTraceback] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, trace.length, streaming]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    askMentor(message, traceback.trim() ? { traceback: traceback.trim() } : {});
    setInput('');
    setTraceback('');
    setShowTraceback(false);
  };

  const visibleTrace = useMemo(() => trace.slice(-8), [trace]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-ink-700/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500/15 text-accent-200">
            <Bot size={15} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-white">Mentor</p>
            <p className="text-[11px] text-slate-500">
              {activePath ?? 'no file'} · {autonomy}
              {analysis ? ` · health ${analysis.health_score.toFixed(0)}` : ''}
            </p>
          </div>
        </div>
        <span className="chip bg-emerald-500/10 text-emerald-200 ring-emerald-500/25">proposes, never applies</span>
      </header>

      {visibleTrace.length > 0 && (
        <div className="flex-shrink-0 border-b border-ink-700/70 bg-ink-900/40 px-3 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">agent trace</p>
          <ol className="space-y-1">
            {visibleTrace.map((entry, index) => (
              <li key={`${entry.agent}-${entry.action}-${index}`} className="flex items-start gap-2 text-[11.5px]">
                {entry.status === 'running' ? (
                  <Loader2 size={12} className="mt-0.5 animate-spin text-accent-300" />
                ) : entry.status === 'failed' ? (
                  <TriangleAlert size={12} className="mt-0.5 text-rose-300" />
                ) : (
                  <CheckCircle2 size={12} className="mt-0.5 text-emerald-300" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-200">{entry.agent}</span>
                  <span className="text-slate-500"> · {entry.action} · </span>
                  <span className="text-slate-400">{entry.detail}</span>
                </span>
                {entry.xp ? <span className="font-mono text-[10px] text-accent-300">+{entry.xp}xp</span> : null}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink-700 p-4">
            <p className="text-[13px] font-medium text-slate-200">Ask me anything about this file.</p>
            <p className="mt-1 text-[12px] text-slate-500">
              I can read code with you line by line, score its health, debug an error, prepare fixes,
              write tests and turn all of it into your next lesson. Nothing I write to your file happens
              without your approval.
            </p>
          </div>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent-500/15 px-3 py-2 text-[13px] text-accent-50 ring-1 ring-inset ring-accent-500/25">
                {message.content}
              </div>
            </div>
          ) : message.markdown !== undefined && message.markdown !== '' ? (
            <AssistantBlock key={message.id} message={message} onFollowUp={send} />
          ) : (
            <div key={message.id} className="flex items-start gap-2">
              <Bot size={14} className="mt-1 flex-shrink-0 text-accent-300" />
              <div
                className={cn(
                  'prose-drips min-w-0 flex-1 rounded-xl border border-ink-700/70 bg-ink-850/80 px-3 py-2',
                  message.streaming && 'streaming-caret',
                )}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '…') }}
              />
            </div>
          ),
        )}
      </div>

      <div className="flex-shrink-0 border-t border-ink-700/70 bg-ink-900/60 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              className="rounded-full border border-ink-600 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-accent-500/60 hover:text-white disabled:opacity-40"
              disabled={streaming}
              onClick={() => {
                if (action.label === 'Debug this') {
                  setShowTraceback(true);
                  setInput(action.prompt);
                  return;
                }
                send(action.prompt);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

        {showTraceback && (
          <textarea
            autoFocus
            className="input mb-2 h-24 font-mono text-[11.5px]"
            placeholder={'Traceback (most recent call last):\n  File "inventory.py", line 103, in average_price\nZeroDivisionError: division by zero'}
            value={traceback}
            onChange={(event) => setTraceback(event.target.value)}
          />
        )}

        <div className="flex items-end gap-2">
          <textarea
            className="input max-h-32 min-h-[42px] flex-1 resize-none"
            placeholder="Ask the mentor, or paste an error…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
          />
          <button
            className="btn-outline px-2"
            title="Paste a traceback so I can read it"
            onClick={() => setShowTraceback((value) => !value)}
          >
            <Terminal size={15} />
          </button>
          {streaming ? (
            <button className="btn-danger px-2" title="Stop" onClick={stopStreaming}>
              <Square size={14} />
            </button>
          ) : (
            <button className="btn-primary px-2.5" title="Send (Enter)" onClick={() => send(input)}>
              <Send size={15} />
            </button>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
          <CornerDownLeft size={11} /> Enter to send · Shift+Enter for a new line · {autonomy === 'autopilot'
            ? 'autopilot applies provably safe fixes only'
            : 'you approve every change'}
        </p>
      </div>
    </div>
  );
}

function AssistantBlock({ message, onFollowUp }: { message: any; onFollowUp: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const data = message.data ?? {};
  const patchCount = Array.isArray(data.patches) ? data.patches.length : 0;

  return (
    <div className="animate-slide-in rounded-xl border border-ink-700/70 bg-ink-850/70">
      <div className="flex items-center justify-between gap-2 border-b border-ink-700/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Bot size={14} className="flex-shrink-0 text-accent-300" />
          <span className="truncate text-[12.5px] font-medium text-slate-100">{message.headline}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {patchCount > 0 && (
            <span className="chip bg-accent-500/15 text-accent-200 ring-accent-500/25">{patchCount} patch(es)</span>
          )}
          <span className="chip bg-ink-700/60 text-slate-400 ring-ink-600">{message.agent}</span>
        </div>
      </div>
      <div
        className={cn('prose-drips px-3 py-2', !open && 'max-h-80 overflow-hidden')}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.markdown) }}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-700/60 px-3 py-2">
        <button className="btn-ghost text-[11px]" onClick={() => setOpen((value) => !value)}>
          {open ? 'Collapse' : 'Read in full'}
        </button>
        {(message.followUps ?? []).slice(0, 3).map((followUp: string) => (
          <button key={followUp} className="btn-outline text-[11px]" onClick={() => onFollowUp(followUp)}>
            {followUp}
          </button>
        ))}
      </div>
    </div>
  );
}
