/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE,
  publishHarthmereLiveEntityCombatMotionToRenderer,
} from "../harthmere_live_entity_motion_bridge";

describe("Harthmere live entity render motion bridge current", () => {
  const originalWindow = (globalThis as any).window;

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("publishes backend AI movement, animation, and facing into the voxel NPC renderer motion channel", () => {
    (globalThis as any).window = {};
    const result = publishHarthmereLiveEntityCombatMotionToRenderer(
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
    const motion = (globalThis as any).window.__harthmereVoxelNpcMotion[
      "b:1001"
    ];
    assert.equal(motion.version, HARTHMERE_LIVE_ENTITY_RENDER_MOTION_BRIDGE);
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
    const result = publishHarthmereLiveEntityCombatMotionToRenderer(
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
    const motion = (globalThis as any).window.__harthmereVoxelNpcMotion;
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
    const result = publishHarthmereLiveEntityCombatMotionToRenderer({
      npcAiTicks: {
        malformed: {
          decision: "idle_patrol",
          positionFrom: { x: 1, y: 2 },
        },
      },
    });
    assert.deepEqual(result, { published: 0, skipped: 1 });
    assert.equal(
      (globalThis as any).window.__harthmereVoxelNpcMotion,
      undefined
    );
  });

  it("overrides stale walking motion for defeated live entities", () => {
    (globalThis as any).window = {
      __harthmereVoxelNpcMotion: {
        "b:dead-cow": {
          animationState: "walk",
          animationMoving: true,
          targetPos: [9, 9],
        },
      },
    };
    const result = publishHarthmereLiveEntityCombatMotionToRenderer(
      {
        entitySnapshots: {
          "b:dead-cow": {
            hp: 0,
            maxHp: 270,
            isAlive: false,
            isAttackable: false,
            position: { x: 1, y: 54.1, z: 2 },
            defeatedAtMs: 1_700_000_000_000,
            facingYaw: 0.25,
          },
        },
      },
      1_700_000_000_100
    );

    assert.deepEqual(result, { published: 1, skipped: 0 });
    const motion = (globalThis as any).window.__harthmereVoxelNpcMotion[
      "b:dead-cow"
    ];
    assert.equal(motion.reason, "live_entity_dead_stop");
    assert.equal(motion.animationState, "death");
    assert.equal(motion.animationMoving, false);
    assert.deepEqual(motion.targetPos, [1, 2]);
    assert.equal(motion.speed, 0);
    assert.equal(motion.navigationBlocked, true);
  });

  it("publishes damaged live entity health for overhead combat bars", () => {
    (globalThis as any).window = {};
    const result = publishHarthmereLiveEntityCombatMotionToRenderer(
      {
        entitySnapshots: {
          "server-muck-combat:watchtower:1": {
            hp: 320,
            maxHp: 600,
            isAlive: true,
            isAttackable: true,
            position: { x: 332, y: 53, z: -390 },
            lastDamageTaken: 80,
            lastAttackedAtMs: 1_700_000_000_000,
          },
        },
      },
      1_700_000_000_100
    );

    assert.deepEqual(result, { published: 0, skipped: 0 });
    const health = (globalThis as any).window
      .__harthmereLiveEntityCombatHealth[
      "server-muck-combat:watchtower:1"
    ];
    assert.equal(health.hp, 320);
    assert.equal(health.maxHp, 600);
    assert.equal(health.isAlive, true);
    assert.equal(health.isAttackable, true);
    assert.deepEqual(health.position, { x: 332, y: 53, z: -390 });
    assert.ok(health.showUntilMs > 1_700_000_000_100);
  });

  it("publishes full-health attackable entities so visible enemies always have bars", () => {
    (globalThis as any).window = {};
    publishHarthmereLiveEntityCombatMotionToRenderer(
      {
        entitySnapshots: {
          "server-muck-combat:hex:7": {
            hp: 240,
            maxHp: 240,
            isAlive: true,
            isAttackable: true,
            position: { x: 300, y: 54, z: -320 },
          },
        },
      },
      1_700_000_000_100
    );

    const health = (globalThis as any).window
      .__harthmereLiveEntityCombatHealth["server-muck-combat:hex:7"];
    assert.equal(health.hp, 240);
    assert.equal(health.maxHp, 240);
    assert.equal(health.isAttackable, true);
    assert.ok(health.showUntilMs >= 1_700_000_030_100);
  });
});
