import type { Usage } from "./llm";

export const TOKENS_PER_CREDIT = 1000;

/** Must match `public.daily_free()` in supabase/migrations/0011_daily_free_credits.sql. */
export const DAILY_FREE_CREDITS = 25;
/** Must match `public.free_cap()` in supabase/migrations/0011_daily_free_credits.sql. */
export const FREE_CREDIT_CAP = 50;

/** Credits to charge for one LLM call. Minimum 1 so every call costs something. */
export function creditsFor(usage: Usage): number {
  const billable = usage.inputMiss + usage.output;
  return Math.max(1, Math.ceil(billable / TOKENS_PER_CREDIT));
}

/** Sum usage across multiple calls in one request (e.g. roadmap + routing). */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputMiss: a.inputMiss + b.inputMiss,
    inputHit: a.inputHit + b.inputHit,
    output: a.output + b.output,
  };
}

export const ZERO_USAGE: Usage = { inputMiss: 0, inputHit: 0, output: 0 };

export type ChargeContext = {
  conversationId?: string | null;
  question?: string | null;
  kind?: "chat" | "roadmap";
  userId?: string | null;
  requestId?: string | null;
};

const MAX_QUESTION_CHARS = 220;

export function normalizeQuestionForReason(question?: string | null): string | undefined {
  if (!question) return undefined;
  const compact = question.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.length > MAX_QUESTION_CHARS
    ? `${compact.slice(0, MAX_QUESTION_CHARS - 1)}…`
    : compact;
}

export function buildReason(context?: ChargeContext): string {
  if (!context) return "llm";
  const conversationId = context.conversationId?.trim();
  const question = normalizeQuestionForReason(context.question);
  const kind = context.kind;
  if (!conversationId && !question && !kind) return "llm";
  const params = new URLSearchParams();
  if (conversationId) params.set("chat", conversationId);
  if (question) params.set("q", question);
  if (kind) params.set("kind", kind);
  return `llm:${params.toString()}`;
}

/** Additional credits to charge after a 1-credit hold. */
export const LLM_RESERVE_CREDITS = 1;

export function additionalCreditsAfterReserve(
  usage: Usage,
  reserved = 1,
): number {
  return Math.max(0, creditsFor(usage) - reserved);
}
