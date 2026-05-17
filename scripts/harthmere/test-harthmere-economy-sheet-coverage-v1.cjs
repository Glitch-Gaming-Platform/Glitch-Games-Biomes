#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-economy-sheet-coverage-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


check("economy optimization module exists", src.includes("HARTHMERE_ECONOMY_OPTIMIZATION_VERSION"));
for (const term of [
  "currency creation",
  "currency destruction",
  "item creation",
  "item destruction",
  "vendor prices",
  "player trading",
  "auction house",
  "crafting",
  "gathering",
  "regional supply and demand",
  "taxes and fees",
  "inflation",
  "item rarity",
  "repair costs",
  "loot value",
  "quest rewards",
  "npc merchant behavior",
  "illegal markets",
  "banking",
  "economic abuse prevention",
]) {
  check(`sheet control covered: ${term}`, src.includes(term));
}
check("module exposes browser debug bridge", src.includes("__harthmereEconomyOptimization"));
check("full suite includes sheet coverage test", suite.includes("test-harthmere-economy-sheet-coverage-v1.cjs"));


finish();
