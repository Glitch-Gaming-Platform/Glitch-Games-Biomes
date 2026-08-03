import {
  finiteNpcOrientation,
  hasFiniteNpcMotionDirection,
  isFiniteNpcOrientation,
} from "@/shared/npc/motion_safety";
import assert from "assert";

describe("NPC motion safety", () => {
  it("repairs each non-finite orientation channel from a finite fallback", () => {
    assert.deepEqual(
      finiteNpcOrientation([NaN, Infinity], [0.25, -0.5]),
      [0.25, -0.5]
    );
    assert.deepEqual(
      finiteNpcOrientation([0.75, NaN], [0.25, -0.5]),
      [0.75, -0.5]
    );
    assert.equal(isFiniteNpcOrientation([0.75, -0.5]), true);
    assert.equal(isFiniteNpcOrientation([0.75, NaN]), false);
  });

  it("does not derive facing from zero or malformed velocity", () => {
    assert.equal(hasFiniteNpcMotionDirection([0, 0, 0]), false);
    assert.equal(hasFiniteNpcMotionDirection([NaN, 0, 1]), false);
    assert.equal(hasFiniteNpcMotionDirection([0.1, 0, 0]), true);
  });
});
