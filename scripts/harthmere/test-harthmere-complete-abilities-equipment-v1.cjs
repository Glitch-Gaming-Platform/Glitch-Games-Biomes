#!/usr/bin/env node
const path = require("path");
const { assertAbilityEquipment } = require("./harthmere-complete-combat-progression-test-lib-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
console.log(`==> Running test-harthmere-complete-abilities-equipment-v1.cjs against ${root}`);
assertAbilityEquipment(root);
if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
