#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-secondary-currency-policy-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const id of [
  "harthmere_favor",
  "guild_marks",
  "bounty_tokens",
  "crafting_writs",
  "festival_tokens",
  "dungeon_seals",
  "pvp_marks",
  "black_market_coins",
]) {
  check(`secondary currency policy exists for ${id}`, src.includes(`id: "${id}"`));
}
for (const field of ["sourceActivities", "useCases", "cap", "expires", "replacesGold", "conversionOnExpire", "scope"]) {
  check(`secondary currency policy has ${field}`, src.includes(field));
}
check("seasonal/event currencies can expire or convert", src.includes("event_end") && src.includes("season_end") && src.includes("conversionOnExpire"));
check("secondary currencies do not all replace gold", src.includes("replacesGold: false"));


finish();
