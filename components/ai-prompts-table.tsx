"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, ExternalLink, Minus, Search, Sparkles, XCircle } from "lucide-react";
import type { AiPrompt } from "@/lib/types";
import { fmtCompact, fmtRelative } from "@/lib/format";
import { Badge, Card } from "./ui";

export function AiPromptsTable({ prompts }: { prompts: AiPrompt[] }) {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState("all");
  const [mention, setMention] = useState("all");

  const rows = useMemo(
    () =>
      prompts.filter((p) => {
        if (engine !== "all" && p.engine !== engine) return false;
        if (mention === "mentioned" && !p.mentioned) return false;
        if (mention === "absent" && p.mentioned) return false;
        if (query && !`${p.prompt} ${p.competitorsMentioned.join(" ")}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [prompts, query, engine, mention],
  );

  const engines = ["ChatGPT", "Perplexity", "Gemini", "AI Overviews", "Copilot"];

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prompts and mentions…" className="input !py-1.5 pl-8 text-[12.5px]" />
        </div>
        <select className="select !w-auto !py-1.5 text-[12px]" value={engine} onChange={(e) => setEngine(e.target.value)}>
          <option value="all">All engines</option>
          {engines.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="select !w-auto !py-1.5 text-[12px]" value={mention} onChange={(e) => setMention(e.target.value)}>
          <option value="all">All results</option>
          <option value="mentioned">Mentioned</option>
          <option value="absent">Not mentioned</option>
        </select>
        <span className="text-[11.5px] text-faint">{rows.length} prompts</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-raised/30">
              <th className="th">Prompt</th>
              <th className="th">Engine</th>
              <th className="th text-right">Volume</th>
              <th className="th">Brand cited</th>
              <th className="th text-right">Position</th>
              <th className="th">Sentiment</th>
              <th className="th">Also mentioned</th>
              <th className="th">Checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="td max-w-[340px]">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px]">{p.prompt}</span>
                    {p.citedUrl && <a href={p.citedUrl} target="_blank" rel="noreferrer" className="text-faint hover:text-brand"><ExternalLink className="h-3 w-3" /></a>}
                  </div>
                  {p.citedUrl && <p className="truncate text-[10.5px] text-faint">cited: {p.citedUrl.replace(/^https?:\/\//, "")}</p>}
                </td>
                <td className="td"><span className="chip border-line bg-raised/60 text-[10.5px] text-muted">{p.engine}</span></td>
                <td className="td text-right tabular-nums text-muted">{fmtCompact(p.volume)}</td>
                <td className="td">
                  {p.mentioned ? (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-brand"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-faint"><XCircle className="h-3.5 w-3.5" /> No</span>
                  )}
                </td>
                <td className="td text-right tabular-nums">{p.position ? `#${p.position}` : <Minus className="ml-auto h-3 w-3 text-faint" />}</td>
                <td className="td">
                  <Badge tone={p.sentiment === "positive" ? "brand" : p.sentiment === "neutral" ? "sky" : p.sentiment === "negative" ? "rose" : "outline"}>
                    {p.sentiment}
                  </Badge>
                </td>
                <td className="td">
                  <div className="flex flex-wrap gap-1">
                    {p.competitorsMentioned.length ? p.competitorsMentioned.map((c) => <span key={c} className="chip border-line bg-raised/50 text-[10px] text-muted">{c}</span>) : <span className="text-[11px] text-faint">—</span>}
                  </div>
                </td>
                <td className="td text-[11px] text-faint">{fmtRelative(p.updatedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-[12.5px] text-muted">No prompts match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line p-3 text-[11px] text-faint">
        <Sparkles className="mr-1 inline h-3 w-3" /> Prompt set sampled from real user questions across answer engines. Coverage re-checked every 72 hours.
      </div>
    </Card>
  );
}
