import {
  RedisFirehoseSubscription,
  isRedisNoGroupError,
} from "@/server/shared/firehose/redis";
import assert from "assert";

function noGroupError() {
  return new Error(
    "NOGROUP No such key 'firehose' or consumer group 'trigger-server'"
  );
}

describe("RedisFirehose missing consumer group recovery", () => {
  it("recognizes Redis NOGROUP errors", () => {
    assert.equal(isRedisNoGroupError(noGroupError()), true);
    assert.equal(isRedisNoGroupError(new Error("BUSYGROUP")), false);
  });

  it("recreates the group when live event reads lose the Redis stream group", async () => {
    const xgroupCalls: unknown[][] = [];
    const redis = {
      primary: {
        xreadgroupBuffer: async () => {
          throw noGroupError();
        },
        xgroup: async (...args: unknown[]) => {
          xgroupCalls.push(args);
        },
      },
    };
    const subscription = new RedisFirehoseSubscription(
      redis as any,
      "trigger-server",
      "consumer-1",
      1000
    );

    const [acks, events] = await (subscription as any).getMyEvents(">");

    assert.deepEqual(acks, []);
    assert.deepEqual(events, []);
    assert.deepEqual(xgroupCalls, [
      ["CREATE", Buffer.from("firehose"), "trigger-server", "$", "MKSTREAM"],
    ]);
  });

  it("recreates the group when missed-event recovery loses the Redis stream group", async () => {
    const xgroupCalls: unknown[][] = [];
    const redis = {
      primary: {
        xautoclaimBuffer: async () => {
          throw noGroupError();
        },
        xgroup: async (...args: unknown[]) => {
          xgroupCalls.push(args);
        },
      },
    };
    const subscription = new RedisFirehoseSubscription(
      redis as any,
      "notifications-server",
      "consumer-1",
      1000
    );

    const [acks, events] = await (subscription as any).getMissedEvents();

    assert.deepEqual(acks, []);
    assert.deepEqual(events, []);
    assert.deepEqual(xgroupCalls, [
      [
        "CREATE",
        Buffer.from("firehose"),
        "notifications-server",
        "$",
        "MKSTREAM",
      ],
    ]);
  });

  it("recreates the group instead of throwing when ack sees a deleted stream group", async () => {
    const xgroupCalls: unknown[][] = [];
    const redis = {
      primary: {
        xack: async () => {
          throw noGroupError();
        },
        xgroup: async (...args: unknown[]) => {
          xgroupCalls.push(args);
        },
      },
    };
    const subscription = new RedisFirehoseSubscription(
      redis as any,
      "trigger-server",
      "consumer-1",
      1000
    );

    await (subscription as any).ackEvents([Buffer.from("1-0")]);

    assert.equal(xgroupCalls.length, 1);
  });
});
