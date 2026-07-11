import "server-only";
import { captureException, logError, logWarn } from "@/lib/observability";

type SpendCreditsFailureInput = {
  requestId?: string;
  userId?: string;
  amount: number;
  reason: string;
  errorMessage: string;
};

export async function alertSpendCreditsFailure(input: SpendCreditsFailureInput): Promise<void> {
  const payload = {
    request_id: input.requestId ?? null,
    user_id: input.userId ?? null,
    amount: input.amount,
    reason: input.reason,
    error_message: input.errorMessage,
  };

  logError("billing.spend_credits_failed", payload);
  captureException(new Error(`spend_credits failed: ${input.errorMessage}`), payload);

  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "spend_credits_failure",
        ...payload,
      }),
    });
    if (!response.ok) {
      logWarn("billing.alert_webhook_failed", {
        request_id: input.requestId ?? null,
        status: response.status,
      });
    }
  } catch (error) {
    logWarn("billing.alert_webhook_exception", {
      request_id: input.requestId ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
