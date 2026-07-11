// DISABLED for now: Stripe payments are off (no merchant/tax setup yet). Kept for the future;
// inert without STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET.
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocal } from "@/lib/mode";
import { trackProductEvent } from "@/lib/analytics";
import {
  captureException,
  errorDetails,
  getRequestId,
  jsonWithRequestId,
  logError,
  logInfo,
  requestContext,
} from "@/lib/observability";

// Node runtime: we need the raw request body for Stripe signature verification.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  logInfo("api.stripe.webhook.request_received", reqContext);
  if (isLocal()) return respond({ error: "Not available in local mode." }, 404);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return respond({ error: "Stripe is not configured." }, 500);
  }

  try {
    const stripe = new Stripe(stripeKey);
    const signature = req.headers.get("stripe-signature");
    const raw = await req.text();

    let event: Stripe.Event;
    try {
      // constructEventAsync uses Web Crypto, safe on serverless/edge-style runtimes.
      event = await stripe.webhooks.constructEventAsync(raw, signature ?? "", webhookSecret);
    } catch (error) {
      logInfo("api.stripe.webhook.invalid_signature", {
        ...reqContext,
        ...errorDetails(error),
      });
      return respond({ error: `Signature verification failed: ${(error as Error).message}` }, 400);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = Number(session.metadata?.credits);

      if (userId && credits > 0 && session.payment_status === "paid") {
        const admin = createAdminClient();
        // Idempotent on session.id, Stripe may deliver this event more than once.
        const { error } = await admin.rpc("grant_credits", {
          p_user: userId,
          p_amount: credits,
          p_ref: session.id,
        });
        if (error) {
          return respond({ error: error.message }, 500); // let Stripe retry
        }

        const { count: purchaseCount } = await admin
          .from("credit_transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("reason", "purchase");

        const firstPurchase = purchaseCount === 1;
        void trackProductEvent({
          event: "purchase_completed",
          distinctId: userId,
          insertId: `purchase:${session.id}`,
          properties: {
            request_id: requestId,
            credits,
            source: "stripe_webhook",
            first_purchase: firstPurchase,
          },
        });

        if (firstPurchase) {
          void trackProductEvent({
            event: "funnel_first_purchase_completed",
            distinctId: userId,
            insertId: `funnel:first-purchase:${userId}`,
            properties: {
              request_id: requestId,
              source: "stripe_webhook",
              credits,
            },
          });
        }

        logInfo("api.stripe.webhook.credits_granted", {
          ...reqContext,
          user_id: userId,
          credits,
          session_id: session.id,
        });
      }
    }

    return respond({ received: true });
  } catch (error) {
    logError("api.stripe.webhook.unhandled_error", {
      ...reqContext,
      ...errorDetails(error),
    });
    captureException(error, reqContext);
    return respond({ error: "Unhandled webhook error." }, 500);
  }
}
