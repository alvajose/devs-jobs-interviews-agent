import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Usage } from "./llm";
import { alertSpendCreditsFailure } from "@/lib/alerts";
import {
  LLM_RESERVE_CREDITS,
  additionalCreditsAfterReserve,
  buildReason,
  type ChargeContext,
} from "./credits-math";

export {
  TOKENS_PER_CREDIT,
  creditsFor,
  addUsage,
  ZERO_USAGE,
  buildReason,
  LLM_RESERVE_CREDITS,
  type ChargeContext,
} from "./credits-math";

function isInsufficientCredits(errorMessage: string | undefined): boolean {
  return Boolean(errorMessage?.includes("insufficient_credits"));
}

/**
 * Effective available credits for the signed-in user: this month's free bucket + never-expiring
 * paid balance. Computed in the DB (available_credits) so the monthly reset lives in one place.
 */
export async function getBalance(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.rpc("available_credits");
  return typeof data === "number" ? data : 0;
}

/**
 * Hold one credit before calling the LLM. Concurrent requests serialize on the user's row
 * and fail closed when the effective balance is too low.
 */
export async function reserveForLlm(
  supabase: SupabaseClient,
  context?: ChargeContext,
): Promise<{ ok: true } | { ok: false }> {
  const reason = `llm:hold:${context?.requestId ?? "unknown"}`;
  const { error } = await supabase.rpc("reserve_credits", {
    p_amount: LLM_RESERVE_CREDITS,
    p_reason: reason,
  });
  if (error && isInsufficientCredits(error.message)) return { ok: false };
  if (error) {
    await alertSpendCreditsFailure({
      requestId: context?.requestId ?? undefined,
      userId: context?.userId ?? undefined,
      amount: LLM_RESERVE_CREDITS,
      reason,
      errorMessage: error.message,
    });
    return { ok: false };
  }
  return { ok: true };
}

/** Return a held credit when the LLM call fails after reservation. */
export async function releaseLlmReserve(
  supabase: SupabaseClient,
  context?: ChargeContext,
): Promise<void> {
  const reason = `llm:release:${context?.requestId ?? "unknown"}`;
  const { error } = await supabase.rpc("refund_credits", {
    p_amount: LLM_RESERVE_CREDITS,
    p_reason: reason,
  });
  if (error) {
    await alertSpendCreditsFailure({
      requestId: context?.requestId ?? undefined,
      userId: context?.userId ?? undefined,
      amount: -LLM_RESERVE_CREDITS,
      reason,
      errorMessage: error.message,
    });
  }
}

async function spendCredits(
  supabase: SupabaseClient,
  amount: number,
  reason: string,
  context?: ChargeContext,
): Promise<void> {
  if (amount <= 0) return;
  const { error } = await supabase.rpc("spend_credits", {
    p_amount: amount,
    p_reason: reason,
  });
  if (error) {
    await alertSpendCreditsFailure({
      requestId: context?.requestId ?? undefined,
      userId: context?.userId ?? undefined,
      amount,
      reason,
      errorMessage: error.message,
    });
  }
}

/**
 * Settle a completed LLM call: one credit was reserved up front; charge any remainder based
 * on real token usage.
 */
export async function settleLlmCharge(
  supabase: SupabaseClient,
  usage: Usage,
  context?: ChargeContext,
  reserved = LLM_RESERVE_CREDITS,
): Promise<void> {
  const additional = additionalCreditsAfterReserve(usage, reserved);
  await spendCredits(supabase, additional, buildReason(context), context);
}
