import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/app";
  if (next.startsWith("//")) return "/app";
  return next;
}

export function shouldEnforceLegalOnPath(next: string): boolean {
  return !next.startsWith("/auth/");
}

export async function hasAcceptedLegalConsent(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_credits")
    .select("legal_accepted")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return data?.legal_accepted === true;
}

export function legalConsentPath(next: string): string {
  return `/auth/legal-consent?next=${encodeURIComponent(next)}`;
}
