import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import { canAdmin, canEdit, getProject } from "./store";
import type { Project, SessionUser } from "./types";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function currentUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export const GUEST_READ_ONLY_MESSAGE =
  "Guest mode is read-only. Sign in with a demo seat to save changes.";

export function guestReadOnly() {
  return fail(GUEST_READ_ONLY_MESSAGE, 403);
}

type WriterResult = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

/**
 * Session required AND the caller must be a real account (guests are read-only).
 * Use this instead of `currentUser()` in every mutating route.
 */
export async function currentWriter(): Promise<WriterResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: fail("You must be signed in.", 401) };
  if (user.isGuest) return { ok: false, response: guestReadOnly() };
  return { ok: true, user };
}

type GuardResult =
  | { ok: true; user: SessionUser; project: Project }
  | { ok: false; response: NextResponse };

export async function guardProject(projectId: string, level: "view" | "edit" | "admin" = "view"): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: fail("You must be signed in.", 401) };
  if (level !== "view" && user.isGuest) return { ok: false, response: guestReadOnly() };
  const project = getProject(projectId);
  if (!project) return { ok: false, response: fail("Project not found.", 404) };
  const isMember = project.members.some((m) => m.userId === user.id);
  const globalAdmin = user.role === "owner" || user.role === "admin";
  if (!isMember && !globalAdmin) return { ok: false, response: fail("You do not have access to this project.", 403) };
  if (level === "edit" && !(canEdit(project, user.id) || globalAdmin)) {
    return { ok: false, response: fail("Your role cannot make changes in this project.", 403) };
  }
  if (level === "admin" && !(canAdmin(project, user.id) || user.role === "owner")) {
    return { ok: false, response: fail("Admin role required.", 403) };
  }
  return { ok: true, user, project };
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
