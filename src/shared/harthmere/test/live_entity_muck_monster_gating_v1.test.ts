import assert from "assert";

import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  harthmereExcludedMuckMonsterSeedIdsV1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
  harthmereMuckMonsterPositionIsInSafeZoneV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";

describe("muck monster placement (relocation into muck areas)", () => {
  it("keeps all 100 muckers/hexes (in-safe-zone ones are relocated, not dropped)", () => {
    const placed = harthmereGroundedMuckMonsterSeedsInTerritoryV1();
    assert.equal(
      placed.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1
    );
    assert.equal(placed.length, HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length);
    // Nothing is excluded anymore — every authored mucker is relocated/kept.
    assert.deepEqual(harthmereExcludedMuckMonsterSeedIdsV1(), []);
  });

  it("REGRESSION: every mucker ends up in a real muck area and NONE in a safe zone (the Grove)", () => {
    // Sanity: some authored positions DO land in a safe zone — those must move.
    const authoredInSafe = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.filter(
      (seed) => harthmereMuckMonsterPositionIsInSafeZoneV1(seed.position)
    );
    assert.ok(
      authoredInSafe.length > 0,
      "expected some authored muckers inside a safe zone (the Grove regression)"
    );

    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      assert.ok(
        muckMonsterAreaForPositionV1(seed.position, 1.5),
        `${seed.seedId} at ${seed.position} is not in a muck area`
      );
      assert.equal(
        harthmereMuckMonsterPositionIsInSafeZoneV1(seed.position),
        false,
        `${seed.seedId} at ${seed.position} is inside a safe zone`
      );
    }
  });

  it("relocates the Grove (road_muckwad) muckers out of the Grove while keeping their ids", () => {
    const placedById = new Map(
      harthmereGroundedMuckMonsterSeedsInTerritoryV1().map((s) => [s.entityId, s])
    );
    const groveAuthored = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.filter(
      (seed) => harthmereMuckMonsterPositionIsInSafeZoneV1(seed.position)
    );
    for (const seed of groveAuthored) {
      const placed = placedById.get(seed.entityId);
      assert.ok(placed, `relocated mucker ${seed.entityId} missing`);
      assert.equal(
        harthmereMuckMonsterPositionIsInSafeZoneV1(placed!.position),
        false,
        `${seed.seedId} should have been relocated out of the safe zone`
      );
    }
  });

  it("spreads muckers/hexes across MULTIPLE muck areas", () => {
    const areaIds = new Set<string>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      const area = muckMonsterAreaForPositionV1(seed.position, 1.5);
      if (area) {
        areaIds.add(area.id);
      }
    }
    assert.ok(
      areaIds.size >= 4,
      `expected muckers across several muck areas, got ${[...areaIds].join(",")}`
    );
  });

  it("grounds every mucker to a finite Y", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      assert.ok(
        Number.isFinite(seed.position[1]),
        `${seed.seedId} has a non-finite Y`
      );
    }
  });
});
