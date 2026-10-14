import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock3,
  Download,
  FileDown,
  Pause,
  Play,
  Plus,
  Receipt,
  Square,
  Timer as TimerIcon,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { addDays, cx, fmtDate, fmtDuration, fmtStopwatch, groupBy, isoOf, round2, sortBy, sum, todayISO, uid, weekStart } from '../lib/format';
import { timeWorkbook } from '../lib/excel';
import { reportPDF, savePdf } from '../lib/pdf';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  EmptyState,
  Field,
  IconButton,
  Input,
  KPI,
  MenuItem,
  Modal,
  MoneyInput,
  PageHeader,
  Pill,
  SectionTitle,
  Segmented,
  Select,
  Textarea,
  Toggle,
} from '../components/ui';

const TIMER_KEY = 'drips.running-timer';

export default function TimeTracker() {
  const app = useApp();
  const { collections, settings, clientMap, projectMap, addItem, updateItem, removeItem, toast, locale, baseCurrency } = app;
  const { m, compact } = useMoney();
  const [range, setRange] = useState('week');
  const [manualModal, setManualModal] = useState(false);
  const [running, setRunning] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(TIMER_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState({
    description: '',
    clientId: '',
    projectId: '',
    taskId: '',
    billable: true,
    rate: Number(settings?.defaults?.hourlyRate) || 85,
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running?.startedAt) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(intervalRef.current);
    }
    return undefined;
  }, [running?.startedAt]);

  useEffect(() => {
    try {
      if (running) localStorage.setItem(TIMER_KEY, JSON.stringify(running));
      else localStorage.removeItem(TIMER_KEY);
    } catch {
      /* noop */
    }
  }, [running]);

  const entries = collections.timeEntries || [];
  const tasks = collections.tasks || [];

  const elapsedMs = running?.startedAt && running?.running !== false ? Date.now() - running.startedAt + (running.accumulated || 0) : running?.accumulated || 0;
  void tick;

  const startTimer = () => {
    setRunning({ ...draft, startedAt: Date.now(), accumulated: 0, running: true });
    toast('Timer started');
  };
  const pauseTimer = () => {
    setRunning((r) => ({ ...r, accumulated: Date.now() - r.startedAt + (r.accumulated || 0), startedAt: Date.now(), running: false }));
  };
  const resumeTimer = () => setRunning((r) => ({ ...r, startedAt: Date.now(), running: true }));

  const stopTimer = async (save = true) => {
    if (!running) return;
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    if (save) {
      await addItem('timeEntries', {
        date: todayISO(),
        description: running.description || draft.description || 'Tracked session',
        clientId: running.clientId || '',
        projectId: running.projectId || '',
        taskId: running.taskId || '',
        minutes,
        billable: running.billable !== false,
        rate: running.billable === false ? 0 : Number(running.rate || settings?.defaults?.hourlyRate || 0),
        amount: running.billable === false ? 0 : round2((minutes / 60) * Number(running.rate || 0)),
        currency: baseCurrency,
        invoiced: false,
        start: new Date(Date.now() - elapsedMs).toISOString(),
        end: new Date().toISOString(),
      });
      toast(`${fmtDuration(minutes)} logged${running.billable === false ? ' (non-billable)' : ` · ${m(round2((minutes / 60) * Number(running.rate || 0)))} billable`}`);
    }
    setRunning(null);
  };

  /* ------------------------------ date ranges ------------------------------ */
  const inRange = (iso) => {
    const d = String(iso).slice(0, 10);
    const today = todayISO();
    if (range === 'today') return d === today;
    if (range === 'week') return d >= isoOf(weekStart()) && d <= today;
    if (range === 'month') return d.slice(0, 7) === today.slice(0, 7);
    return true;
  };
  const scoped = sortBy(entries.filter((e) => inRange(e.date || e.createdAt)), (e) => e.date || e.createdAt, -1);

  const totalMinutes = sum(scoped, (e) => Number(e.minutes) || 0);
  const billableMinutes = sum(scoped.filter((e) => e.billable), (e) => Number(e.minutes) || 0);
  const value = round2(sum(scoped.filter((e) => e.billable), (e) => Number(e.amount) || 0));
  const unbilled = entries.filter((e) => e.billable && !e.invoiced);
  const unbilledValue = round2(sum(unbilled, (e) => Number(e.amount) || 0));
  const unbilledMinutes = sum(unbilled, (e) => Number(e.minutes) || 0);

  const byDay = useMemo(() => {
    const days = range === 'today' ? [todayISO()] : range === 'week' ? Array.from({ length: 7 }, (_, i) => isoOf(addDays(weekStart().toISOString().slice(0, 10), i))) : Array.from({ length: 30 }, (_, i) => isoOf(addDays(todayISO(), i - 29)));
    return days.map((d) => ({
      date: d,
      label: fmtDate(d, locale, { weekday: range === 'month' ? undefined : 'short', day: '2-digit', month: range === 'month' ? 'short' : undefined }),
      hours: round2(sum(entries.filter((e) => String(e.date).slice(0, 10) === d), (e) => (Number(e.minutes) || 0) / 60)),
      billable: round2(sum(entries.filter((e) => String(e.date).slice(0, 10) === d && e.billable), (e) => (Number(e.minutes) || 0) / 60)),
    }));
  }, [entries, range, locale]);

  const byClient = useMemo(() => {
    const groups = groupBy(scoped, (e) => clientMap[e.clientId]?.company || (e.projectId ? projectMap[e.projectId]?.name : null) || 'Internal / no client');
    return Object.entries(groups)
      .map(([name, list]) => ({
        name,
        hours: round2(sum(list, (e) => (Number(e.minutes) || 0) / 60)),
        value: round2(sum(list.filter((e) => e.billable), (e) => Number(e.amount) || 0)),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [scoped, clientMap, projectMap]);

  const exportExcel = () => {
    const name = timeWorkbook({ timeEntries: scoped, clients: collections.clients || [], projects: collections.projects || [], tasks, currency: baseCurrency });
    toast(`Timesheet exported: ${name}`);
  };

  const exportPdf = () => {
    const doc = reportPDF({
      title: `Timesheet · ${range}`,
      subtitle: `${settings?.business?.name || 'Your business'} · ${fmtDate(todayISO(), locale)} · ${round2(totalMinutes / 60)} h tracked, ${round2(billableMinutes / 60)} h billable`,
      settings,
      sections: [
        { title: 'Summary', kv: [['Total hours', `${round2(totalMinutes / 60)} h`], ['Billable hours', `${round2(billableMinutes / 60)} h`], ['Billable value', m(value)], ['Unbilled (all time)', `${round2(unbilledMinutes / 60)} h · ${m(unbilledValue)}`]] },
        {
          title: 'Per client',
          table: { head: ['Client / project', 'Hours', 'Value'], body: byClient.map((c) => [c.name, `${c.hours} h`, m(c.value)]), numericColumns: [1, 2] },
        },
        {
          title: 'Entries',
          table: {
            head: ['Date', 'Description', 'Client', 'Hours', 'Billable', 'Amount'],
            body: scoped.map((e) => [
              fmtDate(e.date, locale),
              e.description,
              clientMap[e.clientId]?.company || '—',
              `${fmtDuration(e.minutes)} h`,
              e.billable ? 'yes' : 'no',
              e.billable ? m(e.amount, e.currency) : '—',
            ]),
            numericColumns: [3, 5],
          },
        },
      ],
    });
    savePdf(doc, `DRIPS-timesheet-${range}-${todayISO()}`);
    toast('Timesheet PDF downloaded');
  };

  const invoiceUnbilled = async () => {
    if (!unbilled.length) {
      toast('Nothing unbilled to invoice', 'error');
      return;
    }
    const groups = groupBy(unbilled, (e) => e.clientId || 'none');
    const [clientId, list] = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)[0];
    const byDescription = groupBy(list, (e) => e.description || 'Tracked work');
    const items = Object.entries(byDescription).map(([description, rows]) => {
      const hours = round2(sum(rows, (e) => (Number(e.minutes) || 0) / 60));
      const rate = Number(rows[0].rate || settings?.defaults?.hourlyRate || 0);
      return { id: uid('it'), description, detail: `${rows.length} time entries`, qty: hours, unit: 'hours', rate };
    });
    const invoice = await addItem('invoices', {
      clientId: clientId === 'none' ? '' : clientId,
      status: 'draft',
      currency: baseCurrency,
      issueDate: todayISO(),
      dueDate: isoOf(addDays(todayISO(), Number(settings?.defaults?.paymentTermsDays) || 14)),
      items,
      taxRate: Number(settings?.tax?.vatRate ?? 21),
      discount: { type: 'percent', value: 0 },
      payments: [],
      paidAmount: 0,
      notes: `Billed from ${list.length} tracked time entries`,
      terms: settings?.defaults?.proposalTerms || '',
    });
    await Promise.all(list.map((e) => updateItem('timeEntries', e.id, { invoiced: true, invoiceId: invoice.id }, { debounce: 0 })));
    toast(`Invoice ${invoice.number} created from ${list.length} unbilled entries`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Time"
        title="Time Tracker"
        subtitle="Start a timer on any client or project, keep your timesheet honest and turn unbilled hours into an invoice in one click."
        icon={TimerIcon}
        actions={
          <>
            <Dropdown trigger={<Button variant="outline" icon={Download}>Export</Button>}>
              <MenuItem icon={FileDown} onClick={exportExcel}>
                Timesheet (Excel)
              </MenuItem>
              <MenuItem icon={Receipt} onClick={exportPdf}>
                Timesheet (PDF)
              </MenuItem>
            </Dropdown>
            <Button variant="outline" icon={Plus} onClick={() => setManualModal(true)}>
              Add manual entry
            </Button>
            <Button variant="primary" icon={Wallet} onClick={invoiceUnbilled} disabled={!unbilled.length}>
              Invoice unbilled ({round2(unbilledMinutes / 60)} h)
            </Button>
          </>
        }
      />

      {/* timer */}
      <Card className={cx('pad relative overflow-hidden', running && 'border-[var(--color-flag-700)]')}>
        {running && <div aria-hidden className="absolute inset-x-0 top-0 h-1 flag-gradient animate-pulse" />}
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="What are you working on?" className="sm:col-span-2">
              <Input
                value={running ? running.description || '' : draft.description}
                onChange={(e) => (running ? setRunning({ ...running, description: e.target.value }) : setDraft({ ...draft, description: e.target.value }))}
                placeholder="Hi-fi signup screens for Havenlab"
                disabled={!!running && running.running}
              />
            </Field>
            <Field label="Client">
              <Select
                value={running ? running.clientId || '' : draft.clientId}
                onChange={(e) => {
                  const clientId = e.target.value;
                  const project = (collections.projects || []).find((p) => p.clientId === clientId);
                  const rate = clientMap[clientId]?.hourlyRate || draft.rate;
                  if (running) setRunning({ ...running, clientId, projectId: project?.id || running.projectId, rate });
                  else setDraft({ ...draft, clientId, projectId: project?.id || '', rate });
                }}
                disabled={!!running && running.running}
              >
                <option value="">— Internal —</option>
                {(collections.clients || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project">
              <Select
                value={running ? running.projectId || '' : draft.projectId}
                onChange={(e) => (running ? setRunning({ ...running, projectId: e.target.value }) : setDraft({ ...draft, projectId: e.target.value }))}
                disabled={!!running && running.running}
              >
                <option value="">— None —</option>
                {(collections.projects || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <p className="tnum font-display text-4xl font-extrabold leading-none tracking-tight" role="timer" aria-live="off">
              {fmtStopwatch(elapsedMs)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="number"
                  min="0"
                  step="5"
                  className="input tnum !w-24 !py-1"
                  value={running ? running.rate || 0 : draft.rate}
                  onChange={(e) => (running ? setRunning({ ...running, rate: Number(e.target.value) }) : setDraft({ ...draft, rate: Number(e.target.value) }))}
                  aria-label="Hourly rate"
                  disabled={!!running && running.billable === false}
                />
                {baseCurrency}/h
              </label>
              <Toggle
                checked={running ? running.billable !== false : draft.billable}
                onChange={(v) => (running ? setRunning({ ...running, billable: v }) : setDraft({ ...draft, billable: v }))}
                label="Billable"
              />
              {!running ? (
                <Button variant="primary" icon={Play} onClick={startTimer} disabled={!draft.description}>
                  Start timer
                </Button>
              ) : running.running ? (
                <>
                  <Button variant="outline" icon={Pause} onClick={pauseTimer}>
                    Pause
                  </Button>
                  <Button variant="primary" icon={Square} onClick={() => stopTimer(true)}>
                    Stop & save
                  </Button>
                  <Button variant="ghost" onClick={() => stopTimer(false)}>
                    Discard
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" icon={Play} onClick={resumeTimer}>
                    Resume
                  </Button>
                  <Button variant="primary" icon={Square} onClick={() => stopTimer(true)}>
                    Stop & save
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {running ? 'Timer survives a page refresh — it is stored in this browser.' : 'The timer keeps running if you switch tabs or refresh.'}
            </p>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPI label={`Hours (${range})`} value={`${round2(totalMinutes / 60)} h`} icon={Clock3} tone="brand" hint={`${scoped.length} entries`} />
        <KPI label="Billable" value={`${round2(billableMinutes / 60)} h`} icon={TrendingUp} tone="mint" hint={`${totalMinutes ? Math.round((billableMinutes / totalMinutes) * 100) : 0}% of tracked time`} />
        <KPI label={`Value (${range})`} value={compact(value)} icon={Wallet} tone="flag" hint="At the rates you set per entry" />
        <KPI label="Unbilled" value={compact(unbilledValue)} icon={Receipt} tone="amber" hint={`${round2(unbilledMinutes / 60)} h waiting to be invoiced`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] p-3">
            <SectionTitle className="!mb-0">Timesheet</SectionTitle>
            <Segmented
              size="sm"
              ariaLabel="Time range"
              value={range}
              onChange={setRange}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
          {scoped.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Clock3}
                title={`No time tracked in this ${range}`}
                description="Start the timer above or add a manual entry — your hours feed invoices, utilisation and the tax estimator."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setManualModal(true)}>
                    Add manual entry
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Client / project</th>
                    <th scope="col" className="num">Hours</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scoped.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{fmtDate(e.date, locale)}</td>
                      <td className="max-w-[16rem]">
                        <span className="block truncate font-semibold">{e.description}</span>
                        {e.start && e.end && <span className="block text-[0.68rem] text-[var(--text-muted)]">{fmtDate(e.start, locale, { hour: '2-digit', minute: '2-digit' })} → {fmtDate(e.end, locale, { hour: '2-digit', minute: '2-digit' })}</span>}
                      </td>
                      <td className="max-w-[12rem] truncate text-xs">{clientMap[e.clientId]?.company || projectMap[e.projectId]?.name || '—'}</td>
                      <td className="num whitespace-nowrap font-semibold">{fmtDuration(e.minutes)}</td>
                      <td className="num whitespace-nowrap">{e.billable ? m(e.amount, e.currency) : '—'}</td>
                      <td>
                        {e.billable ? (
                          e.invoiced ? <Pill tone="green">invoiced</Pill> : <Pill tone="amber">unbilled</Pill>
                        ) : (
                          <Pill>non-billable</Pill>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton
                            icon={Check}
                            label={e.billable ? `Mark ${e.description} non-billable` : `Mark ${e.description} billable`}
                            size="sm"
                            onClick={() => updateItem('timeEntries', e.id, { billable: !e.billable, amount: !e.billable ? round2(((e.minutes || 0) / 60) * Number(e.rate || settings?.defaults?.hourlyRate || 0)) : 0 })}
                          />
                          <IconButton icon={Trash2} label={`Delete ${e.description}`} size="sm" onClick={() => { if (window.confirm('Delete this time entry?')) removeItem('timeEntries', e.id); }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="pad">
            <SectionTitle>Hours per day</SectionTitle>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay} margin={{ top: 6, right: 6, left: -26, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--text-muted)" interval={range === 'month' ? 3 : 0} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
                  <Tooltip contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${v} h`]} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {byDay.map((d) => (
                      <Cell key={d.date} fill={d.hours >= 6 ? '#12A06A' : d.hours >= 3 ? '#21468B' : d.hours > 0 ? '#8AA0C8' : 'var(--line)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Target: 6 h billable per working day · this {range}: {round2(billableMinutes / 60)} h
            </p>
          </Card>

          <Card className="pad">
            <SectionTitle>Where the hours went</SectionTitle>
            {byClient.length ? (
              <ul className="space-y-2.5">
                {byClient.map((c) => (
                  <li key={c.name}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold">{c.name}</span>
                      <span className="tnum shrink-0 text-[var(--text-muted)]">
                        {c.hours} h · {m(c.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
                      <div className="h-full rounded-full bg-[var(--color-brand-600)]" style={{ width: `${(c.hours / Math.max(...byClient.map((x) => x.hours), 1)) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Nothing tracked in this period yet.</p>
            )}
          </Card>

          <Card className="pad">
            <SectionTitle action={<Button size="sm" variant="outline" icon={Receipt} onClick={invoiceUnbilled} disabled={!unbilled.length}>Invoice now</Button>}>
              Unbilled time
            </SectionTitle>
            {unbilled.length ? (
              <>
                <p className="tnum font-display text-2xl font-extrabold">{m(unbilledValue)}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {round2(unbilledMinutes / 60)} h across {unbilled.length} entries ·{' '}
                  {new Set(unbilled.map((e) => e.clientId).filter(Boolean)).size} client(s)
                </p>
                <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs">
                  {sortBy(unbilled, (e) => e.date, -1)
                    .slice(0, 12)
                    .map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">{fmtDate(e.date, locale)} · {e.description}</span>
                        <span className="tnum shrink-0 font-semibold">{m(e.amount, e.currency)}</span>
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Everything billable is invoiced. 🎉</p>
            )}
          </Card>

          <Card className="pad">
            <SectionTitle action={<CalendarClock className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />}>This week</SectionTitle>
            <ul className="space-y-1.5 text-xs">
              {Array.from({ length: 7 }, (_, i) => isoOf(addDays(weekStart().toISOString().slice(0, 10), i))).map((d) => {
                const list = entries.filter((e) => String(e.date).slice(0, 10) === d);
                return (
                  <li key={d} className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{fmtDate(d, locale, { weekday: 'long' })}</span>
                    <span className="tnum text-[var(--text-muted)]">{list.length ? `${round2(sum(list, (e) => (e.minutes || 0) / 60))} h` : '—'}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <ManualEntryModal open={manualModal} onClose={() => setManualModal(false)} />
    </>
  );
}

function ManualEntryModal({ open, onClose }) {
  const { collections, settings, addItem, toast, baseCurrency } = useApp();
  const [form, setForm] = useState({});

  useMemo(() => {
    if (!open) return;
    setForm({
      date: todayISO(),
      description: '',
      clientId: '',
      projectId: '',
      minutes: 60,
      billable: true,
      rate: Number(settings?.defaults?.hourlyRate) || 85,
      currency: baseCurrency,
      invoiced: false,
      notes: '',
    });
  }, [open]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const amount = form.billable ? round2(((Number(form.minutes) || 0) / 60) * Number(form.rate || 0)) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a manual time entry"
      description="For work you forgot to track — meetings, travel or a day you billed as a block."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Check}
            disabled={!form.description}
            onClick={async () => {
              await addItem('timeEntries', { ...form, amount, minutes: Number(form.minutes) || 0 });
              toast(`${fmtDuration(form.minutes)} logged`);
              onClose();
            }}
          >
            Save entry
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Description" className="sm:col-span-2" required>
          <Input autoFocus value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Workshop with the client team" />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Duration (minutes)" hint="Use 15-minute steps for a tidy timesheet.">
          <Input type="number" min="0" step="15" value={form.minutes ?? 60} onChange={(e) => set('minutes', Number(e.target.value))} />
        </Field>
        <Field label="Client">
          <Select value={form.clientId || ''} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">— Internal —</option>
            {(collections.clients || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.company || c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project">
          <Select value={form.projectId || ''} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">— None —</option>
            {(collections.projects || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hourly rate">
          <MoneyInput value={form.rate || 0} onChange={(v) => set('rate', v)} currency={form.currency} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-3">
        <Checkbox checked={!!form.billable} onChange={(v) => set('billable', v)} label="Billable to the client" />
        <p className="tnum text-sm font-bold">{m(amount, form.currency)}</p>
      </div>
    </Modal>
  );
}
