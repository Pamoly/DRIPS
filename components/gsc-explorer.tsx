"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { GscQuery } from "@/lib/types";
import { fmtCompact, fmtNumber, fmtPct, positionTone } from "@/lib/format";
import { Card, Delta } from "./ui";

type SortKey = "query" | "clicks" | "impressions" | "ctr" | "position" | "change";

export function GscExplorer({ queries, projectId }: { queries: GscQuery[]; projectId: string }) {
  const [query, setQuery] = useState("");
  const [device, setDevice] = useState("all");
  const [sort, setSort] = useState<SortKey>("clicks");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const rows = useMemo(() => {
    const filtered = queries.filter((q) => {
      if (query && !`${q.query} ${q.page} ${q.country}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (device !== "all" && q.device !== device) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const m = dir === "asc" ? 1 : -1;
      if (sort === "query") return a.query.localeCompare(b.query) * m;
      return ((a[sort] as number) - (b[sort] as number)) * m;
    });
    return filtered;
  }, [queries, query, device, sort, dir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = rows.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir(dir === "desc" ? "asc" : "desc");
    else {
      setSort(k);
      setDir(k === "query" ? "asc" : "desc");
    }
  };

  const icon = (k: SortKey) => (sort === k ? dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : null);
  const totalClicks = rows.reduce((s, q) => s + q.clicks, 0);
  const totalImpressions = rows.reduce((s, q) => s + q.impressions, 0);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter queries or pages…" className="input !py-1.5 pl-8 text-[12.5px]" />
        </div>
        <select className="select !w-auto !py-1.5 text-[12px]" value={device} onChange={(e) => { setDevice(e.target.value); setPage(1); }}>
          <option value="all">All devices</option>
          {["Desktop", "Mobile", "Tablet"].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="rounded-md border border-line bg-raised/40 px-2 py-1 text-[11px] text-muted">
          {fmtCompact(totalClicks)} clicks · {fmtCompact(totalImpressions)} impressions
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="bg-raised/30">
              <th className="th cursor-pointer" onClick={() => toggleSort("query")}><span className="inline-flex items-center gap-1">Query {icon("query")}</span></th>
              <th className="th cursor-pointer text-right" onClick={() => toggleSort("clicks")}><span className="inline-flex items-center gap-1">Clicks {icon("clicks")}</span></th>
              <th className="th cursor-pointer text-right" onClick={() => toggleSort("impressions")}><span className="inline-flex items-center gap-1">Impr. {icon("impressions")}</span></th>
              <th className="th cursor-pointer text-right" onClick={() => toggleSort("ctr")}><span className="inline-flex items-center gap-1">CTR {icon("ctr")}</span></th>
              <th className="th cursor-pointer text-right" onClick={() => toggleSort("position")}><span className="inline-flex items-center gap-1">Position {icon("position")}</span></th>
              <th className="th cursor-pointer text-right" onClick={() => toggleSort("change")}><span className="inline-flex items-center gap-1">Change {icon("change")}</span></th>
              <th className="th">Landing page</th>
              <th className="th">Device</th>
            </tr>
          </thead>
          <tbody>
            {current.map((q) => (
              <tr key={q.id} className="table-row">
                <td className="td max-w-[280px]"><span className="block truncate font-medium">{q.query}</span></td>
                <td className="td text-right tabular-nums">{fmtNumber(q.clicks)}</td>
                <td className="td text-right tabular-nums text-muted">{fmtNumber(q.impressions)}</td>
                <td className="td text-right tabular-nums">{fmtPct(q.ctr * 100)}</td>
                <td className="td text-right">
                  <span className={clsx("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums", positionTone(Math.round(q.position)))}>{q.position.toFixed(1)}</span>
                </td>
                <td className="td text-right"><Delta value={q.change} /></td>
                <td className="td max-w-[180px]"><span className="block truncate text-[11.5px] text-muted">{q.page}</span></td>
                <td className="td"><span className="text-[11.5px] text-faint">{q.device} · {q.country}</span></td>
              </tr>
            ))}
            {current.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-[12.5px] text-muted">No queries match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2.5 text-[12px] text-muted">
        <span>{fmtNumber(rows.length)} queries in range</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost btn-xs !px-1.5"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="px-2 tabular-nums">{Math.min(page, pageCount)} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="btn-ghost btn-xs !px-1.5"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </Card>
  );
}
