import assert from "assert";

import {
  FISHING_MOVEMENT_RESET_DISTANCE,
  MAX_FISHING_CAST_SECONDS,
  MAX_FISHING_CATCH_BAR_SIZE,
  MAX_FISHING_TICK_DELTA_SECONDS,
  MIN_FISHING_CATCH_BAR_SIZE,
  boundedFishingTickDelta,
  fishingCastExpired,
  fishingMovementRequiresReset,
  normalizeFishingCatchBarSize,
} from "@/shared/game/fishing";

describe("native fishing safety bounds", () => {
  it("terminates casts that never hit loaded terrain or water", () => {
    assert.equal(fishingCastExpired(MAX_FISHING_CAST_SECONDS), false);
    assert.equal(fishingCastExpired(MAX_FISHING_CAST_SECONDS + 0.001), true);
    assert.equal(fishingCastExpired(-0.001), true);
    assert.equal(fishingCastExpired(Number.POSITIVE_INFINITY), true);
  });

  it("clamps catch bars to a playable finite range", () => {
    assert.equal(normalizeFishingCatchBarSize(-10), MIN_FISHING_CATCH_BAR_SIZE);
    assert.equal(normalizeFishingCatchBarSize(0.35), 0.35);
    assert.equal(normalizeFishingCatchBarSize(10), MAX_FISHING_CATCH_BAR_SIZE);
    assert.equal(
      normalizeFishingCatchBarSize(Number.NaN),
      MIN_FISHING_CATCH_BAR_SIZE
    );
  });

  it("bounds long or invalid browser-frame deltas", () => {
    assert.equal(boundedFishingTickDelta(-1), 0);
    assert.equal(boundedFishingTickDelta(Number.NaN), 0);
    assert.equal(boundedFishingTickDelta(0.05), 0.05);
    assert.equal(boundedFishingTickDelta(5), MAX_FISHING_TICK_DELTA_SECONDS);
  });

  it("ignores standing jitter but resets real movement and invalid warps", () => {
    assert.equal(fishingMovementRequiresReset(undefined, [0, 0, 0]), false);
    assert.equal(
      fishingMovementRequiresReset(
        [0, 0, 0],
        [FISHING_MOVEMENT_RESET_DISTANCE / 2, 0, 0]
      ),
      false
    );
    assert.equal(
      fishingMovementRequiresReset(
        [0, 0, 0],
        [FISHING_MOVEMENT_RESET_DISTANCE + 0.01, 0, 0]
      ),
      true
    );
    assert.equal(
      fishingMovementRequiresReset([0, 0, 0], [Number.NaN, 0, 0]),
      true
    );
  });
});
