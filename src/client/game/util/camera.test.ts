import {
  camOffsetVector,
  defaultToFirstPersonForSyncTarget,
  isIntendedFirstPersonCamera,
  playerFirstPersonCamPositionAtHeight,
  shouldRenderPlayerAvatar,
  shouldResetToThirdPersonAfterSyncTargetChange,
  thirdPersonCamPosition,
} from "@/client/game/util/camera";
import {
  defaultTweakableConfigValues,
  type TrackingCamTweaks,
} from "@/server/shared/minigames/ruleset/tweaks";
import type { Vec2f } from "@/shared/ecs/gen/types";
import type { Vec3 } from "@/shared/math/types";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

const firstPos: Vec3 = [10, 20, -5];
const orientation: Vec2f = [0, 0];

function desiredCameraPosition(tweak: TrackingCamTweaks) {
  return thirdPersonCamPosition(orientation, camOffsetVector(tweak), firstPos);
}

describe("camera view avatar visibility", () => {
  it("defaults signed-in and entity-target sessions to third person", () => {
    assert.equal(
      defaultToFirstPersonForSyncTarget({
        kind: "localUser",
        userId: 123 as BiomesId,
      }),
      false
    );
    assert.equal(
      defaultToFirstPersonForSyncTarget({
        kind: "entity",
        entityId: 456 as BiomesId,
      }),
      false
    );
  });

  it("keeps fixed-position observer sessions in first person", () => {
    assert.equal(
      defaultToFirstPersonForSyncTarget({
        kind: "position",
        position: [1, 2, 3],
      }),
      true
    );
  });

  it("resets observer bootstrap state when the session becomes the local player", () => {
    assert.equal(
      shouldResetToThirdPersonAfterSyncTargetChange("position", "localUser"),
      true
    );
    assert.equal(
      shouldResetToThirdPersonAfterSyncTargetChange("entity", "localUser"),
      true
    );
    assert.equal(
      shouldResetToThirdPersonAfterSyncTargetChange("localUser", "localUser"),
      false
    );
    assert.equal(
      shouldResetToThirdPersonAfterSyncTargetChange("position", "position"),
      false
    );
  });

  it("places a stance-smoothed camera at an explicit eye height", () => {
    assert.deepEqual(
      playerFirstPersonCamPositionAtHeight([4, 10, -2], 1.1),
      [4, 11.1, -2]
    );
  });

  it("hides the local avatar for the intentional first-person camera", () => {
    const desiredThird = desiredCameraPosition(
      defaultTweakableConfigValues.firstPersonCam
    );
    const cameraIsFirstPerson = isIntendedFirstPersonCamera(
      firstPos,
      desiredThird
    );

    assert.equal(cameraIsFirstPerson, true);
    assert.equal(shouldRenderPlayerAvatar(true, cameraIsFirstPerson), false);
  });

  it("shows the local avatar for the normal third-person camera", () => {
    const desiredThird = desiredCameraPosition(
      defaultTweakableConfigValues.thirdPersonCam
    );
    const cameraIsFirstPerson = isIntendedFirstPersonCamera(
      firstPos,
      desiredThird
    );

    assert.equal(cameraIsFirstPerson, false);
    assert.equal(shouldRenderPlayerAvatar(true, cameraIsFirstPerson), true);
  });

  it("shows the local avatar for reverse third-person and selfie cameras", () => {
    for (const tweak of [
      defaultTweakableConfigValues.reverseThirdPersonCam,
      defaultTweakableConfigValues.inGameCamera.normal,
      defaultTweakableConfigValues.inGameCamera.selfie,
    ]) {
      const desiredThird = desiredCameraPosition(tweak);
      const cameraIsFirstPerson = isIntendedFirstPersonCamera(
        firstPos,
        desiredThird
      );

      assert.equal(cameraIsFirstPerson, false);
      assert.equal(shouldRenderPlayerAvatar(true, cameraIsFirstPerson), true);
    }
  });

  it("keeps third-person avatar visibility when collision clips the camera onto the player", () => {
    const desiredThird = desiredCameraPosition(
      defaultTweakableConfigValues.thirdPersonCam
    );
    const collisionClippedPosition = firstPos;
    const oldDistanceBasedResult = isIntendedFirstPersonCamera(
      firstPos,
      collisionClippedPosition
    );
    const cameraIsFirstPerson = isIntendedFirstPersonCamera(
      firstPos,
      desiredThird
    );

    assert.equal(oldDistanceBasedResult, true);
    assert.equal(cameraIsFirstPerson, false);
    assert.equal(shouldRenderPlayerAvatar(true, cameraIsFirstPerson), true);
  });

  it("treats fixed-position observer fps cameras as first-person", () => {
    const desiredThird = desiredCameraPosition(
      defaultTweakableConfigValues.inGameCamera.fps
    );
    const cameraIsFirstPerson = isIntendedFirstPersonCamera(
      firstPos,
      desiredThird
    );

    assert.equal(cameraIsFirstPerson, true);
    assert.equal(shouldRenderPlayerAvatar(true, cameraIsFirstPerson), false);
  });

  it("shows the local avatar for fixed non-FPS camera views", () => {
    assert.equal(shouldRenderPlayerAvatar(true, false), true);
  });

  it("keeps the first-person threshold exclusive at the boundary", () => {
    assert.equal(isIntendedFirstPersonCamera([0, 0, 0], [0.499, 0, 0]), true);
    assert.equal(isIntendedFirstPersonCamera([0, 0, 0], [0.5, 0, 0]), false);
    assert.equal(isIntendedFirstPersonCamera([0, 0, 0], [0.501, 0, 0]), false);
  });

  it("always shows remote player avatars, even while the local camera is first-person", () => {
    assert.equal(shouldRenderPlayerAvatar(false, true), true);
    assert.equal(shouldRenderPlayerAvatar(false, false), true);
  });
});
