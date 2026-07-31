import {
  harthmereCinematicExpressionSpec,
  isHarthmereCinematicExpression,
} from "@/shared/cutscene/cinematic_expressions";
import * as THREE from "three";

function setRotation(
  node: THREE.Object3D | undefined,
  x: number,
  y = 0,
  z = 0
) {
  node?.rotation.set(x, y, z);
}

/**
 * Procedural fallback for Harthmere block actors. Native player/NPC rigs use
 * the Blender clips with the same catalog motion name; this keeps ghosts and
 * compatibility bodies readable instead of silently dropping the gesture.
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
  const leftArm = object.getObjectByName("townsperson-left-arm");
  const rightArm = object.getObjectByName("townsperson-right-arm");
  const leftLeg = object.getObjectByName("townsperson-left-leg");
  const rightLeg = object.getObjectByName("townsperson-right-leg");
  const slow = Math.sin(time * 3.2);
  const medium = Math.sin(time * 6);
  const fast = Math.sin(time * 12);

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
  return true;
}
