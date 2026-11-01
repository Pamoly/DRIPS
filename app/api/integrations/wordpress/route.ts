import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";
import { newActivity } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string; action?: "connect" | "disconnect" | "ping"; url?: string }>(request);
  if (!body?.projectId || !body.action) return fail("projectId and action are required.");
  const guard = await guardProject(body.projectId, "admin");
  if (!guard.ok) return guard.response;
  const project = mutate((db) => {
    const p = db.projects.find((x) => x.id === body.projectId)!;
    if (body.action === "connect") {
      p.wp = { connected: true, url: body.url || `https://${p.domain}`, version: "1.8.2", lastPing: new Date().toISOString() };
      db.activity.unshift(newActivity(p.id, guard.user.id, "installed WordPress connector", p.wp.url!, "integration"));
    } else if (body.action === "disconnect") {
      p.wp = { connected: false, url: null, version: null, lastPing: null };
      db.activity.unshift(newActivity(p.id, guard.user.id, "removed WordPress connector", p.domain, "integration"));
    } else {
      p.wp.lastPing = new Date().toISOString();
    }
    return p;
  });
  return json({ project });
}
