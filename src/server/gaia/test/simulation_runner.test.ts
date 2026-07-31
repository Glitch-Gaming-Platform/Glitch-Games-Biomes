import type { Sharder } from "@/server/gaia/sharder";
import { Simulation } from "@/server/gaia/simulations/api";
import { SimulationRunner } from "@/server/gaia/simulations/runner";
import type { GaiaReplica, TerrainShard } from "@/server/gaia/table";
import type { TerrainEmitter } from "@/server/gaia/terrain/emitter";
import type { ChangeToApply } from "@/shared/api/transaction";
import type { Change } from "@/shared/ecs/change";
import { Box, ShardDiff, ShardSeed } from "@/shared/ecs/gen/components";
import type { ShardId } from "@/shared/game/shard";
import { voxelShard } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";
import EventEmitter from "node:events";

class FakeSharder extends EventEmitter {
  readonly heldValues = new Set<ShardId>();
}

class TestSimulation extends Simulation {
  readonly invalidated: Change[] = [];
  readonly updates: Array<[TerrainShard, number]> = [];
  invalidationResult: ShardId[] = [];
  updateResult: Awaited<ReturnType<Simulation["update"]>>;

  constructor() {
    super("farming");
  }

  invalidate(change: Change): ShardId[] {
    this.invalidated.push(change);
    return this.invalidationResult;
  }

  async update(shard: TerrainShard, version: number) {
    this.updates.push([shard, version]);
    return this.updateResult;
  }
}

describe("Gaia SimulationRunner", () => {
  const shardId = voxelShard(0, 0, 0);
  const shard = {
    id: 101 as BiomesId,
    box: Box.create({ v0: [0, 0, 0], v1: [32, 32, 32] }),
    shard_seed: ShardSeed.create(),
    shard_diff: ShardDiff.create(),
  } as TerrainShard;
  let originalDisabled: typeof CONFIG.gaiaDisabledSimulations;
  let originalThrottle: typeof CONFIG.gaiaShardThrottleMs;

  beforeEach(() => {
    originalDisabled = CONFIG.gaiaDisabledSimulations;
    originalThrottle = CONFIG.gaiaShardThrottleMs;
    CONFIG.gaiaDisabledSimulations = [];
    CONFIG.gaiaShardThrottleMs = [];
  });

  afterEach(() => {
    CONFIG.gaiaDisabledSimulations = originalDisabled;
    CONFIG.gaiaShardThrottleMs = originalThrottle;
  });

  function context(flushResult: number | "aborted" = 0) {
    const sharder = new FakeSharder();
    sharder.heldValues.add(shardId);
    const simulation = new TestSimulation();
    const pushed: ChangeToApply[] = [];
    let flushCount = 0;
    const emitter = {
      pushChange: (...changes: ChangeToApply[]) => pushed.push(...changes),
      flush: async () => {
        flushCount += 1;
        return flushResult;
      },
    } as unknown as TerrainEmitter;
    const replica = {
      table: {
        get: () => shard,
        getWithVersion: () => [17, shard],
      },
    } as unknown as GaiaReplica;
    const runner = new SimulationRunner(
      replica,
      sharder as unknown as Sharder,
      emitter,
      simulation
    );
    return {
      runner,
      simulation,
      pushed,
      flushCount: () => flushCount,
    };
  }

  it("queues shards invalidated by ECS changes", () => {
    const { runner, simulation } = context();
    try {
      const change = { kind: "delete", id: 99 as BiomesId } as Change;
      simulation.invalidationResult = [shardId];

      runner.handleChange(change);

      assert.deepEqual(simulation.invalidated, [change]);
      assert.deepEqual(runner.pending(), [shardId]);
    } finally {
      runner.stop();
    }
  });

  it("updates the current shard version, emits changes, and flushes once", async () => {
    const { runner, simulation, pushed, flushCount } = context(1);
    const change = deleteChange(7);
    simulation.updateResult = { changes: [change] };
    try {
      await runner.tick(new AbortController().signal);

      assert.deepEqual(simulation.updates, [[shard, 17]]);
      assert.deepEqual(pushed, [change]);
      assert.equal(flushCount(), 1);
    } finally {
      runner.stop();
    }
  });

  it("requeues the processed shard when publishing is aborted", async () => {
    const { runner } = context("aborted");
    try {
      await runner.tick(new AbortController().signal);

      assert.deepEqual(runner.pending(), [shardId]);
    } finally {
      runner.stop();
    }
  });

  it("leaves disabled simulations queued without running their update", async () => {
    CONFIG.gaiaDisabledSimulations = ["farming"];
    const { runner, simulation } = context();
    try {
      await runner.tick(new AbortController().signal);

      assert.deepEqual(simulation.updates, []);
    } finally {
      runner.stop();
    }
  });
});

function deleteChange(id: number): ChangeToApply {
  return {
    changes: [{ kind: "delete", id: id as BiomesId }],
  };
}
