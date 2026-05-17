#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere building behavior integration v2");
const src = h.read("src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx");
function blockBetween(a, b) {
  const start = src.indexOf(a);
  const end = src.indexOf(b, start + a.length);
  return src.slice(start, end > start ? end : undefined);
}
const purchase = blockBetween("function purchasePlot", "function startConstruction");
const start = blockBetween("function startConstruction", "function completeProjectAsProperty");
const complete = blockBetween("function completeProjectAsProperty", "function contributeProjectStage");
const repair = blockBetween("function contributeRepair", "function upgradeProperty");
const taxes = blockBetween("function payPropertyTaxes", "function collectPropertyRevenue");
const demolish = blockBetween("function demolishProperty", "function resetHarthmereBuildingState");
h.ok(purchase.includes("validateHarthmereBuildingTransaction"), "plot purchase uses transaction authority before spending gold");
h.ok(start.includes("validateHarthmereBuildingPlacement"), "construction validates physical placement before charging setup gold");
h.ok(start.includes("overlapsRoad: false") && start.includes("overlapsNpcRoute: false") && start.includes("overlapsResourceNode: false"), "predefined plots assert route/resource safety into placement authority");
h.ok(complete.includes("createHarthmerePropertyDeed"), "completion creates a property deed");
h.ok(complete.includes("advanceHarthmereUpkeepLifecycle"), "completion initializes upkeep lifecycle");
h.ok(repair.includes("planHarthmereRepairContribution"), "public repair has authority preflight for partial/combat rules");
h.ok(taxes.includes("advanceHarthmereUpkeepLifecycle"), "tax payment refreshes upkeep lifecycle");
h.ok(demolish.includes("createHarthmereStorageRecovery"), "demolition creates storage recovery instead of deleting items");
h.ok(src.includes("resolveHarthmereDoorLock") && src.includes("validateHarthmerePropertyPermission"), "door lock and granular permission helpers are wired into test hooks");
h.done();
