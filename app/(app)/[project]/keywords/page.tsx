import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Gauge, Layers3, Search, Target, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb, roleInProject } from "@/lib/store";
import { clusterSummary, findProject, keywordMetrics, projectKeywords } from "@/lib/derive";
import { rngFor, randInt, clamp } from "@/lib/rand";
import { fmtCompact, fmtNumber } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { KeywordsExplorer } from "@/components/keywords-explorer";
import type { Intent } from "@/lib/types";
import { RefreshRanksButton } from "@/components/actions";

export const metadata = { title: "Keyword Explorer" };

const MODIFIERS = [
  (s: string) => `best ${s} 2026`,
  (s: string) => `${s} for beginners`,
  (s: string) => `cheap ${s}`,
  (s: string) => `${s} review`,
  (s: string) => `${s} vs alternatives`,
  (s: string) => `${s} near me`,
  (s: string) => `how to choose ${s}`,
  (s: string) => `${s} buying guide`,
];

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { project: projectId } = await params;
  const { q } = await searchParams;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const keywords = projectKeywords(db, project.id);
  const metrics = keywordMetrics(keywords);
  const clusters = clusterSummary(keywords).map((c) => ({ name: c.cluster, count: c.keywords }));
  const role = roleInProject(project, user.id);
  const canEdit = role === "owner" || role === "admin" || role === "editor" || user.role === "owner";

  const existing = new Set(keywords.map((k) => k.phrase.toLowerCase()));
  const seeds = [...keywords].sort((a, b) => b.volume - a.volume).slice(0, 24);
  const suggestions: { phrase: string; volume: number; difficulty: number; cluster: string; intent: Intent }[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    for (const mod of MODIFIERS) {
      if (suggestions.length >= 14) break;
      const phrase = mod(seed.phrase);
      if (existing.has(phrase.toLowerCase()) || seen.has(phrase.toLowerCase())) continue;
      seen.add(phrase.toLowerCase());
      const rng = rngFor("suggest", project.id, phrase);
      suggestions.push({
        phrase,
        volume: Math.max(40, Math.round((seed.volume * (0.12 + rng() * 0.34)) / 10) * 10),
        difficulty: clamp(seed.difficulty + randInt(rng, -18, 10), 4, 84),
        cluster: seed.cluster,
        intent: mod === MODIFIERS[3] || mod === MODIFIERS[4] ? "commercial" : mod === MODIFIERS[2] || mod === MODIFIERS[5] ? "transactional" : "informational",
      });
    }
  }

  const totalVolume = metrics.volume;
  const avgKd = Math.round(keywords.reduce((s, k) => s + k.difficulty, 0) / (keywords.length || 1));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Search className="h-3 w-3" /> {project.country} · {project.language} · updated {metrics.tracked} tracked</>}
        title="Keyword Explorer"
        description="Discover demand, score difficulty, and find the fastest path to page one. Positions shown per engine and refreshed daily."
        actions={
          <>
            <RefreshRanksButton projectId={project.id} label="Refresh SERPs" />
            <Link href={`/${project.id}/rank-tracker`} className="btn-ghost btn-sm">Rank tracker <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Keywords tracked" value={fmtNumber(metrics.tracked)} hint={`${fmtNumber(metrics.total)} total in database`} icon={<Search className="h-3.5 w-3.5" />} tone="sky" />
        <Kpi label="Search volume" value={fmtCompact(totalVolume)} hint="combined monthly demand" icon={<TrendingUp className="h-3.5 w-3.5" />} tone="iris" />
        <Kpi label="Average position" value={String(metrics.avgPosition)} hint={`${metrics.top10} keywords on page one`} icon={<Target className="h-3.5 w-3.5" />} tone="brand" />
        <Kpi label="Avg. difficulty" value={String(avgKd)} hint={`${clusters.length} topical clusters`} icon={<Gauge className="h-3.5 w-3.5" />} tone={avgKd > 55 ? "amber" : "brand"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
        <Badge tone="brand">{metrics.top3} top 3</Badge>
        <Badge tone="sky">{metrics.top10 - metrics.top3} positions 4–10</Badge>
        <Badge tone="iris">{metrics.top20 - metrics.top10} positions 11–20</Badge>
        <Badge tone="amber">{metrics.top100 - metrics.top20} positions 21–100</Badge>
        <Badge tone="outline">{metrics.notRanking} not ranking</Badge>
        <span className="ml-auto flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5" /> {fmtCompact(metrics.traffic)} estimated monthly clicks</span>
      </div>

      <KeywordsExplorer
        projectId={project.id}
        keywords={keywords}
        clusters={clusters}
        suggestions={suggestions}
        initialQuery={q ?? ""}
        canEdit={canEdit}
      />
    </div>
  );
}
