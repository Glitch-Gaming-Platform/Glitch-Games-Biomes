#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-inflation-monitoring-health-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const metric of [
  "total_gold_circulation",
  "gold_created_per_day",
  "gold_destroyed_per_day",
  "average_gold_by_level",
  "auction_price_index",
  "vendor_sale_volume",
  "repair_fee_burden",
  "bot_like_farming",
  "rare_item_circulation",
  "quest_reward_inflation",
]) {
  check(`inflation metric exists: ${metric}`, src.includes(`id: "${metric}"`));
}
check("economic health evaluator exists", src.includes("evaluateHarthmereEconomicHealth"));
check("sink ratio warning exists", src.includes("gold sinks are too weak compared to sources"));
check("repair burden warning exists", src.includes("repair costs may feel punishing"));
check("rare item circulation warning exists", src.includes("rare item circulation may be too high"));
check("economic health checklist exists", src.includes("HARTHMERE_ECONOMIC_HEALTH_CHECKLIST"));


finish();
