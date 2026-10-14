import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Kanban,
  PiggyBank,
  Plus,
  Receipt,
  Target,
  Timer,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { useAlerts } from '../components/NotificationsBell';
import { Button, Card, EmptyState, KPI, PageHeader, Pill, Progress, SectionTitle, StatusPill } from '../components/ui';
import { cx, daysBetween, fmtDate, monthLabel, quarterOf, relTime, round2, todayISO, yearOf } from '../lib/format';
import { boardStats, invoiceState, monthlySeries, pipelineSummary, profitAndLoss, utilisation } from '../lib/metrics';
import { resolveProfile, vatDeadline } from '../lib/tax';

const PIE_COLORS = ['#AE1C28', '#21468B', '#12A06A', '#D9930B', '#5B3FA8', '#0E7C66', '#8AA0C8'];

export default function Dashboard() {
  const { collections, settings, baseCurrency, locale, clientMap, loadDemo } = useApp();
  const { m, mb, compact } = useMoney();
  const alerts = useAlerts();
  const today = new Date();
  const year = yearOf(today);
  const quarter = quarterOf(today);

  const pnl = profitAndLoss(collections, year, baseCurrency, settings?.rates);
  const series = monthlySeries(collections, 12, baseCurrency, settings?.rates);
  const pipeline = pipelineSummary(collections.proposals || [], baseCurrency, settings?.rates);
  const util = utilisation(collections.timeEntries || [], 30);
  const profile = resolveProfile(settings);
  const vatDue = vatDeadline(profile, year, quarter);
  const activeSprint = (collections.sprints || []).find((s) => s.status === 'active') || (collections.sprints || [])[0];
  const sprint = activeSprint ? boardStats(collections.tasks || [], activeSprint.id) : boardStats(collections.tasks || [], '');

  const quarterRevenue = series
    .filter((s) => yearOf(`${s.key}-01`) === year && Math.floor(Number(s.key.slice(5)) / 3) + 1 === quarter)
    .reduce((acc, s) => acc + s.revenue, 0);
  const quarterProfit = series
    .filter((s) => yearOf(`${s.key}-01`) === year && Math.floor(Number(s.key.slice(5)) / 3) + 1 === quarter)
    .reduce((acc, s) => acc + s.profit, 0);
  const advisedSetAside = round2(pnl.profit * 0.34);

  const pieData = Object.entries(pipeline.byStatus).map(([status, v]) => ({ name: status, value: v.value, count: v.count }));
  const overdue = (collections.invoices || []).filter((i) => invoiceState(i) === 'overdue');

  const hasData =
    (collections.invoices || []).length + (collections.proposals || []).length + (collections.tasks || []).length > 0;

  return (
    <>
      <PageHeader
        eyebrow={`${fmtDate(today, locale, { weekday: 'long', day: 'numeric', month: 'long' })} · Q${quarter} ${year}`}
        title={`Goedemorgen${settings?.business?.owner ? `, ${settings.business.owner.split(' ')[0]}` : ''} 👋`}
        subtitle="Here is the state of your business: money in, money out, what the tax office expects and what the team is shipping this sprint."
        icon={TrendingUp}
        actions={
          <>
            <Button as={Link} to="/app/proposals/new" variant="primary" icon={FileText}>
              New proposal
            </Button>
            <Button as={Link} to="/app/invoices?new=1" variant="outline" icon={Receipt}>
              New invoice
            </Button>
          </>
        }
      />

      {!hasData && (
        <Card className="pad mb-5 flex flex-col gap-4 border-[var(--color-brand-200)] bg-[color-mix(in_srgb,var(--color-brand-500)_6%,transparent)] md:flex-row md:items-center">
          <span className="flag-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white">
            <Sparkle />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold">Your workspace is empty — start with a full example quarter</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Load the demo dataset (a Rotterdam design studio: clients, proposals, invoices, expenses, sprints and
              goals) to see every module working, or start clean and add your own.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="grad" icon={Sparkle} onClick={() => loadDemo().catch(() => {})}>
              Load demo data
            </Button>
            <Button as={Link} to="/app/settings" variant="outline">
              Add my business
            </Button>
          </div>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPI
          label={`Revenue ${year}`}
          value={compact(pnl.revenue)}
          icon={CircleDollarSign}
          tone="brand"
          hint={`Q${quarter} so far: ${m(quarterRevenue)}`}
        >
          <div className="mt-3 flex items-end gap-1" aria-hidden>
            {series.slice(-6).map((s) => (
              <span
                key={s.key}
                className="flex-1 rounded-t bg-[color-mix(in_srgb,var(--color-brand-600)_70%,transparent)]"
                style={{ height: `${Math.max(4, (s.revenue / Math.max(...series.map((x) => x.revenue), 1)) * 34)}px` }}
              />
            ))}
          </div>
        </KPI>
        <KPI
          label="Outstanding"
          value={compact(pnl.outstanding)}
          icon={Wallet}
          tone={overdue.length ? 'flag' : 'mint'}
          hint={overdue.length ? `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} overdue` : 'Nothing overdue 🎉'}
        />
        <KPI
          label="Tax set-aside (advised)"
          value={compact(advisedSetAside)}
          icon={PiggyBank}
          tone="amber"
          hint={`≈34% of ${m(pnl.profit)} profit${vatDue ? ` · VAT Q${quarter} due ${fmtDate(String(vatDue).slice(0, 10), locale)}` : ''}`}
        />
        <KPI
          label="Billable utilisation"
          value={`${util.rate}%`}
          icon={Timer}
          tone="mint"
          hint={`${round2(util.billable)}h billable of ${round2(util.total)}h tracked (30 days)`}
        />
      </div>

      {/* charts */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="pad">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Revenue vs costs</h2>
              <p className="text-xs text-[var(--text-muted)]">Last 12 months · converted to {baseCurrency}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-600)]" aria-hidden /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-flag-700)]" aria-hidden /> Costs
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-mint-500)]" aria-hidden /> Profit
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#21468B" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#21468B" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12A06A" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#12A06A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="key" tickFormatter={(k) => monthLabel(k, locale)} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis tickFormatter={(v) => compact(v)} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={64} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(k) => monthLabel(k, locale)}
                  formatter={(value, name) => [m(value), name]}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#21468B" strokeWidth={2.2} fill="url(#rev)" />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#12A06A" strokeWidth={2.2} fill="url(#prof)" />
                <Area type="monotone" dataKey="expenses" name="Costs" stroke="#AE1C28" strokeWidth={2} fill="none" strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="pad flex flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Proposal pipeline</h2>
            <Link to="/app/proposals" className="text-xs font-semibold text-[var(--color-brand-600)] hover:underline">
              Open
            </Link>
          </div>
          {pieData.length ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="none">
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }}
                      formatter={(value, name) => [m(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {pieData.map((d, i) => (
                  <li key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden />
                    <span className="flex-1 capitalize">{d.name}</span>
                    <span className="tnum font-semibold">{mb(d.value)}</span>
                    <span className="text-[var(--text-muted)]">· {d.count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--text-muted)]">
                Win rate <strong className="text-[var(--text)]">{pipeline.winRate}%</strong> · average won deal{' '}
                <strong className="text-[var(--text)]">{mb(pipeline.avgDeal)}</strong>
              </p>
            </>
          ) : (
            <EmptyState
              className="flex-1 border-0 py-8"
              icon={FileText}
              title="No proposals yet"
              description="Create your first branded proposal — it feeds this pipeline automatically."
              action={
                <Button as={Link} to="/app/proposals/new" variant="primary" icon={Plus}>
                  New proposal
                </Button>
              }
            />
          )}
        </Card>
      </div>

      {/* sprint + alerts + goals */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="pad">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Kanban className="h-4 w-4 text-[var(--color-brand-600)]" aria-hidden />
              {activeSprint ? activeSprint.name : 'Board overview'}
            </h2>
            <Link to="/app/board" className="text-xs font-semibold text-[var(--color-brand-600)] hover:underline">
              Open board
            </Link>
          </div>
          {activeSprint ? (
            <>
              <p className="text-xs text-[var(--text-muted)]">
                {activeSprint.goal} · {fmtDate(activeSprint.startDate, locale)} → {fmtDate(activeSprint.endDate, locale)}
              </p>
              <Progress className="mt-3" value={sprint.donePoints} max={Math.max(1, sprint.totalPoints)} label="Sprint points" tone="flag" />
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                {[
                  ['Committed', `${sprint.totalPoints} pts`],
                  ['Done', `${sprint.donePoints} pts`],
                  ['In progress', `${sprint.byColumn.doing.length} cards`],
                  ['Past due', `${sprint.overdue} cards`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-[var(--line)] py-2.5">
                    <p className="tnum text-sm font-extrabold">{v}</p>
                    <p className="mt-0.5 text-[0.68rem] uppercase tracking-wide text-[var(--text-muted)]">{k}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={['backlog', 'todo', 'doing', 'review', 'done'].map((c) => ({ column: c, points: sprint.points(sprint.byColumn[c]) }))} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="column" tick={{ fontSize: 9 }} stroke="var(--text-muted)" />
                    <YAxis tick={{ fontSize: 9 }} stroke="var(--text-muted)" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'color-mix(in srgb, var(--text) 5%, transparent)' }} />
                    <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                      {['backlog', 'todo', 'doing', 'review', 'done'].map((c) => (
                        <Cell key={c} fill={{ backlog: '#8AA0C8', todo: '#21468B', doing: '#AE1C28', review: '#D9930B', done: '#12A06A' }[c]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <EmptyState
              className="border-0 py-6"
              icon={Kanban}
              title="No sprint running"
              description="Plan a sprint on the board to see burndown and capacity here."
              action={
                <Button as={Link} to="/app/board" variant="outline">
                  Open project board
                </Button>
              }
            />
          )}
        </Card>

        <Card className="pad">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CalendarClock className="h-4 w-4 text-[var(--color-flag-700)]" aria-hidden /> Deadlines & alerts
            </h2>
            <span className="chip">{alerts.filter((a) => a.id !== 'clear').length} active</span>
          </div>
          <ul className="space-y-2">
            {alerts.slice(0, 5).map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.id}>
                  <Link
                    to={a.to}
                    className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] p-2.5 transition-colors hover:border-[var(--color-brand-300)]"
                  >
                    <span
                      className={cx(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white',
                        { red: 'bg-flag-700', amber: 'bg-[var(--color-amber-brand-500)]', blue: 'bg-[var(--color-brand-600)]', green: 'bg-[var(--color-mint-500)]' }[a.tone],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.82rem] font-semibold leading-snug">{a.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{a.detail}</span>
                    </span>
                    <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="pad">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Target className="h-4 w-4 text-[var(--color-mint-500)]" aria-hidden /> Goals & targets
            </h2>
            <Link to="/app/goals" className="text-xs font-semibold text-[var(--color-brand-600)] hover:underline">
              All goals
            </Link>
          </div>
          {(collections.goals || []).length ? (
            <ul className="space-y-3.5">
              {(collections.goals || []).slice(0, 4).map((g) => {
                const p = g.target ? (g.current / g.target) * 100 : 0;
                const days = g.deadline ? daysBetween(g.deadline, todayISO()) : null;
                return (
                  <li key={g.id}>
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="text-[0.82rem] font-semibold leading-snug">{g.title}</p>
                      <StatusPill status={g.status || 'on-track'} />
                    </div>
                    <Progress
                      value={Math.min(g.current, g.target)}
                      max={g.target}
                      tone={p >= 75 ? 'mint' : p >= 40 ? 'brand' : 'amber'}
                      showValue={false}
                    />
                    <p className="mt-1 flex items-center justify-between text-[0.7rem] text-[var(--text-muted)]">
                      <span className="tnum">
                        {g.unit === 'EUR' ? mb(g.current) : round2(g.current)} / {g.unit === 'EUR' ? mb(g.target) : g.target} {g.unit !== 'EUR' ? g.unit : ''}
                      </span>
                      {days !== null && <span>{days > 0 ? `${days} days left` : 'past deadline'}</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState className="border-0 py-6" icon={Target} title="No goals yet" description="Set a revenue, utilisation or savings target to track it here." action={<Button as={Link} to="/app/goals?new=1" variant="outline">Add a goal</Button>} />
          )}
        </Card>
      </div>

      {/* money + activity */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">Money movement</h2>
            <div className="flex gap-2">
              <Button as={Link} to="/app/invoices" size="sm" variant="outline" icon={Receipt}>
                Invoices
              </Button>
              <Button as={Link} to="/app/invoices?tab=books" size="sm" variant="outline">
                Books
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Collected', pnl.collected, 'mint'],
              ['Outstanding', pnl.outstanding, 'amber'],
              ['Unbilled time', pnl.unbilled, 'flag'],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-[var(--line)] p-3">
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                <p className="tnum mt-1 font-display text-xl font-extrabold">{compact(value)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
                  <div
                    className={cx('h-full rounded-full', { mint: 'bg-[var(--color-mint-500)]', amber: 'bg-[var(--color-amber-brand-500)]', flag: 'bg-[var(--color-flag-700)]' }[tone])}
                    style={{ width: `${Math.min(100, (value / Math.max(pnl.revenue, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <SectionTitle className="mt-5">Latest invoices</SectionTitle>
          {(collections.invoices || []).length ? (
            <div className="-mx-1 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Client</th>
                    <th scope="col">Due</th>
                    <th scope="col" className="num">Total</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(collections.invoices || []).slice(0, 6).map((i) => (
                    <tr key={i.id}>
                      <td className="font-mono text-xs font-semibold">{i.number}</td>
                      <td className="max-w-[10rem] truncate">{clientMap[i.clientId]?.company || '—'}</td>
                      <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{fmtDate(i.dueDate, locale)}</td>
                      <td className="num font-semibold">{m(i.total, i.currency)}</td>
                      <td>
                        <StatusPill status={invoiceState(i)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No invoices yet.</p>
          )}
        </Card>

        <div className="grid gap-4">
          <Card className="pad">
            <SectionTitle>Profit & loss {year}</SectionTitle>
            <ul className="space-y-2 text-sm">
              {[
                ['Revenue (ex VAT)', pnl.revenue],
                ['Operating costs', -pnl.costs],
                ['Net profit', pnl.profit],
              ].map(([label, value], i) => (
                <li key={label} className={cx('flex items-center justify-between gap-3', i === 2 && 'border-t border-[var(--line)] pt-2 font-bold')}>
                  <span className={i === 2 ? '' : 'text-[var(--text-muted)]'}>{label}</span>
                  <span className={cx('tnum', value < 0 && 'text-flag-700')}>{m(value)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Margin <strong className="text-[var(--text)]">{pnl.margin}%</strong> · VAT to pay{' '}
              <strong className="text-[var(--text)]">{m(pnl.vatCollected - pnl.vatPaid)}</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="blue" icon={CheckCircle2}>
                {pnl.margin > 45 ? 'Healthy margin' : 'Watch your margin'}
              </Pill>
              <Pill tone="amber" icon={Wallet}>
                Q{quarter} reserve advice: {m(Math.max(0, round2(quarterProfit * 0.34)))}
              </Pill>
            </div>
          </Card>

          <Card className="pad">
            <SectionTitle action={<Link to="/app/board" className="text-xs font-semibold text-[var(--color-brand-600)] hover:underline">Board</Link>}>
              Recent activity
            </SectionTitle>
            {(collections.activity || []).length ? (
              <ol className="relative space-y-3 border-l border-[var(--line)] pl-4">
                {(collections.activity || []).slice(0, 7).map((a) => (
                  <li key={a.id} className="relative">
                    <span
                      aria-hidden
                      className={cx(
                        'absolute -left-[1.32rem] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-card)]',
                        a.type === 'accept' || a.type === 'payment' ? 'bg-[var(--color-mint-500)]' : a.type === 'delete' ? 'bg-flag-700' : 'bg-[var(--color-brand-600)]',
                      )}
                    />
                    <p className="text-[0.82rem] leading-snug">{a.message}</p>
                    <p className="mt-0.5 text-[0.7rem] text-[var(--text-muted)]">{relTime(a.ts, locale)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Activity from proposals, invoices and payments shows up here.</p>
            )}
          </Card>
        </div>
      </div>

      {/* quick links */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/app/proposals/new', icon: FileText, title: 'Send a proposal', text: 'Branded PDF or signable link' },
          { to: '/app/time', icon: Timer, title: 'Track time', text: 'Start the timer on a client' },
          { to: '/app/tax?new=1', icon: Wallet, title: 'Log an expense', text: 'Keep your VAT reclaim complete' },
          { to: '/app/board', icon: Kanban, title: 'Plan the sprint', text: 'Drag cards, set story points' },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="card pad group flex items-center gap-3 transition-shadow hover:shadow-[var(--shadow-pop)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-brand-600)_10%,transparent)] text-[var(--color-brand-600)] transition-transform group-hover:scale-105">
              <q.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{q.title}</span>
              <span className="block truncate text-xs text-[var(--text-muted)]">{q.text}</span>
            </span>
            <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        Amounts are shown in {baseCurrency}; documents in other currencies are converted at your reference rates. Tax
        figures use {profile.label}.
      </p>
    </>
  );
}

function Sparkle(props) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}
