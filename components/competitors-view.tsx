"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, Link2, Plus, Search, Swords, TrendingUp } from "lucide-react";
import type { Competitor, Intent } from "@/lib/types";
import { fmtCompact, fmtNumber, intentLabel } from "@/lib/format";
import { Badge, Card, Delta, SectionHeader } from "./ui";
import { AreaChart, Donut, HorizontalBars, Sparkline } from "./charts";
import { useRouter } from "next/navigation";

type GapRow = {
  phrase: string;
  volume: number;
  difficulty: number;
  intent: Intent;
  ranks: { name: string; domain: string; position: number }[];
  gapScore: number;
};

export function CompetitorsView({
  projectId,
  projectName,
  ownVisibility,
  competitors,
  ownReferrers,
  linkGap,
}: {
  projectId: string;
  projectName: string;
  ownVisibility: number;
  competitors: Competitor[];
  ownReferrers: number;
  linkGap: { domain: string; dr: number; competitors: string[]; traffic: number }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "gap" | "links">("overview");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"gapScore" | "volume" | "difficulty">("gapScore");
  const [busy, setBusy] = useState(false);

  const gapRows = useMemo(() => {
    const map = new Map<string, GapRow>();
    for (const comp of competitors) {
      for (const k of comp.gapKeywords) {
        const key = k.phrase.toLowerCase();
        const row = map.get(key) ?? { phrase: k.phrase, volume: k.volume, difficulty: k.difficulty, intent: k.intent, ranks: [], gapScore: k.gapScore };
        row.ranks.push({ name: comp.name, domain: comp.domain, position: k.theirPosition });
        row.volume = Math.max(row.volume, k.volume);
        row.gapScore = Math.max(row.gapScore, k.gapScore);
        map.set(key, row);
      }
    }
    return [...map.values()]
      .filter((r) => !query || r.phrase.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (sort === "gapScore" ? b.gapScore - a.gapScore : sort === "volume" ? b.volume - a.volume : a.difficulty - b.difficulty));
  }, [competitors, query, sort]);

  const track = async (phrase: string) => {
    setBusy(true);
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, phrase }),
    });
    setBusy(false);
    router.refresh();
  };

  const visibilitySegments = [
    { label: projectName, value: ownVisibility, color: "#4ADE80" },
    ...competitors.map((c, i) => ({ label: c.name, value: c.visibility, color: ["#818CF8", "#38BDF8", "#FBBF24", "#FB7185", "#A78BFA"][i % 5] })),
  ];
  const totalVisibility = visibilitySegments.reduce((s, v) => s + v.value, 0) || 1;
  const avgDr = Math.round(competitors.reduce((s, c) => s + c.dr, 0) / (competitors.length || 1));

  return (
    <div className="space-y-4">
      <div className="seg w-fit">
        {[
          { key: "overview" as const, label: "Overview", icon: Swords },
          { key: "gap" as const, label: "Keyword gap", icon: TrendingUp },
          { key: "links" as const, label: "Backlink gap", icon: Link2 },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={clsx("seg-item flex items-center gap-1.5", tab === t.key && "seg-item-active")}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-7">
              <SectionHeader
                title="Visibility share"
                subtitle="Estimated organic visibility across the competitive set"
                action={<Badge tone="brand">You: {ownVisibility}%</Badge>}
              />
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <Donut segments={visibilitySegments} size={140} centerValue={`${Math.round((ownVisibility / totalVisibility) * 100)}%`} centerLabel="share" />
                <div className="min-w-0 flex-1">
                  <AreaChart
                    series={[
                      { name: "You", color: "#4ADE80", values: ownSeriesFrom(ownVisibility, competitors) },
                      ...competitors.slice(0, 3).map((c, i) => ({ name: c.name, color: ["#818CF8", "#38BDF8", "#FBBF24"][i], values: c.trend.slice(-14) })),
                    ]}
                    labels={Array.from({ length: 14 }, (_, i) => `D${i + 1}`)}
                    height={150}
                    format="percent1"
                    area={false}
                  />
                </div>
              </div>
            </Card>
            <Card className="xl:col-span-5">
              <SectionHeader title="Backlink footprint" subtitle="Live referring domains" />
              <div className="mt-4">
                <HorizontalBars
                  data={[
                    { label: "Your site", value: ownReferrers, color: "#4ADE80" },
                    ...competitors.map((c) => ({ label: c.name, value: c.referringDomains })),
                  ]}
                  format="compact"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div><div className="label">Competitor avg. DR</div><div className="mt-1 text-[15px] font-semibold tabular-nums">{avgDr}</div></div>
                <div><div className="label">Median keywords</div><div className="mt-1 text-[15px] font-semibold tabular-nums">{fmtCompact(competitors[Math.floor(competitors.length / 2)]?.keywords ?? 0)}</div></div>
              </div>
            </Card>
          </div>

          <Card padded={false}>
            <div className="p-5 pb-3"><SectionHeader title="Tracked competitors" subtitle="Visibility, authority and volatility across the last 14 days" /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-y border-line bg-raised/30">
                    <th className="th">Competitor</th>
                    <th className="th text-right">DR</th>
                    <th className="th text-right">Visibility</th>
                    <th className="th text-right">Keywords</th>
                    <th className="th text-right">Est. traffic</th>
                    <th className="th text-right">Ref. domains</th>
                    <th className="th text-right">Gained</th>
                    <th className="th text-right">Lost</th>
                    <th className="th">14-day trend</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="table-row bg-brand/[0.03]">
                    <td className="td"><div className="font-medium">{projectName} <Badge tone="brand" className="ml-1">You</Badge></div><span className="text-[11px] text-faint">your domain</span></td>
                    <td className="td text-right tabular-nums">64</td>
                    <td className="td text-right tabular-nums">{ownVisibility}%</td>
                    <td className="td text-right tabular-nums">{fmtNumber(120)}</td>
                    <td className="td text-right tabular-nums">—</td>
                    <td className="td text-right tabular-nums">{fmtCompact(ownReferrers)}</td>
                    <td className="td text-right"><Delta value={72} /></td>
                    <td className="td text-right"><Delta value={-19} /></td>
                    <td className="td"><Sparkline data={ownSeriesFrom(ownVisibility, competitors).slice(-14)} color="#4ADE80" width={90} height={24} /></td>
                  </tr>
                  {competitors.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="td"><div className="font-medium">{c.name}</div><span className="text-[11px] text-faint">{c.domain}</span></td>
                      <td className="td text-right tabular-nums">{c.dr}</td>
                      <td className="td text-right tabular-nums">{c.visibility}%</td>
                      <td className="td text-right tabular-nums">{fmtCompact(c.keywords)}</td>
                      <td className="td text-right tabular-nums">{fmtCompact(c.traffic)}</td>
                      <td className="td text-right tabular-nums">{fmtCompact(c.referringDomains)}</td>
                      <td className="td text-right"><Delta value={c.gained} /></td>
                      <td className="td text-right"><Delta value={-c.lost} /></td>
                      <td className="td"><Sparkline data={c.trend} color="#38BDF8" width={90} height={24} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "gap" && (
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find gap keywords…" className="input !py-1.5 pl-8 text-[12.5px]" />
            </div>
            <select className="select !w-auto !py-1.5 text-[12px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="gapScore">Best gap score</option>
              <option value="volume">Highest volume</option>
              <option value="difficulty">Lowest difficulty</option>
            </select>
            <span className="text-[11.5px] text-faint">{gapRows.length} opportunities</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-raised/30">
                  <th className="th">Gap keyword</th>
                  <th className="th">Intent</th>
                  <th className="th text-right">Volume</th>
                  <th className="th">KD</th>
                  <th className="th">Competitors ranking</th>
                  <th className="th text-right">Gap score</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {gapRows.slice(0, 40).map((r) => (
                  <tr key={r.phrase} className="table-row">
                    <td className="td max-w-[280px]"><span className="block truncate font-medium">{r.phrase}</span></td>
                    <td className="td"><span className="text-[11.5px] text-muted">{intentLabel(r.intent)}</span></td>
                    <td className="td text-right tabular-nums">{fmtCompact(r.volume)}</td>
                    <td className="td"><span className={clsx("text-[12px] tabular-nums", r.difficulty >= 65 ? "text-rose" : r.difficulty >= 40 ? "text-amber" : "text-brand")}>{r.difficulty}</span></td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {r.ranks.slice(0, 3).map((x) => (
                          <span key={x.domain} className="chip border-line bg-raised/60 text-[10.5px] text-muted">{x.name} #{x.position}</span>
                        ))}
                        {r.ranks.length > 3 && <span className="chip border-line bg-raised/60 text-[10.5px] text-faint">+{r.ranks.length - 3}</span>}
                      </div>
                    </td>
                    <td className="td text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-raised">
                          <div className="h-full rounded-full bg-iris" style={{ width: `${r.gapScore}%` }} />
                        </div>
                        <span className="tabular-nums text-[12px]">{r.gapScore}</span>
                      </div>
                    </td>
                    <td className="td text-right">
                      <button onClick={() => track(r.phrase)} disabled={busy} className="btn-soft btn-xs"><Plus className="h-3 w-3" /> Track</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "links" && (
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-7" padded={false}>
            <div className="p-5 pb-2"><SectionHeader title="Link gap opportunities" subtitle="Domains linking to multiple competitors but not to you" /></div>
            <table className="w-full">
              <thead>
                <tr className="border-y border-line bg-raised/30">
                  <th className="th">Domain</th>
                  <th className="th text-right">DR</th>
                  <th className="th text-right">Est. traffic</th>
                  <th className="th">Links to</th>
                  <th className="th text-right">Outreach</th>
                </tr>
              </thead>
              <tbody>
                {linkGap.map((l) => (
                  <tr key={l.domain} className="table-row">
                    <td className="td font-medium">{l.domain}</td>
                    <td className="td text-right tabular-nums">{l.dr}</td>
                    <td className="td text-right tabular-nums text-muted">{fmtCompact(l.traffic)}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {l.competitors.map((c) => <span key={c} className="chip border-line bg-raised/60 text-[10.5px] text-muted">{c}</span>)}
                      </div>
                    </td>
                    <td className="td text-right"><span className="text-[11.5px] text-brand">High</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="xl:col-span-5">
            <SectionHeader title="Authority comparison" subtitle="Domain rating vs. referring domains" />
            <div className="mt-4 space-y-3">
              {[{ name: "Your site", dr: 64, rd: ownReferrers, color: "#4ADE80" }, ...competitors.map((c) => ({ name: c.name, dr: c.dr, rd: c.referringDomains, color: "#818CF8" }))].map((d) => (
                <div key={d.name} className="rounded-lg border border-line bg-raised/20 p-3">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium">{d.name}</span>
                    <span className="tabular-nums text-muted">DR {d.dr}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                      <div className="h-full rounded-full" style={{ width: `${(d.dr / 100) * 100}%`, background: d.color }} />
                    </div>
                    <span className="w-16 text-right text-[11px] tabular-nums text-faint">{fmtCompact(d.rd)} RD</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">
              Prioritise the {linkGap.length} domains above where DR is high and topical relevance is strong. Outreach templates live in the Tasks board.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function ownSeriesFrom(ownVisibility: number, competitors: Competitor[]): number[] {
  const base = competitors[0]?.trend ?? [];
  return base.map((v, i) => Math.max(1, Math.round((ownVisibility + Math.sin(i / 2.2) * 1.4 + (i - base.length / 2) * 0.12) * 10) / 10));
}
