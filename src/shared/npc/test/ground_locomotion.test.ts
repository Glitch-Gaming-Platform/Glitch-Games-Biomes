import {
  NPC_GROUND_LOCOMOTION_CORE_MAX_METERS,
  npcGroundLocomotionAabb,
  npcGroundTraversalProfile,
} from "@/shared/npc/ground_locomotion";
import { sizeAABB } from "@/shared/math/linear";
import assert from "assert";

describe("NPC oversized ground locomotion profile", () => {
  it("preserves the authored collision body for ordinary creatures", () => {
    const profile = npcGroundTraversalProfile([1.3, 1.5, 2]);
    assert.equal(profile.oversized, false);
    assert.deepEqual(profile.collisionSize, [1.3, 1.5, 2]);
    assert.equal(profile.maxStepHeight, 1);
  });

  it("keeps a giant full-height but gives it a compact central walking core", () => {
    const profile = npcGroundTraversalProfile([6.8, 4.8, 8.4]);
    assert.equal(profile.oversized, true);
    assert.equal(profile.collisionSize[1], 4.8);
    assert.ok(
      profile.collisionSize[0] <= NPC_GROUND_LOCOMOTION_CORE_MAX_METERS
    );
    assert.ok(
      profile.collisionSize[2] <= NPC_GROUND_LOCOMOTION_CORE_MAX_METERS
    );
    assert.equal(profile.maxStepHeight, 2);
    const aabbSize = sizeAABB(
      npcGroundLocomotionAabb([10, 20, 30], [6.8, 4.8, 8.4])
    );
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(aabbSize[axis] - profile.collisionSize[axis]) < 1e-9);
    }
  });

  it("sanitizes malformed legacy sizes without making an unbounded body", () => {
    const profile = npcGroundTraversalProfile([NaN, Infinity, -1]);
    assert.ok(profile.collisionSize.every(Number.isFinite));
    assert.ok(profile.collisionSize.every((dimension) => dimension > 0));
    assert.equal(profile.maxStepHeight, 1);
  });
});
