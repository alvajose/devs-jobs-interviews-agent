import "server-only";
import type { ChatMsg, Profile } from "@/lib/types";
import { isLocal } from "@/lib/mode";
import * as sqlite from "./sqlite-conversations";
import * as supabase from "./supabase-conversations";

export type ConversationMeta = { id: string; title: string; updated_at: string };
export type ConversationRow = ConversationMeta & {
  profile: Partial<Profile>;
  messages: ChatMsg[];
};
export type UpsertInput = {
  id: string | null;
  title: string;
  profile: Partial<Profile>;
  messages: ChatMsg[];
};

// Persistence for conversations, scoped by userId. Two implementations behind one shape:
// SQLite (local) and Supabase (hosted). The API routes pick via conversationStore().
export interface ConversationStore {
  list(userId: string): Promise<ConversationMeta[]>;
  get(userId: string, id: string): Promise<ConversationRow | null>;
  upsert(userId: string, input: UpsertInput): Promise<ConversationMeta>;
  remove(userId: string, id: string): Promise<void>;
}

export function conversationStore(): ConversationStore {
  return isLocal() ? sqlite : supabase;
}
