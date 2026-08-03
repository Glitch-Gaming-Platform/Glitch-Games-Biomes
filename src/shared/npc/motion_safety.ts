import type { ReadonlyVec2, ReadonlyVec3, Vec2 } from "@/shared/math/types";

export const NPC_MOTION_DIRECTION_EPSILON_SQ = 1e-8;

export function isFiniteNpcOrientation(
  orientation: ReadonlyVec2 | undefined
): orientation is ReadonlyVec2 {
  return Boolean(
    orientation &&
    Number.isFinite(orientation[0]) &&
    Number.isFinite(orientation[1])
  );
}

/** Never allow one malformed target or velocity to publish NaN through HFC. */
export function finiteNpcOrientation(
  candidate: ReadonlyVec2 | undefined,
  fallback: ReadonlyVec2 | undefined = [0, 0]
): Vec2 {
  const safeFallback: Vec2 = isFiniteNpcOrientation(fallback)
    ? [fallback[0], fallback[1]]
    : [0, 0];
  return [
    Number.isFinite(candidate?.[0]) ? candidate![0] : safeFallback[0],
    Number.isFinite(candidate?.[1]) ? candidate![1] : safeFallback[1],
  ];
}

export function hasFiniteNpcMotionDirection(
  direction: ReadonlyVec3 | undefined
) {
  return Boolean(
    direction &&
    direction.every(Number.isFinite) &&
    direction[0] * direction[0] +
      direction[1] * direction[1] +
      direction[2] * direction[2] >=
      NPC_MOTION_DIRECTION_EPSILON_SQ
  );
}
