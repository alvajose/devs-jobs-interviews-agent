import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

const LLM_USER_LIMIT = Number(process.env.LLM_RATE_LIMIT_USER ?? 8);
const LLM_IP_LIMIT = Number(process.env.LLM_RATE_LIMIT_IP ?? 20);
const LLM_WINDOW_SECONDS = Number(process.env.LLM_RATE_LIMIT_WINDOW_SEC ?? 60);
// Global circuit breaker across ALL users/IPs in the window. 0 = disabled (default).
const LLM_GLOBAL_LIMIT = Number(process.env.LLM_RATE_LIMIT_GLOBAL ?? 0);

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "saturated"; retryAfterSec: number };

export async function enforceLlmRateLimit(
  supabase: SupabaseClient,
  req: Request,
  route: "/api/chat" | "/api/roadmap",
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("try_log_llm_request", {
    p_route: route,
    p_ip: clientIp(req),
    p_user_limit: LLM_USER_LIMIT,
    p_ip_limit: LLM_IP_LIMIT,
    p_window_seconds: LLM_WINDOW_SECONDS,
    p_global_limit: LLM_GLOBAL_LIMIT,
  });

  // Fail open on RPC errors so a migration lag does not brick the app.
  if (error) return { ok: true };
  if (data === "saturated") {
    return { ok: false, reason: "saturated", retryAfterSec: LLM_WINDOW_SECONDS };
  }
  if (data === "rate_limited") {
    return { ok: false, reason: "rate_limited", retryAfterSec: LLM_WINDOW_SECONDS };
  }
  return { ok: true }; // "ok" (or any legacy truthy value from a pre-0010 DB)
}

export {
  MAX_CHAT_MESSAGES,
  MAX_CHAT_TOTAL_CHARS,
  MAX_MESSAGE_TEXT_CHARS,
  MAX_PROFILE_FIELD_CHARS,
  MAX_ROADMAP_TARGET_CHARS,
  validateChatPayload,
  validateProfileField,
  validateRoadmapPayload,
} from "./payload-limits";

export type { PayloadLimitError, PayloadLimitOk } from "./payload-limits";
