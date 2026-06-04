import assert from "assert";

import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  harthmereExcludedMuckMonsterSeedIdsV1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
  harthmereMuckMonsterPositionIsInSafeZoneV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";

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
    assert.ok(
      areaIds.size >= 3,
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
