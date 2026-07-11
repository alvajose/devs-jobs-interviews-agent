import "server-only";
import type { DatabaseSync } from "node:sqlite";
import type { ConversationMeta, ConversationRow, UpsertInput } from "./index";

// node:sqlite is loaded lazily (dynamic import) so the hosted deploy,  which never calls
// these functions,  doesn't require it to exist in its Node runtime.
let _db: DatabaseSync | null = null;

async function db(): Promise<DatabaseSync> {
  if (_db) return _db;
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  _db = new DatabaseSync(join(dir, "local.db"));
  _db.exec(`CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT NOT NULL DEFAULT 'New roadmap',
    profile    TEXT NOT NULL DEFAULT '{}',
    messages   TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  return _db;
}

export async function list(userId: string): Promise<ConversationMeta[]> {
  const rows = (await db())
    .prepare(
      "SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .all(userId);
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    updated_at: r.updated_at as string,
  }));
}

export async function get(
  userId: string,
  id: string,
): Promise<ConversationRow | null> {
  const row = (await db())
    .prepare(
      "SELECT id, title, updated_at, profile, messages FROM conversations WHERE user_id = ? AND id = ?",
    )
    .get(userId, id);
  if (!row) return null;
  return {
    id: row.id as string,
    title: row.title as string,
    updated_at: row.updated_at as string,
    profile: JSON.parse((row.profile as string) || "{}"),
    messages: JSON.parse((row.messages as string) || "[]"),
  };
}

export async function upsert(
  userId: string,
  input: UpsertInput,
): Promise<ConversationMeta> {
  const now = new Date().toISOString();
  const profile = JSON.stringify(input.profile ?? {});
  const messages = JSON.stringify(input.messages ?? []);
  const conn = await db();

  if (input.id) {
    conn
      .prepare(
        "UPDATE conversations SET title = ?, profile = ?, messages = ?, updated_at = ? WHERE user_id = ? AND id = ?",
      )
      .run(input.title, profile, messages, now, userId, input.id);
    return { id: input.id, title: input.title, updated_at: now };
  }

  const id = crypto.randomUUID();
  conn
    .prepare(
      "INSERT INTO conversations (id, user_id, title, profile, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, userId, input.title, profile, messages, now, now);
  return { id, title: input.title, updated_at: now };
}

export async function remove(userId: string, id: string): Promise<void> {
  (await db())
    .prepare("DELETE FROM conversations WHERE user_id = ? AND id = ?")
    .run(userId, id);
}
