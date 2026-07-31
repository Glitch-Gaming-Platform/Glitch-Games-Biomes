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
import type { GaiaReplica } from "@/server/gaia/table";
import { Clock } from "@/server/gaia/util/clock";
import type { IdGenerator } from "@/server/shared/ids/generator";
import type { Change } from "@/shared/ecs/change";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { shardDecode, voxelShard } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import type { VoxelooModule } from "@/shared/wasm/types";
import type { GaiaTerrainMapV2 } from "@/shared/wasm/types/gaia";
import assert from "assert";

const id = 500 as BiomesId;
const box = { v0: [0, 0, 0], v1: [32, 32, 32] } as const;
const terrainEntity = {
  id,
  box,
  shard_seed: { buffer: "" },
  shard_diff: { buffer: "" },
  shard_water: { buffer: "" },
} as unknown as ReadonlyEntity;

function replica(entity: ReadonlyEntity | undefined, scan: unknown[] = []) {
  return {
    table: {
      get: () => entity,
      scan: () => scan,
    },
  } as unknown as GaiaReplica;
}

function update(entity: Record<string, unknown>): Change {
  return {
    kind: "update",
    tick: 1,
    entity: { id, ...entity },
  } as Change;
}

function deletion(deleteId = id): Change {
  return { kind: "delete", tick: 1, id: deleteId } as Change;
}

describe("Gaia simulation invalidation contracts", () => {
  const voxeloo = {} as VoxelooModule;
  const clock = new Clock();
  const map = {} as GaiaTerrainMapV2;

  it("invalidates the edited shard and upper neighbor for flora and tree simulations", () => {
    const expected = [voxelShard(0, 0, 0), voxelShard(0, 32, 0)];
    for (const simulation of [
      new FloraDecaySimulation(voxeloo, replica(terrainEntity)),
      new FloraGrowthSimulation(voxeloo, replica(terrainEntity), clock),
      new LeafGrowthSimulation(voxeloo, replica(terrainEntity), clock),
      new TreeGrowthSimulation(voxeloo, replica(terrainEntity), clock),
    ]) {
      assert.deepEqual(
        simulation.invalidate(update({ shard_diff: {} })),
        expected
      );
      assert.deepEqual(simulation.invalidate(update({ shard_water: {} })), []);
      assert.deepEqual(simulation.invalidate(deletion()), []);
    }
  });

  it("invalidates local flora muck changes", () => {
    const simulation = new FloraMuckSimulation(voxeloo, replica(terrainEntity));
    assert.deepEqual(simulation.invalidate(update({ shard_muck: {} })), [
      voxelShard(0, 0, 0),
    ]);
    assert.deepEqual(simulation.invalidate(update({ shard_seed: {} })), [
      voxelShard(0, 0, 0),
    ]);
    assert.deepEqual(simulation.invalidate(update({ position: {} })), []);
  });

  it("tracks irradiance source creation, movement, terrain edits, and deletion", () => {
    const sourceId = 900 as BiomesId;
    let current: ReadonlyEntity | undefined = {
      id: sourceId,
      position: { v: [0, 0, 0] },
      irradiance: { color: [1, 1, 1], intensity: 1 },
      locked_in_place: {},
    } as unknown as ReadonlyEntity;
    const sourceReplica = {
      table: {
        scan: () => [],
        get: () => current,
      },
    } as unknown as GaiaReplica;
    const simulation = new IrradianceSimulation(voxeloo, sourceReplica, map);

    const created = simulation.invalidate(
      update.call(null, {
        position: { v: [0, 0, 0] },
        irradiance: {},
      }) as Change
    );
    assert.ok(created.length > 0);
    current = {
      ...current,
      position: { v: [64, 0, 0] },
    } as ReadonlyEntity;
    const moved = simulation.invalidate({
      kind: "update",
      tick: 2,
      entity: { id: sourceId, position: { v: [64, 0, 0] } },
    } as Change);
    assert.ok(
      moved.length > created.length,
      "movement invalidates old and new fields"
    );
    assert.ok(simulation.invalidate(deletion(sourceId)).length > 0);
    assert.deepEqual(simulation.invalidate(deletion(sourceId)), []);

    const terrainSimulation = new IrradianceSimulation(
      voxeloo,
      replica(terrainEntity),
      map
    );
    assert.equal(
      new Set(terrainSimulation.invalidate(update({ shard_shapes: {} }))).size,
      27
    );
  });

  it("tracks lifetime, restoration, ore, sky, and water-specific inputs", () => {
    assert.deepEqual(
      new LifetimeSimulation(voxeloo, replica(terrainEntity), clock).invalidate(
        update({ shard_diff: {} })
      ),
      [voxelShard(0, 0, 0)]
    );
    assert.deepEqual(
      new RestorationSimulation(voxeloo, replica(terrainEntity)).invalidate(
        update({ terrain_restoration_diff: {} })
      ),
      [voxelShard(0, 0, 0)]
    );
    assert.deepEqual(
      new OreGrowthSimulation(
        voxeloo,
        replica(terrainEntity),
        clock
      ).invalidate(update({ shard_seed: {} })),
      [voxelShard(0, 0, 0)]
    );

    const sky = new SkyOcclusionSimulation(
      voxeloo,
      replica(terrainEntity),
      map
    );
    const skyInvalidated = sky.invalidate(update({ shard_diff: {} }));
    assert.equal(skyInvalidated.length, 9);
    const reduced = new Set([
      voxelShard(0, -32, 0),
      voxelShard(0, 0, 0),
      voxelShard(32, 64, 0),
    ]);
    sky.reduce(reduced);
    assert.deepEqual(
      new Set([...reduced].map((shard) => shardDecode(shard)[1])),
      new Set([0])
    );

    const water = new WaterSimulation(voxeloo, replica(terrainEntity), map);
    assert.equal(water.invalidate(update({ shard_water: {} })).length, 7);
    assert.deepEqual(water.invalidate(update({ shard_diff: {} })), [
      voxelShard(0, 0, 0),
    ]);
    assert.deepEqual(water.invalidate(update({ shard_dye: {} })), []);
    assert.deepEqual(water.invalidate(deletion()), []);
  });

  it("tracks unmuck sources across creation, movement/removal, and deletion", () => {
    let current: ReadonlyEntity | undefined = {
      id,
      position: { v: [0, 0, 0] },
      unmuck: {},
    } as unknown as ReadonlyEntity;
    const muckReplica = {
      table: {
        scan: () => [],
        get: () => current,
      },
    } as unknown as GaiaReplica;
    const simulation = new MuckSimulation(voxeloo, muckReplica);
    assert.deepEqual(simulation.invalidate(update({ unmuck: {} })), [
      voxelShard(0, 0, 0),
    ]);
    current = undefined;
    assert.deepEqual(simulation.invalidate(update({ position: null })), [
      voxelShard(0, 0, 0),
    ]);
    assert.deepEqual(simulation.invalidate(deletion()), []);

    const terrainMuck = new MuckSimulation(voxeloo, replica(terrainEntity));
    assert.equal(
      new Set(terrainMuck.invalidate(update({ shard_muck: {} }))).size,
      27
    );
  });

  it("invalidates farming plants from explicit and stored positions", () => {
    const storedPlant = {
      id,
      position: { v: [64, 0, 0] },
    } as unknown as ReadonlyEntity;
    const simulation = new FarmingSimulation(
      voxeloo,
      replica(storedPlant).table,
      {} as IdGenerator
    );
    assert.deepEqual(
      simulation.invalidate(
        update({
          farming_plant_component: {},
          position: { v: [0, 0, 0] },
        })
      ),
      [voxelShard(0, 0, 0)]
    );
    assert.deepEqual(
      simulation.invalidate(update({ farming_plant_component: {} })),
      [voxelShard(64, 0, 0)]
    );
    assert.deepEqual(simulation.invalidate(deletion()), []);
    assert.deepEqual(simulation.invalidate(update({ position: {} })), []);
  });
});
