import * as THREE from "three";

/**
 * Finalize a hierarchy that will only change visibility after placement.
 * Animated/dynamic hierarchies must not use this helper.
 */
export function freezeStaticObjectMatrices(object: THREE.Object3D) {
  object.traverse((child) => child.updateMatrix());
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    child.matrixAutoUpdate = false;
    child.matrixWorldNeedsUpdate = false;
  });
}
