import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_BOSS_MAGIC_PRESENTATION_VERSION =
  "harthmere-boss-magic-presentation-v1" as const;

export const HARTHMERE_BOSS_MAGIC_MAX_CHARGE_VISUAL_SCALE = 7.5;
export const HARTHMERE_BOSS_MAGIC_MAX_PROJECTILE_VISUAL_SCALE = 2.75;

export interface HarthmereBossMagicPresentation {
  readonly version: typeof HARTHMERE_BOSS_MAGIC_PRESENTATION_VERSION;
  readonly origin: Vec3;
  readonly chargeVisualScale: number;
  readonly projectileVisualScale: number;
  readonly horizontalBodySurfaceDistance: number;
  readonly targetConstrained: boolean;
}

function finiteDimension(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0.1, Math.abs(number)) : 0.1;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Places boss magic on the player-facing body surface instead of at the NPC's
 * center. This matters for raid-scale actors: Thaedryn is 58 metres long, so
 * a center-origin charge or projectile can spend its entire readable opening
 * inside the dragon mesh.
 *
 * Position is the normal bottom-center NPC anchor. The horizontal body is
 * treated as an axis-aligned ellipse, which gives a stable surface point for
 * every target angle without assuming a particular authored forward axis.
 */
export function harthmereBossMagicPresentation(input: {
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  targetPoint: readonly [number, number, number];
}): HarthmereBossMagicPresentation {
  const position: Vec3 = [
    Number(input.position[0]) || 0,
    Number(input.position[1]) || 0,
    Number(input.position[2]) || 0,
  ];
  const size: Vec3 = [
    finiteDimension(input.size[0]),
    finiteDimension(input.size[1]),
    finiteDimension(input.size[2]),
  ];
  const targetX = Number(input.targetPoint[0]);
  const targetZ = Number(input.targetPoint[2]);
  const dx = (Number.isFinite(targetX) ? targetX : position[0]) - position[0];
  const dz = (Number.isFinite(targetZ) ? targetZ : position[2]) - position[2];
  const targetDistance = Math.hypot(dx, dz);
  const directionX = targetDistance > 1e-5 ? dx / targetDistance : 0;
  const directionZ = targetDistance > 1e-5 ? dz / targetDistance : -1;
  const halfX = size[0] * 0.5;
  const halfZ = size[2] * 0.5;
  const ellipseDenominator = Math.sqrt(
    (directionX * directionX) / (halfX * halfX) +
      (directionZ * directionZ) / (halfZ * halfZ)
  );
  const horizontalBodySurfaceDistance =
    ellipseDenominator > 1e-5 ? 1 / ellipseDenominator : Math.max(halfX, halfZ);

  // Volume-based scaling handles both tall giants and Thaedryn's unusually
  // long body without allowing the single 58 m axis to create a screen-filling
  // charge. The projectile receives a smaller version of the same boost.
  const characteristicSize = Math.cbrt(size[0] * size[1] * size[2]);
  const chargeVisualScale = clamp(
    characteristicSize * 0.28,
    1,
    HARTHMERE_BOSS_MAGIC_MAX_CHARGE_VISUAL_SCALE
  );
  const projectileVisualScale = clamp(
    1 + (chargeVisualScale - 1) * 0.28,
    1,
    HARTHMERE_BOSS_MAGIC_MAX_PROJECTILE_VISUAL_SCALE
  );
  const surfaceMargin = clamp(characteristicSize * 0.08, 0.35, 1.8);
  const desiredOffset = horizontalBodySurfaceDistance + surfaceMargin;
  const targetClearance = clamp(chargeVisualScale * 0.55, 0.8, 4);
  const maximumBetweenCasterAndTarget = Math.max(
    0.35,
    targetDistance - targetClearance
  );
  const targetConstrained =
    targetDistance > 1e-5 && desiredOffset > maximumBetweenCasterAndTarget;
  const horizontalOffset =
    targetDistance > 1e-5
      ? Math.min(desiredOffset, maximumBetweenCasterAndTarget)
      : horizontalBodySurfaceDistance + surfaceMargin;

  return {
    version: HARTHMERE_BOSS_MAGIC_PRESENTATION_VERSION,
    origin: [
      position[0] + directionX * horizontalOffset,
      position[1] + size[1] * 0.62,
      position[2] + directionZ * horizontalOffset,
    ],
    chargeVisualScale,
    projectileVisualScale,
    horizontalBodySurfaceDistance,
    targetConstrained,
  };
}
