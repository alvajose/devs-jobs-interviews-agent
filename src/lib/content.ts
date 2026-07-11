// Knowledge base: curated content lives as Markdown files under /content/<stack>/<topic>.md.
// This is the canonical store, git-versioned, human-editable, and the exact corpus we'll
// later embed into a vector DB for RAG. For now we read + parse it directly.
//
// File format (see content/README.md):
//   ---
//   stack: laravel
//   id: laravel-apis-rest
//   title: APIs RESTful con Laravel
//   area: Backend
//   priority: high
//   resourceLabel: Laravel, API Resources        (optional)
//   resourceUrl: https://laravel.com/docs/...      (optional)
//   ---
//   ## Summary
//   one-line orientation
//   ## Concepts
//   ### Concept name
//   detail prose…
//   ```
//   optional code example
//   ```
//   ## Interview Questions
//   ### The question?
//   the answer…

import fs from "node:fs";
import path from "node:path";
import type { Concept, InterviewQA, RoadmapModule } from "./types";
import { questionsLookSpanish } from "./content-language";

export interface CuratedModule extends RoadmapModule {
  stack: string;
  /** `YYYY-MM` this module was last verified against its source. Drives staleness checks. */
  reviewed?: string;
  /** Version(s) this content applies to, e.g. `next@15`. Free-form, optional. */
  appliesTo?: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

/** Split leading `---` frontmatter into a flat key→value map plus the remaining body. */
function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: m[2] };
}

/** Parse one topic Markdown file (pure, no IO, so it's unit-testable). */
export function parseTopicMarkdown(raw: string): CuratedModule {
  const { fm, body } = parseFrontmatter(raw);
  const sections = splitByHeading(body, 2);
  const priority = (fm.priority === "high" || fm.priority === "low" ? fm.priority : "medium") as RoadmapModule["priority"];

  return {
    id: fm.id || slug(fm.title || "untitled"),
    title: fm.title || "Untitled",
    area: fm.area || "General",
    priority,
    summary: (sections["Summary"] || "").trim(),
    concepts: parseConcepts(sections["Concepts"] || ""),
    questions: parseQuestions(sections["Interview Questions"] || ""),
    resource: fm.resourceUrl ? { label: fm.resourceLabel || "Reference", url: fm.resourceUrl } : null,
    stack: (fm.stack || "general").toLowerCase(),
    source: "curated",
    ...(fm.reviewed ? { reviewed: fm.reviewed } : {}),
    ...(fm.appliesTo ? { appliesTo: fm.appliesTo } : {}),
  };
}

function parseConcepts(text: string): Concept[] {
  return Object.entries(splitByHeading(text, 3)).map(([name, raw]) => {
    const subsections = splitByHeading(raw, 4);
    if (!Object.keys(subsections).length) {
      const examples = parseExamples(raw, { inferLabels: false });
      const detail = raw.replace(/```[\w-]*\r?\n[\s\S]*?```/g, "").trim();
      return {
        name,
        detail,
        ...(examples[0]?.code ? { example: examples[0].code } : {}),
        ...(examples.length ? { examples } : {}),
      };
    }

    const details = splitParagraphs(subsections.Details || subsections.Detail || "");
    const examples = parseExamples(subsections.Examples || "", { inferLabels: true });
    const sources = parseSources(subsections.Sources || subsections.References || "");
    const fallbackDetail = raw
      .split(/\r?\n####\s+/)[0]
      .replace(/```[\w-]*\r?\n[\s\S]*?```/g, "")
      .trim();
    const detail = details.join("\n\n") || fallbackDetail;
    return {
      name,
      detail,
      ...(details.length ? { details } : {}),
      ...(examples[0]?.code ? { example: examples[0].code } : {}),
      ...(examples.length ? { examples } : {}),
      ...(sources.length ? { sources } : {}),
    };
  });
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseExamples(
  text: string,
  { inferLabels }: { inferLabels: boolean },
): NonNullable<Concept["examples"]> {
  const examples: NonNullable<Concept["examples"]> = [];
  let lastIndex = 0;
  const fence = /```([\w-]*)[^\r\n]*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text))) {
    const before = text.slice(lastIndex, match.index).trim();
    const label = inferLabels ? before.split(/\r?\n/).pop()?.replace(/^[-*]\s*/, "").trim() : "";
    examples.push({
      ...(label ? { label } : {}),
      ...(match[1] ? { language: match[1] } : {}),
      code: match[2].trim(),
    });
    lastIndex = fence.lastIndex;
  }

  const remainder = text.slice(lastIndex).trim();
  if (!examples.length && remainder) {
    for (const item of remainder
      .split(/\r?\n-\s+/)
      .map((x) => x.replace(/^-\s*/, "").trim())
      .filter(Boolean)) {
      examples.push({ text: item });
    }
  }

  return examples;
}

function parseSources(text: string): NonNullable<Concept["sources"]> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .map((line) => {
      const md = line.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (md) return { label: md[1], url: md[2] };
      const split = line.match(/^(.+?):\s*(https?:\/\/\S+)$/);
      if (split) return { label: split[1].trim(), url: split[2] };
      return null;
    })
    .filter((source): source is NonNullable<Concept["sources"]>[number] => Boolean(source));
}

function parseQuestions(text: string): InterviewQA[] {
  return Object.entries(splitByHeading(text, 3)).map(([question, answer]) => ({
    question,
    answer: answer.trim(),
  }));
}

/** Split a markdown body into a { headingText: contentBelow } map for a given heading level. */
function splitByHeading(text: string, level: number): Record<string, string> {
  const marker = "#".repeat(level) + " ";
  const out: Record<string, string> = {};
  let current: string | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (current !== null) out[current] = buf.join("\n").trim();
    buf.length = 0;
  };
  for (const line of text.split(/\r?\n/)) {
    // Only break on the exact level (not deeper headings like #### inside a section).
    if (line.startsWith(marker) && !line.slice(level + 1).startsWith("#")) {
      flush();
      current = line.slice(marker.length).trim();
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// --- Question banks (ingested, `_bank.md`) ---

export interface QuestionBank {
  stack: string;
  source: { repo: string; url: string; license: string; copyright: string };
  questions: InterviewQA[];
}

/** Stacks that have an ingested question bank (content/<stack>/_bank.md). */
export function availableBankStacks(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((s) => {
      const dir = path.join(CONTENT_DIR, s);
      return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, "_bank.md"));
    });
}

export function loadQuestionBank(stack: string): QuestionBank | null {
  // fs trust boundary: only simple slugs, no path separators, dots, or traversal.
  if (!/^[a-z0-9][a-z0-9+-]*$/.test(stack)) return null;
  const file = path.join(CONTENT_DIR, stack, "_bank.md");
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { fm, body } = parseFrontmatter(raw);

  // Take everything after the "## Interview Questions" marker and parse the ### items.
  const marker = "## Interview Questions";
  const idx = body.indexOf(marker);
  const questions = parseQuestions(idx >= 0 ? body.slice(idx + marker.length) : body);

  return {
    stack,
    source: { repo: fm.source || "", url: fm.sourceUrl || "", license: fm.license || "", copyright: fm.copyright || "" },
    questions,
  };
}

/** Heuristic language of a question bank (corpus is mixed: some ES, some EN). */
export function detectBankLanguage(
  questions: { question: string }[],
): "es" | "en" {
  return questionsLookSpanish(questions.slice(0, 12)) ? "es" : "en";
}

/** Keep only stacks whose `_bank.md` matches the requested UI language. */
export function filterStacksByBankLanguage(
  stacks: string[],
  language: "es" | "en",
): string[] {
  return stacks.filter((stack) => {
    const bank = loadQuestionBank(stack);
    return Boolean(bank?.questions.length) && detectBankLanguage(bank!.questions) === language;
  });
}

// --- IO layer (server-only) ---

/** Read + parse every curated topic in the knowledge base. Cheap while the corpus is small. */
export function loadCuratedModules(): CuratedModule[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const mods: CuratedModule[] = [];
  for (const stack of fs.readdirSync(CONTENT_DIR)) {
    const dir = path.join(CONTENT_DIR, stack);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      if (file.startsWith("_")) continue; // _-prefixed = non-module data (e.g. question banks)
      try {
        mods.push(parseTopicMarkdown(fs.readFileSync(path.join(dir, file), "utf8")));
      } catch {
        /* skip malformed file */
      }
    }
  }
  return mods;
}

// --- Content freshness ---

/** Months between a `YYYY-MM` review date and `now`. null if missing/unparseable (pure). */
export function monthsSince(reviewed: string | undefined, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec((reviewed ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
}

export interface StaleModule {
  stack: string;
  id: string;
  reviewed?: string;
  /** null = never reviewed / unparseable date (treated as most urgent). */
  ageMonths: number | null;
}

/** Curated modules with no review date or a review date older than `maxAgeMonths`. */
export function staleModules(maxAgeMonths: number, now: Date): StaleModule[] {
  return loadCuratedModules()
    .map((m) => ({ stack: m.stack, id: m.id, reviewed: m.reviewed, ageMonths: monthsSince(m.reviewed, now) }))
    .filter((r) => r.ageMonths === null || r.ageMonths > maxAgeMonths)
    .sort((a, b) => (b.ageMonths ?? Infinity) - (a.ageMonths ?? Infinity));
}

// --- Admin overview: the full curated corpus grouped by stack ---

export interface StackKnowledge {
  stack: string;
  modules: CuratedModule[];
  bank: { count: number; source: QuestionBank["source"] } | null;
  totals: { modules: number; concepts: number; questions: number };
}

/** Everything the KB knows, grouped by stack, for the admin review view. */
export function loadKnowledgeBase(): StackKnowledge[] {
  const byStack = new Map<string, CuratedModule[]>();
  for (const m of loadCuratedModules()) {
    (byStack.get(m.stack) ?? byStack.set(m.stack, []).get(m.stack)!).push(m);
  }
  const banks = new Set(availableBankStacks());

  return Array.from(byStack.keys())
    .sort()
    .map((stack) => {
      const modules = byStack.get(stack)!;
      const bankData = banks.has(stack) ? loadQuestionBank(stack) : null;
      return {
        stack,
        modules,
        bank: bankData ? { count: bankData.questions.length, source: bankData.source } : null,
        totals: {
          modules: modules.length,
          concepts: modules.reduce((n, m) => n + m.concepts.length, 0),
          questions: modules.reduce((n, m) => n + m.questions.length, 0),
        },
      };
    });
}
