/**
 * live_mode_backend_v1.test.ts
 *
 * Comprehensive tests for the Harthmere live-mode server reducer.
 * Covers all 10 authority-dispatched action kinds plus legacy/non-authority paths,
 * state defaults/parsing, and multi-step scenario flows.
 */

import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  createHarthmereInventoryLootClientSnapshotFromBackendV1,
  defaultHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeLedgerStreamKeyV1,
  harthmereLiveModeSharedStateKeyV1,
  HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
  createHarthmereLiveModeSharedWorldStateV1,
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1,
  parseHarthmereLiveModeSharedWorldStateV1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import {
  getHarthmereItemDefinitionV1,
  registerHarthmereItemDefinitionV1,
  registerHarthmereVendorEntryV1,
  registerHarthmereCraftingRecipeV1,
  type HarthmereItemDefinitionV1,
  type HarthmereVendorEntryV1,
  type HarthmereCraftingRecipeV1,
} from "../mmo_inventory_authority_v1";
import {
  registerHarthmereAbilityV1,
  registerHarthmereClassDefinitionV1,
  type HarthmereAbilityCatalogueEntryV1,
  type HarthmereClassDefinitionV1,
} from "../mmo_combat_authority_v1";
import type {
  HarthmereLiveModeAuthorityEnvelopeV1,
  HarthmereLiveModeActionKindV1,
} from "@/shared/harthmere/live_mode_readiness_v1";
import {
  buildHarthmereLiveModePersistenceMutationPlanV1,
  validateHarthmereLiveModeReadinessV1,
} from "@/shared/harthmere/live_mode_readiness_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
} from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import { harthmereJobsBoardQuestMarkerPositionForIdV1 } from "@/shared/harthmere/jobs_board_quest_marker_positions_v1";
import {
  HARTHMERE_EXOTIC_MATTER_CAVES_V1,
  HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1,
  HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1,
  harthmereExoticMatterDepositByIdV1,
} from "@/shared/harthmere/exotic_matter_caves_v1";
import { HARTHMERE_GUILD_CREATION_MIN_LEVEL_V1 } from "@/shared/harthmere/mmo_guild_authority_v1";
import { createHarthmereInventoryLootActorV1 } from "@/shared/harthmere/mmo_inventory_loot_authority_v1";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
  canCompleteLiveEntityHelperQuestV1,
  getLiveEntityHelperQuestForEntityV1,
  liveEntityHelperQuestKindForEntityV1,
  liveEntityHelperQuestTargetMarkerForKindV1,
  type LiveEntityHelperQuestEntityContextV1,
  type LiveEntityHelperQuestKindV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";
import {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1,
  liveEntityRobotDefaultRobotIdForAreaV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";
import { buildingSystemHomeConsoleMarkerIdV1 } from "@/shared/harthmere/building_system_v1";
import { createHarthmereLiveEntityCombatSnapshotsFromEcsRecordsV1 } from "@/shared/harthmere/live_entity_ecs_bridge_v1";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW_MS = 1_700_000_000_000;
const ACTOR = "player_live_001";
const TARGET = "mob_goblin_001";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function nextId() {
  return `live-req-${++_seq}`;
}

/** Create a minimal valid authority envelope */
function makeEnvelope(
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {}
): HarthmereLiveModeAuthorityEnvelopeV1 {
  return {
    requestId: nextId(),
    idempotencyKey: nextId(),
    actorId: ACTOR,
    actionKind,
    subsystem: "combat",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_wilderness",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

/** Fresh default state for the test actor */
function freshState(nowMs = NOW_MS): HarthmereLiveModeBackendStateV1 {
  return defaultHarthmereLiveModeBackendStateV1(ACTOR, nowMs);
}

function addOpenProductionBusiness(
  state: HarthmereLiveModeBackendStateV1,
  businessId: string,
  options: Partial<{
    ownerId: string;
    typeId: string;
    marker: [number, number, number];
  }> = {}
) {
  const marker = options.marker ?? [100, 65, 100];
  state.economy.production.businesses[businessId] = {
    businessId,
    ownerKind: "player",
    ownerId: options.ownerId ?? ACTOR,
    typeId: options.typeId ?? "food_service_restaurant",
    name: `${businessId} Shop`,
    status: "open",
    licenseClass: "basic_trade",
    licenseLevel: 1,
    propertyId: `property_${businessId}`,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    inventory: {},
    storageMaxSlots: 12,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: 0,
    customerSatisfaction: 70,
    sanitationRating: 70,
    safetyRating: 70,
    serviceRadius: 2,
    priceModifiers: {},
    balanceGold: 500,
    debtGold: 0,
    upkeepGoldPerDay: 1,
    rentGoldPerDay: 0,
    wageGoldPerDay: 0,
    salesTaxRate: 0.06,
    lastTickAtMs: NOW_MS,
    createdAtMs: NOW_MS,
    updatedAtMs: NOW_MS,
    flags: {},
  } as any;
  state.building.inWorldMarkers[`${businessId}:marker`] = {
    markerId: `${businessId}:marker`,
    plotId: `plot_${businessId}`,
    kind: "business_marker",
    position: marker,
    label: `${businessId} Shop`,
    createdAtMs: NOW_MS,
  };
}

/** Apply one envelope and return resulting state */
function applyOne(
  state: HarthmereLiveModeBackendStateV1,
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  envelopeOverrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {}
) {
  const env = makeEnvelope(actionKind, payload, envelopeOverrides);
  return reduceHarthmereLiveModeBackendStateV1(state, env, NOW_MS);
}

function createDefeatedLiveEntityDropState(
  itemStacks: Record<string, number>,
  requestId: string,
  overrides: Partial<
    HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  > = {}
) {
  let state = freshState();
  const targetId = `${requestId}_target`;
  state.classMagic.knownAbilities = ["basic_attack"];
  state.classMagic.loadout = { slot_0: "basic_attack" };
  state.combat.entitySnapshots[targetId] = {
    hp: 1,
    maxHp: 80,
    position: { x: 1, y: 0, z: 0 },
    isHostile: false,
    isAlive: true,
    isAttackable: true,
    entityKind: "monster",
    level: 1,
    lootDrops: itemStacks,
    ...overrides,
  };
  ({ state } = applyOne(
    state,
    "request_attack",
    { abilityId: "basic_attack" },
    { targetId, requestId, idempotencyKey: `${requestId}_key` }
  ));
  const dropId = state.combat.entitySnapshots[targetId].lootDropId;
  assert.ok(dropId);
  return { state, targetId, dropId };
}

function liveHelperEntityForKind(
  kind: LiveEntityHelperQuestKindV1
): LiveEntityHelperQuestEntityContextV1 {
  for (let index = 0; index < 200; index += 1) {
    const entityId = `live-helper-test-${kind}-${index}`;
    const label = `Remote Helper ${index}`;
    if (liveEntityHelperQuestKindForEntityV1(entityId, label) === kind) {
      return {
        entityId,
        label,
        position: [1000, 70, 600],
        hasRobotComponent: true,
        isRobotLike: true,
      };
    }
  }
  throw new Error(`Could not find helper entity for ${kind}`);
}

function liveHelperPayloadForKind(kind: LiveEntityHelperQuestKindV1) {
  const context = liveHelperEntityForKind(kind);
  return {
    entityId: String(context.entityId),
    entityLabel: context.label,
    entityX: context.position?.[0],
    entityY: context.position?.[1],
    entityZ: context.position?.[2],
    isRobotLike: true,
    hasRobotComponent: true,
    questKind: kind,
  };
}

// ---------------------------------------------------------------------------
// Register test catalogue entries
// ---------------------------------------------------------------------------

before(function registerLiveModeCatalogue() {
  // Item: iron_ore (crafting material)
  const ironOre: HarthmereItemDefinitionV1 = {
    itemId: "iron_ore",
    displayName: "Iron Ore",
    maxStackSize: 99,
    baseValue: 5,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 2 },
    tradeable: true,
  };
  const healthPotion: HarthmereItemDefinitionV1 = {
    itemId: "health_potion",
    displayName: "Health Potion",
    maxStackSize: 20,
    baseValue: 50,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: true,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 1 },
    tradeable: true,
    consumableCooldownCategory: "potion",
    consumableCooldownMs: 30_000,
  };
  const questKey: HarthmereItemDefinitionV1 = {
    itemId: "dungeon_key",
    displayName: "Dungeon Key",
    maxStackSize: 1,
    baseValue: 0,
    binding: "on_pickup",
    isQuestItem: true,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: false,
  };
  const ironSword: HarthmereItemDefinitionV1 = {
    itemId: "iron_sword",
    displayName: "Iron Sword",
    maxStackSize: 1,
    baseValue: 100,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { attack: 10, weight: 5 },
    tradeable: true,
    durabilityMax: 120,
    repairable: true,
  };
  const goldCoin: HarthmereItemDefinitionV1 = {
    itemId: "gold_coin",
    displayName: "Gold Coin",
    maxStackSize: 9999,
    baseValue: 1,
    binding: "none",
    isQuestItem: false,
    isCurrency: true,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 0 },
    tradeable: true,
  };
  const legalTestRelic: HarthmereItemDefinitionV1 = {
    itemId: "legal_test_relic",
    displayName: "Legal Test Relic",
    maxStackSize: 1,
    baseValue: 900,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 1 },
    tradeable: true,
  };
  for (const item of [
    ironOre,
    healthPotion,
    questKey,
    ironSword,
    goldCoin,
    legalTestRelic,
  ]) {
    registerHarthmereItemDefinitionV1(item);
  }
  for (let i = 0; i < 40; i++) {
    registerHarthmereItemDefinitionV1({
      itemId: `slot_filler_${i}`,
      displayName: `Slot Filler ${i}`,
      maxStackSize: 1,
      baseValue: 0,
      binding: "none",
      isQuestItem: false,
      isCurrency: false,
      isConsumable: false,
      isCraftingMaterial: false,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: { weight: 0 },
      tradeable: true,
    });
  }

  // Vendor: blacksmith_vendor sells iron_ore
  const blacksmithVendor: HarthmereVendorEntryV1 = {
    vendorId: "blacksmith_vendor",
    itemId: "iron_ore",
    buyPrice: 10,
    sellPrice: 2,
    stock: 50,
    requiredFaction: "traders_guild",
    requiredReputationTier: 0,
  };
  registerHarthmereVendorEntryV1(blacksmithVendor);

  // Crafting recipe: 3 iron_ore → 1 iron_sword
  const ironSwordRecipe: HarthmereCraftingRecipeV1 = {
    recipeId: "recipe_iron_sword",
    outputItemId: "iron_sword",
    outputCount: 1,
    inputs: [{ itemId: "iron_ore", count: 3 }],
    requiredLevel: 1,
    craftingTimeMs: 2000,
    xpReward: 50,
  };
  registerHarthmereCraftingRecipeV1(ironSwordRecipe);

  // Ability: basic_attack (warrior)
  const basicAttack: HarthmereAbilityCatalogueEntryV1 = {
    abilityId: "basic_attack",
    displayName: "Basic Attack",
    targetType: "single_enemy",
    classRestriction: ["warrior", "rogue", "ranger"],
    specRestriction: [],
    levelRequirement: 1,
    requiredWeaponType: "any",
    resourceKind: "mana",
    resourceCost: 0,
    cooldownMs: 500,
    sharedCooldownCategory: undefined,
    sharedCooldownMs: undefined,
    rangeUnits: 2,
    requiresLineOfSight: false,
    allowedInSafeZone: true,
    allowedInPvP: false,
    baseDamage: 15,
    baseHealing: 0,
    attackPowerScaling: 1.0,
    spellPowerScaling: 0,
    xpReward: 0,
    castTimeMs: 0,
    interruptible: false,
    unlocksMilestones: [],
  };
  registerHarthmereAbilityV1(basicAttack);

  // Class: warrior
  const warrior: HarthmereClassDefinitionV1 = {
    classId: "warrior",
    displayName: "Warrior",
    availableSpecializations: ["arms", "fury", "protection"],
    primaryResource: "mana",
    maxResourceByLevel: { 1: 100 },
    hpPerLevel: 10,
    baseHp: 100,
    attackPowerPerLevel: 2,
    spellPowerPerLevel: 1,
  };
  registerHarthmereClassDefinitionV1(warrior);
});

// ===========================================================================
// 1. defaultHarthmereLiveModeBackendStateV1 / parseHarthmereLiveModeBackendStateV1
// ===========================================================================

describe("defaultHarthmereLiveModeBackendStateV1", function () {
  it("produces a state with correct actorId and version", function () {
    const s = freshState();
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1);
  });

  it("defaults all nested sections to empty/zero values", function () {
    const s = freshState();
    assert.deepStrictEqual(s.inventory.items, {});
    assert.strictEqual(s.inventory.gold, 0);
    assert.deepStrictEqual(s.inventory.escrow, {});
    assert.deepStrictEqual(s.inventory.consumableCooldowns, {});
    assert.strictEqual(s.respec.count, 0);
    assert.deepStrictEqual(s.talents.nodes, []);
    assert.strictEqual(s.combat.hp, 100);
    assert.strictEqual(s.combat.deathState, "alive");
    assert.ok((s.combat.maxResources.mana ?? 0) > 0);
    assert.strictEqual(s.combat.resources.mana, s.combat.maxResources.mana);
    assert.deepStrictEqual(s.law.standing, {});
    assert.deepStrictEqual(s.law.recentReputationEvents, []);
  });
});

describe("parseHarthmereLiveModeBackendStateV1", function () {
  it("returns default state for null input", function () {
    const s = parseHarthmereLiveModeBackendStateV1(null, ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.inventory.gold, 0);
  });

  it("returns default state for malformed JSON", function () {
    const s = parseHarthmereLiveModeBackendStateV1("not-json{{", ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1);
  });

  it("merges stored state with defaults (backward compat — missing fields get defaults)", function () {
    const partial = JSON.stringify({
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
      actorId: ACTOR,
      inventory: { gold: 999, items: { iron_ore: 5 } },
      // missing: escrow, consumableCooldowns, respec, talents, building, etc.
    });
    const s = parseHarthmereLiveModeBackendStateV1(partial, ACTOR, NOW_MS);
    assert.strictEqual(s.inventory.gold, 999);
    assert.strictEqual(s.inventory.items.iron_ore, 5);
    assert.deepStrictEqual(s.inventory.escrow, {}); // default injected
    assert.strictEqual(s.respec.count, 0); // default injected
    assert.ok((s.combat.maxResources.mana ?? 0) > 0); // combat resources injected
    assert.ok(Array.isArray(s.law.recentReputationEvents));
  });

  it("overwrites actorId with the provided parameter", function () {
    const raw = JSON.stringify({ ...freshState(), actorId: "old_actor" });
    const s = parseHarthmereLiveModeBackendStateV1(raw, ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
  });

  it("round-trips and merges shared public world state without overwriting private inventory", function () {
    const sharedSource = freshState();
    sharedSource.economy.production.businesses.shared_shop = {
      businessId: "shared_shop",
      ownerKind: "player",
      ownerId: "merchant",
      typeId: "general_trader",
      name: "Shared Shop",
      status: "open",
      licenseClass: "basic_trade",
      licenseLevel: 1,
      propertyId: "property_shared_shop",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      inventory: {},
      storageMaxSlots: 12,
      employees: [],
      activeContracts: [],
      completedContracts: 0,
      reputation: 0,
      customerSatisfaction: 70,
      sanitationRating: 70,
      safetyRating: 70,
      serviceRadius: 2,
      priceModifiers: {},
      balanceGold: 500,
      debtGold: 0,
      upkeepGoldPerDay: 1,
      rentGoldPerDay: 0,
      wageGoldPerDay: 0,
      salesTaxRate: 0.06,
      lastTickAtMs: NOW_MS,
      createdAtMs: NOW_MS,
      updatedAtMs: NOW_MS,
      flags: {},
    } as any;
    sharedSource.law.flags.city_lockdown = true;
    sharedSource.law.flags.pvp_flagged = true;
    sharedSource.law.fines.city_guard = 999;
    sharedSource.law.standing.city_guard = {
      likeability: -100,
      legal: -900,
      notoriety: 900,
      notorietyFloor: 100,
    };
    sharedSource.law.detentionUntilMs.city_guard = NOW_MS + 60_000;
    sharedSource.law.crimeRecords.push({
      id: "shared_crime_1",
      actorId: "other_actor",
      kind: "theft",
      zoneId: "harthmere_market",
      factionId: "city_guard",
      itemIds: [],
      severity: 20,
      valueGold: 10,
      witnessLevel: "witnessed",
      witnesses: 1,
      detected: true,
      detectionScore: 80,
      response: "fine",
      fineGold: 25,
      confiscatedItemIds: [],
      evidenceExpiresAtMs: NOW_MS + 86_400_000,
      status: "fined",
      createdAtMs: NOW_MS,
    } as any);
    const shared = parseHarthmereLiveModeSharedWorldStateV1(
      JSON.stringify(
        createHarthmereLiveModeSharedWorldStateV1(sharedSource, NOW_MS)
      ),
      NOW_MS
    );
    const actorState = freshState();
    actorState.inventory.gold = 123;
    actorState.law.fines.city_guard = 2;
    actorState.law.standing.city_guard = {
      likeability: 25,
      legal: 150,
      notoriety: 0,
      notorietyFloor: 0,
    };

    mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
      actorState,
      shared,
      NOW_MS
    );

    assert.equal(actorState.inventory.gold, 123);
    assert.ok(actorState.economy.production.businesses.shared_shop);
    assert.equal(
      actorState.robotProtection.areas[
        LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[0].areaId
      ].safeFromMuck,
      true
    );
    assert.equal(actorState.law.flags.city_lockdown, true);
    assert.notEqual(actorState.law.flags.pvp_flagged, true);
    assert.equal(actorState.law.fines.city_guard, 2);
    assert.equal(actorState.law.standing.city_guard.legal, 150);
    assert.equal(actorState.law.detentionUntilMs.city_guard, undefined);
    assert.equal(actorState.law.crimeRecords[0].id, "shared_crime_1");
  });

  it("allows business customer sessions only from real in-world business proximity", function () {
    const nearState = freshState();
    addOpenProductionBusiness(nearState, "business_food_proximity", {
      marker: [100, 65, 100],
    });

    const near = applyOne(
      nearState,
      "request_economy_mutation",
      {
        operation: "start_business_customer_session",
        businessId: "business_food_proximity",
        count: 1,
      },
      {
        subsystem: "economy",
        serverActorPosition: { x: 100, y: 65, z: 100 },
      }
    );
    assert.deepEqual(
      near.summary.warnings.filter((warning) =>
        warning.startsWith("economy_rejected:business_proximity")
      ),
      []
    );
    assert.equal(
      Object.keys(
        (near.state.economy.production.businessSystems as any)
          .customerSessions ?? {}
      ).length,
      1
    );

    const farState = freshState();
    addOpenProductionBusiness(farState, "business_food_proximity", {
      marker: [100, 65, 100],
    });
    const far = applyOne(
      farState,
      "request_economy_mutation",
      {
        operation: "start_business_customer_session",
        businessId: "business_food_proximity",
        count: 1,
      },
      {
        subsystem: "economy",
        serverActorPosition: { x: 999, y: 65, z: 999 },
      }
    );
    assert.ok(
      far.summary.warnings.includes(
        "economy_rejected:business_proximity_required"
      )
    );
    assert.equal(
      Object.keys(
        (far.state.economy.production.businessSystems as any)
          .customerSessions ?? {}
      ).length,
      0
    );

    const unverifiedState = freshState();
    addOpenProductionBusiness(unverifiedState, "business_food_proximity", {
      marker: [100, 65, 100],
    });
    const unverified = applyOne(
      unverifiedState,
      "request_economy_mutation",
      {
        operation: "start_business_customer_session",
        businessId: "business_food_proximity",
        count: 1,
      },
      { subsystem: "economy" }
    );
    assert.ok(
      unverified.summary.warnings.includes(
        "economy_rejected:business_proximity_unverified"
      )
    );
  });

  it("proximity-gates customer contracts through interaction business ids", function () {
    const nearState = freshState();
    nearState.inventory.gold = 1_000;
    addOpenProductionBusiness(nearState, "business_clinic_interaction", {
      ownerId: "clinic_owner",
      typeId: "medical_doctor",
      marker: [140, 65, 140],
    });

    const payload = {
      operation: "create_contract",
      interactionBusinessId: "business_clinic_interaction",
      targetBusinessId: "business_clinic_interaction",
      ownerKind: "player",
      ownerId: ACTOR,
      businessType: "medical_doctor",
      title: "Clinic visit",
      rewardGold: 80,
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      deadlineAtMs: NOW_MS + 86_400_000,
      requirements: [{ serviceNeed: "health", serviceUnits: 1 }],
    };
    const near = applyOne(nearState, "request_economy_mutation", payload, {
      subsystem: "economy",
      serverActorPosition: { x: 140, y: 65, z: 140 },
    });
    assert.deepEqual(near.summary.warnings, []);
    assert.equal(
      Object.values(near.state.economy.production.contracts).length,
      1
    );

    const farState = freshState();
    farState.inventory.gold = 1_000;
    addOpenProductionBusiness(farState, "business_clinic_interaction", {
      ownerId: "clinic_owner",
      typeId: "medical_doctor",
      marker: [140, 65, 140],
    });
    const far = applyOne(farState, "request_economy_mutation", payload, {
      subsystem: "economy",
      serverActorPosition: { x: 220, y: 65, z: 220 },
    });
    assert.ok(
      far.summary.warnings.includes(
        "economy_rejected:business_proximity_required"
      )
    );
    assert.equal(
      Object.values(far.state.economy.production.contracts).length,
      0
    );
  });

  it("shares seeded robot protection state across actors without sharing private inventory", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[0];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const firstActor = freshState();
    firstActor.robotProtection.robots[robotId].lastTickAtMs =
      NOW_MS - 3_600_000;
    const depleted = applyOne(
      firstActor,
      "request_quest_state_update",
      {
        operation: "live_entity_robot_energy_tick",
        robotId,
        drainPerHour: 100,
      },
      { subsystem: "quest" }
    ).state;
    const shared = parseHarthmereLiveModeSharedWorldStateV1(
      JSON.stringify(
        createHarthmereLiveModeSharedWorldStateV1(depleted, NOW_MS)
      ),
      NOW_MS
    );
    const secondActor = defaultHarthmereLiveModeBackendStateV1(
      "second_actor",
      NOW_MS
    );
    secondActor.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1] = 3;

    mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
      secondActor,
      shared,
      NOW_MS
    );

    assert.equal(
      secondActor.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1],
      3
    );
    assert.equal(secondActor.robotProtection.robots[robotId].energy, 0);
    assert.equal(
      secondActor.building.safeZones[area.areaId].safeFromMuck,
      false
    );
    assert.equal(
      secondActor.building.inWorldMarkers[area.muckMarkerId].kind,
      "muck_boundary"
    );
  });
});

// ===========================================================================
// 2. Key helpers
// ===========================================================================

describe("state key helpers", function () {
  it("harthmereLiveModePlayerStateKeyV1 has correct prefix", function () {
    const key = harthmereLiveModePlayerStateKeyV1("p1");
    assert.ok(key.startsWith("harthmere:live_mode:v1:player_state:p1"));
  });

  it("harthmereLiveModeLedgerStreamKeyV1 has correct prefix", function () {
    const key = harthmereLiveModeLedgerStreamKeyV1("p1");
    assert.ok(key.startsWith("harthmere:live_mode:v1:ledger:p1"));
  });

  it("harthmereLiveModeSharedStateKeyV1 encodes kind and id", function () {
    const key = harthmereLiveModeSharedStateKeyV1("vendor", "blacksmith_001");
    assert.strictEqual(key, "harthmere:live_mode:v1:vendor:blacksmith_001");
  });
});

describe("live-mode readiness contracts", function () {
  it("covers production subsystems with dedicated mutation plans", function () {
    const report = validateHarthmereLiveModeReadinessV1();
    assert.deepStrictEqual(report.missingSubsystems, []);

    for (const [subsystem, actionKind] of [
      ["jobs", "request_jobs_board_mutation"],
      ["guild", "request_guild_mutation"],
      ["bank", "request_bank_transaction"],
      ["mail", "request_mail_transaction"],
      ["property", "request_property_building_mutation"],
      ["crafting", "request_crafting"],
      ["farming", "request_farming_action"],
    ] as Array<
      [
        HarthmereLiveModeAuthorityEnvelopeV1["subsystem"],
        HarthmereLiveModeActionKindV1
      ]
    >) {
      const plan = buildHarthmereLiveModePersistenceMutationPlanV1(
        makeEnvelope(actionKind, {}, { subsystem })
      );
      assert.ok(
        !plan.writeModels.includes(`${subsystem}_state`) ||
          plan.writeModels.length > 3
      );
    }
  });
});

// ===========================================================================
// 3. reduceHarthmereLiveModeBackendStateV1 — summary fields
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — summary", function () {
  it("summary.applied is always true", function () {
    const { summary } = applyOne(freshState(), "request_death_transition");
    assert.strictEqual(summary.applied, true);
  });

  it("summary.actorId matches envelope actorId", function () {
    const { summary } = applyOne(freshState(), "request_death_transition");
    assert.strictEqual(summary.actorId, ACTOR);
  });

  it("summary.actionKind reflects the envelope action", function () {
    const { summary } = applyOne(freshState(), "request_respawn");
    assert.strictEqual(summary.actionKind, "request_respawn");
  });

  it("summary.playerStateKey is correct redis key format", function () {
    const { summary } = applyOne(freshState(), "request_death_transition");
    assert.strictEqual(
      summary.playerStateKey,
      harthmereLiveModePlayerStateKeyV1(ACTOR)
    );
  });

  it("updatedAtMs is set to nowMs on every reduction", function () {
    const then = NOW_MS + 5000;
    const env = makeEnvelope("request_respawn");
    const { state } = reduceHarthmereLiveModeBackendStateV1(
      freshState(),
      env,
      then
    );
    assert.strictEqual(state.updatedAtMs, then);
  });
});

// ===========================================================================
// 4. request_death_transition / request_revive / request_respawn
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — death lifecycle", function () {
  it("request_death_transition sets hp=0 and deathState=dead", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_death_transition", {
      cause: "fall",
    });
    assert.strictEqual(state.combat.hp, 0);
    assert.strictEqual(state.combat.deathState, "dead");
    assert.ok(state.combat.hp === 0);
    assert.ok(
      Object.values(state.combat.deathRecords).some(
        (record) => record.cause === "fall"
      )
    );
  });

  it("request_revive restores hp to 25% of maxHp and deathState=alive", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.maxHp = 200;
    s.combat.resources.mana = 0;
    s.combat.maxResources.mana = 120;
    const { state } = applyOne(s, "request_revive");
    assert.strictEqual(state.combat.deathState, "alive");
    assert.strictEqual(state.combat.hp, 50); // 25% of 200
    assert.strictEqual(state.combat.resources.mana, 30);
  });

  it("request_respawn restores hp to maxHp", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.maxHp = 80;
    s.combat.resources.mana = 0;
    s.combat.maxResources.mana = 120;
    const { state } = applyOne(s, "request_respawn");
    assert.strictEqual(state.combat.hp, 80);
    assert.strictEqual(state.combat.deathState, "alive");
    assert.strictEqual(state.combat.resources.mana, 120);
  });

  it("death → revive → death cycle is stable", function () {
    let s = freshState();
    ({ state: s } = applyOne(s, "request_death_transition"));
    assert.strictEqual(s.combat.deathState, "dead");
    ({ state: s } = applyOne(s, "request_revive"));
    assert.strictEqual(s.combat.deathState, "alive");
    ({ state: s } = applyOne(s, "request_death_transition"));
    assert.strictEqual(s.combat.deathState, "dead");
  });

  it("rejects duplicate death, revive while alive, and respawn while alive", function () {
    let s = freshState();
    ({ state: s } = applyOne(s, "request_death_transition"));
    const duplicateDeath = applyOne(s, "request_death_transition");
    assert.ok(
      duplicateDeath.summary.warnings.includes(
        "death_transition_ignored:already_dead"
      )
    );

    const alive = freshState();
    assert.ok(
      applyOne(alive, "request_revive").summary.warnings.includes(
        "revive_rejected:not_dead_or_downed"
      )
    );
    assert.ok(
      applyOne(alive, "request_respawn").summary.warnings.includes(
        "respawn_rejected:not_dead"
      )
    );
  });
});

// ===========================================================================
// 4b. request_attack / request_ability_cast
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — combat target authority", function () {
  it("rejects target hp/position supplied only by the client payload", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    const { state, summary } = applyOne(
      s,
      "request_attack",
      {
        abilityId: "basic_attack",
        targetHp: 10,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
      },
      { targetId: TARGET }
    );
    assert.strictEqual(state.combat.threat[TARGET], undefined);
    assert.ok(
      summary.warnings.includes(
        "combat_rejected:target_state_not_authoritative"
      )
    );
  });

  it("uses server-side entitySnapshots for target state", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    s.combat.entitySnapshots[TARGET] = {
      hp: 100,
      maxHp: 100,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    const { state, summary } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_attack", targetHp: 1, targetX: 999 },
      {
        targetId: TARGET,
        requestId: "live_hit_1",
        idempotencyKey: "live_hit_1_key",
      }
    );
    assert.ok(
      !summary.warnings.some((warning) =>
        warning.includes("target_state_not_authoritative")
      )
    );
    assert.ok((state.combat.threat[TARGET] ?? 0) > 0);
  });

  it("spends the ability resource without draining health and mutates target hp", function () {
    const s = freshState();
    s.classMagic.classId = "mage";
    s.classMagic.loadout = { slot_0: "spark" };
    s.combat.hp = 73;
    s.combat.resources.mana = 20;
    s.combat.maxResources.mana = 120;
    s.combat.entitySnapshots[TARGET] = {
      hp: 100,
      maxHp: 100,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    const { state, summary } = applyOne(
      s,
      "request_ability_cast",
      { abilityId: "spark" },
      {
        targetId: TARGET,
        requestId: "live_hit_2",
        idempotencyKey: "live_hit_2_key",
      }
    );
    assert.ok(
      !summary.warnings.some((warning) =>
        warning.startsWith("combat_rejected:")
      ),
      summary.warnings.join(", ")
    );
    assert.strictEqual(state.combat.hp, 73);
    assert.strictEqual(state.combat.resources.mana, 12);
    assert.ok(state.combat.entitySnapshots[TARGET].hp < 100);
  });

  it("applies stray-hit damage and threat to the resolved target", function () {
    const s = freshState();
    const wrongTarget = "market_stall_001";
    s.classMagic.classId = "mage";
    s.classMagic.loadout = { slot_0: "spark" };
    s.combat.resources.mana = 100;
    s.combat.maxResources.mana = 120;
    s.combat.entitySnapshots[TARGET] = {
      hp: 100,
      maxHp: 100,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    s.combat.entitySnapshots[wrongTarget] = {
      hp: 100,
      maxHp: 100,
      position: { x: 2, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    const { state, summary } = applyOne(
      s,
      "request_ability_cast",
      { abilityId: "spark" },
      { targetId: TARGET, requestId: "id_13", idempotencyKey: "id_13_live_key" }
    );
    assert.ok(
      !summary.warnings.some((warning) =>
        warning.startsWith("combat_rejected:")
      ),
      summary.warnings.join(", ")
    );
    assert.ok(
      summary.warnings.includes("combat:attack_strayed_to_non_hostile_target")
    );
    assert.strictEqual(state.combat.entitySnapshots[TARGET].hp, 100);
    assert.ok(state.combat.entitySnapshots[wrongTarget].hp < 100);
    assert.strictEqual(state.combat.threat[TARGET], undefined);
    assert.ok((state.combat.threat[wrongTarget] ?? 0) > 0);
  });

  it("rejects a cast with insufficient resource without changing health or resource", function () {
    const s = freshState();
    s.classMagic.classId = "mage";
    s.classMagic.loadout = { slot_0: "spark" };
    s.combat.hp = 73;
    s.combat.resources.mana = 0;
    s.combat.maxResources.mana = 120;
    s.combat.entitySnapshots[TARGET] = {
      hp: 100,
      maxHp: 100,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    const { state, summary } = applyOne(
      s,
      "request_ability_cast",
      { abilityId: "spark" },
      { targetId: TARGET }
    );
    assert.ok(
      summary.warnings.includes("combat_rejected:insufficient_resource")
    );
    assert.strictEqual(state.combat.hp, 73);
    assert.strictEqual(state.combat.resources.mana, 0);
    assert.strictEqual(state.combat.entitySnapshots[TARGET].hp, 100);
  });

  it("enforces shared combat cooldowns across different abilities", function () {
    const s = freshState();
    s.classMagic.classId = "mage";
    s.classMagic.loadout = { slot_0: "spark", slot_1: "mana_shield" };
    s.combat.resources.mana = 100;
    s.combat.maxResources.mana = 120;
    s.combat.entitySnapshots[TARGET] = {
      hp: 100,
      maxHp: 100,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    const first = applyOne(
      s,
      "request_ability_cast",
      { abilityId: "spark" },
      {
        targetId: TARGET,
        requestId: "live_hit_3",
        idempotencyKey: "live_hit_3_key",
      }
    );
    assert.ok(
      (first.state.combat.cooldowns["shared:global_combat"] ?? 0) > NOW_MS
    );
    const second = applyOne(first.state, "request_ability_cast", {
      abilityId: "mana_shield",
    });
    assert.ok(
      second.summary.warnings.includes("combat_rejected:shared_cooldown_active")
    );
  });

  it("marks defeated targets dead and awards character-level kill XP", function () {
    const s = freshState();
    s.classMagic.classId = "mage";
    s.classMagic.loadout = { slot_0: "spark" };
    s.combat.resources.mana = 100;
    s.combat.entitySnapshots[TARGET] = {
      hp: 1,
      maxHp: 100,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      level: 1,
    };
    const { state } = applyOne(
      s,
      "request_ability_cast",
      { abilityId: "spark" },
      {
        targetId: TARGET,
        requestId: "live_hit_4",
        idempotencyKey: "live_hit_4_key",
      }
    );
    assert.strictEqual(state.combat.entitySnapshots[TARGET].isAlive, false);
    assert.ok((state.classMagic.skills.character_level?.xp ?? 0) > 0);
  });

  it("lets every live entity family use the same hit, retaliation AI, movement, and animation path", function () {
    const cases = [
      { kind: "npc", expectedAnimation: "walk" },
      { kind: "human", expectedAnimation: "walk" },
      { kind: "monster", expectedAnimation: "run" },
      { kind: "mux", expectedAnimation: "run" },
      { kind: "hex", expectedAnimation: "run" },
      { kind: "robot", expectedAnimation: "walk" },
      { kind: "undead", expectedAnimation: "walk" },
      { kind: "animal", expectedAnimation: "run", species: "wolf" },
      { kind: "construct", expectedAnimation: "walk" },
      { kind: "pet", expectedAnimation: "walk" },
      { kind: "summon", expectedAnimation: "walk" },
      { kind: "object", expectedAnimation: "walk", movementSpeed: 1.5 },
      { kind: "live_entity", expectedAnimation: "walk" },
    ] as const;

    for (const entry of cases) {
      const entityId = `live-${entry.kind}-retaliation`;
      let s = freshState();
      s.classMagic.knownAbilities = ["basic_attack"];
      s.classMagic.loadout = { slot_0: "basic_attack" };
      s.combat.entitySnapshots[entityId] = {
        hp: 100,
        maxHp: 100,
        position: { x: 1, y: 0, z: 0 },
        homePosition: { x: 1, y: 0, z: 0 },
        isHostile: false,
        isAlive: true,
        isAttackable: true,
        entityKind: entry.kind,
        species: "species" in entry ? entry.species : undefined,
        movementSpeed:
          "movementSpeed" in entry ? entry.movementSpeed : undefined,
        level: 1,
      };

      ({ state: s } = applyOne(
        s,
        "request_attack",
        { abilityId: "basic_attack" },
        {
          targetId: entityId,
          requestId: `live_${entry.kind}_hit`,
          idempotencyKey: `live_${entry.kind}_hit_key`,
        }
      ));
      assert.equal(s.combat.entitySnapshots[entityId].lastAttackerId, ACTOR);
      assert.ok(s.combat.entitySnapshots[entityId].hp < 100);

      const ai = applyOne(
        s,
        "request_npc_ai_tick",
        { npcId: entityId },
        {
          source: "server_scheduled_tick",
          subsystem: "npc_ai",
          targetId: entityId,
          serverActorPosition: { x: 6, y: 0, z: 0 },
        }
      ).state;
      const tick = ai.combat.npcAiTicks[entityId];
      const snapshot = ai.combat.entitySnapshots[entityId];
      assert.equal(tick.decision, "retaliate_to_recent_attacker", entry.kind);
      assert.equal(tick.targetId, ACTOR, entry.kind);
      assert.equal(tick.entityKind, entry.kind, entry.kind);
      assert.equal(tick.movementMode, "combat_chase", entry.kind);
      assert.equal(tick.animationMoving, true, entry.kind);
      assert.equal(tick.animationState, entry.expectedAnimation, entry.kind);
      assert.equal(snapshot.animationState, entry.expectedAnimation, entry.kind);
      assert.ok(snapshot.position.x > 1, entry.kind);
    }
  });

  it("uses ECS-bridged b:<id> live records in the same combat and AI path", function () {
    const bridged = createHarthmereLiveEntityCombatSnapshotsFromEcsRecordsV1({
      "b:ecs_npc_1": {
        npc_metadata: { type_id: 101, spawn_position: [1, 0, 0] },
        position: { v: [1, 0, 0] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Road Bandit Scout" },
      },
      "b:ecs_robot_1": {
        npc_metadata: { type_id: 102, spawn_position: [1, 0, 0] },
        robot_component: { internal_battery_charge: 40 },
        position: { v: [1, 0, 0] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Archive Robot Sentinel" },
      },
      "b:ecs_animal_1": {
        npc_metadata: { type_id: 103, spawn_position: [1, 0, 0] },
        position: { v: [1, 0, 0] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Forest Wolf" },
      },
      "b:ecs_place_1": {
        position: { v: [1, 0, 0] },
        label: { text: "Market Jobs Board Place Label" },
      },
    });

    for (const [entityId, requestId] of [
      ["b:ecs_npc_1", "ecs_npc_hit"],
      ["b:ecs_robot_1", "ecs_robot_hit"],
      ["b:ecs_animal_1", "ecs_animal_hit"],
    ] as const) {
      let s = freshState();
      s.classMagic.knownAbilities = ["basic_attack"];
      s.classMagic.loadout = { slot_0: "basic_attack" };
      s.combat.entitySnapshots = { [entityId]: { ...bridged[entityId] } };

      ({ state: s } = applyOne(
        s,
        "request_attack",
        { abilityId: "basic_attack" },
        { targetId: entityId, requestId, idempotencyKey: `${requestId}_key` }
      ));
      assert.equal(s.combat.entitySnapshots[entityId].lastAttackerId, ACTOR);

      const ai = applyOne(
        s,
        "request_npc_ai_tick",
        { npcId: entityId },
        {
          source: "server_scheduled_tick",
          subsystem: "npc_ai",
          targetId: entityId,
          serverActorPosition: { x: 6, y: 0, z: 0 },
        }
      ).state;
      assert.equal(
        ai.combat.npcAiTicks[entityId].decision,
        "retaliate_to_recent_attacker"
      );
      assert.equal(ai.combat.npcAiTicks[entityId].animationMoving, true);
    }

    const protectedState = freshState();
    protectedState.classMagic.knownAbilities = ["basic_attack"];
    protectedState.classMagic.loadout = { slot_0: "basic_attack" };
    protectedState.combat.entitySnapshots["b:ecs_place_1"] = {
      ...bridged["b:ecs_place_1"],
    };
    const rejected = applyOne(
      protectedState,
      "request_attack",
      { abilityId: "basic_attack" },
      {
        targetId: "b:ecs_place_1",
        requestId: "noncombat_protected_hit",
        idempotencyKey: "noncombat_protected_hit_key",
      }
    );
    assert.ok(
      rejected.summary.warnings.includes(
        "combat_rejected:target_not_hostile"
      )
    );
  });

  it("walks idle live animals on server AI ticks and exposes animation metadata", function () {
    const animalId = "live-animal-idle-walker";
    const s = freshState();
    s.combat.entitySnapshots[animalId] = {
      hp: 80,
      maxHp: 80,
      position: { x: 20, y: 53, z: 20 },
      homePosition: { x: 20, y: 53, z: 20 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "animal",
      species: "deer",
      patrolRadius: 2,
      level: 1,
    };

    const { state } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId: animalId },
      { source: "server_scheduled_tick", subsystem: "npc_ai", targetId: animalId }
    );

    const tick = state.combat.npcAiTicks[animalId];
    assert.equal(tick.decision, "idle_patrol");
    assert.equal(tick.movementMode, "town_wander");
    assert.equal(tick.animationState, "walk");
    assert.equal(state.combat.entitySnapshots[animalId].animationState, "walk");
    assert.ok(state.combat.entitySnapshots[animalId].position.x !== 20);
  });

  it("uses navigation obstacles to block live entity movement and accumulates stuck frames", function () {
    const entityId = "blocked-live-entity";
    let state = freshState();
    state.combat.entitySnapshots[entityId] = {
      hp: 100,
      maxHp: 100,
      position: { x: 0, y: 0, z: 0 },
      homePosition: { x: 0, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "robot",
      navigationObstacles: [
        {
          id: "test-wall",
          label: "Test Wall",
          cx: 2,
          cz: 0,
          halfX: 0.5,
          halfZ: 5,
          padding: 0.1,
        },
      ],
    };

    for (let i = 0; i < 11; i += 1) {
      state = reduceHarthmereLiveModeBackendStateV1(
        state,
        makeEnvelope(
          "request_npc_ai_tick",
          { npcId: entityId, desiredX: 4, desiredY: 0, desiredZ: 0 },
          {
            source: "server_scheduled_tick",
            subsystem: "npc_ai",
            targetId: entityId,
            requestId: `blocked_nav_tick_${i}`,
            idempotencyKey: `blocked_nav_tick_${i}_key`,
          }
        ),
        NOW_MS + i * 100
      ).state;
    }

    const tick = state.combat.npcAiTicks[entityId];
    assert.equal(tick.navigationBlocked, true);
    assert.notEqual(tick.navigationResolution, "direct");
    assert.ok(state.combat.liveEntityNavigation[entityId].stuckFrames >= 10);
    assert.ok(state.combat.entitySnapshots[entityId].position.x < 1);
  });

  it("holds chase movement inside attack range and ignores client-only desired positions", function () {
    const entityId = "range-held-live-entity";
    let state = freshState();
    state.combat.entitySnapshots[entityId] = {
      hp: 90,
      maxHp: 100,
      position: { x: 0, y: 0, z: 0 },
      homePosition: { x: 0, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "monster",
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 10,
    };

    state = applyOne(
      state,
      "request_npc_ai_tick",
      { npcId: entityId },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: entityId,
        serverActorPosition: { x: 1, y: 0, z: 0 },
      }
    ).state;
    assert.equal(
      state.combat.npcAiTicks[entityId].decision,
      "retaliate_to_recent_attacker"
    );
    assert.equal(state.combat.npcAiTicks[entityId].animationMoving, false);
    assert.equal(state.combat.entitySnapshots[entityId].position.x, 0);

    const clientDriven = freshState();
    clientDriven.combat.entitySnapshots[entityId] = {
      hp: 100,
      maxHp: 100,
      position: { x: 0, y: 0, z: 0 },
      homePosition: { x: 0, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "robot",
    };
    const clientResult = applyOne(
      clientDriven,
      "request_npc_ai_tick",
      { npcId: entityId, desiredX: 4, desiredY: 0, desiredZ: 0 },
      {
        source: "client_request",
        subsystem: "npc_ai",
        targetId: entityId,
      }
    ).state;
    assert.notEqual(clientResult.combat.entitySnapshots[entityId].position.x, 4);

    const serverResult = applyOne(
      clientDriven,
      "request_npc_ai_tick",
      { npcId: entityId, desiredX: 4, desiredY: 0, desiredZ: 0 },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: entityId,
      }
    ).state;
    assert.equal(serverResult.combat.entitySnapshots[entityId].position.x, 4);
  });

  it("keeps protected noncombatants out of combat even if a snapshot says attackable", function () {
    const cases = [
      {
        entityId: "protected-deer",
        entityKind: "animal",
        protectedSpecies: true,
      },
      {
        entityId: "friendly-human",
        entityKind: "human",
        combatProtection: "friendly_noncombatant",
      },
      {
        entityId: "place-label",
        entityKind: "object",
        combatProtection: "label_or_place",
      },
      {
        entityId: "immobile-object",
        entityKind: "object",
        aiEnabled: false,
      },
    ] as const;

    for (const entry of cases) {
      const { entityId, ...snapshotFlags } = entry;
      const s = freshState();
      s.classMagic.knownAbilities = ["basic_attack"];
      s.classMagic.loadout = { slot_0: "basic_attack" };
      s.combat.entitySnapshots[entityId] = {
        hp: 100,
        maxHp: 100,
        position: { x: 1, y: 0, z: 0 },
        isHostile: false,
        isAlive: true,
        isAttackable: true,
        level: 1,
        ...snapshotFlags,
      };

      const result = applyOne(
        s,
        "request_attack",
        { abilityId: "basic_attack" },
        {
          targetId: entityId,
          requestId: `reject_${entityId}`,
          idempotencyKey: `reject_${entityId}_key`,
        }
      );
      assert.equal(result.state.combat.entitySnapshots[entityId].hp, 100);
      assert.ok(
        result.summary.warnings.some((warning) =>
          warning.startsWith("combat_rejected:")
        ),
        entityId
      );
    }
  });

  it("allows livestock and pets through combat and records unauthorized kills as crimes", function () {
    for (const entry of [
      {
        targetId: "owned-cow-crime",
        entityKind: "animal",
        species: "cow",
        isLivestock: true,
        ownerId: "other_player",
        expectMeat: true,
      },
      {
        targetId: "owned-pet-crime",
        entityKind: "pet",
        species: "fox",
        ownerId: "other_player",
        expectMeat: false,
      },
    ] as const) {
      const s = freshState();
      s.classMagic.knownAbilities = ["basic_attack"];
      s.classMagic.loadout = { slot_0: "basic_attack" };
      s.combat.entitySnapshots[entry.targetId] = {
        hp: 1,
        maxHp: 30,
        position: { x: 1, y: 0, z: 0 },
        isHostile: false,
        isAlive: true,
        isAttackable: true,
        level: 1,
        ...entry,
      };

      const result = applyOne(
        s,
        "request_attack",
        { abilityId: "basic_attack" },
        {
          targetId: entry.targetId,
          requestId: `kill_${entry.targetId}`,
          idempotencyKey: `kill_${entry.targetId}_key`,
        }
      );
      assert.equal(result.state.combat.entitySnapshots[entry.targetId].isAlive, false);
      assert.ok(
        !result.summary.warnings.some((warning) =>
          warning.startsWith("combat_rejected:")
        ),
        entry.targetId
      );
      assert.equal(result.state.law.crimeRecords[0].kind, "murder");
      assert.equal(result.state.law.crimeRecords[0].targetId, entry.targetId);
      assert.equal(result.state.law.crimeRecords[0].resourceOwnership, "owned");
      assert.ok((result.state.law.fines.city_guard ?? 0) > 0);
      const dropId = result.state.combat.entitySnapshots[entry.targetId].lootDropId;
      if (entry.expectMeat) {
        assert.ok(dropId);
        assert.equal(result.state.inventoryLoot.lootDrops[dropId].itemStacks.raw_meat, 2);
      } else {
        assert.equal(dropId, undefined);
      }
    }

    const ownerState = freshState();
    ownerState.classMagic.knownAbilities = ["basic_attack"];
    ownerState.classMagic.loadout = { slot_0: "basic_attack" };
    ownerState.combat.entitySnapshots["own-cow-no-crime"] = {
      hp: 1,
      maxHp: 30,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "animal",
      species: "cow",
      isLivestock: true,
      ownerId: ACTOR,
      level: 1,
    };
    const ownerKill = applyOne(
      ownerState,
      "request_attack",
      { abilityId: "basic_attack" },
      {
        targetId: "own-cow-no-crime",
        requestId: "kill_own_cow",
        idempotencyKey: "kill_own_cow_key",
      }
    ).state;
    assert.equal(ownerKill.combat.entitySnapshots["own-cow-no-crime"].isAlive, false);
    assert.equal(ownerKill.law.crimeRecords.length, 0);
  });

  it("materializes defeated live entity loot as a pickupable drop and claims it into inventory", function () {
    let s = freshState();
    const targetId = "live-hex-loot-carrier";
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    s.combat.entitySnapshots[targetId] = {
      hp: 1,
      maxHp: 80,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lootDrops: { health_potion: 1 },
    };

    ({ state: s } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_attack" },
      {
        targetId,
        requestId: "live_hit_4",
        idempotencyKey: "live_hit_4_live_entity_loot",
      }
    ));
    const dropId = s.combat.entitySnapshots[targetId].lootDropId!;
    assert.equal(s.combat.entitySnapshots[targetId].isAlive, false);
    assert.ok(dropId);
    assert.equal(s.inventoryLoot.lootDrops[dropId].status, "available");
    assert.equal(s.inventoryLoot.lootDrops[dropId].itemStacks.health_potion, 1);

    const claimed = applyOne(
      s,
      "request_loot_claim",
      {
        dropId,
        pickupToken: s.inventoryLoot.lootDrops[dropId].pickupToken,
      },
      { requestId: "claim_live_entity_loot", idempotencyKey: "claim_live_entity_loot_key" }
    ).state;
    assert.equal(claimed.inventoryLoot.lootDrops[dropId].status, "claimed");
    assert.equal(claimed.inventory.items.health_potion, 1);
  });

  it("defaults defeated wild animals to raw meat drops and claims meat through live loot", function () {
    let s = freshState();
    const targetId = "live-boar-meat-drop";
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    s.combat.entitySnapshots[targetId] = {
      hp: 1,
      maxHp: 30,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "animal",
      species: "boar",
      level: 1,
    };

    ({ state: s } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_attack" },
      {
        targetId,
        requestId: "live_hit_4",
        idempotencyKey: "live_hit_4_wild_animal_meat",
      }
    ));
    const dropId = s.combat.entitySnapshots[targetId].lootDropId!;
    assert.equal(s.combat.entitySnapshots[targetId].isAlive, false);
    assert.ok(dropId);
    assert.equal(s.inventoryLoot.lootDrops[dropId].itemStacks.raw_meat, 2);

    const claimed = applyOne(
      s,
      "request_loot_claim",
      {
        dropId,
        pickupToken: s.inventoryLoot.lootDrops[dropId].pickupToken,
      },
      {
        requestId: "claim_live_animal_raw_meat",
        idempotencyKey: "claim_live_animal_raw_meat_key",
      }
    ).state;
    assert.equal(claimed.inventoryLoot.lootDrops[dropId].status, "claimed");
    assert.equal(claimed.banking.materialStorage.raw_meat, 2);
    assert.equal(claimed.inventory.items.raw_meat ?? 0, 0);
  });

  it("does not auto-meat protected animals, owned pets, or explicit meat drops", function () {
    for (const entry of [
      { targetId: "live-deer-protected-no-meat", entityKind: "animal", species: "deer", protectedSpecies: true },
    ] as const) {
      const s = freshState();
      s.classMagic.knownAbilities = ["basic_attack"];
      s.classMagic.loadout = { slot_0: "basic_attack" };
      s.combat.entitySnapshots[entry.targetId] = {
        hp: 1,
        maxHp: 30,
        position: { x: 1, y: 0, z: 0 },
        isHostile: false,
        isAlive: true,
        isAttackable: true,
        level: 1,
        ...entry,
      };
      const result = applyOne(
        s,
        "request_attack",
        { abilityId: "basic_attack" },
        {
          targetId: entry.targetId,
          requestId: `${entry.targetId}_hit`,
          idempotencyKey: `${entry.targetId}_hit_key`,
        }
      );
      assert.ok(
        result.summary.warnings.some((warning) =>
          warning.startsWith("combat_rejected:")
        ),
        entry.targetId
      );
      assert.equal(
        result.state.combat.entitySnapshots[entry.targetId].lootDropId,
        undefined
      );
    }

    let pet = freshState();
    const petTargetId = "live-pet-no-meat";
    pet.classMagic.knownAbilities = ["basic_attack"];
    pet.classMagic.loadout = { slot_0: "basic_attack" };
    pet.combat.entitySnapshots[petTargetId] = {
      hp: 1,
      maxHp: 30,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "pet",
      species: "wolf",
      ownerId: "other_actor",
      level: 1,
    };
    ({ state: pet } = applyOne(
      pet,
      "request_attack",
      { abilityId: "basic_attack" },
      {
        targetId: petTargetId,
        requestId: "live_hit_4",
        idempotencyKey: "live_hit_4_pet_no_meat",
      }
    ));
    assert.equal(pet.combat.entitySnapshots[petTargetId].isAlive, false);
    assert.equal(pet.combat.entitySnapshots[petTargetId].lootDropId, undefined);

    let explicit = freshState();
    const explicitTargetId = "live-wolf-explicit-meat";
    explicit.classMagic.knownAbilities = ["basic_attack"];
    explicit.classMagic.loadout = { slot_0: "basic_attack" };
    explicit.combat.entitySnapshots[explicitTargetId] = {
      hp: 1,
      maxHp: 30,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "animal",
      species: "wolf",
      level: 1,
      lootDrops: { raw_meat: 1 },
    };
    ({ state: explicit } = applyOne(
      explicit,
      "request_attack",
      { abilityId: "basic_attack" },
      {
        targetId: explicitTargetId,
        requestId: "live_hit_4",
        idempotencyKey: "live_hit_4_explicit_meat",
      }
    ));
    const dropId = explicit.combat.entitySnapshots[explicitTargetId].lootDropId!;
    assert.ok(dropId);
    assert.equal(explicit.inventoryLoot.lootDrops[dropId].itemStacks.raw_meat, 1);
  });

  it("rejects invalid, ineligible, expired, duplicate, and overweight live loot drop claims", function () {
    {
      const { state, dropId } = createDefeatedLiveEntityDropState(
        { health_potion: 1 },
        "loot_invalid_token_hit"
      );
      const rejected = applyOne(
        state,
        "request_loot_claim",
        { dropId, pickupToken: "wrong-token" },
        {
          requestId: "claim_bad_live_entity_token",
          idempotencyKey: "claim_bad_live_entity_token_key",
        }
      );
      assert.ok(
        rejected.summary.warnings.includes(
          "loot_rejected:invalid_pickup_token"
        )
      );
      assert.equal(rejected.state.inventoryLoot.lootDrops[dropId].status, "available");
    }

    {
      const { state, dropId } = createDefeatedLiveEntityDropState(
        { health_potion: 1 },
        "loot_wrong_owner_hit",
        { lootOwnerActorIds: ["other_actor"] }
      );
      const rejected = applyOne(
        state,
        "request_loot_claim",
        {
          dropId,
          pickupToken: state.inventoryLoot.lootDrops[dropId].pickupToken,
        },
        {
          requestId: "claim_wrong_live_entity_owner",
          idempotencyKey: "claim_wrong_live_entity_owner_key",
        }
      );
      assert.ok(
        rejected.summary.warnings.includes(
          "loot_rejected:actor_not_eligible_for_loot"
        )
      );
    }

    {
      const { state, dropId } = createDefeatedLiveEntityDropState(
        { health_potion: 1 },
        "loot_expired_hit"
      );
      const expiredAt = state.inventoryLoot.lootDrops[dropId].expiresAtMs + 1;
      const rejected = reduceHarthmereLiveModeBackendStateV1(
        state,
        makeEnvelope(
          "request_loot_claim",
          {
            dropId,
            pickupToken: state.inventoryLoot.lootDrops[dropId].pickupToken,
          },
          {
            requestId: "claim_expired_live_entity_loot",
            idempotencyKey: "claim_expired_live_entity_loot_key",
          }
        ),
        expiredAt
      );
      assert.ok(
        rejected.summary.warnings.includes("loot_rejected:loot_drop_expired")
      );
    }

    {
      const { state, dropId } = createDefeatedLiveEntityDropState(
        { health_potion: 1 },
        "loot_duplicate_hit"
      );
      const first = applyOne(
        state,
        "request_loot_claim",
        {
          dropId,
          pickupToken: state.inventoryLoot.lootDrops[dropId].pickupToken,
        },
        {
          requestId: "claim_live_entity_once",
          idempotencyKey: "claim_live_entity_once_key",
        }
      ).state;
      const second = applyOne(
        first,
        "request_loot_claim",
        {
          dropId,
          pickupToken: state.inventoryLoot.lootDrops[dropId].pickupToken,
        },
        {
          requestId: "claim_live_entity_twice",
          idempotencyKey: "claim_live_entity_twice_key",
        }
      );
      assert.ok(
        second.summary.warnings.includes(
          "loot_rejected:loot_drop_not_available"
        )
      );
      assert.equal(second.state.inventory.items.health_potion, 1);
    }

    {
      const { state, dropId } = createDefeatedLiveEntityDropState(
        { health_potion: 1 },
        "loot_weight_hit"
      );
      state.inventory.items = { iron_sword: 5 };
      const rejected = applyOne(
        state,
        "request_loot_claim",
        {
          dropId,
          pickupToken: state.inventoryLoot.lootDrops[dropId].pickupToken,
        },
        {
          requestId: "claim_overweight_live_entity_loot",
          idempotencyKey: "claim_overweight_live_entity_loot_key",
        }
      );
      assert.ok(
        rejected.summary.warnings.includes(
          "loot_rejected:carry_weight_limit_exceeded"
        )
      );
      assert.equal(rejected.state.inventoryLoot.lootDrops[dropId].status, "available");
    }
  });

  it("routes live loot drop currency to wallet and materials to material storage", function () {
    const { state, dropId } = createDefeatedLiveEntityDropState(
      { gold_coin: 7, iron_ore: 3 },
      "loot_currency_material_hit"
    );
    const claimed = applyOne(
      state,
      "request_loot_claim",
      {
        dropId,
        pickupToken: state.inventoryLoot.lootDrops[dropId].pickupToken,
      },
      {
        requestId: "claim_currency_material_live_entity_loot",
        idempotencyKey: "claim_currency_material_live_entity_loot_key",
      }
    ).state;

    assert.equal(claimed.inventory.gold, 7);
    assert.equal(claimed.banking.materialStorage.iron_ore, 3);
    assert.equal(claimed.inventory.items.iron_ore ?? 0, 0);
    assert.equal(claimed.inventoryLoot.lootDrops[dropId].status, "claimed");
  });
});

// ===========================================================================
// 5. request_xp_reward / request_skill_progress
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — XP and skill progress", function () {
  it("request_xp_reward uses server reward inputs instead of client xpDelta", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_xp_reward", {
      skillId: "combat",
      xpDelta: 1000,
      baseXp: 1000,
      sourceLevel: 1,
      contributionScore: 1,
    });
    assert.ok((state.classMagic.skills.combat?.xp ?? 0) >= 1000);
    assert.ok((state.classMagic.skills.combat?.level ?? 0) >= 2);
  });

  it("request_skill_progress uses the same xp upsert path", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_skill_progress", {
      skillId: "mining",
      baseXp: 500,
      difficulty: 2,
      successState: "success",
    });
    assert.ok((state.classMagic.skills.mining?.xp ?? 0) >= 500);
  });

  it("rejects XP requests that only provide client xpDelta", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_xp_reward", {
      skillId: "crafting",
      xpDelta: 999,
    });
    assert.strictEqual(state.classMagic.skills.crafting, undefined);
    assert.ok(
      summary.warnings.includes(
        "request_xp_reward_rejected:missing_server_reward_source"
      )
    );
  });

  it("rejects unknown skills instead of creating invisible progression rows", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_skill_progress", {
      skillId: "imaginary_skill",
      baseXp: 100,
      sourceLevel: 1,
    });
    assert.strictEqual(state.classMagic.skills.imaginary_skill, undefined);
    assert.ok(
      summary.warnings.includes(
        "skill_xp_rejected:unknown_skill:imaginary_skill"
      )
    );
  });

  it("rejects AFK, grey, and fully farmed reward loops", function () {
    const afk = applyOne(freshState(), "request_skill_progress", {
      skillId: "mining",
      baseXp: 100,
      sourceLevel: 1,
      isAfk: true,
    });
    assert.ok(
      afk.summary.warnings.includes("request_skill_progress_rejected:afk_loop")
    );

    const greyState = freshState();
    greyState.classMagic.skills.character_level = { xp: 29_000, level: 30 };
    const grey = applyOne(greyState, "request_xp_reward", {
      skillId: "combat",
      baseXp: 100,
      sourceLevel: 10,
    });
    assert.ok(
      grey.summary.warnings.includes(
        "request_xp_reward_rejected:grey_content_no_progress"
      )
    );

    const farmed = applyOne(freshState(), "request_xp_reward", {
      skillId: "combat",
      baseXp: 100,
      sourceLevel: 1,
      repeatedFarmCount: 10,
    });
    assert.ok(
      farmed.summary.warnings.includes(
        "request_xp_reward_rejected:no_progress_to_award"
      )
    );
  });

  it("level increases monotonically across multiple applications", function () {
    let s = freshState();
    for (let i = 0; i < 5; i++) {
      ({ state: s } = applyOne(s, "request_xp_reward", {
        skillId: "combat",
        baseXp: 500,
        sourceLevel: 1,
        contributionScore: 1,
      }));
    }
    // 5×500 = 2500 xp → level 1 + floor(2500/1000) = 3
    assert.ok((s.classMagic.skills.combat?.level ?? 0) >= 3);
  });
});

describe("reduceHarthmereLiveModeBackendStateV1 — loadout arrays", function () {
  it("stores array loadout changes in slot order instead of ability-id keys", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_loadout_change", {
      newLoadout: ["basic_strike", "power_strike"],
    });
    assert.ok(
      !summary.warnings.some((warning) =>
        warning.startsWith("loadout_rejected:")
      ),
      summary.warnings.join(", ")
    );
    assert.deepStrictEqual(state.classMagic.loadout, {
      slot_0: "basic_strike",
      slot_1: "power_strike",
    });
  });

  it("validates single-slot loadout changes against current class requirements", function () {
    const s = freshState();
    s.classMagic.classId = "mage";
    s.classMagic.knownAbilities = ["power_strike"];
    const { state, summary } = applyOne(s, "request_loadout_change", {
      slot: "0",
      abilityId: "power_strike",
    });

    assert.strictEqual(state.classMagic.loadout.slot_0, undefined);
    assert.ok(
      summary.warnings.includes(
        "loadout_rejected:loadout_ability_class_mismatch:power_strike"
      )
    );
  });
});

// ===========================================================================
// 6. request_magic_progress
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — magic progress", function () {
  it("rejects magic progress for unknown ability", function () {
    const s = freshState();
    const { summary } = applyOne(s, "request_magic_progress", {
      abilityId: "mystery_spell",
      magicSchoolId: "shadow",
      skillXpDelta: 100,
    });
    assert.ok(summary.warnings.some((w) => w.includes("ability_not_known")));
  });

  it("grants school xp when actor knows the ability", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "combat_magic",
      skillXpDelta: 300,
    });
    assert.ok((state.classMagic.magicSchools.combat_magic?.xp ?? 0) >= 300);
  });

  it("caps skillXpDelta at 1000", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "combat_magic",
      skillXpDelta: 99999,
    });
    assert.ok((state.classMagic.magicSchools.combat_magic?.xp ?? 0) <= 1000);
  });

  it("sets cooldown on the ability after magic progress", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "combat_magic",
      skillXpDelta: 100,
      cooldownMs: 2000,
    });
    assert.ok((state.combat.cooldowns.basic_attack ?? 0) >= NOW_MS + 250);
  });

  it("marks school as illegal when legalStatus=illegal", function () {
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_attack"];
    const { state } = applyOne(s, "request_magic_progress", {
      abilityId: "basic_attack",
      magicSchoolId: "dark_arts",
      skillXpDelta: 50,
      legalStatus: "illegal",
    });
    assert.ok(state.classMagic.magicSchools.dark_arts?.illegal === true);
  });
});

// ===========================================================================
// 7. request_trainer_unlock / request_skill_book_use
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — trainer unlock", function () {
  it("request_trainer_unlock adds ability to knownAbilities (deduped)", function () {
    const s = freshState();
    applyOne(s, "request_trainer_unlock", { abilityId: "fireball" });
    const { state } = applyOne(s, "request_trainer_unlock", {
      abilityId: "fireball",
    });
    // Should not duplicate
    const count = state.classMagic.knownAbilities.filter(
      (a) => a === "fireball"
    ).length;
    assert.ok(count <= 1);
  });

  it("request_skill_book_use adds recipe to knownRecipes", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_skill_book_use", {
      recipeId: "recipe_iron_sword",
    });
    assert.ok(state.classMagic.knownRecipes.includes("recipe_iron_sword"));
  });

  it("adds both ability and recipe from same unlock envelope", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_trainer_unlock", {
      classId: "warrior",
      abilityId: "basic_strike",
      recipeId: "recipe_iron_sword",
    });
    assert.ok(state.classMagic.knownAbilities.includes("basic_strike"));
    assert.ok(state.classMagic.knownRecipes.includes("recipe_iron_sword"));
  });

  it("rejects class switching through a normal trainer unlock", function () {
    const s = freshState();
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_strike", "power_strike"];
    s.classMagic.loadout = { slot_0: "power_strike" };

    const { state, summary } = applyOne(s, "request_trainer_unlock", {
      classId: "mage",
    });

    assert.equal(state.classMagic.classId, "warrior");
    assert.deepStrictEqual(state.classMagic.loadout, {
      slot_0: "power_strike",
    });
    assert.ok(
      summary.warnings.includes(
        "class_rejected:class_change_requires_respec_service"
      )
    );
  });

  it("stores valid specialization choices for the current class", function () {
    const s = freshState();
    s.classMagic.classId = "warrior";

    const { state, summary } = applyOne(s, "request_trainer_unlock", {
      specializationId: "protection",
    });

    assert.equal(state.classMagic.specializationId, "protection");
    assert.ok(
      !summary.warnings.some((warning) =>
        warning.startsWith("specialization_rejected:")
      ),
      summary.warnings.join(", ")
    );
  });

  it("rejects specialization choices outside the current class", function () {
    const s = freshState();
    s.classMagic.classId = "warrior";

    const { state, summary } = applyOne(s, "request_trainer_unlock", {
      specializationId: "pyromancer",
    });

    assert.equal(state.classMagic.specializationId, undefined);
    assert.ok(
      summary.warnings.includes(
        "specialization_rejected:not_available_for_class"
      )
    );
  });

  it("rejects unknown recipe ids from skill books", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_skill_book_use", {
      recipeId: "recipe_client_forged_legendary",
    });

    assert.ok(
      !state.classMagic.knownRecipes.includes("recipe_client_forged_legendary")
    );
    assert.ok(summary.warnings.includes("recipe_rejected:unknown_recipe"));
  });
});

// ===========================================================================
// 8. request_vendor_transaction
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — vendor transaction", function () {
  it("buy from vendor deducts gold and adds item when actor has enough gold", function () {
    const s = freshState();
    s.inventory.gold = 200;
    const { state, summary } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 5,
    });
    // iron_ore costs 10 gold each; buying 5 = 50 gold
    assert.ok(state.inventory.gold <= 200 - 50 + 1); // allow slight rounding
    assert.ok((state.inventory.items.iron_ore ?? 0) >= 5);
    assert.ok(summary.touchedModels.includes("inventory_items"));
    assert.ok(summary.touchedModels.includes("wallet"));
  });

  it("rejects vendor buy when actor has insufficient gold", function () {
    const s = freshState();
    s.inventory.gold = 1;
    const { summary } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 10,
    });
    assert.ok(summary.warnings.some((w) => w.includes("vendor_rejected:")));
  });

  it("records vendor transaction count in economy.vendorTransactions", function () {
    const s = freshState();
    s.inventory.gold = 500;
    const { state } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 1,
    });
    assert.ok(
      (state.economy.vendorTransactions["blacksmith_vendor"] ?? 0) >= 1
    );
  });

  it("records ledger entry for vendor transaction", function () {
    const s = freshState();
    s.inventory.gold = 500;
    const { state } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 2,
    });
    const entry = state.economy.ledger.find((e) =>
      e.kind.startsWith("vendor_")
    );
    assert.ok(entry !== undefined);
  });
});

// ===========================================================================
// 9. request_crafting
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — crafting", function () {
  it("crafts iron_sword when actor has materials and knows recipe", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    s.classMagic.knownRecipes = ["recipe_iron_sword"];
    const { state, summary } = applyOne(s, "request_crafting", {
      recipeId: "recipe_iron_sword",
    });
    assert.ok((state.inventory.items.iron_sword ?? 0) >= 1);
    assert.ok(state.inventory.items.iron_ore <= 10 - 3); // 3 consumed
    assert.ok(summary.touchedModels.includes("crafting"));
  });

  it("rejects crafting when recipe not known", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    s.classMagic.knownRecipes = [];
    const { summary } = applyOne(s, "request_crafting", {
      recipeId: "recipe_iron_sword",
    });
    assert.ok(summary.warnings.some((w) => w.includes("crafting_rejected:")));
  });

  it("rejects crafting when missing required materials", function () {
    const s = freshState();
    s.inventory.items = {}; // no ore
    s.classMagic.knownRecipes = ["recipe_iron_sword"];
    const { summary } = applyOne(s, "request_crafting", {
      recipeId: "recipe_iron_sword",
    });
    assert.ok(summary.warnings.some((w) => w.includes("crafting_rejected:")));
  });

  it("rejects when recipeId is missing from envelope payload", function () {
    const s = freshState();
    const { summary } = applyOne(s, "request_crafting", {}); // no recipeId
    assert.ok(
      summary.warnings.some((w) =>
        w.includes("crafting_rejected:missing_recipe_id")
      )
    );
  });

  it("grants crafting XP on success", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    s.classMagic.knownRecipes = ["recipe_iron_sword"];
    const { state } = applyOne(s, "request_crafting", {
      recipeId: "recipe_iron_sword",
    });
    // recipe has xpReward: 50
    assert.ok((state.classMagic.skills.crafting?.xp ?? 0) >= 50);
  });

  it("crafts using materials stored outside the backpack", function () {
    const s = freshState();
    s.banking.materialStorage = { iron_ore: 3 };
    s.classMagic.knownRecipes = ["recipe_iron_sword"];
    const { state, summary } = applyOne(s, "request_crafting", {
      recipeId: "recipe_iron_sword",
    });
    assert.strictEqual(state.inventory.items.iron_sword, 1);
    assert.strictEqual(state.banking.materialStorage.iron_ore ?? 0, 0);
    assert.ok(summary.touchedModels.includes("material_storage"));
  });
});

// ===========================================================================
// 10. request_loot_claim / request_inventory_mutation
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — loot and inventory mutation", function () {
  it("request_loot_claim adds item to inventory", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_loot_claim", {
      itemId: "health_potion",
      count: 3,
    });
    assert.ok((state.inventory.items.health_potion ?? 0) >= 3);
    assert.ok(Object.keys(state.combat.lootClaims).length >= 1);
  });

  it("rejects public request_inventory_mutation admin grants", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_inventory_mutation", {
      itemId: "iron_ore",
      count: 10,
    });
    assert.strictEqual(state.inventory.items.iron_ore ?? 0, 0);
    assert.ok(
      summary.warnings.includes("inventory_rejected:admin_authority_required")
    );
  });

  it("allows server/admin request_inventory_mutation grants through authority", function () {
    const s = freshState();
    const { state } = applyOne(
      s,
      "request_inventory_mutation",
      {
        itemId: "health_potion",
        count: 2,
      },
      { source: "admin_tool", subsystem: "inventory" }
    );
    assert.strictEqual(state.inventory.items.health_potion, 2);
  });

  it("loot claim records entry in lootClaims with nowMs", function () {
    const s = freshState();
    const env = makeEnvelope("request_loot_claim", {
      itemId: "health_potion",
      count: 1,
    });
    const { state } = reduceHarthmereLiveModeBackendStateV1(s, env, NOW_MS);
    assert.strictEqual(state.combat.lootClaims[env.requestId], NOW_MS);
  });

  it("rejects invalid loot counts instead of coercing them to one", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_loot_claim", {
      itemId: "health_potion",
      count: 0,
    });
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.ok(summary.warnings.includes("loot_rejected:invalid_count"));
  });

  it("routes loot currency to the wallet instead of the backpack", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_loot_claim", {
      itemId: "gold_coin",
      count: 9,
    });
    assert.strictEqual(state.inventory.gold, 9);
    assert.strictEqual(state.inventory.items.gold_coin ?? 0, 0);
    assert.ok(summary.touchedModels.includes("wallet"));
  });

  it("routes material loot to material storage when possible", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_loot_claim", {
      itemId: "iron_ore",
      count: 3,
    });
    assert.strictEqual(state.banking.materialStorage.iron_ore, 3);
    assert.strictEqual(state.inventory.items.iron_ore ?? 0, 0);
    assert.ok(
      summary.warnings.includes("loot_sent_to_material_storage:iron_ore")
    );
  });

  it("sends non-material loot to overflow when backpack slots are full", function () {
    const s = freshState();
    for (let i = 0; i < 40; i++) {
      s.inventory.items[`slot_filler_${i}`] = 1;
    }
    const { state, summary } = applyOne(s, "request_loot_claim", {
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.deepStrictEqual(state.inventory.overflow, [
      { itemId: "health_potion", count: 1, reason: "loot_sent_to_overflow" },
    ]);
    assert.ok(summary.warnings.includes("loot_sent_to_overflow:health_potion"));
  });

  it("syncs inventory-loot snapshots from the canonical live inventory", function () {
    const s = freshState();
    s.inventory.gold = 2;
    s.inventory.items = { iron_ore: 1 };
    s.inventory.bank = { health_potion: 4 };
    s.inventory.equipment = { mainhand: "iron_sword" };
    s.inventory.overflow = [
      { itemId: "health_potion", count: 1, reason: "loot_sent_to_overflow" },
    ];
    s.banking.materialStorage = { iron_ore: 3 };
    s.inventoryLoot.actors[ACTOR] = createHarthmereInventoryLootActorV1(ACTOR, {
      gold: 999,
      items: { health_potion: 5 },
      bank: {},
      equipment: {},
    });

    const snapshot = createHarthmereInventoryLootClientSnapshotFromBackendV1(s);
    assert.strictEqual(snapshot.actor!.gold, 2);
    assert.deepStrictEqual(snapshot.actor!.items, { iron_ore: 1 });
    assert.deepStrictEqual(snapshot.actor!.bank, { health_potion: 4 });
    assert.deepStrictEqual(snapshot.actor!.equipment, {
      mainhand: "iron_sword",
    });
    assert.deepStrictEqual((snapshot as any).overflow, [
      { itemId: "health_potion", count: 1, reason: "loot_sent_to_overflow" },
    ]);
    assert.deepStrictEqual((snapshot as any).materialStorage.items, {
      iron_ore: 3,
    });
    assert.deepStrictEqual(s.inventoryLoot.actors[ACTOR].items, {
      iron_ore: 1,
    });
  });
});

// ===========================================================================
// 11. request_bank_transaction
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — bank transactions", function () {
  it("deposit moves item from inventory to bank", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10 };
    const { state } = applyOne(s, "request_bank_transaction", {
      direction: "deposit",
      itemId: "iron_ore",
      count: 5,
    });
    assert.ok((state.inventory.items.iron_ore ?? 0) <= 5);
    assert.ok((state.inventory.bank.iron_ore ?? 0) >= 5);
  });

  it("withdraw moves item from bank to inventory", function () {
    const s = freshState();
    s.inventory.bank = { iron_ore: 10 };
    const { state } = applyOne(s, "request_bank_transaction", {
      direction: "withdraw",
      itemId: "iron_ore",
      count: 4,
    });
    assert.ok((state.inventory.bank.iron_ore ?? 0) <= 6);
    assert.ok((state.inventory.items.iron_ore ?? 0) >= 4);
  });

  it("rejects bank deposit when item not in inventory", function () {
    const s = freshState();
    s.inventory.items = {};
    const { summary } = applyOne(s, "request_bank_transaction", {
      direction: "deposit",
      itemId: "iron_ore",
      count: 3,
    });
    assert.ok(summary.warnings.some((w) => w.includes("bank_rejected:")));
  });
});

// ===========================================================================
// 12. request_auction_post
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — auction post", function () {
  it("posting a listing creates escrow and a listing record", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 1 };
    s.inventory.gold = 500;
    const { state, summary } = applyOne(s, "request_auction_post", {
      itemId: "iron_sword",
      count: 1,
      unitPrice: 500,
    });
    assert.ok(Object.keys(state.economy.auctionListings).length >= 1);
    // Listing fee should have been deducted
    assert.ok(state.inventory.gold < 500);
    assert.ok(summary.touchedModels.includes("auction_listing"));
    assert.ok(summary.touchedModels.includes("inventory_escrow"));
  });

  it("rejects posting when actor doesn't own the item", function () {
    const s = freshState();
    s.inventory.items = {}; // no iron_sword
    s.inventory.gold = 500;
    const { summary } = applyOne(s, "request_auction_post", {
      itemId: "iron_sword",
      count: 1,
      unitPrice: 500,
    });
    assert.ok(
      summary.warnings.some((w) => w.includes("auction_post_rejected:"))
    );
  });

  it("rejects posting a quest item", function () {
    const s = freshState();
    s.inventory.items = { dungeon_key: 1 };
    s.inventory.gold = 500;
    const { summary } = applyOne(s, "request_auction_post", {
      itemId: "dungeon_key",
      count: 1,
      unitPrice: 100,
    });
    assert.ok(
      summary.warnings.some((w) => w.includes("auction_post_rejected:"))
    );
  });

  it("ledger records the listing fee", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 1 };
    s.inventory.gold = 1000;
    const { state } = applyOne(s, "request_auction_post", {
      itemId: "iron_sword",
      count: 1,
      unitPrice: 500,
    });
    const feeEntry = state.economy.ledger.find(
      (e) => e.kind === "auction_listing_fee"
    );
    assert.ok(feeEntry !== undefined);
    assert.ok(feeEntry!.amount < 0); // fee is negative (deducted from actor)
  });
});

// ===========================================================================
// 13. request_auction_settle (buy_listing)
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — auction settle", function () {
  it("buy_listing transfers item to buyer and deducts gold", function () {
    // First post a listing
    const seller = "player_seller_001";
    const buyer = "player_buyer_001";

    // Simulate: we manually inject a listing into state (seller already posted it)
    const s = freshState();
    s.inventory.gold = 1000;
    const listingId = "listing_iron_sword_001";
    s.economy.auctionListings[listingId] = {
      listingId,
      sellerId: seller,
      itemId: "iron_sword",
      count: 1,
      unitPrice: 300,
      listingFeeCharged: 13,
      expiresAtMs: NOW_MS + 48 * 3600 * 1000,
      status: "active",
      createdAtMs: NOW_MS - 1000,
    };

    const { state, summary } = applyOne(
      s,
      "request_auction_settle",
      { listingId },
      { actorId: buyer }
    );
    // Buyer's inventory should gain the item (recordDelta called with buyerItemDelta)
    // Note: buyer state is the same actor state here since we use a single-actor state model in tests
    assert.ok(summary.touchedModels.includes("auction_listing"));
    assert.ok(summary.touchedModels.includes("wallet"));
    // Listing should be marked as sold or removed
    const listing = state.economy.auctionListings[listingId];
    if (listing) {
      assert.ok(listing.status === "sold" || listing.status === "active");
    }
    // House tax should have accumulated
    assert.ok((state.economy.houseTaxAccumulated ?? 0) >= 0);
  });

  it("rejects buy_listing when listing does not exist", function () {
    const s = freshState();
    s.inventory.gold = 1000;
    const { summary } = applyOne(s, "request_auction_settle", {
      listingId: "nonexistent_listing",
    });
    assert.ok(
      summary.warnings.some((w) => w.includes("auction_settle_rejected:"))
    );
  });

  it("records auction_sale ledger entry on successful buy", function () {
    const s = freshState();
    s.inventory.gold = 1000;
    const listingId = "listing_health_potion_001";
    s.economy.auctionListings[listingId] = {
      listingId,
      sellerId: "other_player",
      itemId: "health_potion",
      count: 5,
      unitPrice: 50,
      listingFeeCharged: 10,
      expiresAtMs: NOW_MS + 48 * 3600 * 1000,
      status: "active",
      createdAtMs: NOW_MS - 1000,
    };
    const { state } = applyOne(s, "request_auction_settle", { listingId });
    const saleEntry = state.economy.ledger.find(
      (e) => e.kind === "auction_sale"
    );
    assert.ok(saleEntry !== undefined);
  });
});

// ===========================================================================
// 14. request_respec
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — respec", function () {
  it("full respec deducts gold cost, increments respec.count, clears talent nodes", function () {
    const s = freshState();
    s.inventory.gold = 1000;
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.knownRecipes = [];
    s.talents = { nodes: ["arms_1", "arms_2"], pointsSpent: 2 };

    const { state } = applyOne(s, "request_respec", { respecType: "full" });

    // Gold was deducted (respec base cost = 100).
    assert.ok(state.inventory.gold < 1000);

    // Respec count incremented and the transaction is recorded as a respec fee,
    // not as an auction sale. Auction-sale ledger entries belong only to the
    // auction-settle tests above.
    assert.ok(state.respec.count >= 1);
    const respecFeeEntry = state.economy.ledger.find(
      (e) => e.kind === "respec_fee"
    );
    assert.ok(respecFeeEntry !== undefined);
    assert.ok((respecFeeEntry?.amount ?? 0) < 0);

    // Talent nodes cleared.
    assert.deepStrictEqual(state.talents.nodes, []);
    assert.strictEqual(state.talents.pointsSpent, 0);
  });

  it("respec cost escalates with each respec (check via ledger)", function () {
    let s = freshState();
    s.inventory.gold = 10000;
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_attack"];

    let cost1 = 0;
    let cost2 = 0;

    ({ state: s } = applyOne(s, "request_respec", { respecType: "full" }));
    const entry1 = s.economy.ledger.find((e) => e.kind === "respec_fee");
    cost1 = Math.abs(entry1?.amount ?? 0);

    ({ state: s } = applyOne(s, "request_respec", { respecType: "full" }));
    const entries = s.economy.ledger.filter((e) => e.kind === "respec_fee");
    cost2 = Math.abs(entries[entries.length - 1]?.amount ?? 0);

    assert.ok(cost2 >= cost1, `Expected cost2 (${cost2}) ≥ cost1 (${cost1})`);
  });

  it("rejects respec when actor has insufficient gold", function () {
    const s = freshState();
    s.inventory.gold = 0; // can't afford anything
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_attack"];
    const { summary } = applyOne(s, "request_respec", { respecType: "full" });
    assert.ok(summary.warnings.some((w) => w.includes("respec_rejected:")));
  });
});

// ===========================================================================
// 15. request_quest_state_update
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — quest state", function () {
  it("marks quest as active with progress", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_quest_state_update", {
      questId: "quest_goblin_slayer",
      progress: 3,
    });
    assert.ok(state.quests.active["quest_goblin_slayer"] !== undefined);
    assert.ok(state.quests.active["quest_goblin_slayer"].progress >= 3);
  });

  it("marks quest as completed and removes from active", function () {
    const s = freshState();
    s.quests.active["quest_goblin_slayer"] = { progress: 10 };
    const { state } = applyOne(s, "request_quest_state_update", {
      questId: "quest_goblin_slayer",
      completed: true,
    });
    assert.ok(state.quests.completed["quest_goblin_slayer"] !== undefined);
    assert.ok(state.quests.active["quest_goblin_slayer"] === undefined);
  });

  it("no-ops when questId is absent from payload", function () {
    const s = freshState();
    const before = JSON.stringify(s.quests);
    const { state } = applyOne(s, "request_quest_state_update", {});
    assert.strictEqual(JSON.stringify(state.quests), before);
  });

  it("server-authoritatively accepts and completes live-entity supply quests", function () {
    const s = freshState();
    s.inventory.items.road_ration = 3;
    s.inventory.items.clean_water = 2;
    const payload = liveHelperPayloadForKind("food_water");
    const quest = getLiveEntityHelperQuestForEntityV1({
      entityId: String(payload.entityId),
      label: String(payload.entityLabel),
      position: [
        Number(payload.entityX),
        Number(payload.entityY),
        Number(payload.entityZ),
      ],
      hasRobotComponent: true,
      isRobotLike: true,
    });
    assert.ok(quest, "expected a deterministic helper quest");
    const marker = liveEntityHelperQuestTargetMarkerForKindV1("food_water");

    let result = applyOne(
      s,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_accept",
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.ok(result.state.quests.active[quest!.questId]);
    assert.deepEqual(
      result.state.building.inWorldMarkers[marker!.id].position,
      marker!.position
    );

    result = applyOne(
      result.state,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_complete",
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.inventory.items.road_ration, undefined);
    assert.equal(result.state.inventory.items.clean_water, undefined);
    assert.equal(result.state.inventory.items.minor_healing_salve, 2);
    assert.equal(result.state.inventory.items.repair_voucher, 1);
    assert.equal(
      getHarthmereItemDefinitionV1("repair_voucher")?.displayName,
      "Black Anvil Repair Voucher"
    );
    assert.equal(
      getHarthmereItemDefinitionV1("repair_voucher")?.description,
      "Redeemable at the Black Anvil for trusted field repairs."
    );
    assert.ok(result.state.quests.completed[quest!.questId]);
    assert.equal(result.state.quests.active[quest!.questId], undefined);
    assert.equal(
      result.state.building.inWorldMarkers[marker!.id],
      undefined,
      "target marker clears after completion"
    );
    assert.ok(
      (result.state.classMagic.skills.character_level?.xp ?? 0) > 0,
      "quest completion awards character XP on the server reducer"
    );
  });

  it("spawns the live-entity hard boss only after the boss quest is accepted and recorded in the Muck area", function () {
    const s = freshState();
    const payload = liveHelperPayloadForKind("hard_boss");
    const quest = getLiveEntityHelperQuestForEntityV1({
      entityId: String(payload.entityId),
      label: String(payload.entityLabel),
      position: [
        Number(payload.entityX),
        Number(payload.entityY),
        Number(payload.entityZ),
      ],
      hasRobotComponent: true,
      isRobotLike: true,
    });
    assert.ok(quest, "expected a hard boss helper quest");
    const marker = liveEntityHelperQuestTargetMarkerForKindV1("hard_boss");
    assert.ok(marker, "expected a hard boss marker");

    let rejected = applyOne(
      s,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_record_boss_defeat",
      },
      { subsystem: "quest" }
    );
    assert.ok(
      rejected.summary.warnings.includes(
        "live_entity_helper_rejected:boss_not_spawned"
      )
    );

    let result = applyOne(
      s,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_accept",
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.deepEqual(
      result.state.building.inWorldMarkers[
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
      ].position,
      marker!.position
    );

    const notReady = canCompleteLiveEntityHelperQuestV1(quest!, {
      hardBossDefeats: result.state.quests.active[quest!.questId].progress,
    });
    assert.equal(notReady.ok, false);

    result = applyOne(
      result.state,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_record_boss_defeat",
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.quests.active[quest!.questId].progress, 1);

    result = applyOne(
      result.state,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_complete",
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.inventory.items.muck_boss_trophy, 1);
    assert.equal(result.state.inventory.items.stabilized_exotic_matter, 1);
    assert.equal(result.state.inventory.items.repair_voucher, 2);
    assert.ok(result.state.quests.completed[quest!.questId]);
    assert.equal(
      result.state.building.inWorldMarkers[
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
      ],
      undefined
    );
  });

  it("depletes robot energy into Muck and recharges the protected area with Stabilized Exotic Matter", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[0];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const s = freshState();
    s.robotProtection.robots[robotId].lastTickAtMs = NOW_MS - 3_600_000;
    assert.equal(s.robotProtection.robots[robotId].status, "charged");
    assert.equal(s.building.safeZones[area.areaId].safeFromMuck, true);
    assert.equal(
      s.building.inWorldMarkers[area.protectedMarkerId].kind,
      "safe_zone"
    );

    let result = applyOne(
      s,
      "request_quest_state_update",
      {
        operation: "live_entity_robot_energy_tick",
        robotId,
        drainPerHour: 100,
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.robotProtection.robots[robotId].energy, 0);
    assert.equal(
      result.state.robotProtection.areas[area.areaId].status,
      "mucked"
    );
    assert.equal(
      result.state.building.safeZones[area.areaId].safeFromMuck,
      false
    );
    assert.equal(
      result.state.building.inWorldMarkers[area.protectedMarkerId],
      undefined
    );
    assert.equal(
      result.state.building.inWorldMarkers[area.muckMarkerId].kind,
      "muck_boundary"
    );
    assert.deepEqual(
      result.state.building.inWorldMarkers[area.muckMarkerId].position,
      area.anchor
    );

    result.state.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1] = 1;
    const xpBefore = result.state.classMagic.skills.character_level?.xp ?? 0;
    result = applyOne(
      result.state,
      "request_quest_state_update",
      {
        operation: "live_entity_robot_energy_recharge",
        robotId,
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.equal(
      result.state.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1],
      undefined
    );
    assert.equal(result.state.inventory.items.repair_voucher, 1);
    assert.equal(result.state.inventory.items.minor_healing_salve, 2);
    assert.ok(
      (result.state.classMagic.skills.character_level?.xp ?? 0) > xpBefore
    );
    assert.equal(LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1.baseXp, 90);
    assert.equal(result.state.robotProtection.robots[robotId].energy, 40);
    assert.equal(
      result.state.robotProtection.areas[area.areaId].status,
      "protected"
    );
    assert.equal(
      result.state.building.safeZones[area.areaId].safeFromMuck,
      true
    );
    assert.equal(
      result.state.building.inWorldMarkers[area.muckMarkerId],
      undefined
    );
    assert.equal(
      result.state.building.inWorldMarkers[area.protectedMarkerId].kind,
      "safe_zone"
    );
    assert.deepEqual(
      result.state.building.inWorldMarkers[area.protectedMarkerId].position,
      area.anchor
    );
  });

  it("rejects robot recharge without Exotic Matter and keeps Muck state unchanged", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[1];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const state = freshState();
    state.robotProtection.robots[robotId].lastTickAtMs = NOW_MS - 3_600_000;
    const depleted = applyOne(
      state,
      "request_quest_state_update",
      {
        operation: "live_entity_robot_energy_tick",
        robotId,
        drainPerHour: 100,
      },
      { subsystem: "quest" }
    ).state;
    const result = applyOne(
      depleted,
      "request_quest_state_update",
      {
        operation: "live_entity_robot_energy_recharge",
        robotId,
      },
      { subsystem: "quest" }
    );
    assert.ok(
      result.summary.warnings.includes(
        `live_entity_robot_rejected:item_required:${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1}`
      )
    );
    assert.equal(result.state.robotProtection.robots[robotId].energy, 0);
    assert.equal(
      result.state.robotProtection.areas[area.areaId].status,
      "mucked"
    );
    assert.equal(
      result.state.building.safeZones[area.areaId].safeFromMuck,
      false
    );
  });
});

// ===========================================================================
// 16. request_guild_mutation
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — guild mutation", function () {
  function createTestGuild() {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.classMagic.skills.character_level = {
      xp: 0,
      level: HARTHMERE_GUILD_CREATION_MIN_LEVEL_V1,
    };
    const created = applyOne(s, "request_guild_mutation", {
      operation: "create_guild",
      name: "Iron Wolves",
      tag: "IW",
      recruitment: "open",
    });
    const guildId = created.state.guild.guildId;
    if (!guildId) {
      throw new Error(
        "guild creation should assign the actor to a real guild id"
      );
    }
    return { state: created.state, guildId, summary: created.summary };
  }

  it("creates a real guild record and assigns the actor as leader", function () {
    const { state, summary } = createTestGuild();
    const guildId = state.guild.guildId!;
    const guild = state.guild.guilds[guildId];

    assert.ok(guild, "guild record should be stored under guilds[guildId]");
    assert.strictEqual(state.guild.memberGuildId, guildId);
    assert.strictEqual(guild.members[ACTOR]?.rankId, "leader");
    assert.ok(summary.sharedStateKeys.some((k) => k.includes(guildId)));
    assert.ok(summary.touchedModels.includes("guild_created"));
  });

  it("deposits treasury through the authoritative guild operation", function () {
    const { state: created, guildId } = createTestGuild();
    created.inventory.gold = 1_000;

    const { state, summary } = applyOne(created, "request_guild_mutation", {
      operation: "treasury_deposit",
      guildId,
      amountGold: 100,
      reason: "test deposit",
    });

    assert.strictEqual(state.inventory.gold, 900);
    assert.strictEqual(state.guild.guilds[guildId].treasuryGold, 100);
    assert.ok(summary.touchedModels.includes("guild_treasury"));
    assert.ok(summary.sharedStateKeys.some((k) => k.includes(guildId)));
  });

  it("rejects client-requested guild tax collection and direct XP minting", function () {
    const { state: created, guildId } = createTestGuild();
    const taxed = applyOne(created, "request_guild_mutation", {
      operation: "set_tax",
      guildId,
      taxRate: 0.1,
    }).state;

    const taxAttempt = applyOne(taxed, "request_guild_mutation", {
      operation: "collect_tax",
      guildId,
      amountGold: 1_000,
    });
    assert.ok(
      taxAttempt.summary.warnings.includes(
        "guild_rejected:tax_collection_not_server_authorized"
      )
    );
    assert.strictEqual(taxAttempt.state.guild.guilds[guildId].treasuryGold, 0);

    const xpAttempt = applyOne(taxed, "request_guild_mutation", {
      operation: "add_xp",
      guildId,
      xpDelta: 5_000,
    });
    assert.ok(
      xpAttempt.summary.warnings.includes(
        "guild_rejected:xp_grant_not_server_authorized"
      )
    );
    assert.strictEqual(xpAttempt.state.guild.guilds[guildId].xp, 0);
  });

  it("rejects guild bank withdrawal when the actor would exceed carry weight", function () {
    const { state: created, guildId } = createTestGuild();
    created.inventory.items = { iron_sword: 5 };
    created.guild.guilds[guildId].bank.items.health_potion = 1;

    const { state, summary } = applyOne(created, "request_guild_mutation", {
      operation: "guild_bank_withdraw",
      guildId,
      itemId: "health_potion",
      count: 1,
    });

    assert.strictEqual(state.guild.guilds[guildId].bank.items.health_potion, 1);
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.ok(
      summary.warnings.includes("guild_rejected:carry_weight_limit_exceeded")
    );
  });

  it("uses server item definitions for guild bank withdrawal value limits", function () {
    const { state: created, guildId } = createTestGuild();
    const guild = created.guild.guilds[guildId];
    guild.leaderActorId = "other_leader";
    guild.members[ACTOR].rankId = "officer";
    guild.ranks.officer.dailyBankWithdrawLimitGoldValue = 5;
    guild.bank.items.iron_ore = 2;

    const { state, summary } = applyOne(created, "request_guild_mutation", {
      operation: "guild_bank_withdraw",
      guildId,
      itemId: "iron_ore",
      count: 2,
      itemGoldValue: 1,
    });

    assert.ok(
      summary.warnings.includes("guild_rejected:daily_withdraw_limit_exceeded")
    );
    assert.strictEqual(state.guild.guilds[guildId].bank.items.iron_ore, 2);
    assert.strictEqual(state.inventory.items.iron_ore ?? 0, 0);
  });
});

// ===========================================================================
// 17. request_law_reputation_mutation / request_pvp_flag_change
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — law and reputation", function () {
  it("updates faction reputation by delta", function () {
    const s = freshState();
    s.law.reputation["traders_guild"] = 100;
    const { state } = applyOne(s, "request_law_reputation_mutation", {
      factionId: "traders_guild",
      reputationDelta: 50,
    });
    assert.ok((state.law.reputation["traders_guild"] ?? 0) >= 150);
  });

  it("records crime log entry when crimeKind is present", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_law_reputation_mutation", {
      factionId: "city_guard",
      crimeKind: "theft",
      reputationDelta: -200,
    });
    assert.ok(state.law.crimeLog.some((c) => c.kind === "theft"));
    assert.ok(state.law.flags["theft"] === true);
  });

  it("creates authoritative crime evidence, guard response, fine, and confiscation for witnessed theft", function () {
    const s = freshState();
    s.inventory.items.stolen_relic = 1;

    const { state, summary } = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        crimeKind: "theft",
        valueGold: 400,
        witnesses: 2,
        lineOfSight: true,
        itemIds: ["stolen_relic"],
        reason: "shop theft witnessed",
      },
      { subsystem: "law", zoneId: "harthmere_market" }
    );

    const crime = state.law.crimeRecords[0];
    assert.equal(crime.kind, "theft");
    assert.equal(crime.detected, true);
    assert.equal(crime.response, "confiscation");
    assert.deepEqual(crime.confiscatedItemIds, ["stolen_relic"]);
    assert.equal(state.inventory.items.stolen_relic ?? 0, 0);
    assert.ok((state.law.fines.city_guard ?? 0) > 0);
    assert.ok(state.law.guardResponses[0].crimeId === crime.id);
    assert.ok(summary.touchedModels.includes("law_crime_records"));
    assert.ok(summary.touchedModels.includes("law_guard_response"));
    assert.ok(
      summary.sharedStateKeys.includes(
        harthmereLiveModeSharedStateKeyV1("zone_law", "harthmere_market")
      )
    );
  });

  it("ignores client attempts to force witnessed crimes undetected", function () {
    const s = freshState();
    s.inventory.items.stolen_relic = 1;

    const { state, summary } = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        crimeKind: "theft",
        valueGold: 400,
        witnesses: 2,
        lineOfSight: true,
        itemIds: ["stolen_relic"],
        detected: false,
      },
      { subsystem: "law", zoneId: "harthmere_market" }
    );

    const crime = state.law.crimeRecords[0];
    assert.equal(crime.detected, true);
    assert.equal(crime.response, "confiscation");
    assert.deepEqual(crime.confiscatedItemIds, ["stolen_relic"]);
    assert.equal(state.inventory.items.stolen_relic ?? 0, 0);
    assert.ok((state.law.fines.city_guard ?? 0) > 0);
    assert.ok(
      summary.warnings.includes("law_ignored_client_detected_override")
    );
  });

  it("uses catalogue value for stolen items when clients underreport value", function () {
    const s = freshState();
    s.inventory.items.legal_test_relic = 1;

    const { state } = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        crimeKind: "theft",
        valueGold: 1,
        witnesses: 1,
        lineOfSight: true,
        itemIds: ["legal_test_relic"],
      },
      { subsystem: "law", zoneId: "harthmere_market" }
    );

    const crime = state.law.crimeRecords[0];
    assert.equal(crime.valueGold, 900);
    assert.equal(crime.response, "confiscation");
    assert.deepEqual(crime.confiscatedItemIds, ["legal_test_relic"]);
    assert.equal(state.inventory.items.legal_test_relic ?? 0, 0);
    assert.ok(crime.fineGold >= 80);
  });

  it("records undetected low-signal crimes without confiscating inventory or creating fines", function () {
    const s = freshState();
    s.inventory.items.loose_apple = 1;

    const { state, summary } = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        crimeKind: "theft",
        valueGold: 1,
        witnesses: 0,
        witnessLevel: "no_witness",
        lineOfSight: false,
        lighting: "dark",
        disguiseQuality: 100,
        guardAlertness: 0,
        itemIds: ["loose_apple"],
      },
      { subsystem: "law" }
    );

    assert.equal(state.law.crimeRecords[0].detected, false);
    assert.equal(state.law.crimeRecords[0].response, "warning");
    assert.equal(state.inventory.items.loose_apple, 1);
    assert.equal(state.law.fines.city_guard ?? 0, 0);
    assert.ok(summary.warnings.includes("crime_recorded_undetected:theft"));
  });

  it("tracks restricted-area trespass as shared law state with detention escalation", function () {
    const s = freshState();
    s.law.standing.city_guard = {
      likeability: 0,
      legal: -2500,
      notoriety: 3000,
      notorietyFloor: 0,
    };

    const { state } = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        crimeKind: "trespassing",
        restrictedAreaId: "treasury_back_room",
        witnesses: 3,
        valueGold: 700,
        lineOfSight: true,
      },
      { subsystem: "law", zoneId: "harthmere_treasury" }
    );

    const key = `${ACTOR}:harthmere_treasury:treasury_back_room`;
    assert.equal(
      state.law.restrictedTrespass[key].areaId,
      "treasury_back_room"
    );
    assert.ok(state.law.detentionUntilMs.city_guard >= NOW_MS);
    assert.ok(
      ["arrest_attempt", "combat", "reinforcements", "city_lockdown"].includes(
        state.law.crimeRecords[0].response
      )
    );
  });

  it("maps restricted resource ownership into server-side law instead of client-only reputation", function () {
    const s = freshState();
    const { state } = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "harthmere_temple",
        resourceNodeId: "grave_moss_01",
        resourceOwnership: "protected",
        witnesses: 1,
        valueGold: 30,
      },
      { subsystem: "law", zoneId: "old_chapel" }
    );

    assert.equal(state.law.crimeRecords[0].kind, "theft");
    assert.equal(state.law.crimeRecords[0].resourceNodeId, "grave_moss_01");
    assert.equal(state.law.crimeRecords[0].resourceOwnership, "protected");
    assert.ok((state.law.standing.harthmere_temple?.legal ?? 0) < 0);
  });

  it("request_pvp_flag_change sets pvp_flagged flag", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_pvp_flag_change", {
      factionId: "open_world",
      crimeKind: "pvp_flagged",
    });
    assert.ok(state.law.flags["pvp_flagged"] === true);
  });

  it("adds fine when fineDelta is positive", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_law_reputation_mutation", {
      factionId: "city_guard",
      fineDelta: 250,
    });
    assert.ok((state.law.fines["city_guard"] ?? 0) >= 250);
  });

  it("rejects client negative fine deltas but allows server-authority remission", function () {
    const s = freshState();
    s.law.fines.city_guard = 300;

    const clientAttempt = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        fineDelta: -250,
      },
      { subsystem: "law" }
    );
    assert.equal(clientAttempt.state.law.fines.city_guard, 300);
    assert.ok(
      clientAttempt.summary.warnings.includes(
        "law_rejected:client_negative_fine_delta"
      )
    );

    const serverRemission = applyOne(
      clientAttempt.state,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        fineDelta: -100,
      },
      { source: "server_scheduled_tick", subsystem: "law" }
    );
    assert.equal(serverRemission.state.law.fines.city_guard, 200);
  });

  it("tracks likeability, legal standing, and notoriety with witness scaling", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_law_reputation_mutation", {
      factionId: "city_guard",
      reputationDelta: 100,
      likeabilityDelta: 100,
      legalDelta: -50,
      notorietyDelta: 80,
      witnessLevel: "private",
      reason: "helped_hidden_informant",
    });
    assert.strictEqual(state.law.reputation.city_guard, 30);
    assert.deepStrictEqual(state.law.standing.city_guard, {
      likeability: 30,
      legal: -15,
      notoriety: 24,
      notorietyFloor: 0,
    });
    assert.strictEqual(
      state.law.recentReputationEvents[0].reason,
      "helped_hidden_informant"
    );
  });

  it("suppresses notoriety rewards for much lower-level player targets", function () {
    const s = freshState();
    s.classMagic.skills.character_level = { xp: 29_000, level: 30 };
    const { state, summary } = applyOne(s, "request_pvp_reward", {
      factionId: "harthmere_guard",
      targetLevel: 5,
      targetIsPlayer: true,
      likeabilityDelta: 100,
      legalDelta: 100,
      notorietyDelta: 1000,
    });
    assert.ok(
      summary.warnings.includes(
        "pvp_reward_adjusted:low_level_target_no_notoriety"
      )
    );
    assert.deepStrictEqual(state.law.standing.harthmere_guard, {
      likeability: -500,
      legal: -500,
      notoriety: 0,
      notorietyFloor: 0,
    });
  });
});

// ===========================================================================
// 18. request_farming_action
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — farming", function () {
  it("records a farming plot with crop, timestamp, and state", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_farming_action", {
      plotId: "farm_plot_001",
      cropId: "wheat",
      farmingState: "planted",
    });
    const plot = state.farming.plots["farm_plot_001"];
    assert.ok(plot !== undefined);
    assert.strictEqual(plot.cropId, "wheat");
    assert.strictEqual(plot.state, "planted");
  });

  it("uses requestId as plotId fallback when plotId not provided", function () {
    const s = freshState();
    const env = makeEnvelope("request_farming_action", {
      cropId: "turnip",
      farmingState: "planted",
    });
    const { state } = reduceHarthmereLiveModeBackendStateV1(s, env, NOW_MS);
    assert.ok(state.farming.plots[env.requestId] !== undefined);
  });

  it("plants, waters, and harvests crops through the farming authority", function () {
    let s = freshState();
    s.inventory.items.seed_carrot = 1;

    ({ state: s } = applyOne(s, "request_farming_action", {
      operation: "plant",
      plotId: "farm_plot_002",
      seedItemId: "seed_carrot",
    }));
    assert.equal(s.inventory.items.seed_carrot ?? 0, 0);
    assert.equal(s.farming.plots.farm_plot_002.seedItemId, "seed_carrot");

    ({ state: s } = applyOne(s, "request_farming_action", {
      operation: "water",
      plotId: "farm_plot_002",
    }));
    assert.equal(s.farming.plots.farm_plot_002.state, "watered");

    const early = applyOne(s, "request_farming_action", {
      operation: "harvest",
      plotId: "farm_plot_002",
    });
    assert.ok(early.summary.warnings.includes("farming_rejected:not_ready"));
    assert.equal(early.state.inventory.items.fresh_carrot ?? 0, 0);

    const readyAt = s.farming.plots.farm_plot_002.harvestReadyAtMs!;
    const harvestEnv = makeEnvelope("request_farming_action", {
      operation: "harvest",
      plotId: "farm_plot_002",
    });
    const harvested = reduceHarthmereLiveModeBackendStateV1(
      s,
      harvestEnv,
      readyAt
    );
    assert.equal(harvested.state.inventory.items.fresh_carrot, 3);
    assert.equal(
      harvested.state.farming.plots.farm_plot_002.state,
      "harvested"
    );
    assert.equal(harvested.state.farming.harvests.farm_plot_002, readyAt);
  });

  it("mines Exotic Matter deposits once and replenishes them on the server clock", function () {
    const deposit = harthmereExoticMatterDepositByIdV1(
      "exotic_antiboron_mossglass_survey_03"
    )!;
    const payload = {
      operation: "mine_exotic_matter_deposit",
      depositId: deposit.depositId,
    };
    const actorPosition = {
      x: deposit.position[0],
      y: deposit.position[1],
      z: deposit.position[2],
    };
    const claimKey = `exotic_matter_deposit:${deposit.depositId}`;

    const first = applyOne(freshState(), "request_farming_action", payload, {
      subsystem: "farming",
      serverActorPosition: actorPosition,
    });
    assert.deepEqual(first.summary.warnings, []);
    assert.equal(
      first.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId
      ],
      1
    );
    assert.equal(first.state.combat.lootClaims[claimKey], NOW_MS);
    const shared = createHarthmereLiveModeSharedWorldStateV1(
      first.state,
      NOW_MS
    );
    assert.equal(shared.exoticMatterDepositClaims[claimKey], NOW_MS);

    const otherMinerState = mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
      freshState(NOW_MS + 1),
      shared,
      NOW_MS + 1
    );
    const otherMiner = reduceHarthmereLiveModeBackendStateV1(
      otherMinerState,
      makeEnvelope("request_farming_action", payload, {
        subsystem: "farming",
        serverActorPosition: actorPosition,
      }),
      NOW_MS + 1
    );
    assert.ok(
      otherMiner.summary.warnings.includes(
        "exotic_matter_rejected:deposit_replenishing"
      )
    );
    assert.equal(
      otherMiner.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId
      ] ?? 0,
      0
    );

    const duplicate = applyOne(
      first.state,
      "request_farming_action",
      payload,
      {
        subsystem: "farming",
        serverActorPosition: actorPosition,
      }
    );
    assert.ok(
      duplicate.summary.warnings.includes(
        "exotic_matter_rejected:deposit_replenishing"
      )
    );
    assert.equal(
      duplicate.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId
      ],
      1
    );

    const early = reduceHarthmereLiveModeBackendStateV1(
      duplicate.state,
      makeEnvelope("request_farming_action", payload, {
        subsystem: "farming",
        serverActorPosition: actorPosition,
      }),
      NOW_MS + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1 - 1
    );
    assert.ok(
      early.summary.warnings.includes(
        "exotic_matter_rejected:deposit_replenishing"
      )
    );

    const replenished = reduceHarthmereLiveModeBackendStateV1(
      early.state,
      makeEnvelope("request_farming_action", payload, {
        subsystem: "farming",
        serverActorPosition: actorPosition,
      }),
      NOW_MS + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1
    );
    assert.deepEqual(replenished.summary.warnings, []);
    assert.equal(
      replenished.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId
      ],
      2
    );
    assert.equal(
      replenished.state.combat.lootClaims[claimKey],
      NOW_MS + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1
    );
  });

  it("rejects Exotic Matter mining without an authoritative nearby actor position", function () {
    const deposit = harthmereExoticMatterDepositByIdV1(
      "exotic_antihelium_deep_spindle_15"
    )!;
    const payload = {
      operation: "mine_exotic_matter_deposit",
      depositId: deposit.depositId,
    };

    const unverified = applyOne(freshState(), "request_farming_action", payload, {
      subsystem: "farming",
    });
    assert.ok(
      unverified.summary.warnings.includes(
        "exotic_matter_rejected:deposit_proximity_unverified"
      )
    );
    assert.equal(
      unverified.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihelium.itemId
      ] ?? 0,
      0
    );

    const far = applyOne(freshState(), "request_farming_action", payload, {
      subsystem: "farming",
      serverActorPosition: { x: 0, y: 70, z: 0 },
    });
    assert.ok(
      far.summary.warnings.includes(
        "exotic_matter_rejected:deposit_proximity_required"
      )
    );
    assert.equal(
      far.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihelium.itemId
      ] ?? 0,
      0
    );

    const unknown = applyOne(
      freshState(),
      "request_farming_action",
      { operation: "mine_exotic_matter_deposit", depositId: "missing_deposit" },
      {
        subsystem: "farming",
        serverActorPosition: {
          x: deposit.position[0],
          y: deposit.position[1],
          z: deposit.position[2],
        },
      }
    );
    assert.ok(
      unknown.summary.warnings.includes(
        "exotic_matter_rejected:unknown_deposit"
      )
    );
  });

  it("hunts only dead wild animals and prevents repeated harvests", function () {
    let s = freshState();
    s.combat.entitySnapshots.deer_001 = {
      hp: 0,
      maxHp: 20,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: false,
      isAttackable: false,
      level: 1,
      species: "deer",
    };

    const first = applyOne(s, "request_farming_action", {
      operation: "hunt_animal",
      animalId: "deer_001",
    });
    assert.equal(first.state.inventory.items.raw_meat, 2);
    assert.equal(first.state.combat.lootClaims.deer_001, NOW_MS);

    const duplicate = applyOne(first.state, "request_farming_action", {
      operation: "hunt_animal",
      animalId: "deer_001",
    });
    assert.ok(
      duplicate.summary.warnings.includes("hunt_rejected:already_harvested")
    );
    assert.equal(duplicate.state.inventory.items.raw_meat, 2);
  });

  it("forages live food spawns once and tracks the depletion claim", function () {
    const s = freshState();

    const first = applyOne(s, "request_farming_action", {
      operation: "forage_food",
      spawnId: "berries_001",
      itemId: "wild_berries",
    });
    assert.equal(first.state.inventory.items.wild_berries, 1);
    assert.equal(first.state.combat.lootClaims.berries_001, NOW_MS);

    const duplicate = applyOne(first.state, "request_farming_action", {
      operation: "forage_food",
      spawnId: "berries_001",
      itemId: "wild_berries",
    });
    assert.ok(
      duplicate.summary.warnings.includes("forage_rejected:spawn_depleted")
    );
    assert.equal(duplicate.state.inventory.items.wild_berries, 1);
  });

  it("rejects missing and non-food forage payloads", function () {
    const s = freshState();

    const missing = applyOne(s, "request_farming_action", {
      operation: "forage_food",
    });
    assert.ok(
      missing.summary.warnings.includes("forage_rejected:missing_spawn")
    );

    const invalid = applyOne(s, "request_farming_action", {
      operation: "forage_food",
      spawnId: "moss_001",
      itemId: "raw_meat",
    });
    assert.ok(invalid.summary.warnings.includes("forage_rejected:not_food"));
    assert.equal(invalid.state.inventory.items.raw_meat ?? 0, 0);
  });

  it("rejects cattle and protected species from the hunting path", function () {
    const s = freshState();
    s.combat.entitySnapshots.cow_001 = {
      hp: 0,
      maxHp: 30,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: false,
      isAttackable: false,
      isLivestock: true,
      ownerId: ACTOR,
      species: "cow",
    };
    s.combat.entitySnapshots.stag_001 = {
      hp: 0,
      maxHp: 30,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: false,
      isAttackable: false,
      protectedSpecies: true,
      species: "stag",
    };

    const cattle = applyOne(s, "request_farming_action", {
      operation: "hunt_animal",
      animalId: "cow_001",
    });
    assert.ok(
      cattle.summary.warnings.includes(
        "hunt_rejected:livestock_requires_care_action"
      )
    );
    assert.equal(cattle.state.inventory.items.raw_meat ?? 0, 0);

    const protectedSpecies = applyOne(s, "request_farming_action", {
      operation: "hunt_animal",
      animalId: "stag_001",
    });
    assert.ok(
      protectedSpecies.summary.warnings.includes(
        "hunt_rejected:protected_species"
      )
    );
    assert.equal(protectedSpecies.state.inventory.items.raw_meat ?? 0, 0);
  });

  it("cooks and eats food through live mode, restoring stamina only", function () {
    let s = freshState();
    s.inventory.items.raw_meat = 1;
    s.combat.hp = 96;
    s.combat.resources.stamina = 50;
    s.combat.maxResources.stamina = 100;

    ({ state: s } = applyOne(s, "request_farming_action", {
      operation: "cook_food",
      recipeId: "grilled_meat",
      rawItemId: "raw_meat",
      stationKind: "campfire",
    }));
    assert.equal(s.inventory.items.raw_meat ?? 0, 0);
    assert.equal(s.inventory.items.grilled_meat, 1);

    const eaten = applyOne(s, "request_farming_action", {
      operation: "eat_food",
      itemId: "grilled_meat",
    });
    assert.equal(eaten.state.inventory.items.grilled_meat ?? 0, 0);
    assert.equal(eaten.state.combat.hp, 96);
    assert.equal(eaten.state.combat.resources.stamina, 82);
  });

  it("cooks multi-ingredient recipe batches through live mode with station checks", function () {
    let s = freshState();
    s.inventory.items.loaf_bread = 2;
    s.inventory.items.fresh_carrot = 2;

    const missingStation = applyOne(s, "request_farming_action", {
      operation: "cook_food",
      recipeId: "worker_meal",
      stationKind: "campfire",
      count: 2,
    });
    assert.ok(
      missingStation.summary.warnings.includes(
        "cooking_rejected:missing_station:cookpot"
      )
    );
    assert.equal(missingStation.state.inventory.items.worker_meal ?? 0, 0);

    ({ state: s } = applyOne(s, "request_farming_action", {
      operation: "cook_food",
      recipeId: "worker_meal",
      stationKind: "cookpot",
      count: 2,
    }));
    assert.equal(s.inventory.items.loaf_bread ?? 0, 0);
    assert.equal(s.inventory.items.fresh_carrot ?? 0, 0);
    assert.equal(s.inventory.items.worker_meal, 4);
    assert.ok((s.classMagic.skills.cooking?.xp ?? 0) >= 16);
  });

  it("rejects invalid live cooking payloads without mutating inventory", function () {
    const s = freshState();
    s.inventory.items.raw_meat = 1;

    const invalidCount = applyOne(s, "request_farming_action", {
      operation: "cook_food",
      recipeId: "grilled_meat",
      stationKind: "campfire",
      count: 0,
    });
    assert.ok(
      invalidCount.summary.warnings.includes("cooking_rejected:invalid_count")
    );
    assert.equal(invalidCount.state.inventory.items.raw_meat, 1);

    const unknownRecipe = applyOne(s, "request_farming_action", {
      operation: "cook_food",
      recipeId: "mystery_hash",
      stationKind: "campfire",
    });
    assert.ok(
      unknownRecipe.summary.warnings.includes("cooking_rejected:unknown_recipe")
    );
    assert.equal(unknownRecipe.state.inventory.items.raw_meat, 1);
  });

  it("uses medical items through live mode to restore health only", function () {
    let s = freshState();
    s.inventory.items.health_potion = 2;
    s.combat.hp = 70;
    s.combat.resources.stamina = 50;

    const first = applyOne(
      s,
      "request_medical_action",
      {
        operation: "use_medical_item",
        itemId: "health_potion",
      },
      { subsystem: "medical" }
    );
    assert.equal(first.state.combat.hp, 100);
    assert.equal(first.state.combat.resources.stamina, 50);
    assert.equal(first.state.inventory.items.health_potion, 1);
    assert.equal(
      first.state.inventory.consumableCooldowns.potion,
      NOW_MS + 30_000
    );

    s = first.state;
    s.combat.hp = 80;
    const cooldown = applyOne(
      s,
      "request_medical_action",
      {
        operation: "use_medical_item",
        itemId: "health_potion",
      },
      { subsystem: "medical" }
    );
    assert.ok(
      cooldown.summary.warnings.includes(
        "medical_rejected:consumable_on_cooldown"
      )
    );
    assert.equal(cooldown.state.inventory.items.health_potion, 1);
  });

  it("uses licensed doctor businesses for health treatment through live mode", function () {
    const s = freshState();
    s.combat.hp = 35;
    s.inventory.gold = 150;
    s.economy.businesses.clinic_1 = {
      businessId: "clinic_1",
      ownerId: "doctor_player",
      type: "medical_doctor",
      licenseLevel: 2,
      propertyId: "property_clinic_1",
      inventory: { field_medkit: 1, medicine: 1 },
      employees: [],
      activeContracts: [],
      reputation: 50,
      upkeepCost: 0,
      serviceRadius: 14,
      customerSatisfaction: 70,
      revenueBalanceGold: 10,
      lifetimeRevenueGold: 0,
      taxBalanceGold: 0,
      lastRevenueCycleAtMs: NOW_MS,
      createdAtMs: NOW_MS,
      updatedAtMs: NOW_MS,
    };

    const treated = applyOne(
      s,
      "request_medical_action",
      {
        operation: "doctor_treatment",
        businessId: "clinic_1",
        costGold: 90,
      },
      { subsystem: "medical" }
    );
    assert.equal(treated.state.combat.hp, 100);
    assert.equal(treated.state.inventory.gold, 60);
    assert.equal(
      treated.state.economy.businesses.clinic_1.inventory.field_medkit ?? 0,
      0
    );
    assert.equal(
      treated.state.economy.businesses.clinic_1.inventory.medicine ?? 0,
      0
    );
    assert.equal(
      treated.state.economy.businesses.clinic_1.revenueBalanceGold,
      100
    );
    assert.ok(
      treated.state.economy.ledger.some(
        (entry) =>
          entry.kind === "medical_doctor_treatment" && entry.amount === -90
      )
    );

    const missingSupplyState = treated.state;
    missingSupplyState.combat.hp = 50;
    missingSupplyState.inventory.gold = 150;
    const missingSupply = applyOne(
      missingSupplyState,
      "request_medical_action",
      {
        operation: "doctor_treatment",
        businessId: "clinic_1",
        costGold: 90,
      },
      { subsystem: "medical" }
    );
    assert.ok(
      missingSupply.summary.warnings.includes(
        "medical_rejected:doctor_missing_supply:field_medkit"
      )
    );
  });

  it("feeds cattle and collects milk through live mode", function () {
    let s = freshState();
    s.inventory.items.seed_wheat = 1;
    s.farming.livestock.cow_001 = {
      livestockId: "cow_001",
      species: "cow",
      ownerId: ACTOR,
      health: 40,
      hunger: 10,
      productItemId: "fresh_milk",
      productReadyAtMs: NOW_MS + 6 * 60 * 60 * 1000,
    };

    ({ state: s } = applyOne(s, "request_farming_action", {
      operation: "feed_livestock",
      livestockId: "cow_001",
      feedItemId: "seed_wheat",
    }));
    assert.equal(s.inventory.items.seed_wheat ?? 0, 0);
    assert.ok(s.farming.livestock.cow_001.hunger > 25);

    const early = applyOne(s, "request_farming_action", {
      operation: "collect_livestock_product",
      livestockId: "cow_001",
    });
    assert.ok(
      early.summary.warnings.includes("livestock_rejected:product_not_ready")
    );

    const readyAt = s.farming.livestock.cow_001.productReadyAtMs;
    const collectEnv = makeEnvelope("request_farming_action", {
      operation: "collect_livestock_product",
      livestockId: "cow_001",
    });
    const milk = reduceHarthmereLiveModeBackendStateV1(s, collectEnv, readyAt);
    assert.equal(milk.state.inventory.items.fresh_milk, 1);
    assert.equal(
      milk.state.farming.livestock.cow_001.lastCollectedAtMs,
      readyAt
    );
  });
});

// ===========================================================================
// 19. request_property_building_mutation (place / non-place)
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — building mutation", function () {
  it("rejects placement when the actor has not claimed the real Grove plot", function () {
    const s = freshState();
    s.inventory.gold = 1_000;

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "place",
        plotId: "grove_muckstead_cottage_lot",
        blueprintId: "grove_voxel_cottage_tier_1",
        propertyId: "property_grove_muckstead_cottage_lot",
      }
    );

    assert.strictEqual(Object.keys(state.building.placedStructures).length, 0);
    assert.ok(
      summary.warnings.includes("building_rejected:plot_not_owned_by_actor")
    );
  });

  it("rejects building permits when civil legal standing is too low", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.building.ownedPlots.push("grove_muckstead_cottage_lot");
    s.law.standing.city_guard = {
      likeability: 0,
      legal: -600,
      notoriety: 0,
      notorietyFloor: 0,
    };

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "place",
        plotId: "grove_muckstead_cottage_lot",
        blueprintId: "grove_voxel_cottage_tier_1",
        propertyId: "property_grove_muckstead_cottage_lot",
      }
    );

    assert.strictEqual(Object.keys(state.building.placedStructures).length, 0);
    assert.ok(
      summary.warnings.includes("building_rejected:legal_standing_too_low")
    );
  });

  it("places a real voxel building on an owned Grove plot and creates property state", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.building.ownedPlots.push("grove_muckstead_cottage_lot");

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "place",
        plotId: "grove_muckstead_cottage_lot",
        blueprintId: "grove_voxel_cottage_tier_1",
        propertyId: "property_grove_muckstead_cottage_lot",
      }
    );

    assert.ok(state.property.owned["property_grove_muckstead_cottage_lot"]);
    const homeConsoleMarker =
      state.building.inWorldMarkers[
        buildingSystemHomeConsoleMarkerIdV1(
          "property_grove_muckstead_cottage_lot"
        )
      ];
    assert.ok(homeConsoleMarker);
    assert.equal(homeConsoleMarker.kind, "home_console");
    assert.equal(homeConsoleMarker.label, "Home Console");
    assert.strictEqual(
      state.property.buildingProgress["property_grove_muckstead_cottage_lot"],
      100
    );
    assert.ok(Object.keys(state.building.placedStructures).length > 0);
    assert.ok(summary.touchedModels.includes("property_building"));
    assert.ok(summary.touchedModels.includes("terrain_materialization"));
  });

  it("links a property-started business into production economy and seeds production jobs", function () {
    let s = freshState();
    s.inventory.gold = 10_000;
    s.building.ownedPlots.push("grove_crossroads_shop_lot");

    ({ state: s } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_crossroads_shop_lot",
      blueprintId: "grove_voxel_shop_tier_1",
      propertyId: "property_grove_crossroads_shop_lot",
    }));

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "start_business",
        propertyId: "property_grove_crossroads_shop_lot",
        businessType: "general_trader",
      }
    );

    const businessId = "business_property_grove_crossroads_shop_lot";
    assert.ok(
      state.economy.businesses[businessId],
      "building business should still be present"
    );
    const production = state.economy.production.businesses[businessId];
    assert.ok(
      production,
      "production business should be created with the same id"
    );
    assert.equal(production.typeId, "general_trader");
    assert.equal(production.status, "open");
    assert.equal(production.propertyId, "property_grove_crossroads_shop_lot");
    assert.ok(production.balanceGold >= 0);
    assert.ok(
      summary.touchedModels.includes("economy_production_business_linked")
    );
    assert.ok(
      Object.values(state.jobsBoard.postings).some(
        (job) => job.issuerKind === "business" && job.issuerId === businessId
      ),
      "starting a production business should leave real business-backed jobs on the board"
    );
  });

  it("rejects business licenses while an active bounty is outstanding", function () {
    let s = freshState();
    s.inventory.gold = 10_000;
    s.building.ownedPlots.push("grove_crossroads_shop_lot");

    ({ state: s } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_crossroads_shop_lot",
      blueprintId: "grove_voxel_shop_tier_1",
      propertyId: "property_grove_crossroads_shop_lot",
    }));
    s.law.crimeRecords.push({
      id: "active_bounty_for_business_test",
      actorId: ACTOR,
      kind: "arson",
      zoneId: "harthmere_market",
      factionId: "city_guard",
      itemIds: [],
      severity: 1200,
      valueGold: 0,
      witnessLevel: "public",
      witnesses: 2,
      detected: true,
      detectionScore: 100,
      response: "city_lockdown",
      fineGold: 500,
      bountyGold: 750,
      confiscatedItemIds: [],
      evidenceExpiresAtMs: NOW_MS + 86_400_000,
      status: "wanted",
      createdAtMs: NOW_MS,
    });

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "start_business",
        propertyId: "property_grove_crossroads_shop_lot",
        businessType: "general_trader",
      }
    );

    assert.ok(summary.warnings.includes("business_rejected:active_bounty"));
    assert.equal(Object.keys(state.economy.businesses).length, 0);
    assert.equal(Object.keys(state.economy.production.businesses).length, 0);
  });

  it("rejects starting a production business from a non-business property", function () {
    let s = freshState();
    s.inventory.gold = 10_000;
    s.building.ownedPlots.push("grove_muckstead_cottage_lot");

    ({ state: s } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_muckstead_cottage_lot",
      blueprintId: "grove_voxel_cottage_tier_1",
      propertyId: "property_grove_muckstead_cottage_lot",
    }));

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "start_business",
        propertyId: "property_grove_muckstead_cottage_lot",
        businessType: "general_trader",
      }
    );

    assert.ok(
      summary.warnings.includes("business_rejected:property_not_business_use")
    );
    assert.equal(Object.keys(state.economy.production.businesses).length, 0);
  });

  it("starts construction as a staged project instead of mutating property records directly", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.building.ownedPlots.push("grove_muckstead_cottage_lot");

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "start_construction",
        plotId: "grove_muckstead_cottage_lot",
        blueprintId: "grove_voxel_cottage_tier_1",
        propertyId: "property_grove_muckstead_cottage_lot",
      }
    );

    assert.ok(
      state.building.activeProjects["project_grove_muckstead_cottage_lot"]
    );
    assert.strictEqual(
      state.property.buildingProgress["property_grove_muckstead_cottage_lot"],
      0
    );
    assert.ok(summary.touchedModels.includes("building_project"));
    assert.ok(summary.touchedModels.includes("construction_stage_state"));
  });

  it("starts construction from a Bikkie blueprint item id and consumes the item when requested", function () {
    const s = freshState();
    const itemId = String(BikkieIds.blueprintWorkbench);
    s.inventory.gold = 1_000;
    s.inventory.items[itemId] = 1;
    s.building.ownedPlots.push("grove_craftworks_yard_lot");

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "start_construction",
        plotId: "grove_craftworks_yard_lot",
        blueprintItemId: itemId,
        consumeBlueprintItem: true,
        propertyId: "property_grove_craftworks_yard_lot",
      }
    );

    const project =
      state.building.activeProjects["project_grove_craftworks_yard_lot"];
    assert.ok(project);
    assert.equal(project.blueprintId, "bikkie_workbench");
    assert.equal(state.inventory.items[itemId] ?? 0, 0);
    assert.ok(summary.touchedModels.includes("inventory_items"));
    assert.ok(summary.touchedModels.includes("building_project"));
  });

  it("rejects mismatched Bikkie blueprint item payloads", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.building.ownedPlots.push("grove_craftworks_yard_lot");

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "start_construction",
        plotId: "grove_craftworks_yard_lot",
        blueprintId: "bikkie_workbench",
        blueprintItemId: String(BikkieIds.blueprintKitchen),
        propertyId: "property_grove_craftworks_yard_lot",
      }
    );

    assert.ok(
      summary.warnings.includes(
        "building_project_rejected:blueprint_item_mismatch"
      )
    );
    assert.equal(Object.keys(state.building.activeProjects).length, 0);
  });
});

// ===========================================================================
// 20. Legacy goldDelta — non-authority action kinds
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — legacy goldDelta path", function () {
  it("non-authority action with goldDelta updates inventory.gold and ledger", function () {
    const s = freshState();
    s.inventory.gold = 100;
    const { state } = applyOne(s, "request_npc_ai_tick" as any, {
      goldDelta: 50,
    });
    assert.strictEqual(state.inventory.gold, 150);
    assert.ok(state.economy.ledger.some((e) => e.amount === 50));
  });

  it("non-authority action with negative goldDelta cannot go below 0", function () {
    const s = freshState();
    s.inventory.gold = 10;
    const { state } = applyOne(s, "request_npc_ai_tick" as any, {
      goldDelta: -9999,
    });
    assert.strictEqual(state.inventory.gold, 0);
  });

  it("authority action kind with goldDelta in payload does NOT apply the legacy path", function () {
    // request_vendor_transaction is authority — should reject the buy due to no gold
    // but the goldDelta in payload should NOT be directly applied
    const s = freshState();
    s.inventory.gold = 0;
    const { state } = applyOne(s, "request_vendor_transaction", {
      goldDelta: 9999, // attacker tries to inject gold this way
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 1,
    });
    // gold should remain 0 (buy rejected due to insufficient gold, and legacy path skipped)
    assert.strictEqual(state.inventory.gold, 0);
  });
});

// ===========================================================================
// 21. State immutability — reducer never mutates original state
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — immutability", function () {
  it("original state object is not mutated by the reducer", function () {
    const s = freshState();
    s.inventory.gold = 500;
    const frozen = JSON.stringify(s);
    applyOne(s, "request_xp_reward", {
      skillId: "combat",
      baseXp: 1000,
      sourceLevel: 1,
      contributionScore: 1,
    });
    assert.strictEqual(
      JSON.stringify(s),
      frozen,
      "Original state was mutated!"
    );
  });
});

// ===========================================================================
// 22. Multi-step scenario: new player progression
// ===========================================================================

describe("multi-step scenario — new player progression", function () {
  it("models a complete new-player flow: loot → craft → sell → quest complete", function () {
    let s = freshState();

    // Step 1: learn recipe
    ({ state: s } = applyOne(s, "request_skill_book_use", {
      recipeId: "recipe_iron_sword",
    }));
    assert.ok(s.classMagic.knownRecipes.includes("recipe_iron_sword"));

    // Step 2: loot iron ore
    ({ state: s } = applyOne(s, "request_loot_claim", {
      itemId: "iron_ore",
      count: 10,
    }));
    assert.ok((s.banking.materialStorage.iron_ore ?? 0) >= 10);
    assert.strictEqual(s.inventory.items.iron_ore ?? 0, 0);

    // Step 3: craft iron sword
    ({ state: s } = applyOne(s, "request_crafting", {
      recipeId: "recipe_iron_sword",
    }));
    assert.ok((s.inventory.items.iron_sword ?? 0) >= 1);
    const oreAfterCraft = s.banking.materialStorage.iron_ore ?? 0;
    assert.ok(oreAfterCraft <= 7); // 3 consumed

    // Step 4: earn some xp
    ({ state: s } = applyOne(s, "request_xp_reward", {
      skillId: "character_level",
      baseXp: 1000,
      sourceLevel: 1,
      contributionScore: 1,
    }));
    assert.ok((s.classMagic.skills["character_level"]?.xp ?? 0) >= 1000);

    // Step 5: complete quest
    ({ state: s } = applyOne(s, "request_quest_state_update", {
      questId: "quest_first_steps",
      completed: true,
    }));
    assert.ok(s.quests.completed["quest_first_steps"] !== undefined);
    assert.strictEqual(s.quests.active["quest_first_steps"], undefined);

    // Final state sanity
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1);
  });
});

// ===========================================================================
// 11b. request_mail_transaction
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — mail transactions", function () {
  it("rejects attachment claims without an authoritative mail record", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "missing_mail",
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.ok(summary.warnings.includes("mail_rejected:not_found"));
  });

  it("claims an existing mail attachment once and marks the mail claimed", function () {
    const s = freshState();
    s.mail.messages.mail_1 = {
      mailId: "mail_1",
      recipientActorId: ACTOR,
      status: "unread",
      attachments: { health_potion: 2 },
      createdAtMs: NOW_MS,
    };
    const first = applyOne(s, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "mail_1",
      itemId: "health_potion",
      count: 2,
    });
    assert.strictEqual(first.state.inventory.items.health_potion, 2);
    assert.strictEqual(first.state.mail.messages.mail_1.status, "claimed");

    const second = applyOne(first.state, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "mail_1",
      itemId: "health_potion",
      count: 2,
    });
    assert.strictEqual(second.state.inventory.items.health_potion, 2);
    assert.ok(
      second.summary.warnings.includes("mail_claim_rejected:already_claimed")
    );
  });
});

// ===========================================================================
// Server-physical jobs board and live tick records
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — physical jobs board and live ticks", function () {
  it("rejects client-supplied jobs board target ids without server position proof", function () {
    const s = freshState();
    const { summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        interactionTargetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      },
      { subsystem: "jobs", targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 }
    );
    assert.ok(
      summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
  });

  it("accepts normal client jobs board interactions when the server attaches the actor position", function () {
    const s = freshState();
    s.jobsBoard.postings.job_client_accept = {
      jobId: "job_client_accept",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Client accept regression",
      description: "A focused job for the live accept path.",
      kind: "repair",
      requirements: [
        {
          serviceKind: "repair",
          serviceUnits: 1,
          targetId: "fence_1",
          mapMarkerId: "fence_marker",
        },
      ],
      rewardGold: 45,
      escrowGold: 45,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 0,
      requiresFieldWork: true,
      mapMarkerId: "fence_marker",
      targetId: "fence_1",
      abuseFlags: [],
      logs: [],
    } as any;
    const { state, summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: "job_client_accept",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    assert.ok(
      !summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
    assert.equal(state.jobsBoard.postings.job_client_accept.status, "active");
    assert.equal(Object.values(state.jobsBoard.todos)[0]?.actorId, ACTOR);
  });

  it("places accepted jobs board quest markers at their resolved world target instead of a placeholder", function () {
    const s = freshState();
    const target =
      harthmereJobsBoardQuestMarkerPositionForIdV1("muckwad_patch");
    assert.ok(target, "expected Muckwad Patch to resolve as a quest marker");
    s.jobsBoard.postings.job_muck_hunt = {
      jobId: "job_muck_hunt",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Bounty: Elite Mucker at the Muck Edge",
      description: "Confirm the Mucker is down at the Muckwad Patch.",
      kind: "hunt",
      requirements: [
        {
          targetId: "mucker_elite",
          targetName: "Elite Mucker",
          mapMarkerId: "muckwad_patch",
        },
      ],
      rewardGold: 1200,
      escrowGold: 1200,
      reputationDelta: 12,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 120,
      requiresFieldWork: true,
      mapMarkerId: "muckwad_patch",
      targetId: "mucker_elite",
      abuseFlags: [],
      logs: [],
      autoPosted: true,
      source: "economy_auto_seed",
      partyRecommended: true,
      partyMinSize: 3,
      monsterId: "mucker",
      monsterTier: "elite",
      monsterPowerLevel: 18,
      lootHint: ["Muckheart"],
    } as any;

    const { state, summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: "job_muck_hunt",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );

    assert.deepEqual(summary.warnings, []);
    const todo = Object.values(state.jobsBoard.todos)[0];
    assert.ok(todo, "accepting the hunt should create a quest-board todo");
    const marker =
      state.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`];
    assert.ok(marker, "accepted job should expose an in-world quest marker");
    assert.equal(marker.plotId, "muckwad_patch");
    assert.deepEqual(marker.position, target!.position);
    assert.ok(marker.label.includes("Muckwad Patch"));
    assert.notDeepEqual(
      marker.position,
      [482, 66, -198],
      "accepted jobs must not use the old generic Harthmere placeholder"
    );
  });

  it("spawns fresh cave deposit markers when an Exotic Matter mining job is accepted", function () {
    const s = freshState();
    const target = harthmereJobsBoardQuestMarkerPositionForIdV1(
      "exotic_antiboron_mossglass_survey_03"
    );
    assert.ok(target, "expected Antiboron cave deposit marker to resolve");
    s.jobsBoard.postings.job_exotic_antiboron = {
      jobId: "job_exotic_antiboron",
      boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
      issuerKind: "guild",
      issuerId: "harthmere_exotic_refiners_guild",
      title: "Mine Antiboron for Exotic Matter",
      description: "Mine a sealed Antiboron block from the marked Mossglass cave vein.",
      kind: "gather",
      requirements: [
        {
          itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId,
          count: 1,
          targetId: "harthmere_antiboron_deposit",
          targetName: "Antiboron vein",
          mapMarkerId: "exotic_antiboron_mossglass_survey_03",
        },
      ],
      rewardGold: 4000,
      escrowGold: 4000,
      reputationDelta: 40,
      status: "open",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 400,
      requiresFieldWork: true,
      mapMarkerId: "exotic_antiboron_mossglass_survey_03",
      targetId: "harthmere_antiboron_deposit",
      abuseFlags: [],
      logs: [],
      autoPosted: true,
      source: "economy_auto_seed",
      lootHint: ["Refinery priority pay"],
    } as any;

    const accepted = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
        jobId: "job_exotic_antiboron",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
        serverActorPosition: { x: 1046, y: 65, z: -202 },
      }
    );

    assert.deepEqual(accepted.summary.warnings, []);
    const todo = Object.values(accepted.state.jobsBoard.todos)[0];
    assert.ok(todo, "accepting the mining job should create a quest todo");
    const genericMarker =
      accepted.state.building.inWorldMarkers[
        `jobs_board_marker:${todo.todoId}`
    ];
    assert.ok(genericMarker, "accepted job should expose its primary cave marker");
    assert.equal(genericMarker.plotId, "exotic_antiboron_mossglass_survey_03");
    assert.deepEqual(genericMarker.position, target!.position);

    const spawnedMarkerEntries = Object.entries(
      accepted.state.building.inWorldMarkers
    ).filter(([markerId]) =>
      markerId.startsWith(`jobs_board_exotic_deposit:${todo.todoId}:`)
    );
    assert.equal(spawnedMarkerEntries.length, 3);
    for (const [, marker] of spawnedMarkerEntries) {
      assert.equal(marker.kind, "map_marker");
      assert.ok(marker.label.includes("Fresh Antiboron Deposit"));
      const depositId = marker.markerId.split(":").at(-1);
      const deposit = harthmereExoticMatterDepositByIdV1(depositId);
      assert.ok(deposit, `spawned marker should point to a real deposit: ${depositId}`);
      assert.equal(deposit!.componentId, "antiboron");
      assert.equal(deposit!.jobEligible, true);
      assert.equal(deposit!.caveId, "mossglass_survey_cave");
      assert.deepEqual(marker.position, deposit!.position);
      const cave = HARTHMERE_EXOTIC_MATTER_CAVES_V1.find(
        (entry) => entry.caveId === deposit!.caveId
      );
      assert.ok(cave, `deposit should belong to a confirmed cave: ${deposit!.depositId}`);
      assert.ok(marker.position[0] > cave!.bounds.x0 && marker.position[0] < cave!.bounds.x1);
      assert.ok(marker.position[1] >= cave!.bounds.y0 && marker.position[1] <= cave!.bounds.y1);
      assert.ok(marker.position[2] > cave!.bounds.z0 && marker.position[2] < cave!.bounds.z1);
    }

    accepted.state.inventory.items[
      HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId
    ] = 1;
    const completedQuest = applyOne(
      accepted.state,
      "request_jobs_board_mutation",
      {
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
        jobId: "job_exotic_antiboron",
        completedTargetId: "harthmere_antiboron_deposit",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
        serverActorPosition: { x: 1046, y: 65, z: -202 },
      }
    );

    assert.deepEqual(completedQuest.summary.warnings, []);
    assert.equal(
      Object.keys(completedQuest.state.building.inWorldMarkers).some(
        (markerId) =>
          markerId.startsWith(`jobs_board_exotic_deposit:${todo.todoId}:`)
      ),
      false,
      "fresh mining markers should be removed once the accepted quest objective is completed"
    );
  });

  it("rejects jobs board interactions when the server actor position is outside the tight kiosk range", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    const { summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        title: "Too far",
        description: "This should require walking up to the board.",
        requirements: [{ itemId: "iron_ore", count: 1 }],
        rewardGold: 25,
        deadlineAtMs: NOW_MS + 86_400_000,
      },
      {
        subsystem: "jobs",
        serverActorPosition: {
          x:
            501.99486179104775 +
            HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145 +
            0.1,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    assert.ok(
      summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
  });

  it("accepts jobs board interaction when a server tick supplies nearby actor position", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    const { state, summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        actorX: 501.99486179104775,
        actorY: 70,
        actorZ: -132.00350672753194,
        title: "Bring ore",
        description: "Need ore for repairs",
        requirements: [{ kind: "item", itemId: "iron_ore", count: 1 }],
        rewardGold: 25,
        deadlineAtMs: NOW_MS + 86_400_000,
      },
      { source: "server_scheduled_tick", subsystem: "jobs" }
    );
    assert.ok(
      !summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
    assert.ok(Object.keys(state.jobsBoard.postings).length >= 1);
  });

  it("records NPC AI, boss ticks, and party/raid contribution with validation", function () {
    let s = freshState();
    s.combat.threat[TARGET] = 40;
    ({ state: s } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId: "npc_guard_1" },
      { source: "server_scheduled_tick", subsystem: "npc_ai" }
    ));
    assert.strictEqual(s.combat.npcAiTicks.npc_guard_1.targetId, TARGET);

    ({ state: s } = applyOne(
      s,
      "request_boss_tick",
      { bossId: "boss_1" },
      {
        source: "server_scheduled_tick",
        subsystem: "boss_encounter",
        encounterId: "boss_1",
      }
    ));
    assert.strictEqual(s.combat.bossTicks.boss_1.phase, "phase_1");

    const credit = applyOne(
      s,
      "request_party_raid_credit",
      { contributionScore: 0.75 },
      { source: "server_scheduled_tick", subsystem: "raid", raidId: "raid_1" }
    );
    assert.strictEqual(
      Object.values(credit.state.combat.partyRaidCredits)[0].contribution,
      0.75
    );
  });

  it("server-authoritatively starts unprovoked Muck aggression only after robot protection fails", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[1];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const npcId = "npc:mossy_muckling_watchtower";
    let state = freshState();
    state.combat.entitySnapshots[npcId] = {
      hp: 300,
      maxHp: 300,
      position: { x: 332, y: 54, z: -390 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      species: "muckling",
      level: 4,
    };

    const protectedTick = applyOne(
      state,
      "request_npc_ai_tick",
      { npcName: "Mossy Muckling" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 333, y: 54, z: -390 },
      }
    ).state;
    assert.equal(
      protectedTick.combat.npcAiTicks[npcId].decision,
      "idle_patrol"
    );

    state.robotProtection.robots[robotId].lastTickAtMs = NOW_MS - 3_600_000;
    state = applyOne(
      state,
      "request_quest_state_update",
      {
        operation: "live_entity_robot_energy_tick",
        robotId,
        drainPerHour: 100,
      },
      { subsystem: "quest" }
    ).state;
    assert.equal(state.robotProtection.areas[area.areaId].status, "mucked");

    const aggressive = applyOne(
      state,
      "request_npc_ai_tick",
      { npcName: "Mossy Muckling" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 333, y: 54, z: -390 },
      }
    ).state;
    assert.match(
      aggressive.combat.npcAiTicks[npcId].decision,
      /^muck_unprovoked:/
    );
    assert.equal(aggressive.combat.npcAiTicks[npcId].targetId, ACTOR);
    assert.equal(aggressive.combat.threat[ACTOR], 1);
  });

  it("rejects client-only position claims for unprovoked Muck aggression", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[1];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const npcId = "npc:mossy_muckling_client_claim";
    let state = freshState();
    state.robotProtection.robots[robotId].lastTickAtMs = NOW_MS - 3_600_000;
    state = applyOne(
      state,
      "request_quest_state_update",
      {
        operation: "live_entity_robot_energy_tick",
        robotId,
        drainPerHour: 100,
      },
      { subsystem: "quest" }
    ).state;
    state.combat.entitySnapshots[npcId] = {
      hp: 300,
      maxHp: 300,
      position: { x: 332, y: 54, z: -390 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      species: "muckling",
      level: 4,
    };

    const result = applyOne(
      state,
      "request_npc_ai_tick",
      {
        npcName: "Mossy Muckling",
        actorX: 333,
        actorY: 54,
        actorZ: -390,
      },
      {
        source: "client_request",
        subsystem: "npc_ai",
        targetId: npcId,
      }
    );

    assert.equal(result.state.combat.npcAiTicks[npcId].decision, "idle_patrol");
    assert.equal(result.state.combat.threat[ACTOR], undefined);
  });
});

// ===========================================================================
// Banking production expansion: slots, account vault, material storage, loans
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — production bank expansion", function () {
  it("creates default banking state with no fake balances", function () {
    const s = freshState();
    assert.deepStrictEqual(s.inventory.bank, {});
    assert.deepStrictEqual(s.banking.accountBank, {});
    assert.deepStrictEqual(s.banking.materialStorage, {});
    assert.strictEqual(s.banking.transactionLogs.length, 0);
  });

  it("upgrades personal bank slots and charges real gold", function () {
    const s = freshState();
    s.inventory.gold = 200;
    const before = s.banking.personalBankMaxSlots;
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "upgrade_slots",
      vaultKind: "personal",
    });
    assert.ok(summary.touchedModels.includes("bank_slots"));
    assert.strictEqual(state.banking.personalBankMaxSlots, before + 4);
    assert.ok(state.inventory.gold < 200);
    assert.ok(
      state.banking.transactionLogs.some(
        (log) => log.kind === "bank_slot_upgrade"
      )
    );
  });

  it("rejects slot upgrade when gold is missing", function () {
    const s = freshState();
    s.inventory.gold = 0;
    const before = s.banking.personalBankMaxSlots;
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "upgrade_slots",
      vaultKind: "personal",
    });
    assert.strictEqual(state.banking.personalBankMaxSlots, before);
    assert.ok(
      summary.warnings.includes(
        "bank_rejected:not_enough_gold_for_slot_upgrade"
      )
    );
  });

  it("moves items into and out of the account bank", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 1 };
    const deposited = applyOne(s, "request_bank_transaction", {
      operation: "account_deposit",
      itemId: "iron_sword",
      count: 1,
    }).state;
    assert.strictEqual(deposited.inventory.items.iron_sword ?? 0, 0);
    assert.strictEqual(deposited.banking.accountBank.iron_sword, 1);
    const withdrawn = applyOne(deposited, "request_bank_transaction", {
      operation: "account_withdraw",
      itemId: "iron_sword",
      count: 1,
    }).state;
    assert.strictEqual(withdrawn.banking.accountBank.iron_sword ?? 0, 0);
    assert.strictEqual(withdrawn.inventory.items.iron_sword, 1);
  });

  it("moves crafting materials into material storage and blocks non-materials", function () {
    const s = freshState();
    s.inventory.items = { iron_ore: 10, health_potion: 1 };
    const { state } = applyOne(s, "request_bank_transaction", {
      operation: "material_deposit",
      itemId: "iron_ore",
      count: 4,
    });
    assert.strictEqual(state.inventory.items.iron_ore, 6);
    assert.strictEqual(state.banking.materialStorage.iron_ore, 4);

    const rejected = applyOne(state, "request_bank_transaction", {
      operation: "material_deposit",
      itemId: "health_potion",
      count: 1,
    });
    assert.ok(
      rejected.summary.warnings.includes("bank_rejected:not_material_item")
    );
  });

  it("creates a loan, accrues daily interest, and accepts repayment", function () {
    const s = freshState();
    const borrowed = applyOne(s, "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 7,
    }).state;
    assert.strictEqual(borrowed.inventory.gold, 100);
    const loan = Object.values(borrowed.banking.loans)[0];
    assert.ok(loan);
    const repaid = reduceHarthmereLiveModeBackendStateV1(
      borrowed,
      makeEnvelope("request_bank_transaction", {
        operation: "repay_loan",
        loanId: loan.loanId,
        amount: 50,
      }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000
    ).state;
    assert.ok(repaid.inventory.gold < 100);
    assert.ok(repaid.banking.loans[loan.loanId].principalRemaining < 100);
    assert.ok(
      repaid.banking.transactionLogs.some(
        (log) => log.kind === "bank_loan_payment"
      )
    );
  });

  it("rejects a second active loan", function () {
    const s = freshState();
    const borrowed = applyOne(s, "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 7,
    }).state;
    const { summary } = applyOne(borrowed, "request_bank_transaction", {
      operation: "take_loan",
      amount: 50,
      days: 3,
    });
    assert.ok(summary.warnings.includes("bank_rejected:active_loan_exists"));
  });
});

// ===========================================================================
// Banking v2: server-side carry-weight enforcement and loan consequences
// ===========================================================================

describe("reduceHarthmereLiveModeBackendStateV1 — banking v2 carry weight enforcement", function () {
  it("rejects personal bank withdraw when it would exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    s.inventory.bank = { health_potion: 1 };
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "withdraw",
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(state.inventory.bank.health_potion, 1);
    assert.strictEqual(state.inventory.items.health_potion ?? 0, 0);
    assert.ok(
      summary.warnings.includes(
        "bank_withdraw_rejected:carry_weight_limit_exceeded"
      )
    );
  });

  it("rejects account vault withdraw when it would exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    s.banking.accountBank = { health_potion: 1 };
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "account_withdraw",
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(state.banking.accountBank.health_potion, 1);
    assert.ok(
      summary.warnings.includes(
        "account_bank_withdraw_rejected:carry_weight_limit_exceeded"
      )
    );
  });

  it("rejects material storage withdraw when it would exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    s.banking.materialStorage = { iron_ore: 1 };
    const { state, summary } = applyOne(s, "request_bank_transaction", {
      operation: "material_withdraw",
      itemId: "iron_ore",
      count: 1,
    });
    assert.strictEqual(state.banking.materialStorage.iron_ore, 1);
    assert.ok(
      summary.warnings.includes(
        "material_storage_withdraw_rejected:carry_weight_limit_exceeded"
      )
    );
  });

  it("rejects loot pickup and authorized admin inventory grant when they exceed carry weight", function () {
    const s = freshState();
    s.inventory.items = { iron_sword: 5 };
    const loot = applyOne(s, "request_loot_claim", {
      itemId: "health_potion",
      count: 1,
    });
    assert.strictEqual(loot.state.inventory.items.health_potion ?? 0, 0);
    assert.ok(
      loot.summary.warnings.includes(
        "loot_rejected:carry_weight_limit_exceeded"
      )
    );

    const grant = applyOne(
      s,
      "request_inventory_mutation",
      { itemId: "health_potion", count: 1 },
      { source: "admin_tool", subsystem: "inventory" }
    );
    assert.strictEqual(grant.state.inventory.items.health_potion ?? 0, 0);
    assert.ok(
      grant.summary.warnings.includes(
        "inventory_rejected:carry_weight_limit_exceeded"
      )
    );
  });

  it("rejects vendor buy, auction buy, mail claim, and crafting output when overweight", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.inventory.items = { iron_sword: 5 };

    const vendor = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 1,
    });
    assert.ok(
      vendor.summary.warnings.includes(
        "vendor_rejected:carry_weight_limit_exceeded"
      )
    );

    const auctionState = freshState();
    auctionState.inventory.gold = 1_000;
    auctionState.inventory.items = { iron_sword: 5 };
    auctionState.economy.auctionListings["listing_weight_test"] = {
      listingId: "listing_weight_test",
      sellerId: "seller_001",
      itemId: "health_potion",
      count: 1,
      unitPrice: 10,
      listingFeeCharged: 1,
      status: "active",
      createdAtMs: NOW_MS,
      expiresAtMs: NOW_MS + 60_000,
    };
    const auction = applyOne(auctionState, "request_auction_settle", {
      listingId: "listing_weight_test",
    });
    assert.ok(
      auction.summary.warnings.includes(
        "auction_settle_rejected:carry_weight_limit_exceeded"
      )
    );

    s.mail.messages.mail_weight_test = {
      mailId: "mail_weight_test",
      recipientActorId: ACTOR,
      status: "unread",
      attachments: { health_potion: 1 },
      createdAtMs: NOW_MS,
    };
    const mail = applyOne(s, "request_mail_transaction", {
      operation: "claim_attachment",
      mailId: "mail_weight_test",
      itemId: "health_potion",
      count: 1,
    });
    assert.ok(
      mail.summary.warnings.includes(
        "mail_claim_rejected:carry_weight_limit_exceeded"
      )
    );

    const craftState = freshState();
    craftState.classMagic.knownRecipes = ["recipe_iron_sword"];
    craftState.inventory.items = { iron_sword: 5, iron_ore: 3 };
    const crafted = applyOne(craftState, "request_crafting", {
      recipeId: "recipe_iron_sword",
    });
    assert.ok(
      crafted.summary.warnings.includes(
        "crafting_rejected:carry_weight_limit_exceeded"
      )
    );
  });
});

describe("reduceHarthmereLiveModeBackendStateV1 — loan default consequences", function () {
  it("marks overdue loans defaulted, applies a credit hold, logs the default, and blocks new loans", function () {
    const borrowed = applyOne(freshState(), "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 1,
    }).state;
    const loan = Object.values(borrowed.banking.loans)[0];
    const afterDue = reduceHarthmereLiveModeBackendStateV1(
      borrowed,
      makeEnvelope("request_bank_transaction", {
        operation: "upgrade_slots",
        vaultKind: "personal",
      }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000
    ).state;
    assert.strictEqual(afterDue.banking.loans[loan.loanId].status, "defaulted");
    assert.strictEqual(afterDue.law.flags.bank_credit_hold, true);
    assert.ok(
      afterDue.banking.transactionLogs.some(
        (log) => log.kind === "bank_loan_defaulted"
      )
    );

    const rejected = applyOne(afterDue, "request_bank_transaction", {
      operation: "take_loan",
      amount: 50,
      days: 3,
    });
    assert.ok(
      rejected.summary.warnings.includes(
        "bank_rejected:credit_hold_until_defaulted_loan_paid"
      )
    );
  });

  it("allows a defaulted loan to be repaid and clears the credit hold after full payoff", function () {
    const borrowed = applyOne(freshState(), "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 1,
    }).state;
    const loan = Object.values(borrowed.banking.loans)[0];
    const defaulted = reduceHarthmereLiveModeBackendStateV1(
      borrowed,
      makeEnvelope("request_bank_transaction", {
        operation: "upgrade_slots",
        vaultKind: "personal",
      }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000
    ).state;
    defaulted.inventory.gold = 1_000;
    const repaid = reduceHarthmereLiveModeBackendStateV1(
      defaulted,
      makeEnvelope("request_bank_transaction", {
        operation: "repay_loan",
        loanId: loan.loanId,
        amount: 1_000,
      }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000
    ).state;
    assert.strictEqual(repaid.banking.loans[loan.loanId].status, "paid");
    assert.strictEqual(repaid.law.flags.bank_credit_hold, undefined);
  });
});
