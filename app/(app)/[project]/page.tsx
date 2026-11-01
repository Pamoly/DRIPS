import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, Clock, FileText, Gauge, Link2, ListChecks,
  Plug, ScanSearch, Sparkles, Swords, Target, TrendingUp, Users, Zap, Search, AlertTriangle, Globe2,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import {
  aiVisibility, contentPipeline, findProject, keywordMetrics, latestAudit, movers, opportunities,
  projectActivity, projectAi, projectBacklinks, projectCompetitors, projectDocs, projectGsc, projectKeywords,
  projectReports, projectTasks, taskSummary, visibilityTrend, backlinkSummary, auditIssueSummary,
} from "@/lib/derive";
import { gscCompare, gscSeries } from "@/lib/gsc";
import { fmtCompact, fmtNumber, fmtPct, fmtRelative, scoreTone } from "@/lib/format";
import { Avatar, Badge, Card, Delta, EmptyState, Kpi, PageHeader, Progress, ScoreRing, SectionHeader } from "@/components/ui";
import { AreaChart, Donut } from "@/components/charts";
import { RefreshRanksButton, RunAuditButton } from "@/components/actions";
import { SignInToEdit } from "@/components/read-only";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();

  const keywords = projectKeywords(db, project.id);
  const metrics = keywordMetrics(keywords);
  const trend = visibilityTrend(keywords, "google", 90);
  const last30 = trend.slice(-30);
  const prev30 = trend.slice(-60, -30);
  const avg = (arr: { visibility: number }[]) => (arr.length ? arr.reduce((s, x) => s + x.visibility, 0) / arr.length : 0);
  const visibilityDelta = Math.round((avg(last30) - avg(prev30)) * 10) / 10;

  const gainedLost = movers(keywords, "google", 7);
  const opps = opportunities(keywords, "google", 6);
  const audit = latestAudit(db, project.id);
  const auditSummary = audit ? auditIssueSummary(audit) : null;
  const gscQueries = projectGsc(db, project.id);
  const gscCompareData = gscCompare(gscQueries);
  const gscPoints = gscSeries(gscQueries, 28, project.id);
  const competitors = projectCompetitors(db, project.id);
  const activity = projectActivity(db, project.id).slice(0, 6);
  const tasks = taskSummary(projectTasks(db, project.id));
  const docs = projectDocs(db, project.id);
  const pipeline = contentPipeline(docs);
  const ai = aiVisibility(projectAi(db, project.id));
  const links = backlinkSummary(projectBacklinks(db, project.id));
  const reports = projectReports(db, project.id);
  const userById = (id: string) => db.users.find((u) => u.id === id);
  const ownSeries = trend.slice(-14).map((t) => t.visibility);
  const hour = new Date().getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const viewer = db.users.find((u) => u.id === user.id);
  const readOnly = Boolean(user.isGuest);

  const distSegments = metrics.distribution.map((d) => ({ label: d.label, value: d.count, color: d.color }));
  const top10Pct = metrics.total ? Math.round((metrics.top10 / metrics.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color }} />
            {project.name} · {project.country} · {project.language}
          </>
        }
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        description={`Daily brief for ${project.domain}. Last SERP pull ${fmtRelative(project.gsc.lastSync)} · ${metrics.tracked} tracked keywords across 4 engines.`}
        actions={
          <>
            {readOnly ? (
              <SignInToEdit what="run audits or refresh rankings" />
            ) : (
              <>
                <RefreshRanksButton projectId={project.id} />
                <RunAuditButton projectId={project.id} />
              </>
            )}
            <Link href={`/${project.id}/reports`} className="btn-ghost btn-sm">
              <FileText className="h-3.5 w-3.5" /> Client report
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="Organic visibility"
          value={`${metrics.visibility}%`}
          delta={visibilityDelta}
          deltaSuffix="%"
          hint="vs previous 30 days"
          icon={<Gauge className="h-3.5 w-3.5" />}
          tone="brand"
          href={`/${project.id}/rank-tracker`}
        />
        <Kpi
          label="Keywords in top 10"
          value={fmtNumber(metrics.top10)}
          delta={metrics.improved - metrics.declined}
          hint={`${metrics.top3} in top 3 · ${top10Pct}% of tracked`}
          icon={<Target className="h-3.5 w-3.5" />}
          tone="sky"
          href={`/${project.id}/keywords`}
        />
        <Kpi
          label="Est. organic traffic"
          value={fmtCompact(metrics.traffic)}
          hint={`from ${fmtCompact(metrics.volume)} monthly searches`}
          delta={Math.round((avg(last30) - avg(prev30)) * 1.4 * 10) / 10}
          deltaSuffix="%"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          tone="iris"
          href={`/${project.id}/rank-tracker`}
        />
        <Kpi
          label="GSC clicks · 28d"
          value={fmtCompact(gscCompareData.now.clicks)}
          delta={gscCompareData.delta.clicks}
          deltaSuffix="%"
          hint={`${fmtPct(gscCompareData.now.ctr)} CTR · pos ${gscCompareData.now.position}`}
          icon={<Search className="h-3.5 w-3.5" />}
          tone="amber"
          href={`/${project.id}/search-console`}
        />
        <Kpi
          label="Site health"
          value={audit ? `${audit.score}/100` : "—"}
          hint={audit ? `${auditSummary?.bySeverity.critical.length} critical issues open` : "Run your first crawl"}
          icon={<ScanSearch className="h-3.5 w-3.5" />}
          tone={audit && audit.score >= 75 ? "brand" : "rose"}
          href={`/${project.id}/audits`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Visibility trend */}
        <Card className="xl:col-span-8">
          <SectionHeader
            title="Search visibility trend"
            subtitle="Volume-weighted ranking performance across tracked keywords"
            action={
              <div className="flex items-center gap-2">
                <Badge tone="brand">Google</Badge>
                <Badge tone="outline">90 days</Badge>
              </div>
            }
          />
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <div>
              <div className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{trend[trend.length - 1]?.visibility}%</div>
              <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted">
                <Delta value={visibilityDelta} suffix="%" /> <span>vs prior 30d</span>
              </div>
            </div>
            <div className="flex gap-6 text-[12px]">
              <div>
                <div className="label">Top 3</div>
                <div className="mt-1 text-[15px] font-semibold tabular-nums">{trend[trend.length - 1]?.top3}</div>
              </div>
              <div>
                <div className="label">Top 10</div>
                <div className="mt-1 text-[15px] font-semibold tabular-nums">{trend[trend.length - 1]?.top10}</div>
              </div>
              <div>
                <div className="label">Not ranking</div>
                <div className="mt-1 text-[15px] font-semibold tabular-nums text-muted">{metrics.notRanking}</div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <AreaChart
              series={[{ name: "Visibility", color: "#4ADE80", values: trend.map((t) => t.visibility) }]}
              labels={trend.map((t) => t.date)}
              height={224}
              format="percent1"
            />
          </div>
        </Card>

        {/* Distribution */}
        <Card className="xl:col-span-4">
          <SectionHeader title="Ranking distribution" subtitle="Across all tracked keywords" action={<Link href={`/${project.id}/rank-tracker`} className="btn-ghost btn-xs">View <ChevronRight className="h-3 w-3" /></Link>} />
          <div className="mt-4">
            <Donut segments={distSegments} centerValue={`${metrics.top10}`} centerLabel="top 10" size={126} />
          </div>
          <div className="mt-4 space-y-2.5 border-t border-line pt-3.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted">Improved this week</span>
              <span className="font-medium tabular-nums text-brand">+{metrics.improved}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted">Declined this week</span>
              <span className="font-medium tabular-nums text-rose">−{metrics.declined}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted">New entries</span>
              <span className="font-medium tabular-nums">{metrics.newEntries}</span>
            </div>
          </div>
        </Card>

        {/* Opportunities */}
        <Card className="xl:col-span-8" padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader
              title="Top keyword opportunities"
              subtitle="Highest click upside within striking distance of page one"
              action={<Link href={`/${project.id}/keywords`} className="btn-ghost btn-xs">Keyword explorer <ArrowUpRight className="h-3 w-3" /></Link>}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-y border-line bg-raised/30">
                  <th className="th">Keyword</th>
                  <th className="th">Pos</th>
                  <th className="th text-right">Volume</th>
                  <th className="th">KD</th>
                  <th className="th text-right">Click upside</th>
                  <th className="th">Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {opps.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[12.5px] text-muted">No ranking opportunities yet — add keywords to start finding upside.</td></tr>
                )}
                {opps.map((o) => (
                  <tr key={o.keyword.id} className="table-row">
                    <td className="td">
                      <div className="max-w-[260px] truncate font-medium">{o.keyword.phrase}</div>
                      <div className="mt-0.5 text-[11px] text-faint">{o.keyword.cluster} · {o.keyword.intent}</div>
                    </td>
                    <td className="td">
                      <span className="inline-flex h-6 min-w-7 items-center justify-center rounded-md border border-line bg-raised/70 px-1.5 font-medium tabular-nums">#{o.position}</span>
                    </td>
                    <td className="td text-right tabular-nums">{fmtCompact(o.keyword.volume)}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-10 overflow-hidden rounded-full bg-raised">
                          <div className={o.keyword.difficulty >= 70 ? "h-full bg-rose" : o.keyword.difficulty >= 45 ? "h-full bg-amber" : "h-full bg-brand"} style={{ width: `${o.keyword.difficulty}%` }} />
                        </div>
                        <span className="text-[11.5px] tabular-nums text-muted">{o.keyword.difficulty}</span>
                      </div>
                    </td>
                    <td className="td text-right font-medium tabular-nums text-brand">+{fmtCompact(o.upside)}</td>
                    <td className="td"><span className="text-[12px] text-muted">{o.action}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Movers */}
        <Card className="xl:col-span-4">
          <SectionHeader title="Biggest movers" subtitle="Last 7 days, weighted by search volume" action={<Link href={`/${project.id}/rank-tracker`} className="btn-ghost btn-xs">All</Link>} />
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-brand">
              <ArrowUpRight className="h-3 w-3" /> Gaining
            </p>
            <ul className="space-y-2">
              {gainedLost.gained.length === 0 && <li className="text-[11.5px] text-faint">No keywords gained positions this week.</li>}
              {gainedLost.gained.slice(0, 4).map((m) => (
                <li key={m.keyword.id} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate">{m.keyword.phrase}</span>
                  <span className="shrink-0 tabular-nums text-faint">#{m.from}</span>
                  <span className="shrink-0 tabular-nums">#{m.to}</span>
                  <span className="shrink-0 tabular-nums text-brand">+{m.delta}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-rose">
              <ArrowRight className="h-3 w-3 rotate-90" /> Losing
            </p>
            <ul className="space-y-2">
              {gainedLost.lost.length === 0 && <li className="text-[11.5px] text-faint">No keywords dropped this week.</li>}
              {gainedLost.lost.slice(0, 4).map((m) => (
                <li key={m.keyword.id} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate">{m.keyword.phrase}</span>
                  <span className="shrink-0 tabular-nums text-faint">#{m.from}</span>
                  <span className="shrink-0 tabular-nums">#{m.to}</span>
                  <span className="shrink-0 tabular-nums text-rose">{m.delta}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Search console */}
        <Card className="xl:col-span-5">
          <SectionHeader
            title="Search Console"
            subtitle="Clicks and impressions · last 28 days"
            action={<Link href={`/${project.id}/search-console`} className="btn-ghost btn-xs">Open</Link>}
          />
          {project.gsc.connected ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { k: "Clicks", v: fmtCompact(gscCompareData.now.clicks), d: gscCompareData.delta.clicks },
                  { k: "Impressions", v: fmtCompact(gscCompareData.now.impressions), d: gscCompareData.delta.impressions },
                  { k: "Avg position", v: String(gscCompareData.now.position), d: gscCompareData.delta.position, invert: true },
                ].map((s) => (
                  <div key={s.k}>
                    <div className="label">{s.k}</div>
                    <div className="mt-1 text-[16px] font-semibold tabular-nums">{s.v}</div>
                    <Delta value={s.d} suffix={s.invert ? "" : "%"} invert={s.invert} className="mt-0.5" />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <AreaChart
                  series={[{ name: "Clicks", color: "#FBBF24", values: gscPoints.map((p) => p.clicks) }]}
                  labels={gscPoints.map((p) => p.date)}
                  height={150}
                  showLegend={false}
                  area
                />
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Synced {fmtRelative(project.gsc.lastSync)} · {project.gsc.property}
              </div>
            </>
          ) : (
            <EmptyState title="Search Console not connected" description="Link the property to unlock query-level clicks, impressions and CTR." action={<Link href={`/${project.id}/settings`} className="btn-primary btn-sm"><Plug className="h-3.5 w-3.5" /> Connect GSC</Link>} />
          )}
        </Card>

        {/* AI visibility */}
        <Card className="xl:col-span-4">
          <SectionHeader title="AI answer visibility" subtitle="Brand mentions across 5 answer engines" action={<Link href={`/${project.id}/ai-visibility`} className="btn-ghost btn-xs">Open</Link>} />
          <div className="mt-4 flex items-center gap-5">
            <ScoreRing score={ai.coverage} size={78} label="coverage" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex justify-between text-[12px]"><span className="text-muted">Mentioned</span><span className="tabular-nums">{ai.mentioned}/{ai.prompts} prompts</span></div>
              <div className="flex justify-between text-[12px]"><span className="text-muted">Share of voice</span><span className="tabular-nums">{ai.shareOfVoice}%</span></div>
              <div className="flex justify-between text-[12px]"><span className="text-muted">Avg position</span><span className="tabular-nums">#{ai.avgPosition}</span></div>
            </div>
          </div>
          <ul className="mt-4 space-y-2 border-t border-line pt-3">
            {ai.byEngine.map((e) => (
              <li key={e.engine} className="flex items-center gap-2 text-[11.5px]">
                <span className="w-[88px] shrink-0 truncate text-muted">{e.engine}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-iris" style={{ width: `${e.coverage}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-faint">{Math.round(e.coverage)}%</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Activity */}
        <Card className="xl:col-span-3">
          <SectionHeader title="Team activity" subtitle="Latest in this project" action={<Link href={`/${project.id}/tasks`} className="btn-ghost btn-xs">Tasks</Link>} />
          <ul className="mt-4 space-y-3.5">
            {activity.map((a) => {
              const u = userById(a.actorId);
              return (
                <li key={a.id} className="flex gap-2.5">
                  {u && <Avatar name={u.name} hue={u.hue} size={24} />}
                  <div className="min-w-0 text-[11.5px] leading-snug">
                    <p className="text-ink"><span className="font-medium">{u?.name.split(" ")[0]}</span> <span className="text-muted">{a.action}</span></p>
                    <p className="truncate text-faint">{a.target}</p>
                    <p className="mt-0.5 text-[10.5px] text-faint/80">{fmtRelative(a.at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Competitive landscape */}
        <Card className="xl:col-span-6">
          <SectionHeader
            title="Competitive landscape"
            subtitle={`You hold ${metrics.visibility}% visibility vs ${competitors.length} tracked rivals`}
            action={<Link href={`/${project.id}/competitors`} className="btn-ghost btn-xs">Compare</Link>}
          />
          <div className="mt-4">
            <AreaChart
              series={[
                { name: project.name, color: project.color, values: ownSeries },
                ...competitors.slice(0, 3).map((c) => ({ name: c.name, color: ["#818CF8", "#FBBF24", "#FB7185"][competitors.indexOf(c)] ?? "#38BDF8", values: c.trend.slice(-14) })),
              ]}
              labels={competitors[0]?.trend.slice(-14).map((_, i) => `D${i + 1}`) ?? []}
              height={180}
              format="percent1"
              area={false}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-4">
            <div>
              <div className="label">Referring domains</div>
              <div className="mt-1 text-[14px] font-semibold tabular-nums">{fmtCompact(links.referringDomains)}</div>
            </div>
            <div>
              <div className="label">Live backlinks</div>
              <div className="mt-1 text-[14px] font-semibold tabular-nums">{fmtCompact(links.live)}</div>
            </div>
            <div>
              <div className="label">New links</div>
              <div className="mt-1 text-[14px] font-semibold tabular-nums text-brand">+{links.new}</div>
            </div>
            <div>
              <div className="label">Lost links</div>
              <div className="mt-1 text-[14px] font-semibold tabular-nums text-rose">−{links.lost}</div>
            </div>
          </div>
        </Card>

        {/* Team workflow */}
        <Card className="xl:col-span-3">
          <SectionHeader title="Workflow" subtitle={`${tasks.total} tasks in this sprint`} action={<Link href={`/${project.id}/tasks`} className="btn-ghost btn-xs">Board</Link>} />
          <div className="mt-4 space-y-2.5">
            {[
              { label: "To do", value: tasks.todo, tone: "muted" as const },
              { label: "In progress", value: tasks.inProgress, tone: "sky" as const },
              { label: "In review", value: tasks.review, tone: "amber" as const },
              { label: "Done", value: tasks.done, tone: "brand" as const },
            ].map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-muted">{s.label}</span>
                  <span className="tabular-nums">{s.value}</span>
                </div>
                <Progress value={s.value} max={tasks.total || 1} tone={s.tone} height={5} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/[0.06] px-2.5 py-2 text-[11.5px]">
            <AlertTriangle className="h-3.5 w-3.5 text-amber" />
            <span className="text-muted"><span className="font-medium text-amber">{tasks.overdue}</span> overdue · {tasks.review} awaiting review</span>
          </div>
        </Card>

        {/* Integrations */}
        <Card className="xl:col-span-3">
          <SectionHeader title="Integrations" subtitle="Data sources feeding this project" action={<Link href={`/${project.id}/settings`} className="btn-ghost btn-xs">Manage</Link>} />
          <ul className="mt-4 space-y-2">
            <li className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/30 p-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-sky/10 text-sky"><Search className="h-3.5 w-3.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">Google Search Console</p>
                <p className="truncate text-[10.5px] text-faint">{project.gsc.connected ? project.gsc.property : "Not connected"}</p>
              </div>
              <span className={`h-1.5 w-1.5 rounded-full ${project.gsc.connected ? "bg-brand" : "bg-faint"}`} />
            </li>
            <li className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/30 p-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-iris/10 text-iris"><Plug className="h-3.5 w-3.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">WordPress connector</p>
                <p className="truncate text-[10.5px] text-faint">{project.wp.connected ? `v${project.wp.version} · ping ${fmtRelative(project.wp.lastPing)}` : "Not installed"}</p>
              </div>
              <span className={`h-1.5 w-1.5 rounded-full ${project.wp.connected ? "bg-brand" : "bg-faint"}`} />
            </li>
            <li className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/30 p-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand/10 text-brand"><Zap className="h-3.5 w-3.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">Daily rank tracking</p>
                <p className="truncate text-[10.5px] text-faint">4 engines · {project.countryCode} + 12 locales</p>
              </div>
              <Badge tone="brand">Active</Badge>
            </li>
          </ul>
          <Link href={`/${project.id}/wordpress`} className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-[11.5px] text-muted transition hover:border-brand/40 hover:text-ink">
            <Plug className="h-3.5 w-3.5" /> Install WordPress SEO plugin
          </Link>
        </Card>

        {/* Content pipeline */}
        <Card className="xl:col-span-6">
          <SectionHeader
            title="Content optimization pipeline"
            subtitle={`${pipeline.draft} drafts · ${pipeline.optimized} optimized · ${pipeline.published} published`}
            action={<Link href={`/${project.id}/content`} className="btn-ghost btn-xs">Open editor</Link>}
          />
          <ul className="mt-3 divide-y divide-line/70">
            {docs.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <ScoreRing score={d.score} size={38} stroke={4} />
                <div className="min-w-0 flex-1">
                  <Link href={`/${project.id}/content/${d.id}`} className="block truncate text-[12.5px] font-medium hover:text-brand">{d.title}</Link>
                  <p className="truncate text-[11px] text-faint">{d.targetKeyword} · {fmtNumber(d.wordCount)} words · {d.status}</p>
                </div>
                <Badge tone={d.status === "published" ? "brand" : d.status === "optimized" ? "sky" : "outline"}>{d.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Recent audit */}
        <Card className="xl:col-span-6">
          <SectionHeader title="Latest site audit" subtitle={audit ? `${audit.pagesCrawled} pages crawled · ${fmtRelative(audit.createdAt)}` : "No crawl yet"} action={<Link href={`/${project.id}/audits`} className="btn-ghost btn-xs">All audits</Link>} />
          {audit ? (
            <div className="mt-3 flex flex-wrap items-start gap-5">
              <ScoreRing score={audit.score} size={82} label="health" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="rose">{auditSummary?.bySeverity.critical.length} critical</Badge>
                  <Badge tone="amber">{auditSummary?.bySeverity.warning.length} warnings</Badge>
                  <Badge tone="sky">{auditSummary?.bySeverity.notice.length} notices</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  {[
                    { k: "LCP", v: `${audit.vitals.lcp}s`, ok: audit.vitals.lcp <= 2.5 },
                    { k: "CLS", v: audit.vitals.cls.toFixed(2), ok: audit.vitals.cls <= 0.1 },
                    { k: "INP", v: `${audit.vitals.inp}ms`, ok: audit.vitals.inp <= 200 },
                  ].map((v) => (
                    <div key={v.k} className="rounded-lg border border-line bg-raised/30 p-2">
                      <p className="text-faint">{v.k}</p>
                      <p className={`mt-0.5 font-semibold tabular-nums ${v.ok ? "text-brand" : "text-rose"}`}>{v.v}</p>
                    </div>
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {audit.issues.slice(0, 3).map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-[11.5px]">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i.severity === "critical" ? "bg-rose" : i.severity === "warning" ? "bg-amber" : "bg-sky"}`} />
                      <span className="truncate text-muted">{i.title}</span>
                      <span className="ml-auto shrink-0 text-[10.5px] text-faint">{i.affected} URLs</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/${project.id}/audits/${audit.id}`} className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
                  Open full audit <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState title="No audits yet" description="Run a crawl to surface technical, content and performance issues." action={readOnly ? <SignInToEdit what="run a crawl" compact /> : <RunAuditButton projectId={project.id} />} icon={<ScanSearch className="h-4 w-4" />} />
          )}
        </Card>
      </div>
    </div>
  );
}
