# Knowledge base

The interview-prep content is the core value of the project. It's organized as git-versioned Markdown files under `/content/`, grouped by technology stack.

## Content hierarchy (runtime quality)

At runtime, content is resolved in this priority order:

1. **Curated modules** (`content/<stack>/<topic>.md`) — hand-authored, source-backed, written for interview prep. These are the primary content.
2. **Ingested question banks** (`content/<stack>/_bank.md`) — verbatim from permissively-licensed public sources, fully attributed.
3. **LLM-generated content** — fallback when no curated module or bank exists for a topic.

## Directory structure

```
content/
  react/
    fundamentals.md        # Curated module
    hooks.md
    _bank.md               # Ingested question bank (underscore-prefixed = skipped by module loader)
  laravel/
    eloquent.md
    _bank.md
  python/
    fundamentals.md
    fastapi-fundamentals.md
    ...
  ...
  general/
    landing-sample-react-node.md   # Demo sample for the landing page
    technical-interview-strategy.md
  SOURCES.md               # Source policy + per-stack source map
  README.md                # File format specification
```

## Module file format

Each curated module is a Markdown file with standard frontmatter and three recognized H2 sections.

### Frontmatter

```yaml
---
stack: laravel                 # Must match a content/ subdirectory name
id: laravel-apis-rest          # Stable, unique identifier (used for matching)
title: RESTful APIs with Laravel
area: Backend                  # Grouping shown in the roadmap
priority: high                 # high | medium | low
resourceLabel: Laravel, API Resources   # Optional "go deeper" link label
resourceUrl: https://laravel.com/docs/eloquent-resources   # Optional
reviewed: 2026-07              # YYYY-MM last verified against source
appliesTo: laravel@11          # Optional version marker
---
```

### Body sections

| Section | Content |
|---|---|
| `## Summary` | One-line orientation |
| `## Concepts` | One `### Concept Name` per concept. Each can have `#### Details`, `#### Examples`, `#### Sources` sub-sections |
| `## Interview Questions` | One `### Question?` per Q&A, with concise model answer |

Inside Concepts, each `###` heading is one item. For legacy concepts, a fenced code block inside a concept becomes its first example. For richer concepts, use `#### Details`, `#### Examples`, and `#### Sources`; every fenced code block under Examples is rendered as its own example, and Sources are rendered as references below the concept.

See `/content/README.md` for the full specification.

## Content freshness

Content ages as frameworks evolve. Two frontmatter fields track this:

- **`reviewed: YYYY-MM`** — when the module was last verified against its source documents. Bump it whenever you re-verify the content, even if nothing changed.
- **`appliesTo`** — optional version marker (e.g. `next@15`, `laravel@11`) clarifying which version the content targets.

Run `pnpm check` (or `node scripts/check.ts`) to see which modules are missing a `reviewed` date or are older than 12 months. The report is informational and never fails CI.

## Ingested question banks (`_bank.md`)

Files prefixed with `_` (e.g. `react/_bank.md`) are **ingested from real public sources** with permissive licenses. They are skipped by the module loader and hold attributed question banks.

### Ingestion framework

Located at `/scripts/ingest/`:

- **`run.mjs`** — registry of adapters, runs all or one
- **`core.mjs`** — shared framework: fetches source, enforces license gate, writes attributed bank file
- **`adapters/`** — individual adapters (currently: `react-sudheerj.mjs`, `python-devlovers.mjs`)

```bash
pnpm ingest                  # Run all adapters
pnpm ingest react-sudheerj   # Run one
```

### License gate

The ingester **refuses to write** any bank whose source license isn't in the redistribution allowlist:

- Allowed: MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC0-1.0, CC-BY-4.0, CC-BY-3.0
- **No LICENSE file = all-rights-reserved by default** = NOT allowed

Every ingested bank file preserves attribution (repo, URL, license, copyright) in its frontmatter and as an HTML comment.

## Source policy (3 tiers)

From `/content/SOURCES.md`:

1. **Curated content** — written by us, grounded in **official documentation** (react.dev, laravel.com, MDN, php.net) and cited inline. Never copy third-party text without a license.
2. **Community repos as topic guide** — used only to decide which topics/questions are common (ideas aren't copyrightable). We do NOT copy their text.
3. **Ingested banks (`_bank.md`)** — only redistribution of third-party text, and only under a permissive license.

## Adding new content

See `/docs/adding-content.md` for the canonical guide. It covers:

- Philosophy: content comes from authoritative sources, interview-oriented, not a CS lecture
- File format rules
- Module checklist (8 module types as reference)
- Ingest policy
- Verification steps

Key rules when adding content:
- Never paste third-party text; write in your own words and cite inline
- Cover what interviewers actually ask (architecture, design, tradeoffs, scenarios)
- Each module should have 3-5 concepts and 3-5 questions
- Update `content/SOURCES.md` when adding a new stack

## Stacks currently covered

| Stack | Modules | Ingested bank |
|---|---|---|
| React | 9 modules | Yes |
| Laravel | 8 modules | Yes |
| PHP | 4 modules | — |
| Python | 7 modules | Yes |
| JavaScript | 1 module | Yes |
| TypeScript | 2 modules | — |
| Java / Spring Boot | 2 modules | Yes |
| C# / .NET | 2 modules | Yes |
| Rust | 2 modules | Yes |
| Go | 2 modules | Yes |
| C++ | 2 modules | Yes |
| Vue | 2 modules | — |
| Angular | 2 modules | Yes |
| Next.js | 2 modules | Yes |
| Node.js | 2 modules | — |
| SQL | 3 modules | — |
| DevOps | 3 modules | — |
| System Design | 3 modules | — |
| General | 1 module | — |

## Key source files

| File | Purpose |
|---|---|
| `/content/README.md` | File format specification |
| `/content/SOURCES.md` | Source policy + per-stack sources |
| `/docs/adding-content.md` | Content contribution playbook |
| `/src/lib/content.ts` | Module parser, loader, freshness checker |
| `/scripts/ingest/run.mjs` | Ingestion runner |
| `/scripts/ingest/core.mjs` | Ingestion framework + license gate |
| `/scripts/check.ts` | Content freshness report |
| `/src/lib/landing-sample.ts` | Landing page demo parser |

## What to watch out for

- **`_`-prefixed files are skipped** by the module loader. Don't change this naming convention.
- **Freshness is informational** — `pnpm check` never fails. Missing `reviewed` dates won't block CI, but stale content degrades quality.
- **Ingest minimums** — adapters require at least 20 parsed items and 10 filter-surviving items. If a source format changes, the ingest will throw, not silently write garbage.
- **License gate is strict** — adding an adapter for a source without a permissive license will fail at runtime.
