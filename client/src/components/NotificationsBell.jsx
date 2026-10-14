import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, FileText, Kanban, Target, Wallet } from 'lucide-react';
import { useApp } from '../lib/store';
import { daysBetween, fmtDate, fmtMoney, quarterOf, todayISO, yearOf } from '../lib/format';
import { invoiceBalance, invoiceState } from '../lib/metrics';
import { resolveProfile, vatDeadline } from '../lib/tax';
import { cx } from '../lib/format';
import { Dropdown } from './ui';

export function useAlerts() {
  const { collections, settings, locale, baseCurrency } = useApp();
  return useMemo(() => {
    const alerts = [];
    const today = todayISO();
    const invoices = collections.invoices || [];
    const proposals = collections.proposals || [];
    const tasks = collections.tasks || [];
    const goals = collections.goals || [];

    const overdue = invoices.filter((i) => invoiceState(i) === 'overdue');
    if (overdue.length)
      alerts.push({
        id: 'overdue',
        tone: 'red',
        icon: AlertTriangle,
        title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`,
        detail: `${fmtMoney(overdue.reduce((s, i) => s + invoiceBalance(i), 0), baseCurrency, locale)} outstanding · oldest ${fmtDate(overdue.at(-1)?.dueDate, locale)}`,
        to: '/app/invoices?filter=overdue',
      });

    const dueSoon = invoices.filter((i) => invoiceState(i) === 'sent' && daysBetween(i.dueDate, today) >= 0 && daysBetween(i.dueDate, today) <= 7);
    if (dueSoon.length)
      alerts.push({
        id: 'due-soon',
        tone: 'amber',
        icon: CalendarClock,
        title: `${dueSoon.length} invoice${dueSoon.length > 1 ? 's' : ''} due within 7 days`,
        detail: dueSoon.map((i) => `${i.number} (${fmtDate(i.dueDate, locale)})`).join(', '),
        to: '/app/invoices?filter=sent',
      });

    const expiring = proposals.filter((p) => ['sent', 'viewed'].includes(p.status) && p.validUntil && daysBetween(p.validUntil, today) <= 7);
    if (expiring.length)
      alerts.push({
        id: 'expiring',
        tone: 'amber',
        icon: FileText,
        title: `${expiring.length} proposal${expiring.length > 1 ? 's' : ''} expir${expiring.length > 1 ? 'e' : 'es'} soon`,
        detail: expiring.map((p) => `${p.number} valid until ${fmtDate(p.validUntil, locale)}`).join(', '),
        to: '/app/proposals?filter=sent',
      });

    const stale = proposals.filter((p) => p.status === 'viewed' && daysBetween(today, (p.lastViewedAt || p.updatedAt || '').slice(0, 10)) > 4);
    if (stale.length)
      alerts.push({
        id: 'followup',
        tone: 'blue',
        icon: FileText,
        title: `${stale.length} viewed proposal${stale.length > 1 ? 's' : ''} without a decision`,
        detail: 'A short follow-up usually lifts close rates by 20–30%.',
        to: '/app/proposals?filter=viewed',
      });

    const profile = resolveProfile(settings);
    const q = quarterOf(new Date());
    const deadline = vatDeadline(profile, yearOf(new Date()), q);
    if (deadline) {
      const d = daysBetween(String(deadline).slice(0, 10), today);
      if (d >= 0 && d <= 21)
        alerts.push({
          id: 'vat',
          tone: d <= 5 ? 'red' : 'amber',
          icon: Wallet,
          title: `VAT return Q${q} due ${fmtDate(String(deadline).slice(0, 10), locale)}`,
          detail: d <= 5 ? `Only ${d} day${d === 1 ? '' : 's'} left — check your set-aside balance.` : `${d} days left to file and pay.`,
          to: '/app/tax',
        });
    }

    const lateTasks = tasks.filter((t) => t.column !== 'done' && t.dueDate && daysBetween(t.dueDate, today) > 0);
    if (lateTasks.length)
      alerts.push({
        id: 'late-tasks',
        tone: 'red',
        icon: Kanban,
        title: `${lateTasks.length} board card${lateTasks.length > 1 ? 's' : ''} past due`,
        detail: lateTasks.slice(0, 3).map((t) => t.title).join(' · ') + (lateTasks.length > 3 ? ' …' : ''),
        to: '/app/board',
      });

    const todayTasks = tasks.filter((t) => t.column !== 'done' && t.dueDate === today);
    if (todayTasks.length)
      alerts.push({
        id: 'today-tasks',
        tone: 'blue',
        icon: Kanban,
        title: `${todayTasks.length} card${todayTasks.length > 1 ? 's' : ''} due today`,
        detail: todayTasks.slice(0, 3).map((t) => t.title).join(' · '),
        to: '/app/board?view=calendar',
      });

    const behind = goals.filter((g) => g.status === 'behind' || g.status === 'at-risk');
    if (behind.length)
      alerts.push({
        id: 'goals',
        tone: 'amber',
        icon: Target,
        title: `${behind.length} goal${behind.length > 1 ? 's' : ''} need attention`,
        detail: behind.slice(0, 2).map((g) => g.title).join(' · '),
        to: '/app/goals',
      });

    if (!alerts.length)
      alerts.push({
        id: 'clear',
        tone: 'green',
        icon: CheckCircle2,
        title: 'You are all caught up',
        detail: 'No overdue invoices, deadlines or slipping goals right now.',
        to: '/app',
      });

    return alerts;
  }, [collections, settings, locale, baseCurrency]);
}

export function NotificationsBell() {
  const alerts = useAlerts();
  const navigate = useNavigate();
  const actionable = alerts.filter((a) => a.id !== 'clear');
  const toneRing = { red: 'bg-flag-700', amber: 'bg-[var(--color-amber-brand-500)]', blue: 'bg-[var(--color-brand-600)]', green: 'bg-[var(--color-mint-500)]' };

  return (
    <Dropdown
      className="relative"
      trigger={
        <button type="button" className="btn btn-ghost btn-icon relative" aria-label={`Notifications (${actionable.length} active)`} title="Deadlines & alerts">
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {actionable.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-flag-700)] px-1 text-[0.6rem] font-bold text-white">
              {actionable.length}
            </span>
          )}
        </button>
      }
    >
      <p className="px-2.5 pb-1.5 pt-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Deadlines & alerts
      </p>
      <div className="max-h-[22rem] overflow-y-auto">
        {alerts.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                navigate(a.to);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]"
            >
              <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white', toneRing[a.tone])}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.82rem] font-semibold leading-snug">{a.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--text-muted)]">{a.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Dropdown>
  );
}
