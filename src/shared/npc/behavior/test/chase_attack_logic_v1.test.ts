import assert from "assert";

import {
  chasePathTargetIsStale,
  effectiveAttackStrikeDelaySecs,
} from "@/shared/npc/behavior/chase_attack";
import type { Path } from "@/shared/npc/behavior/pathfinding";

const pathTo = (dest: [number, number, number]): Path => ({
  nodes: [{ position: [0, 0, 0] }, { position: dest }],
});

describe("chase attack: strike timing", () => {
  it("returns the raw strike delay when it already fits inside the interval", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 0.5,
        attackAnimationMultiplier: 1,
        attackIntervalSecs: 2,
      }),
      0.5
    );
  });

  it("REGRESSION: clamps the strike below the interval so a hit always lands", () => {
    // Strike moment (3s) >= interval (2s): the unclamped code would restart the
    // swing before the damage window ever opened, so the NPC flails forever.
    const delay = effectiveAttackStrikeDelaySecs({
      attackStrikeMomentSecs: 3,
      attackAnimationMultiplier: 1,
      attackIntervalSecs: 2,
    });
    assert.ok(delay < 2, `expected strike delay < interval, got ${delay}`);
    assert.equal(delay, 2 * 0.95);
  });

  it("accounts for the animation multiplier speeding up the swing", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 1,
        attackAnimationMultiplier: 2,
        attackIntervalSecs: 2,
      }),
      0.5
    );
  });

  it("guards against a zero or negative animation multiplier", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 0.5,
        attackAnimationMultiplier: 0,
        attackIntervalSecs: 2,
      }),
      0.5
    );
  });

  it("handles a non-positive interval without clamping past zero", () => {
    assert.equal(
      effectiveAttackStrikeDelaySecs({
        attackStrikeMomentSecs: 0.5,
        attackAnimationMultiplier: 1,
        attackIntervalSecs: 0,
      }),
      0.5
    );
  });
});

describe("chase attack: stale path detection", () => {
  it("keeps the path while the target stays near its destination", () => {
    assert.equal(
      chasePathTargetIsStale(pathTo([10, 0, 0]), [10.5, 0, 0.5], 9),
      false
    );
  });

  it("REGRESSION: rebuilds the path once the target drifts past the threshold", () => {
    // Target ran 10 blocks away from the cached path end; without this the NPC
    // would chase the stale spot until the 8s stuck timer fired.
    assert.equal(chasePathTargetIsStale(pathTo([10, 0, 0]), [20, 0, 0], 9), true);
  });

  it("treats an empty path as stale", () => {
    assert.equal(chasePathTargetIsStale({ nodes: [] }, [0, 0, 0], 9), true);
  });
});
