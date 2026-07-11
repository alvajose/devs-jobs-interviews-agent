// Boot-time environment validation. Reports ALL missing variables at once instead of
// discovering them one failed request at a time. Called from instrumentation.register().
//
// Local mode: never hard-fails (the app must always boot); only warns on a missing LLM key.
//
// Hosted mode, three tiers:
//   CORE        , the app cannot function without these; always throws when missing.
//   PROD_REQUIRED, needed for a real deployment (payments, admin, absolute URLs).
//                   Throws in production; warns in dev so you can work on one flow at a time.
//   RECOMMENDED , graceful degradation, but prod shouldn't run blind/unprotected; always warns.

export type EnvReport = { hardMissing: string[]; warn: string[] };

/** Pure, dependency-free so it can be unit-checked with fabricated env objects. */
export function checkEnv(
  env: Record<string, string | undefined> = process.env,
): EnvReport {
  const has = (k: string) => Boolean(env[k]?.trim());
  const explicit = env.NEXT_PUBLIC_APP_MODE ?? env.APP_MODE;
  const mode =
    explicit === "local" || explicit === "hosted"
      ? explicit
      : has("NEXT_PUBLIC_SUPABASE_URL")
        ? "hosted"
        : "local";
  const compatible = env.LLM_PROVIDER === "compatible";
  const llmKey = compatible ? "LLM_API_KEY" : "GEMINI_API_KEY";

  // Local mode must always boot (clone -> pnpm dev -> run). The only thing you truly need is an
  // LLM key, and only to generate,  so warn if it's missing, never hard-fail. Supabase, Stripe,
  // admin, etc. are hosted-only and irrelevant locally.
  if (mode === "local") {
    return { hardMissing: [], warn: has(llmKey) ? [] : [llmKey] };
  }

  const prod = (env.VERCEL_ENV || env.NODE_ENV) === "production";

  const core: Array<[string, boolean]> = [
    ["NEXT_PUBLIC_SUPABASE_URL", has("NEXT_PUBLIC_SUPABASE_URL")],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", has("NEXT_PUBLIC_SUPABASE_ANON_KEY")],
    ["SUPABASE_SERVICE_ROLE_KEY", has("SUPABASE_SERVICE_ROLE_KEY")],
    [llmKey, has(llmKey)],
  ];

  // Stripe is disabled for now (free daily credits only), so its keys are NOT required,
  // add them back here when payments return.
  const prodRequired: Array<[string, boolean]> = [
    ["ADMIN_SECRET_HASH", has("ADMIN_SECRET_HASH")],
    ["NEXT_PUBLIC_SITE_URL", has("NEXT_PUBLIC_SITE_URL")],
  ];

  const recommended: Array<[string, boolean]> = [
    // Either DSN configures Sentry (see instrumentation.ts).
    [
      "SENTRY_DSN|NEXT_PUBLIC_SENTRY_DSN",
      has("SENTRY_DSN") || has("NEXT_PUBLIC_SENTRY_DSN"),
    ],
    ["TURNSTILE_SECRET_KEY", has("TURNSTILE_SECRET_KEY")],
  ];

  const missing = (pairs: Array<[string, boolean]>) =>
    pairs.filter(([, ok]) => !ok).map(([k]) => k);

  return {
    hardMissing: [...missing(core), ...(prod ? missing(prodRequired) : [])],
    warn: [...(prod ? [] : missing(prodRequired)), ...missing(recommended)],
  };
}

/** Throws on hard-missing config, warns on the rest. Call once at server startup. */
export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): void {
  const { hardMissing, warn } = checkEnv(env);
  if (warn.length) {
    console.warn(
      `[env] Not set (features degraded in this environment): ${warn.join(", ")}. See .env.example.`,
    );
  }
  if (hardMissing.length) {
    throw new Error(
      `Missing required environment variable(s): ${hardMissing.join(", ")}. See .env.example.`,
    );
  }
}
