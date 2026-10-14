import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Check,
  Download,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Receipt,
  Search,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { cx, daysBetween, fmtDate, fmtMoney, round2, sortBy, sum, todayISO } from '../lib/format';
import { clientValue, invoiceBalance, invoiceState } from '../lib/metrics';
import { clientsWorkbook } from '../lib/excel';
import { reportPDF, savePdf } from '../lib/pdf';
import {
  Avatar,
  Button,
  Card,
  Drawer,
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

const STATUSES = ['lead', 'prospect', 'active', 'past'];

export default function Clients() {
  const app = useApp();
  const { collections, settings, baseCurrency, locale, rates, addItem, updateItem, removeItem, toast } = app;
  const { m, mb, compact } = useMoney();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('value');
  const [layout, setLayout] = useState('grid');
  const [editing, setEditing] = useState(params.get('new') === '1' ? {} : null);
  const [focus, setFocus] = useState(params.get('focus') || null);

  const clients = collections.clients || [];
  const invoices = collections.invoices || [];
  const proposals = collections.proposals || [];

  const withValue = useMemo(
    () =>
      clients.map((c) => ({
        ...c,
        value: clientValue({ invoices, proposals }, c.id, baseCurrency, rates),
      })),
    [clients, invoices, proposals, baseCurrency, rates],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = withValue.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (!needle) return true;
      return [c.company, c.name, c.email, c.city, c.notes, (c.tags || []).join(' ')].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
    });
    return sortBy(
      rows,
      (c) =>
        sort === 'value' ? c.value.invoiced
        : sort === 'outstanding' ? c.value.outstanding
        : sort === 'recent' ? c.createdAt
        : sort === 'name' ? (c.company || c.name || '').toLowerCase()
        : 0,
      sort === 'name' ? 1 : -1,
    );
  }, [withValue, q, status, sort]);

  const activeClient = clients.find((c) => c.id === focus) || null;
  const totals = {
    lifetime: round2(sum(withValue, (c) => c.value.invoiced)),
    outstanding: round2(sum(withValue, (c) => c.value.outstanding)),
    active: clients.filter((c) => c.status === 'active').length,
    leads: clients.filter((c) => c.status === 'lead' || c.status === 'prospect').length,
  };

  const exportExcel = () => {
    const name = clientsWorkbook({ clients: filtered, invoices, proposals, currency: baseCurrency });
    toast(`CRM exported: ${name}`);
  };

  const exportStatement = (client) => {
    const rows = sortBy(invoices.filter((i) => i.clientId === client.id), (i) => i.issueDate, -1);
    const doc = reportPDF({
      title: `Statement of account — ${client.company || client.name}`,
      subtitle: `${settings?.business?.name || 'Your business'} · KvK ${settings?.business?.regNumber || '—'} · VAT ${settings?.business?.taxId || '—'} · generated ${fmtDate(todayISO(), locale)}`,
      settings,
      sections: [
        {
          title: 'Client details',
          kv: [
            ['Company', client.company || '—'],
            ['Contact', client.name || '—'],
            ['Email', client.email || '—'],
            ['Address', [client.street, client.postalCode, client.city, client.country].filter(Boolean).join(', ') || '—'],
            ['KvK number', client.regNumber || '—'],
            ['VAT / tax ID', client.taxId || '—'],
            ['Status', client.status || '—'],
          ],
        },
        {
          title: 'Invoices',
          table: {
            head: ['Number', 'Issue date', 'Due date', 'Status', 'Total', 'Paid', 'Balance'],
            body: rows.map((i) => [
              i.number,
              fmtDate(i.issueDate, locale),
              fmtDate(i.dueDate, locale),
              invoiceState(i),
              fmtMoney(i.total, i.currency, locale),
              fmtMoney(i.paidAmount || 0, i.currency, locale),
              fmtMoney(invoiceBalance(i), i.currency, locale),
            ]),
            foot: ['Total', '', '', '', fmtMoney(sum(rows, (i) => i.total), baseCurrency, locale), fmtMoney(sum(rows, (i) => i.paidAmount || 0), baseCurrency, locale), fmtMoney(sum(rows, (i) => invoiceBalance(i)), baseCurrency, locale)],
            numericColumns: [4, 5, 6],
          },
        },
        {
          title: 'Proposals & quotes',
          table: {
            head: ['Number', 'Title', 'Status', 'Total', 'Valid until'],
            body: proposals.filter((p) => p.clientId === client.id).map((p) => [p.number, p.title, p.status, fmtMoney(p.total, p.currency, locale), p.validUntil ? fmtDate(p.validUntil, locale) : '—']),
            numericColumns: [3],
          },
        },
      ],
    });
    savePdf(doc, `DRIPS-statement-${(client.company || client.name || 'client').replace(/\s+/g, '-').toLowerCase()}`);
    toast('Client statement downloaded');
  };

  return (
    <>
      <PageHeader
        eyebrow="Relationships"
        title="CRM & Clients"
        subtitle="One record per client: contact details, KvK and VAT numbers, status, lifetime value and everything you have sent or invoiced them."
        icon={Users}
        actions={
          <>
            <Dropdown trigger={<Button variant="outline" icon={Download}>Export</Button>}>
              <MenuItem icon={Users} onClick={exportExcel}>
                CRM list (Excel)
              </MenuItem>
              {activeClient && (
                <MenuItem icon={FileText} onClick={() => exportStatement(activeClient)}>
                  Statement for {activeClient.company} (PDF)
                </MenuItem>
              )}
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
              Add client
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPI label="Clients" value={clients.length} icon={Users} tone="brand" hint={`${totals.active} active · ${totals.leads} leads & prospects`} />
        <KPI label="Lifetime value" value={compact(totals.lifetime)} icon={TrendingUp} tone="mint" hint="Invoiced, excluding VAT" />
        <KPI label="Outstanding" value={compact(totals.outstanding)} icon={Wallet} tone={totals.outstanding > 0 ? 'amber' : 'mint'} hint="Across all open invoices" />
        <KPI
          label="Average per client"
          value={compact(clients.length ? totals.lifetime / clients.length : 0)}
          icon={Star}
          tone="flag"
          hint={clients.length ? `Top client: ${sortBy(withValue, (c) => c.value.invoiced, -1)[0]?.company || '—'}` : 'No clients yet'}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-[var(--line)] p-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search company, contact, city, tag…" className="lg:max-w-xs lg:flex-1" id="client-search" />
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              ariaLabel="Filter by status"
              value={status}
              onChange={setStatus}
              options={[{ value: 'all', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]}
            />
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="!w-auto !text-xs" aria-label="Sort clients">
              <option value="value">Sort: lifetime value</option>
              <option value="outstanding">Sort: outstanding</option>
              <option value="recent">Sort: newest</option>
              <option value="name">Sort: name</option>
            </Select>
            <Segmented
              size="sm"
              ariaLabel="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'grid', label: 'Cards' },
                { value: 'table', label: 'Table' },
              ]}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] lg:ml-auto">{filtered.length} of {clients.length}</p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title={clients.length ? 'No clients match' : 'Add your first client'}
              description={clients.length ? 'Try another search term or status filter.' : 'Clients power proposals, invoices, the board and the CRM pipeline — add one to get started.'}
              action={<Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add client</Button>}
            />
          </div>
        ) : layout === 'grid' ? (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <article key={c.id} className="card-flat flex flex-col p-4 transition-shadow hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-start gap-3">
                  <Avatar name={c.company || c.name} color={c.color} size={42} />
                  <div className="min-w-0 flex-1">
                    <button type="button" className="block truncate text-left font-display text-base font-bold hover:text-[var(--color-brand-600)]" onClick={() => setFocus(c.id)}>
                      {c.company || c.name}
                    </button>
                    <p className="truncate text-xs text-[var(--text-muted)]">{c.name}{c.city ? ` · ${c.city}` : ''}</p>
                  </div>
                  <StatusPill status={c.status || 'lead'} />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-2">
                    <dt className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">Lifetime</dt>
                    <dd className="tnum font-bold">{mb(c.value.invoiced)}</dd>
                  </div>
                  <div className="rounded-lg bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-2">
                    <dt className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">Outstanding</dt>
                    <dd className={cx('tnum font-bold', c.value.outstanding > 0 && 'text-flag-700')}>{mb(c.value.outstanding)}</dd>
                  </div>
                </dl>

                {(c.tags || []).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Pill key={t} icon={Tag}>
                        {t}
                      </Pill>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-3">
                  <Button size="sm" variant="outline" icon={Search} onClick={() => setFocus(c.id)}>
                    Open
                  </Button>
                  {c.email && (
                    <Button size="sm" variant="ghost" icon={Mail} onClick={() => (window.location.href = `mailto:${c.email}`)}>
                      Email
                    </Button>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-[0.68rem] text-[var(--text-muted)]">
                      {c.value.openProposals} open · {invoices.filter((i) => i.clientId === c.id).length} invoices
                    </span>
                    <Dropdown trigger={<IconButton icon={MoreHorizontal} label={`Actions for ${c.company || c.name}`} size="sm" />}>
                      <MenuItem icon={Building2} onClick={() => setFocus(c.id)}>
                        View details
                      </MenuItem>
                      <MenuItem icon={FileText} onClick={() => exportStatement(c)}>
                        Download statement (PDF)
                      </MenuItem>
                      <MenuItem icon={Plus} onClick={() => setEditing(c)}>
                        Edit client
                      </MenuItem>
                      <MenuItem
                        icon={Trash2}
                        tone="danger"
                        onClick={() => {
                          if (window.confirm(`Delete ${c.company || c.name}? Proposals and invoices keep their historical data.`)) {
                            removeItem('clients', c.id);
                            toast('Client deleted');
                          }
                        }}
                      >
                        Delete
                      </MenuItem>
                    </Dropdown>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Contact</th>
                  <th scope="col">KvK / VAT</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Lifetime</th>
                  <th scope="col" className="num">Outstanding</th>
                  <th scope="col" className="num">Rate</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button type="button" className="flex items-center gap-2.5 text-left font-semibold hover:text-[var(--color-brand-600)]" onClick={() => setFocus(c.id)}>
                        <Avatar name={c.company || c.name} color={c.color} size={30} />
                        <span className="min-w-0">
                          <span className="block max-w-[14rem] truncate">{c.company || c.name}</span>
                          <span className="block max-w-[14rem] truncate text-[0.7rem] font-normal text-[var(--text-muted)]">{[c.city, c.country].filter(Boolean).join(', ')}</span>
                        </span>
                      </button>
                    </td>
                    <td className="max-w-[12rem] text-xs">
                      <span className="block truncate">{c.name}</span>
                      <span className="block truncate text-[var(--text-muted)]">{c.email}</span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[0.68rem] text-[var(--text-muted)]">
                      {c.regNumber || '—'}
                      <br />
                      {c.taxId || ''}
                    </td>
                    <td>
                      <StatusPill status={c.status || 'lead'} />
                    </td>
                    <td className="num font-semibold">{mb(c.value.invoiced)}</td>
                    <td className={cx('num', c.value.outstanding > 0 ? 'font-semibold text-flag-700' : 'text-[var(--text-muted)]')}>{mb(c.value.outstanding)}</td>
                    <td className="num text-xs">{c.hourlyRate ? m(c.hourlyRate) : '—'}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <IconButton icon={FileText} label={`Statement for ${c.company || c.name}`} size="sm" onClick={() => exportStatement(c)} />
                        <IconButton icon={Building2} label={`Open ${c.company || c.name}`} size="sm" onClick={() => setFocus(c.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ClientDrawer clientId={focus} onClose={() => setFocus(null)} onEdit={(c) => setEditing(c)} onStatement={exportStatement} />
      <ClientModal client={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/* --------------------------------- drawer --------------------------------- */

function ClientDrawer({ clientId, onClose, onEdit, onStatement }) {
  const { collections, clientMap, updateItem, toast, locale } = useApp();
  const { m, mb } = useMoney();
  const client = clientMap[clientId];
  const [note, setNote] = useState('');

  if (!client) return null;
  const invoices = sortBy((collections.invoices || []).filter((i) => i.clientId === clientId), (i) => i.issueDate, -1);
  const proposals = sortBy((collections.proposals || []).filter((p) => p.clientId === clientId), (p) => p.createdAt, -1);
  const projects = (collections.projects || []).filter((p) => p.clientId === clientId);
  const tasks = (collections.tasks || []).filter((t) => t.clientId === clientId);
  const timeEntries = (collections.timeEntries || []).filter((t) => t.clientId === clientId);
  const value = clientValue({ invoices, proposals }, clientId);
  const avgDelay = invoices.filter((i) => i.status === 'paid' && (i.payments || []).length)
    .map((i) => daysBetween((i.payments[0].date || i.issueDate), i.issueDate))
    .filter((d) => d >= 0);

  return (
    <Drawer
      open={!!clientId}
      onClose={onClose}
      title={client.company || client.name}
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={Building2} onClick={() => onEdit(client)}>
            Edit client
          </Button>
          <Button variant="outline" icon={FileText} onClick={() => onStatement(client)}>
            Statement (PDF)
          </Button>
          {client.email && (
            <Button variant="outline" icon={Mail} onClick={() => (window.location.href = `mailto:${client.email}`)}>
              Email
            </Button>
          )}
          {client.phone && (
            <Button variant="outline" icon={Phone} onClick={() => (window.location.href = `tel:${client.phone}`)}>
              Call
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <Avatar name={client.company || client.name} color={client.color} size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{client.name}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" aria-hidden /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" aria-hidden /> {client.phone}
                </span>
              )}
              {client.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden /> {[client.street, client.postalCode, client.city].filter(Boolean).join(', ')}
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill status={client.status || 'lead'} />
              {(client.tags || []).map((t) => (
                <Pill key={t} icon={Tag}>
                  {t}
                </Pill>
              ))}
              <button
                type="button"
                className="chip hover:border-[var(--color-brand-300)]"
                onClick={() => {
                  const tag = window.prompt('Add a tag (e.g. retainer, priority):');
                  if (tag) updateItem('clients', client.id, { tags: [...new Set([...(client.tags || []), tag.trim()])] }, { debounce: 0 });
                }}
              >
                <Plus className="h-3 w-3" aria-hidden /> tag
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Lifetime', mb(value.invoiced)],
            ['Outstanding', mb(value.outstanding)],
            ['Open proposals', value.openProposals],
            ['Avg. payment delay', avgDelay.length ? `${Math.round(avgDelay.reduce((a, b) => a + b, 0) / avgDelay.length)} days` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[var(--line)] p-2.5">
              <p className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">{k}</p>
              <p className="tnum mt-0.5 font-display text-base font-extrabold">{v}</p>
            </div>
          ))}
        </div>

        {(client.regNumber || client.taxId || client.website) && (
          <div className="rounded-xl border border-[var(--line)] p-3 text-xs">
            <p className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">Administration</p>
            <dl className="grid gap-1 sm:grid-cols-2">
              {client.regNumber && (
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">KvK</dt>
                  <dd className="font-mono font-semibold">{client.regNumber}</dd>
                </div>
              )}
              {client.taxId && (
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">VAT / tax ID</dt>
                  <dd className="font-mono font-semibold">{client.taxId}</dd>
                </div>
              )}
              {client.website && (
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">Website</dt>
                  <dd className="font-semibold">{client.website}</dd>
                </div>
              )}
              {client.hourlyRate ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">Agreed rate</dt>
                  <dd className="font-semibold">{m(client.hourlyRate)}/h</dd>
                </div>
              ) : null}
            </dl>
          </div>
        )}

        <div>
          <SectionTitle>Notes & activity</SectionTitle>
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              const entry = { id: `n_${Date.now().toString(36)}`, ts: new Date().toISOString(), text: note.trim() };
              updateItem('clients', client.id, { notesLog: [entry, ...(client.notesLog || [])] }, { debounce: 0 });
              setNote('');
              toast('Note added');
            }}
          >
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note — call summary, preference, follow-up…" aria-label="New note" />
            <Button type="submit" variant="outline" icon={Plus} disabled={!note.trim()}>
              Add
            </Button>
          </form>
          <ol className="space-y-2 border-l border-[var(--line)] pl-4">
            {(client.notesLog || []).map((n) => (
              <li key={n.id} className="relative">
                <span aria-hidden className="absolute -left-[1.32rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand-600)] ring-2 ring-[var(--surface-card)]" />
                <p className="text-sm">{n.text}</p>
                <p className="text-[0.7rem] text-[var(--text-muted)]">{fmtDate(n.ts, locale, { hour: '2-digit', minute: '2-digit' })}</p>
              </li>
            ))}
            {client.notes && !(client.notesLog || []).length && (
              <li className="relative">
                <span aria-hidden className="absolute -left-[1.32rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand-300)] ring-2 ring-[var(--surface-card)]" />
                <p className="text-sm text-[var(--text-muted)]">{client.notes}</p>
              </li>
            )}
            {!(client.notesLog || []).length && !client.notes && <li className="text-sm text-[var(--text-muted)]">No notes yet.</li>}
          </ol>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <SectionTitle>Invoices ({invoices.length})</SectionTitle>
            <ul className="space-y-1.5">
              {invoices.slice(0, 6).map((i) => (
                <li key={i.id}>
                  <Link to={`/app/invoices?focus=${i.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs hover:border-[var(--color-brand-300)]">
                    <span className="min-w-0">
                      <span className="block truncate font-mono font-semibold">{i.number}</span>
                      <span className="block text-[0.68rem] text-[var(--text-muted)]">{fmtDate(i.issueDate, locale)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block font-bold">{m(i.total, i.currency)}</span>
                      <StatusPill status={invoiceState(i)} />
                    </span>
                  </Link>
                </li>
              ))}
              {!invoices.length && <li className="text-xs text-[var(--text-muted)]">No invoices yet.</li>}
            </ul>
          </div>
          <div>
            <SectionTitle>Proposals ({proposals.length})</SectionTitle>
            <ul className="space-y-1.5">
              {proposals.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link to={`/app/proposals/${p.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs hover:border-[var(--color-brand-300)]">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.title}</span>
                      <span className="block font-mono text-[0.68rem] text-[var(--text-muted)]">{p.number}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block font-bold">{m(p.total, p.currency)}</span>
                      <StatusPill status={p.status} />
                    </span>
                  </Link>
                </li>
              ))}
              {!proposals.length && <li className="text-xs text-[var(--text-muted)]">No proposals yet.</li>}
            </ul>
          </div>
        </div>

        {(projects.length > 0 || tasks.length > 0 || timeEntries.length > 0) && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ['Projects', projects.length],
              ['Board cards', tasks.length],
              ['Tracked hours', round2(sum(timeEntries, (t) => (t.minutes || 0) / 60))],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--line)] p-2.5">
                <p className="tnum font-display text-lg font-extrabold">{v}</p>
                <p className="text-[0.62rem] uppercase tracking-wide text-[var(--text-muted)]">{k}</p>
              </div>
            ))}
          </div>
        )}

        <Field label="General note (printed on internal views)">
          <Textarea rows={3} value={client.notes || ''} onChange={(e) => updateItem('clients', client.id, { notes: e.target.value })} placeholder="Preferences, decision makers, payment habits…" />
        </Field>
      </div>
    </Drawer>
  );
}

/* ---------------------------------- modal --------------------------------- */

function ClientModal({ client, onClose }) {
  const { addItem, updateItem, toast, settings } = useApp();
  const open = !!client;
  const editing = !!client?.id;
  const [form, setForm] = useState({});

  useMemo(() => {
    if (!open) return;
    setForm(
      client?.id
        ? { ...client }
        : {
            company: '',
            name: '',
            email: '',
            phone: '',
            website: '',
            street: '',
            postalCode: '',
            city: '',
            country: settings?.business?.country || 'Netherlands',
            regNumber: '',
            taxId: '',
            status: 'lead',
            tags: [],
            hourlyRate: Number(settings?.defaults?.hourlyRate) || 85,
            notes: '',
            color: ['#AE1C28', '#21468B', '#0E7C66', '#B26A00', '#5B3FA8'][Math.floor(Math.random() * 5)],
            ...(client || {}),
          },
    );
  }, [open, client?.id]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${form.company || form.name}` : 'Add a client'}
      description="KvK and VAT numbers are printed on proposals and invoices for this client."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Check}
            disabled={!form.company && !form.name}
            onClick={async () => {
              const record = { ...form, tags: Array.isArray(form.tags) ? form.tags : String(form.tags || '').split(',').map((t) => t.trim()).filter(Boolean) };
              if (editing) {
                await updateItem('clients', form.id, record, { debounce: 0 });
                toast('Client updated');
              } else {
                await addItem('clients', record);
                toast('Client added to your CRM');
              }
              onClose();
            }}
          >
            {editing ? 'Save client' : 'Add client'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company" required>
          <Input autoFocus value={form.company || ''} onChange={(e) => set('company', e.target.value)} placeholder="Havenlab B.V." />
        </Field>
        <Field label="Contact person">
          <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Sanne Boersma" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="sanne@havenlab.nl" />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={form.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="havenlab.nl" />
        </Field>
        <Field label="Status">
          <Select value={form.status || 'lead'} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Street & number" className="sm:col-span-2">
          <Input value={form.street || ''} onChange={(e) => set('street', e.target.value)} />
        </Field>
        <Field label="Postal code">
          <Input value={form.postalCode || ''} onChange={(e) => set('postalCode', e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="Country">
          <Input value={form.country || ''} onChange={(e) => set('country', e.target.value)} />
        </Field>
        <Field label="Hourly rate">
          <MoneyInput value={form.hourlyRate || 0} onChange={(v) => set('hourlyRate', v)} currency={settings?.locale?.baseCurrency || 'EUR'} />
        </Field>
        <Field label="Business registration number (KvK)">
          <Input value={form.regNumber || ''} onChange={(e) => set('regNumber', e.target.value)} placeholder="6612 4483" />
        </Field>
        <Field label="Tax ID / VAT number">
          <Input value={form.taxId || ''} onChange={(e) => set('taxId', e.target.value)} placeholder="NL8564.22.109.B01" />
        </Field>
        <Field label="Tags" hint="Comma separated">
          <Input value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags || ''} onChange={(e) => set('tags', e.target.value)} placeholder="retainer, priority" />
        </Field>
        <Field label="Avatar colour">
          <input type="color" className="h-9 w-full cursor-pointer rounded-lg border border-[var(--line)] bg-transparent p-1" value={form.color || '#21468B'} onChange={(e) => set('color', e.target.value)} aria-label="Avatar colour" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
