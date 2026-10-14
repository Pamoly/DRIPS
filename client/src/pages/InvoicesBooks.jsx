import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownCircle,
  Banknote,
  BookOpen,
  Check,
  CreditCard,
  Download,
  FileDown,
  Mail,
  MoreHorizontal,
  Plus,
  Printer,
  Receipt,
  Repeat,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { addDays, copyText, cx, daysBetween, fmtDate, fmtMoney, groupBy, quarterOf, round2, sortBy, sum, todayISO, uid, yearOf } from '../lib/format';
import { agingBuckets, invoiceBalance, invoiceState, profitAndLoss, billableStatuses } from '../lib/metrics';
import { booksWorkbook } from '../lib/excel';
import { invoicePDF, reportPDF, savePdf } from '../lib/pdf';
import { DocumentPreview } from '../components/DocumentPreview';
import { CURRENCIES } from '../lib/currencies';
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
  MoneyInput,
  PageHeader,
  Pill,
  SearchInput,
  SectionTitle,
  Segmented,
  Select,
  StatusPill,
  Textarea,
} from '../components/ui';
import { PrintModal } from './ProposalEditor';
import { EXPENSE_CATEGORIES } from './TaxExpenses';

const LEDGER_ACCOUNTS = ['Business current', 'Savings / buffer', 'Cash', 'Credit card', 'Tax buffer', 'Private'];

export default function InvoicesBooks() {
  const app = useApp();
  const { collections, settings, baseCurrency, locale, rates, clientMap, projectMap, addItem, updateItem, removeItem, addPayment, toast } = app;
  const { m, mb, compact } = useMoney();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'books' ? 'books' : 'invoices');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('filter') || 'all');
  const [period, setPeriod] = useState('all');
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [preview, setPreview] = useState(null);
  const [ledgerModal, setLedgerModal] = useState(false);
  const [basis, setBasis] = useState('accrual');

  const invoices = collections.invoices || [];
  const expenses = collections.expenses || [];
  const pnl = useMemo(() => profitAndLoss(collections, yearOf(new Date()), baseCurrency, rates), [collections, baseCurrency, rates]);
  const aging = useMemo(() => agingBuckets(invoices, baseCurrency, rates), [invoices, baseCurrency, rates]);

  const focusId = params.get('focus');
  const startNew = params.get('new') === '1';

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortBy(
      invoices.filter((i) => {
        if (status !== 'all' && invoiceState(i) !== status) return false;
        if (period !== 'all') {
          const y = yearOf(i.issueDate);
          const qq = quarterOf(i.issueDate);
          if (period.startsWith('y') && y !== Number(period.slice(1))) return false;
          if (period.startsWith('q') && `${y}${qq}` !== period.slice(1)) return false;
        }
        if (!needle) return true;
        return [i.number, i.reference, clientMap[i.clientId]?.company, clientMap[i.clientId]?.name, i.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      }),
      (i) => i.issueDate,
      -1,
    );
  }, [invoices, q, status, period, clientMap]);

  const ledger = useMemo(() => buildLedger(collections, basis, baseCurrency, clientMap, projectMap), [collections, basis, baseCurrency, clientMap, projectMap]);

  const exportBooks = () => {
    const name = booksWorkbook({ invoices, expenses, ledger, clients: collections.clients || [], pnl, settings, currency: baseCurrency });
    toast(`Accountant pack exported: ${name}`);
  };

  const exportBooksPdf = () => {
    const doc = reportPDF({
      title: `Books & accounting ${pnl.year}`,
      subtitle: `${settings?.business?.name || 'Your business'} · KvK ${settings?.business?.regNumber || '—'} · VAT ${settings?.business?.taxId || '—'} · generated ${fmtDate(todayISO(), locale)}`,
      settings,
      sections: [
        {
          title: 'Profit & loss',
          kv: [
            ['Revenue (ex VAT)', m(pnl.revenue)],
            ['Operating costs (ex VAT)', m(pnl.costs)],
            ['Net profit', m(pnl.profit)],
            ['Profit margin', `${pnl.margin}%`],
            ['VAT collected', m(pnl.vatCollected)],
            ['VAT reclaimable', m(pnl.vatPaid)],
            ['VAT net position', m(pnl.vatCollected - pnl.vatPaid)],
          ],
        },
        {
          title: 'Costs by category',
          table: { head: ['Category', 'Amount'], body: Object.entries(pnl.costsByCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, m(v)]), numericColumns: [1] },
        },
        {
          title: 'Invoices',
          table: {
            head: ['Number', 'Client', 'Issue', 'Due', 'Status', 'Total', 'Balance'],
            body: invoices.map((i) => [
              i.number,
              clientMap[i.clientId]?.company || '—',
              fmtDate(i.issueDate, locale),
              fmtDate(i.dueDate, locale),
              invoiceState(i),
              m(i.total, i.currency),
              m(invoiceBalance(i), i.currency),
            ]),
            numericColumns: [5, 6],
          },
        },
        {
          title: 'Debtor ageing',
          kv: [
            ['Not due yet', m(aging.current)],
            ['1–30 days late', m(aging.d1_30)],
            ['31–60 days late', m(aging.d31_60)],
            ['60+ days late', m(aging.d60plus)],
          ],
        },
      ],
    });
    savePdf(doc, `DRIPS-books-${pnl.year}`);
    toast('Books PDF downloaded');
  };

  const sendReminder = async (inv) => {
    const client = clientMap[inv.clientId];
    const late = daysBetween(todayISO(), inv.dueDate);
    const subject = `Reminder: invoice ${inv.number}${late > 0 ? ` (${late} days overdue)` : ''}`;
    const body = `Hi ${client?.name?.split(' ')[0] || 'there'},

A friendly reminder about invoice ${inv.number} for ${fmtMoney(inv.total, inv.currency, locale)}, due ${fmtDate(inv.dueDate, locale)}${late > 0 ? ` — it is now ${late} day(s) past due` : ''}.

${settings?.business?.iban ? `IBAN: ${settings.business.iban}\nAccount name: ${settings.business.name}\n` : ''}Reference: ${inv.number}

If you have already paid, please ignore this message. Questions? Just reply to this email.

Kind regards,
${settings?.business?.owner || settings?.business?.name || ''}`;
    await copyText(body);
    window.location.href = `mailto:${client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast('Reminder copied to your clipboard and opened in your mail app');
  };

  const downloadInvoicePdf = (inv) => {
    const doc = invoicePDF(inv, { client: clientMap[inv.clientId], settings, payments: inv.payments || [] });
    savePdf(doc, `${inv.number}-${(clientMap[inv.clientId]?.company || 'invoice').replace(/\s+/g, '-').toLowerCase()}`);
    toast(`PDF exported: ${inv.number}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Invoices & Books"
        subtitle="Number, send, get paid and keep a ledger your accountant can read — with VAT, ageing and one-click exports."
        icon={Receipt}
        actions={
          <>
            <Dropdown trigger={<Button variant="outline" icon={Download}>Export</Button>}>
              <MenuItem icon={Download} onClick={exportBooks}>
                Accountant pack (.xlsx)
              </MenuItem>
              <MenuItem icon={BookOpen} onClick={exportBooksPdf}>
                Books report (PDF)
              </MenuItem>
              <MenuItem icon={Printer} onClick={() => window.print()}>
                Print this view
              </MenuItem>
            </Dropdown>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setEditing({});
                params.delete('new');
                setParams(params, { replace: true });
              }}
            >
              New invoice
            </Button>
          </>
        }
      >
        <div className="mt-3">
          <Segmented
            ariaLabel="Finance view"
            value={tab}
            onChange={(v) => {
              setTab(v);
              if (v === 'books') params.set('tab', 'books');
              else params.delete('tab');
              setParams(params, { replace: true });
            }}
            options={[
              { value: 'invoices', label: 'Invoices', icon: Receipt },
              { value: 'books', label: 'Books & ledger', icon: BookOpen },
            ]}
          />
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPI label={`Invoiced ${pnl.year}`} value={compact(pnl.revenue + pnl.vatCollected)} icon={Receipt} tone="brand" hint={`${invoices.length} invoices · ex VAT ${compact(pnl.revenue)}`} />
        <KPI label="Collected" value={compact(pnl.collected)} icon={ArrowDownCircle} tone="mint" hint={`${invoices.filter((i) => invoiceState(i) === 'paid').length} paid in full`} />
        <KPI label="Outstanding" value={compact(pnl.outstanding)} icon={Wallet} tone={aging.d60plus > 0 ? 'flag' : 'amber'} hint={`${aging.d1_30 + aging.d31_60 + aging.d60plus > 0 ? 'incl. late amounts' : 'nothing late'}`} />
        <KPI label="Net profit" value={compact(pnl.profit)} icon={Banknote} tone={pnl.profit >= 0 ? 'mint' : 'flag'} hint={`Margin ${pnl.margin}% · costs ${compact(pnl.costs)}`} />
      </div>

      {tab === 'invoices' && (
        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-col gap-2.5 border-b border-[var(--line)] p-3 lg:flex-row lg:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search number, client or reference…" className="lg:max-w-xs lg:flex-1" id="invoice-search" />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto !text-xs" aria-label="Filter by status">
                <option value="all">All statuses</option>
                {['draft', 'sent', 'partly-paid', 'overdue', 'paid', 'void'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto !text-xs" aria-label="Filter by period">
                <option value="all">All periods</option>
                {[0, 1, 2].map((back) => yearOf(new Date()) - back).map((y) => (
                  <option key={y} value={`y${y}`}>
                    Year {y}
                  </option>
                ))}
                {[4, 3, 2, 1].map((qq) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - qq * 3);
                  return (
                    <option key={qq} value={`q${d.getFullYear()}${Math.floor(d.getMonth() / 3) + 1}`}>
                      Q{Math.floor(d.getMonth() / 3) + 1} {d.getFullYear()}
                    </option>
                  );
                })}
              </Select>
              <Pill tone={aging.d60plus > 0 ? 'red' : aging.d1_30 > 0 ? 'amber' : 'green'}>
                {aging.d60plus > 0 ? `${m(aging.d60plus)} over 60 days` : 'Receivables healthy'}
              </Pill>
            </div>
            <p className="text-xs text-[var(--text-muted)] lg:ml-auto">{filtered.length} of {invoices.length}</p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Receipt}
                title={invoices.length ? 'No invoices match these filters' : 'Send your first invoice'}
                description={invoices.length ? 'Adjust the search or clear the status filter.' : 'Create a numbered invoice with VAT, record payments and keep the ledger up to date automatically.'}
                action={<Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New invoice</Button>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Client</th>
                    <th scope="col">Issued</th>
                    <th scope="col">Due</th>
                    <th scope="col" className="num">Total</th>
                    <th scope="col" className="num">Balance</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => {
                    const state = invoiceState(inv);
                    const late = daysBetween(todayISO(), inv.dueDate);
                    return (
                      <tr key={inv.id} className={cx(focusId === inv.id && 'bg-[color-mix(in_srgb,var(--color-brand-500)_10%,transparent)]')}>
                        <td className="whitespace-nowrap font-mono text-xs font-semibold">{inv.number}</td>
                        <td className="max-w-[12rem]">
                          <span className="block truncate font-semibold">{clientMap[inv.clientId]?.company || '—'}</span>
                          {inv.reference && <span className="block truncate text-[0.7rem] text-[var(--text-muted)]">ref {inv.reference}</span>}
                        </td>
                        <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{fmtDate(inv.issueDate, locale)}</td>
                        <td className="whitespace-nowrap text-xs">
                          {fmtDate(inv.dueDate, locale)}
                          {state === 'overdue' && <span className="ml-1 font-bold text-flag-700">({late}d)</span>}
                        </td>
                        <td className="num whitespace-nowrap font-semibold">
                          {m(inv.total, inv.currency)}
                          {inv.currency !== baseCurrency && <span className="ml-1 text-[0.68rem] text-[var(--text-muted)]">({mb(inv.total, inv.currency)})</span>}
                        </td>
                        <td className={cx('num whitespace-nowrap', invoiceBalance(inv) > 0 ? 'font-semibold text-flag-700' : 'text-[var(--color-mint-600)]')}>
                          {invoiceBalance(inv) > 0 ? m(invoiceBalance(inv), inv.currency) : 'settled'}
                        </td>
                        <td>
                          <StatusPill status={state} />
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {invoiceBalance(inv) > 0 && state !== 'draft' && (
                              <Button size="sm" variant="outline" icon={CreditCard} onClick={() => setPaying(inv)}>
                                Payment
                              </Button>
                            )}
                            <IconButton icon={FileDown} label={`Download PDF for ${inv.number}`} size="sm" onClick={() => downloadInvoicePdf(inv)} />
                            <Dropdown trigger={<IconButton icon={MoreHorizontal} label={`More actions for ${inv.number}`} size="sm" />}>
                              <MenuItem icon={Receipt} onClick={() => setEditing(inv)}>
                                Edit invoice
                              </MenuItem>
                              <MenuItem icon={Printer} onClick={() => setPreview(inv)}>
                                Print preview
                              </MenuItem>
                              <MenuItem icon={Mail} onClick={() => sendReminder(inv)}>
                                Send payment reminder
                              </MenuItem>
                              <MenuItem
                                icon={Check}
                                onClick={() => {
                                  updateItem('invoices', inv.id, { status: state === 'draft' ? 'sent' : 'paid', paidAmount: state === 'draft' ? inv.paidAmount : inv.total }, { debounce: 0 });
                                  toast(state === 'draft' ? `${inv.number} marked as sent` : `${inv.number} marked as paid`);
                                }}
                              >
                                {state === 'draft' ? 'Mark as sent' : 'Mark as paid in full'}
                              </MenuItem>
                              <MenuItem icon={Repeat} onClick={() => setEditing({ ...inv, id: undefined, number: '', status: 'draft', payments: [], paidAmount: 0, issueDate: todayISO(), dueDate: addDays(todayISO(), settings?.defaults?.paymentTermsDays || 14).toISOString().slice(0, 10) })}>
                                Duplicate as new
                              </MenuItem>
                              <MenuItem icon={Trash2} tone="danger" onClick={() => { if (window.confirm(`Delete ${inv.number}?`)) { removeItem('invoices', inv.id); toast('Invoice deleted'); } }}>
                                Delete
                              </MenuItem>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'books' && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr] xl:items-start">
          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle
                action={
                  <div className="flex gap-2">
                    <Segmented size="sm" ariaLabel="Accounting basis" value={basis} onChange={setBasis} options={[{ value: 'accrual', label: 'Accrual' }, { value: 'cash', label: 'Cash' }]} />
                    <Button size="sm" variant="outline" icon={Plus} onClick={() => setLedgerModal(true)}>
                      Journal entry
                    </Button>
                  </div>
                }
              >
                General ledger
              </SectionTitle>
              <p className="-mt-1 mb-3 text-xs text-[var(--text-muted)]">
                {basis === 'accrual'
                  ? 'Accrual basis: income is booked on the invoice date, costs on the expense date.'
                  : 'Cash basis: income is booked when the payment arrives, costs when you pay them.'}
              </p>
              <div className="max-h-[26rem] overflow-auto rounded-xl border border-[var(--line)]">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Description</th>
                      <th scope="col">Category</th>
                      <th scope="col" className="num">Income</th>
                      <th scope="col" className="num">Costs</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.slice(0, 200).map((l, i) => (
                      <tr key={`${l.refType}-${l.refId || i}-${i}`}>
                        <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{fmtDate(l.date, locale)}</td>
                        <td className="max-w-[18rem] truncate">{l.description}</td>
                        <td className="whitespace-nowrap text-xs">{l.category}</td>
                        <td className={cx('num whitespace-nowrap', l.type === 'income' ? 'font-semibold text-[var(--color-mint-600)]' : 'text-[var(--text-muted)]')}>{l.type === 'income' ? m(l.amount, l.currency) : ''}</td>
                        <td className={cx('num whitespace-nowrap', l.type === 'expense' ? 'font-semibold text-flag-700' : 'text-[var(--text-muted)]')}>{l.type === 'expense' ? m(l.amount, l.currency) : ''}</td>
                        <td className="whitespace-nowrap text-[0.68rem] text-[var(--text-muted)]">{l.refType}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td className="border-t border-[var(--line)]" colSpan={3}>
                        Totals ({ledger.length} entries)
                      </td>
                      <td className="num border-t border-[var(--line)] text-[var(--color-mint-600)]">{m(sum(ledger.filter((l) => l.type === 'income'), (l) => l.amount))}</td>
                      <td className="num border-t border-[var(--line)] text-flag-700">{m(sum(ledger.filter((l) => l.type === 'expense'), (l) => l.amount))}</td>
                      <td className="border-t border-[var(--line)]" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card className="pad">
              <SectionTitle action={<Button size="sm" variant="outline" icon={Download} onClick={exportBooks}>Excel</Button>}>
                Profit & loss {pnl.year}
              </SectionTitle>
              <table className="tbl">
                <tbody>
                  <tr>
                    <td className="font-semibold">Revenue (ex VAT)</td>
                    <td className="num font-semibold">{m(pnl.revenue)}</td>
                  </tr>
                  {Object.entries(pnl.costsByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, value]) => (
                      <tr key={cat}>
                        <td className="pl-4 text-[var(--text-muted)]">{cat}</td>
                        <td className="num text-flag-700">− {m(value)}</td>
                      </tr>
                    ))}
                  <tr className="border-t border-[var(--line)] font-bold">
                    <td>Total operating costs</td>
                    <td className="num text-flag-700">− {m(pnl.costs)}</td>
                  </tr>
                  <tr className="bg-[color-mix(in_srgb,var(--text)_4%,transparent)] font-extrabold">
                    <td>Net profit</td>
                    <td className="num">{m(pnl.profit)}</td>
                  </tr>
                  <tr>
                    <td className="text-[var(--text-muted)]">VAT collected / reclaimable</td>
                    <td className="num">{m(pnl.vatCollected)} / {m(pnl.vatPaid)}</td>
                  </tr>
                  <tr>
                    <td className="text-[var(--text-muted)]">Unbilled tracked time</td>
                    <td className="num">{m(pnl.unbilled)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle>Debtor ageing</SectionTitle>
              <ul className="space-y-2 text-sm">
                {[
                  ['Not due yet', aging.current, 'mint'],
                  ['1–30 days late', aging.d1_30, 'amber'],
                  ['31–60 days late', aging.d31_60, 'amber'],
                  ['60+ days late', aging.d60plus, 'flag'],
                ].map(([label, value, tone]) => (
                  <li key={label}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">{label}</span>
                      <span className="tnum font-bold">{m(value)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
                      <div
                        className={cx('h-full rounded-full', { mint: 'bg-[var(--color-mint-500)]', amber: 'bg-[var(--color-amber-brand-500)]', flag: 'bg-[var(--color-flag-700)]' }[tone])}
                        style={{ width: `${Math.min(100, (value / Math.max(pnl.outstanding, 1)) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {aging.d1_30 + aging.d31_60 + aging.d60plus > 0 && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--color-flag-700)_8%,transparent)] p-3 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-flag-700" aria-hidden />
                  <span>
                    {m(aging.d1_30 + aging.d31_60 + aging.d60plus)} is late. Send a reminder from the invoice row — the
                    template is copied to your clipboard and opened in your mail app.
                  </span>
                </p>
              )}
            </Card>

            <Card className="pad">
              <SectionTitle>Revenue by client ({pnl.year})</SectionTitle>
              {(() => {
                const byClient = groupBy(
                  invoices.filter((i) => billableStatuses.includes(invoiceState(i)) && yearOf(i.issueDate) === pnl.year),
                  (i) => clientMap[i.clientId]?.company || 'No client',
                );
                const rows = Object.entries(byClient)
                  .map(([name, list]) => ({ name, value: round2(sum(list, (i) => mb(i.net, i.currency))) }))
                  .sort((a, b) => b.value - a.value);
                const max = Math.max(...rows.map((r) => r.value), 1);
                if (!rows.length) return <p className="text-sm text-[var(--text-muted)]">No invoiced revenue yet this year.</p>;
                return (
                  <ul className="space-y-2.5">
                    {rows.slice(0, 8).map((r) => (
                      <li key={r.name}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate font-medium">{r.name}</span>
                          <span className="tnum font-bold">{mb(r.value)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
                          <div className="h-full rounded-full bg-[var(--color-brand-600)]" style={{ width: `${(r.value / max) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Card>

            <Card className="pad">
              <SectionTitle>Accounting checklist</SectionTitle>
              <ul className="space-y-2 text-sm">
                {[
                  { ok: expenses.filter((e) => yearOf(e.date) === pnl.year && !e.receipt).length === 0, label: 'Every expense has a receipt filed' },
                  { ok: invoices.filter((i) => invoiceState(i) === 'overdue').length === 0, label: 'No overdue invoices' },
                  { ok: pnl.vatCollected >= pnl.vatPaid, label: 'VAT collected covers your reclaim' },
                  { ok: (collections.ledger || []).length > 0, label: 'Opening balance / private deposits recorded' },
                  { ok: pnl.unbilled === 0, label: 'All billable time is invoiced' },
                ].map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-white', c.ok ? 'bg-[var(--color-mint-500)]' : 'bg-[color-mix(in_srgb,var(--text)_18%,transparent)]')} aria-hidden>
                      {c.ok ? <Check className="h-3 w-3" /> : <span className="text-[0.6rem]">•</span>}
                    </span>
                    <span className={cx(c.ok ? 'text-[var(--text-muted)] line-through decoration-[color-mix(in_srgb,var(--text)_30%,transparent)]' : 'font-medium')}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* modals */}
      <InvoiceModal open={!!editing || startNew} invoice={editing} onClose={() => { setEditing(null); params.delete('new'); params.delete('focus'); setParams(params, { replace: true }); }} />
      <PaymentModal invoice={paying} onClose={() => setPaying(null)} />
      <LedgerModal open={ledgerModal} onClose={() => setLedgerModal(false)} />
      {preview && (
        <PrintModal onClose={() => setPreview(null)} title={`Print ${preview.number}`}>
          <DocumentPreview doc={preview} client={clientMap[preview.clientId]} business={settings?.business} brand={settings?.brand} kind="invoice" />
        </PrintModal>
      )}
    </>
  );
}

/* --------------------------------- ledger --------------------------------- */

export function buildLedger(collections, basis = 'accrual', baseCurrency = 'EUR', clientMap = {}, projectMap = {}) {
  const rows = [];

  for (const inv of collections.invoices || []) {
    if (!billableStatuses.includes(invoiceState(inv))) continue;
    const client = clientMap[inv.clientId]?.company || '';
    if (basis === 'accrual') {
      rows.push({
        date: inv.issueDate,
        type: 'income',
        account: 'Business current',
        category: 'Revenue',
        description: `${inv.number}${client ? ` — ${client}` : ''}`,
        amount: round2(Number(inv.net) || 0),
        currency: inv.currency || baseCurrency,
        refType: 'invoice',
        refId: inv.id,
      });
      if (Number(inv.taxTotal) > 0)
        rows.push({
          date: inv.issueDate,
          type: 'income',
          account: 'VAT payable',
          category: 'VAT collected',
          description: `${inv.number} — VAT ${inv.taxRate}%`,
          amount: round2(Number(inv.taxTotal) || 0),
          currency: inv.currency || baseCurrency,
          refType: 'vat',
          refId: inv.id,
        });
    }
    for (const p of inv.payments || []) {
      if (basis === 'cash' || inv.payments.length)
        rows.push({
          date: p.date,
          type: 'income',
          account: 'Business current',
          category: basis === 'cash' ? 'Revenue (received)' : 'Payment received',
          description: `${inv.number} payment — ${p.method || 'bank'}${p.note ? ` · ${p.note}` : ''}`,
          amount: round2(Number(p.amount) || 0),
          currency: inv.currency || baseCurrency,
          refType: basis === 'cash' ? 'invoice' : 'payment',
          refId: p.id,
        });
    }
  }

  for (const e of collections.expenses || []) {
    rows.push({
      date: e.date,
      type: 'expense',
      account: e.paymentMethod === 'card' ? 'Credit card' : 'Business current',
      category: e.category || 'Other',
      description: `${e.description}${e.vendor ? ` — ${e.vendor}` : ''}${projectMap[e.projectId] ? ` (${projectMap[e.projectId].name})` : ''}`,
      amount: round2(Number(e.amount) || 0),
      currency: e.currency || baseCurrency,
      refType: 'expense',
      refId: e.id,
    });
  }

  for (const l of collections.ledger || []) {
    rows.push({ ...l, amount: round2(Number(l.amount) || 0), refType: l.refType || 'manual' });
  }

  return sortBy(rows, (r) => r.date, -1);
}

/* --------------------------------- modals --------------------------------- */

function InvoiceModal({ open, invoice, onClose }) {
  const { collections, settings, clientMap, addItem, updateItem, toast } = useApp();
  const { m } = useMoney();
  const editing = !!invoice?.id;
  const [form, setForm] = useState({});

  useMemo(() => {
    if (!open) return;
    if (invoice?.id) {
      setForm({ ...invoice });
      return;
    }
    const terms = Number(settings?.defaults?.paymentTermsDays || 14);
    setForm({
      ...(invoice || {}),
      number: '',
      clientId: (collections.clients || [])[0]?.id || '',
      status: 'draft',
      currency: settings?.locale?.baseCurrency || 'EUR',
      issueDate: todayISO(),
      dueDate: addDays(todayISO(), terms).toISOString().slice(0, 10),
      items: [{ id: uid('it'), description: '', detail: '', qty: 1, unit: 'hours', rate: Number(settings?.defaults?.hourlyRate) || 85 }],
      taxRate: Number(settings?.tax?.vatRate ?? 21),
      discount: { type: 'percent', value: 0 },
      payments: [],
      paidAmount: 0,
      notes: '',
      terms: settings?.defaults?.proposalTerms || '',
      reference: '',
    });
  }, [open, invoice?.id]);

  const totals = useMemo(() => {
    const subtotal = round2((form.items || []).reduce((s, it) => s + round2(it.qty) * round2(it.rate), 0));
    const d = form.discount || { type: 'percent', value: 0 };
    const discountValue = d.type === 'percent' ? round2((subtotal * Number(d.value || 0)) / 100) : round2(d.value);
    const net = Math.max(0, round2(subtotal - discountValue));
    const taxTotal = round2((net * Number(form.taxRate || 0)) / 100);
    return { subtotal, discountValue, net, taxTotal, total: round2(net + taxTotal) };
  }, [form]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, patch) => set('items', (form.items || []).map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const importFromTime = () => {
    const entries = (collections.timeEntries || []).filter((t) => t.billable && !t.invoiced && (!form.clientId || t.clientId === form.clientId));
    if (!entries.length) {
      toast('No unbilled time entries for this client', 'error');
      return;
    }
    const grouped = entries.reduce((acc, e) => {
      const key = e.description || 'Tracked work';
      acc[key] = acc[key] || { hours: 0, rate: e.rate || settings?.defaults?.hourlyRate || 85 };
      acc[key].hours += (e.minutes || 0) / 60;
      return acc;
    }, {});
    set(
      'items',
      Object.entries(grouped).map(([description, v]) => ({ id: uid('it'), description, detail: `Tracked time (${round2(v.hours)} h)`, qty: round2(v.hours), unit: 'hours', rate: round2(v.rate) })),
    );
    toast(`Imported ${Object.keys(grouped).length} line(s) from the time tracker`);
  };

  const save = async () => {
    const record = { ...form, ...totals };
    if (editing) {
      await updateItem('invoices', form.id, record, { debounce: 0 });
      toast(`Invoice ${form.number} updated`);
    } else {
      const created = await addItem('invoices', record);
      toast(`Invoice ${created.number} created`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editing ? `Edit ${form.number || 'invoice'}` : 'New invoice'}
      description="Line items, VAT and payments stay in sync with your books and tax estimator."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Check} onClick={save} disabled={!(form.items || []).some((i) => i.description)}>
            {editing ? 'Save invoice' : 'Create invoice'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Client" required>
          <Select value={form.clientId || ''} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">— Select client —</option>
            {(collections.clients || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.company || c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice number" hint="Leave empty to auto-number">
          <Input value={form.number || ''} onChange={(e) => set('number', e.target.value)} placeholder={`${settings?.numbering?.invoicePrefix || 'INV'}-…`} />
        </Field>
        <Field label="Reference (PO / project)">
          <Input value={form.reference || ''} onChange={(e) => set('reference', e.target.value)} placeholder="PO-4471" />
        </Field>
        <Field label="Status">
          <Select value={form.status || 'draft'} onChange={(e) => set('status', e.target.value)}>
            {['draft', 'sent', 'partly-paid', 'paid', 'overdue', 'void'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Issue date">
          <Input type="date" value={form.issueDate || ''} onChange={(e) => set('issueDate', e.target.value)} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.dueDate || ''} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Currency">
          <Select value={form.currency || 'EUR'} onChange={(e) => set('currency', e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="VAT rate">
          <Select value={String(form.taxRate ?? 21)} onChange={(e) => set('taxRate', Number(e.target.value))}>
            {[21, 9, 0, 6, 20, 19].map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <SectionTitle
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" icon={Download} onClick={importFromTime}>
                From time tracker
              </Button>
              <Button size="sm" variant="outline" icon={Plus} onClick={() => set('items', [...(form.items || []), { id: uid('it'), description: '', detail: '', qty: 1, unit: 'hours', rate: Number(clientMap[form.clientId]?.hourlyRate || settings?.defaults?.hourlyRate) || 85 }])}>
                Add line
              </Button>
            </div>
          }
        >
          Line items
        </SectionTitle>
        <div className="space-y-2">
          {(form.items || []).map((it, i) => (
            <div key={it.id || i} className="grid gap-2 rounded-xl border border-[var(--line)] p-2.5 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_5rem_6rem_7.5rem_2rem] sm:items-center">
              <Input value={it.description || ''} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Description" aria-label={`Line ${i + 1} description`} />
              <Input value={it.detail || ''} onChange={(e) => setItem(i, { detail: e.target.value })} placeholder="Detail (optional)" aria-label={`Line ${i + 1} detail`} />
              <Input type="number" min="0" step="0.25" value={it.qty ?? 0} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} className="tnum" aria-label={`Line ${i + 1} quantity`} />
              <Select value={it.unit || 'hours'} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label={`Line ${i + 1} unit`}>
                {['hours', 'days', 'pieces', 'project', 'package'].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
              <MoneyInput value={it.rate ?? 0} onChange={(v) => setItem(i, { rate: v })} currency={form.currency || 'EUR'} aria-label={`Line ${i + 1} rate`} />
              <div className="flex items-center justify-between gap-1">
                <span className="tnum text-xs font-semibold">{m(round2(it.qty) * round2(it.rate), form.currency)}</span>
                <IconButton icon={Trash2} label={`Remove line ${i + 1}`} size="sm" onClick={() => set('items', (form.items || []).filter((_, x) => x !== i))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discount">
            <div className="flex gap-2">
              <Select value={form.discount?.type || 'percent'} onChange={(e) => set('discount', { ...form.discount, type: e.target.value })} aria-label="Discount type" className="!w-28">
                <option value="percent">%</option>
                <option value="amount">amount</option>
              </Select>
              {form.discount?.type === 'amount' ? (
                <MoneyInput value={form.discount?.value || 0} onChange={(v) => set('discount', { ...form.discount, value: v })} currency={form.currency || 'EUR'} />
              ) : (
                <Input type="number" min="0" max="100" step="0.5" value={form.discount?.value ?? 0} onChange={(e) => set('discount', { ...form.discount, value: Number(e.target.value) })} />
              )}
            </div>
          </Field>
          <Field label="Payment terms (shown on the invoice)">
            <Input value={form.terms || ''} onChange={(e) => set('terms', e.target.value)} placeholder="Payable within 14 days." />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-3 text-sm">
          {[
            ['Subtotal', m(totals.subtotal, form.currency)],
            ['Discount', `− ${m(totals.discountValue, form.currency)}`],
            [`VAT ${form.taxRate || 0}%`, m(totals.taxTotal, form.currency)],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-1">
              <span className="text-[var(--text-muted)]">{k}</span>
              <span className="tnum font-semibold">{v}</span>
            </div>
          ))}
          <div className="mt-1.5 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-brand-900,#0E1B3D)] px-3 py-2 text-white">
            <span className="font-bold">Total</span>
            <span className="tnum font-display text-lg font-extrabold">{m(totals.total, form.currency)}</span>
          </div>
          {editing && Number(form.paidAmount) > 0 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Paid {m(form.paidAmount, form.currency)} · balance {m(round2(totals.total - Number(form.paidAmount || 0)), form.currency)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function PaymentModal({ invoice, onClose }) {
  const { addPayment, toast } = useApp();
  const { m } = useMoney();
  const [form, setForm] = useState({ amount: 0, date: todayISO(), method: 'bank', note: '' });

  useMemo(() => {
    if (invoice) setForm({ amount: round2(invoiceBalance(invoice)), date: todayISO(), method: 'bank', note: '' });
  }, [invoice?.id]);

  if (!invoice) return null;
  const balance = invoiceBalance(invoice);

  return (
    <Modal
      open={!!invoice}
      onClose={onClose}
      size="sm"
      title={`Record payment — ${invoice.number}`}
      description={`Outstanding balance ${m(balance, invoice.currency)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Check}
            disabled={!form.amount}
            onClick={async () => {
              await addPayment(invoice.id, form);
              toast(`Payment of ${m(form.amount, invoice.currency)} recorded`);
              onClose();
            }}
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount" required>
          <MoneyInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} currency={invoice.currency || 'EUR'} />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </Field>
        <Field label="Method">
          <Select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
            {['bank', 'ideal', 'card', 'cash', 'paypal', 'crypto', 'other'].map((mm) => (
              <option key={mm} value={mm}>
                {mm}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note">
          <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Batch payment incl. INV-…" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, amount: balance }))}>
          Full balance
        </Button>
        <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, amount: round2(balance / 2) }))}>
          50%
        </Button>
        <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, amount: round2(Number(invoice.total) * 0.3) }))}>
          30% deposit
        </Button>
      </div>
    </Modal>
  );
}

function LedgerModal({ open, onClose }) {
  const { addItem, toast, settings } = useApp();
  const { baseCurrency } = useMoney();
  const [form, setForm] = useState({ date: todayISO(), type: 'expense', account: LEDGER_ACCOUNTS[0], category: EXPENSE_CATEGORIES[0], description: '', amount: 0, currency: baseCurrency, refType: 'manual' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual journal entry"
      description="For deposits, private transfers, tax payments or anything not captured as an invoice or expense."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            disabled={!form.description || !form.amount}
            onClick={async () => {
              await addItem('ledger', form);
              toast('Journal entry added');
              setForm((f) => ({ ...f, description: '', amount: 0 }));
              onClose();
            }}
          >
            Add entry
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="expense">Money out</option>
            <option value="income">Money in</option>
            <option value="transfer">Transfer between accounts</option>
          </Select>
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Input autoFocus value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Q3 income tax payment" />
        </Field>
        <Field label="Account">
          <Select value={form.account} onChange={(e) => set('account', e.target.value)}>
            {LEDGER_ACCOUNTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
            {[...EXPENSE_CATEGORIES, 'Tax set-aside', 'Income tax', 'VAT payment', 'Opening balance', 'Private deposit'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount">
          <MoneyInput value={form.amount} onChange={(v) => set('amount', v)} currency={form.currency} />
        </Field>
        <Field label="Currency">
          <Input value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase().slice(0, 3))} />
        </Field>
      </div>
      <p className="hint mt-2">Base currency: {settings?.locale?.baseCurrency || baseCurrency}</p>
    </Modal>
  );
}
