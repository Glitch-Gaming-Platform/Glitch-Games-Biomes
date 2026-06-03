import assert from "assert";

import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";

describe("muck monster ECS seed gating + grounding", () => {
  it("keeps all 100 authored muck monsters (they are already in-territory)", () => {
    const gated = harthmereGroundedMuckMonsterSeedsInTerritoryV1();
    assert.equal(
      gated.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1
    );
    assert.equal(gated.length, HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length);
  });

  it("every spawned muck monster resolves to a real muck territory", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
      const territory = muckMonsterAreaForPositionV1(seed.position, 1.5);
      assert.ok(
        territory,
        `${seed.seedId} at ${seed.position} is not in a muck territory`
      );
    }
  });

  it("grounds positions to a finite authored Y while preserving X/Z", () => {
    const seeds = harthmereGroundedMuckMonsterSeedsInTerritoryV1();
    for (let i = 0; i < seeds.length; i += 1) {
      const grounded = seeds[i];
      const source = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1[i];
      assert.equal(grounded.position[0], source.position[0]);
      assert.equal(grounded.position[2], source.position[2]);
      assert.ok(
        Number.isFinite(grounded.position[1]),
        `${grounded.seedId} has a non-finite Y`
      );
    }
  });

  it("REGRESSION: the gate excludes a position outside every muck area", () => {
    // Town center and world origin must never resolve to a muck territory, so a
    // monster seeded there would be filtered out before it ever became an entity.
    assert.equal(muckMonsterAreaForPositionV1([486, 54, -209], 1.5), undefined);
    assert.equal(muckMonsterAreaForPositionV1([0, 54, 0], 1.5), undefined);
  });
});
