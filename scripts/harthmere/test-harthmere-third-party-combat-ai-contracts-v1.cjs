#!/usr/bin/env node
const path = require("path");
const lib = require("./harthmere-third-party-combat-ai-test-lib-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const name = path.basename(__filename);
console.log(`==> Running ${name} against ${root}`);
const map = {
  "test-harthmere-third-party-combat-ai-contracts-v1.cjs": "assertContracts",
  "test-harthmere-third-party-combat-ai-behavior-fsm-v1.cjs": "assertBehaviorTreeAndFSM",
  "test-harthmere-third-party-combat-ai-utility-movement-v1.cjs": "assertUtilityMovement",
  "test-harthmere-third-party-combat-ai-adapters-v1.cjs": "assertAdapterAvailability",
  "test-harthmere-third-party-combat-ai-navigation-perception-v1.cjs": "assertNavigationPerception",
  "test-harthmere-third-party-combat-ai-end-to-end-v1.cjs": "assertEndToEnd",
  "test-harthmere-third-party-combat-ai-production-hardening-v1.cjs": "assertProductionHardening",
};
lib[map[name]](root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
