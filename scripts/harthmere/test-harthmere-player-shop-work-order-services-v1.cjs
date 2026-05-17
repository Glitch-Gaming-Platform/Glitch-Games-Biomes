#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-player-shop-work-order-services-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const term of ["HARTHMERE_PLAYER_SHOP_RULES", "rentStallOrShopSpace", "publicGuildFactionVisibility", "illegalItemsRequireBlackMarketShop", "saleTaxApplies"]) {
  check(`player shop rule includes ${term}`, src.includes(term));
}
for (const term of ["HARTHMERE_WORK_ORDER_RULES", "requesterPostsOrder", "serverHoldsMaterialsInEscrow", "crafterCompletesItem", "preventsScams"]) {
  check(`work order rule includes ${term}`, src.includes(term));
}
for (const service of ["repair", "training", "respec", "fast travel", "teleportation", "bank expansion", "mount training", "crafting station rental", "enchanting", "transmog", "legal fine payment", "mail delivery"]) {
  check(`NPC service economy includes ${service}`, src.includes(service));
}
for (const service of ["crafting", "enchanting", "transport", "protection", "caravan escort", "mercenary work", "bounty hunting", "information brokering"]) {
  check(`player service economy includes ${service}`, src.includes(service));
}
check("NPC labor economy exists", src.includes("HARTHMERE_NPC_LABOR_ECONOMY"));
check("town wealth economy rules exist", src.includes("HARTHMERE_TOWN_WEALTH_RULES"));


finish();
