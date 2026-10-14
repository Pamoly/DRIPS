import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Check,
  Download,
  FileDown,
  Filter,
  Info,
  PiggyBank,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { addDays, cx, fmtDate, fmtMoney, quarterOf, round2, sortBy, sum, todayISO, yearOf } from '../lib/format';
import { computeTax, computeVatQuarter, QUARTERS, recommendedSetAside, resolveProfile, TAX_PROFILES, vatDeadline, VAT_RATES } from '../lib/tax';
import { invoiceState } from '../lib/metrics';
import { taxWorkbook } from '../lib/excel';
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
  Progress,
  SectionTitle,
  Segmented,
  Select,
  Textarea,
  Toggle,
} from '../components/ui';

export const EXPENSE_CATEGORIES = [
  'Software & subscriptions',
  'Hardware & equipment',
  'Home office',
  'Travel & transport',
  'Marketing & sales',
  'Professional services',
  'Insurance',
  'Bank & payment fees',
  'Telephone & internet',
  'Education',
  'Meals & representation',
  'Office supplies',
  'Subcontractors',
  'Other',
];

const MIXED_CATEGORIES = ['Meals & representation'];
const MIXED_DEDUCTIBLE_RATE = 0.735; // NL: 26,5% threshold on food & representation
const PIE = ['#AE1C28', '#21468B', '#12A06A', '#D9930B', '#5B3FA8', '#0E7C66', '#8AA0C8', '#B26A00', '#7A8CA8'];

export default function TaxExpenses() {
  const app = useApp();
  const { collections, settings, baseCurrency, locale, rates, updateSettings, addItem, updateItem, removeItem, toast, clientMap, projectMap } = app;
  const { m, mb, compact } = useMoney();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('estimator');
  const [year, setYear] = useState(yearOf(new Date()));
  const [expenseModal, setExpenseModal] = useState(params.get('new') === '1' ? {} : null);
  const [editing, setEditing] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [quarterFilter, setQuarterFilter] = useState('all');
  const [missingReceipts, setMissingReceipts] = useState(false);

  const profile = resolveProfile(settings);
  const invoices = collections.invoices || [];
  const expenses = collections.expenses || [];
  const timeEntries = collections.timeEntries || [];

  const overrides = settings?.tax?.quarterOverrides?.[year] || {};

  /* ------------------------------- quarters -------------------------------- */
  const quarters = useMemo(() => {
    return QUARTERS.map((q) => {
      const qInvoices = invoices.filter(
        (i) => ['sent', 'paid', 'partly-paid', 'overdue'].includes(invoiceState(i)) && yearOf(i.issueDate) === year && quarterOf(i.issueDate) === q,
      );
      const qExpenses = expenses.filter((e) => yearOf(e.date) === year && quarterOf(e.date) === q);
      const derivedRevenue = round2(qInvoices.reduce((s, i) => s + mb(Number(i.net) || 0, i.currency), 0));
      const derivedCosts = round2(qExpenses.reduce((s, e) => s + deductibleAmount(e, settings) * (e.currency === baseCurrency ? 1 : 1), 0));
      const ov = overrides[q] || {};
      const revenue = ov.revenue !== undefined && ov.revenue !== null ? Number(ov.revenue) : derivedRevenue;
      const costs = ov.costs !== undefined && ov.costs !== null ? Number(ov.costs) : derivedCosts;
      const vat = computeVatQuarter({
        invoices,
        expenses,
        year,
        quarter: q,
        regime: settings?.tax?.vatRegime || 'standard',
      });
      return {
        quarter: q,
        derivedRevenue,
        derivedCosts,
        revenue,
        costs,
        profit: round2(revenue - costs),
        manual: ov.revenue !== undefined || ov.costs !== undefined,
        invoices: qInvoices.length,
        expensesCount: qExpenses.length,
        vat,
        deadline: vatDeadline(profile, year, q),
      };
    });
  }, [invoices, expenses, year, overrides, settings, profile, baseCurrency, mb]);

  const yearRevenue = round2(quarters.reduce((s, q) => s + q.revenue, 0));
  const yearCosts = round2(quarters.reduce((s, q) => s + q.costs, 0));
  const hours = round2(sum(timeEntries.filter((t) => yearOf(t.date || t.createdAt) === year), (t) => (Number(t.minutes) || 0) / 60));

  const tax = computeTax(profile, {
    revenue: yearRevenue,
    expenses: yearCosts,
    otherIncome: Number(settings?.tax?.otherIncome) || 0,
    hours,
    hoursCriterionMet: settings?.tax?.hoursCriterionMet,
    starter: settings?.tax?.starter,
    aow: settings?.tax?.aow,
  });

  const setAsidePct = recommendedSetAside(tax.effectiveRate, settings?.tax?.bufferPct ?? 5);
  const setAsideAmount = round2((tax.profit * setAsidePct) / 100);
  const savedBuffer = round2(
    sum((collections.ledger || []).filter((l) => /tax|buffer|reserve/i.test(`${l.category} ${l.description}`) && l.type === 'expense' && yearOf(l.date) === year), (l) => l.amount),
  );
  const bufferGap = round2(setAsideAmount - savedBuffer);

  const currentQ = quarterOf(new Date());
  const vatDueThisQuarter = quarters.find((q) => q.quarter === currentQ)?.vat?.due || 0;

  /* -------------------------------- exports -------------------------------- */
  const exportExcel = () => {
    const name = taxWorkbook({
      quarters: quarters.map((q) => ({ quarter: q.quarter, revenue: q.revenue, costs: q.costs, ...q.vat, incomeTaxShare: round2(tax.total / 4), setAsidePct })),
      tax,
      expenses: expenses.filter((e) => yearOf(e.date) === year),
      profile,
      year,
      currency: baseCurrency,
    });
    toast(`Excel exported: ${name}`);
  };

  const exportPdf = () => {
    const doc = reportPDF({
      title: `Tax & set-aside estimate ${year}`,
      subtitle: `${profile.label} · ${settings?.business?.name || 'Your business'} · generated ${fmtDate(todayISO(), locale)}`,
      settings,
      sections: [
        {
          title: 'Summary',
          kv: [
            ['Revenue (ex VAT)', m(yearRevenue)],
            ['Deductible costs (ex VAT)', m(yearCosts)],
            ['Profit', m(tax.profit)],
            ['Taxable income', m(tax.taxable)],
            ['Income tax after credits', m(tax.incomeTax)],
            ...tax.surtaxLines.map((s) => [s.label, m(s.amount)]),
            ['Total to set aside', m(tax.total)],
            ['Effective rate on profit', `${round2(tax.effectiveRate)}%`],
            ['Advised reserve (incl. buffer)', `${setAsidePct}% · ${m(setAsideAmount)}`],
            ['Tracked business hours', `${hours} h`],
          ],
        },
        {
          title: 'Calculation',
          table: {
            head: ['Step', 'Amount'],
            body: [
              ['Revenue (ex VAT)', m(yearRevenue)],
              ['− Deductible costs', `− ${m(yearCosts)}`],
              ['= Profit', m(tax.profit)],
              ...tax.deductions.map((d) => [`− ${d.label}`, m(d.amount)]),
              ['= Taxable income', m(tax.taxable)],
              ...tax.brackets.map((b) => [`${round2(b.rate * 100)}% over ${m(b.from)} – ${m(b.to)}`, m(b.tax)]),
              ['= Income tax before credits', m(tax.grossTax)],
              ...tax.creditLines.map((c) => [`− ${c.label}`, `− ${m(c.amount)}`]),
              ['= Income tax', m(tax.incomeTax)],
              ...tax.surtaxLines.map((s) => [`+ ${s.label}`, m(s.amount)]),
            ],
            foot: ['Total tax to reserve', m(tax.total)],
            numericColumns: [1],
          },
        },
        {
          title: 'VAT per quarter',
          table: {
            head: ['Quarter', 'Revenue', 'VAT charged', 'VAT reclaimable', 'To pay (+) / back (−)', 'Deadline'],
            body: quarters.map((q) => [
              `Q${q.quarter}`,
              m(q.revenue),
              m(q.vat.outputVat),
              m(q.vat.inputVat),
              m(q.vat.due),
              q.deadline ? fmtDate(String(q.deadline).slice(0, 10), locale) : '—',
            ]),
            numericColumns: [1, 2, 3, 4],
          },
        },
        {
          title: 'Deductible costs by category',
          table: {
            head: ['Category', 'Amount (ex VAT)', 'Share'],
            body: Object.entries(costsByCategory(expenses.filter((e) => yearOf(e.date) === year), settings))
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => [k, m(v), `${yearCosts ? round2((v / yearCosts) * 100) : 0}%`]),
            numericColumns: [1, 2],
          },
        },
      ],
    });
    savePdf(doc, `DRIPS-tax-${year}`);
    toast('Tax report PDF downloaded');
  };

  /* --------------------------------- views --------------------------------- */

  const filteredExpenses = useMemo(() => {
    return sortBy(
      expenses.filter((e) => {
        if (yearOf(e.date) !== year) return false;
        if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
        if (quarterFilter !== 'all' && quarterOf(e.date) !== Number(quarterFilter)) return false;
        if (missingReceipts && e.receipt) return false;
        return true;
      }),
      (e) => e.date,
      -1,
    );
  }, [expenses, year, categoryFilter, quarterFilter, missingReceipts]);

  const categoryTotals = costsByCategory(expenses.filter((e) => yearOf(e.date) === year), settings);
  const pieData = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const barData = quarters.map((q) => ({
    name: `Q${q.quarter}`,
    Revenue: q.revenue,
    Costs: q.costs,
    VAT: q.vat.due,
    Tax: round2(tax.total / 4),
  }));

  return (
    <>
      <PageHeader
        eyebrow={`Tax year ${year}`}
        title="Tax & Expense Estimator"
        subtitle="Track quarterly revenue and deductible costs, see exactly what the tax office expects, and know the percentage to move aside from every payment."
        icon={Calculator}
        actions={
          <>
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="!w-auto" aria-label="Tax year">
              {[yearOf(new Date()) + 1, yearOf(new Date()), yearOf(new Date()) - 1, yearOf(new Date()) - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Dropdown trigger={<Button variant="outline" icon={Download}>Export</Button>}>
              <MenuItem icon={FileDown} onClick={exportExcel}>
                Excel workbook (.xlsx)
              </MenuItem>
              <MenuItem icon={Receipt} onClick={exportPdf}>
                Tax report (PDF)
              </MenuItem>
            </Dropdown>
            <Button variant="primary" icon={Plus} onClick={() => setExpenseModal({})}>
              Add expense
            </Button>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="Tax module view"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'estimator', label: 'Estimator', icon: Calculator },
              { value: 'quarters', label: 'Quarterly VAT', icon: BarChart3 },
              { value: 'expenses', label: 'Expenses', icon: Receipt },
            ]}
          />
          <Pill tone="blue" icon={Info}>
            {profile.label}
          </Pill>
          {!profile.exact && (
            <Pill tone="amber">Indicative profile — adjust in Settings</Pill>
          )}
        </div>
      </PageHeader>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPI label={`Revenue ${year}`} value={compact(yearRevenue)} icon={Wallet} tone="brand" hint={`${quarters.filter((q) => q.revenue > 0).length} quarters with income`} />
        <KPI label="Deductible costs" value={compact(yearCosts)} icon={TrendingDown} tone="flag" hint={`${expenses.filter((e) => yearOf(e.date) === year).length} expenses logged`} />
        <KPI label="Total to set aside" value={compact(tax.total)} icon={PiggyBank} tone="amber" hint={`${round2(tax.effectiveRate)}% effective rate on profit`} />
        <KPI
          label="Buffer position"
          value={compact(savedBuffer)}
          icon={Check}
          tone={bufferGap <= 0 ? 'mint' : 'flag'}
          hint={bufferGap > 0 ? `${compact(bufferGap)} short of the advised ${setAsidePct}%` : `You are ${compact(-bufferGap)} ahead — nice`}
        />
      </div>

      {tab === 'estimator' && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_1fr] xl:items-start">
          {/* quarterly builder */}
          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle
                action={
                  <Button size="sm" variant="ghost" icon={Filter} onClick={() => setTab('quarters')}>
                    VAT detail
                  </Button>
                }
              >
                Quarterly revenue & costs
              </SectionTitle>
              <p className="-mt-1 mb-3 text-xs text-[var(--text-muted)]">
                Pulled automatically from your invoices and expenses. Override any quarter if you have income outside
                DRIPS — overrides are marked and can be reset.
              </p>
              <div className="space-y-3">
                {quarters.map((q) => (
                  <div key={q.quarter} className={cx('rounded-xl border p-3', q.quarter === currentQ ? 'border-[var(--color-flag-700)] bg-[color-mix(in_srgb,var(--color-flag-700)_4%,transparent)]' : 'border-[var(--line)]')}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-bold">
                        Q{q.quarter} {year}
                        {q.quarter === currentQ && <Pill tone="red">current</Pill>}
                        {q.manual && <Pill tone="amber">manual</Pill>}
                      </p>
                      <p className="tnum text-xs text-[var(--text-muted)]">
                        {q.invoices} invoices · {q.expensesCount} expenses
                        {q.deadline ? ` · VAT due ${fmtDate(String(q.deadline).slice(0, 10), locale)}` : ''}
                      </p>
                    </div>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Field label="Revenue (ex VAT)">
                        <MoneyInput
                          value={q.revenue}
                          currency={baseCurrency}
                          onChange={(v) =>
                            updateSettings({ tax: { quarterOverrides: { [year]: { ...overrides, [q.quarter]: { ...overrides[q.quarter], revenue: v } } } } })
                          }
                        />
                      </Field>
                      <Field label="Deductible costs (ex VAT)">
                        <MoneyInput
                          value={q.costs}
                          currency={baseCurrency}
                          onChange={(v) =>
                            updateSettings({ tax: { quarterOverrides: { [year]: { ...overrides, [q.quarter]: { ...overrides[q.quarter], costs: v } } } } })
                          }
                        />
                      </Field>
                      <div className="flex items-end">
                        {q.manual && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const next = { ...overrides };
                              delete next[q.quarter];
                              updateSettings({ tax: { quarterOverrides: { [year]: next } } });
                              toast(`Q${q.quarter} reset to your books`);
                            }}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-semibold">
                        Profit Q{q.quarter}: <span className="tnum">{m(q.profit)}</span>
                      </span>
                      <span className={cx('tnum font-semibold', q.vat.due >= 0 ? 'text-flag-700' : 'text-[var(--color-mint-600)]')}>
                        VAT {q.vat.due >= 0 ? 'to pay' : 'back'}: {m(Math.abs(q.vat.due))}
                      </span>
                      <span className="tnum text-[var(--text-muted)]">Set aside ≈ {m(round2((q.profit * setAsidePct) / 100))}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Full year {year}</p>
                    <p className="tnum font-display text-2xl font-extrabold">{m(tax.profit)} profit</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Advised reserve</p>
                    <p className="tnum font-display text-2xl font-extrabold text-flag-700">{m(setAsideAmount)}</p>
                    <p className="text-xs text-[var(--text-muted)]">{setAsidePct}% of profit (tax + {settings?.tax?.bufferPct ?? 5}% safety buffer)</p>
                  </div>
                </div>
                <Progress className="mt-3" value={Math.min(savedBuffer, setAsideAmount)} max={Math.max(1, setAsideAmount)} label="Buffer saved so far" tone={bufferGap > 0 ? 'amber' : 'mint'} />
                {bufferGap > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[var(--color-amber-brand-700)] dark:text-[#f5cf82]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Move {m(round2(bufferGap / Math.max(1, 5 - currentQ)))} per remaining month to reach your reserve before 31 December.
                  </p>
                )}
              </div>
            </Card>

            <Card className="pad">
              <SectionTitle>Assumptions</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  checked={settings?.tax?.hoursCriterionMet ?? hours >= (profile.hoursCriterion || 1225)}
                  onChange={(v) => updateSettings({ tax: { hoursCriterionMet: v } })}
                  label={`Hours criterion met (${profile.hoursCriterion || 1225} h)`}
                  description={`Tracked: ${hours} h this year. Required for the zelfstandigenaftrek.`}
                />
                <Toggle
                  checked={!!settings?.tax?.starter}
                  onChange={(v) => updateSettings({ tax: { starter: v } })}
                  label="Startersaftrek"
                  description="First three years, max three times, at least 1.225 hours."
                />
                <Toggle
                  checked={!!settings?.tax?.aow}
                  onChange={(v) => updateSettings({ tax: { aow: v } })}
                  label="AOW pension age"
                  description="Lower bracket-1 rate and reduced tax credits."
                />
                <Toggle
                  checked={(settings?.tax?.vatRegime || 'standard') === 'kor'}
                  onChange={(v) => updateSettings({ tax: { vatRegime: v ? 'kor' : 'standard' } })}
                  label="KOR small-business scheme"
                  description={`Revenue under ${m(profile.vat?.korThreshold || 20000)}: no VAT charged, no VAT return.`}
                />
                <Field label="Other taxable income (box 1)">
                  <MoneyInput value={Number(settings?.tax?.otherIncome) || 0} currency={baseCurrency} onChange={(v) => updateSettings({ tax: { otherIncome: v } })} />
                </Field>
                <Field label="Safety buffer on top of tax (%)">
                  <Input type="number" min="0" max="20" step="1" value={settings?.tax?.bufferPct ?? 5} onChange={(e) => updateSettings({ tax: { bufferPct: Number(e.target.value) } })} />
                </Field>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
                {profile.note} Figures are an estimate for planning, not tax advice — your final assessment comes from
                the Belastingdienst.
              </p>
            </Card>
          </div>

          {/* calculation */}
          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle
                action={
                  <Select value={settings?.tax?.country || 'NL'} onChange={(e) => updateSettings({ tax: { country: e.target.value } })} className="!w-auto !py-1 !text-xs" aria-label="Tax profile">
                    {Object.values(TAX_PROFILES).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                }
              >
                How your tax is calculated
              </SectionTitle>

              <ol className="space-y-1.5 text-sm">
                <CalcRow label="Revenue (ex VAT)" value={m(tax.revenue)} />
                <CalcRow label="Deductible costs (ex VAT)" value={`− ${m(tax.expenses)}`} negative />
                <CalcRow label="Profit" value={m(tax.profit)} strong />
                {tax.deductions.map((d) => (
                  <CalcRow key={d.label} label={d.label} value={`− ${m(d.amount)}`} negative indent />
                ))}
                <CalcRow label="Taxable income" value={m(tax.taxable)} strong />
              </ol>

              {tax.brackets.length > 0 && (
                <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Income tax by bracket</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {tax.brackets.map((b) => (
                      <li key={b.from} className="flex items-center justify-between gap-3">
                        <span className="text-[var(--text-muted)]">
                          {round2(b.rate * 100)}% over {m(b.from)} – {b.to === Infinity ? '…' : m(b.to)}
                        </span>
                        <span className="tnum font-semibold">{m(b.tax)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ol className="mt-3 space-y-1.5 text-sm">
                <CalcRow label="Tax before credits" value={m(tax.grossTax)} />
                {tax.creditLines.map((c) => (
                  <CalcRow key={c.label} label={c.label} value={`− ${m(c.amount)}`} negative indent />
                ))}
                <CalcRow label="Income tax" value={m(tax.incomeTax)} strong />
                {tax.surtaxLines.map((s) => (
                  <CalcRow key={s.label} label={s.label} value={`+ ${m(s.amount)}`} indent />
                ))}
              </ol>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-white" style={{ background: 'var(--flag-gradient)' }}>
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/80">Total to reserve</p>
                  <p className="tnum font-display text-2xl font-extrabold">{m(tax.total)}</p>
                </div>
                <div className="text-right text-xs text-white/85">
                  <p>
                    Effective <strong className="text-white">{round2(tax.effectiveRate)}%</strong>
                  </p>
                  <p>
                    Marginal <strong className="text-white">{round2(tax.marginalRate)}%</strong>
                  </p>
                  <p>
                    Take-home <strong className="text-white">{m(tax.netTakeHome)}</strong>
                  </p>
                </div>
              </div>

              {tax.profit > 0 && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--color-brand-500)_8%,transparent)] p-3 text-xs leading-relaxed">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-600)]" aria-hidden />
                  <span>
                    Every euro you invoice this year should move <strong>{setAsidePct} cent</strong> to your tax buffer.
                    On an invoice of {m(1000)} that is {m((1000 * setAsidePct) / 100)}. Keep it in a separate account so
                    the quarterly and annual assessments never bite.
                  </span>
                </p>
              )}
            </Card>

            <Card className="pad">
              <SectionTitle>Where the money goes</SectionTitle>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                    <YAxis tickFormatter={(v) => compact(v)} tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={62} />
                    <Tooltip contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} formatter={(v, n) => [m(v), n]} cursor={{ fill: 'color-mix(in srgb, var(--text) 5%, transparent)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Revenue" stackId="a" fill="#21468B" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Costs" stackId="b" fill="#AE1C28" />
                    <Bar dataKey="Tax" stackId="b" fill="#D9930B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {pieData.length > 0 && (
              <Card className="pad">
                <SectionTitle>Deductible costs by category</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:items-center">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={66} paddingAngle={2} stroke="none">
                          {pieData.map((entry, i) => (
                            <Cell key={entry.name} fill={PIE[i % PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} formatter={(v) => m(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {pieData.map((d, i) => (
                      <li key={d.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE[i % PIE.length] }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{d.name}</span>
                        <span className="tnum font-semibold">{mb(d.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'quarters' && (
        <div className="mt-4 grid gap-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] p-3">
              <div>
                <h2 className="text-base font-bold">VAT position per quarter</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Regime: {settings?.tax?.vatRegime === 'kor' ? 'KOR (small business scheme)' : 'Standard VAT'} · rates{' '}
                  {profile.vat?.standard}% / {profile.vat?.reduced}%
                </p>
              </div>
              <Button variant="outline" size="sm" icon={Download} onClick={exportExcel}>
                Export VAT overview
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Quarter</th>
                    <th scope="col" className="num">Revenue (ex VAT)</th>
                    <th scope="col" className="num">VAT charged</th>
                    <th scope="col" className="num">VAT reclaimable</th>
                    <th scope="col" className="num">To pay (+) / back (−)</th>
                    <th scope="col">Filing deadline</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quarters.map((q) => {
                    const deadline = q.deadline ? String(q.deadline).slice(0, 10) : '';
                    const past = deadline && deadline < todayISO();
                    const soon = deadline && !past && (new Date(deadline) - new Date(todayISO())) / 864e5 <= 21;
                    return (
                      <tr key={q.quarter}>
                        <td className="font-bold">
                          Q{q.quarter} {year}
                        </td>
                        <td className="num">{m(q.vat.revenue || q.revenue)}</td>
                        <td className="num">{m(q.vat.outputVat)}</td>
                        <td className="num">{m(q.vat.inputVat)}</td>
                        <td className={cx('num font-bold', q.vat.due >= 0 ? 'text-flag-700' : 'text-[var(--color-mint-600)]')}>{m(q.vat.due)}</td>
                        <td className="whitespace-nowrap text-xs">{deadline ? fmtDate(deadline, locale) : '—'}</td>
                        <td>
                          {past ? <Pill tone="green">filed window passed</Pill> : soon ? <Pill tone="amber">due soon</Pill> : <Pill>upcoming</Pill>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="border-t border-[var(--line)]">Total {year}</td>
                    <td className="num border-t border-[var(--line)]">{m(sum(quarters, (q) => q.revenue))}</td>
                    <td className="num border-t border-[var(--line)]">{m(sum(quarters, (q) => q.vat.outputVat))}</td>
                    <td className="num border-t border-[var(--line)]">{m(sum(quarters, (q) => q.vat.inputVat))}</td>
                    <td className="num border-t border-[var(--line)]">{m(sum(quarters, (q) => q.vat.due))}</td>
                    <td className="border-t border-[var(--line)]" />
                    <td className="border-t border-[var(--line)]" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="pad">
              <SectionTitle>This quarter’s checklist</SectionTitle>
              <ul className="space-y-2 text-sm">
                {[
                  `${vatDueThisQuarter >= 0 ? 'Pay' : 'Reclaim'} ${m(Math.abs(vatDueThisQuarter))} VAT for Q${currentQ}`,
                  `Move ${m(round2((quarters.find((q) => q.quarter === currentQ)?.profit || 0) * (setAsidePct / 100)))} into your tax buffer`,
                  `Log every expense before ${fmtDate(addDays(todayISO(), 7).toISOString().slice(0, 10), locale)} to keep the reclaim complete`,
                  `${expenses.filter((e) => !e.receipt && yearOf(e.date) === year).length} expenses are missing a receipt`,
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[0.6rem] font-bold text-[var(--text-muted)]" aria-hidden>
                      {i + 1}
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="pad">
              <SectionTitle>Deduction reference ({profile.label.split('·')[0].trim()})</SectionTitle>
              <ul className="space-y-2 text-sm">
                {(profile.deductions || []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">{d.label}</span>
                    <span className="tnum font-semibold">{m(d.amount)}</span>
                  </li>
                ))}
                {profile.exemption && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">{profile.exemption.label}</span>
                    <span className="tnum font-semibold">{round2(profile.exemption.rate * 100)}%</span>
                  </li>
                )}
                {profile.brackets.map((b, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">
                      Bracket {i + 1} {b.upTo === Infinity ? `above ${m(profile.brackets[i - 1]?.upTo || 0)}` : `up to ${m(b.upTo)}`}
                    </span>
                    <span className="tnum font-semibold">{round2(b.rate * 100)}%</span>
                  </li>
                ))}
                {(profile.surtaxes || []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">{s.label}</span>
                    <span className="tnum font-semibold">
                      {round2(s.rate * 100)}%{s.cap ? ` (cap ${m(s.cap)})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-col gap-2.5 border-b border-[var(--line)] p-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="!w-auto !text-xs" aria-label="Filter by category">
                <option value="all">All categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)} className="!w-auto !text-xs" aria-label="Filter by quarter">
                <option value="all">All quarters</option>
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </Select>
              <Checkbox checked={missingReceipts} onChange={setMissingReceipts} label="Missing receipt only" />
            </div>
            <p className="text-xs text-[var(--text-muted)] lg:ml-auto">
              {filteredExpenses.length} expenses · {m(sum(filteredExpenses, (e) => e.amount))} total ·{' '}
              {m(sum(filteredExpenses, (e) => e.vatAmount || 0))} VAT reclaimable
            </p>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Receipt}
                title="No expenses match"
                description="Log software, travel, home office and subcontractor costs to lower your taxable profit and reclaim VAT."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setExpenseModal({})}>
                    Add your first expense
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col" className="num">VAT</th>
                    <th scope="col" className="num">Deductible</th>
                    <th scope="col">Receipt</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{fmtDate(e.date, locale)}</td>
                      <td className="max-w-[18rem]">
                        <span className="block truncate font-semibold">{e.description}</span>
                        <span className="block truncate text-[0.7rem] text-[var(--text-muted)]">
                          {[e.vendor, e.paymentMethod, projectMap[e.projectId]?.name, clientMap[e.clientId]?.company].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs">{e.category}</td>
                      <td className="num whitespace-nowrap font-semibold">{m(e.amount, e.currency)}</td>
                      <td className="num whitespace-nowrap text-xs">{e.vatRate ? `${m(e.vatAmount || 0, e.currency)} (${e.vatRate}%)` : '—'}</td>
                      <td className="num whitespace-nowrap">{m(deductibleAmount(e, settings), e.currency)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => updateItem('expenses', e.id, { receipt: !e.receipt })}
                          className={cx('chip', e.receipt ? 'chip-green' : 'chip-amber')}
                          aria-pressed={!!e.receipt}
                          title="Toggle receipt"
                        >
                          {e.receipt ? <Check className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
                          {e.receipt ? 'filed' : 'missing'}
                        </button>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton icon={Receipt} label={`Edit ${e.description}`} size="sm" onClick={() => setEditing(e)} />
                          <IconButton
                            icon={Trash2}
                            label={`Delete ${e.description}`}
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`Delete “${e.description}”?`)) {
                                removeItem('expenses', e.id);
                                toast('Expense deleted');
                              }
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <ExpenseModal
        open={!!expenseModal || !!editing}
        expense={editing || expenseModal}
        onClose={() => {
          setExpenseModal(null);
          setEditing(null);
          if (params.get('new')) {
            params.delete('new');
            setParams(params, { replace: true });
          }
        }}
        onSave={async (record) => {
          if (editing) {
            await updateItem('expenses', editing.id, record, { debounce: 0 });
            toast('Expense updated');
          } else {
            await addItem('expenses', record);
            toast('Expense logged — your VAT reclaim and profit updated');
          }
          setExpenseModal(null);
          setEditing(null);
        }}
      />
    </>
  );
}

/* --------------------------------- helpers -------------------------------- */

function deductibleAmount(expense, settings) {
  const net = round2((Number(expense.amount) || 0) - (Number(expense.vatAmount) || 0));
  if (expense.deductible === false) return 0;
  const mixed = expense.mixedCost ?? MIXED_CATEGORIES.includes(expense.category);
  if (mixed && settings?.tax?.mixedRule !== false) return round2(net * MIXED_DEDUCTIBLE_RATE);
  return net;
}

function costsByCategory(expenses, settings) {
  return expenses.reduce((acc, e) => {
    const value = deductibleAmount(e, settings);
    if (!value) return acc;
    acc[e.category || 'Other'] = round2((acc[e.category || 'Other'] || 0) + value);
    return acc;
  }, {});
}

function CalcRow({ label, value, strong, negative, indent }) {
  return (
    <li className={cx('flex items-center justify-between gap-3 rounded-lg px-2 py-1.5', strong && 'bg-[color-mix(in_srgb,var(--text)_4%,transparent)] font-bold', indent && 'pl-5')}>
      <span className={cx('min-w-0', strong ? '' : 'text-[var(--text-muted)]', indent && 'text-xs')}>{label}</span>
      <span className={cx('tnum shrink-0 font-semibold', negative && 'text-[var(--color-mint-600)]')}>{value}</span>
    </li>
  );
}

/* --------------------------------- modal ---------------------------------- */

function ExpenseModal({ open, expense, onClose, onSave }) {
  const { settings, collections, baseCurrency } = useApp();
  const editing = !!expense?.id;
  const [form, setForm] = useState({});

  useMemo(() => {
    if (!open) return;
    setForm(
      expense?.id
        ? { ...expense }
        : {
            date: todayISO(),
            description: '',
            category: EXPENSE_CATEGORIES[0],
            vendor: '',
            amount: 0,
            currency: baseCurrency,
            vatRate: Number(settings?.tax?.vatRate ?? 21),
            vatIncluded: true,
            deductible: true,
            receipt: false,
            paymentMethod: 'bank',
            projectId: '',
            clientId: '',
            notes: '',
            ...(expense || {}),
          },
    );
  }, [open, expense?.id]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const amount = Number(form.amount) || 0;
  const vatRate = Number(form.vatRate) || 0;
  const vatAmount = form.vatIncluded ? round2((amount * vatRate) / (100 + vatRate)) : round2((amount * vatRate) / 100);
  const net = round2(amount - (form.vatIncluded ? vatAmount : 0));
  const mixed = form.mixedCost ?? MIXED_CATEGORIES.includes(form.category);
  const deductible = form.deductible === false ? 0 : mixed && settings?.tax?.mixedRule !== false ? round2(net * MIXED_DEDUCTIBLE_RATE) : net;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit expense' : 'Log an expense'}
      description="Amounts including VAT are split automatically so your reclaim and profit stay correct."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Check}
            disabled={!form.description}
            onClick={() =>
              onSave({
                ...form,
                amount: round2(amount),
                vatAmount,
                mixedCost: mixed,
                createdAt: form.createdAt || new Date().toISOString(),
              })
            }
          >
            {editing ? 'Save changes' : 'Add expense'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" required>
          <Input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={form.category || ''} onChange={(e) => set('category', e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" className="sm:col-span-2" required>
          <Input autoFocus value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Figma Professional — annual seat" />
        </Field>
        <Field label="Vendor / supplier">
          <Input value={form.vendor || ''} onChange={(e) => set('vendor', e.target.value)} placeholder="Figma Inc." />
        </Field>
        <Field label="Payment method">
          <Select value={form.paymentMethod || 'bank'} onChange={(e) => set('paymentMethod', e.target.value)}>
            {['bank', 'card', 'cash', 'ideal', 'credit', 'other'].map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Amount (${form.vatIncluded ? 'incl. VAT' : 'excl. VAT'})`} required>
          <MoneyInput value={amount} onChange={(v) => set('amount', v)} currency={form.currency || baseCurrency} />
        </Field>
        <Field label="VAT rate">
          <Select value={String(vatRate)} onChange={(e) => set('vatRate', Number(e.target.value))}>
            {VAT_RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project (optional)">
          <Select value={form.projectId || ''} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">— Not linked —</option>
            {(collections.projects || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Client (optional)">
          <Select value={form.clientId || ''} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">— Not linked —</option>
            {(collections.clients || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.company || c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Business use, split percentage, depreciation note…" />
        </Field>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Toggle checked={!!form.vatIncluded} onChange={(v) => set('vatIncluded', v)} label="Amount includes VAT" description="Untick for B2B invoices with VAT added on top." />
        <Toggle checked={form.deductible !== false} onChange={(v) => set('deductible', v)} label="Deductible for income tax" description="Untick for private costs or non-deductible items." />
        <Toggle checked={!!form.receipt} onChange={(v) => set('receipt', v)} label="Receipt filed" description="Keep your administration audit-proof." />
        <Toggle checked={!!mixed} onChange={(v) => set('mixedCost', v)} label="Food & representation (73,5% rule)" description="The Dutch threshold makes 26,5% of these costs non-deductible." />
      </div>

      <div className="mt-3 grid gap-2 rounded-xl bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-3 text-sm sm:grid-cols-4">
        {[
          ['Amount', fmtMoney(amount, form.currency || baseCurrency, 'nl-NL')],
          ['VAT', fmtMoney(vatAmount, form.currency || baseCurrency, 'nl-NL')],
          ['Net cost', fmtMoney(net, form.currency || baseCurrency, 'nl-NL')],
          ['Lowers profit by', fmtMoney(deductible, form.currency || baseCurrency, 'nl-NL')],
        ].map(([k, v], i) => (
          <div key={k}>
            <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">{k}</p>
            <p className={cx('tnum font-bold', i === 3 && 'text-[var(--color-mint-600)]')}>{v}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}
