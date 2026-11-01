import { guardProject, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";
import { newActivity } from "@/lib/simulate";
import { randInt, rngFor } from "@/lib/rand";

export async function POST(request: Request) {
  const body = await readJson<{ projectId?: string; action?: "scan" }>(request);
  if (!body?.projectId) return fail("projectId is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;
  const updated = mutate((db) => {
    const prompts = db.aiPrompts.filter((p) => p.projectId === body.projectId);
    prompts.forEach((p, i) => {
      const rng = rngFor("ai-scan", p.id, Date.now());
      const mentioned = rng() > 0.4;
      p.mentioned = mentioned;
      p.position = mentioned ? randInt(rng, 1, 7) : null;
      p.sentiment = mentioned ? (rng() > 0.24 ? "positive" : "neutral") : "absent";
      p.updatedAt = new Date().toISOString();
      if (i % 4 === 0) p.volume = Math.max(100, Math.round(p.volume * (0.92 + rng() * 0.18) / 100) * 100);
    });
    db.activity.unshift(newActivity(body.projectId!, guard.user.id, "re-ran AI visibility scan", `${prompts.length} prompts across 5 engines`, "ranking"));
    return prompts.length;
  });
  return json({ ok: true, prompts: updated, scannedAt: new Date().toISOString() });
}
