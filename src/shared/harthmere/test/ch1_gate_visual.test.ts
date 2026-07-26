/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  ch1GateOpenAmount,
  ch1GateSeed,
} from "@/client/game/renderers/ch1_fracture_gate_material";
import { CH1_FRACTURE_GATES } from "../ch1_fracture_gates";

// Pure timing/seed maths only. The THREE material itself needs a GL context
// and is covered by the browser suite; these are the parts that can silently
// regress and make a gate look wrong or pop.

describe("ch1 gate visual - open curve", () => {
  it("starts closed and opens over about a second", () => {
    assert.equal(ch1GateOpenAmount({ elapsedSeconds: -1 }), 0);
    assert.equal(ch1GateOpenAmount({ elapsedSeconds: 0 }), 0);
    const mid = ch1GateOpenAmount({ elapsedSeconds: 0.6 });
    assert.ok(mid > 0.3 && mid < 1, `mid-open was ${mid}`);
    assert.equal(ch1GateOpenAmount({ elapsedSeconds: 2 }), 1);
  });

  it("never exceeds one, even through the tear overshoot", () => {
    for (let t = 0; t < 4; t += 0.01) {
      const v = ch1GateOpenAmount({ elapsedSeconds: t });
      assert.ok(v >= 0 && v <= 1, `open was ${v} at t=${t}`);
    }
  });

  it("holds open for a persistent gate forever", () => {
    assert.equal(ch1GateOpenAmount({ elapsedSeconds: 10_000 }), 1);
  });

  it("closes a transient gate exactly on its window", () => {
    const closesAfterSeconds = 90;
    assert.equal(
      ch1GateOpenAmount({ elapsedSeconds: 45, closesAfterSeconds }),
      1,
      "the fence-line seam holds for its ninety seconds"
    );
    const closing = ch1GateOpenAmount({
      elapsedSeconds: 89.25,
      closesAfterSeconds,
    });
    assert.ok(closing > 0 && closing < 1, `expected mid-close, got ${closing}`);
    assert.equal(
      ch1GateOpenAmount({ elapsedSeconds: 90, closesAfterSeconds }),
      0
    );
    assert.equal(
      ch1GateOpenAmount({ elapsedSeconds: 200, closesAfterSeconds }),
      0
    );
  });

  it("is monotonic while closing so a gate never flickers back open", () => {
    let previous = Infinity;
    for (let t = 88.5; t <= 90; t += 0.02) {
      const v = ch1GateOpenAmount({ elapsedSeconds: t, closesAfterSeconds: 90 });
      assert.ok(v <= previous + 1e-9, `open went back up at t=${t}`);
      previous = v;
    }
  });
});

describe("ch1 gate visual - per-gate seed", () => {
  it("is deterministic", () => {
    assert.equal(ch1GateSeed("ch1_gate_desert"), ch1GateSeed("ch1_gate_desert"));
  });

  it("is in range and distinct per gate", () => {
    const seeds = CH1_FRACTURE_GATES.map((g) => ch1GateSeed(g.id));
    for (const seed of seeds) {
      assert.ok(seed >= 0 && seed < 1, `seed ${seed} out of range`);
    }
    assert.equal(
      new Set(seeds).size,
      seeds.length,
      "two Mouths must not breathe together"
    );
  });
});
