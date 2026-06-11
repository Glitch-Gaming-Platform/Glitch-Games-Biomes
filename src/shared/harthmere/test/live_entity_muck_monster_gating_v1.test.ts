import assert from "assert";

import {
  HARTHMERE_MUCK_FLOOR_FEET_Y_V1,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  harthmereExcludedMuckMonsterSeedIdsV1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
  harthmereMuckMonsterPositionIsInSafeZoneV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";
import {
  getHarthmereProductionPlacementByKeyV1,
  harthmereProductionPlacementKeyV1,
} from "@/shared/harthmere/production_terrain_placement_map_v1";

describe("muck monster placement", () => {
  it("keeps all 100 muckers/hexes — none dropped", () => {
    const placed = harthmereGroundedMuckMonsterSeedsInTerritoryV1();
    assert.equal(
      placed.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1
    );
    assert.equal(
      placed.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length
    );
    assert.deepEqual(harthmereExcludedMuckMonsterSeedIdsV1(), []);
  });

  it("INVARIANT: NOT ONE mucker/hex is ever inside a safe zone (the Grove/town)", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      assert.equal(
        harthmereMuckMonsterPositionIsInSafeZoneV1(seed.position),
        false,
        `${seed.seedId} at ${seed.position} is inside a safe zone (the Grove)`
      );
    }
  });

  it("places every mucker inside a real muck area", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      assert.ok(
        muckMonsterAreaForPositionV1(seed.position, 1.5),
        `${seed.seedId} at ${seed.position} is not in a muck area`
      );
    }
  });

  it("spreads muckers/hexes across multiple muck areas", () => {
    const areaIds = new Set<string>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      const area = muckMonsterAreaForPositionV1(seed.position, 1.5);
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
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      const placement = getHarthmereProductionPlacementByKeyV1(
        harthmereProductionPlacementKeyV1("live_muck_monster", seed.seedId)
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
        ![...yValues].every((y) => y === HARTHMERE_MUCK_FLOOR_FEET_Y_V1),
      "mucker Y values should come from varied production terrain, not a single flat fallback"
    );
  });

  it("keeps placement-map generation independent of the generated placement map", () => {
    const generatedFromAuthoredXz =
      harthmereGroundedMuckMonsterSeedsInTerritoryV1({
        useProductionPlacementMap: false,
      });
    assert.equal(
      generatedFromAuthoredXz.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1
    );
    assert.ok(
      generatedFromAuthoredXz.every(
        (seed) =>
          seed.position[1] === HARTHMERE_MUCK_FLOOR_FEET_Y_V1 &&
          !harthmereMuckMonsterPositionIsInSafeZoneV1(seed.position) &&
          muckMonsterAreaForPositionV1(seed.position, 1.5)
      )
    );
  });
});
