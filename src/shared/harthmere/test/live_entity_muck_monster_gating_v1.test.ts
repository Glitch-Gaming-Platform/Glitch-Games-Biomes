import assert from "assert";

import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  harthmereExcludedMuckMonsterSeedIdsV1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";

// The three authored, map-labelled muck patches the player actually explores.
// Muck monsters are spread densely across these so wherever a player enters the
// visible Muck they meet muckers/hexers. road_muckwad is the starter patch by
// spawn (used by the Muck Buster training quest) and MUST be populated even
// though it nests inside the oversized Grove safe radius.
const VISIBLE_MUCK_ZONE_IDS_V1 = [
  "road_muckwad_patch",
  "watchtower_muck_patch",
  "old_wood_muck_patch",
];

describe("muck monster placement (visible muck zones)", () => {
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

  it("places every mucker inside a real (map-labelled) muck patch", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      const area = muckMonsterAreaForPositionV1(seed.position, 1.5);
      assert.ok(
        area,
        `${seed.seedId} at ${seed.position} is not in a muck area`
      );
      assert.ok(
        VISIBLE_MUCK_ZONE_IDS_V1.includes(area!.id),
        `${seed.seedId} resolved to ${area!.id}, not a visible muck patch`
      );
    }
  });

  it("populates the starter road_muckwad patch by spawn (so the nearest Muck is not empty)", () => {
    const inRoadMuckwad = harthmereGroundedMuckMonsterSeedsInTerritoryV1().filter(
      (seed) => muckMonsterAreaForPositionV1(seed.position, 1.5)?.id === "road_muckwad_patch"
    );
    assert.ok(
      inRoadMuckwad.length >= 10,
      `expected the starter muck patch to be populated, got ${inRoadMuckwad.length}`
    );
  });

  it("spreads muckers/hexes across all three visible muck patches", () => {
    const areaIds = new Set<string>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      const area = muckMonsterAreaForPositionV1(seed.position, 1.5);
      if (area) {
        areaIds.add(area.id);
      }
    }
    for (const id of VISIBLE_MUCK_ZONE_IDS_V1) {
      assert.ok(
        areaIds.has(id),
        `expected muckers in ${id}; got ${[...areaIds].join(",")}`
      );
    }
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
