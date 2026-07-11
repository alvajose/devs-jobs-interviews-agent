// Runs Next in local mode (OSS single-user: SQLite, no login, no billing),
// regardless of what .env.local holds. Forces NEXT_PUBLIC_APP_MODE=local, which
// wins over the Supabase-URL heuristic in src/lib/mode.ts. Cross-platform, no deps.
import { spawn } from "node:child_process";

process.env.NEXT_PUBLIC_APP_MODE = "local";

// Default to `dev`; pass through anything after it (e.g. --port 4000). Use
// `build`/`start` for a production-style local run: node scripts/dev-local.mjs build
// shell:true is needed on Windows (next is a .cmd shim); pass one command string
// (not an args array) so it doesn't trip Node's DEP0190 shell-args warning.
const args = process.argv.slice(2);
const cmd = ["next", ...(args.length ? args : ["dev"])].join(" ");
const next = spawn(cmd, { stdio: "inherit", shell: true, env: process.env });
next.on("exit", (code) => process.exit(code ?? 0));
