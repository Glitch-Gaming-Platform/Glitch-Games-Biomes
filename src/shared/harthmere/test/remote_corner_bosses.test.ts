import assert from "assert";
import { describe, it } from "mocha";
import { BUILDING_SYSTEM_PLOTS } from "@/shared/harthmere/building_system";
import {
  harthmereNativeNpcCombatProfileForSeed,
  harthmereNativeNpcTypeKeyForSeed,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeNpcCombatProfileForEntity } from "@/shared/harthmere/harthmere_native_combat_catalog";
import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS,
  HARTHMERE_REMOTE_CORNER_BOSS_LOCATIONS,
  HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL,
  HARTHMERE_REMOTE_CORNER_BOSS_SEEDS,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntitySizeForSeed,
  harthmereOpenWildsGroundingPositionIsValidForSeed,
  harthmereOpenWildsMixedGroupPositionIsValid,
} from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_PRODUCTION_PLACEMENT_MAP } from "@/shared/harthmere/production_terrain_placement_map";
import type { ReadonlyVec3 } from "@/shared/math/types";

function xzDistance(left: ReadonlyVec3, right: ReadonlyVec3) {
  return Math.hypot(left[0] - right[0], left[2] - right[2]);
}

function distanceToPlot(
  position: ReadonlyVec3,
  plot: (typeof BUILDING_SYSTEM_PLOTS)[number]
) {
  const dx =
    position[0] < plot.bounds.xMin
      ? plot.bounds.xMin - position[0]
      : position[0] > plot.bounds.xMax
      ? position[0] - plot.bounds.xMax
      : 0;
  const dz =
    position[2] < plot.bounds.zMin
      ? plot.bounds.zMin - position[2]
      : position[2] > plot.bounds.zMax
      ? position[2] - plot.bounds.zMax
      : 0;
  return Math.hypot(dx, dz);
}

describe("remote corner apex bosses", () => {
  it("adds exactly two Helixes and two Alpha Muckers, one per corner quadrant", () => {
    assert.equal(HARTHMERE_REMOTE_CORNER_BOSS_SEEDS.length, 4);
    assert.equal(
      HARTHMERE_REMOTE_CORNER_BOSS_SEEDS.filter(
        (seed) => seed.displayName === "Muck-Scarred Helix"
      ).length,
      2
    );
    assert.equal(
      HARTHMERE_REMOTE_CORNER_BOSS_SEEDS.filter(
        (seed) => seed.displayName === "Alpha Mucker"
      ).length,
      2
    );
    assert.equal(
      new Set(HARTHMERE_REMOTE_CORNER_BOSS_SEEDS.map((seed) => seed.areaId))
        .size,
      4
    );
    assert.equal(
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT
    );
  });

  it("uses measured outdoor columns inside the original map with full body margin", () => {
    const { bounds } = HARTHMERE_PRODUCTION_PLACEMENT_MAP.scan;
    const pointById = new Map(
      HARTHMERE_PRODUCTION_PLACEMENT_MAP.outdoorSpawnPoints.map((point) => [
        point.id,
        point,
      ])
    );
    const middleX = (bounds.x0 + Math.min(bounds.x1, 1791)) / 2;
    const middleZ = (bounds.z0 + bounds.z1) / 2;

    for (const [index, seed] of HARTHMERE_REMOTE_CORNER_BOSS_SEEDS.entries()) {
      const location = HARTHMERE_REMOTE_CORNER_BOSS_LOCATIONS[index];
      const measured = pointById.get(location.outdoorSpawnPointId);
      assert.ok(measured, location.outdoorSpawnPointId);
      assert.deepEqual(seed.position, measured!.position);
      assert.ok(harthmereOpenWildsMixedGroupPositionIsValid(seed.position));
      assert.ok(
        harthmereOpenWildsGroundingPositionIsValidForSeed(seed, seed.position)
      );

      const size = harthmereLiveEntitySizeForSeed(seed);
      const marginX = size[0] / 2 + 2;
      const marginZ = size[2] / 2 + 2;
      assert.ok(seed.position[0] >= bounds.x0 + marginX);
      assert.ok(seed.position[0] <= 1792 - marginX);
      assert.ok(seed.position[2] >= bounds.z0 + marginZ);
      assert.ok(seed.position[2] <= bounds.z1 - marginZ);

      assert.equal(
        seed.position[0] < middleX,
        location.corner.includes("west")
      );
      assert.equal(
        seed.position[2] < middleZ,
        location.corner.includes("north")
      );
      const corner: ReadonlyVec3 = [
        location.corner.includes("west") ? bounds.x0 : 1791,
        seed.position[1],
        location.corner.includes("north") ? bounds.z0 : bounds.z1,
      ];
      assert.ok(
        xzDistance(seed.position, corner) <= 300,
        `${location.corner} boss is not in its corner region`
      );
    }
  });

  it("keeps the four sites clear of people, buildings, content, and hostile groups", () => {
    const remoteIds = new Set(
      HARTHMERE_REMOTE_CORNER_BOSS_SEEDS.map((seed) => seed.entityId)
    );
    const existingCreatures = HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.filter(
      (seed) => !remoteIds.has(seed.entityId)
    );
    const existingSurfaceHostiles =
      harthmereGroundedMuckMonsterSeedsInTerritory().filter(
        (seed) => !remoteIds.has(seed.entityId) && seed.caveId === undefined
      );
    const outdoorContent = HARTHMERE_PRODUCTION_PLACEMENT_MAP.placements.filter(
      (placement) => placement.placementMode === "outdoor_surface"
    );
    const people = outdoorContent.filter(
      (placement) => placement.purpose === "npc"
    );

    for (const seed of HARTHMERE_REMOTE_CORNER_BOSS_SEEDS) {
      assert.ok(
        existingCreatures.every(
          (other) => xzDistance(seed.position, other.position) >= 90
        ),
        `${seed.areaLabel} is too close to an existing creature`
      );
      assert.ok(
        existingSurfaceHostiles.every(
          (other) => xzDistance(seed.position, other.position) >= 110
        ),
        `${seed.areaLabel} is too close to a Mucker/Hex group`
      );
      assert.ok(
        people.every(
          (placement) =>
            xzDistance(seed.position, placement.recommendedPosition) >= 300
        ),
        `${seed.areaLabel} is too close to a person`
      );
      assert.ok(
        outdoorContent.every(
          (placement) =>
            xzDistance(seed.position, placement.recommendedPosition) >= 100
        ),
        `${seed.areaLabel} is too close to authored surface content`
      );
      assert.ok(
        BUILDING_SYSTEM_PLOTS.every(
          (plot) => distanceToPlot(seed.position, plot) >= 300
        ),
        `${seed.areaLabel} is too close to a building plot`
      );
    }
  });

  it("makes every encounter level 30, boss-sized, hostile, and long-range aggressive", () => {
    for (const seed of HARTHMERE_REMOTE_CORNER_BOSS_SEEDS) {
      assert.equal(
        seed.progressionLevel,
        HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL
      );
      assert.equal(
        seed.combatLevel,
        HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL
      );
      assert.ok(harthmereLiveEntitySizeForSeed(seed)[0] >= 6.8);

      const base = harthmereNativeNpcCombatProfileForSeed(seed);
      assert.ok(harthmereNativeNpcTypeKeyForSeed(seed).endsWith("_apex"));
      assert.equal(base.isBoss, true);
      assert.equal(base.behaviorKind, "hostile");
      assert.equal(base.level, HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL);
      assert.deepEqual(base.aggroTrigger, { kind: "proximity", distance: 48 });
      assert.equal(base.disengageDistance, 96);
      assert.ok(base.runSpeed >= 5.5);

      const concrete = harthmereNativeNpcCombatProfileForEntity({
        entityId: seed.entityId,
        typeId: base.id,
        displayName: seed.displayName,
        maxHp: base.maxHp,
      });
      assert.ok(concrete);
      assert.equal(
        concrete!.level,
        HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL
      );
      assert.deepEqual(concrete!.aggroTrigger, {
        kind: "proximity",
        distance: 48,
      });
      assert.equal(concrete!.disengageDistance, 96);
      assert.equal(concrete!.rangedAttacks?.length, 5);
    }
  });
});
