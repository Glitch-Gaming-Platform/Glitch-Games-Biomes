import assert from "assert";

import {
  HARTHMERE_EXOTIC_MATTER_COMPONENT_IDS,
  HARTHMERE_EXOTIC_MATTER_DEPOSITS,
  harthmereExoticMatterCaveById,
  harthmereExoticMatterDepositAtBlock,
} from "@/shared/harthmere/exotic_matter_caves";
import {
  HARTHMERE_INDISWORM_HOSTILITY,
  harthmereNativeNpcCombatProfileForSeed,
} from "@/shared/harthmere/harthmere_native_combat";
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

function indiswormBodyColumns(position: readonly number[]) {
  const halfFootprint = 1.05 * 0.45;
  const points = [
    [position[0], position[2]],
    [position[0] - halfFootprint, position[2] - halfFootprint],
    [position[0] - halfFootprint, position[2] + halfFootprint],
    [position[0] + halfFootprint, position[2] - halfFootprint],
    [position[0] + halfFootprint, position[2] + halfFootprint],
  ];
  return [
    ...new Map(
      points.map(([x, z]) => {
        const column = [Math.floor(x), Math.floor(z)] as const;
        return [`${column[0]}:${column[1]}`, column] as const;
      })
    ).values(),
  ];
}

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

  it("places every worm body on the cavern floor without intersecting a deposit", () => {
    for (const spawn of HARTHMERE_INDISWORM_SPAWNS) {
      const cave = harthmereExoticMatterCaveById(spawn.caveId);
      assert.ok(cave, spawn.caveId);
      assert.equal(
        spawn.position[1],
        cave!.bounds.y0,
        `${spawn.seedId} is not on the cavern floor`
      );
      assert.ok(
        spawn.position[1] + 1 <= cave!.bounds.y1,
        `${spawn.seedId} has no body clearance`
      );
      for (const [x, z] of indiswormBodyColumns(spawn.position)) {
        for (let y = spawn.position[1]; y < spawn.position[1] + 2; y += 1) {
          assert.equal(
            harthmereExoticMatterDepositAtBlock({ x, y, z }),
            undefined,
            `${spawn.seedId} intersects a cavern deposit at ${x},${y},${z}`
          );
        }
      }
    }
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

  it("guards every three-material cache with exactly five nearby Indisworms", () => {
    for (const caveId of HARTHMERE_INDISWORM_CAVE_IDS) {
      const cave = harthmereExoticMatterCaveById(caveId)!;
      for (
        let packIndex = 0;
        packIndex < HARTHMERE_INDISWORM_PACKS_PER_CAVERN;
        packIndex += 1
      ) {
        const groupId = `indisworm:${caveId}:pack-${packIndex + 1}`;
        const members = HARTHMERE_INDISWORM_SPAWNS.filter(
          (spawn) => spawn.groupId === groupId
        );
        const deposits = HARTHMERE_EXOTIC_MATTER_DEPOSITS.filter(
          (deposit) => deposit.guardGroupId === groupId
        );

        assert.equal(members.length, HARTHMERE_INDISWORMS_PER_PACK, groupId);
        assert.equal(deposits.length, 3, groupId);
        assert.deepEqual(
          new Set(deposits.map((deposit) => deposit.componentId)),
          new Set(HARTHMERE_EXOTIC_MATTER_COMPONENT_IDS),
          `${groupId} must contain every Raw Exotic Matter block material`
        );

        for (const deposit of deposits) {
          assert.equal(
            deposit.position[1],
            cave.bounds.y0 + 1,
            `${deposit.depositId} should sit visibly above the cavern floor`
          );
          assert.ok(
            isPositionInsideHarthmereIndiswormCave(caveId, deposit.position),
            `${deposit.depositId} escaped ${caveId}`
          );
        }

        for (const member of members) {
          for (const componentId of HARTHMERE_EXOTIC_MATTER_COMPONENT_IDS) {
            const nearest = Math.min(
              ...deposits
                .filter((deposit) => deposit.componentId === componentId)
                .map((deposit) =>
                  Math.hypot(
                    member.position[0] - deposit.position[0],
                    member.position[1] - deposit.position[1],
                    member.position[2] - deposit.position[2]
                  )
                )
            );
            assert.ok(
              nearest <= 12,
              `${member.seedId} is not guarding ${componentId} (${nearest.toFixed(
                2
              )}m)`
            );
          }
        }
      }
    }
  });

  it("makes every production Indisworm attack on proximity without provocation", () => {
    for (const seed of HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_SEEDS) {
      const profile = harthmereNativeNpcCombatProfileForSeed(seed);
      assert.equal(profile.behaviorKind, "hostile", seed.seedId);
      assert.deepEqual(
        profile.aggroTrigger,
        {
          kind: "proximity",
          distance: HARTHMERE_INDISWORM_HOSTILITY.aggroDistance,
        },
        seed.seedId
      );
      assert.notDeepEqual(
        profile.aggroTrigger,
        { kind: "onlyIfAttacked" },
        seed.seedId
      );
    }
  });
});
