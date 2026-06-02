import assert from "assert";
import {
  readHarthmerePlayerAndSharedStateStringsV1,
  readHarthmereRedisStringsV1,
} from "../live_mode_state_read_helpers";

describe("live_mode_state_read_helpers", () => {
  it("uses Redis MGET when available", async () => {
    const mgetCalls: string[][] = [];
    const values = await readHarthmereRedisStringsV1(
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
    const values = await readHarthmereRedisStringsV1(
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
    const result = await readHarthmerePlayerAndSharedStateStringsV1(
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
});
