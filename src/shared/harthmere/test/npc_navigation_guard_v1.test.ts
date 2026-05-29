import assert from "assert";

import {
  createHarthmereNpcNavigationStateV1,
  resolveHarthmereNpcNavigationStepV1,
  type HarthmereNpcNavigationObstacleV1,
} from "@/shared/harthmere/npc_navigation_guard_v1";
import type { Vec3 } from "@/shared/math/types";

const flatGround = (feetY: number) => (_x: number, _z: number, _preferredY: number) => feetY;

describe("Harthmere NPC navigation guard v1", () => {
  it("grounds floating route NPCs back to the terrain feet level", () => {
    const state = createHarthmereNpcNavigationStateV1();
    const result = resolveHarthmereNpcNavigationStepV1({
      mode: "route_patrol",
      currentPosition: [486, 70, -209],
      desiredPosition: [487, 70, -209],
      state,
      groundYAt: flatGround(53),
    });

    assert.strictEqual(result.position[1], 53);
    assert.strictEqual(result.groundCorrection, "floating");
    assert.strictEqual(result.blocked, false);
    assert.strictEqual(result.resolution, "direct");
    assert.deepStrictEqual(state.lastSafePosition, [487, 53, -209]);
  });

  it("raises buried NPCs to the terrain feet level", () => {
    const state = createHarthmereNpcNavigationStateV1();
    const result = resolveHarthmereNpcNavigationStepV1({
      mode: "town_wander",
      currentPosition: [496, 50, -126],
      desiredPosition: [496.5, 50, -126],
      state,
      groundYAt: flatGround(53),
    });

    assert.strictEqual(result.position[1], 53);
    assert.strictEqual(result.groundCorrection, "buried");
  });

  it("slides around a blocker instead of walking through the object in front", () => {
    const state = createHarthmereNpcNavigationStateV1();
    const obstacle: HarthmereNpcNavigationObstacleV1 = {
      id: "crate",
      label: "Town crate",
      cx: 1,
      cz: 0,
      halfX: 0.3,
      halfZ: 0.3,
      padding: 0.25,
    };
    const result = resolveHarthmereNpcNavigationStepV1({
      mode: "town_wander",
      currentPosition: [0, 53, 0],
      desiredPosition: [2, 53, 1],
      state,
      obstacles: [obstacle],
      groundYAt: flatGround(53),
      bodyRadius: 0.25,
    });

    assert.strictEqual(result.blocked, true);
    assert.ok(result.resolution === "slide" || result.resolution === "sidestep");
    assert.notDeepStrictEqual(result.position, [2, 53, 1]);
    assert.ok(Math.hypot(result.position[0], result.position[2]) > 0.04);
    assert.strictEqual(result.obstacleLabel, "Town crate");
  });

  it("holds last safe position and marks stuck after repeated fully blocked moves", () => {
    const state = createHarthmereNpcNavigationStateV1();
    const obstacles: HarthmereNpcNavigationObstacleV1[] = [
      { id: "front", cx: 1, cz: 0, halfX: 2, halfZ: 2, padding: 0.6 },
      { id: "side", cx: 0, cz: 1, halfX: 2, halfZ: 2, padding: 0.6 },
    ];
    let result = resolveHarthmereNpcNavigationStepV1({
      mode: "combat_chase",
      currentPosition: [0, 53, 0],
      desiredPosition: [2, 53, 0],
      state,
      obstacles,
      groundYAt: flatGround(53),
    });
    for (let i = 0; i < 12; i += 1) {
      result = resolveHarthmereNpcNavigationStepV1({
        mode: "combat_chase",
        currentPosition: result.position,
        desiredPosition: [2, 53, 0],
        state,
        obstacles,
        groundYAt: flatGround(53),
      });
    }

    assert.strictEqual(result.resolution, "hold");
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.stuck, true);
    assert.strictEqual(result.animationMoving, false);
  });

  it("rejects high terrain steps instead of climbing into the air", () => {
    const state = createHarthmereNpcNavigationStateV1();
    const groundYAt = (x: number, _z: number, _preferredY: number) => (x > 0.5 ? 58 : 53);
    const result = resolveHarthmereNpcNavigationStepV1({
      mode: "town_wander",
      currentPosition: [0, 53, 0],
      desiredPosition: [1, 53, 0],
      state,
      groundYAt,
      maxStepHeight: 1.25,
    });

    assert.strictEqual(result.resolution, "hold");
    assert.strictEqual(result.position[1], 53);
    assert.strictEqual(result.blocked, true);
  });

  it("keeps collision work bounded for dense nearby plants and props", () => {
    const state = createHarthmereNpcNavigationStateV1();
    const obstacles = Array.from({ length: 120 }, (_, i): HarthmereNpcNavigationObstacleV1 => ({
      id: `plant-${i}`,
      cx: 20 + i,
      cz: 20,
      halfX: 0.5,
      halfZ: 0.5,
      padding: 0.2,
    }));
    const result = resolveHarthmereNpcNavigationStepV1({
      mode: "route_patrol",
      currentPosition: [0, 53, 0],
      desiredPosition: [2, 53, 0],
      state,
      obstacles,
      groundYAt: flatGround(53),
    });

    assert.strictEqual(result.blocked, false);
    assert.ok(result.checkedObstacles <= 36 * result.sweepSamples);
  });

  it("uses the same guard for combat chase so attackers move forward when clear", () => {
    const state = createHarthmereNpcNavigationStateV1();
    const current: Vec3 = [10, 53, 10];
    const result = resolveHarthmereNpcNavigationStepV1({
      mode: "combat_chase",
      currentPosition: current,
      desiredPosition: [11.2, 53, 10],
      state,
      groundYAt: flatGround(53),
    });

    assert.strictEqual(result.resolution, "direct");
    assert.ok(result.position[0] > current[0]);
    assert.strictEqual(result.animationMoving, true);
  });
});
