import {
  applyHarthmereCinematicExpressionPose,
  shouldApplyHarthmereSnapshotExpressionPose,
} from "@/client/game/cutscene/expression_pose";
import assert from "assert";
import * as THREE from "three";

function rigWith(names: readonly string[]) {
  const root = new THREE.Object3D();
  for (const name of names) {
    const node = new THREE.Object3D();
    node.name = name;
    root.add(node);
  }
  return root;
}

describe("Harthmere cinematic expression pose fallback", () => {
  it("poses legacy block-actor limb names", () => {
    const root = rigWith([
      "townsperson-left-arm",
      "townsperson-right-arm",
      "townsperson-left-leg",
      "townsperson-right-leg",
    ]);

    assert.equal(
      applyHarthmereCinematicExpressionPose(root, "determined", 0.5),
      true
    );
    assert.equal(
      root.getObjectByName("townsperson-left-arm")?.rotation.x,
      -0.62
    );
    assert.equal(
      root.getObjectByName("townsperson-right-arm")?.rotation.z,
      0.28
    );
  });

  it("poses snapshot-player skeleton names when a Blender clip cannot bind", () => {
    const root = new THREE.Object3D();
    const chest = new THREE.Bone();
    chest.name = "Chest";
    root.add(chest);
    const leftArm = new THREE.Bone();
    leftArm.name = "L_Arm";
    leftArm.quaternion.fromArray([-0.5, -0.5, 0.5, 0.5]);
    const leftForearm = new THREE.Bone();
    leftForearm.name = "L_Forearm";
    leftForearm.position.set(0, 0.8, 0);
    leftArm.add(leftForearm);
    chest.add(leftArm);
    const rightArm = new THREE.Bone();
    rightArm.name = "R_Arm";
    rightArm.quaternion.fromArray([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
    const rightForearm = new THREE.Bone();
    rightForearm.name = "R_Forearm";
    rightForearm.position.set(0, 0.8, 0);
    rightArm.add(rightForearm);
    chest.add(rightArm);

    assert.equal(
      applyHarthmereCinematicExpressionPose(root, "determined", 0.5),
      true
    );
    root.updateWorldMatrix(true, true);
    const armDirection = (arm: THREE.Bone, forearm: THREE.Bone) =>
      forearm
        .getWorldPosition(new THREE.Vector3())
        .sub(arm.getWorldPosition(new THREE.Vector3()))
        .normalize();
    const leftDirection = armDirection(leftArm, leftForearm);
    const rightDirection = armDirection(rightArm, rightForearm);
    assert.ok(
      leftDirection.y < -0.35,
      "left arm should leave horizontal T-pose"
    );
    assert.ok(
      rightDirection.y < -0.35,
      "right arm should leave horizontal T-pose"
    );
    assert.ok(
      leftDirection.dot(rightDirection) > 0.25,
      "both arms should present forward/down instead of opposite wings"
    );
    assert.equal(root.rotation.x, -0.07);
  });

  it("does not alter the rig for an unknown animation", () => {
    const root = rigWith(["L_Arm", "R_Arm"]);

    assert.equal(
      applyHarthmereCinematicExpressionPose(root, "not-an-expression", 0.5),
      false
    );
    assert.equal(root.getObjectByName("L_Arm")?.rotation.x, 0);
    assert.equal(root.getObjectByName("R_Arm")?.rotation.z, 0);
  });

  it("always protects snapshot humans from partial expression bindings", () => {
    assert.equal(
      shouldApplyHarthmereSnapshotExpressionPose("determined"),
      true
    );
    assert.equal(
      shouldApplyHarthmereSnapshotExpressionPose("uncertainty"),
      true
    );
    assert.equal(shouldApplyHarthmereSnapshotExpressionPose("idle"), false);
    assert.equal(shouldApplyHarthmereSnapshotExpressionPose(undefined), false);
  });
});
