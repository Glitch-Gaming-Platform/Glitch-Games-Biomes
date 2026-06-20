import assert from "assert";

import {
  HARTHMERE_MUCK_FLOOR_FEET_Y,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  harthmereExcludedMuckMonsterSeedIds,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereMuckMonsterPositionIsInSafeZone,
} from "@/shared/harthmere/live_entity_production_seed";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import {
  getHarthmereProductionPlacementByKey,
  harthmereProductionPlacementKey,
} from "@/shared/harthmere/production_terrain_placement_map";

describe("muck monster placement", () => {
  it("keeps all 100 muckers/hexes — none dropped", () => {
    const placed = harthmereGroundedMuckMonsterSeedsInTerritory();
    assert.equal(
      placed.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT
    );
    assert.equal(
      placed.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.length
    );
    assert.deepEqual(harthmereExcludedMuckMonsterSeedIds(), []);
  });

  it("INVARIANT: NOT ONE mucker/hex is ever inside a safe zone (the Grove/town)", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
      assert.equal(
        harthmereMuckMonsterPositionIsInSafeZone(seed.position),
        false,
        `${seed.seedId} at ${seed.position} is inside a safe zone (the Grove)`
      );
    }
  });

  it("places every mucker inside a real muck area", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
      assert.ok(
        muckMonsterAreaForPosition(seed.position, 1.5),
        `${seed.seedId} at ${seed.position} is not in a muck area`
      );
    }
  });

  it("spreads muckers/hexes across multiple muck areas", () => {
    const areaIds = new Set<string>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
      const area = muckMonsterAreaForPosition(seed.position, 1.5);
      if (area) {
        areaIds.add(area.id);
      }
    }
    assert.equal(
      areaIds.has("road_muckwad_patch"),
      false,
      "road_muckwad_patch overlaps the Grove/town safe radius"
    );
    assert.ok(
      areaIds.size >= 5,
      `expected muckers across several muck areas, got ${[...areaIds].join(
        ","
      )}`
    );
  });

  it("uses production terrain placement-map Y instead of the flat local-dev fallback", () => {
    const yValues = new Set<number>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
      const placement = getHarthmereProductionPlacementByKey(
        harthmereProductionPlacementKey("live_muck_monster", seed.seedId)
      );
      assert.ok(placement, `${seed.seedId} is missing a production placement`);
      assert.equal(placement.placementMode, "outdoor_surface");
      assert.deepEqual(seed.position, placement.recommendedPosition);
      assert.ok(
        Number.isFinite(seed.position[1]),
        `${seed.seedId} has a non-finite Y`
      );
      yValues.add(seed.position[1]);
    }
    assert.ok(
      yValues.size > 1 &&
        ![...yValues].every((y) => y === HARTHMERE_MUCK_FLOOR_FEET_Y),
      "mucker Y values should come from varied production terrain, not a single flat fallback"
    );
  });

  it("keeps placement-map generation independent of the generated placement map", () => {
    const generatedFromAuthoredXz =
      harthmereGroundedMuckMonsterSeedsInTerritory({
        useProductionPlacementMap: false,
      });
    assert.equal(
      generatedFromAuthoredXz.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT
    );
    assert.ok(
      generatedFromAuthoredXz.every(
        (seed) =>
          seed.position[1] === HARTHMERE_MUCK_FLOOR_FEET_Y &&
          !harthmereMuckMonsterPositionIsInSafeZone(seed.position) &&
          muckMonsterAreaForPosition(seed.position, 1.5)
      )
    );
  });
});
