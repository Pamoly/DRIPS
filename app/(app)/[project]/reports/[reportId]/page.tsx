import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarClock, Eye, Mail, Send, Share2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { findProject } from "@/lib/derive";
import { fmtDate, fmtRelative } from "@/lib/format";
import { Badge, Card, PageHeader, SectionHeader } from "@/components/ui";
import { ReportSettings } from "@/components/report-builder";
import { SignInToEdit } from "@/components/read-only";
import { CopyButton, SendReportButton } from "@/components/actions";
import { CommentThread } from "@/components/comments";

export default async function ReportDetailPage({ params }: { params: Promise<{ project: string; reportId: string }> }) {
  const { project: projectId, reportId } = await params;
  const user = await requireUser();
  const readOnly = Boolean(user.isGuest);
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const report = db.reports.find((r) => r.id === reportId && r.projectId === project.id);
  if (!report) notFound();
  const comments = db.comments.filter((c) => c.entityType === "report" && c.entityId === report.id);
  const users = db.users.map((u) => ({ id: u.id, name: u.name, hue: u.hue }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Link href={`/${project.id}/reports`} className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" /> All reports</Link>}
        title={report.name}
        description={`${report.clientName} · ${report.period} · ${report.sections.length} sections · public link active`}
        actions={
          <>
            <a href={`/r/${report.publicToken}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><Eye className="h-3.5 w-3.5" /> Open report</a>
            <CopyButton text={`/r/${report.publicToken}`} label="Copy link" />
            {readOnly ? <SignInToEdit what="send this report" /> : <SendReportButton reportId={report.id} label="Send to client" />}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <ReportSettings report={report} readOnly={readOnly} />
          <CommentThread readOnly={readOnly} projectId={project.id} entityType="report" entityId={report.id} comments={comments} users={users} currentUserId={user.id} />
        </div>
        <div className="space-y-4 xl:col-span-5">
          <Card>
            <SectionHeader
              title="Live preview"
              subtitle="Exactly what your client sees"
              action={<a href={`/r/${report.publicToken}`} target="_blank" rel="noreferrer" className="btn-ghost btn-xs">Open <ArrowUpRight className="h-3 w-3" /></a>}
            />
            <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
              <iframe src={`/r/${report.publicToken}`} title="Report preview" className="h-[520px] w-full" />
            </div>
          </Card>
          <Card>
            <SectionHeader title="Delivery" subtitle="Share and schedule" />
            <div className="mt-3 space-y-2 text-[12px]">
              <div className="flex items-center justify-between border-b border-line/70 pb-2">
                <span className="flex items-center gap-2 text-muted"><Share2 className="h-3.5 w-3.5" /> Public link</span>
                <span className="flex items-center gap-2"><Badge tone="brand">Live</Badge><CopyButton text={`/r/${report.publicToken}`} label="Copy" /></span>
              </div>
              <div className="flex items-center justify-between border-b border-line/70 pb-2">
                <span className="flex items-center gap-2 text-muted"><Mail className="h-3.5 w-3.5" /> Recipients</span>
                <span className="max-w-[60%] truncate text-right text-[11.5px]">{report.schedule.recipients.length ? report.schedule.recipients.join(", ") : "none"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line/70 pb-2">
                <span className="flex items-center gap-2 text-muted"><CalendarClock className="h-3.5 w-3.5" /> Next run</span>
                <span className="text-[11.5px]">{report.schedule.enabled ? fmtDate(report.schedule.nextRun, { month: "short", day: "numeric" }) : "manual"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted"><Send className="h-3.5 w-3.5" /> Last sent</span>
                <span className="text-[11.5px]">{report.lastSent ? fmtRelative(report.lastSent) : "never"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
