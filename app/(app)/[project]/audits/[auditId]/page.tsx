import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Globe2, Printer, ScanSearch, ShieldAlert, Timer, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { auditIssueSummary, findProject, projectAudits } from "@/lib/derive";
import { fmtDate, fmtNumber, fmtRelative, scoreTone } from "@/lib/format";
import { Avatar, Badge, Card, Kpi, PageHeader, Progress, ScoreRing, SectionHeader } from "@/components/ui";
import { BarChart, Donut, Gauge as GaugeChart } from "@/components/charts";
import { AuditIssues } from "@/components/audit-issues";
import { CommentThread } from "@/components/comments";
import { RunAuditButton, CopyButton } from "@/components/actions";
import { SignInToEdit } from "@/components/read-only";

export default async function AuditDetailPage({ params }: { params: Promise<{ project: string; auditId: string }> }) {
  const { project: projectId, auditId } = await params;
  const user = await requireUser();
  const readOnly = Boolean(user.isGuest);
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const audit = db.audits.find((a) => a.id === auditId && a.projectId === project.id);
  if (!audit) notFound();
  const summary = auditIssueSummary(audit);
  const tone = scoreTone(audit.score);
  const comments = db.comments.filter((c) => c.entityType === "audit" && c.entityId === audit.id);
  const users = db.users;
  const previous = projectAudits(db, project.id).find((a) => a.id !== audit.id);
  const slowest = [...audit.pages].sort((a, b) => b.responseMs - a.responseMs).slice(0, 6);

  const vitals = [
    { key: "LCP", label: "Largest Contentful Paint", value: audit.vitals.lcp, unit: "s", good: 2.5, poor: 4 },
    { key: "CLS", label: "Cumulative Layout Shift", value: audit.vitals.cls, unit: "", good: 0.1, poor: 0.25 },
    { key: "INP", label: "Interaction to Next Paint", value: audit.vitals.inp, unit: "ms", good: 200, poor: 500 },
    { key: "FCP", label: "First Contentful Paint", value: audit.vitals.fcp, unit: "s", good: 1.8, poor: 3 },
    { key: "TTFB", label: "Time to First Byte", value: audit.vitals.ttfb, unit: "ms", good: 300, poor: 800 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Link href={`/${project.id}/audits`} className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> All audits
          </Link>
        }
        title={audit.name}
        description={`${audit.startUrl} · crawled ${fmtDate(audit.createdAt)} · ${fmtNumber(audit.pagesCrawled)} pages · ${audit.issues.length} issues found`}
        actions={
          <>
            <CopyButton text={`https://app.drips.seo/${project.id}/audits/${audit.id}`} label="Share link" />
            <button className="btn-ghost btn-sm no-print"><Printer className="h-3.5 w-3.5" /> Print</button>
            <Download className="hidden" />
            {readOnly ? <SignInToEdit what="re-crawl" /> : <RunAuditButton projectId={project.id} label="Re-crawl" />}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <div className="flex items-center gap-4">
            <GaugeChart value={audit.score} label="health" size={140} color={tone.hex} />
            <div className="min-w-0">
              <p className="label">Overall health</p>
              <p className="mt-1 text-[13px] font-medium">{audit.score >= 90 ? "Excellent" : audit.score >= 75 ? "Good — minor fixes" : audit.score >= 50 ? "Needs work" : "Critical"}</p>
              {previous && (
                <p className={`mt-1 text-[12px] ${audit.score >= previous.score ? "text-brand" : "text-rose"}`}>
                  {audit.score >= previous.score ? "+" : ""}{audit.score - previous.score} vs previous crawl
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="rose">{summary.bySeverity.critical.length} critical</Badge>
                <Badge tone="amber">{summary.bySeverity.warning.length} warnings</Badge>
              </div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4 xl:col-span-3">
          {vitals.map((v) => {
            const ok = v.value <= v.good;
            const poor = v.value > v.poor;
            return (
              <Card key={v.key} className="!p-3.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-faint">{v.key}</p>
                <p className={`mt-1 text-[18px] font-semibold tabular-nums ${ok ? "text-brand" : poor ? "text-rose" : "text-amber"}`}>
                  {v.value}{v.unit}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-faint">{v.label}</p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <SectionHeader title="Severity mix" subtitle="Prioritise critical issues first" />
          <div className="mt-4">
            <Donut
              segments={[
                { label: "Critical", value: summary.bySeverity.critical.length, color: "#FB7185" },
                { label: "Warnings", value: summary.bySeverity.warning.length, color: "#FBBF24" },
                { label: "Notices", value: summary.bySeverity.notice.length, color: "#38BDF8" },
              ]}
              centerValue={String(audit.issues.length)}
              centerLabel="issues"
              size={132}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <div><p className="label">URLs affected</p><p className="mt-1 text-[15px] font-semibold tabular-nums">{audit.issues.reduce((s, i) => s + i.affected, 0)}</p></div>
            <div><p className="label">Avg. response</p><p className="mt-1 text-[15px] font-semibold tabular-nums">{Math.round(audit.pages.reduce((s, p) => s + p.responseMs, 0) / audit.pages.length)}ms</p></div>
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <SectionHeader title="Issues by category" subtitle="Where to focus this sprint" />
          <div className="mt-4">
            <BarChart
              data={summary.categories.map((c) => ({ label: c.category, value: c.count, color: c.critical ? "#FB7185" : "#38BDF8" }))}
              height={180}
              format="number"
            />
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <SectionHeader title="Slowest pages" subtitle="Server response time (TTFB)" />
          <ul className="mt-3 space-y-2.5">
            {slowest.map((p) => (
              <li key={p.url}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-muted">{p.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                  <span className={`shrink-0 tabular-nums ${p.responseMs > 800 ? "text-rose" : p.responseMs > 400 ? "text-amber" : "text-brand"}`}>{p.responseMs}ms</span>
                </div>
                <Progress value={p.responseMs} max={1400} tone={p.responseMs > 800 ? "rose" : p.responseMs > 400 ? "amber" : "brand"} height={4} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <AuditIssues issues={audit.issues} />
          <Card padded={false}>
            <div className="p-5 pb-3">
              <SectionHeader title="Crawled pages" subtitle={`${audit.pages.length} URLs with health scores, Core Web Vitals and issue counts`} />
            </div>
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full min-w-[760px]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-y border-line bg-raised/40">
                    <th className="th">URL</th>
                    <th className="th text-right">Score</th>
                    <th className="th text-right">Status</th>
                    <th className="th text-right">Words</th>
                    <th className="th text-right">LCP</th>
                    <th className="th text-right">CLS</th>
                    <th className="th text-right">INP</th>
                    <th className="th text-right">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {[...audit.pages].sort((a, b) => a.score - b.score).map((p) => (
                    <tr key={p.url} className="table-row">
                      <td className="td max-w-[280px]">
                        <span className="block truncate text-[12px]">{p.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                        <span className="block truncate text-[10px] text-faint">{p.title}</span>
                      </td>
                      <td className="td text-right"><span className={`tabular-nums font-semibold ${p.score >= 75 ? "text-brand" : p.score >= 50 ? "text-amber" : "text-rose"}`}>{p.score}</span></td>
                      <td className="td text-right"><span className={`text-[11.5px] tabular-nums ${p.statusCode === 200 ? "text-muted" : "text-rose"}`}>{p.statusCode}</span></td>
                      <td className="td text-right tabular-nums text-muted">{fmtNumber(p.words)}</td>
                      <td className={`td text-right tabular-nums ${p.lcp <= 2.5 ? "text-muted" : "text-rose"}`}>{p.lcp}s</td>
                      <td className={`td text-right tabular-nums ${p.cls <= 0.1 ? "text-muted" : "text-amber"}`}>{p.cls}</td>
                      <td className="td text-right tabular-nums text-muted">{p.inp}ms</td>
                      <td className="td text-right tabular-nums">{p.issues.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="Crawl summary" subtitle="Technical metadata" />
            <div className="mt-3 space-y-2 text-[12px]">
              {[
                { k: "Start URL", v: audit.startUrl },
                { k: "Crawled by", v: users.find((u) => u.id === audit.createdBy)?.name ?? "—" },
                { k: "Crawl date", v: fmtDate(audit.createdAt) },
                { k: "Pages", v: fmtNumber(audit.pagesCrawled) },
                { k: "Status", v: audit.status },
                { k: "Schedule", v: audit.schedule },
                { k: "Robots.txt", v: "Valid · 2 sitemaps" },
              ].map((r) => (
                <div key={r.k} className="flex items-start justify-between gap-3 border-b border-line/60 pb-2 last:border-0">
                  <span className="text-muted">{r.k}</span>
                  <span className="max-w-[60%] truncate text-right font-medium capitalize">{r.v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-[11.5px] text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand" /> Crawl completed without errors · {fmtRelative(audit.completedAt)}
            </div>
          </Card>
          <Card>
            <SectionHeader title="Core Web Vitals verdict" subtitle="Field data proxy from this crawl" />
            <div className="mt-4 space-y-3">
              {vitals.slice(0, 3).map((v) => {
                const pct = Math.min(100, (v.value / v.poor) * 100);
                return (
                  <div key={v.key}>
                    <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-muted">{v.key}</span><span className="tabular-nums">{v.value}{v.unit}</span></div>
                    <Progress value={pct} tone={v.value <= v.good ? "brand" : v.value > v.poor ? "rose" : "amber"} height={5} />
                  </div>
                );
              })}
            </div>
          </Card>
          <CommentThread
            readOnly={readOnly}
            projectId={project.id}
            entityType="audit"
            entityId={audit.id}
            comments={comments}
            users={users.map((u) => ({ id: u.id, name: u.name, hue: u.hue }))}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  );
}
