import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { AppShell, type SearchEntry } from "@/components/shell";
import { fmtRelative } from "@/lib/format";
import { projectKeywords, projectReports, projectDocs, projectCompetitors, projectTasks } from "@/lib/derive";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  const user = await requireUser();
  const db = getDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) notFound();
  const isMember = project.members.some((m) => m.userId === user.id);
  if (!isMember && user.role !== "owner" && user.role !== "admin") redirect("/");

  const accessible = db.projects.filter((p) => p.members.some((m) => m.userId === user.id) || user.role === "owner");

  const pages: SearchEntry[] = [
    { label: "Dashboard", hint: "Overview", href: `/${project.id}`, type: "Page" },
    { label: "Keyword Explorer", hint: "Research", href: `/${project.id}/keywords`, type: "Page" },
    { label: "Competitors", hint: "Research", href: `/${project.id}/competitors`, type: "Page" },
    { label: "Backlinks", hint: "Research", href: `/${project.id}/backlinks`, type: "Page" },
    { label: "Rank Tracker", hint: "Monitoring", href: `/${project.id}/rank-tracker`, type: "Page" },
    { label: "Search Console", hint: "Monitoring", href: `/${project.id}/search-console`, type: "Page" },
    { label: "AI Visibility", hint: "Monitoring", href: `/${project.id}/ai-visibility`, type: "Page" },
    { label: "Site Audits", hint: "Site health", href: `/${project.id}/audits`, type: "Page" },
    { label: "Content Optimizer", hint: "Site health", href: `/${project.id}/content`, type: "Page" },
    { label: "WordPress Connector", hint: "Integrations", href: `/${project.id}/wordpress`, type: "Page" },
    { label: "Reports", hint: "Deliverables", href: `/${project.id}/reports`, type: "Page" },
    { label: "Widgets", hint: "Deliverables", href: `/${project.id}/widgets`, type: "Page" },
    { label: "Tasks", hint: "Team", href: `/${project.id}/tasks`, type: "Page" },
    { label: "Team & Clients", hint: "Team", href: `/${project.id}/team`, type: "Page" },
    { label: "Project Settings", hint: "Team", href: `/${project.id}/settings`, type: "Page" },
  ];

  const keywordEntries: SearchEntry[] = projectKeywords(db, project.id)
    .slice(0, 260)
    .map((k) => ({
      label: k.phrase,
      hint: k.position ? `#${k.position} · ${k.volume.toLocaleString()}/mo` : "Not ranking",
      href: `/${project.id}/keywords?q=${encodeURIComponent(k.phrase)}`,
      type: "Keyword",
    }));

  const competitorEntries: SearchEntry[] = projectCompetitors(db, project.id).map((c) => ({
    label: c.name,
    hint: c.domain,
    href: `/${project.id}/competitors`,
    type: "Competitor",
  }));

  const docEntries: SearchEntry[] = projectDocs(db, project.id).map((d) => ({
    label: d.title,
    hint: `${d.score}/100 · ${d.status}`,
    href: `/${project.id}/content/${d.id}`,
    type: "Content",
  }));

  const reportEntries: SearchEntry[] = projectReports(db, project.id).map((r) => ({
    label: r.name,
    hint: `${r.period} · ${r.status}`,
    href: `/${project.id}/reports/${r.id}`,
    type: "Report",
  }));

  const notifications = db.activity
    .filter((a) => a.projectId === project.id)
    .slice(0, 6)
    .map((a) => {
      const actor = db.users.find((u) => u.id === a.actorId);
      return {
        id: a.id,
        title: `${actor?.name ?? "Someone"} ${a.action}`,
        body: `${a.target} · ${fmtRelative(a.at)}`,
        at: a.at,
      };
    });

  return (
    <AppShell
      user={user}
      projects={accessible.map((p) => ({ id: p.id, name: p.name, domain: p.domain, color: p.color }))}
      project={project}
      searchIndex={[...keywordEntries, ...pages, ...competitorEntries, ...docEntries, ...reportEntries]}
      notifications={notifications}
      openTasks={projectTasks(db, project.id).filter((t) => t.status !== "done").length}
    >
      {children}
    </AppShell>
  );
}
