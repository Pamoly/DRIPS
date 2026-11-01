import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Download, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { backlinkSummary, findProject, projectBacklinks, projectCompetitors } from "@/lib/derive";
import { fmtCompact, fmtNumber } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader, SectionHeader } from "@/components/ui";
import { BarChart, Donut, HorizontalBars } from "@/components/charts";
import { BacklinksTable } from "@/components/backlinks-table";
import { dayKey } from "@/lib/rand";

export const metadata = { title: "Backlinks" };

export default async function BacklinksPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const links = projectBacklinks(db, project.id);
  const summary = backlinkSummary(links);
  const competitors = projectCompetitors(db, project.id);

  const domainMap = new Map<string, { domain: string; dr: number; traffic: number; count: number }>();
  for (const l of links) {
    if (l.status === "lost") continue;
    const existing = domainMap.get(l.sourceDomain);
    if (existing) {
      existing.count += 1;
      existing.dr = Math.max(existing.dr, l.dr);
      existing.traffic += l.traffic;
    } else {
      domainMap.set(l.sourceDomain, { domain: l.sourceDomain, dr: l.dr, traffic: l.traffic, count: 1 });
    }
  }
  const topDomains = [...domainMap.values()].sort((a, b) => b.dr - a.dr).slice(0, 8);

  const anchorMap = new Map<string, number>();
  for (const l of links) anchorMap.set(l.anchor, (anchorMap.get(l.anchor) ?? 0) + 1);
  const anchors = [...anchorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const anchorColors = ["#4ADE80", "#38BDF8", "#818CF8", "#FBBF24", "#FB7185", "#A78BFA"];

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - (11 - i) * 7 - 7);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - (11 - i) * 7);
    const gained = links.filter((l) => {
      const d = new Date(l.firstSeen).getTime();
      return d >= start.getTime() && d < end.getTime();
    }).length;
    return { label: `W${i + 1}`, value: gained, color: "#4ADE80" };
  });
  const lostSeries = Array.from({ length: 12 }, (_, i) => ({ label: `W${i + 1}`, value: Math.max(0, ((i * 7 + project.id.length * 3) % 5) + (i > 8 ? 2 : 0)), color: "#FB7185" }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Link2 className="h-3 w-3" /> Refreshed daily · {project.domain}</>}
        title="Backlink Profile"
        description="Monitor new and lost links, qualify referring domains, and find link-building opportunities your competitors already own."
        actions={
          <>
            <Badge tone="brand"><ShieldCheck className="h-3 w-3" /> {Math.round((summary.dofollow / (summary.live || 1)) * 100)}% dofollow</Badge>
            <button className="btn-ghost btn-sm"><Download className="h-3.5 w-3.5" /> Export links</button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Live backlinks" value={fmtNumber(summary.live)} hint={`${summary.total} discovered all-time`} tone="brand" icon={<Link2 className="h-3.5 w-3.5" />} />
        <Kpi label="Referring domains" value={fmtNumber(summary.referringDomains)} hint="unique root domains" tone="sky" />
        <Kpi label="New links" value={`+${summary.new}`} hint="last 7 days" tone="brand" icon={<ArrowUpRight className="h-3.5 w-3.5" />} />
        <Kpi label="Lost links" value={`−${summary.lost}`} hint="last 7 days" tone="rose" icon={<ArrowDownRight className="h-3.5 w-3.5" />} />
        <Kpi label="Avg. authority" value={String(summary.authority)} hint="mean DR of live links" tone="iris" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <SectionHeader title="New referring domains" subtitle="Links discovered per week" action={<Badge tone="outline">12 weeks</Badge>} />
          <div className="mt-4">
            <BarChart data={weeks} height={186} color="#4ADE80" format="number" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12px]">
            <span className="text-muted">Links gained this month</span>
            <span className="font-medium tabular-nums text-brand">+{weeks.slice(-4).reduce((s, w) => s + w.value, 0)}</span>
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <SectionHeader title="Lost links" subtitle="Toxic or removed placements" />
          <div className="mt-4">
            <BarChart data={lostSeries} height={186} color="#FB7185" format="number" />
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[11.5px] text-muted">{summary.lost} links dropped in the last 7 days. Review the highest-DR losses first.</p>
        </Card>
        <Card className="xl:col-span-3">
          <SectionHeader title="Anchor text mix" subtitle="Distribution of live anchors" />
          <div className="mt-4">
            <Donut
              segments={anchors.map(([anchor, count], i) => ({ label: anchor.length > 20 ? `${anchor.slice(0, 18)}…` : anchor, value: count, color: anchorColors[i] }))}
              size={120}
              centerValue={String(summary.live)}
              centerLabel="links"
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionHeader title="Top referring domains" subtitle="Highest authority sources linking to you" />
          <div className="mt-4">
            <HorizontalBars data={topDomains.map((d) => ({ label: d.domain, value: d.dr, sublabel: `${d.count} link${d.count === 1 ? "" : "s"} · ${fmtCompact(d.traffic)} traffic` }))} format="number" max={100} />
          </div>
        </Card>
        <Card className="xl:col-span-5">
          <SectionHeader title="Link gap vs competitors" subtitle="Domains linking to rivals but not you" action={<Badge tone="amber"><Sparkles className="h-3 w-3" /> High intent</Badge>} />
          <ul className="mt-3 space-y-2">
            {competitors.slice(0, 5).map((c) => (
              <li key={c.id} className="rounded-lg border border-line bg-raised/20 p-3">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium">{c.domain}</span>
                  <span className="tabular-nums text-muted">{fmtCompact(c.referringDomains)} RD</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-iris" style={{ width: `${Math.min(100, (c.referringDomains / 42000) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">You have {fmtCompact(summary.referringDomains)} referring domains — {fmtCompact(Math.max(0, (competitors[0]?.referringDomains ?? 0) - summary.referringDomains))} behind the market leader.</p>
        </Card>
      </div>

      <BacklinksTable links={links} />
    </div>
  );
}
