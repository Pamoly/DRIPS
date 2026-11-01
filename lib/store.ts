import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildDatabase } from "./seed";
import type { Database, Project, Role, User } from "./types";
import { range } from "./rand";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

export const DEMO_PASSWORD = "drips2026";

/** Shared read-only identity behind "Continue as guest". */
export const GUEST_USER_ID = "u_guest";

const GUEST_USER: User = {
  id: GUEST_USER_ID,
  name: "Guest Explorer",
  email: "guest@drips.app",
  role: "viewer",
  title: "Guest · read-only demo",
  hue: 190,
  lastActive: new Date().toISOString(),
};

let cache: Database | null = null;

function passwordHash(userId: string, password: string): string {
  return crypto.scryptSync(password, `drips:${userId}`, 32).toString("hex");
}

/**
 * Guarantees the guest identity exists and has read-only (viewer) access to every
 * project. Runs for both fresh seeds and previously persisted databases.
 */
function ensureGuest(db: Database): Database {
  let changed = false;
  const existing = db.users.find((u) => u.id === GUEST_USER_ID);
  if (!existing) {
    db.users.push({ ...GUEST_USER, lastActive: new Date().toISOString() });
    changed = true;
  } else {
    existing.role = "viewer";
    existing.title = GUEST_USER.title;
  }
  for (const project of db.projects) {
    if (!project.members.some((m) => m.userId === GUEST_USER_ID)) {
      project.members.push({ userId: GUEST_USER_ID, role: "viewer" });
      changed = true;
    }
  }
  if (changed) writeDb(db);
  return db;
}

function hydratePasswords(db: Database): Database {
  let changed = false;
  for (const user of db.users) {
    if (!user.passwordHash) {
      user.passwordHash = passwordHash(user.id, DEMO_PASSWORD);
      changed = true;
    }
  }
  if (changed) writeDb(db);
  return db;
}

function readDb(): Database {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return ensureGuest(JSON.parse(raw) as Database);
  } catch {
    const fresh = buildDatabase();
    writeDb(fresh);
    return ensureGuest(fresh);
  }
}

function writeDb(db: Database) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_PATH);
}

export function getDb(): Database {
  if (!cache) cache = hydratePasswords(readDb());
  return cache;
}

export function saveDb(db: Database) {
  cache = db;
  writeDb(db);
}

/** Apply a mutation and persist. Returns whatever the mutator returns. */
export function mutate<T>(fn: (db: Database) => T): T {
  const db = getDb();
  const result = fn(db);
  saveDb(db);
  return result;
}

export function verifyPassword(user: User, password: string): boolean {
  if (!user.passwordHash) return password === DEMO_PASSWORD;
  const candidate = passwordHash(user.id, password);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function getProject(id: string): Project | undefined {
  return getDb().projects.find((p) => p.id === id);
}

export function canAccessProject(project: Project, userId: string): boolean {
  return project.members.some((m) => m.userId === userId);
}

export function roleInProject(project: Project, userId: string): Role | null {
  return project.members.find((m) => m.userId === userId)?.role ?? null;
}

export function canEdit(project: Project, userId: string): boolean {
  const role = roleInProject(project, userId);
  return role === "owner" || role === "admin" || role === "editor";
}

export function canAdmin(project: Project, userId: string): boolean {
  const role = roleInProject(project, userId);
  return role === "owner" || role === "admin";
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function token(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/** Projects a guest is allowed to open (all of them). */
export function guestProjects(): Project[] {
  return getDb().projects;
}

export function ensureDemoDocScores() {
  // no-op helper kept for future migrations
  return range(1).length;
}
