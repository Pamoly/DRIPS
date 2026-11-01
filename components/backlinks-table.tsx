"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import type { Backlink } from "@/lib/types";
import { fmtCompact, fmtDate } from "@/lib/format";
import { Badge, Card } from "./ui";

export function BacklinksTable({ links }: { links: Backlink[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<"dr" | "traffic" | "firstSeen">("dr");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const rows = useMemo(() => {
    const filtered = links.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (type !== "all" && l.type !== type) return false;
      if (query && !`${l.sourceDomain} ${l.anchor} ${l.targetUrl}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const m = dir === "asc" ? 1 : -1;
      if (sort === "firstSeen") return (new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime()) * m;
      return ((a[sort] as number) - (b[sort] as number)) * m;
    });
    return filtered;
  }, [links, query, status, type, sort, dir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = rows.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const icon = (k: typeof sort) => (sort === k ? dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : null);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search domains, anchors or target URLs…" className="input !py-1.5 pl-8 text-[12.5px]" />
        </div>
        <select className="select !w-auto !py-1.5 text-[12px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">All statuses</option>
          {["live", "new", "lost"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select !w-auto !py-1.5 text-[12px]" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="all">All link types</option>
          {["dofollow", "nofollow", "ugc"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-raised/30">
              <th className="th">Source</th>
              <th className="th cursor-pointer text-right" onClick={() => { setSort("dr"); setDir(sort === "dr" && dir === "desc" ? "asc" : "desc"); }}><span className="inline-flex items-center gap-1">DR {icon("dr")}</span></th>
              <th className="th">Anchor text</th>
              <th className="th">Target page</th>
              <th className="th">Type</th>
              <th className="th cursor-pointer text-right" onClick={() => { setSort("traffic"); setDir(sort === "traffic" && dir === "desc" ? "asc" : "desc"); }}><span className="inline-flex items-center gap-1">Traffic {icon("traffic")}</span></th>
              <th className="th">First seen</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {current.map((l) => (
              <tr key={l.id} className="table-row">
                <td className="td">
                  <div className="flex items-center gap-1.5">
                    <span className="max-w-[190px] truncate font-medium">{l.sourceDomain}</span>
                    <a href={l.sourceUrl} target="_blank" rel="noreferrer" className="text-faint hover:text-brand"><ExternalLink className="h-3 w-3" /></a>
                  </div>
                  <div className="max-w-[210px] truncate text-[10.5px] text-faint">{l.sourceUrl.replace(/^https?:\/\//, "")}</div>
                </td>
                <td className="td text-right">
                  <span className={clsx("rounded border px-1.5 py-0.5 text-[11px] tabular-nums", l.dr >= 70 ? "border-brand/25 bg-brand/10 text-brand" : l.dr >= 45 ? "border-sky/25 bg-sky/10 text-sky" : "border-line bg-raised/60 text-muted")}>{l.dr}</span>
                </td>
                <td className="td max-w-[180px]"><span className="block truncate text-[12px]">{l.anchor}</span></td>
                <td className="td max-w-[180px]"><span className="block truncate text-[11.5px] text-muted">{l.targetUrl.replace(/^https?:\/\/[^/]+/, "")}</span></td>
                <td className="td"><Badge tone={l.type === "dofollow" ? "brand" : "outline"}>{l.type}</Badge></td>
                <td className="td text-right tabular-nums text-muted">{fmtCompact(l.traffic)}</td>
                <td className="td text-[11.5px] text-muted">{fmtDate(l.firstSeen, { month: "short", day: "numeric", year: "numeric" })}</td>
                <td className="td">
                  <span className={clsx("inline-flex items-center gap-1 text-[11.5px]", l.status === "lost" ? "text-rose" : l.status === "new" ? "text-brand" : "text-muted")}>
                    <span className={clsx("h-1.5 w-1.5 rounded-full", l.status === "lost" ? "bg-rose" : l.status === "new" ? "bg-brand" : "bg-faint")} />
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2.5 text-[12px] text-muted">
        <span>{rows.length} backlinks</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost btn-xs !px-1.5"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="px-2 tabular-nums">{Math.min(page, pageCount)} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="btn-ghost btn-xs !px-1.5"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </Card>
  );
}
