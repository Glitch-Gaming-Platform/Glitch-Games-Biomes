/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1,
  publishHarthmereLiveEntityCombatMotionToRendererV1,
} from "../harthmere_live_entity_motion_bridge_v1";

describe("Harthmere live entity render motion bridge v1", () => {
  const originalWindow = (globalThis as any).window;

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("publishes backend AI movement, animation, and facing into the voxel NPC renderer motion channel", () => {
    (globalThis as any).window = {};
    const result = publishHarthmereLiveEntityCombatMotionToRendererV1(
      {
        npcAiTicks: {
          "b:1001": {
            atMs: 1_700_000_000_000,
            nextThinkAtMs: 1_700_000_002_000,
            decision: "retaliate_to_recent_attacker",
            movementMode: "combat_chase",
            positionFrom: { x: 1, y: 60, z: 2 },
            positionTo: { x: 3, y: 60, z: 2 },
            velocity: { x: 1, y: 0, z: 0 },
            facingYaw: 1.57,
            animationState: "run",
            animationMoving: true,
            navigationResolution: "direct",
            navigationBlocked: false,
          },
        },
      },
      1_700_000_000_100
    );

    assert.deepEqual(result, { published: 1, skipped: 0 });
    const motion = (globalThis as any).window.__harthmereVoxelNpcMotionV193[
      "b:1001"
    ];
    assert.equal(motion.version, HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE_V1);
    assert.equal(motion.mode, "chase");
    assert.equal(motion.animationState, "run");
    assert.equal(motion.animationMoving, true);
    assert.equal(motion.facingYaw, 1.57);
    assert.deepEqual(motion.from, [1, 2]);
    assert.deepEqual(motion.targetPos, [3, 2]);
    assert.ok(motion.speed > 0);
  });

  it("publishes non-NPC animal, muck, and hex b:<id> motion records with their animation states", () => {
    (globalThis as any).window = {};
    const result = publishHarthmereLiveEntityCombatMotionToRendererV1(
      {
        npcAiTicks: {
          "b:non_npc_wolf_1": {
            atMs: 1_700_000_000_000,
            nextThinkAtMs: 1_700_000_001_000,
            decision: "retaliate_to_recent_attacker",
            movementMode: "combat_chase",
            positionFrom: { x: 10, y: 60, z: 20 },
            positionTo: { x: 11, y: 60, z: 20 },
            velocity: { x: 1, y: 0, z: 0 },
            facingYaw: 1,
            animationState: "run",
            animationMoving: true,
          },
          "b:non_npc_muckling_1": {
            atMs: 1_700_000_000_000,
            nextThinkAtMs: 1_700_000_001_000,
            decision: "retaliate_to_recent_attacker",
            movementMode: "combat_chase",
            positionFrom: { x: 12, y: 60, z: 20 },
            positionTo: { x: 13, y: 60, z: 20 },
            velocity: { x: 1, y: 0, z: 0 },
            facingYaw: 1,
            animationState: "run",
            animationMoving: true,
          },
          "b:non_npc_hexer_1": {
            atMs: 1_700_000_000_000,
            nextThinkAtMs: 1_700_000_001_000,
            decision: "retaliate_to_recent_attacker",
            movementMode: "combat_chase",
            positionFrom: { x: 14, y: 60, z: 20 },
            positionTo: { x: 15, y: 60, z: 20 },
            velocity: { x: 1, y: 0, z: 0 },
            facingYaw: 1,
            animationState: "run",
            animationMoving: true,
          },
        },
      },
      1_700_000_000_050
    );

    assert.deepEqual(result, { published: 3, skipped: 0 });
    const motion = (globalThis as any).window.__harthmereVoxelNpcMotionV193;
    for (const entityId of [
      "b:non_npc_wolf_1",
      "b:non_npc_muckling_1",
      "b:non_npc_hexer_1",
    ]) {
      assert.equal(motion[entityId].mode, "chase");
      assert.equal(motion[entityId].animationState, "run");
      assert.equal(motion[entityId].animationMoving, true);
    }
  });

  it("skips malformed ticks instead of publishing broken renderer records", () => {
    (globalThis as any).window = {};
    const result = publishHarthmereLiveEntityCombatMotionToRendererV1({
      npcAiTicks: {
        malformed: {
          decision: "idle_patrol",
          positionFrom: { x: 1, y: 2 },
        },
      },
    });
    assert.deepEqual(result, { published: 0, skipped: 1 });
    assert.equal(
      (globalThis as any).window.__harthmereVoxelNpcMotionV193,
      undefined
    );
  });
});
