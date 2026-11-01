import { currentWriter, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return fail("Invalid payload.");
  const task = mutate((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return null;
    if (typeof body.status === "string" && ["todo", "in_progress", "review", "done"].includes(body.status)) {
      t.status = body.status as typeof t.status;
    }
    if (typeof body.title === "string") t.title = body.title;
    if (typeof body.description === "string") t.description = body.description;
    if (typeof body.priority === "string") t.priority = body.priority as typeof t.priority;
    if (typeof body.assigneeId === "string") t.assigneeId = body.assigneeId;
    if (typeof body.due === "string") t.due = body.due;
    if (typeof body.tag === "string") t.tag = body.tag;
    return t;
  });
  if (!task) return fail("Task not found.", 404);
  return json({ task });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const ok = mutate((db) => {
    const idx = db.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    db.tasks.splice(idx, 1);
    return true;
  });
  return ok ? json({ ok: true }) : fail("Task not found.", 404);
}
