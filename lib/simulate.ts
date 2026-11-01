import { ISSUE_CATALOG } from "./seed";
import type { Audit, AuditPage, Keyword, Project } from "./types";
import { clamp, isoDaysAgo, pick, randInt, range, round, rngFor, slugify } from "./rand";

const SEVERITY_WEIGHT = { critical: 12, warning: 6, notice: 2 } as const;

/** Simulates an on-demand crawl with a fresh seed, producing a believable new audit. */
export function runAudit(project: Project, keywords: Keyword[], startUrl: string, userId: string, seedKey: string): Audit {
  const rng = rngFor("run-audit", seedKey, project.id);
  const createdAt = new Date().toISOString();
  const count = randInt(rng, 12, 19);
  const sample = [...ISSUE_CATALOG].sort(() => rng() - 0.5).slice(0, count);
  const issues = sample.map((base, i) => ({
    ...base,
    id: `iss_${seedKey}_${i}`,
    affected: base.category === "Technical" ? randInt(rng, 1, 42) : randInt(rng, 1, 26),
    crawled: createdAt,
  }));

  const urlPool = keywords.filter((k) => k.url).map((k) => k.url as string);
  const basePaths = urlPool.length
    ? [...new Set(urlPool.map((u) => u.replace(`https://${project.domain}`, "")))]
    : ["/", "/blog", "/products", "/about", "/contact", "/pricing"];
  const pageCount = randInt(rng, 24, 54);

  const pages: AuditPage[] = range(pageCount).map((i) => {
    const basePath = basePaths[i % basePaths.length];
    const suffix = i > basePaths.length - 1 ? `?page=${Math.floor(i / basePaths.length) + 1}` : "";
    const pageIssues = [...issues].sort(() => rng() - 0.5).slice(0, randInt(rng, 1, 5));
    const penalty = pageIssues.reduce((sum, issue) => sum + SEVERITY_WEIGHT[issue.severity], 0);
    return {
      url: `${startUrl.replace(/\/$/, "")}${basePath}${suffix}`,
      title: `${basePath.replace(/[-/]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Home"} | ${project.name}`,
      score: clamp(100 - penalty - randInt(rng, 0, 7), 34, 99),
      statusCode: rng() > 0.97 ? 404 : 200,
      responseMs: randInt(rng, 80, 980),
      words: randInt(rng, 220, 2400),
      issues: pageIssues.map((p) => p.title),
      lcp: round(1.0 + rng() * 2.9, 2),
      cls: round(rng() * 0.3, 2),
      inp: randInt(rng, 80, 480),
    };
  });

  const avg = Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length);
  return {
    id: `audit_${slugify(seedKey).slice(0, 10)}_${seedKey.slice(-4)}`,
    projectId: project.id,
    name: "On-demand crawl",
    startUrl,
    createdAt,
    completedAt: createdAt,
    status: "completed",
    score: clamp(avg - 2, 30, 98),
    pagesCrawled: pageCount,
    issues,
    pages,
    vitals: {
      lcp: round(1.1 + rng() * 2.2, 2),
      cls: round(rng() * 0.24, 2),
      inp: randInt(rng, 90, 380),
      fcp: round(0.7 + rng() * 1.3, 2),
      ttfb: randInt(rng, 70, 520),
    },
    createdBy: userId,
    schedule: "none",
  };
}

/** Simulates a fresh daily SERP pull: snapshots current ranks and applies a small drift. */
export function refreshRankings(keywords: Keyword[], seedKey: string): number {
  const rng = rngFor("refresh", seedKey);
  let changed = 0;
  for (const kw of keywords) {
    if (!kw.tracked) continue;
    const current = kw.position;
    const driftRoll = rng();
    let drift = 0;
    if (driftRoll > 0.82) drift = randInt(rng, -6, 6);
    else if (driftRoll > 0.55) drift = randInt(rng, -2, 2);
    if (drift === 0 && rng() > 0.6) continue;
    kw.prevPosition = current;
    if (current === null) {
      if (rng() > 0.7) {
        kw.position = randInt(rng, 62, 100);
        changed++;
      }
      continue;
    }
    kw.position = clamp(current + drift, 1, 100);
    if (kw.position < kw.bestPosition) kw.bestPosition = kw.position;
    changed++;
  }
  return changed;
}

export function newActivity(projectId: string, actorId: string, action: string, target: string, kind: "audit" | "ranking" | "content" | "report" | "team" | "integration" | "keyword") {
  return {
    id: `a_${Math.random().toString(36).slice(2, 9)}`,
    projectId,
    actorId,
    action,
    target,
    kind,
    at: new Date().toISOString(),
  };
}

export function defaultKeywordFor(project: Project, phrase: string): Keyword {
  const rng = rngFor("new-kw", project.id, phrase);
  const words = phrase.trim().split(/\s+/).length;
  const volume = randInt(rng, 1, 30) * (words > 3 ? 100 : 1000);
  const difficulty = randInt(rng, 5, 72);
  return {
    id: `kw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    projectId: project.id,
    phrase: phrase.trim(),
    volume,
    cpc: round(0.4 + (difficulty / 100) * 5 + rng() * 2, 2),
    difficulty,
    intent: "informational",
    cluster: "Uncategorised",
    position: null,
    prevPosition: randInt(rng, 70, 100),
    bestPosition: 100,
    url: null,
    country: project.country,
    countryCode: project.countryCode,
    serpFeatures: [],
    tracked: true,
    tags: ["new"],
    createdAt: isoDaysAgo(0),
    gscClicks: 0,
    gscImpressions: 0,
  };
}
