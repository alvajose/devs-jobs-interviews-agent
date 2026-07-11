import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Use ONLY server-side, never with a user session
// (e.g. the Stripe webhook, which has no cookies). Requires SUPABASE_SERVICE_ROLE_KEY.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
