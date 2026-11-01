import { currentWriter, fail, json } from "@/lib/api";
import { mutate } from "@/lib/store";
import { newActivity } from "@/lib/simulate";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentWriter();
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;
  const report = mutate((db) => {
    const r = db.reports.find((x) => x.id === id);
    if (!r) return null;
    r.lastSent = new Date().toISOString();
    r.status = "published";
    r.schedule.nextRun = new Date(Date.now() + (r.schedule.frequency === "weekly" ? 7 : 30) * 864e5).toISOString();
    db.activity.unshift(newActivity(r.projectId, user.id, "sent client report", r.name, "report"));
    return r;
  });
  if (!report) return fail("Report not found.", 404);
  return json({ ok: true, report });
}
