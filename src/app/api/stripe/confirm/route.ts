// DISABLED for now: Stripe payments are off (no merchant/tax setup yet). Kept for the future;
// inert without STRIPE_SECRET_KEY and not reachable from the current UI.
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
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

// Webhook-free crediting: the return page calls this with the Stripe session_id. We ask Stripe
// whether the session is paid and belongs to THIS user, then grant credits. Idempotent on the
// session id (grant_credits), so calling it on every page load is safe.
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  logInfo("api.stripe.confirm.request_received", reqContext);
  if (isLocal()) return respond({ error: "Payments are not available in local mode." }, 404);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return respond({ error: "Stripe is not configured." }, 500);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logInfo("api.stripe.confirm.unauthorized", reqContext);
    return respond({ error: "Not authenticated." }, 401);
  }

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) return respond({ error: "Missing session_id." }, 400);

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Never trust a session_id blindly: it must be paid AND carry this user's id.
    if (session.payment_status !== "paid" || session.metadata?.user_id !== user.id) {
      return respond({ error: "Payment not confirmed." }, 402);
    }

    const credits = Number(session.metadata?.credits);
    if (credits > 0) {
      const admin = createAdminClient();
      const { error } = await admin.rpc("grant_credits", {
        p_user: user.id,
        p_amount: credits,
        p_ref: session.id,
      });
      if (error) return respond({ error: error.message }, 500);

      const { count: purchaseCount } = await admin
        .from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("reason", "purchase");

      const firstPurchase = purchaseCount === 1;
      void trackProductEvent({
        event: "purchase_completed",
        distinctId: user.id,
        insertId: `purchase:${session.id}`,
        properties: {
          request_id: requestId,
          credits,
          first_purchase: firstPurchase,
          payment_status: session.payment_status,
        },
      });

      if (firstPurchase) {
        void trackProductEvent({
          event: "funnel_first_purchase_completed",
          distinctId: user.id,
          insertId: `funnel:first-purchase:${user.id}`,
          properties: {
            request_id: requestId,
            credits,
          },
        });
      }
    }

    logInfo("api.stripe.confirm.success", {
      ...reqContext,
      user_id: user.id,
      session_id: session.id,
      credits,
    });
    return respond({ ok: true, credits });
  } catch (error) {
    logError("api.stripe.confirm.unhandled_error", {
      ...reqContext,
      user_id: user.id,
      ...errorDetails(error),
    });
    captureException(error, {
      ...reqContext,
      user_id: user.id,
    });
    return respond({ error: "Could not confirm purchase." }, 500);
  }
}
