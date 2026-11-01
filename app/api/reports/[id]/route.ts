import { currentWriter, fail, json, readJson } from "@/lib/api";
import { mutate } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return fail("Invalid payload.");
  const report = mutate((db) => {
    const r = db.reports.find((x) => x.id === id);
    if (!r) return null;
    const assignable = ["name", "clientName", "period", "accent", "logoText", "footerNote", "status"] as const;
    for (const key of assignable) {
      const value = body[key];
      if (typeof value === "string") {
        if (key === "status") r.status = value === "published" ? "published" : "draft";
        else if (key === "period") r.period = value as typeof r.period;
        else r[key] = value;
      }
    }
    if (Array.isArray(body.sections)) r.sections = body.sections as string[];
    if (body.schedule && typeof body.schedule === "object") {
      const s = body.schedule as { enabled?: boolean; frequency?: "weekly" | "monthly"; recipients?: string[] };
      r.schedule = {
        enabled: s.enabled ?? r.schedule.enabled,
        frequency: s.frequency ?? r.schedule.frequency,
        recipients: Array.isArray(s.recipients) ? s.recipients : r.schedule.recipients,
        nextRun: (s.enabled ?? r.schedule.enabled) ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
      };
    }
    return r;
  });
  if (!report) return fail("Report not found.", 404);
  return json({ report });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const ok = mutate((db) => {
    const idx = db.reports.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    db.reports.splice(idx, 1);
    return true;
  });
  return ok ? json({ ok: true }) : fail("Report not found.", 404);
}
