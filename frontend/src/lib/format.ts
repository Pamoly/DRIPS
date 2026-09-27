import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Severity } from '../types';

marked.setOptions({ gfm: true, breaks: true });

/** Markdown → sanitised HTML. Assistant output is data, never trusted markup. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown ?? '', { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
}

export const severityMeta: Record<Severity, { label: string; color: string; bg: string; ring: string; icon: string }> = {
  critical: { label: 'Critical', color: 'text-rose-300', bg: 'bg-rose-500/15', ring: 'ring-rose-500/40', icon: '🛑' },
  major: { label: 'Major', color: 'text-amber-300', bg: 'bg-amber-500/15', ring: 'ring-amber-500/40', icon: '⚠️' },
  minor: { label: 'Minor', color: 'text-sky-300', bg: 'bg-sky-500/15', ring: 'ring-sky-500/40', icon: '🔸' },
  info: { label: 'Note', color: 'text-slate-300', bg: 'bg-slate-500/15', ring: 'ring-slate-500/40', icon: 'ℹ️' },
};

export function gradeColor(grade: string | null | undefined): string {
  switch (grade) {
    case 'A':
      return 'text-emerald-300 bg-emerald-500/15 ring-emerald-500/30';
    case 'B':
      return 'text-teal-300 bg-teal-500/15 ring-teal-500/30';
    case 'C':
      return 'text-amber-300 bg-amber-500/15 ring-amber-500/30';
    case 'D':
      return 'text-orange-300 bg-orange-500/15 ring-orange-500/30';
    case 'F':
      return 'text-rose-300 bg-rose-500/15 ring-rose-500/30';
    default:
      return 'text-slate-300 bg-slate-500/15 ring-slate-500/30';
  }
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#64748b';
  if (score >= 90) return '#34d399';
  if (score >= 80) return '#2dd4bf';
  if (score >= 70) return '#fbbf24';
  if (score >= 60) return '#fb923c';
  return '#fb7185';
}

export function relativeTime(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  const delta = Date.now() / 1000 - seconds;
  if (delta < 45) return 'just now';
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

export function languageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    py: 'python',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    sh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
  };
  return map[extension] ?? 'plaintext';
}

export function monacoLanguage(language: string): string {
  const map: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    json: 'json',
    markdown: 'markdown',
    html: 'html',
    css: 'css',
    shell: 'shell',
    yaml: 'yaml',
    sql: 'sql',
    java: 'java',
    go: 'go',
    rust: 'rust',
    ruby: 'ruby',
    php: 'php',
  };
  return map[language] ?? 'plaintext';
}

/** Render a unified diff into rows with a stable colour per line kind. */
export function diffRows(diff: string): { kind: 'add' | 'del' | 'context' | 'meta'; text: string }[] {
  return (diff ?? '')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line.startsWith('+++') || line.startsWith('---')) return { kind: 'meta' as const, text: line };
      if (line.startsWith('@@')) return { kind: 'meta' as const, text: line };
      if (line.startsWith('+')) return { kind: 'add' as const, text: line.slice(1) };
      if (line.startsWith('-')) return { kind: 'del' as const, text: line.slice(1) };
      return { kind: 'context' as const, text: line.startsWith(' ') ? line.slice(1) : line };
    });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}
