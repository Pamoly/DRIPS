import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Lightweight readiness probe for containers / uptime checks. */
export async function GET() {
  try {
    const db = getDb();
    return Response.json({
      status: "ok",
      version: "1.0.0",
      env: process.env.NODE_ENV ?? "development",
      uptimeSeconds: Math.round(process.uptime()),
      counts: {
        users: db.users.length,
        projects: db.projects.length,
        keywords: db.keywords.length,
        audits: db.audits.length,
        reports: db.reports.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { status: "error", message: error instanceof Error ? error.message : "unknown error" },
      { status: 500 },
    );
  }
}
