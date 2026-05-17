#!/usr/bin/env node
/* eslint-disable no-console */
// Compatibility wrapper.
// v14 checked an older builder layout and mini-preview implementation. The
// current builder contract is covered by the stricter field-effect matrix plus
// the original all-fields/clothing/persistence tests when those files exist.

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

const candidateTests = [
  "test-harthmere-character-builder-field-effect-matrix-v17.cjs",
  "test-harthmere-character-builder-all-fields-v1.cjs",
  "test-harthmere-character-builder-clothing-selection-v1.cjs",
  "test-harthmere-character-builder-save-into-game-v1.cjs",
  "test-harthmere-character-builder-edge-cases-v1.cjs",
];

let ran = 0;
for (const test of candidateTests) {
  const fullPath = path.join(root, "scripts/harthmere", test);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP missing optional test ${test}`);
    continue;
  }

  ran += 1;
  console.log(`==> ${test}`);
  const result = childProcess.spawnSync("node", [fullPath, root], {
    cwd: root,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (ran === 0) {
  console.error("FAIL no character-builder coverage tests were found");
  process.exit(1);
}

console.log("RESULT: PASS");
