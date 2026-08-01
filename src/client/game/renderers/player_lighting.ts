import { BasePassMaterial } from "@/client/game/renderers/base_pass_material";
import { updatePlayerSkinnedMaterial } from "@/gen/client/game/shaders/player_skinned";
import type { Vec2, Vec3 } from "@/shared/math/types";
import * as THREE from "three";

export const DEFAULT_PLAYER_LIGHT_DIRECTION: Vec3 = [0, 1, 0];

/**
 * Player shaders normalize the supplied sun vector. During a newly staged
 * cutscene the sky resource can briefly publish [0, 0, 0]; normalizing that
 * vector produces undefined lighting and a fully black human silhouette.
 */
export function safePlayerLightDirection(direction: readonly number[]): Vec3 {
  const [x = 0, y = 0, z = 0] = direction;
  const lengthSquared = x * x + y * y + z * z;
  if (
    Number.isFinite(lengthSquared) &&
    lengthSquared > 1e-8 &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(z)
  ) {
    return [x, y, z];
  }
  return [...DEFAULT_PLAYER_LIGHT_DIRECTION];
}

/**
 * Snapshot cutscene actors reuse the native player shader without a Player
 * render-state object to refresh its light uniforms. Keep that presentation
 * path lit with the same material update used by normal players and NPCs.
 *
 * Returns the number of player-skinned materials updated so browser probes can
 * distinguish a successful repair from a snapshot mesh with no body material.
 */
export function updateSnapshotPlayerMeshLighting(
  object: THREE.Object3D,
  spatialLighting: Vec2,
  light: Vec3
): number {
  let updatedMaterials = 0;
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof BasePassMaterial
    ) {
      updatePlayerSkinnedMaterial(child.material, {
        spatialLighting,
        light,
      });
      updatedMaterials += 1;
    }
  });
  return updatedMaterials;
}
