#!/usr/bin/env node
// SNAPSHOT_GROVE_GRADUATION_CHAIN:
// Convenience runner that executes every onboarding/graduation check the
// project currently relies on. Exits non-zero if any sub-check fails.
const { spawnSync } = require("child_process");
const path = require("path");
const root = process.argv[2] || process.cwd();

const checks = [
  "scripts/harthmere/check-snapshot-grove-fountain-action-validation.cjs",
  "scripts/harthmere/check-snapshot-road-ahead-marker-validation.cjs",
  "scripts/harthmere/check-quest-step-validation-onboarding-action-gates.cjs",
  "scripts/harthmere/check-snapshot-grove-quest-marker-visibility.cjs",
  "scripts/harthmere/check-snapshot-grove-production-dialogue.cjs",
  "scripts/harthmere/check-snapshot-grove-graduation-chain.cjs",
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
  console.error(`\nv108 graduation chain suite: ${failed} sub-check(s) failed.`);
  process.exit(1);
}
console.log("\nv108 graduation chain suite: all checks passed.");
