#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const runner = fs.readFileSync(
  path.join(root, "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"),
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

for (const eventName of [
  "TillSoilEvent",
  "PlantSeedEvent",
  "WaterPlantsEvent",
  "PokePlantEvent",
  "HarvestPlantEvent",
]) {
  assert(runner.includes(eventName), `${eventName} is missing from browser E2E`);
}
for (const proof of [
  "native hoe tills a voxel",
  "native seed creates synchronized ECS plant",
  "watering can mutates native inventory and plant",
  "Gaia grows planted crop to maturity",
  "grown crop returns to JavaScript farming journal",
  "Gaia harvest materializes native drop",
]) {
  assert(runner.includes(proof), `missing farming proof: ${proof}`);
}
assert(bridge.includes("findTillableVoxelNear"));
assert(bridge.includes("farmingFrontendSnapshot"));
assert(handler.includes('slot.item.action !== "till"'));
assert(handler.includes('toolSlot.item.action !== "waterPlant"'));
assert(gate.includes("FarmingTab.test.tsx"));

console.log("Native hotbar farming ECS/Gaia E2E contract checks passed.");

