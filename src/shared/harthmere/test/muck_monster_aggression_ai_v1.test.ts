/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS_V1,
  evaluateMuckMonsterAggressionV1,
  isMuckMonsterNameV1,
  muckMonsterAreaForPositionV1,
  muckMonsterCombatArchetypeV1,
} from "../muck_monster_aggression_ai_v1";
import { validateHarthmereCombatAIReadinessV1 } from "../third_party_combat_ai_v1";

const NOW_MS = 1_700_000_000_000;

describe("muck_monster_aggression_ai_v1", () => {
  it("uses the production combat AI readiness stack for Muck creatures", () => {
    const readiness = validateHarthmereCombatAIReadinessV1();
    assert.equal(readiness.ok, true);
    assert.ok(readiness.productionReadiness.includes("intent_only_ai"));
    assert.ok(readiness.productionReadiness.includes("server_authoritative_validation"));
    assert.equal(isMuckMonsterNameV1("Muck-Scarred Helix"), true);
    assert.equal(isMuckMonsterNameV1("West Breach Shield Robot"), false);
    assert.equal(isMuckMonsterNameV1("Mucked Restoro Bot"), false);
    assert.equal(isMuckMonsterNameV1("Archive Sentential"), false);
  });

  it("becomes aggressive when a player enters close Muck territory", () => {
    const result = evaluateMuckMonsterAggressionV1({
      monsterId: "muckling-001",
      monsterName: "Mossy Muckling",
      monsterPosition: [332, 54, -390],
      playerPosition: [334, 54, -391],
      nowMs: NOW_MS,
    });
    assert.equal(result.aggressive, true);
    assert.equal(result.reason, "player_entered_muck_territory");
    assert.equal(result.territoryId, "watchtower_muck_patch");
    assert.equal(result.archetypeId, "pack_wolf");
    assert.notEqual(result.decision?.selectedActionId, "idle_watch");
    assert.equal(result.decision?.serverActionRequest.actorId, "muckling-001");
    assert.equal(result.decision?.targetId, "player");
  });

  it("warns but does not aggro outside the small unprovoked radius", () => {
    const result = evaluateMuckMonsterAggressionV1({
      monsterId: "mucker-002",
      monsterName: "Old Wood Mucker",
      monsterPosition: [640, 54, -455],
      playerPosition: [640 + MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS_V1 + 2, 54, -455],
      nowMs: NOW_MS,
    });
    assert.equal(result.aggressive, false);
    assert.equal(result.reason, "outside_unprovoked_aggro_radius");
    assert.equal(result.warning, true);
  });

  it("does not aggro from protected areas, spawn protection, or outside Muck", () => {
    const protectedResult = evaluateMuckMonsterAggressionV1({
      monsterId: "muckling-protected",
      monsterName: "Mossy Muckling",
      monsterPosition: [332, 54, -390],
      playerPosition: [333, 54, -390],
      safeZone: true,
      nowMs: NOW_MS,
    });
    assert.equal(protectedResult.aggressive, false);
    assert.equal(
      protectedResult.reason,
      "protected_area_blocks_muck_aggression"
    );

    const spawnProtected = evaluateMuckMonsterAggressionV1({
      monsterId: "muckling-spawn",
      monsterName: "Mossy Muckling",
      monsterPosition: [332, 54, -390],
      playerPosition: [333, 54, -390],
      spawnProtected: true,
      nowMs: NOW_MS,
    });
    assert.equal(spawnProtected.aggressive, false);
    assert.equal(
      spawnProtected.reason,
      "spawn_protection_blocks_muck_aggression"
    );

    const outsideMuck = evaluateMuckMonsterAggressionV1({
      monsterId: "muckling-outside",
      monsterName: "Mossy Muckling",
      monsterPosition: [20, 54, 20],
      playerPosition: [21, 54, 20],
      nowMs: NOW_MS,
    });
    assert.equal(outsideMuck.aggressive, false);
    assert.equal(outsideMuck.reason, "monster_outside_muck_territory");
  });

  it("uses boss AI for Helix encounters in the West Muck Breach", () => {
    const territory = muckMonsterAreaForPositionV1([232, 54, -506]);
    assert.equal(territory?.id, "west_muck_breach");
    assert.equal(
      muckMonsterCombatArchetypeV1("Muck-Scarred Helix"),
      "boss_phase_controller"
    );

    const result = evaluateMuckMonsterAggressionV1({
      monsterId: "muck-boss",
      monsterName: "Muck-Scarred Helix",
      monsterPosition: [232, 54, -506],
      playerPosition: [234, 54, -507],
      monsterHpPercent: 0.42,
      nowMs: NOW_MS,
    });
    assert.equal(result.aggressive, true);
    assert.equal(result.archetypeId, "boss_phase_controller");
    assert.equal(result.decision?.serverActionRequest.actorId, "muck-boss");
    assert.ok(
      result.decision?.auditTags.includes("archetype:boss_phase_controller")
    );
  });
});
