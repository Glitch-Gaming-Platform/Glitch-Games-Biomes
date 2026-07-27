#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const runner = fs.readFileSync(
  path.join(
    root,
    "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
  ),
  "utf8"
);
const bridge = fs.readFileSync(
  path.join(root, "src/client/game/e2e/harthmere_native_ecs_e2e.ts"),
  "utf8"
);
const handler = fs.readFileSync(
  path.join(root, "src/server/logic/events/handlers/farming.ts"),
  "utf8"
);
const gate = fs.readFileSync(
  path.join(root, "scripts/harthmere/run-harthmere-native-ecs-e2e.sh"),
  "utf8"
);
const farmingMapQuest = fs.readFileSync(
  path.join(
    root,
    "src/client/components/biomes_ui/adapters/farmingMapQuest.ts"
  ),
  "utf8"
);

for (const eventName of [
  "TillSoilEvent",
  "PlantSeedEvent",
  "WaterPlantsEvent",
  "PokePlantEvent",
  "HarvestPlantEvent",
]) {
  assert(
    runner.includes(eventName),
    `${eventName} is missing from browser E2E`
  );
}
for (const proof of [
  "native hoe tills a voxel",
  "native seed creates synchronized ECS plant",
  "watering can mutates native inventory and plant",
  "Gaia grows planted crop to maturity",
  "grown crop returns to JavaScript farming journal",
  "grown crop returns to JavaScript My Crops map layer",
  "native hoe permanently completes JavaScript farming guide",
  "bought Hoe reaches native backpack without overflow",
  "bought Hoe can be assigned to native hotbar",
  "bought Hoe can be selected for tilling",
  "Gaia harvest materializes native drop",
]) {
  assert(runner.includes(proof), `missing farming proof: ${proof}`);
}
assert(bridge.includes("findTillableVoxelNear"));
assert(bridge.includes("farmingFrontendSnapshot"));
assert(bridge.includes("farmingMapFrontendSnapshot"));
assert(bridge.includes("farmingHoeQuestSnapshot"));
assert(bridge.includes("vendorPurchase"));
assert(bridge.includes("harthmereNativeCropMapLandmarks"));
assert(bridge.includes("reconcileHarthmereHoeQuestState"));
assert(farmingMapQuest.includes("shiftHarthmereAuthoredPositionToWorld"));
assert(farmingMapQuest.includes("HARTHMERE_HOE_VENDOR_AUTHORED_POSITION"));
assert(handler.includes('slot.item.action !== "till"'));
assert(handler.includes('toolSlot.item.action !== "waterPlant"'));
assert(gate.includes("FarmingTab.test.tsx"));
assert(gate.includes("harthmere_item_source_reachability.test.ts"));

console.log("Native hotbar farming ECS/Gaia E2E contract checks passed.");
