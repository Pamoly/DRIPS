// Derived business metrics — pure functions over the workspace collections.
import { convert, sumInBase } from './currencies';
import { computeTax, computeVatQuarter, resolveProfile, recommendedSetAside } from './tax';
import { daysBetween, groupBy, lastMonths, monthKey, quarterOf, round2, sum, todayISO, yearOf } from './format';

export const INVOICE_OPEN = ['sent', 'partly-paid', 'overdue'];
export const billableStatuses = ['sent', 'paid', 'partly-paid', 'overdue'];

export const invoiceBalance = (inv) => round2((Number(inv.total) || 0) - (Number(inv.paidAmount) || 0));

export function invoiceState(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'void' || inv.status === 'draft') return inv.status;
  const overdueBy = daysBetween(todayISO(), inv.dueDate);
  if (overdueBy > 0) return 'overdue';
  if (Number(inv.paidAmount) > 0) return 'partly-paid';
  return 'sent';
}

export const agingBuckets = (invoices, base = 'EUR', rates = {}) => {
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
  for (const inv of invoices) {
    if (!INVOICE_OPEN.includes(invoiceState(inv))) continue;
    const bal = convert(invoiceBalance(inv), inv.currency || base, base, rates);
    const late = daysBetween(todayISO(), inv.dueDate);
    if (late <= 0) buckets.current += bal;
    else if (late <= 30) buckets.d1_30 += bal;
    else if (late <= 60) buckets.d31_60 += bal;
    else buckets.d60plus += bal;
  }
  return Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, round2(v)]));
};

export function monthlySeries({ invoices, expenses }, months = 12, base = 'EUR', rates = {}) {
  const keys = lastMonths(months);
  const rows = keys.map((key) => ({ key, revenue: 0, expenses: 0, profit: 0, invoiced: 0 }));
  const idx = Object.fromEntries(rows.map((r, i) => [r.key, i]));
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'void') continue;
    const i = idx[monthKey(inv.issueDate)];
    if (i === undefined) continue;
    rows[i].revenue += convert(Number(inv.net) || 0, inv.currency || base, base, rates);
    rows[i].invoiced += convert(Number(inv.total) || 0, inv.currency || base, base, rates);
  }
  for (const exp of expenses) {
    const i = idx[monthKey(exp.date)];
    if (i === undefined) continue;
    const net = (Number(exp.amount) || 0) - (Number(exp.vatAmount) || 0);
    rows[i].expenses += convert(net, exp.currency || base, base, rates);
  }
  return rows.map((r) => ({ ...r, revenue: round2(r.revenue), expenses: round2(r.expenses), invoiced: round2(r.invoiced), profit: round2(r.revenue - r.expenses) }));
}

export function profitAndLoss({ invoices, expenses, ledger = [], timeEntries = [] }, year = yearOf(new Date()), base = 'EUR', rates = {}) {
  const inv = invoices.filter(
    (i) => billableStatuses.includes(invoiceState(i)) && yearOf(i.issueDate) === year,
  );
  const exp = expenses.filter((e) => yearOf(e.date) === year);
  const revenue = sumInBase(inv, base, rates, (i) => Number(i.net) || 0);
  const vatCollected = sumInBase(inv, base, rates, (i) => Number(i.taxTotal) || 0);
  const costsByCategory = {};
  let costs = 0;
  let vatPaid = 0;
  for (const e of exp) {
    const net = (Number(e.amount) || 0) - (Number(e.vatAmount) || 0);
    const converted = convert(net, e.currency || base, base, rates);
    costs += converted;
    vatPaid += convert(Number(e.vatAmount) || 0, e.currency || base, base, rates);
    const cat = e.category || 'Other';
    costsByCategory[cat] = round2((costsByCategory[cat] || 0) + converted);
  }
  const paid = sumInBase(inv.filter((i) => invoiceState(i) === 'paid'), base, rates, (i) => Number(i.paidAmount) || 0);
  const outstanding = sumInBase(inv.filter((i) => INVOICE_OPEN.includes(invoiceState(i))), base, rates, invoiceBalance);
  const unbilled = sumInBase(
    timeEntries.filter((t) => t.billable && !t.invoiced),
    base,
    rates,
    (t) => Number(t.amount) || 0,
  );
  return {
    year,
    revenue: round2(revenue),
    vatCollected: round2(vatCollected),
    costs: round2(costs),
    vatPaid: round2(vatPaid),
    costsByCategory: Object.fromEntries(Object.entries(costsByCategory).map(([k, v]) => [k, round2(v)])),
    profit: round2(revenue - costs),
    margin: revenue ? round2(((revenue - costs) / revenue) * 100) : 0,
    collected: round2(paid),
    outstanding: round2(outstanding),
    unbilled: round2(unbilled),
    manualLedger: ledger.filter((l) => yearOf(l.date) === year),
  };
}

export function pipelineSummary(proposals, base = 'EUR', rates = {}) {
  const byStatus = groupBy(proposals, (p) => p.status || 'draft');
  const value = (list) => sumInBase(list, base, rates, (p) => Number(p.total) || 0);
  const open = proposals.filter((p) => ['sent', 'viewed', 'draft'].includes(p.status));
  const won = proposals.filter((p) => p.status === 'accepted' || p.status === 'invoiced');
  const lost = proposals.filter((p) => p.status === 'declined');
  return {
    byStatus: Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, { count: v.length, value: round2(value(v)) }])),
    openValue: round2(value(open)),
    openCount: open.length,
    wonValue: round2(value(won)),
    wonCount: won.length,
    lostCount: lost.length,
    winRate: won.length + lost.length ? round2((won.length / (won.length + lost.length)) * 100) : 0,
    avgDeal: won.length ? round2(value(won) / won.length) : 0,
  };
}

export function utilisation(timeEntries, days = 30) {
  const from = daysBetween(todayISO(), todayISO());
  const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  void from;
  const rows = timeEntries.filter((t) => (t.date || t.createdAt || '').slice(0, 10) >= cutoff);
  const total = sum(rows, (t) => Number(t.minutes) || 0) / 60;
  const billable = sum(rows.filter((t) => t.billable), (t) => Number(t.minutes) || 0) / 60;
  return { total: round2(total), billable: round2(billable), rate: total ? round2((billable / total) * 100) : 0 };
}

export function sprintBurndown(tasks, sprint) {
  if (!sprint?.startDate) return [];
  const start = new Date(`${sprint.startDate}T00:00:00`);
  const end = new Date(`${(sprint.endDate || todayISO())}T00:00:00`);
  const inSprint = tasks.filter((t) => t.sprintId === sprint.id);
  const totalPoints = sum(inSprint, (t) => Number(t.points) || 0);
  const out = [];
  for (let d = new Date(start); d <= end && out.length < 120; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const done = sum(
      inSprint.filter((t) => t.column === 'done' && t.completedAt && t.completedAt.slice(0, 10) <= iso),
      (t) => Number(t.points) || 0,
    );
    out.push({ date: iso, ideal: round2(Math.max(0, totalPoints * (1 - (d - start) / Math.max(1, end - start)))), actual: round2(totalPoints - done) });
  }
  return out;
}

export function boardStats(tasks, sprintId) {
  const rows = sprintId ? tasks.filter((t) => t.sprintId === sprintId) : tasks;
  const columns = ['backlog', 'todo', 'doing', 'review', 'done'];
  const byColumn = Object.fromEntries(columns.map((c) => [c, rows.filter((t) => (t.column || 'backlog') === c)]));
  const points = (list) => sum(list, (t) => Number(t.points) || 0);
  const totalPoints = points(rows);
  const donePoints = points(byColumn.done);
  return {
    rows,
    byColumn,
    points,
    totalPoints,
    donePoints,
    progress: totalPoints ? round2((donePoints / totalPoints) * 100) : 0,
    overdue: rows.filter((t) => t.dueDate && t.column !== 'done' && daysBetween(todayISO(), t.dueDate) > 0).length,
    inProgress: byColumn.doing.length,
  };
}

export function yearlyTaxPosition({ invoices, expenses, timeEntries, settings }, year = yearOf(new Date())) {
  const profile = resolveProfile(settings);
  const base = settings?.locale?.baseCurrency || 'EUR';
  const rates = settings?.rates || {};
  const revenue = sumInBase(
    invoices.filter((i) => billableStatuses.includes(invoiceState(i)) && yearOf(i.issueDate) === year),
    base,
    rates,
    (i) => Number(i.net) || 0,
  );
  const costs = sum(
    expenses.filter((e) => yearOf(e.date) === year && e.deductible !== false),
    (e) => (Number(e.amount) || 0) - (Number(e.vatAmount) || 0),
  );
  const hours = sum(timeEntries.filter((t) => yearOf(t.date || t.createdAt) === year), (t) => (Number(t.minutes) || 0) / 60);
  const result = computeTax(profile, {
    revenue,
    expenses: costs,
    otherIncome: Number(settings?.tax?.otherIncome) || 0,
    hours,
    hoursCriterionMet: settings?.tax?.hoursCriterionMet ?? hours >= (profile.hoursCriterion || 0),
    starter: !!settings?.tax?.starter,
    aow: !!settings?.tax?.aow,
  });
  const quarters = [1, 2, 3, 4].map((q) => ({
    quarter: q,
    ...computeVatQuarter({ invoices, expenses, year, quarter: q, regime: settings?.tax?.vatRegime || 'standard' }),
    incomeTaxShare: round2(result.total / 4),
    setAsidePct: recommendedSetAside(result.effectiveRate, settings?.tax?.bufferPct),
  }));
  return { profile, year, revenue, costs, hours, tax: result, quarters, setAsidePct: recommendedSetAside(result.effectiveRate, settings?.tax?.bufferPct) };
}

export function cashForecast(invoices, base = 'EUR', rates = {}) {
  return invoices
    .filter((i) => INVOICE_OPEN.includes(invoiceState(i)))
    .map((i) => ({
      id: i.id,
      number: i.number,
      dueDate: i.dueDate,
      amount: round2(convert(invoiceBalance(i), i.currency || base, base, rates)),
      daysLate: daysBetween(todayISO(), i.dueDate),
    }))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

export function clientValue({ invoices, proposals }, clientId, base = 'EUR', rates = {}) {
  const inv = invoices.filter((i) => i.clientId === clientId && billableStatuses.includes(invoiceState(i)));
  return {
    invoiced: round2(sumInBase(inv, base, rates, (i) => Number(i.net) || 0)),
    outstanding: round2(sumInBase(inv.filter((i) => INVOICE_OPEN.includes(invoiceState(i))), base, rates, invoiceBalance)),
    openProposals: proposals.filter((p) => p.clientId === clientId && ['sent', 'viewed', 'draft'].includes(p.status)).length,
    lastInvoice: inv.sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)))[0]?.issueDate || '',
  };
}

export const thisQuarter = () => quarterOf(new Date());
