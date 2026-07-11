# Architecture overview

## Next.js 16 App Router

This project uses **Next.js 16** with the App Router. Key Next.js 16-specific choices:

- **`proxy.ts`** (replaces `middleware.ts`) — handles Supabase session refresh and route protection in hosted mode. Located at `/src/proxy.ts`. It guards protected routes, redirects authenticated users away from `/login`, and enforces the legal-consent gate.
- **`instrumentation.ts`** — calls `validateEnv()` at server startup and initializes Sentry. Located at `/instrumentation.ts`.
- **`server-only`** — consistently applied to lib modules that deal with secrets, database, or auth.
- **Geist fonts** via `next/font/google`, **OG/Twitter images** via `satori`.

## Dual-mode system

The app runs in **local** or **hosted** mode, resolved by `/src/lib/mode.ts`:

```
Priority: NEXT_PUBLIC_APP_MODE > APP_MODE > heuristic (Supabase URL present → hosted)
```

- **Local mode**: single implicit user (`LOCAL_USER = { id: "local", email: null }`), SQLite persistence, no billing. The landing page `/` renders the chat directly.
- **Hosted mode**: Supabase auth, Postgres persistence, daily free credits + Stripe (disabled), rate limiting, abuse defense, legal pages.

The mode is checked at runtime via `isLocal()` / `isHosted()` throughout the codebase. The `proxy.ts` short-circuits entirely in local mode.

See [quickstart](/openwiki/quickstart.md) for the feature comparison table.

## Environment validation

`/src/lib/env.ts` provides a tiered validation system called during boot:

| Tier | Behavior | Examples |
|---|---|---|
| **CORE** | Always throws if missing | `NEXT_PUBLIC_SUPABASE_URL`, LLM key |
| **PROD_REQUIRED** | Throws in production, warns in dev | `ADMIN_SECRET_HASH`, `NEXT_PUBLIC_SITE_URL` |
| **RECOMMENDED** | Always warns | Sentry DSN, Turnstile keys |

In local mode, validation never hard-fails — only warns if the LLM key is missing. This ensures `git clone && pnpm dev` always boots.

## Request flow

### Roadmap generation (`POST /api/roadmap`)

1. **Validation** — payload limits, profile field length checks (via `validateRoadmapPayload` in `/src/lib/abuse.ts`)
2. **Auth** — `getSessionUser()` returns the implicit local user or the Supabase-authenticated user
3. **Hosted rate limiting** — `enforceLlmRateLimit()` via Supabase RPC (`try_log_llm_request`) for per-user, per-IP, and optional global circuit breaker
4. **Hosted credit reservation** — `reserveForLlm()` calls `reserve_credits` RPC, holds 1 credit
5. **Stack detection** — user input is matched against a stack lexicon (aliases like `js → javascript, typescript, node, nodejs`)
6. **Content loading** — `loadCuratedModules()` reads all curated Markdown files; `availableBankStacks()` identifies stacks with question banks
7. **LLM call #1 (routing)** — `buildRoutingPrompt()` asks the LLM to determine which curated modules match the target stack
8. **LLM call #2 (roadmap)** — `buildRoadmapPrompt()` generates the full roadmap JSON with modules, concepts, questions, and a week-by-week plan
9. **Post-processing** — modules are matched against the curated catalog, curated concepts/questions replace generated ones, `recommendedExtra` stacks are tagged, practice resources attached
10. **Settlement** — `settleLlmCharge()` deducts remaining credits; analytics event is fired

### Chat (`POST /api/chat`)

1. **Payload validation** — message count (max 40), text length (max 8K chars per message), total payload (max 80K chars)
2. **Auth + credit gate** — same pattern as roadmap
3. **Mode detection** — roadmap already exists in messages; the chat is either follow-up questions or edits
4. **LLM call** — `buildChatPrompt()` for follow-up Q&A or `buildEditPrompt()` for roadmap edits
5. **Reply is streamed** (planned) or returned as JSON

### Conversation persistence

- **Local mode**: `/src/lib/store/sqlite-conversations.ts` — uses Node 24's built-in `node:sqlite` (lazy-loaded dynamic import) to write to `./data/local.db`
- **Hosted mode**: `/src/lib/store/supabase-conversations.ts` — uses Supabase REST client
- Both implement the `ConversationStore` interface from `/src/lib/store/index.ts`, selected at runtime via `conversationStore()`

## LLM integration

`/src/lib/llm.ts` provides a provider-agnostic wrapper:

```
Provider = "gemini" (default) | "compatible" (any OpenAI chat-completions endpoint)
```

- No SDK dependencies — both providers are reached over plain `fetch`
- `generateJson()` — forces JSON mode, retries up to 3 times on malformed output, uses `response_format: { type: "json_object" }` when supported
- `generateText()` — free-form conversational output
- `extractJson()` — parses JSON from potentially fenced/wrapped model output
- `LlmCapacityError` — mapped to HTTP 503 when providers return rate-limit / quota errors
- Prompt caching is implicitly supported by compatible providers (DeepSeek, etc.), no `cache_control` flags needed

## Prompt system

`/src/lib/prompts.ts` builds all LLM prompts:

- **Guardrail** — hard-coded identity/disclosure/anti-injection section prepended to every system prompt. Prevents model from revealing infrastructure, obeying "admin override" social engineering, or accepting instructions from user text.
- **`sanitizeUserText()`** — neutralizes `"""` fence breaking and `"Coach:"`/`"System:"` role spoofing in user input.
- **`buildRoadmapPrompt()`** — generates the main roadmap. Recommends complementary stacks, enforces interview-oriented (not CS-lecture) framing, sets output JSON schema.
- **`buildChatPrompt()`** — follow-up Q&A in context of the roadmap.
- **`buildEditPrompt()`** — edit existing roadmap modules.

## Content routing

When the roadmap is generated, each module is checked against the curated content catalog:

- If a module `id` matches a curated module, the curated `concepts` and `questions` replace the LLM-generated ones.
- If a module's stack has an ingested `_bank.md`, questions are routed from it and tagged with their source repo/license/copyright.
- The `coding-practice` module is special: `attachPracticeResource()` injects external LeetCode/Grind 75 links.

## Security architecture

- **No CORS** — API is same-origin only. Stripe webhooks are server-to-server with signature verification.
- **Security headers** in `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS, strict referrer policy, permissions policy disabling camera/mic/geolocation.
- **Auth separation** — admin gate (SHA-256 hash) is independent of Supabase auth.
- **Prompt injection** — identity guardrail + `sanitizeUserText()`.
- **Payload limits** — enforced before any LLM call or database write.
- **Turnstile CAPTCHA** — optional Cloudflare Turnstile integration for hosted mode.

## Key source files

| File | Purpose |
|---|---|
| `/src/lib/mode.ts` | Runtime mode resolution |
| `/src/lib/env.ts` | Tiered environment validation |
| `/src/proxy.ts` | Next 16 proxy (session, route guard) |
| `/instrumentation.ts` | Boot validation + Sentry init |
| `/src/lib/llm.ts` | Provider-agnostic LLM wrapper |
| `/src/lib/prompts.ts` | Prompt builders + guardrails |
| `/src/lib/content.ts` | Module parser, loader, freshness check |
| `/src/lib/store/index.ts` | Conversation store abstraction |
| `/src/lib/session.ts` | Session abstraction (local vs hosted) |
| `/src/app/api/chat/route.ts` | Chat endpoint |
| `/src/app/api/roadmap/route.ts` | Roadmap generation endpoint |
| `/next.config.ts` | Security headers, general config |

## What to watch out for

- **Next.js 16 breaking changes** — `proxy.ts` file name and API differ from `middleware.ts` in earlier versions. Check `node_modules/next/dist/docs/` before changing routing behavior.
- **Node 24 `node:sqlite`** — dynamically imported so hosted deployments don't need it. Not available in older Node versions.
- **Mode must be consistent** — client and server agree via `NEXT_PUBLIC_APP_MODE`. Don't rely on `APP_MODE` alone.
- **Stripe is disabled** — `SHOW_PRICING_AND_REFUNDS = false`, checkout UI is hidden, webhook endpoint is inert without keys.
