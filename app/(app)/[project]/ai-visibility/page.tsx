import { notFound } from "next/navigation";
import { Bot, CheckCircle2, ExternalLink, RefreshCw, Sparkles, TrendingUp, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { aiVisibility, findProject, projectAi } from "@/lib/derive";
import { fmtCompact, fmtNumber, fmtRelative } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader, Progress, ScoreRing, SectionHeader } from "@/components/ui";
import { AreaChart, Donut, HorizontalBars } from "@/components/charts";
import { AiPromptsTable } from "@/components/ai-prompts-table";
import { ActionButton } from "@/components/actions";
import { SignInToEdit } from "@/components/read-only";
import { rngFor, round } from "@/lib/rand";

export const metadata = { title: "AI Visibility" };

export default async function AiVisibilityPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const readOnly = Boolean(user.isGuest);
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const prompts = projectAi(db, project.id);
  const ai = aiVisibility(prompts);
  const rng = rngFor("ai-trend", project.id);
  const trend = Array.from({ length: 30 }, (_, i) => {
    const base = Math.max(0, ai.coverage - (29 - i) * 0.55 + (rng() - 0.5) * 4);
    return { date: `D${i + 1}`, value: round(base, 1) };
  });
  const engines = ai.byEngine;
  const bestEngine = [...engines].sort((a, b) => b.coverage - a.coverage)[0];
  const citedDomains = Object.entries(
    prompts.reduce<Record<string, number>>((acc, p) => {
      if (!p.citedUrl) return acc;
      const domain = new URL(p.citedUrl).hostname.replace("www.", "");
      acc[domain] = (acc[domain] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Sparkles className="h-3 w-3" /> AI search visibility · 5 answer engines</>}
        title="AI Visibility"
        description="See whether AI assistants recommend you. Track mentions, sentiment and citations across ChatGPT, Perplexity, Gemini, AI Overviews and Copilot."
        actions={
          <>
            <Badge tone="iris"><Bot className="h-3 w-3" /> {ai.prompts} prompts</Badge>
            {readOnly ? (
              <SignInToEdit what="re-run the scan" />
            ) : (
              <ActionButton endpoint="/api/ai" body={{ projectId: project.id, action: "scan" }} className="btn-primary btn-sm" pendingLabel="Scanning…">
                <RefreshCw className="h-3.5 w-3.5" /> Re-run scan
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Answer coverage" value={`${ai.coverage}%`} hint={`${ai.mentioned} of ${ai.prompts} prompts mention you`} tone="iris" icon={<Bot className="h-3.5 w-3.5" />} />
        <Kpi label="Share of voice" value={`${ai.shareOfVoice}%`} hint="vs competitor mentions in answers" tone="brand" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <Kpi label="Avg. mention position" value={`#${ai.avgPosition}`} hint="where you appear in the answer" tone="sky" />
        <Kpi label="Citations earned" value={fmtNumber(ai.citations)} hint={`across ${citedDomains.length} cited pages`} tone="amber" icon={<Zap className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionHeader title="Coverage over time" subtitle="Share of sampled prompts where your brand is cited" action={<Badge tone="outline">30 days</Badge>} />
          <div className="mt-4">
            <AreaChart series={[{ name: "Coverage", color: "#818CF8", values: trend.map((t) => t.value) }]} labels={trend.map((t) => t.date)} height={214} format="percent1" yTicks={4} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3 text-[12px]">
            <div><p className="label">Best engine</p><p className="mt-1 font-medium">{bestEngine?.engine} · {bestEngine?.coverage}%</p></div>
            <div><p className="label">Weakest engine</p><p className="mt-1 font-medium">{[...engines].sort((a, b) => a.coverage - b.coverage)[0]?.engine}</p></div>
            <div><p className="label">Last scan</p><p className="mt-1 font-medium">{fmtRelative(prompts[0]?.updatedAt ?? null)}</p></div>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <SectionHeader title="Engine breakdown" subtitle="Coverage by answer engine" action={<Badge tone="iris"><Sparkles className="h-3 w-3" /> New</Badge>} />
          <div className="mt-4 space-y-3">
            {engines.map((e) => (
              <div key={e.engine}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-muted">{e.engine}</span>
                  <span className="tabular-nums">{e.coverage}% <span className="text-faint">({e.prompts} prompts)</span></span>
                </div>
                <Progress value={e.coverage} tone="iris" height={5} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-line bg-raised/20 p-3">
            <ScoreRing score={ai.shareOfVoice} size={56} stroke={5} label="SOV" />
            <p className="text-[11.5px] leading-relaxed text-muted">You appear in {ai.mentioned} answers. Competitors appear in {prompts.reduce((s, p) => s + p.competitorsMentioned.length, 0)} — prioritise comparison content and third-party mentions to close the gap.</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <SectionHeader title="Cited pages" subtitle="URLs AI engines reference most" />
          <div className="mt-4">
            <HorizontalBars data={citedDomains.slice(0, 6)} format="number" color="#38BDF8" />
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <SectionHeader title="Sentiment mix" subtitle="Tone of brand mentions" />
          <div className="mt-4">
            <Donut
              segments={[
                { label: "Positive", value: prompts.filter((p) => p.sentiment === "positive").length, color: "#4ADE80" },
                { label: "Neutral", value: prompts.filter((p) => p.sentiment === "neutral").length, color: "#38BDF8" },
                { label: "Absent", value: prompts.filter((p) => p.sentiment === "absent").length, color: "#3B4756" },
                { label: "Negative", value: prompts.filter((p) => p.sentiment === "negative").length, color: "#FB7185" },
              ]}
              size={122}
              centerValue={`${ai.coverage}%`}
              centerLabel="cited"
            />
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <SectionHeader title="How to win AI answers" subtitle="Actionable checklist" />
          <ul className="mt-3 space-y-2 text-[12px]">
            {[
              "Publish comparison pages naming competitors explicitly",
              "Add FAQ schema with concise, quotable answers",
              "Earn citations on listicles AI engines already trust",
              "Keep statistics dated and source-linked for freshness",
              "Use clear entity mentions (brand + product + location)",
            ].map((tip, i) => (
              <li key={tip} className="flex items-start gap-2">
                <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${i < 2 ? "text-brand" : "text-faint"}`} />
                <span className="text-muted">{tip}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-lg border border-iris/20 bg-iris/[0.06] p-3 text-[11.5px] leading-relaxed text-muted">
            <p className="font-medium text-iris">Next best action</p>
            Build a “best {project.name.toLowerCase()} alternatives” page — 6 of your 14 prompts ask for comparisons.
          </div>
        </Card>
      </div>

      <AiPromptsTable prompts={prompts} />
    </div>
  );
}
