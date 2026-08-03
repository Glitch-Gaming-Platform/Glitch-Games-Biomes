import { DEFAULT_ENVIRONMENT_PARAMS } from "@/shared/physics/environments";
import { horizontalForceForTargetSpeed } from "@/shared/physics/forces";
import { moveBodyWithClimbing } from "@/shared/physics/movement";
import type { CollisionIndex } from "@/shared/physics/types";
import { toClimbableIndex } from "@/shared/physics/utils";
import { shiftAABB } from "@/shared/math/linear";
import type { AABB, Vec3 } from "@/shared/math/types";
import {
  npcGroundLocomotionAabb,
  npcGroundTraversalProfile,
} from "@/shared/npc/ground_locomotion";
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

  it("moves a Helix-sized body over a two-block hill but not through a cliff", () => {
    const collisionIndex = collisionIndexFor([
      [
        [-100, -10, -100],
        [100, 0, 100],
      ],
      [
        [2, 0, -3],
        [3, 1, 3],
      ],
      [
        [3, 0, -3],
        [5, 2, 3],
      ],
      [
        [8, 0, -3],
        [9, 5, 3],
      ],
    ]);
    const authoredSize: Vec3 = [6.8, 4.8, 8.4];
    const profile = npcGroundTraversalProfile(authoredSize);
    const climbableIndex = toClimbableIndex(
      collisionIndex,
      profile.maxStepHeight
    );
    const targetSpeed = 4.6;
    const force = horizontalForceForTargetSpeed(
      targetSpeed,
      DEFAULT_ENVIRONMENT_PARAMS
    );
    let position: Vec3 = [0, 0, 0];
    let velocity: Vec3 = [0, 0, 0];
    let maxHeight = 0;
    const dt = 0.05;

    for (let i = 0; i < 220; i++) {
      const aabb = npcGroundLocomotionAabb(position, authoredSize);
      const result = moveBodyWithClimbing(
        dt,
        { aabb, velocity },
        DEFAULT_ENVIRONMENT_PARAMS,
        collisionIndex,
        climbableIndex,
        [() => [dt * force, 0, 0]],
        []
      );
      position = [
        position[0] + result.movement.impulse[0],
        position[1] + result.movement.impulse[1],
        position[2] + result.movement.impulse[2],
      ];
      velocity = [...result.movement.velocity];
      maxHeight = Math.max(maxHeight, position[1]);
    }

    assert.ok(
      maxHeight >= 1.9,
      `expected two-block hill climb, Y=${maxHeight}`
    );
    assert.ok(position[0] >= 5, `expected to clear hill, X=${position[0]}`);
    assert.ok(
      position[0] < 8,
      `must remain blocked by five-block cliff, X=${position[0]}`
    );
  });
});
