import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  ThumbsDown,
} from 'lucide-react';
import { api } from '../lib/api';
import { localeFor } from '../lib/currencies';
import { daysBetween, fmtDate, fmtMoney, todayISO } from '../lib/format';
import { proposalPDF, savePdf } from '../lib/pdf';
import { DocumentPreview } from '../components/DocumentPreview';
import { LogoMark } from '../components/Brand';
import { Button, Card, Field, Input, Pill, SectionTitle, StatusPill, Textarea } from '../components/ui';

/**
 * Public, token-only view of one proposal or quote. No workspace, no login:
 * the client reads the document, can download it and sends a decision back.
 */
export default function PublicProposal() {
  const { shareToken } = useParams();
  const [state, setState] = useState({ loading: true, error: '' });
  const [form, setForm] = useState({ name: '', email: '', start: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const counted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.publicProposal(shareToken);
        if (cancelled) return;
        setState({ loading: false, error: '', ...res });
        const untouched = !['accepted', 'declined'].includes(res.proposal?.status);
        if (!counted.current && untouched) {
          counted.current = true;
          api.publicView(shareToken).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message || 'This link is no longer available.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-2)] px-4">
        <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading document…
        </p>
      </div>
    );
  }

  if (state.error || !state.proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-2)] px-4 py-16">
        <Card className="w-full max-w-lg p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-flag-700)_12%,transparent)] text-flag-700">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-4 font-display text-2xl font-extrabold">This link is no longer available</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {state.error} The sender may have withdrawn the document, or the link was replaced by a newer version.
          </p>
          <Link to="/" className="btn btn-primary mt-6 inline-flex">
            Back to DRIPS <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Card>
      </div>
    );
  }

  const { proposal, client, business = {}, brand = {}, locale: localeSettings } = state;
  const settings = { business, brand, locale: localeSettings };
  const numberLocale = localeSettings?.numberFormat === 'en' ? 'en-US' : 'nl-NL';
  const currency = proposal.currency || localeSettings?.baseCurrency || 'EUR';
  const locale = localeFor(currency, numberLocale);
  const money = (v) => fmtMoney(v, currency, locale);

  const expired = proposal.validUntil && daysBetween(proposal.validUntil, todayISO()) < 0;
  const daysLeft = proposal.validUntil ? daysBetween(proposal.validUntil, todayISO()) : null;
  const decided = ['accepted', 'declined'].includes(proposal.status);
  const accepted = proposal.status === 'accepted';

  const download = () => {
    savePdf(proposalPDF(proposal, { client, settings }), `${proposal.number || 'proposal'}-${client?.company || 'client'}`.replace(/[^\w.-]+/g, '-'));
  };

  const notice = (message, ok = false) => {
    const el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.textContent = message;
    el.className = ok
      ? 'fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-[var(--color-mint-500)] px-4 py-2 text-sm font-semibold text-white shadow-lg'
      : 'fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-[var(--color-flag-700)] px-4 py-2 text-sm font-semibold text-white shadow-lg';
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 4200);
  };

  const decide = async (decision) => {
    if (!form.name.trim()) {
      notice('Please add your name so they know who responded.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.publicDecision(shareToken, {
        decision,
        name: form.name.trim(),
        email: form.email.trim(),
        reason: decision === 'decline' ? form.reason.trim() : form.start,
      });
      setState((s) => ({ ...s, proposal: res.proposal }));
      notice(decision === 'decline' ? 'Thanks — your feedback was sent back.' : 'Accepted! Your confirmation is on its way.', decision !== 'decline');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      notice(err.message || 'Could not send your response. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas-2)] pb-16">
      <a
        href="#document"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--surface-card)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to document
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-card)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
            <LogoMark size={30} />
            DRIPS
          </Link>
          <span className="hidden min-w-0 truncate text-xs text-[var(--text-muted)] md:block">
            {proposal.type === 'quote' ? 'Quote' : 'Proposal'} {proposal.number ? `· ${proposal.number}` : ''} from {business.name}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {decided ? (
              <StatusPill status={proposal.status} />
            ) : expired ? (
              <Pill tone="red">Expired {fmtDate(proposal.validUntil, locale)}</Pill>
            ) : daysLeft !== null ? (
              <Pill tone={daysLeft <= 5 ? 'amber' : 'blue'}>Valid for {daysLeft} more day{daysLeft === 1 ? '' : 's'}</Pill>
            ) : null}
            <Button size="sm" variant="outline" icon={Download} onClick={download}>
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button size="sm" variant="ghost" icon={FileText} onClick={() => window.print()} aria-label="Print this document">
              Print
            </Button>
          </div>
        </div>
      </header>

      <main id="document" className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {decided ? (
          <Card className="mb-4 p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{
                  background: accepted ? 'color-mix(in srgb, var(--color-mint-500) 14%, transparent)' : 'color-mix(in srgb, var(--color-amber-brand-500) 16%, transparent)',
                  color: accepted ? 'var(--color-mint-600)' : 'var(--color-amber-brand-500)',
                }}
              >
                {accepted ? <CheckCircle2 className="h-5 w-5" /> : <ThumbsDown className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold">
                  {accepted ? 'Accepted' : 'Declined'}
                  {proposal.acceptedBy ? ` by ${proposal.acceptedBy}` : ''}
                  {proposal.decidedAt ? ` · ${fmtDate(proposal.decidedAt.slice(0, 10), locale)}` : ''}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {accepted
                    ? 'Thank you — your confirmation went straight back to the sender. They will follow up with the contract, the deposit invoice and the kick-off date.'
                    : proposal.declineReason
                      ? `You told them: “${proposal.declineReason}”. Thanks for the honest feedback — it helps them improve the next offer.`
                      : 'Thanks for letting them know. The document stays available here if you change your mind.'}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mb-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold">
                  Respond to this {proposal.type === 'quote' ? 'quote' : 'proposal'}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
                  Read it below, then accept or decline — your answer goes straight back to {business.name}. No account,
                  no signature, no paperwork.
                </p>
              </div>
              {proposal.views > 0 && (
                <Pill tone="neutral" icon={Eye}>
                  {proposal.views} view{proposal.views === 1 ? '' : 's'}
                </Pill>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Your name" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={client?.name || 'Sanne Boersma'}
                  autoComplete="name"
                />
              </Field>
              <Field label="Email" hint="For the contract or a follow-up.">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={client?.email || 'you@company.com'}
                  autoComplete="email"
                />
              </Field>
              <Field label="Preferred start date" className="sm:col-span-2" hint="Optional — sent along with your acceptance.">
                <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" icon={Check} disabled={busy || expired} onClick={() => decide('accept')}>
                {busy ? 'Sending…' : `Accept · ${money(proposal.total || 0)}`}
              </Button>
              <Button variant="outline" icon={ThumbsDown} disabled={busy} onClick={() => decide('decline')}>
                Decline
              </Button>
              {expired && <span className="text-xs font-medium text-flag-700">This offer expired on {fmtDate(proposal.validUntil, locale)} — ask for a renewed version.</span>}
              {!expired && (
                <span className="text-xs text-[var(--text-muted)]">
                  Prefer email? Reply to{' '}
                  <a className="link font-semibold" href={`mailto:${business.email}?subject=Re:%20${encodeURIComponent(proposal.number || proposal.title || '')}`}>
                    {business.email}
                  </a>
                </span>
              )}
            </div>
          </Card>
        )}

        <DocumentPreview doc={proposal} client={client} business={business} brand={brand} />

        <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Document summary">
          {[
            ['Total incl. VAT', money(proposal.total || 0)],
            ['Valid until', proposal.validUntil ? fmtDate(proposal.validUntil, locale) : 'No expiry'],
            ['Payment terms', proposal.paymentTerms ? `${proposal.paymentTerms} days` : 'Agreed separately'],
          ].map(([k, v]) => (
            <Card key={k} className="p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{k}</p>
              <p className="mt-1 font-display text-lg font-extrabold">{v}</p>
            </Card>
          ))}
        </section>

        {!decided && (
          <Card className="mt-4 p-5">
            <SectionTitle>Questions or a change of scope?</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr]">
              <Field label="What would you like adjusted?" hint="Sent together with a decline, or use the email address next to it.">
                <Textarea
                  rows={5}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Can we split phase 2 into a separate quote, or start in January instead?"
                />
              </Field>
              <div className="space-y-1.5 text-sm">
                <p className="font-semibold">{business.name}</p>
                {business.owner && <p className="text-[var(--text-muted)]">{business.owner}</p>}
                {business.email && (
                  <p>
                    <a className="link" href={`mailto:${business.email}`}>
                      {business.email}
                    </a>
                  </p>
                )}
                {business.phone && <p className="text-[var(--text-muted)]">{business.phone}</p>}
                {business.website && <p className="text-[var(--text-muted)]">{String(business.website).replace(/^https?:\/\//, '')}</p>}
                <dl className="mt-3 space-y-1 border-t border-[var(--line)] pt-3 text-xs text-[var(--text-muted)]">
                  {business.regNumber && (
                    <div className="flex justify-between gap-2">
                      <dt>KvK</dt>
                      <dd className="tnum font-semibold text-[var(--text)]">{business.regNumber}</dd>
                    </div>
                  )}
                  {business.taxId && (
                    <div className="flex justify-between gap-2">
                      <dt>BTW / Tax ID</dt>
                      <dd className="font-semibold text-[var(--text)]">{business.taxId}</dd>
                    </div>
                  )}
                  {business.iban && (
                    <div className="flex justify-between gap-2">
                      <dt>IBAN</dt>
                      <dd className="font-mono font-semibold text-[var(--text)]">{business.iban}</dd>
                    </div>
                  )}
                </dl>
                <Button variant="outline" size="sm" className="mt-3 w-full" icon={MessageSquare} disabled={busy} onClick={() => decide('decline')}>
                  Send feedback & decline
                </Button>
              </div>
            </div>
          </Card>
        )}

        <footer className="mt-8 border-t border-[var(--line)] pt-6 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            {[business.name, business.city, business.regNumber && `KvK ${business.regNumber}`, business.taxId && `BTW ${business.taxId}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Sent with{' '}
            <Link to="/" className="link font-semibold">
              DRIPS
            </Link>{' '}
            — proposals, invoices, tax and projects in one place.{' '}
            <Link to="/#pricing" className="link font-semibold">
              Start free
              <ArrowRight className="ml-1 inline h-3 w-3" aria-hidden />
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
