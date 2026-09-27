import React from 'react';
import { cn, gradeColor, scoreColor, severityMeta } from '../lib/format';
import type { Severity } from '../types';

export function SeverityChip({ severity, count }: { severity: Severity; count?: number }) {
  const meta = severityMeta[severity];
  return (
    <span className={cn('chip ring-inset', meta.bg, meta.color, meta.ring)}>
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
      {count !== undefined && <span className="font-mono">{count}</span>}
    </span>
  );
}

export function GradeBadge({ grade, size = 'md' }: { grade: string | null | undefined; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md font-mono font-bold ring-1 ring-inset',
        gradeColor(grade),
        size === 'sm' ? 'h-5 w-5 text-[11px]' : 'h-7 w-7 text-sm',
      )}
      title={`Health grade ${grade ?? '—'}`}
    >
      {grade ?? '—'}
    </span>
  );
}

export function ScoreRing({
  score,
  size = 96,
  stroke = 8,
  label = 'health',
}: {
  score: number | null | undefined;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const value = score ?? 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (value / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#18233a" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-semibold text-white">{score == null ? '—' : score.toFixed(0)}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
    </div>
  );
}

export function Meter({ label, value, max = 100, hint }: { label: string; value: number; max?: number; hint?: string }) {
  const ratio = Math.max(0, Math.min(1, max ? value / max : 0));
  const tone = ratio > 0.75 ? 'bg-rose-400' : ratio > 0.45 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div title={hint}>
      <div className="mb-1 flex items-baseline justify-between text-[11px] uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div className={cn('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('panel flex min-h-0 flex-col', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-700/70 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 overflow-auto p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-700 p-8 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {body && <p className="max-w-sm text-xs text-slate-500">{body}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-400/40 border-t-accent-400', className)}
    />
  );
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? 'text-emerald-300' : pct >= 70 ? 'text-amber-300' : 'text-slate-300';
  return <span className={cn('font-mono text-[11px]', tone)}>{pct}% confidence</span>;
}
