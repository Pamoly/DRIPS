import { currentWriter, fail, json, readJson } from "@/lib/api";
import { getDb, mutate } from "@/lib/store";
import { analyzeContent } from "@/lib/analysis";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const body = await readJson<{
    title?: string; targetKeyword?: string; body?: string; status?: "draft" | "optimized" | "published";
  }>(request);
  if (!body) return fail("Invalid payload.");
  const existing = getDb().contentDocs.find((d) => d.id === id);
  if (!existing) return fail("Document not found.", 404);

  const doc = mutate((db) => {
    const d = db.contentDocs.find((x) => x.id === id)!;
    if (typeof body.title === "string") d.title = body.title;
    if (typeof body.targetKeyword === "string") d.targetKeyword = body.targetKeyword;
    if (typeof body.body === "string") d.body = body.body;
    if (body.status) d.status = body.status;
    const analysis = analyzeContent({ title: d.title, keyword: d.targetKeyword, body: d.body });
    d.score = analysis.score;
    d.wordCount = analysis.wordCount;
    d.updatedAt = new Date().toISOString();
    return d;
  });
  return json({ doc });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const ok = mutate((db) => {
    const idx = db.contentDocs.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    db.contentDocs.splice(idx, 1);
    return true;
  });
  return ok ? json({ ok: true }) : fail("Document not found.", 404);
}
