import assert from "assert";
import {
  DEFAULT_ANIMA_NPC_TICK_DURATION_SECONDS,
  DEFAULT_ANIMA_NPC_TICK_TIME_MS,
  validatedAnimaNpcTickDurationSeconds,
  validatedAnimaNpcTickTimeMs,
} from "../runtime_config";

describe("Anima runtime tick configuration", () => {
  it("preserves finite positive intervals", () => {
    assert.equal(validatedAnimaNpcTickTimeMs({ animaNpcTickTimeMs: 125 }), 125);
  });

  it("rejects zero, negative, non-finite, null, and missing intervals", () => {
    for (const animaNpcTickTimeMs of [0, -1, NaN, Infinity, null, undefined]) {
      assert.equal(
        validatedAnimaNpcTickTimeMs({ animaNpcTickTimeMs }),
        DEFAULT_ANIMA_NPC_TICK_TIME_MS
      );
    }
  });

  it("replaces invalid durations at the final per-NPC tick boundary", () => {
    assert.equal(
      validatedAnimaNpcTickDurationSeconds(0),
      DEFAULT_ANIMA_NPC_TICK_DURATION_SECONDS
    );
    assert.equal(
      validatedAnimaNpcTickDurationSeconds(Number.NaN),
      DEFAULT_ANIMA_NPC_TICK_DURATION_SECONDS
    );
    assert.equal(validatedAnimaNpcTickDurationSeconds(0.125), 0.125);
  });
});
