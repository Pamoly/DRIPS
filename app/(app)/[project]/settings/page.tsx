import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Download, KeyRound, Link2, Plug, RefreshCw, Settings2, ShieldCheck, User, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb, roleInProject } from "@/lib/store";
import { findProject } from "@/lib/derive";
import { fmtRelative } from "@/lib/format";
import { Avatar, Badge, Card, KV, Notice, PageHeader, SectionHeader } from "@/components/ui";
import { ProjectSettingsForm } from "@/components/settings-forms";
import { ActionButton, CopyButton } from "@/components/actions";

export const metadata = { title: "Project Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = findProject(db, projectId);
  if (!project) notFound();
  const role = roleInProject(project, user.id);
  const canManage = role === "owner" || role === "admin" || user.role === "owner";
  const readOnly = Boolean(user.isGuest) || !canManage;
  const baseUrl = `https://api.drips.app/v1`;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Settings2 className="h-3 w-3" /> Project configuration</>}
        title="Project Settings"
        description="Manage markets, integrations, API access and client reporting defaults for this project."
        actions={<Badge tone={canManage ? "brand" : "outline"}><ShieldCheck className="h-3 w-3" /> {role ?? "viewer"} access</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <ProjectSettingsForm project={project} readOnly={readOnly} />

          <Card id="integrations">
            <SectionHeader title="Integrations" subtitle="Connect the data sources that power this project" />
            <div className="mt-4 space-y-2.5">
              <div className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky/10 text-sky"><Link2 className="h-4 w-4" /></span>
                    <div>
                      <p className="text-[13px] font-medium">Google Search Console</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">{project.gsc.connected ? project.gsc.property : "Not connected"}</p>
                      <p className="text-[11px] text-faint">{project.gsc.connected ? `Last sync ${fmtRelative(project.gsc.lastSync)} · read-only scope` : "Query, page and device-level performance"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!canManage ? <Badge tone="outline">Admin only</Badge> : project.gsc.connected ? (
                      <>
                        <ActionButton endpoint="/api/integrations/gsc" body={{ projectId: project.id, action: "sync" }} className="btn-soft btn-xs" pendingLabel="Syncing…"><RefreshCw className="h-3 w-3" /> Sync</ActionButton>
                        <ActionButton endpoint="/api/integrations/gsc" body={{ projectId: project.id, action: "disconnect" }} className="btn-danger btn-xs" pendingLabel="…">Disconnect</ActionButton>
                      </>
                    ) : (
                      <ActionButton endpoint="/api/integrations/gsc" body={{ projectId: project.id, action: "connect" }} className="btn-primary btn-xs" pendingLabel="Connecting…"><Plug className="h-3 w-3" /> Connect</ActionButton>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-iris/10 text-iris"><Plug className="h-4 w-4" /></span>
                    <div>
                      <p className="text-[13px] font-medium">WordPress connector</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">{project.wp.connected ? `${project.wp.url} · v${project.wp.version}` : "Not connected"}</p>
                      <p className="text-[11px] text-faint">{project.wp.connected ? `Heartbeat ${fmtRelative(project.wp.lastPing)}` : "Real-time content scoring inside the WP editor"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!canManage ? <Badge tone="outline">Admin only</Badge> : project.wp.connected ? (
                      <>
                        <ActionButton endpoint="/api/integrations/wordpress" body={{ projectId: project.id, action: "ping" }} className="btn-soft btn-xs" pendingLabel="Pinging…"><Zap className="h-3 w-3" /> Ping</ActionButton>
                        <ActionButton endpoint="/api/integrations/wordpress" body={{ projectId: project.id, action: "disconnect" }} className="btn-danger btn-xs" pendingLabel="…">Disconnect</ActionButton>
                      </>
                    ) : (
                      <ActionButton endpoint="/api/integrations/wordpress" body={{ projectId: project.id, action: "connect" }} className="btn-primary btn-xs" pendingLabel="Connecting…"><Plug className="h-3 w-3" /> Connect</ActionButton>
                    )}
                    <Link href={`/${project.id}/wordpress`} className="btn-ghost btn-xs">Setup guide</Link>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand"><Clock className="h-4 w-4" /></span>
                    <div>
                      <p className="text-[13px] font-medium">Daily rank tracking</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">4 engines · Google, mobile, Bing, local pack</p>
                      <p className="text-[11px] text-faint">Pull at 06:00 {project.country} time · on-demand refreshes available</p>
                    </div>
                  </div>
                  <Badge tone="brand">Active</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="API access" subtitle="Programmatic access to this project's data" action={<Badge tone="outline"><KeyRound className="h-3 w-3" /> v1</Badge>} />
            <div className="mt-4 space-y-2.5">
              <div>
                <label className="label">Project API key</label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-line bg-bg/60 px-3 py-2 font-mono text-[11.5px] text-muted">sk_live_{project.id}_••••••••••••••••</code>
                  <CopyButton text={`sk_live_${project.id}_demo_key`} label="Copy" />
                </div>
              </div>
              <div className="rounded-lg border border-line bg-raised/20 p-3 font-mono text-[10.5px] leading-relaxed text-muted">
                <p className="text-faint"># fetch tracked keywords</p>
                <p>curl {baseUrl}/projects/{project.id}/keywords \</p>
                <p className="pl-4">-H &quot;Authorization: Bearer $DRIPS_API_KEY&quot;</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="Your account" subtitle="Signed in via secure session" />
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={user.name} hue={user.hue} size={40} />
              <div>
                <p className="text-[13px] font-medium">{user.name}</p>
                <p className="text-[11.5px] text-muted">{user.email}</p>
              </div>
            </div>
            <div className="mt-4">
              <KV label="Workspace role">{user.role}</KV>
              <KV label="Project role">{role ?? "viewer"}</KV>
              <KV label="Auth">Signed HTTP-only cookie</KV>
              <KV label="Session">30-day expiry</KV>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Plan & usage" subtitle="Agency plan" action={<Badge tone="brand">Pro</Badge>} />
            <ul className="mt-3 space-y-2.5 text-[12px]">
              {[
                { k: "Tracked keywords", v: "10,000 / 25,000" },
                { k: "Crawled pages / mo", v: "42,180 / 100,000" },
                { k: "Projects", v: `${db.projects.length} / 50` },
                { k: "Client seats", v: "unlimited" },
              ].map((u) => (
                <li key={u.k} className="flex items-center justify-between"><span className="text-muted">{u.k}</span><span className="font-medium tabular-nums">{u.v}</span></li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-[11.5px] text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand" /> Daily tracking included — no per-keyword surcharge.
            </div>
          </Card>

          <Card>
            <SectionHeader title="Data & compliance" subtitle="Your data stays yours" />
            <ul className="mt-3 space-y-2 text-[11.5px] text-muted">
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> GDPR-compliant processing with EU/US data residency.</li>
              <li className="flex items-start gap-2"><User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" /> Client seats are read-only by default.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" /> Deleting a project removes crawl history permanently.</li>
            </ul>
            {!readOnly && <button className="btn-danger btn-sm mt-3 w-full">Delete project</button>}
          </Card>
        </div>
      </div>
    </div>
  );
}
