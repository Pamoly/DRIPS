import { currentWriter, fail, json, readJson } from "@/lib/api";
import { mutate, uid } from "@/lib/store";

export async function POST(request: Request) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const body = await readJson<{ projectId?: string; entityType?: string; entityId?: string; text?: string }>(request);
  if (!body?.projectId || !body.text?.trim() || !body.entityId) return fail("Comment text is required.");
  const comment = mutate((db) => {
    const created = {
      id: uid("c"),
      projectId: body.projectId!,
      entityType: (["audit", "page", "report", "content"].includes(body.entityType ?? "") ? body.entityType : "content") as
        | "audit" | "page" | "report" | "content",
      entityId: body.entityId!,
      userId: user.id,
      text: body.text!.trim(),
      at: new Date().toISOString(),
    };
    db.comments.unshift(created);
    return created;
  });
  return json({ comment }, 201);
}
