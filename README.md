<div align="center">

# Interviews Agent

**Describe the role and stack you're interviewing for, and get a personalized interview-prep
roadmap: the exact topics to master, with concepts and real interview questions, grounded in
official documentation.**

[![CI](https://github.com/alvajose/interviews-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/alvajose/interviews-agent/actions/workflows/ci.yml)
[![License: FSL-1.1-ALv2](https://img.shields.io/badge/license-FSL--1.1--ALv2-blue.svg)](LICENSE.md)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6)

### ▶ [Try the free live demo](https://interviewsagent.carinaex.com) &nbsp;·&nbsp; or [run it locally](#quick-start-local) in two minutes

<img width="840" alt="Interviews Agent,  a personalized study roadmap" src="https://github.com/user-attachments/assets/0a17cc69-e542-46dc-b876-1fc8e45ff7e8" />

</div>

Interviews Agent runs **fully local** out of the box, SQLite, no login, bring your own LLM
key. The same codebase powers the hosted product (accounts + credits) when you configure it.
It's grounded in official docs and the
[Tech Interview Handbook](https://www.techinterviewhandbook.org/).

## Try it

- **Fastest:** open the [free live demo](https://interviewsagent.carinaex.com), no install, no sign-up
  to look around.
- **On your machine:** the [local quick start](#quick-start-local) below runs the whole app with
  just an LLM key.

## Quick start (local)

Runs entirely on your machine with SQLite, no login, no database service, no payments.
The only thing you need is an LLM API key.

**Prerequisites:** Node.js 24+ and pnpm (`corepack enable` picks the pinned version).

```bash
git clone https://github.com/alvajose/interviews-agent.git
cd interviews-agent
pnpm install
cp .env.example .env.local
```

Edit `.env.local` so it contains just these two lines (the rest is only for hosted mode):

```env
NEXT_PUBLIC_APP_MODE=local
GEMINI_API_KEY=your_gemini_key      # free key at https://aistudio.google.com/apikey
```

Prefer a different model? Instead of the Gemini key, point it at any OpenAI-style
chat-completions endpoint (OpenCode Go, DeepSeek, OpenRouter, a local model…):

```env
NEXT_PUBLIC_APP_MODE=local
LLM_PROVIDER=compatible
LLM_API_KEY=your_key
LLM_BASE_URL=https://your-provider/v1
LLM_MODEL=your_model
# If the gateway 400s about response_format, add: LLM_JSON_MODE=false
```

Then start it:

```bash
pnpm dev
```

Open **http://localhost:3000/app**, no sign-up, straight in. Your conversations are saved
to a local SQLite file at `./data/local.db` (gitignored). That's it.

## Hosted mode (optional)

To run the full product, Supabase accounts, credits, and abuse defense, set
`NEXT_PUBLIC_APP_MODE=hosted` (or just provide the Supabase env vars) and fill in the rest of
`.env.example`. Boot validation in `src/lib/env.ts` fails fast and lists any missing required
variable. You only need this to deploy the paid, multi-user version.

## Contributing

Contributions are very welcome, **especially to the agent's knowledge base and its docs.**

The project's real value is well-sourced, study-worthy interview content, so **any improvement
to the documentation the agent teaches from is genuinely appreciated**: adding a tech stack,
sharpening a concept, fixing an example, or clarifying a guide.

- **Add or improve interview content** → [docs/adding-content.md](docs/adding-content.md)
- **Setup, checks, and code style** → [CONTRIBUTING.md](CONTRIBUTING.md)

Open an issue to discuss anything larger, or send a PR for small fixes. Every doc improvement
helps someone prep better.

## Checks

```bash
pnpm lint            # eslint
pnpm typecheck       # tsc --noEmit
pnpm test            # unit tests (Vitest)
pnpm test:coverage   # unit tests + coverage thresholds
pnpm check           # content-freshness report (informational)
pnpm test:e2e        # Playwright end-to-end
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests with coverage, and a build on
every push to `main` and every PR.

## Project layout

```
src/
  app/
    api/            # chat, roadmap, profile, bank, stripe/*, credits, account, landing
    (routes)        # /app, /login, /profile, /admin, /credits, /terms, /privacy
  lib/
    env.ts          # boot-time env validation (tiered: CORE / prod / recommended)
    mode.ts         # local vs hosted runtime switch
    llm.ts          # provider wrapper (gemini | openai-compatible), no SDKs
    store/          # conversation persistence (SQLite local / Supabase hosted)
    prompts.ts      # prompt builders
  proxy.ts          # session + legal-consent gate (Next 16 replaces middleware.ts)
content/            # curated interview modules + question banks (see docs/adding-content.md)
supabase/migrations # Postgres schema for hosted mode
```

## Notes

- **Persistence:** local mode stores conversations in SQLite (`./data/local.db`); hosted mode
  uses Supabase Postgres (schema in `supabase/migrations`).
- No RAG/embeddings yet, the content taxonomy is static. Add pgvector only if keyword/structural
  matching falls short.

## License

[Functional Source License 1.1 (ALv2 future)](LICENSE.md), see [LICENSE.md](LICENSE.md).

In plain terms:

- **Free** to use, self-host, modify, and study, including internal commercial use, education,
  and research.
- **Not allowed:** using it to build a product or service that competes with our hosted offering.
  For that, talk to us.
- Each release **converts to Apache 2.0** two years after it's published.

FSL is "source-available", not an OSI-approved open-source license. Want a commercial
arrangement? Reach out at help@carinaex.com.
