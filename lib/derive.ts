import type {
  Audit, Backlink, Competitor, ContentDoc, Database, Engine, GscQuery, Keyword, Project, Report, Task,
} from "./types";
import { estimatedClicks, positionForEngine, rankDelta, rankHistory, visibilityFromKeywords } from "./rank";
import { gscCompare, gscSeries, gscTotals, type GscPoint } from "./gsc";
import { clamp, round } from "./rand";

export const projectKeywords = (db: Database, projectId: string) => db.keywords.filter((k) => k.projectId === projectId);
export const projectAudits = (db: Database, projectId: string) =>
  db.audits.filter((a) => a.projectId === projectId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
export const projectCompetitors = (db: Database, projectId: string) => db.competitors.filter((c) => c.projectId === projectId);
export const projectBacklinks = (db: Database, projectId: string) => db.backlinks.filter((b) => b.projectId === projectId);
export const projectGsc = (db: Database, projectId: string) => db.gscQueries.filter((g) => g.projectId === projectId);
export const projectReports = (db: Database, projectId: string) => db.reports.filter((r) => r.projectId === projectId);
export const projectDocs = (db: Database, projectId: string) => db.contentDocs.filter((d) => d.projectId === projectId);
export const projectTasks = (db: Database, projectId: string) => db.tasks.filter((t) => t.projectId === projectId);
export const projectAi = (db: Database, projectId: string) => db.aiPrompts.filter((a) => a.projectId === projectId);
export const projectActivity = (db: Database, projectId: string) => db.activity.filter((a) => a.projectId === projectId);
export const projectWidgets = (db: Database, projectId: string) => db.widgets.filter((w) => w.projectId === projectId);
export const latestAudit = (db: Database, projectId: string): Audit | undefined => projectAudits(db, projectId)[0];
export const findProject = (db: Database, id: string): Project | undefined => db.projects.find((p) => p.id === id);

export interface KeywordMetrics {
  total: number;
  tracked: number;
  avgPosition: number;
  visibility: number;
  top3: number;
  top10: number;
  top20: number;
  top100: number;
  notRanking: number;
  volume: number;
  traffic: number;
  improved: number;
  declined: number;
  newEntries: number;
  distribution: { label: string; count: number; color: string }[];
}

export function keywordMetrics(keywords: Keyword[], engine: Engine = "google"): KeywordMetrics {
  const positions = keywords.map((k) => positionForEngine(k, engine));
  const ranked = positions.filter((p): p is number => p !== null);
  const volume = keywords.reduce((s, k) => s + k.volume, 0);
  const traffic = keywords.reduce((s, k) => s + estimatedClicks(positionForEngine(k, engine), k.volume), 0);
  const deltas = keywords.map((k) => rankDelta(k, engine, 7));
  const bands = [
    { label: "1–3", test: (p: number) => p <= 3, color: "#4ADE80" },
    { label: "4–10", test: (p: number) => p >= 4 && p <= 10, color: "#38BDF8" },
    { label: "11–20", test: (p: number) => p >= 11 && p <= 20, color: "#818CF8" },
    { label: "21–50", test: (p: number) => p >= 21 && p <= 50, color: "#FBBF24" },
    { label: "51–100", test: (p: number) => p >= 51, color: "#FB7185" },
  ];
  return {
    total: keywords.length,
    tracked: keywords.filter((k) => k.tracked).length,
    avgPosition: ranked.length ? round(ranked.reduce((s, p) => s + p, 0) / ranked.length, 1) : 0,
    visibility: visibilityFromKeywords(keywords),
    top3: ranked.filter((p) => p <= 3).length,
    top10: ranked.filter((p) => p <= 10).length,
    top20: ranked.filter((p) => p <= 20).length,
    top100: ranked.length,
    notRanking: positions.length - ranked.length,
    volume,
    traffic,
    improved: deltas.filter((d) => d > 0).length,
    declined: deltas.filter((d) => d < 0).length,
    newEntries: positions.filter((p, i) => p !== null && keywords[i].prevPosition === null).length,
    distribution: [
      ...bands.map((b) => ({ label: b.label, count: ranked.filter(b.test).length, color: b.color })),
      { label: "Not ranking", count: positions.length - ranked.length, color: "#3B4756" },
    ],
  };
}

export interface Mover {
  keyword: Keyword;
  from: number | null;
  to: number | null;
  delta: number;
  volume: number;
}

export function movers(keywords: Keyword[], engine: Engine, days = 7): { gained: Mover[]; lost: Mover[] } {
  const enriched: Mover[] = keywords.map((k) => {
    const to = positionForEngine(k, engine);
    const delta = rankDelta(k, engine, days);
    const from = to === null ? null : to + delta;
    return { keyword: k, from, to, delta, volume: k.volume };
  });
  const gained = [...enriched].filter((m) => m.delta > 0).sort((a, b) => b.delta * Math.log10(b.volume + 10) - a.delta * Math.log10(a.volume + 10)).slice(0, 8);
  const lost = [...enriched].filter((m) => m.delta < 0).sort((a, b) => a.delta * Math.log10(a.volume + 10) - b.delta * Math.log10(b.volume + 10)).slice(0, 8);
  return { gained, lost };
}

export interface Opportunity {
  keyword: Keyword;
  position: number;
  upside: number;
  score: number;
  action: string;
}

export function opportunities(keywords: Keyword[], engine: Engine = "google", limit = 8): Opportunity[] {
  return keywords
    .map((k) => {
      const position = positionForEngine(k, engine);
      if (position === null || position > 30) return null;
      const targetCtr = position <= 3 ? 0.25 : position <= 10 ? 0.12 : 0.05;
      const currentCtr = estimatedClicks(position, k.volume) / Math.max(k.volume, 1);
      const upside = Math.round((targetCtr - currentCtr) * k.volume);
      const score = Math.round((upside / 100) * (1 - k.difficulty / 140) * 10) / 10;
      const action =
        position <= 3
          ? "Defend: refresh internal links"
          : position <= 10
            ? "Push: add comparison table"
            : position <= 20
              ? "Optimise: strengthen H2 coverage"
              : "Expand: consolidate supporting pages";
      return { keyword: k, position, upside, score, action } as Opportunity;
    })
    .filter((o): o is Opportunity => o !== null && o.upside > 0)
    .sort((a, b) => b.upside - a.upside)
    .slice(0, limit);
}

export function clusterSummary(keywords: Keyword[], engine: Engine = "google") {
  const map = new Map<string, Keyword[]>();
  for (const k of keywords) {
    const list = map.get(k.cluster) ?? [];
    list.push(k);
    map.set(k.cluster, list);
  }
  return [...map.entries()]
    .map(([cluster, list]) => {
      const m = keywordMetrics(list, engine);
      return {
        cluster,
        keywords: list.length,
        volume: m.volume,
        traffic: m.traffic,
        visibility: m.visibility,
        avgPosition: m.avgPosition,
        top10: m.top10,
      };
    })
    .sort((a, b) => b.volume - a.volume);
}

export function auditIssueSummary(audit: Audit) {
  const bySeverity = {
    critical: audit.issues.filter((i) => i.severity === "critical"),
    warning: audit.issues.filter((i) => i.severity === "warning"),
    notice: audit.issues.filter((i) => i.severity === "notice"),
  };
  const categories = ["Technical", "On-page", "Performance", "Content", "Links", "Security"].map((cat) => ({
    category: cat,
    count: audit.issues.filter((i) => i.category === cat).length,
    critical: audit.issues.filter((i) => i.category === cat && i.severity === "critical").length,
  }));
  return { bySeverity, categories };
}

export function backlinkSummary(links: Backlink[]) {
  const live = links.filter((l) => l.status !== "lost");
  const dofollow = live.filter((l) => l.type === "dofollow");
  return {
    total: links.length,
    live: live.length,
    new: links.filter((l) => l.status === "new").length,
    lost: links.filter((l) => l.status === "lost").length,
    dofollow: dofollow.length,
    referringDomains: new Set(live.map((l) => l.sourceDomain)).size,
    authority: live.length ? round(live.reduce((s, l) => s + l.dr, 0) / live.length, 1) : 0,
    traffic: live.reduce((s, l) => s + l.traffic, 0),
  };
}

export function competitorOverview(comp: Competitor[], keywords: Keyword[]) {
  const ownVisibility = visibilityFromKeywords(keywords);
  const own = {
    name: "You",
    domain: "your site",
    visibility: ownVisibility,
    dr: 64,
    keywords: keywords.length,
  };
  const best = [...comp].sort((a, b) => b.visibility - a.visibility)[0];
  return {
    own,
    best,
    gap: best ? round(best.visibility - ownVisibility, 1) : 0,
    shareOfVoice: round(ownVisibility / (ownVisibility + comp.reduce((s, c) => s + c.visibility, 0) || 1) * 100, 1),
  };
}

export interface ReportData {
  project: Project;
  period: string;
  visibility: { current: number; previous: number; series: { date: string; value: number }[] };
  rankings: { top3: number; top10: number; top100: number; improved: number; declined: number; total: number };
  gsc: { points: GscPoint[]; now: ReturnType<typeof gscTotals>; prev: ReturnType<typeof gscCompare>["prev"]; delta: ReturnType<typeof gscCompare>["delta"] };
  keywords: { phrase: string; position: number | null; delta: number; volume: number; url: string | null }[];
  audit: Audit | undefined;
  backlinks: ReturnType<typeof backlinkSummary>;
  competitors: Competitor[];
  clusters: ReturnType<typeof clusterSummary>;
  generatedAt: string;
}

export function buildReportData(db: Database, project: Project, period: Report["period"]): ReportData {
  const keywords = projectKeywords(db, project.id);
  const metrics = keywordMetrics(keywords);
  const rngSeed = project.id.length + period.length;
  const previous = clamp(round(metrics.visibility - 2.4 - (rngSeed % 5) * 0.6, 1), 0, 100);
  const days = period === "Last 7 days" ? 7 : period === "Last 30 days" ? 30 : 90;
  const series = Array.from({ length: period === "Last 90 days" ? 13 : 10 }, (_, i) => {
    const step = (metrics.visibility - previous) / 9;
    return {
      date: `W${i + 1}`,
      value: round(clamp(previous + step * i + Math.sin(i * 1.7 + rngSeed) * 0.9, 0, 100), 1),
    };
  });
  const gscQueries = projectGsc(db, project.id);
  const compare = gscCompare(gscQueries);
  const ranked = keywords
    .filter((k) => k.position !== null)
    .sort((a, b) => (a.position ?? 100) - (b.position ?? 100))
    .slice(0, 8)
    .map((k) => ({ phrase: k.phrase, position: k.position, delta: rankDelta(k, "google", 7), volume: k.volume, url: k.url }));
  return {
    project,
    period,
    visibility: { current: metrics.visibility, previous, series },
    rankings: {
      top3: metrics.top3,
      top10: metrics.top10,
      top100: metrics.top100,
      improved: metrics.improved,
      declined: metrics.declined,
      total: metrics.total,
    },
    gsc: { points: gscSeries(gscQueries, days, project.id + period), ...compare },
    keywords: ranked,
    audit: latestAudit(db, project.id),
    backlinks: backlinkSummary(projectBacklinks(db, project.id)),
    competitors: projectCompetitors(db, project.id),
    clusters: clusterSummary(keywords).slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
}

export function contentPipeline(docs: ContentDoc[]) {
  return {
    draft: docs.filter((d) => d.status === "draft").length,
    optimized: docs.filter((d) => d.status === "optimized").length,
    published: docs.filter((d) => d.status === "published").length,
    avgScore: docs.length ? Math.round(docs.reduce((s, d) => s + d.score, 0) / docs.length) : 0,
    words: docs.reduce((s, d) => s + d.wordCount, 0),
  };
}

export function taskSummary(tasks: Task[]) {
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => t.status !== "done" && new Date(t.due).getTime() < Date.now()).length,
    byStatus: (["todo", "in_progress", "review", "done"] as const).map((status) => ({
      status,
      tasks: tasks.filter((t) => t.status === status),
    })),
  };
}

export function aiVisibility(prompts: ReturnType<typeof projectAi>) {
  const mentioned = prompts.filter((p) => p.mentioned);
  return {
    coverage: prompts.length ? round((mentioned.length / prompts.length) * 100, 1) : 0,
    prompts: prompts.length,
    mentioned: mentioned.length,
    avgPosition: mentioned.length ? round(mentioned.reduce((s, p) => s + (p.position ?? 0), 0) / mentioned.length, 1) : 0,
    citations: mentioned.length,
    shareOfVoice: prompts.length
      ? round((mentioned.length / (mentioned.length + prompts.reduce((s, p) => s + p.competitorsMentioned.length, 0) || 1)) * 100, 1)
      : 0,
    byEngine: ["ChatGPT", "Perplexity", "Gemini", "AI Overviews", "Copilot"].map((engine) => {
      const list = prompts.filter((p) => p.engine === engine);
      return {
        engine,
        prompts: list.length,
        coverage: list.length ? round((list.filter((p) => p.mentioned).length / list.length) * 100, 1) : 0,
      };
    }),
  };
}

export function visibilityTrend(keywords: Keyword[], engine: Engine = "google", days = 90) {
  const tracked = keywords.filter((k) => k.tracked);
  const histories = tracked.map((k) => ({ volume: k.volume, points: rankHistory(k, engine, days) }));
  if (!histories.length) return Array.from({ length: days }, (_, i) => ({ date: "", visibility: 0, top10: 0, top3: 0 }));
  return Array.from({ length: days }, (_, i) => {
    const date = histories[0]?.points[i]?.date ?? "";
    const totalVolume = histories.reduce((s, h) => s + h.volume, 0) || 1;
    const weighted = histories.reduce((s, h) => {
      const pos = h.points[i]?.position;
      return s + (pos === null || pos === undefined ? 0 : Math.max(0, 101 - pos)) * h.volume;
    }, 0);
    const top10 = histories.filter((h) => {
      const pos = h.points[i]?.position;
      return pos !== null && pos !== undefined && pos <= 10;
    }).length;
    return {
      date,
      visibility: Math.round((weighted / (100 * totalVolume)) * 1000) / 10,
      top10,
      top3: histories.filter((h) => {
        const pos = h.points[i]?.position;
        return pos !== null && pos !== undefined && pos <= 3;
      }).length,
    };
  });
}

export function rankTrendByEngine(keywords: Keyword[], engine: Engine, days = 90) {
  const tracked = keywords.filter((k) => k.tracked);
  const histories = tracked.map((k) => rankHistory(k, engine, days));
  return Array.from({ length: days }, (_, i) => {
    const positions = histories.map((h) => h[i]?.position).filter((p): p is number => p !== null && p !== undefined);
    return {
      date: histories[0]?.[i]?.date ?? "",
      position: positions.length ? round(positions.reduce((s, p) => s + p, 0) / positions.length, 1) : 100,
    };
  });
}

export function brandLift(keywords: Keyword[]) {
  const metrics = keywordMetrics(keywords);
  return {
    ...metrics,
    visibilityChange: 0,
  };
}
