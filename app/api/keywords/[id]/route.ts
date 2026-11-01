import { currentWriter, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const body = await readJson<{ tracked?: boolean; tags?: string[]; cluster?: string; position?: number | null }>(request);
  if (!body) return fail("Invalid payload.");
  const result = mutate((db) => {
    const kw = db.keywords.find((k) => k.id === id);
    if (!kw) return null;
    if (typeof body.tracked === "boolean") kw.tracked = body.tracked;
    if (Array.isArray(body.tags)) kw.tags = body.tags;
    if (typeof body.cluster === "string") kw.cluster = body.cluster;
    if (body.position !== undefined) {
      kw.prevPosition = kw.position;
      kw.position = body.position;
      if (body.position !== null && body.position < kw.bestPosition) kw.bestPosition = body.position;
    }
    return kw;
  });
  if (!result) return fail("Keyword not found.", 404);
  return json({ keyword: result });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const ok = mutate((db) => {
    const idx = db.keywords.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    db.keywords.splice(idx, 1);
    return true;
  });
  return ok ? json({ ok: true }) : fail("Keyword not found.", 404);
}
