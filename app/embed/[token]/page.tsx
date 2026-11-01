import { notFound } from "next/navigation";
import { getDb } from "@/lib/store";
import { backlinkSummary, keywordMetrics, latestAudit, projectBacklinks, projectKeywords, rankTrendByEngine, visibilityTrend } from "@/lib/derive";
import { fmtCompact, fmtNumber, positionTone } from "@/lib/format";
import { AreaChart, Heatmap, Sparkline } from "@/components/charts";
import clsx from "clsx";

export const dynamic = "force-dynamic";

export default async function EmbedWidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const { token } = await params;
  const { theme } = await searchParams;
  const db = getDb();
  const widget = db.widgets.find((w) => w.publicToken === token);
  if (!widget) notFound();
  const project = db.projects.find((p) => p.id === widget.projectId);
  if (!project) notFound();
  const keywords = projectKeywords(db, project.id);
  const metrics = keywordMetrics(keywords);
  const audit = latestAudit(db, project.id);
  const links = backlinkSummary(projectBacklinks(db, project.id));
  const trend = visibilityTrend(keywords, "google", 30);
  const rankTrend = rankTrendByEngine(keywords, "google", 30);
  const resolvedTheme = theme === "light" || theme === "dark" ? theme : widget.theme === "auto" ? "light" : widget.theme;
  const accent = widget.accent;
  const topKeywords = keywords.filter((k) => k.position !== null).sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).slice(0, 5);
  const localKeywords = keywords.filter((k) => k.serpFeatures.includes("Local pack")).slice(0, 25);

  return (
    <div data-theme={resolvedTheme} className="min-h-screen bg-bg p-3">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
            <span className="text-[11.5px] font-medium">{project.name}</span>
          </div>
          <span className="text-[9.5px] uppercase tracking-[0.12em] text-faint">Live SEO data</span>
        </div>

        <div className="p-4">
          {widget.type === "authority" && (
            <div className="flex items-center gap-4">
              <div className="relative grid h-20 w-20 shrink-0 place-items-center">
                <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(var(--raised))" strokeWidth="7" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(64 / 100) * 213.6} 213.6`} />
                </svg>
                <span className="text-[22px] font-semibold tabular-nums">64</span>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-faint">Domain authority</p>
                <p className="mt-1 text-[13px] font-medium">{fmtNumber(links.referringDomains)} referring domains</p>
                <p className="text-[11.5px] text-muted">{fmtCompact(links.live)} live backlinks · avg DR {links.authority}</p>
                <p className="mt-1.5 text-[10.5px] text-faint">Verified by DRIPS · updated daily</p>
              </div>
            </div>
          )}

          {widget.type === "rank_snapshot" && (
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">Average position</p>
                  <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums">#{metrics.avgPosition}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">Top 10 keywords</p>
                  <p className="mt-1 text-[18px] font-semibold tabular-nums">{metrics.top10}</p>
                </div>
              </div>
              <div className="mt-3">
                <AreaChart series={[{ name: "Position", color: accent, values: rankTrend.map((r) => r.position) }]} labels={rankTrend.map((r) => r.date)} height={96} invertY format="rank" showLegend={false} />
              </div>
            </div>
          )}

          {widget.type === "keywords" && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-faint">Top ranking keywords</p>
              <ul className="mt-2 divide-y divide-line/60">
                {topKeywords.map((k) => (
                  <li key={k.id} className="flex items-center gap-2 py-1.5 text-[11.5px]">
                    <span className="min-w-0 flex-1 truncate">{k.phrase}</span>
                    <span className="text-[10px] text-faint">{fmtCompact(k.volume)}</span>
                    <span className={clsx("rounded border px-1 text-[10px] tabular-nums", positionTone(k.position))}>{k.position}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {widget.type === "audit_score" && audit && (
            <div className="flex items-center gap-4">
              <div className="relative grid h-20 w-20 shrink-0 place-items-center">
                <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(var(--raised))" strokeWidth="7" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(audit.score / 100) * 213.6} 213.6`} />
                </svg>
                <span className="text-[22px] font-semibold tabular-nums">{audit.score}</span>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-faint">Site health score</p>
                <p className="mt-1 text-[13px] font-medium">{fmtNumber(audit.pagesCrawled)} pages crawled</p>
                <p className="text-[11.5px] text-muted">{audit.issues.length} issues · LCP {audit.vitals.lcp}s</p>
                <p className="mt-1.5 text-[10.5px] text-faint">Core Web Vitals monitored daily</p>
              </div>
            </div>
          )}

          {widget.type === "local_grid" && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-faint">Local visibility grid</p>
              <div className="mt-2 [&_*]:!text-[9px]">
                <Heatmap
                  cells={[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => localKeywords[r * 5 + c]?.position ?? null))}
                  size={28}
                />
              </div>
              <p className="mt-2 text-[10px] text-faint">Positions across a 5×5 geo-grid · local pack</p>
            </div>
          )}

          {!["authority", "rank_snapshot", "keywords", "audit_score", "local_grid"].includes(widget.type) && (
            <p className="py-6 text-center text-[12px] text-muted">Widget type unavailable.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-3.5 py-1.5">
          <span className="text-[9px] uppercase tracking-[0.14em] text-faint">Powered by DRIPS</span>
          <span className="flex items-center gap-1 text-[9px] text-faint"><span className="h-1 w-1 rounded-full bg-brand" /> live</span>
        </div>
      </div>
    </div>
  );
}
