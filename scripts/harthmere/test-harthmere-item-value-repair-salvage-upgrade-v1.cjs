#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-item-value-repair-salvage-upgrade-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const term of [
  "calculateHarthmereItemValue",
  "baseValueCopper",
  "levelModifier",
  "qualityModifier",
  "demandModifier",
  "scarcityModifier",
  "conditionModifier",
  "stolenModifier",
  "boundModifier",
]) {
  check(`item value formula includes ${term}`, src.includes(term));
}
for (const term of ["calculateHarthmereRepairCost", "itemBaseValueCopper", "damagePercent", "repairServiceModifier", "HARTHMERE_REPAIR_QUALITY_MODIFIERS"]) {
  check(`repair formula includes ${term}`, src.includes(term));
}
for (const term of ["HARTHMERE_SALVAGE_RULES", "eligibleCategories", "blockedStates", "returnsMaterialsByQuality", "questItemsCannotSalvageUnlessExplicit"]) {
  check(`salvage rule includes ${term}`, src.includes(term));
}
for (const term of ["HARTHMERE_ITEM_UPGRADE_RULES", "requiredInputs", "noHiddenOdds", "noPaidOnlySuccess", "warningBeforeRareDestruction"]) {
  check(`upgrade rule includes ${term}`, src.includes(term));
}


finish();
