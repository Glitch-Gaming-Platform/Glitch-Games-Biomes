#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-market-ui-anti-scam-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const field of [
  "current listings",
  "average price",
  "lowest price",
  "recent sale price",
  "price history",
  "stack size",
  "seller",
  "time remaining",
  "tax/fee",
  "total cost",
  "unit price",
  "usable by player",
]) {
  check(`market UI field exists: ${field}`, src.includes(field));
}
for (const warning of [
  "trade partner changed offer",
  "currency amount changed",
  "item is damaged",
  "item will bind when received",
  "item is stolen",
  "item expires soon",
  "item unusually valuable",
  "item cannot be used by your class",
  "auction unit price differs from stack total",
  "auction price far above recent average",
  "final confirmation required",
]) {
  check(`anti-scam warning exists: ${warning}`, src.includes(warning));
}
check("auction filters exist", src.includes("HARTHMERE_AUCTION_FILTERS"));
check("market history entry model exists", src.includes("HarthmereMarketHistoryEntry"));


finish();
