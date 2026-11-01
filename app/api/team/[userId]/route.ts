import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";
import type { Role } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const body = await readJson<{ projectId?: string; role?: Role }>(request);
  if (!body?.projectId || !body.role) return fail("projectId and role are required.");
  const guard = await guardProject(body.projectId, "admin");
  if (!guard.ok) return guard.response;
  const member = mutate((db) => {
    const project = db.projects.find((p) => p.id === body.projectId)!;
    const m = project.members.find((x) => x.userId === userId);
    if (!m) return null;
    m.role = body.role!;
    return m;
  });
  if (!member) return fail("Member not found.", 404);
  return json({ member });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return fail("projectId is required.");
  const guard = await guardProject(projectId, "admin");
  if (!guard.ok) return guard.response;
  if (userId === guard.user.id) return fail("You cannot remove your own seat.");
  const ok = mutate((db) => {
    const project = db.projects.find((p) => p.id === projectId)!;
    const idx = project.members.findIndex((m) => m.userId === userId);
    if (idx === -1) return false;
    project.members.splice(idx, 1);
    return true;
  });
  return ok ? json({ ok: true }) : fail("Member not found.", 404);
}
