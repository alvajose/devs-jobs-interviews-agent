import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ConversationMeta, ConversationRow, UpsertInput } from "./index";

// user_id is filtered explicitly here as defense-in-depth; RLS also enforces ownership.
export async function list(userId: string): Promise<ConversationMeta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function get(userId: string, id: string): Promise<ConversationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at, profile, messages")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConversationRow) ?? null;
}

export async function upsert(userId: string, input: UpsertInput): Promise<ConversationMeta> {
  const supabase = await createClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("conversations")
      .update({ title: input.title, profile: input.profile, messages: input.messages })
      .eq("user_id", userId)
      .eq("id", input.id)
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title: input.title,
      profile: input.profile,
      messages: input.messages,
    })
    .select("id, title, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function remove(userId: string, id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
