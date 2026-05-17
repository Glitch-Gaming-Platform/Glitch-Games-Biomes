#!/usr/bin/env node
const path = require("path");
const { assertLiveModeActionPipelines } = require("./harthmere-live-mode-readiness-test-lib-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
console.log("==> Running test-harthmere-live-mode-action-pipelines-v1.cjs against " + root);
assertLiveModeActionPipelines(root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
