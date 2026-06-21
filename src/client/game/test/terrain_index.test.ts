import assert from "assert";

import { createClientIndexConfig } from "@/client/game/game";
import {
  Box,
  ShardDiff,
  ShardSeed,
  ShardShapes,
} from "@/shared/ecs/gen/components";
import { MetaIndexTableImpl, VersionedTableImpl } from "@/shared/ecs/table";
import { TickVersionStamper } from "@/shared/ecs/version";
import { getIndexedResources } from "@/shared/game/ecs_indexed_resources";
import { voxelShard } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";

describe("client terrain index", () => {
  function terrainEntityId(entity: unknown) {
    return (entity as { id?: BiomesId } | undefined)?.id;
  }

  it("resolves synthetic terrain entity ids by voxel shard", () => {
    const backingTable = new VersionedTableImpl(new TickVersionStamper());
    const table = new MetaIndexTableImpl(
      backingTable,
      createClientIndexConfig()
    );
    const terrainId = 8_810_000_000_000_123 as BiomesId;
    const shardV0: [number, number, number] = [480, 32, -224];

    backingTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          id: terrainId,
          box: Box.create({
            v0: shardV0,
            v1: [512, 64, -192],
          }),
          shard_seed: ShardSeed.create(),
          shard_diff: ShardDiff.create(),
          shard_shapes: ShardShapes.create(),
        },
      },
    ]);

    const terrainResource = getIndexedResources(table)[0];

    assert.equal(
      terrainEntityId(terrainResource.get(voxelShard(484, 53, -207))),
      terrainId
    );
  });

  it("indexes every voxel shard touched by a terrain box", () => {
    const backingTable = new VersionedTableImpl(new TickVersionStamper());
    const table = new MetaIndexTableImpl(
      backingTable,
      createClientIndexConfig()
    );
    const terrainId = 8_810_000_000_000_456 as BiomesId;

    backingTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          id: terrainId,
          box: Box.create({
            v0: [480, 32, -224],
            v1: [544, 64, -192],
          }),
          shard_seed: ShardSeed.create(),
          shard_diff: ShardDiff.create(),
          shard_shapes: ShardShapes.create(),
        },
      },
    ]);

    const terrainResource = getIndexedResources(table)[0];

    assert.equal(
      terrainEntityId(terrainResource.get(voxelShard(484, 53, -207))),
      terrainId
    );
    assert.equal(
      terrainEntityId(terrainResource.get(voxelShard(520, 53, -207))),
      terrainId
    );
  });
});
