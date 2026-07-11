# Knowledge base

Curated interview-prep content. One Markdown file per topic, grouped by stack:

```
content/
  laravel/
    apis-rest.md
  react/
    hooks.md
```

This is the canonical store: git-versioned, human-editable, and the exact corpus we'll
later embed into a vector DB for RAG. The agent serves curated content when a topic exists
here and falls back to LLM-generated content otherwise.

## File format

```md
---
stack: laravel                 # folder/stack key
id: laravel-apis-rest          # stable id (used to match & link)
title: RESTful APIs with Laravel
area: Backend                  # grouping shown in the roadmap
priority: high                 # high | medium | low
resourceLabel: Laravel, API Resources   # optional "go deeper" link label
resourceUrl: https://laravel.com/docs/eloquent-resources   # optional
reviewed: 2026-07              # YYYY-MM last verified against the source (freshness check)
appliesTo: laravel@11         # optional: version(s) this content covers
---

## Summary
One line orienting the module.

## Concepts

### Concept name
Explanation in prose (markdown ok).
```php
// optional code example, rendered as a snippet
$users = User::with('posts')->get();
```

Optional structured format for source-backed concepts:

#### Details
One or more paragraphs distilled from the source material.

#### Examples
Short label for the example
```php
$users = User::with('posts')->get();
```

Another example
```php
return UserResource::collection(User::paginate());
```

#### Sources
- [Laravel docs, Eloquent API Resources](https://laravel.com/docs/eloquent-resources)

## Interview Questions

### The interview question?
The model answer / talking points.
```

Rules: `## Summary`, `## Concepts`, `## Interview Questions` are the recognized H2 sections.
Inside Concepts/Questions, each `### ` heading is one item. For legacy concepts, a fenced
code block inside a concept becomes its first example. For richer concepts, use `#### Details`,
`#### Examples`, and `#### Sources`; every fenced code block under Examples is rendered as its
own example, and Sources are rendered as references below the concept.

## Keeping content fresh

Content ages: frameworks change APIs across versions. Two frontmatter fields track this:

- `reviewed: YYYY-MM`, when the module was last checked against its source. Bump it whenever
  you re-verify the content, even if nothing changed.
- `appliesTo`, optional version marker (e.g. `next@15`) so it's clear what the content targets.

`node scripts/check.ts` prints every module missing a `reviewed` date or older than 12 months,
so re-verification is a list to work through, not something you have to remember. The report is
informational, it never fails the check.

## Ingested content (`_`-prefixed files)

Files starting with `_` (e.g. `react/_bank.md`) are **ingested from real public sources**, not
hand-authored, and are skipped by the module loader. They hold attributed question banks.

Ingestion is an adapter pipeline under `scripts/ingest/`:

```
node scripts/ingest/run.mjs                # run all sources
node scripts/ingest/run.mjs react-sudheerj # run one
```

## Landing sample roadmap

`content/general/landing-sample-react-node.md` powers the public landing page
**Sample roadmap preview**. Edit that file to change the demo roadmap; the page
loads it server-side via `src/lib/landing-sample.ts` (not hardcoded in React).

**Adding a source:** drop an adapter in `scripts/ingest/adapters/` exporting
`{ name, slug, stack, kind, source: { repo, url, raw, license, copyright }, parse(raw) }`
and register it in `run.mjs`. The core **refuses to write unless the license is in the
redistribution allowlist** (MIT, ISC, Apache-2.0, BSD, CC0, CC-BY), sources without a
permissive license must be referenced by link, never copied.

