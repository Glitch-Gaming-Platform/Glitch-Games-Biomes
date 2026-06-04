// Backend/shared tests for the canonical fall-damage rule and distance tracker.

import {
  applyFallDamageToHpV1,
  fallDamageForBlocksV1,
  fallDamageForFeetV1,
  initFallTrackerV1,
  updateFallTrackerV1,
  type FallTrackerStateV1,
} from "@/shared/game/fall_damage_v1";
import assert from "assert";

describe("fall damage rule", () => {
  it("matches the spec: 5ft->10, 10ft->20, 15ft->30, ...", () => {
    assert.strictEqual(fallDamageForFeetV1(5), 10);
    assert.strictEqual(fallDamageForFeetV1(10), 20);
    assert.strictEqual(fallDamageForFeetV1(15), 30);
    assert.strictEqual(fallDamageForFeetV1(20), 40);
    assert.strictEqual(fallDamageForFeetV1(100), 200);
  });

  it("no damage below 5 feet", () => {
    assert.strictEqual(fallDamageForFeetV1(0), 0);
    assert.strictEqual(fallDamageForFeetV1(1), 0);
    assert.strictEqual(fallDamageForFeetV1(4.99), 0);
    assert.strictEqual(fallDamageForFeetV1(5 - 1e-9), 0);
  });

  it("steps up per 5-foot increment (stays flat between increments)", () => {
    assert.strictEqual(fallDamageForFeetV1(5), 10);
    assert.strictEqual(fallDamageForFeetV1(7), 10);
    assert.strictEqual(fallDamageForFeetV1(9.9), 10);
    assert.strictEqual(fallDamageForFeetV1(10), 20);
    assert.strictEqual(fallDamageForFeetV1(14.9), 20);
    assert.strictEqual(fallDamageForFeetV1(15), 30);
  });

  it("handles negative / non-finite inputs as zero", () => {
    assert.strictEqual(fallDamageForFeetV1(-10), 0);
    assert.strictEqual(fallDamageForFeetV1(NaN), 0);
    assert.strictEqual(fallDamageForFeetV1(Infinity), 0);
    assert.strictEqual(fallDamageForBlocksV1(-3), 0);
    assert.strictEqual(fallDamageForBlocksV1(NaN), 0);
    assert.strictEqual(fallDamageForBlocksV1(0), 0);
  });

  it("blocks convert 1:1 to feet by default", () => {
    assert.strictEqual(fallDamageForBlocksV1(5), 10);
    assert.strictEqual(fallDamageForBlocksV1(12), 20);
    assert.strictEqual(fallDamageForBlocksV1(4), 0);
  });

  it("applies damage to HP, clamped at zero", () => {
    assert.strictEqual(applyFallDamageToHpV1(100, 5), 90);
    assert.strictEqual(applyFallDamageToHpV1(100, 10), 80);
    assert.strictEqual(applyFallDamageToHpV1(25, 15), 0, "lethal fall floors at 0");
    assert.strictEqual(applyFallDamageToHpV1(100, 4), 100, "sub-threshold no-op");
  });
});

describe("fall distance tracker", () => {
  function run(
    events: Array<{ onGround: boolean; y: number; canTakeFallDamage?: boolean }>,
    startY = 70
  ) {
    let state = initFallTrackerV1(startY);
    const falls: number[] = [];
    for (const e of events) {
      const r = updateFallTrackerV1(state, {
        onGround: e.onGround,
        y: e.y,
        canTakeFallDamage: e.canTakeFallDamage ?? true,
      });
      state = r.state;
      if (r.fellBlocks > 0) falls.push(r.fellBlocks);
    }
    return falls;
  }

  it("reports the drop from apex to landing on a simple fall", () => {
    // Standing at 70, step off, fall to 60, land.
    const falls = run([
      { onGround: true, y: 70 },
      { onGround: false, y: 69 },
      { onGround: false, y: 65 },
      { onGround: false, y: 61 },
      { onGround: true, y: 60 },
    ]);
    assert.deepStrictEqual(falls, [10]);
  });

  it("a normal jump (up then back to ground) deals no qualifying fall", () => {
    const falls = run([
      { onGround: true, y: 70 },
      { onGround: false, y: 71.2 }, // jump apex ~1.2 above
      { onGround: false, y: 70.5 },
      { onGround: true, y: 70 },
    ]);
    // fell = apex(71.2) - landing(70) ~= 1.2 blocks -> below threshold.
    assert.strictEqual(falls.length, 1);
    assert.ok(Math.abs(falls[0] - 1.2) < 1e-6, `fell ~1.2, got ${falls[0]}`);
    assert.strictEqual(fallDamageForBlocksV1(falls[0]), 0, "no damage from a jump");
  });

  it("measures from the jump apex when jumping off a ledge (jump adds to fall)", () => {
    const falls = run([
      { onGround: true, y: 70 },
      { onGround: false, y: 71 }, // jumped up 1
      { onGround: false, y: 65 },
      { onGround: true, y: 60 },
    ]);
    assert.deepStrictEqual(falls, [11]); // 71 - 60
  });

  it("resets while unable to take fall damage (water/climb/flying)", () => {
    const falls = run([
      { onGround: true, y: 70 },
      { onGround: false, y: 65 },
      { onGround: false, y: 50, canTakeFallDamage: false }, // entered water mid-fall
      { onGround: false, y: 45 },
      { onGround: true, y: 44 },
    ]);
    // After the water reset, apex re-anchors at 50; fall = 50 - 44 = 6.
    assert.deepStrictEqual(falls, [6]);
  });

  it("no fall reported for walking down gentle ground (stays on ground)", () => {
    const falls = run([
      { onGround: true, y: 70 },
      { onGround: true, y: 69 },
      { onGround: true, y: 68 },
      { onGround: true, y: 67 },
    ]);
    assert.deepStrictEqual(falls, []);
  });

  it("handles consecutive falls independently", () => {
    const falls = run([
      { onGround: true, y: 70 },
      { onGround: false, y: 60 },
      { onGround: true, y: 55 }, // fell 15
      { onGround: false, y: 50 },
      { onGround: true, y: 45 }, // fell 10
    ]);
    assert.deepStrictEqual(falls, [15, 10]);
  });

  it("end-to-end: a 17-block fall yields 30 damage (floor(17/5)*10)", () => {
    const falls = run([
      { onGround: true, y: 100 },
      { onGround: false, y: 90 },
      { onGround: false, y: 86 },
      { onGround: true, y: 83 },
    ]);
    assert.deepStrictEqual(falls, [17]);
    assert.strictEqual(fallDamageForBlocksV1(falls[0]), 30);
  });
});
