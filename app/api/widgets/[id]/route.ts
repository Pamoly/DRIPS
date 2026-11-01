import { currentWriter, fail, json } from "@/lib/api";
import { mutate } from "@/lib/store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const ok = mutate((db) => {
    const idx = db.widgets.findIndex((w) => w.id === id);
    if (idx === -1) return false;
    db.widgets.splice(idx, 1);
    return true;
  });
  return ok ? json({ ok: true }) : fail("Widget not found.", 404);
}
