import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/credits";
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

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  // Local mode has no billing. Returning non-OK makes the credits badge hide itself.
  if (isLocal()) return respond({ error: "Credits disabled in local mode." }, 404);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return respond({ error: "Not authenticated." }, 401);

  try {
    // total = free (this month) + paid. paid is the raw balance column, so free = total - paid.
    const total = await getBalance(supabase);
    const { data: row } = await supabase.from("user_credits").select("balance").maybeSingle();
    const paid = row?.balance ?? 0;
    const free = Math.max(0, total - paid);

    logInfo("api.credits_balance.success", {
      ...reqContext,
      user_id: user.id,
    });
    return respond({ total, free, paid });
  } catch (error) {
    logError("api.credits_balance.unhandled_error", {
      ...reqContext,
      user_id: user.id,
      ...errorDetails(error),
    });
    captureException(error, {
      ...reqContext,
      user_id: user.id,
    });
    return respond({ error: "Could not load credit balance." }, 500);
  }
}
