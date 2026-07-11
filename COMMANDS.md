# Commands

Every command available in the project. Run from the repo root. Package manager: **pnpm**.

## Development

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server (hot reload) at `http://localhost:3000`. |
| `pnpm build` | Production build. |
| `pnpm start` | Serve the production build (run `pnpm build` first). |
| `pnpm lint` | Run ESLint over the codebase. |

## Content & checks

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (Vitest): `extractJson`, `parseTopicMarkdown`, `monthsSince`, credits math, env validation, prompt sanitization. |
| `pnpm test:coverage` | Same, with a coverage report and thresholds (what CI runs). |
| `pnpm check` | Content-freshness report (informational; never fails). See below. |
| `pnpm ingest` | Run every ingest adapter (rebuilds all `_bank.md` question banks). |
| `pnpm ingest <source>` | Run one adapter, e.g. `pnpm ingest react-sudheerj`. |

Equivalent raw calls (no pnpm): `node scripts/check.ts`, `node scripts/ingest/run.mjs [source]`.

### Content freshness (`pnpm check`)

Prints every curated module missing a `reviewed` date or older than **12 months**, sorted
most-urgent first. It's **informational**, it never fails the check, it just gives you a
worklist. To clear an entry, re-verify the module against its source and bump `reviewed: YYYY-MM`
in its frontmatter. See [content/README.md](content/README.md) for the format.

```bash
pnpm check
# ...
# ⚠ 59 module(s) need review (missing date or >12mo old):
#   angular/angular-advanced, never reviewed
#   ...
```

## Notes

- Unit tests run on **Vitest** (`src/lib/*.test.ts`); `pnpm test:coverage` enforces coverage
  thresholds on the money/security modules. `scripts/check.ts` is only the freshness report now.
- Ingest **refuses to write** any bank whose source license isn't in the redistribution
  allowlist (MIT, ISC, Apache-2.0, BSD, CC0, CC-BY). See [content/SOURCES.md](content/SOURCES.md).
</content>
</invoke>
