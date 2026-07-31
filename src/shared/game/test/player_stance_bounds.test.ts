import {
  PLAYER_CROUCH_COLLISION_BOX_SIZE,
  PLAYER_VISUAL_BOX_SIZE,
  canStartStandingMovementAction,
  playerAABB,
  playerCollisionAABB,
  playerStandingHeadroomAABB,
  playerVisualAABB,
  resolveEffectiveCrouching,
  resolvePlayerEffectiveCrouching,
  updateCrouchCollisionTransition,
} from "@/shared/game/players";
import { intersectsAABB, sizeAABB } from "@/shared/math/linear";
import type { AABB } from "@/shared/math/types";
import { moveBodySimple } from "@/shared/physics/movement";
import type { CollisionIndex } from "@/shared/physics/types";
import assert from "assert";

function collisionIndexFor(boxes: AABB[]): CollisionIndex {
  return (query, fn) => {
    for (const box of boxes) {
      if (intersectsAABB(query, box) && fn(box)) {
        return;
      }
    }
  };
}

function assertVecApprox(
  actual: readonly number[],
  expected: readonly number[]
) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) < 1e-9,
      `expected ${actual[i]} to approximately equal ${expected[i]}`
    );
  }
}

describe("player stance bounds", () => {
  it("keeps the visual box standing-sized while crouch changes only collision height", () => {
    const position: [number, number, number] = [4, 7, -3];
    const visual = playerVisualAABB(position);
    const standing = playerCollisionAABB(position, false);
    const crouched = playerCollisionAABB(position, true);

    assertVecApprox(sizeAABB(visual), PLAYER_VISUAL_BOX_SIZE);
    assert.deepEqual(standing, visual);
    assert.deepEqual(playerAABB(position), visual);
    assertVecApprox(sizeAABB(crouched), PLAYER_CROUCH_COLLISION_BOX_SIZE);
    assert.equal(crouched[0][1], visual[0][1]);
    assert.equal(crouched[0][0], visual[0][0]);
    assert.equal(crouched[1][0], visual[1][0]);
    assert.equal(crouched[0][2], visual[0][2]);
    assert.equal(crouched[1][2], visual[1][2]);
  });

  it("scales visual, crouched, and headroom bounds from the same foot anchor", () => {
    const position: [number, number, number] = [1, 2, 3];
    const visual = playerVisualAABB(position, 2);
    const crouched = playerCollisionAABB(position, true, 2);
    const headroom = playerStandingHeadroomAABB(position, 2);

    assertVecApprox(sizeAABB(visual), [1.5, 3.6, 1.5]);
    assertVecApprox(sizeAABB(crouched), [1.5, 2.6, 1.5]);
    assert.equal(visual[0][1], position[1]);
    assert.equal(crouched[0][1], position[1]);
    assert.ok(headroom[0][1] > crouched[1][1]);
    assert.ok(headroom[1][1] < visual[1][1]);
  });

  it("queries only the added headroom when deciding whether standing fits", () => {
    const position: [number, number, number] = [0, 0, 0];
    const crouched = playerCollisionAABB(position, true);
    const headroom = playerStandingHeadroomAABB(position);
    const lowCeiling: AABB = [
      [-2, 1.35, -2],
      [2, 2.5, 2],
    ];
    const floor: AABB = [
      [-2, -1, -2],
      [2, 0, 2],
    ];

    assert.equal(intersectsAABB(crouched, lowCeiling), false);
    assert.equal(intersectsAABB(headroom, lowCeiling), true);
    assert.equal(intersectsAABB(headroom, floor), false);
  });

  it("keeps crouching effective until standing headroom becomes clear", () => {
    assert.equal(
      resolveEffectiveCrouching({
        requestedCrouching: true,
        wasCrouching: false,
        standingHeadroomClear: true,
      }),
      true
    );
    assert.equal(
      resolveEffectiveCrouching({
        requestedCrouching: false,
        wasCrouching: true,
        standingHeadroomClear: false,
      }),
      true
    );
    assert.equal(
      resolveEffectiveCrouching({
        requestedCrouching: false,
        wasCrouching: true,
        standingHeadroomClear: true,
      }),
      false
    );
    assert.equal(
      resolveEffectiveCrouching({
        requestedCrouching: false,
        wasCrouching: false,
        standingHeadroomClear: false,
      }),
      false
    );
  });

  it("blocks standing-sized dodge and roll actions only while crouched under an obstruction", () => {
    assert.equal(
      canStartStandingMovementAction({
        crouching: true,
        standingHeadroomClear: false,
      }),
      false
    );
    assert.equal(
      canStartStandingMovementAction({
        crouching: true,
        standingHeadroomClear: true,
      }),
      true
    );
    assert.equal(
      canStartStandingMovementAction({
        crouching: false,
        standingHeadroomClear: false,
      }),
      true
    );
  });

  it("waits for the visual blend before enabling the shorter collision hull", () => {
    const entering = updateCrouchCollisionTransition({
      effectiveCrouching: true,
      wasEffectiveCrouching: false,
      nowSeconds: 10,
    });
    assert.equal(entering.collisionCrouching, false);
    assert.ok(entering.readyAtSeconds && entering.readyAtSeconds > 10);

    const blending = updateCrouchCollisionTransition({
      effectiveCrouching: true,
      wasEffectiveCrouching: true,
      nowSeconds: 10.1,
      readyAtSeconds: entering.readyAtSeconds,
    });
    assert.equal(blending.collisionCrouching, false);

    const ready = updateCrouchCollisionTransition({
      effectiveCrouching: true,
      wasEffectiveCrouching: true,
      nowSeconds: entering.readyAtSeconds!,
      readyAtSeconds: entering.readyAtSeconds,
    });
    assert.equal(ready.collisionCrouching, true);

    assert.deepEqual(
      updateCrouchCollisionTransition({
        effectiveCrouching: false,
        wasEffectiveCrouching: true,
        nowSeconds: 11,
        readyAtSeconds: entering.readyAtSeconds,
      }),
      { collisionCrouching: false }
    );
  });

  it("keeps crouch input as descend—not a short hull—while swimming or flying", () => {
    const base = {
      requestedCrouching: true,
      wasCrouching: false,
      standingHeadroomClear: true,
      movementActionActive: false,
      flying: false,
      swimming: false,
    };
    assert.equal(resolvePlayerEffectiveCrouching(base), true);
    assert.equal(
      resolvePlayerEffectiveCrouching({ ...base, flying: true }),
      false
    );
    assert.equal(
      resolvePlayerEffectiveCrouching({ ...base, swimming: true }),
      false
    );
    assert.equal(
      resolvePlayerEffectiveCrouching({
        ...base,
        movementActionActive: true,
      }),
      false
    );
  });

  it("lets the crouched collision body traverse a ceiling that blocks the standing body", () => {
    const ceiling: AABB = [
      [0.8, 1.35, -1],
      [3, 2.5, 1],
    ];
    const collisionIndex = collisionIndexFor([ceiling]);
    const environment = {
      gravity: 0,
      friction: 0,
      airResistance: 0,
      escapeDampening: 0,
    };
    const standing = moveBodySimple(
      1,
      {
        aabb: playerCollisionAABB([0, 0, 0], false),
        velocity: [2, 0, 0],
      },
      environment,
      collisionIndex,
      [],
      []
    );
    const crouched = moveBodySimple(
      1,
      {
        aabb: playerCollisionAABB([0, 0, 0], true),
        velocity: [2, 0, 0],
      },
      environment,
      collisionIndex,
      [],
      []
    );

    assert.ok(standing.movement.impulse[0] < 1);
    assert.equal(crouched.movement.impulse[0], 2);
  });
});
