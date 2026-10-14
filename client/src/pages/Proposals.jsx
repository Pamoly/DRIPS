import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Filter,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Receipt,
  Rows3,
  Search,
  Share2,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { Button, Card, Dropdown, EmptyState, IconButton, KPI, MenuItem, PageHeader, Pill, SearchInput, Segmented, StatusPill } from '../components/ui';
import { copyText, cx, daysBetween, fmtDate, sortBy, todayISO } from '../lib/format';
import { pipelineSummary } from '../lib/metrics';
import { proposalPDF, savePdf } from '../lib/pdf';
import { proposalsWorkbook } from '../lib/excel';
import { shareUrl } from '../lib/api';

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'invoiced', 'declined'];

export default function Proposals() {
  const { collections, settings, clientMap, duplicateProposal, convertProposal, removeItem, toast, locale, baseCurrency, rates } = useApp();
  const { m, mb } = useMoney();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('filter') || 'all');
  const [type, setType] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [view, setView] = useState('table');

  const proposals = collections.proposals || [];
  const pipeline = useMemo(() => pipelineSummary(proposals, baseCurrency, rates), [proposals, baseCurrency, rates]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortBy(
      proposals.filter((p) => {
        if (status !== 'all' && p.status !== status) return false;
        if (type !== 'all' && (p.type || 'proposal') !== type) return false;
        if (clientId !== 'all' && p.clientId !== clientId) return false;
        if (!needle) return true;
        return [p.number, p.title, p.objective, clientMap[p.clientId]?.company, clientMap[p.clientId]?.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      }),
      (p) => p.updatedAt || p.createdAt,
      -1,
    );
  }, [proposals, q, status, type, clientId, clientMap]);

  const exportPdf = (p) => {
    const doc = proposalPDF(p, { client: clientMap[p.clientId], settings });
    savePdf(doc, `${p.number || 'proposal'}-${(p.title || '').replace(/\s+/g, '-').toLowerCase()}`);
    toast(`PDF exported: ${p.number}`);
  };

  const share = async (p) => {
    const url = shareUrl(p.publicToken);
    await copyText(url);
    toast('Share link copied — clients can accept it online', 'success', {
      action: { label: 'Open', onClick: () => window.open(url, '_blank', 'noopener') },
    });
  };

  const convert = async (p) => {
    try {
      const invoice = await convertProposal(p.id);
      toast(`Invoice ${invoice.number} created from ${p.number}`);
      navigate(`/app/invoices?focus=${invoice.id}`);
    } catch (err) {
      toast(`Could not convert: ${err.message}`, 'error');
    }
  };

  const duplicate = async (p) => {
    const copy = await duplicateProposal(p.id);
    toast(`Duplicated as ${copy.number}`);
    navigate(`/app/proposals/${copy.id}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Proposals & Quotes"
        subtitle="Build a branded proposal from hourly scopes, tiered packages or a fixed price — then send a PDF or a signable link."
        icon={FileText}
        actions={
          <>
            <Dropdown
              trigger={
                <Button variant="outline" icon={FileDown}>
                  Export
                </Button>
              }
            >
              <MenuItem icon={Rows3} onClick={() => proposalsWorkbook({ proposals: filtered, clients: collections.clients || [], currency: baseCurrency })}>
                Excel workbook (.xlsx)
              </MenuItem>
              <MenuItem icon={FileDown} onClick={() => toast('Pick a proposal and use “Download PDF”', 'success')}>
                Pipeline PDF (per document)
              </MenuItem>
            </Dropdown>
            <Button variant="primary" icon={Plus} onClick={() => navigate('/app/proposals/new')}>
              New proposal
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPI label="Open pipeline" value={compactMb(pipeline.openValue, mb)} icon={TrendingUp} tone="brand" hint={`${pipeline.openCount} proposal${pipeline.openCount === 1 ? '' : 's'} awaiting a decision`} />
        <KPI label="Won value" value={compactMb(pipeline.wonValue, mb)} icon={Receipt} tone="mint" hint={`${pipeline.wonCount} accepted`} />
        <KPI label="Win rate" value={`${pipeline.winRate}%`} icon={TrendingUp} tone="flag" hint={`${pipeline.wonCount} won · ${pipeline.lostCount} declined`} />
        <KPI label="Average deal" value={compactMb(pipeline.avgDeal, mb)} icon={FileText} tone="amber" hint="Across accepted proposals" />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-[var(--line)] p-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search number, title or client…" className="lg:max-w-xs lg:flex-1" id="proposal-search" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                className="select !pr-8 !text-xs"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  if (e.target.value === 'all') params.delete('filter');
                  else params.set('filter', e.target.value);
                  setParams(params, { replace: true });
                }}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <select className="select !pr-8 !text-xs" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
              <option value="all">Proposals & quotes</option>
              <option value="proposal">Proposals only</option>
              <option value="quote">Quotes only</option>
            </select>
            <select className="select !pr-8 !text-xs" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Filter by client">
              <option value="all">All clients</option>
              {(collections.clients || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
            <Segmented
              size="sm"
              ariaLabel="Change layout"
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: '', icon: Rows3 },
                { value: 'cards', label: '', icon: LayoutGrid },
              ]}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] lg:ml-auto">
            {filtered.length} of {proposals.length} shown
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={FileText}
              title={proposals.length ? 'No proposals match these filters' : 'Send your first proposal'}
              description={
                proposals.length
                  ? 'Try clearing the search or switching the status filter.'
                  : 'Pick a client, describe the scope, add hourly lines or tiered packages, upload your logo and send a signable link.'
              }
              action={
                proposals.length ? (
                  <Button variant="outline" icon={Filter} onClick={() => { setQ(''); setStatus('all'); setType('all'); setClientId('all'); }}>
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="primary" icon={Plus} onClick={() => navigate('/app/proposals/new')}>
                    New proposal
                  </Button>
                )
              }
            />
          </div>
        ) : view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Title</th>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Total</th>
                  <th scope="col">Valid until</th>
                  <th scope="col" className="num">Views</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const expiring = p.validUntil && daysBetween(p.validUntil, todayISO()) <= 7 && daysBetween(p.validUntil, todayISO()) >= 0;
                  const expired = p.validUntil && daysBetween(p.validUntil, todayISO()) < 0 && p.status !== 'accepted';
                  return (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap font-mono text-xs font-semibold">{p.number}</td>
                      <td className="max-w-[18rem]">
                        <Link to={`/app/proposals/${p.id}`} className="block truncate font-semibold hover:text-[var(--color-brand-600)]">
                          {p.title}
                        </Link>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-[var(--text-muted)]">
                          <Pill>{p.type === 'quote' ? 'Quote' : 'Proposal'}</Pill>
                          <span className="capitalize">{p.mode || 'hourly'}</span>
                          {expired && <Pill tone="red">expired</Pill>}
                          {expiring && <Pill tone="amber">expires soon</Pill>}
                        </span>
                      </td>
                      <td className="max-w-[11rem] truncate">{clientMap[p.clientId]?.company || <span className="text-[var(--text-muted)]">No client</span>}</td>
                      <td>
                        <StatusPill status={p.status} />
                      </td>
                      <td className="num whitespace-nowrap font-semibold">
                        {m(p.total, p.currency)}
                        {p.currency !== baseCurrency && <span className="ml-1 text-[0.68rem] text-[var(--text-muted)]">({mb(p.total, p.currency)})</span>}
                      </td>
                      <td className="whitespace-nowrap text-xs text-[var(--text-muted)]">{fmtDate(p.validUntil, locale)}</td>
                      <td className="num text-xs">{p.views || 0}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <IconButton icon={Share2} label={`Copy share link for ${p.number}`} size="sm" onClick={() => share(p)} />
                          <IconButton icon={FileDown} label={`Download PDF of ${p.number}`} size="sm" onClick={() => exportPdf(p)} />
                          <Dropdown
                            trigger={
                              <IconButton icon={MoreHorizontal} label={`More actions for ${p.number}`} size="sm" />
                            }
                          >
                            <MenuItem icon={ExternalLink} onClick={() => navigate(`/app/proposals/${p.id}`)}>
                              Open editor
                            </MenuItem>
                            <MenuItem icon={Copy} onClick={() => duplicate(p)}>
                              Duplicate
                            </MenuItem>
                            <MenuItem icon={Receipt} onClick={() => convert(p)}>
                              Convert to invoice
                            </MenuItem>
                            <MenuItem icon={ExternalLink} onClick={() => window.open(shareUrl(p.publicToken), '_blank', 'noopener')}>
                              Preview public link
                            </MenuItem>
                            <MenuItem icon={Trash2} tone="danger" onClick={() => confirmDelete(p, removeItem, toast)}>
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
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <article key={p.id} className={cx('card-flat flex flex-col p-4 transition-shadow hover:shadow-[var(--shadow-pop)]')}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">{p.number}</span>
                  <StatusPill status={p.status} />
                </div>
                <Link to={`/app/proposals/${p.id}`} className="mt-2 line-clamp-2 font-display text-base font-bold hover:text-[var(--color-brand-600)]">
                  {p.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{p.objective || p.scopeSummary}</p>
                <p className="mt-3 text-sm font-bold">{m(p.total, p.currency)}</p>
                <p className="text-xs text-[var(--text-muted)]">{clientMap[p.clientId]?.company || 'No client'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3">
                  <Button size="sm" variant="outline" icon={FileDown} onClick={() => exportPdf(p)}>
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" icon={Share2} onClick={() => share(p)}>
                    Link
                  </Button>
                  <Button size="sm" variant="outline" icon={Receipt} onClick={() => convert(p)}>
                    Invoice
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Search className="h-3.5 w-3.5" aria-hidden />
        Tip: press <span className="kbd">Ctrl</span> + <span className="kbd">K</span> to jump to any proposal, client or invoice.
      </p>
    </>
  );
}

function compactMb(value, mb) {
  return mb(value);
}

function confirmDelete(p, removeItem, toast) {
  if (!window.confirm(`Delete ${p.number} “${p.title}”? This cannot be undone.`)) return;
  removeItem('proposals', p.id);
  toast(`Deleted ${p.number}`);
}
