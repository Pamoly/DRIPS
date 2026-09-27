import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn } from '../lib/format';

const TONES = {
  ok: { ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={15} className="text-emerald-300" /> },
  warn: { ring: 'ring-amber-500/30', bg: 'bg-amber-500/10', icon: <AlertTriangle size={15} className="text-amber-300" /> },
  error: { ring: 'ring-rose-500/30', bg: 'bg-rose-500/10', icon: <XCircle size={15} className="text-rose-300" /> },
  info: { ring: 'ring-accent-500/25', bg: 'bg-accent-500/10', icon: <Info size={15} className="text-accent-300" /> },
} as const;

export function Toasts() {
  const { toasts, clearToasts } = useWorkspace();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none absolute bottom-10 right-4 z-50 flex w-96 max-w-[92vw] flex-col gap-2">
      {toasts.slice(-4).map((toast) => {
        const tone = TONES[toast.kind];
        return (
          <div
            key={toast.id}
            className={cn('pointer-events-auto animate-slide-in rounded-xl border border-ink-700 p-3 ring-1 ring-inset backdrop-blur', tone.bg, tone.ring)}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">{tone.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-slate-100">{toast.title}</p>
                {toast.body && <p className="mt-0.5 text-[11.5px] text-slate-300">{toast.body}</p>}
              </div>
            </div>
          </div>
        );
      })}
      <button className="pointer-events-auto self-end text-[10px] uppercase tracking-wide text-slate-500 hover:text-slate-300" onClick={clearToasts}>
        clear all
      </button>
    </div>
  );
}
