#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_FIX_SUITE_V1 — runs all 9 building-fix tests. */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const tests = [
  "test-harthmere-building-wall-continuity-v1.cjs",
  "test-harthmere-building-perimeter-closure-v1.cjs",
  "test-harthmere-building-ceiling-floor-v1.cjs",
  "test-harthmere-building-multi-story-v1.cjs",
  "test-harthmere-building-bible-coverage-v1.cjs",
  "test-harthmere-dungeon-bible-coverage-v1.cjs",
  "test-harthmere-building-enterability-v1.cjs",
  "test-harthmere-building-no-floating-debris-v1.cjs",
  "test-harthmere-building-npc-walkable-interior-v1.cjs",
];

let failed = 0;
const results = [];
for (const t of tests) {
  const fullPath = path.join(root, "scripts/harthmere", t);
  if (!fs.existsSync(fullPath)) {
    console.log(`\n=== ${t} ===\nFAIL (file missing): ${fullPath}\n`);
    results.push({ name: t, ok: false });
    failed += 1;
    continue;
  }
  console.log(`\n=== ${t} ===`);
  const r = spawnSync("node", [fullPath, root], { stdio: "inherit" });
  const ok = r.status === 0;
  results.push({ name: t, ok });
  if (!ok) failed += 1;
}

console.log("\n=== SUMMARY ===");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
}
console.log(
  failed === 0
    ? `\nRESULT: ALL ${tests.length} tests passed`
    : `\nRESULT: ${failed} of ${tests.length} tests failed`,
);
process.exit(failed === 0 ? 0 : 1);

