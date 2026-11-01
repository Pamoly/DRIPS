import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";
import { newActivity, refreshRankings } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string }>(request);
  if (!body?.projectId) return fail("projectId is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;
  const changed = mutate((db) => {
    const keywords = db.keywords.filter((k) => k.projectId === body.projectId);
    const count = refreshRankings(keywords, `${Date.now()}`);
    db.projects.find((p) => p.id === body.projectId)!.gsc.lastSync = new Date().toISOString();
    db.activity.unshift(newActivity(body.projectId!, guard.user.id, "refreshed SERP data", `${count} keyword positions updated`, "ranking"));
    return count;
  });
  return json({ ok: true, updated: changed, at: new Date().toISOString() });
}
