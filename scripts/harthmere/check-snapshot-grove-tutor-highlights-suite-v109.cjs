#!/usr/bin/env node
// SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS_V109:
// Convenience runner that executes every onboarding/graduation/highlight
// check the project relies on. Exits non-zero if any sub-check fails.
const { spawnSync } = require("child_process");
const path = require("path");
const root = process.argv[2] || process.cwd();

const checks = [
  "scripts/harthmere/check-snapshot-grove-fountain-action-validation-v106.cjs",
  "scripts/harthmere/check-snapshot-road-ahead-marker-validation-v106.cjs",
  "scripts/harthmere/check-quest-step-validation-onboarding-action-gates-v106.cjs",
  "scripts/harthmere/check-snapshot-grove-quest-marker-visibility-v107.cjs",
  "scripts/harthmere/check-snapshot-grove-production-dialogue-v107.cjs",
  "scripts/harthmere/check-snapshot-grove-graduation-chain-v108.cjs",
  "scripts/harthmere/check-snapshot-grove-tutor-highlights-v109.cjs",
];

let failed = 0;
for (const rel of checks) {
  const abs = path.join(root, rel);
  console.log(`\n--- Running ${rel} ---`);
  const result = spawnSync("node", [abs, root], { stdio: "inherit" });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAILED: ${rel}`);
  }
}

if (failed) {
  console.error(`\nv109 tutor highlights suite: ${failed} sub-check(s) failed.`);
  process.exit(1);
}
console.log("\nv109 tutor highlights suite: all checks passed.");
