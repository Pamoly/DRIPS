import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Code2, Download, FileCode2, Link2, PenLine, Plug, RefreshCw, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb, roleInProject } from "@/lib/store";
import { findProject, projectDocs } from "@/lib/derive";
import { fmtRelative, scoreTone } from "@/lib/format";
import { Badge, Card, PageHeader, Progress, SectionHeader } from "@/components/ui";
import { ActionButton, CopyButton } from "@/components/actions";
import { SignInToEdit } from "@/components/read-only";

export const metadata = { title: "WordPress" };

export default async function WordPressPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const role = roleInProject(project, user.id);
  const canManage = !user.isGuest && (role === "owner" || role === "admin" || user.role === "owner");
  const docs = projectDocs(db, project.id);
  const avgScore = docs.length ? Math.round(docs.reduce((s, d) => s + d.score, 0) / docs.length) : 0;
  const connected = project.wp.connected;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Plug className="h-3 w-3" /> WordPress integration v1.8.2</>}
        title="WordPress Connector"
        description="Score content as you write, catch on-page issues before publishing, and sync optimized pages back to your site."
        actions={
          <>
            <Badge tone={connected ? "brand" : "outline"}>{connected ? "Connected" : "Not connected"}</Badge>
            <a href="/api/wordpress/plugin" className="btn-primary btn-sm"><Download className="h-3.5 w-3.5" /> Download plugin</a>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Card>
            <SectionHeader
              title="Connection status"
              subtitle={connected ? `${project.wp.url} · WordPress ${project.wp.version}` : "Install the plugin to connect this site"}
              action={
                !canManage ? (
                  <SignInToEdit what="manage the connector" />
                ) : connected ? (
                  <div className="flex gap-1.5">
                    <ActionButton endpoint="/api/integrations/wordpress" body={{ projectId: project.id, action: "ping" }} className="btn-soft btn-xs" pendingLabel="Pinging…"><RefreshCw className="h-3 w-3" /> Test</ActionButton>
                    <ActionButton endpoint="/api/integrations/wordpress" body={{ projectId: project.id, action: "disconnect" }} className="btn-danger btn-xs" pendingLabel="…">Disconnect</ActionButton>
                  </div>
                ) : (
                  <ActionButton endpoint="/api/integrations/wordpress" body={{ projectId: project.id, action: "connect" }} className="btn-primary btn-xs" pendingLabel="Connecting…"><Plug className="h-3 w-3" /> Connect site</ActionButton>
                )
              }
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { k: "Site", v: connected ? project.wp.url ?? project.domain : "—", ok: connected },
                { k: "Plugin version", v: connected ? `v${project.wp.version}` : "—", ok: connected },
                { k: "Last heartbeat", v: connected ? fmtRelative(project.wp.lastPing) : "—", ok: connected },
              ].map((s) => (
                <div key={s.k} className="rounded-lg border border-line bg-raised/25 p-3">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-faint">{s.k}</p>
                  <p className="mt-1 truncate text-[12.5px] font-medium">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] p-3 text-[11.5px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              The connector uses a scoped API key with read-only post access by default. Scores are computed server-side — no content is stored.
            </div>
          </Card>

          <Card>
            <SectionHeader title="Install in 3 steps" subtitle="Under two minutes, no FTP required" action={<Badge tone="outline"><FileCode2 className="h-3 w-3" /> PHP 7.4+</Badge>} />
            <ol className="mt-4 space-y-3">
              {[
                { t: "Download the plugin", d: "Grab drips-seo-connector.php from the button above." },
                { t: "Upload to WordPress", d: "Plugins → Add New → Upload Plugin → choose the file → Activate." },
                { t: "Paste your API key", d: "Settings → DRIPS SEO → add the project key from Project Settings, then save." },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand/10 text-[11px] font-semibold text-brand">{i + 1}</span>
                  <div>
                    <p className="text-[12.5px] font-medium">{s.t}</p>
                    <p className="text-[11.5px] leading-relaxed text-muted">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-lg border border-line bg-bg/50 p-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">WP-CLI alternative</p>
              <code className="block overflow-x-auto font-mono text-[11px] text-muted">wp plugin install drips-seo-connector.php --activate</code>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Zap, title: "Real-time content scoring", desc: "The editor scores every keystroke against 14 weighted on-page checks — no save required." },
              { icon: PenLine, title: "On-page SEO analysis", desc: "Titles, meta descriptions, heading structure, keyword density, readability and internal links." },
              { icon: Link2, title: "Internal link suggestions", desc: "Related published posts suggested from topical relevance and the focus keyword." },
              { icon: Sparkles, title: "AI optimization briefs", desc: "Paste a brief from the Content Optimizer into the block editor and score against it." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand"><Icon className="h-4 w-4" /></span>
                  <p className="mt-2.5 text-[12.5px] font-medium">{f.title}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{f.desc}</p>
                </Card>
              );
            })}
          </div>

          <Card>
            <SectionHeader title="REST API reference" subtitle="Endpoints used by the WordPress connector" action={<CopyButton text="https://api.drips.app/v1/content/analyze" label="Copy base" />} />
            <div className="mt-4 space-y-2">
              {[
                { m: "POST", p: "/v1/content/analyze", d: "Score a title, focus keyword and body" },
                { m: "GET", p: "/v1/projects/{id}/keywords", d: "List tracked keywords and positions" },
                { m: "POST", p: "/v1/integrations/wordpress/ping", d: "Heartbeat with site + WP version" },
                { m: "GET", p: "/v1/reports/{token}", d: "Fetch report data for embeds" },
              ].map((e) => (
                <div key={e.p} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-raised/20 px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${e.m === "POST" ? "bg-brand/15 text-brand" : "bg-sky/15 text-sky"}`}>{e.m}</span>
                  <code className="font-mono text-[11.5px] text-ink">{e.p}</code>
                  <span className="ml-auto text-[11px] text-faint">{e.d}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-line bg-bg/50 p-3 font-mono text-[10.5px] leading-relaxed text-muted">
              <p className="text-faint"># score content exactly as the plugin does</p>
              <p>curl -X POST https://api.drips.app/v1/content/analyze \</p>
              <p className="pl-4">-H &quot;Authorization: Bearer $DRIPS_API_KEY&quot; \</p>
              <p className="pl-4">-d &apos;{`{"title":"Trail boots","keyword":"hiking boots","body":"..."}`}&apos;</p>
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="What gets scored" subtitle="14 checks, 100 points" />
            <ul className="mt-3 space-y-2 text-[11.5px]">
              {[
                ["Title length", 8], ["Meta description", 8], ["Keyword in title", 10],
                ["Keyword in intro", 8], ["Keyword in subheadings", 8], ["Keyword density", 8],
                ["Content depth", 10], ["Heading structure", 8], ["Readability", 8],
                ["Paragraph length", 5], ["Internal links", 6], ["External citations", 4],
                ["Image alt text", 4], ["Question headings", 5],
              ].map(([label, weight]) => (
                <li key={label as string} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-brand" />
                  <span className="flex-1 text-muted">{label}</span>
                  <span className="text-[10.5px] tabular-nums text-faint">{weight} pts</span>
                </li>
              ))}
            </ul>
            <Link href={`/${project.id}/content`} className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition hover:text-ink">
              Open content optimizer <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card>
            <SectionHeader title="Content library score" subtitle={`${docs.length} documents synced`} action={<Badge tone={avgScore >= 75 ? "brand" : "amber"}>{avgScore} avg</Badge>} />
            <div className="mt-3 space-y-2">
              {docs.map((d) => (
                <div key={d.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate text-muted">{d.title}</span>
                    <span className={`shrink-0 tabular-nums ${scoreTone(d.score).text}`}>{d.score}</span>
                  </div>
                  <Progress value={d.score} tone={d.score >= 80 ? "brand" : d.score >= 60 ? "amber" : "rose"} height={4} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Sync log" subtitle="Recent connector events" />
            <ul className="mt-3 space-y-2.5">
              {[
                { t: connected ? "Heartbeat received" : "Connector not installed", d: connected ? fmtRelative(project.wp.lastPing) : "—", ok: connected },
                { t: "Site health check", d: "Today, 06:12", ok: true },
                { t: "Scoring endpoint reachable", d: "Today, 06:12", ok: true },
                { t: "Plugin update available", d: "v1.8.2 installed", ok: false },
              ].map((l) => (
                <li key={l.t} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${l.ok ? "bg-brand" : "bg-amber"}`} />
                  <div>
                    <p className="text-[11.5px]">{l.t}</p>
                    <p className="text-[10.5px] text-faint">{l.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg border border-line bg-raised/20 p-2.5 font-mono text-[10px] text-faint">
              <p className="flex items-center gap-1"><Code2 className="h-3 w-3" /> GET /wp-json/drips/v1/score</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
