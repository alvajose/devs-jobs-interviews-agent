# Operations & deployment

## Environment configuration

All environment variables are documented in `.env.example` with tier annotations. Validation is enforced at boot by `/src/lib/env.ts`.

### Variable tiers

| Tier | Behavior | Variables |
|---|---|---|
| **CORE** | Always required in hosted mode | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, LLM key (`GEMINI_API_KEY` or `LLM_API_KEY`) |
| **PROD_REQUIRED** | Required in production, optional in dev | `ADMIN_SECRET_HASH`, `NEXT_PUBLIC_SITE_URL` |
| **RECOMMENDED** | Warns if missing, graceful degradation | Sentry DSN (`SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`), `TURNSTILE_SECRET_KEY` |
| **Local mode** | Never hard-fails; warns if LLM key missing | — |

### LLM provider configuration

| Provider | Env vars |
|---|---|
| Gemini (default) | `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL` (default: `gemini-2.0-flash`) |
| OpenAI-compatible | `LLM_PROVIDER=compatible`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` |
| JSON mode | `LLM_JSON_MODE=false` if your gateway rejects `response_format` |

### Stripe (currently disabled)

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are defined in `.env.example` but commented out. The checkout UI and webhook endpoint are inert without them.

## CI pipeline

`.github/workflows/ci.yml` runs on every push to `main` and every PR:

1. **Checkout + setup** — pnpm (via `pnpm/action-setup`), Node 24
2. **pnpm install --frozen-lockfile**
3. **pnpm lint** — ESLint
4. **pnpm typecheck** — TypeScript `--noEmit`
5. **pnpm test:coverage** — Vitest with coverage thresholds
6. **pnpm build** — Production build (with placeholder env vars for Supabase + LLM)

E2E tests are deferred (marked with a `ponytail:` comment) — they need a running server and seeded Supabase credentials.

### Local validation before PR

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Observability

### Sentry

Configured via `@sentry/nextjs`. Initialized in `/instrumentation.ts` when either `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` is set.

- Traces sample rate: `SENTRY_TRACES_SAMPLE_RATE` (default 0.1)
- `captureException()` in `/observability.ts` guards against missing DSN
- On `onRequestError` handler registered for Next.js error capture
- Production startup emits a console error if no DSN is configured

### Structured logging

All server-side logs use a JSON format via `/src/lib/observability.ts`:

```json
{"ts":"2026-07-20T...","level":"info","event":"api.chat.request_received","request_id":"...","method":"POST","path":"/api/chat"}
```

Events are consistently named `domain.event_name`. Request IDs are propagated from the `x-request-id` header or generated as UUIDs.

### Alert webhook

When credit system failures or abuse events occur, `alertSpendCreditsFailure()` posts to `ALERT_WEBHOOK_URL` (if configured).

## Supabase migrations

11 migrations under `/supabase/migrations/` in chronological order:

| Migration | Purpose |
|---|---|
| `0001_conversations.sql` | Conversations table |
| `0002_credits.sql` | Credits table + RPCs (spend, grant) |
| `0003_free_monthly.sql` | Monthly free credit reset |
| `0004_account_lifecycle.sql` | Account lifecycle management |
| `0005_legal_consent.sql` | Legal consent tracking |
| `0006_soft_delete_account.sql` | Soft-delete support |
| `0007_remove_soft_delete_account.sql` | Remove soft-delete |
| `0008_restore_credits_on_reregister.sql` | Restore credits on re-registration |
| `0009_abuse_defense.sql` | Rate limit logging + abuse tables |
| `0010_llm_circuit_breaker.sql` | Global LLM circuit breaker |
| `0011_daily_free_credits.sql` | Daily free credits (replaces monthly) |

Apply via Supabase Dashboard SQL editor (there's no CLI migration tool in this project).

### Migration invariants

- All credit mutations go through `SECURITY DEFINER` functions
- RLS is enabled on user-facing tables; users can only read their own rows
- The `credit_transactions.ref` unique index (partial, non-null ref only) provides webhook idempotency
- `try_log_llm_request` RPC is designed to fail open

## Content freshness

`node scripts/check.ts` (or `pnpm check`) scans all curated modules and reports:

- Modules missing a `reviewed` date
- Modules with `reviewed` older than 12 months

This is **informational only** — it never fails CI or blocks builds. To clear entries, re-verify the source documentation and bump the `reviewed: YYYY-MM` frontmatter field.

## Security

### HTTP headers

Set in `/next.config.ts` for all routes:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

No CORS headers — the API is same-origin only. Stripe webhooks use signature verification.

### Auth architecture

- **User auth**: Supabase Auth (hosted mode) or implicit local user (local mode)
- **Admin auth**: SHA-256 hashed secret, independent of Supabase. Cookie-based session with HMAC verification.
- **Prompt injection**: Identity guardrail + `sanitizeUserText()` fence/role-spoof neutralization

## Key source files

| File | Purpose |
|---|---|
| `.env.example` | All environment variables documented |
| `/src/lib/env.ts` | Tiered environment validation |
| `/src/lib/env.test.ts` | Validation tests |
| `/instrumentation.ts` | Boot validation + Sentry init |
| `/src/lib/observability.ts` | Structured logging + Sentry |
| `/src/lib/alerts.ts` | Failure alert webhook |
| `/next.config.ts` | Security headers |
| `.github/workflows/ci.yml` | CI pipeline |
| `supabase/migrations/` | All database migrations |
| `/scripts/check.ts` | Content freshness report |

## What to watch out for

- **No migration CLI** — apply migrations through the Supabase Dashboard SQL editor. Keep them numbered sequentially.
- **CI placeholder env vars** — the build step uses dummy Supabase values so the app compiles. The env validation runs at server start, not build time, so these never trigger it.
- **E2E tests are deferred** — `playwright.config.ts` and basic specs exist but are run manually. CI has no e2e job yet.
- **pnpm-lock.yaml is checked in** — use `--frozen-lockfile` in CI to ensure reproducible installs.
- **Sentry in production** — if no DSN is configured, exceptions go unseen. The startup log will shout about it.
