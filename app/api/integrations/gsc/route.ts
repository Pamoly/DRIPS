import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";
import { newActivity } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string; action?: "connect" | "disconnect" | "sync"; property?: string }>(request);
  if (!body?.projectId || !body.action) return fail("projectId and action are required.");
  const guard = await guardProject(body.projectId, "admin");
  if (!guard.ok) return guard.response;
  const project = mutate((db) => {
    const p = db.projects.find((x) => x.id === body.projectId)!;
    if (body.action === "connect") {
      p.gsc.connected = true;
      p.gsc.property = body.property || `sc-domain:${p.domain}`;
      p.gsc.lastSync = new Date().toISOString();
      db.activity.unshift(newActivity(p.id, guard.user.id, "connected Search Console", p.gsc.property, "integration"));
    } else if (body.action === "disconnect") {
      p.gsc.connected = false;
      p.gsc.lastSync = null;
      db.activity.unshift(newActivity(p.id, guard.user.id, "disconnected Search Console", p.domain, "integration"));
    } else {
      p.gsc.lastSync = new Date().toISOString();
      db.activity.unshift(newActivity(p.id, guard.user.id, "synced Search Console", "28 days of query data", "integration"));
    }
    return p;
  });
  return json({ project });
}
