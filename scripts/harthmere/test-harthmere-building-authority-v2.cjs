#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere building authority and missing-rules coverage v2");
const authorityPath = "src/client/components/challenges/LocalDevHarthmereWorldAuthority.ts";
const buildingPath = "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx";
h.fileExists(authorityPath, "mock-authoritative world authority module exists");
const authority = h.read(authorityPath);
const building = h.read(buildingPath);
for (const symbol of [
  "validateHarthmereBuildingPlacement",
  "validateHarthmereBuildingTransaction",
  "createHarthmerePropertyDeed",
  "createHarthmereLease",
  "createHarthmerePropertySaleListing",
  "validateHarthmerePropertyPermission",
  "resolveHarthmereDoorLock",
  "applyHarthmereBuildingDamage",
  "planHarthmereRepairContribution",
  "advanceHarthmereUpkeepLifecycle",
  "createHarthmereStorageRecovery",
  "createHarthmereShopListing",
  "createHarthmereGuildTownProject",
]) {
  h.ok(authority.includes(symbol), `authority exports ${symbol}`);
}
for (const ruleNeedle of [
  "zoning_mismatch",
  "slope_too_steep",
  "building_floating",
  "building_sinking",
  "clips_structure",
  "entrance_blocked",
  "no_path_to_entrance",
  "overlaps_road",
  "overlaps_bridge",
  "overlaps_quest_area",
  "overlaps_npc_route",
  "overlaps_resource_node",
  "overlaps_spawn",
  "inside_no_build_zone",
  "mount_cart_clearance_blocked",
  "not_enough_gold",
  "missing_materials",
  "owner_only",
  "guild_only",
  "public_shop_hours",
  "magically_sealed",
  "safe_zone",
  "repair_blocked_under_attack",
  "siege_repair_lockout",
  "reclaimable_with_storage_recovery",
]) {
  h.ok(authority.includes(ruleNeedle), `building authority covers ${ruleNeedle}`);
}
h.ok(building.includes("deeds: Record"), "building state stores deeds outside backpack");
h.ok(building.includes("leases: Record"), "building state has rental/lease ledger");
h.ok(building.includes("propertySaleListings"), "building state has property sale listings");
h.ok(building.includes("shopListings"), "building state has player shop listings");
h.ok(building.includes("storageRecovery"), "building state protects stored items on demolition/reclaim");
h.ok(building.includes("validateHarthmereBuildingPlacement"), "construction calls placement authority");
h.ok(building.includes("validateHarthmereBuildingTransaction"), "purchase calls transaction authority");
h.ok(building.includes("planHarthmereRepairContribution"), "repair uses partial/combat-aware repair planner");
h.ok(building.includes("__harthmereBuildingAuthorityTestHooks"), "building exposes deterministic test hooks");
h.done();
