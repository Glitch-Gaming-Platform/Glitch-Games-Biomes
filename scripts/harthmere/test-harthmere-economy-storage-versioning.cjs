#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, vendorRuntimeSource, hardeningSource, challengeSource } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere economy storage versioning current");
const hard = hardeningSource(h);
for (const key of ["inventoryState", "economyState", "gatheringState", "guildState", "buildingState", "reputationState", "vendorStockState", "rapidEconomyActions", "economyTransactions"]) {
  h.ok(hard.includes(key), `${key} is listed in local-dev state key registry`);
}
h.ok(inventorySource(h).includes("resetInventory"), "inventory reset/debug path exists");
h.ok(economySource(h).includes("resetEconomy"), "economy reset/debug path exists");
h.ok(vendorRuntimeSource(h).includes("resetHarthmereVendorRuntimeState"), "vendor stock runtime reset path exists");
h.ok(challengeSource(h, "LocalDevHarthmereGatheringSystem.tsx").includes("resetHarthmereGatheringState"), "gathering reset/debug path exists");
h.ok(challengeSource(h, "LocalDevHarthmereGuildSystem.tsx").includes("resetHarthmereGuildState"), "guild reset/debug path exists");
h.ok(challengeSource(h, "LocalDevHarthmereBuildingSystem.tsx").includes("resetHarthmereBuildingState"), "building reset/debug path exists");
h.done();
