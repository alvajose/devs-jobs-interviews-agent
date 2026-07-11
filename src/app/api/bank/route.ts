import { detectBankLanguage, loadQuestionBank } from "@/lib/content";
import { getRequestId, jsonWithRequestId, logInfo, requestContext } from "@/lib/observability";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const reqContext = requestContext(req, requestId);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  const url = new URL(req.url);
  const stack = url.searchParams.get("stack")?.toLowerCase().trim();
  const langRaw = url.searchParams.get("lang")?.toLowerCase().trim();
  const lang = langRaw === "en" || langRaw === "es" ? langRaw : null;

  if (!stack) {
    logInfo("api.bank.validation_failed", {
      ...reqContext,
      reason: "missing_stack",
    });
    return respond({ error: "Missing ?stack=" }, 400);
  }
  // Reject anything that isn't a plain slug before it reaches the filesystem.
  if (!/^[a-z0-9][a-z0-9+-]{0,29}$/.test(stack)) {
    logInfo("api.bank.validation_failed", {
      ...reqContext,
      reason: "invalid_stack",
    });
    return respond({ error: "Invalid stack." }, 400);
  }
  const bank = loadQuestionBank(stack);
  if (!bank) {
    return respond({ error: `No question bank for "${stack}".` }, 404);
  }
  // Optional but recommended: refuse banks that don't match the UI language so the
  // "Real interview questions" panel never dumps Spanish Qs into an English session.
  if (lang && detectBankLanguage(bank.questions) !== lang) {
    logInfo("api.bank.language_mismatch", {
      ...reqContext,
      stack,
      lang,
      bank_lang: detectBankLanguage(bank.questions),
    });
    return respond(
      { error: `No ${lang} question bank for "${stack}".`, code: "language_mismatch" },
      404,
    );
  }
  return respond(bank);
}
