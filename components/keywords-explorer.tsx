"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Filter, Loader2, Plus, Search, Sparkles,
  TrendingUp, X, Check, Lightbulb, Layers, Table2,
} from "lucide-react";
import type { Engine, Intent, Keyword } from "@/lib/types";
import { ENGINES, positionForEngine, rankDelta, rankHistory } from "@/lib/rank";
import { fmtCompact, fmtCurrency, fmtNumber, intentLabel, positionTone } from "@/lib/format";
import { Badge, Card, Segmented, SectionHeader } from "./ui";
import { BubbleChart, HorizontalBars, Sparkline } from "./charts";
import { TrackToggle } from "./actions";

type SortKey = "phrase" | "volume" | "difficulty" | "cpc" | "position" | "delta";
type Suggestion = { phrase: string; volume: number; difficulty: number; cluster: string; intent: Intent };

export function KeywordsExplorer({
  projectId,
  keywords,
  clusters,
  suggestions,
  initialQuery = "",
  canEdit,
}: {
  projectId: string;
  keywords: Keyword[];
  clusters: { name: string; count: number }[];
  suggestions: Suggestion[];
  initialQuery?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [engine, setEngine] = useState<Engine>("google");
  const [query, setQuery] = useState(initialQuery);
  const [intent, setIntent] = useState("all");
  const [cluster, setCluster] = useState("all");
  const [band, setBand] = useState("all");
  const [sort, setSort] = useState<SortKey>("volume");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"table" | "clusters" | "suggestions">("table");
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const enriched = keywords.map((k) => ({
      kw: k,
      position: positionForEngine(k, engine),
      delta: rankDelta(k, engine, 7),
      history: rankHistory(k, engine, 30).map((p) => p.position ?? 100),
    }));
    const filtered = enriched.filter((r) => {
      if (trackedOnly && !r.kw.tracked) return false;
      if (query && !`${r.kw.phrase} ${r.kw.cluster} ${r.kw.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (intent !== "all" && r.kw.intent !== intent) return false;
      if (cluster !== "all" && r.kw.cluster !== cluster) return false;
      if (band !== "all") {
        const p = r.position;
        if (band === "top3" && !(p !== null && p <= 3)) return false;
        if (band === "top10" && !(p !== null && p <= 10)) return false;
        if (band === "11-20" && !(p !== null && p > 10 && p <= 20)) return false;
        if (band === "21-50" && !(p !== null && p > 20 && p <= 50)) return false;
        if (band === "none" && p !== null) return false;
      }
      return true;
    });
    filtered.sort((a, b) => {
      const mult = dir === "asc" ? 1 : -1;
      switch (sort) {
        case "phrase":
          return a.kw.phrase.localeCompare(b.kw.phrase) * mult;
        case "difficulty":
          return (a.kw.difficulty - b.kw.difficulty) * mult;
        case "cpc":
          return (a.kw.cpc - b.kw.cpc) * mult;
        case "position":
          return ((a.position ?? 101) - (b.position ?? 101)) * mult;
        case "delta":
          return (a.delta - b.delta) * mult;
        default:
          return (a.kw.volume - b.kw.volume) * mult;
      }
    });
    return filtered;
  }, [keywords, engine, query, intent, cluster, band, sort, dir, trackedOnly]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = rows.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir(dir === "desc" ? "asc" : "desc");
    else {
      setSort(key);
      setDir(key === "phrase" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    const source = selected.size ? rows.filter((r) => selected.has(r.kw.id)) : rows;
    const header = ["keyword", "cluster", "intent", "volume", "difficulty", "cpc", "position", "delta_7d", "url"];
    const lines = source.map((r) =>
      [r.kw.phrase, r.kw.cluster, r.kw.intent, r.kw.volume, r.kw.difficulty, r.kw.cpc, r.position ?? "", r.delta, r.kw.url ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drips-keywords.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkTrack = async (tracked: boolean) => {
    setBusy(true);
    await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/keywords/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tracked }),
        }),
      ),
    );
    setBusy(false);
    setSelected(new Set());
    router.refresh();
  };

  const addKeywords = async (phrases: string[], extra?: Partial<Suggestion>) => {
    setBusy(true);
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, bulk: phrases.join("\n"), ...extra }),
    });
    setBusy(false);
    if (res.ok) {
      setAddOpen(false);
      setTab("table");
      router.refresh();
    }
  };

  const sortIcon = (key: SortKey) =>
    sort === key ? dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg">
          {[
            { key: "table" as const, label: "Keyword table", icon: Table2 },
            { key: "clusters" as const, label: "Clusters", icon: Layers },
            { key: "suggestions" as const, label: "Suggestions", icon: Lightbulb },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={clsx("seg-item flex items-center gap-1.5", tab === t.key && "seg-item-active")}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
                {t.key === "suggestions" && <span className="rounded bg-brand/15 px-1 text-[10px] font-semibold text-brand">{suggestions.length}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="select !w-auto !py-1.5 text-[12px]" value={engine} onChange={(e) => setEngine(e.target.value as Engine)}>
            {ENGINES.map((e) => (
              <option key={e.key} value={e.key}>{e.label}</option>
            ))}
          </select>
          <button onClick={exportCsv} className="btn-ghost btn-sm"><Download className="h-3.5 w-3.5" /> Export CSV</button>
          {canEdit && (
            <button onClick={() => setAddOpen(true)} className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> Add keywords</button>
          )}
        </div>
      </div>

      {tab === "table" && (
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search keywords, clusters or tags…"
                className="input !py-1.5 pl-8 text-[12.5px]"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink"><X className="h-3.5 w-3.5" /></button>
              )}
            </div>
            <select className="select !w-auto !py-1.5 text-[12px]" value={intent} onChange={(e) => { setIntent(e.target.value); setPage(1); }}>
              <option value="all">All intents</option>
              {["informational", "commercial", "transactional", "navigational"].map((i) => <option key={i} value={i}>{intentLabel(i)}</option>)}
            </select>
            <select className="select !w-auto !py-1.5 text-[12px]" value={cluster} onChange={(e) => { setCluster(e.target.value); setPage(1); }}>
              <option value="all">All clusters</option>
              {clusters.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
            <select className="select !w-auto !py-1.5 text-[12px]" value={band} onChange={(e) => { setBand(e.target.value); setPage(1); }}>
              <option value="all">Any rank</option>
              <option value="top3">Top 3</option>
              <option value="top10">Top 10</option>
              <option value="11-20">11–20</option>
              <option value="21-50">21–50</option>
              <option value="none">Not ranking</option>
            </select>
            <button
              onClick={() => setTrackedOnly((v) => !v)}
              className={clsx("btn-xs inline-flex items-center gap-1 rounded-md border px-2", trackedOnly ? "border-brand/30 bg-brand/10 text-brand" : "border-line text-muted")}
            >
              <Filter className="h-3 w-3" /> Tracked only
            </button>
            <select className="select !w-auto !py-1.5 text-[12px]" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand/[0.04] px-3 py-2 text-[12px]">
              <span className="font-medium text-brand">{selected.size} selected</span>
              <button onClick={() => bulkTrack(true)} disabled={busy} className="btn-soft btn-xs">Track</button>
              <button onClick={() => bulkTrack(false)} disabled={busy} className="btn-soft btn-xs">Untrack</button>
              <button onClick={exportCsv} className="btn-soft btn-xs">Export selection</button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-faint hover:text-ink">Clear</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-raised/30">
                  <th className="th w-8">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[#4ADE80]"
                      checked={current.length > 0 && current.every((r) => selected.has(r.kw.id))}
                      onChange={(e) => {
                        const next = new Set(selected);
                        current.forEach((r) => (e.target.checked ? next.add(r.kw.id) : next.delete(r.kw.id)));
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th className="th cursor-pointer select-none" onClick={() => toggleSort("phrase")}><span className="inline-flex items-center gap-1">Keyword {sortIcon("phrase")}</span></th>
                  <th className="th">Cluster</th>
                  <th className="th cursor-pointer select-none text-right" onClick={() => toggleSort("volume")}><span className="inline-flex items-center gap-1">Volume {sortIcon("volume")}</span></th>
                  <th className="th cursor-pointer select-none" onClick={() => toggleSort("difficulty")}><span className="inline-flex items-center gap-1">KD {sortIcon("difficulty")}</span></th>
                  <th className="th cursor-pointer select-none text-right" onClick={() => toggleSort("cpc")}><span className="inline-flex items-center gap-1">CPC {sortIcon("cpc")}</span></th>
                  <th className="th cursor-pointer select-none" onClick={() => toggleSort("position")}><span className="inline-flex items-center gap-1">Position {sortIcon("position")}</span></th>
                  <th className="th cursor-pointer select-none" onClick={() => toggleSort("delta")}><span className="inline-flex items-center gap-1">7d {sortIcon("delta")}</span></th>
                  <th className="th">30d trend</th>
                  <th className="th">Landing page</th>
                  <th className="th">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {current.map((r) => (
                  <tr key={r.kw.id} className="table-row">
                    <td className="td">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[#4ADE80]"
                        checked={selected.has(r.kw.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          e.target.checked ? next.add(r.kw.id) : next.delete(r.kw.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="td">
                      <div className="max-w-[280px] truncate font-medium">{r.kw.phrase}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={clsx("chip border-none bg-transparent px-0", "text-[10.5px] text-faint")}>{intentLabel(r.kw.intent)}</span>
                        {r.kw.serpFeatures.slice(0, 2).map((f) => (
                          <span key={f} className="chip border-line bg-raised/60 px-1 py-0 text-[9.5px] text-muted">{f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="td"><span className="text-[12px] text-muted">{r.kw.cluster}</span></td>
                    <td className="td text-right tabular-nums">{fmtCompact(r.kw.volume)}</td>
                    <td className="td">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx("h-1.5 w-1.5 rounded-full", r.kw.difficulty >= 70 ? "bg-rose" : r.kw.difficulty >= 45 ? "bg-amber" : "bg-brand")} />
                        <span className="tabular-nums text-[12px]">{r.kw.difficulty}</span>
                      </div>
                    </td>
                    <td className="td text-right tabular-nums text-muted">{fmtCurrency(r.kw.cpc)}</td>
                    <td className="td">
                      <span className={clsx("inline-flex h-6 min-w-[38px] items-center justify-center rounded-md border px-1.5 text-[11.5px] font-semibold tabular-nums", positionTone(r.position))}>
                        {r.position ?? "—"}
                      </span>
                    </td>
                    <td className="td">
                      <span className={clsx("text-[11.5px] font-medium tabular-nums", r.delta > 0 ? "text-brand" : r.delta < 0 ? "text-rose" : "text-faint")}>
                        {r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${Math.abs(r.delta)}` : "—"}
                      </span>
                    </td>
                    <td className="td">
                      <Sparkline data={r.history} color={r.position === null ? "#5C6C7C" : r.position <= 10 ? "#4ADE80" : "#38BDF8"} invert width={72} height={22} fill={false} />
                    </td>
                    <td className="td max-w-[200px]">
                      {r.kw.url ? (
                        <span className="block truncate text-[11.5px] text-muted">{r.kw.url.replace(/^https?:\/\/[^/]+/, "")}</span>
                      ) : (
                        <span className="text-[11.5px] text-faint">No landing page</span>
                      )}
                    </td>
                    <td className="td">{canEdit && <TrackToggle keywordId={r.kw.id} tracked={r.kw.tracked} />}</td>
                  </tr>
                ))}
                {current.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-[12.5px] text-muted">No keywords match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-[12px] text-muted">
            <span>{fmtNumber(rows.length)} keywords · showing {(Math.min(page, pageCount) - 1) * pageSize + 1}–{Math.min(Math.min(page, pageCount) * pageSize, rows.length)}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost btn-xs !px-1.5"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <span className="px-2 tabular-nums">Page {Math.min(page, pageCount)} / {pageCount}</span>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="btn-ghost btn-xs !px-1.5"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </Card>
      )}

      {tab === "clusters" && (
        <div className="space-y-4">
        <Card>
          <SectionHeader
            title="Opportunity matrix"
            subtitle="Difficulty vs demand — bubbles sized by estimated click upside"
            action={<Badge tone="iris">Top 40 by volume</Badge>}
          />
          <div className="mt-4">
            <BubbleChart
              data={[...keywords]
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 40)
                .map((k) => ({
                  label: k.phrase,
                  x: k.difficulty,
                  y: k.volume,
                  r: Math.max(1, Math.round((k.volume / 50) * (k.position === null ? 1 : Math.max(0.3, (40 - Math.min(k.position, 40)) / 20)))),
                  color: k.position === null ? "#5C6C7C" : k.position <= 10 ? "#4ADE80" : k.position <= 20 ? "#38BDF8" : "#FBBF24",
                }))}
              height={280}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-faint">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> top 10</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky" /> 11–20</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber" /> 21+</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-faint" /> not ranking</span>
          </div>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <SectionHeader title="Cluster volume" subtitle="Total monthly searches by topical cluster" />
            <div className="mt-4">
              <HorizontalBars
                data={clusters.slice(0, 12).map((c) => ({ label: c.name, value: c.count, sublabel: `${c.count} keywords` }))}
                format="number"
                color="#818CF8"
              />
            </div>
          </Card>
          <Card padded={false}>
            <div className="p-5 pb-2"><SectionHeader title="Cluster detail" subtitle="Prioritise clusters with high volume and low difficulty" /></div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-raised/30">
                  <th className="th">Cluster</th>
                  <th className="th text-right">Keywords</th>
                  <th className="th text-right">Volume</th>
                  <th className="th text-right">Avg KD</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((c) => {
                  const list = keywords.filter((k) => k.cluster === c.name);
                  const avgKd = Math.round(list.reduce((s, k) => s + k.difficulty, 0) / (list.length || 1));
                  const vol = list.reduce((s, k) => s + k.volume, 0);
                  return (
                    <tr key={c.name} className="table-row cursor-pointer" onClick={() => { setCluster(c.name); setTab("table"); }}>
                      <td className="td font-medium">{c.name}</td>
                      <td className="td text-right tabular-nums">{c.count}</td>
                      <td className="td text-right tabular-nums">{fmtCompact(vol)}</td>
                      <td className="td text-right tabular-nums">{avgKd}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
        </div>
      )}

      {tab === "suggestions" && (
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader
              title="Keyword suggestions"
              subtitle="Long-tail variants your competitors rank for that you are not tracking yet"
              action={<Badge tone="iris"><Sparkles className="h-3 w-3" /> AI-assisted</Badge>}
            />
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-y border-line bg-raised/30">
                <th className="th">Suggested keyword</th>
                <th className="th">Cluster</th>
                <th className="th text-right">Volume</th>
                <th className="th">Difficulty</th>
                <th className="th">Intent</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.phrase} className="table-row">
                  <td className="td font-medium">{s.phrase}</td>
                  <td className="td text-[12px] text-muted">{s.cluster}</td>
                  <td className="td text-right tabular-nums">{fmtCompact(s.volume)}</td>
                  <td className="td"><span className={clsx("text-[12px] tabular-nums", s.difficulty >= 60 ? "text-amber" : "text-brand")}>{s.difficulty}</span></td>
                  <td className="td"><span className="text-[12px] text-muted">{intentLabel(s.intent)}</span></td>
                  <td className="td text-right">
                    <button disabled={busy} onClick={() => addKeywords([s.phrase], { volume: s.volume, difficulty: s.difficulty, intent: s.intent, cluster: s.cluster })} className="btn-soft btn-xs">
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line p-3">
            <button disabled={busy || suggestions.length === 0} onClick={() => addKeywords(suggestions.slice(0, 12).map((s) => s.phrase))} className="btn-primary btn-sm">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Add all shown
            </button>
          </div>
        </Card>
      )}

      {addOpen && <AddKeywordsModal onClose={() => setAddOpen(false)} busy={busy} onSubmit={addKeywords} />}
    </div>
  );
}

function AddKeywordsModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (phrases: string[]) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const phrases = text.split("\n").map((p) => p.trim()).filter(Boolean);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5 shadow-pop animate-fade-up">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold">Add keywords</h3>
            <p className="mt-1 text-[12px] text-muted">Paste up to 200 keywords, one per line. Duplicates are skipped automatically.</p>
          </div>
          <button onClick={onClose} className="text-faint hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"best trail running shoes\nwaterproof hiking jacket\ncamping tent for 2 people"}
          className="input mt-4 resize-y font-mono text-[12px] leading-relaxed"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11.5px] text-faint">{phrases.length} keyword{phrases.length === 1 ? "" : "s"} queued</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
            <button disabled={busy || phrases.length === 0} onClick={() => onSubmit(phrases)} className="btn-primary btn-sm">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Add {phrases.length || ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
