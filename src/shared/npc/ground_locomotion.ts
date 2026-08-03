import { anchorAndSizeToAABB } from "@/shared/math/linear";
import type { AABB, ReadonlyVec3, Vec3 } from "@/shared/math/types";

export const NPC_OVERSIZED_BODY_FOOTPRINT_METERS = 2.5;
export const NPC_OVERSIZED_BODY_HEIGHT_METERS = 3;
export const NPC_GROUND_LOCOMOTION_CORE_MAX_METERS = 2.25;
export const NPC_GROUND_LOCOMOTION_MAX_STEP_BLOCKS = 2;

export interface NpcGroundTraversalProfile {
  oversized: boolean;
  collisionSize: Vec3;
  maxStepHeight: number;
}

function finitePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Large Harthmere bosses keep their full authored ECS `size` for combat,
 * targeting, and rendering, but use a compact central footprint for terrain
 * locomotion. Using a six-to-fifty-eight metre visual/combat box as a rigid
 * walking body makes one raised voxel under a tail or wing count as the whole
 * creature already intersecting terrain, so physics switches to escape mode
 * and the boss appears frozen.
 *
 * The locomotion core remains tall and at least one metre wide, so walls,
 * roofs, and cliffs still block it. Only oversized bodies get the compact
 * footprint and two-block hill-step allowance; ordinary NPC movement retains
 * the historical one-block profile.
 */
export function npcGroundTraversalProfile(
  authoredSize: ReadonlyVec3
): NpcGroundTraversalProfile {
  const size: Vec3 = [
    finitePositive(authoredSize[0], 1),
    finitePositive(authoredSize[1], 1.8),
    finitePositive(authoredSize[2], 1),
  ];
  const footprint = Math.max(size[0], size[2]);
  const oversized =
    footprint >= NPC_OVERSIZED_BODY_FOOTPRINT_METERS ||
    size[1] >= NPC_OVERSIZED_BODY_HEIGHT_METERS;
  if (!oversized) {
    return { oversized: false, collisionSize: size, maxStepHeight: 1 };
  }

  const coreDimension = (dimension: number) =>
    Math.min(
      dimension,
      NPC_GROUND_LOCOMOTION_CORE_MAX_METERS,
      Math.max(1, dimension * 0.45)
    );
  const giantEnoughForTwoBlockSteps = footprint >= 4 || size[1] >= 4;
  return {
    oversized: true,
    collisionSize: [coreDimension(size[0]), size[1], coreDimension(size[2])],
    maxStepHeight: giantEnoughForTwoBlockSteps
      ? NPC_GROUND_LOCOMOTION_MAX_STEP_BLOCKS
      : 1,
  };
}

export function npcGroundLocomotionAabb(
  position: ReadonlyVec3,
  authoredSize: ReadonlyVec3
): AABB {
  return anchorAndSizeToAABB(
    position,
    npcGroundTraversalProfile(authoredSize).collisionSize
  );
}
