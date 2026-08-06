/// <reference types="mocha" />

import {
  HARTHMERE_COMBAT_LOCK_LOST_GRACE_MS,
  chooseHarthmereCombatLockCandidate,
  cycleHarthmereCombatLockCandidate,
  harthmereCombatLockActorEligible,
  harthmereCombatLockCameraTarget,
  harthmereCombatLockCameraFrame,
  pickHarthmereLockedCombatActor,
  readHarthmereCombatLockState,
  refreshHarthmereCombatLock,
  resetHarthmereCombatLockForTest,
  scoreHarthmereCombatLockCandidate,
  setHarthmereCombatLockCandidates,
  shouldToggleHarthmereCombatLockForKey,
  switchHarthmereCombatLock,
  toggleHarthmereCombatLock,
  type HarthmereCombatLockCandidate,
} from "@/client/components/challenges/harthmere_combat_lock_on";
import assert from "assert";
import fs from "fs";
import path from "path";

function candidate(
  offset: number,
  overrides: Partial<HarthmereCombatLockCandidate> = {}
): HarthmereCombatLockCandidate {
  return {
    offset,
    entityId: offset,
    attackable: true,
    radius: 1,
    label: `Mucker ${offset}`,
    species: "animal",
    behavior: "hostile",
    socialRole: "hostile",
    health: { hp: 100, maxHp: 100 },
    world: [offset, 1, 0],
    worldX: offset,
    worldY: 1,
    worldZ: 0,
    screenX: 640,
    screenY: 360,
    screenVisible: true,
    distance: Math.abs(offset),
    boss: false,
    hostile: true,
    ...overrides,
  };
}

describe("Harthmere combat lock-on", () => {
  it("owns Tab in the module-load hard router before replacement HUD focus handlers", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"
      ),
      "utf8"
    );
    assert.match(source, /harthmere-hard-key-router-native-ecs-v3/);
    assert.match(
      source,
      /event\.code === HARTHMERE_COMBAT_KEY_BINDINGS\.target/
    );
    assert.match(source, /toggleHarthmereCombatTargetLock\(\)/);
    assert.match(source, /action: "target_lock"/);
  });

  beforeEach(() => resetHarthmereCombatLockForTest());

  it("prefers a centered nearby threat while still weighting bosses", () => {
    const centered = candidate(2, { screenX: 640, screenY: 360, distance: 8 });
    const edgeBoss = candidate(3, {
      label: "Alpha Mucker Boss",
      screenX: 1120,
      screenY: 360,
      distance: 9,
      boss: true,
    });
    assert.ok(
      scoreHarthmereCombatLockCandidate({
        candidate: edgeBoss,
        viewportWidth: 1280,
        viewportHeight: 720,
      }) > 0
    );
    assert.equal(
      chooseHarthmereCombatLockCandidate({
        candidates: [edgeBoss, centered],
        viewportWidth: 1280,
        viewportHeight: 720,
      })?.offset,
      centered.offset
    );
  });

  it("excludes dead, passive, merchant, civilian, off-screen, and distant actors", () => {
    for (const actor of [
      candidate(1, { health: { hp: 0, maxHp: 100 } }),
      candidate(1, { behavior: "passive", socialRole: "wildlife" }),
      candidate(1, { behavior: "merchant", socialRole: "merchant" }),
      candidate(1, { behavior: "defensive", socialRole: "civilian" }),
      candidate(1, { screenVisible: false }),
      candidate(40, { distance: 40 }),
    ]) {
      assert.equal(
        harthmereCombatLockActorEligible({
          actor,
          distance: actor.distance,
          acquiring: true,
        }),
        false
      );
    }
  });

  it("toggles on with Tab semantics and toggles off on the next press", () => {
    setHarthmereCombatLockCandidates([candidate(5)]);
    assert.equal(
      toggleHarthmereCombatLock({
        viewportWidth: 1280,
        viewportHeight: 720,
        now: 1_000,
      })?.offset,
      5
    );
    assert.equal(readHarthmereCombatLockState().active, true);
    toggleHarthmereCombatLock({
      viewportWidth: 1280,
      viewportHeight: 720,
      now: 1_100,
    });
    assert.equal(readHarthmereCombatLockState().active, false);
    assert.equal(readHarthmereCombatLockState().reason, "tab_toggle_off");
  });

  it("cycles targets in screen-relative order", () => {
    const left = candidate(1, { screenX: 200 });
    const middle = candidate(2, { screenX: 640 });
    const right = candidate(3, { screenX: 1080 });
    assert.equal(
      cycleHarthmereCombatLockCandidate({
        candidates: [right, left, middle],
        currentOffset: middle.offset,
        direction: 1,
      })?.offset,
      right.offset
    );
    setHarthmereCombatLockCandidates([left, middle, right]);
    toggleHarthmereCombatLock({
      viewportWidth: 1280,
      viewportHeight: 720,
      now: 1_000,
    });
    assert.equal(switchHarthmereCombatLock(1, 1_100)?.offset, right.offset);
  });

  it("keeps a brief occlusion grace, then unlocks without chain-snapping", () => {
    const visible = candidate(4);
    setHarthmereCombatLockCandidates([visible]);
    toggleHarthmereCombatLock({
      viewportWidth: 1280,
      viewportHeight: 720,
      now: 1_000,
    });
    refreshHarthmereCombatLock([candidate(4, { screenVisible: false })], 1_100);
    assert.equal(readHarthmereCombatLockState().active, true);
    assert.equal(readHarthmereCombatLockState().reason, "occlusion_grace");
    refreshHarthmereCombatLock(
      [candidate(4, { screenVisible: false })],
      1_100 + HARTHMERE_COMBAT_LOCK_LOST_GRACE_MS + 1
    );
    assert.equal(readHarthmereCombatLockState().active, false);
  });

  it("frames the locked target and never bypasses weapon reach", () => {
    setHarthmereCombatLockCandidates([candidate(6, { world: [6, 1, 0] })]);
    toggleHarthmereCombatLock({
      viewportWidth: 1280,
      viewportHeight: 720,
      now: 1_000,
    });
    assert.equal(harthmereCombatLockCameraTarget([0, 0, 0])?.distance, 6);
    assert.equal(
      pickHarthmereLockedCombatActor({
        actors: [candidate(6, { worldX: 6, worldY: 1, worldZ: 0 })],
        playerX: 0,
        playerZ: 0,
        worldReach: 2,
      }),
      undefined
    );
    assert.equal(
      pickHarthmereLockedCombatActor({
        actors: [candidate(6, { worldX: 6, worldY: 1, worldZ: 0 })],
        playerX: 0,
        playerZ: 0,
        worldReach: 5,
      })?.offset,
      6
    );
  });

  it("smoothly faces the target and expands framing for distant enemies", () => {
    const near = harthmereCombatLockCameraFrame({
      currentOrientation: [0, Math.PI],
      eye: [0, 1.6, 0],
      target: [0, 1, -5],
      targetRadius: 1,
      distance: 5,
      dt: 1 / 60,
    });
    const far = harthmereCombatLockCameraFrame({
      currentOrientation: [0, Math.PI],
      eye: [0, 1.6, 0],
      target: [0, 1, -24],
      targetRadius: 3,
      distance: 24,
      dt: 1 / 60,
    });
    assert.ok(
      Math.cos(near.orientation[1]) > Math.cos(Math.PI),
      "the first frame must begin turning toward the locked target"
    );
    assert.ok(far.pullbackMeters > near.pullbackMeters);
    assert.ok(far.fovBoostDegrees > near.fovBoostDegrees);
    assert.ok(Math.abs(far.orientation[0]) <= 0.34);
  });

  it("claims only an unmodified non-repeating Tab outside text fields", () => {
    assert.equal(shouldToggleHarthmereCombatLockForKey({ code: "Tab" }), true);
    assert.equal(
      shouldToggleHarthmereCombatLockForKey({ code: "Tab", repeat: true }),
      false
    );
    assert.equal(
      shouldToggleHarthmereCombatLockForKey({
        code: "Tab",
        editableTarget: true,
      }),
      false
    );
    assert.equal(
      shouldToggleHarthmereCombatLockForKey({ code: "KeyT" }),
      false
    );
  });
});
