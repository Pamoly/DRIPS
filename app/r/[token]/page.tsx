import { notFound } from "next/navigation";
import { getDb } from "@/lib/store";
import { buildReportData } from "@/lib/derive";
import { fmtCompact, fmtDate, fmtNumber, fmtPct, scoreTone } from "@/lib/format";
import { AreaChart, Donut, HorizontalBars, Sparkline } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui";
import { ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, Globe2, Link2, MousePointerClick, ScanSearch, Target, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const report = db.reports.find((r) => r.publicToken === token);
  if (!report) notFound();
  const project = db.projects.find((p) => p.id === report.projectId);
  if (!project) notFound();
  const data = buildReportData(db, project, report.period);
  const accent = report.accent;
  const auditTone = data.audit ? scoreTone(data.audit.score) : null;
  const has = (s: string) => report.sections.includes(s);
  const visibilityDelta = Math.round((data.visibility.current - data.visibility.previous) * 10) / 10;

  return (
    <div data-theme="light" className="min-h-screen bg-[#F4F7FA] text-[#0F172A]">
      <header className="no-print border-b border-[#DEE6EE] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: accent }}>
              {report.logoText.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[13.5px] font-semibold">{report.logoText}</span>
            <span className="text-[#94A3B8]">/</span>
            <span className="text-[12.5px] text-[#64748B]">{report.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-[#94A3B8] sm:inline">Public link · read only</span>
            <PrintButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 print-full">
        {/* Cover */}
        <section className="rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#94A3B8]">
                <CalendarDays className="h-3 w-3" /> {report.period} · generated {fmtDate(data.generatedAt)}
              </div>
              <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.03em]">{report.name}</h1>
              <p className="mt-1.5 text-[13px] text-[#64748B]">
                Prepared for <span className="font-medium text-[#0F172A]">{report.clientName}</span> · {project.domain}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]">Organic visibility</p>
              <p className="mt-1 text-[34px] font-semibold leading-none tabular-nums" style={{ color: accent }}>{data.visibility.current}%</p>
              <p className={`mt-1 flex items-center justify-end gap-1 text-[12px] ${visibilityDelta >= 0 ? "text-[#16A34A]" : "text-[#E11D48]"}`}>
                {visibilityDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {Math.abs(visibilityDelta)} pp vs prior period
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 border-t border-[#EEF2F7] pt-4 sm:grid-cols-4">
            {[
              { k: "Keywords in top 10", v: fmtNumber(data.rankings.top10), d: `${data.rankings.top3} in top 3` },
              { k: "GSC clicks", v: fmtCompact(data.gsc.now.clicks), d: `${data.gsc.delta.clicks > 0 ? "+" : ""}${data.gsc.delta.clicks}%` },
              { k: "Site health", v: data.audit ? `${data.audit.score}/100` : "—", d: data.audit ? `${data.audit.issues.length} issues` : "no crawl" },
              { k: "Referring domains", v: fmtCompact(data.backlinks.referringDomains), d: `${data.backlinks.live} live links` },
            ].map((s) => (
              <div key={s.k}>
                <p className="text-[10px] uppercase tracking-[0.1em] text-[#94A3B8]">{s.k}</p>
                <p className="mt-1 text-[18px] font-semibold tabular-nums">{s.v}</p>
                <p className="text-[11px] text-[#94A3B8]">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {has("visibility") && (
          <section className="mt-4 rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-[14px] font-semibold">Search visibility trend</h2>
                <p className="mt-0.5 text-[12px] text-[#64748B]">Volume-weighted ranking performance over the reporting period.</p>
              </div>
              <span className="rounded-md border border-[#DEE6EE] px-2 py-0.5 text-[10.5px] text-[#64748B]">Google · {project.countryCode}</span>
            </div>
            <div className="mt-4">
              <AreaChart
                series={[{ name: "Visibility", color: accent, values: data.visibility.series.map((s) => s.value) }]}
                labels={data.visibility.series.map((s) => s.date)}
                height={210}
                format="percent1"
                showLegend={false}
              />
            </div>
          </section>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {has("rankings") && (
            <section className="rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
              <h2 className="text-[14px] font-semibold">Ranking performance</h2>
              <p className="mt-0.5 text-[12px] text-[#64748B]">{data.rankings.total} tracked keywords</p>
              <div className="mt-4 space-y-2.5">
                {[
                  { label: "Top 3", value: data.rankings.top3, color: "#16A34A" },
                  { label: "Positions 4–10", value: Math.max(0, data.rankings.top10 - data.rankings.top3), color: "#0284C7" },
                  { label: "Positions 11–100", value: Math.max(0, data.rankings.top100 - data.rankings.top10), color: "#6366F1" },
                  { label: "Not ranking", value: Math.max(0, data.rankings.total - data.rankings.top100), color: "#CBD5E1" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-[#64748B]">{s.label}</span><span className="tabular-nums">{s.value}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                      <div className="h-full rounded-full" style={{ width: `${(s.value / (data.rankings.total || 1)) * 100}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-[#EEF2F7] pt-3 text-[11.5px]">
                <span className="flex items-center gap-1 text-[#16A34A]"><ArrowUpRight className="h-3.5 w-3.5" /> {data.rankings.improved} improved</span>
                <span className="flex items-center gap-1 text-[#E11D48]"><ArrowDownRight className="h-3.5 w-3.5" /> {data.rankings.declined} declined</span>
              </div>
            </section>
          )}

          {has("gsc") && (
            <section className="rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
              <h2 className="text-[14px] font-semibold">Search Console</h2>
              <p className="mt-0.5 text-[12px] text-[#64748B]">Clicks and impressions from Google</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { k: "Clicks", v: fmtCompact(data.gsc.now.clicks) },
                  { k: "Impr.", v: fmtCompact(data.gsc.now.impressions) },
                  { k: "CTR", v: fmtPct(data.gsc.now.ctr) },
                ].map((s) => (
                  <div key={s.k} className="rounded-lg bg-[#F8FAFC] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">{s.k}</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{s.v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <AreaChart
                  series={[{ name: "Clicks", color: "#0284C7", values: data.gsc.points.map((p) => p.clicks) }]}
                  labels={data.gsc.points.map((p) => p.date)}
                  height={130}
                  showLegend={false}
                  area
                />
              </div>
            </section>
          )}
        </div>

        {has("keywords") && (
          <section className="mt-4 rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
            <h2 className="text-[14px] font-semibold">Top keyword positions</h2>
            <p className="mt-0.5 text-[12px] text-[#64748B]">Highest-ranking queries for this period</p>
            <table className="mt-3 w-full">
              <thead>
                <tr className="border-b border-[#EEF2F7] text-left text-[10px] uppercase tracking-[0.08em] text-[#94A3B8]">
                  <th className="py-2 font-semibold">Keyword</th>
                  <th className="py-2 text-right font-semibold">Position</th>
                  <th className="py-2 text-right font-semibold">Change</th>
                  <th className="py-2 text-right font-semibold">Volume</th>
                  <th className="py-2 font-semibold">Landing page</th>
                </tr>
              </thead>
              <tbody>
                {data.keywords.map((k) => (
                  <tr key={k.phrase} className="border-b border-[#F1F5F9] text-[12px] last:border-0">
                    <td className="py-2.5 font-medium">{k.phrase}</td>
                    <td className="py-2.5 text-right tabular-nums">{k.position ? `#${k.position}` : "—"}</td>
                    <td className={`py-2.5 text-right tabular-nums ${k.delta > 0 ? "text-[#16A34A]" : k.delta < 0 ? "text-[#E11D48]" : "text-[#94A3B8]"}`}>
                      {k.delta > 0 ? `+${k.delta}` : k.delta}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-[#64748B]">{fmtCompact(k.volume)}</td>
                    <td className="max-w-[220px] truncate py-2.5 text-[11px] text-[#64748B]">{k.url ? k.url.replace(/^https?:\/\/[^/]+/, "") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {has("audits") && data.audit && (
            <section className="rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
              <h2 className="text-[14px] font-semibold">Site health</h2>
              <p className="mt-0.5 text-[12px] text-[#64748B]">{data.audit.pagesCrawled} pages crawled</p>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${auditTone?.hex} ${data.audit.score * 3.6}deg, #EEF2F7 0)` }}>
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-white">
                    <span className="text-[19px] font-semibold tabular-nums">{data.audit.score}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between"><span className="text-[#64748B]">Critical issues</span><span className="font-medium text-[#E11D48]">{data.audit.issues.filter((i) => i.severity === "critical").length}</span></div>
                  <div className="flex justify-between"><span className="text-[#64748B]">Warnings</span><span className="font-medium text-[#D97706]">{data.audit.issues.filter((i) => i.severity === "warning").length}</span></div>
                  <div className="flex justify-between"><span className="text-[#64748B]">LCP / CLS / INP</span><span className="font-medium tabular-nums">{data.audit.vitals.lcp}s / {data.audit.vitals.cls} / {data.audit.vitals.inp}ms</span></div>
                </div>
              </div>
            </section>
          )}

          {has("backlinks") && (
            <section className="rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
              <h2 className="text-[14px] font-semibold">Backlink profile</h2>
              <p className="mt-0.5 text-[12px] text-[#64748B]">Authority and link acquisition</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { k: "Referring domains", v: fmtNumber(data.backlinks.referringDomains) },
                  { k: "Live links", v: fmtNumber(data.backlinks.live) },
                  { k: "New links", v: `+${data.backlinks.new}` },
                  { k: "Avg. authority", v: String(data.backlinks.authority) },
                ].map((s) => (
                  <div key={s.k} className="rounded-lg bg-[#F8FAFC] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">{s.k}</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{s.v}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {has("competitors") && data.competitors.length > 0 && (
          <section className="mt-4 rounded-2xl border border-[#DEE6EE] bg-white p-6 shadow-sm">
            <h2 className="text-[14px] font-semibold">Competitor benchmark</h2>
            <p className="mt-0.5 text-[12px] text-[#64748B]">Estimated organic visibility vs tracked competitors</p>
            <div className="mt-4">
              <HorizontalBars
                data={[{ label: project.name, value: data.visibility.current, color: accent }, ...data.competitors.map((c) => ({ label: c.name, value: c.visibility, color: "#94A3B8" }))]}
                format="percent1"
                max={100}
              />
            </div>
          </section>
        )}

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#DEE6EE] pt-4 text-[11px] text-[#94A3B8]">
          <span>{report.footerNote}</span>
          <span className="flex items-center gap-1"><Globe2 className="h-3 w-3" /> Generated by {report.logoText} · {fmtDate(data.generatedAt)}</span>
        </footer>
      </main>
    </div>
  );
}
