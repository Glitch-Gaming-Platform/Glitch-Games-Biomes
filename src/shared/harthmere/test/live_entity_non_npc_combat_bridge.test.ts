/// <reference types="mocha" />

import assert from "assert";
import {
  createHarthmereLiveModePlayerStatusClientSnapshot,
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import { createHarthmereLiveEntityCombatSnapshotsFromEcsRecords } from "../live_entity_ecs_bridge";
import {
  registerHarthmereAbility,
  registerHarthmereClassDefinition,
  type HarthmereAbilityCatalogueEntry,
  type HarthmereClassDefinition,
} from "../mmo_combat_authority";
import {
  registerHarthmereItemDefinition,
  type HarthmereItemDefinition,
} from "../mmo_inventory_authority";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const NOW_MS = 1_700_000_900_000;
const ACTOR = "player_non_npc_live_entity_test";

let sequence = 0;

function nextId(prefix = "non-npc-live-entity") {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function freshState() {
  return defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
}

function makeEnvelope(
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
  const requestId = overrides.requestId ?? nextId();
  return {
    requestId,
    idempotencyKey: overrides.idempotencyKey ?? `${requestId}:key`,
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

function applyOne(
  state: HarthmereLiveModeBackendState,
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {},
  nowMs = NOW_MS
) {
  return reduceHarthmereLiveModeBackendState(
    state,
    makeEnvelope(actionKind, payload, overrides),
    nowMs
  );
}

function nonNpcEcsRecords() {
  return {
    "b:non_npc_wolf_1": {
      position: { v: [1, 0, 0] },
      health: { hp: 80, maxHp: 80 },
      species: "wolf",
      label: { text: "Forest Wolf" },
    },
    "b:non_npc_robot_1": {
      position: { v: [2, 0, 0] },
      robot_component: { internal_battery_charge: 40 },
      health: { hp: 140, maxHp: 140 },
      label: { text: "Archive Robot Sentinel" },
    },
    "b:non_npc_muckling_1": {
      position: { v: [3, 0, 0] },
      health: { hp: 120, maxHp: 120 },
      label: { text: "Road Muckling" },
    },
    "b:non_npc_hexer_1": {
      position: { v: [4, 0, 0] },
      health: { hp: 120, maxHp: 120 },
      label: { text: "Greater Hexer" },
    },
    "b:non_npc_place_1": {
      position: { v: [1, 0, 0] },
      health: { hp: 50, maxHp: 50 },
      placeable_component: {},
      label: { text: "Market Jobs Board Place Label" },
    },
  } satisfies Record<string, unknown>;
}

before(function registerNonNpcLiveEntityCombatFixtures() {
  const rawMeat: HarthmereItemDefinition = {
    itemId: "raw_meat",
    displayName: "Raw Meat",
    maxStackSize: 999,
    baseValue: 2,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 0.2 },
    tradeable: true,
  };
  const hideScrap: HarthmereItemDefinition = {
    itemId: "test_hide_scrap",
    displayName: "Test Hide Scrap",
    maxStackSize: 99,
    baseValue: 3,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 0.2 },
    tradeable: true,
  };
  registerHarthmereItemDefinition(rawMeat);
  registerHarthmereItemDefinition(hideScrap);

  const playerBodyAttack: HarthmereAbilityCatalogueEntry = {
    abilityId: "non_npc_player_body_attack_test",
    displayName: "Non-NPC Player Body Attack Test",
    targetType: "single_enemy",
    classRestriction: ["warrior"],
    specRestriction: [],
    levelRequirement: 1,
    requiredWeaponType: "any",
    resourceKind: "stamina",
    resourceCost: 0,
    cooldownMs: 250,
    rangeUnits: 2,
    requiresLineOfSight: false,
    allowedInSafeZone: true,
    allowedInPvP: false,
    baseDamage: 28,
    baseHealing: 0,
    attackPowerScaling: 0,
    spellPowerScaling: 0,
    xpReward: 0,
    castTimeMs: 0,
    interruptible: false,
    unlocksMilestones: [],
  };
  const nonNpcBodyAttack: HarthmereAbilityCatalogueEntry = {
    abilityId: "non_npc_body_attack_test",
    displayName: "Non-NPC Body Attack Test",
    targetType: "single_enemy",
    classRestriction: [],
    specRestriction: [],
    levelRequirement: 1,
    requiredWeaponType: "unarmed",
    resourceKind: "stamina",
    resourceCost: 5,
    cooldownMs: 750,
    rangeUnits: 3.2,
    requiresLineOfSight: false,
    allowedInSafeZone: true,
    allowedInPvP: true,
    baseDamage: 17,
    baseHealing: 0,
    attackPowerScaling: 0,
    spellPowerScaling: 0,
    xpReward: 0,
    castTimeMs: 0,
    interruptible: false,
    unlocksMilestones: [],
  };
  const warrior: HarthmereClassDefinition = {
    classId: "warrior",
    displayName: "Warrior",
    availableSpecializations: ["arms"],
    primaryResource: "stamina",
    maxResourceByLevel: { 1: 100 },
    hpPerLevel: 10,
    baseHp: 100,
    attackPowerPerLevel: 2,
    spellPowerPerLevel: 1,
  };
  registerHarthmereAbility(playerBodyAttack);
  registerHarthmereAbility(nonNpcBodyAttack);
  registerHarthmereClassDefinition(warrior);
});

describe("non-NPC b:<id> live entity combat bridge current", () => {
  it("converts non-NPC ECS records without npc_metadata into combat-capable snapshots", () => {
    const bridged = createHarthmereLiveEntityCombatSnapshotsFromEcsRecords(
      nonNpcEcsRecords()
    );

    assert.equal(bridged["b:non_npc_wolf_1"].entityKind, "animal");
    assert.equal(bridged["b:non_npc_wolf_1"].isAttackable, true);
    assert.equal(bridged["b:non_npc_wolf_1"].retaliatesWhenAttacked, true);
    assert.equal(bridged["b:non_npc_robot_1"].entityKind, "robot");
    assert.equal(bridged["b:non_npc_muckling_1"].entityKind, "mux");
    assert.equal(bridged["b:non_npc_hexer_1"].entityKind, "hex");
    assert.equal(bridged["b:non_npc_place_1"].entityKind, "object");
    assert.equal(bridged["b:non_npc_place_1"].isAttackable, false);
    assert.equal(
      bridged["b:non_npc_place_1"].combatProtection,
      "label_or_place"
    );
  });

  it("lets a real non-NPC b:<id> entity take damage, retaliate, spend stamina, and update the player HUD snapshot", () => {
    const bridged = createHarthmereLiveEntityCombatSnapshotsFromEcsRecords(
      nonNpcEcsRecords()
    );
    const entityId = "b:non_npc_wolf_1";
    let state = freshState();
    state.classMagic.classId = "warrior";
    state.classMagic.knownAbilities = ["non_npc_player_body_attack_test"];
    state.classMagic.loadout = { slot_0: "non_npc_player_body_attack_test" };
    state.combat.hp = 100;
    state.combat.maxHp = 100;
    state.combat.resources.stamina = 100;
    state.combat.maxResources.stamina = 100;
    state.combat.entitySnapshots[entityId] = {
      ...bridged[entityId],
      resources: { stamina: 20 },
      maxResources: { stamina: 20 },
    };

    ({ state } = applyOne(
      state,
      "request_attack",
      { abilityId: "non_npc_player_body_attack_test" },
      {
        targetId: entityId,
        requestId: "non_npc_b_wolf_player_hit",
        idempotencyKey: "non_npc_b_wolf_player_hit_key",
      }
    ));

    assert.equal(state.combat.entitySnapshots[entityId].lastAttackerId, ACTOR);
    assert.ok(state.combat.entitySnapshots[entityId].hp < 80);
    assert.ok((state.combat.threat[entityId] ?? 0) > 0);

    ({ state } = applyOne(
      state,
      "request_npc_ai_tick",
      {
        npcId: entityId,
        npcAbilityId: "non_npc_body_attack_test",
      },
      {
        source: "server_scheduled_tick",
        subsystem: "npc_ai",
        targetId: entityId,
        serverActorPosition: { x: 1.4, y: 0, z: 0 },
        requestId: "non_npc_b_wolf_ai_counter",
        idempotencyKey: "non_npc_b_wolf_ai_counter_key",
      }
    ));

    const tick = state.combat.npcAiTicks[entityId];
    assert.equal(tick.entityKind, "animal");
    assert.equal(tick.decision, "retaliate_to_recent_attacker");
    assert.equal(tick.targetId, ACTOR);
    assert.equal(tick.animationState, "idle");
    assert.equal(tick.playerHpBefore, 100);
    assert.ok((tick.playerDamage ?? 0) > 0);
    assert.equal(tick.playerHpAfter, state.combat.hp);
    assert.equal(state.combat.hp, 83);
    assert.equal(state.combat.entitySnapshots[entityId].resources?.stamina, 15);

    const status = createHarthmereLiveModePlayerStatusClientSnapshot(state);
    assert.equal(status.combat.hp, state.combat.hp);
    assert.equal(status.combat.resources.stamina, 100);
    assert.equal(status.combat.deathState, "alive");
  });

  it("routes non-NPC b:<id> death through live loot drop creation and pickup", () => {
    const bridged = createHarthmereLiveEntityCombatSnapshotsFromEcsRecords({
      "b:non_npc_boar_loot_1": {
        position: { v: [1, 0, 0] },
        health: { hp: 1, maxHp: 30 },
        species: "boar",
        label: { text: "Wild Boar Without NPC Metadata" },
        lootDrops: { test_hide_scrap: 1 },
      },
    });
    const entityId = "b:non_npc_boar_loot_1";
    let state = freshState();
    state.classMagic.classId = "warrior";
    state.classMagic.knownAbilities = ["non_npc_player_body_attack_test"];
    state.classMagic.loadout = { slot_0: "non_npc_player_body_attack_test" };
    state.combat.entitySnapshots[entityId] = {
      ...bridged[entityId],
      hp: 1,
      lootDrops: { test_hide_scrap: 1 },
    };

    ({ state } = applyOne(
      state,
      "request_attack",
      { abilityId: "non_npc_player_body_attack_test" },
      {
        targetId: entityId,
        requestId: "non_npc_b_boar_kill",
        idempotencyKey: "non_npc_b_boar_kill_key",
      }
    ));

    const defeated = state.combat.entitySnapshots[entityId];
    assert.equal(defeated.isAlive, false);
    assert.ok(defeated.lootDropId);
    const dropId = defeated.lootDropId;
    const drop = state.inventoryLoot.lootDrops[dropId];
    assert.equal(drop.sourceKind, "live_entity:animal");
    assert.equal(drop.sourceId, entityId);
    assert.equal(drop.itemStacks.test_hide_scrap, 1);
    assert.equal(drop.itemStacks.raw_meat, 2);

    const invalid = applyOne(
      state,
      "request_loot_claim",
      { dropId, pickupToken: "wrong-token" },
      {
        requestId: "non_npc_b_boar_claim_invalid",
        idempotencyKey: "non_npc_b_boar_claim_invalid_key",
      }
    );
    assert.ok(
      invalid.summary.warnings.includes("loot_rejected:invalid_pickup_token")
    );
    assert.equal(invalid.state.inventoryLoot.lootDrops[dropId].status, "available");

    const claimed = applyOne(
      state,
      "request_loot_claim",
      { dropId, pickupToken: drop.pickupToken },
      {
        requestId: "non_npc_b_boar_claim",
        idempotencyKey: "non_npc_b_boar_claim_key",
      }
    ).state;
    assert.equal(claimed.inventoryLoot.lootDrops[dropId].status, "claimed");
    assert.equal(claimed.banking.materialStorage.test_hide_scrap, 1);
    assert.equal(claimed.banking.materialStorage.raw_meat, 2);
  });

  it("keeps non-NPC b:<id> labels and places out of the damage path even with health", () => {
    const bridged = createHarthmereLiveEntityCombatSnapshotsFromEcsRecords(
      nonNpcEcsRecords()
    );
    const entityId = "b:non_npc_place_1";
    const state = freshState();
    state.classMagic.classId = "warrior";
    state.classMagic.knownAbilities = ["non_npc_player_body_attack_test"];
    state.classMagic.loadout = { slot_0: "non_npc_player_body_attack_test" };
    state.combat.entitySnapshots[entityId] = {
      ...bridged[entityId],
    };

    const rejected = applyOne(
      state,
      "request_attack",
      { abilityId: "non_npc_player_body_attack_test" },
      {
        targetId: entityId,
        requestId: "non_npc_b_place_reject",
        idempotencyKey: "non_npc_b_place_reject_key",
      }
    );

    assert.equal(rejected.state.combat.entitySnapshots[entityId].hp, 50);
    assert.ok(
      rejected.summary.warnings.some((warning) =>
        warning.startsWith("combat_rejected:")
      )
    );
    assert.equal(
      rejected.state.combat.entitySnapshots[entityId].lootDropId,
      undefined
    );
  });
});
