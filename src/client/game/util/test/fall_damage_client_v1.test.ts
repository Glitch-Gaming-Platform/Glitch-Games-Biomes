// Frontend tests for the client per-tick fall-damage decision used by the player
// simulation loop: tracks the fall and yields the HP delta on landing.

import {
  clientFallDamageTickV1,
  clientFallDamageTickWithGraceV1,
} from "@/client/game/util/fall_damage_client_v1";
import { initFallTrackerV1 } from "@/shared/game/fall_damage_v1";
import assert from "assert";

function simulate(
  ticks: Array<{ onGround: boolean; y: number; canTakeFallDamage?: boolean }>,
  startY = 70
) {
  let state = initFallTrackerV1(startY);
  const applied: Array<{ fellBlocks: number; hpDelta: number }> = [];
  for (const t of ticks) {
    const r = clientFallDamageTickV1(state, {
      onGround: t.onGround,
      y: t.y,
      canTakeFallDamage: t.canTakeFallDamage ?? true,
    });
    state = r.state;
    if (r.hpDelta !== 0) {
      applied.push({ fellBlocks: r.fellBlocks, hpDelta: r.hpDelta });
    }
  }
  return applied;
}

describe("client fall-damage tick", () => {
  it("emits a negative hpDelta on landing from a 5+ block fall", () => {
    const applied = simulate([
      { onGround: true, y: 70 },
      { onGround: false, y: 66 },
      { onGround: false, y: 62 },
      { onGround: true, y: 60 }, // fell 10
    ]);
    assert.strictEqual(applied.length, 1);
    assert.strictEqual(applied[0].fellBlocks, 10);
    assert.strictEqual(applied[0].hpDelta, -20);
  });

  it("emits exactly 10 damage at the 5-foot threshold", () => {
    const applied = simulate([
      { onGround: true, y: 70 },
      { onGround: false, y: 67 },
      { onGround: true, y: 65 }, // fell 5
    ]);
    assert.deepStrictEqual(applied, [{ fellBlocks: 5, hpDelta: -10 }]);
  });

  it("emits no damage for an ordinary jump", () => {
    const applied = simulate([
      { onGround: true, y: 70 },
      { onGround: false, y: 71.25 },
      { onGround: false, y: 70.5 },
      { onGround: true, y: 70 },
    ]);
    assert.deepStrictEqual(applied, []);
  });

  it("emits no damage for a sub-threshold drop (4 blocks)", () => {
    const applied = simulate([
      { onGround: true, y: 70 },
      { onGround: false, y: 67 },
      { onGround: true, y: 66 }, // fell 4
    ]);
    assert.deepStrictEqual(applied, []);
  });

  it("does not apply damage when in water/climbing/flying", () => {
    const applied = simulate([
      { onGround: true, y: 70 },
      { onGround: false, y: 55 },
      { onGround: true, y: 40, canTakeFallDamage: false }, // landed but immune
    ]);
    assert.deepStrictEqual(applied, []);
  });

  it("scales damage with distance (25-block fall -> 50 damage)", () => {
    const applied = simulate([
      { onGround: true, y: 100 },
      { onGround: false, y: 88 },
      { onGround: false, y: 80 },
      { onGround: true, y: 75 }, // fell 25
    ]);
    assert.deepStrictEqual(applied, [{ fellBlocks: 25, hpDelta: -50 }]);
  });

  it("applies damage to each separate fall", () => {
    const applied = simulate([
      { onGround: true, y: 70 },
      { onGround: false, y: 60 },
      { onGround: true, y: 58 }, // fell 12 -> 20
      { onGround: false, y: 50 },
      { onGround: true, y: 43 }, // fell 15 -> 30
    ]);
    assert.deepStrictEqual(applied, [
      { fellBlocks: 12, hpDelta: -20 },
      { fellBlocks: 15, hpDelta: -30 },
    ]);
  });

  it("suppresses a protected landing without erasing the next real fall", () => {
    let state = initFallTrackerV1(100);

    let tick = clientFallDamageTickWithGraceV1(state, {
      onGround: false,
      y: 90,
      canTakeFallDamage: true,
      canApplyFallDamage: false,
    });
    state = tick.state;
    assert.equal(tick.hpDelta, 0);
    assert.equal(tick.rawHpDelta, 0);

    tick = clientFallDamageTickWithGraceV1(state, {
      onGround: true,
      y: 80,
      canTakeFallDamage: true,
      canApplyFallDamage: false,
    });
    state = tick.state;
    assert.equal(tick.fellBlocks, 20);
    assert.equal(tick.hpDelta, 0);
    assert.equal(tick.rawHpDelta, -40);

    tick = clientFallDamageTickWithGraceV1(state, {
      onGround: false,
      y: 70,
      canTakeFallDamage: true,
      canApplyFallDamage: true,
    });
    state = tick.state;
    assert.equal(tick.hpDelta, 0);

    tick = clientFallDamageTickWithGraceV1(state, {
      onGround: true,
      y: 60,
      canTakeFallDamage: true,
      canApplyFallDamage: true,
    });
    assert.equal(tick.fellBlocks, 20);
    assert.equal(tick.hpDelta, -40);
  });

  it("treats a ground-impact landing as grounded even before cached environment catches up", () => {
    let state = initFallTrackerV1(90);
    let tick = clientFallDamageTickWithGraceV1(state, {
      onGround: false,
      y: 80,
      canTakeFallDamage: true,
      canApplyFallDamage: true,
    });
    state = tick.state;

    tick = clientFallDamageTickWithGraceV1(state, {
      onGround: true,
      y: 70,
      canTakeFallDamage: true,
      canApplyFallDamage: true,
    });
    assert.equal(tick.fellBlocks, 20);
    assert.equal(tick.hpDelta, -40);
  });

  it("uses hard landing impact as a fallback when cached ground state missed the fall", () => {
    const tick = clientFallDamageTickWithGraceV1(initFallTrackerV1(90), {
      onGround: true,
      y: 70,
      canTakeFallDamage: true,
      canApplyFallDamage: true,
      landingImpactFallbackBlocks: 20,
    });
    assert.equal(tick.fellBlocks, 20);
    assert.equal(tick.hpDelta, -40);
    assert.equal(tick.rawHpDelta, -40);
  });

  it("does not let the impact fallback bypass fall-damage immunity", () => {
    const tick = clientFallDamageTickWithGraceV1(initFallTrackerV1(90), {
      onGround: true,
      y: 70,
      canTakeFallDamage: false,
      canApplyFallDamage: true,
      landingImpactFallbackBlocks: 20,
    });
    assert.equal(tick.fellBlocks, 0);
    assert.equal(tick.hpDelta, 0);
  });
});
