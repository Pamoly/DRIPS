import { notFound } from "next/navigation";
import { Download, Swords, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { backlinkSummary, competitorOverview, findProject, keywordMetrics, projectBacklinks, projectCompetitors, projectKeywords } from "@/lib/derive";
import { fmtCompact, fmtNumber } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader, SectionHeader } from "@/components/ui";
import { CompetitorsView } from "@/components/competitors-view";
import { AreaChart } from "@/components/charts";
import { rngFor, randInt } from "@/lib/rand";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const competitors = projectCompetitors(db, project.id);
  const keywords = projectKeywords(db, project.id);
  const metrics = keywordMetrics(keywords);
  const own = competitorOverview(competitors, keywords);
  const links = backlinkSummary(projectBacklinks(db, project.id));

  const linkGap = competitors
    .flatMap((c, i) =>
      ["fieldreview.com", "gearjunkie.com", "reviewedlab.com", "thestrategist.com", "productweekly.com", "growthstack.io", "betterliving.co", "trailnotes.co"].map((domain, j) => {
        const rng = rngFor("linkgap", project.id, domain);
        return {
          domain,
          dr: randInt(rng, 38, 88),
          traffic: randInt(rng, 800, 42000),
          competitors: competitors.filter((cc, k) => (k + i + j) % 3 !== 0).slice(0, 2).map((cc) => cc.name),
        };
      }),
    )
    .filter((l, i, arr) => arr.findIndex((x) => x.domain === l.domain) === i)
    .sort((a, b) => b.dr - a.dr)
    .slice(0, 8);

  const gapCount = new Set(competitors.flatMap((c) => c.gapKeywords.map((k) => k.phrase))).size;
  const best = own.best;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Swords className="h-3 w-3" /> {competitors.length} competitors tracked · {project.country}</>}
        title="Competitor Intelligence"
        description="Benchmark visibility, mine keyword gaps, and find the exact pages and domains driving your rivals' organic growth."
        actions={
          <>
            <Badge tone="iris"><Users className="h-3 w-3" /> Share of voice {own.shareOfVoice}%</Badge>
            <button className="btn-ghost btn-sm"><Download className="h-3.5 w-3.5" /> Export gap</button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Your visibility" value={`${metrics.visibility}%`} hint={`${fmtNumber(metrics.top10)} keywords in top 10`} tone="brand" />
        <Kpi label="Market leader" value={best ? `${best.visibility}%` : "—"} hint={best ? best.name : "Add a competitor"} tone="iris" />
        <Kpi label="Visibility gap" value={`${own.gap} pp`} hint="vs strongest competitor" tone="rose" />
        <Kpi label="Keyword opportunities" value={fmtNumber(gapCount)} hint="terms rivals rank for, you don't" tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <SectionHeader title="Visibility head-to-head" subtitle="14-day estimated organic visibility index" action={<Badge tone="outline">Daily</Badge>} />
          <div className="mt-4">
            <AreaChart
              series={[
                { name: "You", color: project.color, values: (competitors[0]?.trend ?? []).map((_, i) => Math.round((metrics.visibility + Math.sin(i / 2.2) * 1.2) * 10) / 10) },
                ...competitors.slice(0, 4).map((c, i) => ({ name: c.name, color: ["#818CF8", "#38BDF8", "#FBBF24", "#FB7185"][i], values: c.trend })),
              ]}
              labels={(competitors[0]?.trend ?? []).map((_, i) => `D${i + 1}`)}
              height={230}
              format="percent1"
              area={false}
            />
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <SectionHeader title="Where the gap is" subtitle="Top gap clusters by volume" />
          <div className="mt-4 space-y-3">
            {competitors.slice(0, 4).map((c) => {
              const vol = c.gapKeywords.reduce((s, k) => s + k.volume, 0);
              return (
                <div key={c.id} className="rounded-lg border border-line bg-raised/20 p-3">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted">{fmtCompact(vol)}/mo</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] text-faint">{c.gapKeywords.slice(0, 3).map((k) => k.phrase).join(" · ")}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">Open the keyword gap tab to track any of {gapCount} opportunities in one click.</p>
        </Card>
      </div>

      <CompetitorsView
        projectId={project.id}
        projectName={project.name}
        ownVisibility={metrics.visibility}
        competitors={competitors}
        ownReferrers={links.referringDomains}
        linkGap={linkGap}
      />
    </div>
  );
}
