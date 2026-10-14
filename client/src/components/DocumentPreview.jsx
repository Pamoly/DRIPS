import { Check } from 'lucide-react';
import { cx, fmtDate, fmtMoney, round2 } from '../lib/format';
import { localeFor } from '../lib/currencies';

/**
 * HTML rendering of a proposal / quote / invoice document.
 * Used by the editor preview, the public signing link and the print view, so
 * what you see matches the exported PDF.
 */
export function DocumentPreview({ doc, client, business = {}, brand = {}, locale: forcedLocale, kind = 'proposal', className, compact }) {
  const currency = doc.currency || 'EUR';
  const locale = forcedLocale || localeFor(currency, 'nl-NL');
  const m = (v) => fmtMoney(v, currency, locale);
  const primary = brand.primary || '#AE1C28';
  const secondary = brand.secondary || '#21468B';
  const ink = brand.documentAccent || '#0E1B3D';
  const isQuote = kind === 'invoice' ? false : doc.type === 'quote';
  const label = kind === 'invoice' ? 'Invoice' : isQuote ? 'Quote' : 'Proposal';

  return (
    <article
      className={cx('print-sheet relative overflow-hidden rounded-xl border border-[var(--line)] bg-white text-[#101A30]', className)}
      style={{ fontFamily: 'Inter Variable, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div aria-hidden className="flex h-1.5 w-full">
        <span className="h-full flex-1" style={{ background: primary }} />
        <span className="h-full flex-1 bg-white" />
        <span className="h-full flex-1" style={{ background: secondary }} />
      </div>

      <div className={cx(compact ? 'p-4' : 'p-5 sm:p-7')}>
        {/* letterhead */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {business.logoDataUrl ? (
              <img src={business.logoDataUrl} alt={`${business.name || 'Business'} logo`} className="max-h-14 max-w-[9rem] object-contain" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-extrabold text-white" style={{ background: ink }} aria-hidden>
                {(business.name || 'D')[0]}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold leading-tight" style={{ color: ink }}>
                {business.name || 'Your business name'}
              </p>
              {business.tagline && <p className="truncate text-[0.7rem] text-slate-500">{business.tagline}</p>}
            </div>
          </div>
          <address className="text-right text-[0.68rem] not-italic leading-relaxed text-slate-500">
            {[business.street && `${business.street}${business.postalCode ? `, ${business.postalCode}` : ''} ${business.city || ''}`.trim(), business.country, business.email, business.phone, business.website]
              .filter(Boolean)
              .map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
          </address>
        </header>

        {(business.regNumber || business.taxId || business.iban) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-y border-slate-200 py-2 text-[0.68rem] text-slate-500">
            {business.regNumber && (
              <span>
                <strong className="font-semibold text-slate-700">Chamber of Commerce (KvK):</strong> {business.regNumber}
              </span>
            )}
            {business.taxId && (
              <span>
                <strong className="font-semibold text-slate-700">Tax ID / VAT:</strong> {business.taxId}
              </span>
            )}
            {business.iban && (
              <span>
                <strong className="font-semibold text-slate-700">IBAN:</strong> {business.iban}
              </span>
            )}
          </div>
        )}

        {/* title block */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em]" style={{ color: primary }}>
              {label} {doc.number ? `· ${doc.number}` : ''}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold leading-tight sm:text-2xl" style={{ color: ink }}>
              {doc.title || 'Untitled'}
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[0.7rem]">
            {kind === 'invoice' ? (
              <>
                <Row k="Invoice date" v={fmtDate(doc.issueDate, locale)} />
                <Row k="Due date" v={fmtDate(doc.dueDate, locale)} />
                {doc.reference && <Row k="Reference" v={doc.reference} />}
                <Row k="Status" v={doc.status || 'draft'} cap />
              </>
            ) : (
              <>
                <Row k="Date" v={fmtDate(doc.createdAt || doc.updatedAt, locale)} />
                {doc.validUntil && <Row k="Valid until" v={fmtDate(doc.validUntil, locale)} />}
                {doc.paymentTerms ? <Row k="Payment terms" v={`${doc.paymentTerms} days`} /> : null}
                <Row k="Status" v={doc.status || 'draft'} cap />
              </>
            )}
          </dl>
        </div>

        {/* prepared for */}
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3.5">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-slate-500">{kind === 'invoice' ? 'Billed to' : 'Prepared for'}</p>
            <p className="mt-1 text-sm font-bold" style={{ color: ink }}>
              {client?.company || client?.name || '—'}
            </p>
            <div className="mt-0.5 space-y-0.5 text-[0.7rem] leading-relaxed text-slate-500">
              {client?.name && client?.company && <p>{client.name}</p>}
              {client?.email && <p>{client.email}</p>}
              {client?.phone && <p>{client.phone}</p>}
              {[client?.street, client?.postalCode].filter(Boolean).length > 0 && <p>{[client.street, client.postalCode].filter(Boolean).join(' ')}</p>}
              {client?.city && <p>{[client.city, client.country].filter(Boolean).join(', ')}</p>}
              {client?.regNumber && <p>KvK {client.regNumber}</p>}
              {client?.taxId && <p>VAT {client.taxId}</p>}
            </div>
          </div>
          <div className="rounded-lg p-3.5" style={{ background: `${secondary}0F` }}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em]" style={{ color: secondary }}>
              {kind === 'invoice' ? 'Amount' : 'Investment'}
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold" style={{ color: ink }}>
              {m(doc.total || 0)}
            </p>
            <p className="mt-0.5 text-[0.7rem] text-slate-500">
              {doc.taxRate ? `Incl. ${doc.taxRate}% VAT · ` : 'Excl. VAT · '}
              {currency}
              {doc.mode === 'packages' && doc.selectedPackage !== undefined && doc.packages?.[doc.selectedPackage]
                ? ` · package: ${doc.packages[doc.selectedPackage].name}`
                : ''}
            </p>
            {doc.status === 'accepted' && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[0.68rem] font-bold text-emerald-700">
                <Check className="h-3 w-3" aria-hidden /> Accepted{doc.acceptedBy ? ` by ${doc.acceptedBy}` : ''}
                {doc.decidedAt || doc.acceptedAt ? ` · ${fmtDate(doc.decidedAt || doc.acceptedAt, locale)}` : ''}
              </p>
            )}
          </div>
        </section>

        {doc.intro && <Paragraph title={null} text={doc.intro} />}
        {doc.objective && <Paragraph title="Objective" text={doc.objective} />}
        {doc.scopeSummary && <Paragraph title={kind === 'invoice' ? 'Description' : 'Scope of work'} text={doc.scopeSummary} />}

        {Array.isArray(doc.deliverables) && doc.deliverables.filter(Boolean).length > 0 && (
          <Section title="Deliverables">
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {doc.deliverables.filter(Boolean).map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-[0.78rem] leading-snug">
                  <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: primary }} aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* pricing */}
        <Section title={kind === 'invoice' ? 'Line items' : doc.mode === 'packages' ? 'Packages' : 'Price breakdown'}>
          {doc.mode === 'packages' && kind !== 'invoice' ? (
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
              {(doc.packages || []).map((p, i) => {
                const selected = Number(doc.selectedPackage) === i;
                return (
                  <div
                    key={p.id || i}
                    className={cx('relative rounded-lg border p-3', selected ? 'shadow-[0_10px_30px_-16px_rgba(14,27,61,.5)]' : 'border-slate-200')}
                    style={selected ? { borderColor: primary, background: `${primary}08` } : undefined}
                  >
                    {selected && (
                      <span className="absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide text-white" style={{ background: primary }}>
                        Selected
                      </span>
                    )}
                    <p className="text-[0.82rem] font-extrabold" style={{ color: ink }}>
                      {p.name}
                    </p>
                    {p.tagline && <p className="mt-0.5 text-[0.68rem] leading-snug text-slate-500">{p.tagline}</p>}
                    <p className="mt-2 font-display text-lg font-extrabold" style={{ color: primary }}>
                      {m(p.price)}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {(p.features || []).filter(Boolean).map((f, fi) => (
                        <li key={fi} className="flex items-start gap-1.5 text-[0.7rem] leading-snug text-slate-600">
                          <Check className="mt-[0.15rem] h-3 w-3 shrink-0" style={{ color: secondary }} aria-hidden />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="mt-2.5 w-full border-collapse text-[0.74rem]">
              <thead>
                <tr style={{ background: ink, color: '#fff' }}>
                  <th className="rounded-l-md px-2.5 py-2 text-left font-semibold">Description</th>
                  {kind !== 'invoice' && <th className="px-2.5 py-2 text-left font-semibold">Details</th>}
                  <th className="px-2.5 py-2 text-right font-semibold">Qty</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Rate</th>
                  <th className="rounded-r-md px-2.5 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(doc.mode === 'fixed' && kind !== 'invoice' && !(doc.items || []).length
                  ? [{ id: 'fixed', description: doc.title || 'Fixed price project', qty: 1, unit: 'project', rate: doc.fixedPrice || 0 }]
                  : doc.items || []
                ).map((it, i) => (
                  <tr key={it.id || i} className={i % 2 ? 'bg-slate-50' : ''}>
                    <td className="border-b border-slate-100 px-2.5 py-2 font-semibold align-top">{it.description}</td>
                    {kind !== 'invoice' && <td className="border-b border-slate-100 px-2.5 py-2 align-top text-slate-500">{it.detail}</td>}
                    <td className="border-b border-slate-100 px-2.5 py-2 text-right align-top tabular-nums">
                      {round2(it.qty)} {it.unit}
                    </td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-right align-top tabular-nums">{m(it.rate)}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-right align-top font-semibold tabular-nums">{m(round2(it.qty) * round2(it.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* totals */}
        <div className="mt-3 flex justify-end">
          <dl className="w-full max-w-xs space-y-1 text-[0.78rem]">
            <TotalRow k="Subtotal" v={m((doc.subtotal ?? 0))} />
            {doc.discountValue > 0 && <TotalRow k={`Discount${doc.discount?.type === 'percent' ? ` (${doc.discount.value}%)` : ''}`} v={`− ${m(doc.discountValue)}`} />}
            <TotalRow k={`VAT ${doc.taxRate || 0}%`} v={m(doc.taxTotal || 0)} />
            <div className="mt-1.5 flex items-center justify-between rounded-lg px-3 py-2.5 text-white" style={{ background: ink }}>
              <dt className="text-[0.8rem] font-bold">{kind === 'invoice' ? 'Total due' : 'Total'}</dt>
              <dd className="font-display text-base font-extrabold tabular-nums">{m(doc.total || 0)}</dd>
            </div>
            {kind === 'invoice' && doc.paidAmount > 0 && (
              <>
                <TotalRow k="Paid" v={m(doc.paidAmount)} />
                <TotalRow k="Balance due" v={m(round2((doc.total || 0) - (doc.paidAmount || 0)))} strong />
              </>
            )}
          </dl>
        </div>

        {doc.timeline && <Paragraph title="Timeline" text={doc.timeline} />}

        {Array.isArray(doc.milestones) && doc.milestones.length > 0 && (
          <Section title="Payment schedule">
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {doc.milestones.map((ms, i) => (
                <li key={ms.id || i} className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-[0.74rem]">
                  <span className="min-w-0">
                    <span className="block font-semibold">{ms.name}</span>
                    {ms.note && <span className="block text-slate-500">{ms.note}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums">{ms.due ? fmtDate(ms.due, locale) : '—'}</span>
                    <span className="block font-semibold tabular-nums">
                      {ms.amount}% · {m(((doc.total || 0) * (ms.amount || 0)) / 100)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {doc.notes && <Paragraph title="Notes" text={doc.notes} />}
        {doc.terms && <Paragraph title="Terms & conditions" text={doc.terms} small />}

        {kind === 'invoice' ? (
          <Section title="Payment details">
            <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[0.74rem] leading-relaxed">
              {business.iban && (
                <p>
                  <strong className="font-semibold">IBAN:</strong> {business.iban}
                </p>
              )}
              {business.name && (
                <p>
                  <strong className="font-semibold">Account name:</strong> {business.name}
                </p>
              )}
              <p>
                <strong className="font-semibold">Reference:</strong> {doc.number}
              </p>
              <p className="mt-1 text-slate-500">{doc.terms || 'Thank you for your business.'}</p>
            </div>
          </Section>
        ) : (
          <Section title="Acceptance">
            <div className="mt-2 rounded-lg border border-slate-200 p-3.5">
              <p className="text-[0.74rem] leading-relaxed text-slate-600">
                By signing below — or by accepting the online link — {client?.company || 'the client'} agrees to the scope, timeline and
                investment described in this {isQuote ? 'quote' : 'proposal'}.
              </p>
              {doc.status === 'accepted' ? (
                <p className="mt-3 text-[0.8rem] font-bold text-emerald-700">
                  Accepted by {doc.acceptedBy || 'client'} on {fmtDate(doc.decidedAt || doc.acceptedAt, locale)}
                </p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="h-8 border-b border-slate-300" />
                    <p className="mt-1 text-[0.62rem] uppercase tracking-wide text-slate-400">Signature client</p>
                  </div>
                  <div>
                    <div className="h-8 border-b border-slate-300" />
                    <p className="mt-1 text-[0.62rem] uppercase tracking-wide text-slate-400">Date</p>
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 text-[0.64rem] text-slate-500 sm:px-7">
        <span>
          {[business.name, business.regNumber && `KvK ${business.regNumber}`, business.taxId].filter(Boolean).join(' · ')}
        </span>
        <span>
          {label} {doc.number || ''} · created with DRIPS
        </span>
      </footer>
    </article>
  );
}

function Row({ k, v, cap }) {
  return (
    <div>
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-semibold capitalize-none" style={cap ? { textTransform: 'capitalize' } : undefined}>
        {v}
      </dd>
    </div>
  );
}

function TotalRow({ k, v, strong }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={cx('text-slate-500', strong && 'font-bold text-slate-800')}>{k}</dt>
      <dd className={cx('tabular-nums font-semibold', strong && 'text-base font-extrabold')}>{v}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h3 className="text-[0.64rem] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Paragraph({ title, text, small }) {
  if (!text) return null;
  return (
    <section className="mt-4">
      {title && <h3 className="text-[0.64rem] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>}
      <p className={cx('mt-1.5 whitespace-pre-line leading-relaxed text-slate-700', small ? 'text-[0.7rem]' : 'text-[0.8rem]')}>{text}</p>
    </section>
  );
}
