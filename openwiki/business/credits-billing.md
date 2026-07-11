# Credits & billing

The credits system governs LLM usage in **hosted mode**. In **local mode**, you bring your own LLM API key and there are no credit gates or billing — every call goes through directly.

## Credits architecture

The credit system has two parallel buckets per user, stored in the `public.user_credits` table (Supabase Postgres):

| Bucket | Source | Expiry |
|---|---|---|
| **Free balance** (`free_balance`) | Daily top-up | Capped at `free_cap()` (50), unused credits carry over |
| **Paid balance** (`balance`) | Stripe purchases (disabled) | Never expires |

Effective available credits = `free_balance` (after daily top-up) + `paid_balance`. Computed by the `available_credits()` RPC.

### Daily free credits

- Each active day tops up the free bucket by `daily_free()` (25 credits)
- Never exceeds `free_cap()` (50 credits)
- Lazy refresh: the top-up is computed on read/spend, no cron job required
- Defined in `/supabase/migrations/0011_daily_free_credits.sql`

### Credit math

Defined in `/src/lib/credits-math.ts`:

```
TOKENS_PER_CREDIT = 1000
creditsFor(usage) = ceil((inputMiss + output) / 1000)
```

- Cache hits (`inputHit`) are billed at zero — the provider returns them at no cost
- Every LLM call costs minimum 1 credit
- Tokens are estimated at ~4 chars/token when the provider omits usage metadata

## Reserve / spend / release flow

LLM calls in hosted mode follow a transactional pattern:

```
reserveForLlm(supabase, context)      # Hold 1 credit
    ↓
  [LLM call succeeds?]
    ├─ YES → settleLlmCharge(usage)   # Deduct remaining credits beyond the hold
    └─ NO  → releaseLlmReserve()      # Return the held credit
```

This is implemented in `/src/lib/credits.ts`:

1. **`reserveForLlm()`** — calls `reserve_credits(p_amount: 1)` RPC. Serializes on the user's row (`FOR UPDATE`), fails closed with `{ ok: false }` if balance is insufficient or the RPC errors.
2. **`settleLlmCharge()`** — calls `additionalCreditsAfterReserve(usage)` to compute the overage, then calls `spend_credits()` RPC.
3. **`releaseLlmReserve()`** — calls `refund_credits()` RPC to return the held credit.

All credit mutations go through `SECURITY DEFINER` SQL functions (never from the client), so the write path is locked down. An alert webhook fires on failures via `alertSpendCreditsFailure()`.

## Rate limiting

Three independent rate limits, enforced before the credit gate:

| Limit | Config env var | Default | Mechanism |
|---|---|---|---|
| Per-user | `LLM_RATE_LIMIT_USER` | 8 req/min | `try_log_llm_request` RPC |
| Per-IP | `LLM_RATE_LIMIT_IP` | 20 req/min | Same RPC |
| Global circuit breaker | `LLM_RATE_LIMIT_GLOBAL` | 0 (disabled) | Same RPC |

All are implemented in a single RPC call `try_log_llm_request` (migration 0009 + 0010). The RPC:
1. Returns `"saturated"` if the global ceiling is exceeded
2. Returns `"rate_limited"` if per-user or per-IP limit is exceeded
3. Returns `"ok"` otherwise, logging the request

**Fail-open design**: if the RPC errors (e.g. migration lag), rate limiting is skipped. The app never bricks due to a database schema mismatch.

### Circuit breaker

The global limit (`LLM_RATE_LIMIT_GLOBAL`) caps total LLM spend across ALL users in a window. Set it in production (e.g. 300) to cap spend under a distributed burst. 0 = disabled.

Defined in `/supabase/migrations/0010_llm_circuit_breaker.sql`.

## Abuse defense

### Payload limits

`/src/lib/payload-limits.ts` enforces strict bounds on all API inputs:

| Limit | Value |
|---|---|
| Max messages per request | 40 |
| Max text per message | 8,000 characters |
| Max total payload | 80,000 characters |
| Max roadmap target | 500 characters |
| Max profile field | 200 characters |

### Turnstile CAPTCHA

Optional Cloudflare Turnstile integration. When `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set, the CAPTCHA is verified on login/signup. No key → CAPTCHA is skipped entirely.

## Stripe integration (disabled)

Stripe payments are **currently disabled**. The code and migrations exist but are inert:

- **Checkout** — `POST /api/stripe/checkout` creates a Stripe Checkout Session
- **Webhook** — `POST /api/stripe/webhook` handles `checkout.session.completed`
- **UI** — controlled by `SHOW_PRICING_AND_REFUNDS = false` in `/src/lib/billing-ui.ts`

To re-enable:
1. Fill `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env.local`
2. Set `SHOW_PRICING_AND_REFUNDS = true`
3. Uncomment the Stripe-UI code (checkout button, pricing page)

The webhook uses Stripe signature verification and is idempotent on the Stripe session ID (`credit_transactions.ref` unique index).

## Admin gate

The `/admin` page is protected by a separate authentication layer independent of Supabase auth:

- **Secret verification**: user submits a secret → SHA-256 hash is compared against `ADMIN_SECRET_HASH`
- **Session cookie**: HMAC-SHA256 derived token stored in `admin_session` cookie (8-hour expiry, httpOnly, sameSite: strict)
- **Plaintext secret is never stored** — only its hash is in the environment

Generate the hash: `node -e "console.log(require('node:crypto').createHash('sha256').update('YOUR_SECRET').digest('hex'))"`

## Key source files

| File | Purpose |
|---|---|
| `/src/lib/credits.ts` | Reserve/spend/release helpers |
| `/src/lib/credits-math.ts` | Token-to-credit conversion, constants |
| `/src/lib/abuse.ts` | Rate limiting, payload validation |
| `/src/lib/payload-limits.ts` | Payload size constants + validators |
| `/src/lib/billing-ui.ts` | UI toggle for Stripe surfaces |
| `/src/lib/admin-auth.ts` | Admin gate implementation |
| `/src/lib/alerts.ts` | Failure alert webhook |
| `/src/lib/turnstile.ts` | Cloudflare Turnstile verification |
| `/supabase/migrations/0002_credits.sql` | Credits schema + RPCs |
| `/supabase/migrations/0009_abuse_defense.sql` | Rate limit logging table |
| `/supabase/migrations/0010_llm_circuit_breaker.sql` | Global circuit breaker |
| `/supabase/migrations/0011_daily_free_credits.sql` | Daily free credit functions |
| `/src/app/api/stripe/webhook/route.ts` | Stripe webhook handler |
| `/src/app/api/stripe/checkout/route.ts` | Stripe checkout handler |

## What to watch out for

- **Constants must match between JS and SQL** — `DAILY_FREE_CREDITS` (25) and `FREE_CREDIT_CAP` (50) in `credits-math.ts` must stay in sync with `daily_free()` and `free_cap()` in the SQL migration. Change both together.
- **Stripe is quasi-deleted** — don't assume checkout/credits UI works. The webhook is tested to compile but has no live integration. Re-enable carefully.
- **Rate limit fail-open** — if the `try_log_llm_request` RPC errors, rate limits are silently skipped. Monitor for this in Stripe.
- **Admin secret hash** — if you lose the hash or the original secret, you're locked out of admin. Keep the hash in a password manager.
