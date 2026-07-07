/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS,
  evaluateMuckMonsterAggression,
  isMuckMonsterName,
  muckMonsterAreaForPosition,
  muckMonsterCombatArchetype,
} from "../muck_monster_aggression_ai";
import { validateHarthmereCombatAIReadiness } from "../third_party_combat_ai";

const NOW_MS = 1_700_000_000_000;
const NIGHT_NOW_MS = NOW_MS + 2_800_000;

describe("muck_monster_aggression_ai", () => {
  it("uses the production combat AI readiness stack for Muck creatures", () => {
    const readiness = validateHarthmereCombatAIReadiness();
    assert.equal(readiness.ok, true);
    assert.ok(readiness.productionReadiness.includes("intent_only_ai"));
    assert.ok(
      readiness.productionReadiness.includes("server_authoritative_validation")
    );
    assert.equal(isMuckMonsterName("Muck-Scarred Helix"), true);
    assert.equal(isMuckMonsterName("West Breach Shield Robot"), false);
    assert.equal(isMuckMonsterName("Mucked Restoro Bot"), false);
    assert.equal(isMuckMonsterName("Archive Sentential"), false);
  });

  it("becomes aggressive when a player enters close Muck territory", () => {
    const result = evaluateMuckMonsterAggression({
      monsterId: "muckling-001",
      monsterName: "Mossy Muckling",
      monsterPosition: [332, 54, -390],
      playerPosition: [334, 54, -391],
      nowMs: NIGHT_NOW_MS,
    });
    assert.equal(result.aggressive, true);
    assert.equal(result.reason, "player_entered_muck_territory");
    assert.equal(result.territoryId, "watchtower_muck_patch");
    assert.equal(result.archetypeId, "pack_wolf");
    assert.notEqual(result.decision?.selectedActionId, "idle_watch");
    assert.equal(result.decision?.serverActionRequest.actorId, "muckling-001");
    assert.equal(result.decision?.targetId, "player");
  });

  it("does not start unprovoked aggression during the day", () => {
    const result = evaluateMuckMonsterAggression({
      monsterId: "muckling-daylight",
      monsterName: "Mossy Muckling",
      monsterPosition: [332, 54, -390],
      playerPosition: [334, 54, -391],
      nowMs: NOW_MS,
    });
    assert.equal(result.aggressive, false);
    assert.equal(result.reason, "daylight_blocks_unprovoked_muck_aggression");
  });

  it("warns but does not aggro outside the small unprovoked radius", () => {
    const result = evaluateMuckMonsterAggression({
      monsterId: "mucker-002",
      monsterName: "Old Wood Mucker",
      monsterPosition: [640, 54, -455],
      playerPosition: [
        640 + MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS + 2,
        54,
        -455,
      ],
      nowMs: NIGHT_NOW_MS,
    });
    assert.equal(result.aggressive, false);
    assert.equal(result.reason, "outside_unprovoked_aggro_radius");
    assert.equal(result.warning, true);
  });

  it("does not aggro from protected areas, spawn protection, or outside Muck", () => {
    const protectedResult = evaluateMuckMonsterAggression({
      monsterId: "muckling-protected",
      monsterName: "Mossy Muckling",
      monsterPosition: [332, 54, -390],
      playerPosition: [333, 54, -390],
      safeZone: true,
      nowMs: NIGHT_NOW_MS,
    });
    assert.equal(protectedResult.aggressive, false);
    assert.equal(
      protectedResult.reason,
      "protected_area_blocks_muck_aggression"
    );

    const spawnProtected = evaluateMuckMonsterAggression({
      monsterId: "muckling-spawn",
      monsterName: "Mossy Muckling",
      monsterPosition: [332, 54, -390],
      playerPosition: [333, 54, -390],
      spawnProtected: true,
      nowMs: NIGHT_NOW_MS,
    });
    assert.equal(spawnProtected.aggressive, false);
    assert.equal(
      spawnProtected.reason,
      "spawn_protection_blocks_muck_aggression"
    );

    const outsideMuck = evaluateMuckMonsterAggression({
      monsterId: "muckling-outside",
      monsterName: "Mossy Muckling",
      monsterPosition: [20, 54, 20],
      playerPosition: [21, 54, 20],
      nowMs: NOW_MS,
    });
    assert.equal(outsideMuck.aggressive, false);
    assert.equal(outsideMuck.reason, "monster_outside_muck_territory");
  });

  it("never starts unprovoked aggression in the Road Ahead starter muck patch", () => {
    // A brand-new player breaking the muckwad in the tutorial patch must not be
    // attacked unprovoked by the seeded Road Muckling — even at night — so the
    // Road Ahead "break muckwad" step stays survivable/completable.
    const result = evaluateMuckMonsterAggression({
      monsterId: "road-muckling-one",
      monsterName: "Road Muckling",
      monsterPosition: [512, 54, -152],
      playerPosition: [513, 54, -152],
      nowMs: NIGHT_NOW_MS,
    });
    assert.equal(result.aggressive, false);
    assert.equal(
      result.reason,
      "tutorial_patch_blocks_unprovoked_muck_aggression"
    );
  });

  it("uses boss AI for Helix encounters in the West Muck Breach", () => {
    const territory = muckMonsterAreaForPosition([232, 54, -506]);
    assert.equal(territory?.id, "west_muck_breach");
    assert.equal(
      muckMonsterCombatArchetype("Muck-Scarred Helix"),
      "boss_phase_controller"
    );

    const result = evaluateMuckMonsterAggression({
      monsterId: "muck-boss",
      monsterName: "Muck-Scarred Helix",
      monsterPosition: [232, 54, -506],
      playerPosition: [234, 54, -507],
      monsterHpPercent: 0.42,
      nowMs: NIGHT_NOW_MS,
    });
    assert.equal(result.aggressive, true);
    assert.equal(result.archetypeId, "boss_phase_controller");
    assert.equal(result.decision?.serverActionRequest.actorId, "muck-boss");
    assert.ok(
      result.decision?.auditTags.includes("archetype:boss_phase_controller")
    );
  });
});
