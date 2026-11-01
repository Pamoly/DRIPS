import { notFound } from "next/navigation";
import { Building2, Crown, Mail, ShieldCheck, UserPlus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb, roleInProject } from "@/lib/store";
import { findProject } from "@/lib/derive";
import { fmtRelative } from "@/lib/format";
import { Avatar, Badge, Card, Kpi, PageHeader, SectionHeader } from "@/components/ui";
import { PermissionMatrix, TeamManager } from "@/components/team-manager";
import { SignInToEdit } from "@/components/read-only";

export const metadata = { title: "Team & Clients" };

export default async function TeamPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const role = roleInProject(project, user.id);
  const canManage = role === "owner" || role === "admin" || user.role === "owner";

  const members = project.members
    .map((m) => {
      const u = db.users.find((x) => x.id === m.userId);
      if (!u) return null;
      return { id: u.id, name: u.name, email: u.email, role: u.role, title: u.title, hue: u.hue, lastActive: u.lastActive, projectRole: m.role };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const clients = members.filter((m) => m.projectRole === "viewer");
  const teammates = members.filter((m) => m.projectRole !== "viewer");
  const activity = db.activity.filter((a) => a.projectId === project.id && (a.kind === "team" || a.kind === "integration")).slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Users className="h-3 w-3" /> {members.length} people · role-based access</>}
        title="Team & Clients"
        description="Collaborate on research, audits and deliverables. Give clients a read-only seat with white-labeled reporting and comments."
        actions={<Badge tone="brand"><ShieldCheck className="h-3 w-3" /> SSO-ready</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Team members" value={String(teammates.length)} hint={`${members.filter((m) => m.projectRole === "admin").length} admins`} tone="sky" icon={<Users className="h-3.5 w-3.5" />} />
        <Kpi label="Client seats" value={String(clients.length)} hint="read-only access" tone="iris" icon={<Building2 className="h-3.5 w-3.5" />} />
        <Kpi label="Owner" value={members.find((m) => m.projectRole === "owner")?.name.split(" ")[0] ?? "—"} hint="billing & workspace" tone="amber" icon={<Crown className="h-3.5 w-3.5" />} />
        <Kpi label="Pending invites" value="0" hint="all accepted" tone="brand" icon={<Mail className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <TeamManager projectId={project.id} members={members} canManage={canManage} currentUserId={user.id} />
          <PermissionMatrix />
        </div>
        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="Client portal" subtitle="What your client sees" action={<Badge tone="iris">White-label</Badge>} />
            <ul className="mt-3 space-y-2 text-[12px]">
              {["Read-only dashboards & rank snapshots", "Branded monthly reports and public links", "Comment threads on audits and content", "No access to billing or integrations"].map((t) => (
                <li key={t} className="flex items-start gap-2 text-muted"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> {t}</li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg border border-line bg-raised/30 p-3">
              <p className="text-[11px] uppercase tracking-wider text-faint">Client seats</p>
              {clients.length ? clients.map((c) => (
                <div key={c.id} className="mt-1.5 flex items-center gap-2">
                  <Avatar name={c.name} hue={c.hue} size={22} />
                  <span className="text-[12px]">{c.name}</span>
                  <span className="ml-auto text-[10.5px] text-faint">{c.email}</span>
                </div>
              )) : <p className="mt-1 text-[11.5px] text-faint">No client seats yet.</p>}
            </div>
          </Card>
          <Card>
            <SectionHeader title="Workspace activity" subtitle="Team and integration events" />
            <ul className="mt-3 space-y-2.5">
              {activity.map((a) => {
                const actor = db.users.find((u) => u.id === a.actorId);
                return (
                  <li key={a.id} className="flex gap-2.5">
                    {actor && <Avatar name={actor.name} hue={actor.hue} size={22} />}
                    <div className="min-w-0">
                      <p className="text-[11.5px] leading-snug"><span className="font-medium">{actor?.name}</span> <span className="text-muted">{a.action}</span></p>
                      <p className="truncate text-[10.5px] text-faint">{a.target} · {fmtRelative(a.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <SectionHeader title="Need another seat?" subtitle="Unlimited viewers on every plan" />
            <p className="mt-2 text-[12px] leading-relaxed text-muted">Editors and admins are billed per seat. Client viewer seats are always free — share dashboards with as many stakeholders as you need.</p>
            {canManage ? (
              <button className="btn-primary btn-sm mt-3 w-full"><UserPlus className="h-3.5 w-3.5" /> Invite a teammate</button>
            ) : (
              <SignInToEdit className="mt-3 w-full justify-center" what="invite teammates" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
