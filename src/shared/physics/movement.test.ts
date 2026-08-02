import { DEFAULT_ENVIRONMENT_PARAMS } from "@/shared/physics/environments";
import { horizontalForceForTargetSpeed } from "@/shared/physics/forces";
import { moveBodyWithClimbing } from "@/shared/physics/movement";
import type { CollisionIndex } from "@/shared/physics/types";
import { toClimbableIndex } from "@/shared/physics/utils";
import { shiftAABB } from "@/shared/math/linear";
import type { AABB, Vec3 } from "@/shared/math/types";
import assert from "assert";

function intersects(a: AABB, b: AABB) {
  return [0, 1, 2].every(
    (axis) => a[0][axis] < b[1][axis] && a[1][axis] > b[0][axis]
  );
}

function collisionIndexFor(boxes: AABB[]): CollisionIndex {
  return (query, fn) => {
    for (const box of boxes) {
      if (intersects(query, box) && fn(box)) {
        return;
      }
    }
  };
}

describe("NPC target-speed ground movement", () => {
  it("crosses two uneven hill steps at a meaningful chase pace", () => {
    const collisionIndex = collisionIndexFor([
      [
        [-100, -10, -100],
        [100, 0, 100],
      ],
      [
        [1.5, 0, -2],
        [2.5, 0.5, 2],
      ],
      [
        [2.5, 0, -2],
        [3.5, 1, 2],
      ],
    ]);
    const climbableIndex = toClimbableIndex(collisionIndex);
    const targetSpeed = 5.94;
    const force = horizontalForceForTargetSpeed(
      targetSpeed,
      DEFAULT_ENVIRONMENT_PARAMS
    );
    let aabb: AABB = [
      [0, 0, -0.4],
      [0.8, 1.8, 0.4],
    ];
    let velocity: Vec3 = [0, 0, 0];
    let maxHeight = 0;
    const dt = 0.05;
    const steps = 80;

    for (let i = 0; i < steps; i++) {
      const result = moveBodyWithClimbing(
        dt,
        { aabb, velocity },
        DEFAULT_ENVIRONMENT_PARAMS,
        collisionIndex,
        climbableIndex,
        [() => [dt * force, 0, 0]],
        []
      );
      aabb = shiftAABB(aabb, result.movement.impulse);
      velocity = [...result.movement.velocity];
      maxHeight = Math.max(maxHeight, aabb[0][1]);
    }

    assert.ok(maxHeight >= 0.9, `expected hill climb, max Y was ${maxHeight}`);
    assert.ok(aabb[0][0] >= 12, `expected fast traversal, X was ${aabb[0][0]}`);
    assert.ok(
      Math.hypot(velocity[0], velocity[2]) >= targetSpeed * 0.75,
      `expected chase velocity near ${targetSpeed}, got ${velocity[0]}`
    );
  });
});
