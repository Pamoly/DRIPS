import { guardProject, json, fail, readJson, currentUser, currentWriter } from "@/lib/api";
import { getDb, mutate, uid } from "@/lib/store";
import type { Project } from "@/lib/types";
import { slugify } from "@/lib/rand";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  const db = getDb();
  const projects = db.projects.filter((p) => p.members.some((m) => m.userId === user.id) || user.role === "owner");
  return json({ projects });
}

export async function POST(request: Request) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const body = await readJson<{ name?: string; domain?: string; country?: string }>(request);
  if (!body?.name?.trim() || !body?.domain?.trim()) return fail("Project name and domain are required.");
  const domain = body.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();
  const name = body.name.trim();
  const countries: Record<string, { code: string; language: string }> = {
    "United Kingdom": { code: "GB", language: "English" },
    Canada: { code: "CA", language: "English" },
    Australia: { code: "AU", language: "English" },
    Germany: { code: "DE", language: "German" },
    Netherlands: { code: "NL", language: "Dutch" },
    France: { code: "FR", language: "French" },
    Spain: { code: "ES", language: "Spanish" },
  };
  const country = body.country && countries[body.country] ? body.country : "United States";
  const meta = countries[country] ?? { code: "US", language: "English" };

  const project = mutate((db) => {
    let id = slugify(name) || "project";
    let i = 2;
    while (db.projects.some((p) => p.id === id)) id = `${slugify(name)}-${i++}`;
    const colors = ["#4ADE80", "#818CF8", "#FBBF24", "#38BDF8", "#FB7185", "#A78BFA"];
    const created: Project = {
      id,
      name,
      domain,
      color: colors[db.projects.length % colors.length],
      country,
      countryCode: meta.code,
      language: meta.language,
      createdAt: new Date().toISOString(),
      members: [{ userId: user.id, role: "owner" }],
      competitors: [],
      gsc: { connected: false, property: `sc-domain:${domain}`, lastSync: null },
      wp: { connected: false, url: null, version: null, lastPing: null },
      clientReportSchedule: "monthly",
      brandColor: colors[db.projects.length % colors.length],
    };
    db.projects.push(created);
    db.activity.unshift({
      id: uid("a"),
      projectId: id,
      actorId: user.id,
      action: "created project",
      target: `${name} (${domain})`,
      kind: "team",
      at: new Date().toISOString(),
    });
    return created;
  });
  return json({ project }, 201);
}
