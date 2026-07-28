/// <reference types="mocha" />

import assert from "assert";
import {
  playerShardLoadWorldAabb,
  shouldRequestPlayerShardRecovery,
} from "@/client/game/helpers/player_shards";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import type { ReadonlyAABB } from "@/shared/math/types";

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

  it("uses detached dungeon bounds without expanding ordinary WorldMetadata", () => {
    const ordinary: ReadonlyAABB = [
      [-1792, -224, -1792],
      [2560, 288, 1792],
    ];
    const winter = ch1ElsewhenSlot("ch1_dungeon_winter")!;
    const player: ReadonlyAABB = [
      [winter.arrival[0] - 0.5, winter.arrival[1], winter.arrival[2] - 0.5],
      [winter.arrival[0] + 0.5, winter.arrival[1] + 2, winter.arrival[2] + 0.5],
    ];

    const selected = playerShardLoadWorldAabb(ordinary, player);
    assert.deepEqual(selected[0], [winter.minX, -64, -512]);
    assert.deepEqual(selected[1], [winter.maxX, 192, 512]);
    assert.deepEqual(ordinary[1], [2560, 288, 1792]);
  });

  it("keeps ordinary players on the ordinary WorldMetadata bounds", () => {
    const ordinary: ReadonlyAABB = [
      [-1792, -224, -1792],
      [2560, 288, 1792],
    ];
    const player: ReadonlyAABB = [
      [2300, 52, -300],
      [2301, 54, -299],
    ];
    assert.equal(playerShardLoadWorldAabb(ordinary, player), ordinary);
  });
});
