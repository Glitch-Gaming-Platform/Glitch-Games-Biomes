import { RedisLeaderboard } from "@/server/shared/world/redis_leaderboard";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

class FakeLeaderboardRedis {
  readonly calls: unknown[][] = [];
  nextRangeResponse: string[] = [];
  nextRankResponse: number | null = null;

  readonly replica = {
    zrange: async (...args: unknown[]) => {
      this.calls.push(["zrange", ...args]);
      return this.nextRangeResponse;
    },
    zrevrange: async (...args: unknown[]) => {
      this.calls.push(["zrevrange", ...args]);
      return this.nextRangeResponse;
    },
    zrangebyscore: async (...args: unknown[]) => {
      this.calls.push(["zrangebyscore", ...args]);
      return this.nextRangeResponse;
    },
    zrevrangebyscore: async (...args: unknown[]) => {
      this.calls.push(["zrevrangebyscore", ...args]);
      return this.nextRangeResponse;
    },
    zrank: async (...args: unknown[]) => {
      this.calls.push(["zrank", ...args]);
      return this.nextRankResponse;
    },
    zrevrank: async (...args: unknown[]) => {
      this.calls.push(["zrevrank", ...args]);
      return this.nextRankResponse;
    },
  };

  readonly primary = {
    multi: () => new FakeLeaderboardPipeline(this.calls),
  };
}

class FakeLeaderboardPipeline {
  constructor(private readonly calls: unknown[][]) {}

  zincrby(...args: unknown[]) {
    this.calls.push(["zincrby", ...args]);
    return this;
  }

  zadd(...args: unknown[]) {
    this.calls.push(["zadd", ...args]);
    return this;
  }

  async exec() {
    return this.calls.map(() => [null, 1]);
  }
}

describe("Redis 8.8 leaderboard contracts", () => {
  it("uses stable commands for DESC reads", async () => {
    const redis = new FakeLeaderboardRedis();
    redis.nextRangeResponse = ["b:102", "20", "b:101", "10"];
    const leaderboard = new RedisLeaderboard(redis as any);

    assert.deepEqual(
      await leaderboard.get("ecs:fished:maxLength", "alltime", "DESC", 2),
      [
        { id: 102 as BiomesId, rank: 0, value: 20 },
        { id: 101 as BiomesId, rank: 1, value: 10 },
      ]
    );

    assert.deepEqual(redis.calls, [
      [
        "zrevrange",
        "leaderboard:ecs:fished:maxLength:alltime",
        "0",
        "1",
        "WITHSCORES",
      ],
    ]);
  });

  it("does not round zero-count top reads up to one row", async () => {
    const redis = new FakeLeaderboardRedis();
    const leaderboard = new RedisLeaderboard(redis as any);

    assert.deepEqual(
      await leaderboard.get("ecs:fished:maxLength", "alltime", "DESC", 0),
      []
    );
    assert.deepEqual(redis.calls, []);
  });

  it("uses stable score-range commands", async () => {
    const redis = new FakeLeaderboardRedis();
    redis.nextRangeResponse = ["b:106", "16", "b:105", "15"];
    redis.nextRankResponse = 3;
    const leaderboard = new RedisLeaderboard(redis as any);

    assert.deepEqual(
      await leaderboard.getAfterScore(
        "ecs:fished:maxLength",
        "alltime",
        "DESC",
        16,
        2
      ),
      [
        { id: 106 as BiomesId, rank: 3, value: 16 },
        { id: 105 as BiomesId, rank: 4, value: 15 },
      ]
    );

    assert.deepEqual(redis.calls, [
      [
        "zrevrangebyscore",
        "leaderboard:ecs:fished:maxLength:alltime",
        16,
        "-inf",
        "WITHSCORES",
        "LIMIT",
        0,
        2,
      ],
      ["zrevrank", "leaderboard:ecs:fished:maxLength:alltime", "b:106"],
    ]);
  });

  it("uses ascending ranks for ASC score-range reads", async () => {
    const redis = new FakeLeaderboardRedis();
    redis.nextRangeResponse = ["b:104", "14"];
    redis.nextRankResponse = 4;
    const leaderboard = new RedisLeaderboard(redis as any);

    assert.deepEqual(
      await leaderboard.getAfterScore(
        "ecs:fished:maxLength",
        "alltime",
        "ASC",
        14,
        1
      ),
      [{ id: 104 as BiomesId, rank: 4, value: 14 }]
    );

    assert.deepEqual(redis.calls, [
      [
        "zrangebyscore",
        "leaderboard:ecs:fished:maxLength:alltime",
        14,
        "+inf",
        "WITHSCORES",
        "LIMIT",
        0,
        1,
      ],
      ["zrank", "leaderboard:ecs:fished:maxLength:alltime", "b:104"],
    ]);
  });

  it("uses native atomic Redis 8.8 leaderboard updates", async () => {
    const redis = new FakeLeaderboardRedis();
    const leaderboard = new RedisLeaderboard(redis as any);

    await leaderboard.record(
      "ecs:fished:maxLength",
      "GT",
      101 as BiomesId,
      12
    );

    assert.equal(redis.calls.length, 3);
    for (const call of redis.calls) {
      assert.equal(call[0], "zadd");
      assert.equal(call[2], "GT");
      assert.equal(call[3], 12);
      assert.equal(call[4], "b:101");
    }
  });
});
