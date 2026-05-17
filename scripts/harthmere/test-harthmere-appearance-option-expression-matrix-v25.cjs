#!/usr/bin/env node
/* eslint-disable no-console */
const childProcess = require("child_process");
const path = require("path");

const root = process.argv[2] || process.cwd();

const tests = [
  "test-harthmere-option-expression-contract-v26.cjs",
  "test-harthmere-procedural-body-face-clothing-behavior-v16.cjs",
  "test-harthmere-procedural-appearance-field-effect-matrix-v17.cjs",
];

for (const test of tests) {
  console.log(`==> ${test}`);
  const result = childProcess.spawnSync(
    "node",
    [path.join(root, "scripts/harthmere", test), root],
    {
      cwd: root,
      stdio: "inherit",
      encoding: "utf8",
    }
  );
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("RESULT: PASS");
