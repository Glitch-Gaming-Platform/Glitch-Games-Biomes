#!/usr/bin/env node
// SNAPSHOT_GROVE_FOUNTAIN_ACTION_VALIDATION:
// Convenience runner that executes the current onboarding action-gate checks
// plus the new current marker-visibility and production-dialogue checks in
// one command. Exits non-zero if any sub-check fails.
const { spawnSync } = require("child_process");
const path = require("path");
const root = process.argv[2] || process.cwd();

const checks = [
  "scripts/harthmere/check-snapshot-grove-fountain-action-validation.cjs",
  "scripts/harthmere/check-snapshot-road-ahead-marker-validation.cjs",
  "scripts/harthmere/check-quest-step-validation-onboarding-action-gates.cjs",
  "scripts/harthmere/check-snapshot-grove-quest-marker-visibility.cjs",
  "scripts/harthmere/check-snapshot-grove-production-dialogue.cjs",
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
  console.error(`\nv107 onboarding polish suite: ${failed} sub-check(s) failed.`);
  process.exit(1);
}
console.log("\nv107 onboarding polish suite: all checks passed.");
