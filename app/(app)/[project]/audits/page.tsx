import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, Clock, FileBarChart, Gauge, Globe2, ScanSearch, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { auditIssueSummary, findProject, latestAudit, projectAudits } from "@/lib/derive";
import { fmtDate, fmtNumber, fmtRelative, scoreTone } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader, Progress, ScoreRing, SectionHeader } from "@/components/ui";
import { Donut, Gauge as GaugeChart, HorizontalBars } from "@/components/charts";
import { AuditIssues } from "@/components/audit-issues";
import { RunAuditButton } from "@/components/actions";
import { SignInToEdit } from "@/components/read-only";

export const metadata = { title: "Site Audits" };

export default async function AuditsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const readOnly = Boolean(user.isGuest);
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const audits = projectAudits(db, project.id);
  const audit = audits[0];
  const summary = audit ? auditIssueSummary(audit) : null;
  const previous = audits[1];
  const tone = audit ? scoreTone(audit.score) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><ScanSearch className="h-3 w-3" /> {audits.length} crawls · scheduled weekly</>}
        title="Site Audits"
        description="250+ technical, on-page, performance and security checks. Crawl 10,000 URLs in minutes and track health over time."
        actions={
          <>
            <Badge tone="brand"><CalendarClock className="h-3 w-3" /> Weekly crawl · Mon 04:00</Badge>
            {readOnly ? <SignInToEdit what="run a crawl" /> : <RunAuditButton projectId={project.id} label="New crawl" />}
          </>
        }
      />

      {audit && summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Site health" value={`${audit.score}/100`} hint={previous ? `${audit.score - previous.score >= 0 ? "+" : ""}${audit.score - previous.score} vs previous crawl` : "first crawl"} tone={tone && audit.score >= 75 ? "brand" : "rose"} icon={<Gauge className="h-3.5 w-3.5" />} />
            <Kpi label="Pages crawled" value={fmtNumber(audit.pagesCrawled)} hint={`${audit.pages.filter((p) => p.statusCode === 200).length} indexable`} tone="sky" icon={<Globe2 className="h-3.5 w-3.5" />} />
            <Kpi label="Critical issues" value={fmtNumber(summary.bySeverity.critical.length)} hint={`${summary.bySeverity.critical.reduce((s, i) => s + i.affected, 0)} URLs affected`} tone="rose" icon={<ShieldAlert className="h-3.5 w-3.5" />} />
            <Kpi label="Total issues" value={fmtNumber(audit.issues.length)} hint={`${summary.bySeverity.warning.length} warnings · ${summary.bySeverity.notice.length} notices`} tone="amber" />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-4">
              <SectionHeader title="Crawl health" subtitle={`${audit.name} · ${fmtRelative(audit.createdAt)}`} action={<Link href={`/${project.id}/audits/${audit.id}`} className="btn-ghost btn-xs">Full report</Link>} />
              <div className="mt-4 flex items-center gap-5">
                <GaugeChart value={audit.score} label="health" size={150} color={tone?.hex} />
                <div className="min-w-0 flex-1 space-y-2.5 text-[12px]">
                  <div className="flex justify-between"><span className="text-muted">Crawled</span><span className="tabular-nums">{fmtDate(audit.createdAt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Duration</span><span className="tabular-nums">4m 12s</span></div>
                  <div className="flex justify-between"><span className="text-muted">Indexable</span><span className="tabular-nums">{audit.pages.filter((p) => p.statusCode === 200).length}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Errors (4xx/5xx)</span><span className="tabular-nums text-rose">{audit.pages.filter((p) => p.statusCode >= 400).length}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Crawl budget used</span><span className="tabular-nums">62%</span></div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { k: "LCP", v: `${audit.vitals.lcp}s`, ok: audit.vitals.lcp <= 2.5 },
                  { k: "CLS", v: audit.vitals.cls.toFixed(2), ok: audit.vitals.cls <= 0.1 },
                  { k: "INP", v: `${audit.vitals.inp}ms`, ok: audit.vitals.inp <= 200 },
                ].map((v) => (
                  <div key={v.k} className="rounded-lg border border-line bg-raised/30 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-faint">{v.k}</p>
                    <p className={`mt-0.5 text-[13px] font-semibold tabular-nums ${v.ok ? "text-brand" : "text-rose"}`}>{v.v}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <SectionHeader title="Issues by severity" subtitle="Grouped across the crawl" />
              <div className="mt-4">
                <Donut
                  segments={[
                    { label: "Critical", value: summary.bySeverity.critical.length, color: "#FB7185" },
                    { label: "Warnings", value: summary.bySeverity.warning.length, color: "#FBBF24" },
                    { label: "Notices", value: summary.bySeverity.notice.length, color: "#38BDF8" },
                  ]}
                  centerValue={String(audit.issues.length)}
                  centerLabel="issues"
                  size={130}
                />
              </div>
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                {summary.categories.map((c) => (
                  <div key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-[11.5px]">
                      <span className="text-muted">{c.category}</span>
                      <span className="tabular-nums">{c.count}</span>
                    </div>
                    <Progress value={c.count} max={audit.issues.length || 1} tone={c.critical ? "rose" : "sky"} height={4} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="xl:col-span-4" padded={false}>
              <div className="p-5 pb-3"><SectionHeader title="Priority fixes" subtitle="Highest-impact issues to resolve first" action={<Link href={`/${project.id}/audits/${audit.id}`} className="btn-ghost btn-xs">All {audit.issues.length}</Link>} /></div>
              <ul className="divide-y divide-line/70">
                {summary.bySeverity.critical.slice(0, 3).concat(summary.bySeverity.warning.slice(0, 3)).map((issue) => (
                  <li key={issue.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${issue.severity === "critical" ? "bg-rose" : "bg-amber"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium leading-snug">{issue.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-faint">{issue.category} · {issue.affected} URLs</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line p-3">
                <Link href={`/${project.id}/audits/${audit.id}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition hover:text-ink">
                  Open issue explorer <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8"><AuditIssues issues={audit.issues} /></div>
            <Card className="xl:col-span-4">
              <SectionHeader title="Worst performing pages" subtitle="Lowest health score in this crawl" />
              <ul className="mt-3 divide-y divide-line/70">
                {[...audit.pages].sort((a, b) => a.score - b.score).slice(0, 7).map((p) => (
                  <li key={p.url} className="flex items-center gap-2.5 py-2.5">
                    <ScoreRing score={p.score} size={32} stroke={3.5} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-medium">{p.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</p>
                      <p className="text-[10px] text-faint">{p.issues.length} issues · {fmtNumber(p.words)} words</p>
                    </div>
                    <span className="shrink-0 text-[10.5px] tabular-nums text-faint">LCP {p.lcp}s</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-3 text-[11px] text-faint">Sorted by page health score. Open the full audit for per-URL detail.</div>
            </Card>
          </div>

          <Card padded={false}>
            <div className="p-5 pb-3"><SectionHeader title="Crawl history" subtitle="Track site health improvements over time" action={<Badge tone="outline"><Clock className="h-3 w-3" /> Automated</Badge>} /></div>
            <table className="w-full">
              <thead>
                <tr className="border-y border-line bg-raised/30">
                  <th className="th">Crawl</th>
                  <th className="th">Started</th>
                  <th className="th text-right">Health</th>
                  <th className="th text-right">Pages</th>
                  <th className="th text-right">Critical</th>
                  <th className="th text-right">Warnings</th>
                  <th className="th">Schedule</th>
                  <th className="th text-right">Report</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => {
                  const s = auditIssueSummary(a);
                  return (
                    <tr key={a.id} className="table-row">
                      <td className="td"><div className="flex items-center gap-2"><FileBarChart className="h-3.5 w-3.5 text-faint" /><span className="font-medium">{a.name}</span></div></td>
                      <td className="td text-[12px] text-muted">{fmtDate(a.createdAt)}</td>
                      <td className="td text-right"><span className={`tabular-nums font-semibold ${a.score >= 75 ? "text-brand" : a.score >= 50 ? "text-amber" : "text-rose"}`}>{a.score}</span></td>
                      <td className="td text-right tabular-nums">{fmtNumber(a.pagesCrawled)}</td>
                      <td className="td text-right tabular-nums text-rose">{s.bySeverity.critical.length}</td>
                      <td className="td text-right tabular-nums text-amber">{s.bySeverity.warning.length}</td>
                      <td className="td text-[11.5px] capitalize text-muted">{a.schedule}</td>
                      <td className="td text-right"><Link href={`/${project.id}/audits/${a.id}`} className="btn-soft btn-xs">View</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ScanSearch className="h-8 w-8 text-faint" />
            <p className="mt-3 text-[14px] font-medium">No audits yet</p>
            <p className="mt-1 max-w-sm text-[12.5px] text-muted">Run your first crawl to find technical debt, on-page gaps and Core Web Vitals problems.</p>
            <div className="mt-4">{readOnly ? <SignInToEdit what="run a crawl" /> : <RunAuditButton projectId={project.id} />}</div>
          </div>
        </Card>
      )}
    </div>
  );
}
