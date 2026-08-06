import { safeCameraFarPlane } from "@/client/game/util/camera_projection";
import assert from "assert";
import * as THREE from "three";

describe("camera projection safety", () => {
  it("keeps the first far-plane fade frame invertible", () => {
    const camera = new THREE.PerspectiveCamera(2.25, 390 / 844, 0.1, 0);
    camera.far = safeCameraFarPlane(camera.near, camera.far);
    camera.updateProjectionMatrix();

    assert(camera.far > camera.near);
    assert(Number.isFinite(camera.projectionMatrix.determinant()));
    assert.notEqual(camera.projectionMatrix.determinant(), 0);
    assert(
      camera.projectionMatrix
        .clone()
        .invert()
        .toArray()
        .every(Number.isFinite)
    );
  });

  it("preserves valid draw distances", () => {
    assert.equal(safeCameraFarPlane(0.1, 64), 64);
    assert.equal(safeCameraFarPlane(0.1, 256), 256);
  });

  it("fails safe for zero, negative, and non-finite values", () => {
    for (const proposedFar of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const far = safeCameraFarPlane(0.1, proposedFar);
      assert(Number.isFinite(far));
      assert(far > 0.1);
    }
  });
});
