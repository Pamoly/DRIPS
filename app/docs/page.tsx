import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Code2, Database, FileText, Link2, Plug, Search, Sparkles, Terminal, Zap } from "lucide-react";

export const metadata = { title: "Developer docs" };

const SECTIONS = [
  {
    id: "quickstart",
    icon: Zap,
    title: "Quickstart",
    body: "DRIPS exposes a single REST surface for keyword data, rankings, audits, content scoring and report data. Every request is scoped to one project and authenticated with a project API key.",
    code: `curl https://api.drips.app/v1/projects/northwind/keywords \\
  -H "Authorization: Bearer $DRIPS_API_KEY"`,
  },
  {
    id: "projects",
    icon: Database,
    title: "Projects & markets",
    body: "A project is a domain plus a primary market. Rank tracking, audits and competitor benchmarking all inherit the project's country, language and brand settings.",
    code: `{
  "id": "northwind",
  "domain": "northwindoutdoors.com",
  "country": "United States",
  "countryCode": "US",
  "language": "English",
  "engines": ["google", "google_mobile", "bing", "local"]
}`,
  },
  {
    id: "keywords",
    icon: Search,
    title: "Keywords & rankings",
    body: "Keyword objects include volume, difficulty, CPC, intent, cluster, SERP features and current positions. Positions are returned per engine with 90 days of history available.",
    code: `GET /v1/projects/{id}/keywords?engine=google&position=11-20
GET /v1/projects/{id}/rankings?days=90
GET /v1/projects/{id}/competitors/gap`,
  },
  {
    id: "content",
    icon: Sparkles,
    title: "Content scoring",
    body: "The same scoring engine that powers the editor and the WordPress plugin. Send a title, focus keyword and markdown body; receive a 0–100 score with 14 weighted checks and ranked fixes.",
    code: `POST /v1/content/analyze
{
  "title": "How to choose hiking boots",
  "keyword": "hiking boots",
  "body": "## Fit first\\n..."
}

→ { "score": 86, "grade": "Good", "checks": [...], "recommendations": [...] }`,
  },
  {
    id: "audits",
    icon: FileText,
    title: "Audits & reports",
    body: "Trigger crawls programmatically, read issue detail with affected URLs, and fetch the exact data set used for white-label client reports.",
    code: `POST /v1/projects/{id}/audits
GET  /v1/projects/{id}/audits/{auditId}
GET  /v1/reports/{publicToken}`,
  },
  {
    id: "widgets",
    icon: Code2,
    title: "Embeds & widgets",
    body: "Every widget has a signed public token and renders as a lightweight, theme-aware iframe. No API key is exposed on the client site.",
    code: `<iframe src="https://app.drips.app/embed/wgt_rank_9f2a"
  width="360" height="230" loading="lazy"
  style="border:0;border-radius:14px"></iframe>`,
  },
  {
    id: "wordpress",
    icon: Plug,
    title: "WordPress plugin",
    body: "Install drips-seo-connector.php, paste your project key, and the block editor gains live scoring, on-page checks and internal link suggestions. Scores recalculate on keypress through /content/analyze.",
    code: `wp plugin install drips-seo-connector.php --activate
wp option update drips_api_key "sk_live_..."
wp option update drips_project_id "northwind"`,
  },
];

export default function DocsPage() {
  return (
    <div className="ambient min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-brand/15 ring-1 ring-brand/30">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 2.7c3.6 4.3 6.4 7.7 6.4 11.1a6.4 6.4 0 0 1-12.8 0c0-3.4 2.8-6.8 6.4-11.1Z" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">DRIPS<span className="text-brand">.</span></span>
            <span className="text-faint">/</span>
            <span className="text-[12.5px] text-muted">Docs</span>
          </div>
          <Link href="/" className="btn-ghost btn-sm"><ArrowLeft className="h-3.5 w-3.5" /> Back to workspace</Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="label">On this page</p>
            <ul className="mt-3 space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-muted transition hover:bg-raised/60 hover:text-ink">
                    <s.icon className="h-3.5 w-3.5 text-faint" /> {s.title}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-line bg-surface p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-brand"><BookOpen className="h-3.5 w-3.5" /> Base URL</p>
              <code className="mt-1.5 block break-all font-mono text-[10.5px] text-muted">https://api.drips.app/v1</code>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-raised/60 px-3 py-1 text-[11px] text-muted">
            <Terminal className="h-3 w-3" /> API v1 · REST · JSON
          </p>
          <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.03em]">Build on the DRIPS data layer</h1>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Everything you see in the app is available through the API: keyword research, daily rank positions across
            engines, crawls, backlinks, competitor gaps, AI visibility and white-label report payloads.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { k: "Auth", v: "Bearer project key" },
            { k: "Guest mode", v: "Read-only demo session" },
              { k: "Rate limit", v: "600 req / min" },
              { k: "Formats", v: "JSON · CSV export" },
            ].map((c) => (
              <div key={c.k} className="rounded-xl border border-line bg-surface p-3.5">
                <p className="label">{c.k}</p>
                <p className="mt-1 text-[13px] font-medium">{c.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-5">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-raised text-brand"><s.icon className="h-3.5 w-3.5" /></span>
                  <h2 className="text-[15px] font-semibold">{s.title}</h2>
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{s.body}</p>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-ink/90">{s.code}</pre>
              </section>
            ))}
          </div>

          <section className="mt-6 rounded-2xl border border-brand/25 bg-brand/[0.05] p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold"><Link2 className="h-4 w-4 text-brand" /> Need something that isn&apos;t here?</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              The API is intentionally small. For deeper integrations — warehouse syncs, custom scoring weights, or
              agency-level white-labeling — talk to the team from the workspace sidebar.
            </p>
            <Link href="/" className="btn-primary btn-sm mt-3">Open the app <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </section>
        </div>
      </main>
    </div>
  );
}
