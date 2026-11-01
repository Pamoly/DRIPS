import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Clock, Download, Filter, Link2, MousePointerClick, Search, Eye, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { findProject, projectGsc } from "@/lib/derive";
import { gscCompare, gscSeries } from "@/lib/gsc";
import { fmtCompact, fmtNumber, fmtPct, fmtRelative, positionTone } from "@/lib/format";
import { Badge, Card, Delta, EmptyState, Kpi, PageHeader, Progress, SectionHeader } from "@/components/ui";
import { AreaChart, BarChart, Donut, HorizontalBars } from "@/components/charts";
import { GscExplorer } from "@/components/gsc-explorer";
import { ActionButton } from "@/components/actions";

export const metadata = { title: "Search Console" };

export default async function SearchConsolePage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const queries = projectGsc(db, project.id);
  const compare = gscCompare(queries);
  const points = gscSeries(queries, 90, project.id);
  const last28 = points.slice(-28);

  if (!project.gsc.connected) {
    return (
      <div className="space-y-5">
        <PageHeader title="Search Console" description="Query-level performance straight from Google Search Console." />
        <Card>
          <EmptyState
            icon={<Search className="h-4 w-4" />}
            title="Connect Google Search Console"
            description="Authorise the property to import 16 months of clicks, impressions, CTR and average position, segmented by page, country and device."
            action={
              <ActionButton
                endpoint="/api/integrations/gsc"
                body={{ projectId: project.id, action: "connect" }}
                className="btn-primary btn-sm"
                pendingLabel="Connecting…"
              >
                <Link2 className="h-3.5 w-3.5" /> Connect property
              </ActionButton>
            }
          />
        </Card>
      </div>
    );
  }

  const devices = ["Desktop", "Mobile", "Tablet"].map((d) => ({
    label: d,
    value: queries.filter((q) => q.device === d).reduce((s, q) => s + q.clicks, 0),
    color: d === "Desktop" ? "#818CF8" : d === "Mobile" ? "#38BDF8" : "#FBBF24",
  }));
  const countries = Object.entries(
    queries.reduce<Record<string, number>>((acc, q) => {
      acc[q.country] = (acc[q.country] ?? 0) + q.clicks;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));
  const pages = Object.entries(
    queries.reduce<Record<string, number>>((acc, q) => {
      acc[q.page] = (acc[q.page] ?? 0) + q.clicks;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));
  const striking = queries
    .filter((q) => q.position >= 8 && q.position <= 25)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 7);
  const totalClicks = compare.now.clicks;
  const ctrByDevice = (d: string) => {
    const list = queries.filter((q) => q.device === d);
    const c = list.reduce((s, q) => s + q.clicks, 0);
    const i = list.reduce((s, q) => s + q.impressions, 0);
    return i ? (c / i) * 100 : 0;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><CheckCircle2 className="h-3 w-3 text-brand" /> Connected · {project.gsc.property}</>}
        title="Search Console"
        description={`Imported query-level data · last sync ${fmtRelative(project.gsc.lastSync)} · 90-day window with page, country and device segmentation.`}
        actions={
          <>
            <Badge tone="brand"><Clock className="h-3 w-3" /> Auto-sync daily</Badge>
            <ActionButton endpoint="/api/integrations/gsc" body={{ projectId: project.id, action: "sync" }} className="btn-soft btn-sm" pendingLabel="Syncing…">
              <Download className="h-3.5 w-3.5" /> Sync now
            </ActionButton>
            <Link href={`/${project.id}/reports`} className="btn-ghost btn-sm">Add to report <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Clicks · 28 days" value={fmtNumber(compare.now.clicks)} delta={compare.delta.clicks} deltaSuffix="%" hint="vs previous 28 days" icon={<MousePointerClick className="h-3.5 w-3.5" />} tone="brand" />
        <Kpi label="Impressions" value={fmtCompact(compare.now.impressions)} delta={compare.delta.impressions} deltaSuffix="%" hint="search appearances" icon={<Eye className="h-3.5 w-3.5" />} tone="sky" />
        <Kpi label="CTR" value={`${compare.now.ctr}%`} delta={compare.delta.ctr} deltaSuffix="pp" hint="clicks ÷ impressions" icon={<Target className="h-3.5 w-3.5" />} tone="iris" />
        <Kpi label="Avg. position" value={String(compare.now.position)} delta={compare.delta.position} hint="impression-weighted" icon={<Filter className="h-3.5 w-3.5" />} tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <SectionHeader
            title="Clicks & impressions"
            subtitle="Daily performance, last 90 days"
            action={<div className="flex items-center gap-3 text-[11px] text-muted"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber" />Clicks</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky" />Impressions ÷ 10</span></div>}
          />
          <div className="mt-4">
            <AreaChart
              series={[
                { name: "Clicks", color: "#FBBF24", values: points.map((p) => p.clicks) },
                { name: "Impressions ÷10", color: "#38BDF8", values: points.map((p) => Math.round(p.impressions / 10)) },
              ]}
              labels={points.map((p) => p.date)}
              height={238}
              area
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-3 sm:grid-cols-4">
            <div><div className="label">Best day</div><div className="mt-1 text-[13px] font-medium tabular-nums">{fmtNumber(Math.max(...points.map((p) => p.clicks)))} clicks</div></div>
            <div><div className="label">Avg. daily clicks</div><div className="mt-1 text-[13px] font-medium tabular-nums">{fmtNumber(Math.round(compare.now.clicks / 28))}</div></div>
            <div><div className="label">Top query</div><div className="mt-1 truncate text-[13px] font-medium">{[...queries].sort((a, b) => b.clicks - a.clicks)[0]?.query}</div></div>
            <div><div className="label">Pages ranking</div><div className="mt-1 text-[13px] font-medium tabular-nums">{new Set(queries.map((q) => q.page)).size}</div></div>
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="Clicks by device" />
            <div className="mt-4"><Donut segments={devices} centerValue={fmtCompact(devices.reduce((s, d) => s + d.value, 0))} centerLabel="clicks" size={116} /></div>
            <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[11.5px]">
              {devices.map((d) => (
                <div key={d.label} className="flex justify-between"><span className="text-muted">{d.label} CTR</span><span className="tabular-nums">{fmtPct(ctrByDevice(d.label), 2)}</span></div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionHeader title="Average position trend" subtitle="Lower is better" />
            <div className="mt-3">
              <AreaChart
                series={[{ name: "Position", color: "#818CF8", values: last28.map((p) => p.position) }]}
                labels={last28.map((p) => p.date)}
                height={120}
                invertY
                format="position"
                showLegend={false}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <SectionHeader title="Top pages" subtitle="Clicks by landing page" />
          <div className="mt-4">
            <HorizontalBars data={pages} format="compact" color="#4ADE80" />
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <SectionHeader title="Countries" subtitle="Clicks by market" />
          <div className="mt-4">
            <HorizontalBars data={countries} format="compact" color="#38BDF8" />
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <SectionHeader title="Striking distance" subtitle="Positions 8–25 with high impressions" action={<Badge tone="amber">Quick wins</Badge>} />
          <ul className="mt-3 divide-y divide-line/70">
            {striking.map((q) => (
              <li key={q.id} className="flex items-center gap-2 py-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate">{q.query}</span>
                <span className={positionTone(Math.round(q.position)) + " rounded border px-1.5 py-0.5 text-[10.5px] tabular-nums"}>{q.position.toFixed(1)}</span>
                <span className="w-12 shrink-0 text-right tabular-nums text-faint">{fmtCompact(q.impressions)}</span>
              </li>
            ))}
          </ul>
          <Link href={`/${project.id}/content`} className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
            Optimize these pages <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      <GscExplorer queries={queries} projectId={project.id} />
    </div>
  );
}
