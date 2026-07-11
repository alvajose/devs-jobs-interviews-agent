# Interviews Agent

**Interviews Agent** is a Next.js 16 application that generates personalized interview-prep roadmaps. Paste a job offer or describe your target role + stack, and it produces a study plan with the exact topics to master, grounded in official documentation.

- **Live demo:** [interviewsagent.carinaex.com](https://interviewsagent.carinaex.com)
- **License:** MIT

## How it works

1. You describe your role, seniority, target stack, and study availability.
2. The app calls an LLM (Gemini or any OpenAI-compatible provider) to generate a **roadmap**: grouped modules with concepts, interview questions, and a week-by-week study plan.
3. Where curated content exists for a module, it's served from the git-versioned knowledge base in `content/`. Otherwise the LLM generates it.
4. You chat with the roadmap, get deeper answers, and edit the plan. Conversations are saved.

## Dual mode

The same codebase runs in two modes. Mode is resolved at startup by `src/lib/mode.ts`.

| Feature | Local | Hosted |
|---|---|---|
| Entry point (`/`) | Chat directly | Marketing landing |
| Auth | None (single implicit user) | Supabase accounts + `/login` |
| Persistence | SQLite (`./data/local.db`) | Supabase Postgres |
| Billing / credits | Off | Daily free credits + Stripe |
| Terms / Privacy / Refund | Hidden | Shown |

**Local mode** is the OSS single-user experience: clone, add an LLM key, run. No database service, no login, no payments.

**Hosted mode** is the full product with accounts, credits, rate limiting, and abuse defense. It powers the live demo.

## Quick start (local)

```bash
git clone https://github.com/alvajose/interviews-agent.git
cd interviews-agent
pnpm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_APP_MODE=local
GEMINI_API_KEY=your_gemini_key      # free at https://aistudio.google.com/apikey
```

Or use any OpenAI-compatible provider:

```env
NEXT_PUBLIC_APP_MODE=local
LLM_PROVIDER=compatible
LLM_API_KEY=your_key
LLM_BASE_URL=https://your-provider/v1
LLM_MODEL=your_model
```

Then:

```bash
pnpm dev
```

Open **http://localhost:3000** — no sign-up, straight into the chat.

> **Force local mode** without editing `.env.local`: `pnpm dev:local`

## Dev commands

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (hot reload) |
| `pnpm dev:local` | Dev server forced to local mode |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:coverage` | Tests + coverage thresholds |
| `pnpm check` | Content freshness report |
| `pnpm ingest` | Rebuild all ingested question banks |
| `pnpm test:e2e` | Playwright end-to-end tests |

## Documentation map

| Page | What it covers |
|---|---|
| [Architecture overview](/openwiki/architecture/overview.md) | Next.js 16 setup, dual-mode, request flow, module layout, key decisions |
| [Knowledge base](/openwiki/content/knowledge-base.md) | Content curation format, ingested banks, freshness, source policy, adding content |
| [Credits & billing](/openwiki/business/credits-billing.md) | Credits system, rate limiting, abuse defense, Stripe, admin gate |
| [Operations & deployment](/openwiki/operations/deployment.md) | Env config, CI, observability, Supabase migrations, security |

## Repository layout

```
src/
  app/
    api/chat/         # Chat endpoint (roadmap conversation + editing)
    api/roadmap/      # Roadmap generation endpoint
    api/conversations/# CRUD for conversation history
    api/bank/         # Question bank serving
    api/stripe/*      # Payment endpoints (disabled)
    api/account/      # Account export
    api/profile/      # Profile management
    api/credits/      # Credit balance
    (pages)           # Landing, /app, /login, /profile, /admin, /credits, legal pages
  lib/
    mode.ts           # Local vs hosted mode resolution
    env.ts            # Environment validation (tiered)
    llm.ts            # Provider-agnostic LLM wrapper
    content.ts        # Module parser and loader
    prompts.ts        # Prompt builders + guardrails
    credits.ts        # Credit reserve/spend/release
    abuse.ts          # Rate limiting + payload validation
    store/            # Conversation persistence (SQLite | Supabase)
    supabase/         # Supabase client factories
    types.ts          # Core domain types
    observability.ts  # Structured logging + Sentry
  proxy.ts            # Next 16 proxy (session + legal-consent gate)
content/              # Curated interview modules + question banks
supabase/migrations/  # Postgres schema (hosted mode)
scripts/
  check.ts            # Content freshness report
  dev-local.mjs       # Force-local dev script
  ingest/             # Question bank ingestion framework
```

## Key technical facts

- **Next.js 16** — uses `proxy.ts` (replaces `middleware.ts`), `instrumentation.ts` for boot-time validation
- **Node.js 24+** required, **pnpm** as package manager
- **TypeScript strict** — full strict mode enabled
- **No RAG/embeddings yet** — content is static Markdown, loaded and parsed directly
- **LLM-agnostic** — Gemini native or any OpenAI-compatible endpoint
- **Prompt injection defense** — guardrail system prompt + sanitizeUserText()
