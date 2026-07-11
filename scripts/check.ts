// Content freshness report (informational; never fails). Run: node scripts/check.ts
// Unit tests moved to Vitest, see src/lib/*.test.ts (run: pnpm test).
import { staleModules } from "../src/lib/content.ts";

const stale = staleModules(12, new Date());
if (stale.length) {
  console.log(`⚠ ${stale.length} module(s) need review (missing date or >12mo old):`);
  for (const s of stale) {
    const age = s.ageMonths != null ? ` (${s.ageMonths}mo)` : "";
    console.log(`  ${s.stack}/${s.id}, ${s.reviewed ?? "never reviewed"}${age}`);
  }
} else {
  console.log("content freshness: OK");
}
