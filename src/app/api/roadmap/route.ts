import { generateJson, isLlmCapacityError } from "@/lib/llm";
import { buildRoadmapPrompt, buildRoutingPrompt } from "@/lib/prompts";
import { loadCuratedModules, availableBankStacks, loadQuestionBank, filterStacksByBankLanguage } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { isHosted } from "@/lib/mode";
import {
  reserveForLlm,
  releaseLlmReserve,
  settleLlmCharge,
  addUsage,
  ZERO_USAGE,
} from "@/lib/credits";
import {
  enforceLlmRateLimit,
  validateProfileField,
  validateRoadmapPayload,
} from "@/lib/abuse";
import { attachPracticeResource } from "@/lib/practice";
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
import type { Profile, Roadmap } from "@/lib/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function key(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text: string, term: string) {
  const t = normalizeText(term);
  if (!t) return false;
  return new RegExp(`\\b${escapeRegExp(t)}\\b`).test(text);
}

const STACK_ALIASES: Record<string, string[]> = {
  javascript: ["javascript", "js", "typescript", "ts", "node", "nodejs"],
  python: ["python", "py", "fastapi", "django"],
  laravel: ["laravel", "php"],
  react: ["react", "next", "nextjs", "frontend"],
};

function buildStackLexicon(stacks: string[]) {
  const map = new Map<string, string[]>();
  for (const s of stacks) {
    const base = key(s);
    const aliases = new Set<string>([base, ...(STACK_ALIASES[base] ?? [])]);
    map.set(base, Array.from(aliases));
  }
  return map;
}

function detectRequestedStacks(input: string, lexicon: Map<string, string[]>) {
  const hay = normalizeText(input);
  const hits = new Set<string>();
  for (const [stack, terms] of lexicon) {
    if (terms.some((term) => containsTerm(hay, term))) hits.add(stack);
  }
  return hits;
}

function inferModuleStack(
  module: { id: string; title: string; area?: string; summary?: string; concepts?: { name: string }[] },
  lexicon: Map<string, string[]>,
) {
  const text = normalizeText(
    [
      module.id,
      module.title,
      module.area ?? "",
      module.summary ?? "",
      (module.concepts ?? []).slice(0, 4).map((c) => c.name).join(" "),
    ].join(" "),
  );
  const hits: string[] = [];
  for (const [stack, terms] of lexicon) {
    if (terms.some((term) => containsTerm(text, term))) hits.push(stack);
  }
  return hits.length === 1 ? hits[0] : undefined;
}

function prefixExtraSummary(summary: string, language: "es" | "en") {
  const tag = language === "es" ? "Recomendación extra" : "Extra recommendation";
  const normalizedSummary = normalizeText(summary || "");
  if (normalizedSummary.startsWith(normalizeText(tag))) return summary;
  return summary ? `${tag}: ${summary}` : tag;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  logInfo("api.roadmap.request_received", reqContext);

  const respond = (payload: unknown, init: number | ResponseInit = 200) =>
    jsonWithRequestId(
      requestId,
      payload,
      typeof init === "number" ? { status: init } : init,
    );

  let body: { profile?: Partial<Profile>; target?: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    logInfo("api.roadmap.invalid_json", reqContext);
    return respond({ error: "Invalid JSON body" }, 400);
  }

  const { profile, target, conversationId } = body;

  const targetCheck = validateRoadmapPayload(target);
  if (!targetCheck.ok) {
    logInfo("api.roadmap.validation_failed", {
      ...reqContext,
      reason: targetCheck.error,
    });
    return respond(
      { error: targetCheck.error, code: targetCheck.code },
      targetCheck.code === "payload_too_large" ? 413 : 400,
    );
  }

  for (const [value, label] of [
    [profile?.role, "Role"],
    [profile?.targetCompany, "Target company"],
  ] as const) {
    const fieldError = validateProfileField(value, label);
    if (fieldError) {
      return respond({ error: fieldError, code: "payload_too_large" }, 413);
    }
  }

  const full: Profile = {
    role: profile?.role ? String(profile.role) : "",
    seniority: profile?.seniority ? String(profile.seniority) : "Mid",
    targetCompany: profile?.targetCompany ? String(profile.targetCompany) : undefined,
    weeks: clamp(Number(profile?.weeks) || 4, 1, 12),
    hoursPerWeek: clamp(Number(profile?.hoursPerWeek) || 8, 1, 60),
    language: profile?.language === "en" ? "en" : "es",
  };

  // Auth + credit gate. Local mode: one implicit user, no billing (you bring your own LLM
  // key). Hosted mode: Supabase auth + credit reservation + rate limiting.
  const user = await getSessionUser();
  if (!user) {
    logInfo("api.roadmap.unauthorized", reqContext);
    return respond({ error: "Sign in to continue." }, 401);
  }

  const safeTarget = (target as string).trim();
  const chargeContext = {
    kind: "roadmap" as const,
    conversationId,
    question: safeTarget,
    userId: user.id,
    requestId,
  };

  const supabase = isHosted() ? await createClient() : null;
  if (supabase) {
    const rateLimit = await enforceLlmRateLimit(supabase, req, "/api/roadmap");
    if (!rateLimit.ok) {
      const saturated = rateLimit.reason === "saturated";
      logInfo(saturated ? "api.roadmap.saturated" : "api.roadmap.rate_limited", {
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
      logInfo("api.roadmap.no_credits", {
        ...reqContext,
        user_id: user.id,
      });
      return respond({ error: "You're out of credits.", code: "no_credits" }, 402);
    }
  }

  const curated = loadCuratedModules();
  // Curated markdown is Spanish-only today. Injecting it when the user asked for English
  // overwrites the LLM's English modules (the study plan is left alone, which is why it
  // looked "correct" while the roadmap body stayed in Spanish). Only reuse curated text for es.
  const useCuratedContent = full.language === "es";
  const catalog = useCuratedContent
    ? curated.map((c) => ({ id: c.id, title: c.title, area: c.area, stack: c.stack }))
    : [];
  const knownStacks = Array.from(new Set(curated.map((c) => key(c.stack)).filter(Boolean)));
  const stackLexicon = buildStackLexicon(knownStacks);
  const requestedStacks = detectRequestedStacks(`${safeTarget} ${full.role}`, stackLexicon);

  const { system, user: userPrompt } = buildRoadmapPrompt(full, safeTarget, catalog);
  let usage = ZERO_USAGE; // accumulated across the roadmap + routing calls, charged once at the end
  try {
    const { data: roadmap, usage: u0 } = await generateJson<Roadmap>(system, userPrompt);
    usage = addUsage(usage, u0);
    if (!Array.isArray(roadmap?.modules) || !roadmap?.plan) {
      if (supabase) await releaseLlmReserve(supabase, chargeContext);
      logError("api.roadmap.invalid_model_shape", {
        ...reqContext,
        user_id: user.id,
      });
      return respond({ error: "Model returned an unexpected shape." }, 502);
    }

    // Overlay: where the model used a curated id, serve our authoritative content verbatim.
    // Skipped for non-Spanish so we keep the LLM's language-correct text.
    const byId = useCuratedContent ? new Map(curated.map((c) => [c.id, c])) : new Map();
    const byTitle = useCuratedContent
      ? new Map(curated.map((c) => [key(c.title), c]))
      : new Map();
    roadmap.modules = roadmap.modules.map((m) => {
      const hit = byId.get(m.id) ?? byTitle.get(key(m.title));
      const base = hit
        ? {
            ...m,
            title: hit.title,
            area: hit.area,
            summary: hit.summary || m.summary,
            concepts: hit.concepts,
            questions: hit.questions,
            resource: hit.resource ?? m.resource ?? null,
            source: "curated" as const,
          }
        : { ...m, source: "generated" as const };

      const moduleStack = key(hit?.stack ?? inferModuleStack(base, stackLexicon) ?? "");
      const isExtraRecommendation = Boolean(
        moduleStack &&
          moduleStack !== "general" &&
          requestedStacks.size > 0 &&
          !requestedStacks.has(moduleStack),
      );

      return {
        ...base,
        ...(moduleStack ? { stack: moduleStack } : {}),
        ...(isExtraRecommendation
          ? {
              recommendedExtra: true as const,
              priority: "low" as const,
              summary: prefixExtraSummary(base.summary, full.language),
            }
          : {}),
      };
    });

    // All ingested banks relevant to this roadmap (matched against the target + language).
    // Most banks are Spanish today; English users only see banks that are actually in English
    // (e.g. React), otherwise the "Real interview questions" panel would dump Spanish Qs.
    const hay = `${safeTarget} ${roadmap.role ?? ""}`.toLowerCase();
    const bankStacks = filterStacksByBankLanguage(
      availableBankStacks().filter((s) => hay.includes(s)),
      full.language,
    );
    roadmap.bankStacks = bankStacks;

    // Route REAL bank questions into NON-curated modules (the LLM only assigns indices).
    // Curated modules keep their hand-authored questions; each module is routed once.
    for (const st of bankStacks) {
      const bank = loadQuestionBank(st);
      if (!bank || !bank.questions.length) continue;
      const routable = roadmap.modules.filter((m) => m.source !== "curated" && !m.questionsSource);
      if (!routable.length) continue;
      try {
        const titles = bank.questions.map((q) => q.question);
        const { system: rs, user: ru } = buildRoutingPrompt(routable, titles);
        const { data: routing, usage: ru2 } = await generateJson<Record<string, number[]>>(rs, ru);
        usage = addUsage(usage, ru2);
        const attribution = {
          repo: bank.source.repo,
          url: bank.source.url,
          license: bank.source.license,
          copyright: bank.source.copyright,
        };
        roadmap.modules = roadmap.modules.map((m) => {
          if (m.source === "curated" || m.questionsSource) return m;
          const idxs = Array.isArray(routing?.[m.id]) ? routing[m.id] : [];
          const real = idxs
            .filter((i) => Number.isInteger(i) && i >= 0 && i < bank.questions.length)
            .slice(0, 6)
            .map((i) => bank.questions[i]);
          return real.length ? { ...m, questions: real, questionsSource: attribution } : m;
        });
      } catch {
        /* routing failed, keep the generated questions */
      }
    }

    roadmap.modules = attachPracticeResource(roadmap.modules);
    // Billing + first-roadmap funnel analytics are hosted-only.
    let isFirstRoadmap = false;
    if (supabase) {
      await settleLlmCharge(supabase, usage, chargeContext);
      const { count: roadmapCharges } = await supabase
        .from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .like("reason", "llm:%kind=roadmap%");
      isFirstRoadmap = roadmapCharges === 1;
    }
    void trackProductEvent({
      event: "roadmap_generated",
      distinctId: user.id,
      insertId: `${user.id}:roadmap:${conversationId ?? crypto.randomUUID()}`,
      properties: {
        request_id: requestId,
        conversation_id: conversationId ?? null,
        first_roadmap: isFirstRoadmap,
      },
    });

    if (isFirstRoadmap) {
      void trackProductEvent({
        event: "funnel_first_roadmap_completed",
        distinctId: user.id,
        insertId: `funnel:first-roadmap:${user.id}`,
        properties: {
          request_id: requestId,
          conversation_id: conversationId ?? null,
        },
      });
    }

    logInfo("api.roadmap.success", {
      ...reqContext,
      user_id: user.id,
      first_roadmap: isFirstRoadmap,
      conversation_id: conversationId ?? null,
    });
    return respond(roadmap);
  } catch (e) {
    if (supabase) await releaseLlmReserve(supabase, chargeContext);
    if (isLlmCapacityError(e)) {
      logInfo("api.roadmap.provider_saturated", {
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
    logError("api.roadmap.unhandled_error", {
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
