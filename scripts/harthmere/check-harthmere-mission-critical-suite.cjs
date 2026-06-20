#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const root = process.argv[2] || process.cwd();
const checks = [
  "scripts/harthmere/check-snapshot-grove-mission-critical-suite.cjs",
  "scripts/harthmere/check-harthmere-hud-map-navigation.cjs",
];
let failed = 0;
for (const rel of checks) {
  console.log(`\n== ${rel} ==`);
  const result = spawnSync(process.execPath, [path.join(root, rel), root], {
    stdio: "inherit",
  });
  if (result.status !== 0) failed += 1;
}
if (failed) {
  console.error(`\nv112 mission-critical suite: ${failed} sub-check(s) failed.`);
  process.exit(1);
}
console.log("\nv112 mission-critical suite: all checks passed.");
