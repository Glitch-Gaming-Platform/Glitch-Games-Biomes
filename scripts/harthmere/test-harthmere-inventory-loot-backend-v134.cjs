#!/usr/bin/env node
/* eslint-disable no-console */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ts = require("typescript");

const root = process.argv[2] || process.cwd();
const rel = "src/shared/harthmere/mmo_inventory_loot_authority_v1.ts";
const srcPath = path.join(root, rel);
if (!fs.existsSync(srcPath)) {
  console.error(`Missing ${rel}`);
  process.exit(1);
}
const tmp = path.join(os.tmpdir(), `mmo_inventory_loot_authority_v1.${process.pid}.cjs`);
const src = fs.readFileSync(srcPath, "utf8");
const transpiled = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  fileName: srcPath,
});
if (transpiled.diagnostics && transpiled.diagnostics.length) {
  for (const d of transpiled.diagnostics) console.error(d.messageText);
  process.exit(1);
}
fs.writeFileSync(tmp, transpiled.outputText);
const inv = require(tmp);

const {
  createHarthmereEmptyInventoryLootStateV1,
  createHarthmereInventoryLootActorV1,
  createHarthmereInventoryLootBusinessV1,
  createHarthmereInventoryLootGuildV1,
  rollHarthmereInventoryLootTableV1,
  reduceHarthmereInventoryLootMutationV1,
  createHarthmereInventoryLootClientSnapshotV1,
} = inv;

const now = 1_000_000;
function def(overrides) {
  return {
    itemId: "iron_ore",
    displayName: "Iron Ore",
    category: "material",
    rarity: "common",
    maxStackSize: 999,
    baseValueGold: 3,
    weight: 1,
    volume: 1,
    binding: "none",
    tradeable: true,
    legalClass: "common",
    allowedStorage: ["backpack", "bank", "business_warehouse", "guild_vault"],
    businessUses: ["weapons_tools", "general_trader", "repair_maintenance_person"],
    jobUses: ["gather", "craft", "repair"],
    townNeeds: ["maintenance"],
    perishable: false,
    hazardLevel: 0,
    contaminationRisk: 0,
    repairable: false,
    lootTableTags: ["ore"],
    uniqueInstance: false,
    ...overrides,
  };
}

const itemDefinitions = {
  iron_ore: def({ itemId: "iron_ore", displayName: "Iron Ore" }),
  repair_kit: def({ itemId: "repair_kit", displayName: "Repair Kit", category: "tool", maxStackSize: 50, businessUses: ["repair_maintenance_person", "weapons_tools"], jobUses: ["repair"], townNeeds: ["maintenance"] }),
  iron_sword: def({
    itemId: "iron_sword",
    displayName: "Iron Sword",
    category: "weapon",
    rarity: "uncommon",
    maxStackSize: 1,
    baseValueGold: 75,
    weight: 5,
    allowedStorage: ["backpack", "bank", "weapon_locker", "guild_vault", "business_warehouse"],
    businessUses: ["weapons_tools", "security_defense_contractor", "general_trader"],
    jobUses: ["security", "hunt"],
    townNeeds: ["safety"],
    durabilityMax: 100,
    repairable: true,
    repairInputs: [{ itemId: "repair_kit", count: 1 }],
    salvageOutputs: [{ itemId: "iron_ore", count: 2 }],
    uniqueInstance: true,
  }),
  guard_sword: def({
    itemId: "guard_sword",
    displayName: "Guard Sword",
    category: "weapon",
    legalClass: "restricted",
    requiredLicense: "security",
    requiredLicenseLevel: 2,
    allowedStorage: ["backpack", "weapon_locker", "guild_vault"],
    businessUses: ["security_defense_contractor"],
    jobUses: ["security"],
    townNeeds: ["safety"],
    durabilityMax: 120,
    repairable: true,
    uniqueInstance: true,
  }),
  grove_meal: def({
    itemId: "grove_meal",
    displayName: "Grove Meal",
    category: "food",
    maxStackSize: 30,
    baseValueGold: 8,
    allowedStorage: ["backpack", "cold_storage", "business_warehouse"],
    businessUses: ["food_service_restaurant", "hospitality_inn_hotel_shelter", "general_trader"],
    jobUses: ["delivery", "service"],
    townNeeds: ["food", "tourism"],
    perishable: true,
    expiresAfterMs: 60_000,
    repairable: false,
    lootTableTags: ["food"],
    uniqueInstance: false,
  }),
  medicine: def({
    itemId: "medicine",
    displayName: "Medicine",
    category: "medicine",
    maxStackSize: 25,
    baseValueGold: 20,
    legalClass: "license_required",
    requiredLicense: "medical",
    requiredLicenseLevel: 1,
    allowedStorage: ["backpack", "medical_cabinet", "business_warehouse"],
    businessUses: ["medical_doctor", "general_trader"],
    jobUses: ["medical", "delivery"],
    townNeeds: ["health"],
  }),
  raw_exotic_matter: def({
    itemId: "raw_exotic_matter",
    displayName: "Raw Exotic Matter",
    category: "fuel",
    maxStackSize: 10,
    baseValueGold: 80,
    legalClass: "license_required",
    requiredPermit: "exotic_matter_handling",
    requiredLicense: "hazardous_material",
    requiredLicenseLevel: 2,
    allowedStorage: ["hazard_containment", "business_warehouse"],
    businessUses: ["exotic_matter_refinery", "portal_transit_company", "teleport_owner", "magic_goods"],
    jobUses: ["gather", "delivery"],
    townNeeds: ["energy", "travel", "timeline_stability"],
    hazardLevel: 8,
    contaminationRisk: 7,
    lootTableTags: ["exotic"],
  }),
  stolen_relic: def({ itemId: "stolen_relic", displayName: "Stolen Relic", category: "relic", legalClass: "stolen", maxStackSize: 1, businessUses: ["general_trader", "magic_goods"], jobUses: ["exploration"], townNeeds: ["knowledge"], uniqueInstance: true }),
  contraband_charm: def({ itemId: "contraband_charm", displayName: "Contraband Charm", category: "relic", legalClass: "contraband", maxStackSize: 1, businessUses: ["magic_goods", "general_trader"], jobUses: ["magic"], townNeeds: ["timeline_stability"], uniqueInstance: true }),
  quest_key: def({ itemId: "quest_key", displayName: "Quest Key", category: "quest", legalClass: "quest_bound", binding: "quest", maxStackSize: 1, tradeable: false, allowedStorage: ["backpack"], businessUses: [], jobUses: ["quest"], townNeeds: ["knowledge"], uniqueInstance: true }),
  delivery_document: def({ itemId: "delivery_document", displayName: "Delivery Document", category: "document", maxStackSize: 20, allowedStorage: ["backpack", "business_warehouse", "courier_lockbox"], businessUses: ["courier", "general_trader"], jobUses: ["delivery"], townNeeds: ["logistics", "knowledge"] }),
  waste_bag: def({ itemId: "waste_bag", displayName: "Waste Bag", category: "waste", maxStackSize: 50, allowedStorage: ["waste_bin", "business_warehouse", "backpack"], businessUses: ["waste_sanitation_cleanup"], jobUses: ["cleanup"], townNeeds: ["sanitation"], contaminationRisk: 3 }),
};
const lootTables = {
  mucker_common: {
    tableId: "mucker_common",
    sourceTypes: ["npc:mucker"],
    tags: ["mucker", "wilds"],
    rolls: 1,
    guaranteedDrops: [{ itemId: "iron_ore", minCount: 2, maxCount: 2, weight: 1 }],
    weightedDrops: [{ itemId: "grove_meal", minCount: 1, maxCount: 1, weight: 1, instance: true }],
    rareDrops: [{ itemId: "stolen_relic", minCount: 1, maxCount: 1, weight: 1, chance: 1, legalFlags: ["stolen"], instance: true }],
    questDrops: [{ itemId: "quest_key", minCount: 1, maxCount: 1, weight: 1, instance: true, firstTimeTag: "mucker_intro_key" }],
  },
  ore_only: {
    tableId: "ore_only",
    sourceTypes: ["node:ore"],
    tags: ["ore"],
    rolls: 0,
    guaranteedDrops: [{ itemId: "iron_ore", minCount: 4, maxCount: 4, weight: 1 }],
    weightedDrops: [],
    rareDrops: [],
    questDrops: [],
  },
};
const ctx = { itemDefinitions, lootTables };
let state = createHarthmereEmptyInventoryLootStateV1();
function mut(req) {
  const r = reduceHarthmereInventoryLootMutationV1(state, { requestId: `req_${Math.random()}`, nowMs: now, actorId: "p1", ...req }, ctx);
  if (r.ok) state = r.state;
  return r;
}
function ok(req, msg) {
  const r = mut(req);
  assert.ok(r.ok, `${msg || req.operation} failed: ${r.errors.join(", ")}`);
  return r;
}
function bad(req, code, msg) {
  const r = mut(req);
  assert.ok(!r.ok, `${msg || req.operation} should have failed`);
  assert.ok(r.errors.some((e) => e.includes(code)), `${msg || req.operation} expected ${code}, got ${r.errors.join(",")}`);
  return r;
}

console.log("== Harthmere inventory/loot backend v134 ==");

// Register base runtime actors/businesses/guilds. Runtime starts empty; this is test setup.
ok({ operation: "register_actor" }, "register p1");
ok({ operation: "register_actor", actorId: "p2" }, "register p2");
state.actors.p1 = { ...state.actors.p1, partyId: "party_a", gold: 0 };
state.actors.p2 = { ...state.actors.p2, partyId: "party_b" };
ok({ operation: "register_business", businessId: "resto_1", businessTypeId: "food_service_restaurant", townId: "harthmere_grove", regionId: "grove" }, "register restaurant");
ok({ operation: "register_business", businessId: "courier_1", businessTypeId: "courier", townId: "harthmere_grove", regionId: "grove" }, "register courier");
ok({ operation: "register_business", businessId: "refinery_1", businessTypeId: "exotic_matter_refinery", townId: "harthmere_grove", regionId: "grove" }, "register refinery");
ok({ operation: "register_business", businessId: "weapons_1", businessTypeId: "weapons_tools", townId: "harthmere_grove", regionId: "grove" }, "register weapons shop");
ok({ operation: "register_guild", guildId: "guild_1" }, "register guild");
state.guilds.guild_1 = createHarthmereInventoryLootGuildV1("guild_1", ["p1", "p2"], { lootRule: "guild_project" });
state.actors.p1.guildId = "guild_1";
state.actors.p2.guildId = "guild_1";

// 1. Real loot lifecycle: source -> drop -> claim -> ledger, with anti-dupe/eligibility/expiry edges.
let r = ok({ operation: "create_loot_drop", lootTableId: "mucker_common", sourceKind: "npc:mucker", sourceId: "mucker_01", ownerActorIds: ["p1"], rngSeed: 7 }, "create loot drop");
const dropId = Object.keys(r.state.lootDrops)[0];
const token = r.state.lootDrops[dropId].pickupToken;
bad({ operation: "claim_loot_drop", dropId, pickupToken: "wrong" }, "invalid_pickup_token", "wrong token rejected");
ok({ operation: "claim_loot_drop", dropId, pickupToken: token }, "claim loot");
assert.strictEqual(state.actors.p1.items.iron_ore, 2, "claimed stack reaches inventory");
bad({ operation: "claim_loot_drop", dropId, pickupToken: token }, "loot_drop_not_available", "duplicate claim rejected");
r = ok({ operation: "create_loot_drop", itemId: "iron_ore", count: 1, sourceKind: "node:ore", sourceId: "ore_01", ownerActorIds: ["p1"] }, "create expiring drop");
const expiringDropId = Object.keys(r.state.lootDrops).find((id) => id !== dropId);
state.lootDrops[expiringDropId].expiresAtMs = now - 1;
bad({ operation: "claim_loot_drop", dropId: expiringDropId, pickupToken: state.lootDrops[expiringDropId].pickupToken }, "loot_drop_expired", "expired claim rejected");
r = ok({ operation: "create_loot_drop", itemId: "iron_ore", count: 1, sourceKind: "node:ore", sourceId: "ore_02", ownerActorIds: ["p2"] }, "create ineligible drop");
const ineligibleDropId = Object.keys(r.state.lootDrops).find((id) => ![dropId, expiringDropId].includes(id));
bad({ operation: "claim_loot_drop", dropId: ineligibleDropId, pickupToken: state.lootDrops[ineligibleDropId].pickupToken }, "actor_not_eligible_for_loot", "ineligible actor rejected");
console.log("✓ loot lifecycle, anti-dupe, expiry, and eligibility");

// 2. Item instances for durable/unique/spoilable/legal items.
r = ok({ operation: "create_item_instance", itemId: "iron_sword", quality: 88, sourceKind: "craft" }, "create sword instance");
const swordId = Object.keys(r.state.itemInstances).find((id) => r.state.itemInstances[id].itemId === "iron_sword" && r.state.itemInstances[id].ownerId === "p1");
assert.ok(swordId, "sword instance exists");
assert.strictEqual(state.itemInstances[swordId].durabilityMax, 100, "instance has durability max");
assert.strictEqual(state.itemInstances[swordId].quality, 88, "instance has quality");
assert.ok(!state.actors.p1.items.iron_sword, "unique instance is not flattened into item stack");
console.log("✓ item instances with durability/quality/source metadata");

// 3 + 4. Metadata and legal rules: licenses, permits, contraband, stolen goods.
bad({ operation: "create_item_instance", itemId: "guard_sword" }, "missing_required_license_or_permit", "restricted gear requires license");
state.actors.p1.licenses.security = 2;
ok({ operation: "create_item_instance", itemId: "guard_sword" }, "licensed restricted gear allowed");
ok({ operation: "grant_stack", itemId: "contraband_charm", count: 1 }, "seed contraband");
ok({ operation: "grant_stack", itemId: "stolen_relic", count: 1 }, "seed stolen goods");
r = ok({ operation: "validate_legal_inventory" }, "validate legal inventory");
assert.ok(r.warnings.some((w) => w.includes("contraband_item_carried")), "contraband warning present");
assert.ok(r.warnings.some((w) => w.includes("stolen_goods_carried")), "stolen warning present");
ok({ operation: "grant_stack", itemId: "raw_exotic_matter", count: 2 }, "seed raw exotic matter");
bad({ operation: "move_to_business_inventory", businessId: "refinery_1", itemId: "raw_exotic_matter", count: 1, storageClass: "hazard_containment" }, "business_cannot_store_item", "refinery needs hazard license/permit");
state.businesses.refinery_1.licenses.hazardous_material = 2;
state.businesses.refinery_1.permits.push("exotic_matter_handling");
ok({ operation: "move_to_business_inventory", businessId: "refinery_1", itemId: "raw_exotic_matter", count: 1, storageClass: "hazard_containment" }, "licensed refinery accepts exotic matter");
console.log("✓ legal metadata, restricted goods, stolen goods, and permits");

// 5. Business/warehouse inventory with real stock and storage restrictions.
ok({ operation: "grant_stack", itemId: "grove_meal", count: 20 }, "seed meals");
ok({ operation: "move_to_business_inventory", businessId: "resto_1", itemId: "grove_meal", count: 10, storageClass: "business_warehouse" }, "restaurant stock deposit");
assert.strictEqual(state.businesses.resto_1.inventory.grove_meal, 10, "restaurant stock increased");
bad({ operation: "move_to_business_inventory", businessId: "weapons_1", itemId: "grove_meal", count: 1, storageClass: "business_warehouse" }, "business_cannot_store_item", "wrong business use rejected");
state.businesses.weapons_1.maxSlots = 0;
bad({ operation: "move_to_business_inventory", businessId: "weapons_1", itemId: "iron_ore", count: 1, storageClass: "business_warehouse" }, "business_inventory_full", "business capacity enforced");
console.log("✓ business inventory, storage class, business-use, and capacity");

// 6. Perishability, decay, contamination.
r = ok({ operation: "create_item_instance", itemId: "grove_meal", quality: 60 }, "create perishable meal instance");
const mealId = Object.keys(r.state.itemInstances).find((id) => r.state.itemInstances[id].itemId === "grove_meal" && r.state.itemInstances[id].ownerId === "p1");
ok({ operation: "tick_decay", nowMs: now + 30_000 }, "pre-expiry decay tick");
assert.strictEqual(state.itemInstances[mealId].broken, false, "meal is not spoiled before expiry");
ok({ operation: "tick_decay", nowMs: now + 61_000 }, "post-expiry decay tick");
assert.strictEqual(state.itemInstances[mealId].broken, true, "meal spoils after expiry");
state.businesses.refinery_1.permits = [];
const sanitationBefore = state.businesses.refinery_1.sanitationRating;
ok({ operation: "tick_decay", nowMs: now + 62_000 }, "hazard tick");
assert.ok(state.businesses.refinery_1.sanitationRating < sanitationBefore, "unpermitted hazard stock hurts sanitation");
console.log("✓ perishability, spoilage, and contamination pressure");

// 7. Durability, damage, repair, overrepair rejection, salvage, and loaned-item protection.
ok({ operation: "grant_stack", itemId: "repair_kit", count: 3 }, "seed repair kits");
ok({ operation: "damage_item_instance", instanceId: swordId, damageAmount: 40 }, "damage sword");
assert.ok(state.itemInstances[swordId].durability < 100, "durability decreased");
ok({ operation: "repair_item_instance", instanceId: swordId }, "repair sword");
assert.strictEqual(state.itemInstances[swordId].durability, 100, "durability restored");
bad({ operation: "repair_item_instance", instanceId: swordId }, "item_already_fully_repaired", "overrepair rejected");
ok({ operation: "salvage_item_instance", instanceId: swordId }, "salvage owned sword");
assert.strictEqual(state.itemInstances[swordId].location, "destroyed", "salvaged item destroyed");
assert.ok(state.actors.p1.items.iron_ore >= 2, "salvage output granted");
console.log("✓ durability, repair, overrepair, and salvage");

// 8. Jobs-board item escrow/delivery, plus missing/expired edge cases.
ok({ operation: "grant_stack", itemId: "delivery_document", count: 3 }, "seed delivery docs");
bad({ operation: "create_job_item_escrow", jobId: "job_missing", requiredItems: [{ itemId: "medicine", count: 1 }], targetOwnerKind: "business", targetOwnerId: "courier_1", deadlineAtMs: now + 10_000 }, "insufficient_item_count:medicine", "missing escrow item rejected");
r = ok({ operation: "create_job_item_escrow", jobId: "job_delivery", boardId: "grove_board", requiredItems: [{ itemId: "delivery_document", count: 2 }], targetOwnerKind: "business", targetOwnerId: "courier_1", rewardGold: 25, deadlineAtMs: now + 10_000 }, "create job escrow");
assert.strictEqual(state.actors.p1.escrow.delivery_document, 2, "items held in escrow");
ok({ operation: "complete_job_item_escrow", jobId: "job_delivery", nowMs: now + 5_000 }, "complete delivery escrow");
assert.strictEqual(state.businesses.courier_1.inventory.delivery_document, 2, "target business receives delivery goods");
assert.strictEqual(state.actors.p1.gold, 25, "seeker receives reward");
ok({ operation: "grant_stack", itemId: "delivery_document", count: 1 }, "seed late delivery doc");
ok({ operation: "create_job_item_escrow", jobId: "job_late", requiredItems: [{ itemId: "delivery_document", count: 1 }], targetOwnerKind: "business", targetOwnerId: "courier_1", deadlineAtMs: now + 1 }, "create late job");
bad({ operation: "complete_job_item_escrow", jobId: "job_late", nowMs: now + 5 }, "job_escrow_deadline_expired", "late delivery rejected");
console.log("✓ jobs-board item escrow, delivery, rewards, missing item, and deadline edge cases");

// 9. Loot tables by source, guaranteed/weighted/rare/quest/first-time behavior.
const firstRoll = rollHarthmereInventoryLootTableV1(lootTables.mucker_common, ctx, 123, []);
assert.ok(firstRoll.some((e) => e.itemId === "iron_ore"), "guaranteed ore rolls");
assert.ok(firstRoll.some((e) => e.itemId === "quest_key"), "first-time quest drop rolls");
const laterRoll = rollHarthmereInventoryLootTableV1(lootTables.mucker_common, ctx, 123, ["mucker_intro_key"]);
assert.ok(!laterRoll.some((e) => e.itemId === "quest_key"), "first-time quest drop suppressed after tag");
console.log("✓ source loot tables and first-time drop rules");

// 10. Guild loot rules: guild project vault, assignment, item loan, no salvage while loaned, return.
r = ok({ operation: "create_loot_drop", itemId: "iron_ore", count: 4, sourceKind: "boss", sourceId: "boss_01", ownerActorIds: ["p1", "p2"], guildId: "guild_1" }, "create guild ore drop");
const guildOreDrop = Object.keys(r.state.lootDrops).find((id) => r.state.lootDrops[id].sourceId === "boss_01");
ok({ operation: "claim_loot_drop", dropId: guildOreDrop, pickupToken: state.lootDrops[guildOreDrop].pickupToken }, "claim guild project ore");
assert.strictEqual(state.guilds.guild_1.vault.iron_ore, 4, "guild project rule routes stack to vault");
ok({ operation: "assign_guild_loot", guildId: "guild_1", itemId: "iron_ore", count: 2, targetOwnerKind: "actor", targetOwnerId: "p2", dropId: guildOreDrop }, "assign guild loot");
assert.strictEqual(state.actors.p2.items.iron_ore, 2, "assigned guild loot reaches member");
r = ok({ operation: "create_loot_drop", itemId: "iron_sword", count: 1, sourceKind: "boss", sourceId: "boss_02", ownerActorIds: ["p1", "p2"], guildId: "guild_1" }, "create guild sword drop");
const guildSwordDrop = Object.keys(r.state.lootDrops).find((id) => r.state.lootDrops[id].sourceId === "boss_02");
ok({ operation: "claim_loot_drop", dropId: guildSwordDrop, pickupToken: state.lootDrops[guildSwordDrop].pickupToken }, "claim guild project sword");
const guildSwordId = state.guilds.guild_1.instanceIds.find((id) => state.itemInstances[id].itemId === "iron_sword");
assert.ok(guildSwordId, "guild sword instance in vault");
ok({ operation: "loan_guild_item", guildId: "guild_1", instanceId: guildSwordId, targetOwnerKind: "actor", targetOwnerId: "p1", deadlineAtMs: now + 100_000 }, "loan guild sword");
bad({ operation: "salvage_item_instance", instanceId: guildSwordId }, "cannot_salvage_loaned_guild_item", "loaned guild item protected from salvage");
ok({ operation: "return_guild_loan", guildId: "guild_1", instanceId: guildSwordId }, "return guild loan");
assert.ok(state.guilds.guild_1.instanceIds.includes(guildSwordId), "returned loan goes back to guild vault");
console.log("✓ guild project loot, assignment, loans, and abuse protection");

// 11. Town demand signals from real business inventory.
ok({ operation: "update_town_demand", townId: "harthmere_grove", regionId: "grove" }, "initial town demand");
const foodDemandWithStock = state.townDemand.harthmere_grove.needs.food.value;
state.businesses.resto_1.inventory = {};
ok({ operation: "update_town_demand", townId: "harthmere_grove", regionId: "grove" }, "town demand after shortage");
const foodDemandShortage = state.townDemand.harthmere_grove.needs.food.value;
assert.ok(foodDemandShortage > foodDemandWithStock, `food demand should rise when stock disappears (${foodDemandShortage} > ${foodDemandWithStock})`);
console.log("✓ town demand generated from real stock levels");

const snapshot = createHarthmereInventoryLootClientSnapshotV1(state, "p1");
assert.ok(snapshot.recentLootLedger.length > 0, "client snapshot has real recent loot ledger");
assert.ok(snapshot.guildVault, "client snapshot has real guild vault summary");

console.log("");
console.log("All inventory/loot backend v134 tests passed.");
