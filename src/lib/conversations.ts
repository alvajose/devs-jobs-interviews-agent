import type { ChatMsg, Profile } from "@/lib/types";

export interface ConversationMeta {
  id: string;
  title: string;
  updated_at: string;
}

export interface Conversation extends ConversationMeta {
  profile: Partial<Profile>;
  messages: ChatMsg[];
}

/** Title shown in the history list: first user message, else role, truncated. */
export function deriveTitle(messages: ChatMsg[], profile: Partial<Profile>): string {
  const firstUser = messages.find((m) => m.role === "user")?.text?.trim();
  const base = firstUser || profile.role?.trim() || "New roadmap";
  return base.length > 60 ? base.slice(0, 60).trimEnd() + "…" : base;
}

// Persistence goes through /api/conversations, which is backed by SQLite (local mode) or
// Supabase (hosted). The browser no longer talks to any database directly.
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/conversations${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export async function listConversations(): Promise<ConversationMeta[]> {
  const { conversations } = await api<{ conversations: ConversationMeta[] }>("");
  return conversations ?? [];
}

export async function getConversation(id: string): Promise<Conversation> {
  const { conversation } = await api<{ conversation: Conversation }>(
    `/${encodeURIComponent(id)}`,
  );
  return conversation;
}

/** Insert (id null) or update an existing conversation. Returns the saved row meta. */
export async function upsertConversation(input: {
  id: string | null;
  title: string;
  profile: Partial<Profile>;
  messages: ChatMsg[];
}): Promise<ConversationMeta> {
  const { conversation } = await api<{ conversation: ConversationMeta }>("", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  await api(`/${encodeURIComponent(id)}`, { method: "DELETE" });
}
