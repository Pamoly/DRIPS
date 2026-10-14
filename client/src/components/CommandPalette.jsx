import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calculator,
  CornerDownLeft,
  FileText,
  Kanban,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  Target,
  Timer,
  Users,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { cx, fmtDate, fmtMoney } from '../lib/format';
import { NAV } from './AppShell';

const score = (hay = '', needle = '') => {
  const h = hay.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 0;
  if (h.startsWith(n)) return 100;
  if (h.includes(n)) return 70;
  // simple subsequence match
  let i = 0;
  for (const ch of h) if (ch === n[i]) i++;
  return i === n.length ? 40 : 0;
};

export function CommandPalette({ open, onClose }) {
  const { collections, settings, clientMap } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!open) return [];
    const out = [];
    const push = (group, items) => items.forEach((i) => out.push({ group, ...i }));

    push(
      'Navigate',
      NAV.filter((n) => !q || score(n.label, q) > 0).map((n) => ({
        id: `nav-${n.to}`,
        title: n.label,
        icon: n.icon,
        run: () => navigate(n.to),
      })),
    );

    const clients = (collections.clients || [])
      .map((c) => ({
        id: c.id,
        title: c.company || c.name,
        subtitle: [c.name, c.email, c.status].filter(Boolean).join(' · '),
        icon: Users,
        score: Math.max(score(c.company, q), score(c.name, q), score(c.email, q)),
        run: () => navigate(`/app/clients?focus=${c.id}`),
      }))
      .filter((c) => !q || c.score > 0)
      .slice(0, 5);
    push('Clients', clients);

    const proposals = (collections.proposals || [])
      .map((p) => ({
        id: p.id,
        title: `${p.number} · ${p.title}`,
        subtitle: `${p.status} · ${fmtMoney(p.total, p.currency, settings?.locale?.numberFormat === 'en' ? 'en-US' : 'nl-NL')}`,
        icon: FileText,
        score: Math.max(score(p.title, q), score(p.number, q), score(clientMap[p.clientId]?.company, q)),
        run: () => navigate(`/app/proposals/${p.id}`),
      }))
      .filter((p) => !q || p.score > 0)
      .slice(0, 5);
    push('Proposals & quotes', proposals);

    const invoices = (collections.invoices || [])
      .map((i) => ({
        id: i.id,
        title: `${i.number} · ${clientMap[i.clientId]?.company || 'no client'}`,
        subtitle: `${i.status} · due ${fmtDate(i.dueDate)} · ${fmtMoney(i.total, i.currency, settings?.locale?.numberFormat === 'en' ? 'en-US' : 'nl-NL')}`,
        icon: Receipt,
        score: Math.max(score(i.number, q), score(clientMap[i.clientId]?.company, q), score(i.status, q)),
        run: () => navigate(`/app/invoices?focus=${i.id}`),
      }))
      .filter((i) => !q || i.score > 0)
      .slice(0, 5);
    push('Invoices', invoices);

    const tasks = (collections.tasks || [])
      .map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: `${t.column} · ${t.points || 0} pts · ${t.assignee || 'unassigned'}`,
        icon: Kanban,
        score: Math.max(score(t.title, q), score(t.assignee, q), score((t.labels || []).join(' '), q)),
        run: () => navigate(`/app/board?focus=${t.id}`),
      }))
      .filter((t) => !q || t.score > 0)
      .slice(0, 5);
    push('Board cards', tasks);

    const goals = (collections.goals || [])
      .map((g) => ({
        id: g.id,
        title: g.title,
        subtitle: `${g.metric}: ${g.current} / ${g.target} ${g.unit || ''}`,
        icon: Target,
        score: score(g.title, q) || score(g.category, q),
        run: () => navigate(`/app/goals?focus=${g.id}`),
      }))
      .filter((g) => !q || g.score > 0)
      .slice(0, 4);
    push('Goals', goals);

    const projects = (collections.projects || [])
      .map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: clientMap[p.clientId]?.company || '',
        icon: LayoutDashboard,
        score: score(p.name, q),
        run: () => navigate(`/app/board?project=${p.id}`),
      }))
      .filter((p) => !q || p.score > 0)
      .slice(0, 4);
    push('Projects', projects);

    const actions = [
      { id: 'a1', title: 'Create proposal', icon: FileText, run: () => navigate('/app/proposals/new') },
      { id: 'a2', title: 'Create invoice', icon: Receipt, run: () => navigate('/app/invoices?new=1') },
      { id: 'a3', title: 'Log expense', icon: Calculator, run: () => navigate('/app/tax?new=1') },
      { id: 'a4', title: 'Add client', icon: Users, run: () => navigate('/app/clients?new=1') },
      { id: 'a5', title: 'Start timer', icon: Timer, run: () => navigate('/app/time') },
      { id: 'a6', title: 'Open settings', icon: Settings, run: () => navigate('/app/settings') },
    ].filter((a) => !q || score(a.title, q) > 0);
    push('Actions', actions);

    return out.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 40);
  }, [open, q, collections, settings, clientMap, navigate]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const grouped = results.reduce((acc, r) => {
    (acc[r.group] = acc[r.group] || []).push(r);
    return acc;
  }, {});
  let flatIndex = -1;

  const runAt = (i) => {
    const item = results[i];
    if (!item) return;
    item.run?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgb(7_13_26/0.6)] px-3 pt-[12vh] backdrop-blur-[3px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="card w-full max-w-xl overflow-hidden p-0 shadow-[var(--shadow-pop)]"
        style={{ animation: 'var(--animate-pop)' }}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runAt(active);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search or jump to…"
            aria-label="Search"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
          <span className="kbd hidden sm:inline">esc</span>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">No matches for “{q}”.</p>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{group}</p>
              <ul>
                {items.map((item) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  const Icon = item.icon;
                  return (
                    <li key={`${group}-${item.id}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => runAt(idx)}
                        className={cx(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
                          idx === active ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_12%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-[var(--color-brand-600)]" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{item.title}</span>
                          {item.subtitle && <span className="block truncate text-xs text-[var(--text-muted)]">{item.subtitle}</span>}
                        </span>
                        {idx === active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-40" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-2.5 text-[0.7rem] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
            <span className="kbd ml-2">↵</span> open
          </span>
          <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
