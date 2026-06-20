#!/usr/bin/env node
const path = require("path");
const { assertRuntimeIntegration } = require("./harthmere-complete-combat-progression-test-lib.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
console.log(`==> Running test-harthmere-complete-runtime-integration.cjs against ${root}`);
assertRuntimeIntegration(root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
