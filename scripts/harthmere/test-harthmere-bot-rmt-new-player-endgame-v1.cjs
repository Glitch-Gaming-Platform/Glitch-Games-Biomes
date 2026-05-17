#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-bot-rmt-new-player-endgame-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const signal of [
  "repeated farming path",
  "24/7 gathering",
  "impossible reaction times",
  "massive currency transfers",
  "low-level accounts mailing large gold",
  "repeated auction undercutting patterns",
  "high-value trades with no fair exchange",
  "new accounts funneling gold to one account",
]) {
  check(`bot/RMT signal exists: ${signal}`, src.includes(signal));
}
for (const tool of ["diminishing returns", "server movement validation", "trade limits for new accounts", "mail limits for new accounts", "auction limits for new accounts", "rollback tools"]) {
  check(`bot/RMT prevention tool exists: ${tool}`, src.includes(tool));
}
for (const rule of ["starterRepairsCheap", "starterGearAffordable", "basicTravelAffordable", "auctionHouseNotRequired", "antiScamWarningsEnabled"]) {
  check(`new player protection rule exists: ${rule}`, src.includes(rule));
}
for (const sink of ["legendary crafting", "housing mansions", "mount cosmetics", "rare transmog", "luxury vendors", "prestige titles"]) {
  check(`endgame sink exists: ${sink}`, src.includes(sink));
}
check("suspicious activity scorer exists", src.includes("scoreHarthmereSuspiciousEconomicActivity"));


finish();
