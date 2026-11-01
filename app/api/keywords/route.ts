import { guardProject, json, fail, readJson } from "@/lib/api";
import { mutate, uid } from "@/lib/store";
import { defaultKeywordFor, newActivity } from "@/lib/simulate";
import { randInt, rngFor, round } from "@/lib/rand";
import type { Intent } from "@/lib/types";

export async function POST(request: Request) {
  const body = await readJson<{
    projectId?: string;
    phrase?: string;
    bulk?: string;
    volume?: number;
    difficulty?: number;
    intent?: Intent;
    cluster?: string;
  }>(request);
  if (!body?.projectId) return fail("projectId is required.");
  const guard = await guardProject(body.projectId, "edit");
  if (!guard.ok) return guard.response;

  const phrases = (body.bulk ? body.bulk.split(/[\n,]/) : [body.phrase ?? ""])
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (!phrases.length) return fail("Enter at least one keyword.");

  const result = mutate((db) => {
    const project = db.projects.find((p) => p.id === body.projectId)!;
    const added = [];
    for (const phrase of phrases) {
      if (db.keywords.some((k) => k.projectId === project.id && k.phrase.toLowerCase() === phrase.toLowerCase())) continue;
      const base = defaultKeywordFor(project, phrase);
      if (body.volume) base.volume = Math.max(10, Math.round(body.volume));
      if (body.difficulty) base.difficulty = Math.min(100, Math.max(1, Math.round(body.difficulty)));
      if (body.intent) base.intent = body.intent;
      if (body.cluster) base.cluster = body.cluster;
      if (!body.volume && !body.difficulty) {
        const rng = rngFor("kw-opts", project.id, phrase);
        base.cpc = round(0.3 + rng() * 6, 2);
      }
      base.cluster = base.cluster === "Uncategorised" ? "New additions" : base.cluster;
      db.keywords.unshift(base);
      added.push(base);
    }
    if (added.length) {
      db.activity.unshift(newActivity(project.id, guard.user.id, "tracked new keywords", `+${added.length} keywords`, "keyword"));
    }
    return added;
  });
  return json({ keywords: result, added: result.length, skipped: phrases.length - result.length }, 201);
}
