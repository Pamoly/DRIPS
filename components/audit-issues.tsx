"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Search, Wrench } from "lucide-react";
import type { AuditIssue } from "@/lib/types";
import { severityTone } from "@/lib/format";
import { Card } from "./ui";

export function AuditIssues({ issues }: { issues: AuditIssue[] }) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<string | null>(issues.find((i) => i.severity === "critical")?.id ?? null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () =>
      issues.filter((i) => {
        if (severity !== "all" && i.severity !== severity) return false;
        if (category !== "all" && i.category !== category) return false;
        if (query && !`${i.title} ${i.detail} ${i.fix}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [issues, severity, category, query],
  );

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search issues, fixes…" className="input !py-1.5 pl-8 text-[12.5px]" />
        </div>
        <select className="select !w-auto !py-1.5 text-[12px]" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warnings</option>
          <option value="notice">Notices</option>
        </select>
        <select className="select !w-auto !py-1.5 text-[12px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {["Technical", "On-page", "Performance", "Content", "Links", "Security"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-[11.5px] text-faint">{rows.length} issues · {resolved.size} marked fixed</span>
      </div>
      <ul className="divide-y divide-line/70">
        {rows.map((issue) => {
          const isOpen = open === issue.id;
          const isResolved = resolved.has(issue.id);
          return (
            <li key={issue.id}>
              <button
                onClick={() => setOpen(isOpen ? null : issue.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-raised/30"
              >
                <span className={clsx("mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", severityTone(issue.severity))}>
                  {issue.severity}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={clsx("block text-[12.5px] font-medium", isResolved && "text-faint line-through")}>{issue.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                    <span>{issue.category}</span>
                    <span className="h-1 w-1 rounded-full bg-line" />
                    <span>{issue.affected} URLs affected</span>
                    <span className="h-1 w-1 rounded-full bg-line" />
                    <span>{issue.impact} impact</span>
                  </span>
                </span>
                {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-faint" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-faint" />}
              </button>
              {isOpen && (
                <div className="border-t border-line/60 bg-raised/10 px-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="label">Why it matters</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{issue.detail}</p>
                    </div>
                    <div>
                      <p className="label flex items-center gap-1.5"><Wrench className="h-3 w-3" /> Recommended fix</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink/90">{issue.fix}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const next = new Set(resolved);
                        next.has(issue.id) ? next.delete(issue.id) : next.add(issue.id);
                        setResolved(next);
                      }}
                      className={clsx("btn-xs", isResolved ? "btn-soft" : "btn-primary")}
                    >
                      {isResolved ? "Reopen issue" : "Mark as fixed"}
                    </button>
                    <span className="text-[11px] text-faint">Crawled {new Date(issue.crawled).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-10 text-center text-[12.5px] text-muted">No issues match these filters.</li>}
      </ul>
    </Card>
  );
}
