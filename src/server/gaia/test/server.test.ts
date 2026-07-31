import { GaiaServer } from "@/server/gaia/server";
import type { Pipeline } from "@/server/gaia/pipeline";
import type { Sharder } from "@/server/gaia/sharder";
import type { GaiaPubSub } from "@/server/gaia/util/pubsub";
import type { GaiaPubSubUpdate } from "@/server/shared/pubsub/api";
import type { ShardId } from "@/shared/game/shard";
import assert from "assert";

describe("GaiaServer", () => {
  it("starts the simulation pipeline before acquiring shards", async () => {
    const calls: string[] = [];
    const server = new GaiaServer(
      {
        start: async () => {
          calls.push("pipeline.start");
        },
      } as Pipeline,
      {
        start: async () => {
          calls.push("sharder.start");
        },
      } as Sharder,
      {} as GaiaPubSub
    );

    await server.start();

    assert.deepEqual(calls, ["pipeline.start", "sharder.start"]);
  });

  it("hands pending work off before stopping the simulation pipeline", async () => {
    const originalDelay = CONFIG.gaiaV2ShutdownDelayMs;
    CONFIG.gaiaV2ShutdownDelayMs = 0;
    try {
      const calls: string[] = [];
      const pending: GaiaPubSubUpdate = [
        ["farming", ["pending-shard" as ShardId]],
      ];
      let published: GaiaPubSubUpdate | undefined;
      const server = new GaiaServer(
        {
          pending: () => {
            calls.push("pipeline.pending");
            return pending;
          },
          stop: async () => {
            calls.push("pipeline.stop");
          },
        } as Pipeline,
        {
          stop: async () => {
            calls.push("sharder.stop");
          },
        } as Sharder,
        {
          publish: async (update: GaiaPubSubUpdate) => {
            calls.push("pubsub.publish");
            published = update;
          },
        } as GaiaPubSub
      );

      await server.stop();

      assert.strictEqual(published, pending);
      assert.deepEqual(calls, [
        "pipeline.pending",
        "sharder.stop",
        "pubsub.publish",
        "pipeline.stop",
      ]);
    } finally {
      CONFIG.gaiaV2ShutdownDelayMs = originalDelay;
    }
  });
});
