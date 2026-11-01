import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, verifyPassword } from "./store";
import type { SessionUser, User } from "./types";

const COOKIE = "drips_session";

/** Shared read-only identity used by "Continue as guest". */
export const GUEST_USER_ID = "u_guest";
const SECRET = process.env.DRIPS_SECRET ?? "drips-local-development-secret-key";
const MAX_AGE = 60 * 60 * 24 * 30;

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readToken(value: string | undefined): string | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; exp: number };
    if (!data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    hue: user.hue,
    isGuest: user.id === GUEST_USER_ID,
  };
}

/** Guests may browse everything but can never persist changes. */
export function isGuestUser(user: Pick<SessionUser, "id"> | null | undefined): boolean {
  return user?.id === GUEST_USER_ID;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const userId = readToken(store.get(COOKIE)?.value);
  if (!userId) return null;
  const user = getDb().users.find((u) => u.id === userId);
  return user ? toSessionUser(user) : null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    // Opt-in Secure flag: enable behind TLS (production). Left off by default so
    // a production build also works when hosted over plain HTTP on localhost.
    secure: process.env.DRIPS_SECURE_COOKIES === "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export function authenticate(email: string, password: string): User | null {
  const user = getDb().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;
  return verifyPassword(user, password) ? user : null;
}
