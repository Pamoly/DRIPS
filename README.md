# DRIPS — SEO Intelligence Platform

An all-in-one, full-stack SEO workspace: keyword research, deep site audits, competitor and backlink intelligence,
real-time rank tracking, AI answer-engine visibility, AI-assisted content optimization, automated white-label
reporting, embeddable widgets, collaborative team workflows and a Google Search Console integration.

Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS** and a lightweight file-backed
JSON store. No external services or API keys are required to run the demo — all analytics are generated
deterministically and mutate in real time through the app's own REST endpoints.

---

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
```

Production (how this environment is hosted):

```bash
npm ci
npm run build
DRIPS_SECRET="$(openssl rand -hex 32)" npm start    # http://localhost:3000
```

The production server binds `0.0.0.0:$PORT` (default `3000`) and exposes a readiness probe at `GET /api/health`.
See **[deploy/README.md](deploy/README.md)** for Docker, systemd + nginx and managed-platform instructions.

### Guest access (no account)

Click **Continue as guest** on the sign-in screen (or `POST /api/auth/guest`). A shared guest session opens all three
demo projects in **read-only** mode: every dashboard, chart, filter, audit, report preview, widget and the ⌘K palette
works, while every write endpoint returns `403` with a friendly message and write controls are replaced by a
"sign in to edit" affordance. Guests can head back to `/login` at any time to upgrade to a password seat.

### Demo sign-in

| Seat | Email | Password | Role |
| --- | --- | --- | --- |
| Avery Chen | `avery@drips.app` | `drips2026` | Owner |
| Priya Patel | `priya@drips.app` | `drips2026` | Admin |
| Marcus Reed | `marcus@drips.app` | `drips2026` | Editor |
| Jonas Weber (client) | `jonas@client.com` | `drips2026` | Viewer |
| Guest Explorer | — "Continue as guest" — | none | Guest (read-only) |

The login screen also has one-click demo seats. Sessions are HMAC-signed, HTTP-only cookies.

Three seeded projects are included: **Northwind Outdoors** (US), **Lumen Analytics** (UK) and **Verdant Home** (CA).
Create additional projects from the project switcher — a new project starts empty and can be populated through the UI.

Demo data is generated on first request into `.data/db.json` (git-ignored). Delete that folder to reseed.

---

## What's inside

### Research
- **Keyword Explorer** — volume, CPC, difficulty, intent, clusters, SERP features, per-engine positions, 30-day
  sparklines, bulk add, CSV export, bulk tracking, smart long-tail suggestions, cluster analytics.
- **Competitors** — visibility benchmarking, 14-day share-of-voice trend, keyword gap explorer with gap scores and
  one-click tracking, backlink gap opportunities, authority comparison.
- **Backlinks** — live/new/lost monitoring, referring-domain authority, anchor distribution, weekly acquisition chart,
  link gap vs competitors, filterable link ledger.

### Monitoring
- **Rank Tracker** — Google desktop, Google mobile, Bing and Google local pack. Daily snapshots, 90-day average
  position chart, movement leaderboards, best-ever positions, position bands, 5×5 local geo-grid heatmap.
  “Pull latest SERPs” simulates a fresh daily refresh and persists new positions.
- **Search Console** — clicks, impressions, CTR and position with period deltas, 90-day charts, device/country/page
  breakdowns, striking-distance quick wins, searchable query table. Connect/sync/disconnect from Settings.
- **AI Visibility** — prompt-level coverage across ChatGPT, Perplexity, Gemini, AI Overviews and Copilot; sentiment,
  citations, competitor mentions, share of voice and re-scan.

### Site health
- **Site Audits** — instant crawls with 250+ checks modelled (22 surfaced per run), health gauge, Core Web Vitals
  (LCP/CLS/INP/FCP/TTFB), severity mix, category breakdown, issue explorer with fixes and “mark fixed”, per-URL scores,
  crawl history and team comments.
- **Content Optimizer** — real-time 14-check weighted scoring engine (titles, meta, keyword placement, density,
  depth, headings, readability, links, images, FAQ headings) returning a 0–100 score, ranked fixes, topical terms,
  SERP preview and suggested meta. Persists drafts and publishes.
- **WordPress Connector** — downloadable `drips-seo-connector.php` plugin with live editor scoring, on-page panel,
  internal-link suggestions and heartbeat; install guide, REST reference and sync log.

### Deliver
- **Reports** — white-label client reports with configurable accent, logo text, sections and footer; live preview,
  public share links (`/r/{token}`), print/PDF styling, scheduled email cadence and delivery state.
- **Widgets** — five embeddable, theme-aware iframes with signed public tokens and copy-ready snippets
  (`/embed/{token}`).

### Team
- **Tasks** — drag-and-drop kanban (to do / in progress / review / done), assignees, priorities, due dates,
  workstreams, overdue tracking and workload view.
- **Team & Clients** — invite members, change roles, remove seats, client portal summary, RBAC permission matrix and
  workspace activity.
- **Settings** — markets/branding/report cadence, competitor list, GSC + WordPress integrations, API key, plan usage.

Plus a global **⌘K command palette** (keywords, competitors, docs, reports, pages), theme switch, notifications,
print-ready audits, and a public `/docs` API reference.

---

## Architecture

```
app/
  (auth)/login           Sign-in + demo seats
  (app)/[project]/       Authenticated workspace (dashboard, keywords, competitors, backlinks,
                         rank-tracker, search-console, ai-visibility, audits, content, reports,
                         widgets, tasks, team, settings, wordpress)
  r/[token]              Public white-label report (no auth)
  embed/[token]          Public widget iframe (no auth)
  docs                   Static developer docs
  api/                   REST endpoints (auth, projects, keywords, audits, ranks, content,
                         reports, widgets, tasks, team, integrations, comments, AI, WP plugin)
lib/
  seed.ts                Deterministic demo dataset for 3 projects
  store.ts               JSON persistence in .data/db.json + password hashing
  auth.ts                Signed cookie sessions, role helpers
  rank.ts                Per-engine positions, 90-day histories, CTR model, visibility
  gsc.ts                 Search Console series and period comparisons
  derive.ts              Aggregations used by pages (metrics, movers, gaps, report payloads)
  analysis.ts            Content scoring engine (also used by the WordPress plugin)
  simulate.ts            On-demand crawls, SERP refreshes, keyword defaults
components/              Design system, SVG dataviz toolkit, feature UIs
```

**Data model** — users, projects, memberships, keywords, audits (+ per-page rows), competitors, backlinks, GSC queries,
content documents, reports, widgets, tasks, activity, comments and AI prompts. Persisted as a single JSON document with
atomic writes; swapping in Postgres/Prisma would only touch `lib/store.ts` and the route handlers.

**Auth & RBAC** — password hashes use `scrypt`; sessions are HMAC-SHA256 signed cookies with 30-day expiry. Project
roles (`owner`/`admin`/`editor`/`viewer`) are enforced on both server renders and every mutating API route. The guest
identity (`u_guest`) is seeded automatically, holds the `viewer` role on every project, and is additionally rejected by
`currentWriter()` / `guardProject(…, "edit"|"admin")` — so guest mode is read-only at the API layer, not just in the UI.

**Charts** — a dependency-free SVG toolkit (`components/charts.tsx`): responsive area/line, bar, donut, sparkline,
stacked distribution, gauge, geo heatmap and horizontal bars, all theme-aware via CSS variables and with hover states.

---

## API surface (selected)

```
POST   /api/auth/login | /api/auth/logout | /api/auth/guest   (read-only session)
GET    /api/projects            POST /api/projects            PATCH /api/projects/{id}
POST   /api/keywords            PATCH/DELETE /api/keywords/{id}
POST   /api/audits
POST   /api/rank/refresh
POST   /api/content/analyze     POST /api/content            PATCH/DELETE /api/content/{id}
POST   /api/reports             PATCH/DELETE /api/reports/{id}   POST /api/reports/{id}/send
POST   /api/widgets             DELETE /api/widgets/{id}
POST   /api/tasks               PATCH/DELETE /api/tasks/{id}
POST   /api/team                PATCH/DELETE /api/team/{userId}
POST   /api/integrations/gsc    POST /api/integrations/wordpress
POST   /api/comments            POST /api/ai                 GET  /api/wordpress/plugin
```

All mutating routes validate the session, project membership and required role, and return typed JSON errors.

---

## Deployment

| Target | Command / config |
| --- | --- |
| Local production host | `npm run build && npm start` (binds `0.0.0.0:3000`) |
| Docker Compose | `docker compose up -d --build` → `http://localhost:3000`, data in `./docker-data` |
| Dockerfile | `docker build -t drips-seo .` — multi-stage, non-root, healthcheck included |
| Linux VM | `deploy/drips.service` (systemd) + `deploy/nginx.conf` (TLS reverse proxy) |
| Managed PaaS | build `npm run build`, start `npm start`, Node 22, volume mounted at `.data` |

Environment variables: `DRIPS_SECRET` (session signing key — set in production), `DRIPS_SECURE_COOKIES` (`true` when
serving over HTTPS), `PORT`. Health probe: `GET /api/health`. Security headers are configured in `next.config.mjs`,
while `/embed/*` and `/r/*` intentionally allow framing so widgets and client reports work on third-party sites.

## Notes

- Ranking, Search Console and crawler data are **simulated deterministically** for this demo. The engines, schemas and
  UI flows mirror production so real providers (a SERP API, the GSC API, Lighthouse/CrUX) can be wired in behind
  `lib/rank.ts`, `lib/gsc.ts` and `lib/simulate.ts`.
- Set `DRIPS_SECRET` in the environment to override the development session signing key.
- White-label reports and widgets are intentionally public (tokenised) and read-only.
- Persisted data lives in `.data/db.json`; delete it to reseed the demo workspace.
