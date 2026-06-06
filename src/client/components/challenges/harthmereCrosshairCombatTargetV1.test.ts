/// <reference types="mocha" />
import {
  harthmereCrosshairAimFromEventV1,
  harthmereHasCrosshairCombatTargetV1,
  pickHarthmereCrosshairCombatTargetV1,
  type HarthmereCrosshairCombatActorV1,
} from "@/client/components/challenges/harthmereCrosshairCombatTargetV1";
import assert from "assert";

const VIEWPORT = { viewportWidth: 1280, viewportHeight: 720 };
const CENTER = { x: 640, y: 360, ...VIEWPORT };

function actor(
  over: Partial<HarthmereCrosshairCombatActorV1> & { offset: number }
): HarthmereCrosshairCombatActorV1 {
  return {
    attackable: true,
    radius: 1.15,
    screenX: 640,
    screenY: 360,
    screenVisible: true,
    worldX: 5,
    worldZ: 0,
    ...over,
  };
}

describe("harthmereCrosshairCombatTargetV1", () => {
  it("hits the creature under the crosshair within reach", () => {
    const pick = pickHarthmereCrosshairCombatTargetV1({
      actors: [actor({ offset: 12345 })],
      aim: CENTER,
      playerX: 0,
      playerZ: 0,
      worldReach: 8.78,
    });
    assert.ok(pick, "expected a target under the crosshair");
    assert.equal(pick?.offset, 12345);
  });

  it("picks the actor nearest the crosshair when several overlap", () => {
    const pick = pickHarthmereCrosshairCombatTargetV1({
      actors: [
        actor({ offset: 1, screenX: 700, screenY: 360, worldX: 4 }),
        actor({ offset: 2, screenX: 650, screenY: 360, worldX: 5 }),
        actor({ offset: 3, screenX: 645, screenY: 362, worldX: 6 }),
      ],
      aim: CENTER,
      playerX: 0,
      playerZ: 0,
      worldReach: 8.78,
    });
    assert.equal(pick?.offset, 3);
  });

  it("carries the live-mode target id and visible world position for server submit", () => {
    const pick = pickHarthmereCrosshairCombatTargetV1({
      actors: [
        actor({
          offset: 88,
          targetId: "server-muck-combat:old-wood-mucker-2:1302",
          worldX: 4,
          worldY: 54,
          worldZ: -2,
        }),
      ],
      aim: CENTER,
      playerX: 0,
      playerZ: 0,
      worldReach: 8.78,
    });

    assert.equal(
      pick?.targetId,
      "server-muck-combat:old-wood-mucker-2:1302"
    );
    assert.deepEqual(pick?.targetPosition, [4, 54, -2]);
  });

  it("ignores actors far from the crosshair", () => {
    const pick = pickHarthmereCrosshairCombatTargetV1({
      actors: [actor({ offset: 9, screenX: 50, screenY: 80 })],
      aim: CENTER,
      playerX: 0,
      playerZ: 0,
      worldReach: 8.78,
    });
    assert.equal(pick, undefined);
  });

  it("rejects targets beyond world reach even if visually under the crosshair", () => {
    const pick = pickHarthmereCrosshairCombatTargetV1({
      actors: [actor({ offset: 7, worldX: 40, worldZ: 0 })],
      aim: CENTER,
      playerX: 0,
      playerZ: 0,
      worldReach: 8.78,
    });
    assert.equal(pick, undefined);
  });

  it("still hits when the player origin is unknown (missing runtime snapshot)", () => {
    // This is the embed-mode failure mode the fix targets: no forward-arc
    // runtime, so the old cone resolver found nothing. Screen proximity alone
    // must still land the hit.
    const pick = pickHarthmereCrosshairCombatTargetV1({
      actors: [actor({ offset: 42, worldX: undefined, worldZ: undefined })],
      aim: CENTER,
      worldReach: 8.78,
    });
    assert.equal(pick?.offset, 42);
  });

  it("never targets non-attackable or off-screen actors", () => {
    const pick = pickHarthmereCrosshairCombatTargetV1({
      actors: [
        actor({ offset: 1, attackable: false }),
        actor({ offset: 2, screenVisible: false }),
      ],
      aim: CENTER,
      playerX: 0,
      playerZ: 0,
      worldReach: 8.78,
    });
    assert.equal(pick, undefined);
  });

  it("has-target probe agrees with the picker", () => {
    const input = {
      actors: [actor({ offset: 3 })],
      aim: CENTER,
      playerX: 0,
      playerZ: 0,
      worldReach: 8.78,
    };
    assert.equal(harthmereHasCrosshairCombatTargetV1(input), true);
    assert.equal(
      harthmereHasCrosshairCombatTargetV1({ ...input, actors: [] }),
      false
    );
  });

  it("aims at viewport centre under pointer lock, at the click otherwise", () => {
    const locked = harthmereCrosshairAimFromEventV1({
      pointerLocked: true,
      clientX: 10,
      clientY: 20,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    assert.deepEqual([locked.x, locked.y], [640, 360]);
    const free = harthmereCrosshairAimFromEventV1({
      pointerLocked: false,
      clientX: 10,
      clientY: 20,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    assert.deepEqual([free.x, free.y], [10, 20]);
  });
});
