import { ArrowUpRight, Check, Euro, FileText, Kanban, Timer } from 'lucide-react';

/**
 * Marketing hero mock-up: a stylised, self-contained snapshot of the real app.
 * Rendered in markup (not a screenshot) so it stays razor sharp on retina and
 * adapts to light/dark mode.
 */
export function AppMockup() {
  const bars = [38, 52, 44, 61, 55, 74, 68, 86];
  return (
    <div className="relative w-full">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] opacity-70 blur-2xl"
        style={{ background: 'radial-gradient(60% 60% at 70% 20%, rgba(33,70,139,.28), transparent 70%), radial-gradient(50% 50% at 20% 80%, rgba(174,28,40,.22), transparent 70%)' }}
      />
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] shadow-[0_40px_80px_-32px_rgba(14,27,61,.45)]">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_3%,transparent)] px-3.5 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#E8574A]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E8B84A]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#4ABF7A]" />
          </span>
          <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-[var(--line)] bg-[var(--surface-card)] px-2 py-1 text-[0.65rem] text-[var(--text-muted)]">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            app.drips.nl/dashboard
          </span>
          <span className="chip chip-green text-[0.58rem]">
            <Check className="h-2.5 w-2.5" aria-hidden /> Saved
          </span>
        </div>

        <div className="flex">
          {/* mini sidebar */}
          <div className="hidden w-[5.2rem] shrink-0 flex-col gap-1.5 border-r border-[var(--line)] px-2.5 py-3 sm:flex" aria-hidden>
            {[FileText, Kanban, Timer, Euro].map((Icon, i) => (
              <span
                key={i}
                className={`flex h-8 items-center gap-2 rounded-lg px-2 text-[0.6rem] font-semibold ${
                  i === 0 ? 'bg-[color-mix(in_srgb,#AE1C28_12%,transparent)] text-flag-700' : 'text-[var(--text-muted)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{['Quotes', 'Board', 'Time', 'Books'][i]}</span>
              </span>
            ))}
          </div>

          {/* content */}
          <div className="min-w-0 flex-1 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">October · Q4</p>
                <p className="font-display text-[0.95rem] font-extrabold leading-tight">Goedemorgen, Mila 👋</p>
              </div>
              <span className="btn btn-primary btn-sm !px-2 !py-1 text-[0.6rem]">New quote</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { l: 'Revenue YTD', v: '€71.4k', d: '+18%' },
                { l: 'Outstanding', v: '€9.1k', d: '2 invoices' },
                { l: 'Tax set-aside', v: '€21.6k', d: '34% advised' },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_2%,transparent)] p-2">
                  <p className="truncate text-[0.55rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">{k.l}</p>
                  <p className="tnum font-display text-[0.95rem] font-extrabold leading-tight">{k.v}</p>
                  <p className="text-[0.55rem] font-semibold text-[var(--color-mint-500)]">{k.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-2.5 grid grid-cols-5 gap-2">
              <div className="col-span-3 rounded-xl border border-[var(--line)] p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[0.6rem] font-bold text-[var(--text-muted)]">Revenue vs costs</p>
                  <p className="text-[0.55rem] font-semibold text-[var(--color-brand-600)]">12 months</p>
                </div>
                <div className="mt-2 flex h-16 items-end gap-1.5" aria-hidden>
                  {bars.map((h, i) => (
                    <span key={i} className="flex flex-1 flex-col justify-end gap-0.5">
                      <span className="rounded-t bg-[var(--color-brand-600)]" style={{ height: `${h}%` }} />
                      <span className="rounded-t bg-[color-mix(in_srgb,#AE1C28_45%,transparent)]" style={{ height: `${h * 0.34}%` }} />
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-2 rounded-xl border border-[var(--line)] p-2.5">
                <p className="text-[0.6rem] font-bold text-[var(--text-muted)]">Sprint 11</p>
                <div className="mt-2 space-y-1.5" aria-hidden>
                  {['Backlog', 'Doing', 'Done'].map((c, i) => (
                    <div key={c} className="flex items-center gap-1.5">
                      <span className="w-11 text-[0.52rem] font-semibold text-[var(--text-muted)]">{c}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                        <span className="block h-full rounded-full" style={{ width: `${[45, 65, 88][i]}%`, background: ['#94A3B8', '#21468B', '#12A06A'][i] }} />
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 rounded-lg bg-[color-mix(in_srgb,#AE1C28_8%,transparent)] p-2">
                  <p className="text-[0.55rem] font-bold uppercase tracking-wide text-flag-700">VAT Q4</p>
                  <p className="tnum text-[0.7rem] font-extrabold">€4.318 due 31 okt</p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--line)] p-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-600)] text-white" aria-hidden>
                <FileText className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.66rem] font-bold">PROP-2026-014 · Havenlab platform redesign</p>
                <p className="text-[0.58rem] text-[var(--text-muted)]">Tiered packages · €14.500 · accepted via link</p>
              </div>
              <span className="chip chip-green text-[0.55rem]">Signed</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden />
            </div>
          </div>
        </div>
        <div aria-hidden className="flag-bar w-full opacity-90" />
      </div>

      {/* floating proof cards */}
      <div className="absolute -left-3 bottom-8 hidden rotate-[-4deg] rounded-xl border border-[var(--line)] bg-[var(--surface-card)] px-3 py-2 shadow-[var(--shadow-pop)] sm:block" aria-hidden>
        <p className="text-[0.55rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Proposal accepted</p>
        <p className="text-[0.78rem] font-extrabold text-[var(--color-mint-600)]">+ €14.500 · 2 min ago</p>
      </div>
      <div className="absolute -right-2 top-10 hidden rotate-[3deg] rounded-xl border border-[var(--line)] bg-[var(--surface-card)] px-3 py-2 shadow-[var(--shadow-pop)] md:block" aria-hidden>
        <p className="text-[0.55rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Tax buffer</p>
        <p className="tnum text-[0.78rem] font-extrabold">34% of every invoice</p>
      </div>
    </div>
  );
}
