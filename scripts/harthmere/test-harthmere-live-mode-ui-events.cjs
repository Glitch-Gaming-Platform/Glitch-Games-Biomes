#!/usr/bin/env node
const path = require("path");
const { assertUiEvents } = require("./harthmere-live-mode-readiness-test-lib.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
console.log("==> Running test-harthmere-live-mode-ui-events.cjs against " + root);
assertUiEvents(root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
