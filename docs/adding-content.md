# Adding interview content (stacks & modules)

This is the canonical guide for growing the interview-prep knowledge base. It's written for
**human contributors**, and it doubles as a **playbook for AI agents** assisting with content:
if you're an agent asked to "add a stack", "create content for X", "complete X", or "ingest
interview questions", follow this document end to end.

The project's value is **real, cited, study-worthy interview-prep content**, NOT LLM-generated
trivia. Keep new stacks at that bar.

## 0. Philosophy (read first)

- **Content comes from authoritative sources** (official docs: react.dev, laravel.com,
  developer.mozilla.org, php.net, etc.), is **written in our own words**, and **cites those
  sources inline**. Never paste third-party text.
- **Interview-oriented, not a CS lecture.** Cover what interviewers actually ask: architecture,
  design, tradeoffs, "how would you", scenarios. Avoid definitional trivia ("what is X?") and
  outdated/legacy topics.
- **Quality hierarchy at runtime:** curated module content > ingested question bank > LLM
  generated. Your job is to grow the _curated_ layer.

## 1. Where things live

```
content/<stack>/<topic>.md     # curated modules (what you write)
content/<stack>/_bank.md       # ingested question bank (optional, _-prefixed, license-gated)
content/README.md              # the file FORMAT spec
content/SOURCES.md             # source map + policy (UPDATE THIS when you add a stack)
scripts/ingest/                # the ingestion framework (adapters + license gate)
src/lib/content.ts             # parser/loader (don't change unless extending the format)
```

`_`-prefixed files are skipped by the module loader (they're banks, not modules).

## 2. Module file format

Frontmatter + three H2 sections. `### ` = an item; `#### Details / #### Examples / #### Sources`
inside each concept.

````md
---
stack: <stack> # folder key, lowercase (e.g. "vue")
id: <stack>-<topic> # stable, unique (e.g. "vue-reactivity")
title: <human title>
area: <grouping> # Frontend | Backend | ...
priority: high | medium | low
resourceLabel: <optional go-deeper label>
resourceUrl: <optional real url>
---

## Summary

One line orienting the module.

## Concepts

### <Concept name>

#### Details

2-3 paragraphs. The WHY and the mental model, with the interview angle.

#### Examples

Caption line

```<lang>
// real, correct code
```

#### Sources

- [Label](https://official-docs-url)

## Interview Questions

### <A real architecture/design/scenario question>

Concise model answer / talking points (3-5 sentences).
````

Rules: keep `## Summary`, `## Concepts`, `## Interview Questions` exactly. A fenced block in a
concept becomes an example; the line above it becomes its caption. Markdown links under
`#### Sources` become source chips.

## 3. The module checklist (the bar)

A stack is "content-complete" when a mid/senior dev could prep from it alone. Use React (9
modules) as the reference. Adapt the set to the stack:

- **Fundamentals**, core building blocks, language/framework basics that are assumed.
- **Core building blocks**, the day-to-day primitives (hooks / Eloquent / components...).
- **State & data**, state management and/or data fetching, server vs local state.
- **Patterns & performance**, idioms, performance, common pitfalls.
- **Modern / advanced features**, what's new and asked NOW (e.g. RSC, queues, async).
- **Testing**, how the ecosystem tests; feature vs unit.
- **Security & errors**, common vulnerabilities + error handling for that stack.
- **(Ecosystem extras)**, auth, APIs, build tooling, whatever that role is asked.

Target per module: **3-5 concepts** (each with details + 2-3 examples + sources) and
**4-6 interview questions** (architecture/design/scenario, no trivia).

## 4. Steps to add a stack

1. **Pick the module set** from the checklist, adapted to the stack.
2. **Gather authoritative sources**, the official docs for each topic. Optionally use community
   question repos ONLY as a _guide to which topics/questions are common_ (see §5).
3. **Write each module** in the format above. Real, correct examples. Cite docs inline.
4. **Use `<stack>-<topic>` ids** so the roadmap overlay can match curated content.
5. **(Optional) Ingest a question bank** if a permissively-licensed source exists (§5).
6. **Update `content/SOURCES.md`**, add the stack's primary sources and any ingested bank.
7. **Verify** (§6).

## 5. Sourcing & LICENSE policy (non-negotiable)

- ✅ **Official docs** (MIT/CC/public docs): author from them, cite them. This is the default.
- ⚠️ **Community question repos:** "public" ≠ "free to copy". A GitHub repo with **no LICENSE
  file is all-rights-reserved** by default. Use such repos ONLY as a _topic guide_ (which
  questions are common; ideas aren't copyrightable). **Never copy their text.**
- ✅ **Ingested banks** (`_bank.md`): only from sources under a permissive license (MIT, ISC,
  Apache-2.0, BSD, CC0, CC-BY). Use the ingester, it has a **license allowlist gate** and
  **refuses to write** otherwise, preserving attribution.

To ingest a bank: add `scripts/ingest/adapters/<name>.mjs` exporting
`{ name, slug, stack, kind, source: { repo, url, raw, license, copyright }, parse(raw), filter? }`,
register it in `scripts/ingest/run.mjs`, then run `pnpm ingest <name>`. Add a `filter(item)` that
drops legacy/trivia and keeps signal (how/when/why/difference).

## 6. Verify before finishing

```bash
# Parser sees the new modules with concepts/questions populated:
node --experimental-strip-types -e "import('./src/lib/content.ts').then(m=>{for(const c of m.loadCuratedModules().filter(x=>x.stack==='<stack>'))console.log(c.id,c.concepts.length,'concepts',c.questions.length,'Qs')})"

# Unit tests (JSON extraction + markdown parser + more):
pnpm test

# Content-freshness report (informational):
pnpm check

# Type-check + build:
pnpm typecheck && pnpm build
```

All must pass. Every concept should show `details`, `examples` and `sources` > 0; every module
should have ≥3 concepts and ≥4 questions.

## 7. Anti-patterns (reject these)

- Copying text from a no-license repo. (Legal risk, use as a topic guide only.)
- Definitional trivia ("What is X?") or outdated/legacy topics as module questions.
- Concepts that are just titles with no `#### Details` / `#### Examples` / `#### Sources`.
- Uncited claims. If you can't cite an official doc, reconsider the claim.
- Inventing URLs. Only cite real, verifiable documentation pages.
