import { createSession } from "@/lib/auth";
import { json } from "@/lib/api";
import { GUEST_USER_ID, getDb } from "@/lib/store";

/**
 * Starts a shared, read-only guest session so the workspace can be explored
 * without an account. Every write endpoint rejects guest sessions.
 */
export async function POST() {
  await createSession(GUEST_USER_ID);
  const db = getDb();
  const first = db.projects[0];
  return json({ ok: true, guest: true, redirect: first ? `/${first.id}` : "/login" });
}
