import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate, uid } from "@/lib/store";
import { newActivity } from "@/lib/simulate";
import type { Role } from "@/lib/types";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string; email?: string; name?: string; role?: Role }>(request);
  if (!body?.projectId || !body.email?.trim()) return fail("An email address is required.");
  const guard = await guardProject(body.projectId, "admin");
  if (!guard.ok) return guard.response;
  const email = body.email.trim().toLowerCase();
  const role: Role = ["owner", "admin", "editor", "viewer"].includes(body.role ?? "") ? (body.role as Role) : "editor";

  const result = mutate((db) => {
    const project = db.projects.find((p) => p.id === body.projectId)!;
    let user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      const name = body.name?.trim() || email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      user = {
        id: uid("u"),
        name,
        email,
        role: role === "owner" ? "admin" : role,
        title: role === "viewer" ? "Client stakeholder" : "Team member",
        hue: Math.floor(Math.random() * 360),
        lastActive: new Date().toISOString(),
      };
      db.users.push(user);
    }
    if (project.members.some((m) => m.userId === user!.id)) return { alreadyMember: true, user };
    project.members.push({ userId: user.id, role });
    db.activity.unshift(newActivity(project.id, guard.user.id, "invited teammate", `${user.name} as ${role}`, "team"));
    return { alreadyMember: false, user };
  });
  return json(result, result.alreadyMember ? 200 : 201);
}
