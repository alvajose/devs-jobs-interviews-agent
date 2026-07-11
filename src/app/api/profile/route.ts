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

type TxRow = {
  delta: number;
  reason: string;
  created_at: string;
};

type ParsedReason = {
  baseReason: string;
  chatId?: string;
  question?: string;
  kind?: "chat" | "roadmap";
};

function parseReason(reason: string): ParsedReason {
  if (!reason.startsWith("llm:")) {
    return { baseReason: reason };
  }
  const params = new URLSearchParams(reason.slice(4));
  const kindValue = params.get("kind");
  const kind = kindValue === "chat" || kindValue === "roadmap" ? kindValue : undefined;
  return {
    baseReason: "llm",
    chatId: params.get("chat") ?? undefined,
    question: params.get("q") ?? undefined,
    kind,
  };
}

// Aggregates the signed-in user's credit balance + usage from the credit_transactions ledger.
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  logInfo("api.profile.request_received", reqContext);

  // Local mode has no accounts/billing: return an empty, non-crashing shape.
  if (isLocal()) {
    return respond({
      email: null,
      credits: { total: 0, free: 0, paid: 0 },
      usage: { spentTotal: 0, spentThisMonth: 0, calls: 0, conversations: 0 },
      recent: [],
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return respond({ error: "Not authenticated." }, 401);

  try {
    // total = free (this month) + paid; paid is the raw balance column, so free = total - paid.
    const total = await getBalance(supabase);
    const { data: creditsRow } = await supabase.from("user_credits").select("balance").maybeSingle();
    const paid = creditsRow?.balance ?? 0;
    const free = Math.max(0, total - paid);

    // Loads this user's whole ledger to aggregate in-app. Fine at current scale; move to
    // a SQL aggregate RPC if a single user ever accrues tens of thousands of rows.
    const { data: tx } = await supabase
      .from("credit_transactions")
      .select("delta, reason, created_at")
      .order("created_at", { ascending: false });
    const rows: TxRow[] = tx ?? [];
    const parsedRows = rows.map((row) => ({
      ...row,
      parsed: parseReason(row.reason),
    }));

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let spentTotal = 0;
    let spentThisMonth = 0;
    let calls = 0;
    for (const r of rows) {
      if (r.delta < 0) {
        const spent = -r.delta;
        spentTotal += spent;
        calls += 1;
        if (new Date(r.created_at) >= monthStart) spentThisMonth += spent;
      }
    }

    const recentRows = parsedRows.slice(0, 10);
    const recentChatIds = Array.from(
      new Set(recentRows.map((r) => r.parsed.chatId).filter((id): id is string => Boolean(id))),
    );
    let titleById = new Map<string, string>();
    if (recentChatIds.length > 0) {
      const { data: chatRows } = await supabase
        .from("conversations")
        .select("id, title")
        .in("id", recentChatIds);
      titleById = new Map((chatRows ?? []).map((c) => [c.id as string, c.title as string]));
    }

    const { count: conversations } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true });

    logInfo("api.profile.success", {
      ...reqContext,
      user_id: user.id,
    });
    return respond({
      email: user.email,
      credits: { total, free, paid },
      usage: { spentTotal, spentThisMonth, calls, conversations: conversations ?? 0 },
      recent: recentRows.map((row) => ({
        delta: row.delta,
        reason: row.parsed.baseReason,
        created_at: row.created_at,
        chat_id: row.parsed.chatId ?? null,
        chat_title: row.parsed.chatId ? titleById.get(row.parsed.chatId) ?? null : null,
        question: row.parsed.question ?? null,
        kind: row.parsed.kind ?? null,
      })),
    });
  } catch (error) {
    logError("api.profile.unhandled_error", {
      ...reqContext,
      user_id: user.id,
      ...errorDetails(error),
    });
    captureException(error, {
      ...reqContext,
      user_id: user.id,
    });
    return respond({ error: "Could not load profile activity." }, 500);
  }
}
