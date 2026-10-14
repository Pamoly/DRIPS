import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Eye,
  FileDown,
  FileText,
  Image as ImageIcon,
  Link2,
  Mail,
  Palette,
  Plus,
  Printer,
  Receipt,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { shareUrl } from '../lib/api';
import { addDays, copyText, cx, fmtDate, fmtDateTime, round2, todayISO, uid } from '../lib/format';
import { CURRENCIES } from '../lib/currencies';
import { VAT_RATES } from '../lib/tax';
import { proposalPDF, savePdf } from '../lib/pdf';
import { DocumentPreview } from '../components/DocumentPreview';
import { LogoUpload } from '../components/LogoUpload';
import {
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  Field,
  IconButton,
  Input,
  MenuItem,
  Modal,
  MoneyInput,
  PageHeader,
  Pill,
  SectionTitle,
  Segmented,
  Select,
  StatusPill,
  Textarea,
  Toggle,
} from '../components/ui';

/* --------------------------------- helpers -------------------------------- */

function recalc(doc) {
  let subtotal = 0;
  if (doc.mode === 'packages') {
    const chosen = (doc.packages || [])[Number(doc.selectedPackage) || 0] || (doc.packages || [])[0];
    subtotal = chosen ? round2(chosen.price) * (Number(chosen.qty) || 1) : 0;
  } else if (doc.mode === 'fixed') {
    subtotal = round2(doc.fixedPrice);
  } else {
    subtotal = (doc.items || []).reduce((s, it) => s + round2(it.qty) * round2(it.rate), 0);
  }
  const discount = doc.discount || { type: 'percent', value: 0 };
  const discountValue = discount.type === 'percent' ? round2((subtotal * Number(discount.value || 0)) / 100) : round2(discount.value);
  const net = Math.max(0, round2(subtotal - discountValue));
  const taxRate = Number(doc.taxRate) || 0;
  const taxTotal = round2((net * taxRate) / 100);
  return { ...doc, subtotal: round2(subtotal), discountValue, net, taxRate, taxTotal, total: round2(net + taxTotal) };
}

function blankDoc(settings, clients = []) {
  const today = todayISO();
  const packages = settings?.defaults?.starterPackages?.length
    ? settings.defaults.starterPackages
    : [
        { id: uid('pk'), name: 'Essentials', tagline: 'The focused starting point', price: 2500, qty: 1, features: ['Kick-off call', 'Core deliverable', '1 feedback round'], selected: false, featured: false },
        { id: uid('pk'), name: 'Growth', tagline: 'The recommended balance', price: 5400, qty: 1, features: ['Everything in Essentials', 'Extended scope', '2 feedback rounds', 'Launch support'], selected: true, featured: true },
        { id: uid('pk'), name: 'Scale', tagline: 'Full partnership', price: 9800, qty: 1, features: ['Everything in Growth', 'Priority capacity', 'Monthly review'], selected: false, featured: false },
      ];
  return recalc({
    id: '',
    number: '',
    type: 'proposal',
    title: '',
    clientId: clients.length === 1 ? clients[0].id : '',
    projectId: '',
    status: 'draft',
    currency: settings?.locale?.baseCurrency || 'EUR',
    mode: 'hourly',
    items: [{ id: uid('it'), description: '', detail: '', qty: 1, unit: 'hours', rate: Number(settings?.defaults?.hourlyRate) || 85 }],
    packages,
    selectedPackage: 1,
    fixedPrice: 0,
    objective: '',
    scopeSummary: '',
    intro: settings?.defaults?.proposalIntro || '',
    deliverables: [],
    timeline: '',
    milestones: [],
    discount: { type: 'percent', value: 0 },
    taxRate: Number(settings?.tax?.vatRate ?? 21),
    validUntil: addDays(today, Number(settings?.defaults?.validityDays) || 30).toISOString().slice(0, 10),
    paymentTerms: Number(settings?.defaults?.paymentTermsDays) || 14,
    notes: '',
    terms: settings?.defaults?.proposalTerms || '',
    views: 0,
    createdAt: new Date().toISOString(),
  });
}

const UNITS = ['hours', 'days', 'weeks', 'pieces', 'package', 'project'];
const STATUS_OPTIONS = ['draft', 'sent', 'viewed', 'accepted', 'invoiced', 'declined', 'expired'];

/* ---------------------------------- page ---------------------------------- */

export default function ProposalEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = useApp();
  const { collections, settings, clientMap, addItem, updateItem, removeItem, convertProposal, duplicateProposal, toast, locale } = app;
  const { m } = useMoney();
  const isNew = !id || id === 'new';
  const existing = useMemo(() => (collections.proposals || []).find((p) => p.id === id), [collections.proposals, id]);

  const [doc, setDoc] = useState(() => (isNew ? blankDoc(settings, collections.clients || []) : recalc({ ...existing })));
  const [savedAt, setSavedAt] = useState(existing ? existing.updatedAt : null);
  const [dirty, setDirty] = useState(false);
  const [previewTab, setPreviewTab] = useState('preview');
  const [printOpen, setPrintOpen] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const createdRef = useRef(false);
  const firstRender = useRef(true);

  /* re-sync when navigating between proposals */
  useEffect(() => {
    if (!isNew && existing && existing.id !== doc.id) {
      setDoc(recalc({ ...existing }));
      setSavedAt(existing.updatedAt);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, existing?.id]);

  /* autosave (debounced) */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return undefined;
    }
    if (isNew || !doc.id) return undefined;
    const t = setTimeout(() => {
      updateItem('proposals', doc.id, doc, { debounce: 0 });
      setSavedAt(new Date().toISOString());
      setDirty(false);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const patch = (changes) => {
    setDoc((d) => recalc({ ...d, ...changes }));
    setDirty(true);
  };

  const setItem = (index, changes) =>
    patch({ items: (doc.items || []).map((it, i) => (i === index ? { ...it, ...changes } : it)) });
  const setPackage = (index, changes) =>
    patch({ packages: (doc.packages || []).map((p, i) => (i === index ? { ...p, ...changes } : p)) });

  const client = clientMap[doc.clientId] || null;

  const createDoc = async () => {
    if (createdRef.current) return doc;
    createdRef.current = true;
    try {
      const saved = await addItem('proposals', { ...doc, id: undefined });
      toast(`Saved ${saved.number} — share it or download the PDF`);
      navigate(`/app/proposals/${saved.id}`, { replace: true });
      return saved;
    } catch (err) {
      createdRef.current = false;
      toast(`Could not save: ${err.message}`, 'error');
      return null;
    }
  };

  const exportPdf = async () => {
    const target = doc.id ? doc : await createDoc();
    if (!target) return;
    const pdf = proposalPDF(target, { client: clientMap[target.clientId], settings });
    savePdf(pdf, `${target.number || 'proposal'}-${(target.title || 'document').replace(/\s+/g, '-').toLowerCase()}`);
    toast('Branded PDF downloaded');
  };

  const copyLink = async () => {
    const target = doc.id ? doc : await createDoc();
    if (!target) return;
    const url = shareUrl(target.publicToken);
    await copyText(url);
    toast('Signable link copied to clipboard', 'success', {
      action: { label: 'Open', onClick: () => window.open(url, '_blank', 'noopener') },
    });
  };

  const emailLink = async () => {
    const target = doc.id ? doc : await createDoc();
    if (!target) return;
    const url = shareUrl(target.publicToken);
    const c = clientMap[target.clientId];
    const subject = encodeURIComponent(`${target.type === 'quote' ? 'Quote' : 'Proposal'} ${target.number} — ${target.title}`);
    const body = encodeURIComponent(
      `Hi ${c?.name?.split(' ')[0] || 'there'},\n\n${target.intro || settings?.defaults?.proposalIntro || ''}\n\nYou can review and accept it here: ${url}\n\nKind regards,\n${settings?.business?.owner || settings?.business?.name || ''}`,
    );
    window.location.href = `mailto:${c?.email || ''}?subject=${subject}&body=${body}`;
    patch({ status: 'sent' });
    if (target.id) updateItem('proposals', target.id, { status: 'sent' });
    toast('Email draft opened — status set to “sent”');
  };

  const markSent = async () => {
    const target = doc.id ? doc : await createDoc();
    if (!target) return;
    patch({ status: 'sent' });
    if (target.id) updateItem('proposals', target.id, { status: 'sent' }, { debounce: 0 });
    toast('Marked as sent');
  };

  const convert = async () => {
    const target = doc.id ? doc : await createDoc();
    if (!target?.id) return;
    try {
      const invoice = await convertProposal(target.id);
      toast(`Invoice ${invoice.number} created`);
      navigate(`/app/invoices?focus=${invoice.id}`);
    } catch (err) {
      toast(`Could not convert: ${err.message}`, 'error');
    }
  };

  const duplicate = async () => {
    if (!doc.id) return;
    const copy = await duplicateProposal(doc.id);
    toast(`Duplicated as ${copy.number}`);
    navigate(`/app/proposals/${copy.id}`);
  };

  const importUnbilledTime = () => {
    const entries = (collections.timeEntries || []).filter(
      (t) => t.billable && !t.invoiced && (!doc.clientId || t.clientId === doc.clientId),
    );
    if (!entries.length) {
      toast('No unbilled billable time found for this client', 'error');
      return;
    }
    const grouped = entries.reduce((acc, e) => {
      const key = e.description || 'Tracked work';
      acc[key] = acc[key] || { hours: 0, rate: e.rate || settings?.defaults?.hourlyRate || 85 };
      acc[key].hours += (e.minutes || 0) / 60;
      return acc;
    }, {});
    const items = Object.entries(grouped).map(([description, v]) => ({
      id: uid('it'),
      description,
      detail: `Imported from the time tracker (${entries.length} entries)`,
      qty: round2(v.hours),
      unit: 'hours',
      rate: round2(v.rate),
    }));
    patch({ items, mode: 'hourly' });
    toast(`Imported ${items.length} line${items.length > 1 ? 's' : ''} from tracked time`);
  };

  const business = settings?.business || {};
  const brand = settings?.brand || {};
  const setBusiness = (changes) => app.updateSettings({ business: changes });
  const setBrand = (changes) => app.updateSettings({ brand: changes });

  const totalLabel = doc.mode === 'packages' ? (doc.packages?.[doc.selectedPackage]?.name || 'Selected package') : doc.mode === 'fixed' ? 'Fixed price' : `${(doc.items || []).length} line items`;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Link to="/app/proposals" className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft className="h-3 w-3" aria-hidden /> Proposals & Quotes
            </Link>
            <span aria-hidden>·</span>
            <span>{doc.number || 'New document'}</span>
          </span>
        }
        title={doc.title || (doc.type === 'quote' ? 'New quote' : 'New proposal')}
        subtitle="Everything you set here prints on the PDF and the public signing link — logo, KvK number, tax ID, scope, packages and terms."
        icon={FileText}
        actions={
          <>
            <span className={cx('hidden items-center gap-1.5 text-xs font-semibold sm:flex', dirty ? 'text-[var(--color-amber-brand-500)]' : 'text-[var(--color-mint-500)]')}>
              {dirty ? <Save className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {isNew ? 'Not saved yet' : dirty ? 'Saving…' : `Saved ${savedAt ? fmtDateTime(savedAt, locale) : ''}`}
            </span>
            <Button variant="outline" icon={Printer} onClick={() => setPrintOpen(true)}>
              Print
            </Button>
            <Button variant="outline" icon={FileDown} onClick={exportPdf}>
              PDF
            </Button>
            {isNew ? (
              <Button variant="primary" icon={Save} onClick={createDoc}>
                Save proposal
              </Button>
            ) : (
              <Dropdown
                trigger={
                  <Button variant="primary" icon={Share2}>
                    Share & send
                  </Button>
                }
              >
                <MenuItem icon={Link2} onClick={copyLink}>
                  Copy signable link
                </MenuItem>
                <MenuItem icon={Mail} onClick={emailLink}>
                  Draft client email
                </MenuItem>
                <MenuItem icon={Check} onClick={markSent}>
                  Mark as sent
                </MenuItem>
                <MenuItem icon={Receipt} onClick={convert}>
                  Convert to invoice
                </MenuItem>
                <MenuItem icon={Copy} onClick={duplicate}>
                  Duplicate document
                </MenuItem>
                <MenuItem icon={Trash2} tone="danger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </MenuItem>
              </Dropdown>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        {/* ------------------------------ form ------------------------------ */}
        <div className="space-y-4">
          {/* document basics */}
          <Card className="pad">
            <SectionTitle>1 · Document</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Document type">
                <Segmented
                  className="w-full"
                  value={doc.type}
                  onChange={(v) => patch({ type: v })}
                  ariaLabel="Document type"
                  options={[
                    { value: 'proposal', label: 'Proposal', icon: FileText },
                    { value: 'quote', label: 'Quote', icon: Receipt },
                  ]}
                />
              </Field>
              <Field label="Status">
                <Select value={doc.status} onChange={(e) => patch({ status: e.target.value })} aria-label="Status">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title" className="sm:col-span-2" required hint="Shown as the document headline, e.g. “Platform redesign & design system”.">
                <Input value={doc.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Project or engagement title" required />
              </Field>
              <Field label="Client" hint={!client ? 'Select a client or create one — their address, KvK and VAT number print on the document.' : undefined}>
                <div className="flex gap-2">
                  <Select value={doc.clientId} onChange={(e) => patch({ clientId: e.target.value })} aria-label="Client">
                    <option value="">— No client selected —</option>
                    {(collections.clients || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company || c.name}
                      </option>
                    ))}
                  </Select>
                  <Button variant="outline" icon={Plus} onClick={() => setClientModal(true)} aria-label="Add a new client">
                    <span className="sr-only sm:not-sr-only">New</span>
                  </Button>
                </div>
              </Field>
              <Field label="Project (optional)">
                <Select value={doc.projectId || ''} onChange={(e) => patch({ projectId: e.target.value })} aria-label="Project">
                  <option value="">— Not linked —</option>
                  {(collections.projects || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency" hint="Every document keeps its own currency.">
                <Select value={doc.currency} onChange={(e) => patch({ currency: e.target.value })} aria-label="Currency">
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Valid until">
                <Input type="date" value={doc.validUntil || ''} onChange={(e) => patch({ validUntil: e.target.value })} />
              </Field>
              <Field label="Payment terms (days)">
                <Input type="number" min="0" step="1" value={doc.paymentTerms ?? 14} onChange={(e) => patch({ paymentTerms: Number(e.target.value) })} />
              </Field>
              <Field label="Document number" hint="Auto-generated from your numbering settings.">
                <Input value={doc.number || '(assigned on save)'} onChange={(e) => patch({ number: e.target.value })} placeholder="PROP-2026-001" />
              </Field>
            </div>
          </Card>

          {/* business identity */}
          <Card className="pad">
            <SectionTitle
              action={
                <Link to="/app/settings" className="text-xs font-semibold text-[var(--color-brand-600)] hover:underline">
                  All settings
                </Link>
              }
            >
              2 · Your business identity & branding
            </SectionTitle>
            <p className="-mt-1 mb-3 text-xs text-[var(--text-muted)]">
              Saved to your workspace, so every proposal, quote, invoice and public link uses the same identity.
            </p>

            <LogoUpload
              className="mb-4"
              value={business.logoDataUrl}
              name={business.logoName}
              onChange={(dataUrl, name) => {
                setBusiness({ logoDataUrl: dataUrl, logoName: name });
                if (dataUrl) toast('Logo uploaded — it now appears on your documents');
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name" required>
                <Input value={business.name || ''} onChange={(e) => setBusiness({ name: e.target.value })} placeholder="Studio Noordzij" />
              </Field>
              <Field label="Owner / signatory">
                <Input value={business.owner || ''} onChange={(e) => setBusiness({ owner: e.target.value })} placeholder="Mila Noordzij" />
              </Field>

              <Field
                label="Business registration number (KvK)"
                hint="Printed as “Chamber of Commerce (KvK)” on every document."
                className="sm:col-span-1"
              >
                <Input
                  value={business.regNumber || ''}
                  onChange={(e) => setBusiness({ regNumber: e.target.value })}
                  placeholder="8742 1930"
                  inputMode="numeric"
                  autoComplete="organization"
                />
              </Field>
              <Field label="Tax ID / VAT number (BTW-id)" hint="Used on invoices and required for EU reverse-charge quotes.">
                <Input
                  value={business.taxId || ''}
                  onChange={(e) => setBusiness({ taxId: e.target.value })}
                  placeholder="NL0038.12.947.B01"
                  autoComplete="off"
                />
              </Field>

              <Field label="Email">
                <Input type="email" value={business.email || ''} onChange={(e) => setBusiness({ email: e.target.value })} placeholder="hello@studio.nl" />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={business.phone || ''} onChange={(e) => setBusiness({ phone: e.target.value })} placeholder="+31 6 12 34 56 78" />
              </Field>
              <Field label="Website">
                <Input value={business.website || ''} onChange={(e) => setBusiness({ website: e.target.value })} placeholder="studiounaam.nl" />
              </Field>
              <Field label="IBAN (for invoices)">
                <Input value={business.iban || ''} onChange={(e) => setBusiness({ iban: e.target.value })} placeholder="NL12 ABNA 0483 9201 44" />
              </Field>
              <Field label="Street & number">
                <Input value={business.street || ''} onChange={(e) => setBusiness({ street: e.target.value })} placeholder="Schiedamse Vest 152" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Postal code">
                  <Input value={business.postalCode || ''} onChange={(e) => setBusiness({ postalCode: e.target.value })} placeholder="3011 BH" />
                </Field>
                <Field label="City">
                  <Input value={business.city || ''} onChange={(e) => setBusiness({ city: e.target.value })} placeholder="Rotterdam" />
                </Field>
              </div>
              <Field label="Country">
                <Input value={business.country || ''} onChange={(e) => setBusiness({ country: e.target.value })} placeholder="Netherlands" />
              </Field>

              <Field label="Brand colours" hint="These are the Dutch-flag defaults — change them to match your own identity.">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="color"
                      className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent p-1"
                      value={brand.primary || '#AE1C28'}
                      onChange={(e) => setBrand({ primary: e.target.value })}
                      aria-label="Primary brand colour"
                    />
                    Primary
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="color"
                      className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent p-1"
                      value={brand.secondary || '#21468B'}
                      onChange={(e) => setBrand({ secondary: e.target.value })}
                      aria-label="Secondary brand colour"
                    />
                    Secondary
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Palette}
                    onClick={() => {
                      setBrand({ primary: '#AE1C28', secondary: '#21468B', documentAccent: '#0E1B3D' });
                      toast('Dutch-flag palette restored');
                    }}
                  >
                    Reset to flag
                  </Button>
                </div>
              </Field>
            </div>
          </Card>

          {/* client */}
          <Card className="pad">
            <SectionTitle
              action={
                client ? (
                  <Link to={`/app/clients?focus=${client.id}`} className="text-xs font-semibold text-[var(--color-brand-600)] hover:underline">
                    Open in CRM
                  </Link>
                ) : (
                  <Button size="sm" variant="outline" icon={Users} onClick={() => setClientModal(true)}>
                    Add client
                  </Button>
                )
              }
            >
              3 · Client details (bill-to)
            </SectionTitle>
            {client ? (
              <ClientFields client={client} onChange={(changes) => app.updateItem('clients', client.id, changes)} />
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--text-muted)]">
                No client selected. The document will still work, but adding a client prints their company, address,
                KvK and VAT number on the PDF and lets you track lifetime value in the CRM.
              </p>
            )}
          </Card>

          {/* scope */}
          <Card className="pad">
            <SectionTitle>4 · Scope of work</SectionTitle>
            <div className="grid gap-3">
              <Field label="Opening line" hint="A warm first paragraph — pre-filled from your default template.">
                <Textarea value={doc.intro || ''} onChange={(e) => patch({ intro: e.target.value })} rows={2} />
              </Field>
              <Field label="Objective" hint="What outcome does the client buy? One or two sentences.">
                <Textarea value={doc.objective || ''} onChange={(e) => patch({ objective: e.target.value })} rows={2} placeholder="Cut onboarding time from 3 days to under 4 hours…" />
              </Field>
              <Field label="Scope summary" hint="What is included, in plain language.">
                <Textarea value={doc.scopeSummary || ''} onChange={(e) => patch({ scopeSummary: e.target.value })} rows={3} />
              </Field>
              <Field label="Deliverables" hint="One per line — rendered as a checklist on the document.">
                <Textarea
                  value={(doc.deliverables || []).join('\n')}
                  onChange={(e) => patch({ deliverables: e.target.value.split('\n') })}
                  rows={3}
                  placeholder={'Research report\nFigma design system\nEngineering handoff pack'}
                />
              </Field>
              <Field label="Timeline">
                <Input value={doc.timeline || ''} onChange={(e) => patch({ timeline: e.target.value })} placeholder="8 weeks, starting 2 November" />
              </Field>
            </div>
          </Card>

          {/* pricing */}
          <Card className="pad">
            <SectionTitle
              action={
                <Pill tone="blue">
                  <Sparkles className="h-3 w-3" aria-hidden /> {totalLabel}
                </Pill>
              }
            >
              5 · Pricing
            </SectionTitle>

            <Segmented
              className="mb-4 w-full"
              ariaLabel="Pricing model"
              value={doc.mode}
              onChange={(v) => patch({ mode: v })}
              options={[
                { value: 'hourly', label: 'Hourly rates' },
                { value: 'packages', label: 'Tiered packages' },
                { value: 'fixed', label: 'Fixed price' },
              ]}
            />

            {doc.mode === 'hourly' && (
              <div className="space-y-2.5">
                {(doc.items || []).map((it, i) => (
                  <div key={it.id || i} className="rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_1.5%,transparent)] p-2.5">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_5rem_6.5rem_7rem_2rem] sm:items-center">
                      <Input value={it.description || ''} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Line item, e.g. UX architecture" aria-label={`Item ${i + 1} description`} />
                      <Input value={it.detail || ''} onChange={(e) => setItem(i, { detail: e.target.value })} placeholder="Details (optional)" aria-label={`Item ${i + 1} details`} />
                      <Input type="number" min="0" step="0.25" value={it.qty ?? 0} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} aria-label={`Item ${i + 1} quantity`} className="tnum" />
                      <Select value={it.unit || 'hours'} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label={`Item ${i + 1} unit`}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                      <MoneyInput value={it.rate ?? 0} onChange={(v) => setItem(i, { rate: v })} currency={doc.currency} aria-label={`Item ${i + 1} rate`} />
                      <IconButton icon={Trash2} label={`Remove item ${i + 1}`} size="sm" onClick={() => patch({ items: doc.items.filter((_, x) => x !== i) })} />
                    </div>
                    <p className="mt-1.5 text-right text-xs font-semibold text-[var(--text-muted)]">
                      {m(round2(it.qty) * round2(it.rate), doc.currency)}
                    </p>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" icon={Plus} onClick={() => patch({ items: [...(doc.items || []), { id: uid('it'), description: '', detail: '', qty: 1, unit: 'hours', rate: Number(client?.hourlyRate || settings?.defaults?.hourlyRate) || 85 }] })}>
                    Add line item
                  </Button>
                  <Button size="sm" variant="ghost" icon={Receipt} onClick={importUnbilledTime}>
                    Import unbilled time
                  </Button>
                  {client?.hourlyRate && (
                    <Button size="sm" variant="ghost" onClick={() => patch({ items: (doc.items || []).map((it) => ({ ...it, rate: client.hourlyRate })) })}>
                      Apply client rate ({m(client.hourlyRate, doc.currency)}/h)
                    </Button>
                  )}
                </div>
              </div>
            )}

            {doc.mode === 'packages' && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Offer good / better / best. The tier you mark as recommended is the one priced, printed as “selected”
                  and used when the client accepts.
                </p>
                {(doc.packages || []).map((p, i) => (
                  <div
                    key={p.id || i}
                    className={cx('rounded-xl border p-3', Number(doc.selectedPackage) === i ? 'border-[var(--color-flag-700)] bg-[color-mix(in_srgb,var(--color-flag-700)_5%,transparent)]' : 'border-[var(--line)]')}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-bold">
                        <input
                          type="radio"
                          name="selected-package"
                          className="h-4 w-4 accent-[#AE1C28]"
                          checked={Number(doc.selectedPackage) === i}
                          onChange={() => patch({ selectedPackage: i })}
                        />
                        Recommended
                      </label>
                      <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_8rem]">
                        <Input value={p.name || ''} onChange={(e) => setPackage(i, { name: e.target.value })} placeholder="Package name" aria-label={`Package ${i + 1} name`} />
                        <Input value={p.tagline || ''} onChange={(e) => setPackage(i, { tagline: e.target.value })} placeholder="Short tagline" aria-label={`Package ${i + 1} tagline`} />
                        <MoneyInput value={p.price ?? 0} onChange={(v) => setPackage(i, { price: v })} currency={doc.currency} aria-label={`Package ${i + 1} price`} />
                      </div>
                      <IconButton icon={Trash2} label={`Remove package ${p.name || i + 1}`} size="sm" onClick={() => patch({ packages: doc.packages.filter((_, x) => x !== i), selectedPackage: Math.max(0, Math.min(doc.selectedPackage, doc.packages.length - 2)) })} />
                    </div>
                    <Textarea
                      className="mt-2"
                      rows={3}
                      value={(p.features || []).join('\n')}
                      onChange={(e) => setPackage(i, { features: e.target.value.split('\n') })}
                      placeholder={'One feature per line\nKick-off workshop\nHi-fi designs for 6 screens'}
                      aria-label={`Package ${i + 1} features`}
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  icon={Plus}
                  onClick={() =>
                    patch({
                      packages: [...(doc.packages || []), { id: uid('pk'), name: `Package ${(doc.packages || []).length + 1}`, tagline: '', price: 0, qty: 1, features: [], selected: false, featured: false }],
                    })
                  }
                >
                  Add package tier
                </Button>
              </div>
            )}

            {doc.mode === 'fixed' && (
              <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                <Field label="Fixed price" hint="Excluding discount and VAT.">
                  <MoneyInput value={doc.fixedPrice ?? 0} onChange={(v) => patch({ fixedPrice: v })} currency={doc.currency} />
                </Field>
                <Field label="What the fixed price covers" hint="Optional — appears as a single line item on the document.">
                  <Textarea
                    rows={2}
                    value={doc.scopeSummary || ''}
                    onChange={(e) => patch({ scopeSummary: e.target.value })}
                    placeholder="Design, two feedback rounds and handoff."
                  />
                </Field>
              </div>
            )}

            <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-3">
              <Field label="Discount type">
                <Select value={doc.discount?.type || 'percent'} onChange={(e) => patch({ discount: { ...doc.discount, type: e.target.value } })} aria-label="Discount type">
                  <option value="percent">Percentage</option>
                  <option value="amount">Fixed amount</option>
                  <option value="none">No discount</option>
                </Select>
              </Field>
              <Field label={doc.discount?.type === 'amount' ? `Discount (${doc.currency})` : 'Discount (%)'}>
                {doc.discount?.type === 'amount' ? (
                  <MoneyInput value={doc.discount?.value ?? 0} onChange={(v) => patch({ discount: { ...doc.discount, value: v } })} currency={doc.currency} />
                ) : (
                  <Input type="number" min="0" max="100" step="0.5" value={doc.discount?.value ?? 0} onChange={(e) => patch({ discount: { ...doc.discount, value: Number(e.target.value) } })} />
                )}
              </Field>
              <Field label="VAT rate" hint="Use 0% for reverse charge, exports or KOR clients.">
                <Select value={String(doc.taxRate ?? 21)} onChange={(e) => patch({ taxRate: Number(e.target.value) })} aria-label="VAT rate">
                  {VAT_RATES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <dl className="mt-4 grid gap-2 rounded-xl bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-3 text-sm sm:grid-cols-2">
              {[
                ['Subtotal', m(doc.subtotal, doc.currency)],
                ['Discount', `− ${m(doc.discountValue, doc.currency)}`],
                [`VAT ${doc.taxRate}%`, m(doc.taxTotal, doc.currency)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-muted)]">{k}</dt>
                  <dd className="tnum font-semibold">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-white sm:col-span-2" style={{ background: brand.documentAccent || '#0E1B3D' }}>
                <dt className="font-bold">Total {doc.currency}</dt>
                <dd className="tnum font-display text-lg font-extrabold">{m(doc.total, doc.currency)}</dd>
              </div>
            </dl>
          </Card>

          {/* milestones */}
          <Card className="pad">
            <SectionTitle
              action={
                <Button size="sm" variant="outline" icon={Plus} onClick={() => patch({ milestones: [...(doc.milestones || []), { id: uid('ms'), name: '', due: todayISO(), amount: 0, note: '' }] })}>
                  Add milestone
                </Button>
              }
            >
              6 · Payment schedule
            </SectionTitle>
            {(doc.milestones || []).length === 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 text-sm text-[var(--text-muted)]">
                  Split the total into milestones (for example 30% deposit, 40% concept approval, 30% handoff).
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Sparkles}
                  onClick={() =>
                    patch({
                      milestones: [
                        { id: uid('ms'), name: 'Deposit on acceptance', due: todayISO(), amount: 30, note: 'Secures the start date' },
                        { id: uid('ms'), name: 'Mid-project review', due: addDays(todayISO(), 21).toISOString().slice(0, 10), amount: 40, note: '' },
                        { id: uid('ms'), name: 'Final delivery', due: addDays(todayISO(), 45).toISOString().slice(0, 10), amount: 30, note: '' },
                      ],
                    })
                  }
                >
                  Use 30/40/30 template
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {(doc.milestones || []).map((ms, i) => (
                  <li key={ms.id || i} className="grid gap-2 rounded-xl border border-[var(--line)] p-2.5 sm:grid-cols-[minmax(0,2fr)_9rem_5rem_minmax(0,1.4fr)_2rem] sm:items-center">
                    <Input value={ms.name || ''} onChange={(e) => patch({ milestones: doc.milestones.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)) })} placeholder="Milestone name" aria-label={`Milestone ${i + 1} name`} />
                    <Input type="date" value={ms.due || ''} onChange={(e) => patch({ milestones: doc.milestones.map((x, xi) => (xi === i ? { ...x, due: e.target.value } : x)) })} aria-label={`Milestone ${i + 1} date`} />
                    <Input type="number" min="0" max="100" value={ms.amount ?? 0} onChange={(e) => patch({ milestones: doc.milestones.map((x, xi) => (xi === i ? { ...x, amount: Number(e.target.value) } : x)) })} aria-label={`Milestone ${i + 1} percentage`} className="tnum" />
                    <Input value={ms.note || ''} onChange={(e) => patch({ milestones: doc.milestones.map((x, xi) => (xi === i ? { ...x, note: e.target.value } : x)) })} placeholder="Note" aria-label={`Milestone ${i + 1} note`} />
                    <div className="flex items-center justify-between gap-1">
                      <span className="tnum text-xs font-semibold text-[var(--text-muted)]">{m(((doc.total || 0) * (ms.amount || 0)) / 100, doc.currency)}</span>
                      <IconButton icon={Trash2} label={`Remove milestone ${i + 1}`} size="sm" onClick={() => patch({ milestones: doc.milestones.filter((_, xi) => xi !== i) })} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {doc.milestones?.length > 0 && (
              <p className={cx('mt-2 text-xs font-semibold', round2(doc.milestones.reduce((s, x) => s + (Number(x.amount) || 0), 0)) === 100 ? 'text-[var(--color-mint-600)]' : 'text-[var(--color-amber-brand-500)]')}>
                Milestones add up to {round2(doc.milestones.reduce((s, x) => s + (Number(x.amount) || 0), 0))}% of the total.
              </p>
            )}
          </Card>

          {/* notes & terms */}
          <Card className="pad">
            <SectionTitle>7 · Notes & terms</SectionTitle>
            <div className="grid gap-3">
              <Field label="Notes for the client" hint="Assumptions, exclusions, what happens after acceptance.">
                <Textarea value={doc.notes || ''} onChange={(e) => patch({ notes: e.target.value })} rows={3} />
              </Field>
              <Field label="Terms & conditions" hint="Stored in Settings → Defaults so you only write them once.">
                <Textarea value={doc.terms || ''} onChange={(e) => patch({ terms: e.target.value })} rows={4} />
              </Field>
              <Toggle
                checked={!!doc.showSignatureBlock}
                onChange={(v) => patch({ showSignatureBlock: v })}
                label="Show a signature block on the document"
                description="Useful for offline signing; the online link always records an acceptance stamp."
              />
            </div>
          </Card>

          {isNew && (
            <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-brand-200)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-pop)] lg:bottom-4">
              <p className="text-sm">
                <strong className="font-bold">Unsaved draft.</strong> Save it to get a document number and a shareable signing link.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => navigate('/app/proposals')}>
                  Discard
                </Button>
                <Button variant="primary" icon={Save} onClick={createDoc}>
                  Save proposal
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------- side panel --------------------------- */}
        <div className="space-y-4 xl:sticky xl:top-24">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-1 border-b border-[var(--line)] p-2">
              <Segmented
                size="sm"
                className="w-full"
                ariaLabel="Side panel"
                value={previewTab}
                onChange={setPreviewTab}
                options={[
                  { value: 'preview', label: 'Preview', icon: Eye },
                  { value: 'share', label: 'Share', icon: Share2 },
                ]}
              />
            </div>

            {previewTab === 'preview' ? (
              <div className="max-h-[70vh] overflow-y-auto bg-[color-mix(in_srgb,var(--text)_4%,transparent)] p-3">
                <DocumentPreview doc={doc} client={client} business={business} brand={brand} kind="proposal" compact />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" icon={FileDown} onClick={exportPdf}>
                    Download PDF
                  </Button>
                  <Button size="sm" variant="outline" icon={Printer} onClick={() => setPrintOpen(true)}>
                    Print
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                <div>
                  <p className="label">Public signing link</p>
                  <div className="flex gap-2">
                    <Input readOnly value={doc.publicToken ? shareUrl(doc.publicToken) : 'Save the proposal to generate a link'} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                    <Button variant="outline" icon={Copy} onClick={copyLink} disabled={!doc.publicToken} aria-label="Copy link" />
                  </div>
                  <p className="hint">Clients open this link, review the branded document and click Accept or Decline — no login needed.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-[var(--line)] p-3">
                    <p className="tnum font-display text-xl font-extrabold">{doc.views || 0}</p>
                    <p className="text-[0.68rem] uppercase tracking-wide text-[var(--text-muted)]">Link views</p>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] p-3">
                    <StatusPill status={doc.status} />
                    <p className="mt-1 text-[0.68rem] uppercase tracking-wide text-[var(--text-muted)]">Status</p>
                  </div>
                </div>

                {doc.status === 'accepted' && (
                  <p className="rounded-xl bg-[color-mix(in_srgb,var(--color-mint-500)_12%,transparent)] p-3 text-xs font-semibold text-[var(--color-mint-700)] dark:text-[#7fe0b6]">
                    Accepted by {doc.acceptedBy || 'the client'} on {fmtDate(doc.decidedAt || doc.acceptedAt, locale)}. Convert it to an invoice to get paid.
                  </p>
                )}
                {doc.status === 'declined' && doc.declineReason && (
                  <p className="rounded-xl bg-[color-mix(in_srgb,var(--color-flag-700)_10%,transparent)] p-3 text-xs font-semibold text-flag-800 dark:text-flag-200">
                    Declined: {doc.declineReason}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" icon={Eye} onClick={() => doc.publicToken && window.open(shareUrl(doc.publicToken), '_blank', 'noopener')} disabled={!doc.publicToken}>
                    Open link
                  </Button>
                  <Button size="sm" variant="outline" icon={Mail} onClick={emailLink}>
                    Email draft
                  </Button>
                  <Button size="sm" variant="primary" icon={Receipt} onClick={convert} disabled={!doc.id}>
                    To invoice
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="pad">
            <SectionTitle>Checklist before sending</SectionTitle>
            <ul className="space-y-2 text-sm">
              {[
                { ok: !!doc.title, label: 'Title added' },
                { ok: !!doc.clientId, label: 'Client selected' },
                { ok: !!business.logoDataUrl, label: 'Logo uploaded' },
                { ok: !!business.regNumber, label: 'KvK registration number' },
                { ok: !!business.taxId, label: 'Tax ID / VAT number' },
                { ok: doc.total > 0, label: 'Pricing filled in' },
                { ok: !!doc.validUntil, label: 'Validity date set' },
                { ok: !!doc.terms, label: 'Terms included' },
              ].map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span
                    className={cx('flex h-5 w-5 items-center justify-center rounded-full text-white', c.ok ? 'bg-[var(--color-mint-500)]' : 'bg-[color-mix(in_srgb,var(--text)_18%,transparent)]')}
                    aria-hidden
                  >
                    {c.ok ? <Check className="h-3 w-3" /> : <span className="text-[0.6rem]">•</span>}
                  </span>
                  <span className={cx(c.ok ? 'text-[var(--text-muted)] line-through decoration-[color-mix(in_srgb,var(--text)_30%,transparent)]' : 'font-medium')}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* quick client create */}
      <QuickClientModal
        open={clientModal}
        onClose={() => setClientModal(false)}
        onCreate={(client) => {
          patch({ clientId: client.id });
          setClientModal(false);
          toast(`${client.company || client.name} added to your CRM`);
        }}
      />

      {/* print view */}
      {printOpen && (
        <PrintModal onClose={() => setPrintOpen(false)}>
          <DocumentPreview doc={doc} client={client} business={business} brand={brand} kind="proposal" />
        </PrintModal>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${doc.number || 'this proposal'}?`}
        message="The document and its public link are removed permanently. Consider duplicating it first if you want to keep a copy."
        onConfirm={async () => {
          if (!doc.id) return navigate('/app/proposals');
          await removeItem('proposals', doc.id);
          toast('Proposal deleted');
          navigate('/app/proposals');
        }}
      />
    </>
  );
}

/* ------------------------------ sub components ----------------------------- */

function ClientFields({ client, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Company">
        <Input value={client.company || ''} onChange={(e) => onChange({ company: e.target.value })} />
      </Field>
      <Field label="Contact person">
        <Input value={client.name || ''} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Email">
        <Input type="email" value={client.email || ''} onChange={(e) => onChange({ email: e.target.value })} />
      </Field>
      <Field label="Phone">
        <Input value={client.phone || ''} onChange={(e) => onChange({ phone: e.target.value })} />
      </Field>
      <Field label="Street & number">
        <Input value={client.street || ''} onChange={(e) => onChange({ street: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Postal code">
          <Input value={client.postalCode || ''} onChange={(e) => onChange({ postalCode: e.target.value })} />
        </Field>
        <Field label="City">
          <Input value={client.city || ''} onChange={(e) => onChange({ city: e.target.value })} />
        </Field>
      </div>
      <Field label="Client registration number (KvK)">
        <Input value={client.regNumber || ''} onChange={(e) => onChange({ regNumber: e.target.value })} placeholder="6612 4483" />
      </Field>
      <Field label="Client tax ID / VAT">
        <Input value={client.taxId || ''} onChange={(e) => onChange({ taxId: e.target.value })} placeholder="NL8564.22.109.B01" />
      </Field>
    </div>
  );
}

function QuickClientModal({ open, onClose, onCreate }) {
  const { addItem, settings } = useApp();
  const [form, setForm] = useState({ company: '', name: '', email: '', phone: '', city: '', country: 'Netherlands', regNumber: '', taxId: '', status: 'lead', hourlyRate: settings?.defaults?.hourlyRate || 85 });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, company: '', name: '', email: '' }));
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a client"
      description="Saved to your CRM and used as the bill-to block on this document."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            disabled={!form.company && !form.name}
            onClick={async () => {
              const created = await addItem('clients', { ...form, tags: [], notes: '', createdAt: new Date().toISOString() });
              onCreate(created);
            }}
          >
            Add client
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company" required>
          <Input value={form.company} onChange={(e) => set('company', e.target.value)} autoFocus placeholder="Havenlab B.V." />
        </Field>
        <Field label="Contact person">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Sanne Boersma" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="sanne@havenlab.nl" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Rotterdam" />
        </Field>
        <Field label="Hourly rate">
          <MoneyInput value={form.hourlyRate} onChange={(v) => set('hourlyRate', v)} currency={settings?.locale?.baseCurrency || 'EUR'} />
        </Field>
        <Field label="KvK number">
          <Input value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} />
        </Field>
        <Field label="VAT / tax ID">
          <Input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function PrintModal({ onClose, children, title = 'Print document' }) {
  useEffect(() => {
    document.body.classList.add('printing-doc');
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('printing-doc');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div id="print-root" className="fixed inset-0 z-[75] overflow-auto bg-[color-mix(in_srgb,var(--text)_6%,var(--surface))]">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--color-brand-600)]" aria-hidden />
          <h2 className="text-sm font-bold">{title}</h2>
          <Pill tone="blue">Print preview</Pill>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={ImageIcon} onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-3 py-6">{children}</div>
    </div>,
    document.body,
  );
}
