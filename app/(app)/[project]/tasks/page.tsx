import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, ListChecks, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb, roleInProject } from "@/lib/store";
import { findProject, projectTasks, taskSummary } from "@/lib/derive";
import { fmtRelative, scoreTone } from "@/lib/format";
import { Avatar, Badge, Card, Kpi, PageHeader, Progress, SectionHeader } from "@/components/ui";
import { TasksBoard } from "@/components/tasks-board";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const tasks = projectTasks(db, project.id);
  const summary = taskSummary(tasks);
  const role = roleInProject(project, user.id);
  const canEdit = role === "owner" || role === "admin" || role === "editor" || user.role === "owner";
  const users = project.members
    .map((m) => db.users.find((u) => u.id === m.userId))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({ id: u.id, name: u.name, hue: u.hue, title: u.title }));

  const workload = users.map((u) => ({
    user: u,
    open: tasks.filter((t) => t.assigneeId === u.id && t.status !== "done").length,
    done: tasks.filter((t) => t.assigneeId === u.id && t.status === "done").length,
  })).sort((a, b) => b.open - a.open);

  const activity = db.activity.filter((a) => a.projectId === project.id && a.kind === "team").slice(0, 6);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><ListChecks className="h-3 w-3" /> Collaborative workflow · {users.length} collaborators</>}
        title="Tasks"
        description="Turn audit findings into shipped work. Drag tasks across the board, assign owners and keep clients informed on progress."
        actions={<Badge tone={summary.overdue ? "rose" : "brand"}><AlertTriangle className="h-3 w-3" /> {summary.overdue} overdue</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open tasks" value={String(summary.total - summary.done)} hint={`${summary.inProgress} in progress`} tone="sky" icon={<Clock className="h-3.5 w-3.5" />} />
        <Kpi label="In review" value={String(summary.review)} hint="awaiting QA sign-off" tone="amber" icon={<Users className="h-3.5 w-3.5" />} />
        <Kpi label="Completed" value={String(summary.done)} hint={`${Math.round((summary.done / (summary.total || 1)) * 100)}% of all tasks`} tone="brand" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <Kpi label="Overdue" value={String(summary.overdue)} hint="past due date" tone={summary.overdue ? "rose" : "brand"} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
      </div>

      <TasksBoard projectId={project.id} tasks={tasks} users={users} currentUserId={user.id} canEdit={canEdit} />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionHeader title="Team workload" subtitle="Open tasks per collaborator" />
          <div className="mt-4 space-y-3">
            {workload.map((w) => (
              <div key={w.user.id} className="flex items-center gap-3">
                <Avatar name={w.user.name} hue={w.user.hue} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium">{w.user.name} <span className="font-normal text-faint">· {w.user.title}</span></span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">{w.open} open · {w.done} done</span>
                  </div>
                  <Progress value={w.open} max={Math.max(...workload.map((x) => x.open), 1)} tone={w.open > 3 ? "amber" : "sky"} height={5} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="xl:col-span-5">
          <SectionHeader title="Team activity" subtitle="Recent collaboration events" />
          <ul className="mt-4 space-y-3">
            {activity.map((a) => {
              const actor = db.users.find((u) => u.id === a.actorId);
              return (
                <li key={a.id} className="flex gap-2.5">
                  {actor && <Avatar name={actor.name} hue={actor.hue} size={24} />}
                  <div className="min-w-0">
                    <p className="text-[11.5px] leading-snug"><span className="font-medium">{actor?.name}</span> <span className="text-muted">{a.action}</span></p>
                    <p className="truncate text-[10.5px] text-faint">{a.target} · {fmtRelative(a.at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
