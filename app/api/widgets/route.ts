import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate, token } from "@/lib/store";
import { newActivity } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string; name?: string; type?: string; theme?: string; accent?: string }>(request);
  if (!body?.projectId) return fail("projectId is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;
  const types = ["authority", "rank_snapshot", "keywords", "audit_score", "local_grid"];
  const type = types.includes(body.type ?? "") ? (body.type as string) : "rank_snapshot";
  const widget = mutate((db) => {
    const created = {
      id: `w_${Date.now().toString(36)}`,
      projectId: body.projectId!,
      publicToken: token("wgt"),
      name: body.name?.trim() || "Untitled widget",
      type: type as "authority" | "rank_snapshot" | "keywords" | "audit_score" | "local_grid",
      theme: (body.theme === "light" ? "light" : body.theme === "auto" ? "auto" : "dark") as "light" | "dark" | "auto",
      accent: body.accent ?? "#4ADE80",
      createdAt: new Date().toISOString(),
    };
    db.widgets.unshift(created);
    db.activity.unshift(newActivity(body.projectId!, guard.user.id, "created embeddable widget", created.name, "report"));
    return created;
  });
  return json({ widget }, 201);
}
