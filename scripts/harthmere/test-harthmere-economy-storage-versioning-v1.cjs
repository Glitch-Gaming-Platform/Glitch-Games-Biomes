#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, vendorSource, hardeningSource, challengeSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere economy storage versioning v1");
const hard = hardeningSource(h);
for (const key of ["inventoryState.v1", "economyState.v1", "gatheringState.v1", "guildState.v1", "buildingState.v1", "reputationState.v1", "vendorStockState.v1", "rapidEconomyActions.v1", "economyTransactions.v1"]) {
  h.ok(hard.includes(key), `${key} is listed in local-dev state key registry`);
}
h.ok(inventorySource(h).includes("resetInventory"), "inventory reset/debug path exists");
h.ok(economySource(h).includes("resetEconomy"), "economy reset/debug path exists");
h.ok(vendorSource(h).includes("resetHarthmereVendorRuntimeState"), "vendor stock runtime reset path exists");
h.ok(challengeSource(h, "LocalDevHarthmereGatheringSystem.tsx").includes("resetHarthmereGatheringState"), "gathering reset/debug path exists");
h.ok(challengeSource(h, "LocalDevHarthmereGuildSystem.tsx").includes("resetHarthmereGuildState"), "guild reset/debug path exists");
h.ok(challengeSource(h, "LocalDevHarthmereBuildingSystem.tsx").includes("resetHarthmereBuildingState"), "building reset/debug path exists");
h.done();
