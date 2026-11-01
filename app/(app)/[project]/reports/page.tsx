import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, Eye, FileText, Mail, Send, Share2, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { findProject, projectReports } from "@/lib/derive";
import { fmtDate, fmtRelative } from "@/lib/format";
import { Badge, Card, Kpi, PageHeader, SectionHeader } from "@/components/ui";
import { NewReportButton } from "@/components/report-builder";
import { SignInToEdit } from "@/components/read-only";
import { CopyButton, SendReportButton } from "@/components/actions";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const readOnly = Boolean(user.isGuest);
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const reports = projectReports(db, project.id);
  const scheduled = reports.filter((r) => r.schedule.enabled);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><FileText className="h-3 w-3" /> White-label deliverables · {reports.length} templates</>}
        title="Client Reports"
        description="Build beautiful, branded reports in seconds. Schedule automated delivery, share public links, and keep clients aligned without a single spreadsheet."
        actions={
          <>
            <Badge tone="brand"><CalendarClock className="h-3 w-3" /> {scheduled.length} scheduled</Badge>
            {readOnly ? <SignInToEdit what="build reports" /> : <NewReportButton projectId={project.id} clientName={project.name} accent={project.brandColor} />}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Reports created" value={String(reports.length)} hint={`${reports.filter((r) => r.status === "published").length} published`} tone="sky" icon={<FileText className="h-3.5 w-3.5" />} />
        <Kpi label="Scheduled deliveries" value={String(scheduled.length)} hint="automated email cadence" tone="brand" icon={<Mail className="h-3.5 w-3.5" />} />
        <Kpi label="Last delivery" value={fmtRelative(reports.map((r) => r.lastSent).filter(Boolean).sort().reverse()[0] ?? null)} hint="to client stakeholders" tone="iris" icon={<Send className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/${project.id}/reports/${r.id}`} className="block truncate text-[13.5px] font-semibold hover:text-brand">{r.name}</Link>
                  <p className="mt-0.5 text-[11.5px] text-muted">{r.clientName} · {r.period}</p>
                </div>
                <Badge tone={r.status === "published" ? "brand" : "outline"}>{r.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {r.sections.slice(0, 5).map((s) => <span key={s} className="chip border-line bg-raised/40 text-[10px] capitalize text-muted">{s}</span>)}
                {r.sections.length > 5 && <span className="chip border-line bg-raised/40 text-[10px] text-faint">+{r.sections.length - 5}</span>}
              </div>
              <div className="mt-3 space-y-1.5 rounded-lg border border-line bg-raised/20 p-2.5 text-[11.5px]">
                <div className="flex items-center justify-between"><span className="text-faint">Branding</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.accent }} />{r.logoText}</span></div>
                <div className="flex items-center justify-between"><span className="text-faint">Last sent</span><span>{r.lastSent ? fmtDate(r.lastSent, { month: "short", day: "numeric" }) : "never"}</span></div>
                <div className="flex items-center justify-between"><span className="text-faint">Schedule</span><span>{r.schedule.enabled ? `${r.schedule.frequency} · ${r.schedule.recipients.length} recipients` : "manual"}</span></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
              <Link href={`/${project.id}/reports/${r.id}`} className="btn-soft btn-xs">Configure</Link>
              <a href={`/r/${r.publicToken}`} target="_blank" rel="noreferrer" className="btn-ghost btn-xs"><Eye className="h-3 w-3" /> Preview</a>
              <CopyButton text={`/r/${r.publicToken}`} label="Link" />
              {!readOnly && <div className="ml-auto"><SendReportButton reportId={r.id} label="Send" /></div>}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7" padded={false}>
          <div className="p-5 pb-3"><SectionHeader title="Delivery schedule" subtitle="Automated email reports going out this month" action={<Badge tone="outline">White-label</Badge>} /></div>
          <table className="w-full">
            <thead>
              <tr className="border-y border-line bg-raised/30">
                <th className="th">Report</th>
                <th className="th">Cadence</th>
                <th className="th">Recipients</th>
                <th className="th">Next run</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="td font-medium">{r.name}</td>
                  <td className="td text-[12px] capitalize text-muted">{r.schedule.enabled ? r.schedule.frequency : "manual"}</td>
                  <td className="td text-[11.5px] text-muted">{r.schedule.recipients.length ? r.schedule.recipients.join(", ") : "—"}</td>
                  <td className="td text-[11.5px]">{r.schedule.enabled ? fmtDate(r.schedule.nextRun, { month: "short", day: "numeric" }) : "—"}</td>
                  <td className="td">{r.schedule.enabled ? <span className="inline-flex items-center gap-1 text-[11.5px] text-brand"><CheckCircle2 className="h-3.5 w-3.5" /> Active</span> : <span className="text-[11.5px] text-faint">Paused</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="xl:col-span-5">
          <SectionHeader title="White-label toolkit" subtitle="Everything clients see is yours" action={<Badge tone="iris"><Sparkles className="h-3 w-3" /> Pro</Badge>} />
          <ul className="mt-4 space-y-2.5 text-[12px] text-muted">
            {[
              { icon: Share2, text: "Public share links with your accent colour and logo text" },
              { icon: Eye, text: "Embeddable widgets for client dashboards and landing pages" },
              { icon: Mail, text: "Scheduled email delivery to unlimited stakeholders" },
              { icon: FileText, text: "Print-ready A4 PDF export via the browser print dialog" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.text} className="flex items-start gap-2.5 rounded-lg border border-line bg-raised/20 p-2.5">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <span>{f.text}</span>
                </li>
              );
            })}
          </ul>
          <Link href={`/${project.id}/widgets`} className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition hover:text-ink">
            Build a widget <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
