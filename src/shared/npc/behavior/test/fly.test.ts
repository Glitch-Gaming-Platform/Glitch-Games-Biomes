import { getOscillatingForce } from "@/shared/npc/behavior/fly";
import assert from "assert";

describe("flying NPC oscillation", () => {
  it("treats a legacy zero period and strength as disabled", () => {
    assert.deepEqual(
      getOscillatingForce({
        offset: 8085875300731421,
        periodSeconds: 0,
        strength: 0,
        nowMs: 1_785_637_188_793,
      }),
      [0, 0, 0]
    );
  });

  it("never emits non-finite motion for unusable oscillator inputs", () => {
    for (const input of [
      { offset: 1, periodSeconds: -1, strength: 2, nowMs: 1000 },
      { offset: 1, periodSeconds: Infinity, strength: 2, nowMs: 1000 },
      { offset: 1, periodSeconds: 2, strength: NaN, nowMs: 1000 },
      { offset: NaN, periodSeconds: 2, strength: 1, nowMs: 1000 },
      { offset: 1, periodSeconds: 2, strength: 1, nowMs: Infinity },
    ]) {
      assert.deepEqual(getOscillatingForce(input), [0, 0, 0]);
    }
  });

  it("preserves finite authored oscillation", () => {
    const force = getOscillatingForce({
      offset: 0,
      periodSeconds: 2,
      strength: 3,
      nowMs: 1000,
    });
    assert.ok(force.every(Number.isFinite));
    assert.ok(Math.abs(force[1] - 3) < 1e-9);
  });
});
