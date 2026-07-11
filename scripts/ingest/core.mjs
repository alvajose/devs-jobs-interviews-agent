// Ingestion framework core. Each source is an "adapter" (see adapters/*.mjs); this runner
// handles fetching, the LICENSE gate, writing the attributed bank file, and reporting.
//
// Adapter shape:
//   {
//     name: "react-sudheerj",          // unique id (CLI arg)
//     slug: "bank",                     // output file: content/<stack>/_<slug>.md
//     stack: "react",
//     kind: "question-bank",            // currently the only supported kind
//     source: { repo, url, raw, license, copyright },
//     parse(rawText) -> [{ question, answer }]
//   }

import fs from "node:fs";
import path from "node:path";

// Only redistribute under licenses that permit it WITH attribution. No license file = NOT here.
const ALLOWED_LICENSES = new Set([
  "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
  "CC0-1.0", "CC-BY-4.0", "CC-BY-3.0",
]);

export function dedent(s) {
  return s.replace(/^( {4}|\t)/gm, "");
}

export async function ingest(adapter) {
  if (!adapter) throw new Error("Unknown adapter.");
  const { name, slug, stack, kind = "question-bank", source } = adapter;

  if (!ALLOWED_LICENSES.has(source.license)) {
    throw new Error(
      `[${name}] License "${source.license}" (${source.repo}) is NOT in the redistribution allowlist. ` +
        `Aborting, do not copy this content into the KB. Reference it by link instead.`,
    );
  }

  const raw = await (await fetch(source.raw)).text();
  const parsed = adapter.parse(raw);
  if (!Array.isArray(parsed) || parsed.length < 20) {
    throw new Error(`[${name}] parsed ${parsed?.length ?? 0} items, source format likely changed. Aborting.`);
  }
  // Optional signal filter: keep only genuinely-asked questions, drop trivia/legacy.
  const items = adapter.filter ? parsed.filter((it) => adapter.filter(it)) : parsed;
  if (items.length < 10) {
    throw new Error(`[${name}] only ${items.length} items survived the filter, too aggressive. Aborting.`);
  }
  if (adapter.filter) console.log(`[${name}] filter kept ${items.length}/${parsed.length}`);

  const out = path.join(process.cwd(), "content", stack, `_${slug}.md`);
  const fm =
    `---\n` +
    `stack: ${stack}\n` +
    `kind: ${kind}\n` +
    `source: ${source.repo}\n` +
    `sourceUrl: ${source.url}\n` +
    `license: ${source.license}\n` +
    `copyright: ${source.copyright}\n` +
    `---\n\n` +
    `<!-- Ingested verbatim from ${source.url} (${source.license}). ${source.copyright}.\n` +
    `     Re-run: node scripts/ingest/run.mjs ${name}, do NOT hand-edit. -->\n\n` +
    `## Interview Questions\n`;
  const body = items.map((it) => `\n### ${it.question}\n${it.answer}\n`).join("");

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, fm + body, "utf8");
  console.log(`[${name}] ${items.length} items -> ${path.relative(process.cwd(), out)}`);
  return items.length;
}
