import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate, uid } from "@/lib/store";
import { newActivity } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{
    projectId?: string; title?: string; description?: string; assigneeId?: string; priority?: string; due?: string; tag?: string;
  }>(request);
  if (!body?.projectId || !body.title?.trim()) return fail("A title is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;
  const task = mutate((db) => {
    const created = {
      id: uid("t"),
      projectId: body.projectId!,
      title: body.title!.trim(),
      description: body.description?.trim() || "",
      status: "todo" as const,
      priority: (["low", "medium", "high"].includes(body.priority ?? "") ? body.priority : "medium") as "low" | "medium" | "high",
      assigneeId: body.assigneeId || guard.user.id,
      createdBy: guard.user.id,
      due: body.due ? new Date(body.due).toISOString() : new Date(Date.now() + 7 * 864e5).toISOString(),
      createdAt: new Date().toISOString(),
      tag: body.tag || "General",
    };
    db.tasks.unshift(created);
    db.activity.unshift(newActivity(body.projectId!, guard.user.id, "assigned a task", created.title, "team"));
    return created;
  });
  return json({ task }, 201);
}
