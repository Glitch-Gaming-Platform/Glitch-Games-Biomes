import { gaiaMissingShardAllowance } from "@/server/gaia/terrain/missing_shard_allowance";
import assert from "assert";

describe("Gaia missing shard allowance", () => {
  it("uses the proportional allowance for the current Harthmere AABB", () => {
    assert.deepEqual(gaiaMissingShardAllowance(282_624, 32_768, 0.12), {
      expectedShards: 282_624,
      absoluteThreshold: 32_768,
      thresholdRatio: 0.12,
      ratioThreshold: 33_914,
      effectiveThreshold: 33_914,
    });
  });

  it("keeps the absolute floor for smaller sparse worlds", () => {
    assert.equal(
      gaiaMissingShardAllowance(100_000, 32_768, 0.12).effectiveThreshold,
      32_768
    );
  });

  it("scales the allowance as an expanded AABB grows", () => {
    assert.equal(
      gaiaMissingShardAllowance(500_000, 32_768, 0.12).effectiveThreshold,
      60_000
    );
  });

  it("clamps malformed configuration to safe bounds", () => {
    assert.deepEqual(gaiaMissingShardAllowance(100.9, -5, 2), {
      expectedShards: 100,
      absoluteThreshold: 0,
      thresholdRatio: 1,
      ratioThreshold: 100,
      effectiveThreshold: 100,
    });
    assert.equal(
      gaiaMissingShardAllowance(Number.NaN, Number.NaN, Number.NaN)
        .effectiveThreshold,
      0
    );
  });
});
