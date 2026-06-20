#!/usr/bin/env node
"use strict";
/* HARTHMERE_LIVE_BROWSER_REGRESSION_SUITE_STRICT_RUNTIME */
const path = require("path");
const { spawnSync } = require("child_process");
const fs = require("fs");

const root = process.argv[
  "test-harthmere-dungeon-console-teleport-live.cjs",2] || process.cwd();
const scriptsDir = path.join(root, "scripts", "harthmere");
const tests = [
  "test-harthmere-browser-player-collision-e2e.cjs",
  "test-harthmere-dungeon-console-teleport-live.cjs",
  "test-harthmere-collision-overlay-screenshot-audit.cjs",
  "test-harthmere-collision-performance-budget.cjs",
  "test-harthmere-collision-radius-variants.cjs",
  "test-harthmere-procedural-solid-asset-collision.cjs",
];

console.log("== Harthmere live browser/runtime regression suite current ==");
console.log(`Root: ${root}`);
console.log(`URL: ${process.env.HARTHMERE_E2E_URL || "<missing HARTHMERE_E2E_URL>"}`);
console.log();

let failures = 0;
for (const test of tests) {
  const full = path.join(scriptsDir, test);
  console.log(`---- ${test} ----`);
  if (!fs.existsSync(full)) {
    console.log(`FAIL missing ${full}`);
    failures += 1;
    continue;
  }
  const result = spawnSync(process.execPath, [full, root], { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    failures += 1;
    console.log(`---- RESULT: FAIL ${test} ----`);
  } else {
    console.log(`---- RESULT: PASS ${test} ----`);
  }
  console.log();
}

if (failures) {
  console.log(`LIVE SUITE RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("LIVE SUITE RESULT: PASS");
