import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, FileText, PenLine, Plug, Sparkles, Target, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { contentPipeline, findProject, projectDocs } from "@/lib/derive";
import { fmtDate, fmtNumber, fmtRelative, scoreTone } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader, Progress, ScoreRing, SectionHeader } from "@/components/ui";
import { NewContentButton } from "@/components/content-editor";
import { SignInToEdit } from "@/components/read-only";
import { Donut } from "@/components/charts";

export const metadata = { title: "Content Optimizer" };

export default async function ContentPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const readOnly = Boolean(user.isGuest);
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const docs = projectDocs(db, project.id);
  const pipeline = contentPipeline(docs);
  const author = (id: string) => db.users.find((u) => u.id === id)?.name ?? "—";
  const keywords = db.keywords.filter((k) => k.projectId === project.id);
  const linked = docs.filter((d) => keywords.some((k) => k.phrase.toLowerCase() === d.targetKeyword.toLowerCase()));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><PenLine className="h-3 w-3" /> Real-time scoring · WordPress connected</>}
        title="Content Optimizer"
        description="Write and score content against live SERP and readability signals. Every edit re-scores instantly — in the app and inside WordPress."
        actions={
          <>
            <Link href={`/${project.id}/wordpress`} className="btn-ghost btn-sm">
              <Plug className="h-3.5 w-3.5" /> {project.wp.connected ? "WordPress live" : "Connect WordPress"}
            </Link>
            {readOnly ? <SignInToEdit what="create content" /> : <NewContentButton projectId={project.id} />}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Documents" value={String(docs.length)} hint={`${pipeline.draft} drafts · ${pipeline.optimized} optimized`} tone="sky" icon={<FileText className="h-3.5 w-3.5" />} />
        <Kpi label="Average score" value={`${pipeline.avgScore}/100`} hint="across all documents" tone={pipeline.avgScore >= 75 ? "brand" : "amber"} icon={<Sparkles className="h-3.5 w-3.5" />} />
        <Kpi label="Published" value={String(pipeline.published)} hint={`${fmtNumber(pipeline.words)} words in library`} tone="brand" icon={<BookOpen className="h-3.5 w-3.5" />} />
        <Kpi label="Keyword aligned" value={String(linked.length)} hint="docs matched to tracked keywords" tone="iris" icon={<Target className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8" padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
            <SectionHeader title="Content library" subtitle="Scores update as you edit — drafts included" />
            <div className="flex gap-1.5">
              <Badge tone="outline">{docs.length} docs</Badge>
              <Badge tone="brand">{pipeline.avgScore} avg</Badge>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-y border-line bg-raised/30">
                <th className="th">Document</th>
                <th className="th">Focus keyword</th>
                <th className="th text-right">Words</th>
                <th className="th">Score</th>
                <th className="th">Status</th>
                <th className="th">Updated</th>
                <th className="th text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="table-row">
                  <td className="td max-w-[280px]">
                    <Link href={`/${project.id}/content/${d.id}`} className="block truncate font-medium hover:text-brand">{d.title}</Link>
                    <span className="text-[11px] text-faint">{author(d.authorId)}</span>
                  </td>
                  <td className="td"><span className="text-[11.5px] text-muted">{d.targetKeyword || "—"}</span></td>
                  <td className="td text-right tabular-nums text-muted">{fmtNumber(d.wordCount)}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-14 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: scoreTone(d.score).hex }} />
                      </div>
                      <span className={`text-[11.5px] font-medium tabular-nums ${scoreTone(d.score).text}`}>{d.score}</span>
                    </div>
                  </td>
                  <td className="td"><Badge tone={d.status === "published" ? "brand" : d.status === "optimized" ? "sky" : "outline"}>{d.status}</Badge></td>
                  <td className="td text-[11.5px] text-muted">{fmtRelative(d.updatedAt)}</td>
                  <td className="td text-right"><Link href={`/${project.id}/content/${d.id}`} className="btn-soft btn-xs">Edit <ArrowRight className="h-3 w-3" /></Link></td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[12.5px] text-muted">No documents yet. Create your first draft to see live scoring.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="Pipeline" subtitle="Documents by stage" />
            <div className="mt-4">
              <Donut
                segments={[
                  { label: "Draft", value: pipeline.draft, color: "#818CF8" },
                  { label: "Optimized", value: pipeline.optimized, color: "#38BDF8" },
                  { label: "Published", value: pipeline.published, color: "#4ADE80" },
                ]}
                centerValue={String(docs.length)}
                centerLabel="docs"
                size={120}
              />
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-[12px]">
              {docs.slice(0, 3).map((d) => (
                <div key={d.id}>
                  <div className="mb-1 flex items-center justify-between gap-2"><span className="truncate text-muted">{d.title}</span><span className="shrink-0 tabular-nums text-faint">{d.score}</span></div>
                  <Progress value={d.score} tone={d.score >= 80 ? "brand" : d.score >= 60 ? "amber" : "rose"} height={4} />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionHeader title="WordPress integration" subtitle={project.wp.connected ? `Connected · ${project.wp.url}` : "Not connected"} action={<Badge tone={project.wp.connected ? "brand" : "outline"}>{project.wp.connected ? `v${project.wp.version}` : "off"}</Badge>} />
            <div className="mt-3 space-y-2 text-[12px] text-muted">
              <p className="flex items-start gap-2"><Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" /> Scores recalculate on save inside the WordPress editor.</p>
              <p className="flex items-start gap-2"><ScoreRing score={pipeline.avgScore} size={22} stroke={3} /> Average site-wide content score benchmark.</p>
            </div>
            <Link href={`/${project.id}/wordpress`} className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition hover:text-ink">
              <Plug className="h-3.5 w-3.5" /> Manage connector
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
