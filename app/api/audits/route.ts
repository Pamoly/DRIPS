import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate, uid } from "@/lib/store";
import { newActivity, runAudit } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string; startUrl?: string }>(request);
  if (!body?.projectId) return fail("projectId is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;

  const seedKey = `${Date.now()}`;
  const audit = mutate((db) => {
    const project = db.projects.find((p) => p.id === body.projectId)!;
    const keywords = db.keywords.filter((k) => k.projectId === project.id);
    const created = runAudit(project, keywords, body.startUrl || `https://${project.domain}`, guard.user.id, seedKey);
    db.audits.unshift(created);
    db.activity.unshift(newActivity(project.id, guard.user.id, "completed site audit", `${created.name} · score ${created.score}`, "audit"));
    return created;
  });
  return json({ audit }, 201);
}
