import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate, uid } from "@/lib/store";
import { analyzeContent } from "@/lib/analysis";
import { newActivity } from "@/lib/simulate";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string; title?: string; targetKeyword?: string; body?: string }>(request);
  if (!body?.projectId) return fail("projectId is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;
  const title = body.title?.trim() || "Untitled draft";
  const keyword = body.targetKeyword?.trim() || "";
  const content = body.body ?? "";
  const analysis = analyzeContent({ title, keyword, body: content });
  const doc = mutate((db) => {
    const created = {
      id: uid("doc"),
      projectId: body.projectId!,
      title,
      targetKeyword: keyword,
      body: content,
      status: "draft" as const,
      score: analysis.score,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorId: guard.user.id,
      wordCount: analysis.wordCount,
    };
    db.contentDocs.unshift(created);
    db.activity.unshift(newActivity(body.projectId!, guard.user.id, "started a content draft", title, "content"));
    return created;
  });
  return json({ doc }, 201);
}
