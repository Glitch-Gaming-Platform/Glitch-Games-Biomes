import {
  terrainSeedEntityForWrite,
  terrainSeedMigrationMode,
  terrainSeedModeRewritesExistingShards,
} from "@/server/shim/terrain_seed_migration";
import assert from "assert";

describe("terrain seed migration safety", () => {
  it("defaults production-compatible maintenance to additive mode", () => {
    assert.equal(terrainSeedMigrationMode({}), "additive");
    assert.equal(terrainSeedModeRewritesExistingShards("additive"), false);
  });

  it("requires an explicit acknowledgement for legacy destructive reseeds", () => {
    assert.throws(
      () =>
        terrainSeedMigrationMode({
          BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED: "1",
        }),
      /BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED=1/
    );
    assert.equal(
      terrainSeedMigrationMode({
        BIOMES_FORCE_LOCAL_DEV_TOWN_RESEED: "1",
        BIOMES_ALLOW_DESTRUCTIVE_TERRAIN_RESEED: "1",
      }),
      "destructive"
    );
  });

  it("preserves every mutable overlay when an existing authored seed changes", () => {
    const entity = terrainSeedEntityForWrite({
      kind: "update",
      mode: "preserve-overlays",
      authored: { id: 1, box: "box", shard_seed: "new-seed" },
      mutableDefaults: {
        shard_diff: "empty-diff",
        shard_shapes: "empty-shapes",
        shard_muck: "empty-muck",
        shard_water: "authored-water",
        shard_placer: "empty-placer",
        shard_occupancy: "empty-occupancy",
        shard_farming: "empty-farming",
        shard_growth: "empty-growth",
        shard_moisture: "empty-moisture",
        shard_restoration: "empty-restoration",
      },
    });
    assert.deepEqual(entity, {
      id: 1,
      box: "box",
      shard_seed: "new-seed",
    });
  });

  it("initializes mutable terrain components only for new or acknowledged destructive shards", () => {
    const input = {
      authored: { id: 1, shard_seed: "seed" },
      mutableDefaults: { shard_diff: "empty-diff" },
    } as const;
    assert.deepEqual(
      terrainSeedEntityForWrite({
        ...input,
        kind: "create",
        mode: "additive",
      }),
      { id: 1, shard_seed: "seed", shard_diff: "empty-diff" }
    );
    assert.deepEqual(
      terrainSeedEntityForWrite({
        ...input,
        kind: "update",
        mode: "destructive",
      }),
      { id: 1, shard_seed: "seed", shard_diff: "empty-diff" }
    );
  });
});
