import assert from "assert";

import {
  HARTHMERE_INDISWORM_CAVE_IDS,
  HARTHMERE_INDISWORM_PACKS_PER_CAVERN,
  HARTHMERE_INDISWORM_PRODUCTION_COUNT,
  HARTHMERE_INDISWORM_SPAWNS,
  HARTHMERE_INDISWORMS_PER_PACK,
  isPositionInsideHarthmereIndiswormCave,
} from "@/shared/harthmere/indisworm_spawns";
import {
  HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_PRODUCTION_COUNT,
  HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_SEEDS,
  harthmereGroundedCavernMonsterSeeds,
  validateHarthmereLiveEntityProductionSeeds,
} from "@/shared/harthmere/live_entity_production_seed";
import {
  harthmereCreatureGroupForSeed,
  harthmereCreatureGroupMembers,
} from "@/shared/harthmere/creature_groups";

describe("Indisworm massive-cavern packs", () => {
  it("authors three groups of five in every massive cavern", () => {
    assert.equal(HARTHMERE_INDISWORM_CAVE_IDS.length, 4);
    assert.equal(HARTHMERE_INDISWORM_PRODUCTION_COUNT, 60);
    assert.equal(
      HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_PRODUCTION_COUNT,
      HARTHMERE_INDISWORM_PRODUCTION_COUNT
    );
    assert.equal(
      HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_SEEDS.length,
      HARTHMERE_INDISWORM_PRODUCTION_COUNT
    );

    for (const caveId of HARTHMERE_INDISWORM_CAVE_IDS) {
      const caveSpawns = HARTHMERE_INDISWORM_SPAWNS.filter(
        (spawn) => spawn.caveId === caveId
      );
      assert.equal(
        caveSpawns.length,
        HARTHMERE_INDISWORM_PACKS_PER_CAVERN * HARTHMERE_INDISWORMS_PER_PACK
      );
      const groups = new Map<string, typeof caveSpawns>();
      for (const spawn of caveSpawns) {
        const members = groups.get(spawn.groupId) ?? [];
        members.push(spawn);
        groups.set(spawn.groupId, members);
      }
      assert.equal(groups.size, HARTHMERE_INDISWORM_PACKS_PER_CAVERN);
      for (const members of groups.values()) {
        assert.equal(members.length, HARTHMERE_INDISWORMS_PER_PACK);
        assert.ok(
          members.every((spawn) =>
            isPositionInsideHarthmereIndiswormCave(spawn.caveId, spawn.position)
          )
        );
        const horizontalDiameter = Math.max(
          ...members.flatMap((a) =>
            members.map((b) =>
              Math.hypot(
                a.position[0] - b.position[0],
                a.position[2] - b.position[2]
              )
            )
          )
        );
        assert.ok(horizontalDiameter <= 8, `${members[0].groupId} diameter`);
      }
    }
  });

  it("uses unique stable ids and increases progression with cavern depth", () => {
    assert.equal(
      new Set(HARTHMERE_INDISWORM_SPAWNS.map((spawn) => spawn.seedId)).size,
      HARTHMERE_INDISWORM_PRODUCTION_COUNT
    );
    assert.equal(
      new Set(HARTHMERE_INDISWORM_SPAWNS.map((spawn) => spawn.entityId)).size,
      HARTHMERE_INDISWORM_PRODUCTION_COUNT
    );
    assert.deepEqual(
      HARTHMERE_INDISWORM_CAVE_IDS.map(
        (caveId) =>
          HARTHMERE_INDISWORM_SPAWNS.find((spawn) => spawn.caveId === caveId)
            ?.progressionLevel
      ),
      [4, 5, 6, 7]
    );
  });

  it("keeps underground positions exact and gives every pack native group membership", () => {
    const grounded = harthmereGroundedCavernMonsterSeeds();
    assert.deepEqual(
      grounded.map((seed) => seed.position),
      HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_SEEDS.map((seed) => seed.position)
    );
    for (const seed of grounded) {
      const membership = harthmereCreatureGroupForSeed(seed);
      assert.ok(membership, seed.seedId);
      assert.equal(membership.assistFaction, "muck");
      assert.equal(membership.role, "skirmisher");
      const members = harthmereCreatureGroupMembers(membership.groupId);
      assert.equal(members.length, HARTHMERE_INDISWORMS_PER_PACK);
      assert.deepEqual(
        members.map((entry) => entry.membership.memberIndex),
        [0, 1, 2, 3, 4]
      );
    }
    assert.deepEqual(validateHarthmereLiveEntityProductionSeeds(), []);
  });
});
