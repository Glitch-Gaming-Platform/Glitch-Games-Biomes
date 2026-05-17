#!/usr/bin/env node
const path = require("path");
const { assertEndToEndScenarios } = require("./harthmere-live-mode-readiness-test-lib-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
console.log("==> Running test-harthmere-live-mode-end-to-end-scenarios-v1.cjs against " + root);
assertEndToEndScenarios(root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
