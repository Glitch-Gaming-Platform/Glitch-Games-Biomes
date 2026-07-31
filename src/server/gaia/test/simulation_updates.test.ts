import "@/shared/bikkie/active";
import { FarmingSimulation } from "@/server/gaia/simulations/farming";
import { FloraDecaySimulation } from "@/server/gaia/simulations/flora_decay";
import { FloraGrowthSimulation } from "@/server/gaia/simulations/flora_growth";
import { FloraMuckSimulation } from "@/server/gaia/simulations/flora_muck";
import { IrradianceSimulation } from "@/server/gaia/simulations/irradiance";
import { LeafGrowthSimulation } from "@/server/gaia/simulations/leaf_growth";
import { LifetimeSimulation } from "@/server/gaia/simulations/lifetime";
import { MuckSimulation } from "@/server/gaia/simulations/muck";
import { OreGrowthSimulation } from "@/server/gaia/simulations/ore_growth";
import { RestorationSimulation } from "@/server/gaia/simulations/restoration";
import { SkyOcclusionSimulation } from "@/server/gaia/simulations/sky_occlusion";
import { TreeGrowthSimulation } from "@/server/gaia/simulations/tree_growth";
import { WaterSimulation } from "@/server/gaia/simulations/water";
import type { GaiaReplica, TerrainShard } from "@/server/gaia/table";
import { Clock } from "@/server/gaia/util/clock";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { usingAll } from "@/shared/deletable";
import {
  Box,
  ShardDiff,
  ShardDye,
  ShardGrowth,
  ShardIrradiance,
  ShardMuck,
  ShardOccupancy,
  ShardPlacer,
  ShardSeed,
  ShardShapes,
  ShardSkyOcclusion,
  ShardWater,
} from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import type { VoxelooModule } from "@/shared/wasm/types";
import type { GaiaTerrainMapV2 } from "@/shared/wasm/types/gaia";
import { getTerrainID } from "@/shared/asset_defs/terrain";
import assert from "assert";

function emptyShard(): TerrainShard {
  return {
    id: 71_001 as BiomesId,
    box: Box.create({ v0: [0, 0, 0], v1: [32, 32, 32] }),
    shard_seed: ShardSeed.create(),
    shard_diff: ShardDiff.create(),
    shard_shapes: ShardShapes.create(),
    shard_water: ShardWater.create(),
    shard_muck: ShardMuck.create(),
    shard_irradiance: ShardIrradiance.create(),
    shard_sky_occlusion: ShardSkyOcclusion.create(),
    shard_dye: ShardDye.create(),
    shard_growth: ShardGrowth.create(),
    shard_placer: ShardPlacer.create(),
    shard_occupancy: ShardOccupancy.create(),
  } as unknown as TerrainShard;
}

function replicaFor(shard: TerrainShard | undefined): GaiaReplica {
  return {
    table: {
      get: () => shard,
      scan: () => [],
    },
  } as unknown as GaiaReplica;
}

function emptyMap(voxeloo: VoxelooModule): GaiaTerrainMapV2 {
  const map = new voxeloo.GaiaTerrainMapV2();
  usingAll(
    [
      new voxeloo.GaiaTerrainMapBuilderV2(),
      new voxeloo.VolumeBlock_U32(),
      new voxeloo.SparseBlock_U32(),
    ],
    (builder, seed, diff) => {
      seed.set(16, 16, 16, getTerrainID("dirt"));
      builder.assignSeed([0, 0, 0], seed);
      builder.assignDiff([0, 0, 0], diff);
      builder.build(map);
    }
  );
  return map;
}

describe("Gaia simulation update contracts", () => {
  let voxeloo: VoxelooModule;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  it("executes every empty-terrain growth and lifecycle update without emitting state", async () => {
    const shard = emptyShard();
    const replica = replicaFor(shard);
    const clock = new Clock();
    const simulations = [
      new FloraDecaySimulation(voxeloo, replica),
      new FloraGrowthSimulation(voxeloo, replica, clock),
      new FloraMuckSimulation(voxeloo, replica),
      new LeafGrowthSimulation(voxeloo, replica, clock),
      new LifetimeSimulation(voxeloo, replica, clock),
      new OreGrowthSimulation(voxeloo, replica, clock),
      new RestorationSimulation(voxeloo, replica),
      new TreeGrowthSimulation(voxeloo, replica, clock),
    ];

    for (const simulation of simulations) {
      assert.equal(
        await simulation.update(shard, 9),
        undefined,
        `${simulation.name} should be a no-op on an empty shard`
      );
    }
  });

  it("handles missing replica terrain without materializing native tensors", async () => {
    const shard = emptyShard();
    const replica = replicaFor(undefined);
    const clock = new Clock();
    for (const simulation of [
      new FloraDecaySimulation(voxeloo, replica),
      new FloraGrowthSimulation(voxeloo, replica, clock),
      new LeafGrowthSimulation(voxeloo, replica, clock),
      new OreGrowthSimulation(voxeloo, replica, clock),
      new TreeGrowthSimulation(voxeloo, replica, clock),
    ]) {
      assert.equal(await simulation.update(shard, 1), undefined);
    }
  });

  it("runs farming's no-plant shard path without constructing a plant ticker", async () => {
    const shard = emptyShard();
    const simulation = new FarmingSimulation(voxeloo, replicaFor(shard).table, {
      next: async () => 1 as BiomesId,
      batch: async (count) =>
        Array.from({ length: count }, (_, i) => (i + 1) as BiomesId),
    });

    assert.deepEqual(await simulation.update(shard), {});
  });

  it("runs the native irradiance, occlusion, water, and muck boundaries on an empty shard", async () => {
    const shard = emptyShard();
    const replica = replicaFor(shard);
    const map = emptyMap(voxeloo);
    try {
      const irradiance = await new IrradianceSimulation(
        voxeloo,
        replica,
        map
      ).update(shard);
      const sky = await new SkyOcclusionSimulation(
        voxeloo,
        replica,
        map
      ).update(shard);
      const water = await new WaterSimulation(voxeloo, replica, map).update(
        shard,
        4
      );
      const muck = await new MuckSimulation(voxeloo, replica).update(shard);

      assert.ok(Array.isArray(irradiance.changes));
      assert.ok(Array.isArray(sky.changes));
      assert.ok(Array.isArray(water.changes));
      assert.ok(Array.isArray(muck.changes));
      assert.deepEqual(water.changes[0].iffs, [[shard.id, 4]]);
    } finally {
      map.delete();
    }
  });
});
