import type { PlayerSpatialObserver } from "@/server/shared/chat/player_observer";
import {
  EXTENDED_DELIVERY_FIELD_NAME,
  EXTENDED_DELIVERY_STREAM_KEY,
} from "@/server/shared/chat/redis/common";
import {
  RedisChatDistributor,
  registerRedisChatDistributor,
} from "@/server/shared/chat/redis/distribution";
import type { Delivery } from "@/shared/chat/types";
import { zrpcSerialize } from "@/shared/zrpc/serde";
import assert from "assert";

describe("RedisChatDistributor registration", () => {
  const originalCreate = RedisChatDistributor.create;
  const originalEnv = {
    GLITCH_DISABLE_CHAT_PUSH: process.env.GLITCH_DISABLE_CHAT_PUSH,
    GLITCH_RUNTIME: process.env.GLITCH_RUNTIME,
    GLITCH_DISABLE_GCP: process.env.GLITCH_DISABLE_GCP,
    GLITCH_TITLE_ID: process.env.GLITCH_TITLE_ID,
    NODE_ENV: process.env.NODE_ENV,
  };

  const playerSpatialObserver = {} as PlayerSpatialObserver;

  afterEach(() => {
    RedisChatDistributor.create = originalCreate;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("skips push-only dependencies in Glitch runtime", async () => {
    process.env.GLITCH_RUNTIME = "1";
    Object.assign(process.env, { NODE_ENV: "production" });

    let getAllCalled = false;
    let createArgs: Parameters<typeof RedisChatDistributor.create> | undefined;

    RedisChatDistributor.create = async (...args) => {
      createArgs = args;
      return {} as RedisChatDistributor;
    };

    await registerRedisChatDistributor({
      get: async (key: string) => {
        assert.strictEqual(key, "playerSpatialObserver");
        return playerSpatialObserver;
      },
      getAll: async () => {
        getAllCalled = true;
        throw new Error("Glitch chat startup should not load push context");
      },
    } as any);

    assert.strictEqual(getAllCalled, false);
    assert.strictEqual(createArgs?.[0], playerSpatialObserver);
    assert.strictEqual(createArgs?.[1], undefined);
    assert.strictEqual(createArgs?.[2], "redis-chat-distributor");
  });

  it("loads push dependencies outside the Glitch runtime", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.GLITCH_DISABLE_CHAT_PUSH;
    delete process.env.GLITCH_RUNTIME;
    delete process.env.GLITCH_DISABLE_GCP;
    delete process.env.GLITCH_TITLE_ID;

    const pushContext = {
      db: {},
      discordBot: {},
      serverCache: {},
    };
    let requestedKeys: string[] = [];
    let createArgs: Parameters<typeof RedisChatDistributor.create> | undefined;

    RedisChatDistributor.create = async (...args) => {
      createArgs = args;
      return {} as RedisChatDistributor;
    };

    await registerRedisChatDistributor({
      get: async (key: string) => {
        assert.strictEqual(key, "playerSpatialObserver");
        return playerSpatialObserver;
      },
      getAll: async (...keys: string[]) => {
        requestedKeys = keys;
        return pushContext;
      },
    } as any);

    assert.deepStrictEqual(requestedKeys, ["db", "discordBot", "serverCache"]);
    assert.strictEqual(createArgs?.[0], playerSpatialObserver);
    assert.strictEqual(createArgs?.[1], pushContext);
    assert.strictEqual(createArgs?.[2], "redis-chat-distributor");
  });

  it("falls back to XPENDING/XCLAIM when XAUTOCLAIM is unavailable", async () => {
    const delivery: Delivery = {
      channelName: "chat",
      mail: [
        {
          id: "message-1",
          createdAt: 1,
          message: {
            kind: "text",
            content: "hello",
          },
          spatial: {
            position: [0, 0, 0],
            volume: "chat",
          },
        },
      ],
    };
    const id = Buffer.from("1-0") as any;
    const fields = [EXTENDED_DELIVERY_FIELD_NAME, zrpcSerialize(delivery)];
    const claimed: unknown[][] = [];
    const acked: unknown[][] = [];
    let xautoclaimCalls = 0;
    let xpendingCalls = 0;

    const redis = {
      primary: {
        xgroup: async () => undefined,
        xautoclaimBuffer: async () => {
          xautoclaimCalls++;
          throw new Error("ERR unknown command `xautoclaim`");
        },
        xpendingBuffer: async (...args: unknown[]) => {
          xpendingCalls++;
          assert.deepStrictEqual(args, [
            EXTENDED_DELIVERY_STREAM_KEY,
            "test",
            "-",
            "+",
            CONFIG.chatRedisDistributorFetchSize,
          ]);
          return [
            [
              id,
              Buffer.from("old-consumer"),
              CONFIG.chatRedisDistributorTtlSecs,
              1,
            ],
          ];
        },
        xclaimBuffer: async (...args: unknown[]) => {
          claimed.push(args);
          return [[id, fields]];
        },
        xack: async (...args: unknown[]) => {
          acked.push(args);
        },
        xinfo: async () => [],
      },
    };

    const distributor = await RedisChatDistributor.create(
      playerSpatialObserver,
      undefined,
      "test",
      redis as any
    );

    const result = await (distributor as any).getMissedDeliveries();
    assert.strictEqual(xautoclaimCalls, 1);
    assert.strictEqual(xpendingCalls, 1);
    assert.deepStrictEqual(claimed, [
      [
        EXTENDED_DELIVERY_STREAM_KEY,
        "test",
        (distributor as any).consumer,
        CONFIG.chatRedisDistributorTtlSecs,
        id,
      ],
    ]);
    assert.deepStrictEqual(result.deliveries, [delivery]);

    await result.ack();
    assert.deepStrictEqual(acked, [[EXTENDED_DELIVERY_STREAM_KEY, "test", id]]);

    await distributor.stop();
  });
});
