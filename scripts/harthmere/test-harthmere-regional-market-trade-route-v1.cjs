#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-regional-market-trade-route-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const id of ["harthmere", "greenmere_forest", "ironhold_mines", "riverport", "warfront", "freeport", "wyrmglass_reach"]) {
  check(`regional market exists for ${id}`, src.includes(`id: "${id}"`));
}
for (const route of ["north_road_ironhold", "river_route_freeport", "greenmere_harvest_road", "warfront_supply_line"]) {
  check(`trade route exists for ${route}`, src.includes(`id: "${route}"`));
}
for (const field of ["produces", "imports", "expensive", "taxRate", "risk", "regionalPriceModifiers", "carriedGoods", "status", "riskMultiplier", "priceEffects", "playerActions", "eventHooks"]) {
  check(`regional/trade route field exists: ${field}`, src.includes(field));
}
check("regional pricing helper exists", src.includes("getHarthmereRegionalPriceModifier"));
check("trade disruption events are modeled", src.includes("bandit ambush") && src.includes("bridge destroyed") && src.includes("storm delay"));


finish();
