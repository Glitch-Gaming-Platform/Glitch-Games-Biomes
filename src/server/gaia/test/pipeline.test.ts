import { Pipeline } from "@/server/gaia/pipeline";
import type { Sharder } from "@/server/gaia/sharder";
import { Simulation } from "@/server/gaia/simulations/api";
import type { GaiaReplica } from "@/server/gaia/table";
import type { TerrainEmitter } from "@/server/gaia/terrain/emitter";
import type { GaiaPubSub } from "@/server/gaia/util/pubsub";
import type { Change } from "@/shared/ecs/change";
import type { ListenerKey } from "@/shared/events";
import type { ShardId } from "@/shared/game/shard";
import { voxelShard } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";
import EventEmitter from "node:events";

class PipelineSimulation extends Simulation {
  invalidations: Change[] = [];
  invalidatedShards: ShardId[] = [];

  constructor(name: "farming" | "water" = "farming") {
    super(name);
  }

  invalidate(change: Change) {
    this.invalidations.push(change);
    return this.invalidatedShards;
  }

  async update() {
    return undefined;
  }
}

class PipelineSharder extends EventEmitter {
  readonly heldValues = new Set<ShardId>();
}

function makePipeline(simulations: Simulation[]) {
  let replicaListener: ((changes: Change[]) => void) | undefined;
  let replicaOffKey: ListenerKey | undefined;
  let pubsubListener: ((update: any) => void) | undefined;
  let pubsubOffListener: ((update: any) => void) | undefined;
  const replica = {
    table: { get: () => undefined },
    on: (_event: string, listener: (changes: Change[]) => void) => {
      replicaListener = listener;
      return "replica-listener" as ListenerKey;
    },
    off: (_event: string, key: ListenerKey) => {
      replicaOffKey = key;
    },
  } as unknown as GaiaReplica;
  const pubsub = {
    on: (listener: (update: any) => void) => {
      pubsubListener = listener;
    },
    off: (listener: (update: any) => void) => {
      pubsubOffListener = listener;
    },
  } as GaiaPubSub;
  const sharder = new PipelineSharder();
  const pipeline = new Pipeline(
    replica,
    pubsub,
    sharder as unknown as Sharder,
    { pushChange: () => {}, flush: async () => 0 } as unknown as TerrainEmitter,
    simulations
  );
  return {
    pipeline,
    sharder,
    emitReplica: (changes: Change[]) => replicaListener?.(changes),
    emitPubSub: (update: any) => pubsubListener?.(update),
    replicaOffKey: () => replicaOffKey,
    pubsubListener: () => pubsubListener,
    pubsubOffListener: () => pubsubOffListener,
  };
}

describe("Gaia Pipeline", () => {
  it("routes pubsub work to the matching simulation and ignores unknown names", () => {
    const farming = new PipelineSimulation("farming");
    const water = new PipelineSimulation("water");
    const { pipeline, sharder, emitPubSub } = makePipeline([farming, water]);
    const shard = voxelShard(0, 0, 0);
    sharder.heldValues.add(shard);

    emitPubSub([
      ["farming", [shard]],
      ["unknown", [shard]],
    ]);

    assert.deepEqual(pipeline.pending(), [
      ["farming", [shard]],
      ["water", []],
    ]);
  });

  it("subscribes to replica changes, invalidates every simulation, and unregisters on stop", async () => {
    const farming = new PipelineSimulation("farming");
    const water = new PipelineSimulation("water");
    const {
      pipeline,
      emitReplica,
      replicaOffKey,
      pubsubListener,
      pubsubOffListener,
    } = makePipeline([farming, water]);
    const change = {
      kind: "delete",
      tick: 1,
      id: 5 as BiomesId,
    } as Change;

    await pipeline.start();
    emitReplica([change]);
    await pipeline.stop();

    assert.deepEqual(farming.invalidations, [change]);
    assert.deepEqual(water.invalidations, [change]);
    assert.equal(replicaOffKey(), "replica-listener");
    assert.strictEqual(pubsubOffListener(), pubsubListener());
  });

  it("cannot be started twice", async () => {
    const { pipeline } = makePipeline([new PipelineSimulation()]);
    await pipeline.start();
    try {
      await assert.rejects(() => pipeline.start(), /Cannot restart a pipeline/);
    } finally {
      await pipeline.stop();
    }
  });
});
