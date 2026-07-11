import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocal } from "@/lib/mode";
import {
  captureException,
  errorDetails,
  getRequestId,
  logError,
  logInfo,
  requestContext,
} from "@/lib/observability";

type ConversationMessage = {
  role?: unknown;
  text?: unknown;
};

type ConversationRow = {
  id: string;
  title: string;
  profile: unknown;
  messages: unknown;
  created_at: string;
  updated_at: string;
};

type CreditTransactionRow = {
  id: string;
  delta: number;
  reason: string;
  ref: string | null;
  created_at: string;
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeReason(reason: string): string {
  if (!reason) return "unknown";
  if (reason.startsWith("llm:")) return "llm";
  return reason;
}

function sanitizeConversationMessages(messages: unknown) {
  return asArray(messages)
    .filter((msg) => {
      const row = msg as ConversationMessage;
      return row?.role === "user" && typeof row?.text === "string";
    })
    .map((msg) => {
      const row = msg as ConversationMessage;
      return {
        role: "user",
        text: asString(row.text),
      };
    });
}

// Returns a full user-scoped data export (JSON) for GDPR/right-to-access workflows.
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  logInfo("api.account_export.request_received", reqContext);
  if (isLocal()) {
    const response = NextResponse.json({ error: "Not available in local mode." }, { status: 404 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logInfo("api.account_export.unauthorized", reqContext);
    const response = NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const [{ data: credits, error: creditsError }, { data: transactions, error: txError }, { data: conversations, error: conversationsError }] =
      await Promise.all([
        supabase.from("user_credits").select("*").maybeSingle(),
        supabase
          .from("credit_transactions")
          .select("id, delta, reason, ref, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("conversations")
          .select("id, title, profile, messages, created_at, updated_at")
          .order("updated_at", { ascending: false }),
      ]);

    if (creditsError || txError || conversationsError) {
      logError("api.account_export.query_failed", {
        ...reqContext,
        user_id: user.id,
      });
      const response = NextResponse.json(
        { error: "Couldn't build account export right now." },
        { status: 500 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    const sanitizedTransactions = (transactions ?? []).map(
      (row: CreditTransactionRow) => ({
        id: row.id,
        delta: row.delta,
        reason: sanitizeReason(row.reason),
        ref: row.ref,
        created_at: row.created_at,
      }),
    );

    const sanitizedConversations = (conversations ?? []).map(
      (row: ConversationRow) => ({
        id: row.id,
        title: row.title,
        profile: row.profile,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user_messages: sanitizeConversationMessages(row.messages),
      }),
    );

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      },
      data: {
        user_credits: credits ?? null,
        credit_transactions: sanitizedTransactions,
        conversations: sanitizedConversations,
      },
    };

    logInfo("api.account_export.success", {
      ...reqContext,
      user_id: user.id,
    });
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="interviews-agent-export-${user.id}.json"`,
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    logError("api.account_export.unhandled_error", {
      ...reqContext,
      user_id: user.id,
      ...errorDetails(error),
    });
    captureException(error, {
      ...reqContext,
      user_id: user.id,
    });
    const response = NextResponse.json(
      { error: "Couldn't build account export right now." },
      { status: 500 },
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
