import { generateText, generateJson, isLlmCapacityError } from "@/lib/llm";
import { buildChatPrompt, buildEditPrompt } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { isHosted } from "@/lib/mode";
import {
  reserveForLlm,
  releaseLlmReserve,
  settleLlmCharge,
} from "@/lib/credits";
import {
  enforceLlmRateLimit,
  validateChatPayload,
} from "@/lib/abuse";
import { attachPracticeResource } from "@/lib/practice";
import {
  captureException,
  errorDetails,
  getRequestId,
  jsonWithRequestId,
  logError,
  logInfo,
  requestContext,
} from "@/lib/observability";
import type { ChatMsg, Profile, Roadmap, RoadmapModule } from "@/lib/types";

type EditResult = {
  edit?: boolean;
  reply?: string;
  changes?: string[];
  roadmap?: Roadmap;
};

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  logInfo("api.chat.request_received", reqContext);

  const respond = (payload: unknown, init: number | ResponseInit = 200) =>
    jsonWithRequestId(
      requestId,
      payload,
      typeof init === "number" ? { status: init } : init,
    );

  let body: { profile?: Partial<Profile>; messages?: ChatMsg[]; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    logInfo("api.chat.invalid_json", reqContext);
    return respond({ error: "Invalid JSON body" }, 400);
  }

  const { profile, messages, conversationId } = body;

  const payloadCheck = validateChatPayload(messages);
  if (!payloadCheck.ok) {
    logInfo("api.chat.payload_rejected", {
      ...reqContext,
      reason: payloadCheck.error,
    });
    return respond(
      { error: payloadCheck.error, code: payloadCheck.code },
      payloadCheck.code === "payload_too_large" ? 413 : 400,
    );
  }
  const chatMessages = messages as ChatMsg[];

  // Auth + credit gate. Local mode: one implicit user, no billing (you bring your own LLM
  // key). Hosted mode: Supabase auth + credit reservation + rate limiting.
  const user = await getSessionUser();
  if (!user) {
    logInfo("api.chat.unauthorized", reqContext);
    return respond({ error: "Sign in to continue." }, 401);
  }

  const chargeContext = {
    kind: "chat" as const,
    conversationId,
    userId: user.id,
    requestId,
  };

  const supabase = isHosted() ? await createClient() : null;
  if (supabase) {
    const rateLimit = await enforceLlmRateLimit(supabase, req, "/api/chat");
    if (!rateLimit.ok) {
      const saturated = rateLimit.reason === "saturated";
      logInfo(saturated ? "api.chat.saturated" : "api.chat.rate_limited", {
        ...reqContext,
        user_id: user.id,
      });
      return respond(
        saturated
          ? { error: "We're at capacity right now. Please try again shortly.", code: "saturated" }
          : { error: "Too many requests. Please wait a moment.", code: "rate_limited" },
        {
          status: saturated ? 503 : 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSec) },
        },
      );
    }

    const reserved = await reserveForLlm(supabase, chargeContext);
    if (!reserved.ok) {
      logInfo("api.chat.no_credits", {
        ...reqContext,
        user_id: user.id,
      });
      return respond({ error: "You're out of credits.", code: "no_credits" }, 402);
    }
  }

  // Role/seniority are optional context (the roadmap route defaults them too). The chat already
  // has the full plan in `messages`, so don't hard-fail a follow-up just because the profile is sparse.
  const full: Profile = {
    role: profile?.role ? String(profile.role) : "",
    seniority: profile?.seniority ? String(profile.seniority) : "Mid",
    targetCompany: profile?.targetCompany ? String(profile.targetCompany) : undefined,
    weeks: Number(profile?.weeks) || 4,
    hoursPerWeek: Number(profile?.hoursPerWeek) || 8,
    language: profile?.language === "en" ? "en" : "es",
  };

  const latestRoadmap = [...chatMessages]
    .reverse()
    .find((m) => m.role === "assistant" && m.roadmap)?.roadmap;
  const latestUserQuestion = [...chatMessages]
    .reverse()
    .find((m) => m.role === "user")?.text;

  try {
    // No roadmap yet -> nothing to edit; answer as a plain follow-up.
    if (!latestRoadmap) {
      const { system, user: userPrompt } = buildChatPrompt(full, chatMessages);
      const { text, usage } = await generateText(system, userPrompt);
      if (supabase) {
        await settleLlmCharge(supabase, usage, {
          ...chargeContext,
          question: latestUserQuestion,
        });
      }
      logInfo("api.chat.success_no_roadmap", {
        ...reqContext,
        user_id: user.id,
      });
      return respond({ reply: text });
    }

    // With a roadmap present, let the model decide: answer the question, or edit the plan.
    const { system, user: userPrompt } = buildEditPrompt(full, latestRoadmap, chatMessages);
    const { data, usage } = await generateJson<EditResult>(system, userPrompt);
    if (supabase) {
      await settleLlmCharge(supabase, usage, {
        ...chargeContext,
        question: latestUserQuestion,
      });
    }

    if (!data.edit || !data.roadmap) {
      logInfo("api.chat.success_reply_only", {
        ...reqContext,
        user_id: user.id,
      });
      return respond({ reply: data.reply ?? "" });
    }

    // Merge: keep existing modules verbatim by id; only NEW ids use the model's fresh content.
    const prevById = new Map(latestRoadmap.modules.map((m) => [m.id, m]));
    const modules: RoadmapModule[] = (data.roadmap.modules ?? []).map((m) => {
      const prev = prevById.get(m.id);
      return prev ?? { ...m, source: "generated" as const };
    });
    const merged: Roadmap = {
      ...latestRoadmap,
      ...data.roadmap,
      modules: attachPracticeResource(modules),
      plan: data.roadmap.plan ?? latestRoadmap.plan,
      bankStacks: latestRoadmap.bankStacks,
    };

    const changes = Array.isArray(data.changes) ? data.changes : [];
    const summary = changes.length
      ? changes.map((c) => `• ${c}`).join("\n")
      : data.reply || "Updated your plan.";
    logInfo("api.chat.success_with_edit", {
      ...reqContext,
      user_id: user.id,
      conversation_id: conversationId ?? null,
    });
    return respond({ reply: summary, roadmap: merged });
  } catch (e) {
    if (supabase) await releaseLlmReserve(supabase, chargeContext);
    if (isLlmCapacityError(e)) {
      logInfo("api.chat.provider_saturated", {
        ...reqContext,
        user_id: user.id,
        ...errorDetails(e),
      });
      return respond(
        {
          error: "We're at capacity right now. Please try again shortly.",
          code: "saturated",
        },
        {
          status: 503,
          headers: { "Retry-After": String(e.retryAfterSec) },
        },
      );
    }
    logError("api.chat.unhandled_error", {
      ...reqContext,
      user_id: user.id,
      ...errorDetails(e),
    });
    captureException(e, {
      ...reqContext,
      user_id: user.id,
    });
    return respond({ error: (e as Error).message }, 500);
  }
}
