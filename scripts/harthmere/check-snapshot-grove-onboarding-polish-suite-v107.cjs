#!/usr/bin/env node
// SNAPSHOT_GROVE_FOUNTAIN_ACTION_VALIDATION_V107:
// Convenience runner that executes the v106 onboarding action-gate checks
// plus the new v107 marker-visibility and production-dialogue checks in
// one command. Exits non-zero if any sub-check fails.
const { spawnSync } = require("child_process");
const path = require("path");
const root = process.argv[2] || process.cwd();

const checks = [
  "scripts/harthmere/check-snapshot-grove-fountain-action-validation-v106.cjs",
  "scripts/harthmere/check-snapshot-road-ahead-marker-validation-v106.cjs",
  "scripts/harthmere/check-quest-step-validation-onboarding-action-gates-v106.cjs",
  "scripts/harthmere/check-snapshot-grove-quest-marker-visibility-v107.cjs",
  "scripts/harthmere/check-snapshot-grove-production-dialogue-v107.cjs",
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
