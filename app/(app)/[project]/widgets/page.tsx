import { notFound } from "next/navigation";
import { Code2, Layers, LayoutTemplate, Shield, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { findProject, projectWidgets } from "@/lib/derive";
import { fmtNumber } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader, SectionHeader } from "@/components/ui";
import { NewWidgetButton, WidgetCard } from "@/components/widget-creator";
import { SignInToEdit } from "@/components/read-only";

export const metadata = { title: "Widgets" };

export default async function WidgetsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const readOnly = Boolean(user.isGuest);
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const widgets = projectWidgets(db, project.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><LayoutTemplate className="h-3 w-3" /> Embeddable · live data</>}
        title="Embeddable Widgets"
        description="Drop live SEO proof into client dashboards, landing pages or pitch decks. Every widget is a lightweight iframe with your accent colour."
        actions={readOnly ? <SignInToEdit what="create widgets" /> : <NewWidgetButton projectId={project.id} accent={project.brandColor} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Active widgets" value={String(widgets.length)} hint="live iframes" tone="brand" icon={<Layers className="h-3.5 w-3.5" />} />
        <Kpi label="Embed views" value={fmtNumber(1284)} hint="last 30 days" tone="sky" icon={<Zap className="h-3.5 w-3.5" />} />
        <Kpi label="Load time" value="42ms" hint="edge cached iframe" tone="iris" icon={<Code2 className="h-3.5 w-3.5" />} />
      </div>

      {widgets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w) => <WidgetCard key={w.id} widget={w} readOnly={readOnly} />)}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <LayoutTemplate className="h-8 w-8 text-faint" />
            <p className="mt-3 text-[13.5px] font-medium">No widgets yet</p>
            <p className="mt-1 max-w-sm text-[12.5px] text-muted">Create your first embed to show live rankings or authority on a client site.</p>
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionHeader title="How embedding works" subtitle="Copy, paste, ship" />
          <ol className="mt-4 space-y-3">
            {[
              { t: "Create a widget", d: "Pick a metric, theme and accent colour. Data renders from your live project." },
              { t: "Copy the iframe snippet", d: "Each widget has a signed public token — no API key required on the client site." },
              { t: "Paste anywhere", d: "Works in Webflow, WordPress, HubSpot, Notion embeds and custom dashboards." },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-raised text-[11px] font-semibold">{i + 1}</span>
                <div>
                  <p className="text-[12.5px] font-medium">{s.t}</p>
                  <p className="text-[11.5px] leading-relaxed text-muted">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-bg/60 p-3 font-mono text-[10.5px] leading-relaxed text-muted">
{`<iframe src="${widgets[0] ? `/embed/${widgets[0].publicToken}` : "/embed/wgt_token"}"
  width="360" height="230" loading="lazy"
  style="border:0;border-radius:14px"></iframe>`}
          </pre>
        </Card>
        <Card className="xl:col-span-5">
          <SectionHeader title="Widget catalogue" subtitle="Everything you can embed" action={<Badge tone="iris"><Shield className="h-3 w-3" /> Signed URLs</Badge>} />
          <ul className="mt-4 space-y-2">
            {[
              { n: "Rank snapshot", d: "Average position + 30-day trend" },
              { n: "Authority badge", d: "Domain rating and referring domains" },
              { n: "Top keywords", d: "Live top-5 rankings with volume" },
              { n: "Audit score", d: "Site health gauge and issue count" },
              { n: "Local grid", d: "5×5 geo-grid of local pack positions" },
            ].map((w) => (
              <li key={w.n} className="flex items-center justify-between rounded-lg border border-line bg-raised/20 px-3 py-2">
                <div><p className="text-[12px] font-medium">{w.n}</p><p className="text-[10.5px] text-faint">{w.d}</p></div>
                <span className="text-[10px] uppercase tracking-wider text-faint">iframe</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
