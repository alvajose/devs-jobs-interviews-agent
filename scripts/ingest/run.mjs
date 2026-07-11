// Ingestion runner. Add a source = drop an adapter in adapters/ and register it below.
//
//   node scripts/ingest/run.mjs                # run every adapter
//   node scripts/ingest/run.mjs react-sudheerj # run one
//
// Each adapter fetches a public, permissively-licensed source and writes an attributed
// question bank into content/<stack>/_<slug>.md. The LLM authors nothing here.

import { ingest } from "./core.mjs";
import reactSudheerj from "./adapters/react-sudheerj.mjs";
import pythonDevlovers from "./adapters/python-devlovers.mjs";

const REGISTRY = {
  [reactSudheerj.name]: reactSudheerj,
  [pythonDevlovers.name]: pythonDevlovers,
};

const arg = process.argv[2];
const adapters = arg ? [REGISTRY[arg]] : Object.values(REGISTRY);

if (arg && !REGISTRY[arg]) {
  console.error(`Unknown adapter "${arg}". Available: ${Object.keys(REGISTRY).join(", ")}`);
  process.exit(1);
}

let total = 0;
for (const adapter of adapters) {
  total += await ingest(adapter);
}
console.log(`Done. ${total} items across ${adapters.length} source(s).`);
