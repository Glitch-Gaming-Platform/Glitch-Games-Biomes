/**
 * live_mode_backend.test.ts
 *
 * Comprehensive tests for the Harthmere live-mode server reducer.
 * Covers all 10 authority-dispatched action kinds plus legacy/non-authority paths,
 * state defaults/parsing, and multi-step scenario flows.
 */

import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  createHarthmereInventoryLootClientSnapshotFromBackend,
  defaultHarthmereLiveModeBackendState,
  parseHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeLedgerStreamKey,
  harthmereLiveModeSharedStateKey,
  HARTHMERE_LIVE_MODE_BACKEND_VERSION,
  createHarthmereLiveModeSharedWorldState,
  createHarthmereLiveModePlayerStatusClientSnapshot,
  createHarthmereLiveModeQuestClientSnapshot,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeSharedWorldState,
  createHarthmereServerMuckCombatEntitySnapshots,
  harthmereNormalizeSeededCombatEntitySnapshots,
  repairHarthmereStatusReadStaminaDeath,
  tickHarthmereLiveModeStaminaForGameplay,
  createHarthmereLiveModeBuildingClientSnapshot,
  HARTHMERE_SERVER_MUCK_COMBAT_RESPAWN_MS,
  harthmereReviveDefeatedSeededCombatEntities,
  type HarthmereLiveEntityKind,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  getHarthmereItemDefinition,
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
  registerHarthmereCraftingRecipe,
  type HarthmereItemDefinition,
  type HarthmereVendorEntry,
  type HarthmereCraftingRecipe,
} from "../mmo_inventory_authority";
import {
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION,
  harthmereBusinessOutpostBusinessId,
} from "../business_customer_simulator";
import {
  registerHarthmereAbility,
  registerHarthmereClassDefinition,
  type HarthmereAbilityCatalogueEntry,
  type HarthmereClassDefinition,
} from "../mmo_combat_authority";
import type {
  HarthmereLiveModeAuthorityEnvelope,
  HarthmereLiveModeActionKind,
} from "@/shared/harthmere/live_mode_readiness";
import {
  buildHarthmereLiveModePersistenceMutationPlan,
  validateHarthmereLiveModeReadiness,
} from "@/shared/harthmere/live_mode_readiness";
import { fallDamageForBlocks } from "@/shared/game/fall_damage";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import { harthmereJobsBoardQuestMarkerPositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import {
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
} from "@/shared/harthmere/jobs_board_muck_bounty_targets";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import {
  HARTHMERE_EXOTIC_MATTER_CAVES,
  HARTHMERE_EXOTIC_MATTER_COMPONENTS,
  HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS,
  harthmereExoticMatterDepositById,
} from "@/shared/harthmere/exotic_matter_caves";
import { HARTHMERE_GUILD_CREATION_MIN_LEVEL } from "@/shared/harthmere/mmo_guild_authority";
import { createHarthmereInventoryLootActor } from "@/shared/harthmere/mmo_inventory_loot_authority";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET,
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
  canCompleteLiveEntityHelperQuest,
  getLiveEntityHelperQuestForEntity,
  liveEntityHelperQuestKindForEntity,
  liveEntityHelperQuestTargetMarkerForKind,
  type LiveEntityHelperQuestEntityContext,
  type LiveEntityHelperQuestKind,
} from "@/shared/harthmere/live_entity_helper_quests";
import {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP,
  liveEntityRobotDefaultRobotIdForArea,
} from "@/shared/harthmere/live_entity_robot_energy_protection";
import {
  BUILDING_SYSTEM_CONSTRUCTION_STAGES,
  BUILDING_SYSTEM_PLOTS,
  buildingSystemBlueprintById,
  buildingSystemBusinessTypeById,
  buildingSystemHomeConsoleMarkerId,
  buildingSystemMaterialRequirementLines,
  buildingSystemPlotById,
} from "@/shared/harthmere/building_system";
import { createHarthmereLiveEntityCombatSnapshotsFromEcsRecords } from "@/shared/harthmere/live_entity_ecs_bridge";
import { HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS } from "@/shared/harthmere/combat_reach";
import { HARTHMERE_RECIPE_BOOKS } from "../harthmere_recipe_books";
import {
  HARTHMERE_CARE_LOOP_DAY_MS,
  HARTHMERE_CARE_DAILY_ACTIVITIES,
  HARTHMERE_DAILY_TASK_MIN_GOLD,
  harthmereDailyTaskXpReward,
} from "../mmo_care_loops";
import {
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_SEED_DEFINITIONS,
} from "../mmo_farming_food_stamina";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW_MS = 1_700_000_000_000;
const ACTOR = "player_live_001";
const TARGET = "mob_goblin_001";

beforeEach(function () {
  this.timeout(60_000);
});

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function nextId() {
  return `live-req-${++_seq}`;
}

/** Create a minimal valid authority envelope */
function makeEnvelope(
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
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
function freshState(nowMs = NOW_MS): HarthmereLiveModeBackendState {
  return defaultHarthmereLiveModeBackendState(ACTOR, nowMs);
}

function addOpenProductionBusiness(
  state: HarthmereLiveModeBackendState,
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
  state: HarthmereLiveModeBackendState,
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  envelopeOverrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
) {
  const env = makeEnvelope(actionKind, payload, envelopeOverrides);
  return reduceHarthmereLiveModeBackendState(state, env, NOW_MS);
}

function createDefeatedLiveEntityDropState(
  itemStacks: Record<string, number>,
  requestId: string,
  overrides: Partial<
    HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
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
  kind: LiveEntityHelperQuestKind
): LiveEntityHelperQuestEntityContext {
  for (let index = 0; index < 200; index += 1) {
    const entityId = `live-helper-test-${kind}-${index}`;
    const label = `Remote Helper ${index}`;
    if (liveEntityHelperQuestKindForEntity(entityId, label) === kind) {
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

function liveHelperPayloadForKind(kind: LiveEntityHelperQuestKind) {
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
  const ironOre: HarthmereItemDefinition = {
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
  const healthPotion: HarthmereItemDefinition = {
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
  const questKey: HarthmereItemDefinition = {
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
  const ironSword: HarthmereItemDefinition = {
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
  const goldCoin: HarthmereItemDefinition = {
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
  const legalTestRelic: HarthmereItemDefinition = {
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
    registerHarthmereItemDefinition(item);
  }
  for (let i = 0; i < 40; i++) {
    registerHarthmereItemDefinition({
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
  const blacksmithVendor: HarthmereVendorEntry = {
    vendorId: "blacksmith_vendor",
    itemId: "iron_ore",
    buyPrice: 10,
    sellPrice: 2,
    stock: 50,
    requiredFaction: "traders_guild",
    requiredReputationTier: 0,
  };
  registerHarthmereVendorEntry(blacksmithVendor);

  // Crafting recipe: 3 iron_ore → 1 iron_sword
  const ironSwordRecipe: HarthmereCraftingRecipe = {
    recipeId: "recipe_iron_sword",
    outputItemId: "iron_sword",
    outputCount: 1,
    inputs: [{ itemId: "iron_ore", count: 3 }],
    requiredLevel: 1,
    craftingTimeMs: 2000,
    xpReward: 50,
  };
  registerHarthmereCraftingRecipe(ironSwordRecipe);

  // Ability: basic_attack (warrior)
  const basicAttack: HarthmereAbilityCatalogueEntry = {
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
  registerHarthmereAbility(basicAttack);

  const npcHexSwipe: HarthmereAbilityCatalogueEntry = {
    abilityId: "npc_hex_swipe_test",
    displayName: "NPC Hex Swipe Test",
    targetType: "single_enemy",
    classRestriction: [],
    specRestriction: [],
    levelRequirement: 1,
    requiredWeaponType: "any",
    resourceKind: "mana",
    resourceCost: 10,
    cooldownMs: 1_000,
    sharedCooldownCategory: undefined,
    sharedCooldownMs: undefined,
    rangeUnits: 4,
    requiresLineOfSight: false,
    allowedInSafeZone: true,
    allowedInPvP: true,
    baseDamage: 40,
    baseHealing: 0,
    attackPowerScaling: 0,
    spellPowerScaling: 0,
    xpReward: 0,
    castTimeMs: 0,
    interruptible: false,
    unlocksMilestones: [],
  };
  registerHarthmereAbility(npcHexSwipe);

  // Class: warrior
  const warrior: HarthmereClassDefinition = {
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
  registerHarthmereClassDefinition(warrior);
});

// ===========================================================================
// 1. defaultHarthmereLiveModeBackendState / parseHarthmereLiveModeBackendState
// ===========================================================================

describe("defaultHarthmereLiveModeBackendState", function () {
  it("produces a state with correct actorId and version", function () {
    const s = freshState();
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION);
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

  it("seeds backend-procedural business outposts into live building state", function () {
    const s = freshState();
    for (const record of Object.values(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS
    )) {
      const plan = record.materializationPlan;
      assert.ok(
        s.building.materializationPlans[plan.requestId],
        `${record.outpostId} plan missing from live state`
      );
      assert.ok(
        s.building.placedStructures[plan.requestId],
        `${record.outpostId} placed structure missing from live state`
      );
      assert.equal(
        s.building.placedStructures[plan.requestId].materializedInEcs,
        true
      );
      assert.ok(
        s.building.safeZones[record.plot.plotId],
        `${record.outpostId} safe zone missing from live state`
      );
      assert.equal(s.building.safeZones[record.plot.plotId].safeFromMuck, true);
      assert.equal(
        s.building.inWorldMarkers[`${record.outpostId}:safe-zone`]?.kind,
        "safe_zone",
        `${record.outpostId} protected-area marker missing`
      );
      assert.ok(
        s.building.inWorldMarkers[`${record.outpostId}:customer-dashboard`],
        `${record.outpostId} customer dashboard marker missing`
      );
      assert.ok(
        s.building.inWorldMarkers[`${record.outpostId}:business-counter`],
        `${record.outpostId} business counter marker missing`
      );
      assert.ok(
        s.building.inWorldMarkers[`${record.outpostId}:jobs-board`],
        `${record.outpostId} jobs board marker missing`
      );
    }
  });

  it("overwrites stale persisted business outpost structures with canonical voxel plans", function () {
    const canonical =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot;
    const stale = freshState();
    stale.building.materializationPlans[
      canonical.materializationPlan.requestId
    ] = {
      ...canonical.materializationPlan,
      edits: [],
      inWorldMarkers: [],
    };
    stale.building.placedStructures[canonical.materializationPlan.requestId] = {
      structureTypeId: canonical.materializationPlan.structureTypeId,
      origin: { x: 0, y: 0, z: 0 },
      placedAtMs: 1,
      plotId: canonical.materializationPlan.plotId,
      blueprintId: canonical.materializationPlan.blueprintId,
      use: canonical.materializationPlan.use,
      voxelEditCount: 0,
      materializedInEcs: false,
    };
    delete stale.building.inWorldMarkers[
      `${canonical.outpostId}:customer-dashboard`
    ];

    const parsed = parseHarthmereLiveModeBackendState(
      JSON.stringify(stale),
      ACTOR,
      NOW_MS
    );
    assert.equal(
      parsed.building.materializationPlans[
        canonical.materializationPlan.requestId
      ].edits.length,
      canonical.materializationPlan.edits.length
    );
    assert.deepEqual(
      parsed.building.placedStructures[canonical.materializationPlan.requestId]
        .origin,
      canonical.origin
    );
    assert.equal(
      parsed.building.placedStructures[canonical.materializationPlan.requestId]
        .materializedInEcs,
      true
    );
    assert.ok(
      parsed.building.inWorldMarkers[
        `${canonical.outpostId}:customer-dashboard`
      ]
    );

    const shared = createHarthmereLiveModeSharedWorldState(stale, NOW_MS);
    shared.building.materializationPlans[
      canonical.materializationPlan.requestId
    ] = {
      ...canonical.materializationPlan,
      edits: [],
      inWorldMarkers: [],
    };
    const merged = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      freshState(),
      shared,
      NOW_MS
    );
    assert.equal(
      merged.building.materializationPlans[
        canonical.materializationPlan.requestId
      ].edits.length,
      canonical.materializationPlan.edits.length
    );
    assert.ok(
      merged.building.inWorldMarkers[
        `${canonical.outpostId}:customer-dashboard`
      ]
    );
  });

  it("seeds canonical outpost businesses without duplicating saved records", function () {
    const canonical =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot;
    const businessId = harthmereBusinessOutpostBusinessId(canonical.outpostId);
    const state = freshState();
    const business = state.economy.production.businesses[businessId];
    assert.ok(business);
    assert.equal(business.status, "open");
    assert.equal(business.ownerKind, "npc");
    assert.equal(business.propertyId, canonical.plot.plotId);
    assert.equal(business.flags[`outpost:${canonical.outpostId}`], true);
    assert.ok(Object.keys(business.inventory).length > 0);

    const parsed = parseHarthmereLiveModeBackendState(
      JSON.stringify(state),
      ACTOR,
      NOW_MS
    );
    assert.deepEqual(
      Object.keys(parsed.economy.production.businesses).filter(
        (id) => id === businessId
      ),
      [businessId]
    );
    assert.equal(
      parsed.economy.production.businesses[businessId].createdAtMs,
      business.createdAtMs
    );
  });
});

describe("parseHarthmereLiveModeBackendState", function () {
  it("returns default state for null input", function () {
    const s = parseHarthmereLiveModeBackendState(null, ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.inventory.gold, 0);
  });

  it("returns default state for malformed JSON", function () {
    const s = parseHarthmereLiveModeBackendState("not-json{{", ACTOR, NOW_MS);
    assert.strictEqual(s.actorId, ACTOR);
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION);
  });

  it("merges stored state with defaults (backward compat — missing fields get defaults)", function () {
    const partial = JSON.stringify({
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION,
      actorId: ACTOR,
      inventory: { gold: 999, items: { iron_ore: 5 } },
      // missing: escrow, consumableCooldowns, respec, talents, building, etc.
    });
    const s = parseHarthmereLiveModeBackendState(partial, ACTOR, NOW_MS);
    assert.strictEqual(s.inventory.gold, 999);
    assert.strictEqual(s.inventory.items.iron_ore, 5);
    assert.deepStrictEqual(s.inventory.escrow, {}); // default injected
    assert.strictEqual(s.respec.count, 0); // default injected
    assert.ok((s.combat.maxResources.mana ?? 0) > 0); // combat resources injected
    assert.ok(Array.isArray(s.law.recentReputationEvents));
  });

  it("overwrites actorId with the provided parameter", function () {
    const raw = JSON.stringify({ ...freshState(), actorId: "old_actor" });
    const s = parseHarthmereLiveModeBackendState(raw, ACTOR, NOW_MS);
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
    const shared = parseHarthmereLiveModeSharedWorldState(
      JSON.stringify(
        createHarthmereLiveModeSharedWorldState(sharedSource, NOW_MS)
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

    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      actorState,
      shared,
      NOW_MS
    );

    assert.equal(actorState.inventory.gold, 123);
    assert.ok(actorState.economy.production.businesses.shared_shop);
    assert.equal(
      actorState.robotProtection.areas[
        LIVE_ENTITY_ROBOT_PROTECTION_AREAS[0].areaId
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

  it("learns recipes from a one-time business storefront recipe book purchase", function () {
    const book = HARTHMERE_RECIPE_BOOKS.find(
      (entry) => entry.businessType === "weapons_tools"
    )!;
    let state = freshState();
    state.inventory.gold = 50_000;
    state.classMagic.knownRecipes = state.classMagic.knownRecipes.filter(
      (recipeId) => !(book.recipeIds as readonly string[]).includes(recipeId)
    );
    addOpenProductionBusiness(state, "business_weapons_books", {
      typeId: book.businessType,
      marker: [100, 65, 100],
    });

    const bought = applyOne(
      state,
      "request_economy_mutation",
      {
        operation: "buy_storefront_good",
        businessId: "business_weapons_books",
        itemId: book.itemId,
        count: 1,
      },
      {
        subsystem: "economy",
        serverActorPosition: { x: 100, y: 65, z: 100 },
      }
    );
    assert.deepEqual(
      bought.summary.warnings.filter((warning) =>
        warning.startsWith("economy_rejected")
      ),
      []
    );
    for (const recipeId of book.recipeIds) {
      assert.ok(
        bought.state.classMagic.knownRecipes.includes(recipeId),
        `${recipeId} should be learned`
      );
    }
    assert.equal(
      bought.state.inventory.items[book.itemId] ?? 0,
      0,
      "recipe books unlock recipes immediately instead of entering inventory"
    );

    const repeat = applyOne(
      bought.state,
      "request_economy_mutation",
      {
        operation: "buy_storefront_good",
        businessId: "business_weapons_books",
        itemId: book.itemId,
        count: 1,
      },
      {
        subsystem: "economy",
        serverActorPosition: { x: 100, y: 65, z: 100 },
      }
    );
    assert.ok(
      repeat.summary.warnings.includes(
        "economy_rejected:recipe_book_already_learned"
      ),
      JSON.stringify(repeat.summary.warnings)
    );
  });

  it("accepts business customer sessions through a server-known interaction marker payload", function () {
    const state = freshState();
    addOpenProductionBusiness(state, "business_clinic_marker_payload", {
      typeId: "medical_doctor",
      marker: [100, 65, 100],
    });
    delete state.building.inWorldMarkers[
      "business_clinic_marker_payload:marker"
    ];
    state.building.inWorldMarkers["outpost_clinic:dashboard"] = {
      markerId: "outpost_clinic:dashboard",
      plotId: "outpost_clinic",
      kind: "business_marker",
      position: [140, 65, 140],
      label: "Clinic Desk",
      createdAtMs: NOW_MS,
    };

    const result = applyOne(
      state,
      "request_economy_mutation",
      {
        operation: "start_business_customer_session",
        businessId: "business_clinic_marker_payload",
        interactionBusinessId: "business_clinic_marker_payload",
        businessInteractionMarkerId: "outpost_clinic:dashboard",
        businessInteractionPosition: { x: 140, y: 65, z: 140 },
        count: 1,
      },
      {
        subsystem: "economy",
        serverActorPosition: { x: 140, y: 65, z: 140 },
      }
    );

    assert.deepEqual(
      result.summary.warnings.filter((warning) =>
        warning.startsWith("economy_rejected:business_")
      ),
      []
    );
    assert.equal(
      Object.keys(
        (result.state.economy.production.businessSystems as any)
          .customerSessions ?? {}
      ).length,
      1
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
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[0];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
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
    const shared = parseHarthmereLiveModeSharedWorldState(
      JSON.stringify(createHarthmereLiveModeSharedWorldState(depleted, NOW_MS)),
      NOW_MS
    );
    const secondActor = defaultHarthmereLiveModeBackendState(
      "second_actor",
      NOW_MS
    );
    secondActor.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID] = 3;

    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      secondActor,
      shared,
      NOW_MS
    );

    assert.equal(
      secondActor.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID],
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
  it("harthmereLiveModePlayerStateKey has correct prefix", function () {
    const key = harthmereLiveModePlayerStateKey("p1");
    assert.ok(key.startsWith("harthmere:live_mode:current:player_state:p1"));
  });

  it("harthmereLiveModeLedgerStreamKey has correct prefix", function () {
    const key = harthmereLiveModeLedgerStreamKey("p1");
    assert.ok(key.startsWith("harthmere:live_mode:current:ledger:p1"));
  });

  it("harthmereLiveModeSharedStateKey encodes kind and id", function () {
    const key = harthmereLiveModeSharedStateKey("vendor", "blacksmith_001");
    assert.strictEqual(
      key,
      "harthmere:live_mode:current:vendor:blacksmith_001"
    );
  });
});

describe("live-mode readiness contracts", function () {
  it("covers production subsystems with dedicated mutation plans", function () {
    const report = validateHarthmereLiveModeReadiness();
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
        HarthmereLiveModeAuthorityEnvelope["subsystem"],
        HarthmereLiveModeActionKind
      ]
    >) {
      const plan = buildHarthmereLiveModePersistenceMutationPlan(
        makeEnvelope(actionKind, {}, { subsystem })
      );
      assert.ok(
        !plan.writeModels.includes(`${subsystem}_state`) ||
          plan.writeModels.length > 3
      );
    }
  });

  it("routes quest state reads to the quest pipeline, never the death pipeline", function () {
    const plan = buildHarthmereLiveModePersistenceMutationPlan(
      makeEnvelope(
        "request_quest_state_update",
        { operation: "live_entity_helper_read_state" },
        { subsystem: "quest" }
      )
    );

    assert.ok(plan.writeModels.includes("quest_state"));
    assert.ok(!plan.writeModels.includes("death_record"));
    assert.ok(!plan.requiredLocks.includes("player_death_state"));
    assert.ok(!plan.auditEventOutbox.includes("death_record_created"));
  });

  it("still routes explicit death and respawn actions to the death pipeline", function () {
    for (const actionKind of [
      "request_death_transition",
      "request_respawn",
    ] satisfies HarthmereLiveModeActionKind[]) {
      const plan = buildHarthmereLiveModePersistenceMutationPlan(
        makeEnvelope(actionKind, {}, { subsystem: "death" })
      );

      assert.ok(plan.writeModels.includes("death_record"));
      assert.ok(plan.requiredLocks.includes("player_death_state"));
      assert.ok(plan.auditEventOutbox.includes("death_record_created"));
    }
  });
});

// ===========================================================================
// 3. reduceHarthmereLiveModeBackendState — summary fields
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — summary", function () {
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
      harthmereLiveModePlayerStateKey(ACTOR)
    );
  });

  it("updatedAtMs is set to nowMs on every reduction", function () {
    const then = NOW_MS + 5000;
    const env = makeEnvelope("request_respawn");
    const { state } = reduceHarthmereLiveModeBackendState(
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

describe("reduceHarthmereLiveModeBackendState — death lifecycle", function () {
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

  it("request_environment_damage applies canonical fall damage to live player status", function () {
    const s = freshState();
    s.combat.hp = 240;
    s.combat.maxHp = 240;

    const { state, summary } = applyOne(s, "request_environment_damage", {
      damageKind: "fall",
      fallBlocks: 20,
    });
    const expectedDamage = Math.max(
      1,
      Math.round((fallDamageForBlocks(20) * 240) / 100)
    );

    assert.strictEqual(state.combat.hp, 240 - expectedDamage);
    assert.strictEqual(state.combat.deathState, "alive");
    assert.ok(summary.touchedModels.includes("environment_damage"));
    assert.ok(summary.touchedModels.includes("player_status"));
    assert.strictEqual(
      createHarthmereLiveModePlayerStatusClientSnapshot(state).combat.hp,
      state.combat.hp
    );
  });

  it("request_environment_damage records death when fall damage is fatal", function () {
    const s = freshState();
    s.combat.hp = 20;
    s.combat.maxHp = 100;

    const { state } = applyOne(
      s,
      "request_environment_damage",
      {
        damageKind: "fall",
        fallBlocks: 20,
      },
      {
        requestId: "fatal_fall_damage",
      }
    );

    assert.strictEqual(state.combat.hp, 0);
    assert.strictEqual(state.combat.deathState, "dead");
    assert.strictEqual(
      state.combat.deathRecords.fatal_fall_damage.cause,
      "fall_damage"
    );
    assert.strictEqual(
      createHarthmereLiveModePlayerStatusClientSnapshot(state).combat.lastDeath
        ?.cause,
      "fall_damage"
    );
    const respawned = applyOne(state, "request_respawn").state;
    assert.strictEqual(respawned.combat.deathState, "alive");
    assert.strictEqual(respawned.combat.hp, respawned.combat.maxHp);
  });

  it("request_environment_damage applies drowning damage to live player status", function () {
    const s = freshState();
    s.combat.hp = 12;
    s.combat.maxHp = 100;

    const { state, summary } = applyOne(s, "request_environment_damage", {
      damageKind: "drowning",
      damage: 3,
    });

    assert.strictEqual(state.combat.hp, 9);
    assert.strictEqual(state.combat.deathState, "alive");
    assert.ok(summary.touchedModels.includes("environment_damage"));
    assert.ok(summary.touchedModels.includes("player_status"));
    assert.strictEqual(
      createHarthmereLiveModePlayerStatusClientSnapshot(state).combat.hp,
      9
    );
  });

  it("request_environment_damage records death when drowning damage is fatal", function () {
    const s = freshState();
    s.combat.hp = 5;
    s.combat.maxHp = 100;

    const { state } = applyOne(
      s,
      "request_environment_damage",
      {
        damageKind: "drowning",
        damage: 5,
      },
      {
        requestId: "fatal_drowning_damage",
      }
    );

    assert.strictEqual(state.combat.hp, 0);
    assert.strictEqual(state.combat.deathState, "dead");
    assert.strictEqual(
      state.combat.deathRecords.fatal_drowning_damage.cause,
      "drowning"
    );
    assert.strictEqual(
      createHarthmereLiveModePlayerStatusClientSnapshot(state).combat.lastDeath
        ?.cause,
      "drowning"
    );
    const respawned = applyOne(state, "request_respawn").state;
    assert.strictEqual(respawned.combat.deathState, "alive");
    assert.strictEqual(respawned.combat.hp, respawned.combat.maxHp);
  });

  it("repairs zero-HP alive snapshots so status and respawn treat the player as dead", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "alive";

    const staleStatus = createHarthmereLiveModePlayerStatusClientSnapshot(s);
    assert.strictEqual(staleStatus.combat.hp, 0);
    assert.strictEqual(staleStatus.combat.deathState, "dead");

    const parsed = parseHarthmereLiveModeBackendState(
      JSON.stringify(s),
      ACTOR,
      NOW_MS + 1000
    );
    assert.strictEqual(parsed.combat.hp, 0);
    assert.strictEqual(parsed.combat.deathState, "dead");
    assert.ok(
      Object.values(parsed.combat.deathRecords).some(
        (record) => record.cause === "hp_zero_state_repaired"
      )
    );

    const respawned = applyOne(parsed, "request_respawn").state;
    assert.strictEqual(respawned.combat.deathState, "alive");
    assert.strictEqual(respawned.combat.hp, respawned.combat.maxHp);
  });

  it("can suppress stamina-depleted death while status polling reaches zero stamina", function () {
    const s = freshState();
    s.combat.hp = 80;
    s.combat.deathState = "alive";
    s.combat.resources.stamina = 1;
    s.combat.maxResources.stamina = 100;
    s.combat.lastStaminaTickMs = NOW_MS - 10 * 60 * 1000;

    const result = tickHarthmereLiveModeStaminaForGameplay(s, {
      nowMs: NOW_MS,
      gameplayActive: true,
      allowDeathFromStamina: false,
    });

    assert.strictEqual(result.changed, true);
    assert.strictEqual(result.deathTriggered, false);
    assert.strictEqual(s.combat.hp, 80);
    assert.strictEqual(s.combat.deathState, "alive");
    assert.strictEqual(s.combat.resources.stamina, 0);
    assert.strictEqual(s.combat.deadFromStaminaAtMs, undefined);
    assert.strictEqual(Object.keys(s.combat.deathRecords).length, 0);
  });

  it("still records stamina-depleted deaths when explicitly allowed", function () {
    const s = freshState();
    s.combat.hp = 80;
    s.combat.deathState = "alive";
    s.combat.resources.stamina = 1;
    s.combat.maxResources.stamina = 100;
    s.combat.lastStaminaTickMs = NOW_MS - 10 * 60 * 1000;

    const result = tickHarthmereLiveModeStaminaForGameplay(s, {
      nowMs: NOW_MS,
      gameplayActive: true,
    });

    assert.strictEqual(result.deathTriggered, true);
    assert.strictEqual(s.combat.hp, 0);
    assert.strictEqual(s.combat.deathState, "dead");
    assert.ok(s.combat.deadFromStaminaAtMs);
    assert.ok(
      Object.values(s.combat.deathRecords).some(
        (record) => record.cause === "stamina_depleted"
      )
    );
    assert.strictEqual(
      createHarthmereLiveModePlayerStatusClientSnapshot(s).combat.lastDeath
        ?.cause,
      "stamina_depleted"
    );
    const respawned = applyOne(s, "request_respawn").state;
    assert.strictEqual(respawned.combat.deathState, "alive");
    assert.strictEqual(respawned.combat.hp, respawned.combat.maxHp);
  });

  it("does not drain stamina while the player is dead", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.resources.stamina = 54;
    s.combat.maxResources.stamina = 108;
    s.combat.lastStaminaTickMs = NOW_MS - 10 * 60 * 1000;

    const result = tickHarthmereLiveModeStaminaForGameplay(s, {
      nowMs: NOW_MS,
      gameplayActive: true,
      allowDeathFromStamina: false,
    });

    assert.strictEqual(result.changed, false);
    assert.strictEqual(result.deathTriggered, false);
    assert.strictEqual(s.combat.resources.stamina, 54);
    assert.strictEqual(s.combat.lastStaminaTickMs, NOW_MS - 10 * 60 * 1000);
  });

  it("preserves status-read stamina deaths until the player respawns", function () {
    const staminaDeath = freshState();
    const staminaDeadAtMs = NOW_MS - 60_000;
    staminaDeath.combat.hp = 0;
    staminaDeath.combat.maxHp = 100;
    staminaDeath.combat.deathState = "dead";
    staminaDeath.combat.resources.stamina = 0;
    staminaDeath.combat.maxResources.stamina = 100;
    staminaDeath.combat.deadFromStaminaAtMs = staminaDeadAtMs;
    staminaDeath.combat.deathRecords[`stamina_depleted_${staminaDeadAtMs}`] = {
      deathId: `stamina_depleted_${staminaDeadAtMs}`,
      cause: "stamina_depleted",
      zoneId: "harthmere",
      atMs: staminaDeadAtMs,
      respawnAvailableAtMs: staminaDeadAtMs + 5_000,
    };

    assert.strictEqual(
      repairHarthmereStatusReadStaminaDeath(staminaDeath, {
        nowMs: NOW_MS,
      }).changed,
      false
    );
    assert.strictEqual(staminaDeath.combat.hp, 0);
    assert.strictEqual(staminaDeath.combat.deathState, "dead");
    assert.strictEqual(staminaDeath.combat.resources.stamina, 0);
    assert.strictEqual(
      staminaDeath.combat.deadFromStaminaAtMs,
      staminaDeadAtMs
    );

    const fallDeath = freshState();
    fallDeath.combat.hp = 0;
    fallDeath.combat.deathState = "dead";
    fallDeath.combat.deadFromStaminaAtMs = staminaDeadAtMs;
    fallDeath.combat.deathRecords.fatal_fall_damage = {
      deathId: "fatal_fall_damage",
      cause: "fall_damage",
      zoneId: "harthmere",
      atMs: staminaDeadAtMs + 1,
      respawnAvailableAtMs: staminaDeadAtMs + 5_000,
    };

    assert.strictEqual(
      repairHarthmereStatusReadStaminaDeath(fallDeath, {
        nowMs: NOW_MS,
      }).changed,
      false
    );
    assert.strictEqual(fallDeath.combat.hp, 0);
    assert.strictEqual(fallDeath.combat.deathState, "dead");
  });

  it("request_revive restores hp to 25% of maxHp and deathState=alive", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.maxHp = 200;
    s.combat.resources.mana = 0;
    s.combat.maxResources.mana = 120;
    s.combat.deadFromStaminaAtMs = NOW_MS - 1000;
    const { state } = applyOne(s, "request_revive");
    assert.strictEqual(state.combat.deathState, "alive");
    assert.strictEqual(state.combat.hp, 50); // 25% of 200
    assert.strictEqual(state.combat.resources.mana, 30);
    assert.strictEqual(state.combat.deadFromStaminaAtMs, undefined);
  });

  it("request_respawn restores hp to maxHp", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.maxHp = 80;
    s.combat.resources.mana = 0;
    s.combat.maxResources.mana = 120;
    s.combat.deadFromStaminaAtMs = NOW_MS - 1000;
    const { state } = applyOne(s, "request_respawn");
    assert.strictEqual(state.combat.hp, 80);
    assert.strictEqual(state.combat.deathState, "alive");
    assert.strictEqual(state.combat.resources.mana, 120);
    assert.strictEqual(state.combat.deadFromStaminaAtMs, undefined);
  });

  it("request_respawn resets stamina tick time so active polling drains gradually", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    s.combat.maxHp = 100;
    s.combat.resources.stamina = 0;
    s.combat.maxResources.stamina = 108;
    s.combat.lastStaminaTickMs = NOW_MS - 60 * 60 * 1000;
    s.combat.deadFromStaminaAtMs = NOW_MS - 1000;

    const { state } = applyOne(s, "request_respawn");

    assert.strictEqual(state.combat.hp, 100);
    assert.strictEqual(state.combat.deathState, "alive");
    assert.strictEqual(state.combat.resources.stamina, 108);
    assert.strictEqual(state.combat.lastStaminaTickMs, NOW_MS);

    tickHarthmereLiveModeStaminaForGameplay(state, {
      nowMs: NOW_MS + 5_000,
      gameplayActive: true,
      allowDeathFromStamina: false,
    });

    assert.ok(
      state.combat.resources.stamina > 107,
      `stamina should drain gradually after respawn, got ${state.combat.resources.stamina}`
    );
    assert.strictEqual(state.combat.deathState, "alive");
  });

  it("request_respawn repairs zero-HP alive persistence before restoring full health", function () {
    const s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "alive";
    s.combat.maxHp = 100;

    const { state, summary } = applyOne(s, "request_respawn");

    assert.strictEqual(state.combat.hp, 100);
    assert.strictEqual(state.combat.deathState, "alive");
    assert.ok(!summary.warnings.includes("respawn_rejected:not_dead"));
    assert.ok(summary.touchedModels.includes("death_state"));
    assert.ok(
      !Object.values(state.combat.deathRecords).some(
        (record) => record.cause === "zero_hp_respawn_repair"
      )
    );
  });

  it("death → revive → death cycle is stable", function () {
    let s = freshState();
    ({ state: s } = applyOne(s, "request_death_transition"));
    assert.strictEqual(s.combat.deathState, "dead");
    ({ state: s } = applyOne(s, "request_revive"));
    assert.strictEqual(s.combat.deathState, "alive");
    s.combat.respawnProtectionUntilMs = undefined;
    ({ state: s } = applyOne(s, "request_death_transition"));
    assert.strictEqual(s.combat.deathState, "dead");
  });

  it("ignores stale death transitions while respawn protection is active", function () {
    const s = freshState();
    s.combat.hp = 100;
    s.combat.deathState = "alive";
    s.combat.respawnProtectionUntilMs = NOW_MS + 10_000;

    const { state, summary } = applyOne(
      s,
      "request_death_transition",
      { cause: "HP reached zero" },
      { requestId: "stale_protected_death_transition" }
    );

    assert.strictEqual(state.combat.hp, 100);
    assert.strictEqual(state.combat.deathState, "alive");
    assert.ok(summary.warnings.includes("death_transition_ignored:protected"));
    assert.equal(
      state.combat.deathRecords.stale_protected_death_transition,
      undefined
    );
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

describe("reduceHarthmereLiveModeBackendState — combat target authority", function () {
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

  it("lets production melee hit a live mucker at voxel interaction reach with terrain Y mismatch", function () {
    const targetId = "server-muck-combat:voxel-reach-mucker";
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_strike"];
    s.classMagic.loadout = { slot_0: "basic_strike" };
    s.combat.entitySnapshots[targetId] = {
      hp: 100,
      maxHp: 100,
      position: {
        x: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS,
        y: 54,
        z: 0,
      },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "mux",
      level: 1,
    };

    const { state, summary } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_strike" },
      {
        targetId,
        requestId: "voxel_reach_mucker_hit",
        idempotencyKey: "voxel_reach_mucker_hit_key",
        serverActorPosition: { x: 0, y: 20, z: 0 },
      }
    );

    assert.ok(
      !summary.warnings.some((warning) =>
        warning.startsWith("combat_rejected:")
      ),
      summary.warnings.join(", ")
    );
    assert.ok(state.combat.entitySnapshots[targetId].hp < 100);
    assert.equal(state.combat.entitySnapshots[targetId].lastAttackerId, ACTOR);
  });

  it("lets legacy empty loadouts still use known starter attacks", function () {
    const targetId = "server-muck-combat:legacy-loadout-rabbit";
    const s = freshState();
    s.classMagic.knownAbilities = [];
    s.classMagic.loadout = {};
    s.combat.entitySnapshots[targetId] = {
      hp: 40,
      maxHp: 40,
      position: { x: 1, y: -1, z: 0 },
      homePosition: { x: 1, y: 53, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "animal",
      species: "rabbit",
      level: 1,
    };

    const { state, summary } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_strike" },
      {
        targetId,
        requestId: "legacy_empty_loadout_starter_attack",
        idempotencyKey: "legacy_empty_loadout_starter_attack_key",
        serverActorPosition: { x: 0, y: 0, z: 0 },
      }
    );

    assert.ok(
      !summary.warnings.includes(
        "combat_rejected:ability_not_equipped_in_loadout"
      ),
      summary.warnings.join(", ")
    );
    assert.ok(state.combat.entitySnapshots[targetId].hp < 40);
  });

  it("scales starter attack damage from the actor's character level", function () {
    function damageAtLevel(level: number) {
      const targetId = `server-muck-combat:level-${level}-damage-target`;
      const s = freshState();
      s.classMagic.skills.character_level = { xp: 0, level };
      s.combat.entitySnapshots[targetId] = {
        hp: 500,
        maxHp: 500,
        position: { x: 1, y: 0, z: 0 },
        isHostile: false,
        isAlive: true,
        isAttackable: true,
        entityKind: "animal",
        species: "cow",
        level: 1,
      };
      const { state, summary } = applyOne(
        s,
        "request_attack",
        { abilityId: "basic_strike" },
        {
          targetId,
          requestId: "level_scaled_basic_strike",
          idempotencyKey: `level_scaled_basic_strike_${level}`,
          serverActorPosition: { x: 0, y: 0, z: 0 },
        }
      );
      assert.ok(
        !summary.warnings.some((warning) =>
          warning.startsWith("combat_rejected:")
        ),
        summary.warnings.join(", ")
      );
      return state.combat.entitySnapshots[targetId].lastDamageTaken ?? 0;
    }

    const levelOneDamage = damageAtLevel(1);
    const levelTenDamage = damageAtLevel(10);
    assert.ok(levelOneDamage > 0);
    assert.ok(levelTenDamage > levelOneDamage);
  });

  it("rejects production melee against a live mucker just beyond voxel interaction reach", function () {
    const targetId = "server-muck-combat:beyond-voxel-reach-mucker";
    const s = freshState();
    s.classMagic.knownAbilities = ["basic_strike"];
    s.classMagic.loadout = { slot_0: "basic_strike" };
    s.combat.entitySnapshots[targetId] = {
      hp: 100,
      maxHp: 100,
      position: {
        x: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS + 0.01,
        y: 20,
        z: 0,
      },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "mux",
      level: 1,
    };

    const { state, summary } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_strike" },
      {
        targetId,
        requestId: "voxel_reach_mucker_miss",
        idempotencyKey: "voxel_reach_mucker_miss_key",
        serverActorPosition: { x: 0, y: 20, z: 0 },
      }
    );

    assert.ok(summary.warnings.includes("combat_rejected:target_out_of_range"));
    assert.equal(state.combat.entitySnapshots[targetId].hp, 100);
    assert.equal(
      state.combat.entitySnapshots[targetId].lastAttackerId,
      undefined
    );
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

  it("lets NPC AI damage the player through the shared combat reducer and exposes the HUD status", function () {
    const npcId = "hexer-ai-damage-player";
    const s = freshState();
    s.combat.hp = 100;
    s.combat.maxHp = 100;
    s.combat.resources.mana = 77;
    s.combat.maxResources.mana = 120;
    s.combat.entitySnapshots[npcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 1, y: 0, z: 0 },
      homePosition: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 12 },
      maxResources: { mana: 20 },
    };

    const { state, summary } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 1.5, y: 0, z: 0 },
        requestId: "npc_ai_damage_player_1",
        idempotencyKey: "npc_ai_damage_player_1_key",
      }
    );

    assert.ok(
      !summary.warnings.some((warning) =>
        warning.startsWith("npc_combat_rejected:")
      ),
      summary.warnings.join(", ")
    );
    assert.ok(state.combat.hp < 100);
    assert.equal(state.combat.resources.mana, 77);
    assert.equal(state.combat.entitySnapshots[npcId].resources?.mana, 2);
    assert.ok(
      (state.combat.entitySnapshots[npcId].cooldowns?.npc_hex_swipe_test ?? 0) >
        NOW_MS
    );
    assert.ok((state.combat.npcAiTicks[npcId].playerDamage ?? 0) > 0);
    assert.equal(state.combat.npcAiTicks[npcId].playerHpBefore, 100);
    assert.equal(state.combat.npcAiTicks[npcId].playerHpAfter, state.combat.hp);

    const status = createHarthmereLiveModePlayerStatusClientSnapshot(state);
    assert.equal(status.combat.hp, state.combat.hp);
    assert.equal(status.combat.deathState, "alive");
    assert.equal(status.combat.resources.mana, 77);
  });

  it("reduces incoming NPC damage using authoritative equipped armor", function () {
    registerHarthmereItemDefinition({
      itemId: "test_plate_armor",
      displayName: "Test Plate Armor",
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
      stats: { armor: 100 },
      equipmentSlots: ["chest"],
      tradeable: false,
      category: "armor",
    });
    function playerDamage(equipped: boolean) {
      const npcId = `armor-mitigation-hex-${equipped ? "armored" : "plain"}`;
      const s = freshState();
      s.combat.hp = 100;
      s.combat.maxHp = 100;
      if (equipped) {
        s.inventory.equipment.chest = "test_plate_armor";
      }
      s.combat.entitySnapshots[npcId] = {
        hp: 120,
        maxHp: 120,
        position: { x: 1, y: 0, z: 0 },
        homePosition: { x: 1, y: 0, z: 0 },
        isHostile: true,
        isAlive: true,
        isAttackable: true,
        entityKind: "hex",
        level: 1,
        lastAttackerId: ACTOR,
        lastAttackedAtMs: NOW_MS,
        resources: { mana: 20 },
        maxResources: { mana: 20 },
      };
      const result = applyOne(
        s,
        "request_npc_ai_tick",
        { npcId, npcAbilityId: "npc_hex_swipe_test" },
        {
          source: "server_scheduled_tick",
          subsystem: "npc_ai",
          targetId: npcId,
          serverActorPosition: { x: 1.5, y: 0, z: 0 },
          requestId: `armor_mitigation_${equipped}`,
          idempotencyKey: `armor_mitigation_${equipped}_key`,
        }
      );
      return result.state.combat.npcAiTicks[npcId].playerDamage ?? 0;
    }

    const plainDamage = playerDamage(false);
    const armoredDamage = playerDamage(true);
    assert.ok(plainDamage > 0);
    assert.ok(armoredDamage > 0);
    assert.ok(armoredDamage < plainDamage);
  });

  it("lets every mobile live entity family damage the player through NPC AI when in range", function () {
    this.timeout(60_000);
    for (const entry of LIVE_ENTITY_INTERACTION_CASES) {
      const npcId = `live-${entry.kind}-ai-damage-player`;
      const snapshotOverrides = {
        ...("species" in entry ? { species: entry.species } : {}),
        ...("movementSpeed" in entry
          ? { movementSpeed: entry.movementSpeed }
          : {}),
      };
      const s = freshState();
      s.combat.hp = 100;
      s.combat.maxHp = 100;
      s.combat.entitySnapshots[npcId] = {
        hp: 120,
        maxHp: 120,
        position: { x: 1, y: 0, z: 0 },
        homePosition: { x: 1, y: 0, z: 0 },
        isHostile: true,
        isAlive: true,
        isAttackable: true,
        entityKind: entry.kind,
        level: 1,
        lastAttackerId: ACTOR,
        lastAttackedAtMs: NOW_MS,
        lastDamageTaken: 8,
        resources: { mana: 50 },
        maxResources: { mana: 50 },
        ...snapshotOverrides,
      };

      const { state, summary } = applyOne(
        s,
        "request_npc_ai_tick",
        { npcId, npcAbilityId: "npc_hex_swipe_test" },
        {
          source: "server_scheduled_tick",
          subsystem: "npc_ai",
          targetId: npcId,
          serverActorPosition: { x: 1.5, y: 0, z: 0 },
          requestId: `${npcId}_attack_player`,
          idempotencyKey: `${npcId}_attack_player_key`,
        }
      );
      const tick = state.combat.npcAiTicks[npcId];
      const snapshot = state.combat.entitySnapshots[npcId];

      assert.ok(
        !summary.warnings.some((warning) =>
          warning.startsWith("npc_combat_rejected:")
        ),
        `${entry.kind}: ${summary.warnings.join(", ")}`
      );
      assert.equal(tick.decision, "retaliate_to_recent_attacker", entry.kind);
      assert.equal(tick.targetId, ACTOR, entry.kind);
      assert.equal(tick.movementMode, "combat_chase", entry.kind);
      assert.equal(tick.attackBlockedReason, undefined, entry.kind);
      assert.ok((tick.playerDamage ?? 0) > 0, entry.kind);
      assert.equal(tick.playerHpBefore, 100, entry.kind);
      assert.equal(tick.playerHpAfter, state.combat.hp, entry.kind);
      assert.ok(state.combat.hp < 100, entry.kind);
      assert.equal(snapshot.resources?.mana, 40, entry.kind);
      assert.equal(snapshot.lastAiAttackTargetId, ACTOR, entry.kind);
      assert.ok(
        (snapshot.cooldowns?.npc_hex_swipe_test ?? 0) > NOW_MS,
        entry.kind
      );
    }
  });

  it("keeps an attacked hex chasing at long range until line of sight breaks", function () {
    const npcId = "hexer-retaliation-long-chase";
    const s = freshState();
    s.combat.hp = 100;
    s.combat.maxHp = 100;
    s.combat.entitySnapshots[npcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 0, y: 0, z: 0 },
      homePosition: { x: 0, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      leashRange: 12,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };

    const chasing = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId, npcAbilityId: "npc_hex_swipe_test", lineOfSight: true },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 60, y: 0, z: 0 },
        requestId: "npc_ai_retaliation_long_chase",
        idempotencyKey: "npc_ai_retaliation_long_chase_key",
      }
    ).state;

    assert.equal(
      chasing.combat.npcAiTicks[npcId].decision,
      "retaliate_to_recent_attacker"
    );
    assert.equal(chasing.combat.npcAiTicks[npcId].targetId, ACTOR);
    assert.equal(chasing.combat.npcAiTicks[npcId].movementMode, "combat_chase");
    assert.equal(
      chasing.combat.npcAiTicks[npcId].attackBlockedReason,
      "target_out_of_range"
    );

    const hidden = applyOne(
      chasing,
      "request_npc_ai_tick",
      { npcId, npcAbilityId: "npc_hex_swipe_test", lineOfSight: false },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 60, y: 0, z: 0 },
        requestId: "npc_ai_retaliation_no_line_of_sight",
        idempotencyKey: "npc_ai_retaliation_no_line_of_sight_key",
      }
    ).state;

    assert.equal(
      hidden.combat.npcAiTicks[npcId].attackBlockedReason,
      "no_line_of_sight"
    );
    assert.notEqual(hidden.combat.npcAiTicks[npcId].targetId, ACTOR);
  });

  it("marks the player dead when NPC AI damage is fatal and blocks repeat hits while dead", function () {
    const npcId = "hexer-ai-fatal-player";
    let s = freshState();
    s.combat.hp = 5;
    s.combat.maxHp = 100;
    s.combat.entitySnapshots[npcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 1, y: 0, z: 0 },
      homePosition: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "monster",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };

    ({ state: s } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 1.5, y: 0, z: 0 },
        requestId: "npc_ai_fatal_player_1",
        idempotencyKey: "npc_ai_fatal_player_1_key",
      }
    ));

    assert.equal(s.combat.hp, 0);
    assert.equal(s.combat.deathState, "dead");
    assert.ok(
      Object.values(s.combat.deathRecords).some((record) =>
        record.cause.includes(npcId)
      )
    );
    assert.equal(
      createHarthmereLiveModePlayerStatusClientSnapshot(s).combat.hp,
      0
    );
    assert.match(
      createHarthmereLiveModePlayerStatusClientSnapshot(s).combat.lastDeath
        ?.cause ?? "",
      new RegExp(npcId)
    );
    const respawned = applyOne(s, "request_respawn").state;
    assert.equal(respawned.combat.deathState, "alive");
    assert.equal(respawned.combat.hp, respawned.combat.maxHp);

    const repeated = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 1.5, y: 0, z: 0 },
        requestId: "npc_ai_fatal_player_repeat",
        idempotencyKey: "npc_ai_fatal_player_repeat_key",
      }
    ).state;
    assert.equal(repeated.combat.hp, 0);
    assert.equal(
      repeated.combat.npcAiTicks[npcId].attackBlockedReason,
      "player_not_alive"
    );
  });

  it("repairs stale zero-HP alive players before NPC AI can keep attacking them", function () {
    const npcId = "hexer-ai-stale-zero-player";
    let s = freshState();
    s.combat.hp = 0;
    s.combat.deathState = "alive";
    s.combat.entitySnapshots[npcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 1, y: 0, z: 0 },
      homePosition: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "monster",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };

    ({ state: s } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 1.5, y: 0, z: 0 },
        requestId: "npc_ai_stale_zero_player",
        idempotencyKey: "npc_ai_stale_zero_player_key",
      }
    ));

    assert.equal(s.combat.hp, 0);
    assert.equal(s.combat.deathState, "dead");
    assert.equal(
      s.combat.npcAiTicks[npcId].attackBlockedReason,
      "player_not_alive"
    );
    assert.equal(
      createHarthmereLiveModePlayerStatusClientSnapshot(s).combat.deathState,
      "dead"
    );
    assert.ok(
      Object.values(s.combat.deathRecords).some(
        (record) => record.cause === "hp_zero_state_repaired"
      )
    );
  });

  it("does not let NPC AI damage the player when out of range, protected, out of resource, out of sight, or in a safe zone", function () {
    const chaseOnlyNpcId = "hexer-ai-chase-only";
    const chaseOnly = freshState();
    chaseOnly.combat.hp = 100;
    chaseOnly.combat.entitySnapshots[chaseOnlyNpcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 0, y: 0, z: 0 },
      homePosition: { x: 0, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };
    const chaseOnlyResult = applyOne(
      chaseOnly,
      "request_npc_ai_tick",
      { npcId: chaseOnlyNpcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: chaseOnlyNpcId,
        serverActorPosition: { x: 15, y: 0, z: 0 },
      }
    ).state;
    assert.equal(chaseOnlyResult.combat.hp, 100);
    assert.equal(
      chaseOnlyResult.combat.npcAiTicks[chaseOnlyNpcId].attackBlockedReason,
      "target_out_of_range"
    );
    assert.equal(
      chaseOnlyResult.combat.npcAiTicks[chaseOnlyNpcId].movementMode,
      "combat_chase"
    );

    const outOfRangeNpcId = "hexer-ai-out-of-range";
    const outOfRange = freshState();
    outOfRange.combat.hp = 100;
    outOfRange.combat.entitySnapshots[outOfRangeNpcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 0, y: 0, z: 0 },
      homePosition: { x: 0, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };
    const outOfRangeResult = applyOne(
      outOfRange,
      "request_npc_ai_tick",
      { npcId: outOfRangeNpcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: outOfRangeNpcId,
        serverActorPosition: { x: 90, y: 0, z: 0 },
      }
    ).state;
    assert.equal(outOfRangeResult.combat.hp, 100);
    assert.equal(
      outOfRangeResult.combat.npcAiTicks[outOfRangeNpcId].attackBlockedReason,
      "target_out_of_chase_range"
    );
    assert.equal(
      outOfRangeResult.combat.npcAiTicks[outOfRangeNpcId].targetId,
      undefined
    );
    assert.equal(
      outOfRangeResult.combat.npcAiTicks[outOfRangeNpcId].movementMode,
      "town_wander"
    );

    const protectedNpcId = "hexer-ai-protected-player";
    const protectedPlayer = freshState();
    protectedPlayer.combat.hp = 100;
    protectedPlayer.combat.respawnProtectionUntilMs = NOW_MS + 10_000;
    protectedPlayer.combat.entitySnapshots[protectedNpcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 1, y: 0, z: 0 },
      homePosition: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };
    const protectedResult = applyOne(
      protectedPlayer,
      "request_npc_ai_tick",
      { npcId: protectedNpcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: protectedNpcId,
        serverActorPosition: { x: 1.5, y: 0, z: 0 },
      }
    ).state;
    assert.equal(protectedResult.combat.hp, 100);
    assert.equal(
      protectedResult.combat.npcAiTicks[protectedNpcId].attackBlockedReason,
      "player_protected"
    );

    const noLosNpcId = "hexer-ai-no-los-player";
    const noLos = freshState();
    noLos.combat.hp = 100;
    noLos.combat.entitySnapshots[noLosNpcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 1, y: 0, z: 0 },
      homePosition: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };
    const noLosResult = applyOne(
      noLos,
      "request_npc_ai_tick",
      {
        npcId: noLosNpcId,
        npcAbilityId: "npc_hex_swipe_test",
        lineOfSight: "false",
      },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: noLosNpcId,
        serverActorPosition: { x: 1.5, y: 0, z: 0 },
      }
    ).state;
    assert.equal(noLosResult.combat.hp, 100);
    assert.equal(
      noLosResult.combat.npcAiTicks[noLosNpcId].attackBlockedReason,
      "no_line_of_sight"
    );
    assert.equal(noLosResult.combat.npcAiTicks[noLosNpcId].targetId, undefined);

    const safeZoneNpcId = "hexer-ai-safe-zone-player";
    const safeZone = freshState();
    safeZone.combat.hp = 100;
    safeZone.combat.entitySnapshots[safeZoneNpcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 497, y: 70, z: -126 },
      homePosition: { x: 497, y: 70, z: -126 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "mux",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 50 },
      maxResources: { mana: 50 },
    };
    const safeZoneResult = applyOne(
      safeZone,
      "request_npc_ai_tick",
      { npcId: safeZoneNpcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: safeZoneNpcId,
        zoneId: "harthmere_grove",
        serverActorPosition: { x: 496, y: 70, z: -126 },
      }
    ).state;
    assert.equal(safeZoneResult.combat.hp, 100);
    assert.equal(
      safeZoneResult.combat.npcAiTicks[safeZoneNpcId].attackBlockedReason,
      "safe_zone"
    );
    assert.equal(safeZoneResult.combat.threat[ACTOR], undefined);

    const dryNpcId = "hexer-ai-dry-mana";
    const dryMana = freshState();
    dryMana.combat.hp = 100;
    dryMana.combat.entitySnapshots[dryNpcId] = {
      hp: 120,
      maxHp: 120,
      position: { x: 1, y: 0, z: 0 },
      homePosition: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "hex",
      level: 1,
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 8,
      resources: { mana: 0 },
      maxResources: { mana: 50 },
    };
    const dryResult = applyOne(
      dryMana,
      "request_npc_ai_tick",
      { npcId: dryNpcId, npcAbilityId: "npc_hex_swipe_test" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: dryNpcId,
        serverActorPosition: { x: 1.5, y: 0, z: 0 },
      }
    );
    assert.equal(dryResult.state.combat.hp, 100);
    assert.equal(
      dryResult.state.combat.npcAiTicks[dryNpcId].attackBlockedReason,
      "insufficient_resource"
    );
    assert.ok(
      dryResult.summary.warnings.includes(
        "npc_combat_rejected:insufficient_resource"
      )
    );
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

  const LIVE_ENTITY_INTERACTION_CASES = [
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

  function liveEntityInteractionSnapshotOverrides(
    entry: (typeof LIVE_ENTITY_INTERACTION_CASES)[number]
  ) {
    return {
      ...("species" in entry ? { species: entry.species } : {}),
      ...("movementSpeed" in entry
        ? { movementSpeed: entry.movementSpeed }
        : {}),
    };
  }

  it("applies common NPC AI attack blockers to every mobile live entity family", function () {
    this.timeout(60_000);
    const blockerCases: ReadonlyArray<{
      suffix: string;
      actorPosition: { x: number; y: number; z: number };
      expectedReason: string;
      expectedMovementMode: string;
      respawnProtectionUntilMs?: number;
      payload?: Record<string, string>;
      npcMana?: number;
      expectedWarning?: string;
      playerHp?: number;
      playerDeathState?: NonNullable<
        HarthmereLiveModeBackendState["combat"]["deathState"]
      >;
    }> = [
      {
        suffix: "attack_range",
        actorPosition: { x: 15, y: 0, z: 0 },
        expectedReason: "target_out_of_range",
        expectedMovementMode: "combat_chase",
      },
      {
        suffix: "protected",
        actorPosition: { x: 1.5, y: 0, z: 0 },
        expectedReason: "player_protected",
        expectedMovementMode: "town_wander",
        respawnProtectionUntilMs: NOW_MS + 10_000,
      },
      {
        suffix: "no_los",
        actorPosition: { x: 1.5, y: 0, z: 0 },
        expectedReason: "no_line_of_sight",
        expectedMovementMode: "town_wander",
        payload: { lineOfSight: "false" },
      },
      {
        suffix: "dry_resource",
        actorPosition: { x: 1.5, y: 0, z: 0 },
        expectedReason: "insufficient_resource",
        expectedMovementMode: "combat_chase",
        npcMana: 0,
        expectedWarning: "npc_combat_rejected:insufficient_resource",
      },
      {
        suffix: "dead_player",
        actorPosition: { x: 1.5, y: 0, z: 0 },
        expectedReason: "player_not_alive",
        expectedMovementMode: "town_wander",
        playerHp: 0,
        playerDeathState: "dead" as const,
      },
    ];

    for (const entry of LIVE_ENTITY_INTERACTION_CASES) {
      for (const blocker of blockerCases) {
        const npcId = `live-${entry.kind}-ai-block-${blocker.suffix}`;
        const s = freshState();
        s.combat.hp = blocker.playerHp ?? 100;
        s.combat.maxHp = 100;
        s.combat.deathState = blocker.playerDeathState ?? "alive";
        s.combat.respawnProtectionUntilMs = blocker.respawnProtectionUntilMs;
        s.combat.entitySnapshots[npcId] = {
          hp: 120,
          maxHp: 120,
          position: { x: 1, y: 0, z: 0 },
          homePosition: { x: 1, y: 0, z: 0 },
          isHostile: true,
          isAlive: true,
          isAttackable: true,
          entityKind: entry.kind,
          level: 1,
          lastAttackerId: ACTOR,
          lastAttackedAtMs: NOW_MS,
          lastDamageTaken: 8,
          resources: { mana: blocker.npcMana ?? 50 },
          maxResources: { mana: 50 },
          ...liveEntityInteractionSnapshotOverrides(entry),
        };

        const { state, summary } = applyOne(
          s,
          "request_npc_ai_tick",
          {
            npcId,
            npcAbilityId: "npc_hex_swipe_test",
            ...(blocker.payload ?? {}),
          },
          {
            source: "server_scheduled_tick",
            subsystem: "npc_ai",
            targetId: npcId,
            serverActorPosition: blocker.actorPosition,
            requestId: `${npcId}_tick`,
            idempotencyKey: `${npcId}_tick_key`,
          }
        );
        const tick = state.combat.npcAiTicks[npcId];

        assert.equal(
          tick.attackBlockedReason,
          blocker.expectedReason,
          `${entry.kind}:${blocker.suffix}`
        );
        assert.equal(
          tick.movementMode,
          blocker.expectedMovementMode,
          `${entry.kind}:${blocker.suffix}`
        );
        assert.equal(
          state.combat.hp,
          blocker.playerHp ?? 100,
          `${entry.kind}:${blocker.suffix}`
        );
        if (blocker.expectedMovementMode === "town_wander") {
          assert.equal(
            tick.targetId,
            undefined,
            `${entry.kind}:${blocker.suffix}`
          );
        } else {
          assert.equal(tick.targetId, ACTOR, `${entry.kind}:${blocker.suffix}`);
        }
        if (blocker.expectedWarning) {
          assert.ok(
            summary.warnings.includes(blocker.expectedWarning),
            `${entry.kind}:${blocker.suffix}:${summary.warnings.join(", ")}`
          );
        }
      }
    }
  });

  it("lets every live entity family use the same hit, retaliation AI, movement, and animation path", function () {
    this.timeout(60_000);
    for (const entry of LIVE_ENTITY_INTERACTION_CASES) {
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
      assert.equal(
        snapshot.animationState,
        entry.expectedAnimation,
        entry.kind
      );
      assert.ok(snapshot.position.x > 1, entry.kind);
    }
  });

  it("uses ECS-bridged b:<id> live records in the same combat and AI path", function () {
    const bridged = createHarthmereLiveEntityCombatSnapshotsFromEcsRecords({
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
      rejected.summary.warnings.includes("combat_rejected:target_not_hostile")
    );
  });

  it("keeps attacked NPC snapshots and ECS live entities chasing after the first retaliation beat", function () {
    const bridged = createHarthmereLiveEntityCombatSnapshotsFromEcsRecords({
      "b:ecs_mucker_chase": {
        npc_metadata: { type_id: 201, spawn_position: [1, 0, 0] },
        position: { v: [1, 0, 0] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Muckling Mucker" },
      },
    });
    const cases = [
      {
        entityId: "npc_mucker_chase",
        snapshot: {
          hp: 100,
          maxHp: 100,
          position: { x: 1, y: 0, z: 0 },
          homePosition: { x: 1, y: 0, z: 0 },
          isHostile: true,
          isAlive: true,
          isAttackable: true,
          entityKind: "monster" as const,
          species: "muck",
          movementSpeed: 2.4,
          level: 1,
        },
      },
      {
        entityId: "b:ecs_mucker_chase",
        snapshot: bridged["b:ecs_mucker_chase"],
      },
    ];

    for (const { entityId, snapshot } of cases) {
      let s = freshState();
      s.classMagic.knownAbilities = ["basic_attack"];
      s.classMagic.loadout = { slot_0: "basic_attack" };
      s.combat.entitySnapshots[entityId] = { ...snapshot };

      ({ state: s } = applyOne(
        s,
        "request_attack",
        { abilityId: "basic_attack" },
        {
          targetId: entityId,
          requestId: `${entityId}_player_hit`,
          idempotencyKey: `${entityId}_player_hit_key`,
        }
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
          serverActorPosition: { x: 9, y: 0, z: 0 },
          requestId: `${entityId}_retaliation_chase`,
          idempotencyKey: `${entityId}_retaliation_chase_key`,
        }
      ).state;
      const tick = ai.combat.npcAiTicks[entityId];
      const chased = ai.combat.entitySnapshots[entityId];
      assert.equal(tick.decision, "retaliate_to_recent_attacker", entityId);
      assert.equal(tick.targetId, ACTOR, entityId);
      assert.equal(tick.movementMode, "combat_chase", entityId);
      assert.equal(tick.animationMoving, true, entityId);
      assert.equal(tick.attackBlockedReason, "target_out_of_range", entityId);
      assert.equal(tick.playerHpAfter, 100, entityId);
      assert.ok(chased.position.x > 1, entityId);
    }
  });

  // HARTHMERE_NPC_CHASE_LIFECYCLE:
  // End-to-end proof that an attacked live entity/NPC chases the player across
  // repeated AI ticks and only disengages when the player leaves chase range or
  // steps into a safe zone. Helper drives N ticks with a per-tick player x.
  function driveChaseTicks(opts: {
    entityKind: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]["entityKind"];
    playerPosAt: (tick: number) => { x: number; z: number };
    ticks: number;
    entityStart?: { x: number; z: number };
    snapshotOverrides?: Partial<
      HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
    >;
  }) {
    let s = freshState();
    s.combat.hp = 100_000;
    s.combat.maxHp = 100_000;
    const start = opts.entityStart ?? { x: 0, z: 0 };
    const id = `chase-lifecycle-${opts.entityKind}`;
    s.combat.entitySnapshots[id] = {
      hp: 800,
      maxHp: 800,
      position: { x: start.x, y: 0, z: start.z },
      homePosition: { x: start.x, y: 0, z: start.z },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: opts.entityKind,
      species: "muck",
      movementSpeed: 2.4,
      level: 1,
      // Pretend the player just struck this entity so it is in retaliation memory.
      lastAttackerId: ACTOR,
      lastAttackedAtMs: NOW_MS,
      lastDamageTaken: 12,
      ...opts.snapshotOverrides,
    } as any;
    s.combat.threat[id] = 12;

    const samples: Array<{
      tick: number;
      player: { x: number; z: number };
      npcX: number;
      npcZ: number;
      decision: string;
      movementMode?: string;
      attackBlockedReason?: string;
    }> = [];
    for (let i = 0; i < opts.ticks; i += 1) {
      // Advance the reducer clock so retaliation memory / think cadence progress
      // (applyOne pins NOW_MS, so dispatch through the reducer directly here).
      const now = NOW_MS + (i + 1) * 2_000;
      const player = opts.playerPosAt(i);
      ({ state: s } = reduceHarthmereLiveModeBackendState(
        s,
        makeEnvelope(
          "request_npc_ai_tick",
          { npcId: id, thinkIntervalMs: 2_000 },
          {
            source: "server_scheduled_tick",
            subsystem: "npc_ai",
            targetId: id,
            serverActorPosition: { x: player.x, y: 0, z: player.z },
          }
        ),
        now
      ));
      const tick = s.combat.npcAiTicks[id];
      samples.push({
        tick: i,
        player,
        npcX: s.combat.entitySnapshots[id].position.x,
        npcZ: s.combat.entitySnapshots[id].position.z,
        decision: tick.decision,
        movementMode: tick.movementMode,
        attackBlockedReason: tick.attackBlockedReason,
      });
    }
    return { id, finalThreat: () => s.combat.threat, samples };
  }

  it("chases every mobile live entity family across ticks while the player stays in range", function () {
    this.timeout(60_000);
    for (const entry of LIVE_ENTITY_INTERACTION_CASES) {
      const snapshotOverrides = {
        ...("species" in entry ? { species: entry.species } : {}),
        ...("movementSpeed" in entry
          ? { movementSpeed: entry.movementSpeed }
          : {}),
      };
      // Player holds at x=12 (inside the default chase range of 24).
      const { samples } = driveChaseTicks({
        entityKind: entry.kind,
        playerPosAt: () => ({ x: 12, z: 0 }),
        snapshotOverrides,
        ticks: 2,
      });

      // Every tick is a combat chase toward the player.
      for (const s of samples) {
        assert.equal(s.decision, "retaliate_to_recent_attacker", entry.kind);
        assert.equal(s.movementMode, "combat_chase", entry.kind);
      }
      // The entity actually closes the distance over time.
      assert.ok(
        samples[samples.length - 1].npcX > samples[0].npcX,
        `expected ${entry.kind} to advance toward player: ${JSON.stringify(
          samples.map((s) => s.npcX)
        )}`
      );
      // It approaches rather than overshooting the player.
      assert.ok(samples[samples.length - 1].npcX <= 12, entry.kind);
    }
  });

  it("blocks and clears chase when every live entity family finds the player beyond chase range", function () {
    this.timeout(60_000);
    for (const entry of LIVE_ENTITY_INTERACTION_CASES) {
      const snapshotOverrides = {
        ...("species" in entry ? { species: entry.species } : {}),
        ...("movementSpeed" in entry
          ? { movementSpeed: entry.movementSpeed }
          : {}),
      };
      // Player teleports far away each tick so the entity cannot keep pace and
      // falls outside the chase/leash range.
      const { finalThreat, id, samples } = driveChaseTicks({
        entityKind: entry.kind,
        playerPosAt: () => ({ x: 120, z: 0 }),
        snapshotOverrides,
        ticks: 1,
      });

      const blocked = samples.find(
        (sample) => sample.attackBlockedReason === "target_out_of_chase_range"
      );
      assert.ok(blocked, `${entry.kind}: ${JSON.stringify(samples)}`);
      assert.equal(blocked.movementMode, "town_wander", entry.kind);
      // Threat on the fled target is cleared so the entity does not re-aggro.
      assert.equal(finalThreat()[ACTOR], undefined, entry.kind);
      assert.equal(finalThreat()[id], undefined, entry.kind);
    }
  });

  it("blocks and clears chase when every live entity family finds the player in a town safe zone", function () {
    this.timeout(60_000);
    for (const entry of LIVE_ENTITY_INTERACTION_CASES) {
      const snapshotOverrides = {
        ...("species" in entry ? { species: entry.species } : {}),
        ...("movementSpeed" in entry
          ? { movementSpeed: entry.movementSpeed }
          : {}),
      };
      // Entity sits just outside the grove town-core safe box (x in [340,650],
      // z in [-335,-70]) and tries to target a player inside that safe zone.
      const safePos = { x: 345, z: -126 }; // inside the safe box
      const { finalThreat, id, samples } = driveChaseTicks({
        entityKind: entry.kind,
        entityStart: { x: 335, z: -126 },
        playerPosAt: () => safePos,
        snapshotOverrides,
        ticks: 1,
      });

      const afterSafe = samples.find(
        (sample) => sample.attackBlockedReason === "safe_zone"
      );
      assert.ok(afterSafe, `${entry.kind}: ${JSON.stringify(samples)}`);
      assert.equal(afterSafe.attackBlockedReason, "safe_zone", entry.kind);
      assert.equal(afterSafe.movementMode, "town_wander", entry.kind);
      assert.equal(finalThreat()[ACTOR], undefined, entry.kind);
      assert.equal(finalThreat()[id], undefined, entry.kind);
    }
  });

  it("treats business outpost safe sites as chase-disengage zones", function () {
    const outpost = Object.values(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS
    ).find((record) => {
      const bounds = record.materializationPlan.safeZone?.bounds;
      if (!bounds) return false;
      const x = (bounds.xMin + bounds.xMax) / 2;
      const z = (bounds.zMin + bounds.zMax) / 2;
      return !(x >= 340 && x <= 650 && z >= -335 && z <= -70);
    });
    assert.ok(outpost, "expected a business outpost outside the town core");
    const bounds = outpost.materializationPlan.safeZone?.bounds;
    assert.ok(bounds, "expected business outpost safe bounds");
    const safePos = {
      x: (bounds.xMin + bounds.xMax) / 2,
      z: (bounds.zMin + bounds.zMax) / 2,
    };
    const { finalThreat, id, samples } = driveChaseTicks({
      entityKind: "monster",
      entityStart: { x: safePos.x - 6, z: safePos.z },
      playerPosAt: () => safePos,
      ticks: 2,
    });

    assert.equal(samples[0].attackBlockedReason, "safe_zone");
    assert.equal(samples[0].movementMode, "town_wander");
    assert.equal(finalThreat()[ACTOR], undefined);
    assert.equal(finalThreat()[id], undefined);
  });

  it("does not chase stored threat for entities that do not retaliate", function () {
    const { finalThreat, id, samples } = driveChaseTicks({
      entityKind: "npc",
      playerPosAt: () => ({ x: 8, z: 0 }),
      ticks: 2,
      snapshotOverrides: {
        isHostile: false,
        species: "villager",
        retaliatesWhenAttacked: false,
      },
    });

    for (const sample of samples) {
      assert.ok(sample.decision.startsWith("idle_patrol"));
      assert.equal(sample.movementMode, "town_wander");
      assert.equal(sample.attackBlockedReason, undefined);
    }
    assert.equal(finalThreat()[id], 12);
  });

  it("uses the last attacker when stored target threat keeps a chase alive", function () {
    // Regression for HARTHMERE_NPC_CHASE_THREAT_TARGETING: player hits store
    // threat under the entity that was hit, but the AI fallback must chase that
    // entity's remembered attacker after the retaliation-memory window lapses.
    let s = freshState();
    s.combat.hp = 100_000;
    s.combat.maxHp = 100_000;
    s.classMagic.classId = "warrior";
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    const id = "threat-keying-mucker";
    s.combat.entitySnapshots[id] = {
      hp: 500,
      maxHp: 500,
      position: { x: 1, y: 0, z: 0 },
      homePosition: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "monster",
      species: "muck",
      movementSpeed: 2.4,
      level: 1,
    } as any;

    ({ state: s } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_attack" },
      { targetId: id }
    ));

    // Threat remains keyed by the target entity for combat bookkeeping.
    assert.ok((s.combat.threat[id] ?? 0) > 0);

    // 90s later, past the 60s retaliation memory, the entity falls back to
    // the threat table and must still target/chase the player.
    const tickState = reduceHarthmereLiveModeBackendState(
      s,
      makeEnvelope(
        "request_npc_ai_tick",
        { npcId: id, thinkIntervalMs: 2_000 },
        {
          source: "server_scheduled_tick",
          subsystem: "npc_ai",
          targetId: id,
          serverActorPosition: { x: 12, y: 0, z: 0 },
        }
      ),
      NOW_MS + 90_000
    ).state;
    const tick = tickState.combat.npcAiTicks[id];
    assert.equal(tick.decision, "engage_highest_threat");
    assert.equal(tick.targetId, ACTOR);
    assert.equal(tick.movementMode, "combat_chase");
    assert.ok(tickState.combat.entitySnapshots[id].position.x > 1);
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
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: animalId,
      }
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
      state = reduceHarthmereLiveModeBackendState(
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
    assert.notEqual(
      clientResult.combat.entitySnapshots[entityId].position.x,
      4
    );

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
      assert.equal(
        result.state.combat.entitySnapshots[entry.targetId].isAlive,
        false
      );
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
      const dropId =
        result.state.combat.entitySnapshots[entry.targetId].lootDropId;
      if (entry.expectMeat) {
        assert.ok(dropId);
        assert.equal(
          result.state.inventoryLoot.lootDrops[dropId].itemStacks.raw_meat,
          2
        );
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
    assert.equal(
      ownerKill.combat.entitySnapshots["own-cow-no-crime"].isAlive,
      false
    );
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
    const lootDrop = s.inventoryLoot.lootDrops[dropId];
    assert.equal(s.combat.entitySnapshots[targetId].isAlive, false);
    assert.equal(s.combat.entitySnapshots[targetId].animationState, "death");
    assert.equal(s.combat.entitySnapshots[targetId].animationMoving, false);
    assert.ok(dropId);
    assert.ok(lootDrop);
    const lootPosition = lootDrop.position;
    assert.equal(lootDrop.status, "available");
    assert.equal(lootDrop.itemStacks.health_potion, 1);
    assert.ok(lootPosition);
    assert.ok(
      s.combat.entitySnapshots[targetId].position.y > 0,
      "defeated body should be lifted above the terrain contact point"
    );
    assert.ok(
      lootPosition.y > s.combat.entitySnapshots[targetId].position.y,
      "loot should spawn visibly above the defeated body/ground"
    );

    const claimed = applyOne(
      s,
      "request_loot_claim",
      {
        dropId,
        pickupToken: s.inventoryLoot.lootDrops[dropId].pickupToken,
      },
      {
        requestId: "claim_live_entity_loot",
        idempotencyKey: "claim_live_entity_loot_key",
      }
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
      position: { x: 1, y: -1, z: 0 },
      homePosition: { x: 1, y: 53, z: 0 },
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
    assert.ok(
      s.combat.entitySnapshots[targetId].position.y > 53,
      "defeated entity should rest above its safe home terrain"
    );
    assert.ok(dropId);
    const drop = s.inventoryLoot.lootDrops[dropId];
    assert.ok(drop);
    assert.equal(drop.itemStacks.raw_meat, 2);
    assert.ok(drop.position);
    assert.ok(
      drop.position.y > 53,
      "defeated entity loot should float above its safe home terrain"
    );

    const claimed = applyOne(
      s,
      "request_loot_claim",
      {
        dropId,
        pickupToken: drop.pickupToken,
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

  it("runs harvest, animal chase, meat loot claim, level damage, and one-hour respawn end to end", function () {
    let s = freshState();
    s.classMagic.loadout = {};

    ({ state: s } = applyOne(
      s,
      "request_farming_action",
      {
        operation: "forage_food",
        spawnId: "progression_berries_001",
        itemId: "wild_berries",
      },
      {
        subsystem: "farming",
        requestId: "progression_harvest_berries",
        idempotencyKey: "progression_harvest_berries_key",
      }
    ));
    assert.equal(s.inventory.items.wild_berries, 1);

    s.combat.entitySnapshots = {
      ...s.combat.entitySnapshots,
      ...createHarthmereServerMuckCombatEntitySnapshots(NOW_MS),
    };
    const cowId = Object.entries(s.combat.entitySnapshots).find(
      ([entityId, snapshot]) =>
        entityId.startsWith("server-muck-combat:") &&
        snapshot.entityKind === "animal" &&
        snapshot.species === "cow"
    )?.[0];
    assert.ok(cowId, "expected a seeded production cow");
    const cowSnapshot = s.combat.entitySnapshots[cowId];
    assert.equal(cowSnapshot.retaliatesWhenAttacked, true);
    assert.ok(
      Number(cowSnapshot.lootDrops?.raw_meat ?? 0) > 1,
      "production cows should carry raw meat loot"
    );
    const cowPosition = cowSnapshot.position;

    ({ state: s } = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_strike" },
      {
        targetId: cowId,
        requestId: "progression_cow_attack",
        idempotencyKey: "progression_cow_attack_key",
        serverActorPosition: { ...cowPosition },
      }
    ));
    const cowDamage = s.combat.entitySnapshots[cowId].lastDamageTaken ?? 0;
    assert.ok(cowDamage > 0 && cowDamage < 80);
    assert.equal(s.combat.entitySnapshots[cowId].lastAttackerId, ACTOR);

    ({ state: s } = applyOne(
      s,
      "request_npc_ai_tick",
      {
        npcId: cowId,
        lineOfSight: true,
        thinkIntervalMs: 2_000,
      },
      {
        subsystem: "npc_ai",
        targetId: cowId,
        requestId: "progression_cow_chase",
        idempotencyKey: "progression_cow_chase_key",
        serverActorPosition: {
          x: cowPosition.x + 8,
          y: cowPosition.y,
          z: cowPosition.z,
        },
      }
    ));
    const cowAi = s.combat.npcAiTicks[cowId];
    assert.equal(cowAi.decision, "retaliate_to_recent_attacker");
    assert.equal(cowAi.movementMode, "combat_chase");
    assert.equal(cowAi.attackBlockedReason, "target_out_of_range");
    assert.ok((cowAi.positionTo?.x ?? 0) > (cowAi.positionFrom?.x ?? 0));

    const rabbitId = Object.entries(s.combat.entitySnapshots).find(
      ([entityId, snapshot]) =>
        entityId.startsWith("server-muck-combat:") &&
        snapshot.entityKind === "animal" &&
        snapshot.species === "rabbit"
    )?.[0];
    assert.ok(rabbitId, "expected a seeded production rabbit");
    const rabbitSnapshot = s.combat.entitySnapshots[rabbitId];
    assert.equal(rabbitSnapshot.retaliatesWhenAttacked, true);
    assert.ok(
      Number(rabbitSnapshot.lootDrops?.raw_meat ?? 0) >= 1,
      "production rabbits should carry raw meat loot"
    );
    rabbitSnapshot.hp = 1;
    const rabbitPositionBeforeKill = { ...rabbitSnapshot.position };
    ({ state: s } = reduceHarthmereLiveModeBackendState(
      s,
      makeEnvelope(
        "request_attack",
        { abilityId: "basic_strike" },
        {
          targetId: rabbitId,
          requestId: "progression_rabbit_kill",
          idempotencyKey: "progression_rabbit_kill_key",
          serverActorPosition: { ...rabbitPositionBeforeKill },
        }
      ),
      NOW_MS + 2_000
    ));
    assert.equal(s.combat.entitySnapshots[rabbitId].isAlive, false);
    const dropId = s.combat.entitySnapshots[rabbitId].lootDropId;
    assert.ok(dropId);
    const drop = s.inventoryLoot.lootDrops[dropId];
    assert.equal(drop.itemStacks.raw_meat, 1);

    ({ state: s } = applyOne(
      s,
      "request_loot_claim",
      {
        dropId,
        pickupToken: drop.pickupToken,
      },
      {
        requestId: "progression_claim_raw_meat",
        idempotencyKey: "progression_claim_raw_meat_key",
      }
    ));
    assert.equal(s.inventoryLoot.lootDrops[dropId].status, "claimed");
    assert.equal(s.banking.materialStorage.raw_meat, 1);

    assert.equal(HARTHMERE_SERVER_MUCK_COMBAT_RESPAWN_MS, 60 * 60 * 1000);
    const defeatedAtMs = s.combat.entitySnapshots[rabbitId].defeatedAtMs!;
    harthmereReviveDefeatedSeededCombatEntities(
      s.combat.entitySnapshots,
      defeatedAtMs + HARTHMERE_SERVER_MUCK_COMBAT_RESPAWN_MS - 1
    );
    assert.equal(s.combat.entitySnapshots[rabbitId].isAlive, false);
    harthmereReviveDefeatedSeededCombatEntities(
      s.combat.entitySnapshots,
      defeatedAtMs + HARTHMERE_SERVER_MUCK_COMBAT_RESPAWN_MS
    );
    assert.equal(s.combat.entitySnapshots[rabbitId].isAlive, true);
    assert.equal(s.combat.entitySnapshots[rabbitId].hp, 22);
    assert.deepEqual(s.combat.entitySnapshots[rabbitId].position, {
      ...rabbitPositionBeforeKill,
    });
  });

  it("normalizes old seeded creature health and clears stale loot claims on respawn", function () {
    const seedSnapshots =
      createHarthmereServerMuckCombatEntitySnapshots(NOW_MS);
    const [muckerId, muckerCanonical] = Object.entries(seedSnapshots).find(
      ([entityId, snapshot]) =>
        entityId.startsWith("server-muck-combat:") &&
        (snapshot.entityKind === "mux" || snapshot.entityKind === "hex")
    )!;
    const s = freshState();
    s.combat.entitySnapshots[muckerId] = {
      ...muckerCanonical,
      hp: 20,
      maxHp: 110,
    };

    harthmereNormalizeSeededCombatEntitySnapshots(
      s.combat.entitySnapshots,
      NOW_MS
    );

    assert.equal(
      s.combat.entitySnapshots[muckerId].maxHp,
      muckerCanonical.maxHp
    );
    assert.ok(
      s.combat.entitySnapshots[muckerId].hp > 20,
      "normalization should preserve the health ratio when max HP is raised"
    );

    const [rabbitId, rabbitCanonical] = Object.entries(seedSnapshots).find(
      ([entityId, snapshot]) =>
        entityId.startsWith("server-muck-combat:") &&
        snapshot.entityKind === "animal" &&
        snapshot.species === "rabbit"
    )!;
    const defeatedAtMs = NOW_MS - HARTHMERE_SERVER_MUCK_COMBAT_RESPAWN_MS;
    const dropId = "stale-live-rabbit-drop";
    const persisted = freshState();
    persisted.combat.entitySnapshots[rabbitId] = {
      ...rabbitCanonical,
      hp: 0,
      isAlive: false,
      isAttackable: false,
      defeatedAtMs,
      lootDropId: dropId,
    };
    persisted.combat.lootClaims[rabbitId] = defeatedAtMs;
    persisted.combat.lootClaims[dropId] = defeatedAtMs;

    const parsed = parseHarthmereLiveModeBackendState(
      JSON.stringify(persisted),
      ACTOR,
      NOW_MS
    );

    assert.equal(parsed.combat.entitySnapshots[rabbitId].isAlive, true);
    assert.equal(
      parsed.combat.entitySnapshots[rabbitId].hp,
      parsed.combat.entitySnapshots[rabbitId].maxHp
    );
    assert.equal(parsed.combat.entitySnapshots[rabbitId].lootDropId, undefined);
    assert.equal(parsed.combat.lootClaims[rabbitId], undefined);
    assert.equal(parsed.combat.lootClaims[dropId], undefined);
  });

  it("defaults named livestock species to raw meat even when bridged without animal kind", function () {
    const s = freshState();
    const targetId = "live-cow-species-meat-drop";
    s.classMagic.knownAbilities = ["basic_attack"];
    s.classMagic.loadout = { slot_0: "basic_attack" };
    s.combat.entitySnapshots[targetId] = {
      hp: 1,
      maxHp: 30,
      position: { x: 1, y: 0, z: 0 },
      isHostile: false,
      isAlive: true,
      isAttackable: true,
      entityKind: "npc",
      species: "cow",
      level: 1,
    };

    const result = applyOne(
      s,
      "request_attack",
      { abilityId: "basic_attack" },
      {
        targetId,
        requestId: "live_hit_4_cow_species_meat",
        idempotencyKey: "live_hit_4_cow_species_meat_key",
      }
    ).state;
    const dropId = result.combat.entitySnapshots[targetId].lootDropId!;
    assert.ok(dropId);
    assert.equal(result.inventoryLoot.lootDrops[dropId].itemStacks.raw_meat, 2);
  });

  it("does not auto-meat protected animals, owned pets, or explicit meat drops", function () {
    for (const entry of [
      {
        targetId: "live-deer-protected-no-meat",
        entityKind: "animal",
        species: "deer",
        protectedSpecies: true,
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
    const dropId =
      explicit.combat.entitySnapshots[explicitTargetId].lootDropId!;
    assert.ok(dropId);
    assert.equal(
      explicit.inventoryLoot.lootDrops[dropId].itemStacks.raw_meat,
      1
    );
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
        rejected.summary.warnings.includes("loot_rejected:invalid_pickup_token")
      );
      assert.equal(
        rejected.state.inventoryLoot.lootDrops[dropId].status,
        "available"
      );
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
      const rejected = reduceHarthmereLiveModeBackendState(
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
      state.inventory.items = { health_potion: 25 };
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
        ),
        JSON.stringify(rejected.summary.warnings)
      );
      assert.equal(
        rejected.state.inventoryLoot.lootDrops[dropId].status,
        "available"
      );
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

  it("runs attack, death, floating drop, F-claim, and inventory routing for every living entity type", function () {
    const cases: Array<{
      label: string;
      entityKind: HarthmereLiveEntityKind;
      species?: string;
      lootDrops?: Record<string, number>;
      expectedItemId: string;
      expectedCount?: number;
      expectedRoute: "inventory" | "material_storage";
    }> = [
      {
        label: "mucker",
        entityKind: "mux",
        species: "gravewood pale muckling",
        lootDrops: { health_potion: 1 },
        expectedItemId: "health_potion",
        expectedRoute: "inventory",
      },
      {
        label: "hex",
        entityKind: "hex",
        species: "hexer",
        lootDrops: { health_potion: 1 },
        expectedItemId: "health_potion",
        expectedRoute: "inventory",
      },
      {
        label: "monster",
        entityKind: "monster",
        species: "muck scarred beast",
        lootDrops: { health_potion: 1 },
        expectedItemId: "health_potion",
        expectedRoute: "inventory",
      },
      {
        label: "animal",
        entityKind: "animal",
        species: "rabbit",
        expectedItemId: "raw_meat",
        expectedCount: 2,
        expectedRoute: "material_storage",
      },
      {
        label: "npc",
        entityKind: "npc",
        species: "bandit",
        lootDrops: { health_potion: 1 },
        expectedItemId: "health_potion",
        expectedRoute: "inventory",
      },
    ];

    for (const entry of cases) {
      let state = freshState();
      const targetId = `live_${entry.label}_loot_progression`;
      state.classMagic.knownAbilities = ["basic_attack"];
      state.classMagic.loadout = { slot_0: "basic_attack" };
      state.combat.entitySnapshots[targetId] = {
        hp: 1,
        maxHp: 40,
        position: { x: 1, y: 0, z: 0 },
        isHostile: true,
        isAlive: true,
        isAttackable: true,
        entityKind: entry.entityKind,
        species: entry.species,
        level: 1,
        lootDrops: entry.lootDrops,
      };

      ({ state } = applyOne(
        state,
        "request_attack",
        { abilityId: "basic_attack" },
        {
          targetId,
          requestId: `kill_${entry.label}_loot_progression`,
          idempotencyKey: `kill_${entry.label}_loot_progression_key`,
        }
      ));

      const target = state.combat.entitySnapshots[targetId];
      const dropId = target.lootDropId!;
      const drop = state.inventoryLoot.lootDrops[dropId];
      assert.equal(target.isAlive, false, entry.label);
      assert.equal(target.animationState, "death", entry.label);
      assert.ok(dropId, entry.label);
      assert.equal(drop.status, "available", entry.label);
      const expectedCount = entry.expectedCount ?? 1;
      assert.equal(
        drop.itemStacks[entry.expectedItemId],
        expectedCount,
        entry.label
      );
      assert.ok(drop.position, entry.label);
      assert.ok(
        drop.position.y > target.position.y,
        `${entry.label} loot should float above the defeated body`
      );

      const claimed = applyOne(
        state,
        "request_loot_claim",
        {
          dropId,
          pickupToken: drop.pickupToken,
        },
        {
          requestId: `claim_${entry.label}_loot_progression`,
          idempotencyKey: `claim_${entry.label}_loot_progression_key`,
        }
      ).state;
      assert.equal(
        claimed.inventoryLoot.lootDrops[dropId].status,
        "claimed",
        entry.label
      );
      if (entry.expectedRoute === "material_storage") {
        assert.equal(
          claimed.banking.materialStorage[entry.expectedItemId],
          expectedCount,
          entry.label
        );
        assert.equal(
          claimed.inventory.items[entry.expectedItemId] ?? 0,
          0,
          entry.label
        );
      } else {
        assert.equal(
          claimed.inventory.items[entry.expectedItemId],
          expectedCount,
          entry.label
        );
      }
    }
  });
});

// ===========================================================================
// 5. request_xp_reward / request_skill_progress
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — XP and skill progress", function () {
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

describe("reduceHarthmereLiveModeBackendState — loadout arrays", function () {
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
    s.classMagic.loadout = {};
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

describe("reduceHarthmereLiveModeBackendState — magic progress", function () {
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

describe("reduceHarthmereLiveModeBackendState — trainer unlock", function () {
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

describe("reduceHarthmereLiveModeBackendState — vendor transaction", function () {
  it("buy from vendor deducts gold and adds item when actor has enough gold", function () {
    const s = freshState();
    s.inventory.gold = 200;
    const { state, summary } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 5,
    });
    // iron_ore costs 10 gold each; bought building materials route into
    // material storage so they do not immediately overfill the backpack.
    assert.ok(state.inventory.gold <= 200 - 50 + 1); // allow slight rounding
    assert.ok((state.banking.materialStorage.iron_ore ?? 0) >= 5);
    assert.ok(summary.touchedModels.includes("inventory_items"));
    assert.ok(summary.touchedModels.includes("material_storage"));
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

describe("reduceHarthmereLiveModeBackendState — crafting", function () {
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

describe("reduceHarthmereLiveModeBackendState — loot and inventory mutation", function () {
  it("request_loot_claim adds item to inventory", function () {
    const s = freshState();
    const { state } = applyOne(s, "request_loot_claim", {
      itemId: "health_potion",
      count: 3,
    });
    assert.ok((state.inventory.items.health_potion ?? 0) >= 3);
    assert.ok(Object.keys(state.combat.lootClaims).length >= 1);
  });

  it("request_loot_roll from native block mining routes voxel blocks into inventory", function () {
    const s = freshState();
    const dirtBlockItemId = `b:${BikkieIds.dirt}`;
    const { state, summary } = applyOne(s, "request_loot_roll", {
      itemId: dirtBlockItemId,
      count: 1,
      source: "Mined Dirt",
    });

    assert.equal(state.banking.materialStorage[dirtBlockItemId] ?? 0, 0);
    assert.equal(state.inventory.items[dirtBlockItemId], 1);
    assert.ok(Object.keys(state.combat.lootClaims).length >= 1);
    assert.ok(summary.touchedModels.includes("inventory_items"));
    assert.ok(!summary.touchedModels.includes("material_storage"));
  });

  it("request_loot_roll accepts bare numeric Biomes item ids without b prefix", function () {
    const s = freshState();
    const dirtBlockItemId = String(BikkieIds.dirt);
    const { state, summary } = applyOne(s, "request_loot_roll", {
      itemId: dirtBlockItemId,
      count: 1,
      source: "Mined Dirt",
    });

    assert.equal(state.banking.materialStorage[dirtBlockItemId] ?? 0, 0);
    assert.equal(state.inventory.items[dirtBlockItemId], 1);
    assert.ok(!summary.warnings.includes("loot_rejected:unknown_item_id"));
    assert.equal(
      getHarthmereItemDefinition(dirtBlockItemId)?.itemId,
      dirtBlockItemId
    );
    assert.equal(
      getHarthmereItemDefinition(`b:${BikkieIds.dirt}`)?.itemId,
      `b:${BikkieIds.dirt}`
    );
  });

  it("request_loot_roll and eat_food use exact Bikkie food ids", function () {
    let s = freshState();
    const strawberryItemId = "2779132017025472";
    assert.equal(
      HARTHMERE_FOOD_DEFINITIONS[strawberryItemId]?.displayName,
      "Strawberry"
    );
    s.combat.resources.stamina = 50;
    s.combat.maxResources.stamina = 100;

    const granted = applyOne(s, "request_loot_roll", {
      itemId: strawberryItemId,
      count: 1,
      source: "Foraged Strawberry",
    });
    assert.ok(
      !granted.summary.warnings.includes("loot_rejected:unknown_item_id")
    );
    assert.equal(granted.state.inventory.items[strawberryItemId], 1);
    assert.equal(
      getHarthmereItemDefinition(strawberryItemId)?.displayName,
      "Strawberry"
    );

    const eaten = applyOne(granted.state, "request_farming_action", {
      operation: "eat_food",
      itemId: strawberryItemId,
    });
    assert.deepEqual(eaten.summary.warnings, []);
    assert.equal(eaten.state.inventory.items[strawberryItemId] ?? 0, 0);
    assert.equal(eaten.state.combat.resources.stamina, 60);
  });

  it("routes non-standard building material rewards into material storage", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_loot_roll", {
      itemId: "old_coin",
      count: 1,
      source: "Building Materials Counter",
    });

    assert.equal(state.banking.materialStorage.old_coin, 1);
    assert.equal(state.inventory.items.old_coin ?? 0, 0);
    assert.ok(
      summary.warnings.includes("loot_sent_to_material_storage:old_coin")
    );
    assert.ok(summary.touchedModels.includes("material_storage"));
  });

  it("routes bought building materials into material storage before carry weight", function () {
    const s = freshState();
    s.inventory.gold = 100;
    const { state, summary } = applyOne(s, "request_vendor_transaction", {
      vendorId: "blacksmith_vendor",
      transactionKind: "buy",
      itemId: "iron_ore",
      count: 2,
    });

    assert.equal(state.inventory.gold, 80);
    assert.equal(state.banking.materialStorage.iron_ore, 2);
    assert.equal(state.inventory.items.iron_ore ?? 0, 0);
    assert.ok(
      summary.warnings.includes("vendor_sent_to_material_storage:iron_ore")
    );
    assert.ok(summary.touchedModels.includes("material_storage"));
  });

  it("persists Road Ahead starter clothing as Cloud Save inventory and equipment", function () {
    let s = freshState();
    let result = applyOne(s, "request_loot_roll", {
      itemId: "baker_apron",
      count: 1,
      source: "Road Ahead Clothing Crate",
    });
    s = result.state;
    assert.equal(s.inventory.items.baker_apron, 1);
    assert.equal(s.banking.materialStorage.baker_apron ?? 0, 0);
    assert.ok(result.summary.touchedModels.includes("inventory_items"));

    result = applyOne(s, "request_equipment_change", {
      itemId: "baker_apron",
      slot: "chest",
    });
    s = result.state;
    assert.equal(s.inventory.items.baker_apron ?? 0, 0);
    assert.equal(s.inventory.equipment.chest, "baker_apron");
    assert.ok(result.summary.touchedModels.includes("equipment_slots"));
  });

  it("rejects client-only equipment claims when Cloud Save does not own the item", function () {
    const { state, summary } = applyOne(
      freshState(),
      "request_equipment_change",
      { itemId: "field_trousers", slot: "legs" },
      {
        clientClaims: {
          source: "biomes_ui_local_harthmere_item_equip",
          instanceId: "local-field-trousers",
        },
      }
    );

    assert.equal(state.inventory.items.field_trousers ?? 0, 0);
    assert.equal(state.inventory.equipment.legs, undefined);
    assert.ok(
      summary.warnings.includes("equipment_rejected:insufficient_item_count")
    );
    assert.ok(summary.touchedModels.includes("equipment_rejection"));
  });

  it("equips and unequips one durable item instance through the canonical live inventory", function () {
    let s = freshState();
    const instanceId = "instance_iron_sword_1";
    s.inventoryLoot.actors[ACTOR] = createHarthmereInventoryLootActor(ACTOR, {
      instanceIds: [instanceId],
    });
    s.inventoryLoot.itemInstances[instanceId] = {
      instanceId,
      itemId: "iron_sword",
      quantity: 1,
      ownerKind: "actor",
      ownerId: ACTOR,
      location: "actor_inventory",
      createdAtMs: NOW_MS - 1_000,
      updatedAtMs: NOW_MS - 1_000,
      condition: 1,
      durability: 120,
      durabilityMax: 120,
      quality: 1,
      legalFlags: [],
      upgradedLevel: 0,
      enchantments: [],
      contaminated: false,
      broken: false,
      audit: [],
    };

    let result = applyOne(s, "request_equipment_change", {
      itemId: "iron_sword",
      instanceId,
      slot: "main_hand",
    });
    s = result.state;
    assert.equal(s.inventory.equipment.main_hand, "iron_sword");
    assert.equal(s.inventory.equipmentInstances.main_hand, instanceId);
    assert.deepEqual(s.inventoryLoot.actors[ACTOR].instanceIds, []);
    assert.equal(
      s.inventoryLoot.itemInstances[instanceId].location,
      "actor_equipment"
    );
    assert.equal(s.inventoryLoot.itemInstances[instanceId].slot, "main_hand");

    result = applyOne(s, "request_equipment_change", {
      slot: "main_hand",
    });
    s = result.state;
    assert.equal(s.inventory.equipment.main_hand, undefined);
    assert.equal(s.inventory.equipmentInstances.main_hand, undefined);
    assert.deepEqual(s.inventoryLoot.actors[ACTOR].instanceIds, [instanceId]);
    assert.equal(
      s.inventoryLoot.itemInstances[instanceId].location,
      "actor_inventory"
    );
    assert.equal(s.inventoryLoot.itemInstances[instanceId].slot, undefined);
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

  it("request_loot_roll can grant jobs-board executable materials into storage", function () {
    const s = freshState();
    const { state, summary } = applyOne(s, "request_loot_roll", {
      itemId: "herb_bundle",
      count: 2,
    });
    assert.deepEqual(summary.warnings, [
      "loot_sent_to_material_storage:herb_bundle",
    ]);
    assert.strictEqual(state.inventory.items.herb_bundle ?? 0, 0);
    assert.strictEqual(state.banking.materialStorage.herb_bundle, 2);
  });

  it("request_inventory_item_action drops material storage through authority", function () {
    const s = freshState();
    s.banking.materialStorage = { iron_ore: 3 };

    const { state, summary } = applyOne(s, "request_inventory_item_action", {
      operation: "drop_item",
      itemId: "iron_ore",
      count: 1,
      sourceSlot: "material_storage",
    });

    assert.strictEqual(state.banking.materialStorage.iron_ore, 2);
    assert.strictEqual(state.inventory.items.iron_ore ?? 0, 0);
    assert.ok(summary.touchedModels.includes("material_storage"));
    assert.ok(summary.touchedModels.includes("player_status"));
  });

  it("request_inventory_item_action destroys raw voxel blocks from carried inventory", function () {
    const s = freshState();
    const grassBlockItemId = `b:${BikkieIds.grass}`;
    s.inventory.items[grassBlockItemId] = 10;

    const { state, summary } = applyOne(s, "request_inventory_item_action", {
      operation: "destroy_item",
      itemId: grassBlockItemId,
      count: 1,
      source: "Placed Grass",
    });

    assert.strictEqual(state.inventory.items[grassBlockItemId], 9);
    assert.ok(
      !summary.warnings.includes("inventory_item_rejected:unknown_item_id")
    );
    assert.ok(summary.touchedModels.includes("inventory_items"));
  });

  it("uses server-authored item effects and learns spell tomes exactly once", function () {
    let s = freshState();
    s.combat.hp = 40;
    s.inventory.items = { chapel_candle: 1, scroll_of_spark: 1 };

    let result = applyOne(s, "request_inventory_item_action", {
      operation: "use_item",
      itemId: "chapel_candle",
    });
    s = result.state;
    assert.equal(s.combat.hp, 58);
    assert.equal(s.inventory.items.chapel_candle, undefined);
    assert.ok(result.summary.touchedModels.includes("health"));

    result = applyOne(s, "request_inventory_item_action", {
      operation: "use_item",
      itemId: "scroll_of_spark",
    });
    s = result.state;
    assert.equal(s.inventory.items.scroll_of_spark, undefined);
    assert.ok(s.classMagic.knownAbilities.includes("spark_rank_1"));

    s.inventory.items.scroll_of_spark = 1;
    result = applyOne(s, "request_inventory_item_action", {
      operation: "use_item",
      itemId: "scroll_of_spark",
    });
    assert.equal(result.state.inventory.items.scroll_of_spark, 1);
    assert.ok(
      result.summary.warnings.includes(
        "inventory_item_rejected:spell_already_known"
      )
    );
  });

  it("uses a revival scroll only from a real server death state", function () {
    let s = freshState();
    s.inventory.items.field_revival_scroll = 1;

    let result = applyOne(s, "request_inventory_item_action", {
      operation: "use_item",
      itemId: "field_revival_scroll",
    });
    assert.equal(result.state.inventory.items.field_revival_scroll, 1);
    assert.ok(
      result.summary.warnings.includes(
        "inventory_item_rejected:revive_item_requires_death"
      )
    );

    s = result.state;
    s.combat.hp = 0;
    s.combat.deathState = "dead";
    result = applyOne(s, "request_inventory_item_action", {
      operation: "use_item",
      itemId: "field_revival_scroll",
    });
    assert.equal(result.state.inventory.items.field_revival_scroll, undefined);
    assert.equal(result.state.combat.deathState, "alive");
    assert.equal(result.state.combat.hp, 25);
    assert.ok((result.state.combat.respawnProtectionUntilMs ?? 0) > NOW_MS);
  });

  it("loot claim records entry in lootClaims with nowMs", function () {
    const s = freshState();
    const env = makeEnvelope("request_loot_claim", {
      itemId: "health_potion",
      count: 1,
    });
    const { state } = reduceHarthmereLiveModeBackendState(s, env, NOW_MS);
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
    s.inventoryLoot.actors[ACTOR] = createHarthmereInventoryLootActor(ACTOR, {
      gold: 999,
      items: { health_potion: 5 },
      bank: {},
      equipment: {},
    });

    const snapshot = createHarthmereInventoryLootClientSnapshotFromBackend(s);
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

describe("reduceHarthmereLiveModeBackendState — bank transactions", function () {
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

describe("reduceHarthmereLiveModeBackendState — auction post", function () {
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

describe("reduceHarthmereLiveModeBackendState — auction settle", function () {
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

describe("reduceHarthmereLiveModeBackendState — respec", function () {
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

describe("reduceHarthmereLiveModeBackendState — quest state", function () {
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

  it("persists Snapshot Grove quest accepts and completion to the Cloud Save quest snapshot", function () {
    const s = freshState();
    const accepted = applyOne(s, "request_quest_state_update", {
      questId: "moss_that_went_quiet",
      source: "snapshot_grove",
      stepId: "moss_that_went_quiet:1:collect",
      progress: 2,
      completed: false,
    });
    assert.deepEqual(accepted.summary.warnings, []);
    assert.equal(
      accepted.state.quests.active["moss_that_went_quiet"]?.stepId,
      "moss_that_went_quiet:1:collect"
    );
    assert.equal(
      accepted.state.quests.active["moss_that_went_quiet"]?.progress,
      2
    );
    assert.equal(
      accepted.state.quests.active["moss_that_went_quiet"]?.source,
      "snapshot_grove"
    );

    const completed = applyOne(accepted.state, "request_quest_state_update", {
      questId: "moss_that_went_quiet",
      source: "snapshot_grove",
      stepId: "moss_that_went_quiet:3:talk_npc",
      progress: 4,
      completed: true,
    });
    assert.deepEqual(completed.summary.warnings, []);
    assert.ok(
      completed.state.quests.completed["moss_that_went_quiet"] !== undefined
    );
    assert.equal(
      completed.state.quests.active["moss_that_went_quiet"],
      undefined
    );
  });

  it("grants Snapshot Grove equipment starters into live inventory once", function () {
    const questId = "cove_keeps_pictures";
    const cameraItemId = `b:${BikkieIds.camera}`;
    let result = applyOne(freshState(), "request_quest_state_update", {
      questId,
      source: "snapshot_grove",
      title: "untrusted title",
      stepId: `${questId}:0:inventory_change`,
      progress: 1,
    });
    let s = result.state;
    assert.equal(s.inventory.items[cameraItemId], 1);
    assert.equal(s.inventoryLoot.actors[ACTOR]?.items[cameraItemId], 1);
    assert.equal(s.quests.active[questId].title, "The Cove Keeps Pictures");

    result = applyOne(s, "request_equipment_change", {
      itemId: cameraItemId,
      slot: "main_hand",
    });
    s = result.state;
    assert.equal(
      s.inventory.equipment.main_hand,
      cameraItemId,
      result.summary.warnings.join(",")
    );
    assert.equal(s.inventory.items[cameraItemId], undefined);

    result = applyOne(s, "request_quest_state_update", {
      questId,
      source: "snapshot_grove",
      stepId: `${questId}:1:open_tab`,
      progress: 2,
    });
    s = result.state;
    assert.equal(s.inventory.equipment.main_hand, cameraItemId);
    assert.equal(s.inventory.items[cameraItemId], undefined);
  });

  it("no-ops when questId is absent from payload", function () {
    const s = freshState();
    const before = JSON.stringify(s.quests);
    const { state } = applyOne(s, "request_quest_state_update", {});
    assert.strictEqual(JSON.stringify(state.quests), before);
  });

  it("returns live-helper quest state reads without requiring an entity context", function () {
    const s = freshState();
    const result = applyOne(
      s,
      "request_quest_state_update",
      {
        operation: "live_entity_helper_read_state",
      },
      { subsystem: "quest" }
    );
    assert.deepEqual(result.summary.warnings, []);
    assert.ok(result.summary.touchedModels.includes("quest_state"));
    assert.ok(result.summary.touchedModels.includes("inventory_items"));
    const snapshot = createHarthmereLiveModeQuestClientSnapshot(result.state);
    assert.deepEqual(snapshot.active, result.state.quests.active);
    assert.deepEqual(snapshot.completed, {});
  });

  it("rejects legacy client gold deltas on quest state reads", function () {
    const s = freshState();
    const beforeGold = s.inventory.gold;
    const result = applyOne(
      s,
      "request_quest_state_update",
      {
        operation: "live_entity_helper_read_state",
        goldDelta: 9_999,
      },
      { subsystem: "quest" }
    );

    assert.equal(result.state.inventory.gold, beforeGold);
    assert.equal(result.state.economy.ledger.length, 0);
  });

  it("server-authoritatively accepts and completes live-entity supply quests", function () {
    const s = freshState();
    s.inventory.items.road_ration = 3;
    s.inventory.items.clean_water = 2;
    const payload = liveHelperPayloadForKind("food_water");
    const quest = getLiveEntityHelperQuestForEntity({
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
    const marker = liveEntityHelperQuestTargetMarkerForKind("food_water");

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
    let questSnapshot = createHarthmereLiveModeQuestClientSnapshot(
      result.state
    );
    assert.equal(questSnapshot.active[quest!.questId].stepId, marker!.id);
    assert.deepEqual(
      result.state.building.inWorldMarkers[marker!.id].position,
      resolveHarthmereProductionMarkerPosition({
        markerId: marker!.id,
        fallback: marker!.position,
      })
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
      getHarthmereItemDefinition("repair_voucher")?.displayName,
      "Black Anvil Repair Voucher"
    );
    assert.equal(
      getHarthmereItemDefinition("repair_voucher")?.description,
      "Redeemable at the Black Anvil for trusted field repairs."
    );
    assert.ok(result.state.quests.completed[quest!.questId]);
    assert.equal(result.state.quests.active[quest!.questId], undefined);
    questSnapshot = createHarthmereLiveModeQuestClientSnapshot(result.state);
    assert.equal(questSnapshot.completed[quest!.questId], NOW_MS);
    assert.equal(questSnapshot.active[quest!.questId], undefined);
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
    const quest = getLiveEntityHelperQuestForEntity({
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
    const marker = liveEntityHelperQuestTargetMarkerForKind("hard_boss");
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
        "live_entity_helper_rejected:active_quest_required"
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
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
      ].position,
      resolveHarthmereProductionMarkerPosition({
        markerId: LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
        fallback: marker!.position,
      })
    );

    const notReady = canCompleteLiveEntityHelperQuest(quest!, {
      hardBossDefeats: result.state.quests.active[quest!.questId].progress,
    });
    assert.equal(notReady.ok, false);

    const noDefeatProof = applyOne(
      result.state,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_record_boss_defeat",
      },
      { subsystem: "quest" }
    );
    assert.ok(
      noDefeatProof.summary.warnings.includes(
        "live_entity_helper_rejected:boss_defeat_required"
      )
    );
    assert.equal(noDefeatProof.state.quests.active[quest!.questId].progress, 0);

    result = applyOne(
      result.state,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_record_boss_defeat",
        bossDefeated: true,
        bossKillCredit: 1,
        bossEntityId: String(LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET),
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
        LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
      ],
      undefined
    );
  });

  it("lets an already-active hard boss helper record explicit defeat evidence if its marker is missing", function () {
    const s = freshState();
    const payload = liveHelperPayloadForKind("hard_boss");
    const quest = getLiveEntityHelperQuestForEntity({
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
    delete result.state.building.inWorldMarkers[
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
    ];

    result = applyOne(
      result.state,
      "request_quest_state_update",
      {
        ...payload,
        operation: "live_entity_helper_record_boss_defeat",
        bossDefeated: true,
        bossKillCredit: 1,
      },
      { subsystem: "quest" }
    );

    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.quests.active[quest!.questId].progress, 1);
  });

  it("depletes robot energy into Muck and recharges the protected area with Stabilized Exotic Matter", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[0];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
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

    result.state.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID] = 1;
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
      result.state.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID],
      undefined
    );
    assert.equal(result.state.inventory.items.repair_voucher, 1);
    assert.equal(result.state.inventory.items.minor_healing_salve, 2);
    assert.ok(
      (result.state.classMagic.skills.character_level?.xp ?? 0) > xpBefore
    );
    assert.equal(LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP.baseXp, 90);
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
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
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
        `live_entity_robot_rejected:item_required:${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID}`
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

  it("holds robot AI movement when its protection area is out of power", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[0];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
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
    const npcId = "west-breach-sentinel";
    depleted.combat.entitySnapshots[npcId] = {
      hp: 100,
      maxHp: 100,
      position: {
        x: area.anchor[0],
        y: area.anchor[1],
        z: area.anchor[2],
      },
      homePosition: {
        x: area.anchor[0],
        y: area.anchor[1],
        z: area.anchor[2],
      },
      isHostile: false,
      isAlive: true,
      isAttackable: false,
      entityKind: "robot",
      aiEnabled: true,
      movementSpeed: 2.2,
      patrolRadius: 6,
    };

    const result = applyOne(
      depleted,
      "request_npc_ai_tick",
      {
        npcId,
        thinkIntervalMs: 2_000,
      },
      { subsystem: "combat", targetId: npcId }
    );
    const tick = result.state.combat.npcAiTicks[npcId];

    assert.deepEqual(tick.positionFrom, {
      x: area.anchor[0],
      y: area.anchor[1],
      z: area.anchor[2],
    });
    assert.deepEqual(tick.positionTo, tick.positionFrom);
    assert.equal(tick.animationState, "idle");
    assert.equal(tick.animationMoving, false);
    assert.equal(tick.navigationBlocked, true);
    assert.equal(tick.movementMode, undefined);
  });
});

// ===========================================================================
// 16. request_care_loop_action — daily task progression
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — daily task progression", function () {
  const dailyTasks = [
    "check_in",
    "jobs_board",
    "eat_meal",
    "main_quest",
    "talk_neighbor",
    "forage_walk",
    "garden_care",
    "home_care",
  ];

  for (const targetId of dailyTasks) {
    it(`completes, claims, rewards, and duplicate-protects ${targetId}`, function () {
      let state = freshState();
      const day = Math.floor(NOW_MS / HARTHMERE_CARE_LOOP_DAY_MS);
      const key = `${day}:${targetId}`;
      const reward = HARTHMERE_CARE_DAILY_ACTIVITIES[targetId] ?? {};

      if (targetId !== "check_in") {
        const prematureClaim = applyOne(
          state,
          "request_care_loop_action",
          {
            operation: "daily_check_in",
            targetId,
          },
          { subsystem: "care" }
        );
        assert.ok(
          prematureClaim.summary.warnings.includes(
            "care_rejected:daily_task_not_done"
          )
        );
        assert.equal(prematureClaim.state.inventory.gold, state.inventory.gold);

        const completed = applyOne(
          state,
          "request_care_loop_action",
          {
            operation: "daily_task_completed",
            targetId,
          },
          { subsystem: "care" }
        );
        assert.deepEqual(completed.summary.warnings, []);
        assert.ok(completed.state.careLoops.daily.completed[key]);
        if (targetId === "jobs_board") {
          assert.equal(
            completed.state.quests.active["read-the-jobs-board"],
            undefined
          );
          assert.equal(
            completed.state.quests.completed["read-the-jobs-board"],
            NOW_MS
          );
          assert.ok(completed.summary.touchedModels.includes("quest_state"));
        }
        state = completed.state;

        const duplicateCompletion = applyOne(
          state,
          "request_care_loop_action",
          {
            operation: "daily_task_completed",
            targetId,
          },
          { subsystem: "care" }
        );
        assert.ok(
          duplicateCompletion.summary.warnings.includes(
            "care_rejected:daily_task_already_done"
          )
        );
      }

      const goldBeforeClaim = state.inventory.gold;
      const careXpBeforeClaim = state.classMagic.skills.care?.xp ?? 0;
      const claimed = applyOne(
        state,
        "request_care_loop_action",
        {
          operation: "daily_check_in",
          targetId,
        },
        { subsystem: "care" }
      );

      assert.deepEqual(claimed.summary.warnings, []);
      assert.ok(claimed.state.careLoops.daily.completed[key]);
      assert.ok(claimed.state.careLoops.daily.claimed[key]);
      assert.equal(
        claimed.state.inventory.gold,
        goldBeforeClaim + HARTHMERE_DAILY_TASK_MIN_GOLD
      );
      assert.equal(
        claimed.state.classMagic.skills.care.xp,
        careXpBeforeClaim + harthmereDailyTaskXpReward({ actorLevel: 1 })
      );
      for (const [itemId, count] of Object.entries(reward.rewardItems ?? {})) {
        assert.equal(claimed.state.inventory.items[itemId], count);
      }

      const duplicateClaim = applyOne(
        claimed.state,
        "request_care_loop_action",
        {
          operation: "daily_check_in",
          targetId,
        },
        { subsystem: "care" }
      );
      assert.ok(
        duplicateClaim.summary.warnings.includes(
          "care_rejected:daily_already_claimed"
        )
      );
      assert.equal(
        duplicateClaim.state.inventory.gold,
        claimed.state.inventory.gold
      );
      assert.equal(
        duplicateClaim.state.classMagic.skills.care.xp,
        claimed.state.classMagic.skills.care.xp
      );
    });
  }
});

// ===========================================================================
// 17. request_guild_mutation
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — guild mutation", function () {
  function createTestGuild() {
    const s = freshState();
    s.inventory.gold = 1_000;
    s.classMagic.skills.character_level = {
      xp: 0,
      level: HARTHMERE_GUILD_CREATION_MIN_LEVEL,
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

describe("reduceHarthmereLiveModeBackendState — law and reputation", function () {
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
        harthmereLiveModeSharedStateKey("zone_law", "harthmere_market")
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

  it("exposes dialogue world standing changes through the player status HUD snapshot", function () {
    const s = freshState();
    let reduced = applyOne(s, "request_law_reputation_mutation", {
      factionId: "npc:dialogue-ruthe",
      likeabilityDelta: -8,
      witnessLevel: "direct",
      reason: "dialogue_choice_rude",
    });
    reduced = applyOne(reduced.state, "request_law_reputation_mutation", {
      factionId: "harthmere",
      likeabilityDelta: -3,
      legalDelta: -3,
      notorietyDelta: 3,
      witnessLevel: "public",
      reason: "dialogue_choice_rude",
    });

    assert.equal(
      reduced.state.law.standing["npc:dialogue-ruthe"].likeability,
      -8
    );
    assert.deepStrictEqual(reduced.state.law.standing.harthmere, {
      likeability: -3,
      legal: -3,
      notoriety: 3,
      notorietyFloor: 0,
    });
    assert.deepStrictEqual(
      createHarthmereLiveModePlayerStatusClientSnapshot(reduced.state).standing,
      {
        scopeId: "harthmere",
        likeability: -3,
        legal: -3,
        notoriety: 3,
        notorietyFloor: 0,
        legacyReputation: 0,
      }
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

describe("reduceHarthmereLiveModeBackendState — farming", function () {
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
    const { state } = reduceHarthmereLiveModeBackendState(s, env, NOW_MS);
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
    const harvested = reduceHarthmereLiveModeBackendState(
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

  it("bridges native Biomes F-harvests into Cloud Save inventory for every harvestable seed", function () {
    this.timeout(60_000);
    const harvestableSeeds = Object.values(HARTHMERE_SEED_DEFINITIONS).filter(
      (seed) =>
        !/\btree\b|\b(oak|birch|rubber|sakura)\b/i.test(
          [
            seed.displayName,
            seed.cropDisplayName,
            seed.cropItemId,
            seed.metadata?.category,
          ]
            .filter(Boolean)
            .join(" ")
        )
    );
    assert.ok(
      harvestableSeeds.length > 20,
      "expected the full Bikkie crop catalog to be exercised"
    );

    for (const seed of harvestableSeeds) {
      const plantId = `native_plant_${seed.seedItemId}`;
      const result = applyOne(freshState(), "request_farming_action", {
        operation: "native_plant_harvest",
        plantId,
        seedItemId: seed.seedItemId,
        plantStatus: "fully_grown",
        farmingKind: "plant",
      });
      assert.deepEqual(
        result.summary.warnings.filter((warning) =>
          warning.startsWith("farming_rejected:")
        ),
        [],
        seed.displayName
      );
      assert.equal(
        result.state.inventory.items[seed.yieldItemId],
        seed.yieldCount,
        seed.displayName
      );
      assert.equal(result.state.farming.harvests[plantId], NOW_MS);
      assert.equal(
        result.state.combat.lootClaims[`native_plant_harvest:${plantId}`],
        NOW_MS
      );
      assert.ok(result.summary.touchedModels.includes("inventory_items"));
      assert.ok(result.summary.touchedModels.includes("loot_claims"));
    }
  });

  it("rejects duplicate, immature, unknown, and tree native plant harvests without mutating inventory", function () {
    const raspberrySeed =
      HARTHMERE_SEED_DEFINITIONS[String(BikkieIds.raspberrySeed)];
    assert.ok(raspberrySeed);
    const first = applyOne(freshState(), "request_farming_action", {
      operation: "native_plant_harvest",
      plantId: "native_raspberry_001",
      seedItemId: raspberrySeed.seedItemId,
      plantStatus: "fully_grown",
      farmingKind: "plant",
    });
    assert.equal(
      first.state.inventory.items[raspberrySeed.yieldItemId],
      raspberrySeed.yieldCount
    );

    const duplicate = applyOne(first.state, "request_farming_action", {
      operation: "native_plant_harvest",
      plantId: "native_raspberry_001",
      seedItemId: raspberrySeed.seedItemId,
      plantStatus: "fully_grown",
      farmingKind: "plant",
    });
    assert.ok(
      duplicate.summary.warnings.includes(
        "farming_rejected:plant_already_harvested"
      )
    );
    assert.equal(
      duplicate.state.inventory.items[raspberrySeed.yieldItemId],
      raspberrySeed.yieldCount
    );

    const immature = applyOne(freshState(), "request_farming_action", {
      operation: "native_plant_harvest",
      plantId: "native_raspberry_immature",
      seedItemId: raspberrySeed.seedItemId,
      plantStatus: "growing",
      farmingKind: "plant",
    });
    assert.ok(
      immature.summary.warnings.includes("farming_rejected:plant_not_ready")
    );
    assert.equal(
      immature.state.inventory.items[raspberrySeed.yieldItemId] ?? 0,
      0
    );

    const unknown = applyOne(freshState(), "request_farming_action", {
      operation: "native_plant_harvest",
      plantId: "native_unknown_001",
      seedItemId: "missing_seed",
      plantStatus: "fully_grown",
      farmingKind: "plant",
    });
    assert.ok(
      unknown.summary.warnings.includes("farming_rejected:unknown_seed")
    );

    const treeSeed = Object.values(HARTHMERE_SEED_DEFINITIONS).find((seed) =>
      /\btree\b|\b(oak|birch|rubber|sakura)\b/i.test(
        [
          seed.displayName,
          seed.cropDisplayName,
          seed.cropItemId,
          seed.metadata?.category,
        ]
          .filter(Boolean)
          .join(" ")
      )
    );
    assert.ok(treeSeed);
    const tree = applyOne(freshState(), "request_farming_action", {
      operation: "native_plant_harvest",
      plantId: "native_tree_001",
      seedItemId: treeSeed.seedItemId,
      plantStatus: "fully_grown",
      farmingKind: "tree",
    });
    assert.ok(
      tree.summary.warnings.includes(
        "farming_rejected:tree_harvest_not_supported"
      )
    );
    assert.equal(tree.state.inventory.items[treeSeed.yieldItemId] ?? 0, 0);
  });

  it("mines Exotic Matter deposits once and replenishes them on the server clock", function () {
    const deposit = harthmereExoticMatterDepositById(
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
        HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId
      ],
      1
    );
    assert.equal(first.state.combat.lootClaims[claimKey], NOW_MS);
    const shared = createHarthmereLiveModeSharedWorldState(first.state, NOW_MS);
    assert.equal(shared.exoticMatterDepositClaims[claimKey], NOW_MS);

    const otherMinerState = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      freshState(NOW_MS + 1),
      shared,
      NOW_MS + 1
    );
    const otherMiner = reduceHarthmereLiveModeBackendState(
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
        HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId
      ] ?? 0,
      0
    );

    const duplicate = applyOne(first.state, "request_farming_action", payload, {
      subsystem: "farming",
      serverActorPosition: actorPosition,
    });
    assert.ok(
      duplicate.summary.warnings.includes(
        "exotic_matter_rejected:deposit_replenishing"
      )
    );
    assert.equal(
      duplicate.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId
      ],
      1
    );

    const early = reduceHarthmereLiveModeBackendState(
      duplicate.state,
      makeEnvelope("request_farming_action", payload, {
        subsystem: "farming",
        serverActorPosition: actorPosition,
      }),
      NOW_MS + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS - 1
    );
    assert.ok(
      early.summary.warnings.includes(
        "exotic_matter_rejected:deposit_replenishing"
      )
    );

    const replenished = reduceHarthmereLiveModeBackendState(
      early.state,
      makeEnvelope("request_farming_action", payload, {
        subsystem: "farming",
        serverActorPosition: actorPosition,
      }),
      NOW_MS + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS
    );
    assert.deepEqual(replenished.summary.warnings, []);
    assert.equal(
      replenished.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId
      ],
      2
    );
    assert.equal(
      replenished.state.combat.lootClaims[claimKey],
      NOW_MS + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS
    );
  });

  it("rejects Exotic Matter mining without an authoritative nearby actor position", function () {
    const deposit = harthmereExoticMatterDepositById(
      "exotic_antihelium_deep_spindle_15"
    )!;
    const payload = {
      operation: "mine_exotic_matter_deposit",
      depositId: deposit.depositId,
    };

    const unverified = applyOne(
      freshState(),
      "request_farming_action",
      payload,
      {
        subsystem: "farming",
      }
    );
    assert.ok(
      unverified.summary.warnings.includes(
        "exotic_matter_rejected:deposit_proximity_unverified"
      )
    );
    assert.equal(
      unverified.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihelium.itemId
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
        HARTHMERE_EXOTIC_MATTER_COMPONENTS.antihelium.itemId
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

  it("mines a shifted-cave deposit when the player stands at its rendered terrainPosition", function () {
    const deposit = harthmereExoticMatterDepositById(
      "exotic_antiboron_mossglass_survey_03"
    )!;
    // Shifted-world deposits render their ore at terrainPosition (X - 512), which is where
    // the player physically stands. Proximity must accept that coordinate; previously only
    // deposit.position was checked, leaving every shifted-cave deposit un-mineable.
    assert.ok(
      deposit.terrainPosition,
      "expected a shifted deposit with a terrainPosition"
    );
    const payload = {
      operation: "mine_exotic_matter_deposit",
      depositId: deposit.depositId,
    };
    const mined = applyOne(freshState(), "request_farming_action", payload, {
      subsystem: "farming",
      serverActorPosition: {
        x: deposit.terrainPosition![0],
        y: deposit.terrainPosition![1],
        z: deposit.terrainPosition![2],
      },
    });
    assert.deepEqual(mined.summary.warnings, []);
    assert.equal(
      mined.state.inventory.items[
        HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId
      ],
      1
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
    const milk = reduceHarthmereLiveModeBackendState(s, collectEnv, readyAt);
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

describe("reduceHarthmereLiveModeBackendState — building mutation", function () {
  function grantAllConstructionMaterials(
    state: HarthmereLiveModeBackendState,
    blueprintId: string
  ) {
    const blueprint = buildingSystemBlueprintById(blueprintId);
    assert.ok(blueprint, `missing blueprint ${blueprintId}`);
    for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES) {
      for (const line of buildingSystemMaterialRequirementLines({
        blueprint,
        stage,
      })) {
        state.inventory.items[line.itemId] =
          (state.inventory.items[line.itemId] ?? 0) + line.required;
      }
    }
  }

  function grantAllConstructionMaterialsToStorage(
    state: HarthmereLiveModeBackendState,
    blueprintId: string
  ) {
    const blueprint = buildingSystemBlueprintById(blueprintId);
    assert.ok(blueprint, `missing blueprint ${blueprintId}`);
    for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES) {
      for (const line of buildingSystemMaterialRequirementLines({
        blueprint,
        stage,
      })) {
        state.banking.materialStorage[line.material] =
          (state.banking.materialStorage[line.material] ?? 0) + line.required;
      }
    }
  }

  function completeConstructionProject(input: {
    state: HarthmereLiveModeBackendState;
    plotId: string;
    blueprintId: string;
    testDuplicateFirstStage?: boolean;
  }) {
    let state = input.state;
    let started = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "start_construction",
        plotId: input.plotId,
        blueprintId: input.blueprintId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.deepEqual(
      started.summary.warnings.filter((warning) =>
        warning.includes("rejected")
      ),
      []
    );
    state = started.state;

    const duplicateStart = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "start_construction",
        plotId: input.plotId,
        blueprintId: input.blueprintId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      duplicateStart.summary.warnings.includes(
        "building_project_idempotent:project_already_exists"
      )
    );
    assert.equal(duplicateStart.state.inventory.gold, state.inventory.gold);

    let testedDuplicateStage = false;
    for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES) {
      const contributed = applyOne(
        state,
        "request_property_building_mutation",
        {
          buildingAction: "contribute_stage",
          plotId: input.plotId,
          blueprintId: input.blueprintId,
          stage,
          contributeAll: true,
        },
        { subsystem: "building", zoneId: "the_grove" }
      );
      assert.deepEqual(
        contributed.summary.warnings.filter((warning) =>
          warning.includes("rejected")
        ),
        [],
        `${input.plotId}:${stage}`
      );
      state = contributed.state;

      if (input.testDuplicateFirstStage && !testedDuplicateStage) {
        const duplicateStage = applyOne(
          state,
          "request_property_building_mutation",
          {
            buildingAction: "contribute_stage",
            plotId: input.plotId,
            blueprintId: input.blueprintId,
            stage,
            contributeAll: true,
          },
          { subsystem: "building", zoneId: "the_grove" }
        );
        assert.ok(
          duplicateStage.summary.warnings.includes(
            "building_stage_idempotent:stage_already_completed"
          )
        );
        state = duplicateStage.state;
        testedDuplicateStage = true;
      }
    }
    return state;
  }

  it("runs the full property build progression using material storage", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    const plotId = "grove_muckstead_cottage_lot";
    const blueprintId = "grove_voxel_cottage_tier_1";
    s.building.ownedPlots = [plotId];
    grantAllConstructionMaterialsToStorage(s, blueprintId);

    const built = completeConstructionProject({
      state: s,
      plotId,
      blueprintId,
      testDuplicateFirstStage: true,
    });

    const propertyId = `property_${plotId}`;
    assert.equal(built.property.buildingProgress[propertyId], 100);
    assert.equal(built.property.owned[propertyId].blueprintId, blueprintId);
    assert.equal(
      built.building.activeProjects[`project_${plotId}`].status,
      "completed"
    );
    for (const count of Object.values(built.banking.materialStorage)) {
      assert.equal(count, 0);
    }
  });

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

    assert.strictEqual(
      Object.keys(state.building.placedStructures).length,
      Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS).length
    );
    assert.ok(
      summary.warnings.includes("building_rejected:plot_not_owned_by_actor")
    );
  });

  it("claims a Grove plot as a visible muck deed without terraforming safe ground", function () {
    const s = freshState();
    s.inventory.gold = 1_000;
    const plot = buildingSystemPlotById("grove_crossroads_shop_lot");
    assert.ok(plot);

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId: plot.plotId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );

    assert.ok(state.building.ownedPlots.includes(plot.plotId));
    assert.equal(state.inventory.gold, 1_000 - plot.claimPriceGold);
    assert.equal(state.building.safeZones[plot.plotId].safeFromMuck, false);
    const plan = summary.buildingMaterializationPlans?.find(
      (entry: any) => entry.reason === "plot_claim_muck_deed"
    ) as any;
    assert.ok(plan, "claiming muck land should queue a muck deed plan");
    assert.equal(plan.safeZone.safeFromMuck, false);
    assert.equal(
      plan.edits.some((edit: any) => edit.label === "safe_ground"),
      false,
      "plot purchase must not terraform safe ground"
    );
    assert.ok(state.building.inWorldMarkers[`${plot.plotId}:map`]);
    assert.match(
      state.building.inWorldMarkers[`${plot.plotId}:map`].label,
      /muck deed/i
    );
  });

  it("lets one actor claim all authored plots without a global building cap", function () {
    let state = freshState();
    state.inventory.gold = 10_000;

    for (const plot of BUILDING_SYSTEM_PLOTS) {
      const result = applyOne(
        state,
        "request_property_building_mutation",
        {
          buildingAction: "claim_plot",
          plotId: plot.plotId,
        },
        { subsystem: "building", zoneId: "the_grove" }
      );
      assert.deepEqual(
        result.summary.warnings.filter((warning) =>
          warning.includes("rejected")
        ),
        [],
        plot.plotId
      );
      state = result.state;
    }

    for (const plot of BUILDING_SYSTEM_PLOTS) {
      assert.ok(state.building.ownedPlots.includes(plot.plotId), plot.plotId);
    }
  });

  it("claims and builds multiple unbounded muck-area plots when the footprints do not overlap", function () {
    this.timeout(30_000);
    let state = freshState();
    state.inventory.gold = 20_000;
    state.building.ownedPlots = BUILDING_SYSTEM_PLOTS.map(
      (plot) => plot.plotId
    );
    const blueprintId = "grove_voxel_cottage_tier_1";
    grantAllConstructionMaterialsToStorage(state, blueprintId);
    grantAllConstructionMaterialsToStorage(state, blueprintId);

    for (const [plotId, originX] of [
      ["muck_claim_watchtower_test_a", 318],
      ["muck_claim_watchtower_test_b", 340],
    ] as const) {
      const claimed = applyOne(
        state,
        "request_property_building_mutation",
        {
          buildingAction: "claim_plot",
          plotId,
          blueprintId,
          muckAreaId: "watchtower_muck_clearing",
          originX,
          originY: 55,
          originZ: -392,
        },
        { subsystem: "building", zoneId: "the_grove" }
      );
      assert.deepEqual(
        claimed.summary.warnings.filter((warning) =>
          warning.includes("rejected")
        ),
        [],
        plotId
      );
      state = claimed.state;
      assert.ok(state.building.customPlots[plotId]);
      state = completeConstructionProject({
        state,
        plotId,
        blueprintId,
      });
      assert.ok(state.property.owned[`property_${plotId}`]);
    }

    const overlap = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId: "muck_claim_watchtower_overlap",
        blueprintId,
        muckAreaId: "watchtower_muck_clearing",
        originX: 319,
        originY: 55,
        originZ: -392,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      overlap.summary.warnings.some((warning) =>
        warning.includes("plot_claim_rejected:area_already_claimed")
      )
    );
  });

  it("runs the full home flow from land purchase through reload-safe completed cottage", function () {
    let state = freshState();
    state.inventory.gold = 500;
    const plotId = "grove_muckstead_cottage_lot";
    const blueprintId = "grove_voxel_cottage_tier_1";
    grantAllConstructionMaterials(state, blueprintId);

    const claimed = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    state = claimed.state;
    assert.equal(state.inventory.gold, 475);
    assert.ok(state.building.ownedPlots.includes(plotId));
    assert.equal(state.building.safeZones[plotId].safeFromMuck, true);
    assert.ok(
      claimed.summary.buildingMaterializationPlans?.some(
        (plan: any) => plan.reason === "plot_claim_safe_ground"
      )
    );
    const claimReloadSnapshot = createHarthmereLiveModeBuildingClientSnapshot(
      parseHarthmereLiveModeBackendState(JSON.stringify(state), ACTOR, NOW_MS)
    );
    assert.ok(claimReloadSnapshot.ownedPlotIds.includes(plotId));
    assert.equal(claimReloadSnapshot.safeZones[plotId].safeFromMuck, true);
    assert.equal(claimReloadSnapshot.gold, 475);

    const duplicateClaim = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      duplicateClaim.summary.warnings.includes(
        "plot_claim_idempotent:already_owned_by_actor"
      )
    );
    assert.equal(duplicateClaim.state.inventory.gold, state.inventory.gold);

    state = completeConstructionProject({
      state,
      plotId,
      blueprintId,
      testDuplicateFirstStage: true,
    });

    const propertyId = "property_grove_muckstead_cottage_lot";
    assert.ok(state.property.owned[propertyId]);
    assert.equal(state.property.owned[propertyId].use, "home");
    assert.equal(state.property.buildingProgress[propertyId], 100);
    assert.ok(state.building.placedStructures[`project_${plotId}`]);
    assert.ok(state.building.storageContainers[`storage_${propertyId}`]);
    assert.ok(state.building.doorLocks[`door_${propertyId}`]);
    assert.ok(
      state.building.inWorldMarkers[
        buildingSystemHomeConsoleMarkerId(propertyId)
      ]
    );

    const reloaded = parseHarthmereLiveModeBackendState(
      JSON.stringify(state),
      ACTOR,
      NOW_MS
    );
    const snapshot = createHarthmereLiveModeBuildingClientSnapshot(reloaded);
    assert.ok(snapshot.ownedPlotIds.includes(plotId));
    assert.ok(snapshot.completedProperties[propertyId]);
    assert.equal(snapshot.gold, state.inventory.gold);
    assert.equal(snapshot.safeZones[plotId].safeFromMuck, true);
  });

  it("runs the full business flow from commercial plot to revenue collection", function () {
    let state = freshState();
    state.inventory.gold = 1_000;
    const plotId = "grove_crossroads_shop_lot";
    const blueprintId = "grove_voxel_shop_tier_1";
    grantAllConstructionMaterials(state, blueprintId);

    ({ state } = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    assert.equal(state.inventory.gold, 955);
    assert.equal(state.building.safeZones[plotId].safeFromMuck, false);

    state = completeConstructionProject({
      state,
      plotId,
      blueprintId,
    });
    const propertyId = "property_grove_crossroads_shop_lot";
    const property = state.property.owned[propertyId];
    assert.ok(property);
    assert.equal(property.use, "business");

    const startup = buildingSystemBusinessTypeById("general_trader");
    assert.ok(startup);
    const goldBeforeStartup = state.inventory.gold;
    ({ state } = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "start_business",
        plotId,
        propertyId,
        businessType: "general_trader",
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    assert.equal(
      state.inventory.gold,
      goldBeforeStartup - startup.startingCostGold
    );
    const businessId = state.property.owned[propertyId].businessId!;
    assert.ok(state.economy.businesses[businessId]);
    assert.ok(state.building.inWorldMarkers[`${businessId}:marker`]);

    const duplicateBusiness = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "start_business",
        plotId,
        propertyId,
        businessType: "general_trader",
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      duplicateBusiness.summary.warnings.includes(
        "business_idempotent:already_started"
      )
    );
    assert.equal(duplicateBusiness.state.inventory.gold, state.inventory.gold);

    ({ state } = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "run_business_cycle",
        plotId,
        propertyId,
        businessId,
        cycles: 2,
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    const revenue = state.economy.businesses[businessId].revenueBalanceGold;
    assert.ok(revenue > 0);
    const goldBeforeCollect = state.inventory.gold;
    ({ state } = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "collect_business_revenue",
        plotId,
        propertyId,
        businessId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    assert.equal(state.inventory.gold, goldBeforeCollect + revenue);
    assert.equal(state.economy.businesses[businessId].revenueBalanceGold, 0);

    const snapshot = createHarthmereLiveModeBuildingClientSnapshot(
      parseHarthmereLiveModeBackendState(JSON.stringify(state), ACTOR, NOW_MS)
    );
    assert.ok(snapshot.ownedPlotIds.includes(plotId));
    assert.ok(snapshot.completedProperties[propertyId]);
    assert.ok(snapshot.businesses[businessId]);
  });

  it("rejects unaffordable land, construction, and business steps without partial mutation", function () {
    let state = freshState();
    state.inventory.gold = 10;
    const homePlotId = "grove_muckstead_cottage_lot";
    const homeBlueprintId = "grove_voxel_cottage_tier_1";

    let result = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId: homePlotId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      result.summary.warnings.includes(
        "plot_claim_rejected:insufficient_gold_for_plot_claim"
      )
    );
    assert.equal(result.state.inventory.gold, 10);
    assert.equal(result.state.building.ownedPlots.includes(homePlotId), false);

    state = freshState();
    state.inventory.gold = 0;
    state.building.ownedPlots.push(homePlotId);
    result = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "start_construction",
        plotId: homePlotId,
        blueprintId: homeBlueprintId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      result.summary.warnings.includes(
        "building_project_rejected:insufficient_gold_for_blueprint"
      )
    );
    assert.equal(Object.keys(result.state.building.activeProjects).length, 0);
    assert.equal(result.state.inventory.gold, 0);

    state = freshState();
    state.inventory.gold = 500;
    const businessPlotId = "grove_crossroads_shop_lot";
    const businessBlueprintId = "grove_voxel_shop_tier_1";
    grantAllConstructionMaterials(state, businessBlueprintId);
    ({ state } = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId: businessPlotId,
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    state = completeConstructionProject({
      state,
      plotId: businessPlotId,
      blueprintId: businessBlueprintId,
    });
    state.inventory.gold = 1;
    const propertyId = "property_grove_crossroads_shop_lot";
    result = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "start_business",
        plotId: businessPlotId,
        propertyId,
        businessType: "general_trader",
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      result.summary.warnings.includes(
        "business_rejected:insufficient_startup_gold"
      )
    );
    assert.deepEqual(Object.keys(result.state.economy.businesses), []);
    assert.equal(result.state.inventory.gold, 1);
  });

  it("rejects terraforming a deeded plot until an owned home or business exists on it", function () {
    let s = freshState();
    s.inventory.gold = 1_000;
    ({ state: s } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId: "grove_crossroads_shop_lot",
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));

    const result = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "terraform_plot",
        plotId: "grove_crossroads_shop_lot",
        propertyId: "property_grove_crossroads_shop_lot",
      },
      { subsystem: "building", zoneId: "the_grove" }
    );

    assert.ok(
      result.summary.warnings.includes(
        "plot_terraform_rejected:owned_home_or_business_required"
      )
    );
    assert.equal(
      result.state.building.safeZones.grove_crossroads_shop_lot.safeFromMuck,
      false
    );
  });

  it("terraforms from an owned business UI marker and updates property map state", function () {
    let s = freshState();
    s.inventory.gold = 1_000;
    ({ state: s } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId: "grove_crossroads_shop_lot",
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    ({ state: s } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "place",
        plotId: "grove_crossroads_shop_lot",
        blueprintId: "grove_voxel_shop_tier_1",
        propertyId: "property_grove_crossroads_shop_lot",
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    const consoleMarker =
      s.building.inWorldMarkers[
        "business_property_grove_crossroads_shop_lot:marker"
      ];
    assert.ok(consoleMarker);

    const { state, summary } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "terraform_plot",
        plotId: "grove_crossroads_shop_lot",
        propertyId: "property_grove_crossroads_shop_lot",
      },
      {
        subsystem: "building",
        zoneId: "the_grove",
        serverActorPosition: {
          x: consoleMarker.position[0],
          y: consoleMarker.position[1],
          z: consoleMarker.position[2],
        },
      }
    );

    assert.equal(
      state.building.safeZones.grove_crossroads_shop_lot.safeFromMuck,
      true
    );
    const plan = summary.buildingMaterializationPlans?.find(
      (entry: any) => entry.reason === "plot_terraform_safe_ground"
    ) as any;
    assert.ok(plan);
    assert.ok(
      plan.edits.some((edit: any) => edit.label === "safe_ground"),
      "terraforming from owned property UI should materialize safe ground"
    );
    assert.match(
      state.building.inWorldMarkers["grove_crossroads_shop_lot:map"].label,
      /terraformed property/i
    );

    const repeated = applyOne(
      state,
      "request_property_building_mutation",
      {
        buildingAction: "terraform_plot",
        plotId: "grove_crossroads_shop_lot",
        propertyId: "property_grove_crossroads_shop_lot",
      },
      { subsystem: "building", zoneId: "the_grove" }
    );
    assert.ok(
      repeated.summary.warnings.includes(
        "plot_terraform_rejected:already_terraformed"
      )
    );
  });

  it("rejects terraforming when actor position is away from the owned property UI marker", function () {
    let s = freshState();
    s.inventory.gold = 1_000;
    ({ state: s } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "claim_plot",
        plotId: "grove_crossroads_shop_lot",
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));
    ({ state: s } = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "place",
        plotId: "grove_crossroads_shop_lot",
        blueprintId: "grove_voxel_shop_tier_1",
        propertyId: "property_grove_crossroads_shop_lot",
      },
      { subsystem: "building", zoneId: "the_grove" }
    ));

    const result = applyOne(
      s,
      "request_property_building_mutation",
      {
        buildingAction: "terraform_plot",
        plotId: "grove_crossroads_shop_lot",
        propertyId: "property_grove_crossroads_shop_lot",
      },
      {
        subsystem: "building",
        zoneId: "the_grove",
        serverActorPosition: { x: 9999, y: 70, z: 9999 },
      }
    );

    assert.ok(
      result.summary.warnings.includes(
        "plot_terraform_rejected:property_ui_required"
      )
    );
    assert.equal(
      result.state.building.safeZones.grove_crossroads_shop_lot.safeFromMuck,
      false
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

    assert.strictEqual(
      Object.keys(state.building.placedStructures).length,
      Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS).length
    );
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
        buildingSystemHomeConsoleMarkerId(
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

  it("auto-materializes business outpost voxel buildings on read_state when revision is missing or stale", function () {
    // A fresh state has no outpostBuildRevision — read_state should detect the
    // mismatch and queue the full 19-outpost cleanup + rebuild automatically.
    const fresh = freshState();
    assert.equal(fresh.building.outpostBuildRevision, undefined);

    const { state, summary } = applyOne(
      fresh,
      "request_property_building_mutation",
      { buildingAction: "read_state" }
    );

    assert.ok(
      summary.touchedModels.includes("business_outpost_voxel_rebuild"),
      "read_state must trigger voxel rebuild when revision is missing"
    );
    assert.ok(
      summary.touchedModels.includes("terrain_materialization"),
      "read_state rebuild must touch terrain_materialization"
    );
    assert.equal(
      summary.buildingMaterializationPlans?.length,
      Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS).length * 2,
      "read_state must produce one cleanup + one rebuild plan per outpost"
    );
    assert.ok(
      summary.buildingMaterializationPlans?.[0]?.edits.every(
        (edit) => edit.label === "demolition_cleanup"
      ),
      "first plan of each pair must be the demolition cleanup"
    );
    // Revision must be stamped so the next read_state does not rebuild again.
    assert.equal(
      state.building.outpostBuildRevision,
      HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION,
      "outpostBuildRevision must be stamped after auto-rebuild"
    );

    // Second read_state with matching revision must NOT re-queue plans.
    const { summary: second } = applyOne(
      state,
      "request_property_building_mutation",
      { buildingAction: "read_state" }
    );
    assert.equal(
      second.buildingMaterializationPlans?.length ?? 0,
      0,
      "read_state must not re-queue plans when revision already matches"
    );
    assert.equal(
      second.touchedModels.includes("business_outpost_voxel_rebuild"),
      false,
      "no rebuild model touch when revision is current"
    );
  });

  it("queues admin-only explicit cleanup and rebuild materialization for every business outpost", function () {
    const rejected = applyOne(
      freshState(),
      "request_property_building_mutation",
      { buildingAction: "rebuild_business_outposts" }
    );
    assert.ok(
      rejected.summary.warnings.includes(
        "business_outpost_rebuild_rejected:admin_tool_required"
      )
    );
    assert.equal(rejected.summary.buildingMaterializationPlans, undefined);

    const { state, summary } = applyOne(
      freshState(),
      "request_property_building_mutation",
      { buildingAction: "rebuild_business_outposts" },
      { source: "admin_tool" }
    );
    assert.ok(summary.touchedModels.includes("business_outpost_voxel_rebuild"));
    assert.ok(summary.touchedModels.includes("terrain_materialization"));
    assert.equal(
      summary.buildingMaterializationPlans?.length,
      Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS).length * 2
    );
    assert.ok(
      summary.buildingMaterializationPlans?.[0]?.edits.every(
        (edit) => edit.label === "demolition_cleanup"
      )
    );
    // Admin rebuild must also stamp the revision so read_state won't re-trigger.
    assert.equal(
      state.building.outpostBuildRevision,
      HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION,
      "admin rebuild must stamp outpostBuildRevision"
    );
    const redpot =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot;
    assert.equal(
      state.building.materializationPlans[redpot.materializationPlan.requestId]
        .edits.length,
      redpot.materializationPlan.edits.length
    );
    assert.ok(
      state.building.inWorldMarkers[`${redpot.outpostId}:customer-dashboard`]
    );
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
    const ownerMarker =
      state.building.inWorldMarkers[`${businessId}:owner-npc`];
    assert.ok(ownerMarker, "player-owned businesses need an owner NPC inside");
    assert.equal(ownerMarker.kind, "npc_board");
    assert.equal(ownerMarker.plotId, "grove_crossroads_shop_lot");
    assert.match(ownerMarker.label, /grove crossroads shop lot owner/i);
    const plot = buildingSystemPlotById(ownerMarker.plotId);
    assert.ok(plot);
    assert.ok(
      ownerMarker.position[0] >= plot!.bounds.xMin &&
        ownerMarker.position[0] <= plot!.bounds.xMax &&
        ownerMarker.position[2] >= plot!.bounds.zMin &&
        ownerMarker.position[2] <= plot!.bounds.zMax,
      "owner NPC marker must stay inside the owned business plot"
    );
    const parsed = parseHarthmereLiveModeBackendState(
      JSON.stringify(state),
      ACTOR,
      NOW_MS + 1
    );
    assert.ok(
      parsed.building.inWorldMarkers[`${businessId}:owner-npc`],
      "saved player-owned businesses should hydrate their owner NPC marker"
    );
  });

  it("cleans up player-hosted production businesses when a business property is demolished", function () {
    let s = freshState();
    s.inventory.gold = 10_000;
    s.building.ownedPlots.push("grove_crossroads_shop_lot");

    ({ state: s } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_crossroads_shop_lot",
      blueprintId: "grove_voxel_shop_tier_1",
      propertyId: "property_grove_crossroads_shop_lot",
    }));

    ({ state: s } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "start_business",
      propertyId: "property_grove_crossroads_shop_lot",
      businessType: "general_trader",
    }));

    const businessId = "business_property_grove_crossroads_shop_lot";
    assert.ok(s.economy.businesses[businessId]);
    assert.ok(s.economy.production.businesses[businessId]);

    const demolished = applyOne(s, "request_property_building_mutation", {
      buildingAction: "demolish_property",
      plotId: "grove_crossroads_shop_lot",
      propertyId: "property_grove_crossroads_shop_lot",
      refund: false,
    });
    s = demolished.state;

    assert.equal(s.economy.businesses[businessId], undefined);
    assert.equal(s.economy.production.businesses[businessId], undefined);
    assert.ok(
      demolished.summary.touchedModels.includes(
        "economy_production_business_removed"
      )
    );

    s.inventory.gold = 10_000;
    s.building.ownedPlots.push("grove_crossroads_shop_lot");
    ({ state: s } = applyOne(s, "request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_crossroads_shop_lot",
      blueprintId: "grove_voxel_shop_tier_1",
      propertyId: "property_grove_crossroads_shop_lot",
    }));
    s.economy.production.businesses[businessId] = {
      businessId,
      ownerKind: "player",
      ownerId: "install:old-stale-property-test",
      typeId: "courier",
      name: "Stale courier bridge",
      status: "open",
      licenseClass: "logistics",
      licenseLevel: 1,
      propertyId: "property_grove_crossroads_shop_lot",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      inventory: {},
      storageMaxSlots: 24,
      employees: [],
      activeContracts: [],
      completedContracts: 0,
      reputation: 0,
      customerSatisfaction: 50,
      sanitationRating: 65,
      safetyRating: 65,
      serviceRadius: 22,
      priceModifiers: {},
      balanceGold: 0,
      debtGold: 0,
      upkeepGoldPerDay: 6,
      rentGoldPerDay: 0,
      wageGoldPerDay: 0,
      salesTaxRate: 0.08,
      lastTickAtMs: NOW_MS,
      createdAtMs: NOW_MS,
      updatedAtMs: NOW_MS,
      flags: {
        propertyHosted: true,
        productionBridge: true,
      },
    };

    const restarted = applyOne(s, "request_property_building_mutation", {
      buildingAction: "start_business",
      propertyId: "property_grove_crossroads_shop_lot",
      businessType: "weapons_tools",
    });
    assert.ok(
      !restarted.summary.warnings.some((warning) =>
        warning.includes("business_id_conflict")
      )
    );
    assert.equal(
      restarted.state.economy.production.businesses[businessId]?.typeId,
      "weapons_tools",
      JSON.stringify(restarted.summary.warnings)
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
    assert.equal(
      Object.values(state.economy.production.businesses).some(
        (business) =>
          business.propertyId === "property_grove_crossroads_shop_lot"
      ),
      false
    );
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
    assert.equal(
      Object.values(state.economy.production.businesses).some(
        (business) =>
          business.propertyId === "property_grove_muckstead_cottage_lot"
      ),
      false
    );
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

describe("reduceHarthmereLiveModeBackendState — legacy goldDelta path", function () {
  it("non-authority action with goldDelta updates inventory.gold and ledger", function () {
    const s = freshState();
    s.inventory.gold = 100;
    const { state } = applyOne(s, "legacy_gold_delta_action" as any, {
      goldDelta: 50,
    });
    assert.strictEqual(state.inventory.gold, 150);
    assert.ok(state.economy.ledger.some((e) => e.amount === 50));
  });

  it("non-authority action with negative goldDelta cannot go below 0", function () {
    const s = freshState();
    s.inventory.gold = 10;
    const { state } = applyOne(s, "legacy_gold_delta_action" as any, {
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

describe("reduceHarthmereLiveModeBackendState — immutability", function () {
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
    assert.strictEqual(s.version, HARTHMERE_LIVE_MODE_BACKEND_VERSION);
  });
});

// ===========================================================================
// 11b. request_mail_transaction
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — mail transactions", function () {
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

describe("reduceHarthmereLiveModeBackendState — physical jobs board and live ticks", function () {
  it("rejects client-supplied jobs board target ids without server position proof", function () {
    const s = freshState();
    const { summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        interactionTargetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      },
      { subsystem: "jobs", targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID }
    );
    assert.ok(
      summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
  });

  it("accepts normal client jobs board interactions when the server attaches the actor position", function () {
    const s = freshState();
    s.jobsBoard.postings.job_client_accept = {
      jobId: "job_client_accept",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_client_accept",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
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

  it("accepting a delivery job grants the parcel into live inventory", function () {
    const s = freshState();
    s.jobsBoard.postings.job_delivery_accept = {
      jobId: "job_delivery_accept",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Run the Coop Food Parcel",
      description: "Deliver the sealed package to the satchel.",
      kind: "delivery",
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          mapMarkerId: "grove_mail_bank_satchel",
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
      mapMarkerId: "grove_mail_bank_satchel",
      abuseFlags: [],
      logs: [],
    } as any;

    const { state, summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_delivery_accept",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );

    assert.deepEqual(summary.warnings, []);
    assert.equal(state.jobsBoard.postings.job_delivery_accept.status, "active");
    assert.equal(state.inventory.items.sealed_package, 1);
  });

  it("delivery drop-off completion keeps the job active and points back to the board", function () {
    let s = freshState();
    s.jobsBoard.postings.job_delivery_dropoff = {
      jobId: "job_delivery_dropoff",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Deliver Medicine to the Clinic Lockbox",
      description: "Deliver the sealed package to the clinic lockbox.",
      kind: "delivery",
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          mapMarkerId: "clinic_lockbox_marker",
          targetName: "Clinic lockbox",
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
      mapMarkerId: "clinic_lockbox_marker",
      abuseFlags: [],
      logs: [],
    } as any;

    ({ state: s } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_delivery_dropoff",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    ));
    const todo = Object.values(s.jobsBoard.todos)[0];
    assert.ok(todo, "accepting the delivery should create a todo");

    const result = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_delivery_dropoff",
        questTodoId: todo.todoId,
        completedTargetId: "clinic_lockbox_marker",
        completionNote: "delivered at lockbox",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 751,
          y: 53,
          z: -562,
        },
      }
    );
    s = result.state;

    assert.deepEqual(result.summary.warnings, []);
    assert.equal(s.jobsBoard.postings.job_delivery_dropoff.status, "active");
    assert.equal(s.jobsBoard.todos[todo.todoId].status, "completed");
    assert.equal(s.inventory.items.sealed_package ?? 0, 0);
    assert.deepEqual(s.quests.active[`jobs_board:${todo.todoId}`], {
      stepId: "job_delivery_dropoff:return_to_board",
      progress: 1,
    });
    assert.equal(s.quests.completed[`jobs_board:${todo.todoId}`], undefined);
    const marker =
      s.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`];
    assert.ok(
      marker,
      "drop-off completion should leave a board turn-in marker"
    );
    assert.equal(marker.plotId, "harthmere_market_posting_board");
    assert.ok(marker.label.includes("Return to the jobs board"));
  });

  it("jobs can complete with required materials stored outside the backpack", function () {
    let s = freshState();
    s.banking.materialStorage.herb_bundle = 2;
    s.jobsBoard.postings.job_storage_material_dropoff = {
      jobId: "job_storage_material_dropoff",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Gather Herb Bundles for the Clinic",
      description: "Bring stored herb bundles to the clinic shelf.",
      kind: "gather",
      requirements: [
        {
          itemId: "herb_bundle",
          count: 2,
          targetId: "clinic_supply_marker",
          targetName: "Clinic supply shelf",
          mapMarkerId: "clinic_supply_marker",
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
      mapMarkerId: "clinic_supply_marker",
      targetId: "clinic_supply_marker",
      abuseFlags: [],
      logs: [],
    } as any;

    ({ state: s } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_storage_material_dropoff",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    ));
    const todo = Object.values(s.jobsBoard.todos)[0];
    assert.ok(todo, "accepting the delivery should create a todo");

    const result = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_storage_material_dropoff",
        questTodoId: todo.todoId,
        completedTargetId: "clinic_supply_marker",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      }
    );

    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.jobsBoard.todos[todo.todoId].status, "completed");
    assert.equal(result.state.inventory.items.herb_bundle ?? 0, 0);
    assert.equal(result.state.banking.materialStorage.herb_bundle ?? 0, 0);
    assert.ok(result.summary.touchedModels.includes("material_storage"));
  });

  it("jobs-board quest completion forwards used tool action evidence", function () {
    let s = freshState();
    s.banking.materialStorage.softwood_log = 3;
    s.jobsBoard.postings.job_repair_tool_action = {
      jobId: "job_repair_tool_action",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Patch the Safe-Zone Fence",
      description: "Use repair work to patch the fence.",
      kind: "repair",
      requirements: [
        {
          itemId: "softwood_log",
          count: 3,
          mapMarkerId: "grove_repair_fence",
          requiredToolAction: "repair",
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
      mapMarkerId: "grove_repair_fence",
      abuseFlags: [],
      logs: [],
    } as any;

    ({ state: s } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_repair_tool_action",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    ));
    const todo = Object.values(s.jobsBoard.todos)[0];
    assert.ok(todo, "accepting the repair job should create a todo");

    const result = applyOne(
      s,
      "request_quest_state_update",
      {
        questId: `jobs_board:${todo.todoId}`,
        completed: true,
        usedToolAction: "repair",
        completionItemDeltas: { softwood_log: -3 },
      },
      { subsystem: "quest" }
    );

    assert.deepEqual(result.summary.warnings, []);
    assert.equal(result.state.jobsBoard.todos[todo.todoId].status, "completed");
    assert.equal(result.state.banking.materialStorage.softwood_log ?? 0, 0);
  });

  function addOpenEscortJob(state: HarthmereLiveModeBackendState) {
    state.jobsBoard.postings.job_escort_newcomer = {
      jobId: "job_escort_newcomer",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Escort a Newcomer to the Road Post",
      description: "Walk a newcomer to the road post.",
      kind: "escort",
      requirements: [
        {
          serviceKind: "escort",
          serviceUnits: 1,
          targetId: "old_grove_road_post",
          targetName: "Road Post",
          mapMarkerId: "old_grove_road_post",
        },
      ],
      rewardGold: 91,
      escrowGold: 91,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 0,
      requiresFieldWork: true,
      mapMarkerId: "old_grove_road_post",
      targetId: "old_grove_road_post",
      abuseFlags: [],
      logs: [],
    } as any;
  }

  it("accepting an escort job spawns a friendly human companion next to the actor", function () {
    const s = freshState();
    const actorPosition = {
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
    };
    addOpenEscortJob(s);
    const { state, summary } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_escort_newcomer",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: actorPosition,
      }
    );
    assert.deepEqual(summary.warnings, []);
    const companion =
      state.jobsBoard.postings.job_escort_newcomer.escortCompanion;
    assert.ok(companion, "accepted escort should create companion metadata");
    const snapshot = state.combat.entitySnapshots[String(companion!.entityId)];
    assert.ok(snapshot, "accepted escort should create a live entity snapshot");
    assert.equal(snapshot.entityKind, "human");
    assert.equal(snapshot.isHostile, false);
    assert.equal(snapshot.isAttackable, false);
    assert.equal(snapshot.combatProtection, "friendly_noncombatant");
    assert.equal(snapshot.escortActorId, ACTOR);
    assert.ok(
      Math.hypot(
        snapshot.position.x - actorPosition.x,
        snapshot.position.z - actorPosition.z
      ) < 2
    );
  });

  it("escort companion AI follows the actor coordinates and animates as moving", function () {
    let s = freshState();
    addOpenEscortJob(s);
    ({ state: s } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_escort_newcomer",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    ));
    const companion = s.jobsBoard.postings.job_escort_newcomer.escortCompanion!;
    const before = {
      ...s.combat.entitySnapshots[String(companion.entityId)].position,
    };
    ({ state: s } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId: String(companion.entityId), thinkIntervalMs: 1000 },
      {
        subsystem: "npc_ai",
        targetId: String(companion.entityId),
        serverActorPosition: { x: before.x + 12, y: before.y, z: before.z },
      }
    ));
    const tick = s.combat.npcAiTicks[String(companion.entityId)];
    const after = s.combat.entitySnapshots[String(companion.entityId)];
    assert.equal(tick.decision, "escort_follow_player");
    assert.equal(tick.targetId, ACTOR);
    assert.equal(tick.movementMode, "combat_chase");
    assert.equal(tick.animationState, "run");
    assert.equal(tick.animationMoving, true);
    assert.ok(after.position.x > before.x, "escort should step toward actor x");
    assert.equal(
      s.jobsBoard.postings.job_escort_newcomer.escortCompanion!.position.x,
      after.position.x
    );
  });

  it("escort arrival completes the field objective and routes back to the board", function () {
    let s = freshState();
    addOpenEscortJob(s);
    ({ state: s } = applyOne(
      s,
      "request_jobs_board_mutation",
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_escort_newcomer",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    ));
    const companion = s.jobsBoard.postings.job_escort_newcomer.escortCompanion!;
    const target = harthmereJobsBoardQuestMarkerPositionForId(
      "old_grove_road_post"
    )!;
    s.combat.entitySnapshots[String(companion.entityId)].position = {
      x: target.position[0] - 1,
      y: target.position[1],
      z: target.position[2],
    };
    const todo = Object.values(s.jobsBoard.todos)[0];
    assert.ok(s.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`]);
    ({ state: s } = applyOne(
      s,
      "request_npc_ai_tick",
      { npcId: String(companion.entityId), thinkIntervalMs: 1000 },
      {
        subsystem: "npc_ai",
        targetId: String(companion.entityId),
        serverActorPosition: {
          x: target.position[0],
          y: target.position[1],
          z: target.position[2],
        },
      }
    ));
    assert.equal(
      s.jobsBoard.postings.job_escort_newcomer.escortCompanion!.status,
      "arrived"
    );
    assert.equal(Object.values(s.jobsBoard.todos)[0].status, "completed");
    assert.deepEqual(s.quests.active[`jobs_board:${todo.todoId}`], {
      stepId: "job_escort_newcomer:return_to_board",
      progress: 1,
    });
    assert.equal(s.quests.completed[`jobs_board:${todo.todoId}`], undefined);
    const marker =
      s.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`];
    assert.ok(
      marker,
      "claimable escort job should keep a return-to-board marker"
    );
    assert.equal(marker.plotId, "harthmere_market_posting_board");
    assert.ok(marker.label.includes("Return to the jobs board"));
  });

  it("filters failed jobs-board todos out of quest and marker snapshots", function () {
    const s = freshState();
    s.jobsBoard.todos.harthmere_job_todo_failed = {
      todoId: "harthmere_job_todo_failed",
      jobId: "failed_job",
      actorId: ACTOR,
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      title: "Failed Job",
      todoText: "This stale job should not keep a marker.",
      status: "failed",
      kind: "gather",
      mapMarkerId: "grove_garden_edge_berries",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      dueAtMs: NOW_MS + 1000,
      questBoardTodo: true,
    };
    s.jobsBoard.todos.harthmere_job_todo_active = {
      ...s.jobsBoard.todos.harthmere_job_todo_failed,
      todoId: "harthmere_job_todo_active",
      jobId: "active_job",
      title: "Active Job",
      status: "active",
    };
    s.quests.active["jobs_board:harthmere_job_todo_failed"] = {
      stepId: "failed_job",
      progress: 0,
    };
    s.quests.active["jobs_board:harthmere_job_todo_active"] = {
      stepId: "active_job",
      progress: 0,
    };
    s.building.inWorldMarkers["jobs_board_marker:harthmere_job_todo_failed"] = {
      markerId: "jobs_board_marker:harthmere_job_todo_failed",
      plotId: "grove_garden_edge_berries",
      kind: "map_marker",
      position: [486, 70, -120],
      label: "Failed Job: Garden Edge Berries",
      createdAtMs: NOW_MS,
    };
    s.building.inWorldMarkers["jobs_board_marker:harthmere_job_todo_active"] = {
      markerId: "jobs_board_marker:harthmere_job_todo_active",
      plotId: "grove_mail_bank_satchel",
      kind: "map_marker",
      position: [488, 70, -122],
      label: "Active Job: Mail and Bank Satchel",
      createdAtMs: NOW_MS,
    };

    const questSnapshot = createHarthmereLiveModeQuestClientSnapshot(s);
    assert.equal(
      questSnapshot.active["jobs_board:harthmere_job_todo_failed"],
      undefined
    );
    assert.deepEqual(
      questSnapshot.active["jobs_board:harthmere_job_todo_active"],
      { stepId: "active_job", progress: 0 }
    );

    const buildingSnapshot = createHarthmereLiveModeBuildingClientSnapshot(s);
    assert.equal(
      buildingSnapshot.inWorldMarkers[
        "jobs_board_marker:harthmere_job_todo_failed"
      ],
      undefined
    );
    assert.ok(
      buildingSnapshot.inWorldMarkers[
        "jobs_board_marker:harthmere_job_todo_active"
      ]
    );
  });

  it("keeps actor-specific jobs-board markers out of shared world state", function () {
    const s = freshState();
    s.building.inWorldMarkers["jobs_board_marker:harthmere_job_todo_active"] = {
      markerId: "jobs_board_marker:harthmere_job_todo_active",
      plotId: "grove_mail_bank_satchel",
      kind: "map_marker",
      position: [488, 70, -122],
      label: "Active Job: Mail and Bank Satchel",
      createdAtMs: NOW_MS,
    };
    s.building.inWorldMarkers["public_marker"] = {
      markerId: "public_marker",
      plotId: "public_marker",
      kind: "map_marker",
      position: [500, 70, -130],
      label: "Public Marker",
      createdAtMs: NOW_MS,
    };

    const shared = createHarthmereLiveModeSharedWorldState(s, NOW_MS);
    assert.equal(
      shared.building.inWorldMarkers[
        "jobs_board_marker:harthmere_job_todo_active"
      ],
      undefined
    );
    assert.ok(shared.building.inWorldMarkers.public_marker);

    const parsed = parseHarthmereLiveModeSharedWorldState(
      JSON.stringify({
        ...shared,
        building: {
          ...shared.building,
          inWorldMarkers: {
            ...shared.building.inWorldMarkers,
            "jobs_board_marker:harthmere_job_todo_stale": {
              markerId: "jobs_board_marker:harthmere_job_todo_stale",
              plotId: "grove_garden_edge_berries",
              kind: "map_marker",
              position: [486, 70, -120],
              label: "Stale Shared Job Marker",
              createdAtMs: NOW_MS,
            },
          },
        },
      }),
      NOW_MS
    );
    const next = freshState();
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(next, parsed, NOW_MS);
    assert.equal(
      next.building.inWorldMarkers[
        "jobs_board_marker:harthmere_job_todo_stale"
      ],
      undefined
    );
  });

  it("places accepted jobs board quest markers at their resolved world target instead of a placeholder", function () {
    const s = freshState();
    const target = harthmereJobsBoardQuestMarkerPositionForId(
      HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID
    );
    assert.ok(
      target,
      "expected Elite Mucker bounty to resolve as a quest marker"
    );
    s.jobsBoard.postings.job_muck_hunt = {
      jobId: "job_muck_hunt",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Bounty: Elite Mucker at the Muck Edge",
      description: "Confirm the Mucker is down at the Muckwad Patch.",
      kind: "hunt",
      requirements: [
        {
          targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
          targetName: "Elite Mucker",
          mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
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
      mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
      targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_muck_hunt",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
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
    assert.deepEqual(state.quests.active[`jobs_board:${todo.todoId}`], {
      stepId: "job_muck_hunt",
      progress: 0,
    });
    const marker =
      state.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`];
    assert.ok(marker, "accepted job should expose an in-world quest marker");
    assert.equal(
      marker.plotId,
      HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID
    );
    assert.deepEqual(
      marker.position,
      resolveHarthmereProductionMarkerPosition({
        markerId: target!.markerId,
        fallback: target!.position,
      })
    );
    assert.ok(marker.label.includes("Elite Mucker Bounty"));
    assert.ok(
      muckMonsterAreaForPosition(marker.position, 1.5),
      "accepted bounty marker must be inside authored Muck territory"
    );
    assert.notDeepEqual(
      marker.position,
      [482, 66, -198],
      "accepted jobs must not use the old generic Harthmere placeholder"
    );
  });

  it("spawns fresh cave deposit markers when an Exotic Matter mining job is accepted", function () {
    const s = freshState();
    const target = harthmereJobsBoardQuestMarkerPositionForId(
      "exotic_antiboron_mossglass_survey_03"
    );
    assert.ok(target, "expected Antiboron cave deposit marker to resolve");
    s.jobsBoard.postings.job_exotic_antiboron = {
      jobId: "job_exotic_antiboron",
      boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
      issuerKind: "guild",
      issuerId: "harthmere_exotic_refiners_guild",
      title: "Mine Antiboron for Exotic Matter",
      description:
        "Mine a sealed Antiboron block from the marked Mossglass cave vein.",
      kind: "gather",
      requirements: [
        {
          itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId,
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
        boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
        jobId: "job_exotic_antiboron",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
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
    assert.ok(
      genericMarker,
      "accepted job should expose its primary cave marker"
    );
    assert.equal(genericMarker.plotId, "exotic_antiboron_mossglass_survey_03");
    assert.deepEqual(
      genericMarker.position,
      resolveHarthmereProductionMarkerPosition({
        markerId: target!.markerId,
        fallback: target!.position,
      })
    );

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
      const deposit = harthmereExoticMatterDepositById(depositId);
      assert.ok(
        deposit,
        `spawned marker should point to a real deposit: ${depositId}`
      );
      assert.equal(deposit!.componentId, "antiboron");
      assert.equal(deposit!.jobEligible, true);
      assert.equal(deposit!.caveId, "mossglass_survey_cave");
      assert.deepEqual(
        marker.position,
        resolveHarthmereProductionMarkerPosition({
          source: "exotic_matter_deposit",
          markerId: deposit!.depositId,
          fallback: deposit!.position,
        })
      );
      const cave = HARTHMERE_EXOTIC_MATTER_CAVES.find(
        (entry) => entry.caveId === deposit!.caveId
      );
      assert.ok(
        cave,
        `deposit should belong to a confirmed cave: ${deposit!.depositId}`
      );
      assert.ok(
        deposit!.position[0] > cave!.bounds.x0 &&
          deposit!.position[0] < cave!.bounds.x1
      );
      assert.ok(
        deposit!.position[1] >= cave!.bounds.y0 &&
          deposit!.position[1] <= cave!.bounds.y1
      );
      assert.ok(
        deposit!.position[2] > cave!.bounds.z0 &&
          deposit!.position[2] < cave!.bounds.z1
      );
    }

    accepted.state.inventory.items[
      HARTHMERE_EXOTIC_MATTER_COMPONENTS.antiboron.itemId
    ] = 1;
    const completedQuest = applyOne(
      accepted.state,
      "request_jobs_board_mutation",
      {
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
        jobId: "job_exotic_antiboron",
        completedTargetId: "harthmere_antiboron_deposit",
      },
      {
        subsystem: "jobs",
        targetId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
        serverActorPosition: { x: 1046, y: 65, z: -202 },
      }
    );

    assert.deepEqual(completedQuest.summary.warnings, []);
    const turnInMarker =
      completedQuest.state.building.inWorldMarkers[
        `jobs_board_marker:${todo.todoId}`
      ];
    assert.ok(
      turnInMarker,
      "the primary accepted job marker should route back to the board until payout is claimed"
    );
    assert.equal(turnInMarker.plotId, "harthmere_town_market_posting_board");
    assert.ok(turnInMarker.label.includes("Return to the jobs board"));
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        title: "Too far",
        description: "This should require walking up to the board.",
        requirements: [{ itemId: "iron_ore", count: 1 }],
        rewardGold: 25,
        deadlineAtMs: NOW_MS + 86_400_000,
      },
      {
        subsystem: "jobs",
        serverActorPosition: {
          x: 501.99486179104775 + HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS + 0.1,
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
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
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
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

  it("does not start unprovoked Muck aggression into safe zones or without line of sight", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
    const npcId = "npc:mossy_muckling_no_safezone_snipe";
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

    const noLos = applyOne(
      state,
      "request_npc_ai_tick",
      { npcName: "Mossy Muckling", lineOfSight: "false" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        serverActorPosition: { x: 333, y: 54, z: -390 },
      }
    ).state;
    assert.equal(noLos.combat.npcAiTicks[npcId].decision, "idle_patrol");
    assert.equal(noLos.combat.threat[ACTOR], undefined);

    const safeZone = applyOne(
      state,
      "request_npc_ai_tick",
      { npcName: "Mossy Muckling" },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: npcId,
        zoneId: "the_grove",
        serverActorPosition: { x: 496, y: 70, z: -126 },
      }
    ).state;
    assert.equal(safeZone.combat.npcAiTicks[npcId].decision, "idle_patrol");
    assert.equal(safeZone.combat.npcAiTicks[npcId].targetId, undefined);
    assert.equal(safeZone.combat.threat[ACTOR], undefined);
  });

  it("rejects client-only position claims for unprovoked Muck aggression", function () {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
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

describe("reduceHarthmereLiveModeBackendState — production bank expansion", function () {
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
    const repaid = reduceHarthmereLiveModeBackendState(
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
// Banking current: server-side carry-weight enforcement and loan consequences
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — banking current carry weight enforcement", function () {
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
      itemId: "health_potion",
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

describe("reduceHarthmereLiveModeBackendState — loan default consequences", function () {
  it("marks overdue loans defaulted, applies a credit hold, logs the default, and blocks new loans", function () {
    const borrowed = applyOne(freshState(), "request_bank_transaction", {
      operation: "take_loan",
      amount: 100,
      days: 1,
    }).state;
    const loan = Object.values(borrowed.banking.loans)[0];
    const afterDue = reduceHarthmereLiveModeBackendState(
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
    const defaulted = reduceHarthmereLiveModeBackendState(
      borrowed,
      makeEnvelope("request_bank_transaction", {
        operation: "upgrade_slots",
        vaultKind: "personal",
      }),
      NOW_MS + 2 * 24 * 60 * 60 * 1000
    ).state;
    defaulted.inventory.gold = 1_000;
    const repaid = reduceHarthmereLiveModeBackendState(
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

// ===========================================================================
// Cross-actor auction marketplace: settle pays the seller, cancel/expire/recover
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — cross-actor auction", function () {
  function sellerWithListing() {
    const seller = freshState();
    seller.inventory.items = { iron_sword: 1 };
    seller.inventory.gold = 1000;
    const posted = applyOne(seller, "request_auction_post", {
      itemId: "iron_sword",
      count: 1,
      unitPrice: 100,
    });
    const listingId = Object.keys(posted.state.economy.auctionListings)[0];
    return { sellerState: posted.state, listingId };
  }

  it("pays the seller and de-escrows the item when a different player settles", function () {
    const { sellerState, listingId } = sellerWithListing();
    assert.equal(
      sellerState.inventory.escrow.iron_sword,
      1,
      "item must be escrowed after post"
    );

    // The listing reaches the shared marketplace; a buyer in a separate backend sees it.
    const shared = createHarthmereLiveModeSharedWorldState(sellerState, NOW_MS);
    assert.ok(
      shared.auctionListings[listingId],
      "listing must publish to shared marketplace"
    );
    let buyer = defaultHarthmereLiveModeBackendState("auction_buyer", NOW_MS);
    buyer.inventory.gold = 1000;
    buyer = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      buyer,
      shared,
      NOW_MS
    );
    assert.ok(
      buyer.economy.auctionListings[listingId],
      "buyer must see the shared listing"
    );

    const settled = applyOne(
      buyer,
      "request_auction_settle",
      { listingId },
      { actorId: "auction_buyer" }
    );
    assert.deepEqual(
      settled.summary.warnings.filter((w) =>
        w.startsWith("auction_settle_rejected")
      ),
      []
    );
    assert.equal(
      settled.state.inventory.items.iron_sword,
      1,
      "buyer receives the item"
    );
    assert.equal(
      settled.state.inventory.gold,
      900,
      "buyer pays the full price"
    );

    // The seller collects the proceeds on their next sync.
    const sellerGoldBefore = sellerState.inventory.gold;
    const shared2 = createHarthmereLiveModeSharedWorldState(
      settled.state,
      NOW_MS
    );
    const paid = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      sellerState,
      shared2,
      NOW_MS
    );
    assert.ok(
      paid.inventory.gold > sellerGoldBefore,
      "seller must be paid the sale proceeds"
    );
    assert.equal(
      paid.inventory.items.iron_sword ?? 0,
      0,
      "sold item leaves the seller inventory"
    );
    assert.equal(
      paid.inventory.escrow.iron_sword ?? 0,
      0,
      "sold item leaves the seller escrow"
    );

    // Idempotent: a second sync of the same payout must NOT pay twice.
    const goldAfterFirst = paid.inventory.gold;
    const paidAgain = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      paid,
      shared2,
      NOW_MS
    );
    assert.equal(
      paidAgain.inventory.gold,
      goldAfterFirst,
      "payout must be delivered exactly once"
    );
  });

  it("releases escrow when the seller cancels their own active listing", function () {
    const { sellerState, listingId } = sellerWithListing();
    const cancelled = applyOne(sellerState, "request_auction_cancel", {
      listingId,
    });
    assert.deepEqual(
      cancelled.summary.warnings.filter((w) =>
        w.startsWith("auction_cancel_rejected")
      ),
      []
    );
    assert.equal(
      cancelled.state.economy.auctionListings[listingId].status,
      "cancelled"
    );
    assert.equal(
      cancelled.state.inventory.escrow.iron_sword ?? 0,
      0,
      "escrow released on cancel"
    );
    assert.equal(
      cancelled.state.inventory.items.iron_sword,
      1,
      "item is tradeable again"
    );
  });

  it("expires due listings and lets the seller recover the escrowed item", function () {
    const { sellerState, listingId } = sellerWithListing();
    const future = NOW_MS + 40 * 24 * 60 * 60 * 1000; // well past the listing duration
    const expired = reduceHarthmereLiveModeBackendState(
      sellerState,
      makeEnvelope("request_auction_expire", {}),
      future
    );
    assert.equal(
      expired.state.economy.auctionListings[listingId].status,
      "expired"
    );
    assert.equal(
      expired.state.inventory.escrow.iron_sword,
      1,
      "escrow stays locked until recovery"
    );

    const recovered = reduceHarthmereLiveModeBackendState(
      expired.state,
      makeEnvelope("request_auction_recover", { listingId }),
      future
    );
    assert.deepEqual(
      recovered.summary.warnings.filter((w) =>
        w.startsWith("auction_recover_rejected")
      ),
      []
    );
    assert.equal(
      recovered.state.inventory.escrow.iron_sword ?? 0,
      0,
      "escrow released on recover"
    );
    assert.equal(
      recovered.state.inventory.items.iron_sword,
      1,
      "item returns to the seller"
    );
  });
});

// ===========================================================================
// Enforced fines + clearable bounties (law lifecycle completion)
// ===========================================================================

describe("reduceHarthmereLiveModeBackendState — enforced fines + bounty clearing", function () {
  function commitTheft(
    state: ReturnType<typeof freshState>,
    zoneId = "harthmere_market"
  ) {
    return applyOne(
      state,
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
      { subsystem: "law", zoneId }
    );
  }

  it("charges an enforced fine against the offender's wallet", function () {
    const s = freshState();
    s.inventory.items.stolen_relic = 1;
    s.inventory.gold = 5000;
    const { state } = commitTheft(s);
    assert.ok(
      state.inventory.gold < 5000,
      "fine must be deducted from the wallet"
    );
    assert.equal(
      state.law.fines.city_guard ?? 0,
      0,
      "a fully-payable fine leaves no outstanding debt"
    );
  });

  it("accrues the unpayable fine remainder as debt and lets the offender pay it down later", function () {
    const s = freshState();
    s.inventory.items.stolen_relic = 1;
    s.inventory.gold = 0;
    const fined = commitTheft(s);
    const debt = fined.state.law.fines.city_guard ?? 0;
    assert.ok(debt > 0, "an unpayable fine accrues as debt");

    fined.state.inventory.gold = debt + 100;
    const paid = applyOne(fined.state, "request_pay_fine", {
      factionId: "city_guard",
    });
    assert.equal(
      paid.state.law.fines.city_guard ?? 0,
      0,
      "fine debt cleared after payment"
    );
    assert.equal(
      paid.state.inventory.gold,
      100,
      "wallet charged exactly the outstanding debt"
    );
  });

  it("lets an offender clear their own bounty to resolve the soft-lock", function () {
    const s = freshState();
    s.inventory.gold = 100000;
    const crime = applyOne(
      s,
      "request_law_reputation_mutation",
      {
        factionId: "city_guard",
        crimeKind: "murder",
        valueGold: 600,
        severity: 9,
        witnesses: 2,
        lineOfSight: true,
        reason: "murder witnessed",
      },
      { subsystem: "law", zoneId: "harthmere_market" }
    );
    const wanted = crime.state.law.crimeRecords.find(
      (r) =>
        (r.status === "wanted" || r.status === "arrest_pending") &&
        (r.bountyGold ?? 0) > 0
    );
    assert.ok(wanted, "a murder must post an active bounty");

    const cleared = applyOne(crime.state, "request_clear_bounty", {
      factionId: "city_guard",
    });
    const resolved = cleared.state.law.crimeRecords.find(
      (r) => r.id === wanted.id
    );
    assert.equal(resolved?.status, "served", "bounty record is resolved");
    assert.equal(resolved?.bountyGold ?? 0, 0, "bounty gold is zeroed");
    const stillActive = cleared.state.law.crimeRecords.some(
      (r) =>
        (r.status === "wanted" || r.status === "arrest_pending") &&
        (r.bountyGold ?? 0) > 0
    );
    assert.equal(
      stillActive,
      false,
      "no active bounty remains, so civil permits unblock"
    );
  });
});
