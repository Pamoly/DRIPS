import { authenticate, createSession } from "@/lib/auth";
import { fail, json, readJson } from "@/lib/api";
import { getDb } from "@/lib/store";

export async function POST(request: Request) {
  const body = await readJson<{ email?: string; password?: string }>(request);
  if (!body?.email || !body?.password) return fail("Email and password are required.");
  const user = authenticate(body.email, body.password);
  if (!user) return fail("Those credentials do not match a seat in this workspace.", 401);
  await createSession(user.id);
  const db = getDb();
  const project = db.projects.find((p) => p.members.some((m) => m.userId === user.id)) ?? db.projects[0];
  return json({ ok: true, redirect: project ? `/${project.id}` : "/" });
}
