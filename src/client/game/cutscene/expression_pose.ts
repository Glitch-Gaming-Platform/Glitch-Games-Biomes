import {
  harthmereCinematicExpressionSpec,
  isHarthmereCinematicExpression,
} from "@/shared/cutscene/cinematic_expressions";
import * as THREE from "three";

const SNAPSHOT_ARM_TARGET_KEY = "harthmereExpressionArmTarget";
const SNAPSHOT_ARM_OUTWARD_KEY = "harthmereExpressionArmOutward";
const EXPRESSION_ROOT_POSE_KEY = "harthmereExpressionRootPoseApplied";

type SnapshotArmTarget = { x: number; y: number; z: number };

function isSnapshotArmBone(node: THREE.Object3D): node is THREE.Bone {
  return (
    node instanceof THREE.Bone &&
    ["L_Arm", "R_Arm", "LeftArm", "RightArm"].includes(node.name)
  );
}

function setRotation(
  node: THREE.Object3D | undefined,
  x: number,
  y = 0,
  z = 0
) {
  if (!node) {
    return;
  }
  if (isSnapshotArmBone(node)) {
    // Player-avatar bones carry non-trivial bind quaternions. Replacing them
    // with an absolute Euler rotation destroys that bind pose and produces the
    // rigid horizontal-arm silhouette. Save the semantic target and solve it
    // in actor space after the expression's root lean has been selected.
    node.userData[SNAPSHOT_ARM_TARGET_KEY] = {
      x,
      y,
      z,
    } satisfies SnapshotArmTarget;
    return;
  }
  if (node instanceof THREE.Bone) {
    // Preserve authored bind/mixer output for other snapshot bones. Dialogue
    // safety posing only needs to guarantee that the upper arms leave T-pose.
    return;
  }
  node.rotation.set(x, y, z);
}

function findRigNode(
  object: THREE.Object3D,
  ...names: readonly string[]
): THREE.Object3D | undefined {
  for (const name of names) {
    const node = object.getObjectByName(name);
    if (node) return node;
  }
  return undefined;
}

function snapshotArmChild(node: THREE.Bone): THREE.Object3D | undefined {
  return node.children.find((child) => child.position.lengthSq() > 1e-8);
}

function applySnapshotArmTarget(
  object: THREE.Object3D,
  node: THREE.Object3D | undefined,
  side: -1 | 1
) {
  if (!node || !isSnapshotArmBone(node)) {
    return;
  }
  const child = snapshotArmChild(node);
  if (!child) {
    return;
  }
  object.updateWorldMatrix(true, true);

  const shoulder = node.getWorldPosition(new THREE.Vector3());
  const elbow = child.getWorldPosition(new THREE.Vector3());
  const currentWorldDirection = elbow.sub(shoulder).normalize();
  if (currentWorldDirection.lengthSq() < 1e-8) {
    return;
  }

  const objectWorldQuaternion = object.getWorldQuaternion(
    new THREE.Quaternion()
  );
  let outwardLocal = node.userData[SNAPSHOT_ARM_OUTWARD_KEY] as
    | [number, number, number]
    | undefined;
  if (!outwardLocal) {
    const parentWorldPosition = node.parent?.getWorldPosition(
      new THREE.Vector3()
    );
    const actorLocalDirection = (
      parentWorldPosition
        ? shoulder.clone().sub(parentWorldPosition)
        : currentWorldDirection.clone()
    ).applyQuaternion(objectWorldQuaternion.clone().invert());
    actorLocalDirection.y = 0;
    if (actorLocalDirection.lengthSq() < 1e-6) {
      actorLocalDirection
        .copy(currentWorldDirection)
        .applyQuaternion(objectWorldQuaternion.clone().invert());
      actorLocalDirection.y = 0;
    }
    if (actorLocalDirection.lengthSq() < 1e-6) {
      actorLocalDirection.set(0, 0, side);
    } else {
      actorLocalDirection.normalize();
    }
    outwardLocal = actorLocalDirection.toArray();
    node.userData[SNAPSHOT_ARM_OUTWARD_KEY] = outwardLocal;
  }

  const outward = new THREE.Vector3().fromArray(outwardLocal).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const forward = up.clone().cross(outward).multiplyScalar(side).normalize();
  const target = (node.userData[SNAPSHOT_ARM_TARGET_KEY] as
    | SnapshotArmTarget
    | undefined) ?? { x: 0.12, y: 0, z: side * 0.08 };

  // The block-actor expression catalog describes an arm raise with increasingly
  // negative X values. Convert that same intent to a direction for the avatar
  // skeleton: relaxed poses hang down, conversational poses come forward, and
  // surrender/victory poses rise overhead without ever becoming a T-pose.
  const raise = THREE.MathUtils.clamp((-target.x - 0.15) / 2.05, 0, 1);
  const vertical = THREE.MathUtils.lerp(-0.94, 0.82, raise);
  const forwardAmount = 0.12 + Math.sin(raise * Math.PI) * 0.86;
  const lateral = THREE.MathUtils.clamp(
    0.16 + Math.abs(target.z) * 0.32,
    0.16,
    0.5
  );
  const desiredWorldDirection = outward
    .multiplyScalar(lateral)
    .addScaledVector(forward, forwardAmount)
    .addScaledVector(up, vertical)
    .normalize()
    .applyQuaternion(objectWorldQuaternion);

  const currentWorldQuaternion = node.getWorldQuaternion(
    new THREE.Quaternion()
  );
  const desiredWorldQuaternion = new THREE.Quaternion()
    .setFromUnitVectors(currentWorldDirection, desiredWorldDirection)
    .multiply(currentWorldQuaternion);
  const parentWorldQuaternion = node.parent?.getWorldQuaternion(
    new THREE.Quaternion()
  );
  node.quaternion.copy(
    parentWorldQuaternion
      ? parentWorldQuaternion.invert().multiply(desiredWorldQuaternion)
      : desiredWorldQuaternion
  );
  node.quaternion.normalize();
  node.updateWorldMatrix(false, true);
}

/**
 * Procedural fallback for Harthmere block actors and snapshot-player cutscene
 * meshes whose generated skeleton rejected an authored Blender clip. Native
 * rigs normally use the catalog clip; this fallback keeps a missing binding
 * from leaving the speaking human in the generated mesh's T-pose.
 */
export function applyHarthmereCinematicExpressionPose(
  object: THREE.Object3D,
  animation: string | undefined,
  time: number
): boolean {
  if (!isHarthmereCinematicExpression(animation)) {
    return false;
  }
  const motion = harthmereCinematicExpressionSpec(animation).motion;
  const leftArm = findRigNode(
    object,
    "townsperson-left-arm",
    "L_Arm",
    "LeftArm"
  );
  const rightArm = findRigNode(
    object,
    "townsperson-right-arm",
    "R_Arm",
    "RightArm"
  );
  const leftLeg = findRigNode(
    object,
    "townsperson-left-leg",
    "L_Thigh",
    "LeftUpLeg"
  );
  const rightLeg = findRigNode(
    object,
    "townsperson-right-leg",
    "R_Thigh",
    "RightUpLeg"
  );
  const slow = Math.sin(time * 3.2);
  const medium = Math.sin(time * 6);
  const fast = Math.sin(time * 12);

  object.rotation.x = 0;
  object.rotation.z = 0;
  for (const arm of [leftArm, rightArm]) {
    if (arm && isSnapshotArmBone(arm)) {
      delete arm.userData[SNAPSHOT_ARM_TARGET_KEY];
    }
  }

  switch (motion) {
    case "sadness":
    case "shame":
    case "defeat":
    case "sighing":
      object.rotation.x = 0.18;
      setRotation(leftArm, 0.12, 0, -0.08);
      setRotation(rightArm, 0.12, 0, 0.08);
      break;
    case "depression":
      object.rotation.x = 0.28;
      setRotation(leftArm, 0.28, 0, -0.12);
      setRotation(rightArm, 0.28, 0, 0.12);
      setRotation(leftLeg, -0.3);
      setRotation(rightLeg, -0.3);
      break;
    case "crying":
      object.rotation.x = 0.2 + slow * 0.025;
      setRotation(leftArm, -1.48 + slow * 0.04, 0, -0.18);
      setRotation(rightArm, -1.48 - slow * 0.04, 0, 0.18);
      break;
    case "fear":
    case "nervousness":
      object.rotation.z = medium * 0.04;
      setRotation(leftArm, -0.65 + fast * 0.06, 0, -0.22);
      setRotation(rightArm, -0.65 - fast * 0.06, 0, 0.22);
      break;
    case "terror":
    case "cowering":
      object.rotation.x = 0.38;
      setRotation(leftArm, -1.2 + fast * 0.04, 0, -0.48);
      setRotation(rightArm, -1.2 - fast * 0.04, 0, 0.48);
      setRotation(leftLeg, -0.65);
      setRotation(rightLeg, -0.65);
      break;
    case "surprise":
      object.rotation.x = -0.08;
      setRotation(leftArm, -0.8, 0, -0.72);
      setRotation(rightArm, -0.8, 0, 0.72);
      break;
    case "shock":
      object.rotation.x = -0.14;
      setRotation(leftArm, -1.15, 0, -0.85);
      setRotation(rightArm, -1.15, 0, 0.85);
      break;
    case "recoil":
      object.rotation.x = -0.24;
      object.rotation.z = 0.12;
      setRotation(leftArm, -0.55, 0, -0.45);
      setRotation(rightArm, -0.85, 0, 0.3);
      break;
    case "curiosity":
      object.rotation.x = -0.05;
      object.rotation.z = 0.1;
      setRotation(rightArm, -0.55, 0, 0.25);
      break;
    case "thinking":
      setRotation(rightArm, -1.3, 0, 0.22);
      setRotation(leftArm, 0.15, 0, -0.08);
      object.rotation.z = 0.04 * slow;
      break;
    case "confusion":
      setRotation(leftArm, -0.72, 0, -0.58);
      setRotation(rightArm, -0.72, 0, 0.58);
      object.rotation.z = 0.09;
      break;
    case "uncertainty":
      setRotation(leftArm, -0.38 + slow * 0.08, 0, -0.32);
      setRotation(rightArm, -0.28 - slow * 0.08, 0, 0.2);
      object.rotation.z = slow * 0.04;
      break;
    case "embarrassment":
      object.rotation.x = 0.12;
      object.rotation.z = -0.08;
      setRotation(rightArm, -1.15, 0, 0.22);
      break;
    case "shyness":
      object.rotation.x = 0.1;
      object.rotation.z = 0.12;
      setRotation(leftArm, 0.2, 0, -0.2);
      setRotation(rightArm, 0.2, 0, 0.2);
      break;
    case "boredom":
      object.rotation.z = -0.06;
      setRotation(leftArm, -0.28, 0, 0.25);
      setRotation(rightArm, -0.28, 0, -0.25);
      break;
    case "impatience":
    case "footTapping":
      object.rotation.z = 0.06;
      setRotation(leftLeg, fast > 0 ? -0.18 : 0.05);
      setRotation(rightArm, -0.22, 0, 0.28);
      break;
    case "annoyance":
      setRotation(leftArm, -0.3, 0, 0.32);
      setRotation(rightArm, -0.3, 0, -0.32);
      object.rotation.z = -0.05;
      break;
    case "frustration":
      setRotation(leftArm, -1.1 + medium * 0.16, 0, -0.72);
      setRotation(rightArm, -1.1 - medium * 0.16, 0, 0.72);
      object.rotation.x = 0.1;
      break;
    case "facepalm":
      setRotation(rightArm, -1.58, 0, 0.12);
      object.rotation.x = 0.12;
      break;
    case "anger":
      object.rotation.x = -0.08;
      setRotation(leftArm, -0.55, 0, -0.18);
      setRotation(rightArm, -0.55, 0, 0.18);
      break;
    case "fury":
      object.rotation.x = -0.18 + fast * 0.02;
      setRotation(leftArm, -1.25 + medium * 0.28, 0, -0.5);
      setRotation(rightArm, -1.25 - medium * 0.28, 0, 0.5);
      break;
    case "threatening":
      object.rotation.x = -0.16;
      setRotation(rightArm, -1.45, 0, 0.08);
      setRotation(leftArm, -0.35, 0, -0.28);
      break;
    case "determined":
    case "ready":
    case "guard":
      object.rotation.x = -0.07;
      setRotation(leftArm, -0.62, 0, -0.28);
      setRotation(rightArm, -0.62, 0, 0.28);
      setRotation(leftLeg, -0.12);
      setRotation(rightLeg, 0.12);
      break;
    case "block":
      object.rotation.x = -0.12;
      setRotation(leftArm, -1.25, 0, -0.5);
      setRotation(rightArm, -1.05, 0, 0.42);
      break;
    case "tiredness":
      object.rotation.x = 0.16 + slow * 0.02;
      setRotation(leftArm, 0.18, 0, -0.08);
      setRotation(rightArm, 0.18, 0, 0.08);
      break;
    case "exhaustion":
      object.rotation.x = 0.42;
      setRotation(leftArm, -0.55, 0, -0.08);
      setRotation(rightArm, -0.55, 0, 0.08);
      setRotation(leftLeg, -0.25);
      setRotation(rightLeg, -0.25);
      break;
    case "yawning":
      setRotation(rightArm, -1.45, 0, 0.16);
      object.rotation.x = 0.06;
      break;
    case "stretching":
      object.rotation.x = -0.12;
      setRotation(leftArm, -2.65, 0, -0.2);
      setRotation(rightArm, -2.65, 0, 0.2);
      break;
    case "injury":
      object.rotation.z = -0.16;
      setRotation(rightArm, -0.95, 0, 0.18);
      setRotation(leftLeg, -0.16);
      break;
    case "limping":
      object.rotation.z = -0.12 + slow * 0.04;
      setRotation(leftLeg, -0.55 + medium * 0.16);
      setRotation(rightLeg, 0.18 - medium * 0.1);
      setRotation(leftArm, medium * 0.22);
      setRotation(rightArm, -medium * 0.22);
      break;
    case "dizziness":
      object.rotation.z = slow * 0.22;
      object.rotation.x = medium * 0.06;
      setRotation(leftArm, -0.45, 0, -0.42);
      setRotation(rightArm, -0.45, 0, 0.42);
      break;
    case "shivering":
      object.rotation.z = fast * 0.025;
      setRotation(leftArm, -0.72 + fast * 0.05, 0, 0.28);
      setRotation(rightArm, -0.72 - fast * 0.05, 0, -0.28);
      break;
    case "relief":
      object.rotation.x = 0.08;
      setRotation(leftArm, 0.22, 0, -0.16);
      setRotation(rightArm, 0.22, 0, 0.16);
      break;
    case "disgust":
      object.rotation.x = -0.12;
      object.rotation.z = -0.12;
      setRotation(rightArm, -0.82, 0, 0.6);
      break;
    case "love":
      setRotation(leftArm, -1.1, 0, -0.3);
      setRotation(rightArm, -1.1, 0, 0.3);
      break;
    case "flirting":
      object.rotation.z = 0.12;
      setRotation(rightArm, -1.25 + slow * 0.1, 0, 0.45);
      break;
    case "gratitude":
      object.rotation.x = 0.14;
      setRotation(leftArm, -0.78, 0, -0.2);
      setRotation(rightArm, -0.78, 0, 0.2);
      break;
    case "apology":
    case "bow":
      object.rotation.x = 0.48;
      setRotation(leftArm, 0.12, 0, -0.08);
      setRotation(rightArm, 0.12, 0, 0.08);
      break;
    case "salute":
      setRotation(rightArm, -1.62, 0, 0.12);
      break;
    case "kneel":
      object.rotation.x = 0.08;
      setRotation(leftLeg, -1.2);
      setRotation(rightLeg, -0.5);
      break;
    case "pray":
      setRotation(leftArm, -1.2 + slow * 0.03, 0, -0.18);
      setRotation(rightArm, -1.2 - slow * 0.03, 0, 0.18);
      break;
    case "meditate":
      setRotation(leftLeg, -1.35);
      setRotation(rightLeg, -1.35);
      setRotation(leftArm, -0.25, 0, -0.28);
      setRotation(rightArm, -0.25, 0, 0.28);
      break;
    case "surrender":
      setRotation(leftArm, -2.2, 0, -0.35);
      setRotation(rightArm, -2.2, 0, 0.35);
      break;
    case "beckon":
      setRotation(rightArm, -1.4 + medium * 0.24, 0, 0.16);
      break;
    case "stop":
      setRotation(rightArm, -1.48, 0, 0.05);
      break;
    case "hug":
      setRotation(leftArm, -1.22, 0, -0.9);
      setRotation(rightArm, -1.22, 0, 0.9);
      break;
    case "handshake":
      setRotation(rightArm, -1.2 + medium * 0.08, 0, 0.38);
      break;
    case "highFive":
      setRotation(rightArm, -2.05, 0, 0.18);
      break;
    case "thumbsUp":
      setRotation(rightArm, -1.28, 0, 0.28);
      break;
    case "thumbsDown":
      setRotation(rightArm, -0.45, 0, 0.28);
      break;
    case "taunt":
      setRotation(leftArm, -0.85 + medium * 0.22, 0, -0.5);
      setRotation(rightArm, -0.85 - medium * 0.22, 0, 0.5);
      object.rotation.x = -0.1;
      break;
    case "stagger":
      object.rotation.x = 0.18;
      object.rotation.z = -0.34;
      setRotation(leftArm, -0.7);
      setRotation(rightArm, -0.95);
      break;
    case "knockdown":
      object.rotation.x = -Math.PI * 0.48;
      object.position.y -= 0.32;
      break;
    case "getUp":
      object.rotation.x = -0.5 * (1 - Math.min(1, time / 1.2));
      break;
    case "retreat":
      object.rotation.x = -0.08;
      setRotation(leftLeg, medium * 0.42);
      setRotation(rightLeg, -medium * 0.42);
      setRotation(leftArm, -medium * 0.3);
      setRotation(rightArm, medium * 0.3);
      break;
    case "rally":
      setRotation(rightArm, -2.2 + medium * 0.12, 0, 0.2);
      setRotation(leftArm, -0.7, 0, -0.28);
      break;
    case "victory":
      setRotation(leftArm, -2.4 + medium * 0.08, 0, -0.35);
      setRotation(rightArm, -2.4 - medium * 0.08, 0, 0.35);
      break;
    case "scratchingHead":
      setRotation(rightArm, -1.7 + slow * 0.08, 0, 0.2);
      break;
    case "checkingEquipment":
      setRotation(leftArm, -0.75 + slow * 0.08, 0, -0.22);
      setRotation(rightArm, -0.9 - slow * 0.08, 0, 0.25);
      break;
    case "pacing":
      setRotation(leftLeg, medium * 0.42);
      setRotation(rightLeg, -medium * 0.42);
      setRotation(leftArm, -medium * 0.3);
      setRotation(rightArm, medium * 0.3);
      object.rotation.z = slow * 0.03;
      break;
    case "cleaningWeapon":
      setRotation(leftArm, -1.0 + medium * 0.08, 0, -0.25);
      setRotation(rightArm, -0.72 - medium * 0.12, 0, 0.2);
      break;
    default:
      return false;
  }
  object.userData[EXPRESSION_ROOT_POSE_KEY] = true;
  applySnapshotArmTarget(object, leftArm, -1);
  applySnapshotArmTarget(object, rightArm, 1);
  return true;
}

export function clearHarthmereCinematicExpressionPose(object: THREE.Object3D) {
  if (object.userData[EXPRESSION_ROOT_POSE_KEY] !== true) {
    return;
  }
  object.rotation.x = 0;
  object.rotation.z = 0;
  delete object.userData[EXPRESSION_ROOT_POSE_KEY];
}

export function shouldApplyHarthmereSnapshotExpressionPose(
  animation: string | undefined
): boolean {
  // Snapshot player meshes can expose a partially-bound action (for example,
  // head/chest tracks bind while arm tracks do not). Treat every cinematic
  // expression as needing the post-Mixer safety pose; writing the same target
  // rotations is harmless when the Blender clip bound completely and prevents
  // partial bindings from leaving the actor's arms in a T-pose.
  return isHarthmereCinematicExpression(animation);
}
