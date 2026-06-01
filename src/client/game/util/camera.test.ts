import {
  camOffsetVector,
  isIntendedFirstPersonCamera,
  shouldRenderPlayerAvatar,
  thirdPersonCamPosition,
} from "@/client/game/util/camera";
import {
  defaultTweakableConfigValues,
  type TrackingCamTweaks,
} from "@/server/shared/minigames/ruleset/tweaks";
import type { Vec2f } from "@/shared/ecs/gen/types";
import type { Vec3 } from "@/shared/math/types";
import assert from "assert";

const firstPos: Vec3 = [10, 20, -5];
const orientation: Vec2f = [0, 0];

function desiredCameraPosition(tweak: TrackingCamTweaks) {
  return thirdPersonCamPosition(orientation, camOffsetVector(tweak), firstPos);
}

describe("camera view avatar visibility", () => {
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
