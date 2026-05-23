#!/usr/bin/env node
// SNAPSHOT_GROVE_MISSION_CRITICAL_V110:
// Runs the prior onboarding gates plus the new systemic v110 usability guard.
const { spawnSync } = require("child_process");
const path = require("path");
const root = process.argv[2] || process.cwd();
const checks = [
  "scripts/harthmere/check-snapshot-grove-onboarding-polish-suite-v107.cjs",
  "scripts/harthmere/check-snapshot-grove-tutor-highlights-v109.cjs",
  "scripts/harthmere/check-snapshot-grove-mission-critical-v110.cjs",
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
  console.error(`\nv110 mission-critical suite: ${failed} sub-check(s) failed.`);
  process.exit(1);
}
console.log("\nv110 mission-critical suite: all checks passed.");
