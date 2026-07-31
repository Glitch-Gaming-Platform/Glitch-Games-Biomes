import { TensorCache } from "@/server/gaia/terrain/cache";
import { TerrainMutator } from "@/server/gaia/terrain/mutator";
import { makeWorldMap, worldMapShards } from "@/server/gaia/terrain/world_map";
import type { GaiaReplica } from "@/server/gaia/table";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { voxelShard } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import { Tensor } from "@/shared/wasm/tensors";
import type { VoxelooModule } from "@/shared/wasm/types";
import type { WorldMap } from "@/shared/wasm/types/gaia";
import assert from "assert";

describe("Gaia TensorCache", () => {
  it("memoizes present and missing shards and deletes each built value", () => {
    const shardId = voxelShard(0, 0, 0);
    const missingId = voxelShard(32, 0, 0);
    let lookups = 0;
    let builds = 0;
    let deletes = 0;
    const replica = {
      table: {
        get: () => {
          lookups += 1;
          return lookups <= 1
            ? ({ id: 1 as BiomesId } as ReadonlyEntity)
            : undefined;
        },
      },
    } as unknown as GaiaReplica;
    const cache = new TensorCache({} as VoxelooModule, replica);
    const build = () => {
      builds += 1;
      return { delete: () => (deletes += 1) };
    };

    const first = cache.get("test", shardId, build);
    const same = cache.get("test", shardId, build);
    assert.strictEqual(first, same);
    assert.equal(builds, 1);
    assert.equal(cache.get("test", missingId, build), undefined);
    assert.equal(cache.get("test", missingId, build), undefined);
    assert.equal(lookups, 2);

    cache.delete();
    assert.equal(deletes, 1);
  });
});

describe("Gaia TerrainMutator", () => {
  let voxeloo: VoxelooModule;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  it("reports no changes when no terrain component is touched", () => {
    const mutator = new TerrainMutator(voxeloo, {
      id: 1 as BiomesId,
    } as ReadonlyEntity);
    try {
      assert.deepEqual(mutator.apply(), [false, { id: 1 }]);
    } finally {
      mutator.delete();
    }
  });

  it("serializes every mutable terrain component into one ECS delta", () => {
    const mutator = new TerrainMutator(voxeloo, {
      id: 2 as BiomesId,
    } as ReadonlyEntity);
    try {
      mutator.diff.set(1, 2, 3, 10);
      mutator.shapes.set(1, 2, 3, 11);
      mutator.occupancy.set([1, 2, 3], 12);
      mutator.placer.set([1, 2, 3], 13);
      mutator.farming.set([1, 2, 3], 14);
      mutator.growth.set([1, 2, 3], 15);
      mutator.moisture.set([1, 2, 3], 16);
      mutator.dye.set([1, 2, 3], 17);

      const [changed, delta] = mutator.apply();
      assert.equal(changed, true);
      for (const component of [
        "shard_diff",
        "shard_shapes",
        "shard_occupancy",
        "shard_placer",
        "shard_farming",
        "shard_growth",
        "shard_moisture",
        "shard_dye",
      ] as const) {
        assert.ok(delta[component], `${component} should be present`);
      }
    } finally {
      mutator.delete();
    }
  });
});

describe("Gaia world-map adapters", () => {
  let voxeloo: VoxelooModule;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  it("splits a world map into shard chunks and releases the yielded chunks", () => {
    let deleted = 0;
    const map = {
      aabb: { v0: [0, 0, 0], v1: [64, 32, 32] },
      chunk: (position: readonly number[]) => ({
        position,
        delete: () => {
          deleted += 1;
        },
      }),
    } as unknown as WorldMap<"U8">;

    const chunks = [...worldMapShards(map)];
    assert.equal(chunks.length, 2);
    assert.deepEqual(
      chunks.map(([id]) => id),
      [voxelShard(0, 0, 0), voxelShard(32, 0, 0)]
    );
    assert.equal(deleted, 2);
  });

  it("constructs a native world map with the tensor shape offset into world coordinates", () => {
    const tensor = Tensor.make(voxeloo, [32, 32, 32], "U8");
    try {
      const map = makeWorldMap(voxeloo, tensor, [64, -32, 96]);
      try {
        assert.deepEqual(map.aabb.v0, [64, -32, 96]);
        assert.deepEqual(map.aabb.v1, [96, 0, 128]);
      } finally {
        map.delete();
      }
    } finally {
      tensor.delete();
    }
  });
});
