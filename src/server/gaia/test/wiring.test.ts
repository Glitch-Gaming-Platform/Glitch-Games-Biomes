import { Sharder, registerGaiaSharder } from "@/server/gaia/sharder";
import { registerSimulations } from "@/server/gaia/simulations";
import { zSimulationName } from "@/server/gaia/simulations/api";
import { registerGaiaReplica } from "@/server/gaia/table";
import { TerrainSync } from "@/server/gaia/terrain/sync";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import type { WorldApi } from "@/server/shared/world/api";
import type { Change } from "@/shared/ecs/change";
import {
  Box,
  ShardDiff,
  ShardDye,
  ShardGrowth,
  ShardIrradiance,
  ShardSeed,
  ShardSkyOcclusion,
  ShardWater,
} from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { ListenerKey } from "@/shared/events";
import { DEFAULT_TOTAL_SHARDS } from "@/server/shared/shard_manager/api";
import { voxelShard } from "@/shared/game/shard";
import { CH1_ELSEWHEN_BAND_START_X } from "@/shared/harthmere/ch1_elsewhen_region";
import type { BiomesId } from "@/shared/ids";
import type { RegistryLoader } from "@/shared/registry";
import type { VoxelooModule } from "@/shared/wasm/types";
import type { GaiaTerrainMapV2 } from "@/shared/wasm/types/gaia";
import assert from "assert";

function fakeLoader(values: Record<string, unknown>) {
  const requested: string[] = [];
  return {
    requested,
    loader: {
      get: async (key: string) => {
        requested.push(key);
        return values[key];
      },
    } as RegistryLoader<any>,
  };
}

describe("Gaia sharder wiring", () => {
  it("assigns every vertical shard in a terrain column to one ownership shard", () => {
    const sharder = new Sharder({
      table: {
        metaIndex: { terrain_shard_selector: { getAllKeys: () => [] } },
      },
    } as any);
    const lower = voxelShard(64, 0, -32);
    const upper = voxelShard(64, 96, -32);
    sharder.update([lower, upper]);

    const owner = Array.from(
      { length: DEFAULT_TOTAL_SHARDS },
      (_, i) => i
    ).find((i) => sharder.valuesForShard(i)?.has(lower));
    assert.notEqual(owner, undefined);
    assert.equal(sharder.valuesForShard(owner!)?.has(upper), true);
    assert.deepEqual(sharder.addHeldShards([owner!]), [lower, upper]);
    assert.deepEqual(new Set(sharder.heldValues), new Set([lower, upper]));
  });

  it("registers against the replica dependency", async () => {
    const replica = {
      table: {
        metaIndex: { terrain_shard_selector: { getAllKeys: () => [] } },
      },
    };
    const { loader, requested } = fakeLoader({ replica });

    const sharder = await registerGaiaSharder(loader);

    assert.ok(sharder instanceof Sharder);
    assert.deepEqual(requested, ["replica"]);
    await sharder.stop();
  });
});

describe("Gaia simulation registry", () => {
  it("constructs exactly the configured simulations in configured order", async () => {
    const config = {
      simulations: ["water", "flora_decay", "farming"],
    };
    const { loader, requested } = fakeLoader({
      clock: {},
      config,
      replica: { table: { get: () => undefined, scan: () => [] } },
      terrainMap: {},
      voxeloo: {},
      idGenerator: async () => 1 as BiomesId,
    });

    const simulations = await registerSimulations(loader);

    assert.deepEqual(
      simulations.map((simulation) => simulation.name),
      config.simulations
    );
    assert.deepEqual(
      new Set(requested),
      new Set([
        "clock",
        "config",
        "replica",
        "terrainMap",
        "voxeloo",
        "idGenerator",
      ])
    );
  });

  it("can construct every declared Gaia simulation", async () => {
    const { loader } = fakeLoader({
      clock: {},
      config: { simulations: zSimulationName.options },
      replica: { table: { get: () => undefined, scan: () => [] } },
      terrainMap: {},
      voxeloo: {},
      idGenerator: async () => 1 as BiomesId,
    });

    const simulations = await registerSimulations(loader);

    assert.deepEqual(
      simulations.map((simulation) => simulation.name),
      zSimulationName.options
    );
  });
});

describe("Gaia replica registration", () => {
  it("starts a filtered Gaia replica with all required spatial and key indexes", async () => {
    let subscriptionFilter: unknown;
    const worldApi = {
      subscribe: async function* (config: unknown) {
        subscriptionFilter = config;
        yield { changes: [], bootstrapped: true };
      },
    } as unknown as WorldApi;
    const { loader, requested } = fakeLoader({ worldApi });

    const replica = await registerGaiaReplica(loader);
    try {
      assert.equal(replica.name, "gaia");
      assert.deepEqual(requested, ["worldApi"]);
      assert.deepEqual(subscriptionFilter, {
        filter: {
          anyOf: [
            "shard_seed",
            "unmuck",
            "irradiance",
            "farming_plant_component",
            "world_metadata",
          ],
          noneOf: ["iced"],
        },
      });
      assert.deepEqual(
        new Set(Object.keys(replica.table.metaIndex)),
        new Set([
          "terrain_shard_selector",
          "unmuck_source_selector",
          "light_source_selector",
          "farming_plant_selector",
        ])
      );
    } finally {
      await replica.stop();
    }
  });
});

class TestReplica {
  private listener?: (changes: Change[]) => void;
  private readonly entities = new Map<BiomesId, ReadonlyEntity>();
  offCalls: Array<[string, ListenerKey]> = [];

  readonly table = {
    scanIds: () => this.entities.keys(),
    get: (id: BiomesId) => this.entities.get(id),
  };

  set(entity: ReadonlyEntity) {
    this.entities.set(entity.id, entity);
  }

  on(_event: "tick", listener: (changes: Change[]) => void) {
    this.listener = listener;
    return "terrain-sync-listener" as ListenerKey;
  }

  off(event: "tick", key: ListenerKey) {
    this.offCalls.push([event, key]);
    this.listener = undefined;
  }

  emit(changes: Change[]) {
    this.listener?.(changes);
  }
}

function terrainEntity(id: BiomesId, v0: [number, number, number]) {
  return {
    id,
    box: Box.create({ v0, v1: [v0[0] + 32, v0[1] + 32, v0[2] + 32] }),
    shard_seed: ShardSeed.create(),
    shard_diff: ShardDiff.create(),
    shard_water: ShardWater.create(),
    shard_irradiance: ShardIrradiance.create(),
    shard_sky_occlusion: ShardSkyOcclusion.create(),
    shard_dye: ShardDye.create(),
    shard_growth: ShardGrowth.create(),
  } as ReadonlyEntity;
}

describe("Gaia TerrainSync", () => {
  let voxeloo: VoxelooModule;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  it("builds the native map, applies every supported incremental tensor, and detaches cleanly", async () => {
    const replica = new TestReplica();
    const id = 61_001 as BiomesId;
    const entity = terrainEntity(id, [0, 0, 0]);
    replica.set(entity);
    const map = new voxeloo.GaiaTerrainMapV2();
    const sync = new TerrainSync(voxeloo, replica as any, map);
    try {
      await sync.start();
      assert.deepEqual(map.aabb(), { v0: [0, 0, 0], v1: [32, 32, 32] });

      replica.emit([
        {
          kind: "update",
          tick: 2,
          entity: {
            id,
            shard_diff: entity.shard_diff,
            shard_water: entity.shard_water,
            shard_irradiance: entity.shard_irradiance,
            shard_sky_occlusion: entity.shard_sky_occlusion,
            shard_dye: entity.shard_dye,
            shard_growth: entity.shard_growth,
          },
        },
      ]);
      assert.deepEqual(map.aabb(), { v0: [0, 0, 0], v1: [32, 32, 32] });
      await assert.rejects(() => sync.start(), /TerrainSync already started/);
    } finally {
      await sync.stop();
      map.delete();
    }

    assert.deepEqual(replica.offCalls, [
      ["tick", "terrain-sync-listener" as ListenerKey],
    ]);
    await sync.stop();
    assert.equal(replica.offCalls.length, 1);
  });

  it("ignores deletes, incomplete entities, and portal-only terrain", async () => {
    const replica = new TestReplica();
    const ordinaryId = 61_002 as BiomesId;
    const portalId = 61_003 as BiomesId;
    replica.set({ id: ordinaryId } as ReadonlyEntity);
    replica.set(terrainEntity(portalId, [CH1_ELSEWHEN_BAND_START_X, 0, 0]));
    const map = new voxeloo.GaiaTerrainMapV2();
    const sync = new TerrainSync(voxeloo, replica as any, map);
    try {
      await sync.start();
      const emptyAabb = map.aabb();
      replica.emit([
        { kind: "delete", tick: 2, id: portalId },
        {
          kind: "update",
          tick: 3,
          entity: { id: ordinaryId, shard_diff: ShardDiff.create() },
        },
        {
          kind: "update",
          tick: 4,
          entity: { id: portalId, shard_diff: ShardDiff.create() },
        },
      ]);
      assert.deepEqual(map.aabb(), emptyAabb);
    } finally {
      await sync.stop();
      map.delete();
    }
  });
});
