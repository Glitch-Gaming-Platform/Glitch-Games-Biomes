import assert from "assert";
import {
  readHarthmerePlayerAndSharedStateStrings,
  readHarthmereRedisStrings,
} from "@/server/harthmere/live_mode_state_read_helpers";

describe("live_mode_state_read_helpers", () => {
  it("uses Redis MGET when available", async () => {
    const mgetCalls: string[][] = [];
    const values = await readHarthmereRedisStrings(
      {
        get: async () => {
          throw new Error("get should not be called when mget exists");
        },
        mget: async (...keys: string[]) => {
          mgetCalls.push(keys);
          return ["one", null, "three"];
        },
      },
      ["a", "b", "c"]
    );

    assert.deepEqual(mgetCalls, [["a", "b", "c"]]);
    assert.deepEqual(values, ["one", null, "three"]);
  });

  it("falls back to GET calls for simple test fakes", async () => {
    const getCalls: string[] = [];
    const values = await readHarthmereRedisStrings(
      {
        get: async (key: string) => {
          getCalls.push(key);
          return `value:${key}`;
        },
      },
      ["a", "b"]
    );

    assert.deepEqual(getCalls, ["a", "b"]);
    assert.deepEqual(values, ["value:a", "value:b"]);
  });

  it("returns named player/shared values", async () => {
    const result = await readHarthmerePlayerAndSharedStateStrings(
      {
        get: async (key: string) => `value:${key}`,
      },
      "player-key",
      "shared-key"
    );

    assert.deepEqual(result, {
      rawState: "value:player-key",
      rawSharedState: "value:shared-key",
    });
  });

  it("coalesces concurrent identical Redis reads", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mgetCalls: string[][] = [];
    const primary = {
      get: async () => {
        throw new Error("get should not be called when mget exists");
      },
      mget: async (...keys: string[]) => {
        mgetCalls.push(keys);
        await gate;
        return keys.map((key) => `value:${key}`);
      },
    };

    const first = readHarthmereRedisStrings(primary, ["player", "shared"]);
    const second = readHarthmereRedisStrings(primary, ["player", "shared"]);
    release?.();

    assert.deepEqual(await Promise.all([first, second]), [
      ["value:player", "value:shared"],
      ["value:player", "value:shared"],
    ]);
    assert.deepEqual(mgetCalls, [["player", "shared"]]);
  });

  it("does not coalesce different Redis key sets", async () => {
    const mgetCalls: string[][] = [];
    const primary = {
      get: async () => {
        throw new Error("get should not be called when mget exists");
      },
      mget: async (...keys: string[]) => {
        mgetCalls.push(keys);
        return keys.map((key) => `value:${key}`);
      },
    };

    await Promise.all([
      readHarthmereRedisStrings(primary, ["player"]),
      readHarthmereRedisStrings(primary, ["player", "shared"]),
    ]);

    assert.deepEqual(mgetCalls, [["player"], ["player", "shared"]]);
  });
});
