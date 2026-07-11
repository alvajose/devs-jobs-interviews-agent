import "server-only";
import { isLocal } from "./mode";
import { createClient } from "./supabase/server";

export type SessionUser = { id: string; email: string | null };

// Local mode has no login: everything belongs to one implicit user.
export const LOCAL_USER: SessionUser = { id: "local", email: null };

/** The current user, mode-agnostic. Local: always the implicit user. Hosted: Supabase session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (isLocal()) return LOCAL_USER;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
