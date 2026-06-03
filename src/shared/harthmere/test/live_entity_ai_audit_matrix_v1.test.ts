/// <reference types="mocha" />

import assert from "assert";
import { harthmereMuckCreatureAssetKeyForLabelV1 } from "../muck_creature_assets_v1";
import {
  createHarthmereLiveEntityCombatSnapshotsFromEcsRecordsV1,
} from "../live_entity_ecs_bridge_v1";
import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  validateHarthmereLiveEntityProductionSeedsV1,
} from "../live_entity_production_seed_v1";
import {
  evaluateMuckMonsterAggressionV1,
  muckMonsterAreaForPositionV1,
} from "../muck_monster_aggression_ai_v1";
import {
  HARTHMERE_COMBAT_AI_ARCHETYPES_V1,
  chooseHarthmereCombatAIDecisionV1,
  validateHarthmereCombatAIReadinessV1,
} from "../third_party_combat_ai_v1";
import {
  createHarthmereNpcNavigationStateV1,
  resolveHarthmereNpcNavigationStepV1,
} from "../npc_navigation_guard_v1";

const NOW_MS = 1_800_001_000_000;

function flatGround(feetY: number) {
  return (_x: number, _z: number, _preferredY: number) => feetY;
}

describe("Harthmere live entity AI audit matrix v1", () => {
  it("classifies NPCs, guards, animals, pets, monsters, robots, and objects with the right combat semantics", () => {
    const snapshots = createHarthmereLiveEntityCombatSnapshotsFromEcsRecordsV1({
      "b:guide": {
        npc_metadata: { type_id: 1, spawn_position: [10, 53, 10] },
        position: { v: [10, 53, 10] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Mira, Town Guide" },
      },
      "b:guard": {
        npc_metadata: { type_id: 2, spawn_position: [12, 53, 10] },
        position: { v: [12, 53, 10] },
        health: { hp: 180, maxHp: 180 },
        label: { text: "Grove Guard Captain" },
      },
      "b:pet": {
        npc_metadata: { type_id: 3, spawn_position: [14, 53, 10] },
        position: { v: [14, 53, 10] },
        health: { hp: 40, maxHp: 40 },
        label: { text: "Player Pet Fox" },
        ownerId: "player_pet_owner",
      },
      "b:deer": {
        npc_metadata: { type_id: 4, spawn_position: [16, 53, 10] },
        position: { v: [16, 53, 10] },
        health: { hp: 35, maxHp: 35 },
        label: { text: "Protected Chapel Deer" },
        protectedSpecies: true,
      },
      "b:muckwad": {
        npc_metadata: { type_id: 5, spawn_position: [512, 54, -152] },
        position: { v: [512, 54, -152] },
        health: { hp: 110, maxHp: 110 },
        label: { text: "Road Muckwad 14" },
      },
      "b:hexer": {
        npc_metadata: { type_id: 6, spawn_position: [640, 54, 120] },
        position: { v: [640, 54, 120] },
        health: { hp: 150, maxHp: 150 },
        label: { text: "Gravewood Pale Hexer 7" },
      },
      "b:robot": {
        npc_metadata: { type_id: 7, spawn_position: [236, 54, -506] },
        position: { v: [236, 54, -506] },
        robot_component: { internal_battery_charge: 80 },
        health: { hp: 140, maxHp: 140 },
        label: { text: "West Muck Breach Sentinel" },
      },
      "b:board": {
        position: { v: [500, 53, -130] },
        placeable_component: { item_id: 99 },
        label: { text: "Market Jobs Board Place Label" },
      },
    });

    assert.equal(snapshots["b:guide"].entityKind, "human");
    assert.equal(snapshots["b:guide"].combatProtection, "friendly_noncombatant");
    assert.equal(snapshots["b:guide"].isAttackable, false);
    assert.equal(snapshots["b:guide"].aiEnabled, false);

    assert.equal(snapshots["b:guard"].entityKind, "human");
    assert.equal(snapshots["b:guard"].combatProtection, undefined);
    assert.equal(snapshots["b:guard"].isHostile, false);
    assert.equal(snapshots["b:guard"].isAttackable, true);
    assert.equal(snapshots["b:guard"].retaliatesWhenAttacked, true);

    assert.equal(snapshots["b:pet"].entityKind, "animal");
    assert.equal(snapshots["b:pet"].ownerId, "player_pet_owner");
    assert.equal(snapshots["b:pet"].aiEnabled, true);
    assert.equal(snapshots["b:pet"].retaliatesWhenAttacked, true);

    assert.equal(snapshots["b:deer"].entityKind, "animal");
    assert.equal(snapshots["b:deer"].combatProtection, "protected_species");
    assert.equal(snapshots["b:deer"].isAttackable, false);

    assert.equal(snapshots["b:muckwad"].entityKind, "mux");
    assert.equal(snapshots["b:muckwad"].isHostile, true);
    assert.equal(snapshots["b:muckwad"].isAttackable, true);
    assert.equal(snapshots["b:hexer"].entityKind, "hex");
    assert.equal(snapshots["b:hexer"].isHostile, true);
    assert.equal(snapshots["b:hexer"].isAttackable, true);

    assert.equal(snapshots["b:robot"].entityKind, "robot");
    assert.equal(snapshots["b:robot"].isHostile, false);
    assert.equal(snapshots["b:robot"].aiEnabled, true);
    assert.equal(snapshots["b:robot"].isAttackable, true);

    assert.equal(snapshots["b:board"].entityKind, "object");
    assert.equal(snapshots["b:board"].combatProtection, "label_or_place");
    assert.equal(snapshots["b:board"].aiEnabled, false);
    assert.equal(snapshots["b:board"].isAttackable, false);
  });

  it("keeps every production Mucker, Hexer, and robot sentinel in valid authored locations with renderable creature assets", () => {
    const errors = validateHarthmereLiveEntityProductionSeedsV1();
    assert.deepEqual(errors, []);
    assert.equal(
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1
    );

    const seenAreas = new Set<string>();
    let hexCount = 0;
    for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1) {
      const territory = muckMonsterAreaForPositionV1(seed.position, 1.5);
      assert.ok(territory, `${seed.displayName} must be in Muck territory`);
      if (territory!.id !== seed.areaId) {
        assert.match(
          `${territory!.id}:${seed.areaId}`,
          /muck/,
          `${seed.displayName} may only overlap another authored Muck sub-area`
        );
      }
      assert.ok(Number.isFinite(seed.position[1]), `${seed.displayName} y`);
      assert.ok((seed.combatHp ?? 0) >= 100, `${seed.displayName} hp`);
      assert.ok((seed.combatLevel ?? 0) >= 2, `${seed.displayName} level`);
      assert.ok(
        seed.combatKind === "mux" || seed.combatKind === "hex",
        `${seed.displayName} combat kind`
      );
      if (seed.combatKind === "hex") {
        hexCount += 1;
      }
      assert.ok(
        harthmereMuckCreatureAssetKeyForLabelV1(seed.displayName),
        `${seed.displayName} must resolve to a Mucker/Hexer creature asset`
      );
      seenAreas.add(seed.areaId);
    }
    assert.ok(hexCount > 0, "production must include Hexes");
    assert.ok(seenAreas.size >= 7, "production must cover every authored Muck layout");

    for (const seed of HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1) {
      assert.ok(seed.robotId, `${seed.displayName} robot id`);
      assert.equal(seed.energy, seed.maxEnergy);
      assert.ok((seed.maxEnergy ?? 0) > 0, `${seed.displayName} max energy`);
    }
  });

  it("selects server-validated AI intents for every combat archetype and blocks Muck aggression outside safe rules", () => {
    const readiness = validateHarthmereCombatAIReadinessV1();
    assert.equal(readiness.ok, true, readiness.errors.join(", "));
    assert.ok(readiness.productionReadiness.includes("server_authoritative_validation"));

    for (const archetypeId of Object.keys(HARTHMERE_COMBAT_AI_ARCHETYPES_V1)) {
      const decision = chooseHarthmereCombatAIDecisionV1({
        actorId: `audit_${archetypeId}`,
        targetId: "audit_player",
        archetypeId,
        nowMs: NOW_MS,
        distanceToTarget: archetypeId === "archer_kiter" ? 14 : 2,
        lineOfSight: true,
        facingTarget: true,
        healthPercent: archetypeId === "healer_support" ? 0.8 : 1,
        staminaPercent: 1,
        manaPercent: 1,
        allyHealthLowestPercent: archetypeId === "healer_support" ? 0.2 : 1,
        alliesNearby: 1,
        enemiesNearby: 1,
        legalTargets: ["audit_player"],
        pvpAllowed: true,
        position: { x: 0, y: 53, z: 0 },
        targetPosition: { x: 2, y: 53, z: 0 },
        deterministicSeed: 42,
      });
      assert.equal(decision.legal, true, `${archetypeId} decision`);
      assert.equal(decision.actorId, `audit_${archetypeId}`);
      assert.ok(decision.auditTags.includes("server_authority_required"));
      assert.ok(
        decision.serverActionRequest.serverMustValidate.includes("range")
      );
      assert.ok(decision.serverActionRequest.rejectedClientClaims.includes("damage"));
    }

    const muckSeed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1[0];
    const aggro = evaluateMuckMonsterAggressionV1({
      monsterId: String(muckSeed.entityId),
      monsterName: muckSeed.displayName,
      monsterPosition: muckSeed.position,
      playerPosition: [muckSeed.position[0] + 1, muckSeed.position[1], muckSeed.position[2]],
      nowMs: NOW_MS,
    });
    assert.equal(aggro.aggressive, true);
    assert.equal(aggro.reason, "player_entered_muck_territory");

    const townBlocked = evaluateMuckMonsterAggressionV1({
      monsterId: "town_muckwad_regression",
      monsterName: "Road Muckwad",
      monsterPosition: [20, 53, 20],
      playerPosition: [21, 53, 20],
      nowMs: NOW_MS,
    });
    assert.equal(townBlocked.aggressive, false);
    assert.equal(townBlocked.reason, "monster_outside_muck_territory");

    const spawnProtected = evaluateMuckMonsterAggressionV1({
      monsterId: String(muckSeed.entityId),
      monsterName: muckSeed.displayName,
      monsterPosition: muckSeed.position,
      playerPosition: [muckSeed.position[0] + 1, muckSeed.position[1], muckSeed.position[2]],
      spawnProtected: true,
      nowMs: NOW_MS,
    });
    assert.equal(spawnProtected.aggressive, false);
    assert.equal(
      spawnProtected.reason,
      "spawn_protection_blocks_muck_aggression"
    );
  });

  it("uses the same navigation guardrails for town NPCs, animals, and combat monsters so they do not float or bury", () => {
    const cases = [
      {
        label: "town owner",
        mode: "town_wander" as const,
        current: [486, 60, -209] as const,
        desired: [487, 60, -209] as const,
      },
      {
        label: "pet",
        mode: "route_patrol" as const,
        current: [25, 48, -14] as const,
        desired: [25.6, 48, -14.2] as const,
      },
      {
        label: "Mucker",
        mode: "combat_chase" as const,
        current: [512, 58, -152] as const,
        desired: [513, 58, -152] as const,
      },
    ];

    for (const entry of cases) {
      const state = createHarthmereNpcNavigationStateV1();
      const result = resolveHarthmereNpcNavigationStepV1({
        mode: entry.mode,
        currentPosition: entry.current,
        desiredPosition: entry.desired,
        state,
        groundYAt: flatGround(53),
      });
      assert.equal(result.position[1], 53, entry.label);
      assert.equal(result.blocked, false, entry.label);
      assert.equal(result.resolution, "direct", entry.label);
      assert.deepEqual(state.lastSafePosition, result.position, entry.label);
    }
  });
});
