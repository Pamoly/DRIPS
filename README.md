# DRIPS — the all-in-one back office for freelancers & small businesses

Proposals, quotes, invoices, bookkeeping, tax reserves, an agile project board, time tracking, a client CRM and
goals — in one workspace, in any currency, with your own branding.

Founded in Rotterdam, so the interface mixes the red, white and blue of the Dutch flag, and the tax engine ships with
the **official 2026 Dutch parameters** (Box 1, ondernemersaftrek, heffingskortingen, Zvw and quarterly VAT) out of the
box.

```
npm install     # once
npm run seed    # optional: fills the workspace with a full demo quarter
npm run dev     # API on :8787 + Vite dev server on :5173
npm run build && npm start   # production: Express serves client/dist on :8787
```

No environment variables, no database server, no sign-up: the first visit to `/app` bootstraps a workspace and keeps a
private token in `localStorage`.

---

## What's inside

| Module | Route | What you can do |
| --- | --- | --- |
| 📊 Dashboard | `/app` | Revenue, outstanding, tax set-aside, sprint health, cash forecast, recent activity, quick actions |
| 📄 Proposals & Quotes | `/app/proposals` | List with status/value filters, duplicate, convert to invoice, share link, pipeline KPIs, Excel + PDF export |
| Proposal editor | `/app/proposals/:id` | Logo upload, **KvK business registration number** and **Tax ID/VAT** boxes, hourly · fixed · **tiered packages** modes, line items, discounts, VAT, milestones, deliverables, terms, live A4 preview, branded PDF, public signing link |
| 🧮 Tax & Expenses | `/app/tax` | Quarterly revenue & cost overrides, income-tax + Zvw calculation, set-aside planner vs. actual buffer, VAT returns with deadlines, KOR check, expense ledger with the 73.5% mixed-cost rule, Excel + PDF |
| 💰 Invoices & Books | `/app/invoices` | Sequential invoices, partial payments, reminders, PDF, general ledger (accrual ↔ cash), manual journal entries, P&L, debtor ageing, revenue by client, accounting checklist |
| 📋 Project Board | `/app/board` | Kanban (backlog → todo → doing → review → done) with WIP limits, drag & drop **and** keyboard moves, **calendar view**, list view, sprints with goals/capacity/velocity, burndown, story points, checklists, Excel + PDF |
| ⏱️ Time Tracker | `/app/time` | Stopwatch that survives a refresh, manual entries, billable/non-billable, per-client rates, hours-per-day chart, "invoice unbilled time" → draft invoice |
| 👥 CRM & Clients | `/app/clients` | Grid/table, lead → prospect → active → past pipeline, KvK/VAT/IBAN per client, tags, notes & activity timeline, lifetime value, outstanding, average payment delay, per-client statement PDF |
| 🎯 Goals & Targets | `/app/goals` | Revenue, tax buffer, utilisation and growth goals with progress, deadlines, pace, "sync from data" and quarterly target breakdown |
| ⚙️ Settings | `/app/settings` | Business & brand (logo, colours), regional preferences, tax profile, document defaults & numbering, template text, currency rates, backup/restore, demo & reset |
| Public proposal | `/p/:shareToken` | Token-only page for your client: read the document, download the PDF, accept or decline with a name and a start date, send feedback |
| Landing page | `/` | Conversion-first marketing page (see below) |

Shell extras: command palette (**⌘K / Ctrl+K**), notification bell with real deadlines (overdue invoices, invoices due
this week, VAT return dates, expiring or undecided proposals, late board cards, goals behind pace), currency picker, dark mode, collapsible sidebar, mobile bottom nav.

### Landing page (`/`)

Built to the brief: sticky minimal navbar (logo left · Products / About / FAQ centre · high-contrast **Get started
free** right), split-screen hero with a sub-10-word headline, trust badge, primary CTA plus a low-friction "explore the
demo" link and a live product mockup, bento benefits grid, 3-step horizontal timeline, testimonial grid with avatars and
specific results, pricing with a risk-reversal line, an interactive FAQ accordion for the top objections, a legal
section (privacy + terms in plain language), a final CTA banner and a footer with copyright, privacy, terms and social
icons. Mobile-first, keyboard accessible, with a sticky mobile conversion bar.

### Multi-currency everywhere

30 currencies with per-workspace rate overrides (Settings → Currencies). Documents keep their own currency; reports,
KPIs and the dashboard convert into your base currency. Number and date formats switch between Dutch (`€1.234,56`) and
English (`€1,234.56`).

### Exports

* **PDF** (jsPDF + autotable): proposals, quotes, invoices, board snapshots, tax/book/time/client/goal reports,
  per-client statements — all branded with your logo, KvK, VAT ID and IBAN.
* **Excel** (SheetJS): multi-sheet workbooks per module.
* **JSON backup**: the whole workspace, restorable from Settings → Data & backup.
* **Print**: dedicated print stylesheet for on-screen documents.

---

## Architecture

```
DRIPS/
├── server/                  Express 4 API + atomic JSON store (no DB server needed)
│   ├── db.js                workspaces, collections, tokens, defaults, findPublicProposal
│   ├── index.js             REST routes, demo/reset/backup, serves client/dist with SPA fallback
│   ├── seed.js              "Studio Noordzij" demo quarter, dates relative to today
│   └── data/db.json         runtime store (git-ignored)
├── client/
│   ├── vite.config.js       host 0.0.0.0, /api proxy → :8787, manual chunk splitting
│   └── src/
│       ├── main.jsx         router + lazy pages + toaster
│       ├── index.css        Tailwind v4 @theme (flag/brand/navy/mint scales), dark mode, print rules
│       ├── lib/             api, store (context + optimistic writes), format, currencies, money,
│       │                    tax, metrics, excel, pdf
│       ├── components/      ui kit, AppShell, Brand, CommandPalette, CurrencyPicker,
│       │                    NotificationsBell, AppMockup, LogoUpload, DocumentPreview, SocialIcons
│       └── pages/           Landing, Dashboard, Proposals, ProposalEditor, PublicProposal,
│                            TaxExpenses, InvoicesBooks, ProjectBoard, TimeTracker, Clients,
│                            Goals, Settings
└── scripts/check-icons.mjs  validates every lucide-react import against the installed package
```

**Stack:** React 19 · React Router 7 · Vite 8 · Tailwind CSS v4 (CSS-first `@theme`) · Recharts · jsPDF · SheetJS ·
Express 4.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/bootstrap` | Create or resume a workspace, returns the bearer token |
| `GET` | `/api/state` | Whole workspace (settings + all collections) |
| `PUT` | `/api/settings` | Save settings (debounced from the client) |
| `POST` | `/api/:collection` | Create a record in `clients, proposals, invoices, expenses, timeEntries, projects, sprints, tasks, goals, ledger` (numbers and share tokens are generated server-side, proposal/invoice totals are recomputed) |
| `PUT/PATCH/DELETE` | `/api/:collection/:id` | Replace / patch / remove one record |
| `PUT` | `/api/:collection` | Replace a whole collection (board drag & drop re-ordering) |
| `POST` | `/api/proposals/:id/duplicate` | Copy a proposal with a new number and token |
| `POST` | `/api/proposals/:id/convert` | Turn an accepted proposal into a draft invoice |
| `POST` | `/api/invoices/:id/payments` | Record a (partial) payment, updates status & ledger |
| `GET/POST` | `/api/public/proposal/:token[/view|/decision]` | Token-free read, view counter, accept/decline |
| `POST` | `/api/demo` · `/api/reset` · `/api/backup` | Load demo data, clear the workspace, restore a backup |

Auth is a per-workspace bearer token issued by `/api/bootstrap` and stored in `localStorage` — no passwords, no
session cookies, one workspace per browser.

### Conventions worth knowing

* Task columns: `backlog | todo | doing | review | done`; priorities `low | medium | high | urgent`; sprint status
  `planned | active | completed`. Drag payload key is `text/task-id`, and every drag action has a keyboard equivalent.
* Moving a card to `done` stamps `completedAt`; moving it back clears it (the burndown depends on that).
* Time entries: `{ date, description, clientId, projectId, minutes, billable, rate, amount, invoiced }`; the running
  timer lives in `localStorage['drips.running-timer']` so a refresh never loses your session.
* Invoices: `{ number, issueDate, dueDate, currency, lines[], net, taxTotal, total, paidAmount, payments[] }`, status
  derived from the balance (`draft, sent, partly-paid, paid, overdue, void`).
* Expenses store `amount` (incl. VAT), `vatAmount` and `deductible`; mixed costs (meals, representation) are deducted
  at 73.5% per Dutch rules.
* Ledger accounts: `Business current, Savings / buffer, Cash, Credit card, Tax buffer, Private`; books can be shown
  accrual or cash.
* Effort estimates use `settings.defaults.hoursPerPoint` (default 4).

### Dutch tax parameters (2026, built in)

Box 1: 35.75% up to €38,883 · 37.56% to €78,426 · 49.50% above. Zelfstandigenaftrek €1,200 (1,225-hour criterion),
startersaftrek €2,123, MKB-winstvrijstelling 12.7% *after* the ondernemersaftrek. Algemene heffingskorting up to
€3,115, arbeidskorting per the official four-segment table. Zvw 4.85% over the belastbare winst, capped at a
€79,409 base (≈ €3,851). VAT 21% / 9% / 0%, quarterly deadlines 30 Apr · 31 Jul · 31 Oct · 31 Jan, KOR threshold
€20,000. Indicative profiles for BE, DE, UK and the US are included, plus a fully custom profile — every parameter is
overridable in Settings → Tax profile.

---

## Brand

Flag red `#AE1C28`, flag blue `#21468B`, white, ink navy `#0E1B3D`, with a red → blue gradient for the logo, hero and
primary banners, and a solid red for the main CTA. The palette is defined once as CSS custom properties in
`client/src/index.css` (Tailwind v4 `@theme`), so the landing page, the app shell, documents and PDFs all match.
Colours are editable per workspace in Settings → Brand colours.

Accessibility: semantic landmarks, skip links, visible focus rings, `role="tablist"` navigation, labelled controls,
`aria-live` toasts, WCAG AA contrast for text and CTAs, full keyboard control of the kanban board, and
`prefers-reduced-motion` support.

---

## Demo data

`npm run seed` (or **Load demo workspace** in Settings) builds *Studio Noordzij*, a Rotterdam design studio owned by
Mila Noordzij (KvK 8742 1930, BTW NL0038.12.947.B01): 5 clients, 4 proposals in different states, 7 invoices with
payments, 51 expenses across 11 categories, 30 time entries, 3 projects, 3 sprints with 16 cards, 5 goals, ledger
entries and an activity log — all dated relative to today, so deadlines and ageing always look real.

## Notes & honest caveats

* Landing-page social proof (4.9/5 rating, 1,200+ users, €41M invoiced, three named testimonials) and the pricing tiers
  (€0 / €19 / €49) are realistic placeholders — swap them for real numbers before going live.
* Currency rates are indicative reference values for reporting, not a live market feed; override them per workspace.
* Tax output is a planning estimate, not fiscal advice.
* The JSON store is fine for a single workspace or a small team; swap `server/db.js` for Postgres before multi-tenant
  production use.
* `lucide-react` v1.57 has no brand icons — the social icons live in `client/src/components/SocialIcons.jsx` as inline
  SVG. Run `node scripts/check-icons.mjs` after adding icons.
