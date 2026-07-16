/// <reference types="mocha" />

import assert from "assert";
import { shouldRequestPlayerShardRecovery } from "@/client/game/helpers/player_shards";

describe("player shard recovery", () => {
  it("waits for a sustained missing-shard window before recovery", () => {
    assert.equal(
      shouldRequestPlayerShardRecovery({
        missingSince: 1_000,
        now: 8_999,
        alreadyRequested: false,
        delayMs: 8_000,
      }),
      false
    );
    assert.equal(
      shouldRequestPlayerShardRecovery({
        missingSince: 1_000,
        now: 9_000,
        alreadyRequested: false,
        delayMs: 8_000,
      }),
      true
    );
  });

  it("never requests a second recovery from the same player controller", () => {
    assert.equal(
      shouldRequestPlayerShardRecovery({
        missingSince: 1_000,
        now: 20_000,
        alreadyRequested: true,
      }),
      false
    );
  });
});
