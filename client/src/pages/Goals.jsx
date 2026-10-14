import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Check,
  Download,
  FileDown,
  Flag,
  Minus,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { addDays, cx, daysBetween, fmtDate, quarterOf, round2, sortBy, sum, todayISO, yearOf } from '../lib/format';
import { profitAndLoss, utilisation } from '../lib/metrics';
import { goalsWorkbook } from '../lib/excel';
import { reportPDF, savePdf } from '../lib/pdf';
import {
  Button,
  Card,
  Dropdown,
  EmptyState,
  Field,
  IconButton,
  Input,
  KPI,
  MenuItem,
  Modal,
  PageHeader,
  Pill,
  Progress,
  SectionTitle,
  Segmented,
  Select,
  StatusPill,
  Textarea,
} from '../components/ui';

const CATEGORIES = [
  { id: 'revenue', label: 'Revenue', unit: 'EUR' },
  { id: 'tax', label: 'Tax & savings', unit: 'EUR' },
  { id: 'operations', label: 'Operations', unit: 'hours' },
  { id: 'growth', label: 'Growth', unit: 'clients' },
  { id: 'learning', label: 'Learning', unit: 'hours' },
  { id: 'other', label: 'Other', unit: '' },
];

export default function Goals() {
  const app = useApp();
  const { collections, settings, baseCurrency, locale, rates, addItem, updateItem, removeItem, toast } = app;
  const { m, mb } = useMoney();
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState(null);

  const goals = collections.goals || [];
  const pnl = profitAndLoss(collections, yearOf(new Date()), baseCurrency, rates);
  const util = utilisation(collections.timeEntries || [], 7);

  const filtered = sortBy(goals.filter((g) => category === 'all' || g.category === category), (g) => g.deadline || '9999', 1);

  const onTrack = goals.filter((g) => g.status === 'on-track').length;
  const atRisk = goals.filter((g) => g.status === 'at-risk' || g.status === 'behind').length;
  const avgProgress = goals.length ? round2(sum(goals, (g) => (g.target ? Math.min(100, ((Number(g.current) || 0) / g.target) * 100) : 0)) / goals.length) : 0;

  /** Pull live numbers from the workspace into the matching goals. */
  const syncFromData = () => {
    const buffer = round2(sum((collections.ledger || []).filter((l) => /tax|buffer|reserve/i.test(`${l.category} ${l.description}`)), (l) => l.amount));
    const weeklyBillable = round2(util.billable);
    let updated = 0;
    for (const g of goals) {
      let current = null;
      if (g.category === 'revenue' && /revenue|omzet|sales/i.test(`${g.metric} ${g.title}`)) current = pnl.revenue;
      else if (g.category === 'tax' && /buffer|set-aside|reserve|saved/i.test(`${g.metric} ${g.title}`)) current = buffer;
      else if (/utilisation|billable/i.test(`${g.metric} ${g.title}`)) current = weeklyBillable;
      else if (g.category === 'growth' && /retainer/i.test(`${g.metric} ${g.title}`))
        current = (collections.clients || []).filter((c) => (c.tags || []).some((t) => /retainer/i.test(t))).length;
      else if (/profit|marge/i.test(`${g.metric} ${g.title}`)) current = pnl.profit;
      else if (/outstanding|openstaand/i.test(`${g.metric} ${g.title}`)) current = pnl.outstanding;

      if (current === null) continue;
      const progress = g.target ? (current / g.target) * 100 : 0;
      const daysLeft = g.deadline ? daysBetween(g.deadline, todayISO()) : 365;
      const expected = g.target ? Math.max(0, 100 - (daysLeft / 365) * 100) : 0;
      const status = progress >= expected + 5 ? 'on-track' : progress >= expected - 15 ? 'at-risk' : 'behind';
      updateItem('goals', g.id, { current: round2(current), status }, { debounce: 0 });
      updated += 1;
    }
    toast(updated ? `${updated} goal${updated > 1 ? 's' : ''} synced with your live numbers` : 'No goals matched your data yet', updated ? 'success' : 'error');
  };

  const exportExcel = () => {
    const name = goalsWorkbook({ goals: filtered, currency: baseCurrency });
    toast(`Goals exported: ${name}`);
  };

  const exportPdf = () => {
    const doc = reportPDF({
      title: 'Goals & targets',
      subtitle: `${settings?.business?.name || 'Your business'} · ${fmtDate(todayISO(), locale)} · ${goals.length} goals tracked`,
      settings,
      sections: [
        {
          title: 'Overview',
          kv: [
            ['On track', `${onTrack}`],
            ['At risk / behind', `${atRisk}`],
            ['Average progress', `${avgProgress}%`],
            [`Revenue ${yearOf(new Date())}`, m(pnl.revenue)],
            ['Net profit', m(pnl.profit)],
            ['Outstanding', m(pnl.outstanding)],
          ],
        },
        {
          title: 'Goals',
          table: {
            head: ['Goal', 'Category', 'Metric', 'Current', 'Target', 'Progress', 'Deadline', 'Status'],
            body: filtered.map((g) => [
              g.title,
              g.category,
              g.metric,
              g.unit === 'EUR' ? mb(g.current) : round2(g.current),
              g.unit === 'EUR' ? mb(g.target) : g.target,
              `${g.target ? Math.round((g.current / g.target) * 100) : 0}%`,
              g.deadline ? fmtDate(g.deadline, locale) : '—',
              g.status || 'on-track',
            ]),
            numericColumns: [3, 4, 5],
          },
        },
      ],
    });
    savePdf(doc, `DRIPS-goals-${todayISO()}`);
    toast('Goals PDF downloaded');
  };

  const quarter = quarterOf(new Date());
  const quarterTarget = round2(goals.filter((g) => g.category === 'revenue').reduce((s, g) => s + (Number(g.target) || 0) / 4, 0));
  const quarterRevenue = round2(pnl.revenue / 4);

  return (
    <>
      <PageHeader
        eyebrow={`Q${quarter} ${yearOf(new Date())}`}
        title="Goals & Targets"
        subtitle="Turn ambition into numbers: revenue, tax buffer, utilisation and client goals — synced with your books and board."
        icon={Target}
        actions={
          <>
            <Dropdown trigger={<Button variant="outline" icon={Download}>Export</Button>}>
              <MenuItem icon={FileDown} onClick={exportExcel}>
                Goals (Excel)
              </MenuItem>
              <MenuItem icon={Trophy} onClick={exportPdf}>
                Goals report (PDF)
              </MenuItem>
            </Dropdown>
            <Button variant="outline" icon={RefreshCw} onClick={syncFromData}>
              Sync from data
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
              New goal
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPI label="On track" value={onTrack} icon={Trophy} tone="mint" hint={`${goals.length} goals total`} />
        <KPI label="Needs attention" value={atRisk} icon={Flag} tone={atRisk ? 'flag' : 'mint'} hint={atRisk ? 'Behind pace or at risk' : 'Everything on pace'} />
        <KPI label="Average progress" value={`${avgProgress}%`} icon={TrendingUp} tone="brand" hint="Across all active goals" />
        <KPI label="Quarterly revenue pace" value={quarterTarget ? `${Math.round((quarterRevenue / Math.max(1, quarterTarget)) * 100)}%` : '—'} icon={CalendarClock} tone="amber" hint={quarterTarget ? `${m(quarterRevenue)} of ${m(quarterTarget)} for Q${quarter}` : 'Set a revenue goal to track pace'} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Segmented
          ariaLabel="Filter goals by category"
          value={category}
          onChange={setCategory}
          options={[{ value: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]}
        />
        <p className="ml-auto text-xs text-[var(--text-muted)]">{filtered.length} shown</p>
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-4 p-4">
          <EmptyState
            icon={Target}
            title={goals.length ? 'No goals in this category' : 'Set your first target'}
            description={
              goals.length
                ? 'Pick another category or add a goal for this one.'
                : 'A revenue target, a tax buffer or a weekly billable-hours goal — DRIPS keeps the progress up to date from your books, invoices and timesheet.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
                  New goal
                </Button>
                <Button
                  variant="outline"
                  icon={Sparkle}
                  onClick={() => {
                    const y = yearOf(new Date());
                    const seeds = [
                      { title: `Reach ${m(96000)} revenue in ${y}`, category: 'revenue', metric: 'Invoiced revenue (ex VAT)', target: 96000, current: pnl.revenue, unit: 'EUR', deadline: `${y}-12-31` },
                      { title: 'Build a 6-month tax buffer', category: 'tax', metric: 'Tax reserve saved', target: 24000, current: 0, unit: 'EUR', deadline: `${y}-12-31` },
                      { title: 'Bill 28 hours per week', category: 'operations', metric: 'Billable hours per week', target: 28, current: util.billable, unit: 'hours', deadline: addDays(todayISO(), 90).toISOString().slice(0, 10) },
                      { title: 'Sign 2 retainer clients', category: 'growth', metric: 'Retainer contracts', target: 2, current: 0, unit: 'clients', deadline: addDays(todayISO(), 150).toISOString().slice(0, 10) },
                    ];
                    seeds.forEach((s) => addItem('goals', { ...s, status: 'on-track', notes: '' }));
                    toast('Four starter goals created — adjust the numbers to your ambition');
                  }}
                >
                  Add starter goals
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {filtered.map((g) => {
            const progress = g.target ? Math.min(100, ((Number(g.current) || 0) / g.target) * 100) : 0;
            const daysLeft = g.deadline ? daysBetween(g.deadline, todayISO()) : null;
            const pace = daysLeft !== null && daysLeft > 0 ? round2((Number(g.current) || 0) / Math.max(1, (365 - daysLeft) / 30)) : 0;
            const remaining = round2(Math.max(0, Number(g.target) - Number(g.current || 0)));
            const step = g.unit === 'EUR' ? 500 : g.target > 50 ? 5 : 1;
            return (
              <Card key={g.id} className="pad flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Pill tone="blue">{CATEGORIES.find((c) => c.id === g.category)?.label || g.category}</Pill>
                      <StatusPill status={g.status || 'on-track'} />
                    </p>
                    <h3 className="mt-2 text-base font-bold leading-snug">{g.title}</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{g.metric}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton icon={RefreshCw} label={`Edit ${g.title}`} size="sm" onClick={() => setEditing(g)} />
                    <Dropdown trigger={<IconButton icon={Minus} label={`More actions for ${g.title}`} size="sm" />}>
                      <MenuItem icon={Plus} onClick={() => setEditing(g)}>
                        Edit goal
                      </MenuItem>
                      <MenuItem
                        icon={Check}
                        onClick={() => {
                          updateItem('goals', g.id, { status: 'completed', current: g.target }, { debounce: 0 });
                          toast(`🎉 ${g.title} completed`);
                        }}
                      >
                        Mark completed
                      </MenuItem>
                      <MenuItem
                        icon={Trash2}
                        tone="danger"
                        onClick={() => {
                          if (window.confirm(`Delete “${g.title}”?`)) {
                            removeItem('goals', g.id);
                            toast('Goal deleted');
                          }
                        }}
                      >
                        Delete goal
                      </MenuItem>
                    </Dropdown>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-end justify-between gap-2">
                    <p className="tnum font-display text-2xl font-extrabold">
                      {g.unit === 'EUR' ? mb(g.current) : round2(g.current)}
                      <span className="text-sm font-semibold text-[var(--text-muted)]"> / {g.unit === 'EUR' ? mb(g.target) : g.target} {g.unit !== 'EUR' ? g.unit : ''}</span>
                    </p>
                    <p className="tnum text-sm font-bold" style={{ color: progress >= 75 ? 'var(--color-mint-500)' : progress >= 40 ? 'var(--color-brand-600)' : 'var(--color-amber-brand-500)' }}>
                      {Math.round(progress)}%
                    </p>
                  </div>
                  <Progress value={Math.min(Number(g.current) || 0, Number(g.target) || 0)} max={g.target} tone={progress >= 75 ? 'mint' : progress >= 40 ? 'brand' : 'amber'} showValue={false} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] p-0.5">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon !px-1.5 !py-1"
                      aria-label={`Decrease ${g.metric} by ${step}`}
                      onClick={() => updateItem('goals', g.id, { current: round2(Math.max(0, (Number(g.current) || 0) - step)) })}
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <input
                      className="tnum w-20 bg-transparent text-center text-sm font-bold outline-none"
                      type="number"
                      step={g.unit === 'EUR' ? '50' : '0.5'}
                      value={g.current ?? 0}
                      onChange={(e) => updateItem('goals', g.id, { current: Number(e.target.value) })}
                      aria-label={`Current value for ${g.title}`}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon !px-1.5 !py-1"
                      aria-label={`Increase ${g.metric} by ${step}`}
                      onClick={() => updateItem('goals', g.id, { current: round2((Number(g.current) || 0) + step) })}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <Pill tone={daysLeft !== null && daysLeft < 0 ? 'red' : 'neutral'} icon={CalendarClock}>
                    {daysLeft === null ? 'No deadline' : daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`}
                  </Pill>
                  {g.deadline && <span className="text-xs text-[var(--text-muted)]">{fmtDate(g.deadline, locale)}</span>}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-2">
                    <p className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">Remaining</p>
                    <p className="tnum font-bold">{g.unit === 'EUR' ? mb(remaining) : `${round2(remaining)} ${g.unit || ''}`}</p>
                  </div>
                  <div className="rounded-lg bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-2">
                    <p className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">Needed per month</p>
                    <p className="tnum font-bold">
                      {daysLeft !== null && daysLeft > 0 ? (g.unit === 'EUR' ? mb((remaining / daysLeft) * 30) : `${round2((remaining / daysLeft) * 30)} ${g.unit || ''}`) : '—'}
                    </p>
                  </div>
                </div>

                {g.notes && <p className="pretty mt-3 border-t border-[var(--line)] pt-3 text-xs leading-relaxed text-[var(--text-muted)]">{g.notes}</p>}
                {pace > 0 && (
                  <p className="mt-2 text-[0.7rem] text-[var(--text-muted)]">
                    Current pace: {g.unit === 'EUR' ? mb(pace) : `${pace} ${g.unit || ''}`} per month
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4 pad">
        <SectionTitle>Quarterly targets {yearOf(new Date())}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((qq) => {
            const target = round2(goals.filter((g) => g.category === 'revenue').reduce((s, g) => s + (Number(g.target) || 0) / 4, 0));
            const actual = qq === quarter ? quarterRevenue : qq < quarter ? round2(pnl.revenue / 4) : 0;
            return (
              <div key={qq} className={cx('rounded-xl border p-3', qq === quarter ? 'border-[var(--color-flag-700)] bg-[color-mix(in_srgb,var(--color-flag-700)_5%,transparent)]' : 'border-[var(--line)]')}>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  Q{qq} {qq === quarter && <span className="ml-1 text-flag-700">· current</span>}
                </p>
                <p className="tnum mt-1 font-display text-lg font-extrabold">{m(actual)}</p>
                <p className="text-[0.7rem] text-[var(--text-muted)]">target {m(target)}</p>
                <Progress className="mt-2" value={Math.min(actual, target)} max={Math.max(1, target)} showValue={false} tone={actual >= target ? 'mint' : 'amber'} />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Quarterly targets are derived from your annual revenue goal. Outstanding invoices worth {m(pnl.outstanding)} and unbilled time
          worth {m(pnl.unbilled)} still need to land to hit them.
        </p>
      </Card>

      <GoalModal goal={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function Sparkle(props) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

function GoalModal({ goal, onClose }) {
  const { addItem, updateItem, toast, settings } = useApp();
  const open = !!goal;
  const editing = !!goal?.id;
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!goal) return;
    setForm(
      goal.id
        ? { ...goal }
        : {
            title: '',
            category: 'revenue',
            metric: 'Invoiced revenue',
            target: 60000,
            current: 0,
            unit: 'EUR',
            deadline: `${yearOf(new Date())}-12-31`,
            status: 'on-track',
            notes: '',
            ...goal,
          },
    );
  }, [goal]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editing ? 'Edit goal' : 'New goal'}
      description="Make it measurable: a number, a unit and a deadline."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Check}
            disabled={!form.title || !form.target}
            onClick={async () => {
              if (editing) {
                await updateItem('goals', form.id, form, { debounce: 0 });
                toast('Goal updated');
              } else {
                await addItem('goals', form);
                toast('Goal created');
              }
              onClose();
            }}
          >
            {editing ? 'Save goal' : 'Create goal'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Goal" className="sm:col-span-2" required>
          <Input autoFocus value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Reach €96.000 revenue this year" />
        </Field>
        <Field label="Category">
          <Select
            value={form.category || 'revenue'}
            onChange={(e) => {
              const cat = CATEGORIES.find((c) => c.id === e.target.value);
              set('category', e.target.value);
              if (cat?.unit) set('unit', cat.unit);
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Metric" hint="What exactly are you measuring?">
          <Input value={form.metric || ''} onChange={(e) => set('metric', e.target.value)} placeholder="Invoiced revenue (ex VAT)" />
        </Field>
        <Field label="Target" required>
          <Input type="number" step="any" value={form.target ?? 0} onChange={(e) => set('target', Number(e.target.value))} />
        </Field>
        <Field label="Current">
          <Input type="number" step="any" value={form.current ?? 0} onChange={(e) => set('current', Number(e.target.value))} />
        </Field>
        <Field label="Unit">
          <Select value={form.unit || 'EUR'} onChange={(e) => set('unit', e.target.value)}>
            {[settings?.locale?.baseCurrency || 'EUR', 'hours', 'clients', 'invoices', 'projects', '%', 'cards'].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline">
          <Input type="date" value={form.deadline || ''} onChange={(e) => set('deadline', e.target.value)} />
        </Field>
        <Field label="Status" className="sm:col-span-2">
          <Segmented
            className="w-full"
            ariaLabel="Goal status"
            value={form.status || 'on-track'}
            onChange={(v) => set('status', v)}
            options={[
              { value: 'on-track', label: 'On track' },
              { value: 'at-risk', label: 'At risk' },
              { value: 'behind', label: 'Behind' },
              { value: 'completed', label: 'Done' },
            ]}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="How will you get there? Who is involved?" />
        </Field>
      </div>
    </Modal>
  );
}
