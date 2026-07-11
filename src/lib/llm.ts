// Provider-agnostic LLM access. No SDKs: both providers are reachable over plain fetch.
// - "gemini": Google's native generateContent endpoint (default).
// - "compatible": any provider that speaks the standard chat-completions wire format
//   (OpenCode Go, DeepSeek, OpenRouter, a local model...). NOT tied to any one company,
//   it's just the message shape. Plug your provider in via LLM_BASE_URL + LLM_API_KEY.
//
// Prompt caching note: DeepSeek (and most compatible gateways) cache the request PREFIX
// automatically, no cache_control flag exists or is needed. The win comes from keeping the
// static system prompt identical across calls (it already is) and reading the split back from
// `usage` so we can bill cache misses only. See callCompatible.

type Provider = "gemini" | "compatible";

const PROVIDER: Provider =
  process.env.LLM_PROVIDER === "compatible" ? "compatible" : "gemini";

/** Token accounting for one call. Cache hits are ~free, so we track them apart from misses. */
export type Usage = { inputMiss: number; inputHit: number; output: number };
export type TextResult = { text: string; usage: Usage };
export type JsonResult<T> = { data: T; usage: Usage };
type Completion = { text: string; usage: Usage };

/** Upstream provider hit quota / rate limits,  routes map this to a friendly 503. */
export class LlmCapacityError extends Error {
  readonly status: number;
  readonly retryAfterSec: number;

  constructor(status: number, detail: string, retryAfterSec = 60) {
    super(`LLM capacity ${status}: ${detail}`);
    this.name = "LlmCapacityError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export function isLlmCapacityError(e: unknown): e is LlmCapacityError {
  return e instanceof LlmCapacityError;
}

const CAPACITY_BODY_RE =
  /rate[\s_-]?limit|quota|usage[\s_-]?limit|capacity|insufficient|billing|exceeded|too many requests|resource.?exhausted/i;

/** True when the provider response means "wait / out of budget", not a generic failure. */
export function isProviderCapacityResponse(
  status: number,
  body: string,
): boolean {
  if (status === 429 || status === 402) return true;
  if (status === 503 && CAPACITY_BODY_RE.test(body)) return true;
  return false;
}

function throwProviderHttpError(
  label: string,
  status: number,
  body: string,
): never {
  if (isProviderCapacityResponse(status, body)) {
    throw new LlmCapacityError(status, body.slice(0, 500));
  }
  throw new Error(`${label} ${status}: ${body}`);
}

// ~4 chars/token heuristic, only used when the provider omits usage, better than
// billing zero. Real usage from the API always wins when present.
const estimateTokens = (s: string) => Math.ceil(s.length / 4);

/** Pull a JSON value out of a model response that may be fenced or wrapped in prose. */
export function extractJson<T = unknown>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (s[0] !== "{" && s[0] !== "[") {
    const start = s.search(/[{[]/);
    if (start === -1) throw new Error("No JSON found in model output");
    const open = s[start];
    const close = open === "{" ? "}" : "]";
    s = s.slice(start, s.lastIndexOf(close) + 1);
  }
  return JSON.parse(s) as T;
}

/** Structured output: forces/parses JSON. Retries when the model emits invalid JSON. */
export async function generateJson<T = unknown>(
  system: string,
  user: string,
): Promise<JsonResult<T>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { text, usage } = await complete(system, user, true);
      // We bill only the successful attempt; retries are our parsing fault, not the user's.
      return { data: extractJson<T>(text), usage };
    } catch (e) {
      // Capacity / HTTP provider failures are not parse retries,  don't burn more quota.
      if (isLlmCapacityError(e)) throw e;
      lastError = e; // empty / malformed / truncated JSON, ask the model again
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Invalid JSON from model");
}

/** Free-form text output (conversational replies). */
export async function generateText(
  system: string,
  user: string,
): Promise<TextResult> {
  const { text, usage } = await complete(system, user, false);
  return { text, usage };
}

function complete(
  system: string,
  user: string,
  json: boolean,
): Promise<Completion> {
  return PROVIDER === "gemini"
    ? callGemini(system, user, json)
    : callCompatible(system, user, json);
}

async function callGemini(
  system: string,
  user: string,
  json: boolean,
): Promise<Completion> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) throwProviderHttpError("Gemini", res.status, await res.text());
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Empty Gemini response");
  const m = data?.usageMetadata ?? {};
  const inputHit = Number(m.cachedContentTokenCount) || 0;
  const prompt = Number(m.promptTokenCount) || 0;
  const inputMiss = prompt
    ? Math.max(0, prompt - inputHit)
    : estimateTokens(system + user);
  const output = Number(m.candidatesTokenCount) || estimateTokens(out);
  return { text: out, usage: { inputMiss, inputHit, output } };
}

async function callCompatible(
  system: string,
  user: string,
  json: boolean,
): Promise<Completion> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY is not set");
  const baseUrl = (
    process.env.LLM_BASE_URL || "https://opencode.ai/zen/go/v1"
  ).replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "deepseek-v4-flash";
  // json_object mode helps where supported, but some gateways may reject the
  // param with a 400. Default on; set LLM_JSON_MODE=false to drop it, extractJson + the
  // prompt still guarantee parseable JSON without it.
  const jsonMode = json && process.env.LLM_JSON_MODE !== "false";
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      // Static system prompt first, variable user content last, this is the cacheable prefix.
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throwProviderHttpError("LLM", res.status, await res.text());
  const data = await res.json();
  const choice = data?.choices?.[0];
  const out = choice?.message?.content;
  if (!out)
    throw new Error(
      `Empty LLM response (finish_reason: ${choice?.finish_reason ?? "unknown"})`,
    );
  // DeepSeek returns prompt_cache_hit_tokens / prompt_cache_miss_tokens; other gateways may only
  // give prompt_tokens. Derive the miss count defensively, estimate if usage is absent entirely.
  const u = data?.usage ?? {};
  const inputHit = Number(u.prompt_cache_hit_tokens) || 0;
  const promptTokens = Number(u.prompt_tokens) || 0;
  const reportedMiss = Number(u.prompt_cache_miss_tokens);
  const inputMiss = Number.isFinite(reportedMiss)
    ? reportedMiss
    : promptTokens
      ? Math.max(0, promptTokens - inputHit)
      : estimateTokens(system + user);
  const output = Number(u.completion_tokens) || estimateTokens(out);
  return { text: out, usage: { inputMiss, inputHit, output } };
}
