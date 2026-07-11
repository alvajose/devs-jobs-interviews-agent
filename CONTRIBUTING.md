# Contributing

Thanks for your interest in improving Interviews Agent. This project is
licensed under the [MIT License](LICENSE).

## Prerequisites

- Node.js 24+
- pnpm (the repo pins it via the `packageManager` field; `corepack enable` will pick the right version)

## Setup

```bash
pnpm install
cp .env.example .env.local
```

For local development you only need an LLM key. In `.env.local`:

```env
NEXT_PUBLIC_APP_MODE=local
GEMINI_API_KEY=your_key        # or set LLM_PROVIDER=compatible + LLM_API_KEY
```

In **local mode** there's no login, no database service, and no payments, it runs
on a local SQLite file. (The hosted product adds Supabase + Stripe; you don't need
those to contribute.)

```bash
pnpm dev
```

## Before you open a PR

CI runs these on every PR, run them locally first so it's green:

```bash
pnpm lint
pnpm typecheck
pnpm test          # unit tests (Vitest)
pnpm test:coverage # tests + coverage thresholds (what CI enforces)
```

## Adding interview content

Want to add a tech stack or interview modules? That's the highest-value contribution. Follow
[docs/adding-content.md](docs/adding-content.md), it covers the file format, the sourcing and
license policy (important: don't copy from no-license repos), and how to verify.

## Code style

- Match the surrounding code, naming, structure, comment density.
- Identifiers, comments, UI copy, and docs are in **English**.
- Keep diffs focused. For anything non-trivial, open an issue first so we can agree on the approach.
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`…).

## Licensing of contributions

Contributions are made under the project's [MIT license](LICENSE).

## Questions

Open an issue, or reach out at help@carinaex.com.
