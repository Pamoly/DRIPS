import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate, token } from "@/lib/store";
import { newActivity } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{
    projectId?: string;
    name?: string;
    clientName?: string;
    period?: "Last 7 days" | "Last 30 days" | "Last 90 days";
    sections?: string[];
    accent?: string;
    logoText?: string;
    footerNote?: string;
  }>(request);
  if (!body?.projectId) return fail("projectId is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;
  const report = mutate((db) => {
    const project = db.projects.find((p) => p.id === body.projectId)!;
    const created = {
      id: `rep_${Date.now().toString(36)}`,
      projectId: project.id,
      publicToken: token("rpt"),
      name: body.name?.trim() || "Client performance report",
      clientName: body.clientName?.trim() || project.name,
      period: body.period ?? "Last 30 days",
      sections: body.sections?.length ? body.sections : ["visibility", "rankings", "gsc", "keywords", "audits", "backlinks"],
      accent: body.accent ?? project.brandColor,
      logoText: body.logoText?.trim() || project.name,
      footerNote: body.footerNote?.trim() || "Prepared by DRIPS · Confidential",
      status: "draft" as const,
      schedule: { enabled: false, frequency: "monthly" as const, recipients: [], nextRun: null },
      createdAt: new Date().toISOString(),
      lastSent: null,
    };
    db.reports.unshift(created);
    db.activity.unshift(newActivity(project.id, guard.user.id, "created report", created.name, "report"));
    return created;
  });
  return json({ report }, 201);
}
