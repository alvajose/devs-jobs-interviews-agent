// DISABLED for now: paid credits via Stripe are off (no merchant/tax setup yet), and the UI
// doesn't call this route. Kept in place so payments can be switched back on later. It also
// short-circuits without STRIPE_SECRET_KEY, so it's inert until fully re-enabled.
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { isLocal } from "@/lib/mode";
import {
  captureException,
  errorDetails,
  getRequestId,
  jsonWithRequestId,
  logError,
  logInfo,
  requestContext,
} from "@/lib/observability";

// Packages: price and credits live TOGETHER on the server. The client sends only a package key,
// never the price or the credit amount (otherwise anyone could self-grant credits).
// priceId references a Price created in the Stripe dashboard. NOTE: these are one mode's IDs,
// if you switch Stripe test/live mode, swap in that mode's price IDs (or move them to env).
const PACKAGES = {
  taste: { priceId: "price_1Toxf9Pjq4CqDJwYABBOvmkv", credits: 150 }, // $2
  hunt: { priceId: "price_1ToxfLPjq4CqDJwYCL5mVCu1", credits: 900 }, // $10
  ready: { priceId: "price_1ToxfWPjq4CqDJwYcu54g30J", credits: 1800 }, // $18
} as const;

type PackageKey = keyof typeof PACKAGES;

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  logInfo("api.stripe.checkout.request_received", reqContext);
  if (isLocal()) return respond({ error: "Payments are not available in local mode." }, 404);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return respond({ error: "Stripe is not configured." }, 500);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logInfo("api.stripe.checkout.unauthorized", reqContext);
    return respond({ error: "Sign in to buy credits." }, 401);
  }

  let body: { package?: string };
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON body" }, 400);
  }

  try {
    const pkg = PACKAGES[body.package as PackageKey];
    if (!pkg) {
      return respond({ error: "Unknown package." }, 400);
    }

    const stripe = new Stripe(stripeKey);
    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: pkg.priceId, quantity: 1 }],
      // The webhook trusts these to credit the right account. Never credit from the client.
      metadata: { user_id: user.id, credits: String(pkg.credits) },
      // Return to /credits, which confirms the payment server-side via session_id (no webhook needed).
      success_url: `${origin}/credits?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/credits?purchase=cancel`,
    });

    logInfo("api.stripe.checkout.success", {
      ...reqContext,
      user_id: user.id,
      package: body.package ?? null,
    });

    return respond({ url: session.url });
  } catch (error) {
    logError("api.stripe.checkout.unhandled_error", {
      ...reqContext,
      user_id: user.id,
      ...errorDetails(error),
    });
    captureException(error, {
      ...reqContext,
      user_id: user.id,
    });
    return respond({ error: "Could not create checkout session." }, 500);
  }
}
