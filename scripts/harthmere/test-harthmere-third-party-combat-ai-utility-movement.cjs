#!/usr/bin/env node
const path = require("path");
const lib = require("./harthmere-third-party-combat-ai-test-lib.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const name = path.basename(__filename);
console.log(`==> Running ${name} against ${root}`);
const map = {
  "test-harthmere-third-party-combat-ai-contracts.cjs": "assertContracts",
  "test-harthmere-third-party-combat-ai-behavior-fsm.cjs": "assertBehaviorTreeAndFSM",
  "test-harthmere-third-party-combat-ai-utility-movement.cjs": "assertUtilityMovement",
  "test-harthmere-third-party-combat-ai-adapters.cjs": "assertAdapterAvailability",
  "test-harthmere-third-party-combat-ai-navigation-perception.cjs": "assertNavigationPerception",
  "test-harthmere-third-party-combat-ai-end-to-end.cjs": "assertEndToEnd",
  "test-harthmere-third-party-combat-ai-production-hardening.cjs": "assertProductionHardening",
};
lib[map[name]](root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
