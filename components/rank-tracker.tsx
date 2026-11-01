"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Grid3x3, Loader2, MapPin, Plus, Search, Table2 } from "lucide-react";
import type { Engine, Keyword } from "@/lib/types";
import { ENGINES, positionForEngine, rankDelta, rankHistory, visibilityFromKeywords } from "@/lib/rank";
import { estimatedClicks } from "@/lib/rank";
import { fmtCompact, fmtNumber, positionTone } from "@/lib/format";
import { Badge, Card, Delta, SectionHeader } from "./ui";
import { AreaChart, Heatmap, Sparkline, StackedBar } from "./charts";
import { TrackToggle } from "./actions";

export function RankTracker({
  projectId,
  keywords,
  trends,
  canEdit,
}: {
  projectId: string;
  keywords: Keyword[];
  trends: Record<Engine, { date: string; position: number }[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [engine, setEngine] = useState<Engine>("google");
  const [tab, setTab] = useState<"table" | "grid">("table");
  const [band, setBand] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"position" | "delta" | "volume" | "phrase">("position");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [newKeyword, setNewKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const pageSize = 25;

  const enriched = useMemo(
    () =>
      keywords.map((k) => {
        const position = positionForEngine(k, engine);
        return {
          kw: k,
          position,
          delta: rankDelta(k, engine, 7),
          local: positionForEngine(k, "local"),
          history: rankHistory(k, engine, 30).map((p) => p.position ?? 100),
        };
      }),
    [keywords, engine],
  );

  const metrics = useMemo(() => {
    const ranked = enriched.map((e) => e.position).filter((p): p is number => p !== null);
    return {
      avg: ranked.length ? Math.round((ranked.reduce((s, p) => s + p, 0) / ranked.length) * 10) / 10 : 0,
      top3: ranked.filter((p) => p <= 3).length,
      top10: ranked.filter((p) => p <= 10).length,
      top20: ranked.filter((p) => p <= 20).length,
      notRanking: enriched.length - ranked.length,
      improved: enriched.filter((e) => e.delta > 0).length,
      declined: enriched.filter((e) => e.delta < 0).length,
      visibility: visibilityFromKeywords(keywords.map((k) => ({ ...k, position: positionForEngine(k, engine) }))),
      traffic: enriched.reduce((s, e) => s + estimatedClicks(e.position, e.kw.volume), 0),
      dist: [
        { label: "1–3", value: ranked.filter((p) => p <= 3).length, color: "#4ADE80" },
        { label: "4–10", value: ranked.filter((p) => p > 3 && p <= 10).length, color: "#38BDF8" },
        { label: "11–20", value: ranked.filter((p) => p > 10 && p <= 20).length, color: "#818CF8" },
        { label: "21–50", value: ranked.filter((p) => p > 20 && p <= 50).length, color: "#FBBF24" },
        { label: "51–100", value: ranked.filter((p) => p > 50).length, color: "#FB7185" },
        { label: "Not ranking", value: enriched.length - ranked.length, color: "#3B4756" },
      ],
    };
  }, [enriched, keywords]);

  const rows = useMemo(() => {
    const filtered = enriched.filter((e) => {
      if (query && !e.kw.phrase.toLowerCase().includes(query.toLowerCase())) return false;
      if (band === "top3" && !(e.position !== null && e.position <= 3)) return false;
      if (band === "top10" && !(e.position !== null && e.position <= 10)) return false;
      if (band === "11-20" && !(e.position !== null && e.position > 10 && e.position <= 20)) return false;
      if (band === "21-50" && !(e.position !== null && e.position > 20 && e.position <= 50)) return false;
      if (band === "none" && e.position !== null) return false;
      if (band === "improved" && e.delta <= 0) return false;
      if (band === "declined" && e.delta >= 0) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const m = dir === "asc" ? 1 : -1;
      if (sort === "phrase") return a.kw.phrase.localeCompare(b.kw.phrase) * m;
      if (sort === "volume") return (a.kw.volume - b.kw.volume) * m;
      if (sort === "delta") return (a.delta - b.delta) * m;
      return ((a.position ?? 101) - (b.position ?? 101)) * m;
    });
    return filtered;
  }, [enriched, band, query, sort, dir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = rows.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  const trackNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setBusy(true);
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, phrase: newKeyword, country: undefined }),
    });
    setBusy(false);
    setNewKeyword("");
    router.refresh();
  };

  const localKeywords = enriched.filter((e) => e.local !== null).slice(0, 25);
  const gridCells = [0, 1, 2, 3, 4].map((r) =>
    [0, 1, 2, 3, 4].map((c) => {
      const item = localKeywords[r * 5 + c];
      return item ? item.local : null;
    }),
  );

  const sortIcon = (key: typeof sort) =>
    sort === key ? dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {ENGINES.map((e) => (
            <button
              key={e.key}
              onClick={() => { setEngine(e.key); setPage(1); }}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition",
                engine === e.key ? "border-line bg-raised text-ink shadow-sm" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
              {e.short}
              <span className="hidden text-[10px] text-faint sm:inline">{e.device}</span>
            </button>
          ))}
        </div>
        <div className="seg">
          <button onClick={() => setTab("table")} className={clsx("seg-item flex items-center gap-1.5", tab === "table" && "seg-item-active")}><Table2 className="h-3.5 w-3.5" /> Table</button>
          <button onClick={() => setTab("grid")} className={clsx("seg-item flex items-center gap-1.5", tab === "grid" && "seg-item-active")}><Grid3x3 className="h-3.5 w-3.5" /> Local grid</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <SectionHeader
            title={`Average position · ${ENGINES.find((e) => e.key === engine)?.label}`}
            subtitle={`${metrics.improved} improved · ${metrics.declined} declined over 7 days`}
            action={<Badge tone="outline">{ENGINES.find((e) => e.key === engine)?.device}</Badge>}
          />
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <div>
              <div className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums">#{metrics.avg}</div>
              <div className="mt-1.5 text-[12px] text-muted">avg. of {metrics.top20 + (enriched.length - metrics.top20)} tracked keywords</div>
            </div>
            <div className="flex gap-5 text-[12px]">
              <div><div className="label">Visibility</div><div className="mt-1 text-[15px] font-semibold tabular-nums">{metrics.visibility}%</div></div>
              <div><div className="label">Top 3</div><div className="mt-1 text-[15px] font-semibold tabular-nums text-brand">{metrics.top3}</div></div>
              <div><div className="label">Top 10</div><div className="mt-1 text-[15px] font-semibold tabular-nums">{metrics.top10}</div></div>
              <div><div className="label">Not ranking</div><div className="mt-1 text-[15px] font-semibold tabular-nums text-muted">{metrics.notRanking}</div></div>
            </div>
          </div>
          <div className="mt-3">
            <AreaChart
              series={[{ name: "Average position", color: ENGINES.find((e) => e.key === engine)?.color ?? "#4ADE80", values: trends[engine].map((t) => t.position) }]}
              labels={trends[engine].map((t) => t.date)}
              height={210}
              invertY
              format="rank"
            />
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <SectionHeader title="Position distribution" subtitle="Where your keywords sit today" />
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full">
            {metrics.dist.map((d) => (
              <div key={d.label} style={{ width: `${(d.value / (enriched.length || 1)) * 100}%`, background: d.color }} title={`${d.label}: ${d.value}`} />
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {metrics.dist.map((d) => (
              <li key={d.label} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />{d.label}</span>
                <span className="tabular-nums">{d.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-line pt-3 text-[12px]">
            <div className="flex justify-between"><span className="text-muted">Est. monthly clicks</span><span className="font-medium tabular-nums">{fmtCompact(metrics.traffic)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Keywords tracked</span><span className="font-medium tabular-nums">{keywords.filter((k) => k.tracked).length}</span></div>
            <div className="flex justify-between"><span className="text-muted">Last pull</span><span className="font-medium tabular-nums">Today, 06:00 {engine === "bing" ? "UTC" : "local"}</span></div>
          </div>
        </Card>
      </div>

      {tab === "table" ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter keywords…" className="input !py-1.5 pl-8 text-[12.5px]" />
            </div>
            <select className="select !w-auto !py-1.5 text-[12px]" value={band} onChange={(e) => { setBand(e.target.value); setPage(1); }}>
              <option value="all">Any position</option>
              <option value="top3">Top 3</option>
              <option value="top10">Top 10</option>
              <option value="11-20">11–20</option>
              <option value="21-50">21–50</option>
              <option value="none">Not ranking</option>
              <option value="improved">Improved</option>
              <option value="declined">Declined</option>
            </select>
            <form onSubmit={trackNew} className="flex items-center gap-1.5">
              <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Track a new keyword…" className="input !w-[190px] !py-1.5 text-[12px]" />
              <button type="submit" disabled={busy || !newKeyword.trim()} className="btn-primary btn-sm !px-2">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="bg-raised/30">
                  <th className="th cursor-pointer" onClick={() => { setSort("phrase"); setDir(sort === "phrase" && dir === "asc" ? "desc" : "asc"); }}><span className="inline-flex items-center gap-1">Keyword {sortIcon("phrase")}</span></th>
                  <th className="th cursor-pointer" onClick={() => { setSort("position"); setDir(sort === "position" && dir === "asc" ? "desc" : "asc"); }}><span className="inline-flex items-center gap-1">Position {sortIcon("position")}</span></th>
                  <th className="th">7d change</th>
                  <th className="th">Best</th>
                  <th className="th cursor-pointer text-right" onClick={() => { setSort("volume"); setDir(sort === "volume" && dir === "desc" ? "asc" : "desc"); }}><span className="inline-flex items-center gap-1">Volume {sortIcon("volume")}</span></th>
                  <th className="th">30d trend</th>
                  <th className="th">Local pack</th>
                  <th className="th">URL</th>
                  <th className="th">Track</th>
                </tr>
              </thead>
              <tbody>
                {current.map((r) => (
                  <tr key={r.kw.id} className="table-row">
                    <td className="td">
                      <div className="max-w-[280px] truncate font-medium">{r.kw.phrase}</div>
                      <div className="mt-0.5 text-[11px] text-faint">{r.kw.cluster}</div>
                    </td>
                    <td className="td"><span className={clsx("inline-flex h-6 min-w-[38px] items-center justify-center rounded-md border px-1.5 text-[11.5px] font-semibold tabular-nums", positionTone(r.position))}>{r.position ?? "—"}</span></td>
                    <td className="td"><Delta value={r.delta} /></td>
                    <td className="td tabular-nums text-muted">{r.kw.bestPosition}</td>
                    <td className="td text-right tabular-nums">{fmtCompact(r.kw.volume)}</td>
                    <td className="td"><Sparkline data={r.history} color={r.position !== null && r.position <= 10 ? "#4ADE80" : "#38BDF8"} invert width={78} height={22} fill={false} /></td>
                    <td className="td">
                      {r.local !== null ? (
                        <span className={clsx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums", positionTone(r.local))}><MapPin className="h-2.5 w-2.5" />#{r.local}</span>
                      ) : (
                        <span className="text-[11px] text-faint">—</span>
                      )}
                    </td>
                    <td className="td max-w-[180px]"><span className="block truncate text-[11.5px] text-muted">{r.kw.url ? r.kw.url.replace(/^https?:\/\/[^/]+/, "") : "—"}</span></td>
                    <td className="td">{canEdit && <TrackToggle keywordId={r.kw.id} tracked={r.kw.tracked} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-3 py-2.5 text-[12px] text-muted">
            <span>{fmtNumber(rows.length)} keywords</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost btn-xs !px-1.5"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <span className="px-2 tabular-nums">{Math.min(page, pageCount)} / {pageCount}</span>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="btn-ghost btn-xs !px-1.5"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-5">
            <SectionHeader title="Local pack grid" subtitle="5×5 geo-grid around your primary location" action={<Badge tone="amber">Local</Badge>} />
            <div className="mt-5">
              <Heatmap cells={gridCells} size={44} />
            </div>
            <div className="mt-4 flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#16A34A]" /> 1–3</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#A3E635]" /> 4–10</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#FBBF24]" /> 11–15</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#FB7185]" /> 16+</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-line" /> Not found</span>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">
              Grid measured from your verified business location. Cells show the local pack position for your strongest local keyword in each geo point.
            </p>
          </Card>
          <Card className="xl:col-span-7" padded={false}>
            <div className="p-5 pb-2"><SectionHeader title="Local pack rankings" subtitle="Keywords triggering a local pack result" /></div>
            <table className="w-full">
              <thead>
                <tr className="border-y border-line bg-raised/30">
                  <th className="th">Keyword</th>
                  <th className="th">Desktop</th>
                  <th className="th">Mobile</th>
                  <th className="th">Local pack</th>
                  <th className="th text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {enriched.filter((e) => e.kw.serpFeatures.includes("Local pack")).slice(0, 10).map((e) => (
                  <tr key={e.kw.id} className="table-row">
                    <td className="td font-medium">{e.kw.phrase}</td>
                    <td className="td tabular-nums text-muted">{positionForEngine(e.kw, "google") ?? "—"}</td>
                    <td className="td tabular-nums text-muted">{positionForEngine(e.kw, "google_mobile") ?? "—"}</td>
                    <td className="td"><span className={clsx("inline-flex rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums", positionTone(e.local))}>{e.local ?? "—"}</span></td>
                    <td className="td text-right tabular-nums">{fmtCompact(e.kw.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-line p-3 text-[11.5px] text-muted">
              Local tracking uses a mobile viewport centred on your verified business address.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
