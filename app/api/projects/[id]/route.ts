import { guardProject, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardProject(id, "admin");
  if (!guard.ok) return guard.response;
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return json({ error: "Invalid payload" }, 400);
  const project = mutate((db) => {
    const p = db.projects.find((x) => x.id === id)!;
    if (typeof body.name === "string" && body.name.trim()) p.name = body.name.trim();
    if (typeof body.brandColor === "string") p.brandColor = body.brandColor;
    if (typeof body.country === "string") p.country = body.country;
    if (typeof body.language === "string") p.language = body.language;
    if (typeof body.clientReportSchedule === "string") {
      p.clientReportSchedule = body.clientReportSchedule as typeof p.clientReportSchedule;
    }
    if (Array.isArray(body.competitors)) p.competitors = (body.competitors as string[]).slice(0, 8);
    db.activity.unshift({
      id: `a_${Date.now()}`,
      projectId: id,
      actorId: guard.user.id,
      action: "updated project settings",
      target: p.name,
      kind: "team",
      at: new Date().toISOString(),
    });
    return p;
  });
  return json({ project });
}
