import * as THREE from "three";

export const CUTSCENE_GHOST_GROUND_CLEARANCE = 0.08;

export interface GroundedCutsceneGhost {
  /** World-positioned parent used by the cutscene bridge. */
  root: THREE.Group;
  /** Original cloned GLTF hierarchy used as the AnimationMixer root. */
  animationRoot: THREE.Object3D;
  groundOffset: number;
}

/**
 * Put a cutscene GLTF's lowest rendered point just above local Y=0.
 *
 * Canonical Harthmere boss exports intentionally include one block below their
 * authored origin. The ordinary runtime asset path normalizes that bound, but
 * synthetic cutscene ghosts bypassed it and then replaced the object's root
 * position with the encounter coordinate. A parent wrapper preserves the
 * grounding correction when the bridge later teleports/scales/rotates the
 * actor, while keeping animation tracks rooted in the original GLTF hierarchy.
 */
export function groundCutsceneGhost(
  animationRoot: THREE.Object3D,
  clearance = CUTSCENE_GHOST_GROUND_CLEARANCE
): GroundedCutsceneGhost {
  animationRoot.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(animationRoot, true);
  const finiteMinY = Number.isFinite(bounds.min.y) ? bounds.min.y : 0;
  const groundOffset = Math.max(0, clearance) - finiteMinY;
  animationRoot.position.y += groundOffset;

  const root = new THREE.Group();
  root.name = "grounded-cutscene-ghost-root";
  root.add(animationRoot);
  root.userData.cutsceneGhostGrounding = {
    sourceMinY: finiteMinY,
    clearance: Math.max(0, clearance),
    groundOffset,
  };
  root.updateMatrixWorld(true);
  return { root, animationRoot, groundOffset };
}
