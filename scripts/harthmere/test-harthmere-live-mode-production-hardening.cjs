#!/usr/bin/env node
const path = require("path");
const { assertProductionHardening } = require("./harthmere-live-mode-readiness-test-lib.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
console.log("==> Running test-harthmere-live-mode-production-hardening.cjs against " + root);
assertProductionHardening(root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
